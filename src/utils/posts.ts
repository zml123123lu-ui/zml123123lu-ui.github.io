import { getCollection, type CollectionEntry } from 'astro:content';
import { CATEGORIES } from '../consts';

export type Post = CollectionEntry<'posts'>;

/** 全部已发布文章，按日期倒序。草稿一律排除。 */
export async function getPosts(): Promise<Post[]> {
  const all = await getCollection('posts', ({ data }) => data.draft !== true);
  return all.sort((a, b) => b.data.pubDate.valueOf() - a.data.pubDate.valueOf());
}

/** 每篇文章的纯文本正文，用于字数与阅读时长估算。 */
export function plainLength(post: Post): number {
  return post.body.replace(/\s/g, '').length;
}

/** 总字数（去掉空白），全站统计用。 */
export function totalChars(posts: Post[]): number {
  return posts.reduce((sum, p) => sum + plainLength(p), 0);
}

/** 五个固定分区，附各自篇数。只返回有内容的。 */
export function categoryCounts(posts: Post[]) {
  const counts = new Map<string, number>();
  for (const p of posts) {
    counts.set(p.data.category, (counts.get(p.data.category) ?? 0) + 1);
  }
  // 保持 CATEGORIES 里的固定顺序，空的也保留（显示 0 比消失好，
  // 让人知道这个分区存在，只是还没写）
  return CATEGORIES.map((c) => ({
    name: c.name,
    color: c.color,
    count: counts.get(c.name) ?? 0,
  }));
}

/** 自由标签，按篇数倒序。 */
export function tagCounts(posts: Post[]) {
  const counts = new Map<string, number>();
  for (const p of posts) {
    for (const t of p.data.tags) {
      counts.set(t, (counts.get(t) ?? 0) + 1);
    }
  }
  return [...counts.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, 'zh'));
}

/** 按年份分组，每年内按日期倒序。 */
export function byYear(posts: Post[]) {
  const map = new Map<number, Post[]>();
  for (const p of posts) {
    const y = p.data.pubDate.getFullYear();
    if (!map.has(y)) map.set(y, []);
    map.get(y)!.push(p);
  }
  return [...map.entries()]
    .map(([year, items]) => ({ year, items }))
    .sort((a, b) => b.year - a.year);
}

/** 取站点里出现最多的 N 个标签，首页索引格用。 */
export function topTags(posts: Post[], n: number) {
  return tagCounts(posts).slice(0, n);
}

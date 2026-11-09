import rss from '@astrojs/rss';
import type { APIContext } from 'astro';
import { SITE } from '../consts';
import { getPosts } from '../utils/posts';

export async function GET(context: APIContext) {
  const posts = await getPosts();

  return rss({
    title: SITE.name,
    description: SITE.description,
    site: context.site ?? 'https://jianji.vercel.app',
    trailingSlash: true,
    items: posts.map((post) => ({
      title: post.data.title,
      description: post.data.description,
      pubDate: post.data.pubDate,
      link: `/posts/${post.id}/`,
      categories: [post.data.category, ...post.data.tags],
      author: SITE.author.name,
    })),
    customData: `<language>zh-cn</language><copyright>© ${SITE.since}–${new Date().getFullYear()} ${SITE.author.name}</copyright>`,
  });
}

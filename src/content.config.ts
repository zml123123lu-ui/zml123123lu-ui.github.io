import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';

/**
 * 文章集合。
 *
 * frontmatter 有类型校验：写错字段名或漏必填项，构建时直接报错，
 * 不会静默产出一个坏页面。
 */
const posts = defineCollection({
  loader: glob({ base: './src/content/posts', pattern: '**/*.{md,mdx}' }),
  schema: z.object({
    title: z.string(),
    subtitle: z.string().default(''),
    description: z.string(),
    pubDate: z.coerce.date(),
    updatedDate: z.coerce.date().optional(),
    /**
     * 只能从三个固定分区里选（读书 / 随笔 / 开发）。
     * 「音乐」不在这里 —— 它是 /music/ 一整页，不放文章。
     */
    category: z.enum(['读书', '随笔', '开发']),
    /** 自由标签 */
    tags: z.array(z.string()).default([]),
    /** 草稿：true 则不出现在任何列表、不进 RSS、不参与构建页面 */
    draft: z.boolean().default(false),
  }),
});

/** 单页内容（关于我等），与文章分开，不出现在列表和 RSS。 */
const pages = defineCollection({
  loader: glob({ base: './src/content/pages', pattern: '**/*.{md,mdx}' }),
  schema: z.object({
    title: z.string(),
    description: z.string().optional(),
  }),
});

/**
 * 音乐页的数据。
 *
 * 这一页不放文章，只放「在听什么」：歌单和单曲都只存**网易云的 ID**，
 * 页面拿 ID 造外链跳转、拿封面做侧脊，**不嵌播放器**（原因见 utils/netease.ts）。
 * 所以这里存的全是 ID 和几句说明 —— 换歌就是换一个数字，不用碰模板。
 *
 * 取 ID 的方法：打开网易云网页版的那首歌 / 那个歌单，
 * 地址栏里的 `id=` 后面那串数字就是。
 *
 * id 用 z.coerce.string()：YAML 里写 64293（不加引号）会被解析成数字，
 * 如果强要求 string，构建会报一个和音乐毫不相干的类型错误。
 */
const music = defineCollection({
  loader: glob({ base: './src/content/music', pattern: '**/*.{md,mdx}' }),
  schema: z.object({
    /** 页面大标题 */
    title: z.string().default('在听什么'),
    /** 标题下面那段说明 */
    intro: z.string().default(''),
    /** 页面底部的注解（版权、能不能听完整之类） */
    note: z.string().default(''),
    playlists: z
      .array(
        z.object({
          id: z.coerce.string(),
          title: z.string(),
          note: z.string().default(''),
        }),
      )
      .default([]),
    tracks: z
      .array(
        z.object({
          id: z.coerce.string(),
          title: z.string(),
          artist: z.string().default(''),
          note: z.string().default(''),
        }),
      )
      .default([]),
  }),
});

export const collections = { posts, pages, music };

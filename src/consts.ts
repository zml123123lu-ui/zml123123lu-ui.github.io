import text from './data/site-text.json';
import catalog from './data/catalog.json';
/**
 * 站点级常量 —— 想改站点名 / 副标题 / 简介 / 联系方式 / 社交链接 / 导航，只改这个文件。
 */

/** GitHub 地址。全站只在这里写一次。 */
const GITHUB = 'https://github.com/zml123123lu-ui';

/**
 * 小红书主页。
 *
 * 用的是小红书 App 里「分享主页 → 复制链接」给出的**官方短链**，
 * 不是它跳转后的长地址。长地址形如
 * https://www.xiaohongshu.com/user/profile/63d1f1f300000000260073e6?xsec_token=...
 * —— 那一长串 `xsec_token` 是会过期的，过期后点进去是空白页；
 * 短链由小红书自己带最新 token 跳转，长期有效。profile id 已记在上面那行注释里，
 * 万一短链哪天失效，可以直接把 id 填回 `.../user/profile/<id>`。
 *
 * ⚠️ 空着是**可以**的：空字符串不会在页面上留下一个点不动的链接，
 *    页脚和关于页会自动跳过这一项。
 */
const XIAOHONGSHU = 'https://xhslink.cn/o/v2jwMmqBQQ';

/**
 * 网易云音乐个人主页。
 *
 * ⚠️ 用**桌面版**地址，不用 App 分享出来的那条
 *    `https://y.music.163.com/m/user?id=...&dlt=...&app_version=...` ——
 *    后者挂着一串统计参数，在电脑浏览器里打开会先弹「打开 App」，
 *    对访客是纯损耗。桌面版地址直接把主页打开。
 *
 * ⚠️ 空着同样可以，空字符串会自动隐藏入口。
 */
const NETEASE = 'https://music.163.com/#/user/home?id=133010508';

/**
 * 社交入口，页脚与关于页共用这一份。
 * 只写「有链接的」—— 空值被过滤掉，任何情况下都不会出现点不动的入口。
 */
export const SOCIAL = catalog.accounts.filter((item) => item.url).map((item) => ({ label: item.title, href: item.url }));

const AUTHOR_LINKS = [...SOCIAL, { label: 'RSS', href: '/rss.xml' }];

export const SITE = {
  /** 站点名 */
  name: text.identity.name,
  /** 一个字的印记，出现在首页大方格 */
  mark: text.identity.mark,
  /** 拉丁文名，出现在方格小标签 */
  latin: text.identity.latin,
  /** 一句话副标题（取自陈奕迅《苦瓜》，黄伟文词） */
  tagline: text.identity.tagline,
  /** 站点描述，用于 meta description / RSS / OG */
  description: text.identity.description,
  /** 站点建立年份，页脚版权用 */
  since: 2026,
  /** 作者信息，关于页与文章页署名用 */
  author: {
    name: text.identity.author,
    bio: text.identity.bio,
    /**
     * **主要**联系邮箱。文章末尾那句「有想法可以到……找我」用的是这个。
     */
    email: text.identity.email,
    /**
     * 备用邮箱。只出现在关于页的联系方式里，文章末尾不用 ——
     * 文末一次列两个邮箱，反而让人不知道该发哪个。
     */
    emailAlt: text.identity.emailAlt,
    links: AUTHOR_LINKS,
  },
} as const;

/**
 * 全站唯一的对外联系入口。
 * 邮箱没填就用 GitHub —— 目的是任何情况下都**不出现一个点不动的链接**。
 */
export const CONTACT = SITE.author.email
  ? { label: '邮箱', href: `mailto:${SITE.author.email}`, text: SITE.author.email }
  : { label: 'GitHub', href: GITHUB, text: 'GitHub' };

/**
 * 主导航。
 * 首页那行方格导航只取前三项（一格一个），所以**顺序有意义**：
 * 前三位是「文章 / 音乐 / 标签」。
 * `sub` 显示在首页方格导航行的小字里。
 */
export const NAV = [
  { label: '写作', href: '/posts/', sub: '文字' },
  { label: '书影音', href: '/shelf/', sub: '读 · 看 · 听' },
  { label: '作品', href: '/works/', sub: '做过的' },
  { label: '账号', href: '/accounts/', sub: '在别处' },
  { label: '标签', href: '/tags/', sub: '按主题' },
  { label: '归档', href: '/archive/', sub: '按年份' },
  { label: '关于', href: '/about/', sub: '关于我' },
] as const;

/**
 * 固定分区（分类）。写文章时 category 只能从这三个里选 ——
 * 分类要克制，否则一年后就变成二十个没人点的空标签。
 * 自由发挥的部分留给 tags。
 *
 * ⚠️ **音乐不在这里。** 它是 /music/ 一整页（抽屉式唱片架，不放文章、
 *    不嵌播放器），不是文章分类。从 2026-09-15 起如此。
 */
export type Category = '读书' | '随笔' | '开发';

export const CATEGORIES: { name: Category; color: string }[] = [
  { name: '读书', color: 'var(--amber)' },
  { name: '随笔', color: 'var(--teal)' },
  { name: '开发', color: 'var(--violet)' },
];

/** 音乐页的地址与配色，首页入口格和导航共用。 */
export const MUSIC = { label: '音乐', href: '/music/', color: 'var(--wine)' };

const CATEGORY_COLOR: Record<string, string> = Object.fromEntries(
  CATEGORIES.map((c) => [c.name, c.color]),
);

/** 取分类对应的色板变量；未知分类回落到墨色。 */
export function categoryColor(name: string): string {
  return CATEGORY_COLOR[name] ?? 'var(--ink-55)';
}

/** 取分类对应的 chip 修饰类名，用于小标签配色。 */
export function categoryClass(name: string): string {
  const map: Record<string, string> = {
    读书: 'amber',
    随笔: 'teal',
    开发: 'violet',
  };
  return map[name] ?? 'plain';
}

/** 统一的日期格式化：2026.09.02 */
export function fmtDate(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}.${p(d.getMonth() + 1)}.${p(d.getDate())}`;
}

/** 按中文字符数估算阅读时长（约 400 字/分钟，取整到分钟，最少 1 分钟）。 */
export function readingTime(body: string): number {
  const chars = body.replace(/\s/g, '').length;
  return Math.max(1, Math.round(chars / 400));
}

/** 千分位：4200 -> 4,200 */
export function thousands(n: number): string {
  return n.toLocaleString('en-US');
}

/**
 * 字数的可读写法。
 * 不要用 Math.round(chars / 10000) —— 8,549 字会被四舍五入成「1 万字」，
 * 那是错的。不足一万就老实用「字」，超过才换成「万字」并保留一位小数。
 */
export function humanChars(n: number): { value: string; unit: string } {
  if (n < 10000) return { value: thousands(n), unit: '字' };
  return { value: (n / 10000).toFixed(1), unit: '万字' };
}

import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import pagefind from 'astro-pagefind';

// ⚠️ site 必须写对：RSS 与 sitemap 靠它生成绝对链接。
// 当前使用 GitHub Pages 免费网址；绑定自有域名时同步更新。
export default defineConfig({
  site: 'https://zml123123lu-ui.github.io',

  // 不要用默认的 'jsx' 压缩：它会把模板里跨行的空白吃掉，
  // 相邻行内元素可能被粘在一起，方格上的间距就毁了。
  compressHTML: false,

  trailingSlash: 'ignore',

  markdown: {
    shikiConfig: {
      themes: { light: 'github-light', dark: 'github-dark-dimmed' },
      wrap: true,
    },
  },

  integrations: [
    sitemap(),
    // forceLanguage 必加：不加的话中文会被逐字拆开建索引，搜索精度大跌。
    pagefind({ indexConfig: { forceLanguage: 'zh' } }),
  ],
});

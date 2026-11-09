/** 清除 Obsidian 行内分类和小红书导出尾注，不改正文中的日期或链接。 */
export function cleanPostBody(body) {
 return body
  .replace(/^\s*#mind\/[^\r\n]+\r?\n/, '')
  .replace(/\n\s*20\d{2}[.年/-]\d{1,2}[.月/-]\d{1,2}日?\s*\n+\s*\[小红书链接\]\(https?:\/\/(?:www\.xiaohongshu\.com|xhslink\.(?:com|cn))\/[^\r\n]*\)\s*$/, '')
  .trim();
}

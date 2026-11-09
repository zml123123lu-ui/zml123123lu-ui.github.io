/**
 * 网易云音乐 —— 只负责「造外链」。
 *
 * ⚠️ 这里**没有** `songSrc` / `playlistSrc` 这类播放器地址了，是故意删掉的。
 *
 *    曾经这一页嵌的是网易云官方的 outchain 外链播放器
 *    （`music.163.com/outchain/player?type=0|2&id=...&auto=0`）—— 它确实能嵌，
 *    也确实能渲染出封面和曲目列表，看起来一切正常。但它播的是**访客自己的账号权限**：
 *
 *      · 未登录 / 无 VIP 的访客，网易云对 VIP 歌曲返回 `code=-110`、`url=null`，
 *        也就是**根本不下发播放地址**；
 *      · 实测一个 10 首的陈奕迅歌单，其中只有 2 首（fee=8，免费）能响；
 *      · 再叠一层现代浏览器默认拦第三方 Cookie，访客就算登录了网易云，
 *        iframe 里也未必读得到登录态。
 *
 *    结论：外链播放器这条路对「主流华语流行」基本是坏的，站点层面无解。
 *    已经改成唱片墙（封面 + 歌名 + 推荐语 + 跳转），封面在构建期自托管，
 *    详见 `src/pages/music.astro` 与 `scripts/fetch_covers.py`。
 *    **不要再往这一页加播放器** —— 除非换到真能对匿名访客放音的平台。
 */

/** 歌曲在网易云上的页面。 */
export function songPage(id: string): string {
  return `https://music.163.com/#/song?id=${encodeURIComponent(id)}`;
}

/** 歌单在网易云上的页面。 */
export function playlistPage(id: string): string {
  return `https://music.163.com/#/playlist?id=${encodeURIComponent(id)}`;
}

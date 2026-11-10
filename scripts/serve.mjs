import { readDashboard, saveManagedContent } from './content-manager.mjs';
import { readBookCover } from './book-cover-reader.mjs';
import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { randomBytes, randomUUID } from 'node:crypto';
import { ROOT, readPlaylist, importPlaylist, readPreviewCover } from './music-import.mjs';

const port = Number(process.env.PORT || 4321);
const hosts = new Set([`127.0.0.1:${port}`, `localhost:${port}`]);
const token = randomBytes(32).toString('hex');
const drafts = new Map();
let importing = false;
const dist = path.join(ROOT, 'dist');
const types = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8', '.xml': 'application/xml; charset=utf-8', '.svg': 'image/svg+xml', '.webp': 'image/webp', '.jpg': 'image/jpeg', '.png': 'image/png', '.woff2': 'font/woff2', '.webm': 'video/webm', '.wasm': 'application/wasm' };
function sendJSON(response, status, data) {
  response.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
  response.end(JSON.stringify(data));
}
async function bodyOf(request, limit = 8192) {
  let body = '';
  for await (const chunk of request) {
    body += chunk;
    if (Buffer.byteLength(body) > limit) throw new Error('提交的内容过大，请减少文字后重试。');
  }
  try { return JSON.parse(body); } catch { throw new Error('提交内容格式不正确。'); }
}
const server = http.createServer(async (request, response) => {
  try {
    const url = new URL(request.url, 'http://127.0.0.1');
    if (url.pathname.startsWith('/api/')) {
      if (!hosts.has(request.headers.host)) return sendJSON(response, 403, { error: '管理功能仅限本机使用。' });
      if (url.pathname === '/api/music/status' && request.method === 'GET') return sendJSON(response, 200, { available: true, token });
      if (url.pathname === '/api/content' && request.method === 'GET') {
        if(request.headers['x-music-token'] !== token) return sendJSON(response,403,{error:'请从本机管理页打开。'});
        return sendJSON(response,200,await readDashboard());
      }
      if (request.method !== 'POST') return sendJSON(response, 405, { error: '不支持的操作。' });
      if (request.headers.origin !== `http://${request.headers.host}` || request.headers['x-music-token'] !== token || request.headers['content-type']?.split(';')[0] !== 'application/json') return sendJSON(response, 403, { error: '请从本机网页打开编辑或导入窗口。' });
      if (importing) return sendJSON(response, 409, { error: '正在更新内容，请等待当前操作完成。' });
      const body = await bodyOf(request, url.pathname === '/api/content/save' ? 300000 : 8192);
      if (url.pathname === '/api/content/save') {
        if(importing) return sendJSON(response,409,{error:'正在保存，请稍后重试。'});
        importing=true;
        try { return sendJSON(response,200,await saveManagedContent(body)); }
        finally { importing=false; }
      }
      for (const [key, draft] of drafts) if (draft.expires < Date.now()) drafts.delete(key);
      if (url.pathname === '/api/music/preview') {
        if (drafts.size >= 10) return sendJSON(response, 429, { error: '预览次数较多，请稍后再试。' });
        const playlist = await readPlaylist(body.url);
        const draftId = randomUUID();
        drafts.set(draftId, { playlist, expires: Date.now() + 15 * 60 * 1000 });
        const coverImage = await readPreviewCover(playlist.coverUrl).catch(() => null);
        return sendJSON(response, 200, { draftId, ...playlist, coverImage });
      }
      if (url.pathname === '/api/music/import') {
        if (importing) return sendJSON(response, 409, { error: '正在更新内容，请等待当前操作完成。' });
        const draft = drafts.get(body.draftId);
        if (!draft) return sendJSON(response, 400, { error: '歌单预览已过期，请重新读取。' });
        importing = true;
        try {
          const result = await importPlaylist(draft.playlist);
          drafts.delete(body.draftId);
          return sendJSON(response, 200, result);
        } finally { importing = false; }
      }
      return sendJSON(response, 404, { error: '没有这个操作。' });
    }
    if (!['GET', 'HEAD'].includes(request.method)) { response.writeHead(405); return response.end(); }
    const pathname = decodeURIComponent(url.pathname);
    const isBookCover = pathname.startsWith('/book-covers/');
    const staticRoot = isBookCover ? path.join(ROOT, 'public') : dist;
    const file = path.resolve(staticRoot, '.' + pathname);
    if (file !== staticRoot && !file.startsWith(staticRoot + path.sep)) { response.writeHead(403); return response.end(); }
    let target = file;
    let status = 200;
    try {
      if ((await stat(target)).isDirectory()) target = path.join(target, 'index.html');
      await stat(target);
    } catch { target = path.join(dist, '404.html'); status = 404; }
    const bytes = isBookCover && status === 200 ? await readBookCover(target) : await readFile(target);
    response.writeHead(status, { 'Content-Type': types[path.extname(target)] || 'application/octet-stream', 'Content-Length': bytes.length, 'X-Content-Type-Options': 'nosniff', ...(path.extname(target) === '.html' ? { 'Cache-Control': 'no-cache' } : {}) });
    response.end(request.method === 'HEAD' ? undefined : bytes);
  } catch (error) {
    console.error(error.message);
    if (!response.headersSent) sendJSON(response, 400, { error: error.message === 'fetch failed' ? '连接网易云失败，请稍后重试。' : error.message });
    else response.end();
  }
});
server.listen(port, '127.0.0.1', () => console.log(`见己本地预览：http://127.0.0.1:${port}/（支持文字编辑和歌单导入）`));

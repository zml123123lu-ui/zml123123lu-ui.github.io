import { readFile, writeFile, mkdir, mkdtemp, copyFile, rename, rm, access, realpath } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { spawn } from 'node:child_process';
import sharp from 'sharp';

export const ROOT = fileURLToPath(new URL('../', import.meta.url));
const headers = { 'User-Agent': 'Mozilla/5.0', Referer: 'https://music.163.com/' };
const MAX_TRACKS = 2000;
export function parsePlaylistId(value) {
  if (typeof value !== 'string' || value.length > 4096) throw new Error('请粘贴网易云歌单分享链接。');
  const text = value.trim();
  if (/^\d{1,20}$/.test(text)) return text;
  const candidate = text.match(/https?:\/\/[^\s<>]+/)?.[0].replace(/[)\]，。]+$/, '');
  if (!candidate) throw new Error('没有找到网易云歌单链接。');
  const url = new URL(candidate);
  if (!['music.163.com', 'y.music.163.com'].includes(url.hostname) || url.username || url.password || url.port) throw new Error('请使用网易云的歌单分享链接。');
  const route = url.hash.startsWith('#/') ? new URL(url.hash.slice(1), url.origin) : url;
  if (!/^\/(?:m\/)?playlist\/?$/.test(route.pathname)) throw new Error('这是单曲或个人主页链接，请复制歌单的分享链接。');
  const id = route.searchParams.get('id') ?? '';
  if (!/^\d{1,20}$/.test(id)) throw new Error('歌单链接缺少有效的 ID。');
  return id;
}

async function limitedFetch(url, fetcher, limit) {
  const response = await fetcher(url, { headers, redirect: 'error', signal: AbortSignal.timeout(25000) });
  if (!response.ok) throw new Error('网易云暂时无法读取，请稍后重试。');
  const chunks = [];
  let size = 0;
  for await (const chunk of response.body) {
    size += chunk.length;
    if (size > limit) throw new Error('返回内容过大，导入已停止。');
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}
const json = async (url, fetcher) => JSON.parse((await limitedFetch(url, fetcher, 8 * 1024 * 1024)).toString('utf8'));
function coverURL(value) {
  try {
    const url = new URL(value);
    if (!['http:', 'https:'].includes(url.protocol) || !/^p\d+\.music\.126\.net$/.test(url.hostname) || url.port || url.username || url.password) throw new Error();
    url.protocol = 'https:';
    url.search = '?param=500y500';
    return url.href;
  } catch { throw new Error('歌单返回的封面地址无效，原内容没有更改。'); }
}

export async function readPlaylist(input, fetcher = fetch) {
  const id = parsePlaylistId(input);
  const data = await json(`https://music.163.com/api/v6/playlist/detail?id=${id}`, fetcher);
  const playlist = data.playlist;
  if (data.code !== 200 || !playlist) throw new Error('无法读取歌单。请确认歌单公开、链接有效，且不需要登录。');
  const ids = [...new Set((playlist.trackIds ?? []).map((entry) => String(entry.id)))];
  if (!ids.length) throw new Error('歌单没有可读取的歌曲，可能为空或需要登录。');
  if (ids.length > MAX_TRACKS) throw new Error(`当前一次最多导入 ${MAX_TRACKS} 首，请拆分歌单后导入。`);
  if (ids.some((id) => !/^\d{1,20}$/.test(id))) throw new Error('歌曲信息异常，无法导入。');
  if (Number(playlist.trackCount) !== ids.length) throw new Error('无法读取完整歌单，请检查歌单是否公开或稍后重试。');
  const songs = new Map();
  for (let i = 0; i < ids.length; i += 100) {
    const batch = ids.slice(i, i + 100);
    const details = await json(`https://music.163.com/api/song/detail/?ids=${encodeURIComponent(JSON.stringify(batch))}`, fetcher);
    if (details.code !== 200) throw new Error('读取歌曲详情失败，尚未替换现有音乐。');
    for (const song of details.songs ?? []) songs.set(String(song.id), song);
  }
  if (ids.some((id) => !songs.has(id))) throw new Error('网易云没有返回完整歌曲详情，缺少的歌曲没有被静默跳过。');
  const tracks = ids.map((id) => {
    const song = songs.get(id);
    return { id, title: String(song.name ?? '').slice(0, 300), artist: (song.artists ?? song.ar ?? []).map((artist) => String(artist.name ?? '')).join(' / ').slice(0, 500), coverUrl: coverURL(song.album?.picUrl ?? song.al?.picUrl) };
  });
  return { id, name: String(playlist.name ?? '网易云歌单').slice(0, 300), total: ids.length, coverUrl: playlist.coverImgUrl ? coverURL(playlist.coverImgUrl) : tracks[0].coverUrl, tracks };
}

export async function readPreviewCover(url) {
  const bytes = await limitedFetch(coverURL(url), fetch, 5 * 1024 * 1024);
  const image = await sharp(bytes, { limitInputPixels: 40_000_000 }).resize(160, 160, { fit: 'cover' }).jpeg({ quality: 85 }).toBuffer();
  return `data:image/jpeg;base64,${image.toString('base64')}`;
}

export function updateListening(source, playlist) {
  const match = /^---\r?\n([\s\S]*?)\r?\n---/.exec(source);
  if (!match) throw new Error('音乐内容格式异常，无法保存。');
  const yamlString = (value) => JSON.stringify(String(value));
  const section = (name, items) => `${name}:\n${items.map((item) => Object.entries(item).map(([key, value], i) => `  ${i === 0 ? '- ' : '  '}${key}: ${yamlString(value)}`).join('\n')).join('\n')}\n`;
  let frontmatter = match[1] + '\n';
  for (const [key, items] of [
    ['playlists', [{ id: playlist.id, title: playlist.name, note: '' }]],
    ['tracks', playlist.tracks.map(({ id, title, artist }) => ({ id, title, artist }))],
  ]) {
    const expression = new RegExp(`^${key}:[\\s\\S]*?(?=^\\S|(?![\\s\\S]))`, 'm');
    if (!expression.test(frontmatter)) throw new Error(`音乐内容缺少 ${key} 字段，无法保存。`);
    frontmatter = frontmatter.replace(expression, () => section(key, items));
  }
  frontmatter = frontmatter.replace(/^# ↓ 下面都是示例数据.*\n/m, '# 歌单通过本机网页导入，封面已保存到项目。\n');
  return `---\n${frontmatter.trimEnd()}\n---${source.slice(match[0].length)}`;
}

function toneOf(rgb) {
  let channels = [rgb.r, rgb.g, rgb.b];
  const luminance = () => channels.map((c) => c / 255).map((c) => c <= .04045 ? c / 12.92 : ((c + .055) / 1.055) ** 2.4).reduce((sum, c, i) => sum + c * [.2126, .7152, .0722][i], 0);
  while (1.05 / (luminance() + .05) < 6) channels = channels.map((c) => Math.floor(c * .9));
  if (Math.max(...channels) < 24) channels = [56, 56, 56];
  return '#' + channels.map((c) => c.toString(16).padStart(2, '0')).join('');
}
export function buildSite(output) {
  return new Promise((resolve, reject) => {
    // 空集合会保留 Astro 的旧内容缓存，删除最后一篇后必须强制重新同步。
    const child = spawn(process.execPath, [path.join(ROOT, 'node_modules/astro/bin/astro.mjs'), 'build', '--force', '--outDir', output], { cwd: ROOT, stdio: ['ignore', 'pipe', 'pipe'] });
    let tail = '';
    for (const stream of [child.stdout, child.stderr]) stream.on('data', (chunk) => { tail = (tail + chunk).slice(-2000); });
    const timeout = setTimeout(() => child.kill('SIGTERM'), 180000);
    child.on('error', (error) => { clearTimeout(timeout); reject(error); });
    child.on('exit', (code) => { clearTimeout(timeout); if (code === 0) resolve(); else { console.error(tail); reject(new Error('页面生成失败，已保留原来的音乐，请重试。')); } });
  });
}

export async function importPlaylist(playlist, { root = ROOT, fetcher = fetch, build = buildSite } = {}) {
  const source = path.join(root, 'src/content/music/listening.md');
  const covers = path.join(root, 'src/assets/covers');
  const tonesPath = path.join(covers, 'tones.json');
  const [oldContent, oldTones] = await Promise.all([readFile(source, 'utf8'), readFile(tonesPath, 'utf8')]);
  const staging = await mkdtemp(path.join(root, '.music-import-'));
  const output = path.join(staging, 'dist');
  const tones = {};
  const newFiles = [];
  let changed = false;
  let swapped = false;
  try {
    const images = [...playlist.tracks.map((track) => ({ id: track.id, url: track.coverUrl })), ...(playlist.coverUrl ? [{ id: `playlist-${playlist.id}`, url: playlist.coverUrl }] : [])];
    let cursor = 0;
    // 封面先暂存；任一下载失败时不改已有内容。
    const downloads = await Promise.allSettled(Array.from({ length: Math.min(4, images.length) }, async () => {
      while (cursor < images.length) {
        const image = images[cursor++];
        const existing = path.join(covers, `${image.id}.jpg`);
        let file = existing;
        try { await access(existing); } catch {
          const bytes = await limitedFetch(coverURL(image.url), fetcher, 5 * 1024 * 1024);
          file = path.join(staging, `${image.id}.jpg`);
          await sharp(bytes, { limitInputPixels: 40_000_000 }).resize(500, 500, { fit: 'cover' }).jpeg({ quality: 88 }).toFile(file);
          newFiles.push([file, existing]);
        }
        if (!image.id.startsWith('playlist-')) tones[image.id] = toneOf((await sharp(file).stats()).dominant);
      }
    }));
    const failed = downloads.find((result) => result.status === 'rejected');
    if (failed) throw failed.reason;
    await mkdir(covers, { recursive: true });
    for (const [from, to] of newFiles) await copyFile(from, to);
    changed = true;
    await writeFile(source, updateListening(oldContent, playlist));
    await writeFile(tonesPath, JSON.stringify(tones, null, 2) + '\n');
    await build(output);
    const previous = path.join(staging, 'previous-dist');
    const destination = await realpath(path.join(root, 'dist'));
    await rename(destination, previous);
    try { await rename(output, destination); swapped = true; }
    catch (error) { await rename(previous, destination); throw error; }
    return { imported: playlist.tracks.length, name: playlist.name };
  } catch (error) {
    if (changed && !swapped) {
      await writeFile(source, oldContent);
      await writeFile(tonesPath, oldTones);
      for (const [, file] of newFiles) await rm(file, { force: true });
    }
    throw error;
  } finally { await rm(staging, { recursive: true, force: true }); }
}

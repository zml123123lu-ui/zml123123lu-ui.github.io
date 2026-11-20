import test from 'node:test';
import assert from 'node:assert/strict';
import { parsePlaylistId, readPlaylist, updateListening, importPlaylist } from './music-import.mjs';
import { mkdtemp, mkdir, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import sharp from 'sharp';

test('只接受网易云歌单 ID，兼容桌面、手机和分享文字', () => {
  for (const value of ['167438847', 'https://music.163.com/playlist?id=167438847&uct2=abc', 'https://music.163.com/#/playlist?id=167438847', '分享歌单 https://y.music.163.com/m/playlist?id=167438847']) assert.equal(parsePlaylistId(value), '167438847');
  for (const value of ['https://evil.test/playlist?id=167438847', 'https://music.163.com.evil.test/playlist?id=167438847', 'https://music.163.com/song?id=64293', 'file:///etc/passwd', 'https://music.163.com@evil.test/playlist?id=1']) assert.throws(() => parsePlaylistId(value));
});
const song = (id) => ({ id, name: `歌 ${id}`, artists: [{ name: '歌手' }], album: { picUrl: `https://p1.music.126.net/${id}.jpg` } });
test('按完整 ID 列表读取并保留顺序，不把预览当成全量', async () => {
  const result = await readPlaylist('1', async (url) => Response.json(url.includes('/playlist/detail') ? { code: 200, playlist: { name: '喜欢的音乐', trackCount: 3, tracks: [song(3)], trackIds: [{ id: 3 }, { id: 1 }, { id: 2 }] } } : { code: 200, songs: [song(1), song(2), song(3)] }));
  assert.deepEqual(result.tracks.map((track) => track.id), ['3', '1', '2']);
  assert.equal(result.total, 3);
});
test('私密或无法完整读取时明确失败', async () => {
  await assert.rejects(readPlaylist('1', async () => Response.json({ code: 401 })), /公开|登录|读取/);
  await assert.rejects(readPlaylist('1', async (url) => Response.json(url.includes('/playlist/detail') ? { code: 200, playlist: { name: '测试', trackCount: 2, trackIds: [{ id: 1 }, { id: 2 }] } } : { code: 200, songs: [song(1)] })), /完整|缺少/);
});
test('替换歌单和单曲时保留页面正文，恶意标题保持普通字符串', () => {
  const source = '---\ntitle: 在听什么\nintro: 测试\nplaylists:\n  - id: "9"\n    title: "旧歌单"\ntracks:\n  - id: "8"\n    title: "旧歌"\n---\n保留正文\n';
  const next = updateListening(source, { id: '1', name: '新歌单', tracks: [{ id: '2', title: '标题\n---\n<script>x</script>', artist: '歌手' }] });
  assert(next.includes('title: 在听什么'));
  assert(next.endsWith('保留正文\n'));
  assert(!next.includes('旧歌单'));
  assert(next.includes('标题\\n---\\n<script>x</script>'));
});
test('构建失败恢复旧内容，成功后才更换静态页面', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'jianji-import-test-'));
  try {
    await mkdir(path.join(root, 'src/content/music'), { recursive: true });
    await mkdir(path.join(root, 'src/assets/covers'), { recursive: true });
    await mkdir(path.join(root, 'dist'));
    const original = '---\ntitle: 在听什么\nplaylists: []\ntracks: []\n---\n正文';
    await writeFile(path.join(root, 'src/content/music/listening.md'), original);
    await writeFile(path.join(root, 'src/assets/covers/tones.json'), '{}');
    await writeFile(path.join(root, 'dist/index.html'), 'old');
    const image = await sharp({ create: { width: 2, height: 2, channels: 3, background: '#526637' } }).jpeg().toBuffer();
    const draft = { id: '1', name: '测试', total: 1, tracks: [{ id: '2', title: '歌', artist: '人', coverUrl: 'https://p1.music.126.net/2.jpg' }] };
    const fetcher = async () => new Response(image);
    await assert.rejects(importPlaylist(draft, { root, fetcher, build: async () => { throw new Error('build failed'); } }));
    assert.equal(await readFile(path.join(root, 'src/content/music/listening.md'), 'utf8'), original);
    assert.equal(await readFile(path.join(root, 'dist/index.html'), 'utf8'), 'old');
    await importPlaylist(draft, { root, fetcher, build: async (out) => { await mkdir(out); await writeFile(path.join(out, 'index.html'), 'new'); } });
    assert.equal(await readFile(path.join(root, 'dist/index.html'), 'utf8'), 'new');
    assert((await readFile(path.join(root, 'src/content/music/listening.md'), 'utf8')).includes('title: "测试"'));
  } finally { await rm(root, { recursive: true, force: true }); }
});

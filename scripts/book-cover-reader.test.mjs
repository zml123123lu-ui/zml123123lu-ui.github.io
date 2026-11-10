import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { readBookCover } from './book-cover-reader.mjs';

test('封面缓存可应对后续iCloud读取失败，原图修改或删除时不会继续返回旧图', async t => {
  const folder = await fs.mkdtemp(path.join(os.tmpdir(), 'jianji-cover-'));
  const file = path.join(folder, 'cover.jpg');
  try {
    await fs.writeFile(file, 'original cover');
    assert.equal((await readBookCover(file)).toString(), 'original cover');
    const mock = t.mock.method(fs, 'readFile', async () => { throw Object.assign(new Error('iCloud placeholder'), { errno: -11 }); });
    assert.equal((await readBookCover(file)).toString(), 'original cover');
    mock.mock.restore();
    await fs.writeFile(file, 'updated image bytes');
    assert.equal((await readBookCover(file)).toString(), 'updated image bytes');
    await fs.unlink(file);
    await assert.rejects(readBookCover(file), { code: 'ENOENT' });
  } finally { await fs.rm(folder, { recursive: true, force: true }); }
});

test('首次读取失败不会缓存坏内容，文件恢复后可正常重试', async t => {
  const folder = await fs.mkdtemp(path.join(os.tmpdir(), 'jianji-cover-retry-'));
  const file = path.join(folder, 'cover.jpg');
  try {
    await fs.writeFile(file, 'valid image');
    const mock = t.mock.method(fs, 'readFile', async () => { throw Object.assign(new Error('iCloud placeholder'), { errno: -11 }); });
    await assert.rejects(readBookCover(file), { errno: -11 });
    mock.mock.restore();
    assert.equal((await readBookCover(file)).toString(), 'valid image');
  } finally { await fs.rm(folder, { recursive: true, force: true }); }
});

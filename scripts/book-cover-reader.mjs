import fs from 'node:fs/promises';

const covers = new Map();

// 本机封面很少，保留原图字节，避免iCloud收回构建副本后出现破图。
export async function readBookCover(file) {
  const info = await fs.stat(file);
  const version = `${info.ino}:${info.mtimeMs}:${info.size}`;
  const cached = covers.get(file);
  if (cached?.version === version) return cached.bytes;
  const bytes = await fs.readFile(file);
  covers.set(file, { version, bytes });
  return bytes;
}

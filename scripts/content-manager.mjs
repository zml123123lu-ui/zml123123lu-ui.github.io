import { readFile, writeFile, readdir, mkdtemp, rename, rm, realpath } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import yaml from 'js-yaml';
import { ROOT, buildSite } from './music-import.mjs';
import fields from '../src/data/editor-fields.json' with { type: 'json' };
import siteFields from '../src/data/site-fields.json' with { type: 'json' };
const idPattern = /^[a-z0-9][a-z0-9_-]{0,119}$/;
const headerPattern = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/;
const siteFiles = { about:'src/content/pages/about.md', music:'src/content/music/listening.md' };
function definition(kind, id) {
 return kind === 'site' && Object.hasOwn(siteFields,id) ? siteFields[id] : Object.hasOwn(fields,kind) ? fields[kind] : null;
}
export function cleanEntry(kind, entry) {
 const schema = entry && definition(kind,entry.id);
 if (!schema || typeof entry !== 'object') throw new Error('不支持的内容类型。');
 const clean = {};
 for (const [key,label,type,options] of schema.fields) {
  if (type === 'checkbox') { clean[key] = entry[key] === true; continue; }
  const value = String(entry[key] ?? (kind === 'films' && key === 'group' ? '电影' : '')).trim();
  if (value.length > (key === 'body' ? 150000 : key === 'note' ? 10000 : 1000)) throw new Error(`${label}太长。`);
  if (key === 'title' && !value) throw new Error('请填写标题或名称。');
  const localCover = key === 'cover' && ((kind === 'books' && /^\/book-covers\/[a-z0-9-]+\.(?:jpg|jpeg|png|webp)$/i.test(value)) || (kind === 'films' && /^\/film-posters\/[a-z0-9-]+\.(?:jpg|jpeg|png|webp)$/i.test(value)));
  const localWork = kind === 'works' && key === 'url' && /^\/works\/[a-z0-9-]+\/$/.test(value);
  if (type === 'url' && value && !localCover && !localWork) { let url; try { url = new URL(value); } catch { throw new Error(`${label}需要完整的网址。`); } if (!['http:','https:'].includes(url.protocol) || url.username || url.password) throw new Error(`${label}只支持公开网页地址。`); }
  if (type === 'email' && value && !/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(value)) throw new Error(`${label}格式不正确。`);
  if (type === 'select' && !options.includes(value)) throw new Error(`请选择${label}。`);
  if (type === 'date' && value && (!/^\d{4}-\d{2}-\d{2}$/.test(value) || Number.isNaN(Date.parse(value)))) throw new Error(`${label}无效。`);
  if (type === 'number') { if (value && (!/^[1-5]$/.test(value))) throw new Error('评分请填 1 到 5。'); if (value) clean[key] = Number(value); continue; }
  clean[key] = value;
 }
 if (kind === 'posts' && !clean.pubDate) throw new Error('请填写文章日期。');
 return clean;
}
export async function readDashboard(root = ROOT) {
 const data = JSON.parse(await readFile(path.join(root,'src/data/catalog.json'),'utf8'));
 const directory = path.join(root,'src/content/posts');
 data.posts = await Promise.all((await readdir(directory)).filter(name=>name.endsWith('.md')).map(async name=>{
  const text = await readFile(path.join(directory,name),'utf8');
  const match = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/.exec(text);
  if (!match) throw new Error('文章格式异常。');
  const entry = yaml.load(match[1]);
  return { id:name.slice(0,-3), ...entry, pubDate: new Date(entry.pubDate).toISOString().slice(0,10), tags:(entry.tags??[]).join(', '), body:text.slice(match[0].length), draft:entry.draft===true };
 }));
 data.posts.sort((a,b)=>b.pubDate.localeCompare(a.pubDate));
 const copy = JSON.parse(await readFile(path.join(root,'src/data/site-text.json'),'utf8'));
 data.site = Object.entries(copy).map(([id,entry])=>({id,...entry}));
 for (const [id,file] of Object.entries(siteFiles)) {
  const source = await readFile(path.join(root,file),'utf8'), match = headerPattern.exec(source);
  if (!match) throw new Error('页面格式异常。');
  const meta = yaml.load(match[1]);
  data.site.push(id === 'about' ? {id,body:source.slice(match[0].length)} : {id,title:meta.title,intro:meta.intro,note:meta.note});
 }
 return data;
}
export async function saveManagedContent({ kind, entry, operation = 'save' }, { root = ROOT, build = buildSite } = {}) {
 const schema = definition(kind,entry?.id);
 if (!schema || !['save','remove'].includes(operation) || (kind === 'site' && operation !== 'save')) throw new Error('不支持的操作。');
 const id = entry?.id || randomUUID();
 if (!idPattern.test(id)) throw new Error('内容标识无效。');
 if (entry.changes) {
  if (operation !== 'save' || typeof entry.changes !== 'object' || Array.isArray(entry.changes) || Object.keys(entry.changes).some(key=>!schema.fields.some(([name])=>name===key))) throw new Error('不能修改这个字段。');
  const current = (await readDashboard(root))[kind].find(item=>item.id===id);
  if (!current) throw new Error('记录已不存在。');
  entry = {...current,...entry.changes};
 }
 const cleaned = operation === 'save' ? cleanEntry(kind,entry) : null;
 const file = path.join(root, kind === 'site' ? (siteFiles[id] || 'src/data/site-text.json') : kind === 'posts' ? `src/content/posts/${id}.md` : 'src/data/catalog.json');
 let previous;
 try { previous = await readFile(file,'utf8'); } catch(error) { if(error.code !== 'ENOENT') throw error; }
 if (operation === 'remove' && previous === undefined) throw new Error('记录已不存在。');
 let next;
 if (kind === 'site') {
  if (siteFiles[id]) {
   const match = headerPattern.exec(previous);
   if (!match) throw new Error('页面格式异常。');
   next = id === 'about' ? previous.slice(0,match[0].length) + '\n' + cleaned.body + '\n' : `---\n${yaml.dump({...yaml.load(match[1]),...cleaned},{lineWidth:-1,noRefs:true})}---\n${previous.slice(match[0].length)}`;
  } else {
   const copy = JSON.parse(previous);
   copy[id] = cleaned;
   next = JSON.stringify(copy,null,2)+'\n';
  }
 } else if (kind === 'posts') {
  if (cleaned) {
   const { body, ...editedMeta } = cleaned;
   const oldHeader = previous && /^---\r?\n([\s\S]*?)\r?\n---/.exec(previous);
   const meta = { ...(oldHeader ? yaml.load(oldHeader[1]) : {}), ...editedMeta };
   meta.tags = meta.tags.split(/[,，]/).map(tag=>tag.trim()).filter(Boolean);
   if (!meta.description) meta.description = body.replace(/[#*`>\n]/g,' ').trim().slice(0,120) || meta.title;
   next = `---\n${yaml.dump(meta,{lineWidth:-1,noRefs:true})}---\n\n${body}\n`;
  }
 } else {
  const catalog = JSON.parse(previous);
  const existing = catalog[kind].findIndex(item=>item.id===id);
  if (operation === 'remove') { if(existing<0) throw new Error('记录已不存在。'); catalog[kind].splice(existing,1); }
  else if(existing<0) catalog[kind].push({id,...cleaned});
  else catalog[kind][existing] = {id,...cleaned};
  next = JSON.stringify(catalog,null,2)+'\n';
 }
 const stage = await mkdtemp(path.join(root,'.content-save-'));
 try {
  if (next === undefined) await rm(file); else await writeFile(file,next);
  await build(path.join(stage,'dist'));
  const destination = await realpath(path.join(root,'dist'));
  await rename(destination,path.join(stage,'previous-dist'));
  try { await rename(path.join(stage,'dist'),destination); }
  catch(error) { await rename(path.join(stage,'previous-dist'),destination); throw error; }
  return { id, saved:true };
 } catch(error) {
  if(previous===undefined) await rm(file,{force:true}); else await writeFile(file,previous);
  throw error;
 } finally { await rm(stage,{recursive:true,force:true}); }
}

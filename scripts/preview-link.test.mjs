import test from 'node:test';import assert from 'node:assert/strict';
import {mkdtemp,mkdir,symlink,writeFile,readFile,lstat,rm} from 'node:fs/promises';import {tmpdir} from 'node:os';import path from 'node:path';import sharp from 'sharp';
import {saveManagedContent} from './content-manager.mjs';import {importPlaylist} from './music-import.mjs';
test('预览使用缓存目录链接时，内容保存与歌单导入仍能原子替换并保持链接',async()=>{
 const root=await mkdtemp(path.join(tmpdir(),'jianji-preview-link-'));
 try{
  await mkdir(path.join(root,'cache'));await symlink(path.join(root,'cache'),path.join(root,'dist'),'dir');await writeFile(path.join(root,'cache/index.html'),'old');
  await mkdir(path.join(root,'src/data'),{recursive:true});await writeFile(path.join(root,'src/data/catalog.json'),JSON.stringify({books:[],accounts:[],works:[],films:[]}));
  const build=async out=>{await mkdir(out);await writeFile(path.join(out,'index.html'),'new')};
  const fixture={kind:'books',entry:{id:'test-book',title:'测试',status:'在读'}};
  await assert.rejects(saveManagedContent(fixture,{root,build:async()=>{throw Error('failed')}}));
  assert.equal(await readFile(path.join(root,'dist/index.html'),'utf8'),'old');
  await saveManagedContent(fixture,{root,build});assert((await lstat(path.join(root,'dist'))).isSymbolicLink());assert.equal(await readFile(path.join(root,'dist/index.html'),'utf8'),'new');
  await assert.rejects(saveManagedContent(fixture,{root,build:async()=>{}}));assert.equal(await readFile(path.join(root,'dist/index.html'),'utf8'),'new');assert((await lstat(path.join(root,'dist'))).isSymbolicLink());
  await mkdir(path.join(root,'src/content/music'),{recursive:true});await mkdir(path.join(root,'src/assets/covers'),{recursive:true});await writeFile(path.join(root,'src/content/music/listening.md'),'---\ntitle: 在听什么\nplaylists: []\ntracks: []\n---\n');await writeFile(path.join(root,'src/assets/covers/tones.json'),'{}');
  const image=await sharp({create:{width:2,height:2,channels:3,background:'#333'}}).jpeg().toBuffer();
  const draft={id:'1',name:'测试',total:1,tracks:[{id:'2',title:'歌',artist:'人',coverUrl:'https://p1.music.126.net/2.jpg'}]};
  await importPlaylist(draft,{root,build,fetcher:async()=>new Response(image)});assert((await lstat(path.join(root,'dist'))).isSymbolicLink());assert.equal(await readFile(path.join(root,'dist/index.html'),'utf8'),'new');
 }finally{await rm(root,{recursive:true,force:true})}
});

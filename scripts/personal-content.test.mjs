import test from 'node:test';import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,readFile,rm,cp} from 'node:fs/promises';import {tmpdir} from 'node:os';import path from 'node:path';import sharp from 'sharp';
import {uploadPersonalImage} from './personal-media.mjs';import {saveManagedContent,cleanEntry,readDashboard} from './content-manager.mjs';
test('专辑和日常校验图片、日期与链接，不接受越界路径和超过九图',()=>{
 const src='/personal-media/'+'a'.repeat(64)+'.webp';
 const album={title:'专辑',artist:'音乐人',pubDate:'2026-11-18',cover:src,body:'感受'};
 assert.equal(cleanEntry('albums',album).title,'专辑');
 for(const patch of [{artist:''},{pubDate:'2026-02-31'},{cover:'/../private.webp'},{url:'javascript:alert(1)'},{releaseYear:'abc'}])assert.throws(()=>cleanEntry('albums',{...album,...patch}));
 for(const images of [[],Array(10).fill({src,alt:''}),[{src:'https://external.test/a.jpg',alt:''}]])assert.throws(()=>cleanEntry('moments',{pubDate:'2026-11-18',images}));
 assert.equal(cleanEntry('moments',{pubDate:'2026-11-18',images:[{src,alt:'照片'}]}).images[0].alt,'照片');
});
test('上传仅接受静态位图，转为自托管WebP；新内容保存/删除失败回滚，稳定ID不变',async()=>{
 const root=await mkdtemp(path.join(tmpdir(),'jianji-personal-'));
 try{
  await mkdir(path.join(root,'src/content/posts'),{recursive:true});await mkdir(path.join(root,'src/data'));await mkdir(path.join(root,'dist'));await writeFile(path.join(root,'dist/index.html'),'old');
  await writeFile(path.join(root,'src/data/catalog.json'),JSON.stringify({books:[],films:[],works:[],accounts:[]}));
  await cp(new URL('../src/data/site-text.json',import.meta.url),path.join(root,'src/data/site-text.json'));
  for(const kind of ['pages','music'])await cp(new URL(`../src/content/${kind}`,import.meta.url),path.join(root,'src/content',kind),{recursive:true});
  await assert.rejects(uploadPersonalImage({data:Buffer.from('<svg/>').toString('base64')},{root}));
  await assert.rejects(uploadPersonalImage({data:'invalid?!'},{root}));
  const input=await sharp({create:{width:2000,height:1000,channels:3,background:'#f06'}}).png().toBuffer();const image=await uploadPersonalImage({data:input.toString('base64')},{root});
  assert.equal((await uploadPersonalImage({data:input.toString('base64')},{root})).src,image.src);
  const meta=await sharp(path.join(root,'public',image.src)).metadata();assert.equal(meta.format,'webp');assert.equal(meta.width,1600);assert.equal(meta.height,800);
  const build=async out=>{await mkdir(out);await writeFile(path.join(out,'index.html'),'new')};
  const entry={id:'album-test',title:'测试专辑',artist:'音乐人',pubDate:'2026-11-18',cover:image.src,body:'## 听后感\n\n正文'};
  await assert.rejects(saveManagedContent({kind:'albums',entry},{root,build:async()=>{throw Error('failed')}}));assert.equal((await readDashboard(root)).albums.length,0);assert.equal(await readFile(path.join(root,'dist/index.html'),'utf8'),'old');
  await saveManagedContent({kind:'albums',entry},{root,build});await saveManagedContent({kind:'albums',entry:{id:entry.id,changes:{title:'新名称'}}},{root,build});
  let album=(await readDashboard(root)).albums[0];assert.equal(album.id,'album-test');assert.equal(album.title,'新名称');assert.equal(album.pubDate,'2026-11-18');assert(album.body.includes('听后感'));
  await saveManagedContent({kind:'moments',entry:{id:'moment-test',pubDate:'2026-11-17',body:'',images:[{src:image.src,alt:'说明'}]}},{root,build});assert.equal((await readDashboard(root)).moments.length,1);
  const remove={kind:'albums',entry:{id:entry.id},operation:'remove'};await assert.rejects(saveManagedContent(remove,{root,build:async()=>{throw Error('failed')}}));assert.equal((await readDashboard(root)).albums.length,1);
  await saveManagedContent(remove,{root,build});assert.equal((await readDashboard(root)).albums.length,0);
 }finally{await rm(root,{recursive:true,force:true})}
});

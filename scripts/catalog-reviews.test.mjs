import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,readFile,rm,cp} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {cleanEntry,saveManagedContent,readDashboard} from './content-manager.mjs';

test('书评和影评支持长文，其他简短备注仍有原上限',()=>{
 const note='第一段。\n\n'+ '感受'.repeat(6000);
 for(const kind of ['books','films'])assert.equal(cleanEntry(kind,{title:'记录',status:kind==='books'?'读完':'看过',note}).note,note);
 assert.throws(()=>cleanEntry('accounts',{title:'账号',note}),/太长/);
 assert.throws(()=>cleanEntry('books',{title:'书',status:'读完',note:'字'.repeat(150001)}),/太长/);
});

test('修改、清空及删除感受保留稳定ID与外链，构建失败不丢原稿和预览',async()=>{
 const root=await mkdtemp(path.join(tmpdir(),'jianji-catalog-reviews-'));
 try{
  await mkdir(path.join(root,'src/data'),{recursive:true});await mkdir(path.join(root,'src/content/posts'),{recursive:true});await mkdir(path.join(root,'dist'));
  const catalog={books:[{id:'book-stable',title:'书名',subtitle:'作者',status:'读完',cover:'/book-covers/book.jpg',url:'https://weread.qq.com/web/reader/test',note:'原始感受'}],films:[{id:'film-stable',title:'剧名',group:'电视剧',status:'看过',subtitle:'2023',cover:'/film-posters/film.jpg',url:'https://movie.douban.com/subject/123/',note:''}],works:[],accounts:[]};
  await writeFile(path.join(root,'src/data/catalog.json'),JSON.stringify(catalog));await writeFile(path.join(root,'dist/index.html'),'old');
  await cp(new URL('../src/data/site-text.json',import.meta.url),path.join(root,'src/data/site-text.json'));
  for(const kind of ['pages','music'])await cp(new URL(`../src/content/${kind}`,import.meta.url),path.join(root,'src/content',kind),{recursive:true});
  const build=async out=>{await mkdir(out);await writeFile(path.join(out,'index.html'),'updated')};
  for(const [kind,id] of [['books','book-stable'],['films','film-stable']]){
   const original=(await readDashboard(root))[kind][0],before=await readFile(path.join(root,'src/data/catalog.json'),'utf8');
   const patch={kind,entry:{id,changes:{title:'改名后',note:'段落一。\n\n段落二。\n'+ '长感受'.repeat(5000)}}};
   await assert.rejects(saveManagedContent(patch,{root,build:async()=>{throw Error('failed')}}));assert.equal(await readFile(path.join(root,'src/data/catalog.json'),'utf8'),before);
   await saveManagedContent(patch,{root,build});let entry=(await readDashboard(root))[kind][0];assert.equal(entry.id,id);assert.equal(entry.url,original.url);assert.equal(entry.cover,original.cover);assert.equal(entry.note,patch.entry.changes.note);
   const current=await readFile(path.join(root,'src/data/catalog.json'),'utf8'),preview=await readFile(path.join(root,'dist/index.html'),'utf8');
   await assert.rejects(saveManagedContent({kind,entry:{id},operation:'remove'},{root,build:async()=>{throw Error('failed')}}));assert.equal(await readFile(path.join(root,'src/data/catalog.json'),'utf8'),current);assert.equal(await readFile(path.join(root,'dist/index.html'),'utf8'),preview);
   await saveManagedContent({kind,entry:{id,changes:{note:''}}},{root,build});assert.equal((await readDashboard(root))[kind][0].note,'');
   await saveManagedContent({kind,entry:{id},operation:'remove'},{root,build});assert.equal((await readDashboard(root))[kind].length,0);
  }
 }finally{await rm(root,{recursive:true,force:true})}
});

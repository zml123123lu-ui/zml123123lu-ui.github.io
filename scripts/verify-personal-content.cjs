const assert=require('node:assert/strict'),fs=require('node:fs/promises'),path=require('node:path');
const{chromium,webkit}=require('/Users/lu/.workbuddy/binaries/node/workspace/node_modules/playwright-core');
const base=process.argv[2]||'http://127.0.0.1:4322';
(async()=>{
const out=path.join(__dirname,'../design/shots/personal-content-2026-11-18');await fs.mkdir(out,{recursive:true});
if(!process.argv.includes('--editor-only'))for(const[name,engine,options,widths]of[['chrome',chromium,{executablePath:'/Users/lu/.agent-browser/browsers/chrome-153.0.8010.36/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing'},[1440,768,390,320]],['webkit',webkit,{},[390]]]){
 const browser=await engine.launch(options);try{for(const width of widths)for(const colorScheme of['light','dark']){
  const p=await browser.newPage({viewport:{width,height:1000},colorScheme}),errors=[];p.on('pageerror',e=>errors.push(e.message));
  for(const route of ['/music/','/music/albums/test-album-0/','/moments/','/archive/','/posts/','/shelf/','/shelf/all/','/films/','/works/','/accounts/','/about/']){
   assert.equal((await p.goto(base+route)).status(),200,route);await p.evaluate(()=>document.fonts.ready);assert(!await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth),route+' overflow');
   if(route==='/music/'){
    const stacks=p.locator('.music-stack');assert.equal(await stacks.count(),1);assert.equal(await stacks.locator('.album-slot').count(),106);assert.equal(await p.locator('.album-list .pl').count(),3);assert.equal(await p.locator('#albums .music-stack,#albums .record-disc').count(),0);
    assert((await stacks.locator('.stack-counter').innerText()).startsWith('02'));await stacks.locator('.stack-stage').focus();await p.keyboard.press('ArrowRight');await p.waitForFunction(()=>document.querySelector('.stack-counter').textContent.startsWith('03'));
    const stage=await stacks.locator('.stack-stage').boundingBox();await p.mouse.move(stage.x+stage.width*.6,stage.y+stage.height*.5);await p.mouse.down();await p.mouse.move(stage.x+stage.width*.3,stage.y+stage.height*.5,{steps:10});await p.mouse.up();assert.equal(new URL(p.url()).pathname,'/music/');
   }
   if(route==='/moments/'){
    assert.equal(await p.locator('.moment').count(),2);assert.equal(await p.locator('.photos.single').count(),1);await p.locator('.photo img').evaluateAll(es=>Promise.all(es.map(e=>e.decode())));
    await p.locator('.photo').first().click();assert(await p.locator('.lightbox').evaluate(e=>e.open));await p.keyboard.press('ArrowRight');assert.equal(await p.locator('.lightbox .position').innerText(),'2 / 3');await p.keyboard.press('Escape');assert(!await p.locator('.lightbox').evaluate(e=>e.open));assert(await p.locator('.photo').first().evaluate(e=>e===document.activeElement));
   }
   if(route==='/archive/'){assert.equal(await p.locator('.timeline-entry').count(),35);assert.equal(await p.locator('.timeline-entry .g').count(),0);const dates=await p.locator('.timeline time').evaluateAll(es=>es.map(e=>e.dateTime));assert.deepEqual(dates,[...dates].sort().reverse());assert(await p.locator('.month').count()>0)}
   if(route==='/music/albums/test-album-0/'){assert((await p.locator('.prose').innerText()).includes('专辑验收独有词'));assert.equal(await p.locator('a[href="/music/#albums"]').count(),2);await p.locator('.album-heading img').evaluate(e=>e.decode())}
   if(width===1440||width===390)if(['/music/','/moments/','/archive/','/music/albums/test-album-0/'].includes(route))await p.screenshot({path:path.join(out,`${name}-${width}-${colorScheme}-${route.split('/').filter(Boolean).join('-')}.png`)});
  }
  assert.equal(await p.locator('.tbnav a[href="/moments/"]').count(),1);assert.deepEqual(errors,[]);await p.close();console.log(JSON.stringify({name,width,colorScheme,distinctAlbumsAndTracks:true,timeline:35,photos:true,overflow:false}));
 }}finally{await browser.close()}
}
const browser=await chromium.launch({executablePath:'/Users/lu/.agent-browser/browsers/chrome-153.0.8010.36/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing'});
try{
 const p=await browser.newPage();await p.goto(base+'/search/');const results=await p.evaluate(async()=>{const pf=await import('/pagefind/pagefind.js');const find=async q=>Promise.all((await pf.search(q)).results.map(async r=>(await r.data()).url));return {albums:await find('测试感受'),moments:await find('临时'),photo:await Promise.all((await pf.search('临时')).results.map(async r=>{const d=await r.data();return d.url.includes('/moments/')?d.content:''}))}});
 assert(results.albums.some(u=>u.includes('/music/albums/')));assert(results.moments.some(u=>u.includes('/moments/')));assert(!results.photo.some(content=>content.includes('2026.11.17')));
 await p.goto(base+'/manage/');await p.waitForSelector('#manager-app:not([hidden])');
 await p.locator('[data-kind="albums"]').click();await p.locator('#entry-list [data-id="test-album-0"]').click();await p.locator('[name="title"]').fill('改名后的测试专辑');await p.getByRole('button',{name:'保存并更新页面',exact:true}).click();await p.waitForFunction(()=>document.querySelector('#manager-status').textContent.includes('尚未上线'),null,{timeout:120000});assert((await p.locator('#manager-status').innerText()).includes('已保存'));assert.equal(await p.locator('#preview-entry').getAttribute('href'),'/music/albums/test-album-0/');
 await p.locator('[data-kind="moments"]').click();await p.locator('#entry-list [data-id="test-text"]').click();assert(await p.getByRole('button',{name:'上移',exact:true}).first().isDisabled());await p.getByRole('button',{name:'下移',exact:true}).first().click();await p.getByRole('textbox',{name:'照片 1 的描述'}).fill('排序后首张说明');
 await p.locator('input[type=file]').setInputFiles({name:'bad.png',mimeType:'image/png',buffer:Buffer.from('not an image')});await p.waitForFunction(()=>document.querySelector('#manager-status').textContent.includes('无法读取图片'));
 const sharp=require('sharp');const bytes=await sharp({create:{width:40,height:30,channels:3,background:'#333'}}).png().toBuffer();await p.locator('input[type=file]').setInputFiles({name:'test.png',mimeType:'image/png',buffer:bytes});await p.waitForFunction(()=>document.querySelector('#manager-status').textContent.includes('照片已处理'));
 assert.equal(await p.locator('.media-row').count(),4);await p.getByRole('button',{name:'移除',exact:true}).last().click();assert.equal(await p.locator('.media-row').count(),3);
 await p.getByRole('button',{name:'保存并更新页面',exact:true}).click();await p.waitForFunction(()=>document.querySelector('#manager-status').textContent.includes('已保存到本机预览'),null,{timeout:120000});assert(await p.getByRole('button',{name:'上移',exact:true}).first().isDisabled());
 const token=await p.evaluate(async()=>await(await fetch('/api/music/status')).json());const data=await p.evaluate(async token=>await(await fetch('/api/content',{headers:{'X-Music-Token':token}})).json(),token.token);assert.equal(data.moments.find(m=>m.id==='test-text').images[0].alt,'排序后首张说明');
 p.once('dialog',d=>d.accept());await p.getByRole('button',{name:'删除记录',exact:true}).click();await p.waitForFunction(()=>document.querySelector('#manager-status').textContent.includes('已从本机删除'),null,{timeout:120000});assert.equal(await p.locator('#entry-list [data-id="test-text"]').count(),0);
 const denied=await p.request.post(base+'/api/content/upload',{data:{data:'bad'}});assert.equal(denied.status(),403);
 console.log(JSON.stringify({search:true,editorSave:true,stableUrl:true,uploadError:true,upload:true,reorder:true,delete:true,unauthorizedUpload:403}));
}finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});

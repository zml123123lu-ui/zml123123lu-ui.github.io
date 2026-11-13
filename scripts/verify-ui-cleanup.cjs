const assert=require('node:assert/strict'),fs=require('node:fs/promises'),path=require('node:path');
const{chromium,webkit}=require('/Users/lu/.workbuddy/binaries/node/workspace/node_modules/playwright-core');
const root=path.join(__dirname,'..'),base=process.argv[2]||'http://127.0.0.1:4321',live=new URL(base).hostname.endsWith('github.io');
const routes=['/','/posts/','/shelf/','/shelf/all/','/films/','/music/','/works/','/works/vibe-coding/','/accounts/','/about/','/tags/','/tags/'+encodeURIComponent('开发')+'/','/archive/','/search/'];
(async()=>{
for(const folder of['src/content','src/data']){async function walk(dir){for(const item of await fs.readdir(path.join(root,dir),{withFileTypes:true})){const name=path.join(dir,item.name);if(item.isDirectory())await walk(name);else assert.deepEqual(await fs.readFile(path.join(root,name)),await fs.readFile(path.join(root,'.publish/github-source',name)),'内容数据不应变化 '+name)}}await walk(folder)}
const out=path.join(root,'design/shots/ui-cleanup/'+(live?'live':'after'));await fs.mkdir(out,{recursive:true});
for(const[name,engine,options,widths]of[['chrome',chromium,{executablePath:'/Users/lu/.agent-browser/browsers/chrome-153.0.8010.36/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing'},[1440,390,320]],['webkit',webkit,{},[390]]]){
 const browser=await engine.launch({...options,...(live?{proxy:{server:'http://127.0.0.1:7897'}}:{})});try{for(const width of widths)for(const colorScheme of['light','dark']){
  const p=await browser.newPage({viewport:{width,height:1000},colorScheme}),errors=[];p.on('pageerror',e=>errors.push(e.message));p.on('console',m=>{if(m.type()==='error'&&m.text().includes('Refused to apply style'))errors.push(m.text())});
  for(const route of routes){
   const response=await p.goto(base+route,{waitUntil:'domcontentloaded'});assert.equal(response.status(),200,route);await p.evaluate(()=>document.fonts.ready);if(live)assert.equal(await p.locator('#page-editor').isVisible(),false,'公开页隐藏编辑工具');
   assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,route+' 横向溢出');
   if(route!=='/'){
    assert.equal((await p.locator('.crumb').innerText()).trim(),'见己');assert.equal(await p.locator('.topbar a[href="/search/"]').count(),1);
    const foot=await p.locator('.foot').innerText();assert(!foot.includes('用 Astro 搭的')&&!foot.includes('自托管字体'));
    for(const href of['/posts/','/shelf/','/works/','/accounts/','/tags/','/archive/','/about/','/search/','/rss.xml'])assert.equal(await p.locator(`.foot a[href="${href}"]`).count(),1,'页脚保留导航 '+href);
   }
   if(route==='/posts/') {await p.waitForSelector('.deck-ready');assert.equal(await p.locator('.article-row').count(),35);assert.equal(await p.locator('.edition,.article-count,.directory-heading').count(),0);await p.getByRole('button',{name:'下一篇'}).click();await p.waitForFunction(()=>document.querySelector('.deck-position').textContent.startsWith('02'))}
   if(route==='/films/') {assert.equal(await p.locator('.film-section').count(),3);assert.equal(await p.locator('.films .entry').count(),11);assert.deepEqual(await p.locator('.group-heading h2').allTextContents(),['我最爱的电影','我最爱的电视剧','我最爱的番']);assert.equal(await p.locator('.reel-toolbar').count(),0);assert.equal(await p.locator('.poster-object').first().evaluate(e=>e.offsetWidth),width>1050?184:width>600?168:width>350?116:100)}
   if(['/shelf/','/shelf/all/','/films/','/about/'].includes(route))await p.locator('main img').evaluateAll(es=>Promise.all(es.map(async e=>{e.loading='eager';await e.decode()})));
   if(route==='/shelf/')assert.equal(await p.locator('.orbit-book').count(),9);
   if(route==='/shelf/all/')assert.equal(await p.locator('.books .entry').count(),9);
   if(route==='/music/') {assert.equal(await p.locator('.album-slot').count(),106);assert.equal(await p.locator('.stack-heading,.kick').count(),0);await p.locator('.stack-stage').focus();await p.keyboard.press('ArrowRight');await p.waitForFunction(()=>document.querySelector('.stack-counter').textContent.startsWith('03'))}
   if(route==='/tags/')assert.equal(await p.locator('.cat.empty').count(),0);
   if(route==='/tags/'+encodeURIComponent('开发')+'/')assert.equal(await p.locator('.others').count(),0);
   if(route==='/about/')assert.equal(await p.locator('.facts').count(),0);
   if(colorScheme==='light'&&width!==320)await p.screenshot({path:path.join(out,`${name}-${width}-${route==='/'?'home':encodeURIComponent(route).replaceAll('%2F','')}.png`)});
  }
  await p.locator('.topbar a[href="/search/"]').focus();await Promise.all([p.waitForNavigation({waitUntil:'domcontentloaded'}),p.keyboard.press('Enter')]);assert(new URL(p.url()).pathname==='/search/');
  const urls=await p.evaluate(async()=>{const pf=await import('/pagefind/pagefind.js');return Promise.all((await pf.search('实物演示')).results.map(async r=>(await r.data()).url))});assert(urls.some(u=>u.includes('2026-11-11-dev-00db5a0cdf')));
  await p.goto(base+'/works/');const link=p.locator('.foot a[href="/accounts/"]');await link.focus();await p.keyboard.press('Enter');await p.waitForURL('**/accounts/');
  assert.deepEqual(errors,[]);await p.close();console.log(JSON.stringify({name,width,colorScheme,routes:routes.length,contentUnchanged:true,navigation:true,interactions:true}));
 }}finally{await browser.close()}
}
})().catch(e=>{console.error(e);process.exitCode=1});

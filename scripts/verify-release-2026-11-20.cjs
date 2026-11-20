const assert=require('node:assert/strict'),fs=require('node:fs/promises'),path=require('node:path');
const{chromium,webkit}=require('/Users/lu/.workbuddy/binaries/node/workspace/node_modules/playwright-core');
const base=(process.argv[2]||'http://127.0.0.1:4321').replace(/\/$/,''),live=new URL(base).hostname.endsWith('github.io');
(async()=>{const out=path.join(__dirname,'../design/shots/release-2026-11-20'+(live?'-live':''));await fs.mkdir(out,{recursive:true});
for(const[name,engine,options,widths]of[['chrome',chromium,{executablePath:'/Users/lu/.agent-browser/browsers/chrome-153.0.8010.36/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing'},[1440,768,390,320]],['webkit',webkit,{},[390]]]){
 const b=await engine.launch({...options,...(live?{proxy:{server:'http://127.0.0.1:7897'}}:{})});try{for(const width of widths)for(const colorScheme of['light','dark']){
 const p=await b.newPage({viewport:{width,height:1000},colorScheme}),errors=[];p.on('pageerror',e=>errors.push(e.message));
 for(const route of ['/','/posts/','/archive/','/music/','/music/albums/netease-159294273/','/shelf/','/shelf/all/','/films/','/works/','/accounts/','/about/','/tags/','/search/']){
  assert.equal((await p.goto(base+route)).status(),200,route);await p.evaluate(()=>document.fonts.ready);assert(!await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth),route+' overflow');if(live)assert(!await p.locator('#page-editor').isVisible());assert.equal(await p.locator('.topbar a[href="/moments/"],.foot a[href="/moments/"]').count(),0);
  if(route==='/archive/') {assert.equal(await p.locator('.timeline-entry').count(),35);const dates=await p.locator('.timeline time').evaluateAll(es=>es.map(e=>e.dateTime));assert.deepEqual(dates,[...dates].sort().reverse());if(width>700)assert(await p.locator('.timeline').evaluate(e=>{const r=e.getBoundingClientRect();return Math.abs(r.left+parseFloat(getComputedStyle(e,'::before').left)-innerWidth/2)<1}));}
  if(route==='/posts/') {assert.equal(await p.locator('.article-row').count(),35);assert.equal(await p.locator('.tools a[href="/archive/"]').innerText(),'全部文章 ↗');await p.getByRole('button',{name:'下一篇',exact:true}).click();await p.waitForFunction(()=>document.querySelector('.deck-position').textContent.startsWith('02'));}
  if(route==='/music/'){assert.equal(await p.locator('.music-stack').count(),1);assert.equal(await p.locator('.album-slot').count(),106);assert.deepEqual(await p.locator('.sec .shd h2').allTextContents(),['单曲','专辑单']);assert.equal(await p.locator('.album-list .pl').count(),1);await p.locator('.album-list img').evaluate(e=>e.decode());await p.locator('.stack-stage').focus();await p.keyboard.press('ArrowRight');await p.waitForFunction(()=>document.querySelector('.stack-counter').textContent.startsWith('03'));if(live)assert(!await p.locator('.music-import').isVisible());}
  if(route==='/music/albums/netease-159294273/'){assert.equal(await p.locator('h1').innerText(),'My 21st Century Blues');assert.equal(await p.locator('.artist').innerText(),'RAYE');await p.locator('.album-heading img').evaluate(e=>e.decode());assert.equal(await p.locator('.return').getAttribute('href'),'/music/#albums');}
  if(['/shelf/','/shelf/all/','/films/','/about/'].includes(route))await p.locator('main img').evaluateAll(es=>Promise.all(es.map(async e=>{e.loading='eager';await e.decode()})));
  if(route==='/films/')assert.equal(await p.locator('.film-reel').count(),3);
  if(route==='/shelf/')assert.equal(await p.locator('.orbit-book').count(),9);
  if(route==='/shelf/all/')assert.equal(await p.locator('.books .entry').count(),9);
  if([1440,390].includes(width)&&['/archive/','/music/','/music/albums/netease-159294273/'].includes(route))await p.screenshot({path:path.join(out,`${name}-${width}-${colorScheme}-${route.split('/').filter(Boolean).join('-')}.png`)});
 }
 const urls=await p.evaluate(async()=>{const pf=await import('/pagefind/pagefind.js');return Promise.all((await pf.search('RAYE')).results.map(async r=>(await r.data()).url))});assert(urls.some(u=>u.includes('/music/albums/netease-159294273/')));await p.goto(base+'/music/');await p.locator('.album-list .art').click();await p.waitForURL('**/netease-159294273/');await p.locator('.return').click();await p.waitForURL('**/music/#albums');assert.deepEqual(errors,[]);console.log(JSON.stringify({name,width,colorScheme,routes:13,timeline:35,tracks:106,albums:1,search:true,links:true,publicEditorHidden:live}));await p.close();
 }}finally{await b.close()}
}
})().catch(e=>{console.error(e);process.exitCode=1});

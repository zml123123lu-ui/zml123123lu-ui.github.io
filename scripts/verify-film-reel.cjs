const assert=require('node:assert/strict'),fs=require('node:fs/promises'),path=require('node:path');
const{chromium,webkit}=require('/Users/lu/.workbuddy/binaries/node/workspace/node_modules/playwright-core');
(async()=>{const output=path.join(__dirname,'../design/shots/film-reel');await fs.mkdir(output,{recursive:true});
for(const[name,engine,options,widths]of[['chrome',chromium,{executablePath:'/Users/lu/.agent-browser/browsers/chrome-153.0.8010.36/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing'},[1440,768,390,320]],['webkit',webkit,{},[390]]]){
const browser=await engine.launch(options);try{for(const width of widths)for(const colorScheme of['light','dark']){
const p=await browser.newPage({viewport:{width,height:1000},colorScheme,reducedMotion:'no-preference'}),errors=[];p.on('pageerror',e=>errors.push(e.message));await p.goto('http://127.0.0.1:4321/films/');await p.evaluate(()=>document.fonts.ready);
assert.deepEqual(await p.locator('.poster-object').first().evaluate(e=>({w:e.offsetWidth,h:e.offsetHeight})),width>1050?{w:184,h:268}:width>600?{w:168,h:246}:width>350?{w:116,h:174}:{w:100,h:154},'样式必须成功加载，海报不能退回原图尺寸');
assert.equal(await p.locator('.film-section').count(),3);assert.equal(await p.locator('.films .entry').count(),11);assert.equal(await p.locator('.status').count(),0);
assert.deepEqual(await p.locator('.back-sign').allTextContents(),[...Array(4).fill('JIANJI / CINEMA'),...Array(5).fill('JIANJI / TV SERIES'),...Array(2).fill('JIANJI / ANIME')]);
await p.locator('.films img').evaluateAll(es=>Promise.all(es.map(async e=>{e.loading='eager';await e.decode()})));
const reel=p.locator('.film-reel').first(),card=reel.locator('.poster-object').first();await reel.scrollIntoViewIfNeeded();await p.mouse.move(0,0);await p.waitForTimeout(100);
const read=()=>card.evaluate(e=>({transform:getComputedStyle(e).transform,time:e.getAnimations()[0].currentTime,state:e.getAnimations()[0].playState}));
const a=await read();await p.waitForTimeout(450);const b=await read();assert.notEqual(a.transform,b.transform,'自动3D转动');
await reel.locator('.reel-toggle').click();await p.mouse.move(0,0);const paused=await read();await p.waitForTimeout(180);assert.equal((await read()).time,paused.time,'暂停后停稳');
await p.screenshot({path:path.join(output,`${name}-${width}-${colorScheme}.png`)});
await reel.locator('.reel-toggle').click();await p.mouse.move(0,0);const entry=reel.locator('.entry').first();const rect=await entry.boundingBox();await p.mouse.move(rect.x+rect.width/2,rect.y+rect.height/2);await p.waitForTimeout(100);assert.equal((await read()).state,'paused','悬停暂停');
await p.mouse.move(0,0);await entry.focus();await p.waitForTimeout(100);assert.equal((await read()).state,'paused','键盘焦点暂停');
await p.evaluate(()=>document.activeElement.blur());await p.mouse.move(0,0);await p.waitForTimeout(100);assert.equal((await read()).state,'running');
await p.locator('.foot').scrollIntoViewIfNeeded();await p.waitForTimeout(100);assert.equal((await read()).state,'paused','分组离屏暂停');
assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);assert.deepEqual(errors,[]);await p.close();console.log(JSON.stringify({name,width,colorScheme,posters:11,motion:true,pause:true}));
}
const p=await browser.newPage({viewport:{width:390,height:1000},reducedMotion:'reduce'});await p.goto('http://127.0.0.1:4321/films/');const button=p.locator('.reel-toggle').first();assert.equal(await button.textContent(),'暂停动画');await p.mouse.move(0,0);await p.waitForTimeout(150);const readTime=()=>p.locator('.poster-object').first().evaluate(e=>e.getAnimations()[0].currentTime);const before=await readTime();await p.waitForTimeout(250);assert((await readTime())>before,'减少动态设置下也按用户要求自动播放');await button.click();await p.mouse.move(0,0);const paused=await readTime();await p.emulateMedia({reducedMotion:'no-preference'});await p.waitForTimeout(150);assert.equal(await readTime(),paused,'系统设置变化不取消手动暂停');await button.click();await p.mouse.move(0,0);await p.waitForTimeout(100);assert.equal(await p.locator('.poster-object').first().evaluate(e=>e.getAnimations()[0].playState),'running');await p.close();
const nojs=await browser.newPage({javaScriptEnabled:false});await nojs.goto('http://127.0.0.1:4321/films/');assert.equal(await nojs.locator('.films .entry').count(),11);assert.equal(await nojs.locator('.reel-toggle:visible').count(),0);await nojs.close();
}finally{await browser.close()}}
})().catch(e=>{console.error(e);process.exitCode=1});

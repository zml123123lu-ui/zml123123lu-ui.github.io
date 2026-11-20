const assert=require('node:assert/strict'),fs=require('node:fs/promises'),path=require('node:path');
const {chromium,webkit}=require('/Users/lu/.workbuddy/binaries/node/workspace/node_modules/playwright-core');
(async()=>{const output=path.join(__dirname,'../design/shots/centered-timeline-2026-11-18');await fs.mkdir(output,{recursive:true});
for(const[name,engine,options,widths]of[['chrome',chromium,{executablePath:'/Users/lu/.agent-browser/browsers/chrome-153.0.8010.36/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing'},[1440,1024,768,390,320]],['webkit',webkit,{},[1440,390]]]){
 const browser=await engine.launch(options);try{for(const width of widths)for(const colorScheme of['light','dark']){
  const p=await browser.newPage({viewport:{width,height:1000},colorScheme});assert.equal((await p.goto('http://127.0.0.1:4321/archive/')).status(),200);await p.evaluate(()=>document.fonts.ready);
  assert.equal(await p.locator('.timeline-entry').count(),35);assert(!await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth));
  const result=await p.locator('.timeline').evaluate(root=>{const box=root.getBoundingClientRect(),style=getComputedStyle(root,'::before');const entries=[...root.querySelectorAll('li')].map(e=>{const a=e.querySelector('a').getBoundingClientRect(),text=e.querySelector('.text').getBoundingClientRect();return{right:e.classList.contains('right'),a:{left:a.left,right:a.right,top:a.top,bottom:a.bottom},text:{left:text.left,right:text.right,top:text.top,bottom:text.bottom},date:e.querySelector('time').dateTime,href:e.querySelector('a').getAttribute('href')}});return{center:box.x+box.width/2,line:box.x+parseFloat(style.left),width:innerWidth,entries}});
  assert.deepEqual(result.entries.map(e=>e.date),result.entries.map(e=>e.date).sort().reverse());
  if(width>700){assert(Math.abs(result.center-width/2)<1);assert(Math.abs(result.line-width/2)<1);for(const e of result.entries){if(e.right)assert(e.text.left>result.center+30);else assert(e.text.right<result.center-30)}for(const side of[false,true]){const group=result.entries.filter(e=>e.right===side);for(let i=1;i<group.length;i++)assert(group[i].text.top>=group[i-1].text.bottom,'同侧文章不能重叠')}}else{for(const e of result.entries)assert(e.text.left>=32&&e.text.right<=width-16)}
  await p.screenshot({path:path.join(output,`${name}-${width}-${colorScheme}.png`)});const first=p.locator('.timeline-entry').first();await first.focus();assert(await first.evaluate(e=>e.matches(':focus-visible')));await Promise.all([p.waitForNavigation(),p.keyboard.press('Enter')]);assert(new URL(p.url()).pathname.startsWith('/posts/'));
  console.log(JSON.stringify({name,width,colorScheme,count:35,centered:width>700,alternating:width>700,overflow:false}));await p.close();
 }}finally{await browser.close()}
}
})().catch(e=>{console.error(e);process.exitCode=1});

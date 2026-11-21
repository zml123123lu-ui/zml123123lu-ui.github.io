const assert=require('node:assert/strict'),fs=require('node:fs/promises'),path=require('node:path'),yaml=require('js-yaml');
const {chromium,webkit}=require('/Users/lu/.workbuddy/binaries/node/workspace/node_modules/playwright-core');
const base=(process.argv[2]||'http://127.0.0.1:4321').replace(/\/$/,''),live=new URL(base).hostname.endsWith('github.io');
(async()=>{
 const expected=new Map(),categories=new Map();
 for(const name of await fs.readdir(path.join(__dirname,'../src/content/posts'))){
  if(!name.endsWith('.md'))continue;
  const source=await fs.readFile(path.join(__dirname,'../src/content/posts',name),'utf8'),data=yaml.load(source.match(/^---\r?\n([\s\S]*?)\r?\n---/)[1]);
  if(data.draft===true)continue;
  categories.set(data.category,(categories.get(data.category)||0)+1);
  for(const tag of data.tags||[])expected.set(tag,(expected.get(tag)||0)+1);
 }
 for(const [name,count]of categories)expected.set(name,count);
 const shots=path.join(__dirname,'../design/shots/tag-bubbles-2026-11-21'+(live?'-live':''));await fs.mkdir(shots,{recursive:true});
 const results=[];
 for(const [name,engine,options,widths]of [['chrome',chromium,{executablePath:'/Users/lu/.agent-browser/browsers/chrome-153.0.8010.36/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing'},[1440,768,390,320]],['webkit',webkit,{},[390]]]){
  const browser=await engine.launch({...options,...(live?{proxy:{server:'http://127.0.0.1:7897'}}:{})});
  try{
   for(const width of widths)for(const colorScheme of ['light','dark']){
    const p=await browser.newPage({viewport:{width,height:1000},colorScheme}),errors=[];p.on('pageerror',e=>errors.push(e.message));
    await p.goto(base+'/tags/',{waitUntil:'networkidle'});await p.locator('.bubble-field.is-arranged').waitFor();if(live)assert(!await p.locator('#page-editor').isVisible());
    const links=p.locator('.tag-bubble');assert.equal(await links.count(),expected.size);
    const topics=await links.evaluateAll(es=>es.map(e=>({name:e.querySelector('.name').textContent,count:parseInt(e.querySelector('.count').textContent),href:e.getAttribute('href'),label:e.getAttribute('aria-label'),circle:getComputedStyle(e).borderRadius})));
    assert.equal(new Set(topics.map(t=>t.name)).size,expected.size);
    for(const t of topics){assert.equal(t.count,expected.get(t.name));assert.equal(t.href,`/tags/${encodeURIComponent(t.name)}/`);assert(t.label.includes(t.name));assert.equal(t.circle,'50%')}
    assert(!await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth));
    const cloud=await p.locator('.bubble-slot').evaluateAll(es=>{const rs=es.map(e=>e.getBoundingClientRect());return{ratio:Math.max(...rs.map(r=>r.width))/Math.min(...rs.map(r=>r.width)),verticalBands:new Set(rs.map(r=>Math.round((r.y+r.height/2)/20))).size}});assert(cloud.ratio>=(width<=700?1.6:2),`sizes too similar: ${JSON.stringify(cloud)}`);assert(cloud.verticalBands>=12,`layout looks like rows: ${JSON.stringify(cloud)}`);

    const depth=await p.locator('.bubble-slot').evaluateAll(es=>({planes:[...new Set(es.map(e=>Number(e.dataset.depth)))].sort((a,b)=>a-b),perspective:es.every(e=>getComputedStyle(e).perspective==='900px'),shadows:es.every(e=>getComputedStyle(e.querySelector('.tag-bubble')).boxShadow.includes('px')),sharpLabels:es.every(e=>getComputedStyle(e.querySelector('.name')).filter==='none')}));assert.deepEqual(depth.planes,[-100,0,80]);assert(depth.perspective&&depth.shadows&&depth.sharpLabels);
    const fieldHeight=await p.locator('.bubble-field').evaluate(e=>e.clientHeight),beforeHeight=({1440:1043,768:1842,390:1917,320:3025})[width];assert(fieldHeight<beforeHeight*.85,`cloud not compact enough: ${fieldHeight}/${beforeHeight}`);
    if(name==='chrome'&&width===1440&&colorScheme==='light'){
     const fieldBox=await p.locator('.bubble-field').boundingBox();
     await p.mouse.move(fieldBox.x+8,fieldBox.y+8);await p.waitForFunction(()=>new DOMMatrix(getComputedStyle(document.querySelector('[data-depth="80"]')).transform).m41< -7);
     await p.mouse.move(fieldBox.x+fieldBox.width-8,fieldBox.y+8);await p.waitForFunction(()=>new DOMMatrix(getComputedStyle(document.querySelector('[data-depth="80"]')).transform).m41>7&&new DOMMatrix(getComputedStyle(document.querySelector('[data-depth="-100"]')).transform).m41<-.8);
     await p.mouse.move(0,0);await p.waitForFunction(()=>Math.abs(new DOMMatrix(getComputedStyle(document.querySelector('[data-depth="80"]')).transform).m41)<.1);
    }
    const start=await links.first().evaluate(e=>({time:e.getAnimations()[0].currentTime,transform:getComputedStyle(e).transform}));
    await p.waitForFunction(start=>{const e=document.querySelector('.tag-bubble'),a=e.getAnimations()[0];return a.currentTime>start.time+200&&getComputedStyle(e).transform!==start.transform},start);
    const toggle=p.locator('.motion-toggle');await toggle.click();assert.equal(await toggle.getAttribute('aria-pressed'),'true');assert(await links.evaluateAll(es=>es.every(e=>getComputedStyle(e).animationPlayState==='paused')));
    assert.equal(await links.first().evaluate(e=>getComputedStyle(e).backgroundColor),'rgba(0, 0, 0, 0)');
    const motion=await links.first().evaluate(e=>{
     const animations=e.getAnimations();const periods=animations.map(a=>Number(a.effect.getTiming().duration));
     const points=[];for(const time of [1000,2500,4000,5500]){animations.forEach(a=>a.currentTime=time);const r=e.getBoundingClientRect();points.push({x:r.x,y:r.y})}
     const a=points[0],b=points[1];const curvature=Math.max(...points.slice(2).map(c=>Math.abs((b.x-a.x)*(c.y-a.y)-(b.y-a.y)*(c.x-a.x))));
     return{axes:animations.length,periods,curvature,travel:Math.max(...points.map(p=>Math.hypot(p.x-a.x,p.y-a.y)))};
    });assert.equal(motion.axes,2);assert.notEqual(motion.periods[0],motion.periods[1]);assert(motion.curvature>5,`path is too straight: ${JSON.stringify(motion)}`);assert(motion.travel>12,`floating travel too small: ${motion.travel}`);
    let smallestGap=Infinity;
    for(const time of Array.from({length:25},(_,i)=>i*2500)){
     await links.evaluateAll((es,time)=>es.forEach(e=>e.getAnimations().forEach(a=>a.currentTime=time)),time);await p.evaluate(()=>new Promise(requestAnimationFrame));
     const circles=await links.evaluateAll(es=>es.map(e=>{const r=e.getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2,r:r.width/2,w:r.width,h:r.height,left:r.left,right:r.right}}));
     for(let i=0;i<circles.length;i++){const a=circles[i];assert(Math.abs(a.w-a.h)<1);assert(a.left>=0&&a.right<=width);for(let j=i+1;j<circles.length;j++){const b=circles[j],gap=Math.hypot(a.x-b.x,a.y-b.y)-a.r-b.r;smallestGap=Math.min(smallestGap,gap);assert(gap>=-Math.min(a.r,b.r)*.35,`${name} ${width}: bubbles obscure their centers ${i}/${j}: ${gap}`)}}
    }
    await toggle.click();assert.equal(await toggle.getAttribute('aria-pressed'),'false');await links.first().evaluate(e=>e.scrollIntoView({block:'center',behavior:'instant'}));const hoverBox=await links.first().boundingBox();await p.mouse.move(hoverBox.x+hoverBox.width/2,hoverBox.y+hoverBox.height/2);assert.equal(await links.first().evaluate(e=>getComputedStyle(e).animationPlayState),'paused');
    await p.mouse.move(0,0);await toggle.focus();await p.keyboard.press(name==='webkit'?'Alt+Tab':'Tab');assert(await links.first().evaluate(e=>e.matches(':focus-visible')));assert.equal(await links.first().evaluate(e=>getComputedStyle(e).animationPlayState),'paused');
    await toggle.focus();await p.evaluate(()=>scrollTo({top:0,behavior:'instant'}));await p.evaluate(()=>new Promise(requestAnimationFrame));await p.screenshot({path:path.join(shots,`${name}-${width}-${colorScheme}.png`),fullPage:true});
    if(name==='chrome'&&width===1440&&colorScheme==='light'){
     for(const t of topics)assert.equal((await p.request.get(base+t.href)).status(),200,t.href);
     await p.locator('.bubble-field').evaluate(e=>e.style.marginTop='2000px');await p.waitForFunction(()=>document.querySelector('.bubble-field').dataset.running==='false');
     await p.locator('.bubble-field').evaluate(e=>e.style.removeProperty('margin-top'));await p.waitForFunction(()=>document.querySelector('.bubble-field').dataset.running==='true');
     await p.setViewportSize({width:390,height:1000});await p.waitForFunction(()=>document.documentElement.scrollWidth<=innerWidth);assert(!await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth));
    }
    const href=await links.first().getAttribute('href');await links.first().focus();await Promise.all([p.waitForNavigation({waitUntil:'domcontentloaded'}),p.keyboard.press('Enter')]);assert.equal(decodeURIComponent(new URL(p.url()).pathname),decodeURIComponent(href));assert.deepEqual(errors,[]);
    results.push({name,width,colorScheme,tags:topics.length,moving:true,pause:true,hoverAndFocus:true,transparentCenter:true,cloud,depth,fieldHeight,beforeHeight,motion,minGap:smallestGap,noOverflow:true,keyboardLink:true});await p.close();
   }
   const reduced=await browser.newPage({viewport:{width:390,height:1000},reducedMotion:'reduce'});await reduced.goto(base+'/tags/');await reduced.locator('.is-arranged').waitFor();assert(await reduced.locator('.tag-bubble').evaluateAll(es=>es.every(e=>e.getAnimations().some(a=>a.playState==='running'))));assert(await reduced.locator('.motion-toggle').isVisible());await reduced.locator('.motion-toggle').click();assert(await reduced.locator('.tag-bubble').evaluateAll(es=>es.every(e=>getComputedStyle(e).animationPlayState==='paused')));await reduced.close();
   const plain=await browser.newPage({viewport:{width:390,height:1000},javaScriptEnabled:false});await plain.goto(base+'/tags/');assert.equal(await plain.locator('.tag-bubble').count(),expected.size);assert(!await plain.locator('.motion-toggle').isVisible());assert(!await plain.evaluate(()=>document.documentElement.scrollWidth>innerWidth));await plain.locator('.tag-bubble').first().click();assert(decodeURIComponent(new URL(plain.url()).pathname).startsWith('/tags/'));await plain.close();
  }finally{await browser.close()}
 }
 await fs.writeFile(path.join(__dirname,'../design/tag-bubbles-verification-2026-11-21'+(live?'-live':'')+'.json'),JSON.stringify({cases:results,explicitAutoplayWithPause:true,noJavascript:true,tagLinksChecked:expected.size},null,2));console.log(JSON.stringify({cases:results.length,tags:expected.size,explicitAutoplayWithPause:true,noJavascript:true}));
})().catch(e=>{console.error(e);process.exitCode=1});

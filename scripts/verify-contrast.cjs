const assert=require('node:assert/strict'),fs=require('node:fs/promises'),path=require('node:path');
const {chromium,webkit}=require('/Users/lu/.workbuddy/binaries/node/workspace/node_modules/playwright-core');
const base=(process.argv[2]||'http://127.0.0.1:4321').replace(/\/$/,''),live=new URL(base).hostname.endsWith('github.io');
(async()=>{
 const out=path.join(__dirname,'../design/shots/contrast-2026-11-17'+(live?'-live':''));await fs.mkdir(out,{recursive:true});
 for(const[name,engine,options,widths]of[['chrome',chromium,{executablePath:'/Users/lu/.agent-browser/browsers/chrome-153.0.8010.36/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing'},[1440,768,390,320]],['webkit',webkit,{},[390]]]){
  const browser=await engine.launch({...options,...(live?{proxy:{server:'http://127.0.0.1:7897'}}:{})});try{for(const width of widths)for(const colorScheme of['light','dark']){
   const page=await browser.newPage({viewport:{width,height:1000},colorScheme}),errors=[];page.on('pageerror',e=>errors.push(e.message));
   for(const route of['/','/posts/','/shelf/','/shelf/all/','/films/','/music/','/works/','/accounts/','/about/','/tags/','/archive/','/search/']){
    assert.equal((await page.goto(base+route)).status(),200,route);await page.evaluate(()=>document.fonts.ready);if(live)assert(!await page.locator('#page-editor').isVisible(),'public editor hidden');
    assert(!await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),route+' overflow');
    const ratios=await page.evaluate(()=>{
     const css=getComputedStyle(document.documentElement),bg=css.getPropertyValue('--bg').trim();
     const rgb=c=>{const e=document.createElement('span');e.style.color=c;document.body.append(e);const v=getComputedStyle(e).color.match(/[\d.]+/g).map(Number);e.remove();return v};
     const background=rgb(bg),lum=c=>c.slice(0,3).map(v=>v/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4).reduce((a,v,i)=>a+v*[.2126,.7152,.0722][i],0);
     const ratio=c=>{const v=rgb(c),alpha=v[3]??1,front=v.slice(0,3).map((v,i)=>v*alpha+background[i]*(1-alpha)),a=lum(front),b=lum(background);return(Math.max(a,b)+.05)/(Math.min(a,b)+.05)};
     return Object.fromEntries(['--ink','--ink-72','--ink-55','--ink-38'].map(k=>[k,ratio(css.getPropertyValue(k))]));
    });
    assert(ratios['--ink-38']>=4.5,route+' secondary text '+JSON.stringify(ratios));
    if(route!=='/'){
     assert(await page.locator('.tbnav a[aria-current],.shelf-nav a[aria-current]').evaluateAll(es=>es.every(e=>getComputedStyle(e).borderBottomColor===getComputedStyle(e).color)),'active navigation underline');
     const nav=await page.locator('.tbnav').evaluate(e=>({size:parseFloat(getComputedStyle(e).fontSize),font:getComputedStyle(e).fontFamily,color:getComputedStyle(e).color}));assert(nav.size>=14);assert(!nav.font.includes('Mono'));
     assert(await page.locator('.foot .links').evaluate(e=>parseFloat(getComputedStyle(e).fontSize)>=13));
     assert.equal(await page.locator('.tbnav a[aria-current="page"]').count(),route==='/search/'?0:1);
    }
    if(['/posts/','/films/','/'].includes(route)&&[1440,390].includes(width))await page.screenshot({path:path.join(out,`${name}-${width}-${colorScheme}-${route==='/'?'home':route.split('/')[1]}.png`)});
   }
   await page.locator('.pill').focus();assert(await page.locator('.pill').evaluate(e=>e.matches(':focus-visible')));await Promise.all([page.waitForNavigation(),page.keyboard.press('Enter')]);assert(new URL(page.url()).pathname==='/search/');
   assert.deepEqual(errors,[]);console.log(JSON.stringify({name,width,colorScheme,secondaryContrast:'>=4.5',navigation:'14px UI font',footer:'13px',overflow:false}));await page.close();
  }}finally{await browser.close()}
 }
})().catch(e=>{console.error(e);process.exitCode=1});

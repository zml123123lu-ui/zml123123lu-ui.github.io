const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const yaml = require('js-yaml');
const { chromium, webkit } = require('/Users/lu/.workbuddy/binaries/node/workspace/node_modules/playwright-core');
const base = 'http://127.0.0.1:4321';
(async () => {
 const folder = path.join(__dirname, '../src/content/posts');
 const expected = new Map();
 for (const name of await fs.readdir(folder)) {
  if (!name.endsWith('.md')) continue;
  const source = await fs.readFile(path.join(folder, name), 'utf8');
  const data = yaml.load(source.match(/^---\n([\s\S]*?)\n---/)[1]);
  if (!data.draft) expected.set('/posts/' + name.slice(0, -3) + '/', data);
 }
 const output = path.join(__dirname, '../design/shots/writing-paper-turn');
 await fs.mkdir(output, { recursive: true });
 for (const [name, engine, options, widths] of [
  ['chrome', chromium, { executablePath: '/Users/lu/.agent-browser/browsers/chrome-153.0.8010.36/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing' }, [1440, 768, 390, 320]],
  ['webkit', webkit, {}, [1440, 390]],
 ]) {
  const browser = await engine.launch(options);
  try {
   for (const width of widths) for (const colorScheme of ['light', 'dark']) {
    const page = await browser.newPage({ viewport: { width, height: 1000 }, colorScheme, reducedMotion: 'reduce' });
    const errors = []; page.on('pageerror', e => errors.push(e.message));
    await page.goto(base + '/posts/', { waitUntil: 'domcontentloaded' });
    await page.evaluate(() => document.fonts.ready);
    assert.equal(await page.locator('h1').count(), 1);
    assert.equal(await page.locator('.article-row').count(), expected.size);
    assert.equal(await page.locator('.ledger, .rail, .art, img').count(), 0);
    assert.equal(await page.locator('[data-edit-id=posts][data-edit-field=title]').count(), 1);
    const rows = await page.locator('.article-row').all();
    const format = await page.locator('.article-row').evaluateAll(es => es.map(e => { const s=getComputedStyle(e),t=getComputedStyle(e.querySelector('h3')),r=e.getBoundingClientRect();return {font:t.fontSize,weight:t.fontWeight,padding:s.padding,columns:s.gridTemplateColumns,height:e.offsetHeight,left:getComputedStyle(e.querySelector('.article-text')).paddingLeft};}));
    for(const row of format){assert.deepEqual(row,format[0],'所有文章采用相同字号、列宽、间距和行高');assert.equal(row.left,'0px');}
    assert.equal(await page.locator('.featured').count(),0);
    assert.equal(await page.locator('.deck-ready').count(), 1);
    assert.equal(await page.locator('.article-list > li:not([inert])').count(), 1);
    assert.equal(await page.getByRole('button', {name:'上一篇'}).isDisabled(), true);
    assert(await page.locator('h1').evaluate(e=>parseFloat(getComputedStyle(e).fontSize)<=54 && parseInt(getComputedStyle(e).fontWeight)<=500));
    let previous = Infinity;
    for (const row of rows) {
     const post = expected.get(await row.getAttribute('href')); assert(post);
     assert.equal(await row.locator('h3').textContent(), post.title);
     const date = await row.locator('time').getAttribute('datetime');
     assert.equal(date, new Date(post.pubDate).toISOString().slice(0, 10));
     assert(new Date(date).valueOf() <= previous); previous = new Date(date).valueOf();
     assert.equal(await row.locator('.post-subtitle').count(), post.category === '开发' && post.subtitle ? 1 : 0);
     if (post.category === '开发' && post.subtitle) assert.equal(await row.locator('.post-subtitle').textContent(), post.subtitle);
    }
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    assert.equal(await page.locator('body').evaluate(e => getComputedStyle(e).backgroundColor), 'rgb(255, 255, 255)');
    await page.screenshot({ path: path.join(output, `${name}-${width}-${colorScheme}.png`) });
    const status = page.locator('.deck-position');
    await page.getByRole('button', {name:'下一篇'}).click();
    await page.waitForFunction(() => document.querySelector('.deck-position').textContent.startsWith('02'));
    await rows[1].focus(); await page.keyboard.press('ArrowLeft');
    await page.waitForFunction(() => document.querySelector('.deck-position').textContent.startsWith('01'));
    await page.waitForFunction(() => document.activeElement === document.querySelector('.article-row'));
    const box = await page.locator('.article-list').boundingBox();
    const x = box.x + box.width * .7, y = box.y + box.height / 2;
    await page.mouse.move(x,y); await page.mouse.down();
    await page.mouse.move(x - box.width * .4,y + 3,{steps:12}); await page.mouse.up();
    await page.waitForFunction(() => document.querySelector('.deck-position').textContent.startsWith('02'));
    assert.equal(new URL(page.url()).pathname, '/posts/', '拖动不误入正文');
    await page.mouse.move(x - box.width * .4,y); await page.mouse.down();
    await page.mouse.move(x,y,{steps:12}); await page.mouse.up();
    await page.waitForFunction(() => document.querySelector('.deck-position').textContent.startsWith('01'));
    await page.mouse.move(x,y); await page.mouse.down(); await page.mouse.move(x-15,y,{steps:3}); await page.mouse.up();
    assert((await status.textContent()).startsWith('01'), '短拖回弹');
    await page.waitForFunction(() => document.querySelectorAll('.paper-surface').length === 0);
    await rows[0].focus();
    await page.keyboard.press('Enter');
    await page.waitForURL(/\/posts\/.+\//);
    assert.equal(await page.locator('.writing-page').count(), 0);
    if (colorScheme === 'light') assert.equal(await page.locator('body').evaluate(e => getComputedStyle(e).backgroundColor), 'rgb(255, 255, 255)', '正文保留原阅读主题');
    await page.goBack({ waitUntil: 'domcontentloaded' });
    const categoryLinks = await page.locator('.writing-nav a').evaluateAll(es => es.map(e => e.getAttribute('href')).filter(h => !h.startsWith('#')));
    for (const href of categoryLinks) assert.equal((await page.request.get(base + href)).status(), 200, href);
    assert.deepEqual(errors, []);
    await page.close();
    console.log(JSON.stringify({ name, width, colorScheme, posts: expected.size, metadata: true, navigation: true, noOverflow: true }));
   }
  } finally { await browser.close(); }
 }
 const browser = await chromium.launch({ executablePath: '/Users/lu/.agent-browser/browsers/chrome-153.0.8010.36/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing' });
 try {
  const motion = await browser.newPage({ viewport:{width:390,height:844},hasTouch:true,isMobile:true,reducedMotion:'no-preference' });
  await motion.goto(base+'/posts/');
  await motion.locator('.article-list').scrollIntoViewIfNeeded();
  const before = await motion.locator('.article-list > li').evaluateAll(es => es.slice(0,2).map(e => getComputedStyle(e).transform));
  await motion.getByRole('button',{name:'下一篇'}).click();
  await motion.waitForTimeout(150);
  const during = await motion.locator('.article-list > li').evaluateAll(es => es.slice(0,2).map(e => getComputedStyle(e).transform));
  for(let i=0;i<2;i++) assert.notEqual(during[i],before[i],'前后两张同步转动');
  assert.equal(await motion.locator('.paper-strip').count(),8,'纸面分片形成弯曲');
  assert(await motion.locator('.paper-strip').evaluateAll(es => new Set(es.map(e=>e.style.transform)).size === 8),'纸面各处弯曲角度不同');
  assert.equal(await motion.locator('.paper-surface').getAttribute('aria-hidden'),'true');
  assert.equal(await motion.evaluate(() => document.documentElement.scrollWidth > innerWidth), false,'翻动中不产生横向页面滚动');
  await motion.screenshot({path:path.join(output,'swipe-in-motion.png')});
  await motion.waitForFunction(() => document.querySelector('.deck-position').textContent.startsWith('02'));
  const cdp = await motion.context().newCDPSession(motion);
  const box = await motion.locator('.article-list').boundingBox();
  const x=box.x+box.width*.75,y=box.y+box.height*.5;
  await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y}]});
  for(let i=1;i<=12;i++) await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:x-i*box.width*.04,y}]});
  await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
  await motion.waitForFunction(() => document.querySelector('.deck-position').textContent.startsWith('03'));
  assert.equal(new URL(motion.url()).pathname,'/posts/','真实触摸滑动不会打开文章');
  await motion.emulateMedia({reducedMotion:'reduce'});
  for(let i=3;i<expected.size;i++) {
    await motion.getByRole('button',{name:'下一篇'}).click();
    await motion.waitForFunction(n => document.querySelector('.deck-position').textContent.startsWith(String(n).padStart(2,'0')),i+1);
    assert(await motion.locator('li[data-depth="0"]').evaluate(e => e.querySelector('h3').getBoundingClientRect().bottom < e.querySelector('.card-footer').getBoundingClientRect().top),'标题未挤入卡片底部');
  }
  assert.equal(await motion.getByRole('button',{name:'下一篇'}).isDisabled(),true);
  assert.equal(await motion.locator('.article-list > li:not([inert])').count(),1);
  await motion.close();
  console.log(JSON.stringify({realAnimation:true,touchSwipe:true,lastCardBoundary:true}));
  const page = await browser.newPage({ javaScriptEnabled: false });
  await page.goto(base + '/posts/', { waitUntil: 'domcontentloaded' });
  assert.equal(await page.locator('.article-row').count(), expected.size);
  assert.equal(await page.locator('.deck-ready').count(), 0);
  assert.equal(await page.locator('.article-row:visible').count(), expected.size);
  for (const href of expected.keys()) assert.equal((await page.request.get(base + href)).status(), 200, href);
 } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });

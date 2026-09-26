import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {chromium} from 'playwright';
import {neighborhoodCatalog as catalog} from './published-catalog.js';
import {groupCatalogEntries} from './catalog-hierarchy.js';
import {houseComponents} from './house-components.js';
const base=process.env.SITE_URL||'http://127.0.0.1:4177/';
const evidence=process.env.EVIDENCE_DIR;
const browser=await chromium.launch({channel:'chrome',headless:true});
const errors=[],rows=[];
try{
 for(const viewport of [{width:1440,height:1000},{width:390,height:844}]){
  const page=await browser.newPage({viewport,reducedMotion:'reduce',isMobile:viewport.width<500,hasTouch:viewport.width<500});page.on('pageerror',e=>errors.push(e.message));
  for(const entry of catalog.entries){
   await page.goto(base+'#machine/'+entry.id,{waitUntil:'domcontentloaded'});
   await page.locator('[data-separation]').waitFor({state:'visible',timeout:45000});
   const play=page.locator('[data-play]');if(await play.count()&&await play.getAttribute('aria-pressed')==='true')await play.click();
   const readings=await page.locator('.daily-readings').innerText();
   await page.locator('[data-view="out"]').click();
   // Three published ids redirect to the page that holds them; zooming out stays on that page.
   assert.equal(new URL(page.url()).hash,'#machine/'+(houseComponents[entry.name]?.redirectTo||entry.id),entry.name+' out stays in item');
   assert.equal(await page.locator('[data-separation]').inputValue(),'0',entry.name+' minus only zooms');
   await page.locator('[data-view="in"]').click();
   assert.equal(await page.locator('[data-separation]').inputValue(),'0',entry.name+' plus only zooms');
   await page.locator('canvas').scrollIntoViewIfNeeded();
   await page.locator('canvas').hover();await page.mouse.wheel(0,180);
   await page.waitForFunction(()=>Number(document.querySelector('[data-separation]').value)>0);
   await page.locator('[data-separation]').fill('100');
   assert.equal(await page.locator('.daily-canvas-wrap').getAttribute('data-explosion'),'1');
   const categories=await page.locator('[data-category]').allTextContents();assert.ok(categories.length);
   await page.locator('[data-view="out"]').click();
   assert.equal(await page.locator('[data-separation]').inputValue(),'100',entry.name+' minus preserves separated state');
   await page.locator('[data-view="in"]').click();
   assert.equal(await page.locator('[data-separation]').inputValue(),'100',entry.name+' plus preserves separated state');
   assert.equal(await page.locator('.daily-readings').innerText(),readings,entry.name+' paused state remains');
   await page.locator('[data-labels]').check();
   const labels=await page.locator('.daily-model-label:visible').count();assert.ok(labels,entry.name+' visible labels');
   await page.locator('[data-labels]').uncheck();
   const category=page.locator('[data-category]:visible').first();if(await category.getAttribute('data-category')!=='__structure')await category.click();
   assert.equal(await page.locator('.daily-readings').innerText(),readings,entry.name+' selecting category preserves state');
   await page.locator('[data-reassemble]').click();
   assert.equal(await page.locator('[data-separation-status]').textContent(),'Assembled');
   assert.equal(await page.locator('.daily-readings').innerText(),readings,entry.name+' exact paused readings after reassembly');
   assert.equal(await page.locator('.daily-return').count(),1);
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false,entry.name+' no horizontal overflow');
   rows.push({id:entry.id,width:viewport.width,categories:categories.length,labels});
  }
  if(viewport.width<500){
   await page.goto(base+'#machine/mirrors',{waitUntil:'domcontentloaded'});await page.locator('[data-separation]').fill('100');await page.locator('canvas').scrollIntoViewIfNeeded();
   const session=await page.context().newCDPSession(page);
   const boxes=await page.locator('[data-category]').evaluateAll(nodes=>nodes.map(n=>{const b=n.getBoundingClientRect();return{x:b.x+b.width/2,y:b.y+b.height/2,width:b.width};}));
   const middle=boxes.find(b=>b.x>140&&b.x<250&&b.width>40);assert.ok(middle,'a category label is the pinch origin');
   const points=r=>[{x:middle.x-r,y:middle.y,id:1},{x:middle.x+r,y:middle.y,id:2}];
   await session.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:points(15)});
   for(let r=25;r<=145;r+=10)await session.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:points(r)});
   await session.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
   assert.equal(await page.locator('[data-separation]').inputValue(),'0','pinch beginning on category reassembles');
   assert.equal(await page.evaluate(()=>visualViewport.scale),1,'category gesture cannot zoom browser');
   assert.equal(new URL(page.url()).hash,'#machine/mirrors');
  }
  await page.goto(base+'#list');await page.locator('[data-entry]').first().waitFor();
  const ids=await page.locator('[data-entry]').evaluateAll(nodes=>nodes.map(n=>n.dataset.entry));assert.equal(ids.length,catalog.entries.length);assert.equal(new Set(ids).size,ids.length);
  assert.equal(await page.locator('.catalog-table tbody>tr').count(),groupCatalogEntries(catalog.entries).length);
  await page.close();
 }
 const fallback=await browser.newPage();
 await fallback.addInitScript(()=>{const original=HTMLCanvasElement.prototype.getContext;HTMLCanvasElement.prototype.getContext=function(kind,...args){return /webgl/.test(kind)?null:original.call(this,kind,...args);};});
 await fallback.goto(base+'#machine/sewing-machine');await fallback.locator('.daily-no-3d').waitFor();
 assert.equal(await fallback.locator('.daily-separation').isVisible(),false,'no inoperative separation control without WebGL');
 assert.equal(await fallback.locator('.daily-camera').isVisible(),false,'no inoperative camera controls without WebGL');
 assert.ok(await fallback.locator('[data-control]').count());await fallback.close();
 assert.deepEqual(errors,[]);
 const result={base,result:'PASS',checks:rows.length,noWebGLFallback:true,rows,errors};if(evidence){await mkdir(evidence,{recursive:true});await writeFile(evidence+'/explosion-browser.json',JSON.stringify(result,null,2)+'\n');}
 console.log(JSON.stringify({result:'PASS',routes:catalog.entries.length,checks:rows.length,errors}));
}finally{await browser.close();}

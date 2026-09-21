import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {chromium} from 'playwright';
import {neighborhoodCatalog} from './published-catalog.js';

const base=process.env.SITE_URL||'http://127.0.0.1:5193/';
const out=process.env.EVIDENCE_DIR||'documentation/audit/evidence/part-name-popups-20260919';
await mkdir(out,{recursive:true});
const browser=await chromium.launch({headless:true}),errors=[],observations=[];
let page;
async function findPart(page,separated=false){
 await page.locator('canvas').scrollIntoViewIfNeeded();
 const box=await page.locator('canvas').boundingBox(),points=[];
 if(separated){
  for(const heading of await page.locator('.daily-inventory-labels [data-category]').all()){
   const rect=await heading.boundingBox();if(!rect)continue;
   for(const dy of [12,25,40,60])points.push([rect.x+rect.width/2,rect.y+rect.height+dy]);
  }
 }
 for(const y of [.5,.35,.65,.2,.8,.1,.9])for(const x of [.5,.35,.65,.2,.8,.1,.9])points.push([box.x+box.width*x,box.y+box.height*y]);
 for(const [x,y] of points){
  if(x<box.x||x>box.x+box.width||y<box.y||y>box.y+box.height)continue;
  if(!await page.evaluate(({x,y})=>document.elementFromPoint(x,y)?.tagName==='CANVAS',{x,y}))continue;
  await page.mouse.move(x,y);
  const popup=page.locator('.daily-part-popup');
  if(await popup.isVisible())return {x,y,name:await popup.textContent()};
 }
 throw Error('No hoverable part found: '+page.url());
}
async function assertPopupFits(page){
 const popup=await page.locator('.daily-part-popup').boundingBox(),wrap=await page.locator('.daily-canvas-wrap').boundingBox();
 assert(popup,'Popup visible');assert(popup.x>=wrap.x&&popup.y>=wrap.y&&popup.x+popup.width<=wrap.x+wrap.width&&popup.y+popup.height<=wrap.y+wrap.height,'Popup stays within canvas');
 assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'No horizontal overflow');
}
try{
 page=await browser.newPage({viewport:{width:1440,height:1000},reducedMotion:'reduce'});page.on('pageerror',error=>errors.push(error.message));page.setDefaultTimeout(15000);
 await page.goto(base+'#list');
 for(const entry of neighborhoodCatalog.entries){
  await page.evaluate(id=>location.hash='machine/'+id,entry.id);
  await page.waitForFunction(name=>document.querySelector('.daily-heading h1')?.textContent===name&&document.querySelector('.daily-part-popup'),entry.name);
  const knownNames=new Set(await page.locator('.daily-model-label').allTextContents());
  for(const separated of [false,true]){
   await page.locator('[data-view="reset"]').click();
   if(separated)await page.locator('[data-separation]').fill('100');
   const hit=await findPart(page,separated);assert(knownNames.has(hit.name),entry.id+': exact named part');await assertPopupFits(page);
   await page.mouse.click(hit.x,hit.y);assert.equal(await page.locator('.daily-part-detail h3').textContent(),hit.name,entry.id+': selection agrees with hover');
   assert.equal(await page.locator('.daily-part-popup').textContent(),hit.name);await assertPopupFits(page);
   assert.equal(await page.locator('[data-separation]').inputValue(),separated?'100':'0','Click preserves separation mode');
   await page.mouse.move(0,0);assert.equal(await page.locator('.daily-part-popup').isVisible(),true,'Clicked popup stays visible on pointer leave');
   await page.locator('canvas').press('Escape');assert.equal(await page.locator('.daily-part-popup').isVisible(),false,'Escape dismisses popup');assert.equal(await page.locator('.daily-part-detail h3').count(),0,'Escape clears selection');
   observations.push({id:entry.id,separated,name:hit.name});
  }
  if(observations.length%20===0)console.log('Popup route cases:',observations.length);
 }
 await page.goto(base+'#machine/circuit-breaker');await page.locator('canvas').waitFor();
 let hit=await findPart(page);await page.mouse.move(0,0);assert.equal(await page.locator('.daily-part-popup').isVisible(),false,'Hover popup leaves with pointer');
 await page.mouse.move(hit.x,hit.y);await page.screenshot({path:out+'/desktop-hover.png',clip:await page.locator('.daily-canvas-wrap').boundingBox()});
 await page.mouse.click(hit.x,hit.y);await page.screenshot({path:out+'/desktop-click.png',clip:await page.locator('.daily-canvas-wrap').boundingBox()});
 await page.locator('[data-view="reset"]').click();hit=await findPart(page);await page.mouse.down();await page.mouse.move(hit.x+75,hit.y+20,{steps:10});await page.mouse.up();assert.equal(await page.locator('.daily-part-popup').isVisible(),false,'Pan does not become a part click');assert.equal(await page.locator('.daily-part-detail h3').count(),0);
 await page.locator('[data-view="reset"]').click();await page.locator('canvas').scrollIntoViewIfNeeded();let box=await page.locator('canvas').boundingBox();
 const before=await page.screenshot({clip:box});await page.mouse.move(box.x+18,box.y+18);await page.mouse.down();await page.mouse.move(box.x+100,box.y+40,{steps:10});await page.mouse.up();const after=await page.screenshot({clip:box});assert(!before.equals(after),'Outside drag rotates');assert.equal(await page.locator('.daily-part-popup').isVisible(),false);
 await page.locator('[data-view="reset"]').click();await page.locator('[data-separation]').fill('100');hit=await findPart(page,true);await page.mouse.click(hit.x,hit.y);
 await page.screenshot({path:out+'/desktop-separated-click.png',clip:await page.locator('.daily-canvas-wrap').boundingBox()});
 for(const direction of ['in','out']){await page.locator(`[data-view="${direction}"]`).click();assert.equal(await page.locator('[data-separation]').inputValue(),'100');}
 await page.locator('[data-reassemble]').click();assert.equal(await page.locator('.daily-part-popup').isVisible(),false);
 await page.goto(base+'#list');assert.equal(await page.locator('.daily-part-popup').count(),0,'Route cleanup removes popup');await page.close();
 page=await browser.newPage({viewport:{width:390,height:844},hasTouch:true,reducedMotion:'reduce'});page.on('pageerror',error=>errors.push(error.message));
 for(const id of ['circuit-breaker','3d-printer','mirrors','sewing-machine']){
  await page.goto(base+'#machine/'+id);await page.locator('canvas').waitFor();
  for(const separated of [false,true]){
   await page.locator('[data-view="reset"]').click();if(separated)await page.locator('[data-separation]').fill('100');
   const hit=await findPart(page,separated);await page.mouse.move(0,0);
   await page.touchscreen.tap(hit.x,hit.y);assert.equal(await page.locator('.daily-part-popup').textContent(),hit.name);await assertPopupFits(page);
   assert.equal(await page.locator('.daily-part-detail h3').textContent(),hit.name);assert.equal(await page.locator('[data-separation]').inputValue(),separated?'100':'0');
   await page.screenshot({path:`${out}/phone-${id}-${separated?'separated':'assembled'}.png`,clip:await page.locator('.daily-canvas-wrap').boundingBox()});
   observations.push({id,width:390,separated,name:hit.name,touch:true});
  }
 }
 // Label-list selections clear outside the scene without resetting its camera.
 for(const width of [1440,390]){
  await page.setViewportSize({width,height:width===390?844:1000});
  await page.goto(base+'#machine/circuit-breaker');await page.locator('[data-labels]').check();
  const label=page.locator('.daily-model-label[data-label-part="plunger"]');await label.click();
  assert.equal(await label.getAttribute('aria-pressed'),'true');
  await page.locator('[data-labels]').uncheck();
  const sample=async()=>{
   await page.locator('canvas').scrollIntoViewIfNeeded();const box=await page.locator('canvas').boundingBox(),names=[];
   for(const y of [.2,.35,.5,.65,.8])for(const x of [.2,.35,.5,.65,.8]){await page.mouse.move(box.x+box.width*x,box.y+box.height*y);names.push(await page.locator('.daily-part-popup').isVisible()?await page.locator('.daily-part-popup').textContent():null);}
   return names;
  };
  const before=await sample();
  await page.locator('.daily-heading h1').click();assert.equal(await page.locator('.daily-part-detail h3').count(),0);assert.equal(await page.locator('.daily-part-popup').isVisible(),false);
  assert.deepEqual(await sample(),before,'Outside click leaves camera framing unchanged');
  await page.locator('[data-labels]').check();assert.equal(await page.locator('.daily-model-label[aria-pressed="true"]').count(),0);
  await label.click();await page.locator('[data-isolate]').check();await page.locator('.daily-heading h1').click();assert.equal(await page.locator('[data-isolate]').isChecked(),false);assert.equal(await page.locator('.daily-part-detail h3').count(),0);
  assert.equal(await page.locator('.daily-model-label[aria-pressed="true"]').count(),0);
  await page.locator('[data-labels]').uncheck();await page.locator('[data-view="reset"]').click();await page.locator('[data-separation]').fill('100');
  await page.locator('.daily-inventory-labels [data-category="plunger"]').click();assert.equal(await page.locator('.daily-part-detail h3').count(),1);
  await page.locator('canvas').scrollIntoViewIfNeeded();const box=await page.locator('canvas').boundingBox();await page.touchscreen.tap(box.x+8,box.y+8);
  assert.equal(await page.locator('.daily-part-detail h3').count(),0,'Blank canvas tap clears selection');assert.equal(await page.locator('[data-separation]').inputValue(),'100','Deselect preserves separated view');
  await page.screenshot({path:`${out}/deselected-${width}.png`,clip:await page.locator('.daily-canvas-wrap').boundingBox()});
 }
 // Dismissal must not move an outside control between pointerdown and click.
 for(const width of [1440,390]){
  await page.setViewportSize({width,height:width===390?844:1000});await page.goto(base+'#machine/seismic-waves');await page.locator('[data-play]').waitFor();
  for(const answer of ['0','1']){
   await page.getByRole('button',{name:'Inspect far ground detail',exact:true}).click();const choice=page.locator(`[data-answer="${answer}"]`);await choice.scrollIntoViewIfNeeded();const before=await choice.boundingBox();
   await page.mouse.move(before.x+before.width/2,before.y+before.height/2);await page.mouse.down();assert.deepEqual(await choice.boundingBox(),before,'Outside control remains still until click resolves');await page.mouse.up();
   assert.equal(await choice.getAttribute('aria-pressed'),'true','First click activates intended answer');assert.equal(await page.locator('.daily-part-detail h3').count(),0,'Answer click also dismisses selection');assert.match(await page.locator('.daily-answer').textContent(),answer==='0'?/That’s right/:/Try thinking/);
  }
  observations.push({id:'seismic-waves',width,outsideControl:'quiz',firstClick:true});
 }
 assert.deepEqual(errors,[]);console.log(`PASS part popups: ${observations.length} route/view cases, hover/click/tap names, bounds, label-list deselection, preserved camera, dismissal, selection, drag, zoom-only buttons, reassembly and route cleanup.`);
}catch(error){
 console.error(error);await writeFile(out+'/failure.json',JSON.stringify({url:page?.url(),error:String(error),observations},null,2));
 await page?.screenshot({path:out+'/failure.png',fullPage:true,timeout:5000}).catch(()=>{});throw error;
}finally{await writeFile(out+'/browser.json',JSON.stringify({base,browser:browser.version(),observations,errors},null,2)+'\n');await browser.close();}

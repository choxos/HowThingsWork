import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {chromium} from 'playwright';
import {lcdLesson as lesson} from './lcd-lesson.js';
const evidence=new URL(process.env.LCD_EVIDENCE||'../../documentation/audit/evidence/liquid-crystal-display/browser/',import.meta.url);await mkdir(evidence,{recursive:true});
const browser=await chromium.launch({headless:process.env.HEADED!=='1'}),page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[],observations=[];
page.setDefaultTimeout(10000);page.on('pageerror',e=>errors.push(e.message));
const sceneShot=async options=>{await page.mouse.move(0,0);await page.locator('canvas').evaluate(c=>c.scrollIntoView({block:'start',behavior:'instant'}));await page.waitForTimeout(150);return page.screenshot({...options,clip:await page.locator('canvas').boundingBox()});};
const frameMargin=async()=>{const b=await page.evaluate(()=>{document.querySelector('[data-control="mode"]').dispatchEvent(new Event('input',{bubbles:true}));const c=document.querySelector('canvas'),copy=new OffscreenCanvas(c.width,c.height),ctx=copy.getContext('2d');ctx.drawImage(c,0,0);const pixels=ctx.getImageData(0,0,c.width,c.height).data,b={width:c.width,height:c.height,left:c.width,right:0,top:c.height,bottom:0};for(let y=0;y<c.height;y++)for(let x=0;x<c.width;x++)if(pixels[(y*c.width+x)*4+3]>0){b.left=Math.min(b.left,x);b.right=Math.max(b.right,x);b.top=Math.min(b.top,y);b.bottom=Math.max(b.bottom,y);}return b;});assert.ok(b.right>b.left&&b.bottom>b.top,'actual scene rendered');assert.ok(Math.min(b.left,b.top,b.width-1-b.right,b.height-1-b.bottom)>=8,'complete scene has raster margins: '+JSON.stringify(b));return b;};
const read=()=>page.locator('.daily-readings>div').evaluateAll(ns=>Object.fromEntries(ns.map(n=>[n.querySelector('dt').textContent,n.querySelector('dd').textContent])));
const near=(a,b,digits=0)=>assert.equal(parseFloat(a),Number(b.toFixed(digits)),`${a} must display rounded ${b}`);
const stages=['Inspect start (0%)','Inspect quarter (25%)','Inspect three quarters (75%)','Inspect result (100%)'];
const inspect=i=>page.getByRole('button',{name:stages[i],exact:true}).click();
async function preset(i){await page.getByRole('tab',{name:'Try it yourself',exact:true}).click();await page.locator(`[data-experiment="${i}"]`).click();await page.getByRole('tab',{name:'Controls',exact:true}).click();}
function compare(r,i,time){
 const v=lesson.tryIt[i].values,patterns=['abcdef','bc','abdeg','abcdg','bcfg','acdfg','acdefg','abc','abcdefg','abcdfg'],addressed=v.mode?patterns[v.digit].includes('abcdefg'[v.segment]):Boolean(v.drive),driven=Boolean(v.battery&&addressed),out=(v.analyzer===2||Boolean(v.analyzer)===driven)?v.power/2:0;
 near(r['Trace time'],time,2);near(r['Trace progress'],time/8*100);assert.equal(Object.keys(r).length,v.mode?16:12);near(r['Available light'],v.power);near(r['Selected-cell output'],out);if(v.mode){near(r['Undriven background'],v.analyzer===1?0:v.power/2);near(r['Addressed-cell output'],v.analyzer===0?0:v.power/2);}
 assert.equal(r['Electrical state'],driven?'Addressed, field applied':'Unaddressed, no field');assert.equal(r['SEG minus COM'],driven?(v.polarity?'−Vd':'+Vd'):'0');assert.equal(r['Cycle RMS voltage'],driven?'Vd':'0');assert.equal(r['Cycle mean voltage'],'0');assert.equal(r['COMMON voltage'],v.battery&&v.polarity?'+Vd':'0');
 if(v.mode)assert.equal(r['Commanded segments'],patterns[v.digit].split('').join(', '));if(!v.power)assert.match(r['Outcome'],/No external light/);
}
try{
 const url=process.env.LCD_URL||new URL('#machine/liquid-crystal-display',process.env.SITE_URL||'http://127.0.0.1:5193/').href;await page.goto(url,{waitUntil:'domcontentloaded',timeout:45000});await page.locator('[data-control="mode"]').waitFor({timeout:45000});assert.equal(await page.locator('h1').textContent(),'Liquid crystal display');near((await read())['Trace time'],8);
 assert.equal(await page.locator('.daily-canvas-wrap').evaluate(n=>getComputedStyle(n).backgroundImage),'none');
 for(const width of [1440,390]){
  await page.setViewportSize({width,height:width===390?844:1000});
  if(width===390)assert.equal(await page.locator('.daily-canvas-wrap').evaluate(n=>getComputedStyle(n).backgroundColor),await page.evaluate(()=>getComputedStyle(document.body).backgroundColor));
  for(let i=0;i<lesson.tryIt.length;i++){
   await preset(i);const v=lesson.tryIt[i].values;
   for(const [key,value] of Object.entries(v)){const input=page.locator(`[data-control="${key}"]`);assert.equal(Number(await input.inputValue()),value);const enabled=key==='drive'?v.mode===0:key==='digit'||key==='segment'?v.mode===1:true;assert.equal(await input.isEnabled(),enabled,`${i}:${key}`);assert.equal(await input.isVisible(),enabled);}
   for(let stage=0;stage<4;stage++){await inspect(stage);compare(await read(),i,[0,2,6,8][stage]);await frameMargin();assert.ok(await page.locator('.daily-readings>div').evaluateAll(ns=>ns.every(n=>n.querySelector('p')?.textContent.length>15)));}
   if([0,1,2,3,4,7,8,9,11,12,15,16,17,18,19,20,21,22,24].includes(i))await sceneShot({path:new URL(`scene-${width}-${i}.png`,evidence).pathname});
   assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));observations.push({width,preset:i,title:lesson.tryIt[i].title,readings:await read()});
  }
 }
 await page.setViewportSize({width:1440,height:1000});
 for(const i of [0,1,22]){
  await preset(i);await page.locator('[data-step]').click();compare(await read(),i,.08);await page.locator('[data-play]').click();await page.waitForFunction(()=>parseFloat([...document.querySelectorAll('.daily-readings>div')].find(n=>n.querySelector('dt').textContent==='Trace time').querySelector('dd').textContent)>.25);await page.locator('[data-play]').click();const held=await read();await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));assert.deepEqual(await read(),held);
  await inspect(0);await page.locator('[data-play]').click();await page.waitForFunction(()=>document.querySelector('[data-play]').getAttribute('aria-pressed')==='false',null,{timeout:20000});compare(await read(),i,8);await page.locator('[data-play]').click();await page.waitForFunction(()=>parseFloat([...document.querySelectorAll('.daily-readings>div')].find(n=>n.querySelector('dt').textContent==='Trace time').querySelector('dd').textContent)<1);await page.locator('[data-play]').click();
 }
 for(const i of [0,1,15,16,17,18,19,20,21,22,23,24]){await preset(i);await inspect(0);assert.equal(await page.locator('[data-result]').isDisabled(),true);await inspect(3);await page.locator('[data-result]').click();assert.equal(await page.locator('.daily-part-detail h3').innerText(),'Display seen by the observer');await sceneShot({path:new URL(`result-${i}.png`,evidence).pathname});}
 await preset(17);await inspect(3);await page.locator('[data-result]').click();await sceneShot({path:new URL('image-closeup.png',evidence).pathname});
 await page.locator('[data-control="digit"]').focus();await page.keyboard.press('ArrowRight');assert.equal(Number(await page.locator('[data-control="digit"]').inputValue()),4);assert.equal((await read())['Commanded segments'],'b, c, f, g');
 const before=await sceneShot();await page.locator('canvas').focus();await page.keyboard.press('ArrowRight');assert.ok(!before.equals(await sceneShot()));
 await page.getByRole('button',{name:'Reset experiment',exact:true}).click();compare(await read(),0,0);assert.deepEqual(errors,[]);
 const result={passed:true,url,presets:lesson.tryIt.length,viewportWidths:[1440,390],presetStageChecks:lesson.tryIt.length*8,playbackCases:3,errors,observations};await writeFile(new URL('results.json',evidence),JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify({...result,observations:observations.length}));
}finally{await browser.close();}

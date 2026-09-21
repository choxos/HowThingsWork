import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {chromium} from 'playwright';
import {canOpenerLesson as lesson} from './can-opener-lesson.js';
const evidence=new URL(process.env.CAN_OPENER_EVIDENCE||'../../documentation/audit/evidence/can-opener/browser/',import.meta.url);await mkdir(evidence,{recursive:true});
const browser=await chromium.launch({headless:process.env.HEADED!=='1'}),page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[],observations=[];
page.setDefaultTimeout(10000);page.on('pageerror',e=>errors.push(e.message));
const sceneShot=async options=>{await page.mouse.move(0,0);await page.locator('canvas').evaluate(c=>c.scrollIntoView({block:'start',behavior:'instant'}));await page.waitForTimeout(150);return page.screenshot({...options,clip:await page.locator('canvas').boundingBox()});};
const frameMargin=async()=>{const b=await page.evaluate(()=>{document.querySelector('[data-control="normal"]').dispatchEvent(new Event('input',{bubbles:true}));const c=document.querySelector('canvas'),copy=new OffscreenCanvas(c.width,c.height),ctx=copy.getContext('2d');ctx.drawImage(c,0,0);const pixels=ctx.getImageData(0,0,c.width,c.height).data,b={width:c.width,height:c.height,left:c.width,right:0,top:c.height,bottom:0};for(let y=0;y<c.height;y++)for(let x=0;x<c.width;x++)if(pixels[(y*c.width+x)*4+3]>0){b.left=Math.min(b.left,x);b.right=Math.max(b.right,x);b.top=Math.min(b.top,y);b.bottom=Math.max(b.bottom,y);}return b;});assert.ok(b.right>b.left&&b.bottom>b.top,'actual scene rendered');assert.ok(Math.min(b.left,b.top,b.width-1-b.right,b.height-1-b.bottom)>=8,'complete scene has raster margins: '+JSON.stringify(b));return b;};
const read=()=>page.locator('.daily-readings>div').evaluateAll(ns=>Object.fromEntries(ns.map(n=>[n.querySelector('dt').textContent,n.querySelector('dd').textContent])));
const near=(a,b,digits=2)=>assert.equal(parseFloat(a),Number(b.toFixed(digits)),`${a} must display rounded ${b}`);
const stages=['Inspect start (0%)','Inspect quarter (25%)','Inspect three quarters (75%)','Inspect result (100%)'];
const inspect=i=>page.getByRole('button',{name:stages[i],exact:true}).click();
async function preset(i){await page.getByRole('tab',{name:'Try it yourself',exact:true}).click();await page.locator(`[data-experiment="${i}"]`).click();await page.getByRole('tab',{name:'Controls',exact:true}).click();}
function compare(r,i,time){
 const v=lesson.tryIt[i].values,load=v.edge?28:12,grip=v.clamp*.35*v.normal,drive=v.effort*v.arm;
 const operation=!v.clamp?'open':!v.effort||drive+1e-10<Math.min(load,grip)?'stall':grip+1e-10<load?'slip':'cutting';
 const turns=v.effort&&operation!=='stall'?.5*(operation==='cutting'?Math.min(time,v.diameter/10):time):0,cut=operation==='cutting'?Math.min(Math.PI*v.diameter/1000,turns*2*Math.PI*.01):0,free=operation==='cutting'&&time>=v.diameter/10;
 const used=operation==='cutting'?load:operation==='slip'?grip:0,work=used*turns*2*Math.PI*.01,actual=v.effort&&operation!=='stall'&&!free?used/v.arm:0;
 near(r['Trial time'],time);assert.equal(Object.keys(r).length,16);
 near(r['Available crank torque'],v.effort*v.arm/100);near(r['Available rim force'],drive);near(r['Traction capacity'],grip);near(r['Cutting resistance'],load);near(r['Actual hand force while turning'],actual);near(r['Hand force needed for cutting'],load/v.arm);near(r['Crank turns'],turns);assert.equal(r['Crank turns'].split(' of ')[1],`${v.diameter/20} needed`);
 near(r['Rim travel through cut'],cut*1000,1);assert.equal(r['Rim travel through cut'].split(' of ')[1],`${Number((Math.PI*v.diameter).toFixed(1))} mm`);near(r['Opening progress'],cut/(Math.PI*v.diameter/1000)*100,1);near(r['Hand travel'],turns*2*Math.PI*v.arm/100);near(r['Input work'],work,3);near(r['Cutting work'],cut*load,3);near(r['Sliding work'],operation==='slip'?grip*turns*2*Math.PI*.01:0,3);assert.equal(r['Lid connection'],free?'Fully separated':'Still attached');
 assert.match(r['Outcome'],free?/entire circumference|opener is clear/:operation==='open'?/upper shaft|handles are open/:operation==='stall'?/stalls|Zero available/:operation==='slip'?/slip/:/rim advances/);

}
try{
 const url=process.env.CAN_OPENER_URL||new URL('#machine/can-opener',process.env.SITE_URL||'http://127.0.0.1:5193/').href;await page.goto(url,{waitUntil:'domcontentloaded',timeout:45000});await page.locator('[data-control="normal"]').waitFor({timeout:45000});assert.equal(await page.locator('h1').textContent(),'Can opener');compare(await read(),0,0);
 for(const width of [1440,390]){
  await page.setViewportSize({width,height:width===390?844:1000});
  for(let i=0;i<lesson.tryIt.length;i++){
   await preset(i);for(const [key,value] of Object.entries(lesson.tryIt[i].values)){const input=page.locator(`[data-control="${key}"]`);assert.equal(Number(await input.inputValue()),value);assert.equal(await input.isEnabled(),true);}
   for(let stage=0;stage<4;stage++){await inspect(stage);compare(await read(),i,[0,4,12,16][stage]);await frameMargin();assert.ok(await page.locator('.daily-readings>div').evaluateAll(ns=>ns.every(n=>n.querySelector('p')?.textContent.length>15)));}
   if([0,1,3,5,6,9,10,12,13,16].includes(i))await sceneShot({path:new URL(`scene-${width}-${i}.png`,evidence).pathname});
   assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));observations.push({width,preset:i,title:lesson.tryIt[i].title,readings:await read()});
  }
 }
 await page.setViewportSize({width:1440,height:1000});
 for(const i of [0,3,7]){
  await preset(i);await page.locator('[data-step]').click();compare(await read(),i,.16);await page.locator('[data-play]').click();await page.waitForFunction(()=>parseFloat([...document.querySelectorAll('.daily-readings>div')].find(n=>n.querySelector('dt').textContent==='Trial time').querySelector('dd').textContent)>.4);await page.locator('[data-play]').click();const held=await read();await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));assert.deepEqual(await read(),held);
  await inspect(2);await page.locator('[data-play]').click();await page.waitForFunction(()=>document.querySelector('[data-play]').getAttribute('aria-pressed')==='false',null,{timeout:12000});compare(await read(),i,16);await page.locator('[data-play]').click();await page.waitForFunction(()=>parseFloat([...document.querySelectorAll('.daily-readings>div')].find(n=>n.querySelector('dt').textContent==='Trial time').querySelector('dd').textContent)<1);await page.locator('[data-play]').click();
 }
 for(let i=0;i<lesson.tryIt.length;i++){await preset(i);assert.equal(await page.locator('[data-result]').isDisabled(),true);await inspect(3);const released=(await read())['Lid connection']==='Fully separated';assert.equal(await page.locator('[data-result]').isDisabled(),!released);if(released){await page.locator('[data-result]').click();assert.equal(await page.locator('.daily-part-detail h3').innerText(),'Cut lid');await sceneShot({path:new URL(`result-${i}.png`,evidence).pathname});}}
 await preset(0);await inspect(3);await page.locator('[data-result]').click();await sceneShot({path:new URL('released-lid.png',evidence).pathname});
 await page.locator('[data-control="effort"]').focus();await page.keyboard.press('ArrowLeft');assert.equal(Number(await page.locator('[data-control="effort"]').inputValue()),3.5);
 await page.getByRole('button',{name:'Reset experiment',exact:true}).click();compare(await read(),0,0);const before=await sceneShot();await page.locator('canvas').focus();await page.keyboard.press('ArrowRight');assert.ok(!before.equals(await sceneShot()));
 const held=await read(),route=page.url();await page.locator('[data-separation]').fill('100');await page.locator('[data-separation]').dispatchEvent('input');await page.waitForTimeout(800);assert.equal(page.url(),route);assert.deepEqual(await read(),held);await sceneShot({path:new URL('grouped-parts.png',evidence).pathname});await page.locator('[data-reassemble]').click();await page.waitForTimeout(800);assert.deepEqual(await read(),held);assert.equal(await page.locator('[data-separation]').inputValue(),'0');assert.deepEqual(errors,[]);
 const result={passed:true,url,presets:lesson.tryIt.length,viewportWidths:[1440,390],presetStageChecks:lesson.tryIt.length*8,playbackCases:3,errors,observations};await writeFile(new URL('results.json',evidence),JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify({...result,observations:observations.length}));
}finally{await browser.close();}

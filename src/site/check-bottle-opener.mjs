import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {chromium} from 'playwright';
import {bottleOpenerLesson as lesson} from './bottle-opener-lesson.js';
const evidence=new URL(process.env.BOTTLE_OPENER_EVIDENCE||'../../documentation/audit/evidence/bottle-opener/browser/',import.meta.url);await mkdir(evidence,{recursive:true});
const browser=await chromium.launch({headless:process.env.HEADED!=='1'}),page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[],observations=[];
page.setDefaultTimeout(10000);page.on('pageerror',e=>errors.push(e.message));
const sceneShot=async options=>{await page.mouse.move(0,0);await page.locator('canvas').evaluate(c=>c.scrollIntoView({block:'start',behavior:'instant'}));await page.waitForTimeout(150);return page.screenshot({...options,clip:await page.locator('canvas').boundingBox()});};
const frameMargin=async()=>{const b=await page.evaluate(()=>{document.querySelector('[data-control="stiffness"]').dispatchEvent(new Event('input',{bubbles:true}));const c=document.querySelector('canvas'),copy=new OffscreenCanvas(c.width,c.height),ctx=copy.getContext('2d');ctx.drawImage(c,0,0);const pixels=ctx.getImageData(0,0,c.width,c.height).data,b={width:c.width,height:c.height,left:c.width,right:0,top:c.height,bottom:0};for(let y=0;y<c.height;y++)for(let x=0;x<c.width;x++)if(pixels[(y*c.width+x)*4+3]>0){b.left=Math.min(b.left,x);b.right=Math.max(b.right,x);b.top=Math.min(b.top,y);b.bottom=Math.max(b.bottom,y);}return b;});assert.ok(b.right>b.left&&b.bottom>b.top,'actual scene rendered');assert.ok(Math.min(b.left,b.top,b.width-1-b.right,b.height-1-b.bottom)>=8,'complete scene has raster margins: '+JSON.stringify(b));return b;};
const read=()=>page.locator('.daily-readings>div').evaluateAll(ns=>Object.fromEntries(ns.map(n=>[n.querySelector('dt').textContent,n.querySelector('dd').textContent])));
const near=(a,b,digits=2)=>assert.equal(parseFloat(a),Number(b.toFixed(digits)),`${a} must display rounded ${b}`);
const stages=['Inspect start (0%)','Inspect quarter (25%)','Inspect three quarters (75%)','Inspect result (100%)'];
const inspect=i=>page.getByRole('button',{name:stages[i],exact:true}).click();
async function preset(i){await page.getByRole('tab',{name:'Try it yourself',exact:true}).click();await page.locator(`[data-experiment="${i}"]`).click();await page.getByRole('tab',{name:'Controls',exact:true}).click();}
// Independently solved force-limit anchors, in millimeters, in the lesson's preset order.
const limits=[3,0,0,1.275748257418957,2.712746291662297,3,.7918065510463929,3,3,3,1.076047838386165,0,3,2.5074228778020573,3,0,3];
const inverse=q=>Math.atan2(.004,.027)+Math.asin((q-.004)/Math.hypot(.027,.004));
function compare(r,i,t){
 const v=lesson.tryIt[i].values,maxQ=limits[i]/1000,a=v.placement?.035*t:Math.min(.035*t,inverse(maxQ)),q=v.placement?0:Math.min(maxQ,.027*Math.sin(a)+.004*(1-Math.cos(a))),free=!v.placement&&maxQ===.003&&t>=inverse(.003)/.035;
 const mode=v.placement?'missed':free?'released':maxQ<.003&&t>=inverse(maxQ)/.035?'stall':'lifting',work=20*q+.5*v.stiffness*1000*q*q;
 const alpha=v.direction*Math.PI/180,L=v.arm/100,arm=L*Math.cos(a+alpha),load=20+v.stiffness*1000*q,hookArm=.027*Math.cos(a)+.004*Math.sin(a),needed=arm>1e-12?load*hookArm/arm:null,releaseA=inverse(.003),peakArm=L*Math.cos(releaseA+alpha),peak=peakArm>1e-12?(20+3*v.stiffness)*(.027*Math.cos(releaseA)+.004*Math.sin(releaseA))/peakArm:null;
 const actual=v.placement||free?0:mode==='stall'?v.effort:needed,hook=v.placement||free?0:Math.max(0,actual*arm/hookArm);
 near(r['Trial time'],t);assert.equal(Object.keys(r).length,17);assert.equal(r['Cap attachment'],free?'Released':'Still retained');near(r['Actual hand force'],actual);near(r['Hook lift'],q*1000);assert.equal(r['Hook lift'].split(' of ')[1],'3 mm');near(r['Lever angle'],a*180/Math.PI,1);near(r['Available hand force'],v.effort);near(r['Hand travel'],v.arm/100*a*1000,1);near(r['Cap deformation work'],work,3);near(r['Retaining resistance'],load);near(r['Hook force'],hook);near(r['Available torque'],arm>1e-12?v.effort*arm:0);near(r['Required torque'],load*hookArm);near(r['Support horizontal reaction'],-actual*Math.sin(alpha));near(r['Support vertical reaction'],hook-actual*Math.cos(alpha));
 for(const [name,value] of [['Required hand force at current angle',needed],['Peak hand force needed for release',peak]]){if(v.placement)assert.equal(r[name],'No hook engagement');else if(value===null)assert.equal(r[name],'No positive lifting moment');else near(r[name],value);}
 assert.match(r['Outcome'],mode==='missed'?/hook misses/:mode==='stall'?/stalls|cannot overcome/:mode==='released'?/crimps have cleared|opener is clear/:/lever lifts/);

}
try{
 const url=process.env.BOTTLE_OPENER_URL||new URL('#machine/bottle-opener',process.env.SITE_URL||'http://127.0.0.1:5193/').href;await page.goto(url,{waitUntil:'domcontentloaded',timeout:45000});await page.locator('[data-control="stiffness"]').waitFor({timeout:45000});assert.equal(await page.locator('h1').textContent(),'Bottle opener');compare(await read(),0,0);
 for(const width of [1440,390]){
  await page.setViewportSize({width,height:width===390?844:1000});
  for(let i=0;i<lesson.tryIt.length;i++){
   await preset(i);for(const [key,value] of Object.entries(lesson.tryIt[i].values)){const input=page.locator(`[data-control="${key}"]`);assert.equal(Number(await input.inputValue()),value);assert.equal(await input.isEnabled(),true);}
   for(let stage=0;stage<4;stage++){await inspect(stage);compare(await read(),i,[0,2,6,8][stage]);await frameMargin();assert.ok(await page.locator('.daily-readings>div').evaluateAll(ns=>ns.every(n=>n.querySelector('p')?.textContent.length>15)));}
   if([0,3,4,6,7,9,10,11,13,15].includes(i))await sceneShot({path:new URL(`scene-${width}-${i}.png`,evidence).pathname});
   assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));observations.push({width,preset:i,title:lesson.tryIt[i].title,readings:await read()});
  }
 }
 await page.setViewportSize({width:1440,height:1000});
 for(const i of [0,3,15]){
  await preset(i);await page.locator('[data-step]').click();compare(await read(),i,.08);await page.locator('[data-play]').click();await page.waitForFunction(()=>parseFloat([...document.querySelectorAll('.daily-readings>div')].find(n=>n.querySelector('dt').textContent==='Trial time').querySelector('dd').textContent)>.3);await page.locator('[data-play]').click();const held=await read();await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));assert.deepEqual(await read(),held);
  await inspect(2);await page.locator('[data-play]').click();await page.waitForFunction(()=>document.querySelector('[data-play]').getAttribute('aria-pressed')==='false',null,{timeout:12000});compare(await read(),i,8);await page.locator('[data-play]').click();await page.waitForFunction(()=>parseFloat([...document.querySelectorAll('.daily-readings>div')].find(n=>n.querySelector('dt').textContent==='Trial time').querySelector('dd').textContent)<1);await page.locator('[data-play]').click();
 }
 for(let i=0;i<lesson.tryIt.length;i++){await preset(i);assert.equal(await page.locator('[data-result]').isDisabled(),true);await inspect(3);const released=(await read())['Cap attachment']==='Released';assert.equal(await page.locator('[data-result]').isDisabled(),!released);if(released){await page.locator('[data-result]').click();assert.equal(await page.locator('.daily-part-detail h3').innerText(),'Crown cap');await sceneShot({path:new URL(`result-${i}.png`,evidence).pathname});}}
 for(const i of [0,3,4,10,15]){await preset(i);await inspect(1);const held=await read();await page.getByRole('button',{name:'Inspect cap contact',exact:true}).click();assert.equal(await page.locator('.daily-part-detail h3').innerText(),'Cap hook');assert.deepEqual(await read(),held);await sceneShot({path:new URL(`contact-${i}.png`,evidence).pathname});await page.getByRole('button',{name:'Inspect whole opener',exact:true}).click();assert.equal(await page.locator('.daily-part-detail h3').innerText(),'Bottle opener');assert.deepEqual(await read(),held);}
 await preset(0);await inspect(3);await page.locator('[data-result]').click();await sceneShot({path:new URL('released-cap.png',evidence).pathname});
 await page.locator('[data-control="effort"]').focus();await page.keyboard.press('ArrowLeft');assert.equal(Number(await page.locator('[data-control="effort"]').inputValue()),15);
 await page.getByRole('button',{name:'Reset experiment',exact:true}).click();compare(await read(),0,0);const before=await sceneShot();await page.locator('canvas').focus();await page.keyboard.press('ArrowRight');assert.ok(!before.equals(await sceneShot()));
 const held=await read(),route=page.url();await page.locator('[data-separation]').fill('100');await page.locator('[data-separation]').dispatchEvent('input');await page.waitForTimeout(800);assert.equal(page.url(),route);assert.deepEqual(await read(),held);await sceneShot({path:new URL('grouped-parts.png',evidence).pathname});await page.locator('[data-reassemble]').click();await page.waitForTimeout(800);assert.deepEqual(await read(),held);assert.equal(await page.locator('[data-separation]').inputValue(),'0');assert.deepEqual(errors,[]);
 const result={passed:true,url,presets:lesson.tryIt.length,viewportWidths:[1440,390],presetStageChecks:lesson.tryIt.length*8,playbackCases:3,errors,observations};await writeFile(new URL('results.json',evidence),JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify({...result,observations:observations.length}));
}finally{await browser.close();}

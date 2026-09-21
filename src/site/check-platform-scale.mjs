import assert from 'node:assert/strict';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {chromium} from 'playwright';
import {platformScaleLesson as lesson} from './platform-scale-lesson.js';
const evidence=new URL(process.env.PLATFORM_SCALE_EVIDENCE||'../../documentation/audit/evidence/platform-scale/browser/',import.meta.url);await mkdir(evidence,{recursive:true});
const browser=await chromium.launch({headless:process.env.HEADED!=='1'}),page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[],observations=[];
page.setDefaultTimeout(10000);page.on('pageerror',e=>errors.push(e.message));
const sceneShot=async options=>{await page.mouse.move(0,0);await page.locator('canvas').evaluate(c=>c.scrollIntoView({block:'start',behavior:'instant'}));await page.waitForTimeout(150);return page.screenshot({...options,clip:await page.locator('canvas').boundingBox()});};
const frameMargin=async()=>{const b=await page.evaluate(()=>{document.querySelector('[data-control="poise"]').dispatchEvent(new Event('input',{bubbles:true}));const c=document.querySelector('canvas'),copy=new OffscreenCanvas(c.width,c.height),ctx=copy.getContext('2d');ctx.drawImage(c,0,0);const pixels=ctx.getImageData(0,0,c.width,c.height).data,b={width:c.width,height:c.height,left:c.width,right:0,top:c.height,bottom:0};for(let y=0;y<c.height;y++)for(let x=0;x<c.width;x++)if(pixels[(y*c.width+x)*4+3]>0){b.left=Math.min(b.left,x);b.right=Math.max(b.right,x);b.top=Math.min(b.top,y);b.bottom=Math.max(b.bottom,y);}return b;});assert.ok(b.right>b.left&&b.bottom>b.top,'actual scene rendered');assert.ok(Math.min(b.left,b.top,b.width-1-b.right,b.height-1-b.bottom)>=8,'complete scene has raster margins: '+JSON.stringify(b));return b;};
const read=()=>page.locator('.daily-readings>div').evaluateAll(ns=>Object.fromEntries(ns.map(n=>[n.querySelector('dt').textContent,n.querySelector('dd').textContent])));
const near=(a,b,digits=2)=>assert.ok(Number.isFinite(parseFloat(a))&&Math.abs(parseFloat(a)-b)<=.5*10**-digits+2e-7,`${a} must display rounded ${b}`);
const stages=['Inspect start (0%)','Inspect quarter (25%)','Inspect three quarters (75%)','Inspect result (100%)'];
const inspect=i=>page.getByRole('button',{name:stages[i],exact:true}).click();
async function preset(i){await page.getByRole('tab',{name:'Try it yourself',exact:true}).click();await page.locator(`[data-experiment="${i}"]`).click();await page.getByRole('tab',{name:'Controls',exact:true}).click();}
// Independent Cartesian-constraint and DOP853 results; no production sampler.
const anchors=JSON.parse(await readFile(new URL('../../documentation/audit/evidence/platform-scale/independent-review/preset-anchors.json',import.meta.url),'utf8')).cases;
const mapped={'First rod tension':['firstRodForce',2],'Second rod tension':['secondRodForce',2],'Continuous secured-payload force':['payloadForce',2],'Stop torque':['stopTorque',2],'Payload stopping impulse':['payloadStoppingImpulse',3],'Kinetic energy':['kineticEnergy',3],'Potential energy change':['potentialEnergy',3],'Damper heat':['damperHeat',3],'Impact heat':['impactHeat',3]};
function compare(r,i,t){
 const v=lesson.tryIt[i].values,a=anchors[i].snapshots.find(s=>Math.abs(s.elapsed-t)<1e-12);assert.ok(a,'Independent snapshot exists');assert.deepEqual(anchors[i].values,v);
 near(r['Trial time'],t);near(r['Physical elapsed time'],t/4);near(r['Fixed-bar indication'],125*v.poise);near(r['Mass balanced by this poise'],25*v.poiseMass*v.poise);near(r['Required poise position'],v.mass/(25*v.poiseMass),3);assert.equal(r['Balance within bar range'],v.mass/(25*v.poiseMass)<=1.2+1e-12?'Yes':'No');near(r['Gravity'],[9.81,1.62][v.gravity]);
 for(const [label,[key,digits]] of Object.entries(mapped))near(r[label],a[key],digits);
 near(r['Weighing beam angle'],a.beamAngle*180/Math.PI);near(r['Platform displacement upward'],a.platformTravel*1000,3);near(r['Poise displacement upward'],v.poise*Math.sin(a.beamAngle)*1000,3);near(r['Damper torque'],-20*a.lowerSpeed);near(r['Signed stop force upward'],a.stopTorque/(.9*Math.cos(a.lowerAngle)));near(r['Platform-guide couple'],(.2-.2*Math.cos(a.lowerAngle))*a.payloadForce,3);near(r['Stop impacts'],a.stopHits,0);if(a.stopHits)near(r['Last impact physical time'],a.lastImpactPhysicalTime,3);else assert.equal(r['Last impact physical time'],'No impact');assert.equal(Object.keys(r).length,25);
 if(Math.abs(a.stopTorque)>1e-7)assert.match(r.Outcome,/not balance|still imbalanced/);else if(Math.abs(v.mass-25*v.poiseMass*v.poise)<1e-10)assert.match(r.Outcome,/stays level without a stop reaction/);
}
try{
 const url=process.env.PLATFORM_SCALE_URL||new URL('#machine/platform-scale',process.env.SITE_URL||'http://127.0.0.1:5193/').href;await page.goto(url,{waitUntil:'domcontentloaded',timeout:45000});await page.locator('[data-control="poise"]').waitFor({timeout:45000});assert.equal(await page.locator('h1').textContent(),'Platform scale');compare(await read(),0,0);
 for(const width of [1440,390]){
  await page.setViewportSize({width,height:width===390?844:1000});
  for(let i=0;i<lesson.tryIt.length;i++){
   await preset(i);for(const [key,value] of Object.entries(lesson.tryIt[i].values)){const input=page.locator(`[data-control="${key}"]`);assert.equal(Number(await input.inputValue()),value);assert.equal(await input.isEnabled(),true);}
   for(let stage=0;stage<4;stage++){await inspect(stage);compare(await read(),i,[0,2,6,8][stage]);await frameMargin();assert.ok(await page.locator('.daily-readings>div').evaluateAll(ns=>ns.every(n=>n.querySelector('p')?.textContent.length>15)));}
   if([0,1,2,6,7,12,14,18,19].includes(i)){await inspect(1);await sceneShot({path:new URL(`result-scene-${width}-${i}.png`,evidence).pathname});await inspect(3);}
   assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));observations.push({width,preset:i,title:lesson.tryIt[i].title,readings:await read()});
  }
 }
 await page.setViewportSize({width:1440,height:1000});
 for(const i of [0,1,15]){
  await preset(i);await page.locator('[data-step]').click();compare(await read(),i,.08);await page.locator('[data-play]').click();await page.waitForFunction(()=>parseFloat([...document.querySelectorAll('.daily-readings>div')].find(n=>n.querySelector('dt').textContent==='Trial time').querySelector('dd').textContent)>.3);await page.locator('[data-play]').click();const held=await read();await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));assert.deepEqual(await read(),held);
  await inspect(2);await page.locator('[data-play]').click();await page.waitForFunction(()=>document.querySelector('[data-play]').getAttribute('aria-pressed')==='false',null,{timeout:12000});compare(await read(),i,8);await page.locator('[data-play]').click();await page.waitForFunction(()=>parseFloat([...document.querySelectorAll('.daily-readings>div')].find(n=>n.querySelector('dt').textContent==='Trial time').querySelector('dd').textContent)<1);await page.locator('[data-play]').click();for(const [key,value] of Object.entries(lesson.tryIt[i].values))assert.equal(Number(await page.locator('[data-control="'+key+'"]').inputValue()),value,'Replay retains the configured trial');
 }
 for(const i of [0,1,2,14,18,19]){await preset(i);await inspect(3);const held=await read();for(const [label,name] of [['Inspect travel stop','Two travel stops'],['Inspect level reference','Beam level reference'],['Inspect whole scale','Platform scale']]){await page.getByRole('button',{name:label,exact:true}).click();assert.equal(await page.locator('.daily-part-detail h3').innerText(),name);assert.deepEqual(await read(),held);await sceneShot({path:new URL(`detail-${i}-${name.replaceAll(' ','-')}.png`,evidence).pathname});}}
 await preset(0);await inspect(3);await page.locator('[data-result]').click();await sceneShot({path:new URL('balance-inspection.png',evidence).pathname});
 await page.locator('[data-control="mass"]').focus();await page.keyboard.press('ArrowLeft');assert.equal(Number(await page.locator('[data-control="mass"]').inputValue()),95);
 await page.getByRole('button',{name:'Reset experiment',exact:true}).click();compare(await read(),0,0);const before=await sceneShot();await page.locator('canvas').focus();await page.keyboard.press('ArrowRight');assert.ok(!before.equals(await sceneShot()));
 const held=await read(),route=page.url();await page.locator('[data-separation]').fill('100');await page.locator('[data-separation]').dispatchEvent('input');await page.waitForTimeout(800);assert.equal(page.url(),route);assert.deepEqual(await read(),held);await sceneShot({path:new URL('grouped-parts.png',evidence).pathname});await page.locator('[data-reassemble]').click();await page.waitForTimeout(800);assert.deepEqual(await read(),held);assert.equal(await page.locator('[data-separation]').inputValue(),'0');assert.deepEqual(errors,[]);
 const result={passed:true,url,presets:lesson.tryIt.length,viewportWidths:[1440,390],presetStageChecks:lesson.tryIt.length*8,playbackCases:3,errors,observations};await writeFile(new URL('results.json',evidence),JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify({...result,observations:observations.length}));
}finally{await browser.close();}

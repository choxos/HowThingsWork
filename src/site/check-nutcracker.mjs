import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {chromium} from 'playwright';
import {nutcrackerLesson as lesson} from './nutcracker-lesson.js';
const evidence=new URL(process.env.NUTCRACKER_EVIDENCE||'../../documentation/audit/evidence/nutcracker/browser/',import.meta.url);await mkdir(evidence,{recursive:true});
const browser=await chromium.launch({headless:process.env.HEADED!=='1'}),page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[],observations=[];
page.setDefaultTimeout(10000);page.on('pageerror',e=>errors.push(e.message));
const sceneShot=async options=>{await page.mouse.move(0,0);await page.locator('canvas').evaluate(c=>c.scrollIntoView({block:'start',behavior:'instant'}));await page.waitForTimeout(150);return page.screenshot({...options,clip:await page.locator('canvas').boundingBox()});};
const frameMargin=async()=>{const b=await page.evaluate(()=>{document.querySelector('[data-control="stiffness"]').dispatchEvent(new Event('input',{bubbles:true}));const c=document.querySelector('canvas'),copy=new OffscreenCanvas(c.width,c.height),ctx=copy.getContext('2d');ctx.drawImage(c,0,0);const pixels=ctx.getImageData(0,0,c.width,c.height).data,b={width:c.width,height:c.height,left:c.width,right:0,top:c.height,bottom:0};for(let y=0;y<c.height;y++)for(let x=0;x<c.width;x++)if(pixels[(y*c.width+x)*4+3]>0){b.left=Math.min(b.left,x);b.right=Math.max(b.right,x);b.top=Math.min(b.top,y);b.bottom=Math.max(b.bottom,y);}return b;});assert.ok(b.right>b.left&&b.bottom>b.top,'actual scene rendered');assert.ok(Math.min(b.left,b.top,b.width-1-b.right,b.height-1-b.bottom)>=8,'complete scene has raster margins: '+JSON.stringify(b));return b;};
const read=()=>page.locator('.daily-readings>div').evaluateAll(ns=>Object.fromEntries(ns.map(n=>[n.querySelector('dt').textContent,n.querySelector('dd').textContent])));
const near=(a,b,digits=2)=>assert.equal(parseFloat(a),Number(b.toFixed(digits)),`${a} must display rounded ${b}`);
const stages=['Inspect start (0%)','Inspect quarter (25%)','Inspect three quarters (75%)','Inspect result (100%)'];
const inspect=i=>page.getByRole('button',{name:stages[i],exact:true}).click();
async function preset(i){await page.getByRole('tab',{name:'Try it yourself',exact:true}).click();await page.locator(`[data-experiment="${i}"]`).click();await page.getByRole('tab',{name:'Controls',exact:true}).click();}
// Closed-form force-limit anchors, independent of the production sampler.
const limits=[2,0,0,0,1,1.9,2,1.6428571428571428,2,2,1.25,2,2,1.25,2,2,2,2];
function compare(r,i,t){
 const v=lesson.tryIt[i].values,a=v.seat/100,L=v.arm/100,D=v.diameter/1000,k=v.stiffness*1000,ratio=L/a,maxQ=limits[i]/1000;
 const initial=Math.asin((D+.008)/(2*a)),limit=Math.asin((D-maxQ+.008)/(2*a)),stop=(initial-limit)/.01,angle=Math.max(limit,initial-.01*t);
 const q=Math.min(maxQ,Math.max(0,D+.008-2*a*Math.sin(angle))),cracked=maxQ===.002&&t>=stop,mode=cracked?'cracked':t>=stop?'stall':'compressing';
 const load=20+k*q,force=cracked?0:Math.min(v.effort,load/ratio),work=20*q+.5*k*q*q;
 near(r['Trial time'],t);assert.equal(Object.keys(r).length,18);assert.equal(r['Shell condition'],cracked?'Cracked':'Uncracked');near(r['Shell compression'],q*1000);assert.equal(r['Shell compression'].split(' of ')[1],'2 mm');near(r['Lever force ratio'],ratio);near(r['Available force on each handle'],v.effort);near(r['Actual force on each handle'],force);near(r['Peak force needed on each handle'],(20+k*.002)/ratio);near(r['Opposing jaw compression'],force*ratio);near(r['Available jaw compression'],v.effort*ratio);near(r['Assumed resistance at attained compression'],load);near(r['Hinge reaction magnitude on each lever'],force*(ratio-1));near(r['Each hand inward travel'],ratio*q*500);near(r['Both hands inward travel'],ratio*q*1000);near(r['Each hand arc length'],L*(initial-angle)*1000);near(r['Input work from both hands'],work,3);
 const smooth=x=>{const p=Math.max(0,Math.min(1,x));return p*p*(3-2*p);},withdrawal=cracked?smooth((t-stop-.25)/.75):0,displayed=angle+(initial+.14-angle)*withdrawal;
 near(r['Jaw gap'],(2*a*Math.sin(displayed)-.008)*1000);if(maxQ===.002)near(r['Crack time'],stop,3);else assert.equal(r['Crack time'],'Force limit prevents cracking');assert.match(r['Outcome'],mode==='stall'?/stop|cannot overcome/:mode==='cracked'?/crack|kernel|jaws|shell halves/:/Both handles close/);
}
try{
 const url=process.env.NUTCRACKER_URL||new URL('#machine/nutcracker',process.env.SITE_URL||'http://127.0.0.1:5193/').href;await page.goto(url,{waitUntil:'domcontentloaded',timeout:45000});await page.locator('[data-control="stiffness"]').waitFor({timeout:45000});assert.equal(await page.locator('h1').textContent(),'Nutcracker');compare(await read(),0,0);
 for(const width of [1440,390]){
  await page.setViewportSize({width,height:width===390?844:1000});
  for(let i=0;i<lesson.tryIt.length;i++){
   await preset(i);for(const [key,value] of Object.entries(lesson.tryIt[i].values)){const input=page.locator(`[data-control="${key}"]`);assert.equal(Number(await input.inputValue()),value);assert.equal(await input.isEnabled(),true);}
   for(let stage=0;stage<4;stage++){await inspect(stage);compare(await read(),i,[0,2,6,8][stage]);await frameMargin();assert.ok(await page.locator('.daily-readings>div').evaluateAll(ns=>ns.every(n=>n.querySelector('p')?.textContent.length>15)));}
   if([0,1,4,5,7,8,10,11,13,14,16].includes(i))await sceneShot({path:new URL(`scene-${width}-${i}.png`,evidence).pathname});
   assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));observations.push({width,preset:i,title:lesson.tryIt[i].title,readings:await read()});
  }
 }
 await page.setViewportSize({width:1440,height:1000});
 for(const i of [0,4,1]){
  await preset(i);await page.locator('[data-step]').click();compare(await read(),i,.08);await page.locator('[data-play]').click();await page.waitForFunction(()=>parseFloat([...document.querySelectorAll('.daily-readings>div')].find(n=>n.querySelector('dt').textContent==='Trial time').querySelector('dd').textContent)>.3);await page.locator('[data-play]').click();const held=await read();await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));assert.deepEqual(await read(),held);
  await inspect(2);await page.locator('[data-play]').click();await page.waitForFunction(()=>document.querySelector('[data-play]').getAttribute('aria-pressed')==='false',null,{timeout:12000});compare(await read(),i,8);await page.locator('[data-play]').click();await page.waitForFunction(()=>parseFloat([...document.querySelectorAll('.daily-readings>div')].find(n=>n.querySelector('dt').textContent==='Trial time').querySelector('dd').textContent)<1);await page.locator('[data-play]').click();
 }
 for(let i=0;i<lesson.tryIt.length;i++){await preset(i);assert.equal(await page.locator('[data-result]').isDisabled(),true);await inspect(3);const cracked=(await read())['Shell condition']==='Cracked';assert.equal(await page.locator('[data-result]').isDisabled(),!cracked);if(cracked){await page.locator('[data-result]').click();assert.equal(await page.locator('.daily-part-detail h3').innerText(),'Kernel');await sceneShot({path:new URL(`kernel-${i}.png`,evidence).pathname});}}
 for(const i of [0,4,5,7,10,13]){await preset(i);await inspect(1);const held=await read();await page.getByRole('button',{name:'Inspect jaw contact',exact:true}).click();assert.equal(await page.locator('.daily-part-detail h3').innerText(),'Seated nut');assert.deepEqual(await read(),held);await sceneShot({path:new URL(`contact-${i}.png`,evidence).pathname});await page.getByRole('button',{name:'Inspect whole nutcracker',exact:true}).click();assert.equal(await page.locator('.daily-part-detail h3').innerText(),'Nutcracker');assert.deepEqual(await read(),held);}
 await preset(0);await inspect(3);await page.locator('[data-result]').click();await sceneShot({path:new URL('exposed-kernel.png',evidence).pathname});
 await page.locator('[data-control="effort"]').focus();await page.keyboard.press('ArrowLeft');assert.equal(Number(await page.locator('[data-control="effort"]').inputValue()),29);
 await page.getByRole('button',{name:'Reset experiment',exact:true}).click();compare(await read(),0,0);const before=await sceneShot();await page.locator('canvas').focus();await page.keyboard.press('ArrowRight');assert.ok(!before.equals(await sceneShot()));
 const held=await read(),route=page.url();await page.locator('[data-separation]').fill('100');await page.locator('[data-separation]').dispatchEvent('input');await page.waitForTimeout(800);assert.equal(page.url(),route);assert.deepEqual(await read(),held);await sceneShot({path:new URL('grouped-parts.png',evidence).pathname});await page.locator('[data-reassemble]').click();await page.waitForTimeout(800);assert.deepEqual(await read(),held);assert.equal(await page.locator('[data-separation]').inputValue(),'0');assert.deepEqual(errors,[]);
 const result={passed:true,url,presets:lesson.tryIt.length,viewportWidths:[1440,390],presetStageChecks:lesson.tryIt.length*8,playbackCases:3,errors,observations};await writeFile(new URL('results.json',evidence),JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify({...result,observations:observations.length}));
}finally{await browser.close();}

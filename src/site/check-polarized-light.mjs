import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {chromium} from 'playwright';
import {polarizedLightLesson as lesson} from './polarized-light-lesson.js';
const evidence=new URL(process.env.POLARIZED_LIGHT_EVIDENCE||'../../documentation/audit/evidence/polarized-light/browser/',import.meta.url);await mkdir(evidence,{recursive:true});
const browser=await chromium.launch({headless:process.env.HEADED!=='1'}),page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[],observations=[];
page.setDefaultTimeout(10000);page.on('pageerror',e=>errors.push(e.message));
const sceneShot=async options=>{await page.mouse.move(0,0);await page.locator('canvas').evaluate(c=>c.scrollIntoView({block:'start',behavior:'instant'}));await page.waitForTimeout(150);return page.screenshot({...options,clip:await page.locator('canvas').boundingBox()});};
const frameMargin=async()=>{const b=await page.evaluate(()=>{document.querySelector('[data-control="mode"]').dispatchEvent(new Event('input',{bubbles:true}));const c=document.querySelector('canvas'),copy=new OffscreenCanvas(c.width,c.height),ctx=copy.getContext('2d');ctx.drawImage(c,0,0);const pixels=ctx.getImageData(0,0,c.width,c.height).data,b={width:c.width,height:c.height,left:c.width,right:0,top:c.height,bottom:0};for(let y=0;y<c.height;y++)for(let x=0;x<c.width;x++)if(pixels[(y*c.width+x)*4+3]>0){b.left=Math.min(b.left,x);b.right=Math.max(b.right,x);b.top=Math.min(b.top,y);b.bottom=Math.max(b.bottom,y);}return b;});assert.ok(b.right>b.left&&b.bottom>b.top,'actual scene rendered');assert.ok(Math.min(b.left,b.top,b.width-1-b.right,b.height-1-b.bottom)>=8,'complete scene has raster margins: '+JSON.stringify(b));return b;};
const read=()=>page.locator('.daily-readings>div').evaluateAll(ns=>Object.fromEntries(ns.map(n=>[n.querySelector('dt').textContent,n.querySelector('dd').textContent])));
const near=(a,b)=>{if(Math.abs(b)>=1e-10&&Math.abs(b)<.005)assert.match(a,/^<0\.01/);else assert.equal(parseFloat(a),Math.abs(b)<1e-10?0:Number(b.toFixed(2)),`${a} must display rounded ${b}`);};
const stages=['Inspect start (0%)','Inspect quarter (25%)','Inspect three quarters (75%)','Inspect result (100%)'];
const inspect=i=>page.getByRole('button',{name:stages[i],exact:true}).click();
async function preset(i){await page.getByRole('tab',{name:'Try it yourself',exact:true}).click();await page.locator(`[data-experiment="${i}"]`).click();await page.getByRole('tab',{name:'Controls',exact:true}).click();}
function compare(r,i,time){
 const v=lesson.tryIt[i].values,cos2=a=>Math.cos(a*Math.PI/180)**2;near(r['Trace time'],time);near(r['Trace progress'],time/8*100);assert.equal(Object.keys(r).length,v.mode?13:8);near(r['Input power'],v.power);
 if(v.mode===0){const first=v.power*(v.input?cos2(v.inputAngle-v.first):.5),before=v.insert?first*cos2(v.middle-v.first):first,out=before*cos2(v.analyzer-(v.insert?v.middle:v.first));near(r['After first polarizer'],first);near(r['Before final analyzer'],before);near(r['Detected power'],out);near(r['Filter-train absorption'],v.power-out);}
 else {const n=v.material?1.5:1.33,i=v.brewster?Math.atan(n):v.incidence*Math.PI/180,t=Math.asin(Math.sin(i)/n),rs=((Math.cos(i)-n*Math.cos(t))/(Math.cos(i)+n*Math.cos(t)))**2,rp=((n*Math.cos(i)-Math.cos(t))/(n*Math.cos(i)+Math.cos(t)))**2,total=v.power*(rs+rp)/2,out=v.glasses?v.power*(rp*cos2(v.analyzer)+rs*(1-cos2(v.analyzer)))/2:total;near(r['Actual incidence'],i*180/Math.PI);near(r['Refraction angle'],t*180/Math.PI);near(r['s reflectance'],100*rs);near(r['p reflectance'],100*rp);near(r['Total reflected power'],total);near(r['Detected power'],out);if(!v.power)assert.equal(r['Reflected linear polarization'],'Unavailable: source off');}
 if(!v.power)assert.match(r['Outcome'],/source is off/);
}
try{
 const url=process.env.POLARIZED_LIGHT_URL||new URL('#machine/polarized-light',process.env.SITE_URL||'http://127.0.0.1:5193/').href;await page.goto(url,{waitUntil:'domcontentloaded',timeout:45000});await page.locator('[data-control="mode"]').waitFor({timeout:45000});assert.equal(await page.locator('h1').textContent(),'Polarized light');near((await read())['Trace time'],8);
 assert.equal(await page.locator('.daily-canvas-wrap').evaluate(n=>getComputedStyle(n).backgroundImage),'none');
 for(const width of [1440,390]){
  await page.setViewportSize({width,height:width===390?844:1000});
  if(width===390)assert.equal(await page.locator('.daily-canvas-wrap').evaluate(n=>getComputedStyle(n).backgroundColor),await page.evaluate(()=>getComputedStyle(document.body).backgroundColor));
  for(let i=0;i<lesson.tryIt.length;i++){
   await preset(i);const v=lesson.tryIt[i].values;
   for(const [key,value] of Object.entries(v)){const input=page.locator(`[data-control="${key}"]`);assert.equal(Number(await input.inputValue()),value);const enabled=['mode','power','magnetic'].includes(key)||key==='analyzer'&&(v.mode===0||v.glasses===1)||(v.mode===0?['input','first','insert'].includes(key)||key==='inputAngle'&&v.input===1||key==='middle'&&v.insert===1:['brewster','material','glasses'].includes(key)||key==='incidence'&&!v.brewster);assert.equal(await input.isEnabled(),enabled,`${i}:${key}`);assert.equal(await input.isVisible(),enabled);}
   for(let stage=0;stage<4;stage++){await inspect(stage);compare(await read(),i,[0,2,6,8][stage]);await frameMargin();assert.ok(await page.locator('.daily-readings>div').evaluateAll(ns=>ns.every(n=>n.querySelector('p')?.textContent.length>15)));}
   if([0,1,3,6,7,9,13,14,18,19,20,21,23,24].includes(i))await sceneShot({path:new URL(`scene-${width}-${i}.png`,evidence).pathname});
   assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));observations.push({width,preset:i,title:lesson.tryIt[i].title,readings:await read()});
  }
 }
 await page.setViewportSize({width:1440,height:1000});
 for(const i of [0,3,14]){
  await preset(i);await page.locator('[data-step]').click();compare(await read(),i,.08);await page.locator('[data-play]').click();await page.waitForFunction(()=>parseFloat([...document.querySelectorAll('.daily-readings>div')].find(n=>n.querySelector('dt').textContent==='Trace time').querySelector('dd').textContent)>.25);await page.locator('[data-play]').click();const held=await read();await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));assert.deepEqual(await read(),held);
  await inspect(0);await page.locator('[data-play]').click();await page.waitForFunction(()=>document.querySelector('[data-play]').getAttribute('aria-pressed')==='false',null,{timeout:20000});compare(await read(),i,8);await page.locator('[data-play]').click();await page.waitForFunction(()=>parseFloat([...document.querySelectorAll('.daily-readings>div')].find(n=>n.querySelector('dt').textContent==='Trace time').querySelector('dd').textContent)<1);await page.locator('[data-play]').click();
 }
 for(const i of [0,1,3,14,15,18,20,25]){await preset(i);await inspect(0);assert.equal(await page.locator('[data-result]').isDisabled(),true);await inspect(3);assert.equal(await page.locator('[data-result]').isEnabled(),true);await page.locator('[data-result]').click();assert.equal(await page.locator('.daily-part-detail h3').innerText(),lesson.tryIt[i].values.mode?'Glare meter':'Power comparison');await sceneShot({path:new URL(`result-${i}.png`,evidence).pathname});}
 await preset(0);await inspect(3);await page.locator('[data-result]').click();await sceneShot({path:new URL('image-closeup.png',evidence).pathname});
 await page.locator('[data-control="analyzer"]').focus();await page.keyboard.press('ArrowRight');assert.equal(Number(await page.locator('[data-control="analyzer"]').inputValue()),105);near((await read())['Detected power'],50*Math.cos(105*Math.PI/180)**2);
 const before=await sceneShot();await page.locator('canvas').focus();await page.keyboard.press('ArrowRight');assert.ok(!before.equals(await sceneShot()));
 await page.getByRole('button',{name:'Reset experiment',exact:true}).click();compare(await read(),0,0);assert.deepEqual(errors,[]);
 const result={passed:true,url,presets:27,viewportWidths:[1440,390],presetStageChecks:216,playbackCases:3,errors,observations};await writeFile(new URL('results.json',evidence),JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify({...result,observations:observations.length}));
}finally{await browser.close();}

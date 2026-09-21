import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {chromium} from 'playwright';
import {microscopesLesson as lesson} from './microscopes-lesson.js';
const evidence=new URL(process.env.MICROSCOPES_EVIDENCE||'../../documentation/audit/evidence/microscopes/browser/',import.meta.url);await mkdir(evidence,{recursive:true});
const browser=await chromium.launch({headless:process.env.HEADED!=='1'}),page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[],observations=[];
page.setDefaultTimeout(10000);page.on('pageerror',e=>errors.push(e.message));
const sceneShot=async options=>{await page.mouse.move(0,0);await page.locator('canvas').evaluate(c=>c.scrollIntoView({block:'start',behavior:'instant'}));await page.waitForTimeout(150);return page.screenshot({...options,clip:await page.locator('canvas').boundingBox()});};
const frameMargin=async()=>{const b=await page.evaluate(()=>{document.querySelector('[data-control="mode"]').dispatchEvent(new Event('input',{bubbles:true}));const c=document.querySelector('canvas'),copy=new OffscreenCanvas(c.width,c.height),ctx=copy.getContext('2d');ctx.drawImage(c,0,0);const pixels=ctx.getImageData(0,0,c.width,c.height).data,b={width:c.width,height:c.height,left:c.width,right:0,top:c.height,bottom:0};for(let y=0;y<c.height;y++)for(let x=0;x<c.width;x++)if(pixels[(y*c.width+x)*4+3]>0){b.left=Math.min(b.left,x);b.right=Math.max(b.right,x);b.top=Math.min(b.top,y);b.bottom=Math.max(b.bottom,y);}return b;});assert.ok(b.right>b.left&&b.bottom>b.top,'actual scene rendered');assert.ok(Math.min(b.left,b.top,b.width-1-b.right,b.height-1-b.bottom)>=8,'complete scene has raster margins: '+JSON.stringify(b));return b;};
const read=()=>page.locator('.daily-readings>div').evaluateAll(ns=>Object.fromEntries(ns.map(n=>[n.querySelector('dt').textContent,n.querySelector('dd').textContent])));
const near=(a,b,digits=2)=>assert.equal(Number.parseFloat(a.replaceAll(',','')),Number(b.toFixed(digits)),`${a} must display rounded ${b}`);
const stages=['Inspect start (0%)','Inspect quarter (25%)','Inspect three quarters (75%)','Inspect result (100%)'];
const inspect=i=>page.getByRole('button',{name:stages[i],exact:true}).click();
async function preset(i){await page.getByRole('tab',{name:'Try it yourself',exact:true}).click();await page.locator(`[data-experiment="${i}"]`).click();await page.getByRole('tab',{name:'Controls',exact:true}).click();}
function compare(r,i,time){
 const v=lesson.tryIt[i].values;near(r['Trace time'],time);near(r['Trace progress'],time/8*100);assert.equal(Object.keys(r).length,[10,8,6][v.mode]);
 if(v.mode===0){const di=1/(.25-1/v.stage);near(r['Objective image distance'],di);near(r['Objective magnification'],-di/v.stage);near(r['Numerical aperture'],v.aperture/Math.hypot(v.aperture,v.stage),4);if(v.stage===4.4)near(r['Relaxed-eye angular magnification'],-10*250/v.eyepiece);else{assert.equal(r['Relaxed-eye angular magnification'],'Unavailable: eyepiece out of focus');assert.ok(parseFloat(r['Output slope spread'])>0);}}
 if(v.mode===1){near(r['Objective image distance'],1/(v.power-1/1.2));if(v.power===1){near(r['Focused screen magnification'],10);near(r['Screen point spread'],0);}else{assert.equal(r['Focused screen magnification'],'Unavailable: screen out of focus');assert.ok(parseFloat(r['Screen point spread'])>.01);}}
 if(v.mode===2){near(r['Scan enlargement'],2/v.scanWidth);assert.equal(r['Acquired pixels'],`${v.source?Math.floor(time/8*1024):0} / 1024`);}
 if(!v.source){assert.match(r['Outcome'],/source is off/);if(v.mode<2)near(r['Center admitted intensity'],0);else near(r['Current detector signal'],0);}
 if(v.mode===0&&v.illumination)assert.match(r['Outcome'],/illumination stop blocks/);
}
try{
 const url=process.env.MICROSCOPES_URL||new URL('#machine/microscopes',process.env.SITE_URL||'http://127.0.0.1:5193/').href;await page.goto(url,{waitUntil:'domcontentloaded',timeout:45000});await page.locator('[data-control="mode"]').waitFor({timeout:45000});assert.equal(await page.locator('h1').textContent(),'Microscopes');near((await read())['Trace time'],8);
 assert.equal(await page.locator('.daily-canvas-wrap').evaluate(n=>getComputedStyle(n).backgroundImage),'none');
 for(const width of [1440,390]){
  await page.setViewportSize({width,height:width===390?844:1000});
  if(width===390)assert.equal(await page.locator('.daily-canvas-wrap').evaluate(n=>getComputedStyle(n).backgroundColor),await page.evaluate(()=>getComputedStyle(document.body).backgroundColor));
  for(let i=0;i<lesson.tryIt.length;i++){
   await preset(i);const v=lesson.tryIt[i].values;
   for(const [key,value] of Object.entries(v)){const input=page.locator(`[data-control="${key}"]`);assert.equal(Number(await input.inputValue()),value);const enabled=key==='mode'||key==='source'||(v.mode===0?['stage','eyepiece','aperture','illumination'].includes(key):v.mode===1?['power','thickness'].includes(key):['detector','scanWidth'].includes(key));assert.equal(await input.isEnabled(),enabled,`${i}:${key}`);assert.equal(await input.isVisible(),enabled);}
   for(let stage=0;stage<4;stage++){await inspect(stage);compare(await read(),i,[0,2,6,8][stage]);await frameMargin();assert.ok(await page.locator('.daily-readings>div').evaluateAll(ns=>ns.every(n=>n.querySelector('p')?.textContent.length>15)));}
   if([0,6,8,9,10,11,12,14,17].includes(i))await sceneShot({path:new URL(`scene-${width}-${i}.png`,evidence).pathname});
   assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));observations.push({width,preset:i,title:lesson.tryIt[i].title,readings:await read()});
  }
 }
 await page.setViewportSize({width:1440,height:1000});
 for(const i of [0,8,14]){
  await preset(i);await page.locator('[data-step]').click();compare(await read(),i,.08);await page.locator('[data-play]').click();await page.waitForFunction(()=>parseFloat([...document.querySelectorAll('.daily-readings>div')].find(n=>n.querySelector('dt').textContent==='Trace time').querySelector('dd').textContent)>.25);await page.locator('[data-play]').click();const held=await read();await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));assert.deepEqual(await read(),held);
  await inspect(0);await page.locator('[data-play]').click();await page.waitForFunction(()=>document.querySelector('[data-play]').getAttribute('aria-pressed')==='false',null,{timeout:20000});compare(await read(),i,8);await page.locator('[data-play]').click();await page.waitForFunction(()=>parseFloat([...document.querySelectorAll('.daily-readings>div')].find(n=>n.querySelector('dt').textContent==='Trace time').querySelector('dd').textContent)<1);await page.locator('[data-play]').click();
 }
 for(const i of [6,7,13,18]){await preset(i);await inspect(3);assert.equal(await page.locator('[data-result]').isDisabled(),true);}
 for(const i of [0,2,8,11,14,15]){await preset(i);await inspect(3);assert.equal(await page.locator('[data-result]').isEnabled(),true);await page.locator('[data-result]').click();await sceneShot({path:new URL(`result-${i}.png`,evidence).pathname});assert.match(await page.locator('.daily-part-detail h3').innerText(),/Intermediate real image|Enlarged TEM screen view|Raster image/);const pixels=await page.evaluate(()=>{document.querySelector('[data-result]').click();const c=document.querySelector('canvas'),copy=new OffscreenCanvas(c.width,c.height),ctx=copy.getContext('2d');ctx.drawImage(c,0,0);const data=ctx.getImageData(0,0,c.width,c.height).data;let gray=0;for(let p=0;p<data.length;p+=4)if(data[p+3]>0&&data[p]>30&&data[p]<240&&Math.abs(data[p]-data[p+1])<4&&Math.abs(data[p]-data[p+2])<4)gray++;return gray;});assert.ok(pixels>10000,'Result image must occupy a readable area: '+pixels);}
 await preset(0);await inspect(3);await page.locator('[data-result]').click();await sceneShot({path:new URL('image-closeup.png',evidence).pathname});
 await page.locator('[data-control="eyepiece"]').focus();await page.keyboard.press('ArrowRight');assert.equal(Number(await page.locator('[data-control="eyepiece"]').inputValue()),50);near((await read())['Relaxed-eye angular magnification'],-50);
 const before=await sceneShot();await page.locator('canvas').focus();await page.keyboard.press('ArrowRight');assert.ok(!before.equals(await sceneShot()));
 await page.getByRole('button',{name:'Reset experiment',exact:true}).click();compare(await read(),0,0);assert.deepEqual(errors,[]);
 const result={passed:true,url,presets:19,viewportWidths:[1440,390],presetStageChecks:152,playbackCases:3,errors,observations};await writeFile(new URL('results.json',evidence),JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify({...result,observations:observations.length}));
}finally{await browser.close();}

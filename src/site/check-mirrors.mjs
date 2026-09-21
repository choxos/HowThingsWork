import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {chromium} from 'playwright';
import {mirrorsLesson as lesson} from './mirrors-lesson.js';

// Independent scalar anchors, derived from reflection and finite-aperture geometry.
const convex=[[90.7276130483,29.8628343563,'Fully visible',2.9791671705],[60.010757582,29.8628343563,'Not visible',null],[105.0693731601,77.3196165082,'Fully visible',6.7712363163],[103.4167909594,43.6028189727,'Fully visible',4.2831771131],[103.4167909594,43.6028189727,'Partially visible',null],[73.2173184009,43.6028189727,'Not visible',null]];
const headlamp=[[1.6,0],[3.28544257498,24.75566207494],[.446269404106,17.08678401163],[1.6,0]];
const stages=['Inspect start (0%)','Inspect incident paths (33%)','Inspect reflections (67%)','Inspect full result (100%)'];
const times=[0,2.64,5.36,8];
const evidence=new URL(process.env.MIRRORS_EVIDENCE||'../../documentation/audit/evidence/mirrors/',import.meta.url);
await mkdir(evidence,{recursive:true});
const browser=await chromium.launch({headless:process.env.HEADED!=='1'});
const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[],observations=[];
page.setDefaultTimeout(10000);page.on('pageerror',e=>errors.push(e.message));
const sceneShot=async options=>{await page.mouse.move(0,0);await page.locator('canvas').evaluate(c=>c.scrollIntoView({block:'start',behavior:'instant'}));await page.waitForTimeout(150);return page.screenshot({...options,clip:await page.locator('canvas').boundingBox()});};
const frameMargin=async()=>{const b=await page.evaluate(()=>{document.querySelector('[data-control="mode"]').dispatchEvent(new Event('input',{bubbles:true}));const c=document.querySelector('canvas'),copy=new OffscreenCanvas(c.width,c.height),ctx=copy.getContext('2d');ctx.drawImage(c,0,0);const pixels=ctx.getImageData(0,0,c.width,c.height).data,b={width:c.width,height:c.height,left:c.width,right:0,top:c.height,bottom:0};for(let y=0;y<c.height;y++)for(let x=0;x<c.width;x++)if(pixels[(y*c.width+x)*4+3]>0){b.left=Math.min(b.left,x);b.right=Math.max(b.right,x);b.top=Math.min(b.top,y);b.bottom=Math.max(b.bottom,y);}return b;});assert.ok(b.right>b.left&&b.bottom>b.top,'actual scene rendered');assert.ok(Math.min(b.left,b.top,b.width-1-b.right,b.height-1-b.bottom)>=8,'complete scene has raster margins: '+JSON.stringify(b));return b;};
const read=()=>page.locator('.daily-readings > div').evaluateAll(ns=>Object.fromEntries(ns.map(n=>[n.querySelector('dt').textContent,n.querySelector('dd').textContent])));
const near=(a,b)=>assert.ok(Number.isFinite(parseFloat(a))&&Math.abs(parseFloat(a)-b)<.0050001,`${a} != ${b}`);
const tab=name=>page.getByRole('tab',{name,exact:true}).click();
const inspect=i=>page.getByRole('button',{name:stages[i],exact:true}).click();
async function preset(i){await tab('Try it yourself');await page.locator(`[data-experiment="${i}"]`).click();await tab('Controls');}
function compare(r,i,t){
 const v=lesson.tryIt[i].values;near(r['Trace time'],t);near(r['Trace progress'],t/8*100);assert.equal(Object.keys(r).length,[10,12,10,9][v.mode]);assert.ok(!Object.values(r).includes('Not applicable'));
 if(v.mode===0){near(r['Object distance'],v.distance);near(r['Image distance'],v.distance);near(r['Image height ratio'],1);assert.equal(r['Received rays'],`${[6,6,3][i]} / 6`);}
 if(v.mode===1){const e=convex[i-3];near(r['Convex field of view'],e[0]);near(r['Flat comparison field'],e[1]);assert.equal(r['Marker visibility'],e[2]);if(e[3]===null)assert.match(r['Apparent angular span'],/Unavailable/);else near(r['Apparent angular span'],e[3]);}
 if(v.mode===2){near(r['Screen footprint'],headlamp[i-9][0]);near(r['Reflected angular spread'],headlamp[i-9][1]);}
 if(v.mode===3){assert.equal(r['Received rays'],`${[3,0,0,1,0][i-13]} / 3`);assert.equal(r['Direct line'],'Blocked by the obstacle');}
 if(!r['Incident angle'].startsWith('Unavailable'))near(r['Reflected angle'],parseFloat(r['Incident angle']));
}
try{
 const url=process.env.MIRRORS_URL||new URL('#machine/mirrors',process.env.SITE_URL||'http://127.0.0.1:4177/').href;await page.goto(url,{waitUntil:'domcontentloaded'});await page.locator('[data-control="mode"]').waitFor({timeout:45000});
 assert.equal(await page.locator('h1').textContent(),'Mirrors');near((await read())['Trace time'],8);
 assert.equal(await page.locator('.daily-canvas-wrap').evaluate(n=>getComputedStyle(n).backgroundImage),'none');
 assert.equal(await page.locator('.daily-canvas-wrap').evaluate(n=>getComputedStyle(n).backgroundColor),'rgba(0, 0, 0, 0)');
 assert.equal(lesson.tryIt.length,18);await frameMargin();
 for(const width of [1440,390]){
  await page.setViewportSize({width,height:width===390?844:1000});
  if(width===390)assert.equal(await page.locator('.daily-canvas-wrap').evaluate(n=>getComputedStyle(n).backgroundColor),await page.evaluate(()=>getComputedStyle(document.body).backgroundColor),'Sticky phone scene covers the underlying controls with the page color');
  for(let i=0;i<18;i++){
   await preset(i);const v=lesson.tryIt[i].values;
   for(const [key,value] of Object.entries(v)){const c=page.locator(`[data-control="${key}"]`);assert.equal(Number(await c.inputValue()),value);const enabled=key==='mode'||(['distance','aperture'].includes(key)&&v.mode<2)||(key==='aperture'&&v.mode===2)||(key==='height'&&v.mode===0)||(['radius','bearing'].includes(key)&&v.mode===1)||(['focus','offset'].includes(key)&&v.mode===2)||(['upperTilt','secondMirror'].includes(key)&&v.mode===3)||(key==='lowerTilt'&&v.mode===3&&v.secondMirror===1);assert.equal(await c.isVisible(),enabled,'Only applicable controls are shown');assert.equal(await c.isEnabled(),enabled,`${i}:${key}`);}
   for(let stage=0;stage<4;stage++){await inspect(stage);compare(await read(),i,times[stage]);await frameMargin();}
   const r=await read();observations.push({width,preset:i,title:lesson.tryIt[i].title,readings:r});
   if([0,2,3,7,9,10,13,16,17].includes(i))await sceneShot({path:new URL(`browser-${width}-${i}.png`,evidence).pathname});
   assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'No horizontal overflow');
  }
 }
 await page.setViewportSize({width:1440,height:1000});
 for(const i of [0,3,9,13]){
  await preset(i);await page.locator('[data-step]').click();compare(await read(),i,.08);
  await page.locator('[data-play]').click();await page.waitForFunction(()=>parseFloat([...document.querySelectorAll('.daily-readings>div')].find(n=>n.querySelector('dt').textContent==='Trace time').querySelector('dd').textContent)>.25);
  await page.locator('[data-play]').click();const paused=await read();assert.ok(parseFloat(paused['Trace time'])<8);await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));assert.deepEqual(await read(),paused);
  await inspect(0);await page.locator('[data-play]').click();await page.waitForFunction(()=>document.querySelector('[data-play]').getAttribute('aria-pressed')==='false',null,{timeout:20000});compare(await read(),i,8);
  await page.locator('[data-play]').click();await page.waitForFunction(()=>parseFloat([...document.querySelectorAll('.daily-readings>div')].find(n=>n.querySelector('dt').textContent==='Trace time').querySelector('dd').textContent)<1);await page.locator('[data-play]').click();
 }
 await preset(0);await inspect(3);assert.equal(await page.locator('[data-part="screen"]').isDisabled(),true);assert.equal(await page.locator('[data-part="obstacle"]').isDisabled(),true);
 await inspect(0);const untraced=await sceneShot();await page.locator('[data-part="rays"]').click();const inspected=await sceneShot();assert.ok(untraced.equals(inspected),'Empty ray inspection preserves camera framing');
 await inspect(3);const held=await read();await page.getByRole('button',{name:'Show mirrors only',exact:true}).click();assert.deepEqual(await read(),held);await sceneShot({path:new URL('browser-mirror-only.png',evidence).pathname});await inspect(3);
 await page.locator('[data-control="height"]').focus();await page.keyboard.press('ArrowRight');assert.equal(Number(await page.locator('[data-control="height"]').inputValue()),.9);near((await read())['Trace time'],8);
 const before=await sceneShot();await page.locator('canvas').focus();await page.keyboard.press('ArrowRight');const after=await sceneShot();assert.ok(!before.equals(after),'3D rotation changes the rendered surface');
 await page.getByRole('button',{name:'Reset experiment',exact:true}).click();compare(await read(),0,0);
 assert.deepEqual(errors,[]);
 const result={passed:true,url,presets:18,viewportWidths:[1440,390],presetStageChecks:144,playbackModes:4,defaultReflections:true,transparentBackground:true,errors,observations};
 await writeFile(new URL(process.env.MIRRORS_REPORT||'browser-results.json',evidence),JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify({...result,observations:observations.length}));
}finally{await browser.close();}

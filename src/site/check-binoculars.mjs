import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {chromium} from 'playwright';
import {binocularsLesson as lesson} from './binoculars-lesson.js';
const evidence=new URL(process.env.BINOCULARS_EVIDENCE||'../../documentation/audit/evidence/binoculars/browser/',import.meta.url);await mkdir(evidence,{recursive:true});
const browser=await chromium.launch({headless:process.env.HEADED!=='1'}),page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[],observations=[];
page.setDefaultTimeout(10000);page.on('pageerror',e=>errors.push(e.message));
const sceneShot=async options=>{await page.mouse.move(0,0);await page.locator('canvas').evaluate(c=>c.scrollIntoView({block:'start',behavior:'instant'}));await page.waitForTimeout(150);return page.screenshot({...options,clip:await page.locator('canvas').boundingBox()});};
const frameMargin=async()=>{const b=await page.evaluate(()=>{document.querySelector('[data-control="mode"]').dispatchEvent(new Event('input',{bubbles:true}));const c=document.querySelector('canvas'),copy=new OffscreenCanvas(c.width,c.height),ctx=copy.getContext('2d');ctx.drawImage(c,0,0);const pixels=ctx.getImageData(0,0,c.width,c.height).data,b={width:c.width,height:c.height,left:c.width,right:0,top:c.height,bottom:0};for(let y=0;y<c.height;y++)for(let x=0;x<c.width;x++)if(pixels[(y*c.width+x)*4+3]>0){b.left=Math.min(b.left,x);b.right=Math.max(b.right,x);b.top=Math.min(b.top,y);b.bottom=Math.max(b.bottom,y);}return b;});assert.ok(b.right>b.left&&b.bottom>b.top,'actual scene rendered');assert.ok(Math.min(b.left,b.top,b.width-1-b.right,b.height-1-b.bottom)>=8,'complete scene has raster margins: '+JSON.stringify(b));return b;};
const read=()=>page.locator('.daily-readings>div').evaluateAll(ns=>Object.fromEntries(ns.map(n=>[n.querySelector('dt').textContent,n.querySelector('dd').textContent])));
const near=(a,b,digits=2)=>{const actual=Number.parseFloat(a.replaceAll(',',''));assert.equal(actual,Number(b.toFixed(digits)),`${a} must display rounded ${b}`);};
const stages=['Inspect start (0%)','Inspect quarter (25%)','Inspect three quarters (75%)','Inspect result (100%)'];
const inspect=i=>page.getByRole('button',{name:stages[i],exact:true}).click();
async function preset(i){await page.getByRole('tab',{name:'Try it yourself',exact:true}).click();await page.locator(`[data-experiment="${i}"]`).click();await page.getByRole('tab',{name:'Controls',exact:true}).click();}
function compare(r,i,time){
 const v=lesson.tryIt[i].values;near(r['Trace time'],time);near(r['Trace progress'],time/8*100);assert.equal(Object.keys(r).length,[15,9,6][v.mode]);assert.ok(!Object.values(r).includes('Not applicable'));
 if(v.mode===0){near(r['Nominal image x'],40*(-.5+v.objective/40-(1+4/v.index)));near(r['Reduced focusing distance'],40*(1+4/v.index));if(v.index===1.4){assert.equal(r['Received rays per channel'],'0 / 9');assert.equal(r['Paraxial magnification'],'Unavailable: light escapes before the image');}else{near(r['Paraxial magnification'],v.objective/v.eyepiece);assert.equal(r['Received rays per channel'],'9 / 9');near(r['Internal reflections'],4);assert.ok(r['Geometric spot span']==='<0.01 µm'||parseFloat(r['Geometric spot span'])>0);}}
 if(v.mode===1){near(r['Critical angle'],Math.asin(1/v.index)*180/Math.PI);if(v.angle===0&&v.index>=1.5){near(r['Internal reflections'],4);near(r['Glass travel'],160);near(r['Air travel to prism output'],40);near(r['Optical phase path'],160*v.index+40);}if(i===9)near(r['Internal reflections'],0);if(i===10)near(r['Internal reflections'],1);if(i===11){near(r['Internal reflections'],5);assert.match(r['Outcome'],/Extra side reflection/);}if(i===12)assert.match(r['Outcome'],/Missed finite/);}
 if(v.mode===2){const disparity=d=>2*Math.atan(v.baseline/(2000*d))*180/Math.PI;near(r['Near cat disparity'],disparity(v.distance),4);near(r['100 m reference disparity'],disparity(100),4);near(r['Relative depth disparity'],disparity(v.distance)-disparity(100),4);}
}
try{
 const url=process.env.BINOCULARS_URL||new URL('#machine/binoculars',process.env.SITE_URL||'http://127.0.0.1:5193/').href;await page.goto(url,{waitUntil:'domcontentloaded',timeout:45000});await page.locator('[data-control="mode"]').waitFor({timeout:45000});assert.equal(await page.locator('h1').textContent(),'Binoculars');near((await read())['Trace time'],8);
 assert.equal(await page.locator('.daily-canvas-wrap').evaluate(n=>getComputedStyle(n).backgroundImage),'none');
 for(const width of [1440,390]){
  await page.setViewportSize({width,height:width===390?844:1000});
  if(width===390)assert.equal(await page.locator('.daily-canvas-wrap').evaluate(n=>getComputedStyle(n).backgroundColor),await page.evaluate(()=>getComputedStyle(document.body).backgroundColor));
  for(let i=0;i<lesson.tryIt.length;i++){
   await preset(i);const v=lesson.tryIt[i].values;
   for(const [key,value] of Object.entries(v)){const input=page.locator(`[data-control="${key}"]`);assert.equal(Number(await input.inputValue()),value);const enabled=key==='mode'||(key==='index'?v.mode<2:key==='angle'?v.mode===1:['baseline','distance'].includes(key)?v.mode===2:v.mode===0);assert.equal(await input.isEnabled(),enabled,`${i}:${key}`);assert.equal(await input.isVisible(),enabled);}
   for(let stage=0;stage<4;stage++){await inspect(stage);compare(await read(),i,[0,2,6,8][stage]);await frameMargin();}
   if([0,6,8,9,10,11,12,14,17].includes(i))await sceneShot({path:new URL(`scene-${width}-${i}.png`,evidence).pathname});
   assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));observations.push({width,preset:i,title:lesson.tryIt[i].title,readings:await read()});
  }
 }
 await page.setViewportSize({width:1440,height:1000});
 for(const i of [0,8,14]){
  await preset(i);await page.locator('[data-step]').click();compare(await read(),i,.08);await page.locator('[data-play]').click();await page.waitForFunction(()=>parseFloat([...document.querySelectorAll('.daily-readings>div')].find(n=>n.querySelector('dt').textContent==='Trace time').querySelector('dd').textContent)>.25);await page.locator('[data-play]').click();const held=await read();await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));assert.deepEqual(await read(),held);
  await inspect(0);await page.locator('[data-play]').click();await page.waitForFunction(()=>document.querySelector('[data-play]').getAttribute('aria-pressed')==='false',null,{timeout:20000});compare(await read(),i,8);await page.locator('[data-play]').click();await page.waitForFunction(()=>parseFloat([...document.querySelectorAll('.daily-readings>div')].find(n=>n.querySelector('dt').textContent==='Trace time').querySelector('dd').textContent)<1);await page.locator('[data-play]').click();
 }
 await preset(6);await inspect(3);assert.equal(await page.locator('[data-result]').isDisabled(),true);
 await preset(0);await inspect(3);await page.locator('[data-result]').click();
 const imagePixels=await page.evaluate(()=>{const c=document.querySelector('canvas'),copy=new OffscreenCanvas(c.width,c.height),ctx=copy.getContext('2d');ctx.drawImage(c,0,0);const pixels=ctx.getImageData(0,0,c.width,c.height).data;let count=0;for(let i=0;i<pixels.length;i+=4)if(pixels[i+3]>0&&pixels[i]>1.4*pixels[i+1]&&pixels[i+1]>1.3*pixels[i+2])count++;return count;});
 assert.ok(imagePixels>1500,'Real-image inspection must show a recognizable cat, not an edge-on speck: '+imagePixels);
 await sceneShot({path:new URL('image-closeup.png',evidence).pathname});
 await page.locator('[data-control="eyepiece"]').focus();await page.keyboard.press('ArrowRight');assert.equal(Number(await page.locator('[data-control="eyepiece"]').inputValue()),50);near((await read())['Paraxial magnification'],4);
 const before=await sceneShot();await page.locator('canvas').focus();await page.keyboard.press('ArrowRight');assert.ok(!before.equals(await sceneShot()));
 await page.getByRole('button',{name:'Reset experiment',exact:true}).click();compare(await read(),0,0);assert.deepEqual(errors,[]);
 const result={passed:true,url,presets:19,viewportWidths:[1440,390],presetStageChecks:152,playbackCases:3,errors,observations};await writeFile(new URL('results.json',evidence),JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify({...result,observations:observations.length}));
}finally{await browser.close();}

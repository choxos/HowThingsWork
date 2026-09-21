import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {chromium} from 'playwright';
import {lensesLesson as lesson} from './lenses-lesson.js';
const evidence=new URL(process.env.LENSES_EVIDENCE||'../../documentation/audit/evidence/lenses/browser/',import.meta.url);await mkdir(evidence,{recursive:true});
const browser=await chromium.launch({headless:process.env.HEADED!=='1'}),page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[],observations=[];
page.setDefaultTimeout(10000);page.on('pageerror',e=>errors.push(e.message));
const sceneShot=async options=>{await page.mouse.move(0,0);await page.locator('canvas').evaluate(c=>c.scrollIntoView({block:'start',behavior:'instant'}));await page.waitForTimeout(150);return page.screenshot({...options,clip:await page.locator('canvas').boundingBox()});};
const frameMargin=async()=>{const b=await page.evaluate(()=>{document.querySelector('[data-control="mode"]').dispatchEvent(new Event('input',{bubbles:true}));const c=document.querySelector('canvas'),copy=new OffscreenCanvas(c.width,c.height),ctx=copy.getContext('2d');ctx.drawImage(c,0,0);const pixels=ctx.getImageData(0,0,c.width,c.height).data,b={width:c.width,height:c.height,left:c.width,right:0,top:c.height,bottom:0};for(let y=0;y<c.height;y++)for(let x=0;x<c.width;x++)if(pixels[(y*c.width+x)*4+3]>0){b.left=Math.min(b.left,x);b.right=Math.max(b.right,x);b.top=Math.min(b.top,y);b.bottom=Math.max(b.bottom,y);}return b;});assert.ok(b.right>b.left&&b.bottom>b.top,'actual scene rendered');assert.ok(Math.min(b.left,b.top,b.width-1-b.right,b.height-1-b.bottom)>=8,'complete scene has raster margins: '+JSON.stringify(b));return b;};
const read=()=>page.locator('.daily-readings>div').evaluateAll(ns=>Object.fromEntries(ns.map(n=>[n.querySelector('dt').textContent,n.querySelector('dd').textContent])));
const near=(a,b)=>assert.ok(Number.isFinite(parseFloat(a))&&Math.abs(parseFloat(a)-b)<.0050001,`${a} != ${b}`);
const stages=['Inspect start (0%)','Inspect first lens (25%)','Inspect transmitted rays (75%)','Inspect full image (100%)'];
const inspect=i=>page.getByRole('button',{name:stages[i],exact:true}).click();
async function preset(i){await page.getByRole('tab',{name:'Try it yourself',exact:true}).click();await page.locator(`[data-experiment="${i}"]`).click();await page.getByRole('tab',{name:'Controls',exact:true}).click();}
function compare(r,i,time){
 const v=lesson.tryIt[i].values;near(r['Trace time'],time);near(r['Trace progress'],time/8*100);const virtual=v.mode===1||(v.mode===0&&v.distance<1),focusedZoom=v.mode===2&&(v.compensate===1||v.zoom===0);assert.equal(Object.keys(r).length,v.mode===2?(focusedZoom?18:17):virtual?11:13);assert.ok(!Object.values(r).includes('Not applicable'));assert.equal(Object.hasOwn(r,'Effective focal length'),focusedZoom);
 if(v.mode<2){const f=v.mode===1?-v.focal:v.focal,d=v.focal*v.distance;near(r['Object distance'],d);near(r['Focal length'],f);if(v.mode===0&&v.distance===1){assert.equal(r['Image kind'],'At infinity');assert.equal(r['Image position'],'At infinity');assert.equal(r['Signed magnification'],'No finite image');assert.equal(r['Image height'],'No finite image');}else{const di=f*d/(d-f),mag=-f/(d-f);near(r['Image position'],di);near(r['Signed magnification'],mag);near(r['Image height'],Math.abs(mag)*v.height);assert.equal(r['Image kind'],di<0?'Virtual, upright':'Real, inverted');if(di>0){near(r['Screen / sensor position'],di+v.screenOffset*v.focal);near(r['Point-bundle blur'],2*v.aperture*Math.abs(1-(di+v.screenOffset*v.focal)/di));}}}
 else{near(r['Screen / sensor position'],5);near(r['Rear lens position'],3);near(r['Front lens position'],.5-v.zoom/100);if(v.compensate){const anchors={0:[2.073453021693376,-.26954418474447345,14.314127274927122],50:[2.158405001205337,-.3889571440050832,10.770621271691219],100:[2.288218227904235,-.5980202532269295,7.653327761420592]}[v.zoom];near(r['Image position'],5);near(r['Middle lens position'],anchors[0]);near(r['Signed magnification'],anchors[1]);near(r['Field of view'],anchors[2]);near(r['Point-bundle blur'],0);near(r['Sensor height coverage'],Math.min(100,44/(Math.abs(anchors[1])*v.height)));}else{near(r['Middle lens position'],2.073453021693376);assert.ok(Math.abs(parseFloat(r['Image position'])-5)>.01);assert.ok(parseFloat(r['Point-bundle blur'])>.01);assert.equal(r['Field of view'],'Unavailable: sensor out of focus');assert.equal(r['Sensor height coverage'],'Unavailable: sensor out of focus');}}
 if(i===21)assert.equal(r['Received sample rays'],'3 / 9');
}
try{
 const url=process.env.LENSES_URL||new URL('#machine/lenses',process.env.SITE_URL||'http://127.0.0.1:5193/').href;await page.goto(url,{waitUntil:'domcontentloaded',timeout:45000});await page.locator('[data-control="mode"]').waitFor({timeout:45000});assert.equal(await page.locator('h1').textContent(),'Lenses');near((await read())['Trace time'],8);await frameMargin();
 assert.equal(await page.locator('.daily-canvas-wrap').evaluate(n=>getComputedStyle(n).backgroundImage),'none');
 for(const width of [1440,390]){
  await page.setViewportSize({width,height:width===390?844:1000});
  if(width===390)assert.equal(await page.locator('.daily-canvas-wrap').evaluate(n=>getComputedStyle(n).backgroundColor),await page.evaluate(()=>getComputedStyle(document.body).backgroundColor));
  for(let i=0;i<lesson.tryIt.length;i++){
   await preset(i);const v=lesson.tryIt[i].values;
   for(const [key,value] of Object.entries(v)){const input=page.locator(`[data-control="${key}"]`);assert.equal(Number(await input.inputValue()),value);const enabled=['mode','height','aperture'].includes(key)||(['focal','distance'].includes(key)&&v.mode<2)||(key==='screenOffset'&&v.mode===0&&v.distance>=1)||(['zoom','compensate'].includes(key)&&v.mode===2);assert.equal(await input.isVisible(),enabled,'Only applicable controls are shown');assert.equal(await input.isEnabled(),enabled,`${i}:${key}`);}
   for(let stage=0;stage<4;stage++){await inspect(stage);compare(await read(),i,[0,2,6,8][stage]);await frameMargin();}
   if([0,3,4,6,10,13,14,16,19,21].includes(i))await sceneShot({path:new URL(`scene-${width}-${i}.png`,evidence).pathname});
   assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));observations.push({width,preset:i,title:lesson.tryIt[i].title,readings:await read()});
  }
 }
 await page.setViewportSize({width:1440,height:1000});
 for(const i of [0,4,6,13]){
  await preset(i);await page.locator('[data-step]').click();compare(await read(),i,.08);await page.locator('[data-play]').click();await page.waitForFunction(()=>parseFloat([...document.querySelectorAll('.daily-readings>div')].find(n=>n.querySelector('dt').textContent==='Trace time').querySelector('dd').textContent)>.25);await page.locator('[data-play]').click();const held=await read();await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));assert.deepEqual(await read(),held);
  await inspect(0);await page.locator('[data-play]').click();await page.waitForFunction(()=>document.querySelector('[data-play]').getAttribute('aria-pressed')==='false',null,{timeout:20000});compare(await read(),i,8);await page.locator('[data-play]').click();await page.waitForFunction(()=>parseFloat([...document.querySelectorAll('.daily-readings>div')].find(n=>n.querySelector('dt').textContent==='Trace time').querySelector('dd').textContent)<1);await page.locator('[data-play]').click();
 }
 // Reset must restore temporary isolation before the model changes its cached geometry.
 await preset(0);await inspect(3);await page.getByRole('button',{name:'Inspect lens shapes',exact:true}).click();await page.locator('[data-isolate]').check();const singleLens=await sceneShot();
 await preset(19);await inspect(3);await page.locator('[data-result]').click();await page.locator('[data-isolate]').check();await page.getByRole('button',{name:'Reset experiment',exact:true}).click();await page.getByRole('button',{name:'Inspect lens shapes',exact:true}).click();await page.locator('[data-isolate]').check();const resetLens=await sceneShot({path:new URL('reset-lens-shape.png',evidence).pathname});
 assert.ok(singleLens.equals(resetLens),'Reset from isolated zoom result restores the one-lens shape');
 await preset(3);await inspect(3);assert.equal(await page.locator('[data-result]').isDisabled(),true);await page.locator('[data-part="result"]').click();assert.equal(await page.locator('[data-part="image"]').isDisabled(),true);
 await preset(0);await inspect(3);await page.locator('[data-result]').click();await sceneShot({path:new URL('image-closeup.png',evidence).pathname});
 await page.locator('[data-control="height"]').focus();await page.keyboard.press('ArrowRight');assert.equal(Number(await page.locator('[data-control="height"]').inputValue()),.9);near((await read())['Image height'],.9);
 const before=await sceneShot();await page.locator('canvas').focus();await page.keyboard.press('ArrowRight');assert.ok(!before.equals(await sceneShot()));
 await page.getByRole('button',{name:'Reset experiment',exact:true}).click();compare(await read(),0,0);assert.deepEqual(errors,[]);
 const result={passed:true,url,presets:22,viewportWidths:[1440,390],presetStageChecks:176,playbackCases:4,errors,observations};await writeFile(new URL('results.json',evidence),JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify({...result,observations:observations.length}));
}finally{await browser.close();}

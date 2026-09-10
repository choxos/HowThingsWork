import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
const base=process.env.SITE_URL||'http://127.0.0.1:5175/';
const output='/tmp/howthingswork-house-entry';
await mkdir(output,{recursive:true});
const browser=await chromium.launch({headless:true}),errors=[],results=[];
try {
 for(const width of [1440,1600,900,390]){
  const page=await browser.newPage({viewport:{width,height:1000}});
  page.on('pageerror',error=>errors.push(error.message));
  await page.goto(`${base}#neighborhood`);await page.locator('.zoom-exterior a').first().waitFor();
  await page.evaluate(()=>document.fonts.ready);
  await page.screenshot({path:`${output}/${width}-before.png`,fullPage:true});
  await page.evaluate(()=>{
   window.samples=[];
   function sample(){
    const scene=document.querySelector('.zoom-scene'),intro=document.querySelector('.plan-intro'),image=scene?.querySelector('.room-background,.house-zoom-layer>img');
    if(scene&&intro){const rect=el=>{const b=el.getBoundingClientRect();return {x:b.x,y:b.y,width:b.width,height:b.height};};window.samples.push({scene:rect(scene),intro:rect(intro),image:image&&rect(image),home:!!document.querySelector('.house-map'),ready:!!image?.complete&&!!image?.naturalWidth,opacity:document.querySelector('.zoom-interior')?.style.opacity,transform:document.querySelector('.zoom-interior')?.style.transform,overlays:document.querySelectorAll('.zoom-object').length,title:intro.querySelector('h1').textContent});}
    if(!window.stopSampling)requestAnimationFrame(sample);
   }sample();
  });
  await page.locator('[data-place="home"]').click();
  await page.waitForTimeout(400);
  await page.screenshot({path:`${output}/${width}-during.png`,fullPage:true});
  await page.locator('.house-room-pin').first().waitFor();
  await page.waitForTimeout(220);
  await page.screenshot({path:`${output}/${width}-after.png`,fullPage:true});
  const samples=await page.evaluate(()=>{window.stopSampling=true;return window.samples;});
  const final=samples.find(s=>s.home),previous=samples.slice(0,samples.indexOf(final)).at(-1);
  assert.ok(previous&&final,'Both sides of handoff sampled');
  for(const sample of samples){assert.equal(sample.overlays,0,'No home machine overlays');for(const key of ['x','y','width','height'])assert.ok(Math.abs(sample.scene[key]-samples[0].scene[key])<=1,`${width}: scene ${key} moved`);}
  for(const key of ['x','y','width','height'])assert.ok(Math.abs(previous.image[key]-final.image[key])<=1,`${width}: image ${key} moved at handoff`);
  for(const key of ['x','y','width','height'])assert.ok(Math.abs(previous.intro[key]-final.intro[key])<=1,`${width}: intro ${key} moved at handoff`);
  assert.equal(previous.opacity,'1');assert.match(previous.transform,/scale\(1\)/);assert.ok(final.ready);assert.equal(final.title,'The house');
  assert.equal(await page.locator('.house-room-pin').count(),10);
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
  await page.locator('.house-room-pin').first().click();await page.waitForURL('**#room/doors-and-daily-life');await page.locator('.house-hall').waitFor();
  await page.goBack();await page.locator('.house-map').waitFor();
  const direct=await page.locator('.house-map').boundingBox();
  await page.goto(`${base}#place/home`);await page.locator('.house-map').waitFor();assert.deepEqual(await page.locator('.house-map').boundingBox(),direct);
  await writeFile(`${output}/${width}-frames.json`,JSON.stringify(samples,null,2));results.push({width,frames:samples.length});await page.close();
 }
 for(const input of ['keyboard','wheel','reduced','cancel','slow']){
  const page=await browser.newPage({viewport:{width:1440,height:1000},reducedMotion:input==='reduced'?'reduce':'no-preference'});page.on('pageerror',error=>errors.push(error.message));
  if(input==='slow')await page.route('**/house.js',async route=>{await new Promise(resolve=>setTimeout(resolve,1000));await route.continue();});
  await page.goto(`${base}#neighborhood`);await page.locator('[data-place="home"]').waitFor();
  if(input==='wheel'){await page.locator('[data-place="home"]').hover();for(let i=0;i<7;i++)await page.mouse.wheel(0,-100);}
  else if(input==='keyboard'){await page.locator('.zoom-scene').focus();await page.keyboard.press('+');}
  else {await page.locator('[data-place="home"]').click();}
  if(input==='cancel'){await page.waitForTimeout(200);await page.evaluate(()=>location.hash='list');await page.waitForTimeout(1000);assert.match(page.url(),/#list$/);assert.equal(await page.locator('.house-map').count(),0);}
  else {await page.locator('.house-map').waitFor();assert.ok(await page.locator('.house-map .house-zoom-layer>img').evaluate(img=>img.complete&&img.naturalWidth>0));}
  results.push({input});await page.close();
 }
 for(const width of [1440,900,390]){
  const page=await browser.newPage({viewport:{width,height:844}});page.on('pageerror',error=>errors.push(error.message));
  for(let room=0;room<10;room++){
   await page.goto(`${base}#place/home`);await page.locator('.house-room-pin').first().waitFor();await page.evaluate(()=>document.fonts.ready);
   await page.getByRole('combobox',{name:'Look toward'}).selectOption(String(room));
   const pin=page.locator('.house-room-pin').nth(room);
   const hash=await pin.getAttribute('href');await pin.scrollIntoViewIfNeeded();
   await page.evaluate(()=>{window.roomSamples=[];window.roomSampling=true;function sample(){const scene=document.querySelector('.zoom-scene');if(scene){const b=scene.getBoundingClientRect();window.roomSamples.push({x:b.x,y:b.y,width:b.width,height:b.height,intro:!!document.querySelector('.plan-intro'),room:!!document.querySelector('.house-room-frame'),opacity:document.querySelector('.house-room-preview')&&getComputedStyle(document.querySelector('.house-room-preview')).opacity});}if(window.roomSampling)requestAnimationFrame(sample);}sample();});
   await pin.click();
   if(room<2){await page.waitForTimeout(70);await page.screenshot({path:`${output}/${width}-room-${room}-during.png`});}
   await page.waitForURL(`**${hash}`);await page.locator('.house-room-frame').waitFor();
   await page.waitForTimeout(50);
   const samples=await page.evaluate(()=>{window.roomSampling=false;return window.roomSamples;});
   assert.ok(samples.some(s=>!s.room)&&samples.some(s=>s.room));
   for(const sample of samples){assert.ok(sample.intro);for(const key of ['x','y','width','height'])assert.ok(Math.abs(sample[key]-samples[0][key])<=1,`${width} room ${room}: ${key} shifted`);}
   assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
   if(room<2){await page.screenshot({path:`${output}/${width}-room-${room}.png`,fullPage:true});await writeFile(`${output}/${width}-room-${room}-frames.json`,JSON.stringify(samples,null,2));}
   await page.getByRole('button',{name:'Zoom out',exact:true}).click();await page.waitForURL('**#place/home');await page.locator('.house-map').waitFor();
  }
  results.push({roomWidth:width,rooms:10});await page.close();
 }
 for(const mode of ['reduce','interrupt','slow-image']){
  const page=await browser.newPage({reducedMotion:mode==='reduce'?'reduce':'no-preference'});page.on('pageerror',error=>errors.push(error.message));
  if(mode==='slow-image')await page.route('**/entrance-hall.png',async route=>{await new Promise(resolve=>setTimeout(resolve,600));await route.continue();});
  await page.goto(`${base}#place/home`);await page.locator('.house-room-pin').first().waitFor();
  await page.getByRole('button',{name:'Zoom in',exact:true}).click();
  if(mode==='interrupt'){await page.evaluate(()=>location.hash='list');await page.waitForTimeout(500);assert.match(page.url(),/#list$/);}
  else {await page.locator('.house-room-frame').waitFor();assert.ok(await page.locator('.house-hall>img').evaluate(image=>image.complete&&image.naturalWidth>0));}
  await page.close();
 }
 {
  const page=await browser.newPage();page.on('pageerror',error=>errors.push(error.message));
  await page.route('**/house-rooms.png',async route=>{await new Promise(resolve=>setTimeout(resolve,700));await route.continue();});
  await page.goto(`${base}#place/home`);await page.locator('.house-room-pin').first().waitFor();
  await page.locator('.house-room-pin').nth(1).click();await page.locator('.house-room-pin').nth(3).hover();
  await page.waitForURL('**#room/kitchen');await page.locator('.house-room-frame').waitFor();
  await page.close();results.push({slowClickHover:'passed'});
 }
 {
  const page=await browser.newPage();page.on('pageerror',error=>errors.push(error.message));
  await page.goto(`${base}#place/home`);await page.locator('.house-room-pin').first().waitFor();
  await page.setViewportSize({width:390,height:844});
  await page.locator('.house-directory summary').click();await page.locator('.house-room-card[href="#room/kitchen"]').click();await page.locator('.house-room-frame').waitFor();
  assert.equal(await page.evaluate(()=>scrollY),0,'Ordinary directory navigation starts at the top of the room');
  assert.equal(await page.locator('.house-room-frame .house-room-backdrop').count(),1,'Directory Kitchen must retain its own backdrop');
  assert.equal(await page.locator('.house-room-frame img[src*="entrance-hall"]').count(),0,'An unchosen hall preview must not replace Kitchen');
  await page.goto(`${base}#neighborhood`);await page.locator('[data-place="workshop"]').click();await page.waitForFunction(()=>document.querySelector('.zoom-scene')?.dataset.stage==='place');
  await page.locator('.directory-item[href="#place/home"]').click();await page.locator('.house-map').waitFor();
  assert.match(await page.locator('.house-map .house-zoom-layer>img').getAttribute('src'), /house-interior(?:-[\w-]+)?\.png$/, 'House must not reuse workshop image');
  await page.close();results.push({directRouteBackdrop:'passed'});
 }
 assert.deepEqual(errors,[]);console.log('PASS: stable scene and intro frames, loaded image, no overlays, ten pins, room/back/direct routes, keyboard, wheel, reduced motion, cancellation and delayed import.',results);
}finally{await browser.close();}

import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {chromium} from 'playwright';
import {scaleCalibratingPlateLesson as lesson} from './scale-calibrating-plate-lesson.js';
const evidence=new URL(process.env.SCALE_CALIBRATING_PLATE_EVIDENCE||'../../documentation/audit/evidence/scale-calibrating-plate/browser/',import.meta.url);await mkdir(evidence,{recursive:true});
const browser=await chromium.launch({headless:process.env.HEADED!=='1'}),page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[],observations=[];
page.setDefaultTimeout(10000);page.on('pageerror',e=>errors.push(e.message));
const sceneShot=async options=>{await page.mouse.move(0,0);await page.locator('canvas').evaluate(c=>c.scrollIntoView({block:'start',behavior:'instant'}));await page.waitForTimeout(150);return page.screenshot({...options,clip:await page.locator('canvas').boundingBox()});};
const frameMargin=async()=>{const b=await page.evaluate(()=>{document.querySelector('[data-control="stiffness"]').dispatchEvent(new Event('input',{bubbles:true}));const c=document.querySelector('canvas'),copy=new OffscreenCanvas(c.width,c.height),ctx=copy.getContext('2d');ctx.drawImage(c,0,0);const pixels=ctx.getImageData(0,0,c.width,c.height).data,b={width:c.width,height:c.height,left:c.width,right:0,top:c.height,bottom:0};for(let y=0;y<c.height;y++)for(let x=0;x<c.width;x++)if(pixels[(y*c.width+x)*4+3]>0){b.left=Math.min(b.left,x);b.right=Math.max(b.right,x);b.top=Math.min(b.top,y);b.bottom=Math.max(b.bottom,y);}return b;});assert.ok(b.right>b.left&&b.bottom>b.top,'actual scene rendered');assert.ok(Math.min(b.left,b.top,b.width-1-b.right,b.height-1-b.bottom)>=8,'complete scene has raster margins: '+JSON.stringify(b));return b;};
const read=()=>page.locator('.daily-readings>div').evaluateAll(ns=>Object.fromEntries(ns.map(n=>[n.querySelector('dt').textContent,n.querySelector('dd').textContent])));
const near=(a,b,digits=2)=>assert.equal(parseFloat(a),Number(b.toFixed(digits))||0,`${a} must display rounded ${b}`);
const stages=['Inspect start (0%)','Inspect quarter (25%)','Inspect three quarters (75%)','Inspect result (100%)'];
const inspect=i=>page.getByRole('button',{name:stages[i],exact:true}).click();
async function preset(i){await page.getByRole('tab',{name:'Try it yourself',exact:true}).click();await page.locator(`[data-experiment="${i}"]`).click();await page.getByRole('tab',{name:'Controls',exact:true}).click();}
// Independent full-load calibration and work references, without the production sampler.
const loadedReadings=[60,0,120,60,60,65,89.97002997002997,9.908256880733944];
function compare(r,i,t){
 const v=lesson.tryIt[i].values,g=[9.81,1.62,3.71][v.gravity],p=t<2?t/2:t>6?(8-t)/2:1,f=p*p*(3-2*p),W=v.mass*g*f,K=v.stiffness+20,x=W/(4*K),q=x/4,travel=2*x,net=.5*K*x*x,peak=(v.mass*g)**2/(32*K),loading=t<2?net:peak,returned=t<=6?0:peak-net;
 near(r['Trial time'],t);near(r['Transferred weight force'],W);near(r['Operator support'],v.mass*g-W);near(r['Load transferred'],f*100,1);near(r['Indicated mass'],(loadedReadings[i]-v.zero)*f+v.zero);near(r['Each left support force'],W*(1-v.position)/4);near(r['Each right support force'],W*(1+v.position)/4);near(r['Plate travel'],x*1000,3);near(r['Platform travel'],q*1000,3);near(r['Rack travel'],travel*1000,3);near(r['Main spring tension'],1+v.stiffness*x);near(r['Dial spring tension'],.5-5*travel,3);near(r['Loading work supplied'],loading,3);near(r['Work returned on unloading'],returned,3);near(r['Net input work'],net,3);near(r['Main spring energy change'],x+.5*v.stiffness*x*x,3);near(r['Dial spring energy change'],-.5*travel+2.5*travel*travel,3);near(r['Combined lever output'],W/4);near(r['Dial force on plate'],1-20*x,3);near(r['Zero-carriage shift'],-v.zero*2*9.81/(4*30020)*1000,3);
 const dialForce=1-20*x,plateHalf=.105-.105/Math.hypot(.105,.09)*Math.sqrt(.115**2-x*x),followerX=.025-Math.sqrt(.025**2-x*x),coupleZ=W/4*v.position*plateHalf+dialForce*followerX,coupleX=-.02*dialForce;near(r['Plate-guide lateral couple'],coupleZ,3);near(r['Plate-guide fore/aft couple'],coupleX,3);near(r['Plate-guide couple magnitude'],Math.hypot(coupleX,coupleZ),3);for(const [j,name] of ['Left-front','Left-back','Right-front','Right-back'].entries())near(r[name+' plate force'],W*(1+(j<2?-1:1)*v.position)/16);assert.match(r['Plate force arrows'],/Orange.*Green.*Blue/);assert.equal(Object.keys(r).length,29);
}
try{
 const url=process.env.SCALE_CALIBRATING_PLATE_URL||new URL('#machine/scale-calibrating-plate',process.env.SITE_URL||'http://127.0.0.1:5193/').href;await page.goto(url,{waitUntil:'domcontentloaded',timeout:45000});await page.locator('[data-control="stiffness"]').waitFor({timeout:45000});assert.equal(await page.locator('h1').textContent(),'Scale calibrating plate');compare(await read(),0,0);assert.equal(await page.locator('[data-cutaway]').isChecked(),true);
 for(const width of [1440,390]){
  await page.setViewportSize({width,height:width===390?844:1000});
  for(let i=0;i<lesson.tryIt.length;i++){
   await preset(i);for(const [key,value] of Object.entries(lesson.tryIt[i].values)){const input=page.locator(`[data-control="${key}"]`);assert.equal(Number(await input.inputValue()),value);assert.equal(await input.isEnabled(),true);}
   for(let stage=0;stage<4;stage++){await inspect(stage);compare(await read(),i,[0,2,6,8][stage]);assert.ok(await page.locator('.daily-readings>div').evaluateAll(ns=>ns.every(n=>n.querySelector('p')?.textContent.length>15)));}
   await inspect(1);await sceneShot({path:new URL(`loaded-scene-${width}-${i}.png`,evidence).pathname});await inspect(3);
   assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));observations.push({width,preset:i,title:lesson.tryIt[i].title,readings:await read()});
  }
 }
 await page.setViewportSize({width:1440,height:1000});
 for(const i of [0,6,7]){
  await preset(i);await page.locator('[data-step]').click();compare(await read(),i,.08);await page.locator('[data-play]').click();await page.waitForFunction(()=>parseFloat([...document.querySelectorAll('.daily-readings>div')].find(n=>n.querySelector('dt').textContent==='Trial time').querySelector('dd').textContent)>.3);await page.locator('[data-play]').click();const held=await read();await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));assert.deepEqual(await read(),held);
  await inspect(2);await page.locator('[data-play]').click();await page.waitForFunction(()=>document.querySelector('[data-play]').getAttribute('aria-pressed')==='false',null,{timeout:12000});compare(await read(),i,8);await page.locator('[data-play]').click();await page.waitForFunction(()=>parseFloat([...document.querySelectorAll('.daily-readings>div')].find(n=>n.querySelector('dt').textContent==='Trial time').querySelector('dd').textContent)<1);await page.locator('[data-play]').click();for(const [key,value] of Object.entries(lesson.tryIt[i].values))assert.equal(Number(await page.locator('[data-control="'+key+'"]').inputValue()),value,'Replay retains the configured trial');
 }
 for(const [key,value,i] of [['mass','120',2],['position','-0.75',3],['position','0.75',4],['zero','5',5],['stiffness','20000',6],['gravity','1',7]]){
  await preset(0);await inspect(1);const control=page.locator(`[data-control="${key}"]`);if(key==='gravity')await control.selectOption(value);else await control.fill(value);compare(await read(),i,2);assert.equal(await page.locator('.daily-part-detail h3').textContent(),'Load-carrying calibrating plate');
 }
 await page.locator('[data-answer="1"]').click();assert.match(await page.locator('.daily-answer').textContent(),/Try thinking/);await page.locator('[data-answer="0"]').click();assert.match(await page.locator('.daily-answer').textContent(),/That’s right/);
 await preset(0);await inspect(3);await page.locator('[data-result]').click();assert.equal(await page.locator('.daily-part-detail h3').textContent(),'Load-carrying calibrating plate');await sceneShot({path:new URL('plate-inspection.png',evidence).pathname});
 await page.locator('[data-control="mass"]').focus();await page.keyboard.press('ArrowLeft');assert.equal(Number(await page.locator('[data-control="mass"]').inputValue()),55);
 await page.getByRole('button',{name:'Reset experiment',exact:true}).click();compare(await read(),0,0);const before=await sceneShot();await page.locator('canvas').focus();await page.keyboard.press('ArrowRight');assert.ok(!before.equals(await sceneShot()));
 const held=await read(),route=page.url();await page.locator('[data-separation]').fill('100');await page.locator('[data-separation]').dispatchEvent('input');await page.waitForTimeout(800);assert.equal(page.url(),route);assert.deepEqual(await read(),held);await sceneShot({path:new URL('grouped-parts.png',evidence).pathname});await page.locator('[data-reassemble]').click();await page.waitForTimeout(800);assert.deepEqual(await read(),held);assert.equal(await page.locator('[data-separation]').inputValue(),'0');assert.deepEqual(errors,[]);
 let nestedRoomLink=false;
 if(new URL(url).hash.startsWith('#machine/')){
  await page.getByRole('button',{name:'Back to room',exact:true}).click();await page.waitForURL('**/#room/measuring-and-time');await page.getByRole('heading',{name:'Measuring and time',exact:true}).waitFor();await page.getByText('Browse every object',{exact:true}).click();
  const family=page.locator('article.house-object[data-machine="bathroom-scale"]'),link=family.locator('.house-component-links a[href="#machine/scale-calibrating-plate"]');assert.equal(await link.count(),1);assert.equal(await page.locator('article.house-object[data-machine="scale-calibrating-plate"]').count(),0);assert.ok(await family.evaluate(el=>parseFloat(getComputedStyle(el.querySelector('.house-component-links a')).fontSize)<parseFloat(getComputedStyle(el.querySelector('h2')).fontSize)));
  await link.click();await page.locator('[data-control="stiffness"]').waitFor();compare(await read(),0,0);nestedRoomLink=true;
 }
 assert.deepEqual(errors,[]);const result={passed:true,url,presets:lesson.tryIt.length,viewportWidths:[1440,390],presetStageChecks:lesson.tryIt.length*8,playbackCases:3,directControls:5,directControlCases:6,quizFeedback:true,nestedRoomLink,errors,observations};await writeFile(new URL('results.json',evidence),JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify({...result,observations:observations.length}));
}finally{await browser.close();}

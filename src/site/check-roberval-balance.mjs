import assert from 'node:assert/strict';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {chromium} from 'playwright';
import {robervalBalanceLesson as lesson} from './roberval-balance-lesson.js';
const evidence=new URL(process.env.ROBERVAL_BALANCE_EVIDENCE||'../../documentation/audit/evidence/roberval-balance/browser/',import.meta.url);await mkdir(evidence,{recursive:true});
const browser=await chromium.launch({headless:process.env.HEADED!=='1'}),page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[],observations=[];
page.setDefaultTimeout(10000);page.on('pageerror',e=>errors.push(e.message));
const sceneShot=async options=>{await page.mouse.move(0,0);await page.locator('canvas').evaluate(c=>c.scrollIntoView({block:'start',behavior:'instant'}));await page.waitForTimeout(150);return page.screenshot({...options,clip:await page.locator('canvas').boundingBox()});};
const frameMargin=async()=>{const b=await page.evaluate(()=>{document.querySelector('[data-control="leftMass"]').dispatchEvent(new Event('input',{bubbles:true}));const c=document.querySelector('canvas'),copy=new OffscreenCanvas(c.width,c.height),ctx=copy.getContext('2d');ctx.drawImage(c,0,0);const pixels=ctx.getImageData(0,0,c.width,c.height).data,b={width:c.width,height:c.height,left:c.width,right:0,top:c.height,bottom:0};for(let y=0;y<c.height;y++)for(let x=0;x<c.width;x++)if(pixels[(y*c.width+x)*4+3]>0){b.left=Math.min(b.left,x);b.right=Math.max(b.right,x);b.top=Math.min(b.top,y);b.bottom=Math.max(b.bottom,y);}return b;});assert.ok(b.right>b.left&&b.bottom>b.top,'actual scene rendered');assert.ok(Math.min(b.left,b.top,b.width-1-b.right,b.height-1-b.bottom)>=8,'complete scene has raster margins: '+JSON.stringify(b));return b;};
const read=()=>page.locator('.daily-readings>div').evaluateAll(ns=>Object.fromEntries(ns.map(n=>[n.querySelector('dt').textContent,n.querySelector('dd').textContent])));
const near=(a,b,digits=2)=>assert.ok(Number.isFinite(parseFloat(a))&&Math.abs(parseFloat(a)-b)<=.5*10**-digits+3e-8,`${a} must display rounded ${b}`);
const stages=['Inspect start (0%)','Inspect quarter (25%)','Inspect three quarters (75%)','Inspect result (100%)'];
const inspect=i=>page.getByRole('button',{name:stages[i],exact:true}).click();
async function preset(i){await page.getByRole('tab',{name:'Try it yourself',exact:true}).click();await page.locator(`[data-experiment="${i}"]`).click();await page.getByRole('tab',{name:'Controls',exact:true}).click();}
// Independent ODE reference. This browser check never calls the production sampler.
const anchors=JSON.parse(await readFile(new URL('../../documentation/audit/evidence/roberval-balance/independent-review/preset-anchors.json',import.meta.url),'utf8')).cases;
const mapped={'Driving torque':['gravityTorque',3],'Damper torque':['damperTorque',3],'Stop torque':['stopTorque',3],'Signed left stop force':['stopLeftForce',2],'Signed right stop force':['stopRightForce',2],'Kinetic energy':['kineticEnergy',3],'Potential energy change':['potentialEnergy',3],'Damper heat':['damperHeat',3],'Impact heat':['impactHeat',3]};
function compare(r,i,t){
 const v=lesson.tryIt[i].values,a=anchors[i].snapshots.find(s=>Math.abs(s.elapsed-t)<1e-12);assert.ok(a,'Independent snapshot exists');assert.deepEqual(anchors[i].values,v);
 near(r['Trial time'],t);near(r['Physical elapsed time'],t/4);near(r['Left mass'],v.leftMass);near(r['Right mass'],v.rightMass);near(r.Gravity,[9.81,1.62][v.gravity]);near(r['Beam angle'],a.angle*180/Math.PI);
 for(const [label,[key,digits]] of Object.entries(mapped))near(r[label],a[key],digits);
 let couple=0;for(const [name,sign,key] of [['Left',-1,'left'],['Right',1,'right']]){
  const mass=v[key+'Mass'],offset=v[key+'Offset'],q=a.angle,w=a.speed,alpha=a.acceleration,fx=mass*sign*.45*(-Math.cos(q)*w*w-Math.sin(q)*alpha),N=mass*([9.81,1.62][v.gravity]+sign*.45*(-Math.sin(q)*w*w+Math.cos(q)*alpha)),C=offset*N-.30*fx;
  near(r[name+' support force'],N);near(r[name+' carrier couple'],C,3);near(r[name+' top horizontal force'],fx/2-C/.35);near(r[name+' bottom horizontal force'],fx/2+C/.35);near(r[name+' stopping impulse Y'],a[key].stoppingImpulse[1],3);couple+=C;
 }
 near(r['Fixed-bearing couple'],couple,3);near(r['Stop impacts'],a.stopHits,0);if(a.stopHits)near(r['Last impact physical time'],a.lastImpactPhysicalTime,3);else assert.equal(r['Last impact physical time'],'No impact');assert.equal(Object.keys(r).length,29);
 if(Math.abs(a.stopTorque)>1e-7)assert.match(r.Outcome,/imbalance|unequal|not.*balanc/i);else if(v.leftMass===v.rightMass)assert.match(r.Outcome,/Equal masses remain.*without a (restoring torque or )?stop reaction\./);
}
try{
 const url=process.env.ROBERVAL_BALANCE_URL||new URL('#machine/roberval-balance',process.env.SITE_URL||'http://127.0.0.1:5193/').href;await page.goto(url,{waitUntil:'domcontentloaded',timeout:45000});await page.locator('[data-control="leftMass"]').waitFor({timeout:45000});assert.equal(await page.locator('h1').textContent(),'Roberval balance');compare(await read(),0,0);
 for(const width of [1440,390]){
  await page.setViewportSize({width,height:width===390?844:1000});
  for(let i=0;i<lesson.tryIt.length;i++){
   await preset(i);for(const [key,value] of Object.entries(lesson.tryIt[i].values)){const input=page.locator(`[data-control="${key}"]`);assert.equal(Number(await input.inputValue()),value);assert.equal(await input.isEnabled(),true);}
   for(let stage=0;stage<4;stage++){await inspect(stage);compare(await read(),i,[0,2,6,8][stage]);await frameMargin();assert.ok(await page.locator('.daily-readings>div').evaluateAll(ns=>ns.every(n=>n.querySelector('p')?.textContent.length>15)));}
   if([0,1,2,3,5,6,7,10,12,16].includes(i)){await inspect(1);await sceneShot({path:new URL(`result-scene-${width}-${i}.png`,evidence).pathname});await inspect(3);}
   assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));observations.push({width,preset:i,title:lesson.tryIt[i].title,readings:await read()});
  }
 }
 await page.setViewportSize({width:1440,height:1000});
 for(const i of [0,5,7]){
  await preset(i);await page.locator('[data-step]').click();compare(await read(),i,.08);await page.locator('[data-play]').click();await page.waitForFunction(()=>parseFloat([...document.querySelectorAll('.daily-readings>div')].find(n=>n.querySelector('dt').textContent==='Trial time').querySelector('dd').textContent)>.3);await page.locator('[data-play]').click();const held=await read();await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));assert.deepEqual(await read(),held);
  await inspect(2);await page.locator('[data-play]').click();await page.waitForFunction(()=>document.querySelector('[data-play]').getAttribute('aria-pressed')==='false',null,{timeout:12000});compare(await read(),i,8);await page.locator('[data-play]').click();await page.waitForFunction(()=>parseFloat([...document.querySelectorAll('.daily-readings>div')].find(n=>n.querySelector('dt').textContent==='Trial time').querySelector('dd').textContent)<1);await page.locator('[data-play]').click();for(const [key,value] of Object.entries(lesson.tryIt[i].values))assert.equal(Number(await page.locator('[data-control="'+key+'"]').inputValue()),value,'Replay retains the configured trial');
 }
 for(const i of [0,1,4,5,6,7,16]){await preset(i);await inspect(3);const held=await read();await page.getByRole('button',{name:'Inspect balance pointer',exact:true}).click();assert.equal(await page.locator('.daily-part-detail h3').innerText(),'Beam-angle pointer');assert.deepEqual(await read(),held);await sceneShot({path:new URL(`pointer-${i}.png`,evidence).pathname});await page.getByRole('button',{name:'Inspect whole balance',exact:true}).click();assert.deepEqual(await read(),held);}
 // Exercise every control directly, including the two enum controls, without a preset.
 await preset(1);await inspect(3);const beforeOffset=await read();await page.locator('[data-control="leftOffset"]').fill('0.18');await page.locator('[data-control="leftOffset"]').dispatchEvent('input');let r=await read();near(r['Left carrier couple'],1.7658,3);assert.equal(r['Beam angle'],beforeOffset['Beam angle']);near(r['Trial time'],8);
 await page.locator('[data-control="rightOffset"]').fill('-0.18');await page.locator('[data-control="rightOffset"]').dispatchEvent('input');r=await read();near(r['Right carrier couple'],-1.7658,3);near(r['Fixed-bearing couple'],0);
 await page.locator('[data-control="initialAngle"]').selectOption('0.12');r=await read();near(r['Beam angle'],.12*180/Math.PI);near(r['Stop torque'],0);
 await page.locator('[data-control="gravity"]').selectOption('1');r=await read();near(r['Left support force'],1.62);near(r['Left carrier couple'],.18*1.62,3);near(r['Trial time'],8);
 await page.locator('[data-control="leftMass"]').focus();await page.keyboard.press('ArrowRight');r=await read();near(r['Left mass'],1.25);assert.match(r.Outcome,/imbalance|unequal|not.*balanc/i);
 await page.locator('[data-control="rightMass"]').focus();await page.keyboard.press('ArrowRight');r=await read();near(r['Right mass'],1.25);near(r['Beam angle'],.12*180/Math.PI);near(r['Stop torque'],0);
 await page.getByRole('button',{name:'Reset experiment',exact:true}).click();compare(await read(),0,0);await inspect(3);await page.locator('[data-result]').click();await sceneShot({path:new URL('balance-inspection.png',evidence).pathname});
 const before=await sceneShot();await page.locator('canvas').focus();await page.keyboard.press('ArrowRight');assert.ok(!before.equals(await sceneShot()));
 const held=await read(),route=page.url();await page.locator('[data-separation]').fill('100');await page.locator('[data-separation]').dispatchEvent('input');await page.waitForTimeout(800);assert.equal(page.url(),route);assert.deepEqual(await read(),held);await sceneShot({path:new URL('grouped-parts.png',evidence).pathname});await page.locator('[data-reassemble]').click();await page.waitForTimeout(800);assert.deepEqual(await read(),held);assert.equal(await page.locator('[data-separation]').inputValue(),'0');assert.deepEqual(errors,[]);
 const result={passed:true,url,presets:lesson.tryIt.length,viewportWidths:[1440,390],presetStageChecks:lesson.tryIt.length*8,playbackCases:3,directControls:6,errors,observations};await writeFile(new URL('results.json',evidence),JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify({...result,observations:observations.length}));
}finally{await browser.close();}

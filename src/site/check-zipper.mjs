import assert from 'node:assert/strict';
import * as THREE from 'three';
import {chromium} from 'playwright';
import {createZipperModel} from './zipper-model.js';
import {createPartExplosion} from './part-explosion.js';
import {dailyLifeLessons} from './daily-life-lessons.js';
import {mkdir,writeFile} from 'node:fs/promises';
const m=createZipperModel(),object=id=>m.parts.find(p=>p.id===id).object;
const cross=(a,b,c)=>(b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]);
function inside(p,poly){
 let yes=false;
 for(let i=0,j=poly.length-1;i<poly.length;j=i++){
  const a=poly[j],b=poly[i];if(Math.abs(cross(a,b,p))<1e-8&&p[0]>=Math.min(a[0],b[0])-1e-8&&p[0]<=Math.max(a[0],b[0])+1e-8&&p[1]>=Math.min(a[1],b[1])-1e-8&&p[1]<=Math.max(a[1],b[1])+1e-8)return false;
  if((a[1]>p[1])!==(b[1]>p[1])&&p[0]<(b[0]-a[0])*(p[1]-a[1])/(b[1]-a[1])+a[0])yes=!yes;
 }
 return yes;
}
function overlap(a,b){
 if([0,1].some(axis=>Math.max(...a.map(p=>p[axis]))<=Math.min(...b.map(p=>p[axis]))+1e-8||Math.max(...b.map(p=>p[axis]))<=Math.min(...a.map(p=>p[axis]))+1e-8))return false;
 for(let i=0;i<a.length;i++)for(let j=0;j<b.length;j++){
  const p=a[i],q=a[(i+1)%a.length],r=b[j],s=b[(j+1)%b.length];
  if(cross(p,q,r)*cross(p,q,s)<-1e-14&&cross(r,s,p)*cross(r,s,q)<-1e-14)return true;
 }
 return a.some(p=>inside(p,b))||b.some(p=>inside(p,a));
}
const project=(mesh,points)=>points.map(([x,y,z=0])=>{const p=mesh.localToWorld(new THREE.Vector3(x,y,z));return [p.x,p.y];});
function facePoints(id){return object(id).children.flatMap(mesh=>{const a=mesh.geometry.attributes.position;return Array.from({length:a.count},(_,j)=>mesh.localToWorld(new THREE.Vector3().fromBufferAttribute(a,j)));});}
function headSection(i,z){return ['projection-','recess-'].flatMap((prefix,k)=>{const points=facePoints(prefix+i).filter(p=>Math.abs(p.z-z)<1e-7).map(p=>[p.x,p.y]);const unique=[...new Map(points.map(p=>[p[0]+':'+p[1],p])).values()];unique.sort((a,b)=>(k?-1:1)*(a[0]-b[0]));return unique;});}
function boxSection(mesh,z){mesh.geometry.computeBoundingBox();const b=mesh.geometry.boundingBox,world=new THREE.Box3().setFromObject(mesh);if(z<world.min.z-1e-8||z>world.max.z+1e-8)return null;return project(mesh,[[b.min.x,b.min.y,z],[b.max.x,b.min.y,z],[b.max.x,b.max.y,z],[b.min.x,b.max.y,z]]);}
function shapeSection(mesh,z){const bounds=new THREE.Box3().setFromObject(mesh);if(z<bounds.min.z-1e-8||z>bounds.max.z+1e-8)return null;return project(mesh,mesh.geometry.parameters.shapes.getPoints().map(p=>[p.x,p.y,z]));}
m.reset();
assert.equal(m.getState().alignment,0);assert.equal(m.getState().insertion,0);
m.update({closure:1});assert.equal(m.getState().closure,0,'cannot close unconnected sides');
m.update({insertion:.5});assert.equal(m.getState().insertion,0,'align before insertion');
m.update({alignment:1,insertion:.5});m.update({closure:1});assert.equal(m.getState().closure,0,'partial insertion does not permit normal closing');
m.update({alignment:0});assert.equal(m.getState().alignment,1,'withdraw before moving sideways');
m.update({alignment:1,insertion:1,closure:.5});m.update({insertion:0});assert.equal(m.getState().insertion,1,'unzip before withdrawing');
m.update({closure:0});
const pinMesh=object('insertion-pin').children[0];
for(let step=0;step<=100;step++){
 m.update({alignment:1,insertion:step/100,closure:0});m.root.updateMatrixWorld(true);
 const pin=boxSection(pinMesh,0),barriers=[object('wedge').children[0],...object('walls').children].map(mesh=>shapeSection(mesh,0)).filter(Boolean);
 for(const barrier of barriers)assert.equal(overlap(pin,barrier),false,'pin clears slider guides at insertion '+step/100);
 for(const mesh of object('retaining-box').children){const wall=boxSection(mesh,0);if(wall)assert.equal(overlap(pin,wall),false,'pin clears socket walls at insertion '+step/100);}
 const pieces=[];
 for(let i=1;i<=24;i++){pieces.push({id:i,poly:headSection(i,0)});for(const mesh of object('jaws-'+i).children){const poly=boxSection(mesh,0);if(poly)pieces.push({id:i,poly});}}
 for(const piece of pieces){assert.equal(overlap(pin,piece.poly),false,'pin clears tooth '+piece.id+' at '+step/100);for(const barrier of barriers)assert.equal(overlap(piece.poly,barrier),false,'inserting teeth clear slider at '+step/100);}
 for(let i=0;i<pieces.length;i++)for(let j=i+1;j<pieces.length;j++)if(pieces[i].id!==pieces[j].id)assert.equal(overlap(pieces[i].poly,pieces[j].poly),false,'inserting rows avoid interpenetration '+step/100);
}
m.update({alignment:1,insertion:1,closure:0});m.root.updateMatrixWorld(true);
assert.ok(Math.abs(new THREE.Box3().setFromObject(pinMesh).min.y+.08)<1e-6,'seated pin reaches box floor');
const sliderAtBox=object('slider').position.clone(),boxAtBase=object('retaining-box').position.clone();
m.update({insertion:0,alignment:0});m.root.updateMatrixWorld(true);assert.ok(new THREE.Box3().setFromObject(pinMesh).min.y>new THREE.Box3().setFromObject(object('slider')).max.y,'withdrawn pin clears top of slider');assert.equal(object('slider').position.distanceTo(sliderAtBox),0);assert.equal(object('retaining-box').position.distanceTo(boxAtBase),0);
m.update({alignment:1,insertion:1,closure:1});m.root.updateMatrixWorld(true);
for(let i=1;i<24;i++){
 const lower=new Map(facePoints('recess-'+(i+1)).map(p=>[Math.round(p.x*1e6)+':'+Math.round(p.z*1e6),p.y]));
 for(const p of facePoints('projection-'+i)){const y=lower.get(Math.round(p.x*1e6)+':'+Math.round(p.z*1e6));assert.ok(Number.isFinite(y));assert.ok(y>p.y&&y-p.y<.025,'neighbor projection nests with a small positive clearance');}
}
assert.equal(overlap(headSection(7,0),headSection(8,0)),false);assert.equal(overlap(headSection(7,0).map(([x,y])=>[x-.05,y]),headSection(8,0)),true,'direct sideways separation meets the nested neighbor');
const stops=['left-stop','right-stop'].map(id=>object(id).children[0]);
for(const spread of [0,.5,1])for(let step=0;step<=100;step++){
 m.update({closure:step/100,spread});m.root.updateMatrixWorld(true);
 for(const mesh of object('body').children)assert.ok(mesh.geometry.boundingBox.equals(new THREE.Box3().setFromBufferAttribute(mesh.geometry.attributes.position)),'fabric framing bounds follow actual deformed vertices');
 for(const z of [0,.04,.0666666667]){
  const pieces=[];
  for(let i=1;i<=24;i++){
   pieces.push({id:i,poly:headSection(i,z)});
   for(const mesh of object('jaws-'+i).children){const p=boxSection(mesh,z);if(p)pieces.push({id:i,poly:p});}
  }
  stops.forEach((mesh,i)=>{const p=boxSection(mesh,z);if(p)pieces.push({id:25+i,poly:p});});
  const barriers=[object('wedge').children[0],...object('walls').children].map(mesh=>shapeSection(mesh,z)).filter(Boolean);
  for(let i=0;i<pieces.length;i++){
   const a=pieces[i];for(let j=i+1;j<pieces.length;j++){const b=pieces[j];if(a.id!==b.id)assert.equal(overlap(a.poly,b.poly),false,`teeth/stops ${a.id}/${b.id}, closure ${step/100}, spread ${spread}, section ${z}`);}
   for(const p of barriers)assert.equal(overlap(a.poly,p),false,`slider contact clearance: tooth/stop ${a.id}, closure ${step/100}, spread ${spread}, section ${z}`);
  }
 }
}
m.update({closure:1});m.root.updateMatrixWorld(true);const left=boxSection(stops[0],0),right=boxSection(stops[1],0);
assert.ok(Math.abs(Math.max(...left.map(p=>p[0]))-Math.min(...right.map(p=>p[0])))<1e-6,'upper stops meet at the closing limit');
assert.equal(overlap(left.map(([x,y])=>[x+.005,y]),right.map(([x,y])=>[x-.005,y])),true,'upper stops block closer approach');
m.update({closure:0});m.root.updateMatrixWorld(true);const base=object('retaining-box'),baseBounds=new THREE.Box3().setFromObject(base),plateBounds=new THREE.Box3().setFromObject(object('back-plate'));assert.ok(Math.abs(baseBounds.max.y-plateBounds.min.y)<1e-6,'slider reaches retaining box');
for(const hz of [30,60,144]){m.reset();m.update({closure:0});for(let i=0;i<hz*12;i++)m.advance(1/hz);assert.equal(m.getState().closure,1);assert.equal(m.getState().joinedLinks,23);m.update({operation:1});for(let i=0;i<hz*12;i++)m.advance(1/hz);assert.equal(m.getState().closure,0);assert.equal(m.getState().joinedLinks,0);}
m.update({alignment:1,insertion:1,closure:1,spread:0});const joined=object('tooth-7').position.clone();m.update({spread:1,pullAngle:70});assert.equal(object('tooth-7').position.distanceTo(joined),0);m.reset();assert.equal(m.getState().closure,0);m.dispose();
console.log('PASS zipper geometry: nesting, lateral interlock, sampled tooth/stop/guide clearances, stop contacts, frame-rate-independent operations and reset.');
const audited=createZipperModel();assert.equal(audited.parts.length,163);assert.equal(audited.parts.filter(p=>!p.object.userData.labelHidden).length,21);for(const id of ['pull','pull-mount'])assert.equal(audited.covers.includes(audited.parts.find(p=>p.id===id).object),false,'handhold remains visible in cutaway');
audited.animate(NaN);audited.animate(Infinity);audited.animate(.25);assert.equal(audited.getState().alignment,.11,'finite clock advances after invalid samples');audited.reset();
for(const preset of dailyLifeLessons.Zipper.tryIt){audited.reset();audited.update(preset.values);for(let i=0;i<60&&!audited.getState().complete;i++){audited.advance(.25);const state=audited.getState(),read=label=>state.readings.find(r=>r.label===label);assert.ok(state.readings.every(r=>r.hint));const slider=audited.parts.find(p=>p.id==='slider').object;assert.ok(Math.abs(parseFloat(read('Travel in tooth pitches').value)-(slider.position.y-.37)/.24)<=.005001,'travel reading agrees with actual slider within its displayed precision');assert.equal(read('Pull-tab angle').value,state.values.pullAngle+'°');}assert.equal(audited.getState().complete,true);}
for(const width of [760,329]){audited.reset();audited.covers.forEach(o=>o.visible=false);const camera=new THREE.OrthographicCamera(-4,4,4,-4,.1,100);camera.position.set(5,5,8);camera.lookAt(0,2,0);camera.updateMatrixWorld();const explosion=createPartExplosion(audited,camera,width/620,{width,height:620});assert.deepEqual(explosion.categories.map(c=>c.id).sort(),['body','bottom-connector','slider','stops','tapes','teeth']);assert.equal(explosion.categories.find(c=>c.id==='teeth').items.length,24,'each whole tooth remains one piece');assert.equal(explosion.items.length,36);explosion.update(1);for(const part of audited.parts)assert.equal(explosion.boundsFor(part.id).isEmpty(),part.id==='front-plate');explosion.dispose();}audited.dispose();
console.log('PASS zipper audit: 21 overview labels with all 163 inspectable parts, six categories/36 physical pieces, visible handhold, explained mesh-based readings and invalid-clock recovery.');
if(process.env.MODEL_ONLY==='1')process.exit(0);
const evidence=process.env.EVIDENCE_DIR||'documentation/audit/evidence/zipper-20260919/local';await mkdir(evidence,{recursive:true});const cases=[];
const browser=await chromium.launch({headless:true}),page=await browser.newPage({viewport:{width:1440,height:1000},reducedMotion:'reduce'}),errors=[];page.on('pageerror',e=>errors.push(e.message));
try{
 for(const width of [1440,390]){
 await page.setViewportSize({width,height:width===1440?1000:844});
 await page.goto(`${process.env.SITE_URL||'http://127.0.0.1:5175/'}#machine/zipper`);await page.reload();await page.getByRole('heading',{name:'Zipper',exact:true}).waitFor();
 if(width===1440){await page.locator('canvas').evaluate(el=>el.scrollIntoView({block:'start',behavior:'instant'}));await page.waitForTimeout(150);const box=await page.locator('canvas').boundingBox();await page.mouse.move(box.x+292,box.y+220);await page.waitForTimeout(100);assert.equal(await page.locator('.daily-part-popup').isVisible(),false,'empty gap must not hit distant stitch lines');await page.mouse.move(box.x+294,box.y+230);await page.waitForTimeout(100);assert.equal(await page.locator('.daily-part-popup').isVisible(),true);assert.equal((await page.locator('.daily-part-popup').textContent()).trim(),'Head cross-section 23');}
 const preset=async i=>{await page.locator('[data-cutaway]').uncheck();await page.locator('[data-isolate]').check();await page.getByRole('tab',{name:'Try it yourself',exact:true}).click();await page.getByRole('button',{name:'Set up this experiment',exact:true}).nth(i).click();await page.getByRole('tab',{name:'Controls',exact:true}).click();assert.equal(await page.locator('[data-cutaway]').isChecked(),true);assert.equal(await page.locator('[data-isolate]').isChecked(),false);for(const [key,value] of Object.entries(dailyLifeLessons.Zipper.tryIt[i].values))assert.equal(await page.locator(`[data-control="${key}"]`).inputValue(),String(value));await page.locator('canvas').scrollIntoViewIfNeeded();await page.screenshot({path:`${evidence}/initial-${width}-${i}.png`,clip:await page.locator('canvas').boundingBox()});};
 await preset(0);assert.equal(await page.getByRole('spinbutton',{name:'Close the zipper value',exact:true}).isDisabled(),true);await page.getByRole('button',{name:'Advance one step',exact:true}).click();assert.equal(await page.getByRole('spinbutton',{name:'Close the zipper value',exact:true}).inputValue(),'0');assert.equal(await page.getByRole('spinbutton',{name:'Bring the sides together value',exact:true}).inputValue(),'0.11');
 await page.getByRole('button',{name:'Run selected action',exact:true}).click();await page.waitForFunction(()=>document.querySelector('[data-number="closure"]').value==='1');assert.match(await page.locator('.daily-readings').textContent(),/Jacket fastened/);cases.push({width,preset:0,result:'Jacket fastened'});await page.locator('canvas').scrollIntoViewIfNeeded();await page.screenshot({path:`${evidence}/closed-${width}.png`,clip:await page.locator('canvas').boundingBox()});
 await page.getByRole('checkbox',{name:'Look inside',exact:true}).uncheck();await page.getByRole('spinbutton',{name:'Pull-tab angle value',exact:true}).fill('70');assert.match(await page.locator('.daily-readings').textContent(),/23 of 23/);
 await preset(1);assert.equal(await page.getByRole('spinbutton',{name:'Close the zipper value',exact:true}).isDisabled(),true);await page.getByRole('spinbutton',{name:'Seat the bottom pin value',exact:true}).fill('1');assert.equal(await page.getByRole('spinbutton',{name:'Close the zipper value',exact:true}).isEnabled(),true);await page.locator('canvas').scrollIntoViewIfNeeded();await page.screenshot({path:`${evidence}/seated-${width}.png`,clip:await page.locator('canvas').boundingBox()});await page.locator('[data-play]').click();await page.locator('[data-play][title^="Play again"]').waitFor({timeout:30000});assert.equal(await page.locator('[data-number="closure"]').inputValue(),'1');cases.push({width,preset:1,result:'Jacket fastened after manual seating'});
 await preset(2);await page.getByRole('button',{name:'Locking projection 7',exact:true}).waitFor();await page.getByRole('checkbox',{name:'Isolate selected part',exact:true}).check();await page.locator('canvas').scrollIntoViewIfNeeded();await page.screenshot({path:`${evidence}/head-${width}.png`,clip:await page.locator('canvas').boundingBox()});await page.locator('[data-isolate]').uncheck();await page.locator('[data-play]').click();await page.locator('[data-play][title^="Play again"]').waitFor({timeout:30000});assert.equal(await page.locator('[data-number="alignment"]').inputValue(),'0');cases.push({width,preset:2,result:'Inspected nesting head then separated'});
 await preset(3);assert.equal(await page.getByRole('spinbutton',{name:'Seat the bottom pin value',exact:true}).isDisabled(),true);await page.getByRole('button',{name:'Run selected action',exact:true}).click();await page.waitForFunction(()=>document.querySelector('[data-number="alignment"]').value==='0');assert.match(await page.locator('.daily-readings').textContent(),/Jacket sides completely separated/);cases.push({width,preset:3,result:'Jacket sides completely separated'});await page.locator('canvas').scrollIntoViewIfNeeded();await page.screenshot({path:`${evidence}/open-${width}.png`,clip:await page.locator('canvas').boundingBox()});
 await page.getByRole('button',{name:'Seat the free pin through the lowered slider into the retaining box.',exact:true}).click();assert.match(await page.locator('.daily-answer').textContent(),/That’s right/);await page.getByRole('button',{name:'Reset experiment',exact:true}).click();assert.equal(await page.getByRole('spinbutton',{name:'Close the zipper value',exact:true}).inputValue(),'0');
 await page.locator('[data-labels]').check();assert.equal(await page.locator('.daily-model-label:visible').count(),21);await page.locator('button[data-label-part="head-7"]').click();await page.getByRole('button',{name:'Locking projection 7',exact:true}).click();assert.equal(await page.locator('button[data-label-part="projection-7"]').isVisible(),true,'selected detailed part gets its label');await page.getByRole('heading',{name:'Zipper',exact:true}).click();assert.match(await page.locator('.daily-part-detail').textContent(),/Select a part/);assert.equal(await page.locator('button[data-label-part="projection-7"]').isVisible(),false);assert.equal(await page.locator('.daily-model-label:visible').count(),21);await page.locator('canvas').scrollIntoViewIfNeeded();await page.screenshot({path:`${evidence}/labels-${width}.png`,clip:await page.locator('canvas').boundingBox()});await page.locator('[data-labels]').uncheck();
 await page.locator('[data-separation]').fill('100');await page.locator('[data-view="in"]').click();await page.locator('[data-view="out"]').click();assert.equal(await page.locator('[data-separation]').inputValue(),'100');await page.getByText('Fully separated',{exact:true}).waitFor();assert.equal(await page.locator('.daily-inventory-labels [data-category]:visible').count(),6);await page.locator('canvas').scrollIntoViewIfNeeded();await page.screenshot({path:`${evidence}/separated-${width}.png`,clip:await page.locator('canvas').boundingBox()});await page.getByRole('button',{name:'Reassemble',exact:true}).click();assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));assert.deepEqual(errors,[]);console.log('PASS zipper browser width',width);
 }
 assert.equal(cases.length,8);console.log('PASS zipper browser: eight preset/viewport cases, complete actions, seating gates, detailed head inspection, overview/selected labels, outside dismissal, handhold, separation, zoom buttons, quiz and reset.');
}catch(error){await page.screenshot({path:`${evidence}/failure.png`,fullPage:true}).catch(()=>{});throw error;}finally{await writeFile(`${evidence}/browser.json`,JSON.stringify({browser:browser.version(),cases,errors},null,2)+'\n');await browser.close();}

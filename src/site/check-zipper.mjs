import assert from 'node:assert/strict';
import * as THREE from 'three';
import {chromium} from 'playwright';
import {createZipperModel} from './zipper-model.js';
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
const browser=await chromium.launch({headless:true}),page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
try{
 await page.goto(`${process.env.SITE_URL||'http://127.0.0.1:5175/'}#machine/zipper`);await page.getByRole('heading',{name:'Zipper',exact:true}).waitFor();
 const preset=async i=>{await page.getByRole('tab',{name:'Try it yourself',exact:true}).click();await page.getByRole('button',{name:'Set up this experiment',exact:true}).nth(i).click();await page.getByRole('tab',{name:'Controls',exact:true}).click();};
 await preset(0);assert.equal(await page.getByRole('spinbutton',{name:'Close the zipper value',exact:true}).isDisabled(),true);await page.getByRole('button',{name:'Advance one step',exact:true}).click();assert.equal(await page.getByRole('spinbutton',{name:'Close the zipper value',exact:true}).inputValue(),'0');assert.equal(await page.getByRole('spinbutton',{name:'Bring the sides together value',exact:true}).inputValue(),'0.11');
 await page.getByRole('button',{name:'Run selected action',exact:true}).click();await page.waitForFunction(()=>document.querySelector('[data-number="closure"]').value==='1');assert.match(await page.locator('.daily-readings').textContent(),/Jacket fastened/);await page.screenshot({path:'/tmp/howthingswork-zipper-closed.png',fullPage:true});
 await page.getByRole('checkbox',{name:'Look inside',exact:true}).uncheck();await page.getByRole('spinbutton',{name:'Pull-tab angle value',exact:true}).fill('70');assert.match(await page.locator('.daily-readings').textContent(),/23 of 23/);
 await preset(1);assert.equal(await page.getByRole('spinbutton',{name:'Close the zipper value',exact:true}).isDisabled(),true);await page.getByRole('spinbutton',{name:'Seat the bottom pin value',exact:true}).fill('1');assert.equal(await page.getByRole('spinbutton',{name:'Close the zipper value',exact:true}).isEnabled(),true);await page.screenshot({path:'/tmp/howthingswork-zipper-bottom-seated.png',fullPage:true});
 await preset(2);await page.getByRole('button',{name:'Locking projection 7',exact:true}).waitFor();await page.getByRole('checkbox',{name:'Isolate selected part',exact:true}).check();await page.screenshot({path:'/tmp/howthingswork-zipper-nesting-head.png',fullPage:true});
 await preset(3);assert.equal(await page.getByRole('spinbutton',{name:'Seat the bottom pin value',exact:true}).isDisabled(),true);await page.getByRole('button',{name:'Run selected action',exact:true}).click();await page.waitForFunction(()=>document.querySelector('[data-number="alignment"]').value==='0');assert.match(await page.locator('.daily-readings').textContent(),/Jacket sides completely separated/);await page.screenshot({path:'/tmp/howthingswork-zipper-open.png',fullPage:true});
 await page.getByRole('button',{name:'Seat the free pin through the lowered slider into the retaining box.',exact:true}).click();assert.match(await page.locator('.daily-answer').textContent(),/That’s right/);await page.getByRole('button',{name:'Reset experiment',exact:true}).click();assert.equal(await page.getByRole('spinbutton',{name:'Close the zipper value',exact:true}).inputValue(),'0');
 await page.setViewportSize({width:390,height:844});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));assert.deepEqual(errors,[]);console.log('PASS zipper browser: complete jacket fastening/separation, bottom pin sequencing, detailed head inspection, independent handhold, quiz/reset and mobile.');
}finally{await browser.close();}

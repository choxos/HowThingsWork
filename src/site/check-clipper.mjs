import assert from 'node:assert/strict';
import * as THREE from 'three';
import {chromium} from 'playwright';
import {createClipperModel} from './clipper-model.js';

const m=createClipperModel(),object=id=>m.parts.find(p=>p.id===id).object;
function triangles(mesh){
 const position=mesh.geometry.attributes.position,index=mesh.geometry.index,result=[];
 for(let i=0;i<index.count;i+=3)result.push(new THREE.Triangle(...[0,1,2].map(j=>new THREE.Vector3().fromBufferAttribute(position,index.getX(i+j)).applyMatrix4(mesh.matrixWorld))));
 return result;
}
const upper=object('upper-blade').children.find(p=>p.isMesh),lower=object('lower-blade').children.find(p=>p.isMesh),shaft=object('post').children[0];
let lastGap=Infinity;
for(let i=0;i<=100;i++){
 m.reset();m.update({squeeze:i/100,effort:20,resistance:10});m.root.updateMatrixWorld(true);const state=m.getState();
 assert.ok(state.jawGap<=lastGap+1e-8);lastGap=state.jawGap;assert.ok(Math.abs(state.contact.error)<1e-9);
 const a=object('upper-edge').children[0].localToWorld(new THREE.Vector3(0,-.14,0)),b=object('lower-edge').children[0].localToWorld(new THREE.Vector3(0,-.14,0));
 assert.ok(Math.abs(a.y-b.y-state.jawGap)<1e-8);assert.ok(Math.abs(a.x-b.x)<1e-8,'opposed edges share the same cutting line');
 const upperTriangles=triangles(upper),lowerTriangles=triangles(lower),camCenter=object('cam').getWorldPosition(new THREE.Vector3());
 const distance=Math.min(...upperTriangles.map(t=>t.closestPointToPoint(camCenter,new THREE.Vector3()).distanceTo(camCenter)));
 assert.ok(Math.abs(distance-.07)<1e-5,'the rounded cam contacts the actual tessellated blade');
 if(i%2===0){
  const height=shaft.geometry.parameters.height,direction=new THREE.Vector3(0,1,0).transformDirection(shaft.matrixWorld);
  for(let n=0;n<32;n++){
   const angle=n*Math.PI/16,origin=shaft.localToWorld(new THREE.Vector3(.052*Math.cos(angle),-height/2,.052*Math.sin(angle))),ray=new THREE.Ray(origin,direction);
   for(const t of [...upperTriangles,...lowerTriangles]){const hit=ray.intersectTriangle(t.a,t.b,t.c,false,new THREE.Vector3());assert.ok(!hit||hit.distanceTo(origin)>height+1e-6,'shaft clears both actual blade holes');}
  }
 }
 for(const mesh of [upper,lower])for(let j=0;j<mesh.geometry.attributes.position.count;j++){
  const p=new THREE.Vector3().fromBufferAttribute(mesh.geometry.attributes.position,j);if(Math.abs(p.x)<1e-8)assert.ok(Math.abs(Math.abs(p.y)-(Math.abs(p.y)>.04?.07:.01))<1e-6,'rear blade ends remain fixed');
 }
}
assert.ok(lastGap<1e-8,'the edges actually close');
for(const fingerPosition of [.35,.65,1])for(const squeeze of [.2,.4,.6,.8]){
 m.reset();m.update({effort:20,resistance:10,fingerPosition,squeeze});const ratio=m.getState().forceRatio;
 const positions=[];for(const s of [squeeze-.01,squeeze+.01]){m.update({squeeze:s});m.root.updateMatrixWorld(true);positions.push({finger:object('finger').getWorldPosition(new THREE.Vector3()).y,gap:m.getState().jawGap});}
 const observed=(positions[1].finger-positions[0].finger)/(positions[1].gap-positions[0].gap);assert.ok(Math.abs(observed-ratio)<.003,'ideal ratio agrees with actual finger and two-edge travel');
}
for(const setting of [{fingerPosition:.35},{effort:2},{resistance:80}]){
 m.reset();m.update(setting);m.advance(10);assert.equal(m.getState().blocked,true);assert.equal(m.getState().cut,false);assert.ok(Math.abs(m.getState().jawGap-.05)<1e-8);assert.equal(object('cut-bridge').visible,true);
 m.update({fingerPosition:1,effort:20});m.advance(10);assert.equal(m.getState().complete,true);assert.equal(object('cut-bridge').visible,false);
}
for(const hz of [30,60,144]){m.reset();for(let i=0;i<hz*5;i++)m.advance(1/hz);assert.equal(m.getState().complete,true);assert.equal(m.getState().values.squeeze,0);assert.equal(m.getState().drop,1);}
m.reset();m.update({squeeze:1});assert.equal(m.getState().cut,true);
for(let i=100;i>=0;i--){m.update({squeeze:i/100});m.root.updateMatrixWorld(true);const bounds=new THREE.Box3().setFromObject(object('fragment'));if(bounds.min.y<-.03)assert.ok(bounds.min.z>.27,'fragment clears the blade side before falling');}
const fragmentBounds=new THREE.Box3().setFromObject(object('fragment')),floorBounds=new THREE.Box3().setFromObject(object('tray').children[0]);assert.ok(Math.abs(fragmentBounds.min.y-floorBounds.max.y)<1e-7,'fragment rests on tray floor');
m.actions[0].run();assert.equal(m.getState().cut,false);assert.equal(m.getState().drop,0);assert.equal(m.getState().values.squeeze,0);m.reset();m.update({effort:NaN,resistance:Infinity});assert.equal(m.getState().values.effort,5);m.dispose();
console.log('PASS clipper geometry: actual cam contact, shaft clearances, closed edges, fixed rear ends, virtual work, weak-input stops, clipping/return and clear fragment path.');

const browser=await chromium.launch({headless:true}),page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];
page.on('pageerror',e=>errors.push(e.message));
try{
 await page.goto(`${process.env.SITE_URL||'http://127.0.0.1:5175/'}#machine/nail-clippers`);await page.getByRole('heading',{name:'Nail clippers',exact:true}).waitFor();
 for(const index of [0,1,2,3]){
  await page.getByRole('tab',{name:'Try it yourself',exact:true}).click();await page.getByRole('button',{name:'Set up this experiment',exact:true}).nth(index).click();await page.getByRole('tab',{name:'Controls',exact:true}).click();
  if(index===3){await page.getByRole('button',{name:'Advance the clipper',exact:true}).click();assert.ok(Number(await page.getByRole('spinbutton',{name:'Press the lever value',exact:true}).inputValue())>.4);}
  await page.getByRole('button',{name:'Run clipping action',exact:true}).click();
  if(index===1||index===2){await page.waitForFunction(()=>document.querySelector('.daily-readings').textContent.includes('Strip held'));await page.getByRole('button',{name:'Run clipping action',exact:true}).waitFor();await page.screenshot({path:`/tmp/howthingswork-clipper-stalled-${index}.png`,fullPage:true});await page.getByRole('spinbutton',{name:index===1?'Finger distance along lever value':'Finger force value',exact:true}).fill(index===1?'1':'5');await page.getByRole('button',{name:'Run clipping action',exact:true}).click();}
  await page.waitForFunction(()=>document.querySelector('.daily-readings').textContent.includes('Nail edge clipped · fragment in tray'));await page.getByRole('heading',{name:'Clipped nail and fragment',exact:true}).waitFor();assert.equal(await page.getByRole('spinbutton',{name:'Press the lever value',exact:true}).inputValue(),'0');await page.screenshot({path:`/tmp/howthingswork-clipper-result-${index}.png`,fullPage:true});
 }
 await page.getByRole('button',{name:'Inspect the clipped result',exact:true}).click();assert.equal(await page.getByRole('checkbox',{name:'Isolate selected part',exact:true}).isChecked(),true);await page.screenshot({path:'/tmp/howthingswork-clipper-isolated-result.png',fullPage:true});
 await page.getByRole('button',{name:'Load a fresh strip',exact:true}).click();assert.match(await page.locator('.daily-readings').textContent(),/Fresh strip/);assert.equal(await page.locator('.daily-part-detail h3').textContent(),'Clipper and practice nail');assert.equal(await page.getByRole('checkbox',{name:'Isolate selected part',exact:true}).isChecked(),false);
 await page.getByRole('button',{name:'Press farther from the retaining post.',exact:true}).click();assert.match(await page.locator('.daily-answer').textContent(),/That’s right/);await page.getByRole('button',{name:'Reset experiment',exact:true}).click();assert.equal(await page.getByRole('checkbox',{name:'Isolate selected part',exact:true}).isChecked(),false);
 await page.setViewportSize({width:390,height:844});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));assert.deepEqual(errors,[]);
 console.log('PASS clipper browser: four experiments, leverage/effort recovery, automatic top result, isolated clipping, fresh strip, quiz/reset and mobile.');
}finally{await browser.close();}

import assert from 'node:assert/strict';
import * as THREE from 'three';
import {chromium} from 'playwright';
import {mkdir,writeFile} from 'node:fs/promises';
import {dailyLifeLessons} from './daily-life-lessons.js';
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
 assert.ok(Math.abs(a.y-b.y-state.jawGap)<1e-8);assert.equal(state.readings.find(row=>row.label==='Jaw gap').value,Math.max(0,a.y-b.y).toFixed(3)+' model units');assert.equal(state.readings.length,8);assert.ok(state.readings.every(row=>row.hint));assert.ok(Math.abs(a.x-b.x)<1e-8,'opposed edges share the same cutting line');
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
 m.root.updateMatrixWorld(true);const pivot=object('handle').getWorldPosition(new THREE.Vector3()),finger=object('finger').getWorldPosition(new THREE.Vector3()),arrow=object('force-arrows').children[1],origin=arrow.getWorldPosition(new THREE.Vector3()),direction=new THREE.Vector3(0,1,0).applyQuaternion(arrow.getWorldQuaternion(new THREE.Quaternion())),fingerArm=Math.abs(finger.x-pivot.x),camArm=Math.abs((pivot.x-origin.x)*direction.y-(pivot.y-origin.y)*direction.x),read=label=>parseFloat(m.getState().readings.find(row=>row.label===label).value);
 assert.ok(Math.abs(read('Finger moment arm')-fingerArm)<.000501);assert.ok(Math.abs(read('Cam moment arm')-camArm)<.000501);assert.ok(camArm>0);assert.ok(Math.abs(fingerArm/camArm-ratio)>.1,'handle-only ratio differs from whole mechanism');
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

if(process.env.MODEL_ONLY==='1')process.exit(0);
const evidence=process.env.EVIDENCE_DIR||'/tmp/howthingswork-clipper';await mkdir(evidence,{recursive:true});const cases=[];
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
 for(const width of [1440,390]){
  await page.setViewportSize({width,height:width===390?844:1000});await page.goto('about:blank');await page.goto(`${process.env.SITE_URL||'http://127.0.0.1:5175/'}#machine/nail-clippers`);await page.locator('[data-play]').waitFor();
  const capture=async name=>{await page.locator('canvas').evaluate(c=>{scrollTo({top:0,behavior:'instant'});c.scrollIntoView({block:'center',behavior:'instant'})});await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));return page.screenshot({path:`${evidence}/${name}-${width}.png`,clip:await page.locator('canvas').boundingBox()});},read=label=>page.locator('.daily-readings>div').filter({has:page.locator('dt',{hasText:new RegExp('^'+label+'$')})}).locator('dd'),values=async()=>Object.fromEntries(await page.locator('[data-number]').evaluateAll(inputs=>inputs.map(input=>[input.dataset.number,Number(input.value)])));await capture('opening');
  for(const [index,preset] of dailyLifeLessons['Nail clippers'].tryIt.entries()){
   await page.locator('[data-labels]').check();await page.locator('button[data-label-part="post"]').click();await page.locator('[data-labels]').uncheck();await page.locator('[data-isolate]').check();await page.locator('[data-view="top"]').click();await page.getByRole('tab',{name:'Try it yourself',exact:true}).click();await page.locator(`[data-experiment="${index}"]`).click();await page.getByRole('tab',{name:'Controls',exact:true}).click();assert.deepEqual(await values(),preset.values);assert.equal(await page.locator('[data-isolate]').isChecked(),false);assert.equal(await page.locator('.daily-readings>div>p').count(),8);const initial=await capture('initial-'+index);await page.locator('[data-view="front"]').click();assert.ok(initial.equals(await capture('view-check-'+index)),'clipper preset restores Front');
   const before=await read('Jaw gap').textContent();await page.locator('[data-step]').click();assert.notEqual(await read('Jaw gap').textContent(),before);await capture('advanced-'+index);let configured={...preset.values};await page.locator('[data-play]').click();await page.waitForTimeout(120);await page.getByRole('button',{name:'Pause',exact:true}).click();const paused=await read('Jaw gap').textContent();await page.waitForTimeout(120);assert.equal(await read('Jaw gap').textContent(),paused);await page.locator('[data-play]').click();
   if(index===1||index===2){await page.waitForFunction(()=>document.querySelector('[data-play]').disabled);assert.equal(await read('Jaw gap').textContent(),'0.050 model units');assert.match(await read('Your result').textContent(),/Strip held/);await capture('blocked-'+index);await page.locator(`[data-number="${index===1?'fingerPosition':'effort'}"]`).fill(index===1?'1':'5');configured[index===1?'fingerPosition':'effort']=index===1?1:5;await page.locator('[data-play]').click();}
   await page.locator('[data-play][title^="Play again"]').waitFor({timeout:30000});assert.equal(await page.locator('.daily-part-detail h3').textContent(),'Clipped nail and fragment');assert.equal(await page.locator('[data-number="squeeze"]').inputValue(),'0');await capture('complete-'+index);await page.locator('[data-result]').click();assert.equal(await page.locator('[data-isolate]').isChecked(),true);await capture('isolated-result-'+index);await page.locator('[data-play]').evaluate(b=>{b.click();b.click()});assert.deepEqual(await values(),configured);assert.equal(await page.locator('[data-isolate]').isChecked(),false);await capture('replay-'+index);await page.getByRole('button',{name:'Load a fresh strip',exact:true}).click();assert.equal(await page.locator('.daily-part-detail h3').textContent(),'Clipper and practice nail');assert.deepEqual(await values(),{...configured,squeeze:0});assert.match(await read('Your result').textContent(),/Fresh strip/);cases.push({width,preset:index,replay:true,freshStrip:true});
  }
  await page.locator('[data-labels]').check();await page.locator('button[data-label-part="cam"]').click();await page.getByRole('heading',{name:'Nail clippers',exact:true}).click();assert.equal(await page.locator('.daily-part-detail h3').count(),0);await page.locator('[data-labels]').uncheck();await page.locator('[data-view="reset"]').click();await page.locator('[data-separation]').fill('100');await page.getByText('Fully separated',{exact:true}).waitFor();await page.locator('[data-view="in"]').click();await page.locator('[data-view="out"]').click();assert.equal(await page.locator('[data-separation]').inputValue(),'100');await capture('separated');await page.locator('[data-reassemble]').click();assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
 }
 assert.equal(cases.length,8);assert.deepEqual(errors,[]);await writeFile(`${evidence}/browser.json`,JSON.stringify({cases,errors},null,2)+'\n');

 console.log('PASS clipper browser: four experiments, leverage/effort recovery, automatic top result, isolated clipping, fresh strip, quiz/reset and mobile.');
}finally{await browser.close();}

import assert from 'node:assert/strict';
import * as THREE from 'three';
import {chromium} from 'playwright';
import {createWindowShadeModel} from './window-shade-model.js';
import {houseComponents} from './house-components.js';
import {mkdir,writeFile} from 'node:fs/promises';
const m=createWindowShadeModel(),part=id=>m.parts.find(p=>p.id===id).object;
const reference=m.getState().wireLength,initialRadius=m.getState().springRadius;
let poses=0;
function check(){
 m.root.updateMatrixWorld(true);const state=m.getState(),mesh=part('spring').children[0],path=mesh.geometry.parameters.path;
 let measured=0;
 for(const curve of path.curves){let before=curve.getPoint(0);for(let i=1;i<=5000;i++){const after=curve.getPoint(i/5000);measured+=before.distanceTo(after);before=after;}}
 assert.ok(Math.abs(measured-reference)<.0003,'independent dense integration preserves wire length');
 assert.ok(Math.abs(path.getLength()-reference)<1e-8,'analytic full path preserves wire length');
 assert.deepEqual(path.getPoint(0).toArray(),[-.88,0,0]);const endPoint=path.getPoint(1);assert.ok(Math.abs(endPoint.x-.88)<1e-9&&Math.abs(Math.hypot(endPoint.y,endPoint.z)-.065)<1e-9,'moving wire end attaches to collar');
 for(let i=1;i<path.curves.length;i++)assert.ok(path.curves[i-1].getPoint(1).distanceTo(path.curves[i].getPoint(0))<1e-9,'continuous wire at every lead junction');
 assert.deepEqual(path.curves[0].v2.toArray(),[-.88,.11,0]);
 const moving=part('moving-anchor').localToWorld(new THREE.Vector3(0,.11,0)),end=part('spring').localToWorld(path.curves.at(-1).v1.clone());assert.ok(moving.distanceTo(end)<1e-8,'wire follows real rotating anchor');
 const helix=path.curves[2],mid=helix.getPoint(.5),radius=Math.hypot(mid.y,mid.z);assert.ok(Math.abs(radius-state.springRadius)<1e-9);
 assert.ok(radius-.006>.03,'wound wire clears fixed rod');assert.ok(radius+.006<.2,'wire clears roller shell');
 part('moving-anchor').traverse(node=>{if(!node.geometry)return;const p=node.geometry.attributes.position;for(let i=0;i<p.count;i++){const v=part('assembly').worldToLocal(node.localToWorld(new THREE.Vector3().fromBufferAttribute(p,i)));assert.ok(Math.hypot(v.y,v.z)>.03,'all moving anchor vertices clear the fixed rod');}});
 const positions=mesh.geometry.attributes.position;for(let i=0;i<positions.count;i++){const p=new THREE.Vector3().fromBufferAttribute(positions,i);if(Math.abs(p.x)<.74){const radial=Math.hypot(p.y,p.z);assert.ok(radial>.03&&radial<.2,'rendered wire clears rod and tube');}}
 const phase=14*2*Math.PI+part('roller').rotation.x,pitch=1.52*2*Math.PI/phase;assert.ok(pitch>.012,'successive coil turns clear one wire diameter');
 assert.ok(radius<=initialRadius+1e-9);poses++;
}
const supports=part('supports').children,rightWalls=supports.slice(-4).map(node=>new THREE.Box3().setFromObject(node)),tang=new THREE.Box3().setFromObject(part('shaft').children[1]);assert.ok(Math.abs(rightWalls[0].max.z-tang.min.z)<1e-8&&Math.abs(rightWalls[1].min.z-tang.max.z)<1e-8,'tang fits bracket slot sides');assert.ok(Math.abs(rightWalls[2].max.y-tang.min.y)<1e-8&&Math.abs(rightWalls[3].min.y-tang.max.y)<1e-8,'tang fits bracket slot top/bottom');
const roundRod=new THREE.Box3().setFromObject(part('shaft').children[0]);assert.ok(rightWalls.every(wall=>!wall.intersectsBox(roundRod)),'round rod transitions to tang before the narrow slot');
check();m.update({coverage:1});for(let i=0;i<150&&!m.getState().complete;i++){m.advance(.1);if(i%4===0)check();}assert.equal(m.getState().held,true);assert.ok(m.getState().springRadius<initialRadius*.91);check();
const woundRadius=m.getState().springRadius;m.update({operation:1,release:0});m.advance(3);assert.ok(Math.abs(m.getState().springRadius-woundRadius)<1e-9);check();
m.update({release:1});for(let i=0;i<70&&!m.getState().complete;i++){m.advance(.1);if(i%3===0)check();}assert.equal(m.getState().stage,'raised');assert.ok(Math.abs(m.getState().springRadius-initialRadius)<1e-9);check();
const component=houseComponents['Window-shade winding spring'],lesson=component.lesson,expected=[];
assert.equal(m.resultPart.focusOnComplete,true,'parent completion behavior stays unchanged');
const dedicated=component.createModel();assert.equal(dedicated.resultPart.focusOnComplete,false);dedicated.dispose();
for(const [index,preset] of lesson.tryIt.entries()){
 m.reset(preset.initialState);m.update(preset.values);check();const initial=m.getState();
 assert.equal(initial.winding,index>=2?1.25:0);const start=initial.angle;
 m.advance(20);check();const final=m.getState();assert.equal(final.winding,[.25,1.75,0,1.25][index]);
 assert.equal(final.complete,true);if(index===3)assert.equal(final.springRadius,initial.springRadius);
 expected.push({initial:initial.readings,final:final.readings});
 m.reset(m.replayState());m.update(preset.values);assert.equal(m.getState().angle,start,'replay preserves actual winding');check();
}
m.dispose();
console.log(`PASS spring geometry: ${poses} winding/held/rewinding poses; independent wire length, continuous leads, both real anchors, rendered rod/tube clearance and turn spacing.`);
if(process.env.MODEL_ONLY==='1')process.exit(0);
const base=process.env.SITE_URL||'http://127.0.0.1:5193/',evidence=process.env.EVIDENCE_DIR||'documentation/audit/evidence/shade-spring-20260919/local';
await mkdir(evidence,{recursive:true});
const browser=await chromium.launch({headless:true}),page=await browser.newPage({viewport:{width:1440,height:1000},reducedMotion:'reduce'}),errors=[],cases=[];
page.on('pageerror',e=>errors.push(e.message));
const isolated=page.locator('[data-isolate]'),detail=page.locator('.daily-part-detail'),play=page.locator('[data-play]');
const read=label=>page.locator('.daily-readings > div').filter({has:page.locator('dt',{hasText:new RegExp('^'+label+'$')})}).locator('dd').textContent();
const view=async name=>{await page.locator('canvas').scrollIntoViewIfNeeded();await page.screenshot({path:`${evidence}/${name}.png`,clip:await page.locator('canvas').boundingBox()});};
const selected=async()=>{assert.equal(await isolated.isChecked(),false);assert.match(await detail.textContent(),/Axial winding spring/);};
const setup=async i=>{await page.getByRole('tab',{name:'Try it yourself',exact:true}).click();await page.locator('[data-experiment]').nth(i).click();await page.getByRole('tab',{name:'Controls',exact:true}).click();await selected();};
const complete=async()=>{await play.click();await page.locator('[data-play][title^="Play again"]').waitFor({timeout:25000});};
try{
 for(const width of [1440,390]){
  await page.setViewportSize({width,height:width===1440?1000:844});await page.goto(`${base}#machine/window-shade-winding-spring`);await page.reload();
  await page.getByRole('heading',{name:'Window-shade winding spring',exact:true}).waitFor();await selected();
  for(const [index,preset] of lesson.tryIt.entries()){
   await setup(index);
   for(const label of ['Window covered','Added spring winding','Coil diameter'])assert.equal(await read(label),expected[index].initial.find(r=>r.label===label).value);
   for(const [key,value] of Object.entries(preset.values))assert.equal(await page.locator(`[data-control="${key}"]`).inputValue(),String(value));
   await view(`initial-${width}-${index}`);
   await page.locator('[data-step]').click();await selected();
   if(index>=2){assert.ok(parseFloat(await read('Added spring winding'))>1.25,'tug first adds winding');await view(`tug-${width}-${index}`);}
   await complete();await selected();
   const winding=await read('Added spring winding'),diameter=await read('Coil diameter');
   for(const label of ['Window covered','Added spring winding','Coil diameter','Holding position'])assert.equal(await read(label),expected[index].final.find(r=>r.label===label).value);
   await view(`final-${width}-${index}`);
   await play.click();await play.click();await selected();const paused=await read('Added spring winding');await page.waitForTimeout(100);assert.equal(await read('Added spring winding'),paused);
   if(index>=2)assert.ok(parseFloat(paused)>=1.25,'release replay starts wound');
   await page.locator('[data-step]').click();await selected();await page.locator('[data-reset-controls]').click();await selected();assert.equal(await read('Added spring winding'),'0.00 turns');
   cases.push({width,title:preset.title,winding,diameter});console.log(width,preset.title);
  }
  await setup(3);await complete();await page.locator('[data-result]').click();assert.match(await detail.textContent(),/Window and spring roller/);await view(`window-${width}`);
  await page.locator('[data-reset-controls]').click();await selected();await page.locator('[data-cutaway]').uncheck();await view(`exterior-${width}`);await page.locator('[data-cutaway]').check();
  await page.locator('[data-labels]').check();await page.locator('button[data-label-part="fixed-anchor"]').click();assert.match(await detail.textContent(),/Fixed spring anchor/);
  await page.getByRole('heading',{name:'Window-shade winding spring',exact:true}).click();assert.match(await detail.textContent(),/Select a part to move closer/);
  await page.locator('[data-separation]').fill('100');await page.locator('[data-view="in"]').click();await page.locator('[data-view="out"]').click();assert.equal(await page.locator('[data-separation]').inputValue(),'100');await page.locator('[data-labels]').uncheck();await view(`separated-${width}`);
  await page.getByRole('button',{name:'Reassemble',exact:true}).click();await isolated.check();await page.locator('[data-reset-controls]').click();await selected();
  await page.locator('[data-number="coverage"]').fill('.2');await page.locator('[data-number="coverage"]').press('Enter');assert.equal(await read('Lowering target'),'16%');await page.locator('[data-control="coverage"]').focus();await page.keyboard.press('ArrowRight');assert.equal(await page.locator('[data-control="coverage"]').inputValue(),'0.25');
  await page.getByRole('button',{name:lesson.quiz.options[1],exact:true}).click();assert.match(await page.locator('.daily-answer').textContent(),/Try thinking/);await page.getByRole('button',{name:lesson.quiz.options[0],exact:true}).click();assert.match(await page.locator('.daily-answer').textContent(),/That’s right/);
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
 }
 assert.deepEqual(errors,[]);console.log('PASS spring browser: eight independent preset/viewport cases, conserved-wire outcome readings, gentle retention, brisk unwind, retained spring view, explicit window inspection, replay/pause/step/reset, controls, labels/dismissal, separation, zoom-only buttons, exterior, keyboard and quiz.');
}catch(error){await page.screenshot({path:`${evidence}/failure.png`,fullPage:true}).catch(()=>{});throw error;}
finally{await writeFile(`${evidence}/browser.json`,JSON.stringify({base,browser:browser.version(),cases,errors},null,2)+'\n');await browser.close();}

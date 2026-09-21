import assert from 'node:assert/strict';
import * as THREE from 'three';
import {chromium} from 'playwright';
import {createWindowShadeModel} from './window-shade-model.js';
import {houseComponents} from './house-components.js';
import {mkdir,writeFile} from 'node:fs/promises';
const m=createWindowShadeModel({rodLesson:true}),part=id=>m.parts.find(p=>p.id===id).object;
m.root.updateMatrixWorld(true);
const fixedIds=['shaft','fixed-anchor','hub','supports'],matrices=new Map(fixedIds.map(id=>[id,part(id).matrixWorld.clone()]));
const gold=part('moving-anchor'),reference=part('assembly').worldToLocal(gold.localToWorld(new THREE.Vector3(0,.19,0))),phase0=Math.atan2(reference.z,reference.y);
let poses=0;
function check(){m.root.updateMatrixWorld(true);for(const id of fixedIds)assert.ok(part(id).matrixWorld.equals(matrices.get(id)),id+' remains fixed');const q=part('assembly').worldToLocal(gold.localToWorld(new THREE.Vector3(0,.19,0))),phase=Math.atan2(q.z,q.y),actual=Math.atan2(Math.sin(phase-phase0),Math.cos(phase-phase0)),angle=m.getState().angle,expected=Math.atan2(Math.sin(angle),Math.cos(angle));assert.ok(Math.abs(Math.atan2(Math.sin(actual-expected),Math.cos(actual-expected)))<1e-9,'actual gold spoke follows roller angle');for(const id of ['roller','carrier','spool'])assert.ok(Math.abs(part(id).rotation.x-(phase0+angle))<1e-9,id+' shares the roller motion');const center=part('assembly').worldToLocal(gold.localToWorld(new THREE.Vector3()));assert.ok(Math.hypot(center.y,center.z)<1e-9,'outer anchor stays coaxial with fixed rod');assert.equal(m.getState().readings.find(r=>r.label==='Rod rotation').value,'0.00 turns');assert.equal(m.getState().readings.find(r=>r.label==='Roller rotation').value,(angle/(2*Math.PI)).toFixed(2)+' turns');poses++;}
check();m.update({coverage:1});let previous=0;for(let i=0;i<30&&!m.getState().complete;i++){m.advance(.5);check();assert.ok(m.getState().angle>=previous-.2,'lowering ends with only its small seating return');previous=m.getState().angle;}assert.equal(m.getState().coverage,1);assert.equal(m.getState().held,true);
m.update({operation:1,release:1});m.advance(.55);assert.equal(m.getState().stage,'rewind');previous=m.getState().angle;while(!m.getState().complete){m.advance(.2);check();assert.ok(m.getState().angle<previous,'roller reverses through rewind');previous=m.getState().angle;}assert.equal(m.getState().coverage,0);m.reset();check();
const component=houseComponents['Window-shade roller shaft and fixed central rod'],lesson=component.lesson,expected=[];
const parent=createWindowShadeModel();assert.equal(parent.resultPart.focusOnComplete,true);assert.equal(parent.getState().readings.some(r=>r.label==='Rod rotation'),false,'comparison belongs only to rod lesson');
const parentShaft=parent.parts.find(p=>p.id==='shaft').object;
for(const i of [0,1]){assert.equal(part('shaft').children[i].material.color.getHex(),0x83b4c1);assert.equal(parentShaft.children[i].material.color.getHex(),0x374736);assert.deepEqual(part('shaft').children[i].geometry.attributes.position.array,parentShaft.children[i].geometry.attributes.position.array,'highlight leaves physical dimensions unchanged');}
parent.dispose();const dedicated=component.createModel();assert.equal(dedicated.resultPart.focusOnComplete,false);dedicated.dispose();
for(const [index,preset] of lesson.tryIt.entries()){
 m.reset(preset.initialState);m.update(preset.values);check();const initial=m.getState(),start=initial.angle;assert.equal(initial.winding,index>=2?1.25:0);
 m.advance(20);check();const final=m.getState();assert.equal(final.winding,[.75,1.75,0,1.25][index]);assert.equal(final.complete,true);expected.push({initial:initial.readings,final:final.readings});
 m.reset(m.replayState());m.update(preset.values);assert.equal(m.getState().angle,start);check();
}
m.dispose();console.log(`PASS rod geometry: ${poses} fixed support/rod/hub poses, measured rotating spoke, common roller/disk/fabric motion, coaxial anchor and reversed rewind.`);
if(process.env.MODEL_ONLY==='1')process.exit(0);
const base=process.env.SITE_URL||'http://127.0.0.1:5193/',evidence=process.env.EVIDENCE_DIR||'documentation/audit/evidence/shade-rod-20260919/local';
await mkdir(evidence,{recursive:true});
const browser=await chromium.launch({headless:true}),page=await browser.newPage({viewport:{width:1440,height:1000},reducedMotion:'reduce'}),errors=[],cases=[];
page.on('pageerror',e=>errors.push(e.message));
const isolated=page.locator('[data-isolate]'),detail=page.locator('.daily-part-detail'),play=page.locator('[data-play]');
const read=label=>page.locator('.daily-readings > div').filter({has:page.locator('dt',{hasText:new RegExp('^'+label+'$')})}).locator('dd').textContent();
const view=async name=>{await page.locator('canvas').scrollIntoViewIfNeeded();await page.screenshot({path:`${evidence}/${name}.png`,clip:await page.locator('canvas').boundingBox()});};
let currentPart=/Fixed central rod/;
const selected=async()=>{assert.equal(await isolated.isChecked(),false);assert.match(await detail.textContent(),currentPart);};
const setup=async i=>{currentPart=i===1?/Rotating roller tube/:/Fixed central rod/;await page.getByRole('tab',{name:'Try it yourself',exact:true}).click();await page.locator('[data-experiment]').nth(i).click();await page.getByRole('tab',{name:'Controls',exact:true}).click();await selected();};
const complete=async()=>{await play.click();await page.locator('[data-play][title^="Play again"]').waitFor({timeout:25000});};
try{
 for(const width of [1440,390]){
  await page.setViewportSize({width,height:width===1440?1000:844});await page.goto(`${base}#machine/window-shade-roller-shaft-and-fixed-central-rod`);await page.reload();
  await page.getByRole('heading',{name:'Window-shade roller shaft and fixed central rod',exact:true}).waitFor();await selected();
  for(const [index,preset] of lesson.tryIt.entries()){
   await setup(index);
   for(const label of ['Window covered','Rod rotation','Roller rotation'])assert.equal(await read(label),expected[index].initial.find(r=>r.label===label).value);
   for(const [key,value] of Object.entries(preset.values))assert.equal(await page.locator(`[data-control="${key}"]`).inputValue(),String(value));
   await view(`initial-${width}-${index}`);if(index===1){await page.locator('[data-cutaway]').uncheck();await view(`outer-tube-${width}`);await page.locator('[data-cutaway]').check();}
   await page.locator('[data-step]').click();await selected();
   if(index>=2){assert.ok(parseFloat(await read('Roller rotation'))>1.25,'tug first turns the roller farther');await view(`tug-${width}-${index}`);}
   await complete();await selected();
   const rod=await read('Rod rotation'),roller=await read('Roller rotation');assert.equal(rod,'0.00 turns');
   for(const label of ['Window covered','Rod rotation','Roller rotation','Holding position'])assert.equal(await read(label),expected[index].final.find(r=>r.label===label).value);
   await view(`final-${width}-${index}`);
   await play.click();await play.click();await selected();const paused=await read('Roller rotation');await page.waitForTimeout(100);assert.equal(await read('Roller rotation'),paused);
   if(index>=2)assert.ok(parseFloat(paused)>=1.25,'release replay restores retained roller position');
   await page.locator('[data-step]').click();await selected();await page.locator('[data-reset-controls]').click();currentPart=/Fixed central rod/;await selected();assert.equal(await read('Roller rotation'),'0.00 turns');
   cases.push({width,title:preset.title,rod,roller});console.log(width,preset.title);
  }
  await setup(3);await complete();await page.locator('[data-result]').click();assert.match(await detail.textContent(),/Window and spring roller/);await view(`window-${width}`);
  await page.locator('[data-reset-controls]').click();currentPart=/Fixed central rod/;await selected();await page.locator('[data-cutaway]').uncheck();await view(`exterior-${width}`);await page.locator('[data-cutaway]').check();
  await page.locator('[data-labels]').check();await page.locator('button[data-label-part="fixed-anchor"]').click();assert.match(await detail.textContent(),/Fixed spring anchor/);
  await page.getByRole('heading',{name:'Window-shade roller shaft and fixed central rod',exact:true}).click();assert.match(await detail.textContent(),/Select a part to move closer/);
  await page.locator('[data-separation]').fill('100');await page.locator('[data-view="in"]').click();await page.locator('[data-view="out"]').click();assert.equal(await page.locator('[data-separation]').inputValue(),'100');await page.locator('[data-labels]').uncheck();await view(`separated-${width}`);
  await page.getByRole('button',{name:'Reassemble',exact:true}).click();await isolated.check();await page.locator('[data-reset-controls]').click();currentPart=/Fixed central rod/;await selected();
  await page.locator('[data-number="coverage"]').fill('.2');await page.locator('[data-number="coverage"]').press('Enter');assert.equal(await read('Lowering target'),'16%');await page.locator('[data-control="coverage"]').focus();await page.keyboard.press('ArrowRight');assert.equal(await page.locator('[data-control="coverage"]').inputValue(),'0.25');
  await page.getByRole('button',{name:lesson.quiz.options[1],exact:true}).click();assert.match(await page.locator('.daily-answer').textContent(),/Try thinking/);await page.getByRole('button',{name:lesson.quiz.options[0],exact:true}).click();assert.match(await page.locator('.daily-answer').textContent(),/That’s right/);
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
 }
 assert.deepEqual(errors,[]);console.log('PASS rod browser: eight independent preset/viewport cases, fixed/rotating readout comparison, gentle recatch, brisk reverse, retained selected part, cutaway, explicit window inspection, replay/pause/step/reset, controls, labels/dismissal, separation, zoom-only buttons, keyboard and quiz.');
}catch(error){await page.screenshot({path:`${evidence}/failure.png`,fullPage:true}).catch(()=>{});throw error;}
finally{await writeFile(`${evidence}/browser.json`,JSON.stringify({base,browser:browser.version(),cases,errors},null,2)+'\n');await browser.close();}

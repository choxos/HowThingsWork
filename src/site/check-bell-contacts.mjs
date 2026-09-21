import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import * as THREE from 'three';
import {mkdir,writeFile} from 'node:fs/promises';
import {houseComponents} from './house-components.js';
import {createBellModel} from './bell-model.js';

const component=houseComponents['Electromagnetic make-and-break contacts'],lesson=component.lesson,expected=[];
const parent=createBellModel();assert.equal(parent.resultPart.focusOnComplete,true);parent.dispose();
let poses=0;
for(const [index,preset] of lesson.tryIt.entries()){
 const model=component.createModel();assert.equal(model.resultPart.focusOnComplete,false);model.update(preset.values);
 const mesh=id=>model.parts.find(p=>p.id===id).object.children.find(o=>o.geometry?.type==='RoundedBoxGeometry');
 let openings=0,closings=0,previous=model.getState(),decayed=false,bypassHeld=false,peak=0;
 assert.equal(previous.contactOpenings,0,'setup screw movement is not an armature opening');
 const initial=previous.readings;for(let i=0;i<6;i++)model.playback.step();const active=model.getState().readings;model.reset();model.update(preset.values);previous=model.getState();
 for(let i=0;i<1600&&!model.getState().complete;i++){
  model.advance(.005);const state=model.getState();model.root.updateMatrixWorld(true);
  const fixed=new THREE.Box3().setFromObject(mesh('fixed-contact')),moving=new THREE.Box3().setFromObject(mesh('moving-contact'));
  assert.ok(Math.abs(moving.min.x-fixed.max.x-state.contactGap)<1e-7,'actual conducting faces agree with contact reading');
  if(previous.contactClosed&&!state.contactClosed)openings++;
  if(!previous.contactClosed&&state.contactClosed)closings++;
  assert.equal(state.contactOpenings,openings,'fixed-step counter matches independently sampled actual contact transitions');
  assert.equal(state.readings.find(r=>r.label==='Contact openings').value,String(openings));
  if(state.pressed&&!state.contactClosed&&previous.current>state.current+.005)decayed=true;
  if(state.pressed&&!state.contactClosed&&state.current>.29&&state.strikes===1)bypassHeld=true;
  if(preset.values.contact===1)assert.equal(state.current,0,'held-open contact admits no current');
  peak=Math.max(peak,state.angle);previous=state;poses++;
 }
 assert.equal(previous.complete,true);assert.equal(previous.strikes,[3,0,1,0][index]);assert.equal(openings,[5,0,1,4][index]);assert.equal(previous.current,0);assert.equal(previous.angle,0);
 if(preset.values.contact===0)assert.ok(openings>=3&&closings===openings&&decayed,'normal contact repeatedly opens, loses current and recloses');
 if(preset.values.contact===2)assert.ok(bypassHeld,'open contact with bypass still carries holding current');
 if(index===3)assert.ok(peak>Math.asin(.003/.03)&&peak<Math.asin(.0048/.03),'weak supply opens contact without reaching gong');
 expected.push({initial,active,final:previous.readings,openings,closings,peakDegrees:peak*180/Math.PI});
 const frozen=model.getState();model.advance(10);assert.equal(model.getState().contactOpenings,frozen.contactOpenings,'completion freezes event count');model.reset();assert.equal(model.getState().contactOpenings,0);
 for(const rate of [30,144]){model.reset();model.update(preset.values);for(let i=0;i<1300&&!model.getState().complete;i++)model.advance(1/rate);assert.equal(model.getState().complete,true);assert.equal(model.getState().contactOpenings,openings,'event count independent of display frames');assert.equal(model.getState().strikes,[3,0,1,0][index]);}
 model.update({...preset.values,voltage:preset.values.voltage===3?3.5:3});model.advance(.001);assert.equal(model.getState().contactOpenings,0,'new trial clears prior events');model.dispose();
}
console.log(`PASS contact model: ${poses} actual face-gap poses, independent opening/reclosing counts, current decay, held-open zero current, bypass holding current, weak cycling without impact, frame-rate independence and per-trial reset.`);
if(process.env.MODEL_ONLY==='1')process.exit(0);
const base=process.env.SITE_URL||'http://127.0.0.1:5193/',evidence=process.env.EVIDENCE_DIR||'documentation/audit/evidence/bell-contacts-20260919/local';await mkdir(evidence,{recursive:true});
const browser=await chromium.launch({headless:true}),page=await browser.newPage({viewport:{width:1440,height:1000},reducedMotion:'reduce'}),errors=[],cases=[];page.on('pageerror',e=>errors.push(e.message));
const detail=page.locator('.daily-part-detail'),isolated=page.locator('[data-isolate]'),play=page.locator('[data-play]');
const read=label=>page.locator('.daily-readings>div').filter({has:page.locator('dt',{hasText:new RegExp('^'+label+'$')})}).locator('dd').textContent();
const selected=async()=>{assert.equal(await isolated.isChecked(),false);assert.match(await detail.textContent(),/Make-and-break contacts/);};
const setup=async i=>{await page.getByRole('tab',{name:'Try it yourself',exact:true}).click();await page.locator('[data-experiment]').nth(i).click();await page.getByRole('tab',{name:'Controls',exact:true}).click();await selected();};
const complete=async()=>{await play.click();await page.locator('[data-play][title^="Play again"]').waitFor({timeout:20000});};
const shot=async name=>{await page.locator('canvas').scrollIntoViewIfNeeded();await page.screenshot({path:`${evidence}/${name}.png`,clip:await page.locator('canvas').boundingBox()});};
try{
 for(const width of [1440,390]){
  await page.setViewportSize({width,height:width===1440?1000:844});await page.goto(`${base}#machine/electromagnetic-make-and-break-contacts`);await page.reload();await page.getByRole('heading',{name:'Electromagnetic make-and-break contacts',exact:true}).waitFor();await selected();assert.match(await page.title(),/^Electromagnetic make-and-break contacts/);
  for(const [index,preset] of lesson.tryIt.entries()){
   await setup(index);for(const [key,value] of Object.entries(preset.values))assert.equal(await page.locator(`[data-control="${key}"]`).inputValue(),String(value));assert.equal(await read('Time since press'),'0.0 ms');assert.equal(await read('Contact openings'),'0');await shot(`initial-${width}-${index}`);
   for(let i=0;i<6;i++)await page.locator('[data-step]').click();await selected();for(const label of ['Contact openings','Armature angle','Time since press','Hammer strikes','Coil current','Moving contact'])assert.equal(await read(label),expected[index].active.find(r=>r.label===label).value);await shot(`active-${width}-${index}`);
   await complete();await selected();for(const label of ['Contact openings','Armature angle','Hammer strikes','Time since press'])assert.equal(await read(label),expected[index].final.find(r=>r.label===label).value);await shot(`final-${width}-${index}`);
   await play.click();await play.click();await selected();const frozen=await read('Time since press');await page.waitForTimeout(100);assert.equal(await read('Time since press'),frozen);assert.ok(parseFloat(frozen)<30);await page.locator('[data-step]').click();await selected();await complete();await selected();assert.equal(await read('Hammer strikes'),String([3,0,1,0][index]));
   cases.push({width,title:preset.title,result:await read('Your result'),peakDegrees:expected[index].peakDegrees});await page.locator('[data-reset-controls]').click();await selected();assert.equal(await read('Armature angle'),'0.0°');console.log(width,preset.title);
  }
  await page.locator('[data-result]').click();assert.match(await detail.textContent(),/Connected electric bell/);await shot(`whole-bell-${width}`);await page.locator('[data-reset-controls]').click();await selected();
  await page.locator('[data-labels]').check();await page.locator('button[data-label-part="coils"]').click();assert.match(await detail.textContent(),/Two connected coils/);await page.getByRole('heading',{name:'Electromagnetic make-and-break contacts',exact:true}).click();assert.match(await detail.textContent(),/Select a part/);await page.locator('[data-labels]').uncheck();
  await page.locator('[data-separation]').fill('100');await page.locator('[data-view="in"]').click();await page.locator('[data-view="out"]').click();assert.equal(await page.locator('[data-separation]').inputValue(),'100');await shot(`separated-${width}`);await page.getByRole('button',{name:'Reassemble',exact:true}).click();
  await isolated.check();await page.locator('[data-reset-controls]').click();await selected();await page.getByRole('button',{name:lesson.quiz.options[1],exact:true}).click();assert.match(await page.locator('.daily-answer').textContent(),/Try thinking/);await page.getByRole('button',{name:lesson.quiz.options[0],exact:true}).click();assert.match(await page.locator('.daily-answer').textContent(),/That’s right/);assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
 }
 await page.goto(`${base}#list`);const entry=page.locator('[data-entry="electromagnetic-make-and-break-contacts"]');assert.equal(await entry.textContent(),'Electromagnetic make-and-break contacts');assert.equal(await entry.locator('xpath=ancestor::tr').locator('[data-entry="electric-bell"]').count(),1,'component remains nested below whole bell');await entry.click();await page.getByRole('heading',{name:'Electromagnetic make-and-break contacts',exact:true}).waitFor();await selected();
 await page.getByRole('link',{name:'Electric bell →',exact:true}).click();await page.getByRole('heading',{name:'Electric bell',exact:true}).waitFor();await page.getByRole('link',{name:'Electromagnetic make-and-break contacts →',exact:true}).click();await page.getByRole('heading',{name:'Electromagnetic make-and-break contacts',exact:true}).waitFor();assert.deepEqual(errors,[]);
 console.log('PASS contact browser: eight preset/viewport cases, retained completion/replay, explicit whole-bell inspection, reset context, measured readings, labels/dismissal, separation, zoom buttons, quiz, catalog nesting/title, stable URL and related links.');
}catch(error){await page.screenshot({path:`${evidence}/failure.png`,fullPage:true}).catch(()=>{});throw error;}
finally{await writeFile(`${evidence}/browser.json`,JSON.stringify({base,browser:browser.version(),cases,errors},null,2)+'\n');await browser.close();}

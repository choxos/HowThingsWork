import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createBellModel} from './bell-model.js';
import {houseComponents} from './house-components.js';
import {chromium} from 'playwright';
import {mkdir,writeFile} from 'node:fs/promises';

const component=houseComponents['Electric-bell pushbutton switch'],lesson=component.lesson,m=component.createModel(),expected=[],strikes=[2,9,0,5];
assert.equal(m.resultPart.focusOnComplete,false);const parent=createBellModel();assert.equal(parent.resultPart.focusOnComplete,true);assert.equal(parent.getState().readings.some(r=>r.label==='Button held for'),false);parent.dispose();
const get=id=>m.parts.find(part=>part.id===id).object;let poses=0;
function check(){
 const state=m.getState();m.root.updateMatrixWorld(true);
 const bridge=new THREE.Box3().setFromObject(get('plunger').children.find(o=>o.geometry?.type==='RoundedBoxGeometry'));
 const terminals=get('button').children.filter(o=>o.geometry?.type==='RoundedBoxGeometry');assert.equal(terminals.length,2);
 for(const terminal of terminals){const bounds=new THREE.Box3().setFromObject(terminal);
  assert.ok(Math.abs(bridge.min.z-bounds.max.z-(state.pressed?0:.0675))<1e-8,'actual bridge gap agrees with button state');
  assert.ok(bridge.min.x<bounds.max.x&&bridge.max.x>bounds.min.x&&bridge.min.y<bounds.max.y&&bridge.max.y>bounds.min.y,'bridge overlaps both conducting terminals');
 }
 const spring=get('button-spring').children.find(o=>o.geometry?.type==='TubeGeometry'),path=spring.geometry.parameters.path;
 assert.ok(spring.localToWorld(path.getPoint(0)).distanceTo(get('button').localToWorld(new THREE.Vector3(0,0,-.025)))<1e-8,'spring stays on its fixed support');
 assert.ok(Math.abs(spring.localToWorld(path.getPoint(1)).z-bridge.min.z)<1e-8,'spring stays connected to bridge');
 assert.ok(Math.abs(path.getLength()-state.buttonWireLength)<1e-8,'compression conserves wire length');
 assert.equal(state.readings.find(r=>r.label==='Button held for').value,(state.buttonHeldTime*1000).toFixed(1)+' ms');poses++;
}
for(const [index,preset] of lesson.tryIt.entries()){
 m.reset();m.update(preset.values);check();const initial=m.getState().readings;for(let i=0;i<6;i++)m.playback.step();check();const active=m.getState().readings;
 m.reset();m.update(preset.values);let sawPress=false,sawOpen=false,sawClosed=false,previous=0;
 for(let step=0;step<2000&&!m.playback.complete();step++){
  check();const state=m.getState();assert.ok(state.buttonHeldTime>=previous);previous=state.buttonHeldTime;
  assert.ok(Math.abs(state.buttonHeldTime-Math.min(state.elapsed,preset.values.holdTime))<1e-9,'fixed preset holds for physical time only until release');
  if(state.pressed){sawPress=true;sawOpen ||= !state.contactClosed;sawClosed ||= state.contactClosed;}
  if(index===2)assert.equal(state.current,0,'button closure cannot conduct across the separate open contact');
  m.playback.advance(.017);
 }
 check();const state=m.getState();assert.equal(state.complete,true);assert.equal(state.pressed,false);assert.equal(state.strikes,strikes[index]);assert.ok(sawPress);
 assert.ok(Math.abs(state.buttonHeldTime-preset.values.holdTime)<1e-9);assert.ok(state.elapsed>state.buttonHeldTime);
 if(strikes[index])assert.ok(sawOpen&&sawClosed,'internal switch cycles while button stays pressed');
 expected.push({initial,active,final:state.readings});m.update({voltage:4});assert.equal(m.getState().buttonHeldTime,0,'new ready trial clears prior held time');
}
m.reset();m.update({holdTime:.8});m.advance(2.4);const held=m.getState().buttonHeldTime;assert.ok(Math.abs(held-.288)<1e-9);m.update({holdTime:.2});assert.equal(m.getState().buttonHeldTime,held,'shortening a running target does not rewrite time already held');m.advance(.02);assert.equal(m.getState().buttonHeldTime,held);assert.equal(m.getState().pressed,false);m.reset();assert.equal(m.getState().buttonHeldTime,0);check();m.dispose();
console.log(`PASS button: ${poses} actual bridge/terminal and anchored conserved-wire poses, accumulated hold duration, changed target/reset, broken path and four independent outcomes.`);
if(process.env.MODEL_ONLY==='1')process.exit(0);
const base=process.env.SITE_URL||'http://127.0.0.1:5193/',evidence=process.env.EVIDENCE_DIR||'documentation/audit/evidence/bell-button-20260919/local';await mkdir(evidence,{recursive:true});
const browser=await chromium.launch({headless:true}),page=await browser.newPage({viewport:{width:1440,height:1000},reducedMotion:'reduce'}),errors=[],cases=[];page.on('pageerror',e=>errors.push(e.message));
const detail=page.locator('.daily-part-detail'),isolated=page.locator('[data-isolate]'),play=page.locator('[data-play]');
const read=label=>page.locator('.daily-readings>div').filter({has:page.locator('dt',{hasText:new RegExp('^'+label+'$')})}).locator('dd').textContent();
const selected=async()=>{assert.equal(await isolated.isChecked(),false);assert.match(await detail.textContent(),/Door button/);};
const setup=async i=>{await page.getByRole('tab',{name:'Try it yourself',exact:true}).click();await page.locator('[data-experiment]').nth(i).click();await page.getByRole('tab',{name:'Controls',exact:true}).click();await selected();};
const complete=async()=>{await play.click();await page.locator('[data-play][title^="Play again"]').waitFor({timeout:20000});};
const shot=async name=>{await page.locator('canvas').scrollIntoViewIfNeeded();await page.screenshot({path:`${evidence}/${name}.png`,clip:await page.locator('canvas').boundingBox()});};
try{
 for(const width of [1440,390]){
  await page.setViewportSize({width,height:width===1440?1000:844});await page.goto(`${base}#machine/electric-bell-pushbutton-switch`);await page.reload();await page.getByRole('heading',{name:'Electric-bell pushbutton switch',exact:true}).waitFor();await selected();assert.match(await page.title(),/^Electric-bell pushbutton switch/);
  for(const [index,preset] of lesson.tryIt.entries()){
   await setup(index);for(const [key,value] of Object.entries(preset.values))assert.equal(await page.locator(`[data-control="${key}"]`).inputValue(),String(value));assert.equal(await read('Time since press'),'0.0 ms');await shot(`initial-${width}-${index}`);
   for(let i=0;i<6;i++)await page.locator('[data-step]').click();await selected();for(const label of ['Button held for','Button','Armature angle','Time since press','Hammer strikes','Coil current','Moving contact'])assert.equal(await read(label),expected[index].active.find(r=>r.label===label).value);await shot(`active-${width}-${index}`);
   await complete();await selected();for(const label of ['Button held for','Button','Armature angle','Hammer strikes','Time since press'])assert.equal(await read(label),expected[index].final.find(r=>r.label===label).value);await shot(`final-${width}-${index}`);
   await play.click();await play.click();await selected();const frozen=await read('Time since press');await page.waitForTimeout(100);assert.equal(await read('Time since press'),frozen);assert.ok(parseFloat(frozen)<30);await page.locator('[data-step]').click();await selected();await complete();await selected();assert.equal(await read('Hammer strikes'),String(strikes[index]));
   cases.push({width,title:preset.title,result:await read('Your result'),heldTime:await read('Button held for')});await page.locator('[data-reset-controls]').click();await selected();assert.equal(await read('Armature angle'),'0.0°');console.log(width,preset.title);
  }
  await page.locator('[data-result]').click();assert.match(await detail.textContent(),/Connected electric bell/);await shot(`whole-bell-${width}`);await page.locator('[data-reset-controls]').click();await selected();
  await page.locator('[data-labels]').check();await page.locator('button[data-label-part="coils"]').click();assert.match(await detail.textContent(),/Two connected coils/);await page.getByRole('heading',{name:'Electric-bell pushbutton switch',exact:true}).click();assert.match(await detail.textContent(),/Select a part/);await page.locator('[data-labels]').uncheck();
  await page.locator('[data-separation]').fill('100');await page.locator('[data-view="in"]').click();await page.locator('[data-view="out"]').click();assert.equal(await page.locator('[data-separation]').inputValue(),'100');await shot(`separated-${width}`);await page.getByRole('button',{name:'Reassemble',exact:true}).click();
  await isolated.check();await page.locator('[data-reset-controls]').click();await selected();await page.getByRole('button',{name:lesson.quiz.options[1],exact:true}).click();assert.match(await page.locator('.daily-answer').textContent(),/Try thinking/);await page.getByRole('button',{name:lesson.quiz.options[0],exact:true}).click();assert.match(await page.locator('.daily-answer').textContent(),/That’s right/);assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
 }
 await page.goto(`${base}#list`);const entry=page.locator('[data-entry="electric-bell-pushbutton-switch"]');assert.equal(await entry.textContent(),'Electric-bell pushbutton switch');assert.equal(await entry.locator('xpath=ancestor::tr').locator('[data-entry="electric-bell"]').count(),1,'component remains nested below whole bell');await entry.click();await page.getByRole('heading',{name:'Electric-bell pushbutton switch',exact:true}).waitFor();await selected();
 await page.getByRole('link',{name:'Electric bell →',exact:true}).click();await page.getByRole('heading',{name:'Electric bell',exact:true}).waitFor();await page.getByRole('link',{name:'Electric-bell pushbutton switch →',exact:true}).click();await page.getByRole('heading',{name:'Electric-bell pushbutton switch',exact:true}).waitFor();assert.deepEqual(errors,[]);
 console.log('PASS button browser: eight preset/viewport cases, retained completion/replay, explicit whole-bell inspection, reset context, measured readings, labels/dismissal, separation, zoom buttons, quiz, catalog nesting/title, stable URL and related links.');
}catch(error){await page.screenshot({path:`${evidence}/failure.png`,fullPage:true}).catch(()=>{});throw error;}
finally{await writeFile(`${evidence}/browser.json`,JSON.stringify({base,browser:browser.version(),cases,errors},null,2)+'\n');await browser.close();}

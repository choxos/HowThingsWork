import assert from 'node:assert/strict';
import * as THREE from 'three';
import {chromium} from 'playwright';
import {mkdir,writeFile} from 'node:fs/promises';
import {houseComponents} from './house-components.js';
import {createBellModel} from './bell-model.js';

const component=houseComponents['Electric-bell return spring'],lesson=component.lesson,m=component.createModel(),get=id=>m.parts.find(p=>p.id===id).object,expected=[];
assert.equal(m.resultPart.focusOnComplete,false);const parent=createBellModel();assert.equal(parent.resultPart.focusOnComplete,true);assert.equal(parent.getState().readings.some(r=>r.label==='Stored spring energy'),false);parent.dispose();
let poses=0;
function check(){
 m.root.updateMatrixWorld(true);const s=m.getState(),actualAngle=-get('armature').rotation.z,coil=get('spring').children.find(o=>o.geometry?.type==='TubeGeometry'),path=coil.geometry.parameters.path;
 assert.ok(coil.localToWorld(path.getPoint(0)).distanceTo(get('pivot').localToWorld(new THREE.Vector3(-.18,0,.03)))<1e-8,'fixed wire end stays on actual supported terminal');
 assert.ok(coil.localToWorld(path.getPoint(1)).distanceTo(get('armature').localToWorld(new THREE.Vector3(.18,0,.17)))<1e-8,'moving wire end stays on actual armature peg');
 assert.ok(Math.abs(path.getLength()-s.wireLength)<1e-8,'deforming spring conserves wire length');
 assert.equal(s.angle,actualAngle);assert.ok(Math.abs(s.springTorque-.054*actualAngle)<1e-12);assert.ok(Math.abs(s.springEnergy-.027*actualAngle**2)<1e-12);
 assert.equal(s.readings.find(r=>r.label==='Spring restoring torque').value,(.054*actualAngle*1000).toFixed(2)+' mN·m');assert.equal(s.readings.find(r=>r.label==='Stored spring energy').value,(.027*actualAngle**2*1000).toFixed(3)+' mJ');poses++;
}
for(const [index,preset] of lesson.tryIt.entries()){
 m.reset();m.update(preset.values);check();const initial=m.getState().readings;for(let i=0;i<6;i++)m.playback.step();check();const active=m.getState().readings;m.reset();m.update(preset.values);let peak=0,returning=false,held=false,previous=m.getState();
 for(let i=0;i<500&&!m.getState().complete;i++){
  m.advance(.02);check();const s=m.getState();peak=Math.max(peak,s.angle);if(s.angle<previous.angle){returning=true;assert.ok(s.springEnergy<previous.springEnergy);}
  const springWork=-.5*(previous.springTorque+s.springTorque)*(s.angle-previous.angle);assert.ok(Math.abs(springWork+s.springEnergy-previous.springEnergy)<1e-12,'restoring work equals lost elastic energy');
  if(index===1&&s.pressed&&s.strikes===1&&s.elapsed>.2){held=true;assert.ok(s.springTorque>.0086&&s.springEnergy>.00069,'bypass holds a loaded spring, not an inactive spring');}
  previous=s;
 }
 const s=m.getState();assert.equal(s.complete,true);assert.equal(s.strikes,[3,1,0,6][index]);assert.equal(s.springTorque,0);assert.equal(s.springEnergy,0);assert.ok(returning);if(index===1)assert.ok(held);if(index===2)assert.ok(peak<.041);else assert.ok(peak>.15&&peak<=Math.asin(.0048/.03),'sampled peaks approach but cannot exceed the impact stop');
 expected.push({initial,active,final:s.readings,peak:peak*180/Math.PI});
}
for(const voltage of [3,4.5]){m.reset();m.update({voltage});for(let i=0;i<5000&&!m.getState().strikes;i++)m.advance(.00005/.12);check();const s=m.getState();assert.equal(s.strikes,1);assert.equal(s.angle,Math.asin(.0048/.03));assert.ok(Math.abs(s.springTorque-.054*Math.asin(.0048/.03))<1e-12);assert.ok(Math.abs(s.springEnergy-.027*Math.asin(.0048/.03)**2)<1e-12);}
m.dispose();console.log(`PASS spring: ${poses} actual anchored/conserved-wire poses, angle-derived restoring torque/energy, work balance, loaded bypass, weak deflection and four independent outcomes.`);
if(process.env.MODEL_ONLY==='1')process.exit(0);
const base=process.env.SITE_URL||'http://127.0.0.1:5193/',evidence=process.env.EVIDENCE_DIR||'documentation/audit/evidence/bell-return-spring-20260919/local';await mkdir(evidence,{recursive:true});
const browser=await chromium.launch({headless:true}),page=await browser.newPage({viewport:{width:1440,height:1000},reducedMotion:'reduce'}),errors=[],cases=[];page.on('pageerror',e=>errors.push(e.message));
const detail=page.locator('.daily-part-detail'),isolated=page.locator('[data-isolate]'),play=page.locator('[data-play]');
const read=label=>page.locator('.daily-readings>div').filter({has:page.locator('dt',{hasText:new RegExp('^'+label+'$')})}).locator('dd').textContent();
const selected=async()=>{assert.equal(await isolated.isChecked(),false);assert.match(await detail.textContent(),/Torsion return spring/);};
const setup=async i=>{await page.getByRole('tab',{name:'Try it yourself',exact:true}).click();await page.locator('[data-experiment]').nth(i).click();await page.getByRole('tab',{name:'Controls',exact:true}).click();await selected();};
const complete=async()=>{await play.click();await page.locator('[data-play][title^="Play again"]').waitFor({timeout:20000});};
const shot=async name=>{await page.locator('canvas').scrollIntoViewIfNeeded();await page.screenshot({path:`${evidence}/${name}.png`,clip:await page.locator('canvas').boundingBox()});};
try{
 for(const width of [1440,390]){
  await page.setViewportSize({width,height:width===1440?1000:844});await page.goto(`${base}#machine/electric-bell-return-spring`);await page.reload();await page.getByRole('heading',{name:'Electric-bell return spring',exact:true}).waitFor();await selected();assert.match(await page.title(),/^Electric-bell return spring/);
  for(const [index,preset] of lesson.tryIt.entries()){
   await setup(index);for(const [key,value] of Object.entries(preset.values))assert.equal(await page.locator(`[data-control="${key}"]`).inputValue(),String(value));assert.equal(await read('Time since press'),'0.0 ms');await shot(`initial-${width}-${index}`);
   for(let i=0;i<6;i++)await page.locator('[data-step]').click();await selected();for(const label of ['Spring restoring torque','Stored spring energy','Armature angle','Time since press','Hammer strikes','Coil current','Moving contact'])assert.equal(await read(label),expected[index].active.find(r=>r.label===label).value);await shot(`active-${width}-${index}`);
   await complete();await selected();for(const label of ['Spring restoring torque','Stored spring energy','Armature angle','Hammer strikes','Time since press'])assert.equal(await read(label),expected[index].final.find(r=>r.label===label).value);await shot(`final-${width}-${index}`);
   await play.click();await play.click();await selected();const frozen=await read('Time since press');await page.waitForTimeout(100);assert.equal(await read('Time since press'),frozen);assert.ok(parseFloat(frozen)<30);await page.locator('[data-step]').click();await selected();await complete();await selected();assert.equal(await read('Hammer strikes'),String([3,1,0,6][index]));
   cases.push({width,title:preset.title,result:await read('Your result'),peakDegrees:expected[index].peak});await page.locator('[data-reset-controls]').click();await selected();assert.equal(await read('Armature angle'),'0.0°');console.log(width,preset.title);
  }
  await page.locator('[data-result]').click();assert.match(await detail.textContent(),/Connected electric bell/);await shot(`whole-bell-${width}`);await page.locator('[data-reset-controls]').click();await selected();
  await page.locator('[data-labels]').check();await page.locator('button[data-label-part="coils"]').click();assert.match(await detail.textContent(),/Two connected coils/);await page.getByRole('heading',{name:'Electric-bell return spring',exact:true}).click();assert.match(await detail.textContent(),/Select a part/);await page.locator('[data-labels]').uncheck();
  await page.locator('[data-separation]').fill('100');await page.locator('[data-view="in"]').click();await page.locator('[data-view="out"]').click();assert.equal(await page.locator('[data-separation]').inputValue(),'100');await shot(`separated-${width}`);await page.getByRole('button',{name:'Reassemble',exact:true}).click();
  await isolated.check();await page.locator('[data-reset-controls]').click();await selected();await page.getByRole('button',{name:lesson.quiz.options[1],exact:true}).click();assert.match(await page.locator('.daily-answer').textContent(),/Try thinking/);await page.getByRole('button',{name:lesson.quiz.options[0],exact:true}).click();assert.match(await page.locator('.daily-answer').textContent(),/That’s right/);assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
 }
 await page.goto(`${base}#list`);const entry=page.locator('[data-entry="electric-bell-return-spring"]');assert.equal(await entry.textContent(),'Electric-bell return spring');assert.equal(await entry.locator('xpath=ancestor::tr').locator('[data-entry="electric-bell"]').count(),1,'component remains nested below whole bell');await entry.click();await page.getByRole('heading',{name:'Electric-bell return spring',exact:true}).waitFor();await selected();
 await page.getByRole('link',{name:'Electric bell →',exact:true}).click();await page.getByRole('heading',{name:'Electric bell',exact:true}).waitFor();await page.getByRole('link',{name:'Electric-bell return spring →',exact:true}).click();await page.getByRole('heading',{name:'Electric-bell return spring',exact:true}).waitFor();assert.deepEqual(errors,[]);
 console.log('PASS spring browser: eight preset/viewport cases, retained completion/replay, explicit whole-bell inspection, reset context, measured readings, labels/dismissal, separation, zoom buttons, quiz, catalog nesting/title, stable URL and related links.');
}catch(error){await page.screenshot({path:`${evidence}/failure.png`,fullPage:true}).catch(()=>{});throw error;}
finally{await writeFile(`${evidence}/browser.json`,JSON.stringify({base,browser:browser.version(),cases,errors},null,2)+'\n');await browser.close();}

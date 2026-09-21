import assert from 'node:assert/strict';
import * as THREE from 'three';
import {chromium} from 'playwright';
import {mkdir,writeFile} from 'node:fs/promises';
import {houseComponents} from './house-components.js';
import {createBellModel} from './bell-model.js';

const component=houseComponents['Electric-bell hammer and metal bell'],lesson=component.lesson,m=component.createModel(),get=id=>m.parts.find(p=>p.id===id).object,expected=[];
assert.equal(m.resultPart.focusOnComplete,false);const parent=createBellModel();assert.equal(parent.resultPart.focusOnComplete,true);assert.equal(parent.getState().readings.some(r=>r.label==='Hammer to rim'),false);parent.dispose();
let poses=0;
function check(){
 m.root.updateMatrixWorld(true);const s=m.getState(),ball=get('hammer').children.find(o=>o.geometry?.type==='SphereGeometry'),shell=get('gong').children.find(o=>o.geometry?.type==='SphereGeometry');
 const center=ball.getWorldPosition(new THREE.Vector3()),gong=shell.getWorldPosition(new THREE.Vector3()),gap=center.distanceTo(gong)-ball.geometry.parameters.radius-shell.geometry.parameters.radius;
 assert.ok(Math.abs(center.z-gong.z)<1e-9,'hammer center and circular rim share a plane');assert.ok(gap>=-1e-9,'hammer surface never penetrates the rim');assert.ok(Math.abs(s.hammerGap-Math.max(0,gap))<1e-9,'reading uses actual surface clearance');
 assert.equal(s.readings.find(r=>r.label==='Hammer to rim').value,(Math.max(0,gap)*1000/30).toFixed(2)+' mm');poses++;
}
for(const [index,preset] of lesson.tryIt.entries()){
 m.reset();m.update(preset.values);check();const initial=m.getState().readings;for(let i=0;i<6;i++)m.playback.step();check();const active=m.getState().readings;m.reset();m.update(preset.values);let minGap=Infinity;
 for(let i=0;i<500&&!m.getState().complete;i++){m.advance(.02);check();minGap=Math.min(minGap,m.getState().hammerGap);}
 const s=m.getState();assert.equal(s.complete,true);assert.equal(s.strikes,[3,1,0,6][index]);assert.ok(Math.abs(s.hammerGap*1000/30-9.799711173385584)<1e-9);assert.ok(get('waves').children.every(o=>!o.visible),'impact rings expire after final withdrawal');if(index===2)assert.ok(minGap*1000/30>7.3,'weak stroke stays visibly short');else assert.ok(minGap*1000/30<.1,'striking strokes approach contact');expected.push({initial,active,final:s.readings,minGapMm:minGap*1000/30});m.update({voltage:preset.values.voltage===3?3.5:3});assert.equal(m.getState().stage,'ready');assert.equal(m.getState().elapsed,0,'changed completed trial starts with zero time');assert.equal(m.getState().strikes,0);assert.equal(m.getState().contactOpenings,0);assert.ok(get('waves').children.every(o=>!o.visible),'changed ready trial cannot revive an old impact marker');
}
for(const voltage of [3,4.5]){
 m.reset();m.update({voltage});for(let i=0;i<5000&&!m.getState().strikes;i++)m.advance(.00005/.12);check();const s=m.getState();assert.equal(s.strikes,1);assert.ok(s.hammerGap<1e-9);assert.ok(get('waves').children.some(o=>o.visible),'actual impact triggers diagram rings');
 const ball=get('hammer').children.find(o=>o.geometry?.type==='SphereGeometry'),point=get('gong').localToWorld(new THREE.Vector3(-.6,0,0)),ray=new THREE.Raycaster(point.clone().add(new THREE.Vector3(.01,0,0)),new THREE.Vector3(-1,0,0),0,.013),hit=ray.intersectObject(ball,false)[0];assert.ok(hit&&Math.abs(hit.distance-.01)<.001,'tessellated hammer surface reaches the physical rim within mesh resolution');
}
m.dispose();console.log(`PASS hammer: ${poses} actual surface-clearance poses, exact 50 µs impact contact, no penetration, weak stroke remaining over 7.3 mm short, impact-ring timing and four independent outcomes.`);
if(process.env.MODEL_ONLY==='1')process.exit(0);
const base=process.env.SITE_URL||'http://127.0.0.1:5193/',evidence=process.env.EVIDENCE_DIR||'documentation/audit/evidence/bell-hammer-20260919/local';await mkdir(evidence,{recursive:true});
const browser=await chromium.launch({headless:true}),page=await browser.newPage({viewport:{width:1440,height:1000},reducedMotion:'reduce'}),errors=[],cases=[];page.on('pageerror',e=>errors.push(e.message));
const detail=page.locator('.daily-part-detail'),isolated=page.locator('[data-isolate]'),play=page.locator('[data-play]');
const read=label=>page.locator('.daily-readings>div').filter({has:page.locator('dt',{hasText:new RegExp('^'+label+'$')})}).locator('dd').textContent();
const selected=async()=>{assert.equal(await isolated.isChecked(),false);assert.match(await detail.textContent(),/Metal gong/);};
const setup=async i=>{await page.getByRole('tab',{name:'Try it yourself',exact:true}).click();await page.locator('[data-experiment]').nth(i).click();await page.getByRole('tab',{name:'Controls',exact:true}).click();await selected();};
const complete=async()=>{await play.click();await page.locator('[data-play][title^="Play again"]').waitFor({timeout:20000});};
const shot=async name=>{await page.locator('canvas').scrollIntoViewIfNeeded();await page.screenshot({path:`${evidence}/${name}.png`,clip:await page.locator('canvas').boundingBox()});};
await page.addInitScript(()=>{
 const Native=window.AudioContext;window.bellAudioEvidence={contexts:[],peak:0,oscillators:0};
 window.AudioContext=class extends Native{constructor(...args){super(...args);window.bellAudioEvidence.contexts.push(this);const analyser=this.createAnalyser();analyser.connect(this.destination);const buffer=new Float32Array(analyser.fftSize);const interval=setInterval(()=>{if(this.state==='closed'){clearInterval(interval);return;}analyser.getFloatTimeDomainData(buffer);window.bellAudioEvidence.peak=Math.max(window.bellAudioEvidence.peak,...buffer.map(Math.abs));},10);const createGain=this.createGain.bind(this);this.createGain=()=>{const gain=createGain(),connect=gain.connect.bind(gain);gain.connect=destination=>connect(destination===this.destination?analyser:destination);return gain;};const createOscillator=this.createOscillator.bind(this);this.createOscillator=()=>{window.bellAudioEvidence.oscillators++;return createOscillator();};}};
});
try{
 await page.goto(`${base}#machine/electric-bell-hammer-and-metal-bell`);await page.getByRole('heading',{name:'Electric-bell hammer and metal bell',exact:true}).waitFor();assert.equal(await page.evaluate(()=>window.bellAudioEvidence.contexts.length),0,'no sound context before opt-in');
 await page.locator('[data-control="sound"]').selectOption('1');await complete();await selected();assert.ok(await page.evaluate(()=>window.bellAudioEvidence.peak>.001),'real output contains a synthesized tone');assert.equal(await page.evaluate(()=>window.bellAudioEvidence.oscillators),9,'three partials for each of three strikes');
 await complete();assert.equal(await page.locator('[data-control="sound"]').inputValue(),'0');assert.equal(await page.evaluate(()=>window.bellAudioEvidence.oscillators),9,'muted replay creates no new voices');await setup(2);await page.locator('[data-control="sound"]').selectOption('1');await complete();assert.equal(await page.evaluate(()=>window.bellAudioEvidence.oscillators),9,'weak stroke creates no impact tone');
 await page.getByRole('link',{name:'Neighborhood',exact:true}).first().click();await page.waitForFunction(()=>window.bellAudioEvidence.contexts.every(c=>c.state==='closed'));console.log('PASS opt-in audio: actual waveform, three partials per impact, muted replay, quiet weak stroke and disposal.');

 for(const width of [1440,390]){
  await page.setViewportSize({width,height:width===1440?1000:844});await page.goto(`${base}#machine/electric-bell-hammer-and-metal-bell`);await page.reload();await page.getByRole('heading',{name:'Electric-bell hammer and metal bell',exact:true}).waitFor();await selected();assert.match(await page.title(),/^Electric-bell hammer and metal bell/);
  for(const [index,preset] of lesson.tryIt.entries()){
   await setup(index);for(const [key,value] of Object.entries(preset.values))assert.equal(await page.locator(`[data-control="${key}"]`).inputValue(),String(value));assert.equal(await read('Time since press'),'0.0 ms');await shot(`initial-${width}-${index}`);
   for(let i=0;i<6;i++)await page.locator('[data-step]').click();await selected();for(const label of ['Hammer to rim','Armature angle','Time since press','Hammer strikes','Coil current','Moving contact'])assert.equal(await read(label),expected[index].active.find(r=>r.label===label).value);await shot(`active-${width}-${index}`);
   await complete();await selected();for(const label of ['Hammer to rim','Armature angle','Hammer strikes','Time since press'])assert.equal(await read(label),expected[index].final.find(r=>r.label===label).value);await shot(`final-${width}-${index}`);
   await play.click();await play.click();await selected();const frozen=await read('Time since press');await page.waitForTimeout(100);assert.equal(await read('Time since press'),frozen);assert.ok(parseFloat(frozen)<30);await page.locator('[data-step]').click();await selected();await complete();await selected();assert.equal(await read('Hammer strikes'),String([3,1,0,6][index]));
   cases.push({width,title:preset.title,result:await read('Your result'),minimumClearanceMm:expected[index].minGapMm});if(index===3){await page.locator('[data-control="voltage"]').fill('3');assert.equal(await read('Time since press'),'0.0 ms');assert.equal(await read('Hammer strikes'),'0');assert.equal(await read('Contact openings'),'0');await shot(`ready-${width}`);}await page.locator('[data-reset-controls]').click();await selected();assert.equal(await read('Armature angle'),'0.0°');console.log(width,preset.title);
  }
  await page.locator('[data-result]').click();assert.match(await detail.textContent(),/Connected electric bell/);await shot(`whole-bell-${width}`);await page.locator('[data-reset-controls]').click();await selected();
  await page.locator('[data-labels]').check();await page.locator('button[data-label-part="coils"]').click();assert.match(await detail.textContent(),/Two connected coils/);await page.getByRole('heading',{name:'Electric-bell hammer and metal bell',exact:true}).click();assert.match(await detail.textContent(),/Select a part/);await page.locator('[data-labels]').uncheck();
  await page.locator('[data-separation]').fill('100');await page.locator('[data-view="in"]').click();await page.locator('[data-view="out"]').click();assert.equal(await page.locator('[data-separation]').inputValue(),'100');await shot(`separated-${width}`);await page.getByRole('button',{name:'Reassemble',exact:true}).click();
  await isolated.check();await page.locator('[data-reset-controls]').click();await selected();await page.getByRole('button',{name:lesson.quiz.options[1],exact:true}).click();assert.match(await page.locator('.daily-answer').textContent(),/Try thinking/);await page.getByRole('button',{name:lesson.quiz.options[0],exact:true}).click();assert.match(await page.locator('.daily-answer').textContent(),/That’s right/);assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
 }
 await page.goto(`${base}#list`);const entry=page.locator('[data-entry="electric-bell-hammer-and-metal-bell"]');assert.equal(await entry.textContent(),'Electric-bell hammer and metal bell');assert.equal(await entry.locator('xpath=ancestor::tr').locator('[data-entry="electric-bell"]').count(),1,'component remains nested below whole bell');await entry.click();await page.getByRole('heading',{name:'Electric-bell hammer and metal bell',exact:true}).waitFor();await selected();
 await page.getByRole('link',{name:'Electric bell →',exact:true}).click();await page.getByRole('heading',{name:'Electric bell',exact:true}).waitFor();await page.getByRole('link',{name:'Electric-bell hammer and metal bell →',exact:true}).click();await page.getByRole('heading',{name:'Electric-bell hammer and metal bell',exact:true}).waitFor();assert.deepEqual(errors,[]);
 console.log('PASS hammer browser: eight preset/viewport cases, retained completion/replay, explicit whole-bell inspection, reset context, measured readings, labels/dismissal, separation, zoom buttons, quiz, catalog nesting/title, stable URL and related links.');
}catch(error){await page.screenshot({path:`${evidence}/failure.png`,fullPage:true}).catch(()=>{});throw error;}
finally{await writeFile(`${evidence}/browser.json`,JSON.stringify({base,browser:browser.version(),cases,errors},null,2)+'\n');await browser.close();}

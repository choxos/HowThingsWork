import assert from 'node:assert/strict';
import * as THREE from 'three';
import {chromium} from 'playwright';
import {createBellModel} from './bell-model.js';
import {dailyLifeLessons} from './daily-life-lessons.js';
import {mkdir,writeFile} from 'node:fs/promises';

let poses=0;
function geometryCheck(m){
 const get=id=>m.parts.find(p=>p.id===id).object,state=m.getState(),armature=get('armature'),gong=get('gong'),hammer=get('hammer').children.find(o=>o.geometry?.type==='SphereGeometry');
 m.root.updateMatrixWorld(true);m.root.traverse(o=>assert.ok([...o.matrixWorld.elements].every(Number.isFinite),'finite world transform'));
 const center=hammer.getWorldPosition(new THREE.Vector3()),gongCenter=gong.getWorldPosition(new THREE.Vector3());assert.ok(center.distanceTo(gongCenter)>=.7-1e-9,'hammer does not penetrate the gong');
 const fixed=get('fixed-contact').children.find(o=>o.geometry?.type==='RoundedBoxGeometry'),pad=get('moving-contact').children.find(o=>o.geometry?.type==='RoundedBoxGeometry'),fixedBox=new THREE.Box3().setFromObject(fixed),padBox=new THREE.Box3().setFromObject(pad);
 assert.ok(Math.abs(padBox.min.x-fixedBox.max.x-state.contactGap)<1e-7,'reported gap matches actual contact faces');
 if(state.contactClosed){assert.ok(padBox.max.y>fixedBox.min.y&&padBox.min.y<fixedBox.max.y);assert.ok(padBox.max.z>fixedBox.min.z&&padBox.min.z<fixedBox.max.z);}
 const tongue=get('moving-contact').children.find(o=>o.geometry?.type==='BufferGeometry'),positions=tongue.geometry.attributes.position;let previous,length=0;
 for(let i=0;i<positions.count;i+=4){const center=new THREE.Vector3();for(let j=0;j<4;j++){const point=new THREE.Vector3().fromBufferAttribute(positions,i+j);center.add(point);tongue.localToWorld(point);assert.ok(!fixedBox.clone().expandByScalar(-1e-7).containsPoint(point),'contact tongue clears the fixed pad');}center.multiplyScalar(.25);if(previous)length+=center.distanceTo(previous);previous=center;}
 assert.ok(Math.abs(length-state.tongueLength)<.0001,'actual strip centerline conserves length through bending');
 const coil=get('spring').children.find(o=>o.geometry?.type==='TubeGeometry'),path=coil.geometry.parameters.path,start=coil.localToWorld(path.getPoint(0)),end=coil.localToWorld(path.getPoint(1));
 assert.ok(start.distanceTo(get('pivot').localToWorld(new THREE.Vector3(-.18,0,.03)))<1e-8,'fixed spring leg stays anchored');
 assert.ok(end.distanceTo(armature.localToWorld(new THREE.Vector3(.18,0,.17)))<1e-8,'moving spring leg follows its actual armature peg');assert.ok(Math.abs(path.getLength()-state.wireLength)<1e-8,'return-spring wire length conserved');
 const bar=armature.children.find(o=>o.geometry?.type==='RoundedBoxGeometry');bar.geometry.computeBoundingBox();
 for(const y of [1.15,1.55]){const nearest=armature.worldToLocal(new THREE.Vector3(.22,y+.09,0));assert.ok(nearest.x>bar.geometry.boundingBox.max.x,'armature face clears the core pole even at its upper edge');}
 const plungerBox=new THREE.Box3().setFromObject(get('plunger').children.find(o=>o.geometry?.type==='RoundedBoxGeometry')),terminalBox=new THREE.Box3().setFromObject(get('button').children.find(o=>o.geometry?.type==='RoundedBoxGeometry'));
 assert.ok(Math.abs(plungerBox.min.z-terminalBox.max.z-(state.pressed?0:.0675))<1e-8,'button bridge contact agrees with the circuit');const buttonCoil=get('button-spring').children.find(o=>o.geometry?.type==='TubeGeometry'),buttonPath=buttonCoil.geometry.parameters.path,buttonEnd=buttonCoil.localToWorld(buttonPath.getPoint(1));assert.ok(Math.abs(buttonEnd.z-plungerBox.min.z)<1e-8,'button return spring remains against the actual bridge');assert.ok(Math.abs(buttonPath.getLength()-state.buttonWireLength)<1e-8,'button spring conserves wire length');poses++;
}
for(const hz of [30,60,144])for(const [settings,expected] of [[{},3],[{contact:1},0],[{contact:2},1],[{voltage:1.5},0]]){
 const m=createBellModel();m.update(settings);geometryCheck(m);let opened=false,returned=false,pulled=false,previous=0;
 for(let i=0;i<hz*12&&!m.getState().complete;i++){m.advance(1/hz);const s=m.getState();if(i%Math.ceil(hz/20)===0)geometryCheck(m);if(s.current>.05&&s.angle>0)pulled=true;if(!s.contactClosed)opened=true;if(s.velocity<0)returned=true;assert.ok(s.strikes>=previous);previous=s.strikes;}
 assert.equal(m.getState().complete,true);assert.equal(m.getState().strikes,expected);assert.equal(m.getState().pressed,false);assert.equal(m.getState().current,0);assert.equal(m.getState().angle,0);if(expected===3)assert.ok(pulled&&opened&&returned,'current, opening and spring return occurred');geometryCheck(m);m.reset();assert.equal(m.getState().strikes,0);assert.equal(m.getState().complete,false);m.dispose();
}
const impact=createBellModel();for(let i=0;i<10000&&!impact.getState().strikes;i++)impact.advance(.00005/.12);assert.equal(impact.getState().strikes,1);geometryCheck(impact);
impact.root.updateMatrixWorld(true);const ball=impact.parts.find(p=>p.id==='hammer').object.children.find(o=>o.geometry?.type==='SphereGeometry'),gong=impact.parts.find(p=>p.id==='gong').object,point=gong.localToWorld(new THREE.Vector3(-.6,0,0)),ray=new THREE.Raycaster(point.clone().add(new THREE.Vector3(.01,0,0)),new THREE.Vector3(-1,0,0),0,.013),hit=ray.intersectObject(ball,false)[0];assert.ok(hit&&Math.abs(hit.distance-.01)<.001,'actual tessellated hammer surface reaches the gong rim within mesh resolution');impact.dispose();
console.log(`PASS bell geometry and dynamics: ${poses} poses, 30/60/144 Hz, actual contact gaps, supported spring ends, conserved strip/wire length, core clearance, hammer contact and four causal outcomes.`);

let settingsChecked=0;
for(let voltage=1.5;voltage<=4.5;voltage+=.5)for(let i=0;i<=12;i++)for(const contact of [0,1,2]){
 const m=createBellModel();m.update({voltage,holdTime:.2+i*.05,contact});m.advance(10);const state=m.getState();assert.equal(state.complete,true);assert.equal(state.current,0);assert.equal(state.angle,0);assert.equal(state.pressed,false);assert.ok(Number.isFinite(state.elapsed));assert.ok(state.elapsed>=state.values.holdTime);if(contact===1)assert.equal(state.strikes,0);geometryCheck(m);m.dispose();settingsChecked++;
}
for(const voltage of [1.5,3,4.5])for(const time of [.001,.004,.008]){
 const m=createBellModel();m.update({voltage});m.advance(time/.12);const state=m.getState(),expected=voltage/10*(1-Math.exp(-time/.008));assert.equal(state.contactClosed,true);assert.ok(Math.abs(state.current-expected)<voltage/10*.0013,'early current agrees with analytic RL rise within Euler step error');assert.equal(state.readings.find(r=>r.label==='Time since press').value,(time*1000).toFixed(1)+' ms');assert.equal(state.readings.find(r=>r.label==='Armature angle').value,(state.angle*180/Math.PI).toFixed(1)+'°');m.dispose();
}
{
 const m=createBellModel();m.animate(.1);const before=m.getState();m.animate(NaN);m.animate(Infinity);m.advance(-1);m.update({voltage:NaN,holdTime:Infinity,contact:NaN});assert.equal(m.getState().elapsed,before.elapsed);m.animate(.2);assert.ok(m.getState().elapsed>before.elapsed,'nonfinite clock must not prevent later valid playback');m.reset();assert.equal(m.getState().elapsed,0);m.dispose();
}
const lesson=dailyLifeLessons['Electric bell'],expected=[];
for(const [index,preset] of lesson.tryIt.entries()){
 const m=createBellModel();m.reset();m.update(preset.values);const initial=m.getState().readings;for(let i=0;i<6;i++)m.playback.step();geometryCheck(m);const active=m.getState().readings;assert.equal(m.getState().readings.find(r=>r.label==='Time since press').value,'144.0 ms');m.advance(10);assert.equal(m.getState().strikes,[3,0,1,0,2,9][index]);expected.push({initial,active,final:m.getState().readings});m.dispose();
}
console.log(`PASS ${settingsChecked} voltage/hold/contact settings, nine analytic RL-rise probes, measured time/angle, invalid clocks and all six prepared outcomes; ${poses} total physical poses.`);
if(process.env.MODEL_ONLY==='1')process.exit(0);
const base=process.env.SITE_URL||'http://127.0.0.1:5193/',evidence=process.env.EVIDENCE_DIR||'documentation/audit/evidence/electric-bell-20260919/local';await mkdir(evidence,{recursive:true});
const browser=await chromium.launch({headless:true}),page=await browser.newPage({viewport:{width:1440,height:1000},reducedMotion:'reduce'}),errors=[],cases=[];page.on('pageerror',e=>errors.push(e.message));
await page.addInitScript(()=>{
 const Native=window.AudioContext;window.bellAudioEvidence={contexts:[],peak:0,oscillators:0};
 window.AudioContext=class extends Native{constructor(...args){super(...args);window.bellAudioEvidence.contexts.push(this);const analyser=this.createAnalyser();analyser.connect(this.destination);const buffer=new Float32Array(analyser.fftSize);const interval=setInterval(()=>{if(this.state==='closed'){clearInterval(interval);return;}analyser.getFloatTimeDomainData(buffer);window.bellAudioEvidence.peak=Math.max(window.bellAudioEvidence.peak,...buffer.map(Math.abs));},10);const createGain=this.createGain.bind(this);this.createGain=()=>{const gain=createGain(),connect=gain.connect.bind(gain);gain.connect=destination=>connect(destination===this.destination?analyser:destination);return gain;};const createOscillator=this.createOscillator.bind(this);this.createOscillator=()=>{window.bellAudioEvidence.oscillators++;return createOscillator();};}};
});
try{
 await page.goto(`${base}#machine/electric-bell`);await page.getByRole('heading',{name:'Electric bell',exact:true}).waitFor();assert.equal(await page.evaluate(()=>window.bellAudioEvidence.contexts.length),0,'no audio context before sound opt-in');
 const play=()=>page.getByRole('button',{name:'Ring the bell',exact:true}).click(),wait=text=>page.waitForFunction(t=>document.querySelector('.daily-readings')?.textContent.includes(t)&&document.querySelector('[data-play]')?.getAttribute('aria-pressed')==='false',text);
 await page.getByRole('combobox',{name:'Bell sound',exact:true}).selectOption('1');await play();await wait('3 strikes · the bell rang repeatedly');assert.ok(await page.evaluate(()=>window.bellAudioEvidence.peak>.001),'real Web Audio output contains a bell waveform');assert.equal(await page.evaluate(()=>window.bellAudioEvidence.oscillators),9);
 await page.screenshot({path:`${evidence}/sound-opt-in.png`,fullPage:true});
 await play();await wait('3 strikes · the bell rang repeatedly');assert.equal(await page.getByRole('combobox',{name:'Bell sound',exact:true}).inputValue(),'0','completed Play resets the sound setting too');assert.equal(await page.evaluate(()=>window.bellAudioEvidence.oscillators),9,'muted replay emits no new oscillators');
 const read=label=>page.locator('.daily-readings>div').filter({has:page.locator('dt',{hasText:new RegExp('^'+label+'$')})}).locator('dd').textContent();
 const shot=async name=>{await page.locator('canvas').scrollIntoViewIfNeeded();await page.screenshot({path:`${evidence}/${name}.png`,clip:await page.locator('canvas').boundingBox()});};
 const setup=async i=>{await page.getByRole('tab',{name:'Try it yourself',exact:true}).click();await page.locator('[data-experiment]').nth(i).click();await page.getByRole('tab',{name:'Controls',exact:true}).click();};
 const complete=async()=>{await page.locator('[data-play]').click();await page.locator('[data-play][title^="Play again"]').waitFor({timeout:20000});};
 for(const width of [1440,390]){
  await page.setViewportSize({width,height:width===1440?1000:844});
  for(const [index,preset] of lesson.tryIt.entries()){
   await setup(index);assert.equal(await read('Time since press'),'0.0 ms');assert.equal(await read('Hammer strikes'),'0');assert.equal(await read('Armature angle'),'0.0°');
   for(const [key,value] of Object.entries(preset.values))assert.equal(await page.locator(`[data-control="${key}"]`).inputValue(),String(value));
   await shot(`initial-${width}-${index}`);for(let i=0;i<6;i++)await page.locator('[data-step]').click();
   for(const label of ['Time since press','Hammer strikes','Armature angle','Coil current','Moving contact','Button'])assert.equal(await read(label),expected[index].active.find(r=>r.label===label).value);
   await shot(`active-${width}-${index}`);await complete();
   for(const label of ['Your result','Time since press','Hammer strikes','Armature angle','Coil current','Moving contact','Button'])assert.equal(await read(label),expected[index].final.find(r=>r.label===label).value);
   await shot(`final-${width}-${index}`);await page.locator('[data-play]').click();await page.locator('[data-play]').click();const frozen=await read('Time since press');assert.ok(parseFloat(frozen)<30,'replay starts new button press');await page.waitForTimeout(100);assert.equal(await read('Time since press'),frozen);await page.locator('[data-step]').click();await complete();assert.equal(await read('Hammer strikes'),String([3,0,1,0,2,9][index]));
   cases.push({width,title:preset.title,result:await read('Your result'),time:await read('Time since press')});await page.locator('[data-reset-controls]').click();assert.equal(await read('Time since press'),'0.0 ms');assert.equal(await read('Hammer strikes'),'0');console.log(width,preset.title);
  }
  await page.locator('[data-control="voltage"]').focus();await page.keyboard.press('ArrowRight');assert.equal(await page.locator('[data-control="voltage"]').inputValue(),'3.5');await page.locator('[data-number="holdTime"]').fill('0.8');await page.locator('[data-number="holdTime"]').press('Enter');assert.equal(await page.locator('[data-control="holdTime"]').inputValue(),'0.8');
  await page.locator('[data-labels]').check();await page.locator('button[data-label-part="hammer"]').click();assert.match(await page.locator('.daily-part-detail').textContent(),/Hammer and stem/);await page.getByRole('heading',{name:'Electric bell',exact:true}).click();assert.match(await page.locator('.daily-part-detail').textContent(),/Select a part/);
  await page.locator('[data-separation]').fill('100');await page.locator('[data-view="in"]').click();await page.locator('[data-view="out"]').click();assert.equal(await page.locator('[data-separation]').inputValue(),'100');await page.locator('[data-labels]').uncheck();await shot(`separated-${width}`);await page.getByRole('button',{name:'Reassemble',exact:true}).click();
  await page.getByRole('button',{name:lesson.quiz.options[1],exact:true}).click();assert.match(await page.locator('.daily-answer').textContent(),/Try thinking/);await page.getByRole('button',{name:lesson.quiz.options[0],exact:true}).click();assert.match(await page.locator('.daily-answer').textContent(),/That’s right/);assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
 }
 await page.getByRole('button',{name:'The jumper keeps current flowing even when the moving contact opens.',exact:true}).click();assert.match(await page.locator('.daily-answer').textContent(),/That’s right/);await page.setViewportSize({width:390,height:844});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));await page.getByRole('link',{name:'Neighborhood',exact:true}).first().click();await page.waitForFunction(()=>window.bellAudioEvidence.contexts.every(c=>c.state==='closed'));assert.deepEqual(errors,[]);
 console.log('PASS bell browser: real optional audio, muted replay, twelve independent experiment/viewport cases, measured active/final readings, pause/step/reset, keyboard, labels/dismissal, separation, zoom-only buttons, quiz and audio cleanup.');
}catch(error){console.error(await page.evaluate(()=>({peak:window.bellAudioEvidence.peak,oscillators:window.bellAudioEvidence.oscillators,contexts:window.bellAudioEvidence.contexts.map(c=>c.state)})));await page.screenshot({path:`${evidence}/failure.png`,fullPage:true}).catch(()=>{});throw error;}finally{await writeFile(`${evidence}/browser.json`,JSON.stringify({base,browser:browser.version(),cases,errors},null,2)+'\n');await browser.close();}

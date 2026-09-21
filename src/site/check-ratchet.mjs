import assert from 'node:assert/strict';
import * as THREE from 'three';
import {chromium} from 'playwright';
import {createRatchetModel} from './ratchet-model.js';
import {dailyLifeLessons} from './daily-life-lessons.js';
import {mkdir,writeFile} from 'node:fs/promises';

let poses=0;
for(const hz of [30,60,144]){
 const m=createRatchetModel(),get=id=>m.parts.find(p=>p.id===id).object,wheel=get('ratchet'),pawl=get('pawl'),gear=wheel.children.find(o=>o.isMesh),polygon=gear.geometry.parameters.shapes.getPoints();
 const inside=p=>{let yes=false;for(let i=0,j=polygon.length-1;i<polygon.length;j=i++){const a=polygon[i],b=polygon[j];if((a.y>p.y)!==(b.y>p.y)&&p.x<(b.x-a.x)*(p.y-a.y)/(b.y-a.y)+a.x)yes=!yes;}return yes;};
 const edgeDistance=p=>Math.min(...polygon.map((a,i)=>{const b=polygon[(i+1)%polygon.length],dx=b.x-a.x,dy=b.y-a.y,t=Math.max(0,Math.min(1,((p.x-a.x)*dx+(p.y-a.y)*dy)/(dx*dx+dy*dy||1)));return Math.hypot(p.x-a.x-t*dx,p.y-a.y-t*dy);}));
 const origin=new THREE.Vector3(),fixed=get('axle').position.clone();
 function check(){m.root.updateMatrixWorld(true);assert.ok(Math.abs(wheel.rotation.z+m.getState().angle)<1e-12);assert.deepEqual(get('axle').position,fixed);assert.ok(m.getState().clearance>=-1e-8);pawl.traverse(o=>{if(!o.isMesh)return;const a=o.geometry.attributes.position;for(let i=0;i<a.count;i++){origin.fromBufferAttribute(a,i);o.localToWorld(origin);gear.worldToLocal(origin);assert.ok(!inside(origin)||edgeDistance(origin)<1e-7||Math.hypot(origin.x,origin.y)<.08,'actual pawl mesh vertex outside toothed wheel');}});poses++;}
 function run(){for(let i=0;i<hz*15&&!m.getState().complete;i++){m.advance(1/hz);if(i%Math.ceil(hz/20)===0)check();}assert.equal(m.getState().complete,true);check();}
 check();run();assert.equal(m.getState().position,3);assert.equal(m.getState().held,true);assert.equal(m.getState().beta,0);
 const toe=pawl.localToWorld(new THREE.Vector3(.16,1.065,0));get('assembly').worldToLocal(toe);assert.ok(Math.abs(toe.y-.025)<1e-12,'toe radius touches radial stopping face');
 m.update({direction:-1});run();assert.equal(m.getState().position,3);assert.equal(m.getState().blocked,true);
 m.update({release:1});run();assert.equal(m.getState().position,0);assert.ok(m.getState().clearance>.3);
 m.update({direction:1,stroke:6,release:0});run();assert.equal(m.getState().position,6);m.update({stroke:5});run();assert.equal(m.getState().position,11);
 if(hz===30){
  for(const release of [0,1]){
   m.reset({position:3});m.update({direction:0,release,hand:-1});const start=m.getState().position;
   for(let i=0;i<=40;i++){m.update({hand:-1+i*.05});check();assert.ok(Math.abs(m.getState().position-(start+i*.05))<1e-9);}
   const top=m.getState().position;
   for(let i=0;i<=40;i++){m.update({hand:1-i*.05});check();assert.ok(Math.abs(m.getState().position-(release?top-i*.05:top))<1e-9);}
   const frozen=m.getState().angle;assert.equal(m.playback.blocked(),true);m.advance(100);m.playback.step();m.animate(100);assert.equal(m.getState().angle,frozen,'transport cannot move hand input');
  }
  m.reset({position:3});m.update({direction:0,hand:.45});check();assert.ok(m.getState().beta<0,'partial tooth lifts the actual pawl');assert.ok(Math.abs(m.getState().position-3.45)<1e-9);m.update({hand:.2});check();assert.ok(Math.abs(m.getState().position-3.2)<1e-9,'reverse backlash follows ramp');m.update({hand:-1});check();assert.equal(m.getState().position,3,'backlash stops at last passed face');
  m.update({release:1,hand:.45});check();assert.ok(Math.abs(m.getState().position-4.45)<1e-9);m.update({release:0});check();assert.equal(m.getState().checkpoint,4*Math.PI/6);m.update({hand:-1});check();assert.equal(m.getState().position,4,'re-engagement holds last passed tooth');
  for(let i=0;i<15;i++){m.update({hand:1});check();m.update({hand:-1});check();}assert.equal(m.getState().position,34,'no artificial full-turn cap');
  m.update({direction:1,stroke:3});run();assert.ok(Math.abs(m.getState().position-37)<1e-9);const seed=m.replayState();assert.ok(Math.abs(seed.angle/(Math.PI/6)-34)<1e-9,'automatic replay begins at the actual hand-reached position');m.reset(seed);m.update({direction:1,stroke:3});run();assert.ok(Math.abs(m.getState().position-37)<1e-9);
 }
 m.reset();assert.equal(m.getState().position,0);assert.equal(m.getState().complete,false);m.dispose();
}
for(const time of [.1,.3,.65,.67,.8,1.2]){const m=createRatchetModel();m.advance(time);const before=m.getState().angle;m.update({direction:-1});m.advance(20);assert.ok(m.getState().angle<=before);assert.equal(m.getState().beta,0);assert.equal(m.getState().blocked,true);m.reset();m.advance(time);m.update({stroke:2});m.advance(20);assert.equal(m.getState().beta,0);assert.equal(m.getState().held,true);m.dispose();}
for(const hz of [30,60,144])for(const direction of [-1,1])for(const release of [0,1])for(let stroke=1;stroke<=6;stroke++){const m=createRatchetModel();m.reset({position:6});m.update({direction,release,stroke});for(let i=0;i<hz*15&&!m.getState().complete;i++)m.advance(1/hz);assert.equal(m.getState().complete,true);assert.ok(Math.abs(m.getState().position-(direction===-1&&!release?6:6+direction*stroke))<1e-9);m.dispose();}
console.log(`PASS ${poses} actual mesh poses, contact at stopping face, cumulative progress, blocked reverse, release, reset and 30/60/144 Hz.`);
const lesson=dailyLifeLessons.Ratchet,expected=[];
for(const [index,preset] of lesson.tryIt.entries()){
 const m=createRatchetModel();m.reset(preset.initialState);m.update(preset.values);const initial=m.getState();
 if(index<5){m.advance(20);const final=m.getState();assert.ok(Math.abs(final.position-[3,3,0,12,15][index])<1e-9);assert.equal(final.complete,true);expected.push({initial:initial.readings,final:final.readings});m.reset(m.replayState());m.update(preset.values);assert.equal(m.getState().angle,initial.angle);m.advance(20);assert.equal(m.getState().angle,final.angle);}
 else{assert.equal(m.playback.blocked(),true);m.update({hand:1});assert.equal(m.getState().position,4);m.update({hand:-1});assert.equal(m.getState().position,index===5?4:2);expected.push({initial:initial.readings,final:m.getState().readings});}
 m.dispose();
}
{
 const m=createRatchetModel();m.advance(.3);const angle=m.getState().angle,values=m.getState().values;
 m.update({direction:99,release:NaN,stroke:Infinity,hand:NaN});assert.deepEqual(m.getState().values,{...values,direction:1});assert.equal(m.getState().angle,angle);m.animate(NaN);m.animate(Infinity);m.advance(NaN);m.advance(-1);assert.equal(m.getState().angle,angle);m.animate(.1);assert.ok(m.getState().angle>angle,'invalid clocks cannot poison later playback');
 m.update({direction:-1});const start=m.getState().angle;m.advance(20);const seed=m.replayState();assert.equal(seed.angle,start);m.reset(seed);m.update({direction:-1});assert.equal(m.getState().angle,start);m.advance(20);assert.equal(m.getState().angle,0,'partial-stroke replay settles to original checkpoint');
 assert.throws(()=>m.reset({angle:NaN}),RangeError);assert.throws(()=>m.reset({position:Infinity}),RangeError);m.update({hand:99,stroke:99});assert.equal(m.getState().values.hand,1);assert.equal(m.getState().values.stroke,6);m.dispose();
}
console.log('PASS manual stroke sweeps, actual pawl contact, backlash/re-engagement, unlimited cumulative turns, disabled transport, independent presets, true action replay and invalid input/clock boundaries.');
if(process.env.MODEL_ONLY==='1')process.exit(0);
const base=process.env.SITE_URL||'http://127.0.0.1:5193/',evidence=process.env.EVIDENCE_DIR||'documentation/audit/evidence/ratchet-20260919/local';await mkdir(evidence,{recursive:true});
const browser=await chromium.launch({headless:true}),page=await browser.newPage({viewport:{width:1440,height:1000},reducedMotion:'reduce'}),errors=[],cases=[];page.on('pageerror',e=>errors.push(e.message));
const play=page.locator('[data-play]'),hand=page.locator('[data-control="hand"]'),direction=page.locator('[data-control="direction"]');
const read=label=>page.locator('.daily-readings>div').filter({has:page.locator('dt',{hasText:new RegExp('^'+label+'$')})}).locator('dd').textContent();
const shot=async name=>{await page.locator('canvas').scrollIntoViewIfNeeded();await page.screenshot({path:`${evidence}/${name}.png`,clip:await page.locator('canvas').boundingBox()});};
const setup=async i=>{await page.getByRole('tab',{name:'Try it yourself',exact:true}).click();await page.locator('[data-experiment]').nth(i).click();await page.getByRole('tab',{name:'Controls',exact:true}).click();};
const complete=async()=>{await play.click();await page.locator('[data-play][title^="Play again"]').waitFor({timeout:25000});};
try{
 for(const width of [1440,390]){
  await page.setViewportSize({width,height:width===1440?1000:844});await page.goto(`${base}#machine/ratchet`);await page.reload();await page.getByRole('heading',{name:'Ratchet',exact:true}).waitFor();
  for(const [index,preset] of lesson.tryIt.entries()){
   await setup(index);for(const [key,value] of Object.entries(preset.values))assert.equal(await page.locator(`[data-control="${key}"]`).inputValue(),String(value));
   for(const label of ['Retained position','Wheel rotation','Total turns','Pawl lift'])assert.equal(await read(label),expected[index].initial.find(r=>r.label===label).value);
   await shot(`initial-${width}-${index}`);
   if(index<5){
    assert.equal(await hand.isDisabled(),true);assert.equal(await play.isDisabled(),false);await page.locator('[data-step]').click();await complete();
    for(const label of ['Your result','Retained position','Wheel rotation','Total turns','Pawl lift'])assert.equal(await read(label),expected[index].final.find(r=>r.label===label).value);
    await shot(`final-${width}-${index}`);
    await play.click();await play.click();const paused=await read('Wheel rotation');await page.waitForTimeout(100);assert.equal(await read('Wheel rotation'),paused);assert.ok(Math.abs(parseFloat(paused)-parseFloat(expected[index].initial.find(r=>r.label==='Wheel rotation').value))<6,'replay restores this action start');
    await page.locator('[data-step]').click();await complete();assert.equal(await read('Retained position'),expected[index].final.find(r=>r.label==='Retained position').value);
   }else{
    assert.equal(await play.isDisabled(),true);assert.equal(await hand.isDisabled(),false);assert.equal(await page.locator('[data-control="stroke"]').isDisabled(),true);await page.locator('[data-step]').click();assert.equal(await read('Retained position'),'3.00 teeth');
    await hand.fill('0.45');await shot(`partial-${width}-${index}`);assert.equal(await read('Retained position'),'3.45 teeth');
    await hand.fill('1');assert.equal(await read('Retained position'),'4.00 teeth');await hand.fill('-1');assert.equal(await read('Retained position'),index===5?'4.00 teeth':'2.00 teeth');await shot(`final-${width}-${index}`);
    await hand.focus();await page.keyboard.press('ArrowRight');assert.equal(await hand.inputValue(),'-0.95');assert.equal(await read('Retained position'),index===5?'4.05 teeth':'2.05 teeth');
    await page.locator('[data-number="hand"]').fill('-1');await page.locator('[data-number="hand"]').press('Enter');assert.equal(await read('Retained position'),index===5?'4.00 teeth':'2.00 teeth');
    await direction.selectOption('1');assert.equal(await hand.isDisabled(),true);assert.equal(await play.isDisabled(),false);await complete();assert.equal(await read('Retained position'),index===5?'7.00 teeth':'5.00 teeth');
    await play.click();await play.click();assert.ok(Math.abs(parseFloat(await read('Retained position'))-(index===5?4:2))<.2,'replay retains hand-reached start');
   }
   cases.push({width,title:preset.title,final:expected[index].final});await page.locator('[data-reset-controls]').click();assert.equal(await read('Retained position'),'0.00 teeth');assert.equal(await direction.inputValue(),'1');assert.equal(await hand.inputValue(),'0');console.log(width,preset.title);
  }
  await setup(0);await play.click();await page.waitForTimeout(200);await direction.selectOption('0');assert.equal(await play.getAttribute('aria-pressed'),'false');assert.equal(await play.isDisabled(),true);const frozen=await read('Retained position');await page.waitForTimeout(150);assert.equal(await read('Retained position'),frozen,'switching to hand mode stops automatic motion');
  await page.locator('[data-labels]').check();await page.locator('button[data-label-part="pawl"]').click();assert.match(await page.locator('.daily-part-detail').textContent(),/Hinged holding pawl/);await page.getByRole('heading',{name:'Ratchet',exact:true}).click();assert.match(await page.locator('.daily-part-detail').textContent(),/Select a part to move closer/);
  await page.locator('[data-separation]').fill('100');await page.locator('[data-view="in"]').click();await page.locator('[data-view="out"]').click();assert.equal(await page.locator('[data-separation]').inputValue(),'100');await page.locator('[data-labels]').uncheck();await shot(`separated-${width}`);await page.getByRole('button',{name:'Reassemble',exact:true}).click();
  await page.getByRole('button',{name:lesson.quiz.options[0],exact:true}).click();assert.match(await page.locator('.daily-answer').textContent(),/Try thinking/);await page.getByRole('button',{name:lesson.quiz.options[2],exact:true}).click();assert.match(await page.locator('.daily-answer').textContent(),/That’s right/);assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
 }
 assert.deepEqual(errors,[]);console.log('PASS ratchet browser: 14 independent preset/viewport cases, cumulative/released/manual input, true action replay, disabled hand-mode transport, pause/step/reset, labels/dismissal, separation, zoom-only buttons, keyboard and quiz.');
}catch(error){await page.screenshot({path:`${evidence}/failure.png`,fullPage:true}).catch(()=>{});throw error;}
finally{await writeFile(`${evidence}/browser.json`,JSON.stringify({base,browser:browser.version(),cases,errors},null,2)+'\n');await browser.close();}

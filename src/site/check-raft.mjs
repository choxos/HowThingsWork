import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import * as THREE from 'three';
import {chromium} from 'playwright';
import {RAFT,RAFT_DEFAULTS,raftControls,raftForces,raftEquilibrium,raftStart,advanceRaft} from './raft-physics.js';
import {createRaftModel} from './raft-model.js';
import {fixed} from './format.js';
import {raftLesson} from './raft-lesson.js';
import {createPartExplosion} from './part-explosion.js';

const out=process.env.EVIDENCE_DIR||'documentation/audit/evidence/raft-20260919',base=process.env.SITE_URL||'http://localhost:5194/';await mkdir(out,{recursive:true});
const near=(a,b,tolerance=1e-8,label='value')=>assert(Math.abs(a-b)<=tolerance,`${label}: ${a} != ${b}`);
const volume=(y,cargo)=>{const side=Math.cbrt(cargo/(4*7850));return 2.4*Math.max(0,Math.min(.2,-y))+4*side**2*Math.max(0,Math.min(side,-y-.2));};
function independentRoot(v){const mass=.48*v.wood+v.cargo;if(mass>v.water*(.48+v.cargo/7850)+1e-9)return -.95;let lo=-.95,hi=0;for(let i=0;i<70;i++){const mid=(lo+hi)/2;if(v.water*volume(mid,v.cargo)>mass)lo=mid;else hi=mid;}return (lo+hi)/2;}
function energy(s,v){const mass=.48*v.wood+v.cargo,side=Math.cbrt(v.cargo/(4*7850)),d=Math.max(0,-s.bottom),c=Math.max(0,d-.2);const integral=(depth,height)=>Math.min(depth,height)**2/2+height*Math.max(0,depth-height);return mass*9.81*s.bottom+v.water*9.81*(2.4*integral(d,.2)+4*side**2*integral(c,side))+.5*mass*s.velocity**2;}
let settings=0,forceCases=0;
for(let cargo=0;cargo<=400;cargo+=10)for(let wood=300;wood<=800;wood+=50)for(const water of [1000,1025]){
 const v=raftControls({cargo,wood,water}),eq=raftEquilibrium(v);near(eq.bottom,independentRoot(v),2e-8,'Independent equilibrium');near(eq.dryCargo,.48*(water-wood));near(eq.maxCargo,.48*(water-wood)/(1-water/7850));
 for(let depth=0;depth<=1;depth+=.025){const f=raftForces(v,-depth);near(f.displaced,volume(-depth,cargo),1e-10);near(f.weight,(.48*wood+cargo)*9.81);near(f.buoyancy,water*9.81*volume(-depth,cargo),1e-8);assert(f.support>=0);forceCases++;}
 const start=raftStart(v),end=advanceRaft(start,v,12);assert(Number.isFinite(end.bottom)&&Number.isFinite(end.velocity));assert(end.bottom>=RAFT.floor);near(end.elapsed,12);assert(energy(end,v)<=energy(start,v)+.005,'Damped/contact motion cannot add energy');settings++;
}
for(const input of [{cargo:-1},{cargo:NaN},{wood:400.5},{water:1001},{unknown:1},null])assert.throws(()=>raftControls(input));
let s=raftStart(RAFT_DEFAULTS);for(const t of [NaN,Infinity,0,-1])assert.deepEqual(advanceRaft(s,RAFT_DEFAULTS,t),s);
const reference=advanceRaft(s,RAFT_DEFAULTS,12);for(const hz of [15,60,144]){let state={...s};for(let i=0;i<=12*hz;i++)state=advanceRaft(state,RAFT_DEFAULTS,1/hz);near(state.bottom,reference.bottom,1e-8);near(state.velocity,reference.velocity,1e-8);near(state.elapsed,12);}
const model=createRaftModel(),byId=id=>model.parts.find(p=>p.id===id).object;
assert.equal(new Set(model.parts.map(p=>p.name)).size,model.parts.length);
const presets=[];
for(const [index,t] of raftLesson.tryIt.entries()){
 assert(t.reset);assert.deepEqual(Object.keys(t.values).sort(),model.controls.map(c=>c.key).sort());model.reset();model.update({cargo:400,wood:800,water:1025});model.advance(12);model.reset();model.update(t.values);
 near(model.getState().elapsed,0);near(model.getState().bottom,-.2*t.values.wood/t.values.water);model.advance(12);const state=model.getState();near(state.bottom,independentRoot(t.values),2e-5,'Preset rests at predicted depth');assert(Math.abs(state.velocity)<.0001);near(state.buoyancy+state.support,state.weight,.03,'Resting force balance');
 model.root.updateMatrixWorld(true);near(model.root.getObjectByName('Moving raft').position.y,state.bottom);for(let i=0;i<6;i++){const b=new THREE.Box3().setFromObject(byId('timber-'+i));near(b.min.y,state.bottom,1e-7);near(b.max.y,state.bottom+.2,1e-7);}
 for(let i=0;i<4;i++){const p=byId('cargo-'+i);assert.equal(p.visible,t.values.cargo>0);if(p.visible){const b=new THREE.Box3().setFromObject(p);near(b.min.y,state.bottom+.2,1e-7);near(b.getSize(new THREE.Vector3()).x,state.side,1e-7);}}
 for(const [id,f] of [['weight',state.weight],['buoyancy',state.buoyancy],['support',state.support],['drag',Math.abs(state.drag)]])near(byId(id).children[0].userData.length,f/6000,1e-12,'Shared force arrow scale');
 const frozen=model.getState();model.advance(1);near(model.getState().bottom,frozen.bottom);near(model.getState().elapsed,12);presets.push({index,title:t.title,status:state.status,freeboard:state.freeboard,weight:state.weight,buoyancy:state.buoyancy,support:state.support});
}
model.reset();model.update({cargo:320});model.advance(12);const grounded=model.getState();assert(grounded.support>300);model.actions[1].run();near(model.getState().bottom,grounded.bottom);near(model.getState().elapsed,0);assert.equal(model.getState().support,0);assert(model.getState().net>0);model.advance(12);near(model.getState().bottom,-.1,1e-7,'Unloaded raft recovers');
model.update({cargo:200});near(model.getState().elapsed,0);near(model.getState().bottom,-.1,1e-7,'Controls preserve position');model.advance(.5);assert(model.getState().bottom<-.1);model.reset();assert.deepEqual(model.getState().values,RAFT_DEFAULTS);
const camera=new THREE.OrthographicCamera(-3,3,3,-3,.1,100);camera.position.set(4,3,6);camera.lookAt(0,0,0);camera.updateMatrixWorld();const explosion=createPartExplosion(model,camera,1.2,{width:760,height:620});assert.deepEqual(new Set(explosion.categories.map(c=>c.id)),new Set(['timbers','bindings','cargo','water','forces']));assert.equal(explosion.items.filter(i=>i.category==='timbers').length,6);assert.equal(explosion.items.filter(i=>i.category==='cargo').length,4);assert.equal(explosion.items.filter(i=>i.category==='bindings').length,2);explosion.dispose();model.dispose();
await writeFile(out+'/model.json',JSON.stringify({result:'PASS',settings,forceCases,presets,checks:['Independent equilibrium roots','Exact displaced volumes','Dissipative energy','Frame-rate parity','Finite controls/time','Physical beam/cargo dimensions','Equal force-arrow scale','Complete boundary','Unload and recover','Five categorized groups']},null,2)+'\n');
console.log(`PASS raft model: ${settings} settings, ${forceCases} force cases, eight independent presets, physical geometry and force scale, damping, frame timing, grounding/unloading and five part groups.`);
if(process.env.MODEL_ONLY==='1')process.exit(0);
const browser=await chromium.launch({headless:true}),errors=[],cases=[];let page;
try{
 page=await browser.newPage({viewport:{width:1440,height:1000},hasTouch:true,reducedMotion:'reduce'});page.setDefaultTimeout(10000);page.on('pageerror',e=>errors.push(e.message));
 const reading=label=>page.locator('.daily-readings>div').filter({has:page.locator('dt',{hasText:new RegExp('^'+label+'$')})}).locator('dd');
 const setup=async i=>{await page.getByRole('tab',{name:'Try it yourself',exact:true}).click();await page.locator('[data-experiment]').nth(i).click();await page.getByRole('tab',{name:'Controls',exact:true}).click();};
 await page.goto(base+'#place/river');await page.locator('[data-machine="raft"] img.machine-thumbnail').waitFor();await page.locator('[data-machine="raft"]').click();await page.getByRole('heading',{name:'Raft',exact:true}).waitFor();
 for(const [id,name] of [['timbers','Six buoyant timbers'],['bindings','Rope bindings'],['cargo','Steel cargo'],['water','Water and depth reference'],['forces','Force comparison']]){
  // The list finds the raft but draws no part links; each part is reached by its bookmark.
  await page.goto(base+'#list');await page.locator('#catalog-search').fill('Raft');assert.equal(await page.locator('[data-entry="raft"]').count(),1);assert.equal(await page.locator('a[href^="#machine/raft?part="]').count(),0);
  await page.goto(base+`#machine/raft?part=${id}`);await page.locator('.daily-part-detail h3').waitFor();assert.equal(await page.locator('.daily-part-detail h3').innerText(),name);await page.locator('.daily-heading h1').click();assert.equal(await page.locator('.daily-part-detail h3').count(),0);
 }

 for(const width of [1440,390]){
  await page.setViewportSize({width,height:width===390?844:1000});await page.goto(base+'#machine/raft');await page.waitForSelector('canvas');
  for(const [index,t] of raftLesson.tryIt.entries()){
   await setup(index);for(const [key,value] of Object.entries(t.values))assert.equal(Number(await page.locator(`[data-control="${key}"]`).inputValue()),value);assert.equal(await reading('Observation').innerText(),'0.00 / 12 s');await page.locator('[data-step]').click();assert.equal(await reading('Observation').innerText(),'0.50 / 12 s');await page.getByRole('button',{name:'Finish this observation',exact:true}).click();assert.equal(await reading('Observation').innerText(),'12.00 / 12 s');assert.equal(await reading('Your result').innerText(),presets[index].status);assert.equal(await reading('Deck above water').innerText(),fixed(presets[index].freeboard*100,1)+' cm');assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
   await page.locator('canvas').scrollIntoViewIfNeeded();await page.mouse.move(0,0);await page.screenshot({path:`${out}/preset-${width}-${index}.png`,clip:await page.locator('.daily-canvas-wrap').boundingBox()});cases.push({width,title:t.title,result:presets[index].status});
  }
  if(width===1440){
   await setup(0);await page.locator('[data-view="reset"]').click();await page.locator('canvas').scrollIntoViewIfNeeded();const box=await page.locator('canvas').boundingBox(),hits=new Set();
   for(let y=.32;y<=.55;y+=.025)for(let x=.25;x<=.7;x+=.025){await page.mouse.move(box.x+box.width*x,box.y+box.height*y);await page.waitForTimeout(20);if(await page.locator('.daily-part-popup').isVisible())hits.add(await page.locator('.daily-part-popup').innerText());}
   cases.push({width,hoverNames:[...hits]});
   assert([...hits].some(n=>n.startsWith('Steel block')),'Cargo can be hovered');assert([...hits].filter(n=>n.startsWith('Timber ')).length>=3,'Distinct timbers have precise hover targets');await page.mouse.move(0,0);assert(await page.locator('.daily-part-popup').isHidden());
  }
  await setup(4);await page.getByRole('button',{name:'Finish this observation',exact:true}).click();await page.getByRole('button',{name:'Unload the raft',exact:true}).click();assert.equal(await reading('Observation').innerText(),'0.00 / 12 s');assert.equal(await page.locator('[data-control="cargo"]').inputValue(),'0');assert.equal(await reading('Bottom support · gray ↑').innerText(),'0 N');await page.getByRole('button',{name:'Finish this observation',exact:true}).click();assert.equal(await reading('Deck above water').innerText(),'10.0 cm');
  await setup(0);await page.locator('[data-play]').click();await page.waitForTimeout(350);await page.locator('[data-play]').click();const paused=await reading('Observation').innerText();await page.waitForTimeout(250);assert.equal(await reading('Observation').innerText(),paused);await page.getByRole('button',{name:'Finish this observation',exact:true}).click();await page.locator('[data-play]').click();await page.waitForTimeout(200);assert.notEqual(await reading('Observation').innerText(),'12.00 / 12 s');await page.locator('[data-play]').click();await page.locator('[data-reset-controls]').click();assert.equal(await reading('Observation').innerText(),'0.00 / 12 s');
  await page.locator('[data-result]').click();assert.equal(await page.locator('.daily-part-detail h3').innerText(),'Raft, cargo and water');await page.locator('.daily-heading h1').click();assert.equal(await page.locator('.daily-part-detail h3').count(),0);
  await page.locator('[data-view="reset"]').click();await page.locator('[data-separation]').fill('100');assert.equal(await page.locator('.daily-inventory-labels [data-category]').count(),5);for(const view of ['out','in']){await page.locator(`[data-view="${view}"]`).click();assert.equal(await page.locator('[data-separation]').inputValue(),'100');}await page.locator('canvas').scrollIntoViewIfNeeded();await page.screenshot({path:`${out}/separated-${width}.png`,clip:await page.locator('.daily-canvas-wrap').boundingBox()});await page.locator('[data-reassemble]').click();assert.equal(await page.locator('[data-separation]').inputValue(),'0');
 }
 await setup(0);await page.locator('[data-play]').click();await page.waitForFunction(()=>document.querySelector('.daily-readings').textContent.includes('12.00 / 12 s'),null,{timeout:20000});assert.equal(await page.locator('[data-play]').getAttribute('aria-pressed'),'false');assert.equal(await reading('Your result').innerText(),'Floating · deck above water');
 await page.locator('[data-answer="1"]').click();assert.match(await page.locator('.daily-answer').innerText(),/^Try thinking/);await page.locator('[data-answer="0"]').click();assert.match(await page.locator('.daily-answer').innerText(),/^That’s right/);assert.equal(await page.locator('[data-answer="0"]').getAttribute('aria-pressed'),'true');
 assert.deepEqual(errors,[]);
 console.log('PASS raft browser: sixteen preset/viewport cases, step, complete, pause, reset, replay, unload/recovery, selected-part dismissal, separation and zoom.');
}catch(error){await page?.screenshot({path:out+'/failure.png',fullPage:true,timeout:5000}).catch(()=>{});throw error;}finally{await writeFile(out+'/browser.json',JSON.stringify({base,browser:browser.version(),cases,errors},null,2)+'\n');await browser.close();}

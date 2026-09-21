import assert from 'node:assert/strict';
import * as THREE from 'three';
import {chromium} from 'playwright';
import {mkdir,writeFile} from 'node:fs/promises';
import {houseComponents} from './house-components.js';
import {createHornModel} from './horn-model.js';

const component=houseComponents['Electric-horn moving iron bar'],lesson=component.lesson,m=component.createModel(),expected=[],cycles=[9,0,0,10],get=id=>m.parts.find(p=>p.id===id).object;
assert.equal(m.resultPart.focusOnComplete,false);const parent=createHornModel();assert.equal(parent.resultPart.focusOnComplete,true);parent.dispose();m.root.updateMatrixWorld(true);
const bar=get('moving-bar'),body=bar.children[0],fixing=bar.children[1],pole=get('fixed-pole').children[0],sheet=get('diaphragm').children.find(o=>o.geometry),coil=get('coil'),fixedMeshes=[pole,...coil.children.filter(o=>o.geometry)],fixedMatrices=fixedMeshes.map(o=>o.matrixWorld.toArray()),barRotation=bar.quaternion.toArray(),barScale=bar.scale.toArray();let poses=0,minGap=Infinity;
let bore=Infinity;for(const mesh of coil.children.filter(o=>o.geometry)){const a=mesh.geometry.attributes.position;for(let i=0;i<a.count;i++){const v=new THREE.Vector3().fromBufferAttribute(a,i).applyMatrix4(mesh.matrixWorld);bore=Math.min(bore,Math.hypot(v.x,v.z));}}
assert.ok(bore>.19,'actual coil bore clears the 0.14-radius bar');
function check(){
 m.root.updateMatrixWorld(true);const s=m.getState(),a=new THREE.Box3().setFromObject(body),b=new THREE.Box3().setFromObject(pole),gap=(b.min.y-a.max.y)/100;assert.ok(Math.abs(gap-s.airGap)<1e-8,'air-gap reading matches actual bar and pole faces');assert.ok(gap>0,'bar never hits fixed pole');minGap=Math.min(minGap,gap);
 assert.ok(Math.abs(bar.position.y-s.x*100)<1e-10);assert.deepEqual(bar.quaternion.toArray(),barRotation);assert.deepEqual(bar.scale.toArray(),barScale);fixedMeshes.forEach((o,i)=>assert.deepEqual(o.matrixWorld.toArray(),fixedMatrices[i],'coil and fixed pole stay stationary'));
 const fix=new THREE.Box3().setFromObject(fixing),center=(fix.min.y+fix.max.y)/2,positions=sheet.geometry.attributes.position,lower=new THREE.Vector3().fromBufferAttribute(positions,0).applyMatrix4(sheet.matrixWorld),upper=new THREE.Vector3().fromBufferAttribute(positions,25*65).applyMatrix4(sheet.matrixWorld);assert.ok(Math.abs((lower.y+upper.y)/2-center)<1e-7,'actual sheet center follows its rigid fixing');assert.ok(Math.abs(center-(.6+s.x*100))<1e-7);
 assert.ok(Math.max(Math.abs(a.min.x),Math.abs(a.max.x),Math.abs(a.min.z),Math.abs(a.max.z))<bore,'bar stays inside winding bore');assert.equal(s.readings.find(r=>r.label==='Pole air gap').value,`${(s.airGap*1000).toFixed(3)} mm`);poses++;
}
for(const [index,preset] of lesson.tryIt.entries()){
 m.reset();m.update(preset.values);check();const initial=m.getState().readings;for(let i=0;i<6;i++)m.playback.step();check();const active=m.getState().readings;m.reset();m.update(preset.values);let held=false;
 for(let i=0;i<2000&&!m.getState().complete;i++){m.advance(.01);check();const s=m.getState();if(index===1&&s.pressed&&s.elapsed>.05){held=true;assert.ok(Math.abs(s.x-.000444444)<1e-7);assert.ok(s.current>3.999);}}
 const s=m.getState();assert.equal(s.complete,true);assert.equal(s.cycles,cycles[index]);if(index===1)assert.ok(held);if(index===2){assert.equal(s.breaks,0);assert.ok(s.peak<.000141);}if(index===3){assert.ok(s.peak>.000684&&s.peak<.000686);assert.ok(s.frequency>264&&s.frequency<266);}
 expected.push({initial,active,final:s.readings});
}
m.dispose();console.log(`PASS horn bar: ${poses} actual pole/bore/fixing poses, stationary coil/pole, rigid translating bar, retained component inspection and four independent outcomes. Minimum pole clearance ${(minGap*1000).toFixed(3)} mm.`);
if(process.env.MODEL_ONLY==='1')process.exit(0);
// Dense label buttons move into a list; the rendered SVG target remains at
// the actual projected geometry. Keep the original percentage-frame invariant.
async function labelPoint(label){
 if(await label.evaluate(node=>node.closest('.daily-canvas-wrap').dataset.labelMode==='list')){await label.scrollIntoViewIfNeeded();await label.focus();}
 const point=await label.evaluate(node=>{const wrap=node.closest('.daily-canvas-wrap');if(wrap.dataset.labelMode==='list'){const group=[...wrap.querySelectorAll('svg g[data-label-part]')].find(g=>g.dataset.labelPart===node.dataset.labelPart);if(!group||getComputedStyle(group).display==='none')throw new Error('Selected geometry leader is not visible');const dot=group.querySelector('circle');return [Number(dot.getAttribute('cx'))/wrap.clientWidth*100,Number(dot.getAttribute('cy'))/wrap.clientHeight*100];}return [parseFloat(node.style.left),parseFloat(node.style.top)];});
 assert.ok(point.every(Number.isFinite),'geometry anchor coordinates are finite');return point;
}
const base=process.env.SITE_URL||'http://127.0.0.1:5193/',evidence=process.env.EVIDENCE_DIR||'documentation/audit/evidence/horn-bar-20260919/local';await mkdir(evidence,{recursive:true});
const browser=await chromium.launch({headless:true}),page=await browser.newPage({viewport:{width:1440,height:1000},reducedMotion:'reduce'}),errors=[],cases=[];page.on('pageerror',e=>errors.push(e.message));
const detail=page.locator('.daily-part-detail'),isolated=page.locator('[data-isolate]'),play=page.locator('[data-play]');
const read=label=>page.locator('.daily-readings>div').filter({has:page.locator('dt',{hasText:new RegExp('^'+label+'$')})}).locator('dd').textContent();
const selected=async()=>{assert.equal(await isolated.isChecked(),false);assert.match(await detail.textContent(),/Moving iron bar and center fixing/);};
const setup=async i=>{await page.getByRole('tab',{name:'Try it yourself',exact:true}).click();await page.locator('[data-experiment]').nth(i).click();await page.getByRole('tab',{name:'Controls',exact:true}).click();await selected();};
const complete=async()=>{await play.click();await page.locator('[data-play][title^="Play again"]').waitFor({timeout:20000});};
const shot=async name=>{await page.locator('canvas').scrollIntoViewIfNeeded();await page.screenshot({path:`${evidence}/${name}.png`,clip:await page.locator('canvas').boundingBox()});};
try{
 for(const width of [1440,390]){
  await page.setViewportSize({width,height:width===1440?1000:844});await page.goto(`${base}#machine/electric-horn-moving-iron-bar`);await page.reload();await page.getByRole('heading',{name:'Electric-horn moving iron bar',exact:true}).waitFor();await selected();assert.match(await page.title(),/^Electric-horn moving iron bar/);
  for(const [index,preset] of lesson.tryIt.entries()){
   await setup(index);for(const [key,value] of Object.entries(preset.values))assert.equal(await page.locator(`[data-control="${key}"]`).inputValue(),String(value));assert.equal(await read('Time since press'),'0.00 ms');await shot(`initial-${width}-${index}`);
   for(let i=0;i<6;i++)await page.locator('[data-step]').click();await selected();for(const label of ['Contact breaks','Button','Center movement','Time since press','Diaphragm cycles','Coil current','Interrupter'])assert.equal(await read(label),expected[index].active.find(r=>r.label===label).value);await shot(`active-${width}-${index}`);
   if(index===0){await page.locator('[data-labels]').check();const label=page.locator('.daily-model-label').filter({hasText:/^Moving iron bar and center fixing$/}),start=await labelPoint(label);for(let step=0;step<12;step++){await page.locator('[data-step]').click();const position=await labelPoint(label);assert.ok(Math.hypot(position[0]-start[0],position[1]-start[1])<.01,'selected bar stays framed through its stroke');}await page.locator('[data-labels]').uncheck();}
   await complete();await selected();for(const label of ['Contact breaks','Button','Center movement','Diaphragm cycles','Time since press'])assert.equal(await read(label),expected[index].final.find(r=>r.label===label).value);await shot(`final-${width}-${index}`);
   await play.click();await play.click();await selected();const frozen=await read('Time since press');await page.waitForTimeout(100);assert.equal(await read('Time since press'),frozen);assert.ok(parseFloat(frozen)<30);await page.locator('[data-step]').click();await selected();await complete();await selected();assert.equal(await read('Diaphragm cycles'),String(cycles[index]));
   cases.push({width,title:preset.title,result:await read('Your result'),breaks:await read('Contact breaks')});await page.locator('[data-reset-controls]').click();await selected();assert.equal(await read('Center movement'),'0.000 mm');console.log(width,preset.title);
  }
  await page.locator('[data-result]').click();assert.match(await detail.textContent(),/Connected electric horn/);await shot(`whole-horn-${width}`);await page.locator('[data-reset-controls]').click();await selected();
  await page.locator('[data-labels]').check();await page.locator('button[data-label-part="coil"]').click();assert.match(await detail.textContent(),/Insulated electromagnetic coil/);await page.getByRole('heading',{name:'Electric-horn moving iron bar',exact:true}).click();assert.match(await detail.textContent(),/Select a part/);await page.locator('[data-labels]').uncheck();
  await page.locator('[data-separation]').fill('100');await page.locator('[data-view="in"]').click();await page.locator('[data-view="out"]').click();assert.equal(await page.locator('[data-separation]').inputValue(),'100');await shot(`separated-${width}`);await page.getByRole('button',{name:'Reassemble',exact:true}).click();
  await isolated.check();await page.locator('[data-reset-controls]').click();await selected();await page.getByRole('button',{name:lesson.quiz.options[1],exact:true}).click();assert.match(await page.locator('.daily-answer').textContent(),/Try thinking/);await page.getByRole('button',{name:lesson.quiz.options[0],exact:true}).click();assert.match(await page.locator('.daily-answer').textContent(),/That’s right/);assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
 }
 await page.goto(`${base}#list`);const entry=page.locator('[data-entry="electric-horn-moving-iron-bar"]');assert.equal(await entry.textContent(),'Electric-horn moving iron bar');assert.equal(await entry.locator('xpath=ancestor::tr').locator('[data-entry="electric-horn"]').count(),1,'component remains nested below whole horn');await entry.click();await page.getByRole('heading',{name:'Electric-horn moving iron bar',exact:true}).waitFor();await selected();
 await page.getByRole('link',{name:'Electric horn →',exact:true}).click();await page.getByRole('heading',{name:'Electric horn',exact:true}).waitFor();await page.getByRole('link',{name:'Electric-horn moving iron bar →',exact:true}).click();await page.getByRole('heading',{name:'Electric-horn moving iron bar',exact:true}).waitFor();await selected();assert.deepEqual(errors,[]);
 console.log('PASS horn bar browser: eight preset/viewport cases, retained completion/replay, explicit whole-horn inspection, reset context, measured readings, moving-bar camera tracking, labels/dismissal, separation, zoom buttons, quiz, catalog nesting/title, stable URL and related links.');
}catch(error){await page.screenshot({path:`${evidence}/failure.png`,fullPage:true}).catch(()=>{});throw error;}
finally{await writeFile(`${evidence}/browser.json`,JSON.stringify({base,browser:browser.version(),cases,errors},null,2)+'\n');await browser.close();}

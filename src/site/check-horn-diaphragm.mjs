import assert from 'node:assert/strict';
import * as THREE from 'three';
import {chromium} from 'playwright';
import {mkdir,writeFile} from 'node:fs/promises';
import {houseComponents} from './house-components.js';
import {createHornModel} from './horn-model.js';

const component=houseComponents['Vibrating horn diaphragm'],lesson=component.lesson,m=component.createModel(),expected=[],cycles=[9,0,0,10],peaks=['0.613 mm','0.658 mm','0.140 mm','0.685 mm'],get=id=>m.parts.find(p=>p.id===id).object;
assert.equal(m.resultPart.focusOnComplete,false);const parent=createHornModel();assert.equal(parent.resultPart.focusOnComplete,true);parent.dispose();m.root.updateMatrixWorld(true);
const sheet=get('diaphragm').children.find(o=>o.geometry),fixing=get('moving-bar').children[1],positions=sheet.geometry.attributes.position,rest=positions.array.slice(),clamps=get('housing').children.filter(o=>o.geometry?.type==='TorusGeometry'),clampMatrices=clamps.map(o=>o.matrixWorld.toArray());let poses=0,observedPeak=0;
function check(){
 m.root.updateMatrixWorld(true);const s=m.getState(),fix=new THREE.Box3().setFromObject(fixing),center=(fix.min.y+fix.max.y)/2;observedPeak=Math.max(observedPeak,(center-.6)/100);
 clamps.forEach((o,i)=>assert.deepEqual(o.matrixWorld.toArray(),clampMatrices[i],'clamping rings stay fixed'));
 for(let sector=0;sector<65;sector++){
  let previous=Math.abs(center-.6)+1e-7;
  for(let ring=0;ring<25;ring++){
   const lower=ring*65+sector,upper=(25+ring)*65+sector,mid=(positions.getY(lower)+positions.getY(upper))/2;
   assert.ok(Math.abs(positions.getY(upper)-positions.getY(lower)-.018)<1e-7,'display sheet retains its vertical thickness');assert.ok(Math.abs(mid-.6)<=previous+1e-7,'deflection reduces from attached center toward clamp');previous=Math.abs(mid-.6);
   if(ring===0)assert.ok(Math.abs(mid-center)<1e-7,'all inner vertices follow the actual center fixing');if(ring===24){assert.ok(Math.abs(mid-.6)<1e-7,'all rim vertices stay fixed');assert.equal(positions.getY(lower),rest[lower*3+1]);assert.equal(positions.getY(upper),rest[upper*3+1]);}
   for(const index of [lower,upper]){assert.equal(positions.getX(index),rest[index*3]);assert.equal(positions.getZ(index),rest[index*3+2]);assert.ok(Number.isFinite(positions.getY(index)));}
  }
 }
 assert.ok(s.peak+1e-8>=observedPeak,'retained peak includes sampled actual mesh displacement');assert.equal(s.readings.find(r=>r.label==='Peak center movement').value,`${(s.peak*1000).toFixed(3)} mm`);poses++;
}
for(const [index,preset] of lesson.tryIt.entries()){
 m.reset();m.update(preset.values);observedPeak=0;check();const initial=m.getState().readings;for(let i=0;i<6;i++)m.playback.step();check();const active=m.getState().readings;m.reset();m.update(preset.values);observedPeak=0;let held=false;
 for(let i=0;i<2000&&!m.getState().complete;i++){m.advance(.01);check();const s=m.getState();if(index===1&&s.pressed&&s.elapsed>.05){held=true;assert.ok(Math.abs(s.x-.000444444)<1e-7);}}
 const s=m.getState();assert.equal(s.complete,true);assert.equal(s.cycles,cycles[index]);assert.equal(s.readings.find(r=>r.label==='Peak center movement').value,peaks[index]);assert.ok(s.peak-observedPeak<.000005,'dense sampled mesh excursion agrees with retained peak');if(index===1)assert.ok(held);expected.push({initial,active,final:s.readings});
 m.update({voltage:index===2?12:6});assert.equal(m.getState().peak,0,'new completed-trial setup clears peak');assert.equal(m.getState().readings.find(r=>r.label==='Peak center movement').value,'0.000 mm');
}
m.dispose();console.log(`PASS horn diaphragm: ${poses} actual sheet poses, all 3250 vertices, fixed rim, attached center, monotonic flex, vertical thickness, retained/reset peaks and four independent outcomes.`);
if(process.env.MODEL_ONLY==='1')process.exit(0);
const base=process.env.SITE_URL||'http://127.0.0.1:5193/',evidence=process.env.EVIDENCE_DIR||'documentation/audit/evidence/horn-diaphragm-20260919/local';await mkdir(evidence,{recursive:true});
const browser=await chromium.launch({headless:true}),page=await browser.newPage({viewport:{width:1440,height:1000},reducedMotion:'reduce'}),errors=[],cases=[];page.on('pageerror',e=>errors.push(e.message));
const detail=page.locator('.daily-part-detail'),isolated=page.locator('[data-isolate]'),play=page.locator('[data-play]');
const read=label=>page.locator('.daily-readings>div').filter({has:page.locator('dt',{hasText:new RegExp('^'+label+'$')})}).locator('dd').textContent();
const selected=async()=>{assert.equal(await isolated.isChecked(),false);assert.match(await detail.textContent(),/Clamped flexible diaphragm/);};
const setup=async i=>{await page.getByRole('tab',{name:'Try it yourself',exact:true}).click();await page.locator('[data-experiment]').nth(i).click();await page.getByRole('tab',{name:'Controls',exact:true}).click();await selected();};
const complete=async()=>{await play.click();await page.locator('[data-play][title^="Play again"]').waitFor({timeout:20000});};
const shot=async name=>{await page.locator('canvas').scrollIntoViewIfNeeded();await page.screenshot({path:`${evidence}/${name}.png`,clip:await page.locator('canvas').boundingBox()});};
try{
 for(const width of [1440,390]){
  await page.setViewportSize({width,height:width===1440?1000:844});await page.goto(`${base}#machine/vibrating-horn-diaphragm`);await page.reload();await page.getByRole('heading',{name:'Vibrating horn diaphragm',exact:true}).waitFor();await selected();assert.match(await page.title(),/^Vibrating horn diaphragm/);
  for(const [index,preset] of lesson.tryIt.entries()){
   await setup(index);for(const [key,value] of Object.entries(preset.values))assert.equal(await page.locator(`[data-control="${key}"]`).inputValue(),String(value));assert.equal(await read('Time since press'),'0.00 ms');assert.equal(await read('Peak center movement'),'0.000 mm');await shot(`initial-${width}-${index}`);
   for(let i=0;i<6;i++)await page.locator('[data-step]').click();await selected();for(const label of ['Peak center movement','Contact breaks','Button','Center movement','Time since press','Diaphragm cycles','Coil current','Interrupter'])assert.equal(await read(label),expected[index].active.find(r=>r.label===label).value);await shot(`active-${width}-${index}`);

   await complete();await selected();for(const label of ['Peak center movement','Contact breaks','Button','Center movement','Diaphragm cycles','Time since press'])assert.equal(await read(label),expected[index].final.find(r=>r.label===label).value);await shot(`final-${width}-${index}`);
   await play.click();await play.click();await selected();const frozen=await read('Time since press');await page.waitForTimeout(100);assert.equal(await read('Time since press'),frozen);assert.ok(parseFloat(frozen)<30);await page.locator('[data-step]').click();await selected();await complete();await selected();assert.equal(await read('Diaphragm cycles'),String(cycles[index]));
   cases.push({width,title:preset.title,result:await read('Your result'),peak:await read('Peak center movement')});await page.locator('[data-reset-controls]').click();await selected();assert.equal(await read('Center movement'),'0.000 mm');assert.equal(await read('Peak center movement'),'0.000 mm');console.log(width,preset.title);
  }
  await page.locator('[data-result]').click();assert.match(await detail.textContent(),/Connected electric horn/);await shot(`whole-horn-${width}`);await page.locator('[data-reset-controls]').click();await selected();
  await page.locator('[data-labels]').check();await page.locator('button[data-label-part="coil"]').click();assert.match(await detail.textContent(),/Insulated electromagnetic coil/);await page.getByRole('heading',{name:'Vibrating horn diaphragm',exact:true}).click();assert.match(await detail.textContent(),/Select a part/);await page.locator('[data-labels]').uncheck();
  await page.locator('[data-separation]').fill('100');await page.locator('[data-view="in"]').click();await page.locator('[data-view="out"]').click();assert.equal(await page.locator('[data-separation]').inputValue(),'100');await shot(`separated-${width}`);await page.getByRole('button',{name:'Reassemble',exact:true}).click();
  await isolated.check();await page.locator('[data-reset-controls]').click();await selected();await page.getByRole('button',{name:lesson.quiz.options[1],exact:true}).click();assert.match(await page.locator('.daily-answer').textContent(),/Try thinking/);await page.getByRole('button',{name:lesson.quiz.options[0],exact:true}).click();assert.match(await page.locator('.daily-answer').textContent(),/That’s right/);assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
 }
 await page.goto(`${base}#list`);const entry=page.locator('[data-entry="vibrating-horn-diaphragm"]');assert.equal(await entry.textContent(),'Vibrating horn diaphragm');assert.equal(await entry.locator('xpath=ancestor::tr').locator('[data-entry="electric-horn"]').count(),1,'component remains nested below whole horn');await entry.click();await page.getByRole('heading',{name:'Vibrating horn diaphragm',exact:true}).waitFor();await selected();
 await page.getByRole('link',{name:'Electric horn →',exact:true}).click();await page.getByRole('heading',{name:'Electric horn',exact:true}).waitFor();await page.getByRole('link',{name:'Vibrating horn diaphragm →',exact:true}).click();await page.getByRole('heading',{name:'Vibrating horn diaphragm',exact:true}).waitFor();await selected();assert.deepEqual(errors,[]);
 console.log('PASS horn diaphragm browser: eight preset/viewport cases, retained completion/replay, explicit whole-horn inspection, reset context, measured readings, labels/dismissal, separation, zoom buttons, quiz, catalog nesting/title, stable URL and related links.');
}catch(error){await page.screenshot({path:`${evidence}/failure.png`,fullPage:true}).catch(()=>{});throw error;}
finally{await writeFile(`${evidence}/browser.json`,JSON.stringify({base,browser:browser.version(),cases,errors},null,2)+'\n');await browser.close();}

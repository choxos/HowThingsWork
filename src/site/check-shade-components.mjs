import assert from 'node:assert/strict';
import * as THREE from 'three';
import {chromium} from 'playwright';
import {createWindowShadeModel} from './window-shade-model.js';
import {houseComponents} from './house-components.js';
import {mkdir,writeFile} from 'node:fs/promises';
const m=createWindowShadeModel(),part=id=>m.parts.find(p=>p.id===id).object,cam=part('hub').children[0],positions=cam.geometry.attributes.position;
m.root.updateMatrixWorld(true);const plateBounds=new THREE.Box3().setFromObject(part('disk-plate')),hubBounds=new THREE.Box3().setFromObject(part('hub'));assert.ok(plateBounds.max.x<hubBounds.min.x,'rotating plate stays behind the fixed hub');for(const i of [0,1]){const pinBounds=new THREE.Box3().setFromObject(part('pivot-'+i).children[0]);assert.ok(pinBounds.max.x-pinBounds.min.x>.069,'pivot axes run along the roller');assert.ok(pinBounds.intersectsBox(plateBounds),'pivot stems reach the plate');}
const triangles=[];for(let i=0;i<positions.count;i+=3)triangles.push(new THREE.Triangle(...[0,1,2].map(j=>new THREE.Vector3().fromBufferAttribute(positions,i+j))));
function toeDistances(){m.root.updateMatrixWorld(true);return [0,1].map(i=>{const p=cam.worldToLocal(part('pawl-'+i).localToWorld(new THREE.Vector3(0,.1,0)));return Math.min(...triangles.map(t=>t.closestPointToPoint(p,new THREE.Vector3()).distanceTo(p)));});}
for(const coverage of [.2,.3,.45,.6,.75,.9,1]){m.reset();m.update({coverage});m.advance(20);assert.equal(m.getState().held,true);let distances=toeDistances();assert.ok(Math.abs(Math.min(...distances)-.004)<1e-7,'one actual toe surface meets a fixed tooth');assert.ok(Math.max(...distances)>.01,'opposite pawl is clear');const heldAngle=m.getState().angle;m.update({operation:1,release:0});m.advance(3);assert.equal(m.getState().angle,heldAngle);assert.ok(Math.abs(Math.min(...toeDistances())-.004)<1e-7);m.update({release:1});m.advance(.55);assert.equal(m.getState().stage,'rewind');assert.ok(toeDistances().every(d=>d>.01),'both toes clear during brisk return');m.advance(8);assert.equal(m.getState().coverage,0);}
const component=houseComponents['Window-shade pawls and locking disk'],lesson=component.lesson;
assert.equal(m.resultPart.focusOnComplete,true,'parent retains its window result');
const dedicated=component.createModel();assert.equal(dedicated.resultPart.focusOnComplete,false,'component keeps selected assembly');dedicated.dispose();
for(const [index,preset] of lesson.tryIt.entries()){
 m.reset(preset.initialState);m.update(preset.values);const initial=m.getState();
 assert.equal(initial.holdingStop,index===1||index===2?5:null);
 if(initial.held)assert.ok(Math.abs(Math.min(...toeDistances())-.004)<1e-7,'prepared toe actually seated');
 const initialAngle=initial.angle;m.advance(20);const final=m.getState();
 assert.equal(final.holdingStop,[4,5,null,7][index]);assert.equal(final.complete,true);
 m.reset(m.replayState());m.update(preset.values);assert.equal(m.getState().angle,initialAngle,'replay restores actual contact pose');
}
m.dispose();console.log('PASS shade pawls geometry: actual triangle-to-toe contact at all seven stops, opposite pawl clearance, gentle recatch, brisk clearance, four independent presets, exact replay and route-only completion policy.');
if(process.env.MODEL_ONLY==='1')process.exit(0);
const base=process.env.SITE_URL||'http://127.0.0.1:5193/',evidence=process.env.EVIDENCE_DIR||'documentation/audit/evidence/shade-pawls-20260919/local';
await mkdir(evidence,{recursive:true});
const browser=await chromium.launch({headless:true}),page=await browser.newPage({viewport:{width:1440,height:1000},reducedMotion:'reduce'}),errors=[],cases=[];
page.on('pageerror',e=>errors.push(e.message));
const isolated=page.locator('[data-isolate]'),detail=page.locator('.daily-part-detail'),play=page.locator('[data-play]');
const read=label=>page.locator('.daily-readings > div').filter({has:page.locator('dt',{hasText:new RegExp('^'+label+'$')})}).locator('dd').textContent();
const view=async name=>{await page.locator('canvas').scrollIntoViewIfNeeded();await page.screenshot({path:`${evidence}/${name}.png`,clip:await page.locator('canvas').boundingBox()});};
const selected=async()=>{assert.equal(await isolated.isChecked(),true);assert.match(await detail.textContent(),/Pawls and fixed ratchet/);};
const setup=async i=>{await page.getByRole('tab',{name:'Try it yourself',exact:true}).click();await page.locator('[data-experiment]').nth(i).click();await page.getByRole('tab',{name:'Controls',exact:true}).click();await selected();};
const complete=async()=>{await play.click();await page.locator('[data-play][title^="Play again"]').waitFor({timeout:25000});};
try{
 for(const width of [1440,390]){
  await page.setViewportSize({width,height:width===1440?1000:844});
  await page.goto(`${base}#machine/window-shade-pawls-and-locking-disk`);await page.reload();
  await page.getByRole('heading',{name:'Window-shade pawls and locking disk',exact:true}).waitFor();await selected();
  assert.equal(await read('Window covered'),'0%');
  for(const [index,preset] of lesson.tryIt.entries()){
   await setup(index);const initial=await read('Window covered');assert.equal(initial,index===1||index===2?'78%':'0%');
   for(const [key,value] of Object.entries(preset.values))assert.equal(await page.locator(`[data-control="${key}"]`).inputValue(),String(value));
   await view(`initial-${width}-${index}`);
   if(index===2){await page.locator('[data-step]').click();await page.locator('[data-step]').click();assert.equal(await read('Holding mechanism'),'Both pawls clear');await view(`clear-${width}`);}
   await complete();await selected();
   const final=await read('Window covered'),stop=await read('Holding position');
   assert.equal(final,['63%','78%','0%','100%'][index]);assert.equal(stop,['4 of 7','5 of 7','Fully raised','7 of 7'][index]);
   if(index!==2)assert.equal(await read('Holding mechanism'),'Upper pawl against a fixed stop');
   await view(`final-${width}-${index}`);
   await play.click();await play.click();await selected();
   const paused=await read('Window covered');await page.waitForTimeout(100);assert.equal(await read('Window covered'),paused);
   if(index===1||index===2)assert.ok(parseFloat(paused)>=78,'release replay starts held, not raised');
   await page.locator('[data-step]').click();await selected();
   await page.locator('[data-reset-controls]').click();await selected();assert.equal(await read('Window covered'),'0%');
   cases.push({width,title:preset.title,initial,final,stop});console.log(width,preset.title);
  }
  await setup(1);await complete();await selected();
  await page.locator('[data-result]').click();assert.match(await detail.textContent(),/Window and spring roller/);await view(`window-${width}`);
  await page.locator('[data-reset-controls]').click();await selected();
  await page.locator('[data-labels]').check();await page.locator('button[data-label-part="hub"]').click();assert.match(await detail.textContent(),/Stationary four-stop ratchet/);
  await page.getByRole('heading',{name:'Window-shade pawls and locking disk',exact:true}).click();assert.equal(await isolated.isChecked(),false);assert.match(await detail.textContent(),/Select a part to move closer/);
  await page.locator('[data-separation]').fill('100');await page.locator('[data-view="in"]').click();await page.locator('[data-view="out"]').click();assert.equal(await page.locator('[data-separation]').inputValue(),'100');
  await page.locator('[data-labels]').uncheck();await view(`separated-${width}`);
  await page.getByRole('button',{name:'Reassemble',exact:true}).click();await page.locator('[data-reset-controls]').click();await selected();
  await page.locator('[data-number="coverage"]').fill('.2');await page.locator('[data-number="coverage"]').press('Enter');assert.equal(await read('Lowering target'),'16%');
  await page.locator('[data-control="coverage"]').focus();await page.keyboard.press('ArrowRight');assert.equal(await page.locator('[data-control="coverage"]').inputValue(),'0.25');
  await page.getByRole('button',{name:lesson.quiz.options[1],exact:true}).click();assert.match(await page.locator('.daily-answer').textContent(),/Try thinking/);
  await page.getByRole('button',{name:lesson.quiz.options[0],exact:true}).click();assert.match(await page.locator('.daily-answer').textContent(),/That’s right/);
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
 }
 assert.deepEqual(errors,[]);console.log('PASS shade pawls browser: eight independent preset/viewport cases, retained close-up at completion/replay, manual window inspection, actual clear stage, controls, labels/dismissal, separation, zoom-only buttons, reset, keyboard and quiz.');
}catch(error){await page.screenshot({path:`${evidence}/failure.png`,fullPage:true}).catch(()=>{});throw error;}
finally{await writeFile(`${evidence}/browser.json`,JSON.stringify({base,browser:browser.version(),cases,errors},null,2)+'\n');await browser.close();}

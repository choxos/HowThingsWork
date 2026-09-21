import assert from 'node:assert/strict';
import * as THREE from 'three';
import {chromium} from 'playwright';
import {mkdir,writeFile} from 'node:fs/promises';
import {houseComponents} from './house-components.js';
import {createHornModel} from './horn-model.js';

const component=houseComponents['Horn make-and-break contacts'],lesson=component.lesson,m=component.createModel(),expected=[],cycles=[9,0,0,9],breaks=[10,0,2,10],get=id=>m.parts.find(p=>p.id===id).object;
assert.equal(m.resultPart.focusOnComplete,false);const parent=createHornModel();assert.equal(parent.resultPart.focusOnComplete,true);parent.dispose();let poses=0;
function check(){
 m.root.updateMatrixWorld(true);const s=m.getState(),fixed=get('fixed-contact').children.find(o=>o.geometry?.type==='RoundedBoxGeometry'),moving=get('contact-leaf').children.find(o=>o.geometry?.type==='RoundedBoxGeometry'),a=new THREE.Box3().setFromObject(fixed),b=new THREE.Box3().setFromObject(moving),gap=b.min.y-a.max.y;
 assert.ok(Math.abs(gap/100-s.contactGap)<1e-8,'reading matches actual conducting faces');assert.ok(gap>=-1e-7,'contact pads never overlap');assert.ok(a.min.x<b.max.x&&a.max.x>b.min.x&&a.min.z<b.max.z&&a.max.z>b.min.z,'moving pad stays over fixed pad');
 const actuator=get('collar').children.find(o=>o.geometry?.type==='RoundedBoxGeometry'),extension=get('contact-leaf').children.filter(o=>o.geometry?.type==='RoundedBoxGeometry')[1],c=new THREE.Box3().setFromObject(actuator),d=new THREE.Box3().setFromObject(extension);
 assert.ok(c.max.x>d.min.x&&c.min.x<d.max.x&&c.max.z>d.min.z&&c.min.z<d.max.z);assert.ok(Math.abs(d.min.y-c.max.y-Math.max(0,.035-s.x*100))<1e-7,'actuator touches the leaf after prescribed clearance');
 const points=get('contact-leaf').children.find(o=>o.geometry?.type==='BufferGeometry').geometry.attributes.position;let length=0,previous;
 for(let station=0;station<33;station++){const center=new THREE.Vector3();for(let corner=0;corner<4;corner++)center.add(new THREE.Vector3().fromBufferAttribute(points,station*4+corner));center.multiplyScalar(.25);if(previous)length+=previous.distanceTo(center);else assert.ok(center.distanceTo(new THREE.Vector3(-.88,1.106,0))<1e-7,'leaf root stays fixed');previous=center;}
 assert.ok(Math.abs(length-.48)<1e-6,'actual bent leaf conserves centerline length');assert.equal(s.readings.find(r=>r.label==='Contact breaks').value,String(s.breaks));poses++;return gap>1e-7;
}
for(const [index,preset] of lesson.tryIt.entries()){
 m.reset();m.update(preset.values);check();const initial=m.getState().readings;for(let i=0;i<6;i++)m.playback.step();check();const active=m.getState().readings;m.reset();m.update(preset.values);let previousOpen=check(),observedBreaks=0,sawClosed=false,sawOpen=false,heldCurrent=false;
 for(let i=0;i<2000&&!m.getState().complete;i++){m.advance(.01);const open=check(),s=m.getState();if(s.pressed){if(!previousOpen&&open)observedBreaks++;sawClosed ||= !open;sawOpen ||= open;if(index===2&&s.elapsed>.03&&open){heldCurrent=true;assert.ok(s.current>3.999);}}
  if(index===1){assert.equal(s.current,0);assert.equal(s.x,0);}previousOpen=open;
 }
 const s=m.getState();assert.equal(s.complete,true);assert.equal(s.cycles,cycles[index]);assert.equal(s.breaks,breaks[index]);assert.equal(observedBreaks,s.breaks,'independent physical face openings match counter');if(index===0||index===3)assert.ok(sawClosed&&sawOpen);if(index===2)assert.ok(heldCurrent);if(index===3)assert.ok(s.frequency>247&&s.frequency<250&&s.peak<.00047);
 expected.push({initial,active,final:s.readings});
}
m.dispose();console.log(`PASS horn contacts: ${poses} actual face/actuator/anchored leaf poses, independent opening counts, bypass current, open fault and four independent outcomes.`);
if(process.env.MODEL_ONLY==='1')process.exit(0);
const base=process.env.SITE_URL||'http://127.0.0.1:5193/',evidence=process.env.EVIDENCE_DIR||'documentation/audit/evidence/horn-contacts-20260919/local';await mkdir(evidence,{recursive:true});
const browser=await chromium.launch({headless:true}),page=await browser.newPage({viewport:{width:1440,height:1000},reducedMotion:'reduce'}),errors=[],cases=[];page.on('pageerror',e=>errors.push(e.message));
const detail=page.locator('.daily-part-detail'),isolated=page.locator('[data-isolate]'),play=page.locator('[data-play]');
const read=label=>page.locator('.daily-readings>div').filter({has:page.locator('dt',{hasText:new RegExp('^'+label+'$')})}).locator('dd').textContent();
const selected=async()=>{assert.equal(await isolated.isChecked(),false);assert.match(await detail.textContent(),/Mechanically operated contact breaker/);};
const setup=async i=>{await page.getByRole('tab',{name:'Try it yourself',exact:true}).click();await page.locator('[data-experiment]').nth(i).click();await page.getByRole('tab',{name:'Controls',exact:true}).click();await selected();};
const complete=async()=>{await play.click();await page.locator('[data-play][title^="Play again"]').waitFor({timeout:20000});};
const shot=async name=>{await page.locator('canvas').scrollIntoViewIfNeeded();await page.screenshot({path:`${evidence}/${name}.png`,clip:await page.locator('canvas').boundingBox()});};
try{
 for(const width of [1440,390]){
  await page.setViewportSize({width,height:width===1440?1000:844});await page.goto(`${base}#machine/horn-make-and-break-contacts`);await page.reload();await page.getByRole('heading',{name:'Horn make-and-break contacts',exact:true}).waitFor();await selected();assert.match(await page.title(),/^Horn make-and-break contacts/);
  for(const [index,preset] of lesson.tryIt.entries()){
   await setup(index);for(const [key,value] of Object.entries(preset.values))assert.equal(await page.locator(`[data-control="${key}"]`).inputValue(),String(value));assert.equal(await read('Time since press'),'0.00 ms');await shot(`initial-${width}-${index}`);
   for(let i=0;i<6;i++)await page.locator('[data-step]').click();await selected();for(const label of ['Contact breaks','Button','Center movement','Time since press','Diaphragm cycles','Coil current','Interrupter'])assert.equal(await read(label),expected[index].active.find(r=>r.label===label).value);await shot(`active-${width}-${index}`);
   await complete();await selected();for(const label of ['Contact breaks','Button','Center movement','Diaphragm cycles','Time since press'])assert.equal(await read(label),expected[index].final.find(r=>r.label===label).value);await shot(`final-${width}-${index}`);
   await play.click();await play.click();await selected();const frozen=await read('Time since press');await page.waitForTimeout(100);assert.equal(await read('Time since press'),frozen);assert.ok(parseFloat(frozen)<30);await page.locator('[data-step]').click();await selected();await complete();await selected();assert.equal(await read('Diaphragm cycles'),String(cycles[index]));
   cases.push({width,title:preset.title,result:await read('Your result'),breaks:await read('Contact breaks')});await page.locator('[data-reset-controls]').click();await selected();assert.equal(await read('Center movement'),'0.000 mm');console.log(width,preset.title);
  }
  await page.locator('[data-result]').click();assert.match(await detail.textContent(),/Connected electric horn/);await shot(`whole-horn-${width}`);await page.locator('[data-reset-controls]').click();await selected();
  await page.locator('[data-labels]').check();await page.locator('button[data-label-part="coil"]').click();assert.match(await detail.textContent(),/Insulated electromagnetic coil/);await page.getByRole('heading',{name:'Horn make-and-break contacts',exact:true}).click();assert.match(await detail.textContent(),/Select a part/);await page.locator('[data-labels]').uncheck();
  await page.locator('[data-separation]').fill('100');await page.locator('[data-view="in"]').click();await page.locator('[data-view="out"]').click();assert.equal(await page.locator('[data-separation]').inputValue(),'100');await shot(`separated-${width}`);await page.getByRole('button',{name:'Reassemble',exact:true}).click();
  await isolated.check();await page.locator('[data-reset-controls]').click();await selected();await page.getByRole('button',{name:lesson.quiz.options[1],exact:true}).click();assert.match(await page.locator('.daily-answer').textContent(),/Try thinking/);await page.getByRole('button',{name:lesson.quiz.options[0],exact:true}).click();assert.match(await page.locator('.daily-answer').textContent(),/That’s right/);assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
 }
 await page.goto(`${base}#list`);const entry=page.locator('[data-entry="horn-make-and-break-contacts"]');assert.equal(await entry.textContent(),'Horn make-and-break contacts');assert.equal(await entry.locator('xpath=ancestor::tr').locator('[data-entry="electric-horn"]').count(),1,'component remains nested below whole horn');await entry.click();await page.getByRole('heading',{name:'Horn make-and-break contacts',exact:true}).waitFor();await selected();
 await page.getByRole('link',{name:'Electric horn →',exact:true}).click();await page.getByRole('heading',{name:'Electric horn',exact:true}).waitFor();await page.getByRole('link',{name:'Horn make-and-break contacts →',exact:true}).click();await page.getByRole('heading',{name:'Horn make-and-break contacts',exact:true}).waitFor();await page.getByRole('link',{name:'Electromagnetic make-and-break contacts →',exact:true}).click();await page.getByRole('heading',{name:'Electromagnetic make-and-break contacts',exact:true}).waitFor();await page.getByRole('link',{name:'Horn make-and-break contacts →',exact:true}).click();await page.getByRole('heading',{name:'Horn make-and-break contacts',exact:true}).waitFor();await selected();assert.deepEqual(errors,[]);
 console.log('PASS horn contacts browser: eight preset/viewport cases, retained completion/replay, explicit whole-horn inspection, reset context, measured readings, labels/dismissal, separation, zoom buttons, quiz, catalog nesting/title, stable URL and related links.');
}catch(error){await page.screenshot({path:`${evidence}/failure.png`,fullPage:true}).catch(()=>{});throw error;}
finally{await writeFile(`${evidence}/browser.json`,JSON.stringify({base,browser:browser.version(),cases,errors},null,2)+'\n');await browser.close();}

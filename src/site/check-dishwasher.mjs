import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import {dishwasherLesson as lesson} from './dishwasher-lessons.js';
import {sampleWasher,washerPlan,WASHER_DEFAULTS as D,WASHER_DOMAINS} from './dishwasher-physics.js';
import {fixed} from './format.js';
const readings=page=>page.locator('.daily-readings>div').evaluateAll(ns=>Object.fromEntries(ns.map(n=>[n.querySelector('dt').textContent,n.querySelector('dd').textContent])));
async function preset(page,i){await page.getByRole('tab',{name:'Try it yourself',exact:true}).click();await page.locator(`[data-experiment="${i}"]`).click();await page.getByRole('tab',{name:'Controls',exact:true}).click();}
const actions=[['Half a fill',0,.5],['Heat the wash water',1,.5],['Run the wash',2,.3],['Half a drain',3,.5],['Fresh rinse fill',4,.5],['Hot rinse',6,.5],['Finish the cycle',8,1]];
function compare(r,values,time){
 const s=sampleWasher(values,time),run=s.operating,expected={
  'Your result':s.elapsed===0?'Ready · empty sump':s.complete?'Cycle ended · load cooling, dryness not predicted':s.stageLabel,
  'Cycle clock':`${fixed(s.clock/60,1)} / ${fixed(s.total/60,1)} min`,
  'Water in sump':`${fixed(s.stored,2)} L`,'Fresh water / drained':`${fixed(s.waterUsed,2)} / ${fixed(s.drained,2)} L`,
  'Water and load temperature':s.stored>1e-8?`${fixed(s.temperature,1)} °C`:`Load ${fixed(s.temperature,1)} °C · sump empty`,
  'Arm speed now':`${fixed(s.armSpeed*60/(2*Math.PI),1)} rpm`,
  'Pump now':run?`${fixed(run.pressure/1000,1)} kPa · ${fixed(run.flow*60000,1)} L/min`:'Off',
  'Steady pump prediction':`${fixed(s.run.pressure/1000,1)} kPa · ${fixed(s.run.flow*60000,1)} L/min`,
  'Starting jet torque':`${fixed(s.stallTorque*1000,1)} N·mm`,
  'Tip jet now':run?`${fixed(run.tipSpeed,2)} m/s relative; ${fixed(run.jets[0].backward,2)} m/s backward in room`:'No jet',
  'Recirculated volume':`${fixed(s.recirculated,1)} L`,'First heating stage':`${fixed(s.heatTime/60,1)} min`,
  'Energy used':`${fixed(s.energyUsed/3.6e6,3)} / ${fixed(s.energy/3.6e6,3)} kWh`,
 };
 assert.equal(Object.keys(r).length,13);for(const [key,value]of Object.entries(expected))assert.equal(r[key],value,key);return s;
}
export async function checkDishwasher(page,{base,dir,prefix='local',widths=[1440,390],playback=true,boundaries=true}){
 await mkdir(dir,{recursive:true});const observations=[],playbackCases=[];
 const shot=async name=>{await page.mouse.move(0,0);await page.locator('canvas').scrollIntoViewIfNeeded();await page.waitForTimeout(180);await page.locator('canvas').screenshot({path:`${dir}/${prefix}-${name}.png`});};
 for(const width of widths){
  await page.setViewportSize({width,height:width===390?844:1000});await page.goto('about:blank');await page.goto(base+'#machine/dishwasher');await page.locator('[data-control="bearing"]').waitFor();await page.evaluate(()=>document.fonts.ready);
  assert.equal(await page.locator('h1').innerText(),'Dishwasher');assert.equal(await page.locator('[data-control]').count(),5);assert.equal(await page.locator('[data-action]').count(),13);assert.equal(await page.locator('[data-experiment]').count(),12);
  const primary=await page.locator('.daily-primary-controls select').evaluateAll(es=>es.map(e=>{const b=e.getBoundingClientRect();return scrollY===0&&b.top>=0&&b.bottom<=innerHeight&&b.height>=44&&document.elementFromPoint(b.x+b.width/2,b.y+b.height/2)===e;}));assert.equal(primary.length,1);assert.ok(primary.every(Boolean));await page.screenshot({path:`${dir}/${prefix}-opening-${width}.png`});
  for(let i=0;i<lesson.tryIt.length;i++){
   await preset(page,i);const values=lesson.tryIt[i].values,plan=washerPlan(values),states=[await readings(page)];compare(states[0],values,0);
   for(const [key,value]of Object.entries(values))assert.equal(Number(await page.locator(`[data-control="${key}"]`).inputValue()),value);await shot(`trial-${width}-${i}-ready`);
   for(const [label,index,share]of actions){await page.getByRole('button',{name:label,exact:true}).click();const time=(plan.stages[index].start+share*plan.stages[index].duration)/180,r=await readings(page),s=compare(r,values,time);states.push(r);assert.equal(await page.locator('[data-result]').isDisabled(),!s.complete);if(i===0||index===2||index===8)await shot(`trial-${width}-${i}-${index}`);}
   assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));observations.push({width,trial:i,title:lesson.tryIt[i].title,states});
  }
  const closeups=[['See the spray arm','Rotating spray arm'],['See a tip nozzle','Right driving nozzle'],['See the pump','Circulation pump'],['See the filter','Return filter'],['See the heater','Base heater'],['See the whole machine','Dishwasher']];
  for(const i of [0,7,9]){await preset(page,i);await page.getByRole('button',{name:'Run the wash',exact:true}).click();const held=await readings(page);for(const [label,name]of closeups){await page.getByRole('button',{name:label,exact:true}).click();assert.equal(await page.locator('.daily-part-detail h3').innerText(),name);assert.deepEqual(await readings(page),held);assert.equal(await page.locator('[data-isolate]').isChecked(),name!=='Dishwasher');await shot(`close-${width}-${i}-${name.replaceAll(' ','-')}`);}}
  await preset(page,0);await page.getByRole('button',{name:'Run the wash',exact:true}).click();const held=await readings(page);await page.locator('[data-cutaway]').uncheck();await shot(`cover-${width}`);assert.deepEqual(await readings(page),held);await page.locator('[data-cutaway]').check();
  await page.locator('[data-separation]').fill('100');await page.waitForTimeout(850);await shot(`separated-${width}`);assert.equal(await page.locator('[data-category]').count(),10);assert.deepEqual(await readings(page),held);
  for(const direction of ['in','out']){await page.locator(`[data-view="${direction}"]`).click();assert.equal(await page.locator('[data-separation]').inputValue(),'100');}await page.locator('[data-reassemble]').click();await page.waitForTimeout(850);assert.equal(await page.locator('[data-separation]').inputValue(),'0');
  if(boundaries)for(const [key,[min,max]]of Object.entries(WASHER_DOMAINS))for(const value of key==='bearing'?[0,1,2]:[min,max]){
   await preset(page,0);await page.getByRole('button',{name:'Run the wash',exact:true}).click();const input=page.locator(`[data-control="${key}"]`);
   if(key==='bearing')await input.selectOption(String(value));else{await input.fill(String(value));await input.dispatchEvent('input');}
   const values={...D,[key]:value},plan=washerPlan(values);compare(await readings(page),values,value===D[key]?(plan.stages[2].start+.3*plan.stages[2].duration)/180:0);
   await page.getByRole('button',{name:'Run the wash',exact:true}).click();compare(await readings(page),values,(plan.stages[2].start+.3*plan.stages[2].duration)/180);await shot(`boundary-${width}-${key}-${value}`);
  }
  await page.getByRole('button',{name:'Reset experiment',exact:true}).click();compare(await readings(page),D,0);await page.locator('[data-control="pump"]').focus();await page.keyboard.press('ArrowLeft');assert.equal(await page.locator('[data-control="pump"]').inputValue(),'35');
 }
 if(playback)for(const i of [0,7,8,9]){
  await preset(page,i);const values=lesson.tryIt[i].values;await page.locator('[data-step]').click();compare(await readings(page),values,30/180);
  await page.locator('[data-play]').click();await page.waitForFunction(()=>[...document.querySelectorAll('.daily-readings>div')].find(n=>n.querySelector('dt').textContent==='Pump now').querySelector('dd').textContent!=='Off');
  await page.locator('[data-play]').click();assert.equal(await page.locator('[data-play]').getAttribute('aria-pressed'),'false');const held=await readings(page);await page.waitForTimeout(200);assert.deepEqual(await readings(page),held);
  await page.locator('[data-play]').click();await page.waitForFunction(()=>document.querySelector('[data-play]').getAttribute('aria-pressed')==='false',null,{timeout:25000});const ended=await readings(page);compare(ended,values,100);await shot(`continuous-${i}`);
  await page.locator('[data-result]').click();await page.locator('[data-play]').click();await page.waitForFunction(()=>[...document.querySelectorAll('.daily-readings>div')].find(n=>n.querySelector('dt').textContent==='Your result').querySelector('dd').textContent!=='Cycle ended · load cooling, dryness not predicted');await page.locator('[data-play]').click();
  for(const [key,value]of Object.entries(values))assert.equal(Number(await page.locator(`[data-control="${key}"]`).inputValue()),value);
  await page.locator('[data-play]').click();await page.getByRole('button',{name:'See the spray arm',exact:true}).click();assert.equal(await page.locator('[data-play]').getAttribute('aria-pressed'),'false');playbackCases.push({trial:i,step:true,pause:true,completion:ended,replay:true,inspectionStops:true});
 }
 const result={passed:true,observations,playbackCases};await writeFile(`${dir}/${prefix}-dishwasher-browser.json`,JSON.stringify(result,null,2)+'\n');return result;
}
if(typeof process!=='undefined'&&process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){const {chromium}=await import('playwright'),browser=await chromium.launch({headless:true});try{const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));page.setDefaultTimeout(20000);page.setDefaultNavigationTimeout(45000);const r=await checkDishwasher(page,{base:process.env.SITE_URL||'http://localhost:5194/',dir:process.env.EVIDENCE_DIR||'/tmp/howthingswork-dishwasher',prefix:process.env.EVIDENCE_PREFIX||'local'});assert.deepEqual(errors,[]);console.log(JSON.stringify({passed:true,stages:r.observations.length*8,playback:r.playbackCases.length,errors}));}finally{await browser.close();}}

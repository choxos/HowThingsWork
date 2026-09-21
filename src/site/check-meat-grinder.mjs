import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import {meatGrinderLesson as lesson} from './meat-grinder-lesson.js';
import {sampleGrinder,GRINDER_DEFAULTS as D,GRINDER_DOMAINS} from './meat-grinder-physics.js';
import {fixed} from './format.js';
const readings=page=>page.locator('.daily-readings>div').evaluateAll(ns=>Object.fromEntries(ns.map(n=>[n.querySelector('dt').textContent,n.querySelector('dd').textContent])));
async function preset(page,i){await page.getByRole('tab',{name:'Try it yourself',exact:true}).click();await page.locator(`[data-experiment="${i}"]`).click();await page.getByRole('tab',{name:'Controls',exact:true}).click();}
function compare(r,values,time){
 const s=sampleGrinder(values,time),expected={
  'Run clock':`${fixed(s.elapsed,2)} / 8 s`,'Crank rate now':`${fixed(s.rateNow,3)} turns/s`,
  'Rate while turning':`${fixed(s.rate,3)} / ${fixed(values.rate,2)} turns/s`,
  'Force needed at requested rate':`${fixed(s.handForce,2)} N`,'Breakaway force':`${fixed(s.breakawayForce,2)} N`,
  'Hand force while working':`${fixed(s.appliedForce,2)} N`,'Pressure while flowing':`${fixed(s.pressure/1000,1)} kPa`,
  'Yield threshold':`${fixed(s.yieldPressure/1000,1)} kPa`,'Output while turning':`${fixed(s.massFlow*1000,2)} g/s`,
  'Mince collected':`${fixed(s.minced*1000,1)} g`,'Power from the hand':`${fixed(s.handPower,2)} W`,
  'Effective conveying push':`${fixed(s.push,1)} N`,'Screw efficiency':`${fixed(s.eta*100,1)}%`,'Work delivered':`${fixed(s.work,2)} J`,
 };
 assert.equal(Object.keys(r).length,15);for(const [key,value] of Object.entries(expected))assert.equal(r[key],value,key);
 assert.match(r['Your result'],s.mode==='ready'?/^Ready/:s.complete?/^Finished/:s.stalled?/^Stalled/:s.limited?/^Slower under load/:/^Mincing/);return s;
}
export async function checkMeatGrinder(page,{base,dir,prefix='local',widths=[1440,390],playback=true,boundaries=true}){
 await mkdir(dir,{recursive:true});const observations=[],playbackCases=[];
 const shot=async name=>{await page.mouse.move(0,0);await page.locator('canvas').scrollIntoViewIfNeeded();await page.waitForTimeout(200);await page.locator('canvas').screenshot({path:`${dir}/${prefix}-${name}.png`});};
 for(const width of widths){
  await page.setViewportSize({width,height:width===390?844:1000});await page.goto('about:blank');await page.goto(base+'#machine/meat-grinder');await page.locator('[data-control="plate"]').waitFor();await page.evaluate(()=>document.fonts.ready);
  assert.equal(await page.locator('h1').innerText(),'Meat grinder');assert.equal(await page.locator('[data-control]').count(),5);assert.equal(await page.locator('[data-action]').count(),8);assert.equal(await page.locator('[data-experiment]').count(),11);
  assert.equal(await page.locator('.daily-primary-controls select').evaluate(e=>{const b=e.getBoundingClientRect();return scrollY===0&&b.top>=0&&b.bottom<=innerHeight&&b.height>=44&&document.elementFromPoint(b.x+b.width/2,b.y+b.height/2)===e;}),true);
  await page.screenshot({path:`${dir}/${prefix}-opening-${width}.png`});
  for(let i=0;i<lesson.tryIt.length;i++){
   await preset(page,i);const values=lesson.tryIt[i].values,states=[];compare(await readings(page),values,0);
   for(const [key,value] of Object.entries(values))assert.equal(Number(await page.locator(`[data-control="${key}"]`).inputValue()),value);
   for(const [j,time] of [0,2,8].entries()){
    if(time)await page.getByRole('button',{name:time===2?'After two seconds':'Finish the trial',exact:true}).click();
    const r=await readings(page),s=compare(r,values,time);states.push(r);assert.equal(await page.locator('[data-result]').isDisabled(),!s.complete);await shot(`trial-${width}-${i}-${j}`);
   }
   assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));observations.push({width,trial:i,title:lesson.tryIt[i].title,states});
  }
  const closeups=[['See the feed screw','Feed auger and drive shaft'],['See knife against plate','Knife and fixed plate'],['See the knife','Four-bladed knife'],['See the plate holes','Stationary perforated plate'],['See the clamp','Table clamp'],['See the whole grinder','Meat grinder']];
  for(const i of [0,1,2,7,8]){
   await preset(page,i);await page.getByRole('button',{name:'After two seconds',exact:true}).click();const held=await readings(page);
   for(const [label,name] of closeups){await page.getByRole('button',{name:label,exact:true}).click();assert.equal(await page.locator('.daily-part-detail h3').innerText(),name);assert.deepEqual(await readings(page),held);assert.equal(await page.locator('[data-isolate]').isChecked(),name!=='Meat grinder');await shot(`close-${width}-${i}-${name.replaceAll(' ','-')}`);}
  }
  await preset(page,0);await page.getByRole('button',{name:'After two seconds',exact:true}).click();const held=await readings(page);await page.locator('[data-cutaway]').uncheck();await shot(`cover-${width}`);assert.deepEqual(await readings(page),held);await page.locator('[data-cutaway]').check();
  await page.locator('[data-separation]').fill('100');await page.waitForTimeout(900);await shot(`separated-${width}`);assert.equal(await page.locator('[data-category]').count(),6);assert.deepEqual(await readings(page),held);
  for(const direction of ['in','out']){await page.locator(`[data-view="${direction}"]`).click();assert.equal(await page.locator('[data-separation]').inputValue(),'100');}
  await page.locator('[data-reassemble]').click();await page.waitForTimeout(900);assert.equal(await page.locator('[data-separation]').inputValue(),'0');
  if(boundaries)for(const [key,[min,max,step]] of Object.entries(GRINDER_DOMAINS))for(const value of ['plate','meat','knife'].includes(key)?Array.from({length:1+(max-min)/step},(_,i)=>min+i*step):[min,max]){
   await preset(page,0);await page.getByRole('button',{name:'After two seconds',exact:true}).click();const input=page.locator(`[data-control="${key}"]`);
   if(['plate','meat','knife'].includes(key))await input.selectOption(String(value));else{await input.fill(String(value));await input.dispatchEvent('input');}
   const values={...D,[key]:value};compare(await readings(page),values,value===D[key]?2:0);await page.getByRole('button',{name:'Finish the trial',exact:true}).click();compare(await readings(page),values,8);
  }
  await page.getByRole('button',{name:'Reset experiment',exact:true}).click();compare(await readings(page),D,0);
  await page.locator('[data-control="rate"]').focus();await page.keyboard.press('ArrowLeft');assert.equal(await page.locator('[data-control="rate"]').inputValue(),'.75'.replace(/^\./,'0.'));
 }
 if(playback)for(const i of [0,7,8]){
  await preset(page,i);const values=lesson.tryIt[i].values;await page.locator('[data-step]').click();compare(await readings(page),values,.05);
  await page.locator('[data-play]').click();await page.waitForFunction(()=>parseFloat([...document.querySelectorAll('.daily-readings>div')].find(n=>n.querySelector('dt').textContent==='Run clock').querySelector('dd').textContent)>.4);
  await page.locator('[data-play]').click();const held=await readings(page);await page.waitForTimeout(300);assert.deepEqual(await readings(page),held);
  await page.locator('[data-play]').click();await page.waitForFunction(()=>document.querySelector('[data-play]').getAttribute('aria-pressed')==='false',null,{timeout:20000});const ended=await readings(page);compare(ended,values,8);await shot(`continuous-${i}`);
  await page.locator('[data-result]').click();await page.locator('[data-play]').click();await page.waitForFunction(()=>parseFloat([...document.querySelectorAll('.daily-readings>div')].find(n=>n.querySelector('dt').textContent==='Run clock').querySelector('dd').textContent)<1);await page.locator('[data-play]').click();
  for(const [key,value]of Object.entries(values))assert.equal(Number(await page.locator(`[data-control="${key}"]`).inputValue()),value);
  await page.locator('[data-play]').click();await page.getByRole('button',{name:'See knife against plate',exact:true}).click();assert.equal(await page.locator('[data-play]').getAttribute('aria-pressed'),'false');
  playbackCases.push({trial:i,step:true,pause:true,completion:ended,replay:true,inspectionStops:true});
 }
 const result={passed:true,observations,playbackCases};await writeFile(`${dir}/${prefix}-grinder-browser.json`,JSON.stringify(result,null,2)+'\n');return result;
}
if(typeof process!=='undefined'&&process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 const {chromium}=await import('playwright'),browser=await chromium.launch({headless:true});
 try{const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));page.setDefaultTimeout(20000);page.setDefaultNavigationTimeout(45000);
  const r=await checkMeatGrinder(page,{base:process.env.SITE_URL||'http://localhost:5194/',dir:process.env.EVIDENCE_DIR||'/tmp/howthingswork-meat-grinder',prefix:process.env.EVIDENCE_PREFIX||'local'});assert.deepEqual(errors,[]);console.log(JSON.stringify({passed:true,presetStageChecks:r.observations.length*3,playbackCases:r.playbackCases.length,errors}));
 }finally{await browser.close();}
}

import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import {drinkingStrawLesson as lesson} from './drinking-straw-lesson.js';
import {sampleStraw,STRAW_DEFAULTS as D,STRAW_DOMAINS} from './drinking-straw-physics.js';
import {fixed} from './format.js';
const readings=page=>page.locator('.daily-readings>div').evaluateAll(ns=>Object.fromEntries(ns.map(n=>[n.querySelector('dt').textContent,n.querySelector('dd').textContent])));
async function preset(page,i){await page.getByRole('tab',{name:'Try it yourself',exact:true}).click();await page.locator(`[data-experiment="${i}"]`).click();await page.getByRole('tab',{name:'Controls',exact:true}).click();}
function compare(r,values,time){
 const s=sampleStraw(values,time),expected={
  'Run clock':`${fixed(s.elapsed,3)} s`,'Sip collected':`${fixed(s.drunk*1e6,2)} / 20 mL`,'Flow into mouth now':`${fixed(s.mouthFlow*1e6,2)} mL/s`,
  'Column above current surface':`${fixed(s.height*100,2)} cm`,'Surface fall':`${fixed((.12-s.level)*1000,2)} mm`,'Pressure can hold':`${fixed(s.holdHeight*100,2)} cm`,
  'Pressure difference':`${fixed(s.dp/1000,2)} kPa`,'Column weight per area':`${fixed(s.liftPressure/1000,3)} kPa`,
  'Pressure balance':s.dp?`lift ${fixed(s.liftShare*100,1)}%, wall ${fixed(s.frictionShare*100,1)}%, entry and speed ${fixed(s.kineticShare*100,1)}%`:'No pressure difference',
  'Operating flow regime':s.operatingFlow<1e-12?'At rest':`${s.reynolds<2000?'Laminar':s.reynolds<4000?'Transition':'Turbulent'} · Re ${fixed(s.reynolds,1)}`,
  'Arrival at mouth':s.arrivedAt===null?'Not within 12 s':`${fixed(s.arrivedAt,3)} s`,'20 mL completion':s.sipTime===null?'Not within 12 s':`${fixed(s.sipTime,3)} s`,
  'Mouth pressure':`${fixed((101325-s.mouth)/1000,2)} kPa absolute`,
 };
 assert.equal(Object.keys(r).length,14);for(const [key,value] of Object.entries(expected))assert.equal(r[key],value,key);
 const reason=s.values.hole?'vent open':!s.dp?'no pressure difference':s.arrivedAt===null?'mouth not reached':'sip still below 20 mL';
 assert.equal(r['Your result'],{ready:'Ready · press Play',vented:'Vented · no rise','no-suction':'No pressure difference · no rise',rising:'Liquid rising',held:'Column held below the mouth',drinking:'Liquid entering the mouth',sipped:'Finished · 20 mL sip',complete:`Trial ended · ${reason}`}[s.mode]);return s;
}
export async function checkDrinkingStraw(page,{base,dir,prefix='local',widths=[1440,390],playback=true,boundaries=true}){
 await mkdir(dir,{recursive:true});const observations=[],playbackCases=[];
 const shot=async name=>{await page.mouse.move(0,0);await page.locator('canvas').scrollIntoViewIfNeeded();await page.waitForTimeout(180);await page.locator('canvas').screenshot({path:`${dir}/${prefix}-${name}.png`});};
 for(const width of widths){
  await page.setViewportSize({width,height:width===390?844:1000});await page.goto('about:blank');await page.goto(base+'#machine/drinking-straw');await page.locator('[data-control="drink"]').waitFor();await page.evaluate(()=>document.fonts.ready);
  assert.equal(await page.locator('h1').innerText(),'Drinking straw');assert.equal(await page.locator('[data-control]').count(),5);assert.equal(await page.locator('[data-action]').count(),7);assert.equal(await page.locator('[data-experiment]').count(),12);
  const primary=await page.locator('.daily-primary-controls select').evaluateAll(es=>es.map(e=>{const b=e.getBoundingClientRect();return scrollY===0&&b.top>=0&&b.bottom<=innerHeight&&b.height>=44&&document.elementFromPoint(b.x+b.width/2,b.y+b.height/2)===e;}));assert.equal(primary.length,2);assert.ok(primary.every(Boolean));
  await page.screenshot({path:`${dir}/${prefix}-opening-${width}.png`});
  for(let i=0;i<lesson.tryIt.length;i++){
   await preset(page,i);const values=lesson.tryIt[i].values,states=[];compare(await readings(page),values,0);for(const [key,value]of Object.entries(values))assert.equal(Number(await page.locator(`[data-control="${key}"]`).inputValue()),value);
   for(const [j,time]of [0,.04,12].entries()){
    if(time)await page.getByRole('button',{name:time===.04?'Early rise':'Finish the trial',exact:true}).click();
    const r=await readings(page),s=compare(r,values,time);states.push(r);assert.equal(await page.locator('[data-result]').isDisabled(),!s.complete);await shot(`trial-${width}-${i}-${j}`);
   }
   assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));observations.push({width,trial:i,title:lesson.tryIt[i].title,states});
  }
  const closeups=[['See the liquid column','Liquid column'],['See the mouth seal','Sealed lips'],['See the side vent','Side vent'],['See the glass','Glass'],['See the whole straw','Drinking straw']];
  for(const i of [0,2,3,5]){await preset(page,i);await page.getByRole('button',{name:'Early rise',exact:true}).click();const held=await readings(page);for(const [label,name]of closeups){await page.getByRole('button',{name:label,exact:true}).click();assert.equal(await page.locator('.daily-part-detail h3').innerText(),name);assert.deepEqual(await readings(page),held);assert.equal(await page.locator('[data-isolate]').isChecked(),name!=='Drinking straw');await shot(`close-${width}-${i}-${name.replaceAll(' ','-')}`);}}
  await preset(page,0);await page.getByRole('button',{name:'Early rise',exact:true}).click();const held=await readings(page);await page.locator('[data-cutaway]').uncheck();await shot(`cover-${width}`);assert.deepEqual(await readings(page),held);await page.locator('[data-cutaway]').check();
  await page.locator('[data-separation]').fill('100');await page.waitForTimeout(850);await shot(`separated-${width}`);assert.equal(await page.locator('[data-category]').count(),6);assert.deepEqual(await readings(page),held);
  for(const direction of ['in','out']){await page.locator(`[data-view="${direction}"]`).click();assert.equal(await page.locator('[data-separation]').inputValue(),'100');}await page.locator('[data-reassemble]').click();await page.waitForTimeout(850);assert.equal(await page.locator('[data-separation]').inputValue(),'0');
  if(boundaries)for(const [key,[min,max,step]]of Object.entries(STRAW_DOMAINS))for(const value of ['drink','hole'].includes(key)?Array.from({length:1+(max-min)/step},(_,i)=>min+i*step):[min,max]){
   await preset(page,0);await page.getByRole('button',{name:'Early rise',exact:true}).click();const input=page.locator(`[data-control="${key}"]`);
   if(['drink','hole'].includes(key))await input.selectOption(String(value));else{await input.fill(String(value));await input.dispatchEvent('input');}
   const values={...D,[key]:value};compare(await readings(page),values,value===D[key] ? .04 : 0);await page.getByRole('button',{name:'Finish the trial',exact:true}).click();compare(await readings(page),values,12);await shot(`boundary-${width}-${key}-${value}`);
  }
  await page.getByRole('button',{name:'Reset experiment',exact:true}).click();compare(await readings(page),D,0);await page.locator('[data-control="diameter"]').focus();await page.keyboard.press('ArrowLeft');assert.equal(await page.locator('[data-control="diameter"]').inputValue(),'5');
 }
 if(playback)for(const i of [0,2,3,5]){
  await preset(page,i);const values=lesson.tryIt[i].values;await page.locator('[data-step]').click();compare(await readings(page),values,.01);
  // A thin sip is over in half a second, so pause from inside the page as soon as the run is under way.
  await page.locator('[data-play]').click();await page.waitForFunction(()=>{const running=parseFloat([...document.querySelectorAll('.daily-readings>div')].find(n=>n.querySelector('dt').textContent==='Run clock').querySelector('dd').textContent)>.04;if(running)document.querySelector('[data-play]').click();return running;});
  assert.equal(await page.locator('[data-play]').getAttribute('aria-pressed'),'false');const held=await readings(page);await page.waitForTimeout(200);assert.deepEqual(await readings(page),held);
  await page.locator('[data-play]').click();await page.waitForFunction(()=>document.querySelector('[data-play]').getAttribute('aria-pressed')==='false',null,{timeout:20000});const ended=await readings(page);compare(ended,values,12);await shot(`continuous-${i}`);
  await page.locator('[data-result]').click();await page.locator('[data-play]').click();await page.waitForFunction(()=>parseFloat([...document.querySelectorAll('.daily-readings>div')].find(n=>n.querySelector('dt').textContent==='Run clock').querySelector('dd').textContent)<.1);await page.locator('[data-play]').click();
  for(const [key,value]of Object.entries(values))assert.equal(Number(await page.locator(`[data-control="${key}"]`).inputValue()),value);
  await page.locator('[data-play]').click();await page.getByRole('button',{name:'See the side vent',exact:true}).click();assert.equal(await page.locator('[data-play]').getAttribute('aria-pressed'),'false');playbackCases.push({trial:i,step:true,pause:true,completion:ended,replay:true,inspectionStops:true});
 }
 const result={passed:true,observations,playbackCases};await writeFile(`${dir}/${prefix}-straw-browser.json`,JSON.stringify(result,null,2)+'\n');return result;
}
if(typeof process!=='undefined'&&process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){const {chromium}=await import('playwright'),browser=await chromium.launch({headless:true});try{const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));page.setDefaultTimeout(20000);page.setDefaultNavigationTimeout(45000);const r=await checkDrinkingStraw(page,{base:process.env.SITE_URL||'http://localhost:5194/',dir:process.env.EVIDENCE_DIR||'/tmp/howthingswork-drinking-straw',prefix:process.env.EVIDENCE_PREFIX||'local'});assert.deepEqual(errors,[]);console.log(JSON.stringify({passed:true,stages:r.observations.length*3,playback:r.playbackCases.length,errors}));}finally{await browser.close();}}

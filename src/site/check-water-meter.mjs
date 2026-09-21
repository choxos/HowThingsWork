import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import {createWaterMeterModel} from './water-meter-model.js';
import {waterMeterLesson as lesson} from './water-meter-lesson.js';
const readings=page=>page.locator('.daily-readings>div').evaluateAll(ns=>Object.fromEntries(ns.map(n=>[n.querySelector('dt').textContent,n.querySelector('dd').textContent])));
async function preset(page,i){await page.getByRole('tab',{name:'Try it yourself',exact:true}).click();await page.locator(`[data-experiment="${i}"]`).click();await page.getByRole('tab',{name:'Controls',exact:true}).click();}
export async function checkWaterMeter(page,{base,dir,prefix='local',widths=[1440,390],playback=true}){
 await mkdir(dir,{recursive:true});const model=createWaterMeterModel(),observations=[],playbackCases=[];
 const compare=async(values,time)=>{model.reset();model.update(values);model.advance(time);const expected=Object.fromEntries(model.getState().readings.map(r=>[r.label,r.value])),actual=await readings(page);assert.equal(Object.keys(actual).length,Object.keys(expected).length);for(const [key,value]of Object.entries(expected))assert.equal(actual[key],value,key);return actual;};
 const shot=async name=>{await page.mouse.move(0,0);await page.locator('canvas').scrollIntoViewIfNeeded();await page.waitForTimeout(180);await page.locator('canvas').screenshot({path:`${dir}/${prefix}-${name}.png`});};
 try{
  for(const width of widths){
   await page.setViewportSize({width,height:width===390?844:1000});await page.goto('about:blank');await page.goto(base+'#machine/water-meter');await page.locator('[data-control="size"]').waitFor();await page.evaluate(()=>document.fonts.ready);
   assert.equal(await page.locator('h1').innerText(),'Water meter');assert.equal(await page.locator('[data-control]').count(),6);assert.equal(await page.locator('[data-action]').count(),9);assert.equal(await page.locator('[data-experiment]').count(),16);
   const primary=await page.locator('.daily-primary-controls select').evaluateAll(es=>es.map(e=>{const b=e.getBoundingClientRect();return scrollY===0&&b.top>=0&&b.bottom<=innerHeight&&b.height>=44&&document.elementFromPoint(b.x+b.width/2,b.y+b.height/2)===e;}));assert.equal(primary.length,1);assert.ok(primary.every(Boolean));await page.screenshot({path:`${dir}/${prefix}-opening-${width}.png`});
   for(let i=0;i<lesson.tryIt.length;i++){
    await preset(page,i);const values=lesson.tryIt[i].values,states=[await compare(values,0)];for(const [key,value]of Object.entries(values))assert.equal(Number(await page.locator(`[data-control="${key}"]`).inputValue()),value);await shot(`trial-${width}-${i}-ready`);
    for(const [name,time]of [['Halfway through observation',10],['Finish observation',20]]){await page.getByRole('button',{name,exact:true}).click();states.push(await compare(values,time));assert.equal(await page.locator('[data-result]').isDisabled(),time<20);await shot(`trial-${width}-${i}-${time}`);}
    await page.getByRole('button',{name:'Start observation',exact:true}).click();await compare(values,0);assert.equal(await page.locator('[data-result]').isDisabled(),true);
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));observations.push({width,trial:i,title:lesson.tryIt[i].title,states});
   }
   for(const i of [0,2,4,6]){
    await preset(page,i);await page.getByRole('button',{name:'Halfway through observation',exact:true}).click();const held=await readings(page);
    for(const [label,name]of [['See the impeller','Impeller and first worm shaft'],['See the first worm','First single-start worm'],['See the pointer','Fixed one-liter dial'],['Read the rollers','Cubic-meter roller register'],['See decimal carry','Carry from 1 to 10 liters'],['See the whole meter','Mechanical water meter']]){
     await page.getByRole('button',{name:label,exact:true}).click();assert.equal(await page.locator('.daily-part-detail h3').innerText(),name);assert.deepEqual(await readings(page),held);await shot(`close-${width}-${i}-${label.replaceAll(' ','-')}`);
    }
   }
   for(const trial of [0,6]){
    await preset(page,trial);await page.getByRole('button',{name:'Halfway through observation',exact:true}).click();const held=await readings(page);await page.locator('[data-separation]').fill('100');await page.waitForTimeout(850);await shot(`separated-${width}-${trial}`);
    const categories=await page.locator('[data-category]').allTextContents();assert.ok(categories.length>=5);assert.equal(new Set(categories).size,categories.length);assert.ok(!categories.some(n=>/Water route/.test(n)));assert.deepEqual(await readings(page),held);
    for(const direction of ['in','out']){await page.locator(`[data-view="${direction}"]`).click();assert.equal(await page.locator('[data-separation]').inputValue(),'100');}await page.locator('[data-reassemble]').click();await page.waitForTimeout(850);assert.equal(await page.locator('[data-separation]').inputValue(),'0');
   }
   for(const c of model.controls)for(const value of c.options?c.options.map(o=>o.value):[c.min,c.max]){
    await preset(page,0);await page.getByRole('button',{name:'Halfway through observation',exact:true}).click();const input=page.locator(`[data-control="${c.key}"]`);if(c.options)await input.selectOption(String(value));else{await input.fill(String(value));await input.dispatchEvent('input');}
    const values={...lesson.tryIt[0].values,[c.key]:value};await compare(values,value===lesson.tryIt[0].values[c.key]?10:0);await page.getByRole('button',{name:'Finish observation',exact:true}).click();await compare(values,20);await shot(`boundary-${width}-${c.key}-${value}`);
   }
   await page.getByRole('button',{name:'Reset experiment',exact:true}).click();await compare(model.defaults,0);await page.locator('[data-control="flow"]').focus();await page.keyboard.press('ArrowLeft');assert.equal(await page.locator('[data-control="flow"]').inputValue(),'5.95');
  }
  if(playback)for(let i=0;i<lesson.tryIt.length;i++){
   await preset(page,i);const values=lesson.tryIt[i].values;await page.locator('[data-step]').click();await compare(values,.1);await page.locator('[data-play]').click();await page.waitForTimeout(350);await page.locator('[data-play]').click();const held=await readings(page);await page.waitForTimeout(180);assert.deepEqual(await readings(page),held);
   await page.locator('[data-play]').click();await page.waitForFunction(()=>document.querySelector('[data-play]').getAttribute('aria-pressed')==='false',null,{timeout:35000});const ended=await compare(values,20);await shot(`continuous-${i}`);
   await page.locator('[data-result]').click();await page.locator('[data-play]').click();await page.waitForFunction(end=>![...document.querySelectorAll('.daily-readings dd')].some(n=>n.textContent===end),ended['Observation clock']);await page.locator('[data-play]').click();for(const [key,value]of Object.entries(values))assert.equal(Number(await page.locator(`[data-control="${key}"]`).inputValue()),value);
   await page.locator('[data-play]').click();await page.getByRole('button',{name:'Read the rollers',exact:true}).click();assert.equal(await page.locator('[data-play]').getAttribute('aria-pressed'),'false');playbackCases.push({trial:i,step:true,pause:true,completion:ended,replay:true,inspectionStops:true});
  }
  const result={passed:true,observations,playbackCases};await writeFile(`${dir}/${prefix}-water-meter-browser.json`,JSON.stringify(result,null,2)+'\n');return result;
 }finally{model.dispose();}
}
if(typeof process!=='undefined'&&process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){const {chromium}=await import('playwright'),browser=await chromium.launch({headless:true});try{const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));page.setDefaultTimeout(20000);const r=await checkWaterMeter(page,{base:process.env.SITE_URL||'http://localhost:5194/',dir:process.env.EVIDENCE_DIR||'/tmp/howthingswork-water-meter',prefix:process.env.EVIDENCE_PREFIX||'local'});assert.deepEqual(errors,[]);console.log(JSON.stringify({passed:true,states:r.observations.length*3,playback:r.playbackCases.length,errors}));}finally{await browser.close();}}

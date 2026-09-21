import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {createToiletTankModel} from './toilet-tank-model.js';
import {toiletTankLesson as lesson} from './toilet-tank-lesson.js';
const readings=page=>page.locator('.daily-readings>div').evaluateAll(ns=>Object.fromEntries(ns.map(n=>[n.querySelector('dt').textContent,n.querySelector('dd').textContent])));
async function preset(page,i){await page.getByRole('tab',{name:'Try it yourself',exact:true}).click();await page.locator(`[data-experiment="${i}"]`).click();await page.getByRole('tab',{name:'Controls',exact:true}).click();}
export async function checkToiletTank(page,{base,dir,prefix='local',widths=[1440,390],playback=true}){
 await mkdir(dir,{recursive:true});const model=createToiletTankModel(),observations=[],playbackCases=[];
 const compare=async()=>{const expected=Object.fromEntries(model.getState().readings.map(r=>[r.label,r.value])),actual=await readings(page);assert.equal(Object.keys(actual).length,Object.keys(expected).length);for(const [key,value]of Object.entries(expected))assert.equal(actual[key],value,key);return actual;};
 const shot=async name=>{await page.mouse.move(0,0);await page.locator('canvas').evaluate(c=>c.scrollIntoView({block:'start',behavior:'instant'}));await page.waitForTimeout(180);await page.locator('canvas').screenshot({path:`${dir}/${prefix}-${name}.png`});};
 const action=async label=>{await page.getByRole('button',{name:label,exact:true}).click();model.actions.find(a=>a.label===label).run();return compare();};
 try{
  for(const width of widths){
   await page.setViewportSize({width,height:width===390?844:1000});await page.goto('about:blank');await page.goto(base+'#machine/toilet-tank');await page.locator('[data-control="fault"]').waitFor();await page.evaluate(()=>document.fonts.ready);
   assert.equal(await page.locator('h1').innerText(),'Toilet tank');assert.equal(await page.locator('[data-control]').count(),6);assert.equal(await page.locator('[data-action]').count(),model.actions.length);assert.equal(await page.locator('[data-experiment]').count(),lesson.tryIt.length);
   const primary=await page.locator('.daily-primary-controls select').evaluateAll(es=>es.map(e=>{const b=e.getBoundingClientRect();return scrollY===0&&b.top>=0&&b.bottom<=innerHeight&&b.height>=44&&document.elementFromPoint(b.x+b.width/2,b.y+b.height/2)===e;}));assert.equal(primary.length,1);assert.ok(primary.every(Boolean));await page.screenshot({path:`${dir}/${prefix}-opening-${width}.png`});
   for(let i=0;i<lesson.tryIt.length;i++){
    await preset(page,i);model.reset();model.update(lesson.tryIt[i].values);const states=[await compare()];for(const [key,value]of Object.entries(lesson.tryIt[i].values))assert.equal(Number(await page.locator(`[data-control="${key}"]`).inputValue()),value);await shot(`trial-${width}-${i}-ready`);
    for(const [label,stage]of [['Inspect priming','prime'],['Inspect the falling level','falling'],['Inspect air entering','air'],['Finish the trial','finished']]){states.push(await action(label));await shot(`trial-${width}-${i}-${stage}`);}
    assert.equal(await page.locator('[data-result]').isDisabled(),false);await action('Start again');assert.equal(await page.locator('[data-result]').isDisabled(),true);assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));observations.push({width,trial:i,title:lesson.tryIt[i].title,states});
   }
   for(const trial of [0,9,11]){
    await preset(page,trial);model.reset();model.update(lesson.tryIt[trial].values);await action('Inspect the falling level');const held=await readings(page);
    for(const [label,id]of [['See the diaphragm','lifting-disk'],['See the float valve','inlet'],['See the whole tank','system']]){await action(label);assert.equal(await page.locator('.daily-part-detail h3').innerText(),model.parts.find(p=>p.id===id).name);assert.deepEqual(await readings(page),held);await shot(`close-${width}-${trial}-${id}`);}
    await page.locator('[data-separation]').fill('100');await page.waitForTimeout(850);await shot(`separated-${width}-${trial}`);const categories=await page.locator('[data-category]').allTextContents();assert.ok(categories.length>=4);assert.equal(new Set(categories).size,categories.length);assert.ok(!categories.some(n=>/Stored tank water|Incoming water|Water and air|Discharge toward/.test(n)));assert.deepEqual(await readings(page),held);
    for(const direction of ['in','out']){await page.locator(`[data-view="${direction}"]`).click();assert.equal(await page.locator('[data-separation]').inputValue(),'100');}await page.locator('[data-reassemble]').click();await page.waitForTimeout(850);assert.equal(await page.locator('[data-separation]').inputValue(),'0');
   }
   for(const c of model.controls)for(const value of c.options?c.options.map(o=>o.value):[c.min,c.max]){
    await preset(page,0);model.reset();model.update(lesson.tryIt[0].values);await action('Inspect priming');const input=page.locator(`[data-control="${c.key}"]`);if(c.options)await input.selectOption(String(value));else{await input.fill(String(value));await input.dispatchEvent('input');}model.update({[c.key]:value});await compare();await action('Finish the trial');await shot(`boundary-${width}-${c.key}-${value}`);
   }
   await page.getByRole('button',{name:'Reset experiment',exact:true}).click();model.reset();await compare();
  }
  if(playback)for(let i=0;i<lesson.tryIt.length;i++){
   await preset(page,i);model.reset();model.update(lesson.tryIt[i].values);await page.locator('[data-step]').click();model.advance(.1);await compare();await page.locator('[data-play]').click();await page.waitForTimeout(250);await page.locator('[data-play]').click();const held=await readings(page);await page.waitForTimeout(180);assert.deepEqual(await readings(page),held);
   await page.locator('[data-play]').click();await page.waitForFunction(()=>document.querySelector('[data-play]').getAttribute('aria-pressed')==='false',null,{timeout:90000});model.advance(1e4);const ended=await compare();await shot(`continuous-${i}`);
   await page.locator('[data-result]').click();await page.locator('[data-play]').click();await page.waitForFunction(end=>![...document.querySelectorAll('.daily-readings dd')].some(n=>n.textContent===end),ended['Playback clock']);await page.locator('[data-play]').click();for(const [key,value]of Object.entries(lesson.tryIt[i].values))assert.equal(Number(await page.locator(`[data-control="${key}"]`).inputValue()),value);
   await page.locator('[data-play]').click();await page.getByRole('button',{name:'See the whole tank',exact:true}).click();assert.equal(await page.locator('[data-play]').getAttribute('aria-pressed'),'false');playbackCases.push({trial:i,step:true,pause:true,completion:ended,replay:true,inspectionStops:true});
   await writeFile(`${dir}/${prefix}-playback-progress.json`,JSON.stringify(playbackCases,null,2)+'\n');
  }
  const result={passed:true,observations,playbackCases};await writeFile(`${dir}/${prefix}-toilet-tank-browser.json`,JSON.stringify(result,null,2)+'\n');return result;
 }finally{model.dispose();}
}

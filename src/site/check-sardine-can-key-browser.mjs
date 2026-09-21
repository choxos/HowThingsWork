import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {chromium} from 'playwright';
import {sardineCanKeyLesson as lesson} from './sardine-can-key-lesson.js';
import {sampleSardineKey,SARDINE_KEY_CONSTANTS as C} from './sardine-can-key-physics.js';
import {fixed} from './format.js';
const base=process.env.SITE_URL||'http://localhost:5194/';
const evidence=process.env.EVIDENCE_DIR||'documentation/audit/evidence/sardine-can-key/browser';
await mkdir(evidence,{recursive:true});
const browser=await chromium.launch({headless:true}),errors=[],observations=[];
try{
 for(const width of [1440,390]){
  const page=await browser.newPage({viewport:{width,height:width===390?844:1000},isMobile:width===390,hasTouch:width===390});
  page.on('pageerror',e=>errors.push(e.message));
  await page.goto(base+'#machine/sardine-can-key');
  await page.getByRole('heading',{name:'Sardine-can key',exact:true}).waitFor();
  const reading=label=>page.locator('.daily-readings>div').filter({has:page.locator('dt',{hasText:new RegExp('^'+label+'$')})}).locator('dd');
  for(const [index,trial] of lesson.tryIt.entries()){
   await page.getByRole('tab',{name:'Try it yourself',exact:true}).click();
   await page.getByRole('button',{name:'Set up this experiment',exact:true}).nth(index).click();
   for(const [key,value] of Object.entries(trial.values))assert.equal(Number(await page.locator(`[data-control="${key}"]`).inputValue()),value,trial.title+' '+key);
   assert.match(await reading('Key turns').innerText(),/^0.0 of /);
   await page.getByRole('tab',{name:'Controls',exact:true}).click();
   await page.getByRole('button',{name:'Turn the key a tenth of a turn',exact:true}).click();
   const step=sampleSardineKey(trial.values,.1/C.turnRate);
   assert.equal(await reading('Key turns').innerText(),`${fixed(step.turns,1)} of ${fixed(step.turnsTotal,1)}`);
   await page.getByRole('button',{name:'Inspect: band off, lid lifted',exact:true}).click();
   const expected=sampleSardineKey(trial.values,C.duration);
   assert.equal(await reading('Key turns').innerText(),`${fixed(expected.turns,1)} of ${fixed(expected.turnsTotal,1)}`);
   assert.equal(await reading('Work done').innerText(),`${fixed(expected.work,2)} J`);
   assert.equal(await page.getByRole('button',{name:'Inspect the freed lid',exact:true}).isEnabled(),expected.freed);
   assert.match(await reading('Your result').innerText(),expected.freed?/lid lifts clear/:expected.stallLength===0?/will not turn/:/Stalled/);
   assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'phone horizontal overflow');
   observations.push({width,title:trial.title,result:await reading('Your result').innerText()});
  }
  await page.getByRole('button',{name:'Reset experiment',exact:true}).click();
  await page.getByRole('button',{name:'Turn the key',exact:true}).click();
  await page.waitForTimeout(400);
  await page.getByRole('button',{name:'Pause',exact:true}).click();
  const paused=await reading('Key turns').innerText();await page.waitForTimeout(350);assert.equal(await reading('Key turns').innerText(),paused);
  await page.getByRole('button',{name:'Turn the key',exact:true}).click();
  await page.waitForFunction(()=>document.querySelector('.daily-readings').textContent.includes('lid lifts clear'),{timeout:25000});
  await page.getByRole('button',{name:'Turn the key',exact:true}).click();await page.waitForTimeout(200);
  assert.match(await reading('Your result').innerText(),/Winding/,'completion play restarts');
  await page.getByRole('button',{name:'Pause',exact:true}).click();
  await page.getByRole('button',{name:'Inspect: half off',exact:true}).click();
  await page.locator('canvas').scrollIntoViewIfNeeded();await page.screenshot({path:`${evidence}/half-${width}.png`});
  await page.close();
 }
 assert.deepEqual(errors,[]);
 await writeFile(`${evidence}/results.json`,JSON.stringify({result:'PASS',observations,errors},null,2)+'\n');
 console.log(`PASS sardine key browser: ${observations.length} preset cases, step, physical outcomes, pause, completion replay and mobile layout.`);
}finally{await browser.close();}

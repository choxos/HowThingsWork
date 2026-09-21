import assert from 'node:assert/strict';
import {mkdir, writeFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import {eggWhiskLesson as lesson} from './beaters-lessons.js';
import {sampleEggWhisk, WHISK_DEFAULTS, WHISK_DOMAINS} from './beaters-physics.js';
import {fixed} from './format.js';

const stages=[1,4,8],closeups=[['See the front gear contact','Front bevel pinion'],['See the back gear contact','Back bevel pinion'],['See the blades from above','Both beaters'],['See the shaft bearings','Shaft bearings'],['Whole egg whisk','Egg whisk']];
const readings=page=>page.locator('.daily-readings>div').evaluateAll(ns=>Object.fromEntries(ns.map(n=>[n.querySelector('dt').textContent,n.querySelector('dd').textContent])));
async function preset(page,i){await page.getByRole('tab',{name:'Try it yourself',exact:true}).click();await page.locator(`[data-experiment="${i}"]`).click();await page.getByRole('tab',{name:'Controls',exact:true}).click();}
function compare(r,values,time){
  const s=sampleEggWhisk(values,time),flow=s.reynolds<10?'mostly viscous drag':s.reynolds>1000?'mostly inertial drag':'mixed drag';
  const expected={
    'Trial time':`${fixed(s.elapsed,2)} s`,
    'Beater speed':`${fixed(s.beaterRate*60,0)} rpm each, opposite ways`,
    'Force on the crank':`${fixed(s.handForce,1)} N`,
    'Your hand can give':`${fixed(values.force,0)} N`,
    'Crank rate':`${fixed(s.rate,2)} turns a second`,
    'Torque on each beater':`${fixed(s.beaterTorque*1000,1)} N·mm`,
    'Power into the mixture':`${fixed(2*s.beaterPower,2)} W`,
    'Flow around the beaters':`${flow}, Reynolds number ${fixed(s.reynolds,0)}`,
    'Beater turns so far':`${fixed(s.beaterTurns,2)} each`,
    'Work by your hand':`${fixed(s.work,2)} J`,
  };
  assert.equal(Object.keys(r).length,11);
  for(const [key,value] of Object.entries(expected))assert.equal(r[key],value,key);
  assert.match(r['Your result'],s.complete?/^Eight-second trial complete/:time===0?/^Ready/:s.limited?/^Your hand slows/:/^Beating at/);
  return s;
}

export async function checkEggWhisk(page,{base,dir,prefix='local',widths=[1440,390],trials=lesson.tryIt.map((_,i)=>i),playback=true,boundaries=true}){
  await mkdir(dir,{recursive:true});const observations=[],playbackCases=[];
  const shot=async name=>{await page.mouse.move(0,0);await page.locator('canvas').scrollIntoViewIfNeeded();await page.waitForTimeout(200);return page.locator('canvas').screenshot({path:`${dir}/${prefix}-${name}.png`});};
  for(const width of widths){
    await page.setViewportSize({width,height:width===390?844:1000});await page.goto('about:blank');await page.goto(base+'#machine/egg-whisk');await page.locator('[data-control="gear"]').waitFor();await page.evaluate(()=>document.fonts.ready);
    assert.equal(await page.locator('h1').innerText(),'Egg whisk');assert.equal(await page.locator('[data-control]').count(),4);assert.equal(await page.locator('[data-action]').count(),8);assert.equal(await page.locator('[data-experiment]').count(),10);
    const primary=await page.locator('.daily-primary-controls select').evaluate(e=>{const b=e.getBoundingClientRect();return {visible:scrollY===0&&b.top>=0&&b.bottom<=innerHeight&&b.height>=44,unobscured:document.elementFromPoint(b.x+b.width/2,b.y+b.height/2)===e};});
    assert.equal(primary.visible,true);assert.equal(primary.unobscured,true);await page.screenshot({path:`${dir}/${prefix}-opening-${width}.png`});
    for(const i of trials){
      const values=lesson.tryIt[i].values;await preset(page,i);compare(await readings(page),values,0);assert.equal(await page.locator('[data-result]').isDisabled(),true);
      for(const [key,value] of Object.entries(values)){assert.equal(Number(await page.locator(`[data-control="${key}"]`).inputValue()),value);assert.equal(await page.locator(`[data-control="${key}"]`).isEnabled(),true);}
      const states=[];
      for(const time of stages){
        await page.getByRole('button',{name:`Inspect: after ${time} ${time===1?'second':'seconds'}`,exact:true}).click();const r=await readings(page),s=compare(r,values,time);states.push(r);
        assert.equal(await page.locator('[data-result]').isDisabled(),!s.complete);assert.ok(await page.locator('.daily-readings>div').evaluateAll(ns=>ns.every(n=>n.querySelector('p')?.textContent.length>15)));
        await shot(`trial-${width}-${i}-${time}`);
      }
      if(i===3){assert.equal(states[2]['Beater turns so far'],'0.61 each');assert.equal(states[2]['Crank rate'],'0.02 turns a second');}
      assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));observations.push({width,trial:i,title:lesson.tryIt[i].title,states});
    }
    for(const i of [0,4,5]){
      await preset(page,i);await page.getByRole('button',{name:'Inspect: after 1 second',exact:true}).click();const held=await readings(page);
      for(const [label,name] of closeups){await page.getByRole('button',{name:label,exact:true}).click();assert.equal(await page.locator('.daily-part-detail h3').innerText(),name);assert.deepEqual(await readings(page),held);assert.equal(await page.locator('[data-isolate]').isChecked(),name==='Both beaters');await shot(`close-${width}-${i}-${name.replaceAll(' ','-')}`);}
    }
    await page.getByRole('button',{name:'Inspect: after 8 seconds',exact:true}).click();await page.locator('[data-result]').click();assert.equal(await page.locator('.daily-part-detail h3').innerText(),'Both beaters');await shot(`result-${width}`);
    await preset(page,0);const held=await readings(page);assert.equal(await page.locator('[data-cutaway]').isChecked(),true);await page.locator('[data-cutaway]').uncheck();await shot(`cover-${width}`);assert.deepEqual(await readings(page),held);await page.locator('[data-cutaway]').check();
    await page.locator('[data-separation]').fill('100');await page.locator('[data-separation]').dispatchEvent('input');await page.waitForTimeout(900);await shot(`separated-${width}`);const categories=await page.locator('[data-category]').allTextContents();assert.ok(categories.includes('Crown wheel and pinions'));assert.ok(!categories.includes('Front bevel pinion')&&!categories.includes('Back bevel pinion'));assert.deepEqual(await readings(page),held);
    for(const view of ['in','out']){await page.locator(`[data-view="${view}"]`).click();assert.equal(await page.locator('[data-separation]').inputValue(),'100');}
    await page.locator('[data-reassemble]').click();await page.waitForTimeout(900);assert.equal(await page.locator('[data-separation]').inputValue(),'0');assert.deepEqual(await readings(page),held);
    if(boundaries){
      for(const [key,[min,max]] of Object.entries(WHISK_DOMAINS))for(const value of key==='mixture'?[0,1,2,3,4]:key==='gear'?[0,1,2]:[min,max]){
        await preset(page,0);const input=page.locator(`[data-control="${key}"]`);
        if(key==='gear'||key==='mixture')await input.selectOption(String(value));else{await input.fill(String(value));await input.dispatchEvent('input');}
        const values={...WHISK_DEFAULTS,[key]:value};compare(await readings(page),values,0);
        await page.getByRole('button',{name:'Inspect: after 8 seconds',exact:true}).click();compare(await readings(page),values,8);
      }
      await page.getByRole('button',{name:'Reset experiment',exact:true}).click();compare(await readings(page),WHISK_DEFAULTS,0);
      await page.locator('[data-control="rate"]').focus();await page.keyboard.press('ArrowLeft');assert.equal(await page.locator('[data-control="rate"]').inputValue(),'1.25');
    }
  }
  if(playback)for(const i of [0,2,3]){
    await preset(page,i);await page.locator('[data-step]').click();compare(await readings(page),lesson.tryIt[i].values,.01);
    const started=Date.now();await page.locator('[data-play]').click();await page.waitForFunction(()=>parseFloat([...document.querySelectorAll('.daily-readings>div')].find(n=>n.querySelector('dt').textContent==='Trial time').querySelector('dd').textContent)>.3);await page.locator('[data-play]').click();const held=await readings(page);await page.waitForTimeout(300);assert.deepEqual(await readings(page),held);
    const elapsed=parseFloat(held['Trial time']),wall=(Date.now()-started)/1000;assert.ok(wall>=elapsed*3,'playback is visibly slowed');
    await page.locator('[data-play]').click();await page.waitForFunction(()=>document.querySelector('[data-play]').getAttribute('aria-pressed')==='false',null,{timeout:60000});const ended=await readings(page);compare(ended,lesson.tryIt[i].values,8);assert.equal(await page.locator('[data-result]').isDisabled(),false);
    await page.locator('[data-result]').click();await page.locator('[data-play]').click();await page.waitForFunction(()=>parseFloat([...document.querySelectorAll('.daily-readings>div')].find(n=>n.querySelector('dt').textContent==='Trial time').querySelector('dd').textContent)<1);await page.locator('[data-play]').click();
    for(const [key,value] of Object.entries(lesson.tryIt[i].values))assert.equal(await page.locator(`[data-control="${key}"]`).inputValue(),String(value));
    await page.locator('[data-play]').click();await page.getByRole('button',{name:'See the front gear contact',exact:true}).click();assert.equal(await page.locator('[data-play]').getAttribute('aria-pressed'),'false');playbackCases.push({trial:i,pause:true,step:true,quarterSpeed:true,completion:ended,replay:true,inspectionStops:true});
  }
  const result={passed:true,observations,playbackCases};await writeFile(`${dir}/${prefix}-whisk-browser.json`,JSON.stringify(result,null,2)+'\n');return result;
}
if(typeof process!=='undefined'&&process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
  const {chromium}=await import('playwright'),browser=await chromium.launch({headless:true});
  try{const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));page.setDefaultTimeout(20000);page.setDefaultNavigationTimeout(45000);
    const r=await checkEggWhisk(page,{base:process.env.SITE_URL||'http://localhost:5194/',dir:process.env.EVIDENCE_DIR||'/tmp/howthingswork-egg-whisk',prefix:process.env.EVIDENCE_PREFIX||'local'});assert.deepEqual(errors,[]);console.log(JSON.stringify({passed:true,presetStageChecks:r.observations.length*3,playbackCases:r.playbackCases.length,errors}));
  }finally{await browser.close();}
}

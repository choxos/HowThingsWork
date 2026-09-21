import assert from 'node:assert/strict';
import {mkdir, writeFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import {wingedCorkscrewLesson as lesson} from './corkscrew-lessons.js';
import {sampleWingedCorkscrew, wingedCorkscrewPlan, WINGED_DEFAULTS, WINGED_DOMAINS} from './corkscrew-physics.js';
import {fixed} from './format.js';

const stages=['Inspect: worm in, wings up','Inspect: the push at its peak','Inspect: the end','Inspect: turning the knob'];
const closeups=[['See the rack and pinions','Rack, shaft and knob'],['See the worm in the cork','Cork'],['See the wing stops','Lower wing stops'],['Read the force chart','Push needed on each wing'],['Whole corkscrew','Winged corkscrew']];
// Independent lesson anchors; mesh contacts and force/work identities have their own model check.
const outcomes=['lifted','lifted','stalled','stalled','lifted','torn','stalled','lifted','lifted','lifted'];
const lifts=[42,28,0,0,42,0,0,42,42,42];
const works=[6.59,5.73,0,0,6.59,0,0,9.88,6.59,6.59];
const readings=page=>page.locator('.daily-readings>div').evaluateAll(ns=>Object.fromEntries(ns.map(n=>[n.querySelector('dt').textContent,n.querySelector('dd').textContent])));
async function preset(page,i){await page.getByRole('tab',{name:'Try it yourself',exact:true}).click();await page.locator(`[data-experiment="${i}"]`).click();await page.getByRole('tab',{name:'Controls',exact:true}).click();}
function compare(r,values,time){
  const s=sampleWingedCorkscrew(values,time),lift=s.screwing||s.torn?0:Math.min(s.applied,s.needNow||s.applied);
  const expected={
    'Trial time':`${fixed(s.elapsed,2)} s`,
    'Push each wing needs now':`${fixed(s.wingNeed,1)} N`,
    'Your push on each wing':`${fixed(s.screwing?0:s.applied/s.leverage,1)} N of ${fixed(values.wing,0)} N`,
    'Lift on the rack':`${fixed(lift,0)} N`,
    'Leverage':`${fixed(s.leverage,1)} times`,
    'Wing angle':`${fixed(s.wingAngle*180/Math.PI,0)} degrees`,
    'Cork out':`${fixed(s.out,1)} of 44 mm`,
    'Worm tear-out limit':`${fixed(s.hold,0)} N`,
    'Worm depth':`${fixed(s.depthNow-s.withdrawal,1)} mm`,
    'Turning the knob':`${fixed(s.knobForce,1)} N on each side`,
    'Work lifting the cork':`${fixed(s.work,2)} J`,
  };
  assert.equal(Object.keys(r).length,12);
  for(const [key,value] of Object.entries(expected))assert.equal(r[key],value,key);
  const modes={ready:/^Ready/,screwing:/^Screwing in/,loading:/^Pushing the wings/,pulling:/^The cork is rising/,lifted:/^Wings down/,torn:/^The worm tore out/,stalled:/^Stuck/};
  assert.match(r['Your result'],modes[s.mode]);return s;
}

export async function checkWingedCorkscrew(page,{base,dir,prefix='local',widths=[1440,390],trials=lesson.tryIt.map((_,i)=>i),playback=true,boundaries=true}){
  await mkdir(dir,{recursive:true});const observations=[],playbackCases=[];
  const shot=async name=>{await page.mouse.move(0,0);await page.locator('canvas').scrollIntoViewIfNeeded();await page.waitForTimeout(180);return page.locator('canvas').screenshot({path:`${dir}/${prefix}-${name}.png`});};
  for(const width of widths){
    await page.setViewportSize({width,height:width===390?844:1000});await page.goto('about:blank');await page.goto(base+'#machine/rack-and-pinion-corkscrew');await page.locator('[data-control="worm"]').waitFor();await page.evaluate(()=>document.fonts.ready);
    assert.equal(await page.locator('h1').innerText(),'Rack-and-pinion corkscrew');assert.equal(await page.locator('[data-control]').count(),5);assert.equal(await page.locator('[data-action]').count(),9);assert.equal(await page.locator('[data-experiment]').count(),10);
    const primary=await page.locator('.daily-primary-controls select').evaluate(e=>{const b=e.getBoundingClientRect();return {visible:scrollY===0&&b.top>=0&&b.bottom<=innerHeight&&b.height>=44,unobscured:document.elementFromPoint(b.x+b.width/2,b.y+b.height/2)===e};});
    assert.equal(primary.visible,true);assert.equal(primary.unobscured,true);await page.screenshot({path:`${dir}/${prefix}-opening-${width}.png`});
    for(const i of trials){
      const values=lesson.tryIt[i].values;await preset(page,i);compare(await readings(page),values,0);assert.equal(await page.locator('[data-result]').isDisabled(),true);
      for(const [key,value] of Object.entries(values)){assert.equal(Number(await page.locator(`[data-control="${key}"]`).inputValue()),value);assert.equal(await page.locator(`[data-control="${key}"]`).isEnabled(),true);}
      const plan=wingedCorkscrewPlan(values),times=[plan.screwTime,plan.startTime??plan.tearTime??plan.rampEnd,plan.duration,Math.max(0,plan.screwTime-.01)],states=[];
      for(let j=0;j<stages.length;j++){
        await page.getByRole('button',{name:stages[j],exact:true}).click();const r=await readings(page),s=compare(r,values,times[j]);states.push(r);
        assert.equal(await page.locator('[data-result]').isDisabled(),!s.complete);assert.ok(await page.locator('.daily-readings>div').evaluateAll(ns=>ns.every(n=>n.querySelector('p')?.textContent.length>15)));
        if(j===0||j===2||j===3)await shot(`trial-${width}-${i}-${j}`);
      }
      assert.equal(sampleWingedCorkscrew(values,plan.duration).mode,outcomes[i]);assert.equal(parseFloat(states[2]['Cork out']),lifts[i]);assert.equal(parseFloat(states[2]['Work lifting the cork']),works[i]);
      if(i===0||i===8)assert.equal(states[3]['Turning the knob'],`${i===0?'10.3':'20.7'} N on each side`);
      assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));observations.push({width,trial:i,title:lesson.tryIt[i].title,states});
    }
    for(const i of [0,5]){
      await preset(page,i);await page.getByRole('button',{name:stages[i===0?0:2],exact:true}).click();const held=await readings(page);
      for(const [label,name] of closeups){await page.getByRole('button',{name:label,exact:true}).click();assert.equal(await page.locator('.daily-part-detail h3').innerText(),name);assert.deepEqual(await readings(page),held);await shot(`close-${width}-${i}-${name.replaceAll(' ','-')}`);}
    }
    await page.locator('[data-result]').click();assert.equal(await page.locator('.daily-part-detail h3').innerText(),'Cork');await shot(`result-${width}`);
    await preset(page,0);const held=await readings(page);assert.equal(await page.locator('[data-cutaway]').isChecked(),true);await page.locator('[data-cutaway]').uncheck();await shot(`cover-${width}`);assert.deepEqual(await readings(page),held);await page.locator('[data-cutaway]').check();
    await page.locator('[data-separation]').fill('100');await page.locator('[data-separation]').dispatchEvent('input');await page.waitForTimeout(800);await shot(`separated-${width}`);assert.deepEqual(await readings(page),held);
    for(const view of ['in','out']){await page.locator(`[data-view="${view}"]`).click();assert.equal(await page.locator('[data-separation]').inputValue(),'100');}
    await page.locator('[data-reassemble]').click();await page.waitForTimeout(800);assert.equal(await page.locator('[data-separation]').inputValue(),'0');assert.deepEqual(await readings(page),held);
    if(boundaries){
      for(const [key,[min,max]] of Object.entries(WINGED_DOMAINS))for(const value of key==='grip'?[0,1,2]:[min,max]){
        await preset(page,0);const input=page.locator(`[data-control="${key}"]`);
        if(key==='worm'||key==='grip')await input.selectOption(String(value));else{await input.fill(String(value));await input.dispatchEvent('input');}
        const values={...WINGED_DEFAULTS,[key]:value},plan=wingedCorkscrewPlan(values);await page.getByRole('button',{name:stages[0],exact:true}).click();compare(await readings(page),values,plan.screwTime);
        await page.getByRole('button',{name:stages[2],exact:true}).click();compare(await readings(page),values,plan.duration);
      }
      await page.getByRole('button',{name:'Reset experiment',exact:true}).click();compare(await readings(page),WINGED_DEFAULTS,0);assert.equal(await page.locator('[data-control="worm"]').inputValue(),'0');
      await page.locator('[data-control="turns"]').focus();await page.keyboard.press('ArrowLeft');assert.equal(await page.locator('[data-control="turns"]').inputValue(),'5.5');
    }
  }
  if(playback)for(const i of [0,2,5]){
    await preset(page,i);await page.locator('[data-step]').click();compare(await readings(page),lesson.tryIt[i].values,.1);
    await page.locator('[data-play]').click();await page.waitForFunction(()=>parseFloat([...document.querySelectorAll('.daily-readings>div')].find(n=>n.querySelector('dt').textContent==='Trial time').querySelector('dd').textContent)>.3);await page.locator('[data-play]').click();const held=await readings(page);await page.waitForTimeout(250);assert.deepEqual(await readings(page),held);
    await page.locator('[data-play]').click();await page.waitForFunction(()=>document.querySelector('[data-play]').getAttribute('aria-pressed')==='false',null,{timeout:30000});const ended=await readings(page);assert.equal(parseFloat(ended['Cork out']),lifts[i]);assert.equal(parseFloat(ended['Work lifting the cork']),works[i]);assert.equal(await page.locator('[data-result]').isDisabled(),false);
    if(i===5){assert.equal(ended['Worm depth'],'0.0 mm');assert.equal(ended['Wing angle'],'0 degrees');assert.equal(ended['Lift on the rack'],'0 N');}
    await page.locator('[data-result]').click();await page.locator('[data-play]').click();await page.waitForFunction(()=>parseFloat([...document.querySelectorAll('.daily-readings>div')].find(n=>n.querySelector('dt').textContent==='Trial time').querySelector('dd').textContent)<1);await page.locator('[data-play]').click();
    for(const [key,value] of Object.entries(lesson.tryIt[i].values))assert.equal(await page.locator(`[data-control="${key}"]`).inputValue(),String(value));
    await page.locator('[data-play]').click();await page.getByRole('button',{name:'See the rack and pinions',exact:true}).click();assert.equal(await page.locator('[data-play]').getAttribute('aria-pressed'),'false');playbackCases.push({trial:i,pause:true,step:true,completion:ended,replay:true,inspectionStops:true});
  }
  const result={passed:true,observations,playbackCases};await writeFile(`${dir}/${prefix}-corkscrew-browser.json`,JSON.stringify(result,null,2)+'\n');return result;
}
if(typeof process!=='undefined'&&process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
  const {chromium}=await import('playwright'),browser=await chromium.launch({headless:true});
  try{const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));page.setDefaultTimeout(20000);page.setDefaultNavigationTimeout(45000);
    const r=await checkWingedCorkscrew(page,{base:process.env.SITE_URL||'http://localhost:5194/',dir:process.env.EVIDENCE_DIR||'/tmp/howthingswork-winged-corkscrew',prefix:process.env.EVIDENCE_PREFIX||'local'});assert.deepEqual(errors,[]);console.log(JSON.stringify({passed:true,presetStageChecks:r.observations.length*4,playbackCases:r.playbackCases.length,errors}));
  }finally{await browser.close();}
}

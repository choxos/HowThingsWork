import assert from 'node:assert/strict';
import {mkdir, writeFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import {saladSpinnerLesson as lesson} from './salad-spinner-lesson.js';
import {sampleSpinner, spinnerPlan, SPINNER_DEFAULTS, SPINNER_DOMAINS} from './salad-spinner-physics.js';
import {fixed} from './format.js';

const stages=['Inspect: spinning up','Inspect: top speed','Inspect: crank let go','Inspect: at rest','Inspect: 20 seconds'];
const closeups=[['See the gear train','Epicyclic gear train'],['See the one-way clutch','One-way roller clutch'],['See the basket brake','Spring-loaded basket brake'],['Read the drying chart','Water left against basket speed'],['Whole spinner','Salad spinner']];
// Independently checked lesson anchors. Full numerical/reference checks live in check-salad-spinner-model.mjs.
const water=[3.4,1.5,6.4,13.1,10.7,12.9,9,6.8,3.4,1.5,3.4];
const peak=[600,886,450,240,300,243,353,600,600,1080,600];
const readings=page=>page.locator('.daily-readings>div').evaluateAll(ns=>Object.fromEntries(ns.map(n=>[n.querySelector('dt').textContent,n.querySelector('dd').textContent])));
async function preset(page,i){await page.getByRole('tab',{name:'Try it yourself',exact:true}).click();await page.locator(`[data-experiment="${i}"]`).click();await page.getByRole('tab',{name:'Controls',exact:true}).click();}
function compare(r,values,time){
  const s=sampleSpinner(values,time),expected={
    'Trial time':`${fixed(s.elapsed,2)} s`,
    'Clutch':s.elapsed>=values.crank?'Freewheeling':s.elapsed>0?'Driving basket':'Ready to drive',
    'Brake':values.brake&&s.elapsed>=values.crank?'Pad pressed against basket':'Pad clear of basket',
    'Basket speed':`${fixed(s.rpm,0)} rpm`,
    'Water left on the salad':`${fixed(s.waterLeft*1000,1)} g of ${fixed(s.water*1000,0)} g`,
    'Smallest drop radius thrown off':s.fastest>0?`${fixed(s.wallDrop*1000,2)} mm at the wall`:'none yet',
    'Pull needed at the wall':`${fixed(s.wallAcceleration/9.81,0)} g`,
    'Gear ratio':`${s.G} to 1, reversed`,
    'Crank':`${fixed(s.crankRate,2)} turns a second`,
    'Hand force on the knob':`${fixed(s.handForce,1)} N`,
    'Planet gears':`${fixed(s.planetRate,2)} turns a second on their pins`,
    'Energy in the spinning basket':`${fixed(s.kinetic,2)} J`,
    'Work by your hand':`${fixed(s.handWork,2)} J`,
  };
  assert.equal(Object.keys(r).length,14);
  for(const [key,value] of Object.entries(expected))assert.equal(r[key],value,key);
  assert.match(r['Your result'],s.mode==='ready'?/^Ready/:s.mode==='stopped'?/^Stopped/:s.mode==='holding'?/^Holding/:s.mode==='spinning up'?/^Spinning up/:s.mode==='braking'?/braking/:/coasting/);
}

// A passed page lets native QA reuse the single visible browser tab.
export async function checkSaladSpinner(page,{base,dir,prefix='local',widths=[1440,390],trials=lesson.tryIt.map((_,i)=>i),playback=true,boundaries=true}){
  await mkdir(dir,{recursive:true});const observations=[],playbackCases=[];
  const shot=async name=>{await page.mouse.move(0,0);await page.locator('canvas').scrollIntoViewIfNeeded();await page.waitForTimeout(150);return page.locator('canvas').screenshot({path:`${dir}/${prefix}-${name}.png`});};
  for(const width of widths){
    await page.setViewportSize({width,height:width===390?844:1000});await page.goto('about:blank');await page.goto(base+'#machine/salad-spinner');await page.locator('[data-control="sun"]').waitFor();await page.evaluate(()=>document.fonts.ready);
    assert.equal(await page.locator('h1').innerText(),'Salad spinner');assert.equal(await page.locator('[data-control]').count(),6);assert.equal(await page.locator('[data-action]').count(),10);assert.equal(await page.locator('[data-experiment]').count(),11);
    const primary=await page.locator('.daily-primary-controls select').evaluate(e=>{const b=e.getBoundingClientRect();return {visible:scrollY===0&&b.top>=0&&b.bottom<=innerHeight&&b.height>=44,unobscured:document.elementFromPoint(b.x+b.width/2,b.y+b.height/2)===e};});
    assert.equal(primary.visible,true);assert.equal(primary.unobscured,true);await page.screenshot({path:`${dir}/${prefix}-opening-${width}.png`});
    for(const i of trials){
      const values=lesson.tryIt[i].values;await preset(page,i);compare(await readings(page),values,0);assert.equal(await page.locator('[data-result]').isDisabled(),true);
      for(const [key,value] of Object.entries(values)){assert.equal(Number(await page.locator(`[data-control="${key}"]`).inputValue()),value);assert.equal(await page.locator(`[data-control="${key}"]`).isEnabled(),true);}
      const plan=spinnerPlan(values),times=[.8,values.crank-.05,values.crank+.5,plan.stoppedAt,20],states=[];
      for(let j=0;j<stages.length;j++){
        await page.getByRole('button',{name:stages[j],exact:true}).click();const r=await readings(page);compare(r,values,times[j]);states.push(r);
        assert.equal(await page.locator('[data-result]').isDisabled(),times[j]<plan.stoppedAt);assert.ok(await page.locator('.daily-readings>div').evaluateAll(ns=>ns.every(n=>n.querySelector('p')?.textContent.length>15)));
        if(j===1||j===3)await shot(`trial-${width}-${i}-${j}`);
      }
      assert.equal(Number((plan.topSpeed*60/(2*Math.PI)).toFixed(0)),peak[i]);assert.equal(parseFloat(states[3]['Water left on the salad']),water[i]);
      assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));observations.push({width,trial:i,title:lesson.tryIt[i].title,states});
    }
    for(const stage of [1,2]){
      await preset(page,0);await page.getByRole('button',{name:stages[stage],exact:true}).click();const held=await readings(page);
      for(const [label,name] of closeups){await page.getByRole('button',{name:label,exact:true}).click();assert.equal(await page.locator('.daily-part-detail h3').innerText(),name);assert.deepEqual(await readings(page),held);await shot(`close-${width}-${stage}-${name.replaceAll(' ','-')}`);}
    }
    await page.getByRole('button',{name:stages[3],exact:true}).click();await page.locator('[data-result]').click();assert.equal(await page.locator('.daily-part-detail h3').innerText(),'Water thrown off');await shot(`result-${width}`);
    await preset(page,0);const held=await readings(page);await page.locator('[data-separation]').fill('100');await page.locator('[data-separation]').dispatchEvent('input');await page.waitForTimeout(800);await shot(`separated-${width}`);assert.deepEqual(await readings(page),held);
    for(const view of ['in','out']){await page.locator(`[data-view="${view}"]`).click();assert.equal(await page.locator('[data-separation]').inputValue(),'100');}
    await page.locator('[data-reassemble]').click();await page.waitForTimeout(800);assert.equal(await page.locator('[data-separation]').inputValue(),'0');assert.deepEqual(await readings(page),held);
    if(boundaries){
      for(const [key,[min,max]] of Object.entries(SPINNER_DOMAINS))for(const value of key==='sun'?[12,18,24]:[min,max]){
        await preset(page,0);const input=page.locator(`[data-control="${key}"]`);
        if(key==='sun'||key==='brake')await input.selectOption(String(value));else{await input.fill(String(value));await input.dispatchEvent('input');}
        const values={...SPINNER_DEFAULTS,[key]:value};await page.getByRole('button',{name:stages[1],exact:true}).click();compare(await readings(page),values,values.crank-.05);
        await page.getByRole('button',{name:stages[3],exact:true}).click();compare(await readings(page),values,spinnerPlan(values).stoppedAt);
      }
      await page.getByRole('button',{name:'Reset experiment',exact:true}).click();compare(await readings(page),SPINNER_DEFAULTS,0);assert.equal(await page.locator('[data-control="sun"]').inputValue(),'18');
      await page.locator('[data-control="rate"]').focus();await page.keyboard.press('ArrowLeft');assert.equal(await page.locator('[data-control="rate"]').inputValue(),'2.25');
    }
  }
  if(playback)for(const i of [0,8]){
    await preset(page,i);await page.locator('[data-step]').click();compare(await readings(page),lesson.tryIt[i].values,.05);
    await page.locator('[data-play]').click();await page.waitForFunction(()=>parseFloat([...document.querySelectorAll('.daily-readings>div')].find(n=>n.querySelector('dt').textContent==='Trial time').querySelector('dd').textContent)>.3);await page.locator('[data-play]').click();const held=await readings(page);await page.waitForTimeout(300);assert.deepEqual(await readings(page),held);
    await page.getByRole('button',{name:stages[i===8?4:2],exact:true}).click();if(i===8)assert.match((await readings(page))['Basket speed'],/^265 rpm$/);
    await page.locator('[data-play]').click();await page.waitForFunction(()=>document.querySelector('[data-play]').getAttribute('aria-pressed')==='false',null,{timeout:45000});const ended=await readings(page);assert.equal(ended['Basket speed'],'0 rpm');assert.match(ended['Your result'],/^Stopped/);assert.equal(parseFloat(ended['Water left on the salad']),water[i]);assert.equal(await page.locator('[data-result]').isDisabled(),false);
    await page.locator('[data-result]').click();await page.locator('[data-play]').click();await page.waitForFunction(()=>parseFloat([...document.querySelectorAll('.daily-readings>div')].find(n=>n.querySelector('dt').textContent==='Trial time').querySelector('dd').textContent)<1);await page.locator('[data-play]').click();assert.equal(await page.locator('[data-control="brake"]').inputValue(),String(lesson.tryIt[i].values.brake));
    await page.locator('[data-play]').click();await page.getByRole('button',{name:'See the one-way clutch',exact:true}).click();assert.equal(await page.locator('[data-play]').getAttribute('aria-pressed'),'false');playbackCases.push({trial:i,pause:true,step:true,completion:ended,replay:true,inspectionStops:true});
  }
  const result={passed:true,observations,playbackCases};await writeFile(`${dir}/${prefix}-spinner-browser.json`,JSON.stringify(result,null,2)+'\n');return result;
}
if(typeof process!=='undefined'&&process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
  const {chromium}=await import('playwright'),browser=await chromium.launch({headless:true});
  try{const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));page.setDefaultTimeout(20000);page.setDefaultNavigationTimeout(45000);
    const r=await checkSaladSpinner(page,{base:process.env.SITE_URL||'http://127.0.0.1:5193/',dir:process.env.EVIDENCE_DIR||'/tmp/howthingswork-salad-spinner',prefix:process.env.EVIDENCE_PREFIX||'local'});assert.deepEqual(errors,[]);console.log(JSON.stringify({passed:true,presetStageChecks:r.observations.length*5,playbackCases:r.playbackCases.length,errors}));
  }finally{await browser.close();}
}

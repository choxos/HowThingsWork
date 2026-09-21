import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
import {chromium} from 'playwright';
import {electronicIgnitionLesson as lesson} from './electronic-ignition-lesson.js';

const browser=await chromium.launch({headless:true}),page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];
const evidence=new URL(process.env.ELECTRONIC_IGNITION_EVIDENCE||'../../documentation/audit/evidence/electronic-ignition/',import.meta.url);await mkdir(evidence,{recursive:true});page.on('pageerror',e=>errors.push(e.message));
const reading=label=>page.locator('.daily-readings > div').filter({has:page.getByText(label,{exact:true})}).locator('dd').textContent();
const numeric=text=>parseFloat(text)*(/ kV$/.test(text)?1000:/ mA$/.test(text)?.001:1);
// Bound displayed rounding only. Model assertions retain strict numerical tolerances.
const rounding=n=>n===0?0:.5*10**(Math.floor(Math.log10(Math.abs(n)))-2);
const shown=(actual,expected)=>near(actual,expected,rounding(actual)+1e-12);
const value=async label=>numeric(await reading(label)),control=key=>page.locator(`[data-control="${key}"]`),number=key=>page.locator(`[data-number="${key}"]`);
const near=(a,b,tolerance=.0001)=>assert.ok(Math.abs(a-b)<=tolerance,`${a} differs from ${b}`),play=()=>page.locator('[data-play]').click();
const finished=()=>page.waitForFunction(()=>document.querySelector('[data-play]')?.getAttribute('aria-pressed')==='false',null,{timeout:90000});
const progressed=minimum=>page.waitForFunction(min=>{const row=Array.from(document.querySelectorAll('.daily-readings > div')).find(e=>e.querySelector('dt')?.textContent==='Observation progress');return parseFloat(row?.querySelector('dd')?.textContent)>min;},minimum);
const nextFrames=()=>page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(()=>requestAnimationFrame(()=>resolve())))));
const shot=name=>page.screenshot({path:new URL(name+'.png',evidence).pathname,fullPage:true}),stages=[['charging',45],['interruption',63],['reverse-current',72],['later',90]];
const inspect=i=>page.getByRole('button',{name:`Inspect ${stages[i][0]} stage (${stages[i][1]}°)`,exact:true}).click();
async function preset(i){
 await page.getByRole('tab',{name:'Try it yourself',exact:true}).click();await page.getByRole('button',{name:'Set up this experiment',exact:true}).nth(i).click();await page.getByRole('tab',{name:'Controls',exact:true}).click();
 for(const [key,n] of Object.entries(lesson.tryIt[i].values))assert.equal(Number(await control(key).inputValue()),n);
 near(await value('Observation progress'),0);near(await value('Delivered spark energy'),0);near(await value('Spark events'),0);
}
async function circuit(){
 const budget={};for(const label of ['Ignition battery work','Stored magnetic energy','Stored capacitor energy','Winding heat','Switch heat','Delivered spark energy'])budget[label]=await value(label);
 near(budget['Ignition battery work'],budget['Stored magnetic energy']+budget['Stored capacitor energy']+budget['Winding heat']+budget['Switch heat']+budget['Delivered spark energy'],Object.values(budget).reduce((sum,n)=>sum+rounding(n),0)+1e-12);
 const plugs=await Promise.all(['A','B','C','D'].map(id=>value(`Plug ${id} energy`)));near(plugs.reduce((a,b)=>a+b,0),budget['Delivered spark energy'],plugs.reduce((sum,n)=>sum+rounding(n),0)+rounding(budget['Delivered spark energy'])+1e-12);
 const primary=await value('Primary current'),switchCurrent=await value('Switch current'),capacitorCurrent=await value('Parallel capacitor current');near(primary,switchCurrent+capacitorCurrent,rounding(primary)+rounding(switchCurrent)+rounding(capacitorCurrent)+1e-12);assert.ok(plugs.every(x=>x>=0));return {budget,plugs,current:await value('Primary current'),switchState:await reading('Switch state'),events:await value('Spark events'),openings:await value('Switch-off events')};
}
try{
 await page.goto(`${process.env.SITE_URL||'http://127.0.0.1:4177/'}#machine/electronic-ignition`);await page.getByRole('heading',{name:'Electronic ignition',exact:true}).waitFor();await page.locator('.daily-readings').waitFor();
 assert.equal(await page.locator('[data-control]').count(),3);await shot('initial');await page.getByRole('checkbox',{name:'Look inside',exact:true}).uncheck();await shot('exterior');await page.getByRole('checkbox',{name:'Look inside',exact:true}).check();
 const outcomes=[],normalStages=[];
 for(let i=0;i<lesson.tryIt.length;i++){
  await preset(i);
  if(i===0){await page.locator('[data-step]').click();const stepped=await value('Observation progress');assert.ok(stepped>0);await play();await progressed(stepped);await play();const held=await page.locator('.daily-readings').textContent();await nextFrames();assert.equal(await page.locator('.daily-readings').textContent(),held);}
  for(let j=0;j<stages.length;j++){
   await inspect(j);for(const [key,n] of Object.entries(lesson.tryIt[i].values))assert.equal(Number(await control(key).inputValue()),n);
   near(await value('Observation progress'),100*stages[j][1]/360,.06);const result=await circuit();if(i===0)normalStages.push(result);if(i===1||i===2||i===5)near(result.budget['Delivered spark energy'],0);await shot(`stage-${i}-${j}`);
  }
  await play();await finished();near(await value('Observation progress'),100);outcomes.push(await circuit());await shot('experiment-'+i);console.log(`PASS experiment ${i+1}: ${lesson.tryIt[i].title}`);
 }
 assert.match(normalStages[0].switchState,/on/i);assert.ok(normalStages[0].current>0&&normalStages[0].budget['Stored magnetic energy']>0);assert.match(normalStages[1].switchState,/off/i);assert.ok(normalStages[1].budget['Delivered spark energy']>0);near(normalStages[0].openings,0);near(normalStages[1].openings,1);assert.ok(normalStages[2].current<0,'reverse stage shows signed primary current');
 for(const [i,total] of [319.859765538,0,0,67.901288396,139.749688175,0].entries()){shown(outcomes[i].budget['Delivered spark energy'],total);near(outcomes[i].openings,[4,0,0,4,4,4][i]);}
 assert.ok(outcomes[0].plugs.every(x=>x>0));shown(outcomes[1].current,3.428542607);assert.ok(outcomes[1].budget['Stored magnetic energy']>170);assert.ok(outcomes[2].budget['Ignition battery work']>0);near(outcomes[5].budget['Ignition battery work'],0);
 await preset(0);await inspect(3);await play();await finished();await page.locator('[data-result]').click();await shot('result');await play();
 const replay=await page.waitForFunction(()=>{const read=label=>parseFloat(Array.from(document.querySelectorAll('.daily-readings > div')).find(e=>e.querySelector('dt')?.textContent===label)?.querySelector('dd')?.textContent),progress=read('Observation progress');return progress>0&&progress<100?{progress,energy:read('Delivered spark energy'),events:read('Spark events')}:false;});const fresh=await replay.jsonValue();near(fresh.energy,0);near(fresh.events,0);await play();const held=await page.locator('.daily-readings').textContent();await nextFrames();assert.equal(await page.locator('.daily-readings').textContent(),held);
 for(const [key,next] of [['voltage','9'],['rpm','120'],['mode','2']]){await inspect(1);if(key==='mode')await control(key).selectOption(next);else await number(key).fill(next);near(await value('Observation progress'),0);near(await value('Delivered spark energy'),0);near(await value('Spark events'),0);}
 await page.getByRole('button',{name:'Reset experiment',exact:true}).click();for(const [key,n] of Object.entries(lesson.tryIt[0].values))assert.equal(Number(await control(key).inputValue()),n);
 await number('voltage').focus();await page.keyboard.press('ArrowDown');assert.equal(Number(await number('voltage').inputValue()),9);await page.getByRole('button',{name:lesson.quiz.options[0],exact:true}).click();await page.getByText(/That’s right/).waitFor();
 await page.setViewportSize({width:390,height:844});await preset(0);await page.evaluate(()=>window.scrollTo(0,0));assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));await shot('mobile');await inspect(1);await shot('mobile-interruption');assert.deepEqual(errors,[]);
 console.log(JSON.stringify({passed:true,normalStages,outcomes,checks:'six presets;four stages;all controls;electronic command and actual power switching;passive budgets;per-plug delivery;exterior/cutaway;pause/step/reset/edit/replay/result/keyboard/quiz/mobile'},null,2));
}finally{await browser.close();}

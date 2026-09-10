import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
import {chromium} from 'playwright';
import {ignitionCoilWindingsLesson as lesson} from './ignition-coil-windings-lesson.js';

const browser=await chromium.launch({headless:true}),page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];
const evidence=new URL('../../documentation/audit/evidence/ignition-coil-windings/',import.meta.url);await mkdir(evidence,{recursive:true});page.on('pageerror',e=>errors.push(e.message));
const reading=label=>page.locator('.daily-readings > div').filter({has:page.getByText(label,{exact:true})}).locator('dd').textContent();
const value=async label=>parseFloat(await reading(label)),control=key=>page.locator(`[data-control="${key}"]`),number=key=>page.locator(`[data-number="${key}"]`);
const near=(a,b,tolerance=.00001)=>assert.ok(Math.abs(a-b)<=tolerance,`${a} differs from ${b}`),play=()=>page.locator('[data-play]').click();
const finished=()=>page.waitForFunction(()=>document.querySelector('[data-play]')?.getAttribute('aria-pressed')==='false',null,{timeout:90000});
const shot=name=>page.screenshot({path:new URL(name+'.png',evidence).pathname,fullPage:true}),stages=[['charging',45],['opening',63],['later',90]];
const inspect=i=>page.getByRole('button',{name:`Inspect ${stages[i][0]} stage (${stages[i][1]}°)`,exact:true}).click();
async function preset(i){
 await page.getByRole('tab',{name:'Try it yourself',exact:true}).click();await page.getByRole('button',{name:'Set up this experiment',exact:true}).nth(i).click();await page.getByRole('tab',{name:'Controls',exact:true}).click();
 for(const [key,n] of Object.entries(lesson.tryIt[i].values))assert.equal(Number(await control(key).inputValue()),n);
 near(await value('Observation progress'),0);near(await value('Ignition battery work'),0);assert.equal(await reading('Saved sample time'),'No saved sample yet');
}
async function equations(){
 const p=await value('Primary common-flux EMF'),s=await value('Secondary common-flux EMF');near(p,-3*await value('Flux change rate'),.000001);near(s,10*p,.000006);
 near(await value('Primary EMF per turn'),await value('Secondary EMF per turn'),.000000002);near(await value('Primary EMF per turn'),p/3,.00000018);
 near(await value('Primary terminal drop'),3*await value('Primary current')-await value('Primary total induced EMF'),.000003);
 near(await value('Secondary terminal voltage'),await value('Secondary total induced EMF')-300*await value('Secondary current'),.00016);
 const savedP=await value('Primary common-flux EMF at saved sample'),savedS=await value('Secondary common-flux EMF at saved sample');near(savedS,10*savedP,.000006);
 near(await value('Primary EMF per turn at saved sample'),await value('Secondary EMF per turn at saved sample'),.000000002);near(await value('Primary EMF per turn at saved sample'),savedP/3,.00000018);
 const e={};for(const label of ['Ignition battery work','Stored magnetic energy','Stored capacitor energy','Winding heat','Points heat','Delivered spark energy'])e[label]=await value(label);
 near(e['Ignition battery work'],e['Stored magnetic energy']+e['Stored capacitor energy']+e['Winding heat']+e['Points heat']+e['Delivered spark energy'],.000004);return e;
}
try{
 await page.goto(`${process.env.SITE_URL||'http://127.0.0.1:4177/'}#machine/ignition-coil-primary-and-secondary-windings`);await page.getByRole('heading',{name:'Ignition-coil primary and secondary windings',exact:true}).waitFor();await page.locator('.daily-readings').waitFor();
 assert.equal(await page.locator('[data-control]').count(),3);assert.equal(await page.locator('[data-number]').count(),2);near(await value('Primary turns'),3);near(await value('Secondary turns'),30);near(await value('Configured turns ratio'),10);await shot('initial');
 const outcomes=[],normalStages=[];
 for(let i=0;i<lesson.tryIt.length;i++){
  await preset(i);
  if(i===0){await page.locator('[data-step]').click();assert.ok(await value('Observation progress')>0);await play();await page.waitForTimeout(150);await play();const held=await page.locator('.daily-readings').textContent();await page.waitForTimeout(200);assert.equal(await page.locator('.daily-readings').textContent(),held);}
  for(let j=0;j<stages.length;j++){
   await inspect(j);near(await value('Shaft angle'),stages[j][1],.001);assert.equal(await page.locator('.daily-part-detail h3').textContent(),'Primary and secondary winding assembly');
   for(const [key,n] of Object.entries(lesson.tryIt[i].values))assert.equal(Number(await control(key).inputValue()),n);await equations();
   if(i===0)normalStages.push({p:await value('Primary common-flux EMF'),s:await value('Secondary common-flux EMF'),pTerminal:await value('Primary terminal drop'),sTerminal:await value('Secondary terminal voltage')});
   if(i===5){assert.match(await reading('Common-flux EMF ratio'),/^Not shown/);assert.match(await reading('Common-flux EMF ratio at saved sample'),/^Not shown/);near(await value('Primary EMF per turn'),0);near(await value('Secondary EMF per turn'),0);}else near(await value('Common-flux EMF ratio at saved sample'),10);
   near(await value('Configured turns ratio'),10);await shot(`stage-${i}-${j}`);
  }
  await play();await finished();near(await value('Observation progress'),100);const budget=await equations();
  outcomes.push({p:await value('Primary common-flux EMF'),s:await value('Secondary common-flux EMF'),ratio:await reading('Common-flux EMF ratio'),savedP:await value('Primary common-flux EMF at saved sample'),savedS:await value('Secondary common-flux EMF at saved sample'),savedRatio:await reading('Common-flux EMF ratio at saved sample'),savedTime:await value('Saved sample time'),budget});await shot('experiment-'+i);console.log(`PASS experiment ${i+1}: ${lesson.tryIt[i].title}`);
 }
 near(normalStages[0].p,-2.654121,.000001);near(normalStages[0].s,-26.541209,.000001);near(normalStages[1].p,66.443982,.000001);near(normalStages[1].s,664.439821,.000001);near(normalStages[1].pTerminal,-67.796644,.000002);near(normalStages[1].sTerminal,630.085984,.000001);assert.ok(Math.abs(normalStages[1].sTerminal-10*normalStages[1].pTerminal)>1000);
 near(outcomes[0].savedP,75.6111177,.000001);near(outcomes[0].savedS,756.111177,.000001);near(outcomes[0].savedTime,17.898,.000001);assert.match(outcomes[1].ratio,/^Not shown/);assert.match(outcomes[1].savedRatio,/^10/);assert.ok(Math.abs(outcomes[1].p)<.001);assert.ok(outcomes[1].budget['Stored magnetic energy']>170);assert.match(outcomes[5].ratio,/^Not shown/);assert.match(outcomes[5].savedRatio,/^Not shown/);near(outcomes[5].budget['Delivered spark energy'],0);
 await preset(0);await inspect(2);await play();await finished();await page.locator('[data-result]').click();await shot('result');await play();await page.waitForTimeout(150);await play();assert.ok(await value('Observation progress')<12);near(await value('Delivered spark energy'),0);assert.ok(await value('Saved sample time')<16);
 for(const [key,next] of [['voltage','9'],['rpm','120']]){await inspect(1);await number(key).fill(next);near(await value('Observation progress'),0);assert.equal(await reading('Saved sample time'),'No saved sample yet');}
 await inspect(1);await control('points').selectOption('2');near(await value('Observation progress'),0);assert.equal(await reading('Saved sample time'),'No saved sample yet');
 await page.getByRole('button',{name:'Reset experiment',exact:true}).click();for(const [key,n] of Object.entries(lesson.tryIt[0].values))assert.equal(Number(await control(key).inputValue()),n);
 await number('voltage').focus();await page.keyboard.press('ArrowDown');assert.equal(Number(await number('voltage').inputValue()),9);await page.getByRole('button',{name:lesson.quiz.options[0],exact:true}).click();await page.getByText(/That’s right/).waitFor();
 await page.setViewportSize({width:390,height:844});await preset(0);await page.evaluate(()=>window.scrollTo(0,0));assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));await shot('mobile');await inspect(1);await shot('mobile-stage');assert.deepEqual(errors,[]);
 console.log(JSON.stringify({passed:true,normalStages,outcomes,checks:'six complete presets;three controls/stages;paired common-flux/per-turn law;actual terminal KVL and passive budget;saved same-instant comparison;near-zero ratio masking;pause/step/edit/reset/replay/result/keyboard/quiz/mobile'},null,2));
}finally{await browser.close();}

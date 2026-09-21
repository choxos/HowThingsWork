import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {chromium} from 'playwright';
import {sparkPlugElectrodesLesson as lesson} from './spark-plug-electrodes-lesson.js';

const browser=await chromium.launch({headless:true}),page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];
page.setDefaultTimeout(10000);
const evidence=new URL(process.env.SPARK_PLUG_ELECTRODES_EVIDENCE||'../../documentation/audit/evidence/spark-plug-electrodes/',import.meta.url);await mkdir(evidence,{recursive:true});page.on('pageerror',e=>errors.push(e.message));
const reading=label=>page.locator('.daily-readings > div').filter({has:page.getByText(label,{exact:true})}).locator('dd').textContent();
const numeric=text=>parseFloat(text)*(/ kV$/.test(text)?1000:/ mA$/.test(text)?.001:1);
// Bound display rounding only; the model keeps strict continuous-reference checks.
const rounding=n=>n===0?0:.5*10**(Math.floor(Math.log10(Math.abs(n)))-2);
const shown=(actual,expected)=>near(actual,expected,rounding(actual)+1e-12);
const value=async label=>numeric(await reading(label)),control=key=>page.locator(`[data-control="${key}"]`),number=key=>page.locator(`[data-number="${key}"]`);
const near=(actual,expected,tolerance=.00003)=>assert.ok(Math.abs(actual-expected)<=tolerance,`${actual} differs from ${expected}`);
const frames=()=>page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))));
const shot=name=>page.screenshot({path:new URL(name+'.png',evidence).pathname,fullPage:true});
const angles=[60,63,72,90,360],names=['selected','early-pulse','later-pulse','disconnected','final result'];
const inspect=i=>page.getByRole('button',{name:i===4?'Inspect final result (360°)':`Inspect ${names[i]} stage (${angles[i]}°)`,exact:true}).click();
const resistances=[Infinity,100000,10000,1000,100];
// Independent continuous-equation reference rounded to the displayed millijoule precision.
const expected=[[86.354272,0,2],[81.3075,8.27506,2],[49.0651,53.5235,1],[6.47188,81.7563,1],[0,19.5641,0],[19.875966,0,2],[11.776,13.756,1],[0,22.636,0],[0,0,0],[0,0,0]];
async function fresh(){near(await value('Observation progress'),0);near(await value('A gap energy'),0);near(await value('A bypass energy'),0);near(await value('A gap episodes'),0);}
async function preset(i){await page.getByRole('tab',{name:'Try it yourself',exact:true}).click();await page.getByRole('button',{name:'Set up this experiment',exact:true}).nth(i).click();await page.getByRole('tab',{name:'Controls',exact:true}).click();for(const [key,n] of Object.entries(lesson.tryIt[i].values))assert.equal(Number(await control(key).inputValue()),n);await fresh();}
async function circuit(v){
 const gapCurrent=await value('A gap current'),bypassCurrent=await value('A bypass current'),leadCurrent=await value('A lead current'),gapPower=await value('A gap power'),bypassPower=await value('A bypass power'),terminal=await reading('A terminal voltage'),voltage=numeric(terminal);
 near(leadCurrent,gapCurrent+bypassCurrent,rounding(leadCurrent)+rounding(gapCurrent)+rounding(bypassCurrent)+1e-12);assert.ok(gapPower>=0&&bypassPower>=0);
 if(Number.isFinite(voltage)){for(const [power,current] of [[gapPower,gapCurrent],[bypassPower,bypassCurrent]])near(power,voltage*current,rounding(power)+Math.abs(voltage)*rounding(current)+Math.abs(current)*rounding(voltage)+rounding(voltage)*rounding(current)+1e-12);near(bypassCurrent,voltage/resistances[v.bypass],rounding(bypassCurrent)+rounding(voltage)/resistances[v.bypass]+1e-12);if(Math.abs(gapCurrent)>1e-7)near(voltage,10000*gapCurrent,rounding(voltage)+10000*rounding(gapCurrent)+1e-12);}
 else{assert.match(terminal,/Disconnected from source.*local voltage not tracked/i);near(gapCurrent,0);near(bypassCurrent,0);near(leadCurrent,0);near(gapPower,0);near(bypassPower,0);}
 const gapEnergy=await value('A gap energy'),bypassEnergy=await value('A bypass energy'),episodes=await value('A gap episodes'),otherEnergy=await value('Other plugs delivered energy');
 assert.ok(gapEnergy>=0&&bypassEnergy>=0);const delivered=await value('Delivered spark energy');near(gapEnergy+otherEnergy,delivered,rounding(gapEnergy)+rounding(otherEnergy)+rounding(delivered)+1e-12);
 if(v.bypass===0){near(bypassCurrent,0);near(bypassPower,0);near(bypassEnergy,0);}
 const budget={};for(const label of ['Ignition battery work','Stored magnetic energy','Stored capacitor energy','Winding heat','Points heat','Delivered spark energy'])budget[label]=await value(label);
 near(budget['Ignition battery work'],budget['Stored magnetic energy']+budget['Stored capacitor energy']+budget['Winding heat']+budget['Points heat']+budget['Delivered spark energy']+bypassEnergy,Object.values(budget).reduce((sum,n)=>sum+rounding(n),rounding(bypassEnergy))+1e-12);
 return {terminal,gapCurrent,bypassCurrent,leadCurrent,gapPower,bypassPower,gapEnergy,bypassEnergy,episodes,otherEnergy,budget};
}
try{
 await page.goto(`${process.env.SITE_URL||'http://127.0.0.1:4177/'}#machine/spark-plug-electrodes-and-ceramic-insulator`);await page.getByRole('heading',{name:'Spark-plug electrodes and ceramic insulator',exact:true}).waitFor();assert.equal(await page.locator('[data-control]').count(),2);assert.equal(await page.locator('[data-number]').count(),1);await shot('initial');assert.equal(lesson.tryIt.length,10);
 const trials=[];
 for(let i=0;i<10;i++){
  await preset(i);const rows=[];
  for(let j=0;j<5;j++){await inspect(j);near(await value('Observation progress'),angles[j]/3.6,.06);for(const [key,n] of Object.entries(lesson.tryIt[i].values))assert.equal(Number(await control(key).inputValue()),n);rows.push(await circuit(lesson.tryIt[i].values));if(i===2||i===4)await shot(`stage-${i}-${j}`);}
  const end=rows.at(-1);shown(end.gapEnergy,expected[i][0]);shown(end.bypassEnergy,expected[i][1]);assert.equal(end.episodes,expected[i][2]);trials.push(rows);await shot('experiment-'+i);console.log(`PASS experiment ${i+1}: ${lesson.tryIt[i].title}`);
 }
 assert.ok(trials[0][2].gapCurrent<0&&trials[0][2].gapPower>0);assert.ok(trials[2][1].gapCurrent>0);near(trials[2][1].gapCurrent,trials[2][1].bypassCurrent);assert.ok(trials[4].slice(0,3).some(x=>Math.abs(x.bypassCurrent)>0));assert.ok(trials[4].every(x=>x.gapCurrent===0&&x.gapEnergy===0));assert.ok(trials[4].at(-1).otherEnergy>0);assert.ok(trials[3].at(-1).bypassEnergy>trials[4].at(-1).bypassEnergy);
 const allControls=[];for(const voltage of [0,3,6,9,12])for(let bypass=0;bypass<5;bypass++){await number('voltage').fill(String(voltage));await control('bypass').selectOption(String(bypass));await inspect(4);const result=await circuit({voltage,bypass});if(voltage===0)for(const n of [result.gapEnergy,result.bypassEnergy,result.episodes,result.budget['Ignition battery work']])near(n,0);allControls.push({voltage,bypass,...result});}
 await preset(2);await page.locator('[data-step]').click();near(await value('Observation progress'),1,.06);await page.locator('[data-play]').click();await frames();await page.locator('[data-play]').click();const held=await page.locator('.daily-readings').textContent();await frames();assert.equal(await page.locator('.daily-readings').textContent(),held);
 await preset(2);await page.locator('[data-play]').click();await page.waitForFunction(()=>document.querySelector('[data-play]')?.getAttribute('aria-pressed')==='false',null,{timeout:60000});near(await value('Observation progress'),100);const played=await circuit(lesson.tryIt[2].values);shown(played.gapEnergy,expected[2][0]);shown(played.bypassEnergy,expected[2][1]);await page.locator('[data-result]').click();await shot('result');await page.locator('[data-play]').click();await frames();await page.locator('[data-play]').click();assert.ok(await value('Observation progress')<100);near(await value('A gap energy'),0);near(await value('A bypass energy'),0);
 await inspect(4);await number('voltage').fill('9');await fresh();await inspect(4);await control('bypass').selectOption('3');await fresh();await page.getByRole('button',{name:'Reset experiment',exact:true}).click();for(const [key,n] of Object.entries(lesson.tryIt[0].values))assert.equal(Number(await control(key).inputValue()),n);await number('voltage').focus();await page.keyboard.press('ArrowDown');assert.equal(Number(await number('voltage').inputValue()),9);await fresh();
 await preset(2);await inspect(1);const cutawayState=await page.locator('.daily-readings').textContent();await page.getByRole('checkbox',{name:'Look inside',exact:true}).uncheck();assert.equal(await page.locator('.daily-readings').textContent(),cutawayState);await shot('exterior');await page.getByRole('checkbox',{name:'Look inside',exact:true}).check();assert.equal(await page.locator('.daily-readings').textContent(),cutawayState);await page.locator('[data-labels]').check();assert.ok(await page.locator('[data-label-part]').count()>3);await shot('labels');await page.locator('[data-labels]').uncheck();await page.getByRole('button',{name:lesson.quiz.options[lesson.quiz.answer],exact:true}).click();await page.getByText(/That’s right/).waitFor();
 await page.setViewportSize({width:390,height:844});for(const i of [0,2,4,7,9]){await preset(i);await inspect(1);await circuit(lesson.tryIt[i].values);await shot('mobile-pulse-'+i);await inspect(4);await circuit(lesson.tryIt[i].values);assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));await shot('mobile-result-'+i);}
 assert.deepEqual(errors,[]);const report={passed:true,trials,allControls,checks:'ten presets at five absolute stages; all25 control combinations; branch Ohm law/KCL/power; full passive budgets; independent final-energy references; actualplay/pause/step/reset/edit/replay/result; cutaway invariance; native selector and keyboard; labels/quiz/phone'};await writeFile(new URL('browser-results.json',evidence),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({passed:true,experiments:10,controls:25,checks:report.checks},null,2));
}finally{await browser.close();}

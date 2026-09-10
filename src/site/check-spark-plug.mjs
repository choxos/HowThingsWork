import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
import {chromium} from 'playwright';
import {sparkPlugLesson as lesson} from './spark-plug-lesson.js';

const browser=await chromium.launch({headless:true}),page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];
const evidence=new URL('../../documentation/audit/evidence/spark-plug/',import.meta.url);await mkdir(evidence,{recursive:true});page.on('pageerror',e=>errors.push(e.message));
const reading=label=>page.locator('.daily-readings > div').filter({has:page.getByText(label,{exact:true})}).locator('dd').textContent();
const value=async label=>parseFloat(await reading(label)),control=key=>page.locator(`[data-control="${key}"]`),number=key=>page.locator(`[data-number="${key}"]`);
const near=(a,b,tolerance=.00001)=>assert.ok(Math.abs(a-b)<=tolerance,`${a} differs from ${b}`),play=()=>page.locator('[data-play]').click();
const finished=()=>page.waitForFunction(()=>document.querySelector('[data-play]')?.getAttribute('aria-pressed')==='false',null,{timeout:90000});
const progressed=minimum=>page.waitForFunction(min=>{const row=Array.from(document.querySelectorAll('.daily-readings > div')).find(e=>e.querySelector('dt')?.textContent==='Observation progress');return parseFloat(row?.querySelector('dd')?.textContent)>min;},minimum);
const nextFrames=()=>page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(()=>requestAnimationFrame(()=>resolve())))));
const shot=name=>page.screenshot({path:new URL(name+'.png',evidence).pathname,fullPage:true}),stages=[['connected',60],['discharge',63],['reverse-current',72],['disconnected',90]];
const inspect=i=>page.getByRole('button',{name:`Inspect ${stages[i][0]} stage (${stages[i][1]}°)`,exact:true}).click();
async function preset(i){
 await page.getByRole('tab',{name:'Try it yourself',exact:true}).click();await page.getByRole('button',{name:'Set up this experiment',exact:true}).nth(i).click();await page.getByRole('tab',{name:'Controls',exact:true}).click();
 for(const [key,n] of Object.entries(lesson.tryIt[i].values))assert.equal(Number(await control(key).inputValue()),n);
 near(await value('Observation progress'),0);near(await value('Plug A delivered energy'),0);near(await value('Plug A spark episodes'),0);
}
async function circuit(){
 const current=await value('Plug A current'),power=await value('Plug A power'),gap=await reading('Plug A gap voltage'),gapVoltage=parseFloat(gap);
 if(Number.isFinite(gapVoltage)){near(power,gapVoltage*current,.001);if(Math.abs(current)>1e-7)near(gapVoltage,10000*current,.011);}else{assert.match(gap,/Disconnected/i);assert.match(gap,/not modeled/i);near(current,0);near(power,0);}
 assert.ok(power>=0);const energy=await value('Plug A delivered energy'),other=await value('Other plugs delivered energy');
 near(energy+other,await value('Delivered spark energy'),.00001);
 const budget={};for(const label of ['Ignition battery work','Stored magnetic energy','Stored capacitor energy','Winding heat','Points heat','Delivered spark energy'])budget[label]=await value(label);
 near(budget['Ignition battery work'],budget['Stored magnetic energy']+budget['Stored capacitor energy']+budget['Winding heat']+budget['Points heat']+budget['Delivered spark energy'],.00001);
 return {current,power,gap,energy,other,episodes:await value('Plug A spark episodes'),budget};
}
try{
 await page.goto(`${process.env.SITE_URL||'http://127.0.0.1:4177/'}#machine/spark-plug`);await page.getByRole('heading',{name:'Spark plug',exact:true}).waitFor();await page.locator('.daily-readings').waitFor();
 assert.equal(await page.locator('[data-control]').count(),3);assert.equal(await page.locator('[data-number]').count(),2);await shot('initial');
 await page.getByRole('checkbox',{name:'Look inside',exact:true}).uncheck();await shot('exterior');await page.getByRole('checkbox',{name:'Look inside',exact:true}).check();
 const outcomes=[],normalStages=[];
 for(let i=0;i<lesson.tryIt.length;i++){
  await preset(i);
  if(i===0){await page.locator('[data-step]').click();const stepped=await value('Observation progress');assert.ok(stepped>0);await play();await progressed(stepped);await play();const held=await page.locator('.daily-readings').textContent();await nextFrames();assert.equal(await page.locator('.daily-readings').textContent(),held);}
  for(let j=0;j<stages.length;j++){
   await inspect(j);for(const [key,n] of Object.entries(lesson.tryIt[i].values))assert.equal(Number(await control(key).inputValue()),n);
   near(await value('Observation progress'),100*stages[j][1]/360,.06);const result=await circuit();if(i===0)normalStages.push(result);
   if(j===3){assert.match(result.gap,/Disconnected/i);near(result.current,0);near(result.power,0);}else assert.ok(Number.isFinite(parseFloat(result.gap)),'selected gap voltage is available');
   if(i>=3){near(result.current,0);near(result.power,0);near(result.energy,0);}await shot(`stage-${i}-${j}`);
  }
  if(i===0){for(let step=0;step<17;step++)await page.locator('[data-step]').click();const otherActive=await circuit();near(await value('Observation progress'),42,.06);near(otherActive.energy,86.354237863,.00001);assert.ok(otherActive.other>0);near(otherActive.current,0);assert.match(otherActive.gap,/Disconnected/i);await shot('other-plug-conducting');}
  await play();await finished();near(await value('Observation progress'),100);outcomes.push(await circuit());await shot('experiment-'+i);console.log(`PASS experiment ${i+1}: ${lesson.tryIt[i].title}`);
 }
 near(normalStages[0].current,0);near(normalStages[0].energy,0);near(parseFloat(normalStages[0].gap),-16.33412768,.00001);
 near(normalStages[1].current,.063008598,.000001);near(normalStages[1].power,39.70083476,.00001);near(normalStages[1].energy,13.25578795,.00001);
 assert.ok(normalStages[2].current<0&&parseFloat(normalStages[2].gap)<0&&normalStages[2].power>0);near(normalStages[2].power,6.79331066,.00001);
 for(const [i,energy] of [86.354237863,19.875966481,35.780814347,0,0,0].entries()){near(outcomes[i].energy,energy,.00001);near(outcomes[i].episodes,[2,2,1,0,0,0][i]);}
 await preset(0);await inspect(3);await play();await finished();await page.locator('[data-result]').click();await shot('result');await play();
 const replay=await page.waitForFunction(()=>{const read=label=>parseFloat(Array.from(document.querySelectorAll('.daily-readings > div')).find(e=>e.querySelector('dt')?.textContent===label)?.querySelector('dd')?.textContent),progress=read('Observation progress');return progress>0&&progress<100?{progress,energy:read('Plug A delivered energy'),episodes:read('Plug A spark episodes')}:false;});
 const fresh=await replay.jsonValue();near(fresh.energy,0);near(fresh.episodes,0);await play();const replayHeld=await page.locator('.daily-readings').textContent();await nextFrames();assert.equal(await page.locator('.daily-readings').textContent(),replayHeld);
 for(const [key,next] of [['voltage','9'],['rpm','120']]){await inspect(1);await number(key).fill(next);near(await value('Observation progress'),0);near(await value('Plug A delivered energy'),0);near(await value('Plug A spark episodes'),0);}
 await inspect(1);await control('points').selectOption('2');near(await value('Observation progress'),0);near(await value('Plug A delivered energy'),0);
 await page.getByRole('button',{name:'Reset experiment',exact:true}).click();for(const [key,n] of Object.entries(lesson.tryIt[0].values))assert.equal(Number(await control(key).inputValue()),n);
 await number('voltage').focus();await page.keyboard.press('ArrowDown');assert.equal(Number(await number('voltage').inputValue()),9);await page.getByRole('button',{name:lesson.quiz.options[0],exact:true}).click();await page.getByText(/That’s right/).waitFor();
 await page.setViewportSize({width:390,height:844});await preset(0);await page.evaluate(()=>window.scrollTo(0,0));assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));await shot('mobile');await inspect(1);await shot('mobile-discharge');assert.deepEqual(errors,[]);
 console.log(JSON.stringify({passed:true,normalStages,outcomes,checks:'six presets;four stages;all controls;selected versus conducting;floating gap-voltage masking;A-only signed current/positive power/episode energy;passive budgets;cutaway/exterior;pause/step/reset/edit/replay/result/keyboard/quiz/mobile'},null,2));
}finally{await browser.close();}

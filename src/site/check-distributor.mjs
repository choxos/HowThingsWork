import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
import {chromium} from 'playwright';
import {distributorLesson as lesson} from './distributor-lesson.js';

const browser=await chromium.launch({headless:true}),page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];
const evidence=new URL('../../documentation/audit/evidence/distributor/',import.meta.url);await mkdir(evidence,{recursive:true});
page.on('pageerror',e=>errors.push(e.message));
const reading=label=>page.locator('.daily-readings > div').filter({has:page.getByText(label,{exact:true})}).locator('dd').textContent();
const value=async label=>parseFloat(await reading(label));
const control=key=>page.locator(`[data-control="${key}"]`),number=key=>page.locator(`[data-number="${key}"]`);
const near=(a,b,tolerance=.0001)=>assert.ok(Math.abs(a-b)<=tolerance,`${a} differs from ${b}`);
const play=()=>page.locator('[data-play]').click();
const finished=()=>page.waitForFunction(()=>document.querySelector('[data-play]')?.getAttribute('aria-pressed')==='false',null,{timeout:90000});
const shot=name=>page.screenshot({path:new URL(name+'.png',evidence).pathname,fullPage:true});
const stages=[['A',63],['B',153],['C',243],['D',333],['None',90]];
const inspect=i=>page.getByRole('button',{name:i===4?'Inspect between terminals (90°)':`Inspect terminal ${stages[i][0]} stage (${stages[i][1]}°)`,exact:true}).click();
async function preset(i){
 await page.getByRole('tab',{name:'Try it yourself',exact:true}).click();await page.getByRole('button',{name:'Set up this experiment',exact:true}).nth(i).click();await page.getByRole('tab',{name:'Controls',exact:true}).click();
 for(const [key,n] of Object.entries(lesson.tryIt[i].values))assert.equal(Number(await control(key).inputValue()),n);
 assert.equal(await value('Observation progress'),0);assert.equal(await value('Spark events'),0);assert.equal(await reading('Selected terminal'),'None');assert.equal(await reading('Conducting plug'),'None');near(await value('Ignition battery work'),0);
}
async function budget(){
 const e={};for(const label of ['Ignition battery work','Stored magnetic energy','Stored capacitor energy','Winding heat','Points heat','Delivered spark energy'])e[label]=await value(label);
 near(e['Ignition battery work'],e['Stored magnetic energy']+e['Stored capacitor energy']+e['Winding heat']+e['Points heat']+e['Delivered spark energy'],.001);
 let total=0,episodes=0;for(const id of ['A','B','C','D']){total+=await value(`Plug ${id} energy`);episodes+=await value(`Plug ${id} episodes`);}
 near(total,e['Delivered spark energy'],.0003);assert.equal(episodes,await value('Spark events'));
 near(await value('Secondary winding current'),await value('Selected plug current')+await value('Secondary capacitor current'),.000003);return e;
}
try{
 await page.goto(`${process.env.SITE_URL||'http://127.0.0.1:4177/'}#machine/distributor`);await page.getByRole('heading',{name:'Distributor',exact:true}).waitFor();await page.locator('.daily-readings').waitFor();
 assert.equal(await page.locator('[data-control]').count(),2);assert.equal(await page.locator('[data-number]').count(),2);assert.equal(await page.locator('select[data-control]').count(),0);await shot('initial');
 const outcomes=[];
 for(let i=0;i<lesson.tryIt.length;i++){
  await preset(i);
  if(i===0){await page.locator('[data-step]').click();assert.ok(await value('Observation progress')>0);await play();await page.waitForTimeout(150);await play();const held=await page.locator('.daily-readings').textContent();await page.waitForTimeout(200);assert.equal(await page.locator('.daily-readings').textContent(),held);}
  for(let j=0;j<stages.length;j++){
   await inspect(j);const [selected,angle]=stages[j];near(await value('Shaft angle'),angle,.02);near(await value('Observation progress'),angle/3.6,.06);
   assert.equal(await reading('Selected terminal'),selected);assert.equal(await page.locator('.daily-part-detail h3').textContent(),'Distributor and four connected plug paths');
   for(const [key,n] of Object.entries(lesson.tryIt[i].values))assert.equal(Number(await control(key).inputValue()),n);
   const conducting=await reading('Conducting plug');assert.ok(conducting==='None'||conducting===selected);
   if(i===0&&j<4)assert.equal(conducting,selected);
   if(j===4){assert.equal(conducting,'None');near(await value('Selected plug current'),0);if(i<3)assert.ok(await value('Plug A energy')>0);for(const id of ['B','C','D'])near(await value(`Plug ${id} energy`),0);}
   if(i===3){assert.equal(conducting,'None');near(await value('Delivered spark energy'),0);near(await value('Ignition battery work'),0);assert.equal(await value('Spark events'),0);}
   await budget();await shot(`stage-${i}-${j}`);
  }
  await play();await finished();near(await value('Observation progress'),100);assert.equal(await reading('Selected terminal'),'None');assert.equal(await reading('Conducting plug'),'None');
  const energies=[];for(const id of ['A','B','C','D'])energies.push(await value(`Plug ${id} energy`));
  outcomes.push({episodes:await value('Spark events'),sequence:await reading('Spark sequence'),energies,budget:await budget()});await shot('experiment-'+i);console.log(`PASS experiment ${i+1}: ${lesson.tryIt[i].title}`);
 }
 assert.deepEqual(outcomes.map(x=>x.episodes),[8,4,5,0]);assert.equal(outcomes[0].sequence,'A → A → B → B → C → C → D → D');assert.equal(outcomes[1].sequence,'A → B → C → D');assert.equal(outcomes[2].sequence,'A → A → B → C → D');assert.equal(outcomes[3].sequence,'None');
 near(outcomes[0].budget['Delivered spark energy'],319.8598,.0002);near(outcomes[1].budget['Delivered spark energy'],139.7497,.0002);near(outcomes[2].budget['Delivered spark energy'],67.9013,.0002);near(outcomes[3].budget['Delivered spark energy'],0);
 for(let j=0;j<4;j++){assert.ok(outcomes[1].energies[j]<outcomes[0].energies[j]);assert.ok(outcomes[2].energies[j]<outcomes[0].energies[j]);near(outcomes[3].energies[j],0);}
 await preset(0);await inspect(3);await play();await finished();await page.locator('[data-result]').click();await shot('result');
 await play();await page.waitForTimeout(150);await play();assert.ok(await value('Observation progress')<16);assert.equal(await value('Spark events'),0);near(await value('Delivered spark energy'),0);
 for(const [key,next] of [['voltage','9'],['rpm','120']]){await inspect(2);await number(key).fill(next);assert.equal(await value('Observation progress'),0);assert.equal(await value('Spark events'),0);near(await value('Ignition battery work'),0);}
 await page.getByRole('button',{name:'Reset experiment',exact:true}).click();for(const [key,n] of Object.entries(lesson.tryIt[0].values))assert.equal(Number(await control(key).inputValue()),n);
 await number('voltage').focus();await page.keyboard.press('ArrowDown');assert.equal(Number(await number('voltage').inputValue()),9);
 await page.getByRole('button',{name:lesson.quiz.options[0],exact:true}).click();await page.getByText(/That’s right/).waitFor();
 await page.setViewportSize({width:390,height:844});await preset(0);await page.evaluate(()=>window.scrollTo(0,0));assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));await shot('mobile');await inspect(3);await shot('mobile-stage');assert.deepEqual(errors,[]);
 console.log(JSON.stringify({passed:true,outcomes,checks:'four complete presets/two controls; all five routing stages per preset; selection/conduction/history separation; per-plug energy/episode sums; secondary KCL and passive budget; pause/step/reset/edit/replay/result/keyboard/quiz/mobile'},null,2));
}finally{await browser.close();}

import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
import {chromium} from 'playwright';
import {solenoidLesson as lesson} from './solenoid-lesson.js';

const browser=await chromium.launch({headless:true}),page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];
const evidence=new URL('../../documentation/audit/evidence/solenoid/',import.meta.url);await mkdir(evidence,{recursive:true});page.on('pageerror',e=>errors.push(e.message));
const reading=label=>page.locator('.daily-readings > div').filter({has:page.getByText(label,{exact:true})}).locator('dd').textContent();
const value=async label=>parseFloat(await reading(label)),control=key=>page.locator(`[data-control="${key}"]`),number=key=>page.locator(`[data-number="${key}"]`);
const near=(a,b,tolerance=.00001)=>assert.ok(Math.abs(a-b)<=tolerance,`${a} differs from ${b}`),play=()=>page.locator('[data-play]').click();
const finished=()=>page.waitForFunction(()=>document.querySelector('[data-play]')?.getAttribute('aria-pressed')==='false',null,{timeout:90000});
const progressed=minimum=>page.waitForFunction(min=>{const row=Array.from(document.querySelectorAll('.daily-readings > div')).find(e=>e.querySelector('dt')?.textContent==='Observation progress');return parseFloat(row?.querySelector('dd')?.textContent)>min;},minimum);
const nextFrames=()=>page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(()=>requestAnimationFrame(()=>resolve())))));
const shot=name=>page.screenshot({path:new URL(name+'.png',evidence).pathname,fullPage:true});
const stages=[['pulling',60],['closed',140],['release loop',161],['returned',240]],inspect=i=>page.getByRole('button',{name:`Inspect ${stages[i][0]} stage (${stages[i][1]} ms)`,exact:true}).click();
async function preset(i){
 await page.getByRole('tab',{name:'Try it yourself',exact:true}).click();await page.getByRole('button',{name:'Set up this experiment',exact:true}).nth(i).click();await page.getByRole('tab',{name:'Controls',exact:true}).click();
 for(const [key,n] of Object.entries(lesson.tryIt[i].values))assert.equal(Number(await control(key).inputValue()),n);
 near(await value('Observation progress'),0);near(await value('Main-load energy'),0);near(await value('Plunger travel'),0);assert.match(await reading('First closure'),/No closure/);
}
async function circuit(){
 const voltage=Number(await control('voltage').inputValue()),preload=Number(await control('preload').inputValue()),current=await value('Coil current'),supply=await value('Control supply current'),shunt=await value('Discharge resistor current'),node=await value('Coil terminal voltage'),key=await reading('Key state'),contact=await reading('Main contact'),main=await value('Main current'),travel=await value('Plunger travel'),gap=await value('Main-contact gap'),energy=await value('Main-load energy');
 near(current+shunt,supply,.000002);near(node,96*shunt,.00006);near(await value('Open-key voltage'),voltage-node,.000002);
 if(key==='Start')near(node,voltage);else{near(supply,0);near(node,-96*current,.00006);}
 near(await value('Magnetic force'),50*current*current,.00003);near(await value('Return spring force'),preload+.4*travel,.000002);near(travel+gap,6,.000002);
 near(main,contact==='Closed'?voltage/.3:0);if(contact==='Closed')near(gap,0);assert.ok(travel>=0&&travel<=6&&gap>=0);
 near(await value('Magnetic energy'),.5*(.6+.1*travel)*current*current,.000002);
 const labels=['Magnetic energy','Spring energy','Kinetic energy','Coil heat','Discharge resistor heat','Damping heat','Stop-impact heat'];let budget=energy;for(const label of labels)budget+=await value(label);near(await value('Total battery work'),budget,.000006);near(await value('Total battery work'),await value('Control battery work')+energy,.000002);
 const close=await value('First closure'),open=await value('First reopening'),time=await value('Observation time'),closedTime=await value('Main-contact closed time');near(energy,voltage*voltage/.3*closedTime/1000,.000002);if(Number.isFinite(close))near(energy,voltage*voltage/.3*((Number.isFinite(open)?open:time)-close)/1000,.000002);else near(energy,0);
 return {key,contact,current,supply,shunt,node,main,travel,gap,energy,close,open,time};
}
try{
 await page.goto(`${process.env.SITE_URL||'http://127.0.0.1:4177/'}#machine/solenoid`);await page.getByRole('heading',{name:'Solenoid',exact:true}).waitFor();await page.locator('.daily-readings').waitFor();
 assert.equal(await page.locator('[data-control]').count(),3);assert.equal(await page.locator('[data-number]').count(),2);await shot('initial');
 await page.getByRole('checkbox',{name:'Look inside',exact:true}).uncheck();await shot('exterior');await page.getByRole('checkbox',{name:'Look inside',exact:true}).check();
 const outcomes=[],normalStages=[];
 for(let i=0;i<lesson.tryIt.length;i++){
  await preset(i);
  if(i===0){await page.locator('[data-step]').click();const stepped=await value('Observation progress');assert.ok(stepped>0);await play();await progressed(stepped);await play();const held=await page.locator('.daily-readings').textContent();await nextFrames();assert.equal(await page.locator('.daily-readings').textContent(),held);}
  for(let j=0;j<stages.length;j++){
   await inspect(j);for(const [key,n] of Object.entries(lesson.tryIt[i].values))assert.equal(Number(await control(key).inputValue()),n);
   near(await value('Observation time'),stages[j][1],.001);const result=await circuit();if(i===0)normalStages.push(result);if(i>=2){near(result.main,0);near(result.energy,0);assert.equal(result.contact,'Open');}await shot(`stage-${i}-${j}`);
  }
  await play();await finished();near(await value('Observation progress'),100);near(await value('Observation time'),320,.001);outcomes.push(await circuit());await shot('experiment-'+i);console.log(`PASS experiment ${i+1}: ${lesson.tryIt[i].title}`);
 }
 near(normalStages[0].travel,3.497498267,.000002);assert.equal(normalStages[0].contact,'Open');near(normalStages[0].energy,0);
 assert.equal(normalStages[1].contact,'Closed');near(normalStages[1].main,40);near(normalStages[1].supply,.573040557,.000002);
 const released=normalStages[2];assert.equal(released.key,'Off');assert.equal(released.contact,'Closed');near(released.main,40);near(released.supply,0);near(released.current,.420903714,.000002);assert.ok(released.shunt<0&&released.node<0);assert.ok(released.energy>normalStages[1].energy);
 assert.equal(normalStages[3].contact,'Open');near(normalStages[3].travel,0);near(normalStages[3].main,0);
 for(const [i,energy] of [32.691086355,108.23103198,0,0,0,0].entries())near(outcomes[i].energy,energy,.000002);
 near(outcomes[0].close,94.518683376,.000002);near(outcomes[0].open,162.625113282,.000002);near(outcomes[0].travel,0);assert.equal(outcomes[1].contact,'Closed');near(outcomes[1].main,40);near(outcomes[2].travel,0);near(outcomes[3].travel,.650793273,.000002);
 await preset(0);await inspect(3);await play();await finished();near(await value('Return completed'),182.536426722,.000002);await page.locator('[data-result]').click();await shot('result');await play();
 const replay=await page.waitForFunction(()=>{const read=label=>parseFloat(Array.from(document.querySelectorAll('.daily-readings > div')).find(e=>e.querySelector('dt')?.textContent===label)?.querySelector('dd')?.textContent),progress=read('Observation progress');return progress>0&&progress<100?{progress,energy:read('Main-load energy'),travel:read('Plunger travel')}:false;});const fresh=await replay.jsonValue();near(fresh.energy,0);assert.ok(fresh.travel<6);await play();const held=await page.locator('.daily-readings').textContent();await nextFrames();assert.equal(await page.locator('.daily-readings').textContent(),held);
 for(const [key,next] of [['voltage','9'],['preload','16']]){await inspect(1);await number(key).fill(next);near(await value('Observation progress'),0);near(await value('Main-load energy'),0);near(await value('Plunger travel'),0);}
 await inspect(1);await control('program').selectOption('2');near(await value('Observation progress'),0);near(await value('Coil current'),0);near(await value('Main-load energy'),0);
 await page.getByRole('button',{name:'Reset experiment',exact:true}).click();for(const [key,n] of Object.entries(lesson.tryIt[0].values))assert.equal(Number(await control(key).inputValue()),n);
 await number('voltage').focus();await page.keyboard.press('ArrowDown');assert.equal(Number(await number('voltage').inputValue()),9);await page.getByRole('button',{name:lesson.quiz.options[0],exact:true}).click();await page.getByText(/That’s right/).waitFor();
 await page.setViewportSize({width:390,height:844});await preset(0);await page.evaluate(()=>window.scrollTo(0,0));assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));await shot('mobile');await inspect(2);await circuit();await shot('mobile-release');assert.deepEqual(errors,[]);
 console.log(JSON.stringify({passed:true,normalStages,outcomes,checks:'six presets;four stages;all controls;force and position dependent closure;state-preserving release;main-current release delay;separate coil/supply/shunt currents;node KCL;full energy budget and contact-time delivery;cutaway/exterior;pause/step/reset/edit/replay/result/keyboard/quiz/mobile'},null,2));
}finally{await browser.close();}

import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {chromium} from 'playwright';
import {seismographLesson as lesson} from './seismograph-lesson.js';

const browser=await chromium.launch({headless:true}),page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];
const evidence=new URL(process.env.SEISMOGRAPH_EVIDENCE||'../../documentation/audit/evidence/seismograph/',import.meta.url);await mkdir(evidence,{recursive:true});page.on('pageerror',e=>errors.push(e.message));
const reading=label=>page.locator('.daily-readings > div').filter({has:page.getByText(label,{exact:true})}).locator('dd').textContent();
// Display-only bounds; strict unrounded physics checks remain in the model suite.
const rounding=n=>n===0?0:.5*10**(Math.floor(Math.log10(Math.abs(n)))-2);
const value=async label=>{const text=await reading(label);return text==='< 1 nJ/kg'?0:parseFloat(text);},control=key=>page.locator(`[data-control="${key}"]`),number=key=>page.locator(`[data-number="${key}"]`);
const near=(a,b,tolerance=.000003)=>assert.ok(Math.abs(a-b)<=tolerance,`${a} differs from ${b}`),play=()=>page.locator('[data-play]').click();
const finished=()=>page.waitForFunction(()=>document.querySelector('[data-play]')?.getAttribute('aria-pressed')==='false',null,{timeout:60000});
const nextFrames=()=>page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(()=>requestAnimationFrame(()=>resolve())))));
const shot=name=>page.screenshot({path:new URL(name+'.png',evidence).pathname,fullPage:true});
const stages=['Inspect initial state (0 s)','Inspect shaking (3.125 s)','Inspect ground stopped (8 s)','Inspect ringdown (10 s)','Inspect final recording (16 s)'],times=[0,3.125,8,10,16];
const inspect=i=>page.getByRole('button',{name:stages[i],exact:true}).click();
async function preset(i){
 await page.getByRole('tab',{name:'Try it yourself',exact:true}).click();await page.getByRole('button',{name:'Set up this experiment',exact:true}).nth(i).click();await page.getByRole('tab',{name:'Controls',exact:true}).click();
 for(const [key,n] of Object.entries(lesson.tryIt[i].values))assert.equal(Number(await control(key).inputValue()),n);
 near(await value('Observation progress'),0);near(await value('Recording duration'),0);near(await value('Mass relative to frame'),0);near(await value('Peak relative displacement'),0);
}
async function response(v){
 const s={};for(const key of ['Ground displacement','Absolute mass displacement','Mass relative to frame','Relative velocity','Natural period','Damping ratio','Peak ground displacement','Peak relative displacement','Remaining motion amplitude','Relative energy per unit mass','Recording duration','Observation time','Observation progress'])s[key]=await value(key);
 near(s['Absolute mass displacement'],s['Ground displacement']+s['Mass relative to frame'],['Absolute mass displacement','Ground displacement','Mass relative to frame'].reduce((sum,k)=>sum+rounding(s[k]),1e-12));near(s['Natural period'],1/v.naturalFrequency,.00051);near(s['Damping ratio'],v.damping);
 near(s['Recording duration'],s['Observation time'],.00051);assert.ok(s['Peak relative displacement']+rounding(s['Peak relative displacement'])+rounding(s['Mass relative to frame'])+1e-12>=Math.abs(s['Mass relative to frame']));assert.ok(s['Peak ground displacement']+rounding(s['Peak ground displacement'])+rounding(s['Ground displacement'])+1e-12>=Math.abs(s['Ground displacement']));assert.ok(s['Peak ground displacement']<=v.amplitude+rounding(s['Peak ground displacement'])+1e-12);
 const omega=2*Math.PI*v.naturalFrequency,z=s['Mass relative to frame']/1000,speed=s['Relative velocity']/1000;
 const dz=rounding(s['Mass relative to frame'])/1000,dv=rounding(s['Relative velocity'])/1000,energyBound=(await reading('Relative energy per unit mass'))==='< 1 nJ/kg'?1e-9:rounding(s['Relative energy per unit mass']);
 near(s['Remaining motion amplitude']/1000,Math.hypot(z,speed/omega),rounding(s['Remaining motion amplitude'])/1000+Math.hypot(dz,dv/omega)+1e-12);near(s['Relative energy per unit mass'],.5*(speed*speed+omega*omega*z*z),energyBound+.5*(2*Math.abs(speed)*dv+dv*dv+omega*omega*(2*Math.abs(z)*dz+dz*dz))+1e-12);
 if(s['Observation time']>=8)near(s['Ground displacement'],0);
 if(v.amplitude===0)for(const key of ['Ground displacement','Absolute mass displacement','Mass relative to frame','Relative velocity','Peak ground displacement','Peak relative displacement','Remaining motion amplitude','Relative energy per unit mass'])near(s[key],0);
 return s;
}
try{
 await page.goto(`${process.env.SITE_URL||'http://127.0.0.1:4177/'}#machine/seismograph`);await page.getByRole('heading',{name:'Seismograph',exact:true}).waitFor();await page.locator('.daily-readings').waitFor();assert.equal(await page.locator('[data-control]').count(),4);await shot('initial');
 await page.getByRole('checkbox',{name:'Look inside',exact:true}).uncheck();await shot('exterior');await page.getByRole('checkbox',{name:'Look inside',exact:true}).check();
 const outcomes=[],trials=[];
 for(let i=0;i<lesson.tryIt.length;i++){
  const v=lesson.tryIt[i].values,rows=[];await preset(i);
  for(let j=0;j<stages.length;j++){await inspect(j);near(await value('Observation time'),times[j]);for(const [key,n] of Object.entries(v))assert.equal(Number(await control(key).inputValue()),n);rows.push(await response(v));if(i===0)await shot('stage-'+j);}
  for(const j of [3,4])assert.ok(rows[j]['Relative energy per unit mass']<=rows[j-1]['Relative energy per unit mass']+1e-10);
  if(v.damping===0){near(rows[2]['Relative energy per unit mass'],rows[4]['Relative energy per unit mass'],1e-9);assert.ok(rows[4]['Remaining motion amplitude']>20);}
  trials.push(rows);outcomes.push(rows.at(-1));await shot('experiment-'+i);console.log(`PASS experiment ${i+1}: ${lesson.tryIt[i].title}`);
 }
 near(outcomes[0]['Peak relative displacement'],2.219179,rounding(outcomes[0]['Peak relative displacement']));near(outcomes[2]['Peak relative displacement'],2*outcomes[0]['Peak relative displacement'],rounding(outcomes[2]['Peak relative displacement'])+2*rounding(outcomes[0]['Peak relative displacement']));
 assert.ok(outcomes[3]['Peak relative displacement']<outcomes[0]['Peak relative displacement']/10);assert.ok(outcomes[4]['Peak relative displacement']>outcomes[0]['Peak relative displacement']);assert.ok(outcomes[5]['Peak relative displacement']>outcomes[4]['Peak relative displacement']*5);
 near(outcomes[5]['Remaining motion amplitude'],25.132741,rounding(outcomes[5]['Remaining motion amplitude']));assert.ok(outcomes[6]['Peak relative displacement']<outcomes[4]['Peak relative displacement']);assert.ok(outcomes[7]['Peak relative displacement']<outcomes[6]['Peak relative displacement']);assert.ok(Math.abs(trials[8][1]['Absolute mass displacement'])<Math.abs(trials[8][1]['Ground displacement'])/2);
 await preset(0);await page.locator('[data-step]').click();near(await value('Observation progress'),1,.051);await play();await nextFrames();await play();const paused=await page.locator('.daily-readings').textContent();await nextFrames();assert.equal(await page.locator('.daily-readings').textContent(),paused);
 await page.getByRole('button',{name:'Reset experiment',exact:true}).click();await play();await finished();near(await value('Observation progress'),100);near(await value('Recording duration'),16);await page.getByRole('button',{name:'Inspect the recording',exact:true}).click();near(await value('Observation progress'),100);await shot('recording');await page.locator('[data-result]').click();await shot('result');
 await play();await nextFrames();await play();assert.ok(await value('Observation progress')<100);assert.ok(await value('Recording duration')<16);
 for(const [key,next] of [['amplitude','4'],['frequency','1'],['naturalFrequency','2'],['damping','0']]){await inspect(3);await number(key).fill(next);near(await value('Observation progress'),0);near(await value('Recording duration'),0);near(await value('Peak relative displacement'),0);}
 await page.getByRole('button',{name:'Reset experiment',exact:true}).click();for(const [key,n] of Object.entries(lesson.tryIt[0].values))assert.equal(Number(await control(key).inputValue()),n);await number('amplitude').focus();await page.keyboard.press('ArrowUp');assert.equal(Number(await number('amplitude').inputValue()),3);
 await page.getByRole('button',{name:lesson.quiz.options[0],exact:true}).click();await page.getByText(/That’s right/).waitFor();
 await page.setViewportSize({width:390,height:844});await preset(5);await inspect(4);await page.evaluate(()=>window.scrollTo(0,0));assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));await shot('mobile-undamped');near(await value('Remaining motion amplitude'),25.132741,rounding(await value('Remaining motion amplitude')));await preset(1);await inspect(4);await shot('mobile-quiet');near(await value('Peak relative displacement'),0);near(await value('Recording duration'),16);assert.deepEqual(errors,[]);
 const report={passed:true,outcomes,trials,checks:'nine presets;five stages;all controls;coordinate and energy consistency;linearity;frequency response;quiet record;resonance;undamped energy retention;damped decay;pause/step/reset/edit/replay/recording/result/keyboard/quiz/mobile'};
 await writeFile(new URL('browser-results.json',evidence),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));
}finally{await browser.close();}

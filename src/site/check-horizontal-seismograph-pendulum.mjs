import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {chromium} from 'playwright';
import {horizontalSeismographPendulumLesson as lesson} from './horizontal-seismograph-pendulum-lesson.js';

const browser=await chromium.launch({headless:true}),page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];
const evidence=new URL(process.env.HORIZONTAL_PENDULUM_EVIDENCE||'../../documentation/audit/evidence/horizontal-seismograph-pendulum/',import.meta.url);await mkdir(evidence,{recursive:true});page.on('pageerror',e=>errors.push(e.message));
const reading=label=>page.locator('.daily-readings > div').filter({has:page.getByText(label,{exact:true})}).locator('dd').textContent();
// Display rounding only; model reference tolerances remain unchanged.
const rounding=n=>n===0?1e-6:.5*10**(Math.floor(Math.log10(Math.abs(n)))-2);
const value=async label=>{const text=await reading(label);return text==='< 1 nJ/kg'?0:parseFloat(text);},control=key=>page.locator(`[data-control="${key}"]`),number=key=>page.locator(`[data-number="${key}"]`);
const near=(a,b,tolerance=.000003)=>assert.ok(Math.abs(a-b)<=tolerance,`${a} differs from ${b}`),play=()=>page.locator('[data-play]').click();
const finished=()=>page.waitForFunction(()=>document.querySelector('[data-play]')?.getAttribute('aria-pressed')==='false',null,{timeout:60000});
const nextFrames=()=>page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(()=>requestAnimationFrame(()=>resolve())))));
const shot=name=>page.screenshot({path:new URL(name+'.png',evidence).pathname,fullPage:true});
const stages=['Inspect initial state (0 s)','Inspect shaking (6.125 s)','Inspect ground stopped (16 s)','Inspect ringdown (20 s)','Inspect final recording (32 s)'],times=[0,6.125,16,20,32];
const inspect=i=>page.getByRole('button',{name:stages[i],exact:true}).click();
async function preset(i){
 await page.getByRole('tab',{name:'Try it yourself',exact:true}).click();await page.getByRole('button',{name:'Set up this experiment',exact:true}).nth(i).click();await page.getByRole('tab',{name:'Controls',exact:true}).click();
 for(const [key,n] of Object.entries(lesson.tryIt[i].values))assert.equal(Number(await control(key).inputValue()),n);
 near(await value('Observation progress'),0);near(await value('Recording duration'),0);near(await value('Mass relative to frame'),0);near(await value('Peak relative displacement'),0);
}
async function response(v){
 const s={};for(const key of ['Ground displacement','Ground along sensitive direction','Ground across sensitive direction','Absolute cross-axis mass displacement','Absolute mass displacement','Mass relative to frame','Cross-axis relative displacement','Mass rise','Pendulum angle','Angular velocity','Natural period','Natural frequency','Wire tension per unit mass','Peak relative displacement','Peak pendulum angle','Relative energy per unit mass','Recording duration','Observation time','Observation progress'])s[key]=await value(key);
 const radians=Math.PI/180,i=v.inclination*radians,theta=s['Pendulum angle']*radians,speed=s['Angular velocity']*radians,omega=Math.sqrt(9.80665*Math.sin(i)/.5);
 const error=label=>rounding(s[label]),thetaError=error('Pendulum angle')*radians,speedError=error('Angular velocity')*radians,cosError=Math.abs(Math.sin(theta))*thetaError+.5*thetaError**2;
 near(s['Absolute mass displacement'],s['Ground along sensitive direction']+s['Mass relative to frame'],error('Absolute mass displacement')+error('Ground along sensitive direction')+error('Mass relative to frame')+1e-12);
 near(s['Ground along sensitive direction'],s['Ground displacement']*Math.cos(v.direction*radians),error('Ground along sensitive direction')+error('Ground displacement')*Math.abs(Math.cos(v.direction*radians))+1e-12);
 near(s['Ground across sensitive direction'],s['Ground displacement']*Math.sin(v.direction*radians),error('Ground across sensitive direction')+error('Ground displacement')*Math.abs(Math.sin(v.direction*radians))+1e-12);
 near(s['Absolute cross-axis mass displacement'],s['Ground across sensitive direction']+s['Cross-axis relative displacement'],error('Absolute cross-axis mass displacement')+error('Ground across sensitive direction')+error('Cross-axis relative displacement')+1e-12);
 near(s['Natural period'],2*Math.PI/omega,.00051);near(s['Natural frequency'],omega/(2*Math.PI),error('Natural frequency')+1e-12);
 near(s['Mass relative to frame'],500*Math.sin(theta),error('Mass relative to frame')+500*thetaError+1e-12);
 near(s['Cross-axis relative displacement'],500*Math.cos(i)*(Math.cos(theta)-1),error('Cross-axis relative displacement')+500*Math.abs(Math.cos(i))*cosError+1e-12);
 near(s['Mass rise'],500*Math.sin(i)*(1-Math.cos(theta)),error('Mass rise')+500*Math.abs(Math.sin(i))*cosError+1e-12);
 const energyError=(await reading('Relative energy per unit mass'))==='< 1 nJ/kg'?1e-9:error('Relative energy per unit mass');
 near(s['Relative energy per unit mass'],.125*speed*speed+9.80665*.5*Math.sin(i)*(1-Math.cos(theta)),energyError+.125*(2*Math.abs(speed)*speedError+speedError**2)+9.80665*.5*Math.sin(i)*cosError+1e-12);assert.ok(s['Wire tension per unit mass']>12,'wire remains taut');
 near(s['Recording duration'],s['Observation time'],.00051);assert.ok(s['Peak relative displacement']+error('Peak relative displacement')+error('Mass relative to frame')+1e-12>=Math.abs(s['Mass relative to frame']));assert.ok(s['Peak pendulum angle']+error('Peak pendulum angle')+error('Pendulum angle')+1e-12>=Math.abs(s['Pendulum angle']));
 if(s['Observation time']>=16)near(s['Ground displacement'],0);
 if(v.amplitude===0||v.direction===90)for(const key of ['Absolute mass displacement','Mass relative to frame','Cross-axis relative displacement','Mass rise','Pendulum angle','Angular velocity','Peak relative displacement','Peak pendulum angle','Relative energy per unit mass'])near(s[key],0);
 return s;
}
try{
 await page.goto(`${process.env.SITE_URL||'http://127.0.0.1:4177/'}#machine/horizontal-seismograph-pendulum`);await page.getByRole('heading',{name:'Horizontal seismograph pendulum',exact:true}).waitFor();await page.locator('.daily-readings').waitFor();assert.equal(await page.locator('[data-control]').count(),5);await shot('initial');
 await page.getByRole('checkbox',{name:'Look inside',exact:true}).uncheck();await shot('exterior');await page.getByRole('checkbox',{name:'Look inside',exact:true}).check();
 const outcomes=[],trials=[];
 for(let i=0;i<lesson.tryIt.length;i++){
  const v=lesson.tryIt[i].values,rows=[];await preset(i);
  for(let j=0;j<stages.length;j++){await inspect(j);near(await value('Observation time'),times[j]);for(const [key,n] of Object.entries(v))assert.equal(Number(await control(key).inputValue()),n);rows.push(await response(v));if(i===0)await shot('stage-'+j);}
  for(const j of [3,4])assert.ok(rows[j]['Relative energy per unit mass']<=rows[j-1]['Relative energy per unit mass']+1e-9);
  if(v.damping===0){near(rows[2]['Relative energy per unit mass'],rows[4]['Relative energy per unit mass'],1e-9);assert.ok(rows[4]['Relative energy per unit mass']>.004);}
  trials.push(rows);outcomes.push(rows.at(-1));await shot('experiment-'+i);console.log(`PASS experiment ${i+1}: ${lesson.tryIt[i].title}`);
 }
 const expectedPeaks=[10.647340,0,10.647340,7.625288,0,21.278410,10.306107,17.157253,61.460628,4.933788];for(let i=0;i<expectedPeaks.length;i++)near(outcomes[i]['Peak relative displacement'],expectedPeaks[i],rounding(outcomes[i]['Peak relative displacement'])+1e-12);
 near(trials[2][1]['Mass relative to frame'],-trials[0][1]['Mass relative to frame']);assert.ok(Math.abs(trials[1][1]['Ground displacement'])>3);near(trials[1][1]['Ground along sensitive direction'],0);
 const diagonal=outcomes[3]['Peak relative displacement']/outcomes[0]['Peak relative displacement'];assert.ok(diagonal>.70&&diagonal<.73);const doubled=outcomes[5]['Peak relative displacement']/outcomes[0]['Peak relative displacement'];assert.ok(doubled>1.99&&doubled<2.01);assert.ok(outcomes[6]['Natural period']>outcomes[0]['Natural period']);assert.ok(outcomes[8]['Peak relative displacement']>outcomes[7]['Peak relative displacement']*3);assert.ok(outcomes[9]['Peak relative displacement']<outcomes[7]['Peak relative displacement']);
 await preset(0);await page.locator('[data-step]').click();near(await value('Observation progress'),1,.051);near(await value('Observation time'),.32);await play();await nextFrames();await play();const paused=await page.locator('.daily-readings').textContent();await nextFrames();assert.equal(await page.locator('.daily-readings').textContent(),paused);
 await page.getByRole('button',{name:'Reset experiment',exact:true}).click();await play();await finished();near(await value('Observation progress'),100);near(await value('Recording duration'),32);await page.getByRole('button',{name:'Inspect the recording',exact:true}).click();near(await value('Observation progress'),100);await shot('recording');await page.locator('[data-result]').click();await shot('result');
 await play();await nextFrames();await play();assert.ok(await value('Observation progress')<100);assert.ok(await value('Recording duration')<32);
 for(const [key,next] of [['amplitude','20'],['frequency','.25'],['inclination','7'],['direction','90'],['damping','0']]){await inspect(3);await number(key).fill(next);near(await value('Observation progress'),0);near(await value('Recording duration'),0);near(await value('Peak relative displacement'),0);}
 await page.getByRole('button',{name:'Reset experiment',exact:true}).click();for(const [key,n] of Object.entries(lesson.tryIt[0].values))assert.equal(Number(await control(key).inputValue()),n);await number('amplitude').focus();await page.keyboard.press('ArrowUp');assert.equal(Number(await number('amplitude').inputValue()),15);
 await page.getByRole('button',{name:lesson.quiz.options[0],exact:true}).click();await page.getByText(/That’s right/).waitFor();
 await page.setViewportSize({width:390,height:844});await preset(8);await inspect(4);await page.evaluate(()=>window.scrollTo(0,0));assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));await shot('mobile-undamped');assert.ok(await value('Relative energy per unit mass')>.004);await preset(1);await inspect(1);await shot('mobile-cross-axis');near(await value('Peak relative displacement'),0);assert.ok(Math.abs(await value('Ground displacement'))>3);assert.deepEqual(errors,[]);
 const report={passed:true,outcomes,trials,checks:'ten presets;five stages;all controls;nonlinear coordinate and energy consistency;direction reversal;transverse silence;oblique response;inclination;quiet record;undamped energy retention;damped decay;pause/step/reset/edit/replay/recording/result/keyboard/quiz/mobile'};
 await writeFile(new URL('browser-results.json',evidence),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({passed:true,outcomes,checks:report.checks},null,2));
}finally{await browser.close();}

import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {chromium} from 'playwright';
import {verticalSeismographPendulumLesson as lesson} from './vertical-seismograph-pendulum-lesson.js';

const browser=await chromium.launch({headless:true}),page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];
const evidence=new URL(process.env.VERTICAL_PENDULUM_EVIDENCE||'../../documentation/audit/evidence/vertical-seismograph-pendulum/',import.meta.url);await mkdir(evidence,{recursive:true});page.on('pageerror',e=>errors.push(e.message));
const reading=label=>page.locator('.daily-readings > div').filter({has:page.getByText(label,{exact:true})}).locator('dd').textContent();
// Display rounding only; independent physical model tolerances remain unchanged.
const rounding=n=>n===0?0:.5*10**(Math.floor(Math.log10(Math.abs(n)))-2);
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
 const s={};for(const key of ['Ground displacement','Absolute mass displacement','Mass relative to frame','Horizontal mass displacement','Pendulum angle','Angular velocity','Natural period','Natural frequency','Spring length','Spring free length','Spring extension','Spring stiffness','Spring tension','Peak relative displacement','Peak pendulum angle','Relative energy per unit mass','Recording duration','Observation time','Observation progress'])s[key]=await value(key);
 const theta=s['Pendulum angle']*Math.PI/180,speed=s['Angular velocity']*Math.PI/180,R=.5,H=.6,g=9.80665,eq=Math.hypot(R,H),omega=2*Math.PI*v.naturalFrequency,K=(omega*omega*eq*eq+g*H)/(H*H),free=eq*(1-g/(H*K)),length=Math.sqrt(R*R+H*H-2*R*H*Math.sin(theta)),delta=-2*R*H*Math.sin(theta)/(length+eq);
 const error=label=>rounding(s[label]),thetaError=error('Pendulum angle')*Math.PI/180,speedError=error('Angular velocity')*Math.PI/180,cosError=Math.abs(Math.sin(theta))*thetaError+.5*thetaError**2;
 const minLength=Math.sqrt(eq*eq-2*R*H*(Math.sin(theta)+thetaError)),lengthError=R*H*thetaError/minLength;
 near(s['Absolute mass displacement'],s['Ground displacement']+s['Mass relative to frame'],error('Absolute mass displacement')+error('Ground displacement')+error('Mass relative to frame')+1e-12);near(s['Mass relative to frame'],R*1000*Math.sin(theta),error('Mass relative to frame')+R*1000*thetaError+1e-12);near(s['Horizontal mass displacement'],R*1000*(Math.cos(theta)-1),error('Horizontal mass displacement')+R*1000*cosError+1e-12);
 near(s['Natural period'],1/v.naturalFrequency,.00051);near(s['Natural frequency'],v.naturalFrequency,error('Natural frequency')+1e-12);near(s['Spring length'],length,error('Spring length')+lengthError+1e-12);near(s['Spring free length'],free,error('Spring free length')+1e-12);near(s['Spring extension'],1000*(length-free),error('Spring extension')+1000*lengthError+1e-12);near(s['Spring stiffness'],K,error('Spring stiffness')+1e-12);near(s['Spring tension'],K*(length-free),error('Spring tension')+K*lengthError+1e-12);
 const energyError=(await reading('Relative energy per unit mass'))==='< 1 nJ/kg'?1e-9:error('Relative energy per unit mass');
 near(s['Relative energy per unit mass'],.5*R*R*speed*speed+.5*(K-g/H)*delta*delta,energyError+.5*R*R*(2*Math.abs(speed)*speedError+speedError**2)+.5*(K-g/H)*(2*Math.abs(delta)*lengthError+lengthError**2)+1e-12);assert.ok(s['Spring extension']>200,'spring remains in tension within the validated range');assert.ok(s['Spring tension']>6,'tension remains positive');
 near(s['Recording duration'],s['Observation time'],.00051);assert.ok(s['Peak relative displacement']+error('Peak relative displacement')+error('Mass relative to frame')+1e-12>=Math.abs(s['Mass relative to frame']));assert.ok(s['Peak pendulum angle']+error('Peak pendulum angle')+error('Pendulum angle')+1e-12>=Math.abs(s['Pendulum angle']));
 if(s['Observation time']>=16)near(s['Ground displacement'],0);
 if(v.amplitude===0){for(const key of ['Absolute mass displacement','Mass relative to frame','Horizontal mass displacement','Pendulum angle','Angular velocity','Peak relative displacement','Peak pendulum angle','Relative energy per unit mass'])near(s[key],0);near(s['Spring tension']*H/eq,g,error('Spring tension')*H/eq+1e-12);}
 return s;
}
try{
 await page.goto(`${process.env.SITE_URL||'http://127.0.0.1:4177/'}#machine/vertical-seismograph-pendulum`);await page.getByRole('heading',{name:'Vertical seismograph pendulum',exact:true}).waitFor();await page.locator('.daily-readings').waitFor();assert.equal(await page.locator('[data-control]').count(),4);await shot('initial');
 await page.getByRole('checkbox',{name:'Look inside',exact:true}).uncheck();await shot('exterior');await page.getByRole('checkbox',{name:'Look inside',exact:true}).check();
 const outcomes=[],trials=[];
 for(let i=0;i<lesson.tryIt.length;i++){
  const v=lesson.tryIt[i].values,rows=[];await preset(i);
  for(let j=0;j<stages.length;j++){await inspect(j);near(await value('Observation time'),times[j]);for(const [key,n] of Object.entries(v))assert.equal(Number(await control(key).inputValue()),n);rows.push(await response(v));if(i===0)await shot('stage-'+j);}
  for(const j of [3,4])assert.ok(rows[j]['Relative energy per unit mass']<=rows[j-1]['Relative energy per unit mass']+1e-9);
  if(v.damping===0){near(rows[2]['Relative energy per unit mass'],rows[4]['Relative energy per unit mass'],1e-9);assert.ok(rows[4]['Relative energy per unit mass']>.004);}
  trials.push(rows);outcomes.push(rows.at(-1));await shot('experiment-'+i);console.log(`PASS experiment ${i+1}: ${lesson.tryIt[i].title}`);
 }
 const expectedPeaks=[11.182491,0,22.514516,.688862,9.759005,16.816689,64.509540,4.867828,10.125135];for(let i=0;i<expectedPeaks.length;i++)near(outcomes[i]['Peak relative displacement'],expectedPeaks[i],rounding(outcomes[i]['Peak relative displacement'])+1e-12);
 const slow=trials[3][1],fast=trials[8][1];assert.ok(Math.abs(slow['Mass relative to frame'])<.15*Math.abs(slow['Ground displacement']));assert.ok(Math.abs(slow['Absolute mass displacement'])>.8*Math.abs(slow['Ground displacement']));assert.ok(Math.abs(fast['Absolute mass displacement'])<.25*Math.abs(fast['Ground displacement']));
 const doubled=outcomes[2]['Peak relative displacement']/outcomes[0]['Peak relative displacement'];assert.ok(doubled>1.98&&doubled<2.05);assert.ok(outcomes[3]['Peak relative displacement']<outcomes[0]['Peak relative displacement']/10);assert.ok(outcomes[4]['Natural period']<outcomes[0]['Natural period']);assert.ok(outcomes[4]['Spring stiffness']>outcomes[0]['Spring stiffness']);assert.ok(outcomes[4]['Spring free length']>outcomes[0]['Spring free length']);near(trials[4][0]['Spring tension'],trials[0][0]['Spring tension'],.000001);assert.ok(outcomes[6]['Peak relative displacement']>outcomes[5]['Peak relative displacement']*3);assert.ok(outcomes[7]['Peak relative displacement']<outcomes[5]['Peak relative displacement']);

 await preset(0);await page.locator('[data-step]').click();near(await value('Observation progress'),1,.051);near(await value('Observation time'),.32);await play();await nextFrames();await play();const paused=await page.locator('.daily-readings').textContent();await nextFrames();assert.equal(await page.locator('.daily-readings').textContent(),paused);
 await page.getByRole('button',{name:'Reset experiment',exact:true}).click();await play();await finished();near(await value('Observation progress'),100);near(await value('Recording duration'),32);await page.getByRole('button',{name:'Inspect the recording',exact:true}).click();near(await value('Observation progress'),100);await shot('recording');await page.locator('[data-result]').click();await shot('result');
 await play();await nextFrames();await play();assert.ok(await value('Observation progress')<100);assert.ok(await value('Recording duration')<32);
 for(const [key,next] of [['amplitude','20'],['frequency','.25'],['naturalFrequency','.5'],['damping','0']]){await inspect(3);await number(key).fill(next);near(await value('Observation progress'),0);near(await value('Recording duration'),0);near(await value('Peak relative displacement'),0);}
 await page.getByRole('button',{name:'Reset experiment',exact:true}).click();for(const [key,n] of Object.entries(lesson.tryIt[0].values))assert.equal(Number(await control(key).inputValue()),n);await number('amplitude').focus();await page.keyboard.press('ArrowUp');assert.equal(Number(await number('amplitude').inputValue()),15);
 await page.getByRole('button',{name:lesson.quiz.options[0],exact:true}).click();await page.getByText(/That’s right/).waitFor();
 await page.setViewportSize({width:390,height:844});await preset(6);await inspect(4);await page.evaluate(()=>window.scrollTo(0,0));assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));await shot('mobile-undamped');assert.ok(await value('Relative energy per unit mass')>.004);await preset(1);await inspect(1);await shot('mobile-quiet');near(await value('Peak relative displacement'),0);assert.ok(await value('Spring tension')>12);assert.deepEqual(errors,[]);
 const report={passed:true,outcomes,trials,checks:'nine presets;five stages;all controls;nonlinear coordinates;spring length/extension/tension;gravity balance;tuned stiffness/free length;combined energy;quiet loaded spring;undamped energy retention;damped decay;pause/step/reset/edit/replay/recording/result/keyboard/quiz/mobile'};
 await writeFile(new URL('browser-results.json',evidence),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({passed:true,outcomes,checks:report.checks},null,2));
}finally{await browser.close();}

import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {chromium} from 'playwright';
import {seismicWavesLesson as lesson} from './seismic-waves-lesson.js';

const browser=await chromium.launch({headless:true}),page=await browser.newPage({viewport:{width:1440,height:1000},reducedMotion:'reduce'}),errors=[];
const evidence=new URL((process.env.EVIDENCE_DIR||'documentation/audit/evidence/seismic-waves-20260919').replace(/\/$/,'')+'/',new URL('../../',import.meta.url));await mkdir(evidence,{recursive:true});page.on('pageerror',e=>errors.push(e.message));
const reading=label=>page.locator('.daily-readings > div').filter({has:page.getByText(label,{exact:true})}).locator('dd').textContent();
const value=async label=>parseFloat(await reading(label)),control=key=>page.locator(`[data-control="${key}"]`),number=key=>page.locator(`[data-number="${key}"]`);
const near=(a,b,tolerance=.00051)=>assert.ok(Math.abs(a-b)<=tolerance,`${a} differs from ${b}`),play=()=>page.locator('[data-play]').click();
const nextFrames=()=>page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(()=>requestAnimationFrame(()=>resolve())))));
const finished=()=>page.waitForFunction(()=>document.querySelector('[data-play]')?.getAttribute('aria-pressed')==='false',null,{timeout:90000});
const shot=async name=>{await page.locator('canvas').scrollIntoViewIfNeeded();await page.mouse.move(0,0);await page.screenshot({path:new URL(name+'.png',evidence).pathname,clip:await page.locator('.daily-canvas-wrap').boundingBox()});};
const stages=['Inspect before nominal arrival','Inspect near P packet','Inspect near S packet','Inspect far P packet','Inspect far S packet','Inspect final station records'];
const inspect=i=>page.getByRole('button',{name:stages[i],exact:true}).click();
const times=v=>[30/(v.mode===1?v.speed/Math.sqrt(3):v.speed)-.01,30/v.speed+1.75,30*Math.sqrt(3)/v.speed+1.75,v.distance/v.speed+1.75,v.distance*Math.sqrt(3)/v.speed+1.75,60];
// Independent harmonic form of the windowed carrier and bracketed stationary points.
function packet(t){return t<=0||t>=4?0:.5*Math.sin(2*Math.PI*t)-.25*Math.sin(1.5*Math.PI*t)-.25*Math.sin(2.5*Math.PI*t);}
const derivative=t=>Math.PI*Math.cos(2*Math.PI*t)-.375*Math.PI*Math.cos(1.5*Math.PI*t)-.625*Math.PI*Math.cos(2.5*Math.PI*t),roots=[];
for(let i=1;i<512;i++){let a=i/128,b=(i+1)/128;if(derivative(a)*derivative(b)>=0)continue;for(let j=0;j<48;j++){const m=(a+b)/2;if(derivative(a)*derivative(m)<=0)b=m;else a=m;}roots.push((a+b)/2);}
function peak(t){return Math.max(Math.abs(packet(t)),0,...roots.filter(x=>x<=t).map(x=>Math.abs(packet(x))));}
async function preset(i){await page.getByRole('tab',{name:'Try it yourself',exact:true}).click();await page.getByRole('button',{name:'Set up this experiment',exact:true}).nth(i).click();await page.getByRole('tab',{name:'Controls',exact:true}).click();for(const [key,n] of Object.entries(lesson.tryIt[i].values))assert.equal(Number(await control(key).inputValue()),n);near(await value('Observation time'),0);near(await value('Recording duration'),0);for(const place of ['Near','Far'])for(const kind of ['P','S'])near(await value(`${place} peak ${kind} displacement`),0);}
async function response(v,time){
 const s={};for(const label of ['P-wave speed','S-wave speed','Near-station distance','Far-station distance','Far-to-near amplitude ratio','Recording duration','Observation time','Observation progress'])s[label]=await value(label);
 near(s['P-wave speed'],v.speed);near(s['S-wave speed'],v.speed/Math.sqrt(3));near(s['Near-station distance'],30);near(s['Far-station distance'],v.distance);near(s['Far-to-near amplitude ratio'],30/v.distance);near(s['Observation time'],time,.00051);near(s['Recording duration'],time,.00051);near(s['Observation progress'],time/60*100,.051);
 for(const [name,r] of [['Near',30],['Far',v.distance]])for(const mode of ['P','S']){
  const enabled=mode==='P'?v.mode!==1:v.mode!==0,c=v.speed/(mode==='S'?Math.sqrt(3):1),arrival=r/c,tau=time-arrival,envelope=v.amplitude*30/r;
  const arrivalLabel=`${name} ${mode} arrival`,displacementLabel=`${name} ${mode} displacement`,peakLabel=`${name} peak ${mode} displacement`,statusLabel=`${name} ${mode} status`;
  s[arrivalLabel]=await value(arrivalLabel);s[displacementLabel]=await value(displacementLabel);s[peakLabel]=await value(peakLabel);s[statusLabel]=await reading(statusLabel);
  near(s[arrivalLabel],arrival,.00051);near(s[displacementLabel],enabled?envelope*packet(tau):0);near(s[peakLabel],enabled?envelope*peak(tau):0);
  const expectedStatus=!enabled?'Not selected':v.amplitude===0?'No disturbance':time<arrival?'Not arrived':time<arrival+4?'Packet passing':'Packet passed · record retained';assert.equal(s[statusLabel],expectedStatus);
 }
 return s;
}
try{
 await page.goto(`${process.env.SITE_URL||'http://127.0.0.1:4177/'}#machine/seismic-waves`);await page.getByRole('heading',{name:'Seismic waves',exact:true}).waitFor();assert.equal(await page.locator('[data-control]').count(),4);assert.match(await page.locator('.daily-readings').textContent(),/Prescribed leading far-field body-wave packets/);
 const trials=[],outcomes=[],cases=[];
 for(const width of [1440,390]){
 await page.setViewportSize({width,height:width===390?844:1000});await page.reload();await page.locator('[data-play]').waitFor();near(await value('Observation time'),9.25);assert.equal(await page.locator('.daily-part-detail h3').textContent(),'Near ground detail · 30 to 32 km');await shot(`opening-${width}`);
 trials.length=0;outcomes.length=0;
 for(let i=0;i<lesson.tryIt.length;i++){await preset(i);const v=lesson.tryIt[i].values,rows=[];for(let j=0;j<stages.length;j++){await inspect(j);for(const [key,n] of Object.entries(v))assert.equal(Number(await control(key).inputValue()),n);rows.push(await response(v,times(v)[j]));if(i===0)await shot(`stage-${width}-${j}`);}trials.push(rows);outcomes.push(rows.at(-1));await shot(`experiment-${width}-${i}`);assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));cases.push({width,title:lesson.tryIt[i].title,stages:rows});console.log(`PASS ${width} experiment ${i+1}: ${lesson.tryIt[i].title}`);}
 for(const [i,v] of lesson.tryIt.map((x,i)=>[i,x.values]))for(const mode of ['P','S']){const n=outcomes[i][`Near peak ${mode} displacement`],f=outcomes[i][`Far peak ${mode} displacement`];near(f,n*30/v.distance,.001);}
 for(const mode of ['P','S']){const key=`Far peak ${mode} displacement`;near(outcomes[4][key],outcomes[0][key]*2,.0015);near(outcomes[5][key],outcomes[0][key]*4/3,.0012);near(outcomes[6][key],outcomes[0][key]*2/3,.0009);near(outcomes[7][key],outcomes[0][key]);near(outcomes[8][key],outcomes[0][key]);assert.ok(outcomes[7][`Far ${mode} arrival`]>outcomes[0][`Far ${mode} arrival`]);assert.ok(outcomes[8][`Far ${mode} arrival`]<outcomes[0][`Far ${mode} arrival`]);}
 assert.ok(outcomes[6]['Far S arrival']-outcomes[6]['Far P arrival']>outcomes[5]['Far S arrival']-outcomes[5]['Far P arrival']);
 await preset(0);await page.locator('[data-step]').click();near(await value('Observation time'),.6);await play();await nextFrames();await play();const paused=await page.locator('.daily-readings').textContent();await nextFrames();assert.equal(await page.locator('.daily-readings').textContent(),paused);
 await page.getByRole('button',{name:'Reset experiment',exact:true}).click();await play();await finished();await response(lesson.tryIt[0].values,60);await page.getByRole('button',{name:'Inspect the recording',exact:true}).click();await shot(`recording-${width}`);await page.locator('[data-result]').click();await shot(`result-${width}`);await play();await nextFrames();await play();assert.ok(await value('Observation time')<60);assert.ok(await value('Recording duration')<60);
 for(const [key,next] of [['amplitude','4'],['distance','90'],['speed','3']]){await inspect(5);await number(key).fill(next);near(await value('Observation time'),0);near(await value('Recording duration'),0);near(await value('Near peak P displacement'),0);}await inspect(5);await control('mode').selectOption('1');near(await value('Observation time'),0);near(await value('Near peak S displacement'),0);
 await page.getByRole('button',{name:'Reset experiment',exact:true}).click();for(const [key,n] of Object.entries(lesson.tryIt[0].values))assert.equal(Number(await control(key).inputValue()),n);await number('amplitude').focus();await page.keyboard.press('ArrowUp');assert.equal(Number(await number('amplitude').inputValue()),3);
 await preset(0);await inspect(1);const before=await page.locator('.daily-readings').textContent();await page.getByRole('button',{name:'Inspect near ground detail',exact:true}).click();assert.equal(await page.locator('.daily-readings').textContent(),before);await shot(`near-detail-${width}`);await inspect(4);await page.getByRole('button',{name:'Inspect far ground detail',exact:true}).click();await shot(`far-detail-${width}`);
 await page.getByRole('button',{name:lesson.quiz.options[0],exact:true}).click();await page.getByText(/That’s right/).waitFor();
 await page.locator('[data-result]').click();assert.equal(await page.locator('.daily-part-detail h3').textContent(),'Retained two-component station records');await page.locator('.daily-heading h1').click();assert.equal(await page.locator('.daily-part-detail h3').count(),0);
 await page.locator('[data-labels]').check();await page.locator('button[data-label-part="near-inset"]').click();assert.equal(await page.locator('.daily-part-detail h3').textContent(),'Near ground detail · 30 to 32 km');await page.keyboard.press('Escape');assert.equal(await page.locator('.daily-part-detail h3').count(),0);await page.locator('button[data-label-part="far-inset"]').click();await page.locator('.daily-heading h1').click();assert.equal(await page.locator('.daily-part-detail h3').count(),0);await page.locator('[data-labels]').uncheck();
 await page.locator('[data-view="reset"]').click();await page.locator('[data-separation]').fill('100');const categories=await page.locator('.daily-inventory-labels [data-category]').allTextContents();assert(categories.length>=8);for(const view of ['in','out']){await page.locator(`[data-view="${view}"]`).click();assert.equal(await page.locator('[data-separation]').inputValue(),'100');}await shot(`separated-${width}`);await page.locator('[data-reassemble]').click();assert.equal(await page.locator('[data-separation]').inputValue(),'0');
 }
 assert.deepEqual(errors,[]);
 const report={passed:true,base:process.env.SITE_URL,browser:browser.version(),errors,cases,checks:'nine presets at two widths;six stages each;initial near-P preview;independent harmonic packet and extrema;polarization;causal arrivals;inverse-distance amplitudes;separate retained components;all controls;pause/step/reset/replay/result;detail views;keyboard;quiz;labels and outside/Escape dismissal;grouped separation;zoom-only buttons;mobile'};await writeFile(new URL('browser-results.json',evidence),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({passed:true,experiments:cases.length,checks:report.checks},null,2));
}catch(error){await writeFile(new URL('failure.json',evidence),JSON.stringify({url:page.url(),error:String(error),errors},null,2)+'\n');await page.screenshot({path:new URL('failure.png',evidence).pathname,fullPage:true}).catch(()=>{});throw error;}finally{await browser.close();}

import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {chromium} from 'playwright';
import {verticalSeismographSpringLesson as lesson} from './vertical-seismograph-spring-lesson.js';

const browser=await chromium.launch({headless:true}),page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];
const evidence=new URL(process.env.VERTICAL_SPRING_EVIDENCE||'../../documentation/audit/evidence/vertical-seismograph-spring/',import.meta.url);await mkdir(evidence,{recursive:true});page.on('pageerror',e=>errors.push(e.message));
const reading=label=>page.locator('.daily-readings > div').filter({has:page.getByText(label,{exact:true})}).locator('dd').textContent();
// Display rounding only; independent model reference tolerances remain unchanged.
const rounding=n=>n===0?0:.5*10**(Math.floor(Math.log10(Math.abs(n)))-2);
const value=async label=>{const text=await reading(label);return text==='< 1 nJ'?0:parseFloat(text);},control=key=>page.locator(`[data-control="${key}"]`),number=key=>page.locator(`[data-number="${key}"]`);
const near=(a,b,tolerance=.0000011)=>assert.ok(Math.abs(a-b)<=tolerance,`${a} differs from ${b} (tolerance ${tolerance})`);
const play=()=>page.locator('[data-play]').click(),frames=()=>page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))));
const finished=()=>page.waitForFunction(()=>document.querySelector('[data-play]')?.getAttribute('aria-pressed')==='false',null,{timeout:60000});
const shot=name=>page.screenshot({path:new URL(name+'.png',evidence).pathname,fullPage:true});
const times=[0,.5,2,6,12],stages=['Inspect the release (0 s)','Inspect the response (0.5 s)','Inspect the response (2 s)','Inspect the response (6 s)','Inspect the final response (12 s)'];
const inspect=i=>page.getByRole('button',{name:stages[i],exact:true}).click();

// Independent force-vector integration; no production model imports.
function reference(v){
 const R=.5,H=.6,g=9.80665,L=Math.hypot(R,H),I=v.mass*R*R,referenceTension=v.preload/100*g*L/H,free=L-referenceTension/v.k,effective=v.k-v.mass*g/H,equilibriumLength=v.k*free/effective;
 const equilibrium=Math.asin((R*R+H*H-equilibriumLength**2)/(2*R*H)),angularStiffness=effective*(R*H*Math.cos(equilibrium)/equilibriumLength)**2,c=2*v.damping*Math.sqrt(I*angularStiffness);
 function physical(q){const [theta,w]=q,x=R*Math.cos(theta),y=R*Math.sin(theta),length=Math.hypot(x,H-y),extension=length-free,tension=v.k*extension,fx=-tension*x/length,fy=tension*(H-y)/length,springTorque=x*fy-y*fx,gravityTorque=-v.mass*g*x,dampingTorque=-c*w;return {theta,w,x,y,length,extension,tension,springTorque,gravityTorque,dampingTorque,netTorque:springTorque+gravityTorque+dampingTorque,energy:.5*I*w*w+.5*effective*(length-equilibriumLength)**2};}
 const derivative=q=>{const s=physical(q);return [q[1],s.netTorque/I,c*q[1]**2];};
 const add=(q,k,h)=>q.map((x,i)=>x+h*k[i]);
 function step(q,h){const a=derivative(q),b=derivative(add(q,a,h/2)),c=derivative(add(q,b,h/2)),d=derivative(add(q,c,h));return q.map((x,i)=>x+h*(a[i]+2*b[i]+2*c[i]+d[i])/6);}
 let q=[v.release*Math.PI/180,0,0],peak=Math.abs(q[0]-equilibrium),elapsed=0;const initial=physical(q),rows=[];
 for(const time of times){while(elapsed<time){const h=Math.min(1/4096,time-elapsed);q=step(q,h);elapsed+=h;peak=Math.max(peak,Math.abs(q[0]-equilibrium));}const s=physical(q);rows.push({...s,time,loss:q[2],peak,equilibrium,equilibriumLength,free,referenceTension,initialTension:initial.tension,initialEnergy:initial.energy,equilibriumTension:v.mass*g*equilibriumLength/H,c,period:2*Math.PI*Math.sqrt(I/angularStiffness)});}
 return rows;
}
async function preset(i){await page.getByRole('tab',{name:'Try it yourself',exact:true}).click();await page.getByRole('button',{name:'Set up this experiment',exact:true}).nth(i).click();await page.getByRole('tab',{name:'Controls',exact:true}).click();for(const [key,n] of Object.entries(lesson.tryIt[i].values))assert.equal(Number(await control(key).inputValue()),n);near(await value('Observation time'),0);near(await value('Recording duration'),0);near(await value('Angular velocity'),0);}
async function response(v,s){
 const degrees=180/Math.PI,expected={'Pendulum angle':s.theta*degrees,'Equilibrium angle':s.equilibrium*degrees,'Angle from equilibrium':(s.theta-s.equilibrium)*degrees,'Angular velocity':s.w*degrees,'Vertical mass position':s.y*1000,'Spring length':s.length,'Spring free length':s.free,'Spring extension':s.extension*1000,'Spring stiffness':v.k,'Horizontal reference tension':s.referenceTension,'Initial spring tension':s.initialTension,'Spring tension':s.tension,'Equilibrium spring tension':s.equilibriumTension,'Supported mass':v.mass,'Mass weight':v.mass*9.80665,'Spring torque':s.springTorque,'Gravity torque':s.gravityTorque,'Damping torque':s.dampingTorque,'Net torque':s.netTorque,'Damping coefficient':s.c,'Local natural period':s.period,'Local natural frequency':1/s.period,'Energy above equilibrium':s.energy,'Energy removed by damping':s.loss,'Peak angle from equilibrium':s.peak*degrees,'Recording duration':s.time,'Observation time':s.time,'Observation progress':s.time/12*100};
 const actual={};for(const [label,n] of Object.entries(expected)){actual[label]=await value(label);near(actual[label],n,label==='Observation progress'?.051:label==='Recording duration'||label==='Observation time'?.00051:rounding(actual[label])+(label==='Peak angle from equilibrium'?.00005:label.startsWith('Energy ')?1e-8:.000003));}
 near(actual['Energy above equilibrium']+actual['Energy removed by damping'],s.initialEnergy,rounding(actual['Energy above equilibrium'])+rounding(actual['Energy removed by damping'])+1e-8);assert.ok(actual['Spring extension']>100);assert.ok(actual['Spring tension']>3.69);
 await page.locator('[data-labels]').check();for(const id of ['spring','mass','boom','damper','record'])assert.ok(await page.locator(`button[data-label-part="${id}"]`).isVisible(),`${id} label available`);await page.locator('[data-labels]').uncheck();
 return actual;
}
try{
 await page.goto(`${process.env.SITE_URL||'http://127.0.0.1:4177/'}#machine/vertical-seismograph-suspension-spring`);await page.getByRole('heading',{name:'Vertical-seismograph suspension spring',exact:true}).waitFor();assert.equal(await page.locator('[data-control]').count(),5);await shot('initial');
 const trials=[],references=lesson.tryIt.map(x=>reference(x.values));assert.equal(lesson.tryIt.length,11);
 for(let i=0;i<11;i++){await preset(i);const rows=[];for(let j=0;j<times.length;j++){await inspect(j);rows.push(await response(lesson.tryIt[i].values,references[i][j]));if(i===0)await shot('stage-'+j);}trials.push(rows);await shot('experiment-'+i);console.log(`PASS experiment ${i+1}: ${lesson.tryIt[i].title}`);}
 const end=i=>trials[i].at(-1),start=i=>trials[i][0];
 for(const row of trials[1]){near(row['Pendulum angle'],0);near(row['Energy above equilibrium'],0);near(row['Spring tension'],12.7653974974,rounding(row['Spring tension'])+1e-12);}
 assert.ok(end(2)['Local natural period']>end(0)['Local natural period']);assert.ok(end(3)['Local natural period']<end(0)['Local natural period']);
 assert.ok(end(4)['Equilibrium angle']>3.9);assert.ok(end(5)['Equilibrium angle']<-4);assert.ok(end(4)['Equilibrium spring tension']<end(0)['Equilibrium spring tension']);assert.ok(start(4)['Horizontal reference tension']>start(0)['Horizontal reference tension']);
 assert.ok(end(6)['Equilibrium angle']<-4.2);assert.ok(end(7)['Equilibrium angle']>3.8);near(start(6)['Spring free length'],start(7)['Spring free length']);assert.equal(start(8)['Pendulum angle'],-5);
 near(end(9)['Energy above equilibrium'],start(9)['Energy above equilibrium'],1e-8);near(end(9)['Energy removed by damping'],0);assert.ok(Math.abs(end(9)['Pendulum angle'])>3);assert.ok(Math.abs(end(9)['Angular velocity'])>1);await preset(0);await inspect(4);assert.equal(await reading('Energy above equilibrium'),'< 1 nJ','finite positive residual is shown as a bound, not exact rest');
 await preset(0);await page.locator('[data-step]').click();near(await value('Observation time'),.12);await play();await frames();await play();const paused=await page.locator('.daily-readings').textContent();await frames();assert.equal(await page.locator('.daily-readings').textContent(),paused);
 await page.getByRole('button',{name:'Reset experiment',exact:true}).click();await play();await finished();await response(lesson.tryIt[0].values,references[0][4]);await page.locator('[data-result]').click();await shot('result');await play();await frames();await play();assert.ok(await value('Observation time')<12);assert.ok(await value('Recording duration')<12);
 for(const [key,n] of [['k','45'],['preload','105'],['mass','1.05'],['release','-5'],['damping','0']]){await inspect(4);await number(key).fill(n);near(await value('Observation time'),0);near(await value('Recording duration'),0);near(await value('Angular velocity'),0);}
 await page.getByRole('button',{name:'Reset experiment',exact:true}).click();for(const [key,n] of Object.entries(lesson.tryIt[0].values))assert.equal(Number(await control(key).inputValue()),n);await number('k').focus();await page.keyboard.press('ArrowUp');assert.equal(Number(await number('k').inputValue()),45);
 await preset(9);await inspect(4);const retained=await page.locator('.daily-readings').textContent();await page.getByRole('button',{name:'Inspect the spring',exact:true}).click();assert.equal(await page.locator('.daily-readings').textContent(),retained);await shot('spring-detail');await page.getByRole('button',{name:'Inspect the response record',exact:true}).click();assert.equal(await page.locator('.daily-readings').textContent(),retained);await shot('retained-record');
 await page.getByRole('button',{name:lesson.quiz.options[lesson.quiz.answer],exact:true}).click();await page.getByText(/That’s right/).waitFor();await page.setViewportSize({width:390,height:844});await preset(9);await inspect(4);await response(lesson.tryIt[9].values,references[9][4]);assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));await shot('mobile-undamped');await preset(1);await inspect(4);await response(lesson.tryIt[1].values,references[1][4]);await shot('mobile-quiet');assert.deepEqual(errors,[]);
 const report={passed:true,trials,checks:'11 presets at 5 stages; independent literal-force RK4; exact support and restoring geometry; reference/initial/current/equilibrium tensions; preload and load response; stiffness/free-length retuning; conservative and dissipative energy; nonzero finite endpoint; five control resets; causal recording; label availability; autoplay/pause/step/reset/replay/result; keyboard; quiz; detail and phone'};await writeFile(new URL('browser-results.json',evidence),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({passed:true,experiments:11,checks:report.checks},null,2));
}finally{await browser.close();}

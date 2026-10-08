import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {chromium} from 'playwright';
import {carIgnitionLesson as lesson} from './car-ignition-lesson.js';
import {createCarIgnitionModel} from './car-ignition-model.js';

const expected=createCarIgnitionModel(),browser=await chromium.launch({headless:true}),page=await browser.newPage({viewport:{width:1440,height:1000},hasTouch:true,reducedMotion:'reduce'}),errors=[],consoleErrors=[],controls=[],inspections=[],parts=[],frames=[];page.setDefaultTimeout(40000);
const evidence=process.env.EVIDENCE_DIR?pathToFileURL(resolve(process.env.EVIDENCE_DIR)+'/'):new URL('../../documentation/audit/evidence/car-ignition/',import.meta.url);await mkdir(evidence,{recursive:true});
page.on('pageerror',e=>errors.push(e.message));page.on('console',message=>{if(message.type()==='error')consoleErrors.push(message.text());});
await page.addInitScript(()=>{
 window.ignitionMatrices={};
 for(const name of ['WebGLRenderingContext','WebGL2RenderingContext']){const proto=window[name]?.prototype;if(!proto)continue;const names=new WeakMap(),get=proto.getUniformLocation,write=proto.uniformMatrix4fv;proto.getUniformLocation=function(program,name){const location=get.call(this,program,name);if(location)names.set(location,name);return location;};proto.uniformMatrix4fv=function(location,transpose,data,...rest){if(names.get(location)==='modelViewMatrix')window.ignitionMatrices.modelView=Array.from(data);return write.call(this,location,transpose,data,...rest);};}
});
const canvas=page.locator('canvas'),action=name=>page.getByRole('button',{name,exact:true}).click();
const readings=()=>page.locator('.daily-readings > div').evaluateAll(rows=>Object.fromEntries(rows.map(row=>[row.querySelector('dt').textContent,row.querySelector('dd').textContent])));
const compare=async()=>{const actual=await readings();assert.deepEqual(actual,Object.fromEntries(expected.getState().readings.map(row=>[row.label,row.value])));return actual;};
const reset=async()=>{await action('Reset experiment');expected.reset();await compare();};
const steps=async count=>{await page.locator('[data-step]').evaluate((button,count)=>{for(let i=0;i<count;i++)button.click();},count);for(let i=0;i<count;i++)expected.playback.step();await compare();};
async function focus(id){await action('Whole machine');const chain=[];let part=expected.parts.find(part=>part.id===id);while(part){chain.unshift(part.id);part=expected.parts.find(candidate=>candidate.id===part.parentId);}for(const key of chain)await page.locator(`[data-part="${key}"]`).click();await page.locator('[data-isolate]').check();await action('Front');}
async function canvasShot(name){await canvas.scrollIntoViewIfNeeded();await page.mouse.move(4,4);await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));await canvas.screenshot({path:new URL(name+'.png',evidence).pathname});frames.push(name);}
async function hit(name){await canvas.scrollIntoViewIfNeeded();const box=await canvas.boundingBox(),popup=page.locator('.daily-part-popup');for(let y=1;y<20;y++)for(let x=1;x<20;x++){const point=[box.x+box.width*x/20,box.y+box.height*y/20];await page.mouse.move(...point);if(await popup.isVisible()&&await popup.innerText()===name)return point;}assert.fail('No physical pointer target for '+name);}

const reading=label=>page.locator('.daily-readings > div').filter({has:page.getByText(label,{exact:true})}).locator('dd').textContent();
const value=async label=>parseFloat(await reading(label));
const control=key=>page.locator(`[data-control="${key}"]`);
const number=key=>page.locator(`[data-number="${key}"]`);
// Readings show three significant figures and 0 below a millionth, so a shown value is good to half a unit in its third figure.
const shown=x=>x===0?1e-6:.5*10**(Math.floor(Math.log10(Math.abs(x)))-2);
const near=(actual,expected,tolerance=.02)=>assert.ok(Math.abs(actual-expected)<=tolerance+shown(actual)+shown(expected),`${actual} differs from ${expected}`);
const run=()=>page.locator('[data-play]').click();
const finished=()=>page.waitForFunction(()=>document.querySelector('[data-play]')?.getAttribute('aria-pressed')==='false',null,{timeout:90000});
const shot=async name=>{await page.screenshot({path:new URL(name+'.png',evidence).pathname,fullPage:true});await canvasShot(name+'-canvas');};
async function energy(label){const text=await reading(label),n=parseFloat(text);assert.ok(Number.isFinite(n),`${label}: ${text}`);return /mJ/.test(text)?n/1000:n;}
async function preset(i,mobile=false){
 const tools=page.getByRole('navigation',{name:'Lesson tools'});await (mobile?tools.getByRole('button',{name:'Try it yourself',exact:true}):page.getByRole('tab',{name:'Try it yourself',exact:true})).click();await page.getByRole('button',{name:'Set up this experiment',exact:true}).nth(i).click();await (mobile?tools.getByRole('button',{name:'Controls',exact:true}):page.getByRole('tab',{name:'Controls',exact:true})).click();expected.reset();expected.update(lesson.tryIt[i].values);await compare();
 for(const [key,n] of Object.entries(lesson.tryIt[i].values))assert.equal(Number(await control(key).inputValue()),n);
 assert.equal(await value('Observation progress'),0);assert.equal(await value('Spark events'),0);near(await energy('Total battery work'),0,1e-8);
}
async function outcome(){
 const e={};for(const label of ['Stored magnetic energy','Stored capacitor energy','Ignition battery work','Winding heat','Points heat','Delivered spark energy','Solenoid energy','Starter energy','Total battery work'])e[label]=await energy(label);
 const plugs=[];for(const label of ['A','B','C','D'])plugs.push(await energy(`Plug ${label} energy`));
 near(plugs.reduce((a,b)=>a+b,0),e['Delivered spark energy'],.00002+plugs.reduce((a,b)=>a+shown(b),0));
 const sum=labels=>labels.reduce((a,label)=>a+e[label],0),slack=labels=>labels.reduce((a,label)=>a+shown(e[label]),0);
 const ignition=['Stored magnetic energy','Stored capacitor energy','Winding heat','Points heat','Delivered spark energy'],total=['Ignition battery work','Solenoid energy','Starter energy'];
 near(e['Ignition battery work'],sum(ignition),.00005+slack(ignition));
 near(e['Total battery work'],sum(total),.00005+slack(total));
 near(await value('Observation progress'),100);
 return {energy:e,plugs,events:await value('Spark events'),sequence:await reading('Spark sequence'),angle:await value('Shaft angle'),control:await value('Solenoid current'),starter:await value('Starter current')};
}
try{
 await page.goto(`${process.env.SITE_URL||'http://127.0.0.1:4177/'}#machine/car-ignition-system`);await page.getByRole('heading',{name:'Car ignition system',exact:true}).waitFor();await page.locator('.daily-readings').waitFor();await canvas.waitFor({timeout:120000});assert(await canvas.evaluate(element=>!!element.getContext('webgl2')));
 assert.equal(await page.locator('[data-control]').count(),4);assert.equal(await page.locator('[data-number]').count(),2);assert.equal(await page.locator('select[data-control]').count(),2);await shot('initial');
 const outcomes=[];
 for(let i=0;i<lesson.tryIt.length;i++){
  await preset(i);
  if(i===0){
   await page.locator('[data-step]').click();assert.ok(await value('Observation progress')>0);assert.ok(await energy('Ignition battery work')>0);assert.equal(await value('Spark events'),0);
   await run();await page.waitForTimeout(250);await run();const held=await page.locator('.daily-readings').textContent();await page.waitForTimeout(250);assert.equal(await page.locator('.daily-readings').textContent(),held);await shot('paused-charge');
  }
  await run();await finished();outcomes.push(await outcome());await shot('experiment-'+i);console.log(`PASS experiment ${i+1}: ${lesson.tryIt[i].title}`);
 }
 assert.equal(outcomes[0].events,8);assert.equal(outcomes[1].events,5);assert.equal(outcomes[2].events,4);assert.ok(outcomes[0].plugs.every(e=>e>0));
 near(outcomes[0].energy['Delivered spark energy'],.319859766,.000005);near(outcomes[1].energy['Delivered spark energy'],.067901288,.000005);near(outcomes[2].energy['Delivered spark energy'],.139749688,.000005);
 assert.ok(outcomes[1].energy['Delivered spark energy']<outcomes[0].energy['Delivered spark energy']);assert.ok(outcomes[2].energy['Delivered spark energy']<outcomes[0].energy['Delivered spark energy']);
 for(const i of [3,4,6,7,8]){assert.equal(outcomes[i].events,0);near(outcomes[i].energy['Delivered spark energy'],0,1e-8);}
 assert.ok(outcomes[4].energy['Stored magnetic energy']>0);assert.equal(outcomes[0].starter,0);near(outcomes[5].control,.5,.00001);near(outcomes[5].starter,40,.00001);near(outcomes[6].control,.125,.00001);assert.equal(outcomes[6].starter,0);assert.equal(outcomes[6].angle,0);
 near(outcomes[5].energy['Solenoid energy'],.6,.00002);near(outcomes[5].energy['Starter energy'],48,.00002);
 for(const i of [7,8])near(outcomes[i].energy['Total battery work'],0,1e-8);
 await preset(0);await run();await finished();await page.locator('[data-result]').click();await shot('result');await run();await page.waitForTimeout(150);await run();assert.ok(await value('Observation progress')<100);assert.equal(await value('Spark events'),0);
 for(const [key,next] of [['voltage','9'],['rpm','120'],['key','2'],['points','2']]){
  await page.locator('[data-step]').click();assert.ok(await value('Observation progress')>0);
  if(key==='key'||key==='points')await control(key).selectOption(next);else await number(key).fill(next);
  assert.equal(await value('Observation progress'),0);assert.equal(await value('Spark events'),0);near(await energy('Total battery work'),0,1e-8);
 }
 await page.getByRole('button',{name:'Reset experiment',exact:true}).click();for(const [key,n] of Object.entries(lesson.tryIt[0].values))assert.equal(Number(await control(key).inputValue()),n);
 await number('voltage').focus();await page.keyboard.press('ArrowDown');assert.equal(Number(await number('voltage').inputValue()),9);
 for(const index of [0,3,5,6,7]){await preset(index);for(let i=1;i<expected.actions.length;i++){await page.locator(`[data-action="${i}"]`).click();expected.actions[i].run();const result=await compare();assert.equal(await page.locator('.daily-part-detail h3').innerText(),expected.parts.find(part=>part.id===expected.actions[i].part).name);assert.equal(await page.locator('[data-play]').getAttribute('aria-pressed'),'false');await canvasShot(`inspection-${index}-${i}`);inspections.push({preset:index,action:expected.actions[i].label,readings:result});}}
 for(const spec of expected.controls){const choices=spec.options?spec.options.map(option=>option.value):Array.from({length:Math.round((spec.max-spec.min)/spec.step)+1},(_,i)=>spec.min+i*spec.step);for(const choice of choices){await reset();if(spec.options)await control(spec.key).selectOption(String(choice));else{await number(spec.key).fill(String(choice));await number(spec.key).press('Tab');}expected.update({[spec.key]:choice});await compare();await steps(100);controls.push({key:spec.key,value:choice,readings:await compare()});}}
 await preset(5);await steps(18);
 for(const part of expected.parts){await focus(part.id);assert.equal(await page.locator('.daily-part-detail h3').innerText(),part.name);await compare();await canvasShot('part-'+part.id);parts.push({id:part.id,name:part.name});}
 await action('Whole machine');await page.locator('[data-isolate]').uncheck();
 for(const view of ['Front','Side','Back','Top','Underneath','Angled']){await action(view);await canvasShot('view-'+view.toLowerCase());}
 await page.locator('[data-view="reset"]').click();await page.locator('[data-separation]').fill('100');await canvasShot('separated');await page.locator('[data-reassemble]').click();await compare();
 await focus('battery');const point=await hit('Battery and body reference');await page.mouse.click(...point);assert.equal(await page.locator('.daily-part-popup').innerText(),'Battery and body reference');
 await page.mouse.move(4,4);await canvas.screenshot();const before=await page.evaluate(()=>window.ignitionMatrices.modelView);assert.equal(before.length,16);
 await page.mouse.move(...point);await page.mouse.down();await page.mouse.move(point[0]+30,point[1]+18,{steps:8});await page.mouse.up();await page.mouse.move(4,4);await canvas.screenshot();const after=await page.evaluate(()=>window.ignitionMatrices.modelView);
 for(const i of [0,1,2,4,5,6,8,9,10])assert(Math.abs(before[i]-after[i])<1e-7,'Object drag preserves rotation');assert(Math.hypot(...[12,13,14].map(i=>after[i]-before[i]))>.01,'Object drag translates');await canvasShot('object-drag');
 await action('Whole machine');await canvas.scrollIntoViewIfNeeded();let box=await canvas.boundingBox();await page.mouse.move(box.x+15,box.y+15);assert.equal(await page.locator('.daily-part-popup').isVisible(),false);const rotationBefore=await canvas.screenshot();await page.mouse.down();await page.mouse.move(box.x+90,box.y+55,{steps:8});await page.mouse.up();assert(!rotationBefore.equals(await canvas.screenshot()));await canvasShot('background-rotation');
 await page.locator('[data-view="reset"]').click();const zoomBefore=await canvas.screenshot();await page.locator('[data-view="in"]').click();assert(!zoomBefore.equals(await canvas.screenshot()));assert.equal(await page.locator('[data-separation]').inputValue(),'0');await page.locator('[data-view="out"]').click();
 await canvas.focus();const keyboardBefore=await canvas.screenshot();await page.keyboard.press('ArrowRight');assert(!keyboardBefore.equals(await canvas.screenshot()));const rotateMatrix=await page.evaluate(()=>window.ignitionMatrices.modelView);await page.keyboard.press('Shift+ArrowUp');await canvas.screenshot();const moveMatrix=await page.evaluate(()=>window.ignitionMatrices.modelView);for(const i of [0,1,2,4,5,6,8,9,10])assert(Math.abs(rotateMatrix[i]-moveMatrix[i])<1e-7);assert(Math.hypot(...[12,13,14].map(i=>moveMatrix[i]-rotateMatrix[i]))>.01);await page.keyboard.press('Home');assert.equal(await page.locator('.daily-part-detail h3').count(),0);await compare();
 await canvas.scrollIntoViewIfNeeded();box=await canvas.boundingBox();await page.mouse.move(box.x+box.width/2,box.y+box.height/2);for(let i=0;i<8&&Number(await page.locator('[data-separation]').inputValue())===0;i++){await page.mouse.wheel(0,120);await page.waitForTimeout(50);}assert(Number(await page.locator('[data-separation]').inputValue())>0);await canvasShot('wheel-separated');await page.locator('[data-reassemble]').click();
 await page.locator('[data-labels]').check();await page.locator('button[data-label-part="starter-circuit"]').click();await page.locator('[data-isolate]').check();assert.equal(await page.locator('.daily-part-detail h3').innerText(),'Solenoid and separate starter circuit');await canvasShot('labels-starter');await page.keyboard.press('Escape');assert.equal(await page.locator('.daily-part-detail h3').count(),0);await page.locator('button[data-label-part="starter-circuit"]').click();await page.locator('.daily-heading h1').click();assert.equal(await page.locator('.daily-part-detail h3').count(),0);await page.locator('[data-labels]').uncheck();
 for(const width of [390,320]){await page.setViewportSize({width,height:width===390?844:568});await page.reload();await canvas.waitFor({timeout:120000});expected.reset();await compare();await canvasShot('mobile-opening-'+width);for(let i=0;i<lesson.tryIt.length;i++){await preset(i,true);await steps(100);await canvasShot(`mobile-completed-${i}-${width}`);}await page.locator('[data-view="reset"]').click();await shot('mobile-'+width);assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));await page.getByRole('navigation',{name:'Lesson tools'}).getByRole('button',{name:'Controls',exact:true}).click();await page.locator('[data-step]').click();await page.screenshot({path:new URL(`mobile-controls-${width}.png`,evidence).pathname});}
 const touch=await page.context().newCDPSession(page);async function pinch(from,to){await canvas.scrollIntoViewIfNeeded();const b=await canvas.boundingBox(),x=b.x+b.width/2,y=b.y+b.height/2,points=distance=>[{x:x-distance,y,id:0},{x:x+distance,y,id:1}];await touch.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:points(from)});for(let i=1;i<=12;i++)await touch.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:points(from+(to-from)*i/12)});await touch.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});}try{await pinch(100,15);assert(Number(await page.locator('[data-separation]').inputValue())>0);await canvasShot('pinch-separated');await pinch(15,100);await page.waitForFunction(()=>document.querySelector('[data-separation]').value==='0');}finally{await touch.detach();}
 await page.setViewportSize({width:1440,height:1000});await preset(0);for(const [index] of lesson.quiz.options.entries()){await page.locator('[data-answer]').nth(index).click();assert.equal(await page.locator('.daily-answer').innerText(),(index===lesson.quiz.answer?'That’s right. ':'Try thinking through the parts again. ')+lesson.quiz.explanation);}await page.getByText('Learn more',{exact:true}).click();for(const source of lesson.sources)assert.equal(await page.locator(`.daily-lesson a[href="${source.url}"]`).innerText(),source.title);
 await compare();assert.deepEqual(errors,[]);assert.deepEqual(consoleErrors,[]);await writeFile(new URL('browser.json',evidence),JSON.stringify({passed:true,outcomes,controls,inspections,parts,frames,errors,consoleErrors,objectDrag:{before,after},pause:true,replay:true,keyboard:true,wheel:true,labels:true,dismissal:true,pinch:true,mobileWidths:[390,320],nativeCombinations:450},null,2));
 console.log(JSON.stringify({passed:true,outcomes,checks:'nine complete presets; four controls; charge and actual spark records; plug and total energy balance; voltage/dwell/points/start/off/zero-source comparisons; pause/step/reset/edit/replay/result/keyboard/quiz/mobile'},null,2));
}catch(error){await writeFile(new URL('failure.json',evidence),JSON.stringify({message:error.message,errors,consoleErrors,controls,inspections,parts,frames,url:page.url()},null,2));await page.screenshot({path:new URL('failure.png',evidence).pathname,fullPage:true}).catch(()=>{});throw error;}finally{expected.dispose();await browser.close();}

import assert from 'node:assert/strict';
import {mkdir, writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {chromium} from 'playwright';
import {hairDryerLesson as lesson} from './element-lessons.js';
import {createHairDryerModel} from './hair-dryer-model.js';

const expected=createHairDryerModel(), browser=await chromium.launch({headless:true});
const page=await browser.newPage({viewport:{width:1440,height:1000},hasTouch:true,reducedMotion:'reduce'});
const errors=[], consoleErrors=[], controls=[], frames=[], outcomes=[], inspections=[], interaction={};
const evidence=pathToFileURL(resolve(process.env.EVIDENCE_DIR||'documentation/audit/evidence/hair-dryer')+'/');
await mkdir(evidence,{recursive:true}); page.setDefaultTimeout(40000);
page.on('pageerror',e=>errors.push(e.message)); page.on('console',m=>{if(m.type()==='error')consoleErrors.push(m.text());});
await page.addInitScript(()=>{window.dryerMatrices={};for(const name of ['WebGLRenderingContext','WebGL2RenderingContext']){const proto=window[name]?.prototype;if(!proto)continue;const names=new WeakMap(),get=proto.getUniformLocation,write=proto.uniformMatrix4fv;proto.getUniformLocation=function(program,name){const location=get.call(this,program,name);if(location)names.set(location,name);return location;};proto.uniformMatrix4fv=function(location,transpose,data,...rest){if(names.get(location)==='modelViewMatrix')window.dryerMatrices.modelView=Array.from(data);return write.call(this,location,transpose,data,...rest);};}});
const canvas=page.locator('canvas:visible'), action=name=>page.getByRole('button',{name,exact:true}).click();
const readings=()=>page.locator('.daily-readings > div').evaluateAll(rows=>Object.fromEntries(rows.map(row=>[row.querySelector('dt').textContent,row.querySelector('dd').textContent])));
async function compare(){const actual=await readings();assert.deepEqual(actual,Object.fromEntries(expected.getState().readings.map(row=>[row.label,row.value])));return actual;}
const nextFrames=()=>page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))));
async function canvasShot(name){await canvas.scrollIntoViewIfNeeded();await page.mouse.move(4,4);await nextFrames();await canvas.screenshot({path:new URL(name+'.png',evidence).pathname});frames.push(name);}
async function shot(name){await page.screenshot({path:new URL(name+'.png',evidence).pathname,fullPage:true});await canvasShot(name+'-canvas');}
async function steps(count){await page.locator('[data-step]').evaluate((button,n)=>{for(let i=0;i<n;i++)button.click();},count);for(let i=0;i<count;i++)expected.playback.step();return compare();}
const finishSteps=()=>steps(Math.ceil((expected.getState().duration-expected.getState().clock)));
const number=key=>page.locator(`[data-number="${key}"]`), control=key=>page.locator(`[data-control="${key}"]`);
async function reset(){await action('Reset experiment');expected.reset();return compare();}
async function set(key,next){if(expected.controls.find(c=>c.key===key).options)await control(key).selectOption(String(next));else{await number(key).fill(String(next));await number(key).press('Tab');}expected.update({[key]:next});return compare();}
async function preset(i,mobile=false){
 const tools=page.getByRole('navigation',{name:'Lesson tools'});
 await (mobile?tools.getByRole('button',{name:'Try it yourself',exact:true}):page.getByRole('tab',{name:'Try it yourself',exact:true})).click();
 await page.getByRole('button',{name:'Set up this experiment',exact:true}).nth(i).click();
 await (mobile?tools.getByRole('button',{name:'Controls',exact:true}):page.getByRole('tab',{name:'Controls',exact:true})).click();
 expected.reset();expected.update(lesson.tryIt[i].values);await compare();
 for(const [key,n]of Object.entries(lesson.tryIt[i].values))assert.equal(Number(await control(key).inputValue()),n);
 assert.equal(await page.locator('[data-isolate]').isChecked(),lesson.tryIt[i].isolate);
 assert.match((await readings())['Your result'],/Ready · main switch open/);
}
async function inspect(index){await action(expected.actions[index].label);expected.actions[index].run();return compare();}
async function hit(name){await canvas.scrollIntoViewIfNeeded();const box=await canvas.boundingBox(),popup=page.locator('.daily-part-popup');for(const [x,y] of Array.from({length:72},(_,i)=>[.2+(i%9)*.075,.2+Math.floor(i/9)*.075])){const point=[box.x+box.width*x,box.y+box.height*y];await page.mouse.move(...point);if(await popup.isVisible()&&await popup.innerText()===name)return point;}assert.fail('No physical target surface for '+name);}
const play=()=>page.locator('[data-play]').click();
const finished=()=>page.waitForFunction(()=>document.querySelector('[data-play]')?.getAttribute('aria-pressed')==='false',null,{timeout:90000});
try{
 await page.goto(`${process.env.SITE_URL||'http://127.0.0.1:5215/'}#machine/hair-dryer`);
 await page.getByRole('heading',{name:'Hair dryer',exact:true}).waitFor();await canvas.waitFor({timeout:120000});
 assert(await canvas.evaluate(e=>!!e.getContext('webgl2')));assert.equal(await control('volts').count(),1);assert.equal(await page.locator('[data-control]').count(),4);assert.equal(await page.locator('[data-number]').count(),3);
 await compare();await shot('initial');
 for(let i=1;i<=4;i++){await steps(1);await canvasShot('warming-step-'+i);}
 await reset();await play();await page.waitForFunction(()=>document.querySelector('.daily-readings')?.textContent.includes('Drying ·'));await play();
 assert.equal(await page.locator('[data-play]').getAttribute('aria-pressed'),'false');await page.mouse.move(4,4);const held=await canvas.screenshot();await nextFrames();assert(held.equals(await canvas.screenshot()),'paused dryer stays fixed');
 for(let i=0;i<lesson.tryIt.length;i++){
  await preset(i);await play();await finished();expected.advance(1e4);await compare();
  outcomes.push({title:lesson.tryIt[i].title,readings:await readings()});await shot('experiment-'+i);await action('Whole machine');await page.locator('[data-isolate]').uncheck();await canvasShot('experiment-'+i+'-system');console.log(`PASS autoplay ${i+1}: ${lesson.tryIt[i].title}`);
 }
 assert.equal(outcomes[0].readings['Water remaining'],'0.000 g');assert.equal(outcomes[3].readings['Water remaining'],'0.350 g');assert.equal(outcomes[4].readings['Water remaining'],'0.099 g');assert.equal(outcomes[5].readings['Heater circuit'],'Off · 0 W');
 await preset(0);await finishSteps();await page.locator('[data-result]').click();await canvasShot('result');await play();
 await page.waitForFunction(()=>document.querySelector('[data-play]')?.getAttribute('aria-pressed')==='true'&&!document.querySelector('.daily-readings')?.textContent.includes('Ready ·'));
 await finished();expected.advance(1e4);await compare();
 for(const spec of expected.controls){
  const choices=Array.from({length:Math.round((spec.max-spec.min)/spec.step)+1},(_,i)=>Number((spec.min+i*spec.step).toFixed(10)));
  for(const choice of choices){await reset();await steps(4);await set(spec.key,choice);if(choice!==spec.initial)assert.match((await readings())['Your result'],/Ready · main switch open/);await finishSteps();controls.push({key:spec.key,value:choice,readings:await compare()});}
  console.log(`PASS control ${spec.key}: ${choices.length} values`);
 }
 await reset();await number('airflow').focus();await page.keyboard.press('ArrowDown');expected.update({airflow:34});await compare();
 await set('volts',999);assert.equal(await number('volts').inputValue(),'240');await reset();await finishSteps();
 for(let i=0;i<expected.actions.length;i++){await inspect(i);await canvasShot('inspection-'+expected.actions[i].part);inspections.push({part:expected.actions[i].part,readings:await compare()});}
 await action('Whole machine');await page.locator('[data-isolate]').uncheck();
 for(const view of ['Front','Side','Back','Top','Underneath','Angled']){await action(view);await canvasShot('view-'+view.toLowerCase());}
 await page.locator('[data-view="reset"]').click();await page.locator('[data-separation]').fill('100');await canvasShot('separated');await page.locator('[data-reassemble]').click();await compare();
 await page.locator('[data-view="reset"]').click();let point=await hit('Barrel, grip and grilles');await page.mouse.click(...point);assert.equal(await page.locator('.daily-part-popup').innerText(),'Barrel, grip and grilles');point=await hit('Barrel, grip and grilles');interaction.point=point;
 await page.mouse.move(4,4);await canvas.screenshot();const before=await page.evaluate(()=>window.dryerMatrices.modelView);assert.equal(before.length,16);
 await page.mouse.move(...point);await page.mouse.down();await page.mouse.move(point[0]+30,point[1]+18,{steps:8});await page.mouse.up();await page.mouse.move(4,4);await canvas.screenshot();const after=await page.evaluate(()=>window.dryerMatrices.modelView);
 Object.assign(interaction,{before,after});for(const i of [0,1,2,4,5,6,8,9,10])assert(Math.abs(before[i]-after[i])<1e-7,'object drag preserves rotation');assert(Math.hypot(...[12,13,14].map(i=>after[i]-before[i]))>.01,'object drag translates');await canvasShot('object-drag');
 await action('Whole machine');await canvas.scrollIntoViewIfNeeded();let box=await canvas.boundingBox();await page.mouse.move(box.x+15,box.y+15);assert.equal(await page.locator('.daily-part-popup').isVisible(),false);const rotationBefore=await canvas.screenshot();await page.mouse.down();await page.mouse.move(box.x+90,box.y+55,{steps:8});await page.mouse.up();assert(!rotationBefore.equals(await canvas.screenshot()));await canvasShot('background-rotation');
 await page.locator('[data-view="reset"]').click();const zoomBefore=await canvas.screenshot();await page.locator('[data-view="in"]').click();assert(!zoomBefore.equals(await canvas.screenshot()));assert.equal(await page.locator('[data-separation]').inputValue(),'0');await page.locator('[data-view="out"]').click();
 await canvas.focus();const keyboardBefore=await canvas.screenshot();await page.keyboard.press('ArrowRight');assert(!keyboardBefore.equals(await canvas.screenshot()));const rotateMatrix=await page.evaluate(()=>window.dryerMatrices.modelView);await page.keyboard.press('Shift+ArrowUp');await canvas.screenshot();const moveMatrix=await page.evaluate(()=>window.dryerMatrices.modelView);for(const i of [0,1,2,4,5,6,8,9,10])assert(Math.abs(rotateMatrix[i]-moveMatrix[i])<1e-7);assert(Math.hypot(...[12,13,14].map(i=>moveMatrix[i]-rotateMatrix[i]))>.01);await page.keyboard.press('Home');assert.equal(await page.locator('.daily-part-detail h3').count(),0);await compare();
 await canvas.scrollIntoViewIfNeeded();box=await canvas.boundingBox();await page.mouse.move(box.x+box.width/2,box.y+box.height/2);for(let i=0;i<8&&Number(await page.locator('[data-separation]').inputValue())===0;i++){await page.mouse.wheel(0,120);await page.waitForTimeout(50);}assert(Number(await page.locator('[data-separation]').inputValue())>0);await canvasShot('wheel-separated');await page.locator('[data-reassemble]').click();
 await page.locator('[data-labels]').check();await page.locator('button[data-label-part="insulation"]').click();assert.equal(await page.locator('.daily-part-detail h3').innerText(),'Mica supports');await canvasShot('labels-insulation');await page.keyboard.press('Escape');assert.equal(await page.locator('.daily-part-detail h3').count(),0);await page.locator('button[data-label-part="insulation"]').click();await page.locator('.daily-heading h1').click();assert.equal(await page.locator('.daily-part-detail h3').count(),0);await page.locator('[data-labels]').uncheck();
 for(const width of [390,320]){
  await page.setViewportSize({width,height:width===390?844:568});await page.reload();await canvas.waitFor({timeout:120000});expected.reset();await compare();await canvasShot('mobile-opening-'+width);
  for(let i=0;i<lesson.tryIt.length;i++){await preset(i,true);await finishSteps();await canvasShot(`mobile-completed-${i}-${width}`);}
  await page.locator('[data-view="reset"]').click();await shot('mobile-'+width);assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
  await page.getByRole('navigation',{name:'Lesson tools'}).getByRole('button',{name:'Controls',exact:true}).click();await page.screenshot({path:new URL(`mobile-controls-${width}.png`,evidence).pathname});
 }
 const touch=await page.context().newCDPSession(page);
 async function pinch(from,to){await canvas.scrollIntoViewIfNeeded();const b=await canvas.boundingBox(),x=b.x+b.width/2,y=b.y+b.height/2,points=d=>[{x:x-d,y,id:0},{x:x+d,y,id:1}];await touch.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:points(from)});for(let i=1;i<=12;i++)await touch.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:points(from+(to-from)*i/12)});await touch.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});}
 try{await pinch(100,15);assert(Number(await page.locator('[data-separation]').inputValue())>0);await canvasShot('pinch-separated');await pinch(15,100);await page.waitForFunction(()=>document.querySelector('[data-separation]').value==='0');}finally{await touch.detach();}
 await page.setViewportSize({width:1440,height:1000});await preset(0);
 for(const [index]of lesson.quiz.options.entries()){await page.locator('[data-answer]').nth(index).click();assert.equal(await page.locator('.daily-answer').innerText(),(index===lesson.quiz.answer?'That’s right. ':'Try thinking through the parts again. ')+lesson.quiz.explanation);}
 await page.getByText('Learn more',{exact:true}).click();for(const source of lesson.sources)assert.equal(await page.locator(`.daily-lesson a[href="${source.url}"]`).innerText(),source.title);
 await compare();assert.deepEqual(errors,[]);assert.deepEqual(consoleErrors,[]);
 await writeFile(new URL('browser.json',evidence),JSON.stringify({passed:true,outcomes,controls,frames,inspections,errors,consoleErrors,objectDrag:{before,after},pause:true,replay:true,keyboard:true,labels:true,wheel:true,pinch:true,mobileWidths:[390,320]},null,2));
 console.log(JSON.stringify({passed:true,experiments:outcomes.length,controlValues:controls.length,frames:frames.length,inspections:inspections.length}));
}catch(error){await writeFile(new URL('failure.json',evidence),JSON.stringify({message:error.message,errors,consoleErrors,controls,frames,inspections,interaction,url:page.url()},null,2));await page.screenshot({path:new URL('failure.png',evidence).pathname,fullPage:true}).catch(()=>{});throw error;}finally{expected.dispose();await browser.close();}

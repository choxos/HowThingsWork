import assert from 'node:assert/strict';
import {mkdir, writeFile} from 'node:fs/promises';
import {chromium} from 'playwright';
import {createTanklessHeaterModel} from './tankless-heater-model.js';
import {tanklessHeaterLesson as lesson} from './tankless-heater-lesson.js';

const base = process.env.SITE_URL || 'http://127.0.0.1:5215/';
const output = process.env.EVIDENCE_DIR || 'documentation/heater-browser';
await mkdir(output, {recursive:true});
const expected = createTanklessHeaterModel(), browser = await chromium.launch({channel:'chrome',headless:true});
const page = await browser.newPage({viewport:{width:1440,height:1000},hasTouch:true,reducedMotion:'reduce'});
page.setDefaultTimeout(40000);
const errors = [], consoleErrors = [], presets = [], controls = [], combinations = [], parts = [], frames = [], histories = [];
page.on('pageerror', error => errors.push(error.message));
page.on('console', message => {if (message.type() === 'error') consoleErrors.push(message.text());});
await page.addInitScript(() => {
  window.heaterMatrices = {};
  for (const name of ['WebGLRenderingContext','WebGL2RenderingContext']) {
    const proto = window[name]?.prototype;if (!proto) continue;
    const names = new WeakMap(), get = proto.getUniformLocation, write = proto.uniformMatrix4fv;
    proto.getUniformLocation = function(program, name) {const location = get.call(this,program,name);if (location) names.set(location,name);return location;};
    proto.uniformMatrix4fv = function(location, transpose, data, ...rest) {if (names.get(location) === 'modelViewMatrix') window.heaterMatrices.modelView = Array.from(data);return write.call(this,location,transpose,data,...rest);};
  }
});
const canvas = page.locator('canvas'), action = name => page.getByRole('button',{name,exact:true}).click();
const values = () => page.locator('.daily-readings > div').evaluateAll(rows => Object.fromEntries(rows.map(row => [row.querySelector('dt').textContent,row.querySelector('dd').textContent])));
const compare = async () => {const actual = await values();assert.deepEqual(actual,Object.fromEntries(expected.getState().readings.map(row => [row.label,row.value])));return actual;};
const reset = async () => {await action('Reset experiment');expected.reset();await compare();};
const steps = async count => {await page.locator('[data-step]').evaluate((button,count) => {for (let i=0;i<count;i++) button.click();},count);for(let i=0;i<count;i++) expected.playback.step();await compare();};
const edit = async (key,value) => {await page.locator(`[data-control="${key}"]`).selectOption(String(value));expected.update({[key]:value});await compare();};
async function preset(index, mobile=false) {
  if (mobile) await page.getByRole('navigation',{name:'Lesson tools'}).getByRole('button',{name:'Try it yourself',exact:true}).click();
  else await page.getByRole('tab',{name:'Try it yourself',exact:true}).click();
  await page.locator('[data-experiment]').nth(index).click();expected.reset(lesson.tryIt[index].initialState);await compare();
  if (mobile) await page.getByRole('navigation',{name:'Lesson tools'}).getByRole('button',{name:'Controls',exact:true}).click();
  else await page.getByRole('tab',{name:'Controls',exact:true}).click();
}
async function focus(id) {
  await action('Whole machine');const chain=[];let part=expected.parts.find(part=>part.id===id);
  while(part){chain.unshift(part.id);part=expected.parts.find(candidate=>candidate.id===part.parentId);}
  for(const key of chain) await page.locator(`[data-part="${key}"]`).click();
  await page.locator('[data-isolate]').check();await action('Front');
}
async function capture(name) {
  await canvas.scrollIntoViewIfNeeded();await page.waitForTimeout(120);await page.mouse.move(4,4);
  const png = await canvas.screenshot({path:`${output}/${name}.png`});
  const bounds = await page.evaluate(async encoded => {
    const bitmap=await createImageBitmap(new Blob([Uint8Array.from(atob(encoded),value=>value.charCodeAt(0))],{type:'image/png'}));
    const image=document.createElement('canvas');image.width=bitmap.width;image.height=bitmap.height;
    const context=image.getContext('2d');context.drawImage(bitmap,0,0);bitmap.close();
    const {data}=context.getImageData(0,0,image.width,image.height), origin=(5*image.width+5)*4;
    let left=image.width,top=image.height,right=-1,bottom=-1;
    for(let y=8;y<image.height-8;y++) for(let x=8;x<image.width-8;x++) {
      const i=(y*image.width+x)*4;
      if(Math.abs(data[i]-data[origin])+Math.abs(data[i+1]-data[origin+1])+Math.abs(data[i+2]-data[origin+2])>35){left=Math.min(left,x);right=Math.max(right,x);top=Math.min(top,y);bottom=Math.max(bottom,y);}
    }
    return {width:image.width,height:image.height,left,top,right,bottom};
  },png.toString('base64'));
  assert(bounds.right>bounds.left && bounds.bottom>bounds.top,name+': drawn model');
  assert(bounds.left>8 && bounds.top>8 && bounds.right<bounds.width-9 && bounds.bottom<bounds.height-9,name+': clear margins '+JSON.stringify(bounds));
  frames.push({name,...bounds});assert.deepEqual(errors,[]);assert.deepEqual(consoleErrors,[]);
}
async function hit(name) {
  await canvas.scrollIntoViewIfNeeded();const box=await canvas.boundingBox(),popup=page.locator('.daily-part-popup');
  for(let y=1;y<20;y++) for(let x=1;x<20;x++) {
    const point=[box.x+box.width*x/20,box.y+box.height*y/20];await page.mouse.move(...point);
    if(await popup.isVisible() && await popup.innerText()===name) return point;
  }
  assert.fail('No physical pointer target for '+name);
}
try {
  await page.goto(new URL('#machine/gas-boiler',base).href);await canvas.waitFor({timeout:120000});
  await page.getByRole('heading',{name:'Gas boiler',exact:true,level:1}).waitFor();
  assert(await canvas.evaluate(element=>!!element.getContext('webgl2')));assert.equal(await page.locator('[data-control]').count(),4);
  assert(await page.locator('[data-cutaway]').isChecked());await compare();await capture('opening');
  await page.screenshot({path:output+'/opening-page.png',fullPage:true});
  await steps(1);await reset();
  for(const [index,trial] of lesson.tryIt.entries()) {
    await preset(index);
    for(const [key,value] of Object.entries(trial.values)) assert.equal(Number(await page.locator(`[data-control="${key}"]`).inputValue()),value);
    await capture('preset-'+index);const start=await values();await steps(7);await capture('moving-'+index);await preset(index);
    await page.locator('[data-play]').click();
    await page.waitForFunction(()=>document.querySelector('[data-play]').getAttribute('aria-pressed')==='false',null,{timeout:35000});
    expected.advance(1000);await compare();await capture('completed-'+index);const completed=await values();
    await page.locator('[data-play]').click();await page.waitForTimeout(180);await page.locator('[data-play]').click();const replay=await values();
    assert.notDeepEqual(replay,completed,'Completion replay restarts the prepared experiment');
    for(const [key,value] of Object.entries(trial.values)) assert.equal(Number(await page.locator(`[data-control="${key}"]`).inputValue()),value);
    presets.push({title:trial.title,start,completed,replay});console.log(`Preset ${index+1}/${lesson.tryIt.length} passed.`);
  }
  await preset(0);await page.locator('[data-play]').click();await page.waitForTimeout(700);await page.locator('[data-play]').click();
  const paused=await values();await page.waitForTimeout(250);assert.deepEqual(await values(),paused,'Pause holds the mechanism');
  await reset();await steps(7);const moving=await values();
  for(const [index,inspection] of expected.actions.entries()){await action(inspection.label);assert.deepEqual(await values(),moving);await capture('action-'+index);}
  histories.push({name:'Every inspection preserves flowing state',readings:await values()});
  await steps(60);const done=await values();for(const inspection of expected.actions){await action(inspection.label);assert.deepEqual(await values(),done);}
  histories.push({name:'Every inspection preserves completed state',readings:await values()});
  await action('Inspect delivered water');await capture('result');await reset();
  assert.equal(await page.locator('.daily-part-detail h3').innerText(),'Tap and delivered water');await capture('result-reset');
  for(const control of expected.controls) for(const option of control.options) {
    await reset();await edit(control.key,option.value);await steps(1);await steps(60);
    controls.push({key:control.key,value:option.value,readings:await values()});
  }
  await preset(0);
  for(const flow of [0,1,4,8,12]) for(const set of [35,45,55]) for(const inlet of [5,10,20]) for(const pipe of [2,5,10]) {
    await reset();const settings={flow,set,inlet,pipe};for(const [key,value] of Object.entries(settings)) await edit(key,value);
    const start=await compare();await steps(7);const moving=await compare();await steps(60);const completed=await compare();
    await capture(`combination-${flow}-${set}-${inlet}-${pipe}`);combinations.push({settings,start,moving,completed});
  }
  assert.equal(new Set(combinations.map(row=>JSON.stringify(row.settings))).size,135);console.log('All 135 browser setting combinations passed.');
  await preset(0);await steps(60);await edit('flow',12);assert.equal((await values())['Water delivered'],'0.00 L');
  assert((await values())['Your result'].startsWith('Ready:'));await capture('changed-setting-ready');await steps(12);await capture('capacity-limited');
  assert.equal((await values())['Delivered flow'],'9.83 L/min');assert.equal((await values())['Heat entering water'],'24.00 kW');
  assert.equal((await values())['Water at the tap'],'45.0 °C');histories.push({name:'More requested flow reaches the heating limit and restricts actual flow',readings:await values()});
  await edit('inlet',5);await steps(12);await capture('colder-inlet');assert.equal((await values())['Delivered flow'],'8.60 L/min');
  histories.push({name:'A colder inlet reduces flow at fixed temperature and maximum heat',readings:await values()});
  await preset(0);await steps(7);
  for(const part of expected.parts){await focus(part.id);assert.equal(await page.locator('.daily-part-detail h3').innerText(),part.name);await compare();await capture('part-'+part.id);parts.push(part.id);}
  await preset(0);await steps(2);await capture('pre-purge');await steps(1);await capture('ignition-complete');
  await steps(4);await capture('warm-coil-cold-tap');await steps(6);await capture('hot-water');await steps(6);await capture('fan-run-on');await steps(2);await capture('fan-stopped');
  await action('Inspect: complete system');
  for(const view of ['Front','Side','Back','Top','Underneath','Angled']){await action(view);await capture('view-'+view.toLowerCase());}
  await action('Inspect: complete system');await page.locator('[data-cutaway]').uncheck();const exterior=await canvas.screenshot();await capture('exterior');
  await page.locator('[data-cutaway]').check();await compare();assert(!exterior.equals(await canvas.screenshot()));await capture('cutaway');
  await page.locator('[data-cutaway]').uncheck();assert(exterior.equals(await canvas.screenshot()));await page.locator('[data-cutaway]').check();
  await page.locator('[data-separation]').fill('100');await capture('separated');await page.locator('[data-reassemble]').click();await compare();
  await focus('casing');const point=await hit('Casing and removable cover');await page.mouse.click(...point);assert.equal(await page.locator('.daily-part-popup').innerText(),'Casing and removable cover');
  await page.mouse.move(4,4);await canvas.screenshot();const before=await page.evaluate(()=>window.heaterMatrices.modelView);
  await page.mouse.move(...point);await page.mouse.down();await page.mouse.move(point[0]+30,point[1]+18,{steps:8});await page.mouse.up();await page.mouse.move(4,4);await canvas.screenshot();
  const after=await page.evaluate(()=>window.heaterMatrices.modelView);
  for(const i of [0,1,2,4,5,6,8,9,10]) assert(Math.abs(before[i]-after[i])<1e-7,'Object drag preserves rotation');
  assert(Math.hypot(...[12,13,14].map(i=>after[i]-before[i]))>.01,'Object drag translates');
  await action('Inspect: complete system');await canvas.scrollIntoViewIfNeeded();let box=await canvas.boundingBox();await page.mouse.move(box.x+15,box.y+15);
  assert.equal(await page.locator('.daily-part-popup').isVisible(),false);const rotationBefore=await canvas.screenshot();
  await page.mouse.down();await page.mouse.move(box.x+90,box.y+55,{steps:8});await page.mouse.up();assert(!rotationBefore.equals(await canvas.screenshot()));
  await action('Inspect: complete system');const zoomBefore=await canvas.screenshot();await page.locator('[data-view="in"]').click();assert(!zoomBefore.equals(await canvas.screenshot()));
  assert.equal(await page.locator('[data-separation]').inputValue(),'0');await page.locator('[data-view="out"]').click();
  await canvas.focus();const keyboardBefore=await canvas.screenshot();await page.keyboard.press('ArrowRight');assert(!keyboardBefore.equals(await canvas.screenshot()));
  const rotateMatrix=await page.evaluate(()=>window.heaterMatrices.modelView);await page.keyboard.press('Shift+ArrowUp');await canvas.screenshot();
  const moveMatrix=await page.evaluate(()=>window.heaterMatrices.modelView);
  for(const i of [0,1,2,4,5,6,8,9,10]) assert(Math.abs(rotateMatrix[i]-moveMatrix[i])<1e-7);
  assert(Math.hypot(...[12,13,14].map(i=>moveMatrix[i]-rotateMatrix[i]))>.01);
  await page.keyboard.press('Home');assert.equal(await page.locator('.daily-part-detail h3').count(),0);await compare();
  await action('Inspect: complete system');await canvas.scrollIntoViewIfNeeded();box=await canvas.boundingBox();await page.mouse.move(box.x+box.width/2,box.y+box.height/2);
  for(let i=0;i<8 && Number(await page.locator('[data-separation]').inputValue())===0;i++){await page.mouse.wheel(0,120);await page.waitForTimeout(50);}
  assert(Number(await page.locator('[data-separation]').inputValue())>0);await capture('wheel-separated');
  box=await canvas.boundingBox();await page.mouse.move(box.x+box.width/2,box.y+box.height/2);
  for(let i=0;i<16 && Number(await page.locator('[data-separation]').inputValue())>0;i++){await page.mouse.wheel(0,-120);await page.waitForTimeout(50);}
  assert.equal(await page.locator('[data-separation]').inputValue(),'0');
  await page.locator('[data-labels]').check();await page.locator('button[data-label-part="tap"]').click();await page.locator('[data-isolate]').check();
  assert.equal(await page.locator('.daily-part-detail h3').innerText(),'Tap and delivered water');await page.keyboard.press('Escape');assert.equal(await page.locator('.daily-part-detail h3').count(),0);
  await page.locator('button[data-label-part="tap"]').click();await page.locator('.daily-heading h1').click();assert.equal(await page.locator('.daily-part-detail h3').count(),0);
  await page.locator('[data-labels]').uncheck();await action('Inspect: complete system');await reset();await page.locator('[data-control="flow"]').focus();
  await page.keyboard.press('4');await page.keyboard.press('Tab');expected.update({flow:4});await compare();
  for(const width of [390,320]) {
    await page.setViewportSize({width,height:width===390?844:568});await page.reload();await canvas.waitFor({timeout:120000});expected.reset();await compare();await capture('mobile-opening-'+width);
    for(let i=0;i<lesson.tryIt.length;i++){await preset(i,true);await steps(60);await capture(`mobile-completed-${i}-${width}`);}
    await action('Inspect: complete system');await page.screenshot({path:`${output}/mobile-page-${width}.png`,fullPage:true});
    assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));console.log(`Mobile ${width}px: nine prepared results passed.`);
  }
  const touch=await page.context().newCDPSession(page);
  const pinch=async(from,to)=>{
    await canvas.scrollIntoViewIfNeeded();const box=await canvas.boundingBox(),x=box.x+box.width/2,y=box.y+box.height/2;
    const points=distance=>[{x:x-distance,y,id:0},{x:x+distance,y,id:1}];
    await touch.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:points(from)});
    for(let i=1;i<=12;i++) await touch.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:points(from+(to-from)*i/12)});
    await touch.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
  };
  try {await pinch(100,15);assert(Number(await page.locator('[data-separation]').inputValue())>0);await capture('pinch-separated');await pinch(15,100);await page.waitForFunction(()=>document.querySelector('[data-separation]').value==='0');}
  finally {await touch.detach();}
  await page.setViewportSize({width:1440,height:1000});
  for(const [index] of lesson.quiz.options.entries()) {await page.locator('[data-answer]').nth(index).click();assert.equal(await page.locator('.daily-answer').innerText(),(index===lesson.quiz.answer?'That’s right. ':'Try thinking through the parts again. ')+lesson.quiz.explanation);}
  await page.getByText('Learn more',{exact:true}).click();for(const source of lesson.sources) assert.equal(await page.locator(`.daily-lesson a[href="${source.url}"]`).innerText(),source.title);
  await compare();await page.locator('.daily-return').click();assert(!page.url().endsWith('#machine/gas-boiler'));
  assert.deepEqual(errors,[]);assert.deepEqual(consoleErrors,[]);
  await writeFile(output+'/browser.json',JSON.stringify({passed:true,presets,controls,combinations,parts,frames,histories,errors,consoleErrors,pause:true,replay:true,objectDrag:true,backgroundRotation:true,keyboard:true,wheel:true,labels:true,dismissal:true,pinch:true,mobileWidths:[390,320]},null,2));
  console.log(JSON.stringify({passed:true,presets:presets.length,controls:controls.length,combinations:combinations.length,parts:parts.length,frames:frames.length}));
} catch(error) {
  await writeFile(output+'/failure.json',JSON.stringify({message:error.message,errors,consoleErrors,url:page.url(),presets,controls,combinations,parts,frames,body:await page.locator('body').innerText().catch(()=> '')},null,2));
  await page.screenshot({path:output+'/failure.png',fullPage:true}).catch(()=>{});throw error;
} finally {expected.dispose();await browser.close();}

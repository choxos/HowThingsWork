import assert from 'node:assert/strict';
import {mkdir, writeFile} from 'node:fs/promises';
import {chromium} from 'playwright';
import {reviewedPassiveInfraredLesson as lesson} from './passive-infrared-lesson.js';
import {createPassiveInfraredModel} from './passive-infrared-model.js';
import {PIR_DEFAULTS as D} from './passive-infrared-physics.js';
const expectedModel = createPassiveInfraredModel();
const base = process.env.SITE_URL || 'http://127.0.0.1:4173/', output = process.env.EVIDENCE_DIR || 'documentation/passive-infrared-browser';
await mkdir(output, {recursive: true});
const browser = await chromium.launch({channel: 'chrome', headless: true});
const page = await browser.newPage({viewport: {width: 1440, height: 1000}, hasTouch: true, reducedMotion: 'reduce'});
page.setDefaultTimeout(25000);
const errors = [], outcomes = [], controls = [], actions = [], selections = [], physicalHits = [], framing = [], bookmarkViews = [];
page.on('pageerror', error => errors.push(error.stack));
const canvas = page.locator('canvas'), popup = page.locator('.daily-part-popup');
const reading = label => page.locator('.daily-readings > div').filter({has: page.getByText(label, {exact: true})}).locator('dd');
const tab = name => page.getByRole('tab', {name, exact: true}).click();
const capture = async name => {await canvas.scrollIntoViewIfNeeded(); await page.waitForTimeout(400); assert.deepEqual(errors,[],name+': no browser errors'); await canvas.screenshot({path: `${output}/${name}.png`});};
async function checkFraming(name) {
  const screenshot = await canvas.screenshot({style: '.daily-operation-tabs, .daily-mobile-tools { visibility: hidden !important; } .daily-canvas-wrap { border-radius: 0 !important; } canvas { outline: none !important; }'});
  const bounds = await page.evaluate(async encoded => {
    const bitmap = await createImageBitmap(new Blob([Uint8Array.from(atob(encoded), c => c.charCodeAt(0))], {type: 'image/png'}));
    const surface = document.createElement('canvas'); surface.width = bitmap.width; surface.height = bitmap.height;
    const ctx = surface.getContext('2d'); ctx.drawImage(bitmap, 0, 0); bitmap.close();
    const {width, height} = surface, data = ctx.getImageData(0, 0, width, height).data;
    const origin = (5 * width + 5) * 4, background = [data[origin], data[origin + 1], data[origin + 2]];
    let left = width, top = height, right = -1, bottom = -1;
    for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
      if ((x < 8 || x >= width - 8) && (y < 8 || y >= height - 8)) continue;
      const i = (y * width + x) * 4;
      if (background.reduce((sum, value, channel) => sum + Math.abs(data[i + channel] - value), 0) <= 30) continue;
      left = Math.min(left, x); right = Math.max(right, x); top = Math.min(top, y); bottom = Math.max(bottom, y);
    }
    return {width, height, left, top, right, bottom};
  }, screenshot.toString('base64'));
  assert.ok(bounds.right >= bounds.left && bounds.bottom >= bounds.top, `${name}: model is drawn`);
  assert.ok(bounds.left >= 5 && bounds.top >= 5 && bounds.right < bounds.width - 5 && bounds.bottom < bounds.height - 5, `${name}: clear canvas margins ${JSON.stringify(bounds)}`);
  if(['opening','completed','home','whole-machine'].includes(name)){
    assert.ok((bounds.right-bounds.left+1)/bounds.width>.55&&(bounds.bottom-bounds.top+1)/bounds.height>.35,`${name}: connected detector fills a useful portion of the canvas ${JSON.stringify(bounds)}`);
    assert.ok(Math.abs((bounds.left+bounds.right)/2/bounds.width-.5)<.1,`${name}: assembly stays centered after reset`);
  }
  framing.push({name, ...bounds});
}
const reset = () => page.getByRole('button', {name: 'Reset experiment', exact: true}).click();
const action = name => page.getByRole('button', {name, exact: true}).click();
async function preset(index) {await tab('Try it yourself'); await page.locator('[data-experiment]').nth(index).click(); await tab('Controls');}
async function edit(key, value) {
  const input = page.locator('[data-control="'+key+'"]');
  if (await input.evaluate(e => e.tagName === 'SELECT')) await input.selectOption(String(value));
  else {await page.locator('[data-number="'+key+'"]').fill(String(value)); await page.locator('[data-number="'+key+'"]').press('Tab');}
}
async function laws(given, time=0, history={}) {
  expectedModel.reset({...history, settings: {...D, ...given}, time});
  return compareCurrent();
}
async function compareCurrent() {
  const expected = Object.fromEntries(expectedModel.getState().readings.map(r => [r.label, r.value]));
  const readings = Object.fromEntries(await page.locator('.daily-readings > div').evaluateAll(rows => rows.map(row => [row.querySelector('dt').textContent, row.querySelector('dd').textContent])));
  if(expectedModel.getState().values.sound)expected['Power and sound']=expected['Power and sound'].replace(/sound (Audio unavailable|Waiting for browser audio)/,'sound Ready');
  assert.deepEqual(readings, expected);
  assert(!/NaN|undefined|Infinity/.test(JSON.stringify(readings)));
  return {time: expectedModel.getState().time, readings};
}
async function hitPart(name) {
  await canvas.scrollIntoViewIfNeeded(); const box = await canvas.boundingBox();
  for (let x = 1; x < 160; x++) {
    const point=[box.x+box.width*x/160,box.y+box.height/2];await page.mouse.move(...point);
    if(await popup.isVisible()&&await popup.innerText()===name)return point;
  }
  for (let y = 1; y <= 19; y++) for (let x = 1; x <= 19; x++) {
    const point = [box.x + box.width * x / 20, box.y + box.height * y / 20]; await page.mouse.move(...point);
    if (await popup.isVisible() && await popup.innerText() === name) return point;
  }
  const candidates = await page.evaluate(async encoded => {
    const bitmap = await createImageBitmap(new Blob([Uint8Array.from(atob(encoded), c => c.charCodeAt(0))], {type: 'image/png'}));
    const surface = document.createElement('canvas'); surface.width = bitmap.width; surface.height = bitmap.height;
    const context = surface.getContext('2d'); context.drawImage(bitmap, 0, 0); bitmap.close();
    const {width, height} = surface, {data} = context.getImageData(0, 0, width, height), points = [], origin=(5*width+5)*4, background=[data[origin],data[origin+1],data[origin+2]];
    for (let y = height - 4; y > 0; y -= 4) {
      let start = null;
      for (let x = 0; x <= width; x++) {
        const i = (y * width + x) * 4, dark = x < width && background.reduce((sum,v,c)=>sum+Math.abs(data[i+c]-v),0)>60;
        if (dark && start === null) start = x;
        if (!dark && start !== null) {if (x - start >= 3) points.push([(start + x - 1) / 2 / width, y / height]); start = null;}
      }
    }
    return points;
  }, (await canvas.screenshot()).toString('base64'));
  for (const [x, y] of candidates) {
    const point = [box.x + box.width * x, box.y + box.height * y]; await page.mouse.move(...point);
    if (await popup.isVisible() && await popup.innerText() === name) return point;
  }
  assert.fail(`No physical pointer target for ${name}`);
}

await page.addInitScript(()=>{
  window.pirViewProbe={};
  for(const type of ['WebGLRenderingContext','WebGL2RenderingContext']){
    const proto=window[type]?.prototype;if(!proto)continue;const locations=new WeakMap(),get=proto.getUniformLocation,write=proto.uniformMatrix4fv;
    proto.getUniformLocation=function(program,name){const location=get.call(this,program,name);if(location)locations.set(location,name);return location;};
    proto.uniformMatrix4fv=function(location,transpose,data,...rest){const name=locations.get(location);if(['projectionMatrix','modelViewMatrix'].includes(name))window.pirViewProbe[name]=Array.from(data);return write.call(this,location,transpose,data,...rest);};
  }

  const Original=window.AudioContext;
  window.AudioContext=class extends Original{
    constructor(...args){super(...args);const original=this.createGain.bind(this),context=this;
      this.createGain=()=>{const gain=original(),analyser=context.createAnalyser();analyser.fftSize=2048;gain.connect(analyser);window.pirAudioProbe={context,analyser,gain};return gain;};
    }
  };
});
const steps=async count=>page.locator('[data-step]').evaluate((button,n)=>{for(let i=0;i<n;i++)button.click();},count);
const rms=()=>page.evaluate(()=>{const p=window.pirAudioProbe;if(!p)return null;const values=new Float32Array(p.analyser.fftSize);p.analyser.getFloatTimeDomainData(values);return Math.sqrt(values.reduce((s,v)=>s+v*v,0)/values.length);});
const clock=async()=>parseFloat(await reading('Observation clock').innerText());
let audioEvidence;
const partIds=expectedModel.parts.map(p=>p.id);
const inspect={system:'connected detector',room:'thermal fields',principle:'lens and elements',signal:'thermal signals',record:'observation record'};
async function focusPart(id){
 await action('Inspect: connected detector');
 const chain=[];let part=expectedModel.parts.find(p=>p.id===id);
 while(part?.parentId){chain.unshift(part.id);part=expectedModel.parts.find(p=>p.id===part.parentId);}
 for(const target of chain)await page.locator(`button[data-part="${target}"]`).click();
 await page.locator('[data-isolate]').check();await page.getByRole('button',{name:'Front',exact:true}).click();
}
try{
 await page.goto(new URL('#machine/passive-infrared-movement-detector',base).href);await canvas.waitFor();
 await page.getByRole('heading',{name:'Passive infrared movement detector',level:1,exact:true}).waitFor();
 assert.equal(await page.locator('[data-control]').count(),8);await laws(D);await capture('opening');await checkFraming('opening');await page.screenshot({path:output+'/opening-page.png'});
 await canvas.focus();await page.keyboard.press('Home');await laws(D);await capture('home');await checkFraming('home');
 await action('Inspect: lens and elements');await page.getByRole('button',{name:'Whole machine',exact:true}).click();await laws(D);await capture('whole-machine');await checkFraming('whole-machine');
 await reset();await steps(1);await laws(D,.05);await action('Advance one millisecond');await laws(D,.051);await reset();
 for(const [i,trial]of lesson.tryIt.entries()){
  await preset(i);for(const [key,value]of Object.entries(trial.values))assert.equal(Number(await page.locator(`[data-control="${key}"]`).inputValue()),value);
  await laws(trial.values);await capture('preset-'+i);await checkFraming('preset-'+i);
  await steps(12);await laws(trial.values,.6);await capture('preset-moving-'+i);
  await action('Finish observation');expectedModel.advance(expectedModel.duration());outcomes.push({title:trial.title,...await compareCurrent()});
  await action('Inspect: '+inspect[trial.part]);await capture('preset-completed-'+i);await checkFraming('preset-completed-'+i);
 }
 const paceSamples=[];
 for(const pace of [1,.25]){await preset(0);await edit('pace',pace);await page.locator('[data-play]').click();await page.waitForTimeout(650);await page.locator('[data-play]').click();paceSamples.push(await clock());}
 assert(paceSamples[1]/paceSamples[0]>.12&&paceSamples[1]/paceSamples[0]<.45,'Quarter pace slows actual clock');
 const held=await page.locator('.daily-readings').innerText();await page.waitForTimeout(250);assert.equal(await page.locator('.daily-readings').innerText(),held,'Pause freezes readings');
 const beforePace=await clock();await edit('pace',.5);assert.equal(await clock(),beforePace,'Pace preserves physical state');
 await preset(0);await action('Inspect: connected detector');await page.locator('[data-play]').click();await page.waitForFunction(()=>document.querySelector('[data-play]').getAttribute('aria-pressed')==='false',null,{timeout:16000});await laws(D,12);await capture('completed');await checkFraming('completed');
 await page.locator('[data-play]').click();await page.waitForTimeout(150);await page.locator('[data-play]').click();assert(await clock()>0&&await clock()<1,'Completion replay starts from zero');
 await preset(2);await action('Finish observation');await page.locator('[data-play]').click();await page.waitForTimeout(150);await page.locator('[data-play]').click();assert(await clock()>0&&await clock()<1);assert.equal(await page.locator('[data-control="range"]').inputValue(),'3','Prepared depth survives replay');
 for(const control of expectedModel.controls){
  const values=control.options?.map(o=>o.value)??Array.from({length:Math.round((control.max-control.min)/control.step)+1},(_,i)=>Number((control.min+i*control.step).toFixed(6)));
  for(const value of values){
   await reset();expectedModel.reset();await edit(control.key,value);expectedModel.update({[control.key]:value});await compareCurrent();await steps(12);expectedModel.advance(.6);controls.push({key:control.key,value,...await compareCurrent()});
  }
 }
 await reset();await steps(15);await laws(D,.75);
 for(const control of expectedModel.controls)assert.equal(await page.locator(`[data-control="${control.key}"]`).isEnabled(),true,`${control.key} is relevant to passive sensing`);
 for(const [i,a]of expectedModel.actions.entries()){
  if(!a.label.startsWith('Inspect:'))continue;const before=await page.locator('.daily-readings').innerText();await action(a.label);assert.equal(await page.locator('.daily-readings').innerText(),before);actions.push({name:a.label,...await compareCurrent()});await capture(`action-${i}`);await checkFraming(`action-${i}`);
 }
 await action('Inspect: connected detector');for(const view of ['Front','Side','Back','Top','Underneath','Angled']){await page.getByRole('button',{name:view,exact:true}).click();await capture(`view-${view.toLowerCase()}`);await checkFraming(`view-${view}`);}
 await action('Inspect: connected detector');await page.locator('[data-separation]').fill('100');await capture('separated');assert((await page.locator('.daily-inventory-labels').innerText()).includes('Powered processing assembly'));await page.locator('[data-reassemble]').click();
 await reset();await page.locator('[data-control="range"]').focus();await page.locator('[data-control="range"]').press('ArrowRight');await laws({...D,range:5.5});await capture('keyboard-distance');
 for(const part of expectedModel.parts){await reset();await focusPart(part.id);assert.equal(await page.locator('.daily-part-detail h3').innerText(),part.name);await laws(D);selections.push({id:part.id,name:part.name});await capture('part-'+part.id);await checkFraming('part-'+part.id);}
 for(const id of ['battery','pir-head','pair','horn']){
  const name=expectedModel.parts.find(p=>p.id===id).name;await reset();await focusPart(id);const hit=await hitPart(name);await page.mouse.click(...hit);assert.equal(await popup.innerText(),name);physicalHits.push(name);await capture('popup-'+id);
  if(id==='battery'){const box=await canvas.boundingBox();await page.mouse.move(box.x+10,box.y+10);const before=await canvas.screenshot();await page.mouse.move(...hit);await page.mouse.down();await page.mouse.move(hit[0]+35,hit[1]+20,{steps:10});await page.mouse.up();await page.mouse.move(box.x+10,box.y+10);assert(!before.equals(await canvas.screenshot()),'Physical drag translates assembly');}
  await page.locator('.daily-heading h1').click();assert.equal(await popup.isVisible(),false);
 }
 await reset();await action('Inspect: connected detector');await canvas.scrollIntoViewIfNeeded();let box=await canvas.boundingBox();await page.mouse.move(box.x+15,box.y+15);assert.equal(await popup.isVisible(),false);const beforeRotate=await canvas.screenshot();await page.mouse.down();await page.mouse.move(box.x+95,box.y+55,{steps:12});await page.mouse.up();assert(!beforeRotate.equals(await canvas.screenshot()),'Background drag rotates');
 await action('Inspect: connected detector');const beforeZoom=await canvas.screenshot();await page.locator('[data-view="in"]').click();assert(!beforeZoom.equals(await canvas.screenshot()));assert.equal(await page.locator('[data-separation]').inputValue(),'0');await page.locator('[data-view="out"]').click();
 await canvas.scrollIntoViewIfNeeded();box=await canvas.boundingBox();await page.mouse.move(box.x+15,box.y+15);const beforeSeparation=await page.locator('.daily-readings').innerText();for(let i=0;i<8;i++)await page.mouse.wheel(0,240);await page.waitForFunction(()=>document.querySelector('[data-separation]').value==='100');assert.equal(await page.locator('.daily-readings').innerText(),beforeSeparation);await capture('grouped-parts');await page.locator('[data-reassemble]').click();
 for(const width of [390,320]){
  await page.setViewportSize({width,height:width===390?844:568});await page.reload();await canvas.waitFor();const tools=page.getByRole('navigation',{name:'Lesson tools'});await laws(D);await capture('mobile-opening-'+width);await checkFraming('mobile-opening-'+width);
  for(const [i,trial]of lesson.tryIt.entries()){
   await tools.getByRole('button',{name:'Try it yourself',exact:true}).click();await page.locator('[data-experiment]').nth(i).click();await tools.getByRole('button',{name:'Controls',exact:true}).click();await laws(trial.values);await capture(`mobile-preset-${i}-${width}`);await checkFraming(`mobile-preset-${i}-${width}`);
   await action('Finish observation');expectedModel.advance(expectedModel.duration());await compareCurrent();await action('Inspect: '+inspect[trial.part]);await capture(`mobile-completed-${i}-${width}`);await checkFraming(`mobile-completed-${i}-${width}`);
  }
  await action('Inspect: connected detector');await page.locator('[data-separation]').fill('100');await capture('mobile-separated-'+width);await page.locator('[data-reassemble]').click();
  await focusPart('pair');await hitPart('Opposed pyroelectric pair');await capture('mobile-pair-'+width);await action('Inspect: connected detector');await page.screenshot({path:output+'/mobile-page-'+width+'.png'});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
 }
 for(const width of [1440,390,320])for(const id of ['sensor','pir-head','pair']){
  await page.setViewportSize({width,height:width===320?568:width===390?844:1000});await page.goto(new URL('#machine/passive-infrared-movement-detector?part='+id,base).href);
  const name=expectedModel.parts.find(p=>p.id===id).name;await page.waitForFunction(name=>document.querySelector('.daily-part-detail h3')?.textContent===name,name);await laws(D);await capture(`bookmark-${id}-${width}`);await checkFraming(`bookmark-${id}-${width}`);
  const before=await page.evaluate(()=>window.pirViewProbe);await page.getByRole('button',{name:'Front',exact:true}).click();await canvas.scrollIntoViewIfNeeded();await canvas.screenshot();const after=await page.evaluate(()=>window.pirViewProbe);
  const differences=Object.fromEntries(['projectionMatrix','modelViewMatrix'].map(key=>{assert.equal(before[key].length,16);assert.equal(after[key].length,16);assert(before[key].concat(after[key]).every(Number.isFinite));const difference=Math.max(...before[key].map((v,i)=>Math.abs(v-after[key][i])));assert(difference<1e-12,`${id}/${width}: bookmark opens in authored front view`);return [key,difference];}));bookmarkViews.push({id,width,differences});
  await page.getByRole('button',{name:'Side',exact:true}).click();await canvas.screenshot();const side=await page.evaluate(()=>window.pirViewProbe);assert(side.modelViewMatrix.some((v,i)=>Math.abs(v-before.modelViewMatrix[i])>1e-5),'Camera probe distinguishes a different angle');
 }
 await page.setViewportSize({width:390,height:844});await action('Inspect: connected detector');const session=await page.context().newCDPSession(page);
 async function pinch(from,to){await canvas.scrollIntoViewIfNeeded();const b=await canvas.boundingBox(),x=b.x+b.width/2,y=b.y+b.height/2,points=d=>[{x:x-d,y,id:0},{x:x+d,y,id:1}];await session.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:points(from)});for(let i=1;i<=12;i++)await session.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:points(from+(to-from)*i/12)});await session.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});}
 try{await pinch(120,20);assert(Number(await page.locator('[data-separation]').inputValue())>0);await capture('mobile-pinch');await pinch(20,120);await page.waitForFunction(()=>document.querySelector('[data-separation]').value==='0');}finally{await session.detach();}
 await page.setViewportSize({width:1440,height:1000});await preset(0);await edit('sound',1);assert((await reading('Power and sound').innerText()).endsWith('sound Ready'));await page.locator('[data-play]').click();await page.waitForFunction(()=>document.querySelector('.daily-readings').textContent.includes('ALARM: the qualified signal latched'),null,{timeout:8000});
 const amplitudes=[],frequencies=[];for(let i=0;i<40;i++){const amplitude=await rms();amplitudes.push(amplitude);if(amplitude>.01)frequencies.push(await page.evaluate(()=>{const p=window.pirAudioProbe,data=new Float32Array(p.analyser.frequencyBinCount);p.analyser.getFloatFrequencyData(data);let peak=0;for(let i=1;i<data.length;i++)if(data[i]>data[peak])peak=i;return peak*p.context.sampleRate/p.analyser.fftSize;}));await page.waitForTimeout(100);}
 assert(amplitudes.some(v=>v>.01)&&amplitudes.some(v=>v<1e-5),'Actual tone blocks and silence');assert(frequencies.length&&frequencies.every(f=>Math.abs(f-2000)<25),'Actual 2 kHz tone within one FFT bin');await page.locator('[data-play]').click();await page.waitForTimeout(100);assert((await rms())<1e-5,'Pause mutes audio');await page.locator('[data-play]').click();await page.waitForTimeout(150);await edit('sound',0);await page.waitForTimeout(100);assert((await rms())<1e-5,'Sound off mutes audio');await page.locator('[data-play]').click();audioEvidence={amplitudes,frequencies,pauseMutes:true,offMutes:true};await reset();
 for(const [i]of lesson.quiz.options.entries()){await page.locator('[data-answer]').nth(i).click();assert.equal(await page.locator('.daily-answer').innerText(),(i===lesson.quiz.answer?'That’s right. ':'Try thinking through the parts again. ')+lesson.quiz.explanation);}
 await page.getByText('Learn more',{exact:true}).click();for(const source of lesson.sources)assert.equal(await page.locator(`.daily-lesson a[href="${source.url}"]`).innerText(),source.title);
 await page.locator('.daily-return').click();assert(!page.url().endsWith('#machine/passive-infrared-movement-detector'));assert.deepEqual(errors,[]);
 const report={passed:true,outcomes,controls,actions,selections,physicalHits,framing,bookmarkViews,audioEvidence,paceSamples,slowPlayback:true,pause:true,step:true,completion:true,replay:true,preparedReset:true,keyboardDistance:true,objectDrag:true,backgroundRotation:true,zoomOnlyButtons:true,wheelSeparation:true,pinch:true,mobileWidths:[390,320],quiz:true,return:true,errors};
 await writeFile(output+'/browser.json',JSON.stringify(report,null,2));console.log(JSON.stringify({passed:true,presets:outcomes.length,controlValues:controls.length,actions:actions.length,parts:selections.length,physicalHits:physicalHits.length,framingChecks:framing.length,audio:true,errors}));
}catch(error){await writeFile(output+'/failure.json',JSON.stringify({message:error.message,errors,url:page.url(),body:await page.locator('body').innerText().catch(()=> '')},null,2));await page.screenshot({path:output+'/failure.png'}).catch(()=>{});throw error;}
finally{expectedModel.dispose();await browser.close();}

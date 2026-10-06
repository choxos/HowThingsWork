import assert from 'node:assert/strict';
import {mkdir, writeFile} from 'node:fs/promises';
import {chromium} from 'playwright';
import {reviewedIonizationSmokeLesson as lesson} from './ionization-smoke-lesson.js';
import {createIonizationSmokeModel} from './ionization-smoke-model.js';
import {ION_SMOKE_DEFAULTS as D, ION_SMOKE_DOMAINS} from './ionization-smoke-physics.js';
const expectedModel = createIonizationSmokeModel();
const base = process.env.SITE_URL || 'http://127.0.0.1:4173/', output = process.env.EVIDENCE_DIR || 'documentation/ionization-smoke-browser';
await mkdir(output, {recursive: true});
const browser = await chromium.launch({channel: 'chrome', headless: true});
const page = await browser.newPage({viewport: {width: 1440, height: 1000}, hasTouch: true, reducedMotion: 'reduce'});
page.setDefaultTimeout(25000);
const errors = [], outcomes = [], controls = [], actions = [], selections = [], physicalHits = [], framing = [];
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
    assert.ok((bounds.right-bounds.left+1)/bounds.width>.55&&(bounds.bottom-bounds.top+1)/bounds.height>.6,`${name}: connected assembly fills a useful portion of the canvas ${JSON.stringify(bounds)}`);
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
  if(expectedModel.getState().values.sound)expected['Sound demonstration']='Ready';
  assert.deepEqual(readings, expected);
  assert(!/NaN|undefined|Infinity/.test(JSON.stringify(readings)));
  return {time: expectedModel.getState().time, readings};
}
async function focusPart(id) {
  await action('Inspect: connected assembly'); await page.locator('[data-cutaway]').setChecked(!id.endsWith('-shell')); await page.locator('[data-labels]').check();
  await page.locator(`button[data-label-part="${id}"]`).click(); await page.locator('[data-isolate]').check(); await page.locator('[data-labels]').uncheck();
  await page.getByRole('button', {name: 'Front', exact: true}).click();
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
  const Original=window.AudioContext;
  window.AudioContext=class extends Original{
    constructor(...args){super(...args);const original=this.createGain.bind(this),context=this;
      this.createGain=()=>{const gain=original(),analyser=context.createAnalyser();analyser.fftSize=2048;gain.connect(analyser);window.ionSmokeAudioProbe={context,analyser,gain};return gain;};
    }
  };
});
const steps=async count=>page.locator('[data-step]').evaluate((button,n)=>{for(let i=0;i<n;i++)button.click();},count);
const rms=()=>page.evaluate(()=>{const p=window.ionSmokeAudioProbe;if(!p)return null;const values=new Float32Array(p.analyser.fftSize);p.analyser.getFloatTimeDomainData(values);return Math.sqrt(values.reduce((s,v)=>s+v*v,0)/values.length);});
const clock=async()=>parseFloat(await reading('Observation clock').innerText());
let audioEvidence;
try{
  await page.goto(new URL('#machine/ionization-smoke-detector',base).href);
  await page.getByRole('heading',{name:'Ionization smoke detector',exact:true,level:1}).waitFor();await canvas.waitFor();
  assert.equal(await page.locator('[data-control]').count(),7);
  await laws(D);await capture('opening');await checkFraming('opening');await page.screenshot({path:`${output}/opening-page.png`});
  await canvas.focus();await page.keyboard.press('Home');await laws(D);await capture('home');await checkFraming('home');
  await action('Inspect: ion paths');await page.getByRole('button',{name:'Whole machine',exact:true}).click();await laws(D);await capture('whole-machine');await checkFraming('whole-machine');
  await action('Inspect: connected assembly');await page.locator('[data-cutaway]').uncheck();await capture('covered');await checkFraming('covered');await page.locator('[data-cutaway]').check();
  await steps(1);await laws(D,5);await reset();
  for(const [i,experiment]of lesson.tryIt.entries()){
    await preset(i);assert(await page.locator('[data-cutaway]').isChecked());
    for(const [key,value]of Object.entries(experiment.values))assert.equal(Number(await page.locator(`[data-control="${key}"]`).inputValue()),value);
    await laws(experiment.values,0,experiment.initialState);await capture(`preset-${i}`);await checkFraming(`preset-${i}`);
    await steps(120);expectedModel.advance(30);outcomes.push({title:experiment.title,...await compareCurrent()});await capture(`preset-completed-${i}`);await checkFraming(`preset-completed-${i}`);
  }
  await preset(0);await page.locator('[data-play]').click();await page.waitForTimeout(300);await page.locator('[data-play]').click();
  const held=await page.locator('.daily-readings').innerText();await page.waitForTimeout(250);assert.equal(await page.locator('.daily-readings').innerText(),held,'Pause freezes experiment');
  const paceSamples=[];
  for(const pace of [1,.25]){await preset(0);await edit('pace',pace);await page.locator('[data-play]').click();await page.waitForTimeout(600);await page.locator('[data-play]').click();paceSamples.push(await clock());}
  assert(paceSamples[1]/paceSamples[0]>.13&&paceSamples[1]/paceSamples[0]<.42,'Quarter pace slows actual browser clock');
  const paceClock=await clock();await edit('pace',.5);assert.equal(await clock(),paceClock,'Pace change preserves current state');
  await preset(0);await action('Inspect: connected assembly');await page.locator('[data-play]').click();await page.waitForFunction(()=>document.querySelector('[data-play]').getAttribute('aria-pressed')==='false',null,{timeout:45000});
  await laws(D,600);await capture('completed');await checkFraming('completed');await page.locator('[data-play]').click();await page.waitForTimeout(150);await page.locator('[data-play]').click();assert(await clock()>0&&await clock()<20,'Completed observation replays from zero');
  for(const [key,[min,max,step]]of Object.entries(ION_SMOKE_DOMAINS))for(const value of [...new Set(expectedModel.controls.find(c=>c.key===key).options?.map(o=>o.value)??[min,min+Math.round((max-min)/4/step)*step,min+Math.round((max-min)/2/step)*step,min+Math.round(3*(max-min)/4/step)*step,max])]){
    await reset();expectedModel.reset();await edit(key,value);expectedModel.update({[key]:value});await compareCurrent();
    await steps(44);expectedModel.advance(11);controls.push({key,value,...await compareCurrent()});
  }
  await reset();await page.locator('[data-control="growth"]').focus();await page.locator('[data-control="growth"]').press('ArrowRight');await laws({...D,growth:11});await capture('keyboard-growth');
  await preset(0);await steps(60);expectedModel.reset({time:300});await compareCurrent();await edit('power',0);expectedModel.update({power:0});await compareCurrent();assert.equal(await clock(),0,'Physical setting restarts clock');await capture('disconnected-after-alarm');
  await preset(1);expectedModel.reset(lesson.tryIt[1].initialState);
  for(const [i,time]of [1.67,3.34].entries()){
    await action("Advance to next sample");expectedModel.actions.find(a=>a.label==="Advance to next sample").run();await compareCurrent();assert.equal(await clock(),time);await capture(`sample-${i+1}`);await checkFraming(`sample-${i+1}`);
  }
  await steps(120);expectedModel.advance(30);await compareCurrent();await page.locator("[data-play]").click();await page.waitForTimeout(100);await page.locator("[data-play]").click();
  assert(await clock()>0&&await clock()<20,"Prepared experiment replays from its starting clock");
  await preset(3);await steps(30);expectedModel.reset({...lesson.tryIt[3].initialState,time:150});await compareCurrent();
  await action('Clear smoke now');expectedModel.actions.find(a=>a.label==='Clear smoke now').run();await compareCurrent();await capture('manual-clear-start');
  await steps(20);expectedModel.advance(5);await compareCurrent();assert(!expectedModel.getState().active,'Manual clearing releases alarm');await capture('manual-clear-result');
  for(let i=0;i<await page.locator('[data-action]').count();i++){
    await preset(0);await steps(50);expectedModel.reset({time:250});await compareCurrent();
    const before=await page.locator('.daily-readings').innerText(),name=await page.locator('[data-action]').nth(i).innerText();await page.locator('[data-action]').nth(i).click();expectedModel.actions[i].run();
    if(name.startsWith('Inspect:'))assert.equal(await page.locator('.daily-readings').innerText(),before,'Inspection preserves clock and history');
    actions.push({name,...await compareCurrent()});await capture(`action-${i}`);await checkFraming(`action-${i}`);
  }
  await reset();await steps(50);await action('Inspect: connected assembly');await page.locator('[data-labels]').check();
  const parts=await page.locator('button[data-label-part]').evaluateAll(es=>es.map(e=>({id:e.dataset.labelPart,name:e.innerText})));
  for(const part of parts){
    await action('Inspect: connected assembly');await page.locator('[data-cutaway]').setChecked(!part.id.endsWith('-shell'));
    const detail={'source':'Inspect: one alpha','circuit':'Inspect: series voltages','chart':'Inspect: observation record','balance':'Inspect: charge balance'}[part.id];if(detail)await action(detail);
    const button=page.locator(`button[data-label-part="${part.id}"]`);await button.click();assert.equal(await page.locator('.daily-part-detail h3').innerText(),part.name);assert.equal(await button.getAttribute('aria-pressed'),'true');selections.push(part);
  }
  assert.equal(selections.length,23);await page.locator('[data-labels]').uncheck();
  for(const [id,name]of [['battery','Battery and terminals'],['reference-shell','Reference shell'],['foil','Sealed source foil'],['comparator','Comparator and horn driver'],['horn','Piezoelectric sounder']]){
    await reset();await focusPart(id);const hit=await hitPart(name);await page.mouse.click(...hit);assert.equal(await popup.innerText(),name);physicalHits.push(name);await capture(`popup-${id}`);
    if(id==='battery'){
      const b=await canvas.boundingBox();await page.mouse.move(b.x+10,b.y+10);const before=await canvas.screenshot();await page.mouse.move(...hit);await page.mouse.down();await page.mouse.move(hit[0]+35,hit[1]+20,{steps:10});await page.mouse.up();await page.mouse.move(b.x+10,b.y+10);assert(!before.equals(await canvas.screenshot()),'Physical drag translates assembly');
    }
    await page.locator('.daily-heading h1').click();assert.equal(await popup.isVisible(),false);assert.equal(await page.locator('.daily-part-detail h3').count(),0);
  }
  await reset();await action('Inspect: connected assembly');await canvas.scrollIntoViewIfNeeded();let box=await canvas.boundingBox();await page.mouse.move(box.x+15,box.y+15);assert.equal(await popup.isVisible(),false);const beforeRotate=await canvas.screenshot();
  await page.mouse.down();await page.mouse.move(box.x+95,box.y+55,{steps:12});await page.mouse.up();assert(!beforeRotate.equals(await canvas.screenshot()),'Background drag rotates');
  await action('Inspect: connected assembly');const beforeZoom=await canvas.screenshot();await page.locator('[data-view="in"]').click();assert(!beforeZoom.equals(await canvas.screenshot()));assert.equal(await page.locator('[data-separation]').inputValue(),'0');await page.locator('[data-view="out"]').click();
  await canvas.scrollIntoViewIfNeeded();box=await canvas.boundingBox();await page.mouse.move(box.x+15,box.y+15);const beforeSeparation=await page.locator('.daily-readings').innerText();
  for(let i=0;i<8;i++)await page.mouse.wheel(0,240);await page.waitForFunction(()=>document.querySelector('[data-separation]').value==='100');assert.equal(await page.locator('.daily-readings').innerText(),beforeSeparation);await capture('grouped-parts');await checkFraming('grouped-parts');
  for(const name of ['Battery and terminals','Piezoelectric sounder','Two ionization chambers','Supply, sense and return conductors'])assert((await page.locator('.daily-inventory-labels').innerText()).replaceAll('\n',' ').includes(name));
  await page.locator('[data-reassemble]').click();await action('Inspect: connected assembly');
  for(const view of ['Front','Side','Back','Top','Underneath','Angled']){await page.getByRole('button',{name:view,exact:true}).click();await capture(`view-${view.toLowerCase()}`);await checkFraming(`view-${view}`);}
  for(const width of [390,320]){
    await page.setViewportSize({width,height:width===390?844:568});await page.reload();await canvas.waitFor();const tools=page.getByRole('navigation',{name:'Lesson tools'});
    await laws(D);await capture(`mobile-opening-${width}`);await checkFraming(`mobile-opening-${width}`);
    for(const [i,experiment]of lesson.tryIt.entries()){
      await tools.getByRole('button',{name:'Try it yourself',exact:true}).click();await page.locator('[data-experiment]').nth(i).click();await tools.getByRole('button',{name:'Controls',exact:true}).click();
      await laws(experiment.values,0,experiment.initialState);await capture(`mobile-preset-${i}-${width}`);await checkFraming(`mobile-preset-${i}-${width}`);
      await steps(120);expectedModel.advance(30);await compareCurrent();await capture(`mobile-completed-${i}-${width}`);await checkFraming(`mobile-completed-${i}-${width}`);
    }
    await action('Inspect: connected assembly');await page.locator('[data-separation]').fill('100');await capture(`mobile-separated-${width}`);await checkFraming(`mobile-separated-${width}`);await page.locator('[data-reassemble]').click();
    await focusPart('foil');await hitPart('Sealed source foil');await capture(`mobile-source-${width}`);await action('Inspect: connected assembly');await capture(`mobile-${width}`);await page.screenshot({path:`${output}/mobile-page-${width}.png`});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
  }
  await page.setViewportSize({width:390,height:844});await action('Inspect: connected assembly');const session=await page.context().newCDPSession(page);
  async function pinch(from,to){await canvas.scrollIntoViewIfNeeded();const b=await canvas.boundingBox(),x=b.x+b.width/2,y=b.y+b.height/2,points=d=>[{x:x-d,y,id:0},{x:x+d,y,id:1}];await session.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:points(from)});for(let i=1;i<=12;i++)await session.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:points(from+(to-from)*i/12)});await session.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});}
  try{await pinch(120,20);assert(Number(await page.locator('[data-separation]').inputValue())>0);await capture('mobile-pinch');await pinch(20,120);await page.waitForFunction(()=>document.querySelector('[data-separation]').value==='0');}finally{await session.detach();}
  await page.setViewportSize({width:1440,height:1000});
  // Observe the actual Web Audio output after the learner enables it. A gain
  // label alone is insufficient evidence of oscillation, gaps, or muting.
  await preset(3);await edit('sound',1);assert.equal(await reading('Sound demonstration').innerText(),'Ready');await page.locator('[data-play]').click();
  await page.waitForFunction(()=>document.querySelector('.daily-readings').textContent.includes('ALARM: the sampled chamber voltage requests the powered horn.'),null,{timeout:12000});
  const amplitudes=[],frequencies=[];for(let i=0;i<45;i++){const amplitude=await rms();amplitudes.push(amplitude);if(amplitude>.01)frequencies.push(await page.evaluate(()=>{const p=window.ionSmokeAudioProbe,data=new Float32Array(p.analyser.frequencyBinCount);p.analyser.getFloatFrequencyData(data);let peak=0;for(let i=1;i<data.length;i++)if(data[i]>data[peak])peak=i;return peak*p.context.sampleRate/p.analyser.fftSize;}));await page.waitForTimeout(100);}
  assert(amplitudes.some(v=>v>.01)&&amplitudes.some(v=>v<1e-5),'Real audio has tone blocks and silent gaps');
  assert(frequencies.length>0&&frequencies.every(f=>Math.abs(f-3000)<25),'Actual tone peaks at 3 kHz within one FFT bin');
  await page.locator('[data-play]').click();await page.waitForTimeout(100);assert((await rms())<1e-5,'Pause silences actual output');
  await page.locator('[data-play]').click();await page.waitForTimeout(300);await edit('sound',0);await page.waitForTimeout(100);assert((await rms())<1e-5,'Sound off silences actual output');await page.locator('[data-play]').click();
  audioEvidence={amplitudes,frequencies,pauseMutes:true,offMutes:true};await reset();
  for(const [i]of lesson.quiz.options.entries()){await page.locator('[data-answer]').nth(i).click();assert.equal(await page.locator('.daily-answer').innerText(),(i===lesson.quiz.answer?'That’s right. ':'Try thinking through the parts again. ')+lesson.quiz.explanation);}
  await page.getByText('Learn more',{exact:true}).click();for(const source of lesson.sources)assert.equal(await page.locator(`.daily-lesson a[href="${source.url}"]`).innerText(),source.title);
  await page.locator('.daily-return').click();assert(!page.url().endsWith('#machine/ionization-smoke-detector'));assert.deepEqual(errors,[]);
  const report={passed:true,outcomes,controls,actions,selections,physicalHits,framing,audioEvidence,paceSamples,slowPlayback:true,pause:true,step:true,completion:true,replay:true,preparedReset:true,manualClear:true,keyboardGrowth:true,objectDrag:true,backgroundRotation:true,zoomOnlyButtons:true,wheelSeparation:true,pinch:true,mobileWidths:[390,320],quiz:true,return:true,errors};
  await writeFile(`${output}/browser.json`,JSON.stringify(report,null,2));console.log(JSON.stringify({passed:true,presets:outcomes.length,controlValues:controls.length,actions:actions.length,parts:selections.length,physicalHits:physicalHits.length,framingChecks:framing.length,audio:true,errors}));
}catch(error){await writeFile(`${output}/failure.json`,JSON.stringify({message:error.message,errors,url:page.url(),body:await page.locator('body').innerText().catch(()=> '')},null,2));await page.screenshot({path:`${output}/failure.png`}).catch(()=>{});throw error;}
finally{expectedModel.dispose();await browser.close();}

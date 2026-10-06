import assert from 'node:assert/strict';
import {mkdir, writeFile} from 'node:fs/promises';
import {chromium} from 'playwright';
import {reviewedPhonemesLesson as lesson} from './phonemes-lesson.js';
import {createPhonemesModel} from './phonemes-model.js';
import {PHONEME_DEFAULTS as D} from './phonemes-physics.js';
import {fft} from './speech-physics.js';
const expectedModel = createPhonemesModel();
const base = process.env.SITE_URL || 'http://127.0.0.1:4173/', output = process.env.EVIDENCE_DIR || 'documentation/phonemes-browser';
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
    assert.ok((bounds.right-bounds.left+1)/bounds.width>.55&&(bounds.bottom-bounds.top+1)/bounds.height>.35,`${name}: source and filter fills a useful portion of the canvas ${JSON.stringify(bounds)}`);
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
  if(expectedModel.getState().values.sound)expected['Clock and sound']=expected['Clock and sound'].replace(/sound (Audio unavailable|Waiting for browser audio)/,'sound Ready');
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
  const request=window.requestAnimationFrame.bind(window);window.speechPastFrame=false;window.requestAnimationFrame=callback=>request(time=>{if(window.speechPastFrame){window.speechPastFrame=false;callback(performance.now()-100);}else callback(time);});
  window.speechViewProbe={};
  for(const type of ['WebGLRenderingContext','WebGL2RenderingContext']){
    const proto=window[type]?.prototype;if(!proto)continue;const locations=new WeakMap(),get=proto.getUniformLocation,write=proto.uniformMatrix4fv;
    proto.getUniformLocation=function(program,name){const location=get.call(this,program,name);if(location)locations.set(location,name);return location;};
    proto.uniformMatrix4fv=function(location,transpose,data,...rest){const name=locations.get(location);if(['projectionMatrix','modelViewMatrix'].includes(name))window.speechViewProbe[name]=Array.from(data);return write.call(this,location,transpose,data,...rest);};
  }

  const Original=window.AudioContext;
  window.AudioContext=class extends Original{
    constructor(...args){super(...args);const original=this.createBufferSource.bind(this),context=this;
      const analyser=this.createAnalyser();analyser.fftSize=2048;
      const tap=this.createScriptProcessor(1024,1,1),silent=this.createGain();silent.gain.value=0;tap.connect(silent);silent.connect(this.destination);
      const probe={context,analyser,blocks:[],sources:[]};window.speechAudioProbe=probe;
      tap.onaudioprocess=e=>probe.blocks.push(Array.from(e.inputBuffer.getChannelData(0)));
      this.createBufferSource=()=>{const source=original();source.connect(analyser);source.connect(tap);probe.sources.push(source);return source;};
    }
  };
});
const steps=async count=>page.locator('[data-step]').evaluate((button,n)=>{for(let i=0;i<n;i++)button.click();},count);
const rms=()=>page.evaluate(()=>{const p=window.speechAudioProbe;if(!p)return null;const values=new Float32Array(p.analyser.fftSize);p.analyser.getFloatTimeDomainData(values);return Math.sqrt(values.reduce((s,v)=>s+v*v,0)/values.length);});
const clock=async()=>parseFloat(await reading('Clock and sound').innerText());
let audioEvidence;
const partIds=expectedModel.parts.map(p=>p.id);
const inspect={system:'source and filter',spectrum:'one frame and spectrum',spectrogram:'changing spectrogram',vowels:'measured vowel chart',comparison:'compare both sounds'};
async function focusPart(id){
 await action('Inspect: source and filter');
 const chain=[];let part=expectedModel.parts.find(p=>p.id===id);
 if(part&&!part.parentId&&part.id!=='system')chain.unshift(part.id);
 while(part?.parentId){chain.unshift(part.id);part=expectedModel.parts.find(p=>p.id===part.parentId);}
 for(const target of chain)await page.locator(`button[data-part="${target}"]`).click();
 await page.locator('[data-isolate]').check();await page.getByRole('button',{name:'Front',exact:true}).click();
}
try{
 await page.goto(new URL('#machine/phonemes',base).href);await canvas.waitFor();
 await page.getByRole('heading',{name:'Phonemes',level:1,exact:true}).waitFor();
 assert.equal(await page.locator('[data-control]').count(),9);await laws(D);await capture('opening');await checkFraming('opening');await page.screenshot({path:output+'/opening-page.png'});
 await canvas.focus();await page.keyboard.press('Home');await laws(D);await capture('home');await checkFraming('home');
 await action('Inspect: one frame and spectrum');await page.getByRole('button',{name:'Whole machine',exact:true}).click();await laws(D);await capture('whole-machine');await checkFraming('whole-machine');
 await reset();await steps(1);await laws(D,.025);await reset();
 for(const [i,trial]of lesson.tryIt.entries()){
  await preset(i);for(const [key,value]of Object.entries(trial.values))assert.equal(Number(await page.locator(`[data-control="${key}"]`).inputValue()),value);
  await laws(trial.values);await capture('preset-'+i);await checkFraming('preset-'+i);
  await steps(22);await laws(trial.values,.55);await capture('preset-moving-'+i);
  await action('Finish both sounds');expectedModel.advance(expectedModel.duration());outcomes.push({title:trial.title,...await compareCurrent()});
  await action('Inspect: '+inspect[trial.part]);await capture('preset-completed-'+i);await checkFraming('preset-completed-'+i);
 }
 await preset(0);await page.locator('[data-play]').click();await page.waitForTimeout(650);await page.locator('[data-play]').click();
 const held=await page.locator('.daily-readings').innerText();await page.waitForTimeout(250);assert.equal(await page.locator('.daily-readings').innerText(),held,'Pause freezes readings');
 await preset(0);await action('Inspect: source and filter');await page.locator('[data-play]').click();await page.waitForFunction(()=>document.querySelector('[data-play]').getAttribute('aria-pressed')==='false',null,{timeout:6000});await laws(D,2.1);await capture('completed');await checkFraming('completed');
 const waitForReplay=()=>page.waitForFunction(()=>{const row=[...document.querySelectorAll('.daily-readings > div')].find(r=>r.querySelector('dt')?.textContent==='Clock and sound');const time=parseFloat(row.querySelector('dd').textContent);return time>0&&time<1;},null,{timeout:2500});
 await page.evaluate(()=>{window.speechPastFrame=true;});await page.locator('[data-play]').click();await waitForReplay();await page.locator('[data-play]').click();assert(await clock()>0&&await clock()<1,'Completion replay handles an earlier animation-frame timestamp');assert.deepEqual(errors,[],'Earlier frame cannot send negative elapsed time');
 await preset(11);await action('Finish both sounds');await page.locator('[data-play]').click();await waitForReplay();await page.locator('[data-play]').click();assert(await clock()>0&&await clock()<1,'Prepared replay starts from zero');assert.equal(await page.locator('[data-control="rate"]').inputValue(),'8','Prepared sample rate survives replay');
 for(const control of expectedModel.controls){
  const values=control.options?.map(o=>o.value)??Array.from({length:Math.round((control.max-control.min)/control.step)+1},(_,i)=>Number((control.min+i*control.step).toFixed(6)));
  for(const value of values){
   await reset();expectedModel.reset();await edit(control.key,value);expectedModel.update({[control.key]:value});await compareCurrent();await steps(22);expectedModel.advance(.55);const moving=await compareCurrent();await action('Finish both sounds');expectedModel.advance(expectedModel.duration());controls.push({key:control.key,value,moving,completed:await compareCurrent()});
  }
 }
 await reset();await steps(30);await laws(D,.75);
 await edit('references',2);expectedModel.update({references:2});await compareCurrent();assert.equal(await clock(),.75,'Changing chart reference preserves captured sound');await edit('references',0);expectedModel.update({references:0});await compareCurrent();
 for(const control of expectedModel.controls)assert.equal(await page.locator(`[data-control="${control.key}"]`).isEnabled(),true,`${control.key} is explained by the phoneme controls`);
 for(const [i,a]of expectedModel.actions.entries()){
  if(!a.label.startsWith('Inspect:'))continue;const before=await page.locator('.daily-readings').innerText();await action(a.label);assert.equal(await page.locator('.daily-readings').innerText(),before);actions.push({name:a.label,...await compareCurrent()});await capture(`action-${i}`);await checkFraming(`action-${i}`);
 }
 await action('Inspect: source and filter');for(const view of ['Front','Side','Back','Top','Underneath','Angled']){await page.getByRole('button',{name:view,exact:true}).click();await capture(`view-${view.toLowerCase()}`);await checkFraming(`view-${view}`);}
 await action('Inspect: source and filter');await page.locator('[data-separation]').fill('100');await capture('separated');assert((await page.locator('.daily-inventory-labels').innerText()).includes('Sound source, filter and pattern'));await page.locator('[data-reassemble]').click();
 await reset();await page.locator('[data-control="rate"]').focus();await page.locator('[data-control="rate"]').press('8');await page.locator('[data-control="rate"]').press('Tab');await laws({...D,rate:8});await capture('keyboard-rate');
 for(const part of expectedModel.parts){await reset();await focusPart(part.id);assert.equal(await page.locator('.daily-part-detail h3').innerText(),part.name);await laws(D);selections.push({id:part.id,name:part.name});await capture('part-'+part.id);await checkFraming('part-'+part.id);}
 for(const id of ['source','filters','output']){
  const name=expectedModel.parts.find(p=>p.id===id).name;await reset();await focusPart(id);const hit=await hitPart(name);await page.mouse.click(...hit);assert.equal(await popup.innerText(),name);physicalHits.push(name);await capture('popup-'+id);
  if(id==='source'){const box=await canvas.boundingBox();await page.mouse.move(box.x+10,box.y+10);const before=await canvas.screenshot(),matrixBefore=await page.evaluate(()=>window.speechViewProbe.modelViewMatrix);await page.mouse.move(...hit);await page.mouse.down();await page.mouse.move(hit[0]+35,hit[1]+20,{steps:10});await page.mouse.up();await page.mouse.move(box.x+10,box.y+10);assert(!before.equals(await canvas.screenshot()),'Physical drag translates assembly');const matrixAfter=await page.evaluate(()=>window.speechViewProbe.modelViewMatrix);for(const i of [0,1,2,4,5,6,8,9,10])assert(Math.abs(matrixAfter[i]-matrixBefore[i])<1e-7,'Direct drag retains rotation and scale');assert(Math.hypot(...[12,13,14].map(i=>matrixAfter[i]-matrixBefore[i]))>.01,'Direct drag changes world translation');}
  await page.locator('.daily-heading h1').click();assert.equal(await popup.isVisible(),false);
 }
 await reset();await action('Inspect: source and filter');await canvas.scrollIntoViewIfNeeded();let box=await canvas.boundingBox();await page.mouse.move(box.x+15,box.y+15);assert.equal(await popup.isVisible(),false);const beforeRotate=await canvas.screenshot();await page.mouse.down();await page.mouse.move(box.x+95,box.y+55,{steps:12});await page.mouse.up();assert(!beforeRotate.equals(await canvas.screenshot()),'Background drag rotates');
 await action('Inspect: source and filter');const beforeZoom=await canvas.screenshot();await page.locator('[data-view="in"]').click();assert(!beforeZoom.equals(await canvas.screenshot()));assert.equal(await page.locator('[data-separation]').inputValue(),'0');await page.locator('[data-view="out"]').click();
 await canvas.scrollIntoViewIfNeeded();box=await canvas.boundingBox();await page.mouse.move(box.x+15,box.y+15);const beforeSeparation=await page.locator('.daily-readings').innerText();for(let i=0;i<8;i++)await page.mouse.wheel(0,240);await page.waitForFunction(()=>document.querySelector('[data-separation]').value==='100');assert.equal(await page.locator('.daily-readings').innerText(),beforeSeparation);await capture('grouped-parts');await page.locator('[data-reassemble]').click();
 for(const width of [390,320]){
  await page.setViewportSize({width,height:width===390?844:568});await page.reload();await canvas.waitFor();const tools=page.getByRole('navigation',{name:'Lesson tools'});await laws(D);await capture('mobile-opening-'+width);await checkFraming('mobile-opening-'+width);
  for(const [i,trial]of lesson.tryIt.entries()){
   await tools.getByRole('button',{name:'Try it yourself',exact:true}).click();await page.locator('[data-experiment]').nth(i).click();await tools.getByRole('button',{name:'Controls',exact:true}).click();await laws(trial.values);await capture(`mobile-preset-${i}-${width}`);await checkFraming(`mobile-preset-${i}-${width}`);
   await action('Finish both sounds');expectedModel.advance(expectedModel.duration());await compareCurrent();await action('Inspect: '+inspect[trial.part]);await capture(`mobile-completed-${i}-${width}`);await checkFraming(`mobile-completed-${i}-${width}`);
  }
  await action('Inspect: source and filter');await page.locator('[data-separation]').fill('100');await capture('mobile-separated-'+width);await page.locator('[data-reassemble]').click();
  await focusPart('source');await hitPart('Periodic voice or turbulence');await capture('mobile-source-'+width);await action('Inspect: source and filter');await page.screenshot({path:output+'/mobile-page-'+width+'.png'});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
 }
 for(const width of process.env.SKIP_BOOKMARKS?[]:[1440,390,320])for(const id of ['source','filters','output','spectrum','spectrogram','vowels','comparison']){
  await page.setViewportSize({width,height:width===320?568:width===390?844:1000});await page.goto(new URL('#machine/phonemes?part='+id,base).href);
  const name=expectedModel.parts.find(p=>p.id===id).name;await page.waitForFunction(name=>document.querySelector('.daily-part-detail h3')?.textContent===name,name);await laws(D);await capture(`bookmark-${id}-${width}`);await checkFraming(`bookmark-${id}-${width}`);
  const before=await page.evaluate(()=>window.speechViewProbe);await page.getByRole('button',{name:'Front',exact:true}).click();await canvas.scrollIntoViewIfNeeded();await canvas.screenshot();const after=await page.evaluate(()=>window.speechViewProbe);
  const differences=Object.fromEntries(['projectionMatrix','modelViewMatrix'].map(key=>{assert.equal(before[key].length,16);assert.equal(after[key].length,16);assert(before[key].concat(after[key]).every(Number.isFinite));const difference=Math.max(...before[key].map((v,i)=>Math.abs(v-after[key][i])));assert(difference<1e-12,`${id}/${width}: bookmark opens in authored front view`);return [key,difference];}));bookmarkViews.push({id,width,differences});
  await page.getByRole('button',{name:'Side',exact:true}).click();await canvas.screenshot();const side=await page.evaluate(()=>window.speechViewProbe);assert(side.modelViewMatrix.some((v,i)=>Math.abs(v-before.modelViewMatrix[i])>1e-5),'Camera probe distinguishes a different angle');
 }
 await page.setViewportSize({width:390,height:844});await action('Inspect: source and filter');const session=await page.context().newCDPSession(page);
 async function pinch(from,to){await canvas.scrollIntoViewIfNeeded();const b=await canvas.boundingBox(),x=b.x+b.width/2,y=b.y+b.height/2,points=d=>[{x:x-d,y,id:0},{x:x+d,y,id:1}];await session.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:points(from)});for(let i=1;i<=12;i++)await session.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:points(from+(to-from)*i/12)});await session.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});}
 try{await pinch(120,20);assert(Number(await page.locator('[data-separation]').inputValue())>0);await capture('mobile-pinch');await pinch(20,120);await page.waitForFunction(()=>document.querySelector('[data-separation]').value==='0');}finally{await session.detach();}
 await page.setViewportSize({width:1440,height:1000});await preset(0);await edit('sound',1);await page.waitForFunction(()=>document.querySelector('.daily-readings').textContent.includes('sound Ready'));
 expectedModel.reset({settings:D});const sourceSamples=Float32Array.from(expectedModel.scientificPlan().samples);
 await page.locator('[data-play]').click();const amplitudes=[];for(let i=0;i<110;i++){amplitudes.push(await rms());await page.waitForTimeout(25);}
 const rendered=await page.evaluate(()=>{const p=window.speechAudioProbe,s=p.sources[0];return {rate:p.context.sampleRate,inputRate:s.buffer.sampleRate,buffer:Array.from(s.buffer.getChannelData(0)),pcm:p.blocks.flat()};});
 assert.deepEqual(rendered.buffer,Array.from(sourceSamples),'Actual browser source contains exact synthesized samples');
 assert(amplitudes.some(v=>v>.01)&&amplitudes.some(v=>v<1e-5),'Actual synthesized signal and silence reached audio graph');
 const reference=Array.from({length:Math.floor(sourceSamples.length*rendered.rate/rendered.inputRate)},(_,i)=>{const x=i*rendered.inputRate/rendered.rate,j=Math.floor(x),f=x-j;return (sourceSamples[j]??0)*(1-f)+(sourceSamples[j+1]??0)*f;});
 await writeFile(output+'/rendered-audio.json',JSON.stringify({rendered,reference}));
 const size=2**Math.ceil(Math.log2(reference.length+rendered.pcm.length-1)),ar=new Float64Array(size),ai=new Float64Array(size),br=new Float64Array(size),bi=new Float64Array(size);
 ar.set(rendered.pcm);br.set([...reference].reverse());fft(ar,ai);fft(br,bi);
 for(let i=0;i<size;i++){const re=ar[i]*br[i]-ai[i]*bi[i],im=ar[i]*bi[i]+ai[i]*br[i];ar[i]=re;ai[i]=-im;}fft(ar,ai);
 const rr=reference.reduce((sum,x)=>sum+x*x,0),prefix=new Float64Array(rendered.pcm.length+1);for(let i=0;i<rendered.pcm.length;i++)prefix[i+1]=prefix[i]+rendered.pcm[i]**2;
 let correlation=-1,bestOffset=0;
 for(let offset=0;offset<=rendered.pcm.length-reference.length;offset++){const energy=prefix[offset+reference.length]-prefix[offset],score=ar[offset+reference.length-1]/size/Math.sqrt(energy*rr);if(score>correlation){correlation=score;bestOffset=offset;}}
 let dot=0,energy=0,referenceEnergy=0;for(let i=0;i<reference.length;i++){const x=rendered.pcm[bestOffset+i],y=reference[i];dot+=x*y;energy+=x*x;referenceEnergy+=y*y;}correlation=dot/Math.sqrt(energy*referenceEnergy);
 assert(correlation>.97&&correlation<=1+1e-12,`Rendered audio correlates with synthesized samples: ${correlation}`);
 if(await page.locator('[data-play]').getAttribute('aria-pressed')==='true')await page.locator('[data-play]').click();
 await preset(0);await edit('sound',1);await page.locator('[data-play]').click();await page.waitForTimeout(650);await page.locator('[data-play]').click();await page.waitForTimeout(120);assert((await rms())<1e-5,'Pause stops synthesized audio');
 const paused=await clock();await page.locator('[data-play]').click();await page.waitForTimeout(80);const offset=await page.evaluate(()=>window.speechAudioProbe.sources.length);assert(offset>=2,'Resume creates a fresh one-shot source');await edit('sound',0);await page.waitForTimeout(120);assert((await rms())<1e-5,'Sound off stops audio');
 if(await page.locator('[data-play]').getAttribute('aria-pressed')==='true')await page.locator('[data-play]').click();
 await reset();audioEvidence={amplitudes,renderedRate:rendered.rate,sourceRate:rendered.inputRate,sourceSamples:sourceSamples.length,renderedSamples:rendered.pcm.length,correlation,bestOffset,paused,pauseMutes:true,offMutes:true,exactSource:true};
 for(const [i]of lesson.quiz.options.entries()){await page.locator('[data-answer]').nth(i).click();assert.equal(await page.locator('.daily-answer').innerText(),(i===lesson.quiz.answer?'That’s right. ':'Try thinking through the parts again. ')+lesson.quiz.explanation);}
 await page.getByText('Learn more',{exact:true}).click();for(const source of lesson.sources)assert.equal(await page.locator(`.daily-lesson a[href="${source.url}"]`).innerText(),source.title);
 await page.locator('.daily-return').click();assert(!page.url().endsWith('#machine/phonemes'));assert.deepEqual(errors,[]);
 const report={passed:true,bookmarksDeferred:Boolean(process.env.SKIP_BOOKMARKS),outcomes,controls,actions,selections,physicalHits,framing,bookmarkViews,audioEvidence,pause:true,step:true,completion:true,replay:true,preparedReset:true,keyboardRate:true,referencePreservesTime:true,objectDrag:true,backgroundRotation:true,zoomOnlyButtons:true,wheelSeparation:true,pinch:true,mobileWidths:[390,320],quiz:true,return:true,errors};
 await writeFile(output+'/browser.json',JSON.stringify(report,null,2));console.log(JSON.stringify({passed:true,presets:outcomes.length,controlValues:controls.length,actions:actions.length,parts:selections.length,physicalHits:physicalHits.length,framingChecks:framing.length,audio:true,errors}));
}catch(error){await writeFile(output+'/failure.json',JSON.stringify({message:error.message,errors,url:page.url(),body:await page.locator('body').innerText().catch(()=> '')},null,2));await page.screenshot({path:output+'/failure.png'}).catch(()=>{});throw error;}
finally{expectedModel.dispose();await browser.close();}

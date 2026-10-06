import assert from 'node:assert/strict';
import {mkdir, writeFile} from 'node:fs/promises';
import {chromium} from 'playwright';
import {reviewedCdLesson as lesson} from './cd-lesson.js';
import {createCdModel} from './cd-model.js';
import {CD_DEFAULTS as D} from './cd-physics.js';
import {fft} from './speech-physics.js';
const expectedModel = createCdModel();
const base = process.env.SITE_URL || 'http://127.0.0.1:4173/', output = process.env.EVIDENCE_DIR || 'documentation/cd-browser';
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
    assert.ok((bounds.right-bounds.left+1)/bounds.width>.55&&(bounds.bottom-bounds.top+1)/bounds.height>.35,`${name}: Connected player fills a useful portion of the canvas ${JSON.stringify(bounds)}`);
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
  if(expectedModel.getState().values.sound)expected['Read clock and audio clock']=expected['Read clock and audio clock'].replace(/sound (Audio unavailable|Waiting for browser audio)/,'sound Ready');
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
  const request=window.requestAnimationFrame.bind(window);window.cdPastFrame=false;window.requestAnimationFrame=callback=>request(time=>{if(window.cdPastFrame){window.cdPastFrame=false;callback(performance.now()-100);}else callback(time);});
  window.cdViewProbe={drawMatrices:[]};window.cdCaptureDrawMatrices=location.hash.includes('?part=');
  for(const type of ['WebGLRenderingContext','WebGL2RenderingContext']){
    const proto=window[type]?.prototype;if(!proto)continue;const locations=new WeakMap(),programs=new WeakMap(),get=proto.getUniformLocation,write=proto.uniformMatrix4fv,clear=proto.clear;
    proto.getUniformLocation=function(program,name){const location=get.call(this,program,name);if(location){locations.set(location,name);if(!programs.has(program))programs.set(program,{});programs.get(program)[name]=location;}return location;};
    proto.uniformMatrix4fv=function(location,transpose,data,...rest){const name=locations.get(location);if(['projectionMatrix','modelViewMatrix'].includes(name))window.cdViewProbe[name]=Array.from(data);return write.call(this,location,transpose,data,...rest);};
    proto.clear=function(...args){if(window.cdCaptureDrawMatrices)window.cdViewProbe.drawMatrices=[];return clear.apply(this,args);};
    for(const method of ['drawElements','drawArrays','drawElementsInstanced','drawArraysInstanced']){const draw=proto[method];if(!draw)continue;proto[method]=function(...args){if(window.cdCaptureDrawMatrices){const program=this.getParameter(this.CURRENT_PROGRAM),location=programs.get(program)?.modelViewMatrix;if(location)window.cdViewProbe.drawMatrices.push(Array.from(this.getUniform(program,location)));}return draw.apply(this,args);};}
  }
  const Original=window.AudioContext;
  window.AudioContext=class extends Original{
    constructor(...args){
      super(...args);const original=this.createBufferSource.bind(this),context=this,analyser=this.createAnalyser();analyser.fftSize=2048;
      const tap=this.createScriptProcessor(512,2,1),silent=this.createGain();silent.gain.value=0;tap.connect(silent);silent.connect(this.destination);
      const probe={context,analyser,blocks:[[],[]],sources:[]};window.cdAudioProbe=probe;
      tap.onaudioprocess=e=>{for(let ch=0;ch<2;ch++)probe.blocks[ch].push(Array.from(e.inputBuffer.getChannelData(ch)));};
      this.createBufferSource=()=>{const source=original();source.connect(analyser);source.connect(tap);probe.sources.push(source);return source;};
    }
  };
});
const steps=async count=>page.locator('[data-step]').evaluate((button,n)=>{for(let i=0;i<n;i++)button.click();},count);
const finish=async()=>{await steps(200);expectedModel.advance(100);};
const clock=async()=>parseFloat(await reading('Read clock and audio clock').innerText());
const rms=()=>page.evaluate(()=>{const p=window.cdAudioProbe;if(!p)return null;const values=new Float32Array(p.analyser.fftSize);p.analyser.getFloatTimeDomainData(values);return Math.sqrt(values.reduce((s,v)=>s+v*v,0)/values.length);});
const inspect=Object.fromEntries(expectedModel.actions.map(a=>[a.part,a.label]));
async function focusPart(id){
  if(inspect[id])return action(inspect[id]);
  await action('Inspect: complete CD player');await page.getByRole('button',{name:'Whole machine',exact:true}).click();
  const chain=[];let part=expectedModel.parts.find(p=>p.id===id);while(part){chain.unshift(part.id);part=expectedModel.parts.find(p=>p.id===part.parentId);}
  for(const target of chain)await page.locator(`button[data-part="${target}"]`).click();
  await page.locator('[data-isolate]').check();await page.getByRole('button',{name:'Front',exact:true}).click();
}
function correlationWith(reference,pcm){
  const size=2**Math.ceil(Math.log2(reference.length+pcm.length-1)),ar=new Float64Array(size),ai=new Float64Array(size),br=new Float64Array(size),bi=new Float64Array(size);
  ar.set(pcm);br.set([...reference].reverse());fft(ar,ai);fft(br,bi);
  for(let i=0;i<size;i++){const re=ar[i]*br[i]-ai[i]*bi[i],im=ar[i]*bi[i]+ai[i]*br[i];ar[i]=re;ai[i]=-im;}fft(ar,ai);
  const rr=reference.reduce((s,x)=>s+x*x,0),prefix=new Float64Array(pcm.length+1);for(let i=0;i<pcm.length;i++)prefix[i+1]=prefix[i]+pcm[i]**2;
  let score=-1,offset=0;
  for(let i=0;i<=pcm.length-reference.length;i++){const energy=prefix[i+reference.length]-prefix[i];if(energy<=rr*1e-12)continue;const r=ar[i+reference.length-1]/size/Math.sqrt(energy*rr);if(r>score){score=r;offset=i;}}
  let xy=0,xx=0;for(let i=0;i<reference.length;i++){xy+=pcm[offset+i]*reference[i];xx+=pcm[offset+i]**2;}
  return {correlation:xy/Math.sqrt(xx*rr),offset};
}
let audioEvidence;
try{
  await page.goto(new URL('#machine/cd',base).href);await canvas.waitFor();await page.getByRole('heading',{name:'CD',level:1,exact:true}).waitFor();
  assert.equal(await page.locator('[data-control]').count(),7);await laws(D);await capture('opening');await checkFraming('opening');await page.screenshot({path:output+'/opening-page.png'});
  await canvas.focus();await page.keyboard.press('Home');await laws(D);await capture('home');await checkFraming('home');
  await action('Inspect: spot and transitions');await page.getByRole('button',{name:'Whole machine',exact:true}).click();await laws(D);await capture('whole-machine');await checkFraming('whole-machine');
  await reset();await steps(1);await laws(D,.0625);await reset();
  for(const [i,trial]of lesson.tryIt.entries()){
    await preset(i);for(const [key,value]of Object.entries(trial.values))assert.equal(Number(await page.locator(`[data-control="${key}"]`).inputValue()),value);
    await laws(trial.values);await capture('preset-'+i);await checkFraming('preset-'+i);await steps(32);await laws(trial.values,2);await capture('preset-moving-'+i);
    await finish();outcomes.push({title:trial.title,...await compareCurrent()});await action(inspect[trial.part]);await capture('preset-completed-'+i);await checkFraming('preset-completed-'+i);
    console.log(`Preset ${i+1}/${lesson.tryIt.length}: ${trial.title}`);
  }
  await preset(2);await page.locator('[data-play]').click();await page.waitForTimeout(650);await page.locator('[data-play]').click();const held=await page.locator('.daily-readings').innerText();await page.waitForTimeout(250);assert.equal(await page.locator('.daily-readings').innerText(),held,'Pause freezes readings');
  await preset(2);await page.locator('[data-play]').click();await page.waitForFunction(()=>document.querySelector('[data-play]').getAttribute('aria-pressed')==='false',null,{timeout:12000});await laws(D,6.65);await capture('completed');await checkFraming('completed');
  await page.evaluate(()=>{window.cdPastFrame=true;});await page.locator('[data-play]').click();await page.waitForTimeout(180);await page.locator('[data-play]').click();assert(await clock()>0&&await clock()<1,'Completed replay restarts despite an earlier frame timestamp');assert.deepEqual(errors,[]);
  await preset(10);await laws(lesson.tryIt[10].values);await finish();await page.locator('[data-play]').click();await page.waitForTimeout(160);await page.locator('[data-play]').click();assert(await clock()>0&&await clock()<1);assert.equal(await page.locator('[data-control="loss"]').inputValue(),'3','Prepared loss setting survives replay');
  for(const control of expectedModel.controls){
    const values=control.options?.map(o=>o.value)??Array.from({length:Math.round((control.max-control.min)/control.step)+1},(_,i)=>control.min+i*control.step);
    for(const value of values){
      await reset();expectedModel.reset();await edit(control.key,value);expectedModel.update({[control.key]:value});await compareCurrent();await steps(16);expectedModel.advance(1);const moving=await compareCurrent();await finish();controls.push({key:control.key,value,moving,completed:await compareCurrent()});
    }
    console.log(`Control checked: ${control.key}`);
  }
  await reset();await steps(16);await laws(D,1);await edit('phase',2);expectedModel.update({phase:2});await compareCurrent();assert.equal(await clock(),1,'Separate interference experiment preserves read progress');
  for(const [i,a]of expectedModel.actions.entries()){
    const before=await page.locator('.daily-readings').innerText();await action(a.label);assert.equal(await page.locator('.daily-readings').innerText(),before);actions.push({name:a.label,...await compareCurrent()});await capture(`action-${i}`);await checkFraming(`action-${i}`);
  }
  await action('Inspect: complete CD player');for(const view of ['Front','Side','Back','Top','Underneath','Angled']){await page.getByRole('button',{name:view,exact:true}).click();await capture(`view-${view.toLowerCase()}`);await checkFraming(`view-${view}`);}
  await action('Inspect: complete CD player');await page.locator('[data-cutaway]').uncheck();await capture('case-closed');await page.locator('[data-cutaway]').check();await capture('case-open');
  await page.locator('[data-separation]').fill('100');await capture('separated');assert((await page.locator('.daily-inventory-labels').innerText()).includes('Left powered speaker'));await page.locator('[data-reassemble]').click();
  await reset();await page.locator('[data-number="radius"]').fill('41');await page.locator('[data-number="radius"]').press('Tab');await laws({...D,radius:41});await capture('keyboard-radius');
  for(const part of expectedModel.parts){await reset();await focusPart(part.id);assert.equal(await page.locator('.daily-part-detail h3').innerText(),part.name);await laws(D);selections.push({id:part.id,name:part.name});await capture('part-'+part.id);await checkFraming('part-'+part.id);}
  for(const id of ['disc','pickup','left-output','electronics']){
    const name=expectedModel.parts.find(p=>p.id===id).name;await reset();await focusPart(id);const hit=await hitPart(name);await page.mouse.click(...hit);assert.equal(await popup.innerText(),name);physicalHits.push(name);await capture('popup-'+id);
    if(id==='left-output'){
      const box=await canvas.boundingBox();await page.mouse.move(box.x+10,box.y+10);const before=await canvas.screenshot(),matrixBefore=await page.evaluate(()=>window.cdViewProbe.modelViewMatrix);await page.mouse.move(...hit);await page.mouse.down();await page.mouse.move(hit[0]+35,hit[1]+20,{steps:10});await page.mouse.up();await page.mouse.move(box.x+10,box.y+10);assert(!before.equals(await canvas.screenshot()),'Object drag translates assembly');
      const after=await page.evaluate(()=>window.cdViewProbe.modelViewMatrix);for(const i of [0,1,2,4,5,6,8,9,10])assert(Math.abs(after[i]-matrixBefore[i])<1e-7);assert(Math.hypot(...[12,13,14].map(i=>after[i]-matrixBefore[i]))>.01,'Object drag changes translation');
    }
    await page.locator('.daily-heading h1').click();assert.equal(await popup.isVisible(),false);
  }
  await reset();await action('Inspect: complete CD player');await canvas.scrollIntoViewIfNeeded();let box=await canvas.boundingBox();await page.mouse.move(box.x+15,box.y+15);assert.equal(await popup.isVisible(),false);const beforeRotate=await canvas.screenshot();await page.mouse.down();await page.mouse.move(box.x+95,box.y+55,{steps:12});await page.mouse.up();assert(!beforeRotate.equals(await canvas.screenshot()),'Background drag rotates');
  await action('Inspect: complete CD player');const beforeZoom=await canvas.screenshot();await page.locator('[data-view="in"]').click();assert(!beforeZoom.equals(await canvas.screenshot()));assert.equal(await page.locator('[data-separation]').inputValue(),'0');await page.locator('[data-view="out"]').click();
  await canvas.scrollIntoViewIfNeeded();box=await canvas.boundingBox();await page.mouse.move(box.x+15,box.y+15);const beforeSeparation=await page.locator('.daily-readings').innerText();for(let i=0;i<8;i++)await page.mouse.wheel(0,240);await page.waitForFunction(()=>document.querySelector('[data-separation]').value==='100');assert.equal(await page.locator('.daily-readings').innerText(),beforeSeparation);await capture('grouped-parts');await page.locator('[data-reassemble]').click();
  for(const width of [390,320]){
    await page.setViewportSize({width,height:width===390?844:568});await page.reload();await canvas.waitFor();const tools=page.getByRole('navigation',{name:'Lesson tools'});await laws(D);await capture('mobile-opening-'+width);await checkFraming('mobile-opening-'+width);
    for(const [i,trial]of lesson.tryIt.entries()){
      await tools.getByRole('button',{name:'Try it yourself',exact:true}).click();await page.locator('[data-experiment]').nth(i).click();await tools.getByRole('button',{name:'Controls',exact:true}).click();await laws(trial.values);await capture(`mobile-preset-${i}-${width}`);await checkFraming(`mobile-preset-${i}-${width}`);
      await finish();await compareCurrent();await action(inspect[trial.part]);await capture(`mobile-completed-${i}-${width}`);await checkFraming(`mobile-completed-${i}-${width}`);
    }
    await action('Inspect: complete CD player');await page.locator('[data-separation]').fill('100');await capture('mobile-separated-'+width);await page.locator('[data-reassemble]').click();
    await focusPart('left-output');await hitPart('Left powered speaker');await capture('mobile-speaker-'+width);await action('Inspect: complete CD player');await page.screenshot({path:output+'/mobile-page-'+width+'.png'});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));console.log(`Phone width checked: ${width}`);
  }
  await page.evaluate(()=>{window.cdCaptureDrawMatrices=true;});
  for(const width of process.env.SKIP_BOOKMARKS?[]:[1440,390,320])for(const id of ['pickup','track','codec','errors','waveform','layers','phase','spin']){
    await page.setViewportSize({width,height:width===320?568:width===390?844:1000});await page.goto(new URL('#machine/cd?part='+id,base).href);const name=expectedModel.parts.find(p=>p.id===id).name;
    await page.waitForFunction(name=>document.querySelector('.daily-part-detail h3')?.textContent===name,name);await laws(D);await capture(`bookmark-${id}-${width}`);await checkFraming(`bookmark-${id}-${width}`);
    const before=await page.evaluate(()=>window.cdViewProbe);await page.getByRole('button',{name:'Front',exact:true}).click();await canvas.scrollIntoViewIfNeeded();await canvas.screenshot();const after=await page.evaluate(()=>window.cdViewProbe);
    // Read each matrix at its actual draw. Uniform-write caching otherwise
    // makes the last observed matrix belong to different physical meshes.
    const order=matrices=>matrices.map(matrix=>({matrix,key:matrix.map(v=>Number(v.toFixed(12))).join(',')})).sort((a,b)=>a.key.localeCompare(b.key));
    const a=order(before.drawMatrices),b=order(after.drawMatrices);assert(a.length>0);assert.deepEqual(a.map(x=>x.key),b.map(x=>x.key),`${id}/${width}: same drawn transforms`);
    const differences={projectionMatrix:Math.max(...before.projectionMatrix.map((v,i)=>Math.abs(v-after.projectionMatrix[i]))),drawModelViewMatrix:Math.max(...a.flatMap((row,j)=>row.matrix.map((v,i)=>Math.abs(v-b[j].matrix[i]))))};
    assert(Object.values(differences).every(v=>v<1e-12),`${id}/${width}: bookmark uses authored view`);bookmarkViews.push({id,width,differences,draws:a.length});
  }
  await page.evaluate(()=>{window.cdCaptureDrawMatrices=false;});await page.setViewportSize({width:390,height:844});await action('Inspect: complete CD player');const session=await page.context().newCDPSession(page);
  async function pinch(from,to){await canvas.scrollIntoViewIfNeeded();const b=await canvas.boundingBox(),x=b.x+b.width/2,y=b.y+b.height/2,points=d=>[{x:x-d,y,id:0},{x:x+d,y,id:1}];await session.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:points(from)});for(let i=1;i<=12;i++)await session.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:points(from+(to-from)*i/12)});await session.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});}
  try{await pinch(120,20);assert(Number(await page.locator('[data-separation]').inputValue())>0);await capture('mobile-pinch');await pinch(20,120);await page.waitForFunction(()=>document.querySelector('[data-separation]').value==='0');}finally{await session.detach();}
  await page.setViewportSize({width:1440,height:1000});await preset(2);await steps(143);await edit('sound',1);await page.waitForFunction(()=>document.querySelector('.daily-readings').textContent.includes('sound Ready'));
  expectedModel.reset();const expectedAudio=expectedModel.scientificPlan().read.audio;
  await page.evaluate(()=>{window.cdAudioProbe.blocks=[[],[]];});await page.locator('[data-play]').click();const amplitudes=[];for(let i=0;i<35;i++){amplitudes.push(await rms());await page.waitForTimeout(25);}
  const rendered=await page.evaluate(()=>{const p=window.cdAudioProbe,source=p.sources.at(-1);return {rate:p.context.sampleRate,inputRate:source.buffer.sampleRate,buffer:[0,1].map(ch=>Array.from(source.buffer.getChannelData(ch))),pcm:p.blocks.map(channel=>channel.flat())};});
  assert.deepEqual(rendered.buffer,expectedAudio.map(x=>Array.from(x)),'Actual browser AudioBuffer contains exact recovered stereo PCM');assert(amplitudes.some(v=>v>.01)&&amplitudes.some(v=>v<1e-5),'Sound and silence reach audio graph');
  const correlations=expectedAudio.map((samples,ch)=>{
    const reference=Array.from({length:Math.floor(samples.length*rendered.rate/rendered.inputRate)},(_,i)=>{const x=i*rendered.inputRate/rendered.rate,j=Math.floor(x),f=x-j;return (samples[j]??0)*(1-f)+(samples[j+1]??0)*f;});
    const result=correlationWith(reference,rendered.pcm[ch]);assert(result.correlation>.99&&result.correlation<=1+1e-12,`Rendered channel ${ch} matches recovered samples: ${result.correlation}`);return result;
  });
  await writeFile(output+'/rendered-audio.json',JSON.stringify(rendered));
  if(await page.locator('[data-play]').getAttribute('aria-pressed')==='true')await page.locator('[data-play]').click();
  await preset(2);await steps(148);await edit('sound',1);await page.locator('[data-play]').click();await page.waitForTimeout(60);await page.locator('[data-play]').click();await page.waitForTimeout(120);assert((await rms())<1e-5,'Pause mutes decoded audio');
  const paused=await clock();await page.locator('[data-play]').click();await page.waitForTimeout(40);await edit('sound',0);await page.waitForTimeout(120);assert((await rms())<1e-5,'Sound off mutes audio');if(await page.locator('[data-play]').getAttribute('aria-pressed')==='true')await page.locator('[data-play]').click();await reset();
  audioEvidence={exactStereoBuffer:true,sourceRate:rendered.inputRate,renderedRate:rendered.rate,correlations,amplitudes,paused,pauseMutes:true,offMutes:true};
  for(const [i]of lesson.quiz.options.entries()){await page.locator('[data-answer]').nth(i).click();assert.equal(await page.locator('.daily-answer').innerText(),(i===lesson.quiz.answer?'That’s right. ':'Try thinking through the parts again. ')+lesson.quiz.explanation);}
  await page.getByText('Learn more',{exact:true}).click();for(const source of lesson.sources)assert.equal(await page.locator(`.daily-lesson a[href="${source.url}"]`).innerText(),source.title);
  await page.locator('.daily-return').click();assert(!page.url().endsWith('#machine/cd'));assert.deepEqual(errors,[]);
  const report={passed:true,bookmarksDeferred:Boolean(process.env.SKIP_BOOKMARKS),outcomes,controls,actions,selections,physicalHits,framing,bookmarkViews,audioEvidence,pause:true,step:true,completion:true,replay:true,preparedReset:true,keyboardRadius:true,phasePreservesTime:true,objectDrag:true,backgroundRotation:true,zoomOnlyButtons:true,wheelSeparation:true,pinch:true,mobileWidths:[390,320],quiz:true,return:true,errors};
  await writeFile(output+'/browser.json',JSON.stringify(report,null,2));console.log(JSON.stringify({passed:true,presets:outcomes.length,controlValues:controls.length,actions:actions.length,parts:selections.length,physicalHits:physicalHits.length,framingChecks:framing.length,audio:true,errors}));
}catch(error){await writeFile(output+'/failure.json',JSON.stringify({message:error.message,errors,url:page.url(),body:await page.locator('body').innerText().catch(()=> '')},null,2));await page.screenshot({path:output+'/failure.png'}).catch(()=>{});throw error;}
finally{expectedModel.dispose();await browser.close();}

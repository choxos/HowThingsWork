import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {chromium} from 'playwright';
import {createMagneticAlarmModel} from './magnetic-alarm-model.js';
import {magneticAlarmLesson as lesson} from './magnetic-alarm-lesson.js';

const base=process.env.SITE_URL||'http://127.0.0.1:5215/',output=process.env.EVIDENCE_DIR||'documentation/magnetic-alarm-browser';
await mkdir(output,{recursive:true});
const expected=createMagneticAlarmModel(),browser=await chromium.launch({channel:'chrome',headless:true,args:['--use-angle=metal']});
const page=await browser.newPage({viewport:{width:1440,height:1000},hasTouch:true,reducedMotion:'reduce'});page.setDefaultTimeout(40000);
const errors=[],consoleErrors=[],presets=[],controls=[],frames=[],parts=[],histories=[];
page.on('pageerror',error=>errors.push(error.message));page.on('console',message=>{if(message.type()==='error')consoleErrors.push(message.text());});
await page.addInitScript(()=>{
  window.magneticAlarmMatrices={};
  for(const name of ['WebGLRenderingContext','WebGL2RenderingContext']) {
    const proto=window[name]?.prototype;if(!proto)continue;
    const names=new WeakMap(),get=proto.getUniformLocation,write=proto.uniformMatrix4fv;
    proto.getUniformLocation=function(program,name){const location=get.call(this,program,name);if(location)names.set(location,name);return location;};
    proto.uniformMatrix4fv=function(location,transpose,data,...rest){if(names.get(location)==='modelViewMatrix')window.magneticAlarmMatrices.modelView=Array.from(data);return write.call(this,location,transpose,data,...rest);};
  }
  const Audio=window.AudioContext;
  window.AudioContext=class extends Audio {
    constructor(...args){super(...args);const create=this.createGain.bind(this),context=this;this.createGain=()=>{const gain=create(),analyser=context.createAnalyser();analyser.fftSize=4096;gain.connect(analyser);window.magneticAlarmAudio={context,gain,analyser};return gain;};}
  };
});
const canvas=page.locator('canvas'),action=name=>page.getByRole('button',{name,exact:true}).click();
const values=()=>page.locator('.daily-readings > div').evaluateAll(rows=>Object.fromEntries(rows.map(row=>[row.querySelector('dt').textContent,row.querySelector('dd').textContent])));
async function compare() {
  const actual=await values(),wanted=Object.fromEntries(expected.getState().readings.map(row=>[row.label,row.value]));
  if(expected.getState().values.sound){actual['Observation and audio']=actual['Observation and audio'].split(' · sound ')[0];wanted['Observation and audio']=wanted['Observation and audio'].split(' · sound ')[0];}
  assert.deepEqual(actual,wanted);return actual;
}
const reset=async()=>{await action('Reset experiment');expected.reset();await compare();};
const steps=async count=>{await page.locator('[data-step]').evaluate((button,count)=>{for(let i=0;i<count;i++)button.click();},count);for(let i=0;i<count;i++)expected.playback.step();await compare();};
async function edit(key,value) {
  const input=page.locator(`[data-control="${key}"]`);
  if(await input.evaluate(element=>element.tagName==='SELECT'))await input.selectOption(String(value));
  else{const number=page.locator(`[data-number="${key}"]`);await number.fill(String(value));await number.press('Tab');}
  expected.update({[key]:value});await compare();
}
async function preset(index,mobile=false) {
  const tools=page.getByRole('navigation',{name:'Lesson tools'});
  await (mobile?tools.getByRole('button',{name:'Try it yourself',exact:true}):page.getByRole('tab',{name:'Try it yourself',exact:true})).click();
  await page.locator('[data-experiment]').nth(index).click();expected.reset(lesson.tryIt[index].initialState);await compare();
  await (mobile?tools.getByRole('button',{name:'Controls',exact:true}):page.getByRole('tab',{name:'Controls',exact:true})).click();
}
async function focus(id) {
  await action('Whole machine');const chain=[];let part=expected.parts.find(part=>part.id===id);
  while(part){chain.unshift(part.id);part=expected.parts.find(candidate=>candidate.id===part.parentId);}
  for(const key of chain)await page.locator(`[data-part="${key}"]`).click();
  await page.locator('[data-isolate]').check();await action('Front');
}
async function capture(name,contextCrop=false) {
  await canvas.scrollIntoViewIfNeeded();await page.mouse.move(4,4);await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
  const png=await canvas.screenshot({path:`${output}/${name}.png`});
  const bounds=await page.evaluate(async encoded=>{
    const bitmap=await createImageBitmap(new Blob([Uint8Array.from(atob(encoded),value=>value.charCodeAt(0))],{type:'image/png'}));
    const surface=document.createElement('canvas');surface.width=bitmap.width;surface.height=bitmap.height;
    const context=surface.getContext('2d');context.drawImage(bitmap,0,0);bitmap.close();
    const {data}=context.getImageData(0,0,surface.width,surface.height),origin=(5*surface.width+5)*4;
    let left=surface.width,top=surface.height,right=-1,bottom=-1;
    for(let y=8;y<surface.height-8;y++)for(let x=8;x<surface.width-8;x++) {
      const i=(y*surface.width+x)*4;
      if(Math.abs(data[i]-data[origin])+Math.abs(data[i+1]-data[origin+1])+Math.abs(data[i+2]-data[origin+2])>35){left=Math.min(left,x);right=Math.max(right,x);top=Math.min(top,y);bottom=Math.max(bottom,y);}
    }
    return {width:surface.width,height:surface.height,left,top,right,bottom};
  },png.toString('base64'));
  assert(bounds.right>bounds.left&&bounds.bottom>bounds.top,name+': model is drawn');
  if(!contextCrop)assert(bounds.left>8&&bounds.top>8&&bounds.right<bounds.width-9&&bounds.bottom<bounds.height-9,name+': clear margins '+JSON.stringify(bounds));
  frames.push({name,contextCrop,...bounds});assert.deepEqual(errors,[]);assert.deepEqual(consoleErrors,[]);
}
async function hit(name) {
  await canvas.scrollIntoViewIfNeeded();const box=await canvas.boundingBox(),popup=page.locator('.daily-part-popup');
  for(let y=1;y<20;y++)for(let x=1;x<20;x++) {
    const point=[box.x+box.width*x/20,box.y+box.height*y/20];await page.mouse.move(...point);
    if(await popup.isVisible()&&await popup.innerText()===name)return point;
  }
  assert.fail('No physical pointer target for '+name);
}
const audio=()=>page.evaluate(()=>{
  const p=window.magneticAlarmAudio;if(!p)return null;
  const time=new Float32Array(p.analyser.fftSize),bins=new Float32Array(p.analyser.frequencyBinCount);p.analyser.getFloatTimeDomainData(time);p.analyser.getFloatFrequencyData(bins);
  let peak=0;for(let i=1;i<bins.length;i++)if(bins[i]>bins[peak])peak=i;
  return {rms:Math.sqrt(time.reduce((sum,value)=>sum+value*value,0)/time.length),frequency:peak*p.context.sampleRate/p.analyser.fftSize,state:p.context.state};
});
try {
  await page.goto(new URL('#machine/magnetic-burglar-alarm',base).href);await canvas.waitFor({timeout:120000});
  await page.locator('[data-control="opening"]').waitFor();assert(await canvas.evaluate(element=>!!element.getContext('webgl2')));
  assert.equal(await page.locator('[data-control]').count(),8);await compare();await capture('opening');await page.screenshot({path:`${output}/opening-page.png`,fullPage:true});
  await steps(1);await reset();
  for(const [index,trial] of lesson.tryIt.entries()) {
    await preset(index);for(const [key,value] of Object.entries(trial.values))assert.equal(Number(await page.locator(`[data-control="${key}"]`).inputValue()),value);
    const start=await compare();await capture(`preset-${index}`);await steps(20);await capture(`moving-${index}`);await preset(index);
    await page.locator('[data-play]').click();await page.waitForFunction(()=>document.querySelector('[data-play]').getAttribute('aria-pressed')==='false',null,{timeout:16000});
    expected.advance(100);const completed=await compare();await capture(`completed-${index}`);
    await page.locator('[data-play]').click();await page.waitForTimeout(150);await page.locator('[data-play]').click();const replay=await values();
    assert.notDeepEqual(replay,completed);assert(parseFloat(replay['Observation and audio'])<1);
    for(const [key,value] of Object.entries(trial.values))assert.equal(Number(await page.locator(`[data-control="${key}"]`).inputValue()),value);
    presets.push({title:trial.title,start,completed,replay});console.log(`Preset ${index+1}/${lesson.tryIt.length} passed.`);
  }
  await preset(0);await page.locator('[data-play]').click();await page.waitForTimeout(700);await page.locator('[data-play]').click();
  const paused=await values();await page.waitForTimeout(220);assert.deepEqual(await values(),paused);
  await reset();await steps(20);
  for(const state of ['open','closed']) {
    if(state==='closed')await steps(20);const before=await values();
    for(const [index,inspection] of expected.actions.filter(action=>action.part).entries()){await action(inspection.label);assert.deepEqual(await values(),before);await capture(`inspection-${state}-${index}`,!inspection.isolate);}
    histories.push({name:`Inspection preserves ${state} state`,readings:before});
  }
  await action('Inspect: complete installation');await action('Clear alarm memory');expected.actions.at(-1).run();await compare();assert.equal(expected.getState().alarm,false);await capture('cleared');
  await preset(9);await action('Clear alarm memory');expected.actions.at(-1).run();await compare();assert(expected.getState().resetBlocked);await capture('clear-refused');await steps(20);await action('Clear alarm memory');expected.actions.at(-1).run();await compare();assert(!expected.getState().alarm);
  for(const control of expected.controls) {
    const choices=control.options?.map(option=>option.value)??Array.from({length:Math.round((control.max-control.min)/control.step)+1},(_,i)=>control.min+i*control.step);
    for(const value of choices){await reset();await edit(control.key,value);await steps(20);await steps(20);controls.push({key:control.key,value,readings:await compare()});}
  }
  console.log(`All ${controls.length} individual browser control values passed; the native model check covers their 28,080 combinations.`);
  await preset(2);await steps(40);assert(expected.getState().alarm);await edit('magnet',1.2);await page.locator('[data-play]').click();await page.waitForFunction(()=>document.querySelector('[data-play]').getAttribute('aria-pressed')==='false');expected.reset({settings:{...lesson.tryIt[2].values,magnet:1.2}});expected.advance(10);await compare();assert(!expected.getState().alarm);await capture('stronger-magnet-holds');
  await preset(3);await steps(40);assert(expected.getState().alarm);await edit('spring',1);await page.locator('[data-play]').click();await page.waitForFunction(()=>document.querySelector('[data-play]').getAttribute('aria-pressed')==='false');expected.reset({settings:{...lesson.tryIt[3].values,spring:1}});expected.advance(10);await compare();assert(!expected.getState().alarm);await capture('lighter-spring-holds');
  await preset(0);await steps(20);await edit('armed',0);assert(!expected.getState().alarm);await edit('armed',1);assert(expected.getState().alarm);await edit('power',0);assert(!expected.getState().alarm);await edit('power',1);assert(expected.getState().alarm);await capture('power-restored-open-loop');
  await preset(0);await steps(40);await edit('cable',0);await capture('broken-cable');
  for(const part of expected.parts){await focus(part.id);assert.equal(await page.locator('.daily-part-detail h3').innerText(),part.name);await compare();await capture('part-'+part.id);parts.push(part.id);}
  await action('Inspect: complete installation');
  for(const view of ['Front','Side','Back','Top','Underneath','Angled']){await action(view);await capture('view-'+view.toLowerCase());}
  await action('Inspect: complete installation');await page.locator('[data-cutaway]').uncheck();const exterior=await canvas.screenshot();await capture('exterior');
  await page.locator('[data-cutaway]').check();await compare();assert(!exterior.equals(await canvas.screenshot()));await capture('cutaway');
  await page.locator('[data-cutaway]').uncheck();assert(exterior.equals(await canvas.screenshot()));await page.locator('[data-cutaway]').check();
  await page.locator('[data-separation]').fill('100');await capture('separated');await page.locator('[data-reassemble]').click();await compare();
  await focus('supply');const point=await hit('12 V teaching supply');await page.mouse.click(...point);assert.equal(await page.locator('.daily-part-popup').innerText(),'12 V teaching supply');
  await page.mouse.move(4,4);await canvas.screenshot();const before=await page.evaluate(()=>window.magneticAlarmMatrices.modelView);
  await page.mouse.move(...point);await page.mouse.down();await page.mouse.move(point[0]+30,point[1]+18,{steps:8});await page.mouse.up();await page.mouse.move(4,4);await canvas.screenshot();
  const after=await page.evaluate(()=>window.magneticAlarmMatrices.modelView);
  for(const i of [0,1,2,4,5,6,8,9,10])assert(Math.abs(before[i]-after[i])<1e-7,'Object drag preserves rotation');
  assert(Math.hypot(...[12,13,14].map(i=>after[i]-before[i]))>.01,'Object drag translates');
  await action('Inspect: complete installation');await canvas.scrollIntoViewIfNeeded();let box=await canvas.boundingBox();await page.mouse.move(box.x+15,box.y+15);assert.equal(await page.locator('.daily-part-popup').isVisible(),false);
  const rotationBefore=await canvas.screenshot();await page.mouse.down();await page.mouse.move(box.x+90,box.y+55,{steps:8});await page.mouse.up();assert(!rotationBefore.equals(await canvas.screenshot()));
  await action('Inspect: complete installation');const zoomBefore=await canvas.screenshot();await page.locator('[data-view="in"]').click();assert(!zoomBefore.equals(await canvas.screenshot()));assert.equal(await page.locator('[data-separation]').inputValue(),'0');await page.locator('[data-view="out"]').click();
  await canvas.focus();const keyboardBefore=await canvas.screenshot();await page.keyboard.press('ArrowRight');assert(!keyboardBefore.equals(await canvas.screenshot()));
  const rotateMatrix=await page.evaluate(()=>window.magneticAlarmMatrices.modelView);await page.keyboard.press('Shift+ArrowUp');await canvas.screenshot();const moveMatrix=await page.evaluate(()=>window.magneticAlarmMatrices.modelView);
  for(const i of [0,1,2,4,5,6,8,9,10])assert(Math.abs(rotateMatrix[i]-moveMatrix[i])<1e-7);assert(Math.hypot(...[12,13,14].map(i=>moveMatrix[i]-rotateMatrix[i]))>.01);
  await page.keyboard.press('Home');assert.equal(await page.locator('.daily-part-detail h3').count(),0);await compare();
  await action('Inspect: complete installation');await canvas.scrollIntoViewIfNeeded();box=await canvas.boundingBox();await page.mouse.move(box.x+box.width/2,box.y+box.height/2);
  for(let i=0;i<8&&Number(await page.locator('[data-separation]').inputValue())===0;i++){await page.mouse.wheel(0,120);await page.waitForTimeout(50);}assert(Number(await page.locator('[data-separation]').inputValue())>0);await capture('wheel-separated');
  await page.locator('[data-reassemble]').click();await page.locator('[data-labels]').check();await page.locator('button[data-label-part="sounder"]').click();await page.locator('[data-isolate]').check();assert.equal(await page.locator('.daily-part-detail h3').innerText(),'Powered sounder');
  await page.keyboard.press('Escape');assert.equal(await page.locator('.daily-part-detail h3').count(),0);await page.locator('button[data-label-part="sounder"]').click();await page.locator('.daily-heading h1').click();assert.equal(await page.locator('.daily-part-detail h3').count(),0);
  await page.locator('[data-labels]').uncheck();await action('Inspect: complete installation');await reset();await page.locator('[data-control="opening"]').focus();await page.keyboard.press('ArrowLeft');expected.update({opening:15.75});await compare();
  for(const width of [390,320]) {
    await page.setViewportSize({width,height:width===390?844:568});await page.reload();await canvas.waitFor({timeout:120000});await page.locator('[data-control="opening"]').waitFor();expected.reset();await compare();await capture('mobile-opening-'+width);
    for(let i=0;i<lesson.tryIt.length;i++){await preset(i,true);await steps(40);await capture(`mobile-completed-${i}-${width}`);}
    await action('Inspect: complete installation');await page.screenshot({path:`${output}/mobile-page-${width}.png`,fullPage:true});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
    await page.getByRole('navigation',{name:'Lesson tools'}).getByRole('button',{name:'Controls',exact:true}).click();await page.locator('[data-step]').click();await page.screenshot({path:`${output}/mobile-controls-${width}.png`});
  }
  const touch=await page.context().newCDPSession(page);
  async function pinch(from,to) {
    await canvas.scrollIntoViewIfNeeded();const b=await canvas.boundingBox(),x=b.x+b.width/2,y=b.y+b.height/2,points=distance=>[{x:x-distance,y,id:0},{x:x+distance,y,id:1}];
    await touch.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:points(from)});for(let i=1;i<=12;i++)await touch.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:points(from+(to-from)*i/12)});await touch.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
  }
  try{await pinch(100,15);assert(Number(await page.locator('[data-separation]').inputValue())>0);await capture('pinch-separated');await pinch(15,100);await page.waitForFunction(()=>document.querySelector('[data-separation]').value==='0');}finally{await touch.detach();}
  await page.setViewportSize({width:1440,height:1000});await preset(0);await edit('sound',1);await page.locator('[data-play]').click();
  await page.waitForFunction(()=>window.magneticAlarmAudio?.gain.gain.value>.01,null,{timeout:5000});await page.waitForTimeout(100);const tone=await audio();assert(tone.rms>.005&&Math.abs(tone.frequency-1000)<15);
  await page.locator('[data-play]').click();await page.waitForTimeout(120);const muted=await audio();assert(muted.rms<1e-5);
  await page.locator('[data-play]').click();await page.waitForTimeout(150);await page.locator('[data-control="sound"]').selectOption('0');await page.waitForTimeout(120);const disabled=await audio();assert(disabled.rms<1e-5);await page.locator('[data-play]').click();
  await reset();await edit('sound',1);await steps(40);assert((await audio()).rms<1e-5);await page.locator('[data-play]').click();await page.waitForTimeout(150);await page.locator('[data-play]').click();assert.equal(await page.locator('[data-control="sound"]').inputValue(),'0');
  const audioEvidence={tone,muted,disabled,completionMuted:true,replaySoundOff:true};await reset();
  for(const [index] of lesson.quiz.options.entries()){await page.locator('[data-answer]').nth(index).click();assert.equal(await page.locator('.daily-answer').innerText(),(index===lesson.quiz.answer?'That’s right. ':'Try thinking through the parts again. ')+lesson.quiz.explanation);}
  await page.getByText('Learn more',{exact:true}).click();for(const source of lesson.sources)assert.equal(await page.locator(`.daily-lesson a[href="${source.url}"]`).innerText(),source.title);
  await compare();await page.locator('.daily-return').click();assert(!page.url().endsWith('#machine/magnetic-burglar-alarm'));assert.deepEqual(errors,[]);assert.deepEqual(consoleErrors,[]);
  await writeFile(`${output}/browser.json`,JSON.stringify({passed:true,presets,controls,parts,frames,histories,audioEvidence,errors,consoleErrors,pause:true,replay:true,objectDrag:true,backgroundRotation:true,keyboard:true,wheel:true,labels:true,dismissal:true,pinch:true,mobileWidths:[390,320],nativeCombinations:28080},null,2));
  console.log(JSON.stringify({passed:true,presets:presets.length,controlValues:controls.length,parts:parts.length,frames:frames.length,audioEvidence}));
}catch(error){await writeFile(`${output}/failure.json`,JSON.stringify({message:error.message,errors,consoleErrors,url:page.url(),presets,controls,parts,frames,body:await page.locator('body').innerText().catch(()=> '')},null,2));await page.screenshot({path:`${output}/failure.png`,fullPage:true}).catch(()=>{});throw error;}
finally{expected.dispose();await browser.close();}

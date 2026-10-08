import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {chromium} from 'playwright';
import {createEReaderModel} from './e-reader-model.js';
import {eReaderLesson as lesson} from './e-reader-lesson.js';

const base=process.env.SITE_URL||'http://127.0.0.1:5215/',output=process.env.EVIDENCE_DIR||'documentation/e-reader-browser';
await mkdir(output,{recursive:true});const expected=createEReaderModel();
const browser=await chromium.launch({channel:'chrome',headless:true});
const page=await browser.newPage({viewport:{width:1440,height:1000},hasTouch:true,reducedMotion:'reduce'});page.setDefaultTimeout(25000);
const errors=[],consoleErrors=[],presets=[],controls=[],combinations=[],parts=[],frames=[],histories=[];
page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')consoleErrors.push(m.text());});
await page.addInitScript(()=>{
  window.readerMatrices={};
  for(const name of ['WebGLRenderingContext','WebGL2RenderingContext']){
    const proto=window[name]?.prototype;if(!proto)continue;const names=new WeakMap(),get=proto.getUniformLocation,write=proto.uniformMatrix4fv;
    proto.getUniformLocation=function(program,name){const location=get.call(this,program,name);if(location)names.set(location,name);return location;};
    proto.uniformMatrix4fv=function(location,transpose,data,...rest){const name=names.get(location);if(name==='modelViewMatrix')window.readerMatrices.modelView=Array.from(data);return write.call(this,location,transpose,data,...rest);};
  }
});
const canvas=page.locator('canvas'),action=name=>page.getByRole('button',{name,exact:true}).click();
const tab=name=>page.getByRole('tab',{name,exact:true}).click();
const values=()=>page.locator('.daily-readings > div').evaluateAll(rows=>Object.fromEntries(rows.map(row=>[row.querySelector('dt').textContent,row.querySelector('dd').textContent])));
async function compare(){const actual=await values();assert.deepEqual(actual,Object.fromEntries(expected.getState().readings.map(r=>[r.label,r.value])));return actual;}
async function reset(){await action('Reset experiment');expected.reset();await compare();}
async function steps(n){await page.locator('[data-step]').evaluate((button,count)=>{for(let i=0;i<count;i++)button.click();},n);for(let i=0;i<n;i++)expected.playback.step();await compare();}
async function edit(key,value){const control=page.locator(`[data-control="${key}"]`);if(await control.evaluate(e=>e.tagName==='SELECT'))await control.selectOption(String(value));else{const input=page.locator(`[data-number="${key}"]`);await input.fill(String(value));await input.press('Tab');}expected.update({[key]:value});await compare();}
async function preset(i,mobile=false){if(mobile)await page.getByRole('navigation',{name:'Lesson tools'}).getByRole('button',{name:'Try it yourself',exact:true}).click();else await tab('Try it yourself');await page.locator('[data-experiment]').nth(i).click();expected.reset(lesson.tryIt[i].initialState);await compare();if(mobile)await page.getByRole('navigation',{name:'Lesson tools'}).getByRole('button',{name:'Controls',exact:true}).click();else await tab('Controls');}
async function focus(id){
  await action('Whole machine');const chain=[];let p=expected.parts.find(p=>p.id===id);while(p){chain.unshift(p.id);p=expected.parts.find(x=>x.id===p.parentId);}
  for(const id of chain)await page.locator(`[data-part="${id}"]`).click();await page.locator('[data-isolate]').check();await action('Front');
}
async function capture(name){
  await canvas.scrollIntoViewIfNeeded();await page.waitForTimeout(120);await page.mouse.move(4,4);
  const png=await canvas.screenshot({path:`${output}/${name}.png`});
  const bounds=await page.evaluate(async encoded=>{
    const bitmap=await createImageBitmap(new Blob([Uint8Array.from(atob(encoded),x=>x.charCodeAt(0))],{type:'image/png'}));const c=document.createElement('canvas');c.width=bitmap.width;c.height=bitmap.height;
    const ctx=c.getContext('2d');ctx.drawImage(bitmap,0,0);bitmap.close();const {data}=ctx.getImageData(0,0,c.width,c.height),origin=(5*c.width+5)*4;
    let left=c.width,top=c.height,right=-1,bottom=-1;const rgbPixels=[0,0,0];
    for(let y=8;y<c.height-8;y++)for(let x=8;x<c.width-8;x++){
      const i=(y*c.width+x)*4;
      if(Math.abs(data[i]-data[origin])+Math.abs(data[i+1]-data[origin+1])+Math.abs(data[i+2]-data[origin+2])>35){left=Math.min(left,x);right=Math.max(right,x);top=Math.min(top,y);bottom=Math.max(bottom,y);}
      for(let channel=0;channel<3;channel++)if(data[i+channel]>150&&data[i+(channel+1)%3]<70&&data[i+(channel+2)%3]<70)rgbPixels[channel]++;
    }
    return {width:c.width,height:c.height,left,top,right,bottom,rgbPixels};
  },png.toString('base64'));
  assert(bounds.right>bounds.left&&bounds.bottom>bounds.top,name+': drawn model');
  assert(bounds.left>8&&bounds.top>8&&bounds.right<bounds.width-9&&bounds.bottom<bounds.height-9,name+': clear canvas margins '+JSON.stringify(bounds));
  frames.push({name,...bounds});assert.deepEqual(errors,[]);assert.deepEqual(consoleErrors,[]);
}
async function hit(name){
  await canvas.scrollIntoViewIfNeeded();const b=await canvas.boundingBox(),popup=page.locator('.daily-part-popup');
  for(let y=1;y<20;y++)for(let x=1;x<20;x++){const point=[b.x+b.width*x/20,b.y+b.height*y/20];await page.mouse.move(...point);if(await popup.isVisible()&&await popup.innerText()===name)return point;}
  assert.fail('No physical pointer target for '+name);
}
try{
  await page.goto(new URL('#machine/e-reader',base).href);await canvas.waitFor();await page.getByRole('heading',{name:'E-reader',exact:true,level:1}).waitFor();
  assert(await canvas.evaluate(c=>!!c.getContext('webgl2')));assert.equal(await page.locator('[data-control]').count(),5);await compare();await capture('opening');await page.screenshot({path:output+'/opening-page.png'});
  await steps(1);await reset();
  for(const [i,e] of lesson.tryIt.entries()){
    await preset(i);for(const [key,v] of Object.entries(e.values))assert.equal(Number(await page.locator(`[data-control="${key}"]`).inputValue()),v);
    await capture('preset-'+i);await steps(5);await capture('moving-'+i);await preset(i);
    await page.locator('[data-play]').click();await page.waitForFunction(()=>document.querySelector('[data-play]').getAttribute('aria-pressed')==='false',null,{timeout:15000});expected.advance(100);await compare();await capture('completed-'+i);
    const completedReadings=await values();
    await page.locator('[data-play]').click();
    let restarted;
    if(expected.getState().duration>0){
      await page.waitForTimeout(180);await page.locator('[data-play]').click();restarted=await values();
      assert.notDeepEqual(restarted,completedReadings,'Replay restarts the named initial material page');
      assert.notEqual(restarted['Reader operation'],'Holding page','Replay resumes retrieval and writing');
    }else{
      await page.waitForFunction(()=>document.querySelector('[data-play]').getAttribute('aria-pressed')==='false');
      restarted=await values();assert.deepEqual(restarted,completedReadings,'A retained or unpowered trial has no artificial material movement');
    }
    for(const [key,v] of Object.entries(e.values))assert.equal(Number(await page.locator(`[data-control="${key}"]`).inputValue()),v,'Replay retains '+key);
    presets.push({title:e.title,readings:completedReadings,replay:restarted});console.log(`Preset ${i+1}/${lesson.tryIt.length} autoplay and replay passed: ${e.title}`);
  }
  await preset(0);await page.locator('[data-play]').click();await page.waitForTimeout(550);await page.locator('[data-play]').click();const held=await values();await page.waitForTimeout(200);assert.deepEqual(await values(),held,'Pause freezes readings');
  await reset();await steps(45);await page.locator('[data-play]').click();await page.waitForTimeout(160);await page.locator('[data-play]').click();
  assert.notEqual((await values())['Reader operation'],'Holding page','Complete replay restarts');
  assert.equal(await page.locator('[data-control="power"]').inputValue(),'1');
  for(const control of expected.controls){
    const choices=control.options?.map(o=>o.value)??Array.from({length:(control.max-control.min)/control.step+1},(_,i)=>control.min+i*control.step);
    for(const value of choices){await reset();await edit(control.key,value);await steps(2);await steps(45);controls.push({key:control.key,value,readings:await values()});}
    console.log('Control values passed: '+control.key);
  }
  for(const book of [0,1,2])for(const requestedPage of [0,1])for(const power of [0,1])for(const ambient of [0,1])for(const frontlight of [0,1,2]){
    const settings={book,page:requestedPage,power,ambient,frontlight};
    const selected=await page.evaluate(settings=>{
      document.querySelector('[data-reset-controls]').click();
      for(const [key,value] of Object.entries(settings)){const e=document.querySelector(`[data-control="${key}"]`);e.value=String(value);e.dispatchEvent(new Event('input',{bubbles:true}));e.dispatchEvent(new Event('change',{bubbles:true}));}
      for(let i=0;i<45;i++)document.querySelector('[data-step]').click();
      return Object.fromEntries(Object.keys(settings).map(key=>[key,Number(document.querySelector(`[data-control="${key}"]`).value)]));
    },settings);
    assert.deepEqual(selected,settings,'UI controls retain the requested combination');
    expected.reset({settings});expected.advance(100);combinations.push({settings,readings:await compare()});
  }
  console.log('All '+combinations.length+' browser control combinations passed.');
  for(const book of [0,1,2])for(const number of [0,1]){
    await reset();await edit('book',book);await edit('page',number);await steps(45);
    await action('Inspect: readable page');await capture(`book-${book}-page-${number}`);
  }
  await preset(4);await capture('unpowered-retained');await edit('page',0);await steps(45);
  assert.equal((await values())['Stored in the ink'],'Seeds · page 1');await edit('page',1);
  assert.equal((await values())['Stored in the ink'],'Seeds · page 1');await edit('power',1);await steps(45);
  assert.equal((await values())['Stored in the ink'],'Seeds · page 2');await capture('reconnected-request');
  await edit('page',0);await steps(45);assert.equal((await values())['Stored in the ink'],'Seeds · page 1');
  await edit('page',1);await steps(45);assert.equal((await values())['Stored in the ink'],'Seeds · page 2');
  histories.push({name:'Unpowered request retains prior page; reconnect and turn both ways',readings:await values()});
  await preset(0);await steps(9);await action('Inspect: readable page');const partial=await canvas.screenshot();
  await edit('power',0);assert(partial.equals(await canvas.screenshot()),'Power loss holds the actual partial pigment page');
  await steps(45);assert(partial.equals(await canvas.screenshot()),'Unpowered material stays fixed');
  await edit('book',2);await edit('page',1);assert(partial.equals(await canvas.screenshot()),'Unpowered requests preserve the partial page');
  await edit('power',1);assert(partial.equals(await canvas.screenshot()),'Reconnection starts from current material');
  await steps(45);assert.equal((await values())['Stored in the ink'],'Seeds · page 2');await capture('interrupted-seeds');
  histories.push({name:'Partial write, power loss, queued title and reconnection',readings:await values()});
  await preset(5);await steps(45);await action('Inspect: readable page');const dark=await canvas.screenshot();await capture('written-in-dark');
  assert.equal((await values())['Stored in the ink'],'Rain · page 2');await edit('ambient',1);const lit=await canvas.screenshot();
  assert(!dark.equals(lit),'Ambient light reveals the page written in darkness');await capture('ambient-reveals-rain');
  await edit('ambient',0);assert(dark.equals(await canvas.screenshot()));await edit('ambient',1);assert(lit.equals(await canvas.screenshot()));
  histories.push({name:'Write in darkness and reveal stored page without another update',readings:await values()});
  await preset(6);await action('Inspect: readable page');const bright=await canvas.screenshot();await capture('front-bright');
  await edit('frontlight',1);const low=await canvas.screenshot();assert(!bright.equals(low));await capture('front-low');
  await edit('frontlight',0);const unlit=await canvas.screenshot();assert(!low.equals(unlit));await capture('front-off');
  await edit('frontlight',2);assert(bright.equals(await canvas.screenshot()));await action('Inspect: front-light path');await capture('guide-bright');
  await edit('frontlight',1);await capture('guide-low');await edit('power',0);await capture('guide-unpowered');
  await action('Inspect: readable page');assert(unlit.equals(await canvas.screenshot()),'Power removal shuts down the light but preserves page pixels');
  await edit('ambient',1);assert.equal((await values())['Stored in the ink'],'Light · page 2');await capture('unpowered-ambient-page');
  histories.push({name:'Bright, Low and Off front light; power gating and ambient retention',readings:await values()});
  await page.locator('[data-result]').click();await reset();
  assert.equal(await page.locator('.daily-part-detail h3').innerText(),'Complete e-reader','Reset restores the whole reader’s opening inspection');
  await capture('result-reset');
  await reset();await steps(7);for(const a of expected.actions){const before=await values();await action(a.label);assert.deepEqual(await values(),before);await capture('action-'+a.part);}
  for(const p of expected.parts){await focus(p.id);assert.equal(await page.locator('.daily-part-detail h3').innerText(),p.name);await compare();await capture('part-'+p.id);parts.push(p.id);}
  await action('Inspect: complete reader');for(const view of ['Front','Side','Back','Top','Underneath','Angled']){await action(view);await capture('view-'+view.toLowerCase());}
  await action('Inspect: complete reader');const exterior=await canvas.screenshot();await page.locator('[data-cutaway]').check();
  await compare();assert(!exterior.equals(await canvas.screenshot()),'Look inside exposes the connected reader electronics');await capture('cutaway');
  await page.locator('[data-cutaway]').uncheck();await compare();assert(exterior.equals(await canvas.screenshot()),'Closing the cutaway restores the display stack');
  await action('Inspect: complete reader');await page.locator('[data-separation]').fill('100');await capture('separated');await page.locator('[data-reassemble]').click();
  await focus('page');const point=await hit('Reflective book page');await page.mouse.click(...point);assert.equal(await page.locator('.daily-part-popup').innerText(),'Reflective book page');
  await page.mouse.move(4,4);await canvas.screenshot();const before=await page.evaluate(()=>window.readerMatrices.modelView);
  await page.mouse.move(...point);await page.mouse.down();await page.mouse.move(point[0]+30,point[1]+18,{steps:8});await page.mouse.up();await page.mouse.move(4,4);await canvas.screenshot();const after=await page.evaluate(()=>window.readerMatrices.modelView);
  for(const i of [0,1,2,4,5,6,8,9,10])assert(Math.abs(before[i]-after[i])<1e-7,'Object drag preserves rotation');assert(Math.hypot(...[12,13,14].map(i=>after[i]-before[i]))>.01,'Object drag translates');
  await action('Inspect: complete reader');await canvas.scrollIntoViewIfNeeded();let b=await canvas.boundingBox();await page.mouse.move(b.x+15,b.y+15);assert.equal(await page.locator('.daily-part-popup').isVisible(),false);const beforeRotate=await canvas.screenshot();
  await page.mouse.down();await page.mouse.move(b.x+90,b.y+55,{steps:8});await page.mouse.up();assert(!beforeRotate.equals(await canvas.screenshot()),'Outside drag rotates');
  await action('Inspect: complete reader');const beforeZoom=await canvas.screenshot();await page.locator('[data-view="in"]').click();assert(!beforeZoom.equals(await canvas.screenshot()));assert.equal(await page.locator('[data-separation]').inputValue(),'0');await page.locator('[data-view="out"]').click();
  await canvas.scrollIntoViewIfNeeded();b=await canvas.boundingBox();await page.mouse.move(b.x+b.width/2,b.y+b.height/2);
  for(let i=0;i<8&&Number(await page.locator('[data-separation]').inputValue())===0;i++){await page.mouse.wheel(0,120);await page.waitForTimeout(50);}
  assert(Number(await page.locator('[data-separation]').inputValue())>0,'Wheel outward separates parts');await capture('wheel-separated');
  b=await canvas.boundingBox();await page.mouse.move(b.x+b.width/2,b.y+b.height/2);
  for(let i=0;i<16&&Number(await page.locator('[data-separation]').inputValue())>0;i++){await page.mouse.wheel(0,-120);await page.waitForTimeout(50);}
  assert.equal(await page.locator('[data-separation]').inputValue(),'0','Wheel inward reassembles');
  await page.locator('[data-labels]').check();await page.locator('button[data-label-part="page"]').click();await page.locator('[data-isolate]').check();
  assert.equal(await page.locator('.daily-part-detail h3').innerText(),'Reflective book page');await page.keyboard.press('Escape');assert.equal(await page.locator('.daily-part-detail h3').count(),0);
  await page.locator('button[data-label-part="page"]').click();await page.locator('.daily-heading h1').click();assert.equal(await page.locator('.daily-part-detail h3').count(),0);await page.locator('[data-labels]').uncheck();
  await reset();await page.locator('[data-control="book"]').focus();
  for(const key of ['r','Enter','Tab'])await page.keyboard.press(key);
  assert.equal(await page.locator('[data-control="book"]').inputValue(),'1','Native select supports keyboard type-to-select');
  expected.update({book:1});await compare();
  for(const width of [390,320]){
    await page.setViewportSize({width,height:width===390?844:568});await page.reload();await canvas.waitFor();expected.reset();await compare();await capture('mobile-opening-'+width);
    for(const [i] of lesson.tryIt.entries()){await preset(i,true);await steps(45);await capture(`mobile-completed-${i}-${width}`);}
    await action('Inspect: complete reader');await page.screenshot({path:`${output}/mobile-page-${width}.png`});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
    console.log(`Mobile ${width}px: all prepared results passed.`);
  }
  await action('Inspect: complete reader');const touch=await page.context().newCDPSession(page);
  async function pinch(from,to){await canvas.scrollIntoViewIfNeeded();const box=await canvas.boundingBox(),x=box.x+box.width/2,y=box.y+box.height/2,points=d=>[{x:x-d,y,id:0},{x:x+d,y,id:1}];await touch.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:points(from)});for(let i=1;i<=12;i++)await touch.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:points(from+(to-from)*i/12)});await touch.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});}
  try{await pinch(100,15);assert(Number(await page.locator('[data-separation]').inputValue())>0);await capture('pinch-separated');await pinch(15,100);await page.waitForFunction(()=>document.querySelector('[data-separation]').value==='0');}finally{await touch.detach();}
  await page.setViewportSize({width:1440,height:1000});for(const [i] of lesson.quiz.options.entries()){await page.locator('[data-answer]').nth(i).click();assert.equal(await page.locator('.daily-answer').innerText(),(i===lesson.quiz.answer?'That’s right. ':'Try thinking through the parts again. ')+lesson.quiz.explanation);}
  await page.getByText('Learn more',{exact:true}).click();for(const source of lesson.sources)assert.equal(await page.locator(`.daily-lesson a[href="${source.url}"]`).innerText(),source.title);
  await page.locator('.daily-return').click();assert(!page.url().endsWith('#machine/e-reader'));assert.deepEqual(errors,[]);assert.deepEqual(consoleErrors,[]);
  await writeFile(output+'/browser.json',JSON.stringify({passed:true,presets,controls,combinations,parts,frames,histories,errors,consoleErrors,pause:true,replay:true,objectDrag:true,backgroundRotation:true,keyboard:true,wheel:true,labels:true,dismissal:true,pinch:true,mobileWidths:[390,320]},null,2));console.log(JSON.stringify({passed:true,presets:presets.length,controls:controls.length,combinations:combinations.length,parts:parts.length,frames:frames.length}));
}catch(error){await writeFile(output+'/failure.json',JSON.stringify({message:error.message,errors,consoleErrors,url:page.url(),presets,controls,combinations,parts,frames,body:await page.locator('body').innerText().catch(()=> '')},null,2));await page.screenshot({path:output+'/failure.png'}).catch(()=>{});throw error;}
finally{expected.dispose();await browser.close();}

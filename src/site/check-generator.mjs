import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {chromium} from 'playwright';
import {electricGeneratorLesson, acGeneratorLesson} from './grid-generator-lessons.js';

const base=process.env.SITE_URL||'http://127.0.0.1:5196/';
const output=process.env.EVIDENCE_DIR||'documentation/generator-browser';
const variant=process.argv[2]||process.env.GENERATOR_LESSON||'electric-generator';
const variants={'electric-generator':{name:'Electric generator',lesson:electricGeneratorLesson},'ac-generator':{name:'AC generator',lesson:acGeneratorLesson}};
assert.ok(variants[variant],'known generator lesson');
const {name,lesson}=variants[variant];
await mkdir(output,{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true});
const page=await browser.newPage({viewport:{width:1440,height:1000},hasTouch:true,reducedMotion:'reduce'});
const errors=[],presets=[],controls=[],actions=[];
page.on('pageerror',error=>errors.push(error.message));
const reading=label=>page.locator('.daily-readings > div').filter({has:page.locator('dt',{hasText:new RegExp('^'+label+'$')})}).locator('dd');
const tab=name=>page.getByRole('tab',{name,exact:true}).click();
const capture=name=>page.locator('.daily-canvas-wrap').screenshot({path:output+'/'+name+'.png'});
const reset=()=>page.getByRole('button',{name:'Reset experiment',exact:true}).click();
try {
  await page.goto(new URL('#machine/'+variant,base).href);
  await page.getByRole('heading',{name,exact:true}).waitFor();
  await page.locator('canvas').waitFor();
  assert.equal(await reading('Brush output').innerText(),'88.15 V RMS');
  await capture('assembled');
  for(const [index,trial] of lesson.tryIt.entries()) {
    await tab('Try it yourself');await page.locator('[data-experiment]').nth(index).click();
    for(const [key,value] of Object.entries(trial.values)) assert.equal(Number(await page.locator('[data-control="'+key+'"]').inputValue()),value,trial.title+': '+key);
    await tab('Controls');
    let result=await reading('Your result').innerText(),steps=0;
    if(trial.values.speed===0)assert.equal(await page.locator('[data-play]').isDisabled(),true);
    else {
      while(!/^One turn done/.test(result)&&steps<17){await page.locator('[data-step]').click();result=await reading('Your result').innerText();steps++;}
      assert.match(result,/^One turn done/,trial.title);
    }
    assert.equal(await page.locator('[data-play]').getAttribute('aria-pressed'),'false');
    presets.push({title:trial.title,steps,result});
    await capture('preset-'+index);
  }
  await reset();await tab('Controls');
  const halfTurns=[];
  for(let step=1;step<=12;step++) {
    await page.locator('[data-step]').click();
    if(step===4||step===12) {
      const sign=step===4?'':'-';
      assert.equal(await reading('Brush voltage').innerText(),sign+'124.66 V');
      assert.equal(await reading('Load current').innerText(),sign+'12.466 A');
      assert.equal(await reading('Load').innerText(),'777.0 W');
      assert.equal(await reading('Contacts').innerText(),'Continuous slip rings');
      halfTurns.push({step,voltage:await reading('Brush voltage').innerText(),current:await reading('Load current').innerText()});
      await capture('half-turn-'+step);
    }
  }
  await reset();
  for(const [key,values] of Object.entries({speed:[0,3600],field:[0,1.2],turns:[2,40],load:[1,50]})) {
    await reset();
    for(const value of values) {
      await page.locator('[data-number="'+key+'"]').fill(String(value));await page.keyboard.press('Tab');
      assert.equal(Number(await page.locator('[data-control="'+key+'"]').inputValue()),value);
      const result=await reading('Your result').innerText();assert.ok(!/NaN|undefined|Infinity/.test(result));
      controls.push({key,value,result});
    }
  }
  for(const key of ['output','closed'])for(const value of [0,1]) {
    await page.locator('[data-control="'+key+'"]').selectOption(String(value));
    assert.equal(Number(await page.locator('[data-control="'+key+'"]').inputValue()),value);
    controls.push({key,value,result:await reading('Your result').innerText()});
  }
  await reset();
  await page.locator('[data-step]').click();
  const timeBeforeInspection=await reading('Your result').innerText();
  for(let i=0;i<await page.locator('[data-action]').count();i++) {
    await page.locator('[data-action]').nth(i).click();
    assert.equal(await reading('Your result').innerText(),timeBeforeInspection,'inspection preserves experiment');
    actions.push(await page.locator('.daily-part-detail h3').innerText());await capture('inspect-'+i);
  }
  await page.locator('[data-control="output"]').selectOption('1');
  await page.getByRole('button',{name:'Inspect the contacts',exact:true}).click();
  assert.equal(await page.locator('.daily-part-detail h3').innerText(),'Split ring and fixed brushes');
  assert.equal(await reading('Contacts').innerText(),'Brushes bridge both halves');
  await capture('split-ring-bridge');
  await page.locator('[data-step]').click();
  assert.equal(await reading('Contacts').innerText(),'Each brush touches one half');await capture('split-ring-contact');
  await reset();
  await page.locator('[data-play]').click();await page.waitForTimeout(1200);await page.locator('[data-play]').click();
  assert.match(await reading('Your result').innerText(),/^Turning/);
  const held=await page.locator('.daily-readings').innerText();await page.waitForTimeout(400);
  assert.equal(await page.locator('.daily-readings').innerText(),held,'pause holds readings');
  await reset();
  for(let i=0;i<14;i++)await page.locator('[data-step]').click();
  await page.locator('[data-play]').click();
  await page.waitForFunction(()=>document.querySelector('[data-play]').getAttribute('aria-pressed')==='false',null,{timeout:60000});
  assert.match(await reading('Your result').innerText(),/^One turn done/);
  await page.locator('[data-play]').click();await page.waitForTimeout(200);
  assert.equal(await page.locator('[data-play]').getAttribute('aria-pressed'),'true','completed run replays');
  await page.locator('[data-play]').click();
  await reset();
  await page.locator('[data-number="speed"]').fill('0');await page.keyboard.press('Tab');
  assert.equal(await page.locator('[data-play]').isDisabled(),true,'stationary shaft blocks playback');
  assert.equal(await reading('Coil EMF').innerText(),'0.00 V');
  await reset();

  await page.getByRole('button',{name:'Inspect the winding',exact:true}).click();
  const canvas=page.locator('canvas'),popup=page.locator('.daily-part-popup');
  await canvas.scrollIntoViewIfNeeded();let box=await canvas.boundingBox(),hit=null;
  for(const fy of [.5,.48,.52,.45,.55]) {
    for(const fx of [.5,.4,.6]) {
      await page.mouse.move(box.x+box.width*fx,box.y+box.height*fy);
      if(await popup.isVisible() && (await popup.innerText())==='Connected rotating winding'){hit=[box.x+box.width*fx,box.y+box.height*fy];break;}
    }
    if(hit)break;
  }
  assert.ok(hit,'physical coil opens named hover popup');await page.mouse.click(...hit);
  assert.equal(await popup.innerText(),'Connected rotating winding');
  await page.locator('.daily-heading h1').click();assert.equal(await popup.isVisible(),false);
  assert.equal(await page.locator('.daily-part-detail h3').count(),0,'outside click clears part selection');
  await page.locator('[data-labels]').check();await page.locator('button[data-label-part="coil"]').click();
  assert.equal(await page.locator('button[data-label-part="coil"]').getAttribute('aria-pressed'),'true');
  await page.locator('.daily-heading h1').click();
  assert.equal(await page.locator('button[data-label-part="coil"]').getAttribute('aria-pressed'),'false');
  await page.locator('[data-labels]').uncheck();
  await page.locator('[data-view="reset"]').click();
  const beforeZoom=await canvas.screenshot();await page.locator('[data-view="in"]').click();
  assert.ok(!beforeZoom.equals(await canvas.screenshot()),'plus zooms');assert.equal(await page.locator('[data-separation]').inputValue(),'0');
  await page.locator('[data-view="out"]').click();assert.equal(await page.locator('[data-separation]').inputValue(),'0');
  await canvas.scrollIntoViewIfNeeded();box=await canvas.boundingBox();await page.mouse.move(box.x+20,box.y+20);
  const beforeDrag=await canvas.screenshot();await page.mouse.down();await page.mouse.move(box.x+110,box.y+55,{steps:12});await page.mouse.up();
  assert.ok(!beforeDrag.equals(await canvas.screenshot()),'outside drag rotates');
  await page.locator('[data-view="reset"]').click();
  await canvas.scrollIntoViewIfNeeded();box=await canvas.boundingBox();await page.mouse.move(box.x+20,box.y+20);
  for(let i=0;i<8;i++)await page.mouse.wheel(0,240);
  await page.waitForFunction(()=>document.querySelector('[data-separation]').value==='100');await capture('grouped-parts');
  await page.locator('[data-reassemble]').click();await page.waitForFunction(()=>document.querySelector('[data-separation]').value==='0');
  for(const view of ['Front','Side','Back','Top','Underneath','Angled']){await page.getByRole('button',{name:view,exact:true}).click();await capture('view-'+view.toLowerCase());}
  for(const viewport of [{width:390,height:844},{width:320,height:568}]) {
    await page.setViewportSize(viewport);await page.locator('[data-view="reset"]').click();
    const tools=page.getByRole('navigation',{name:'Lesson tools'});
    await tools.getByRole('button',{name:'Try it yourself',exact:true}).click();await page.locator('[data-experiment]').nth(lesson.tryIt.findIndex(trial=>trial.values.speed===1500)).click();
    await tools.getByRole('button',{name:'Controls',exact:true}).click();await page.locator('[data-step]').click();
    assert.equal(await reading('Brush output').innerText(),'44.07 V RMS');
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
    await page.locator('[data-view="reset"]').click();await capture('phone-'+viewport.width);
    await page.getByRole('button',{name:'Inspect the voltage chart',exact:true}).click();await capture('phone-chart-'+viewport.width);
  }
  await page.setViewportSize({width:390,height:844});await page.locator('[data-view="reset"]').click();
  const session=await page.context().newCDPSession(page);
  const pinch=async(from,to)=>{
    await canvas.scrollIntoViewIfNeeded();const b=await canvas.boundingBox(),x=b.x+b.width/2,y=b.y+b.height/2;
    const points=d=>[{x:x-d,y,id:0},{x:x+d,y,id:1}];
    await session.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:points(from)});
    for(let i=1;i<=12;i++)await session.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:points(from+(to-from)*i/12)});
    await session.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
  };
  try{await pinch(120,20);assert.ok(Number(await page.locator('[data-separation]').inputValue())>0);await capture('phone-pinch');await pinch(20,120);await page.waitForFunction(()=>document.querySelector('[data-separation]').value==='0');}finally{await session.detach();}
  await page.setViewportSize({width:1440,height:1000});
  for(let i=0;i<lesson.quiz.options.length;i++) {
    await page.locator('[data-answer]').nth(i).click();
    assert.equal(await page.locator('[data-answer]').nth(i).getAttribute('aria-pressed'),'true');
    assert.equal(await page.locator('.daily-answer').innerText(),(i===lesson.quiz.answer?'That’s right. ':'Try thinking through the parts again. ')+lesson.quiz.explanation);
  }
  await page.getByRole('button',{name:'Back to The discovery center',exact:true}).click();
  await page.getByRole('button',{name:'Electric generator',exact:true}).click();
  await page.getByRole('heading',{name:'Electric generator',exact:true}).waitFor();
  if(variant==='ac-generator') {
    await page.locator('.daily-related a[href="#machine/ac-generator"]').click();
    await page.getByRole('heading',{name,exact:true}).waitFor();
  }
  assert.match(page.url(),new RegExp('#machine/'+variant+'$'));
  assert.deepEqual(errors,[]);
  const report={passed:true,variant,presets,halfTurns,controls,actions,pause:true,completion:true,replay:true,blocked:true,popup:true,deselection:true,zoomOnlyButtons:true,outsideDrag:true,wheelSeparation:true,pinch:true,quiz:true,navigation:true,mobileWidths:[390,320],errors};
  await writeFile(output+'/browser.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));
} finally {await browser.close();}

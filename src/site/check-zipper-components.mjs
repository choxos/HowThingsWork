import assert from 'node:assert/strict';
import {chromium} from 'playwright';

const browser=await chromium.launch({headless:true}),page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];
page.on('pageerror',e=>errors.push(e.message));
try{
 await page.goto(`${process.env.SITE_URL||'http://127.0.0.1:5175/'}#machine/zipper-slide-wedges`);
 await page.getByRole('heading',{name:'Zipper slide wedges',exact:true}).waitFor();
 await page.getByRole('checkbox',{name:'Show labels',exact:true}).check();
 const label=page.locator('.daily-model-label').filter({hasText:/^Y-channel slider$/});
 const point=()=>label.evaluate(node=>[parseFloat(node.style.left),parseFloat(node.style.top)]);
 const initial=await point();
 for(const closure of ['0.15','0.5','0.85']){
  await page.getByRole('spinbutton',{name:'Close the zipper value',exact:true}).fill(closure);
  const next=await point();assert.ok(Math.hypot(next[0]-initial[0],next[1]-initial[1])<.01,'the slider stays framed during manual movement');
 }
 await page.getByRole('button',{name:'Advance one step',exact:true}).click();const stepped=await point();assert.ok(Math.hypot(stepped[0]-initial[0],stepped[1]-initial[1])<.01,'step preserves slider framing');
 await page.getByRole('checkbox',{name:'Show labels',exact:true}).uncheck();
 for(const index of [0,1]){
  await page.getByRole('tab',{name:'Try it yourself',exact:true}).click();await page.getByRole('button',{name:'Set up this experiment',exact:true}).nth(index).click();await page.getByRole('tab',{name:'Controls',exact:true}).click();
  await page.getByRole('button',{name:'Run selected action',exact:true}).click();await page.waitForTimeout(600);await page.getByRole('button',{name:'Pause',exact:true}).click();
  assert.equal(await page.locator('.daily-part-detail h3').textContent(),'Y-channel slider');await page.screenshot({path:`/tmp/howthingswork-zipper-wedges-${index}.png`,fullPage:true});
  await page.getByRole('button',{name:'Run selected action',exact:true}).click();await page.waitForFunction(index=>document.querySelector('[data-number="'+(index===0?'closure':'alignment')+'"]').value===(index===0?'1':'0'),index);
  await page.getByRole('heading',{name:'Separating jacket front',exact:true}).waitFor();assert.match(await page.locator('.daily-readings').textContent(),index===0?/Jacket fastened/:/Jacket sides completely separated/);
 }
 await page.getByRole('tab',{name:'Try it yourself',exact:true}).click();await page.getByRole('button',{name:'Set up this experiment',exact:true}).nth(2).click();await page.getByRole('checkbox',{name:'Isolate selected part',exact:true}).check();await page.getByRole('checkbox',{name:'Look inside',exact:true}).uncheck();await page.screenshot({path:'/tmp/howthingswork-zipper-slider-plates.png',fullPage:true});await page.getByRole('checkbox',{name:'Look inside',exact:true}).check();
 await page.getByRole('button',{name:'Upper separating wedge',exact:true}).click();await page.getByRole('checkbox',{name:'Show labels',exact:true}).check();const wedge=page.locator('.daily-model-label').filter({hasText:/^Upper separating wedge$/});const before=await wedge.evaluate(n=>parseFloat(n.style.top));
 await page.getByRole('tab',{name:'Controls',exact:true}).click();await page.getByRole('spinbutton',{name:'Close the zipper value',exact:true}).fill('0.2');assert.ok(Math.abs(await wedge.evaluate(n=>parseFloat(n.style.top))-before)<.01,'nested wedge stays framed');
 await page.getByRole('checkbox',{name:'Show labels',exact:true}).uncheck();await page.getByRole('checkbox',{name:'Isolate selected part',exact:true}).uncheck();
 await page.getByRole('button',{name:'Teeth enter the same channel from the joined end.',exact:true}).click();assert.match(await page.locator('.daily-answer').textContent(),/That’s right/);await page.getByRole('button',{name:'Reset experiment',exact:true}).click();assert.equal(await page.locator('.daily-part-detail h3').textContent(),'Y-channel slider');assert.equal(await page.getByRole('spinbutton',{name:'Close the zipper value',exact:true}).inputValue(),'0.35');
 await page.setViewportSize({width:390,height:844});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));assert.deepEqual(errors,[]);
 console.log('PASS zipper wedges: slider and nested-wedge tracking, step/play/pause, both final results, plate isolation, quiz/reset and mobile.');
 await page.setViewportSize({width:1440,height:1000});await page.goto(`${process.env.SITE_URL||'http://127.0.0.1:5175/'}#machine/interlocking-zipper-teeth`);await page.getByRole('heading',{name:'Interlocking zipper teeth',exact:true}).waitFor();
 for(const index of [0,3]){
  await page.getByRole('tab',{name:'Try it yourself',exact:true}).click();await page.getByRole('button',{name:'Set up this experiment',exact:true}).nth(index).click();await page.getByRole('tab',{name:'Controls',exact:true}).click();
  await page.getByRole('spinbutton',{name:'Open tape spread value',exact:true}).fill('1');assert.equal(await page.locator('.daily-part-detail h3').textContent(),'Nesting head 7');assert.match(await page.locator('.daily-readings').textContent(),/13 of 23/);await page.screenshot({path:`/tmp/howthingswork-zipper-teeth-${index}.png`,fullPage:true});
 }
 await page.getByRole('checkbox',{name:'Show labels',exact:true}).check();
 const headLabel=page.locator('.daily-model-label').filter({hasText:/^Nesting head 7$/}),headPoint=()=>headLabel.evaluate(n=>[parseFloat(n.style.left),parseFloat(n.style.top)]),headStart=await headPoint();
 for(const closure of ['0.15','0.3','0.5']){await page.getByRole('spinbutton',{name:'Close the zipper value',exact:true}).fill(closure);const p=await headPoint();assert.ok(Math.hypot(p[0]-headStart[0],p[1]-headStart[1])<.01,'the rotating head center remains framed');}
 await page.getByRole('checkbox',{name:'Show labels',exact:true}).uncheck();
 for(const index of [1,2]){
  await page.getByRole('tab',{name:'Try it yourself',exact:true}).click();await page.getByRole('button',{name:'Set up this experiment',exact:true}).nth(index).click();await page.getByRole('tab',{name:'Controls',exact:true}).click();
  await page.getByRole('button',{name:'Advance one step',exact:true}).click();assert.equal(await page.getByRole('spinbutton',{name:'Close the zipper value',exact:true}).inputValue(),index===1?'0.25':'0.2');await page.screenshot({path:`/tmp/howthingswork-zipper-tooth-motion-${index}.png`,fullPage:true});
  await page.getByRole('button',{name:'Run selected action',exact:true}).click();await page.waitForFunction(index=>document.querySelector('[data-number="'+(index===1?'alignment':'closure')+'"]').value===(index===1?'0':'1'),index);await page.getByRole('heading',{name:'Separating jacket front',exact:true}).waitFor();assert.match(await page.locator('.daily-readings').textContent(),index===1?/Jacket sides completely separated/:/Jacket fastened/);
 }
 await page.getByRole('button',{name:'It changes neighboring positions and angles in sequence.',exact:true}).click();assert.match(await page.locator('.daily-answer').textContent(),/That’s right/);await page.getByRole('button',{name:'Reset experiment',exact:true}).click();assert.equal(await page.locator('.daily-part-detail h3').textContent(),'Nesting head 7');assert.equal(await page.getByRole('spinbutton',{name:'Close the zipper value',exact:true}).inputValue(),'0.5');
 await page.setViewportSize({width:390,height:844});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));assert.deepEqual(errors,[]);
 console.log('PASS zipper teeth: all presets, close-up separation and nesting, both jacket outcomes, unchanged joined chain under loose spread, quiz/reset and mobile.');
 await page.setViewportSize({width:1440,height:1000});await page.goto(`${process.env.SITE_URL||'http://127.0.0.1:5175/'}#machine/zipper-bottom-pin-and-box`);await page.getByRole('heading',{name:'Zipper bottom pin and box',exact:true}).waitFor();
 for(const index of [0,1,2]){
  await page.getByRole('tab',{name:'Try it yourself',exact:true}).click();await page.getByRole('button',{name:'Set up this experiment',exact:true}).nth(index).click();await page.getByRole('tab',{name:'Controls',exact:true}).click();
  assert.equal(await page.locator('.daily-part-detail h3').textContent(),'Bottom pin and retaining box');
  if(index<2)assert.equal(await page.getByRole('spinbutton',{name:'Close the zipper value',exact:true}).isDisabled(),true);
  const before=Number(await page.getByRole('spinbutton',{name:'Seat the bottom pin value',exact:true}).inputValue());await page.getByRole('button',{name:'Advance one step',exact:true}).click();const after=Number(await page.getByRole('spinbutton',{name:'Seat the bottom pin value',exact:true}).inputValue());assert.ok(index<2?after>before:after<before,'bottom step moves the pin in the selected direction');
  await page.screenshot({path:`/tmp/howthingswork-zipper-bottom-${index}.png`,fullPage:true});await page.getByRole('button',{name:'Run selected action',exact:true}).click();await page.waitForFunction(index=>document.querySelector('[data-number="'+(index===2?'alignment':'closure')+'"]').value===(index===2?'0':'1'),index);await page.getByRole('heading',{name:'Separating jacket front',exact:true}).waitFor();
 }
 await page.getByRole('button',{name:'Withdraw the free pin upward through the lowered slider.',exact:true}).click();assert.match(await page.locator('.daily-answer').textContent(),/That’s right/);await page.getByRole('button',{name:'Reset experiment',exact:true}).click();assert.equal(await page.locator('.daily-part-detail h3').textContent(),'Bottom pin and retaining box');assert.equal(await page.getByRole('spinbutton',{name:'Seat the bottom pin value',exact:true}).inputValue(),'0');assert.equal(await page.getByRole('spinbutton',{name:'Bring the sides together value',exact:true}).inputValue(),'1');
 await page.setViewportSize({width:390,height:844});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));assert.deepEqual(errors,[]);
 console.log('PASS zipper bottom connector: dedicated route, three presets, insertion/withdrawal steps, seating gate, both completed outcomes, reset, quiz and mobile.');
}finally{await browser.close();}

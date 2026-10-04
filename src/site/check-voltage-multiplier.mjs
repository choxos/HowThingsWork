import assert from 'node:assert/strict';
import {mkdir, writeFile} from 'node:fs/promises';
import {chromium} from 'playwright';
import {voltageMultiplierLesson as lesson} from './voltage-multiplier-lesson.js';
import {MULTIPLIER_DEFAULTS, MULTIPLIER_DOMAINS, sampleLadder, LADDER} from './voltage-multiplier-physics.js';
import {fixed} from './format.js';
const D={window:0,...MULTIPLIER_DEFAULTS};

const base = process.env.SITE_URL || 'http://127.0.0.1:4173/', output = process.env.EVIDENCE_DIR || 'documentation/voltage-multiplier-browser';
await mkdir(output, {recursive: true});
const browser = await chromium.launch({channel: 'chrome', headless: true});
const page = await browser.newPage({viewport: {width: 1440, height: 1000}, hasTouch: true, reducedMotion: 'reduce'});
page.setDefaultTimeout(20000);
const errors = [], outcomes = [], controls = [], actions = [], selections = [], physicalHits = [];
page.on('pageerror', error => errors.push(error.message));
const canvas = page.locator('canvas'), popup = page.locator('.daily-part-popup');
const reading = label => page.locator('.daily-readings > div').filter({has: page.getByText(label, {exact: true})}).locator('dd');
const value = async label => parseFloat((await reading(label).innerText()).replaceAll(',', ''));
const tab = name => page.getByRole('tab', {name, exact: true}).click();
const capture = async name => {await canvas.scrollIntoViewIfNeeded(); await canvas.screenshot({path: `${output}/${name}.png`});};
const reset = () => page.getByRole('button', {name: 'Reset experiment', exact: true}).click();
const action = name => page.getByRole('button', {name, exact: true}).click();
async function preset(index) {await tab('Try it yourself'); await page.locator('[data-experiment]').nth(index).click(); await tab('Controls');}
async function edit(key, next) {
  const control = page.locator(`[data-control="${key}"]`);
  if (await control.evaluate(element => element.tagName === 'SELECT')) await control.selectOption(String(next));
  else {await page.locator(`[data-number="${key}"]`).fill(String(next)); await page.keyboard.press('Tab');}
}
const near = (actual, expected, tolerance) => assert.ok(Number.isFinite(actual) && Math.abs(actual - expected) <= tolerance, `${actual} differs from ${expected}`);
async function laws(given,cycle) {
  const values={...D,...given},{window,...physical}=values,s=sampleLadder(physical,cycle,window?'late':'startup');
  assert.equal(await reading('Your result').innerText(),`${fixed(s.now.output,1)} V at cycle ${fixed(s.cycle,2)} · ${window?'late-cycle view':'startup view'}`);
  assert.equal(await reading('Cycle-400 output').innerText(),`${fixed(s.late.mean,1)} V mean · ${fixed(s.late.ripple,3)} V range`);
  assert.equal(await reading('Still settling?').innerText(),s.late.repeating?'Repeats within 0.001 V per cycle':'Yes: cycle 400 still differs');
  assert.equal(await reading('Load and delivered power').innerText(),`${fixed(s.late.current*1e6,1)} µA · ${fixed(s.late.loadPower*1000,3)} mW`);
  const volts=Array.from({length:s.N},(_,i)=>s.now.nodes[s.N+i+1]-(i?s.now.nodes[s.N+i]:0));
  assert.equal(await reading('Stacked capacitor voltages now').innerText(),volts.map((v,i)=>`CS${i+1}: ${fixed(v,1)} V`).join(' + '));
  const conducting=s.now.on.map((on,i)=>on?`D${i+1}`:null).filter(Boolean);
  assert.equal(await reading('Conducting now').innerText(),conducting.length?conducting.join(', '):'None');
  assert.equal(await reading('Source now').innerText(),`${fixed(s.now.e,1)} V ideal · ${fixed(s.now.nodes[0],1)} V at AC terminal`);
  const readings=await page.locator('.daily-readings').innerText();assert.ok(!/NaN|undefined|Infinity/.test(readings));
  assert.equal(await page.locator('.daily-readings > div').count(),9);assert.equal(await page.locator('[data-play]').isDisabled(),false);
  return {cycle,result:await reading('Your result').innerText(),readings};
}
async function focusPart(id) {
  await action('Inspect: complete ladder');await page.locator('[data-labels]').check();
  await page.locator(`button[data-label-part="${id}"]`).click();await page.locator('[data-isolate]').check();await page.locator('[data-labels]').uncheck();
}

async function hitPart(name) {
  await canvas.scrollIntoViewIfNeeded(); const box = await canvas.boundingBox();
  for (let y = 4; y <= 16; y++) for (let x = 4; x <= 16; x++) {
    const point = [box.x + box.width * x / 20, box.y + box.height * y / 20]; await page.mouse.move(...point);
    if (await popup.isVisible() && await popup.innerText() === name) return point;
  }
  assert.fail(`No visible physical pointer target for ${name}`);
}
try {
  await page.goto(new URL('#machine/voltage-multiplier', base).href);
  await page.getByRole('heading', {name: 'Voltage multiplier', exact: true, level: 1}).waitFor(); await canvas.waitFor();
  assert.equal(await page.locator('[data-control]').count(), 6);
  assert.ok((await canvas.getAttribute('aria-label')).startsWith('Interactive 3D Voltage multiplier.'));
  assert.ok(await page.locator('[data-control="window"]').isVisible(),'Time-window control visible immediately');
  await laws(D, 0); await capture('opening'); await page.screenshot({path: `${output}/opening-page.png`});
  await page.locator('[data-step]').click(); await laws(D, 1); await capture('first-step'); await reset();
  for (const [i, p] of lesson.tryIt.entries()) {
    await preset(i);
    assert.equal(await page.locator('[data-isolate]').isChecked(), p.isolate);
    for (const [key, next] of Object.entries(p.values).filter(([key])=>key!=='mode')) near(Number(await page.locator(`[data-control="${key}"]`).inputValue()), next, 1e-10);
    outcomes.push({title: p.title, ...await laws(p.values, p.initialState.cycle)}); await capture(`preset-${i}`);
  }
  await preset(12); await page.locator('[data-play]').click(); await page.waitForTimeout(500); await page.locator('[data-play]').click();
  const replayCycle=Number((await reading('Your result').innerText()).match(/at cycle ([\d.]+)/)[1]);assert.ok(replayCycle>=399&&replayCycle<400,'Completed late window replays from cycle 399');
  const paused=await page.locator('.daily-readings').innerText();await page.waitForTimeout(250);assert.equal(await page.locator('.daily-readings').innerText(),paused);
  await reset();for(let i=0;i<39;i++)await page.locator('[data-step]').click();
  await page.locator('[data-play]').click();await page.waitForFunction(()=>document.querySelector('[data-play]').getAttribute('aria-pressed')==='false');
  await laws(D,40);await capture('completed-experiment');
  const domains={window:[0,1,1],...MULTIPLIER_DOMAINS};
  for(const [key,[min,max,step]] of Object.entries(domains))for(let next=min;next<=max;next+=step){
    await reset();await edit(key,next);const values={...D,[key]:next};await page.locator('[data-step]').click();
    controls.push({key,next,...await laws(values,values.window?399.25:1)});
  }
  for (let i = 0; i < await page.locator('[data-action]').count(); i++) {
    await reset(); await page.locator('[data-step]').click(); await page.locator('[data-action]').nth(i).click();
    actions.push({name: await page.locator('[data-action]').nth(i).innerText(), part: await page.locator('.daily-part-detail h3').innerText(), ...await laws(D, 1)}); await capture(`action-${i}`);
  }
  await reset();await edit('stages',4);await page.locator('[data-labels]').check();
  const parts=await page.locator('button[data-label-part]:visible:not(:disabled)').evaluateAll(elements=>elements.map(e=>({id:e.dataset.labelPart,name:e.innerText})));
  for(const part of parts){await action('Inspect: complete ladder');const button=page.locator(`button[data-label-part="${part.id}"]`);if(!(await button.isVisible())||await button.isDisabled())continue;await button.click();assert.equal(await page.locator('.daily-part-detail h3').innerText(),part.name);assert.equal(await button.getAttribute('aria-pressed'),'true');selections.push(part);}
  await page.locator('[data-labels]').uncheck();
  for(const [id,name]of[['node-chart','Compare node voltages'],['charts','Compare startup output'],['ripple-chart','Inspect cycle-400 waveform']]){await action(name);await page.locator('[data-labels]').check();const b=page.locator(`button[data-label-part="${id}"]`);await b.click();selections.push({id,name:await b.innerText()});await page.locator('[data-labels]').uncheck();}
  for(const id of['system','board','source','pump','smoothing','diodes','load','node-chart','charts','ripple-chart',...Array.from({length:4},(_,i)=>'pump-'+(i+1)),...Array.from({length:4},(_,i)=>'smooth-'+(i+1)),...Array.from({length:8},(_,i)=>'diode-'+(i+1))])assert.ok(selections.some(p=>p.id===id),`Part menu missed ${id}`);
  await reset();await focusPart('diode-1');const diodeHit=await hitPart('Diode D1');await page.mouse.click(...diodeHit);assert.equal(await popup.innerText(),'Diode D1');physicalHits.push('Diode D1');await capture('popup-diode');await page.locator('.daily-heading h1').click();
  await reset();await focusPart('pump-1');const hit=await hitPart('Pump capacitor CP1');await page.mouse.click(...hit);assert.equal(await popup.innerText(),'Pump capacitor CP1');physicalHits.push('Pump capacitor CP1');await capture('popup-pump-capacitor');
  let box=await canvas.boundingBox();await page.mouse.move(box.x+10,box.y+10);const beforeDrag=await canvas.screenshot();
  await page.mouse.move(...hit);await page.mouse.down();await page.mouse.move(hit[0]+35,hit[1]+20,{steps:10});await page.mouse.up();await page.mouse.move(box.x+10,box.y+10);assert.ok(!beforeDrag.equals(await canvas.screenshot()),'Dragging physical part moves object');
  await page.locator('.daily-heading h1').click();assert.equal(await popup.isVisible(),false);assert.equal(await page.locator('.daily-part-detail h3').count(),0);
  await reset();await focusPart('smooth-1');const smoothHit=await hitPart('Smoothing capacitor CS1');await page.mouse.click(...smoothHit);physicalHits.push('Smoothing capacitor CS1');await capture('popup-smoothing-capacitor');await page.locator('.daily-heading h1').click();
  await reset();await action('Inspect: complete ladder');await page.locator('[data-labels]').check();await page.locator('button[data-label-part="diode-1"]').click();await page.locator('.daily-heading h1').click();assert.equal(await page.locator('button[data-label-part="diode-1"]').getAttribute('aria-pressed'),'false');await page.locator('[data-labels]').uncheck();
  await action('Inspect: complete ladder'); await canvas.scrollIntoViewIfNeeded(); box = await canvas.boundingBox(); await page.mouse.move(box.x + 20, box.y + 20);
  assert.equal(await popup.isVisible(), false); const beforeRotate = await canvas.screenshot();
  await page.mouse.down(); await page.mouse.move(box.x + 100, box.y + 55, {steps: 12}); await page.mouse.up(); assert.ok(!beforeRotate.equals(await canvas.screenshot()), 'Background drag rotates object');
  await action('Inspect: complete ladder'); const beforeZoom = await canvas.screenshot(); await page.locator('[data-view="in"]').click();
  assert.ok(!beforeZoom.equals(await canvas.screenshot())); assert.equal(await page.locator('[data-separation]').inputValue(), '0');
  await page.locator('[data-view="out"]').click(); assert.equal(await page.locator('[data-separation]').inputValue(), '0');
  await canvas.scrollIntoViewIfNeeded(); box = await canvas.boundingBox(); await page.mouse.move(box.x + 20, box.y + 20);
  const held = await page.locator('.daily-readings').innerText(); for (let i = 0; i < 8; i++) await page.mouse.wheel(0, 240);
  await page.waitForFunction(() => document.querySelector('[data-separation]').value === '100'); assert.equal(await page.locator('.daily-readings').innerText(), held); await capture('grouped-parts');
  await page.locator('[data-reassemble]').click(); await action('Inspect: complete ladder');
  for (const view of ['Front', 'Side', 'Back', 'Top', 'Underneath', 'Angled']) {await page.getByRole('button', {name: view, exact: true}).click(); await capture('view-' + view.toLowerCase());}
  for (const width of [390, 320]) {
    await page.setViewportSize({width, height: width === 390 ? 844 : 568});
    const tools = page.getByRole('navigation', {name: 'Lesson tools'});
    for (const index of [1, 5, 6, 8, 11, 12]) {
      await tools.getByRole('button', {name: 'Try it yourself', exact: true}).click();await page.locator('[data-experiment]').nth(index).click();
      await tools.getByRole('button', {name: 'Controls', exact: true}).click();await laws(lesson.tryIt[index].values, lesson.tryIt[index].initialState.cycle);await capture(`phone-preset-${index}-${width}`);
    }
    await focusPart('diode-1');await hitPart('Diode D1');await capture('phone-diode-'+width);
    await action('Compare node voltages');await capture('phone-nodes-'+width);
    await action('Compare startup output');await capture('phone-startup-'+width);
    await action('Inspect cycle-400 waveform');await capture('phone-ripple-'+width);
    await action('Inspect: complete ladder');await capture('phone-' + width);await page.screenshot({path: `${output}/phone-page-${width}.png`});
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
  }
  await page.setViewportSize({width: 390, height: 844}); await action('Inspect: complete ladder');
  const session = await page.context().newCDPSession(page);
  async function pinch(from, to) {
    await canvas.scrollIntoViewIfNeeded(); const b = await canvas.boundingBox(), x = b.x + b.width / 2, y = b.y + b.height / 2, points = d => [{x: x - d, y, id: 0}, {x: x + d, y, id: 1}];
    await session.send('Input.dispatchTouchEvent', {type: 'touchStart', touchPoints: points(from)});
    for (let i = 1; i <= 12; i++) await session.send('Input.dispatchTouchEvent', {type: 'touchMove', touchPoints: points(from + (to - from) * i / 12)});
    await session.send('Input.dispatchTouchEvent', {type: 'touchEnd', touchPoints: []});
  }
  try {await pinch(120, 20); assert.ok(Number(await page.locator('[data-separation]').inputValue()) > 0); await capture('phone-pinch'); await pinch(20, 120); await page.waitForFunction(() => document.querySelector('[data-separation]').value === '0');} finally {await session.detach();}
  await page.setViewportSize({width: 1440, height: 1000});
  for (const [i] of lesson.quiz.options.entries()) {await page.locator('[data-answer]').nth(i).click(); assert.equal(await page.locator('.daily-answer').innerText(), (i === lesson.quiz.answer ? 'That’s right. ' : 'Try thinking through the parts again. ') + lesson.quiz.explanation);}
  await page.locator('.daily-return').click(); assert.ok(!page.url().endsWith('#machine/voltage-multiplier')); assert.deepEqual(errors, []);
  const report = {passed: true, outcomes, controls, actions, selections, physicalHits, pause: true, step: true, completion: true, replay: true, isolatedPartSwitch: true, windows: ['startup','late'], hoverClick: true, deselection: true, objectDrag: true, backgroundRotation: true, zoomOnlyButtons: true, wheelSeparation: true, pinch: true, mobileWidths: [390, 320], quiz: true, return: true, errors};
  await writeFile(`${output}/browser.json`, JSON.stringify(report, null, 2)); console.log(JSON.stringify(report));
} catch (error) {
  await writeFile(`${output}/failure.json`, JSON.stringify({message: error.message, errors, url: page.url(), body: await page.locator('body').innerText().catch(() => '')}, null, 2));
  await page.screenshot({path: `${output}/failure.png`}).catch(() => {}); throw error;
} finally {await browser.close();}

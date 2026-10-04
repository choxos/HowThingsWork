import assert from 'node:assert/strict';
import {mkdir, writeFile} from 'node:fs/promises';
import {chromium} from 'playwright';
import {airCleanerLesson as lesson} from './air-cleaner-lessons.js';
import {AIR_CLEANER_DEFAULTS as D, sampleAirCleaner} from './air-cleaner-physics.js';
import {particleSample} from './air-cleaner-geometry.js';
import {fixed} from './format.js';

const base = process.env.SITE_URL || 'http://127.0.0.1:4173/', output = process.env.EVIDENCE_DIR || 'documentation/air-cleaner-browser';
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
async function laws(values,time) {
  const s=sampleAirCleaner(values,time),pct=x=>`${fixed(x*100,2)}%`;
  const outcome=s.Q===0?'Fan off':values.mode===0?'Fibers retain particles':values.mode===2?(s.enabled?'Charging without a collector':'Needle unpowered'):(s.enabled?'Charged particles reach collecting plates':'Air passes unpowered plates');
  assert.equal(await reading('Your result').innerText(),`${outcome} · ${pct(s.remaining)} still airborne`);
  assert.equal(await reading('Room particle account').innerText(),`${pct(s.remaining)} air + ${pct(s.collected)} collected + ${pct(s.deposited)} deposited + ${pct(s.ventilated)} ventilated`);
  assert.equal(await reading('Clean air delivery').innerText(),`${fixed(s.cadr*3600,1)} m³/h`);
  assert.equal(await reading('Where particles went').innerText(),`${pct(s.settled)} settled · ${pct(s.electricalDeposit)} electrical deposition`);
  assert.equal(await reading('Room and repeated passes').innerText(),`${fixed(s.volume,0)} m³ · ${fixed(s.changes,2)} room volumes/h`);
  const cohort=Array.from({length:32},(_,i)=>particleSample(i,s,time)),retained=cohort.filter(p=>p.status==='captured').length,returned=cohort.filter(p=>p.status==='returned').length;
  assert.equal(await reading('Single-pass markers').innerText(),`${retained} captured · ${returned} returned · ${32-retained-returned} in transit`);
  const readings=await page.locator('.daily-readings').innerText();assert.ok(readings.includes(`${fixed(time/60,1)} of 60 minutes.`));assert.ok(!/NaN|undefined|Infinity/.test(readings));
  assert.equal(await page.locator('[data-play]').isDisabled(),false);return{time,result:await reading('Your result').innerText(),readings};
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
  await page.goto(new URL('#machine/air-cleaner', base).href);
  await page.getByRole('heading', {name: 'Air cleaner', exact: true, level: 1}).waitFor(); await canvas.waitFor();
  assert.equal(await page.locator('[data-control]').count(), 5);
  assert.ok((await canvas.getAttribute('aria-label')).startsWith('Interactive 3D Air cleaner.'));
  assert.ok(await page.locator('[data-control="mode"]').isVisible(), 'Method selector visible immediately');
  await laws(D, 0); await capture('opening'); await page.screenshot({path: `${output}/opening-page.png`});
  await page.locator('[data-step]').click(); await laws(D, 300); await capture('first-step'); await reset();
  for (const [i, p] of lesson.tryIt.entries()) {
    await preset(i);
    assert.equal(await page.locator('[data-isolate]').isChecked(), p.isolate);
    for (const [key, next] of Object.entries(p.values)) near(Number(await page.locator(`[data-control="${key}"]`).inputValue()), next, 1e-10);
    outcomes.push({title: p.title, ...await laws(p.values, p.initialState.time)}); await capture(`preset-${i}`);
  }
  await preset(15); await page.locator('[data-play]').click(); await page.waitForTimeout(500); await page.locator('[data-play]').click();
  assert.ok(Number((await page.locator('.daily-readings').innerText()).match(/([\d.]+) of 60 minutes/)[1]) < 2, 'Completed experiment replays from beginning');
  const paused = await page.locator('.daily-readings').innerText(); await page.waitForTimeout(250); assert.equal(await page.locator('.daily-readings').innerText(), paused);
  await reset(); for (let i = 0; i < 11; i++) await page.locator('[data-step]').click();
  await page.locator('[data-play]').click(); await page.waitForFunction(() => document.querySelector('[data-play]').getAttribute('aria-pressed') === 'false');
  await laws(D, 3600); await capture('completed-experiment');
  for (const [key, options] of Object.entries({mode:[0,1,2],size:[0,1,2,3,4,5,6],fan:[0,1,2,3],voltage:[0,1],room:[30,60,90]})) for (const next of options) {
    await reset(); await edit(key, next); const values = {...D, [key]: next}; await page.locator('[data-step]').click();
    controls.push({key, next, ...await laws(values, 300)});
  }
  for (let i = 0; i < await page.locator('[data-action]').count(); i++) {
    await reset(); await page.locator('[data-action]').nth(i).click();
    actions.push({name: await page.locator('[data-action]').nth(i).innerText(), part: await page.locator('.daily-part-detail h3').innerText(), ...await laws(D, 0)}); await capture(`action-${i}`);
  }
  for(const mode of[0,1,2]){
    await reset();await edit('mode',mode);await page.locator('[data-labels]').check();
    const parts=await page.locator('button[data-label-part]:visible:not(:disabled)').evaluateAll(elements=>elements.map(e=>({id:e.dataset.labelPart,name:e.innerText})));
    for(const part of parts){await action('Inspect: complete cleaner');const button=page.locator(`button[data-label-part="${part.id}"]`);if(!(await button.isVisible())||await button.isDisabled())continue;await button.click();assert.equal(await page.locator('.daily-part-detail h3').innerText(),part.name);assert.equal(await button.getAttribute('aria-pressed'),'true');if(!selections.some(p=>p.id===part.id))selections.push(part);}
    await page.locator('[data-labels]').uncheck();
  }
  for(const [id,name]of[['charts','Compare the room over one hour'],['size-chart','Compare capture by particle size']]){await action(name);await page.locator('[data-labels]').check();const b=page.locator(`button[data-label-part="${id}"]`);await b.click();selections.push({id,name:await b.innerText()});await page.locator('[data-labels]').uncheck();}
  for(const id of['system','body','prefilter','stage','filter','charger','collector','positive-plates','grounded-plates','carbon','fan','duct','motor','impeller','outlet','power','particles','flow','charts','size-chart'])assert.ok(selections.some(p=>p.id===id),`Part menu missed ${id}`);
  await reset();await action('Inspect: selected particle stage');const plateHit=await hitPart('Positive deflecting plates');await page.mouse.click(...plateHit);assert.equal(await popup.innerText(),'Positive deflecting plates');physicalHits.push('Positive deflecting plates');await capture('popup-positive-plates');await page.locator('.daily-heading h1').click();
  await reset();await action('Inspect: fan motor');const hit=await hitPart('Fan motor and support');await page.mouse.click(...hit);assert.equal(await popup.innerText(),'Fan motor and support');physicalHits.push('Fan motor and support');await capture('popup-motor');
  let box=await canvas.boundingBox();await page.mouse.move(box.x+10,box.y+10);const beforeDrag=await canvas.screenshot();
  await page.mouse.move(...hit);await page.mouse.down();await page.mouse.move(hit[0]+35,hit[1]+20,{steps:10});await page.mouse.up();await page.mouse.move(box.x+10,box.y+10);assert.ok(!beforeDrag.equals(await canvas.screenshot()),'Dragging physical part moves object');
  await page.locator('.daily-heading h1').click();assert.equal(await popup.isVisible(),false);assert.equal(await page.locator('.daily-part-detail h3').count(),0);
  for(const [mode,id,name]of[[1,'impeller','Pitched fan blades'],[2,'charger','Charging electrodes']]){await edit('mode',mode);await page.locator('[data-labels]').check();await page.locator(`button[data-label-part="${id}"]`).click();await page.locator('[data-isolate]').check();await page.locator('[data-labels]').uncheck();const point=await hitPart(name);await page.mouse.click(...point);assert.equal(await popup.innerText(),name);physicalHits.push(name);await capture('popup-'+id);await page.locator('.daily-heading h1').click();}
  await reset();await action('Inspect: complete cleaner');await page.locator('[data-labels]').check();await page.locator('button[data-label-part="collector"]').click();await page.locator('.daily-heading h1').click();assert.equal(await page.locator('button[data-label-part="collector"]').getAttribute('aria-pressed'),'false');await page.locator('[data-labels]').uncheck();
  await action('Inspect: complete cleaner'); await canvas.scrollIntoViewIfNeeded(); box = await canvas.boundingBox(); await page.mouse.move(box.x + 20, box.y + 20);
  assert.equal(await popup.isVisible(), false); const beforeRotate = await canvas.screenshot();
  await page.mouse.down(); await page.mouse.move(box.x + 100, box.y + 55, {steps: 12}); await page.mouse.up(); assert.ok(!beforeRotate.equals(await canvas.screenshot()), 'Background drag rotates object');
  await action('Inspect: complete cleaner'); const beforeZoom = await canvas.screenshot(); await page.locator('[data-view="in"]').click();
  assert.ok(!beforeZoom.equals(await canvas.screenshot())); assert.equal(await page.locator('[data-separation]').inputValue(), '0');
  await page.locator('[data-view="out"]').click(); assert.equal(await page.locator('[data-separation]').inputValue(), '0');
  await canvas.scrollIntoViewIfNeeded(); box = await canvas.boundingBox(); await page.mouse.move(box.x + 20, box.y + 20);
  const held = await page.locator('.daily-readings').innerText(); for (let i = 0; i < 8; i++) await page.mouse.wheel(0, 240);
  await page.waitForFunction(() => document.querySelector('[data-separation]').value === '100'); assert.equal(await page.locator('.daily-readings').innerText(), held); await capture('grouped-parts');
  await page.locator('[data-reassemble]').click(); await action('Inspect: complete cleaner');
  for (const view of ['Front', 'Side', 'Back', 'Top', 'Underneath', 'Angled']) {await page.getByRole('button', {name: view, exact: true}).click(); await capture('view-' + view.toLowerCase());}
  for (const width of [390, 320]) {
    await page.setViewportSize({width, height: width === 390 ? 844 : 568});
    const tools = page.getByRole('navigation', {name: 'Lesson tools'});
    for (const index of [1, 9, 13, 14, 15]) {
      await tools.getByRole('button', {name: 'Try it yourself', exact: true}).click();await page.locator('[data-experiment]').nth(index).click();
      await tools.getByRole('button', {name: 'Controls', exact: true}).click();await laws(lesson.tryIt[index].values, lesson.tryIt[index].initialState.time);await capture(`phone-preset-${index}-${width}`);
    }
    await action('Inspect: fan motor');await hitPart('Fan motor and support');await capture('phone-motor-' + width);
    await action('Compare the room over one hour');await capture('phone-room-chart-' + width);
    await action('Inspect: complete cleaner');await capture('phone-' + width);await page.screenshot({path: `${output}/phone-page-${width}.png`});
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
  }
  await page.setViewportSize({width: 390, height: 844}); await action('Inspect: complete cleaner');
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
  await page.locator('.daily-return').click(); assert.ok(!page.url().endsWith('#machine/air-cleaner')); assert.deepEqual(errors, []);
  const report = {passed: true, outcomes, controls, actions, selections, physicalHits, pause: true, step: true, completion: true, replay: true, isolatedPartSwitch: true, hoverClick: true, deselection: true, objectDrag: true, backgroundRotation: true, zoomOnlyButtons: true, wheelSeparation: true, pinch: true, mobileWidths: [390, 320], quiz: true, return: true, errors};
  await writeFile(`${output}/browser.json`, JSON.stringify(report, null, 2)); console.log(JSON.stringify(report));
} catch (error) {
  await writeFile(`${output}/failure.json`, JSON.stringify({message: error.message, errors, url: page.url(), body: await page.locator('body').innerText().catch(() => '')}, null, 2));
  await page.screenshot({path: `${output}/failure.png`}).catch(() => {}); throw error;
} finally {await browser.close();}

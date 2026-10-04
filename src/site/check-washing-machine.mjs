import assert from 'node:assert/strict';
import {mkdir, writeFile} from 'node:fs/promises';
import {chromium} from 'playwright';
import {washingMachineLesson as lesson} from './washing-machine-lesson.js';
import {WASHER_DEFAULTS as D, WASHER_DOMAINS, sampleWasher, washerPlan} from './washing-machine-physics.js';
import {fixed} from './format.js';
const base = process.env.SITE_URL || 'http://127.0.0.1:4173/', output = process.env.EVIDENCE_DIR || 'documentation/washing-machine-browser';
await mkdir(output, {recursive: true});
const browser = await chromium.launch({channel: 'chrome', headless: true});
const page = await browser.newPage({viewport: {width: 1440, height: 1000}, hasTouch: true, reducedMotion: 'reduce'});
page.setDefaultTimeout(25000);
const errors = [], outcomes = [], controls = [], actions = [], selections = [], physicalHits = [];
page.on('pageerror', error => errors.push(error.message));
const canvas = page.locator('canvas'), popup = page.locator('.daily-part-popup');
const reading = label => page.locator('.daily-readings > div').filter({has: page.getByText(label, {exact: true})}).locator('dd');
const tab = name => page.getByRole('tab', {name, exact: true}).click();
const capture = async name => {await canvas.scrollIntoViewIfNeeded(); await canvas.screenshot({path: `${output}/${name}.png`});};
const reset = () => page.getByRole('button', {name: 'Reset experiment', exact: true}).click();
const action = name => page.getByRole('button', {name, exact: true}).click();
async function preset(index) {await tab('Try it yourself'); await page.locator('[data-experiment]').nth(index).click(); await tab('Controls');}
async function edit(key, value) {await page.locator(`[data-number="${key}"]`).fill(String(value)); await page.locator(`[data-number="${key}"]`).press('Tab');}
async function laws(given, time) {
  const values = {...D, ...given}, s = sampleWasher(values, time), n = s.now;
  assert.equal(await reading('Drum motion').innerText(), `${fixed(n.rpm, 0)} rpm · ${fixed((n.rpm * Math.PI / 30) ** 2 * 0.25 / 9.81, n.rpm < 100 ? 2 : 0)} g at the wall`);
  assert.equal(await reading('Bath and heater').innerText(), `${fixed(n.water, 1)} L free water · ${fixed(n.T, 1)} °C`);
  assert.equal(await reading('Water balance').innerText(), `${fixed(n.used, 1)} L supplied · ${fixed(n.drained, 1)} L drained`);
  assert.equal(await reading('Detergent remaining').innerText(), `${fixed(n.detergentInLaundry, 2)} g in the laundry`);
  assert.equal(await reading('Retained water').innerText(), `${fixed(n.moisture * 100, 1)}% of dry laundry mass`);
  assert.equal(await reading('Suspension').innerText(), `${fixed(n.amplitude * 1000, 2)} mm recent peak · ${fixed(n.floor, 1)} N peak floor force`);
  assert.equal(await reading('Electrical energy').innerText(), `${fixed(n.energy / 3.6e6, 3)} kWh`);
  assert.equal(await reading('Door and drain').innerText(), s.doorLocked ? 'Door locked' : s.complete ? 'Stopped, drained and unlocked' : 'Ready · door closed');
  const readings = await page.locator('.daily-readings').innerText(); assert.ok(!/NaN|undefined|Infinity/.test(readings));
  assert.equal(await page.locator('.daily-readings > div').count(), 9);
  return {time: s.clock, phase: n.stage, moisture: n.moisture, readings};
}
async function focusPart(id) {
  await action('Inspect: complete washer'); await page.locator('[data-labels]').check();
  await page.locator(`button[data-label-part="${id}"]`).click(); await page.locator('[data-isolate]').check(); await page.locator('[data-labels]').uncheck();
}
async function hitPart(name) {
  await canvas.scrollIntoViewIfNeeded(); const box = await canvas.boundingBox();
  for (let y = 4; y <= 16; y++) for (let x = 4; x <= 16; x++) {
    const point = [box.x + box.width * x / 20, box.y + box.height * y / 20]; await page.mouse.move(...point);
    if (await popup.isVisible() && await popup.innerText() === name) return point;
  }
  assert.fail(`No physical pointer target for ${name}`);
}
try {
  await page.goto(new URL('#machine/washing-machine', base).href);
  await page.getByRole('heading', {name: 'Washing machine', exact: true, level: 1}).waitFor(); await canvas.waitFor();
  assert.equal(await page.locator('[data-control]').count(), 5);
  for (const key of ['temperature', 'spin']) assert.ok(await page.locator(`[data-control="${key}"]`).isVisible(), `${key} visible immediately`);
  await laws(D, 0); await capture('opening'); await page.screenshot({path: `${output}/opening-page.png`});
  await page.locator('[data-cutaway]').uncheck(); await capture('exterior'); await page.locator('[data-cutaway]').check();
  await page.locator('[data-step]').click(); await laws(D, 30); await capture('first-step'); await reset();
  for (const [i, experiment] of lesson.tryIt.entries()) {
    await preset(i);
    for (const [key, value] of Object.entries(experiment.values)) assert.equal(Number(await page.locator(`[data-control="${key}"]`).inputValue()), value);
    outcomes.push({title: experiment.title, ...await laws(experiment.values, experiment.initialState.time)}); await capture(`preset-${i}`);
  }
  await page.locator('[data-play]').click(); await page.waitForTimeout(600); await page.locator('[data-play]').click();
  assert.equal((await reading('Your result').innerText()).startsWith('Complete'), false, 'Completed program replays');
  const paused = await page.locator('.daily-readings').innerText(); await page.waitForTimeout(250); assert.equal(await page.locator('.daily-readings').innerText(), paused);
  await preset(15); await page.locator('[data-play]').click(); await page.waitForFunction(() => document.querySelector('[data-play]').getAttribute('aria-pressed') === 'false');
  await laws(D, washerPlan(D).duration); await capture('completed-experiment');
  for (const [key, [min, max, step]] of Object.entries(WASHER_DOMAINS)) for (let raw = min; raw <= max + 1e-9; raw += step) {
    const value = Number(raw.toFixed(3)), settings = {...D, [key]: value};
    await reset(); await edit(key, value); assert.equal(Number(await page.locator(`[data-control="${key}"]`).inputValue()), value);
    await laws(settings, 0); await page.locator('[data-step]').click(); await laws(settings, 30);
    const count = Math.ceil(washerPlan(settings).duration / 30);
    await page.locator('[data-step]').evaluate((button, count) => {for (let i = 0; i < count; i++) button.click();}, count);
    controls.push({key, value, ...await laws(settings, washerPlan(settings).duration)});
  }
  for (let i = 0; i < await page.locator('[data-action]').count(); i++) {
    await reset(); await page.locator('[data-step]').click(); await page.locator('[data-action]').nth(i).click();
    actions.push({name: await page.locator('[data-action]').nth(i).innerText(), ...await laws(D, 30)}); await capture(`action-${i}`);
  }
  for (const index of [3, 6, 16]) {
    await preset(index); await action('Inspect: complete washer'); await page.locator('[data-labels]').check();
    const parts = await page.locator('button[data-label-part]:visible:not(:disabled)').evaluateAll(elements => elements.map(e => ({id: e.dataset.labelPart, name: e.innerText})));
    for (const part of parts) {
      await action('Inspect: complete washer'); const button = page.locator(`button[data-label-part="${part.id}"]`);
      if (!(await button.isVisible()) || await button.isDisabled()) continue;
      await button.click(); assert.equal(await page.locator('.daily-part-detail h3').innerText(), part.name); assert.equal(await button.getAttribute('aria-pressed'), 'true');
      if (!selections.some(selected => selected.id === part.id)) selections.push(part);
    }
    await page.locator('[data-labels]').uncheck();
  }
  await reset(); await page.locator('[data-cutaway]').uncheck(); await page.locator('[data-labels]').check();
  for (const id of ['panels', 'door', 'seal']) {
    const button = page.locator(`button[data-label-part="${id}"]`); await button.click();
    if (!selections.some(p => p.id === id)) selections.push({id, name: await button.innerText()});
  }
  await capture('selected-cover'); await page.locator('[data-labels]').uncheck(); await page.locator('[data-cutaway]').check();
  for (const [id, label] of [['program-chart', 'Read the program chart'], ['shake-chart', 'Read the suspension chart']]) {
    await action(label); await page.locator('[data-labels]').check();
    for (const item of [id, 'charts']) {const button = page.locator(`button[data-label-part="${item}"]`); await button.click(); if (!selections.some(p => p.id === item)) selections.push({id: item, name: await button.innerText()});}
    await page.locator('[data-labels]').uncheck();
  }
  assert.equal(selections.length, 45, 'Every named component and category can be selected');
  for (const [id, name] of [['heater', 'Immersed heating element'], ['pump', 'Drain pump and impeller'], ['motor', 'Direct-drive motor']]) {
    await reset(); await focusPart(id); const hit = await hitPart(name); await page.mouse.click(...hit); assert.equal(await popup.innerText(), name); physicalHits.push(name); await capture(`popup-${id}`);
    if (id === 'heater') {
      const box = await canvas.boundingBox(); await page.mouse.move(box.x + 10, box.y + 10); const before = await canvas.screenshot();
      await page.mouse.move(...hit); await page.mouse.down(); await page.mouse.move(hit[0] + 35, hit[1] + 20, {steps: 10}); await page.mouse.up(); await page.mouse.move(box.x + 10, box.y + 10);
      assert.ok(!before.equals(await canvas.screenshot()), 'Dragging physical part moves object');
    }
    await page.locator('.daily-heading h1').click(); assert.equal(await popup.isVisible(), false); assert.equal(await page.locator('.daily-part-detail h3').count(), 0);
  }
  await reset(); await page.locator('[data-labels]').check(); await page.locator('button[data-label-part="heater"]').click(); await page.locator('.daily-heading h1').click(); assert.equal(await page.locator('button[data-label-part="heater"]').getAttribute('aria-pressed'), 'false'); await page.locator('[data-labels]').uncheck();
  await action('Inspect: complete washer'); await canvas.scrollIntoViewIfNeeded(); let box = await canvas.boundingBox();
  await page.mouse.move(box.x + 15, box.y + 15); assert.equal(await popup.isVisible(), false); const beforeRotate = await canvas.screenshot();
  await page.mouse.down(); await page.mouse.move(box.x + 95, box.y + 55, {steps: 12}); await page.mouse.up(); assert.ok(!beforeRotate.equals(await canvas.screenshot()), 'Background drag rotates');
  await action('Inspect: complete washer'); const beforeZoom = await canvas.screenshot(); await page.locator('[data-view="in"]').click(); assert.ok(!beforeZoom.equals(await canvas.screenshot())); assert.equal(await page.locator('[data-separation]').inputValue(), '0');
  await page.locator('[data-view="out"]').click(); assert.equal(await page.locator('[data-separation]').inputValue(), '0');
  await canvas.scrollIntoViewIfNeeded(); box = await canvas.boundingBox(); await page.mouse.move(box.x + 15, box.y + 15);
  const held = await page.locator('.daily-readings').innerText(); for (let i = 0; i < 8; i++) await page.mouse.wheel(0, 240);
  await page.waitForFunction(() => document.querySelector('[data-separation]').value === '100'); assert.equal(await page.locator('.daily-readings').innerText(), held); await capture('grouped-parts');
  for (const name of ['Cabinet and loading door', 'Tub, drum and laundry', 'Motor and drum drive', 'Suspension', 'Fill, heat and drain circuit', 'Control and sensing']) assert.ok((await page.locator('.daily-inventory-labels').innerText()).includes(name));
  await page.locator('[data-reassemble]').click(); await action('Inspect: complete washer');
  for (const view of ['Front', 'Side', 'Back', 'Top', 'Underneath', 'Angled']) {await page.getByRole('button', {name: view, exact: true}).click(); await capture(`view-${view.toLowerCase()}`);}
  for (const width of [390, 320]) {
    await page.setViewportSize({width, height: width === 390 ? 844 : 568}); const tools = page.getByRole('navigation', {name: 'Lesson tools'});
    for (const index of [1, 3, 7, 13, 14, 15, 16]) {
      await tools.getByRole('button', {name: 'Try it yourself', exact: true}).click(); await page.locator('[data-experiment]').nth(index).click(); await tools.getByRole('button', {name: 'Controls', exact: true}).click();
      await laws(lesson.tryIt[index].values, lesson.tryIt[index].initialState.time); await capture(`phone-preset-${index}-${width}`);
    }
    await focusPart('pump'); await hitPart('Drain pump and impeller'); await capture(`phone-pump-${width}`);
    await action('Read the program chart'); await capture(`phone-program-chart-${width}`); await action('Read the suspension chart'); await capture(`phone-shake-chart-${width}`);
    await action('Inspect: complete washer'); await capture(`phone-${width}`); await page.screenshot({path: `${output}/phone-page-${width}.png`}); assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
  }
  await page.setViewportSize({width: 390, height: 844}); await action('Inspect: complete washer');
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
  await page.locator('.daily-return').click(); assert.ok(!page.url().endsWith('#machine/washing-machine')); assert.deepEqual(errors, []);
  const report = {passed: true, outcomes, controls, actions, selections, physicalHits, pause: true, step: true, completion: true, replay: true, hoverClick: true, deselection: true, objectDrag: true, backgroundRotation: true, zoomOnlyButtons: true, wheelSeparation: true, pinch: true, mobileWidths: [390, 320], quiz: true, return: true, errors};
  await writeFile(`${output}/browser.json`, JSON.stringify(report, null, 2)); console.log(JSON.stringify(report));
} catch (error) {
  await writeFile(`${output}/failure.json`, JSON.stringify({message: error.message, errors, url: page.url(), body: await page.locator('body').innerText().catch(() => '')}, null, 2));
  await page.screenshot({path: `${output}/failure.png`}).catch(() => {}); throw error;
} finally {await browser.close();}

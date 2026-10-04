import assert from 'node:assert/strict';
import {mkdir, writeFile} from 'node:fs/promises';
import {chromium} from 'playwright';
import {kineticWatchLesson as lesson} from './kinetic-watch-lesson.js';
import {KINETIC_DEFAULTS as D, KINETIC_MODES, createKineticTimeline, kineticClock} from './kinetic-watch-physics.js';

const base = process.env.SITE_URL || 'http://127.0.0.1:4173/', output = process.env.EVIDENCE_DIR || 'documentation/kinetic-watch-browser';
await mkdir(output, {recursive: true});
const browser = await chromium.launch({channel: 'chrome', headless: true});
const page = await browser.newPage({viewport: {width: 1440, height: 1000}, hasTouch: true, reducedMotion: 'reduce'});
page.setDefaultTimeout(20000);
const errors = [], outcomes = [], controls = [], actions = [], selections = [], physicalHits = [], runs = new Map();
page.on('pageerror', error => errors.push(error.message));
const canvas = page.locator('canvas'), popup = page.locator('.daily-part-popup');
const reading = label => page.locator('.daily-readings > div').filter({has: page.getByText(label, {exact: true})}).locator('dd');
const value = async label => parseFloat((await reading(label).innerText()).replaceAll(',', ''));
const tab = name => page.getByRole('tab', {name, exact: true}).click();
const capture = async name => {await canvas.scrollIntoViewIfNeeded(); await canvas.screenshot({path: `${output}/${name}.png`});};
const reset = () => page.getByRole('button', {name: 'Reset experiment', exact: true}).click();
const action = name => page.getByRole('button', {name: `Inspect: ${name}`, exact: true}).click();
async function preset(index) {await tab('Try it yourself'); await page.locator('[data-experiment]').nth(index).click(); await tab('Controls');}
async function edit(key, next) {
  const control = page.locator(`[data-control="${key}"]`);
  if (await control.evaluate(element => element.tagName === 'SELECT')) await control.selectOption(String(next));
  else {await page.locator(`[data-number="${key}"]`).fill(String(next)); await page.keyboard.press('Tab');}
}
const near = (actual, expected, tolerance) => assert.ok(Number.isFinite(actual) && Math.abs(actual - expected) <= tolerance, `${actual} differs from ${expected}`);
async function laws(values, time) {
  const key = JSON.stringify(values); if (!runs.has(key)) runs.set(key, createKineticTimeline(values)); const s = runs.get(key).sample(time);
  assert.equal(await reading('Watch face').innerText(), kineticClock(s.ticks + 9 * 3600));
  near(await value('Capacitor'), s.voltage, .000501);
  near(await value('Generator now'), s.motion.magnetSpeed * 60 / (2 * Math.PI), .501);
  near(await value('Bridge current now'), s.instant.current * 1000, .000051);
  near(await value('Quartz timing'), s.frequency, .0000051);
  assert.ok((await reading('Your result').innerText()).startsWith(s.running ? 'Running' : 'Stopped'));
  assert.ok(!/NaN|undefined|Infinity/.test(await page.locator('.daily-readings').innerText()));
  assert.equal(await page.locator('[data-play]').isDisabled(), false);
  return {time, voltage: await value('Capacitor'), face: await reading('Watch face').innerText(), result: await reading('Your result').innerText()};
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
  await page.goto(new URL('#machine/kinetic-quartz-watch', base).href);
  await page.getByRole('heading', {name: 'Kinetic quartz watch', exact: true, level: 1}).waitFor(); await canvas.waitFor();
  assert.equal(await page.locator('[data-control]').count(), 5);
  assert.ok(await page.locator('[data-control="mode"]').isVisible(), 'Time-scale selector visible immediately');
  await laws(D, 0); await capture('opening'); await page.screenshot({path: `${output}/opening-page.png`});
  await page.locator('[data-step]').click(); await page.getByRole('button', {name: 'Read the watch face', exact: true}).click();
  await laws(D, 1); await capture('first-pulse'); await reset();
  for (const [i, p] of lesson.tryIt.entries()) {
    await preset(i);
    for (const [key, next] of Object.entries(p.values)) near(Number(await page.locator(`[data-control="${key}"]`).inputValue()), next, 1e-10);
    outcomes.push({title: p.title, ...await laws(p.values, p.initialState.time)}); await capture(`preset-${i}`);
    if ([1, 5, 12].includes(i)) {const name = i === 1 ? 'Oscillating weight' : i === 5 ? 'Generating magnet' : 'Storage capacitor'; await hitPart(name); physicalHits.push(name);}
  }
  await preset(3); await page.locator('[data-step]').click(); await laws(lesson.tryIt[3].values, 11);
  await page.locator('[data-step]').click(); await laws(lesson.tryIt[3].values, 12);
  await page.locator('[data-play]').click(); await page.waitForTimeout(500); await page.locator('[data-play]').click();
  assert.notEqual(await reading('Watch face').innerText(), kineticClock(12 + 9 * 3600), 'Completed experiment replays from the beginning');
  const paused = await page.locator('.daily-readings').innerText(); await page.waitForTimeout(250); assert.equal(await page.locator('.daily-readings').innerText(), paused);
  await preset(5); for (let i = 0; i < 19; i++) await page.locator('[data-step]').click();
  await page.locator('[data-play]').click(); await page.waitForFunction(() => document.querySelector('[data-play]').getAttribute('aria-pressed') === 'false');
  await laws(lesson.tryIt[5].values, .04); await capture('completed-generator-closeup');
  for (const [key, options] of Object.entries({mode: [0, 1, 2], motion: [0, 1, 3], minutes: [0, .5, 20], voltage: [0, .59, 2.2], temperature: [-10, 0, 50]})) for (const next of options) {
    await reset(); await edit(key, next); const values = {...D, [key]: next}; await page.locator('[data-step]').click();
    controls.push({key, next, ...await laws(values, KINETIC_MODES[values.mode].step)});
  }
  await reset();
  for (let i = 0; i < await page.locator('[data-action]').count(); i++) {
    await page.locator('[data-action]').nth(i).click();
    actions.push({name: await page.locator('[data-action]').nth(i).innerText(), part: await page.locator('.daily-part-detail h3').innerText(), ...await laws(D, 0)}); await capture(`action-${i}`);
  }
  await page.locator('[data-labels]').check();
  const parts = await page.locator('button[data-label-part]').evaluateAll(elements => elements.map(element => ({id: element.dataset.labelPart, name: element.innerText})));
  for (const part of parts) {
    await action({'reserve-chart': 'charge and reserve plot', waveform: 'generator waveform', timing: 'quartz and divider'}[part.id] || 'complete watch');
    await page.locator('[data-cutaway]').setChecked(part.id !== 'bridges');
    await page.locator(`button[data-label-part="${part.id}"]`).click();
    assert.equal(await page.locator('.daily-part-detail h3').innerText(), part.name);
    assert.equal(await page.locator(`button[data-label-part="${part.id}"]`).getAttribute('aria-pressed'), 'true'); selections.push(part);
  }
  await page.locator('[data-labels]').uncheck(); await reset(); await action('capacitor');
  const hit = await hitPart('Storage capacitor'); await page.mouse.click(...hit); assert.equal(await popup.innerText(), 'Storage capacitor');
  let box = await canvas.boundingBox(); await page.mouse.move(box.x + 10, box.y + 10); const beforeDrag = await canvas.screenshot();
  await page.mouse.move(...hit); await page.mouse.down(); await page.mouse.move(hit[0] + 35, hit[1] + 20, {steps: 10}); await page.mouse.up(); await page.mouse.move(box.x + 10, box.y + 10);
  assert.ok(!beforeDrag.equals(await canvas.screenshot()), 'Dragging physical part moves object');
  await page.locator('.daily-heading h1').click(); assert.equal(await popup.isVisible(), false); assert.equal(await page.locator('.daily-part-detail h3').count(), 0);
  await action('complete watch'); await page.locator('[data-labels]').check(); await page.locator('button[data-label-part="store"]').click();
  await page.locator('.daily-heading h1').click(); assert.equal(await page.locator('button[data-label-part="store"]').getAttribute('aria-pressed'), 'false'); await page.locator('[data-labels]').uncheck();
  await action('complete watch'); await canvas.scrollIntoViewIfNeeded(); box = await canvas.boundingBox(); await page.mouse.move(box.x + 20, box.y + 20);
  assert.equal(await popup.isVisible(), false); const beforeRotate = await canvas.screenshot();
  await page.mouse.down(); await page.mouse.move(box.x + 100, box.y + 55, {steps: 12}); await page.mouse.up(); assert.ok(!beforeRotate.equals(await canvas.screenshot()), 'Background drag rotates object');
  await action('complete watch'); const beforeZoom = await canvas.screenshot(); await page.locator('[data-view="in"]').click();
  assert.ok(!beforeZoom.equals(await canvas.screenshot())); assert.equal(await page.locator('[data-separation]').inputValue(), '0');
  await page.locator('[data-view="out"]').click(); assert.equal(await page.locator('[data-separation]').inputValue(), '0');
  await canvas.scrollIntoViewIfNeeded(); box = await canvas.boundingBox(); await page.mouse.move(box.x + 20, box.y + 20);
  const held = await page.locator('.daily-readings').innerText(); for (let i = 0; i < 8; i++) await page.mouse.wheel(0, 240);
  await page.waitForFunction(() => document.querySelector('[data-separation]').value === '100'); assert.equal(await page.locator('.daily-readings').innerText(), held); await capture('grouped-parts');
  await page.locator('[data-reassemble]').click(); await action('complete watch');
  for (const view of ['Front', 'Side', 'Back', 'Top', 'Underneath', 'Angled']) {await page.getByRole('button', {name: view, exact: true}).click(); await capture('view-' + view.toLowerCase());}
  for (const width of [390, 320]) {
    await page.setViewportSize({width, height: width === 390 ? 844 : 568});
    const tools = page.getByRole('navigation', {name: 'Lesson tools'});
    await tools.getByRole('button', {name: 'Try it yourself', exact: true}).click(); await page.locator('[data-experiment]').nth(12).click();
    await tools.getByRole('button', {name: 'Controls', exact: true}).click(); await laws(lesson.tryIt[12].values, 600); await hitPart('Storage capacitor'); await capture('phone-capacitor-' + width);
    await action('charge and reserve plot'); await capture('phone-chart-' + width);
    await action('generator waveform'); await capture('phone-waveform-' + width);
    await action('quartz and divider'); await capture('phone-divider-' + width);
    await action('complete watch'); await capture('phone-' + width); await page.screenshot({path: `${output}/phone-page-${width}.png`});
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
  }
  await page.setViewportSize({width: 390, height: 844}); await action('complete watch');
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
  await page.locator('.daily-return').click(); assert.ok(!page.url().endsWith('#machine/kinetic-quartz-watch')); assert.deepEqual(errors, []);
  const report = {passed: true, outcomes, controls, actions, selections, physicalHits, pause: true, step: true, completion: true, replay: true, isolatedPartSwitch: true, hoverClick: true, deselection: true, objectDrag: true, backgroundRotation: true, zoomOnlyButtons: true, wheelSeparation: true, pinch: true, mobileWidths: [390, 320], quiz: true, return: true, errors};
  await writeFile(`${output}/browser.json`, JSON.stringify(report, null, 2)); console.log(JSON.stringify(report));
} catch (error) {
  await writeFile(`${output}/failure.json`, JSON.stringify({message: error.message, errors, url: page.url(), body: await page.locator('body').innerText().catch(() => '')}, null, 2));
  await page.screenshot({path: `${output}/failure.png`}).catch(() => {}); throw error;
} finally {await browser.close();}

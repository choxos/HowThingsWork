import assert from 'node:assert/strict';
import {mkdir, writeFile} from 'node:fs/promises';
import {chromium} from 'playwright';
import {liquidThermometerLesson as lesson} from './liquid-thermometer-lesson.js';
import {LIQUID_GLASS_DEFAULTS as D, sampleLiquidThermometer as sample} from './liquid-thermometer-physics.js';

const base = process.env.SITE_URL || 'http://127.0.0.1:4173/', output = process.env.EVIDENCE_DIR || 'documentation/liquid-thermometer-browser';
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
const action = name => page.getByRole('button', {name: `Inspect: ${name}`, exact: true}).click();
async function preset(index) {await tab('Try it yourself'); await page.locator('[data-experiment]').nth(index).click(); await tab('Controls');}
async function edit(key, next) {
  if (key === 'liquid') await page.locator('[data-control="liquid"]').selectOption(String(next));
  else {await page.locator(`[data-number="${key}"]`).fill(String(next)); await page.keyboard.press('Tab');}
}
const near = (actual, expected, tolerance = .0051) => assert.ok(Number.isFinite(actual) && Math.abs(actual - expected) <= tolerance, `${actual} differs from ${expected}`);
async function laws(values, time) {
  const s = sample(values, time);
  near(await value('Elapsed time'), s.clock); near(await value('Liquid temperature'), s.temperature);
  near(await value('Surroundings'), values.surroundings); near(await value('Remaining temperature gap'), s.gap);
  near(await value('Height sensitivity at 20 °C'), s.sensitivity, .00051);
  near(await value('Liquid volume'), s.liquidVolume, .000051); near(await value('Relative volume change'), s.relativeVolumeChange, .000051);
  if (s.reading === null) assert.equal(await reading('Thermometer reading').innerText(), 'Unavailable');
  else near(await value('Thermometer reading'), s.reading);
  assert.ok(!/NaN|undefined|Infinity/.test(await page.locator('.daily-readings').innerText()));
  assert.equal(await page.locator('[data-play]').isDisabled(), false);
  return {status: s.status, time: await value('Elapsed time'), temperature: await value('Liquid temperature'), reading: await reading('Thermometer reading').innerText()};
}
async function hitPart(name) {
  await canvas.scrollIntoViewIfNeeded(); const box = await canvas.boundingBox();
  for (let y = 5; y <= 15; y++) for (let x = 5; x <= 15; x++) {
    const point = [box.x + box.width * x / 20, box.y + box.height * y / 20]; await page.mouse.move(...point);
    if (await popup.isVisible() && await popup.innerText() === name) return point;
  }
  assert.fail(`No visible physical pointer target for ${name}`);
}
try {
  await page.goto(new URL('#machine/liquid-in-glass-thermometer', base).href);
  await page.getByRole('heading', {name: 'Liquid-in-glass thermometer', exact: true, level: 1}).waitFor(); await canvas.waitFor();
  assert.equal(await page.locator('[data-control]').count(), 5);
  assert.ok(await page.locator('.daily-primary-controls [data-control="liquid"]').isVisible(), 'Liquid choice is visible at opening');
  await laws(D, 0); await capture('opening'); await page.screenshot({path: `${output}/opening-page.png`});
  for (const [i, p] of lesson.tryIt.entries()) {
    await preset(i);
    for (const [key, next] of Object.entries(p.values)) near(Number(await page.locator(`[data-control="${key}"]`).inputValue()), next, 1e-10);
    outcomes.push({title: p.title, ...await laws(p.values, p.initialState.time)});
    await capture(`preset-${i}`);
    if ([8, 9].includes(i)) {
      const name = i === 8 ? 'Upper expansion chamber' : 'Lower bulb';
      await hitPart(name); physicalHits.push(name);
    }
  }
  await preset(14); await page.locator('[data-step]').click(); await laws(lesson.tryIt[14].values, 30);
  await page.locator('[data-play]').click(); await page.waitForTimeout(650); await page.locator('[data-play]').click();
  const paused = await page.locator('.daily-readings').innerText(); await page.waitForTimeout(250); assert.equal(await page.locator('.daily-readings').innerText(), paused);
  await preset(0); for (let i = 0; i < 27; i++) await page.locator('[data-step]').click();
  await page.locator('[data-play]').click(); await page.waitForFunction(() => document.querySelector('[data-play]').getAttribute('aria-pressed') === 'false', null, {timeout: 15000});
  await laws(lesson.tryIt[0].values, 900); await page.locator('[data-play]').click(); await page.waitForTimeout(250); await page.locator('[data-play]').click();
  assert.ok(await value('Elapsed time') < 900, 'Completed run replays');
  await preset(10); await page.locator('[data-play]').click(); await page.waitForTimeout(250); await page.locator('[data-play]').click();
  assert.ok(await value('Elapsed time') < 110, 'Phase-limited run replays from selected initial values');
  for (const [key, options] of Object.entries({liquid: [0, 1], bore: [.15, .3, .5], initial: [-20, 0, 40], surroundings: [-50, -40, 20, 60], response: [5, 60, 120]})) for (const next of options) {
    await reset(); await edit(key, next); await action('after one minute'); controls.push({key, next, ...await laws({...D, [key]: next}, 60)});
  }
  await reset();
  for (let i = 0; i < await page.locator('[data-action]').count(); i++) {
    await page.locator('[data-action]').nth(i).click();
    actions.push({name: await page.locator('[data-action]').nth(i).innerText(), part: await page.locator('.daily-part-detail h3').innerText(), time: await value('Elapsed time')});
    await capture(`action-${i}`);
  }
  await page.locator('[data-labels]').check();
  const parts = await page.locator('button[data-label-part]').evaluateAll(elements => elements.map(element => ({id: element.dataset.labelPart, name: element.innerText})));
  for (const part of parts) {
    await action(part.id === 'chart' ? 'temperature response' : 'complete thermometer');
    await page.locator(`button[data-label-part="${part.id}"]`).click();
    assert.equal(await page.locator('.daily-part-detail h3').innerText(), part.name);
    assert.equal(await page.locator(`button[data-label-part="${part.id}"]`).getAttribute('aria-pressed'), 'true'); selections.push(part);
  }
  await page.locator('[data-labels]').uncheck(); await reset(); await action('lower bulb');
  const hit = await hitPart('Lower bulb'); await page.mouse.click(...hit); assert.equal(await popup.innerText(), 'Lower bulb');
  let box = await canvas.boundingBox(); await page.mouse.move(box.x + 10, box.y + 10); const beforeDrag = await canvas.screenshot();
  await page.mouse.move(...hit); await page.mouse.down(); await page.mouse.move(hit[0] + 35, hit[1] + 20, {steps: 10}); await page.mouse.up(); await page.mouse.move(box.x + 10, box.y + 10);
  assert.ok(!beforeDrag.equals(await canvas.screenshot()), 'Dragging physical part moves object');
  await page.locator('.daily-heading h1').click(); assert.equal(await popup.isVisible(), false); assert.equal(await page.locator('.daily-part-detail h3').count(), 0);
  await action('complete thermometer'); await page.locator('[data-labels]').check(); await page.locator('button[data-label-part="bulb"]').click();
  await page.locator('.daily-heading h1').click(); assert.equal(await page.locator('button[data-label-part="bulb"]').getAttribute('aria-pressed'), 'false'); await page.locator('[data-labels]').uncheck();
  await action('complete thermometer'); await canvas.scrollIntoViewIfNeeded(); box = await canvas.boundingBox(); await page.mouse.move(box.x + 20, box.y + 20);
  assert.equal(await popup.isVisible(), false); const beforeRotate = await canvas.screenshot();
  await page.mouse.down(); await page.mouse.move(box.x + 100, box.y + 55, {steps: 12}); await page.mouse.up(); assert.ok(!beforeRotate.equals(await canvas.screenshot()), 'Background drag rotates object');
  await action('complete thermometer'); const beforeZoom = await canvas.screenshot(); await page.locator('[data-view="in"]').click();
  assert.ok(!beforeZoom.equals(await canvas.screenshot())); assert.equal(await page.locator('[data-separation]').inputValue(), '0');
  await page.locator('[data-view="out"]').click(); assert.equal(await page.locator('[data-separation]').inputValue(), '0');
  await canvas.scrollIntoViewIfNeeded(); box = await canvas.boundingBox(); await page.mouse.move(box.x + 20, box.y + 20);
  const held = await page.locator('.daily-readings').innerText(); for (let i = 0; i < 8; i++) await page.mouse.wheel(0, 240);
  await page.waitForFunction(() => document.querySelector('[data-separation]').value === '100'); assert.equal(await page.locator('.daily-readings').innerText(), held); await capture('grouped-parts');
  await page.locator('[data-reassemble]').click(); await action('complete thermometer');
  for (const view of ['Front', 'Side', 'Back', 'Top', 'Underneath', 'Angled']) {await page.getByRole('button', {name: view, exact: true}).click(); await capture('view-' + view.toLowerCase());}
  for (const width of [390, 320]) {
    await page.setViewportSize({width, height: width === 390 ? 844 : 568});
    const tools = page.getByRole('navigation', {name: 'Lesson tools'});
    await tools.getByRole('button', {name: 'Try it yourself', exact: true}).click(); await page.locator('[data-experiment]').nth(9).click();
    await tools.getByRole('button', {name: 'Controls', exact: true}).click(); await laws(lesson.tryIt[9].values, 300); await hitPart('Lower bulb'); await capture('phone-bulb-' + width);
    await action('temperature response'); await capture('phone-chart-' + width);
    await action('complete thermometer'); await capture('phone-' + width); await page.screenshot({path: `${output}/phone-page-${width}.png`});
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
  }
  await page.setViewportSize({width: 390, height: 844}); await action('complete thermometer');
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
  await page.locator('.daily-return').click(); assert.ok(!page.url().endsWith('#machine/liquid-in-glass-thermometer')); assert.deepEqual(errors, []);
  const report = {passed: true, outcomes, controls, actions, selections, physicalHits, pause: true, step: true, completion: true, replay: true, phaseReplay: true, isolatedPartSwitch: true, hoverClick: true, deselection: true, objectDrag: true, backgroundRotation: true, zoomOnlyButtons: true, wheelSeparation: true, pinch: true, mobileWidths: [390, 320], quiz: true, return: true, errors};
  await writeFile(`${output}/browser.json`, JSON.stringify(report, null, 2)); console.log(JSON.stringify(report));
} catch (error) {
  await writeFile(`${output}/failure.json`, JSON.stringify({message: error.message, errors, url: page.url(), body: await page.locator('body').innerText().catch(() => '')}, null, 2));
  await page.screenshot({path: `${output}/failure.png`}).catch(() => {}); throw error;
} finally {await browser.close();}

import assert from 'node:assert/strict';
import {mkdir, writeFile} from 'node:fs/promises';
import {chromium} from 'playwright';
import {homeSupplyTransformerLesson as lesson} from './home-supply-transformer-lesson.js';

const base = process.env.SITE_URL || 'http://127.0.0.1:4173/';
const output = process.env.EVIDENCE_DIR || 'documentation/home-supply-transformer-browser';
await mkdir(output, {recursive: true});
const browser = await chromium.launch({channel: 'chrome', headless: true});
const page = await browser.newPage({viewport: {width: 1440, height: 1000}, hasTouch: true, reducedMotion: 'reduce'});
page.setDefaultTimeout(20000);
const errors = [], outcomes = [], controlCases = [];
page.on('pageerror', error => errors.push(error.message));
const reading = label => page.locator('.daily-readings > div').filter({has: page.getByText(label, {exact: true})}).locator('dd');
const value = async label => parseFloat(await reading(label).innerText());
const near = (actual, expected, tolerance = .00011) => assert.ok(Math.abs(actual - expected) <= tolerance, actual + ' differs from ' + expected);
const canvas = page.locator('canvas');
const capture = async name => {await canvas.scrollIntoViewIfNeeded(); await canvas.screenshot({path: output + '/' + name + '.png'});};
const reset = () => page.getByRole('button', {name: 'Reset experiment', exact: true}).click();
async function preset(index) {
  await page.getByRole('tab', {name: 'Try it yourself', exact: true}).click();
  await page.locator('[data-experiment]').nth(index).click();
  await page.getByRole('tab', {name: 'Controls', exact: true}).click();
}
async function edit(key, next) {
  if (key === 'voltage') {await page.locator('[data-number="voltage"]').fill(String(next)); await page.keyboard.press('Tab');}
  else await page.locator('[data-control="' + key + '"]').selectOption(String(next));
}
async function snapshot(v, elapsed = 0) {
  const ids = ['A', 'B', 'C'], count = ids.filter(id => v['branch' + id]).length;
  const outputVoltage = v.voltage / 3, singlePower = outputVoltage ** 2 / 12, mean = count * singlePower;
  const t = elapsed / 1000, phase = 100 * Math.PI * t, factor = t + Math.sin(2 * phase) / (200 * Math.PI);
  const secondaryCurrent = Math.SQRT2 * count * outputVoltage / 12 * Math.cos(phase);
  near(await value('Incoming RMS voltage'), v.voltage); near(await value('Available home RMS voltage'), outputVoltage);
  near(await value('Primary RMS current'), count * outputVoltage / 36); near(await value('Total secondary RMS current'), count * outputVoltage / 12);
  near(await value('Primary instantaneous current'), secondaryCurrent / 3);
  near(await value('Total secondary instantaneous current'), secondaryCurrent);
  near(await value('Instantaneous input power'), 2 * mean * Math.cos(phase) ** 2);
  near(await value('Instantaneous home power'), 2 * mean * Math.cos(phase) ** 2);
  near(await value('Mean input power'), mean); near(await value('Mean home power'), mean);
  near(await value('Delivered home energy'), mean * factor * 1000); near(await value('Source work'), mean * factor * 1000);
  for (const id of ids) {
    const on = v['branch' + id], voltage = on ? outputVoltage : 0;
    near(await value('Load ' + id + ' RMS voltage'), voltage);
    near(await value('Load ' + id + ' RMS current'), voltage / 12);
    near(await value('Load ' + id + ' mean power'), on ? singlePower : 0);
    near(await value('Load ' + id + ' energy'), on ? singlePower * factor * 1000 : 0);
  }
  near(await value('Core flux'), Math.SQRT2 * v.voltage * Math.sin(phase) / (100 * Math.PI * 12) * 1000);
  near(await value('Simulated time'), elapsed);
  assert.equal(await reading('Connected loads').innerText(), ids.filter(id => v['branch' + id]).join(', ') || 'None');
  assert.ok(!/NaN|undefined|Infinity/.test(await page.locator('.daily-readings').innerText()));
  return {voltage: v.voltage, count, homeVoltage: await value('Available home RMS voltage'), primaryCurrent: await value('Primary RMS current'), secondaryCurrent: await value('Total secondary RMS current'), meanPower: await value('Mean home power'), energy: await value('Delivered home energy'), branchEnergy: await Promise.all(ids.map(id => value('Load ' + id + ' energy')))};
}
try {
  await page.goto(new URL('#machine/home-supply-transformer', base).href);
  await page.getByRole('heading', {name: 'Home-supply transformer', exact: true}).waitFor();
  await page.locator('[data-number="voltage"]').waitFor();
  assert.equal(await page.locator('[data-control]').count(), 4);
  assert.equal(await page.locator('[data-number]').count(), 1);
  await snapshot(lesson.tryIt[0].values); await capture('opening');
  await page.screenshot({path: output + '/opening-page.png'});
  const fixed = await reading('Fixed turns').innerText();
  for (const [index, trial] of lesson.tryIt.entries()) {
    await preset(index);
    for (const [key, expected] of Object.entries(trial.values)) assert.equal(Number(await page.locator('[data-control="' + key + '"]').inputValue()), expected);
    await snapshot(trial.values);
    for (let step = 0; step < 16; step++) await page.locator('[data-step]').click();
    assert.equal(await page.locator('[data-play]').getAttribute('aria-pressed'), 'false');
    outcomes.push({title: trial.title, ...await snapshot(trial.values, 40)});
    assert.equal(await reading('Fixed turns').innerText(), fixed);
    assert.match(await reading('Your result').innerText(), !trial.values.voltage ? /Incoming supply zero/ : !trial.values.branchA && !trial.values.branchB && !trial.values.branchC ? /All loads off/ : /supplied at/);
    await capture('preset-' + index);
  }
  near(outcomes[1].homeVoltage, outcomes[0].homeVoltage); near(outcomes[1].meanPower, 3 * outcomes[0].meanPower);
  near(outcomes[1].energy, 3 * outcomes[0].energy); near(outcomes[8].meanPower, 4 * outcomes[1].meanPower);
  assert.deepEqual(outcomes[2].branchEnergy, [0, 120, 0]); assert.deepEqual(outcomes[6].branchEnergy, [0, 0, 120]); assert.deepEqual(outcomes[7].branchEnergy, [120, 0, 120]);
  await preset(0); await page.locator('[data-play]').click(); await page.waitForTimeout(650); await page.locator('[data-play]').click();
  assert.ok(await value('Simulated time') > 0 && await value('Simulated time') < 40);
  const paused = await page.locator('.daily-readings').innerText(); await page.waitForTimeout(300);
  assert.equal(await page.locator('.daily-readings').innerText(), paused);
  await preset(0); for (let i = 0; i < 14; i++) await page.locator('[data-step]').click();
  await page.locator('[data-play]').click(); await page.waitForFunction(() => document.querySelector('[data-play]').getAttribute('aria-pressed') === 'false', null, {timeout: 60000});
  await snapshot(lesson.tryIt[0].values, 40); await page.locator('[data-result]').click(); await capture('result');
  await page.locator('[data-play]').click(); await page.waitForTimeout(300); await page.locator('[data-play]').click();
  assert.ok(await value('Simulated time') < 40 && await value('Delivered home energy') < 120);
  for (const [key, options] of Object.entries({voltage: [0, 6, 12, 18, 24, 30, 36], branchA: [0, 1], branchB: [0, 1], branchC: [0, 1]})) {
    for (const next of options) {await reset(); await edit(key, next); await snapshot({...lesson.tryIt[0].values, [key]: next}); controlCases.push({key, value: next});}
  }
  for (const [key, next] of [['voltage', 36], ['branchA', 0], ['branchB', 1], ['branchC', 1]]) {
    await reset(); await page.locator('[data-step]').click(); near(await value('Simulated time'), 2.5);
    await edit(key, next); await snapshot({...lesson.tryIt[0].values, [key]: next});
  }
  for (let mask = 0; mask < 8; mask++) {
    await reset(); const v = {...lesson.tryIt[0].values};
    for (const [i, id] of ['A', 'B', 'C'].entries()) {v['branch' + id] = mask & (1 << i) ? 1 : 0; await edit('branch' + id, v['branch' + id]);}
    await snapshot(v); await capture('switch-mask-' + mask);
  }
  await reset();
  for (const name of ['Inspect the regional source circuit', 'Inspect the home load branches']) {
    const held = await page.locator('.daily-readings').innerText(); await page.getByRole('button', {name, exact: true}).click();
    assert.equal(await page.locator('.daily-readings').innerText(), held); await capture(name.includes('regional') ? 'regional-source' : 'home-branches');
  }
  for (const [name, angle] of [['Pause at positive flux peak', 90], ['Pause at reversed home current', 180]]) {
    await page.locator('[data-play]').click(); await page.getByRole('button', {name, exact: true}).click();
    assert.equal(await page.locator('[data-play]').getAttribute('aria-pressed'), 'false'); near(await value('Electrical phase'), angle);
    await snapshot(lesson.tryIt[0].values, angle / 18); await capture('phase-' + angle);
  }
  await page.getByRole('button', {name: 'Restart the selected home-supply run', exact: true}).click(); await snapshot(lesson.tryIt[0].values);
  await page.locator('[data-labels]').check(); await page.locator('button[data-label-part="primary-coil"]').click(); await page.locator('[data-labels]').uncheck();
  await page.locator('[data-isolate]').check(); await canvas.scrollIntoViewIfNeeded();
  let box = await canvas.boundingBox(), hit; const popup = page.locator('.daily-part-popup');
  for (let iy = 4; iy <= 16 && !hit; iy++) for (let ix = 4; ix <= 16; ix++) {
    await page.mouse.move(box.x + box.width * ix / 20, box.y + box.height * iy / 20);
    if (await popup.isVisible() && await popup.innerText() === 'Primary winding · 12 turns') {hit = [box.x + box.width * ix / 20, box.y + box.height * iy / 20]; break;}
  }
  assert.ok(hit); await page.mouse.click(...hit); assert.equal(await popup.innerText(), 'Primary winding · 12 turns');
  await page.mouse.move(box.x + 10, box.y + 10); const beforeMove = await canvas.screenshot();
  await page.mouse.move(...hit); await page.mouse.down(); await page.mouse.move(hit[0] + 40, hit[1] + 25, {steps: 10}); await page.mouse.up();
  await page.mouse.move(box.x + 10, box.y + 10); assert.ok(!beforeMove.equals(await canvas.screenshot()));
  await page.locator('.daily-heading h1').click(); assert.equal(await popup.isVisible(), false); assert.equal(await page.locator('.daily-part-detail h3').count(), 0);
  await page.locator('[data-isolate]').uncheck(); await page.locator('[data-labels]').check(); await page.locator('button[data-label-part="secondary-coil"]').click();
  await page.locator('.daily-heading h1').click(); assert.equal(await page.locator('button[data-label-part="secondary-coil"]').getAttribute('aria-pressed'), 'false');
  await page.locator('[data-labels]').uncheck(); await page.locator('[data-view="reset"]').click();
  const beforeZoom = await canvas.screenshot(); await page.locator('[data-view="in"]').click(); assert.ok(!beforeZoom.equals(await canvas.screenshot()));
  assert.equal(await page.locator('[data-separation]').inputValue(), '0'); await page.locator('[data-view="out"]').click(); assert.equal(await page.locator('[data-separation]').inputValue(), '0');
  await canvas.scrollIntoViewIfNeeded(); box = await canvas.boundingBox(); await page.mouse.move(box.x + 20, box.y + 20);
  const beforeRotate = await canvas.screenshot(); await page.mouse.down(); await page.mouse.move(box.x + 110, box.y + 55, {steps: 12}); await page.mouse.up(); assert.ok(!beforeRotate.equals(await canvas.screenshot()));
  await page.locator('[data-view="reset"]').click(); await canvas.scrollIntoViewIfNeeded(); box = await canvas.boundingBox(); await page.mouse.move(box.x + 20, box.y + 20);
  const held = await page.locator('.daily-readings').innerText(); for (let i = 0; i < 8; i++) await page.mouse.wheel(0, 240);
  await page.waitForFunction(() => document.querySelector('[data-separation]').value === '100'); assert.equal(await page.locator('.daily-readings').innerText(), held);
  for (const name of ['Magnetic core and supports', 'Regional source circuit', 'Home supply and parallel loads', 'Load A · 12 Ω', 'Load B · 12 Ω', 'Load C · 12 Ω']) assert.ok((await page.locator('.daily-inventory-labels').innerText()).includes(name));
  await page.waitForFunction(() => Number(document.querySelector('[data-explosion]').dataset.explosion) > .999); await capture('grouped-parts'); await page.locator('[data-reassemble]').click();
  for (const view of ['Front', 'Side', 'Back', 'Top', 'Underneath', 'Angled']) {await page.getByRole('button', {name: view, exact: true}).click(); await capture('view-' + view.toLowerCase());}
  for (const width of [390, 320]) {
    await page.setViewportSize({width, height: width === 390 ? 844 : 568});
    const tools = page.getByRole('navigation', {name: 'Lesson tools'}); await tools.getByRole('button', {name: 'Try it yourself', exact: true}).click(); await page.locator('[data-experiment]').nth(1).click(); await tools.getByRole('button', {name: 'Controls', exact: true}).click();
    await snapshot(lesson.tryIt[1].values); await page.locator('[data-step]').click(); near(await value('Electrical phase'), 45);
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
    await page.locator('[data-view="reset"]').click(); await capture('phone-' + width); await page.screenshot({path: output + '/phone-page-' + width + '.png'});
  }
  await page.setViewportSize({width: 390, height: 844});
  const session = await page.context().newCDPSession(page);
  async function pinch(from, to) {
    await canvas.scrollIntoViewIfNeeded(); const b = await canvas.boundingBox(), x = b.x + b.width / 2, y = b.y + b.height / 2;
    const points = d => [{x: x - d, y, id: 0}, {x: x + d, y, id: 1}];
    await session.send('Input.dispatchTouchEvent', {type: 'touchStart', touchPoints: points(from)});
    for (let i = 1; i <= 12; i++) await session.send('Input.dispatchTouchEvent', {type: 'touchMove', touchPoints: points(from + (to - from) * i / 12)});
    await session.send('Input.dispatchTouchEvent', {type: 'touchEnd', touchPoints: []});
  }
  try {await pinch(120, 20); assert.ok(Number(await page.locator('[data-separation]').inputValue()) > 0); await capture('phone-pinch'); await pinch(20, 120); await page.waitForFunction(() => document.querySelector('[data-separation]').value === '0');} finally {await session.detach();}
  await page.setViewportSize({width: 1440, height: 1000});
  for (const [index] of lesson.quiz.options.entries()) {await page.locator('[data-answer]').nth(index).click(); assert.equal(await page.locator('.daily-answer').innerText(), (index === lesson.quiz.answer ? 'That’s right. ' : 'Try thinking through the parts again. ') + lesson.quiz.explanation);}
  await page.locator('.daily-return').click(); assert.match(page.url(), /#place\/discovery/);
  assert.deepEqual(errors, []);
  const report = {passed: true, outcomes, controlCases, idealFinalStageBalance: true, independentBranches: true, switchPatterns: 8, pause: true, completion: true, replay: true, checkpoints: true, hoverClick: true, deselection: true, objectDrag: true, backgroundRotation: true, zoomOnlyButtons: true, wheelSeparation: true, pinch: true, mobileWidths: [390, 320], quiz: true, returnToPlace: true, errors};
  await writeFile(output + '/browser.json', JSON.stringify(report, null, 2) + '\n'); console.log(JSON.stringify(report));
} finally {await browser.close();}

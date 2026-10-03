import assert from 'node:assert/strict';
import {mkdir, writeFile} from 'node:fs/promises';
import {chromium} from 'playwright';
import {transformerTurnsRatioLesson as lesson} from './transformer-turns-ratio-lesson.js';

const base = process.env.SITE_URL || 'http://127.0.0.1:4173/';
const output = process.env.EVIDENCE_DIR || 'documentation/transformer-turns-ratio-browser';
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
  await page.locator('[data-number="' + key + '"]').fill(String(next)); await page.keyboard.press('Tab');
  assert.equal(Number(await page.locator('[data-control="' + key + '"]').inputValue()), next);
}
async function snapshot(v, elapsed = 0) {
  const ratio = v.secondaryTurns / v.primaryTurns, voltage = 6 * ratio, current = voltage / 12, mean = voltage ** 2 / 12;
  const phase = (v.startPhase + elapsed * 18) * Math.PI / 180;
  const vp = Math.SQRT2 * 6 * Math.cos(phase), vs = ratio * vp;
  near(await value('Primary turns'), v.primaryTurns); near(await value('Secondary turns'), v.secondaryTurns);
  near(await value('Primary RMS voltage'), 6); near(await value('Secondary RMS voltage'), voltage, .0051);
  near(await value('Secondary RMS current'), current); near(await value('Primary RMS current'), ratio * current);
  near(await value('Primary voltage'), vp, .00051); near(await value('Secondary voltage'), vs, .00051);
  near(await value('Secondary current'), vs / 12); near(await value('Primary current'), ratio * vs / 12);
  near(await value('Mean load power'), mean); near(await value('Load power'), vs ** 2 / 12); near(await value('Input power'), vs ** 2 / 12);
  near(await value('Volts per turn'), 6 / v.primaryTurns);
  near(await value('Core flux'), Math.SQRT2 * 6 * Math.sin(phase) / (100 * Math.PI * v.primaryTurns) * 1000);
  near(await value('Simulated time'), elapsed);
  near(await value('Delivered load energy'), await value('Input energy'));
  if (elapsed === 0) near(await value('Delivered load energy'), 0);
  if (elapsed === 40) near(await value('Delivered load energy'), mean * 40);
  assert.ok(!/NaN|undefined|Infinity/.test(await page.locator('.daily-readings').innerText()));
  return {voltage: await value('Secondary RMS voltage'), primaryCurrent: await value('Primary RMS current'), secondaryCurrent: await value('Secondary RMS current'), meanPower: await value('Mean load power'), energy: await value('Delivered load energy'), voltsPerTurn: await value('Volts per turn'), flux: await value('Core flux')};
}
try {
  await page.goto(new URL('#machine/transformer', base).href);
  await page.getByRole('heading', {name: 'Transformer', exact: true}).waitFor();
  await page.locator('a[href="#machine/transformer-turns-ratio"]').click();
  await page.getByRole('heading', {name: 'Transformer turns ratio', exact: true}).waitFor();
  await page.locator('[data-number="primaryTurns"]').waitFor();
  assert.equal(await page.locator('[data-number]').count(), 3);
  assert.equal(await page.locator('[data-control="connected"]').count(), 0);
  assert.equal(await page.locator('[data-control="voltage"]').count(), 0);
  await snapshot(lesson.tryIt[0].values); await capture('opening');
  await page.screenshot({path: output + '/opening-page.png'});
  const reference = await reading('Reference comparison').innerText(), fixed = await reading('Fixed source and load').innerText();
  for (const [index, trial] of lesson.tryIt.entries()) {
    await preset(index);
    for (const [key, expected] of Object.entries(trial.values)) assert.equal(Number(await page.locator('[data-number="' + key + '"]').inputValue()), expected);
    await snapshot(trial.values);
    for (let step = 0; step < 16; step++) await page.locator('[data-step]').click();
    assert.equal(await page.locator('[data-play]').getAttribute('aria-pressed'), 'false');
    outcomes.push({title: trial.title, ...await snapshot(trial.values, 40)});
    assert.equal(await reading('Reference comparison').innerText(), reference);
    assert.equal(await reading('Fixed source and load').innerText(), fixed);
    assert.match(await reading('Your result').innerText(), trial.values.secondaryTurns / trial.values.primaryTurns === 2 ? /Same ratio/ : /Different ratio/);
    await capture('preset-' + index);
  }
  for (const key of ['voltage', 'primaryCurrent', 'secondaryCurrent', 'meanPower', 'energy']) near(outcomes[0][key], outcomes[1][key]);
  near(outcomes[1].voltsPerTurn, outcomes[0].voltsPerTurn / 2);
  near(outcomes[2].energy, 4 * outcomes[0].energy); near(outcomes[3].energy, outcomes[0].energy / 4);
  near(outcomes[7].flux, outcomes[6].flux / 2); near(outcomes[7].energy, outcomes[6].energy);
  await preset(0); await page.locator('[data-play]').click(); await page.waitForTimeout(650); await page.locator('[data-play]').click();
  assert.ok(await value('Simulated time') > 0 && await value('Simulated time') < 40);
  const paused = await page.locator('.daily-readings').innerText(); await page.waitForTimeout(300);
  assert.equal(await page.locator('.daily-readings').innerText(), paused);
  await preset(0); for (let i = 0; i < 14; i++) await page.locator('[data-step]').click();
  await page.locator('[data-play]').click(); await page.waitForFunction(() => document.querySelector('[data-play]').getAttribute('aria-pressed') === 'false', null, {timeout: 60000});
  await snapshot(lesson.tryIt[0].values, 40);
  await page.locator('[data-result]').click(); await capture('result');
  await page.locator('[data-play]').click(); await page.waitForTimeout(300); await page.locator('[data-play]').click();
  assert.ok(await value('Simulated time') < 40 && await value('Delivered load energy') < 480);
  for (const [key, options] of Object.entries({primaryTurns: [4, 36], secondaryTurns: [4, 36], startPhase: [0, 90, 180, 270, 360]})) {
    for (const next of options) {await reset(); await edit(key, next); await snapshot({...lesson.tryIt[0].values, [key]: next}); controlCases.push({key, value: next});}
  }
  for (const [key, next] of [['primaryTurns', 24], ['secondaryTurns', 36], ['startPhase', 90]]) {
    await reset(); await page.locator('[data-step]').click(); near(await value('Simulated time'), 2.5);
    await edit(key, next); await snapshot({...lesson.tryIt[0].values, [key]: next});
  }
  await reset(); await edit('primaryTurns', 4); await edit('secondaryTurns', 36);
  for (let i = 0; i < 16; i++) await page.locator('[data-step]').click();
  await snapshot({primaryTurns: 4, secondaryTurns: 36, startPhase: 0}, 40); await capture('maximum-ratio');
  await reset();
  for (const name of ['Inspect the primary circuit', 'Inspect the secondary circuit']) {
    const held = await page.locator('.daily-readings').innerText();
    await page.getByRole('button', {name, exact: true}).click(); assert.equal(await page.locator('.daily-readings').innerText(), held); await capture(name.includes('primary') ? 'primary' : 'secondary');
  }
  for (const [name, angle] of [['Pause at positive flux peak', 90], ['Pause at reversed current', 180]]) {
    await page.locator('[data-play]').click(); await page.getByRole('button', {name, exact: true}).click();
    assert.equal(await page.locator('[data-play]').getAttribute('aria-pressed'), 'false'); near(await value('Electrical phase'), angle);
    if (angle === 90) {near(await value('Core flux'), 3.3762); near(await value('Primary voltage'), 0);}
    else {assert.ok(await value('Secondary current') < 0 && await value('Load power') > 0);}
    await capture('phase-' + angle);
  }
  await page.getByRole('button', {name: 'Restart the selected transformer run', exact: true}).click(); await snapshot(lesson.tryIt[0].values);
  await page.locator('[data-labels]').check(); await page.locator('button[data-label-part="primary-coil"]').click(); await page.locator('[data-labels]').uncheck();
  await page.locator('[data-isolate]').check(); await canvas.scrollIntoViewIfNeeded();
  let box = await canvas.boundingBox(), hit; const popup = page.locator('.daily-part-popup');
  for (let iy = 4; iy <= 16 && !hit; iy++) for (let ix = 4; ix <= 16; ix++) {
    await page.mouse.move(box.x + box.width * ix / 20, box.y + box.height * iy / 20);
    if (await popup.isVisible() && await popup.innerText() === 'Primary winding · top dot') {hit = [box.x + box.width * ix / 20, box.y + box.height * iy / 20]; break;}
  }
  assert.ok(hit); await page.mouse.click(...hit); assert.equal(await popup.innerText(), 'Primary winding · top dot');
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
  for (const name of ['Magnetic core and supports', 'Primary circuit · adjustable turns', 'Separate secondary circuit']) assert.ok((await page.locator('.daily-inventory-labels').innerText()).includes(name));
  await capture('grouped-parts'); await page.locator('[data-reassemble]').click();
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
  const report = {passed: true, outcomes, controlCases, equalRatioComparison: true, fixedSourceLoad: true, pause: true, completion: true, replay: true, checkpoints: true, hoverClick: true, deselection: true, objectDrag: true, backgroundRotation: true, zoomOnlyButtons: true, wheelSeparation: true, pinch: true, mobileWidths: [390, 320], quiz: true, returnToPlace: true, errors};
  await writeFile(output + '/browser.json', JSON.stringify(report, null, 2) + '\n'); console.log(JSON.stringify(report));
} finally {await browser.close();}

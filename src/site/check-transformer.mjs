import assert from 'node:assert/strict';
import {mkdir, writeFile} from 'node:fs/promises';
import {chromium} from 'playwright';
import {transformerLesson as lesson} from './transformer-lesson.js';

const base = process.env.SITE_URL || 'http://127.0.0.1:4173/';
const output = process.env.EVIDENCE_DIR || 'documentation/transformer-browser';
await mkdir(output, {recursive: true});
const browser = await chromium.launch({channel: 'chrome', headless: true});
const page = await browser.newPage({viewport: {width: 1440, height: 1000}, hasTouch: true, reducedMotion: 'reduce'});
page.setDefaultTimeout(20000);
const errors = [], outcomes = [], controls = [], checkpoints = [];
page.on('pageerror', error => errors.push(error.message));
const reading = label => page.locator('.daily-readings > div').filter({has: page.getByText(label, {exact: true})}).locator('dd');
const value = async label => parseFloat(await reading(label).innerText());
const near = (actual, expected, tolerance = .00011) => assert.ok(Math.abs(actual - expected) <= tolerance, `${actual} differs from ${expected}`);
const capture = async name => {
  await page.locator('canvas').scrollIntoViewIfNeeded();
  await page.locator('canvas').screenshot({path: output + '/' + name + '.png'});
};
const reset = () => page.getByRole('button', {name: 'Reset experiment', exact: true}).click();
async function preset(index) {
  await page.getByRole('tab', {name: 'Try it yourself', exact: true}).click();
  await page.locator('[data-experiment]').nth(index).click();
  await page.getByRole('tab', {name: 'Controls', exact: true}).click();
}
async function snapshot(expected, elapsed = 40) {
  const ratio = expected.secondaryTurns / 12;
  const angle = (expected.startPhase + elapsed * 18) * Math.PI / 180;
  const vp = Math.SQRT2 * expected.voltage * Math.cos(angle), vs = ratio * vp;
  const secondaryRms = ratio * expected.voltage;
  const secondaryRmsCurrent = expected.connected * secondaryRms / expected.resistance;
  const current = expected.connected * vs / expected.resistance;
  const mean = expected.connected * secondaryRms ** 2 / expected.resistance;
  near(await value('Primary RMS voltage'), expected.voltage);
  near(await value('Secondary RMS voltage'), secondaryRms, .0051);
  near(await value('Primary RMS current'), ratio * secondaryRmsCurrent);
  near(await value('Secondary RMS current'), secondaryRmsCurrent);
  near(await value('Primary voltage'), vp, .00051);
  near(await value('Secondary voltage'), vs, .00051);
  near(await value('Primary current'), ratio * current);
  near(await value('Secondary current'), current);
  near(await value('Core flux'), Math.SQRT2 * expected.voltage * Math.sin(angle) / (100 * Math.PI * 12) * 1000);
  near(await value('Mean load power'), mean);
  near(await value('Load power'), vs * current);
  near(await value('Input power'), vs * current);
  near(await value('Simulated time'), elapsed, .00051);
  near(await value('Delivered load energy'), await value('Input energy'));
  if (elapsed === 40) near(await value('Delivered load energy'), mean * 40);
  if (elapsed === 0) near(await value('Delivered load energy'), 0);
  return {voltage: await value('Secondary RMS voltage'), primaryCurrent: await value('Primary RMS current'), secondaryCurrent: await value('Secondary RMS current'), meanPower: await value('Mean load power'), energy: await value('Delivered load energy')};
}

try {
  await page.goto(new URL('#machine/transformer', base).href);
  await page.getByRole('heading', {name: 'Transformer', exact: true}).waitFor();
  await page.locator('[data-number="voltage"]').waitFor();
  assert.equal(await page.locator('[data-number]').count(), 4);
  await snapshot(lesson.tryIt[0].values, 0);
  await capture('assembled');
  await page.screenshot({path: output + '/desktop-page.png'});

  for (const [index, trial] of lesson.tryIt.entries()) {
    await preset(index);
    for (const [key, expected] of Object.entries(trial.values)) {
      const selector = key === 'connected' ? '[data-control="connected"]' : '[data-number="' + key + '"]';
      assert.equal(Number(await page.locator(selector).inputValue()), expected);
    }
    await snapshot(trial.values, 0);
    assert.equal(await page.locator('[data-isolate]').isChecked(), false);
    for (let step = 0; step < 16; step++) await page.locator('[data-step]').click();
    assert.equal(await page.locator('[data-play]').getAttribute('aria-pressed'), 'false');
    const result = await snapshot(trial.values);
    assert.ok(!/NaN|undefined|Infinity/.test(await page.locator('.daily-readings').innerText()));
    outcomes.push({title: trial.title, ...result});
    await capture('preset-' + index);
    if (index === 3) assert.match(await reading('Your result').innerText(), /Secondary open/);
    if (index === 4) assert.match(await reading('Your result').innerText(), /Source off/);
  }
  near(outcomes[1].energy, 9 * outcomes[0].energy);
  near(outcomes[2].energy, outcomes[0].energy / 9);
  near(outcomes[3].energy, 0); near(outcomes[4].energy, 0);

  await preset(0);
  await page.locator('[data-play]').click();
  await page.waitForTimeout(700);
  await page.locator('[data-play]').click();
  assert.ok(await value('Simulated time') > 0 && await value('Simulated time') < 40);
  const paused = await page.locator('.daily-readings').innerText();
  await page.waitForTimeout(350);
  assert.equal(await page.locator('.daily-readings').innerText(), paused, 'pause freezes phase and energy');
  await preset(0);
  for (let step = 0; step < 14; step++) await page.locator('[data-step]').click();
  await page.locator('[data-play]').click();
  await page.waitForFunction(() => document.querySelector('[data-play]').getAttribute('aria-pressed') === 'false', null, {timeout: 60000});
  await snapshot(lesson.tryIt[0].values);
  await page.locator('[data-play]').click();
  await page.waitForTimeout(300);
  assert.equal(await page.locator('[data-play]').getAttribute('aria-pressed'), 'true');
  await page.locator('[data-play]').click();
  assert.ok(await value('Delivered load energy') < 120, 'completed run starts a fresh measurement');

  for (const [key, values] of Object.entries({voltage: [0, 12], secondaryTurns: [4, 36], resistance: [4, 40], startPhase: [0, 90, 180, 270, 360]})) {
    for (const next of values) {
      await reset(); await page.locator('[data-step]').click();
      await page.locator('[data-number="' + key + '"]').fill(String(next)); await page.keyboard.press('Tab');
      assert.equal(Number(await page.locator('[data-control="' + key + '"]').inputValue()), next);
      const values = {...lesson.tryIt[0].values, [key]: next};
      if (next !== lesson.tryIt[0].values[key]) await snapshot(values, 0);
      controls.push({key, value: next, result: await reading('Your result').innerText()});
    }
  }
  await reset();
  for (const connected of [0, 1]) {
    await page.locator('[data-control="connected"]').selectOption(String(connected));
    await snapshot({...lesson.tryIt[0].values, connected}, 0);
    controls.push({key: 'connected', value: connected, result: await reading('Your result').innerText()});
  }

  for (const label of ['Inspect the primary circuit', 'Inspect the secondary circuit']) {
    const held = await page.locator('.daily-readings').innerText();
    await page.getByRole('button', {name: label, exact: true}).click();
    assert.equal(await page.locator('.daily-readings').innerText(), held);
    await capture(label.includes('primary') ? 'primary-circuit' : 'secondary-circuit');
  }
  for (const [label, angle] of [['Pause at positive flux peak', 90], ['Pause at reversed current', 180]]) {
    await page.locator('[data-play]').click();
    await page.getByRole('button', {name: label, exact: true}).click();
    assert.equal(await page.locator('[data-play]').getAttribute('aria-pressed'), 'false');
    near(await value('Electrical phase'), angle);
    if (angle === 90) {near(await value('Primary voltage'), 0); near(await value('Core flux'), 2.2508);}
    else {assert.ok(await value('Secondary current') < 0); assert.ok(await value('Load power') > 0);}
    checkpoints.push({label, angle, flux: await value('Core flux'), current: await value('Secondary current')});
    await capture('checkpoint-' + angle);
  }
  await page.getByRole('button', {name: 'Restart the selected transformer run', exact: true}).click();
  await snapshot(lesson.tryIt[0].values, 0);
  await reset();

  const canvas = page.locator('canvas'), popup = page.locator('.daily-part-popup');
  await page.locator('[data-labels]').check();
  await page.locator('button[data-label-part="primary-coil"]').click();
  await page.locator('[data-labels]').uncheck();
  await page.locator('[data-isolate]').check();
  await canvas.scrollIntoViewIfNeeded();
  let box = await canvas.boundingBox(), hit;
  for (let iy = 4; iy <= 16 && !hit; iy++) for (let ix = 4; ix <= 16; ix++) {
    await page.mouse.move(box.x + box.width * ix / 20, box.y + box.height * iy / 20);
    if (await popup.isVisible() && await popup.innerText() === 'Primary winding · top dot') {hit = [box.x + box.width * ix / 20, box.y + box.height * iy / 20]; break;}
  }
  assert.ok(hit, 'hover over physical winding reveals its name');
  await page.mouse.click(...hit); assert.equal(await popup.innerText(), 'Primary winding · top dot');
  await page.mouse.move(box.x + 10, box.y + 10);
  const beforeMove = await canvas.screenshot();
  await page.mouse.move(...hit); await page.mouse.down();
  await page.mouse.move(hit[0] + 40, hit[1] + 25, {steps: 10}); await page.mouse.up();
  await page.mouse.move(box.x + 10, box.y + 10);
  assert.ok(!beforeMove.equals(await canvas.screenshot()), 'object drag changes its position');
  await page.locator('.daily-heading h1').click();
  assert.equal(await popup.isVisible(), false);
  assert.equal(await page.locator('.daily-part-detail h3').count(), 0);
  await page.locator('[data-isolate]').uncheck();
  await page.locator('[data-labels]').check();
  await page.locator('button[data-label-part="primary-coil"]').click();
  assert.equal(await page.locator('button[data-label-part="primary-coil"]').getAttribute('aria-pressed'), 'true');
  await page.locator('.daily-heading h1').click();
  assert.equal(await page.locator('button[data-label-part="primary-coil"]').getAttribute('aria-pressed'), 'false');
  await page.locator('[data-labels]').uncheck();
  await page.locator('[data-view="reset"]').click();
  const beforeZoom = await canvas.screenshot();
  await page.locator('[data-view="in"]').click();
  assert.ok(!beforeZoom.equals(await canvas.screenshot()));
  assert.equal(await page.locator('[data-separation]').inputValue(), '0');
  await page.locator('[data-view="out"]').click();
  assert.equal(await page.locator('[data-separation]').inputValue(), '0');
  await canvas.scrollIntoViewIfNeeded(); box = await canvas.boundingBox();
  await page.mouse.move(box.x + 20, box.y + 20);
  const beforeRotate = await canvas.screenshot();
  await page.mouse.down(); await page.mouse.move(box.x + 110, box.y + 55, {steps: 12}); await page.mouse.up();
  assert.ok(!beforeRotate.equals(await canvas.screenshot()), 'background drag rotates model');
  await page.locator('[data-view="reset"]').click();
  await canvas.scrollIntoViewIfNeeded(); box = await canvas.boundingBox();
  await page.mouse.move(box.x + 20, box.y + 20);
  const held = await page.locator('.daily-readings').innerText();
  for (let i = 0; i < 8; i++) await page.mouse.wheel(0, 240);
  await page.waitForFunction(() => document.querySelector('[data-separation]').value === '100');
  assert.equal(await page.locator('.daily-readings').innerText(), held);
  for (const name of ['Magnetic core and supports', 'Primary circuit · 12 turns', 'Separate secondary circuit']) assert.ok((await page.locator('.daily-inventory-labels').innerText()).includes(name));
  await capture('grouped-parts');
  await page.locator('[data-reassemble]').click();
  await page.waitForFunction(() => document.querySelector('[data-separation]').value === '0');
  for (const view of ['Front', 'Side', 'Back', 'Top', 'Underneath', 'Angled']) {
    await page.getByRole('button', {name: view, exact: true}).click(); await capture('view-' + view.toLowerCase());
  }

  for (const viewport of [{width: 390, height: 844}, {width: 320, height: 568}]) {
    await page.setViewportSize(viewport); await page.locator('[data-view="reset"]').click();
    const tools = page.getByRole('navigation', {name: 'Lesson tools'});
    await tools.getByRole('button', {name: 'Try it yourself', exact: true}).click();
    await page.locator('[data-experiment]').nth(1).click();
    await tools.getByRole('button', {name: 'Controls', exact: true}).click();
    near(await value('Secondary RMS voltage'), 18);
    await page.locator('[data-step]').click(); near(await value('Electrical phase'), 45);
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
    await page.locator('[data-view="reset"]').click(); await capture('phone-' + viewport.width);
    await page.screenshot({path: output + '/phone-page-' + viewport.width + '.png'});
    await page.getByRole('button', {name: 'Inspect the secondary circuit', exact: true}).click(); await capture('phone-secondary-' + viewport.width);
  }
  await page.setViewportSize({width: 390, height: 844}); await page.locator('[data-view="reset"]').click();
  const session = await page.context().newCDPSession(page);
  async function pinch(from, to) {
    await canvas.scrollIntoViewIfNeeded(); const b = await canvas.boundingBox(), x = b.x + b.width / 2, y = b.y + b.height / 2;
    const points = d => [{x: x - d, y, id: 0}, {x: x + d, y, id: 1}];
    await session.send('Input.dispatchTouchEvent', {type: 'touchStart', touchPoints: points(from)});
    for (let i = 1; i <= 12; i++) await session.send('Input.dispatchTouchEvent', {type: 'touchMove', touchPoints: points(from + (to - from) * i / 12)});
    await session.send('Input.dispatchTouchEvent', {type: 'touchEnd', touchPoints: []});
  }
  try {
    await pinch(120, 20); assert.ok(Number(await page.locator('[data-separation]').inputValue()) > 0); await capture('phone-pinch');
    await pinch(20, 120); await page.waitForFunction(() => document.querySelector('[data-separation]').value === '0');
  } finally {await session.detach();}
  await page.setViewportSize({width: 1440, height: 1000});
  for (const [index] of lesson.quiz.options.entries()) {
    await page.locator('[data-answer]').nth(index).click();
    assert.equal(await page.locator('.daily-answer').innerText(), (index === lesson.quiz.answer ? 'That’s right. ' : 'Try thinking through the parts again. ') + lesson.quiz.explanation);
  }
  const backLabel = await page.locator('.daily-return').innerText();
  await page.locator('.daily-return').click();
  assert.match(page.url(), /#(?:place|room)\//);
  const parentRoute = new URL(page.url()).hash;
  await page.screenshot({path: output + '/parent-place.png'});
  await page.getByRole('button', {name: 'Transformer', exact: true}).click();
  await page.getByRole('heading', {name: 'Transformer', exact: true}).waitFor();
  await snapshot(lesson.tryIt[0].values, 0);
  assert.deepEqual(errors, []);
  const report = {passed: true, outcomes, controls, checkpoints, pause: true, completion: true, replay: true, immediateOpenVoltage: true, popup: true, deselection: true, objectDrag: true, outsideDrag: true, zoomOnlyButtons: true, wheelSeparation: true, pinch: true, mobileWidths: [390, 320], quiz: true, parentRoute, backLabel, errors};
  await writeFile(output + '/browser.json', JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify(report));
} finally {await browser.close();}

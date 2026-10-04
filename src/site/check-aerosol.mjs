import assert from 'node:assert/strict';
import {mkdir, writeFile} from 'node:fs/promises';
import {chromium} from 'playwright';
import {aerosolLesson as lesson} from './aerosol-lesson.js';
import {AEROSOL_DEFAULTS as D, sampleAerosol} from './aerosol-physics.js';
import {AS} from './aerosol-equilibrium.js';
import {fixed} from './format.js';

const base = process.env.SITE_URL || 'http://127.0.0.1:4173/', output = process.env.EVIDENCE_DIR || 'documentation/aerosol-browser';
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
async function laws(values, time) {
  const s = sampleAerosol(values, time), grams = n => fixed(n * 1000, 2), totalOut = s.massOut.reduce((a, b) => a + b, 0);
  const outcome = !s.down ? (time >= 180 ? 'Trial complete' : 'Valve closed') : s.volumeRate > 0 ? 'Liquid leaves the nozzle' : s.gasRate > 0 ? 'Gas leaves; product stays inside' : 'No pressure-driven discharge';
  near(await value('Pressure above room'), Math.max(0, s.gauge) / 1e5, .0051);
  near(await value('Can temperature'), s.T - 273.15, .0051);
  assert.equal(await reading('Your result').innerText(), `${outcome} · ${grams(s.sprayedProduct)} g product delivered`);
  assert.equal(await reading('Mass account').innerText(), `${grams(s.liquidMass + s.vaporMass)} + ${grams(totalOut)} = ${grams(s.plan.initial.liquidMass + s.plan.initial.vaporMass)} g`);
  assert.equal(await reading('Liquid and gas space').innerText(), `${fixed(s.V * 1e6, 1)} / ${fixed(s.gasVolume * 1e6, 1)} mL`);
  assert.equal(await reading('Discharge rate').innerText(), `${fixed(s.massRate * 1000, 3)} g/s liquid · ${fixed(s.gasRate * 1000, 3)} g/s gas`);
  assert.equal(await reading('Species discharged').innerText(), AS.map((species, i) => `${species.name}: ${grams(s.massOut[i])} g`).join(' · '));
  assert.equal(await reading('Propane fraction').innerText(), s.liquefied ? `${fixed(100 * s.liquidPropaneFraction, 1)}% liquid · ${fixed(100 * s.vaporPropaneFraction, 1)}% vapor` : 'No propane in the nitrogen charge');
  const readings = await page.locator('.daily-readings').innerText();
  assert.ok(readings.includes(`${fixed(time, 1)} of 180 seconds.`));
  assert.ok(!/NaN|undefined|Infinity/.test(readings));
  assert.equal(await page.locator('[data-play]').isDisabled(), false);
  return {time, result: await reading('Your result').innerText(), readings};
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
  await page.goto(new URL('#machine/aerosol-spray-can', base).href);
  await page.getByRole('heading', {name: 'Aerosol spray can', exact: true, level: 1}).waitFor(); await canvas.waitFor();
  assert.equal(await page.locator('[data-control]').count(), 4);
  assert.ok((await canvas.getAttribute('aria-label')).startsWith('Interactive 3D Aerosol spray can.'));
  assert.ok(await page.locator('[data-control="propellant"]').isVisible(), 'Propellant selector visible immediately');
  await laws(D, 0); await capture('opening'); await page.screenshot({path: `${output}/opening-page.png`});
  await page.locator('[data-step]').click(); await laws(D, 5); await capture('first-step'); await reset();
  for (const [i, p] of lesson.tryIt.entries()) {
    await preset(i);
    assert.equal(await page.locator('[data-isolate]').isChecked(), p.isolate);
    for (const [key, next] of Object.entries(p.values)) near(Number(await page.locator(`[data-control="${key}"]`).inputValue()), next, 1e-10);
    outcomes.push({title: p.title, ...await laws(p.values, p.initialState.time)}); await capture(`preset-${i}`);
  }
  await preset(6); await page.locator('[data-play]').click(); await page.waitForTimeout(500); await page.locator('[data-play]').click();
  assert.ok(Number((await page.locator('.daily-readings').innerText()).match(/([\d.]+) of 180 seconds/)[1]) < 15, 'Completed experiment replays from beginning');
  const paused = await page.locator('.daily-readings').innerText(); await page.waitForTimeout(250); assert.equal(await page.locator('.daily-readings').innerText(), paused);
  await reset(); for (let i = 0; i < 35; i++) await page.locator('[data-step]').click();
  await page.locator('[data-play]').click(); await page.waitForFunction(() => document.querySelector('[data-play]').getAttribute('aria-pressed') === 'false');
  await laws(D, 180); await capture('completed-experiment');
  for (const [key, options] of Object.entries({propellant: [0, 1], temperature: [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50], orientation: [0, 1], button: [0, 1, 2, 3]})) for (const next of options) {
    await reset(); await edit(key, next); const values = {...D, [key]: next}; await page.locator('[data-step]').click();
    controls.push({key, next, ...await laws(values, 5)});
  }
  for (let i = 0; i < await page.locator('[data-action]').count(); i++) {
    await reset(); await page.locator('[data-action]').nth(i).click();
    actions.push({name: await page.locator('[data-action]').nth(i).innerText(), part: await page.locator('.daily-part-detail h3').innerText(), ...await laws(D, 0)}); await capture(`action-${i}`);
  }
  await preset(4); await page.locator('[data-labels]').check();
  const parts = await page.locator('button[data-label-part]:visible:not(:disabled)').evaluateAll(elements => elements.map(element => ({id: element.dataset.labelPart, name: element.innerText})));
  for (const part of parts) {
    await action('Inspect: complete can');
    const button = page.locator(`button[data-label-part="${part.id}"]`);
    if (!(await button.isVisible()) || await button.isDisabled()) continue;
    await button.click(); assert.equal(await page.locator('.daily-part-detail h3').innerText(), part.name);
    assert.equal(await button.getAttribute('aria-pressed'), 'true'); selections.push(part);
  }
  for (const [id, name] of [['pressure-chart', 'Compare pressure during the trial'], ['temperature-chart', 'Compare fresh-charge temperatures'], ['seal-contact', 'Inspect: valve seal']]) {
    await action(name);const button = page.locator(`button[data-label-part="${id}"]`);await button.click();selections.push({id, name: await button.innerText()});
  }
  for (const id of ['system', 'container', 'valve', 'actuator', 'can', 'dip-tube', 'mounting-cup', 'housing', 'gasket', 'seal-contact', 'stem', 'spring', 'cap', 'channel', 'nozzle', 'liquid', 'gas', 'flow', 'spray', 'pressure-chart', 'temperature-chart']) assert.ok(selections.some(p => p.id === id), `Part menu missed ${id}`);
  await page.locator('[data-labels]').uncheck();
  for (const [name, label] of [['Inspect: sealing gasket', 'Stem-port sealing gasket'], ['Inspect: nozzle bore', 'Tapered nozzle insert']]) {
    await action(name);const point = await hitPart(label);await page.mouse.click(...point);assert.equal(await popup.innerText(), label);physicalHits.push(label);await capture('popup-' + label.replaceAll(' ', '-'));
  }
  await reset();await action('Inspect: stem ports');
  const hit = await hitPart('Hollow stem and radial ports'); physicalHits.push('Hollow stem and radial ports'); await page.mouse.click(...hit); assert.equal(await popup.innerText(), 'Hollow stem and radial ports');
  let box = await canvas.boundingBox(); await page.mouse.move(box.x + 10, box.y + 10); const beforeDrag = await canvas.screenshot();
  await page.mouse.move(...hit); await page.mouse.down(); await page.mouse.move(hit[0] + 35, hit[1] + 20, {steps: 10}); await page.mouse.up(); await page.mouse.move(box.x + 10, box.y + 10);
  assert.ok(!beforeDrag.equals(await canvas.screenshot()), 'Dragging physical part moves object');
  await page.locator('.daily-heading h1').click(); assert.equal(await popup.isVisible(), false); assert.equal(await page.locator('.daily-part-detail h3').count(), 0);
  await action('Inspect: complete can'); await page.locator('[data-labels]').check(); await page.locator('button[data-label-part="stem"]').click();
  await page.locator('.daily-heading h1').click(); assert.equal(await page.locator('button[data-label-part="stem"]').getAttribute('aria-pressed'), 'false'); await page.locator('[data-labels]').uncheck();
  await action('Inspect: complete can'); await canvas.scrollIntoViewIfNeeded(); box = await canvas.boundingBox(); await page.mouse.move(box.x + 20, box.y + 20);
  assert.equal(await popup.isVisible(), false); const beforeRotate = await canvas.screenshot();
  await page.mouse.down(); await page.mouse.move(box.x + 100, box.y + 55, {steps: 12}); await page.mouse.up(); assert.ok(!beforeRotate.equals(await canvas.screenshot()), 'Background drag rotates object');
  await action('Inspect: complete can'); const beforeZoom = await canvas.screenshot(); await page.locator('[data-view="in"]').click();
  assert.ok(!beforeZoom.equals(await canvas.screenshot())); assert.equal(await page.locator('[data-separation]').inputValue(), '0');
  await page.locator('[data-view="out"]').click(); assert.equal(await page.locator('[data-separation]').inputValue(), '0');
  await canvas.scrollIntoViewIfNeeded(); box = await canvas.boundingBox(); await page.mouse.move(box.x + 20, box.y + 20);
  const held = await page.locator('.daily-readings').innerText(); for (let i = 0; i < 8; i++) await page.mouse.wheel(0, 240);
  await page.waitForFunction(() => document.querySelector('[data-separation]').value === '100'); assert.equal(await page.locator('.daily-readings').innerText(), held); await capture('grouped-parts');
  await page.locator('[data-reassemble]').click(); await action('Inspect: complete can');
  for (const view of ['Front', 'Side', 'Back', 'Top', 'Underneath', 'Angled']) {await page.getByRole('button', {name: view, exact: true}).click(); await capture('view-' + view.toLowerCase());}
  for (const width of [390, 320]) {
    await page.setViewportSize({width, height: width === 390 ? 844 : 568});
    const tools = page.getByRole('navigation', {name: 'Lesson tools'});
    for (const index of [13, 1, 9, 10, 11]) {
      await tools.getByRole('button', {name: 'Try it yourself', exact: true}).click();await page.locator('[data-experiment]').nth(index).click();
      await tools.getByRole('button', {name: 'Controls', exact: true}).click();await laws(lesson.tryIt[index].values, lesson.tryIt[index].initialState.time);await capture(`phone-preset-${index}-${width}`);
    }
    await action('Inspect: stem ports');await hitPart('Hollow stem and radial ports');await capture('phone-stem-' + width);
    await action('Compare pressure during the trial');await capture('phone-pressure-chart-' + width);
    await action('Inspect: complete can');await capture('phone-' + width);await page.screenshot({path: `${output}/phone-page-${width}.png`});
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
  }
  await page.setViewportSize({width: 390, height: 844}); await action('Inspect: complete can');
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
  await page.locator('.daily-return').click(); assert.ok(!page.url().endsWith('#machine/aerosol-spray-can')); assert.deepEqual(errors, []);
  const report = {passed: true, outcomes, controls, actions, selections, physicalHits, pause: true, step: true, completion: true, replay: true, isolatedPartSwitch: true, hoverClick: true, deselection: true, objectDrag: true, backgroundRotation: true, zoomOnlyButtons: true, wheelSeparation: true, pinch: true, mobileWidths: [390, 320], quiz: true, return: true, errors};
  await writeFile(`${output}/browser.json`, JSON.stringify(report, null, 2)); console.log(JSON.stringify(report));
} catch (error) {
  await writeFile(`${output}/failure.json`, JSON.stringify({message: error.message, errors, url: page.url(), body: await page.locator('body').innerText().catch(() => '')}, null, 2));
  await page.screenshot({path: `${output}/failure.png`}).catch(() => {}); throw error;
} finally {await browser.close();}

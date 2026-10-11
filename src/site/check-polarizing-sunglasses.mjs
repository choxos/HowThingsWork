import assert from 'node:assert/strict';
import {mkdir, writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {chromium} from 'playwright';
import {polarizingSunglassesLesson as lesson} from './polarizers-lessons.js';
import {createPolarizingSunglassesModel} from './polarizing-sunglasses-model.js';

const expected = createPolarizingSunglassesModel(), browser = await chromium.launch({headless: true});
const page = await browser.newPage({viewport: {width: 1440, height: 1000}, hasTouch: true, reducedMotion: 'reduce'});
const evidence = pathToFileURL(resolve(process.env.EVIDENCE_DIR || 'documentation/audit/evidence/polarizing-sunglasses') + '/');
await mkdir(evidence, {recursive: true}); page.setDefaultTimeout(40000);
const errors = [], consoleErrors = [], frames = [], outcomes = [], controls = [], interaction = {};
page.on('pageerror', error => errors.push(error.message));
page.on('console', message => { if (message.type() === 'error') consoleErrors.push(message.text()); });
await page.addInitScript(() => {
  window.polarizingSunglassesMatrices = {};
  for (const name of ['WebGLRenderingContext', 'WebGL2RenderingContext']) {
    const proto = window[name]?.prototype; if (!proto) continue;
    const names = new WeakMap(), get = proto.getUniformLocation, write = proto.uniformMatrix4fv;
    proto.getUniformLocation = function(program, name) { const location = get.call(this, program, name); if (location) names.set(location, name); return location; };
    proto.uniformMatrix4fv = function(location, transpose, data, ...rest) { if (names.get(location) === 'modelViewMatrix') window.polarizingSunglassesMatrices.modelView = Array.from(data); return write.call(this, location, transpose, data, ...rest); };
  }
});
const canvas = page.locator('canvas:visible'), control = key => page.locator(`[data-control="${key}"]`), number = key => page.locator(`[data-number="${key}"]`);
const action = name => page.getByRole('button', {name, exact: true}).click();
const readings = () => page.locator('.daily-readings > div').evaluateAll(rows => Object.fromEntries(rows.map(row => [row.querySelector('dt').textContent, row.querySelector('dd').textContent])));
const nextFrames = () => page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
async function compare() { const actual = await readings(); assert.deepEqual(actual, Object.fromEntries(expected.getState().readings.map(row => [row.label, row.value]))); return actual; }
async function shot(name, full = false) { await canvas.scrollIntoViewIfNeeded(); await page.mouse.move(4, 4); await nextFrames(); await canvas.screenshot({path: new URL(name + '.png', evidence).pathname}); if (full) await page.screenshot({path: new URL(name + '-fullpage.png', evidence).pathname, fullPage: true}); frames.push(name); }
async function reset() { await action('Reset experiment'); expected.reset(); return compare(); }
async function set(key, value) { if (expected.controls.find(control => control.key === key).options) await control(key).selectOption(String(value)); else { await number(key).fill(String(value)); await number(key).press('Tab'); } expected.update({[key]: value}); return compare(); }
async function steps(count) { await page.locator('[data-step]').evaluate((button, n) => { for (let i = 0; i < n; i++) button.click(); }, count); for (let i = 0; i < count; i++) expected.playback.step(); return compare(); }
async function inspect(index) { await action(expected.actions[index].label); expected.actions[index].run(); return compare(); }
async function tab(name, mobile = false) { await (mobile ? page.getByRole('navigation', {name: 'Lesson tools'}).getByRole('button', {name, exact: true}) : page.getByRole('tab', {name, exact: true})).click(); }
async function preset(index, mobile = false) {
  await tab('Try it yourself', mobile); await page.locator(`[data-experiment="${index}"]`).click(); await tab('Controls', mobile);
  expected.reset(); expected.update(lesson.tryIt[index].values); await compare();
  for (const spec of expected.controls) assert.equal(Number(await control(spec.key).inputValue()), lesson.tryIt[index].values[spec.key]);
  assert.equal(await page.locator('[data-isolate]').isChecked(), false);
  assert.equal(await page.locator('.daily-part-detail h3').innerText(), 'Reflected glare');
}
const play = () => page.locator('[data-play]').click();
async function finishPlayback() { await page.waitForFunction(() => document.querySelector('[data-play]')?.getAttribute('aria-pressed') === 'false' && [...document.querySelectorAll('.daily-readings > div')].some(row => row.querySelector('dt').textContent === 'Trace time' && row.querySelector('dd').textContent === '8.00 s'), null, {timeout: 90000}); expected.advance(8); return compare(); }
async function hit(name) { await canvas.scrollIntoViewIfNeeded(); const box = await canvas.boundingBox(), popup = page.locator('.daily-part-popup'); for (let i = 0; i < 130; i++) { const point = [box.x + box.width * (.1 + (i % 13) * .065), box.y + box.height * (.12 + Math.floor(i / 13) * .075)]; await page.mouse.move(...point); if (await popup.isVisible() && await popup.innerText() === name) return point; } assert.fail('No physical target surface for ' + name); }
try {
  await page.goto(`${process.env.SITE_URL || 'http://127.0.0.1:5215/'}#machine/polarizing-sunglasses`);
  await page.getByRole('heading', {name: 'Polarizing sunglasses', exact: true, level: 1}).waitFor({timeout: 120000}); await canvas.waitFor({timeout: 120000});
  assert(await canvas.evaluate(element => !!element.getContext('webgl2')));
  assert.equal(await page.locator('[data-control]').count(), 7); assert.equal(await control('mode').count(), 0);
  await compare(); await shot('initial', true);
  for (let i = 0; i < 4; i++) { await inspect(i); await shot('construction-' + i); }
  await reset(); await steps(1); assert.equal((await readings())['Trace time'], '0.08 s');
  await play(); await page.waitForFunction(() => [...document.querySelectorAll('.daily-readings > div')].some(row => row.querySelector('dt').textContent === 'Trace time' && parseFloat(row.querySelector('dd').textContent) > .5)); await play();
  const heldReadings = await readings(); await page.mouse.move(4, 4); const held = await canvas.screenshot(); await nextFrames(); assert(held.equals(await canvas.screenshot()), 'Paused fields stay fixed.'); assert.deepEqual(await readings(), heldReadings);
  for (let i = 0; i < lesson.tryIt.length; i++) {
    await preset(i); await shot('preset-' + i + '-ready'); await play(); await finishPlayback();
    assert.equal(await page.locator('.daily-part-detail h3').innerText(), 'Reflected glare', 'Autoplay keeps the connected path in view.');
    outcomes.push({title: lesson.tryIt[i].title, readings: await compare()}); await shot('preset-' + i + '-result', [0, 1, 3, 4, 5, 6, 7, 8, 9, 10].includes(i)); console.log('PASS autoplay: ' + lesson.tryIt[i].title);
  }
  assert.deepEqual(outcomes.map(row => row.readings['Detected power']), ['0.00 % of full source', '3.86 % of full source', '0.00 % of full source', '0.01 % of full source', '1.00 % of full source', '11.93 % of full source', '3.86 % of full source', '1.93 % of full source', '0.00 % of full source', '1.93 % of full source', '0.01 % of full source']);
  await page.locator('[data-result]').click(); await shot('power-comparison'); await play(); await finishPlayback(); assert.equal((await readings())['Detected power'], outcomes[10].readings['Detected power']);
  for (const spec of expected.controls) {
    await reset(); if (spec.key === 'incidence') await set('brewster', 0); await inspect(3);
    const choices = spec.options?.map(option => option.value) ?? Array.from({length: (spec.max - spec.min) / spec.step + 1}, (_, i) => spec.min + i * spec.step);
    for (const value of choices) { await set(spec.key, value); controls.push({key: spec.key, value, readings: await compare()}); if (value === choices[0] || value === choices.at(-1) || value === 45 || value === 90) await shot(`control-${spec.key}-${value}`); }
    console.log(`PASS control ${spec.key}: ${choices.length} values`);
  }
  assert.equal(controls.length, 49);
  await reset(); await set('brewster', 0); await set('incidence', 0); await inspect(3);
  const normalPower = (await readings())['Detected power']; await set('analyzer', 90);
  assert.equal((await readings())['Detected power'], normalPower); await shot('normal-incidence-sideways');
  await set('power', 0); assert.match((await readings()).Outcome, /source is off/); await shot('source-off');
  await reset(); await number('analyzer').focus(); await page.keyboard.press('ArrowUp'); expected.update({analyzer: 15}); await compare();
  await set('analyzer', 999); assert.equal(await number('analyzer').inputValue(), '180'); await reset(); await inspect(3);
  for (const view of ['Front', 'Side', 'Back', 'Top', 'Underneath', 'Angled']) { await action(view); await shot('view-' + view.toLowerCase()); }
  await page.locator('[data-view="reset"]').click(); await page.locator('[data-separation]').fill('100'); await shot('separated'); await page.locator('[data-reassemble]').click(); await compare();
  await page.locator('[data-view="reset"]').click(); let point = await hit('Reflecting dielectric surface'); await page.mouse.click(...point); assert.equal(await page.locator('.daily-part-popup').innerText(), 'Reflecting dielectric surface'); point = await hit('Reflecting dielectric surface'); interaction.point = point;
  await page.mouse.move(4, 4); await canvas.screenshot(); const before = await page.evaluate(() => window.polarizingSunglassesMatrices.modelView); assert.equal(before.length, 16);
  await page.mouse.move(...point); await page.mouse.down(); await page.mouse.move(point[0] + 30, point[1] + 18, {steps: 8}); await page.mouse.up(); await page.mouse.move(4, 4); await canvas.screenshot(); const after = await page.evaluate(() => window.polarizingSunglassesMatrices.modelView); Object.assign(interaction, {before, after});
  for (const i of [0, 1, 2, 4, 5, 6, 8, 9, 10]) assert(Math.abs(before[i] - after[i]) < 1e-7, 'Object drag preserves rotation.'); assert(Math.hypot(...[12, 13, 14].map(i => after[i] - before[i])) > .01, 'Object drag translates.'); await shot('object-drag');
  await action('Whole machine'); await canvas.scrollIntoViewIfNeeded(); let box = await canvas.boundingBox(); await page.mouse.move(box.x + 15, box.y + 15); assert.equal(await page.locator('.daily-part-popup').isVisible(), false); const rotationBefore = await canvas.screenshot(); await page.mouse.down(); await page.mouse.move(box.x + 90, box.y + 55, {steps: 8}); await page.mouse.up(); assert(!rotationBefore.equals(await canvas.screenshot())); await shot('background-rotation');
  await page.locator('[data-view="reset"]').click(); const zoomBefore = await canvas.screenshot(); await page.locator('[data-view="in"]').click(); assert(!zoomBefore.equals(await canvas.screenshot())); assert.equal(await page.locator('[data-separation]').inputValue(), '0'); await page.locator('[data-view="out"]').click();
  await canvas.focus(); const keyboardBefore = await canvas.screenshot(); await page.keyboard.press('ArrowRight'); assert(!keyboardBefore.equals(await canvas.screenshot())); const rotated = await page.evaluate(() => window.polarizingSunglassesMatrices.modelView); await page.keyboard.press('Shift+ArrowUp'); await canvas.screenshot(); const moved = await page.evaluate(() => window.polarizingSunglassesMatrices.modelView); for (const i of [0, 1, 2, 4, 5, 6, 8, 9, 10]) assert(Math.abs(rotated[i] - moved[i]) < 1e-7); assert(Math.hypot(...[12, 13, 14].map(i => moved[i] - rotated[i])) > .01); await page.keyboard.press('Home'); assert.equal(await page.locator('.daily-part-detail h3').count(), 0); await compare();
  await canvas.scrollIntoViewIfNeeded(); box = await canvas.boundingBox(); await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2); for (let i = 0; i < 8 && Number(await page.locator('[data-separation]').inputValue()) === 0; i++) { await page.mouse.wheel(0, 120); await page.waitForTimeout(50); } assert(Number(await page.locator('[data-separation]').inputValue()) > 0); await shot('wheel-separated'); await page.locator('[data-reassemble]').click();
  await page.locator('[data-labels]').check(); await page.locator('button[data-label-part="surface"]').click(); assert.equal(await page.locator('.daily-part-detail h3').innerText(), 'Reflecting dielectric surface'); await shot('labels-surface'); await page.keyboard.press('Escape'); assert.equal(await page.locator('.daily-part-detail h3').count(), 0); await page.locator('button[data-label-part="surface"]').click(); await page.locator('.daily-heading h1').click(); assert.equal(await page.locator('.daily-part-detail h3').count(), 0); await page.locator('[data-labels]').uncheck();
  for (const width of [390, 320]) {
    await page.setViewportSize({width, height: width === 390 ? 844 : 568}); await page.reload(); await canvas.waitFor({timeout: 120000}); expected.reset(); await compare(); await shot('mobile-initial-' + width);
    for (let i = 0; i < lesson.tryIt.length; i++) { await preset(i, true); await shot(`mobile-${width}-${i}-ready`); if (i === 0 || i === 3) { await play(); await finishPlayback(); } else await steps(100); await shot(`mobile-${width}-${i}-result`); }
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)); await shot('mobile-' + width, true);
    await tab('Controls', true); await page.screenshot({path: new URL(`mobile-controls-${width}.png`, evidence).pathname});
  }
  const touch = await page.context().newCDPSession(page);
  async function pinch(from, to) { await canvas.scrollIntoViewIfNeeded(); const box = await canvas.boundingBox(), x = box.x + box.width / 2, y = box.y + box.height / 2, points = d => [{x: x - d, y, id: 0}, {x: x + d, y, id: 1}]; await touch.send('Input.dispatchTouchEvent', {type: 'touchStart', touchPoints: points(from)}); for (let i = 1; i <= 12; i++) await touch.send('Input.dispatchTouchEvent', {type: 'touchMove', touchPoints: points(from + (to - from) * i / 12)}); await touch.send('Input.dispatchTouchEvent', {type: 'touchEnd', touchPoints: []}); }
  try { await pinch(100, 15); assert(Number(await page.locator('[data-separation]').inputValue()) > 0); await shot('pinch-separated'); await pinch(15, 100); await page.waitForFunction(() => document.querySelector('[data-separation]').value === '0'); } finally { await touch.detach(); }
  await page.setViewportSize({width: 1440, height: 1000}); await preset(0);
  for (const [index] of lesson.quiz.options.entries()) { await page.locator('[data-answer]').nth(index).click(); assert.equal(await page.locator('.daily-answer').innerText(), (index === lesson.quiz.answer ? 'That’s right. ' : 'Try thinking through the parts again. ') + lesson.quiz.explanation); }
  await page.getByText('Learn more', {exact: true}).click(); for (const source of lesson.sources) assert.equal(await page.locator(`.daily-lesson a[href="${source.url}"]`).innerText(), source.title);
  await compare(); assert.deepEqual(errors, []); assert.deepEqual(consoleErrors, []);
  await writeFile(new URL('browser.json', evidence), JSON.stringify({passed: true, outcomes, controls, frames, errors, consoleErrors, interaction, pause: true, replay: true, keyboard: true, labels: true, wheel: true, pinch: true, mobileWidths: [390, 320]}, null, 2) + '\n');
  console.log(JSON.stringify({passed: true, presets: outcomes.length, controlValues: controls.length, frames: frames.length}));
} catch (error) {
  await writeFile(new URL('failure.json', evidence), JSON.stringify({message: error.message, errors, consoleErrors, outcomes, controls, frames, interaction, url: page.url()}, null, 2) + '\n'); await page.screenshot({path: new URL('failure.png', evidence).pathname, fullPage: true}).catch(() => {}); throw error;
} finally { expected.dispose(); await browser.close(); }

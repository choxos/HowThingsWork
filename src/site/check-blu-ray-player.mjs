import assert from 'node:assert/strict';
import {mkdir, writeFile} from 'node:fs/promises';
import {chromium} from 'playwright';
import {bluRayPlayerLesson as lesson} from './blu-ray-player-lesson.js';
import {createBluRayPlayerModel} from './blu-ray-player-model.js';
import {PLAYER_DEFAULTS as D, PLAYER_DOMAINS} from './blu-ray-player-physics.js';
const expectedModel = createBluRayPlayerModel();
const base = process.env.SITE_URL || 'http://127.0.0.1:4173/', output = process.env.EVIDENCE_DIR || 'documentation/blu-ray-player-browser';
await mkdir(output, {recursive: true});
const browser = await chromium.launch({channel: 'chrome', headless: true});
const page = await browser.newPage({viewport: {width: 1440, height: 1000}, hasTouch: true, reducedMotion: 'reduce'});
page.setDefaultTimeout(25000);
const errors = [], outcomes = [], controls = [], actions = [], selections = [], physicalHits = [], framing = [];
page.on('pageerror', error => errors.push(error.message));
const canvas = page.locator('canvas'), popup = page.locator('.daily-part-popup');
const reading = label => page.locator('.daily-readings > div').filter({has: page.getByText(label, {exact: true})}).locator('dd');
const tab = name => page.getByRole('tab', {name, exact: true}).click();
const capture = async name => {await canvas.scrollIntoViewIfNeeded(); await page.waitForTimeout(400); await canvas.screenshot({path: `${output}/${name}.png`});};
async function checkFraming(name) {
  // Hide sticky overlays and remove the rounded mask only for this capture.
  // Otherwise page text behind transparent corners can look like clipped geometry.
  const screenshot = await canvas.screenshot({style: '.daily-operation-tabs, .daily-mobile-tools { visibility: hidden !important; } .daily-canvas-wrap { border-radius: 0 !important; }'});
  const bounds = await page.evaluate(async encoded => {
    const bitmap = await createImageBitmap(new Blob([Uint8Array.from(atob(encoded), c => c.charCodeAt(0))], {type: 'image/png'}));
    const surface = document.createElement('canvas'); surface.width = bitmap.width; surface.height = bitmap.height;
    const ctx = surface.getContext('2d'); ctx.drawImage(bitmap, 0, 0); bitmap.close();
    const {width, height} = surface, data = ctx.getImageData(0, 0, width, height).data;
    const origin = (5 * width + 5) * 4, background = [data[origin], data[origin + 1], data[origin + 2]];
    let left = width, top = height, right = -1, bottom = -1;
    for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
      if ((x < 8 || x >= width - 8) && (y < 8 || y >= height - 8)) continue;
      const i = (y * width + x) * 4;
      if (background.reduce((sum, value, channel) => sum + Math.abs(data[i + channel] - value), 0) <= 30) continue;
      left = Math.min(left, x); right = Math.max(right, x); top = Math.min(top, y); bottom = Math.max(bottom, y);
    }
    return {width, height, left, top, right, bottom};
  }, screenshot.toString('base64'));
  assert.ok(bounds.right >= bounds.left && bounds.bottom >= bounds.top, `${name}: model is drawn`);
  assert.ok(bounds.left >= 5 && bounds.top >= 5 && bounds.right < bounds.width - 5 && bounds.bottom < bounds.height - 5, `${name}: clear canvas margins ${JSON.stringify(bounds)}`);
  framing.push({name, ...bounds});
}
const reset = () => page.getByRole('button', {name: 'Reset experiment', exact: true}).click();
const action = name => page.getByRole('button', {name, exact: true}).click();
async function preset(index) {await tab('Try it yourself'); await page.locator('[data-experiment]').nth(index).click(); await tab('Controls');}
async function edit(key, value) {
  const input = page.locator('[data-control="'+key+'"]');
  if (await input.evaluate(e => e.tagName === 'SELECT')) await input.selectOption(String(value));
  else {await page.locator('[data-number="'+key+'"]').fill(String(value)); await page.locator('[data-number="'+key+'"]').press('Tab');}
}
async function laws(given, time) {
  expectedModel.reset({settings: {...D, ...given}, time});
  const expected = Object.fromEntries(expectedModel.getState().readings.map(r => [r.label, r.value]));
  const readings = Object.fromEntries(await page.locator('.daily-readings > div').evaluateAll(rows => rows.map(row => [row.querySelector('dt').textContent, row.querySelector('dd').textContent])));
  assert.deepEqual(readings, expected);
  assert(!/NaN|undefined|Infinity/.test(JSON.stringify(readings)));
  return {time: expectedModel.getState().clock, readings};
}
async function focusPart(id) {
  await action('Inspect: complete player'); await page.locator('[data-labels]').check();
  await page.locator(`button[data-label-part="${id}"]`).click(); await page.locator('[data-isolate]').check(); await page.locator('[data-labels]').uncheck();
  await page.getByRole('button', {name: 'Front', exact: true}).click();
}
async function hitPart(name) {
  await canvas.scrollIntoViewIfNeeded(); const box = await canvas.boundingBox();
  for (let x = 1; x < 160; x++) {
    const point=[box.x+box.width*x/160,box.y+box.height/2];await page.mouse.move(...point);
    if(await popup.isVisible()&&await popup.innerText()===name)return point;
  }
  for (let y = 1; y <= 19; y++) for (let x = 1; x <= 19; x++) {
    const point = [box.x + box.width * x / 20, box.y + box.height * y / 20]; await page.mouse.move(...point);
    if (await popup.isVisible() && await popup.innerText() === name) return point;
  }
  assert.fail(`No physical pointer target for ${name}`);
}
try {
  await page.goto(new URL('#machine/blu-ray-player', base).href);
  await page.getByRole('heading', {name: 'Blu-ray player', exact: true, level: 1}).waitFor(); await canvas.waitFor();
  assert.equal(await page.locator('[data-control]').count(), 4);
  assert.equal(await page.locator('.daily-primary-controls [data-control="format"]').count(), 1);
  await laws(D, 0); await capture('opening'); await checkFraming('opening'); await page.screenshot({path: `${output}/opening-page.png`});
  assert(await page.locator('[data-cutaway]').isChecked());
  const cutawayImage = await canvas.screenshot();
  await page.locator('[data-cutaway]').uncheck(); await laws(D, 0); await capture('exterior'); await checkFraming('exterior');
  assert(!cutawayImage.equals(await canvas.screenshot()), 'Look inside changes the physical covers without resetting the lesson');
  await page.locator('[data-cutaway]').check(); await laws(D, 0);
  await page.locator('[data-step]').click(); await laws(D, 1/12); await reset();
  for (const [i, experiment] of lesson.tryIt.entries()) {
    await preset(i);
    for (const [key, value] of Object.entries(experiment.values)) assert.equal(Number(await page.locator(`[data-control="${key}"]`).inputValue()), value);
    outcomes.push({title: experiment.title, ...await laws(experiment.values, experiment.initialState.time)});
    await capture(`preset-${i}`); await checkFraming(`desktop-preset-${i}`);
  }
  await preset(0); await page.locator('[data-play]').click(); await page.waitForTimeout(600); await page.locator('[data-play]').click();
  assert(!(await reading('Your result').innerText()).startsWith('42 channel cells'), 'play advances without immediately completing');
  const paused = await page.locator('.daily-readings').innerText(); await page.waitForTimeout(250); assert.equal(await page.locator('.daily-readings').innerText(), paused);
  await reset(); await edit('radius',58); await edit('speed',4); await page.locator('[data-play]').click();
  await page.waitForFunction(() => document.querySelector('[data-play]').getAttribute('aria-pressed') === 'false', null, {timeout:30000});
  await laws({...D,radius:58,speed:4},1.75); await capture('completed');
  await page.locator('[data-play]').click(); await page.waitForTimeout(200); await page.locator('[data-play]').click();
  assert.equal(await page.locator('[data-control="radius"]').inputValue(),'58');
  assert.equal(await page.locator('[data-control="speed"]').inputValue(),'4');
  assert(!(await reading('Your result').innerText()).startsWith('42 channel cells'),'completed sample replays');
  for (const [key, [min, max, step]] of Object.entries(PLAYER_DOMAINS)) for (let value = min; value <= max; value = Number((value + step).toFixed(6))) {
    const settings = {...D, [key]: value};
    await reset(); await edit(key, value); await laws(settings, 0);
    await page.locator('[data-step]').evaluate(button => {for (let i = 0; i < 6; i++) button.click();});
    controls.push({key, value, ...await laws(settings, .5)});
  }
  for (let i = 0; i < await page.locator('[data-action]').count(); i++) {
    await preset(10); await page.locator('[data-action]').nth(i).click();
    actions.push({name: await page.locator('[data-action]').nth(i).innerText(), ...await laws(lesson.tryIt[10].values, lesson.tryIt[10].initialState.time)});
    await capture(`action-${i}`); await checkFraming(`action-${i}`);
  }
  await reset(); await page.locator('[data-step]').evaluate(button => {for (let i = 0; i < 5; i++) button.click();}); await action('Inspect: complete player'); await page.locator('[data-labels]').check();
  const parts = await page.locator('button[data-label-part]').evaluateAll(elements => elements.map(e => ({id: e.dataset.labelPart, name: e.innerText})));
  for (const part of parts) {
    await action('Inspect: complete player');
    const diagram = {optics:'Inspect: light path',track:'Inspect: channel clock',layers:'Inspect: disc layers',phase:'Inspect: two-wave interference',spin:'Inspect: spindle speed'}[part.id];
    if (diagram) await action(diagram);
    const button = page.locator(`button[data-label-part="${part.id}"]`); await button.click();
    assert.equal(await page.locator('.daily-part-detail h3').innerText(), part.name);
    assert.equal(await button.getAttribute('aria-pressed'), 'true'); selections.push(part);
  }
  assert(selections.length >= 6); await page.locator('[data-labels]').uncheck();
  for (const [id, name] of [['chassis','Chassis and case'],['spindle','Spindle motor and hub'],['pickup','Sliding optical pickup']]) {
    await reset(); await focusPart(id); const hit = await hitPart(name); await page.mouse.click(...hit); assert.equal(await popup.innerText(), name); physicalHits.push(name); await capture(`popup-${id}`);
    if (id === 'chassis') {
      const b = await canvas.boundingBox(); await page.mouse.move(b.x + 10, b.y + 10); const before = await canvas.screenshot();
      await page.mouse.move(...hit); await page.mouse.down(); await page.mouse.move(hit[0] + 35, hit[1] + 20, {steps: 10}); await page.mouse.up(); await page.mouse.move(b.x + 10, b.y + 10);
      assert(!before.equals(await canvas.screenshot()), 'dragging physical part translates object');
    }
    await page.locator('.daily-heading h1').click(); assert.equal(await popup.isVisible(), false); assert.equal(await page.locator('.daily-part-detail h3').count(), 0);
  }
  await reset(); await action('Inspect: complete player'); await page.locator('[data-labels]').check(); await page.locator('button[data-label-part="chassis"]').click(); await page.locator('.daily-heading h1').click();
  assert.equal(await page.locator('button[data-label-part="chassis"]').getAttribute('aria-pressed'), 'false'); await page.locator('[data-labels]').uncheck();
  await action('Inspect: complete player'); await canvas.scrollIntoViewIfNeeded(); let box = await canvas.boundingBox();
  await page.mouse.move(box.x + 15, box.y + 15); assert.equal(await popup.isVisible(), false); const beforeRotate = await canvas.screenshot();
  await page.mouse.down(); await page.mouse.move(box.x + 95, box.y + 55, {steps: 12}); await page.mouse.up(); assert(!beforeRotate.equals(await canvas.screenshot()), 'background drag rotates');
  await action('Inspect: complete player'); const beforeZoom = await canvas.screenshot(); await page.locator('[data-view="in"]').click(); assert(!beforeZoom.equals(await canvas.screenshot())); assert.equal(await page.locator('[data-separation]').inputValue(), '0');
  await page.locator('[data-view="out"]').click(); assert.equal(await page.locator('[data-separation]').inputValue(), '0');
  await canvas.scrollIntoViewIfNeeded(); box = await canvas.boundingBox(); await page.mouse.move(box.x + 15, box.y + 15); await canvas.scrollIntoViewIfNeeded(); box = await canvas.boundingBox(); await page.mouse.move(box.x + 15, box.y + 15);
  const held = await page.locator('.daily-readings').innerText(); for (let i = 0; i < 8; i++) await page.mouse.wheel(0, 240);
  await page.waitForFunction(() => document.querySelector('[data-separation]').value === '100'); assert.equal(await page.locator('.daily-readings').innerText(), held); await capture('grouped-parts'); await checkFraming('grouped-parts');
  for (const name of ['Chassis and case','Spindle motor and hub','Disc and retaining clamp','Rails and carriage drive','Sliding optical pickup','Decoder board and connections']) assert((await page.locator('.daily-inventory-labels').innerText()).includes(name));
  await hitPart('Chassis and case'); await capture('separated-chassis');
  await page.locator('[data-reassemble]').click(); await action('Inspect: complete player');
  for (const view of ['Front', 'Side', 'Back', 'Top', 'Underneath', 'Angled']) {await page.getByRole('button', {name: view, exact: true}).click(); await capture(`view-${view.toLowerCase()}`); await checkFraming(`view-${view}`);}
  for (const width of [390, 320]) {
    await page.setViewportSize({width, height: width === 390 ? 844 : 568}); const tools = page.getByRole('navigation', {name: 'Lesson tools'});
    for (const [index, experiment] of lesson.tryIt.entries()) {
      await tools.getByRole('button', {name: 'Try it yourself', exact: true}).click(); await page.locator('[data-experiment]').nth(index).click(); await tools.getByRole('button', {name: 'Controls', exact: true}).click();
      await laws(experiment.values, experiment.initialState.time); await capture(`phone-preset-${index}-${width}`); await checkFraming(`phone-preset-${index}-${width}`);
    }
    await action('Inspect: complete player'); await page.locator('[data-separation]').fill('100'); await capture(`phone-separated-${width}`); await checkFraming(`phone-separated-${width}`); await page.locator('[data-reassemble]').click();
    await focusPart('chassis'); await hitPart('Chassis and case'); await capture(`phone-chassis-${width}`);
    await action('Inspect: complete player'); await capture(`phone-${width}`); await page.screenshot({path: `${output}/phone-page-${width}.png`}); assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
  }
  await page.setViewportSize({width: 390, height: 844}); await action('Inspect: complete player');
  const session = await page.context().newCDPSession(page);
  async function pinch(from, to) {
    await canvas.scrollIntoViewIfNeeded(); const b = await canvas.boundingBox(), x = b.x + b.width / 2, y = b.y + b.height / 2, points = d => [{x: x - d, y, id: 0}, {x: x + d, y, id: 1}];
    await session.send('Input.dispatchTouchEvent', {type: 'touchStart', touchPoints: points(from)});
    for (let i = 1; i <= 12; i++) await session.send('Input.dispatchTouchEvent', {type: 'touchMove', touchPoints: points(from + (to - from) * i / 12)});
    await session.send('Input.dispatchTouchEvent', {type: 'touchEnd', touchPoints: []});
  }
  try {await pinch(120, 20); assert(Number(await page.locator('[data-separation]').inputValue()) > 0); await capture('phone-pinch'); await pinch(20, 120); await page.waitForFunction(() => document.querySelector('[data-separation]').value === '0');} finally {await session.detach();}
  await page.setViewportSize({width: 1440, height: 1000});
  for (const [i] of lesson.quiz.options.entries()) {await page.locator('[data-answer]').nth(i).click(); assert.equal(await page.locator('.daily-answer').innerText(), (i === lesson.quiz.answer ? 'That’s right. ' : 'Try thinking through the parts again. ') + lesson.quiz.explanation);}
  await page.locator('.daily-return').click(); assert(!page.url().endsWith('#machine/blu-ray-player')); assert.deepEqual(errors, []);
  const report = {passed: true, outcomes, controls, actions, selections, physicalHits, framing, exterior: true, pause: true, step: true, completion: true, replay: true, hoverClick: true, deselection: true, objectDrag: true, backgroundRotation: true, zoomOnlyButtons: true, wheelSeparation: true, pinch: true, mobileWidths: [390, 320], quiz: true, return: true, errors};
  await writeFile(`${output}/browser.json`, JSON.stringify(report, null, 2)); console.log(JSON.stringify({passed: true, presets: outcomes.length, controlValues: controls.length, actions: actions.length, parts: selections.length, physicalHits: physicalHits.length, framingChecks: framing.length, errors}));
} catch (error) {
  await writeFile(`${output}/failure.json`, JSON.stringify({message: error.message, errors, url: page.url(), body: await page.locator('body').innerText().catch(() => '')}, null, 2));
  await page.screenshot({path: `${output}/failure.png`}).catch(() => {}); throw error;
} finally {expectedModel.dispose(); await browser.close();}

import assert from 'node:assert/strict';
import {mkdir, writeFile} from 'node:fs/promises';
import {chromium} from 'playwright';
import {vrHeadsetLesson as lesson} from './vr-headset-lessons.js';
import {VR_DEFAULTS as D, VR_DOMAINS, sampleVr, MOTION_OPTIONS} from './vr-headset-physics.js';
import {fixed} from './format.js';
const base = process.env.SITE_URL || 'http://127.0.0.1:4173/', output = process.env.EVIDENCE_DIR || 'documentation/vr-headset-browser';
await mkdir(output, {recursive: true});
const browser = await chromium.launch({channel: 'chrome', headless: true});
const page = await browser.newPage({viewport: {width: 1440, height: 1000}, hasTouch: true, reducedMotion: 'reduce'});
page.setDefaultTimeout(25000);
const errors = [], outcomes = [], controls = [], actions = [], selections = [], physicalHits = [], framing = [];
page.on('pageerror', error => errors.push(error.message));
const canvas = page.locator('canvas'), popup = page.locator('.daily-part-popup');
const reading = label => page.locator('.daily-readings > div').filter({has: page.getByText(label, {exact: true})}).locator('dd');
const tab = name => page.getByRole('tab', {name, exact: true}).click();
const capture = async name => {await canvas.scrollIntoViewIfNeeded(); await canvas.screenshot({path: `${output}/${name}.png`});};
async function checkFraming(name) {
  // Sticky mobile toolbars can overlap the canvas capture edge. Hide those
  // DOM overlays for the pixel-bound check without changing their layout.
  const screenshot = await canvas.screenshot({style: '.daily-operation-tabs, .daily-mobile-tools { visibility: hidden !important; }'});
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
  const values = {...D, ...given}, s = sampleVr(values, time), n = s.now;
  const yaw = v => Math.abs(v) < .005 ? 'straight ahead' : `${fixed(Math.abs(v), 2)}° to the ${v > 0 ? 'left' : 'right'}`;
  const read = Object.fromEntries(await page.locator('.daily-readings > div').evaluateAll(rows => rows.map(row => [row.querySelector('dt').textContent, row.querySelector('dd').textContent])));
  const off = (n.showing?.shown || 0) - n.head.angle;
  const result = time <= 0 ? `Ready · ${MOTION_OPTIONS[values.motion].label}; press Play` : time >= 3 ? `Largest flash-onset error ${fixed(Math.abs(s.worstSlip.slip), 2)}° · the estimate ends ${fixed(Math.abs(s.endDrift), 2)}° off` : `${fixed(time, 2)} s · head ${yaw(n.head.angle)} · last frame ${fixed(Math.abs(off), 2)}° from current head`;
  assert.equal(read['Your result'], result);
  assert.equal(read.Head, `${yaw(n.head.angle)} · ${fixed(Math.abs(n.head.rate), 1) === '0.0' ? 'still' : `turning at ${fixed(Math.abs(n.head.rate), 1)}°/s`}`);
  assert.equal(read.Gyroscope, `Reads ${n.gyro < 0 ? '−' : ''}${fixed(Math.abs(n.gyro), 2)}°/s`);
  assert.equal(read.Estimate, `${yaw(n.estimate)} · ${fixed(Math.abs(n.drift), 2) === '0.00' ? 'with the head' : `${fixed(Math.abs(n.drift), 2)}° ${n.drift > 0 ? 'ahead of' : 'behind'} the head`}`);
  assert.equal(read.Display, n.showing ? `Frame ${fixed(n.showing.n, 0)} drawn for ${yaw(n.showing.shown)} · ${n.flashing ? 'lit' : 'dark between flashes'}` : 'Dark until the first frame lights');
  assert.equal(read.Lenses, `Screen ${fixed(values.screen, 1)} mm from a 45 mm lens · image ${Number.isFinite(s.image.fromEye) ? `${fixed(s.image.fromEye, 2)} m away` : 'infinitely far'}`);
  assert.equal(read.Eyes, `Aim ${fixed(s.eyes.aim, 2)} D · focus ${fixed(s.image.focus, 2)} D · conflict ${fixed(s.eyes.conflict, 2)} D`);
  assert.equal(read['Sound cues'], Math.abs(s.audio.delay) < .0000005 ? 'Both ears together' : `${s.audio.delay > 0 ? 'Left' : 'Right'} ear leads by ${fixed(Math.abs(s.audio.delay) * 1000, 3)} ms`);
  assert.equal(Object.keys(read).length, 8); assert(!/NaN|undefined|Infinity/.test(JSON.stringify(read)));
  return {time, readings: read};
}
async function focusPart(id) {
  await action('Inspect: complete experiment'); await page.locator('[data-labels]').check();
  await page.locator(`button[data-label-part="${id}"]`).click(); await page.locator('[data-isolate]').check(); await page.locator('[data-labels]').uncheck();
}
async function hitPart(name) {
  await canvas.scrollIntoViewIfNeeded(); const box = await canvas.boundingBox();
  for (let y = 1; y <= 19; y++) for (let x = 1; x <= 19; x++) {
    const point = [box.x + box.width * x / 20, box.y + box.height * y / 20]; await page.mouse.move(...point);
    if (await popup.isVisible() && await popup.innerText() === name) return point;
  }
  assert.fail(`No physical pointer target for ${name}`);
}
try {
  await page.goto(new URL('#machine/virtual-reality-headset', base).href);
  await page.getByRole('heading', {name: 'Virtual reality headset', exact: true, level: 1}).waitFor(); await canvas.waitFor();
  assert.equal(await page.locator('[data-control]').count(), 10);
  assert.equal(await page.locator('.daily-primary-controls [data-control="motion"]').count(), 1);
  await laws(D, 0); await capture('opening'); await checkFraming('opening'); await page.screenshot({path: `${output}/opening-page.png`});
  assert(await page.locator('[data-cutaway]').isChecked());
  await page.locator('[data-cutaway]').uncheck(); await capture('exterior'); await page.locator('[data-cutaway]').check();
  await page.locator('[data-step]').click(); await laws(D, .01); await reset();
  for (const [i, experiment] of lesson.tryIt.entries()) {
    await preset(i);
    for (const [key, value] of Object.entries(experiment.values)) assert.equal(Number(await page.locator(`[data-control="${key}"]`).inputValue()), value);
    outcomes.push({title: experiment.title, ...await laws(experiment.values, experiment.initialState.time)});
    await capture(`preset-${i}`); await checkFraming(`desktop-preset-${i}`);
  }
  await page.locator('[data-play]').click(); await page.waitForTimeout(600); await page.locator('[data-play]').click();
  assert(!(await reading('Your result').innerText()).startsWith('Largest flash-onset error'), 'completed observation replays');
  const paused = await page.locator('.daily-readings').innerText(); await page.waitForTimeout(250); assert.equal(await page.locator('.daily-readings').innerText(), paused);
  await reset(); await edit('latency', 60); await edit('soundTracking', 0); await page.locator('[data-play]').click();
  await page.waitForFunction(() => document.querySelector('[data-play]').getAttribute('aria-pressed') === 'false', null, {timeout: 30000});
  await laws({...D, latency: 60, soundTracking: 0}, 3); await capture('completed');
  await page.locator('[data-play]').click(); await page.waitForTimeout(300); await page.locator('[data-play]').click();
  assert.equal(await page.locator('[data-control="latency"]').inputValue(), '60');
  assert.equal(await page.locator('[data-control="soundTracking"]').inputValue(), '0');
  for (const [key, [min, max, step]] of Object.entries(VR_DOMAINS)) for (let index = 0; index <= Math.round((max - min) / step); index++) {
    const value = Number((min + index * step).toFixed(5)), settings = {...D, [key]: value};
    await reset(); await edit(key, value); await laws(settings, 0);
    // Advance the real step button to a turning pose. One evaluation avoids
    // network round trips without bypassing any application event handlers.
    await page.locator('[data-step]').evaluate(button => {for (let i = 0; i < 100; i++) button.click();});
    assert.equal(Number(await page.locator(`[data-control="${key}"]`).inputValue()), value);
    controls.push({key, value, ...await laws(settings, 1)});
  }
  for (let i = 0; i < await page.locator('[data-action]').count(); i++) {
    await preset(7); await page.locator('[data-action]').nth(i).click();
    actions.push({name: await page.locator('[data-action]').nth(i).innerText(), ...await laws(D, lesson.tryIt[7].initialState.time)});
    await capture(`action-${i}`); await checkFraming(`action-${i}`);
  }
  await reset(); await page.locator('[data-cutaway]').uncheck(); await action('Inspect: complete experiment'); await page.locator('[data-labels]').check();
  const parts = await page.locator('button[data-label-part]').evaluateAll(elements => elements.map(e => ({id: e.dataset.labelPart, name: e.innerText})));
  for (const part of parts) {
    await action('Inspect: complete experiment');
    const diagram = {timeline: 'Read: head tracking', errors: 'Read: tracking errors', frames: 'Read: frame timing', view: 'Compare: room and picture', optics: 'Trace: lens rays', focus: 'Compare: aim and focus', sound: 'Compare: sound cues'}[part.id];
    if (diagram) await action(diagram);
    const button = page.locator(`button[data-label-part="${part.id}"]`); await button.click();
    assert.equal(await page.locator('.daily-part-detail h3').innerText(), part.name);
    assert.equal(await button.getAttribute('aria-pressed'), 'true'); selections.push(part);
  }
  assert.equal(selections.length, 27); await page.locator('[data-labels]').uncheck();
  for (const [id, name] of [['lenses', 'Lenses'], ['earphones', 'Left and right earphones'], ['interface-board', 'Display and audio interface']]) {
    await reset(); await focusPart(id); const hit = await hitPart(name); await page.mouse.click(...hit); assert.equal(await popup.innerText(), name); physicalHits.push(name); await capture(`popup-${id}`);
    if (id === 'lenses') {
      const b = await canvas.boundingBox(); await page.mouse.move(b.x + 10, b.y + 10); const before = await canvas.screenshot();
      await page.mouse.move(...hit); await page.mouse.down(); await page.mouse.move(hit[0] + 35, hit[1] + 20, {steps: 10}); await page.mouse.up(); await page.mouse.move(b.x + 10, b.y + 10);
      assert(!before.equals(await canvas.screenshot()), 'dragging physical part translates object');
    }
    await page.locator('.daily-heading h1').click(); assert.equal(await popup.isVisible(), false); assert.equal(await page.locator('.daily-part-detail h3').count(), 0);
  }
  await reset(); await page.locator('[data-labels]').check(); await page.locator('button[data-label-part="earphones"]').click(); await page.locator('.daily-heading h1').click();
  assert.equal(await page.locator('button[data-label-part="earphones"]').getAttribute('aria-pressed'), 'false'); await page.locator('[data-labels]').uncheck();
  await action('Inspect: complete experiment'); await canvas.scrollIntoViewIfNeeded(); let box = await canvas.boundingBox();
  await page.mouse.move(box.x + 15, box.y + 15); assert.equal(await popup.isVisible(), false); const beforeRotate = await canvas.screenshot();
  await page.mouse.down(); await page.mouse.move(box.x + 95, box.y + 55, {steps: 12}); await page.mouse.up(); assert(!beforeRotate.equals(await canvas.screenshot()), 'background drag rotates');
  await action('Inspect: complete experiment'); const beforeZoom = await canvas.screenshot(); await page.locator('[data-view="in"]').click(); assert(!beforeZoom.equals(await canvas.screenshot())); assert.equal(await page.locator('[data-separation]').inputValue(), '0');
  await page.locator('[data-view="out"]').click(); assert.equal(await page.locator('[data-separation]').inputValue(), '0');
  await canvas.scrollIntoViewIfNeeded(); box = await canvas.boundingBox(); await page.mouse.move(box.x + 15, box.y + 15); await page.locator('[data-cutaway]').check(); await canvas.scrollIntoViewIfNeeded(); box = await canvas.boundingBox(); await page.mouse.move(box.x + 15, box.y + 15);
  const held = await page.locator('.daily-readings').innerText(); for (let i = 0; i < 8; i++) await page.mouse.wheel(0, 240);
  await page.waitForFunction(() => document.querySelector('[data-separation]').value === '100'); assert.equal(await page.locator('.daily-readings').innerText(), held); await capture('grouped-parts'); await checkFraming('grouped-parts');
  for (const name of ['Case and fit', 'Optics and display', 'Electronics and audio']) assert((await page.locator('.daily-inventory-labels').innerText()).includes(name));
  await hitPart('Top lid'); await capture('separated-lid');
  await page.locator('[data-reassemble]').click(); assert(await page.locator('[data-cutaway]').isChecked());
  await tab('Meet the parts'); for (const id of ['device', 'headset', 'top-lid']) await page.locator(`button[data-part="${id}"]`).click(); await page.locator('[data-isolate]').check(); assert.equal(await page.locator('[data-cutaway]').isChecked(), false); await hitPart('Top lid'); await capture('selected-lid'); await tab('How it works');
  await page.locator('[data-cutaway]').check(); await action('Inspect: complete experiment');
  for (const view of ['Front', 'Side', 'Back', 'Top', 'Underneath', 'Angled']) {await page.getByRole('button', {name: view, exact: true}).click(); await capture(`view-${view.toLowerCase()}`); await checkFraming(`view-${view}`);}
  for (const width of [390, 320]) {
    await page.setViewportSize({width, height: width === 390 ? 844 : 568}); const tools = page.getByRole('navigation', {name: 'Lesson tools'});
    for (const [index, experiment] of lesson.tryIt.entries()) {
      await tools.getByRole('button', {name: 'Try it yourself', exact: true}).click(); await page.locator('[data-experiment]').nth(index).click(); await tools.getByRole('button', {name: 'Controls', exact: true}).click();
      await laws(experiment.values, experiment.initialState.time); await capture(`phone-preset-${index}-${width}`); await checkFraming(`phone-preset-${index}-${width}`);
    }
    await action('Inspect: complete experiment'); await page.locator('[data-separation]').fill('100'); await capture(`phone-separated-${width}`); await checkFraming(`phone-separated-${width}`); await page.locator('[data-reassemble]').click();
    await focusPart('earphones'); await hitPart('Left and right earphones'); await capture(`phone-earphones-${width}`);
    await action('Inspect: complete experiment'); await capture(`phone-${width}`); await page.screenshot({path: `${output}/phone-page-${width}.png`}); assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
  }
  await page.setViewportSize({width: 390, height: 844}); await action('Inspect: complete experiment');
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
  await page.locator('.daily-return').click(); assert(!page.url().endsWith('#machine/virtual-reality-headset')); assert.deepEqual(errors, []);
  const report = {passed: true, outcomes, controls, actions, selections, physicalHits, framing, pause: true, step: true, completion: true, replay: true, hoverClick: true, deselection: true, objectDrag: true, backgroundRotation: true, zoomOnlyButtons: true, wheelSeparation: true, pinch: true, separatedCover: true, coverSelection: true, mobileWidths: [390, 320], quiz: true, return: true, errors};
  await writeFile(`${output}/browser.json`, JSON.stringify(report, null, 2)); console.log(JSON.stringify(report));
} catch (error) {
  await writeFile(`${output}/failure.json`, JSON.stringify({message: error.message, errors, url: page.url(), body: await page.locator('body').innerText().catch(() => '')}, null, 2));
  await page.screenshot({path: `${output}/failure.png`}).catch(() => {}); throw error;
} finally {await browser.close();}

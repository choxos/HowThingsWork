import assert from 'node:assert/strict';
import {mkdir, writeFile} from 'node:fs/promises';
import {chromium} from 'playwright';
import {gamesControllerLesson as lesson} from './games-controller-lessons.js';
import {PAD_DEFAULTS as D, PAD_DOMAINS, samplePad, padPlan, tiltOf, CLOCKS} from './games-controller-physics.js';
import {fixed} from './format.js';
const base = process.env.SITE_URL || 'http://127.0.0.1:4173/', output = process.env.EVIDENCE_DIR || 'documentation/games-controller-browser';
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
  const screenshot = await canvas.screenshot();
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
  const values={...D,...given},s=samplePad(values,time),n=s.now,report=n.report.report,sign=v=>(v<0?'−':'')+fixed(Math.abs(v),0);
  const result=await reading('Your result').innerText();
  assert.ok(result.startsWith(n.t<=CLOCKS.start?'Ready':n.t>=CLOCKS.duration?'Observation complete':fixed(n.t*1000,1)+' ms'));
  assert.ok((await reading('Stick').innerText()).startsWith(fixed(tiltOf(n.stick.angles).alpha*180/Math.PI,2)+'° from center'));
  assert.equal(await reading('Wiper voltages').innerText(),`X ${fixed(n.sample.volts[0],3)} V · Y ${fixed(n.sample.volts[1],3)} V`);
  assert.equal(await reading('ADC codes').innerText(),`X ${n.sample.codes[0]} · Y ${n.sample.codes[1]} · ${s.bits} bits`);
  assert.equal(await reading('Report').innerText(),`X ${sign(report[0])} · Y ${sign(report[1])} · ${fixed(Math.hypot(...report)/32767*100,1)}% of full`);
  assert.equal(await reading('Report bytes').innerText(),n.packet.map(b=>b.toString(2).padStart(8,'0')).join(' '));
  assert.ok((await reading('Button').innerText()).includes(`firmware ${n.firmware?'pressed':'released'} · console heard ${n.heard}`));
  assert.equal(await reading('Latency').innerText(),`This press: ${fixed(s.press.latency*1000,1)} ms from touch to screen`);
  assert.equal(await reading('Rumble feedback').innerText(),values.rumble?`Left ${fixed(n.motors[0].frequency,0)} Hz · right ${fixed(n.motors[1].frequency,0)} Hz · ${n.motors[0].phase}`:'Off · both motors stationary');
  const text=await page.locator('.daily-readings').innerText();assert.ok(!/NaN|undefined|Infinity/.test(text));assert.equal(await page.locator('.daily-readings > div').count(),10);
  return {time:n.t,report:n.packet,presses:n.onScreen,latency:s.press.latency,motors:n.motors.map(m=>m.frequency),readings:text};
}
async function focusPart(id) {
  await action('Inspect: complete experiment'); await page.locator('[data-labels]').check();
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
  await page.goto(new URL('#machine/games-controller', base).href);
  await page.getByRole('heading', {name: 'Games controller', exact: true, level: 1}).waitFor(); await canvas.waitFor();
  assert.equal(await page.locator('[data-control]').count(), 8);
  for (const key of ['release', 'gate']) assert.ok(await page.locator(`[data-control="${key}"]`).isVisible(), `${key} visible immediately`);
  await laws(D, 0); await capture('opening'); await page.screenshot({path: `${output}/opening-page.png`});
  await page.locator('[data-cutaway]').uncheck(); await capture('exterior'); await page.locator('[data-cutaway]').check();
  await page.locator('[data-step]').click(); await laws(D, .005); await capture('first-step'); await reset();
  for (const [i, experiment] of lesson.tryIt.entries()) {
    await preset(i);
    for (const [key, value] of Object.entries(experiment.values)) assert.equal(Number(await page.locator(`[data-control="${key}"]`).inputValue()), value);
    outcomes.push({title: experiment.title, ...await laws(experiment.values, experiment.initialState.time)}); await capture(`preset-${i}`);
    if (i === 6 || i === 9) await checkFraming(`desktop-preset-${i}`);
  }
  await page.locator('[data-play]').click(); await page.waitForTimeout(600); await page.locator('[data-play]').click();
  assert.equal((await reading('Your result').innerText()).startsWith('Observation complete'), false, 'Completed program replays');
  const paused = await page.locator('.daily-readings').innerText(); await page.waitForTimeout(250); assert.equal(await page.locator('.daily-readings').innerText(), paused);
  await reset(); const finishSettings={...D,release:2,deadzone:20,rumble:0};
  for(const [key,value]of Object.entries(finishSettings)) await edit(key,value);
  await page.locator('[data-play]').click(); await page.waitForFunction(() => document.querySelector('[data-play]').getAttribute('aria-pressed') === 'false');
  await laws(finishSettings,.32); await capture('completed-experiment');
  for (const [key, [min, max, step]] of Object.entries(PAD_DOMAINS)) for (let raw = min; raw <= max + 1e-9; raw += step) {
    const value = Number(raw.toFixed(3)), settings = {...D, [key]: value};
    await reset(); await edit(key, value); assert.equal(Number(await page.locator(`[data-control="${key}"]`).inputValue()), value);
    await laws(settings, 0); await page.locator('[data-step]').click(); await laws(settings, .005);
    const count = 64;
    await page.locator('[data-step]').evaluate((button, count) => {for (let i = 0; i < count; i++) button.click();}, count);
    controls.push({key, value, ...await laws(settings, .32)});
  }
  for (let i = 0; i < await page.locator('[data-action]').count(); i++) {
    await reset(); await page.locator('[data-step]').click(); await page.locator('[data-action]').nth(i).click();
    actions.push({name: await page.locator('[data-action]').nth(i).innerText(), ...await laws(D, .005)}); await capture(`action-${i}`);
  }
  for (const index of [0, 10, 15]) {
    await preset(index); await action('Inspect: complete experiment'); await page.locator('[data-labels]').check();
    const parts = await page.locator('button[data-label-part]:visible:not(:disabled)').evaluateAll(elements => elements.map(e => ({id: e.dataset.labelPart, name: e.innerText})));
    for (const part of parts) {
      await action('Inspect: complete experiment'); const button = page.locator(`button[data-label-part="${part.id}"]`);
      if (!(await button.isVisible()) || await button.isDisabled()) continue;
      await button.click(); assert.equal(await page.locator('.daily-part-detail h3').innerText(), part.name); assert.equal(await button.getAttribute('aria-pressed'), 'true');
      if (!selections.some(selected => selected.id === part.id)) selections.push(part);
    }
    await page.locator('[data-labels]').uncheck();
  }
  for (const [id, label] of [['timeline','Read: stick over time'],['map','Read: stick map'],['adc','Read: ADC steps'],['bounce','Read: button bounce'],['latency','Read: timing breakdown']]) {
    await action(label); await page.locator('[data-labels]').check();
    const button=page.locator(`button[data-label-part="${id}"]`);await button.click();if(!selections.some(p=>p.id===id))selections.push({id,name:await button.innerText()});
    await page.locator('[data-labels]').uncheck();
  }
  assert.equal(selections.length,43,'Every named component and category can be selected');
  for (const [id, name] of [['button-cap','Button cap'],['x-pot-wiper','X sensor wiper'],['low-motor-weight','Low-frequency motor: eccentric weight']]) {
    await reset(); await focusPart(id); const hit = await hitPart(name); await page.mouse.click(...hit); assert.equal(await popup.innerText(), name); physicalHits.push(name); await capture(`popup-${id}`);
    if (id === 'button-cap') {
      const box = await canvas.boundingBox(); await page.mouse.move(box.x + 10, box.y + 10); const before = await canvas.screenshot();
      await page.mouse.move(...hit); await page.mouse.down(); await page.mouse.move(hit[0] + 35, hit[1] + 20, {steps: 10}); await page.mouse.up(); await page.mouse.move(box.x + 10, box.y + 10);
      assert.ok(!before.equals(await canvas.screenshot()), 'Dragging physical part moves object');
    }
    await page.locator('.daily-heading h1').click(); assert.equal(await popup.isVisible(), false); assert.equal(await page.locator('.daily-part-detail h3').count(), 0);
  }
  await reset(); await page.locator('[data-labels]').check(); await page.locator('button[data-label-part="stick-lever"]').click(); await page.locator('.daily-heading h1').click(); assert.equal(await page.locator('button[data-label-part="stick-lever"]').getAttribute('aria-pressed'), 'false'); await page.locator('[data-labels]').uncheck();
  await action('Inspect: complete experiment'); await canvas.scrollIntoViewIfNeeded(); let box = await canvas.boundingBox();
  await page.mouse.move(box.x + 15, box.y + 15); assert.equal(await popup.isVisible(), false); const beforeRotate = await canvas.screenshot();
  await page.mouse.down(); await page.mouse.move(box.x + 95, box.y + 55, {steps: 12}); await page.mouse.up(); assert.ok(!beforeRotate.equals(await canvas.screenshot()), 'Background drag rotates');
  await action('Inspect: complete experiment'); const beforeZoom = await canvas.screenshot(); await page.locator('[data-view="in"]').click(); assert.ok(!beforeZoom.equals(await canvas.screenshot())); assert.equal(await page.locator('[data-separation]').inputValue(), '0');
  await page.locator('[data-view="out"]').click(); assert.equal(await page.locator('[data-separation]').inputValue(), '0');
  await canvas.scrollIntoViewIfNeeded(); box = await canvas.boundingBox(); await page.mouse.move(box.x + 15, box.y + 15);
  const held = await page.locator('.daily-readings').innerText(); for (let i = 0; i < 8; i++) await page.mouse.wheel(0, 240);
  await page.waitForFunction(() => document.querySelector('[data-separation]').value === '100'); assert.equal(await page.locator('.daily-readings').innerText(), held); await capture('grouped-parts');
  for (const name of ['Controller shell','Thumbstick and sensors','Button input','Circuit board','Rumble feedback']) assert.ok((await page.locator('.daily-inventory-labels').innerText()).includes(name));
  await page.locator('[data-reassemble]').click(); await action('Inspect: complete experiment');
  for (const view of ['Front', 'Side', 'Back', 'Top', 'Underneath', 'Angled']) {await page.getByRole('button', {name: view, exact: true}).click(); await capture(`view-${view.toLowerCase()}`);}
  for (const width of [390, 320]) {
    await page.setViewportSize({width, height: width === 390 ? 844 : 568}); const tools = page.getByRole('navigation', {name: 'Lesson tools'});
    for (const index of [1, 3, 5, 6, 7, 10, 14, 15, 16, 17]) {
      await tools.getByRole('button', {name: 'Try it yourself', exact: true}).click(); await page.locator('[data-experiment]').nth(index).click(); await tools.getByRole('button', {name: 'Controls', exact: true}).click();
      await laws(lesson.tryIt[index].values, lesson.tryIt[index].initialState.time); await capture(`phone-preset-${index}-${width}`);
      if (index === 6) await checkFraming(`phone-sensors-${width}`);
    }
    await focusPart('low-motor-weight'); await hitPart('Low-frequency motor: eccentric weight'); await capture(`phone-weight-${width}`);
    for (const [id, label] of [['timeline','Read: stick over time'],['map','Read: stick map'],['adc','Read: ADC steps'],['bounce','Read: button bounce'],['latency','Read: timing breakdown']]) {await action(label); await capture(`phone-${id}-${width}`);}
    await action('Inspect: complete experiment'); await capture(`phone-${width}`); await page.screenshot({path: `${output}/phone-page-${width}.png`}); assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
  }
  await page.setViewportSize({width: 390, height: 844}); await action('Inspect: complete experiment');
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
  await page.locator('.daily-return').click(); assert.ok(!page.url().endsWith('#machine/games-controller')); assert.deepEqual(errors, []);
  const report = {passed: true, outcomes, controls, actions, selections, physicalHits, framing, pause: true, step: true, completion: true, replay: true, hoverClick: true, deselection: true, objectDrag: true, backgroundRotation: true, zoomOnlyButtons: true, wheelSeparation: true, pinch: true, mobileWidths: [390, 320], quiz: true, return: true, errors};
  await writeFile(`${output}/browser.json`, JSON.stringify(report, null, 2)); console.log(JSON.stringify(report));
} catch (error) {
  await writeFile(`${output}/failure.json`, JSON.stringify({message: error.message, errors, url: page.url(), body: await page.locator('body').innerText().catch(() => '')}, null, 2));
  await page.screenshot({path: `${output}/failure.png`}).catch(() => {}); throw error;
} finally {await browser.close();}

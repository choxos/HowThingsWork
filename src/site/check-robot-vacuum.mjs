import assert from 'node:assert/strict';
import {mkdir, writeFile} from 'node:fs/promises';
import {chromium} from 'playwright';
import {robotVacuumLesson as lesson} from './robot-vacuum-lesson.js';
import {ROBOT_DEFAULTS as D, ROBOT_DOMAINS} from './robot-vacuum-physics.js';
import {sampleRobot, robotMission} from './robot-vacuum-mission.js';
import {fixed} from './format.js';
const base = process.env.SITE_URL || 'http://127.0.0.1:4173/', output = process.env.EVIDENCE_DIR || 'documentation/robot-vacuum-browser';
await mkdir(output, {recursive: true});
const browser = await chromium.launch({channel: 'chrome', headless: true});
const page = await browser.newPage({viewport: {width: 1440, height: 1000}, hasTouch: true, reducedMotion: 'reduce'});
page.setDefaultTimeout(25000);
const errors = [], outcomes = [], controls = [], actions = [], selections = [], physicalHits = [];
page.on('pageerror', error => errors.push(error.message));
const canvas = page.locator('canvas'), popup = page.locator('.daily-part-popup');
const reading = label => page.locator('.daily-readings > div').filter({has: page.getByText(label, {exact: true})}).locator('dd');
const tab = name => page.getByRole('tab', {name, exact: true}).click();
const capture = async name => {await canvas.scrollIntoViewIfNeeded(); await canvas.screenshot({path: `${output}/${name}.png`});};
const reset = () => page.getByRole('button', {name: 'Reset experiment', exact: true}).click();
const action = name => page.getByRole('button', {name, exact: true}).click();
async function preset(index) {await tab('Try it yourself'); await page.locator('[data-experiment]').nth(index).click(); await tab('Controls');}
async function edit(key, value) {await page.locator(`[data-control="${key}"]`).selectOption(String(value));}
async function laws(given, time) {
  const values = {...D, ...given}, s = sampleRobot(values, time);
  assert.equal(await reading('Cleaning-head coverage').innerText(), `${fixed(s.coverage * 100, 1)}% of exposed floor`);
  assert.equal(await reading('Wheel speeds').innerText(), `Left ${fixed(s.now.leftWheel, 3)} · right ${fixed(s.now.rightWheel, 3)} m/s`);
  assert.equal(await reading('Battery').innerText(), `${fixed(s.battery * 100, 1)}% · ${fixed(s.energy / 3600, 2)} Wh`);
  assert.equal(await reading('Obstacle and edge sensing').innerText(), `${s.now.bumps} obstacle stops · ${s.now.cliffs} floor-edge stops`);
  assert.equal(await reading('Mission phase').innerText(), s.clock === 0 ? 'Ready at dock' : s.phase === 'cleaning' ? s.now.doing : s.phase);
  assert.equal(await reading('Energy balance').innerText(), `${fixed(s.cleanEnergy / 3600, 2)} Wh cleaning + ${fixed(s.returnEnergy / 3600, 3)} Wh returning`);
  const readings = await page.locator('.daily-readings').innerText(); assert.ok(!/NaN|undefined|Infinity/.test(readings));
  assert.equal(await page.locator('.daily-readings > div').count(), 8);
  return {time: s.clock, phase: s.phase, coverage: s.coverage, readings};
}
async function focusPart(id) {
  await action('Inspect: robot close up'); await page.locator('[data-labels]').check();
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
  await page.goto(new URL('#machine/robot-vacuum-cleaner', base).href);
  await page.getByRole('heading', {name: 'Robot vacuum cleaner', exact: true, level: 1}).waitFor(); await canvas.waitFor();
  assert.equal(await page.locator('[data-control]').count(), 5);
  for (const key of ['strategy', 'room']) assert.ok(await page.locator(`[data-control="${key}"]`).isVisible(), `${key} visible immediately`);
  await laws(D, 0); await capture('opening'); await page.screenshot({path: `${output}/opening-page.png`});
  await page.locator('[data-cutaway]').uncheck(); await capture('exterior'); await page.locator('[data-cutaway]').check();
  await page.locator('[data-step]').click(); await laws(D, 30); await capture('first-step'); await reset();
  for (const [i, experiment] of lesson.tryIt.entries()) {
    await preset(i);
    for (const [key, value] of Object.entries(experiment.values)) assert.equal(Number(await page.locator(`[data-control="${key}"]`).inputValue()), value);
    outcomes.push({title: experiment.title, ...await laws(experiment.values, experiment.initialState.time)}); await capture(`preset-${i}`);
  }
  await page.locator('[data-play]').click(); await page.waitForTimeout(600); await page.locator('[data-play]').click();
  assert.equal(await reading('Mission phase').innerText() === 'ready', false, 'Completed mission replays');
  const paused = await page.locator('.daily-readings').innerText(); await page.waitForTimeout(250); assert.equal(await page.locator('.daily-readings').innerText(), paused);
  await preset(12); await page.locator('[data-play]').click(); await page.waitForFunction(() => document.querySelector('[data-play]').getAttribute('aria-pressed') === 'false');
  await laws(D, robotMission(D).end); await capture('completed-experiment');
  for (const [key, [min, max, step]] of Object.entries(ROBOT_DOMAINS)) for (let value = min; value <= max; value += step) {
    await reset(); await edit(key, value); await laws({...D, [key]: value}, 0); await page.locator('[data-step]').click();
    controls.push({key, value, ...await laws({...D, [key]: value}, 30)});
  }
  for (let i = 0; i < await page.locator('[data-action]').count(); i++) {
    await reset(); await page.locator('[data-step]').click(); await page.locator('[data-action]').nth(i).click();
    actions.push({name: await page.locator('[data-action]').nth(i).innerText(), ...await laws(D, 30)}); await capture(`action-${i}`);
  }
  for (const index of [2, 4, 9]) {
    await preset(index); await action('Inspect: whole room'); await page.locator('[data-labels]').check();
    const parts = await page.locator('button[data-label-part]:visible:not(:disabled)').evaluateAll(elements => elements.map(e => ({id: e.dataset.labelPart, name: e.innerText})));
    for (const part of parts) {
      await action('Inspect: whole room'); const button = page.locator(`button[data-label-part="${part.id}"]`);
      if (!(await button.isVisible()) || await button.isDisabled()) continue;
      await button.click(); assert.equal(await page.locator('.daily-part-detail h3').innerText(), part.name); assert.equal(await button.getAttribute('aria-pressed'), 'true');
      if (!selections.some(selected => selected.id === part.id)) selections.push(part);
    }
    await page.locator('[data-labels]').uncheck();
  }
  await reset(); await page.locator('[data-cutaway]').uncheck(); await page.locator('[data-labels]').check();
  await page.locator('button[data-label-part="lid"]').click(); selections.push({id: 'lid', name: 'Top cover'}); await capture('selected-cover');
  await page.locator('[data-labels]').uncheck(); await page.locator('[data-cutaway]').check();
  for (const id of ['system', 'robot', 'structure', 'chassis', 'lid', 'bumper', 'drive', 'left-wheel', 'right-wheel', 'caster', 'cleaner', 'roller', 'side-brush', 'duct', 'bin', 'filter', 'blower', 'exhaust', 'airflow', 'power', 'battery', 'controller', 'wiring', 'cliff-sensors', 'dock-receiver', 'contacts', 'floor', 'furniture', 'stairs', 'trail', 'return-route', 'dock']) assert.ok(selections.some(part => part.id === id), `Part menu missed ${id}`);
  await action('Compare cleaning strategies'); await page.locator('[data-labels]').check(); await page.locator('button[data-label-part="charts"]').click(); selections.push({id: 'charts', name: 'Compare cleaning strategies'}); await page.locator('[data-labels]').uncheck();
  for (const [id, name] of [['left-wheel', 'Left wheel drive'], ['blower', 'Suction blower'], ['filter', 'Pleated filter']]) {
    await reset(); await focusPart(id); const hit = await hitPart(name); await page.mouse.click(...hit); assert.equal(await popup.innerText(), name); physicalHits.push(name); await capture(`popup-${id}`);
    if (id === 'left-wheel') {
      const box = await canvas.boundingBox(); await page.mouse.move(box.x + 10, box.y + 10); const before = await canvas.screenshot();
      await page.mouse.move(...hit); await page.mouse.down(); await page.mouse.move(hit[0] + 35, hit[1] + 20, {steps: 10}); await page.mouse.up(); await page.mouse.move(box.x + 10, box.y + 10);
      assert.ok(!before.equals(await canvas.screenshot()), 'Dragging physical part moves object');
    }
    await page.locator('.daily-heading h1').click(); assert.equal(await popup.isVisible(), false); assert.equal(await page.locator('.daily-part-detail h3').count(), 0);
  }
  await reset(); await page.locator('[data-labels]').check(); await page.locator('button[data-label-part="left-wheel"]').click(); await page.locator('.daily-heading h1').click(); assert.equal(await page.locator('button[data-label-part="left-wheel"]').getAttribute('aria-pressed'), 'false'); await page.locator('[data-labels]').uncheck();
  await action('Inspect: robot close up'); await canvas.scrollIntoViewIfNeeded(); let box = await canvas.boundingBox();
  await page.mouse.move(box.x + 15, box.y + 15); assert.equal(await popup.isVisible(), false); const beforeRotate = await canvas.screenshot();
  await page.mouse.down(); await page.mouse.move(box.x + 95, box.y + 55, {steps: 12}); await page.mouse.up(); assert.ok(!beforeRotate.equals(await canvas.screenshot()), 'Background drag rotates');
  await action('Inspect: robot close up'); const beforeZoom = await canvas.screenshot(); await page.locator('[data-view="in"]').click(); assert.ok(!beforeZoom.equals(await canvas.screenshot())); assert.equal(await page.locator('[data-separation]').inputValue(), '0');
  await page.locator('[data-view="out"]').click(); assert.equal(await page.locator('[data-separation]').inputValue(), '0');
  await canvas.scrollIntoViewIfNeeded(); box = await canvas.boundingBox(); await page.mouse.move(box.x + 15, box.y + 15);
  const held = await page.locator('.daily-readings').innerText(); for (let i = 0; i < 8; i++) await page.mouse.wheel(0, 240);
  await page.waitForFunction(() => document.querySelector('[data-separation]').value === '100'); assert.equal(await page.locator('.daily-readings').innerText(), held); await capture('grouped-parts');
  for (const name of ['Body and bumper', 'Wheel drives', 'Brushes and suction path', 'Power and sensing', 'Powered charging dock']) assert.ok((await page.locator('.daily-inventory-labels').innerText()).includes(name));
  await page.locator('[data-reassemble]').click(); await action('Inspect: robot close up');
  for (const view of ['Front', 'Side', 'Back', 'Top', 'Underneath', 'Angled']) {await page.getByRole('button', {name: view, exact: true}).click(); await capture(`view-${view.toLowerCase()}`);}
  for (const width of [390, 320]) {
    await page.setViewportSize({width, height: width === 390 ? 844 : 568}); const tools = page.getByRole('navigation', {name: 'Lesson tools'});
    for (const index of [1, 4, 5, 9, 12, 13, 14]) {
      await tools.getByRole('button', {name: 'Try it yourself', exact: true}).click(); await page.locator('[data-experiment]').nth(index).click(); await tools.getByRole('button', {name: 'Controls', exact: true}).click();
      await laws(lesson.tryIt[index].values, lesson.tryIt[index].initialState.time); await capture(`phone-preset-${index}-${width}`);
    }
    await focusPart('left-wheel'); await hitPart('Left wheel drive'); await capture(`phone-wheel-${width}`);
    await action('Inspect: robot close up'); await capture(`phone-${width}`); await page.screenshot({path: `${output}/phone-page-${width}.png`}); assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
  }
  await page.setViewportSize({width: 390, height: 844}); await action('Inspect: robot close up');
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
  await page.locator('.daily-return').click(); assert.ok(!page.url().endsWith('#machine/robot-vacuum-cleaner')); assert.deepEqual(errors, []);
  const report = {passed: true, outcomes, controls, actions, selections, physicalHits, pause: true, step: true, completion: true, replay: true, hoverClick: true, deselection: true, objectDrag: true, backgroundRotation: true, zoomOnlyButtons: true, wheelSeparation: true, pinch: true, mobileWidths: [390, 320], quiz: true, return: true, errors};
  await writeFile(`${output}/browser.json`, JSON.stringify(report, null, 2)); console.log(JSON.stringify(report));
} catch (error) {
  await writeFile(`${output}/failure.json`, JSON.stringify({message: error.message, errors, url: page.url(), body: await page.locator('body').innerText().catch(() => '')}, null, 2));
  await page.screenshot({path: `${output}/failure.png`}).catch(() => {}); throw error;
} finally {await browser.close();}

import assert from 'node:assert/strict';
import {mkdir, writeFile} from 'node:fs/promises';
import {chromium} from 'playwright';
import {tftScreenLesson as lesson} from './tft-screen-lesson.js';
import {createTftScreenModel} from './tft-screen-model.js';
import {TFT_DEFAULTS as D, TFT_DOMAINS, TFT_DURATION, TFT_FRAME, TFT} from './tft-screen-physics.js';
const expectedModel = createTftScreenModel();
const base = process.env.SITE_URL || 'http://127.0.0.1:4173/', output = process.env.EVIDENCE_DIR || 'documentation/tft-screen-browser';
await mkdir(output, {recursive: true});
const browser = await chromium.launch({channel: 'chrome', headless: true});
const page = await browser.newPage({viewport: {width: 1440, height: 1000}, hasTouch: true, reducedMotion: 'reduce'});
page.setDefaultTimeout(25000);
const errors = [], outcomes = [], controls = [], actions = [], selections = [], physicalHits = [], framing = [];
page.on('pageerror', error => errors.push(error.stack));
const canvas = page.locator('canvas'), popup = page.locator('.daily-part-popup');
const reading = label => page.locator('.daily-readings > div').filter({has: page.getByText(label, {exact: true})}).locator('dd');
const tab = name => page.getByRole('tab', {name, exact: true}).click();
const capture = async name => {await canvas.scrollIntoViewIfNeeded(); await page.waitForTimeout(400); assert.deepEqual(errors,[],name+': no browser errors'); await canvas.screenshot({path: `${output}/${name}.png`});};
async function checkFraming(name) {
  // Exclude sticky overlays, rounded corners and the keyboard focus ring only
  // from geometry measurements. Normal evidence captures retain these UI features.
  const screenshot = await canvas.screenshot({style: '.daily-operation-tabs, .daily-mobile-tools { visibility: hidden !important; } .daily-canvas-wrap { border-radius: 0 !important; } canvas { outline: none !important; }'});
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
  if(['opening','completed','home','whole-machine'].includes(name)){
    assert.ok((bounds.bottom-bounds.top+1)/bounds.height>.6,`${name}: assembly fills a useful portion of the canvas`);
    assert.ok(Math.abs((bounds.left+bounds.right)/2/bounds.width-.5)<.1,`${name}: assembly stays centered after reset`);
  }
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
async function laws(given, time=0, history={}) {
  expectedModel.reset({...history, settings: {...D, ...given}, time});
  return compareCurrent();
}
async function compareCurrent() {
  const expected = Object.fromEntries(expectedModel.getState().readings.map(r => [r.label, r.value]));
  const readings = Object.fromEntries(await page.locator('.daily-readings > div').evaluateAll(rows => rows.map(row => [row.querySelector('dt').textContent, row.querySelector('dd').textContent])));
  assert.deepEqual(readings, expected);
  assert(!/NaN|undefined|Infinity/.test(JSON.stringify(readings)));
  return {time: expectedModel.getState().clock, readings};
}
async function focusPart(id) {
  await action('Inspect: connected screen'); await page.locator('[data-labels]').check();
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
  await page.goto(new URL('#machine/lcd-screen', base).href);
  await page.getByRole('heading', {name: 'LCD screen', exact: true, level: 1}).waitFor(); await canvas.waitFor();
  assert.equal(await page.locator('[data-control]').count(), 8);
  assert.equal(await page.locator('.daily-primary-controls [data-control="pattern"]').count(), 1);
  await laws(D, 0); await capture('opening'); await checkFraming('opening'); await page.screenshot({path: `${output}/opening-page.png`});
  await canvas.focus(); await page.keyboard.press('Home'); await laws(D,0); await capture('home'); await checkFraming('home');
  await action('Inspect: row selection and storage'); await page.getByRole('button',{name:'Whole machine',exact:true}).click();
  await laws(D,0); await capture('whole-machine'); await checkFraming('whole-machine');
  await action('Inspect: connected screen');
  await page.locator('[data-step]').click(); await laws(D, TFT_FRAME*TFT.slow); await reset();
  for (const [i, experiment] of lesson.tryIt.entries()) {
    await preset(i);
    for (const [key, value] of Object.entries(experiment.values)) assert.equal(Number(await page.locator(`[data-control="${key}"]`).inputValue()), value);
    outcomes.push({title: experiment.title, ...await laws(experiment.values, experiment.initialState.time, experiment.initialState)});
    await capture(`preset-${i}`); await checkFraming(`desktop-preset-${i}`);
    await page.locator('[data-step]').evaluate(button=>{for(let n=0;n<12;n++)button.click();});
    expectedModel.reset(experiment.initialState);expectedModel.advance(TFT_DURATION);await compareCurrent(); await capture(`preset-completed-${i}`); await checkFraming(`desktop-preset-completed-${i}`);
  }
  await preset(0); await page.locator('[data-play]').click(); await page.waitForTimeout(350); await page.locator('[data-play]').click();
  const paused = await page.locator('.daily-readings').innerText(); await page.waitForTimeout(250); assert.equal(await page.locator('.daily-readings').innerText(), paused);
  await preset(0); await page.locator('[data-play]').click();
  await page.waitForFunction(() => document.querySelector('[data-play]').getAttribute('aria-pressed') === 'false', null, {timeout:40000});
  await laws(lesson.tryIt[0].values,TFT_DURATION); await capture('completed'); await checkFraming('completed');
  await page.locator('[data-play]').click(); await page.waitForTimeout(200); await page.locator('[data-play]').click();
  assert.equal(await page.locator('[data-control="pattern"]').inputValue(),'0');
  assert.notEqual(await reading('Your result').innerText(),'Record complete','completed sample replays');
  for(const [key,[min,max,step]]of Object.entries(TFT_DOMAINS))for(const value of [...new Set([min,min+Math.round((max-min)/2/step)*step,max])]){
    await reset();expectedModel.reset();
    await edit(key,value);expectedModel.update({[key]:value});await compareCurrent();
    await page.locator('[data-step]').evaluate(b=>{b.click();b.click();});expectedModel.advance(2*TFT_FRAME*TFT.slow);
    controls.push({key,value,...await compareCurrent()});
    for(const control of expectedModel.controls)assert.equal(await page.locator(`[data-control="${control.key}"]`).locator('..').isVisible(),control.visibleWhen(expectedModel.getState().values),`${key}: appropriate control visibility`);
  }
  await preset(11);expectedModel.reset(lesson.tryIt[11].initialState);await edit('addressing',0);expectedModel.update({addressing:0});
  await page.locator('[data-step]').evaluate(b=>{for(let n=0;n<12;n++)b.click();});expectedModel.advance(TFT_DURATION);await compareCurrent();await capture('addressing-restored');
  for (let i = 0; i < await page.locator('[data-action]').count(); i++) {
    await preset(8); await page.locator('[data-action]').nth(i).click();
    actions.push({name: await page.locator('[data-action]').nth(i).innerText(), ...await laws(lesson.tryIt[8].values, lesson.tryIt[8].initialState.time, lesson.tryIt[8].initialState)});
    await capture(`action-${i}`); await checkFraming(`action-${i}`);
  }
  await reset(); await page.locator('[data-step]').evaluate(button => {for (let i = 0; i < 5; i++) button.click();}); await action('Inspect: connected screen'); await page.locator('[data-labels]').check();
  const parts = await page.locator('button[data-label-part]').evaluateAll(elements => elements.map(e => ({id: e.dataset.labelPart, name: e.innerText})));
  for (const part of parts) {
    await action('Inspect: connected screen');
    const diagram = {'optics-detail':'Inspect: polarization and liquid crystal','matrix-detail':'Inspect: row selection and storage','rgb-detail':'Inspect: RGB apertures','response-detail':'Inspect: response and polarity'}[part.id];
    if (diagram) await action(diagram);
    const button = page.locator(`button[data-label-part="${part.id}"]`); await button.click();
    assert.equal(await page.locator('.daily-part-detail h3').innerText(), part.name);
    assert.equal(await button.getAttribute('aria-pressed'), 'true'); selections.push(part);
  }
  assert(selections.length >= 6); await page.locator('[data-labels]').uncheck();
  for (const [id, name] of [['frame','Retaining frame'],['board','Timing and bias board'],['pixel-electrodes','TFT matrix and pixel electrodes']]) {
    await reset(); await focusPart(id); const hit = await hitPart(name); await page.mouse.click(...hit); assert.equal(await popup.innerText(), name); physicalHits.push(name); await capture(`popup-${id}`);
    if (id === 'frame') {
      const b = await canvas.boundingBox(); await page.mouse.move(b.x + 10, b.y + 10); const before = await canvas.screenshot();
      await page.mouse.move(...hit); await page.mouse.down(); await page.mouse.move(hit[0] + 35, hit[1] + 20, {steps: 10}); await page.mouse.up(); await page.mouse.move(b.x + 10, b.y + 10);
      assert(!before.equals(await canvas.screenshot()), 'dragging physical part translates object');
    }
    await page.locator('.daily-heading h1').click(); assert.equal(await popup.isVisible(), false); assert.equal(await page.locator('.daily-part-detail h3').count(), 0);
  }
  await reset(); await action('Inspect: connected screen'); await page.locator('[data-labels]').check(); await page.locator('button[data-label-part="frame"]').click(); await page.locator('.daily-heading h1').click();
  assert.equal(await page.locator('button[data-label-part="frame"]').getAttribute('aria-pressed'), 'false'); await page.locator('[data-labels]').uncheck();
  await action('Inspect: connected screen'); await canvas.scrollIntoViewIfNeeded(); let box = await canvas.boundingBox();
  await page.mouse.move(box.x + 15, box.y + 15); assert.equal(await popup.isVisible(), false); const beforeRotate = await canvas.screenshot();
  await page.mouse.down(); await page.mouse.move(box.x + 95, box.y + 55, {steps: 12}); await page.mouse.up(); assert(!beforeRotate.equals(await canvas.screenshot()), 'background drag rotates');
  await action('Inspect: connected screen'); const beforeZoom = await canvas.screenshot(); await page.locator('[data-view="in"]').click(); assert(!beforeZoom.equals(await canvas.screenshot())); assert.equal(await page.locator('[data-separation]').inputValue(), '0');
  await page.locator('[data-view="out"]').click(); assert.equal(await page.locator('[data-separation]').inputValue(), '0');
  await canvas.scrollIntoViewIfNeeded(); box = await canvas.boundingBox(); await page.mouse.move(box.x + 15, box.y + 15); await canvas.scrollIntoViewIfNeeded(); box = await canvas.boundingBox(); await page.mouse.move(box.x + 15, box.y + 15);
  const held = await page.locator('.daily-readings').innerText(); for (let i = 0; i < 8; i++) await page.mouse.wheel(0, 240);
  await page.waitForFunction(() => document.querySelector('[data-separation]').value === '100'); assert.equal(await page.locator('.daily-readings').innerText(), held); await capture('grouped-parts'); await checkFraming('grouped-parts');
  for (const name of ['Edge-lit backlight','Screen frame and reflector','Active-matrix liquid-crystal stack','Drive electronics and connections']) assert((await page.locator('.daily-inventory-labels').innerText()).includes(name));
  await hitPart('Retaining frame'); await capture('separated-board');
  await page.locator('[data-reassemble]').click(); await action('Inspect: connected screen');
  for (const view of ['Front', 'Side', 'Back', 'Top', 'Underneath', 'Angled']) {await page.getByRole('button', {name: view, exact: true}).click(); await capture(`view-${view.toLowerCase()}`); await checkFraming(`view-${view}`);}
  for (const width of [390, 320]) {
    await page.setViewportSize({width, height: width === 390 ? 844 : 568}); const tools = page.getByRole('navigation', {name: 'Lesson tools'});
    for (const [index, experiment] of lesson.tryIt.entries()) {
      await tools.getByRole('button', {name: 'Try it yourself', exact: true}).click(); await page.locator('[data-experiment]').nth(index).click(); await tools.getByRole('button', {name: 'Controls', exact: true}).click();
      await laws(experiment.values, experiment.initialState.time, experiment.initialState); await capture(`mobile-preset-${index}-${width}`); await checkFraming(`mobile-preset-${index}-${width}`);
    }
    await action('Inspect: connected screen'); await page.locator('[data-separation]').fill('100'); await capture(`mobile-separated-${width}`); await checkFraming(`mobile-separated-${width}`); await page.locator('[data-reassemble]').click();
    await focusPart('frame'); await hitPart('Retaining frame'); await capture(`mobile-board-${width}`);
    await action('Inspect: connected screen'); await capture(`mobile-${width}`); await page.screenshot({path: `${output}/mobile-page-${width}.png`}); assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
  }
  await page.setViewportSize({width: 390, height: 844}); await action('Inspect: connected screen');
  const session = await page.context().newCDPSession(page);
  async function pinch(from, to) {
    await canvas.scrollIntoViewIfNeeded(); const b = await canvas.boundingBox(), x = b.x + b.width / 2, y = b.y + b.height / 2, points = d => [{x: x - d, y, id: 0}, {x: x + d, y, id: 1}];
    await session.send('Input.dispatchTouchEvent', {type: 'touchStart', touchPoints: points(from)});
    for (let i = 1; i <= 12; i++) await session.send('Input.dispatchTouchEvent', {type: 'touchMove', touchPoints: points(from + (to - from) * i / 12)});
    await session.send('Input.dispatchTouchEvent', {type: 'touchEnd', touchPoints: []});
  }
  try {await pinch(120, 20); assert(Number(await page.locator('[data-separation]').inputValue()) > 0); await capture('mobile-pinch'); await pinch(20, 120); await page.waitForFunction(() => document.querySelector('[data-separation]').value === '0');} finally {await session.detach();}
  await page.setViewportSize({width: 1440, height: 1000});
  for (const [i] of lesson.quiz.options.entries()) {await page.locator('[data-answer]').nth(i).click(); assert.equal(await page.locator('.daily-answer').innerText(), (i === lesson.quiz.answer ? 'That’s right. ' : 'Try thinking through the parts again. ') + lesson.quiz.explanation);}
  await page.locator('.daily-return').click(); assert(!page.url().endsWith('#machine/lcd-screen')); assert.deepEqual(errors, []);
  const report = {passed: true, outcomes, controls, actions, selections, physicalHits, framing, pause: true, step: true, completion: true, replay: true, hoverClick: true, deselection: true, objectDrag: true, backgroundRotation: true, zoomOnlyButtons: true, wheelSeparation: true, pinch: true, mobileWidths: [390, 320], quiz: true, return: true, errors};
  await writeFile(`${output}/browser.json`, JSON.stringify(report, null, 2)); console.log(JSON.stringify({passed: true, presets: outcomes.length, controlValues: controls.length, actions: actions.length, parts: selections.length, physicalHits: physicalHits.length, framingChecks: framing.length, errors}));
} catch (error) {
  await writeFile(`${output}/failure.json`, JSON.stringify({message: error.message, errors, url: page.url(), body: await page.locator('body').innerText().catch(() => '')}, null, 2));
  await page.screenshot({path: `${output}/failure.png`}).catch(() => {}); throw error;
} finally {expectedModel.dispose(); await browser.close();}

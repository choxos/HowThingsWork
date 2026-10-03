import assert from 'node:assert/strict';
import {mkdir, writeFile} from 'node:fs/promises';
import {chromium} from 'playwright';
import {electricityTransmissionLesson as lesson} from './electricity-transmission-lesson.js';

const base = process.env.SITE_URL || 'http://127.0.0.1:4173/';
const output = process.env.EVIDENCE_DIR || 'documentation/electricity-transmission-browser';
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
  if (['loadResistance','lineResistance'].includes(key)) {await page.locator('[data-number="'+key+'"]').fill(String(next)); await page.keyboard.press('Tab');}
  else await page.locator('[data-control="' + key + '"]').selectOption(String(next));
}
async function snapshot(v, elapsed = 0) {
  const a=v.ratio,R=v.lineResistance,L=v.loadResistance,I=v.connected?12*a/(R+a*a*L):0;
  const sending=12*a,receiving=sending-R*I,service=receiving/a,load=v.connected?service:0;
  const Psource=12*a*I,Pheat=R*I*I,Pload=L*(a*I)**2,t=elapsed/1000,phase=100*Math.PI*t;
  const factor=t+Math.sin(2*phase)/(200*Math.PI),instant=2*Math.cos(phase)**2;
  for(const [label,expected] of Object.entries({'Sending RMS voltage':sending,'Receiving RMS voltage':receiving,'Available consumer RMS voltage':service,'Load RMS voltage':load}))near(await value(label),expected,.00051);
  for(const [label,expected] of Object.entries({'Total line RMS voltage drop':R*I,'Line RMS current':I,'Source RMS current':a*I,'Load RMS current':a*I,'Line instantaneous current':Math.SQRT2*I*Math.cos(phase),'Mean source power':Psource,'Mean line loss':Pheat,'Mean load power':Pload,'Instantaneous source power':instant*Psource,'Instantaneous line heating':instant*Pheat,'Instantaneous load power':instant*Pload,'Delivered load energy':Pload*factor*1000,'Line heat':Pheat*factor*1000,'Source work':Psource*factor*1000,'Sending core flux':Math.SQRT2*12*Math.sin(phase)/(100*Math.PI*4)*1000,'Receiving core flux':Math.SQRT2*receiving*Math.sin(phase)/(100*Math.PI*4*a)*1000}))near(await value(label),expected);
  if(v.connected)near(await value('Efficiency'),Pload/Psource*100,.0051);else assert.equal(await reading('Efficiency').innerText(),'No delivery');
  near(await value('Simulated time'),elapsed);
  assert.equal(await reading('Transformer ratios').innerText(),'Sending 4:'+4*a+' · receiving '+4*a+':4');
  assert.ok(!/NaN|undefined|Infinity/.test(await page.locator('.daily-readings').innerText()));
  return {ratio:a,connected:v.connected,lineResistance:R,loadResistance:L,lineCurrent:await value('Line RMS current'),loadVoltage:await value('Load RMS voltage'),meanLoadPower:await value('Mean load power'),loadEnergy:await value('Delivered load energy'),lineHeat:await value('Line heat'),sourceWork:await value('Source work')};
}
try {
  await page.goto(new URL('#machine/electricity-transmission', base).href);
  await page.getByRole('heading', {name: 'Electricity transmission', exact: true}).waitFor();
  await page.locator('[data-control="ratio"]').waitFor();
  assert.equal(await page.locator('[data-control]').count(), 4);
  assert.equal(await page.locator('[data-number]').count(), 2);
  const selector = await page.locator('[data-control="ratio"]').boundingBox(), scene = await canvas.boundingBox();
  assert.ok(selector.y < scene.y, 'transmission selector appears above scene');
  await snapshot(lesson.tryIt[0].values); await capture('opening');
  await page.screenshot({path: output + '/opening-page.png'});
  for (const [index, trial] of lesson.tryIt.entries()) {
    await preset(index);
    for (const [key, expected] of Object.entries(trial.values)) assert.equal(Number(await page.locator('[data-control="' + key + '"]').inputValue()), expected);
    await snapshot(trial.values);
    for (let step = 0; step < 16; step++) await page.locator('[data-step]').click();
    assert.equal(await page.locator('[data-play]').getAttribute('aria-pressed'), 'false');
    outcomes.push({title: trial.title, ...await snapshot(trial.values, 40)});
    assert.match(await reading('Your result').innerText(), !trial.values.connected ? /Consumer open/ : !trial.values.lineResistance ? /Ideal line/ : /Two-cycle result/);
    await capture('preset-' + index);
  }
  assert.ok(outcomes[2].lineHeat<outcomes[0].lineHeat&&outcomes[0].lineHeat<outcomes[1].lineHeat);
  assert.ok(outcomes[2].loadEnergy>outcomes[0].loadEnergy&&outcomes[0].loadEnergy>outcomes[1].loadEnergy);
  assert.ok(outcomes[5].meanLoadPower>outcomes[4].meanLoadPower&&outcomes[5].lineHeat<outcomes[4].lineHeat);
  assert.equal(outcomes[3].lineHeat,0);
  await preset(0); await page.locator('[data-play]').click(); await page.waitForTimeout(650); await page.locator('[data-play]').click();
  assert.ok(await value('Simulated time') > 0 && await value('Simulated time') < 40);
  const paused = await page.locator('.daily-readings').innerText(); await page.waitForTimeout(300);
  assert.equal(await page.locator('.daily-readings').innerText(), paused);
  await preset(0); for (let i = 0; i < 14; i++) await page.locator('[data-step]').click();
  await page.locator('[data-play]').click(); await page.waitForFunction(() => document.querySelector('[data-play]').getAttribute('aria-pressed') === 'false', null, {timeout: 60000});
  await snapshot(lesson.tryIt[0].values, 40); await page.locator('[data-result]').click(); await capture('result');
  await page.locator('[data-play]').click(); await page.waitForTimeout(300); await page.locator('[data-play]').click();
  assert.ok(await value('Simulated time') < 40 && await value('Delivered load energy') < 462.7042);
  for (const [key, options] of Object.entries({ratio: [1,3,6],lineResistance:[0,.5,1,1.5,2,2.5,3,3.5,4],loadResistance:[6,8,10,12,14,16,18,20,22,24],connected:[0,1]})) {
    for (const next of options) {await reset(); await edit(key, next); await snapshot({...lesson.tryIt[0].values, [key]: next}); controlCases.push({key, value: next});}
  }
  for (const [key, next] of [['ratio',6],['lineResistance',4],['loadResistance',24],['connected',0]]) {
    await reset(); await page.locator('[data-step]').click(); near(await value('Simulated time'), 2.5);
    await edit(key, next); await snapshot({...lesson.tryIt[0].values, [key]: next});
  }
  await reset(); const inspectState = await page.locator('.daily-readings').innerText();
  for(const [name,file] of [['Inspect the sending windings','sending-windings'],['Inspect both line conductors','line-conductors'],['Inspect the receiving circuit','receiving-circuit']]) {
    await page.getByRole('button',{name,exact:true}).click();
    assert.equal(await page.locator('.daily-readings').innerText(),inspectState);await capture(file);
  }
  for (const [name, angle] of [['Pause at peak core flux', 90], ['Pause at reversed line current', 180]]) {
    await page.locator('[data-play]').click(); await page.getByRole('button', {name, exact: true}).click();
    assert.equal(await page.locator('[data-play]').getAttribute('aria-pressed'), 'false'); near(await value('Electrical phase'), angle);
    await snapshot(lesson.tryIt[0].values, angle / 18); await capture('phase-' + angle);
  }
  await page.getByRole('button', {name: 'Restart the selected transmission run', exact: true}).click(); await snapshot(lesson.tryIt[0].values);
  await page.locator('[data-labels]').check(); await page.locator('button[data-label-part="receiving-primary"]').click(); await page.locator('[data-labels]').uncheck();
  await page.locator('[data-isolate]').check(); await canvas.scrollIntoViewIfNeeded();
  let box = await canvas.boundingBox(), hit; const popup = page.locator('.daily-part-popup');
  for (let iy = 4; iy <= 16 && !hit; iy++) for (let ix = 4; ix <= 16; ix++) {
    await page.mouse.move(box.x + box.width * ix / 20, box.y + box.height * iy / 20);
    if (await popup.isVisible() && await popup.innerText() === 'Receiving primary winding') {hit = [box.x + box.width * ix / 20, box.y + box.height * iy / 20]; break;}
  }
  assert.ok(hit); await page.mouse.click(...hit); assert.equal(await popup.innerText(), 'Receiving primary winding');
  await page.mouse.move(box.x + 10, box.y + 10); const beforeMove = await canvas.screenshot();
  await page.mouse.move(...hit); await page.mouse.down(); await page.mouse.move(hit[0] + 40, hit[1] + 25, {steps: 10}); await page.mouse.up();
  await page.mouse.move(box.x + 10, box.y + 10); assert.ok(!beforeMove.equals(await canvas.screenshot()));
  await page.locator('.daily-heading h1').click(); assert.equal(await popup.isVisible(), false); assert.equal(await page.locator('.daily-part-detail h3').count(), 0);
  await page.locator('[data-isolate]').uncheck(); await page.locator('[data-labels]').check(); await page.locator('button[data-label-part="receiving-secondary"]').click();
  await page.locator('.daily-heading h1').click(); assert.equal(await page.locator('button[data-label-part="receiving-secondary"]').getAttribute('aria-pressed'), 'false');
  await page.locator('[data-labels]').uncheck(); await page.locator('[data-view="reset"]').click();
  const beforeZoom = await canvas.screenshot(); await page.locator('[data-view="in"]').click(); assert.ok(!beforeZoom.equals(await canvas.screenshot()));
  assert.equal(await page.locator('[data-separation]').inputValue(), '0'); await page.locator('[data-view="out"]').click(); assert.equal(await page.locator('[data-separation]').inputValue(), '0');
  await canvas.scrollIntoViewIfNeeded(); box = await canvas.boundingBox(); await page.mouse.move(box.x + 20, box.y + 20);
  const beforeRotate = await canvas.screenshot(); await page.mouse.down(); await page.mouse.move(box.x + 110, box.y + 55, {steps: 12}); await page.mouse.up(); assert.ok(!beforeRotate.equals(await canvas.screenshot()));
  await page.locator('[data-view="reset"]').click(); await canvas.scrollIntoViewIfNeeded(); box = await canvas.boundingBox(); await page.mouse.move(box.x + 20, box.y + 20);
  const held = await page.locator('.daily-readings').innerText(); for (let i = 0; i < 8; i++) await page.mouse.wheel(0, 240);
  await page.waitForFunction(() => document.querySelector('[data-separation]').value === '100'); assert.equal(await page.locator('.daily-readings').innerText(), held);
  for (const name of ['Sending stage', 'Line and supports', 'Receiving stage and load']) assert.ok((await page.locator('.daily-inventory-labels').innerText()).includes(name));
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
  const report = {passed: true, outcomes, controlCases, sourceLineLoadBalance: true, coordinatedRatios: true, variableLineAndLoad: true, pause: true, completion: true, replay: true, checkpoints: true, hoverClick: true, deselection: true, objectDrag: true, backgroundRotation: true, zoomOnlyButtons: true, wheelSeparation: true, pinch: true, mobileWidths: [390, 320], quiz: true, returnToPlace: true, errors};
  await writeFile(output + '/browser.json', JSON.stringify(report, null, 2) + '\n'); console.log(JSON.stringify(report));
} finally {await browser.close();}

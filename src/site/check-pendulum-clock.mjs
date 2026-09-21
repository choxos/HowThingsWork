import assert from 'node:assert/strict';
import {mkdir, writeFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import {resolve} from 'node:path';
import {pendulumClockLesson} from './pendulum-clock-lessons.js';

export async function checkPendulumClock(page, {base = process.env.SITE_URL || 'http://127.0.0.1:5194/', output = process.env.EVIDENCE_DIR || 'documentation/clock-browser'} = {}) {
  await mkdir(output, {recursive: true});
  const errors = [], presets = [], actions = [];
  const onError = error => errors.push(error.message);
  page.on('pageerror', onError);
  const reading = label => page.locator('.daily-readings > div').filter({has: page.locator('dt', {hasText: new RegExp('^' + label + '$')})}).locator('dd');
  const tab = name => page.getByRole('tab', {name, exact: true}).click();
  const capture = name => page.locator('.daily-canvas-wrap').screenshot({path: output + '/' + name + '.png'});
  try {
    await page.setViewportSize({width: 1440, height: 1000});
    await page.goto(new URL('#machine/mechanical-clock', base).href);
    await page.getByRole('heading', {name: 'Mechanical clock', exact: true}).waitFor();
    await page.locator('canvas').waitFor();
    assert.equal(await reading('Your result').innerText(), 'Loses 2.02 s/day');
    await capture('whole-clock');
    await tab('Try it yourself');
    const expected = ['Loses 2.02 s/day','Loses 2.02 s/day','Loses 2.02 s/day','Loses 2.02 s/day','Loses 2.02 s/day','Loses 2.02 s/day','Gains 41.47 s/day','Gains 0.15 s/day','Loses 6.99 s/day','Loses 10.23 s/day','Loses 2.54 s/day','Gains 3.99 s/day','Loses 8.03 s/day','Gains 4.49 s/day','Stopped','Stopped'];
    assert.equal(await page.locator('[data-experiment]').count(), expected.length);
    for (const [i, trial] of pendulumClockLesson.tryIt.entries()) {
      await page.locator('[data-experiment]').nth(i).click();
      assert.equal(await reading('Your result').innerText(), expected[i], trial.title);
      for (const [key, value] of Object.entries(trial.values)) assert.equal(Number(await page.locator('[data-control="' + key + '"]').inputValue()), value, trial.title + ': ' + key);
      if (i === 1) assert.equal(await reading('Escapement').innerText(), 'Locked');
      if (i === 2 || i === 3) assert.equal(await reading('Escapement').innerText(), 'Impulse');
      if (i >= 14) {
        const before = await page.locator('.daily-readings').innerText();
        await tab('Controls');
        assert.equal(await page.locator('[data-play]').isDisabled(), true, 'Insufficient drive disables playback');
        assert.equal(await page.locator('[data-play]').getAttribute('aria-pressed'), 'false');
        await page.waitForTimeout(200);
        assert.equal(await page.locator('.daily-readings').innerText(), before);
        await tab('Try it yourself');
      }
      presets.push({title: trial.title, result: expected[i], passed: true});
    }
    await page.locator('[data-experiment]').first().click(); await tab('Controls');
    const count = await page.locator('[data-action]').count();
    for (let i = 0; i < count; i++) {
      await page.locator('[data-action]').nth(i).click();
      actions.push({label: await page.locator('[data-action]').nth(i).innerText(), part: await page.locator('.daily-part-detail h3').innerText()});
      await capture('action-' + i);
    }
    await tab('Try it yourself'); await page.locator('[data-experiment]').first().click(); await tab('Controls');
    await page.locator('[data-step]').click(); assert.equal(await reading('Dial').innerText(), '10:08:31');
    await page.locator('[data-play]').click(); await page.waitForTimeout(1200); await page.locator('[data-play]').click();
    const paused = await page.locator('.daily-readings').innerText(); await page.waitForTimeout(500);
    assert.equal(await page.locator('.daily-readings').innerText(), paused, 'Pause freezes all readings');
    await page.getByRole('button', {name: 'Reset experiment', exact: true}).click();
    await page.locator('[data-play]').click();
    await page.waitForFunction(() => document.querySelector('[data-play]').getAttribute('aria-pressed') === 'false', null, {timeout: 120000});
    assert.equal(await reading('Dial').innerText(), '10:09:30', 'One real minute completes sixty releases');
    await page.locator('[data-play]').click(); await page.waitForTimeout(250);
    assert.equal(await page.locator('[data-play]').getAttribute('aria-pressed'), 'true', 'Completion replays');
    assert.equal(await reading('Dial').innerText(), '10:08:30', 'Replay rewinds demo');
    await page.locator('[data-play]').click();
    await page.getByRole('button', {name: 'Inspect: clock movement', exact: true}).click();
    const canvas = page.locator('canvas');
    const beforeZoom = await canvas.screenshot(); await page.locator('[data-view="in"]').click();
    assert.equal(await page.locator('[data-separation]').inputValue(), '0');
    assert.ok(!beforeZoom.equals(await canvas.screenshot()), 'Plus changes camera');
    await page.locator('[data-view="out"]').click(); assert.equal(await page.locator('[data-separation]').inputValue(), '0');
    await canvas.scrollIntoViewIfNeeded(); const b = await canvas.boundingBox();
    await page.mouse.move(b.x + 20, b.y + 20); const beforeRotation = await canvas.screenshot();
    await page.mouse.down(); await page.mouse.move(b.x + 105, b.y + 50, {steps: 12}); await page.mouse.up();
    assert.ok(!beforeRotation.equals(await canvas.screenshot()), 'Outside drag rotates');
    await page.locator('[data-view="reset"]').click();
    await canvas.scrollIntoViewIfNeeded(); const c = await canvas.boundingBox();
    await page.mouse.move(c.x + 20, c.y + 20);
    for (let i = 0; i < 8; i++) await page.mouse.wheel(0, 240);
    await page.waitForFunction(() => document.querySelector('[data-separation]').value === '100');
    await capture('separated'); await page.locator('[data-reassemble]').click();
    await page.waitForFunction(() => document.querySelector('[data-separation]').value === '0');
    for (const viewport of [{width:390,height:844},{width:320,height:568}]) {
      await page.setViewportSize(viewport);
      const tools = page.getByRole('navigation', {name:'Lesson tools'});
      await tools.getByRole('button', {name:'Try it yourself',exact:true}).click();
      await page.locator('[data-experiment]').nth(8).click();
      assert.equal(await reading('Your result').innerText(), 'Loses 6.99 s/day');
      await tools.getByRole('button', {name:'Controls',exact:true}).click();
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
      await checkVisibleTemperatureChart(page);
      await page.screenshot({path:output + '/phone-' + viewport.width + '.png'});
    }
    const interactions = await checkClockInteractions(page, output);
    assert.deepEqual(errors, []);
    const report = {passed:true,base,presets,actions,pause:true,step:true,minuteCompletion:true,replay:true,zoomButtons:true,outsideDrag:true,wheelSeparation:true,mobileWidths:[390,320],mobileTemperatureChart:true,interactions,errors};
    await writeFile(output + '/browser.json', JSON.stringify(report,null,2) + '\n');
    return report;
  } finally { page.off('pageerror', onError); }
}

export async function checkVisibleTemperatureChart(page) {
  const canvas = page.locator('canvas');
  await canvas.scrollIntoViewIfNeeded();
  const box = await canvas.boundingBox();
  // The warm-steel marker remains on the chart after the Controls shortcut clears selection.
  await page.mouse.move(box.x + box.width * .84, box.y + box.height * .48);
  const popup = page.locator('.daily-part-popup');
  assert.equal(await popup.isVisible(),true,'Temperature chart remains drawn after changing tabs');
  assert.equal(await popup.innerText(),'Temperature comparison');
  await page.mouse.move(0,0);
}

export async function checkClockInteractions(page, output) {
  await page.setViewportSize({width:1440,height:1000});
  await page.locator('[data-labels]').uncheck();
  await page.getByRole('tab', {name:'Controls',exact:true}).click();
  await page.getByRole('button', {name:'Reset experiment',exact:true}).click();
  await page.getByRole('button', {name:'Inspect: bob and rating nut',exact:true}).click();
  const canvas = page.locator('canvas'), popup = page.locator('.daily-part-popup');
  await canvas.scrollIntoViewIfNeeded();
  const b = await canvas.boundingBox(), x = b.x + b.width / 2, y = b.y + b.height / 2;
  await page.mouse.move(x,y);
  assert.equal(await popup.isVisible(),true);
  assert.equal(await popup.innerText(),'Bob and rating nut');
  await page.mouse.click(x,y);
  assert.equal(await popup.isVisible(),true,'Click pins part name');
  await page.locator('.daily-heading h1').click();
  assert.equal(await popup.isVisible(),false,'Outside click dismisses popup');
  assert.equal(await page.locator('.daily-part-detail h3').count(),0,'Outside click clears selection');
  await page.getByRole('button', {name:'Inspect: bob and rating nut',exact:true}).click();
  await canvas.scrollIntoViewIfNeeded();
  const c = await canvas.boundingBox();
  await page.mouse.move(c.x+c.width/2,c.y+c.height/2);
  await page.mouse.down();
  await page.mouse.move(c.x+c.width/2+75,c.y+c.height/2+35,{steps:12});
  await page.mouse.up();
  await canvas.screenshot({path:output+'/drag-translated.png'});
  await canvas.focus();
  const beforeKey = await canvas.screenshot(); await page.keyboard.press('ArrowRight');
  assert.ok(!beforeKey.equals(await canvas.screenshot()),'Arrow key rotates');
  await page.keyboard.press('+'); await page.keyboard.press('-');
  assert.equal(await page.locator('[data-separation]').inputValue(),'0','Keyboard zoom does not separate');
  await page.keyboard.press('Escape'); assert.equal(await page.locator('.daily-part-detail h3').count(),0);
  await page.getByRole('tab', {name:'Try it yourself',exact:true}).click();
  await page.locator('[data-experiment]').first().click();
  await page.getByRole('tab', {name:'Controls',exact:true}).click();
  await page.locator('[data-cutaway]').uncheck();
  await page.locator('.daily-canvas-wrap').screenshot({path:output+'/exterior.png'});
  await page.locator('[data-cutaway]').check();
  await page.locator('.daily-canvas-wrap').screenshot({path:output+'/cutaway.png'});
  const controlResults = [];
  for (const [key,values] of Object.entries({length:[990,1000],temperature:[10,30],weight:[1,5],rod:[0,1,2],care:[0,1]})) {
    await page.getByRole('button', {name:'Reset experiment',exact:true}).click();
    for (const value of values) {
      const input = page.locator('[data-control="'+key+'"]');
      if (key==='rod'||key==='care') await input.selectOption(String(value));
      else {await page.locator('[data-number="'+key+'"]').fill(String(value));await page.keyboard.press('Tab');}
      assert.equal(Number(await input.inputValue()),value);
      assert.equal(await input.getAttribute('aria-valuetext'),String(value)+(key==='length'?' mm':key==='temperature'?' °C':key==='weight'?' kg':''));
      controlResults.push({key,value,readings:await page.locator('.daily-readings').innerText()});
    }
  }
  await page.getByRole('button', {name:'Reset experiment',exact:true}).click();
  await page.setViewportSize({width:390,height:844});
  await page.locator('[data-view="reset"]').click();
  const session = await page.context().newCDPSession(page);
  async function pinch(from,to) {
    await canvas.scrollIntoViewIfNeeded(); const box=await canvas.boundingBox(),x=box.x+box.width/2,y=box.y+box.height/2;
    const points = d => [{x:x-d,y,id:0},{x:x+d,y,id:1}];
    await session.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:points(from)});
    for(let i=1;i<=12;i++) await session.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:points(from+(to-from)*i/12)});
    await session.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
  }
  try {
    await pinch(120,20);assert.ok(Number(await page.locator('[data-separation]').inputValue())>0,'Pinch separates');
    await pinch(20,120);await page.waitForFunction(()=>document.querySelector('[data-separation]').value==='0');
    assert.equal(await page.locator('.daily-part-detail h3').count(),0,'Pinch does not select a part');
    assert.equal(await popup.isVisible(),false,'Pinch does not open popup');
    await page.locator('[data-labels]').check();
    const label=page.locator('button[data-label-part="barrel"]');await label.tap();
    assert.equal(await label.getAttribute('aria-pressed'),'true','First tap after pinch selects');
    await page.locator('.daily-heading h1').click();
    assert.equal(await label.getAttribute('aria-pressed'),'false','Outside click clears label selection');
    await page.locator('[data-labels]').uncheck();
  } finally {await session.detach();}
  return {hover:true,clickPopup:true,outsideClear:true,insideDragCaptured:true,keyboard:true,exterior:true,cutaway:true,controls:controlResults,pinch:true,touchLabel:true};
}

if (typeof process !== 'undefined' && process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const {chromium} = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
  const browser = await chromium.launch({headless:true});
  try {
    const page = await browser.newPage({viewport:{width:1440,height:1000},hasTouch:true});
    console.log(JSON.stringify(await checkPendulumClock(page)));
  } finally { await browser.close(); }
}

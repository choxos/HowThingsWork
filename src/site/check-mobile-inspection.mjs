import assert from 'node:assert/strict';
import {mkdir, writeFile} from 'node:fs/promises';
import {chromium} from 'playwright';

const base = process.env.SITE_URL || 'http://127.0.0.1:4173/';
const output = process.env.EVIDENCE_DIR || 'documentation/mobile-inspection-browser';
await mkdir(output, {recursive: true});
const browser = await chromium.launch({channel: 'chrome', headless: true});
const page = await browser.newPage({viewport: {width: 390, height: 844}, reducedMotion: 'reduce'});
const errors = [], cases = [];
page.on('pageerror', e => errors.push(e.message));
try {
  for (const route of ['quartz-clock', 'kinetic-quartz-watch', '3d-printer']) for (const width of [390, 320, 1440]) {
    await page.setViewportSize({width, height: width === 320 ? 568 : 1000});
    await page.goto(new URL('#machine/' + route, base).href); await page.locator('canvas').waitFor();
    await page.locator('[data-labels]').check();
    const part = page.locator('button[data-label-part]').nth(3), name = await part.innerText();
    await part.click(); await page.locator('[data-isolate]').check();
    assert.equal(await page.locator('.daily-part-detail h3').innerText(), name);
    for (const label of ['Controls', 'Try it yourself', 'How it works']) {
      if (width < 650) await page.getByRole('navigation', {name: 'Lesson tools'}).getByRole('button', {name: label, exact: true}).click();
      else await page.getByRole('tab', {name: label, exact: true}).click();
      assert.equal(await page.locator('[data-isolate]').isChecked(), true, `${route} ${width}: ${label} must preserve isolation`);
      assert.equal(await page.locator('.daily-part-detail h3').innerText(), name, 'Lesson navigation preserves selected part');
    }
    await page.locator('canvas').screenshot({path: `${output}/${route}-${width}.png`});
    await page.locator('.daily-heading h1').click();
    assert.equal(await page.locator('[data-isolate]').isChecked(), false, 'Outside click still clears isolation');
    assert.equal(await page.locator('.daily-part-detail h3').count(), 0, 'Outside click still clears selection');
    cases.push({route, width, part: name, tabsPreserveInspection: true, outsideDismissal: true});
  }
  assert.deepEqual(errors, []);
  await writeFile(`${output}/report.json`, JSON.stringify({passed: true, cases, errors}, null, 2));
  console.log(JSON.stringify({passed: true, cases: cases.length, errors}));
} catch (error) {
  await writeFile(`${output}/failure.json`, JSON.stringify({message: error.message, errors}, null, 2));
  await page.screenshot({path: `${output}/failure.png`}); throw error;
} finally {await browser.close();}

// Run against an already running app. Set PLAYWRIGHT_MODULE when Playwright is installed elsewhere.
// PLAYWRIGHT_MODULE=/path/to/playwright node scripts/browser-regressions.cjs http://127.0.0.1:5181
const assert = require('node:assert/strict');
const {chromium} = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const base = (process.argv[2] || 'http://127.0.0.1:5181').replace(/\/$/, '');

(async () => {
  const browser = await chromium.launch({headless: true});
  const errors = [];
  const deadline = setTimeout(() => {
    console.error('FAIL: browser regression exceeded three minutes');
    process.exitCode = 1;
    browser.close().catch(() => {});
  }, 180000);
  try {
    for (const reducedMotion of ['no-preference', 'reduce']) {
      const page = await browser.newPage({reducedMotion, viewport: {width: 1280, height: 720}});
      page.setDefaultTimeout(30000);
      page.setDefaultNavigationTimeout(30000);
      page.on('pageerror', error => errors.push(error.stack || error.message));
      await page.addInitScript(() => {
        const raf = window.requestAnimationFrame.bind(window);
        window.__earlyFrame = false;
        window.requestAnimationFrame = callback => raf(now => {
          if (!window.__earlyFrame) {
            window.__earlyFrame = true;
            callback(now - 1000); // Deterministically precede the scene clock's setup time.
          } else callback(now);
        });
      });
      console.log(`START: nuclear ${reducedMotion}`);
      await page.goto(`${base}/?clock-test=${reducedMotion}#/topic/nuclear-power`);
      await page.locator('canvas').waitFor();
      await page.waitForFunction(() => window.__earlyFrame);
      // By id, not by type: every studio has a second slider now, so a bare
      // range locator matches more than one and refuses to act on either.
      const slider = page.locator('#mechanism-value');
      await slider.focus();
      await page.keyboard.press('Home');
      await page.keyboard.press('End');
      const play = page.locator('.play');
      assert.equal(await play.getAttribute('aria-pressed'), reducedMotion === 'reduce' ? 'false' : 'true');
      await play.click();
      await play.click();
      assert.doesNotMatch(await page.locator('.readings').innerText(), /NaN|undefined/);
      assert.deepEqual(errors, [], `Nuclear studio errors (${reducedMotion})`);
      console.log(`PASS: nuclear ${reducedMotion}`);
      await page.close();
    }

    const page = await browser.newPage({reducedMotion: 'reduce', viewport: {width: 320, height: 568}});
    page.on('pageerror', error => errors.push(error.stack || error.message));
    console.log('START: 320px parts and details');
    page.setDefaultTimeout(30000);
    page.setDefaultNavigationTimeout(30000);
    await page.goto(`${base}/#/topic/levers`);
    await page.locator('canvas').waitFor();
    await page.getByRole('button', {name: 'Toggle parts', exact: true}).click();
    await page.locator('.part-row').last().click();
    await page.getByRole('button', {name: 'Isolate this part', exact: true}).click();
    await page.getByRole('button', {name: 'Toggle parts', exact: true}).click();
    await page.locator('.part-row').first().click();
    await page.waitForFunction(() => document.querySelector('.detail-panel').scrollTop === 0);
    const layout = await page.locator('.detail-panel').evaluate(panel => {
      const heading = panel.querySelector('h2').getBoundingClientRect();
      const rect = panel.getBoundingClientRect();
      return {headingTop: heading.top, headingBottom: heading.bottom, top: rect.top, bottom: rect.bottom,
        width: innerWidth, scrollWidth: document.documentElement.scrollWidth};
    });
    assert.ok(layout.headingTop >= layout.top && layout.headingBottom <= layout.bottom, 'New part heading must be visible');
    assert.equal(layout.scrollWidth, layout.width, 'Narrow layout must not overflow horizontally');
    await page.getByRole('button', {name: 'Close details', exact: true}).click();
    assert.equal(await page.locator('.detail-panel').count(), 0, 'Detail close button must be reachable');
    assert.deepEqual(errors, []);
    console.log('PASS: two nuclear loads with an early first frame, both motion preferences, controls, and 320px part selection/scroll.');
    // Every extra slider, worked hard. A control that throws while React is
    // rendering takes the whole studio down with it and leaves a blank page, and
    // one slow move is not enough to see it: the fault only shows when the state
    // updater runs after the event has gone back to the pool.
    for (const [topic, id, lo, hi, step] of [['electricity', 'volts', 3, 12, 1], ['light-and-images', 'focal', 40, 220, 5]]) {
      const page = await browser.newPage({viewport: {width: 1280, height: 900}});
      page.setDefaultTimeout(30000);
      const thrown = [];
      page.on('pageerror', error => thrown.push(error.message));
      await page.goto(`${base}/#/topic/${topic}`, {waitUntil: 'load'});
      await page.waitForSelector(`#mechanism-${id}`);
      let moves = 0;
      for (let pass = 0; pass < 2; pass += 1) {
        for (let v = lo; v <= hi; v += step) {
          await page.$eval(`#mechanism-${id}`, (el, val) => {
            Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set.call(el, String(val));
            el.dispatchEvent(new Event('input', {bubbles: true}));
            el.dispatchEvent(new Event('change', {bubbles: true}));
          }, v);
          moves += 1;
        }
      }
      assert.ok(moves > 10, `${topic}: the sweep did not run`);
      assert.equal(thrown.length, 0, `${topic}: moving ${id} threw ${thrown[0]}`);
      assert.ok(await page.$('canvas'), `${topic}: the studio went away while moving ${id}`);
      assert.ok(await page.$('.readings'), `${topic}: the readings went away while moving ${id}`);
      console.log(`PASS: ${moves} moves of the ${topic} ${id} slider, studio intact`);
      await page.close();
    }

    // The homepage vignettes are drawn inside a fixed box, and a moving part
    // that leaves it is simply clipped away: the reader sees an arrow with no
    // head, or nothing at all, and the page gives no sign anything is wrong.
    // Sample a whole turn of the motor and insist every drawn thing stays in.
    {
      const page = await browser.newPage({reducedMotion: 'no-preference', viewport: {width: 1280, height: 900}});
      page.setDefaultTimeout(30000);
      page.on('pageerror', error => errors.push(error.stack || error.message));
      await page.goto(`${base}/#/`, {waitUntil: 'load'});
      await page.waitForSelector('.v-motor-coil');
      let samples = 0;
      for (let i = 0; i < 24; i += 1) {
        const worst = await page.evaluate(() => {
          const svg = document.querySelector('.v-motor-coil').closest('svg');
          const frame = svg.getBoundingClientRect();
          let out = 0;
          let name = '';
          for (const node of svg.querySelectorAll('path, rect, circle')) {
            const style = getComputedStyle(node);
            if (style.opacity === '0' || style.visibility === 'hidden') continue;
            const box = node.getBoundingClientRect();
            if (box.width === 0 && box.height === 0) continue;
            const over = Math.max(frame.top - box.top, box.bottom - frame.bottom, frame.left - box.left, box.right - frame.right);
            if (over > out) { out = over; name = node.getAttribute('class') || node.tagName; }
          }
          return {out, name};
        });
        samples += 1;
        assert.ok(worst.out < 1, `motor vignette: ${worst.name} left the frame by ${worst.out.toFixed(1)}px`);
        await page.waitForTimeout(140);
      }
      assert.ok(samples === 24, 'motor vignette: the sweep did not run');
      console.log('PASS: motor vignette stays inside its frame through a whole turn');
      await page.close();
    }

  } finally {
    clearTimeout(deadline);
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });

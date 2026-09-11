// Drives every control of every implemented lesson and reports what does not work.
//
// The bespoke checks in src/site each know one machine deeply. This one knows
// nothing about any of them: it walks the catalog, opens every entry that has a
// lesson behind it, and works the controls the page actually renders. What it
// asserts is the part that is the same everywhere.
//
//   * opening the entry raises no page error and leaves a canvas on screen
//   * every slider, at its lowest, middle and highest setting, and every option
//     of every dropdown, changes the readings. A control that moves nothing is
//     the quiet failure this project keeps running into: the geometry turns
//     about an axis that changes no physical quantity, so the picture moves and
//     the numbers do not.
//   * every button can be pressed without throwing
//   * at 390px wide the page does not scroll sideways
//
// A control whose `enabledWhen` leaves it disabled is skipped, not failed.
//
// Usage: node scripts/check-controls.mjs [entry-id ...]
//   SITE_URL   where the site is served (default http://127.0.0.1:5175/)
//   ONLY_FIRST stop after this many entries, for a quick pass
import {writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import process from 'node:process';

const {chromium} = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const base = process.env.SITE_URL || 'http://127.0.0.1:5175/';
const root = new URL('../src/site/', import.meta.url);

const lessonModules = [
  ['electronic-lessons', 'electronicLessons'],
  ['daily-life-lessons', 'dailyLifeLessons'],
  ['kitchen-lessons', 'kitchenLessons'],
  ['time-lessons', 'timeLessons'],
  ['utility-lessons', 'utilityLessons'],
  ['safety-lessons', 'safetyLessons'],
  ['cleaning-lessons', 'cleaningLessons'],
  ['heating-lessons', 'heatingLessons'],
  ['study-lessons', 'studyLessons'],
  ['play-lessons', 'playLessons'],
];

const lessons = {};
for (const [file, name] of lessonModules) {
  const module = await import(new URL(`${file}.js`, root));
  Object.assign(lessons, module[name]);
}
const {houseComponents} = await import(new URL('house-components.js', root));
const {neighborhoodCatalog} = await import(new URL('catalog-data.js', root));

const wanted = process.argv.slice(2);
const entries = neighborhoodCatalog.entries
  .filter(entry => {
    const component = houseComponents[entry.name];
    return Boolean(component?.lesson || lessons[component?.machine || entry.name]);
  })
  .filter(entry => wanted.length === 0 || wanted.includes(entry.id));
const limit = Number(process.env.ONLY_FIRST || entries.length);

const browser = await chromium.launch({headless: true});
const page = await browser.newPage({viewport: {width: 1440, height: 1000}});
let pageErrors = [];
page.on('pageerror', error => pageErrors.push(error.message));

const readings = () =>
  page.evaluate(() => document.querySelector('.daily-readings')?.textContent ?? '');

const report = [];
let worked = 0;

for (const [index, entry] of entries.slice(0, limit).entries()) {
  const problems = [];
  pageErrors = [];
  const label = `${String(index + 1).padStart(3)}/${Math.min(limit, entries.length)}`;
  try {
    await page.goto(`${base}#machine/${entry.id}`, {waitUntil: 'load', timeout: 45000});
    await page.locator('.daily-canvas-wrap canvas, .machine-viewer canvas').first().waitFor({timeout: 30000});
  } catch (error) {
    report.push({id: entry.id, name: entry.name, problems: [`did not open: ${error.message.split('\n')[0]}`]});
    console.log(`${label} OPEN-FAIL ${entry.id}`);
    continue;
  }

  // Every control the page rendered, read back from the DOM rather than from
  // the model, so a control the model declares but never draws is caught too.
  const controls = await page.evaluate(() =>
    [...document.querySelectorAll('[data-control]')].map(element => ({
      key: element.dataset.control,
      tag: element.tagName.toLowerCase(),
      min: element.min,
      max: element.max,
      step: element.step,
      options: element.tagName.toLowerCase() === 'select' ? [...element.options].map(o => o.value) : null,
    })),
  );

  for (const control of controls) {
    const locator = page.locator(`[data-control="${control.key}"]`);
    if (await locator.isDisabled()) continue;
    const settings = control.options
      ? control.options
      : (() => {
          const min = Number(control.min);
          const max = Number(control.max);
          const step = Number(control.step) || (max - min) / 4;
          const middle = min + Math.round((max - min) / 2 / step) * step;
          return [...new Set([min, middle, max].map(String))];
        })();
    const seen = new Set();
    let moved = false;
    for (const setting of settings) {
      const before = await readings();
      try {
        // A dropdown is chosen, a slider is filled; fill throws on a select.
        if (control.options) await locator.selectOption(String(setting));
        else await locator.fill(String(setting));
      } catch (error) {
        problems.push(`${control.key}: could not be set to ${setting} (${error.message.split('\n')[0]})`);
        continue;
      }
      if (await locator.isDisabled()) continue;
      const after = await readings();
      seen.add(after);
      if (after !== before) moved = true;
    }
    // One setting means there was nothing to compare; more than one reading
    // means the control reached the numbers.
    if (settings.length > 1 && !moved && seen.size <= 1) {
      problems.push(`${control.key}: ${settings.length} settings (${settings.join(', ')}) all leave the readings unchanged`);
    }
  }

  // Every button the lesson page offers; pressing one must not throw.
  // `[data-experiment]` is the only path that reaches reset with a lesson's own
  // initial state, so a lesson carrying something that cannot be cloned throws
  // there and nowhere else. The part buttons rebuild themselves on every click,
  // so each one is found again by position rather than held onto.
  for (const selector of [
    '[data-view]',
    '[data-action]',
    '[data-result]',
    '[data-step]',
    '[data-experiment]',
    '[data-answer]',
    '.daily-part-buttons button',
  ]) {
    const count = await page.locator(selector).count();
    for (let position = 0; position < count; position += 1) {
      const button = page.locator(selector).nth(position);
      // Drilling into a part replaces the list below it, which is the control
      // working rather than failing.
      if ((await page.locator(selector).count()) <= position) break;
      if (!(await button.isVisible()) || (await button.isDisabled())) continue;
      try {
        await button.click({timeout: 10000});
      } catch (error) {
        problems.push(`${selector}: click ${position + 1} failed (${error.message.split('\n')[0]})`);
      }
    }
  }
  for (const selector of ['[data-cutaway]', '[data-labels]', '[data-isolate]']) {
    const box = page.locator(selector);
    if (!(await box.count()) || !(await box.isVisible()) || (await box.isDisabled())) continue;
    try {
      const was = await box.isChecked();
      await box.setChecked(!was, {timeout: 10000});
      await box.setChecked(was, {timeout: 10000});
    } catch (error) {
      problems.push(`${selector}: ${error.message.split('\n')[0]}`);
    }
  }
  const speed = page.locator('[data-speed]');
  if ((await speed.count()) && (await speed.isVisible())) {
    for (const option of await speed.locator('option').evaluateAll(nodes => nodes.map(n => n.value))) {
      try {
        await speed.selectOption(option, {timeout: 10000});
      } catch (error) {
        problems.push(`playback speed ${option}: ${error.message.split('\n')[0]}`);
      }
    }
  }
  const play = page.locator('[data-play]');
  if ((await play.count()) && (await play.isVisible())) {
    try {
      await play.click({timeout: 10000});
      await page.waitForTimeout(900);
      if ((await play.getAttribute('aria-pressed')) === 'true') await play.click({timeout: 10000});
    } catch (error) {
      problems.push(`play: ${error.message.split('\n')[0]}`);
    }
  }

  try {
    await page.setViewportSize({width: 390, height: 844});
    const spills = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1);
    if (spills) problems.push('the page scrolls sideways at 390px');
  } finally {
    await page.setViewportSize({width: 1440, height: 1000});
  }

  for (const message of pageErrors) problems.push(`page error: ${message}`);

  if (problems.length) {
    report.push({id: entry.id, name: entry.name, problems});
    console.log(`${label} FAIL ${entry.id}`);
    for (const problem of problems) console.log(`        ${problem}`);
  } else {
    worked += 1;
    console.log(`${label} ok   ${entry.id}`);
  }
}

await browser.close();
const out = fileURLToPath(new URL('../documentation/control-sweep.json', import.meta.url));
await writeFile(out, JSON.stringify({checked: Math.min(limit, entries.length), worked, report}, null, 1));
console.log(`\n${worked} of ${Math.min(limit, entries.length)} entries drove every control cleanly.`);
console.log(`Details: ${out}`);
if (report.length) process.exit(1);

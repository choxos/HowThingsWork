// Opens every built but unpublished item on the preview server and checks the
// page loads, every experiment runs without an error, playing changes the
// readings, a result part becomes available when the trial finishes, and the
// phone layout does not scroll sideways. Serial on purpose: one headless
// Chromium drawing these scenes already uses most of the machine.
//
// Start the preview server first:
//   VITE_PREVIEW_UNPUBLISHED=1 npx vite --port 5191 --strictPort --host 127.0.0.1
// Usage: node scripts/check-preview-items.mjs [id ...]
// Set SHOT_EVERY_EXPERIMENT=1 to keep a picture of the model after each experiment.
import {mkdir, writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {chromium} from 'playwright';
import {neighborhoodCatalog as drafts} from '../src/site/catalog-data.js';
import {previewEntryIds} from '../src/site/published-catalog.js';

const base = process.env.SITE_URL || 'http://127.0.0.1:5191/';
const only = process.argv.slice(2), ids = only.length ? only : previewEntryIds;
const out = new URL('../documentation/audit/build-2026-09-15/screens/', import.meta.url);
await mkdir(out, {recursive: true});
const shot = name => fileURLToPath(new URL(name, out));
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
const everyExperiment = process.env.SHOT_EVERY_EXPERIMENT === '1';

const browser = await chromium.launch({headless: true});
const failures = [], summary = [];
for (const id of ids) {
  const entry = drafts.entries.find(candidate => candidate.id === id);
  if (!entry) { failures.push(`${id}: not in the catalog`); continue; }
  const record = {id, errors: [], experiments: 0, readings: 0};
  for (const width of [1440, 390]) {
    const page = await browser.newPage({viewport: {width, height: width === 390 ? 844 : 1000}});
    page.setDefaultTimeout(20000);
    page.on('pageerror', error => record.errors.push(`${width}: ${error.message}`));
    page.on('console', message => { if (message.type() === 'error') record.errors.push(`${width} console: ${message.text().slice(0, 200)}`); });
    try {
      await page.goto(base + '#machine/' + id, {waitUntil: 'domcontentloaded'});
      await page.waitForFunction(name => document.querySelector('.daily-heading h1')?.textContent === name && document.querySelector('.daily-viewer canvas'), entry.name, {timeout: 60000});
      await wait(900);
      if (width === 390) {
        const overflow = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
        if (overflow > 1) failures.push(`${id}: ${overflow}px of sideways scroll at 390 wide`);
        await page.screenshot({path: shot(`${id}-390-page.jpg`), fullPage: true, type: 'jpeg', quality: 55});
      } else {
        await page.locator('.daily-viewer canvas').screenshot({path: shot(`${id}-1440-start.png`)});
        const readings = () => page.locator('.daily-readings').innerText();
        record.readings = await page.locator('.daily-readings>div').count();
        const tryTab = page.getByRole('tab', {name: 'Try it yourself', exact: true});
        const count = await page.locator('[data-experiment]').count();
        for (let i = 0; i < count; i++) {
          const before = record.errors.length;
          if (await tryTab.count()) await tryTab.click();
          await page.locator(`[data-experiment="${i}"]`).click();
          await wait(everyExperiment ? 1200 : 250);
          if (everyExperiment) await page.locator('.daily-viewer canvas').screenshot({path: shot(`${id}-1440-experiment-${i + 1}.png`)});
          if (record.errors.length > before) failures.push(`${id}: experiment ${i} raised an error`);
          record.experiments++;
        }
        const controlsTab = page.getByRole('tab', {name: 'Controls', exact: true});
        if (await controlsTab.count()) await controlsTab.click();
        const reset = page.locator('[data-reset-controls]');
        if (await reset.count()) await reset.first().click();
        await wait(300);
        const play = page.locator('[data-play]');
        if (await play.count()) {
          const start = await readings();
          await play.click();
          await wait(2500);
          await page.locator('.daily-viewer canvas').screenshot({path: shot(`${id}-1440-playing.png`)});
          if ((await readings()) === start) failures.push(`${id}: playing changed no reading`);
          if (await page.locator('[data-result]').count()) {
            await page.waitForFunction(() => document.querySelector('[data-play]')?.getAttribute('aria-pressed') === 'false', null, {timeout: 45000})
              .catch(() => failures.push(`${id}: playback never finished`));
            const result = page.locator('[data-result]');
            if (await result.isDisabled()) failures.push(`${id}: result part not available after playback`);
            else { await result.click(); await wait(1200); }
            await page.locator('.daily-viewer canvas').screenshot({path: shot(`${id}-1440-result.png`)});
          }
        }
        await page.screenshot({path: shot(`${id}-1440-page.jpg`), fullPage: true, type: 'jpeg', quality: 55});
      }
    } catch (error) {
      failures.push(`${id} at ${width}: ${error.message.split('\n')[0]}`);
    }
    await page.close();
  }
  if (record.errors.length) failures.push(`${id}: ${record.errors.length} page errors, first: ${record.errors[0]}`);
  summary.push(record);
  console.log(JSON.stringify(record));
}
await browser.close();
await writeFile(new URL('preview-sweep.json', out), JSON.stringify({base, ids, failures, summary}, null, 1));
if (failures.length) { console.error(failures.join('\n')); process.exit(1); }
console.log(`PASS preview sweep: ${ids.length} items`);

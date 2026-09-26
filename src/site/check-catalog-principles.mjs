import assert from 'node:assert/strict';
import {mkdir, writeFile} from 'node:fs/promises';
import {chromium} from 'playwright';
import {neighborhoodCatalog as catalog} from './published-catalog.js';
import {groupCatalogEntries} from './catalog-hierarchy.js';
import {houseComponents} from './house-components.js';

const base = process.env.SITE_URL || 'http://127.0.0.1:5193/';
const out = process.env.EVIDENCE_DIR || 'documentation/audit/evidence/catalog-principles-20260919';
await mkdir(out, {recursive: true});
const browser = await chromium.launch({headless: true});
const errors = [], filters = [], links = [], directories = [];
try {
  for (const width of [1440, 390]) {
    const page = await browser.newPage({viewport: {width, height: width === 390 ? 844 : 1000}});
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(base + '#list');
    await page.locator('#principle-filter').waitFor();
    assert.deepEqual(await page.locator('#principle-filter option').evaluateAll(nodes => nodes.map(node => node.value)), ['', ...catalog.principles.map(principle => principle.id)]);
    for (const principle of catalog.principles) {
      await page.locator('#principle-filter').selectOption(principle.id);
      const expected = groupCatalogEntries(catalog.entries, catalog.entries.filter(entry => entry.principles.includes(principle.id)));
      const actual = await page.locator('.catalog-table tbody tr').evaluateAll(rows => rows.map(row => ({
        id: row.querySelector('td > button').dataset.entry,
        components: [...row.querySelectorAll('.catalog-components button')].map(button => button.dataset.entry),
        principles: row.lastElementChild.textContent,
      })));
      assert.deepEqual(actual.map(row => [row.id, row.components]), expected.map(({entry, components}) => [entry.id, components.map(part => part.id)]));
      for (const row of actual) assert(row.principles.includes(principle.name), `${row.id}: show the matching principle even when a component matched`);
      assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${width}: no horizontal overflow`);
      filters.push({width, principle: principle.id, families: actual.length});
    }
    await page.locator('#principle-filter').selectOption('');
    const allFamilies = groupCatalogEntries(catalog.entries);
    assert.equal(await page.locator('.catalog-table tbody tr').count(), allFamilies.length);
    assert.equal(await page.locator('[data-part-link]').count(), 0);
    assert.deepEqual(await page.locator('.catalog-components button').evaluateAll(nodes => nodes.map(node => node.dataset.entry)), allFamilies.flatMap(family => family.components.map(entry => entry.id)));
    for (const child of allFamilies.flatMap(family => family.components)) {
      // An alternate name opens the page that holds it.
      const target = catalog.entries.find(entry => entry.id === (houseComponents[child.name]?.redirectTo || child.id));
      await page.locator(`.catalog-components button[data-entry="${child.id}"]`).click();
      // The page title; a selected part may carry the same name in its own heading.
      await page.getByRole('heading', {name: target.name, exact: true, level: 1}).waitFor();
      await page.locator('canvas').waitFor();
      assert.equal(new URL(page.url()).hash, '#machine/' + target.id);
      links.push({width, id: child.id});
      await page.goto(base + '#list');
      await page.locator('.catalog-table').waitFor();
    }
    for (const room of ['sewing-corner', 'doors-and-daily-life', 'measuring-and-time']) {
      await page.goto(base + '#room/' + room);
      await page.getByText('Browse every object', {exact: true}).click();
      assert.equal(await page.locator('[data-part-link]').count(), 0);
      const nested = await page.locator('.house-component-links a').evaluateAll(nodes => nodes.map(node => node.getAttribute('href').slice(9)));
      const allowed = new Set(allFamilies.flatMap(family => family.components.map(entry => entry.id)));
      assert(nested.every(id => allowed.has(id)), room + ': only components of the room\'s machines');
      directories.push({width, room, nested});
    }
    await page.goto(base + '#list');
    await page.locator('#principle-filter').selectOption('magnetism');
    await page.locator('#catalog-search').fill('fuse');
    assert.equal(await page.locator('.catalog-table tbody tr').count(), 0);
    await page.locator('#principle-filter').selectOption('electricity');
    assert.equal(await page.locator('.catalog-table tbody tr').count(), 1);
    // The third column is intentionally hidden on phones; filtering still applies.
    assert.match(await page.locator('.catalog-table tbody tr td:last-child').textContent(), /Electricity.*Exploiting heat/);
    assert.equal(await page.locator('.catalog-table tbody tr td:last-child').isVisible(), width > 650);
    await page.screenshot({path: `${out}/fuse-production-${width}.png`, fullPage: true});
    assert.equal(await page.locator('[data-part-link]').count(), 0);
    await page.locator('button[data-entry="fuse"]').click();
    await page.locator('[data-labels]').check();
    await page.getByRole('button', {name: 'Cartridge fuse', exact: true}).click();
    await page.waitForFunction(() => document.querySelector('.daily-heading h1')?.textContent === 'Fuse' && document.querySelector('.daily-part-detail h3')?.textContent === 'Cartridge fuse');
    await page.goto(base + '#list');
    await page.locator('#catalog-search').fill('heat');
    const heatRows = await page.locator('.catalog-table tbody tr > td > button').evaluateAll(buttons => buttons.map(button => button.dataset.entry));
    assert(heatRows.includes('fuse') && heatRows.includes('3d-printer'));
    await page.locator('#catalog-search').fill('this-does-not-match-any-lesson');
    assert.equal(await page.locator('.catalog-table tbody tr').count(), 0);
    assert(await page.locator('.no-results').isVisible());
    await page.close();
  }
  assert.deepEqual(errors, []);
  console.log(`Catalog browser: ${filters.length} principle/viewport cases, classification searches, all nested machine links, room directories and viewer part navigation pass.`);
} finally {
  await writeFile(out + '/browser.json', JSON.stringify({base, filters, links, directories, errors}, null, 2) + '\n');
  await browser.close();
}

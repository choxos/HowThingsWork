import assert from 'node:assert/strict';
import {writeFile, mkdir} from 'node:fs/promises';
import {chromium} from 'playwright';
import {hasCatalogPart, groupCatalogEntries, catalogMachineComponents} from './catalog-hierarchy.js';
import {houseComponents} from './house-components.js';
import {neighborhoodCatalog as drafts} from './catalog-data.js';
import {neighborhoodCatalog as catalog, publishedEntryIds} from './published-catalog.js';

const allowed = new Set(publishedEntryIds);
const canonical = entry => catalog.entries.find(candidate => candidate.id === (houseComponents[entry.name]?.redirectTo || entry.id));
const listed = new Set(groupCatalogEntries(catalog.entries).flatMap(({entry, components}) => [entry, ...catalogMachineComponents(components)]).map(entry => entry.id));
assert.equal(allowed.size, publishedEntryIds.length);
assert.deepEqual(new Set(catalog.entries.map(entry => entry.id)), allowed);
const names = new Set(catalog.entries.map(entry => entry.name));
for (const group of catalog.groups) {
  assert.ok(group.items.length);
  assert.ok(group.items.every(name => names.has(name)));
  assert.deepEqual(group.relatedStudies, []);
}
for (const place of catalog.places) {
  assert.ok(catalog.groups.some(group => group.place === place.id));
  assert.ok(place.featured.length && place.featured.every(name => names.has(name)));
}

const base = process.env.SITE_URL || 'http://127.0.0.1:4177/';
const browser = await chromium.launch({headless: true});
const page = await browser.newPage({viewport: {width: 1440, height: 1000}});
page.setDefaultTimeout(10000);
const errors = [], observations = [], navigation = [];
page.on('pageerror', error => errors.push(error.message));
const routes = new Set(['#neighborhood', '#list', ...publishedEntryIds.map(id => '#machine/' + id),
  ...catalog.places.map(place => '#place/' + place.id),
  ...catalog.groups.filter(group => group.place === 'home').map(group => '#room/' + group.room.toLowerCase().replace(/[^a-z0-9]+/g, '-'))]);
async function links() {
  const hrefs = await page.locator('a[href]').evaluateAll(nodes => nodes.map(node => node.getAttribute('href')));
  for (const href of hrefs) {
    if (href.startsWith('#')) {
      const [path, query=''] = href.split('?');
      assert.ok(routes.has(path), `Unpublished link: ${href}`);
      if(query){const part=new URLSearchParams(query).get('part');assert.ok(path.startsWith('#machine/')&&hasCatalogPart(path.slice(9),part), `Unknown part link: ${href}`);}
    }
    assert.ok(!/^(?:studies|experiments)\.html/.test(href), `Unpublished page: ${href}`);
  }
}
try {
  await page.goto(base + '#list');
  await page.waitForSelector('.catalog-table tbody tr');
  assert.deepEqual(new Set(await page.locator('[data-entry]').evaluateAll(nodes => nodes.map(node => node.dataset.entry))), listed);
  assert.equal(await page.locator('[data-part-link]').count(), 0, 'Ordinary parts stay inside viewers');
  await links();
  for (const entry of catalog.entries) {
    const target = canonical(entry);
    assert.ok(target && !houseComponents[target.name]?.redirectTo, entry.id + ': valid one-hop published target');
    await page.evaluate(id => {location.hash = 'machine/' + id;}, entry.id);
    await page.waitForFunction(expected => location.hash === '#machine/' + expected.id && document.querySelector('.daily-heading h1')?.textContent === expected.name && document.querySelector('.daily-viewer canvas'), target, {timeout: 45000});
    const presets = await page.locator('[data-experiment]').count();
    assert.ok(presets > 0, entry.name + ': no experiments');
    assert.equal(await page.locator('.daily-viewer canvas').count(), 1, entry.name);
    await links();
    observations.push({id: entry.id, target: target.id, presets});
  }
  const hidden = drafts.entries.filter(entry => !allowed.has(entry.id)).map(entry => '#machine/' + entry.id);
  const hiddenRooms=[...new Set(drafts.groups.filter(group=>group.place==='home').map(group=>'#room/'+group.room.toLowerCase().replace(/[^a-z0-9]+/g,'-')))].filter(route=>!routes.has(route));
  for (const route of [...hidden, '#assembly/front-door', ...hiddenRooms, ...drafts.places.filter(place=>!catalog.places.some(p=>p.id===place.id)).map(place=>'#place/'+place.id), '#/topic/levers', '#machine/unknown']) {
    await page.evaluate(hash => {location.hash = hash;}, route);
    await page.waitForFunction(() => location.hash === '#list' && document.querySelector('#catalog-search'));
    assert.equal(await page.locator('.daily-viewer').count(), 0, route);
  }
  for (const route of [...routes].filter(route => !route.startsWith('#machine/'))) {
    await page.evaluate(hash => {location.hash = hash;}, route);
    const heading = route === '#neighborhood' ? 'A little neighborhood. A world to discover.' :
      route === '#list' ? 'Explore the finished collection.' :
      route.startsWith('#place/') ? catalog.places.find(place => route === '#place/' + place.id).name :
      catalog.groups.find(group => route === '#room/' + group.room.toLowerCase().replace(/[^a-z0-9]+/g, '-')).room;
    await page.waitForFunction(expected => document.querySelector('h1')?.textContent.replace(/\s+/g, '') === expected.replace(/\s+/g, ''), heading, {timeout:45000});
    await links();
    navigation.push({route, heading: await page.locator('h1').innerText()});
  }
  assert.deepEqual(errors, []);
  const report = {base, acceptedRoutes: observations.length, catalogEntries: listed.size, hiddenRoutes: hidden.length, observations, navigation, errors};
  if (process.env.EVIDENCE_DIR) {
    await mkdir(process.env.EVIDENCE_DIR, {recursive: true});
    await writeFile(process.env.EVIDENCE_DIR + '/publication-browser.json', JSON.stringify(report, null, 2) + '\n');
  }
  console.log(JSON.stringify(report));
} finally {
  await browser.close();
}

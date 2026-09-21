import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
import {neighborhoodCatalog} from '../src/site/published-catalog.js';
import {groupCatalogEntries, catalogMachineComponents} from '../src/site/catalog-hierarchy.js';

const {chromium} = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const base = new URL(process.argv[2] || 'http://127.0.0.1:4175/');
const evidence = new URL('../documentation/audit/evidence/deployment/', import.meta.url);
await mkdir(evidence, {recursive:true});
const browser = await chromium.launch({headless:true});
const page = await browser.newPage({viewport:{width:1440,height:1000}});
const errors = [];
page.on('pageerror', error => errors.push(error.message));
page.on('console', message => {
  if (message.type() === 'error' && /Content Security Policy|Refused to/.test(message.text())) errors.push(message.text());
});
page.on('response', response => {
  if (new URL(response.url()).origin === base.origin && response.status() >= 400) errors.push(`${response.status()} ${response.url()}`);
});
const visit = path => page.goto(new URL(path, base).href, {waitUntil:'domcontentloaded', timeout:45000});
const ready = name => page.getByRole('heading',{name,exact:true}).waitFor();
const imageCheck = async () => {
  await page.waitForFunction(() => [...document.images].filter(img=>img.getBoundingClientRect().width>0).every(img=>img.complete&&img.naturalWidth>0), null, {timeout:60000});
};
try {
  await visit('/');
  await ready('A little neighborhood. A world to discover.');
  await imageCheck();
  await page.screenshot({path:new URL('neighborhood.png',evidence).pathname,fullPage:true});
  await page.getByRole('link',{name:'The house',exact:true}).click();
  await ready('The house');
  await imageCheck();
  await page.locator('.house-room-pin').first().waitFor();
  assert.equal(await page.locator('.house-room-pin').count(),new Set(neighborhoodCatalog.groups.filter(group=>group.place==='home').map(group=>group.room)).size);
  console.log('PASS root neighborhood, local images and house navigation');

  await page.getByRole('link',{name:'All machines & ideas',exact:true}).first().click();
  await page.getByRole('searchbox',{name:'Find a machine or idea'}).fill('Direct-current motor');
  assert.match(await page.locator('#catalog-app').textContent(),/Direct-current motor/);
  await visit('/#machine/sewing-machine');
  await ready('Sewing machine');
  await page.getByRole('button',{name:'Make one stitch',exact:true}).click();
  assert.match(await page.locator('.daily-readings').textContent(),/1 lockstitch · 3\.0 \/ 40 mm sewn/);
  assert.equal(await page.locator('canvas').count(),1);
  console.log('PASS catalog search and sewing control');

  await visit('/#machine/direct-current-motor');
  await ready('Direct-current motor');
  await page.getByRole('button',{name:'Run selected action',exact:true}).click();
  await page.waitForFunction(()=>document.querySelector('.daily-readings')?.textContent.includes('Running snapshot'),null,{timeout:30000});
  assert.match(await page.locator('.daily-readings').textContent(),/Shaft speed[1-9][\d.]* rpm/);
  await page.screenshot({path:new URL('motor.png',evidence).pathname,fullPage:true});
  await visit('/#machine/commutator');
  await ready('Commutator');
  assert.match(await page.locator('.daily-part-detail').textContent(),/Insulated split-ring commutator/);
  await page.getByRole('button',{name:'Advance one step',exact:true}).click();
  assert.match(await page.locator('.daily-readings').textContent(),/Brush pair/);
  await page.setViewportSize({width:390,height:844});
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
  await page.screenshot({path:new URL('mobile.png',evidence).pathname,fullPage:true});
  console.log('PASS powered motor result, component focus and mobile layout');

  await visit('/#/topic/levers');
  await page.waitForURL('**/#list');
  await page.locator('#catalog-search').waitFor();
  const listed = groupCatalogEntries(neighborhoodCatalog.entries).flatMap(({entry, components}) => [entry, ...catalogMachineComponents(components)]);
  assert.equal(await page.locator('[data-entry]').count(), listed.length);
  assert.equal(await page.locator('canvas').count(),0);
  for (const path of ['/studies.html','/experiments.html']) {
    const response = await page.request.get(new URL(path,base).href);
    if (response.ok()) {
      assert.ok((await response.text()).includes('id="catalog-app"'),path+' must serve the finished collection');
      await visit(path);
      await page.locator('#catalog-app h1').waitFor();
      assert.equal(await page.locator('#app').count(),0);
    } else assert.ok([404,410].includes(response.status()),path);
  }
  assert.deepEqual(errors,[]);
  console.log(`PASS retired study and experiment URLs, no script/CSP/HTTP errors: ${base.origin}`);

} finally {
  await browser.close();
}

import assert from 'node:assert/strict';
import {neighborhoodCatalog as catalog} from './published-catalog.js';
import {catalogMachineComponents, componentParentIds, groupCatalogEntries, hasCatalogPart} from './catalog-hierarchy.js';

const entries = catalog.entries;
const families = groupCatalogEntries(entries);
const listed = families.flatMap(({entry, components}) => [entry, ...components]);
assert.equal(listed.length, entries.length);
assert.equal(new Set(listed.map(entry => entry.id)).size, entries.length);
assert.deepEqual(new Set(listed.map(entry => entry.id)), new Set(entries.map(entry => entry.id)));
for (const [child, parent] of Object.entries(componentParentIds)) {
  assert(entries.some(entry => entry.id === child), `Unpublished child ${child}`);
  assert(entries.some(entry => entry.id === parent), `Unpublished parent ${parent}`);
  assert(!componentParentIds[parent], `Parent ${parent} must be a whole machine`);
  assert(families.find(family => family.entry.id === parent)?.components.some(entry => entry.id === child));
}
for (const id of ['direct-current-motor', 'universal-motor', 'stepper-motor', 'polarized-light', 'liquid-crystal-display', 'nail-clippers', 'tweezers']) {
  assert(families.some(family => family.entry.id === id), `${id} must remain a whole item`);
}
const searched = groupCatalogEntries(entries, entries.filter(entry => entry.name.toLowerCase().includes('bobbin')));
assert.deepEqual(searched.map(family => [family.entry.id, family.components.map(entry => entry.id)]), [['sewing-machine', ['bobbin-and-bobbin-thread']]]);
const sewing = groupCatalogEntries(entries, entries.filter(entry => entry.id === 'sewing-machine'));
assert.equal(sewing[0].components.length, 8);
assert.deepEqual(groupCatalogEntries(entries, []), []);
const childOnly = entries.filter(entry => entry.id === 'commutator');
assert.deepEqual(groupCatalogEntries(childOnly), [{entry: childOnly[0], components: []}]);
console.log(`Catalog hierarchy: ${entries.length} accepted lessons appear once in ${families.length} whole items; component and parent searches pass.`);

const principleIds = new Set(catalog.principles.map(principle => principle.id));
for (const entry of entries) {
  assert(entry.principles?.length, `${entry.id} must have a learning principle`);
  assert.equal(new Set(entry.principles).size, entry.principles.length);
  for (const id of entry.principles) assert(principleIds.has(id), `Unknown principle ${id} on ${entry.id}`);
}
const tags = id => entries.find(entry => entry.id === id).principles;
assert(tags('fuse').includes('electricity') && tags('fuse').includes('exploiting-heat'));
assert(!tags('fuse').includes('magnetism'), 'Fuse heating is not a magnetic release');
assert.deepEqual(tags('two-way-light-switch'), ['electricity']);
assert(tags('circuit-breaker').includes('magnetism'), 'Keep the modeled magnetic release discoverable');
assert(tags('electricity-meter').includes('magnetism'), 'Keep the induction meter discoverable');
assert(tags('heated-extrusion-nozzle').includes('exploiting-heat'));
assert(!tags('heated-extrusion-nozzle').includes('magnetism'));
assert.deepEqual(tags('stepper-motor'), ['magnetism']);
assert.deepEqual(tags('power-line-insulator'), ['electricity']);
const transmission = families.find(family => family.entry.id === 'electricity-transmission');
assert(transmission.components.some(entry => entry.id === 'power-line-insulator'));
assert(!catalogMachineComponents(transmission.components).some(entry => entry.id === 'power-line-insulator'), 'Passive insulation stays out of the smaller-machine list');
assert.deepEqual(tags('power-pylon'), ['forces-and-structures']);
assert(transmission.components.some(entry => entry.id === 'power-pylon'));
assert(!catalogMachineComponents(transmission.components).some(entry => entry.id === 'power-pylon'), 'Structural support stays out of the smaller-machine list');
assert(tags('3d-printer').includes('exploiting-heat') && tags('3d-printer').includes('screws'));
const springResults = groupCatalogEntries(entries, entries.filter(entry => entry.principles.includes('springs')));
assert(springResults.some(family => family.entry.id === 'cylinder-lock' && family.components.some(entry => entry.id === 'lock-return-springs')));
console.log(`Catalog principles: ${entries.length} valid tag sets, fuse/induction/heater/motor distinctions and grouped spring filtering pass.`);

// The list and the rooms show every lesson; the hierarchy only decides which machine each one sits beneath.
assert(hasCatalogPart('3d-printer', 'frame'), 'Ordinary part bookmarks remain valid');
console.log(`Catalog visibility: ${families.length} whole items with ${families.reduce((total, family) => total + catalogMachineComponents(family.components).length, 0)} smaller machines; ordinary parts stay inside viewers.`);

const clock = families.find(family => family.entry.id === 'mechanical-clock');
assert(catalogMachineComponents(clock.components).some(entry => entry.id === 'anchor-escapement'), 'Escapement is a smaller machine under its clock');
assert(families.some(family => family.entry.id === 'mechanical-watch'), 'Mechanical watch is a whole machine');
assert.deepEqual(tags('mechanical-watch'), ['gears-and-belts', 'springs']);
const watch = families.find(family => family.entry.id === 'mechanical-watch');
assert(catalogMachineComponents(watch.components).some(entry => entry.id === 'lever-escapement'), 'Detached lever is a smaller machine under its watch');
assert.deepEqual(tags('lever-escapement'), ['levers', 'gears-and-belts', 'springs']);
assert.deepEqual(groupCatalogEntries(entries, entries.filter(entry => entry.id === 'lever-escapement')).map(family => family.entry.id), ['mechanical-watch']);
assert(watch.components.some(entry => entry.id === 'hairspring'));
assert(!catalogMachineComponents(watch.components).some(entry => entry.id === 'hairspring'), 'Passive hairspring stays inside its watch family, outside the smaller-machine list');
assert.deepEqual(tags('hairspring'), ['springs']);
assert.deepEqual(groupCatalogEntries(entries, entries.filter(entry => entry.id === 'hairspring')).map(family => family.entry.id), ['mechanical-watch']);
const thermometer = families.find(family => family.entry.id === 'liquid-in-glass-thermometer');
assert(thermometer, 'Liquid-in-glass thermometer is a whole instrument');
assert.equal(catalogMachineComponents(thermometer.components).length, 0, 'Bulb, capillary and scale are not smaller machines');
assert.deepEqual(tags('liquid-in-glass-thermometer'), ['exploiting-heat']);

const maximumMinimum = families.find(family => family.entry.id === 'maximum-minimum-thermometer');
assert(maximumMinimum, 'Maximum-minimum thermometer is a whole instrument');
assert.equal(catalogMachineComponents(maximumMinimum.components).length, 0, 'Reservoirs, indices and reset magnet remain ordinary parts');
assert.deepEqual(tags('maximum-minimum-thermometer'), ['exploiting-heat']);

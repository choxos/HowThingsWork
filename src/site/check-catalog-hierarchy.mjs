import assert from 'node:assert/strict';
import {neighborhoodCatalog as catalog} from './published-catalog.js';
import {componentParentIds, groupCatalogEntries, catalogMachineComponents, hasCatalogPart} from './catalog-hierarchy.js';

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
assert(tags('3d-printer').includes('exploiting-heat') && tags('3d-printer').includes('screws'));
const springResults = groupCatalogEntries(entries, entries.filter(entry => entry.principles.includes('springs')));
assert(springResults.some(family => family.entry.id === 'cylinder-lock' && family.components.some(entry => entry.id === 'lock-return-springs')));
console.log(`Catalog principles: ${entries.length} valid tag sets, fuse/induction/heater/motor distinctions and grouped spring filtering pass.`);

const shownMachines = families.flatMap(family => catalogMachineComponents(family.components));
assert.deepEqual(shownMachines.map(entry => entry.id).sort(), ["cylinder-lock-cam-and-bolt","feed-dog-lift-and-advance-linkages","rotary-sewing-hook","thread-take-up-lever","window-shade-pawls-and-locking-disk","electric-bell-pushbutton-switch","commutator","heated-extrusion-nozzle","horizontal-seismograph-pendulum","vertical-seismograph-pendulum","seismograph-recording-pen-and-moving-paper","inertial-accelerometer-armature-spring-and-coils"].sort());
assert.equal(shownMachines.length, 12);
assert.deepEqual(catalogMachineComponents([{id: 'unknown-future-part'}]), []);
for (const id of ['keys','lock-return-springs','bobbin-and-bobbin-thread','printer-filament-reel','motor-rotor','scale-calibrating-plate','electric-motor','microchip-deceleration-sensor']) assert(!shownMachines.some(entry => entry.id === id), id + ' stays out of the catalog nesting');
assert(hasCatalogPart('3d-printer', 'frame'), 'Ordinary part bookmarks remain valid');
console.log('Catalog visibility: 48 whole items, 12 smaller machines; passive parts, aliases and future unreviewed parts excluded.');

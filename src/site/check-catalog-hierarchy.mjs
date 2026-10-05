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

const kineticWatch = families.find(family => family.entry.id === 'kinetic-quartz-watch');
assert(kineticWatch, 'Kinetic quartz watch is a whole machine');
assert.equal(catalogMachineComponents(kineticWatch.components).length, 0, 'Ordinary watch parts stay inside its viewer');
assert.deepEqual(tags('kinetic-quartz-watch'), ['electricity', 'magnetism', 'gears-and-belts']);

const quartzClock = families.find(family => family.entry.id === 'quartz-clock');
assert(quartzClock, 'Battery quartz clock is a whole machine, not a kinetic-watch component');
assert.deepEqual(catalogMachineComponents(quartzClock.components).map(entry => entry.id), ['quartz-oscillator'], 'Only the complete oscillator subsystem appears below its clock');
assert.deepEqual(tags('quartz-clock'), ['electricity', 'magnetism', 'gears-and-belts']);
assert.deepEqual(tags('quartz-oscillator'), ['electricity']);
const piezoelectricity = families.find(family => family.entry.id === 'piezoelectricity');
assert(piezoelectricity, 'Piezoelectricity is an independent idea, not a smaller clock machine');
assert.equal(catalogMachineComponents(piezoelectricity.components).length, 0);
assert.deepEqual(tags('piezoelectricity'), ['electricity']);
const waterClock = families.find(family => family.entry.id === 'water-clock');
assert(waterClock, 'Water clock is a whole machine');
assert.equal(catalogMachineComponents(waterClock.components).length, 0, 'Float, rack, pinion and vessels stay inside the clock viewer');
assert.deepEqual(tags('water-clock'), ['floating', 'pressure-power', 'gears-and-belts']);
const spinDryer = families.find(family => family.entry.id === 'spin-dryer');
assert(spinDryer, 'Spin dryer is a whole machine');
assert.equal(catalogMachineComponents(spinDryer.components).length, 0, 'Drum, fabric, shaft and supports remain ordinary inspectable parts');
assert.deepEqual(tags('spin-dryer'), ['rotating-wheels', 'pressure-power', 'springs']);
assert.equal(catalog.groups.find(group => group.id === 'spin-dryer').room, 'Laundry and cleaning');
assert.equal(catalog.groups.find(group => group.id === 'spin-dryer').place, 'home');
for (const id of ['vacuum-cleaner', 'upright-vacuum-cleaner', 'aerosol-spray-can', 'air-cleaner']) {
  assert(families.some(family => family.entry.id === id), `${id} is an accepted whole machine`);
}
const airCleaner = families.find(family => family.entry.id === 'air-cleaner');
assert.deepEqual(catalogMachineComponents(airCleaner.components).map(entry => entry.id), ['electrostatic-precipitator', 'ionizer', 'voltage-multiplier'], 'Only reviewed complete electrical subsystems are nested below the air cleaner');
assert.deepEqual(groupCatalogEntries(entries, entries.filter(entry => entry.id === 'electrostatic-precipitator')).map(family => family.entry.id), ['air-cleaner'], 'A component-only search preserves the parent cleaner');
assert.deepEqual(tags('electrostatic-precipitator'), ['electricity', 'pressure-power']);
assert.deepEqual(groupCatalogEntries(entries, entries.filter(entry => entry.id === 'ionizer')).map(family => family.entry.id), ['air-cleaner'], 'An ionizer-only search preserves its parent cleaner');
assert.deepEqual(tags('ionizer'), ['electricity', 'pressure-power']);
assert.deepEqual(groupCatalogEntries(entries, entries.filter(entry => entry.id === 'voltage-multiplier')).map(family => family.entry.id), ['air-cleaner'], 'A multiplier-only search preserves its parent cleaner');
assert.deepEqual(tags('voltage-multiplier'), ['electricity']);

const robotVacuum = families.find(family => family.entry.id === 'robot-vacuum-cleaner');
assert(robotVacuum, 'Robot vacuum is a whole machine');
assert.equal(catalogMachineComponents(robotVacuum.components).length, 0, 'Robot mechanisms remain inspectable parts, not separate catalog entries');
assert.deepEqual(tags('robot-vacuum-cleaner'), ['using-bits', 'sensors-and-detectors', 'rotating-wheels', 'pressure-power', 'electricity']);
assert.equal(catalog.groups.find(group => group.id === 'robot-vacuum-cleaner').room, 'Laundry and cleaning');
assert.equal(catalog.groups.find(group => group.id === 'robot-vacuum-cleaner').place, 'home');

const washingMachine = families.find(family => family.entry.id === 'washing-machine');
assert(washingMachine, 'Washing machine is a whole machine');
assert.equal(catalogMachineComponents(washingMachine.components).length, 0, 'Washer mechanisms remain inspectable parts, not separate catalog entries');
assert.deepEqual(tags('washing-machine'), ['rotating-wheels', 'exploiting-heat', 'pressure-power', 'springs', 'electricity']);
assert.equal(catalog.groups.find(group => group.id === 'washing-machine').room, 'Laundry and cleaning');
assert.equal(catalog.groups.find(group => group.id === 'washing-machine').place, 'home');

const frictionDriveToy = families.find(family => family.entry.id === 'friction-drive-toy');
assert(frictionDriveToy, 'Friction-drive toy is a whole machine');
assert.equal(catalogMachineComponents(frictionDriveToy.components).length, 0, 'Toy gears, wheels and shafts remain ordinary inspectable parts');
assert.deepEqual(tags('friction-drive-toy'), ['rotating-wheels', 'gears-and-belts', 'friction', 'wheel-and-axle']);
assert.equal(catalog.groups.find(group => group.id === 'friction-drive-toy').room, 'Play and everyday objects');
assert.equal(catalog.groups.find(group => group.id === 'friction-drive-toy').place, 'home');

const gamesController = families.find(family => family.entry.id === 'games-controller');
assert(gamesController, 'Games controller is a whole machine');
assert.deepEqual(catalogMachineComponents(gamesController.components).map(entry => entry.id), ['joystick'], 'The completed joystick is one smaller machine; ordinary parts remain inside viewers');
assert.deepEqual(tags('games-controller'), ['making-bits', 'using-bits', 'springs', 'rotating-wheels', 'electricity']);
assert.equal(catalog.groups.find(group => group.id === 'games-controller').room, 'Play and everyday objects');
assert.equal(catalog.groups.find(group => group.id === 'games-controller').place, 'home');
assert.deepEqual(tags('joystick'), ['making-bits', 'springs', 'electricity', 'levers']);
assert(!families.some(family => family.entry.id === 'joystick'), 'Joystick is nested under its complete controller');

const videoGamesConsole = families.find(family => family.entry.id === 'video-games-console');
assert(videoGamesConsole, 'Video games console is a whole computer, not a controller part');
assert.equal(catalogMachineComponents(videoGamesConsole.components).length, 0, 'Internal console parts remain inside its viewer');
assert.deepEqual(tags('video-games-console'), ['using-bits', 'electricity']);
assert.deepEqual(groupCatalogEntries(entries, entries.filter(entry => entry.id === 'video-games-console')).map(family => family.entry.id), ['video-games-console']);
const consoleGroup = catalog.groups.find(group => group.id === videoGamesConsole.entry.group);
assert.equal(consoleGroup.room, 'Play and everyday objects');
assert.equal(consoleGroup.place, 'home');

const headset = families.find(family => family.entry.id === 'virtual-reality-headset');
assert(headset, 'Virtual reality headset is a whole machine');
assert.equal(catalogMachineComponents(headset.components).length, 0, 'Ordinary headset parts remain inside its viewer');
assert.deepEqual(tags('virtual-reality-headset'), ['using-bits', 'light-and-images', 'sensors-and-detectors', 'sound-and-music', 'electricity']);
assert(headset.components.some(entry => entry.id === 'head-tracking'), 'Head tracking stays a study within the headset family');
assert(!families.some(family => family.entry.id === 'head-tracking'), 'Head tracking is not another whole headset');
assert.deepEqual(groupCatalogEntries(entries, entries.filter(entry => entry.id === 'head-tracking')).map(family => family.entry.id), ['virtual-reality-headset']);
assert.deepEqual(tags('head-tracking'), ['sensors-and-detectors', 'using-bits', 'electricity']);
const headsetGroup = catalog.groups.find(group => group.id === headset.entry.group);
assert.equal(headsetGroup.room, 'Play and everyday objects');
assert.equal(headsetGroup.place, 'home');

const unicycle = families.find(family => family.entry.id === 'unicycle');
assert(unicycle && unicycle.components.length === 0, 'Unicycle stays a whole item; ordinary parts stay in its viewer');
assert.deepEqual(tags('unicycle'), ['rotating-wheels', 'wheel-and-axle', 'levers', 'gears-and-belts']);
assert(hasCatalogPart('unicycle', 'cranks') && hasCatalogPart('unicycle', 'frame'), 'Unicycle part bookmarks remain available');

const stapler = families.find(family => family.entry.id === 'stapler');
assert(stapler && stapler.components.length === 0, 'Stapler remains one whole machine; its staples and springs stay inside its viewer');
assert.deepEqual(tags('stapler'), ['springs', 'levers', 'friction']);
assert(hasCatalogPart('stapler', 'strip') && hasCatalogPart('stapler', 'springs'), 'Stapler part bookmarks remain available');
assert.equal(catalog.groups.find(group => group.id === 'stapler').room, 'Study');
assert.equal(catalog.groups.find(group => group.id === 'stapler').place, 'home');

const ballpoint = families.find(family => family.entry.id === 'ballpoint-pen');
assert(ballpoint && ballpoint.components.length === 0, 'Ballpoint pen remains a whole item; ordinary parts stay in its viewer');
assert.deepEqual(tags('ballpoint-pen'), ['pressure-power', 'friction', 'rotating-wheels']);
assert(hasCatalogPart('ballpoint-pen', 'tip') && hasCatalogPart('ballpoint-pen', 'barrel'), 'Pen part bookmarks remain available');
assert.equal(catalog.groups.find(group => group.id === ballpoint.entry.group).room, 'Study');
assert.equal(catalog.groups.find(group => group.id === ballpoint.entry.group).place, 'home');

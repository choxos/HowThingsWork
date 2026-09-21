import catalogParts from './catalog-parts.json' with {type: 'json'};

// A catalog group can contain several whole machines. These entries identify
// components, close-up studies or alternate names for a published machine.
export const componentParentIds = {
  'refrigerant-compressor': 'refrigerator',
  'siphon': 'toilet-tank',
  'rotating-spray-arm': 'dishwasher',
  'scale-calibrating-plate': 'bathroom-scale',
  'lockstitch': 'sewing-machine',
  'feed-dog': 'sewing-machine',
  'bobbin-and-bobbin-thread': 'sewing-machine',
  'needle-and-needle-thread': 'sewing-machine',
  'rotary-sewing-hook': 'sewing-machine',
  'rotary-shuttle': 'sewing-machine',
  'thread-take-up-lever': 'sewing-machine',
  'feed-dog-lift-and-advance-linkages': 'sewing-machine',
  'keys': 'cylinder-lock',
  'cylinder-lock-cam-and-bolt': 'cylinder-lock',
  'lock-pin-stacks': 'cylinder-lock',
  'lock-return-springs': 'cylinder-lock',
  'lock-cylinder-plug': 'cylinder-lock',
  'lever-lock-return-springs': 'lever-lock',
  'lever-lock-tumblers-and-stumps': 'lever-lock',
  'lever-lock-bolt-and-bolt-pin': 'lever-lock',
  'lever-lock-key': 'lever-lock',
  'zipper-slide-wedges': 'zipper',
  'interlocking-zipper-teeth': 'zipper',
  'zipper-bottom-pin-and-box': 'zipper',
  'window-shade-pawls-and-locking-disk': 'window-shade',
  'window-shade-winding-spring': 'window-shade',
  'window-shade-roller-shaft-and-fixed-central-rod': 'window-shade',
  'armature': 'electric-bell',
  'electromagnetic-make-and-break-contacts': 'electric-bell',
  'electric-bell-pushbutton-switch': 'electric-bell',
  'electric-bell-hammer-and-metal-bell': 'electric-bell',
  'electric-bell-return-spring': 'electric-bell',
  'horn-make-and-break-contacts': 'electric-horn',
  'vibrating-horn-diaphragm': 'electric-horn',
  'electric-horn-moving-iron-bar': 'electric-horn',
  'electric-motor': 'direct-current-motor',
  'commutator': 'direct-current-motor',
  'motor-rotor': 'universal-motor',
  'heated-extrusion-nozzle': '3d-printer',
  'printer-filament-reel': '3d-printer',
  'layer-by-layer-fabrication': '3d-printer',
  'horizontal-seismograph-pendulum': 'seismograph',
  'vertical-seismograph-pendulum': 'seismograph',
  'vertical-seismograph-suspension-spring': 'seismograph',
  'seismograph-recording-pen-and-moving-paper': 'seismograph',
  'spark-plug-electrodes-and-ceramic-insulator': 'electronic-ignition',
  'inertial-accelerometer-armature-spring-and-coils': 'inertial-guidance',
  'microchip-deceleration-sensor': 'crash-sensor',
  'crash-sensor-proof-square-and-sensing-strips': 'crash-sensor',
};

// Pass the complete accepted inventory so a component-only search keeps its
// parent. A matching whole machine exposes all of its component lessons.
export function groupCatalogEntries(entries, matches = entries) {
  const byId = new Map(entries.map(entry => [entry.id, entry]));
  const families = new Map();
  for (const entry of entries) {
    const parent = byId.get(componentParentIds[entry.id]) || entry;
    if (!families.has(parent.id)) families.set(parent.id, {entry: parent, components: []});
    if (entry.id !== parent.id) families.get(parent.id).components.push(entry);
  }
  const matchingIds = new Set(matches.map(entry => entry.id));
  return [...families.values()].flatMap(family => {
    if (matchingIds.has(family.entry.id)) return [family];
    const components = family.components.filter(entry => matchingIds.has(entry.id));
    return components.length ? [{entry: family.entry, components}] : [];
  });
}

// Only complete mechanisms belong beneath catalog rows. Individual materials,
// geometry, passive parts, study topics, and alternate names remain in lessons.
const nestedMachineIds = new Set([
  "refrigerant-compressor",
  "siphon",
  "rotating-spray-arm",
  "cylinder-lock-cam-and-bolt",
  "feed-dog-lift-and-advance-linkages",
  "rotary-sewing-hook",
  "thread-take-up-lever",
  "window-shade-pawls-and-locking-disk",
  "electric-bell-pushbutton-switch",
  "commutator",
  "heated-extrusion-nozzle",
  "horizontal-seismograph-pendulum",
  "vertical-seismograph-pendulum",
  "seismograph-recording-pen-and-moving-paper",
  "inertial-accelerometer-armature-spring-and-coils"
]);
export const catalogMachineComponents = components => components.filter(entry => nestedMachineIds.has(entry.id));

// Part links stay inside an existing published lesson; they do not create new lessons.
export const partHref = (entryId, partId) => `#machine/${entryId}?part=${encodeURIComponent(partId)}`;
export function inspectableParts(entry, components = []) {
  const names = new Set(components.map(part => part.name.toLowerCase()));
  return (catalogParts[entry.id] || []).filter(part => !names.has(part.name.toLowerCase()));
}
export function hasCatalogPart(entryId, partId) {
  return (catalogParts[entryId] || []).some(part => part.id === partId);
}

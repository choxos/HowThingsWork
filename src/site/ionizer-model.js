import * as THREE from 'three';
import {createAirCleanerModel, roomPoint} from './air-cleaner-model.js';
import {sampleAirCleaner, ROOM} from './air-cleaner-physics.js';
import {MM, point} from './air-cleaner-geometry.js';
import {reading} from './house-model-kit.js';
import {lineObject, chartText} from './scene-kit.js';
import {fixed} from './format.js';

export function createIonizerModel() {
  const model = createAirCleanerModel(), geometry = model.topology;
  model.update({mode: 2});
  model.defaults.mode = 2;
  model.controls.splice(model.controls.findIndex(control => control.key === 'mode'), 1);
  const voltage = model.controls.find(control => control.key === 'voltage');
  voltage.primary = true;
  voltage.label = 'Needle high voltage';
  voltage.help = 'Energize the negative outlet needle. This fan-assisted comparison disables high voltage when the fan stops. Changing a setting starts a fresh, initially neutral room.';
  // The emitter belongs to the outlet, not to the absent collecting cartridge.
  geometry.fan.add(geometry.charger);
  model.parts.find(part => part.id === 'charger').parentId = 'fan';
  geometry.stage.visible = false;
  const absent = new Set(['stage', 'filter', 'collector', 'positive-plates', 'grounded-plates', 'size-chart']);
  for (let i = model.parts.length - 1; i >= 0; i--) if (absent.has(model.parts[i].id)) model.parts.splice(i, 1);
  for (const id of absent) delete model.partViewDirections[id];
  const describe = (id, name, description) => {
    const part = model.parts.find(part => part.id === id);
    Object.assign(part, {name, description}); part.object.name = name;
  };
  describe('charger', 'Negative ionizing needle', 'A sharp, negatively energized needle creates an ion-producing region near its tip. Some particles passing the outlet acquire negative charge. Ion motion and the local corona field are not drawn.');
  describe('fan', 'Fan-assisted ionizer outlet', 'The supported axial fan carries air past the negative needle. No collecting plate or fibrous cartridge is installed in this comparison. Many real ionizers do not use a fan.');
  describe('power', 'Needle supply and connection', 'The insulated supply feeds the negative outlet needle through the blue lead. Internal voltage conversion and the corona discharge are not solved here.');
  describe('particles', 'Single-pass particle cohort', 'Thirty-two enlarged markers pass through the cabinet once. Blue means negative charge acquired near the outlet. All leave the device; they do not represent the later charged and neutral populations in the whole room.');

  const chargeChart = new THREE.Group();
  chargeChart.position.copy(geometry.roomChart.position);
  chargeChart.name = 'Neutral and charged room particles';
  chargeChart.userData.inspectionOnly = 'charge-chart';
  chargeChart.userData.explosionExcluded = true;
  geometry.system.add(chargeChart);
  model.parts.push({id: 'charge-chart', name: chargeChart.name, description: 'Both curves are fractions of the original room particle population. Neutral plus charged equals the still-airborne fraction. Losing charge moves a particle between these populations without removing its mass.', object: chargeChart, parentId: 'system', framePadding: .58, maxZoom: 150});
  const panel = new THREE.Mesh(new THREE.BoxGeometry(...point([390, 340, 1])), new THREE.MeshBasicMaterial({color: 0xf8f5e9}));
  panel.position.set(...point([0, 0, -5])); chargeChart.add(panel);
  for (const endpoints of [[[0, 0], [3600, 0]], [[0, 0], [0, 1]]]) {
    const axis = lineObject(2, 0x374736, chargeChart);
    axis.geometry.attributes.position.array.set(endpoints.flatMap(([time, fraction]) => roomPoint(time, fraction)));
  }
  chartText(chargeChart, roomPoint, {title: 'Airborne charge states', size: 20 * MM,
    x: {min: 0, max: 3600, title: 'Time (minutes)', ticks: [[0, '0'], [1800, '30'], [3600, '60']]},
    y: {min: 0, max: 1, title: 'Original particles (%)', ticks: [[0, '0'], [.5, '50'], [1, '100']]},
    legend: [['Neutral', 0xc14f39], ['Negative charge', 0x2f6690]],
  });
  const neutralLine = lineObject(61, 0xc14f39, chargeChart), chargedLine = lineObject(61, 0x2f6690, chargeChart), chargeCursor = lineObject(2, 0x374736, chargeChart);
  const originalState = model.getState;
  let chartKey = '';
  const updateChart = () => {
    const state = originalState(), next = JSON.stringify(state.values);
    if (next !== chartKey) {
      chartKey = next;
      for (let i = 0; i <= 60; i++) {
        const sample = sampleAirCleaner(state.values, i * 60);
        neutralLine.geometry.attributes.position.array.set(roomPoint(i * 60, sample.neutral), i * 3);
        chargedLine.geometry.attributes.position.array.set(roomPoint(i * 60, sample.charged), i * 3);
      }
      for (const line of [neutralLine, chargedLine]) {line.geometry.attributes.position.needsUpdate = true; line.geometry.computeBoundingSphere();}
    }
    chargeCursor.geometry.attributes.position.array.set([...roomPoint(state.clock, 0), ...roomPoint(state.clock, 1)]);
    chargeCursor.geometry.attributes.position.needsUpdate = true;
  };
  const addReadings = readings => {
    const state = originalState(), pct = value => `${fixed(value * 100, 2)}%`;
    return [...readings.map(item => {
      if (item.label === 'Clean air delivery') return reading('Stored inside the device', pct(state.collected), 'No internal particle collector is installed. This is a retained-mass account, not a product CADR prediction. Room-surface deposition is counted separately.');
      if (item.label === 'Particle charging' && !state.enabled) return reading(item.label, item.value, 'Needle charging is off. The fresh room remains neutral; baseline ventilation and gravitational settling still act.');
      return item;
    }),
      reading('Airborne charge states', `${pct(state.neutral)} neutral + ${pct(state.charged)} charged`, 'Fractions of the original population. Their sum is the still-airborne fraction, not the fraction collected by the device.'),
      reading('Charge transfer now', `${fixed(state.rates.charging * state.neutral * 6000, 2)}%/min gain charge · ${fixed(state.rates.relaxation * state.charged * 6000, 2)}%/min lose charge`, 'Transfers between airborne populations, measured against the original particle count per minute. Charge relaxation uses an assigned 10-minute half-time and removes no particle mass.'),
      reading('Electrical deposition on room surfaces', pct(state.electricalDeposit), `An assigned ${ROOM.field} V/m effective surface-collecting field acts on charged particles. These particles leave room air, not through an internal collecting stage. Real room fields and deposition rates vary.`),
    ];
  };
  const requireIonizer = values => {
    if (values?.mode !== undefined && values.mode !== 2) throw new RangeError('The ionizer lesson requires its negative outlet needle.');
  };
  for (const method of ['update', 'reset', 'advance']) {
    const run = model[method];
    model[method] = (...args) => {
      if (method === 'update') requireIonizer(args[0]);
      if (method === 'reset') requireIonizer(args[0]?.settings);
      const readings = run(...args); updateChart(); return addReadings(readings);
    };
  }
  model.getState = () => {const state = originalState(); return {...state, readings: addReadings(state.readings)};};
  const inspect = (label, part, isolate = false) => ({label, part, isolate, view: 'front', replay: false, run: () => model.update()});
  model.actions = [
    inspect('Inspect: fan and ionizer outlet', 'fan'),
    inspect('Inspect: negative needle', 'charger', true),
    inspect('Inspect: needle supply', 'power'),
    inspect('Inspect: fan motor', 'motor', true),
    inspect('Inspect: open inlet', 'prefilter'),
    inspect('See the complete comparison device', 'system'),
    inspect('Compare neutral and charged particles', 'charge-chart', true),
    inspect('Compare room removal with baseline', 'charts', true),
  ];
  model.playback.advance = model.advance;
  model.playback.step = () => model.advance(300 / ROOM.speed);
  model.initialPart = model.autoFramePart = 'fan';
  model.partViewDirections['charge-chart'] = {front: [0, 0, 3]};
  model.thumbnailOmit.push(chargeChart);
  Object.assign(geometry, {chargeChart, neutralLine, chargedLine, chargeCursor});
  model.reset();
  return model;
}

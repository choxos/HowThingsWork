import {createAirCleanerModel} from './air-cleaner-model.js';
import {PRECIPITATOR as P, ROOM} from './air-cleaner-physics.js';
import {reading} from './house-model-kit.js';
import {fixed} from './format.js';

// The same validated cell, airflow and particle paths as the parent cleaner.
// This component keeps the cell installed and exposes its two distinct stages.
export function createElectrostaticPrecipitatorModel() {
  const model = createAirCleanerModel();
  model.controls.splice(model.controls.findIndex(control => control.key === 'mode'), 1);
  model.parts.splice(model.parts.findIndex(part => part.id === 'filter'), 1);
  const voltage = model.controls.find(control => control.key === 'voltage');
  voltage.primary = true;
  voltage.help = 'Power the positive charging wires and deflecting plates. The gray collecting plates remain grounded. Fan off disables high voltage in this teaching comparison.';
  const describe = (id, name, description) => {
    const part = model.parts.find(part => part.id === id);
    Object.assign(part, {name, description}); part.object.name = name;
  };
  describe('stage', 'Two-stage electrostatic precipitator', 'The positive charging grid comes first. The collecting stack follows: positive plates deflect charged particles toward the grounded plates. Both stages remain installed throughout this lesson.');
  describe('charger', 'Positive charging grid', 'Positive ions produced near the energized wires transfer charge to passing particles. Twelve open channels carry air through this 25 mm charging zone. Ion motion and the local corona are not drawn.');
  describe('power', 'High-voltage supply and connections', 'An insulated supply connects positive outputs to the charging wires and deflecting plates. Ground returns connect the charging-grid return plates and the gray collecting plates. Internal voltage conversion is outside this close-up.');
  describe('particles', 'Single-pass particle cohort', 'Thirty-two enlarged markers trace one passage. Gold indicates positive charge. Captured markers stay on gray plates; returned markers leave once. The small visible cohort illustrates paths and does not estimate exact clean air delivery.');
  describe('size-chart', 'Single-pass capture by size', 'The calculated share retained by the electrostatic cell at the selected airflow and voltage, averaged over the assigned charge distribution and entry positions. This curve does not describe a tested product.');
  const originalState = model.getState;
  const addReadings = readings => {
    const state = originalState();
    return [...readings.map(item => item.label === 'Particle charging' && !state.enabled ? reading(item.label, item.value, 'No electrical charging in the unpowered cell. Air can still pass if the fan is running.') : item),
      reading('Time in charging grid', state.Q ? `${fixed(P.zone / state.chargeU * 1000, 2)} ms` : 'No passage', `${fixed(state.chargeU, 4)} m/s through 0.05808 m² of clear grid area. Charging exposure and collection time use different cross-sections.`),
      reading('Time between collecting plates', state.Q ? `${fixed(P.length / state.U * 1000, 2)} ms` : 'No passage', `${fixed(state.U, 4)} m/s through 0.0528 m² of clear collecting area. A particle must reach a gray plate before leaving its 100 mm channel.`),
      reading('Collecting electric field', `${fixed(state.enabled ? P.plateVoltage / P.gap / 1000 : 0, 0)} kV/m`, 'With high voltage on, the ideal interior field is 3 kV divided by the 6 mm gap. It points from each gold plate toward the neighboring gray plates; edge fields are not resolved.'),
    ];
  };
  const requireCell = values => {
    if (values?.mode !== undefined && values.mode !== 1) throw new RangeError('The precipitator lesson requires its electrostatic cell.');
  };
  for (const method of ['update', 'reset', 'advance']) {
    const run = model[method];
    model[method] = (...args) => {
      if (method === 'update') requireCell(args[0]);
      if (method === 'reset') requireCell(args[0]?.settings);
      return addReadings(run(...args));
    };
  }
  model.getState = () => {const state = originalState(); return {...state, readings: addReadings(state.readings)};};
  const inspect = (label, part, isolate = false) => ({label, part, isolate, view: 'front', replay: false, run: () => model.update()});
  model.actions = [
    inspect('Inspect: both electrical stages', 'stage'),
    inspect('Inspect: positive charging grid', 'charger', true),
    inspect('Inspect: collecting channels', 'collector'),
    inspect('Inspect: positive deflecting plates', 'positive-plates', true),
    inspect('Inspect: grounded collecting plates', 'grounded-plates', true),
    inspect('Inspect: supply and returns', 'power'),
    inspect('See the cell inside the cleaner', 'system'),
    inspect('Compare capture by particle size', 'size-chart', true),
    inspect('Compare the room over one hour', 'charts', true),
  ];
  model.playback.advance = model.advance;
  model.playback.step = () => model.advance(300 / ROOM.speed);
  model.initialPart = model.autoFramePart = 'stage';
  return model;
}

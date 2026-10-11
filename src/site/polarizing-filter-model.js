import {createPolarizedLightModel} from './polarized-light-model.js';
import {polarizedControlEnabled} from './polarized-light-optics.js';

export function createPolarizingFilterModel() {
  const model = createPolarizedLightModel();
  const keys = ['power', 'input', 'inputAngle', 'first', 'analyzer', 'middle', 'insert', 'magnetic'];
  // Keep the shared update loop on the same array so hidden glare settings cannot change this bench.
  model.controls.splice(0, model.controls.length, ...model.controls.filter(control => keys.includes(control.key)));
  for (const control of model.controls) {
    control.enabledWhen = control.visibleWhen = values => polarizedControlEnabled(control.key, {...values, mode: 0});
    if (control.key === 'analyzer') {
      control.label = 'Final analyzer axis';
      control.help = 'Zero is vertical. Power depends on the angle from the preceding filter axis.';
    }
    if (control.key === 'insert') control.initial = 1;
  }
  model.defaults.insert = 1;
  model.parts = model.parts.filter(part => ['system', 'train', 'first', 'middle', 'analyzer', 'source', 'result', 'meter'].includes(part.id));
  model.catalogParts = model.parts.filter(part => part.parentId === 'train');
  const system = model.parts.find(part => part.id === 'system');
  system.name = 'Polarizing filter bench';
  system.description = 'Follow the source through each transmission axis to the detector and power comparison.';
  model.initialPart = model.autoFramePart = 'train';
  for (const action of model.actions) action.part = 'train';
  model.reset();
  return model;
}

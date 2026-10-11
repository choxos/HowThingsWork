import {createPolarizedLightModel} from './polarized-light-model.js';
import {polarizedControlEnabled} from './polarized-light-optics.js';

export const SUNGLASSES_DEFAULTS = {power: 100, analyzer: 0, incidence: 55, brewster: 1, material: 0, glasses: 1, magnetic: 0};

export function createPolarizingSunglassesModel() {
  const model = createPolarizedLightModel();
  // Set the private shared state before removing the mode control from its update loop.
  model.update({mode: 1, ...SUNGLASSES_DEFAULTS});
  Object.assign(model.defaults, {mode: 1, ...SUNGLASSES_DEFAULTS});
  model.controls.splice(0, model.controls.length, ...model.controls.filter(control => Object.hasOwn(SUNGLASSES_DEFAULTS, control.key)));
  for (const control of model.controls) {
    control.initial = SUNGLASSES_DEFAULTS[control.key];
    control.enabledWhen = control.visibleWhen = values => polarizedControlEnabled(control.key, {...values, mode: 1});
    if (control.key === 'analyzer') {
      control.label = 'Sunglasses transmission axis';
      control.help = 'Zero selects the p direction in the incidence plane, perpendicular to the reflected ray. At 90 degrees the axis selects horizontal s polarization.';
    }
  }
  model.parts = model.parts.filter(part => ['system', 'glare', 'surface', 'glare-source', 'glasses', 'eye', 'glare-result'].includes(part.id));
  model.catalogParts = model.parts.filter(part => part.parentId === 'glare');
  const system = model.parts.find(part => part.id === 'system');
  system.name = 'Polarizing sunglasses bench';
  system.description = 'Follow unpolarized light to the surface, through the glasses, and into the observer and power comparison.';
  model.initialPart = model.autoFramePart = 'glare';
  for (const action of model.actions) action.part = 'glare';
  model.playback.label = 'Trace reflected glare';
  model.playback.description = 'Long arrows trace the incident, reflected, refracted, and filtered rays. Short transverse red p and green s arrows show separate incoherent electric-field contributions. Optional short blue cB arrows show magnetic-field directions. Eight seconds illustrate construction, not light travel time.';
  model.reset();
  return model;
}

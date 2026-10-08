import {validateControls, validTime, clamp} from './physics-kit.js';

export const WET_CELL = Object.freeze({width: 1.3, length: 1.5, film: .03, waterHeight: .44, maxOpen: .8, seconds: 1.6, segments: 24});
export const WET_DEFAULTS = Object.freeze({red: 2, green: 0, blue: 0, power: 1, light: 1});
export const WET_DOMAINS = Object.freeze({red: [0, 2, 1], green: [0, 2, 1], blue: [0, 2, 1], power: [0, 1, 1], light: [0, 1, 1]});
export const WET_CHANNELS = Object.freeze(['red', 'green', 'blue']);
const EPS = 1e-10;
const rounded = value => Math.round(value * 1e12) / 1e12;
const smooth = value => value * value * (3 - 2 * value);
export const wetSettings = (input = {}) => validateControls(input, WET_DEFAULTS, WET_DOMAINS, 'electrowetting');

export function wetOpenings(input) {
  if (!Array.isArray(input) || input.length !== 3 || input.some(value => !Number.isFinite(value) || value < 0 || value > WET_CELL.maxOpen)) throw new RangeError('Expected three electrowetting openings from 0 to 0.8');
  return [...input];
}

/** A volume-preserving side profile, not a contact-angle or fluid-dynamics solution.
 * A flat film becomes a side bead with a rounded front. The complementary water
 * fills the fixed space above it. All dimensions are enlarged scene units. */
export function wetProfile(opening) {
  wetOpenings([opening, 0, 0]);
  const {width, length, film, waterHeight, maxOpen, segments} = WET_CELL;
  const footprint = width * (1 - opening), front = -width / 2 + footprint;
  const curved = footprint * .85 * opening / maxOpen;
  const unit = [[-width / 2, 1], [front - curved, 1]];
  for (let i = 1; i <= segments; i++) {const u = i / segments;unit.push([front - curved + curved * u, 1 - u * u]);}
  let section = 0;
  for (let i = 1; i < unit.length; i++) section += (unit[i][0] - unit[i - 1][0]) * (unit[i][1] + unit[i - 1][1]) / 2;
  const oilVolume = width * length * film, height = oilVolume / (section * length);
  const oil = unit.map(([x, z]) => [x, z * height]), water = [...oil.map(point => [...point]), [width / 2, 0]];
  return {oil, water, front, footprint, height, oilVolume, waterVolume: width * length * waterHeight - oilVolume};
}

/** Ideal relative RGB, read only from current open areas and incident light.
 * It is neither a reflectance measurement nor a calibrated color prediction. */
export function wetColor(openings, light = 1) {
  const open = wetOpenings(openings);
  if (light !== 0 && light !== 1) throw new RangeError('Expected light off or on');
  const rgb = open.map(value => value / WET_CELL.maxOpen * light);
  const top = Math.max(...rgb), relative = top > EPS ? rgb.map(value => value / top) : [0, 0, 0];
  const [r, g, b] = relative, near = (a, v) => Math.abs(a - v) < 1e-7;
  let name = 'Mixed color';
  if (top <= EPS) name = light ? 'Dark' : 'No incident light';
  else if (near(r, g) && near(g, b)) name = 'White';
  else if (near(r, 1) && near(g, 0) && near(b, 0)) name = 'Red';
  else if (near(r, 0) && near(g, 1) && near(b, 0)) name = 'Green';
  else if (near(r, 0) && near(g, 0) && near(b, 1)) name = 'Blue';
  else if (near(r, 1) && near(g, 1) && near(b, 0)) name = 'Yellow';
  else if (near(r, 1) && near(g, 0) && near(b, 1)) name = 'Magenta';
  else if (near(r, 0) && near(g, 1) && near(b, 1)) name = 'Cyan';
  else if (near(r, 1) && near(g, .5) && near(b, 0)) name = 'Orange';
  return {rgb, name};
}

export function wetPlan(input = {}, openings = [0, 0, 0]) {
  const values = wetSettings(input), start = wetOpenings(openings);
  const target = WET_CHANNELS.map(key => values.power ? values[key] * WET_CELL.maxOpen / 2 : 0);
  const changing = target.some((value, i) => Math.abs(value - start[i]) > EPS);
  return Object.freeze({values: Object.freeze(values), start: Object.freeze(start), target: Object.freeze(target), duration: changing ? WET_CELL.seconds : 0});
}

export function wetAt(plan, time) {
  const clock = Math.min(validTime(time), plan.duration), complete = clock >= plan.duration;
  const progress = plan.duration ? clamp(clock / plan.duration, 0, 1) : 1;
  const open = plan.start.map((value, i) => complete ? plan.target[i] : value + (plan.target[i] - value) * smooth(progress));
  const drive = WET_CHANNELS.map(key => plan.values.power ? plan.values[key] : 0);
  return {open, covered: open.map(value => 1 - value), drive, complete, progress, color: wetColor(open, plan.values.light)};
}

export function createWettingController(initial = {}) {
  let plan, clock;
  const state = () => ({values: {...plan.values}, plan, clock, duration: plan.duration, now: wetAt(plan, clock)});
  const reset = (input = {}) => {
    if (!input || typeof input !== 'object' || Array.isArray(input)) throw new TypeError('Expected electrowetting initial state');
    const next = wetPlan(input.settings ?? {}, input.openings), time = validTime(input.time ?? 0);
    plan = next;clock = Math.min(time, next.duration);return state();
  };
  const update = (input = {}) => {
    if (!input || typeof input !== 'object' || Array.isArray(input)) throw new TypeError('Expected electrowetting settings');
    const next = wetSettings({...plan.values, ...input}), before = plan.values;
    if (next.power !== before.power || next.power && WET_CHANNELS.some(key => next[key] !== before[key])) {
      plan = wetPlan(next, wetAt(plan, clock).open);clock = 0;
    } else plan = Object.freeze({...plan, values: Object.freeze(next)});
    return state();
  };
  const advance = dt => {validTime(dt);clock = Math.min(plan.duration, rounded(clock + dt));return state();};
  const replayState = () => ({settings: {...plan.values}, openings: [...plan.start], time: 0});
  reset(initial);
  return {getState: state, reset, update, advance, replayState};
}

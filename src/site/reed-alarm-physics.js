import {validateControls, validTime} from './physics-kit.js';

// ---------------------------------------------------------------------------
// Magnetic burglar alarm: a magnet on the door, a reed switch on the frame, the
// field the magnet leaves at the switch as the door swings, the two fields at
// which the contacts close and open again, and the monitored loop that runs the
// sounder when they part.
//
// The switches are Standex's MK03 series, whose Activate Distance Guide gives
// four sensitivities, 1.70, 2.30, 2.70 and 3.10 mT, and for each one a pull-in
// distance and a longer drop-out distance: 15.0 and 17.5 mm, 13.0 and 16.5,
// 11.0 and 14.5, 10.0 and 13.5 at its D1 position. The guide calls those
// typical values and does not say which of its six actuator magnets belongs to
// which position, so this model takes from them only the band their ratios
// span, 1.167 to 1.350. Standex's glossary gives ampere turns, hysteresis as
// the difference between operate and release stated as release over operate,
// and operate time as running until contact bounce has ended. Wikipedia's Reed
// switch page gives the 10 to 60 AT range of commercial pull-in sensitivities,
// the reeds' own spring force opening them when the field goes, the rhodium,
// ruthenium, iridium or tungsten contacts, and the nitrogen fill; its Magnet
// page gives the pole model, the inverse cube far field of any magnet and the
// inverse square near one pole of a long thin one; its Neodymium magnet page
// gives a remanence of 1 to 1.5 T, typically 1.3 T. Four George Risk datasheets
// give the gaps real door contacts are sold at, half an inch through three
// inches, and the loop they are made for: 0.150 Ω, 10 W, 160 VDC and 0.400 A
// for the normally open form A parts.
//
// Not from a source: the magnet, a neodymium block of 8 by 4 by 6 mm, 6 by 3 by
// 5 mm or 4 by 2 by 3 mm at 1.3 T, each size chosen because the distance at
// which it works the most sensitive switch lands on a gap George Risk sells a
// contact for, 25.6 mm against their 1 inch, 19.7 mm against their 3/4 inch and
// 12.8 mm against their 1/2 inch; the release share, 0.55 of the operate field,
// chosen because it puts this model's drop-out over pull-in distance at 1.25,
// inside the band the Standex table spans, since no page read gives that figure
// for one switch; a door 0.85 m from its hinge to the magnet, with the magnet
// kept parallel to the switch through the swing and the switch answering the
// size of the field along its own axis at its middle; an installed gap of 2 to
// 15 mm between magnet and switch with the door shut; and a swing that opens to
// 5 degrees and shuts again in 0.8 s, watched over 8 s, ten times slower.
// ---------------------------------------------------------------------------

export const MU_0 = 1.25663706127e-6;

/** Standex, Activate Distance Guide for Reed Sensors: the MK03 series, its sensitivities (T) and, at position D1, the largest distance that pulls in and the smallest that drops out (m). */
export const STANDEX = Object.freeze([
  Object.freeze({part: 'MK03-1A66B-500W', sensitivity: 1.70e-3, pull: 15.0e-3, drop: 17.5e-3}),
  Object.freeze({part: 'MK03-1A66C-500W', sensitivity: 2.30e-3, pull: 13.0e-3, drop: 16.5e-3}),
  Object.freeze({part: 'MK03-1A66D-500W', sensitivity: 2.70e-3, pull: 11.0e-3, drop: 14.5e-3}),
  Object.freeze({part: 'MK03-1A66E-500W', sensitivity: 3.10e-3, pull: 10.0e-3, drop: 13.5e-3}),
]);
/** The band those four rows span in the ratio of drop-out distance to pull-in distance. */
export const RATIO_BAND = Object.freeze([
  Math.min(...STANDEX.map(row => row.drop / row.pull)),
  Math.max(...STANDEX.map(row => row.drop / row.pull)),
]);

/** Wikipedia, Reed switch: commercial pull-in sensitivities run 10 to 60 ampere turns; the contact metals; the nitrogen fill at one atmosphere. */
export const REED = Object.freeze({ampereTurns: Object.freeze([10, 60]), metals: Object.freeze(['rhodium', 'ruthenium', 'iridium', 'tungsten']), fill: 'nitrogen'});

/** Wikipedia, Magnet and Neodymium magnet: a good bar magnet's moment (A·m²) in its volume (m³), the magnetization that implies (A/m), neodymium's remanence range and typical value (T), and its saturation (T). */
export const MAGNET = Object.freeze({barMoment: 0.1, barVolume: 1e-6, barMagnetization: 1e5, remanence: Object.freeze([1.0, 1.5]), typical: 1.3, saturation: 1.6});

/** George Risk: the gaps their door contacts are sold at (m), and the loop the normally open form A parts are made for. */
export const CONTACT = Object.freeze({
  gaps: Object.freeze([
    Object.freeze({name: '1/2 inch', metres: 0.0127}),
    Object.freeze({name: '3/4 inch', metres: 0.01905}),
    Object.freeze({name: '1 inch', metres: 0.0254}),
    Object.freeze({name: '1 1/2 inch', metres: 0.0381}),
    Object.freeze({name: '2 inch', metres: 0.0508}),
    Object.freeze({name: '3 inch', metres: 0.0762}),
  ]),
  formA: Object.freeze({resistance: 0.150, watts: 10, volts: 160, amps: 0.400}),
  formBC: Object.freeze({resistance: 0.140, watts: 5, volts: 175, amps: 0.250}),
});

/** Not from a source, each said in the lesson's limits: the magnets offered (mm, and the remanence they are given), the share of the operate field at which the contacts let go, the door from hinge to magnet (m), the swing and how slowly it is watched (s), the samples on each chart, and how far out the field chart looks (m). */
export const DECLARED = Object.freeze({
  magnets: Object.freeze([
    Object.freeze({name: 'large', width: 8e-3, depth: 4e-3, length: 6e-3}),
    Object.freeze({name: 'medium', width: 6e-3, depth: 3e-3, length: 5e-3}),
    Object.freeze({name: 'small', width: 4e-3, depth: 2e-3, length: 3e-3}),
  ]),
  remanence: 1.3,
  release: 0.55,
  width: 0.85,
  swing: 5,
  live: 0.8,
  shown: 8,
  samples: 161,
  reach: 60e-3,
  run: 121,
});

export const REED_ALARM_DEFAULTS = Object.freeze({angle: 5, switch: 0, gap: 5, magnet: 0, width: 0.85, armed: 1});
export const REED_ALARM_DOMAINS = Object.freeze({
  angle: Object.freeze([0, 5, 0.1]),
  switch: Object.freeze([0, 3, 1]),
  gap: Object.freeze([2, 15, 0.5]),
  magnet: Object.freeze([0, 2, 1]),
  width: Object.freeze([0.6, 1.1, 0.05]),
  armed: Object.freeze([0, 1, 1]),
});
export const SWITCH_OPTIONS = Object.freeze(STANDEX.map((row, value) => Object.freeze({value, label: `${(row.sensitivity * 1000).toFixed(2)} mT, ${row.part}`})));
export const MAGNET_OPTIONS = Object.freeze(DECLARED.magnets.map((magnet, value) => Object.freeze({value, label: `${magnet.width * 1000} by ${magnet.depth * 1000} by ${magnet.length * 1000} mm`})));
export const ARMED_OPTIONS = Object.freeze([Object.freeze({value: 0, label: 'Disarmed'}), Object.freeze({value: 1, label: 'Armed'})]);

// ---------------------------------------------------------------------------
// The magnet's field, the door's geometry and the switch.
// ---------------------------------------------------------------------------

/** The field, T, on the axis of a uniformly magnetized block, a distance z (m) from its pole face: the pole model's arctangents. */
export function fieldOf(magnet, z) {
  if (!(z >= 0)) return 0;
  const a = magnet.width / 2, b = magnet.depth / 2, far = z + magnet.length;
  const term = d => Math.atan2(a * b, d * Math.sqrt(a * a + b * b + d * d));
  return DECLARED.remanence / Math.PI * (term(z) - term(far));
}
/** The magnet's moment, A·m²: its remanence over μ0 times its volume. */
export const momentOf = magnet => DECLARED.remanence / MU_0 * magnet.width * magnet.depth * magnet.length;
/** The field, T, a dipole of that moment leaves on its own axis at a distance: 2μ0m/4πd³. */
export const dipoleFieldOf = (magnet, distance) => (distance > 0 ? MU_0 * momentOf(magnet) / (2 * Math.PI * distance ** 3) : 0);

/** How far the magnet stands from the switch, m, when a door `width` m from hinge to magnet has swung `angle` degrees open from an installed gap of `gap` m. */
export function separationOf(width, gap, angle) {
  const chord = 2 * width * Math.sin(Math.max(0, angle) * Math.PI / 360);
  return Math.hypot(gap, chord);
}
/** The angle, degrees, at which the magnet first stands `separation` m from the switch, or null when it never does. */
export function angleOf(width, gap, separation) {
  if (!(separation > gap)) return 0;
  const chord = Math.sqrt(separation * separation - gap * gap);
  if (chord > 2 * width) return null;
  return 360 * Math.asin(chord / (2 * width)) / Math.PI;
}

/** The distance, m, at which a magnet's field has fallen to `target` T, or null when it never reaches it. */
export function distanceAt(magnet, target) {
  if (!(target > 0) || fieldOf(magnet, 0) <= target) return null;
  let lo = 0, hi = 1;
  for (let k = 0; k < 200; k++) { const mid = (lo + hi) / 2; if (fieldOf(magnet, mid) > target) lo = mid; else hi = mid; }
  return (lo + hi) / 2;
}
/** The angle, degrees, at which the field at the switch has fallen to `target` T, or null when the swing never takes it there. */
export function angleAt(magnet, width, gap, target) {
  const distance = distanceAt(magnet, target);
  if (distance === null || distance <= gap) return null;
  return angleOf(width, gap, distance);
}

// ---------------------------------------------------------------------------
// The run: the door swings out and shuts again.
// ---------------------------------------------------------------------------

/** How long Play runs, s, and how many times slower than life it is. */
export const RUN = DECLARED.shown;
export const SLOWER = DECLARED.shown / DECLARED.live;
/** The door's angle, degrees, `seconds` into the run: out to the angle it is opened to and back. */
export const angleOfClock = (seconds, swing = DECLARED.swing) => (seconds > 0 ? swing * Math.sin(Math.PI * Math.min(seconds, RUN) / RUN) : 0);
/** The first second of the run at which the door stands at `angle` degrees, or null when this swing never takes it there. */
export function clockOfAngle(angle, swing = DECLARED.swing) {
  if (!(angle > 0) || !(swing > 0) || angle > swing) return null;
  return RUN * Math.asin(Math.min(1, angle / swing)) / Math.PI;
}

const plans = new Map();

export function reedAlarmPlan(input = {}) {
  const values = validateControls(input, REED_ALARM_DEFAULTS, REED_ALARM_DOMAINS, 'magnetic burglar alarm');
  const key = JSON.stringify(values);
  if (plans.has(key)) return plans.get(key);
  const magnet = DECLARED.magnets[values.magnet], row = STANDEX[values.switch];
  const gap = values.gap / 1000, operate = row.sensitivity, release = operate * DECLARED.release;
  const operateDistance = distanceAt(magnet, operate), releaseDistance = distanceAt(magnet, release);
  const shut = fieldOf(magnet, gap), closes = shut >= operate;
  const openAngle = closes ? angleAt(magnet, values.width, gap, release) : null;
  const closeAngle = closes ? angleAt(magnet, values.width, gap, operate) : null;
  const nearest = CONTACT.gaps.reduce((best, item) => (operateDistance !== null && Math.abs(item.metres - operateDistance) < Math.abs(best.metres - operateDistance) ? item : best), CONTACT.gaps[0]);
  const plan = {
    values, magnet, row, gap, operate, release, operateDistance, releaseDistance,
    ratio: operateDistance === null || releaseDistance === null ? null : releaseDistance / operateDistance,
    shut, closes, openAngle, closeAngle, swing: values.angle,
    // Nothing shuts again that never opened, so both times go together.
    openTime: openAngle === null ? null : clockOfAngle(openAngle, values.angle),
    closeTime: openAngle === null || clockOfAngle(openAngle, values.angle) === null || closeAngle === null ? null : RUN - clockOfAngle(closeAngle, values.angle),
    span: openAngle === null || closeAngle === null ? null : openAngle - closeAngle,
    nearest, nearestError: operateDistance === null ? null : operateDistance - nearest.metres,
    moment: momentOf(magnet), loop: CONTACT.formA, duration: RUN, slower: SLOWER,
  };
  plan.curve = Array.from({length: DECLARED.samples}, (_, j) => {
    const distance = DECLARED.reach * j / (DECLARED.samples - 1);
    return {distance, field: fieldOf(magnet, distance), dipole: dipoleFieldOf(magnet, distance)};
  });
  plan.samples = Array.from({length: DECLARED.run}, (_, j) => {
    const t = RUN * j / (DECLARED.run - 1), angle = angleOfClock(t, values.angle), separation = separationOf(values.width, gap, angle);
    return {t, angle, separation, field: fieldOf(magnet, separation)};
  });
  if (plans.size >= 64) plans.clear();
  plans.set(key, plan);
  return plan;
}

/** The alarm `time` seconds into the run: where the door stands, how far the magnet is, the field at the switch, whether the contacts are closed, whether the loop is whole, and whether the sounder has been set going. */
export function reedAlarmAt(plan, time) {
  const t = validTime(time), angle = angleOfClock(t, plan.values.angle), separation = separationOf(plan.values.width, plan.gap, angle);
  const field = fieldOf(plan.magnet, separation);
  const opened = plan.openTime !== null && t >= plan.openTime;
  const shutAgain = plan.closeTime !== null && t >= plan.closeTime;
  const closed = plan.closes ? !opened || shutAgain : false;
  const sounding = plan.values.armed === 1 && opened && plan.closes;
  return {
    t, angle, separation, field, closed, opened, shutAgain,
    loop: closed ? 'whole' : 'broken',
    current: closed ? Math.sqrt(plan.loop.watts / plan.loop.resistance) : 0,
    sounding,
    share: plan.operate > 0 ? field / plan.operate : 0,
  };
}

export const sampleReedAlarm = (input = {}, time = 0) => reedAlarmAt(reedAlarmPlan(input), time);

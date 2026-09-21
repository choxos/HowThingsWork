// Toaster: the heating network integrated again at a fifth of the step with
// its own crust solve and an energy audit, the strip's bend from the general
// bimetal formula, the drawing held to the state, and every number the lesson
// quotes held to the model.
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {sampleToaster, toasterPlan, warmLayer, flows, resistance, elementPower, stripDeflection, browningRate, crustDepth, shade, TRIPS, TOASTER, TOASTER_DOMAINS} from './toaster-physics.js';
import {createToasterModel, glowColor, toastColor, chartPoint, stripPoint} from './toaster-model.js';
import {toasterLesson} from './toaster-lesson.js';
import {tally, checkTrialNumbers, checkQuotedText, checkControlsMove, checkFinite, checkDisposal, checkRefusals} from './model-check-kit.mjs';
import {fixed} from './format.js';

const t = tally(), K = 273.15, sigma = 5.670374419e-8;
const C = {V: 120, R0: 15, eps: 0.85, Ae: 0.024, Ce: 45, hE: 10, share: 0.15, sensorShare: 0.005, Cb: 2, Gb: 0.04, Ci: 350, Groom: 3.5, hAir: 12, room: 20, mass: 0.05, water: 0.38, zone: 4 / 15, c: 2800, Gin: 1.2, Ab: 0.0264, k: 0.05, depth: 0.002, L: 2.26e6, F: 3.34e5};
const durations = [110, 122, 134, 146, 158, 170, 182];

// Published material factors and independent heat/phase balances.
const factors = [[20, 1], [100, 1.01], [200, 1.02], [300, 1.03], [400, 1.04], [500, 1.05], [600, 1.04], [700, 1.04], [800, 1.04], [900, 1.04], [1000, 1.05], [1100, 1.06], [1200, 1.07]];
function referenceResistance(T) {
  if (T <= 20) return 15;
  for (let i = 1; i < factors.length; i++) if (T <= factors[i][0]) { const [a, x] = factors[i - 1], [b, y] = factors[i]; return 15 * (x + (y - x) * (T - a) / (b - a)); }
  return 16.05;
}
for (const Te of [-18, ...factors.map(([T]) => T), 250, 550, 1250]) {
  t.near(resistance(Te), referenceResistance(Te), 1e-12, 'nichrome resistance');
  t.near(elementPower(Te), C.V ** 2 / resistance(Te), 1e-9, 'element power');
}
for (const rise of [10, 50, 94.6]) {
  // Timoshenko's bimetal curvature for thickness ratio m and modulus ratio n, both 1 here.
  const m = 1, n = 1, h = 0.0005, curvature = 6 * 1.8e-5 * rise * (1 + m) ** 2 / (h * (3 * (1 + m) ** 2 + (1 + m * n) * (m * m + 1 / (m * n))));
  t.near(stripDeflection(rise), curvature * 0.05 ** 2 / 2, 1e-12, 'strip tip deflection from its curvature');
}
for (const Ts of [90, 120, 150, 180]) t.near(browningRate(Ts), Ts > 100 ? 2 ** ((Ts - 150) / 10) / 90 : 0, 1e-12, 'browning doubles every 10 degrees');
for (const [layer, Q, capacity] of [[{T: -18, ice: 0.003, water: 0}, 2000, 30], [{T: 95, ice: 0, water: 0.002}, 900, 30], [{T: 95, ice: 0, water: 0.0001}, 2000, 30], [{T: -5, ice: 0.0005, water: 0.001}, 5000, 30]]) {
  const out = warmLayer(layer, Q, capacity), melted = layer.ice - out.ice, boiled = out.steam;
  t.near(capacity * (out.T - layer.T) + melted * C.F + boiled * C.L, Q, 1e-9, 'heat into a layer is warmth, melting and boiling');
  t.near(out.water, layer.water + melted - boiled, 1e-15, 'water accounted');
  t.ok((out.ice > 0 ? out.T <= 1e-9 : true) && (out.water > 0 ? out.T <= 100 + 1e-9 : true), 'held at the melting and boiling points');
  if (out.water > 0 && layer.ice === 0 && layer.T + Q / capacity > 100) t.near(out.T, 100, 1e-9, 'boiling holds a wet layer at exactly 100 degrees');
}
for (const zone of [{T: 100, ice: 0, water: 0.004}, {T: 100, ice: 0, water: 0.002}, {T: 100, ice: 0, water: 0}, {T: 60, ice: 0, water: 0.00507}]) for (const Te of [400, 650]) for (const Ti of [60, 180]) {
  const q = flows({Te, Ti, Tb: 50, inside: true, zone, middle: {T: 50, ice: 0, water: 0.01}}, true), R = crustDepth(zone) / (C.k * C.Ab);
  const heat = C.share * sigma * C.eps * C.Ae * ((Te + K) ** 4 - (q.surface + K) ** 4) + C.hAir * C.Ab * (Ti - q.surface);
  t.near(q.surface - zone.T, R * heat, 1e-6, 'the face is hotter than its layer by the drop across the crust');
}

// 2. The network again, at a fifth of the step.
const phase = (layer, Q, cap) => {
  let {T, ice, water} = layer, melted = 0, boiled = 0;
  T += Q / cap;
  if (ice > 0 && T > 0) { melted = Math.min(ice, T * cap / C.F); ice -= melted; water += melted; T -= melted * C.F / cap; }
  if (water > 0 && T > 100) { boiled = Math.min(water, (T - 100) * cap / C.L); water -= boiled; T -= boiled * C.L / cap; }
  return {T, ice, water, melted, boiled};
};
const rad = (a, b) => sigma * C.eps * C.Ae * ((a + K) ** 4 - (b + K) ** 4);
function reference(values, start = {Te: 20, Ti: 20, Tb: 20}, calibration = false) {
  const dt = 0.002, Cz = C.mass * C.zone * C.c, Cm = C.mass * (1 - C.zone) * C.c, w0 = C.mass * C.zone * C.water, wm = C.mass * (1 - C.zone) * C.water, frozen = values.bread === 1;
  let {Te, Ti, Tb} = start, zone = frozen ? {T: -18, ice: w0, water: 0} : {T: 20, ice: 0, water: w0}, middle = frozen ? {T: -18, ice: wm, water: 0} : {T: 20, ice: 0, water: wm};
  const duration = durations[values.setting - 1], trip = TRIPS[values.setting - 1], sensor = values.timer === 0, share = sensor ? C.sensorShare : 0;
  let browning = 0, energy = 0, bread = 0, glow = null, latent = 0, roomLoss = 0, triggered = null;
  const initial = C.Ce * Te + C.Ci * Ti + C.Cb * Tb + Cz * zone.T + Cm * middle.T;
  for (let n = 0; ; n++) {
    const time = n * dt, R = Math.min(1, Math.max(0, 1 - (zone.ice + zone.water) / w0)) * C.depth / (C.k * C.Ab);
    const heat = T => C.share * rad(Te, T) + C.hAir * C.Ab * (Ti - T), slope = T => -C.share * sigma * C.eps * C.Ae * 4 * (T + K) ** 3 - C.hAir * C.Ab;
    let Ts = zone.T;
    for (let i = 0; i < 60; i++) { const step = (Ts - zone.T - R * heat(Ts)) / (1 - R * slope(Ts)); Ts -= step; if (Math.abs(step) < 1e-11) break; }
    if (glow === null && Te >= 525) glow = time;
    if (triggered === null && ((sensor && !calibration ? Tb - C.room >= trip : time >= duration - 1e-9) || time >= 300 - 1e-9)) triggered = time;
    if (triggered !== null && time >= triggered + (calibration ? 0 : 0.15) - 1e-9) {
      const stored = C.Ce * Te + C.Ci * Ti + C.Cb * Tb + Cz * zone.T + Cm * middle.T - initial + latent;
      t.near(energy, stored + roomLoss, 1e-6 * energy, 'every joule from the supply is stored, spent on water, or lost to the room');
      return {triggered, powerOff: time, glow, Te, Ti, Tb, Ts, middleT: middle.T, browning, energy, bread, water: zone.ice + zone.water, sensor};
    }
    const P = C.V ** 2 / (referenceResistance(Te)), toBread = C.share * rad(Te, Ts), toInterior = (1 - C.share - share) * rad(Te, Ti) + C.hE * C.Ae * (Te - Ti), air = C.hAir * C.Ab * (Ti - Ts), inward = C.Gin * (zone.T - middle.T);
    zone = phase(zone, (toBread + air - inward) * dt, Cz);
    middle = phase(middle, inward * dt, Cm);
    latent += (zone.melted + middle.melted) * C.F + (zone.boiled + middle.boiled) * C.L;
    browning += (Ts > 100 ? 2 ** ((Ts - 150) / 10) / 90 : 0) * dt;
    const toSensor = share * rad(Te, Tb), sensorLoss = sensor ? C.Gb * (Tb - C.room) : 0;
    roomLoss += (C.Groom * (Ti - C.room) + sensorLoss) * dt;
    Te += (P - toBread - toInterior - toSensor) * dt / C.Ce;
    Ti += (toInterior - C.Groom * (Ti - C.room) - air) * dt / C.Ci;
    Tb += (toSensor - sensorLoss) * dt / C.Cb;
    energy += P * dt;
    bread += (toBread + air) * dt;
  }
}
const coolEmpty = ({Te, Ti, Tb, sensor}) => {
  for (let n = 0; n < 15175; n++) {
    const share = sensor ? C.sensorShare : 0, toSensor = share * rad(Te, Tb), sensorLoss = sensor ? C.Gb * (Tb - C.room) : 0;
    const toInterior = (1 - share) * rad(Te, Ti) + C.hE * C.Ae * (Te - Ti), dt = 0.002;
    [Te, Ti, Tb] = [Te - (toInterior + toSensor) * dt / C.Ce, Ti + (toInterior - C.Groom * (Ti - C.room)) * dt / C.Ci, Tb + (toSensor - sensorLoss) * dt / C.Cb];
  }
  return {Te, Ti, Tb};
};
for (const values of [{setting: 1}, {setting: 4}, {setting: 7}, {setting: 4, timer: 1}, {setting: 4, bread: 1}, {setting: 4, start: 1}, {setting: 4, start: 1, timer: 1}, {setting: 7, start: 1, bread: 1, timer: 1}]) {
  const full = {setting: 4, timer: 0, start: 0, bread: 0, ...values}, plan = toasterPlan(full);
  let start;
  if (full.start === 1) {
    const first = reference({...full, bread: 0});
    start = coolEmpty(first);
    t.near(plan.start.Te, start.Te, 0.5, 'element temperature a slice later');
    t.near(plan.start.Ti, start.Ti, 0.2, 'inside air a slice later');
    t.near(plan.start.Tb, start.Tb, 0.05, 'strip a slice later');
  }
  const ref = reference(full, start), got = plan.atPop;
  t.near(plan.triggered, ref.triggered, 0.03, `${JSON.stringify(values)}: sensor or timer trigger`);
  t.near(plan.powerOff, ref.powerOff, 0.03, 'power cutoff after release');
  t.near(got.browning, ref.browning, 0.03 * ref.browning + 0.002, `${JSON.stringify(values)}: browning at the pop`);
  t.near(got.surfaceT, ref.Ts, 0.4, 'face at the pop');
  t.near(got.middleT, ref.middleT, 0.15, 'middle at the pop');
  t.near(got.elementEnergy, ref.energy, 0.003 * ref.energy, 'element energy used');
  t.near(got.bread, ref.bread, 0.005 * ref.bread, 'energy reaching the bread');
  t.near(plan.samples.find(sample => sample.Te >= 525).t, ref.glow, 0.11, 'time to glow');
  let last = -1;
  for (const sample of plan.samples) { t.ok(sample.browning >= last, 'browning never undoes itself'); last = sample.browning; }
}


for (let setting = 1; setting <= 7; setting++) t.near(TRIPS[setting - 1], reference({setting, timer: 0, start: 0, bread: 0}, undefined, true).Tb - 20, 0.004, 'cold sensor calibration from finer independent integration');

let combinations = 0, maximumResidual = 0;
for (let setting = 1; setting <= 7; setting++) for (const timer of [0, 1]) for (const start of [0, 1]) for (const bread of [0, 1]) {
  combinations++;
  const values = {setting, timer, start, bread}, plan = toasterPlan(values), f = TOASTER;
  const ready = sampleToaster(values, 0), lowered = sampleToaster(values, f.lower), trip = sampleToaster(values, f.lower + plan.triggered), off = sampleToaster(values, f.lower + plan.powerOff), up = sampleToaster(values, plan.popped), done = sampleToaster(values, plan.length);
  t.ok(ready.ready && !ready.on && !ready.coilOn && ready.carriage === 1 && ready.power === 0 && ready.energy === 0, 'ready means raised and electrically off');
  t.ok(lowered.on && lowered.carriage === 0 && lowered.power > 0, 'latched rack starts heating');
  t.ok(trip.coilOn && trip.on && trip.carriage === 0, 'trigger powers release coil before rack moves');
  t.ok(!off.on && !off.coilOn && off.power === 0 && off.controlPower === 0 && off.catch > 0.999, 'both branches switch off with the catch clear');
  t.ok(sampleToaster(values, plan.popped / 5 * 5).phase === 'Popped', 'lift boundary survives playback clock conversion');
  t.near(up.carriage, 1, 1e-12, 'rack fully up'); t.ok(done.complete, 'completion holds');
  t.near(plan.powerOff - plan.triggered, 0.15, 1e-12, 'release delay'); t.near(done.controlEnergy, 1.8, 1e-10, 'release pulse energy');
  t.near(done.surfaceT, plan.atPop.surfaceT, 1e-10, 'removed face temperature retained, never reset to moist-zone temperature');
  t.near(done.browning, plan.atPop.browning, 1e-12, 'removed bread no longer browns in this model');
  t.near(sampleToaster(values, plan.length + 1e6).clock, plan.length, 1e-12, 'clock clamps at completion');
  t.ok(!plan.cutout, 'ordinary controls do not rely on emergency cutoff');
  if (timer) t.near(plan.triggered, durations[setting - 1], 1e-10, 'fixed timer ignores starting heat and bread type');
  for (let i = 0; i < plan.samples.length; i++) {
    const s = plan.samples[i], residual = s.elementEnergy - s.storedEnergy - s.latentEnergy - s.roomEnergy;
    maximumResidual = Math.max(maximumResidual, Math.abs(residual));
    t.near(residual, 0, 1e-5, 'all heating joules accounted, including sensor heat');
    t.near(s.energy, s.elementEnergy + s.controlEnergy, 1e-10, 'coil input included once in total supply energy');
    t.ok([s.surfaceT, s.middleT, s.Tb].every(T => T >= -20 && T <= 300), 'all temperatures fit labeled chart');
    if (i) t.ok(s.t > plan.samples[i - 1].t, 'event samples keep strictly increasing time');
  }
}
const m = createToasterModel(), p = m.topology, MM = p.MM;
t.ok(m.controls.find(c => c.key === 'timer').primary, 'release type visible above scene');
t.ok(p.chart.userData.inspectionOnly === 'chart' && p.chart.parent === m.root, 'chart has its own inspection view');
t.ok(p.chart.userData.explosionExcluded && p.heat.userData.explosionExcluded, 'guides are not separated hardware');
assert.deepEqual(m.thumbnailOmit, [p.heat, p.chart]);
t.near(m.root.quaternion.clone().multiply(p.chart.quaternion).angleTo(new THREE.Quaternion()), 0, 1e-7, 'chart level in initial view');
m.root.position.set(0.4, -0.2, 0.3);
const bounds = object => {
  m.root.updateMatrixWorld(true);
  const inverse = m.root.matrixWorld.clone().invert(), box = new THREE.Box3();
  object.traverse(node => { if (node.geometry) { node.geometry.computeBoundingBox(); box.union(node.geometry.boundingBox.clone().applyMatrix4(inverse.clone().multiply(node.matrixWorld))); } });
  return box;
};
const seek = (values, clock) => { m.reset(); m.update(values); m.advance(clock / p.SPEED); return m.getState(); };
let poses = 0;
for (const values of [{}, {timer: 1}, {start: 1}, {bread: 1, setting: 7}, {setting: 1, start: 1, timer: 1}]) {
  const plan = toasterPlan(values);
  for (const clock of [0, 0.3, 0.6, 60.6, TOASTER.lower + plan.triggered, TOASTER.lower + plan.triggered + 0.1, TOASTER.lower + plan.powerOff, plan.popped, plan.length]) {
    poses++;
    const s = seek(values, clock), rack = bounds(p.rack), coil = bounds(p.springPart), tab = bounds(p.tab), ledge = bounds(p.ledge), shoe = bounds(p.shoe), core = bounds(p.core);
    t.near(rack.max.y / MM, p.DOWN + (p.UP - p.DOWN) * s.carriage, 1e-4, 'rack top follows continuous lift');
    t.near(coil.min.y / MM, 8, 1e-4, 'spring contacts its base seat');
    t.near(coil.max.y / MM, rack.min.y / MM, 1e-4, 'spring contacts rack arm underside');
    t.ok(coil.min.x >= bounds(p.springArm).min.x && coil.max.x <= bounds(p.springArm).max.x, 'spring sits under carriage arm');
    if (s.on && s.heatClock <= plan.triggered) {
      t.near(ledge.min.y, tab.max.y, 1e-7, 'retaining ledge touches carriage tab');
      t.ok(ledge.min.x < tab.max.x && ledge.max.x > tab.min.x, 'ledge overlaps tab to hold spring load');
    }
    if (s.catch > 0.999) t.ok(ledge.min.x > tab.max.x, 'retracted ledge clears tab before lift');
    t.ok(shoe.max.x < core.min.x, 'iron shoe approaches core without penetration');
    t.near(p.hook.rotation.z, -0.22 * s.catch, 1e-12, 'catch follows release stage');
    const moving = bounds(p.switchBlade), fixedContact = bounds(p.fixedContact);
    if (s.on) t.near(moving.min.y, fixedContact.max.y, 1e-7, 'main contacts touch while powered');
    else t.ok(moving.max.y > fixedContact.max.y + 2 * MM, 'main blade visibly opens');
    t.ok(p.stripPart.visible === (s.values.timer === 0) && p.board.visible === (s.values.timer === 1), 'mode swaps sensor and timer');
    t.ok(p.contactLead.visible === (s.values.timer === 0) && p.timerLead.visible === (s.values.timer === 1), 'electrical branch reaches selected controller');
    for (const layer of p.layers) {
      const a = layer.geometry.attributes.position, original = layer.userData.original;
      for (let i = 0; i < a.count; i += 11) {
        const along = original[i * 3 + 1] / MM + 25, expected = stripPoint(s.bend, along, original[i * 3] / MM + layer.userData.offset);
        t.near(a.getX(i), expected[0], 1e-7, 'solid bonded layer follows beam');
        t.near(a.getY(i), expected[1], 1e-7, 'strip rooted at its clamp');
      }
    }
    t.near(p.stop.position.x - 0.5 * MM - (p.tip.position.x + MM), (s.tripBend - s.bend) * 1000 * MM, 1e-9, 'sensor tip meets plate without passing through');
    t.ok(s.bend <= s.tripBend, 'contact limits visible bend');
    for (const wire of p.wires) t.ok(wire.material.color.equals(glowColor(s.Te)), 'ribbon color follows temperature');
    t.ok(p.faces[0].material.color.equals(toastColor(s.browning)), 'bread color follows chosen index');
    t.near(p.arrows[0].userData.length, s.on && s.toBread + s.airToBread > 1e-9 ? 8 * MM : 0, 1e-12, 'direction arrows only while heating');
    const face = p.faceLine.geometry.attributes.position, n = p.faceLine.geometry.drawRange.count;
    t.near(face.getX(n - 1), chartPoint(s.powerOff, s.atPop.surfaceT)[0], 1e-6, 'bread curve stops at removal time');
    t.near(face.getY(n - 1), chartPoint(s.powerOff, s.atPop.surfaceT)[1], 1e-6, 'curve endpoint retains actual face temperature');
    t.near(p.cursor.geometry.attributes.position.getX(0), chartPoint(s.heatClock, 0)[0], 1e-6, 'cursor uses heating clock');
    checkFinite(m.root, t);
  }
}
for (const action of m.actions) { m.reset(); m.update({timer: 1}); action.run(); const s = m.getState(); const chosen = m.parts.find(part => part.id === action.part); t.ok(chosen.object.visible, `${action.label} selects visible part`); if (action.label.includes('sensor touches')) t.ok(s.values.timer === 0 && s.coilOn && s.sensorContact, 'sensor inspection restores correct mode and event'); }
for (const [key, value] of [['setting', 7], ['timer', 1], ['start', 1], ['bread', 1]]) { seek({}, 60); m.update({[key]: value}); t.near(m.getState().clock, 0, 0, `${key} starts a fresh trial`); m.advance(2); const clock = m.getState().clock; m.update({[key]: value}); t.near(m.getState().clock, clock, 0, 'same setting does not restart'); }
checkControlsMove(m, () => [p.pointer.rotation.x, p.stripPart.visible, p.wires[0].material.color.getHex(), p.faces[0].material.color.getHex(), m.getState().surfaceT], model => model.advance(60 / p.SPEED), t);
const run = values => { m.reset(); m.update(values); m.advance(1e3); return m.getState(); };
checkTrialNumbers(toasterLesson, {
  'Make toast': s => ({'33.2': s.samples.find(x => x.Te >= 525).t, '146.0': s.triggered, '180.3': s.atPop.surfaceT, '74.4': s.atPop.middleT, '1.04': s.atPop.browning}),
  'Find the sensor contact': s => ({'110.0': s.atTrip.Tb, '6.08': stripDeflection(s.trip) * 1000}),
  'Follow the release pulse': s => ({'0.15': s.powerOff - s.triggered, '1.80': s.controlEnergy}),
  'The lightest setting': s => ({'110.0': s.triggered, '0.05': s.atPop.browning}),
  'The darkest setting': s => ({'182.0': s.triggered, '223.0': s.atPop.surfaceT, '21.82': s.atPop.browning}),
  'A second slice with the sensor': s => ({'88.5': s.start.Tb, '86.42': s.triggered, '0.26': s.atPop.browning}),
  'A second slice by the clock': s => ({'146': s.duration, '57.93': s.atPop.browning}),
  'Start with frozen bread': s => ({'147.22': s.triggered, '24.9': s.atPop.middleT, '0.02': s.atPop.browning}),
  'Account for the energy': s => ({'135.14': s.atPop.energy / 1000, '13.71': s.atPop.bread / 1000}),
  'Read the three temperatures': () => ({}),
}, run, t, m);
const cold = toasterPlan({});
checkQuotedText(toasterLesson.deeper.map(x => x.body).join(' '), {'15.00 Ω': `${fixed(resistance(20), 2)} Ω`, '15.60 Ω': `${fixed(resistance(cold.atPop.Te), 2)} Ω`, '7.69 A': `${fixed(120 / resistance(cold.atPop.Te), 2)} A`, '5.1 g': `${fixed(C.mass * C.zone * C.water * 1000, 1)} g`}, t);
t.ok(shade(cold.atPop.browning) === 'golden' && shade(toasterPlan({start: 1}).atPop.browning) === 'light' && shade(toasterPlan({start: 1, timer: 1}).atPop.browning) === 'burnt', 'contrast in lesson follows thermal model, not guaranteed compensation');
checkRefusals(sampleToaster, TOASTER_DOMAINS, t);
const resources = checkDisposal(m, t);
console.log(`PASS toaster model: ${t.count} checks, ${combinations} combinations, ${poses} poses, ${toasterLesson.tryIt.length} trials, ${resources} resources; maximum energy residual ${maximumResidual} J`);

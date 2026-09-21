import * as THREE from 'three';
import {houseModel, reading as r} from './house-model-kit.js';
import {fixed} from './format.js';
import {surface, solidArrow} from './scene-kit.js';
import {BEATER_SHAPE, bowlWithMixture, beaterWire} from './beaters-scene.js';
import {mixerWheelGeometry, mixerWormGeometry} from './mixer-worm-geometry.js';
import {sampleMixer, wormDimensions, MIXTURES, WORM_WHEELS, MIXER_DEFAULTS as D, MIXER_DOMAINS, MOTOR} from './beaters-physics.js';

const MM = 0.01, TAU = Math.PI * 2, AXIS_Y = 150, WHEEL_X = BEATER_SHAPE.spacing / 2;
const SLOW = 1 / MOTOR.rotationSlow, WORM = {radius: 6, length: 30};
export const wheelModule = teeth => wormDimensions(teeth).module;

export function createElectricMixerModel() {
  const kit = houseModel('Electric mixer'), {root, part, control, finish, covers} = kit;
  const system = part('system', 'Electric mixer', 'A fast motor drives one worm and two slower, opposite-turning beaters. Follow the run clock, motor temperature and protective cutoff. This teaching mixer uses a 24 V permanent-magnet DC motor.');
  const bowl = bowlWithMixture(kit, system, covers, MM);
  const frame = part('housing', 'Housing and handle', 'The chassis holds the motor and beater bearings. The handle stays connected when the outer shell is cut away.', [0, 0, 0], system);
  const box = (size, pos, color, parent = frame) => kit.box(size.map(v => v * MM), pos.map(v => v * MM), color, parent);
  const rod = (a, b, radius, color, parent = frame) => kit.rod(a.map(v => v * MM), b.map(v => v * MM), radius * MM, color, parent);
  const ring = (radius, bore, depth, position, color, parent, axis = 'y') => {
    const shape = new THREE.Shape().absarc(0, 0, radius, 0, TAU, false);
    shape.holes.push(new THREE.Path().absarc(0, 0, bore, 0, TAU, true));
    const geometry = new THREE.ExtrudeGeometry(shape, {depth, bevelEnabled: false, curveSegments: 32}).translate(0, 0, -depth / 2);
    if (axis === 'y') geometry.rotateX(-Math.PI / 2);
    geometry.scale(MM, MM, MM);
    const mesh = surface(kit, geometry, color, parent);
    mesh.position.set(...position.map(v => v * MM));
    return mesh;
  };
  const chassisShape = new THREE.Shape().moveTo(-44, -98).lineTo(44, -98).lineTo(44, 22).lineTo(-44, 22).closePath();
  for (const x of [-WHEEL_X, WHEEL_X]) chassisShape.holes.push(new THREE.Path().absarc(x, 0, 2.3, 0, TAU, true));
  const chassis = surface(kit, new THREE.ExtrudeGeometry(chassisShape, {depth: 3, bevelEnabled: false, curveSegments: 32}).rotateX(Math.PI / 2).translate(0, 121, 0).scale(MM, MM, MM), 'cream', frame);
  box([3, 61, 120], [-44, 150, -38], 'cream');
  box([88, 61, 3], [0, 150, -98], 'cream');
  covers.push(box([3, 61, 120], [44, 150, -38], 'cream'), box([88, 3, 120], [0, 181, -38], 'cream'), box([88, 61, 3], [0, 150, 22], 'cream'));
  for (const z of [-60, 4]) {
    box([88, 4, 9], [0, 179, z], 'cream');
    rod([42, 121, z], [42, 179, z], 2, 'metal');
  }
  rod([0, 179, -60], [0, 209, -60], 4, 'cream');
  rod([0, 209, -60], [0, 209, 4], 4, 'cream');
  rod([0, 209, 4], [0, 179, 4], 4, 'cream');
  const speedSwitch = part('speed-switch', 'Speed switch', 'Five settings apply 4.8 to 24 V to the teaching motor. More voltage raises its available speed and torque.', [0, 0, 0], frame);
  box([70, 3, 12], [0, 183, 4], 'ink', speedSwitch);
  const knob = box([12, 7, 10], [0, 188, 4], 'red', speedSwitch);

  const bearings = part('bearings', 'Shaft bearings', 'Bored sleeves hold the beater shafts in the chassis. Two supported bearings carry the motor shaft. Shafts turn inside the holes.', [0, 0, 0], frame);
  const beaterBearings = [-WHEEL_X, WHEEL_X].map(x => ring(4, 2.3, 17, [x, 129.5, 0], 'gold', bearings));
  const motorBearings = [-77, -23].map(z => {
    rod([0, 121, z], [0, 144, z], 3, 'metal', bearings);
    return ring(6, 2.3, 4, [0, AXIS_Y, z], 'metal', bearings, 'z');
  });

  const motor = part('motor', 'Electric motor', 'Permanent magnets surround a wound rotor. Carbon brushes contact a segmented commutator. The rotor, worm and fan share one shaft. Electrical details are simplified; load, power and heat use one consistent DC motor law.', [0, AXIS_Y * MM, 0], system);
  for (const side of [-1, 1]) {
    const start = (side > 0 ? -Math.PI / 2 : Math.PI / 2) + .2, end = start + Math.PI - .4;
    const shape = new THREE.Shape().moveTo(18 * Math.cos(start), 18 * Math.sin(start))
      .lineTo(22 * Math.cos(start), 22 * Math.sin(start)).absarc(0, 0, 22, start, end, false)
      .lineTo(18 * Math.cos(end), 18 * Math.sin(end)).absarc(0, 0, 18, end, start, true).closePath();
    const magnet = surface(kit, new THREE.ExtrudeGeometry(shape, {depth: 36, bevelEnabled: false, curveSegments: 32}).translate(0, 0, -71).scale(MM, MM, MM), side > 0 ? 'red' : 'blue', motor);
    if (side > 0) covers.push(magnet);
  }
  for (const x of [-20, 20]) rod([x, -29, -53], [x, 0, -53], 2.5, 'metal', motor);
  const spinning = new THREE.Group(); motor.add(spinning);
  const rotor = kit.cylinder(12 * MM, 34 * MM, [0, 0, -53 * MM], 'metal', spinning); rotor.rotation.x = Math.PI / 2;
  rod([0, 0, -94], [0, 0, 19], 2, 'metal', spinning);
  const coils = [];
  for (let i = 0; i < 6; i++) {
    const angle = i * TAU / 6, points = [];
    for (const [a, z] of [[-.35, -71], [.35, -71], [.35, -35], [-.35, -35], [-.35, -71]]) points.push([13 * Math.cos(angle + a), 13 * Math.sin(angle + a), z].map(v => v * MM));
    const coil = kit.tube(points, .8 * MM, 'clay', spinning); coil.material = coil.material.clone(); coils.push(coil);
    const commutator = surface(kit, new THREE.CylinderGeometry(7 * MM, 7 * MM, 4 * MM, 10, 1, false, angle + .025, TAU / 6 - .05).rotateX(Math.PI / 2), 'clay', spinning);
    commutator.position.z = -30 * MM;
  }
  for (const x of [-8.5, 8.5]) box([3, 5, 4], [x, 0, -30], 'ink', motor);
  const fan = part('fan', 'Cooling fan', 'Six blades on the motor shaft move air over the motor. Removing the fan removes its airflow and mechanical drag. A stopped motor cannot run this fan.', [0, 0, 0], motor);
  const fanSpin = new THREE.Group(); fan.add(fanSpin);
  ring(5, 2, 3, [0, 0, -88], 'blue', fanSpin, 'z');
  for (let i = 0; i < 6; i++) {
    const bladeMount = new THREE.Group(); bladeMount.rotation.z = i * TAU / 6; fanSpin.add(bladeMount);
    const blade = box([18, 6, 1.5], [13, 0, -88], 'blue', bladeMount);
    blade.rotation.x = -.45;
  }
  const airflow = part('airflow', 'Cooling airflow', 'Blue arrows show air moving from the shaft-mounted fan along the motor. Their direction and motion show the cooling path, not a fluid simulation.', [0, 0, 0], motor);
  const arrows = [0, 1, 2].map(i => {
    const arrow = solidArrow(kit, 0x83b4c1, airflow, .65 * MM);
    arrow.userData.setLength(10 * MM); arrow.userData.setDirection(new THREE.Vector3(0, 0, 1));
    arrow.position.set(25 * MM, (i - 1) * 10 * MM, -84 * MM);
    return arrow;
  });

  const cutoff = part('thermal-cutoff', 'Thermal cutoff', 'An illustrative temperature switch opens at an 80 °C rise above room temperature. It stays open for the rest of the trial. Reset starts a new, cold trial; it is not an instruction for resetting a real appliance.', [0, 0, 0], frame);
  box([5, 15, 20], [33, 157, -29], 'cream', cutoff);
  rod([31, 157, -21], [37, 157, -21], 1, 'gold', cutoff);
  const contactArm = new THREE.Group(); contactArm.position.set(37 * MM, 157 * MM, -37 * MM); cutoff.add(contactArm);
  rod([0, 0, 0], [0, 0, 16], 1, 'gold', contactArm);
  const indicator = box([4, 5, 5], [33, 166, -29], 'leaf', cutoff); indicator.material = indicator.material.clone();
  rod([8.5, 0, -30], [31, 7, -21], .7, 'red', motor);
  rod([37, 157, -37], [37, 140, -94], .7, 'red', frame);
  rod([-8.5, 0, -30], [-29, -10, -94], .7, 'blue', motor);

  const drive = part('drive', 'Worm and both wheels', 'The wheel tooth surfaces follow the worm as it turns. One thread advances each wheel one tooth per motor turn. More teeth give more reduction but a smaller lead angle in this fixed-size gearbox.', [0, 0, 0], system);
  const worm = part('worm', 'Single-start worm', 'A solid helical thread joins its bored core and fits the motor shaft. Each full turn advances both wheels by one tooth.', [0, AXIS_Y * MM, 0], drive);
  const wormSpin = new THREE.Group(); worm.add(wormSpin);
  const thread = surface(kit, new THREE.BufferGeometry(), 'gold', wormSpin);
  const beaterPair = part('beater-pair', 'Both beaters', 'The wire loops overlap but stay 45 degrees out of phase. Equal, opposite beater loads cancel torque about the vertical shaft direction; motor and worm reaction still reach the housing.', [0, 0, 0], system);
  const makeWheel = sign => {
    const label = sign > 0 ? 'Right' : 'Left', id = label.toLowerCase();
    const side = part(`${id}-wheel`, `${label} worm wheel`, `This wheel moves one tooth per worm turn. Its shaft drives the ${id} beater.`, [sign * WHEEL_X * MM, AXIS_Y * MM, 0], drive);
    const wheel = new THREE.Group(); side.add(wheel);
    const gear = surface(kit, new THREE.BufferGeometry(), sign > 0 ? 'clay' : 'leaf', wheel);
    const marker = box([2, 1, 2], [11, 3.1, 0], sign > 0 ? 'red' : 'blue', wheel);
    const beaterPart = part(`${id}-beater`, `${label} beater and shaft`, 'The beater shaft is fixed to its wheel. The interleaved blades remain clear of the other beater.', [sign * WHEEL_X * MM, 0, 0], beaterPair);
    const beater = new THREE.Group(); beater.position.y = BEATER_SHAPE.bottom * MM; beaterPart.add(beater);
    beaterWire(kit, beater, MM);
    const shaft = rod([0, 70, 0], [0, 155, 0], 1.8, 'metal', beaterPart);
    ring(3, 1.8, 2, [0, 154, 0], 'metal', beaterPart);
    box([2, 2, 2], [26, 30, 0], sign > 0 ? 'red' : 'blue', beater);
    return {side, wheel, gear, marker, beaterPart, shaft, beater, sign};
  };
  const right = makeWheel(1), left = makeWheel(-1);

  const specs = {
    setting: ['Speed setting', '', null, 'Five voltages from 4.8 to 24 V. More voltage gives more speed and available torque.'],
    mixture: ['Mixture', '', MIXTURES.map(({value, label}) => ({value, label})), 'Compare fixed teaching loads. Foam does not grow or change consistency during a trial.'],
    wheel: ['Worm wheels', '', WORM_WHEELS, 'A turn of the single-start worm moves each wheel one tooth. Tooth count also changes thread pitch and efficiency in this fixed-size gearbox.'],
    fan: ['Cooling fan', '', [{value: 1, label: 'Fitted'}, {value: 0, label: 'Removed'}], 'Removing the fan visibly removes its blades and airflow. Natural cooling remains.'],
    minutes: ['Run for', 'min', null, 'The clock runs 20 times faster. The motor stops at this time, or earlier if the illustrative thermal cutoff trips.'],
  };
  for (const [name, [min, max, step]] of Object.entries(MIXER_DOMAINS)) {
    const [label, unit, options, help] = specs[name];
    control(name, label, min, max, step, D[name], unit, help, options, name === 'wheel' ? {primary: true} : undefined);
  }
  let elapsed = 0, lastClock = 0, teethShown = null;
  const hot = new THREE.Color(0xd23b1f), cool = new THREE.Color(0xce825f);
  const result = finish(values => {
    const s = sampleMixer(values, elapsed), spec = wormDimensions(values.wheel);
    if (teethShown !== values.wheel) {
      teethShown = values.wheel;
      thread.geometry.dispose(); thread.geometry = mixerWormGeometry(values.wheel).scale(MM, MM, MM);
      for (const side of [right, left]) { side.gear.geometry.dispose(); side.gear.geometry = mixerWheelGeometry(values.wheel, side.sign).scale(MM, MM, MM); }
    }
    const motorDrawn = s.motorAngle * SLOW, wheelDrawn = motorDrawn / s.G;
    spinning.rotation.z = wormSpin.rotation.z = fanSpin.rotation.z = motorDrawn;
    right.wheel.rotation.y = right.beater.rotation.y = -wheelDrawn;
    left.wheel.rotation.y = wheelDrawn; left.beater.rotation.y = Math.PI / 4 + wheelDrawn;
    for (const coil of coils) coil.material.color.copy(cool).lerp(hot, Math.min(1, s.rise / MOTOR.limit));
    knob.position.x = (values.setting - 3) * 14 * MM;
    fan.visible = Boolean(values.fan); airflow.visible = Boolean(values.fan && s.running);
    for (let i = 0; i < arrows.length; i++) arrows[i].position.z = (-87 + ((elapsed / MOTOR.heatRate * 20 + i * 17) % 51)) * MM;
    contactArm.rotation.x = s.tripped ? -.7 : 0;
    indicator.material.color.set(s.tripped ? 0xc14f39 : 0x91aa7e);
    bowl.set(values.mixture);
    const outcome = s.mode === 'ready' ? 'Ready · start a cold trial'
      : s.tripped ? `Cutoff opened at ${fixed(s.cutout / 60, 2)} min · motor stopped and cooling`
      : s.complete ? `Finished ${values.minutes} min · motor switched off`
      : `Running · ${fixed(s.elapsed / 60, 2)} of ${values.minutes} min`;
    return {state: {...s, module: spec.module, lead: spec.lead, motorDrawn, wheelDrawn}, readings: [
      r('Your result', outcome, 'The cutoff stays open after tripping. Changing a setting or replaying starts a new trial at room temperature.'),
      r('Run clock', `${fixed(s.elapsed / 60, 2)} / ${values.minutes} min`, 'Time passes 20 times faster. Gear motion is shown 60 times slower than actual operation; all gear ratios remain exact.'),
      r('Motor and beaters now', `${fixed(s.speedNow * 60 / TAU, 0)} / ${fixed(s.speedNow * 60 / TAU / s.G, 0)} rpm`, 'Both speeds fall to zero when the timer or thermal cutoff stops the motor. Startup and coasting are omitted.'),
      r('Speed while powered', `${fixed(s.rpm, 0)} rpm motor · ${fixed(s.beaterRate * 60, 0)} rpm each beater`, 'The DC motor settles where its available torque balances the mixture, bearings, iron losses and fan drag.'),
      r('Motor temperature rise', `${fixed(s.rise, 1)} °C above room`, 'One heat capacity represents the motor. Copper, iron and bearing losses warm it; after cutoff, only natural cooling remains.'),
      r('Thermal cutoff', s.cutout === null ? 'No trip at this fixed load' : `${fixed(s.cutout / 60, 2)} min if left on`, 'An illustrative 80 °C rise threshold, not a rating or operating limit for a real mixer.'),
      r('Work delivered to mixture', `${fixed(s.work / 1000, 2)} kJ`, 'Power to both beaters multiplied by time actually powered. An early trip delivers less work; this does not predict foam quality.'),
      r('Electrical input while powered', `${fixed(s.inputPower, 1)} W · ${fixed(s.voltage, 1)} V · ${fixed(s.current, 2)} A`, 'Input power equals useful beater power plus motor heat, worm friction and air moved by the fan.'),
      r('Power to both beaters', `${fixed(s.outputPower, 1)} W`, 'Useful mechanical power during the powered part of the trial, shared equally between the two beaters.'),
      r('Worm drive efficiency', `${fixed(s.eta * 100, 1)}% · ${fixed(s.gearLoss, 1)} W lost`, `${fixed(spec.lead * 180 / Math.PI, 2)}° lead, 20° normal pressure angle and illustrative friction 0.1. Gear heat is outside the motor thermal node.`),
      r('Motor heating while powered', `${fixed(s.loss, 1)} W`, `Copper ${fixed(s.copper, 1)} W + iron ${fixed(s.iron, 1)} W + bearings ${fixed(s.bearingLoss, 1)} W. Fan work ${fixed(s.fanPower, 1)} W goes to the air.`),
      r('Cooling while powered', `${fixed(s.conductance, 2)} W per °C`, values.fan ? 'Natural cooling plus shaft-speed-dependent fan cooling. Slower motors also turn the fan more slowly.' : 'Fan removed. Only the 0.50 W per °C natural cooling remains.'),
      r('Torque on each beater', `${fixed(s.beaterTorque * 1000, 0)} N·mm`, `Equal opposite loads. The ${s.G}:1 reduction divides speed and increases output torque, after losses.`),
    ]};
  });
  const render = result.update;
  result.update = (next = {}) => {
    const previous = result.getState().values;
    const readings = render(next);
    if (Object.keys(D).some(key => result.getState().values[key] !== previous[key])) { elapsed = 0; return render(); }
    return readings;
  };
  result.advance = dt => { if (Number.isFinite(dt) && dt > 0) elapsed = Math.min(result.getState().seconds, elapsed + dt); return render(); };
  result.animate = t => { const dt = Number.isFinite(t) ? Math.max(0, t - lastClock) : 0; if (Number.isFinite(t)) lastClock = t; return result.advance(dt * MOTOR.heatRate); };
  result.reset = () => { elapsed = lastClock = 0; return render(result.defaults); };
  result.actions = [
    ...[['After one minute', 60], ['At the stopping event', 'stop'], ['Finish the trial', 'end']].map(([label, time]) => ({label, group: 'Run the trial', replay: false, run() { const s = result.getState(); elapsed = time === 'end' ? s.seconds : time === 'stop' ? Math.min(s.cutout ?? s.seconds, s.seconds) : Math.min(time, s.seconds); return render(); }})),
    ...[['See the worm drive', 'drive', 'top'], ['See both beaters', 'beater-pair', 'top'], ['See the motor and fan', 'motor', 'side'], ['See the cutoff', 'thermal-cutoff', 'side'], ['See the bearings', 'bearings', 'front'], ['See the whole mixer', 'system', 'front']].map(([label, part, view]) => ({label, part, view, isolate: part !== 'system', group: 'Look closer', replay: false, run() { root.rotation.set(...(part === 'system' ? [.25, -.65, 0] : part === 'motor' ? [.15, -.45, 0] : part === 'bearings' ? [.45, -.45, 0] : [0, 0, 0])); return render(); }})),
  ];
  result.playback = {label: 'Run mixer', description: 'Run clock: 20× faster. Gear motion: 60× slower than actual operation. Watch the motor warm, then stop at the timer or thermal cutoff.', stepLabel: 'Advance the run clock by one tenth of a second', advance: dt => result.advance(dt * MOTOR.heatRate), step: () => result.advance(.1), complete: () => Boolean(result.getState().complete), blocked: () => false};
  result.resultPart = {id: 'system', label: 'Inspect the stopped mixer', view: 'front', focusOnComplete: false, available: () => Boolean(result.getState().complete)};
  result.frameBoundsForPart = id => {
    if (id !== 'system') return null;
    root.updateWorldMatrix(true, false);
    return new THREE.Box3(new THREE.Vector3(-95 * MM, 0, -103 * MM), new THREE.Vector3(95 * MM, 218 * MM, 95 * MM)).applyMatrix4(root.matrixWorld);
  };
  root.rotation.set(.25, -.65, 0);
  result.initialPart = 'system'; result.initialView = 'front'; result.frameVisibleOnly = true; result.framePadding = .62;
  result.selectionOutline = false; result.transparentBackground = true;
  result.topology = {system, bowl, frame, chassis, knob, motor, coils, spinning, fan, fanSpin, airflow, arrows, cutoff, contactArm, bearings, beaterBearings, motorBearings, drive, beaterPair, worm, wormSpin, thread, right, left, MM, SLOW, WORM, AXIS_Y, WHEEL_X};
  const dispose = result.dispose; let disposed = false;
  result.dispose = () => { if (!disposed) { disposed = true; dispose(); } };
  return result;
}

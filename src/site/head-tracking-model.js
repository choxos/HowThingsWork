import * as THREE from 'three';
import {createVrHeadsetModel, COLORS} from './vr-headset-model.js';
import {CLOCKS, MOTION_OPTIONS} from './vr-headset-physics.js';
import {TRACKING_KEYS, TRACKING_DEFAULTS, trackingStep} from './head-tracking-physics.js';
import {lineObject, textLabel} from './scene-kit.js';
import {reading} from './house-model-kit.js';
import {fixed} from './format.js';

const signed = (value, digits = 5) => `${value < -0.5 * 10 ** -digits ? '−' : '+'}${fixed(Math.abs(value), digits)}`;
const pick = values => Object.fromEntries(TRACKING_KEYS.map(key => [key, values[key]]));
const css = color => `#${color.toString(16).padStart(6, '0')}`;
const cameraInk = 0x926314, chartGuide = 0x78846c;

/** A focused tracking lesson on the same connected, supported headset. The
 * added diagrams inspect computation; they are not physical chip internals. */
export function createHeadTrackingModel() {
  const model = createVrHeadsetModel();
  const original = Object.fromEntries(['update', 'advance', 'animate', 'reset', 'getState'].map(key => [key, model[key]]));
  model.controls.splice(0, model.controls.length, ...model.controls.filter(c => TRACKING_KEYS.includes(c.key)));
  model.defaults = {...TRACKING_DEFAULTS};
  model.controls.find(c => c.key === 'scale').help = 'Signed percentage change in turning rate: negative reads too slowly; positive reads too quickly.';
  model.root.name = model.root.userData.machine = 'Head tracking';
  const retired = ['timeline', 'errors', 'frames', 'view', 'optics', 'focus', 'sound'];
  const retiredObjects = model.parts.filter(p => retired.includes(p.id)).map(p => p.object);
  model.parts.splice(0, model.parts.length, ...model.parts.filter(p => !retired.includes(p.id)));
  for (const id of retired) delete model.partViewDirections[id];
  model.parts.find(p => p.id === 'system').name = 'Connected head-tracking system';
  model.parts.find(p => p.id === 'system').description = 'The headset sends gyroscope samples to the computer, while the fixed camera supplies an independent yaw measurement. The computer combines them and uses the estimated direction for the headset output. Optics, audio and display timing stay at the parent lesson’s assigned defaults.';
  model.parts.find(p => p.id === 'imu').description = 'An illustrative gyroscope and accelerometer chip on a supported board. This lesson uses the yaw gyroscope only. The gold rate indicator is capped at a full circle for 300°/s in either direction; numerical readings retain the full rate. Internal vibrating MEMS structures are not drawn.';

  model.parts.find(p => p.id === 'display-mounts').description = 'Four telescoping supports join the back of the display panel to the inside of the front wall. Their extension stays fixed here; the parent headset lesson lets you change the screen distance. A drive mechanism is not simulated.';
  model.parts.find(p => p.id === 'earphones').description = 'Two earphones reproduce separately rendered sound channels. Head tracking updates cues for a source fixed in the virtual world. The parent headset lesson offers a visual sound-cue experiment; this lesson plays no audio.';

  const diagrams = [];
  const diagram = (id, name, description) => {
    const object = new THREE.Group(); object.name = name; object.position.z = -12;
    object.userData.inspectionOnly = id; object.userData.explosionExcluded = true;
    model.topology.system.add(object);
    model.parts.push({id, name, description, object, parentId: 'system', framePadding: .76, maxZoom: 300});
    model.partViewDirections[id] = {front: [0, 0, 3]}; diagrams.push(object);
    return object;
  };
  const label = (parent, text, y, {height = .17, color = COLORS.truth, width = 4.4, weight = ''} = {}) => textLabel(parent, text, {height, width, color: css(color), weight, position: [0, y, .02]});
  const fill = (line, points) => {
    const position = line.geometry.getAttribute('position');
    points.forEach(([x, y], i) => position.setXYZ(i, x, y, 0));
    position.needsUpdate = true; line.geometry.setDrawRange(0, points.length);
    line.geometry.computeBoundingBox(); line.geometry.computeBoundingSphere();
  };

  const arithmetic = diagram('tracking-step', 'One tracking update', 'Inspect the last completed 1 ms step: add measured angular velocity times the interval to the previous estimate, then move a fraction alpha toward the held camera direction. All numbers refer to the same sample, before and after correction.');
  label(arithmetic, 'One tracking update', 1.85, {height: .23, weight: 'bold'});
  const sampleWord = label(arithmetic, '', 1.51);
  label(arithmetic, '1. Add the gyroscope angle', 1.08, {weight: 'bold'});
  const integrateWord = label(arithmetic, '', .74, {height: .20});
  const rateWord = label(arithmetic, '', .42, {height: .15});
  label(arithmetic, '2. Pull toward the camera', -.04, {weight: 'bold'});
  const cameraWord = label(arithmetic, '', -.36);
  const correctionWord = label(arithmetic, '', -.68, {height: .18});
  label(arithmetic, '3. Keep the corrected estimate', -1.10, {weight: 'bold'});
  const estimateWord = label(arithmetic, '', -1.44, {height: .20, color: COLORS.estimate});
  const errorWord = label(arithmetic, '', -1.76, {height: .16});

  function chart(id, name, description, title, colors) {
    const object = diagram(id, name, description);
    label(object, title, 1.74, {height: .22, weight: 'bold'});
    const axes = lineObject(5, chartGuide, object);
    fill(axes, [[-1.8, 1.12], [-1.8, -1.08], [1.8, -1.08], [1.8, 1.12], [-1.8, 1.12]]);
    const yWords = [1.12, .02, -1.08].map(y => textLabel(object, '', {height: .14, width: .52, align: 'right', position: [-1.94, y, .02]}));
    for (let t = 0; t <= 3; t++) textLabel(object, String(t), {height: .14, position: [-1.8 + 1.2 * t, -1.27, .02]});
    label(object, 'Seconds · positive angles turn left', -1.55, {height: .14});
    const lines = colors.map(color => lineObject(2 * (CLOCKS.duration * CLOCKS.gyro + 1), color, object));
    const cursor = lineObject(2, chartGuide, object);
    return {object, yWords, lines, cursor, axes};
  }
  const heading = chart('tracking-heading', 'Head and estimated direction', 'The true yaw, held camera measurements and corrected estimate across the three-second run. The camera stairs expose its lower update rate. The vertical line marks the selected sample. The entire planned trace is visible, including times after the paused sample.', 'Three ways to describe direction', [COLORS.truth, cameraInk, COLORS.estimate]);
  [['Head', COLORS.truth, -1.3], ['Camera', cameraInk, 0], ['Estimate', COLORS.estimate, 1.3]].forEach(([name, color, x]) => textLabel(heading.object, name, {height: .16, color: css(color), position: [x, 1.40, .02]}));
  const drift = chart('tracking-drift', 'Tracking error over time', 'Corrected estimate minus the true yaw at each gyro sample. Positive is ahead to the left. The vertical scale fits the full run and never clips it; this is tracking error, not delayed-display error.', 'Tracking error: estimate minus head', [COLORS.estimate]);
  const rangeWord = label(drift.object, '', 1.4, {height: .15});
  let chartKey = '', readings = [], tracking;
  function present() {
    const state = original.getState(), plan = state, step = trackingStep(plan, state.clock);
    tracking = step;
    retiredObjects.forEach(object => {object.visible = false;});
    sampleWord.userData.setText(step.stage ? `Sample ${step.stage} at ${fixed(step.sampleTime, 3)} s` : 'Registered at 0°; no integrated sample yet');
    integrateWord.userData.setText(`${signed(step.previous)}° + ${signed(step.increment)}° = ${signed(step.integrated)}°`);
    rateWord.userData.setText(step.stage ? `${signed(step.rate, 2)}°/s × 0.001 s` : 'Press Step to integrate the first 1 ms');
    cameraWord.userData.setText(`Camera ${signed(step.camera, 3)}° · age ${fixed(step.cameraAge * 1000, 3)} ms`);
    correctionWord.userData.setText(`α ${fixed(step.alpha, 4)} × (${signed(step.camera, 4)} − ${signed(step.integrated, 4)}) = ${signed(step.correction, 6)}°`);
    estimateWord.userData.setText(`${signed(step.integrated)}° + ${signed(step.correction, 6)}° = ${signed(step.estimate)}°`);
    errorWord.userData.setText(`Head ${signed(step.truth, 3)}° · tracking error ${signed(step.error, 5)}°`);
    const key = JSON.stringify(pick(state.values));
    if (key !== chartKey) {
      chartKey = key;
      const x = k => -1.8 + 3.6 * k / plan.N, hy = value => -1.08 + 2.2 * (value + 35) / 110;
      const range = Math.max(.1, Math.ceil(Math.abs(plan.worstDrift.value) * 10) / 10);
      heading.yWords.forEach((word, i) => word.userData.setText(['75°', '20°', '−35°'][i]));
      drift.yWords.forEach((word, i) => word.userData.setText([`${fixed(range, 1)}°`, '0°', `−${fixed(range, 1)}°`][i]));
      rangeWord.userData.setText(`Vertical scale ±${fixed(range, 1)}° · full error retained`);
      fill(heading.lines[0], Array.from(plan.truth, (value, k) => [x(k), hy(value)]));
      fill(heading.lines[1], Array.from(plan.camera, (value, k) => [[x(k), hy(plan.camera[Math.max(0, k - 1)])], [x(k), hy(value)]]).flat());
      fill(heading.lines[2], Array.from(plan.estimate, (value, k) => [x(k), hy(value)]));
      fill(drift.lines[0], Array.from(plan.estimate, (value, k) => [x(k), .02 + 1.1 * (value - plan.truth[k]) / range]));
    }
    const cursorX = -1.8 + 3.6 * step.stage / plan.N;
    for (const plot of [heading, drift]) fill(plot.cursor, [[cursorX, -1.08], [cursorX, 1.12]]);
    readings = [
      reading('Your result', step.time <= 0 ? `Ready · ${MOTION_OPTIONS[state.values.motion].label}; press Play` : step.time >= 3 ? `End error ${signed(plan.endDrift, 2)}° · largest sample error ${fixed(Math.abs(plan.worstDrift.value), 2)}°` : `${fixed(step.time, 3)} s · estimate ${signed(step.estimate, 3)}° · error ${signed(step.error, 3)}°`),
      reading('Sample', `${step.stage} of ${plan.N} · ${fixed(step.sampleTime, 3)} s`, 'Each completed gyro sample covers one millisecond. All arithmetic below refers to that sample; positive angles turn left.'),
      reading('Head direction', `${signed(step.truth, 3)}°`, 'Known yaw at the sample time, used as the test reference. The tracker does not receive this continuous reference.'),
      reading('Gyroscope rate', `${signed(step.rate, 2)}°/s`, 'Assigned offset plus scale times the mean true turning rate over this interval. The drawing shows the packaged chip, not its internal vibrating structures.'),
      reading('Added gyro angle', `${signed(step.increment, 6)}°`, `Previous estimate ${signed(step.previous, 6)}°; before correction ${signed(step.integrated, 6)}°.`),
      reading('Camera direction', `${signed(step.camera, 3)}° · ${fixed(step.cameraAge * 1000, 3)} ms old`, `Image captured at ${fixed(step.cameraTime, 6)} s. Assigned ideal camera: 60 Hz, no measurement error or delivery delay.`),
      reading('Camera correction', `${signed(step.correction, 6)}°`, `α = ${fixed(step.alpha, 4)}. Add α × (camera direction − direction before correction).`),
      reading('Estimated direction', `${signed(step.estimate, 6)}°`, 'This corrected estimate becomes the previous estimate for the next sample.'),
      reading('Tracking error', `${signed(step.error, 6)}°`, 'Estimated direction minus true direction at the same sample. Display prediction and latency are separate effects covered in the headset lesson.'),
    ];
    return readings;
  }
  for (const name of ['update', 'advance', 'animate', 'reset']) model[name] = (...args) => {original[name](...args); return present();};
  model.getState = () => ({...original.getState(), values: pick(original.getState().values), tracking, readings});
  model.replayState = () => ({settings: pick(original.getState().values), time: 0});
  model.playback = {...model.playback, label: 'Track the head', advance: model.advance, step: () => model.advance(.05)};
  model.actions = [['Inspect: complete system', 'system'], ['Inspect: headset', 'device'], ['Inspect: gyroscope', 'imu'], ['Inspect: tracking camera', 'camera'], ['Inspect: rendering computer', 'host'], ['Read: one tracking update', 'tracking-step'], ['Compare: head, camera and estimate', 'tracking-heading'], ['Read: tracking error', 'tracking-drift']].map(([label, part]) => ({label, part, view: 'front', isolate: true, replay: false, run: () => model.update()}));
  model.thumbnailOmit.push(...diagrams);
  model.topology.tracking = {arithmetic, sampleWord, integrateWord, rateWord, cameraWord, correctionWord, estimateWord, errorWord, heading, drift, rangeWord};
  model.reset();
  return model;
}

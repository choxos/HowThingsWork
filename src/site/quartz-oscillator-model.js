import * as THREE from 'three';
import {houseModel, reading as r} from './house-model-kit.js';
import {surface, lineObject, textLabel, chartText} from './scene-kit.js';
import {fixed} from './format.js';
import {cantileverMode} from './quartz-clock-physics.js';
import {OSCILLATOR_DEFAULTS as D, OSCILLATOR_DOMAINS, OSCILLATOR_MODES, oscillatorPlan, oscillatorEnvelope, sampleOscillatorPlan} from './quartz-oscillator-physics.js';

const MM = .065, COPPER = 0xa95a38, BLUE = 0x164455;
const seconds = t => t < .001 ? `${fixed(t * 1e6, 3)} µs` : `${fixed(t, 3)} s`;
const precise = (value, digits) => value !== 0 && Math.abs(value) < .5 * 10 ** -digits ? value.toExponential(3) : fixed(value, digits);

export function createQuartzOscillatorModel() {
  const kit = houseModel('Quartz oscillator'), {root, part, control, covers} = kit;
  const system = part('system', 'Quartz oscillator', 'A powered amplifier, quartz resonator and capacitive feedback network form one oscillator. The battery supplies the energy; the resonator and its load set the approximate frequency.');
  const circuit = part('circuit', 'Complete oscillator circuit', 'An open Pierce oscillator teaching assembly. The wiring is spread out for inspection; it is not a recommended circuit-board layout.', [0, 0, 0], system);
  const box = (size, position, color, parent) => kit.box(size.map(v => v * MM), position.map(v => v * MM), color, parent);
  const rod = (a, b, radius, color, parent) => kit.rod(a.map(v => v * MM), b.map(v => v * MM), radius * MM, color, parent);
  const disk = (radius, depth, position, color, parent) => kit.disk(radius * MM, depth * MM, position.map(v => v * MM), color, parent);
  const label = (parent, text, position, height = .8, width, color = '#374736') => {const object = textLabel(parent, text, {position: position.map(v => v * MM), height: height * MM, color, ...(width ? {width: width * MM} : {})}); object.raycast = () => {}; return object;};
  const support = part('support', 'Insulating support', 'The panel and insulating mounting posts hold each component without joining its electrical terminals.', [0, 0, 0], circuit);
  const board = box([29, 24, .35], [-2, 2, -.5], 0xd6d4b2, support);
  const supply = part('supply', 'DC supply and contacts', 'An ideal 1.5 V source powers the amplifier. A zero amplifier-strength setting disables sustaining feedback. This model makes no battery-life prediction.', [-11 * MM, 3 * MM, 0], circuit);
  const supplyBody = box([3.5, 6, 1.8], [0, 0, 1.5], 'gold', supply);
  rod([0, 3, 1.5], [0, 3.6, 2], .3, 'metal', supply); rod([0, -3, 1.5], [0, -3.6, 2], .3, 'metal', supply);
  label(supply, '1.5 V', [0, 0, 2.5], .8); label(supply, '+', [0, 2, 2.5]); label(supply, '−', [0, -2, 2.5]);
  const amplifier = part('amplifier', 'Inverting sustaining amplifier', 'A biased amplifier senses a small AC input and returns an inverted output. In the complete resonant loop, phase and gain allow feedback to replace losses. Gain compression limits the vibration.', [0, 8 * MM, 0], circuit);
  const amplifierBody = box([4, 2.5, 1.6], [0, 0, 2], 'ink', amplifier); amplifierBody.material = amplifierBody.material.clone();
  for (const [a, b] of [[[-2, 0, 2], [-2.5, 0, 2]], [[2, 0, 2], [2.5, 0, 2]], [[0, 1.25, 2], [0, 1.7, 2]], [[0, -1.25, 2], [0, -1.7, 2]]]) rod(a, b, .1, COPPER, amplifier);
  label(amplifier, 'INVERT', [0, .25, 2.9], .65, undefined, '#f8f5e9');
  const gainLabel = label(amplifier, '', [0, -.55, 2.9], .5, 3.7, '#f8f5e9');
  const bias = part('bias', 'DC bias feedback resistor', 'A large 20 MΩ resistor connects output to input, biasing the inverter into its amplifying region. Its AC loading and noise are omitted from the simplified envelope calculation.', [0, 11.3 * MM, 0], circuit);
  const biasBody = box([3, .7, .7], [0, 0, 2], 'cream', bias);
  for (const sign of [-1, 1]) rod([sign * 1.5, 0, 2], [sign * 2, 0, 2], .1, COPPER, bias);
  label(bias, '20 MΩ', [0, .7, 2], .65);
  const quartz = part('quartz', 'Quartz resonator and electrodes', 'Cutaway of a 2 × 2 × 6.1 mm tuning-fork package. The internal fork and electrode paths are illustrative. Opposite tine flexure represents one coupled mode; drawn deformation is normalized, not a measured distance.', [0, 2.55 * MM, 2 * MM], circuit);
  const can = box([2, 6.1, 2], [0, 0, 0], 'metal', quartz); covers.push(can);
  const quartzBack = box([2, 6.1, .12], [0, 0, -.94], 'metal', quartz); box([1.7, .35, .18], [0, -1.8, 0], 'cream', quartz);
  const tines = [];
  for (const sign of [-1, 1]) {
    const mesh = surface(kit, new THREE.BoxGeometry(.24 * MM, 3.8 * MM, .12 * MM, 1, 32, 1), 'cream', quartz);
    mesh.position.set(sign * .43 * MM, .275 * MM, 0);
    tines.push({mesh, sign, initial: mesh.geometry.attributes.position.array.slice()});
    rod([sign * .43, -1.8, 0], [sign * .5, -3.05, 0], .055, COPPER, quartz);
  }
  label(quartz, 'QUARTZ', [0, -4.35, .2], .75);
  const capacitors = part('capacitors', 'Equal adjustable load capacitors', 'One capacitor joins each crystal terminal to common ground. With equal branches and no parasitics, their series equivalent is half the value of either capacitor. Screw angle is only an adjustment indicator.', [0, 0, 0], circuit);
  const screws = [], capLabels = [], capacitorBodies = [];
  for (const x of [-6, 6]) {
    capacitorBodies.push(disk(1.25, .8, [x, -5, 2], 'cream', capacitors));
    const screw = box([1.6, .16, .1], [x, -5, 2.5], 'ink', capacitors); screws.push(screw);
    rod([x, -3.5, 2], [x, -3.8, 2], .12, COPPER, capacitors); rod([x, -6.2, 2], [x, -6.5, 2], .12, COPPER, capacitors);
    capLabels.push(label(capacitors, '', [x, -2.5, 2.2], .75, 5));
  }
  const mounts = [];
  const mount = (body, x, y, top) => {const mesh = rod([x, y, -.325], [x, y, top], .16, 'cream', support); mounts.push({mesh, body});};
  for (const x of [-12.2, -9.8]) for (const y of [1, 5]) mount(supplyBody, x, y, .6);
  for (const x of [-1.5, 1.5]) for (const y of [7.2, 8.8]) mount(amplifierBody, x, y, 1.2);
  for (const x of [-.9, .9]) mount(biasBody, x, 11.3, 1.65);
  for (const x of [-.6, .6]) mount(quartzBack, x, 2.55, 1);
  capacitorBodies.forEach((body, i) => {for (const offset of [-.5, .5]) mount(body, (i ? 6 : -6) + offset, -5, 1.6);});
  const wiring = part('wiring', 'Signal, supply and ground paths', 'Input and output each meet a crystal lead, a load capacitor, the amplifier and one end of the bias resistor. Blue ground connects both capacitor returns and the amplifier to supply negative. Red supplies the amplifier; crossings on different heights remain insulated.', [0, 0, 0], circuit);
  const terminals = {supplyPlus: [-11, 6.6, 2], supplyMinus: [-11, -.6, 2], ampIn: [-2.5, 8, 2], ampOut: [2.5, 8, 2], ampPlus: [0, 9.7, 2], ampGround: [0, 6.3, 2], crystalIn: [-.5, -.5, 2], crystalOut: [.5, -.5, 2], biasIn: [-2, 11.3, 2], biasOut: [2, 11.3, 2], capIn: [-6, -3.5, 2], capOut: [6, -3.5, 2], groundIn: [-6, -6.5, 2], groundOut: [6, -6.5, 2]};
  const wires = [];
  const connect = (name, points, color = COPPER) => {const meshes = []; for (let i = 1; i < points.length; i++) meshes.push(rod(points[i - 1], points[i], .085, color, wiring)); wires.push({name, points, meshes});};
  for (const [side, x] of [['In', -6], ['Out', 6]]) {
    connect(`signal-${side}`, [terminals[`amp${side}`], [x, 8, 2], [x, -.5, 2], terminals[`crystal${side}`]]);
    connect(`bias-${side}`, [terminals[`bias${side}`], [x, 11.3, 2], [x, 8, 2]]);
    connect(`load-${side}`, [[x, -.5, 2], terminals[`cap${side}`]]);
    connect(`ground-${side}`, [terminals[`ground${side}`], [x, -8, 2], [0, -8, 2]], BLUE);
    for (const y of [-.5, 8]) disk(.17, .14, [x, y, 2], COPPER, wiring);
  }
  connect('positive', [terminals.supplyPlus, [-9, 6.6, .5], [-9, 10, .5], [0, 10, .5], terminals.ampPlus], 'red');
  connect('negative', [terminals.supplyMinus, [-11, -8, 2], [0, -8, 2]], BLUE);
  connect('amplifier-ground', [terminals.ampGround, [0, 6.3, .3], [3.5, 6.3, .3], [3.5, -8, .3], [0, -8, 2]], BLUE);
  label(wiring, 'COMMON GROUND', [0, -9, 2], .7);
  const statusLabel = label(support, '', [0, -11, 2], .8, 27);

  const guides = [];
  const guide = (id, name, description) => {const p = part(id, name, description, [50 * MM, 0, 0], system); p.userData.inspectionOnly = id; p.userData.explosionExcluded = true; guides.push(p); const panel = box([40, 39, .2], [0, 0, -.3], 'cream', p); panel.material = new THREE.MeshBasicMaterial({color: 0xf8f5e9}); return p;};
  const envelope = guide('envelope', 'Amplitude over eight seconds', 'Calculated amplitude envelope, not individual cycles. The blue curve follows the selected experiment. The gold level marks the nonzero steady amplitude when feedback can overcome loss.');
  const envelopePoint = (t, a) => [(-12 + 3.25 * t) * MM, (-9 + 19 * a) * MM, .1 * MM];
  const envelopeLine = lineObject(4097, BLUE, envelope), steadyLine = lineObject(2, 0xb07a20, envelope), envelopeDot = kit.sphere(.23 * MM, [0, 0, 0], 'red', envelope);
  for (const [a, b] of [[[0, 0], [8, 0]], [[0, 0], [0, 1]]]) kit.rod(envelopePoint(...a), envelopePoint(...b), .035 * MM, 'ink', envelope);
  chartText(envelope, envelopePoint, {title: 'Does the vibration grow?', size: 2.2 * MM, x: {min: 0, max: 8, title: 'Elapsed seconds', ticks: [[0, '0'], [4, '4'], [8, '8']]}, y: {min: 0, max: 1, title: 'Relative amplitude', ticks: [[0, '0'], [.5, '0.5'], [1, '1']]}});
  const envelopeStatus = label(envelope, '', [0, -17, .2], 1.5, 36);
  const waveform = guide('waveform', 'Four-cycle vibration trace', 'Signed displacement divided by the initial amplitude over four periods. This normalization makes even a tiny initial vibration visible. Positive and negative values represent the same tine in opposite directions. Select the four-cycle time view for a moving marker.');
  const wavePoint = (cycles, a) => [(-12 + 6.5 * cycles) * MM, (9 * a) * MM, .1 * MM];
  const waveLine = lineObject(257, BLUE, waveform), waveDot = kit.sphere(.23 * MM, [0, 0, 0], 'red', waveform);
  for (const [a, b] of [[[0, -1], [4, -1]], [[0, 0], [4, 0]], [[0, -1], [0, 1]]]) kit.rod(wavePoint(...a), wavePoint(...b), .035 * MM, 'ink', waveform);
  chartText(waveform, wavePoint, {title: 'Four actual crystal cycles', size: 2.2 * MM, x: {min: 0, max: 4, title: 'Completed cycles', ticks: [[0, '0'], [2, '2'], [4, '4']]}, y: {min: -1, max: 1, title: 'Amplitude / initial', ticks: [[-1, '−1'], [0, '0'], [1, '+1']]}});
  const waveTime = label(waveform, '', [0, -17, .2], 1.5, 36);
  const energy = guide('energy', 'Where the energy goes', 'Cycle-averaged energy balance: initial stored energy plus supplied work equals current stored energy plus dissipated heat. Values are from an illustrative gain-compression law, not measured product consumption.');
  label(energy, 'Energy supplied and lost', [0, 15, .2], 2.3);
  const energyLabels = [];
  for (const [i, title] of ['Initially stored', 'Added by feedback', 'Stored now', 'Lost as heat'].entries()) {label(energy, title, [0, 8 - i * 6, .2], 2); energyLabels.push(label(energy, '', [0, 5.6 - i * 6, .2], 2.2, 35));}
  label(energy, 'Initial + added = stored + lost', [0, -17, .2], 1.7);

  const specs = {
    mode: ['Time view', '', OSCILLATOR_MODES, 'Eight seconds shows the amplitude envelope without pretending to display 32,768 individual cycles per second. Four-cycle mode slows actual time 65,536 times.'],
    initial: ['Initial vibration', '', [{value: 0, label: 'Tiny seed: 0.001 amplitude'}, {value: 1, label: 'Already ringing: 0.5 amplitude'}], 'A chosen initial disturbance starts each trial. The tiny seed represents an initial fluctuation; stochastic noise is not simulated.'],
    gain: ['Amplifier strength', 'µS', null, 'Small-signal transconductance. Zero disables sustaining feedback. Increasing strength can overcome loss; nonlinear compression limits amplitude.'],
    capacitor: ['Each load capacitor', 'pF', null, 'Both equal branches change together. Their effective series load is half this value. More capacitance lowers frequency and increases the amplifier strength required for startup.'],
    resistance: ['Crystal motional resistance', 'kΩ', null, '45 kΩ typical and 60 kΩ maximum in the reference data sheet. This is mechanical and electrical loss represented by the equivalent circuit, not the 20 MΩ bias resistor.'],
  };
  for (const [key, [min, max, step]] of Object.entries(OSCILLATOR_DOMAINS)) {const [title, unit, options, help] = specs[key]; control(key, title, min, max, step, D[key], unit, help, options, {primary: key === 'mode'});}
  let time = 0, initialTime = null, preparedSettings = null, lastClock = 0, key = '', plan, disposed = false;
  const result = kit.finish(values => {
    const nextKey = JSON.stringify(values);
    if (nextKey !== key) {
      plan = oscillatorPlan(values); key = nextKey; time = Math.min(initialTime ?? 0, plan.duration); lastClock = 0;
      for (let i = 0; i <= 4096; i++) envelopeLine.geometry.attributes.position.array.set(envelopePoint(8 * i / 4096, oscillatorEnvelope(plan, 8 * i / 4096).amplitude), i * 3);
      for (let i = 0; i <= 256; i++) {
        const t = 4 * i / (256 * plan.frequency), amp = oscillatorEnvelope(plan, t).amplitude / Math.sqrt(plan.initialEnergyFraction);
        waveLine.geometry.attributes.position.array.set(wavePoint(4 * i / 256, amp * Math.sin(8 * Math.PI * i / 256)), i * 3);
      }
      const steady = Math.sqrt(plan.equilibriumEnergyFraction);
      steadyLine.geometry.attributes.position.array.set([...envelopePoint(0, steady), ...envelopePoint(8, steady)]); steadyLine.visible = plan.margin > 1;
      for (const line of [envelopeLine, steadyLine, waveLine]) {line.geometry.attributes.position.needsUpdate = true; line.geometry.computeBoundingSphere();}
    }
    const s = sampleOscillatorPlan(plan, time);
    for (const {mesh, sign, initial} of tines) {
      const position = mesh.geometry.attributes.position;
      for (let i = 0; i < position.count; i++) {const u = Math.max(0, Math.min(1, initial[i * 3 + 1] / (3.8 * MM) + .5)); position.array[i * 3] = initial[i * 3] + sign * .24 * MM * s.displayedDisplacement * cantileverMode(u);}
      position.needsUpdate = true; mesh.geometry.computeVertexNormals(); mesh.geometry.computeBoundingSphere();
    }
    amplifierBody.material.color.set(values.gain === 0 ? 0x727966 : 0x374736);
    gainLabel.userData.setText(values.gain ? `${fixed(values.gain, 1)} µS` : 'DISABLED');
    screws.forEach(o => {o.rotation.z = (values.capacitor - 12) / 28 * 1.5 * Math.PI;});
    capLabels.forEach(o => o.userData.setText(`${fixed(values.capacitor, 1)} pF`));
    statusLabel.userData.setText(values.mode ? 'Actual cycles · 1/65,536 speed' : 'Tines show amplitude envelope');
    envelopeDot.position.set(...envelopePoint(s.time, s.amplitude));
    envelopeStatus.userData.setText(`${fixed(s.margin, 2)}× startup margin · ${s.trend.toLowerCase()}`);
    waveDot.visible = values.mode === 1; waveDot.position.set(...wavePoint(Math.min(4, s.cycles), s.displacement / s.initialAmplitude));
    waveTime.userData.setText(`Four periods = ${fixed(4e6 / s.frequency, 3)} µs`);
    [s.initialEnergy, s.suppliedEnergy, s.energy, s.lostEnergy].forEach((v, i) => energyLabels[i].userData.setText(`${precise(v * 1e9, 5)} nJ`));
    return {state: s, readings: [
      r('Your result', s.trend, `${seconds(s.time)} elapsed${s.complete ? ' · experiment complete' : ''}. ${values.mode ? 'Four actual cycles slowed 65,536 times; tine deformation uses a normalized scale.' : 'Eight-second amplitude envelope; individual fast cycles are not displayed.'}`),
      r('Vibration amplitude', `${precise(s.amplitude, 6)} relative`, `Initial amplitude ${values.initial ? '0.5' : '0.001'}. Amplitude squared is the fraction of the chosen ${fixed(plan.energyScale * 1e9, 3)} nJ energy scale. Slow-motion geometry and its trace divide displacement by this initial amplitude.`),
      r('Startup margin', `${fixed(s.margin, 3)}×`, `Small-signal strength / calculated critical strength (${fixed(plan.criticalGain * 1e6, 3)} µS). Above 1 predicts initial growth in this ideal model, not guaranteed product startup.`),
      r('Loaded resonance', `${fixed(s.frequency, 5)} Hz`, `${fixed((s.frequency / 32768 - 1) * 1e6, 3)} ppm relative to 32,768 Hz. Period ${fixed(s.period * 1e6, 5)} µs. Lossless frequency estimate at 25 °C.`),
      r('Effective crystal load', `${fixed(s.load * 1e12, 2)} pF`, 'Two equal capacitors in series through common ground. Stray capacitance and amplifier phase are omitted.'),
      r('Free-decay time constant', `${fixed(s.amplitudeTau, 6)} s`, `With feedback disabled, amplitude falls to 36.8% after this time, not zero. Equivalent Q ≈ ${fixed(s.quality, 0)}.`),
      r('Energy stored', `${precise(s.energy * 1e9, 6)} nJ`, `Initial ${precise(s.initialEnergy * 1e9, 6)} nJ + supplied ${precise(s.suppliedEnergy * 1e9, 6)} nJ − heat ${precise(s.lostEnergy * 1e9, 6)} nJ.`),
      r('Feedback and loss power', `${precise(s.inputPower * 1e9, 4)} / ${precise(s.lossPower * 1e9, 4)} nW`, 'Cycle-averaged power delivered to the resonator / dissipated in its loss resistance. Equality sustains amplitude. This excludes amplifier supply overhead.'),
      r('Effective sustaining margin', `${fixed(s.effectiveMargin, 6)}×`, 'Gain compression reduces feedback as stored energy rises. A value of 1 balances energy lost per cycle; it does not remove that loss.'),
    ]};
  });
  const render = result.update;
  result.update = values => {const readings = render(values); if (preparedSettings && Object.entries(preparedSettings).every(([k, v]) => result.getState().values[k] === v)) {initialTime = null; preparedSettings = null;} return readings;};
  result.advance = dt => {if (Number.isFinite(dt) && dt > 0) {initialTime = null; preparedSettings = null; time = Math.min(plan.duration, time + dt * plan.speed);} return render();};
  result.animate = t => {const dt = Number.isFinite(t) ? Math.max(0, t - lastClock) : 0; if (Number.isFinite(t)) lastClock = t; return result.advance(dt);};
  result.reset = ({time: prepared = 0, settings} = {}) => {if (!Number.isFinite(prepared) || prepared < 0 || prepared > 8) throw new RangeError('Invalid oscillator checkpoint'); preparedSettings = {...(settings ?? result.defaults)}; oscillatorPlan(preparedSettings); initialTime = prepared; time = lastClock = 0; key = ''; return render(preparedSettings);};
  result.replayState = () => ({time: 0, settings: result.getState().values});
  const inspect = (label, id, isolate = true) => ({label, part: id, view: 'front', isolate, replay: false, run: () => render()});
  result.actions = [inspect('Inspect: complete oscillator', 'circuit', false), inspect('Inspect: quartz resonator', 'quartz'), inspect('Inspect: sustaining amplifier', 'amplifier'), inspect('Inspect: bias resistor', 'bias'), inspect('Inspect: load capacitors', 'capacitors'), inspect('Trace connected circuit paths', 'wiring', false), inspect('See amplitude growth and decay', 'envelope'), inspect('See four actual cycles', 'waveform'), inspect('Follow the energy balance', 'energy')];
  result.playback = {label: 'Run the selected experiment', description: 'Eight-second amplitude experiment, or four actual cycles slowed 65,536 times. Each setting starts a fresh trial from the chosen initial vibration.', stepLabel: 'Advance one checkpoint', advance: result.advance, step: () => result.advance(plan.step / plan.speed), complete: () => time >= plan.duration, blocked: () => false};
  result.initialPart = 'circuit'; result.initialView = 'front'; result.frameVisibleOnly = true; result.framePadding = .64; result.selectionOutline = false; result.transparentBackground = true; result.thumbnailOmit = guides;
  for (const p of result.parts) {p.maxZoom = 300; p.framePadding = guides.includes(p.object) ? .53 : .64;}
  result.frameBoundsForPart = id => {root.updateMatrixWorld(true); const object = id === 'system' ? circuit : result.parts.find(p => p.id === id)?.object; return object ? new THREE.Box3().setFromObject(object) : null;};
  result.topology = {system, circuit, support, board, mounts, supply, amplifier, amplifierBody, bias, quartz, can, tines, capacitors, screws, wiring, wires, terminals, guides, envelope, envelopePoint, envelopeLine, steadyLine, envelopeDot, waveform, wavePoint, waveLine, waveDot, energy, energyLabels, MM};
  const dispose = result.dispose; result.dispose = () => {if (disposed) return; disposed = true; dispose();};
  return result;
}

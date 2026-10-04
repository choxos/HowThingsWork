import * as THREE from 'three';
import {houseModel, reading as r} from './house-model-kit.js';
import {lineObject, textLabel, chartText} from './scene-kit.js';
import {fixed} from './format.js';
import {PIEZO as P, PIEZO_DEFAULTS as D, PIEZO_DOMAINS, PIEZO_MODES, PIEZO_LOADS, piezoPlan, samplePiezoPlan} from './piezoelectricity-physics.js';

const MM = .06, BLUE = 0x164455, COPPER = 0xa95a38;
const precise = (v, digits = 3) => v !== 0 && Math.abs(v) < .5 * 10 ** -digits ? v.toExponential(2) : fixed(v, digits);

export function createPiezoelectricityModel() {
  const kit = houseModel('Piezoelectricity'), {root, part, control} = kit;
  const system = part('system', 'Piezoelectricity experiment', 'An oriented quartz plate couples force, thickness and electrical charge. The experiment compares a passive force sensor with a voltage-driven actuator.');
  const apparatus = part('apparatus', 'Connected piezoelectric experiment', 'A supported crystal, opposed electrodes, force actuator, voltage display and selectable electrical network. The source is disconnected in force mode.', [0, 0, 0], system);
  const cell = part('cell', 'Loaded quartz cell', 'The crystal and its two electrodes between insulating platens. Inspect this close view to compare the moving upper surface with the blue unloaded-position outline.', [0, 0, 0], apparatus);
  const box = (size, position, color, parent) => kit.box(size.map(v => v * MM), position.map(v => v * MM), color, parent);
  const rod = (a, b, radius, color, parent) => kit.rod(a.map(v => v * MM), b.map(v => v * MM), radius * MM, color, parent);
  const disk = (radius, depth, position, color, parent) => kit.disk(radius * MM, depth * MM, position.map(v => v * MM), color, parent);
  const label = (parent, text, position, height = .9, width, color = '#374736') => {const object = textLabel(parent, text, {position: position.map(v => v * MM), height: height * MM, color, ...(width ? {width: width * MM} : {})}); object.raycast = () => {}; return object;};
  const support = part('support', 'Insulating base and reaction frame', 'The base supports the crystal and electrical panel. A rigid frame reacts the applied force. Its drive can regulate force, follow freely, or hold the crystal thickness fixed.', [0, 0, 0], apparatus);
  const base = box([49, 1, 23], [3, -5.45, 1], 'wood', support);
  const panel = box([27, 12, .6], [13.5, 1.05, 3.5], 'cream', support);
  box([12, 2.8, 12], [-10, -3.55, 0], 'cream', support);
  for (const x of [-18, -2]) rod([x, -4.95, -4], [x, 9.5, -4], .45, 'metal', support);
  box([17, 1, 12], [-10, 9, 0], 'metal', support);
  const crystal = part('crystal', 'X-cut quartz plate', 'The chosen plate is 10 mm × 10 mm × 1 mm. Force and electric field act through its thickness. Its side faces are stress-free in the scalar calculation. Thickness changes are magnified, not drawn to physical scale.', [0, 0, 0], cell);
  const plate = box([10, 1, 10], [-10, .5, 0], 0xaecac3, crystal);
  const electrodes = part('electrodes', 'Opposed metal electrodes', 'Conducting faces collect the electrical response. This selected orientation makes compression produce positive voltage at the upper terminal. The signs indicate voltage polarity, not counts of free electrons.', [0, 0, 0], cell);
  const lowerElectrode = box([10, .15, 10], [-10, -.075, 0], 'gold', electrodes);
  const upperElectrode = box([10, .15, 10], [-10, 1.075, 0], 'gold', electrodes);
  rod([-5, -.075, 0], [-4, -.075, 0], .12, COPPER, electrodes);
  const upperLead = rod([-5, 1.075, 0], [-4, 1.075, 0], .12, COPPER, electrodes);
  const polarity = label(electrodes, '', [-10, 2, 6.3], 1.1, 12);
  const drive = part('drive', 'Force actuator and insulating platens', 'Bonded insulating platens transmit axial force without shorting the electrodes. Force mode regulates compression. Free actuator mode follows the surface without axial load; clamped mode holds thickness fixed. The drive and platens are ideal massless constraints.', [0, 0, 0], apparatus);
  const lowerPlaten = box([12, 2, 12], [-10, -1.15, 0], 'cream', drive);
  label(drive, 'INSULATING PLATEN', [-10, -.9, 6.2], .7);
  const upperPlaten = box([12, 1, 12], [-10, 1.65, 0], 'cream', drive);
  const stem = rod([-10, 2.15, 0], [-10, 8.5, 0], .55, 'ink', drive);
  const driveLabel = label(drive, '', [-10, 7.4, 6.5], .9, 15);
  const forceArrow = new THREE.ArrowHelper(new THREE.Vector3(0, -1, 0), new THREE.Vector3(-10 * MM, 6.3 * MM, 6.7 * MM), 2.8 * MM, 0xa95a38, .6 * MM, .5 * MM); drive.add(forceArrow);
  const reference = lineObject(5, BLUE, drive);
  reference.geometry.attributes.position.array.set([[-16, 1.15, 6.1], [-4, 1.15, 6.1], [-4, 2.15, 6.1], [-16, 2.15, 6.1], [-16, 1.15, 6.1]].flat().map(v => v * MM));
  reference.geometry.attributes.position.needsUpdate = true; reference.geometry.computeBoundingSphere();
  label(drive, 'Blue outline: unloaded position', [-10, -4.3, 6.5], .65, 18);

  const meter = part('meter', 'Ideal high-impedance voltage display', 'A connected voltage display with zero input current and no extra capacitance in this model. Real instruments load a piezoelectric sensor; the separate resistance and capacitance controls let you explore that effect.', [0, 0, 0], apparatus);
  const meterBody = disk(2.7, 1, [4, 0, 7], 'ink', meter);
  disk(2.4, .15, [4, 0, 7.56], 'cream', meter);
  const needlePivot = new THREE.Group(); needlePivot.position.set(4 * MM, 0, 7.75 * MM); meter.add(needlePivot);
  rod([0, 0, 0], [0, 1.95, 0], .075, 'red', needlePivot);
  const meterTicks = [];
  for (const [value, title] of [[-50, '−50'], [0, '0'], [50, '+50']]) {
    const angle = -value * Math.PI / 100;
    meterTicks.push(label(meter, title, [4 - 1.8 * Math.sin(angle), 1.8 * Math.cos(angle), 7.85], .42, 1.5));
  }
  const meterText = label(meter, '', [4, -1.3, 7.9], .52, 4.2);
  label(meter, 'VOLTS', [4, 4.7, 7.8], .8);
  const load = part('load', 'Selectable resistance and input capacitance', 'A resistor and optional capacitance connect across the electrodes. Resistance drains charge. Added capacitance reduces force-induced voltage and increases RC discharge time. Open switches disconnect their branches.', [0, 0, 0], apparatus);
  const resistorBody = box([1.6, 3, 1], [11, -.4, 7], 'clay', load);
  for (const y of [-1.4, -.8, .3]) box([1.66, .15, 1.04], [11, y, 7], 'ink', load);
  const capacitorBody = box([3.2, 2.3, 1.1], [17, -.4, 7], 'metal', load);
  for (const x of [16.65, 17.35]) box([.12, 1.4, .12], [x, -.4, 7.65], 'ink', load);
  const loadText = label(load, '', [11, 4.7, 7.8], .7, 5.8), capText = label(load, '', [17, 4.7, 7.8], .7, 5.8);
  const source = part('source', 'Reversible ideal voltage source', 'The source drives the electrodes only in voltage-to-motion mode. Positive voltage extends the chosen orientation; reversing it contracts the plate. The ideal source can recover energy during the return ramp.', [0, 0, 0], apparatus);
  const sourceBody = box([4, 3.8, 1.5], [23, -.4, 7], 'gold', source);
  label(source, 'V', [23, -.4, 7.85], 1.2); const sourceText = label(source, '', [23, 4.7, 7.8], .7, 5.8);
  const sourceDial = box([1.1, .14, .12], [23, -.4, 7.95], 'ink', source);
  const wiring = part('wiring', 'Electrode leads and switched circuit', 'Upper and lower electrodes connect to separate buses. The voltage display always spans them. Force mode connects the chosen passive load and disconnects the source; actuator mode disconnects that load and connects the source.', [0, 0, 0], apparatus);
  const wires = [], switches = [], mounts = [];
  const connect = (name, points, color = COPPER) => {const meshes = []; for (let i = 1; i < points.length; i++) meshes.push(rod(points[i - 1], points[i], .1, color, wiring)); wires.push({name, points, meshes}); return meshes;};
  const positiveFlexible = connect('upper-electrode', [[-4, 1.075, 0], [-2.4, 1.075, 7], [-2.4, 3.5, 7], [23, 3.5, 7]]);
  connect('lower-electrode', [[-4, -.075, 0], [-1, -.075, 6], [-1, -3.5, 6], [23, -3.5, 6]], BLUE);
  connect('meter-positive', [[4, 3.5, 7], [4, 2.7, 7]]);
  connect('meter-negative', [[4, -2.7, 7], [4, -3.5, 6]], BLUE);
  for (const [name, x, top, bottom] of [['resistance', 11, 1.1, -1.9], ['capacitance', 17, .75, -1.55], ['source', 23, 1.5, -2.3]]) {
    connect(`${name}-upper`, [[x, top, 7], [x, 1.9, 7]]);
    connect(`${name}-lower`, [[x, bottom, 7], [x, -3.5, 6]], BLUE);
    disk(.17, .18, [x, 1.9, 7], COPPER, wiring); disk(.17, .18, [x, 3.5, 7], COPPER, wiring);
    const blade = rod([x, 1.9, 7], [x, 3.5, 7], .14, 'gold', wiring);
    switches.push({name, x, blade});
  }
  for (const [body, x, top] of [[meterBody, 4, 6.5], [resistorBody, 11, 6.5], [capacitorBody, 17, 6.45], [sourceBody, 23, 6.25]]) {
    for (const offset of [-.45, .45]) {const y = body.position.y / MM + offset; const mesh = rod([x, y, 3.8], [x, y, top], .2, 'cream', support); mounts.push({mesh, body});}
  }
  const status = label(support, '', [3, 12.5, 0], 1.1, 48);
  const setRod = (mesh, a, b) => {const av = new THREE.Vector3(...a.map(v => v * MM)), bv = new THREE.Vector3(...b.map(v => v * MM)), delta = bv.clone().sub(av); mesh.position.copy(av).add(bv).multiplyScalar(.5); mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), delta.clone().normalize()); mesh.scale.y = delta.length() / mesh.geometry.parameters.height;};

  const guides = [];
  const guide = (id, name, description) => {const p = part(id, name, description, [65 * MM, 0, 0], system); p.userData.inspectionOnly = id; p.userData.explosionExcluded = true; guides.push(p); const background = box([42, 41, .2], [0, 0, -.3], 'cream', p); background.material = new THREE.MeshBasicMaterial({color: 0xf8f5e9}); return p;};
  const trace = guide('trace', 'Voltage over the complete experiment', 'The calculated voltage over eight seconds. Force or voltage ramps up, holds until four seconds, ramps back to zero, then rests. The marker shows the current instant. Vertical scale adapts to the chosen experiment.');
  const tracePoint = (t, unit) => [(-12 + 3.25 * t) * MM, unit * 9 * MM, .15 * MM];
  for (const [a, b] of [[[0, -1], [8, -1]], [[0, 0], [8, 0]], [[0, -1], [0, 1]]]) kit.rod(tracePoint(...a), tracePoint(...b), .035 * MM, 'ink', trace);
  const chartLabels = chartText(trace, tracePoint, {title: 'Press, hold, release', size: 2 * MM, x: {min: 0, max: 8, title: 'Elapsed seconds', ticks: [[0, '0'], [4, '4'], [8, '8']]}, y: {min: -1, max: 1, title: 'Voltage / V', ticks: [[-1, '−'], [0, '0'], [1, '+']]}});
  const traceLine = lineObject(8200, BLUE, trace), traceDot = kit.sphere(.24 * MM, [0, 0, 0], 'red', trace);
  const traceStatus = label(trace, '', [0, -18, .2], 1.4, 38);
  const energy = guide('energy', 'Work, stored energy and heat', 'Net mechanical work plus net electrical source work equals stored electromechanical energy plus heat. A returning ideal voltage source can absorb energy; net work can fall during the release. Initial energy is zero.');
  label(energy, 'Where did the energy go?', [0, 16, .2], 2.1);
  const energyLabels = [];
  for (const [i, title] of ['Net mechanical work', 'Net source work', 'Stored now', 'Resistor heat'].entries()) {label(energy, title, [0, 9 - i * 6, .2], 1.8); energyLabels.push(label(energy, '', [0, 6.6 - i * 6, .2], 2.1, 36));}
  label(energy, 'Mechanical + source = stored + heat', [0, -18, .2], 1.45);
  const specs = {
    mode: ['Experiment', '', PIEZO_MODES, 'Compare force-induced voltage with voltage-induced motion. Changing a setting begins a fresh eight-second experiment.'],
    force: ['Peak compression force', 'N', null, 'The ideal actuator increases force, holds it until four seconds, then removes it.'],
    rise: ['Apply and release duration', 's', null, 'Each ramp takes this long. Both experiments hold until four seconds and finish at eight seconds.'],
    load: ['Electrical load', '', PIEZO_LOADS, 'Resistance across the plate sets voltage leakage. Ideal open circuit has no leakage at all.'],
    capacitance: ['Added input capacitance', 'pF', null, 'Cable and instrument capacitance are represented by one extra parallel capacitor. Zero disconnects it.'],
    voltage: ['Applied voltage', 'V', null, 'Positive voltage extends this orientation. Negative voltage contracts it. This is a ramped ideal source, not an oscillator.'],
    blocked: ['Mechanical condition', '', [{value: 0, label: 'Free thickness: no axial load'}, {value: 1, label: 'Thickness clamped by frame'}], 'Free thickness changes by dV. The clamp prevents thickness motion and carries a reaction force. Side faces remain stress-free.'],
  };
  for (const [key, [min, max, step]] of Object.entries(PIEZO_DOMAINS)) {
    const [title, unit, options, help] = specs[key], direct = ['force', 'load', 'capacitance'].includes(key), converse = ['voltage', 'blocked'].includes(key);
    control(key, title, min, max, step, D[key], unit, help, options, {primary: key === 'mode', ...(direct || converse ? {visibleWhen: v => v.mode === Number(converse)} : {})});
  }
  let time = 0, initialTime = null, preparedSettings = null, lastClock = 0, key = '', plan, plotScale = 1, plotTimes = [], disposed = false;
  const result = kit.finish(values => {
    const nextKey = JSON.stringify(values);
    if (nextKey !== key) {
      plan = piezoPlan(values); key = nextKey; time = Math.min(initialTime ?? 0, plan.duration); lastClock = 0;
      plotScale = values.mode ? Math.max(1, Math.abs(values.voltage)) : Math.max(.01, P.d * values.force / plan.capacitance);
      plotTimes = [...new Set([...Array.from({length: 8193}, (_, i) => i / 1024), values.rise, 4 + values.rise])].sort((a, b) => a - b);
      plotTimes.forEach((t, i) => traceLine.geometry.attributes.position.array.set(tracePoint(t, samplePiezoPlan(plan, t).voltage / plotScale), i * 3));
      traceLine.geometry.setDrawRange(0, plotTimes.length); traceLine.geometry.attributes.position.needsUpdate = true; traceLine.geometry.computeBoundingSphere();
      chartLabels[3].userData.setText(`−${precise(plotScale, 2)}`); chartLabels[5].userData.setText(`+${precise(plotScale, 2)}`);
      chartLabels.at(-1).userData.setText(values.mode ? 'Apply, hold, return voltage' : 'Press, hold, release');
      meterTicks[0].userData.setText(`−${precise(plotScale, 2)}`); meterTicks[2].userData.setText(`+${precise(plotScale, 2)}`);
    }
    const s = samplePiezoPlan(plan, time), top = s.displayThickness * 1000;
    plate.scale.y = top; plate.position.y = top / 2 * MM;
    upperElectrode.position.y = (top + .075) * MM; upperLead.position.y = (top + .075) * MM;
    upperPlaten.position.y = (top + .65) * MM;
    setRod(stem, [-10, top + 1.15, 0], [-10, 8.5, 0]);
    setRod(positiveFlexible[0], [-4, top + .075, 0], [-2.4, top + .075, 7]);
    setRod(positiveFlexible[1], [-2.4, top + .075, 7], [-2.4, 3.5, 7]);
    const arrowSign = s.force >= 0 ? -1 : 1;
    forceArrow.visible = s.force !== 0; forceArrow.setDirection(new THREE.Vector3(0, arrowSign, 0));
    forceArrow.setLength((.8 + 2 * Math.min(1, Math.abs(s.force) / (values.mode ? 1 : 50))) * MM, .5 * MM, .4 * MM);
    driveLabel.userData.setText(values.mode ? values.blocked ? 'THICKNESS CLAMPED' : 'FREE TO FOLLOW' : `${precise(s.force, 1)} N compression`);
    polarity.userData.setText(Math.abs(s.voltage) < 1e-10 ? 'Zero voltage' : s.voltage > 0 ? 'Upper +   Lower −' : 'Upper −   Lower +');
    needlePivot.rotation.z = -s.voltage * Math.PI / (2 * plotScale);
    meterText.userData.setText(`${precise(s.voltage)} V`);
    loadText.userData.setText(values.mode ? 'DISCONNECTED' : values.load === 0 ? 'OPEN' : `${[0, 1, 100, 1000][values.load]} GΩ`);
    capText.userData.setText(values.mode ? 'DISCONNECTED' : `${values.capacitance} pF`);
    sourceText.userData.setText(values.mode ? `${precise(s.voltage, 1)} V` : 'DISCONNECTED'); sourceDial.rotation.z = -values.voltage * Math.PI / 100;
    for (const item of switches) {const connected = item.name === 'source' ? values.mode === 1 : values.mode === 0 && (item.name === 'resistance' ? values.load !== 0 : values.capacitance !== 0); setRod(item.blade, [item.x, 1.9, 7], [item.x + (connected ? 0 : 1.2), connected ? 3.5 : 3, 7]); item.connected = connected;}
    status.userData.setText(`${values.mode ? 'Voltage drives thickness' : 'Force drives voltage'} · motion ×${plan.magnification.toLocaleString('en-US')}`);
    traceDot.position.set(...tracePoint(s.time, s.voltage / plotScale)); traceStatus.userData.setText(`${s.phase} · ${fixed(s.time, 2)} s · ${precise(s.voltage)} V`);
    [s.mechanicalWork, s.electricalWork, s.energy, s.heat].forEach((value, i) => energyLabels[i].userData.setText(`${precise(value * 1e9, 5)} nJ`));
    return {state: s, readings: [
      r('Your result', `${s.phase}${s.complete ? ' · complete' : ''}`, `${fixed(s.time, 3)} s elapsed. ${values.mode ? values.blocked ? 'The clamp prevents thickness motion and carries the reaction force.' : 'The unloaded plate follows applied voltage, including its sign.' : values.load === 0 ? 'Ideal open circuit: voltage persists during the hold.' : 'The load drains charge during the hold. Release can reverse voltage.'}`),
      r('Electrode voltage', `${precise(s.voltage, 5)} V`, `Upper terminal relative to lower. Display automatically spans ±${precise(plotScale, 2)} V for this trial. Electrode orientation determines the sign.`),
      r('Thickness change', `${precise(s.extension * 1e12, 3)} pm`, `Positive means extension; negative means compression. Actual initial thickness 1 mm. Motion is magnified ${plan.magnification.toLocaleString('en-US')} times. 1,000 pm = 1 nm.`),
      r(values.mode ? 'Clamp reaction' : 'Applied compression', `${precise(s.force, 5)} N`, values.mode ? 'Positive reaction compresses the plate. Negative reaction restrains its contraction in tension. Zero in the free-thickness experiment.' : 'The force actuator supplies mechanical work. Holding force constant does not prevent tiny additional motion as voltage leaks away.'),
      r('Electrical current', `${precise(s.current * 1e12, 4)} pA`, values.mode ? 'Positive current enters the upper electrode from the source. Negative current returns to the ideal source.' : 'Positive conventional current leaves the upper electrode through the resistance. The ideal voltage display draws zero current.'),
      ...(values.mode ? [r('Effective source capacitance', `${fixed((values.blocked ? plan.blockedCapacitance : plan.crystalCapacitance) * 1e12, 5)} pF`, values.blocked ? 'Only thickness is clamped. This is not the fully clamped three-dimensional dielectric constant.' : 'Free longitudinal response with stress-free sides.')] : [r('Total parallel capacitance', `${fixed(plan.capacitance * 1e12, 5)} pF`, `${fixed(plan.crystalCapacitance * 1e12, 5)} pF plate plus ${values.capacitance} pF input capacitance.`), r('Discharge time constant', Number.isFinite(plan.timeConstant) ? `${fixed(plan.timeConstant, 6)} s` : 'No leakage', 'During constant force, finite-load voltage falls to 36.8% in one RC time constant. This is not a time at which voltage suddenly becomes zero.'), r('Net charge through load', `${precise(s.chargeThroughLoad * 1e12, 5)} pC`, 'Signed charge transported from the upper electrode through the resistor since the start. It is not the same as dF or the charge remaining on the crystal.')]),
      r('Stored energy', `${precise(s.energy * 1e9, 6)} nJ`, `Mechanical work ${precise(s.mechanicalWork * 1e9, 6)} + source work ${precise(s.electricalWork * 1e9, 6)} = stored + heat ${precise(s.heat * 1e9, 6)} nJ. All work values are net since the start.`),
    ]};
  });
  const render = result.update;
  result.update = values => {const readings = render(values); if (preparedSettings && Object.entries(preparedSettings).every(([k, v]) => result.getState().values[k] === v)) {initialTime = null; preparedSettings = null;} return readings;};
  result.advance = dt => {if (Number.isFinite(dt) && dt > 0) {initialTime = null; preparedSettings = null; time = Math.min(plan.duration, time + dt);} return render();};
  result.animate = t => {const dt = Number.isFinite(t) ? Math.max(0, t - lastClock) : 0; if (Number.isFinite(t)) lastClock = t; return result.advance(dt);};
  result.reset = ({time: prepared = 0, settings} = {}) => {if (!Number.isFinite(prepared) || prepared < 0 || prepared > 8) throw new RangeError('Invalid piezoelectricity checkpoint'); preparedSettings = {...(settings ?? result.defaults)}; piezoPlan(preparedSettings); initialTime = prepared; time = lastClock = 0; key = ''; return render(preparedSettings);};
  result.replayState = () => ({time: 0, settings: result.getState().values});
  const inspect = (label, id, isolate = true, view = 'iso') => ({label, part: id, view, isolate, replay: false, run: () => render()});
  result.actions = [inspect('Inspect: complete experiment', 'apparatus', false), inspect('Compare crystal thickness', 'cell', false, 'front'), inspect('Inspect: quartz plate', 'crystal'), inspect('Inspect: metal electrodes', 'electrodes'), inspect('Inspect: force and clamp', 'drive', false), inspect('Inspect: voltage display', 'meter', true, 'front'), inspect('Inspect: electrical load', 'load', false), inspect('Trace electrode connections', 'wiring', false), inspect('See the voltage history', 'trace', true, 'front'), inspect('Follow work and heat', 'energy', true, 'front')];
  result.playback = {label: 'Run the piezoelectric experiment', description: 'Apply, hold until four seconds, release, then rest. Each changed setting begins a fresh eight-second trial.', stepLabel: 'Advance 0.25 seconds', advance: result.advance, step: () => result.advance(.25), complete: () => time >= plan.duration, blocked: () => false};
  result.initialPart = 'apparatus'; result.initialView = 'iso'; result.frameVisibleOnly = true; result.framePadding = .64; result.selectionOutline = false; result.transparentBackground = true; result.thumbnailOmit = guides;
  for (const p of result.parts) {p.maxZoom = 300; p.framePadding = guides.includes(p.object) ? .55 : .66;}
  result.frameBoundsForPart = id => {root.updateMatrixWorld(true); const object = id === 'system' ? apparatus : result.parts.find(p => p.id === id)?.object; if (!object) return null; const bounds = new THREE.Box3().setFromObject(object); if (id === 'cell') {bounds.union(new THREE.Box3().setFromObject(upperPlaten)); bounds.union(new THREE.Box3().setFromObject(lowerPlaten));} return bounds;};
  result.topology = {system, apparatus, cell, support, base, panel, mounts, crystal, plate, electrodes, lowerElectrode, upperElectrode, upperLead, drive, lowerPlaten, upperPlaten, stem, forceArrow, reference, meter, needlePivot, load, source, wiring, wires, switches, positiveFlexible, guides, trace, traceLine, traceDot, tracePoint, energy, energyLabels, MM, plot: () => ({times: plotTimes, scale: plotScale})};
  const dispose = result.dispose; result.dispose = () => {if (disposed) return; disposed = true; dispose();};
  return result;
}

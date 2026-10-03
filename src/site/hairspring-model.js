import * as THREE from 'three';
import {createWatchModel} from './watch-model.js';
import {reading as r} from './house-model-kit.js';
import {textLabel} from './scene-kit.js';
import {fixed} from './format.js';

export function hairspringMotion(s) {
  const angularVelocity = s.running ? 2 * Math.PI * s.frequency * s.amplitude * Math.sin(2 * Math.PI * s.frequency * s.time) : 0;
  const restoringTorque = -s.kappa * s.angle;
  const elasticEnergy = 0.5 * s.kappa * s.angle ** 2;
  const kineticEnergy = 0.5 * s.inertia * angularVelocity ** 2;
  return {angularVelocity, restoringTorque, elasticEnergy, kineticEnergy, oscillatorEnergy: elasticEnergy + kineticEnergy};
}

export function createHairspringModel() {
  const model = createWatchModel(), t = model.topology, MM = t.MM;
  model.root.name = model.root.userData.machine = 'Hairspring';
  model.covers.push(t.bridge);
  const oscillator = new THREE.Group();
  t.movement.add(oscillator); oscillator.add(t.balancePart, t.hairspring);
  for (const part of model.parts) if (['balance', 'hairspring'].includes(part.id)) part.parentId = 'oscillator';
  model.parts.push({id: 'oscillator', name: 'Balance and hairspring', description: 'The same attached ribbon bends as the balance turns. A blue guide shows restoring torque; the upper bridge is hidden by Look inside.', object: oscillator, parentId: 'movement', maxZoom: 300, framePadding: 0.7});
  const addPart = (id, name, description, object, parentId) => model.parts.push({id, name, description, object, parentId, maxZoom: 300, framePadding: 0.8});
  addPart('spring-collar', 'Inner spring collar', 'The inner ribbon end remains attached to this collar on the balance staff.', t.collar, 'balance');
  addPart('spring-stud', 'Fixed outer stud', 'The terminal end stays at this fixed stud while the active spiral changes shape.', t.stud, 'hairspring');
  addPart('spring-regulator', 'Regulator and curb pins', 'The two pins select active ribbon length. The unused terminal remains present, so changing the regulator does not remove spring material.', t.regulator, 'hairspring');

  const basic = color => new THREE.MeshBasicMaterial({color, toneMapped: false, side: THREE.DoubleSide});
  const torqueMaterial = basic(0x164455), kineticMaterial = basic(0x702e24);
  const guide = new THREE.Group(); guide.position.set(...t.POSITION.balance.map(v => v * MM), 0); oscillator.add(guide);
  guide.userData.explosionExcluded = true;
  const arcGeometry = new THREE.BufferGeometry(), count = 65, vertices = new Float32Array(count * 6), indices = [];
  arcGeometry.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
  for (let i = 0; i < count - 1; i++) {const j = 2 * i; indices.push(j, j + 2, j + 1, j + 1, j + 2, j + 3);}
  arcGeometry.setIndex(indices);
  const arc = new THREE.Mesh(arcGeometry, torqueMaterial); guide.add(arc);
  const arrowhead = new THREE.Mesh(new THREE.ConeGeometry(0.17 * MM, 0.45 * MM, 16), torqueMaterial); guide.add(arrowhead);
  const torqueBacking = new THREE.Mesh(new THREE.PlaneGeometry(12 * MM, 0.95 * MM), basic(0xf0dfaf));
  torqueBacking.position.set(0, -6.4 * MM, 8.98 * MM); guide.add(torqueBacking);
  const torqueLabel = textLabel(guide, 'Restoring torque', {height: 0.7 * MM, width: 11.5 * MM, position: [0, -6.4 * MM, 9 * MM], color: '#164455'});
  for (const object of [arc, arrowhead, torqueBacking, torqueLabel]) object.raycast = () => {};

  const energy = new THREE.Group(); energy.position.z = 13 * MM; t.system.add(energy);
  energy.userData.explosionExcluded = true; energy.userData.inspectionOnly = 'energy';
  addPart('energy', 'Spring and balance energy', 'An explanatory panel compares elastic energy in the spring with kinetic energy of the balance. Bar lengths use the same scale in microjoules. It is not a physical watch part.', energy, 'system');
  model.parts.at(-1).framePadding = 0.5;
  const board = new THREE.Mesh(new THREE.BoxGeometry(46 * MM, 34 * MM, 0.08 * MM), basic(0xf0dfaf)); board.position.z = -0.08 * MM; energy.add(board);
  const label = (text, x, y, extra = {}) => textLabel(energy, text, {height: 2.8 * MM, position: [x * MM, y * MM, 0.1 * MM], ...extra});
  label('Ideal energy exchange', 0, 14, {weight: '600'});
  label('Spring (elastic)', -19, 8, {align: 'left', width: 24 * MM, color: '#164455'});
  label('Balance (kinetic)', -19, 0, {align: 'left', width: 24 * MM, color: '#702e24'});
  const energyLabels = [label('', 19, 8, {align: 'right', width: 14 * MM}), label('', 19, 0, {align: 'right', width: 14 * MM})];
  const bars = [torqueMaterial, kineticMaterial].map((material, i) => {
    const bar = new THREE.Mesh(new THREE.BoxGeometry(30 * MM, 2.2 * MM, 0.08 * MM), material);
    bar.position.set(0, (5 - i * 8) * MM, 0.12 * MM); energy.add(bar); return bar;
  });
  const scale = new THREE.Mesh(new THREE.BoxGeometry(30 * MM, 0.06 * MM, 0.06 * MM), basic(0x394233)); scale.position.set(0, -6 * MM, 0.05 * MM); energy.add(scale);
  for (const value of [0, 2, 4, 6]) label(String(value), -15 + value * 5, -7.6);
  label('Energy (µJ)', 0, -10.8);
  const totalLabel = label('', 0, -14.4, {width: 40 * MM});
  model.thumbnailOmit = [...model.thumbnailOmit, guide, energy];

  const rawState = model.getState;
  function refresh() {
    const s = rawState(), motion = hairspringMotion(s), torque = motion.restoringTorque * 1e6;
    const span = Math.abs(torque) / 3 * 1.8, direction = Math.sign(torque), radius = 5.6, start = -Math.PI / 2;
    for (let i = 0; i < count; i++) for (let side = 0; side < 2; side++) {
      const angle = start + direction * span * i / (count - 1), radial = radius + (side ? 0.045 : -0.045), offset = 6 * i + 3 * side;
      vertices.set([radial * Math.cos(angle) * MM, radial * Math.sin(angle) * MM, 9 * MM], offset);
    }
    arcGeometry.attributes.position.needsUpdate = true; arcGeometry.computeBoundingBox(); arcGeometry.computeBoundingSphere();
    const end = start + direction * span;
    arrowhead.position.set(radius * Math.cos(end) * MM, radius * Math.sin(end) * MM, 9 * MM);
    arrowhead.rotation.z = end + (direction < 0 ? Math.PI : 0);
    arc.visible = arrowhead.visible = Math.abs(torque) > 1e-8;
    torqueLabel.userData.setText(`Restoring torque: ${Math.abs(torque) < .00005 ? '0.0000' : (torque > 0 ? '+' : '') + fixed(torque, 4)} µN·m`);
    for (const [i, value] of [motion.elasticEnergy, motion.kineticEnergy].entries()) {
      const width = value * 1e6 / 6;
      bars[i].scale.x = Math.max(width, 1e-15); bars[i].visible = width > 1e-12;
      bars[i].position.x = (-15 + 15 * width) * MM;
      energyLabels[i].userData.setText(`${fixed(value * 1e6, 4)} µJ`);
    }
    totalLabel.userData.setText(`Total: ${fixed(motion.oscillatorEnergy * 1e6, 4)} µJ`);
    return readings(s, motion);
  }
  function readings(s = rawState(), motion = hairspringMotion(s)) {
    const inherited = label => s.readings.find(item => item.label === label);
    const result = !s.running ? 'At rest · winding exhausted' : Math.abs(motion.angularVelocity) < 1e-6 ? 'Turning point · spring energy greatest' : Math.abs(s.angle) < 1e-6 ? 'Equilibrium crossing · kinetic energy greatest' : s.angle * motion.angularVelocity < 0 ? 'Spring energy → balance motion' : 'Balance motion → spring energy';
    return [
      r('Your result', result, 'Energy alternates between elastic bending and balance motion. The mainspring replaces average losses through the escapement.'),
      r('Balance angle', `${fixed(s.angle * 180 / Math.PI, 2)}°`, 'Signed displacement from the spring equilibrium. Positive angles are counterclockwise from the open movement side.'),
      r('Balance angular velocity', `${fixed(motion.angularVelocity, 3)} rad/s`, 'Positive means counterclockwise from the open movement side. Speed is greatest at equilibrium, where spring torque is zero.'),
      r('Restoring torque', `${fixed(motion.restoringTorque * 1e6, 4)} µN·m`, 'Spring torque is −κθ, opposite to displacement. The blue arrow shows its direction; its arc length represents relative magnitude.'),
      r('Spring stiffness', `${fixed(s.kappa * 1e6, 6)} µN·m/rad`, 'The ideal ribbon law is κ = Ebt³/(12L). Active length, cross section and modulus determine this value.'),
      r('Elastic spring energy', `${fixed(motion.elasticEnergy * 1e6, 4)} µJ`, 'U = κθ²/2: greatest at either turning point and zero at equilibrium.'),
      r('Balance kinetic energy', `${fixed(motion.kineticEnergy * 1e6, 4)} µJ`, 'K = Iω²/2: greatest at an equilibrium crossing and zero at a turning point.'),
      r('Full-cycle period', `${fixed(1 / s.frequency, 6)} s`, 'The natural period is 2π√(I/κ). A tick is half a cycle; this period remains a natural property even when the watch is stopped.'),
      r('Elapsed watch time', `${fixed(s.time, 6)} s`, `${s.beats} completed releases in this run. Two releases make one complete balance cycle.`),
      inherited('Active hairspring'), inherited('Supported swing'), inherited('Rate'), inherited('Energy per beat'),
    ];
  }
  const wrap = fn => (...args) => {fn(...args); return refresh();};
  for (const name of ['update', 'advance', 'animate', 'reset']) model[name] = wrap(model[name]);
  model.getState = () => {const s = rawState(); return {...s, ...hairspringMotion(s), readings: readings(s)};};
  const phaseAction = (label, phase, part = 'oscillator') => ({label, part, view: 'front', isolate: part === 'energy', replay: false, run() {
    const values = rawState().values; model.reset({phase}); return model.update(values);
  }});
  model.actions = [phaseAction('Inspect: first turning point', 0), phaseAction('Inspect: equal energy on the way in', .125), phaseAction('Inspect: equilibrium crossing', .25), phaseAction('Inspect: opposite turning point', .5), phaseAction('Inspect: return crossing', .75), phaseAction('Inspect: energy exchange', 0, 'energy'),
    ...model.actions.filter(action => ['Inspect: complete watch', 'Inspect: hairspring and regulator', 'Inspect: wind and temperature charts', 'Inspect: entry impulse', 'Inspect: exit impulse'].includes(action.label)).map(action => ({...action, run: wrap(action.run)}))];
  model.playback = {...model.playback, advance: model.advance, step: wrap(model.playback.step)};
  const inheritedBounds = model.frameBoundsForPart;
  model.frameBoundsForPart = id => {
    model.root.updateMatrixWorld(true);
    if (id === 'oscillator') return new THREE.Box3(new THREE.Vector3((t.POSITION.balance[0] - 6.4) * MM, (t.POSITION.balance[1] - 7) * MM, 0), new THREE.Vector3((t.POSITION.balance[0] + 6.4) * MM, (t.POSITION.balance[1] + 6.4) * MM, 9.5 * MM)).applyMatrix4(t.movement.matrixWorld);
    if (id === 'energy') return new THREE.Box3().setFromObject(energy);
    if (id === 'spring-collar') return new THREE.Box3().setFromObject(t.collar).union(new THREE.Box3().setFromObject(t.collarMark));
    return inheritedBounds(id);
  };
  model.initialPart = 'oscillator';
  Object.assign(t, {oscillator, torqueGuide: guide, torqueArc: arc, torqueHead: arrowhead, torqueLabel, energyPanel: energy, energyBars: bars, energyLabels, totalEnergyLabel: totalLabel});
  refresh();
  return model;
}

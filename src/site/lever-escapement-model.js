import * as THREE from 'three';
import {createWatchModel} from './watch-model.js';
import {WATCH, balance} from './watch-physics.js';
import {WATCH_CONTACT_ANGLES as CONTACT} from './watch-escapement.js';
import {reading as r} from './house-model-kit.js';
import {fixed} from './format.js';

export function createLeverEscapementModel() {
  const model = createWatchModel(), t = model.topology;
  model.root.name = model.root.userData.machine = 'Lever escapement';
  model.covers.push(t.hairspring, t.collar, t.collarMark, t.bridge);
  t.safetyRoller.material = t.safetyRoller.material.clone();
  t.safetyRoller.material.color.set(0x324b62);
  t.impulseRoller.raycast = () => {};
  const fork = new THREE.Group();
  t.lever.add(fork);
  for (const mesh of [...t.forkWalls, ...t.forkHorns]) fork.add(mesh);
  const addPart = (id, name, description, object, parentId) => model.parts.push({id, name, description, object, parentId, maxZoom: 300, framePadding: 0.8});
  addPart('fork', 'Fork and safety horns', 'The two inner walls first receive the ruby, then return an impulse to it. Curved outer horns help guide safe reentry while the safety-roller notch passes the guard.', fork, 'lever');
  addPart('guard-dart', 'Guard dart', 'The narrow dart sits below the fork. The solid safety-roller rim blocks large accidental lever movement outside the notch; normal running leaves clearance.', t.dart, 'lever');
  addPart('safety-roller', 'Notched safety roller', 'This lower roller turns with the balance. Its notch admits the guard during the intended fork passage. The geometry illustrates a safeguard, not immunity to shock.', t.safetyRoller, 'roller');
  addPart('impulse-jewel', 'Flat-faced impulse jewel', 'The ruby on the upper roller follows the balance. Its flat face takes up one fork wall during unlocking and receives a push from the opposite wall during impulse.', t.jewel, 'roller');
  t.fork = fork;
  const rawState = model.getState;
  const outsidePassage = s => s.running ? 100 * (1 - 2 * Math.asin(CONTACT.leave / s.amplitude) / Math.PI) : null;
  function readings(s = rawState()) {
    const inherited = label => s.readings.find(item => item.label === label);
    const side = s.contactSide === 0 ? 'Entry' : 'Exit';
    const flow = !s.running ? 'No continuing transfer' : s.stage === 'Unlocking' ? 'Balance → fork → locking face' : s.forkContact === 'fork drives balance' ? 'Mainspring → train → pallet → fork → balance' : s.stage === 'Free drop' ? 'Wheel crosses the pallet gap' : s.stage === 'Taking up fork clearance' ? 'Tooth drives lever across fork clearance' : s.stage === 'Drawing to the bank' ? 'New locking face draws lever toward bank' : 'Pallet holds the train; balance swings freely';
    return [
      r('Your result', !s.running ? 'Stopped · insufficient winding' : s.stage === 'Free drop' ? 'Free drop · neither pallet touches' : `${side} pallet · ${s.stage}`, !s.running ? 'Choose less starting wind used to restore a swing that can pass through the fork.' : 'The named stage follows the actual tooth, pallet and finite jewel contacts.'),
      r('Power path now', flow, 'The balance spends some energy unlocking. The mainspring replaces average losses during the driven part of each beat; clearance travel is interpolated.'),
      inherited('Working contact'),
      r('Completed releases', String(s.beats), 'Two alternating beats advance this 15-tooth wheel by one tooth space. The two half-step angles are slightly unequal in this geometry.'),
      r('Escape wheel advance', `${fixed(s.escape * 180 / Math.PI, 3)}° clockwise`, 'Measured from the initial entry lock. Small backward recoil during unlocking comes from the inclined locking face.'),
      r('Lever angle', `${fixed(s.lever * 180 / Math.PI, 3)}°`, 'The two banking positions are +5° and −5°: ten degrees of total lever travel.'),
      r('Outside fork passage', s.running ? `${fixed(outsidePassage(s), 2)}% of each cycle` : 'Unavailable while stopped', `The harmonic balance is outside ±${fixed(CONTACT.leave * 180 / Math.PI, 3)}° for this fraction of a cycle. Brief clearances inside that interval are not counted as additional free time.`),
      inherited('Supported swing'),
      inherited('Energy per beat'),
      inherited('Balance frequency'),
      inherited('Rate'),
      inherited('Mainspring'),
    ];
  }
  const wrap = fn => (...args) => { fn(...args); return readings(); };
  for (const name of ['update', 'advance', 'animate', 'reset']) model[name] = wrap(model[name]);
  model.getState = () => { const s = rawState(); return {...s, outsidePassage: outsidePassage(s), readings: readings(s)}; };
  model.actions = model.actions.map(action => ({...action, run: wrap(action.run)}));
  const phaseAction = (label, toward, side = 0, part = 'escapement') => ({label, part, view: 'front', isolate: false, replay: false, run() {
    const values = rawState().values, s = balance(values);
    if (s.running) {
      const phase = side / 2 + Math.acos(-toward / s.amplitude) / (2 * Math.PI);
      model.reset({phase}); model.update(values);
    }
    return readings();
  }});
  for (const [side, name] of [[0, 'entry'], [1, 'exit']]) {
    model.actions.push(phaseAction(`Inspect: ${name} fork clearance`, CONTACT.unlock + CONTACT.takeup / 2, side, 'fork'));
    model.actions.push(phaseAction(`Inspect: ${name} draw`, (CONTACT.release + CONTACT.drop + CONTACT.takeup + CONTACT.leave) / 2, side, 'fork'));
  }
  model.actions.unshift({label: 'Inspect: locked escapement', part: 'escapement', view: 'front', isolate: false, replay: false, run() {
    const values = rawState().values; model.reset(); return model.update(values);
  }});
  model.actions.push({label: 'Inspect: safety roller and guard', part: 'safety-roller', view: 'iso', isolate: false, replay: false, run() {
    const values = rawState().values; model.reset(); return model.update(values);
  }});
  model.playback = {...model.playback, advance: model.advance, step: wrap(model.playback.step), description: `Follow alternating contacts for two watch seconds, displayed ${WATCH.slow} times slower. Step advances one beat; reset restores the starting lock and winding.`};
  const inheritedBounds = model.frameBoundsForPart;
  model.frameBoundsForPart = id => {
    if (!['fork', 'guard-dart', 'safety-roller', 'impulse-jewel'].includes(id)) return inheritedBounds(id);
    model.root.updateMatrixWorld(true);
    const bounds = new THREE.Box3();
    for (const object of [fork, t.dart, t.safetyRoller, t.jewel]) bounds.union(new THREE.Box3().setFromObject(object));
    return bounds;
  };
  model.initialPart = 'escapement';
  return model;
}

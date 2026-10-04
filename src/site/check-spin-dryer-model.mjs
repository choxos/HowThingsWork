import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createSpinDryerModel, jugLevel, waterChartPoint, shakeChartPoint} from './spin-dryer-model.js';
import {SPIN as S, SPIN_DEFAULTS as D, sampleSpin, dropFlight, shaking, omegaOf} from './spin-dryer-physics.js';
import {spinDryerLesson as lesson} from './spin-dryer-lesson.js';
import {tally, checkFinite, checkDisposal} from './model-check-kit.mjs';
import {createPartExplosion} from './part-explosion.js';
import {frameModel} from './machine-viewer.js';
const t = tally(), m = createSpinDryerModel(), p = m.topology, {MM, G} = p;
const core = s => [s.clock, s.rpmNow, s.moisture, s.removed, s.retained, s.angle, s.shake.amplitude, s.phase];
const world = (object, a) => object.localToWorld(new THREE.Vector3(...a));
const nearVector = (a, b, label) => t.near(a.distanceTo(b), 0, 1e-10, label);
const end = (rod, sign) => world(rod, [0, sign * rod.geometry.parameters.height / 2, 0]);
let poses = 0, holeRays = 0, flights = 0;
m.root.position.set(.2, -.3, .4); m.root.rotation.set(.1, -.25, .2);
for (const settings of [{}, {rpm: 800}, {load: 4}, {wall: 0}, {lid: 0}, {rpm: 0}, {experiment: 1, rpm: 400, imbalance: .3, damping: .05}, {experiment: 1, rpm: 2800, imbalance: .3}, {experiment: 1, rpm: 400, imbalance: 0}]) {
  const v = {...D, ...settings}, times = v.experiment ? [0, .37, 4, 8, 12] : [0, 4, 19.9, 30, 100, 190, 200];
  for (const clock of times) {
    m.reset({time: clock, settings: v}); m.update(v); m.root.updateMatrixWorld(true); const s = m.getState(); poses++;
    assert.deepEqual(core(s), core(sampleSpin(v, clock)));
    t.near(p.spinner.rotation.y, s.angle, 1e-12, 'drum rotation follows integrated prescribed speed');
    t.near(p.rotor.rotation.y, s.angle, 1e-12, 'connected shaft shares drum angle');
    t.near(p.laundryRotor.rotation.y, s.angle, 1e-12, 'fabric shares drum angle');
    t.near(p.assembly.position.x, s.displacement[0] * 1000 * MM, 1e-12, 'entire assembly shares steady displacement X');
    t.near(p.assembly.position.z, s.displacement[1] * 1000 * MM, 1e-12, 'entire assembly shares steady displacement Z');
    t.near(p.frame.position.length(), 0, 0, 'cabinet remains fixed');
    t.near(p.collector.position.x, G.jugX * MM, 0, 'collector remains fixed');
    assert.equal(p.sleeve.visible, !s.steady && !v.wall); assert.equal(p.lump.visible, s.steady && v.imbalance > 0);
    t.near(p.layerMesh.scale.y, (s.steady ? 2 : v.load) * 70, 1e-12, 'fabric volume follows requested load');
    const level = jugLevel(s.removed); t.near(p.jugWater.scale.y, Math.max(.0001, level), 1e-12, 'collected level is not clipped');
    t.ok(level < G.jugHeight, 'largest load fits collector'); assert.equal(p.jugWater.visible, s.removed > 0);
    const [dx, dz] = s.displacement.map(n => n * 1000);
    for (const {coil, bottom, top} of p.springData) {
      nearVector(world(coil, [0, 0, 0]), world(p.springs, bottom.map(n => n * MM)), 'spring fixed endpoint remains mounted');
      nearVector(world(coil, [0, 80 * MM, 0]), world(p.springs, [top[0] + dx, top[1], top[2] + dz].map(n => n * MM)), 'spring upper endpoint follows platform');
    }
    for (const d of p.dampers) {
      nearVector(end(d.tube, -1), world(p.springs, d.a.map(n => n * MM)), 'damper fixed mount');
      nearVector(end(d.tube, 1), end(d.piston, -1), 'damper housing and piston remain connected');
      nearVector(end(d.piston, 1), world(p.springs, [d.b[0] + dx, d.b[1], d.b[2] + dz].map(n => n * MM)), 'damper moving mount');
    }
    // Every real hole is empty through the full metal thickness. A neighboring
    // wall ray must hit metal, so removing the entire drum cannot pass this test.
    if (clock === times[1]) for (let panel = 0; panel < 24; panel++) for (let row = 0; row < 7; row++) {
      const a = panel * Math.PI * 2 / 24, origin = world(p.spinner, [160 * Math.cos(a) * MM, (30 + row * 40) * MM, -160 * Math.sin(a) * MM]), toward = world(p.spinner, [0, (30 + row * 40) * MM, 0]).sub(origin).normalize();
      const ray = new THREE.Raycaster(origin, toward, 0, 20 * MM);
      assert.equal(ray.intersectObjects(p.panels, false).length, 0, `hole ${panel}/${row} traverses wall`);
      ray.ray.origin.copy(world(p.spinner, [160 * Math.cos(a) * MM, (45 + row * 40) * MM, -160 * Math.sin(a) * MM]));
      t.ok(ray.intersectObjects(p.panels, false).length > 0, 'metal remains between holes'); holeRays += 2;
    }
    for (const drop of p.drops.filter(d => d.visible)) {
      const f = drop.userData.flight, expected = dropFlight(f.w, f.angle, f.age, f.y);
      nearVector(drop.position, new THREE.Vector3(expected.x, expected.y, expected.z).multiplyScalar(1000 * MM), 'drop retains inertial release path');
      t.ok(Math.hypot(expected.x, expected.z) < S.tubRadius + 1e-12, 'marker never crosses outer tub');
      t.ok(f.y * 1000 <= p.layerMesh.scale.y + 4, 'release hole meets occupied fabric height'); flights++;
    }
    for (let i = 0; i <= 200; i += 20) {
      const expected = sampleSpin({...v, experiment: 0}, i);
      // The chart reflects the active experiment's prescribed water accounting.
      const retained = s.steady ? v.load * 1.5 : expected.retained, removed = s.steady ? 0 : expected.removed;
      t.near(p.waterLine.geometry.attributes.position.getY(i), waterChartPoint(i, retained)[1], 1e-6, 'retained-water chart');
      t.near(p.collectedLine.geometry.attributes.position.getY(i), waterChartPoint(i, removed)[1], 1e-6, 'collected-water chart');
    }
    const speeds = p.chartSpeeds();
    for (let i = 0; i < speeds.length; i += 17) {const amp = shaking(v.imbalance, omegaOf(speeds[i]), v.damping).amplitude; t.near(p.shakeLine.geometry.attributes.position.getY(i), shakeChartPoint(speeds[i], amp)[1], 1e-6, 'vibration plot preserves full amplitude');}
    checkFinite(m.root, t);
  }
}
// Physical clearances and attachment dimensions independent of dynamic poses.
t.near(G.drumBottom - 22, 228, 0, 'hub meets upper bearing');
t.near(G.tubFloor - 6, 224, 0, 'tub floor rests on support posts');
t.near(G.drumBottom - 4, 246, 0, 'hub upper face meets drum floor');
t.ok(p.channelA[1] > p.channelB[1], 'outlet descends toward jug');
t.ok(G.jugFloor + jugLevel(4.2) < p.channelB[1], 'outlet stays above largest collected volume');
for (let i = 0; i <= 5; i++) t.near(p.jugMarks[i].position.y / MM, G.jugFloor + jugLevel(i), 1e-10, 'fixed liter marks match cross-section');
for (const c of [p.chart, p.shakeChart]) t.ok(c.userData.inspectionOnly && c.userData.explosionExcluded && m.thumbnailOmit.includes(c), 'plots remain inspection views, not physical fragments');
t.ok(m.controls.find(c => c.key === 'experiment').primary, 'experiment selector immediately visible');
for (const trial of lesson.tryIt) for (const old of [{rpm: 0, wall: 0}, {experiment: 1, imbalance: .3}]) {
  m.reset({settings: {...D, ...old}, time: 10}); m.update({...D, ...old}); m.reset(trial.initialState); m.update(trial.values);
  assert.deepEqual(core(m.getState()), core(sampleSpin(trial.values, trial.initialState.time)));
  t.ok(m.parts.some(p => p.id === trial.part), 'preset inspection target exists');
}
const claims = [[0,'removed',2.0649166,1e-6],[0,'retained',.9350834,1e-6],[3,'retained',1.7377091,1e-6],[4,'removed',4.1629557,1e-6],[5,'removed',0,0],[5,'rpmNow',2800,1e-10],[6,'rpmNow',0,0],[7,'removed',0,0],[8,'rpmNow',1400,1e-10],[9,'amplitude',.0074169017,1e-10],[10,'amplitude',.0015889682,1e-10],[11,'amplitude',0,0],[12,'amplitude',.0026910799,1e-10],[13,'peakAmplitude',.0156195366,1e-10]];
for (const [i,key,value,tolerance] of claims) {const trial=lesson.tryIt[i],s=sampleSpin(trial.values,trial.initialState.time);t.near(key in s?s[key]:s.shake[key],value,tolerance,trial.title);}
for (const action of m.actions) {m.reset({time: 4, settings: {...D, experiment: 1}}); action.run(); t.ok(m.parts.some(p => p.id === action.part), 'action target exists'); if (action.part === 'chart') assert.equal(m.getState().values.experiment, 0); if (action.part === 'shake-chart') assert.equal(m.getState().values.experiment, 1);}
for (const experiment of [0,1]) {
  const settings={...D,experiment,rpm:800};m.reset({settings,time:0});m.update(settings);m.playback.step();t.near(m.getState().clock,experiment?1:10,0,'mode-specific time step');m.advance(1000);assert.equal(m.playback.complete(),true);const replay=m.replayState();m.reset(replay);m.update(replay.settings);assert.equal(m.getState().values.rpm,800);t.near(m.getState().clock,0,0,'replay preserves settings and starts at zero');
}
let layouts=0, groupCounts=[];
for (const experiment of [0,1]) for (const aspect of [1,1.24]) {
  const model=createSpinDryerModel();model.reset({settings:{...D,experiment},time:4});model.update({...D,experiment});const before=JSON.stringify(core(model.getState())),{camera}=frameModel(model,aspect),explosion=createPartExplosion(model,camera,aspect);explosion.update(1);
  const inverse=camera.quaternion.clone().invert(),boxes=explosion.items.map(unit=>{const b=new THREE.Box3();for(const x of [unit.bounds.min.x,unit.bounds.max.x])for(const y of [unit.bounds.min.y,unit.bounds.max.y])for(const z of [unit.bounds.min.z,unit.bounds.max.z])b.expandByPoint(new THREE.Vector3(x,y,z).add(unit.group.position).applyQuaternion(inverse));return b;});
  for(let i=0;i<boxes.length;i++)for(let j=i+1;j<boxes.length;j++)t.ok(boxes[i].max.x<=boxes[j].min.x||boxes[j].max.x<=boxes[i].min.x||boxes[i].max.y<=boxes[j].min.y||boxes[j].max.y<=boxes[i].min.y,'separated physical groups do not overlap');
  groupCounts.push(boxes.length);explosion.update(0);explosion.dispose();assert.equal(JSON.stringify(core(model.getState())),before);model.dispose();layouts++;
}
const resources=checkDisposal(m,t);m.dispose();
console.log(`PASS spin dryer model: ${t.count} checks; ${poses} poses; ${holeRays} hole/wall rays; ${flights} visible ballistic markers; ${lesson.tryIt.length*2} preset checkpoints; ${layouts} separated layouts (${groupCounts.join(',')} groups); ${resources} resources`);

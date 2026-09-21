// Egg whisk and electric mixer: the drag, the hand and the motor worked out
// here in their own terms, the drawn teeth held to their meshing phases, the
// interleaved beaters held clear of each other, and every lesson number held
// to the models.
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {
  sampleEggWhisk, eggWhiskPlan, sampleMixer, mixerPlan, beaterPower, MIXTURES, WHISK_GEARS,
  WHISK_DEFAULTS, WHISK_DOMAINS, MIXER_DEFAULTS, MIXER_DOMAINS, MOTOR,
} from './beaters-physics.js';
import {whiskBevelSpec} from './whisk-bevel-geometry.js';
import {createEggWhiskModel, toothPhases, crownRadius} from './egg-whisk-model.js';
import {createElectricMixerModel, wheelModule} from './electric-mixer-model.js';
import {eggWhiskLesson, electricMixerLesson} from './beaters-lessons.js';
import {BEATER_SHAPE, bladeRadius} from './beaters-scene.js';
import {tally, checkTrialNumbers, checkQuotedText, checkControlsMove, checkFinite, checkDisposal, checkRefusals} from './model-check-kit.mjs';

const t = tally(), TAU = Math.PI * 2, rpm = rate => rate * 60;

// 1. The physics again.
const power = (mixture, n) => {
  const {viscosity, density} = MIXTURES[mixture], D = 0.052;
  return n > 0 ? 50 * viscosity * n * n * D ** 3 + 1.5 * density * n ** 3 * D ** 5 : 0;
};
for (const mixture of [0, 1, 2, 3, 4]) for (const n of [0.1, 1, 5, 12]) t.near(beaterPower(mixture, n), power(mixture, n), 1e-9 * power(mixture, n), 'beater power curve');
const bisect = (f, target, hi) => { let lo = 0; for (let i = 0; i < 200; i++) { const mid = (lo + hi) / 2; if (f(mid) > target) hi = mid; else lo = mid; } return (lo + hi) / 2; };
for (const rate of [0.5, 1.5, 3]) for (const gear of [0, 1, 2]) for (const mixture of [0, 1, 2, 3, 4]) for (const force of [2, 12, 30]) {
  const G = WHISK_GEARS[gear].crown / 12, F = n => 2 * G * (power(mixture, G * n) / (TAU * G * n)) / 0.95 / 0.06;
  const expected = F(rate) <= force ? rate : bisect(F, force, rate), plan = eggWhiskPlan({rate, gear, mixture, force});
  t.near(plan.rate, expected, 1e-7 * rate, 'crank rate the hand can hold');
  t.near(plan.handForce, Math.min(F(rate), force), 1e-6 * force, 'force on the crank');
  t.near(plan.handPower * 0.95, 2 * plan.beaterPower, 1e-9 * plan.handPower + 1e-12, 'hand power reaches the mixture, less the gears');
}
for (const setting of [1, 2, 3, 4, 5]) for (const mixture of [0, 1, 2, 3, 4]) for (const wheel of [20, 30, 40]) for (const fan of [0, 1]) for (const minutes of [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]) {
  const values = {setting, mixture, wheel, fan, minutes}, V = 24 * setting / 5;
  const w0 = 15000 * TAU / 60, K = 24 / w0, R = 24 * K / .6;
  const lead = Math.atan((32.5 / wheel) / 12), frictionAngle = Math.atan(.1 / Math.cos(20 * Math.PI / 180));
  const efficiency = Math.tan(lead) / Math.tan(lead + frictionAngle);
  const gap = w => K * (V - K * w) / R - .004 - .02 / w0 * w - fan * 3e-9 * w * w - 2 * power(mixture, w / TAU / wheel) / (w * efficiency);
  let lo = 1e-10, hi = V / K;
  for (let i = 0; i < 150; i++) { const mid = (lo + hi) / 2; if (gap(mid) > 0) lo = mid; else hi = mid; }
  const speed = (lo + hi) / 2, current = (V - K * speed) / R;
  const heat = current * current * R + .02 / w0 * speed * speed + .004 * speed;
  const conductance = .5 + fan * 2.5 * speed / w0;
  const plan = mixerPlan(values), final = sampleMixer(values, minutes * 60), ready = sampleMixer(values, 0);
  t.near(plan.speed, speed, 1e-7, 'independent DC/load intersection');
  t.near(plan.loss, heat, 1e-8, 'independent motor heat');
  t.near(plan.inputPower, plan.outputPower + plan.gearLoss + plan.loss + plan.fanPower, 1e-7, 'all electrical power accounted for');
  t.near(plan.eta, efficiency, 1e-12, 'efficiency follows actual lead and pressure angle');
  let temperature = 0, trip = null;
  const dt = .1;
  for (let step = 0; step < minutes * 600; step++) {
    const time = step * dt;
    if (trip !== null) temperature *= Math.exp(-.5 * dt / 240);
    else {
      const slope = T => (heat - conductance * T) / 240;
      const k1 = slope(temperature), k2 = slope(temperature + dt * k1 / 2), k3 = slope(temperature + dt * k2 / 2), k4 = slope(temperature + dt * k3);
      const next = temperature + dt / 6 * (k1 + 2 * k2 + 2 * k3 + k4);
      if (next >= 80) { const fraction = (80 - temperature) / (next - temperature); trip = time + fraction * dt; temperature = 80 * Math.exp(-.5 * dt * (1 - fraction) / 240); }
      else temperature = next;
    }
  }
  t.near(final.rise, temperature, .00002, 'independent heating, cutoff and natural cooling integration');
  t.near(plan.rise, final.rise, 1e-10, 'plan and actual end state agree');
  assert.equal(final.tripped, trip !== null); assert.equal(final.speedNow, 0); assert.equal(ready.rise, 0); assert.equal(ready.speedNow, 0);
  if (trip !== null) {
    t.near(plan.cutout, trip, .00002, 'cutoff event time');
    const before = sampleMixer(values, plan.cutout - .001), at = sampleMixer(values, plan.cutout), after = sampleMixer(values, plan.cutout + .001);
    assert.equal(before.running, true); assert.equal(at.tripped, true); assert.equal(after.running, false);
    t.near(at.rise, 80, 1e-10, 'cutoff at exact threshold');
    t.near(after.motorAngle, at.motorAngle, 1e-10, 'shaft stops after trip');
  }
  t.near(final.work, plan.outputPower * final.onTime, 1e-8, 'work uses actual powered duration');
}

// Two beaters, turning opposite ways, never touch: the least distance between
// any blade of one and any blade of the other at the same height, in plan.
const segmentGap = (a0, a1, b0, b1) => {
  const cross = (p, q, r) => (q.x - p.x) * (r.y - p.y) - (q.y - p.y) * (r.x - p.x);
  if (cross(a0, a1, b0) * cross(a0, a1, b1) < 0 && cross(b0, b1, a0) * cross(b0, b1, a1) < 0) return 0;
  const toSegment = (p, s0, s1) => { const dx = s1.x - s0.x, dy = s1.y - s0.y, u = Math.max(0, Math.min(1, ((p.x - s0.x) * dx + (p.y - s0.y) * dy) / (dx * dx + dy * dy || 1))); return Math.hypot(p.x - s0.x - u * dx, p.y - s0.y - u * dy); };
  return Math.min(toSegment(a0, b0, b1), toSegment(a1, b0, b1), toSegment(b0, a0, a1), toSegment(b1, a0, a1));
};
function bladeGap(centerA, turnA, centerB, turnB) {
  let least = Infinity;
  for (let y = 0.5; y < BEATER_SHAPE.height; y += 1) {
    const r = bladeRadius(y);
    for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) {
      const a = turnA + i * Math.PI / 2, b = turnB + j * Math.PI / 2;
      least = Math.min(least, segmentGap(centerA, {x: centerA.x + r * Math.cos(a), y: centerA.y - r * Math.sin(a)}, centerB, {x: centerB.x + r * Math.cos(b), y: centerB.y - r * Math.sin(b)}));
    }
  }
  return least;
}
{
  // Plan coordinates (x, -z): the whisk's beaters sit front and back, the mixer's side by side.
  let least = Infinity;
  for (let k = 0; k <= 180; k++) {
    const spin = k / 180 * Math.PI / 2;
    least = Math.min(least, bladeGap({x: 0, y: -BEATER_SHAPE.spacing / 2}, -spin, {x: 0, y: BEATER_SHAPE.spacing / 2}, Math.PI / 4 + spin));
    least = Math.min(least, bladeGap({x: BEATER_SHAPE.spacing / 2, y: 0}, -spin, {x: -BEATER_SHAPE.spacing / 2, y: 0}, Math.PI / 4 + spin));
  }
  t.ok(least > 2 * BEATER_SHAPE.wire + 0.5, `interleaved blades pass each other: least gap ${least.toFixed(2)} mm`);
  t.ok(BEATER_SHAPE.spacing < 2 * BEATER_SHAPE.radius, 'the beaters do overlap');
}

// 2. Egg whisk drawing.
{
  const m = createEggWhiskModel(), p = m.topology, MM = p.MM;
  m.root.position.set(2, -1, 1);
  for (const gear of [0, 1, 2]) for (const time of [0, 0.03, 0.4, 1.7, 3.3, 8]) {
    m.reset(); m.update({gear}); m.advance(time); m.root.updateMatrixWorld(true);
    const s = m.getState(), teeth = WHISK_GEARS[gear].crown, phases = toothPhases({crownAngle: p.crown.rotation.z, front: p.front.pinion.rotation.y, back: p.back.pinion.rotation.y, crownTeeth: teeth});
    t.near(((phases.crown + phases.front) % 1 + 1) % 1, 0.5-p.LOADED_PHASE*12/TAU, 1e-9, 'front pinion takes up backlash on its driving flank');
    t.near(((phases.back - phases.crown) % 1 + 1) % 1, 0.5+p.LOADED_PHASE*12/TAU, 1e-9, 'back pinion takes up backlash on its driving flank');
    t.near(p.front.beater.rotation.y + p.back.beater.rotation.y, Math.PI / 4, 1e-9, 'beaters turn opposite ways, 45 degrees apart');
    t.near(p.back.beater.rotation.y - Math.PI / 4, s.G * p.crown.rotation.z, 1e-9, 'beaters turn the ratio times the crank');
    t.near(p.front.pinion.position.y / MM, p.CROWN.y, 1e-9, 'pinion cone apex at shaft-axis intersection');
    t.near(p.front.spec.distance*Math.cos(p.front.spec.pitch),crownRadius(gear),1e-9,'pinion pitch plane is one crown radius below the apex');
    for(const face of p.crownFaces)assert.equal(face.teeth.count,teeth);
    t.near(p.handArrow.userData.length, s.handForce * p.FORCE_SCALE, 1e-12, 'orange arrow is the force on the crank');
    t.near(p.limitArrow.userData.length, s.values.force * p.FORCE_SCALE, 1e-12, 'pale arrow is the force available');
    checkFinite(m.root, t);
  }
  t.ok(p.CRANK.z-3>p.SHAFT_Z+Math.max(...[36,48,60].map(n=>{const s=whiskBevelSpec(12,n);return s.distance*Math.sin(s.tip);})), 'crank clears all pinion addenda');
  t.near(p.SHAFT_Z * 2, BEATER_SHAPE.spacing, 1e-9, 'beater shafts at the checked spacing');
  checkControlsMove(m, () => [p.crown.rotation.z, p.handArrow.userData.length, p.limitArrow.userData.length, p.front.beater.rotation.y, p.crownFaces[0].teeth.count, p.bowl.mixture.material.color.toArray(), p.front.spec.pitch], model => model.advance(1), t);
  for(const mixture of [0,1,2,3,4])for(const [i,time] of [1,4,8].entries()){
    m.reset();m.update({mixture});m.actions[i].run();t.near(m.getState().elapsed,time,1e-12,'named inspection reaches its time, including dough');
    const held=m.getState();for(const action of m.actions.slice(3)){action.run();t.near(m.getState().elapsed,held.elapsed,1e-12,'close-up preserves trial time');}
  }
  m.reset();m.animate(4);t.near(m.getState().elapsed,1,1e-12,'animate uses quarter-speed trial clock');
  m.reset();m.playback.advance(4);t.near(m.getState().elapsed,1,1e-12,'viewer playback uses quarter-speed trial clock');
  m.update({force:15});t.near(m.getState().elapsed,0,1e-12,'changed settings start a fresh trial');m.advance(1);m.update({force:15});t.near(m.getState().elapsed,1,1e-12,'unchanged settings preserve trial');
  for(const reading of m.getState().readings)t.ok(reading.hint?.length>15,`reading explains ${reading.label}`);
  const run = values => { m.reset(); m.update(values); m.advance(8); return m.getState(); };
  checkTrialNumbers(eggWhiskLesson, {
    'Beat soft peaks': s => ({'360': rpm(s.beaterRate), '4.9': s.handForce, '2.63': 2 * s.beaterPower}),
    'Beat water': s => ({'0.46': s.handForce, '16,224': s.reynolds}),
    'Beat stiff peaks': s => (assert.equal(s.limited, true), {'1.5': s.values.rate, '28.4': s.wantedForce, '12': s.values.force, '0.64': s.rate, '153': rpm(s.beaterRate)}),
    'Try cookie dough': s => (assert.equal(s.limited, true), {'942.8': s.wantedForce, '0.02': s.rate}),
    'Use the smallest crown': s => ({'270': rpm(s.beaterRate), '2.73': s.handForce}),
    'Use the largest crown': s => { const small = eggWhiskPlan({gear: 0}); return {'450': rpm(s.beaterRate), '7.72': s.handForce, '1.67': s.beaterRate / small.beaterRate, '2.83': s.handForce / small.handForce}; },
    'Crank twice as fast': s => ({'720': rpm(s.beaterRate), '10.16': s.handForce, '11.49': s.handPower}),
    'Stiff peaks with less speed-up': s => (assert.equal(s.limited, true), {'12': s.values.force, '203': rpm(s.beaterRate), '153': rpm(eggWhiskPlan({mixture: 3}).beaterRate)}),
    'Push harder on stiff peaks': s => (assert.equal(s.limited, false), {'1.5': s.values.rate, '28.4': s.handForce, '15.23': 2 * s.beaterPower}),
    'Crank slowly': s => ({'120': rpm(s.beaterRate), '1.59': s.handForce}),
  }, run, t);
  checkQuotedText(eggWhiskLesson.deeper.map(section => section.body).join(' '), {
    '48 over 12 is four': `${WHISK_GEARS[1].crown} over ${WHISK_GEARS[1].pinion} is ${['', '', '', 'three', 'four', 'five'][WHISK_GEARS[1].crown / WHISK_GEARS[1].pinion]}`,
    '2.73 N': `${eggWhiskPlan({gear: 0}).handForce.toFixed(2)} N`, '7.72 N': `${eggWhiskPlan({gear: 2}).handForce.toFixed(2)} N`,
    '16,224': Math.round(eggWhiskPlan({mixture: 0}).reynolds).toLocaleString('en-US'),
  }, t);
  checkRefusals(sampleEggWhisk, WHISK_DOMAINS, t);
  checkDisposal(m, t);
}

// Actual tooth vertices and triangle centers, transformed through the drawn
// instanced meshes into the mating cone. A negative signed margin detects
// penetration. The small tolerance bounds the chord error of tessellation.
{
  const m=createEggWhiskModel(),p=m.topology,wrap=(a,t)=>((a+t/2)%t+t)%t-t/2;
  const surfacePoints=mesh=>{
    const pos=mesh.geometry.attributes.position,idx=mesh.geometry.index,points=[];
    for(let i=0;i<pos.count;i++)points.push(new THREE.Vector3().fromBufferAttribute(pos,i));
    for(let i=0;i<idx.count;i+=3)points.push(new THREE.Vector3().fromBufferAttribute(pos,idx.getX(i)).add(new THREE.Vector3().fromBufferAttribute(pos,idx.getX(i+1))).add(new THREE.Vector3().fromBufferAttribute(pos,idx.getX(i+2))).divideScalar(3));
    return points;
  };
  const margin=(v,s)=>{
    const polar=Math.acos(Math.max(-1,Math.min(1,v.z/v.length())));
    if(polar<s.root)return (polar-s.root)*s.distance;
    const az=Math.abs(wrap(Math.atan2(v.y,v.x),TAU/s.teeth));
    return Math.max(polar-s.tip,(az-s.halfAt(Math.min(s.tip,polar)))*Math.sin(polar))*s.distance;
  };
  let worstPenetration=0,widestContact=0;
  for(const gear of [0,1,2]){
    m.reset();m.update({gear,rate:1,mixture:0});const crown=p.crownFaces[0],spec=crown.spec;
    t.near(spec.pitch+p.front.spec.pitch,Math.PI/2,1e-12,'bevel pitch cones meet at right angles');
    t.near(spec.distance,p.front.spec.distance,1e-12,'mating gears share cone distance');
    t.ok(spec.width<spec.distance/3,'face width is within cone limit');
    const cp=surfacePoints(crown.teeth),pp=surfacePoints(p.front.teeth);
    for(let k=0;k<=120;k++){
      m.reset();m.update({gear,rate:1,mixture:0});m.advance(k/120/spec.teeth);m.root.updateMatrixWorld(true);
      for(const [face,side] of [[p.crownFaces[0],p.front],[p.crownFaces[1],p.back]]){
        t.near(face.group.getWorldPosition(new THREE.Vector3()).distanceTo(side.gear.getWorldPosition(new THREE.Vector3())),0,1e-10,'drawn cone apexes coincide');
        let closest=Infinity;
        for(const [mesh,points,target,targetSpec] of [[face.teeth,cp,side.gear,side.spec],[side.teeth,pp,face.group,face.spec]]){
          const into=target.matrixWorld.clone().invert().multiply(mesh.matrixWorld),instance=new THREE.Matrix4();
          for(let j=0;j<mesh.count;j++){
            mesh.getMatrixAt(j,instance);const transform=into.clone().multiply(instance);
            for(const point of points){const d=margin(point.clone().applyMatrix4(transform),targetSpec);closest=Math.min(closest,d);}
          }
        }
        t.ok(closest>=-0.012,`actual bevel mesh penetration below 0.012 mm: ${closest}`);
        t.ok(closest<0.012,`actual driving flanks remain in contact within 0.012 mm: ${closest}`);
        worstPenetration=Math.min(worstPenetration,closest);widestContact=Math.max(widestContact,closest);
      }
    }
  }
  // Rays through actual holes must pass, while rays through surrounding metal hit.
  m.reset();m.root.rotation.set(0,0,0);m.root.updateMatrixWorld(true);
  for(const z of [-p.SHAFT_Z,p.SHAFT_Z]){
    const hole=new THREE.Raycaster(new THREE.Vector3(0,1.2,z*p.MM),new THREE.Vector3(0,-1,0));
    const solid=new THREE.Raycaster(new THREE.Vector3(2.8*p.MM,1.2,z*p.MM),new THREE.Vector3(0,-1,0));
    t.ok(hole.intersectObject(p.bearings).length===0,'shaft passes through actual bearing bore');
    t.ok(solid.intersectObject(p.bearings).length>0,'metal remains beside bearing bore');
  }
  const bore=new THREE.Raycaster(new THREE.Vector3(0,2,.8),new THREE.Vector3(0,0,-1));
  t.ok(bore.intersectObject(p.hub).length===0,'fixed axle runs through rotating sleeve bore');
  let released=0;for(const mesh of [p.crownFaces[0].teeth,p.crownFaces[1].teeth,p.front.teeth,p.back.teeth])mesh.addEventListener('dispose',()=>released++);m.update({gear:0});t.near(released,4,0,'replaced instance buffers released');
  let finalReleased=0;for(const mesh of [p.crownFaces[0].teeth,p.crownFaces[1].teeth,p.front.teeth,p.back.teeth])mesh.addEventListener('dispose',()=>finalReleased++);
  console.log(`Bevel mesh: 726 phase/face cases; signed margin ${worstPenetration.toFixed(6)} to ${widestContact.toFixed(6)} mm`);
  m.dispose();
  t.near(finalReleased,4,0,'remaining instance buffers released on close');
}

// 3. Electric mixer drawing.
{
  const m = createElectricMixerModel(), p = m.topology;
  for (const wheel of [20, 30, 40]) for (const setting of [1, 3, 5]) for (const fan of [0, 1]) {
    m.reset(); m.update({wheel, setting, fan, mixture: 4, minutes: 10}); m.advance(60);
    const s = m.getState(), turn = p.wormSpin.rotation.z;
    t.near(wheelModule(wheel) * wheel / 2 + p.WORM.radius, p.WHEEL_X, 1e-9, 'worm and wheel pitch radii meet');
    t.near(p.right.wheel.rotation.y, -turn / wheel, 1e-10, 'right wheel advances one tooth per worm turn');
    t.near(p.left.wheel.rotation.y, turn / wheel, 1e-10, 'left wheel advances one tooth the other way');
    t.near(p.right.beater.rotation.y + p.left.beater.rotation.y, Math.PI / 4, 1e-10, 'interleaved blades stay 45 degrees apart');
    t.near(turn, s.motorAngle / 1200, 1e-10, 'display rotation matches declared thermal/display scales');
    assert.equal(p.fan.visible, Boolean(fan)); assert.equal(p.airflow.visible, Boolean(fan && s.running));
    t.near(p.knob.position.x / p.MM, (setting - 3) * 14, 1e-10, 'speed switch position');
    const warmth = Math.min(1, s.rise / MOTOR.limit);
    t.near(p.coils[0].material.color.r, new THREE.Color(0xce825f).lerp(new THREE.Color(0xd23b1f), warmth).r, 1e-9, 'windings track current motor temperature');
    m.advance(600); const end = m.getState(), angle = p.wormSpin.rotation.z;
    assert.equal(p.airflow.visible, false); assert.equal(end.speedNow, 0); assert.equal(end.complete, true);
    assert.equal(p.contactArm.rotation.x, end.tripped ? -.7 : 0);
    m.advance(10); t.near(p.wormSpin.rotation.z, angle, 0, 'completed shaft stays still');
    m.update({fan: 1 - fan}); assert.equal(m.getState().elapsed, 0); assert.equal(m.getState().rise, 0);
    m.advance(1); m.update({fan: 1 - fan}); assert.equal(m.getState().elapsed, 1, 'unchanged settings preserve trial');
    checkFinite(m.root, t);
  }
  const run = values => { m.reset(); m.update(values); m.advance(600); return m.getState(); };
  checkTrialNumbers(electricMixerLesson, {
    'Whip stiff peaks': s => ({'8,029': s.rpm, '268': rpm(s.beaterRate), '7.5': s.rise}),
    'Mix cookie dough': s => (assert.equal(s.tripped, false), {'2,685': s.rpm, '89': rpm(s.beaterRate), '31.3': s.outputPower, '2.51': s.cutout / 60}),
    'Take the fan out': s => (assert.equal(s.tripped, true), {'0.50': s.conductance, '6.01': s.cutout / 60}),
    'Keep the fan fitted': s => (assert.equal(s.tripped, false), {'9.24': s.cutout / 60}),
    'Beat water': s => ({'8,547': s.rpm, '0.12': s.outputPower}),
    'Turn the speed down': s => ({'2,627': s.rpm, '88': rpm(s.beaterRate), '0.90': s.outputPower}),
    'Turn the speed up': s => ({'13,387': s.rpm, '446': rpm(s.beaterRate), '23.4': s.outputPower}),
    'Full speed in dough': s => (assert.equal(s.tripped, true), {'87.6': s.outputPower, '0.77': s.cutout / 60}),
    'Fewer teeth on the wheels': s => ({'381': rpm(s.beaterRate), '268': rpm(mixerPlan().beaterRate), '7,628': s.rpm, '7.71': s.lead * 180 / Math.PI, '55.2': s.eta * 100}),
    'More teeth on the wheels': s => ({'205': rpm(s.beaterRate), '3.87': s.lead * 180 / Math.PI, '38.6': s.eta * 100}),
  }, run, t);
  checkRefusals(sampleMixer, MIXER_DOMAINS, t);
  checkDisposal(m, t);
}

console.log(`PASS beater models: ${t.count} checks, ${eggWhiskLesson.tryIt.length + electricMixerLesson.tryIt.length} trials`);

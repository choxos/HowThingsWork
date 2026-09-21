// Corkscrews: the pull, hold and leverage worked out here in their own terms,
// the worm held to its own helical track, the drawn rack and pinions held to
// their tooth outlines, and every number both lessons quote held to the models.
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {
  sampleScrewCorkscrew, screwCorkscrewPlan, sampleWingedCorkscrew, wingedCorkscrewPlan, screwTorque, wormHold,
  CORK, SCREW_DEFAULTS, SCREW_DOMAINS, WINGED_DEFAULTS, WINGED_DOMAINS, WINGS,
} from './corkscrew-physics.js';
import {createScrewCorkscrewModel} from './screw-corkscrew-model.js';
import {createWingedCorkscrewModel, rightPinionRotation} from './winged-corkscrew-model.js';
import {screwCorkscrewLesson, wingedCorkscrewLesson} from './corkscrew-lessons.js';
import {MM, NECK, wormTrack} from './corkscrew-scene.js';
import {tally, checkTrialNumbers, checkQuotedText, checkControlsMove, checkFinite, checkDisposal, checkRefusals, outlinesCross} from './model-check-kit.mjs';

const t = tally(), TAU = Math.PI * 2, degrees = radians => radians * 180 / Math.PI;

// 1. The physics in its own terms.
const grips = [120, 300, 450], widths = [9, 6];
const decide = ({worm, turns, grip}, limit) => {
  const hold = Math.PI * widths[worm] * Math.min(turns * 7, 44), need = grips[grip];
  return need <= Math.min(limit, hold) ? 'extracting' : hold < need && limit >= hold ? 'tears' : 'stalls';
};
const corkWork = (grip, out) => {
  let sum = 0;
  const n = 4000;
  for (let i = 0; i < n; i++) sum += grips[grip] * (1 - (i + 0.5) / n * out / 44) * out / n;
  return sum / 1000;
};
for (const worm of [0, 1]) for (const turns of [1, 1.5, 2, 3, 5, 6.5]) for (const grip of [0, 1, 2]) for (const pull of [100, 250, 350, 600]) {
  const values = {worm, turns, grip, pull}, plan = screwCorkscrewPlan(values);
  assert.equal(plan.outcome, decide(values, pull), `screw outcome ${JSON.stringify(values)}`);
  t.near(plan.hold, Math.PI * widths[worm] * Math.min(turns * 7, 44), 1e-9, 'worm hold');
  let previous = null;
  for (let i = 0; i <= 200; i++) {
    const s = sampleScrewCorkscrew(values, plan.duration * i / 200);
    t.ok(s.applied <= pull + 1e-9, 'pull never beyond the hand');
    if (s.mode === 'pulling') t.near(s.force, s.needNow, 1e-9, 'a moving cork is pulled with just its grip');
    if (previous) t.ok(s.out >= previous.out - 1e-12, 'the cork never slides back');
    previous = s;
  }
  const end = sampleScrewCorkscrew(values, plan.duration);
  t.near(end.work, corkWork(grip, end.out), 1e-6, 'work is the area under the grip');
  if (plan.outcome === 'extracting') t.near(end.out, 44, 1e-9, 'an extracted cork comes all the way out');
  else t.near(end.out, 0, 0, 'a stalled or torn cork does not move');
}
for (const worm of [0, 1]) for (const turns of [1, 3, 4, 6]) for (const grip of [0, 1, 2]) for (const wing of [5, 15, 25, 60]) for (const length of [60, 95, 120]) {
  const values = {worm, turns, grip, wing, length}, plan = wingedCorkscrewPlan(values), leverage = 2 * length / 14;
  t.near(plan.leverage, leverage, 1e-12, 'leverage is two wing lengths over the pinion radius');
  assert.equal(plan.outcome, decide(values, wing * leverage), `winged outcome ${JSON.stringify(values)}`);
  const end = sampleWingedCorkscrew(values, plan.duration);
  if (plan.outcome === 'extracting') {
    t.near(end.out, Math.min(44, turns * 7), 1e-9, 'the rack lifts the cork as far as the worm went in');
    t.near(end.wingAngle, 0, 1e-9, 'the wings come all the way down');
  } else t.near(end.out, 0, 0, 'nothing lifts');
  t.near(end.wingTravel, leverage * end.out, 1e-9, 'hands travel the leverage times the lift');
  let handWork = 0, last = 0;
  for (let i = 1; i <= 400; i++) {
    const s = sampleWingedCorkscrew(values, plan.duration * i / 400);
    if (s.out > last) handWork += s.wingNeed * (s.wingTravel - leverage * last);
    last = s.out;
  }
  t.near(handWork / 1000, end.work, 0.02 * end.work + 1e-3, 'the hands do the cork’s work');
}

// 2. Screw corkscrew drawing.
{
  const m = createScrewCorkscrewModel(), p = m.topology;
  m.root.position.set(1, -2, 3);
  for (const values of [{}, {worm: 1}, {turns: 1}, {turns: 6.5}, {grip: 0}]) for (const time of [0, 0.4, 1.7, 3.2, 4.99, 5.8, 6.6, 7.4, 20]) {
    m.reset(); m.update(values); m.advance(time); m.root.updateMatrixWorld(true);
    const s = m.getState(), worm = s.values.worm, radius = [3.5, 2.25][worm];
    for (const phi of [0.3, 6.1, 19.7]) {
      const point = p.system.worldToLocal(wormTrack(worm)(phi).applyMatrix4(p.worm.worm.matrixWorld));
      const psi = phi + p.corkscrew.rotation.y, lift = s.lift || 0;
      const onTrack = new THREE.Vector3(radius * Math.cos(psi) * MM, (NECK.top + s.out + lift + CORK.pitch * psi / TAU) * MM, -radius * Math.sin(psi) * MM);
      t.near(point.distanceTo(onTrack), 0, 1e-9, 'every point of the worm stays on one helical track in the cork');
    }
    const inside = p.neck.inside.visible ? p.neck.inside.scale.y / MM : 0, outside = p.neck.outside.visible ? p.neck.outside.scale.y / MM : 0;
    t.near(inside + outside, CORK.length, 1e-6, 'cork inside and outside make the whole cork');
    t.near(outside, s.out, 1e-6, 'cork drawn out as far as it is');
    t.ok(s.pierced || s.tip >= NECK.top - CORK.length + s.out - 1e-9, 'the worm stays inside the cork unless it pierces it');
    t.near(p.pullArrow.userData.length, s.screwing ? 0 : s.applied * p.PULL_SCALE, 1e-12, 'pull arrow is the pull');
    if (s.mode === 'pulling') t.near(p.gripArrow.userData.length, p.pullArrow.userData.length, 1e-12, 'a moving cork: pull and grip arrows equal');
    assert.equal(p.worm.plug.visible, s.torn);
    assert.equal(p.neck.hole.visible,false,'plain cutaway uses the geometric cavity');
    checkFinite(m.root, t);
  }
  for(const worm of [0,1])for(const turns of [1,5,6.5])for(const handle of [20,40,60]){
    m.reset();m.update({worm,turns,handle});m.root.rotation.set(0,0,0);
    const plan=screwCorkscrewPlan(m.getState().values);m.advance(plan.screwTime-.01);
    const state=m.getState(),forceSum=new THREE.Vector3(),momentSum=new THREE.Vector3();
    for(const arrow of p.turnArrows){
      const force=new THREE.Vector3(0,1,0).applyQuaternion(arrow.quaternion).multiplyScalar(arrow.userData.length/p.TURN_SCALE);
      const position=arrow.position.clone().divideScalar(MM);
      forceSum.add(force);momentSum.add(position.cross(force));
      t.near(Math.abs(arrow.position.x/MM),handle,1e-12,'drawn force line uses selected moment arm');
    }
    t.near(forceSum.length(),0,1e-12,'turning pushes form a pure couple');
    t.near(momentSum.y,-state.torque,1e-8,'drawn force couple supplies the clockwise insertion torque');
    t.near(p.bar.geometry.parameters.height*p.bar.scale.y/MM,2*handle+4,1e-8,'drawn handle follows grip span');
    t.near(state.turningForce,state.torque/(2*handle),1e-12,'longer handle lowers the turning force');
    const standard=sampleScrewCorkscrew({worm,turns},plan.duration),end=sampleScrewCorkscrew({worm,turns,handle},plan.duration);
    t.near(end.out,standard.out,0,'handle length does not increase direct extraction travel');
    t.near(end.work,standard.work,0,'handle length does not change extraction work');
    const maximum=Math.ceil(Math.max(state.need,state.hold,state.values.pull)/250)*250;
    t.near(p.chart.toY(maximum),65*MM,1e-9,'plain force axis contains every series');
    for(const line of [p.needLine,p.pullLine,p.holdLine])for(const y of [line.geometry.attributes.position.getY(0),line.geometry.attributes.position.getY(1)])t.ok(y>=0&&y<=65*MM+1e-7,'plain chart never clips a force value');
  }
  for(const values of [{turns:1},{worm:1,turns:2},{worm:1,turns:3,grip:2,pull:600}]){
    m.reset();m.update(values);m.root.position.set(0,0,0);m.root.rotation.set(0,0,0);
    const plan=screwCorkscrewPlan(m.getState().values);assert.equal(plan.outcome,'tears');
    m.advance(plan.tearTime);assert.equal(m.playback.complete(),false,'tear-out does not halt the withdrawal animation');
    for(let i=0;i<10;i++){
      m.advance(plan.depth/CORK.pullSpeed/10);const state=m.getState();
      t.near(state.out,0,0,'cork stays fixed through failure recovery');
      t.near(state.lift,state.withdrawal,0,'drawn worm follows computed withdrawal');
      t.near(state.applied,0,0,'no fictitious post-tear lifting force');
    }
    m.advance(1e-8);assert.equal(m.playback.complete(),true);t.near(m.getState().withdrawal,plan.depth,1e-7,'full engaged worm clears remaining cork');
    m.root.updateMatrixWorld(true);const plug=new THREE.Box3().setFromObject(p.worm.plug);t.near(plug.min.y,NECK.top*MM,1e-7,'torn plug ends above stationary cork');
    t.ok(p.neck.inside.geometry.attributes.color.array.some(value=>value<.6),'torn cavity has visible internal shading');
  }
  m.reset();m.update({turns:6.5});m.advance(6.49);
  const crumbHeights=p.neck.crumbs.map(crumb=>crumb.position.y);
  t.ok(p.neck.crumbs.every(crumb=>crumb.visible),'piercing inspection exposes the falling crumbs');
  m.advance(.5);for(const [i,crumb] of p.neck.crumbs.entries())t.ok(crumb.position.y<crumbHeights[i],'crumbs fall independently of the rising cork');
  m.advance(20);t.ok(p.neck.crumbs.every(crumb=>!crumb.visible),'crumbs leave the neck instead of rising with the extracted cork');
  t.ok(p.chart.captions.some(mesh=>mesh.userData.labelText==='Pull on the handle (N)'),'plain chart describes direct pull rather than wing force');
  assert.equal(p.chart.chart.userData.explosionExcluded,true,'plain force diagram is not a machine part');
  checkControlsMove(m, () => [p.corkscrew.position.y, p.corkscrew.rotation.y, p.bar.scale.y, p.turnArrows[0].position.x, p.pullArrow.userData.length, p.gripArrow.userData.length, p.neck.outside.scale.y, p.worm.helix.geometry.parameters.radius, p.neck.hole.visible, p.chart.dot.position.toArray(), [...p.pullLine.geometry.attributes.position.array]], model => model.advance(6.5), t);
  const run = values => { m.reset(); m.update(values); m.advance(30); return m.getState(); };
  checkTrialNumbers(screwCorkscrewLesson, {
    'Pull the default cork': s => (assert.equal(s.mode, 'freed'), {'35': s.depth, '300': s.need, '990': s.hold, '6.60': s.work}),
    'Screw in only one turn': s => (assert.equal(s.mode, 'torn'), {'198': s.hold, '300': s.need}),
    'Two turns are enough': s => (assert.equal(s.mode, 'freed'), {'14': s.depth, '396': s.hold, '300': s.need}),
    'Go right through': s => (assert.ok(s.pierced && s.freed), {'45.5': s.depth, '44': CORK.length}),
    'Swap in a solid screw': s => (assert.equal(s.mode, 'freed'), {'660': s.hold, '990': wormHold(0, s.depth), '523.5': screwTorque(1, s.depth), '261.5': screwTorque(0, s.depth)}),
    'Solid screw, shallow': s => (assert.equal(s.mode, 'torn'), {'396': wormHold(0, s.depth), '264': s.hold}),
    'Pull an old, loose cork': s => (assert.equal(s.mode, 'freed'), {'120': s.need, '2.64': s.work}),
    'Pull too gently': s => (assert.equal(s.mode, 'stalled'), {'250': s.values.pull, '300': s.need}),
    'Meet a synthetic cork': s => (assert.equal(s.mode, 'stalled'), {'450': s.need, '350': s.values.pull}),
    'Pull harder on it': s => (assert.equal(s.mode, 'freed'), {'450': s.need, '9.90': s.work}),
    'Use a short handle': s => (assert.equal(s.mode,'freed'), {'261.5':screwTorque(0,s.depth),'6.54':s.handleForce,'300':s.need}),
    'Use a long handle': s => (assert.equal(s.mode,'freed'), {'2.18':s.handleForce,'300':s.need,'6.60':s.work}),
  }, run, t);
  const depth = SCREW_DEFAULTS.turns * CORK.pitch;
  checkQuotedText(screwCorkscrewLesson.deeper.map(section => section.body).join(' '), {
    '6.60 J': `${(300 * 22 / 1000).toFixed(2)} J`, '22 mm': `${CORK.length / 2} mm`, '990 N': `${wormHold(0, depth).toFixed(0)} N`,
    '261.5 N·mm': `${screwTorque(0, depth).toFixed(1)} N·mm`, '3.27 N': `${(screwTorque(0, depth) / 80).toFixed(2)} N`,
  }, t);
  m.reset(); m.actions[3].run(); assert.equal(m.playback.complete(), true); assert.equal(m.resultPart.available(), true);
  m.reset(); assert.equal(m.playback.complete(), false);
  checkRefusals(sampleScrewCorkscrew, SCREW_DOMAINS, t);
  checkDisposal(m, t);
}

// 3. Winged corkscrew drawing.
{
  const m = createWingedCorkscrewModel(), p = m.topology;
  const rackOutline = () => p.rackMesh.geometry.parameters.points.map(q => ({r: q.x / MM, h: q.y / MM}));
  const turn = (points, angle, cx, cy) => points.map(q => ({x: q.x * Math.cos(angle) - q.y * Math.sin(angle) + cx, y: q.x * Math.sin(angle) + q.y * Math.cos(angle) + cy}));
  let meshTests = 0;
  for (const values of [{}, {turns: 4}, {length: 120}, {grip: 2, wing: 35}, {worm: 1}]) for (const time of [0, 0.5, 2.2, 3.9, 6, 7, 7.9, 8.6, 9.3, 20]) {
    m.reset(); m.update(values); m.advance(time); m.root.updateMatrixWorld(true);
    const s = m.getState(), tip = NECK.top - s.depthNow + s.out + s.withdrawal;
    t.near(p.rack.position.y / MM, tip, 1e-9, 'rack carried by the worm tip');
    t.near(s.rightRotation - rightPinionRotation(NECK.top), (NECK.top - tip) / WINGS.pinionRadius, 1e-9, 'pinion turns the rack’s drop over its radius');
    t.near(p.wings[0].arm.rotation.z, s.wingAngle, 1e-9, 'right wing turned by the wing angle');
    t.near(p.wings[1].arm.rotation.z, -s.wingAngle, 1e-9, 'left wing turned the other way');
    const rack = rackOutline(), right = rack.map(q => ({x: q.r, y: tip + q.h})), left = rack.map(q => ({x: -q.r, y: tip + q.h}));
    for (const w of p.wings) {
      const outline = turn(w.pinion.geometry.parameters.shapes.getPoints(), w.pinion.rotation.z, w.side * p.PINION_X, p.PINION_Y);
      t.ok(!outlinesCross(outline, w.side > 0 ? right : left), 'pinion teeth clear the rack teeth');
      meshTests++;
    }
    const paddle = p.system.worldToLocal(p.wings[0].paddle.getWorldPosition(new THREE.Vector3()));
    t.near(paddle.x / MM, p.PINION_X + s.values.length * Math.sin(s.wingAngle), 1e-6, 'wing end swings on its pin');
    t.near(paddle.y / MM, p.PINION_Y - s.values.length * Math.cos(s.wingAngle), 1e-6, 'wing end swings on its pin');
    if (s.mode === 'pulling') t.near(p.liftArrow.userData.length / p.wings[0].push.userData.length, s.leverage, 1e-9, 'rack arrow is the leverage times a wing arrow');
    checkFinite(m.root, t);
  }
  {
    m.reset(); m.root.updateMatrixWorld(true);
    const w = p.wings[0], rack = rackOutline().map(q => ({x: q.r, y: NECK.top + q.h}));
    t.ok(outlinesCross(turn(w.pinion.geometry.parameters.shapes.getPoints(), w.pinion.rotation.z + Math.PI / p.TEETH, p.PINION_X, p.PINION_Y), rack), 'a pinion half a tooth out would hit the rack');
  }
  t.ok(p.PINION_X - 2.6 > NECK.lip, 'hanging wings clear the bottle lip');
  for(const length of [60,95,120])for(const time of [0,1,2,3,4,5,6]){
    m.reset();m.update({length});m.advance(time);m.root.updateMatrixWorld(true);
    for(const w of p.wings)for(const mesh of [w.lever,w.paddle]){
      const vertices=mesh.geometry.attributes.position;
      for(let i=0;i<vertices.count;i++){
        const v=p.system.worldToLocal(new THREE.Vector3().fromBufferAttribute(vertices,i).applyMatrix4(mesh.matrixWorld)).divideScalar(MM);
        if(v.y>=0&&v.y<=140)t.ok(Math.hypot(v.x,v.z)>19,'full handle surface clears bottle and body, including the wide grip');
      }
    }
  }
  m.reset();m.root.rotation.set(0,0,0);m.root.updateMatrixWorld(true);
  for(const w of p.wings){
    const armBounds=new THREE.Box3().setFromObject(w.lever),stop=p.stops.children.find(o=>Math.sign(o.position.x)===w.side),stopBounds=new THREE.Box3().setFromObject(stop);
    t.near(w.side>0?stopBounds.max.x:stopBounds.min.x,w.side>0?armBounds.min.x:armBounds.max.x,1e-7,'lower stop contacts the lowered arm');
    t.ok(stopBounds.min.z<armBounds.min.z&&stopBounds.max.z>armBounds.max.z,'stop spans the arm depth');
    t.ok(stopBounds.min.y<armBounds.max.y&&stopBounds.max.y>armBounds.min.y,'stop contacts the arm length');
    const hole=p.frontPlateShape.holes.find(path=>Math.sign(path.getPoint(0).x)===w.side);
    t.ok(hole,'front bearing hole exists');
    const boreRadius=Math.abs(hole.getPoint(0).x-w.side*p.PINION_X);
    t.ok(boreRadius>3.5,'rotating hub clears front plate');
    const pin=p.pins.find(o=>Math.sign(o.position.x)===w.side);
    t.ok(pin.geometry.parameters.radiusTop<2.2*MM,'stationary pin clears rotating hub bore');
    const pinBounds=new THREE.Box3().setFromObject(pin),hubBounds=new THREE.Box3().setFromObject(w.hub);
    t.ok(pinBounds.min.z<hubBounds.min.z&&pinBounds.max.z>hubBounds.max.z,'fixed pin supports the full offset hub');
  }
  const cutFaceContains=(geometry,x,y)=>{
    const positions=geometry.attributes.position,index=geometry.index;
    const point=new THREE.Vector3(x,y,0);
    for(let i=0;i<index.count;i+=3){
      const triangle=new THREE.Triangle(...[0,1,2].map(offset=>new THREE.Vector3().fromBufferAttribute(positions,index.getX(i+offset))));
      if(triangle.containsPoint(point))return true;
    }
    return false;
  };
  for(const values of [{turns:1},{turns:1.5,grip:2},{turns:2,worm:1}]){
    m.reset();m.update(values);m.root.rotation.set(0,0,0);
    const plan=wingedCorkscrewPlan(m.getState().values);
    assert.equal(plan.outcome,'tears');
    m.advance(plan.tearTime);let previousTip=m.getState().tip;
    t.near(m.getState().withdrawal,0,1e-9,'tear-out starts at the engaged depth');
    assert.equal(m.playback.complete(),false,'failure recovery remains visible before completion');
    const face=p.neck.inside.children[1].geometry,d=plan.depth/CORK.length;
    t.ok(!cutFaceContains(face,0,.5-d/2),'actual cork cut-face leaves the torn central cavity open');
    t.ok(cutFaceContains(face,.8,.5-d/2),'cork remains beside the torn cavity');
    t.ok(cutFaceContains(face,0,.5-d-.05),'cork remains below the torn plug');
    for(let i=0;i<10;i++){
      m.advance(plan.depth/CORK.pullSpeed/10);const state=m.getState();
      t.near(state.out,0,0,'torn cork stays in the neck');
      t.ok(state.tip>=previousTip,'loose worm withdraws monotonically');previousTip=state.tip;
      t.near(state.wingAngle,(plan.depth-state.withdrawal)/14,1e-9,'withdrawal returns the meshed wings toward the stops');
      t.near(state.lift,0,0,'failure recovery claims no calculated lifting force');
    }
    m.advance(1e-8);assert.equal(m.playback.complete(),true);
    t.near(m.getState().withdrawal,plan.depth,1e-7,'the whole engaged worm withdraws');
    t.near(m.getState().tip,NECK.top,1e-7,'withdrawn tip reaches the top of the stationary cork');
    m.root.updateMatrixWorld(true);
    const plug=new THREE.Box3().setFromObject(p.worm.plug);
    t.near(plug.min.y,NECK.top*MM,1e-7,'torn plug is above the remaining cork');
    assert.equal(p.neck.hole.visible,false,'sectioned cork uses a real cavity rather than an overlaid disk');
    for(const mesh of [p.neck.inside,p.neck.inside.children[0]]){
      assert.equal(mesh.material.vertexColors,true);
      const shades=mesh.geometry.attributes.color.array;
      t.ok(shades.some(value=>value<.6)&&shades.some(value=>value===1),'actual inner cavity has contrast against uncut cork');
    }
  }
  for(const worm of [0,1])for(const length of [60,95,120])for(const turns of [1,6])for(const wing of [5,60]){
    m.reset();m.update({worm,length,turns,wing});const state=m.getState();
    const maximum=Math.ceil(Math.max(wing,state.hold/state.leverage,state.need/state.leverage)/25)*25;
    t.near(p.chart.toY(maximum),65*MM,1e-10,'force axis adapts to the largest displayed value');
    for(const line of [p.needLine,p.pushLine,p.holdLine]){
      const a=line.geometry.attributes.position.array;
      for(const y of [a[1],a[4]])t.ok(y>=0&&y<=65*MM+1e-7,'every force series stays inside the labeled axis');
    }
    t.near(p.needLine.geometry.attributes.position.getX(1),state.travel/44*110*MM,1e-7,'blue curve ends at the available geared stroke');
    t.ok(p.chart.captions.some(mesh=>mesh.userData.labelText===String(maximum)),'axis labels show the active force scale');
  }
  t.ok(p.chart.captions.some(mesh=>mesh.userData.labelText==='Push on each wing (N)'),'chart names the per-hand force and unit');
  t.ok(p.chart.captions.some(mesh=>mesh.userData.labelText==='Cork lift (mm)'),'chart names displacement and unit');
  assert.equal(p.chart.chart.userData.explosionExcluded,true,'force diagram is not a physical part');
  for(const action of m.actions.slice(4)){
    action.run();const bounds=m.frameBoundsForPart(action.part);
    if(bounds)t.ok(!bounds.isEmpty()&&bounds.min.toArray().concat(bounds.max.toArray()).every(Number.isFinite),'inspection has finite useful bounds');
  }
  checkControlsMove(m, () => [p.rack.position.y, p.rack.rotation.y, p.wings[0].pinion.rotation.z, p.wings[0].lever.scale.y, p.liftArrow.userData.length, p.wings[0].push.userData.length, p.worm.helix.geometry.parameters.radius, p.chart.dot.position.toArray(), [...p.pushLine.geometry.attributes.position.array]], model => model.advance(8), t);
  const run = values => { m.reset(); m.update(values); m.advance(30); return m.getState(); };
  const standard = run(WINGED_DEFAULTS);
  checkTrialNumbers(wingedCorkscrewLesson, {
    'Lift the default cork': s => (assert.equal(s.mode, 'lifted'), t.near(s.out, s.depth, 1e-9, 'lifted by the depth'), {'42': s.depth, '172': degrees(s.wingRise), '22.1': s.need / s.leverage, '300': s.need, '2': s.remaining, '14': s.handFinish}),
    'Screw in only 4 turns': s => (assert.equal(s.mode, 'lifted'), {'115': degrees(s.wingRise), '28': s.out, '16': s.remaining, '109': s.handFinish}),
    'Push too lightly': s => (assert.equal(s.mode, 'stalled'), {'204': s.limit, '300': s.need}),
    'Shorten the wings': s => (assert.equal(s.mode, 'stalled'), {'13.6': standard.leverage, '8.6': s.leverage, '35.0': s.need / s.leverage, '25': s.values.wing}),
    'Lengthen the wings': s => (assert.equal(s.mode, 'lifted'), {'17.1': s.leverage, '17.5': s.need / s.leverage, '360': s.wingTravel/2, '720': s.wingTravel, '42': s.out}),
    'Screw in one turn': s => (assert.equal(s.mode, 'torn'), {'198': s.hold}),
    'Meet a synthetic cork': s => (assert.equal(s.mode, 'stalled'), {'33.2': s.need / s.leverage, '25': s.values.wing}),
    'Beat the synthetic cork': s => (assert.equal(s.mode, 'lifted'), {'33.2': s.need / s.leverage, '9.88': s.work, '2': s.remaining, '20': s.handFinish}),
    'Swap in a solid screw': s => ({'792': s.hold, '1,188': wormHold(0, s.depth), '20.7': screwTorque(1, s.depth) / (2 * WINGS.knob), '10.3': screwTorque(0, s.depth) / (2 * WINGS.knob)}),
    'Follow the work': s => (t.near(s.wingTravel / s.out, s.leverage, 1e-12, 'travel ratio is the leverage'), {'285': s.wingTravel/2, '570': s.wingTravel, '42': s.out, '13.6': s.leverage}),
  }, run, t);
  checkQuotedText(wingedCorkscrewLesson.deeper.map(section => section.body).join(' '), {
    '3 radians': `${(standard.depth / WINGS.pinionRadius).toFixed(0)} radians`, '172 degrees': `${degrees(standard.wingRise).toFixed(0)} degrees`,
    'leverage is 13.6': `leverage is ${standard.leverage.toFixed(1)}`, '6.59 J': `${standard.work.toFixed(2)} J`,
  }, t);
  m.reset(); m.actions[3].run(); assert.equal(m.playback.complete(), true); assert.equal(m.resultPart.available(), true);
  checkRefusals(sampleWingedCorkscrew, WINGED_DOMAINS, t);
  checkDisposal(m, t);
  console.log(`PASS corkscrew models: ${t.count} checks, ${meshTests} rack and pinion outline tests, ${screwCorkscrewLesson.tryIt.length + wingedCorkscrewLesson.tryIt.length} trials`);
}

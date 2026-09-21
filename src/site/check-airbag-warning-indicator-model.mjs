import assert from 'node:assert/strict';
import * as THREE from 'three';
import {airbagWarningIndicatorConstants as C, sampleAirbagWarningIndicator, createAirbagWarningIndicatorModel} from './airbag-warning-indicator-model.js';

const start = performance.now();
const near = (a, b, tolerance = 1e-6, label = 'coordinate') => assert.ok(Number.isFinite(a) && Math.abs(a - b) <= tolerance, `${label}: ${a} vs ${b}`);
// Independent literal truth table for [0,6), [6,8), [8,12].
// No production predicates or private source artifacts are used by this check.
const reportTable = [[false, false, false], [true, true, true], [false, false, true]];
const commandTable = [[true, false, false], [true, true, true], [true, false, true]];
function reference(v, t) {
  const interval = t < 6 ? 0 : t < 8 ? 1 : 2;
  const report = v.power ? reportTable[v.report][interval] : null;
  const command = v.power ? commandTable[v.report][interval] : null;
  const light = Boolean(v.power) && [command, false, true][v.lamp];
  return {reportedCondition: report, lampCommand: command, visibleLamp: light,
    comparison: !v.power ? 'Unavailable' : command === light ? 'Matches' : 'Differs'};
}
function adjacent(x, direction) {
  const f = new Float64Array([x]), bits = new BigUint64Array(f.buffer);
  bits[0] += BigInt(direction); return f[0];
}
const times = [0, .12, 3, adjacent(6, -1), 6, adjacent(6, 1), 7, adjacent(8, -1), 8, adjacent(8, 1), 9, 12];
const tuples = [];
for (const power of [0, 1]) for (const report of [0, 1, 2]) for (const lamp of [0, 1, 2]) tuples.push({power, report, lamp});
let numericalStates = 0;
for (const values of tuples) for (const time of times) {
  const s = sampleAirbagWarningIndicator(values, time), r = reference(values, time);
  for (const [key, value] of Object.entries(r)) assert.equal(s[key], value, `${JSON.stringify(values)} at ${time}: ${key}`);
  assert.equal(s.startupActive, Boolean(values.power) && time < 6);
  assert.equal(s.agreement, values.power ? r.lampCommand === r.visibleLamp : null);
  assert.equal(s.phase, !values.power ? 'Unpowered' : time < 6 ? 'Startup check' : 'Continuing monitoring');
  for (const forbidden of ['healthy', 'safe', 'detectedFault', 'deployment', 'latched']) assert.ok(!(forbidden in s));
  numericalStates++;
}
for (const time of [-1, NaN, Infinity, 12.001]) assert.throws(() => sampleAirbagWarningIndicator({}, time));
for (const input of [null, [], {power: 2}, {report: .5}, {lamp: -1}, {power: NaN}, {unknown: 1}, {constructor: 1}, {toString: 1}, JSON.parse('{"__proto__":1}')]) assert.throws(() => sampleAirbagWarningIndicator(input));
for (const t of times) {
  const working = reference({power: 1, report: 1, lamp: 0}, t), masked = reference({power: 1, report: 1, lamp: 2}, t);
  assert.deepEqual(working, masked, 'continuous command cannot reveal stuck-on output');
}
assert.equal(sampleAirbagWarningIndicator({report: 2, lamp: 2}, 7).comparison, 'Differs');
assert.equal(sampleAirbagWarningIndicator({report: 2, lamp: 2}, 8).comparison, 'Matches');
// The light must follow the electrical branch, and a missing-current request
// must be causal rather than a direct copy of the selected failure control.
for(const values of tuples)for(const t of times){
  const s=sampleAirbagWarningIndicator(values,t),r=reference(values,t);
  near(s.ledCurrent,r.visibleLamp?.010:0,1e-15,'10 mA chosen branch current');
  near(s.resistorPower,s.ledCurrent*s.ledCurrent*1000,1e-15,'resistor loss');
  near(s.ledPower,s.ledCurrent*2,1e-15,'LED input power');
  near(s.branchPower,s.resistorPower+s.ledPower,1e-15,'branch power balance');
  assert.equal(s.missingCurrent,Boolean(values.power&&r.lampCommand&&!r.visibleLamp));
  assert.equal(s.backupRequested,Boolean(values.power&&values.lamp===1&&t>=1));
}
assert.equal(sampleAirbagWarningIndicator({lamp:1},.999).backupRequested,false);
assert.equal(sampleAirbagWarningIndicator({lamp:1},1).backupRequested,true);
assert.equal(sampleAirbagWarningIndicator({lamp:1},7).missingCurrent,false);
assert.equal(sampleAirbagWarningIndicator({lamp:1},7).backupRequested,true,'retain observed missing startup current');
const model = createAirbagWarningIndicatorModel(), top = model.topology;
assert.equal(model.parts.length, 16); assert.equal(model.controls.length, 4); assert.equal(model.covers.length, 0);
assert.deepEqual(model.catalogParts.map(part=>part.id),['board','power','indicator-path','resistor','lamp','monitor','report-input','buzzer','wires','feedback','records']);
assert.deepEqual(model.defaults, {power: 1, report: 0, lamp: 0, sound: 0});
assert.equal(model.getState().readings.length, 22);
assert.deepEqual(model.actions.slice(1, 8).map(a => a.label), ['Inspect start (0 s)', 'Inspect 3 s', 'Inspect 6 s boundary', 'Inspect 7 s', 'Inspect 8 s boundary', 'Inspect 9 s', 'Inspect final record (12 s)']);
const identities = top.rows.map(row => [row.geometry, row.positions, row.times, row.states, row.marker, row.object.material]);
const labelMaps = top.labels.map(label => label.material.map);
let historyStates = 0;
function verifyHistory() {
  const s = model.getState();
  for (const row of top.rows) {
    const available = reference(s.values, s.elapsed)[row.key] !== null;
    assert.equal(row.object.visible, available); assert.equal(row.marker.visible, available);
    assert.equal(row.unavailableLabel.visible, !available); assert.equal(row.titleLabel.visible, available);
    assert.equal(row.unknown.visible, !available && s.elapsed > 0);
    assert.equal(row.geometry.drawRange.count, row.count); assert.ok(row.count <= top.capacity);
    if (available) {
      assert.ok(row.count >= 1); near(row.times[0], 0, 0); near(row.times[row.count - 1], s.elapsed, 0);
      for (let i = 0; i < row.count; i++) {
        const t = row.times[i], state = row.states[i];
        assert.ok(t >= 0 && t <= s.elapsed, 'retained vertex is observed');
        near(row.positions[3 * i], top.left + top.width * t / 12);
        near(row.positions[3 * i + 1], state ? top.high : -top.high);
        assert.ok(state === reference(s.values, t)[row.key] || ((t === 6 || t === 8) && state === reference(s.values, adjacent(t, -1))[row.key]), 'only actual left/right boundary values');
        if (i > 0) {
          const previous = row.times[i - 1], previousState = row.states[i - 1];
          assert.ok(t >= previous);
          if (t === previous) {
            assert.ok(t === 6 || t === 8); assert.notEqual(state, previousState);
            assert.equal(previousState, reference(s.values, adjacent(t, -1))[row.key]);
            assert.equal(state, reference(s.values, t)[row.key]);
          } else {
            assert.equal(state, previousState, 'time interval is horizontal, never an invented ramp');
            assert.equal(state, reference(s.values, previous + (t - previous) / 2)[row.key]);
          }
        }
      }
      near(row.marker.position.x, top.left + top.width * s.elapsed / 12);
      near(row.marker.position.y, reference(s.values, s.elapsed)[row.key] ? top.high : -top.high);
    } else {
      assert.equal(row.count, 0);
      near(row.unknown.geometry.attributes.position.getX(1), top.left + top.width * s.elapsed / 12);
    }
    for (let i = row.count; i < top.capacity; i++) near(row.positions[3 * i], Math.fround(top.left), 0, 'unused buffer cannot expand selection');
  }
  assert.equal(top.lens.material.emissiveIntensity > 0, s.visibleLamp);
  assert.ok(top.stateLabels.every(group => group.objects.filter(o => o.visible).length === 1));
  historyStates++;
}
for (const values of tuples) {
  model.reset(); model.update(values); verifyHistory();
  for (const time of times.filter(t => t > 0)) { model.actions[0].run(); model.advance(time/2); verifyHistory(); }
  // Restore a short prefix after completion, including both exact boundaries.
  model.actions[7].run(); model.actions[2].run(); verifyHistory();
}
model.reset(); for (const dt of [.173, .047, 5.31, .47, 1.123, .877, 4]) { model.advance(dt/2); verifyHistory(); }
assert.equal(model.playback.complete(), true);
const end = model.getState(); model.advance(2); assert.deepEqual(model.getState(), end);
for (const action of model.actions.filter(a=>a.part)) { action.run(); assert.deepEqual(model.getState(), end); assert.equal(action.view, 'front'); }
model.actions[0].run(); assert.equal(model.playback.complete(), false); model.playback.step(); near(model.getState().elapsed, .12, 1e-15);
model.update({lamp: 2}); assert.equal(model.getState().elapsed, 0); assert.equal(model.getState().values.lamp, 2);
model.animate(1); model.animate(1.5); near(model.getState().elapsed, 3, 1e-15);
model.reset(); model.animate(.2); near(model.getState().elapsed, .4, 1e-15);
assert.deepEqual(model.getState().values, C.defaults);
for (let i = 0; i < identities.length; i++) assert.deepEqual([top.rows[i].geometry, top.rows[i].positions, top.rows[i].times, top.rows[i].states, top.rows[i].marker, top.rows[i].object.material], identities[i]);
assert.deepEqual(top.labels.map(label => label.material.map), labelMaps, 'state changes reuse static text textures');

model.root.updateMatrixWorld(true);
const world = object => object.getWorldPosition(new THREE.Vector3());
function nearestSurface(object, point) {
  const p = object.geometry.attributes.position, index = object.geometry.index;
  let distance = Infinity; const triangle = new THREE.Triangle(), closest = new THREE.Vector3();
  for (let i = 0; i < (index ? index.count : p.count); i += 3) {
    for (const [j, vertex] of [[0, triangle.a], [1, triangle.b], [2, triangle.c]]) vertex.fromBufferAttribute(p, index ? index.getX(i + j) : i + j).applyMatrix4(object.matrixWorld);
    triangle.closestPointToPoint(point, closest); distance = Math.min(distance, closest.distanceTo(point));
  }
  return distance;
}
for (const item of top.packages) {
  near(world(item.body).z - .09, .08, 1e-15, 'mounted package back reaches board front');
  assert.ok(nearestSurface(top.board, new THREE.Vector3(world(item.body).x, world(item.body).y, .08)) < 1e-7);
}
for (const terminal of top.terminals) {
  const siblings=terminal.parent.children.filter(o=>o!==terminal&&o.isMesh);
  assert.ok(siblings.some(o=>nearestSurface(o,world(terminal))<.04),'actual terminal contacts its body or conductive lead');
}
const terminalPositions=top.terminals.map(world);
for(const wire of top.branchWires){
  const endpoints=[wire.points[0],wire.points.at(-1)].map(p=>wire.parent.localToWorld(new THREE.Vector3(...p)));
  for(const endpoint of endpoints)assert.ok(terminalPositions.some(p=>p.distanceTo(endpoint)<1e-10),'branch terminates at actual component terminals');
}
for(const wire of [...top.branchWires,...top.infoRoutes])for(const [i,piece] of wire.pieces.entries()){
  const positions=piece.geometry.attributes.position;let low=Infinity,high=-Infinity;
  for(let j=0;j<positions.count;j++){low=Math.min(low,positions.getY(j));high=Math.max(high,positions.getY(j));}
  for(const [end,y] of [[i,low],[i+1,high]])assert.ok(new THREE.Vector3(0,y,0).applyMatrix4(piece.matrixWorld).distanceTo(wire.parent.localToWorld(new THREE.Vector3(...wire.points[end])))<3e-7,'actual conductor reaches authored endpoints');
}
near(world(top.lens).z - .035, .26, 1e-15, 'lens back touches lamp package front');
assert.ok(nearestSurface(top.packages.find(p => p.id === 'lamp').body, new THREE.Vector3(world(top.lens).x, world(top.lens).y, .26)) < 1e-7);
near(world(top.headerBacking).z - .0275, .08, 1e-15, 'header backing supported on board');
for (const row of top.rows){near(world(row.panel).z-.0275,.08,1e-15,'record panel supported on board');assert.ok(nearestSurface(top.recordBoard,new THREE.Vector3(world(row.panel).x,world(row.panel).y,.08))<1e-7);}
let vertices = 0;
model.root.traverse(object => {
  if (!object.geometry) return;
  const p = object.geometry.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const point = new THREE.Vector3().fromBufferAttribute(p, i).applyMatrix4(object.matrixWorld);
    assert.ok(point.toArray().every(Number.isFinite)); assert.ok(model.framingBounds.containsPoint(point), 'complete actual geometry inside framing'); vertices++;
  }
});
for (const label of top.labels) {
  assert.equal(label.material.map.colorSpace, THREE.SRGBColorSpace, 'Canvas color data is annotated sRGB');
  assert.ok(label.userData.labelText.length > 0); assert.ok(label.userData.width > 0 && label.userData.height >= .3);
  if (label.userData.canvasBacked) { const m = label.userData.metrics; assert.ok(m.left >= 0 && m.right <= m.pixelWidth && m.top >= 0 && m.bottom <= m.pixelHeight); }
}
let circuitPoses=0;
for(const values of tuples)for(const t of [0,.999,1,1.25,1.5,3,6,7,8,12]){
  model.update(values);model.actions[0].run();model.advance(t/2);model.root.updateMatrixWorld(true);
  const state=model.getState();assert.equal(top.ledLink.visible,!state.ledOpen);assert.equal(top.currentMarkers.every(m=>m.visible),state.ledCurrent>0);assert.equal(top.waves.every(w=>w.visible),state.toneActive);
  const bladeStart=new THREE.Vector3(0,-.7,0).applyMatrix4(top.switchBlade.matrixWorld),bladeEnd=new THREE.Vector3(0,.7,0).applyMatrix4(top.switchBlade.matrixWorld);
  assert.ok(bladeStart.distanceTo(world(top.switchA))<1e-10);const gap=bladeEnd.distanceTo(world(top.switchB));assert.ok(state.switchClosed?gap<1e-10:gap>.5);
  assert.equal(state.readings.filter(r=>r.hint).length,22);circuitPoses++;
}
for(let quarter=0;quarter<=48;quarter++)for(const direction of [-1,0,1]){
  const t=quarter===0?0:adjacent(quarter/4,direction);if(t>12)continue;
  const s=sampleAirbagWarningIndicator({lamp:1},t);
  const starts=[1,1.5,2,2.5,3,5,5.5,6,6.5,7,9,9.5,10,10.5,11];
  assert.equal(s.toneActive,starts.some(start=>t>=start&&t<start+.25),'independent five-tone schedule');
}
const resources = new Set(top.textures);
model.root.traverse(o => { if (o.geometry) resources.add(o.geometry); if (o.material) for (const m of Array.isArray(o.material) ? o.material : [o.material]) { resources.add(m); if (m.gradientMap) resources.add(m.gradientMap); } });
const disposed = new Map(); for (const resource of resources) { disposed.set(resource, 0); resource.addEventListener('dispose', () => disposed.set(resource, disposed.get(resource) + 1)); }
model.dispose(); model.dispose(); for (const count of disposed.values()) assert.equal(count, 1, 'owned resources disposed exactly once');
// Sound is optional presentation: it cannot alter any electrical result or
// keep playing through pause, reset, loss of power, completion or disposal.
for(const values of tuples)for(const sound of [0,1])for(const t of times){
  const s=sampleAirbagWarningIndicator({...values,sound},t),base=sampleAirbagWarningIndicator(values,t);
  for(const key of ['ledCurrent','branchPower','visibleLamp','lampCommand','backupRequested','toneActive'])assert.equal(s[key],base[key]);
}
const originalAudio=globalThis.AudioContext,audioContexts=[];
class TestAudioContext{
  constructor(){this.state='suspended';this.currentTime=0;this.destination={};this.starts=0;this.stops=0;this.closes=0;audioContexts.push(this);}
  createOscillator(){return {frequency:{value:0},connect(){},start:()=>this.starts++,stop:()=>this.stops++};}
  createGain(){const parameter={value:0,setValueAtTime(v){this.value=v;},setTargetAtTime(v){this.value=v;}};this.level=parameter;return {gain:parameter,connect(){}};}
  resume(){this.state='running';return Promise.resolve();}
  close(){this.state='closed';this.closes++;return Promise.resolve();}
}
try{
  globalThis.AudioContext=TestAudioContext;const audioModel=createAirbagWarningIndicatorModel();
  assert.equal(audioContexts.length,0,'no audio context before opt-in');audioModel.update({lamp:1});audioModel.advance(.2);const held=audioModel.getState().elapsed;audioModel.update({sound:1});near(audioModel.getState().elapsed,held,0,'sound edit preserves trial');
  const context=audioContexts[0];assert.equal(context.starts,1);assert.equal(context.level.value,0);
  audioModel.playback.setPlaying(true);audioModel.advance(.3);near(audioModel.getState().elapsed,1,1e-14);assert.ok(context.level.value>0);
  audioModel.playback.setPlaying(false);assert.equal(context.level.value,0);audioModel.playback.setPlaying(true);assert.ok(context.level.value>0);
  audioModel.advance(.125);assert.equal(context.level.value,0,'between tone pulses');audioModel.advance(.125);assert.ok(context.level.value>0);
  audioModel.update({power:0});assert.equal(context.level.value,0);audioModel.update({power:1});audioModel.playback.setPlaying(true);audioModel.advance(6);assert.equal(context.level.value,0,'completion silent');
  audioModel.reset();assert.equal(audioModel.getState().values.sound,0);assert.equal(context.level.value,0);audioModel.dispose();audioModel.dispose();assert.equal(context.stops,1);assert.equal(context.closes,1);
  delete globalThis.AudioContext;const unavailable=createAirbagWarningIndicatorModel();unavailable.update({sound:1});assert.equal(unavailable.getState().readings.find(r=>r.label==='Backup sound').value,'Audio unavailable');unavailable.dispose();
}finally{if(originalAudio===undefined)delete globalThis.AudioContext;else globalThis.AudioContext=originalAudio;}
console.log(JSON.stringify({status: 'PASS', tuples: tuples.length, numericalStates, historyStates, literalIntervals: 3, exactBoundaries: [6, 8], actualGeometryVertices: vertices,circuitPoses,audioLifecycle:true, supportedPackages: top.packages.length, connectedTerminals: top.terminals.length, persistentHistoryRows: top.rows.length, staticLabels: top.labels.length, resourcesDisposed: resources.size, elapsedSeconds: (performance.now() - start) / 1000, limit: 'Chosen electrical equivalent, causal indicator logic and visual tone envelope; native readability and actual Canvas2D rasterization require the separate browser/native gate.'}, null, 2));

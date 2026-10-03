import assert from 'node:assert/strict';
import * as THREE from 'three';
import { frameModel } from './machine-viewer.js';
import { createElectricityTransmissionModel, transmissionElectrical as solve, electricityTransmissionConstants as C } from './electricity-transmission-model.js';
import { transmissionTransformerLesson as lesson } from './transmission-transformer-lesson.js';
import { createPartExplosion } from './part-explosion.js';
import { houseComponents } from './house-components.js';
const model = () => createElectricityTransmissionModel({ sendingLesson: true });
let checks = 0;
const ok = (v, msg) => { assert.ok(v, msg); checks++; }, near = (a, b, tol = 1e-9) => ok(Math.abs(a - b) < tol, `${a} != ${b}`), defaults = { ratio: 3, connected: 1 };
const m = model();
assert.deepEqual(m.defaults, defaults);
checks++;
ok(m.root.name === 'Transmission transformer', 'component has independent name');
ok(m.controls.length === 2, 'only two component controls');
ok(m.resultPart.id === 'sending' && m.resultPart.context === 'system' && !m.resultPart.focusOnComplete, 'sending result with full network context');
ok(!m.resultPart.available(), 'no ready-state result');
for (const ratio of [1, 3, 6])
    for (const connected of [0, 1])
        for (const phase of [1, 45, 90, 135, 180, 225, 270, 315, 360, 720]) {
            m.reset();
            m.update({ ratio, connected });
            m.advance(phase / (360 * 50 * .005));
            const s = m.getState(), I = connected ? 12 * ratio / (2 + 12 * ratio * ratio) : 0, t = phase / (360 * 50), P = 12 * ratio * I;
            near(s.primaryRms, 12);
            near(s.secondaryRms, 12 * ratio);
            near(s.primaryRmsCurrent, ratio * I);
            near(s.secondaryRmsCurrent, I);
            near(s.primaryRmsCurrent, ratio * s.secondaryRmsCurrent);
            near(s.primaryRms * s.primaryRmsCurrent, P);
            near(s.secondaryRms * s.secondaryRmsCurrent, P);
            near(s.meanInputPower, P);
            near(s.meanOutputPower, P);
            near(s.transferredEnergy, P * (t + Math.sin(2 * 100 * Math.PI * t) / (200 * Math.PI)));
            near(s.transferredEnergy, s.loadEnergy + s.lineHeat);
            near(s.sendingPrimaryTurns, 4);
            near(s.sendingSecondaryTurns, 4 * ratio);
            near(s.receivingPrimaryTurns, 4 * ratio);
            near(s.receivingSecondaryTurns, 4);
            near(s.fixedLineResistance, 2);
            near(s.fixedLoadResistance, 12);
            ok(s.readings.find(r => r.label === 'Actual sending turns').value === `4:${4 * ratio}`, 'actual turns visible');
            ok(s.readings.find(r => r.label === 'Mean input power').value === s.readings.find(r => r.label === 'Mean output power').value, 'paired power readings equal');
            ok(s.readings.find(r => r.label === 'Port comparison').hint.includes('Power changes across network settings'), 'same-state comparison explicit');
            ok(s.readings.find(r => r.label === 'Fixed network').hint.includes('Receiving ratio changes'), 'coordinated inverse ratio explicit');
            if (connected)
                ok(s.transferredEnergy > s.loadEnergy, 'local energy retains downstream line loss');
            else {
                near(s.meanInputPower, 0);
                near(s.transferredEnergy, 0);
                near(s.serviceRms, 12);
                ok(m.topology.currentArrows.every(a => !a.visible), 'open currents hidden');
            }
            const snapshot = JSON.stringify(s);
            m.update({ lineResistance: 0, loadResistance: 6, sourceRms: 36, voltage: 36, frequency: 60 });
            ok(JSON.stringify(m.getState()) === snapshot, 'foreign network updates ignored without resetting');
        }
for (const ratio of [1, 3, 6]) {
    m.reset();
    m.update({ ratio });
    m.advance(8);
    const s = m.getState();
    near(s.transferredEnergy, [0, .4114285714285714, 0, .4712727272727273, 0, 0, .4777880184331797][ratio]);
}
ok(lesson.tryIt.length === 6, 'six complete control combinations');
const expectedRatios = [3, 1, 6, 3, 1, 6], expectedEnergy = [.4712727272727273, .4114285714285714, .4777880184331797, 0, 0, 0];
for (const [i, p] of lesson.tryIt.entries()) {
    ok(Object.keys(p.values).sort().join(',') === 'connected,ratio', 'all two preset keys');
    ok(p.part === 'system' && p.isolate === false, 'preset retains the complete connected network');
    near(p.values.ratio, expectedRatios[i]);
    for (const history of [0, 1, 2]) {
        m.reset();
        if (history) {
            m.update({ ratio: 6, connected: 0 });
            m.advance(history === 1 ? .72 : 8);
        }
        m.reset();
        m.update(p.values);
        near(m.getState().elapsed, 0);
        near(m.getState().transferredEnergy, 0);
        m.advance(8);
        near(m.getState().transferredEnergy, expectedEnergy[i]);
        ok(m.getState().complete && m.resultPart.available(), 'completed preset exposes sending result');
    }
}

const T = m.topology;
function point(p){return new THREE.Vector3(...p);}function endpoints(paths,extras){const degrees=new Map(),key=p=>p.map(x=>x.toFixed(7)).join(',');for(const path of [...paths,...extras])for(let i=1;i<path.length;i++){for(const p of [path[i-1],path[i]])degrees.set(key(p),(degrees.get(key(p))??0)+1);}for(const degree of degrees.values())ok(degree===2,'each conductor/component node has degree two in its closed loop');}
endpoints(T.sourcePaths,[[T.sending.primaryBottom,T.sending.primaryTop],[[-2.75,1.24,.35],[-2.75,.76,.35]]]);endpoints(T.linePaths,[[T.sending.secondaryTop,T.sending.secondaryBottom],[T.receiving.primaryTop,T.receiving.primaryBottom]]);endpoints(T.loadPaths,[[T.receiving.secondaryTop,T.receiving.secondaryBottom],[[2.4,.51,.35],[2.6,.51,.35]],[[2.8,.76,.35],[2.8,1.24,.35]]]);
for(const ratio of [1,3,6]){m.update({ratio});for(const [stage,np,ns] of [[T.sending,4,4*ratio],[T.receiving,4*ratio,4]])for(const [mesh,N,x,top,bottom] of [[stage.primaryMesh,np,-.35,stage.primaryTop,stage.primaryBottom],[stage.secondaryMesh,ns,.35,stage.secondaryTop,stage.secondaryBottom]]){const curve=mesh.geometry.parameters.path;near(curve.turns,N);ok(C.coilHeight/N>2*C.wireRadius,'turns separated');m.root.updateMatrixWorld(true);near(curve.getPoint(0).applyMatrix4(mesh.matrixWorld).distanceTo(point(bottom)),0);near(curve.getPoint(1).applyMatrix4(mesh.matrixWorld).distanceTo(point(top)),0);let rotation=0,previous=0;for(let j=0;j<=N*48;j++){const p=curve.getPoint(j/(N*48)),angle=Math.atan2(p.z,p.x-x);if(j){let d=angle-previous;if(d<0)d+=2*Math.PI;rotation+=d;}previous=angle;ok(Math.hypot(Math.max(0,Math.abs(p.x-x)-.06),Math.max(0,Math.abs(p.z)-.06))>C.wireRadius,'helix clears core');ok(new THREE.Vector3(p.x-x,0,p.z).cross(curve.getTangent(j/(N*48))).y<0,'winding normal is negative y');}near(rotation,2*Math.PI*N,1e-8);}
 const bounds=objects=>{const b=new THREE.Box3();for(const o of objects)b.union(new THREE.Box3().setFromObject(o));return b;},source=bounds([T.sourceWires,T.source,T.sending.primaryMesh]),line=bounds([T.lineWires,T.sending.secondaryMesh,T.receiving.primaryMesh]),load=bounds([T.loadWires,T.load,T.switchPart,T.receiving.secondaryMesh]);ok(!source.intersectsBox(line)&&!line.intersectsBox(load)&&!source.intersectsBox(load),'three actual electrical loop bounds separate');}
for(const stage of [T.sending,T.receiving]){for(let i=0;i<2;i++)for(let j=2;j<4;j++){const a=new THREE.Box3().setFromObject(stage.coreSegments[i]).expandByScalar(1e-7),b=new THREE.Box3().setFromObject(stage.coreSegments[j]);ok(a.intersectsBox(b),'core bars physically close both legs');}}
for(const [group,paths] of [[T.sourceWires,T.sourcePaths],[T.lineWires,T.linePaths],[T.loadWires,T.loadPaths]]){let i=0;for(const path of paths)for(let j=1;j<path.length;j++){const wire=group.children[i++],height=wire.geometry.parameters.height,a=new THREE.Vector3(0,-height/2,0).applyMatrix4(wire.matrixWorld),b=new THREE.Vector3(0,height/2,0).applyMatrix4(wire.matrixWorld);near(a.distanceTo(point(path[j-1])),0);near(b.distanceTo(point(path[j])),0);for(const stage of [T.sending,T.receiving])for(const core of stage.coreSegments)ok(!new THREE.Box3().setFromObject(wire).intersectsBox(new THREE.Box3().setFromObject(core)),'electrical lead clears magnetic core');}}
m.reset();m.root.updateMatrixWorld(true);const bladeTip=()=>new THREE.Vector3(.2,0,0).applyMatrix4(T.blade.matrixWorld);near(bladeTip().distanceTo(point([2.6,.51,.35])),0);m.update({connected:0});m.root.updateMatrixWorld(true);ok(bladeTip().distanceTo(point([2.6,.51,.35]))>.15,'real switch gap disconnects load');m.reset();
for(const support of T.metalSupports){const b=new THREE.Box3().setFromObject(support);ok(b.max.y<1.90,'metal supports below insulation');for(const wire of T.lineWires.children)ok(!b.intersectsBox(new THREE.Box3().setFromObject(wire)),'pylon metal not a series conductor');}ok(T.insulators.length===20,'four insulated support points');

for (const ratio of [1, 3, 6]) for (const connected of [0, 1]) {
    m.reset(); m.update({ratio, connected});
    const s = m.getState(), I = connected ? 12 * ratio / (2 + 12 * ratio * ratio) : 0;
    near(s.sourceRms, 12); near(s.sendingRms, 12 * ratio);
    near(s.sourceCurrent, Math.SQRT2 * ratio * I);
    near(s.lineCurrent, Math.SQRT2 * I); near(s.sourceWork, 0);
    near(s.receivingRms, 12 * ratio - 2 * I);
    near(s.loadRms, connected ? s.receivingRms / ratio : 0);
    ok(!s.started, 'steady-state readings available before playback');
    for (const time of [.00321, .01271, .04]) {
        const N = 16000, dt = time / N;
        let input = 0, load = 0, heat = 0;
        for (let i = 0; i < N; i++) {
            const instantaneous = Math.SQRT2 * I * Math.cos(100 * Math.PI * (i + .5) * dt);
            input += Math.SQRT2 * 12 * ratio * Math.cos(100 * Math.PI * (i + .5) * dt) * instantaneous * dt;
            load += (ratio * instantaneous) ** 2 * 12 * dt;
            heat += instantaneous ** 2 * 2 * dt;
        }
        const e = solve({ratio, connected, lineResistance: 2, loadResistance: 12}, time);
        near(e.sourceWork, input, 2e-9); near(e.loadEnergy, load, 2e-9); near(e.lineHeat, heat, 2e-9);
    }
    m.actions.find(a => a.label === 'Pause at positive sending flux').run();
    near(m.getState().phaseDegrees, 90); near(m.getState().sendingFlux * 1000, 13.50474474235659);
    near(m.getState().lineCurrent, 0);
    m.actions.find(a => a.label === 'Pause at reversed line current').run();
    near(m.getState().phaseDegrees, 180); near(m.getState().lineCurrent, -Math.SQRT2 * I);
    ok(m.getState().sourcePower >= 0, 'reversed current still transfers nonnegative power');
    const held = JSON.stringify(m.getState());
    m.actions.find(a => a.label === 'Inspect the sending windings').run();
    ok(JSON.stringify(m.getState()) === held, 'inspection keeps electrical state');
}
for (const aspect of [1, 1.16]) for (const ratio of [1, 3, 6]) {
    m.reset(); m.update({ratio}); const {camera} = frameModel(m, aspect);
    const explosion = createPartExplosion(m, camera, aspect);
    assert.deepEqual(explosion.categories.map(c => c.id).sort(), ['line-stage', 'receiving-stage', 'sending-stage']); checks++;
    ok(!explosion.items.some(u => /flux|dots|currents|indicator/.test(u.id)), 'teaching arrows and dots stay out of parts inventory');
    const held = JSON.stringify(m.getState()); explosion.update(1);
    ok(explosion.items.length > 12, 'all physical components included');
    const inverse = camera.quaternion.clone().invert();
    const flat = unit => {
        const box = new THREE.Box3();
        for (const x of [unit.bounds.min.x, unit.bounds.max.x]) for (const y of [unit.bounds.min.y, unit.bounds.max.y]) for (const z of [unit.bounds.min.z, unit.bounds.max.z])
            box.expandByPoint(new THREE.Vector3(x, y, z).add(unit.group.position).applyQuaternion(inverse));
        return box;
    };
    const boxes = explosion.items.map(flat);
    for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++)
        ok(boxes[i].max.x <= boxes[j].min.x || boxes[j].max.x <= boxes[i].min.x || boxes[i].max.y <= boxes[j].min.y || boxes[j].max.y <= boxes[i].min.y, 'separated projected parts do not overlap');
    explosion.update(0); explosion.dispose(); ok(JSON.stringify(m.getState()) === held, 'separation preserves state');
}
const route = houseComponents['Transmission transformer'];
ok(route.part === 'system' && !route.isolate, 'entry shows all circuit context');
const routed = route.createModel(); ok(routed.getState().sendingLesson, 'route uses focused sending model'); routed.dispose();
ok(m.controls.find(c => c.key === 'ratio').primary, 'transmission type selector appears immediately');
for (const entry of lesson.parts) ok(m.parts.some(p => p.name === entry.name), 'glossary matches a selectable part: ' + entry.name);

m.reset();
m.playback.step();
near(m.getState().phaseDegrees, 45);
const paused = JSON.stringify(m.getState());
m.update();
m.advance(0);
ok(JSON.stringify(m.getState()) === paused, 'pause stable');
m.update({ ratio: 6 });
near(m.getState().elapsed, 0);
near(m.getState().transferredEnergy, 0);
m.actions.find(action => action.label === 'Restart the selected transmission run').run();
near(m.getState().values.ratio, 6);
m.advance(8);
const frozen = JSON.stringify(m.getState());
m.advance(20);
ok(JSON.stringify(m.getState()) === frozen, 'completed snapshot stable');
m.reset();
assert.deepEqual(m.getState().values, defaults);
checks++;
const n = model();
m.advance(8);
for (let i = 0; i < 800; i++)
    n.advance(.01);
near(m.getState().transferredEnergy, n.getState().transferredEnergy);
m.dispose();
n.dispose();
const lifetime = model(), geometries = new Map();
function watch() { lifetime.root.traverse(o => { if (o.geometry && !geometries.has(o.geometry)) {
    geometries.set(o.geometry, 0);
    o.geometry.addEventListener('dispose', () => geometries.set(o.geometry, geometries.get(o.geometry) + 1));
} }); }
watch();
for (const ratio of [1, 6, 3, 6]) {
    lifetime.update({ ratio });
    watch();
}
lifetime.dispose();
for (const count of geometries.values())
    ok(count === 1, 'all reused and replaced geometry disposed once');
let visibleTurns = 0;
for (const aspect of [1, 1.16]) {
    const v = model(), { camera } = frameModel(v, aspect);
    camera.zoom = 1.15;
    camera.updateProjectionMatrix();
    camera.updateMatrixWorld();
    for (const ratio of [1, 3, 6])
        for (const connected of [0, 1])
            for (const phase of [1, 90, 180, 270]) {
                v.reset();
                v.update({ ratio, connected });
                v.advance(phase / (360 * 50 * .005));
                v.root.updateMatrixWorld(true);
                const s = v.getState(), T = v.topology, stage = T.sending, meshes = [];
                v.root.traverse(o => { if (!o.isMesh)
                    return; for (let p = o; p; p = p.parent)
                    if (!p.visible)
                        return; meshes.push(o); });
                const seen = (mesh, step = 1) => { const a = mesh.geometry.attributes.position; for (let i = 0; i < a.count; i += step) {
                    const p = new THREE.Vector3().fromBufferAttribute(a, i).applyMatrix4(mesh.matrixWorld).project(camera), ray = new THREE.Raycaster();
                    ray.setFromCamera(new THREE.Vector2(p.x, p.y), camera);
                    if (Math.abs(p.x) < 1 && Math.abs(p.y) < 1 && ray.intersectObjects(meshes)[0]?.object === mesh)
                        return true;
                } return false; };
                for (const [mesh, N, x] of [[stage.primaryMesh, 4, -.35], [stage.secondaryMesh, 4 * ratio, .35]]) {
                    const curve = mesh.geometry.parameters.path, a = mesh.geometry.attributes.position;
                    near(curve.turns, N);
                    near(curve.getPoint(0).y, .65);
                    near(curve.getPoint(1).y, 1.37);
                    ok(.72 / N > .014, 'actual turns separated');
                    for (let turn = 0; turn < N; turn++) {
                        let visible = false;
                        sample: for (const segment of [12, 36, 60, 84])
                            for (const radial of [0, 2, 4, 6]) {
                                const p = new THREE.Vector3().fromBufferAttribute(a, (turn * 96 + segment) * 9 + radial).applyMatrix4(mesh.matrixWorld).project(camera), ray = new THREE.Raycaster();
                                ray.setFromCamera(new THREE.Vector2(p.x, p.y), camera);
                                const hit = ray.intersectObjects(meshes)[0];
                                if (hit?.object === mesh && Math.floor(hit.faceIndex / (96 * 16)) === turn) {
                                    visible = true;
                                    break sample;
                                }
                            }
                        ok(visible, 'each sending turn visible');
                        visibleTurns++;
                    }
                    for (let j = 0; j <= N * 12; j++) {
                        const p = curve.getPoint(j / (N * 12));
                        ok(Math.hypot(Math.max(0, Math.abs(p.x - x) - .06), Math.max(0, Math.abs(p.z) - .06)) > .007, 'sending coil clears core');
                        ok(new THREE.Vector3(p.x - x, 0, p.z).cross(curve.getTangent(j / (N * 12))).y < 0, 'sending helix winding sense retained');
                    }
                }
                for (const dot of stage.dots.children)
                    ok(seen(dot, 8), 'sending dotted terminals visible');
                near(stage.dots.children[0].position.y, 1.37);
                near(stage.dots.children[1].position.y, .65);
                for (const i of [0, 1, 2, 3]) {
                    const arrow = T.currentArrows[i], spec = T.currentSpecs[i];
                    if (Math.abs(s[spec.key]) < 1e-10)
                        ok(!arrow.visible, 'zero/open current hidden');
                    else {
                        near(new THREE.Vector3(0, 1, 0).applyQuaternion(arrow.quaternion).distanceTo(new THREE.Vector3(...spec.direction).multiplyScalar(Math.sign(s[spec.key]))), 0);
                        ok(seen(arrow.cone), 'actual source/line arrow visible');
                    }
                }
                for (const [i, arrow] of stage.fluxArrows.entries()) {
                    if (Math.abs(s.sendingFlux) < 1e-12)
                        ok(!arrow.visible, 'zero flux hidden');
                    else {
                        near(new THREE.Vector3(0, 1, 0).applyQuaternion(arrow.quaternion).distanceTo(new THREE.Vector3(...T.fluxSpecs[i].direction).multiplyScalar(Math.sign(s.sendingFlux))), 0);
                        ok(seen(arrow.cone), 'sending flux arrow visible');
                    }
                }
                const target = v.parts.find(p => p.id === v.resultPart.id).object;
                ok(target === stage.group, 'result selects actual upstream transformer');
                const bounds = new THREE.Box3().setFromObject(target);
                ok(bounds.containsBox(new THREE.Box3().setFromObject(stage.primaryMesh)) && bounds.containsBox(new THREE.Box3().setFromObject(stage.secondaryMesh)), 'sending focus includes both actual windings');
                for (const mesh of meshes) {
                    const a = mesh.geometry.attributes.position;
                    for (let i = 0; i < a.count; i += 54) {
                        const p = new THREE.Vector3().fromBufferAttribute(a, i).applyMatrix4(mesh.matrixWorld).project(camera);
                        ok(Math.abs(p.x) < .98 && Math.abs(p.y) < .98, 'full network framing preserved');
                    }
                }
            }
    v.dispose();
}
console.log(`Transmission transformer: ${checks} checks passed; six fixed-network states across ten phases; paired ports/reciprocal currents/local energy; six presets across three histories; foreign-control isolation; ${visibleTurns} visible sending turns with dots/core/signed arrows across two aspects; sending-result identity, reset/step/freeze/parity/disposal.`);

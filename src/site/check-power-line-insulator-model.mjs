import assert from 'node:assert/strict';
import * as THREE from 'three';
import { frameModel } from './machine-viewer.js';
import { createPartExplosion } from './part-explosion.js';
import { houseComponents } from './house-components.js';
import { createPowerLineInsulatorModel as model, powerLineInsulatorElectrical as solve } from './power-line-insulator-model.js';
import { powerLineInsulatorLesson as lesson } from './power-line-insulator-lesson.js';
let checks = 0;
const ok = (v, msg) => { assert.ok(v, msg); checks++; };
const near = (a, b, tol = 1e-9) => ok(Math.abs(a - b) < tol, `${a} != ${b}`);
const defaults = { voltage: 12, insulation: 0, connected: 1 };
const vec = p => new THREE.Vector3(...p);
const nodeKey = p => p.map(x => x.toFixed(7)).join(',');
function checkElectricalStates() {
    for (let voltage = 0; voltage <= 24; voltage += 6)
        for (const insulation of [0, 1])
            for (const connected of [0, 1])
                for (const t of [0, .0001, .00321, .005, .01, .015, .02713, .04]) {
                    const v = { voltage, insulation, connected }, s = solve(v, t), g = (insulation + connected) / 12, V = voltage / (1 + g), IL = V * connected / 12, IS = V * insulation / 12, I = IL + IS;
                    near(s.nodeRms, V);
                    near(s.loadRms, connected ? V : 0);
                    near(s.loadRmsCurrent, IL);
                    near(s.supportRmsCurrent, IS);
                    near(s.sourceRmsCurrent, I);
                    near(s.sourceCurrent, s.loadCurrent + s.supportCurrent);
                    near(s.sourceRms - s.nodeRms, I);
                    near(s.meanSourcePower, s.meanLoadPower + s.meanSupportPower + s.meanSeriesPower);
                    near(s.sourcePower, s.loadPower + s.supportPower + s.seriesPower);
                    near(s.sourceWork, s.loadEnergy + s.supportEnergy + s.seriesEnergy);
                    near(s.meanLoadPower, IL * IL * 12);
                    near(s.meanSupportPower, IS * IS * 12);
                    near(s.meanSeriesPower, I * I);
                    ok(s.meanLoadPower <= 48 && s.meanSupportPower <= 48, 'fixed indicator bounds valid');
                    const h = 1e-8, lo = solve(v, t - h), hi = solve(v, t + h);
                    near((hi.sourceWork - lo.sourceWork) / (2 * h), s.sourcePower, 4e-7);
                    if (!insulation)
                        near(s.supportRmsCurrent, 0);
                    if (!connected)
                        near(s.loadRms, 0);
                    if (!voltage)
                        near(s.sourceWork, 0);
                }
    for (const [insulation, connected, node, current, Pload, Psupport, Pseries] of [[0, 1, 144 / 13, 12 / 13, 1728 / 169, 0, 144 / 169], [1, 1, 72 / 7, 12 / 7, 432 / 49, 432 / 49, 144 / 49], [1, 0, 144 / 13, 12 / 13, 0, 1728 / 169, 144 / 169], [0, 0, 12, 0, 0, 0, 0]]) {
        const s = solve({ voltage: 12, insulation, connected }, .04);
        near(s.nodeRms, node);
        near(s.sourceRmsCurrent, current);
        near(s.meanLoadPower, Pload);
        near(s.meanSupportPower, Psupport);
        near(s.meanSeriesPower, Pseries);
        near(s.loadEnergy, .04 * Pload);
    }
    const ideal = solve(defaults, .01), finite = solve({ ...defaults, insulation: 1 }, .01);
    ok(finite.nodeRms < ideal.nodeRms && finite.meanLoadPower < ideal.meanLoadPower, 'finite feeder causes actual sag with added support current');
}
function checkEnergyQuadratures() {
    for (const voltage of [6, 12, 24])
        for (const insulation of [0, 1])
            for (const connected of [0, 1]) {
                const t = .017123, N = 16000, dt = t / N, g = (insulation + connected) / 12, node = voltage / (1 + g);
                let source = 0, load = 0, support = 0, series = 0;
                for (let i = 0; i < N; i++) {
                    const k = 2 * Math.cos(100 * Math.PI * (i + .5) * dt) ** 2, I = node * g;
                    source += k * voltage * I * dt;
                    load += k * node * node * connected / 12 * dt;
                    support += k * node * node * insulation / 12 * dt;
                    series += k * I * I * dt;
                }
                const s = solve({ voltage, insulation, connected }, t);
                near(s.sourceWork, source, 1e-8);
                near(s.loadEnergy, load, 1e-8);
                near(s.supportEnergy, support, 1e-8);
                near(s.seriesEnergy, series, 1e-8);
            }
}
function checkPresetsAndLifecycle() {
    const m = model();
    assert.deepEqual(m.defaults, defaults);
    checks++;
    ok(m.controls.length === 3, 'three controls');
    ok(lesson.tryIt.length === 8, 'eight actual presets');
    const expected = [[12, 0, 1], [12, 1, 1], [12, 1, 0], [12, 0, 0], [0, 1, 1], [6, 0, 1], [24, 0, 1], [24, 1, 1]];
    for (const [i, p] of lesson.tryIt.entries())
        for (const history of [0, 1, 2]) {
            m.reset();
            if (history) {
                m.update({ voltage: 24, insulation: 1, connected: 0 });
                m.advance(history === 1 ? .731 : 8);
            }
            m.reset();
            m.update(p.values);
            near(m.getState().elapsed, 0);
            near(m.getState().sourceWork, 0);
            ok(Object.keys(p.values).sort().join(',') === 'connected,insulation,voltage', 'each preset sets all inputs');
            m.advance(8);
            const s = m.getState();
            assert.deepEqual([s.values.voltage, s.values.insulation, s.values.connected], expected[i]);
            checks++;
            const [V, insulation, connected] = expected[i], node = V / (1 + (insulation + connected) / 12);
            near(s.loadEnergy, .04 * node * node * connected / 12);
            near(s.supportEnergy, .04 * node * node * insulation / 12);
            ok(s.complete && m.resultPart.available(), 'preset result available');
        }
    m.reset();
    m.playback.step();
    near(m.getState().phaseDegrees, 45);
    const paused = JSON.stringify(m.getState());
    m.update();
    m.advance(0);
    ok(JSON.stringify(m.getState()) === paused, 'pause stable');
    m.update({ insulation: 1 });
    near(m.getState().sourceWork, 0);
    near(m.getState().elapsed, 0);
    m.actions.find(a => a.label === 'Restart the selected insulator run').run();
    near(m.getState().values.insulation, 1);
    m.advance(8);
    const finished = JSON.stringify(m.getState());
    m.advance(10);
    ok(JSON.stringify(m.getState()) === finished, 'completion frozen');
    m.reset();
    const n = model();
    m.advance(8);
    for (let i = 0; i < 800; i++)
        n.advance(.01);
    near(m.getState().sourceWork, n.getState().sourceWork);
    m.dispose();
    n.dispose();
    const life = model(), resources = new Map();
    life.root.traverse(o => { if (o.geometry && !resources.has(o.geometry)) {
        resources.set(o.geometry, 0);
        o.geometry.addEventListener('dispose', () => resources.set(o.geometry, resources.get(o.geometry) + 1));
    } });
    life.update({ insulation: 1 });
    life.dispose();
    for (const count of resources.values())
        ok(count === 1, 'geometry disposed once');
}
function checkActualCircuitAndMechanicalAttachment() {
    const m = model(), T = m.topology;
    m.root.updateMatrixWorld(true);
    for (const [group, paths] of [[T.feeder, T.feederPaths], [T.consumerWires, T.consumerPaths], [T.pylon, T.supportPaths]]) {
        let i = 0;
        for (const path of paths)
            for (let j = 1; j < path.length; j++) {
                const wire = group.children[i++], h = wire.geometry.parameters.height;
                near(new THREE.Vector3(0, -h / 2, 0).applyMatrix4(wire.matrixWorld).distanceTo(vec(path[j - 1])), 0);
                near(new THREE.Vector3(0, h / 2, 0).applyMatrix4(wire.matrixWorld).distanceTo(vec(path[j])), 0);
            }
    }
    const bounds = o => new THREE.Box3().setFromObject(o), body = bounds(T.dielectric[0]), bottom = bounds(T.bottomFitting), top = bounds(T.topFitting);
    ok(!bottom.intersectsBox(top), 'metal fittings remain separated');
    ok(body.intersectsBox(bottom) && body.intersectsBox(top), 'dielectric mechanically contacts both fittings');
    near(bottom.min.y, 1.5, 1e-7);
    near(top.max.y, 2.8, 1e-7);
    ok(top.intersectsBox(bounds(T.pylon.children[0])), 'top fitting attached to crossarm');
    ok(bottom.intersectsBox(bounds(T.feeder.children[3])), 'bottom fitting attached to continuous supported conductor');
    for (const wire of T.pylon.children)
        ok(!bounds(wire).intersectsBox(bottom), 'pylon does not bypass dielectric to bottom fitting');
    for (const insulation of [0, 1])
        for (const connected of [0, 1]) {
            m.reset();
            m.update({ insulation, connected });
            m.advance(.731);
            m.root.updateMatrixWorld(true);
            const s = m.getState(), balance = new Map();
            const edge = (a, b, I) => { balance.set(nodeKey(a), (balance.get(nodeKey(a)) ?? 0) - I); balance.set(nodeKey(b), (balance.get(nodeKey(b)) ?? 0) + I); }, path = (points, I) => { for (let i = 1; i < points.length; i++)
                edge(points[i - 1], points[i], I); };
            path([[-2, .5, .35], [-2, 1.3, .35], [-2, 1.5, .35], [-1.7, 1.5, .35], [-1.3, 1.5, .35], [0, 1.5, .35]], s.sourceCurrent);
            path([[0, 1.5, .35], [1.5, 1.5, .35], [1.65, 1.5, .35], [1.87, 1.5, .35], [2, 1.5, .35], [2, 1.2, .35], [2, .7, .35], [2, .3, .35], [.35, .3, .35]], s.loadCurrent);
            path([[0, 1.5, .35], [0, 1.68, .35], [0, 2.65, .35], [0, 2.8, .35], [.35, 2.8, -.45], [.35, .3, -.45], [.35, .3, .35]], s.supportCurrent);
            path([[.35, .3, .35], [-2, .3, .35], [-2, .5, .35]], s.sourceCurrent);
            for (const I of balance.values())
                near(I, 0);
            ok(T.finitePath.visible === Boolean(insulation), 'finite electrical path exists only in selected model');
            const tip = new THREE.Vector3(.22, 0, 0).applyMatrix4(T.blade.matrixWorld), gap = tip.distanceTo(vec([1.87, 1.5, .35]));
            if (connected)
                near(gap, 0);
            else
                ok(gap > .20, 'open consumer has real contact gap');
        }
    m.dispose();
}
function checkVisibleGeometry() {
    let poses = 0;
    for (const aspect of [1, 1.16]) {
        const m = model(), { camera } = frameModel(m, aspect);
        camera.zoom = 1.15;
        camera.updateProjectionMatrix();
        camera.updateMatrixWorld();
        for (const insulation of [0, 1])
            for (const connected of [0, 1])
                for (const phase of [1, 90, 180, 270]) {
                    m.reset();
                    m.update({ insulation, connected });
                    m.advance(phase / (360 * 50 * .005));
                    m.root.updateMatrixWorld(true);
                    const T = m.topology, s = m.getState(), meshes = [];
                    m.root.traverse(o => { if (!o.isMesh)
                        return; for (let p = o; p; p = p.parent)
                        if (!p.visible)
                            return; meshes.push(o); });
                    function seen(mesh) { const a = mesh.geometry.attributes.position, index = mesh.geometry.index; const hit = p => { p.applyMatrix4(mesh.matrixWorld).project(camera); const ray = new THREE.Raycaster(); ray.setFromCamera(new THREE.Vector2(p.x, p.y), camera); return Math.abs(p.x) < 1 && Math.abs(p.y) < 1 && ray.intersectObjects(meshes)[0]?.object === mesh; }; for (let i = 0; i < a.count; i += 4)
                        if (hit(new THREE.Vector3().fromBufferAttribute(a, i)))
                            return true; if (index)
                        for (let i = 0; i < index.count; i += 3) {
                            const p = new THREE.Vector3();
                            for (let j = 0; j < 3; j++)
                                p.add(new THREE.Vector3().fromBufferAttribute(a, index.getX(i + j)));
                            if (hit(p.divideScalar(3)))
                                return true;
                        } return false; }
                    for (const mesh of [T.topFitting, T.bottomFitting, T.load.children[0], T.series.children[0], T.blade.children[0], ...T.dielectric, ...T.pylon.children])
                        ok(seen(mesh), `actual attachment/load/series/switch/reference mesh visible: ${mesh.parent.name}`);
                    ok(seen(T.foot.children[0]), 'support foot visible');
                    if (insulation)
                        ok(seen(T.pathRod), 'finite path visible through dielectric cutaway');
                    for (const [i, arrow] of T.currentArrows.entries()) {
                        const spec = T.currentSpecs[i], I = s[spec.key];
                        if (Math.abs(I) < 1e-10)
                            ok(!arrow.visible, 'zero/ideal/open current arrows hidden');
                        else {
                            near(new THREE.Vector3(0, 1, 0).applyQuaternion(arrow.quaternion).distanceTo(vec(spec.direction).multiplyScalar(Math.sign(I))), 0);
                            ok(seen(arrow.cone), `signed current cone${i} visible phase${phase}`);
                        }
                    }
                    for (const mesh of meshes) {
                        const a = mesh.geometry.attributes.position;
                        for (let i = 0; i < a.count; i += 36) {
                            const p = new THREE.Vector3().fromBufferAttribute(a, i).applyMatrix4(mesh.matrixWorld).project(camera);
                            ok(Math.abs(p.x) < .98 && Math.abs(p.y) < .98, 'full support and return circuits framed');
                        }
                    }
                    poses++;
                }
        m.dispose();
    }
    return poses;
}
function checkReadyAndActions() {
    const m = model();
    for (let voltage = 0; voltage <= 24; voltage += 6)
        for (const insulation of [0, 1])
            for (const connected of [0, 1]) {
                m.reset();
                m.update({ voltage, insulation, connected });
                let s = m.getState();
                const V = voltage / (1 + (insulation + connected) / 12), I = V * (insulation + connected) / 12;
                near(s.sourceRms, voltage);
                near(s.nodeRms, V);
                near(s.sourceCurrent, Math.SQRT2 * I);
                near(s.sourceWork, 0);
                ok(!s.started, 'steady electrical values before playback');
                if (!voltage)
                    ok(/Source zero/.test(s.readings.find(r => r.label === 'Your result').value), 'zero source result before playback');
                for (const [name, phase] of [['Pause at zero current', 90], ['Pause at reversed currents', 180]]) {
                    m.actions.find(a => a.label === name).run();
                    s = m.getState();
                    near(s.phaseDegrees, phase);
                    near(s.sourceCurrent, Math.SQRT2 * I * Math.cos(phase * Math.PI / 180));
                    near(s.sourceWork, s.loadEnergy + s.supportEnergy + s.seriesEnergy);
                }
                const held = JSON.stringify(s);
                for (const name of ['Inspect the insulating attachment', 'Inspect the complete support return']) {
                    m.actions.find(a => a.label === name).run();
                    ok(JSON.stringify(m.getState()) === held, 'inspection preserves measured state');
                }
            }
    for (const [key, value] of Object.entries({ voltage: 24, insulation: 1, connected: 0 })) {
        m.reset();
        m.advance(.8);
        m.update({ [key]: value });
        near(m.getState().elapsed, 0);
        near(m.getState().sourceWork, 0);
    }
    m.root.updateMatrixWorld(true);
    const foot = new THREE.Box3().setFromObject(m.topology.foot);
    near(foot.min.y, .14, 1e-7);
    near(foot.max.y, .3, 1e-7);
    ok(foot.clone().expandByScalar(1e-7).intersectsBox(new THREE.Box3().setFromObject(m.topology.pylon.children[1])), 'pylon meets foot within mesh precision');
    for (const item of lesson.parts)
        ok(m.parts.some(p => p.name === item.name), 'glossary selects actual part: ' + item.name);
    ok(m.controls.find(c => c.key === 'insulation').primary, 'support model selector visible above scene');
    ok(houseComponents['Power-line insulator'].createModel === model, 'component route uses dedicated circuit');
    ok(houseComponents['Power-line insulator'].part === 'system', 'opening shows complete return circuit');
    m.dispose();
}
function checkGroupedParts() {
    let layouts = 0;
    for (const insulation of [0, 1])
        for (const connected of [0, 1])
            for (const aspect of [1, 1.16]) {
                const m = model();
                m.update({ insulation, connected });
                const { camera } = frameModel(m, aspect), e = createPartExplosion(m, camera, aspect);
                assert.deepEqual(e.categories.map(c => c.id).sort(), ['consumer-stage', 'source-stage', 'support-stage']);
                checks++;
                ok(!e.items.some(u => /currents|indicators|junctions/.test(u.id)), 'annotations excluded from inventory');
                const held = JSON.stringify(m.getState());
                e.update(1);
                const inverse = camera.quaternion.clone().invert();
                const boxes = e.items.map(unit => { const b = new THREE.Box3(); for (const x of [unit.bounds.min.x, unit.bounds.max.x])
                    for (const y of [unit.bounds.min.y, unit.bounds.max.y])
                        for (const z of [unit.bounds.min.z, unit.bounds.max.z])
                            b.expandByPoint(new THREE.Vector3(x, y, z).add(unit.group.position).applyQuaternion(inverse)); return b; });
                for (let i = 0; i < boxes.length; i++)
                    for (let j = i + 1; j < boxes.length; j++)
                        ok(boxes[i].max.x <= boxes[j].min.x || boxes[j].max.x <= boxes[i].min.x || boxes[i].max.y <= boxes[j].min.y || boxes[j].max.y <= boxes[i].min.y, 'separated physical parts do not overlap');
                e.update(0);
                e.dispose();
                ok(JSON.stringify(m.getState()) === held, 'separation preserves state');
                m.dispose();
                layouts++;
            }
    return layouts;
}
checkElectricalStates();
checkEnergyQuadratures();
checkPresetsAndLifecycle();
checkActualCircuitAndMechanicalAttachment();
checkReadyAndActions();
const layouts = checkGroupedParts();
const poses = checkVisibleGeometry();
console.log(`Power-line insulator: ${checks} checks passed;20 states×8phases,12quadratures,8presets×3histories; actual endpoints/junction KCL,feeder traversal,separated fittings/mechanical attachment,no ideal bypass,consumer gap;${poses} two-aspect visible support/cutaway/return/current poses;${layouts} grouped layouts, immediate readiness, phase/inspect actions, power/energy and lifecycle.`);

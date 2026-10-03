import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createAnchorEscapementModel } from './anchor-escapement-model.js';
import { anchorEscapementLesson as lesson } from './pendulum-clock-lessons.js';
import { CLOCK_DEFAULTS as D, clockPlan } from './pendulum-clock-physics.js';
import { toWheel } from './clock-escapement.js';
import { createPartExplosion } from './part-explosion.js';
import { frameModel } from './machine-viewer.js';
import { houseComponents } from './house-components.js';
let checks = 0;
const ok = (value, message) => { assert.ok(value, message); checks++; };
const near = (a, b, e = 1e-10) => ok(Math.abs(a - b) <= e, `${a} differs from ${b}`);
const m = createAnchorEscapementModel(), read = label => m.getState().readings.find(r => r.label === label).value;
const expected = ['Entry pallet locked', 'Entry pallet impulse', 'Free drop', 'Exit pallet locked', 'Exit pallet impulse', 'Free drop', 'Entry pallet locked', 'Entry pallet impulse', 'Entry pallet impulse', 'Entry pallet impulse', 'Stopped', 'Entry pallet impulse'];
for (const [i, p] of lesson.tryIt.entries())
    for (const history of [D, { ...D, care: 1, weight: 1 }, { ...D, rod: 1, temperature: 30, weight: 5 }]) {
        m.reset();
        m.update(history);
        m.advance(60);
        m.reset(p.initialState);
        m.update(p.values);
        ok(read('Your result') === expected[i], p.title);
        assert.deepEqual(m.getState().values, p.values);
        checks++;
        const s = m.getState();
        near(s.time, s.running ? p.initialState.phase * s.period : 0);
        near(m.topology.escapeWheel.rotation.z, -s.escape);
        near(m.topology.anchor.rotation.z, s.angle);
        near(m.topology.pendulum.rotation.z, s.angle);
        ok(m.topology.dial.visible === false, 'Dial stays hidden through every reset');
        ok(m.playback.blocked() === !s.running, 'Release threshold blocks playback');
        if (i === 2 || i === 5) {
            ok(s.contactSide === null, 'Drop has no contact');
            ok(s.escape * 180 / Math.PI > (i === 2 ? 4 : 10) && s.escape * 180 / Math.PI < (i === 2 ? 6 : 12), 'Free drop advances between contact phases');
        }
        if (i === 6) {
            near(s.escape, Math.PI / 15);
            ok(s.beats === 2, 'Two beats per tooth');
        }
        const held = JSON.stringify(m.getState());
        m.advance(0);
        ok(JSON.stringify(m.getState()) === held, 'Zero time preserves phase and readings');
    }
let poses = 0;
for (const values of [D, { ...D, length: 990, rod: 1, temperature: 10, weight: 5 }, { ...D, length: 1000, rod: 2, temperature: 30, weight: 1 }, { ...D, care: 1, weight: 2.5 }, { ...D, care: 1, weight: 1 }]) {
    m.reset();
    m.update(values);
    let previous;
    const plan = clockPlan(values);
    const L = values.length / 1000 * (1 + [11.5, 19, 1.2][values.rod] * 1e-6 * (values.temperature - 20));
    const energyPerBeat = values.weight * 9.81 * (.15 / (2 * Math.PI * 3)) * (Math.PI / 30) / 480 * .25;
    near(plan.L, L);
    near(plan.availableBeatEnergy, energyPerBeat);
    near(2 * Math.PI * 1.5 * 9.81 * L * (1 - Math.cos(plan.theta)) / (values.care ? 1000 : 3000), 2 * energyPerBeat);
    for (let i = 0; i <= 400; i++) {
        m.reset({ phase: i / 400 });
        m.update(values);
        m.root.updateMatrixWorld(true);
        const s = m.getState(), t = m.topology;
        ok(!previous || s.escape >= previous.escape - 1e-12, 'No recoil');
        near(t.anchor.rotation.z, t.pendulum.rotation.z);
        near(t.escapeWheel.rotation.z, t.escapePinion.rotation.z);
        if (s.stage === 'Locked' && previous?.stage === 'Locked' && previous.contactSide === s.contactSide)
            near(s.escape, previous.escape);
        if (s.contact) {
            const side = s.contactSide, shape = t.palletMeshes[side].geometry.parameters.shapes;
            const points = shape.getPoints(32).map(v => toWheel([v.x, v.y], s.angle));
            const distances = points.map((a, j) => { const b = points[(j + 1) % points.length], dx = b[0] - a[0], dy = b[1] - a[1], den = dx * dx + dy * dy, u = den ? Math.max(0, Math.min(1, ((s.contact[0] - a[0]) * dx + (s.contact[1] - a[1]) * dy) / den)) : 0; return Math.hypot(s.contact[0] - a[0] - u * dx, s.contact[1] - a[1] - u * dy); });
            ok(Math.min(...distances) < 1e-5, 'Actual pallet outline meets working tooth');
            const wheel = t.escapeWheel.geometry.parameters.shapes.getPoints(1).slice(0, 90);
            const c = Math.cos(-s.escape), sn = Math.sin(-s.escape);
            ok(wheel.some(v => Math.hypot(c * v.x - sn * v.y - s.contact[0], sn * v.x + c * v.y - s.contact[1]) < 1e-9), 'Contact belongs to drawn tooth tip');
        }
        ok(read('Your result') === (!s.running ? 'Stopped' : s.stage === 'Drop' ? 'Free drop' : `${s.contactSide === 0 ? 'Entry' : 'Exit'} pallet ${s.stage === 'Impulse' ? 'impulse' : 'locked'}`), 'Readout matches actual geometry');
        previous = s;
        poses++;
    }
}
for (const values of [D, { ...D, weight: 1 }, { ...D, weight: 5 }, { ...D, care: 1, weight: 1 }])
    for (const action of m.actions) {
        m.reset();
        m.update(values);
        action.run();
        const s = m.getState();
        assert.deepEqual(s.values, values);
        checks++;
        ok(m.parts.some(p => p.id === action.part), 'Every action selects a real part');
        if (action.label.includes('drop') && s.running)
            ok(s.stage === 'Drop' && s.contactSide === null, 'Drop inspection survives changed amplitude');
        ok(!tIncludes(m.parts, 'motion-work') && !tIncludes(m.parts, 'dial'), 'Hidden dial is not a selectable part');
    }
function tIncludes(parts, id) { return parts.some(p => p.id === id); }
for (const p of lesson.parts)
    ok(m.parts.some(x => x.name === p.name), 'Glossary matches selectable geometry');
ok(houseComponents['Anchor escapement'].createModel === createAnchorEscapementModel, 'Child route uses dedicated inspection');
m.reset();
m.playback.step();
ok(m.getState().beats === 1, 'One step is one beat');
near(m.getState().escape, Math.PI / 30);
m.playback.step();
ok(m.getState().beats === 2, 'Two steps are one tooth');
near(m.getState().escape, Math.PI / 15);
m.advance(100);
ok(m.playback.complete(), 'Minute completion');
near(m.getState().time, 60);
const completed = JSON.stringify(m.getState());
m.advance(20);
ok(JSON.stringify(m.getState()) === completed, 'Completion freezes');
m.reset();
ok(!m.playback.complete(), 'Reset restores playback');
m.update({ care: 1, weight: 1 });
const stopped = JSON.stringify(m.getState());
m.playback.step();
m.advance(100);
ok(JSON.stringify(m.getState()) === stopped, 'Blocked drive cannot advance');
m.update({ care: 0 });
ok(!m.playback.blocked(), 'Cleaning restores a running state');
let disposed = 0;
const geometries = new Set();
m.root.traverse(o => { if (o.geometry)
    geometries.add(o.geometry); });
for (const g of geometries)
    g.addEventListener('dispose', () => disposed++);
m.dispose();
m.dispose();
ok(disposed === geometries.size, 'Hidden and visible geometry disposed exactly once');
let layouts = 0;
for (const v of [D, { ...D, weight: 5 }, { ...D, care: 1, weight: 1 }])
    for (const aspect of [1, 1.16]) {
        const model = createAnchorEscapementModel();
        model.update(v);
        model.advance(.5);
        for (const cover of model.covers)
            cover.visible = false;
        const held = JSON.stringify(model.getState()), { camera } = frameModel(model, aspect), e = createPartExplosion(model, camera, aspect);
        const excluded = new Set();
        for (const root of [model.topology.dial, model.topology.chart])
            root.traverse(o => { if (o.geometry)
                excluded.add(o.geometry); });
        e.root.traverse(o => { if (o.geometry)
            ok(!excluded.has(o.geometry), 'Dial and chart excluded from parts inventory'); });
        e.update(1);
        const inverse = camera.quaternion.clone().invert();
        const boxes = e.items.map(unit => { const b = new THREE.Box3(); for (const x of [unit.bounds.min.x, unit.bounds.max.x])
            for (const y of [unit.bounds.min.y, unit.bounds.max.y])
                for (const z of [unit.bounds.min.z, unit.bounds.max.z])
                    b.expandByPoint(new THREE.Vector3(x, y, z).add(unit.group.position).applyQuaternion(inverse)); return b; });
        for (let i = 0; i < boxes.length; i++)
            for (let j = i + 1; j < boxes.length; j++)
                ok(boxes[i].max.x <= boxes[j].min.x || boxes[j].max.x <= boxes[i].min.x || boxes[i].max.y <= boxes[j].min.y || boxes[j].max.y <= boxes[i].min.y, 'Grouped parts do not overlap');
        ok(e.items.length > 5, 'Real parts available to separate');
        e.update(0);
        e.dispose();
        ok(JSON.stringify(model.getState()) === held, 'Separating preserves mechanism state');
        model.dispose();
        layouts++;
    }
console.log(JSON.stringify({ passed: true, layouts, checks, poses, presets: lesson.tryIt.length, histories: 3, actions: m.actions.length, geometryContacts: true, energyBalance: true, blockedAndRecovered: true, disposal: true }));

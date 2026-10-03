import * as THREE from 'three';
import { houseModel, reading as r } from './house-model-kit.js';
export const powerPylonConstants = Object.freeze({ weightPerLength: 1, visualScale: .32, duration: 6, step: .3 });
export function powerPylonStatics(v) { const w = powerPylonConstants.weightPerLength, a = v.tension / w, q = v.span / (2 * a), sag = a * (Math.cosh(q) - 1), cableLength = 2 * a * Math.sinh(q), verticalSupportLoad = w * cableLength / 2; return { ...v, a, sag, minimumHeight: v.height - sag, cableLength, cableWeight: w * cableLength, verticalSupportLoad, endpointTension: v.tension * Math.cosh(q) }; }
export function powerPylonHeight(v, x) { const a = v.tension / powerPylonConstants.weightPerLength; return v.height - a * (Math.cosh(v.span / (2 * a)) - Math.cosh(x / a)); }
const fmt = (n, d = 3) => Number(n.toFixed(d)).toFixed(d);
export function createPowerPylonModel() {
    const C = powerPylonConstants, S = C.visualScale, m = houseModel('Power pylon'), { part, box, rod, sphere, cylinder, control, finish } = m, system = part('system', 'Rigid supports and hanging cable', 'Two rigid pylons support one uniformly weighted cable. Each setting is a separate static configuration using its calculated cable length.'), spanStage = part('span-stage', 'Suspended span and reference', 'Continuous conductor and its geometric zero-height reference.', [0, 0, 0], system), plane = part('plane', 'Flat geometric reference plane', 'Zero height is a geometric reference, not a regulatory clearance.', [0, 0, 0], spanStage);
    box([6.1, .10, 1.65], [0, -.05, 0], 'wood', plane);
    function support(id) { const group = part(id, id === 'left' ? 'Left rigid pylon' : 'Right rigid pylon', 'Lattice-style support scenery. The attachment height and span move the actual clamp; tower stresses and foundation behavior are not calculated.', [0, 0, 0], system), structure = part(id + '-structure', id === 'left' ? 'Left rigid lattice structure' : 'Right rigid lattice structure', 'Bars are mechanical context, not a structural stress model.', [0, 0, 0], group), attachment = part(id + '-attachment', id === 'left' ? 'Left insulating suspension and clamp' : 'Right insulating suspension and clamp', 'Separated metal fittings are mechanically attached through the dielectric, with no metallic bypass.', [0, 0, 0], group), bottomFitting = rod([0, 0, .15], [0, .07, .15], .033, 'metal', attachment), topFitting = rod([0, .48, .15], [0, .55, .15], .033, 'metal', attachment), dielectric = cylinder(.047, .44, [0, .275, .15], 'cream', attachment); for (const y of [.10, .18, .26, .34, .42])
        cylinder(.09, .025, [0, y, .15], 'cream', attachment); const clamp = sphere(.038, [0, 0, .15], 'gold', attachment), arrow = new THREE.ArrowHelper(new THREE.Vector3(1, -1, 0).normalize(), new THREE.Vector3(0, 0, .20), .36, 0x374736, .105, .065); attachment.add(arrow); arrow.userData.explosionExcluded = true; group.userData.explosionCategory = true; return { group, structure, attachment, bottomFitting, topFitting, dielectric, clamp, arrow, bars: [], drawnHeight: null }; }
    const left = support('left'), right = support('right');
    function rebuildSupport(tower, height) {
        if (tower.drawnHeight === height)
            return;
        for (const bar of tower.bars) {
            bar.geometry.dispose();
            tower.structure.remove(bar);
        }
        tower.bars = [];
        tower.barPaths = [];
        const top = height * S + .55;
        const point = (level, x, z) => { const f = level / 4; return [x * (.20 - .145 * f), top * f, -.30 + z * (.13 - .085 * f)]; };
        const add = (a, b, r = .017) => { const mesh = rod(a, b, r, 'metal', tower.structure); tower.bars.push(mesh); tower.barPaths.push([a, b]); return mesh; };
        const corners = [[-1, -1], [1, -1], [1, 1], [-1, 1]];
        for (const [x, z] of corners)
            add(point(0, x, z), point(4, x, z));
        for (let level = 0; level < 4; level++)
            for (let face = 0; face < 4; face++) {
                const a = corners[face], b = corners[(face + 1) % 4];
                add(point(level, ...a), point(level + 1, ...b));
                add(point(level, ...b), point(level + 1, ...a));
                add(point(level + 1, ...a), point(level + 1, ...b));
            }
        add([-.055, top, -.30], [.055, top, -.30]);
        add([0, top, -.30], [0, top, .15], .024);
        tower.attachment.position.y = height * S;
        tower.drawnHeight = height;
    }
    class Catenary extends THREE.Curve {
        constructor(v) { super(); this.values = { ...v }; }
        getPoint(t, p = new THREE.Vector3()) { const x = (t - .5) * this.values.span; return p.set(x * S, powerPylonHeight(this.values, x) * S, .15); }
        getTangent(t, p = new THREE.Vector3()) { const x = (t - .5) * this.values.span; return p.set(1, Math.sinh(x * powerPylonConstants.weightPerLength / this.values.tension), 0).normalize(); }
    }
    const cablePart = part('cable', 'One continuous gravity-loaded cable', 'A uniform flexible cable at static equilibrium under its own weight, 1 N per meter of actual cable length.', [0, 0, 0], spanStage), cable = new THREE.Mesh(new THREE.TubeGeometry(new Catenary({ height: 3, span: 12, tension: 18 }), 256, .014, 8, false), new THREE.MeshToonMaterial({ color: 0x374736 }));
    cablePart.add(cable);
    spanStage.userData.explosionCategory = true;
    let drawn = { height: 3, span: 12, tension: 18 };
    const inspection = part('inspection', 'Geometric inspection sweep', 'The marker scans a stationary cable at uniform horizontal progress. It is not cable motion or electrical current.', [0, 0, 0], system), marker = sphere(.045, [0, 0, 0], 'gold', inspection), measureLine = rod([0, 0, 0], [0, 1, 0], .006, 'blue', inspection), foot = sphere(.022, [0, 0, 0], 'blue', inspection);
    control('height', 'Attachment height', 3, 6, 1, 3, 'm', 'Common actual cable-clamp height. Both rigid supports rise together.');
    control('span', 'Support spacing', 8, 16, 2, 12, 'm', 'Horizontal distance between the actual clamps. Each setting uses its separately calculated cable length.');
    control('tension', 'Horizontal tension', 12, 36, 6, 18, 'N', 'Prescribed horizontal component of cable tension; not a pylon rating or installation instruction.');
    let elapsed = 0, lastClock = 0, started = false, complete = false;
    const result = finish(v => { const e = powerPylonStatics(v); for (const [tower, sign] of [[left, -1], [right, 1]]) {
        rebuildSupport(tower, v.height);
        tower.group.position.x = sign * v.span * S / 2;
        const direction = new THREE.Vector3(-sign * v.tension, -e.verticalSupportLoad, 0).normalize();
        tower.arrow.setDirection(direction);
        tower.arrow.setLength(.36, .105, .065);
    } if (Object.keys(drawn).some(k => drawn[k] !== v[k])) {
        cable.geometry.dispose();
        cable.geometry = new THREE.TubeGeometry(new Catenary(v), 256, .014, 8, false);
        drawn = { ...v };
    } const progress = elapsed / C.duration, scanX = (!started || complete ? 0 : progress - .5) * v.span, scanHeight = powerPylonHeight(v, scanX), measuredMinimum = started ? (progress >= .5 ? e.minimumHeight : powerPylonHeight(v, (progress - .5) * v.span)) : null; inspection.visible = true; marker.position.set(scanX * S, scanHeight * S, .15); measureLine.position.set(scanX * S, scanHeight * S / 2, .15); measureLine.scale.y = scanHeight * S; foot.position.set(scanX * S, 0, .15); return { state: { ...e, elapsed, started, complete, progress, scanX, scanHeight, measuredMinimum }, readings: [r('Your result', !started ? `Configured midpoint at ${fmt(e.minimumHeight)} m · ready to inspect` : complete ? `Lowest cable point measured at ${fmt(e.minimumHeight)} m` : 'Inspection sweep · record the lowest visited height'), r('Attachment height', `${fmt(v.height)} m`), r('Support spacing', `${fmt(v.span)} m`), r('Horizontal tension', `${fmt(v.tension)} N`), r('Calculated sag', `${fmt(e.sag)} m`), r('Configured minimum height', `${fmt(e.minimumHeight)} m`, 'Exact midpoint height above the flat geometric plane; not a safety clearance.'), r('Measured minimum height', measuredMinimum === null ? 'Not inspected' : `${fmt(measuredMinimum)} m`, 'Lowest point visited by the inspection sweep; the midpoint is highlighted when complete.'), r('Probe position', `${fmt(scanX)} m`, 'Horizontal offset from the midpoint; negative is toward the left support.'), r('Probe height', `${fmt(scanHeight)} m`, 'Geometric probe starts at the configured midpoint; Play sweeps from left to right.'), r('Cable length', `${fmt(e.cableLength)} m`, 'Each control setting uses this separately calculated cable length; no fixed-length stretching is modeled.'), r('Cable weight', `${fmt(e.cableWeight)} N`, 'Uniform 1 N/m along actual cable length.'), r('Vertical load per support', `${fmt(e.verticalSupportLoad)} N`), r('Endpoint tension', `${fmt(e.endpointTension)} N`), r('Support force arrows', 'Inward and downward · direction only', 'Fixed-length arrows show force exerted by the cable on each support; use numerical forces for magnitude.'), r('Inspection progress', `${fmt(progress * 100, 0)}%`), r('Inspection time', `${fmt(elapsed, 2)} s`), r('Model limit', 'Static uniform flexible cable · equal-height rigid supports', 'Inspection sweep, not cable motion or electrical current. No cable elasticity, wind, temperature, tower stress/failure, foundation behavior, electrical circuit or regulatory clearance is modeled.')] }; });
    const render = result.update;
    function restart(defaults = false, clock = false) { if (defaults)
        render(result.defaults); elapsed = 0; started = complete = false; if (clock)
        lastClock = 0; return render(); }
    result.update = next => { const before = result.getState(); render(next); const after = result.getState(); return ['height', 'span', 'tension'].some(k => before.values[k] !== after.values[k]) ? restart() : render(); };
    function advance(seconds) { if (!Number.isFinite(seconds) || seconds <= 0 || complete)
        return render(); started = true; elapsed = Math.min(C.duration, elapsed + seconds); if (elapsed >= C.duration - 1e-12) {
        elapsed = C.duration;
        complete = true;
    } return render(); }
    result.advance = advance;
    result.animate = clock => { if (!Number.isFinite(clock))
        return render(); const delta = Math.max(0, clock - lastClock); lastClock = clock; return advance(delta); };
    result.reset = () => restart(true, true);
    function checkpoint(progress) { elapsed = progress * C.duration; started = true; complete = false; return render(); }
    result.actions = [{ label: 'Inspect the left attachment', part: 'left-attachment', view: 'iso', replay: false, run: () => render() }, { label: 'Inspect the right attachment', part: 'right-attachment', view: 'iso', replay: false, run: () => render() }, { label: 'Pause one quarter across the span', part: 'system', view: 'front', replay: false, run: () => checkpoint(.25) }, { label: 'Pause at the lowest point', part: 'system', view: 'front', replay: false, run: () => checkpoint(.5) }, { label: 'Restart the selected inspection sweep', part: 'system', view: 'reset', run: () => restart() }];
    result.playback = { label: 'Inspect the stationary cable', stepLabel: 'Inspect the next five percent of the span', description: 'A six-second geometric inspection sweep. Step advances five percent; the cable remains in static equilibrium.', advance, step: () => advance(C.step), complete: () => complete, blocked: () => false };
    result.resultPart = { id: 'system', context: 'system', focusOnComplete: false, label: 'Inspect both supports and the lowest cable point', available: () => started };
    inspection.userData.explosionExcluded = true;
    result.selectionOutline = false;
    result.framingBounds = new THREE.Box3(new THREE.Vector3(-3.18, -.12, -.95), new THREE.Vector3(3.18, 2.68, .95));
    result.topology = { left, right, spanStage, cablePart, cable, inspection, marker, measureLine, foot, plane, scale: S };
    return result;
}

import * as THREE from 'three';
import { houseModel, reading as r } from './house-model-kit.js';
import { transformerElectrical, transformerEnergy, transformerHelixPoint } from './transformer-model.js';
export const homeSupplyConstants = Object.freeze({ primaryTurns: 12, secondaryTurns: 4, branchResistance: 12, frequency: 50, duration: .04, clockScale: .005, stepDegrees: 45 });
export function homeSupplyElectrical(v, elapsed) {
    const H = homeSupplyConstants, keys = ['branchA', 'branchB', 'branchC'];
    const count = keys.reduce((n, key) => n + (v[key] ? 1 : 0), 0);
    const input = {
        voltage: v.voltage, primaryTurns: H.primaryTurns, secondaryTurns: H.secondaryTurns,
        resistance: count ? H.branchResistance / count : H.branchResistance,
        connected: count ? 1 : 0, startPhase: 0,
    };
    const e = transformerElectrical(input, elapsed), energy = transformerEnergy(input, elapsed);
    const branches = keys.map((key, i) => {
        const connected = Boolean(v[key]), rmsVoltage = connected ? e.secondaryRms : 0;
        const rmsCurrent = rmsVoltage / H.branchResistance, meanPower = rmsVoltage * rmsCurrent;
        return {
            id: 'ABC'[i], key, connected, rmsVoltage, rmsCurrent, meanPower,
            energy: connected && count ? energy / count : 0,
            current: Math.SQRT2 * rmsCurrent * Math.cos(e.phase),
        };
    });
    return {
        ...e, incomingRms: e.primaryRms, homeRms: e.secondaryRms,
        totalSecondaryRmsCurrent: e.secondaryRmsCurrent,
        meanInputPower: e.meanLoadPower, meanHomePower: e.meanLoadPower,
        sourceWork: energy, homeEnergy: energy, branches, connectedLoads: count,
    };
}
const fmt = (n, d = 3) => Number(n.toFixed(d)).toFixed(d);
export function createHomeSupplyTransformerModel() {
    const C = homeSupplyConstants, m = houseModel('Home-supply transformer'), { part, box, rod, sphere, control, finish } = m, system = part('system', 'Final transformer and household load bank', 'A regional source equivalent feeds one final step-down transformer and three parallel household resistor equivalents. Upstream generation and distribution are represented by the source.'), magnetic = part('magnetic', 'Magnetic core and supports', 'Closed magnetic path and insulating mechanical support.', [0, 0, 0], system), base = part('base', 'Insulating demonstration board', 'A scaled electrical teaching circuit, not household installation wiring.', [0, 0, 0], magnetic);
    box([6.4, .16, 1.6], [-.1, .08, .18], 'wood', base);
    const feet = part('core-feet', 'Insulating core feet', 'Two supports connect the closed core to the demonstration board.', [0, 0, 0], magnetic);
    for (const x of [-1.9, -.5]) box([.35, .07, .35], [x, .195, 0], 'cream', feet);
    const core = part('core', 'Closed final-transformer core', 'Positive flux rises in the primary leg, crosses the top, falls in the secondary leg and returns along the bottom.', [0, 0, 0], magnetic), coreSegments = [];
    for (const [size, pos] of [[[1.64, .24, .24], [-1.2, .35, 0]], [[1.64, .24, .24], [-1.2, 2.05, 0]], [[.24, 1.46, .24], [-1.9, 1.2, 0]], [[.24, 1.46, .24], [-.5, 1.2, 0]]]) {
        const mesh = new THREE.Mesh(new THREE.BoxGeometry(...size), new THREE.MeshToonMaterial({ color: 0xb4c5b0 }));
        mesh.position.set(...pos);
        core.add(mesh);
        coreSegments.push(mesh);
    }
    const primary = part('primary', 'Regional source circuit', 'The source and twelve-turn primary form one complete isolated circuit.', [0, 0, 0], system), secondary = part('secondary', 'Home supply and parallel loads', 'The four-turn secondary supplies two buses and three independently switched resistor branches.', [0, 0, 0], system);
    class Helix extends THREE.Curve {
        constructor(x, n) { super(); this.x = x; this.turns = n; }
        getPoint(t, p = new THREE.Vector3()) { return p.set(...transformerHelixPoint(this.x, this.turns, t)); }
    }
    const primaryMesh = new THREE.Mesh(new THREE.TubeGeometry(new Helix(-1.9, 12), 12 * 96, .01, 8, false), new THREE.MeshToonMaterial({ color: 0x4686a0 })), secondaryMesh = new THREE.Mesh(new THREE.TubeGeometry(new Helix(-.5, 4), 4 * 96, .01, 8, false), new THREE.MeshToonMaterial({ color: 0xce825f }));
    const primaryCoil = part('primary-coil', 'Primary winding · 12 turns', 'Continuous insulated winding in the regional source circuit.', [0, 0, 0], primary), secondaryCoil = part('secondary-coil', 'Secondary winding · 4 turns', 'Continuous isolated winding feeding the home-side buses.', [0, 0, 0], secondary);
    primaryCoil.add(primaryMesh);
    secondaryCoil.add(secondaryMesh);
    const primaryTop = [-1.61, 1.75, 0], primaryBottom = [-1.61, .65, 0], secondaryTop = [-.21, 1.75, 0], secondaryBottom = [-.21, .65, 0], dots = part('dots', 'Fixed dotted winding terminals', 'Primary top receives input current; secondary bottom delivers current to the home bank. Dots do not change with current direction.', [0, 0, 0], system);
    sphere(.032, [-1.55, 1.75, .45], 'ink', dots);
    sphere(.032, [-.15, .65, .45], 'ink', dots);
    function wires(id, label, parent, paths, color) { const group = part(id, label, 'Actual continuous electrical leads; no current crosses the magnetic core.', [0, 0, 0], parent); for (const points of paths)
        for (let i = 1; i < points.length; i++)
            rod(points[i - 1], points[i], .012, color, group); group.userData.paths = paths; return group; }
    const primaryPaths = [[primaryTop, [-1.61, 1.75, .4], [-2.8, 1.75, .4], [-2.8, 1.5, .4]], [[-2.8, .8, .4], [-2.8, .5, .4], [-1.61, .5, .4], [-1.61, .65, .4], primaryBottom]], primaryWires = wires('primary-wires', 'Regional source and return leads', primary, primaryPaths, 'blue');
    const source = part('source', 'Ideal regional supply equivalent', 'Controlled RMS incoming voltage at 50 Hz. Upstream stages are represented by this source; its ideal voltage does not sag with branch demand.', [-2.8, 1.15, .4], primary);
    box([.42, .70, .22], [0, 0, 0], 'cream', source);
    rod([0, -.35, 0], [0, .35, 0], .018, 'gold', source);
    for (const y of [-.35, .35])
        sphere(.026, [0, y, 0], 'gold', source);
    const sine = [];
    for (let i = 0; i <= 48; i++)
        sine.push(-.15 + .3 * i / 48, .11 * Math.sin(2 * Math.PI * i / 48), .116);
    const sineGeometry = new THREE.BufferGeometry();
    sineGeometry.setAttribute('position', new THREE.Float32BufferAttribute(sine, 3));
    source.add(new THREE.Line(sineGeometry, new THREE.LineBasicMaterial({ color: 0x4686a0 })));
    const positions = [.65, 1.5, 2.35], busPaths = [[secondaryBottom, [-.21, .65, .4], [-.21, .5, .4], [.65, .5, .4], [1.5, .5, .4], [2.35, .5, .4]], [secondaryTop, [-.21, 1.75, .4], [-.21, 1.9, .4], [.65, 1.9, .4], [1.5, 1.9, .4], [2.35, 1.9, .4]]], busWires = wires('home-buses', 'Available home supply and return buses', secondary, busPaths, 'clay');
    const branches = positions.map((x, i) => {
        const id = 'ABC'[i], group = part('branch-' + id, 'Load ' + id + ' · 12 Ω', 'An independently switched household resistor equivalent. Its power changes with actual voltage; no appliance-specific physics is modeled.', [0, 0, 0], secondary), paths = [[[x, .5, .4], [x, .70, .4]], [[x, .92, .4], [x, 1.1, .4]], [[x, 1.5, .4], [x, 1.9, .4]]], leads = wires('branch-' + id + '-wires', 'Load ' + id + ' branch leads', group, paths, 'clay'), switchPart = part('switch-' + id, 'Load ' + id + ' switch', 'Opening lifts the actual blade from its upper contact and disconnects only this branch.', [x, .70, .4], group), blade = part('blade-' + id, 'Load ' + id + ' conducting blade', 'The hinged blade bridges the two contacts only when closed.', [0, 0, 0], switchPart);
        rod([0, 0, 0], [0, .22, 0], .017, 'gold', blade);
        for (const y of [0, .22])
            sphere(.026, [0, y, 0], 'gold', switchPart);
        const load = part('load-' + id, 'Load ' + id + ' resistor', 'A fixed 12 Ω passive load with its own solved RMS current, mean power and delivered energy.', [x, 1.3, .4], group);
        box([.28, .34, .22], [0, 0, 0], ['leaf', 'blue', 'clay'][i], load);
        rod([0, -.2, 0], [0, .2, 0], .018, 'gold', load);
        for (const y of [-.2, .2])
            sphere(.026, [0, y, 0], 'gold', load);
        const plaque = part('label-' + id, 'Load ' + id + ' label', 'Fixed identity label, not a conductor.', [x, 2.14, .4], group);
        box([.30, .30, .06], [0, 0, 0], 'cream', plaque);
        const strokes = { A: [[[-.085, -.10], [0, .10]], [[0, .10], [.085, -.10]], [[-.05, -.02], [.05, -.02]]], B: [[[-.075, -.10], [-.075, .10]], [[-.075, .10], [.045, .10]], [[.045, .10], [.075, .04]], [[.075, .04], [-.075, 0]], [[-.075, 0], [.065, -.02]], [[.065, -.02], [.065, -.08]], [[.065, -.08], [-.075, -.10]]], C: [[[.075, .08], [-.035, .10]], [[-.035, .10], [-.08, .04]], [[-.08, .04], [-.08, -.05]], [[-.08, -.05], [-.025, -.10]], [[-.025, -.10], [.075, -.08]]] };
        for (const [a, b] of strokes[id])
            rod([...a, .04], [...b, .04], .01, 'ink', plaque);
        const indicator = part('power-' + id, 'Load ' + id + ' mean power', 'Fixed linear 0–12 W indicator for this resistor, not temperature.', [x, .24, .82], group);
        box([.52, .09, .08], [0, 0, 0], 'ink', indicator);
        const bar = box([.5, .065, .055], [0, 0, .06], ['leaf', 'blue', 'clay'][i], indicator);
        return { id, key: 'branch' + id, x, group, paths, leads, load, blade, switchPart, plaque, indicator, bar };
    });
    const fluxSpecs = [{ center: [-1.9, 1.2, .142], direction: [0, 1, 0], length: .8 }, { center: [-1.2, 2.05, .142], direction: [1, 0, 0], length: .8 }, { center: [-.5, 1.2, .142], direction: [0, -1, 0], length: .8 }, { center: [-1.2, .35, .142], direction: [-1, 0, 0], length: .8 }], fluxPart = part('flux', 'Reversing shared core flux', 'Direction-only arrows. Flux depends on incoming voltage, frequency and fixed primary turns, not how many branches are closed.', [0, 0, 0], system), fluxArrows = fluxSpecs.map(() => new THREE.ArrowHelper(new THREE.Vector3(0, 1, 0), new THREE.Vector3(), .5, 0xe3b45e, .12, .065));
    fluxPart.add(...fluxArrows);
    const currentPart = part('currents', 'Instantaneous conventional current', 'Fixed-length direction arrows. Compare numerical RMS currents for magnitude. No current crosses the core or an open branch.', [0, 0, 0], system), currentSpecs = [{ center: [-2.3, 1.75, .435], direction: [1, 0, 0], key: 'primaryCurrent' }, { center: [-2.3, .5, .435], direction: [-1, 0, 0], key: 'primaryCurrent' }, { center: [.18, .5, .435], direction: [1, 0, 0], key: 'secondaryCurrent' }, { center: [.18, 1.9, .435], direction: [-1, 0, 0], key: 'secondaryCurrent' }, ...branches.map((b, i) => ({ center: [b.x, 1.70, .435], direction: [0, 1, 0], branch: i }))], currentArrows = currentSpecs.map(() => new THREE.ArrowHelper(new THREE.Vector3(0, 1, 0), new THREE.Vector3(), .22, 0x374736, .10, .065));
    currentPart.add(...currentArrows);
    control('voltage', 'Incoming RMS voltage', 0, 36, 6, 18, 'V', 'Regional source equivalent at fixed 50 Hz. These are scaled teaching values.');
    for (const [id, initial] of [['A', 1], ['B', 0], ['C', 0]])
        control('branch' + id, 'Load ' + id + ' connection', 0, 1, 1, initial, '', 'Switch only this 12 Ω parallel branch.', [{ value: 1, label: 'On' }, { value: 0, label: 'Off' }]);
    let elapsed = 0, lastClock = 0, started = false, complete = false;
    const result = finish(v => { const e = homeSupplyElectrical(v, elapsed); for (const [i, b] of branches.entries()) {
        b.blade.rotation.z = v[b.key] ? 0 : -Math.PI / 3;
        const fraction = e.branches[i].meanPower / 12;
        b.bar.visible = fraction > 0;
        b.bar.scale.x = fraction;
        b.bar.position.x = (fraction - 1) * .25;
    } fluxSpecs.forEach((spec, i) => { const d = new THREE.Vector3(...spec.direction).multiplyScalar(Math.sign(e.flux) || 1), arrow = fluxArrows[i]; arrow.visible = Math.abs(e.flux) > 1e-12; arrow.position.copy(new THREE.Vector3(...spec.center).addScaledVector(d, -spec.length / 2)); arrow.setDirection(d); arrow.setLength(spec.length, .12, .065); }); currentSpecs.forEach((spec, i) => { const value = spec.key ? e[spec.key] : e.branches[spec.branch].current, d = new THREE.Vector3(...spec.direction).multiplyScalar(Math.sign(value) || 1), arrow = currentArrows[i]; arrow.visible = Math.abs(value) > 1e-10; arrow.position.copy(new THREE.Vector3(...spec.center).addScaledVector(d, -.11)); arrow.setDirection(d); }); return { state: { ...e, reflectedResistance: e.connectedLoads ? e.reflectedResistance : null, elapsed, started, complete, progress: elapsed / C.duration }, readings: [r('Your result', !v.voltage ? 'Incoming supply zero · no home voltage or energy' : !e.connectedLoads ? 'All loads off · home voltage remains available' : !started ? 'Ready · compare the powered home loads' : `${e.connectedLoads} load${e.connectedLoads === 1 ? '' : 's'} supplied at ${fmt(e.homeRms, 1)} V · ${fmt(e.meanHomePower, 3)} W total`), r('Incoming RMS voltage', `${fmt(e.incomingRms)} V`), r('Available home RMS voltage', `${fmt(e.homeRms)} V`, 'Available bus voltage stays present when every branch is off.'), r('Primary RMS current', `${fmt(e.primaryRmsCurrent, 4)} A`), r('Total secondary RMS current', `${fmt(e.totalSecondaryRmsCurrent, 4)} A`), r('Primary instantaneous current', `${fmt(e.primaryCurrent, 4)} A`), r('Total secondary instantaneous current', `${fmt(e.secondaryCurrent, 4)} A`), r('Instantaneous input power', `${fmt(e.inputPower, 4)} W`), r('Instantaneous home power', `${fmt(e.loadPower, 4)} W`), r('Mean input power', `${fmt(e.meanInputPower, 4)} W`), r('Mean home power', `${fmt(e.meanHomePower, 4)} W`), r('Source work', `${fmt(e.sourceWork * 1000, 4)} mJ`), r('Delivered home energy', `${fmt(e.homeEnergy * 1000, 4)} mJ`), ...e.branches.flatMap(b => [r('Load ' + b.id + ' RMS voltage', `${fmt(b.rmsVoltage)} V`, 'Voltage across this resistor; zero with its branch switch off.'), r('Load ' + b.id + ' RMS current', `${fmt(b.rmsCurrent, 4)} A`), r('Load ' + b.id + ' mean power', `${fmt(b.meanPower, 4)} W`), r('Load ' + b.id + ' energy', `${fmt(b.energy * 1000, 4)} mJ`)]), r('Core flux', `${fmt(e.flux * 1000, 4)} mWb`), r('Electrical phase', `${fmt(e.phaseDegrees, 1)}°`), r('Simulated time', `${fmt(elapsed * 1000)} ms`, 'Two 50-Hz cycles shown 200 times slower.'), r('Connected loads', e.branches.filter(b => b.connected).map(b => b.id).join(', ') || 'None'), r('Fixed turns', '12:4 · voltage ÷3', 'Primary:secondary actual turns. The lower-voltage secondary is electrically separate.'), r('Power indicators', 'Each linear 0–12 W', 'Individual mean powers add to total home power. Not a temperature scale.'), r('Current and flux arrows', 'Direction only · fixed length', 'Numerical values show current and flux magnitudes.'), r('Model limit', 'Ideal final transformer · three household resistor equivalents', 'Regional source represents upstream generation and distribution. Scaled single-phase circuit; no center tap, split phase, earth/protection wiring, transformer losses, magnetizing current, inrush, temperature, regulation or appliance physics.')] }; });
    const render = result.update;
    function restart(defaults = false, clock = false) { if (defaults)
        render(result.defaults); elapsed = 0; started = complete = false; if (clock)
        lastClock = 0; return render(); }
    result.update = next => { const before = result.getState().values; render(next); const after = result.getState().values; return Object.keys(after).some(key => before[key] !== after[key]) ? restart() : render(); };
    function advance(seconds) { if (!Number.isFinite(seconds) || seconds <= 0 || complete)
        return render(); started = true; elapsed = Math.min(C.duration, elapsed + seconds * C.clockScale); if (elapsed >= C.duration - 1e-13) {
        elapsed = C.duration;
        complete = true;
    } return render(); }
    result.advance = advance;
    result.animate = clock => { if (!Number.isFinite(clock))
        return render(); const delta = Math.max(0, clock - lastClock); lastClock = clock; return advance(delta); };
    result.reset = () => restart(true, true);
    function checkpoint(degrees) { elapsed = degrees / (360 * C.frequency); started = true; complete = false; return render(); }
    result.actions = [{ label: 'Inspect the regional source circuit', part: 'primary', view: 'iso', replay: false, run: () => render() }, { label: 'Inspect the home load branches', part: 'secondary', view: 'iso', replay: false, run: () => render() }, { label: 'Pause at positive flux peak', part: 'core', view: 'front', replay: false, run: () => checkpoint(90) }, { label: 'Pause at reversed home current', part: 'system', view: 'iso', replay: false, run: () => checkpoint(180) }, { label: 'Restart the selected home-supply run', part: 'system', view: 'reset', run: () => restart() }];
    result.playback = { label: 'Supply the home loads for two AC cycles', stepLabel: 'Advance one eighth of a cycle', description: 'Two 50-Hz cycles displayed 200 times slower. Step advances 45 degrees; pause freezes phase and energy.', advance, step: () => advance(C.stepDegrees / (360 * C.frequency * C.clockScale)), complete: () => complete, blocked: () => false };
    result.resultPart = { id: 'system', context: 'system', focusOnComplete: false, label: 'Inspect the final transformer and home loads', available: () => started };
    for (const group of [magnetic, primary, secondary, ...branches.map(b => b.group)])
        group.userData.explosionCategory = true;
    for (const annotation of [dots, fluxPart, currentPart, ...branches.flatMap(b => [b.plaque, b.indicator])])
        annotation.userData.explosionExcluded = true;
    result.selectionOutline = false;
    result.framingBounds = new THREE.Box3().setFromObject(result.root).expandByScalar(.12);
    result.topology = { magnetic, primary, secondary, primaryCoil, secondaryCoil, primaryMesh, secondaryMesh, primaryTop, primaryBottom, secondaryTop, secondaryBottom, primaryPaths, primaryWires, busPaths, busWires, source, branches, coreSegments, dots, fluxSpecs, fluxArrows, currentSpecs, currentArrows };
    return result;
}

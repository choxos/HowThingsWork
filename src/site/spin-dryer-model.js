import * as THREE from 'three';
import {houseModel, reading as r} from './house-model-kit.js';
import {fixed} from './format.js';
import {lineObject, chartText, textLabel} from './scene-kit.js';
import {spinPlan, sampleSpinPlan, rotationAt, speedAt, shaking, omegaOf, dropFlight, SPIN as S, SPIN_DEFAULTS as D, SPIN_DOMAINS, EXPERIMENTS} from './spin-dryer-physics.js';

export const MM = .004;
export const G = Object.freeze({drumBottom: 250, drumHeight: 320, tubFloor: 230, tubHeight: 365, platform: 115, springBase: 25, springTop: 110, jugX: 340, jugRadius: 95, jugFloor: 6, jugHeight: 200, panelCount: 24, holeRadius: 7, loadHeightPerKg: 70});
const TAU = 2 * Math.PI, BLUE = 0x477f9b, WET = new THREE.Color(0x4f6272), DRY = new THREE.Color(0xeddca9);
const point = a => a.map(n => n * MM);
export const laundryColor = moisture => WET.clone().lerp(DRY, Math.max(0, Math.min(1, (S.soaked - moisture) / (S.soaked - S.residual))));
export const waterChartPoint = (t, kg) => point([-130 + t / S.duration * 260, -100 + kg / 6 * 210, 0]);
export const shakeChartPoint = (rpm, amplitude) => point([-130 + rpm / 3000 * 260, -100 + amplitude / .018 * 210, 0]);
export const jugLevel = mass => mass / S.density * 1e9 / (Math.PI * G.jugRadius ** 2);
const lathe = (profile, start = 0, span = TAU) => new THREE.LatheGeometry(profile.map(([x, y]) => new THREE.Vector2(x * MM, y * MM)), 96, start, span);
function surface(kit, geometry, color, parent) {
  const m = kit.cylinder(1, 1, [0, 0, 0], color, parent); m.geometry.dispose(); m.geometry = geometry; m.material = m.material.clone(); m.material.side = THREE.DoubleSide; return m;
}
/** A genuinely perforated metal panel, bent onto a cylindrical drum. */
export function drumPanelGeometry() {
  const radius = 148, half = radius * Math.PI / G.panelCount, depth = 2, vertices = [];
  const bend = (u, y, d) => [(radius + d) * Math.cos(u / radius) * MM, y * MM, -(radius + d) * Math.sin(u / radius) * MM];
  const quad = (a, b, c, d) => {vertices.push(...a, ...b, ...c, ...a, ...c, ...d);};
  // Subdivide each perforated cell before bending. Long triangles across a
  // curved sheet would otherwise cut into the laundry and create false facets.
  const corners = [-1, 1].flatMap(x => [-1, 1].map(y => (Math.atan2(y * 20, x * half) + TAU) % TAU));
  const angles = [...new Set([...Array.from({length: 64}, (_, i) => i * TAU / 64), ...corners])].sort((a, b) => a - b);
  for (let row = 0; row < 7; row++) {
    const cy = 30 + row * 40;
    const ring = (angle, mix) => {const x = Math.cos(angle), y = Math.sin(angle), outer = Math.min(half / Math.max(1e-15, Math.abs(x)), 20 / Math.max(1e-15, Math.abs(y))), r = G.holeRadius + mix * (outer - G.holeRadius); return [r * x, cy + r * y];};
    for (let i = 0; i < angles.length; i++) {
      const a = angles[i], b = angles[(i + 1) % angles.length];
      for (let band = 0; band < 4; band++) {
        const p = ring(a, band / 4), q = ring(b, band / 4), r = ring(b, (band + 1) / 4), t = ring(a, (band + 1) / 4);
        quad(bend(...p, 0), bend(...q, 0), bend(...r, 0), bend(...t, 0));
        quad(bend(...t, depth), bend(...r, depth), bend(...q, depth), bend(...p, depth));
      }
      const p = ring(a, 0), q = ring(b, 0); quad(bend(...p, 0), bend(...p, depth), bend(...q, depth), bend(...q, 0));
    }
  }
  for (const [bottom, top] of [[0, 10], [290, G.drumHeight]]) for (let i = 0; i < 12; i++) {
    const a = -half + 2 * half * i / 12, b = -half + 2 * half * (i + 1) / 12;
    for (const d of [0, depth]) quad(bend(a, bottom, d), bend(b, bottom, d), bend(b, top, d), bend(a, top, d));
  }
  const geometry = new THREE.BufferGeometry(); geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3)); geometry.computeVertexNormals(); geometry.computeBoundingBox(); geometry.computeBoundingSphere(); return geometry;
}

export function createSpinDryerModel() {
  const kit = houseModel('Spin dryer'), {root, part, control} = kit;
  const system = part('system', 'Spin dryer', 'A supported vertical-axis drum extracts water into a separate collector. Front panels are cut away for inspection. Choose a timed extraction or a separate steady vibration experiment.');
  const box = (size, pos, color, parent) => kit.box(point(size), point(pos), color, parent);
  const cylinder = (radius, height, pos, color, parent) => kit.cylinder(radius * MM, height * MM, point(pos), color, parent);
  const rod = (a, b, radius, color, parent) => kit.rod(point(a), point(b), radius * MM, color, parent);
  const label = (parent, text, pos, height = 13, width) => {const m = textLabel(parent, text, {position: point(pos), height: height * MM, ...(width ? {width: width * MM} : {})}); m.raycast = () => {}; return m;};
  const setRod = (m, a, b) => {const av = new THREE.Vector3(...point(a)), bv = new THREE.Vector3(...point(b)), delta = bv.clone().sub(av); m.position.copy(av).add(bv).multiplyScalar(.5); m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), delta.clone().normalize()); m.scale.y = delta.length() / m.geometry.parameters.height;};
  const frame = part('frame', 'Fixed cabinet and base', 'The cabinet stays on the floor. Its front and right panels are omitted so the supported tub, drum and drive can be inspected.', [0, 0, 0], system);
  box([440, 20, 440], [0, 10, 0], 'cream', frame);
  for (const x of [-205, 205]) {box([18, 610, 18], [x, 325, -205], 'metal', frame); box([35, 5, 35], [x, 22.5, -150], 'ink', frame);}
  box([430, 610, 6], [0, 325, -217], 'cream', frame);
  box([430, 14, 18], [0, 628, -205], 'metal', frame);
  for (const x of [-170, 170]) for (const z of [-170, 170]) cylinder(20, 10, [x, -5, z], 'ink', frame);

  const lid = part('lid', 'Lid and rotation interlock', 'Closing the lid enables the prescribed spin. Opening it before a fresh trial prevents rotation. The lid is drawn with a cutaway; this is not a model of safely opening a running appliance.', [0, 628 * MM, -205 * MM], system);
  const lidHinge = new THREE.Group(); lid.add(lidHinge);
  box([430, 8, 100], [0, 6, 45], 'cream', lidHinge);
  rod([-205, 0, 0], [205, 0, 0], 5, 'metal', lid);
  const latch = box([24, 16, 16], [205, -8, 0], 'gold', lid); latch.material = latch.material.clone();
  const lidText = label(lidHinge, 'Lid closed · cutaway', [0, 28, 30], 13, 250);

  const assembly = part('assembly', 'Supported tub and drive assembly', 'Tub, motor, shaft and drum share a moving platform. In the vibration experiment this complete 25 kg equivalent assembly moves together on an ideal isotropic spring and damper support.', [0, 0, 0], system);
  const mounts = part('mounts', 'Platform and bearing supports', 'The platform carries the motor and the outer tub. Two sealed bearings constrain the shaft while allowing the drum to rotate.', [0, 0, 0], assembly);
  box([350, 10, 350], [0, 110, 0], 'metal', mounts);
  for (const x of [-145, 145]) for (const z of [-110, 110]) rod([x, 115, z], [x, 224, z], 6, 'metal', mounts);
  const bearings = [];
  for (const y of [216, 232]) {const b = surface(kit, lathe([[7, -4], [15, -4], [15, 4], [7, 4], [7, -4]]), 'ink', mounts); b.position.y = y * MM; bearings.push(b);}
  for (const side of [-1, 1]) {rod([side * 75, 115, 0], [side * 75, 216, 0], 5, 'metal', mounts); box([65, 12, 35], [side * 47.5, 216, 0], 'metal', mounts);}
  const motor = part('motor', 'Motor and connected shaft', 'The motor housing is fixed to the moving platform. Its rotor shaft passes through supported bearings and a tub-floor seal, then directly turns the drum. Speed is prescribed; motor torque and electrical losses are not calculated.', [0, 0, 0], assembly);
  const motorBody = cylinder(58, 90, [0, 160, 0], 'gold', motor);
  const shaft = cylinder(6, 139, [0, 184.5, 0], 'metal', motor);
  const shaftMark = box([5, 30, 3], [6, 193, 0], 'clay', motor);
  const rotor = new THREE.Group(); motor.add(rotor); rotor.add(shaft, shaftMark);

  const springs = part('springs', 'Springs and dampers', 'Four supports connect the fixed base to the moving platform. The calculation uses equivalent horizontal stiffness 40 kN/m and adjustable viscous damping, not a stress analysis of these coils.', [0, 0, 0], system);
  const springData = [];
  for (const x of [-150, 150]) for (const z of [-150, 150]) {
    box([30, 5, 30], [x, 22.5, z], 'ink', frame);
    box([30, 5, 30], [x, 102.5, z], 'ink', mounts);
    const coil = kit.spring([0, 0, 0], 10 * MM, 80 * MM, 6, springs, 1.8 * MM);
    springData.push({coil, bottom: [x, 25, z], top: [x, 105, z]});
  }
  const dampers = [];
  for (const [a, b] of [[[-215, 65, 0], [-160, 105, 0]], [[215, 65, 0], [160, 105, 0]], [[0, 65, -215], [0, 105, -160]], [[0, 65, 215], [0, 105, 160]]]) {
    rod([a[0], 20, a[2]], a, 5, 'metal', frame);
    dampers.push({a, b, tube: rod(a, b, 5, 'gold', springs), piston: rod(a, b, 2.5, 'metal', springs)});
  }

  const tub = part('tub', 'Outer tub and shaft seal', 'The outer tub catches departing water. Its front half is cut away. A sealed central bearing keeps water out of the motor; the floor feeds a descending outlet.', [0, G.tubFloor * MM, 0], assembly);
  const tubWall = surface(kit, lathe([[8, 0], [185, 0], [185, G.tubHeight], [188, G.tubHeight], [188, -6], [8, -6], [8, 0]], Math.PI / 2, Math.PI), 'blue', tub);
  const tubSupportRing = surface(kit, lathe([[175, -6], [188, -6], [188, 0], [175, 0], [175, -6]]), 'blue', tub);
  const seal = surface(kit, lathe([[6.2, -4], [7, -4], [7, 4], [6.2, 4], [6.2, -4]]), 'ink', tub);

  const drum = part('drum', 'Perforated drum', 'A 300 mm drum has real openings through its metal wall. The bottom and rim retain the load. A removable ideal sleeve closes the openings in the sealed-wall experiment.', [0, G.drumBottom * MM, 0], assembly);
  const spinner = new THREE.Group(); drum.add(spinner);
  const panelGeometry = drumPanelGeometry(), panels = [];
  for (let i = 0; i < G.panelCount; i++) {const m = surface(kit, panelGeometry, 'metal', spinner); m.rotation.y = TAU * i / G.panelCount; panels.push(m);}
  cylinder(150, 4, [0, -2, 0], 'metal', spinner);
  cylinder(15, 18, [0, -13, 0], 'metal', spinner);
  const rim = surface(kit, lathe([[145, 0], [151, 0], [151, 7], [145, 7], [145, 0]]), 'metal', spinner); rim.position.y = (G.drumHeight - 7) * MM;
  const sleeve = surface(kit, lathe([[150.2, 0], [151.2, 0], [151.2, G.drumHeight], [150.2, G.drumHeight], [150.2, 0]]), 'clay', spinner);
  const drumStripe = box([5, 3, 6], [149, G.drumHeight + 1, 0], 'gold', spinner);

  const laundry = part('laundry', 'Wet fabric load', 'This synthetic fabric example starts with 1.5 kg of water per kilogram of dry load. Occupied height grows with the dry load; color lightens as water is removed. The orange marker indicates an imbalance in the separate vibration test.', [0, G.drumBottom * MM, 0], assembly);
  const laundryRotor = new THREE.Group(); laundry.add(laundryRotor);
  const layerMesh = surface(kit, lathe([[110, 0], [147.8, 0], [147.8, 1], [110, 1], [110, 0]]), WET.getHex(), laundryRotor); layerMesh.position.y = 4 * MM;
  const seams = Array.from({length: 12}, (_, i) => {const a = i * TAU / 12; return rod([111 * Math.cos(a), 0, -111 * Math.sin(a)], [147 * Math.cos(a), 0, -147 * Math.sin(a)], .6, 'cream', laundryRotor);});
  const lump = kit.sphere(10 * MM, [128 * MM, 0, 0], 'clay', laundryRotor);

  const water = part('water', 'Departing water', 'Enlarged markers depart tangentially from real drum holes and stop at the outer tub. The top-view path is straight; gravity adds a tiny vertical fall. Transit is slowed with the rotor. Markers illustrate flow, not measured drop size or water volume.', [0, G.drumBottom * MM, 0], assembly);
  const drops = Array.from({length: 36}, (_, i) => {const m = kit.sphere(2.2 * MM, [0, 0, 0], BLUE, water); m.userData.hole = i % G.panelCount; m.userData.row = i % 3; return m;});
  const tangentGuide = lineObject(2, BLUE, water); tangentGuide.raycast = () => {};

  const drain = part('drain', 'Descending outlet channel', 'An open channel descends from the tub to a collection jug. Water no longer touches the laundry after entering the collector. Transit storage is neglected in the water balance.', [0, 0, 0], assembly);
  const channelA = [182, 230, 0], channelB = [G.jugX, 205, 0];
  const length = Math.hypot(channelB[0] - channelA[0], channelB[1] - channelA[1]), channelAngle = Math.atan2(channelB[1] - channelA[1], channelB[0] - channelA[0]);
  const channel = new THREE.Group(); channel.position.set(...point(channelA)); channel.rotation.z = channelAngle; drain.add(channel);
  box([length, 2, 22], [length / 2, -1, 0], 'metal', channel);
  for (const z of [-12, 12]) box([length, 14, 2], [length / 2, 6, z], 'metal', channel);
  const channelFlow = rod([0, 2, 0], [length, 2, 0], 1.2, BLUE, channel);
  const outletDrop = rod(channelB, [G.jugX, 7, 0], 1.2, BLUE, drain);
  const collector = part('collector', 'Collected water and fixed scale', 'The jug has 95 mm internal radius and 200 mm working depth. Its fixed marks show liters. Retained water plus collected water equals the initial water; the largest trial fits without clipping or discarding water.', [G.jugX * MM, 0, 0], system);
  const jugWall = surface(kit, lathe([[0, 0], [98, 0], [98, 206], [95, 206], [95, 6], [0, 6]], .55, TAU - 1.1), 'blue', collector);
  const jugWater = surface(kit, lathe([[0, 0], [95, 0], [95, 1], [0, 1]], .55, TAU - 1.1), BLUE, collector); jugWater.position.y = G.jugFloor * MM;
  jugWater.material.transparent = true; jugWater.material.opacity = .78; jugWater.material.depthWrite = false; jugWater.material.polygonOffset = true; jugWater.material.polygonOffsetFactor = -1; jugWater.material.polygonOffsetUnits = -2;
  const jugMarks = [];
  for (let liters = 0; liters <= 5; liters++) {const y = G.jugFloor + jugLevel(liters); jugMarks.push(rod([98, y, 0], [106, y, 0], .7, 'ink', collector)); label(collector, String(liters), [117, y, 0], 11);}
  label(collector, 'liters', [116, 203, 0], 11);

  const chart = part('chart', 'Water balance through the cycle', 'Two traces account for the initial water: water retained in the fabric and water collected outside it. These are calculated results for the illustrative fabric, not measured cotton performance.', [700 * MM, 330 * MM, 0], system);
  const shakeChart = part('shake-chart', 'Steady vibration versus speed', 'The exact steady amplitude of the equivalent spring-damper assembly. This is not a startup trajectory. The full 0–18 mm scale contains every permitted imbalance and damping setting.', [700 * MM, 330 * MM, 0], system);
  for (const c of [chart, shakeChart]) {c.userData.inspectionOnly = c === chart ? 'chart' : 'shake-chart'; c.userData.explosionExcluded = true; box([370, 335, 1], [0, 0, -2], 'cream', c).material = new THREE.MeshBasicMaterial({color: 0xf8f5e9});}
  for (const [parent, map, xmax, ymax] of [[chart, waterChartPoint, 200, 6], [shakeChart, shakeChartPoint, 3000, .018]]) {kit.rod(map(0, 0), map(xmax, 0), .7 * MM, 'ink', parent); kit.rod(map(0, 0), map(0, ymax), .7 * MM, 'ink', parent);}
  chartText(chart, waterChartPoint, {title: 'Account for all the water', size: 13 * MM, x: {min: 0, max: 200, title: 'Cycle time (s)', ticks: [[0, '0'], [100, '100'], [200, '200']]}, y: {min: 0, max: 6, title: 'Water mass (kg)', ticks: [[0, '0'], [3, '3'], [6, '6']]}, legend: [['Retained', BLUE], ['Collected', 0xae8056]]});
  chartText(shakeChart, shakeChartPoint, {title: 'Steady response, not run-up', size: 13 * MM, x: {min: 0, max: 3000, title: 'Fixed speed (rpm)', ticks: [[0, '0'], [1500, '1,500'], [3000, '3,000']]}, y: {min: 0, max: .018, title: 'Orbit radius (mm)', ticks: [[0, '0'], [.009, '9'], [.018, '18']]}, legend: [['Steady amplitude', 0xc14f39]]});
  const waterLine = lineObject(201, BLUE, chart), collectedLine = lineObject(201, 0xae8056, chart), waterCursor = kit.sphere(3 * MM, [0, 0, 0], 'clay', chart);
  const shakeLine = lineObject(602, 0xc14f39, shakeChart), shakeCursor = kit.sphere(3 * MM, [0, 0, 0], 'clay', shakeChart);
  const chartNow = label(chart, '', [0, -155, 2], 11, 340), shakeNow = label(shakeChart, '', [0, -155, 2], 11, 340);

  const specs = {
    experiment: ['Experiment', '', EXPERIMENTS, 'Choose extraction or a separate fixed-speed vibration experiment. Each changed setting starts a fresh trial.'],
    rpm: ['Drum speed', 'rpm', null, 'Cycle target speed, or held speed in the vibration experiment. Zero leaves the drum still.'],
    load: ['Dry fabric load', 'kg', null, 'Each kilogram starts with 1.5 kg of water. Occupied height increases with load. The synthetic fabric parameters stay fixed.'],
    wall: ['Drum openings', '', [{value: 1, label: 'Perforated wall'}, {value: 0, label: 'Sealed wall'}], 'An ideal sleeve can close every hole. No exit means no extraction even while the drum turns.'],
    lid: ['Lid before starting', '', [{value: 1, label: 'Closed'}, {value: 0, label: 'Open'}], 'The open-lid interlock blocks rotation. Changing this setting restarts the trial; it does not open a running machine.'],
    imbalance: ['Off-center equivalent mass', 'kg', null, 'A fixed equivalent mass at 130 mm radius excites the whole supported assembly. It is not an additional fabric load.'],
    damping: ['Damping ratio', '', null, 'Fraction of critical damping. More damping lowers the steady response near resonance.'],
  };
  for (const [key, [min, max, step]] of Object.entries(SPIN_DOMAINS)) {const [title, unit, options, help] = specs[key]; control(key, title, min, max, step, D[key], unit, help, options, {primary: key === 'experiment', ...(['load', 'wall'].includes(key) ? {visibleWhen: v => v.experiment === 0} : ['imbalance', 'damping'].includes(key) ? {visibleWhen: v => v.experiment === 1} : {})});}
  let clock = 0, initialTime = null, preparedSettings = null, key = '', lastClock = 0, plan, disposed = false, chartSpeeds = [];
  const result = kit.finish(values => {
    const nextKey = JSON.stringify(values);
    if (nextKey !== key) {
      key = nextKey; plan = spinPlan(values); clock = initialTime ?? 0; lastClock = 0;
      for (const [line, field] of [[waterLine, 'moisture'], [collectedLine, 'collected']]) {plan.samples.forEach((s, i) => line.geometry.attributes.position.array.set(waterChartPoint(s.t, field === 'moisture' ? s.moisture * values.load : s.collected), i * 3)); line.geometry.attributes.position.needsUpdate = true; line.geometry.computeBoundingSphere();}
      const peakRpm = shaking(values.imbalance, 0, values.damping).peakW * 60 / TAU;
      chartSpeeds = [...Array.from({length: 601}, (_, i) => i * 5), peakRpm].sort((a, b) => a - b);
      chartSpeeds.forEach((rpm, i) => shakeLine.geometry.attributes.position.array.set(shakeChartPoint(rpm, shaking(values.imbalance, omegaOf(rpm), values.damping).amplitude), i * 3)); shakeLine.geometry.attributes.position.needsUpdate = true; shakeLine.geometry.computeBoundingSphere();
    }
    const s = sampleSpinPlan(plan, clock), [dx, dz] = s.displacement.map(n => n * 1000);
    assembly.position.set(...point([dx, 0, dz])); spinner.rotation.y = rotor.rotation.y = laundryRotor.rotation.y = s.angle;
    lidHinge.rotation.x = values.lid ? 0 : -Math.PI / 2; latch.material.color.setHex(values.lid ? 0x91aa7e : 0xc14f39); lidText.userData.setText(values.lid ? 'Lid closed · cutaway' : 'Lid open · rotation blocked');
    const height = (s.steady ? D.load : values.load) * G.loadHeightPerKg; layerMesh.scale.y = height;
    layerMesh.material.color.copy(laundryColor(s.moisture)); seams.forEach(m => {m.position.y = (height + 4.7) * MM;}); lump.position.y = (height + 9) * MM; lump.visible = s.steady && values.imbalance > 0; lump.scale.setScalar(.6 + values.imbalance * 2);
    sleeve.visible = !s.steady && values.wall === 0;
    for (const {coil, bottom, top} of springData) {const a = new THREE.Vector3(...point(bottom)), b = new THREE.Vector3(...point([top[0] + dx, top[1], top[2] + dz])), d = b.sub(a); coil.position.copy(a); coil.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.clone().normalize()); coil.scale.y = d.length() / (80 * MM);}
    for (const {a, b, tube, piston} of dampers) {const end = [b[0] + dx, b[1], b[2] + dz], mid = a.map((n, i) => n + .6 * (end[i] - n)); setRod(tube, a, mid); setRod(piston, mid, end);}
    const level = jugLevel(s.removed); jugWater.scale.y = Math.max(.0001, level); jugWater.visible = s.removed > 0;
    channelFlow.visible = outletDrop.visible = !s.steady && s.rate > 1e-7; setRod(outletDrop, channelB, [G.jugX, G.jugFloor + Math.max(.01, level), 0]);
    drops.forEach((drop, i) => {
      // Scheduled emissions retain their release position and velocity. They
      // never rotate with the drum after release. Very slow seepage is shown
      // by the mass reading/channel rather than stretched ballistic markers.
      const releasedAt = Math.floor((clock - i * 2) / 72) * 72 + i * 2;
      const release = releasedAt >= 0 ? sampleSpinPlan(plan, releasedAt) : null;
      const age = (clock - releasedAt) / S.cycleSlowdown;
      const rowCount = Math.min(7, Math.max(1, Math.floor((height - 26) / 40) + 1));
      const y = (30 + 40 * (i % rowCount)) / 1000;
      const angle = TAU * drop.userData.hole / G.panelCount + (release?.angle ?? 0);
      const path = dropFlight(release?.w ?? 0, angle, age, y);
      drop.visible = !s.steady && !s.complete && Boolean(release && release.w >= 32 && release.rate > 1e-6 && age >= 0 && !path.caught);
      drop.userData.flight = {releasedAt, age, angle, w: release?.w ?? 0, y, path};
      if (drop.visible) drop.position.set(...point([path.x * 1000, path.y * 1000, path.z * 1000]));
    });
    tangentGuide.visible = !s.steady && s.rate > 1e-6 && s.w > 0;
    if (tangentGuide.visible) {const a = dropFlight(s.w, s.angle, 0, .03), b = dropFlight(s.w, s.angle, Infinity, .03); tangentGuide.geometry.attributes.position.array.set([...point([a.x * 1000, a.y * 1000, a.z * 1000]), ...point([b.x * 1000, b.y * 1000, b.z * 1000])]); tangentGuide.geometry.attributes.position.needsUpdate = true; tangentGuide.geometry.computeBoundingSphere();}
    waterCursor.position.set(...waterChartPoint(s.clock, s.retained)); shakeCursor.position.set(...shakeChartPoint(s.rpmNow, s.shake.amplitude));
    chartNow.userData.setText(`${fixed(s.clock, 0)} s: ${fixed(s.retained, 3)} kg retained + ${fixed(s.removed, 3)} kg collected`);
    shakeNow.userData.setText(`${fixed(s.rpmNow, 0)} rpm: ${fixed(s.shake.amplitude * 1000, 3)} mm orbit radius`);
    const readings = [r('Your result', s.phase, s.steady ? 'A fixed-speed steady response, viewed in slow motion. No startup or water-extraction transient is implied.' : `${fixed(s.clock, 1)} of ${S.duration} s. Changing a setting starts a fresh load.`), r('Drum speed now', `${fixed(s.rpmNow, 0)} rpm`, s.steady ? 'Held speed in this experiment.' : '20 s acceleration, full speed until 180 s, then 20 s braking.'), r('Acceleration at the drum wall', `${fixed(s.gForce, 1)} g`, `Required inward acceleration ${fixed(s.w ** 2 * S.radius, 1)} m/s²; rim speed ${fixed(s.w * S.radius, 2)} m/s.`)];
    if (s.steady) readings.push(r('Steady orbit radius', `${fixed(s.shake.amplitude * 1000, 3)} mm`, 'Radius, not peak-to-peak travel. The cabinet stays fixed while the complete supported assembly moves.'), r('Rotating force amplitude', `${fixed(s.shake.force, 2)} N`, `${fixed(values.imbalance, 2)} kg equivalent imbalance at 130 mm radius.`), r('Displacement phase lag', `${fixed(s.shake.lag * 180 / Math.PI, 2)}°`, 'Displacement lags the rotating force. At high speed they are almost opposite.'), r('Natural speed / peak-response speed', `${fixed(s.shake.natural * 60 / TAU, 2)} / ${fixed(s.shake.peakW * 60 / TAU, 2)} rpm`, 'The rotating force grows with speed squared, so its displacement maximum is slightly above the natural frequency.'), r('Peak steady orbit radius', `${fixed(s.shake.peakAmplitude * 1000, 3)} mm`, `Equivalent moving mass 25 kg; horizontal stiffness 40 kN/m; damping ratio ${fixed(values.damping, 2)}.`));
    else readings.push(r('Illustrative remaining moisture', `${fixed(s.moisture * 100, 2)}%`, 'Water mass divided by dry fabric mass. These synthetic fabric parameters are not a prediction for cotton or a product.'), r('Water collected', `${fixed(s.removed, 3)} kg`, 'The liquid leaves through drum holes, reaches the outer tub and descends into the jug.'), r('Water balance', `${fixed(s.retained, 3)} + ${fixed(s.removed, 3)} = ${fixed(s.initialWater, 3)} kg`, 'Retained + collected = initial water. No evaporation or discarded water.'), r('Extraction rate now', `${fixed(s.rate * 1000, 3)} g/s`, values.wall ? 'Illustrative pressure-dependent drainage slows as mobile water runs out.' : 'The sealed wall blocks extraction.'), r('Rotating liquid pressure scale', `${fixed(s.pressure / 1000, 2)} kPa`, 'Ideal pressure difference across the fixed 40 mm layer. It is not a uniform measured pressure in real fabric.'), r('Illustrative capillary threshold', Number.isFinite(s.holding) ? `${fixed(s.holding * 1e6, 3)} µm` : 'No rotational pressure', 'The synthetic pore-volume distribution and retained floor define this example. No universal bound-water fraction is assumed.'));
    return {state: s, readings};
  });
  const render = result.update;
  result.update = values => {const readings = render(values); if (preparedSettings && Object.entries(preparedSettings).every(([k, v]) => result.getState().values[k] === v)) {initialTime = null; preparedSettings = null;} return readings;};
  result.advance = dt => {if (Number.isFinite(dt) && dt > 0) {initialTime = null; preparedSettings = null; clock = Math.min(plan.duration, clock + dt * (plan.values.experiment === 0 ? S.cycleSpeed : 1));} return render();};
  result.animate = t => {const dt = Number.isFinite(t) ? Math.max(0, t - lastClock) : 0; if (Number.isFinite(t)) lastClock = t; return result.advance(dt);};
  result.reset = ({time = 0, settings} = {}) => {preparedSettings = {...(settings ?? result.defaults)}; const p = spinPlan(preparedSettings); if (!Number.isFinite(time) || time < 0 || time > p.duration) throw new RangeError('Invalid spin dryer checkpoint'); initialTime = time; key = ''; clock = lastClock = 0; return render(preparedSettings);};
  result.replayState = () => ({time: 0, settings: result.getState().values});
  const inspect = (title, id, view = 'iso', isolate = false, experiment = null) => ({label: title, part: id, view, isolate, replay: false, run: () => render(experiment !== null && result.getState().values.experiment !== experiment ? {experiment} : {})});
  result.actions = [inspect('Inspect: complete dryer', 'system'), inspect('Inspect: drum holes', 'drum', 'iso', true), inspect('Inspect: fabric load', 'laundry', 'top', true), inspect('Inspect: motor and shaft', 'motor', 'front'), inspect('Inspect: supports and dampers', 'springs', 'iso'), inspect('Inspect: water departure from above', 'assembly', 'top', false, 0), inspect('Inspect: drain and collection', 'collector', 'front', false, 0), inspect('Compare retained and collected water', 'chart', 'front', true, 0), inspect('Compare steady vibration across speeds', 'shake-chart', 'front', true, 1)];
  result.playback = {label: 'Run this experiment', description: 'Extraction: 200 s at six times real time. Vibration: twelve seconds of a slowed steady orbit. Presets open at named checkpoints.', stepLabel: 'Advance this experiment', advance: result.advance, step: () => result.advance(plan.values.experiment === 0 ? 10 / S.cycleSpeed : 1), complete: () => clock >= plan.duration, blocked: () => false};
  result.autoFramePart = 'system'; result.initialPart = 'system'; result.initialView = 'iso'; result.frameVisibleOnly = true; result.framePadding = .67; result.selectionOutline = false; result.transparentBackground = true; result.thumbnailOmit = [chart, shakeChart];
  result.followParts = ['assembly', 'drum', 'laundry', 'motor', 'tub'];
  for (const p of result.parts) {p.maxZoom = 300; p.framePadding = ['chart', 'shake-chart'].includes(p.id) ? .57 : .67;}
  result.topology = {system, frame, lid, lidHinge, assembly, mounts, bearings, motor, motorBody, rotor, shaft, springs, springData, dampers, tub, tubWall, tubSupportRing, seal, drum, spinner, panels, sleeve, drumStripe, laundry, laundryRotor, layerMesh, seams, lump, water, drops, tangentGuide, drain, channel, channelA, channelB, channelFlow, outletDrop, collector, jugWall, jugWater, jugMarks, chart, shakeChart, waterLine, collectedLine, waterCursor, shakeLine, shakeCursor, chartSpeeds: () => chartSpeeds, MM, G};
  const dispose = result.dispose; result.dispose = () => {if (disposed) return; disposed = true; dispose();};
  return result;
}

import * as THREE from 'three';
import {houseModel, reading as r} from './house-model-kit.js';
import {fixed} from './format.js';
import {surface, solidArrow} from './scene-kit.js';
import {sampleGrinder, grinderPlan, PLATES, MEATS, KNIVES, GRINDER, GRINDER_DEFAULTS as D, GRINDER_DOMAINS} from './meat-grinder-physics.js';

const MM = .01, TAU = 2 * Math.PI, AXIS_Y = 120, FORCE_SCALE = MM;
const BARREL = {back: -60, front: 43, bore: 26, outer: 31};
const AUGER = {root: 10, flight: 25, pitch: 25, back: -58, front: 38, thickness: 1.5};
const PLATE = {front: 49, thickness: 6, radius: 29};
const CRANK = {x: -78, radius: 120, knob: 30};
const HOPPER = {from: -48, to: -8, top: 205, halfAngle: .78};
export const flightCrossing = angle => ((AUGER.back + AUGER.pitch * angle / TAU) % AUGER.pitch + AUGER.pitch) % AUGER.pitch;

export function plateHoles(plate) {
  const count = grinderPlan({plate}).holes, hole = PLATES[plate].hole * 1000, spacing = hole * 1.25, points = [];
  for (let row = -12; row <= 12; row++) for (let col = -12; col <= 12; col++) {
    const y = row * spacing * Math.sqrt(3) / 2, z = (col + (row & 1) / 2) * spacing, d = Math.hypot(y, z);
    if (d <= BARREL.bore - hole / 2 - 1 && d >= 6 + hole / 2) points.push({y, z, d});
  }
  return points.sort((a, b) => a.d - b.d || a.y - b.y || a.z - b.z).slice(0, count);
}

// Solid flight with joined inner/outer edges and end faces; no loose zero-thickness strip.
function flightGeometry() {
  const n = Math.ceil((AUGER.front - AUGER.back) / AUGER.pitch * 96), positions = [], indices = [];
  for (let i = 0; i <= n; i++) {
    const x = AUGER.back + (AUGER.front - AUGER.back) * i / n, theta = -(x - AUGER.back) / AUGER.pitch * TAU;
    for (const dx of [-AUGER.thickness / 2, AUGER.thickness / 2]) for (const radius of [AUGER.root - .1, AUGER.flight]) positions.push((x + dx) * MM, radius * Math.cos(theta) * MM, radius * Math.sin(theta) * MM);
    if (i) { const a = (i - 1) * 4, b = i * 4;
      for (const [u, v] of [[0, 1], [1, 3], [3, 2], [2, 0]]) indices.push(a + u, a + v, b + u, a + v, b + v, b + u);
    }
  }
  indices.push(0, 2, 1, 1, 2, 3, n * 4, n * 4 + 1, n * 4 + 2, n * 4 + 1, n * 4 + 3, n * 4 + 2);
  const geometry = new THREE.BufferGeometry();geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));geometry.setIndex(indices);geometry.computeVertexNormals();return geometry;
}

export function createMeatGrinderModel() {
  const kit = houseModel('Meat grinder'), {root, part, control, finish, covers} = kit;
  const box = (size, pos, color, parent) => kit.box(size.map(v => v * MM), pos.map(v => v * MM), color, parent);
  const rod = (a, b, radius, color, parent) => kit.rod(a.map(v => v * MM), b.map(v => v * MM), radius * MM, color, parent);
  const shapeMesh = (shape, from, to, parent, color = 'metal', y = AXIS_Y) => {
    const geometry = new THREE.ExtrudeGeometry(shape, {depth: to - from, bevelEnabled: false, curveSegments: 32});
    geometry.rotateY(Math.PI / 2);geometry.scale(MM, MM, MM);geometry.translate(from * MM, y * MM, 0);return surface(kit, geometry, color, parent);
  };
  const tube = (inner, outer, from, to, parent, color = 'metal', start = 0, length = TAU, y = AXIS_Y) => {
    const shape = new THREE.Shape().absarc(0, 0, outer, start + Math.PI / 2, start + Math.PI / 2 + length, false);
    if (length === TAU) shape.holes.push(new THREE.Path().absarc(0, 0, inner, 0, TAU, true));
    else {shape.absarc(0, 0, inner, start + Math.PI / 2 + length, start + Math.PI / 2, true);shape.closePath();}
    return shapeMesh(shape, from, to, parent, color, y);
  };
  const system = part('system', 'Meat grinder', 'A hand crank drives the feed screw and knife. The fixed plate resists the paste; the clamp holds the body still.');
  const body = part('body', 'Barrel and support', 'The solid barrel contains the feed screw. Look inside removes its near wall; the hopper has a real opening into the channel.', [0, 0, 0], system);
  const barrelMeshes = [];
  for (const [from, to, opening] of [[BARREL.back, HOPPER.from, 0], [HOPPER.from, HOPPER.to, HOPPER.halfAngle], [HOPPER.to, BARREL.front, 0]]) {
    barrelMeshes.push(tube(26, 31, from, to, body, 'metal', Math.PI, Math.PI - opening));
    const near = tube(26, 31, from, to, body, 'metal', opening, Math.PI - opening);covers.push(near);barrelMeshes.push(near);
  }
  const ribs = part('ribs', 'Fixed barrel ribs', 'These stationary ribs resist rotation of the feed. The teaching model assumes the paste advances with the screw pitch.', [0, AXIS_Y * MM, 0], body);
  for (const theta of [Math.PI * .65, Math.PI, Math.PI * 1.35, Math.PI * 1.7]) rod([-57, 26.5 * Math.cos(theta), 26.5 * Math.sin(theta)], [39, 26.5 * Math.cos(theta), 26.5 * Math.sin(theta)], 1, 'ink', ribs);
  const bearing = part('bearing', 'Rear bearing and thrust seat', 'A bored support holds the rear shaft. The auger shoulder bears on its front face.', [0, 0, 0], body);
  tube(4.2, 31, -64, -60, bearing);tube(4.2, 9, -70, -64, bearing, 'gold');
  const hopper = part('hopper', 'Open feed hopper', 'The tapering walls guide feed through the open top of the barrel, without a wall across its path.', [0, 0, 0], body);
  const half = 31 * Math.sin(HOPPER.halfAngle), bottom = 31 * Math.cos(HOPPER.halfAngle), top = HOPPER.top - AXIS_Y;
  const end = new THREE.Shape();
  for (let i = 0; i <= 32; i++) {const z = -half + 2 * half * i / 32, y = Math.sqrt(31 ** 2 - z ** 2);if (!i) end.moveTo(-z, y);else end.lineTo(-z, y);}
  end.lineTo(-35, top);end.lineTo(35, top);end.closePath();
  shapeMesh(end, -50, -48, hopper);shapeMesh(end, -8, -6, hopper);
  for (const side of [-1, 1]) {const wall = new THREE.Shape();wall.moveTo(-side * half, bottom);wall.lineTo(-side * 35, top);wall.lineTo(-side * 37, top);wall.lineTo(-side * (half + 2), bottom);wall.closePath();const mesh = shapeMesh(wall, -48, -8, hopper);if (side === 1) covers.push(mesh);}
  const clamp = part('clamp', 'Table clamp', 'The upper foot and screw pad grip opposite faces of the table. The crank turns beyond the table edge.', [0, 0, 0], body);
  box([10, 91, 22], [-40, 45.5, 0], 'metal', clamp);box([36, 8, 24], [-20, 34, 0], 'metal', clamp);
  const jawShape = new THREE.Shape();jawShape.moveTo(-48, -12);jawShape.lineTo(-8, -12);jawShape.lineTo(-8, 12);jawShape.lineTo(-48, 12);jawShape.closePath();jawShape.holes.push(new THREE.Path().absarc(-12, 0, 3.2, 0, TAU, true));
  const jawGeometry = new THREE.ExtrudeGeometry(jawShape, {depth: 8, bevelEnabled: false, curveSegments: 24});jawGeometry.rotateX(Math.PI / 2);jawGeometry.scale(MM, MM, MM);jawGeometry.translate(0, 4 * MM, 0);surface(kit, jawGeometry, 'metal', clamp);
  // The fixed clamp screw is a support detail; thread contact is not simulated.
  rod([-12, -24, 0], [-12, 8, 0], 3, 'gold', clamp);box([16, 4, 18], [-12, 8, 0], 'metal', clamp);rod([-24, -22, 0], [0, -22, 0], 2, 'wood', clamp);
  const table = part('table', 'Table edge', 'The fixed work surface supplies the clamp reaction.', [0, 0, 0], clamp);box([195, 20, 120], [67.5, 20, 0], 'wood', table);

  const auger = part('auger', 'Feed auger and drive shaft', 'The joined helical flight advances one pitch per turn in the no-slip teaching model. A continuous shaft carries torque to the knife.', [0, AXIS_Y * MM, 0], system);
  const core = rod([-60, 0, 0], [38, 0, 0], 10, 'metal', auger);
  const rearShaft = rod([-83, 0, 0], [-60, 0, 0], 4, 'metal', auger);
  const knifeDrive = box([5, 5, 5], [40.5, 0, 0], 'metal', auger);
  const frontPin = rod([43, 0, 0], [51, 0, 0], 2.9, 'metal', auger);
  const flight = flightGeometry();surface(kit, flight, 'gold', auger, true);
  const cutter = part('cutter', 'Knife and fixed plate', 'The knife turns against the upstream face of the fixed plate, shearing material at the hole entrances.', [0, AXIS_Y * MM, 0], system);
  const knife = part('knife', 'Four-bladed knife', 'Its square center receives torque from the auger. The flat front faces sweep directly against the plate at x = 43 mm.', [0, 0, 0], cutter);
  const hubShape = new THREE.Shape().absarc(0, 0, 6, 0, TAU, false), square = new THREE.Path();square.moveTo(-2.55, -2.55);square.lineTo(-2.55, 2.55);square.lineTo(2.55, 2.55);square.lineTo(2.55, -2.55);square.closePath();hubShape.holes.push(square);shapeMesh(hubShape, 40, 43, knife, 'ink', 0);
  const blades = [];
  for (let i = 0; i < 4; i++) {const blade = box([3, 21, 5], [41.5, 0, 0], 'ink', knife);blade.geometry.dispose();blade.geometry = new THREE.BoxGeometry(3 * MM, 21 * MM, 5 * MM);blade.geometry.translate(0, 14.5 * MM, 0);blade.rotation.x = i * Math.PI / 2;blades.push(blade);}
  const plate = part('plate', 'Stationary perforated plate', 'The locating notch prevents rotation. Each hole has a real bore through the plate; its upstream face touches the knife.', [0, 0, 0], cutter);
  const plateMesh = surface(kit, new THREE.BufferGeometry(), 'metal', plate);
  const plateStop = part('plate-stop', 'Plate locating pin', 'A fixed pin engages the plate notch and prevents the plate following the rotating knife.', [0, 0, 0], cutter);
  const locatingPin = rod([40, 28, 0], [49, 28, 0], 1, 'ink', plateStop);
  const nut = part('retainer', 'Plate retaining collar', 'The collar seats the plate against the barrel. The stationary thread engagement is simplified.', [0, 0, 0], cutter);
  tube(30, 34, 39, 43, nut, 'gold', 0, TAU, 0);tube(29.1, 34, 43, 49, nut, 'gold', 0, TAU, 0);tube(25.5, 34, 49, 53, nut, 'gold', 0, TAU, 0);
  const crank = part('crank', 'Crank handle', 'A 120 mm radius converts hand force into shaft torque.', [CRANK.x * MM, AXIS_Y * MM, 0], system);
  rod([0, 0, 0], [0, 120, 0], 4, 'metal', crank);rod([-5, 0, 0], [3, 0, 0], 7, 'ink', crank);
  const grip = part('grip', 'Free-turning hand grip', 'The grip revolves around the shaft while its small bearing lets it turn freely in the hand.', [0, 120 * MM, 0], crank);rod([-30, 0, 0], [0, 0, 0], 8, 'wood', grip);
  const handArrow = solidArrow(kit, 0xd9822b, crank, 1.2 * MM);handArrow.position.set(-15 * MM, 120 * MM, 12 * MM);handArrow.userData.setDirection(new THREE.Vector3(0, 0, 1));
  const pushArrow = solidArrow(kit, 0x2f6690, system, 1.2 * MM);pushArrow.position.set(8 * MM, 157 * MM, 0);pushArrow.userData.setDirection(new THREE.Vector3(1, 0, 0));
  handArrow.userData.explosionExcluded = pushArrow.userData.explosionExcluded = true;
  const meat = part('meat', 'Feed and output markers', 'Small feed markers show conveying direction. Extruded strands and collected mince show progress; they do not simulate deformation or predict texture.', [0, 0, 0], system);
  const chunks = Array.from({length: 4}, (_, i) => {const mesh = kit.sphere(4 * MM, [0, 0, 0], 0xb5524a, meat);mesh.userData.offset = i;return mesh;});
  const strands = new THREE.InstancedMesh(new THREE.CylinderGeometry(1, 1, 1, 12), chunks[0].material, 60);strands.frustumCulled = false;meat.add(strands);
  const collection = part('collection', 'Mince collection bowl', 'Collected output grows with the calculated mass. The pile is an illustrative volume, not a packing simulation.', [0, 0, 0], system);
  const bowlProfile = [[0, 31], [22, 32], [47, 44], [53, 72], [51, 72], [45, 46], [21, 34], [0, 34]].map(([x, y]) => new THREE.Vector2(x * MM, y * MM));
  const bowlGeometry = new THREE.LatheGeometry(bowlProfile, 64);bowlGeometry.translate(96 * MM, 0, 0);surface(kit, bowlGeometry, 'cream', collection, true);
  const collected = part('collected', 'Collected mince', 'The illustrated output volume grows with the calculated mass; packing and texture are not modeled.', [0, 0, 0], collection);
  const pile = kit.sphere(1, [96 * MM, 46 * MM, 0], 0xb5524a, collected);
  const specs = {
    rate: ['Requested crank rate', 'turns/s', null, 'The target speed. If hand force is insufficient, the crank slows or stalls.'],
    plate: ['Plate', '', PLATES, 'Smaller holes need more pressure for the same output. Compare the visible holes and strands.'],
    meat: ['Feed resistance', '', MEATS, 'Illustrative yield stress and viscosity, not measured properties of a particular meat.'],
    knife: ['Knife', '', KNIVES, 'A dull knife consumes more shaft torque in this teaching model.'],
    force: ['Available hand force', 'N', null, 'A force limit, not a command to apply the maximum. More force helps only when the crank is limited.'],
  };
  for (const [name, [min, max, step]] of Object.entries(GRINDER_DOMAINS)) {const [label, unit, options, help] = specs[name];control(name, label, min, max, step, D[name], unit, help, options, {primary: name === 'plate'});}
  let elapsed = 0, lastClock = 0, plateShown = null, holes = [], disposed = false;
  const result = finish(values => {
    const s = sampleGrinder(values, elapsed);
    if (plateShown !== values.plate) {
      plateShown = values.plate;holes = plateHoles(values.plate);
      const alpha = Math.asin(1.5 / PLATE.radius), shape = new THREE.Shape().absarc(0, 0, PLATE.radius, Math.PI / 2 + alpha, Math.PI / 2 + TAU - alpha, false);shape.lineTo(1.5, 27);shape.lineTo(-1.5, 27);shape.closePath();
      for (const h of holes) shape.holes.push(new THREE.Path().absarc(-h.z, h.y, s.hole * 500, 0, TAU, true));
      shape.holes.push(new THREE.Path().absarc(0, 0, 3.1, 0, TAU, true));
      const geometry = new THREE.ExtrudeGeometry(shape, {depth: 6, bevelEnabled: false, curveSegments: 32});geometry.rotateY(Math.PI / 2);geometry.scale(MM, MM, MM);geometry.translate(43 * MM, 0, 0);plateMesh.geometry.dispose();plateMesh.geometry = geometry;
    }
    auger.rotation.x = crank.rotation.x = knife.rotation.x = s.angle;grip.rotation.x = -s.angle;
    handArrow.userData.setLength(s.appliedForce * FORCE_SCALE);pushArrow.userData.setLength(s.push * FORCE_SCALE);
    chunks.forEach((chunk, i) => {const q = (s.crankTurns + i) % 4;chunk.visible = q <= 3.16;chunk.position.set((-43.5 + 25 * q) * MM, (AXIS_Y + 18 + 65 * Math.max(0, 1 - q) ** 2) * MM, 0);});
    const matrix = new THREE.Matrix4(), orientation = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), -Math.PI / 2), length = s.strand * 1000 % 35;
    strands.count = holes.length;strands.visible = s.minced > 0;
    holes.forEach((h, i) => {matrix.compose(new THREE.Vector3((49 + length / 2) * MM, (AXIS_Y + h.y) * MM, h.z * MM), orientation, new THREE.Vector3(s.hole * 500 * .98 * MM, Math.max(1e-6, length) * MM, s.hole * 500 * .98 * MM));strands.setMatrixAt(i, matrix);});strands.instanceMatrix.needsUpdate = true;strands.computeBoundingSphere();
    pile.visible = s.minced > 0;const height = Math.cbrt(s.minced / GRINDER.density * 1e9 / (4 / 3 * Math.PI * 2.2 ** 2));pile.scale.set(2.2 * height * MM, height * MM, 2.2 * height * MM);pile.position.y = (36 + height) * MM;
    const outcome = s.mode === 'ready' ? 'Ready · turn the handle for eight seconds' : s.complete ? `Finished · ${fixed(s.minced * 1000, 1)} g collected · handle stopped` : s.stalled ? 'Stalled · no rotation or mince' : `${s.limited ? 'Slower under load' : 'Mincing'} · ${fixed(s.minced * 1000, 1)} g collected`;
    return {state: {...s, holesDrawn: holes.length}, readings: [
      r('Your result', outcome, 'Changing a setting starts a fresh, already primed trial. Inspection preserves the run.'),
      r('Run clock', `${fixed(s.elapsed, 2)} / 8 s`),
      r('Crank rate now', `${fixed(s.rateNow, 3)} turns/s`, 'Zero before starting, at a stall and after completion; startup and coasting are omitted.'),
      r('Rate while turning', `${fixed(s.rate, 3)} / ${fixed(values.rate, 2)} turns/s`, 'Achieved / requested rate at the selected load and force limit.'),
      r('Force needed at requested rate', `${fixed(s.handForce, 2)} N`, 'Required shaft torque divided by the 120 mm handle radius. The actual turning force can be lower if the crank slows.'),
      r('Breakaway force', `${fixed(s.breakawayForce, 2)} N`, 'The limiting force as flow approaches zero. At or below this threshold the paste will not move.'),
      r('Hand force while working', `${fixed(s.appliedForce, 2)} N`, s.stalled ? 'The available force is insufficient. No displacement means no mechanical work.' : 'The orange arrow. Only the force needed at the achieved rate is applied.'),
      r('Pressure while flowing', `${fixed(s.pressure / 1000, 1)} kPa`, 'Zero for a stalled plan. This is the operating prediction, not retained pressure after the hand stops.'),
      r('Yield threshold', `${fixed(s.yieldPressure / 1000, 1)} kPa`, 'Finite flow requires pressure above this threshold, not merely equal to it.'),
      r('Output while turning', `${fixed(s.massFlow * 1000, 2)} g/s`, `${fixed(s.massPerTurn * 1000, 2)} g per turn under the fixed filling assumption.`),
      r('Mince collected', `${fixed(s.minced * 1000, 1)} g`, 'An illustrative mass balance, not a food preparation or quality prediction.'),
      r('Power from the hand', `${fixed(s.handPower, 2)} W`, `Pressure flow ${fixed(s.pressurePower, 2)} W + screw loss ${fixed(s.screwLoss, 2)} W + knife work ${fixed(s.knifePower, 2)} W.`),
      r('Effective conveying push', `${fixed(s.push, 1)} N`, 'Blue arrow: pressure work per turn divided by the 25 mm advance. It accounts for partial channel filling; it is not the force on the whole plate.'),
      r('Screw efficiency', `${fixed(s.eta * 100, 1)}%`, 'Fixed friction 0.3 and drawn lead angle. An illustrative sliding-screw approximation.'),
      r('Work delivered', `${fixed(s.work, 2)} J`, `Pressure work ${fixed(s.pressureWork, 2)} J + screw heat ${fixed(s.screwHeat, 2)} J + knife work ${fixed(s.knifeWork, 2)} J.`),
    ]};
  });
  const render = result.update;
  result.update = (next = {}) => {const before = result.getState().values, readings = render(next);if (Object.keys(D).some(key => before[key] !== result.getState().values[key])) {elapsed = 0;return render();}return readings;};
  result.advance = dt => {if (Number.isFinite(dt) && dt > 0) elapsed = Math.min(8, elapsed + dt);return render();};
  result.animate = clock => {const dt = Number.isFinite(clock) ? Math.max(0, clock - lastClock) : 0;if (Number.isFinite(clock)) lastClock = clock;return result.advance(dt);};
  result.reset = () => {elapsed = lastClock = 0;return render(result.defaults);};
  result.actions = [
    ...[['After two seconds', 2], ['Finish the trial', 8]].map(([label, time]) => ({label, group: 'Run the trial', replay: false, run() {elapsed = time;return render();}})),
    ...[['See the feed screw', 'auger', 'front'], ['See knife against plate', 'cutter', 'front'], ['See the knife', 'knife', 'side'], ['See the plate holes', 'plate', 'side'], ['See the clamp', 'clamp', 'front'], ['See the whole grinder', 'system', 'front']].map(([label, id, view]) => ({label, part: id, view, isolate: id !== 'system', group: 'Look closer', replay: false, run() {root.rotation.set(...(id === 'system' ? [.25, -.55, 0] : id === 'cutter' ? [.2, .8, 0] : [0, 0, 0]));return render();}})),
  ];
  result.playback = {label: 'Turn the handle', description: 'An eight-second trial with continuous feed. Watch the crank slow or stall when available hand force cannot sustain the requested rate.', stepLabel: 'Advance by a twentieth of a second', advance: result.advance, step: () => result.advance(.05), complete: () => Boolean(result.getState().complete), blocked: () => false};
  result.resultPart = {id: 'collection', label: 'Inspect collected mince', view: 'front', focusOnComplete: false, available: () => Boolean(result.getState().complete)};
  root.rotation.set(.25, -.55, 0);result.initialPart = 'system';result.initialView = 'front';result.frameVisibleOnly = true;result.framePadding = .68;result.selectionOutline = false;result.transparentBackground = true;
  result.topology = {system, body, barrelMeshes, ribs, bearing, hopper, clamp, table, auger, core, rearShaft, knifeDrive, frontPin, flight, cutter, knife, blades, plate, plateMesh, plateStop, locatingPin, nut, crank, grip, handArrow, pushArrow, meat, chunks, strands, collection, collected, pile, MM, FORCE_SCALE, AXIS_Y, AUGER, BARREL, PLATE, CRANK, HOPPER, holes: () => holes};
  const dispose = result.dispose;result.dispose = () => {if (!disposed) {disposed = true;dispose();}};return result;
}

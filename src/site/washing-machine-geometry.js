import * as THREE from 'three';
import {surface} from './scene-kit.js';

export const MM = 0.004;
export const CABINET = Object.freeze({width: 600, height: 850, depth: 600});
export const TUB = Object.freeze({radius: 270, outerRadius: 275, depth: 400, x: 0, y: 450, z: -20});
export const DRUM_GEOMETRY = Object.freeze({radius: 250, depth: 300, thickness: 2, panels: 24, rows: 7, holeRadius: 7});
const TAU = 2 * Math.PI;
const point = p => p.map(v => v * MM);

// Circular holes pass through both faces of a curved steel sheet. Each cell
// is tessellated before bending, so triangles do not bridge its hole.
export function perforatedPanel() {
  const G = DRUM_GEOMETRY, half = G.radius * Math.PI / G.panels, vertices = [];
  const bend = (u, z, d) => [(G.radius + d) * Math.sin(u / G.radius) * MM, -(G.radius + d) * Math.cos(u / G.radius) * MM, z * MM];
  const quad = (a, b, c, d) => vertices.push(...a, ...b, ...c, ...a, ...c, ...d);
  const corners = [-1, 1].flatMap(x => [-1, 1].map(y => (Math.atan2(y * 20, x * half) + TAU) % TAU));
  const angles = [...new Set([...Array.from({length: 48}, (_, i) => i * TAU / 48), ...corners])].sort((a, b) => a - b);
  for (let row = 0; row < G.rows; row++) {
    const center = -120 + row * 40;
    const ring = (a, f) => {
      const x = Math.cos(a), y = Math.sin(a), edge = Math.min(half / Math.max(1e-15, Math.abs(x)), 20 / Math.max(1e-15, Math.abs(y)));
      const r = G.holeRadius + f * (edge - G.holeRadius); return [r * x, center + r * y];
    };
    for (let i = 0; i < angles.length; i++) {
      const a = angles[i], b = angles[(i + 1) % angles.length];
      for (let band = 0; band < 3; band++) {
        const p = ring(a, band / 3), q = ring(b, band / 3), r = ring(b, (band + 1) / 3), s = ring(a, (band + 1) / 3);
        quad(bend(...p, 0), bend(...q, 0), bend(...r, 0), bend(...s, 0));
        quad(bend(...s, 2), bend(...r, 2), bend(...q, 2), bend(...p, 2));
      }
      const p = ring(a, 0), q = ring(b, 0); quad(bend(...p, 0), bend(...p, 2), bend(...q, 2), bend(...q, 0));
    }
  }
  for (const [lo, hi] of [[-150, -140], [140, 150]]) for (let i = 0; i < 12; i++) {
    const a = -half + 2 * half * i / 12, b = -half + 2 * half * (i + 1) / 12;
    for (const d of [0, 2]) quad(bend(a, lo, d), bend(b, lo, d), bend(b, hi, d), bend(a, hi, d));
  }
  const geometry = new THREE.BufferGeometry(); geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  geometry.computeVertexNormals(); geometry.computeBoundingBox(); geometry.computeBoundingSphere(); return geometry;
}

function ringGeometry(inner, outer, depth) {
  const shape = new THREE.Shape(); shape.absarc(0, 0, outer * MM, 0, TAU, false);
  const hole = new THREE.Path(); hole.absarc(0, 0, inner * MM, 0, TAU, true); shape.holes.push(hole);
  return new THREE.ExtrudeGeometry(shape, {depth: depth * MM, bevelEnabled: false, curveSegments: 64});
}

// Rounded corners remain inside the control polygon. Unlike an interpolating
// spline, this routing cannot bulge through a neighboring cabinet panel.
function routedCurve(points) {
  const vertices = points.map(p => new THREE.Vector3(...point(p))), path = new THREE.CurvePath();
  let cursor = vertices[0];
  for (let i = 1; i < vertices.length - 1; i++) {
    const previous = vertices[i - 1], corner = vertices[i], next = vertices[i + 1];
    const rounding = Math.min(18 * MM, corner.distanceTo(previous) / 3, corner.distanceTo(next) / 3);
    const a = corner.clone().addScaledVector(previous.clone().sub(corner).normalize(), rounding);
    const b = corner.clone().addScaledVector(next.clone().sub(corner).normalize(), rounding);
    path.add(new THREE.LineCurve3(cursor, a)); path.add(new THREE.QuadraticBezierCurve3(a, corner, b)); cursor = b;
  }
  path.add(new THREE.LineCurve3(cursor, vertices.at(-1))); return path;
}

export function washerGeometry(kit, system) {
  const {part, covers} = kit;
  const machine = part('machine', 'Front-loading washing machine', 'An illustrative washer with a connected drive, suspended tub, water circuit and controller.', [0, 0, 0], system);
  const box = (size, p, color, parent) => kit.box(point(size), point(p), color, parent);
  const disk = (r, h, p, color, parent) => kit.disk(r * MM, h * MM, point(p), color, parent);
  const rod = (a, b, r, color, parent) => kit.rod(point(a), point(b), r * MM, color, parent);
  const ball = (r, p, color, parent) => kit.sphere(r * MM, point(p), color, parent);
  const ring = (inner, outer, depth, p, color, parent) => {
    const mesh = surface(kit, ringGeometry(inner, outer, depth), color, parent); mesh.position.set(...point(p)); return mesh;
  };
  const transparent = (mesh, opacity) => {mesh.material = mesh.material.clone(); mesh.material.transparent = true; mesh.material.opacity = opacity; mesh.material.depthWrite = false; return mesh;};
  const moving = [], hoses = [], supports = [];
  const movingPart = (id, name, description, category) => {const g = part(id, name, description, [0, 0, 0], category); moving.push(g); return g;};
  const category = (id, name, description) => {const g = part(id, name, description, [0, 0, 0], machine); g.userData.explosionCategory = true; return g;};

  const structure = category('structure', 'Cabinet and loading door', 'Fixed frame, removable cutaway panels, sealed door and interlock.');
  const frame = part('frame', 'Frame and leveling feet', 'Four feet support the stationary steel frame. Suspension anchors are attached to this frame.', [0, 0, 0], structure);
  box([600, 20, 600], [0, 20, 0], 'cream', frame);
  for (const x of [-280, 280]) for (const z of [-275, 275]) {
    box([16, 805, 16], [x, 432.5, z], 'metal', frame);
    kit.cylinder(22 * MM, 20 * MM, point([x, 0, z]), 'ink', frame);
  }
  for (const z of [-275, 275]) box([575, 16, 20], [0, 832, z], 'metal', frame);
  for (const x of [-280, 280]) box([20, 16, 560], [x, 832, 0], 'metal', frame);
  const panels = part('panels', 'Removable cabinet panels', 'Look inside removes panels and the front tub wall. The exterior has a real loading opening, not an opaque plate behind the door.', [0, 0, 0], structure);
  covers.push(box([600, 10, 600], [0, 845, 0], 'cream', panels));
  for (const x of [-295, 295]) covers.push(box([10, 810, 600], [x, 435, 0], 'cream', panels));
  covers.push(box([580, 810, 10], [0, 435, -295], 'cream', panels));
  const frontShape = new THREE.Shape(); frontShape.moveTo(-300 * MM, 30 * MM); frontShape.lineTo(300 * MM, 30 * MM); frontShape.lineTo(300 * MM, 840 * MM); frontShape.lineTo(-300 * MM, 840 * MM); frontShape.closePath();
  const doorHole = new THREE.Path(); doorHole.absarc(0, 450 * MM, 203 * MM, 0, TAU, true); frontShape.holes.push(doorHole);
  for (const [x0, y0, x1, y1] of [[-274, 742, -110, 816], [-21, 748, 269, 830]]) {
    const opening = new THREE.Path(); opening.moveTo(x0 * MM, y0 * MM); opening.lineTo(x0 * MM, y1 * MM); opening.lineTo(x1 * MM, y1 * MM); opening.lineTo(x1 * MM, y0 * MM); opening.closePath(); frontShape.holes.push(opening);
  }
  const front = surface(kit, new THREE.ExtrudeGeometry(frontShape, {depth: 10 * MM, bevelEnabled: false, curveSegments: 64}), 'cream', panels); front.position.z = 290 * MM; covers.push(front);
  const door = part('door', 'Door, hinge and window', 'A hinged window closes the loading opening. It stays shut during this program; the lock releases only after the drum has stopped and free water has drained.', [0, 0, 0], structure);
  const doorRim = ring(181, 217, 16, [0, 450, 302], 'metal', door); covers.push(doorRim);
  const glass = transparent(disk(183, 6, [0, 450, 309], 'blue', door), 0.2); covers.push(glass);
  for (const y of [375, 525]) box([25, 35, 32], [-213, y, 299], 'ink', door);
  const handle = box([22, 90, 20], [201, 450, 327], 'ink', door); covers.push(handle);
  const lock = part('lock', 'Door interlock', 'A latch and an electrical lock hold the door closed while the program runs. The status lamp changes when the completed, stopped machine unlocks.', [0, 0, 0], structure);
  box([28, 55, 24], [225, 450, 278], 'clay', lock);
  const lockPin = box([35, 8, 10], [210, 450, 296], 'gold', lock);
  const lockLamp = ball(6, [243, 458, 307], 'leaf', lock); lockLamp.material = lockLamp.material.clone();

  const washing = category('washing', 'Tub, drum and laundry', 'The outer tub holds the bath. The inner drum rotates and lets water pass through its perforations.');
  const tubPart = movingPart('tub', 'Watertight outer tub', 'The outer tub is 540 mm inside diameter and 550 mm outside diameter, leaving suspension clearance inside the cabinet. Its front and upper-right wall are cut away for inspection.', washing);
  const tubShells = [];
  for (let quadrant = 0; quadrant < 4; quadrant++) {
    const profile = [[270, -200], [275, -200], [275, 200], [270, 200], [270, -200]].map(([r, z]) => new THREE.Vector2(r * MM, z * MM));
    const shell = surface(kit, new THREE.LatheGeometry(profile, 32, quadrant * Math.PI / 2, Math.PI / 2), 'blue', tubPart);
    shell.rotation.x = Math.PI / 2; shell.position.set(...point([0, 450, -20])); tubShells.push(shell);
    if (quadrant === 1) covers.push(shell);
  }
  const tubBack = ring(17, 275, 5, [0, 450, -225], 'blue', tubPart);
  const tubFront = ring(190, 275, 5, [0, 450, 180], 'blue', tubPart); covers.push(tubFront);
  const neck = ring(190, 196, 82, [0, 450, 185], 'blue', tubPart); covers.push(neck);
  const seal = part('seal', 'Flexible door seal', 'Rubber bellows join the moving tub neck to the fixed loading opening, keeping the wash water inside while the suspension moves.', [0, 0, 0], structure);
  const bellows = [];
  for (let i = 0; i < 5; i++) {
    const r = ring(190, i % 2 ? 200 : 197, 5, [0, 450, 267 + i * 5], 'ink', seal); covers.push(r); bellows.push(r);
  }
  const drumPart = movingPart('drum', 'Perforated rotating drum', 'The steel drum has through-holes and an open loading mouth. The holes are enlarged for inspection. Water can enter and leave while the fabric stays inside.', washing);
  const drum = new THREE.Group(); drum.position.set(...point([0, 450, -20])); drumPart.add(drum);
  const panelGeometry = perforatedPanel(), drumPanels = [];
  for (let i = 0; i < DRUM_GEOMETRY.panels; i++) {const panel = surface(kit, panelGeometry, 'metal', drum); panel.rotation.z = i * TAU / DRUM_GEOMETRY.panels; drumPanels.push(panel);}
  const drumBack = disk(252, 3, [0, 0, -151.5], 'metal', drum);
  const frontLip = ring(245, 253, 5, [0, 0, 145], 'metal', drum);
  const drumMouth = ring(190, 245, 3, [0, 0, 148], 'metal', drum); covers.push(drumMouth);
  const lifterPart = part('lifters', 'Three drum lifters', 'Ribs attached to the drum lift the laundry. At a slow wash speed the laundry falls back through the bath.', [0, 0, 0], drum);
  const lifters = [];
  for (let i = 0; i < 3; i++) {
    const angle = i * TAU / 3, rib = box([34, 25, 274], [237.5 * Math.sin(angle), -237.5 * Math.cos(angle), 0], 'gold', lifterPart); rib.rotation.z = angle; lifters.push(rib);
  }
  const laundryPart = movingPart('laundry', 'Laundry and retained water', 'Folded cloth markers show lifting, falling and pinning. Their color indicates retained water. Cloth deformation, collisions and stain chemistry are not simulated.', washing);
  const clumps = Array.from({length: 8}, (_, i) => {
    const group = new THREE.Group(); laundryPart.add(group);
    const a = box([45, 24, 45], [0, 0, 0], i % 2 ? 'clay' : 'cream', group); a.material = a.material.clone();
    const b = box([38, 10, 46], [3, 13, 0], i % 2 ? 'cream' : 'clay', group); b.rotation.z = 0.12;
    group.userData.fabric = a; return group;
  });
  const lumpPart = movingPart('imbalance', 'Bunched part of the load', 'The gold fabric marker represents the selected excess load on one side. Its mass drives the suspension calculation; the remaining load is represented by balanced cloth markers during spin.', washing);
  const lump = box([40, 27, 55], [0, 0, 0], 'gold', lumpPart);
  const weights = movingPart('counterweights', 'Counterweights and brackets', 'Dense weights increase the suspended inertia. The vibration calculation uses an assigned 40 kg total assembly, including the wet load.', washing);
  box([370, 48, 170], [0, 757, -55], 'ink', weights);
  for (const x of [-130, 130]) {box([24, 60, 130], [x, 720, -55], 'metal', weights); rod([x, 690, -55], [x, 781, -55], 5, 'gold', weights);}

  const drive = category('drive', 'Motor and drum drive', 'A direct-drive motor turns the drum shaft through sealed bearings.');
  const motor = movingPart('motor', 'Direct-drive motor', 'The motor stator is fastened to the tub. Its rotor is fastened to the shaft, so no belt is needed in this illustrative design.', drive);
  const stator = ring(65, 120, 22, [0, 450, -251], 'ink', motor);
  const coils = [];
  for (let i = 0; i < 12; i++) {const a = i * TAU / 12, coil = box([23, 35, 19], [91 * Math.sin(a), 450 - 91 * Math.cos(a), -254], 'clay', motor); coil.rotation.z = a; coils.push(coil);}
  for (const a of [0, TAU / 3, 2 * TAU / 3]) rod([130 * Math.sin(a), 450 - 130 * Math.cos(a), -222], [106 * Math.sin(a), 450 - 106 * Math.cos(a), -244], 7, 'metal', motor);
  const shaftPart = movingPart('shaft', 'Rotor, shaft and drum spider', 'The rotor and drum spider share one continuous shaft. The rear drum plate is fastened to the spider.', drive);
  const rotor = new THREE.Group(); rotor.position.set(...point([0, 450, -20])); shaftPart.add(rotor);
  const shaft = disk(10, 115, [0, 0, -202.5], 'metal', rotor);
  const rotorDisk = disk(120, 7, [0, 0, -243.5], 'gold', rotor); covers.push(rotorDisk);
  ring(110, 120, 7, [0, 0, -247], 'gold', rotor);
  for (let i = 0; i < 3; i++) {const a = i * TAU / 3; rod([0, 0, -243.5], [112 * Math.sin(a), -112 * Math.cos(a), -243.5], 5, 'gold', rotor);}
  for (let i = 0; i < 3; i++) {const a = i * TAU / 3; rod([0, 0, -162], [205 * Math.sin(a), -205 * Math.cos(a), -162], 9, 'metal', rotor); box([24, 24, 12], [205 * Math.sin(a), -205 * Math.cos(a), -153], 'gold', rotor);}
  const shaftMark = box([8, 16, 5], [70, 0, -249], 'ink', rotor);
  const bearings = movingPart('bearings', 'Shaft bearings and water seal', 'Two bearings support the rotating shaft. A seal at the wet side keeps bath water out of the motor and bearings.', drive);
  const bearingMeshes = [ring(10.2, 24, 10, [0, 450, -239], 'metal', bearings), ring(10.2, 24, 10, [0, 450, -219], 'metal', bearings)];
  const bearingHousing = ring(24, 33, 31, [0, 450, -240], 'metal', bearings);
  const shaftSeal = ring(10, 18, 5, [0, 450, -209], 'ink', bearings);

  const suspension = category('suspension', 'Suspension', 'Springs carry the tub and dampers dissipate motion. Both remain attached as the assembly sways.');
  const springPart = part('springs', 'Hanging suspension springs', 'Two springs connect fixed upper anchors to lugs on the moving tub. The assigned equivalent horizontal stiffness is 18 kN/m.', [0, 0, 0], suspension);
  const damperPart = part('dampers', 'Telescoping dampers', 'Dampers connect the base to moving tub lugs. Their rods slide inside their bodies; the assigned equivalent damping is 340 N·s/m.', [0, 0, 0], suspension);
  for (const side of [-1, 1]) {
    const a = [side * 230, 825, -20], b = [side * 235, 450 + Math.sqrt(275 ** 2 - 235 ** 2), -20];
    box([50, 8, 30], a, 'ink', frame); ball(9, b, 'metal', tubPart);
    const pts = Array.from({length: 181}, (_, i) => {
      const u = i / 180, radius = 12 * MM * Math.min(1, u * 18, (1 - u) * 18);
      return new THREE.Vector3(radius * Math.cos(u * 18 * Math.PI), u, radius * Math.sin(u * 18 * Math.PI));
    });
    const coil = surface(kit, new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 360, 2.2 * MM, 6, false), 'metal', springPart);
    supports.push({kind: 'spring', a, b, coil});
    const lower = [side * 238, 42, 0], upper = [side * 180, 450 - Math.sqrt(275 ** 2 - 180 ** 2), -20];
    box([50, 20, 45], lower, 'ink', frame); ball(11, upper, 'metal', tubPart);
    const body = rod(lower, upper, 12, 'clay', damperPart), piston = rod(lower, upper, 5, 'metal', damperPart);
    supports.push({kind: 'damper', a: lower, b: upper, body, piston});
  }

  const waterCircuit = category('water-circuit', 'Fill, heat and drain circuit', 'Water passes through the inlet valve and detergent drawer into the tub. A separate sump, trap and pump send used water to the drain.');
  function hose(id, name, description, points, weights, radius, color = 'blue', category = waterCircuit) {
    const parent = part(id, name, description, [0, 0, 0], category);
    const curve = routedCurve(points);
    const geometry = new THREE.TubeGeometry(curve, 48, radius * MM, 8, false), mesh = surface(kit, geometry, color, parent);
    const base = geometry.attributes.position.array.slice(), factors = new Float32Array(base.length / 3);
    for (let i = 0; i <= 48; i++) {
      const u = i / 48 * (weights.length - 1), j = Math.min(weights.length - 2, Math.floor(u)), v = u - j;
      for (let k = 0; k <= 8; k++) factors[i * 9 + k] = weights[j] + v * (weights[j + 1] - weights[j]);
    }
    const dots = Array.from({length: 8}, () => ball(radius * 0.65, points[0], 'gold', parent));
    const link = {id, parent, mesh, curve, points, weights, base, factors, dots}; hoses.push(link); return link;
  }
  const inlet = part('inlet', 'Supply hose and inlet valve', 'An electrically controlled valve admits cold supply water only during a fill stage.', [0, 0, 0], waterCircuit);
  rod([-218, 785, -370], [-218, 785, -255], 9, 'blue', inlet);
  box([42, 42, 48], [-218, 785, -239], 'metal', inlet); box([35, 28, 34], [-218, 817, -239], 'clay', inlet);
  const valveLamp = ball(7, [-194, 785, -215], 'blue', inlet); valveLamp.material = valveLamp.material.clone();
  const drawer = part('drawer', 'Detergent drawer and flush channels', 'The wash fill carries the assigned detergent dose from this drawer. Rinse fills carry fresh water without adding another dose.', [0, 0, 0], waterCircuit);
  box([154, 8, 240], [-192, 750, 180], 'cream', drawer);
  for (const x of [-268, -215, -165, -116]) box([5, 50, 240], [x, 779, 180], 'cream', drawer);
  box([168, 76, 8], [-192, 779, 303], 'cream', drawer); box([154, 50, 8], [-192, 779, 58], 'cream', drawer);
  box([100, 12, 10], [-192, 775, 310], 'ink', drawer);
  const detergent = box([43, 13, 120], [-242, 762, 154], 'gold', drawer); detergent.material = detergent.material.clone();
  hose('valve-hose', 'Valve-to-drawer hose', 'Cold water travels from the valve to the drawer spray channel.', [[-218, 785, -215], [-205, 790, -100], [-200, 804, 95]], [0, 0, 0], 8);
  const fillHose = hose('fill-hose', 'Flexible drawer-to-tub hose', 'This flexible hose joins the fixed drawer outlet to the moving tub. Gold markers show flow during filling.', [[-150, 750, 100], [-140, 721, 80], [-120, 694, 80]], [0, 0.5, 1], 13);
  const waterPart = movingPart('water', 'Bath water', 'Free water occupies the bottom of the tub. The calculated volume excludes water retained in the laundry; solid displacement and sump hold-up are omitted.', waterCircuit);
  const pool = transparent(surface(kit, new THREE.BufferGeometry(), 'blue', waterPart), 0.55);
  const heaterPart = movingPart('heater', 'Immersed heating element', 'An assigned 2 kW heater sits below the inner drum in the bath. Red indicates electrical heating, not literal incandescence.', waterCircuit);
  const heater = kit.tube([[-40, 192, 130], [-40, 192, -155], [40, 192, -155], [40, 192, 130]].map(point), 5 * MM, 'metal', heaterPart); heater.material = heater.material.clone();
  box([120, 14, 12], [0, 192, 184], 'ink', heaterPart);
  for (const x of [-40, 40]) rod([x, 192, 130], [x, 192, 190], 5, 'metal', heaterPart);
  const temperatureSensor = movingPart('temperature-sensor', 'Bath temperature sensor', 'A sensor reports the ideal well-mixed bath temperature to the controller, which switches heating off at the selected temperature.', waterCircuit);
  rod([140, 230, 175], [140, 230, 205], 5, 'gold', temperatureSensor);
  const level = part('level-sensor', 'Water-level pressure sensor', 'A small air chamber and tube connect the bath to a pressure sensor. Its signal closes the inlet valve at the assigned fill volume.', [0, 0, 0], waterCircuit);
  disk(22, 15, [242, 793, -180], 'clay', level);
  const pressureHose = hose('pressure-hose', 'Water-level air tube', 'The trapped-air line conveys a pressure signal; these markers stay still because this is not a water delivery hose.', [[110, 205, -30], [266, 465, -50], [255, 670, -110], [242, 780, -180]], [1, 0.7, 0.3, 0], 3, 'ink');
  const sump = hose('sump', 'Tub sump hose', 'Water from the bottom of the moving tub reaches the fixed trap through a flexible descending hose.', [[0, 180, -20], [0, 144, -10], [110, 105, 65], [155, 90, 135]], [1, 0.7, 0.2, 0], 17, 'ink');
  const filter = part('filter', 'Coin trap and drain filter', 'A removable trap catches large debris before it reaches the pump impeller. It is connected between the sump and pump.', [0, 0, 0], waterCircuit);
  const trapBody = transparent(disk(34, 110, [155, 90, 188], 'blue', filter), 0.4);
  const trapCap = disk(37, 10, [155, 90, 248], 'cream', filter); box([48, 12, 13], [155, 90, 258], 'ink', filter);
  for (let i = 0; i < 8; i++) rod([131 + i * 7, 71, 230], [131 + i * 7, 109, 230], 1.6, 'metal', filter);
  const pumpPart = part('pump', 'Drain pump and impeller', 'A motor turns the impeller, pushing used water from the trap into the outlet hose. The pump runs during draining, extraction and braking.', [0, 0, 0], waterCircuit);
  rod([155, 90, 133], [218, 90, 133], 15, 'blue', pumpPart);
  const pumpCase = transparent(disk(33, 35, [218, 90, 116], 'blue', pumpPart), 0.3);
  disk(26, 38, [218, 90, 79.5], 'gold', pumpPart); rod([218, 90, 81], [218, 90, 135], 4, 'metal', pumpPart);
  const impeller = new THREE.Group(); impeller.position.set(...point([218, 90, 121])); pumpPart.add(impeller);
  for (let i = 0; i < 6; i++) {const a = i * TAU / 6, blade = box([24, 5, 12], [12 * Math.cos(a), 12 * Math.sin(a), 0], 'gold', impeller); blade.rotation.z = a;}
  const outlet = hose('outlet', 'Pump outlet and raised drain hose', 'The pump lifts water through a hose to the drain connection. Flow markers appear only while water leaves the tub or laundry.', [[249, 90, 116], [267, 100, -100], [267, 185, -320], [260, 675, -335], [240, 720, -355], [218, 680, -370]], [0, 0, 0, 0, 0, 0], 10);

  const electronics = category('electronics', 'Control and sensing', 'The controller sequences filling, heating, washing, draining and spinning.');
  const controller = part('controller', 'Program controller', 'The program combines temperature, level, speed and door-lock signals. Changing a lesson setting starts a fresh illustrative program.', [0, 0, 0], electronics);
  box([294, 86, 12], [124, 789, 301], 'ink', controller); box([210, 40, 10], [115, 791, 312], 'blue', controller);
  const statusLights = Array.from({length: 6}, (_, i) => {const light = ball(5, [34 + i * 32, 793, 320], 'gold', controller); light.material = light.material.clone(); return light;});
  box([160, 8, 110], [105, 786, 205], 'leaf', controller);
  for (const x of [53, 98, 140]) box([24, 16, 20], [x, 798, 205], 'ink', controller);
  const wiring = part('wiring', 'Control wiring', 'Electrical connections join the board to the motor, inlet valve, heater, pump, sensors and lock. Wire routing is schematic.', [0, 0, 0], electronics);
  const fixedWires = [[[-190, 818, -239], [40, 812, -230], [105, 798, 205]], [[242, 793, -180], [220, 810, 70], [105, 798, 205]], [[225, 450, 278], [265, 640, 272], [105, 798, 205]], [[218, 90, 79], [273, 320, 180], [271, 810, 190], [105, 798, 205]]];
  const wireMeshes = fixedWires.map(points => surface(kit, new THREE.TubeGeometry(routedCurve(points), 64, 2 * MM, 8, false), 'red', wiring));
  for (const x of [45, 170]) rod([x, 786, 205], [x, 786, 295], 4, 'metal', controller);

  hose('motor-cable', 'Flexible motor cable', 'A service loop connects the fixed controller to the motor on the suspended tub.', [[105, 798, 205], [276, 810, 0], [276, 755, -267], [130, 620, -265], [91, 450, -254]], [0, 0, 0.2, 0.7, 1], 2.2, 'red', wiring);
  hose('heater-cable', 'Heater supply cable', 'Flexible wires power the element on the moving tub.', [[105, 798, 205], [280, 660, 237], [280, 210, 230], [40, 192, 190]], [0, 0, 0.4, 1], 2.2, 'red', wiring);
  hose('temperature-cable', 'Temperature signal cable', 'The temperature sensor reports back to the fixed controller through a flexible lead.', [[105, 798, 205], [282, 650, 245], [280, 280, 235], [140, 230, 205]], [0, 0, 0.5, 1], 1.5, 'ink', wiring);

  return {machine, structure, frame, panels, front, door, doorRim, glass, lock, lockPin, lockLamp, seal, bellows,
    washing, tubPart, tubShells, tubBack, tubFront, neck, drumPart, drum, drumPanels, drumBack, frontLip, drumMouth, lifterPart, lifters, laundryPart, clumps, lumpPart, lump, weights,
    drive, motor, stator, coils, shaftPart, rotor, shaft, rotorDisk, shaftMark, bearings, bearingMeshes, bearingHousing, shaftSeal,
    suspension, springPart, damperPart, supports, waterCircuit, inlet, valveLamp, drawer, detergent, fillHose, waterPart, pool, heaterPart, heater, temperatureSensor, level, pressureHose, sump, filter, trapBody, trapCap, pumpPart, pumpCase, impeller, outlet,
    electronics, controller, statusLights, wiring, wireMeshes, moving, hoses};
}

function setRod(mesh, a, b, fractionStart = 0, fractionEnd = 1) {
  const av = new THREE.Vector3(...point(a)), bv = new THREE.Vector3(...point(b)), delta = bv.clone().sub(av);
  const start = av.clone().addScaledVector(delta, fractionStart), end = av.clone().addScaledVector(delta, fractionEnd);
  mesh.position.copy(start).add(end).multiplyScalar(0.5);
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), delta.clone().normalize());
  mesh.scale.y = start.distanceTo(end) / mesh.geometry.parameters.height;
}

export function moveWasherAssembly(hardware, swayMm) {
  for (const object of hardware.moving) object.position.x = swayMm * MM;
  hardware.bellows.forEach((mesh, i) => {mesh.position.x = swayMm * MM * (1 - i / 4);});
  for (const support of hardware.supports) {
    const b = [...support.b]; b[0] += swayMm;
    if (support.kind === 'spring') {
      const a = new THREE.Vector3(...point(support.a)), delta = new THREE.Vector3(...point(b)).sub(a);
      support.coil.position.copy(a); support.coil.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), delta.clone().normalize()); support.coil.scale.y = delta.length();
    } else {setRod(support.body, support.a, b, 0, 0.65); setRod(support.piston, support.a, b, 0.4, 1);}
    support.currentA = [...support.a]; support.currentB = b;
  }
  for (const hose of hardware.hoses) {
    const attribute = hose.mesh.geometry.attributes.position;
    for (let i = 0; i < attribute.count; i++) attribute.setX(i, hose.base[3 * i] + hose.factors[i] * swayMm * MM);
    attribute.needsUpdate = true; hose.mesh.geometry.computeBoundingSphere();
  }
}

export function showWasherFlow(hardware, now, playSeconds, swayMm) {
  for (const hose of hardware.hoses) {
    const filling = ['valve-hose', 'fill-hose'].includes(hose.id), draining = ['sump', 'outlet'].includes(hose.id);
    const on = filling ? now.inletLps > 0 : draining && now.drainLps > 1e-9;
    hose.dots.forEach((dot, i) => {
      dot.visible = on;
      const t = (playSeconds * 0.2 + i / hose.dots.length) % 1, p = hose.curve.getPoint(t);
      const u = t * (hose.weights.length - 1), j = Math.min(hose.weights.length - 2, Math.floor(u)), f = u - j;
      p.x += (hose.weights[j] + f * (hose.weights[j + 1] - hose.weights[j])) * swayMm * MM; dot.position.copy(p);
    });
  }
}

import * as THREE from 'three';
import {textLabel} from './scene-kit.js';

// Illustrative supports and functional connections. Dimensions are millimeters;
// connectors and colored bundles are not a production pinout or circuit design.
export function installHeadsetHardware(kit, {system, headset, lenses, display, imu, camera, shell, MM, H}) {
  const at = p => p.map(x => x * MM);
  const part = (id, name, description, parent) => kit.part(id, name, description, [0, 0, 0], parent);
  const box = (size, pos, color, parent) => kit.box(at(size), at(pos), color, parent);
  const rod = (a, b, radius, color, parent) => kit.rod(at(a), at(b), radius * MM, color, parent);
  const device = part('device', 'Complete headset', 'Case, supported optics, display, tracking sensor, interface electronics and two earphones move together with the wearer.', system);
  const optical = part('optical-module', 'Optics and display', 'Mounted lenses and a supported display put a separate view in front of each eye.', device);
  const electronic = part('electronic-module', 'Electronics and audio', 'The tracking sensor sends measurements through the interface; returned image and sound data drive the panel and earphones.', device);
  for (const [object, parent] of [[headset, device], [lenses, optical], [display, optical], [imu, electronic]]) {
    parent.add(object); kit.parts.find(p => p.object === object).parentId = kit.parts.find(p => p.object === parent).id;
  }
  for (const object of [headset, optical, electronic]) object.userData.explosionCategory = true;
  Object.assign(kit.parts.find(p => p.object === headset), {name: 'Case and fit', description: 'The illustrative case is 184 mm across. A strap holds it in its assigned wearing pose. The simplified face interface is not a custom fit or anthropometric model.'});
  for (const mesh of shell) Object.assign(mesh.material, {opacity: 1, transparent: false, depthWrite: true});
  // Leave a real aperture for the side connector instead of drawing its body
  // through an unbroken wall. The removed primitive remains owned for disposal.
  shell[1].visible = false;
  for (const [y0, y1, z0, z1] of [[-20, 41, 94, 156], [49, 62, 94, 156], [41, 49, 94, 127], [41, 49, 137, 156]]) {
    const wall = box([3, y1 - y0, z1 - z0], [-90.5, (y0 + y1) / 2, (z0 + z1) / 2], 'ink', headset); wall.material = shell[1].material;
  }
  const front = part('front-cover', 'Removable front cover', 'Look inside removes this front wall and the top lid to expose the working parts.', headset);
  front.add(shell[2]);
  const lid = part('top-lid', 'Top lid', 'The removable lid closes the top of the case.', headset);
  box([184, 3, 62], [0, 63.5, 125], 'ink', lid);
  kit.covers.push(front, lid);

  const bridge = part('lens-bridge', 'Lens support bridge', 'A bridge joins the case walls. Two short supports meet the lens rims above the clear apertures.', lenses);
  const lensBeam = rod([-89, 44, H.lensZ], [89, 44, H.lensZ], 1.5, 'metal', bridge);
  const lensStems = [-31.5, 31.5].map(x => rod([x, 39.4, H.lensZ], [x, 44, H.lensZ], 1.5, 'metal', bridge));

  const displayMounts = part('display-mounts', 'Adjustable display supports', 'Four telescoping supports meet the back of the panel and the inside of the front wall. The distance control assigns their extension; a drive mechanism is not simulated.', display);
  const sleeves = [], shafts = [];
  for (const x of [-60, 60]) for (const y of [-10, 50]) {
    const shape = new THREE.Shape(), hole = new THREE.Path();
    shape.absarc(0, 0, 2, 0, Math.PI * 2, false); hole.absarc(0, 0, 1.1, 0, Math.PI * 2, true); shape.holes.push(hole);
    const geometry = new THREE.ExtrudeGeometry(shape, {depth: 4, bevelEnabled: false, curveSegments: 24}); geometry.scale(MM, MM, MM);
    const sleeve = new THREE.Mesh(geometry, lensBeam.material); sleeve.position.set(...at([x, y, 149])); displayMounts.add(sleeve); sleeves.push(sleeve);
    shafts.push(rod([x, y, 143], [x, y, 151], 1, 'metal', displayMounts));
  }

  const sensorMounts = part('sensor-mounts', 'Sensor board supports', 'Two braces span the case, and four standoffs meet the underside of the sensor board.', imu);
  const sensorBraces = [115, 125].map(z => rod([-89, 44, z], [89, 44, z], 1.5, 'metal', sensorMounts));
  const sensorPosts = [];
  for (const x of [-8, 8]) for (const z of [115, 125]) sensorPosts.push(rod([x, 45.5, z], [x, 53.2, z], 1.2, 'metal', sensorMounts));

  const interfaceBoard = part('interface-board', 'Display and audio interface', 'Supported interface electronics receive image and sound data from the host and return tracking measurements. Their colored connections show function, not a real circuit layout.', electronic);
  const board = box([70, 1.6, 28], [0, -8, 120], 'leaf', interfaceBoard), boardPosts = [];
  for (const x of [-30, 30]) for (const z of [110, 130]) boardPosts.push(rod([x, -17, z], [x, -8.8, z], 1.5, 'metal', interfaceBoard));
  const controller = box([12, 1, 12], [0, -6.7, 120], 'ink', interfaceBoard);
  for (const x of [-14, 14]) box([8, 1, 8], [x, -6.7, 120], 'ink', interfaceBoard);

  const earphones = part('earphones', 'Left and right earphones', 'Two earphones reproduce separately rendered sound channels. Head tracking changes their arrival-time cues for a source fixed in the virtual world. The cue diagram is visual; this lesson emits no sound.', electronic);
  const cups = [], pads = [], arms = [];
  for (const side of [-1, 1]) {
    const cup = kit.disk(24 * MM, 12 * MM, at([side * 83.2, 15, 0]), 'ink', earphones); cup.rotation.set(0, 0, Math.PI / 2); cups.push(cup);
    const pad = kit.ring(18 * MM, 3 * MM, at([side * 74.2, 15, 0]), 'cream', earphones); pad.rotation.y = Math.PI / 2; pads.push(pad);
    arms.push(rod([side * 84, 32, 20], [side * 83.2, 38, 0], 2, 'metal', earphones));
  }

  const connections = [], localWires = part('headset-wiring', 'Headset signal bundles', 'Sensor data travels to the host. Returned image and sound data feed the panel and earphones. Bundle thickness and routing are illustrative.', electronic);
  function connection(name, points, parent, color = 'gold', radius = .7) {
    const meshes = points.slice(1).map((point, i) => rod(points[i], point, radius, color, parent));
    const item = {name, points, meshes}; connections.push(item); return item;
  }
  function reshape(item, points) {
    item.points = points;
    for (const [i, mesh] of item.meshes.entries()) {
      const a = new THREE.Vector3(...at(points[i])), b = new THREE.Vector3(...at(points[i + 1])), d = b.clone().sub(a);
      if (!mesh.geometry.boundingBox) mesh.geometry.computeBoundingBox();
      const length = mesh.geometry.boundingBox.max.y - mesh.geometry.boundingBox.min.y;
      mesh.scale.y = d.length() / length; mesh.position.copy(a).add(b).multiplyScalar(.5); mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize());
    }
  }
  connection('Sensor to interface', [[11, 54, 120], [70, 54, 120], [70, -7, 120], [35, -7, 120]], localWires, 'blue');
  const displayWire = connection('Interface to panel', [[35, -7, 120], [72, -7, 120], [72, -7, 148], [60, -7, 146]], localWires, 'blue');
  connection('Host connector to interface', [[-92, 45, 132], [-85, 45, 132], [-85, -7, 120], [-35, -7, 120]], localWires);
  for (const side of [-1, 1]) connection(side < 0 ? 'Right ear channel' : 'Left ear channel', [[side * 35, -7, 120], [side * 85, -7, 120], [side * 88, 30, 94], [side * 84, 32, 20], [side * 83.2, 15, 0]], localWires, 'clay');
  const connector = box([6, 8, 10], [-92, 45, 132], 'metal', interfaceBoard);

  const host = part('host', 'External rendering computer', 'An external computer combines tracking measurements with the virtual scene, prepares two eye views and renders two sound channels. The box represents that external system, not its internal circuitry.', system);
  host.userData.explosionExcluded = true;
  const hostBox = box([80, 50, 90], [-250, -105, -60], 'ink', host);
  textLabel(host, 'Rendering computer', {height: .09, width: 1.6, position: at([-250, -72, -60])});
  const links = part('computer-links', 'Computer and tracking cables', 'A flexible headset cable carries power, outgoing tracking measurements and returning image and sound data. A second cable connects the external tracking camera to the host. Individual conductors and protocols are omitted.', system);
  links.userData.explosionExcluded = true;
  // Smooth illustrative routing, with slack below the moving headset. Samples
  // stay above the support plane; cable mechanics and tension are not solved.
  const route = points => new THREE.CatmullRomCurve3(points.map(p => new THREE.Vector3(...p)), false, 'catmullrom', .2).getPoints(64).map(p => [p.x, Math.max(-128, p.y), p.z]);
  const headsetRoute = yaw => {
    const rotate = p => new THREE.Vector3(...p).applyAxisAngle(new THREE.Vector3(0, 1, 0), yaw).toArray();
    return route([rotate([-95, 45, 132]), rotate([-135, 25, 150]), [-155, -70, 230], [-205, -128, 160], [-270, -128, 70], [-270, -118, 20], [-270, -105, -15]]);
  };
  const hostCable = connection('Headset to host', headsetRoute(0), links, 'ink', 2);
  const cameraStart = new THREE.Vector3(0, 0, -10 * MM).applyEuler(camera.rotation).add(camera.position).divideScalar(MM).toArray();
  const cameraCable = connection('Camera to host', route([cameraStart, [175, -20, 202], [190, -85, 220], [190, -128, 245], [50, -128, 265], [-170, -128, 210], [-235, -128, 90], [-235, -105, -15]]), links, 'ink', 1.5);
  function update(yaw, screen) {
    for (const group of [interfaceBoard, earphones, localWires]) group.rotation.y = yaw;
    const panelBack = H.lensZ + screen + H.panel[2];
    shafts.forEach((shaft, i) => {
      const x = i < 2 ? -60 : 60, y = i % 2 ? 50 : -10;
      const a = [x, y, panelBack], b = [x, y, 151]; reshape({meshes: [shaft]}, [a, b]);
    });
    reshape(displayWire, [[35, -7, 120], [72, -7, 120], [72, -7, 148], [60, -7, panelBack]]);
    reshape(hostCable, headsetRoute(yaw));
  }
  return {device, optical, electronic, front, lid, bridge, lensBeam, lensStems, displayMounts, sleeves, shafts, sensorMounts, sensorBraces, sensorPosts, interfaceBoard, board, boardPosts, controller, connector, earphones, cups, pads, arms, localWires, connections, host, hostBox, links, hostCable, cameraCable, update};
}

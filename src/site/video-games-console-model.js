import * as THREE from 'three';
import {createGamesControllerModel, CONTROLLER} from './games-controller-model.js';
import {PAD_DEFAULTS, PAD_DOMAINS, CLOCKS} from './games-controller-physics.js';
import {reading as r} from './house-model-kit.js';
import {fixed} from './format.js';
import {lineObject, textLabel} from './scene-kit.js';

const KEYS = ['debounce', 'polling', 'display'];
export const CONSOLE_DEFAULTS = Object.freeze(Object.fromEntries(KEYS.map(key => [key, PAD_DEFAULTS[key]])));
export const CONSOLE_DOMAINS = Object.freeze(Object.fromEntries(KEYS.map(key => [key, PAD_DOMAINS[key]])));
export const CONSOLE_GEOMETRY = Object.freeze({mm: .01, width: 275, depth: 215, height: 60, boardTop: 12, boardBottom: 10.4, fanHz: 30});
const pick = values => Object.fromEntries(KEYS.filter(key => key in values).map(key => [key, values[key]]));
const settings = values => ({...PAD_DEFAULTS, rumble: 0, ...pick(values)});
const ms = time => fixed(time * 1000, 1);

export function consoleStages(plan) {
  const p = plan.press;
  return [
    {name: 'Touch', time: p.t}, {name: 'Filtered', time: p.registered},
    {name: 'Received', time: p.reported}, {name: 'Game update', time: p.frame},
    {name: 'Frame ready', time: p.frame + plan.frame}, {name: 'Visible', time: p.photon},
  ];
}

// A teaching console around the accepted report/frame simulation. Geometry is
// illustrative; colored board routes represent functional buses, not a PCB.
export function createVideoGamesConsoleModel() {
  const model = createGamesControllerModel(), t = model.topology, mm = CONSOLE_GEOMETRY.mm;
  const raw = Object.fromEntries(['update', 'advance', 'animate', 'reset', 'getState'].map(key => [key, model[key]]));
  const oldCovers = [...model.covers];
  const rig = new THREE.Group(); rig.name = 'Console experiment'; model.root.add(rig);
  rig.add(t.machine, t.screen, t.charts); t.system.visible = false;
  t.machine.scale.setScalar(.5); t.machine.position.set(-2.1 - CONTROLLER.x * mm, 0, 2.1 - CONTROLLER.z * mm);
  t.screen.scale.setScalar(2.5); t.screen.position.set(0, 0, -2.35);
  t.machine.traverse(object => {delete object.userData.explosionCategory;});
  t.machine.userData.explosionExcluded = true;
  for (const cover of oldCovers) cover.visible = true;
  t.timeline.visible = t.map.visible = t.adc.visible = false;
  model.parts = model.parts.filter(part => ['machine', 'screen', 'bounce', 'latency'].includes(part.id));
  model.partViewDirections = {};
  for (const part of model.parts) {
    part.parentId = 'console-experiment'; part.framePadding = .65;
    model.partViewDirections[part.id] = {front: part.id === 'machine' ? [.65, 1.6, 3] : [0, 0, 3]};
  }
  Object.assign(model.parts.find(part => part.id === 'machine'), {name: 'External controller', description: 'A wired controller supplies the assigned button press and stick report. Open Games controller for its internal mechanisms.', route: '#machine/games-controller'});
  Object.assign(model.parts.find(part => part.id === 'screen'), {description: 'The monitor shows completed game frames after the selected extra display delay. One ring marks each received press. It uses the same physical drawing scale as the console and controller; scan-out and pixel response are not modeled.'});
  const register = (id, name, description, parent = rig) => {
    const object = new THREE.Group(); object.name = name; parent.add(object);
    const parentId = model.parts.find(part => part.object === parent)?.id || 'console-experiment';
    model.parts.push({id, name, description, object, parentId, framePadding: .75, maxZoom: 250});
    model.partViewDirections[id] = {front: [.7, 1.8, 3], side: [3, 1.3, 0], back: [-.7, 1.8, -3], top: [0, 3, 0], bottom: [0, -3, 0]};
    return object;
  };
  model.parts.push({id: 'console-experiment', name: 'Complete console experiment', description: 'Follow an input through the console computer to the delayed picture.', object: rig, framePadding: .68, maxZoom: 250});
  model.partViewDirections['console-experiment'] = {front: [.7, 1.5, 3], side: [3, 1.2, 0], back: [-.7, 1.5, -3], top: [0, 3, 0], bottom: [0, -3, 0]};
  const computer = register('console-computer', 'Video games console', 'A hollow case holds a supported board, processor, working memory, storage, ports, regulation and cooling. The layout is illustrative, not a particular product.');
  const category = (id, name, description) => {const group = register(id, name, description, computer); group.userData.explosionCategory = true; return group;};
  const enclosure = category('console-enclosure', 'Case and supports', 'The case, feet and standoffs support and protect the computer.');
  const logic = category('console-logic', 'Processing and memory', 'Input reports update game state in working memory; graphics work produces an image.');
  const services = category('console-services', 'Power and cooling', 'An external low-voltage supply feeds regulators; a heat sink and fan remove processor heat. Electrical and thermal dynamics are outside this timing model.');
  const materials = {ink: t.chip.material, board: t.board.material, metal: t.boardSupports[0].material, gold: t.traces[0].material, shell: t.bottomShell.material, cream: t.buttonStem.material};
  const colored = color => new THREE.MeshStandardMaterial({color, roughness: .8});
  const blue = colored(0x6e96a8), green = colored(0x7c945c), orange = colored(0xb4774c);
  const at = point => new THREE.Vector3(...point.map(value => value * mm));
  const mesh = (geometry, position, material, parent) => {const object = new THREE.Mesh(geometry, material); object.position.copy(at(position)); parent.add(object); return object;};
  const box = (size, position, material, parent) => mesh(new THREE.BoxGeometry(...size.map(v => v * mm)), position, material, parent);
  const cylinder = (radius, height, position, material, parent) => mesh(new THREE.CylinderGeometry(radius * mm, radius * mm, height * mm, 32), position, material, parent);
  const words = (parent, text, position, height = 5, color = '#f5f0dc') => {const label = textLabel(parent, text, {height: height * mm, position: position.map(v => v * mm), color}); label.rotation.x = -Math.PI / 2; return label;};
  const basePart = register('console-base', 'Base, walls and feet', 'Open walls surround the board. Front input and rear video and power openings align with their connectors.', enclosure);
  const base = box([275, 4, 215], [0, 2, 0], materials.shell, basePart), walls = [], feet = [];
  for (const x of [-136, 136]) walls.push(box([3, 54, 215], [x, 31, 0], materials.shell, basePart));
  const wall = (x0, x1, y0, y1, z) => walls.push(box([x1 - x0, y1 - y0, 3], [(x0 + x1) / 2, (y0 + y1) / 2, z], materials.shell, basePart));
  wall(-134.5, 134.5, 4, 18, 106); wall(-134.5, 134.5, 30, 58, 106);
  wall(-134.5, -103, 18, 30, 106); wall(-77, 134.5, 18, 30, 106);
  wall(-134.5, 134.5, 4, 19, -106);
  wall(-134.5, -115, 29, 58, -106); wall(-55, 134.5, 29, 58, -106);
  wall(-115, -55, 29, 36, -106); wall(-115, -55, 52, 58, -106);
  for (let x = -113; x <= -57; x += 4) wall(x - 1, x + 1, 36, 52, -106);
  for (const [x0, x1] of [[-134.5, 60], [80, 103], [117, 134.5]]) wall(x0, x1, 19, 29, -106);
  for (const x of [-115, 115]) for (const z of [-85, 85]) feet.push(cylinder(7, 4, [x, -2, z], materials.ink, basePart));
  const lid = register('console-lid', 'Vented lid', 'The removable lid has an open grille above the fan. Cutaway lifts this lid out of the view.', enclosure);
  for (const [size, position] of [
    [[87.5, 2, 215], [-93.75, 59, 0]], [[127.5, 2, 215], [73.75, 59, 0]],
    [[60, 2, 67.5], [-20, 59, -73.75]], [[60, 2, 87.5], [-20, 59, 63.75]],
  ]) box(size, position, materials.shell, lid);
  for (let x = -48; x <= 8; x += 4) box([2, 2, 60], [x, 59, -10], materials.shell, lid);
  const mounts = register('console-mounts', 'Board standoffs', 'Four standoffs meet the base and the underside of the mainboard.', enclosure), supports = [];
  for (const x of [-113, 113]) for (const z of [-83, 83]) supports.push(cylinder(3, 6.4, [x, 7.2, z], materials.metal, mounts));
  const boardPart = register('console-board', 'Mainboard', 'The supported board connects the packages. Colored paths are simplified functional buses, not a production circuit schematic.', logic);
  const board = box([245, 1.6, 200], [0, 11.2, 0], materials.board, boardPart);
  const processor = register('console-processor', 'CPU and GPU package', 'One illustrative system-on-chip package contains CPU and GPU functions. Their separate colored regions show roles, not real die geometry.', logic);
  const chip = box([40, 2, 40], [-20, 13, -10], materials.ink, processor);
  const cpu = register('console-cpu', 'CPU game update', 'The CPU uses the received input and game rules to update state and issue drawing commands. This model updates on a fixed 60 Hz frame clock.', processor);
  const gpu = register('console-gpu', 'GPU rendering', 'The GPU uses drawing commands and scene data to produce pixels. Rendering is assigned one 16.7 ms period here; real rendering time depends on workload and hardware.', processor);
  const cpuFace = box([15, .1, 30], [-30, 14.05, -10], blue.clone(), cpu), gpuFace = box([19, .1, 30], [-11, 14.05, -10], green.clone(), gpu);
  words(cpu, 'CPU', [-30, 14.12, -10], 5); words(gpu, 'GPU', [-11, 14.12, -10], 5);
  const ram = register('console-ram', 'Working memory', 'RAM holds the current game state, scene resources and frame data while powered. The software uses distinct memory regions; the illustration does not claim separate physical chips for each role.', logic);
  const memory = [-45, -20, 5, 30].map(z => box([20, 2.5, 14], [45, 13.25, z], materials.ink, ram));
  for (const z of [-45, -20, 5, 30]) words(ram, 'RAM', [45, 14.55, z], 4);
  const storage = register('console-storage', 'Game storage', 'Nonvolatile storage holds the installed program and assets. Required data is already loaded before this timed experiment; storage is not read afresh for every button press.', logic);
  const storageSupports = [-100, -50].map(x => cylinder(2, 3, [x, 13.5, -48], materials.metal, storage));
  const storageBoard = box([62, 1.2, 22], [-75, 15.6, -48], materials.board, storage);
  const storageChips = [-90, -64].map(x => box([17, 2, 16], [x, 17.2, -48], materials.ink, storage));
  words(storage, 'Game data', [-76, 18.3, -48], 3.6);
  const io = register('console-input', 'Input interface and USB port', 'The host requests reports at the chosen polling interval. The game receives observed button edges at its next update. USB wiring is shown as a functional bundle.', logic);
  const ioChip = box([18, 2, 18], [-90, 13, 62], materials.ink, io); words(io, 'Input', [-90, 14.1, 62], 4);
  const connector = (parent, center, width, height, depth, openingDirection) => {
    const [x, y, z] = center, shell = [];
    for (const dy of [-height / 2 + .5, height / 2 - .5]) shell.push(box([width, 1, depth], [x, y + dy, z], materials.metal, parent));
    for (const dx of [-width / 2 + .5, width / 2 - .5]) shell.push(box([1, height - 2, depth], [x + dx, y, z], materials.metal, parent));
    const tongue = box([width - 4, 2, depth - 1], [x, y - 1, z], materials.ink, parent);
    const pins = []; for (let i = 0; i < 4; i++) pins.push(box([1, .3, depth - 2], [x - 4.5 + i * 3, y + .15, z], materials.gold, parent));
    const legHeight = y - height / 2 - CONSOLE_GEOMETRY.boardTop;
    const legs = [-1, 1].map(side => box([2, legHeight, 2], [x + side * (width / 2 - 2), CONSOLE_GEOMETRY.boardTop + legHeight / 2, z - openingDirection * (depth / 2 - 1)], materials.metal, parent));
    return {center, width, height, depth, openingDirection, shell, tongue, pins, legs};
  };
  const usb = connector(io, [-90, 24, 102], 24, 10, 12, 1);
  const video = register('console-video', 'Display output', 'The completed image reaches the monitor through a digital video link. Protocol encoding, audio and scan-out are omitted.', logic);
  const videoChip = box([18, 2, 18], [80, 13, -65], materials.ink, video); words(video, 'Video', [80, 14.1, -65], 4);
  const videoPort = connector(video, [70, 24, -102], 18, 8, 12, -1);
  const power = register('console-power', 'Low-voltage input and regulators', 'An ideal external adapter supplies low-voltage DC. Regulation feeds the board and fan; mains circuitry, voltage conversion losses and detailed supply rails are not modeled.', services);
  const powerPort = connector(power, [110, 24, -102], 12, 8, 12, -1);
  const regulator = box([28, 12, 25], [87, 18, 58], orange, power); words(power, 'Power', [87, 24.1, 58], 4.5);
  const cooling = register('console-cooling', 'Heat sink and fan', 'The seated heat sink conducts heat from the processor package. A supported fan moves air through its fins. This geometry illustrates cooling; heat flow and temperature are not simulated.', services);
  const sink = register('console-sink', 'Heat sink', 'A metal base meets the processor and carries separated fins. The CPU/GPU labels are schematic regions beneath it.', cooling);
  const sinkBase = box([48, 3, 48], [-20, 15.6, -10], materials.metal, sink), fins = [];
  for (let x = -42; x <= 2; x += 4) fins.push(box([1, 16, 44], [x, 25.1, -10], materials.metal, sink));
  const fan = register('console-fan', 'Supported cooling fan', 'The illustrative fan turns at an assigned 30 revolutions per second, slowed with playback. Its speed is not derived from temperature or load.', cooling);
  const fanSupports = []; for (const x of [-43, 3]) for (const z of [-33, 13]) fanSupports.push(cylinder(1, 18, [x, 26.1, z], materials.metal, fan));
  const fanRing = mesh(new THREE.TorusGeometry(25 * mm, 2 * mm, 8, 64), [-20, 37.1, -10], materials.ink, fan); fanRing.rotation.x = Math.PI / 2;
  const fanFrame = [];
  for (const offset of [-25, 25]) {fanFrame.push(box([4, 4, 54], [-20 + offset, 37.1, -10], materials.ink, fan)); fanFrame.push(box([46, 4, 4], [-20, 37.1, -10 + offset], materials.ink, fan));}
  const rotor = new THREE.Group(); rotor.position.copy(at([-20, 37.1, -10])); fan.add(rotor);
  const hubShape = new THREE.Shape(), hubBore = new THREE.Path(); hubShape.absarc(0, 0, 5 * mm, 0, Math.PI * 2, false); hubBore.absarc(0, 0, 2.1 * mm, 0, Math.PI * 2, true); hubShape.holes.push(hubBore);
  const hubGeometry = new THREE.ExtrudeGeometry(hubShape, {depth: 4 * mm, bevelEnabled: false, curveSegments: 48}); hubGeometry.translate(0, 0, -2 * mm); hubGeometry.rotateX(Math.PI / 2);
  const fanHub = mesh(hubGeometry, [0, 0, 0], materials.ink, rotor);
  const fanBearing = cylinder(2, 4, [-20, 36.7, -10], materials.metal, fan), fanSpokes = [];
  for (let i = 0; i < 3; i++) {
    const angle = i * Math.PI * 2 / 3, points = [[-20, 34.7, -10], [-20 + 23.5 * Math.cos(angle), 34.7, -10 + 23.5 * Math.sin(angle)], [-20 + 25 * Math.cos(angle), 35.6, -10 + 25 * Math.sin(angle)]];
    for (let j = 1; j < points.length; j++) {const a = at(points[j - 1]), b = at(points[j]), d = b.clone().sub(a), spoke = new THREE.Mesh(new THREE.CylinderGeometry(.45 * mm, .45 * mm, d.length(), 12), materials.ink); spoke.position.copy(a).add(b).multiplyScalar(.5); spoke.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize()); fan.add(spoke); fanSpokes.push(spoke);}
  }
  for (let i = 0; i < 7; i++) {const blade = box([7, 1.2, 19], [0, 0, 13], materials.ink, rotor); const arm = new THREE.Group(); arm.rotation.y = i * Math.PI * 2 / 7; rotor.add(arm); arm.add(blade); blade.rotation.z = .35;}
  const buses = register('console-buses', 'Functional board connections', 'Colored bundles connect input, processing, memory, storage, video and power. They show logical connectivity; widths, pin counts and routing are not a real PCB design.', logic), connections = [];
  const route = (name, points, material = materials.gold, parent = buses, radius = .45) => {
    const meshes = [];
    for (let i = 1; i < points.length; i++) {const a = at(points[i - 1]), b = at(points[i]), d = b.clone().sub(a), object = new THREE.Mesh(new THREE.CylinderGeometry(radius * mm, radius * mm, d.length(), 12), material); object.position.copy(a).add(b).multiplyScalar(.5); object.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize()); parent.add(object); meshes.push(object);}
    const record = {name, points, meshes, parent, radius}; connections.push(record); return record;
  };
  route('USB to input', [[-90, 24, 96], [-90, 12.5, 87], [-90, 12.5, 71]], blue);
  route('Input to processor', [[-81, 12.5, 62], [-55, 12.5, 62], [-55, 12.5, 5], [-40, 13, 5]], blue);
  for (const z of [-45, -20, 5, 30]) route('Memory ' + z, [[35, 13, z], [24, 12.5, z], [24, 12.5, -10], [0, 13, -10]], green);
  route('Storage data', [[-44, 15.6, -48], [-34, 12.5, -48], [-34, 13, -30]], green);
  route('Video data', [[0, 13, -20], [14, 12.5, -20], [14, 12.5, -65], [71, 13, -65]], blue);
  route('Video connector', [[80, 13, -74], [80, 12.5, -85], [70, 24, -96]], blue);
  route('Power input', [[110, 24, -96], [116, 18, -88], [116, 18, 58], [101, 18, 58]], orange, power, .8);
  route('Board supply', [[73, 18, 58], [62, 12.5, 58], [5, 12.5, 58], [5, 12.5, 10], [0, 13, 10]], orange, power, .65);
  route('Fan supply', [[73, 18, 50], [60, 40, 50], [14, 40, 25], [4, 37.1, -10]], orange, power, .6);
  const links = register('console-links', 'External signal cables', 'A controller cable reaches the input connector, and a video cable connects the console to its monitor. Their paths show connections, not signal propagation speed.'); links.userData.explosionExcluded = true;
  model.root.updateMatrixWorld(true);
  const sourcePort = t.port.getWorldPosition(new THREE.Vector3()).divideScalar(mm).toArray();
  const usbCable = route('Controller cable', [sourcePort, [-185, 18, 135], [-145, 18, 135], [-90, 24, 118], [-90, 24, 108]], materials.ink, links, 1.8);
  const monitorCable = route('Monitor cable', [[70, 24, -108], [100, 18, -135], [100, 45, -200], [0, 160, -244]], materials.ink, links, 1.6);
  // The external adapter ends at the rear socket. Its mains side is outside view.
  const supplyLead = route('Adapter lead', [[110, 24, -108], [155, 12, -135], [168, 12, -130]], materials.ink, links, 1.8);
  const adapter = box([34, 18, 50], [184, 12, -130], materials.ink, links); words(links, 'DC adapter', [184, 21.1, -130], 4);
  const pipeline = register('console-pipeline', 'Input to picture', 'Six named milestones follow the first received press. Timing is measured from first contact, not from the start of playback.'); pipeline.userData.inspectionOnly = 'console-pipeline'; pipeline.userData.explosionExcluded = true;
  model.partViewDirections['console-pipeline'] = {front: [0, 0, 3]}; model.parts.find(p => p.id === 'console-pipeline').framePadding = .62;
  textLabel(pipeline, 'From touch to picture', {height: .20, position: [0, 1.46, 0], weight: 'bold'});
  const milestones = [];
  for (let i = 0; i < 6; i++) {
    const y = 1.05 - i * .38;
    const indicator = new THREE.Mesh(new THREE.CircleGeometry(.07, 24), colored(0x9ca28f)); indicator.position.set(-1.20, y, 0); pipeline.add(indicator);
    const name = textLabel(pipeline, '', {height: .16, width: 1.3, align: 'left', position: [-1.03, y, .01]});
    const time = textLabel(pipeline, '', {height: .15, width: .90, align: 'right', position: [1.27, y, .01]});
    milestones.push({indicator, name, time});
    if (i < 5) {const line = lineObject(2, 0x7e8a72, pipeline); line.geometry.setAttribute('position', new THREE.Float32BufferAttribute([-1.20, y - .09, 0, -1.20, y - .29, 0], 3));}
  }
  const pipelineStatus = textLabel(pipeline, '', {height: .15, width: 2.9, position: [0, -1.28, 0]});
  const buffers = register('console-frame-data', 'Game state and frame data', 'Two snapshots separate the most recent game update from the delayed image currently visible. These are logical views of data, not two additional physical screens or dedicated memory chips.'); buffers.userData.inspectionOnly = 'console-frame-data'; buffers.userData.explosionExcluded = true;
  model.partViewDirections['console-frame-data'] = {front: [0, 0, 3]}; model.parts.find(p => p.id === 'console-frame-data').framePadding = .62;
  textLabel(buffers, 'Game state and visible picture', {height: .18, position: [0, 1.22, 0], weight: 'bold'});
  const snapshots = [];
  for (const [i, title] of ['Latest game update', 'Currently visible'].entries()) {
    const x = i ? .92 : -.92, background = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 1.2), colored(0xf0eddd)); background.position.set(x, .15, 0); buffers.add(background);
    textLabel(buffers, title, {height: .12, width: 1.65, position: [x, .92, .01]});
    const dot = new THREE.Mesh(new THREE.CircleGeometry(.07, 24), orange); dot.position.z = .01; buffers.add(dot);
    const rings = [0.13, .19].map(radius => {const ring = new THREE.Mesh(new THREE.RingGeometry(radius - .015, radius, 32), colored(0x92752f)); buffers.add(ring); return ring;});
    const label = textLabel(buffers, '', {height: .12, width: 1.65, position: [x, -.67, .01]}); snapshots.push({x, dot, rings, label});
  }
  textLabel(buffers, 'Times from first contact. Rings count received presses.', {height: .11, width: 3.6, position: [0, -1.02, 0]});
  model.controls = model.controls.filter(control => KEYS.includes(control.key));
  model.defaults = {...CONSOLE_DEFAULTS}; model.covers = [lid]; model.thumbnailOmit = [t.machine, t.screen, t.charts, links, pipeline, buffers];
  model.initialPart = model.autoFramePart = 'console-experiment'; model.initialIsolated = true; model.initialCutaway = true;
  model.includeCoversInSeparation = true;
  model.root.name = model.root.userData.machine = 'Video games console';
  const progress = s => {
    const stages = consoleStages(s), reached = stages.filter(stage => s.clock >= stage.time - 1e-12).length;
    const stage = ['Waiting for the touch', 'Contact made; filtering input', 'Filter accepted; waiting for report', 'Report received; waiting for game update', 'Game updated; rendering frame', 'Frame ready; waiting for display', 'First press visible'][reached];
    return {stages, reached, stage, renderProgress: s.now.frame ? Math.min(1, Math.max(0, (s.clock - s.now.frame.t) / s.frame)) : 0};
  };
  const readings = s => {
    const p = progress(s), n = s.now, press = s.press;
    return [
      r('Your result', s.clock <= CLOCKS.start ? 'Ready · press Play to follow one controller press' : s.clock >= CLOCKS.duration ? `Observation complete · ${n.onScreen} visible ${n.onScreen === 1 ? 'press' : 'presses'} · first response ${ms(press.latency)} ms` : `${ms(s.clock - press.t)} ms from touch · ${p.stage}`, 'The input follows the accepted controller model. Playback is 50 times slower; inspection preserves the moment.'),
      r('Controller decision', n.firmware ? 'Pressed' : 'Released', `${s.values.debounce} agreeing 1 ms scans; first press accepted ${ms(press.registered - press.t)} ms after contact.`),
      r('Host reports', `${s.rate} Hz · ${n.heard} observed ${n.heard === 1 ? 'press' : 'presses'}`, `First pressed report at ${ms(press.reported - press.t)} ms from contact. This example queues observed edges; changes entirely between polls may be missed.`),
      r('Game state', n.frame ? `${n.frame.presses} accepted ${n.frame.presses === 1 ? 'press' : 'presses'} · update ${ms(n.frame.t - press.t)} ms` : 'No game frame yet', 'The assigned 60 Hz game loop reads the latest report and queued edges, updates its world and submits drawing work.'),
      r('Rendering', `${fixed(p.renderProgress * 100, 0)}% of current assigned frame`, 'Rendering takes one 16.7 ms period in this model. That duration is an assumption, not a rule for consoles.'),
      r('Visible picture', `${n.onScreen} visible ${n.onScreen === 1 ? 'press' : 'presses'}`, n.shown ? `The screen shows the update from ${ms(n.shown.t - press.t)} ms relative to contact, after rendering and ${s.values.display} ms extra display delay.` : 'No frame from the observed interval has reached the display yet.'),
      r('First response', `${ms(press.latency)} ms from touch to screen`, `${ms(press.registered - press.t)} filter + ${ms(press.reported - press.registered)} poll wait + ${ms(press.frame - press.reported)} game wait + ${ms(s.frame)} render + ${s.values.display} display.`),
      r('Across clock phases', `${ms(s.latency.min)}–${ms(s.latency.max)} ms · mean ${ms(s.latency.mean)} ms`, 'Exact range and mean for this assigned bounce trace and uniformly distributed scan, poll and frame phases, not measured commercial hardware.'),
    ];
  };
  function refresh() {
    const s = raw.getState(), p = progress(s);
    rotor.rotation.y = (s.clock - CLOCKS.start) * CONSOLE_GEOMETRY.fanHz * Math.PI * 2;
    cpuFace.material.color.set(s.now.frame && s.clock - s.now.frame.t < .002 ? 0x93bccb : 0x6e96a8);
    gpuFace.material.color.setRGB(.35 + .20 * p.renderProgress, .45 + .20 * p.renderProgress, .25);
    for (const [i, mark] of milestones.entries()) {mark.indicator.material.color.set(i < p.reached ? 0x537b43 : 0xb9bdad); mark.name.userData.setText(p.stages[i].name); mark.time.userData.setText(`${ms(p.stages[i].time - s.press.t)} ms`);}
    pipelineStatus.userData.setText(p.stage);
    for (const [i, frame] of [s.now.frame, s.now.shown].entries()) {
      const item = snapshots[i], position = frame?.position || [0, 0];
      item.dot.position.set(item.x - .40 + position[0] * 2.5, -.1 + position[1] * 2.5, .01);
      item.rings.forEach((ring, j) => {ring.visible = (frame?.presses || 0) > j; ring.position.copy(item.dot.position); ring.position.z = .02;});
      item.label.userData.setText(frame ? `${ms(frame.t - s.press.t)} ms · ${frame.presses} ${frame.presses === 1 ? 'press' : 'presses'}` : 'No observed frame yet');
    }
    return readings(s);
  }
  model.update = (values = {}) => {raw.update(settings({...raw.getState().values, ...values})); return refresh();};
  for (const name of ['advance', 'animate']) model[name] = (...args) => {raw[name](...args); return refresh();};
  model.reset = (initial = {}) => {raw.reset({...initial, settings: settings({...CONSOLE_DEFAULTS, ...(initial.settings || {})})}); return refresh();};
  model.getState = () => {const s = raw.getState(); return {...s, values: pick(s.values), pipeline: progress(s), readings: readings(s)};};
  model.replayState = () => ({settings: pick(raw.getState().values), time: 0});
  model.actions = [
    ['Inspect: complete experiment', 'console-experiment'], ['Inspect: console computer', 'console-computer'], ['Inspect: processor', 'console-processor'], ['Inspect: working memory', 'console-ram'], ['Inspect: game storage', 'console-storage'], ['Inspect: input interface', 'console-input'], ['Inspect: display output', 'console-video'], ['Inspect: power and cooling', 'console-services'], ['Watch: monitor', 'screen'], ['Read: input to picture', 'console-pipeline'], ['Compare: game and picture', 'console-frame-data'], ['Read: contact and reports', 'bounce'], ['Read: timing distribution', 'latency'],
  ].map(([label, part]) => ({label, part, view: 'front', isolate: true, replay: false, run: () => refresh()}));
  model.playback = {...model.playback, label: 'Follow the input', description: 'Follow the button through reports, game updates, rendering and display, fifty times slower.', advance: model.advance, step: () => model.advance(.005 * t.SLOW)};
  model.consoleTopology = {rig, computer, enclosure, logic, services, base, walls, feet, lid, supports, board, processor, chip, cpuFace, gpuFace, memory, storageBoard, storageChips, storageSupports, ioChip, usb, videoChip, videoPort, powerPort, regulator, sinkBase, fins, fanSupports, fanRing, fanFrame, fanHub, fanBearing, fanSpokes, rotor, connections, usbCable, monitorCable, supplyLead, adapter, pipeline, milestones, pipelineStatus, snapshots, mm};
  model.reset(); return model;
}

import * as THREE from 'three';
import {houseModel, reading} from './house-model-kit.js';
import {surface, solidArrow, textLabel} from './scene-kit.js';
import {INK_DEFAULTS, INK_DOMAINS, INK_WORDS, createInkController} from './electronic-ink-physics.js';

const WHITE = 0xf5f1dc, DARK = 0x29352c, GOLD = 0xe3b45e, BLUE = 0x83b4c1;
const label = (parent, text, x, y, width = 3, height = .20, z = .15) => textLabel(parent, text, {width, height, position: [x, y, z]});
const separateColor = mesh => {mesh.material = mesh.material.clone(); return mesh;};
const glass = (mesh, opacity) => {separateColor(mesh); mesh.material.transparent = true; mesh.material.opacity = opacity; mesh.material.depthWrite = false; return mesh;};
const point = index => [(index % 17 - 8) * .18, .89 - Math.floor(index / 17) * .18];

function buildInkModule(kit) {
  const system = kit.part('system', 'Electronic ink', 'An enlarged reflective display module. Its stored pigment states form a word; the capsule inspection follows the highlighted pixel.');
  const assembly = kit.part('assembly', 'Display module', 'Power, control electronics, row and column drivers, TFT electrodes and an ink film form one connected teaching module. Its 119 pixels and packaging are enlarged and illustrative.', [0, 0, 0], system);
  const frame = kit.part('frame', 'Mounting board and display frame', 'A supporting board holds the electrical parts and display stack. The frame surrounds the ink without covering the word.', [0, 0, 0], assembly);
  const support = kit.box([5.3, 3.6, .10], [0, 0, -.17], 'leaf', frame);
  const rails = [
    kit.box([.13, 1.74, .20], [-1.76, .35, -.02], 'ink', frame),
    kit.box([.13, 1.74, .20], [1.76, .35, -.02], 'ink', frame),
    kit.box([3.39, .13, .20], [0, 1.155, -.02], 'ink', frame),
    kit.box([3.39, .13, .20], [0, -.455, -.02], 'ink', frame),
  ];
  label(frame, '119 enlarged pixels', 0, 1.47, 3.25, .23, -.105);
  label(frame, 'Ink reflects light; it does not glow', 0, -1.68, 4.7, .19, -.105);

  const power = kit.part('power', 'Power supply and switch', 'The source powers writing. Opening the switch sets every modeled pixel voltage to zero while the pigment image remains. Immediate electrical discharge is assumed.', [0, 0, 0], assembly);
  const battery = kit.box([.40, 1.6, .16], [-2.35, .20, -.04], 'metal', power);
  const terminals = [kit.box([.24, .09, .08], [-2.35, 1.045, -.005], 'gold', power), kit.box([.24, .09, .08], [-2.35, -.645, -.005], 'ink', power)];
  label(power, '+', -2.35, .83, .23, .22, .048);label(power, '−', -2.35, -.43, .23, .22, .048);
  label(power, 'Power', -2.35, .21, .38, .18, .05);
  const switchBase = kit.box([.42, .25, .16], [-2.11, -1.20, -.04], 'cream', power);
  const switchContacts = [-2.26, -1.96].map(x => kit.sphere(.035, [x, -1.20, .065], 'gold', power));
  const switchPivot = new THREE.Group();switchPivot.position.set(-2.26, -1.20, .065);power.add(switchPivot);
  const switchBlade = kit.rod([0, 0, 0], [.30, 0, 0], .022, 'gold', switchPivot);
  const powerWires = [
    kit.tube([[-2.35, 1.09, .005], [-2.60, 1.09, .005], [-2.60, -1.20, .015], [-2.26, -1.20, .065]], .016, 'red', power),
    kit.rod([-1.96, -1.20, .065], [-.85, -1.20, -.005], .016, 'red', power),
    kit.tube([[-2.35, -.69, .005], [-1.70, -.69, .005], [-1.70, -1.52, .005], [-.75, -1.52, .005], [-.75, -1.47, -.005]], .016, 'ink', power),
  ];
  const switchText = label(power, '', -2.20, -1.48, .85, .17, .09);

  const controller = kit.part('controller', 'Image controller', 'The controller holds the requested word and addresses differences from the stored image. Changing a request without power leaves the old material state intact.', [0, 0, 0], assembly);
  const controllerBoard = kit.box([1.3, .62, .09], [-.20, -1.22, -.075], 'blue', controller);
  const chip = kit.box([.48, .37, .10], [-.29, -1.22, .02], 'ink', controller);
  const powerChip = kit.box([.19, .26, .07], [.27, -1.22, .005], 'ink', controller);
  textLabel(controller, 'Image', {width: .40, height: .14, position: [-.29, -1.22, .078], color: '#f5f1dc'});
  const controllerStatus = label(controller, '', 1.43, -1.44, 1.75, .18, .10);

  const drivers = kit.part('drivers', 'Row and column drivers', 'A selected row admits column commands through the TFTs. The gold row marks a slowed teaching scan. Real waveforms and transistor circuitry are omitted.', [0, 0, 0], assembly);
  const rowDriver = kit.box([.17, 1.30, .10], [-1.94, .35, -.07], 'ink', drivers);
  const columnDriver = kit.box([3.04, .15, .10], [0, -.72, -.07], 'ink', drivers);
  const driverLinks = [kit.rod([-.29, -.91, -.02], [-.29, -.795, -.02], .018, 'gold', drivers), kit.tube([[-.69, -.91, -.02], [-.69, -.85, -.02], [-1.94, -.85, -.02], [-1.94, -.30, -.02]], .015, 'gold', drivers)];
  const rows = Array.from({length:7}, (_, row) => separateColor(kit.rod([-1.94, .89 - row * .18, -.045], [1.54, .89 - row * .18, -.045], .009, 'gold', drivers)));
  const columns = Array.from({length:17}, (_, col) => kit.rod([(col - 8) * .18, -.72, -.063], [(col - 8) * .18, 1.00, -.063], .006, 'metal', drivers));
  const driverText = label(drivers, '', 1.43, -1.06, 1.75, .18, .10);

  const backplane = kit.part('backplane', 'TFT backplane and electrodes', 'Each addressed region has a pixel electrode and a switching transistor. Row and column paths occupy separate schematic layers. Look inside to expose the backplane.', [0, 0, 0], assembly);
  const substrate = kit.box([3.38, 1.47, .06], [0, .35, -.09], 'metal', backplane);
  const electrodes = Array.from({length:119}, (_, i) => {const [x, y] = point(i); return separateColor(kit.box([.166, .166, .01], [x, y, -.055], 'gold', backplane));});
  const transistors = Array.from({length:119}, (_, i) => {const [x, y] = point(i); return separateColor(kit.box([.038, .038, .02], [x - .07, y - .07, -.04], 'ink', backplane));});

  const ink = kit.part('ink', 'Reflective pigment layer', 'A continuous film contains many microcapsules. The displayed squares represent average pigment state over addressed regions, not one capsule per pixel. Pigment positions determine which parts of the patch look light or dark.', [0, 0, 0], assembly);
  const film = separateColor(kit.box([3.20, 1.40, .03], [0, .35, -.035], WHITE, ink));
  const pixels = Array.from({length:119}, (_, i) => {
    const [x, y] = point(i), mesh = kit.box([.174, .174, .012], [x, y, -.014], WHITE, ink);
    mesh.material = new THREE.MeshBasicMaterial({color: WHITE, toneMapped: false});return mesh;
  });
  const selectedRing = kit.ring(.123, .009, [0, 0, .033], 'red', ink);
  selectedRing.userData.explosionExcluded = true;

  const common = kit.part('common', 'Transparent common electrode', 'A transparent conductor on the viewing side is referenced to 0 V. Pixel electrodes underneath the ink supply the illustrated positive or negative potential.', [0, 0, 0], assembly);
  const commonSheet = glass(kit.box([3.28, 1.46, .02], [0, .35, .002], BLUE, common), .055);
  const commonLead = kit.tube([[.38, -1.22, .005], [2.13, -1.22, .005], [2.13, 1.05, .005], [1.64, 1.05, .002]], .012, 'blue', common);
  label(common, '0 V', 2.12, 1.32, .63, .19, .025);

  const capsule = kit.part('capsule', 'Selected capsule, enlarged', 'A section through a capsule in the highlighted pixel region. The viewing side is at the top of this rotated section. Black is positive and white negative in the stated Carta convention. Lanes separate the particles for clarity; this is not a packing or transport calculation.', [0, 0, 0], system);
  capsule.userData.inspectionOnly = 'capsule';capsule.userData.explosionExcluded = true;
  label(capsule, 'Selected pixel → charged pigments', 0, 1.73, 3.75, .25);
  const capsulePixel = label(capsule, '', 0, 1.40, 3.5, .21);
  const topElectrode = kit.box([1.65, .055, .48], [0, .875, 0], 'blue', capsule);
  const bottomElectrode = kit.box([1.65, .055, .48], [0, -.875, 0], 'gold', capsule);
  const shell = glass(surface(kit, new THREE.SphereGeometry(.84, 40, 24, Math.PI, Math.PI), 'blue', capsule, true), .16);
  const rim = kit.ring(.84, .012, [0, 0, 0], 'blue', capsule);
  label(capsule, 'Viewing side · common 0 V', 0, 1.10, 3.25, .20);
  const bottomText = label(capsule, '', 0, -1.12, 3.5, .21);
  const blackPigment = Array.from({length:3}, (_, i) => kit.sphere(.075, [-.48 + i * .39, 0, -.14], DARK, capsule));
  const whitePigment = Array.from({length:3}, (_, i) => kit.sphere(.075, [-.29 + i * .39, 0, .14], WHITE, capsule));
  const fieldArrow = solidArrow(kit, GOLD, capsule, .018);
  const blackArrow = solidArrow(kit, DARK, capsule, .017);
  const whiteArrow = solidArrow(kit, BLUE, capsule, .017);
  label(capsule, 'E', 1.25, 0, .25, .25);
  label(capsule, 'Black +     White −', 0, -1.43, 3.6, .24);
  const capsuleStatus = label(capsule, '', 0, -1.76, 3.85, .22);
  for (const part of [power, controller, drivers, backplane, ink, common]) {part.userData.explosionCategory = true;part.userData.explosionRigid = true;}
  for (const mesh of [...powerWires, ...driverLinks, commonLead]) mesh.userData.explosionExcluded = true;
  return {system, assembly, frame, support, rails, power, battery, terminals, switchBase, switchContacts, switchPivot, switchBlade, powerWires, switchText, controller, controllerBoard, chip, powerChip, controllerStatus, drivers, rowDriver, columnDriver, driverLinks, rows, columns, driverText, backplane, substrate, electrodes, transistors, ink, film, pixels, selectedRing, common, commonSheet, commonLead, capsule, capsulePixel, topElectrode, bottomElectrode, shell, rim, blackPigment, whitePigment, fieldArrow, blackArrow, whiteArrow, bottomText, capsuleStatus};
}

function updateInkGeometry(g, state) {
  const {values, now} = state, white = new THREE.Color(WHITE), dark = new THREE.Color(DARK);
  g.pixels.forEach((mesh, i) => mesh.material.color.copy(now.visible ? white.clone().lerp(dark, now.pixels[i]) : dark));
  g.film.material.color.set(now.visible ? WHITE : DARK);
  const [x, y] = point(now.selected);g.selectedRing.position.set(x, y, .033);
  g.rows.forEach((mesh, row) => mesh.material.color.set(row === now.activeRow ? GOLD : 0x8e9a85));
  g.electrodes.forEach((mesh, i) => mesh.material.color.set(now.voltages[i] > 0 ? GOLD : now.voltages[i] < 0 ? BLUE : 0xadb49a));
  g.transistors.forEach((mesh, i) => mesh.material.color.set(now.voltages[i] ? GOLD : DARK));
  g.switchPivot.rotation.z = values.power ? 0 : .70;
  g.switchText.userData.setText(values.power ? 'Connected' : 'Disconnected');
  g.controllerStatus.userData.setText(`Requested: ${INK_WORDS[values.word].name}`);
  g.driverText.userData.setText(now.activeRow >= 0 ? `Writing row ${now.activeRow + 1}` : values.power ? 'Pixel drive off' : 'Power disconnected');
  g.capsulePixel.userData.setText(`Row ${Math.floor(now.selected / 17) + 1}, column ${now.selected % 17 + 1}`);
  const position = now.pixels[now.selected];
  g.blackPigment.forEach(mesh => mesh.position.y = -.48 + .96 * position);
  g.whitePigment.forEach(mesh => mesh.position.y = .48 - .96 * position);
  for (const [mesh, direction, x0, z, length] of [[g.fieldArrow, now.field, 1.02, 0, 1.24], [g.blackArrow, now.blackForce, -.22, .31, .46], [g.whiteArrow, now.whiteForce, .22, .31, .46]]) {
    mesh.visible = direction !== 0;mesh.position.set(x0, -Math.sign(direction) * length / 2, z);
    mesh.userData.setLength(direction ? length : 0);mesh.userData.setDirection(new THREE.Vector3(0, direction || 1, 0));
  }
  g.bottomText.userData.setText(`Pixel electrode: ${now.voltage > 0 ? '+' : ''}${now.voltage} V`);
  g.capsuleStatus.userData.setText(now.voltage ? 'Field and opposite pigment forces' : 'Zero field; pigment state retained');
}

const storedName = readback => !readback.complete ? 'Unfinished word' : readback.text ? `${readback.text} · ${readback.contrast ? 'white letters' : 'black letters'}` : `Blank ${readback.contrast ? 'black' : 'white'}`;

export function createElectronicInkModel() {
  const kit = houseModel('Electronic ink'), g = buildInkModule(kit), controller = createInkController();
  const choices = labels => labels.map((label, value) => ({label, value}));
  const controls = {
    word: ['Requested word', INK_WORDS.map(item => item.name), 'Choose the next image. Powered updates preserve existing pigment states and move only the differences. Requests made without power wait.'],
    contrast: ['Letter contrast', ['Black on white', 'White on black'], 'Choose which pigment faces the viewing side in the letters and background.'],
    power: ['Writing power', ['Disconnected', 'Connected'], 'Disconnect drive without erasing the stored pigment image. Reconnect and press Play to write a queued request.'],
    light: ['Light on page', ['Off', 'On'], 'Illumination changes what can be seen on the reflective patch, without moving its pigment. Enlarged inspections remain lit for teaching.'],
  };
  for (const key of Object.keys(INK_DEFAULTS)) {const [name, options, help] = controls[key];kit.control(key, name, ...INK_DOMAINS[key], INK_DEFAULTS[key], '', help, choices(options), {primary: key === 'word'});}
  const result = kit.finish(() => {
    const state = controller.getState(), {values, now} = state;updateInkGeometry(g, state);
    const stored = storedName(now.readback), pending = now.matchedCells !== 119;
    return {state: {...state, time: state.clock}, readings: [
      reading('Your result', !now.visible ? 'Page dark; pigment state still stored' : !now.complete ? `Writing ${INK_WORDS[values.word].name}` : !values.power && pending ? `${stored}; new request waiting` : stored, !values.power ? 'No electrical drive reaches the ink. Reconnect Writing power and press Play to update the retained image.' : now.complete ? 'The pixel drive is now zero. The bistable ink retains the resulting image.' : 'Watch the highlighted row. Only pixels different from the request move.'),
      reading('Stored pattern', stored, 'The pigment image can differ from the request while writing or without power. Intermediate shades illustrate motion, not measured reflectance.'),
      reading('Requested image', `${INK_WORDS[values.word].name} · ${values.contrast ? 'white on black' : 'black on white'}`, `${now.matchedCells} of 119 pixels currently match. A disconnected supply cannot move pigment to satisfy a new request.`),
      reading('Addressed pixels', `${now.writtenCells} of ${now.changedCells} changes finished`, now.activeRow >= 0 ? `Row ${now.activeRow + 1} of 7 is active. The two separator columns and any unchanged letter pixels keep their current state.` : 'No row is being driven. The 0.8 scene-second row schedule is a teaching choice, not commercial refresh time.'),
      reading('Selected pixel drive', `${now.voltage > 0 ? '+' : ''}${now.voltage} V`, `Row ${Math.floor(now.selected / 17) + 1}, column ${now.selected % 17 + 1}. Top common electrode: 0 V. Positive black follows the field; negative white moves against it.`),
      reading('Pixel drive after writing', now.voltages.every(value => value === 0) ? 'Zero on all 119 pixels' : `${now.voltages.filter(value => value !== 0).length} pixels driven`, 'Retention is imposed as an observed material behavior. The model does not calculate its microscopic mechanism or lifetime.'),
    ]};
  });
  const render = result.update;let previousTime = 0, disposed = false;const sync = () => render(controller.getState().values);
  result.update = (input = {}) => {controller.update(input);return sync();};
  result.reset = (initial = {}) => {controller.reset(initial);previousTime = 0;return sync();};
  result.advance = seconds => {if (Number.isFinite(seconds) && seconds > 0) controller.advance(seconds);return sync();};
  result.animate = time => {const delta = Number.isFinite(time) ? Math.max(0, time - previousTime) : 0;if (Number.isFinite(time)) previousTime = time;return result.advance(delta);};
  result.replayState = controller.replayState;
  result.playback = {label: 'Write the ink word', description: 'A slowed teaching row scan. Current pigment positions determine the visible result.', stepLabel: 'Advance one quarter row', advance: result.advance, step: () => result.advance(.2), complete: () => result.getState().now.complete, blocked: () => false};
  result.actions = [['Inspect: connected module', 'assembly'], ['Inspect: power and switch', 'power'], ['Inspect: pixel backplane', 'backplane'], ['Inspect: stored word', 'ink'], ['Inspect: selected capsule', 'capsule']].map(([label, part]) => ({label, part, isolate: true, view: 'front', replay: false, run: () => sync()}));
  result.resultPart = {id: 'ink', label: 'Inspect the stored word', view: 'front', focusOnComplete: false, preserveOnReset: true, available: () => true};
  result.covers.push(g.ink, g.common);result.initialCutaway = false;
  result.initialPart = 'assembly';result.initialView = 'front';result.initialIsolated = true;result.frameVisibleOnly = true;result.framePadding = .56;result.selectionOutline = false;result.transparentBackground = true;
  kit.root.updateMatrixWorld(true);
  const assemblyBounds = new THREE.Box3().setFromObject(g.assembly), detailBounds = new THREE.Box3().setFromObject(g.capsule);
  g.capsule.position.add(assemblyBounds.getCenter(new THREE.Vector3()).sub(detailBounds.getCenter(new THREE.Vector3())));
  kit.root.updateMatrixWorld(true);
  const sceneSize = new THREE.Box3().setFromObject(kit.root).getSize(new THREE.Vector3()), size = assemblyBounds.getSize(new THREE.Vector3());
  result.overviewZoom = Math.max(sceneSize.x, sceneSize.y, sceneSize.z) * .7 / (Math.max(size.x, size.y, size.z) * .52);
  result.viewDirections = {front: [.35, .25, 8], iso: [3, 2.8, 6]};
  result.partViewDirections = Object.fromEntries(result.parts.map(part => [part.id, {front: part.id === 'capsule' || part.id === 'ink' ? [0, 0, 6] : [.35, .25, 8]}]));
  for (const part of result.parts) part.framePadding = part.id === 'capsule' ? .51 : part.id === 'assembly' ? .52 : .61;
  result.frameBoundsForPart = id => id === 'capsule' ? new THREE.Box3(new THREE.Vector3(-2, -1.93, -.86), new THREE.Vector3(2, 1.93, .35)).applyMatrix4(g.capsule.matrixWorld) : null;
  result.inspectionObjects = id => id === 'capsule' ? [g.capsule] : [];
  result.thumbnailOmit = [g.capsule];result.catalogParts = result.parts.filter(part => !['system', 'assembly'].includes(part.id));result.topology = g;
  const dispose = result.dispose;result.dispose = () => {if (!disposed) {disposed = true;dispose();}};
  return result;
}

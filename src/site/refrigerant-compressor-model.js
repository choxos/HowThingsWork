import * as THREE from 'three';
import {houseModel, reading as r} from './house-model-kit.js';
import {fixed} from './format.js';
import {surface, lineObject, fillLine, solidArrow} from './scene-kit.js';
import {FRIDGE, piston, cylinderPressure} from './refrigerator-physics.js';
import {sampleCompressor, compressorStageAngle, COMPRESSOR_DEFAULTS as D, COMPRESSOR_DOMAINS, COMPRESSOR_STAGES, swept} from './refrigerant-compressor-physics.js';

const MM = 0.03, TAU = 2 * Math.PI, RATE = 45;
const CRANK_Y = -10, Z = 5;
const point = (V, P) => [(V * 1e6 / 6 * 100 - 50) * MM, (P / 1e5 / 10 * 70 - 30) * MM, 0];

export function createRefrigerantCompressorModel() {
  const kit = houseModel('Refrigerant compressor'), {root, part, covers, control} = kit;
  const textures = [], labels = [];
  const machine = part('system', 'Refrigerant compressor', 'A sealed motor drives a crank, connecting rod and piston. Passive inlet and outlet valves admit vapor at low pressure and deliver it at high pressure. This enlarged cutaway has chosen dimensions, not a particular product.');
  const casing = part('case', 'Sealed shell and supports', 'Motor and pump share a welded enclosure. Look inside removes the shell and the front half of the cylinder. Springs support the mechanism; lubrication and starting electrics are omitted.', [0, 0, 0], machine);
  casing.userData.explosionPieces = true;
  const shell = kit.cylinder(55 * MM, 125 * MM, [0, -5 * MM, 0], 'ink', casing); covers.push(shell);
  kit.cylinder(55 * MM, 3 * MM, [0, -66 * MM, 0], 'ink', casing);
  for (const x of [-43, 43]) kit.box([20 * MM, 4 * MM, 70 * MM], [x * MM, -69.5 * MM, 0], 'metal', casing);
  for (const x of [-26, 26]) for (const z of [-20, 20]) kit.spring([x * MM, -63 * MM, z * MM], 4 * MM, 14 * MM, 4, casing, .7 * MM);
  kit.box([65 * MM, 4 * MM, 58 * MM], [0, -47 * MM, 0], 'metal', casing);
  const motor = part('motor', 'Electric motor and shaft', 'The stator surrounds a rotor on the crankshaft. The chosen operating speed is 2,900 rpm. Animation slows one turn to eight seconds; no magnetic field or startup simulation is included.', [0, CRANK_Y * MM, -18 * MM], machine);
  motor.userData.explosionPieces = true;
  const stator = kit.ring(24 * MM, 5 * MM, [0, 0, -5 * MM], 'clay', motor);
  for (const x of [-22, 22]) kit.box([5 * MM, 18 * MM, 20 * MM], [x * MM, -27 * MM, 0], 'metal', motor);
  const rotor = kit.disk(18 * MM, 17 * MM, [0, 0, -5 * MM], 'metal', motor);
  const shaft = kit.disk(3 * MM, 23 * MM, [0, 0, 7 * MM], 'gold', motor);
  const rotorMark = kit.box([3 * MM, 14 * MM, 2 * MM], [0, 8 * MM, 5 * MM], 'ink', motor);
  rotor.add(rotorMark); rotorMark.position.set(0, 8 * MM, 10 * MM);
  const pump = part('pump', 'Piston pump assembly', 'Inspect the connected crank, rod, piston and pressure-operated valves through one slow turn.', [0, 0, 0], machine);
  const crank = part('crank', 'Crank and eccentric pin', 'The shaft turns this disk. Its pin is 8 mm off center, producing a 16 mm piston stroke.', [0, CRANK_Y * MM, 0], pump);
  kit.disk(12 * MM, 4 * MM, [0, 0, 0], 'gold', crank);
  const pin = kit.disk(2 * MM, 7 * MM, [0, 8 * MM, 3.5 * MM], 'red', crank);
  const rod = part('rod', 'Connecting rod', 'This rigid 30 mm link converts the crank pin’s circular motion into straight piston travel.', [0, 0, 0], pump);
  const link = kit.cylinder(1.8 * MM, 30 * MM, [0, 0, 0], 'metal', rod);
  const pistonPart = part('piston', 'Piston and wrist pin', 'A 20 mm piston travels 16 mm. Swept volume is 5.03 cm³. Clearance leaves a small gap at the top, so the piston never strikes the head.', [0, 0, 0], pump);
  const pistonHead = kit.cylinder(10 * MM, 12 * MM, [0, 0, Z * MM], 'cream', pistonPart);
  const wrist = kit.disk(2 * MM, 22 * MM, [0, 0, Z * MM], 'ink', pistonPart);
  const cylinder = part('cylinder', 'Cylinder and clearance space', 'The fixed cylinder guides the piston. Changing clearance moves the head. Colored gas occupies the changing chamber; color follows ideal pressure. It is not a liquid.', [0, 0, 0], pump);
  const barrel = surface(kit, new THREE.CylinderGeometry(12 * MM, 12 * MM, 32 * MM, 32, 1, true, Math.PI / 2, Math.PI), 'metal', cylinder, true);
  barrel.position.set(0, 21 * MM, Z * MM);
  const barrelFront = surface(kit, new THREE.CylinderGeometry(12 * MM, 12 * MM, 32 * MM, 32, 1, true, -Math.PI / 2, Math.PI), 'metal', cylinder, true);
  barrelFront.position.copy(barrel.position); covers.push(barrelFront);
  const gas = kit.cylinder(9.8 * MM, 1, [0, 0, Z * MM], 'blue', cylinder);
  gas.material = gas.material.clone(); gas.material.transparent = true; gas.material.opacity = .25; gas.material.depthWrite = false;
  gas.raycast = () => {}; gas.userData.explosionExcluded = true;
  const plate = new THREE.Shape(); plate.moveTo(-13.5 * MM, -12.5 * MM); plate.lineTo(13.5 * MM, -12.5 * MM); plate.lineTo(13.5 * MM, 12.5 * MM); plate.lineTo(-13.5 * MM, 12.5 * MM); plate.closePath();
  for (const x of [-6, 6]) { const hole = new THREE.Path(); hole.absarc(x * MM, 0, 2 * MM, 0, TAU, true); plate.holes.push(hole); }
  const head = surface(kit, new THREE.ExtrudeGeometry(plate, {depth: 3 * MM, bevelEnabled: false}), 'gold', cylinder); head.rotation.x = -Math.PI / 2; head.position.z = Z * MM;
  for (const x of [-16, 16]) kit.rod([x * MM, -44 * MM, -12 * MM], [x * MM, 32 * MM, -12 * MM], 2 * MM, 'metal', cylinder);
  const inlet = part('inlet', 'Suction reed valve and inlet', 'Cylinder pressure drops to suction pressure before this one-way valve admits fresh vapor. Blue arrow appears only during intake. The displayed valve lift is enlarged.', [0, 0, 0], pump);
  const outlet = part('outlet', 'Discharge reed valve and outlet', 'Cylinder pressure reaches discharge pressure before this one-way valve lets vapor out. Red arrow appears only during delivery. Both valves close at the end of the turn.', [0, 0, 0], pump);
  function pipe(points, color, parent) {
    const curve = new THREE.CurvePath();
    for (let i = 1; i < points.length; i++) curve.add(new THREE.LineCurve3(new THREE.Vector3(...points[i - 1]).multiplyScalar(MM), new THREE.Vector3(...points[i]).multiplyScalar(MM)));
    return surface(kit, new THREE.TubeGeometry(curve, 64, 2 * MM, 16, false), color, parent, true);
  }
  const inletPipe = pipe([[-55, 7, Z], [-6, 7, Z], [-6, 0, Z]], 'blue', inlet);
  const outletPipe = pipe([[6, 3, Z], [6, 7, Z], [55, 7, Z]], 'red', outlet);
  const suctionValve = kit.box([6 * MM, .2 * MM, 5 * MM], [-6 * MM, 0, Z * MM], 'blue', inlet);
  const dischargeValve = kit.box([6 * MM, .2 * MM, 5 * MM], [6 * MM, 0, Z * MM], 'red', outlet);
  const inletArrow = solidArrow(kit, 0x2f6690, inlet, .8 * MM), outletArrow = solidArrow(kit, 0xc14f39, outlet, .8 * MM);
  for (const arrow of [inletArrow, outletArrow]) { arrow.userData.setDirection(new THREE.Vector3(1, 0, 0)); arrow.userData.explosionExcluded = true; arrow.traverse(o => {o.raycast = () => {};}); }

  const chart = part('indicator', 'Cylinder pressure-volume chart', 'The dot follows the piston. Re-expansion and compression curve between the low-pressure intake and high-pressure delivery lines. Loop area is ideal indicated work per turn, before compression and motor losses.', [0, 0, 0], root);
  chart.userData.inspectionOnly = 'indicator'; chart.userData.explosionExcluded = true;
  function label(text, x, y, width = 55, height = 7) {
    const canvas = typeof document === 'undefined' ? null : document.createElement('canvas');
    let ctx, texture;
    if (canvas) { canvas.width = 768; canvas.height = Math.round(768 * height / width); ctx = canvas.getContext('2d'); texture = new THREE.CanvasTexture(canvas); }
    else texture = new THREE.DataTexture(new Uint8Array([0, 0, 0, 0]), 1, 1);
    texture.colorSpace = THREE.SRGBColorSpace; textures.push(texture);
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(width * MM, height * MM), new THREE.MeshBasicMaterial({map: texture, transparent: true, depthWrite: false, side: THREE.DoubleSide}));
    mesh.position.set(x * MM, y * MM, .02); chart.add(mesh); labels.push(mesh);
    mesh.userData.setText = value => { if (mesh.userData.labelText === value) return; mesh.userData.labelText = value; if (ctx) { ctx.clearRect(0, 0, canvas.width, canvas.height); ctx.font = `${canvas.height * .8}px sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = '#394233'; ctx.fillText(value, canvas.width / 2, canvas.height / 2, canvas.width); } texture.needsUpdate = true; };
    mesh.userData.setText(text); return mesh;
  }
  for (const pair of [[[0, 0], [6e-6, 0]], [[0, 0], [0, 1e6]]]) kit.rod(point(...pair[0]), point(...pair[1]), .35 * MM, 'ink', chart);
  for (let V = 0; V <= 6; V += 2) label(String(V), V / 6 * 100 - 50, -37, 10, 5);
  for (let P = 0; P <= 10; P += 2) label(String(P), -57, P / 10 * 70 - 30, 10, 5);
  label('Cylinder volume (cm³)', 0, -46, 90, 7);
  label('Absolute pressure (bar)', 0, 57, 115, 7);
  const stageLabel = label('', 0, 47, 120, 7);
  label('Ideal loop; losses counted separately', 0, -56, 130, 6);
  const pvLines = COMPRESSOR_STAGES.map((_, i) => lineObject(361, [0xae8056, 0x2f6690, 0xe3b45e, 0xc14f39][i], chart));
  const dot = kit.sphere(1.2 * MM, [0, 0, .04], 'ink', chart);
  const chartKey = {value: ''};
  const specs = {
    angle: ['Starting crank angle', '°', 'Move to any point in a turn. Play continues from here to 360°; Step advances 15°.'],
    evaporating: ['Evaporator boiling point', '°C', 'Sets suction pressure through the same illustrative fluid as the refrigerator. Lower temperature means lower pressure.'],
    condensing: ['Condenser condensing point', '°C', 'Sets discharge pressure. A hotter condenser asks the pump to compress more.'],
    clearance: ['Clearance', '%', 'Gap volume at the top as a percentage of swept volume. A larger gap traps more gas and reduces fresh intake.'],
  };
  for (const key of ['angle', 'evaporating', 'condensing', 'clearance']) { const [name, unit, help] = specs[key]; control(key, name, ...COMPRESSOR_DOMAINS[key], D[key], unit, help); }
  let advance = 0, lastClock = 0, physicalKey = '', disposed = false;
  const result = kit.finish(values => {
    const key = JSON.stringify(values); if (key !== physicalKey) { advance = lastClock = 0; physicalKey = key; }
    const s = sampleCompressor(values, advance), c = s.cycle, theta = s.theta;
    const pinPos = new THREE.Vector3(8 * Math.sin(theta), CRANK_Y + 8 * Math.cos(theta), Z).multiplyScalar(MM);
    const wristY = CRANK_Y + 38 - s.drop * 1000, headY = CRANK_Y + 38 + 6 + values.clearance / 100 * 16;
    crank.rotation.z = -theta; rotor.rotation.z = -theta;
    const wristPos = new THREE.Vector3(0, wristY, Z).multiplyScalar(MM);
    link.position.copy(pinPos).add(wristPos).multiplyScalar(.5); link.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), wristPos.clone().sub(pinPos).normalize());
    pistonHead.position.y = wrist.position.y = wristY * MM;
    head.position.y = headY * MM;
    const gasHeight = headY - (wristY + 6); gas.scale.y = gasHeight * MM; gas.position.y = (headY - gasHeight / 2) * MM;
    gas.material.color.set(0x83b4c1).lerp(new THREE.Color(0xc14f39), (s.pressure - c.Pe) / (c.Pc - c.Pe));
    for (const pipe of [inletPipe, outletPipe]) pipe.position.y = headY * MM;
    suctionValve.position.y = (headY - .1 - (s.suctionOpen ? Math.min(1.2, (gasHeight - .2) * .7) : 0)) * MM;
    dischargeValve.position.y = (headY + 3.1 + (s.dischargeOpen ? 1.2 : 0)) * MM;
    inletArrow.position.set(-42 * MM, (headY + 14) * MM, Z * MM); outletArrow.position.set(22 * MM, (headY + 14) * MM, Z * MM);
    inletArrow.userData.setLength(s.suctionOpen ? 20 * MM : 0); outletArrow.userData.setLength(s.dischargeOpen ? 20 * MM : 0);
    const graphKey = `${values.evaporating}:${values.condensing}:${values.clearance}`;
    if (chartKey.value !== graphKey) {
      chartKey.value = graphKey; const byStage = [[], [], [], []];
      for (let angle = 0; angle <= 360; angle++) { const p = sampleCompressor({...values, angle}); const pos = point(p.volume, p.pressure); if (angle && p.stage !== sampleCompressor({...values, angle: angle - 1}).stage) byStage[p.stage].push(point(piston((angle - 1) * Math.PI / 180, c.clearance).volume, cylinderPressure(c, (angle - 1) * Math.PI / 180))); byStage[p.stage].push(pos); }
      pvLines.forEach((line, i) => fillLine(line, byStage[i]));
    }
    dot.position.set(...point(s.volume, s.pressure)); dot.position.z = .04;
    stageLabel.userData.setText(`${s.stageName} · ${fixed(s.angle, 0)}°`);
    return {state: s, readings: [
      r('Your result', s.complete ? 'One turn complete · replay to pump again' : `${s.stageName} · ${fixed(s.angle, 0)}°`, s.complete ? 'Both valves are closed. Residual vapor remains in the clearance for the next turn.' : ['Trapped gas expands; both valves closed.', 'Fresh vapor enters through the blue valve.', 'Both valves close while pressure rises.', 'Hot vapor leaves through the red valve.'][s.stage]),
      r('Cylinder pressure', `${fixed(s.pressure / 1e5, 2)} bar`, `Absolute pressure. Suction ${fixed(c.Pe / 1e5, 2)}, discharge ${fixed(c.Pc / 1e5, 2)} bar; ratio ${fixed(c.ratio, 2)}.`),
      r('Cylinder volume', `${fixed(s.volume * 1e6, 3)} cm³`, `Clearance ${fixed(s.indicator.Vc * 1e6, 3)} cm³; swept ${fixed(swept() * 1e6, 2)} cm³.`),
      r('Valves', `${s.suctionOpen ? 'Inlet open' : 'Inlet closed'} · ${s.dischargeOpen ? 'outlet open' : 'outlet closed'}`, 'Ideal valves open at equal boundary pressure, with zero pressure drop. Lift is enlarged.'),
      r('Fresh intake per turn', `${fixed(s.freshVolume * 1e6, 3)} cm³ · ${fixed(c.volumetric * 100, 1)}%`, `Re-expansion uses ${fixed(s.lostVolume * 1e6, 3)} cm³ of swept volume before fresh vapor enters.`),
      r('Mass pumped per turn', `${fixed(s.mass * 1e6, 2)} mg`, `At the chosen 2,900 rpm: ${fixed(c.flow * 1000, 3)} g/s. Drawing runs much slower.`),
      r('Ideal work per turn', `${fixed(s.idealWork, 3)} J`, `Pressure-volume loop area. With 60% compression efficiency and 80% motor efficiency: ${fixed(c.shaft, 1)} W shaft, ${fixed(c.electric, 1)} W electrical.`),
      r('Vapor temperature', `${fixed(c.suction, 1)} °C in · ${fixed(c.discharge, 1)} °C out`, 'Cycle-average outlet estimate includes compression losses; ideal cylinder loop omits them.'),
    ]};
  });
  const render = result.update;
  result.advance = dt => { if (Number.isFinite(dt) && dt > 0) advance = Math.min(360, advance + RATE * dt); return render(); };
  result.animate = t => { const dt = Number.isFinite(t) ? Math.max(0, t - lastClock) : 0; if (Number.isFinite(t)) lastClock = t; return result.advance(dt); };
  result.reset = () => { advance = lastClock = 0; physicalKey = ''; return render(result.defaults); };
  result.actions = COMPRESSOR_STAGES.map((name, stage) => ({label: `Inspect: ${name.toLowerCase()}`, part: 'pump', view: 'front', replay: false, run() { return render({angle: compressorStageAngle(stage, result.getState().values)}); }}));
  result.actions.push({label: 'Inspect: pressure-volume chart', part: 'indicator', isolate: true, view: 'front', replay: false, run: () => render()});
  result.playback = {label: 'Run to end of turn', description: 'One turn takes eight seconds on screen. The chosen operating speed is 2,900 rpm. Boundary temperatures stay fixed; this close-up does not simulate thermostat cycling.', stepLabel: 'Advance 15 degrees', advance: result.advance, step: () => result.advance(15 / RATE), complete: () => result.getState().complete, blocked: () => false};
  result.initialPart = 'system'; result.initialView = 'front'; result.frameVisibleOnly = true; result.framePadding = .72; result.selectionOutline = false; result.transparentBackground = true;
  result.frameBoundsForPart = id => { root.updateWorldMatrix(true, false); if (id === 'pump') { const bounds = new THREE.Box3(); for (const object of [crank, rod, pistonPart, cylinder]) bounds.union(new THREE.Box3().setFromObject(object)); return bounds; } return id === 'indicator' ? new THREE.Box3().setFromObject(chart) : id === 'system' ? new THREE.Box3().setFromObject(machine) : null; };
  result.thumbnailOmit = [chart];
  result.topology = {machine, casing, shell, motor, stator, rotor, shaft, rotorMark, pump, crank, pin, rod, link, pistonPart, pistonHead, wrist, cylinder, barrel, barrelFront, gas, head, inlet, outlet, inletPipe, outletPipe, suctionValve, dischargeValve, inletArrow, outletArrow, chart, pvLines, dot, labels, textures, MM, CRANK_Y, Z, point};
  const dispose = result.dispose; result.dispose = () => { if (disposed) return; disposed = true; textures.forEach(t => t.dispose()); dispose(); };
  return result;
}

import * as THREE from 'three';
import {houseModel, reading as r} from './house-model-kit.js';
import {fixed} from './format.js';
import {clamp} from './physics-kit.js';
import {chartText, fillLine, lineObject, segmentLines, solidArrow, textLabel} from './scene-kit.js';
import {wireColor} from './element-scene.js';
import {
  kettlePlan, kettleAt, resistanceAt, KETTLE_DEFAULTS, KETTLE_DOMAINS, KETTLE_WIRE, FILLED,
  KETTLE_WATER as WATER, KETTLE_THERMAL as THERMAL, DECLARED,
} from './element-physics.js';

export const MM = 0.006;
export const FASTER = 10;
export const KETTLE = Object.freeze({
  origin: Object.freeze([-0.32, 0.20, 0]), innerRadius: 70, outerRadius: 74, height: 150, floor: -75,
  coilRadius: 44, tubeRadius: 4, coilY: -69, arcStart: Math.PI / 8, arc: 7 * Math.PI / 4, helixRadius: 2.2,
});
export const CHART = Object.freeze({x: -0.91, y: -1.12, w: 1.75, h: 0.47, temperature: Object.freeze([0, 400])});
export const COLORS = Object.freeze({shell: 0xe9e4d8, edge: 0x374736, metal: 0xa8b9b3, water: 0x5b9bbb, hot: 0xd88452, wire: 0xd46737, insulation: 0xe4c88a, steam: 0x94b9c8, live: 0xb96048, neutral: 0x587fa1});
export const chartX = (plan, time) => CHART.x + clamp(time / plan.duration) * CHART.w;
export const chartY = celsius => CHART.y + clamp(celsius / CHART.temperature[1]) * CHART.h;
export const waterDepth = mass => (mass * 1e9 / WATER.density + Math.PI * KETTLE.tubeRadius ** 2 * KETTLE.coilRadius * KETTLE.arc) / (Math.PI * KETTLE.innerRadius ** 2);
export const waterColor = temperature => new THREE.Color(COLORS.water).lerp(new THREE.Color(COLORS.hot), clamp((temperature - 5) / 95));

export class KettleSheathPath extends THREE.Curve {
  constructor(from = 0, to = 1) { super(); this.from = from; this.to = to; }
  getPoint(t, target = new THREE.Vector3()) {
    const angle = KETTLE.arcStart + (this.from + (this.to - this.from) * t) * KETTLE.arc;
    return target.set(KETTLE.coilRadius * Math.cos(angle) * MM, KETTLE.coilY * MM, KETTLE.coilRadius * Math.sin(angle) * MM);
  }
}

/** The wire winds inside the tubular sheath; solve its turns from its specified centerline length. */
export class KettleWirePath extends THREE.Curve {
  constructor() {
    super();
    let lo = 1, hi = 500;
    for (let step = 0; step < 40; step++) {
      const n = (lo + hi) / 2;
      let length = 0;
      for (let i = 0; i < 4096; i++) {
        const radius = KETTLE.coilRadius + KETTLE.helixRadius * Math.cos(2 * Math.PI * n * (i + 0.5) / 4096);
        length += Math.hypot(KETTLE.arc * radius, 2 * Math.PI * n * KETTLE.helixRadius) / 4096;
      }
      if (length < KETTLE_WIRE.length * 1000) lo = n; else hi = n;
    }
    this.turns = (lo + hi) / 2;
  }
  getPoint(t, target = new THREE.Vector3()) {
    const angle = KETTLE.arcStart + t * KETTLE.arc, phase = 2 * Math.PI * this.turns * t;
    const radius = KETTLE.coilRadius + KETTLE.helixRadius * Math.cos(phase);
    return target.set(radius * Math.cos(angle) * MM, (KETTLE.coilY + KETTLE.helixRadius * Math.sin(phase)) * MM, radius * Math.sin(angle) * MM);
  }
}

export function createElectricKettleModel() {
  const kit = houseModel('Electric kettle'), {part, box, cylinder, sphere, rod, tube, control, finish} = kit;
  let clock = 0, lastClock = 0, disposed = false;
  const system = part('system', 'Electric kettle, cut open', 'Follow current through the insulated wire, heat into the water, and boiling vapor to the steam switch. The separate dry protector watches the sheath. Press Play to close the circuit. Dimensions and sensor timings are illustrative.');
  const body = part('body', 'Body, spout and handle', 'A cylindrical vessel holds water above the tubular element. The front is cut away. A spout remains open to the atmosphere; a separate duct guides some vapor toward the switch. The handle keeps a hand away from the hot vessel.', KETTLE.origin, system);
  const material = (color, opacity = 1) => new THREE.MeshStandardMaterial({color, roughness: 0.55, side: THREE.DoubleSide, transparent: opacity < 1, opacity, depthWrite: opacity === 1});
  const addMesh = (geometry, mat, parent) => { const mesh = new THREE.Mesh(geometry, mat); parent.add(mesh); return mesh; };
  const wallGeometry = radius => {
    const geometry = new THREE.CylinderGeometry(radius * MM, radius * MM, 150 * MM, 64, 30, true, Math.PI / 3, 4 * Math.PI / 3);
    const positions = geometry.attributes.position, original = geometry.index.array, indices = [];
    for (let i = 0; i < original.length; i += 3) {
      const ids = [original[i], original[i + 1], original[i + 2]];
      const center = ids.reduce((sum, id) => sum.add(new THREE.Vector3().fromBufferAttribute(positions, id)), new THREE.Vector3()).multiplyScalar(1 / 3 / MM);
      const spoutOpening = center.x < -60 && Math.abs(center.z) < 13 && center.y > 17 && center.y < 47;
      const ductOpening = center.x > 60 && Math.abs(center.z) < 5 && center.y > 61 && center.y < 71;
      if (!spoutOpening && !ductOpening) indices.push(...ids);
    }
    geometry.setIndex(indices); return geometry;
  };
  const shell = addMesh(wallGeometry(74), material(COLORS.shell), body);
  const innerWall = addMesh(wallGeometry(70), material(0xd1d6cb), body);
  const base = cylinder(74 * MM, 6 * MM, [0, -78 * MM, 0], COLORS.edge, body);
  const lid = addMesh(new THREE.CylinderGeometry(74 * MM, 74 * MM, 4 * MM, 64, 1, false, Math.PI / 3, 4 * Math.PI / 3), material(COLORS.metal), body); lid.position.y = 77 * MM;
  const cutEdges = [-1, 1].map(sign => box([4 * MM, 150 * MM, 4 * MM], [sign * 72 * Math.sin(Math.PI / 3) * MM, 0, 36 * MM], COLORS.metal, body));
  const handle = tube([[70, 55, -8], [115, 55, -8], [127, 5, -8], [103, -50, -8], [70, -50, -8]].map(p => p.map(n => n * MM)), 8 * MM, COLORS.edge, body);
  const spoutCurve = new THREE.CatmullRomCurve3([[-65, 30, 0], [-85, 43, 0], [-105, 75, 0]].map(p => new THREE.Vector3(...p.map(n => n * MM))));
  const spout = addMesh(new THREE.TubeGeometry(spoutCurve, 24, 13 * MM, 24, false), material(COLORS.metal), body);
  for (const x of [-48, 48]) box([26 * MM, 6 * MM, 70 * MM], [x * MM, -84 * MM, 0], COLORS.edge, body);

  const water = part('water', 'The water', 'The water level comes from remaining liquid mass, a 140 mm internal diameter, and displacement by the main tube. Spout liquid and small fittings are omitted from that volume calculation. Color tracks temperature; the well-mixed water receives heat through the metal sheath.', KETTLE.origin, system);
  const pool = addMesh(new THREE.CylinderGeometry(70 * MM, 70 * MM, 1, 64, 1, true), material(COLORS.water, 0.23), water);
  const surface = addMesh(new THREE.CircleGeometry(70 * MM, 64), material(COLORS.water, 0.25), water); surface.rotation.x = -Math.PI / 2;
  const waterWord = textLabel(water, '', {height: 0.055, width: 0.62, position: [-0.03, 0.22, 0.46]});
  const circulation = [-1, 1].map(sign => {
    const arrow = solidArrow(kit, COLORS.water, water, 0.008); arrow.position.set(sign * 28 * MM, 0, 12 * MM); arrow.userData.setDirection(new THREE.Vector3(0, sign, 0)); return arrow;
  });

  const element = part('element', 'Heating element', 'A coiled resistance wire sits inside electrically insulating material and a metal sheath. Heat crosses the insulation into the sheath and then into water. The core is hotter than the sheath. The exposed window and separate close-up reveal this hidden construction.', KETTLE.origin, system);
  const sheathPath = new KettleSheathPath(), wirePath = new KettleWirePath();
  const sheath = [[0, 0.12], [0.31, 1]].map(([a, b]) => addMesh(new THREE.TubeGeometry(new KettleSheathPath(a, b), 90, 4 * MM, 12, false), material(COLORS.metal), element));
  const insulationWindow = addMesh(new THREE.TubeGeometry(new KettleSheathPath(0.12, 0.31), 32, 3.3 * MM, 12, false), material(COLORS.insulation, 0.25), element);
  const coil = addMesh(new THREE.TubeGeometry(wirePath, Math.ceil(wirePath.turns * 20), KETTLE_WIRE.diameter * 1000 * MM / 2, 5, false), material(COLORS.wire), element);
  const endpoints = [wirePath.getPoint(0), wirePath.getPoint(1)];
  const feedthroughs = endpoints.map(point => {
    const mesh = rod(point.toArray(), [point.x, -84 * MM, point.z], 4 * MM, COLORS.insulation, element);
    rod(point.toArray(), [point.x, -84 * MM, point.z], 0.0025, COLORS.wire, element); return mesh;
  });

  const insulation = part('insulation', 'Insulation close-up', 'A short section, magnified five times: the coiled conducting wire is inside an electrical insulator, which is inside a metal sheath. The water touches the sheath, not the live wire. These layers conduct heat while keeping the intended current path separate from the water.', [0.80, 0.28, 0], system);
  const closeupSheath = addMesh(new THREE.CylinderGeometry(0.12, 0.12, 0.35, 32, 1, true, Math.PI / 2, Math.PI), material(COLORS.metal), insulation); closeupSheath.rotation.z = Math.PI / 2;
  const closeupInsulator = addMesh(new THREE.CylinderGeometry(0.099, 0.099, 0.35, 32, 1, true, Math.PI / 2, Math.PI), material(COLORS.insulation), insulation); closeupInsulator.rotation.z = Math.PI / 2;
  const insetTurns = 0.32 / (KETTLE.coilRadius * KETTLE.arc / wirePath.turns * MM * 5), insetSamples = Math.ceil(insetTurns * 24);
  const insetPoints = Array.from({length: insetSamples + 1}, (_, i) => { const phase = i / insetSamples * insetTurns * 2 * Math.PI; return new THREE.Vector3(-0.16 + 0.32 * i / insetSamples, 0.066 * Math.sin(phase), 0.066 * Math.cos(phase)); });
  const closeupWire = addMesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(insetPoints), insetSamples, 0.00825, 8, false), material(COLORS.wire), insulation);
  textLabel(insulation, 'Inside the tube · 5×, straightened', {height: 0.042, width: 0.68, position: [0, 0.24, 0.08]});
  const coreWord = textLabel(insulation, '', {height: 0.046, width: 0.54, position: [0, -0.22, 0.08], color: '#ae512f'});
  const sheathWord = textLabel(insulation, '', {height: 0.046, width: 0.54, position: [0, -0.30, 0.08]});
  textLabel(insulation, 'Pale layer: electrical insulator', {height: 0.038, width: 0.64, position: [0, 0.15, 0.08]});

  const steamSwitch = part('switch', 'Steam switch', 'Boiling vapor travels through the duct and warms a bimetal disc. Bonded metals expand differently, causing the disc to snap and release the switch. The contacts open and stay open for this run. The illustrated sensor trips at 85 °C; this is a teaching choice, not a product specification.', KETTLE.origin, system);
  const switchPivot = new THREE.Group(); switchPivot.position.set(90 * MM, 18 * MM, 14 * MM); steamSwitch.add(switchPivot);
  const switchBlade = rod([0, 0, 0], [18 * MM, 0, 0], 0.007, COLORS.insulation, switchPivot);
  const switchContacts = [90, 108].map(x => sphere(0.008, [x * MM, 18 * MM, 14 * MM], COLORS.live, steamSwitch));
  const disc = new THREE.Group(); disc.position.set(95 * MM, 34 * MM, 14 * MM); steamSwitch.add(disc);
  const discLayers = [COLORS.insulation, COLORS.neutral].map((color, i) => { const mesh = addMesh(new THREE.SphereGeometry(9 * MM, 24, 8, 0, Math.PI * 2, 0, Math.PI / 2), material(color), disc); mesh.scale.y = 0.15; mesh.position.y = -i * 0.002; return mesh; });
  const releaseLink = rod([95 * MM, 34 * MM, 14 * MM], [95 * MM, 22 * MM, 14 * MM], 0.004, COLORS.edge, steamSwitch);
  const switchWord = textLabel(steamSwitch, '', {height: 0.045, width: 0.51, position: [110 * MM, 97 * MM, 30 * MM]});

  const protector = part('protector', 'Dry protector', 'A separate temperature-sensitive protector is thermally connected to the sheath. With no water to take heat away, it opens the series circuit at a declared sheath temperature of 220 °C. It latches open in this model; real protection arrangements vary. Use this on-screen experiment only.', KETTLE.origin, system);
  const dryPivot = new THREE.Group(); dryPivot.position.set(30 * MM, -96 * MM, 12 * MM); protector.add(dryPivot);
  const dryBlade = rod([0, 0, 0], [18 * MM, 0, 0], 0.007, COLORS.insulation, dryPivot);
  const dryContacts = [30, 48].map(x => sphere(0.008, [x * MM, -96 * MM, 12 * MM], COLORS.live, protector));
  const sensorPad = box([14 * MM, 5 * MM, 16 * MM], [40 * MM, -87 * MM, 0], COLORS.insulation, protector);
  const thermalLink = rod(sheathPath.getPoint(1).toArray(), [40 * MM, -87 * MM, 0], 0.009, COLORS.metal, protector);
  const protectorWord = textLabel(protector, '', {height: 0.043, width: 0.57, position: [41 * MM, -114 * MM, 20 * MM]});

  const steam = part('steam', 'Steam path', 'Dots trace boiling vapor through the headspace and duct to the disc. They are a visible cue for invisible vapor, not droplets or a measured flow field. Only vigorous boiling is shown: evaporation below boiling is omitted. The open spout also allows vapor to escape.', KETTLE.origin, system);
  const ductPoints = [[28, 66, 0], [73, 66, 0], [89, 52, 5], [95, 37, 14]].map(p => new THREE.Vector3(...p.map(n => n * MM)));
  const duct = addMesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(ductPoints), 36, 4 * MM, 10, false), material(COLORS.metal, 0.28), steam);
  const vaporPath = new THREE.CatmullRomCurve3([new THREE.Vector3(10 * MM, 0, 0), ...ductPoints]);
  const vaporDots = Array.from({length: 9}, () => sphere(0.012, [0, 0, 0], COLORS.steam, steam));
  const bubbles = Array.from({length: 5}, () => sphere(0.009, [0, 0, 0], 0xe8eeee, steam));

  const circuit = part('circuit', 'Supply and current path', 'The supply, steam-switch contacts, dry-protector contacts, resistance wire and return lead form one series circuit. Play closes the steam switch. Pause freezes simulated time; Reset or a changed setting starts a new trial. Wires are a simplified circuit layout, not installation guidance.', KETTLE.origin, system);
  const supply = cylinder(11 * MM, 5 * MM, [-97 * MM, -98 * MM, 12 * MM], COLORS.neutral, circuit); supply.rotation.x = Math.PI / 2;
  textLabel(circuit, '~', {height: 0.057, position: [-97 * MM, -98 * MM, 16 * MM], color: '#ffffff'});
  const paths = [
    {color: COLORS.live, points: [[-97, -87, 12], [-97, -82, 12], [80, -82, 12], [80, 18, 14], [90, 18, 14]]},
    {color: COLORS.live, points: [[108, 18, 14], [115, 18, 14], [115, -101, 12], [24, -101, 12], [24, -96, 12], [30, -96, 12]]},
    {color: COLORS.live, points: [[48, -96, 12], [55, -96, 12], [55, -84, 12], [endpoints[0].x / MM, -84, endpoints[0].z / MM]]},
    {color: COLORS.neutral, points: [[endpoints[1].x / MM, -84, endpoints[1].z / MM], [5, -89, -20], [-110, -89, -20], [-110, -109, 12], [-97, -109, 12]]},
  ];
  const leads = paths.flatMap(({color, points}) => points.slice(1).map((point, i) => rod(points[i].map(n => n * MM), point.map(n => n * MM), 0.004, color, circuit)));
  const currentWord = textLabel(circuit, '', {height: 0.043, width: 0.51, position: [-82 * MM, -120 * MM, 18 * MM]});

  const chartPart = part('chart', 'The run', 'Only elapsed temperatures are plotted. Blue: water. Gold: sheath. Orange: internal wire. The 100 °C line marks boiling at one atmosphere; the separate dry protector responds to sheath temperature.', [0, 0, 0], system);
  const chartFrame = lineObject(5, COLORS.edge, chartPart);
  fillLine(chartFrame, [[CHART.x, CHART.y, 0], [CHART.x + CHART.w, CHART.y, 0], [CHART.x + CHART.w, CHART.y + CHART.h, 0], [CHART.x, CHART.y + CHART.h, 0], [CHART.x, CHART.y, 0]]);
  const curves = ['water', 'sheath', 'celsius'].map((key, i) => ({key, line: lineObject(DECLARED.samples + 2, [COLORS.water, COLORS.insulation, COLORS.wire][i], chartPart)}));
  const boilLine = segmentLines(1, 0x9e9a90, chartPart); fillLine(boilLine, [[CHART.x, chartY(100), 0], [CHART.x + CHART.w, chartY(100), 0]]);
  chartText(chartPart, (share, temperature) => [CHART.x + share * CHART.w, chartY(temperature), 0], {size: 0.038, x: {min: 0, max: 1, title: 'Simulated seconds', ticks: [[0, '0']]}, y: {min: 0, max: 400, ticks: [0, 100, 220, 400].map(t => [t, `${t} °C`])}});
  const endWord = textLabel(chartPart, '', {height: 0.038, width: 0.19, position: [CHART.x + CHART.w, CHART.y - 0.04, 0]});
  textLabel(chartPart, 'Water · sheath · internal wire', {height: 0.045, position: [CHART.x + CHART.w / 2, CHART.y + CHART.h + 0.07, 0]});

  const apparatus = new THREE.Group(); system.add(apparatus);
  for (const object of [body, water, element, insulation, steamSwitch, protector, steam, circuit]) apparatus.add(object);
  apparatus.rotation.set(0.08, -0.24, 0);
  const d = KETTLE_DEFAULTS, D = KETTLE_DOMAINS;
  control('volts', 'Supply voltage', ...D.volts, d.volts, 'V', 'Effective AC voltage across this same element when the circuit closes. Power is V²/R. Changing a setting starts a fresh trial.');
  control('mass', 'Water poured in', ...D.mass, d.mass, 'kg', 'More water raises the level and needs more energy to reach boiling. Ignored in the empty-model experiment.');
  control('start', 'Starting temperature', ...D.start, d.start, '°C', 'Initial water and immersed-element temperature. The room and steam sensor begin at 20 °C. Ignored when the model is empty.');
  control('filled', 'What is in it', ...D.filled, d.filled, '', 'Compare a filled model with a dry-protection demonstration on screen. Do not run a real kettle empty.', FILLED);

  const result = finish(values => {
    const plan = kettlePlan(values), now = kettleAt(plan, clock), depth = plan.wet ? waterDepth(now.liquidMass) : 0;
    const top = (KETTLE.floor + depth) * MM;
    pool.visible = surface.visible = plan.wet; pool.scale.y = depth * MM; pool.position.y = (KETTLE.floor + depth / 2) * MM; surface.position.y = top;
    pool.material.color.copy(waterColor(now.water)); surface.material.color.copy(waterColor(now.water));
    waterWord.userData.setText(plan.wet ? `${fixed(now.water, 1)} °C · ${fixed(now.liquidMass, 3)} kg` : 'Empty model');
    waterWord.position.y = plan.wet ? top + 0.07 : -0.12;
    coil.material.color.copy(wireColor(now.celsius)); closeupWire.material.color.copy(wireColor(now.celsius));
    coreWord.userData.setText(`Wire ${fixed(now.celsius, 0)} °C`); sheathWord.userData.setText(`Sheath ${fixed(now.sheath, 0)} °C`);
    const steamClosed = clock > 0 && !now.switched;
    switchPivot.rotation.z = steamClosed ? 0 : Math.PI / 5; dryPivot.rotation.z = now.tripped ? Math.PI / 5 : 0;
    discLayers.forEach(layer => { layer.scale.y = now.switched ? -0.15 : 0.15; });
    const discTip = new THREE.Vector3(95 * MM, (34 + (now.switched ? -1.35 : 1.35)) * MM, 14 * MM);
    const bladeTip = new THREE.Vector3((90 + 5 * Math.cos(switchPivot.rotation.z)) * MM, (18 + 5 * Math.sin(switchPivot.rotation.z)) * MM, 14 * MM);
    releaseLink.position.copy(discTip).add(bladeTip).multiplyScalar(0.5);
    releaseLink.scale.y = discTip.distanceTo(bladeTip) / releaseLink.geometry.parameters.height;
    releaseLink.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), bladeTip.sub(discTip).normalize());
    switchWord.userData.setText(`Disc ${fixed(now.sensor, 0)} °C · ${steamClosed ? 'closed' : 'open'}`);
    protectorWord.userData.setText(now.tripped ? 'Dry protector open' : 'Dry protector closed');
    currentWord.userData.setText(`${fixed(now.current, 2)} A · ${now.on ? 'closed circuit' : 'open circuit'}`);
    vaporPath.points[0].y = top + 0.006;
    vaporDots.forEach((dot, i) => {
      const offset = i * THERMAL.steamDelay / vaporDots.length;
      const born = plan.firstBoil === null ? Infinity : plan.firstBoil + offset + Math.floor((clock - plan.firstBoil - offset) / THERMAL.steamDelay) * THERMAL.steamDelay;
      const age = clock - born;
      dot.visible = plan.wet && plan.firstBoil !== null && born >= plan.firstBoil && age >= 0 && age < THERMAL.steamDelay && kettleAt(plan, Math.max(0, born + 0.0001)).vaporRate > 1e-9;
      if (dot.visible) dot.position.copy(vaporPath.getPoint(age / THERMAL.steamDelay));
    });
    bubbles.forEach((bubble, i) => {
      bubble.visible = now.boiling;
      const fraction = (clock * 0.7 + i / bubbles.length) % 1;
      bubble.position.set((-22 + i * 10) * MM, (KETTLE.coilY + 5) * MM + fraction * Math.max(0, top - (KETTLE.coilY + 5) * MM), (i % 2 ? 12 : -12) * MM);
    });
    circulation.forEach((arrow, i) => {
      const low = (KETTLE.coilY + 6) * MM, high = top - 4 * MM;
      arrow.position.y = i ? low : high; arrow.userData.setLength(Math.max(0, high - low));
      arrow.visible = plan.wet && high > low && now.sheath > now.water + 0.01;
    });
    for (const {key, line} of curves) {
      const shown = plan.chart.filter(sample => sample.t < now.t);
      fillLine(line, clock > 0 && (key !== 'water' || plan.wet) ? [...shown.map(sample => [chartX(plan, sample.t), chartY(sample[key]), 0.003]), [chartX(plan, now.t), chartY(now[key]), 0.003]] : []);
    }
    endWord.userData.setText(fixed(plan.duration, 0));
    const status = values.volts === 0 ? 'No supply · choose a voltage above zero to run'
      : clock === 0 ? `Ready · circuit open; ${plan.wet ? `${fixed(values.mass, 1)} kg of water at ${fixed(values.start, 0)} °C` : 'empty model at 20 °C'}. Press Play`
      : now.tripped ? `Dry protector opened at ${fixed(plan.tripped, 2)} s · current stopped; stored heat is cooling`
      : now.switched ? `Steam switch opened at ${fixed(plan.switched, 1)} s · water first boiled at ${fixed(plan.firstBoil, 1)} s`
      : now.done ? `Run ended at ${fixed(now.t, 0)} s · ${plan.wet ? `water reached ${fixed(now.water, 1)} °C` : `sheath reached ${fixed(now.sheath, 1)} °C`}; no shutoff occurred`
      : now.boiling ? `Boiling · vapor is traveling to the disc, now ${fixed(now.sensor, 1)} °C`
      : plan.wet ? `Heating · ${fixed(now.t, 1)} s elapsed; water ${fixed(now.water, 1)} °C` : `Dry model heating · sheath ${fixed(now.sheath, 1)} °C`;
    return {state: {...plan, now, clock, waterDepth: depth}, readings: [
      r('Your result', status),
      r('Water temperature', plan.wet ? `${fixed(now.water, 1)} °C` : 'No water', 'The water is treated as well mixed. Boiling is fixed at 100 °C at one atmosphere. The starting-temperature control does not change the room.'),
      r('Circuit and power', `${now.on ? 'Closed' : 'Open'} · ${fixed(now.power, 0)} W`, `${fixed(now.current, 2)} A through ${fixed(resistanceAt(plan.wire, now.celsius), 2)} Ω. Either open contact pair breaks the series circuit.`),
      r('Wire and sheath', `${fixed(now.celsius, 0)} °C / ${fixed(now.sheath, 0)} °C`, 'The inner wire is hotter than the water-facing sheath. Both store heat and cool continuously after power stops.'),
      r('Steam sensor', `${fixed(now.sensor, 1)} °C · ${now.switched ? 'tripped' : 'waiting'}`, 'A declared 2 s vapor-transport delay and finite sensor heat capacity precede the 85 °C snap threshold. The disc responds to heating, not a preset run time.'),
      r('Dry protector', now.tripped ? 'Open, latched' : 'Closed', 'The separate protector senses sheath temperature and opens at 220 °C in this model. No steam is needed. This is an on-screen demonstration, not a real-appliance test.'),
      r('Boiling vapor produced', `${fixed(now.boiled * 1000, 2)} g`, 'Each kilogram of boiling vapor needs 2,256 kJ of latent heat. A bounded share heats the steam sensor. Preboiling evaporation is omitted; visible dots are a cue for invisible vapor.'),
      r('Energy supplied', `${fixed(now.inputEnergy / 1000, 2)} kJ`, `${fixed(now.waterEnergy / 1000, 2)} kJ net to water and vapor; ${fixed((now.storedEnergy + now.sheathEnergy) / 1000, 2)} kJ stored in the element; ${fixed(now.roomEnergy / 1000, 2)} kJ net to the room.`),
      r('Water level and playback', plan.wet ? `${fixed(depth, 1)} mm · ${FASTER}× time` : `Empty · ${FASTER}× time`, 'Level accounts for the cylindrical reservoir and main tube displacement. Geometry, convection arrows and thermal coefficients are illustrative. Pause freezes time; a setting change starts a new trial.'),
    ]};
  });
  const render = result.update, duration = () => result.getState().duration;
  result.update = next => {
    const before = result.getState().values, readings = render(next);
    if (Object.keys(before).some(key => result.getState().values[key] !== before[key])) { clock = 0; lastClock = 0; return render(); }
    return readings;
  };
  result.advance = dt => {
    if (Number.isFinite(dt) && dt > 0 && result.getState().values.volts > 0) { const next = clock + dt * FASTER; clock = next >= duration() - 1e-9 ? duration() : next; }
    return render();
  };
  result.animate = time => { const dt = Number.isFinite(time) ? Math.max(0, time - lastClock) : 0; if (Number.isFinite(time)) lastClock = time; return result.advance(dt); };
  result.reset = () => { clock = 0; lastClock = 0; return render(result.defaults); };
  result.actions = [
    {label: 'Inspect: the element', part: 'element', view: 'iso', replay: false, run: () => render()},
    {label: 'Inspect: the water', part: 'water', view: 'iso', replay: false, run: () => render()},
    {label: 'Inspect: the steam switch', part: 'switch', view: 'iso', replay: false, run: () => render()},
    {label: 'Inspect: the dry protector', part: 'protector', view: 'front', replay: false, run: () => render()},
  ];
  result.parts.find(part => part.id === 'protector').inspectionView = 'front';
  result.playback = {label: 'Switch it on', description: 'Close the circuit and follow heating, boiling and shutoff at 10 times real speed. Pause freezes time. The run stops after cooling briefly, or at 300 simulated seconds.', stepLabel: 'Advance 10 s', advance: result.advance, step: () => result.advance(1), complete: () => clock >= duration(), blocked: () => result.getState().values.volts === 0};
  result.resultPart = {id: 'water', label: 'Inspect the heated water', view: 'iso', focusOnComplete: false, available: () => result.getState().wet && clock >= duration()};
  result.initialPart = 'system'; result.initialView = 'front'; result.frameVisibleOnly = true; result.framePadding = 0.55; result.selectionOutline = false; result.transparentBackground = true;
  result.topology = {system, apparatus, body, shell, innerWall, base, lid, cutEdges, handle, spout, water, pool, surface, circulation, element, sheath, sheathPath, coil, wirePath, insulationWindow, endpoints, feedthroughs, insulation, closeupSheath, closeupInsulator, closeupWire, insetTurns, steamSwitch, switchPivot, switchBlade, switchContacts, disc, discLayers, releaseLink, protector, dryPivot, dryBlade, dryContacts, sensorPad, thermalLink, steam, duct, vaporPath, vaporDots, bubbles, circuit, supply, paths, leads, chartPart, chartFrame, curves, boilLine};
  const dispose = result.dispose; result.dispose = () => { if (!disposed) { disposed = true; dispose(); } };
  return result;
}

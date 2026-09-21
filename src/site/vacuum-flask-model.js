import * as THREE from 'three';
import {houseModel, reading as r} from './house-model-kit.js';
import {fixed} from './format.js';
import {surface, lineObject, fillLine, solidArrow} from './scene-kit.js';
import {sampleFlask, FLASK, FLASK_DEFAULTS as D, FLASK_DOMAINS} from './vacuum-flask-physics.js';

const MM = 0.004, TAU = Math.PI * 2, CUT = Math.PI / 3, OPEN = [CUT, TAU - 2 * CUT];
const INNER = [[0, 19], [36, 19], [36, 150], [25.5, 166], [25, 166], [35, 150], [35, 20], [0, 20], [0, 19]];
const OUTER = [[0, 13], [42, 13], [42, 152], [27, 174], [27, 186], [26, 186], [26, 174], [41, 152], [41, 14], [0, 14], [0, 13]];
const NECK = [[25, 166], [25.5, 166], [25.5, 186], [25, 186], [25, 166]];
const DRINK = {bottom: 20.02, top: 20.02 + 500000 / (Math.PI * 35 ** 2), radius: 35};
const CHART = {left: 110, width: 180, bottom: 105, height: 120};
const BARS = {left: 175, width: 105, max: 25, top: 53, step: 22};
const ARROW_LENGTH = 22;
const COLD = new THREE.Color(0x4f86c6), HOT = new THREE.Color(0xd23b1f);
const PATHS = {
  radiation: {name: 'Radiation', color: 0xb3772d, anchor: [-36, 112, 12], out: [-1, 0, 0], label: [-58, 128, 12]},
  gas: {name: 'Gas', color: 0x547e81, anchor: [36, 72, 12], out: [1, 0, 0], label: [65, 88, 12]},
  neck: {name: 'Neck', color: 0x7e638e, anchor: [-34, 164, 15], out: [0, 1, 0], label: [-38, 206, 0]},
  top: {name: 'Top', color: 0xb5553e, anchor: [12, 197, 0], out: [0, 1, 0], label: [21, 230, 0]},
};
export const drinkColor = T => COLD.clone().lerp(HOT, Math.max(0, Math.min(1, T / 100)));
export const chartPoint = (hours, T) => [(CHART.left + hours / 24 * CHART.width) * MM, (CHART.bottom + T / 100 * CHART.height) * MM, 0];
export const ARROW_PATHS = PATHS;
const lathe = points => new THREE.LatheGeometry(points.map(([radius, y]) => new THREE.Vector2(radius * MM, y * MM)), 64, ...OPEN);

export function createVacuumFlaskModel() {
  const kit = houseModel('Vacuum flask'), {root, part, control, finish, covers} = kit;
  const labels = [], textures = [];
  function label(text, pos, width, parent, color = '#394233', height = 10) {
    const canvas = typeof document === 'undefined' ? null : document.createElement('canvas');
    let ctx, texture;
    if (canvas) {
      canvas.height = 96; canvas.width = Math.ceil(96 * width / height); ctx = canvas.getContext('2d');
      texture = new THREE.CanvasTexture(canvas);
    } else texture = new THREE.DataTexture(new Uint8Array([0, 0, 0, 0]), 1, 1);
    texture.colorSpace = THREE.SRGBColorSpace; textures.push(texture);
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(width * MM, height * MM), new THREE.MeshBasicMaterial({map: texture, transparent: true, depthWrite: false, toneMapped: false, side: THREE.DoubleSide}));
    mesh.position.set(...pos.map(v => v * MM)); mesh.raycast = () => {}; parent.add(mesh); labels.push(mesh);
    mesh.userData.setText = value => {
      if (mesh.userData.labelText === value) return;
      mesh.userData.labelText = value;
      if (ctx) { ctx.clearRect(0, 0, canvas.width, canvas.height); ctx.font = '76px sans-serif'; ctx.fillStyle = color; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(value, canvas.width / 2, 48, canvas.width * 0.98); }
      texture.needsUpdate = true;
    };
    mesh.userData.setText(text); return mesh;
  }
  function vessel(points, color, parent) {
    const mesh = surface(kit, lathe(points), color, parent, true);
    const shape = new THREE.Shape(points.map(([radius, y]) => new THREE.Vector2(radius * MM, y * MM)));
    mesh.userData.cutFaces = OPEN.map((_, i) => {
      const face = new THREE.Mesh(new THREE.ShapeGeometry(shape), mesh.material);
      face.rotation.y = (i ? OPEN[0] + OPEN[1] : OPEN[0]) - Math.PI / 2;
      parent.add(face); return face;
    });
    return mesh;
  }
  const system = part('system', 'Vacuum flask', 'A cutaway of a half-liter flask. Double walls reduce heat transfer across a gap; a narrow neck and stopper limit the remaining paths. Chart and arrows are teaching guides.');
  const gap = part('gap', 'Double wall and insulating gap', 'Inspect the two walls around the empty space. The cylindrical body has a 5 mm gap. Residual gas still carries a small modeled heat flow in a vacuum.', [0, 0, 0], system);
  const innerWall = part('inner-wall', 'Inner wall', 'A glass vessel holds the drink. Its face toward the gap has a low-emissivity coating when silvered.', [0, 0, 0], gap);
  const inner = vessel(INNER, 'metal', innerWall);
  const outerWall = part('outer-wall', 'Outer wall', 'The outer vessel encloses the gap. It rests on the insulating support; it does not touch the inner vessel at the base.', [0, 0, 0], gap);
  const outer = vessel(OUTER, 'metal', outerWall);
  outer.material.dispose(); outer.material = inner.material; outer.userData.cutFaces.forEach(face => { face.material = inner.material; });
  inner.material.transparent = true; inner.material.depthWrite = false;
  const neck = part('neck', 'Thin neck and sealed rim', 'A 0.5 mm wall, 20 mm long, leads from the inner vessel to the shared rim. The chosen steel conductivity is sixteen times the chosen glass value.', [0, 0, 0], gap);
  const neckBand = vessel(NECK, 'metal', neck);
  const rim = vessel([[25, 186], [27, 186], [27, 187], [25, 187], [25, 186]], 'metal', neck);
  rim.material.dispose(); rim.material = neckBand.material; rim.userData.cutFaces.forEach(face => { face.material = neckBand.material; });
  neckBand.material.transparent = true; neckBand.material.depthWrite = false;
  const molecules = Array.from({length: 40}, (_, i) => {
    const angle = OPEN[0] + 0.1 + (OPEN[1] - 0.2) * ((i * 0.618034) % 1), y = 25 + 119 * ((i * 0.414214) % 1);
    const dot = kit.sphere(1.1 * MM, [0, 0, 0], 'ink', gap);
    dot.userData.home = {angle, y, radius: 38.5, phase: i * 1.7}; return dot;
  });
  const stopper = part('stopper', 'Stopper', 'A close-fitting insulating plug seals the neck. The model assigns a small thermal conductance to the closed top and a larger one to the opening; evaporation is omitted.', [0, 0, 0], system);
  const plug = kit.cylinder(25 * MM, 24 * MM, [0, 178 * MM, 0], 'wood', stopper);
  kit.cylinder(30 * MM, 6 * MM, [0, 193 * MM, 0], 'wood', stopper);
  kit.cylinder(16 * MM, 8 * MM, [0, 200 * MM, 0], 'wood', stopper);
  const drink = part('drink', 'Drink', 'Half a liter of water, treated as well mixed. Color interpolates from blue at 0°C to red at 100°C; the numerical temperature is in the readings.', [0, 0, 0], system);
  const liquid = vessel([[0, DRINK.bottom], [DRINK.radius, DRINK.bottom], [DRINK.radius, DRINK.top], [0, DRINK.top], [0, DRINK.bottom]], 'clay', drink);
  const support = part('support', 'Insulating support', 'Cork supports the outer vessel above the case floor. It does not bridge the vacuum gap. Exterior heat storage is omitted because the model fixes the outer wall at room temperature.', [0, 0, 0], system);
  const cork = kit.cylinder(22 * MM, 7 * MM, [0, 9.5 * MM, 0], 'wood', support);
  const shell = part('case', 'Protective case', 'Protects the glass. Open the cover to see the cutaway; the solid floor supports the cork beneath the outer vessel.', [0, 0, 0], system);
  const floor = kit.cylinder(48 * MM, 2 * MM, [0, 5 * MM, 0], 'leaf', shell);
  const caseProfile = [[48, 6], [48, 178], [34, 196], [34, 200], [32, 200], [32, 196], [46, 178], [46, 6], [48, 6]];
  covers.push(surface(kit, new THREE.LatheGeometry(caseProfile.map(([radius, y]) => new THREE.Vector2(radius * MM, y * MM)), 64), 'leaf', shell, true));

  const flows = part('heat-flow', 'Heat flow directions', 'Colored arrows show the direction of net heat transfer on four paths. Their equal lengths do not represent watts; compare the bars and readings for magnitude.', [0, 0, 0], system);
  flows.userData.explosionExcluded = true;
  kit.rod([-34 * MM, 176 * MM, 15 * MM], [-25.25 * MM, 176 * MM, 0], 0.4 * MM, 'metal', flows);
  const arrows = Object.fromEntries(Object.entries(PATHS).map(([key, path]) => {
    label(path.name, path.label, 47, flows, '#' + path.color.toString(16));
    return [key, solidArrow(kit, path.color, flows, 1.8 * MM)];
  }));
  const chart = part('chart', 'Temperature and heat transfer', 'Upper chart: temperature over 24 hours, with a moving clock and current temperature. The 60°C line is a chosen comparison, not a drinking-safety threshold. Lower bars: heat-flow magnitudes on a shared 0–25 W scale.', [0, 0, 0], system);
  chart.userData.explosionExcluded = true;
  kit.rod(chartPoint(0, 0), chartPoint(24, 0), 0.65 * MM, 'ink', chart);
  kit.rod(chartPoint(0, 0), chartPoint(0, 100), 0.65 * MM, 'ink', chart);
  label('Drink temperature (°C)', [200, 242, 0], 145, chart);
  for (const T of [0, 20, 60, 100]) label(String(T), [98, CHART.bottom + T / 100 * CHART.height, 0], 20, chart, '#394233', 10);
  for (const hours of [0, 6, 12, 18, 24]) label(String(hours), [CHART.left + hours / 24 * CHART.width, 96, 0], 20, chart, '#394233', 10);
  label('Elapsed hours', [200, 83, 0], 95, chart, '#394233', 10);
  const room = lineObject(2, 0x547e81, chart), hotLine = lineObject(2, 0xb3772d, chart);
  fillLine(room, [chartPoint(0, FLASK.room), chartPoint(24, FLASK.room)]);
  fillLine(hotLine, [chartPoint(0, FLASK.reference), chartPoint(24, FLASK.reference)]);
  label('Room', [310, 129, 0], 34, chart, '#547e81', 10);
  label('Compare', [312, 177, 0], 43, chart, '#b3772d', 10);
  const trace = lineObject(FLASK.duration / FLASK.step + 1, 0xd23b1f, chart), cursor = lineObject(2, 0x374736, chart);
  const marker = kit.sphere(2.3 * MM, chartPoint(0, 90), 'clay', chart);
  const directionLabel = label('Heat out · each bar 0–25 W', [219, 69, 0], 185, chart, '#394233', 11);
  const bars = {}, wattLabels = {};
  Object.entries(PATHS).forEach(([key, path], i) => {
    const y = BARS.top - i * BARS.step;
    label(path.name, [136, y, 0], 63, chart, '#' + path.color.toString(16), 11);
    kit.box([BARS.width * MM, 1 * MM, 0.5 * MM], [(BARS.left + BARS.width / 2) * MM, y * MM, 0], 'metal', chart);
    const bar = kit.box([MM, 4 * MM, MM], [BARS.left * MM, y * MM, MM], 'clay', chart);
    bar.material = bar.material.clone(); bar.material.color.set(path.color); bars[key] = bar;
    wattLabels[key] = label('0.000 W', [311, y, 0], 57, chart, '#394233', 11);
  });
  for (const guide of [flows, chart]) guide.traverse(object => { object.raycast = () => {}; });

  const choice = (off, on) => [{value: 0, label: off}, {value: 1, label: on}];
  const specs = {
    silvered: ['Walls facing the gap', '', choice('Bare glass', 'Silvered'), 'Change the chosen emissivity from 0.9 to 0.03 on both gap faces.'],
    vacuum: ['Gap between the walls', '', choice('Air', 'Vacuum'), 'Vacuum reduces the modeled gas conduction to one thousandth. Radiation still crosses.'],
    neck: ['Neck material', '', choice('Glass', 'Stainless steel'), 'Change only the neck conductivity, leaving the vessel and heat capacity fixed.'],
    stopper: ['Stopper', '', choice('Left out', 'In place'), 'Compare the chosen closed-top and open-top conductances. Evaporation is not simulated.'],
    start: ['Drink poured in at', '°C', null, 'Fresh trial at this temperature; room and outer wall remain at 20°C.'],
  };
  for (const [name, [min, max, step]] of Object.entries(FLASK_DOMAINS)) {
    const [label, unit, options, help] = specs[name];
    control(name, label, min, max, step, D[name], unit, help, options, {primary: name === 'vacuum'});
  }
  let hours = 0, lastClock = 0, disposed = false, physicalKey = '', traceKey = '';
  const result = finish(values => {
    const key = JSON.stringify(values);
    if (key !== physicalKey) { hours = lastClock = 0; physicalKey = key; }
    const s = sampleFlask(values, hours);
    inner.material.color.set(values.silvered ? 0xe4ebee : 0xcfe3e8);
    inner.material.opacity = values.silvered ? 0.92 : 0.4;
    neckBand.material.color.set(values.neck ? 0x8e9aa0 : 0xcfe3e8);
    neckBand.material.opacity = values.neck ? 1 : 0.6;
    stopper.position.x = values.stopper ? 0 : -85 * MM;
    stopper.position.y = values.stopper ? 0 : -166 * MM;
    liquid.material.color.copy(drinkColor(s.T)); marker.material = liquid.material;
    molecules.forEach(dot => {
      const {angle, y, radius, phase} = dot.userData.home, jiggle = 0.9 * Math.sin(hours * 30 + phase);
      dot.visible = values.vacuum === 0;
      dot.position.set((radius + jiggle) * Math.sin(angle) * MM, (y + 2 * Math.cos(hours * 23 + phase)) * MM, (radius + jiggle) * Math.cos(angle) * MM);
    });
    for (const [key, {anchor, out}] of Object.entries(PATHS)) {
      const watts = s.paths[key], length = Math.abs(watts) < 1e-9 ? 0 : ARROW_LENGTH * MM, arrow = arrows[key], sign = watts >= 0 ? 1 : -1;
      arrow.userData.setLength(length); arrow.userData.setDirection(new THREE.Vector3(...out).multiplyScalar(sign));
      arrow.position.set(...anchor.map((value, i) => value * MM + (sign < 0 ? out[i] * length : 0)));
      const width = Math.abs(watts) / BARS.max * BARS.width;
      bars[key].scale.x = Math.max(width, 1e-9); bars[key].position.x = (BARS.left + width / 2) * MM; bars[key].visible = Math.abs(watts) >= 1e-9;
      wattLabels[key].userData.setText(fixed(Math.abs(watts), 3) + ' W');
    }
    directionLabel.userData.setText(s.paths.total === 0 ? 'No net heat · each bar 0–25 W' : `Heat ${s.paths.total > 0 ? 'out' : 'in'} · each bar 0–25 W`);
    if (key !== traceKey) {
      traceKey = key; fillLine(trace, s.samples.map(sample => chartPoint(sample.t / 3600, sample.T)));
    }
    fillLine(cursor, [chartPoint(s.hours, 0), chartPoint(s.hours, 100)]);
    marker.position.set(...chartPoint(s.hours, s.T));
    const direction = s.paths.total > 0 ? 'out' : s.paths.total < 0 ? 'in' : 'neither way';
    const until = s.aboveReferenceUntil, watts = value => `${fixed(Math.abs(value), 3)} W`;
    const outcome = hours === 0 ? 'Ready · press Play to watch a day go by' : s.complete ? `A day later · the drink is at ${fixed(s.T, 1)} °C` : `${fixed(s.hours, 1)} h · the drink is at ${fixed(s.T, 1)} °C`;
    return {state: s, readings: [
      r('Your result', outcome),
      r('Drink', `${fixed(s.T, 1)} °C`, s.T === FLASK.room ? 'Same temperature as the room: no net heat transfer.' : s.T > FLASK.room ? 'Cooling toward the 20°C room.' : 'Warming toward the 20°C room.'),
      r('Time above 60°C', until === 0 ? '0 h' : until === null ? 'More than 24 h' : `${fixed(until / 3600, 1)} h`, 'A chosen comparison line, not a drinking-safety recommendation.'),
      r('Net heat transfer', `${watts(s.paths.total)} ${direction}`, 'Sum of four paths. Arrows show direction; bars share one watts scale.'),
      r('Radiation across the gap', watts(s.paths.radiation), values.silvered ? 'Low chosen emissivity reduces radiation; vacuum alone does not.' : 'Bare surfaces radiate about 54 times as much at the same temperatures in this approximation.'),
      r('Gas in the gap', watts(s.paths.gas), values.vacuum ? 'Residual gas conduction is one thousandth of the air-filled value.' : 'Conduction across the 5 mm gap; gas convection is omitted.'),
      r('Along the neck', watts(s.paths.neck), values.neck ? 'Chosen steel conductivity: 16 W/(m·K).' : 'Chosen glass conductivity: 1 W/(m·K).'),
      r('Through the top', watts(s.paths.top), values.stopper ? 'Chosen closed-top conductance: 0.02 W/K.' : 'Chosen open-top conductance: 0.3 W/K. No evaporation model.'),
      r('Heat transferred so far', `${fixed(Math.abs(s.lost) / 1000, 2)} kJ ${s.lost > 0 ? 'out' : s.lost < 0 ? 'in' : ''}`.trim(), 'Equals drink-plus-inner-wall heat capacity × temperature change. Path totals below add to this amount.'),
      r('By path: radiation · gas · neck · top', Object.values(s.energy).map(value => `${fixed(Math.abs(value) / 1000, 2)} kJ`).join(' · '), 'Cumulative transferred energy, in the same direction as net heat transfer.'),
    ]};
  });
  const render = result.update;
  result.advance = dt => { if (Number.isFinite(dt) && dt > 0) hours = Math.min(24, hours + dt); return render(); };
  result.animate = t => { const dt = Number.isFinite(t) ? Math.max(0, t - lastClock) : 0; if (Number.isFinite(t)) lastClock = t; return result.advance(dt); };
  result.reset = () => { hours = lastClock = 0; physicalKey = ''; return render(result.defaults); };
  result.actions = [
    {label: 'Inspect: six hours later', part: 'system', view: 'front', replay: false, run() { hours = 6; return render(); }},
    {label: 'Inspect: a day later', part: 'system', view: 'front', replay: false, run() { hours = 24; return render(); }},
    {label: 'Inspect: the gap', part: 'gap', view: 'front', isolate: true, replay: false, run() { return render(); }},
    {label: 'Inspect: temperature chart', part: 'chart', view: 'front', isolate: true, replay: false, run() { return render(); }},
  ];
  result.playback = {label: 'Watch a day go by', description: 'One hour per playback second; a full day takes 24 seconds. Changing a setting starts a fresh trial.', stepLabel: 'Advance by an hour', advance: result.advance, step: () => result.advance(1), complete: () => Boolean(result.getState().complete), blocked: () => false};
  result.frameBoundsForPart = id => {
    if (id !== 'system') return null;
    root.updateWorldMatrix(true, false);
    return new THREE.Box3(new THREE.Vector3(-120 * MM, -34 * MM, -55 * MM), new THREE.Vector3(345 * MM, 253 * MM, 55 * MM)).applyMatrix4(root.matrixWorld);
  };
  root.rotation.set(0.2, -0.3, 0);
  chart.quaternion.copy(root.quaternion).invert();
  result.initialPart = 'system'; result.initialView = 'front'; result.frameVisibleOnly = true; result.framePadding = 0.5; result.selectionOutline = false; result.transparentBackground = true;
  result.thumbnailOmit = [flows, chart];
  result.topology = {system, innerWall, inner, outerWall, outer, gap, molecules, neck, neckBand, rim, stopper, plug, drink, liquid, faces: liquid.userData.cutFaces, support, cork, shell, floor, flows, arrows, chart, room, hotLine, trace, cursor, marker, bars, wattLabels, directionLabel, labels, textures, MM, ARROW_LENGTH, CUT, OPEN, INNER, OUTER, NECK, DRINK, CHART, BARS};
  const dispose = result.dispose;
  result.dispose = () => { if (!disposed) { disposed = true; textures.forEach(texture => texture.dispose()); dispose(); } };
  return result;
}

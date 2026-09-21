import * as THREE from 'three';
import {houseModel, reading as r} from './house-model-kit.js';
import {fixed} from './format.js';
import {clamp} from './physics-kit.js';
import {fillLine, lineObject, segmentLines, solidArrow} from './scene-kit.js';
import {panel} from './element-scene.js';
import {
  rodPlan, rodAt, valveOpenAt, differentialAt,
  ROD_DEFAULTS, ROD_DOMAINS, BYPASSES, DECLARED, EXPANSION, ORIFICE, GAS,
} from './thermostat-physics.js';

// ---------------------------------------------------------------------------
// Rod thermostat: the brass tube and the steel rod inside it drawn at true
// size, the gas valve their difference closes, the bypass that keeps the burner
// alight, and the oven the whole thing keeps.
//
// This is the book's mechanism and not an electrical switch: the tube grows
// more than the rod, and a spring closes a valve in the gas. Nothing here
// switches a contact or lights a lamp.
//
// Scale: the tube and rod are drawn at true size, 1 mm to 0.004 scene units,
// the tube 200 mm long. The difference between them is what does the work and
// it is tiny, 1.6 micrometers for each degree, so the valve's movement is drawn
// 200 times larger than it is; said in the part text and in a reading. The
// chart is not to scale.
//
// Time: the run covers 40 minutes of oven time and plays 120 times faster.
// ---------------------------------------------------------------------------

export const MM = 0.004;
/** How many times larger than it is the valve's movement is drawn. */
export const MOVE_TIMES = 200;

/** The thermostat, mm about the closed end of the tube. */
export const ROD = Object.freeze({
  origin: Object.freeze([-0.86, 0.5, 0]),
  tube: Object.freeze([0, 200, -9, 9]), wall: 2.2,
  rod: Object.freeze([4, 196, -2.6, 2.6]),
  valve: Object.freeze([214, 0]), seat: Object.freeze([9, 5]),
  spring: Object.freeze([228, 0, 22, 5]),
  bypass: Object.freeze([214, -16]),
  gas: Object.freeze([248, 0]), burner: Object.freeze([268, 300, -12, 12]), flames: 5,
});

/** The oven through the run. */
export const CHART = Object.freeze({
  x: -0.12, y: -0.64, w: 1.68, h: 0.74,
  temperature: Object.freeze([0, 300]), tickEvery: 600, tick: 0.02, mark: 0.028, cursor: 0.02,
});

export const COLORS = Object.freeze({
  casing: 0xe9e4d8, shell: 0x2f3336, faint: 0x9aa39a, chart: 0x374736,
  brass: 0xe3b45e, steel: 0x8e948c, gas: 0x83b4c1, flame: 0xe07a3c, set: 0x7d5ba6, seat: 0xc14f39,
});

export const chartX = (plan, t) => CHART.x + clamp(t / plan.duration) * CHART.w;
export const chartY = celsius => CHART.y + clamp((celsius - CHART.temperature[0]) / (CHART.temperature[1] - CHART.temperature[0])) * CHART.h;

export function createRodThermostatModel() {
  const kit = houseModel('Rod thermostat'), {part, control, finish} = kit;
  const {flat, rect, millimeters, outline, circlePoints} = panel(MM);
  let clock = 0, lastClock = 0, disposed = false;

  const [tubeX0, tubeX1, tubeLow, tubeHigh] = ROD.tube;
  const system = part('system', 'Rod thermostat, cut open', `A brass tube ${fixed(tubeX1 - tubeX0, 0)} mm long with a steel rod inside it, drawn at true size, and the gas valve the difference between them closes. The movement itself is drawn ${MOVE_TIMES} times larger, because it is only ${fixed(1e6 * differentialAt(1, DECLARED.rodLength, 0), 1)} micrometers for each degree. Beneath, the oven it keeps. Press Play to light it.`);

  const tube = part('tube', 'Brass tube', `The tube that reaches into the oven and feels its heat. Brass grows ${fixed(EXPANSION.brass / EXPANSION.carbonSteel, 2)} times as fast as steel, so as the oven warms the tube lengthens faster than the rod inside it and drags the rod's far end back with it.`, ROD.origin, system);
  const tubeWall = [flat(COLORS.brass, tube), flat(COLORS.brass, tube)];
  const tubeEnd = flat(COLORS.brass, tube);

  const rod = part('rod', 'Steel rod', `The rod inside the tube, fixed to its closed end and free at the other. It barely changes length itself; its job is to stay still while the tube around it grows, so that the difference between them appears at the valve.`, ROD.origin, system);
  const rodBar = flat(COLORS.steel, rod);

  const valve = part('valve', 'Gas valve and spring', `The valve the rod's free end works, with the spring that closes it. This is the whole output of the thermostat: not a switch, not a lamp, but an opening in the gas. As the oven warms, the spring is allowed to close the valve; as it cools, the rod pushes it open again.`, ROD.origin, system);
  const seat = flat(COLORS.shell, valve);
  const plug = flat(COLORS.seat, valve);
  const springCoil = lineObject(33, COLORS.steel, valve);
  const move = solidArrow(kit, COLORS.seat, valve, 0.005);

  const bypass = part('bypass', 'Bypass', `A small fixed opening around the valve. The book is plain about why it is there: if the main valve shuts completely the burner goes out, and an oven full of unburnt gas is dangerous. The bypass keeps a flame alive whatever the valve does, so there is always something for the gas to light from.`, ROD.origin, system);
  const bypassHole = flat(COLORS.gas, bypass);
  const bypassLine = segmentLines(1, COLORS.gas, bypass);

  const burner = part('burner', 'Burner', 'Where the gas that gets through is burned. Its flames stand in proportion to the gas reaching them, so the burner turns down as the valve closes rather than switching off.', ROD.origin, system);
  const burnerBar = flat(COLORS.shell, burner);
  const flameGeometry = new THREE.BufferGeometry();
  flameGeometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(ROD.flames * 9), 3));
  const flames = new THREE.Mesh(flameGeometry, new THREE.MeshBasicMaterial({color: COLORS.flame, side: THREE.DoubleSide}));
  flames.frustumCulled = false;
  burner.add(flames);

  const chartPart = part('chart', 'The oven through the run', `What the oven reads from the moment it is lit, from ${fixed(CHART.temperature[0], 0)} to ${fixed(CHART.temperature[1], 0)} °C, with a tick every ${fixed(CHART.tickEvery / 60, 0)} minutes. The violet line is your setting. The oven does not overshoot and cycle the way a room does: the valve closes gradually, so the oven eases up to its setting and stays there.`, [0, 0, 0], system);
  const chartFrame = lineObject(5, COLORS.chart, chartPart);
  outline(chartFrame, CHART.x, CHART.x + CHART.w, CHART.y, CHART.y + CHART.h, 0, 1);
  const setLine = segmentLines(1, COLORS.set, chartPart);
  const ticks = segmentLines(Math.ceil(DECLARED.ovenRun / CHART.tickEvery), COLORS.chart, chartPart);
  const guide = lineObject(DECLARED.samples, COLORS.faint, chartPart);
  const openGuide = lineObject(DECLARED.samples, COLORS.gas, chartPart);
  const curve = lineObject(DECLARED.samples + 1, COLORS.flame, chartPart);
  const cursor = segmentLines(1, COLORS.chart, chartPart);
  const leader = segmentLines(1, COLORS.faint, system);

  const d = ROD_DEFAULTS, D = ROD_DOMAINS;
  control('setting', 'Oven setting', ...D.setting, d.setting, '°C', 'Where the control puts the valve seat along the rod, and so the temperature at which the valve is squeezed shut.');
  control('start', 'Starting temperature', ...D.start, d.start, '°C', 'How warm the oven is when it is lit.');
  control('supply', 'Gas supply pressure', ...D.supply, d.supply, 'mbar', 'What pressure the gas arrives at. More pressure is more gas through the same opening, so the oven heats faster but settles in the same place.');
  control('bypass', 'Bypass', ...D.bypass, d.bypass, '', 'Whether the small fixed opening around the valve is there. Without it, a valve that closes fully puts the burner out.', BYPASSES);

  const result = finish(v => {
    const plan = rodPlan(v), now = rodAt(plan, clock), values = plan.values;

    // The tube and the rod, at true size.
    const [rodX0, rodX1, rodLow, rodHigh] = ROD.rod;
    millimeters(tubeWall[0], tubeX0, tubeX1, tubeHigh - ROD.wall, tubeHigh, -0.004);
    millimeters(tubeWall[1], tubeX0, tubeX1, tubeLow, tubeLow + ROD.wall, -0.004);
    millimeters(tubeEnd, tubeX0, tubeX0 + ROD.wall, tubeLow, tubeHigh, -0.004);
    // The rod's free end carries the difference, drawn many times larger.
    const shown = MOVE_TIMES * 1000 * differentialAt(now.celsius, DECLARED.rodLength, values.setting);
    millimeters(rodBar, rodX0, rodX1 - shown, rodLow, rodHigh, -0.003);

    // The valve: open by the share the physics gives, drawn on the same enlarged scale.
    const [valveX, valveY] = ROD.valve, [seatHigh, seatWide] = ROD.seat;
    millimeters(seat, valveX, valveX + seatWide, valveY - seatHigh, valveY + seatHigh, -0.004);
    const lift = seatHigh * now.open;
    millimeters(plug, valveX - 3, valveX + seatWide + 3, valveY - lift, valveY + lift, -0.002);
    const [springX, springY, springLong, springR] = ROD.spring;
    fillLine(springCoil, Array.from({length: 33}, (_, i) => {
      const s = i / 32, a = s * 8 * Math.PI;
      return [(springX + springLong * s) * MM, (springY + springR * Math.sin(a)) * MM, -0.003];
    }));
    move.position.set((rodX1 - shown) * MM, (rodHigh + 8) * MM, -0.001);
    move.userData.setDirection(new THREE.Vector3(shown >= 0 ? -1 : 1, 0, 0));
    move.userData.setLength(Math.min(0.26, Math.abs(shown) * MM));

    // The bypass, always passing something when it is fitted.
    const [bypassX, bypassY] = ROD.bypass;
    bypassHole.visible = values.bypass === 1;
    bypassLine.visible = values.bypass === 1;
    millimeters(bypassHole, bypassX, bypassX + seatWide, bypassY - 2, bypassY + 2, -0.003);
    fillLine(bypassLine, [[(bypassX + seatWide) * MM, bypassY * MM, -0.002], [ROD.gas[0] * MM, bypassY * MM, -0.002]]);

    // The burner, its flames standing for the gas that reaches them.
    const [burnX0, burnX1, burnLow, burnHigh] = ROD.burner;
    millimeters(burnerBar, burnX0, burnX1, burnLow, burnLow + 5, -0.004);
    const share = plan.fullFlow > 0 ? clamp(now.flow / plan.fullFlow) : 0;
    const positions = flames.geometry.attributes.position.array, spacing = (burnX1 - burnX0) / ROD.flames;
    for (let i = 0; i < ROD.flames; i++) {
      const x = burnX0 + spacing * (i + 0.5), height = 34 * share * (1 + 0.08 * Math.sin(clock * 5 + i));
      positions.set([(x - 7) * MM, (burnLow + 5) * MM, -0.003, (x + 7) * MM, (burnLow + 5) * MM, -0.003, x * MM, (burnLow + 5 + height) * MM, -0.003], i * 9);
    }
    flames.geometry.attributes.position.needsUpdate = true;
    flames.geometry.boundingBox = null;
    flames.geometry.boundingSphere = null;
    flames.visible = share > 0;

    // The oven through the run.
    fillLine(setLine, [[CHART.x, chartY(values.setting), 0], [CHART.x + CHART.w, chartY(values.setting), 0]]);
    const tickCount = Math.max(0, Math.ceil(plan.duration / CHART.tickEvery) - 1);
    fillLine(ticks, Array.from({length: tickCount}, (_, i) => {
      const x = chartX(plan, (i + 1) * CHART.tickEvery);
      return [[x, CHART.y, 0], [x, CHART.y - CHART.tick, 0]];
    }).flat());
    fillLine(guide, plan.chart.map(sample => [chartX(plan, sample.t), chartY(sample.celsius), 0]));
    fillLine(openGuide, plan.chart.map(sample => [chartX(plan, sample.t), CHART.y + sample.open * CHART.h, 0]));
    const drawnSoFar = clock > 0 ? plan.chart.filter(sample => sample.t < now.t) : [];
    fillLine(curve, clock > 0 ? [...drawnSoFar.map(sample => [chartX(plan, sample.t), chartY(sample.celsius), 0]), [chartX(plan, now.t), chartY(now.celsius), 0]] : []);
    const cx = Math.min(Math.max(chartX(plan, now.t), CHART.x + CHART.cursor), CHART.x + CHART.w - CHART.cursor);
    fillLine(cursor, clock > 0 ? [[cx - CHART.cursor, chartY(now.celsius), 0], [cx + CHART.cursor, chartY(now.celsius), 0]] : []);
    fillLine(leader, [[ROD.origin[0] + 0.4, ROD.origin[1] - 0.16, 0], [CHART.x + CHART.w / 2, CHART.y + CHART.h, 0]]);

    const minutes = seconds => `${fixed(seconds / 60, 0)} min`;
    const status = clock <= 0 ? `Ready · the valve is wide open and will be squeezed shut by ${fixed(plan.shutsAt, 1)} °C; press Play to light it`
      : now.done ? `Settled · the oven holds ${fixed(now.celsius, 1)} °C with the valve ${fixed(100 * now.open, 0)}% open, which is exactly the gas it takes to replace what the oven loses`
      : `Heating · ${minutes(now.t)} in, the oven reads ${fixed(now.celsius, 1)} °C and the valve is ${fixed(100 * now.open, 0)}% open`;
    return {
      state: {...plan, now, clock},
      readings: [
        r('Your result', status),
        r('Oven temperature', `${fixed(now.celsius, 1)} °C`, `The oven holds ${fixed(DECLARED.ovenCapacity / 1000, 0)} kJ for each degree and loses ${fixed(DECLARED.ovenLoss, 1)} W for each degree above the ${fixed(DECLARED.ovenAmbient, 0)} °C kitchen. It settles where the gas still getting through is just enough to replace that, which is why it comes to rest below the temperature that would shut the valve completely.`),
        r('Valve', `${fixed(100 * now.open, 0)}% open`, `Not a switch. The valve closes gradually as the tube grows, so the burner turns down as the oven approaches the setting instead of banging on and off. It would be fully shut at ${fixed(plan.shutsAt, 1)} °C, and the oven settles before it gets there.`),
        r('How far the tube grows', `${fixed(1e6 * differentialAt(1, DECLARED.rodLength, 0), 2)} µm for each degree`, `Brass expands at ${fixed(1e6 * EXPANSION.brass, 1)} millionths of its length for each degree and steel at ${fixed(1e6 * EXPANSION.carbonSteel, 1)}, so over ${fixed(1000 * DECLARED.rodLength, 0)} mm the difference is ${fixed(1e6 * differentialAt(1, DECLARED.rodLength, 0), 2)} micrometers a degree. The linkage multiplies it ${fixed(DECLARED.lever, 0)} times, and the valve needs only ${fixed(1000 * DECLARED.valveTravel, 2)} mm of travel to go from open to shut, which is what makes a movement this small into an oven control.`),
        r('Gas through the valve', `${fixed(1e6 * now.flow, 0)} mm³/s`, `The orifice equation: the opening times the square root of twice the pressure over the density, times a discharge coefficient of ${fixed(ORIFICE.discharge[0], 1)}. At ${fixed(values.supply, 0)} mbar through a fully open ${fixed(1000 * DECLARED.valveBore, 1)} mm seat that is ${fixed(1000 * plan.fullFlow, 2)} L/s, which at the gas's ${fixed(GAS.calorific / 1e6, 1)} MJ/m³ and a ${fixed(100 * DECLARED.burnerEfficiency, 0)}% burner is ${fixed(plan.fullPower, 0)} W into the oven.`),
        r('Bypass', values.bypass ? `${fixed(1e6 * plan.bypassFlow, 0)} mm³/s always` : 'none fitted', values.bypass
          ? `A fixed ${fixed(1000 * DECLARED.bypassBore, 1)} mm opening that the valve cannot close. It keeps a small flame alive however far the main valve shuts, so the burner never goes out and never has to be relit into a hot oven full of gas.`
          : `With no bypass, a valve that shut completely would put the burner out, and the next gas through would be entering an oven with nothing to light it. That is the accident the bypass exists to prevent.`),
        r('Where it settles', `${fixed(plan.settled.celsius, 1)} °C against a setting of ${fixed(values.setting, 0)} °C`, `A proportional control settles a little under its setting, because it needs some opening left to hold the oven there at all. Turn the setting up and the whole curve moves with it: the valve shuts at ${fixed(plan.shutsAt, 1)} °C for this setting.`),
        r('Sped up', `${fixed(DECLARED.slower, 0)} times faster`, `The run covers ${minutes(plan.duration)} of oven time and plays in ${fixed(plan.duration / DECLARED.slower, 0)} s. The tube and rod are drawn at true size and the movement between them ${MOVE_TIMES} times larger; the chart is not to scale.`),
      ],
    };
  });

  const render = result.update;
  const duration = () => result.getState().duration;
  result.advance = dt => { if (Number.isFinite(dt) && dt > 0) clock = Math.min(duration(), clock + dt * DECLARED.slower); return render(); };
  result.animate = t => { const dt = Number.isFinite(t) ? Math.max(0, t - lastClock) : 0; if (Number.isFinite(t)) lastClock = t; return result.advance(dt); };
  result.reset = () => { clock = 0; lastClock = 0; return render(result.defaults); };
  const inspect = time => { clock = Math.min(duration(), time); return render(); };
  result.actions = [
    {label: 'Inspect: the tube and rod', part: 'tube', view: 'front', replay: false, run() { return inspect(duration()); }},
    {label: 'Inspect: the valve', part: 'valve', view: 'front', replay: false, run() { return inspect(duration()); }},
    {label: 'Inspect: the bypass', part: 'bypass', view: 'front', replay: false, run() { return inspect(duration()); }},
    {label: 'Inspect: the oven', part: 'chart', view: 'front', replay: false, run() { return render(); }},
  ];
  result.playback = {
    label: 'Light the oven',
    description: `The oven is lit and the thermostat is left to bring it up. The run covers ${fixed(DECLARED.ovenRun / 60, 0)} minutes and plays ${fixed(DECLARED.slower, 0)} times faster than the real thing.`,
    stepLabel: `Advance ${fixed(CHART.tickEvery / 60, 0)} min`,
    advance: result.advance,
    step: () => result.advance(CHART.tickEvery / DECLARED.slower),
    complete: () => clock >= duration(),
    blocked: () => false,
  };
  result.resultPart = {id: 'chart', label: 'Inspect the oven', view: 'front', focusOnComplete: false, available: () => clock >= duration()};

  kit.root.rotation.set(0.04, -0.06, 0);
  result.initialPart = 'system';
  result.initialView = 'front';
  result.frameVisibleOnly = true;
  result.framePadding = 0.6;
  result.selectionOutline = false;
  result.transparentBackground = true;
  result.topology = {system, tube, tubeWall, tubeEnd, rod, rodBar, valve, seat, plug, springCoil, move, bypass, bypassHole, bypassLine, burner, burnerBar, flames, chartPart, chartFrame, setLine, ticks, guide, openGuide, curve, cursor, leader};
  const dispose = result.dispose;
  result.dispose = () => { if (!disposed) { disposed = true; dispose(); } };
  return result;
}

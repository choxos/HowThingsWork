import * as THREE from 'three';
import {houseModel, reading as r} from './house-model-kit.js';
import {fixed} from './format.js';
import {clamp} from './physics-kit.js';
import {chartText, fillLine, lineObject, segmentLines, solidArrow, textLabel} from './scene-kit.js';
import {panel} from './element-scene.js';
import {
  waxPlan, waxAt, pistonAt, meltedAt, coolantOpenAt,
  WAX_DEFAULTS, WAX_DOMAINS, DECLARED, WAX, COOLANT,
} from './thermostat-physics.js';

// ---------------------------------------------------------------------------
// Wax thermostat: the capsule cut open at true size, the wax melting inside it,
// the piston that melting drives, the valve it opens against a return spring,
// and the engine the whole thing keeps.
//
// This is the book's mechanism and not an electrical switch: wax melts, the
// capsule grows, a rod pushes a valve open in the cooling water, and a spring
// closes it again as the wax freezes. Nothing here switches a contact.
//
// Scale: the capsule, piston and valve are drawn at true size, 1 mm to 0.02
// scene units, the piston 4 mm across and its stroke a true 8.6 mm at the
// default wax. Nothing is exaggerated, which is the whole point of a wax motor:
// unlike a bimetal strip or a rod and tube, its movement is big enough to see.
// The chart is not to scale.
//
// Time: the run covers 15 minutes of engine time and plays 120 times faster.
// ---------------------------------------------------------------------------

export const MM = 0.02;

/** The element, mm about the base of the capsule. */
export const ELEMENT = Object.freeze({
  origin: Object.freeze([-0.74, 0.34, 0]),
  capsule: Object.freeze([-9, 9, 0, 16]), wall: 1.4,
  piston: Object.freeze([-2, 2]), pistonFrom: 16,
  seal: Object.freeze([-4, 4, 15, 18]),
  valve: Object.freeze([-14, 14, 2]), valveFrom: 30,
  spring: Object.freeze([10, 18, 34, 3]),
  grains: 26,
  radiator: Object.freeze([26, 58, -6, 30]), tubes: 5,
  engine: Object.freeze([-58, -26, -6, 30]),
});

/** The engine through the run. */
export const CHART = Object.freeze({
  x: -0.06, y: -0.66, w: 1.72, h: 0.76,
  temperature: Object.freeze([0, 120]), tickEvery: 180, tick: 0.02, mark: 0.028, cursor: 0.02,
});

export const COLORS = Object.freeze({
  casing: 0xe9e4d8, shell: 0x2f3336, faint: 0x9aa39a, chart: 0x374736,
  solid: 0xe3b45e, liquid: 0xc14f39, brass: 0xb4c5b0, cool: 0x3f7fbf, hot: 0xc14f39,
  spring: 0x8e948c, open: 0x7d5ba6, melt: 0x7d5ba6,
});

export const chartX = (plan, t) => CHART.x + clamp(t / plan.duration) * CHART.w;
export const chartY = celsius => CHART.y + clamp((celsius - CHART.temperature[0]) / (CHART.temperature[1] - CHART.temperature[0])) * CHART.h;

const cool = new THREE.Color(COLORS.cool), hot = new THREE.Color(COLORS.hot);
/** The color of coolant at `celsius`. */
export const coolantColor = celsius => cool.clone().lerp(hot, clamp(celsius / 110));

export function createWaxThermostatModel() {
  const kit = houseModel('Wax thermostat'), {part, control, finish} = kit;
  const {flat, rect, millimeters, outline, circlePoints} = panel(MM);
  let clock = 0, lastClock = 0, disposed = false;

  const [capX0, capX1, capY0, capY1] = ELEMENT.capsule;
  const system = part('system', 'Wax thermostat, cut open', `The capsule cut open at true size, ${fixed(capX1 - capX0, 0)} mm across, with the wax inside it, the piston the melting wax drives, and the valve that piston opens in the cooling water. Nothing here is drawn larger than it is. Beneath, the engine it keeps. Press Play to start the engine cold.`);

  const capsule = part('capsule', 'Wax capsule', `A sealed brass cup packed with a wax chosen for the temperature it melts at. Solid wax sits still; melting wax takes up between ${fixed(100 * WAX.growth[0], 0)} and ${fixed(100 * WAX.growth[1], 0)} percent more room than it did, and since the capsule cannot grow, everything that extra volume has to go somewhere pushes the piston out.`, ELEMENT.origin, system);
  const shell = flat(COLORS.brass, capsule);
  const waxBody = flat(COLORS.solid, capsule);
  const grains = Array.from({length: ELEMENT.grains}, () => flat(COLORS.liquid, capsule));

  const piston = part('piston', 'Piston and seal', `The rod the wax pushes, through a flexible seal that keeps the wax in. Its travel is the extra volume divided by the rod's own area, which is why a narrow rod moves so far for so little melting: ${fixed(1000 * pistonAt(DECLARED.meltTo, 0.12), 1)} mm of stroke out of a capsule only ${fixed(capY1 - capY0, 0)} mm deep.`, ELEMENT.origin, system);
  const rod = flat(COLORS.shell, piston);
  const seal = flat(COLORS.brass, piston);
  const travel = solidArrow(kit, COLORS.melt, piston, 0.006);

  const valve = part('valve', 'Valve disc', `The disc the piston pushes off its seat, uncovering the way to the radiator. It does not snap open: it lifts gradually as more of the wax melts, so the engine is held inside the melting range instead of being swung past it.`, ELEMENT.origin, system);
  const disc = flat(COLORS.shell, valve);

  const spring = part('spring', 'Return spring', `The spring that closes the valve again, and the only thing that puts the thermostat back. Melting wax pushes hard, but frozen wax cannot pull, so as the wax cools and shrinks it is the spring that drives the piston home. That is why a wax thermostat needs no power and cannot stick open once the engine cools.`, ELEMENT.origin, system);
  const springCoil = lineObject(33, COLORS.spring, spring);

  const flow = part('flow', 'Where the coolant goes', `While the valve is shut the water goes round the engine and nowhere else, so the engine warms as fast as it can; once the valve opens, some of it is sent through the radiator instead. The book's point is that an engine has to be kept warm as well as kept from boiling.`, ELEMENT.origin, system);
  const engineBlock = flat(COLORS.cool, flow);
  const radiator = flat(COLORS.cool, flow);
  const radiatorTubes = segmentLines(ELEMENT.tubes, COLORS.shell, flow);
  const toRadiator = solidArrow(kit, COLORS.hot, flow, 0.005);

  const chartPart = part('chart', 'The engine through the run', `What the engine reads from cold, from ${fixed(CHART.temperature[0], 0)} to ${fixed(CHART.temperature[1], 0)} °C, with a tick every ${fixed(CHART.tickEvery / 60, 0)} minutes. The pale band is where the wax melts, and the engine settles inside it: that is what a wax thermostat is for, holding the engine in the narrow range where it runs best.`, [0, 0, 0], system);
  const chartFrame = lineObject(5, COLORS.chart, chartPart);
  outline(chartFrame, CHART.x, CHART.x + CHART.w, CHART.y, CHART.y + CHART.h, 0, 1);
  const meltBand = flat(COLORS.melt, chartPart, {transparent: true, opacity: 0.22});
  const boilLine = segmentLines(1, COLORS.hot, chartPart);
  const ticks = segmentLines(Math.ceil(DECLARED.engineRun / CHART.tickEvery), COLORS.chart, chartPart);
  const guide = lineObject(DECLARED.samples, COLORS.faint, chartPart);
  const openGuide = lineObject(DECLARED.samples, COLORS.open, chartPart);
  const curve = lineObject(DECLARED.samples + 1, COLORS.hot, chartPart);
  const cursor = segmentLines(1, COLORS.chart, chartPart);
  // The chart's words: its scale at the left, the run's length under its right end, and its name and key to its right, clear of the leader that meets its top.
  const TEXT = 0.045, css = color => `#${color.toString(16).padStart(6, '0')}`;
  chartText(chartPart, (share, celsius) => [CHART.x + share * CHART.w, chartY(celsius), 0], {
    size: TEXT,
    x: {min: 0, max: 1, title: `Minutes, a tick every ${fixed(CHART.tickEvery / 60, 0)}`, ticks: [[0, '0']]},
    y: {min: CHART.temperature[0], max: CHART.temperature[1], ticks: [0, 40, 80, 120].map(celsius => [celsius, `${fixed(celsius, 0)} °C`])},
  });
  const endWord = textLabel(chartPart, '', {height: TEXT, width: TEXT * 3.5, color: css(COLORS.chart), position: [CHART.x + CHART.w, CHART.y - 1.1 * TEXT, 0.001]});
  textLabel(chartPart, 'The engine through the run', {height: TEXT, align: 'left', weight: '600', color: css(COLORS.chart), position: [CHART.x + CHART.w + 0.05, CHART.y + CHART.h - 0.03, 0.001]});
  [['Engine', COLORS.hot], ['Valve open', COLORS.open], ['Wax melts', COLORS.melt]].forEach(([text, color], i) => textLabel(chartPart, text, {height: TEXT, align: 'left', color: css(color), position: [CHART.x + CHART.w + 0.05, CHART.y + CHART.h - 0.11 - 0.065 * i, 0.001]}));
  const leader = segmentLines(1, COLORS.faint, system);

  const d = WAX_DEFAULTS, D = WAX_DOMAINS;
  control('growth', 'How much the wax grows', ...D.growth, d.growth, '%', `How much more room the wax takes up once it has melted. Its own page gives waxes ${fixed(100 * WAX.growth[0], 0)} to ${fixed(100 * WAX.growth[1], 0)} percent, and the more it grows the further the piston travels for the same melting.`);
  control('load', 'How hard the engine is working', ...D.load, d.load, 'kW', 'How much heat the engine is putting into its coolant. A harder working engine needs the valve further open to hold the same temperature.');
  control('ambient', 'Outside air', ...D.ambient, d.ambient, '°C', 'How cold the air through the radiator is. Colder air carries more heat away for the same valve opening.');
  control('start', 'Starting temperature', ...D.start, d.start, '°C', 'How cold the engine is when it is started.');

  const result = finish(v => {
    const plan = waxPlan(v), now = waxAt(plan, clock), values = plan.values;

    // The capsule, and the wax in it: solid below the melt, liquid above.
    millimeters(shell, capX0, capX1, capY0, capY1, -0.004);
    millimeters(waxBody, capX0 + ELEMENT.wall, capX1 - ELEMENT.wall, capY0 + ELEMENT.wall, capY1 - ELEMENT.wall, -0.003);
    waxBody.material.color.lerpColors(new THREE.Color(COLORS.solid), new THREE.Color(COLORS.liquid), now.melted);
    grains.forEach((grain, i) => {
      const across = capX0 + ELEMENT.wall + 1.5 + (i % 6) * 2.4, up = capY0 + ELEMENT.wall + 1.6 + Math.floor(i / 6) * 2.6;
      millimeters(grain, across - 0.7, across + 0.7, up - 0.7, up + 0.7, -0.002);
      grain.visible = i / ELEMENT.grains < now.melted;
    });

    // The piston, pushed out by exactly the stroke the physics gives.
    const stroke = 1000 * now.stroke, [rodX0, rodX1] = ELEMENT.piston;
    millimeters(rod, rodX0, rodX1, ELEMENT.pistonFrom, ELEMENT.pistonFrom + 10 + stroke, -0.002);
    millimeters(seal, ...ELEMENT.seal, -0.001);
    travel.position.set((rodX1 + 4) * MM, (ELEMENT.pistonFrom + 10) * MM, 0.001);
    travel.userData.setDirection(new THREE.Vector3(0, 1, 0));
    travel.userData.setLength(stroke * MM);

    // The valve, lifted off its seat by the piston, and the spring that returns it.
    const [valveX0, valveX1, valveThick] = ELEMENT.valve;
    millimeters(disc, valveX0, valveX1, ELEMENT.valveFrom + stroke, ELEMENT.valveFrom + stroke + valveThick, -0.002);
    const [springX, springR0, springTop, springTurns] = ELEMENT.spring;
    fillLine(springCoil, Array.from({length: 33}, (_, i) => {
      const s = i / 32, a = s * springTurns * 2 * Math.PI;
      const y = ELEMENT.valveFrom + stroke + valveThick + s * (springTop - stroke);
      return [(springX + springR0 * 0.4 * Math.sin(a)) * MM, y * MM, -0.003];
    }));

    // Where the coolant goes.
    millimeters(engineBlock, ...ELEMENT.engine, -0.004);
    millimeters(radiator, ...ELEMENT.radiator, -0.004);
    engineBlock.material.color.copy(coolantColor(now.celsius));
    radiator.material.color.copy(coolantColor(values.ambient + (now.celsius - values.ambient) * now.open));
    const [radX0, radX1, radLow, radHigh] = ELEMENT.radiator;
    fillLine(radiatorTubes, Array.from({length: ELEMENT.tubes}, (_, i) => {
      const x = radX0 + (radX1 - radX0) * (i + 0.5) / ELEMENT.tubes;
      return [[x * MM, radLow * MM, -0.003], [x * MM, radHigh * MM, -0.003]];
    }).flat());
    toRadiator.position.set((radX0 - 4) * MM, (radHigh - 6) * MM, -0.002);
    toRadiator.userData.setDirection(new THREE.Vector3(1, 0, 0));
    toRadiator.userData.setLength(now.open * 0.3);

    // The engine through the run.
    rect(meltBand, CHART.x, CHART.x + CHART.w, chartY(DECLARED.meltFrom), chartY(DECLARED.meltTo), -0.001);
    fillLine(boilLine, [[CHART.x, chartY(100), 0], [CHART.x + CHART.w, chartY(100), 0]]);
    const tickCount = Math.max(0, Math.ceil(plan.duration / CHART.tickEvery) - 1);
    endWord.userData.setText(`${fixed(plan.duration / 60, 0)}`);
    fillLine(ticks, Array.from({length: tickCount}, (_, i) => {
      const x = chartX(plan, (i + 1) * CHART.tickEvery);
      return [[x, CHART.y, 0], [x, CHART.y - CHART.tick, 0]];
    }).flat());
    fillLine(guide, plan.chart.map(sample => [chartX(plan, sample.t), chartY(sample.celsius), 0]));
    fillLine(openGuide, plan.chart.map(sample => [chartX(plan, sample.t), CHART.y + sample.open * CHART.h, 0]));
    const shown = clock > 0 ? plan.chart.filter(sample => sample.t < now.t) : [];
    fillLine(curve, clock > 0 ? [...shown.map(sample => [chartX(plan, sample.t), chartY(sample.celsius), 0]), [chartX(plan, now.t), chartY(now.celsius), 0]] : []);
    const cx = Math.min(Math.max(chartX(plan, now.t), CHART.x + CHART.cursor), CHART.x + CHART.w - CHART.cursor);
    fillLine(cursor, clock > 0 ? [[cx - CHART.cursor, chartY(now.celsius), 0], [cx + CHART.cursor, chartY(now.celsius), 0]] : []);
    fillLine(leader, [[ELEMENT.origin[0], ELEMENT.origin[1] - 0.2, 0], [CHART.x + CHART.w / 2, CHART.y + CHART.h, 0]]);

    const minutes = seconds => `${fixed(seconds / 60, 1)} min`;
    const status = clock <= 0 ? `Ready · the wax is solid, the valve shut, and every drop of coolant is going round the engine; press Play to start it cold`
      : plan.opened !== null && now.t < plan.opened ? `Warming · ${minutes(now.t)} in, the engine is at ${fixed(now.celsius, 1)} °C and the valve is still shut, which is how it warms up so quickly`
      : now.done ? (plan.climbing
        ? `Still climbing · after ${minutes(plan.duration)} the engine is at ${fixed(now.celsius, 1)} °C and still rising, with the valve ${fixed(100 * now.open, 0)}% open and ${fixed(100 * now.melted, 0)}% of the wax melted; this wax cannot open it far enough to hold the engine at all`
        : `Settled · the engine holds ${fixed(now.celsius, 1)} °C with the valve ${fixed(100 * now.open, 0)}% open and ${fixed(100 * now.melted, 0)}% of the wax melted`)
      : `Opening · ${minutes(now.t)} in, the engine reads ${fixed(now.celsius, 1)} °C and the valve is ${fixed(100 * now.open, 0)}% open`;
    return {
      state: {...plan, now, clock},
      readings: [
        r('Your result', status),
        r('Engine temperature', `${fixed(now.celsius, 1)} °C`, `The engine puts ${fixed(values.load, 0)} kW into its coolant and loses it through the radiator in proportion to how far the valve is open. It settles inside the wax's melting range, between ${fixed(DECLARED.meltFrom, 0)} and ${fixed(DECLARED.meltTo, 0)} °C, which the Wax thermostatic element page says is where these are made to work: automotive elements are built to open between ${fixed(WAX.automotive[0], 0)} and ${fixed(WAX.automotive[1], 0)} °C, and modern engines run over ${fixed(WAX.modernEngine, 0)} °C.`),
        r('Wax melted', `${fixed(100 * now.melted, 0)}%`, `Wax does not expand smoothly with temperature the way a metal does; it jumps when it melts, because a solid packs more tightly than a liquid. Across its melting range this pellet grows ${fixed(values.growth, 0)} percent, inside the ${fixed(100 * WAX.growth[0], 0)} to ${fixed(100 * WAX.growth[1], 0)} percent its page gives, and it is that jump, not ordinary expansion, that does the work.`),
        r('Piston', `${fixed(1000 * now.stroke, 2)} mm out`, `The extra volume divided by the piston's area. A ${fixed(1e9 * DECLARED.pelletVolume, 0)} mm³ pellet growing ${fixed(values.growth, 0)} percent makes ${fixed(1e9 * DECLARED.pelletVolume * values.growth / 100, 0)} mm³, and pushed through a ${fixed(1000 * DECLARED.pistonBore, 0)} mm rod that is ${fixed(1000 * pistonAt(DECLARED.meltTo, values.growth / 100), 2)} mm of travel at full melt. Its page gives these elements strokes of ${fixed(WAX.strokes[0], 1)} to ${fixed(WAX.strokes[1], 0)} mm, so this one is a real size.`),
        r('Valve', `${fixed(100 * now.open, 0)}% open`, `Not a switch, and not on or off. The valve opens gradually as more of the wax melts, so the engine is held inside the melting range instead of swinging past it. Its page says such a thermostat normally sits at about half its stroke, with room to open further or close back as the load changes.`),
        r('Return spring', `${fixed(now.spring, 0)} N`, `The spring is what makes the element reversible. Melting wax can push hard, but frozen wax cannot pull, so the spring has to do all the closing. Its page puts the biasing force at ${fixed(100 * WAX.bias[0], 0)} to ${fixed(100 * WAX.bias[1], 0)} percent of the operating force, enough to overcome the seal's friction and put the piston home as the wax freezes.`),
        r('Coolant to the radiator', `${fixed(1e6 * now.toRadiator, 0)} cm³/s`, `Shut, none of it goes to the radiator: the book and the Radiator page both say the coolant is sent back through the engine instead, which is why a cold engine warms so fast. Open, the pump sends up to ${fixed(1e6 * DECLARED.pumpFlow, 0)} cm³ a second through it, and water carries ${fixed(COOLANT.heat, 0)} J for each kilogram and degree.`),
        r('Sped up', `${fixed(DECLARED.slower, 0)} times faster`, `The run covers ${minutes(plan.duration)} of engine time and plays in ${fixed(plan.duration / DECLARED.slower, 0)} s. Everything in the element is drawn at true size, because unlike a bimetal strip or a rod and tube, a wax motor moves far enough to see.`),
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
    {label: 'Inspect: the wax capsule', part: 'capsule', view: 'front', replay: false, run() { return inspect(duration()); }},
    {label: 'Inspect: the piston', part: 'piston', view: 'front', replay: false, run() { return inspect(duration()); }},
    {label: 'Inspect: the valve', part: 'valve', view: 'front', replay: false, run() { return inspect(duration()); }},
    {label: 'Inspect: the engine', part: 'chart', view: 'front', replay: false, run() { return render(); }},
  ];
  result.playback = {
    label: 'Start the engine cold',
    description: `The engine is started cold with the valve shut, and the thermostat is left to bring it up and hold it. The run covers ${fixed(DECLARED.engineRun / 60, 0)} minutes and plays ${fixed(DECLARED.slower, 0)} times faster than the real thing.`,
    stepLabel: `Advance ${fixed(CHART.tickEvery / 60, 0)} min`,
    advance: result.advance,
    step: () => result.advance(CHART.tickEvery / DECLARED.slower),
    complete: () => clock >= duration(),
    blocked: () => false,
  };
  result.resultPart = {id: 'chart', label: 'Inspect the engine', view: 'front', focusOnComplete: false, available: () => clock >= duration()};

  kit.root.rotation.set(0.04, -0.06, 0);
  result.initialPart = 'system';
  result.initialView = 'front';
  result.frameVisibleOnly = true;
  result.framePadding = 0.6;
  result.selectionOutline = false;
  result.transparentBackground = true;
  result.topology = {system, capsule, shell, waxBody, grains, piston, rod, seal, travel, valve, disc, spring, springCoil, flow, engineBlock, radiator, radiatorTubes, toRadiator, chartPart, chartFrame, meltBand, boilLine, ticks, guide, openGuide, curve, cursor, leader};
  const dispose = result.dispose;
  result.dispose = () => { if (!disposed) { disposed = true; dispose(); } };
  return result;
}

import * as THREE from 'three';
import {houseModel, reading as r} from './house-model-kit.js';
import {fixed} from './format.js';
import {clamp} from './physics-kit.js';
import {chartText, fillLine, lineObject, segmentLines, solidArrow, textLabel} from './scene-kit.js';
import {panel, wireColor, glowOpacity} from './element-scene.js';
import {
  heaterPlan, heaterAt, resistanceAt, specificAt, HEATER_DEFAULTS, HEATER_DOMAINS, HEATER_DIAMETER, REFLECTORS,
  DECLARED, DRAPER, NIKROTHAL, SIGMA, MAINS,
} from './element-physics.js';

// ---------------------------------------------------------------------------
// Electric heating: a bar heater cut through from the side, its element glowing
// in front of a reflector, the heat leaving it, and its warm up.
//
// Scale: the heater is drawn at true size, 1 mm to 0.002 scene units, its case
// 600 by 260 mm and everything in it illustrative in size and place, except the
// element's coil, whose 14 mm width is true and whose 0.4 mm wire is drawn 25
// times thicker so that it can be seen at all. Said in the part text and in a
// reading. The chart is not to scale.
//
// Time: the run lasts 120 s, long enough that even the coolest element in its
// range has settled by the end, and plays 8 times faster than the real thing,
// said in the part text and in a reading.
// ---------------------------------------------------------------------------

export const MM = 0.002;
/** How many times thicker than its true 0.4 mm the element's wire is drawn. */
export const WIRE_TIMES = 25;

/** The heater, mm about the middle of its case. */
export const HEATER = Object.freeze({
  origin: Object.freeze([-0.25, 0.42, 0]),
  casing: Object.freeze([600, 260]),
  element: Object.freeze([70, 0, 14]),
  reflector: Object.freeze({x: -170, depth: 150, height: 210, points: 41}),
  guard: Object.freeze([240, -110, 110]), bars: 5,
  feet: Object.freeze([-200, 200, -150, -130]),
  beams: 9, beam: Object.freeze([0.02, 0.5]),
});

/** The element's warm up: where the chart sits, its size, and what it spans. */
export const CHART = Object.freeze({
  x: -0.98, y: -0.72, w: 1.96, h: 0.78,
  temperature: Object.freeze([0, 1300]), tickEvery: 30, tick: 0.022, mark: 0.03, cursor: 0.022,
});

export const COLORS = Object.freeze({
  casing: 0xe9e4d8, shell: 0x2f3336, metal: 0xb4c5b0, faint: 0x9aa39a, chart: 0x374736,
  reflector: 0xd8d8cf, guard: 0x8e948c, beam: 0xe07a3c, draper: 0xc14f39, limit: 0x7d5ba6, cold: 0x3f7fbf,
});

/** The radiated power at which a heat arrow reaches its full drawn length, W: a stated scale, so a weak element draws short arrows and a strong one long ones. */
export const BEAM_FULL = 1800;

/** Where a time and a temperature fall on the chart. */
export const chartX = (plan, t) => CHART.x + clamp(t / plan.duration) * CHART.w;
export const chartY = celsius => CHART.y + clamp((celsius - CHART.temperature[0]) / (CHART.temperature[1] - CHART.temperature[0])) * CHART.h;

export function createElectricHeatingModel() {
  const kit = houseModel('Electric heating'), {part, control, finish} = kit;
  const {flat, rect, millimeters, outline, circlePoints} = panel(MM);
  let clock = 0, lastClock = 0, disposed = false;

  const [caseW, caseH] = HEATER.casing;
  const system = part('system', 'Electric heater, cut through', `A bar heater cut through from the side at true size, ${fixed(caseW, 0)} mm by ${fixed(caseH, 0)} mm: the coiled element, the reflector behind it, the guard in front, and the heat leaving it. Beneath, the element's warm up. Press Play to switch it on.`);

  const body = part('body', 'Case and feet', `The case that holds the element clear of everything and stands it on the floor. Nothing in here but air, a reflector and a piece of wire: an electric heater has no moving part at all, which is why it is the one machine in the house that is exactly as efficient as it looks.`, HEATER.origin, system);
  const board = flat(COLORS.casing, body);
  millimeters(board, -caseW / 2, caseW / 2, -caseH / 2, caseH / 2, -0.01);
  const caseLine = lineObject(5, COLORS.shell, body);
  outline(caseLine, -caseW / 2, caseW / 2, -caseH / 2, caseH / 2, -0.008);
  const feet = flat(COLORS.shell, body);
  millimeters(feet, ...HEATER.feet, -0.007);

  const reflector = part('reflector', 'Reflector', `The polished dish behind the element. Radiation leaving the element backward would warm the wall; the reflector turns it round and sends it into the room instead, which is why a heater with one puts far more of its warmth where you are sitting without burning a watt more.`, HEATER.origin, system);
  const dish = lineObject(HEATER.reflector.points, COLORS.reflector, reflector);
  const dishFill = flat(COLORS.reflector, reflector);

  const element = part('element', 'Resistance element', `The one part that does the work: a coil of ${NIKROTHAL.name} wire ${fixed(1000 * HEATER_DIAMETER, 1)} mm thick, drawn ${WIRE_TIMES} times thicker here so that it can be seen. Current through it turns electrical energy into heat, and above the Draper point of ${fixed(DRAPER.celsius, 0)} °C it glows with it. Its color follows the temperature the model works out.`, HEATER.origin, system);
  const [elementX, elementY, elementR] = HEATER.element;
  const halo = flat(COLORS.beam, element, {transparent: true, opacity: 0});
  const coil = lineObject(49, COLORS.beam, element);
  const turns = segmentLines(7, COLORS.beam, element);

  const guard = part('guard', 'Guard', 'The bars across the front, far enough from the element that nothing resting against them can touch it. They take a little of the heat and pass it on, and they are the reason a bar heater can stand in a room at all.', HEATER.origin, system);
  const bars = segmentLines(HEATER.bars, COLORS.guard, guard);

  const beamPart = part('beam', 'Heat leaving the element', `What the element sends out, drawn as arrows from it: their length is the power going that way, all on one scale, an arrow reaching its full length at ${fixed(BEAM_FULL, 0)} W of radiation. With the reflector fitted, the arrows that would point back at the wall are turned round and join the ones going into the room.`, HEATER.origin, system);
  const beams = Array.from({length: HEATER.beams}, () => solidArrow(kit, COLORS.beam, beamPart, 0.006));

  const chartPart = part('chart', 'The element warming up', `The element's temperature from the moment it is switched on, from ${fixed(CHART.temperature[0], 0)} to ${fixed(CHART.temperature[1], 0)} °C, with a tick every ${fixed(CHART.tickEvery, 0)} s. The lower line is the Draper point, where it starts to glow; the upper one is the ${fixed(NIKROTHAL.continuous, 0)} °C its datasheet lets it run at.`, [0, 0, 0], system);
  const chartFrame = lineObject(5, COLORS.chart, chartPart);
  outline(chartFrame, CHART.x, CHART.x + CHART.w, CHART.y, CHART.y + CHART.h, 0, 1);
  const draperLine = segmentLines(1, COLORS.draper, chartPart), limitLine = segmentLines(1, COLORS.limit, chartPart);
  const ticks = segmentLines(Math.ceil(DECLARED.heaterRun / CHART.tickEvery), COLORS.chart, chartPart);
  const guideCurve = lineObject(DECLARED.samples, COLORS.faint, chartPart);
  const curve = lineObject(DECLARED.samples + 1, COLORS.beam, chartPart);
  const cursor = segmentLines(1, COLORS.chart, chartPart);
  // The chart's words: its scale at the left, the run's length under its right end, and its name and key to its right, clear of the leader that meets its top.
  const TEXT = 0.045, css = color => `#${color.toString(16).padStart(6, '0')}`;
  chartText(chartPart, (share, celsius) => [CHART.x + share * CHART.w, chartY(celsius), 0], {
    size: TEXT,
    x: {min: 0, max: 1, title: `Seconds, a tick every ${fixed(CHART.tickEvery, 0)}`, ticks: [[0, '0']]},
    y: {min: CHART.temperature[0], max: CHART.temperature[1], ticks: [0, 400, 800, 1200].map(celsius => [celsius, `${fixed(celsius, 0)} °C`])},
  });
  const endWord = textLabel(chartPart, '', {height: TEXT, width: TEXT * 3.5, color: css(COLORS.chart), position: [CHART.x + CHART.w, CHART.y - 1.1 * TEXT, 0.001]});
  textLabel(chartPart, 'The element warming up', {height: TEXT, align: 'left', weight: '600', color: css(COLORS.chart), position: [CHART.x + CHART.w + 0.05, CHART.y + CHART.h - 0.03, 0.001]});
  [['Element', COLORS.beam], ['Starts to glow', COLORS.draper], ['Datasheet limit', COLORS.limit]].forEach(([text, color], i) => textLabel(chartPart, text, {height: TEXT, align: 'left', color: css(color), position: [CHART.x + CHART.w + 0.05, CHART.y + CHART.h - 0.11 - 0.065 * i, 0.001]}));
  const leader = segmentLines(1, COLORS.faint, system);

  const d = HEATER_DEFAULTS, D = HEATER_DOMAINS;
  control('volts', 'Supply voltage', ...D.volts, d.volts, 'V', `What the socket puts across the element. The Mains electricity page gives ${fixed(MAINS.volts, 0)} V in much of the world and ${fixed(MAINS.americanVolts, 0)} V in North America.`);
  control('length', 'Element length', ...D.length, d.length, 'm', 'How much wire is wound into the coil. More wire is more resistance, and at a fixed voltage more resistance is less power, so a longer element is a cooler one.');
  control('reflector', 'Reflector', ...D.reflector, d.reflector, '', 'Whether the polished dish behind the element is fitted. It changes where the radiation goes, not how much there is.', REFLECTORS);
  control('room', 'Room temperature', ...D.room, d.room, '°C', 'How warm the room the element is radiating into is. It sets where the element starts and how much of its heat the room takes back.');

  const result = finish(v => {
    const plan = heaterPlan(v), now = heaterAt(plan, clock), values = plan.values;
    const color = wireColor(now.celsius);

    // The element: a coil seen end on, glowing at its own temperature.
    fillLine(coil, circlePoints(elementX, elementY, elementR, 49, -0.004));
    coil.material.color.copy(color);
    fillLine(turns, Array.from({length: 7}, (_, i) => {
      const a = Math.PI * i / 7;
      return [[(elementX + elementR * Math.cos(a)) * MM, (elementY + elementR * Math.sin(a)) * MM, -0.004], [(elementX - elementR * Math.cos(a)) * MM, (elementY - elementR * Math.sin(a)) * MM, -0.004]];
    }).flat());
    turns.material.color.copy(color);
    const haloR = elementR * (1 + WIRE_TIMES * HEATER_DIAMETER * 1000 / (2 * elementR));
    millimeters(halo, elementX - haloR, elementX + haloR, elementY - haloR, elementY + haloR, -0.005);
    halo.material.color.copy(color);
    halo.material.opacity = glowOpacity(now.celsius);

    // The reflector, fitted or not.
    const {x: dishX, depth, height, points} = HEATER.reflector;
    const arc = Array.from({length: points}, (_, i) => {
      const share = i / (points - 1), y = (share - 0.5) * height;
      return [(dishX + depth * (1 - (2 * (share - 0.5)) ** 2)) * MM, y * MM, -0.006];
    });
    fillLine(dish, arc);
    dish.visible = values.reflector === 1;
    dishFill.visible = values.reflector === 1;
    millimeters(dishFill, dishX, dishX + depth, -height / 2, height / 2, -0.007);

    // The guard.
    const [guardX, guardLow, guardHigh] = HEATER.guard;
    fillLine(bars, Array.from({length: HEATER.bars}, (_, i) => {
      const y = guardLow + (guardHigh - guardLow) * i / (HEATER.bars - 1);
      return [[guardX * MM, y * MM, -0.003], [(guardX + 60) * MM, y * MM, -0.003]];
    }).flat());

    // The heat leaving: arrows on one scale, the rearward ones turned round by the reflector.
    const [thinnest, longest] = HEATER.beam;
    const share = clamp(now.radiated / BEAM_FULL);
    beams.forEach((arrow, i) => {
      const spread = Math.PI * (i / (HEATER.beams - 1) - 0.5) * 1.6;
      const backward = Math.abs(spread) > Math.PI / 2 - 1e-9;
      const turned = backward && values.reflector === 1;
      const angle = turned ? Math.sign(spread || 1) * (Math.PI - Math.abs(spread)) : spread;
      arrow.position.set(elementX * MM, elementY * MM, -0.002);
      arrow.userData.setDirection(new THREE.Vector3(Math.cos(angle), Math.sin(angle), 0));
      arrow.userData.setLength(now.radiated > 0 ? thinnest + longest * share : 0);
    });

    // The chart.
    fillLine(draperLine, [[CHART.x, chartY(DRAPER.celsius), 0], [CHART.x + CHART.w, chartY(DRAPER.celsius), 0]]);
    fillLine(limitLine, [[CHART.x, chartY(NIKROTHAL.continuous), 0], [CHART.x + CHART.w, chartY(NIKROTHAL.continuous), 0]]);
    const tickCount = Math.max(0, Math.ceil(plan.duration / CHART.tickEvery) - 1);
    endWord.userData.setText(`${fixed(plan.duration, 0)}`);
    fillLine(ticks, Array.from({length: tickCount}, (_, i) => {
      const x = chartX(plan, (i + 1) * CHART.tickEvery);
      return [[x, CHART.y, 0], [x, CHART.y - CHART.tick, 0]];
    }).flat());
    fillLine(guideCurve, plan.chart.map(sample => [chartX(plan, sample.t), chartY(sample.celsius), 0]));
    const shown = clock > 0 ? plan.chart.filter(sample => sample.t < now.t) : [];
    fillLine(curve, clock > 0 ? [...shown.map(sample => [chartX(plan, sample.t), chartY(sample.celsius), 0]), [chartX(plan, now.t), chartY(now.celsius), 0]] : []);
    const cx = Math.min(Math.max(chartX(plan, now.t), CHART.x + CHART.cursor), CHART.x + CHART.w - CHART.cursor);
    fillLine(cursor, clock > 0 ? [[cx - CHART.cursor, chartY(now.celsius), 0], [cx + CHART.cursor, chartY(now.celsius), 0]] : []);
    fillLine(leader, [[HEATER.origin[0], HEATER.origin[1] - (caseH / 2 + 30) * MM, 0], [CHART.x + CHART.w / 2, CHART.y + CHART.h, 0]]);

    const status = values.volts === 0 ? 'Ready · nothing is across the element, so nothing happens; turn the supply up and press Play'
      : clock <= 0 ? `Ready · at ${fixed(values.volts, 0)} V this element will settle at ${fixed(plan.steady, 0)} °C and ${fixed(plan.power, 0)} W; press Play to switch it on`
      : now.done ? `Settled · the element holds ${fixed(now.celsius, 0)} °C, giving out ${fixed(now.power, 0)} W${plan.tooHot ? `, hotter than the ${fixed(NIKROTHAL.continuous, 0)} °C its datasheet allows` : ''}`
      : `Warming · ${fixed(now.t, 1)} s in, the element reads ${fixed(now.celsius, 0)} °C and ${now.glows ? 'has begun to glow' : 'is not glowing yet'}`;
    return {
      state: {...plan, now, clock},
      readings: [
        r('Your result', status),
        r('Element power', `${fixed(now.power, 0)} W`, `Joule's law: the power is the voltage squared over the resistance, ${fixed(values.volts, 0)} V across ${fixed(now.resistance, 1)} Ω. The wire's resistance rises as it warms, by the factor its datasheet tabulates, so the power settles ${fixed(100 * (1 - plan.drift), 1)}% below the ${fixed(plan.coldPower, 0)} W it draws cold.`),
        r('Element temperature', `${fixed(now.celsius, 0)} °C`, `The wire warms until what it loses matches what it takes. It holds ${fixed(1000 * plan.wire.mass, 1)} g of wire, and the datasheet's specific heat makes that ${fixed(plan.wire.mass * specificAt(values.room), 1)} J for each degree near room temperature, which is why so little metal comes up to temperature so fast. The Draper point is ${fixed(DRAPER.celsius, 0)} °C and the datasheet allows ${fixed(NIKROTHAL.continuous, 0)} °C continuously.`),
        r('Current', `${fixed(now.current, 2)} A`, `The voltage over the resistance. The element is ${fixed(values.length, 1)} m of ${fixed(1000 * HEATER_DIAMETER, 1)} mm wire, which at the datasheet's ${fixed(1e6 * NIKROTHAL.resistivity, 2)} Ω·mm²/m is ${fixed(resistanceAt(plan.wire, values.room), 1)} Ω cold.`),
        r('Radiated', `${fixed(now.radiated, 0)} W`, `Stefan and Boltzmann: a surface gives out its emissivity times ${fixed(SIGMA * 1e8, 3)} × 10⁻⁸ W/(m²·K⁴) times its area times the fourth power of its temperature, less what the room sends back. The datasheet gives fully oxidized wire an emissivity of ${fixed(NIKROTHAL.emissivity, 2)}, and this coil has ${fixed(1e4 * plan.wire.surface, 0)} cm² of surface. The fourth power is why the radiated share climbs so steeply as the element heats.`),
        r('Carried off by the air', `${fixed(now.convected, 0)} W`, `Still air next to the wire warms and rises, carrying heat with it. The model takes that as ${fixed(DECLARED.still, 0)} W from each square meter for each degree the wire stands above the room, which is a stated figure, not a measured one. At the settled temperature it is ${fixed(100 * (1 - plan.radiantShare), 0)}% of the element's output, and radiation is the other ${fixed(100 * plan.radiantShare, 0)}%.`),
        r('Sent into the room', `${fixed(now.forward, 0)} W`, `${values.reflector ? `With the reflector fitted, ${fixed(100 * DECLARED.reflected, 0)}% of the radiation goes forward instead of ${fixed(100 * DECLARED.bare, 0)}%. That is a stated share, not a measured one, and it moves heat about rather than making any.` : `Without a reflector only ${fixed(100 * DECLARED.bare, 0)}% of the radiation heads into the room; the rest warms the wall behind. Fitting one would send ${fixed(100 * DECLARED.reflected, 0)}% forward, ${fixed(plan.settled.radiated * (DECLARED.reflected - DECLARED.bare), 0)} W more, for no more electricity at all.`}`),
        r('Where the electricity goes', '100% into the room', `Every watt the element takes becomes heat in the room, radiated or carried by the air, which is what the Electric heating page means when it says electric space heating is 100% efficient for the customer. It also says a heat pump moves ${fixed(1.5, 1)} to ${fixed(6, 0)} times as much heat as the electricity it uses, which no resistance wire can do.`),
        r('Warm-up', `${fixed(plan.steady, 0)} °C, reached in ${fixed(plan.duration, 0)} s`, `A thin wire has almost no heat to store, so it comes up fast and drops back just as fast: this element is past the Draper point within seconds of being switched on. The run is given ${fixed(DECLARED.heaterRun, 0)} s because the coolest elements in this range, which lose their heat almost entirely to the air rather than by radiation, take over a minute to stop climbing.`),
        r('Scale', `wire drawn ${WIRE_TIMES} times thicker`, `The heater is drawn at true size, ${fixed(caseW, 0)} mm by ${fixed(caseH, 0)} mm, and the element's coil is its true ${fixed(2 * HEATER.element[2], 0)} mm across; only the wire itself is drawn ${WIRE_TIMES} times thicker than its ${fixed(1000 * HEATER_DIAMETER, 1)} mm, so that it can be seen at all. The run plays ${fixed(DECLARED.heaterFaster, 0)} times faster than the real thing.`),
      ],
    };
  });

  const render = result.update;
  const duration = () => result.getState().duration;
  result.advance = dt => { if (Number.isFinite(dt) && dt > 0) clock = Math.min(duration(), clock + dt * DECLARED.heaterFaster); return render(); };
  result.animate = t => { const dt = Number.isFinite(t) ? Math.max(0, t - lastClock) : 0; if (Number.isFinite(t)) lastClock = t; return result.advance(dt); };
  result.reset = () => { clock = 0; lastClock = 0; return render(result.defaults); };
  const inspect = time => { clock = Math.min(duration(), time); return render(); };
  result.actions = [
    {label: 'Inspect: the element', part: 'element', view: 'front', replay: false, run() { return inspect(duration()); }},
    {label: 'Inspect: the reflector', part: 'reflector', view: 'front', replay: false, run() { return inspect(duration()); }},
    {label: 'Inspect: where the heat goes', part: 'beam', view: 'front', replay: false, run() { return inspect(duration()); }},
    {label: 'Inspect: the warm up', part: 'chart', view: 'front', replay: false, run() { return render(); }},
  ];
  result.playback = {
    label: 'Switch it on',
    description: `The element is switched on cold and warms until what it loses matches what it takes. The run lasts ${fixed(DECLARED.heaterRun, 0)} s and plays ${fixed(DECLARED.heaterFaster, 0)} times faster than the real thing.`,
    stepLabel: `Advance ${fixed(CHART.tickEvery, 0)} s`,
    advance: result.advance,
    step: () => result.advance(CHART.tickEvery / DECLARED.heaterFaster),
    complete: () => clock >= duration(),
    blocked: () => result.getState().values.volts === 0,
  };
  result.resultPart = {id: 'chart', label: 'Inspect the warm up', view: 'front', focusOnComplete: false, available: () => clock >= duration()};

  kit.root.rotation.set(0.04, -0.06, 0);
  result.initialPart = 'system';
  result.initialView = 'front';
  result.frameVisibleOnly = true;
  result.framePadding = 0.6;
  result.selectionOutline = false;
  result.transparentBackground = true;
  result.topology = {system, body, board, caseLine, feet, reflector, dish, dishFill, element, halo, coil, turns, guard, bars, beamPart, beams, chartPart, chartFrame, draperLine, limitLine, ticks, guideCurve, curve, cursor, leader};
  const dispose = result.dispose;
  result.dispose = () => { if (!disposed) { disposed = true; dispose(); } };
  return result;
}

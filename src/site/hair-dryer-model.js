import * as THREE from 'three';
import {houseModel, reading as r} from './house-model-kit.js';
import {fixed} from './format.js';
import {clamp} from './physics-kit.js';
import {fillLine, lineObject, segmentLines, solidArrow} from './scene-kit.js';
import {panel, wireColor, glowOpacity} from './element-scene.js';
import {
  dryerPlan, dryerAt, DRYER_DEFAULTS, DRYER_DOMAINS, DRYER_WIRE, BLOCKED,
  DECLARED, DRAPER, NIKROTHAL, AIR, RATED, MAINS,
} from './element-physics.js';

// ---------------------------------------------------------------------------
// Hair dryer: the dryer cut open along its barrel at true size, the fan behind
// the element, the air taking the element's heat out of the nozzle, and the
// switch that opens when the air stops.
//
// Scale: the dryer is drawn at true size, 1 mm to 0.002 scene units, its barrel
// 200 mm long and 78 mm across, everything inside it illustrative in size and
// place. The element's 0.4 mm wire is drawn far thicker so that it can be seen.
// The chart is not to scale.
//
// Time: the run plays at life size, one second for one second, because a dryer
// reaches its outlet temperature in a few seconds.
// ---------------------------------------------------------------------------

export const MM = 0.002;

/** The dryer, mm about the middle of its barrel. */
export const DRYER = Object.freeze({
  origin: Object.freeze([-0.62, 0.45, 0]),
  barrel: Object.freeze([-100, 100, -39, 39]),
  handle: Object.freeze([[-60, -39], [-52, -150], [-6, -150], [-14, -39]]),
  fan: Object.freeze([-62, 0, 30]), blades: 7,
  element: Object.freeze([-14, 62, 0]), coils: 11, coilR: 26,
  cutout: Object.freeze([70, 30]), strip: Object.freeze([28, 4]),
  nozzle: Object.freeze([100, 130, -26, 26]),
  inlet: Object.freeze([-140, 0]), marks: 9,
});

/** The run: where the chart sits, its size, and what it spans. */
export const CHART = Object.freeze({
  x: -0.06, y: -0.72, w: 1.9, h: 0.78,
  temperature: Object.freeze([0, 240]), tickEvery: 5, tick: 0.022, mark: 0.03, cursor: 0.022,
});

export const COLORS = Object.freeze({
  casing: 0xe9e4d8, shell: 0x2f3336, metal: 0xb4c5b0, faint: 0x9aa39a, chart: 0x374736,
  cool: 0x83b4c1, warm: 0xe07a3c, gold: 0xe3b45e, open: 0xc14f39, limit: 0x7d5ba6,
});

export const chartX = (plan, t) => CHART.x + clamp(t / plan.duration) * CHART.w;
export const chartY = celsius => CHART.y + clamp((celsius - CHART.temperature[0]) / (CHART.temperature[1] - CHART.temperature[0])) * CHART.h;

const cool = new THREE.Color(COLORS.cool), warm = new THREE.Color(COLORS.warm);
/** The color of air at `celsius`, from room temperature to the hottest the outlet reaches. */
export const airColor = celsius => cool.clone().lerp(warm, clamp((celsius - 20) / 100));

export function createHairDryerModel() {
  const kit = houseModel('Hair dryer'), {part, control, finish} = kit;
  const {flat, rect, millimeters, outline, circlePoints} = panel(MM);
  let clock = 0, lastClock = 0, disposed = false;

  const [barX0, barX1, barY0, barY1] = DRYER.barrel;
  const system = part('system', 'Hair dryer, cut open', `A dryer cut open along its barrel at true size, ${fixed(barX1 - barX0, 0)} mm long and ${fixed(barY1 - barY0, 0)} mm across: the fan at the back, the element in front of it, the nozzle the air leaves by, and the switch that opens if the air ever stops. Beneath, the run. Press Play to switch it on.`);

  const body = part('body', 'Barrel, handle and nozzle', 'The shell that makes the air go one way: in at the back, past the element, out of the nozzle. Everything the dryer does depends on that one path staying open.', DRYER.origin, system);
  const board = flat(COLORS.casing, body);
  millimeters(board, barX0, barX1, barY0, barY1, -0.01);
  const barrelLine = lineObject(5, COLORS.shell, body);
  outline(barrelLine, barX0, barX1, barY0, barY1, -0.008);
  const handle = lineObject(DRYER.handle.length + 1, COLORS.shell, body);
  fillLine(handle, [...DRYER.handle, DRYER.handle[0]].map(([x, y]) => [x * MM, y * MM, -0.008]));
  const nozzle = flat(COLORS.metal, body);
  millimeters(nozzle, ...DRYER.nozzle, -0.007);

  const fanPart = part('fan', 'Fan', `The fan behind the element, turned by a small motor. It is what makes a dryer a dryer: without air moving past it the element has nowhere to send its heat. The element is not let on until the fan is up to speed.`, DRYER.origin, system);
  const [fanX, fanY, fanR] = DRYER.fan;
  const fanRing = lineObject(33, COLORS.metal, fanPart);
  fillLine(fanRing, circlePoints(fanX, fanY, fanR, 33, -0.006));
  const rotor = new THREE.Group();
  rotor.position.set(fanX * MM, fanY * MM, -0.005);
  fanPart.add(rotor);
  const blades = segmentLines(DRYER.blades, COLORS.metal, rotor);
  fillLine(blades, Array.from({length: DRYER.blades}, (_, i) => {
    const a = 2 * Math.PI * i / DRYER.blades;
    return [[0, 0, 0], [fanR * 0.86 * Math.cos(a) * MM, fanR * 0.86 * Math.sin(a) * MM, 0]];
  }).flat());
  const inletArrow = solidArrow(kit, COLORS.cool, fanPart, 0.007);
  inletArrow.position.set(DRYER.inlet[0] * MM, DRYER.inlet[1] * MM, -0.004);
  inletArrow.userData.setDirection(new THREE.Vector3(1, 0, 0));

  const element = part('element', 'Heating element', `A long coil of bare ${NIKROTHAL.name} wire wound on insulators, sitting right in the airflow. The Hair dryer page describes exactly this: a bare coiled nichrome wire on mica, chosen for its high resistivity and because it does not corrode when heated.`, DRYER.origin, system);
  const coil = lineObject(4 * DRYER.coils + 1, COLORS.warm, element);
  const glow = flat(COLORS.warm, element, {transparent: true, opacity: 0});

  const cutoutPart = part('cutout', 'Thermal cutout', `A bimetal switch clamped where it feels the element's heat. If the air stops, the element has nothing to carry its heat away and climbs; at ${fixed(DECLARED.dryerOpen, 0)} °C the switch opens, and as it cools back to ${fixed(DECLARED.dryerClose, 0)} °C it closes again. The Thermal cutoff page calls that a thermal switch, and distinguishes it from a thermal fuse, which opens once and never closes.`, DRYER.origin, system);
  const strip = flat(COLORS.gold, cutoutPart);
  const contacts = segmentLines(2, COLORS.shell, cutoutPart);

  const airPart = part('air', 'The air', `The air the fan pushes past the element, drawn as marks that carry the temperature they have reached. Everything the element gives up ends in this air: the more of it goes by each second, the less each kilogram is warmed.`, DRYER.origin, system);
  const marks = Array.from({length: DRYER.marks}, () => flat(COLORS.cool, airPart));
  const outletArrow = solidArrow(kit, COLORS.warm, airPart, 0.008);
  outletArrow.position.set((DRYER.nozzle[1] + 10) * MM, 0, -0.004);
  outletArrow.userData.setDirection(new THREE.Vector3(1, 0, 0));

  const chartPart = part('chart', 'The run', `The element's temperature on the pale curve and the air leaving the nozzle on the dark one, from ${fixed(CHART.temperature[0], 0)} to ${fixed(CHART.temperature[1], 0)} °C, with a tick every ${fixed(CHART.tickEvery, 0)} s. The violet line is where the cutout opens.`, [0, 0, 0], system);
  const chartFrame = lineObject(5, COLORS.chart, chartPart);
  outline(chartFrame, CHART.x, CHART.x + CHART.w, CHART.y, CHART.y + CHART.h, 0, 1);
  const openLine = segmentLines(1, COLORS.limit, chartPart), closeLine = segmentLines(1, COLORS.faint, chartPart);
  const ticks = segmentLines(Math.ceil(DECLARED.dryerRun / CHART.tickEvery), COLORS.chart, chartPart);
  const guideWire = lineObject(DECLARED.samples, COLORS.faint, chartPart), guideOutlet = lineObject(DECLARED.samples, COLORS.faint, chartPart);
  const curveWire = lineObject(DECLARED.samples + 1, COLORS.warm, chartPart), curveOutlet = lineObject(DECLARED.samples + 1, COLORS.chart, chartPart);
  const openMark = segmentLines(1, COLORS.open, chartPart), cursor = segmentLines(2, COLORS.chart, chartPart);
  const leader = segmentLines(1, COLORS.faint, system);

  const d = DRYER_DEFAULTS, D = DRYER_DOMAINS;
  control('volts', 'Supply voltage', ...D.volts, d.volts, 'V', `What the socket puts across the element. The Mains electricity page gives ${fixed(MAINS.volts, 0)} V in much of the world and ${fixed(MAINS.americanVolts, 0)} V in North America.`);
  control('airflow', 'Airflow', ...D.airflow, d.airflow, 'L/s', 'How much air the fan pushes past the element each second. The same heat shared among less air is hotter air, and a hotter element behind it.');
  control('room', 'Room temperature', ...D.room, d.room, '°C', 'How warm the air going in is. Everything the element does is added on top of it.');
  control('blocked', 'The inlet', ...D.blocked, d.blocked, '', 'Whether the air can get in at all. Blocked, there is nothing to carry the element’s heat away, which is the condition the cutout exists for.', BLOCKED);

  const result = finish(v => {
    const plan = dryerPlan(v), now = dryerAt(plan, clock), values = plan.values;
    const color = wireColor(now.celsius);

    // The fan, turning at the speed the air says.
    rotor.rotation.z = -clock * (now.flow / 6 + 1);
    inletArrow.userData.setLength(plan.blocked ? 0 : 0.02 + 0.6 * now.flow / D.airflow[1]);

    // The element.
    const [ex0, ex1, ey] = DRYER.element;
    fillLine(coil, Array.from({length: 4 * DRYER.coils + 1}, (_, i) => {
      const share = i / (4 * DRYER.coils), angle = share * DRYER.coils * 2 * Math.PI;
      return [(ex0 + (ex1 - ex0) * share) * MM, (ey + DRYER.coilR * Math.sin(angle)) * MM, -0.004];
    }));
    coil.material.color.copy(color);
    millimeters(glow, ex0 - 8, ex1 + 8, ey - DRYER.coilR - 6, ey + DRYER.coilR + 6, -0.005);
    glow.material.color.copy(color);
    glow.material.opacity = glowOpacity(now.celsius);

    // The cutout: its strip bends and its contacts part when it opens.
    const [cutX, cutY] = DRYER.cutout, [stripLong, stripThick] = DRYER.strip;
    const open = !now.on && clock > 0;
    millimeters(strip, cutX - stripLong / 2, cutX + stripLong / 2, cutY + (open ? 6 : 0), cutY + (open ? 6 : 0) + stripThick, -0.004);
    fillLine(contacts, [
      [(cutX - 7) * MM, (cutY - 9) * MM, -0.003], [(cutX - 7) * MM, (cutY - 1) * MM, -0.003],
      [(cutX + 7) * MM, (cutY - 9) * MM, -0.003], [(cutX + 7) * MM, (cutY - 1 - (open ? 7 : 0)) * MM, -0.003],
    ]);
    strip.material.color.setHex(open ? COLORS.open : COLORS.gold);

    // The air: marks riding down the barrel, each carrying the temperature it has reached.
    marks.forEach((mark, i) => {
      const phase = ((clock * Math.max(0.2, now.flow / 20) + i / DRYER.marks) % 1);
      const x = barX0 - 30 + phase * (DRYER.nozzle[1] + 40 - barX0 + 30);
      const past = x > ex0;
      const celsius = past ? values.room + (now.outlet - values.room) * clamp((x - ex0) / (ex1 - ex0)) : values.room;
      millimeters(mark, x - 7, x + 7, -6, 6, -0.003);
      mark.visible = !plan.blocked;
      mark.material.color.copy(airColor(celsius));
    });
    outletArrow.userData.setLength(plan.blocked ? 0 : 0.02 + 0.5 * clamp((now.outlet - values.room) / 90));

    // The chart.
    fillLine(openLine, [[CHART.x, chartY(DECLARED.dryerOpen), 0], [CHART.x + CHART.w, chartY(DECLARED.dryerOpen), 0]]);
    fillLine(closeLine, [[CHART.x, chartY(DECLARED.dryerClose), 0], [CHART.x + CHART.w, chartY(DECLARED.dryerClose), 0]]);
    const tickCount = Math.max(0, Math.ceil(plan.duration / CHART.tickEvery) - 1);
    fillLine(ticks, Array.from({length: tickCount}, (_, i) => {
      const x = chartX(plan, (i + 1) * CHART.tickEvery);
      return [[x, CHART.y, 0], [x, CHART.y - CHART.tick, 0]];
    }).flat());
    fillLine(guideWire, plan.chart.map(sample => [chartX(plan, sample.t), chartY(sample.celsius), 0]));
    fillLine(guideOutlet, plan.chart.map(sample => [chartX(plan, sample.t), chartY(sample.outlet), 0]));
    const shown = clock > 0 ? plan.chart.filter(sample => sample.t < now.t) : [];
    fillLine(curveWire, clock > 0 ? [...shown.map(sample => [chartX(plan, sample.t), chartY(sample.celsius), 0]), [chartX(plan, now.t), chartY(now.celsius), 0]] : []);
    fillLine(curveOutlet, clock > 0 ? [...shown.map(sample => [chartX(plan, sample.t), chartY(sample.outlet), 0]), [chartX(plan, now.t), chartY(now.outlet), 0]] : []);
    openMark.visible = plan.opened !== null;
    if (plan.opened !== null) fillLine(openMark, [[chartX(plan, plan.opened), CHART.y, 0], [chartX(plan, plan.opened), CHART.y + CHART.mark, 0]]);
    const cx = Math.min(Math.max(chartX(plan, now.t), CHART.x + CHART.cursor), CHART.x + CHART.w - CHART.cursor);
    const mark = y => [[cx - CHART.cursor, y, 0], [cx + CHART.cursor, y, 0]];
    fillLine(cursor, clock > 0 ? [...mark(chartY(now.celsius)), ...mark(chartY(now.outlet))] : []);
    fillLine(leader, [[DRYER.origin[0], DRYER.origin[1] + (barY0 - 40) * MM, 0], [CHART.x + CHART.w / 2, CHART.y + CHART.h, 0]]);

    const status = values.volts === 0 ? 'Ready · nothing is across the element, so nothing happens; turn the supply up and press Play'
      : plan.blocked ? (clock <= 0 ? 'Ready · the inlet is blocked, so no air can reach the element; press Play to watch what stops it'
        : now.on ? `Blocked · ${fixed(now.t, 1)} s in, with no air to take its heat the element is at ${fixed(now.celsius, 0)} °C and climbing`
        : `Cut out · the element reached ${fixed(DECLARED.dryerOpen, 0)} °C after ${fixed(plan.opened, 1)} s and the switch opened; it will close again at ${fixed(DECLARED.dryerClose, 0)} °C`)
      : clock <= 0 ? `Ready · at ${fixed(values.airflow, 0)} L/s this dryer will put out air at ${fixed(plan.outlet, 0)} °C from ${fixed(plan.rating, 0)} W; press Play`
      : now.t < DECLARED.spinUp ? `Starting · the fan is coming up to speed, and the element is not let on until it is`
      : `Running · ${fixed(now.t, 1)} s in, the air leaves at ${fixed(now.outlet, 0)} °C and the element sits at ${fixed(now.celsius, 0)} °C`;
    return {
      state: {...plan, now, clock},
      readings: [
        r('Your result', status),
        r('Element power', `${fixed(now.power, 0)} W`, `Joule's law: the voltage squared over the resistance, ${fixed(values.volts, 0)} V across ${fixed(plan.resistance, 1)} Ω. At ${fixed(MAINS.volts, 0)} V that is ${fixed(plan.rating, 0)} W, about the ${fixed(RATED.dryer, 0)} W the Hair dryer page gives a dryer today, against the ${fixed(RATED.earlyDryer, 0)} W the first ones managed.`),
        r('Air leaving', plan.blocked ? 'none' : `${fixed(now.outlet, 0)} °C`, plan.blocked
          ? 'With the inlet blocked nothing leaves the nozzle at all, which is exactly the condition the cutout is there for.'
          : `The air's rise is the power over its mass flow times its heat capacity. ${fixed(values.airflow, 0)} L/s of air at ${fixed(AIR.density, 3)} kg/m³ is ${fixed(1000 * plan.massFlow, 1)} g/s, and at ${fixed(AIR.heat, 0)} J for each kilogram and degree, ${fixed(plan.rating, 0)} W would raise it ${fixed(plan.idealRise, 0)} °C above the ${fixed(values.room, 0)} °C going in.`),
        r('Element temperature', `${fixed(now.celsius, 0)} °C`, `The wire settles where what the air carries off matches what it takes. At ${fixed(values.airflow, 0)} L/s the model gives it ${fixed(plan.conductance, 1)} W for each degree it stands above the room, a stated figure rising with the square root of the airflow, so it holds ${fixed(plan.steady, 0)} °C. That is well under the Draper point of ${fixed(DRAPER.celsius, 0)} °C, which is why a dryer element glows only dull red at most and never bright.`),
        r('Current', `${fixed(now.current, 1)} A`, `The voltage over the resistance. The element is ${fixed(DRYER_WIRE.length, 2)} m of ${fixed(1000 * DRYER_WIRE.diameter, 1)} mm wire, which at the datasheet's ${fixed(1e6 * NIKROTHAL.resistivity, 2)} Ω·mm²/m is ${fixed(plan.resistance, 1)} Ω cold. A long thin wire is how you get a high resistance into a small space, which is what the book means by a very long coil of thin wire.`),
        r('Thermal cutout', now.on ? 'closed' : 'open', `A bimetal switch that opens at ${fixed(DECLARED.dryerOpen, 0)} °C and closes again at ${fixed(DECLARED.dryerClose, 0)} °C. ${plan.opened === null ? 'With air moving past the element it never gets near that, so it stays closed throughout.' : `Here it opened ${fixed(plan.opened, 1)} s in${plan.closed === null ? '' : ` and closed again at ${fixed(plan.closed, 1)} s`}, and it will keep doing that for as long as the air is blocked.`} The Thermal cutoff page separates this from a thermal fuse, which opens once and has to be replaced.`),
        r('Air moving', plan.blocked ? 'none' : `${fixed(1000 * plan.massFlow, 1)} g/s`, `Halving the air does not halve the heat, it doubles what each kilogram has to carry: at ${fixed(D.airflow[0], 0)} L/s this dryer would put out air ${fixed(plan.rating / (AIR.density * D.airflow[0] / 1000 * AIR.heat), 0)} °C above the room, and at ${fixed(D.airflow[1], 0)} L/s only ${fixed(plan.rating / (AIR.density * D.airflow[1] / 1000 * AIR.heat), 0)} °C above it, for exactly the same electricity.`),
        r('Scale', 'drawn at true size', `The dryer is drawn at true size, ${fixed(barX1 - barX0, 0)} mm long and ${fixed(barY1 - barY0, 0)} mm across, with the element's wire thickened to be visible. The run plays at life size, and the chart is not to scale.`),
      ],
    };
  });

  const render = result.update;
  const duration = () => result.getState().duration;
  result.advance = dt => { if (Number.isFinite(dt) && dt > 0) clock = Math.min(duration(), clock + dt); return render(); };
  result.animate = t => { const dt = Number.isFinite(t) ? Math.max(0, t - lastClock) : 0; if (Number.isFinite(t)) lastClock = t; return result.advance(dt); };
  result.reset = () => { clock = 0; lastClock = 0; return render(result.defaults); };
  const inspect = time => { clock = Math.min(duration(), time); return render(); };
  result.actions = [
    {label: 'Inspect: the element', part: 'element', view: 'front', replay: false, run() { return inspect(duration()); }},
    {label: 'Inspect: the fan', part: 'fan', view: 'front', replay: false, run() { return inspect(duration()); }},
    {label: 'Inspect: the cutout', part: 'cutout', view: 'front', replay: false, run() { return inspect(duration()); }},
    {label: 'Inspect: the run', part: 'chart', view: 'front', replay: false, run() { return render(); }},
  ];
  result.playback = {
    label: 'Switch it on',
    description: `The fan comes up to speed, the element is let on, and the air settles at its outlet temperature. The run plays at life size and lasts ${fixed(DECLARED.dryerRun, 0)} s.`,
    stepLabel: 'Advance 1 s',
    advance: result.advance,
    step: () => result.advance(1),
    complete: () => clock >= duration(),
    blocked: () => result.getState().values.volts === 0,
  };
  result.resultPart = {id: 'chart', label: 'Inspect the run', view: 'front', focusOnComplete: false, available: () => clock >= duration()};

  kit.root.rotation.set(0.04, -0.06, 0);
  result.initialPart = 'system';
  result.initialView = 'front';
  result.frameVisibleOnly = true;
  result.framePadding = 0.6;
  result.selectionOutline = false;
  result.transparentBackground = true;
  result.topology = {system, body, board, barrelLine, handle, nozzle, fanPart, fanRing, rotor, blades, inletArrow, element, coil, glow, cutoutPart, strip, contacts, airPart, marks, outletArrow, chartPart, chartFrame, openLine, closeLine, ticks, guideWire, guideOutlet, curveWire, curveOutlet, openMark, cursor, leader};
  const dispose = result.dispose;
  result.dispose = () => { if (!disposed) { disposed = true; dispose(); } };
  return result;
}

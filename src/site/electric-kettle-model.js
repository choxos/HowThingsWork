import * as THREE from 'three';
import {houseModel, reading as r} from './house-model-kit.js';
import {fixed} from './format.js';
import {clamp} from './physics-kit.js';
import {fillLine, lineObject, segmentLines} from './scene-kit.js';
import {panel, wireColor, glowOpacity} from './element-scene.js';
import {
  kettlePlan, kettleAt, resistanceAt, KETTLE_DEFAULTS, KETTLE_DOMAINS, KETTLE_WIRE, FILLED,
  DECLARED, DRAPER, NIKROTHAL, WATER, RATED, MAINS,
} from './element-physics.js';

// ---------------------------------------------------------------------------
// Electric kettle: the kettle cut open at true size, its element under the
// water, the switch the steam throws, and the water coming up to the boil.
//
// Scale: the kettle is drawn at true size, 1 mm to 0.002 scene units, its body
// 170 mm across and 230 mm tall, everything inside it illustrative in size and
// place except the water, whose depth follows the mass you choose. The element
// is drawn as the coil it is, its 0.55 mm wire thickened to be visible. The
// chart is not to scale.
//
// Time: the run plays 10 times faster than the real thing, said in the part
// text and in a reading.
// ---------------------------------------------------------------------------

export const MM = 0.002;
/** How many times faster than the real thing the run plays. */
export const FASTER = 10;

/** The kettle, mm about the middle of its body. */
export const KETTLE = Object.freeze({
  origin: Object.freeze([-0.62, 0.42, 0]),
  body: Object.freeze([-85, 85, -115, 115]),
  base: Object.freeze([-85, 85, -115, -80]),
  spout: Object.freeze([[85, 40], [125, 95], [110, 110]]),
  handle: Object.freeze([[85, 80], [140, 70], [150, -10], [95, -55]]),
  lid: Object.freeze([-60, 60, 108, 122]),
  element: Object.freeze([-62, 62, -68]), coils: 9, coilR: 11,
  switchAt: Object.freeze([52, 64]), strip: Object.freeze([34, 4]),
  steam: 7, full: 1.7,
});

/** The run: where the chart sits, its size, and what it spans. */
export const CHART = Object.freeze({
  x: -0.06, y: -0.72, w: 1.9, h: 0.78,
  temperature: Object.freeze([0, 140]), tickEvery: 60, tick: 0.022, mark: 0.03, cursor: 0.022,
});

export const COLORS = Object.freeze({
  casing: 0xe9e4d8, shell: 0x2f3336, metal: 0xb4c5b0, faint: 0x9aa39a, chart: 0x374736,
  cold: 0x3f7fbf, hot: 0xc14f39, steam: 0xd8dcd6, gold: 0xe3b45e, boil: 0x7d5ba6, wire: 0xe07a3c,
});

export const chartX = (plan, t) => CHART.x + clamp(t / plan.duration) * CHART.w;
export const chartY = celsius => CHART.y + clamp((celsius - CHART.temperature[0]) / (CHART.temperature[1] - CHART.temperature[0])) * CHART.h;

const cold = new THREE.Color(COLORS.cold), hot = new THREE.Color(COLORS.hot);
/** The color of water at `celsius`, between its starting range and boiling. */
export const waterColor = celsius => cold.clone().lerp(hot, clamp(celsius / WATER.boiling));

export function createElectricKettleModel() {
  const kit = houseModel('Electric kettle'), {part, control, finish} = kit;
  const {flat, rect, millimeters, outline} = panel(MM);
  let clock = 0, lastClock = 0, disposed = false;

  const [bodyX0, bodyX1, bodyY0, bodyY1] = KETTLE.body;
  const system = part('system', 'Electric kettle, cut open', `A kettle cut open at true size, ${fixed(bodyX1 - bodyX0, 0)} mm across and ${fixed(bodyY1 - bodyY0, 0)} mm tall: the element under the water, the water above it, and the switch the steam throws when it boils. Beneath, the run. Press Play to switch it on: the run plays ${FASTER} times faster than the real thing.`);

  const body = part('body', 'Body, spout and handle', `The vessel that holds the water over the element, with the spout it pours from and the handle that keeps your hand off it. The lid closes the top so that the steam has one way out, past the switch.`, KETTLE.origin, system);
  const board = flat(COLORS.casing, body);
  millimeters(board, bodyX0, bodyX1, bodyY0, bodyY1, -0.01);
  const bodyLine = lineObject(5, COLORS.shell, body);
  outline(bodyLine, bodyX0, bodyX1, bodyY0, bodyY1, -0.008);
  const base = flat(COLORS.metal, body);
  millimeters(base, ...KETTLE.base, -0.007);
  const lid = flat(COLORS.metal, body);
  millimeters(lid, ...KETTLE.lid, -0.006);
  const spout = lineObject(KETTLE.spout.length, COLORS.shell, body);
  fillLine(spout, KETTLE.spout.map(([x, y]) => [x * MM, y * MM, -0.008]));
  const handle = lineObject(KETTLE.handle.length, COLORS.shell, body);
  fillLine(handle, KETTLE.handle.map(([x, y]) => [x * MM, y * MM, -0.008]));

  const water = part('water', 'The water', `What is being heated. Its depth follows the mass you pour in, and its color follows its temperature. Water takes ${fixed(WATER.heat, 0)} J for each kilogram and each degree, which is more than almost anything else, and that is the whole reason a kettle needs kilowatts rather than watts.`, KETTLE.origin, system);
  const pool = flat(COLORS.cold, water);
  const surface = segmentLines(1, COLORS.shell, water);

  const element = part('element', 'Heating element', `The coil of ${NIKROTHAL.name} wire in the bottom, sheathed and sitting under the water. Water carries heat away from it so fast that the element runs only a few degrees above the water it is in, which is why a kettle element never glows and why it burns out in seconds if it is ever switched on dry.`, KETTLE.origin, system);
  const coil = lineObject(4 * KETTLE.coils + 1, COLORS.wire, element);
  const glow = flat(COLORS.wire, element, {transparent: true, opacity: 0});

  const steamSwitch = part('switch', 'Steam switch', `The switch the steam itself throws. Steam climbing from boiling water reaches a small bimetal disc in the handle; the disc snaps, the contacts open, and the element goes off. It answers to the state of the water rather than to a clock, which is why a kettle can be left alone.`, KETTLE.origin, system);
  const strip = flat(COLORS.gold, steamSwitch);
  const contacts = segmentLines(2, COLORS.shell, steamSwitch);

  const steamPart = part('steam', 'Steam', 'The steam that leaves the water once it reaches boiling, and the path it takes to the switch. Nothing rises until the water is actually at the boil, which is the signal the switch is waiting for.', KETTLE.origin, system);
  const puffs = Array.from({length: KETTLE.steam}, () => flat(COLORS.steam, steamPart, {transparent: true, opacity: 0.7}));

  const chartPart = part('chart', 'The run', `The water's temperature on the dark curve and the element's on the pale one, from ${fixed(CHART.temperature[0], 0)} to ${fixed(CHART.temperature[1], 0)} °C, with a tick every ${fixed(CHART.tickEvery, 0)} s. The violet line is boiling, where the switch opens.`, [0, 0, 0], system);
  const chartFrame = lineObject(5, COLORS.chart, chartPart);
  outline(chartFrame, CHART.x, CHART.x + CHART.w, CHART.y, CHART.y + CHART.h, 0, 1);
  const boilLine = segmentLines(1, COLORS.boil, chartPart);
  const ticks = segmentLines(Math.ceil(DECLARED.kettleRun / CHART.tickEvery), COLORS.chart, chartPart);
  const guideWater = lineObject(DECLARED.samples, COLORS.faint, chartPart), guideWire = lineObject(DECLARED.samples, COLORS.faint, chartPart);
  const curveWater = lineObject(DECLARED.samples + 1, COLORS.hot, chartPart), curveWire = lineObject(DECLARED.samples + 1, COLORS.wire, chartPart);
  const switchMark = segmentLines(1, COLORS.boil, chartPart), cursor = segmentLines(2, COLORS.chart, chartPart);
  const leader = segmentLines(1, COLORS.faint, system);

  const d = KETTLE_DEFAULTS, D = KETTLE_DOMAINS;
  control('volts', 'Supply voltage', ...D.volts, d.volts, 'V', `What the socket puts across the element. The Mains electricity page gives ${fixed(MAINS.volts, 0)} V in much of the world and ${fixed(MAINS.americanVolts, 0)} V in North America, which is why a kettle boils so much faster in one place than the other.`);
  control('mass', 'Water poured in', ...D.mass, d.mass, 'kg', 'How much water is in the kettle. Every kilogram has to be carried the whole way to boiling, so the time goes up in proportion.');
  control('start', 'Starting temperature', ...D.start, d.start, '°C', 'How warm the water is when it goes in. Starting warmer is a shorter way to go.');
  control('filled', 'What is in it', ...D.filled, d.filled, '', 'Whether there is water over the element at all. Switched on dry, there is nothing to carry the heat away and the element climbs until its cutout saves it.', FILLED);

  const result = finish(v => {
    const plan = kettlePlan(v), now = kettleAt(plan, clock), values = plan.values;

    // The water: its depth from the mass, its color from its temperature.
    const depth = plan.wet ? (bodyY0 + 12) + (KETTLE.element[2] - bodyY0 + 150) * (values.mass / KETTLE.full) : bodyY0 + 12;
    millimeters(pool, bodyX0 + 6, bodyX1 - 6, bodyY0 + 6, depth, -0.006);
    pool.visible = plan.wet;
    pool.material.color.copy(waterColor(now.water));
    surface.visible = plan.wet;
    fillLine(surface, [[(bodyX0 + 6) * MM, depth * MM, -0.005], [(bodyX1 - 6) * MM, depth * MM, -0.005]]);

    // The element, drawn as the coil it is.
    const [ex0, ex1, ey] = KETTLE.element, color = wireColor(now.celsius);
    fillLine(coil, Array.from({length: 4 * KETTLE.coils + 1}, (_, i) => {
      const share = i / (4 * KETTLE.coils), angle = share * KETTLE.coils * 2 * Math.PI;
      return [(ex0 + (ex1 - ex0) * share) * MM, (ey + KETTLE.coilR * Math.sin(angle)) * MM, -0.004];
    }));
    coil.material.color.copy(color);
    millimeters(glow, ex0 - 10, ex1 + 10, ey - KETTLE.coilR - 8, ey + KETTLE.coilR + 8, -0.005);
    glow.material.color.copy(color);
    glow.material.opacity = glowOpacity(now.celsius);

    // The switch: the strip tilts and the contacts part once the steam reaches it.
    const [switchX, switchY] = KETTLE.switchAt, [stripLong, stripThick] = KETTLE.strip;
    const thrown = now.switched || now.tripped;
    millimeters(strip, switchX - stripLong / 2, switchX + stripLong / 2, switchY + (thrown ? 7 : 0), switchY + (thrown ? 7 : 0) + stripThick, -0.004);
    fillLine(contacts, [
      [(switchX - 8) * MM, (switchY - 10) * MM, -0.003], [(switchX - 8) * MM, (switchY - 2) * MM, -0.003],
      [(switchX + 8) * MM, (switchY - 10) * MM, -0.003], [(switchX + 8) * MM, (switchY - 2 - (thrown ? 8 : 0)) * MM, -0.003],
    ]);

    // The steam, only once the water is actually boiling.
    puffs.forEach((puff, i) => {
      const phase = (clock / 3 + i / KETTLE.steam) % 1;
      puff.visible = now.boiling;
      const y = depth + 10 + phase * 90, size = 5 + phase * 9;
      millimeters(puff, switchX - 40 - size, switchX - 40 + size, y - size, y + size, -0.003);
      puff.material.opacity = 0.7 * (1 - phase);
    });

    // The chart.
    fillLine(boilLine, [[CHART.x, chartY(WATER.boiling), 0], [CHART.x + CHART.w, chartY(WATER.boiling), 0]]);
    const tickCount = Math.max(0, Math.ceil(plan.duration / CHART.tickEvery) - 1);
    fillLine(ticks, Array.from({length: tickCount}, (_, i) => {
      const x = chartX(plan, (i + 1) * CHART.tickEvery);
      return [[x, CHART.y, 0], [x, CHART.y - CHART.tick, 0]];
    }).flat());
    fillLine(guideWater, plan.chart.map(sample => [chartX(plan, sample.t), chartY(sample.water), 0]));
    fillLine(guideWire, plan.chart.map(sample => [chartX(plan, sample.t), chartY(sample.celsius), 0]));
    const shown = clock > 0 ? plan.chart.filter(sample => sample.t < now.t) : [];
    fillLine(curveWater, clock > 0 ? [...shown.map(sample => [chartX(plan, sample.t), chartY(sample.water), 0]), [chartX(plan, now.t), chartY(now.water), 0]] : []);
    fillLine(curveWire, clock > 0 ? [...shown.map(sample => [chartX(plan, sample.t), chartY(sample.celsius), 0]), [chartX(plan, now.t), chartY(now.celsius), 0]] : []);
    const ends = plan.switched ?? plan.tripped;
    switchMark.visible = ends !== null;
    if (ends !== null) fillLine(switchMark, [[chartX(plan, ends), CHART.y, 0], [chartX(plan, ends), CHART.y + CHART.mark, 0]]);
    const cx = Math.min(Math.max(chartX(plan, now.t), CHART.x + CHART.cursor), CHART.x + CHART.w - CHART.cursor);
    const mark = y => [[cx - CHART.cursor, y, 0], [cx + CHART.cursor, y, 0]];
    fillLine(cursor, clock > 0 ? [...mark(chartY(now.water)), ...mark(chartY(now.celsius))] : []);
    fillLine(leader, [[KETTLE.origin[0], KETTLE.origin[1] + (bodyY0 - 30) * MM, 0], [CHART.x + CHART.w / 2, CHART.y + CHART.h, 0]]);

    const delivered = plan.wet ? values.mass * WATER.heat * (now.water - values.start) : 0;
    const status = values.volts === 0 ? 'Ready · nothing is across the element, so nothing happens; turn the supply up and press Play'
      : !plan.wet ? (clock <= 0 ? `Ready · there is no water over the element, so nothing will carry its heat away; press Play to watch what saves it`
        : now.tripped ? `Cut out · with nothing to heat, the element reached ${fixed(DECLARED.dryCutout, 0)} °C in ${fixed(plan.tripped, 1)} s and its protector opened`
        : `Running dry · ${fixed(now.t, 1)} s in, the element is already at ${fixed(now.celsius, 0)} °C and still climbing`)
      : clock <= 0 ? (plan.boils ? `Ready · ${fixed(values.mass, 1)} kg from ${fixed(values.start, 0)} °C will boil in ${fixed(plan.switched, 0)} s at ${fixed(plan.rating, 0)} W; press Play`
        : `Ready · at ${fixed(plan.rating, 0)} W this will not reach boiling within the ${fixed(DECLARED.kettleRun, 0)} s the run lasts; press Play to watch how far it gets`)
      : now.switched ? `Switched off · the water reached ${fixed(WATER.boiling, 0)} °C after ${fixed(plan.switched, 0)} s and the steam threw the switch`
      : `Heating · ${fixed(now.t, 0)} s in, the water reads ${fixed(now.water, 1)} °C`;
    return {
      state: {...plan, now, clock},
      readings: [
        r('Your result', status),
        r('Element power', `${fixed(now.power, 0)} W`, `Joule's law: the voltage squared over the resistance, ${fixed(values.volts, 0)} V across ${fixed(plan.resistance, 2)} Ω. At ${fixed(MAINS.volts, 0)} V this element is ${fixed(plan.rating, 0)} W, inside the ${fixed(RATED.kettle[0] / 1000, 0)} to ${fixed(RATED.kettle[1] / 1000, 0)} kW the Kettle page gives, and it draws ${fixed(plan.current, 1)} A of the ${fixed(RATED.kettleCurrent, 0)} A that page says a kettle can pull.`),
        r('Water temperature', plan.wet ? `${fixed(now.water, 1)} °C` : 'no water in it', plan.wet
          ? `Energy in, over the mass times the heat capacity: ${fixed(delivered / 1000, 0)} kJ has gone into ${fixed(values.mass, 1)} kg of water so far, and at ${fixed(WATER.heat, 0)} J for each kilogram and degree that is ${fixed(now.water - values.start, 1)} °C of rise from the ${fixed(values.start, 0)} °C it started at.`
          : `There is nothing over the element to take its heat, so there is no water temperature to give. Everything the element makes stays in the element.`),
        r('Element temperature', `${fixed(now.celsius, 0)} °C`, plan.wet
          ? `Water carries heat off the sheath so readily that the element settles only a few degrees above the water around it, ${fixed(now.celsius - now.water, 1)} °C above it now. It never comes near the ${fixed(DRAPER.celsius, 0)} °C at which metal starts to glow, which is why you never see a kettle element light up.`
          : `With only air around it the element can shed almost nothing, so it climbs until its protector opens at ${fixed(DECLARED.dryCutout, 0)} °C. That takes ${plan.tripped === null ? 'only seconds' : `${fixed(plan.tripped, 1)} s`}, which is why dry switching is a protector's job and not a person's.`),
        r('Time to boil', plan.boils ? `${fixed(plan.switched, 0)} s` : plan.wet ? 'not within this run' : 'never, with no water', plan.wet
          ? `Bringing ${fixed(values.mass, 1)} kg from ${fixed(values.start, 0)} °C to ${fixed(WATER.boiling, 0)} °C takes ${fixed(plan.needed / 1000, 0)} kJ. At ${fixed(plan.rating, 0)} W, less the ${fixed(DECLARED.vesselLoss, 1)} W for each degree the model lets the body lose, that is ${plan.boils ? `${fixed(plan.switched, 0)} s` : 'longer than this run'}.`
          : 'There is nothing to bring to the boil.'),
        r('Steam switch', now.switched ? 'opened at boiling' : plan.wet ? 'closed' : 'not what stops it', plan.wet
          ? `The switch answers the water, not a clock: steam only rises once the water is actually at ${fixed(WATER.boiling, 0)} °C, so the same switch works whatever you poured in and however warm it started. Nothing boils away, because the element goes off the moment the steam arrives.`
          : `Switched on dry there is no steam to throw the steam switch, so a second protector on the element itself is what opens the circuit.`),
        r('Boiled away', `${fixed(1000 * now.boiled, 1)} g`, `Once the water is at boiling, anything more goes into turning it to steam, at ${fixed(WATER.vaporization / 1000, 0)} kJ for every kilogram, which is over five times what it took to warm that kilogram from cold. In this kettle the switch opens the moment boiling starts, so almost none of it is ever spent.`),
        r('Sped up', `${FASTER} times faster`, `The run plays ${FASTER} times faster than the real thing: this one takes ${fixed(plan.duration, 0)} s and plays in ${fixed(plan.duration / FASTER, 0)} s. The kettle is drawn at true size, ${fixed(bodyX1 - bodyX0, 0)} mm across and ${fixed(bodyY1 - bodyY0, 0)} mm tall, and the chart is not to scale.`),
      ],
    };
  });

  const render = result.update;
  const duration = () => result.getState().duration;
  result.advance = dt => { if (Number.isFinite(dt) && dt > 0) clock = Math.min(duration(), clock + dt * FASTER); return render(); };
  result.animate = t => { const dt = Number.isFinite(t) ? Math.max(0, t - lastClock) : 0; if (Number.isFinite(t)) lastClock = t; return result.advance(dt); };
  result.reset = () => { clock = 0; lastClock = 0; return render(result.defaults); };
  const inspect = time => { clock = Math.min(duration(), time); return render(); };
  result.actions = [
    {label: 'Inspect: the element', part: 'element', view: 'front', replay: false, run() { return inspect(duration()); }},
    {label: 'Inspect: the water', part: 'water', view: 'front', replay: false, run() { return inspect(duration() / 2); }},
    {label: 'Inspect: the steam switch', part: 'switch', view: 'front', replay: false, run() { return inspect(duration()); }},
    {label: 'Inspect: the run', part: 'chart', view: 'front', replay: false, run() { return render(); }},
  ];
  result.playback = {
    label: 'Switch it on',
    description: `The kettle is switched on and runs until the steam throws the switch. The run plays ${FASTER} times faster than the real thing.`,
    stepLabel: 'Advance 10 s',
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
  result.topology = {system, body, board, bodyLine, base, lid, spout, handle, water, pool, surface, element, coil, glow, steamSwitch, strip, contacts, steamPart, puffs, chartPart, chartFrame, boilLine, ticks, guideWater, guideWire, curveWater, curveWire, switchMark, cursor, leader};
  const dispose = result.dispose;
  result.dispose = () => { if (!disposed) { disposed = true; dispose(); } };
  return result;
}

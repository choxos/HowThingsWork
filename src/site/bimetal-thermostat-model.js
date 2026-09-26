import * as THREE from 'three';
import {houseModel, reading as r} from './house-model-kit.js';
import {fixed} from './format.js';
import {clamp} from './physics-kit.js';
import {chartText, fillLine, lineObject, segmentLines, textLabel} from './scene-kit.js';
import {panel} from './element-scene.js';
import {
  bimetalPlan, bimetalAt, curvatureAt, stripTipAt, villarceauA,
  BIMETAL_DEFAULTS, BIMETAL_DOMAINS, DECLARED, EXPANSION, MODULUS,
} from './thermostat-physics.js';

// ---------------------------------------------------------------------------
// Bimetal thermostat: the strip drawn at true size with its bend magnified, the
// contact it opens, and the room it keeps while it cycles.
//
// Scale: the strip is drawn at true size along its length, 1 mm to 0.01 scene
// units, its 50 mm length and 0.6 mm thickness both true. Its bend is drawn 12
// times larger than it is, because the tip moves only 22 micrometers for each
// degree and 20 micrometers across a whole switching band; said in the part
// text and in a reading. The chart is not to scale.
//
// Time: the run lasts 90 minutes of room time and plays 120 times faster.
// ---------------------------------------------------------------------------

export const MM = 0.01;
/** How many times larger than it is the strip's bend is drawn. */
export const BEND_TIMES = 12;

/** The thermostat, mm about the strip's root. */
export const STRIP = Object.freeze({
  origin: Object.freeze([-0.72, 0.52, 0]),
  root: Object.freeze([-26, 0]), length: 50, thickness: 0.6, segments: 28,
  contact: Object.freeze([28, 6]), post: Object.freeze([30, -14, 34, 10]),
  dial: Object.freeze([-40, -22, 9]),
});

/** The room through the run: where the chart sits and what it spans. */
export const CHART = Object.freeze({
  x: -0.2, y: -0.62, w: 1.72, h: 0.74,
  temperature: Object.freeze([5, 30]), tickEvery: 900, tick: 0.02, mark: 0.028, cursor: 0.02,
});

export const COLORS = Object.freeze({
  casing: 0xe9e4d8, shell: 0x2f3336, faint: 0x9aa39a, chart: 0x374736,
  brass: 0xe3b45e, iron: 0x8e948c, live: 0xc14f39, dead: 0xb4c5b0, set: 0x7d5ba6, band: 0xa9bfd6,
});

export const chartX = (plan, t) => CHART.x + clamp(t / plan.duration) * CHART.w;
export const chartY = celsius => CHART.y + clamp((celsius - CHART.temperature[0]) / (CHART.temperature[1] - CHART.temperature[0])) * CHART.h;

export function createBimetalThermostatModel() {
  const kit = houseModel('Bimetal thermostat'), {part, control, finish} = kit;
  const {flat, rect, millimeters, outline, circlePoints} = panel(MM);
  let clock = 0, lastClock = 0, disposed = false;

  const system = part('system', 'Bimetal thermostat, cut open', `A bimetal strip drawn at true size, ${fixed(STRIP.length, 0)} mm long and ${fixed(STRIP.thickness, 1)} mm thick, with its bend drawn ${BEND_TIMES} times larger so that it can be seen at all. Beneath, the room it keeps. Press Play to switch the heating on.`);

  // The strip: one part, not one part for each segment.
  const strip = part('strip', 'Bonded bimetal strip', `Two metals bonded along their whole length, brass on one face and iron on the other. Brass grows ${fixed(EXPANSION.brass / EXPANSION.iron, 2)} times as fast as iron for the same warming, and since neither can slide on the other the pair has no choice but to curl, brass on the outside of the curve. The strip is drawn in ${STRIP.segments} pieces, but it is one part: the metals never come apart.`, STRIP.origin, system);
  const brassFace = Array.from({length: STRIP.segments}, () => flat(COLORS.brass, strip));
  const ironFace = Array.from({length: STRIP.segments}, () => flat(COLORS.iron, strip));
  const spine = lineObject(STRIP.segments + 1, COLORS.shell, strip);

  const contact = part('contact', 'Switch contacts', `The pair of contacts the strip's tip carries onto and off the fixed post. They part when the room reaches your setting and meet again a little below it, and that little is the whole switching band.`, STRIP.origin, system);
  const post = flat(COLORS.shell, contact);
  const moving = flat(COLORS.shell, contact);
  const spark = segmentLines(1, COLORS.live, contact);

  const dial = part('dial', 'Setting dial', 'The dial that moves the fixed contact toward the strip or away from it. Moving the contact changes the temperature at which the tip reaches it, which is the only thing a setting does.', STRIP.origin, system);
  const dialRing = lineObject(33, COLORS.shell, dial);
  const pointer = segmentLines(1, COLORS.shell, dial);

  const heater = part('heater', 'The heater it switches', 'The load on the other side of the contacts. While they are closed it puts its whole power into the room; while they are parted it puts in nothing. It has no setting of its own and no way of running gently.', [0, 0, 0], system);
  const heaterBox = flat(COLORS.dead, heater);
  const heaterCoil = lineObject(17, COLORS.live, heater);

  const chartPart = part('chart', 'The room through the run', `What the room reads from the moment the heating is switched on, from ${fixed(CHART.temperature[0], 0)} to ${fixed(CHART.temperature[1], 0)} °C, with a tick every ${fixed(CHART.tickEvery / 60, 0)} minutes. The violet line is your setting and the pale band beneath it is where the contacts stay parted until the room falls back through it.`, [0, 0, 0], system);
  const chartFrame = lineObject(5, COLORS.chart, chartPart);
  outline(chartFrame, CHART.x, CHART.x + CHART.w, CHART.y, CHART.y + CHART.h, 0, 1);
  const bandBox = flat(COLORS.band, chartPart, {transparent: true, opacity: 0.3});
  const setLine = segmentLines(1, COLORS.set, chartPart);
  const ticks = segmentLines(Math.ceil(DECLARED.roomRun / CHART.tickEvery), COLORS.chart, chartPart);
  const guide = lineObject(DECLARED.samples, COLORS.faint, chartPart);
  const curve = lineObject(DECLARED.samples + 1, COLORS.live, chartPart);
  const cursor = segmentLines(1, COLORS.chart, chartPart);
  // The chart's words: its scale at the left, the run's length under its right end, and its name and key to its right, clear of the leader that meets its top.
  const TEXT = 0.045, css = color => `#${color.toString(16).padStart(6, '0')}`;
  chartText(chartPart, (share, celsius) => [CHART.x + share * CHART.w, chartY(celsius), 0], {
    size: TEXT,
    x: {min: 0, max: 1, title: `Minutes, a tick every ${fixed(CHART.tickEvery / 60, 0)}`, ticks: [[0, '0']]},
    y: {min: CHART.temperature[0], max: CHART.temperature[1], ticks: [10, 20, 30].map(celsius => [celsius, `${fixed(celsius, 0)} °C`])},
  });
  const endWord = textLabel(chartPart, '', {height: TEXT, width: TEXT * 3.5, color: css(COLORS.chart), position: [CHART.x + CHART.w, CHART.y - 1.1 * TEXT, 0.001]});
  textLabel(chartPart, 'The room through the run', {height: TEXT, align: 'left', weight: '600', color: css(COLORS.chart), position: [CHART.x + CHART.w + 0.05, CHART.y + CHART.h - 0.03, 0.001]});
  [['Room', COLORS.live], ['Your setting', COLORS.set], ['Contacts parted', COLORS.band]].forEach(([text, color], i) => textLabel(chartPart, text, {height: TEXT, align: 'left', color: css(color), position: [CHART.x + CHART.w + 0.05, CHART.y + CHART.h - 0.11 - 0.065 * i, 0.001]}));
  const leader = segmentLines(1, COLORS.faint, system);

  const d = BIMETAL_DEFAULTS, D = BIMETAL_DOMAINS;
  control('setting', 'Temperature setting', ...D.setting, d.setting, '°C', 'Where the dial puts the fixed contact, and so the temperature at which the strip parts them.');
  control('outdoor', 'Outdoor temperature', ...D.outdoor, d.outdoor, '°C', 'How cold it is outside. The colder it is, the faster the room loses what the heater puts in, and the longer the heater has to stay on.');
  control('power', 'Heater power', ...D.power, d.power, 'W', 'How hard the heater works while it is on. A heater too small for the weather can never reach the setting at all, and then it simply stays on.');
  control('start', 'Starting temperature', ...D.start, d.start, '°C', 'How warm the room is when the heating is switched on.');

  const result = finish(v => {
    const plan = bimetalPlan(v), now = bimetalAt(plan, clock), values = plan.values;

    // The strip, bent to its own curvature, magnified.
    const [rootX, rootY] = STRIP.root, half = STRIP.thickness / 2;
    const curvature = curvatureAt(now.celsius) * BEND_TIMES / 1000;
    const points = Array.from({length: STRIP.segments + 1}, (_, i) => {
      const s = STRIP.length * i / STRIP.segments;
      const angle = curvature * s;
      return [rootX + s * (Math.abs(angle) < 1e-9 ? 1 : Math.sin(angle) / angle), rootY + curvature * s * s / 2];
    });
    fillLine(spine, points.map(([x, y]) => [x * MM, y * MM, -0.002]));
    for (let i = 0; i < STRIP.segments; i++) {
      const [x0, y0] = points[i], [x1, y1] = points[i + 1];
      const angle = Math.atan2(y1 - y0, x1 - x0), nx = -Math.sin(angle) * half, ny = Math.cos(angle) * half;
      for (const [face, side] of [[brassFace[i], 1], [ironFace[i], -1]]) {
        const cx = (x0 + x1) / 2 + nx * side * 0.5, cy = (y0 + y1) / 2 + ny * side * 0.5;
        const long = Math.hypot(x1 - x0, y1 - y0);
        face.position.set(cx * MM, cy * MM, -0.003);
        face.scale.set(long * MM, half * MM, 1);
        face.rotation.z = angle;
      }
    }

    // The contacts: the tip carries one onto the post the dial sets.
    const tip = points.at(-1);
    const [postX, postLow, postHigh, postWide] = STRIP.post;
    const setOffset = (values.setting - D.setting[0]) / (D.setting[1] - D.setting[0]) * 10 - 5;
    millimeters(post, postX, postX + 4, postLow + setOffset, postHigh + setOffset, -0.004);
    millimeters(moving, tip[0] - 3, tip[0] + 3, tip[1] - 2, tip[1] + 2, -0.002);
    spark.visible = now.on;
    if (now.on) fillLine(spark, [[(tip[0] + 3) * MM, tip[1] * MM, -0.001], [postX * MM, (postLow + setOffset + 2) * MM, -0.001]]);

    // The dial.
    const [dialX, dialY, dialR] = STRIP.dial;
    fillLine(dialRing, circlePoints(dialX, dialY, dialR, 33, -0.004));
    const turn = Math.PI * 1.25 - 1.5 * Math.PI * (values.setting - D.setting[0]) / (D.setting[1] - D.setting[0]);
    fillLine(pointer, [[dialX * MM, dialY * MM, -0.003], [(dialX + dialR * 0.8 * Math.cos(turn)) * MM, (dialY + dialR * 0.8 * Math.sin(turn)) * MM, -0.003]]);

    // The heater it switches.
    rect(heaterBox, 0.28, 0.62, 0.3, 0.46, -0.004);
    heaterBox.material.color.setHex(now.on ? COLORS.live : COLORS.dead);
    fillLine(heaterCoil, Array.from({length: 17}, (_, i) => {
      const s = i / 16;
      return [0.3 + s * 0.3, 0.38 + (i % 2 ? 0.05 : -0.05), -0.003];
    }));
    heaterCoil.visible = now.on;

    // The room through the run.
    rect(bandBox, CHART.x, CHART.x + CHART.w, chartY(plan.closesAt), chartY(plan.opensAt), -0.001);
    fillLine(setLine, [[CHART.x, chartY(values.setting), 0], [CHART.x + CHART.w, chartY(values.setting), 0]]);
    const tickCount = Math.max(0, Math.ceil(plan.duration / CHART.tickEvery) - 1);
    endWord.userData.setText(`${fixed(plan.duration / 60, 0)}`);
    fillLine(ticks, Array.from({length: tickCount}, (_, i) => {
      const x = chartX(plan, (i + 1) * CHART.tickEvery);
      return [[x, CHART.y, 0], [x, CHART.y - CHART.tick, 0]];
    }).flat());
    fillLine(guide, plan.chart.map(sample => [chartX(plan, sample.t), chartY(sample.celsius), 0]));
    const shown = clock > 0 ? plan.chart.filter(sample => sample.t < now.t) : [];
    fillLine(curve, clock > 0 ? [...shown.map(sample => [chartX(plan, sample.t), chartY(sample.celsius), 0]), [chartX(plan, now.t), chartY(now.celsius), 0]] : []);
    const cx = Math.min(Math.max(chartX(plan, now.t), CHART.x + CHART.cursor), CHART.x + CHART.w - CHART.cursor);
    fillLine(cursor, clock > 0 ? [[cx - CHART.cursor, chartY(now.celsius), 0], [cx + CHART.cursor, chartY(now.celsius), 0]] : []);
    fillLine(leader, [[STRIP.origin[0], STRIP.origin[1] - 0.2, 0], [CHART.x + CHART.w / 2, CHART.y + CHART.h, 0]]);

    const minutes = seconds => `${fixed(seconds / 60, 0)} min`;
    const status = !plan.holds ? `Ready · at ${fixed(values.power, 0)} W this heater cannot hold ${fixed(values.setting, 0)} °C against ${fixed(values.outdoor, 0)} °C outside, so the contacts will never part; press Play to watch it try`
      : clock <= 0 ? `Ready · the contacts part at ${fixed(plan.opensAt, 1)} °C and meet again at ${fixed(plan.closesAt, 1)} °C, a band of ${fixed(plan.band, 2)} °C; press Play`
      : now.done ? `Settled · the room is cycling about ${fixed(values.setting, 0)} °C, the heater on ${fixed(100 * plan.dutyCycle, 0)}% of the time; the contacts have worked ${plan.switches} times`
      : `${now.on ? 'Heating' : 'Coasting'} · ${minutes(now.t)} in, the room reads ${fixed(now.celsius, 2)} °C and the contacts are ${now.on ? 'closed' : 'parted'}`;
    return {
      state: {...plan, now, clock},
      readings: [
        r('Your result', status),
        r('Room temperature', `${fixed(now.celsius, 2)} °C`, `The room's ${fixed(DECLARED.roomVolume, 0)} m³ of air, with its furnishings, holds ${fixed(plan.capacity / 1000, 0)} kJ for each degree, and it loses ${fixed(DECLARED.roomLoss, 0)} W for each degree it stands above the ${fixed(values.outdoor, 0)} °C outside. That is ${fixed(plan.needed, 0)} W to hold your setting, against the ${fixed(values.power, 0)} W the heater gives.`),
        r('Contacts', now.on ? 'closed' : 'parted', `They part when the strip's tip has carried the moving contact off the post, and meet again when it has come back ${fixed(1e6 * DECLARED.snap, 0)} micrometers. That overtravel is the only reason the thermostat does not chatter: without it the contacts would part and meet thousands of times at one temperature.`),
        r('Switching band', `${fixed(plan.closesAt, 1)} to ${fixed(plan.opensAt, 1)} °C`, `A band of ${fixed(plan.band, 2)} °C. The tip moves ${fixed(1e6 * (stripTipAt(21) - stripTipAt(20)), 1)} micrometers for each degree, so ${fixed(1e6 * DECLARED.snap, 0)} micrometers of overtravel is ${fixed(plan.band, 2)} °C of room temperature. Inside the band the contacts keep whatever they were doing, which is what hysteresis means.`),
        r('How far the strip moves', `${fixed(1e6 * (stripTipAt(21) - stripTipAt(20)), 1)} µm for each degree`, `Villarceau's formula gives the curvature as three over two a, times the difference in expansion, times the warming, over the thickness. Brass expands at ${fixed(1e6 * EXPANSION.brass, 1)} millionths a degree and iron at ${fixed(1e6 * EXPANSION.iron, 1)}, so the mismatch is ${fixed(1e6 * (EXPANSION.brass - EXPANSION.iron), 1)} millionths. With brass at ${fixed(MODULUS.brass / 1e9, 0)} GPa and iron at ${fixed(MODULUS.wroughtIron / 1e9, 0)} GPa the a comes to ${fixed(villarceauA(MODULUS.brass, DECLARED.stripThickness / 2, MODULUS.wroughtIron, DECLARED.stripThickness / 2), 3)}, and a tip ${fixed(1000 * DECLARED.stripLength, 0)} mm out moves ${fixed(1e6 * (stripTipAt(21) - stripTipAt(20)), 1)} micrometers. Over the whole range drawn here that is ${fixed(1000 * (stripTipAt(60) - stripTipAt(0)), 2)} mm, which is why the bend is drawn ${BEND_TIMES} times larger.`),
        r('Heater', now.on ? `${fixed(values.power, 0)} W` : '0 W', `A resistance heater has one setting: on. Everything about holding a room at a temperature is done by the thermostat deciding how much of the time to leave it that way. Here it needs to be on ${fixed(100 * plan.dutyCycle, 0)}% of the time, and it gets there by cycling rather than by turning down.`),
        r('Cycles', `${plan.switches} in ${minutes(plan.duration)}`, plan.holds
          ? `Every cycle is the room drifting up through the band with the heater on and back down through it with the heater off. A narrower band would hold the room closer but work the contacts harder; a wider one is kinder to the contacts and looser about the temperature.`
          : `None: the heater is too small for this weather, so the contacts never part at all and the room settles wherever ${fixed(values.power, 0)} W and ${fixed(DECLARED.roomLoss, 0)} W for each degree happen to balance.`),
        r('Sped up', `${fixed(DECLARED.slower, 0)} times faster`, `The run covers ${minutes(plan.duration)} of room time and plays in ${fixed(plan.duration / DECLARED.slower, 0)} s. The strip is drawn at true size along its length and its bend ${BEND_TIMES} times larger; the chart is not to scale.`),
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
    {label: 'Inspect: the strip', part: 'strip', view: 'front', replay: false, run() { return inspect(duration()); }},
    {label: 'Inspect: the contacts', part: 'contact', view: 'front', replay: false, run() { return inspect(duration()); }},
    {label: 'Inspect: the setting dial', part: 'dial', view: 'front', replay: false, run() { return render(); }},
    {label: 'Inspect: the room', part: 'chart', view: 'front', replay: false, run() { return render(); }},
  ];
  result.playback = {
    label: 'Switch the heating on',
    description: `The heating is switched on and the thermostat is left to keep the room. The run covers ${fixed(DECLARED.roomRun / 60, 0)} minutes and plays ${fixed(DECLARED.slower, 0)} times faster than the real thing.`,
    stepLabel: `Advance ${fixed(CHART.tickEvery / 60, 0)} min`,
    advance: result.advance,
    step: () => result.advance(CHART.tickEvery / DECLARED.slower),
    complete: () => clock >= duration(),
    blocked: () => false,
  };
  result.resultPart = {id: 'chart', label: 'Inspect the room', view: 'front', focusOnComplete: false, available: () => clock >= duration()};

  kit.root.rotation.set(0.04, -0.06, 0);
  result.initialPart = 'system';
  result.initialView = 'front';
  result.frameVisibleOnly = true;
  result.framePadding = 0.6;
  result.selectionOutline = false;
  result.transparentBackground = true;
  result.topology = {system, strip, brassFace, ironFace, spine, contact, post, moving, spark, dial, dialRing, pointer, heater, heaterBox, heaterCoil, chartPart, chartFrame, bandBox, setLine, ticks, guide, curve, cursor, leader};
  const dispose = result.dispose;
  result.dispose = () => { if (!disposed) { disposed = true; dispose(); } };
  return result;
}

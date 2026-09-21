import * as THREE from 'three';
import {houseModel, reading as r} from './house-model-kit.js';
import {fixed} from './format.js';
import {fillLine, lineObject, segmentLines, solidArrow} from './scene-kit.js';
import {linePlan, lineAt, catenaryHeight, LINE_DEFAULTS, LINE_DOMAINS, LEVELS, LEVEL_OPTIONS, CONDUCTOR_OPTIONS, WEATHER_OPTIONS, CONDUCTORS, DISC, SITE, TOWER, CREEPAGE, AIR_STRENGTH, SUPPLY, FLASHOVER} from './grid-physics.js';

// ---------------------------------------------------------------------------
// The line: why the voltage is raised for the journey, the insulator that keeps
// the conductor off the steel, and the pylon that holds it up.
//
// Scale: the span is drawn at true size and in true proportion, 1 m to 0.012
// scene units, so a 400 m span is 4.8 units across and its sag is the sag it
// really has. One pylon is drawn about four times larger, 1 m to 0.05 units,
// and the insulator string about thirty times larger, 1 m to 0.35 units, each
// said in its part text and in a reading. The two charts are not to scale.
//
// Time: one 50 Hz cycle is drawn in 8 seconds, so the current runs 400 times
// slower than it does.
// ---------------------------------------------------------------------------

export const SPAN = 0.012, PYLON = 0.05, STRING = 0.35;
/** How much conductor is drawn beside the close up pylon, m. */
export const STUB = 20;
export const LINE_AT = Object.freeze([0, 1.15, 0]);
export const PYLON_AT = Object.freeze([-2.6, -1.75, 0]);
export const STRING_AT = Object.freeze([-0.8, 0.45, 0]);
export const FLOW = Object.freeze({x: -0.05, y: -0.6, w: 1.6, h: 1.2, z: 0, cursor: 0.06});
export const LADDER = Object.freeze({x: 2, y: -1.2, w: 1.4, h: 1.7, z: 0, bar: 0.17, gap: 0.08});
export const TOWERART = Object.freeze({base: 0.34, top: 0.12, arm: 0.5, bays: 5});
export const COLORS = Object.freeze({steel: 0xb4c5b0, ground: 0x91aa7e, wire: 0xae8056, glass: 0x83b4c1, wet: 0x2b5d9c, cap: 0x8f989b, ink: 0x374736, faint: 0x9aa39a, heat: 0xc14f39, phase: Object.freeze([0x2b5d9c, 0xd9822b, 0x6f9c5a]), bar: 0xc14f39, safe: 0x6f9c5a, creep: 0xd9822b, sky: 0xf0dfaf});

/** Where a time and a share fall on the one cycle chart. */
export const flowX = (plan, t) => FLOW.x + Math.max(0, Math.min(1, t / plan.duration)) * FLOW.w;
export const flowY = share => FLOW.y + Math.max(-1, Math.min(1, share)) * FLOW.h / 2;
/** Where a share of the power sent falls on the ladder of voltages. */
export const ladderX = share => LADDER.x + Math.max(0, Math.min(1, share)) * LADDER.w;
export const ladderY = index => LADDER.y + index * (LADDER.bar + LADDER.gap);

/** The catenary between two supports, as `count` points in meters about the middle. */
export function spanPoints(a, span, count = 61) {
  return Array.from({length: count}, (_, i) => { const x = -span / 2 + span * i / (count - 1); return [x, catenaryHeight(a, x)]; });
}

export function createLineModel() {
  const kit = houseModel('Electricity transmission'), {part, control, finish} = kit;
  let clock = 0, lastClock = 0, disposed = false, shownDiscs = -1;
  const unlit = color => new THREE.MeshBasicMaterial({color});
  const flat = (color, parent) => { const mesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), unlit(color)); parent.add(mesh); return mesh; };
  const rect = (mesh, x0, x1, y0, y1, z = 0) => { mesh.position.set((x0 + x1) / 2, (y0 + y1) / 2, z); mesh.scale.set(Math.max(1e-9, x1 - x0), Math.max(1e-9, y1 - y0), 1); };

  const system = part('system', 'One span of a power line', `A conductor carried between two pylons, with the insulator that keeps it off the steel and the chart that answers the question the line is built around: why the voltage is raised for the journey. The span is drawn at true size and in true proportion, 1 m to ${fixed(SPAN, 3)} scene units. Press Play to run one ${fixed(SUPPLY.frequency, 0)} Hz cycle, drawn in ${fixed(SITE.show, 0)} seconds.`);

  const line = part('line', 'The span, at true size', `One whole span between two pylons, drawn at true size: 1 m to ${fixed(SPAN, 3)} scene units, the same across as up, so the curve the conductor hangs in is the curve it really hangs in. A conductor of even weight hangs in a catenary, and how far it dips below its supports is its sag. The dashed line marks the ${fixed(SITE.clearance, 0)} m of clearance kept beneath it.`, LINE_AT, system);
  const ground = segmentLines(1, COLORS.ground, line);
  const clearanceLine = segmentLines(12, COLORS.faint, line);
  const spanCurve = lineObject(61, COLORS.wire, line);
  const towers = [0, 1].map(() => segmentLines(2 * (TOWERART.bays * 2 + 4), COLORS.steel, line));
  const sagMark = segmentLines(3, COLORS.ink, line);

  const pylon = part('pylon', 'One pylon, close up', `The same pylon drawn about four times larger, 1 m to ${fixed(PYLON, 2)} scene units. It does two things and only two: it holds the conductors up, and it holds them apart from each other and from the ground. Real lattice towers stand ${fixed(TOWER.low, 0)} to ${fixed(TOWER.high, 0)} m tall. Where the line runs straight the pull of the conductor on one side balances the pull on the other, so what is left for the steel is the weight hanging on it.`, PYLON_AT, system);
  const towerBody = segmentLines(2 * (TOWERART.bays * 4 + 6), COLORS.steel, pylon);
  const towerGround = segmentLines(1, COLORS.ground, pylon);
  const loadArrow = solidArrow(kit, COLORS.steel, pylon, 0.03);
  const clearArrow = segmentLines(3, COLORS.safe, pylon);
  const pylonString = segmentLines(2, COLORS.cap, pylon);
  const pylonWire = lineObject(31, COLORS.wire, pylon);

  const insulator = part('insulator', 'The insulator string, close up', `The string drawn about thirty times larger, 1 m to ${fixed(STRING, 2)} scene units. Each disc is a shell of toughened glass with a metal cap on one side and a pin on the other, so a string of them is as long as the voltage asks. The cups underneath keep part of the path dry in rain: the long way round the outside, from cap to pin, is the creepage, and the rule of thumb is ${fixed(CREEPAGE.low, 0)} to ${fixed(CREEPAGE.high, 0)} mm of it for every kV between lines. The orange line traces the creepage of one disc.`, STRING_AT, system);
  const discMeshes = Array.from({length: 40}, () => { const mesh = kit.cylinder(DISC.diameter / 2 * STRING, DISC.length * 0.45 * STRING, [0, 0, 0], COLORS.glass, insulator); mesh.visible = false; return mesh; });
  const discCaps = Array.from({length: 40}, () => { const mesh = kit.cylinder(DISC.diameter * 0.18 * STRING, DISC.length * 0.5 * STRING, [0, 0, 0], COLORS.cap, insulator); mesh.visible = false; return mesh; });
  const creepPath = lineObject(9, COLORS.creep, insulator);
  const armBar = kit.box([0.9, 0.06, 0.16], [0, 0.06, 0], COLORS.steel, insulator);
  const conductorBall = kit.sphere(0.07, [0, 0, 0], COLORS.wire, insulator);
  const marginRail = kit.box([0.86, 0.1, 0.06], [0, 0, 0], COLORS.ink, insulator);
  const marginBar = flat(COLORS.safe, insulator);
  const airGapMark = segmentLines(2, COLORS.heat, insulator);

  const flow = part('flow', 'One cycle of the current', `The current in each of the three phases through one cycle, each against the same peak, with the heat the line is making below. The three peak a third of a cycle apart. The heat follows the square of the current, so it never goes negative and it peaks twice as often: that is why what the line wastes is set by the current and not by the voltage.`, [0, 0, 0], system);
  const flowFrame = lineObject(5, COLORS.ink, flow);
  const flowZero = segmentLines(1, COLORS.faint, flow);
  const phaseCurves = COLORS.phase.map(color => lineObject(FLOW_SAMPLES, color, flow));
  const heatCurve = lineObject(FLOW_SAMPLES, COLORS.heat, flow);
  const flowCursor = segmentLines(2, COLORS.ink, flow);

  const ladder = part('ladder', 'The same power at five voltages', `What share of the power sent is lost in this same wire, at each of the five voltages, carrying the same power to the same place. Raise the voltage by ten and the current falls by ten, so the heat falls by a hundred. The marked bar is the voltage you have chosen.`, [0, 0, 0], system);
  const ladderFrame = lineObject(5, COLORS.ink, ladder);
  const ladderBars = LEVELS.map(() => flat(COLORS.bar, ladder));
  const ladderMark = segmentLines(4, COLORS.ink, ladder);

  fillLine(flowFrame, [[FLOW.x, FLOW.y - FLOW.h / 2, FLOW.z], [FLOW.x + FLOW.w, FLOW.y - FLOW.h / 2, FLOW.z], [FLOW.x + FLOW.w, FLOW.y + FLOW.h / 2, FLOW.z], [FLOW.x, FLOW.y + FLOW.h / 2, FLOW.z], [FLOW.x, FLOW.y - FLOW.h / 2, FLOW.z]]);
  fillLine(flowZero, [[FLOW.x, FLOW.y, FLOW.z], [FLOW.x + FLOW.w, FLOW.y, FLOW.z]]);
  fillLine(ladderFrame, [[LADDER.x, ladderY(0) - LADDER.gap, LADDER.z], [LADDER.x + LADDER.w, ladderY(0) - LADDER.gap, LADDER.z], [LADDER.x + LADDER.w, ladderY(LEVELS.length - 1) + LADDER.bar + LADDER.gap, LADDER.z], [LADDER.x, ladderY(LEVELS.length - 1) + LADDER.bar + LADDER.gap, LADDER.z], [LADDER.x, ladderY(0) - LADDER.gap, LADDER.z]]);

  const d = LINE_DEFAULTS;
  control('voltage', 'Line voltage', ...LINE_DOMAINS.voltage, d.voltage, '', 'The voltage between lines. The top three are the grid in Great Britain; the lower two are distribution.', LEVEL_OPTIONS);
  control('conductor', 'Conductor', ...LINE_DOMAINS.conductor, d.conductor, '', 'Three aluminum conductors with steel cores, from a manufacturer sheet. More aluminum means less resistance and more weight.', CONDUCTOR_OPTIONS);
  control('length', 'Length', ...LINE_DOMAINS.length, d.length, 'km', 'How far the power has to travel. The resistance follows the length.');
  control('power', 'Power delivered', ...LINE_DOMAINS.power, d.power, 'MW', 'What arrives at the far end. Whatever the line wastes has to be sent on top of this.');
  control('span', 'Span', ...LINE_DOMAINS.span, d.span, 'm', 'How far apart the pylons stand.');
  control('tension', 'Tension', ...LINE_DOMAINS.tension, d.tension, '%', 'How hard the conductor is pulled, as a share of what would break it. Pull harder and it sags less, and the steel carries more.');
  control('weather', 'Weather', ...LINE_DOMAINS.weather, d.weather, '', 'Dry, or wet, which drops what the insulator can stand and lets far more current creep along its surface.', WEATHER_OPTIONS);

  const result = finish(v => {
    const plan = linePlan(v), now = lineAt(plan, clock);
    const span = plan.span, half = span / 2;

    // The span at true size: the ground, both towers and the catenary.
    const points = spanPoints(plan.a, span);
    const top = plan.towerHeight;
    fillLine(ground, [[-half * SPAN - 0.25, 0, 0], [half * SPAN + 0.25, 0, 0]]);
    fillLine(spanCurve, points.map(([x, y]) => [x * SPAN, (top - plan.sag + y) * SPAN, 0]));
    const dashes = [];
    for (let k = 0; k < 12; k++) { const x0 = -half + span * k / 12, x1 = x0 + span / 24; dashes.push([x0 * SPAN, SITE.clearance * SPAN, 0], [x1 * SPAN, SITE.clearance * SPAN, 0]); }
    fillLine(clearanceLine, dashes);
    towers.forEach((tower, i) => fillLine(tower, towerLines((i === 0 ? -half : half) * SPAN, top * SPAN, TOWERART.base * top * SPAN * 0.6)));
    const lowest = (top - plan.sag) * SPAN;
    fillLine(sagMark, [[0, lowest, 0], [0, top * SPAN, 0], [-0.05, lowest, 0], [0.05, lowest, 0], [-0.05, top * SPAN, 0], [0.05, top * SPAN, 0]]);

    // One pylon, larger.
    fillLine(towerGround, [[-0.85, 0, 0], [0.85, 0, 0]]);
    fillLine(towerBody, towerLines(0, top * PYLON, TOWERART.base * top * PYLON * 0.6, true));
    loadArrow.position.set(0, top * PYLON, 0.05);
    loadArrow.userData.setDirection(new THREE.Vector3(0, -1, 0));
    loadArrow.userData.setLength(Math.min(0.8, plan.vertical / 8000 * 0.6));
    fillLine(clearArrow, [[0.6, 0, 0], [0.6, SITE.clearance * PYLON, 0], [0.55, SITE.clearance * PYLON, 0], [0.65, SITE.clearance * PYLON, 0]]);
    fillLine(pylonString, [[0, top * PYLON, 0], [0, (top - plan.stringLength) * PYLON, 0]]);
    // The first STUB meters of conductor leaving this support, at the pylon's scale.
    fillLine(pylonWire, Array.from({length: 31}, (_, i) => {
      const s = STUB * i / 30, height = top - plan.stringLength - plan.sag + catenaryHeight(plan.a, -half + s);
      return [s * PYLON, height * PYLON, 0];
    }));

    // The string, larger still, one disc at a time.
    if (shownDiscs !== plan.discs) {
      shownDiscs = plan.discs;
      discMeshes.forEach((mesh, k) => {
        const on = k < plan.discs;
        mesh.visible = on;
        discCaps[k].visible = on;
        if (!on) return;
        const y = -(k + 0.5) * DISC.length * STRING;
        mesh.position.set(0, y, 0);
        discCaps[k].position.set(0, y + DISC.length * 0.45 * STRING, 0);
      });
      armBar.position.set(0, 0.06, 0);
      conductorBall.position.set(0, -plan.discs * DISC.length * STRING - 0.06, 0);
      const inner = DISC.diameter * 0.18 * STRING, outer = DISC.diameter / 2 * STRING, deep = DISC.length * 0.45 * STRING;
      fillLine(creepPath, [[inner, -0.02, 0.01], [outer, -0.02, 0.01], [outer, -deep, 0.01], [inner * 1.6, -deep * 0.6, 0.01], [inner * 1.6, -deep * 1.4, 0.01], [inner, -DISC.length * STRING + 0.02, 0.01], [0, -DISC.length * STRING + 0.02, 0.01], [0, -DISC.length * STRING + 0.02, 0.01], [0, -DISC.length * STRING + 0.02, 0.01]]);
    }
    for (let k = 0; k < plan.discs; k++) discMeshes[k].material.color.setHex(plan.wet ? COLORS.wet : COLORS.glass);
    const railY = -plan.discs * DISC.length * STRING - 0.28;
    marginRail.position.set(0, railY, 0);
    const marginShare = Math.max(0, Math.min(1, plan.margin / 8));
    rect(marginBar, -0.42, -0.42 + marginShare * 0.84, railY - 0.03, railY + 0.03, 0.06);
    fillLine(airGapMark, [[0.3, -0.02, 0.02], [0.3, -0.02 - plan.airGap * STRING, 0.02], [0.27, -0.02 - plan.airGap * STRING, 0.02], [0.33, -0.02 - plan.airGap * STRING, 0.02]]);

    // One cycle of current and the heat it makes.
    const peak = Math.SQRT2 * plan.current;
    const samples = Array.from({length: FLOW_SAMPLES}, (_, i) => lineAt(plan, plan.duration * i / (FLOW_SAMPLES - 1)));
    const shown = clock > 0 ? samples.filter(sample => sample.t <= now.t) : samples;
    const phaseY = value => flowY(0.5 + (peak > 0 ? value / peak : 0) * 0.42);
    phaseCurves.forEach((curve, k) => fillLine(curve, shown.map(sample => [flowX(plan, sample.t), phaseY(sample.phases[k]), FLOW.z])));
    const heatPeak = 3 * peak ** 2 * plan.resistance;
    fillLine(heatCurve, shown.map(sample => [flowX(plan, sample.t), flowY(-0.95 + (heatPeak > 0 ? sample.heat / heatPeak : 0) * 0.85), FLOW.z]));
    const fx = flowX(plan, now.t), fy = phaseY(now.phases[0]);
    fillLine(flowCursor, [[fx - FLOW.cursor, fy, FLOW.z], [fx + FLOW.cursor, fy, FLOW.z], [fx, fy - FLOW.cursor, FLOW.z], [fx, fy + FLOW.cursor, FLOW.z]]);

    // The same power at five voltages.
    plan.ladder.forEach((step, k) => {
      const y = ladderY(k), width = Math.max(0, Math.min(1, step.fraction)) * LADDER.w;
      rect(ladderBars[k], LADDER.x, LADDER.x + Math.max(0.004, width), y, y + LADDER.bar, LADDER.z + 0.002);
    });
    const markY = ladderY(v.voltage);
    fillLine(ladderMark, [[LADDER.x - 0.07, markY, LADDER.z], [LADDER.x - 0.07, markY + LADDER.bar, LADDER.z], [LADDER.x - 0.11, markY + LADDER.bar / 2, LADDER.z], [LADDER.x - 0.03, markY + LADDER.bar / 2, LADDER.z]]);

    const status = plan.overRated
      ? `Over its rating · ${fixed(plan.current, 0)} A through a conductor rated ${fixed(plan.wire.ampacity, 0)} A; ${fixed(100 * plan.lossFraction, 1)} percent of what is sent is lost as heat`
      : clock <= 0 ? `Ready · ${fixed(plan.delivered / 1e6, 0)} MW at ${fixed(plan.volts / 1000, 0)} kV over ${fixed(plan.length / 1000, 0)} km loses ${fixed(100 * plan.lossFraction, 2)} percent; press Play`
      : !now.done ? `Running · ${fixed(Math.abs(now.phases[0]), 0)} A in the first phase, ${fixed(now.heat / 1e6, 2)} MW of heat at this instant`
      : `One cycle done · ${fixed(plan.loss / 1e6, 3)} MW lost on average, ${fixed(now.energy / 1000, 1)} kJ in that cycle`;

    return {
      state: {...plan, now, clock, span, top},
      readings: [
        r('Your result', status),
        r('Line loss', `${fixed(100 * plan.lossFraction, 2)} percent`, `${fixed(plan.delivered / 1e6, 0)} MW at ${fixed(plan.volts / 1000, 0)} kV needs ${fixed(plan.current, 0)} A in each of the three phases, because power is √3 times voltage times current. Three conductors of ${fixed(plan.resistance, 2)} Ω each then waste 3I²R, which is ${fixed(plan.loss / 1e6, 3)} MW, so ${fixed(plan.sent / 1e6, 2)} MW has to be sent for ${fixed(plan.delivered / 1e6, 0)} MW to arrive.`),
        r('Current', `${fixed(plan.current, 0)} A`, `${fixed(100 * plan.ampacityShare, 0)} percent of the ${fixed(plan.wire.ampacity, 0)} A this ${plan.wire.name} conductor is rated for. ${plan.overRated ? 'Beyond that rating the aluminum runs hotter than the 75 °C at which it starts to soften, and a real line would not be run like this.' : 'Raise the voltage and the same power needs less current, which is the whole of the argument for high voltage.'}`),
        r('Resistance', `${fixed(plan.resistance, 2)} Ω`, `${plan.wire.name} is ${plan.wire.stranding} stranded with ${fixed(plan.wire.area * 1e6, 0)} mm² of aluminum, ${fixed(plan.wire.diameter * 1000, 1)} mm across, and its sheet gives ${fixed(plan.wire.ac * 1000, 5)} Ω/km at 75 °C. Over ${fixed(plan.length / 1000, 0)} km that is ${fixed(plan.resistance, 2)} Ω in each phase.`),
        r('Voltage drop', `${fixed(plan.drop / 1000, 2)} kV`, `The current through the line's own resistance leaves ${fixed(plan.drop / 1000, 2)} kV behind, so ${fixed(plan.sending / 1000, 1)} kV has to be sent for ${fixed(plan.volts / 1000, 0)} kV to arrive. That is ${fixed(100 * plan.drop / plan.volts, 2)} percent of the line voltage.`),
        r('Insulator', `${fixed(plan.discs, 0)} discs`, `Each disc gives ${fixed(DISC.leakage * 1000, 1)} mm of creepage, the long way round its outside from cap to pin. At ${fixed(CREEPAGE.low, 0)} mm for every kV, ${fixed(plan.volts / 1000, 0)} kV asks for ${fixed(CREEPAGE.low * plan.volts / 1000, 0)} mm, so the string needs ${fixed(plan.discs, 0)} of them: ${fixed(plan.creepage * 1000, 0)} mm, or ${fixed(plan.creepagePerKv, 1)} mm for every kV, and ${fixed(plan.stringLength, 2)} m long.`),
        r('Flashover', `${fixed(plan.withstand / 1000, 0)} kV ${plan.wet ? 'wet' : 'dry'}`, `A string that long stands about ${fixed(plan.withstand / 1000, 0)} kV before the air beside it breaks down and carries an arc. Against the ${fixed(plan.earthVolts / 1000, 1)} kV this conductor stands above earth, that is ${fixed(plan.margin, 1)} times over. ${plan.wet ? 'Wet, it stands less: water bridges part of the creepage.' : 'Wet it would stand less, and dirt and salt less again.'} The figure comes from a straight line fitted to six units on a maker's sheet, whose creepage runs from 2,164 to 4,350 mm.`),
        r('Leakage', `${fixed(plan.leakage * 1e6, 3)} µA`, `Even while it is holding, an insulator lets a trickle creep along its wet or dusty surface. Here the surface is taken as ${plan.wet ? `${fixed(SITE.wet / 1000, 0)} kΩ` : `${fixed(SITE.dry / 1e6, 0)} MΩ`} for every mm of creepage, which is declared and not from a source, so ${fixed(plan.creepage * 1000, 0)} mm gives ${fixed(plan.surface / 1e9, 2)} GΩ and ${fixed(plan.leakage * 1e6, 3)} µA at ${fixed(plan.earthVolts / 1000, 1)} kV. Wet, the same string leaks a thousand times more.`),
        r('Air gap', `${fixed(plan.airGap * 1000, 0)} mm`, `Air breaks down at ${fixed(AIR_STRENGTH / 1e6, 0)} MV/m, so the peak of ${fixed(plan.earthVolts / 1000, 1)} kV would jump a clean ${fixed(plan.airGap * 1000, 0)} mm gap. The string is ${fixed(plan.stringLength / plan.airGap, 0)} times longer than that, because it also has to hold in rain and dirt and survive the surges a switch or a lightning stroke sends down the line.`),
        r('Sag', `${fixed(plan.sag, 2)} m`, `A conductor weighing ${fixed(plan.weight, 2)} N for every meter, pulled at ${fixed(plan.tension / 1000, 1)} kN, which is ${fixed(plan.values.tension, 0)} percent of the ${fixed(plan.wire.breaking / 1000, 1)} kN that would break it, hangs in a catenary whose constant is ${fixed(plan.a, 0)} m. Over a ${fixed(span, 0)} m span it dips ${fixed(plan.sag, 2)} m below its supports, and the wire itself is ${fixed(plan.arc, 2)} m long, ${fixed(plan.arc - span, 2)} m more than the straight line between them.`),
        r('Pylon', `${fixed(plan.towerHeight, 1)} m`, `${fixed(SITE.clearance, 0)} m of clearance, plus ${fixed(plan.sag, 2)} m of sag, plus ${fixed(plan.stringLength, 2)} m of insulator, plus ${fixed(SITE.headroom, 0)} m of steel above the top crossarm. ${plan.inRange ? `That sits inside the ${fixed(TOWER.low, 0)} to ${fixed(TOWER.high, 0)} m real lattice towers stand.` : `That is outside the ${fixed(TOWER.low, 0)} to ${fixed(TOWER.high, 0)} m real lattice towers stand.`} Each support carries ${fixed(plan.vertical / 1000, 2)} kN of conductor, half of each span either side.`),
        r('Slowed', `${fixed(plan.slow, 0)} times`, `One cycle of ${fixed(SUPPLY.frequency, 0)} Hz lasts ${fixed(plan.duration * 1000, 0)} ms and is drawn in ${fixed(SITE.show, 0)} seconds. The span is drawn at true size, the pylon ${fixed(PYLON / SPAN, 0)} times larger than that and the insulator string ${fixed(STRING / SPAN, 0)} times larger.`),
      ],
    };
  });

  const render = result.update;
  const duration = () => result.getState().duration;
  result.advance = dt => { if (Number.isFinite(dt) && dt > 0) clock = Math.min(duration(), clock + dt * duration() / SITE.show); return render(); };
  result.animate = t => { const dt = Number.isFinite(t) ? Math.max(0, t - lastClock) : 0; if (Number.isFinite(t)) lastClock = t; return result.advance(dt); };
  result.reset = () => { clock = 0; lastClock = 0; return render(result.defaults); };
  const inspect = share => { clock = duration() * share; return render(); };
  result.actions = [
    {label: 'Inspect: the span', part: 'line', view: 'front', replay: false, run() { return render(); }},
    {label: 'Inspect: the pylon', part: 'pylon', view: 'front', replay: false, run() { return render(); }},
    {label: 'Inspect: the insulator', part: 'insulator', view: 'front', replay: false, run() { return render(); }},
    {label: 'Inspect: the current at its peak', part: 'flow', view: 'front', replay: false, run() { return inspect(0); }},
  ];
  result.playback = {
    label: 'Run one cycle',
    description: `One cycle of ${SUPPLY.frequency} Hz, drawn ${SITE.show * SUPPLY.frequency} times slower than it happens.`,
    stepLabel: 'Advance a twelfth of a cycle',
    advance: result.advance,
    step: () => result.advance(SITE.show / 12),
    complete: () => clock >= duration(),
    blocked: () => false,
  };
  result.resultPart = {id: 'ladder', label: 'Inspect the five voltages', view: 'front', focusOnComplete: false, available: () => clock >= duration()};

  kit.root.rotation.set(0.04, -0.1, 0);
  result.initialPart = 'system';
  result.initialView = 'front';
  result.frameVisibleOnly = true;
  result.framePadding = 0.6;
  result.selectionOutline = false;
  result.transparentBackground = true;
  result.topology = {system, line, ground, clearanceLine, spanCurve, towers, sagMark, pylon, towerBody, towerGround, loadArrow, clearArrow, pylonString, pylonWire, insulator, discMeshes, discCaps, creepPath, armBar, conductorBall, marginRail, marginBar, airGapMark, flow, flowFrame, flowZero, phaseCurves, heatCurve, flowCursor, ladder, ladderFrame, ladderBars, ladderMark};
  const dispose = result.dispose;
  result.dispose = () => { if (!disposed) { disposed = true; dispose(); } };
  return result;
}

export const FLOW_SAMPLES = 121;

/**
 * A lattice tower as line segments, already in scene units: two legs tapering
 * to the top, a bar across every bay, and one crossarm. `detailed` adds the
 * diagonals that make a real tower stiff.
 */
export function towerLines(x, height, base, detailed = false) {
  const points = [], top = TOWERART.top * height, arm = TOWERART.arm * height * 0.35;
  const width = y => base * (1 - 0.72 * y / height);
  for (const side of [-1, 1]) points.push([x + side * width(0), 0, 0], [x + side * width(height), height, 0]);
  for (let k = 1; k <= TOWERART.bays; k++) {
    const y0 = height * (k - 1) / TOWERART.bays, y1 = height * k / TOWERART.bays;
    points.push([x - width(y1), y1, 0], [x + width(y1), y1, 0]);
    if (detailed) points.push([x - width(y0), y0, 0], [x + width(y1), y1, 0], [x + width(y0), y0, 0], [x - width(y1), y1, 0]);
  }
  points.push([x - arm, height - top, 0], [x + arm, height - top, 0]);
  return points;
}

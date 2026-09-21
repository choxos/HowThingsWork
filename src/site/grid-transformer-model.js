import * as THREE from 'three';
import {houseModel, reading as r} from './house-model-kit.js';
import {fixed} from './format.js';
import {fillLine, lineObject, segmentLines, solidArrow} from './scene-kit.js';
import {transformerPlan, transformerAt, TRANSFORMER_DEFAULTS, TRANSFORMER_DOMAINS, TRANSFORMER_SAMPLES, STAGE_OPTIONS, CORE_OPTIONS, WINDING_OPTIONS, STAGES, WINDING, CORE_STEEL, TIER_TWO, SUPPLY, kvLabel} from './grid-physics.js';

// ---------------------------------------------------------------------------
// The transformer: two windings on one iron core, at the three places on the
// way from the power station to the house where the voltage is changed.
//
// Scale: the core's leg is drawn at true size, 1 m to 0.6 scene units, so the
// leg thickens from 173 mm at the house to 949 mm at the station and the three
// stages differ in size on the screen. The window inside the core is drawn the
// same 1.2 by 1.8 m at every stage, which is not true of a real machine, and
// every turn drawn stands for 20 real turns. Both are said in the part text and
// in a reading. The charts are not to scale.
//
// Time: two 50 Hz cycles are drawn in 8 seconds, so the machine runs 200 times
// slower than it does.
// ---------------------------------------------------------------------------

/** Scene units per meter for the core's leg, at true size. */
export const CORE_SCALE = 0.6;
/** The window inside the core, m: the same at every stage, which is declared. */
export const WINDOW = Object.freeze({width: 1.2, height: 1.8, clearance: 0.08, segments: 8});
export const CORE_AT = Object.freeze([-1.75, 0.45, 0]);
export const CYCLE = Object.freeze({x: 0.3, y: 1.05, w: 2.8, h: 1, z: 0, cursor: 0.07, tick: 0.05});
/** The loss bars are drawn `magnify` times larger than the output bar, or they would not show at all. */
export const BARS = Object.freeze({x: 0.3, y: -1.45, w: 2.8, h: 0.24, gap: 0.12, z: 0, magnify: 60});
export const LOADVIEW = Object.freeze({x: -1.75, y: -1.5, z: 0, width: 2.3, height: 0.5, arrow: 0.035});
export const COLORS = Object.freeze({iron: 0xb4c5b0, primary: 0x2b5d9c, secondary: 0xce825f, ink: 0x374736, faint: 0x9aa39a, flux: 0xe3b45e, magnet: 0x8f5fa8, output: 0x6f9c5a, copperLoss: 0xc14f39, coreLoss: 0xd9822b, board: 0xf0dfaf, aluminum: 0xa9b4bd, amorphous: 0x7f8c93, effort: 0xd9822b});

/** Where a time and a share of full scale fall on the cycle chart. */
export const cycleX = (plan, t) => CYCLE.x + Math.max(0, Math.min(1, t / plan.duration)) * CYCLE.w;
export const cycleY = share => CYCLE.y + Math.max(-1, Math.min(1, share)) * CYCLE.h / 2;
/** The side of the core's square leg, m, for a cross section in m². */
export const legOf = area => Math.sqrt(area);

/** One drawn turn around a leg of side `leg`, as a ring of `segments` points at height `y`, in meters. */
export function turnRing(leg, y, segments = WINDOW.segments) {
  const radius = leg / 2 + WINDOW.clearance;
  return Array.from({length: segments + 1}, (_, i) => { const a = 2 * Math.PI * i / segments; return [radius * Math.cos(a), y, radius * Math.sin(a)]; });
}

export function createTransformerModel() {
  const kit = houseModel('Transformer'), {part, control, finish} = kit;
  let clock = 0, lastClock = 0, disposed = false, shownCore = '', shownPrimary = '', shownSecondary = '';
  const unlit = color => new THREE.MeshBasicMaterial({color});
  const flat = (color, parent) => { const mesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), unlit(color)); parent.add(mesh); return mesh; };
  const rect = (mesh, x0, x1, y0, y1, z = 0) => { mesh.position.set((x0 + x1) / 2, (y0 + y1) / 2, z); mesh.scale.set(Math.max(1e-9, x1 - x0), Math.max(1e-9, y1 - y0), 1); };

  const system = part('system', 'One core, two windings, three places', `Two windings on one iron core. The turns ratio sets the voltage ratio, and the current goes the other way, so the same power leaves as came in less what the copper and the core take. The same machine is drawn at three places on the way from the power station to the house. The core's leg is at true size, 1 m to ${fixed(CORE_SCALE, 1)} scene units; every turn drawn stands for ${fixed(WINDING.per, 0)} real turns. Press Play to run ${fixed(WINDING.cycles, 0)} cycles, drawn in ${fixed(WINDING.show, 0)} seconds.`);

  const core = part('core', 'The iron core', `A closed loop of grain oriented silicon steel. The alternating voltage on the primary drives a flux around it that both windings share, and the flux is what carries the power across. The leg is drawn at true size and thickens with the stage; the window inside it is drawn the same ${fixed(WINDOW.width, 1)} by ${fixed(WINDOW.height, 1)} m at every stage, which a real machine is not. The gold arrows follow the flux and turn with it.`, CORE_AT, system);
  const limbs = Array.from({length: 4}, () => kit.box([1, 1, 1], [0, 0, 0], COLORS.iron, core));
  const fluxArrows = Array.from({length: 4}, () => solidArrow(kit, COLORS.flux, core, 0.03));

  const windings = part('windings', 'The two windings', `The primary on the left leg and the secondary on the right, each drawn turn standing for ${fixed(WINDING.per, 0)} real turns. The voltage each winding stands is its turns times the rate the shared flux changes, so their voltages are in the ratio of their turns and nothing else. Change either count and the output follows.`, CORE_AT, system);
  const primaryCoil = segmentLines(TRANSFORMER_DOMAINS.primaryTurns[1] * WINDOW.segments, COLORS.primary, windings);
  const secondaryCoil = segmentLines(TRANSFORMER_DOMAINS.secondaryTurns[1] * WINDOW.segments, COLORS.secondary, windings);

  const cycle = part('cycle', 'Two cycles, drawn out', `The primary voltage, the flux in the core and the magnetizing current the core needs, each drawn against its own peak so the three fit on one chart. The flux is a quarter cycle behind the voltage, because the voltage is what the flux's change makes; the magnetizing current keeps step with the flux. A tick marks every quarter cycle.`, [0, 0, 0], system);
  const cycleFrame = lineObject(5, COLORS.ink, cycle);
  const cycleZero = segmentLines(1, COLORS.faint, cycle);
  const cycleTicks = segmentLines(4 * WINDING.cycles, COLORS.faint, cycle);
  const voltageCurve = lineObject(TRANSFORMER_SAMPLES, COLORS.primary, cycle);
  const fluxCurve = lineObject(TRANSFORMER_SAMPLES, COLORS.flux, cycle);
  const magnetizingCurve = lineObject(TRANSFORMER_SAMPLES, COLORS.magnet, cycle);
  const cycleCursor = segmentLines(2, COLORS.ink, cycle);

  const losses = part('losses', 'Where the power goes', `Three bars against what the machine is rated for: what reaches the load, what the copper wastes and what the core wastes. The two loss bars are drawn ${fixed(BARS.magnify, 0)} times larger than the output bar, or they would be too small to see at all, and that is the point. The copper's share follows the square of the load, so it is nothing at no load and worst at full load. The core's share does not care about the load: it is there whenever the machine is switched on. The upright mark is the load at which the machine is at its best.`, [0, 0, 0], system);
  const barFrame = lineObject(5, COLORS.ink, losses);
  const barMeshes = [flat(COLORS.output, losses), flat(COLORS.copperLoss, losses), flat(COLORS.coreLoss, losses)];
  const bestMark = segmentLines(1, COLORS.ink, losses);

  const load = part('load', 'What the secondary supplies', `The secondary's circuit. The load is set as a share of what the machine is rated for, and the current that share asks for decides the copper loss. The arrows show the current in and out; the steel arrow is what the machine delivers and the orange one is what it draws.`, [LOADVIEW.x, LOADVIEW.y, LOADVIEW.z], system);
  const loadBoard = kit.box([LOADVIEW.width, 0.1, 0.5], [0, -LOADVIEW.height / 2 - 0.05, 0], 'wood', load);
  const loadBox = kit.box([0.8, 0.34, 0.34], [0.55, 0, 0], 'leaf', load);
  const loadWires = [[-1.05, -0.4], [0.95, 1.05]].map(([a, b]) => kit.rod([a, 0, 0], [b, 0, 0], 0.028, COLORS.secondary, load));
  const drawArrow = solidArrow(kit, COLORS.effort, load, LOADVIEW.arrow);
  const deliverArrow = solidArrow(kit, COLORS.iron, load, LOADVIEW.arrow);
  drawArrow.position.set(-1.05, 0.3, 0.05);
  deliverArrow.position.set(0.95, 0.3, 0.05);
  drawArrow.userData.setDirection(new THREE.Vector3(1, 0, 0));
  deliverArrow.userData.setDirection(new THREE.Vector3(1, 0, 0));
  const feed = segmentLines(2, COLORS.secondary, system);

  fillLine(cycleFrame, [[CYCLE.x, CYCLE.y - CYCLE.h / 2, CYCLE.z], [CYCLE.x + CYCLE.w, CYCLE.y - CYCLE.h / 2, CYCLE.z], [CYCLE.x + CYCLE.w, CYCLE.y + CYCLE.h / 2, CYCLE.z], [CYCLE.x, CYCLE.y + CYCLE.h / 2, CYCLE.z], [CYCLE.x, CYCLE.y - CYCLE.h / 2, CYCLE.z]]);
  fillLine(cycleZero, [[CYCLE.x, CYCLE.y, CYCLE.z], [CYCLE.x + CYCLE.w, CYCLE.y, CYCLE.z]]);
  fillLine(cycleTicks, Array.from({length: 4 * WINDING.cycles}, (_, k) => { const x = CYCLE.x + CYCLE.w * (k + 1) / (4 * WINDING.cycles); return [[x, CYCLE.y - CYCLE.h / 2, CYCLE.z], [x, CYCLE.y - CYCLE.h / 2 - CYCLE.tick, CYCLE.z]]; }).flat());
  fillLine(barFrame, [[BARS.x, BARS.y - BARS.h, BARS.z], [BARS.x + BARS.w, BARS.y - BARS.h, BARS.z], [BARS.x + BARS.w, BARS.y + 2 * (BARS.h + BARS.gap), BARS.z], [BARS.x, BARS.y + 2 * (BARS.h + BARS.gap), BARS.z], [BARS.x, BARS.y - BARS.h, BARS.z]]);

  const d = TRANSFORMER_DEFAULTS;
  control('stage', 'Where on the way', ...TRANSFORMER_DOMAINS.stage, d.stage, '', 'The same machine stepping up at the station, down at the grid supply point, and down again before the house.', STAGE_OPTIONS);
  control('primaryTurns', 'Primary turns drawn', ...TRANSFORMER_DOMAINS.primaryTurns, d.primaryTurns, '', `Every turn drawn stands for ${WINDING.per} real turns on the incoming winding.`);
  control('secondaryTurns', 'Secondary turns drawn', ...TRANSFORMER_DOMAINS.secondaryTurns, d.secondaryTurns, '', `Every turn drawn stands for ${WINDING.per} real turns on the outgoing winding.`);
  control('load', 'Load', ...TRANSFORMER_DOMAINS.load, d.load, '%', 'The current the secondary supplies, as a share of what the machine is rated for.');
  control('core', 'Core steel', ...TRANSFORMER_DOMAINS.core, d.core, '', 'Grain oriented silicon steel, or amorphous metal, which cuts core loss by up to 70 percent.', CORE_OPTIONS);
  control('winding', 'Winding metal', ...TRANSFORMER_DOMAINS.winding, d.winding, '', 'Copper, or aluminum of the same cross section, which has 1.68 times the resistivity and so wastes that much more.', WINDING_OPTIONS);

  const result = finish(v => {
    const plan = transformerPlan(v), now = transformerAt(plan, clock);
    const leg = legOf(plan.area), half = (WINDOW.width / 2 + leg / 2) * CORE_SCALE, tall = (WINDOW.height / 2 + leg / 2) * CORE_SCALE;
    const thick = leg * CORE_SCALE, deep = thick;

    // The core, whose leg is as thick as the stage's iron.
    const coreKey = `${plan.stage}`;
    if (shownCore !== coreKey) {
      shownCore = coreKey;
      const sizes = [[thick, 2 * tall + thick, deep, -half, 0], [thick, 2 * tall + thick, deep, half, 0], [2 * half - thick, thick, deep, 0, tall], [2 * half - thick, thick, deep, 0, -tall]];
      limbs.forEach((limb, i) => { const [w, h, dd, x, y] = sizes[i]; limb.scale.set(w, h, dd); limb.position.set(x, y, 0); });
      const seats = [[-half, 0], [0, tall], [half, 0], [0, -tall]];
      fluxArrows.forEach((arrow, i) => { const [x, y] = seats[i]; arrow.position.set(x, y, deep / 2 + 0.02); });
      fillLine(feed, [[CORE_AT[0] + half, CORE_AT[1] - tall - thick / 2, 0], [LOADVIEW.x - 1.05, LOADVIEW.y, 0], [CORE_AT[0] - half, CORE_AT[1] - tall - thick / 2, 0], [LOADVIEW.x + 1.05, LOADVIEW.y, 0]]);
    }
    // The flux arrows follow the flux round the loop and shrink with it.
    const fluxShare = plan.flux > 0 ? now.density / plan.flux : 0;
    const spots = [[0, 1, 0], [1, 0, 0], [0, -1, 0], [-1, 0, 0]];
    fluxArrows.forEach((arrow, i) => {
      const sign = fluxShare >= 0 ? 1 : -1;
      arrow.userData.setDirection(new THREE.Vector3(spots[i][0] * sign, spots[i][1] * sign, 0));
      arrow.userData.setLength(Math.min(0.9, Math.abs(fluxShare) * 0.8));
    });

    // Every turn drawn, filling the window.
    const coilKey = `${plan.stage}:${plan.drawnPrimary}`, secondKey = `${plan.stage}:${plan.drawnSecondary}`;
    if (shownPrimary !== coilKey) {
      shownPrimary = coilKey;
      fillLine(primaryCoil, coilPoints(plan.drawnPrimary, leg, -half));
    }
    if (shownSecondary !== secondKey) {
      shownSecondary = secondKey;
      fillLine(secondaryCoil, coilPoints(plan.drawnSecondary, leg, half));
    }
    primaryCoil.material.color.setHex(v.winding === 1 ? COLORS.aluminum : COLORS.primary);
    secondaryCoil.material.color.setHex(v.winding === 1 ? COLORS.aluminum : COLORS.secondary);
    for (const limb of limbs) limb.material.color.setHex(v.core === 1 ? COLORS.amorphous : COLORS.iron);

    function coilPoints(turns, side, x) {
      const points = [], height = WINDOW.height * CORE_SCALE, pitch = height / (turns + 1);
      for (let k = 0; k < turns; k++) {
        const ring = turnRing(side, 0).map(([px, , pz]) => [x + px * CORE_SCALE, -height / 2 + (k + 1) * pitch, pz * CORE_SCALE]);
        for (let i = 0; i < ring.length - 1; i++) points.push(ring[i], ring[i + 1]);
      }
      return points;
    }

    // The cycle, with each curve against its own peak.
    const scaled = (samples, pick, peak) => samples.map(sample => [cycleX(plan, sample.t), cycleY(peak > 0 ? pick(sample) / peak : 0), CYCLE.z]);
    const shown = plan.chart.filter(sample => sample.t <= now.t);
    const drawn = clock > 0 ? shown : plan.chart;
    fillLine(voltageCurve, scaled(drawn, sample => sample.primaryVoltage, Math.SQRT2 * plan.primaryVolts));
    fillLine(fluxCurve, scaled(drawn, sample => sample.density, plan.flux));
    fillLine(magnetizingCurve, scaled(drawn, sample => sample.magnetizing, Math.SQRT2 * plan.magnetizing));
    const cx = cycleX(plan, now.t), cy = cycleY(now.primaryVoltage / (Math.SQRT2 * plan.primaryVolts));
    fillLine(cycleCursor, [[cx - CYCLE.cursor, cy, CYCLE.z], [cx + CYCLE.cursor, cy, CYCLE.z], [cx, cy - CYCLE.cursor, CYCLE.z], [cx, cy + CYCLE.cursor, CYCLE.z]]);

    // Where the power goes, three bars on one scale.
    const full = plan.rating;
    const shares = [plan.output, plan.copperLoss * BARS.magnify, plan.coreLoss * BARS.magnify];
    barMeshes.forEach((bar, i) => {
      const y = BARS.y + i * (BARS.h + BARS.gap), width = Math.max(0, Math.min(1, shares[i] / full)) * BARS.w;
      rect(bar, BARS.x, BARS.x + width, y, y + BARS.h, BARS.z + 0.002);
      bar.visible = width > 1e-6;
    });
    const bestX = BARS.x + Math.max(0, Math.min(1, plan.bestShare)) * BARS.w;
    fillLine(bestMark, [[bestX, BARS.y - BARS.h, BARS.z], [bestX, BARS.y + 2 * (BARS.h + BARS.gap), BARS.z]]);

    // The load.
    loadBox.scale.x = Math.max(0.2, 0.2 + plan.share);
    drawArrow.userData.setLength(Math.min(0.7, plan.share * 0.6 + (plan.share > 0 ? 0.05 : 0)));
    deliverArrow.userData.setLength(Math.min(0.7, plan.share * 0.6));

    const nominal = Math.abs(plan.secondaryVolts - plan.nominalSecondary) < 1e-6;
    const status = plan.share === 0
      ? `No load · the secondary supplies nothing, yet the core still takes ${fixed(plan.coreLoss / 1000, 2)} kW to stay magnetized`
      : clock <= 0 ? `Ready · ${plan.place.name}, ${kvLabel(plan.primaryVolts)} in and ${kvLabel(plan.secondaryVolts)} out at ${fixed(plan.share * 100, 0)} percent of ${fixed(plan.rating / 1e6, 3)} MVA; press Play`
      : !now.done ? `Running · ${kvLabel(plan.secondaryVolts)} out, ${fixed(100 * plan.efficiency, 3)} percent of what comes in`
      : `Two cycles done · ${fixed(plan.output / 1e6, 3)} MW delivered, ${fixed(plan.loss / 1000, 2)} kW wasted`;

    return {
      state: {...plan, now, clock, leg, nominal},
      readings: [
        r('Your result', status),
        r('Turns ratio', `${fixed(plan.drawnSecondary, 0)} to ${fixed(plan.drawnPrimary, 0)}`, `${fixed(plan.drawnPrimary, 0)} turns drawn stand for ${fixed(plan.primaryTurns, 0)} real turns and ${fixed(plan.drawnSecondary, 0)} for ${fixed(plan.secondaryTurns, 0)}. The voltage follows that ratio exactly, ${fixed(plan.ratio, 5)}, and the current follows it upside down, so ampere turns balance on the two sides.`),
        r('Out', kvLabel(plan.secondaryVolts), nominal
          ? `${kvLabel(plan.primaryVolts)} in times ${fixed(plan.ratio, 5)} is ${kvLabel(plan.secondaryVolts)}, which is what this stage is for. ${plan.place.name === 'Home supply' ? 'That is the voltage between two of the three lines at the house; between one line and neutral it is 230 V.' : `A real ${plan.place.name.toLowerCase()} transformer is rated ${fixed(plan.rating / 1e6, 3)} MVA.`}`
          : `${kvLabel(plan.primaryVolts)} in times ${fixed(plan.ratio, 5)} is ${kvLabel(plan.secondaryVolts)}, which is not what this stage is for: ${fixed(plan.place.primaryTurns, 0)} and ${fixed(plan.place.secondaryTurns, 0)} turns drawn would give ${kvLabel(plan.nominalSecondary)}.`),
        r('Currents', `${fixed(plan.primaryCurrent, 1)} A in, ${fixed(plan.secondaryCurrent, 1)} A out`, `At ${fixed(plan.share * 100, 0)} percent of ${fixed(plan.rating / 1e6, 3)} MVA the secondary carries ${fixed(plan.secondaryCurrent, 1)} A. The primary carries that in the inverse ratio of the turns plus what the core itself takes, which is ${fixed(plan.noLoadCurrent, 2)} A at no load.`),
        r('Flux density', `${fixed(plan.flux, 3)} T`, `The universal EMF equation, E = 2π f N A B over √2, ties the voltage to the turns, the core's ${fixed(plan.area, 2)} m² and the flux: ${fixed(plan.primaryTurns, 0)} real turns at ${fixed(SUPPLY.frequency, 0)} Hz leave ${fixed(plan.flux, 3)} T in the iron. Electrical steel's loss is quoted at ${fixed(CORE_STEEL.quoted, 1)} T. Fewer turns mean more flux, and the core loss follows its square.`),
        r('Core loss', `${fixed(plan.coreLoss / 1000, 2)} kW`, `Hysteresis and eddy currents in the iron, there whenever the machine is switched on and not caring what the load does. Eddy losses follow the square of the applied voltage, so here they follow the square of the flux the turns leave. ${v.core === 1 ? 'Amorphous metal cuts it to 30 percent of the silicon steel figure.' : 'Amorphous metal would cut it by up to 70 percent.'}`),
        r('Copper loss', `${fixed(plan.copperLoss / 1000, 2)} kW`, `Heat in the windings' own resistance, following the square of the load: ${fixed(plan.share * 100, 0)} percent of rating gives ${fixed(plan.share ** 2 * 100, 1)} percent of the full load figure of ${fixed(plan.place.loadLoss * plan.windingFactor / 1000, 2)} kW.${v.winding === 1 ? ' Aluminum of the same cross section wastes 1.68 times what copper does.' : ''}`),
        r('Efficiency', plan.efficiency === null ? 'nothing delivered' : `${fixed(100 * plan.efficiency, 3)} percent`, plan.efficiency === null
          ? `With nothing drawn there is nothing to be efficient with, and the core still takes ${fixed(plan.coreLoss / 1000, 2)} kW. A transformer switched on all year pays that bill all year.`
          : `${fixed(plan.output / 1e6, 3)} MW out of ${fixed(plan.input / 1e6, 3)} MW in. The machine is at its best at ${fixed(100 * plan.bestShare, 1)} percent of rating, where the copper loss has grown to equal the core loss; the regulation asks this size for ${fixed(100 * plan.index, 3)} percent there. Typical distribution transformers run between 98 and 99 percent.`),
        r('Magnetizing current', `${fixed(plan.magnetizing, 2)} A`, `The current the core needs to hold its flux. It keeps step with the flux, a quarter cycle behind the voltage, so it carries no power; it is taken here as ${fixed(100 * WINDING.magnetizing, 1)} percent of rated current at rated flux, which is declared and not from a source. With the secondary open, this and the core loss current are the whole of what the machine draws.`),
        r('Reflected', plan.reflected === null ? 'nothing connected' : `${fixed(plan.reflected, 2)} Ω`, plan.reflected === null
          ? 'With no load there is nothing for the primary to see through the core.'
          : `The load of ${fixed(plan.load, 3)} Ω, seen from the primary, is that divided by the square of the turns ratio: ${fixed(plan.reflected, 2)} Ω. A transformer changes what a circuit looks like as surely as it changes its voltage.`),
        r('Slowed', `${fixed(plan.slow, 0)} times`, `${fixed(WINDING.cycles, 0)} cycles of ${fixed(SUPPLY.frequency, 0)} Hz last ${fixed(plan.duration * 1000, 0)} ms and are drawn in ${fixed(WINDING.show, 0)} seconds. The core's leg is drawn at true size, ${fixed(leg * 1000, 0)} mm across; the window is drawn the same at every stage, which is declared.`),
      ],
    };
  });

  const render = result.update;
  const duration = () => result.getState().duration;
  result.advance = dt => { if (Number.isFinite(dt) && dt > 0) clock = Math.min(duration(), clock + dt * duration() / WINDING.show); return render(); };
  result.animate = t => { const dt = Number.isFinite(t) ? Math.max(0, t - lastClock) : 0; if (Number.isFinite(t)) lastClock = t; return result.advance(dt); };
  result.reset = () => { clock = 0; lastClock = 0; return render(result.defaults); };
  const inspect = share => { clock = duration() * share; return render(); };
  result.actions = [
    {label: 'Inspect: the core', part: 'core', view: 'front', replay: false, run() { return inspect(0.25); }},
    {label: 'Inspect: the windings', part: 'windings', view: 'front', replay: false, run() { return inspect(0); }},
    {label: 'Inspect: where the power goes', part: 'losses', view: 'front', replay: false, run() { return render(); }},
    {label: 'Inspect: the load', part: 'load', view: 'front', replay: false, run() { return render(); }},
  ];
  result.playback = {
    label: 'Run two cycles',
    description: `Two cycles of ${SUPPLY.frequency} Hz, drawn ${WINDING.show * SUPPLY.frequency / WINDING.cycles} times slower than they happen.`,
    stepLabel: 'Advance an eighth of a cycle',
    advance: result.advance,
    step: () => result.advance(WINDING.show / (8 * WINDING.cycles)),
    complete: () => clock >= duration(),
    blocked: () => false,
  };
  result.resultPart = {id: 'losses', label: 'Inspect where the power goes', view: 'front', focusOnComplete: false, available: () => clock >= duration()};

  kit.root.rotation.set(0.05, -0.16, 0);
  result.initialPart = 'system';
  result.initialView = 'front';
  result.frameVisibleOnly = true;
  result.framePadding = 0.6;
  result.selectionOutline = false;
  result.transparentBackground = true;
  result.topology = {system, core, limbs, fluxArrows, windings, primaryCoil, secondaryCoil, cycle, cycleFrame, cycleZero, cycleTicks, voltageCurve, fluxCurve, magnetizingCurve, cycleCursor, losses, barFrame, barMeshes, bestMark, load, loadBoard, loadBox, loadWires, drawArrow, deliverArrow, feed, stages: STAGES, tier: TIER_TWO};
  const dispose = result.dispose;
  result.dispose = () => { if (!disposed) { disposed = true; dispose(); } };
  return result;
}

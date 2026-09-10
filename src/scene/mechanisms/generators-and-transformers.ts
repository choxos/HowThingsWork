import * as THREE from 'three';
import type {Mechanism} from '../kit.ts';
import {mat, add, box, cylinder, dial, polyline, TAU} from '../kit.ts';
import {inducedEmfPeak, transformerVolts} from '../../physics.ts';

// ---------------------------------------------------------------------------
// Generators and transformers. Two machines that are the same idea, switched
// between: a coil turned through a field, and a coil sitting still beside
// another one whose current is changing.
//
// The traces are the point of the bench. Each machine has one voltage scale,
// used by both of its traces, and the two machines need different ones because
// the generator here makes some thousands of volts and the transformer works
// from 230. Generator: 2,500 volts to the scene unit. Transformer: 500. Both
// are stated below and neither flatters the picture.
//
// In Generator the lower trace is the voltage the turns on the slider actually
// make in this field at this rate, so doubling the turns doubles the wave, and
// the upper trace is the magnetic flux through the coil, drawn at a fixed
// height because it is not a voltage and cannot share the voltage scale. The
// point of showing both is that the voltage peaks where the flux crosses zero:
// what generates is the rate of change, not the amount.
//
// In Transformer the primary trace is 230 V and the secondary is drawn at
// exactly the turns ratio, so a secondary with a fifth of the turns is a fifth
// as tall. The number of turns drawn on each winding is a different matter: two
// thousand cannot be drawn, so the windings show which side has more and the
// count is rounded to the nearest that fits. The traces carry the ratio.
//
// The coil turns roughly a third of a turn a second on screen against the fifty
// a second the readout names, which is about 140 times slow. A generator at its
// real rate would be a blur.
//
// The coil turns about the vertical, between poles that stand either side of
// it, so its face really does sweep through the field. That is worth stating
// because the mistake is easy to make and impossible to see: a coil spun about
// the axis it faces along keeps its normal square to the field at every moment,
// the flux through it never changes, and a machine drawn that way would
// generate nothing at all while appearing to work perfectly.
// ---------------------------------------------------------------------------

const RUN = 5.6;
const POINTS = 120;
/** Volts to the scene unit, one for each machine, and the flux trace's fixed height. */
const GENERATOR_SCALE = 2500;
const TRANSFORMER_SCALE = 500;
const FLUX_HEIGHT = 0.4;
const ROWS = [3.5, 1.9];
const FIELD = 0.35;
const AREA_M2 = 0.008;
/** The rate the machine runs at, in hertz, before its slider changes it. */
const RATE_HZ = 50;
const PRIMARY_TURNS = 1000;
const PRIMARY_VOLTS = 230;
/** Cycles of the wave drawn across the window. */
const CYCLES = 2;
/**
 * The iron rectangle, and the window it leaves for a winding.
 *
 * The limbs stand either side and the yokes close the loop above and below, so
 * a turn round a limb has only the gap between the yokes to live in. Both
 * windings are laid out from these, rather than from numbers typed twice, so
 * neither can drift into the iron: a turn drawn through a solid yoke is not a
 * winding at all, and from the front it looks precisely like one.
 */
const CORE_Y = 2.3;
const CORE_X = -RUN / 2 - 1.3;
const LIMB_GAP = 1.9;
const YOKE_THICK = 0.34;
const YOKE_REACH = 1.03;
/** The clear window between the two yokes, less a little air at each end. */
const WIND_LOW = CORE_Y - YOKE_REACH + YOKE_THICK / 2 + 0.11;
const WIND_HIGH = CORE_Y + YOKE_REACH - YOKE_THICK / 2 - 0.11;
/** Turns drawn on each winding, and the wire each is drawn with. */
const PRIMARY_DRAWN = 7;
const SECONDARY_DRAWN = 14;
/** More turns in the same window means thinner wire, which is also true of the real thing. */
const PRIMARY_WIRE = 0.06;
const SECONDARY_WIRE = 0.045;
/** Spread n turns evenly across the window, from the bottom of it upward. */
const windingY = (i: number, count: number) =>
  WIND_LOW + (i * (WIND_HIGH - WIND_LOW)) / (count - 1);
/** The largest peak the slider can make, which fixes the lamp's brightness scale. */
const FULL_PEAK = inducedEmfPeak(2000, FIELD, AREA_M2, 120);

export function buildGeneratorsAndTransformers(): Mechanism {
  const group = new THREE.Group();

  const bed = box(group, [RUN + 3.6, 0.24, 3], 'deck');
  bed.position.y = 0.12;

  // Everything to do with making the change: the turning coil, or the primary.
  const coil = new THREE.Group();
  const rotor = new THREE.Group();
  for (const side of [-1, 1]) {
    const long = box(rotor, [0.07, 1.1, 0.07], 'accent');
    long.position.set(side * 0.42, 0, 0);
  }
  for (const end of [-1, 1]) {
    const short = box(rotor, [0.84, 0.07, 0.07], 'accent');
    short.position.set(0, end * 0.55, 0);
  }
  rotor.position.set(-RUN / 2 - 1.3, 2.3, 0);
  coil.add(rotor);
  // The primary winding, which stands still and does the same job by changing.
  const primary = new THREE.Group();
  for (let i = 0; i < PRIMARY_DRAWN; i += 1) {
    // The turns go round the limb, not through it: the limb runs vertically, so
    // the axis of each turn has to be vertical too. And they stack inside the
    // window the yokes leave, never across one.
    const turn = add(primary, new THREE.TorusGeometry(0.46, PRIMARY_WIRE, 8, 20), mat('accent'));
    turn.rotation.x = Math.PI / 2;
    turn.position.set(CORE_X, windingY(i, PRIMARY_DRAWN), 0);
  }
  coil.add(primary);
  group.add(coil);

  // The field: a permanent pair of poles, or the iron core that carries the
  // change from one winding to the other.
  const field = new THREE.Group();
  const poles = new THREE.Group();
  for (const side of [-1, 1]) {
    const pole = box(poles, [0.3, 1.5, 1], side < 0 ? 'stone' : 'dark');
    pole.position.set(-RUN / 2 - 1.3 + side * 0.95, 2.3, 0);
  }
  field.add(poles);
  const core = new THREE.Group();
  // A closed rectangle of iron, which is what keeps the field inside it.
  for (const end of [-1, 1]) {
    const limb = box(core, [YOKE_THICK, 2.4, 0.6], 'stone');
    limb.position.set(CORE_X + (end < 0 ? 0 : LIMB_GAP), CORE_Y, 0);
  }
  for (const end of [-1, 1]) {
    const yoke = box(core, [LIMB_GAP + YOKE_THICK, YOKE_THICK, 0.6], 'stone');
    yoke.position.set(CORE_X + LIMB_GAP / 2, CORE_Y + end * YOKE_REACH, 0);
  }
  field.add(core);
  group.add(field);

  const output = new THREE.Group();
  // Slip rings for the generator, and the secondary winding for the transformer.
  const rings = new THREE.Group();
  // The rings ride the shaft, so they turn about the upright axis the coil
  // turns about. Rings set across that axis belong to some other machine: they
  // would have to be on a shaft running the other way, and the coil is not on
  // that shaft.
  const SHAFT_BOTTOM = 0.6;
  const shaft = cylinder(rings, 0.07, CORE_Y - 0.55 - SHAFT_BOTTOM, 'dark', 12);
  shaft.position.set(CORE_X, (CORE_Y - 0.55 + SHAFT_BOTTOM) / 2, 0);
  for (const i of [0, 1]) {
    const ring = cylinder(rings, 0.24, 0.14, 'steel', 20);
    ring.position.set(CORE_X, SHAFT_BOTTOM + 0.24 + i * 0.34, 0);
  }
  // A brush bearing on each ring, and leads from them out to the line, so the
  // output has somewhere to go.
  for (const [i, side] of [1, -1].entries()) {
    const brush = box(rings, [0.16, 0.14, 0.16], 'steel');
    brush.position.set(CORE_X + side * 0.31, SHAFT_BOTTOM + 0.24 + i * 0.34, 0);
    const lead = box(rings, [0.06, 0.06, 0.7], 'steel');
    lead.position.set(CORE_X + side * 0.31, SHAFT_BOTTOM + 0.24 + i * 0.34, -0.45);
  }
  const tail = box(rings, [3.2, 0.06, 0.06], 'steel');
  tail.position.set(-RUN / 2 + 0.3, SHAFT_BOTTOM + 0.24, -0.8);
  output.add(rings);
  const secondary = new THREE.Group();
  const secondaryTurns = Array.from({length: SECONDARY_DRAWN}, (_, i) => {
    const turn = add(secondary, new THREE.TorusGeometry(0.46, SECONDARY_WIRE, 8, 20), mat('steel'));
    turn.rotation.x = Math.PI / 2;
    turn.position.set(CORE_X + LIMB_GAP, windingY(i, SECONDARY_DRAWN), 0);
    return turn;
  });
  output.add(secondary);
  group.add(output);

  const traces = new THREE.Group();
  for (const y of ROWS) {
    const rule = box(traces, [RUN + 0.3, 0.02, 0.02], 'dark');
    rule.position.set(0.9, y, -0.08);
  }
  const inputTrace = polyline(traces, 'accent', POINTS, 0.045);
  const outputTrace = polyline(traces, 'steel', POINTS, 0.045);
  output.add(traces);

  const load = new THREE.Group();
  const line = box(load, [1.4, 0.08, 0.08], 'steel');
  line.position.set(RUN / 2 + 0.9, 1.1, 0);
  const bulb = add(load, new THREE.SphereGeometry(0.3, 20, 14), mat('accent'));
  const bulbMaterial = bulb.material as THREE.MeshStandardMaterial;
  bulbMaterial.transparent = true;
  bulbMaterial.opacity = 0.6;
  bulb.position.set(RUN / 2 + 1.7, 1.1, 0);
  group.add(load);

  const points = Array.from({length: POINTS + 1}, () => new THREE.Vector2());
  /** A sine along the window; a quarter turn of lead makes it a cosine. */
  const wave = (y: number, amplitude: number, drift: number, lead = 0) => {
    for (let i = 0; i <= POINTS; i += 1) {
      const t = i / POINTS;
      points[i].set(0.9 - RUN / 2 + t * RUN, y + amplitude * Math.sin((t * CYCLES - drift + lead) * TAU));
    }
    return points;
  };

  const anchors = {
    coil: new THREE.Vector3(-RUN / 2 - 1.3, 3.9, 0),
    field: new THREE.Vector3(-RUN / 2 - 1.3, 0.9, 0.8),
    output: new THREE.Vector3(0.9, ROWS[0] + 1, 0),
    load: new THREE.Vector3(RUN / 2 + 1.7, 1.9, 0),
  };

  return {
    group,
    view: new THREE.Vector3(0, 0.24, 1).normalize(),
    parts: {coil, field, output, load},
    anchors,
    reach: 5.6,
    update(state) {
      const {value, variant, elapsed} = state;
      // The voltage a coil makes is the turns times the field times the area
      // times how fast it goes round, and only the turns could be set. Doubling
      // the rate doubles the voltage, which is why a generator is run at a rate
      // and not merely spun.
      const rateHz = dial(state, 'rate', RATE_HZ);
      const isTransformer = variant === 'transformer';
      rotor.visible = !isTransformer;
      poles.visible = !isTransformer;
      primary.visible = isTransformer;
      core.visible = isTransformer;
      rings.visible = !isTransformer;
      secondary.visible = isTransformer;

      const drift = elapsed * 0.35;

      if (isTransformer) {
        const secondaryVolts = transformerVolts(PRIMARY_VOLTS, PRIMARY_TURNS, value);
        // Two thousand turns cannot be drawn. The winding shows which side has
        // more, rounded to the nearest count that fits beside the primary's
        // seven; the traces below carry the ratio exactly.
        const drawnTurns = Math.max(1, Math.min(14, Math.round((value / PRIMARY_TURNS) * 7)));
        for (let i = 0; i < secondaryTurns.length; i += 1) secondaryTurns[i].visible = i < drawnTurns;
        inputTrace(wave(ROWS[0], PRIMARY_VOLTS / TRANSFORMER_SCALE, drift));
        outputTrace(wave(ROWS[1], secondaryVolts / TRANSFORMER_SCALE, drift));
        bulbMaterial.emissive.setHex(0xf2905c);
        bulbMaterial.emissiveIntensity = Math.min(1.3, (secondaryVolts / PRIMARY_VOLTS) * 0.9);
      } else {
        const peak = inducedEmfPeak(value, FIELD, AREA_M2, rateHz);
        // The coil turns about the vertical, so its face sweeps through the
        // field between the poles either side of it. Turning it about the axis
        // it faces along would keep its normal square to the field for ever,
        // the flux through it would never change, and nothing would generate.
        //
        // The quarter turn of head start puts the face square to the field at
        // the start of each cycle, so the flux really is at its greatest where
        // the upper trace says it is.
        rotor.rotation.y = Math.PI / 2 + drift * TAU;
        // Flux above, voltage below, both read from the same coil angle. The
        // coil starts with its face square to the field, so the flux through it
        // starts at its greatest and follows a cosine, and the voltage, being
        // the rate that flux changes, follows a sine. The wave below therefore
        // peaks exactly where the one above crosses zero, which is the whole of
        // induction, and both traces agree with where the coil actually is.
        inputTrace(wave(ROWS[0], FLUX_HEIGHT, drift, 0.25));
        outputTrace(wave(ROWS[1], peak / GENERATOR_SCALE, drift, 0.5));
        bulbMaterial.emissive.setHex(0xf2905c);
        bulbMaterial.emissiveIntensity = Math.min(1.3, (peak / FULL_PEAK) * 1.3);
      }

      anchors.output.set(0.9, ROWS[0] + 0.9, 0);
    },
  };
}

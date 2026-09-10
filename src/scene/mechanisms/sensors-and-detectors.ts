import * as THREE from 'three';
import type {Mechanism} from '../kit.ts';
import {mat, add, box, cylinder, dial} from '../kit.ts';
import {
  dividerVoltage,
  rtdResistance,
  seebeckVoltage,
  thermistorResistance,
} from '../../physics.ts';

// ---------------------------------------------------------------------------
// Sensors and detectors. A potential divider standing upright: the supply rail
// at the top, a fixed resistance, the node the reading is taken from, and the
// sensing element below it down to the ground rail.
//
// The circuit stands still and only the bars move. That division of labor is
// deliberate: a drawn resistor that grows and shrinks with its share of the
// voltage would have to slide through the sensor below it and past the rail
// above, which is a picture of nothing. The components keep their places and
// their leads stay joined, and the two bars beside them carry the reading.
//
// The bars are the two halves of the divider at their share of the supply. The
// node is wherever they meet, and their heights are the true fractions, so at
// equal resistances it sits exactly halfway and nowhere else.
//
// The thermocouple has no divider at all, because it makes its own voltage. In
// that variant the bars are put away and the needle reads the junction directly.
// The needle spans the range the readout gives, on a scale stated per variant,
// because a thermistor's ohms and a thermocouple's millivolts cannot share one.
// ---------------------------------------------------------------------------

const RAIL_Y = 4.2;
const GROUND_Y = 0.5;
const NODE_X = 0;
/**
 * Where the two reading bars stand. Clear of the heat block, which reaches to
 * x = 1.76: a bar drawn inside solid metal is a reading nobody can take.
 */
const BAR_X = 2.45;
const SUPPLY = 5;
/**
 * The fixed half of the divider, chosen to match each sensor near the middle of
 * its range. A 10 k resistor above a 100 ohm platinum element would leave the
 * node pinned near the ground rail and nothing would be visible; matching it is
 * what a real instrument does, and the difference in sensitivity that remains
 * between the two sensors is the real difference, not an artifact of the choice.
 */
/** The fixed half of the divider, matched to each sensor, before its slider. */
const FIXED_OHMS = {thermistor: 10000, platinum: 120};
const THERMISTOR_OHMS = 10000;
const THERMISTOR_BETA = 3950;
const RTD_OHMS = 100;
const RTD_ALPHA = 0.00385;
const SEEBECK_UV = 41;
const COLD_JUNCTION_C = 20;
/** The temperatures at the ends of the slider, which fix the meter's scale. */
const COLDEST = -20;
const HOTTEST = 200;
/** How far the needle swings from one end of its scale to the other, in radians. */
const SWEEP = 2.2;

export function buildSensorsAndDetectors(): Mechanism {
  const group = new THREE.Group();

  const board = box(group, [6.6, 0.2, 2], 'deck');
  board.position.y = 0.1;

  const divider = new THREE.Group();
  for (const y of [RAIL_Y, GROUND_Y]) {
    const rail = box(divider, [3.4, 0.1, 0.1], 'steel');
    rail.position.set(NODE_X, y, 0);
  }
  // The fixed half of the divider, in its own fixed place, with leads that
  // reach the rail above it and the node below it and stay joined to both.
  const UPPER_TOP = RAIL_Y - 0.5;
  const UPPER_BOTTOM = 2.7;
  const upper = box(divider, [0.44, UPPER_TOP - UPPER_BOTTOM, 0.44], 'stone');
  upper.position.set(NODE_X, (UPPER_TOP + UPPER_BOTTOM) / 2, 0);
  const NODE_Y = 2.35;
  [
    [RAIL_Y, UPPER_TOP],
    [UPPER_BOTTOM, NODE_Y],
    [NODE_Y, (RAIL_Y + GROUND_Y) / 2 - 0.74],
    [(RAIL_Y + GROUND_Y) / 2 - 1.26, GROUND_Y],
  ].forEach(([from, to]) => {
    const wire = cylinder(divider, 0.05, Math.abs(from - to), 'steel', 10);
    wire.position.set(NODE_X, (from + to) / 2, 0);
  });
  // The node on the circuit itself, which never moves, and the one on the bars,
  // which does. The bar is the reading; the circuit is the arrangement.
  const tap = cylinder(divider, 0.1, 0.1, 'accent', 16);
  tap.rotation.x = Math.PI / 2;
  tap.position.set(NODE_X, NODE_Y, 0.2);
  const tapLead = box(divider, [BAR_X - NODE_X, 0.05, 0.05], 'accent');
  tapLead.position.set((NODE_X + BAR_X) / 2, NODE_Y, 0.2);

  // The two bars: the share of the supply across each half of the divider.
  const upperBar = box(divider, [0.34, 1, 0.34], 'stone');
  const lowerBar = box(divider, [0.34, 1, 0.34], 'accent');
  const node = cylinder(divider, 0.12, 0.12, 'accent', 16);
  group.add(divider);

  const sensor = new THREE.Group();
  // A thermistor bead on two legs.
  const bead = new THREE.Group();
  const pellet = add(bead, new THREE.SphereGeometry(0.26, 18, 12), mat('dark'));
  pellet.position.set(NODE_X, (RAIL_Y + GROUND_Y) / 2 - 1, 0);
  sensor.add(bead);
  // A platinum element: fine wire wound up a former, which is what gives a
  // hundred ohms of platinum a size a hand could hold. Each turn lies across
  // the direction they stack in, or a turn 0.44 wide stacked every 0.14 would
  // run straight through the three turns above and below it.
  const platinum = new THREE.Group();
  for (let i = 0; i < 6; i += 1) {
    const turn = add(platinum, new THREE.TorusGeometry(0.22, 0.035, 8, 18), mat('steel'));
    turn.rotation.x = Math.PI / 2;
    turn.position.set(NODE_X, (RAIL_Y + GROUND_Y) / 2 - 1.35 + i * 0.14, 0);
  }
  sensor.add(platinum);
  // A thermocouple: two different metals meeting at a point.
  const junction = new THREE.Group();
  // The legs lean together at the bottom, which is where the junction is. Lean
  // them the other way and they meet in the air above it, with the junction
  // hanging below touching neither: the one thing a thermocouple is.
  for (const side of [-1, 1]) {
    const leg = box(junction, [0.06, 1.1, 0.06], side < 0 ? 'accent' : 'steel');
    leg.rotation.z = -side * 0.34;
    leg.position.set(NODE_X + side * 0.19, (RAIL_Y + GROUND_Y) / 2 - 0.6, 0);
  }
  const tip = add(junction, new THREE.SphereGeometry(0.13, 14, 10), mat('accent'));
  tip.position.set(NODE_X, (RAIL_Y + GROUND_Y) / 2 - 1.14, 0);
  sensor.add(junction);
  group.add(sensor);

  // The block whose temperature the slider sets, glowing with it.
  const reference = new THREE.Group();
  // The block touches the sensing element, because a temperature sensor that is
  // not in contact with the thing it measures reads the room instead.
  const block = box(reference, [1.5, 1.4, 1], 'dark');
  block.position.set(NODE_X + 1.01, (RAIL_Y + GROUND_Y) / 2 - 1, 0);
  const blockMaterial = block.material as THREE.MeshStandardMaterial;
  const coldEnd = box(reference, [0.5, 0.3, 0.5], 'steel');
  coldEnd.position.set(NODE_X - 1.2, GROUND_Y + 0.25, 0);
  group.add(reference);

  const meter = new THREE.Group();
  const face = cylinder(meter, 1, 0.14, 'dark', 32);
  face.rotation.x = Math.PI / 2;
  face.position.set(-2.9, 2.4, 0);
  for (let i = 0; i <= 8; i += 1) {
    const tickAngle = SWEEP / 2 - (i / 8) * SWEEP;
    const tick = box(meter, [0.04, 0.16, 0.02], 'steel');
    tick.position.set(-2.9 + Math.sin(tickAngle) * 0.82, 2.4 + Math.cos(tickAngle) * 0.82, 0.09);
    tick.rotation.z = -tickAngle;
  }
  const needle = new THREE.Group();
  // Short enough to stay on its dial at either end of the sweep.
  const pointer = box(needle, [0.05, 1.05, 0.03], 'accent');
  pointer.position.y = 0.375;
  needle.position.set(-2.9, 2.4 - 0.2, 0.11);
  meter.add(needle);
  group.add(meter);

  const anchors = {
    sensor: new THREE.Vector3(NODE_X + 0.9, (RAIL_Y + GROUND_Y) / 2 - 1, 0),
    divider: new THREE.Vector3(BAR_X + 0.7, (RAIL_Y + GROUND_Y) / 2, 0),
    meter: new THREE.Vector3(-2.9, 3.8, 0),
    reference: new THREE.Vector3(NODE_X - 1.5, GROUND_Y - 0.7, 0.6),
  };

  return {
    group,
    view: new THREE.Vector3(0, 0.22, 1).normalize(),
    parts: {sensor, divider, meter, reference},
    anchors,
    update(state) {
      const {value, variant} = state;
      // The fixed half of the divider decides where the reading sits and how
      // fast it moves: match it to the sensor and the meter sweeps, mismatch it
      // and the node pins against a rail and nothing is visible at all. That is
      // a real choice a designer makes, and it was buried in a constant.
      const trim = dial(state, 'fixed', 100) / 100;
      const thermocouple = variant === 'thermocouple';
      const platinumHere = variant === 'platinum';
      bead.visible = !thermocouple && !platinumHere;
      platinum.visible = platinumHere;
      junction.visible = thermocouple;
      coldEnd.visible = thermocouple;

      // The block glows with the temperature on the slider, across the whole span.
      const heat = (value - COLDEST) / (HOTTEST - COLDEST);
      blockMaterial.emissive.setHex(0xf2905c);
      blockMaterial.emissiveIntensity = heat * 1.2;

      const span = RAIL_Y - GROUND_Y;
      if (thermocouple) {
        // Nothing is divided and nothing is supplied, so the rails, the fixed
        // resistance, the leads and the bars all go away together.
        for (const child of divider.children) child.visible = false;
        const volts = seebeckVoltage(SEEBECK_UV, value - COLD_JUNCTION_C);
        const full = seebeckVoltage(SEEBECK_UV, HOTTEST - COLD_JUNCTION_C);
        const coldest = seebeckVoltage(SEEBECK_UV, COLDEST - COLD_JUNCTION_C);
        needle.rotation.z = -(SWEEP * ((volts - coldest) / (full - coldest) - 0.5));
        return;
      }

      for (const child of divider.children) child.visible = true;

      const ohms = platinumHere
        ? rtdResistance(RTD_OHMS, RTD_ALPHA, value)
        : thermistorResistance(THERMISTOR_OHMS, THERMISTOR_BETA, value + 273.15);
      const output = dividerVoltage(SUPPLY, (platinumHere ? FIXED_OHMS.platinum : FIXED_OHMS.thermistor) * trim, ohms);
      // The node sits at the fraction of the supply the lower half takes, which
      // is exactly where the two bars meet.
      const share = output / SUPPLY;
      const nodeY = GROUND_Y + share * span;

      lowerBar.scale.y = Math.max(0.001, share * span);
      lowerBar.position.set(BAR_X, GROUND_Y + (share * span) / 2, 0);
      upperBar.scale.y = Math.max(0.001, (1 - share) * span);
      upperBar.position.set(BAR_X, nodeY + ((1 - share) * span) / 2, 0);
      node.position.set(BAR_X, nodeY, 0.2);
      node.rotation.x = Math.PI / 2;

      needle.rotation.z = -(SWEEP * (share - 0.5));

      anchors.divider.set(BAR_X + 0.7, nodeY, 0);
    },
  };
}

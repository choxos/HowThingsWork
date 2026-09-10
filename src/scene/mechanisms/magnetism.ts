import * as THREE from 'three';
import type {Mechanism} from '../kit.ts';
import {mat, add, box, cylinder, dial as slider, arrow, polyline, pool} from '../kit.ts';
import {solenoidField, solenoidAxisField, dipoleLineRadius, compassDeflection, EARTH_FIELD} from '../../physics.ts';

// ---------------------------------------------------------------------------
// Magnetism. A solenoid lying along the x axis, its field drawn as the closed
// loops a dipole really makes, and a compass standing off one end.
//
// Scale, stated once. The coil is 200 mm long and is drawn 4 scene units long,
// so one unit is 50 mm. It carries 400 turns, and 400 turns cannot be drawn as
// 400 turns at this size: 16 are drawn, and the file and the reader-facing text
// both say so. Everything computed uses the real 400.
//
// The field lines are the dipole form r = a sin squared theta, stretched along
// the axis so the loops span the coil rather than closing inside it. That is an
// illustration of the shape of the field, not a computation of this coil's
// field: a real finite solenoid's lines leave the ends and return outside, and
// the exact expression for them is not what the compass or the readout use.
// What is true of the drawing is that every line closes on itself, none ends in
// mid air, and how many are drawn follows the field strength, which is the
// oldest convention in the subject: line density stands for magnitude.
//
// That count follows the logarithm of the field, and has to. The slider and the
// core between them span four decades, from half a millitesla to seven and a
// half tesla, and a line count in proportion would be four lines at one end and
// sixty thousand at the other. The arrow beside the compass is on the same
// logarithmic scale, so it stays visible for an air core instead of collapsing
// to nothing beside the iron. Both are stated; the readout carries the teslas.
//
// The compass needle is Oersted's experiment. It lies along the sum of two
// fields: the earth's, which is taken as 50 microteslas across the bench, and
// the coil's, computed on the axis with the exact finite solenoid formula
// rather than a far field approximation. The one simplification is the iron
// core, whose effect outside the coil is modeled as the same multiplier that
// applies inside it. Real iron both reshapes the outside field and saturates.
// ---------------------------------------------------------------------------

/** Scene units per millimeter. */
const MM = 0.02;
const COIL_LENGTH = 200 * MM;
const COIL_RADIUS = 26 * MM;
/** Turns on the coil, before its slider winds more on. */
const TURNS = 400;
const DRAWN_TURNS = 16;
const IRON_MU = 600;
const AXIS_Y = 2.1;

/** The weakest and strongest fields the slider can make, which fix the log scale. */
const FAINTEST_FIELD = solenoidField(80, 0.2, 0.2, 1);
const FULL_FIELD = solenoidField(1200, 0.2, 5, IRON_MU);
const DECADES = Math.log10(FULL_FIELD / FAINTEST_FIELD);
const FEWEST_LINES = 4;
const MOST_LINES = 16;
/** How far the dipole loops are stretched along the axis to span the coil. */
const AXIAL_STRETCH = 2.6;
/** Points along one drawn field line. */
const LINE_STEPS = 64;
/** Where the compass stands, in scene units from the middle of the coil. */
const COMPASS_X = COIL_LENGTH / 2 + 1.6;

/**
 * One closed field line of a dipole whose axis lies along x, in the xy plane.
 * The polar form is measured from the axis, so theta runs from one pole round
 * to the other and the line returns to where it started.
 */
function fieldLine(equator: number, side: 1 | -1): THREE.Vector2[] {
  const points: THREE.Vector2[] = [];
  for (let i = 0; i <= LINE_STEPS; i += 1) {
    const theta = (i / LINE_STEPS) * Math.PI;
    const r = dipoleLineRadius(equator, theta);
    points.push(new THREE.Vector2(r * Math.cos(theta) * AXIAL_STRETCH, AXIS_Y + side * r * Math.sin(theta)));
  }
  return points;
}

export function buildMagnetism(): Mechanism {
  const group = new THREE.Group();

  const bench = box(group, [COIL_LENGTH + 4.6, 0.2, 2], 'deck');
  bench.position.y = 0.1;

  const coil = new THREE.Group();
  // Sixteen turns drawn for four hundred wound. The pitch drawn is the coil
  // length divided by the turns drawn, not by the turns counted.
  for (let i = 0; i < DRAWN_TURNS; i += 1) {
    const turn = add(
      coil,
      new THREE.TorusGeometry(COIL_RADIUS, 3.2 * MM, 8, 28),
      mat('accent'),
    );
    turn.rotation.y = Math.PI / 2;
    // Spaced so the outside of the end turns is exactly the stated 200 mm apart,
    // rather than the centers of them.
    const tube = 3.2 * MM;
    const span = COIL_LENGTH - 2 * tube;
    turn.position.set(-span / 2 + (i * span) / (DRAWN_TURNS - 1), AXIS_Y, 0);
  }
  for (const side of [-1, 1]) {
    const lead = cylinder(coil, 3.2 * MM, 0.9, 'accent', 8);
    lead.position.set(side * (COIL_LENGTH / 2 - 0.04), AXIS_Y - 0.45 - COIL_RADIUS, 0);
  }
  // A post that actually reaches the winding it is holding up.
  const postTop = AXIS_Y - COIL_RADIUS;
  const post = box(coil, [0.16, postTop - 0.2, 0.16], 'dark');
  post.position.set(0, (postTop + 0.2) / 2, -0.42);
  group.add(coil);

  const core = new THREE.Group();
  const iron = cylinder(core, COIL_RADIUS - 5 * MM, COIL_LENGTH + 0.3, 'stone', 24);
  iron.rotation.z = Math.PI / 2;
  iron.position.set(0, AXIS_Y, 0);
  group.add(core);

  const field = new THREE.Group();
  const lines = pool(MOST_LINES, () => {
    const holder = new THREE.Group();
    field.add(holder);
    return holder;
  });
  const draw = lines.items.map(holder => polyline(holder, 'steel', LINE_STEPS, 0.035));
  group.add(field);

  const compass = new THREE.Group();
  // The dial faces the reader, so the needle turns in the plane of the picture.
  const dial = cylinder(compass, 0.34, 0.06, 'dark', 28);
  dial.rotation.x = Math.PI / 2;
  dial.position.set(COMPASS_X, AXIS_Y, 0);
  // North on the dial, which is where the needle rests with the coil switched off.
  const northMark = box(compass, [0.05, 0.12, 0.02], 'stone');
  northMark.position.set(COMPASS_X, AXIS_Y + 0.24, 0.04);
  const needle = new THREE.Group();
  const seeking = box(needle, [0.06, 0.28, 0.03], 'accent');
  seeking.position.y = 0.14;
  const trailing = box(needle, [0.06, 0.28, 0.03], 'steel');
  trailing.position.y = -0.14;
  needle.position.set(COMPASS_X, AXIS_Y, 0.05);
  compass.add(needle);
  const strength = arrow(compass, 'accent');
  strength.holder.position.set(COMPASS_X, AXIS_Y + 0.5, 0);
  group.add(compass);

  const anchors = {
    coil: new THREE.Vector3(0, AXIS_Y + COIL_RADIUS + 0.5, 0),
    core: new THREE.Vector3(0, AXIS_Y - COIL_RADIUS - 0.4, 0.5),
    field: new THREE.Vector3(0, AXIS_Y + 1.5, 0),
    compass: new THREE.Vector3(COMPASS_X, AXIS_Y - 0.5, 0.4),
  };

  return {
    group,
    view: new THREE.Vector3(0, 0.3, 1).normalize(),
    parts: {coil, core, field, compass},
    anchors,
    // The longest field line reaches well past the coil, and the framing has to
    // allow for it from the start.
    reach: 3.6,
    update(state) {
      const {value, variant} = state;
      // The field is the turns per meter times the current, and only the current
      // could be set. Two coils of the same length with different windings on
      // them are two different magnets at the same current.
      const turns = slider(state, 'turns', TURNS);
      const withIron = variant === 'iron';
      core.visible = withIron;
      const strengthT = solenoidField(turns, 0.2, value, withIron ? IRON_MU : 1);
      // Four decades of field cannot be drawn in proportion, so the share is the
      // logarithm: nought at the faintest setting the slider allows and one at
      // the strongest. The readout carries the teslas themselves.
      const share = Math.min(1, Math.max(0, Math.log10(strengthT / FAINTEST_FIELD) / DECADES));

      // Line density stands for field strength, so a stronger field is drawn
      // with more lines through the same space, not with fatter ones. Drawn in
      // pairs, one above the axis and one below, so the count is always even and
      // the picture stays symmetric.
      const pairs = Math.round((FEWEST_LINES + share * (MOST_LINES - FEWEST_LINES)) / 2);
      const shown = lines.show(Math.max(FEWEST_LINES, pairs * 2));
      for (let i = 0; i < shown; i += 1) {
        const rung = Math.floor(i / 2) + 1;
        const equator = COIL_RADIUS + (rung * 2.2) / (shown / 2);
        draw[i](fieldLine(equator, i % 2 === 0 ? 1 : -1));
      }

      // The needle rests on north until the coil pulls it round. The coil's own
      // field where the needle stands is computed at that exact distance, and
      // the deflection is the angle between the two fields.
      const acrossT = solenoidAxisField(turns, 0.2, COIL_RADIUS / MM / 1000, value, COMPASS_X / MM / 1000, withIron ? IRON_MU : 1);
      const deflection = compassDeflection(EARTH_FIELD, acrossT);
      // The coil lies to the left, and its field beyond the end points away from
      // it along the bench, so the needle swings clockwise off north.
      needle.rotation.z = -(deflection * Math.PI) / 180;

      // The arrow is on the same logarithmic scale as the lines, so the air core
      // has a visible arrow instead of one six hundred times too short to draw.
      strength.set(0.25 + share * 1.5);

      anchors.field.set(0, AXIS_Y + COIL_RADIUS + 1.4, 0);
    },
  };
}

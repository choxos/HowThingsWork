import * as THREE from 'three';
import type {Mechanism} from '../kit.ts';
import {mat, add, box, cylinder, dial, pool, TAU} from '../kit.ts';
import {trackCount} from '../../studio-controls.ts';

// ---------------------------------------------------------------------------
// Storing bits. A platter turning under a head on a swinging arm, with the
// tracks drawn as rings and the average wait drawn as the half turn it is.
//
// Scale, stated. The band of tracks runs from 15 to 45 mm of radius, drawn from
// 1.2 to 3.6 scene units, so one unit is 12.5 mm. The wedge is a true half of
// the disc, because half a turn is exactly what the average wait comes to.
//
// One thing is drawn coarser than it is, and says so. At 400 tracks per mm the
// band holds twelve thousand rings; ninety are ever drawn, evenly spread across
// the same band, and the readout carries both the real count and the real
// pitch. Past three tracks per millimeter the ring count is at its limit, so
// the drawing answers to the slider in the other way it can: the rings thin
// with the logarithm of the pitch, all the way to the top of the range.
//
// The disc turns at the true ratio between the three spin rates, slowed by a
// common factor so that 5,400 and 15,000 rpm can be told apart by eye. The pale
// half disc is the average wait: half a turn, measured back from the head. The
// small marker is one wanted sector riding the platter round to meet it.
//
// The rings are rebuilt when the ruling changes rather than scaled, because a
// scaled torus grows its own thickness with its radius: the tracks would keep
// the same width in the plane they occupy however finely they were packed, and
// at the top of the slider they would overlap each other. Rebuilding costs one
// pass when the slider moves and nothing at all per frame.
// ---------------------------------------------------------------------------

/** Scene units per millimeter, and the band of radius the tracks occupy. */
const MM = 0.08;
const INNER = 15 * MM;
/** The outer edge of the band, before its slider widens it. */
const OUTER = 45 * MM;
const BAND_MM = 30;
const DISC_Y = 1.4;
/** Sector divisions drawn, against the sixty three the readout counts. */
const DRAWN_SECTORS = 12;
const MOST_RINGS = 90;
/** Turns a second on screen for each thousand rpm, so the three rates stay in ratio. */
const SHOWN_TURNS_PER_KRPM = 0.05;

export function buildStoringBits(): Mechanism {
  const group = new THREE.Group();

  // The deck reaches under everything that stands on it, the head's pivot
  // included: a post ending in mid air outside the bench holds nothing up.
  const base = box(group, [9.8, 0.3, 6], 'deck');
  base.position.set(0.85, 0.15, 0);

  const platter = new THREE.Group();
  const disc = cylinder(platter, OUTER + 0.25, 0.1, 'steel', 64);
  disc.position.set(0, DISC_Y, 0);
  // The spindle runs down to the base, because a platter has to be held up.
  const spindle = cylinder(platter, 0.3, DISC_Y + 0.15, 'dark', 24);
  spindle.position.set(0, (DISC_Y + 0.45) / 2, 0);
  group.add(platter);

  const tracks = new THREE.Group();
  const rings = pool(MOST_RINGS, () => {
    const ring = add(tracks, new THREE.TorusGeometry(1, 0.01, 4, 96), mat('accent'));
    ring.rotation.x = Math.PI / 2;
    ring.position.y = DISC_Y + 0.06;
    return ring;
  });
  /** The ruling the rings were last built for, so they are built only once for it. */
  let builtFor = -1;
  /** The band the rings were last built across, so they rebuild when it moves. */
  let builtBand = -1;
  // The sector divisions, which are the same on every track in this scheme.
  // Twelve are drawn and sixty three are counted, and the drawing says so:
  // sixty three spokes at this size would close into a solid ring and the
  // reader would see no sectors at all. What the twelve are for is the shape of
  // the thing, a track cut into equal arcs; the count is in the readout, and
  // the wait the bench measures is worked out from the real sixty three.
  for (let i = 0; i < DRAWN_SECTORS; i += 1) {
    const spoke = box(tracks, [OUTER - INNER, 0.012, 0.012], 'dark');
    spoke.position.set(
      Math.cos((i / DRAWN_SECTORS) * TAU) * (INNER + OUTER) / 2,
      DISC_Y + 0.06,
      Math.sin((i / DRAWN_SECTORS) * TAU) * (INNER + OUTER) / 2,
    );
    spoke.rotation.y = -(i / DRAWN_SECTORS) * TAU;
  }
  group.add(tracks);

  const head = new THREE.Group();
  const arm = box(head, [2.8, 0.14, 0.4], 'dark');
  const pivot = cylinder(head, 0.28, 1.0, 'dark', 20);
  pivot.position.set(OUTER + 1.6, DISC_Y - 0.05, 0);
  // A post under the pivot, so the arm has something to stand on.
  const pivotPost = box(head, [0.4, DISC_Y - 0.55, 0.4], 'dark');
  pivotPost.position.set(OUTER + 1.6, (DISC_Y - 0.55) / 2 + 0.3, 0);
  const slider = box(head, [0.36, 0.1, 0.3], 'accent');
  // The suspension joining the slider to the arm, so the head is not floating.
  const suspension = box(head, [0.12, 0.2, 0.12], 'dark');
  group.add(head);

  const wait = new THREE.Group();
  // A true half of the disc: the average rotation still to come.
  const wedge = add(
    wait,
    new THREE.CylinderGeometry(OUTER, OUTER, 0.03, 48, 1, false, -Math.PI / 2, Math.PI),
    mat('accent'),
  );
  const wedgeMaterial = wedge.material as THREE.MeshStandardMaterial;
  wedgeMaterial.transparent = true;
  wedgeMaterial.opacity = 0.22;
  wedge.position.set(0, DISC_Y + 0.09, 0);
  const wanted = box(wait, [0.3, 0.06, 0.14], 'accent');
  group.add(wait);

  const anchors = {
    platter: new THREE.Vector3(0, DISC_Y + 1, -OUTER - 0.6),
    tracks: new THREE.Vector3(0, DISC_Y + 0.7, OUTER * 0.7),
    head: new THREE.Vector3(OUTER + 1.6, DISC_Y + 1.1, 0),
    wait: new THREE.Vector3(-OUTER * 0.6, DISC_Y + 0.9, 0),
  };

  return {
    group,
    view: new THREE.Vector3(0.1, 0.66, 1).normalize(),
    parts: {platter, tracks, head, wait},
    anchors,
    update(state) {
      const {value, variant, elapsed} = state;
      // How wide the band of tracks is decides how many there are at a given
      // density, and so the whole capacity: a drive gets bigger by ruling
      // finer or by using more of the platter, and only the first was here.
      const bandMm = dial(state, 'band', BAND_MM);
      const outer = INNER + bandMm * MM;
      const rpm = Number(variant);
      const real = trackCount(value);
      // Every drawn ring stands for the same number of real tracks, and they are
      // spread across the whole band so the picture keeps its extent.
      const drawn = rings.show(Math.min(MOST_RINGS, real));
      const pitch = (outer - INNER) / Math.max(1, real);
      if (builtFor !== value || builtBand !== bandMm) {
        builtFor = value;
        builtBand = bandMm;
        // The track is drawn no wider than the pitch it is packed at, so the
        // rings can never overlap each other however finely they are ruled. The
        // pitch runs over four decades, so the drawn width follows its logarithm
        // and the readout carries the pitch itself. Scaling a torus instead
        // would grow its thickness with its radius, and the rings would keep the
        // same width in the plane the tracks occupy however close they came.
        const width = Math.max(0.0016, Math.min(0.02, 0.004 + 0.006 * Math.log10(pitch / 0.0002)));
        for (let i = 0; i < drawn; i += 1) {
          const at = drawn === 1 ? 0.5 : i / (drawn - 1);
          const radius = INNER + at * (outer - INNER);
          rings.items[i].geometry.dispose();
          rings.items[i].geometry = new THREE.TorusGeometry(radius, width / 2, 4, 96);
        }
      }

      // The disc turns at the true ratio between the rates, slowed for the eye.
      const turned = elapsed * (rpm / 1000) * SHOWN_TURNS_PER_KRPM * TAU;
      platter.rotation.y = turned;
      tracks.rotation.y = turned;

      // The half disc stands still, because the head does: it is the average
      // rotation the drive waits through once the arm is on the right track.
      wait.rotation.y = 0;
      // One wanted sector, riding the platter round to meet the head at +x.
      const sectorAngle = -turned;
      const sectorRadius = (INNER + OUTER) / 2;
      wanted.position.set(Math.cos(sectorAngle) * sectorRadius, DISC_Y + 0.12, Math.sin(sectorAngle) * sectorRadius);
      wanted.rotation.y = -sectorAngle;

      // The arm reaches from its pivot to the track the head is over, so the
      // drawn arm always spans exactly that distance.
      const restRadius = INNER + 0.55 * (OUTER - INNER);
      const pivotX = OUTER + 1.6;
      arm.scale.x = (pivotX - restRadius) / 2.8;
      arm.position.set((pivotX + restRadius) / 2, DISC_Y + 0.45, 0);
      // The head flies clear of the surface and hangs from the arm above it, so
      // the suspension between them spans exactly the gap.
      slider.position.set(restRadius, DISC_Y + 0.2, 0);
      suspension.position.set(restRadius, DISC_Y + 0.32, 0);

      anchors.tracks.set(0, DISC_Y + 0.7, sectorRadius);
    },
  };
}

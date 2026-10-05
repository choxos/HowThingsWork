import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createStaplerModel, MM, DETAIL, BODY, CUT} from './stapler-model.js';
import {staplerPlan, STAPLES} from './stapler-physics.js';
import {staplerCyclePlan} from './stapler-cycle.js';
import {STAPLER_CHART as CHART, STAPLER_CHART_COLORS} from './stapler-charts.js';
import {FEED} from './stapler-feed.js';
import {createPartExplosion} from './part-explosion.js';
import {tally, checkDisposal} from './model-check-kit.mjs';

const t = tally(), model = createStaplerModel(), top = model.topology;
const rootPoint = (object, point = new THREE.Vector3()) => model.root.worldToLocal(object.localToWorld(point.clone())).divideScalar(MM);
const cutPoint = (object, point) => top.detail.worldToLocal(object.localToWorld(point.clone())).divideScalar(MM * DETAIL);
const nearPoint = (actual, expected, label, tolerance = 2e-6) => actual.toArray().forEach((v, i) => t.near(v, expected[i], tolerance, label));
const endpoints = (mesh, into) => [-.5, .5].map(y => into(mesh, new THREE.Vector3(0, y, 0)));
const corners = mesh => {
  mesh.geometry.computeBoundingBox(); const box = mesh.geometry.boundingBox, points = [];
  for (const x of [box.min.x, box.max.x]) for (const y of [box.min.y, box.max.y]) for (const z of [box.min.z, box.max.z]) points.push(new THREE.Vector3(x, y, z));
  return points;
};
let geometryPoses = 0, railContacts = 0, springSamples = 0;
for (let staple = 0; staple < 3; staple++) for (const sheets of [1, 2, 10, 13, 14, 40, 55, 56, 57, 60, 70]) for (const anvil of [0, 1]) {
  const settings = {staple, sheets, anvil}, p = staplerPlan(settings), c = staplerCyclePlan(p);
  const moments = [0, c.pressStart, c.pressStart + p.closed / 4, c.pressStart + p.broken / 4, c.pressStart + (p.touch + p.stack / 2) / 4, c.pressFinish, c.releaseStart + .7, c.releaseStart + 1.1, c.releaseFinish, c.releaseFinish + .4, c.duration];
  for (const time of moments) {
    model.reset({settings, time}); model.root.updateMatrixWorld(true);
    const s = model.getState(), n = s.now, motion = s.motion, S = STAPLES[staple];
    const crown = 17.5 - n.drop, bottom = Math.max(crown - S.leg, 0), half = (S.crown - S.wire) / 2;
    const reach = Math.max(0, S.leg - crown), tip = anvil ? half + reach : half - reach;
    const rods = [
      [[-half, crown - S.wire / 2], [half, crown - S.wire / 2]],
      [[-half, crown - S.wire / 2], [-half, bottom]], [[-half, 0], [-tip, 0]],
      [[half, crown - S.wire / 2], [half, bottom]], [[half, 0], [tip, 0]],
    ];
    rods.forEach(([a, b], i) => {
      const physical = endpoints(top.stapleRods[i], rootPoint), enlarged = endpoints(top.cutRods[i], cutPoint);
      nearPoint(physical[0], [160, a[1], a[0]], 'physical wire starts at expected endpoint');
      nearPoint(physical[1], [160, b[1], b[0]], 'physical wire ends at expected endpoint');
      nearPoint(enlarged[0], [...a, 0], 'enlarged wire starts in one depth plane');
      nearPoint(enlarged[1], [...b, 0], 'enlarged wire ends in one depth plane');
      t.near(top.stapleRods[i].scale.x / MM, S.width, 1e-12, 'true rectangular depth');
      t.near(top.stapleRods[i].scale.z / MM, S.wire, 1e-12, 'true rectangular thickness');
      t.near(top.cutRods[i].scale.x / MM / DETAIL, S.wire, 1e-12, 'enlarged thickness');
      t.near(top.cutRods[i].scale.z / MM / DETAIL, S.width, 1e-12, 'enlarged depth');
    });
    for (const side of [1, 3]) t.near(endpoints(top.cutRods[side], cutPoint)[0].distanceTo(endpoints(top.cutRods[side], cutPoint)[1]) + endpoints(top.cutRods[side + 1], cutPoint)[0].distanceTo(endpoints(top.cutRods[side + 1], cutPoint)[1]), S.leg - S.wire / 2, 2e-7, 'centerline leg length conserved through ideal sharp fold');
    t.ok(anvil || tip >= -1e-9, 'no crossed inward tips');
    const nose = rootPoint(top.magazinePivot, new THREE.Vector3(166 * MM, 0, 0));
    t.near(nose.y, motion.nose, 1e-9, 'drawn nose matches calculated paper contact');
    t.ok(nose.y >= p.stack - 1e-9, 'nose never enters stack');
    const driver = endpoints(top.blade, rootPoint);
    t.near(driver[0].y, motion.driverBottom, 1e-9, 'driver lower edge');
    const contact = top.armPivot.worldToLocal(top.blade.localToWorld(new THREE.Vector3(0, .5, 0))).divideScalar(MM);
    t.near(contact.y, 0, 1e-9, 'ideal driver contact lies on arm line');
    t.near(top.paperBlock.scale.y / MM, p.stack, 1e-12, 'drawn stack thickness');

    const view = top.feedView;
    for (const [i, spare] of view.spares.entries()) {
      t.near(spare.group.position.x / MM, -(i + 1) * S.width + motion.feedTravel, 1e-12, 'each spare advances exactly one pitch');
      for (const local of corners(spare.crown)) {
        const q = top.magazinePivot.worldToLocal(spare.crown.localToWorld(local)).divideScalar(MM);
        t.ok(q.y >= 8.5 - S.wire - 1e-8 && q.y <= 8.5 + 1e-8, 'spare crown stays on tilted rail plane');
      }
      const center = top.magazinePivot.worldToLocal(spare.crown.getWorldPosition(new THREE.Vector3())).divideScalar(MM);
      t.near(center.y - S.wire / 2, 8.5 - S.wire, 1e-9, 'crown underside meets rail top'); railContacts++;
    }
    const backStaple = view.spares.at(-1).group.position.x / MM - S.width / 2;
    t.near(view.follower.position.x / MM, backStaple, 1e-12, 'follower front contacts last staple back face');
    t.ok(3 < FEED.railHalf - FEED.railWidth / 2, 'follower stem fits between rails');
    t.ok(FEED.radius + FEED.wire < FEED.railHalf - FEED.railWidth / 2, 'coil fits between rails');
    const positions = view.spring.object.geometry.attributes.position;
    for (let ring = 0; ring <= view.spring.rings; ring += 40) {
      const center = new THREE.Vector3(); for (let side = 0; side < view.spring.sides; side++) center.add(new THREE.Vector3().fromBufferAttribute(positions, ring * (view.spring.sides + 1) + side)); center.divideScalar(view.spring.sides * MM);
      const fraction = ring / view.spring.rings, angle = 2 * Math.PI * FEED.turns * fraction;
      nearPoint(center, [s.feeding.springLength * fraction, FEED.radius * Math.cos(angle), FEED.radius * Math.sin(angle)], 'coil centerline follows current length', 2e-5);
      for (let side = 0; side < view.spring.sides; side++) {
        const vertex = new THREE.Vector3().fromBufferAttribute(positions, ring * (view.spring.sides + 1) + side).divideScalar(MM);
        t.near(vertex.distanceTo(center), FEED.wire, 2e-5, 'coil wire radius does not stretch'); springSamples++;
      }
    }
    const coilBounds = view.spring.object.geometry.boundingBox;
    t.near(coilBounds.min.x / MM + s.feeding.springStart, FEED.rear, 2e-5, 'rear end turn touches its seat');
    t.near(coilBounds.max.x / MM + s.feeding.springStart, s.feeding.followerBack, 2e-5, 'front end turn touches follower');
    for (const leaf of [top.upperLeaf, top.lowerLeaf]) {
      const vertices = leaf.mesh.geometry.attributes.position;
      for (let i = 0; i < vertices.count; i++) {
        const q = new THREE.Vector3().fromBufferAttribute(vertices, i).divideScalar(MM);
        const lower = leaf === top.upperLeaf ? 9 - q.x * Math.tan(s.turn) + 10 / Math.cos(s.turn) : -.5;
        const upper = leaf === top.upperLeaf ? 27 - q.x * s.slope - 7 * Math.hypot(1, s.slope) : 9 - q.x * Math.tan(s.turn);
        t.ok(q.y >= lower - 5e-6 && q.y <= upper + 5e-6, 'leaf stays between its support surfaces');
      }
    }
    if (reach > 0) {
      t.ok(tip + S.wire / 2 < BODY.anvil.z, 'outward end remains over anvil');
      t.ok(S.wire / 2 < CUT.groove && S.width / 2 < .4, 'folded wire fits physical groove');
    }
    geometryPoses++;
  }
}

// Surface winding is checked against independent analytic helix normals,
// not normals generated from the same triangles.
let outwardTriangles = 0, markerPoses = 0;
for (const staple of [0, 1, 2]) {
  model.reset({settings: {staple}});
  const g = top.feed.geometry, positions = g.attributes.position, normals = g.attributes.normal;
  for (let i = 0; i < g.index.count; i += 3) {
    const ids = [0, 1, 2].map(j => g.index.getX(i + j));
    const [a, b, c] = ids.map(j => new THREE.Vector3().fromBufferAttribute(positions, j));
    const outward = ids.reduce((sum, j) => sum.add(new THREE.Vector3().fromBufferAttribute(normals, j)), new THREE.Vector3());
    t.ok(b.sub(a).cross(c.sub(a)).dot(outward) > 0, 'coil triangles face outward'); outwardTriangles++;
  }
}
for (const hand of [80, 120, 160]) for (const time of [0, 2, 100]) {
  model.reset({settings: {hand}, time}); model.root.updateMatrixWorld(true);
  const state = model.getState(), marker = rootPoint(top.handMarker);
  t.near(marker.x, hand, 1e-10, 'visible press marker follows hand setting');
  t.near(marker.y - .4, 27 - hand * state.slope, 1e-10, 'press marker follows arm surface');
  const rest = 27 + hand / 160 * 8.3;
  t.near(rest - (marker.y - .4), (state.motion.bladeDrop + .3) * hand / 160, 1e-10, 'drawn hand travel has ideal lever ratio');
  markerPoses++;
}

// Read all chart points back into physical coordinates, including maximal force.
const decode = (line, ranges) => Array.from({length: line.geometry.drawRange.count}, (_, i) => [(line.geometry.attributes.position.getX(i) - CHART.x) / CHART.w * ranges.travel, (line.geometry.attributes.position.getY(i) - CHART.y) / CHART.h * ranges.force]);
const area = points => points.reduce((sum, [x, y], i) => i ? sum + (x - points[i - 1][0]) * (y + points[i - 1][1]) / 2 : sum, 0);
let chartCases = 0, chartPoints = 0;
for (let staple = 0; staple < 3; staple++) for (let sheets = 1; sheets <= 70; sheets++) for (const anvil of [0, 1]) for (let hand = 80; hand <= 160; hand += 10) {
  model.reset({settings: {staple, sheets, anvil, hand}}); const s = model.getState(), ranges = s.chartRanges;
  for (const [line, ratio] of [[top.bladeLine, 1], [top.handLine, s.ratio]]) {
    const points = decode(line, ranges); assert.equal(points.length, s.motion.cycle.profile.length);
    points.forEach(([x, y], i) => {
      t.near(x, s.motion.cycle.profile[i].drop / ratio, 2e-6, 'uncropped chart travel');
      t.near(y, s.motion.cycle.profile[i].force * ratio, 3e-5, 'uncropped chart force');
      t.ok(x >= -1e-5 && x <= ranges.travel + 1e-5 && y >= -1e-4 && y <= ranges.force + 1e-4, 'full curve stays inside axes'); chartPoints++;
    });
    t.near(area(points) / 1000, s.motion.cycle.work, 3e-7, 'drawn hand and blade curves preserve equal work');
  }
  chartCases++;
}

let inventories = 0;
for (const time of [0, 3.5]) for (const aspect of [.7, 1.3, 2]) {
  model.reset({time});
  const camera = new THREE.PerspectiveCamera(40, aspect, .01, 200); camera.position.set(2.5, 1.6, 3); camera.lookAt(0, 0, 0); camera.updateMatrixWorld();
  const owned = new Set(); model.root.traverse(o => {if (o.geometry) owned.add(o.geometry); if (o.material) for (const m of Array.isArray(o.material) ? o.material : [o.material]) owned.add(m);});
  let released = 0; const observed = () => released++; for (const r of owned) r.addEventListener('dispose', observed);
  const explosion = createPartExplosion(model, camera, aspect, {width: 600 * aspect, height: 600}); explosion.update(1);
  assert.deepEqual(new Set(explosion.categories.map(c => c.id)), new Set(['base', 'arm', 'magazine', 'springs']));
  const inverse = camera.quaternion.clone().invert();
  const projected = explosion.items.map(u => {
    const b = u.bounds.clone().translate(u.group.position), p = new THREE.Box3();
    for (const x of [b.min.x, b.max.x]) for (const y of [b.min.y, b.max.y]) for (const z of [b.min.z, b.max.z]) p.expandByPoint(new THREE.Vector3(x, y, z).applyQuaternion(inverse));
    return p;
  });
  for (let i = 0; i < projected.length; i++) for (let j = i + 1; j < projected.length; j++) {
    const a = projected[i], b = projected[j]; t.ok(a.max.x < b.min.x || b.max.x < a.min.x || a.max.y < b.min.y || b.max.y < a.min.y, 'inventory pieces do not overlap in viewing plane');
  }
  explosion.dispose(); assert.equal(released, 0, 'inventory does not dispose borrowed resources');
  for (const r of owned) r.removeEventListener('dispose', observed); inventories++;
}
const luminance = hex => [hex >> 16 & 255, hex >> 8 & 255, hex & 255].map(n => n / 255).map(n => n <= .04045 ? n / 12.92 : ((n + .055) / 1.055) ** 2.4).reduce((v, n, i) => v + n * [.2126, .7152, .0722][i], 0);
for (const [name, color] of Object.entries(STAPLER_CHART_COLORS)) t.ok((luminance(0xfbf6e9) + .05) / (luminance(color) + .05) >= (name === 'guide' ? 3 : 4.5), 'chart contrast');
const resources = checkDisposal(model, t);
console.log(JSON.stringify({passed: true, checks: t.count, geometryPoses, railContacts, springSamples, outwardTriangles, markerPoses, chartCases, chartPoints, inventories, resources}));

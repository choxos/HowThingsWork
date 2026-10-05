import assert from 'node:assert/strict';
import {capillaryPlan, capillaryAt, capillaryWedge, capillarySurface, sampleCapillary, CAPILLARY_DOMAINS} from './capillary-physics.js';
import {tally, checkRefusals} from './model-check-kit.mjs';

const t = tally();
const reference = [{gamma: .0728, rho: 1000, angle: 0}, {gamma: .0223, rho: 790, angle: 0}, {gamma: .465, rho: 13600, angle: 140}];
let cases = 0, perimeterIntegrals = 0, wedgeSamples = 0;
for (let liquid = 0; liquid < 3; liquid++) for (let wetting = 0; wetting < 4; wetting++) for (let radiusIndex = 0; radiusIndex < 9; radiusIndex++) for (let depth = 5; depth <= 60; depth += 5) {
  const radius = Number((.1 + .05 * radiusIndex).toFixed(2)), values = {liquid, wetting, radius, depth};
  const p = capillaryPlan(values), ref = reference[liquid], angle = wetting ? [0, 60, 90, 120][wetting] : ref.angle;
  const c = angle === 90 ? 0 : Math.cos(angle * Math.PI / 180), r = radius * .001;
  // Integrate the vertical component of tension around the circular rim.
  const n = 720, segment = 2 * Math.PI * r / n;
  let force = 0;
  for (let i = 0; i < n; i++) force += ref.gamma * c * segment;
  perimeterIntegrals++;
  const area = Math.PI * r * r;
  // Independently solve for the signed column whose weight balances that force.
  let lo = -.2, hi = .2;
  for (let i = 0; i < 60; i++) {const mid = (lo + hi) / 2; if (ref.rho * 9.81 * area * mid > force) hi = mid; else lo = mid;}
  const height = (lo + hi) * 500;
  t.near(p.height, height, 1e-10, 'integrated rim force balances signed column weight');
  t.near(p.pull * area, force, 1e-15, 'pressure times cross section equals rim force');
  t.near(p.tube.liquidGauge, -ref.rho * 9.81 * p.height * .001, 1e-10, 'liquid pressure at interface matches hydrostatic height');
  t.near(p.head, ref.rho * 9.81 * depth * .001, 1e-10, 'bath head at immersed mouth');
  t.ok(p.enters === (height > -depth), 'required equilibrium must lie above open mouth');
  t.ok(p.height < 220 - depth, 'every accessible level lies below tube top');
  t.near(p.tube.length, p.enters ? depth + height : 0, 1e-10, 'only physically accessible liquid fills tube');
  t.near(p.angle, angle, 0, 'reference or explicitly assigned contact angle');
  for (const x of [0, 5, 10, 20, 30, 40]) {
    const w = capillaryWedge(p, x), gap = (.1 + .9 * x / 40) * .001;
    t.near(ref.rho * 9.81 * gap * w.height * .001, 2 * ref.gamma * c, 1e-14, 'two wall-tension components balance weight per width');
    t.ok(w.accessible === (w.height > -depth), 'each local wedge channel respects immersion');
    wedgeSamples++;
  }
  const unchanged = JSON.stringify(p);
  for (const time of [0, .1, 1.9, 2, 3.9, 4, 5.9, 6, 100]) {
    const now = capillaryAt(p, time);
    t.near(now.t, Math.min(6, time), 0, 'guide clock bounded');
    assert.equal(now.level, p.enters ? p.height : null);
    t.ok(JSON.stringify(p) === unchanged, 'guide stages do not invent physical transients');
  }
  cases++;
}
for (const angle of [0, 60, 90, 120, 140]) for (const radius of [.1, .2, .5]) {
  const c = Math.cos(angle * Math.PI / 180), R = radius / Math.abs(c);
  const center = Math.sign(c) * Math.sqrt(Math.max(0, R * R - radius * radius));
  for (let i = 0; i <= 100; i++) {
    const s = radius * i / 100, y = capillarySurface(angle, radius, s);
    t.ok(Number.isFinite(y), 'finite meniscus through neutral wetting');
    if (angle === 90) t.near(y, 0, 0, '90 degree contact gives flat surface');
    else t.near(Math.hypot(s, y - center), R, 1e-12, 'every surface sample has stated spherical curvature');
  }
  t.near(capillarySurface(angle, radius, radius), 0, 1e-12, 'liquid meets wall contact at reference height');
  const epsilon = radius * 1e-8, dy = capillarySurface(angle, radius, radius - epsilon);
  const measured = Math.acos(-dy / Math.hypot(epsilon, dy)) * 180 / Math.PI;
  t.near(measured, angle, .01, 'tangent and downward wall enclose liquid contact angle');
}
for (const [time, stage] of [[0, 'ready'], [.1, 'contact'], [2, 'pressure'], [4, 'height'], [6, 'complete']]) t.ok(sampleCapillary({}, time).stage === stage, 'named guide stage');
checkRefusals(sampleCapillary, CAPILLARY_DOMAINS, t);
console.log(JSON.stringify({passed: true, checks: t.count, cases, perimeterIntegrals, wedgeSamples}));

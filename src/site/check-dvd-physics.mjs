import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { DVD_DEFAULTS, DVD_DOMAINS, DVD_TIMING, dvdSettings, dvdComparison, dvdPlacement, dvdSpiral, dvdPlan, dvdAt, createDvdController } from './dvd-physics.js';
import { DVD_CHANNEL_RATE, DVD_SECTOR_BITS } from './dvd-codec.js';
import { dvdEncodeVideo } from './dvd-video.js';

let checks = 0, combinations = 0;
const check = (value, label) => { assert.ok(value, label); checks++; };
const close = (actual, expected, tolerance = 1e-9) => check(Math.abs(actual - expected) <= tolerance, `${actual} != ${expected}`);
const sources = [0, 1, 2].map(dvdEncodeVideo), outcomes = [];
for (let format = 0; format < 3; format++) for (let depth = 0; depth < 4; depth++) {
  const f = dvdComparison(format, depth);
  close(f.intensity, [0, .25, .5, 1][depth]);
  close(f.depthNm * f.index, f.wavelength / [4, 6, 8, 2][depth]);
  close(Math.sin(f.plasticHalfAngle * Math.PI / 180) * f.index, Math.sin(f.airHalfAngle * Math.PI / 180));
}
close(dvdComparison(1).diameterNm, 1321.3090488720466);
close(dvdComparison(1).cellNm, 133.4289127837515);
const placement = dvdPlacement(24, 160), spiral = dvdSpiral(placement, .2);
close(placement.referenceLength, Math.PI * (.058 ** 2 - .024 ** 2) / .00000074);
close(spiral.innerRpm, 60 * 3.49 / (2 * Math.PI * .024), 1e-8);
close(spiral.outerRpm, 60 * 3.49 / (2 * Math.PI * .058), 1e-8);
close(spiral.angle / (2 * Math.PI), spiral.travelMicrometers / .74, 1e-8);
check(placement.capacityBytes === 4695853056, 'Geometric capacity retains sector overhead and decimal bytes');

// Group radius and content outside the comparison settings so bounded caches
// cannot make a broad numerical gate needlessly re-encode the same excerpt.
for (let content = 0; content < 3; content++) for (let radius = 24; radius <= 58; radius++) {
  for (let loss = 0; loss < 4; loss++) {
    const base = dvdPlan({ content, radius, loss }), end = dvdAt(base, base.duration), read = base.read;
    const main = read.recovered.mainData, source = sources[content];
    check(main.every((byte, i) => byte < 0 || byte === (source[i] ?? 0)), 'Every admitted byte matches the encoded stream, including padding');
    const frames = read.video.frames.filter(frame => frame.valid).length;
    check(loss < 3 ? frames === 50 : frames > 0 && frames < 50, 'Repair limits affect actual MPEG picture validity');
    if (loss < 3) check(end.stats.failedSectors === 0 && end.stats.missingBytes === 0, 'Correctable patterns have no rejected sector');
    else check(end.stats.failedSectors > 0 && end.stats.missingBytes > 0, 'Beyond both parity limits leaves rejected sectors');
    if (loss === 1) check(end.stats.piRepaired > 0, 'Narrow loss uses PI');
    if (loss === 2) check(end.stats.poRepaired > 0, 'Wider loss uses PO');
    for (let laser = 0; laser < 2; laser++) for (let format = 0; format < 3; format++) for (let depth = 0; depth < 4; depth++) {
      const p = dvdPlan({ content, radius, loss, laser, format, depth }), first = dvdAt(p, 0), final = dvdAt(p, p.duration); combinations++;
      check(first.receivedCells === 0 && first.availableFrames === 0 && first.stats.erased === 0 && first.picture === null, 'No future read data at start');
      check(final.complete && final.spiral.startMm >= 24 && final.spiral.radiusMm <= 58, 'Entire excerpt stays within recorded annulus');
      check(final.spiral.radiusMm > final.spiral.startMm, 'Pickup advances outward');
      close(final.spiral.rpm * 2 * Math.PI * final.spiral.radiusMm / 60000, 3.49);
      check(p.disc === base.disc, 'Reference controls do not change the stored DVD');
      if (!laser) check(p.read === null && final.availableBytes === 0 && final.availableFrames === 0 && final.picture === null && final.detectorBit === null, 'Laser off has no recovered output');
      else {
        check(p.read === read && final.availableFrames === frames, 'Every setting reaches its actual read result');
        check(final.picture?.valid && final.picture.reference === 49, 'Final independent frame recovers after earlier loss');
      }
    }
    if ([24, 41, 58].includes(radius)) outcomes.push({ content, radius, loss, frames: end.availableFrames, stats: end.stats, spiral: end.spiral });
  }
  if (radius === 58) console.log(`All radii and settings checked for clip ${content + 1}/3`);
}
check(combinations === 10080, 'All discrete control combinations');
const p = dvdPlan({ loss: 3 }), total = p.disc.channel.bits.length;
const timeForCells = cells => cells <= 64 ? cells / 16 : 4 + (cells - 64) / (total - 64) * 2;
for (const cells of [0, 31, 32, 47, 48, 63, 64, 79, 80, 1487, 1488, 1503, 1504, 16 * DVD_SECTOR_BITS + 15, 16 * DVD_SECTOR_BITS + 16, total]) {
  const s = dvdAt(p, timeForCells(cells));
  check(s.receivedCells === cells, 'Clock counts arrived channel cells');
  check(s.blocks === Math.max(0, Math.min(p.disc.sectors / 16, Math.floor((cells - 16) / (16 * DVD_SECTOR_BITS)))), 'Whole block and next sync lookahead precede sector admission');
  if (cells < 64) check(s.decodedSymbols === 0, 'First byte waits for next word');
  if (cells === 64) check(s.decodedSymbols === 1, 'First byte arrives after lookahead');
  if (cells === 1503) check(s.decodedSymbols === 90, 'Last word waits for next sync lookahead');
  if (cells === 1504) check(s.decodedSymbols === 91, 'Next sync supplies last-word lookahead');
  check(s.availableFrames === p.read.video.frames.filter(frame => frame.valid && frame.end <= s.availableBytes).length, 'Frame availability follows actual recovered byte boundaries');
  close(s.spiral.radiusMm, dvdSpiral(p.disc.placement, cells / DVD_CHANNEL_RATE).radiusMm);
}
check(dvdAt(p, 6).picture?.reference === 0, 'Movie starts after buffering');
check(dvdAt(p, 7).picture === null && dvdAt(p, 7).frameIndex === 25, 'Prepared missing frame contains no picture');
check(dvdAt(p, 7.04).picture?.reference === 26, 'Next intact I-picture is available');
const a = createDvdController({ values: { loss: 2, content: 2 } }), b = createDvdController({ values: { loss: 2, content: 2 } });
a.advance(4.7); for (let i = 0; i < 470; i++) b.advance(.01);
assert.deepEqual(a.getState(), b.getState()); checks++;
a.update({ format: 0, depth: 2 }); close(a.getState().time, 4.7);
check(a.replayState().values.depth === 2 && a.replayState().values.format === 0, 'Reference settings survive replay');
a.update({ radius: 58 }); check(a.getState().time === 0 && a.getState().spiral.edgeAdjusted, 'Changing read position resets and fits inside edge');
for (const [key, [lo, hi, step]] of Object.entries(DVD_DOMAINS)) for (const value of [lo - step, hi + step, lo + step / 3, NaN, Infinity]) {
  const before = a.getState(); assert.throws(() => a.update({ [key]: value })); assert.deepEqual(a.getState(), before); checks += 2;
}
for (const bad of [-1, NaN, Infinity]) { assert.throws(() => a.advance(bad)); checks++; }
assert.throws(() => a.reset({ time: 9 })); assert.throws(() => dvdSettings(null)); checks += 2;
a.reset({ values: DVD_DEFAULTS }); a.advance(100); check(a.getState().complete && a.getState().time === DVD_TIMING.duration, 'Completion clamps');
const report = { passed: true, checks, combinations, outcomes };
if (process.env.EVIDENCE_DIR) { await mkdir(process.env.EVIDENCE_DIR, { recursive: true }); await writeFile(process.env.EVIDENCE_DIR + '/physics.json', JSON.stringify(report, null, 2)); }
console.log(JSON.stringify({ passed: true, checks, combinations }));

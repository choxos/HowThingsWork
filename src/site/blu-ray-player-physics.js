// Reference-speed, single-layer pressed discs. This module calculates geometry
// and ideal channel transitions, not an optical detector's analog response.
export const DISC_FORMATS = Object.freeze([
  Object.freeze({name: 'CD', wavelength: 780, aperture: .45, pitch: 1600, velocity: 1.2, channelRate: 4321800, cover: 1.2, backing: 0, minimumRun: 3, maximumRun: 11, color: 0x995246, capacity: 'Format and playing time dependent', code: 'EFM'}),
  Object.freeze({name: 'DVD', wavelength: 650, aperture: .60, pitch: 740, velocity: 3.49, channelRate: 26156250, cover: .6, backing: .6, minimumRun: 3, maximumRun: 11, color: 0xb14e40, capacity: 'About 4.7 GB per layer', code: 'EFMPlus'}),
  Object.freeze({name: 'Blu-ray', wavelength: 405, aperture: .85, pitch: 320, velocity: 4.917, channelRate: 66000000, cover: .1, backing: 1.1, minimumRun: 2, maximumRun: 8, color: 0x7c68ae, capacity: 'About 25 GB per layer', code: '17PP'}),
]);
export const PLAYER_DEFAULTS = Object.freeze({format: 2, radius: 25, speed: 1, phase: 180});
export const PLAYER_DOMAINS = Object.freeze({format: [0, 2, 1], radius: [25, 58, 1], speed: [1, 4, 1], phase: [0, 360, 30]});
export const PLAYER = Object.freeze({discRadius: 60, holeRadius: 7.5, thickness: 1.2, spinSlowdown: 100, cellsPerSecond: 6, screwPitch: 2, firstDark: 3.8317059702075125});

export function playerSettings(input = {}) {
  const result = {};
  for (const [key, [low, high, step]] of Object.entries(PLAYER_DOMAINS)) {
    const value = input[key] ?? PLAYER_DEFAULTS[key];
    if (!Number.isFinite(value) || value < low || value > high || Math.abs((value-low)/step-Math.round((value-low)/step)) > 1e-8) throw new RangeError(`Invalid player setting: ${key}`);
    result[key] = value;
  }
  return result;
}

export const playerRpm = (format, radius, speed = 1) => 60 * format.velocity * speed / (2 * Math.PI * radius * .001);
export const playerCellLength = format => format.velocity / format.channelRate * 1e9;
// Uniform circular pupil, scalar Airy reference. A high-NA disc pickup's actual
// vector field, pupil illumination and detector response are not computed.
export const playerSpotDiameter = format => PLAYER.firstDark / Math.PI * format.wavelength / format.aperture;

/** Illustrative local runs, not a complete EFM/EFMPlus/17PP encoded sector. */
export function playerSample(format) {
  const lengths = format.minimumRun === 2 ? [2, 3, 4, 2, 5, 3, 6, 4, 8, 5] : [3, 4, 5, 3, 6, 4, 7, 5, 11, 6];
  let start = 0;
  const runs = lengths.map((length, i) => {const run = {start, end: start + length, length, pit: i % 2 === 0}; start += length; return run;});
  const bits = Array(start).fill(0);
  for (const run of runs) bits[run.start] = 1;
  return {runs, bits, cells: start};
}

/** Two equal coherent fields; output normalized to their in-phase intensity. */
export function playerInterference(degrees, position = 0) {
  const phase = degrees * Math.PI / 180, first = Math.sin(position), second = Math.sin(position + phase);
  return {first, second, sum: (first + second) / 2, intensity: (1 + Math.cos(phase)) / 2};
}

export function playerPlan(input = {}) {
  const settings = playerSettings(input), format = DISC_FORMATS[settings.format], sample = playerSample(format);
  const cellsPerSecond = PLAYER.cellsPerSecond * settings.speed;
  return {...settings, format, sample, cellLength: playerCellLength(format), spotDiameter: playerSpotDiameter(format), rpm: playerRpm(format, settings.radius, settings.speed), linearSpeed: format.velocity * settings.speed, channelRate: format.channelRate * settings.speed, cellsPerSecond, duration: sample.cells / cellsPerSecond, interference: playerInterference(settings.phase)};
}

export function playerAt(plan, time) {
  if (!Number.isFinite(time) || time < 0) throw new RangeError('Invalid player time');
  const clock = Math.min(time, plan.duration), travel = Math.min(plan.sample.cells, clock * plan.cellsPerSecond);
  const count = Math.min(plan.sample.cells, Math.floor(travel + 1e-10));
  const currentCell = Math.min(plan.sample.cells - 1, Math.floor(travel));
  const run = plan.sample.runs.find(item => currentCell >= item.start && currentCell < item.end);
  const recovered = plan.sample.bits.slice(0, count), ones = recovered.reduce((sum, bit) => sum + bit, 0);
  return {clock, travel, count, currentCell, run, recovered, ones, zeros: count - ones, complete: clock >= plan.duration, angle: plan.rpm * 2 * Math.PI / 60 * clock / PLAYER.spinSlowdown, screwAngle: (plan.radius - PLAYER_DEFAULTS.radius) / PLAYER.screwPitch * 2 * Math.PI};
}

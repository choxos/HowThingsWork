import * as THREE from 'three';
import {houseModel, reading as r} from './house-model-kit.js';
import {fixed} from './format.js';
import {chartText, lineObject, surface, textLabel} from './scene-kit.js';
import {vrPlan, vrAt, rayThrough, CLOCKS, HEAD, LENS, GAINS, MOTION_OPTIONS, PREDICTION_OPTIONS, CORRECTION_OPTIONS, VR_DEFAULTS, VR_DOMAINS} from './vr-headset-physics.js';

// ---------------------------------------------------------------------------
// Virtual reality headset: a head wearing a headset whose shell is drawn
// see-through with its top cut away, a tracking camera fixed in the room, and
// six charts behind them.
//
// Scale: one millimeter is 0.02 scene units for the head, the headset (184 mm
// across), its lenses (45 mm focal length, 15 mm in front of the eyes), its
// display panel, the 4 mm gyroscope chip on its board, and the camera, which
// stands much closer than a real one would; its part text says so. The lens
// chart is at true size too. The other charts are not to any scale.
//
// Time: the run is 3 s of head motion, played five times slower than real
// time. The head turns by its true yaw. The panel draws the room's landmarks
// and the virtual object as the frame lit most recently was drawn, for each
// eye's own position. The arc over the gyroscope chip grows with its reading,
// and the camera's light shows each image being taken.
//
// Charts: yaw over time (truth in ink, the estimate in blue, each frame's yaw
// in red from the moment it lights); how far off (the estimate's drift in
// blue and each frame's slip in red, 12° either way); frames close up (the
// last 120 ms of readings, images, frame starts and flashes); what the left
// eye sees (the landmarks where they truly are above, where the display draws
// them below); the lens at true size with rays from a screen point into the
// pupil; and aim and focus in diopters.
// ---------------------------------------------------------------------------

const MM = 0.02;
const SLOW = 5;
const DEG = Math.PI / 180;

export const FACE = Object.freeze({radii: Object.freeze([72, 100, 92]), eyeX: LENS.ipd / 2, eyeY: 20, eyeZ: 72, eyeRadius: 12, neck: 40});
export const HEADSET = Object.freeze({half: 92, bottom: -20, top: 62, back: 94, front: 156, wall: 3, gap: 14, noseFront: 124, lensZ: FACE.eyeZ + FACE.eyeRadius + LENS.relief, panel: Object.freeze([128, 72, 3]), view: Object.freeze([2 * LENS.halfView, 64])});
export const IMU_AT = Object.freeze({x: 0, y: 54, z: 120, board: Object.freeze([22, 1.6, 16]), chip: Object.freeze([4, 0.9, 4]), arc: 8, lift: 2, fullCircle: 300});
export const CAMERA_AT = Object.freeze({x: 150, y: -10, z: 175, floor: -130, lit: 0.004});
export const CHARTS = Object.freeze({
  z: -150,
  timeline: Object.freeze({x: -190, y: 212, w: 120, h: 70, v0: -30, v1: 70}),
  errors: Object.freeze({x: -56, y: 212, w: 116, h: 70, range: 12}),
  frames: Object.freeze({x: 70, y: 212, w: 120, h: 70, window: 0.12}),
  view: Object.freeze({x: -190, y: 120, w: 120, h: 70, span: 40}),
  optics: Object.freeze({x: -60, y: 120, w: 120, h: 70, lens: 40, axis: 35, point: 20, pupils: Object.freeze([-1.5, 0, 1.5])}),
  focus: Object.freeze({x: 70, y: 120, w: 120, h: 70, d1: 4}),
});
export const FRAME_ROWS = Object.freeze({gyro: Object.freeze([CHARTS.frames.y + 56, CHARTS.frames.y + 66]), camera: Object.freeze([CHARTS.frames.y + 42, CHARTS.frames.y + 50]), start: Object.freeze([CHARTS.frames.y + 28, CHARTS.frames.y + 36]), flash: Object.freeze([CHARTS.frames.y + 6, CHARTS.frames.y + 14])});
export const VIEW_ROWS = Object.freeze({truth: Object.freeze([CHARTS.view.y + 38, CHARTS.view.y + 64]), shown: Object.freeze([CHARTS.view.y + 6, CHARTS.view.y + 32])});
export const COLORS = Object.freeze({truth: 0x374736, estimate: 0x2f6690, shown: 0xc14f39, camera: 0xe3b45e, faint: 0x9aa39a, edge: 0xce825f, panel: 0x1d2a33, glow: 0x9fe3ff, lit: 0xffd35a, dark: 0x3a2a28, skin: 0xdcc3a8, foam: 0x55605a, glass: 0xa9d3e0});
/** The room's landmarks, every 10° of azimuth, degrees to the left of where the head first faces. */
export const LANDMARKS = Object.freeze(Array.from({length: 36}, (_, i) => -180 + 10 * i));

/** An angle in degrees brought into (−180°, 180°]. */
export const wrap = angle => angle - 360 * Math.ceil((angle - 180) / 360);

/** Where on the panel, millimeters from an eye's axis toward the wearer's left, a direction `angle` degrees to the left is drawn. */
export const panelX = (angle, slope) => Math.tan(angle * DEG) / slope;

/**
 * The direction, degrees to the left of the eye's straight ahead, in which an
 * eye (side +1 for the left eye, −1 for the right) sees the virtual object
 * `distance` meters in front of where the eyes first faced, with the head
 * turned `yaw` degrees to the left.
 */
export function objectDirection(side, yaw, distance) {
  const psi = yaw * DEG, c = Math.cos(psi), s = Math.sin(psi), ex = side * FACE.eyeX, ez = FACE.eyeZ;
  const dx = -(ex * c + ez * s), dz = FACE.eyeZ + distance * 1000 - (ez * c - ex * s);
  return Math.atan2(dx * c - dz * s, dx * s + dz * c) / DEG;
}

export function createVrHeadsetModel() {
  const kit = houseModel('Virtual reality headset'), {root, part, control, finish} = kit;
  const mm = value => value * MM, at = (x, y, z) => [mm(x), mm(y), mm(z)];
  const paint = (meshes, color, opacity) => {
    const material = meshes[0].material.clone();
    material.color.set(color);
    if (opacity !== undefined) Object.assign(material, {transparent: true, opacity, depthWrite: false});
    meshes.forEach(mesh => { mesh.material = material; });
    return material;
  };
  const system = part('system', 'Headset, wearer and camera', 'A head wearing a virtual reality headset, its shell see-through and its top cut away, a tracking camera fixed in the room, and six charts. Move the head and follow the gyroscope, the camera, the frames and the lenses.', [0, 0, 0]);

  // The wearer, built about the vertical axis the head turns on.
  const wearer = part('wearer', 'Wearer', 'A head of adult size, drawn at true size, turning about a vertical axis through its middle. Its eyes are 63 mm apart, between the averages of 61.7 mm for women and 64.0 mm for men in a 2012 survey of US Army personnel.', [0, 0, 0], system);
  const skull = kit.sphere(mm(1), [0, 0, 0], 'cream', wearer);
  skull.scale.set(...FACE.radii);
  const neck = kit.cylinder(mm(FACE.neck), mm(50), at(0, -105, -8), 'cream', wearer);
  const nose = surface(kit, new THREE.ConeGeometry(mm(9), mm(26), 20), 'cream', wearer);
  nose.rotation.x = 2 * Math.PI / 3;
  nose.position.set(...at(0, -12.5, 95.3));
  paint([skull, neck, nose], COLORS.skin);
  for (const side of [1, -1]) {
    const x = side * FACE.eyeX;
    kit.sphere(mm(FACE.eyeRadius), at(x, FACE.eyeY, FACE.eyeZ), 'cream', wearer);
    kit.disk(mm(5), mm(0.6), at(x, FACE.eyeY, FACE.eyeZ + FACE.eyeRadius - 0.7), 'blue', wearer);
    kit.disk(mm(2), mm(0.6), at(x, FACE.eyeY, FACE.eyeZ + FACE.eyeRadius - 0.2), 'ink', wearer);
  }

  // The headset's shell: two sides, the front and a bottom split around the nose, see-through; foam against the face; the strap.
  const H = HEADSET, depth = H.front - H.back, midZ = (H.front + H.back) / 2, height = H.top - H.bottom, midY = (H.top + H.bottom) / 2;
  const headset = part('headset', 'Headset shell and strap', 'The headset’s shell, 184 mm across, drawn see-through with its top cut away, the foam that rests on the face, and the strap. Drawn at true size.', [0, 0, 0], system);
  const shell = [
    ...[1, -1].map(side => kit.box([mm(H.wall), mm(height), mm(depth)], at(side * (H.half - H.wall / 2), midY, midZ), 'ink', headset)),
    kit.box([mm(2 * H.half), mm(height), mm(H.wall)], at(0, midY, H.front - H.wall / 2), 'ink', headset),
    ...[1, -1].map(side => kit.box([mm(H.half - H.gap), mm(H.wall), mm(depth)], at(side * (H.half + H.gap) / 2, H.bottom + H.wall / 2, midZ), 'ink', headset)),
    kit.box([mm(2 * H.gap), mm(H.wall), mm(H.front - H.noseFront)], at(0, H.bottom + H.wall / 2, (H.front + H.noseFront) / 2), 'ink', headset),
  ];
  paint(shell, COLORS.panel, 0.3);
  paint([
    kit.box([mm(2 * H.half), mm(6), mm(4)], at(0, H.top - 3, H.back - 2), 'ink', headset),
    ...[1, -1].map(side => kit.box([mm(H.half - H.gap), mm(6), mm(4)], at(side * (H.half + H.gap) / 2, H.bottom + 3, H.back - 2), 'ink', headset)),
    ...[1, -1].map(side => kit.box([mm(6), mm(height), mm(4)], at(side * (H.half - 3), midY, H.back - 2), 'ink', headset)),
  ], COLORS.foam);
  kit.tube([[H.half - 2, 30, 118], [84, 32, 20], [48, 36, -82], [0, 38, -102], [-48, 36, -82], [-84, 32, 20], [-(H.half - 2), 30, 118]].map(p => at(...p)), mm(4), 'ink', headset);

  // The lenses, centered on the eyes.
  const lenses = part('lenses', 'Lenses', 'Two lenses of 45 mm focal length, as in Google Cardboard, 15 mm in front of the eyes and centered on them. The screen sits at or just inside their focal length, so each lens works as a magnifier: the screen looks large and far away. Drawn at true size.', [0, 0, 0], system);
  const glass = [1, -1].map(side => {
    const lens = kit.sphere(mm(LENS.radius), at(side * FACE.eyeX, FACE.eyeY, H.lensZ), 'blue', lenses);
    lens.scale.z = 4 / LENS.radius;
    kit.ring(mm(LENS.radius + 1.2), mm(1.2), at(side * FACE.eyeX, FACE.eyeY, H.lensZ), 'ink', lenses);
    return lens;
  });
  paint(glass, COLORS.glass, 0.75);

  // The display panel, one screen with a view for each eye, its face toward the eyes.
  const display = part('display', 'Display panel', 'One display panel with a view for each eye side by side, as a phone in Cardboard shows them. Each view draws the room’s landmarks, a line every 10°, and the gold virtual object, as the frame lit most recently was drawn for that eye’s own position. A real panel lights for 2 ms each frame; this one is drawn lit throughout. Drawn at true size.', [0, 0, 0], system);
  const panel = new THREE.Group();
  display.add(panel);
  const [pw, ph, pt] = H.panel;
  paint([kit.box([mm(pw), mm(ph), mm(pt)], at(0, FACE.eyeY, pt / 2), 'ink', panel)], COLORS.panel);
  const panelSegments = (count, color) => {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(count * 6), 3));
    const object = new THREE.LineSegments(geometry, new THREE.LineBasicMaterial({color}));
    object.frustumCulled = false;
    panel.add(object);
    return object;
  };
  const panelBorders = panelSegments(8, COLORS.faint), panelTicks = panelSegments(20, COLORS.glow), panelAhead = panelSegments(2, COLORS.shown);
  const panelObjects = [1, -1].map(() => kit.ring(mm(2), mm(0.5), [0, 0, 0], 'gold', panel));

  // The inertial measurement unit on its board under the cut-away top.
  const imu = part('imu', 'Inertial measurement unit', 'A 4 × 4 mm gyroscope and accelerometer chip, like an MPU-6050, on its board. Its gyroscope reports how fast the headset turns, 1,000 times a second, not which way it points. The gold arc above it grows with the reading, a full circle for 300°/s. Drawn at true size.', [0, 0, 0], system);
  kit.box(IMU_AT.board.map(mm), at(IMU_AT.x, IMU_AT.y, IMU_AT.z), 'leaf', imu);
  kit.box(IMU_AT.chip.map(mm), at(IMU_AT.x, IMU_AT.y + (IMU_AT.board[1] + IMU_AT.chip[1]) / 2, IMU_AT.z), 'ink', imu);
  const rateArc = lineObject(49, COLORS.camera, imu);

  // The camera, fixed in the room and facing the head.
  const camera = part('camera', 'Tracking camera', 'A camera fixed in the room, taking 60 images a second that show which way the headset truly points. Its light shows each image being taken. Drawn at true size, but much closer than a real one would stand.', at(CAMERA_AT.x, CAMERA_AT.y, CAMERA_AT.z), system);
  camera.rotation.y = Math.atan2(-CAMERA_AT.x, -CAMERA_AT.z);
  kit.box([mm(36), mm(24), mm(20)], [0, 0, 0], 'ink', camera);
  kit.disk(mm(7), mm(4), at(0, 0, 12), 'metal', camera);
  kit.disk(mm(4), mm(1), at(0, 0, 14.2), 'blue', camera);
  const cameraLight = kit.box([mm(3), mm(3), mm(1.5)], at(12, 7, 10.6), 'red', camera);
  paint([cameraLight], COLORS.dark);
  for (const [x, z] of [[0, -30], [26, 15], [-26, 15]]) kit.rod(at(0, -12, 0), at(x, CAMERA_AT.floor - CAMERA_AT.y, z), mm(1.5), 'metal', camera);

  // The charts, in a plane behind the head.
  const Z = CHARTS.z, P = (x, y) => at(x, y, Z);
  const chart = (id, label, description) => part(id, label, description, [0, 0, 0], system);
  const fill = (line, points, place) => {
    const array = line.geometry.attributes.position.array, room = array.length / 3, n = Math.min(points.length, room);
    line.visible = n > 0;
    for (let i = 0; i < room; i++) array.set(n ? place(...points[Math.min(i, n - 1)]) : [0, 0, 0], i * 3);
    line.geometry.setDrawRange(0, n);
    line.geometry.attributes.position.needsUpdate = true;
    line.geometry.boundingBox = null;
    line.geometry.boundingSphere = null;
    return n;
  };
  const setLine = (line, points) => fill(line, points, P);
  const onPanel = (line, points) => fill(line, points, (x, y) => at(x, y, -0.25));
  const segments = (count, color, parent) => {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(count * 6), 3));
    const object = new THREE.LineSegments(geometry, new THREE.LineBasicMaterial({color}));
    object.frustumCulled = false;
    parent.add(object);
    return object;
  };
  const frameBox = (box, parent) => setLine(lineObject(5, COLORS.truth, parent), [[box.x, box.y], [box.x + box.w, box.y], [box.x + box.w, box.y + box.h], [box.x, box.y + box.h], [box.x, box.y]]);
  const ring = (color, parent, radius = 2) => {
    const mesh = kit.ring(mm(radius), mm(0.45), P(0, 0), 'gold', parent);
    paint([mesh], color);
    return mesh;
  };

  const T = CHARTS.timeline;
  const tx = t => T.x + t / CLOCKS.duration * T.w, ty = v => T.y + (Math.max(T.v0, Math.min(T.v1, v)) - T.v0) / (T.v1 - T.v0) * T.h;
  const timeline = chart('timeline', 'Yaw over time', 'Which way the head points over the 3 s run, from 30° to the right at the bottom to 70° to the left at the top. Ink: the head’s true yaw. Blue: the tracker’s estimate. Red: the yaw each frame was drawn for, from the moment it lights. Faint lines: straight ahead and 60° to the left.');
  frameBox(T, timeline);
  setLine(segments(2, COLORS.faint, timeline), [[T.x, ty(0)], [T.x + T.w, ty(0)], [T.x, ty(HEAD.turn)], [T.x + T.w, ty(HEAD.turn)]]);
  const truthLine = lineObject(601, COLORS.truth, timeline), estimateLine = lineObject(601, COLORS.estimate, timeline), shownLine = lineObject(546, COLORS.shown, timeline), timelineCursor = lineObject(2, COLORS.truth, timeline);

  const E = CHARTS.errors;
  const ex = t => E.x + t / CLOCKS.duration * E.w, ey = v => E.y + E.h / 2 + Math.max(-E.range, Math.min(E.range, v)) / E.range * E.h / 2;
  const errors = chart('errors', 'How far off', 'The same 3 s, 12° either way from the middle line. Blue: the estimate minus the head’s true yaw, the tracker’s drift. Red: each frame’s yaw minus where the head truly points when the frame lights, the room seeming to slip. Faint lines: 1° either way.');
  frameBox(E, errors);
  setLine(segments(3, COLORS.faint, errors), [[E.x, ey(0)], [E.x + E.w, ey(0)], [E.x, ey(1)], [E.x + E.w, ey(1)], [E.x, ey(-1)], [E.x + E.w, ey(-1)]]);
  const driftLine = lineObject(601, COLORS.estimate, errors), slipLine = lineObject(546, COLORS.shown, errors), errorsCursor = lineObject(2, COLORS.truth, errors);

  const F = CHARTS.frames;
  const frames = chart('frames', 'Frames close up', 'The last 120 ms, now at the right edge. Top: the gyroscope’s readings, one a millisecond, taller for faster turns. Next: the camera’s images, 60 a second. Next: each frame starting, 90 a second, with a red line to the moment it lights. Bottom: each frame’s 2 ms of light.');
  frameBox(F, frames);
  const gyroTicks = segments(122, COLORS.estimate, frames), cameraTicks = segments(10, COLORS.camera, frames), startTicks = segments(14, COLORS.truth, frames), pipes = segments(24, COLORS.shown, frames);
  const flashBars = Array.from({length: 14}, () => kit.box([1, mm(FRAME_ROWS.flash[1] - FRAME_ROWS.flash[0]), mm(0.8)], P(F.x, (FRAME_ROWS.flash[0] + FRAME_ROWS.flash[1]) / 2), 'gold', frames));
  paint(flashBars, COLORS.lit);

  const V = CHARTS.view, vx = angle => V.x + V.w / 2 - angle / V.span * V.w / 2;
  const view = chart('view', 'What the left eye sees', 'Across the left eye’s view, 40° either way, the wearer’s left on the left. Top row: where the room’s landmarks truly are now, a tick every 10° and a tall one every 30°, straight ahead in red. Bottom row: where the display draws them now. When the picture is right, the rows line up. Gold: the left edge of the gold ring marks the virtual object. Clay lines: the edges of the view.');
  frameBox(V, view);
  setLine(segments(1, COLORS.camera, view), [[vx(0), V.y + 2], [vx(0), V.y + V.h - 2]]);
  const viewEdges = segments(2, COLORS.edge, view), truthTicks = segments(36, COLORS.faint, view), shownTicks = segments(36, COLORS.truth, view), aheadMarks = segments(2, COLORS.shown, view);
  const truthObject = ring(COLORS.camera, view), shownObject = ring(COLORS.camera, view);

  const O = CHARTS.optics, oP = (X, Y) => [O.x + X, O.y + Y];
  const optics = chart('optics', 'Lens, at true size', 'The left lens seen from the side at true size, the eye on the left and the screen on the right. Blue: the lens. Gold ticks: its focal point, 45 mm out, and the pupil. Red: three rays from a screen point 20 mm off the axis, bent by the lens into the pupil. Faint: the same rays traced back, toward the virtual image they seem to come from.');
  frameBox(O, optics);
  setLine(lineObject(2, COLORS.faint, optics), [oP(0, O.axis), oP(O.w, O.axis)]);
  setLine(lineObject(49, COLORS.estimate, optics), Array.from({length: 49}, (_, i) => oP(O.lens + 3 * Math.cos(i / 48 * 2 * Math.PI), O.axis + LENS.radius * Math.sin(i / 48 * 2 * Math.PI))));
  const eyeAt = O.lens - LENS.relief - FACE.eyeRadius;
  setLine(lineObject(49, COLORS.truth, optics), Array.from({length: 49}, (_, i) => oP(eyeAt + FACE.eyeRadius * Math.cos(i / 48 * 2 * Math.PI), O.axis + FACE.eyeRadius * Math.sin(i / 48 * 2 * Math.PI))));
  setLine(segments(2, COLORS.camera, optics), [oP(O.lens + LENS.focal, O.axis - 4), oP(O.lens + LENS.focal, O.axis + 4), oP(O.lens - LENS.relief, O.axis - 2), oP(O.lens - LENS.relief, O.axis + 2)]);
  const screenLine = lineObject(2, COLORS.truth, optics), screenPoint = ring(COLORS.shown, optics, 1.2);
  const rays = O.pupils.map(() => lineObject(3, COLORS.shown, optics)), backRays = O.pupils.map(() => lineObject(2, COLORS.faint, optics));

  const D = CHARTS.focus, dx = d => D.x + 10 + Math.max(0, Math.min(D.d1, d)) / D.d1 * (D.w - 20);
  const focus = chart('focus', 'Aim and focus', 'Diopters, from 0 for infinitely far on the left to 4 for 25 cm on the right, a tick every half diopter. Blue: where the eyes must focus, on the screen’s image. Red: where they aim, at the virtual object. Gold band: within 0.4 D of the focus, a conflict most people find comfortable. The line between them turns red outside it.');
  frameBox(D, focus);
  setLine(lineObject(2, COLORS.truth, focus), [[dx(0), D.y + 14], [dx(D.d1), D.y + 14]]);
  setLine(segments(9, COLORS.truth, focus), Array.from({length: 9}, (_, i) => [[dx(i / 2), D.y + 14 - (i % 2 ? 1.5 : 3)], [dx(i / 2), D.y + 14 + (i % 2 ? 1.5 : 3)]]).flat());
  const comfortBar = kit.box([1, mm(6), mm(0.8)], P(D.x, D.y + 21), 'gold', focus);
  const focusMark = lineObject(2, COLORS.estimate, focus), aimMark = lineObject(2, COLORS.shown, focus), conflictLine = lineObject(2, COLORS.shown, focus);
  const focusRing = ring(COLORS.estimate, focus), aimRing = ring(COLORS.shown, focus);

  // The charts' words: titles, axes, row names and a few labels that move with what they name.
  const TEXT = mm(3.5), css = color => `#${color.toString(16).padStart(6, '0')}`;
  const words = (parent, text, x, y, options = {}) => textLabel(parent, text, {height: mm(3), position: at(x, y, Z + 0.4), color: css(COLORS.truth), ...options});
  const seconds = [0, 1, 2, 3].map(t => [t, String(t)]);
  chartText(timeline, (t, v) => P(tx(t), ty(v)), {
    title: 'Yaw over time', size: TEXT,
    x: {min: 0, max: CLOCKS.duration, title: 'Seconds', ticks: seconds},
    y: {min: T.v0, max: T.v1, title: 'Which way the head points', ticks: [[T.v0, `${-T.v0}° right`], [0, 'ahead'], [HEAD.turn, `${HEAD.turn}° left`]]},
    legend: [['Head', COLORS.truth], ['Estimate', COLORS.estimate], ['Drawn for', COLORS.shown]], legendAt: [1, 54],
  });
  chartText(errors, (t, v) => P(ex(t), ey(v)), {
    title: 'How far off', size: TEXT,
    x: {min: 0, max: CLOCKS.duration, title: 'Seconds', ticks: seconds},
    y: {min: -E.range, max: E.range, title: 'Degrees, left up', ticks: [[-E.range, `−${E.range}°`], [0, '0'], [E.range, `${E.range}°`]]},
    legend: [['Drift', COLORS.estimate], ['Slip', COLORS.shown]],
  });
  chartText(frames, (tau, v) => P(F.x + (tau + F.window) / F.window * F.w, F.y + v * F.h), {
    title: 'Frames close up', size: TEXT,
    x: {min: -F.window, max: 0, title: 'ms before now', ticks: [[-F.window, `−${fixed(F.window * 1000, 0)}`], [-F.window / 2, `−${fixed(F.window * 500, 0)}`], [0, '0']]},
    y: {min: 0, max: 1},
  });
  for (const [row, text, color] of [['gyro', 'Gyroscope', COLORS.estimate], ['camera', 'Camera', COLORS.camera], ['start', 'Frame starts', COLORS.truth], ['flash', 'Light', COLORS.truth]]) words(frames, text, F.x + 2, FRAME_ROWS[row][1] + 2, {align: 'left', color: css(color)});
  chartText(view, (angle, v) => P(vx(angle), V.y + v * V.h), {
    title: 'What the left eye sees', size: TEXT,
    x: {min: V.span, max: -V.span, title: 'Across the view', ticks: [[V.span, `${V.span}° left`], [0, 'ahead'], [-V.span, `${V.span}° right`]]},
    y: {min: 0, max: 1},
  });
  words(view, 'The room now', V.x + 2, VIEW_ROWS.truth[1] + 3, {align: 'left'});
  words(view, 'On the display', V.x + 2, VIEW_ROWS.shown[1] + 3, {align: 'left'});
  chartText(optics, (x, v) => P(O.x + x, O.y + v * O.h), {title: 'Lens, at true size', size: TEXT, x: {min: 0, max: O.w}, y: {min: 0, max: 1}});
  words(optics, 'Eye', eyeAt + O.x, O.y + 8);
  words(optics, 'Lens', O.lens + O.x, O.y + 8);
  const screenWord = words(optics, 'Screen', O.x, O.y + 8, {align: 'left'});
  chartText(focus, (d, v) => P(dx(d), D.y + v), {
    title: 'Aim and focus', size: TEXT,
    x: {min: 0, max: D.d1, title: 'Diopters: 1 over the distance in meters', ticks: Array.from({length: D.d1 + 1}, (_, d) => [d, String(d)])},
    y: {min: 13, max: D.h},
  });
  const ringWord = (text, color) => ({label: words(focus, text, 0, 0, {align: 'left', color: css(color)}), width: 3 * (0.56 * text.length + 0.6)});
  const focusWord = ringWord('Focus', COLORS.estimate), aimWord = ringWord('Aim', COLORS.shown);
  // Beside its ring, on the side with room.
  const placeWord = ({label, width}, d, y) => label.userData.place(...at(d > D.d1 * 0.7 ? dx(d) - 3 - width : dx(d) + 3, y, Z + 0.4));

  control('motion', 'Head motion', ...VR_DOMAINS.motion, VR_DEFAULTS.motion, '', 'How the wearer moves during the run.', MOTION_OPTIONS.map(({value, label}) => ({value, label})));
  control('latency', 'Latency', ...VR_DOMAINS.latency, VR_DEFAULTS.latency, 'ms', 'From the moment a frame starts, taking the tracker’s estimate, to the moment it lights.');
  control('prediction', 'Prediction', ...VR_DOMAINS.prediction, VR_DEFAULTS.prediction, '', 'Draw each frame for the yaw expected when it lights, or for the estimate when it starts.', PREDICTION_OPTIONS.map(({value, label}) => ({value, label})));
  control('offset', 'Gyroscope offset', ...VR_DOMAINS.offset, VR_DEFAULTS.offset, '°/s', 'What the gyroscope reads while perfectly still: a in ω̂ = a + bω.');
  control('scale', 'Gyroscope scale error', ...VR_DOMAINS.scale, VR_DEFAULTS.scale, '%', 'How much too fast the gyroscope reads a turn: b − 1 in ω̂ = a + bω.');
  control('correction', 'Drift correction', ...VR_DOMAINS.correction, VR_DEFAULTS.correction, '', 'Whether the camera’s images pull the estimate back, and how hard.', CORRECTION_OPTIONS.map(({value, label}) => ({value, label})));
  control('screen', 'Screen to lens', ...VR_DOMAINS.screen, VR_DEFAULTS.screen, 'mm', 'How far the display panel is from the lenses, whose focal length is 45 mm.');
  control('distance', 'Virtual object', ...VR_DOMAINS.distance, VR_DEFAULTS.distance, 'm', 'How far in front of the eyes the scene puts a small object, straight ahead of where they first face.');

  // What changes only with the settings: the long charts, the lens chart and the focus chart.
  let chartKey = '';
  const redraw = plan => {
    const key = JSON.stringify(plan.values);
    if (key === chartKey) return;
    chartKey = key;
    const {values, frames: list, estimate, truth, image, eyes} = plan;

    setLine(truthLine, Array.from({length: 601}, (_, i) => [tx(i / 200), ty(truth[5 * i])]));
    setLine(estimateLine, Array.from({length: 601}, (_, i) => [tx(i / 200), ty(estimate[5 * i])]));
    setLine(driftLine, Array.from({length: 601}, (_, i) => [ex(i / 200), ey(estimate[5 * i] - truth[5 * i])]));
    const shownStairs = [], slipStairs = [];
    list.forEach((frame, i) => {
      const until = i + 1 < list.length ? list[i + 1].flash : CLOCKS.duration;
      shownStairs.push([tx(frame.flash), ty(frame.shown)], [tx(until), ty(frame.shown)]);
      slipStairs.push([ex(frame.flash), ey(frame.slip)], [ex(until), ey(frame.slip)]);
    });
    setLine(shownLine, shownStairs);
    setLine(slipLine, slipStairs);

    const X1 = O.lens + values.screen;
    setLine(screenLine, [oP(X1, 2), oP(X1, O.h - 2)]);
    screenWord.userData.place(...at(...oP(X1 + 1.5, 8), Z + 0.4));
    screenPoint.position.set(...P(...oP(X1, O.axis + O.point)));
    O.pupils.forEach((pupil, i) => {
      const ray = rayThrough(values.screen, O.point, pupil), reach = Math.min(O.w - O.lens, (O.h - 2 - O.axis - ray.lens) / -ray.after);
      setLine(rays[i], [oP(X1, O.axis + O.point), oP(O.lens, O.axis + ray.lens), oP(O.lens - LENS.relief, O.axis + pupil)]);
      setLine(backRays[i], [oP(O.lens, O.axis + ray.lens), oP(O.lens + reach, O.axis + ray.lens - ray.after * reach)]);
    });

    const low = Math.max(0, image.focus - LENS.comfort), high = image.focus + LENS.comfort;
    comfortBar.scale.x = mm(dx(high) - dx(low));
    comfortBar.position.x = mm((dx(high) + dx(low)) / 2);
    setLine(focusMark, [[dx(image.focus), D.y + 14], [dx(image.focus), D.y + 48]]);
    setLine(aimMark, [[dx(eyes.aim), D.y + 14], [dx(eyes.aim), D.y + 58]]);
    focusRing.position.set(...P(dx(image.focus), D.y + 50.5));
    aimRing.position.set(...P(dx(eyes.aim), D.y + 60.5));
    placeWord(focusWord, image.focus, D.y + 50.5);
    placeWord(aimWord, eyes.aim, D.y + 60.5);
    setLine(conflictLine, [[dx(image.focus), D.y + 36], [dx(eyes.aim), D.y + 36]]);
    conflictLine.material.color.set(eyes.comfortable ? COLORS.camera : COLORS.shown);

    const half = plan.halfAngle / DEG;
    setLine(viewEdges, [[vx(half), V.y + 2], [vx(half), V.y + V.h - 2], [vx(-half), V.y + 2], [vx(-half), V.y + V.h - 2]]);
    onPanel(panelBorders, [1, -1].flatMap(side => {
      const [w, h] = H.view, x0 = side * FACE.eyeX - w / 2, x1 = x0 + w, y0 = FACE.eyeY - h / 2, y1 = y0 + h;
      return [[x0, y0], [x1, y0], [x1, y0], [x1, y1], [x1, y1], [x0, y1], [x0, y1], [x0, y0]];
    }));
  };

  // The landmarks on a row of the eye chart, for a head turned `yaw` degrees left.
  const landmarkRow = ([y0, y1], yaw, half) => {
    const ticks = [], ahead = [], middle = (y0 + y1) / 2;
    for (const azimuth of LANDMARKS) {
      const angle = wrap(azimuth - yaw);
      if (Math.abs(angle) > half) continue;
      const reach = (azimuth % 30 === 0 ? 0.5 : 0.25) * (y1 - y0);
      (azimuth === 0 ? ahead : ticks).push([vx(angle), middle - reach], [vx(angle), middle + reach]);
    }
    return {ticks, ahead};
  };

  let clock = 0, lastClock = 0, disposed = false;
  const yawText = yaw => (Math.abs(yaw) < 0.005 ? 'straight ahead' : `${fixed(Math.abs(yaw), 2)}° to the ${yaw > 0 ? 'left' : 'right'}`);
  const alphaText = alpha => (alpha >= 0.01 ? fixed(alpha, 2) : fixed(alpha, 4));
  const result = finish(values => {
    const plan = vrPlan(values), now = vrAt(plan, clock), {values: settings, image, eyes} = plan, half = plan.halfAngle / DEG;
    redraw(plan);

    // The head, the headset and everything in it turn together by the head's true yaw.
    const yaw = now.head.angle * DEG;
    for (const group of [wearer, headset, lenses, display, imu]) group.rotation.y = yaw;
    panel.position.z = mm(H.lensZ + settings.screen);

    // The panel draws what the frame lit most recently was drawn for.
    const shownYaw = now.showing ? now.showing.shown : 0, offNow = shownYaw - now.head.angle;
    const panelPairs = [], panelZero = [];
    [1, -1].forEach((side, e) => {
      const center = side * FACE.eyeX;
      for (const azimuth of LANDMARKS) {
        const angle = wrap(azimuth - shownYaw);
        if (Math.abs(angle) > half) continue;
        const x = center + panelX(angle, plan.slope), reach = azimuth % 30 === 0 ? 14 : 8;
        (azimuth === 0 ? panelZero : panelPairs).push([x, FACE.eyeY - reach], [x, FACE.eyeY + reach]);
      }
      const angle = objectDirection(side, shownYaw, settings.distance);
      panelObjects[e].visible = Math.abs(angle) <= half;
      panelObjects[e].position.set(...at(center + panelX(Math.max(-half, Math.min(half, angle)), plan.slope), FACE.eyeY, -0.4));
    });
    onPanel(panelTicks, panelPairs);
    onPanel(panelAhead, panelZero);

    // The gyroscope's reading, and the camera's light.
    const sweep = Math.max(-1, Math.min(1, now.gyro / IMU_AT.fullCircle)) * 2 * Math.PI * 0.999;
    const arc = Array.from({length: 49}, (_, i) => [IMU_AT.x + IMU_AT.arc * Math.sin(sweep * i / 48), IMU_AT.y + IMU_AT.lift, IMU_AT.z + IMU_AT.arc * Math.cos(sweep * i / 48)]);
    fill(rateArc, Math.abs(sweep) > 1e-9 ? arc : [], (x, y, z) => at(x, y, z));
    cameraLight.material.color.set(now.t - now.imageTime < CAMERA_AT.lit ? COLORS.lit : COLORS.dark);

    // The long charts' cursors.
    setLine(timelineCursor, [[tx(now.t), T.y], [tx(now.t), T.y + T.h]]);
    setLine(errorsCursor, [[ex(now.t), E.y], [ex(now.t), E.y + E.h]]);

    // Frames close up: the last 120 ms.
    const w0 = now.t - F.window, fx = tau => F.x + (tau - w0) / F.window * F.w;
    const gyroPairs = [];
    for (let k = Math.max(0, Math.ceil(w0 * CLOCKS.gyro - 1e-9)); k <= now.stage; k++) {
      const x = fx(k / CLOCKS.gyro);
      gyroPairs.push([x, FRAME_ROWS.gyro[0]], [x, FRAME_ROWS.gyro[0] + 2 + 8 * Math.min(1, Math.abs(plan.gyro[k]) / 200)]);
    }
    setLine(gyroTicks, gyroPairs);
    const imagePairs = [];
    for (let j = Math.max(0, Math.ceil(w0 * CLOCKS.camera - 1e-9)); j <= now.image; j++) imagePairs.push([fx(j / CLOCKS.camera), FRAME_ROWS.camera[0]], [fx(j / CLOCKS.camera), FRAME_ROWS.camera[1]]);
    setLine(cameraTicks, imagePairs);
    const startPairs = [], pipePairs = [];
    let bar = 0;
    for (let n = Math.max(0, Math.floor((w0 - plan.latency) * CLOCKS.frame)); n < plan.frames.length; n++) {
      const frame = plan.frames[n];
      if (frame.t > now.t + 1e-12) break;
      if (frame.t >= w0 - 1e-12) startPairs.push([fx(frame.t), FRAME_ROWS.start[0]], [fx(frame.t), FRAME_ROWS.start[1]]);
      const from = Math.max(frame.t, w0), to = Math.min(frame.flash, now.t), level = tau => FRAME_ROWS.start[0] - (FRAME_ROWS.start[0] - FRAME_ROWS.flash[1]) * (tau - frame.t) / plan.latency;
      if (to > from) pipePairs.push([fx(from), level(from)], [fx(to), level(to)]);
      const lit0 = Math.max(frame.flash, w0), lit1 = Math.min(frame.flash + CLOCKS.flash, now.t);
      if (lit1 > lit0 && bar < flashBars.length) {
        const width = fx(lit1) - fx(lit0);
        flashBars[bar].visible = true;
        flashBars[bar].scale.x = mm(width);
        flashBars[bar].position.x = mm((fx(lit1) + fx(lit0)) / 2);
        bar++;
      }
    }
    for (; bar < flashBars.length; bar++) flashBars[bar].visible = false;
    setLine(startTicks, startPairs);
    setLine(pipes, pipePairs);

    // What the left eye sees: the landmarks where they truly are, and where the display draws them.
    const trueRow = landmarkRow(VIEW_ROWS.truth, now.head.angle, half), shownRow = landmarkRow(VIEW_ROWS.shown, shownYaw, half);
    setLine(truthTicks, trueRow.ticks);
    setLine(shownTicks, now.showing ? shownRow.ticks : []);
    setLine(aheadMarks, [...trueRow.ahead, ...(now.showing ? shownRow.ahead : [])]);
    const place = (object, row, headYaw, visible) => {
      const angle = objectDirection(1, headYaw, settings.distance);
      object.visible = visible && Math.abs(angle) <= half;
      object.position.set(...P(vx(Math.max(-half, Math.min(half, angle))), (row[0] + row[1]) / 2));
    };
    place(truthObject, VIEW_ROWS.truth, now.head.angle, true);
    place(shownObject, VIEW_ROWS.shown, shownYaw, Boolean(now.showing));

    const worst = plan.worstSlip, alpha = plan.alpha, age = now.t - now.imageTime;
    const motionHint = [`A smooth turn of ${fixed(HEAD.turn, 0)}° to the left in ${fixed(HEAD.turnTime, 0)} s, starting at ${fixed(HEAD.start, 1)} s, at up to ${fixed(plan.peakRate, 1)}°/s.`, `Swings of ${fixed(HEAD.swing, 0)}° each way, each taking ${fixed(HEAD.swingTime, 1)} s, at up to ${fixed(plan.peakRate, 1)}°/s.`, 'Held perfectly still for the whole run.'][settings.motion];
    return {
      state: {...plan, now, clock, shownYaw, offNow, sweep, half},
      readings: [
        r('Your result', clock <= 0 ? `Ready · ${MOTION_OPTIONS[settings.motion].label}; press Play` : clock >= CLOCKS.duration ? `The picture was never more than ${fixed(Math.abs(worst.slip), 2)}° off the room · the estimate ends ${fixed(Math.abs(plan.endDrift), 2)}° off` : `${fixed(now.t, 2)} s · head ${yawText(now.head.angle)} · picture ${fixed(Math.abs(offNow), 2)}° off`),
        r('Head', `${yawText(now.head.angle)} · ${fixed(Math.abs(now.head.rate), 1) === '0.0' ? 'still' : `turning at ${fixed(Math.abs(now.head.rate), 1)}°/s`}`, motionHint),
        r('Gyroscope', `Reads ${now.gyro < 0 ? '−' : ''}${fixed(Math.abs(now.gyro), 2)}°/s`, `One reading every millisecond, ω̂ = a + bω with an offset a of ${fixed(settings.offset, 1)}°/s and a scale b of ${fixed(plan.scale, 3)}. Before calibration, an MPU-6050’s datasheet allows ±20°/s of offset and ±3% of scale.`),
        r('Estimate', `${yawText(now.estimate)} · ${fixed(Math.abs(now.drift), 2) === '0.00' ? 'with the head' : `${fixed(Math.abs(now.drift), 2)}° ${now.drift > 0 ? 'ahead of' : 'behind'} the head`}`, alpha > 0 ? `The camera’s latest image, taken ${fixed(age * 1000, 1)} ms ago, is blended in with α = ${alphaText(alpha)} at every reading, a pull that acts over about ${fixed(1 / (alpha * CLOCKS.gyro), 1)} s.` : 'No correction: the estimate is only the readings added up, so every error in them stays.'),
        r('Display', now.showing ? `Frame ${fixed(now.showing.n, 0)} drawn for ${yawText(now.showing.shown)} · ${now.flashing ? 'lit' : 'dark between flashes'}` : 'Dark until the first frame lights', `Frames start ${fixed(CLOCKS.frame, 0)} times a second and light ${fixed(settings.latency, 0)} ms later for ${fixed(CLOCKS.flash * 1000, 0)} ms, each drawn for ${settings.prediction ? 'the yaw expected when it lights' : 'the estimate when it starts'}. This run’s worst frame was ${fixed(Math.abs(worst.slip), 2)}° off, ${fixed(worst.flash, 2)} s in.`),
        r('Lenses', `Screen ${fixed(settings.screen, 1)} mm from a ${fixed(LENS.focal, 0)} mm lens · image ${Number.isFinite(image.fromEye) ? `${fixed(image.fromEye, 2)} m away` : 'infinitely far'}`, `The eyes must focus at ${fixed(image.focus, 2)} D to see the screen sharply. With the screen at the lens’s focal length the image is infinitely far; each millimeter closer brings it much nearer.`),
        r('Eyes', `Aim ${fixed(eyes.aim, 2)} D · focus ${fixed(image.focus, 2)} D · conflict ${fixed(eyes.conflict, 2)} D`, `To look at the object ${fixed(settings.distance, 1)} m away, each eye turns in ${fixed(eyes.turn / DEG, 2)}°, ${fixed(eyes.vergence / DEG, 2)}° between them. Objects from ${fixed(eyes.near, 2)} m to ${Number.isFinite(eyes.far) ? `${fixed(eyes.far, 2)} m` : 'infinitely far'} stay within ${fixed(LENS.comfort, 1)} D of the focus, which most people find comfortable.`),
      ],
    };
  });

  const render = result.update;
  result.advance = dt => { if (Number.isFinite(dt) && dt > 0) clock = Math.min(CLOCKS.duration, clock + dt / SLOW); return render(); };
  result.animate = t => { const dt = Number.isFinite(t) ? Math.max(0, t - lastClock) : 0; if (Number.isFinite(t)) lastClock = t; return result.advance(dt); };
  result.reset = () => { clock = 0; lastClock = 0; return render(result.defaults); };
  result.actions = [
    {label: 'Inspect: the lenses', part: 'lenses', view: 'top', replay: false, run() { clock = 0; return render(); }},
    {label: 'Inspect: the gyroscope', part: 'imu', view: 'top', replay: false, run() { clock = 1; return render(); }},
    {label: 'Inspect: what the eye sees', part: 'view', view: 'front', replay: false, run() { clock = 1.02; return render(); }},
    {label: 'Inspect: frames close up', part: 'frames', view: 'front', replay: false, run() { clock = 1.02; return render(); }},
    {label: 'Inspect: aim and focus', part: 'focus', view: 'front', replay: false, run() { return render(); }},
  ];
  result.playback = {
    label: 'Move your head',
    description: 'The head moves for 3 s, played five times slower than real time.',
    stepLabel: 'Advance 10 ms',
    advance: result.advance,
    step: () => result.advance(0.01 * SLOW),
    complete: () => clock >= CLOCKS.duration,
    blocked: () => false,
  };

  root.rotation.set(0.4, -0.35, 0);
  result.initialPart = 'system';
  result.initialView = 'front';
  result.frameVisibleOnly = true;
  result.framePadding = 0.62;
  // The chip turns with the head; follow it, framed wide enough to show the
  // headset around it.
  result.followParts = ['imu'];
  result.parts.find(item => item.id === 'imu').framePadding = 2;
  result.selectionOutline = false;
  result.transparentBackground = true;
  result.topology = {system, wearer, skull, neck, nose, headset, shell, lenses, glass, display, panel, panelBorders, panelTicks, panelAhead, panelObjects, imu, rateArc, camera, cameraLight, timeline, truthLine, estimateLine, shownLine, timelineCursor, errors, driftLine, slipLine, errorsCursor, frames, gyroTicks, cameraTicks, startTicks, pipes, flashBars, view, viewEdges, truthTicks, shownTicks, aheadMarks, truthObject, shownObject, optics, screenLine, screenPoint, rays, backRays, focus, comfortBar, focusMark, aimMark, conflictLine, focusRing, aimRing, tx, ty, ex, ey, vx, dx, oP, eyeAt, MM, SLOW};
  const dispose = result.dispose;
  result.dispose = () => { if (!disposed) { disposed = true; dispose(); } };
  return result;
}

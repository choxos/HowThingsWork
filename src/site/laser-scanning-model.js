import * as THREE from 'three';
import {houseModel, reading as r} from './house-model-kit.js';
import {chartText, fillLine, lineObject, segmentLines, textLabel} from './scene-kit.js';
import {
  scanPlan, scanAt, depthResolution, SCAN, SCANNER, SCAN_DEFAULTS, SCAN_DOMAINS,
  PIXEL_OPTIONS, SUBPIXEL_OPTIONS, SPACING_OPTIONS, SIDE_OPTIONS,
} from './printing-physics.js';

export const BENCH = .03, PROFILE = .09;
export const timesLarger = perMm => perMm / BENCH;
export const SENSOR = Object.freeze({width: 3, high: .5});
export const CHART = Object.freeze({x: -1.4, y: -.6, w: 2.8, h: 1.2, samples: 61});
export const COLORS = Object.freeze({target: 0x91aa7e, ridge: 0xce825f, laser: 0xc14f39, seen: 0xd99a2b, hidden: 0x8f989b, grid: 0x374736, measured: 0x2b5d9c, cell: 0xf0dfaf});
export const chartX = depth => CHART.x + (depth - SCANNER.start) / SCANNER.height * CHART.w;
export const chartY = microns => CHART.y + (Math.log10(microns) + 1) / 4 * CHART.h;
const reasonText = {unlit: 'Laser path blocked', hidden: 'Receiver path blocked', range: 'Outside depth window', sensor: 'Outside image window'};

export function createLaserScanningModel() {
  const kit = houseModel('Laser scanning'), {part, control, finish} = kit;
  let clock = 0, lastClock = 0, previousValues, disposed = false;
  const label = (parent, text, y, size = .17, width = 3.6) => textLabel(parent, text, {height: size, width, position: [0, y, .03]});
  const system = part('system', 'From light to measured shape', 'A real target moves through a fixed laser plane. The camera sits outside that plane, so the two coordinates of the image reveal both position across the line and height. Known table travel supplies the third coordinate. The enlarged cloud holds only acquired returns.');
  const bench = part('bench', 'Laser, camera and moving target', 'Red rays end at the first surface they reach. Gold segments connect illuminated points to the offset camera. Gray segments stop where the ridge blocks that view. The camera is outside the laser plane. The target moves under both; all physical directions use the same scale.', [-1.15, -1.05, 0], system);
  const rig = new THREE.Group(); rig.rotation.set(.3, -.5, 0); bench.add(rig);
  const unitBox = new THREE.BoxGeometry(1, 1, 1);
  const block = (parent, color) => {
    const object = new THREE.Mesh(unitBox, new THREE.MeshStandardMaterial({color, roughness: .85}));
    parent.add(object); return object;
  };
  const table = block(rig, 0xb4c5b0); table.scale.set(30 * BENCH, 2 * BENCH, 54 * BENCH); table.position.y = -3 * BENCH;
  const target = new THREE.Group(); rig.add(target);
  const targetBase = block(target, COLORS.target); targetBase.scale.set(SCAN.width * BENCH, SCAN.base * BENCH, SCAN.depth * BENCH); targetBase.position.y = -SCAN.base * BENCH / 2;
  const ridgeBlock = block(target, COLORS.ridge);
  const laserHead = block(rig, COLORS.laser), receiverHead = block(rig, COLORS.grid);
  laserHead.scale.set(3 * BENCH, 4 * BENCH, 3 * BENCH); receiverHead.scale.set(4 * BENCH, 4 * BENCH, 4 * BENCH);
  const laserRays = segmentLines(25, COLORS.laser, rig), seenRays = segmentLines(25, COLORS.seen, rig), blockedRays = segmentLines(25, COLORS.hidden, rig);
  const baselineBar = segmentLines(3, COLORS.grid, rig), scanLine = segmentLines(25, COLORS.laser, rig);
  const benchTitle = label(bench, 'Original target and scanner', 2.75, .15, 1.8);
  label(bench, 'Red: laser · dark: camera', 2.55, .12, 1.8);
  const benchDetail = label(bench, '', -.65, .13, 1.8);

  const cloud = part('cloud', 'Measured point cloud', 'Each sphere is a recovered point, stored in the target frame after subtracting table movement. Rotate it to inspect all three coordinates. A missing return contributes no sphere. This cloud is enlarged three times relative to the bench, equally in all directions. It is not a closed printable solid.', [.85, -.35, 0], system);
  const cloudBody = new THREE.Group(); cloudBody.rotation.set(.5, -.4, 0); cloud.add(cloudBody);
  const cloudDots = new THREE.InstancedMesh(new THREE.SphereGeometry(.026, 8, 6), new THREE.MeshBasicMaterial({color: COLORS.measured}), 625);
  cloudDots.count = 0; cloudDots.frustumCulled = false; cloudBody.add(cloudDots);
  const cloudGrid = segmentLines(14, 0x9aa39a, cloudBody), gridPoints = [];
  for (let k = -12; k <= 12; k += 4) gridPoints.push([k * PROFILE, -.02, -12 * PROFILE], [k * PROFILE, -.02, 12 * PROFILE], [-12 * PROFILE, -.02, k * PROFILE], [12 * PROFILE, -.02, k * PROFILE]);
  fillLine(cloudGrid, gridPoints);
  label(cloud, 'Measured cloud · 3× scale', 1.38, .17, 2.4);
  const cloudCount = label(cloud, '', -1.28, .15, 2.5);
  const progress = label(system, '', -1.95, .17, 4.4);

  const inspections = [];
  const inspection = (id, name, description) => {
    const object = part(id, name, description, [0, 0, 0], system);
    object.userData.inspectionOnly = id; object.userData.explosionExcluded = true; inspections.push(object); return object;
  };
  const profile = inspection('profile', 'An acquired cross section', 'Blue marks are recovered coordinates in a stored profile. The gray outline is the known reference target for comparison, not a measured surface. Red hollow marks below it indicate attempted positions with no return. Once acquired, the center profile stays selected. Both axes use the same three-times bench scale.');
  const profileOutline = lineObject(6, COLORS.hidden, profile);
  const profileDots = new THREE.InstancedMesh(new THREE.CircleGeometry(.027, 12), new THREE.MeshBasicMaterial({color: COLORS.measured}), 25);
  const missedDots = new THREE.InstancedMesh(new THREE.RingGeometry(.022, .034, 12), new THREE.MeshBasicMaterial({color: COLORS.laser}), 25);
  for (const dots of [profileDots, missedDots]) { dots.count = 0; dots.frustumCulled = false; profile.add(dots); }
  label(profile, 'Stored profile: reference and measurement', 1.25, .2);
  label(profile, 'Gray: reference · blue: measured · red: missing', 1.01, .15);
  const profileCaption = label(profile, '', -.75);
  label(profile, 'Both axes: 3× the bench scale', -.99, .15);

  const sensor = inspection('sensor', 'From image coordinates to height', 'The camera has a two-dimensional image. This close-up shows one physical pixel in its depth-sensitive direction, v. Blue marks the ideal spot and gold the rounded estimate. Fine divisions represent an ideal estimation grid within that same pixel. The other image coordinate, u, is also rounded before recovering the point. No intensity fitting or sensor noise is simulated.');
  const sensorCell = new THREE.Mesh(new THREE.PlaneGeometry(SENSOR.width, SENSOR.high), new THREE.MeshBasicMaterial({color: COLORS.cell})); sensor.add(sensorCell);
  const sensorGrid = segmentLines(51, COLORS.hidden, sensor), spotLine = segmentLines(1, COLORS.measured, sensor), readLine = segmentLines(1, COLORS.seen, sensor);
  label(sensor, 'One physical pixel, enlarged', .9, .23);
  label(sensor, 'Blue: ideal spot · gold: estimated position', .64, .16);
  const sensorCaption = label(sensor, '', -.58), sensorEstimate = label(sensor, '', -.82, .15), sensorScale = label(sensor, '', -1.05, .14);

  const chart = inspection('chart', 'Depth sensitivity and distance', 'The curve is the local change in recovered depth per estimation-grid step. It grows with distance squared and falls as baseline or focal length increases. This derivative describes ideal quantization sensitivity. It is not measurement accuracy, repeatability or the reference scanner’s linearity.');
  const chartGrid = segmentLines(6, 0xb4c5b0, chart), chartLines = [];
  for (let decade = -1; decade <= 3; decade++) chartLines.push([CHART.x,chartY(10**decade),0],[CHART.x+CHART.w,chartY(10**decade),0]);
  chartLines.push([CHART.x,CHART.y,0],[CHART.x,CHART.y+CHART.h,0]); fillLine(chartGrid, chartLines);
  const resolutionCurve = lineObject(CHART.samples, COLORS.measured, chart), chartCursor = segmentLines(2, COLORS.laser, chart);
  chartText(chart, (depth, decade) => [chartX(depth), CHART.y + (decade + 1) / 4 * CHART.h, 0], {
    title: 'Depth per estimation step, log scale', size: .135,
    x: {min: SCANNER.start, max: SCANNER.end, title: 'Depth below camera (mm)', ticks: [[53.5, '53.5'], [66, '66'], [78.5, '78.5']]},
    y: {min: -1, max: 3, title: 'Depth per step (μm)', ticks: [[-1, '0.1'], [0, '1'], [1, '10'], [2, '100'], [3, '1000']]},
  });
  const chartValue = label(chart, '', -1.17);
  system.traverse(object => { if (object.userData.textLabel) object.material.side = THREE.FrontSide; });

  const d = SCAN_DEFAULTS;
  control('standoff', 'Standoff', ...SCAN_DOMAINS.standoff, d.standoff, 'mm', 'Camera height above the base top. Raised surfaces may fall outside the 53.5 to 78.5 mm depth window; those points are rejected.');
  control('baseline', 'Baseline', ...SCAN_DOMAINS.baseline, d.baseline, 'mm', 'Distance from the laser plane to the camera. A wider baseline improves ideal depth sensitivity and may hide more surface behind the ridge.');
  control('pixel', 'Pixel', ...SCAN_DOMAINS.pixel, d.pixel, '', 'Illustrative physical pixel pitch. This changes the image-coordinate rounding and the recovered points.', PIXEL_OPTIONS);
  control('subpixel', 'Reading', ...SCAN_DOMAINS.subpixel, d.subpixel, '', 'Round to a whole pixel or to an ideal grid within it. A finer grid does not guarantee real scanner accuracy.', SUBPIXEL_OPTIONS);
  control('ridge', 'Ridge', ...SCAN_DOMAINS.ridge, d.ridge, 'mm', 'Raise the actual block on the target. It can block illumination or the camera view, and its top may leave the depth window.');
  control('spacing', 'Sampling', ...SCAN_DOMAINS.spacing, d.spacing, '', 'Spacing of attempted upper-face samples across each line and between acquired profiles. Wider spacing leaves fewer measured points.', SPACING_OPTIONS);
  control('side', 'Receiver', ...SCAN_DOMAINS.side, d.side, '', 'Move the camera to the opposite side of the laser plane. The camera shadow moves across the target; missing data is not filled.', SIDE_OPTIONS);

  const matrix = new THREE.Matrix4();
  const finishDots = (dots, count) => { dots.count = count; dots.instanceMatrix.needsUpdate = true; dots.computeBoundingBox(); dots.computeBoundingSphere(); };
  const result = finish(v => {
    const plan = scanPlan(v), valuesKey = JSON.stringify(plan.values);
    if (previousValues && previousValues !== valuesKey) { clock = 0; lastClock = 0; }
    previousValues = valuesKey;
    const now = scanAt(plan, clock), middle = now.middle, active = clock > 0;
    target.position.z = -now.position * BENCH;
    ridgeBlock.visible = plan.ridge > 0; ridgeBlock.scale.set(SCAN.ridgeWidth * BENCH, Math.max(plan.ridge, 1e-9) * BENCH, SCAN.ridgeDepth * BENCH); ridgeBlock.position.y = plan.ridge * BENCH / 2;
    laserHead.position.set(0, (plan.standoff + 2) * BENCH, 0);
    receiverHead.position.set(0, (plan.standoff + 2) * BENCH, -plan.sideSign * plan.baseline * BENCH);
    const at = point => [point[0] * BENCH, point[1] * BENCH, (point[2] - now.position) * BENCH];
    const lit = [], seen = [], hidden = [], illuminated = [];
    if (active) for (const sample of now.current.samples) {
      lit.push(at(sample.laser), at(sample.laserEnd));
      if (sample.lit) {
        if (sample.seen) seen.push(at(sample.target), at(sample.receiver));
        else hidden.push(at(sample.receiver), at(sample.receiverEnd));
        const point = at(sample.target); illuminated.push([point[0] - .012, point[1] + .004, point[2]], [point[0] + .012, point[1] + .004, point[2]]);
      }
    }
    fillLine(laserRays, lit); fillLine(seenRays, seen); fillLine(blockedRays, hidden); fillLine(scanLine, illuminated);
    const h = (plan.standoff + 6) * BENCH, b = -plan.sideSign * plan.baseline * BENCH;
    fillLine(baselineBar, [[0,h,0],[0,h,b],[-.035,h,0],[.035,h,0],[-.035,h,b],[.035,h,b]]);
    benchDetail.userData.setText(`Table: ${now.moved.toFixed(1)} / 24 mm`);
    let count = 0;
    for (const point of now.cloud) { matrix.makeTranslation(...point.map(value => value * PROFILE)); cloudDots.setMatrixAt(count++, matrix); }
    finishDots(cloudDots, count);
    cloudCount.userData.setText(active ? `${now.held} returns · ${now.gaps} missing` : 'Empty until scanning starts');
    progress.userData.setText(active ? `${now.done ? 'Complete' : 'Scanning'} · ${now.profiles}/${plan.profiles} profiles` : 'Press Play to acquire the shape');

    const stored = now.detailProfile, sectionHeight = stored && Math.abs(stored.z) <= SCAN.ridgeDepth / 2 ? plan.ridge : 0;
    const y0 = -.25;
    fillLine(profileOutline, stored ? [[-12,0],[-6,0],[-6,sectionHeight],[6,sectionHeight],[6,0],[12,0]].map(([x,y]) => [x * PROFILE, y0 + y * PROFILE, 0]) : []);
    let good = 0, bad = 0;
    if (stored) for (const sample of stored.samples) {
      if (sample.point) { matrix.makeTranslation(sample.point[0] * PROFILE, y0 + sample.point[1] * PROFILE, .005); profileDots.setMatrixAt(good++, matrix); }
      else { matrix.makeTranslation(sample.x * PROFILE, y0 - .15, .005); missedDots.setMatrixAt(bad++, matrix); }
    }
    finishDots(profileDots, good); finishDots(missedDots, bad);
    profileCaption.userData.setText(stored ? `At Z = ${stored.z} mm: ${good} returns, ${bad} missing` : 'No profile acquired yet');

    const divisions = plan.subpixel, edges = [];
    for (let i = 0; i <= divisions; i++) {
      const x = -SENSOR.width / 2 + i / divisions * SENSOR.width;
      edges.push([x,-SENSOR.high / 2,.001],[x,SENSOR.high / 2,.001]);
    }
    fillLine(sensorGrid, edges);
    const image = middle?.image, reached = middle?.reached, whole = image ? Math.round(image[1] / plan.pixel) : 0;
    const sensorX = value => (value / plan.pixel - whole) * SENSOR.width;
    fillLine(spotLine, image ? [[sensorX(image[1]),-.36,.003],[sensorX(image[1]),.36,.003]] : []);
    fillLine(readLine, reached ? [[sensorX(reached[1]),-.31,.004],[sensorX(reached[1]),.31,.004]] : []);
    sensorCaption.userData.setText(middle ? middle.reason ? reasonText[middle.reason] : `Stored center sample: ${middle.measured.toFixed(4)} mm high` : 'No image acquired yet');
    sensorEstimate.userData.setText(`${plan.pixelMicrons.toFixed(1)} μm pixel · ${plan.gridMicrons.toFixed(3)} μm estimation step`);
    const magnification = SENSOR.width / plan.pixel / BENCH;
    sensorScale.userData.setText(`Pixel close-up: ${magnification.toFixed(0)}× the bench scale`);
    fillLine(resolutionCurve, Array.from({length: CHART.samples}, (_, i) => {
      const depth = SCANNER.start + SCANNER.height * i / (CHART.samples - 1);
      return [chartX(depth), chartY(depthResolution(depth, plan.focal, plan.baseline, plan.grid) * 1000), 0];
    }));
    const cx = chartX(plan.standoff), cy = chartY(plan.resolutionMicrons);
    fillLine(chartCursor, [[cx-.04,cy,.003],[cx+.04,cy,.003],[cx,cy-.04,.003],[cx,cy+.04,.003]]);
    chartValue.userData.setText(`${plan.standoff} mm depth → ${plan.resolutionMicrons.toFixed(2)} μm per step`);
    const reasons = now.reasons;
    return {state: {...plan, now, middle, clock, magnification}, readings: [
      r('Your result', !active ? 'Ready · no acquired points' : `${now.done ? 'Scanned' : 'Scanning'} · ${now.held} of ${now.attempted} attempts returned`, 'Changing any setting clears the old measurements and restarts the scan. Complete means the sweep ended; it does not mean the whole object was recovered.'),
      r('Stored center height', !middle ? 'Not acquired yet' : middle.point ? `${middle.measured.toFixed(4)} mm` : reasonText[middle.reason], !middle ? 'The middle sample of the latest acquired profile appears here. Once the center profile is acquired, its sample stays selected for comparison.' : middle.point ? `At X = 0, Z = ${middle.z} mm, the reference height is ${middle.surface.toFixed(2)} mm. Recovered height differs by ${(Math.abs(middle.error)*1000).toFixed(2)} μm. This is ideal rounding error, not real scanner accuracy.` : 'No height is inferred for this sample. The cloud keeps the gap.'),
      r('Missing returns', `${now.gaps}`, `${reasons.unlit} illumination blocks; ${reasons.hidden} camera blocks; ${reasons.range} outside the depth window; ${reasons.sensor} outside the image window. Unattempted profiles are not counted as missing.`),
      r('Image coordinates', middle?.reached ? `u ${middle.reached[0].toFixed(5)}, v ${middle.reached[1].toFixed(5)} mm` : 'No accepted image', 'Both image coordinates are rounded to the selected grid. Depth comes from v and the known baseline; u then gives position across the line. Z comes from table motion. The virtual image is drawn in front of the pinhole.'),
      r('Depth per grid step', `${plan.resolutionMicrons.toFixed(2)} μm`, `At the ${plan.standoff} mm reference depth, local sensitivity is depth squared times grid pitch divided by focal length and baseline. This derivative is not an exact error bound. Grid pitch is ${plan.gridMicrons.toFixed(3)} μm; physical pixel pitch is ${plan.pixelMicrons.toFixed(1)} μm.`),
      r('Profiles acquired', `${now.profiles} of ${plan.profiles}`, `${plan.columns.length} upper-face positions per profile, ${plan.spacing} mm apart in both sampling directions. The table travels 24 mm at 4 mm/s. The first profile is acquired when playback begins; none exists before Play.`),
      r('Camera offset', `${plan.sideSign * plan.baseline} mm`, 'The signed baseline is perpendicular to the laser plane. Reversing it moves the camera shadow to the other side. The receiver remains outside the plane at every setting.'),
      r('What the cloud contains', `${now.held} measured points`, 'Only accepted image records become 3D points. Vertical faces, underside, hidden regions and spaces between samples remain unmeasured. There is no surface interpolation, closed mesh, or automatic route from this cloud to a printer.'),
    ]};
  });
  const render = result.update;
  result.advance = dt => { if (Number.isFinite(dt) && dt > 0) clock = Math.min(SCAN.duration, clock + dt); return render(); };
  result.animate = t => { const dt = Number.isFinite(t) ? Math.max(0,t-lastClock) : 0; if (Number.isFinite(t)) lastClock=t; return result.advance(dt); };
  result.reset = () => { clock=0; lastClock=0; return render(result.defaults); };
  result.actions = [['bench','the scanner'],['profile','a stored profile'],['sensor','the image estimate'],['cloud','measured points'],['chart','depth sensitivity']].map(([part,title]) => ({label:`Inspect: ${title}`,part,view:'front',replay:false,isolate:true,run:()=>render()}));
  result.playback = {label:'Scan the target',description:'Move the target through the fixed laser plane. Profiles accumulate at the selected spacing; hidden and out-of-range samples remain missing.',stepLabel:'Advance 1 s',advance:result.advance,step:()=>result.advance(1),complete:()=>clock>=SCAN.duration,blocked:()=>false};
  result.resultPart = {id:'cloud',label:'Inspect the measured cloud',view:'front',focusOnComplete:false,available:()=>clock>=SCAN.duration};
  result.initialPart='system'; result.initialView='front'; result.frameVisibleOnly=true; result.framePadding=.52; result.autoFramePart='system';
  result.selectionOutline=false; result.transparentBackground=true;
  result.inspectionObjects=id=>inspections.filter(object=>object.userData.inspectionOnly===id); result.thumbnailOmit=inspections;
  result.catalogParts=result.parts.filter(p=>p.id!=='system');
  result.frameBoundsForPart=id=>id==='system'?new THREE.Box3(new THREE.Vector3(-2.2,-2.12,-1.8),new THREE.Vector3(2.35,1.95,1.8)).applyMatrix4(system.matrixWorld):null;
  result.topology={system,bench,rig,table,target,targetBase,ridgeBlock,laserHead,receiverHead,laserRays,seenRays,blockedRays,scanLine,baselineBar,benchTitle,benchDetail,cloud,cloudBody,cloudDots,cloudGrid,cloudCount,progress,profile,profileOutline,profileDots,missedDots,profileCaption,sensor,sensorCell,sensorGrid,spotLine,readLine,sensorCaption,sensorEstimate,sensorScale,chart,chartGrid,resolutionCurve,chartCursor,chartValue};
  const dispose=result.dispose; result.dispose=()=>{if(!disposed){disposed=true;dispose();}};
  return result;
}

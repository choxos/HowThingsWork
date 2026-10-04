import * as THREE from 'three';
import {houseModel, reading as r} from './house-model-kit.js';
import {fixed} from './format.js';
import {surface, lineObject, textLabel, chartText} from './scene-kit.js';
import {spurGearShape, rackShape, pinionOnRack} from './gear-geometry.js';
import {sampleWaterPlan, waterClockPlan, potRadius, DESIGNS, WATER as W, WATER_DEFAULTS as D, WATER_DOMAINS, referenceFlow, referenceRise} from './water-clock-physics.js';

const MM = .004, TAU = 2 * Math.PI, CUT = Math.PI / 3, BLUE = 0x366d83;
const G = Object.freeze({floor: 80, gearX: 36, gearY: 440, rackTeeth: 52, rackModule: 2, rackDepth: 4, rackThickness: 6, potFloor: 320, catchRadius: 220, catchHeight: 250, overflowX: 140, overflowRadius: 70});
const point = p => p.map(x => x * MM);
const orificeProfile = bore => [[bore / 2, 0], [6, 0], [6, -.15], [bore / 2, -.15], [bore / 2, 0]];
const lathe = (profile, start = CUT, angle = TAU - 2 * CUT) => new THREE.LatheGeometry(profile.map(([x, y]) => new THREE.Vector2(x * MM, y * MM)), 64, start, angle);
export const potProfile = (design, h, bore) => {const a = potRadius(design, 0) * 1000, b = potRadius(design, h / 1000) * 1000; return [[a, 0], [b, h], [b + 4, h], [a + 4, -4], [bore / 2 + 3, -4], [bore / 2, 0], [a, 0]];};
export const chartPoint = (hours, indicated) => point([-100 + hours * 20, -100 + indicated * 16, 1]);

export function createWaterClockModel() {
  const kit = houseModel('Water clock'), {root, part, control} = kit;
  const system = part('system', 'Water clock comparison', 'Compare a float-driven inflow clock with two outflow vessels. Each scale keeps its original calibration when you change the rate. These are original teaching models with modern equal hours.');
  const inflow = part('inflow', 'Float-driven inflow clock', 'A regulated inlet fills the receiver. Buoyancy raises the float and attached rack; meshing teeth turn a supported shaft and its clock hand.', [0, 0, 0], system);
  const outflow = part('outflow', 'Calibrated outflow clock', 'Water leaves a sharp orifice under a falling head. Read its level against marks calibrated once for a 1 mm opening.', [0, 0, 0], system);
  const box = (size, pos, color, parent) => kit.box(point(size), point(pos), color, parent);
  const rod = (a, b, radius, color, parent) => kit.rod(point(a), point(b), radius * MM, color, parent);
  const cylinder = (radius, height, pos, color, parent) => kit.cylinder(radius * MM, height * MM, point(pos), color, parent);
  const disk = (radius, height, pos, color, parent) => kit.disk(radius * MM, height * MM, point(pos), color, parent);
  const label = (parent, text, pos, height = 12, width) => {const m = textLabel(parent, text, {position: point(pos), height: height * MM, ...(width ? {width: width * MM} : {})}); m.raycast = () => {}; return m;};
  const setRod = (m, a, b) => {const av = new THREE.Vector3(...point(a)), bv = new THREE.Vector3(...point(b)), delta = bv.clone().sub(av); m.position.copy(av).add(bv).multiplyScalar(.5); m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), delta.clone().normalize()); m.scale.y = delta.length() / m.geometry.parameters.height;};
  const waterColumn = (parent, radius, color = BLUE) => {const mesh = surface(kit, lathe([[0, 0], [radius, 0], [radius, 1], [0, 1]]), color, parent, true); mesh.material.transparent = true; mesh.material.opacity = .72; mesh.material.depthWrite = false; mesh.material.polygonOffset = true; mesh.material.polygonOffsetFactor = -1; mesh.material.polygonOffsetUnits = -2; return mesh;};
  const vessel = (parent, radius, height, y, color = 'cream') => {const m = surface(kit, lathe([[radius, 0], [radius, height], [radius + 3, height], [radius + 3, -3], [0, -3], [0, 0], [radius, 0]]), color, parent, true); m.position.y = y * MM; return m;};
  const frame = part('frame', 'Base, shaft bearings and rack guides', 'The base supports the receiver, inlet and drain. Two bearings carry the shaft. Guides constrain the rack to vertical translation while leaving its teeth exposed.', [0, 0, 0], inflow);
  box([380, 14, 210], [45, -7, 0], 'wood', frame);
  cylinder(48, 77, [0, 38.5, 0], 'cream', frame);
  for (const x of [-105, 115]) rod([x, 0, -90], [x, 465, -90], 6, 'wood', frame);
  box([232, 14, 12], [5, 440, -90], 'wood', frame);
  rod([115, 440, -90], [115, 440, 22], 5, 'metal', frame);
  box([79, 10, 10], [75.5, 440, 22], 'metal', frame);
  box([18, 18, 60], [G.gearX, G.gearY, -54], 'metal', frame);
  rod([-105, 465, -90], [-105, 465, -30], 5, 'metal', frame);
  const bearings = [];
  for (const z of [-20, 22]) {const shape = new THREE.Shape().absarc(0, 0, 9, 0, TAU, false); shape.holes.push(new THREE.Path().absarc(0, 0, 3.2, 0, TAU, true)); const m = surface(kit, new THREE.ExtrudeGeometry(shape, {depth: 8, bevelEnabled: false, curveSegments: 32}), 'ink', frame); m.geometry.scale(MM, MM, MM); m.position.set(...point([G.gearX, G.gearY, z - 4])); bearings.push(m);}
  const guideBlocks = [];
  for (const y of [428, 452]) {rod([-7.5, y, -90], [-7.5, y, -6], 3, 'metal', frame); guideBlocks.push(box([3, 10, 12], [-8.2, y, 0], 'ink', frame)); for (const z of [-4.2, 4.2]) guideBlocks.push(box([4, 10, 2], [-4.6, y, z], 'ink', frame));}

  const feed = part('feed', 'Ideal regulated inlet', 'An external water supply delivers the selected constant rate. The valve indicates the requested rate; no real valve flow law or historical regulator is simulated.', [0, 0, 0], inflow);
  const feedPath = [[-140, 465, -30], [-105, 465, -30], [-28, 465, -20], [-28, 390, -20]];
  const feedTubes = []; for (let i = 1; i < feedPath.length; i++) feedTubes.push(rod(feedPath[i - 1], feedPath[i], 4, 'metal', feed));
  const feedValve = disk(13, 10, [-105, 465, -25], 'gold', feed);
  const valveHandle = box([23, 4, 4], [-105, 465, -17], 'ink', feed);
  const feedText = label(feed, '', [-90, 493, -15], 12, 200);
  const feedStream = rod([-28, 390, -20], [-28, 110, -20], .6, BLUE, feed);
  const droplets = Array.from({length: 3}, () => kit.sphere(2.5 * MM, [0, 0, 0], BLUE, feed));

  const receiver = part('receiver', 'Receiving vessel and fixed level scale', 'The cylindrical receiver has 40 mm internal radius. Its water starts 30 mm deep. The hour marks assume the nominal 94.7482 mL/h inflow and never move with the rate control. Front cutaway reveals the mechanism.', [0, 0, 0], inflow);
  const jarWall = vessel(receiver, 40, 270, G.floor);
  // Raised rim except at the right-hand overflow notch. The ideal weir fixes
  // the level at the notch crest; finite weir depth and transients are omitted.
  const rim = [];
  for (const [start, end] of [[CUT, Math.PI / 2 - .2], [Math.PI / 2 + .2, TAU - CUT]]) {const m = surface(kit, lathe([[40, 270], [40, 300], [43, 300], [43, 270], [40, 270]], start, end - start), 'cream', receiver, true); m.position.y = G.floor * MM; rim.push(m);}
  const jarWater = waterColumn(receiver, 40); jarWater.position.y = G.floor * MM;
  const levelMarks = [];
  for (let h = 0; h <= 12; h++) {const y = G.floor + (W.initialLevel + h * referenceRise) * 1000; levelMarks.push(rod([-49, y, 16], [-40, y, 16], .7, 'ink', receiver)); if (h % 2 === 0) label(receiver, String(h), [-59, y, 16], 9);}
  label(receiver, 'HOURS', [-59, 375, 16], 9);

  const floatPart = part('float', 'Buoyant float', 'The float carries the moving rack. Their combined mass is 40 g. Displacing 40 mL gives 0.3924 N of buoyancy: 22.10 mm of the 40 mm tall float lies below the water surface.', [0, 0, 0], inflow);
  const float = cylinder(24, 40, [0, 0, 0], 'wood', floatPart);
  const rackPart = part('rack', 'Guided toothed rack', 'The rack is attached directly to the float. Each 6.283 mm of rise advances one tooth of the 36-tooth, module-2 pinion. Tooth profiles are involute-compatible; small backlash is shown but not simulated.', [0, 0, 0], inflow);
  const rack = surface(kit, new THREE.ExtrudeGeometry(rackShape({teeth: G.rackTeeth, module: 2, depth: 4}), {depth: 6, bevelEnabled: false}), 'gold', rackPart);
  rack.geometry.scale(MM, MM, MM); rack.geometry.translate(0, 0, -3 * MM); rack.rotation.z = -Math.PI / 2;
  const attachment = box([12, 3, 12], [-3, 0, 0], 'metal', rackPart);
  const drive = part('drive', 'Pinion and supported shaft', 'The rising rack turns this 36-tooth pinion clockwise. Its 36 mm pitch radius converts rack travel into angle. The shaft passes through two frame bearings and carries the hand.', [0, 0, 0], inflow);
  const pinion = surface(kit, new THREE.ExtrudeGeometry(spurGearShape({teeth: 36, module: 2, bore: 3}), {depth: 8, bevelEnabled: false, curveSegments: 32}), 'gold', drive);
  pinion.geometry.scale(MM, MM, MM); pinion.geometry.translate(0, 0, -4 * MM); pinion.position.set(...point([G.gearX, G.gearY, 0]));
  const shaft = rod([G.gearX, G.gearY, -24], [G.gearX, G.gearY, 47], 3, 'metal', drive);
  disk(6, 11, [G.gearX, G.gearY, 0], 'ink', drive);
  const display = part('display', 'Fixed equal-hour dial and hand', 'The hand is fixed to the pinion shaft. One turn represents twelve indicated hours; the elapsed-hours readout retains completed turns. The dial is calibrated at nominal flow, not recalibrated when flow changes.', [0, 0, 0], inflow);
  const dialShape = new THREE.Shape().absarc(0, 0, 67, 0, TAU, false); dialShape.holes.push(new THREE.Path().absarc(0, 0, 45, 0, TAU, true));
  const dial = surface(kit, new THREE.ExtrudeGeometry(dialShape, {depth: 3, bevelEnabled: false, curveSegments: 64}), 'cream', display); dial.geometry.scale(MM, MM, MM); dial.position.set(...point([G.gearX, G.gearY, 35]));
  for (const h of [0, 3, 6, 9]) {const a = h * TAU / 12; rod([G.gearX + 64 * Math.sin(a), G.gearY + 64 * Math.cos(a), 35], [115, G.gearY, 22], 1.5, 'metal', frame);}
  for (let h = 0; h < 12; h++) {const a = h * TAU / 12; label(display, h ? String(h) : '12', [G.gearX + 57 * Math.sin(a), G.gearY + 57 * Math.cos(a), 39], 9); rod([G.gearX + 47 * Math.sin(a), G.gearY + 47 * Math.cos(a), 39], [G.gearX + 50 * Math.sin(a), G.gearY + 50 * Math.cos(a), 39], .5, 'ink', display);}
  const hand = new THREE.Group(); hand.position.set(...point([G.gearX, G.gearY, 44])); display.add(hand);
  rod([0, -12, 0], [0, 49, 0], 1.3, 'red', hand); disk(4.5, 5, [0, 0, 0], 'ink', hand); disk(Math.sqrt(1.3 ** 2 * (49 ** 2 - 12 ** 2) / 48), 2, [0, -12, 0], 'red', hand);
  const dialText = label(display, '', [165, G.gearY + 33, 40], 11, 130);

  const drain = part('drain', 'Overflow channel and collection bowl', 'At 270 mm depth, incoming water spills through the right-hand notch and reaches a separate bowl. The float then stops rising. Incoming water equals added receiver water plus collected overflow.', [0, 0, 0], inflow);
  box([104, 2, 16], [90, 349, 0], 'metal', drain); for (const z of [-9, 9]) box([104, 10, 2], [90, 355, z], 'metal', drain);
  rod([115, 350, -90], [140, 348, 0], 3, 'metal', frame);
  const overflowStream = rod([40, 350, 0], [143, 350, 0], 1, BLUE, drain);
  const overflowDrop = rod([143, 350, 0], [143, 3, 0], .8, BLUE, drain);
  const bowl = vessel(drain, 70, 100, 3); bowl.position.x = 140 * MM;
  const bowlWater = waterColumn(drain, 70); bowlWater.position.set(...point([140, 3, 0]));

  const pot = part('pot', 'Outflow vessel with fixed hour marks', 'The vessel is 400 mm deep. The cylinder has 150 mm internal radius. The conical vessel widens linearly from 80 to 150 mm. Marks are independently calibrated for each shape with a 1 mm hole.', [0, G.potFloor * MM, 0], outflow);
  const potWall = surface(kit, lathe(potProfile(0, 400, 1)), 'clay', pot, true);
  const potWater = waterColumn(pot, 1); const waterBase = Float32Array.from(potWater.geometry.attributes.position.array);
  const potScale = new THREE.Group(); pot.add(potScale); const potTicks = [];
  // Allocate every possible hour once. Mode changes only move/show marks.
  for (let i = 0; i <= 12; i++) {const tick = rod([0, 0, 0], [10, 0, 0], .9, 'ink', potScale), text = label(potScale, String(i), [0, 0, 0], 12), leader = rod([0, 0, 0], [1, 0, 0], .35, 'ink', potScale); potTicks.push({tick, text, leader});}
  const emptyText = label(potScale, '', [0, -24, 0], 11, 210);
  const outlet = part('outlet', 'Sharp-edged drain opening', 'The actual selected opening is cut through the vessel floor. The calculation uses Q = 0.62 a sqrt(2gh), with a constant illustrative discharge coefficient. Flow markers are magnified and do not represent drop volume or jet width.', [0, G.potFloor * MM, 0], outflow);
  const orifice = surface(kit, lathe(orificeProfile(1), 0, TAU), 'gold', outlet, true); orifice.material.polygonOffset = true; orifice.material.polygonOffsetFactor = -1; orifice.material.polygonOffsetUnits = -4;
  const potStream = rod([0, -4, 0], [0, -G.potFloor, 0], .7, BLUE, outlet);
  const potDrops = Array.from({length: 3}, () => kit.sphere(3 * MM, [0, 0, 0], BLUE, outlet));
  const potSupport = part('pot-support', 'Bridge stand', 'The stand supports the vessel above its catch basin. A gap between the two bridge halves leaves the central outlet open.', [0, 0, 0], outflow);
  box([540, 14, 500], [0, -7, 0], 'wood', potSupport);
  for (const side of [-1, 1]) {box([20, 308, 40], [side * 245, 154, 0], 'wood', potSupport); box([240, 8, 20], [side * 125, 312, 0], 'wood', potSupport);}
  const catchPart = part('catch', 'Water collection basin', 'The basin has 220 mm internal radius and 250 mm depth, enough for the entire cylinder. Water remaining in the clock plus water in the basin equals the initial amount.', [0, 0, 0], outflow);
  const catchWall = vessel(catchPart, 220, 250, 3, 'metal'), catchWater = waterColumn(catchPart, 220); catchWater.position.y = 3 * MM; catchPart.add(potStream, ...potDrops);

  const chart = part('chart', 'Actual time versus indicated time', 'The blue trace shows what the fixed scale says, including any stopped interval. The gray diagonal is correct timekeeping. Plot axes are hours, independent of the physical model scale.', [650 * MM, 300 * MM, 0], system);
  chart.userData.inspectionOnly = 'chart'; chart.userData.explosionExcluded = true;
  box([370, 330, 1], [0, 0, -2], 'cream', chart).material = new THREE.MeshBasicMaterial({color: 0xf8f5e9});
  for (const [a, b] of [[[0, 0], [12, 0]], [[0, 0], [0, 15]]]) kit.rod(chartPoint(...a), chartPoint(...b), .7 * MM, 'ink', chart);
  chartText(chart, chartPoint, {title: 'Does this clock keep time?', size: 13 * MM, x: {min: 0, max: 12, title: 'Actual elapsed hours', ticks: [[0, '0'], [6, '6'], [12, '12']]}, y: {min: 0, max: 15, title: 'Indicated elapsed hours', ticks: [[0, '0'], [6, '6'], [12, '12'], [15, '15']]}, legend: [['This clock', BLUE], ['Correct time', 0x85917d]]});
  const trace = lineObject(483, BLUE, chart), correct = lineObject(2, 0x85917d, chart);
  correct.geometry.attributes.position.array.set([...chartPoint(0, 0), ...chartPoint(12, 12)]); correct.geometry.attributes.position.needsUpdate = true; correct.geometry.computeBoundingSphere();
  const cursor = kit.sphere(3 * MM, [0, 0, 0], 'red', chart), chartTextNow = label(chart, '', [0, -150, 2], 12, 340);

  const specs = {
    design: ['Clock design', '', DESIGNS, 'Choose an inflow mechanism or one of two draining vessels. Each changed setting starts a fresh trial.'],
    rate: ['Inflow rate', '%', null, '100% is the fixed calibration: 94.7482 mL/h. The external inlet is an ideal regulated source; this control specifies flow, not a valve opening law.'],
    bore: ['Outflow opening diameter', 'mm', null, 'The fixed hour marks assume 1.0 mm. Changing the opening changes the timing, not the marks.'],
  };
  for (const [key, [min, max, step]] of Object.entries(WATER_DOMAINS)) {const [title, unit, options, help] = specs[key]; control(key, title, min, max, step, D[key], unit, help, options, {primary: key === 'design', ...(key === 'rate' ? {visibleWhen: v => v.design === 2} : key === 'bore' ? {visibleWhen: v => v.design !== 2} : {})});}
  let hours = 0, initialTime = null, preparedSettings = null, key = '', lastClock = 0, plan, plotTimes = [], disposed = false;
  const result = kit.finish(values => {
    const nextKey = JSON.stringify(values), isInflow = values.design === 2;
    if (key !== nextKey) {
      key = nextKey; plan = waterClockPlan(values); hours = initialTime ?? 0; lastClock = 0;
      if (!isInflow) {potWall.geometry.dispose(); potWall.geometry = lathe(potProfile(values.design, 400, values.bore)); orifice.geometry.dispose(); orifice.geometry = lathe(orificeProfile(values.bore), 0, TAU);}
      let previousLabel = -Infinity;
      [...potTicks.entries()].reverse().forEach(([i, {tick, text, leader}]) => {const h = !isInflow ? plan.marks[i] : undefined; tick.visible = text.visible = leader.visible = h !== undefined; if (h !== undefined) {const x = potRadius(values.design, h) * 1000, y = Math.max(h * 1000, previousLabel + 14); previousLabel = y; tick.position.set(...point([x + 10, h * 1000, 0])); text.position.set(...point([x + 38, y, 0])); setRod(leader, [x + 15, h * 1000, 0], [x + 27, y, 0]);}});
      emptyText.userData.setText(isInflow ? '' : `Empty mark: ${fixed(plan.referenceEmpty, 2)} h`);
      const stop = isInflow ? plan.full : plan.empties;
      plotTimes = [...new Set([...Array.from({length: 481}, (_, i) => i / 40), ...(stop > 0 && stop < 12 ? [stop] : [])])].sort((a, b) => a - b);
      plotTimes.forEach((t, i) => trace.geometry.attributes.position.array.set(chartPoint(t, sampleWaterPlan(plan, t).shows), i * 3)); trace.geometry.setDrawRange(0, plotTimes.length); trace.geometry.attributes.position.needsUpdate = true; trace.geometry.computeBoundingSphere();
    }
    const s = sampleWaterPlan(plan, hours);
    inflow.visible = isInflow; outflow.visible = !isInflow;
    if (isInflow) {
      const h = s.level * 1000, top = G.floor + s.floatTop * 1000;
      jarWater.scale.y = h; float.position.y = (G.floor + (s.floatBottom + W.floatHeight / 2) * 1000) * MM;
      attachment.position.y = (top + 1.5) * MM;
      const firstToothY = top + 3 + (G.rackTeeth - .5) * Math.PI * 2;
      rack.position.y = firstToothY * MM;
      pinion.rotation.z = -Math.PI / 2 + pinionOnRack(36, 2, G.gearY - firstToothY);
      hand.rotation.z = s.handAngle;
      dialText.userData.setText(`${fixed(s.shows, 2)} h total`);
      valveHandle.rotation.z = -Math.PI / 2 + values.rate / 200 * Math.PI / 2;
      feedText.userData.setText(`Regulated inlet: ${fixed(s.flow * 3.6e9, 1)} mL/h`);
      setRod(feedStream, [-28, 390, -20], [-28, G.floor + h, -20]); feedStream.visible = s.flow > 0;
      droplets.forEach((m, i) => {m.visible = s.flow > 0; m.position.set(...point([-28, 390 - ((hours * 3 + i / 3) % 1) * (390 - G.floor - h), -20]));});
      const bowlLevel = s.overflow * 1e9 / (Math.PI * 70 ** 2); bowlWater.scale.y = Math.max(.0001, bowlLevel); bowlWater.visible = bowlLevel > 0;
      overflowStream.visible = overflowDrop.visible = s.outflow > 0;
      setRod(overflowDrop, [143, 350, 0], [143, 3 + Math.max(.01, bowlLevel), 0]);
    } else {
      const level = s.level * 1000, positions = potWater.geometry.attributes.position;
      // Reuse the water mesh. Its radial envelope follows the cone at the
      // current height, with caps scaled separately from the vertical wall.
      for (let i = 0; i < positions.count; i++) {const oldY = waterBase[i * 3 + 1] > 0 ? 1 : 0, y = oldY * level, radius = potRadius(values.design, y / 1000) * 1000; positions.setXYZ(i, waterBase[i * 3] * radius, y * MM, waterBase[i * 3 + 2] * radius);}
      positions.needsUpdate = true; potWater.geometry.computeVertexNormals(); potWater.geometry.computeBoundingSphere(); potWater.visible = level > 0;
      const basinLevel = s.collected * 1e9 / (Math.PI * 220 ** 2); catchWater.scale.y = Math.max(.0001, basinLevel); catchWater.visible = basinLevel > 0;
      setRod(potStream, [0, G.potFloor - 4, 0], [0, 3 + basinLevel, 0]); potStream.visible = s.flow > 0;
      potDrops.forEach((m, i) => {m.visible = s.flow > 0; m.position.set(...point([0, G.potFloor - 4 - ((hours * 3 + i / 3) % 1) * (G.potFloor - 7 - basinLevel), 0]));});
    }
    cursor.position.set(...chartPoint(s.clock, s.shows)); chartTextNow.userData.setText(`Actual ${fixed(s.clock, 2)} h · clock ${fixed(s.shows, 2)} h · error ${s.error > 0 ? '+' : ''}${fixed(s.error, 2)} h`);
    return {state: s, readings: [
      r('Your result', s.phase, `${fixed(s.clock, 2)} actual hours elapsed${s.complete ? '; trial complete' : ''}.`),
      r('Clock indication', `${fixed(s.shows, 3)} h`, 'Total indicated elapsed hours, including complete dial turns. Calibration stays fixed.'),
      r('Timing error', `${s.error > 0 ? '+' : ''}${fixed(s.error, 3)} h`, 'Positive is fast; negative is slow. An empty pot or overflowing receiver cannot continue measuring elapsed time.'),
      r('Water depth', `${fixed(s.level * 1000, 2)} mm`, isInflow ? 'Measured from the receiver floor. Initial depth is 30 mm; overflow begins at 270 mm.' : 'Measured above the opening. Decreasing head reduces outflow.'),
      r(isInflow ? 'Regulated inflow' : 'Current outflow', `${fixed(s.flow * 3.6e9, 2)} mL/h`, isInflow ? `${values.rate}% of fixed nominal ${fixed(referenceFlow * 3.6e9, 4)} mL/h.` : 'Calculated with a constant illustrative discharge coefficient of 0.62.'),
      ...(isInflow ? [r('Float and rack rise', `${fixed(s.travel * 1000, 2)} mm`, `Clockwise hand rotation ${fixed(-s.handAngle * 180 / Math.PI, 2)}°. One full turn needs ${fixed(TAU * W.pitchRadius * 1000, 2)} mm of rise.`), r('Buoyancy', `${fixed(s.buoyancy, 4)} N`, `${fixed(s.floatDraft * 1000, 2)} mm submerged. Float and rack together displace 40.00 mL and weigh 40 g.`), r('Receiver overflow begins', Number.isFinite(s.full) ? `${fixed(s.full, 3)} h` : 'Never with inlet closed', 'The ideal overflow holds a fixed level. More water then reaches the collection bowl while the hand stops.')] : [r('Level falling now', `${fixed(s.fallRate * 1000, 2)} mm/h`, values.design === 1 ? 'Straight sloping sides do not exactly cancel the changing outflow speed.' : 'Equal elapsed hours occupy less height near the bottom.'), r('Pot empties after', `${fixed(s.empties, 3)} h`, `The unchanged empty mark reads ${fixed(s.referenceEmpty, 3)} h.`)]),
      r('Water accounting', `${fixed(s.volume * 1000, 4)} L in clock + ${fixed(s.collected * 1000, 4)} L collected`, isInflow ? `Initial ${fixed(s.initialVolume * 1000, 4)} L + supplied ${fixed(s.incoming * 1000, 4)} L. Receiver water excludes the float's displaced volume.` : `Initial ${fixed(s.initialVolume * 1000, 4)} L. No water is discarded from the calculation.`),
    ]};
  });
  const render = result.update;
  result.update = values => {const readings = render(values); if (preparedSettings && Object.entries(preparedSettings).every(([k, v]) => result.getState().values[k] === v)) {initialTime = null; preparedSettings = null;} return readings;};
  result.advance = dt => {if (Number.isFinite(dt) && dt > 0) {initialTime = null; preparedSettings = null; hours = Math.min(W.duration, hours + dt);} return render();};
  result.animate = t => {const dt = Number.isFinite(t) ? Math.max(0, t - lastClock) : 0; if (Number.isFinite(t)) lastClock = t; return result.advance(dt);};
  result.reset = ({time = 0, settings} = {}) => {if (!Number.isFinite(time) || time < 0 || time > W.duration) throw new RangeError('Invalid water clock checkpoint'); preparedSettings = {...(settings ?? result.defaults)}; waterClockPlan(preparedSettings); initialTime = time; key = ''; hours = lastClock = 0; return render(preparedSettings);};
  result.replayState = () => ({time: 0, settings: result.getState().values});
  const inspect = (title, id, isolate = false, view = 'front') => ({label: title, part: id, isolate, view, replay: false, run: () => {const target = ['float', 'drive', 'display', 'feed', 'drain'].includes(id) ? 2 : ['pot', 'outlet'].includes(id) ? 0 : null; return render(target !== null && (target === 2 ? result.getState().values.design !== 2 : result.getState().values.design === 2) ? {design: target} : {});}});
  result.actions = [inspect('Inspect: complete clock', 'system'), inspect('Inflow: inspect the float', 'float'), inspect('Inflow: inspect meshing teeth', 'drive'), inspect('Inflow: inspect hand and dial', 'display'), inspect('Inflow: inspect regulated inlet', 'feed'), inspect('Inflow: inspect overflow collection', 'drain'), inspect('Outflow: inspect hour marks', 'pot'), inspect('Outflow: inspect the drain', 'outlet', true, 'bottom'), inspect('Compare actual and indicated time', 'chart', true)];
  result.playback = {label: 'Run the water clock', description: 'Twelve hours at one hour per second. Each setting change starts a fresh trial with the original calibration.', stepLabel: 'Advance one hour', advance: result.advance, step: () => result.advance(1), complete: () => hours >= W.duration, blocked: () => false};
  result.followParts = ['float', 'rack']; result.autoFramePart = 'system'; result.initialPart = 'system'; result.initialView = 'iso'; result.frameVisibleOnly = true; result.framePadding = .65; result.selectionOutline = false; result.transparentBackground = true; result.thumbnailOmit = [chart];
  for (const p of result.parts) {p.maxZoom = 300; p.framePadding = p.id === 'chart' ? .57 : .65;}
  const draftMM = W.movingMass / (W.density * Math.PI * W.floatRadius ** 2) * 1000;
  const floatLow = G.floor + W.initialLevel * 1000 - draftMM, floatHigh = G.floor + W.overflowLevel * 1000 - draftMM + 40;
  const rackHigh = floatHigh + 3 + G.rackTeeth * Math.PI * G.rackModule;
  const motionBounds = (lo, hi) => new THREE.Box3(new THREE.Vector3(...point(lo)), new THREE.Vector3(...point(hi))).applyMatrix4(root.matrixWorld);
  result.frameBoundsForPart = id => {
    root.updateMatrixWorld(true);
    const isInflow = result.getState().values.design === 2, active = isInflow ? inflow : outflow, object = id === 'system' ? active : result.parts.find(p => p.id === id)?.object;
    if (!object) return null;
    const bounds = new THREE.Box3().setFromObject(object);
    if ((id === 'system' && isInflow) || id === 'inflow') bounds.union(motionBounds([-24, floatLow, -24], [24, rackHigh, 24]));
    if (id === 'drive') bounds.expandByScalar(12 * MM);
    if (id === 'outlet') bounds.union(motionBounds([-9, G.potFloor - 2, -9], [9, G.potFloor + 2, 9]));
    return bounds;
  };
  result.topology = {system, inflow, outflow, frame, bearings, guideBlocks, feed, feedValve, feedStream, feedTubes, feedPath, droplets, receiver, jarWall, jarWater, rim, levelMarks, floatPart, float, rackPart, rack, attachment, drive, pinion, shaft, display, dial, hand, drain, overflowStream, overflowDrop, bowl, bowlWater, pot, potWall, potWater, potTicks, outlet, orifice, potStream, potDrops, potSupport, catchPart, catchWall, catchWater, chart, trace, cursor, plotTimes: () => plotTimes, MM, G, CUT};
  const dispose = result.dispose; result.dispose = () => {if (disposed) return; disposed = true; dispose();};
  return result;
}

import * as THREE from 'three';
import {houseModel, reading} from './house-model-kit.js';
import {solidArrow, textLabel} from './scene-kit.js';
import {FIRE_DEFAULTS, FIRE_DOMAINS, FIRE_OPTIONS, FIRE_SHAPE as S, FIRE_PHYSICS as P,
  FIRE_VOLUME_SCALE, createCartridgeExtinguisherController} from './cartridge-extinguisher-physics.js';

const BLUE = 0x3d97bd, GAS = 0x9a78bc, DARK = 0x374736, RED = 0xb95242;
const own = mesh => {mesh.material = mesh.material.clone();return mesh;};
const label = (parent, text, position, width, height = .15, color = '#394233') => textLabel(parent, text, {position, width, height, color});
const lit = (color, opacity = 1) => new THREE.MeshStandardMaterial({color, roughness: .62, metalness: .08,
  side: THREE.DoubleSide, transparent: opacity < 1, opacity, depthWrite: opacity === 1});
function mesh(parent, geometry, material, position = [0, 0, 0]) {
  const object = new THREE.Mesh(geometry, material);object.position.set(...position);parent.add(object);return object;
}
function shell(parent, outer, inner, height, bottom, color, front) {
  const start = front ? 0 : Math.PI, end = start + Math.PI;
  const shape = new THREE.Shape();shape.absarc(0, 0, outer, start, end, false);
  shape.absarc(0, 0, inner, end, start, true);shape.closePath();
  const geometry = new THREE.ExtrudeGeometry(shape, {depth: height, bevelEnabled: false, curveSegments: 32});
  geometry.rotateX(Math.PI / 2);return mesh(parent, geometry, lit(color), [0, bottom + height, 0]);
}
function reverseFace(geometry) {
  for (let k = 0; k < geometry.index.count; k += 3) {
    const first = geometry.index.getX(k);geometry.index.setX(k, geometry.index.getX(k + 1));geometry.index.setX(k + 1, first);
  }
  geometry.computeVertexNormals();return geometry;
}
function fluidLayers(parent, color, opacity) {
  return S.pickup.map((pickup, index) => {
    const group = new THREE.Group();parent.add(group);
    const cuts = [...new Set([0, pickup, S.cartridge.bottom, S.cartridge.shoulder, S.cartridge.top, S.height])].sort((a, b) => a - b);
    const material = lit(color, opacity), layers = [];
    // Fluid boundary faces meet solid walls exactly. Offset their depth only
    // while drawing so those shared planes do not flicker.
    const contactMaterial = material.clone();
    contactMaterial.polygonOffset = true;contactMaterial.polygonOffsetFactor = -1;contactMaterial.polygonOffsetUnits = -1;
    for (let i = 1; i < cuts.length; i++) {
      const low = cuts[i - 1], high = cuts[i], y = (low + high) / 2;
      const shape = new THREE.Shape();shape.absarc(0, 0, S.radius, 0, 2 * Math.PI, false);
      for (const [x, z, radius] of [
        ...(y > S.cartridge.bottom && y < S.cartridge.top ? [[S.cartridge.x, S.cartridge.z, y < S.cartridge.shoulder ? S.cartridge.radius : S.cartridge.neck]] : []),
        ...(y > pickup ? [[S.tube.x, S.tube.z, S.tube.radius]] : []),
      ]) {const hole = new THREE.Path();hole.absarc(x, -z, radius, 0, 2 * Math.PI, true);shape.holes.push(hole);}
      const extrusion = new THREE.ExtrudeGeometry(shape, {depth: 1, bevelEnabled: false, curveSegments: 32});extrusion.rotateX(-Math.PI / 2);
      const sides = new THREE.BufferGeometry(), sideGroup = extrusion.groups.find(group => group.materialIndex === 1);
      for (const [name, attribute] of Object.entries(extrusion.attributes)) {
        const values = attribute.array.slice(sideGroup.start * attribute.itemSize, (sideGroup.start + sideGroup.count) * attribute.itemSize);
        sides.setAttribute(name, new THREE.BufferAttribute(values, attribute.itemSize));
      }
      extrusion.dispose();
      const object = mesh(group, sides, material);object.userData.interval = [low, high];
      const face = new THREE.ShapeGeometry(shape, 32);face.rotateX(-Math.PI / 2);
      const surface = mesh(group, face, material), floorSurface = mesh(group, reverseFace(face.clone()), low === 0 ? contactMaterial : material);
      layers.push({object, surface, floorSurface, low, high});
    }
    // Only actual changes in the solid envelope need internal horizontal
    // faces. Full section caps would draw false water surfaces at each join.
    const C = S.cartridge, boundaries = [
      [C.bottom, C.x, C.radius, 0, false], [C.shoulder, C.x, C.radius, C.neck, true],
      [C.top, C.x, C.neck, 0, true], [pickup, S.tube.x, S.tube.radius, 0, false],
    ].map(([y, x, radius, hole, downward]) => {
      const shape = new THREE.Shape();shape.absarc(0, 0, radius, 0, 2 * Math.PI, false);
      if (hole) {const path = new THREE.Path();path.absarc(0, 0, hole, 0, 2 * Math.PI, true);shape.holes.push(path);}
      const geometry = new THREE.ShapeGeometry(shape, 32);geometry.rotateX(-Math.PI / 2);
      if (downward) reverseFace(geometry);
      return {object: mesh(group, geometry, contactMaterial, [x, y, 0]), y};
    });
    return {group, layers, boundaries, material, contactMaterial, index};
  });
}
function showFluid(layers, selected, low, high) {
  for (const variant of layers) {
    variant.group.visible = variant.index === selected;
    for (const {object, surface, floorSurface, low: floor, high: ceiling} of variant.layers) {
      const from = Math.max(low, floor), to = Math.min(high, ceiling);
      object.visible = to > from + 1e-8;object.position.y = from;object.scale.y = Math.max(1e-8, to - from);
      surface.visible = object.visible && Math.abs(to - high) < 1e-8;surface.position.y = to;
      floorSurface.visible = object.visible && Math.abs(from - low) < 1e-8;floorSurface.position.y = from;
    }
    for (const {object, y} of variant.boundaries) object.visible = y > low + 1e-8 && y < high - 1e-8;
  }
}
function arrow(kit, parent, color, position, direction, thickness = .014) {
  const object = solidArrow(kit, color, parent, thickness);object.position.set(...position);
  object.userData.setDirection(new THREE.Vector3(...direction));return object;
}
function rodHeight(object, bottom, top) {
  object.position.y = (bottom + top) / 2;object.scale.y = Math.max(1e-8, top - bottom);object.visible = top > bottom + 1e-8;
}
export function extinguisherLeverAngle(top) {
  let lo = -.6, hi = .3;
  for (let i = 0; i < 52; i++) {
    const angle = (lo + hi) / 2, underside = 3.90 + (-.25 - .50) * Math.tan(angle) - .045 / Math.cos(angle);
    if (underside > top) lo = angle;else hi = angle;
  }
  return (lo + hi) / 2;
}

function buildExtinguisher(kit) {
  const system = kit.part('system', 'Extinguisher and collection vessel', 'One connected cartridge-operated water path. The collection vessel measures the water delivered by this idealized mechanism; it is not part of a real extinguisher.');
  const extinguisher = kit.part('extinguisher', 'Complete extinguisher', 'A gas cartridge supplies pressure. Water leaves through the submerged pickup, head passage, hose and nozzle. Look inside to follow the same connected assembly.', [-1.4, 0, 0], system);
  const body = kit.part('body', 'Pressure vessel', 'The closed shell holds water and a gas space. Its front half is removed by Look inside. A sealed head supports the cartridge and the separate water passage.', [0, 0, 0], extinguisher);
  const rearShell = shell(body, S.radius + S.wall, S.radius, S.height, 0, RED, false);
  const front = new THREE.Group();body.add(front);kit.covers.push(front);
  const frontShell = shell(front, S.radius + S.wall, S.radius, S.height, 0, RED, true);
  const bottom = kit.cylinder(S.radius + .06, .11, [0, -.055, 0], 'ink', body);
  const shoulderBack = shell(body, S.radius + S.wall, .48, .085, S.height, RED, false);
  const shoulderFront = shell(front, S.radius + S.wall, .48, .085, S.height, RED, true);
  const neck = kit.cylinder(.48, .08, [0, 3.245, 0], 'metal', body);kit.covers.push(neck);
  label(front, 'WATER', [0, 2.22, S.radius + .057], 1.15, .25, '#fff5df');
  label(front, 'GAS CARTRIDGE', [0, 1.91, S.radius + .057], 1.15, .11, '#fff5df');

  const release = kit.part('release', 'Handle and gas release', 'The pivoted handle depresses a spring-loaded plunger. Its point opens the cartridge seal; gas can then reach the headspace through side ports. The illustrated actuation is prescribed, with no force calculation.', [0, 0, 0], extinguisher);
  const housing = kit.box([1.04, .28, .14], [0, 3.42, -.21], 'metal', release);
  const frontHousing = kit.box([1.04, .28, .28], [0, 3.42, 0], 'metal', release);kit.covers.push(frontHousing);
  const fixedHandle = new THREE.Group();release.add(fixedHandle);
  for (const sign of [-1, 1]) {
    kit.box([1.72, .10, .08], [-.27, 3.56, sign * .17], 'ink', fixedHandle);
    kit.box([.12, .34, .08], [.50, 3.73, sign * .17], 'metal', fixedHandle);
  }
  kit.box([.10, .10, .42], [-1.08, 3.56, 0], 'ink', fixedHandle);
  const pivot = kit.disk(.073, .36, [.50, 3.90, 0], 'gold', release);
  const lever = new THREE.Group();lever.position.set(.50, 3.90, 0);release.add(lever);
  const handle = kit.box([1.65, .09, .26], [-.72, 0, 0], 'red', lever);
  const plunger = kit.part('plunger', 'Piercing plunger and return spring', 'The pointed shaft travels through a guide. Its collar compresses the spring as the lever moves down. The seal remains opened after it is pierced.', [0, 0, 0], release);
  const moving = new THREE.Group();plunger.add(moving);
  const shaft = kit.cylinder(.021, .67, [-.25, 3.675, 0], 'gold', moving);
  const cone = mesh(moving, new THREE.ConeGeometry(.033, .09, 24), lit(0xe3b45e), [-.25, 3.295, 0]);cone.rotation.z = Math.PI;
  const collar = kit.cylinder(.079, .055, [-.25, 3.66, 0], 'metal', moving);
  const guide = shell(plunger, .09, .035, .095, 3.31, 0xb4c5b0, false);guide.position.x = -.25;
  const guideFront = shell(plunger, .09, .035, .095, 3.31, 0xb4c5b0, true);guideFront.position.x = -.25;kit.covers.push(guideFront);
  const spring = kit.spring([-.25, 3.31, 0], .062, .3225, 6, plunger, .009);
  // Scaling this prescribed helix makes its compression visible. It is not a
  // spring-stress or constant-wire-diameter calculation.
  spring.geometry.translate(.25, -3.31, 0);spring.position.set(-.25, 3.31, 0);

  const cartridge = kit.part('cartridge', 'Gas cartridge and seal', 'The cartridge keeps its charge separate until the plunger opens the seal. Purple dots symbolize available propellant; they do not depict liquid fraction, molecular density or cartridge pressure.', [0, 0, 0], release);
  const cartShell = new THREE.Group();cartShell.position.x = S.cartridge.x;cartridge.add(cartShell);
  const cartBack = shell(cartShell, S.cartridge.radius, S.cartridge.radius - S.cartridge.wall, S.cartridge.shoulder - S.cartridge.bottom, S.cartridge.bottom, 0xc3cabb, false);
  const cartFront = shell(cartShell, S.cartridge.radius, S.cartridge.radius - S.cartridge.wall, S.cartridge.shoulder - S.cartridge.bottom, S.cartridge.bottom, 0xc3cabb, true);kit.covers.push(cartFront);
  const cartBase = kit.cylinder(S.cartridge.radius, S.cartridge.base, [0, S.cartridge.bottom + S.cartridge.base / 2, 0], 'metal', cartShell);
  const cartShoulder = shell(cartShell, S.cartridge.radius, S.cartridge.bore, S.cartridge.shoulderDepth, S.cartridge.shoulder - S.cartridge.shoulderDepth, 0xb4c5b0, false);
  const cartShoulderFront = shell(cartShell, S.cartridge.radius, S.cartridge.bore, S.cartridge.shoulderDepth, S.cartridge.shoulder - S.cartridge.shoulderDepth, 0xb4c5b0, true);kit.covers.push(cartShoulderFront);
  const cartNeckBack = shell(cartShell, S.cartridge.neck, S.cartridge.bore, S.cartridge.top - S.cartridge.shoulder, S.cartridge.shoulder, 0xe3b45e, false);
  const cartNeckFront = shell(cartShell, S.cartridge.neck, S.cartridge.bore, S.cartridge.top - S.cartridge.shoulder, S.cartridge.shoulder, 0xe3b45e, true);kit.covers.push(cartNeckFront);
  const seal = kit.cylinder(.074, .012, [-.25, 3.10, 0], 'gold', cartridge);
  const piercedSeal = mesh(cartridge, new THREE.RingGeometry(.027, .074, 32), lit(0xe3b45e), [-.25, 3.10, 0]);piercedSeal.rotation.x = -Math.PI / 2;
  const ports = [-1, 1].map(sign => kit.rod([-.25 + sign * .065, 3.13, 0], [-.25 + sign * .22, 3.13, 0], .030, 'ink', release));
  const chargeDots = Array.from({length: 20}, (_, i) => kit.sphere(.025, [-.25 + (i % 2 ? .068 : -.068), 1.30 + Math.floor(i / 2) * .148, .048], GAS, cartridge));
  const gasRoutes = [-1, 1].map(sign => arrow(kit, release, GAS, [-.25 + sign * .07, 3.15, .045], [sign, -.3, 0], .010));

  const waterPart = kit.part('water', 'Water in the vessel', 'Blue shows the water volume around the cartridge and pickup tube. As water is delivered, its surface falls and the gas space grows. Fluid colors are teaching overlays.', [0, 0, 0], extinguisher);
  const water = fluidLayers(waterPart, BLUE, .42);
  const headspace = kit.part('headspace', 'Gas above the water', 'Expanded propellant raises the pressure above the water. Pressure acts in every direction. The purple arrows show relative gauge pressure; the gas itself is not purple.', [0, 0, 0], extinguisher);
  const gas = fluidLayers(headspace, GAS, .06);
  const gasLabel = label(headspace, '0.00 bar gauge', [0, 3.38, .88], 1.5, .20);
  gasLabel.userData.inspectionOnly = 'headspace';gasLabel.userData.explosionExcluded = true;
  const pressureArrows = [
    ...[-.54, .54].map(x => arrow(kit, headspace, GAS, [x, 0, .19], [0, -1, 0])),
    ...[-1, 1].map(sign => arrow(kit, headspace, GAS, [sign * .22, 3.02, .40], [sign, 0, 0])),
  ];

  const pickup = kit.part('pickup', 'Dip tube and intake', 'The tube collects whichever fluid surrounds its lower opening. A submerged opening admits water; an opening in the gas space bypasses the water. Shortening it leaves more water below the opening.', [0, 0, 0], extinguisher);
  const pickupVariants = S.pickup.map((height, index) => {
    const group = new THREE.Group();group.position.x = S.tube.x;pickup.add(group);
    const back = shell(group, S.tube.radius, S.tube.bore, 3.42 - height, height, 0xd6b370, false);
    const front = shell(group, S.tube.radius, S.tube.bore, 3.42 - height, height, 0xd6b370, true);kit.covers.push(front);
    const fluid = own(kit.cylinder(S.tube.bore * .92, 1, [0, 0, 0], BLUE, group));fluid.material.transparent = true;fluid.material.opacity = .58;fluid.material.depthWrite = false;
    const mouth = kit.ring(S.tube.radius - .008, .009, [0, height, 0], 'gold', group);mouth.rotation.x = Math.PI / 2;
    return {group, back, front, fluid, mouth, height, index};
  });

  const hose = kit.part('hose', 'Head passage and hose', 'A continuous route joins the dip tube to the nozzle. Look inside removes the opaque hose wall so its fluid and blue route markers remain visible. Line fill, line volume and friction are omitted.', [0, 0, 0], extinguisher);
  const hosePoints = [[.35, 3.42, 0], [.36, 3.61, 0], [.65, 3.69, 0], [1.50, 3.73, 0], [2.55, 3.73, 0], [3.12, 3.61, 0], [3.25, 3.32, 0]];
  const hoseCurve = new THREE.CatmullRomCurve3(hosePoints.map(point => new THREE.Vector3(...point)));
  const hoseCover = mesh(hose, new THREE.TubeGeometry(hoseCurve, 96, .10, 16, false), lit(0x37413b));kit.covers.push(hoseCover);
  const hoseFluid = mesh(hose, new THREE.TubeGeometry(hoseCurve, 96, S.tube.bore, 12, false), lit(BLUE, .63));
  const ribs = Array.from({length: 10}, (_, i) => {
    const u = i / 9, center = hoseCurve.getPointAt(u), tangent = hoseCurve.getTangentAt(u);
    const object = kit.ring(.081, .012, center.toArray(), 'ink', hose);object.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), tangent);return object;
  });
  const nozzle = kit.part('nozzle', 'Narrow outlet', 'The outlet converts available pressure head into water speed. Its model flow uses the shown bore area. Water exits into atmospheric pressure; the stream markers are slowed for visibility.', [3.25, 0, 0], hose);
  const nozzleBack = shell(nozzle, .085, S.nozzleBore, .32, S.nozzleHeight, 0x37413b, false);
  const nozzleFront = shell(nozzle, .085, S.nozzleBore, .32, S.nozzleHeight, 0x37413b, true);kit.covers.push(nozzleFront);
  const nozzleFluid = mesh(nozzle, new THREE.CylinderGeometry(S.nozzleBore * .92, S.nozzleBore * .92, .32, 16), lit(BLUE, .65), [0, 3.16, 0]);
  const waterDots = [
    ...Array.from({length: 10}, () => kit.sphere(.023, [0, 0, 0], BLUE, pickup)),
    ...Array.from({length: 12}, () => kit.sphere(.023, [0, 0, 0], BLUE, hose)),
  ];
  const directionArrows = [arrow(kit, pickup, BLUE, [S.tube.x, 0, .12], [0, 1, 0], .009), arrow(kit, hose, BLUE, [1.4, 3.73, .13], [1, 0, 0], .013)];

  const collection = kit.part('collection', 'Collected water', 'This added collection vessel makes the result visible. Its blue volume equals water lost from the extinguisher in the zero-line-volume approximation. The observation freezes at pickup exposure or pressure balance.', [1.85, 0, 0], system);
  const C = S.collector, tray = kit.box([C.width + .12, .11, C.depth + .12], [0, 0, 0], 'metal', collection);
  const walls = [
    ...[-1, 1].map(sign => kit.box([.055, C.height, C.depth], [sign * (C.width / 2 + .0275), C.bottom + C.height / 2, 0], 'metal', collection)),
    ...[-1, 1].map(sign => kit.box([C.width, C.height, .055], [0, C.bottom + C.height / 2, sign * (C.depth / 2 + .0275)], 'metal', collection)),
  ].map(object => {own(object);object.material.transparent = true;object.material.opacity = .18;object.material.depthWrite = false;return object;});
  const collected = mesh(collection, new THREE.BoxGeometry(C.width, 1, C.depth), lit(BLUE, .67));
  const nameplate = kit.box([1.62, .57, .04], [-.15, .37, C.depth / 2 + .071], 'cream', collection);
  label(collection, 'COLLECTED WATER', [-.15, .53, C.depth / 2 + .095], 1.52, .14);
  const collectedLabel = label(collection, '0.00 L', [-.15, .27, C.depth / 2 + .095], 1.46, .27);
  const tickMarks = [3, 6, 9].map(liters => {
    const y = C.bottom + liters / 1000 / (C.width * C.depth * FIRE_VOLUME_SCALE);
    const tick = kit.box([.12, .014, .014], [C.width / 2 - .12, y, C.depth / 2 + .055], 'ink', collection);
    label(collection, `${liters} L`, [C.width / 2 - .33, y, C.depth / 2 + .069], .27, .10);return tick;
  });
  const stream = new THREE.Group();collection.add(stream);
  const jet = mesh(stream, new THREE.CylinderGeometry(S.nozzleBore, S.nozzleBore, 1, 16), lit(BLUE, .58));
  const drops = Array.from({length: 12}, () => kit.sphere(.029, [0, 0, 0], BLUE, stream));
  const splash = kit.ring(.14, .014, [0, C.bottom, 0], BLUE, stream);splash.rotation.x = Math.PI / 2;
  return {system, extinguisher, body, front, frontShell, rearShell, bottom, shoulderBack, shoulderFront, neck,
    release, housing, frontHousing, fixedHandle, pivot, lever, handle, plunger, moving, shaft, cone, collar, guide, guideFront, spring,
    cartridge, cartShell, cartBack, cartFront, cartBase, cartShoulder, cartShoulderFront, cartNeckBack, cartNeckFront, seal, piercedSeal, ports, chargeDots, gasRoutes,
    waterPart, water, headspace, gas, gasLabel, pressureArrows, pickup, pickupVariants, hose, hosePoints, hoseCurve, hoseCover, hoseFluid, ribs,
    nozzle, nozzleBack, nozzleFront, nozzleFluid, waterDots, directionArrows, collection, tray, walls, collected, nameplate, collectedLabel, tickMarks, stream, jet, drops, splash};
}

function drawExtinguisher(g, state) {
  const {now, values} = state, shift = -.20 * now.handle, cartridgeGas = now.released && values.charge > 0;
  g.moving.position.y = shift;g.lever.rotation.z = extinguisherLeverAngle(4.01 + shift);
  g.spring.scale.y = (.3225 + shift) / .3225;
  g.seal.visible = !now.released;g.piercedSeal.visible = now.released;
  g.chargeDots.forEach((dot, i) => {dot.visible = !now.released && i < Math.round(20 * values.charge);});
  g.gasRoutes.forEach(object => object.userData.setLength(cartridgeGas ? .23 : 0));
  showFluid(g.water, values.pickup, 0, now.level);showFluid(g.gas, values.pickup, now.level, S.height);
  g.gas.forEach(variant => {variant.material.opacity = variant.contactMaterial.opacity = .045 + .08 * Math.max(0, now.gauge) / 600000;});
  g.gasLabel.userData.setText(`${Math.max(0, now.gauge / 100000).toFixed(2)} bar gauge`);
  const pressureLength = cartridgeGas ? .08 + .32 * Math.min(1, Math.max(0, now.gauge) / 600000) : 0;
  g.pressureArrows.forEach((object, i) => {
    if (i < 2) object.position.y = now.level + pressureLength + .065;
    object.userData.setLength(i < 2 ? pressureLength : pressureLength * .74);
  });
  const bypass = now.released && ['dry-pickup', 'pickup-exposed'].includes(now.phase), filledLine = now.released && values.charge > 0 && !bypass;
  for (const variant of g.pickupVariants) {
    variant.group.visible = variant.index === values.pickup;
    rodHeight(variant.fluid, variant.height, filledLine || bypass ? 3.42 : Math.max(variant.height, now.level));
    variant.fluid.material.color.set(bypass ? GAS : BLUE);
  }
  const lineColor = bypass ? GAS : filledLine ? BLUE : 0xc8d2c4;
  g.hoseFluid.material.color.set(lineColor);g.nozzleFluid.material.color.set(lineColor);
  const flow = now.flow > 0, phase = now.delivered / .00055;
  const height = S.pickup[values.pickup], tubeLength = 3.42 - height, hoseLength = g.hoseCurve.getLength();
  g.waterDots.forEach((dot, i) => {
    dot.visible = flow;
    if (i < 10) dot.position.set(S.tube.x, height + ((phase + i / 10) % 1) * tubeLength, .026);
    else {
      const length = ((phase + (i - 10) / 12) % 1) * (hoseLength + .32);
      if (length < hoseLength) dot.position.copy(g.hoseCurve.getPointAt(length / hoseLength)).add(new THREE.Vector3(0, 0, .026));
      else dot.position.set(3.25, 3.32 - (length - hoseLength), .012);
    }
  });
  g.directionArrows[0].position.y = height + Math.min(.25, (3.42 - height) / 4);
  g.directionArrows.forEach(object => object.userData.setLength(flow ? .30 : 0));
  const C = S.collector, collectedHeight = now.delivered / (C.width * C.depth * FIRE_VOLUME_SCALE);
  rodHeight(g.collected, C.bottom, C.bottom + collectedHeight);
  g.collectedLabel.userData.setText(`${(now.delivered * 1000).toFixed(2)} L`);
  const surface = C.bottom + collectedHeight;
  rodHeight(g.jet, surface, S.nozzleHeight);g.jet.visible = flow;
  g.drops.forEach((dot, i) => {
    dot.visible = flow;const fraction = (phase + i / g.drops.length) % 1;
    dot.position.set(0, S.nozzleHeight - fraction * (S.nozzleHeight - surface), 0);
  });
  g.splash.position.y = surface + .009;g.splash.visible = flow;
}

function resultText(state) {
  const {now, values} = state, amount = `${(now.delivered * 1000).toFixed(2)} L`, left = `${(now.water * 1000).toFixed(2)} L`;
  if (now.phase === 'ready') return `Ready: ${values.water} L of water. Play to press the handle and follow the flow.`;
  if (now.phase === 'squeezing') return 'The lever is moving the plunger toward the cartridge seal.';
  if (now.phase === 'water') return `${amount} collected. The water falls as the gas space expands.`;
  if (now.phase === 'no-charge') return `No water delivered: the cartridge adds no gas pressure. ${left} remains.`;
  if (now.phase === 'dry-pickup') return `No water delivered: the intake starts in the gas space. ${left} remains below it.`;
  if (now.phase === 'pressure-balance') return `${amount} collected; ${left} remains. Pressure can no longer lift water to the outlet.`;
  return `${amount} collected; ${left} remains below the exposed intake. The observation stops as gas first reaches the tube.`;
}

export function createCartridgeExtinguisherModel() {
  const kit = houseModel('Fire extinguisher'), controller = createCartridgeExtinguisherController(), g = buildExtinguisher(kit);
  kit.control('water', 'Starting water', ...FIRE_DOMAINS.water, FIRE_DEFAULTS.water, 'L', 'Choose a fresh water amount. The tank, gas space and collected result change together.', FIRE_OPTIONS.water);
  kit.control('charge', 'Gas in the cartridge', ...FIRE_DOMAINS.charge, FIRE_DEFAULTS.charge, '', 'Compare a full illustrative charge, one quarter as much gas, or no charge. These are model comparisons, not refill specifications.', FIRE_OPTIONS.charge);
  kit.control('pickup', 'Dip-tube intake', ...FIRE_DOMAINS.pickup, FIRE_DEFAULTS.pickup, '', 'Shorten the tube to reveal why its opening normally reaches near the bottom. Changing any setting prepares a fresh run.', FIRE_OPTIONS.pickup);
  const result = kit.finish(() => {
    const state = controller.getState(), {now} = state;drawExtinguisher(g, state);
    return {state, readings: [
      reading('Your result', resultText(state)),
      reading('Collected water', `${(now.delivered * 1000).toFixed(2)} L`, 'The blue volume in the collection vessel equals water lost from the extinguisher.'),
      reading('Water remaining', `${(now.water * 1000).toFixed(2)} L`, now.complete ? 'The frozen endpoint shows what remains when this water-delivery observation ends.' : 'Watch the level fall around the cartridge and the dip tube.'),
      reading('Gas pressure', `${Math.max(0, now.gauge / 100000).toFixed(2)} bar gauge`, now.released ? 'Pressure above atmospheric pressure in this ideal gas model. This readout is an overlay, not a gauge fitted to the extinguisher.' : 'The cartridge is still sealed. The water vessel starts at atmospheric pressure.'),
      reading('Water flow', `${(now.flow * 1000).toFixed(2)} L/s`, now.complete ? 'Water flow has ended. This does not mean the vessel has no pressure; later gas venting is outside the observation.' : 'The ideal outlet converts gas pressure and elevation head into flow. Hose filling and friction are omitted.'),
      reading('Intake', now.pickupWet ? 'Under water' : 'In the gas space', 'Only water above a submerged intake can enter the tube. A gas-space intake cannot empty the water below it.'),
    ]};
  });
  const render = result.update, readState = result.getState;let previousTime = 0, disposed = false;
  const sync = () => render(controller.getState().values);
  result.getState = () => ({...controller.getState(), readings: readState().readings.map(item => ({...item}))});
  result.update = (input = {}) => {controller.update(input);return sync();};
  result.reset = (initial = {}) => {controller.reset(initial);previousTime = 0;return sync();};
  result.advance = seconds => {controller.advance(Number.isFinite(seconds) ? seconds * P.playbackRate : 0);return sync();};
  result.animate = time => {if (!Number.isFinite(time) || time < previousTime) return sync();const delta = time - previousTime;previousTime = time;return result.advance(delta);};
  result.replayState = controller.replayState;
  result.playback = {label: 'Release the gas and follow water', description: 'Press the handle and follow water into the collection vessel. The illustrative model runs at twice its calculated speed. It stops at intake exposure or pressure balance, before later gas venting.', stepLabel: 'Advance one model second', advance: result.advance, step: () => result.advance(.5), complete: () => result.getState().now.complete, blocked: () => false};
  result.actions = [['Inspect: complete water path', 'system'], ['Inspect: gas release', 'release'], ['Inspect: dip tube', 'extinguisher'], ['Inspect: hose and outlet', 'hose']].map(([label, part]) => ({label, part, isolate: true, view: 'front', replay: false, run: sync}));
  result.resultPart = {id: 'collection', label: 'Inspect collected water', view: 'front', focusOnComplete: false, preserveOnReset: true, available: () => true};
  result.initialPart = 'system';result.initialView = 'front';result.initialIsolated = true;result.initialCutaway = true;
  result.frameVisibleOnly = true;result.framePadding = .60;result.selectionOutline = false;result.transparentBackground = true;
  result.overviewZoom = .7 / result.framePadding;
  result.viewDirections = {front: [.40, .34, 8], iso: [3, 2.5, 6]};
  result.partViewDirections = Object.fromEntries(result.parts.map(part => [part.id, {front: ['release', 'plunger', 'cartridge'].includes(part.id) ? [.18, .12, 8] : [.40, .34, 8]}]));
  for (const part of result.parts) part.framePadding = ['system', 'extinguisher'].includes(part.id) ? .60 : .64;
  result.catalogParts = result.parts.filter(part => !['system', 'extinguisher'].includes(part.id));result.topology = g;
  const dispose = result.dispose;result.dispose = () => {if (!disposed) {disposed = true;dispose();}};return result;
}

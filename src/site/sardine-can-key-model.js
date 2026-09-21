import * as THREE from 'three';
import {houseModel, reading as r} from './house-model-kit.js';
import {fixed} from './format.js';
import {
  sampleSardineKey, canPoint, canSegments, timeForLength, BAND_LENGTH,
  SARDINE_KEY_DEFAULTS as D, SARDINE_KEY_DOMAINS, SARDINE_KEY_OPTIONS, SARDINE_KEY_CONSTANTS as C,
} from './sardine-can-key-physics.js';

// ---------------------------------------------------------------------------
// Sardine-can key.
//
// Scale: one millimeter is 0.03 scene units, for everything: the can, the key,
// the coil and the 0.2 mm layers in it. The can is drawn at its real size, so
// the coil is small beside it; select the key or the coil to see it close.
//
// Force arrows share one scale: one millimeter of arrow per newton. Orange is the
// force the fingers put on the loop. Blue is the pull the coil puts on the band
// at the peel line.
//
// The chart standing behind the can is not at the can's scale: its width is the whole
// band and its height runs from 0 to 25 N.
//
// Placement. The coil rolls along the wall like a carpet being rolled up. Its
// axis sits the coil radius out from the peel line, and the key turns by the
// heading of the wall plus the angle wound, so the point of the spiral being
// laid down is always the point of the wall being peeled.
// ---------------------------------------------------------------------------

const MM = 0.03;
const NEWTON = 0.03;
const TAU = Math.PI * 2;
const TURN_SEGMENTS = 72;
const MAX_TURNS = 20;
const BAND_SAMPLES = 400;
const STEM_RADIUS = 0.6;
const SEAM_RADIUS = 0.7;
const SEAM_OFFSET = 0.1;
const WIRE_RADIUS = 0.9;
const WITHDRAW = 18;
const LID_LIFT = 15;
/** Height of the stem top above the band center, in millimeters. */
const LOOP_BASE = C.height - C.bandCenter + 8;
const CHART = {y: 36, z: -(C.breadth / 2 + 30), width: 66, height: 36, maxForce: 25};
const EFFORT_COLOR = 0xd9822b;
const PULL_COLOR = 0x2f6690;
const AVAILABLE_COLOR = 0x4f7f3a;
const LINE_COLOR = 0x374736;
const SEGMENTS = canSegments();

function roundedRect(inset) {
  const a = C.length / 2 - inset, b = C.breadth / 2 - inset, rc = C.cornerRadius - inset, shape = new THREE.Shape();
  shape.moveTo(-a + rc, -b);
  shape.lineTo(a - rc, -b);
  shape.absarc(a - rc, -b + rc, rc, -Math.PI / 2, 0, false);
  shape.lineTo(a, b - rc);
  shape.absarc(a - rc, b - rc, rc, 0, Math.PI / 2, false);
  shape.lineTo(-a + rc, b);
  shape.absarc(-a + rc, b - rc, rc, Math.PI / 2, Math.PI, false);
  shape.lineTo(-a, -b + rc);
  shape.absarc(-a + rc, -b + rc, rc, Math.PI, Math.PI * 1.5, false);
  return shape;
}

export function createSardineCanKeyModel() {
  const kit = houseModel('Sardine-can key'), {root, part, control, finish} = kit;
  const h = C.thickness, w = C.bandWidth, bandLow = C.bandCenter - w / 2, bandHigh = C.bandCenter + w / 2;

  const surface = (geometry, color, parent, doubleSided = true) => {
    const mesh = kit.box([1, 1, 1], [0, 0, 0], color, parent);
    mesh.geometry.dispose();
    mesh.geometry = geometry;
    if (doubleSided) {
      mesh.material = mesh.material.clone();
      mesh.material.side = THREE.DoubleSide;
    }
    return mesh;
  };
  const line = (count, color, parent) => {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(count * 3), 3));
    const object = new THREE.Line(geometry, new THREE.LineBasicMaterial({color}));
    object.frustumCulled = false;
    parent.add(object);
    return object;
  };
  // A solid arrow along +y, drawn at its exact length so paired arrows compare.
  const arrow = (color, parent) => {
    const group = new THREE.Group(), shaft = kit.cylinder(1, 1, [0, 0, 0], 'ink', group), head = kit.cylinder(1, 1, [0, 0, 0], 'ink', group);
    shaft.material = shaft.material.clone();
    shaft.material.color.set(color);
    head.geometry.dispose();
    head.geometry = new THREE.ConeGeometry(1, 1, 16);
    head.material = shaft.material;
    parent.add(group);
    group.userData.setLength = length => {
      const headLength = Math.min(0.35 * length, 2.4 * MM), radius = 0.4 * MM;
      group.userData.length = length;
      group.visible = length > 1e-9;
      shaft.scale.set(radius, Math.max(1e-6, length - headLength), radius);
      shaft.position.y = (length - headLength) / 2;
      head.scale.set(2.5 * radius, headLength, 2.5 * radius);
      head.position.y = length - headLength / 2;
    };
    group.userData.setDirection = direction => group.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.clone().normalize());
    return group;
  };
  const strip = count => {
    const geometry = new THREE.BufferGeometry(), index = [];
    for (let i = 1; i < count; i++) { const a = (i - 1) * 2; index.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); }
    geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(count * 6), 3));
    geometry.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(count * 6), 3));
    geometry.setIndex(index);
    return geometry;
  };
  // A band of wall between two heights, all the way round, with outward normals.
  const wallRibbon = (y0, y1) => {
    const n = Math.ceil(BAND_LENGTH) + 1, geometry = strip(n), positions = geometry.attributes.position.array, normals = geometry.attributes.normal.array;
    for (let i = 0; i < n; i++) {
      const p = canPoint(BAND_LENGTH * i / (n - 1)), nx = Math.sin(p.psi), nz = Math.cos(p.psi);
      positions.set([p.x * MM, y0 * MM, p.z * MM, p.x * MM, y1 * MM, p.z * MM], i * 6);
      normals.set([nx, 0, nz, nx, 0, nz], i * 6);
    }
    return geometry;
  };
  const seamTube = y => {
    const points = Array.from({length: 240}, (_, i) => {
      const p = canPoint(BAND_LENGTH * i / 240);
      return new THREE.Vector3((p.x + SEAM_OFFSET * Math.sin(p.psi)) * MM, y * MM, (p.z + SEAM_OFFSET * Math.cos(p.psi)) * MM);
    });
    return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points, true, 'centripetal'), 480, SEAM_RADIUS * MM, 6, true);
  };
  const flat = (inset, y, color, parent) => {
    const geometry = new THREE.ShapeGeometry(roundedRect(inset), 12);
    geometry.rotateX(-Math.PI / 2);
    geometry.scale(MM, MM, MM);
    geometry.translate(0, y * MM, 0);
    return surface(geometry, color, parent);
  };

  const system = part('system', 'Key-opening can', 'A 105 by 76 mm tin with a scored band around its side. The key winds the band off and walks around the can as it goes; the top comes free when the band is gone. Drawn at true size, so the coil is small beside the can.');

  const body = part('body', 'Can body and contents', 'The wall below the band stays on the can. The fish packed inside show through the gap the band leaves behind.', [0, 0, 0], system);
  const lowerWall = surface(wallRibbon(0, bandLow), 'metal', body);
  const bottom = flat(0, 0, 'metal', body);
  const bottomSeam = surface(seamTube(0), 'metal', body, false);
  const contentsGeometry = new THREE.ExtrudeGeometry(roundedRect(2.5), {depth: 22, bevelEnabled: false, curveSegments: 12});
  contentsGeometry.rotateX(-Math.PI / 2);
  contentsGeometry.scale(MM, MM, MM);
  contentsGeometry.translate(0, MM, 0);
  const contents = surface(contentsGeometry, 'clay', body, false);

  const band = part('band', 'Scored tear band', 'The 8 mm strip of 0.2 mm tinplate between two score lines, drawn dark, where the metal is thinnest. The blue arrow is the pull the coil puts on the band at the peel line, on the same scale as the orange finger force.', [0, 0, 0], system);
  const bandGeometry = strip(BAND_SAMPLES), bandMesh = surface(bandGeometry, 'metal', band);
  bandMesh.frustumCulled = false;
  const scoreLines = [bandLow, bandHigh].map(y => { const object = line(BAND_SAMPLES, LINE_COLOR, band); object.userData.height = y; return object; });
  const pullArrow = arrow(PULL_COLOR, band);

  const lid = part('lid', 'Lid section', 'The top of the wall, the lid panel and the seam. Only the band holds it to the can, so it lifts free once all 336 mm are off.', [0, 0, 0], system);
  const upperWall = surface(wallRibbon(bandHigh, C.height), 'metal', lid);
  const lidPanel = flat(0.4, C.height - 1.2, 'cream', lid);
  const topSeam = surface(seamTube(C.height), 'metal', lid, false);

  const key = part('key', 'Winding key', 'A slotted shank with a flat loop. The tab sits in the slot. Fingers push on the loop at the grip radius, shown by the orange arrow, and the torque they make winds the band.', [0, C.bandCenter * MM, 0], system);
  const barrel = kit.cylinder(1, 1, [0, 0, 0], 'gold', key);
  const slot = kit.box([0.5 * MM, (w + 0.4) * MM, 1], [0, 0, 0], 'ink', key);
  const stemLength = LOOP_BASE - w / 2;
  const stem = kit.cylinder(STEM_RADIUS * MM, stemLength * MM, [0, (w / 2 + stemLength / 2) * MM, 0], 'gold', key);
  const loop = kit.box([1, 1, 1], [0, 0, 0], 'gold', key);
  const effortArrow = arrow(EFFORT_COLOR, key);
  effortArrow.userData.setDirection(new THREE.Vector3(0, 0, -1));

  const coil = part('coil', 'Wound coil', 'The band as it comes off: a spiral with one 0.2 mm layer a turn, drawn at true thickness. Its radius grows with winding. Required effort also depends on whether the peel point is on a straight side or a corner.', [0, 0, 0], key);
  const coilCount = MAX_TURNS * TURN_SEGMENTS + 1, coilGeometry = strip(coilCount), coilMesh = surface(coilGeometry, 'metal', coil);
  coilMesh.frustumCulled = false;
  const coilEdges = [-w / 2, w / 2].map(y => { const object = line(coilCount, LINE_COLOR, coil); object.userData.height = y; return object; });

  const chartTextures=[];
  const gauge = part('gauge', 'Force needed along the band', 'Orange: the finger force needed at every point of the band for these settings. Green: the force your fingers can give. The steps are the four corners. A red dot marks where the key would stop. It stands behind the can and is not drawn at the can’s scale.', [-CHART.width / 2 * MM, CHART.y * MM, CHART.z * MM], system);
  kit.box([(CHART.width + 18) * MM, (CHART.height + 25) * MM, 0.6 * MM], [CHART.width / 2 * MM, CHART.height / 2 * MM, -0.8 * MM], 'cream', gauge);
  kit.rod([0, 0, 0], [CHART.width * MM, 0, 0], 0.3 * MM, 'ink', gauge);
  kit.rod([0, 0, 0], [0, CHART.height * MM, 0], 0.3 * MM, 'ink', gauge);
  for (const force of [10, 20]) {
    const grid = line(2, 0x9aa89a, gauge), y = force / CHART.maxForce * CHART.height * MM;
    grid.geometry.attributes.position.array.set([0, y, 0.1 * MM, CHART.width * MM, y, 0.1 * MM]);
  }
  // Canvas-backed planes follow the chart in 3D; numerical checks also run
  // without a DOM, using a transparent texture with the same geometry.
  function chartLabel(text,x,y,width=20,height=4,color='#263a2f'){
    const canvas=typeof document==='undefined'?null:document.createElement('canvas');
    let texture;
    if(canvas){canvas.width=640;canvas.height=Math.round(640*height/width);const ctx=canvas.getContext('2d');ctx.font=`${canvas.height*.8}px sans-serif`;ctx.fillStyle=color;ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(text,canvas.width/2,canvas.height/2,canvas.width*.96);texture=new THREE.CanvasTexture(canvas);}
    else texture=new THREE.DataTexture(new Uint8Array([0,0,0,0]),1,1);
    texture.colorSpace=THREE.SRGBColorSpace;texture.needsUpdate=true;chartTextures.push(texture);
    const mesh=new THREE.Mesh(new THREE.PlaneGeometry(width*MM,height*MM),new THREE.MeshBasicMaterial({map:texture,transparent:true,depthWrite:false,toneMapped:false,side:THREE.DoubleSide}));
    mesh.position.set(x*MM,y*MM,.7*MM);mesh.userData.labelText=text;gauge.add(mesh);
  }
  chartLabel('Equivalent effort (N)',CHART.width/2,CHART.height+7,CHART.width,5);
  for(const force of [0,10,20,25])chartLabel(String(force),-4,force/CHART.maxForce*CHART.height,7,3.5);
  for(const percent of [0,50,100])chartLabel(`${percent}%`,percent/100*CHART.width,-4,12,3.5);
  chartLabel('Band removed',CHART.width/2,-9,CHART.width,4);
  chartLabel('Orange: needed',CHART.width*.25,CHART.height+2,CHART.width*.5,3.5,'#99501a');
  chartLabel('Green: available',CHART.width*.76,CHART.height+2,CHART.width*.5,3.5,'#355626');
  const curvePoints = SEGMENTS.length * 24;
  const curve = line(curvePoints, EFFORT_COLOR, gauge);
  const availableLine = line(2, AVAILABLE_COLOR, gauge);
  const marker = kit.sphere(1.3 * MM, [0, 0, 0], 'clay', gauge);
  marker.material = marker.material.clone();
  marker.material.color.set(EFFORT_COLOR);
  const stallMarker = kit.sphere(1.7 * MM, [0, 0, 0], 'red', gauge);

  const specs = {
    effort: ['Equivalent finger effort available', 'N', null, 'Available turning couple divided by grip radius. This represents rotational input, not individual finger contact forces. The key stops when required effort exceeds this limit.'],
    grip: ['Grip radius on the loop', 'mm', null, 'How far from the shank your fingers push. A wider loop makes more torque from the same force, and your fingers travel farther for it.'],
    shank: ['Key shank radius', 'mm', null, 'The radius the first layer winds onto. A thin shank starts easier but takes more turns, and the coil still ends large.'],
    score: ['Score depth', '', SARDINE_KEY_OPTIONS.score.map(({value, label}) => ({value, label})), 'How much metal is left under each of the two score lines, as the force it takes to tear one. These are teaching values, not measurements.'],
    temper: ['Tinplate temper', '', SARDINE_KEY_OPTIONS.temper.map(({value, label}) => ({value, label})), 'The steel grade of the band. A stronger temper needs a larger moment to curl the strip. The tearing force is held separately by the score setting so the two can be compared.'],
  };
  for (const [name, [min, max, step]] of Object.entries(SARDINE_KEY_DOMAINS)) {
    const [label, unit, options, help] = specs[name];
    control(name, label, min, max, step, D[name], unit, help, options);
  }

  let elapsed = 0, lastClock = 0, disposed = false, loopGrip = null, curveSignature = '', bandCount = 0, coilSegments = 0;

  const result = finish(values => {
    const s = sampleSardineKey(values, elapsed), peel = s.point, nx = Math.sin(peel.psi), nz = Math.cos(peel.psi), tx = Math.cos(peel.psi), tz = -Math.sin(peel.psi);

    // The band still on the can, from the peel line round to the tab.
    bandCount = s.remainingLength > 1e-9 ? Math.max(2, Math.ceil(s.remainingLength) + 1) : 0;
    const bandPositions = bandGeometry.attributes.position.array, bandNormals = bandGeometry.attributes.normal.array;
    for (let i = 0; i < bandCount; i++) {
      const p = canPoint(s.woundLength + s.remainingLength * i / (bandCount - 1)), px = Math.sin(p.psi), pz = Math.cos(p.psi);
      bandPositions.set([p.x * MM, bandLow * MM, p.z * MM, p.x * MM, bandHigh * MM, p.z * MM], i * 6);
      bandNormals.set([px, 0, pz, px, 0, pz], i * 6);
      for (const score of scoreLines) score.geometry.attributes.position.array.set([(p.x + 0.15 * px) * MM, score.userData.height * MM, (p.z + 0.15 * pz) * MM], i * 3);
    }
    bandGeometry.setDrawRange(0, Math.max(0, bandCount - 1) * 6);
    bandGeometry.attributes.position.needsUpdate = bandGeometry.attributes.normal.needsUpdate = true;
    bandGeometry.computeBoundingBox();
    bandGeometry.computeBoundingSphere();
    bandMesh.visible = bandCount > 0;
    for (const score of scoreLines) {
      score.geometry.setDrawRange(0, bandCount);
      score.geometry.attributes.position.needsUpdate = true;
      score.geometry.computeBoundingSphere();
      score.visible = bandCount > 0;
    }

    // The key: its axis the coil radius out from the peel line, turned by the
    // wall's heading plus the angle wound.
    const out = s.coilRadius + WITHDRAW * s.keyWithdraw;
    key.position.set((peel.x + out * nx) * MM, C.bandCenter * MM, (peel.z + out * nz) * MM);
    key.rotation.y = peel.psi + s.theta;
    barrel.scale.set(values.shank * MM, w * MM, values.shank * MM);
    slot.scale.z = (2 * values.shank + 0.2) * MM;
    if (loopGrip !== values.grip) {
      loopGrip = values.grip;
      const radius = values.grip, points = Array.from({length: 64}, (_, i) => {
        const a = i / 64 * TAU;
        return new THREE.Vector3(radius * Math.sin(a) * MM, (LOOP_BASE + 0.75 * radius - 0.75 * radius * Math.cos(a)) * MM, 0);
      });
      loop.geometry.dispose();
      loop.geometry = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points, true), 96, WIRE_RADIUS * MM, 6, true);
    }

    // The coil: material wound at angle phi sits at key angle pi - phi, so the
    // newest layer always touches the peel line.
    coilSegments = s.theta > 0 ? Math.max(1, Math.ceil(s.theta / TAU * TURN_SEGMENTS)) : 0;
    const coilPositions = coilGeometry.attributes.position.array, coilNormals = coilGeometry.attributes.normal.array;
    for (let i = 0; coilSegments && i <= coilSegments; i++) {
      const phi = s.theta * i / coilSegments, rho = s.rho0 + h * phi / TAU, sx = Math.sin(Math.PI - phi), cz = Math.cos(Math.PI - phi), x = rho * sx * MM, z = rho * cz * MM;
      coilPositions.set([x, -w / 2 * MM, z, x, w / 2 * MM, z], i * 6);
      coilNormals.set([sx, 0, cz, sx, 0, cz], i * 6);
      for (const edge of coilEdges) edge.geometry.attributes.position.array.set([x, edge.userData.height * MM, z], i * 3);
    }
    coilGeometry.setDrawRange(0, coilSegments * 6);
    coilGeometry.attributes.position.needsUpdate = coilGeometry.attributes.normal.needsUpdate = true;
    coilGeometry.computeBoundingBox();
    coilGeometry.computeBoundingSphere();
    coilMesh.visible = coilSegments > 0;
    for (const edge of coilEdges) {
      edge.geometry.setDrawRange(0, coilSegments ? coilSegments + 1 : 0);
      edge.geometry.attributes.position.needsUpdate = true;
      edge.geometry.computeBoundingSphere();
      edge.visible = coilSegments > 0;
    }

    // Forces on one scale. At a stall the fingers push as hard as they can.
    const effortForce = s.stalled ? Math.min(values.effort, s.fingerForce) : s.fingerForce;
    const pullForce = effortForce * s.advantage;
    effortArrow.position.set(values.grip * MM, (LOOP_BASE + 0.75 * values.grip) * MM, 0);
    effortArrow.userData.setLength(s.freed ? 0 : effortForce * NEWTON);
    const pullLength = pullForce * NEWTON;
    pullArrow.position.set((peel.x + 0.6 * nx) * MM + tx * pullLength, C.bandCenter * MM, (peel.z + 0.6 * nz) * MM + tz * pullLength);
    pullArrow.userData.setDirection(new THREE.Vector3(-tx, 0, -tz));
    pullArrow.userData.setLength(s.freed ? 0 : pullLength);

    lid.position.y = s.lidLift * LID_LIFT * MM;

    // The chart only changes with the settings; the marker moves with the trial.
    const chartY = force => Math.min(force, CHART.maxForce) / CHART.maxForce * CHART.height * MM;
    const signature = Object.keys(SARDINE_KEY_DOMAINS).map(name => values[name]).join();
    if (signature !== curveSignature) {
      curveSignature = signature;
      const points = curve.geometry.attributes.position.array;
      SEGMENTS.forEach((segment, k) => {
        for (let j = 0; j < 24; j++) {
          const at = segment.from + segment.length * j / 23, rho = s.rhoAt(at);
          points.set([at / BAND_LENGTH * CHART.width * MM, chartY((s.tear * rho / (1 + rho * segment.kappa) + s.plasticMoment) / values.grip), 0.2 * MM], (k * 24 + j) * 3);
        }
      });
      curve.geometry.attributes.position.needsUpdate = true;
      curve.geometry.computeBoundingSphere();
      const available = chartY(values.effort);
      availableLine.geometry.attributes.position.array.set([0, available, 0.25 * MM, CHART.width * MM, available, 0.25 * MM]);
      availableLine.geometry.attributes.position.needsUpdate = true;
      availableLine.geometry.computeBoundingSphere();
      stallMarker.visible = s.stallLength !== null;
      if (s.stallLength !== null) stallMarker.position.set(s.stallLength / BAND_LENGTH * CHART.width * MM, chartY(s.forceAt(Math.min(BAND_LENGTH, s.stallLength + 1e-6))), 0.5 * MM);
    }
    marker.position.set(s.fraction * CHART.width * MM, chartY(s.fingerForce), 0.4 * MM);

    const percent = fraction => `${fixed(fraction * 100, 0)}%`;
    const stallCorner = s.stallLength !== null && SEGMENTS.some(segment => segment.kind === 'corner' && Math.abs(segment.to - s.stallLength) < 1e-6);
    const beyond = s.stallLength === null ? null : s.forceAt(Math.min(BAND_LENGTH, s.stallLength + 1e-6));
    let outcome;
    if (s.mode === 'freed') outcome = s.lidLift >= 1 ? `Band off in ${fixed(s.turnsTotal, 1)} turns · the lid lifts clear` : 'Band off · the key comes away and the lid comes free';
    else if (s.stalled && s.stallLength === 0) outcome = `The key will not turn · the first turn needs ${fixed(s.forceAtStart, 1)} N and your fingers give ${fixed(values.effort, 1)} N`;
    else if (s.stalled) outcome = stallCorner
      ? `Stalled with ${percent(s.fraction)} of the band off · the straight side ahead needs ${fixed(beyond, 1)} N and your fingers give ${fixed(values.effort, 1)} N`
      : `Stalled with ${percent(s.fraction)} of the band off · from here it needs more than your ${fixed(values.effort, 1)} N`;
    else if (s.mode === 'ready') outcome = s.stallLength === 0
      ? `Ready · but the first turn needs ${fixed(s.forceAtStart, 1)} N, more than your ${fixed(values.effort, 1)} N`
      : 'Ready · the tab is in the slot; press Play to turn the key';
    else outcome = `Winding · ${fixed(Math.min(99, Math.floor(s.fraction * 100)), 0)}% of the band off`;

    return {
      state: s,
      readings: [
        r('Your result', outcome),
        r('Equivalent finger effort now', `${fixed(s.fingerForce, 1)} N`, `The torque needed divided by the ${fixed(values.grip, 0)} mm grip radius. It rises along each side as the coil grows${s.onCorner ? ', but rolling around this corner adds shaft rotation per millimeter and reduces the required torque' : ''}.`),
        r('Hardest point', `${fixed(s.peakForce, 1)} N with ${fixed(s.peakAt / BAND_LENGTH * 100, 0)}% off`, `The maximum required effort along this entire trial, including both sides of each curvature change. Your fingers give ${fixed(values.effort, 1)} N.`),
        r('First turn and last turn', `${fixed(s.forceAtStart, 1)} N and ${fixed(s.forceAtEnd, 1)} N`, `The coil ends ${fixed(s.rhoFinal / s.rho0, 1)} times the radius it starts at.`),
        r('Coil radius', `${fixed(s.coilRadius, 2)} mm`, `The ${fixed(values.shank, 2)} mm shank, half a layer, and 0.2 mm more for every turn wound.`),
        r('Band off', `${fixed(s.woundLength, 0)} of ${fixed(BAND_LENGTH, 0)} mm`, 'The peel point advances by this length along the wall. The key axis follows a longer, offset path.'),
        r('Key turns', `${fixed(s.turns, 1)} of ${fixed(s.turnsTotal, 1)}`, 'Rotation relative to the fixed can. A complete trip adds one turn of heading to the turns wound into the coil.'),
        r('Torque needed', `${fixed(s.torque, 0)} N·mm`, `Virtual work: tearing ${fixed(s.tear, 0)} N divided by the shaft rotation per millimeter, plus ${fixed(s.plasticMoment, 0)} N·mm of plastic bending moment.`),
        r('Effective motion advantage', `${fixed(s.advantage, 1)} to 1`, 'Grip travel per millimeter peeled: R(1/ρ + κ). On a straight side this reduces to the wheel-and-axle ratio R/ρ.'),
        r('Equivalent peel resistance', `${fixed(s.stripPull, 1)} N`, 'Work per millimeter peeled, including tearing and bending. This is not a separately measured strip tension.'),
        r('Work done', `${fixed(s.work, 2)} J`, `Tearing ${fixed(s.tearWork, 2)} J and bending ${fixed(s.bendWork, 2)} J. Equivalent rotational grip travel is ${fixed(s.fingerTravel / 1000, 2)} m; motion of the hand following the key axis is excluded.`),
      ],
    };
  });

  const render = result.update;
  result.advance = dt => {
    if (Number.isFinite(dt) && dt > 0) elapsed = Math.min(C.duration, elapsed + dt);
    return render();
  };
  result.animate = t => {
    const dt = Number.isFinite(t) ? Math.max(0, t - lastClock) : 0;
    if (Number.isFinite(t)) lastClock = t;
    return result.advance(dt);
  };
  result.reset = () => {
    elapsed = lastClock = 0;
    return render(result.defaults);
  };
  const inspect = (label, fraction) => ({
    label, part: 'system', view: 'front', replay: false,
    run() {
      const values = result.getState().values;
      elapsed = Math.min(C.duration, timeForLength(values, fraction * BAND_LENGTH) + (fraction === 1 ? C.withdrawDuration + C.liftDuration : 0));
      return render();
    },
  });
  result.actions = [
    inspect('Inspect: tab in the slot', 0),
    inspect('Inspect: a quarter off', 0.25),
    inspect('Inspect: half off', 0.5),
    inspect('Inspect: three quarters off', 0.75),
    inspect('Inspect: band off, lid lifted', 1),
  ];
  result.playback = {
    label: 'Turn the key',
    description: 'Your fingers try one and a quarter turns a second. The key keeps going while the force it needs is within what your fingers can give, and stops where it is not. When the whole band is off, the key comes away and the lid lifts free.',
    stepLabel: 'Turn the key a tenth of a turn',
    advance: result.advance,
    step: () => result.advance(0.1 / C.turnRate),
    // A stall ends the trial too, so Play starts it again from the tab.
    complete: () => { const s = result.getState(); return Boolean(s.complete || (s.stalled && s.elapsed > 0)); },
    blocked: () => false,
  };
  result.resultPart = {id: 'lid', label: 'Inspect the freed lid', view: 'front', context: 'system', focusOnComplete: false, available: () => result.getState().lidLift >= 1};
  result.frameBoundsForPart = id => {
    const s = result.getState(), box = new THREE.Box3();
    if (id === 'system') {
      const reach = (s.values.grip + WIRE_RADIUS + 1) * MM;
      box.set(new THREE.Vector3(-(C.length / 2 + 2) * MM, -2 * MM, (CHART.z - 2) * MM), new THREE.Vector3((C.length / 2 + 2) * MM, (CHART.y + CHART.height + 6) * MM, (C.breadth / 2 + 2) * MM));
      box.expandByPoint(new THREE.Vector3(key.position.x - reach, 0, key.position.z - reach));
      box.expandByPoint(new THREE.Vector3(key.position.x + reach, (C.bandCenter + LOOP_BASE + 1.5 * s.values.grip + 2) * MM, key.position.z + reach));
    } else if (id === 'lid' && s.lidLift > 0) {
      // Show the lifted lid over the top of the can it came off.
      box.set(new THREE.Vector3(-(C.length / 2 + 2) * MM, (C.bandCenter - C.bandWidth) * MM, -(C.breadth / 2 + 2) * MM), new THREE.Vector3((C.length / 2 + 2) * MM, (C.height + LID_LIFT * s.lidLift + 2) * MM, (C.breadth / 2 + 2) * MM));
    } else return null;
    root.updateWorldMatrix(true, false);
    return box.applyMatrix4(root.matrixWorld);
  };

  root.rotation.set(0.42, -0.38, 0);
  result.initialPart = 'system';
  result.initialView = 'front';
  result.frameVisibleOnly = true;
  result.framePadding = 0.62;
  result.selectionOutline = false;
  result.transparentBackground = true;
  result.topology = {
    system, body, band, lid, key, coil, gauge, lowerWall, bottom, bottomSeam, contents, bandMesh, bandGeometry, scoreLines, pullArrow,
    upperWall, lidPanel, topSeam, barrel, slot, stem, loop, effortArrow, coilMesh, coilGeometry, coilEdges, curve, availableLine, marker, stallMarker,
    MM, NEWTON, CHART, STEM_RADIUS, SEAM_RADIUS, SEAM_OFFSET, WIRE_RADIUS, WITHDRAW, LID_LIFT, LOOP_BASE,
    bandCount: () => bandCount, coilSegments: () => coilSegments,
  };
  const dispose = result.dispose;
  result.dispose = () => { if (!disposed) { disposed = true; chartTextures.forEach(texture=>texture.dispose()); dispose(); } };
  return result;
}

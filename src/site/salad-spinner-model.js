import * as THREE from 'three';
import {houseModel, reading as r} from './house-model-kit.js';
import {fixed} from './format.js';
import {surface, lineObject, solidArrow} from './scene-kit.js';
import {spurGearShape, ringGearShape} from './gear-geometry.js';
import {
  sampleSpinner, spinnerPlan, waterLeftShare, criticalDrop, gearTeeth,
  SPINNER_DEFAULTS as D, SPINNER_DOMAINS, SPINNER_CONSTANTS as C,
} from './salad-spinner-physics.js';

// ---------------------------------------------------------------------------
// Salad spinner.
//
// Scale: one millimeter is 0.012 scene units for every length: the 125 mm
// bowl, the 110 mm basket and the 0.8 mm module of the gear teeth.
//
// Time: the trial runs in real seconds, but the crank, gears and basket are
// drawn turning 20 times slower than they really turn, and a drop that leaves
// is drawn crossing to the bowl in half a second instead of a few thousandths.
// The readings carry the real speeds. Drops smaller than 1.5 mm are drawn at
// 1.5 mm so they show.
//
// Arrow: the hand's force on the knob, two millimeters of arrow per newton.
//
// Gears: the ring, planets and sun are real involute outlines, phased so they
// mesh, turned by the drawn crank angle through the tooth ratios.
// ---------------------------------------------------------------------------

const MM = 0.012;
const SLOW = 1 / 20;
const FLIGHT = 0.5;
const TRACE = 1.2;
const NEWTON = 2 * MM;
const TAU = Math.PI * 2;
const BOWL = {radius: 125, wall: 3, height: 124, bottom: 3};
const BASKET = {radius: 110, bottom: 12, top: 105, ribs: 48};
const LID = {y: 124, thickness: 4, inner: 40, outer: 128, open: 1.9};
const GEAR = {y: 128, thickness: 4, rim: 2.5};
const CRANK = {radius: C.crankRadius * 1000, height: 6, knob: 22};
const DROPS = 80;
const LEAVES = 48;
const MIN_DROP = 1.5;
const CHART = {width: 110, height: 70, y: 150, z: -(BOWL.radius + 45), maxRpm: 1200};
const HAND_COLOR = 0xd9822b;
const WATER_COLOR = 0x3f7fb0;
const CLUTCH = {inner: 14, outer: 16, roller: 2, angle: 20 * Math.PI / 180, released: -15 * Math.PI / 180};
const BRAKE = {x: 110, contactY: BASKET.top + 1.6, travel: 3, padHeight: 4, buttonBottom: 138};

/** A seeded generator, so every trial draws the same drops and leaves. */
function random(seed) {
  let state = seed >>> 0;
  return () => { state = (state * 1664525 + 1013904223) >>> 0; return state / 4294967296; };
}

/** Drops of equal water volume from the log-uniform spread, placed through the salad layer by volume. */
export function spinnerDrops() {
  const next = random(7), list = [];
  for (let k = 0; k < DROPS; k++) {
    const radius = C.dropMin * (C.dropMax / C.dropMin) ** ((k + 0.5) / DROPS);
    list.push({radius});
  }
  const places = Array.from({length: DROPS}, (_, k) => Math.sqrt(C.saladInner ** 2 + (C.basketRadius ** 2 - C.saladInner ** 2) * (k + 0.5) / DROPS));
  for (let k = places.length - 1; k > 0; k--) { const j = Math.floor(next() * (k + 1)); [places[k], places[j]] = [places[j], places[k]]; }
  list.forEach((drop, k) => {
    drop.r = places[k];
    drop.angle = next() * TAU;
    drop.height = 22 + next() * 70;
    drop.release = Math.sqrt(3 * C.surfaceTension * C.hysteresis / (Math.PI * C.waterDensity * drop.radius ** 2 * drop.r));
  });
  return list;
}

export function createSaladSpinnerModel() {
  const kit = houseModel('Salad spinner'), {root, part, control, finish, covers} = kit;
  const drops = spinnerDrops(), captionTextures=[], captions=[];
  function caption(text,x,y,parent,size=6,color=0x374736){
    const height=size*2*MM,width=Math.max(size,text.length*size*.65)*MM;
    const canvas=typeof document==='undefined'?null:document.createElement('canvas');let texture;
    if(canvas){canvas.height=128;canvas.width=Math.ceil(128*width/height);const ctx=canvas.getContext('2d');ctx.font='600 80px sans-serif';ctx.fillStyle='#'+color.toString(16).padStart(6,'0');ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(text,canvas.width/2,64,canvas.width*.96);texture=new THREE.CanvasTexture(canvas);}
    else texture=new THREE.DataTexture(new Uint8Array([0,0,0,0]),1,1);
    texture.colorSpace=THREE.SRGBColorSpace;texture.needsUpdate=true;captionTextures.push(texture);
    const mesh=new THREE.Mesh(new THREE.PlaneGeometry(width,height),new THREE.MeshBasicMaterial({map:texture,transparent:true,depthWrite:false,toneMapped:false,side:THREE.DoubleSide}));
    mesh.position.set(x*MM,y*MM,1.2*MM);mesh.userData.labelText=text;parent.add(mesh);captions.push(mesh);return mesh;
  }

  const system = part('system', 'Salad spinner', 'A crank on the lid turns a gear ring. Three planet gears on fixed pins pass the motion to a small sun gear, which spins the basket several times faster. Mechanical lengths share one scale; water markers are enlarged; the turning parts are drawn 20 times slower than they really turn.');

  // Bowl: the back half always shows; the front half is a cover.
  const bowl = part('bowl', 'Outer bowl', 'Catches the water thrown out through the basket. Its front half is cut away so the basket shows.', [0, 0, 0], system);
  const profile = [[0, 0], [BOWL.radius + BOWL.wall, 0], [BOWL.radius + BOWL.wall, BOWL.height], [BOWL.radius, BOWL.height], [BOWL.radius, BOWL.bottom], [0, BOWL.bottom]].map(([x, y]) => new THREE.Vector2(x * MM, y * MM));
  surface(kit, new THREE.LatheGeometry(profile, 48, Math.PI / 2, Math.PI), 'cream', bowl, true);
  covers.push(surface(kit, new THREE.LatheGeometry(profile, 48, -Math.PI / 2, Math.PI), 'cream', bowl, true));
  const pivot=part('basket-pivot','Basket support pivot','A fixed rounded pivot supports the basket from the bowl floor. The upper bearing collar keeps the rotating assembly centered.',[0,0,0],bowl);
  kit.cylinder(2*MM,6*MM,[0,6*MM,0],'metal',pivot);
  kit.sphere(2*MM,[0,9*MM,0],'metal',pivot);
  const pool = part('pool', 'Water thrown off', 'The water that has left the salad, gathered in the corner of the bowl. Its cross-section is drawn so the ring holds exactly the volume thrown off.', [0, 0, 0], bowl);
  const poolMesh = surface(kit, new THREE.BufferGeometry(), 'blue', pool, true);
  poolMesh.material.color.set(WATER_COLOR);

  // Basket and the outer race of the one-way roller clutch.
  const basket = part('basket', 'Perforated basket', 'Holds the salad on its circle and lets water through its slots. It turns the opposite way to the crank.', [0, 0, 0], system);
  for (let i = 0; i < BASKET.ribs; i++) {
    const a = i * TAU / BASKET.ribs, x = BASKET.radius * Math.cos(a) * MM, z = -BASKET.radius * Math.sin(a) * MM;
    kit.rod([x, BASKET.bottom * MM, z], [x, BASKET.top * MM, z], 1.2 * MM, 'blue', basket);
  }
  for (const y of [BASKET.bottom, 40, 72, BASKET.top]) { const hoop = kit.ring(BASKET.radius * MM, 1.6 * MM, [0, y * MM, 0], 'blue', basket); hoop.rotation.x = Math.PI / 2; }
  kit.cylinder(BASKET.radius * MM, 2 * MM, [0, BASKET.bottom * MM, 0], 'blue', basket);
  kit.cylinder(6 * MM, (108 - BASKET.bottom) * MM, [0, (BASKET.bottom + 108) / 2 * MM, 0], 'blue', basket);
  const clutch = part('clutch', 'One-way roller clutch', 'Rollers wedge between shaft ramps and the basket race while cranking. When the basket overruns the stopped drive, they move into wider gaps and let it coast. Engagement positions are idealized, not a friction/contact solver.', [0,0,0], system);
  const clutchRace = part('clutch-race', 'Basket clutch race', 'The outer clutch ring turns with the basket. During coasting it can keep turning around the released rollers.', [0, 0, 0], clutch);
  const raceProfile = [[14, 107], [16, 107], [16, 114.5], [14, 114.5], [14, 107]].map(([x,y])=>new THREE.Vector2(x*MM,y*MM));
  surface(kit, new THREE.LatheGeometry(raceProfile, 64), 'blue', clutchRace, true);
  for(const side of [-1,1])kit.box([15*MM,MM,3*MM],[side*7.5*MM,107.5*MM,0],'blue',clutchRace);
  for(let i=0;i<3;i++){const angle=i*TAU/3;kit.box([1.2*MM,.3*MM,1.2*MM],[15*Math.cos(angle)*MM,114.65*MM,-15*Math.sin(angle)*MM],'cream',clutchRace);}

  const salad = part('salad', 'Wet salad', 'Leaves pressed toward the basket wall. Each blue dot is an equal share of the water on them; the big ones leave first.', [0, 0, 0], basket);
  const leafMaterial = kit.sphere(1, [0, 0, 0], 'leaf', salad);
  const leaves = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 12, 8), leafMaterial.material, LEAVES);
  leafMaterial.geometry.dispose();
  salad.remove(leafMaterial);
  salad.add(leaves);
  {
    const next = random(3), matrix = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler();
    for (let i = 0; i < LEAVES; i++) {
      const a = next() * TAU, radius = 80 + next() * 26, y = 20 + next() * 76;
      e.set((next() - 0.5) * 0.6, a + Math.PI / 2, (next() - 0.5) * 1.2);
      matrix.compose(new THREE.Vector3(radius * Math.cos(a) * MM, y * MM, -radius * Math.sin(a) * MM), q.setFromEuler(e), new THREE.Vector3(14 * MM, 22 * MM, 2.5 * MM));
      leaves.setMatrixAt(i, matrix);
    }
  }

  // Lid: open toward the reader, with the fixed planet pins.
  const lid = part('lid', 'Lid and planet carrier', 'The lid holds the three planet pins still, which is what makes the gear multiply speed. It is cut open at the front so the basket shows.', [0, 0, 0], system);
  const lidShape = new THREE.Shape(), front = -Math.PI / 2, start = front + LID.open / 2, end = front - LID.open / 2 + TAU;
  lidShape.moveTo(LID.outer * Math.cos(start), LID.outer * Math.sin(start));
  lidShape.absarc(0, 0, LID.outer, start, end, false);
  lidShape.lineTo(LID.inner * Math.cos(end), LID.inner * Math.sin(end));
  lidShape.absarc(0, 0, LID.inner, end, start, true);
  lidShape.holes.push(new THREE.Path().absarc(BRAKE.x, 0, 4, 0, TAU, true));
  const lidGeometry = new THREE.ExtrudeGeometry(lidShape, {depth: LID.thickness, bevelEnabled: false, curveSegments: 48});
  lidGeometry.rotateX(-Math.PI / 2); lidGeometry.scale(MM, MM, MM); lidGeometry.translate(0, LID.y * MM, 0);
  surface(kit, lidGeometry, 'cream', lid);
  const carrierShape = new THREE.Shape().absarc(0, 0, LID.inner, 0, TAU, false);
  carrierShape.holes.push(new THREE.Path().absarc(0, 0, 3.5, 0, TAU, true));
  const carrierGeometry = new THREE.ExtrudeGeometry(carrierShape, {depth: LID.thickness, bevelEnabled: false, curveSegments: 48});
  carrierGeometry.rotateX(-Math.PI / 2); carrierGeometry.scale(MM, MM, MM); carrierGeometry.translate(0, LID.y * MM, 0);
  const carrierPlate = surface(kit, carrierGeometry, 'metal', lid);
  carrierPlate.geometry.computeBoundingBox();
  const carrierTop = carrierPlate.geometry.boundingBox.max.y,carrierBottom=carrierPlate.geometry.boundingBox.min.y;
  const pins = [0, 1, 2].map(() => kit.cylinder(1.4 * MM, 6 * MM, [0, carrierTop + 3 * MM, 0], 'ink', lid));

  const basketBearing=part('basket-bearing','Basket bearing collar and supports','A stationary bored collar surrounds the rotating clutch race with a small radial clearance. Three posts attach it to the lid carrier; the bottom pivot takes the basket weight.',[0,0,0],clutch);
  const bearingProfile=[[16.2,112],[18,112],[18,115],[16.2,115],[16.2,112]].map(([x,y])=>new THREE.Vector2(x*MM,y*MM));
  surface(kit,new THREE.LatheGeometry(bearingProfile,64),'metal',basketBearing,true);
  const bearingPosts=[];
  for(let i=0;i<3;i++){const a=i*TAU/3,x=17*Math.cos(a)*MM,z=-17*Math.sin(a)*MM;bearingPosts.push(kit.rod([x,115*MM,z],[x,carrierBottom,z],1.2*MM,'metal',basketBearing));}

  const brakePart = part('brake', 'Spring-loaded basket brake', 'A guided plunger pushes a friction pad onto the basket rim after cranking. The spring lifts it clear when released. The model assigns a constant braking torque; it does not derive friction from this drawing.', [0,0,0], lid);
  const guideProfile=[[3.4,124],[6,124],[6,130],[3.4,130],[3.4,124]].map(([x,y])=>new THREE.Vector2(x*MM,y*MM));
  const brakeGuide=surface(kit,new THREE.LatheGeometry(guideProfile,32),'metal',brakePart,true);brakeGuide.position.x=BRAKE.x*MM;
  const brakePlunger=part('brake-plunger','Brake button, stem and pad','One rigid plunger runs through the bored lid guide. At contact its pad touches the top of the basket hoop.',[BRAKE.x*MM,0,0],brakePart);
  const brakePad=kit.box([12*MM,BRAKE.padHeight*MM,12*MM],[0,(BRAKE.contactY+BRAKE.padHeight/2)*MM,0],'ink',brakePlunger);
  kit.cylinder(3*MM,(BRAKE.buttonBottom-BRAKE.contactY-BRAKE.padHeight)*MM,[0,(BRAKE.buttonBottom+BRAKE.contactY+BRAKE.padHeight)/2*MM,0],'metal',brakePlunger);
  kit.cylinder(10*MM,5*MM,[0,(BRAKE.buttonBottom+2.5)*MM,0],'clay',brakePlunger);
  const brakeSpring=kit.spring([BRAKE.x*MM,130*MM,0],4.5*MM,8*MM,4,brakePart,.45*MM);


  // The gear train sits on the lid.
  const gears = part('gears', 'Epicyclic gear train', 'Ring, planets and sun, with the planet carrier held by the lid. The sun turns the ring’s tooth count over its own times as fast, the other way.', [0, GEAR.y * MM, 0], system);
  const gearGeometry = shape => {
    const geometry = new THREE.ExtrudeGeometry(shape, {depth: GEAR.thickness, bevelEnabled: false, curveSegments: 6});
    geometry.rotateX(-Math.PI / 2);
    geometry.scale(MM, MM, MM);
    return geometry;
  };
  const moduleMm = C.module * 1000, ringPitch = moduleMm * C.ringTeeth / 2;
  const ring = part('ring', 'Gear ring and crank', 'The crank turns this 72-tooth internal gear directly. Its teeth drive the three planets from outside.', [0, 0, 0], gears);
  const ringMesh = surface(kit, gearGeometry(ringGearShape({teeth: C.ringTeeth, module: moduleMm, rim: ringPitch + 1.25 * moduleMm + GEAR.rim})), 'gold', ring);
  kit.rod([0, (GEAR.thickness + CRANK.height) * MM, 0], [CRANK.radius * MM, (GEAR.thickness + CRANK.height) * MM, 0], 2.5 * MM, 'gold', ring);
  const crankSupportRadius = ringPitch + 1.25 * moduleMm + GEAR.rim / 2;
  const crankSupport = kit.rod([crankSupportRadius * MM, GEAR.thickness * MM, 0], [crankSupportRadius * MM, (GEAR.thickness + CRANK.height) * MM, 0], 2 * MM, 'gold', ring);
  kit.cylinder(5 * MM, CRANK.knob * MM, [CRANK.radius * MM, (GEAR.thickness + CRANK.height + CRANK.knob / 2) * MM, 0], 'wood', ring);
  const handArrow = solidArrow(kit, HAND_COLOR, ring, 0.9 * MM);
  handArrow.position.set(CRANK.radius * MM, (GEAR.thickness + CRANK.height + CRANK.knob / 2) * MM, 7 * MM);
  handArrow.userData.setDirection(new THREE.Vector3(0, 0, -1));

  const planets = part('planets', 'Planet gears', 'Three gears on pins fixed in the lid. Each meshes with the sun inside and the ring outside and turns the same way as the ring.', [0, 0, 0], gears);
  const planetGroups = [0, 1, 2].map(() => { const group = new THREE.Group(); planets.add(group); return group; });
  const planetMeshes = planetGroups.map(group => surface(kit, new THREE.BufferGeometry(), 'clay', group));
  const sun = part('sun', 'Sun gear and drive shaft', 'The small central gear. Its shaft goes down through the lid to the basket.', [0, 0, 0], gears);
  const sunMesh = surface(kit, new THREE.BufferGeometry(), 'leaf', sun);
  kit.cylinder(3 * MM, (GEAR.y - 109) * MM, [0, -(GEAR.y - 109) / 2 * MM, 0], 'metal', sun);
  const clutchDrive = part('clutch-drive', 'Clutch drive from the sun shaft', 'The sun shaft carries the ramps and guides. It stops with the crank while the outer race can keep turning with the basket.', [0,109*MM,0],clutch);
  const cam = part('clutch-cam','Shaft ramps and roller guides','Ramps on the drive shaft trap rollers in the narrow gap while driving. Small guides retain them in the clutch during freewheeling.',[0,0,0],clutchDrive);
  kit.cylinder(6*MM,3*MM,[0,1.5*MM,0],'metal',cam);
  const normal=[Math.cos(CLUTCH.angle),-Math.sin(CLUTCH.angle)],rollerCenter=CLUTCH.inner-CLUTCH.roller,plane=normal[0]*rollerCenter-CLUTCH.roller;
  const clutchRollers=[];
  for(const side of [-1,1]){
    const rampShape=new THREE.Shape();
    [[5,-4],[(plane+4*normal[1])/normal[0],-4],[(plane-4*normal[1])/normal[0],4],[5,4]].forEach(([x,y],i)=>rampShape[i?'lineTo':'moveTo'](side*x,side*y));
    rampShape.closePath();
    const geometry=new THREE.ExtrudeGeometry(rampShape,{depth:3,bevelEnabled:false});geometry.rotateX(-Math.PI/2);geometry.scale(MM,MM,MM);surface(kit,geometry,'gold',cam);
    // These guides retain the roller without spanning the rotating outer race.
    for(const angle of [-.5,.25]){
      const x=side*rollerCenter*Math.cos(angle)*MM,z=-side*rollerCenter*Math.sin(angle)*MM;
      kit.cylinder(.5*MM,4*MM,[x,2*MM,z],'metal',cam);
      kit.rod([0,4.25*MM,0],[x,4.25*MM,z],.5*MM,'metal',cam);
    }
    const roller=part(side===1?'roller-one':'roller-two',side===1?'First clutch roller':'Second clutch roller','Wedged between shaft ramp and basket race while driving; released into the wider part of the gap while coasting.',[0,1.5*MM,0],clutchDrive);
    kit.cylinder(CLUTCH.roller*MM,3*MM,[0,0,0],'ink',roller);
    kit.box([3*MM,.2*MM,.5*MM],[0,1.6*MM,0],'cream',roller);
    clutchRollers.push({object:roller,side});
  }

  // Drops and their straight paths out.
  const dropsPart = part('drops', 'Water drops', 'Each dot is an equal share of the water on the leaves. A drop that leaves travels in a straight line along the direction the basket was carrying it, not straight outward; the thin lines show those paths.', [0, 0, 0], system);
  const dropSphere = kit.sphere(1, [0, 0, 0], 'blue', dropsPart);
  const dropMaterial = dropSphere.material.clone();
  dropMaterial.color.set(WATER_COLOR);
  const dropMesh = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 10, 8), dropMaterial, DROPS);
  dropSphere.geometry.dispose();
  dropsPart.remove(dropSphere);
  dropsPart.add(dropMesh);
  dropMesh.frustumCulled = false;
  const tracesGeometry = new THREE.BufferGeometry();
  tracesGeometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(DROPS * 6), 3));
  const traces = new THREE.LineSegments(tracesGeometry, new THREE.LineBasicMaterial({color: WATER_COLOR}));
  traces.frustumCulled = false;
  dropsPart.add(traces);

  // Chart: water left against the fastest speed reached.
  const chart = part('chart', 'Water left against basket speed', 'The share of the water left on the salad after spinning at a given top speed, from 0 to 1,200 rpm. The dot is this trial. It stands behind the spinner and is not drawn at its scale.', [-CHART.width / 2 * MM, CHART.y * MM, CHART.z * MM], system);
  chart.userData.explosionExcluded=true;
  kit.box([(CHART.width + 48) * MM, (CHART.height + 64) * MM, 0.8 * MM], [(CHART.width/2-6)*MM,(CHART.height/2-2)*MM,-MM], 'cream', chart);
  caption('Water remaining (%)',CHART.width/2,CHART.height+19,chart,7);
  caption('Basket speed (rpm)',CHART.width/2,-20,chart,6);
  for(const value of [0,600,1200])caption(String(value),value/1200*CHART.width,-8,chart,5);
  for(const value of [0,50,100])caption(String(value),-13,value/100*CHART.height,chart,5);
  caption('Dot: fastest speed reached',CHART.width/2,CHART.height+7,chart,4.8);
  caption('Line: speed now',CHART.width/2,-30,chart,4.8);
  kit.rod([0, 0, 0], [CHART.width * MM, 0, 0], 0.4 * MM, 'ink', chart);
  kit.rod([0, 0, 0], [0, CHART.height * MM, 0], 0.4 * MM, 'ink', chart);
  const chartX = rpm => Math.min(rpm, CHART.maxRpm) / CHART.maxRpm * CHART.width * MM, chartY = share => share * CHART.height * MM;
  const curve = lineObject(65, WATER_COLOR, chart);
  for (let i = 0; i <= 64; i++) { const rpm = CHART.maxRpm * i / 64; curve.geometry.attributes.position.array.set([chartX(rpm), chartY(waterLeftShare(rpm * TAU / 60)), 0.3 * MM], i * 3); }
  const speedLine = lineObject(2, HAND_COLOR, chart);
  const marker = kit.sphere(2.2 * MM, [0, 0, 0], 'clay', chart);
  marker.material = marker.material.clone();
  marker.material.color.set(HAND_COLOR);

  const specs = {
    sun: ['Sun gear', '', [{value: 12, label: '12 teeth: six to one'}, {value: 18, label: '18 teeth: four to one'}, {value: 24, label: '24 teeth: three to one'}], 'The ring has 72 teeth. A smaller sun turns faster for each turn of the crank, but the hand then feels the basket that many times heavier, squared.'],
    rate: ['Crank rate you aim for', 'turns/s', null, 'How fast your hand tries to turn the crank. It gets there only if your force can wind the basket up in time.'],
    force: ['Hand force on the knob', 'N', null, 'The most force your hand puts on the knob, 45 mm from the center.'],
    crank: ['Crank for', 's', null, 'How long you keep cranking before letting go.'],
    load: ['Salad in the basket', 'g', null, 'More salad is more to spin up and carries more water: one gram of water for every five grams of leaves.'],
    brake: ['After cranking', '', [{value: 0, label: 'Let it coast'}, {value: 1, label: 'Press the brake'}], 'The brake presses on the basket and turns its spin into heat. Without it, only drag slows the basket down.'],
  };
  for (const [name, [min, max, step]] of Object.entries(SPINNER_DOMAINS)) {
    const [label, unit, options, help] = specs[name];
    control(name, label, min, max, step, D[name], unit, help, options, {primary:name==='sun'});
  }

  let elapsed = 0, lastClock = 0, disposed = false, teeth = null, releaseKey = '', releases = [], poolRadius = -1, planetPhases = [], sunPhase = 0;
  const releaseTimes = plan => plan.samples && drops.map(drop => {
    const samples = plan.samples;
    if (samples.at(-1).fastest < drop.release) return null;
    let lo = 0, hi = samples.length - 1;
    while (hi - lo > 1) { const mid = (lo + hi) >> 1; if (samples[mid].fastest >= drop.release) hi = mid; else lo = mid; }
    const a = samples[lo], b = samples[hi], f = b.fastest > a.fastest ? (drop.release - a.fastest) / (b.fastest - a.fastest) : 1;
    return {time: a.t + (b.t - a.t) * f, basketAngle: a.basketAngle + (b.basketAngle - a.basketAngle) * f};
  });

  const result = finish(values => {
    const s = sampleSpinner(values, elapsed), g = s.teeth, G = s.G, crankDrawn = s.crankAngle * SLOW, basketDrawn = -s.basketAngle * SLOW;

    if (teeth !== values.sun) {
      teeth = values.sun;
      const d = moduleMm * (g.sun + g.planet) / 2;
      sunMesh.geometry.dispose();
      sunMesh.geometry = gearGeometry(spurGearShape({teeth: g.sun, module: moduleMm, bore: 2.2}));
      planetPhases = [0, 1, 2].map(i => { const phi = i * TAU / 3; return phi - (phi * g.ring + Math.PI) / g.planet; });
      sunPhase = Math.PI * g.planet / g.sun;
      planetGroups.forEach((group, i) => {
        const phi = i * TAU / 3;
        group.position.set(d * Math.cos(phi) * MM, 0, -d * Math.sin(phi) * MM);
        pins[i].position.set(d * Math.cos(phi) * MM, carrierTop + 3 * MM, -d * Math.sin(phi) * MM);
        planetMeshes[i].geometry.dispose();
        planetMeshes[i].geometry = gearGeometry(spurGearShape({teeth: g.planet, module: moduleMm, bore: 1.6}));
      });
    }
    ring.rotation.y = crankDrawn;
    sun.rotation.y = sunPhase - G * crankDrawn;
    planetGroups.forEach((group, i) => { group.rotation.y = planetPhases[i] + (g.ring / g.planet) * crankDrawn; });
    basket.rotation.y = basketDrawn;
    clutchRace.rotation.y=basketDrawn;
    clutchDrive.rotation.y=-G*crankDrawn;
    const clutchReleased = s.elapsed >= values.crank;
    const rollerAngle = clutchReleased ? CLUTCH.released : 0;
    for(const {object,side} of clutchRollers){
      object.position.set(side*rollerCenter*Math.cos(rollerAngle)*MM,1.5*MM,-side*rollerCenter*Math.sin(rollerAngle)*MM);
      object.rotation.y=clutchReleased?(basketDrawn+G*crankDrawn)*CLUTCH.inner/CLUTCH.roller:0;
    }
    const brakePressed=Boolean(values.brake&&s.elapsed>=values.crank);
    brakePlunger.position.y=(brakePressed?0:BRAKE.travel)*MM;
    brakeSpring.userData.setLength((8+(brakePressed?0:BRAKE.travel))*MM);
    handArrow.userData.setLength(s.handForce * NEWTON);

    // Leaves: more salad, more leaves.
    leaves.count = Math.round(8 + (values.load - 50) / 250 * 40);

    // Drops: on the leaves until the basket first turns fast enough, then along the tangent to the bowl.
    const signature = JSON.stringify(s.values);
    if (signature !== releaseKey) { releaseKey = signature; releases = releaseTimes(s); }
    const matrix = new THREE.Matrix4(), unit = new THREE.Quaternion(), traceArray = tracesGeometry.attributes.position.array;
    let onLeaves = 0;
    drops.forEach((drop, k) => {
      const release = releases[k], size = Math.max(MIN_DROP, drop.radius * 1000) * MM;
      let x, z, visible = true, trace = null;
      const radius = drop.r * 1000;
      if (!release || release.time > elapsed) {
        const a = drop.angle + basketDrawn;
        x = radius * Math.cos(a); z = -radius * Math.sin(a);
        onLeaves++;
      } else {
        const a = drop.angle - release.basketAngle * SLOW, px = radius * Math.cos(a), pz = -radius * Math.sin(a), ux = Math.sin(a), uz = Math.cos(a);
        const reach = Math.sqrt(BOWL.radius ** 2 - radius ** 2), since = elapsed - release.time, along = Math.min(1, since / FLIGHT);
        x = px + ux * reach * along; z = pz + uz * reach * along;
        visible = along < 1;
        if (since < TRACE) trace = [px, pz, px + ux * reach, pz + uz * reach];
      }
      matrix.compose(new THREE.Vector3(x * MM, drop.height * MM, z * MM), unit, new THREE.Vector3().setScalar(visible ? size : 0));
      dropMesh.setMatrixAt(k, matrix);
      traceArray.set(trace ? [trace[0] * MM, drop.height * MM, trace[1] * MM, trace[2] * MM, drop.height * MM, trace[3] * MM] : [0, 0, 0, 0, 0, 0], k * 6);
    });
    dropMesh.instanceMatrix.needsUpdate = true;
    dropMesh.computeBoundingSphere();
    tracesGeometry.attributes.position.needsUpdate = true;
    tracesGeometry.computeBoundingSphere();

    // The pool: a quarter-round fillet in the bowl's corner holding the water thrown off.
    // Pappus: a quarter-round of radius f whose centroid sits 4f/3pi inside the
    // bowl wall holds (pi^2 R / 2) f^2 - (2 pi / 3) f^3; solve that for f.
    const volume = s.waterOff / C.waterDensity * 1e9;
    let fillet = Math.sqrt(2 * volume / (Math.PI * Math.PI * BOWL.radius));
    for (let i = 0; i < 6 && fillet > 0; i++) {
      const held = Math.PI * Math.PI * BOWL.radius / 2 * fillet ** 2 - 2 * Math.PI / 3 * fillet ** 3, slope = Math.PI * Math.PI * BOWL.radius * fillet - 2 * Math.PI * fillet ** 2;
      fillet -= (held - volume) / slope;
    }
    if (Math.abs(fillet - poolRadius) > 1e-6) {
      poolRadius = fillet;
      poolMesh.geometry.dispose();
      const points = [new THREE.Vector2(BOWL.radius * MM, BOWL.bottom * MM)];
      for (let i = 0; i <= 12; i++) { const t = i / 12 * Math.PI / 2; points.push(new THREE.Vector2((BOWL.radius - fillet * Math.cos(t)) * MM, (BOWL.bottom + fillet * Math.sin(t)) * MM)); }
      points.push(new THREE.Vector2(BOWL.radius * MM, BOWL.bottom * MM));
      poolMesh.geometry = new THREE.LatheGeometry(points, 64);
      poolMesh.visible = fillet > 0.05;
    }

    const speed = s.rpm;
    speedLine.geometry.attributes.position.array.set([chartX(speed), 0, 0.5 * MM, chartX(speed), CHART.height * MM, 0.5 * MM]);
    speedLine.geometry.attributes.position.needsUpdate = true;
    speedLine.geometry.computeBoundingSphere();
    marker.position.set(chartX(s.fastest * 60 / TAU), chartY(s.waterShare), 0.8 * MM);

    const grams = mass => fixed(mass * 1000, 1);
    const outcome = {
      ready: 'Ready · wet salad in the basket; press Play to crank',
      'spinning up': `Spinning up · ${fixed(speed, 0)} rpm and climbing`,
      holding: `Holding ${fixed(speed, 0)} rpm · drops with radii above ${fixed(s.wallDrop * 1000, 2)} mm have left the wall`,
      coasting: `Crank stopped · coasting at ${fixed(speed, 0)} rpm`,
      braking: `Crank stopped · braking from ${fixed(speed, 0)} rpm`,
      stopped: `Stopped · ${grams(s.waterLeft)} g of the ${fixed(s.water * 1000, 0)} g of water still on the salad`,
    }[s.mode];
    return {
      state: {...s, brakePressed, clutchReleased, dropsOnLeaves: onLeaves, poolRadius, releases},
      readings: [
        r('Your result', outcome, 'This trial first cranks, then releases the drive and either brakes or coasts to rest.'),
        r('Trial time', `${fixed(s.elapsed,2)} s`, 'Elapsed physical time. Gear rotation is drawn 20 times slower so its motion is readable.'),
        r('Clutch', clutchReleased?'Freewheeling':s.elapsed>0?'Driving basket':'Ready to drive', clutchReleased?'The basket race overruns the stopped shaft. The rollers sit in wider gaps instead of transmitting torque.':'The rollers wedge against the shaft ramps when cranking starts. The basket follows the sun gear.'),
        r('Brake', brakePressed?'Pad pressed against basket':'Pad clear of basket', brakePressed?`The spring-loaded plunger is held down. While the basket turns, the assigned ${fixed(C.brakeTorque,2)} N·m torque turns spin energy into heat.`:'The spring raises the pad. A visible gap leaves the basket free to turn.'),
        r('Basket speed', `${fixed(speed, 0)} rpm`, `During cranking the sun, and the basket with it, turns ${fixed(G, 0)} times as fast as the crank and the other way. When the crank stops, the one-way clutch lets the basket run on.`),
        r('Water left on the salad', `${grams(s.waterLeft)} g of ${fixed(s.water * 1000, 0)} g`, `${fixed(s.waterShare * 100, 0)}%: a film no spinning removes, plus every drop too small to leave at the fastest speed so far.`),
        r('Smallest drop radius thrown off', s.fastest > 0 ? `${fixed(s.wallDrop * 1000, 2)} mm at the wall` : 'none yet', s.fastest > 0 ? `For the ideal hemispherical drops, a larger radius needs more pull to stay on its circle than surface tension can give it. Leaves nearer the middle turn on a smaller circle and keep drops up to ${fixed(s.innerDrop * 1000, 2)} mm.` : 'No drops have left before the basket starts moving. The threshold is a radius, not a diameter.'),
        r('Pull needed at the wall', `${fixed(s.wallAcceleration / 9.81, 0)} g`, 'Speed squared times the 110 mm radius, in multiples of gravity. Twice the speed needs four times the pull.'),
        r('Gear ratio', `${fixed(G, 0)} to 1, reversed`, `The ${g.ring}-tooth ring over the ${g.sun}-tooth sun. The ${g.planet}-tooth planets turn on fixed pins and only pass the motion on.`),
        r('Crank', `${fixed(s.crankRate, 2)} turns a second`, 'Actual input speed. It rises toward the requested rate while hand torque accelerates the basket, then falls to zero when the hand lets go.'),
        r('Hand force on the knob', `${fixed(s.handForce, 1)} N`, `Spinning up takes all the force you give: through a ${fixed(G, 0)} to 1 gear the basket feels ${fixed(G * G, 0)} times heavier to turn. Holding speed only has to beat drag.`),
        r('Planet gears', `${fixed(s.planetRate, 2)} turns a second on their pins`, 'Their pins stay fixed in the lid. They spin in the same direction as the ring and reverse the sun.'),
        r('Energy in the spinning basket', `${fixed(s.kinetic, 2)} J`, 'One half times the fixed model inertia times angular speed squared. The small change of inertia as water leaves is neglected.'),
        r('Work by your hand', `${fixed(s.handWork, 2)} J`, `The basket holds ${fixed(s.kinetic, 2)} J; drag has taken ${fixed(s.dragWork, 2)} J${s.brake ? ` and the brake ${fixed(s.brakeWork, 2)} J` : ''}.`),
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
    root.rotation.set(.5,-.3,0);
    return render(result.defaults);
  };
  const inspect = (label, at) => ({label, group:'Run stages', part: 'system', view: 'front', replay: false, run() { root.rotation.set(.5,-.3,0);elapsed = Math.min(C.duration, Math.max(0, at(result.getState()))); return render(); }});
  result.actions = [
    inspect('Inspect: spinning up', () => 0.8),
    inspect('Inspect: top speed', s => s.values.crank - 0.05),
    inspect('Inspect: crank let go', s => s.values.crank + 0.5),
    inspect('Inspect: at rest', s => s.stoppedAt ?? C.duration),
    inspect('Inspect: 20 seconds', () => 20),
    ...[
      ['See the gear train','gears','top',false],
      ['See the one-way clutch','clutch','top',true],
      ['See the basket brake','brake','front',false],
      ['Read the drying chart','chart','front',true],
      ['Whole spinner','system','front',false],
    ].map(([label,part,view,isolate])=>({label,part,view,isolate,group:'Look closer',replay:false,run(){root.rotation.set(...(part==='system'?[.5,-.3,0]:[0,0,0]));return render();}})),
  ];
  result.playback = {
    label: 'Crank the spinner',
    description: 'Your hand winds the crank up to the rate you aim for, cranks for the time you set, then lets go. Drops leave as soon as the basket is fast enough for them. The turning parts are drawn 20 times slower than they really turn.',
    stepLabel: 'Advance by a twentieth of a second',
    advance: result.advance,
    step: () => result.advance(0.05),
    complete: () => { const s = result.getState(); return Boolean(s.complete || s.elapsed >= C.duration); },
    blocked: () => false,
  };
  result.resultPart = {id: 'pool', label: 'See the water thrown off', view: 'front', context: 'system', focusOnComplete: false, available: () => result.playback.complete()};
  result.frameBoundsForPart = id => {
    const box = new THREE.Box3();
    if (id === 'system') box.set(new THREE.Vector3(-(BOWL.radius + 5) * MM, 0, (CHART.z - 3) * MM), new THREE.Vector3((BOWL.radius + 5) * MM, (CHART.y + CHART.height + 33) * MM, (BOWL.radius + 5) * MM));
    else if(id==='brake')box.set(new THREE.Vector3(99*MM,100*MM,-10*MM),new THREE.Vector3(122*MM,151*MM,10*MM));
    else if (id === 'pool') box.set(new THREE.Vector3(-(BOWL.radius + 5) * MM, 0, -(BOWL.radius + 5) * MM), new THREE.Vector3((BOWL.radius + 5) * MM, 40 * MM, (BOWL.radius + 5) * MM));
    else return null;
    root.updateWorldMatrix(true, false);
    return box.applyMatrix4(root.matrixWorld);
  };

  root.rotation.set(0.5, -0.3, 0);
  result.initialPart = 'system';
  result.initialView = 'front';
  result.frameVisibleOnly = true;
  result.framePadding = 0.62;
  result.selectionOutline = false;
  result.transparentBackground = true;
  result.topology = {
    system, bowl, pivot, pool, poolMesh, basket, salad, leaves, clutchRace, lid, carrierPlate, pins, basketBearing, bearingPosts, brakePart, brakeGuide, brakePlunger, brakePad, brakeSpring, gears, ring, ringMesh, crankSupport, planets, planetGroups, planetMeshes, sun, sunMesh, clutch, clutchDrive, cam, clutchRollers, dropsPart, dropMesh, traces, chart, curve, speedLine, marker, handArrow,
    drops, MM, SLOW, FLIGHT, TRACE, NEWTON, BOWL, BASKET, GEAR, CRANK, CHART, CLUTCH, BRAKE, MIN_DROP,
    captions, captionTextures,
    phases: () => ({sun: sunPhase, planets: planetPhases}),
  };
  const dispose = result.dispose;
  result.dispose = () => { if (!disposed) { disposed = true; captionTextures.forEach(texture=>texture.dispose());dispose(); } };
  return result;
}

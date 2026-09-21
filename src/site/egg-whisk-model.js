import * as THREE from 'three';
import {houseModel, reading as r} from './house-model-kit.js';
import {fixed} from './format.js';
import {solidArrow} from './scene-kit.js';
import {whiskBevelSpec, whiskBevelBody, whiskBevelTeeth} from './whisk-bevel-geometry.js';
import {BEATER_SHAPE, bowlWithMixture, beaterWire} from './beaters-scene.js';
import {sampleEggWhisk, MIXTURES, WHISK_GEARS, WHISK_DEFAULTS as D, WHISK_DOMAINS, WHISK} from './beaters-physics.js';

// ---------------------------------------------------------------------------
// Egg whisk: a crank, a double-sided crown wheel, two bevel pinions.
//
// Scale: one millimeter is 0.01 scene units. Playback runs at one quarter of real speed; angles follow the trial clock.
//
// Arrows: the hand's force on the crank knob, and beside it in a paler color
// the most the hand can give, both 2 mm of arrow per newton.
//
// The two bevel pairs share their own cone apex at the shaft-axis intersection.
// Tooth profiles have 0.05 mm combined pitch backlash; the driven pinion is
// seated on its driving flank. All gear options keep the same beater spacing.

const MM = 0.01;
const FORCE_SCALE = 2 * MM;
const TAU = Math.PI * 2;
const MODULE = 2.5;
const PINION = {teeth: 12, radius: 15};
const CROWN = {y: 200};
const SHAFT_Z = BEATER_SHAPE.spacing / 2;
const CRANK = {radius: WHISK.crank * 1000, z: 45, knob: 25};
const LOADED_PHASE = 0.05 / PINION.radius;
const HAND = 0xd9822b;
const PLAYBACK_RATE = 0.25;

/** Crown pitch radius for a gear option. */
export const crownRadius = gear => MODULE * WHISK_GEARS[gear].crown / 2;

/** Tooth phases: 0 when a tooth is centered on the contact, 0.5 when a space is. */
const frac = x => x - Math.floor(x);
export function toothPhases({crownAngle, front, back, crownTeeth}) {
  return {
    crown: frac((-Math.PI / 2 - crownAngle) * crownTeeth / TAU),
    front: frac((Math.PI / 2 - front) * PINION.teeth / TAU),
    back: frac((-Math.PI / 2 - back) * PINION.teeth / TAU),
  };
}

export function createEggWhiskModel() {
  const kit = houseModel('Egg whisk'), {root, part, control, finish, covers} = kit;
  const system = part('system', 'Egg whisk', 'A hand crank turns a large crown wheel with teeth on both faces. Two small bevel pinions, one on each face, spin the beaters much faster and in opposite directions.');
  const bowl = bowlWithMixture(kit, system, covers, MM);

  const frame = part('frame', 'Frame and handle', 'Holds the crown wheel’s axle and the two beater shafts, and gives the other hand something to hold.', [0, 0, 0], system);
  const frameTube = kit.tube([[0, 295, -12.5], [-95, 295, -12.5], [-95, 97, -12.5], [0, 97, 0]].map(q => q.map(v => v * MM)), 2 * MM, 'metal', frame);
  const bearingShape = new THREE.Shape().moveTo(-3, -30).lineTo(3, -30).lineTo(3, 30).lineTo(-3, 30).closePath();
  for (const z of [-SHAFT_Z, SHAFT_Z]) bearingShape.holes.push(new THREE.Path().absarc(0, z, 2.3, 0, TAU, true));
  const bearingPart=part('bearings','Shaft bearings','The two shafts turn inside 4.6 mm holes in this fixed crossbar. The 3.6 mm shafts have 0.5 mm radial clearance.',[0,0,0],frame);
  const bearings = new THREE.Mesh(new THREE.ExtrudeGeometry(bearingShape, {depth:4,bevelEnabled:false,curveSegments:32}).rotateX(Math.PI/2).translate(0,99,0).scale(MM,MM,MM), frameTube.material);
  bearingPart.add(bearings);
  kit.box([12 * MM, 110 * MM, 3 * MM], [0, 250 * MM, -12.5 * MM], 'metal', frame);
  kit.cylinder(9 * MM, 90 * MM, [0, 345 * MM, -12.5 * MM], 'wood', frame);
  const axle = kit.rod([0, CROWN.y * MM, -14 * MM], [0, CROWN.y * MM, (CRANK.z + 2) * MM], 2.5 * MM, 'metal', frame);

  const drive=part('drive','Crown wheel and pinions','One crown wheel drives two bevel pinions. These three mating gears stay together as a category when separated.',[0,0,0],system);
  const crown = part('crown', 'Crown wheel and crank', 'The large wheel has bevel teeth on both faces. Its sleeve turns around the fixed axle; the crank turns the sleeve and wheel together.', [0, CROWN.y * MM, 0], drive);
  const crankShape = new THREE.Shape().absarc(0, 0, 6, 0, TAU, false);
  crankShape.holes.push(new THREE.Path().absarc(0,0,3,0,TAU,true));
  const hub = new THREE.Mesh(new THREE.ExtrudeGeometry(crankShape,{depth:54,bevelEnabled:false,curveSegments:32}).translate(0,0,-9).scale(MM,MM,MM),frameTube.material);
  crown.add(hub);
  const crankRod = kit.rod([5*MM,0,CRANK.z*MM],[CRANK.radius*MM,0,CRANK.z*MM],3*MM,'gold',crown);
  kit.cylinder(7 * MM, CRANK.knob * MM, [CRANK.radius * MM, 0, (CRANK.z + CRANK.knob / 2) * MM], 'wood', crown).rotation.x = Math.PI / 2;
  const crownFaces = [1,-1].map(face => {
    const group = new THREE.Group();
    group.position.z=face*SHAFT_Z*MM;
    if(face===1)group.rotation.x=Math.PI;
    group.scale.setScalar(MM);
    crown.add(group);
    return {group,face};
  });
  const handArrow = solidArrow(kit, HAND, crown, 1 * MM);
  handArrow.position.set(CRANK.radius * MM, 0, (CRANK.z + CRANK.knob + 4) * MM);
  handArrow.userData.setDirection(new THREE.Vector3(0, 1, 0));
  // The pale arrow beside it is the most the hand can give, on the same scale.
  const limitArrow = solidArrow(kit, 0xf0c89a, crown, 0.5 * MM);
  limitArrow.position.set((CRANK.radius + 8) * MM, 0, (CRANK.z + CRANK.knob + 4) * MM);
  limitArrow.userData.setDirection(new THREE.Vector3(0, 1, 0));

  const beaterPair=part('beater-pair','Both beaters','Two shafts and their interleaved blades. Orange and blue dots let you follow their opposite rotations.',[0,0,0],system);
  const makeSide = (id, label, z) => {
    const side = part(id,label,'The shaft carries rotation from its pinion to its wire beater. The two shafts turn at equal speed in opposite directions.',[0,0,z*MM],beaterPair);
    const pinion = part(`${id}-pinion`,z>0?'Front bevel pinion':'Back bevel pinion','Twelve shaped teeth turn with this shaft. Its cone meets the crown face at right angles.',[0,0,z*MM],drive);
    const beater = part(`${id}-blades`,z>0?'Front beater blades':'Back beater blades','Two wire loops overlap the other beater. Gear timing keeps their four blades clear of each other.',[0,0,0],side);
    const material=crankRod.material.clone();material.color.set(z>0?0xce825f:0x83b4c1);
    const gear = new THREE.Group();
    gear.rotation.x=Math.PI/2;
    gear.scale.setScalar(MM);
    pinion.add(gear);
    pinion.position.y=CROWN.y*MM;
    const shaft = kit.cylinder(1.8 * MM, 1, [0, 0, 0], 'metal', side);
    beater.position.y = BEATER_SHAPE.bottom * MM;
    beaterWire(kit, beater, MM);
    const marker=kit.sphere(2*MM,[BEATER_SHAPE.radius*MM,BEATER_SHAPE.height/2*MM,0],z>0?'clay':'blue',beater);
    return {side, pinion, gear, beater, shaft, marker, material};
  };
  const front = makeSide('front-beater', 'Front shaft and beater', SHAFT_Z);
  const back = makeSide('back-beater', 'Back shaft and beater', -SHAFT_Z);

  const specs = {
    rate: ['Crank rate you aim for', 'turns/s', null, 'How fast your hand tries to turn the crank. If that needs more than your force, your hand slows down.'],
    gear: ['Gears', '', WHISK_GEARS.map(({value, label}) => ({value, label})), 'Crown teeth over pinion teeth is the speed-up. The pinions keep 12 teeth; a bigger crown wheel turns them faster.'],
    mixture: ['Mixture', '', MIXTURES.map(({value, label}) => ({value, label})), 'How thick the mixture is. Foam and dough are far more viscous than water. Teaching values.'],
    force: ['Hand force you can give', 'N', null, 'The most force your hand keeps up on the crank knob, 60 mm from the axle.'],
  };
  for (const [name, [min, max, step]] of Object.entries(WHISK_DOMAINS)) {
    const [label, unit, options, help] = specs[name];
    control(name, label, min, max, step, D[name], unit, help, options, {primary:name==='gear'});
  }

  let elapsed = 0, lastClock = 0, disposed = false, gearShown = null, phases = null;
  const result = finish(values => {
    const s = sampleEggWhisk(values, elapsed), gear = WHISK_GEARS[values.gear], Rc = crownRadius(values.gear), G = s.G;
    if (gearShown !== values.gear) {
      gearShown = values.gear;
      const crownSpec=whiskBevelSpec(gear.crown,12), pinionSpec=whiskBevelSpec(12,gear.crown);
      for(const face of crownFaces){
        for(const mesh of [...face.group.children]){mesh.geometry.dispose();mesh.dispose?.();face.group.remove(mesh);}
        face.spec=crownSpec;
        face.body=new THREE.Mesh(whiskBevelBody(crownSpec,3,SHAFT_Z),crankRod.material);
        face.teeth=whiskBevelTeeth(crownSpec,crankRod.material);
        face.group.add(face.body,face.teeth);
      }
      for (const side of [front, back]) {
        for(const mesh of [...side.gear.children]){mesh.geometry.dispose();mesh.dispose?.();side.gear.remove(mesh);}
        side.spec=pinionSpec;
        side.body=new THREE.Mesh(whiskBevelBody(pinionSpec,1.8),side.material);
        side.teeth=whiskBevelTeeth(pinionSpec,side.material);
        side.gear.add(side.body,side.teeth);
        const shaftTop=CROWN.y-(pinionSpec.distance-pinionSpec.width)*Math.cos(pinionSpec.root)+2;
        side.shaft.scale.set(1,(shaftTop-BEATER_SHAPE.bottom-BEATER_SHAPE.height)*MM,1);
        side.shaft.position.y=(shaftTop+BEATER_SHAPE.bottom+BEATER_SHAPE.height)/2*MM;
      }
      // The loaded flank offsets take up pitch backlash; blade timing stays fixed.
      const crownPhase = frac(-gear.crown / 4);
      phases = {
        front: Math.PI / 2 - (0.5 - crownPhase) * TAU / PINION.teeth + LOADED_PHASE,
        back: -Math.PI / 2 - (0.5 + crownPhase) * TAU / PINION.teeth - LOADED_PHASE,
        frontBeater: 0,
        backBeater: Math.PI / 4,
      };
    }
    const crownAngle = s.crankAngle;
    crown.rotation.z = crownAngle;
    const spin = G * crownAngle;
    front.pinion.rotation.y = phases.front - spin;
    back.pinion.rotation.y = phases.back + spin;
    front.beater.rotation.y = phases.frontBeater - spin;
    back.beater.rotation.y = phases.backBeater + spin;
    handArrow.userData.setLength(s.handForce * FORCE_SCALE);
    limitArrow.userData.setLength(values.force * FORCE_SCALE);
    bowl.set(values.mixture);

    const flow = s.reynolds < 10 ? 'mostly viscous drag' : s.reynolds > 1000 ? 'mostly inertial drag' : 'mixed drag';
    const outcome = s.mode === 'ready'
      ? 'Ready · press Play to turn the crank'
      : s.limited
        ? `Your hand slows to ${fixed(s.rate, 2)} turns a second · aiming for ${fixed(values.rate, 2)} would need ${fixed(s.wantedForce, 1)} N`
        : `Beating at ${fixed(s.beaterRate * 60, 0)} rpm · ${fixed(s.handForce, 1)} N on the crank`;
    return {
      state: {...s, crownAngle, phases, pinionY: CROWN.y - Rc},
      readings: [
        r('Your result',s.complete?`Eight-second trial complete · ${outcome}`:outcome,'This is a steady-speed prediction. Play shows eight seconds at one quarter speed; completion freezes that record, without a modeled coast to rest.'),
        r('Trial time',`${fixed(s.elapsed,2)} s`,'Time in the experiment. One second here takes four seconds on screen, so the gear and blade directions remain visible.'),
        r('Beater speed', `${fixed(s.beaterRate * 60, 0)} rpm each, opposite ways`, `The crank rate times ${gear.crown} over ${gear.pinion}. The pinions mesh with opposite faces of the crown wheel, so the beaters turn opposite ways.`),
        r('Force on the crank', `${fixed(s.handForce, 1)} N`, `Both beaters’ torque, times the ${fixed(G, 0)} to 1 speed-up, over the gears’ 95% efficiency and the 60 mm grip. In a thick mixture the torque grows with speed, so the force grows about as the ratio squared.`),
        r('Your hand can give', `${fixed(values.force, 0)} N`, 'The pale arrow beside the orange one, on the same scale.'),
        r('Crank rate', `${fixed(s.rate, 2)} turns a second`, s.limited ? 'Your force limit holds the crank below the rate you aimed for.' : 'The hand can hold its aimed rate. This predicted operating speed applies while cranking.'),
        r('Torque on each beater', `${fixed(s.beaterTorque * 1000, 1)} N·mm`,'Each beater takes its share of mixture power divided by its angular speed. Equal loads give equal torque magnitudes.'),
        r('Power into the mixture', `${fixed(2 * s.beaterPower, 2)} W`, `Your hand supplies ${fixed(s.handPower, 2)} W; the rest warms the gears.`),
        r('Flow around the beaters', `${flow}, Reynolds number ${fixed(s.reynolds, 0)}`, 'Re = density × turns per second × diameter squared / viscosity. These ranges describe this teaching drag curve, not measured foam behavior.'),
        r('Beater turns so far', `${fixed(s.beaterTurns, 2)} each`,'Actual crank turns times the gear ratio. Orange and blue dots mark the two blades so their opposite directions can be followed.'),
        r('Work by your hand', `${fixed(s.work, 2)} J`,'Hand power times trial time. Both beaters share 95% of it; the model assigns the remaining 5% to gear loss.'),
      ],
    };
  });

  const render = result.update;
  result.update = next => { const before=result.getState().values;const readings=render(next);if(Object.keys(before).some(key=>before[key]!==result.getState().values[key])){elapsed=0;return render();}return readings; };
  result.advance = dt => { if (Number.isFinite(dt) && dt > 0) elapsed = Math.min(WHISK.duration, elapsed + dt); return render(); };
  result.animate = t => { const dt = Number.isFinite(t) ? Math.max(0, t - lastClock) : 0; if (Number.isFinite(t)) lastClock = t; return result.advance(dt*PLAYBACK_RATE); };
  result.reset = () => { elapsed = lastClock = 0; root.rotation.set(.15,-.65,0); return render(result.defaults); };
  result.actions = [
    ...[1,4,8].map(time=>({label:`Inspect: after ${time} ${time===1?'second':'seconds'}`,group:'Run stages',part:'system',view:'front',replay:false,run(){elapsed=time;root.rotation.set(.15,-.65,0);return render();}})),
    ...[
      ['See the front gear contact','front-beater-pinion','front'],
      ['See the back gear contact','back-beater-pinion','back'],
      ['See the blades from above','beater-pair','top'],
      ['See the shaft bearings','bearings','front'],
      ['Whole egg whisk','system','front'],
    ].map(([label,part,view])=>({label,part,view,isolate:part==='beater-pair',group:'Look closer',replay:false,run(){root.rotation.set(...(part==='system'?[.15,-.65,0]:part.includes('pinion')?[.12,-.4,0]:part==='bearings'?[.25,-.8,0]:[0,0,0]));return render();}})),
  ];
  result.playback = {
    label: 'Turn the crank',
    description: 'Eight seconds of cranking, shown at one quarter speed. Orange and blue blade dots turn opposite ways. Your hand slows if the mixture needs more force than you can give.',
    stepLabel: 'Advance by a hundredth of a trial second',
    advance: dt => result.advance(dt*PLAYBACK_RATE),
    step: () => result.advance(0.01),
    complete: () => Boolean(result.getState().complete),
    blocked: () => false,
  };
  result.resultPart={id:'beater-pair',label:'Inspect the beaters',view:'top',focusOnComplete:false,available:()=>Boolean(result.getState().complete)};
  result.frameBoundsForPart = id => {
    const y=CROWN.y-crownRadius(result.getState().values.gear);
    let bounds;
    if(id==='system')bounds=[[-103,0,-98],[103,392,98]];
    else if(id==='front-beater-pinion')bounds=[[-25,y-8,-4],[25,y+28,45]];
    else if(id==='back-beater-pinion')bounds=[[-25,y-8,-45],[25,y+28,4]];
    else if(id==='beater-pair')bounds=[[-34,5,-55],[34,76,55]];
    else if(id==='bearings')bounds=[[-18,80,-35],[18,115,35]];
    else return null;
    root.updateWorldMatrix(true,false);
    return new THREE.Box3(new THREE.Vector3(...bounds[0]).multiplyScalar(MM),new THREE.Vector3(...bounds[1]).multiplyScalar(MM)).applyMatrix4(root.matrixWorld);
  };

  root.rotation.set(0.15, -0.65, 0);
  result.initialPart = 'system';
  result.initialView = 'front';
  result.frameVisibleOnly = true;
  result.framePadding = 0.62;
  result.parts.find(part=>part.id==='beater-pair').framePadding=.4;
  result.selectionOutline = false;
  result.transparentBackground = true;
  result.topology = {system, bowl, frame, bearingPart, bearings, beaterPair, drive, axle, hub, crown, crownFaces, handArrow, limitArrow, front, back, MM, FORCE_SCALE, MODULE, PINION, CROWN, SHAFT_Z, CRANK, LOADED_PHASE, PLAYBACK_RATE};
  const dispose = result.dispose;
  result.dispose = () => { if (!disposed) { disposed = true; root.traverse(object=>{if(object.isInstancedMesh)object.dispose();});dispose(); } };
  return result;
}

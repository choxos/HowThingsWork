import * as THREE from 'three';
import {houseModel, reading as r} from './house-model-kit.js';
import {fixed} from './format.js';
import {surface, solidArrow} from './scene-kit.js';
import {spurGearShape, rackEdge, pinionOnRack} from './gear-geometry.js';
import {MM, NECK, bottleAndCork, wormPart, forceChart} from './corkscrew-scene.js';
import {sampleWingedCorkscrew, wingedCorkscrewPlan, CORK, WORMS, GRIPS, WINGED_DEFAULTS as D, WINGED_DOMAINS, WINGS} from './corkscrew-physics.js';

// ---------------------------------------------------------------------------
// Winged corkscrew: a rack between two pinion-ended wings.
//
// Scale: one millimeter is 0.02 scene units for every length.
//
// Arrows: the push on each wing and the lift on the rack share one scale,
// 0.2 mm of arrow per newton, so the rack's arrow is the leverage times the
// wings' arrows.
//
// The rack is turned, not cut: its teeth are rings around the shaft, so the
// worm can turn while the teeth stay in mesh with both pinions. Each pinion
// (14 teeth, module 2, pitch radius 14 mm) is phased to the rack by the rack's
// height, so the drawn teeth mesh at every pose. The body rests on the bottle
// lip; the pinion pins are fixed in it.
// ---------------------------------------------------------------------------

const FORCE_SCALE = 0.2 * MM;
const TAU = Math.PI * 2;
const MODULE = 2;
const TEETH = 14;
const RACK = {pitchRadius: 6, base: 60, teeth: 10};
const PINION_Y = 158;
const PINION_X = RACK.pitchRadius + WINGS.pinionRadius;
const ARM_Z = 24;
const HAND = 0xd9822b;
const LIFT_COLOR = 0x2f6690;
const CHART = {width: 110, height: 65, x: 240, y: 105, z: -60, maxForce: 100, labels:true};

/** World rotation of the right pinion for a worm tip at `tip` millimeters; the left is its mirror. */
export function rightPinionRotation(tip) {
  const shift = PINION_Y - tip - RACK.base - Math.PI * MODULE / 2;
  return pinionOnRack(TEETH, MODULE, shift) - Math.PI / 2;
}

export function createWingedCorkscrewModel() {
  const kit = houseModel('Rack-and-pinion corkscrew'), {root, part, control, finish, covers} = kit;
  const system = part('system', 'Winged corkscrew', 'A body that sits on the bottle, a central rack with the worm below it and a knob above, and two wings that end in pinions. All physical lengths use the same scale.');
  const neck = bottleAndCork(kit, system, covers, {section:true});

  const frame = part('frame', 'Body and pinion pins', 'Rests on the bottle lip and holds the two pinion pins. Its front plate is cut away so the rack and pinions show.', [0, 0, 0], system);
  const bell = [[16, NECK.top], [19, NECK.top], [19, 140], [16, 140]].map(([x, y]) => new THREE.Vector2(x * MM, y * MM));
  surface(kit, new THREE.LatheGeometry(bell, 48, Math.PI / 2, Math.PI), 'metal', frame, true);
  covers.push(surface(kit, new THREE.LatheGeometry(bell, 48, -Math.PI / 2, Math.PI), 'metal', frame, true));
  kit.box([80 * MM, 36 * MM, 2 * MM], [0, 158 * MM, -5 * MM], 'metal', frame);
  const frontPlateShape=new THREE.Shape();frontPlateShape.moveTo(-40,140);frontPlateShape.lineTo(40,140);frontPlateShape.lineTo(40,176);frontPlateShape.lineTo(-40,176);frontPlateShape.closePath();
  for(const side of [-1,1])frontPlateShape.holes.push(new THREE.Path().absarc(side*PINION_X,PINION_Y,3.7,0,TAU,true));
  const frontPlateGeometry=new THREE.ExtrudeGeometry(frontPlateShape,{depth:2,bevelEnabled:false,curveSegments:24});frontPlateGeometry.translate(0,0,4);frontPlateGeometry.scale(MM,MM,MM);
  covers.push(surface(kit,frontPlateGeometry,'metal',frame));
  const pins=[];
  for (const side of [1, -1]) {const pin=kit.cylinder(2 * MM, (ARM_Z+10) * MM, [side * PINION_X * MM, PINION_Y * MM, (ARM_Z-2)/2*MM], 'ink', frame);pin.rotation.x=Math.PI/2;pins.push(pin);}
  const stops=part('wing-stops','Lower wing stops','Fixed stops on the frame meet the lowered arms. They limit the geared lift to the distance the rack descended while screwing in.',[0,0,0],frame);
  for(const side of [-1,1])kit.box([4*MM,6*MM,(ARM_Z-2)*MM],[side*(PINION_X-4.6)*MM,142*MM,(ARM_Z+10)/2*MM],'metal',stops);

  const rack = part('rack', 'Rack, shaft and knob', 'Ring-shaped rack teeth let the shaft turn while they stay in mesh. The knob on top turns the worm in; the rack carries the pull from the pinions to the worm.', [0, 0, 0], system);
  const pitch = Math.PI * MODULE, edge = rackEdge({teeth: RACK.teeth, module: MODULE});
  const rackTop = RACK.base + RACK.teeth * pitch;
  const profile = [new THREE.Vector2(0, (CORK.wormLength) * MM), new THREE.Vector2(3.5 * MM, CORK.wormLength * MM), ...edge.map(([x, y]) => new THREE.Vector2((RACK.pitchRadius + y) * MM, (RACK.base + x + pitch / 2) * MM)), new THREE.Vector2(0, rackTop * MM)];
  const rackMesh = surface(kit, new THREE.LatheGeometry(profile, 48), 'metal', rack);
  const knob = kit.cylinder(WINGS.knob * MM, 14 * MM, [0, (rackTop + 9) * MM, 0], 'wood', rack);
  kit.cylinder(3 * MM, 4 * MM, [0, (rackTop + 1) * MM, 0], 'metal', rack);
  const worm = wormPart(kit, rack, 'The helix below the rack. Turning the knob screws it into the cork and lowers the rack, which raises the wings.');
  const liftArrow = solidArrow(kit, LIFT_COLOR, system, 1.2 * MM);
  liftArrow.userData.setDirection(new THREE.Vector3(0, 1, 0));

  const wings = [1, -1].map(side => {
    const wing = part(side > 0 ? 'right-wing' : 'left-wing', side > 0 ? 'Right wing and pinion' : 'Left wing and pinion', 'A long lever ending in a 14-tooth pinion meshed with the rack. Pushing its end square to the wing turns the pinion and lifts the rack.', [side * PINION_X * MM, PINION_Y * MM, 0], system);
    const pinionShape = spurGearShape({teeth: TEETH, module: MODULE, bore: 2.2});
    const geometry = new THREE.ExtrudeGeometry(pinionShape, {depth: 6, bevelEnabled: false, curveSegments: 6});
    geometry.translate(0, 0, -3);
    geometry.scale(MM, MM, MM);
    const pinion = surface(kit, geometry, 'gold', wing);
    // Offset the arms along their pin axes so the full grips clear the bottle
    // and body. The perpendicular force moment arm remains the wing length.
    const hubProfile=[[2.2,0],[3.5,0],[3.5,ARM_Z+2],[2.2,ARM_Z+2],[2.2,0]].map(([r,z])=>new THREE.Vector2(r*MM,z*MM));
    const hubGeometry=new THREE.LatheGeometry(hubProfile,32);hubGeometry.rotateX(Math.PI/2);
    const hub=surface(kit,hubGeometry,'gold',wing,true);
    const arm = new THREE.Group();
    arm.position.z=ARM_Z*MM;
    wing.add(arm);
    const lever = kit.cylinder(2.6 * MM, 1, [0, 0, 0], 'gold', arm);
    const paddle = kit.box([22 * MM, 10 * MM, 9 * MM], [0, 0, 0], 'wood', arm);
    const push = solidArrow(kit, HAND, arm, 1.1 * MM);
    return {side, wing, pinion, hub, arm, lever, paddle, push};
  });

  const chart = forceChart(kit, system, {id: 'chart', label: 'Push needed on each wing', description: 'Blue: the push each wing would need over the available geared stroke. Its endpoint marks the limit set by insertion depth. Orange: your force limit. Green: the tear-out threshold. The dot shows actual force and lift. Axes use newtons and millimeters; chart size is unrelated to bottle scale.', ...CHART});
  const needLine = chart.line(LIFT_COLOR), pushLine = chart.line(HAND), holdLine = chart.line(0x4f7f3a);

  const specs = {
    worm: ['Worm', '', WORMS.map(({value, label}) => ({value, label})), 'The open helix grips a wider cylinder of cork than a solid screw and rubs less as it goes in.'],
    turns: ['Turns screwed in', 'turns', null, 'Each turn of the knob drives the worm 7 mm deeper and lowers the rack as far, raising the wings.'],
    grip: ['Cork', '', GRIPS.map(({value, label}) => ({value, label})), 'How hard the neck holds the cork at the start of the pull. Teaching values, not measurements.'],
    wing: ['Push on each wing', 'N', null, 'The most force each hand puts on the end of its wing, square to the wing.'],
    length: ['Wing length', 'mm', null, 'From the pinion pin to where the hand pushes. Longer wings give more leverage and move farther.'],
  };
  for (const [name, [min, max, step]] of Object.entries(WINGED_DOMAINS)) {
    const [label, unit, options, help] = specs[name];
    control(name, label, min, max, step, D[name], unit, help, options, {primary:name==='worm'});
  }

  let elapsed = 0, lastClock = 0, disposed = false, chartKey = '', armLength = null;
  const startRotation = rightPinionRotation(NECK.top);
  const result = finish(values => {
    const s = sampleWingedCorkscrew(values, elapsed);
    neck.set({out: s.out, torn: s.torn, worm: values.worm, pierced: false, depth:s.depth});
    worm.set({type: values.worm, torn: s.torn, depth: s.depth});

    // The rack and worm: tip on the cork top, down with the turns, up with the cork.
    const tip = NECK.top - s.depthNow + s.out + s.withdrawal;
    rack.position.y = tip * MM;
    rack.rotation.y = -s.turnsDone * Math.PI * 2;

    // Pinions phased to the rack's height; the wings hang down at the start.
    const right = rightPinionRotation(tip);
    if (armLength !== values.length) {
      armLength = values.length;
      for (const w of wings) {
        w.lever.scale.set(1, values.length * MM, 1);
        w.lever.position.y = -values.length / 2 * MM;
        w.paddle.position.y = -values.length * MM;
        w.push.position.set(-w.side * 6 * MM, -values.length * MM, 0);
        w.push.userData.setDirection(new THREE.Vector3(-w.side, 0, 0));
      }
    }
    for (const w of wings) {
      const rotation = w.side > 0 ? right : Math.PI - right, start = w.side > 0 ? startRotation : Math.PI - startRotation;
      w.pinion.rotation.z = rotation;
      w.arm.rotation.z = rotation - start;
      w.push.userData.setLength(s.screwing || s.torn ? 0 : Math.min(s.applied, s.needNow || s.applied) / s.leverage * FORCE_SCALE);
    }
    const lift = s.screwing || s.torn ? 0 : Math.min(s.applied, s.needNow || s.applied);
    liftArrow.userData.setLength(lift * FORCE_SCALE);
    liftArrow.position.set(0, (tip + RACK.base - 4) * MM, 10 * MM);

    const key = JSON.stringify(values);
    if (key !== chartKey) {
      chartKey = key;
      chart.setMaxForce(Math.ceil(Math.max(values.wing,s.hold/s.leverage,s.need/s.leverage)/25)*25);
      chart.setLine(needLine, [0, s.need / s.leverage], [s.travel / CORK.length, s.need * (1 - s.travel / CORK.length) / s.leverage]);
      chart.setLine(pushLine, [0, values.wing], [1, values.wing]);
      chart.setLine(holdLine, [0, s.hold / s.leverage], [1, s.hold / s.leverage]);
    }
    chart.place(s.out / CORK.length, lift / s.leverage);

    const outcome = {
      ready: 'Ready · the worm tip rests on the cork; press Play to turn the knob',
      screwing: `Screwing in · the wings have risen ${fixed(s.wingAngle * 180 / Math.PI, 0)} degrees`,
      loading: `Pushing the wings · ${fixed(s.applied / s.leverage, 1)} N each of the ${fixed(s.need / s.leverage, 1)} N needed`,
      pulling: `The cork is rising · ${fixed(s.out, 1)} mm out`,
      lifted: `Wings down · the cork is ${fixed(s.out, 0)} mm up; the last ${fixed(s.remaining, 0)} mm come out by hand with ${fixed(s.handFinish, 0)} N`,
      freed: 'Cork out',
      torn: `The worm tore out of the cork at ${fixed(s.hold, 0)} N · the cork needs ${fixed(s.need, 0)} N`,
      stalled: `Stuck · ${fixed(values.wing, 0)} N on each wing lifts only ${fixed(s.limit, 0)} N; the cork needs ${fixed(s.need, 0)} N`,
    }[s.mode];
    return {
      state: {...s, tip, rightRotation: right, lift},
      readings: [
        r('Your result', outcome, 'Turn the knob to engage the worm, then press both wings. The result distinguishes limited geared lift, insufficient force and tear-out.'),
        r('Trial time', `${fixed(s.elapsed,2)} s`, 'One turn per second during insertion. Extraction is a prescribed quasi-static 25 mm/s, not a prediction from mass and acceleration.'),
        r('Push each wing needs now', `${fixed(s.wingNeed, 1)} N`, `The cork’s grip divided by the leverage of ${fixed(s.leverage, 1)}.`),
        r('Your push on each wing', `${fixed(s.screwing ? 0 : s.applied / s.leverage, 1)} N of ${fixed(values.wing, 0)} N`, 'Each hand pushes perpendicular to its wing. Force rises until movement or failure begins, then follows the decreasing resistance.'),
        r('Lift on the rack', `${fixed(lift, 0)} N`, 'Two wings, each pushing square to its length, turn their pinions against the rack.'),
        r('Leverage', `${fixed(s.leverage, 1)} times`, `Two wings of ${fixed(values.length, 0)} mm working pinions of 14 mm radius: 2 times ${fixed(values.length, 0)} over 14.`),
        r('Wing angle', `${fixed(s.wingAngle * 180 / Math.PI, 0)} degrees`, 'The rack’s drop over the 14 mm pinion radius, in radians, shown in degrees.'),
        r('Cork out', `${fixed(s.out, 1)} of ${fixed(CORK.length, 0)} mm`, 'The lower wing stops limit the rack stroke. Any remaining cork must be pulled from the neck by hand.'),
        r('Worm tear-out limit', `${fixed(s.hold, 0)} N`, `Before failure, cork can shear along a cylinder ${fixed(WORMS[values.worm].diameter, 0)} mm across and ${fixed(Math.min(s.depth, CORK.length), 1)} mm deep. After tear-out the worm no longer holds the remaining cork.`),
        r('Worm depth', `${fixed(s.depthNow-s.withdrawal, 1)} mm`, 'Each knob turn advances the worm by its 7 mm pitch. After tear-out, the loose worm and plug withdraw while the cork stays put; that recovery motion is prescribed.'),
        r('Turning the knob', `${fixed(s.knobForce, 1)} N on each side`, 'Screwing-in torque shared by thumb and finger pinching the 15 mm knob.'),
        r('Work lifting the cork', `${fixed(s.work, 2)} J`, `Each hand travels ${fixed(s.wingTravel/2, 0)} mm; the combined paths total ${fixed(s.wingTravel, 0)} mm. Both hands together supply the cork’s lifting work.`),
      ],
    };
  });

  const render = result.update;
  result.advance = dt => { if (Number.isFinite(dt) && dt > 0) elapsed = Math.min(result.getState().duration, elapsed + dt); return render(); };
  result.animate = t => { const dt = Number.isFinite(t) ? Math.max(0, t - lastClock) : 0; if (Number.isFinite(t)) lastClock = t; return result.advance(dt); };
  result.reset = () => { elapsed = lastClock = 0;root.rotation.set(.18,-.35,0); return render(result.defaults); };
  const inspect = (label, at) => ({label, group:'Run stages', part: 'system', view: 'front', replay: false, run() {root.rotation.set(.18,-.35,0); elapsed = Math.max(0, at(wingedCorkscrewPlan(result.getState().values))); return render(); }});
  result.actions = [
    inspect('Inspect: turning the knob', plan => Math.max(0,plan.screwTime-0.01)),
    inspect('Inspect: worm in, wings up', plan => plan.screwTime),
    inspect('Inspect: the push at its peak', plan => plan.startTime ?? plan.tearTime ?? plan.rampEnd),
    inspect('Inspect: the end', plan => plan.duration),
    ...[
      ['See the rack and pinions','rack',false],
      ['See the worm in the cork','cork',false],
      ['See the wing stops','wing-stops',false],
      ['Read the force chart','chart',true],
      ['Whole corkscrew','system',false],
    ].map(([label,part,isolate])=>({label,part,isolate,view:'front',group:'Look closer',replay:false,run(){root.rotation.set(...(part==='system'?[.18,-.35,0]:[0,0,0]));return render();}})),
  ];
  result.playback = {
    label: 'Turn the knob, press the wings',
    description: 'The knob turns once a second for the turns you set, raising the wings. Then both hands press the wings down with a force rising to your limit, and the rack lifts the cork once the lift matches its grip.',
    stepLabel: 'Advance by a tenth of a second',
    advance: result.advance,
    step: () => result.advance(0.1),
    complete: () => Boolean(result.getState().complete),
    blocked: () => false,
  };
  result.resultPart = {id: 'cork', label: 'Inspect the cork', view: 'front', context: 'system', focusOnComplete: false, available: () => Boolean(result.getState().complete)};
  result.frameBoundsForPart = id => {
    if(id==='rack'||id==='cork'){
      const s=result.getState(),bounds=id==='rack'?[[-40,138,-8],[40,180,ARM_Z+8]]:[[-22,NECK.top-CORK.length-4,-20],[22,NECK.top+s.out+12,22]];
      root.updateWorldMatrix(true,false);return new THREE.Box3(new THREE.Vector3(...bounds[0]).multiplyScalar(MM),new THREE.Vector3(...bounds[1]).multiplyScalar(MM)).applyMatrix4(root.matrixWorld);
    }
    if (id !== 'system') return null;
    const reach = PINION_X + WINGED_DOMAINS.length[1] + 12;
    root.updateWorldMatrix(true, false);
    return new THREE.Box3(new THREE.Vector3(-reach * MM, 0, (CHART.z - 2) * MM), new THREE.Vector3((CHART.x+CHART.width/2+18)*MM, (PINION_Y+WINGED_DOMAINS.length[1]+12)*MM, (ARM_Z+8) * MM)).applyMatrix4(root.matrixWorld);
  };

  root.rotation.set(0.18, -0.35, 0);
  result.initialPart = 'system';
  result.initialView = 'front';
  result.frameVisibleOnly = true;
  result.framePadding = 0.62;
  result.parts.find(part=>part.id==='system').framePadding=0.51;
  result.selectionOutline = false;
  result.transparentBackground = true;
  result.topology = {system, neck, frame, pins, stops, frontPlateShape, rack, rackMesh, knob, worm, wings, liftArrow, chart, needLine, pushLine, holdLine, FORCE_SCALE, MODULE, TEETH, RACK, PINION_X, PINION_Y, ARM_Z, startRotation};
  const dispose = result.dispose;
  result.dispose = () => { if (!disposed) { disposed = true; chart.dispose();dispose(); } };
  return result;
}

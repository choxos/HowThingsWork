import * as THREE from 'three';
import {houseModel, reading as r} from './house-model-kit.js';
import {fixed} from './format.js';
import {solidArrow} from './scene-kit.js';
import {MM, NECK, bottleAndCork, wormPart, forceChart} from './corkscrew-scene.js';
import {sampleScrewCorkscrew, screwCorkscrewPlan, CORK, WORMS, GRIPS, SCREW_DEFAULTS as D, SCREW_DOMAINS} from './corkscrew-physics.js';

// ---------------------------------------------------------------------------
// Screw corkscrew: a T-handle and a worm, pulled straight up.
//
// Scale: one millimeter is 0.02 scene units for every length.
//
// Arrows: the pull and the cork's grip share one scale, 0.1 mm of arrow per
// newton, so a 300 N grip is a 30 mm arrow. The hands' turning push on the
// T-handle is far smaller and has its own scale, 5 mm per newton.
//
// The worm tip starts on the cork top. Each turn clockwise lowers it one 7 mm
// pitch along its own helical track; once the cork moves, it carries the worm.
// ---------------------------------------------------------------------------

const PULL_SCALE = 0.1 * MM;
const TURN_SCALE = 5 * MM;
const TAU = Math.PI * 2;
const HANDLE = {length: 84, radius: 7, shaft: 26};
const HAND = 0xd9822b;
const GRIP = 0x2f6690;
const CHART = {width:110,height:65,x:185,y:82,z:-55,maxForce:1500,labels:true,forceLabel:'Pull on the handle (N)'};

export function createScrewCorkscrewModel() {
  const kit = houseModel('Screw corkscrew'), {root, part, control, finish, covers} = kit;
  const system = part('system', 'Screw corkscrew', 'A T-handle on a steel shaft ending in a worm. Turn it to screw the worm into the cork, then pull the handle straight up. All physical lengths use the same scale.');
  const neck = bottleAndCork(kit, system, covers, {section:true});

  const corkscrew = part('corkscrew', 'Corkscrew', 'Handle, shaft and worm turn and move as one piece.', [0, 0, 0], system);
  const handle = part('handle', 'T-handle', 'Both hands push its ends in opposite directions to turn it, then grip it to pull. Orange arrows show the turning push while screwing and the pull after.', [0, (CORK.wormLength + HANDLE.shaft) * MM, 0], corkscrew);
  const bar = kit.rod([-HANDLE.length / 2 * MM, 0, 0], [HANDLE.length / 2 * MM, 0, 0], HANDLE.radius * MM, 'wood', handle);
  const shaft=part('shaft','Shaft','Connects the handle to the worm and carries both turning torque and the straight pull.',[0,0,0],corkscrew);
  kit.rod([0,(CORK.wormLength+HANDLE.shaft)*MM,0],[0,CORK.wormLength*MM,0],1.6*MM,'metal',shaft);
  const turnArrows = [1, -1].map(side => {
    const arrow = solidArrow(kit, HAND, handle, 0.8 * MM);
    arrow.position.set(side * D.handle * MM, 0, side * 8 * MM);
    arrow.userData.setDirection(new THREE.Vector3(0, 0, side));
    return arrow;
  });
  const pullArrow = solidArrow(kit, HAND, handle, 1.2 * MM);
  pullArrow.position.set(0, (HANDLE.radius + 2) * MM, 0);
  pullArrow.userData.setDirection(new THREE.Vector3(0, 1, 0));
  const worm = wormPart(kit, corkscrew, 'The helix screwed into the cork. An open helix grips a cylinder of cork as wide as the helix; a solid screw grips a narrower one and rubs along its whole shank.');
  const gripArrow = solidArrow(kit, GRIP, neck.cork, 1.2 * MM);
  gripArrow.userData.setDirection(new THREE.Vector3(0, -1, 0));

  const chart = forceChart(kit, system, {id: 'chart', label: 'Pull needed as the cork comes out', description: 'Blue: the pull the cork needs at each point of its 44 mm. Orange: the most your pull gives. Green: the most the worm can hold. The red dot is the trial. Not drawn at the bottle’s scale.', ...CHART});
  const needLine = chart.line(GRIP), pullLine = chart.line(HAND), holdLine = chart.line(0x4f7f3a);

  const specs = {
    worm: ['Worm', '', WORMS.map(({value, label}) => ({value, label})), 'The open helix is what the book describes. The solid screw is a wood screw: narrower, and rubbing along its whole shank.'],
    turns: ['Turns screwed in', 'turns', null, 'Each turn drives the worm one 7 mm pitch deeper. Past 43 mm it comes out through the bottom of the cork.'],
    grip: ['Cork', '', GRIPS.map(({value, label}) => ({value, label})), 'How hard the neck holds the cork at the start of the pull. Teaching values, not measurements.'],
    pull: ['Pull you can give', 'N', null, 'The most force your arms put on the handle. The pull rises steadily to this.'],
    handle: ['Hand distance from shaft', 'mm', null, 'Each hand pushes this far from the shaft. The drawn handle length changes with the grip positions. Greater distance reduces turning force, but does not reduce the straight pull on the cork.'],
  };
  for (const [name, [min, max, step]] of Object.entries(SCREW_DOMAINS)) {
    const [label, unit, options, help] = specs[name];
    control(name, label, min, max, step, D[name], unit, help, options, {primary:name==='worm'});
  }

  let elapsed = 0, lastClock = 0, disposed = false, chartKey = '';
  const result = finish(values => {
    const s = sampleScrewCorkscrew(values, elapsed);
    neck.set({out:s.out,torn:s.torn,worm:values.worm,depth:s.depth,crumbFall:s.crumbFall,pierced:s.pierced&&s.depthNow>CORK.length-CORK.pierceMargin});
    worm.set({type: values.worm, torn: s.torn, depth: s.depth});
    const lift = s.withdrawal;
    const tip = NECK.top - s.depthNow + s.out + lift;
    corkscrew.position.y = tip * MM;
    corkscrew.rotation.y = -s.turnsDone * TAU;

    bar.scale.y=(2*values.handle+4)/HANDLE.length;
    for (const [i,arrow] of turnArrows.entries()){
      arrow.position.x=(i===0?1:-1)*values.handle*MM;
      arrow.userData.setLength(s.screwing ? s.turningForce * TURN_SCALE : 0);
    }
    pullArrow.userData.setLength(s.screwing ? 0 : s.applied * PULL_SCALE);
    const grip = !s.screwing && !s.torn && s.remaining > 0 ? Math.min(s.applied, s.needNow) : 0;
    gripArrow.userData.setLength(grip * PULL_SCALE);
    gripArrow.position.set(0, (NECK.top - s.remaining - 2) * MM + grip * PULL_SCALE, 12 * MM);

    const key = JSON.stringify(values);
    if (key !== chartKey) {
      chartKey = key;
      chart.setMaxForce(Math.ceil(Math.max(s.need,s.hold,values.pull)/250)*250);
      chart.setLine(needLine, [0, s.need], [1, 0]);
      chart.setLine(pullLine, [0, values.pull], [1, values.pull]);
      chart.setLine(holdLine, [0, s.hold], [1, s.hold]);
    }
    chart.place(s.out / CORK.length, s.screwing ? 0 : Math.min(s.applied, s.needNow));

    const outcome = {
      ready: 'Ready · the worm tip rests on the cork; press Play to screw it in and pull',
      screwing: `Screwing in · ${fixed(s.depthNow, 1)} mm deep`,
      loading: `Pulling · ${fixed(s.applied, 0)} N of the ${fixed(s.need, 0)} N the cork needs`,
      pulling: `The cork is coming · ${fixed(s.out, 1)} mm out`,
      freed: `Cork out${s.pierced ? ' · but the worm went through it, so crumbs fell in' : ''}`,
      torn: `The worm tore out of the cork at ${fixed(s.hold, 0)} N · the cork needs ${fixed(s.need, 0)} N`,
      stalled: `Stuck · your ${fixed(values.pull, 0)} N cannot start a cork that needs ${fixed(s.need, 0)} N`,
      lifted: 'Cork out',
    }[s.mode];
    return {
      state: {...s, tip, lift},
      readings: [
        r('Your result', outcome, 'Turn the worm in, then pull straight up. The result distinguishes extraction, insufficient pull and tear-out.'),
        r('Trial time', `${fixed(s.elapsed,2)} s`, 'Insertion is one turn per second. Extraction and failure recovery use a prescribed display speed, not a prediction from mass and acceleration.'),
        r('Pull the cork needs now', `${fixed(s.needNow, 0)} N`, 'Friction on the length still in the neck. It is greatest at the start and falls as the cork comes out.'),
        r('Your pull', `${fixed(s.applied, 0)} N of ${fixed(values.pull, 0)} N`, 'Pull rises to movement or failure, then follows the declining neck friction. There is no calculated lifting force after tear-out.'),
        r('The worm can hold', `${fixed(s.hold, 0)} N`, `Cork shears along a cylinder ${fixed(WORMS[values.worm].diameter, 0)} mm across and ${fixed(Math.min(s.depth, CORK.length), 1)} mm deep. If the cork needs more, the worm tears out instead.`),
        r('Cork out', `${fixed(s.out, 1)} of ${fixed(CORK.length, 0)} mm`, 'The extracted length. Unlike the winged design, this straight pull can lift the full cork.'),
        r('Worm depth', `${fixed(s.depthNow-s.withdrawal, 1)} mm`, `Depth relative to the cork top: turns times the 7 mm pitch, less any withdrawal after tear-out.${s.pierced ? ' This setting pierces the cork; inspect the turning stage to see crumbs fall below it.' : ''}`),
        r('Torque to screw in', `${fixed(s.torque, 1)} N·mm`, 'Friction on the buried wire, so it grows with depth.'),
        r('Push on each end of the handle', `${fixed(s.turningForce, 2)} N`, `The torque shared by two hands pushing ${fixed(values.handle, 0)} mm out from the shaft.`),
        r('Work pulling the cork', `${fixed(s.work, 2)} J`, 'Work is the area under the force curve over the distance already pulled. Only a full 44 mm extraction gives starting grip times half the cork length.'),
      ],
    };
  });

  const render = result.update;
  result.advance = dt => { if (Number.isFinite(dt) && dt > 0) elapsed = Math.min(result.getState().duration, elapsed + dt); return render(); };
  result.animate = t => { const dt = Number.isFinite(t) ? Math.max(0, t - lastClock) : 0; if (Number.isFinite(t)) lastClock = t; return result.advance(dt); };
  result.reset = () => { elapsed = lastClock = 0;root.rotation.set(.25,-.4,0); return render(result.defaults); };
  const inspect = (label, at) => ({label, group:'Run stages', part: 'system', view: 'front', replay: false, run() {root.rotation.set(.25,-.4,0); elapsed = Math.max(0, at(screwCorkscrewPlan(result.getState().values))); return render(); }});
  result.actions = [
    inspect('Inspect: turning the handle', plan => Math.max(0,plan.screwTime-.0001)),
    inspect('Inspect: worm in', plan => plan.screwTime),
    inspect('Inspect: the pull at its peak', plan => plan.startTime ?? plan.tearTime ?? plan.rampEnd),
    inspect('Inspect: the end', plan => plan.duration),
    ...[
      ['See the handle turn','handle',false,'top'],
      ['See the worm in the cork','cork',false,'front'],
      ['See below the cork','bottle',false,'front'],
      ['Read the force chart','chart',true,'front'],
      ['Whole corkscrew','system',false,'front'],
    ].map(([label,part,isolate,view])=>({label,part,isolate,view,group:'Look closer',replay:false,run(){root.rotation.set(...(part==='system'?[.25,-.4,0]:[0,0,0]));return render();}})),
  ];
  result.playback = {
    label: 'Screw in and pull',
    description: 'The hands turn the handle one turn a second for the turns you set, then pull with a force rising to your limit. Once the pull matches the cork’s grip, the cork comes out at a steady pace.',
    stepLabel: 'Advance by a tenth of a second',
    advance: result.advance,
    step: () => result.advance(0.1),
    complete: () => Boolean(result.getState().complete),
    blocked: () => false,
  };
  result.resultPart = {id: 'cork', label: 'Inspect the cork', view: 'front', context: 'system', focusOnComplete: false, available: () => Boolean(result.getState().complete)};
  result.frameBoundsForPart = id => {
    let bounds;
    if(id==='system')bounds=[[-105,0,-105],[CHART.x+CHART.width/2+18,236,105]];
    else if(id==='cork')bounds=[[-22,NECK.top-CORK.length-5,-20],[22,NECK.top+result.getState().out+12,22]];
    else return null;
    root.updateWorldMatrix(true,false);
    return new THREE.Box3(new THREE.Vector3(...bounds[0]).multiplyScalar(MM),new THREE.Vector3(...bounds[1]).multiplyScalar(MM)).applyMatrix4(root.matrixWorld);
  };

  root.rotation.set(0.25, -0.4, 0);
  result.initialPart = 'system';
  result.initialView = 'front';
  result.frameVisibleOnly = true;
  result.framePadding = 0.62;
  result.parts.find(part=>part.id==='system').framePadding=.51;
  result.selectionOutline = false;
  result.transparentBackground = true;
  result.topology = {system, neck, corkscrew, handle, shaft, bar, turnArrows, pullArrow, worm, gripArrow, chart, needLine, pullLine, holdLine, PULL_SCALE, TURN_SCALE, HANDLE};
  const dispose = result.dispose;
  result.dispose = () => { if (!disposed) { disposed = true; chart.dispose();dispose(); } };
  return result;
}

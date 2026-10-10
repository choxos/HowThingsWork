import * as THREE from 'three';
import {createPrinterModel, printerConstants} from './printer-model.js';
import {reading as r} from './house-model-kit.js';
import {fillLine, lineObject, segmentLines, textLabel} from './scene-kit.js';
import {trapezoidAt} from './printing-physics.js';
import {planPositioning, positioningAt, positioningConstants as C, positioningDefaults, positioningDomains} from './three-axis-physics.js';

export function createThreeAxisModel() {
  const model = createPrinterModel({positioning: true}), nativeUpdate = model.update, nativeReset = model.reset, nativeState = model.getState, S = printerConstants.scale;
  model.parts = model.parts.filter(part => part.id !== 'print');
  model.followParts = model.followParts.filter(id => id !== 'print');
  const specs = {
    targetX: ['Target X', 'mm', 'Requested left-right nozzle coordinate relative to the plate. Editing a target preserves the current physical pose.'],
    targetY: ['Target Y', 'mm', 'Requested forward-back nozzle coordinate on the plate. Positive Y moves the plate backward.'],
    targetZ: ['Target Z', 'mm', 'Requested nozzle height above the plate. The screw lifts the entire X gantry.'],
    speed: ['Path speed', 'mm/s', 'Reference speed along the coordinated path. The Z component cannot exceed 3 mm/s. Editing speed stops and replans from the current pose.'],
    acceleration: ['Path acceleration', 'mm/s²', 'Reference acceleration and braking along the path. A short move may finish before reaching the requested speed. Editing this stops and replans from the current pose.'],
    microsteps: ['Motor step mode', '', 'Each motor has 200 full steps per turn. Finer commanded spacing does not guarantee better physical accuracy. Changing this restarts from the calibrated initial pose.', [{value: 1, label: 'Whole steps'}, {value: 16, label: 'Sixteenth steps'}]],
    play: ['X coupling play', 'mm', 'Horizontal clearance in the visible slotted coupling. Reversing must take up this slack. Changing play restarts from the initial pose, with the positive drive face engaged.'],
    roundTrip: ['Move', '', 'Choose a single move or a move to the target and back to the initial coordinate. Changing this restarts from the initial pose.', [{value: 0, label: 'To target'}, {value: 1, label: 'Out and back'}]],
  };
  for (const [key, [label, unit, help, options]] of Object.entries(specs)) {
    const [min, max, step] = positioningDomains[key], spec = {key, label, unit, help, min, max, step, initial: positioningDefaults[key], ...(options ? {options} : {})};
    const existing = model.controls.find(control => control.key === key);
    if (existing) Object.assign(existing, spec); else model.controls.push(spec);
  }
  Object.assign(model.defaults, positioningDefaults); nativeUpdate(positioningDefaults);
  const part = id => model.parts.find(part => part.id === id).object, bed = part('bed');
  function annotation(id, name, description) {
    const object = new THREE.Group(); object.name = name; bed.add(object); model.parts.push({id, name, description, object, parentId: 'bed'}); return object;
  }
  const axes = annotation('coordinate-axes', 'Plate coordinate guides', 'Virtual colored arrows show positive X in red, Y in blue and Z in green. All coordinates are relative to the moving plate.');
  for (const [direction, color] of [[[1,0,0],0xc14f39], [[0,0,1],0x397f9e], [[0,1,0],0x608644]]) axes.add(new THREE.ArrowHelper(new THREE.Vector3(...direction), new THREE.Vector3(0,printerConstants.bedTop+.005,0), .9, color, .09, .04));
  for (const [label, position] of [['X',[.98,1.07,0]],['Y',[0,1.07,.98]],['Z',[-.12,2,.12]]]) textLabel(axes,label,{height:.12,width:.14,position});
  const path = annotation('coordinate-path', 'Commanded straight path', 'This dashed virtual guide joins the motor command endpoints in plate coordinates. Discrete steps approximate the line. With coupling play, the head can leave this commanded path. It is not deposited plastic.');
  const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]), new THREE.LineDashedMaterial({color: 0x397f9e, dashSize: .04, gapSize: .025})); path.add(line);
  function inspection(id, name, description) {
    const object = new THREE.Group(); object.name = name; object.position.set(0,2,0); object.userData.inspectionOnly = id; object.userData.explosionExcluded = true;
    part('system').add(object); model.parts.push({id, name, description, object, parentId: 'system', inspectionView: 'front'}); return object;
  }
  const grid = inspection('step-grid', 'Magnified X command grid', 'This virtual diagram compares requested X with the nearest motor command at the active leg endpoint. Its width is eight command increments, so magnification changes with step mode. It shows rounding, not physical motor accuracy or coupling play.');
  const ticks = segmentLines(10,0x6f7a6b,grid), requestedLine = lineObject(2,0xd99a2b,grid), commandLine = lineObject(2,0x397f9e,grid);
  const gridTitle = textLabel(grid,'',{height:.19,width:3.5,position:[0,.72,.02]}), gridScale = textLabel(grid,'',{height:.17,width:3.6,position:[0,-.68,.02]});
  textLabel(grid,'Orange: requested · blue: nearest command',{height:.16,width:3.6,position:[0,.48,.02]});
  const gridError = textLabel(grid,'',{height:.17,width:3.6,position:[0,-.43,.02]});
  const chart = inspection('motion-profile', 'Coordinated speed profile', 'This virtual graph shows reference speed against simulated time for the active leg. All three axes use the same fraction of this profile. The orange cursor follows the current time; step pulses and X coupling clearance can make actual travel differ.');
  const curve = lineObject(81,0x397f9e,chart), chartAxes = lineObject(3,0x6f7a6b,chart), cursor = lineObject(2,0xd99a2b,chart);
  fillLine(chartAxes,[[-1.5,.55,0],[-1.5,-.45,0],[1.5,-.45,0]]);
  textLabel(chart,'Reference speed (mm/s)',{height:.16,width:3.5,position:[0,.83,.02]});
  textLabel(chart,'Simulated time (s)',{height:.16,width:3.5,position:[0,-.94,.02]});
  const chartPeak = textLabel(chart,'',{height:.16,width:3.5,position:[0,.63,.02]}), chartTime = textLabel(chart,'',{height:.16,width:3.5,position:[0,-.69,.02]});
  model.inspectionObjects = id => id === 'step-grid' ? [grid] : id === 'motion-profile' ? [chart] : [];
  model.thumbnailOmit = [grid,chart]; model.frameVisibleOnly = true; model.framePadding = .75;
  for (const id of ['step-grid','motion-profile','x-coupling','x-coupling-pin']) model.parts.find(part => part.id === id).framePadding = .55;
  model.frameBoundsForPart = id => ['step-grid','motion-profile'].includes(id) ? new THREE.Box3(new THREE.Vector3(-1.85,-1.1,-.03),new THREE.Vector3(1.85,1,.04)).applyMatrix4(part(id).matrixWorld) : null;
  let plan = planPositioning(), clock = 0, lastClock = 0, started = false, state;
  const coordinates = p => `X ${p.x.toFixed(3)} · Y ${p.y.toFixed(3)} · Z ${p.z.toFixed(3)} mm`;
  function render() {
    const now = positioningAt(plan, clock), values = nativeState().values, leg = plan.legs[now.leg];
    model.renderPositioning({position: now.position, driveX: now.drive.x, target: now.requested, play: values.play});
    const points = line.geometry.attributes.position;
    for (const [i, p] of [leg.from, leg.end].entries()) points.setXYZ(i, p.x*S, printerConstants.bedTop+p.z*S, p.y*S);
    points.needsUpdate = true; line.computeLineDistances(); line.geometry.computeBoundingSphere();
    const perMm = 3.2/(8*plan.pitch.x), first = Math.ceil(leg.requested.x/plan.pitch.x-4), tickPoints = [];
    for (let k=first; k<=Math.floor(leg.requested.x/plan.pitch.x+4); k++) { const x=(k*plan.pitch.x-leg.requested.x)*perMm; tickPoints.push([x,-.25,0],[x,.25,0]); }
    fillLine(ticks,tickPoints); fillLine(requestedLine,[[0,-.32,.01],[0,.32,.01]]);
    const commandX = (leg.end.x-leg.requested.x)*perMm; fillLine(commandLine,[[commandX,-.32,.015],[commandX,.32,.015]]);
    gridTitle.userData.setText(values.microsteps===1?'Whole-step X endpoint commands':'Sixteenth-step X endpoint commands');
    gridScale.userData.setText(`Full window: ${(8*plan.pitch.x*1000).toFixed(3)} μm · eight increments`);
    gridError.userData.setText(`Nearest command minus request: ${((leg.end.x-leg.requested.x)*1000).toFixed(3)} μm`);
    const peak = leg.profile.top || 1, chartPoints = Array.from({length:81},(_,i)=>[-1.5+3*i/80,-.45+trapezoidAt(leg.profile,leg.profile.time*i/80,values.acceleration).speed/peak,0]);
    fillLine(curve,chartPoints); const cursorX=-1.5+3*(leg.profile.time>0?(now.time-leg.startTime)/leg.profile.time:1); fillLine(cursor,[[cursorX,-.45,.01],[cursorX,.55,.01]]);
    chartPeak.userData.setText(`0 at baseline · peak ${leg.profile.top.toFixed(2)} mm/s`);
    chartTime.userData.setText(`0 at left · ${(now.time-leg.startTime).toFixed(2)} now · ${leg.profile.time.toFixed(2)} s at right`);
    const result = plan.duration === 0 ? 'No move needed · already at this command' : now.complete ? now.distanceError < 1e-8 ? 'Target reached · nozzle meets the marker' : `Move complete · ${(now.distanceError*1000).toFixed(2)} μm from the requested point` : !started ? 'Ready · choose a coordinate and move' : `${now.leg ? 'Returning' : 'Moving to target'} · coordinated motor commands`;
    const readings = [
      r('Your result', result, now.complete && values.play > 0 ? 'X play can leave the head behind its motor command. Compare the head and drive, then inspect the coupling.' : 'The orange marker is requested position. Actual position comes from the commanded steps and mechanical coupling.'),
      r('Requested position', coordinates(now.requested), 'Coordinates are relative to the moving plate. On the return leg, the marker moves to the initial coordinate.'),
      r('Actual position', coordinates(now.position)),
      r('Position error', `X ${(now.error.x*1000).toFixed(2)} · Y ${(now.error.y*1000).toFixed(2)} · Z ${(now.error.z*1000).toFixed(2)} μm`, 'Actual minus requested. Final error includes command rounding and any X coupling play; it is not a measured hardware accuracy.'),
      r('X head / drive', `${now.position.x.toFixed(3)} / ${now.drive.x.toFixed(3)} mm`, 'The belt pin follows the drive. The head follows only when the pin reaches a slot face.'),
      r('Y plate travel', `${(-now.position.y).toFixed(3)} mm`, 'Plate travel is opposite to nozzle Y measured on the plate.'),
      r('Z gantry lift', `${(now.position.z-.2).toFixed(3)} mm`, 'Rise from the initial 0.2-mm nozzle clearance. One screw turn raises the gantry by 2 mm.'),
      r('Motor commands', `X ${now.steps.x} · Y ${now.steps.y} · Z ${now.steps.z}`, 'Signed commanded increments from the calibrated initial pose. All moving axes share one reference profile; their final steps occur at its end.'),
      r('Command spacing', `X/Y ${(plan.pitch.x*1000).toFixed(3)} · Z ${(plan.pitch.z*1000).toFixed(3)} μm`, 'This miniature teaching drive carries 7.539822 mm per belt pulley turn and 2 mm per screw turn. Motor force, load error and missed steps are not solved.'),
      r('X slot taken up', `${(now.gap*1000).toFixed(1)} / ${(values.play*1000).toFixed(1)} μm`, 'Zero means the positive face is engaged; full play means the opposite face is engaged. Between them the pin moves without sliding the head along X.'),
      r('Reference speed', `${now.pathSpeed.toFixed(2)} mm/s`, `${leg.profile.triangular ? 'Triangular' : 'Trapezoidal'} reference profile; peak ${leg.profile.top.toFixed(2)} mm/s. This is the smooth command envelope, not instantaneous step motion.`),
      r('Move progress', `${(now.progress*100).toFixed(1)}%`, `${now.time.toFixed(2)} / ${plan.duration.toFixed(2)} simulated seconds. Shown twice as slowly.`),
      r('Plastic deposited', '0.00 mm³', 'Cold positioning only. The target, axes and dashed path are virtual guides.'),
      r('Model limit', 'Ideal step commands and horizontal coupling play', 'No motor torque, current, vibration, missed steps, belt stretch, feedback correction or homing simulation. Microstepping changes command resolution, not guaranteed real accuracy.'),
    ];
    state = {...nativeState(), ...now, clock, elapsed: now.time, stage: now.complete ? 'finished' : started ? 'moving' : 'ready', duration: plan.duration, plan, values: {...values}, readings}; return readings;
  }
  function restart() { clock = 0; started = false; plan = planPositioning(nativeState().values); return render(); }
  model.update = (next = {}) => {
    const before = nativeState().values, previous = positioningAt(plan, clock); nativeUpdate(next); const after = nativeState().values;
    if (['microsteps','play','roundTrip'].some(key => before[key] !== after[key])) return restart();
    if (['targetX','targetY','targetZ','speed','acceleration'].some(key => before[key] !== after[key])) { plan = planPositioning(after, previous.drive, previous.position); clock = 0; started = false; }
    return render();
  };
  model.advance = seconds => { if (Number.isFinite(seconds) && seconds > 0 && clock < plan.duration) { clock = Math.min(plan.duration, clock + seconds*C.clockScale); started = true; } return render(); };
  model.animate = time => { if (!Number.isFinite(time)) return render(); const delta = Math.max(0,time-lastClock); lastClock = Math.max(lastClock,time); return model.advance(delta); };
  model.reset = () => { nativeReset(); lastClock = 0; return restart(); };
  model.getState = () => ({...state, position: {...state.position}, drive: {...state.drive}, values: {...state.values}});
  model.actions = [
    {label: 'Restart this move', part: 'system', view: 'reset', run: restart},
    {label: 'Inspect the reversal', part: 'x-coupling', view: 'back', isolate: true, replay: false, run: () => { nativeUpdate({roundTrip: 1}); restart(); clock = plan.legs[1].startTime; started = true; return render(); }},
    {label: 'Inspect command spacing', part: 'step-grid', view: 'front', isolate: true, replay: false, run: render},
    {label: 'Inspect speed profile', part: 'motion-profile', view: 'front', isolate: true, replay: false, run: render},
  ];
  model.playback = {label: 'Move the axes', stepLabel: 'Advance the motor commands', description: 'Coordinated X/Y/Z commands run at half real time. Pause freezes the whole machine. Whole steps and microsteps use the same path; X coupling play is visible at a reversal.', advance: model.advance, step: () => model.advance(.5), complete: () => state.complete, blocked: () => false};
  model.resultPart = {id: 'bed', context: 'system', focusOnComplete: false, label: 'Inspect the positioning result', available: () => state.complete};
  model.initialPart = null; model.overviewZoom = 1; model.selectionOutline = false; model.parts.find(part => part.id === 'system').framePadding = .68; model.followParts.push('x-coupling','x-coupling-pin');
  model.catalogParts = model.parts.filter(part => !['system','target','target-projection','target-height-guide','coordinate-axes','coordinate-path','step-grid','motion-profile'].includes(part.id) && !model.covers.includes(part.object));
  for (const id of ['x-coupling','x-coupling-pin']) Object.assign(model.parts.find(part => part.id === id), {maxZoom: 100, inspectionView: 'back'});
  model.parts.find(part => part.id === 'y-motor').inspectionView = 'back';
  model.partViewDirections = {};
  for (const id of ['y-drive','y-belt','y-pulley-drive']) {
    model.parts.find(part => part.id === id).inspectionView = 'side';
    model.partViewDirections[id] = {side: [-2.7,.15,0]};
  }
  const dispose = model.dispose; let disposed = false;
  model.dispose = () => { if (!disposed) { disposed = true; dispose(); } };
  render(); return model;
}

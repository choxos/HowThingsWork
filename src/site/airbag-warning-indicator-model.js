import * as THREE from 'three';
import {houseModel, reading} from './house-model-kit.js';
import {fixed} from './format.js';

export const airbagWarningIndicatorConstants = Object.freeze({
  duration: 12, displayDuration: 6, startupEnd: 6, reportOnset: 8,
  supplyVoltage: 12, ledDrop: 2, seriesResistance: 1000, missingThreshold: .001, diagnosticDelay: 1,
  tonePeriod: 4, toneSpacing: .5, toneWidth: .25, toneCount: 5,
  defaults: Object.freeze({power: 1, report: 0, lamp: 0, sound: 0}),
});
const C = airbagWarningIndicatorConstants;
const domains = {power: [0, 1], report: [0, 1, 2], lamp: [0, 1, 2], sound: [0, 1]};
const reportNames = ['No imposed report', 'Report present from start', 'Report appears at 8 s'];
const lampNames = ['Working output', 'Cannot illuminate', 'Stuck illuminated'];

export function sampleAirbagWarningIndicator(input = {}, elapsed = 0) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new TypeError('Expected control values');
  if (Object.keys(input).some(key => !Object.hasOwn(domains, key))) throw new RangeError('Unknown control');
  const values = {...C.defaults, ...input};
  for (const [key, allowed] of Object.entries(domains)) {
    if (!allowed.includes(values[key])) throw new RangeError('Invalid ' + key);
  }
  if (!Number.isFinite(elapsed) || elapsed < 0 || elapsed > C.duration) throw new RangeError('Observation time outside 0–12 seconds');
  const powered = values.power === 1;
  const startupActive = powered && elapsed < C.startupEnd;
  const reportedCondition = powered ? values.report === 1 || (values.report === 2 && elapsed >= C.reportOnset) : null;
  const lampCommand = powered ? startupActive || reportedCondition : null;
  // Chosen DC equivalent: an ideal high-side switch, series resistor and LED.
  // An open LED branch interrupts current; a stuck switch ignores off commands.
  const switchClosed = powered && (values.lamp === 2 || lampCommand === true);
  const ledOpen = values.lamp === 1;
  const branchCurrent = command => powered && !ledOpen && (values.lamp === 2 || command)
    ? (C.supplyVoltage - C.ledDrop) / C.seriesResistance : 0;
  const ledCurrent = branchCurrent(lampCommand), visibleLamp = ledCurrent > 0;
  const resistorPower = ledCurrent ** 2 * C.seriesResistance, ledPower = ledCurrent * C.ledDrop;
  const missingCurrent = powered && lampCommand && ledCurrent < C.missingThreshold;
  // Every powered trial begins with a six-second on request. For these fixed
  // branch conditions, the first continuous missing-current interval starts at
  // zero or never occurs. Qualification uses only its already elapsed prefix.
  const startupMissing = powered && branchCurrent(true) < C.missingThreshold;
  const backupRequested = startupMissing && elapsed >= C.diagnosticDelay;
  const tonePhase = backupRequested ? (elapsed - C.diagnosticDelay) % C.tonePeriod : 0;
  const toneActive = backupRequested && tonePhase < C.toneCount * C.toneSpacing && tonePhase % C.toneSpacing < C.toneWidth;
  return {
    values, elapsed, powered, startupActive, reportedCondition, lampCommand, visibleLamp,
    switchClosed, ledOpen, ledCurrent, resistorPower, ledPower, branchPower: ledCurrent * C.supplyVoltage, missingCurrent, backupRequested, toneActive,
    phase: !powered ? 'Unpowered' : startupActive ? 'Startup check' : 'Continuing monitoring',
    agreement: powered ? lampCommand === visibleLamp : null,
    comparison: !powered ? 'Unavailable' : lampCommand === visibleLamp ? 'Matches' : 'Differs',
  };
}

export function createAirbagWarningIndicatorModel() {
  const kit = houseModel('Airbag warning indicator');
  const {root, part, box, sphere, disk, rod, ring, control, finish} = kit;
  const ink = 0x293d36, muted = 0x89978e, blue = 0x195b91, orange = 0x963f1d;
  const textures = new Set(), labels = [], terminals = [], packages = [];

  function label(text, x, y, parent, width, height = .43, z = .29) {
    const pixelWidth = Math.min(4096, Math.ceil(128 * width / height));
    const pixelHeight = Math.max(32, Math.round(pixelWidth * height / width));
    let canvas, context, metrics = null;
    if (typeof document !== 'undefined') canvas = document.createElement('canvas');
    else if (typeof OffscreenCanvas !== 'undefined') canvas = new OffscreenCanvas(pixelWidth, pixelHeight);
    if (canvas) { canvas.width = pixelWidth; canvas.height = pixelHeight; context = canvas.getContext('2d'); }
    let texture;
    if (context) {
      context.clearRect(0, 0, pixelWidth, pixelHeight);
      context.fillStyle = '#263a2f'; context.textAlign = 'center'; context.textBaseline = 'alphabetic';
      let font = pixelHeight; context.font = font + 'px sans-serif';
      let measured = context.measureText(text);
      font *= Math.min(pixelWidth * .90 / measured.width, pixelHeight * .80 / (measured.actualBoundingBoxAscent + measured.actualBoundingBoxDescent));
      context.font = font + 'px sans-serif'; measured = context.measureText(text);
      const baseline = (pixelHeight + measured.actualBoundingBoxAscent - measured.actualBoundingBoxDescent) / 2;
      context.fillText(text, pixelWidth / 2, baseline);
      metrics = {pixelWidth, pixelHeight, font, left: pixelWidth / 2 - measured.actualBoundingBoxLeft, right: pixelWidth / 2 + measured.actualBoundingBoxRight, top: baseline - measured.actualBoundingBoxAscent, bottom: baseline + measured.actualBoundingBoxDescent};
      texture = new THREE.CanvasTexture(canvas);
    } else texture = new THREE.DataTexture(new Uint8Array([0, 0, 0, 0]), 1, 1);
    texture.colorSpace = THREE.SRGBColorSpace; texture.needsUpdate = true; textures.add(texture);
    const object = new THREE.Mesh(new THREE.PlaneGeometry(width, height), new THREE.MeshBasicMaterial({map: texture, transparent: true, depthWrite: false, side: THREE.DoubleSide}));
    object.position.set(x, y, z); object.userData = {labelText: text, width, height, canvasBacked: Boolean(context), metrics};
    parent.add(object); labels.push(object); return object;
  }
  function stateLabels(texts, x, y, parent, width = 1.9, height = .42) {
    const objects = texts.map(text => label(text, x, y, parent, width, height));
    return {objects, show(index) { objects.forEach((o, i) => { o.visible = i === index; }); }};
  }
  function line(points, color, parent, segments = false) {
    const geometry = new THREE.BufferGeometry().setFromPoints(points.map(p => new THREE.Vector3(...p)));
    const object = segments ? new THREE.LineSegments(geometry, new THREE.LineBasicMaterial({color})) : new THREE.Line(geometry, new THREE.LineBasicMaterial({color}));
    parent.add(object); return object;
  }
  function terminal(parent, position, name) {
    const object = sphere(.04, position, 'gold', parent);
    object.userData.terminalName = name; terminals.push(object); return object;
  }

  const system = part('system', 'Airbag warning indicator', 'A teaching lamp circuit and its observed history. The circuit is not manufacturer wiring.');
  const circuit = part('circuit', 'Connected lamp-drive circuit', 'Supply, controlled switch, current-limiting resistor, LED and return form a complete branch. Blue lines carry command and voltage-sense information.', [0, 2.2, 0], system);
  const boardPart = part('board', 'Circuit mounting board', 'Supports the connected teaching circuit. Component sizes and layout are illustrative.', [0, 0, 0], circuit);
  const board = box([12, 7.4, .16], [0, 0, 0], 0xffffff, boardPart);
  const headerBacking = box([11.4, .85, .055], [0, 3.12, .1075], 'cream', boardPart);
  label('Warning lamp drive · teaching circuit', 0, 3.12, boardPart, 10.7, .50, .15);
  function module(id, name, description, x, y, width = 2.1, height = 1.5) {
    const parent = part(id, name, description, [x, y, 0], circuit);
    const body = box([width, height, .18], [0, 0, .17], 'cream', parent);
    packages.push({id, parent, body, width, height, boardFront: .08, bodyBack: .08});
    return parent;
  }
  const powerPart = module('power', '12 V teaching supply', 'An ideal common supply powers the lamp branch and monitor. Off disconnects both. Its voltage is a chosen teaching value.', -4.6, .4, 1.8, 2.2);
  label('12 V', 0, .63, powerPart, 1.4, .45);
  const powerLabel = stateLabels(['Off', 'On'], 0, 0, powerPart, 1.4, .40);
  const positive = terminal(powerPart, [.9, .7, .28], 'positive');
  const negative = terminal(powerPart, [.9, -.7, .28], 'return');
  label('+', .61, .72, powerPart, .35, .35);
  label('−', .61, -.68, powerPart, .35, .35);
  const indicatorPath = module('indicator-path', 'Controlled electronic switch', 'An ideal high-side electronic switch completes or interrupts the branch. The moving bar is a state symbol; a semiconductor has no moving contact.', -1.9, 1.1, 2.0, 1.25);
  label('Switch', 0, -.43, indicatorPath, 1.7, .32);
  const switchA = terminal(indicatorPath, [-.7, 0, .28], 'switch input'), switchB = terminal(indicatorPath, [.7, 0, .28], 'switch output');
  const switchBlade = rod([-.7, 0, .28], [.7, 0, .28], .045, 'gold', indicatorPath);
  const resistorPart = module('resistor', 'Current-limiting resistor', 'The chosen 1 kΩ series resistance limits the forward LED current to (12 − 2) / 1000 = 10 mA.', .8, 1.1, 1.3, .45);
  label('1 kΩ', 0, .63, resistorPart, 1.7, .40);
  for(const x of [-.38, -.19, .19])box([.08, .46, .025], [x, 0, .27], 'ink', resistorPart);
  rod([-.85, 0, .28], [-.65, 0, .28], .03, 'metal', resistorPart);rod([.65, 0, .28], [.85, 0, .28], .03, 'metal', resistorPart);
  const resistorA=terminal(resistorPart,[-.85,0,.28],'resistor input'),resistorB=terminal(resistorPart,[.85,0,.28],'resistor output');
  const lampPart = module('lamp', 'AIRBAG warning LED', 'Forward branch current illuminates the red lens. Cannot illuminate opens the visible cathode lead in this teaching equivalent.', 3.65, .35, 1.8, 1.8);
  const lens = disk(.36, .07, [0, .17, .295], 'red', lampPart);lens.material=lens.material.clone();
  label('AIRBAG', 0, .68, lampPart, 1.6, .32, .30);
  const lampA=terminal(lampPart,[-.4,-.85,.28],'LED anode'),lampB=terminal(lampPart,[.4,-.85,.28],'LED cathode');
  rod([-.4,-.85,.28],[-.4,-.4,.28],.03,'metal',lampPart);rod([-.4,-.4,.28],[-.2,-.12,.30],.03,'metal',lampPart);
  rod([.4,-.85,.28],[.4,-.65,.28],.03,'metal',lampPart);rod([.4,-.4,.28],[.2,-.12,.30],.03,'metal',lampPart);
  const ledLink=rod([.4,-.65,.28],[.4,-.4,.28],.03,'metal',lampPart);
  const openLabel=label('Open lead',0,-1.19,lampPart,1.9,.32);
  const monitor = module('monitor', 'Monitor and startup timer', 'Combines startup and report requests. Ideal voltage sensing across the resistor measures current; one second of missing requested current retains a backup request.', -1.8, -1.4, 2.1, 1.1);
  label('MONITOR', 0, .23, monitor, 1.85, .33);
  const phaseLabel=stateLabels(['Startup','Monitoring','No power'],0,-.18,monitor,1.85,.33);
  const reportInput=module('report-input','Imposed report input','The supplied report schedule represents other checks outside this circuit.',-4.6,-2.6,1.8,1.0);
  label('REPORT',0,.23,reportInput,1.6,.33);
  const reportLabel=stateLabels(['None','Present','No power'],0,-.18,reportInput,1.6,.33);
  const buzzerPart=part('buzzer','Backup sounder','A retained missing-current request drives five short tone pulses. The cadence and optional synthesized frequency are chosen teaching values.',[1.1,-1.6,0],circuit);
  const buzzerBody=disk(.46,.36,[0,0,.26],'ink',buzzerPart),buzzerFace=disk(.32,.02,[0,0,.45],'metal',buzzerPart);
  buzzerFace.material=buzzerFace.material.clone();
  const waves=[.57,.72].map(radius=>ring(radius,.015,[0,0,.48],'blue',buzzerPart));
  label('Backup tone',0,-.95,buzzerPart,2.4,.33);
  const wiresPart=part('wires','Lamp branch and return','Copper conductors form one series circuit. Moving markers show conventional current direction, not electron speed.',[0,0,0],circuit);
  const branchWires=[];
  function wire(points,parent=wiresPart,color='clay'){
    const pieces=[];for(let i=1;i<points.length;i++)pieces.push(rod(points[i-1],points[i],.025,color,parent));
    return {points:points.map(p=>[...p]),pieces,parent};
  }
  branchWires.push(wire([[-3.7,1.1,.28],[-2.6,1.1,.28]]));
  branchWires.push(wire([[-1.2,1.1,.28],[-.05,1.1,.28]]));
  branchWires.push(wire([[1.65,1.1,.28],[2.6,1.1,.28],[2.6,-.5,.28],[3.25,-.5,.28]]));
  branchWires.push(wire([[4.05,-.5,.28],[4.8,-.5,.28],[4.8,-3.1,.28],[-3.25,-3.1,.28],[-3.25,-.3,.28],[-3.7,-.3,.28]]));
  const feedbackPart=part('feedback','Command, sensing and sounder connections','Blue paths convey command and ideal high-impedance voltage sensing. Paired output leads drive the sounder. Raised crossings are not junctions.',[0,0,0],circuit);
  const infoRoutes=[];
  infoRoutes.push(wire([[-3.7,-2.6,.28],[-2.85,-2.6,.28],[-2.85,-1.4,.28]],feedbackPart,'blue'));
  infoRoutes.push(wire([[-1.8,-.85,.28],[-1.8,.475,.28]],feedbackPart,'blue'));
  infoRoutes.push(wire([[-.05,1.1,.28],[-.05,.1,.28],[-.75,-.9,.28]],feedbackPart,'blue'));
  infoRoutes.push(wire([[1.65,1.1,.28],[1.85,1.1,.50],[1.85,-.3,.50],[-.4,-.3,.50],[-.75,-1.1,.28]],feedbackPart,'blue'));
  infoRoutes.push(wire([[-3.7,1.1,.28],[-3.45,1.1,.55],[-3.45,-1.2,.55],[-2.85,-1.2,.28]],feedbackPart,'clay'));
  infoRoutes.push(wire([[-1.8,-1.95,.28],[-1.8,-3.1,.28]],feedbackPart,'clay'));
  infoRoutes.push(wire([[-.75,-1.4,.28],[.65,-1.4,.28]],feedbackPart,'blue'));
  infoRoutes.push(wire([[-.75,-1.7,.28],[.65,-1.7,.28]],feedbackPart,'blue'));
  label('Blue: command and sensing',0,2.35,boardPart,6.2,.34,.15);
  const currentPath=[[-3.7,1.1,.28],[-2.6,1.1,.28],[-1.2,1.1,.28],[-.05,1.1,.28],[1.65,1.1,.28],[2.6,1.1,.28],[2.6,-.5,.28],[3.25,-.5,.28],[3.25,-.05,.28],[3.65,.52,.30],[4.05,-.05,.28],[4.05,-.5,.28],[4.8,-.5,.28],[4.8,-3.1,.28],[-3.25,-3.1,.28],[-3.25,-.3,.28],[-3.7,-.3,.28]];
  const pathLengths=[0];for(let i=1;i<currentPath.length;i++)pathLengths.push(pathLengths[i-1]+new THREE.Vector3(...currentPath[i]).distanceTo(new THREE.Vector3(...currentPath[i-1])));
  const currentMarkers=Array.from({length:14},()=>sphere(.047,[0,0,0],'gold',wiresPart));
  const records = part('records', 'Observed indicator history', 'Only elapsed states are retained. Vertical edges are exact changes; unavailable is not a zero measurement.', [0, -6.1, 0], system);
  const recordBoard=box([9.5,8.2,.16],[0,0,0],0xffffff,records);
  label('Observed states · Time (s)', 0, 3.75, records, 8.4, .55, .15);
  const rows = [], capacity = 8, left = -2.85, width = 6.65, high = .27;
  function makeRow(id, name, shortName, key, y, color) {
    const parent = part(id, name, 'A fixed 0–12 second record with only the observed prefix. Select the full record to compare all three rows.', [0, y, 0], records);
    const panel = box([8.8, 2.0, .055], [0, 0, .1075], 'cream', parent);
    const titleLabel = label(shortName, 0, .73, parent, 6.5, .50, .15);
    const unavailableLabel = label(shortName + ' · unavailable', 0, .73, parent, 7.5, .50, .15);
    label(key === 'reportedCondition' ? 'Yes' : 'On', left - .79, high, parent, .85, .50, .15);
    label(key === 'reportedCondition' ? 'No' : 'Off', left - .79, -high, parent, .85, .50, .15);
    const grid = [];
    for (const time of [0, 6, 8, 12]) {
      const x = left + width * time / C.duration;
      grid.push([x, -.36, .14], [x, .36, .14]);
      label(String(time), x, -.72, parent, .80, .50, .15);
    }
    for (const level of [-high, high]) grid.push([left, level, .14], [left + width, level, .14]);
    const gridLine = line(grid, muted, parent, true);
    const positions = new Float32Array(capacity * 3), times = new Float64Array(capacity), states = new Array(capacity).fill(null);
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3).setUsage(THREE.DynamicDrawUsage));
    const object = new THREE.Line(geometry, new THREE.LineBasicMaterial({color})); parent.add(object);
    const marker = sphere(.055, [left, 0, .17], color, parent);
    const unknown = line([[left, 0, .17], [left, 0, .17]], muted, parent);
    const row = {id, parent, panel, key, geometry, object, positions, times, states, marker, unknown, titleLabel, unavailableLabel, gridLine, count: 0};
    rows.push(row); return row;
  }
  makeRow('report-record', 'Report history', 'Report', 'reportedCondition', 2.2, blue);
  makeRow('command-record', 'Command history', 'Command', 'lampCommand', 0, orange);
  makeRow('lamp-record', 'Visible lamp history', 'Visible lamp', 'visibleLamp', -2.2, 0xa6221e);
  label('A matching light is not a complete health test.', 0, -3.73, records, 9.0, .37, .10);

  function updateRow(row, state) {
    const field = row.key, elapsed = state.elapsed;
    row.positions.fill(0); row.times.fill(0); row.states.fill(null); row.count = 0;
    function push(time, value) {
      const i = row.count++; row.times[i] = time; row.states[i] = value;
      row.positions.set([left + width * time / C.duration, value ? high : -high, .17], i * 3);
    }
    const available = state[field] !== null;
    row.object.visible = row.marker.visible = available;
    row.unknown.visible = !available && elapsed > 0;
    row.unavailableLabel.visible = !available; row.titleLabel.visible = available;
    if (available) {
      let previous = sampleAirbagWarningIndicator(state.values, 0)[field], last = 0;
      push(0, previous);
      for (const boundary of [C.startupEnd, C.reportOnset]) {
        if (boundary > elapsed) break;
        const next = sampleAirbagWarningIndicator(state.values, boundary)[field];
        push(boundary, previous);
        if (next !== previous) push(boundary, next);
        previous = next; last = boundary;
      }
      if (elapsed > last) push(elapsed, state[field]);
      row.marker.position.set(left + width * elapsed / C.duration, state[field] ? high : -high, .17);
    } else row.marker.position.set(left + width * elapsed / C.duration, 0, .17);
    // Unused vertices stay inside the panel, including after seeking backward.
    for (let i = row.count; i < capacity; i++) row.positions.set([left, 0, .17], i * 3);
    row.geometry.setDrawRange(0, row.count);
    row.geometry.attributes.position.needsUpdate = true; row.geometry.computeBoundingSphere();
    row.unknown.geometry.attributes.position.setXYZ(1, left + width * elapsed / C.duration, 0, .17);
    row.unknown.geometry.attributes.position.needsUpdate = true; row.unknown.geometry.computeBoundingSphere();
  }

  control('power', 'Shared power', 0, 1, 1, 1, '', 'Common example power. Every selection starts a fresh observation.', [{value: 0, label: 'Off'}, {value: 1, label: 'On'}]);
  control('report', 'Imposed report', 0, 2, 1, 0, '', 'An externally supplied report schedule, not an internal fault detector.', reportNames.map((label, value) => ({value, label})));
  control('lamp', 'Indicator path', 0, 2, 1, 0, '', 'Working switch and LED, open LED lead, or switch stuck conducting. The current follows the chosen circuit condition.', lampNames.map((label, value) => ({value, label})));
  control('sound','Backup sound',0,1,1,0,'','Optional synthesized tone. Sound occurs only during playback, and replay starts muted.',[{value:0,label:'Muted'},{value:1,label:'Sound on'}],{replay:false});
  let elapsed = 0, started = false, complete = false, lastClock = 0;
  let audioContext,oscillator,gain,audioError=false,playing=false;
  function mute(){if(gain&&audioContext)gain.gain.setValueAtTime(0,audioContext.currentTime);}
  function setSound(enabled){
    if(!enabled){mute();return;}
    try{
      const Audio=globalThis.AudioContext;if(!Audio){audioError=true;return;}
      if(!audioContext){audioContext=new Audio();oscillator=audioContext.createOscillator();gain=audioContext.createGain();gain.gain.value=0;oscillator.frequency.value=880;oscillator.connect(gain);gain.connect(audioContext.destination);oscillator.start();}
      audioError=false;audioContext.resume().catch(()=>{audioError=true;});
    }catch{audioError=true;}
  }
  const result = finish(values => {
    const s = sampleAirbagWarningIndicator(values, elapsed), unavailable = 'Unavailable (power off)';
    reportLabel.show(!s.powered ? 2 : s.reportedCondition ? 1 : 0);
    phaseLabel.show(!s.powered ? 2 : s.startupActive ? 0 : 1);
    powerLabel.show(values.power);ledLink.visible=!s.ledOpen;openLabel.visible=s.ledOpen;
    const a=new THREE.Vector3(-.7,0,.28),b=new THREE.Vector3(-.7+1.4*Math.cos(s.switchClosed?0:.55),1.4*Math.sin(s.switchClosed?0:.55),.28);
    switchBlade.position.copy(a.clone().add(b).multiplyScalar(.5));switchBlade.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),b.sub(a).normalize());
    waves.forEach(w=>{w.visible=s.toneActive;});buzzerFace.material.color.setHex(s.toneActive?0x83b4c1:0xb4c5b0);
    currentMarkers.forEach((marker,i)=>{marker.visible=s.ledCurrent>0;const distance=((elapsed*.18+i/currentMarkers.length)%1)*pathLengths.at(-1);let j=1;while(pathLengths[j]<distance)j++;marker.position.fromArray(currentPath[j-1]).lerp(new THREE.Vector3(...currentPath[j]),(distance-pathLengths[j-1])/(pathLengths[j]-pathLengths[j-1]));});
    lens.material.color.setHex(s.visibleLamp ? 0xde3026 : 0x582c29);
    lens.material.emissive.setHex(s.visibleLamp ? 0xa61915 : 0x000000); lens.material.emissiveIntensity = s.visibleLamp ? .8 : 0;
    rows.forEach(row => updateRow(row, s));
    if(audioContext?.state==='running')gain.gain.setTargetAtTime(values.sound&&playing&&!complete&&s.toneActive?.035:0,audioContext.currentTime,.005);
    const message = !s.powered ? 'The lens is dark; report and command are unavailable.' : s.backupRequested ? 'Missing startup current remains recorded; the backup pattern continues even when command and light agree.' : !s.agreement ? 'The requested and visible states differ now; inspect their history.' : s.reportedCondition ? 'A report is present and command matches the lamp. A match is not a health verdict.' : s.startupActive ? 'Initial illumination is requested. Compare the command with the visible lamp.' : 'Command and lamp match now. Their earlier history can still differ.';
    return {state: {...s, started, complete, progress: elapsed / C.duration, soundReady:audioContext?.state==='running'&&!audioError}, readings: [
      reading('Your result',message,'Present agreement cannot replace the observed startup history or the retained missing-current request.'),
      reading('LED branch current',fixed(s.ledCurrent*1000,1)+' mA','Current follows the complete branch: (12 V − 2 V) / 1 kΩ = 10 mA when conducting. Open lead, open switch or power off gives zero.'),
      reading('Switch conduction',s.switchClosed?'Conducting':'Open','A stuck switch conducts even when command is off. The bar visualizes electronic conduction, not a moving semiconductor contact.'),
      reading('Resistor dissipation',fixed(s.resistorPower*1000,1)+' mW','I²R. At 10 mA the resistor dissipates 100 mW; its temperature is not calculated.'),
      reading('LED electrical power',fixed(s.ledPower*1000,1)+' mW','Chosen 2 V forward drop times current. Electrical input includes heat and light, not measured optical power.'),
      reading('LED branch input power',fixed(s.branchPower*1000,1)+' mW','12 V times branch current. Equals resistor plus LED power for the ideal switch. Monitor and sounder power are outside this branch reading.'),
      reading('Missing requested current',!s.powered?unavailable:s.missingCurrent?'Yes':'No','Checks for current below the chosen 1 mA threshold while an on command is present. It cannot detect every possible failure.'),
      reading('Retained backup request',!s.powered?unavailable:s.backupRequested?'Recorded':'Not recorded','One continuous second of missing startup current retains this request for the trial. A later off command does not erase that observation.'),
      reading('Backup tone pulse',s.toneActive?'On':'Off','Five quarter-second pulses, half a second apart, repeat every four simulated seconds after qualification. This cadence is a teaching choice.'),
      reading('Shared power',s.powered?'On':'Off','Common ideal supply powers the lamp branch and monitor. Off makes diagnostic information unavailable.'),
      reading('Imposed report',reportNames[values.report],'Selected schedule stands for other restraint-system checks outside this circuit.'),
      reading('Indicator path',lampNames[values.lamp],'Cannot illuminate opens the lamp lead; Stuck illuminated forces the electronic switch on while powered.'),
      reading('Initial interval',!s.powered?unavailable:s.startupActive?'Active':'Finished','A nominal 6 s example from approximate manufacturer descriptions, not a universal timing specification.'),
      reading('Reported condition',!s.powered?unavailable:s.reportedCondition?'Present':'None','The imposed external report now. This is separate from this circuit’s missing-current backup request.'),
      reading('Lamp command',!s.powered?unavailable:s.lampCommand?'On':'Off','Startup request OR the external report; either can ask for illumination.'),
      reading('Visible lamp',s.visibleLamp?'Lit':'Dark','The LED illuminates only when its calculated branch current is positive. Brightness is not photometrically calibrated.'),
      reading('Command and lamp',s.comparison,'Instantaneous appearance compared with command. This can match while an earlier backup request remains recorded.'),
      reading('Observation time',fixed(elapsed,2)+' s','Physical teaching time. Six display seconds cover twelve simulated seconds; Step advances 0.12 simulated seconds.'),
      reading('Recording duration',fixed(C.duration,0)+' s','Complete retained interval, including startup, possible later report and recovery of agreement.'),
      reading('Observation progress',fixed(elapsed/C.duration*100,1)+' %','Observed fraction of the fixed twelve-second record.'),
      reading('Backup sound',!values.sound?'Muted':audioError?'Audio unavailable':audioContext?.state!=='running'?'Waiting for sound permission':!playing||complete?'Paused · sound off':s.toneActive?'On · synthesized tone':'On · between tones','Opt-in 880 Hz teaching tone follows the pulse envelope only while playing. Pause, Step, completion, reset and replay are silent.'),
      reading('Model limit','Chosen LED drive and missing-current check; no vehicle diagnosis or firing circuit.','Ideal switch and supply, fixed 2 V LED drop and 1 kΩ resistor. No leakage, transients, thermal model, full diagnostic coverage or manufacturer circuit reconstruction.'),
    ]};
  });
  const render = result.update;
  function restart(defaults = false, clock = false) {
    playing=false;mute();elapsed = 0; started = false; complete = false; if (clock) lastClock = 0;
    return render(defaults ? result.defaults : {});
  }
  result.update = (next = {}) => {
    const before = result.getState().values;render(next);const after=result.getState().values;if(after.sound!==before.sound)setSound(after.sound===1);
    return Object.keys(before).some(key => key!=='sound'&&before[key]!==after[key])?restart():render();
  };
  function advance(seconds) {
    if (!Number.isFinite(seconds) || seconds <= 0 || complete) return render();
    started = true; elapsed = Math.min(C.duration, elapsed + seconds*C.duration/C.displayDuration);
    if (elapsed > C.duration - 1e-12) elapsed = C.duration;
    complete = elapsed === C.duration; return render();
  }
  result.advance = advance;
  result.animate = clock => { if (!Number.isFinite(clock)) return render(); const dt = Math.max(0, clock - lastClock); lastClock = clock; return advance(dt); };
  result.reset = () => restart(true, true);
  const stages = [['Inspect start (0 s)', 0], ['Inspect 3 s', 3], ['Inspect 6 s boundary', 6], ['Inspect 7 s', 7], ['Inspect 8 s boundary', 8], ['Inspect 9 s', 9], ['Inspect final record (12 s)', 12]];
  result.actions = [{label:'Restart experiment',replay:false,run:()=>restart()},
    ...stages.map(([label,time])=>({label,replay:false,run:()=>{restart();return time?advance(time*C.displayDuration/C.duration):render();}})),
    ...[['Inspect the monitor','monitor'],['Inspect the indicator path','indicator-path'],['Inspect the warning lamp','lamp'],['Inspect the record','records'],['Inspect the lamp circuit','circuit'],['Inspect the backup sounder','buzzer']].map(([label,id])=>({label,part:id,isolate:true,view:'front',replay:false,run:()=>render()})),
    ...[['Inspect backup onset (1 s)',1],['Inspect between tones (1.25 s)',1.25]].map(([label,time])=>({label,replay:false,run:()=>{restart();return advance(time*C.displayDuration/C.duration);}}))];
  result.playback={label:'Observe the indicator sequence',stepLabel:'Advance one percent of the observation',description:'Six display seconds show twelve simulated seconds.',advance,step:()=>advance(.06),complete:()=>complete,blocked:()=>false,setPlaying:enabled=>{playing=enabled===true;if(!playing)mute();render();}};
  result.resultPart={id:'records',context:'records',view:'front',focusOnComplete:false,label:'Inspect the retained indicator history',available:()=>started};
  result.framingBounds = new THREE.Box3(new THREE.Vector3(-6.4, -10.5, -.25), new THREE.Vector3(6.4, 6.5, 1.1));
  result.initialPart='circuit';result.initialView='front';result.initialIsolated=true;result.selectionOutline=false;result.framePadding=.55;
  // The exploded view groups the circuit; the catalog links its physical parts.
  result.catalogParts=result.parts.filter(part=>part.parentId==='circuit'||part.id==='records');
  result.topology = {system,circuit,boardPart,board,headerBacking,reportInput,monitor,indicatorPath,lampPart,powerPart,resistorPart,buzzerPart,buzzerBody,buzzerFace,waves,wiresPart,feedbackPart,recordBoard,packages,terminals,positive,negative,switchA,switchB,switchBlade,resistorA,resistorB,lampA,lampB,ledLink,branchWires,infoRoutes,currentPath,pathLengths,currentMarkers,lens,records,rows,labels,textures,capacity,left,width,high,stateLabels:[reportLabel,phaseLabel,powerLabel]};
  const getState = result.getState;
  result.getState = () => { const s = getState(); return {...s, values: {...s.values}, readings: s.readings.map(r => ({...r}))}; };
  const dispose = result.dispose; let disposed = false;
  result.dispose = () => { if (disposed) return; disposed = true;mute();if(oscillator)oscillator.stop();if(audioContext)audioContext.close().catch(()=>{});dispose(); textures.forEach(texture => texture.dispose()); };
  return result;
}

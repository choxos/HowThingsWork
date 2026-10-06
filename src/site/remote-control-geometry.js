import * as THREE from 'three';
import {textLabel,fillLine,lineObject} from './scene-kit.js';
import {IR_TIMING,REMOTE_KEYS,commandName} from './remote-control-physics.js';
import {LEDS,ledVoltage,diodeAt,photonEv} from './remote-physics.js';

const C={ink:0x374736,cream:0xf0dfaf,board:0x668664,copper:0xc69457,ir:0x8a5cc2,blue:0x357386,red:0xc14f39,gold:0xe3b45e,gray:0xa2afa0};
const label=(p,text,x,y,w=5,h=.23,z=.25,color='#374736')=>textLabel(p,text,{width:w,height:h,position:[x,y,z],color});
function line(parent,points,color=C.ink){const m=lineObject(points.length,color,parent);fillLine(m,points);return m;}
function graph(parent,count,color){const m=lineObject(count,color,parent);m.frustumCulled=false;return m;}
function ownColor(mesh,color){mesh.material=mesh.material.clone();mesh.material.color.setHex(color);return mesh;}
function marker(kit,parent,pos,r=.04,color=C.gold){const m=kit.sphere(r,pos,color,parent);m.material=new THREE.MeshBasicMaterial({color,toneMapped:false});return m;}
function route(kit,parent,points,color=C.copper,r=.018){return points.slice(1).map((point,i)=>kit.rod(points[i],point,r,color,parent));}
function atPath(points,fraction){const lengths=points.slice(1).map((p,i)=>new THREE.Vector3(...p).distanceTo(new THREE.Vector3(...points[i])));let distance=lengths.reduce((a,b)=>a+b,0)*fraction;for(let i=0;i<lengths.length;i++){if(distance<=lengths[i]||i===lengths.length-1)return new THREE.Vector3(...points[i]).lerp(new THREE.Vector3(...points[i+1]),distance/lengths[i]);distance-=lengths[i];}return new THREE.Vector3(...points[0]);}
function stepTrace(intervals,until,low,high,x,y,width,span){const points=[[x,y+high,.12]];for(const [start,end] of intervals){if(start>until)break;const left=x+start/span*width,right=x+Math.min(end,until)/span*width;points.push([left,y+high,.12],[left,y+low,.12],[right,y+low,.12]);if(end>until)return points;points.push([right,y+high,.12]);}points.push([x+until/span*width,y+high,.12]);return points;}

export function createRemoteControlGeometry(kit){
  const system=kit.part('system','Handset and television','Follow a key contact through the encoder, infrared link, receiver and decoder to the television. Distances are compressed; physical sizes are illustrative.');
  const part=(id,name,description,parent=system,pos=[0,0,0])=>kit.part(id,name,description,pos,parent);
  const handset=part('handset','Handset assembly','Two cells supply the encoder and the two LED branches. Open the cover to inspect the connected board.',system,[-1.9,-.50,0]);handset.userData.explosionCategory=true;
  const shell=part('shell','Handset shell','The hollow lower case supports the cells beneath the board. Isolate the cells or separate the assembly to see the battery bay.',handset);kit.box([2.84,1.46,.07],[0,0,-.70],C.ink,shell);
  for(const y of [-.70,.70])kit.box([2.84,.06,.81],[0,y,-.26],C.ink,shell);
  for(const x of [-1.39,1.39])kit.box([.06,1.36,.81],[x,0,-.26],C.ink,shell);
  const board=part('board','Circuit board and rails','Copper tracks connect the shared cell supply and return. Each key has its own encoder input and a common return. Signal traces cross on separate layers beneath the board.',handset);kit.box([2.60,1.22,.055],[0,0,-.015],C.board,board);
  const cover=part('cover','Keypad cover','A plastic cover with openings around the moving keys. Remove it to reveal the board.',handset);
  const shape=new THREE.Shape();shape.moveTo(-1.42,-.73);shape.lineTo(1.42,-.73);shape.lineTo(1.42,.73);shape.lineTo(-1.42,.73);shape.closePath();
  const keyLayout=[[0,-.88,.38],[18,-.10,.38],[26,.68,.38],[21,-.88,-.10],[19,-.10,-.10],[27,.68,-.10],[255,-.10,-.53]];
  for(const [,x,y] of keyLayout){const hole=new THREE.Path();hole.moveTo(x-.29,y-.17);hole.lineTo(x-.29,y+.17);hole.lineTo(x+.29,y+.17);hole.lineTo(x+.29,y-.17);hole.closePath();shape.holes.push(hole);}
  const coverMesh=new THREE.Mesh(new THREE.ExtrudeGeometry(shape,{depth:.07,bevelEnabled:true,bevelSegments:2,steps:1,bevelSize:.025,bevelThickness:.018}),new THREE.MeshToonMaterial({color:0xe7d4ab}));coverMesh.position.z=.16;cover.add(coverMesh);kit.covers.push(cover);
  const keypad=part('keys','Keys and contacts','Each moving key closes two contact pads. Play presses the selected key; these example codes are assigned for this lesson.',handset);
  const keys=keyLayout.map(([code,x,y])=>{
    const body=new THREE.Group();body.position.set(x,y,.22);keypad.add(body);const cap=ownColor(kit.box([.53,.27,.11],[0,0,.04],code===0?C.red:C.ink,body),code===0?C.red:C.ink);
    label(body,REMOTE_KEYS.find(k=>k.value===code).symbol,0,.005,.47,.105,.103,'#fff8e8');
    const contacts=[-.095,.095].map(dx=>kit.box([.13,.14,.012],[x+dx,y,.073],C.copper,board));
    const bridge=kit.box([.37,.15,.025],[0,0,-.055],0x333333,body);
    return {code,body,cap,bridge,contacts,rest:body.position.clone()};
  });
  const cells=part('cells','Two series cells','Two AAA cells in series provide the selected open-circuit voltage. Both branches share their assigned total resistance of 0.45 ohms.',handset);
  const cellBodies=[];
  for(const y of [-.37,.37]){const cell=kit.cylinder(.19,1.03,[-.70,y,-.45],0xae8056,cells);cell.rotation.z=Math.PI/2;cellBodies.push(cell);kit.cylinder(.105,.06,[y<0?-1.245:-.155,y,-.45],'metal',cells).rotation.z=Math.PI/2;}
  const batteryBridge=[[-1.23,-.37,-.45],[-1.35,-.37,-.45],[-1.35,.37,-.45],[-1.23,.37,-.45]];route(kit,cells,batteryBridge);
  const encoder=part('encoder','Encoder chip','The selected key maps to an address and command. The chip gates a carrier into timed NEC bursts. Internal logic power is outside the circuit estimate.',handset);
  kit.box([.47,.32,.14],[.68,-.44,.09],C.ink,encoder);
  const inputPins=keys.map((_,i)=>[.405,-.575+i*.044,.085]);
  for(const pin of inputPins)kit.rod(pin,[.445,pin[1],pin[2]],.009,'metal',encoder);
  for(const x of [.53,.68,.83])kit.rod([x,-.60,.085],[x,-.65,.035],.012,'metal',encoder);
  const transistor=part('transistor','Emitter switching transistor','An ideal controlled switch in the current estimate. The encoder drives its gate; its source returns to the cells.',handset);kit.box([.22,.22,.16],[1.11,-.40,.105],C.ink,transistor);
  const irResistor=part('emitter-resistor','Emitter resistor','The assigned 15 ohm resistor limits peak infrared current.',handset);kit.rod([.79,.62,.11],[1.15,.62,.11],.065,C.cream,irResistor);
  const indicatorResistor=part('indicator-resistor','Indicator resistor','The assigned 100 ohm resistor limits current in the visible indicator branch.',handset);kit.rod([-.89,.62,.11],[-.54,.62,.11],.065,C.cream,indicatorResistor);
  const emitter=part('emitter','Infrared LED','A 940 nm emitter points toward the receiver. Purple shows otherwise invisible infrared burst envelopes.',handset);
  const emitterBase=kit.cylinder(.115,.21,[1.44,.20,.12],0x7586a0,emitter);emitterBase.rotation.z=-Math.PI/2;
  const emitterLens=ownColor(kit.sphere(.116,[1.54,.20,.12],C.gray,emitter),C.gray);
  route(kit,emitter,[[1.335,.15,.12],[1.21,.15,.12],[1.21,.035,.07]],'metal');route(kit,emitter,[[1.335,.25,.12],[1.23,.25,.12],[1.23,.40,.07]],'metal');
  const indicator=part('indicator','Visible indicator LED','The encoder output sinks the red or yellow indicator current while the message is sent. Its branch shares the loaded cell rail; the output switch is ideal in this model.',handset);const indicatorLens=ownColor(kit.sphere(.07,[-1.13,.54,.24],C.red,indicator),C.red);
  const indicatorPins={anode:[-1.085,.54,.06],cathode:[-1.175,.54,.06]};
  for(const [x,y,z] of Object.values(indicatorPins))kit.rod([x,y,z],[x,y,.21],.012,'metal',indicator);
  const capacitor=part('capacitor','Supply capacitor','A capacitor spans the supply rails. It represents local decoupling; the quasi-static current estimate does not model its transients.',handset);kit.cylinder(.10,.20,[-1.11,-.48,.13],'blue',capacitor);
  const wires={
    positive:[[-.18,.37,-.45],[-.18,.67,-.45],[-.18,.67,.05],[.78,.67,.05],[.78,.62,.11]],
    emitterSupply:[[1.15,.62,.11],[1.23,.62,.07],[1.23,.40,.07]],
    emitterReturn:[[1.21,.035,.07],[1.21,-.29,.07],[1.16,-.29,.07],[1.16,-.40,.105]],
    ground:[[1.11,-.51,.07],[1.11,-.66,.05],[-.18,-.66,.05],[-.18,-.37,-.45]],
    indicatorSupply:[[-.18,.67,.05],[-.89,.67,.05],[-.89,.62,.11]],
    indicatorFeed:[[-.54,.62,.11],[-.54,.56,.06],[-1.085,.56,.06],indicatorPins.anode],
    indicatorReturn:[indicatorPins.cathode,[-1.29,.54,.06],[-1.29,-.72,.08],[.53,-.72,.08],[.53,-.60,.085]],
    encoderSupply:[[-.18,.67,.05],[.95,.67,.05],[.95,-.20,.035],[.83,-.20,.035],[.83,-.28,.09]],
    encoderReturn:[[.68,-.60,.085],[.68,-.66,.05]],
    gate:[[.91,-.44,.09],[1.0,-.44,.07],[1.0,-.40,.105]],
    capacitorPositive:[[-1.05,-.48,.05],[-.98,-.48,.05],[-.98,.67,.05],[-.18,.67,.05]],
    capacitorReturn:[[-1.17,-.48,.05],[-1.17,-.66,.05]],
  };
  const wireMeshes=Object.fromEntries(Object.entries(wires).map(([name,points])=>[name,route(kit,board,points,name==='ground'||name.endsWith('Return')?C.blue:C.copper,.012)]));
  const keyRoutes=keys.map(({contacts},i)=>{
    const z=-.07-i*.018,left=contacts[0].position.toArray(),right=contacts[1].position.toArray(),pin=inputPins[i];
    return {input:[left,[left[0],left[1],z],[pin[0]-.035,left[1],z],[pin[0]-.035,pin[1],z],pin],return:[right,[right[0],right[1],-.21],[right[0],-.66,-.21],[-.18,-.66,-.21],[-.18,-.66,.05]]};
  });
  const keyWires=keyRoutes.flatMap(paths=>[...route(kit,board,paths.input,C.copper,.006),...route(kit,board,paths.return,C.blue,.006)]);
  const currentPath=[...wires.positive,[1.15,.62,.11],...wires.emitterSupply.slice(1),[1.23,.25,.12],[1.335,.25,.12],[1.54,.20,.12],[1.335,.15,.12],[1.21,.15,.12],...wires.emitterReturn,[1.11,-.40,.105],...wires.ground,...batteryBridge,[-.18,.37,-.45]];
  const currentMarkers=Array.from({length:8},()=>marker(kit,board,[0,0,0],.024));

  const television=part('television','Television assembly','A powered receiver and decoder accept the appropriate command. Received light carries information; it does not power the television.');television.userData.explosionCategory=true;
  const chassis=part('tv-chassis','TV chassis and cover','Open this cover to see the receiver connections beneath the screen.',television);kit.box([2.73,2.19,.29],[1.20,.17,-.15],C.ink,chassis);kit.box([2.73,.53,.10],[1.20,-.655,.255],C.ink,chassis);kit.covers.push(chassis);
  const feet=part('tv-stand','TV stand','A support for the screen and receiver board.',television);kit.rod([.30,-.79,-.06],[.02,-1.18,.20],.07,C.ink,feet);kit.rod([2.12,-.79,-.06],[2.42,-1.18,.20],.07,C.ink,feet);
  const tvBoard=part('tv-board','Receiver board and connections','The receiver output goes to the decoder, with a separate DC supply and common return.',television);kit.box([2.47,.58,.05],[1.20,-.59,.04],C.board,tvBoard);
  const screen=part('screen','Television screen','The accepted command changes the channel picture, volume bars, mute state or power. Every transmission begins at channel 2 and volume 4.',television);
  const screenFace=ownColor(kit.box([2.45,1.51,.07],[1.20,.43,.065],'blue',screen),0x7fb1c4);
  const pictures=Array.from({length:4},(_,index)=>{
    const group=new THREE.Group();screen.add(group);
    if(index===0){for(const [x,y,r] of [[.55,.43,.35],[1.22,.56,.43],[1.85,.42,.33]]){const m=kit.box([r*1.3,r*1.3,.025],[x,y,.13],0x668664,group);m.rotation.z=Math.PI/4;}kit.disk(.14,.025,[2.08,.82,.15],C.gold,group);}
    if(index===1){for(let i=0;i<4;i++)route(kit,group,Array.from({length:23},(_,j)=>[.1+j*.10,-.05+i*.16+Math.sin(j*.8+i)*.035,.14]),0x36778d,.028);kit.disk(.20,.025,[.55,.84,.15],C.gold,group);kit.box([.75,.07,.025],[1.60,.57,.14],'cream',group);}
    if(index===2){kit.box([.68,.54,.03],[1.18,.39,.13],'cream',group);const roof=kit.box([.50,.50,.025],[1.18,.65,.14],'clay',group);roof.rotation.z=Math.PI/4;kit.box([.18,.32,.035],[1.18,.25,.17],'wood',group);for(const x of [.50,1.90]){kit.rod([x,.05,.14],[x,.55,.14],.032,'wood',group);kit.disk(.25,.04,[x,.70,.14],'leaf',group);}}
    if(index===3){kit.disk(.35,.03,[1.12,.53,.14],C.gold,group);const ring=kit.ring(.57,.035,[1.12,.53,.16],'cream',group);ring.scale.y=.36;for(const [x,y] of [[.32,.93],[2.08,.80],[.43,.18],[2.1,.09]])kit.disk(.035,.025,[x,y,.14],'cream',group);}
    return group;
  });
  kit.box([2.44,.23,.025],[1.20,1.065,.17],0x3e5b65,screen);
  const screenText=label(screen,'CHANNEL 2',1.20,1.065,1.85,.14,.192,'#fff8e8');
  const volumeBars=Array.from({length:10},(_,i)=>ownColor(kit.box([.115,.10,.025],[.45+i*.16,-.21,.14],C.gold,screen),C.gold));
  const volumeText=label(screen,'VOLUME 4',1.20,-.04,1.70,.12,.18,'#fff8e8');
  const receiver=part('receiver-module','Infrared receiver module','Its lens, PIN diode, amplifier, carrier filter and demodulator produce low output intervals. The detailed view explains this functional chain.',television);
  kit.box([.35,.28,.19],[.08,-.30,.18],C.ink,receiver);const receiverLens=ownColor(kit.sphere(.105,[-.09,-.30,.19],C.gray,receiver),C.gray);
  const decoder=part('decoder','TV decoder','A complete frame must pass timing, inverse-byte and address checks. Only then can an assigned code change the TV.',television);const decoderBody=ownColor(kit.box([.50,.29,.14],[1.08,-.58,.16],C.ink,decoder),C.ink);
  const supply=part('tv-supply','TV power connection','An independent supply powers the receiver and decoder. Light from the handset delivers information.',television);kit.box([.34,.30,.15],[2.15,-.57,.15],'blue',supply);label(supply,'5 V',2.15,-.56,.25,.10,.234,'#fff8e8');
  const tvWires={positive:[[2.15,-.42,.16],[2.15,-.34,.08],[.18,-.34,.08],[.18,-.30,.18]],return:[[.08,-.44,.18],[.08,-.78,.08],[2.15,-.78,.08],[2.15,-.72,.15]],signal:[[-.02,-.44,.18],[-.02,-.55,.08],[.83,-.55,.16]],decoderSupply:[[1.08,-.43,.16],[1.08,-.34,.08]],decoderReturn:[[1.08,-.73,.16],[1.08,-.78,.08]],screen:[[1.33,-.58,.16],[1.52,-.58,.12],[1.52,-.32,.12]],screenSupply:[[2.15,-.34,.08],[1.86,-.34,.10],[1.86,-.32,.12]],screenReturn:[[.59,-.32,.12],[.59,-.78,.08]]};
  const tvWireMeshes=Object.fromEntries(Object.entries(tvWires).map(([key,points])=>[key,route(kit,tvBoard,points,key.toLowerCase().includes('return')?C.blue:C.copper,.015)]));
  const blocker=part('blocker','Hand in the light path','An opaque hand blocks the direct link in this model; room reflections are excluded.');const palm=kit.box([.22,.58,.13],[0,0,.18],0xd9a88a,blocker);for(let i=0;i<4;i++)kit.rod([-.075+i*.05,.20,.18],[-.075+i*.05,.46-(i===0?.06:0),.18],.035,0xd9a88a,blocker);
  const beam=new THREE.Group();beam.userData.explosionExcluded=true;system.add(beam);const beamLine=graph(beam,2,C.ir),beamMarkers=Array.from({length:6},()=>marker(kit,beam,[0,0,0],.033,C.ir));beamLine.material.transparent=true;
  const guides=new THREE.Group();guides.userData.explosionExcluded=true;system.add(guides);
  const pathLabel=label(guides,'',0,1.60,6.2,.25,.55),status=label(guides,'',0,-1.79,6.2,.25,.55);
  for(const m of guides.children)if(m.material)m.material.side=THREE.FrontSide;

  const detail=(id,name,description)=>{const p=part(id,name,description);p.userData.inspectionOnly=id;p.userData.explosionExcluded=true;return p;};
  const signal=detail('signal','Code and carrier','A full NEC frame above, with separately magnified carrier pulses below. Byte labels distinguish numeric values from chronological bit order.');
  label(signal,'TIMING CARRIES THE COMMAND',0,2.36,5.2,.27);
  const signalHeader=label(signal,'',0,2.02,5.2,.21),signalGuide=graph(signal,160,C.gray),signalTrace=graph(signal,160,C.ir),outputGuide=graph(signal,160,C.gray),outputTrace=graph(signal,160,C.blue),signalCursor=graph(signal,2,C.gold);
  label(signal,'Transmitted burst envelope',0,1.64,4.8,.18);label(signal,'Receiver output: low during a detected burst',0,.87,4.9,.18);
  const bits=Array.from({length:32},(_,i)=>{const row=i>=16?1:0,col=i%16,x=-2.20+col*.292,y=.03-row*.39;const block=ownColor(kit.box([.265,.27,.03],[x,y,.06],C.gray,signal),C.gray);const word=label(signal,'',x,y,.25,.18,.095);return {block,word};});
  label(signal,'Address then inverse',0,.25,4.8,.18);label(signal,'Command then inverse',0,-.73,4.8,.18);
  const carrierTrace=graph(signal,220,C.ir);label(signal,'One 562.5 μs mark, enlarged',0,-1.12,4.8,.20);const carrierText=label(signal,'',0,-1.92,5.2,.20),decoderText=label(signal,'',0,-2.24,5.2,.19);

  const led=detail('led','Light from a diode','Forward current brings electrons and holes together. The colored rays illustrate emission; the graph uses assigned fits to typical LED data.');
  label(led,'CURRENT BECOMES LIGHT',0,2.36,5.2,.27);const ledTitle=label(led,'',0,2.00,5.2,.21);
  kit.box([1.68,.64,.07],[-.95,1.18,0],0xeccdc6,led);kit.box([.22,.64,.07],[0,1.18,0],C.cream,led);kit.box([1.68,.64,.07],[.95,1.18,0],0xc6d8ea,led);
  label(led,'p: holes',-.99,1.64,1.6,.20);label(led,'n: electrons',.99,1.64,1.6,.20);const ledHoles=Array.from({length:8},()=>marker(kit,led,[0,0,.15],.052,C.red)),ledElectrons=Array.from({length:8},()=>marker(kit,led,[0,0,.15],.052,C.blue)),ledPhotons=graph(led,36,C.ir);
  line(led,[[-2,-1.43,.05],[-2,.36,.05],[2,.36,.05]],C.gray);line(led,[[-2,-1.43,.05],[2,-1.43,.05]],C.ink);
  const ledCurves=[C.ir,C.red,C.gold].map(color=>graph(led,121,color)),ledCross=graph(led,5,C.ink),ledLoad=graph(led,80,C.gray);
  label(led,'Voltage (V)',0,-1.78,4.8,.20);label(led,'Current: 1 μA → 1 A, logarithmic',0,.58,5.0,.20);const ledReading=label(led,'',0,-2.16,5.2,.21);
  for(const volts of [0,1,2,3.4])label(led,String(volts),-2+4*volts/3.4,-1.56,.45,.14);
  for(const [amps,text] of [[1e-6,'1 μA'],[.001,'1 mA'],[1,'1 A']])label(led,text,-2.25,ledY(amps),.42,.14);
  for(const [text,x,color] of [['IR',-1.4,'#8a5cc2'],['Red',0,'#c14f39'],['Yellow',1.4,'#ae7928']])label(led,text,x,.78,1.1,.15,.25,color);

  const photo=detail('photo','Detecting the infrared','A reverse-biased PIN element creates charge pairs when light is absorbed. A functional receiver chain rejects the wrong carrier and returns a pulse envelope.');
  label(photo,'LIGHT BECOMES A SIGNAL',0,2.36,5.2,.27);label(photo,'Illustrative PIN element; BPW34-like current estimate',0,2.01,5.2,.19);
  kit.box([.23,.57,.05],[-1.02,1.25,0],0xeccdc6,photo);kit.box([1.82,.57,.05],[0,1.25,0],0xeeeece,photo);kit.box([.23,.57,.05],[1.02,1.25,0],0xc6d8ea,photo);label(photo,'−   p    intrinsic layer    n   +',0,1.70,3.8,.20);
  const photoRay=graph(photo,25,C.ir);fillLine(photoRay,Array.from({length:25},(_,i)=>[-2.05+i*.073,1.25+Math.sin(i*Math.PI/2)*.035,.19]));
  const pairs=Array.from({length:12},(_,i)=>({electron:marker(kit,photo,[0,0,.14],.044,C.blue),hole:marker(kit,photo,[0,0,.14],.044,C.red),seed:i/12}));
  const blocks=['PIN','Gain','38 kHz','Envelope','Decoder'].map((text,i)=>{const x=-1.96+i*.98,mesh=ownColor(kit.box([.84,.39,.05],[x,.53,.06],C.gray,photo),C.gray);label(photo,text,x,.53,.80,.16,.105);if(i<4)line(photo,[[x+.43,.53,.05],[x+.54,.53,.05]],C.ink);return mesh;});
  const receiveCurve=graph(photo,100,C.ir),receiveCross=graph(photo,5,C.ink);line(photo,[[-2,-1.38,.05],[-2,.04,.05]],C.ink);line(photo,[[-2,-1.38,.05],[2,-1.38,.05]],C.ink);
  const thresholdY=-1.38+Math.log10(.12/.01)/4*1.42;line(photo,[[-2,thresholdY,.07],[2,thresholdY,.07]],C.red);
  label(photo,'Distance 1 → 30 m, logarithmic',0,-1.65,5.0,.19);label(photo,'0.01 → 100 mW/m², logarithmic',0,.15,5.0,.18);
  label(photo,'0.12',-2.24,thresholdY,.40,.14);
  const photoReading=label(photo,'',0,-1.98,5.2,.21),photoResult=label(photo,'',0,-2.28,5.2,.18);

  const diode=detail('junction','Diode bias comparison','A separate 1N4148 diagnostic probe compares forward current with reverse leakage. It is not placed in the infrared signal path.');
  label(diode,'WHICH WAY CAN CURRENT FLOW?',0,2.36,5.2,.27);label(diode,'Separate diagnostic probe · 1N4148 fit at 25 °C',0,2.02,5.2,.19);
  kit.box([1.65,.65,.06],[-.86,1.22,0],0xeccdc6,diode);kit.box([1.65,.65,.06],[.86,1.22,0],0xc6d8ea,diode);const depletion=kit.box([.18,.67,.08],[0,1.22,.02],C.cream,diode);
  const diodeSigns=label(diode,'',0,1.72,4.8,.22),diodeCarriers=Array.from({length:12},()=>marker(kit,diode,[0,0,.15],.045,C.blue));
  const reverseCurve=graph(diode,101,C.blue),forwardCurve=graph(diode,121,C.red),diodeCross=graph(diode,5,C.ink);
  for(const [x0,x1] of [[-2,-.20],[.20,2]])line(diode,[[x0,.35,.04],[x0,-1.37,.04],[x1,-1.37,.04]],C.gray);
  label(diode,'−20 to 0 V',-1.1,-1.67,2.0,.20);label(diode,'0 to 0.9 V',1.1,-1.67,2.0,.20);label(diode,'|Current|: 1 pA → 1 A, logarithmic',0,.59,5.1,.19);const diodeReading=label(diode,'',0,-2.02,5.2,.21);label(diode,'Carrier motion and depletion width are illustrative',0,-2.29,5.2,.18);
  return {system,handset,shell,cover,keypad,keys,cells,cellBodies,board,encoder,inputPins,transistor,irResistor,indicatorResistor,emitter,emitterLens,indicator,indicatorLens,indicatorPins,capacitor,wires,wireMeshes,keyRoutes,keyWires,currentPath,currentMarkers,television,chassis,feet,tvBoard,screen,screenFace,pictures,screenText,volumeBars,volumeText,receiver,receiverLens,decoder,decoderBody,supply,tvWires,tvWireMeshes,blocker,palm,beam,beamLine,beamMarkers,guides,pathLabel,status,signal,signalHeader,signalGuide,signalTrace,outputGuide,outputTrace,signalCursor,bits,carrierTrace,carrierText,decoderText,led,ledTitle,ledHoles,ledElectrons,ledPhotons,ledCurves,ledCross,ledLoad,ledReading,photo,photoRay,pairs,blocks,receiveCurve,receiveCross,photoReading,photoResult,diode,depletion,diodeSigns,diodeCarriers,reverseCurve,forwardCurve,diodeCross,diodeReading};
}

const cross=(x,y)=>[[x-.055,y,.16],[x+.055,y,.16],[x,y,.16],[x,y-.055,.16],[x,y+.055,.16]];
const ledY=current=>-1.43+Math.max(0,Math.min(6,Math.log10(Math.max(1e-6,current)/1e-6)))/6*1.79;
const diodeY=current=>-1.37+Math.max(0,Math.min(12,Math.log10(Math.max(1e-12,Math.abs(current))/1e-12)))/12*1.72;
export function updateRemoteControlGeometry(g,s,p){
  const v=s.values,selected=LEDS[v.emitter],shown=v.emitter===0?p.on.infrared:p.on.indicator;
  g.television.position.x=.37+(v.distance-5)*.022;
  const beamStart=[-.245,-.30,.12],beamEnd=[g.television.position.x-.19,-.30,.19],middle=(beamStart[0]+beamEnd[0])/2;
  g.blocker.position.set(middle,v.blocked?-.30:-1.02,0);g.blocker.visible=true;
  fillLine(g.beamLine,[beamStart,v.blocked?[middle,-.30,.16]:beamEnd]);g.beamLine.visible=s.bursting;
  g.beamLine.material.opacity=.2+.8*Math.min(1,p.on.infrared.current/.125);
  g.beamMarkers.forEach((m,i)=>{m.visible=s.bursting;m.scale.setScalar(Math.sqrt(p.on.infrared.current/.106));m.position.copy(new THREE.Vector3(...beamStart).lerp(new THREE.Vector3(...(v.blocked?[middle,-.30,.16]:beamEnd)),(s.clock*1.1+i/6)%1));});
  g.keys.forEach(key=>{key.body.position.z=key.rest.z-(key.code===v.command&&s.keyDown?.09:0);key.cap.material.color.setHex(key.code===v.command?C.gold:key.code===0?C.red:C.ink);});
  g.emitterLens.material.color.setHex(s.bursting?C.ir:C.gray);g.indicatorLens.material.color.setHex(s.indicatorOn?(v.emitter===2?C.gold:C.red):0x713e33);
  g.receiverLens.material.color.setHex(s.low?C.gold:C.gray);g.decoderBody.material.color.setHex(s.accepted?0x82a56d:C.ink);
  g.currentMarkers.forEach((m,i)=>{m.visible=s.bursting;m.position.copy(atPath(g.currentPath,(s.clock*.7+i/g.currentMarkers.length)%1));});
  g.pictures.forEach((picture,index)=>picture.visible=s.tv.on&&s.tv.channel===index+1);
  g.screenFace.material.color.setHex(s.tv.on?(s.tv.channel===4?0x425173:0x7fb1c4):0x252e2d);
  g.screenText.userData.setText(s.tv.on?`CHANNEL ${s.tv.channel}`:'POWER OFF');g.volumeText.userData.setText(s.tv.on?(s.tv.muted?'MUTED':`VOLUME ${s.tv.volume}`):'');
  g.volumeBars.forEach((bar,i)=>{bar.visible=s.tv.on;bar.material.color.setHex(!s.tv.muted&&i<s.tv.volume?C.gold:0x677a79);});
  g.pathLabel.userData.setText(`${v.distance} m · ${v.battery.toFixed(1)} V cells · ${commandName(v.command)}`);g.status.userData.setText(s.phase);
  const until=s.started?Math.min(s.time,p.duration):0;
  if(g.planKey!==JSON.stringify(v)){
    g.planKey=JSON.stringify(v);
    fillLine(g.signalGuide,stepTrace(p.marks,p.duration,.40,0,-2.25,1.10,4.5,p.duration));
    fillLine(g.outputGuide,stepTrace(p.output,p.duration,0,.38,-2.25,.42,4.5,p.duration));
    g.signalHeader.userData.setText(`Address ${v.address} · code ${v.command} · ${(p.frameEnd*1000).toFixed(4)} ms`);
    g.bits.forEach(({word},i)=>word.userData.setText(String(p.bits[i])));
    const carrier=[];for(let i=0;i<IR_TIMING.mark*p.frequency;i++){const a=i/p.frequency,b=Math.min(IR_TIMING.mark,(i+IR_TIMING.duty)/p.frequency),x=t=>-2.25+4.5*t/IR_TIMING.mark;carrier.push([x(a),-1.62,.12],[x(a),-1.26,.12],[x(b),-1.26,.12],[x(b),-1.62,.12]);}fillLine(g.carrierTrace,carrier);
    g.carrierText.userData.setText(`${v.carrier} kHz carrier · ${(1e6/p.frequency).toFixed(2)} μs per cycle · one-third on`);
    g.ledTitle.userData.setText(`${selected.sheet.name} · ${selected.sheet.peak} nm · ${photonEv(selected.sheet.peak).toFixed(2)} eV per photon`);
    g.ledCurves.forEach((curve,index)=>fillLine(curve,Array.from({length:121},(_,i)=>{const current=1e-6*(index===0?1e6:3e4)**(i/120);return [-2+4*ledVoltage(LEDS[index],current)/3.4,ledY(current),.10];})));
    fillLine(g.ledCross,cross(-2+4*shown.voltage/3.4,ledY(shown.current)));
    fillLine(g.ledLoad,Array.from({length:80},(_,i)=>{const current=1e-6*(p.on.rail/selected.resistor/1e-6)**(i/79);return [-2+4*Math.max(0,p.on.rail-current*selected.resistor)/3.4,ledY(current),.09];}));
    g.ledReading.userData.setText(`${(shown.current*1000).toFixed(2)} mA at ${shown.voltage.toFixed(3)} V (carrier on)`);
    const ey=e=>-1.38+Math.max(0,Math.min(4,Math.log10(Math.max(.01,e)/.01)))/4*1.42,dx=d=>-2+4*Math.log(d)/Math.log(30);
    fillLine(g.receiveCurve,Array.from({length:100},(_,i)=>{const distance=30**(i/99);return [dx(distance),ey(p.intensity/distance**2),.1];}));fillLine(g.receiveCross,cross(dx(v.distance),ey(p.irradiance)));
    g.photoReading.userData.setText(`${p.irradiance.toFixed(3)} mW/m² · light adds ${(p.light*1e9).toFixed(2)} nA`);
    g.photoResult.userData.setText(v.blocked?'Hand blocks the direct beam':!p.strong?'Below assigned 0.12 mW/m² threshold':!p.tuned?'56 kHz fails the assigned 38 kHz rule':'Enough light at the selected 38 kHz carrier');
    fillLine(g.reverseCurve,Array.from({length:101},(_,i)=>{const voltage=-20+20*i/100;return [-2+1.8*i/100,diodeY(diodeAt(voltage).current),.1];}));
    fillLine(g.forwardCurve,Array.from({length:121},(_,i)=>{const voltage=.9*i/120;return [.2+1.8*i/120,diodeY(diodeAt(voltage).current),.1];}));
    fillLine(g.diodeCross,cross(v.probe<0?-2+(v.probe+20)/20*1.8:.2+v.probe/.9*1.8,diodeY(p.diagnosticDiode.current)));
    g.depletion.scale.x=p.depletion;g.diodeSigns.userData.setText(v.probe<0?'−  p side        n side  +':v.probe>0?'+  p side        n side  −':'p side       zero applied bias       n side');
    g.diodeReading.userData.setText(`${v.probe.toFixed(2)} V · ${(p.diagnosticDiode.current*(Math.abs(p.diagnosticDiode.current)<1e-6?1e9:1e3)).toFixed(3)} ${Math.abs(p.diagnosticDiode.current)<1e-6?'nA':'mA'}`);
  }
  fillLine(g.signalTrace,stepTrace(p.marks,until,.40,0,-2.25,1.10,4.5,p.duration));fillLine(g.outputTrace,stepTrace(p.output,until,0,.38,-2.25,.42,4.5,p.duration));
  fillLine(g.signalCursor,[[-2.25+4.5*until/p.duration,.42,.15],[-2.25+4.5*until/p.duration,1.51,.15]]);
  g.bits.forEach(({block},i)=>block.material.color.setHex(i<s.decodedCount?(s.done&&!p.decoded.valid?C.red:0x85ab75):C.gray));
  g.decoderText.userData.setText(s.done?(s.accepted?'Frame accepted; television changed':s.phase):`${s.decodedCount}/32 bits received · bytes are sent LSB first`);
  const lit=v.emitter===0?s.bursting:s.sending,phase=s.onTime*230;
  g.ledHoles.forEach((m,i)=>m.position.set(-1.68+((phase+i/8)%1)*1.53,1.02+(i%3)*.15,.15));g.ledElectrons.forEach((m,i)=>m.position.set(1.68-((phase+i/8)%1)*1.53,1.02+(i%3)*.15,.15));
  fillLine(g.ledPhotons,lit?Array.from({length:6},(_,i)=>{const x=(i-2.5)*.14,y=1.50+(phase+i/6)%1*.35;return [[x,y,.15],[x+.05,y+.07,.15],[x-.02,y+.14,.15]];}).flat():[]);g.ledPhotons.material.color.setHex([C.ir,C.red,C.gold][v.emitter]);
  g.photoRay.visible=s.bursting&&p.light>0;
  g.pairs.forEach(({electron,hole,seed},i)=>{const age=(s.time*260+seed)%1,count=Math.min(12,Math.max(1,Math.round(s.envelopePhotocurrent*1e9)));electron.visible=hole.visible=i<count;electron.position.set(.02+age*.80,1.07+(i%3)*.15,.15);hole.position.set(-.02-age*.80,1.07+(i%3)*.15,.15);});
  g.blocks.forEach((m,i)=>m.material.color.setHex((i===0?s.bursting&&p.light>0:i===4?s.accepted:s.low)?C.gold:C.gray));
  const carrierCount=Math.max(0,Math.min(12,Math.round(12*Math.log10(1+Math.abs(p.diagnosticDiode.current)/1e-9)/9)));
  g.diodeCarriers.forEach((m,i)=>{m.visible=i<carrierCount;const f=(s.time*30+i/12)%1;m.position.set(v.probe>0?1.6-3.2*f:(i%2?1:-1)*f*1.6,1.04+(i%3)*.17,.15);});
}

import * as THREE from 'three';
import {textLabel,lineObject,fillLine} from './scene-kit.js';
import {fixed} from './format.js';
import {BURGLAR_SCIENCE as C,BURGLAR_LENSLETS,burglarAt,burglarMotion,burglarZone} from './burglar-alarm-physics.js';

const P={ink:0x374736,blue:0x3873a0,gold:0xe3b45e,red:0xc14f39,purple:0x9468a6,quiet:0xb4c5b0};
const text=(parent,value,x,y,width=5,height=.2,z=.15,color='#374736')=>textLabel(parent,value,{position:[x,y,z],width,height,color});
const setText=(object,value)=>object.userData.setText(value);
const own=object=>{object.material=object.material.clone();return object;};
const guide=object=>{object.userData.explosionExcluded=true;object.userData.selectionExcluded=true;return object;};
const line=(parent,points,color=P.ink)=>{const o=lineObject(points.length,color,parent);fillLine(o,points);return guide(o);};
const v3=point=>new THREE.Vector3(...point);
const rodTo=(object,a,b)=>{const av=v3(a),bv=v3(b);object.position.copy(av).add(bv).multiplyScalar(.5);object.scale.y=av.distanceTo(bv)/object.geometry.parameters.height;object.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),bv.sub(av).normalize());};
const waveform=(parent,count,color)=>guide(lineObject(count,color,parent));
const boardText=(parent,value,x,y,width=1,height=.15)=>text(parent,value,x,y,width,height,.22,'#f0dfaf');
export const burglarRoomScale=v=>v.mode===1?5.4/v.span:Math.min(1.1,4.1/(v.range+(v.mode===0&&v.path<2?2:0)),3/(v.mode===2?v.range*.76+.408:2.125));

export function createBurglarGeometry(kit){
  const {part,box,sphere,disk,ring,rod}=kit;
  const system=part('system','Connected sensing experiment','A room signal reaches a sensing head, processing stages and a powered sounder. Electronics are enlarged beside the scaled room.');
  const room=part('room','Room and target path','Prescribed position drives the sensing calculation. The path and range belong to the experiment; unmodulated Doppler does not measure distance.',[0,0,0],system);
  const floor=box([6.55,4.7,.13],[0,2.35,-.08],'cream',room);
  box([6.55,.12,.72],[0,4.65,.3],'wood',room);box([.12,4.7,.72],[-3.24,2.35,.3],'wood',room);
  const floorGrid=new THREE.Group();room.add(guide(floorGrid));
  for(let i=1;i<=6;i++)line(floorGrid,[[-3.1,i*.65,.005],[3.1,i*.65,.005]],0xd7c8a5);
  for(let i=-3;i<=3;i++)line(floorGrid,[[i,.1,.005],[i,4.5,.005]],0xd7c8a5);
  const walker=part('target','Prescribed moving target','The orange 0.25 m wide rectangle blocks the beam and supplies the modeled thermal contrast. Doppler treats its center as one point reflector; limb micro-Doppler is omitted.',[0,0,0],room);
  const target=own(box([C.targetWidth,.002,C.targetHeight],[0,0,.9],'clay',walker));
  sphere(.13,[0,0,1.47],'metal',walker);rod([0,0,1.25],[0,0,1.37],.035,'metal',walker);
  const legs=[rod([-.07,0,.55],[-.14,0,.1],.035,'metal',walker),rod([.07,0,.55],[.14,0,.1],.035,'metal',walker)];
  const arms=[rod([-.125,0,1.2],[-.24,0,.65],.028,'metal',walker),rod([.125,0,1.2],[.24,0,.65],.028,'metal',walker)];
  for(const mesh of walker.children)if(mesh!==target&&mesh.material){own(mesh);mesh.material.transparent=true;mesh.material.opacity=.3;mesh.material.depthWrite=false;}
  const targetDot=own(sphere(.045,[0,0,.9],'gold',walker));
  const chair=part('fixed','Fixed reflector','A stationary chair represents a constant microwave return. Its constant I/Q contribution is rejected by the DC filter.',[1.95,2.8,.05],room);
  box([.5,.45,.09],[0,0,.35],'wood',chair);box([.5,.07,.5],[0,.2,.61],'wood',chair);
  for(const x of [-.2,.2])for(const y of [-.17,.17])rod([x,y,.34],[x,y,0],.03,'wood',chair);
  const roomPath=waveform(room,81,P.ink),outgoing=waveform(room,3,P.purple),returning=waveform(room,3,P.blue),fixedReturn=waveform(room,3,0x858d7c);
  const waveDots=Array.from({length:6},(_,i)=>guide(sphere(.035,[0,0,.35],i<3?'gold':'blue',room)));
  const fanRoot=guide(new THREE.Group());room.add(fanRoot);
  const zones=Array.from({length:10},(_,i)=>{const mesh=new THREE.Mesh(new THREE.BufferGeometry(),new THREE.MeshBasicMaterial({color:i%2?P.blue:P.gold,transparent:true,opacity:.16,depthWrite:false,side:THREE.DoubleSide}));mesh.geometry.setAttribute('position',new THREE.Float32BufferAttribute(new Float32Array(9),3));fanRoot.add(mesh);return mesh;});
  const roomLabel=guide(text(room,'',0,5.03,6.4,.22,.85));
  const pathLabel=guide(text(room,'',0,4.26,5.9,.18,.025));

  const electronics=part('electronics','Powered processing assembly','Follow supply and return wires separately from the weak sensor signal. The selected sensor feeds an idealized filter, threshold, timer and sounder driver.',[6.8,1.5,0],system);
  const base=part('base','Circuit support','An enlarged support exposes the electrical path. Dimensions are a teaching layout, not a product enclosure.',[0,-2.02,.05],electronics);box([6.6,3.28,.16],[0,0,0],'leaf',base);
  const battery=part('battery','Twelve-volt supply','The assigned supply provides sounder energy and feeds ideal regulated sensor and controller rails.',[-2.55,-2.4,.35],electronics);
  box([1.05,1.65,.4],[0,0,0],'ink',battery);box([1.06,.25,.41],[0,.68,0],'gold',battery);boardText(battery,'12 V',0,0,.9,.22);
  const positive=[-2.25,-1.51,.35],negative=[-2.85,-1.51,.35];sphere(.06,[.3,.89,0],'red',battery);sphere(.06,[-.3,.89,0],'blue',battery);
  const contact=part('contact','Supply contact','Opening this contact removes sensor, processor and sounder power. It does not stop the prescribed target motion.',[0,0,0],electronics),contactEnd=[-1.65,-1.51,.35];
  const blade=rod(positive,contactEnd,.025,'gold',contact);sphere(.06,contactEnd,'metal',contact);
  const regulator=part('regulator','Regulated sensor supply','The selected ideal rail supplies 3.3 V to the radar, 5 V photodiode bias, or 10 V to the PIR sensor. The battery powers the output driver separately.',[-1.08,-1.48,.25],electronics);
  box([.82,.7,.24],[0,0,0],'ink',regulator);const railText=boardText(regulator,'3.3 V',0,.04,.77,.2);boardText(regulator,'REGULATOR',0,-.19,.77,.1);
  const reference=part('reference','Reference and sensor front end','Microwave mode shares one oscillator between transmitter and mixers. Beam mode synchronizes emitter pulses and receiver checks. This active reference is idle in PIR mode; the high-impedance buffer sits beside the paired thermal elements.',[-1.08,-2.64,.25],electronics);
  box([.82,.78,.24],[0,0,0],'ink',reference);const referenceText=boardText(reference,'OSCILLATOR',0,.06,.76,.12),referenceSub=boardText(reference,'24.125 GHz',0,-.2,.76,.12);
  const processor=part('processor','Filter, threshold and confirmation','The actual calculated signal passes through the selected conditioning stage, threshold and elapsed qualification time before latching the alarm.',[.27,-1.72,.28],electronics);
  box([1.22,1.42,.3],[0,0,0],'ink',processor);
  for(let i=0;i<5;i++)for(const side of [-1,1])rod([side*.6,-.52+i*.26,0],[side*.78,-.52+i*.26,0],.02,'metal',processor);
  const processText=boardText(processor,'I / Q FILTER',0,.39,1.14,.14);boardText(processor,'THRESHOLD',0,.03,1.14,.13);boardText(processor,'50 ms TIMER',0,-.36,1.14,.13);
  const timerText=processor.children.at(-1),decision=own(sphere(.09,[0,.93,.08],'metal',processor));
  const driver=part('driver','Latched sounder driver','After qualification, the ideal latch keeps the alarm requested for the rest of this observation. Reset starts a new watch.',[.27,-2.94,.24],electronics);
  box([1.02,.62,.24],[0,0,0],'ink',driver);boardText(driver,'LATCH / DRIVE',0,0,.93,.12);
  const horn=part('horn','Powered piezoelectric sounder','The driver bends a ceramic-and-metal diaphragm using battery energy. Drawn motion and sound arcs are enlarged and slowed.',[2.12,-1.7,.29],electronics);
  disk(.74,.07,[0,0,0],'gold',horn);const ceramic=disk(.5,.045,[0,0,.062],'cream',horn),ceramicRest=ceramic.geometry.attributes.position.array.slice();ring(.74,.055,[0,0,.045],'wood',horn);
  rod([0,-.55,0],[0,-.86,0],.025,'blue',horn);rod([.2,-.25,.096],[.2,-.86,.096],.025,'red',horn);
  const hornWaves=Array.from({length:3},(_,i)=>{const mesh=new THREE.Mesh(new THREE.TorusGeometry(.9+i*.17,.018,6,30,1.6),new THREE.MeshBasicMaterial({color:P.red}));mesh.rotation.z=-.8;mesh.position.z=.12;horn.add(guide(mesh));return mesh;});
  const hornText=guide(text(horn,'QUIET',0,-1.04,1.65,.19));
  const wires=part('wires','Supply, return and signal wires','Red carries supply, blue return, gold sensor signals, and purple the active reference. Wire markers show direction symbolically, not electron speed.',[0,0,0],electronics),paths=[];
  const route=(id,points,color)=>{const objects=points.slice(1).map((p,i)=>rod(points[i],p,.022,color,wires));const route={id,points,objects,color};paths.push(route);return route;};
  route('supply-regulator',[contactEnd,[-1.5,-1.51,.35],[-1.5,-1.48,.25]],P.red);
  route('supply-driver',[contactEnd,[-1.65,-3.43,.23],[.27,-3.43,.23],[.27,-3.25,.24]],P.red);
  route('return-bus',[negative,[-3,-1.51,.12],[-3,-3.56,.12],[2.95,-3.56,.12],[2.95,-.66,.12]],P.blue);
  route('return-regulator',[[-1.08,-1.83,.25],[-1.55,-1.83,.12],[-1.55,-3.56,.12]],P.blue);
  route('return-reference',[[-1.08,-3.03,.25],[-1.08,-3.56,.12]],P.blue);
  route('return-processor',[[1.05,-2.24,.28],[1.3,-2.24,.12],[1.3,-3.56,.12]],P.blue);
  route('return-driver',[[.78,-2.94,.24],[1.05,-2.94,.12],[1.05,-3.56,.12]],P.blue);
  route('reference-power',[[-.67,-1.48,.25],[-.57,-1.48,.16],[-.57,-2.64,.16],[-.67,-2.64,.25]],P.red);
  route('processor-power',[[-.67,-1.48,.25],[-.51,-1.48,.28]],P.red);
  const refPath=route('reference-mixers',[[-.67,-2.64,.25],[-.5,-2.64,.4],[-.5,-2.3,.4],[-.51,-2.24,.28]],P.purple);
  route('request-latch',[[.27,-2.43,.28],[.27,-2.63,.24]],P.gold);
  route('drive-horn',[[.78,-2.94,.24],[2.32,-2.94,.386],[2.32,-2.56,.386]],P.red);
  route('return-horn',[[2.12,-2.56,.29],[2.12,-3.56,.12]],P.blue);

  const sensor=part('sensor','Sensing head','The microwave head transmits and receives. Beam mode uses separate posts. PIR collects thermal infrared without an emitter.',[0,-.1,.44],system);
  const radarHead=part('radar-head','Microwave transmit and receive antennas','Two enlarged ports represent a monostatic radar. The calculation uses co-located phase centers, far-field amplitude and one fixed-shape point reflector.',[0,0,0],sensor);
  box([1.14,.52,.56],[0,0,0],'cream',radarHead);
  const antennas=[];for(const x of [-.3,.3]){const patch=own(box([.36,.04,.3],[x,.28,.03],'gold',radarHead));antennas.push(patch);rod([x,-.26,0],[x,-.42,0],.024,'gold',radarHead);}
  guide(text(radarHead,'TX       RX',0,-.06,1.02,.15,.3));
  const pirHead=part('pir-head','Passive infrared window and paired elements','A lens array projects distinct directions onto opposed pyroelectric elements. Thermal changes produce a small electrical signal; there is no outgoing light.',[0,0,0],sensor);
  for(const x of [-.55,.55])box([.04,.52,.65],[x,0,0],'cream',pirHead);
  for(const z of [-.305,.305])box([1.06,.52,.04],[0,0,z],'cream',pirHead);
  const pirWindow=own(box([.91,.045,.49],[0,.29,.05],'blue',pirHead));pirWindow.material.transparent=true;pirWindow.material.opacity=.6;
  for(let i=0;i<5;i++)kit.covers.push(box([.15,.05,.375],[-.35+i*.175,.325,.05],'metal',pirHead));
  const pair=part('pair','Opposed pyroelectric pair','Heating changes charge on the two elements. Their opposed series connection feeds a high-impedance FET buffer. The joined like-polarity electrodes cancel equal changes; the outer electrodes connect to the buffer gate and return. Wiring is enlarged and schematic.',[0,.06,.035],pirHead);
  box([.16,.045,.3],[-.17,0,0],'gold',pair);box([.16,.045,.3],[.17,0,0],'blue',pair);
  for(const x of [-.17,.17])for(const y of [-.027,.027])box([.14,.008,.03],[x,y,y>0?.12:-.12],'metal',pair);
  const internalWire=(points,color)=>points.slice(1).forEach((p,i)=>rod(points[i],p,.009,color,pair));
  internalWire([[-.17,.031,.12],[-.17,.031,.19],[.17,.031,.19],[.17,.031,.12]],'gold');
  box([.16,.1,.12],[0,-.13,-.22],'ink',pair);
  internalWire([[-.17,-.031,-.12],[-.17,-.13,-.22],[-.08,-.13,-.22]],'gold');
  internalWire([[.17,-.031,-.12],[.38,-.031,-.12],[.48,-.32,-.035]],'blue');
  internalWire([[-.48,-.32,-.035],[-.32,-.23,-.035],[0,-.23,-.035],[0,-.13,-.16]],'red');
  internalWire([[.08,-.13,-.22],[.16,-.23,-.22],[.16,-.32,-.035]],'gold');
  box([.1,.035,.04],[.24,-.13,-.25],'wood',pair);
  internalWire([[-.17,-.13,-.22],[-.17,-.13,-.29],[.19,-.13,-.29],[.19,-.13,-.25]],'gold');
  internalWire([[.29,-.13,-.25],[.38,-.13,-.25],[.38,-.031,-.12]],'blue');
  const pirCover=box([1.18,.055,.69],[0,-.28,0],'cream',pirHead);kit.covers.push(pirCover,pirWindow);
  for(const head of [radarHead,pirHead])for(const [x,color]of [[-.48,'red'],[.48,'blue'],[.16,'gold'],...head===radarHead?[[-.16,0x9468a6]]:[]])rod([x,-.26,0],[x,-.42,0],.024,color,head);
  const beamPosts=part('beam-posts','Infrared transmitter and receiver posts','A bare emitter and photodiode face each other across the assigned span. The central path is an ideal pencil-ray approximation, not a commercial barrier range test.',[0,0,0],room),posts=[];
  for(let i=0;i<2;i++){
    const object=part(i?'beam-receiver':'beam-emitter',i?'Beam photodiode':'Pulsed infrared emitter',i?'The ideal synchronous receiver compares pulse photocurrent with its assigned 0.3 nA threshold.':'The emitter pulses at an assigned 1 kHz, 100 mA and 100 microseconds per pulse.',[0,0,0],beamPosts);
    box([.23,.37,.76],[0,0,.38],'ink',object);const optic=own(sphere(.1,[i?-.12:.12,0,.55],i?'blue':'gold',object));posts.push({object,optic});
  }
  const sensorPower=route('sensor-power',[[-1.08,-1.13,.25],[-1.08,-.6,.25],[-.3,-.6,.44],[-.3,-.52,.44]],P.red);
  const sensorReturn=route('sensor-return',[[.3,-.52,.44],[.3,-.62,.17],[2.95,-.62,.17],[2.95,-.66,.12]],P.blue);
  const sensorSignal=route('sensor-signal',[[.5,-.36,.44],[.75,-.48,.4],[.75,-.8,.4],[.53,-1.01,.28]],P.gold);
  const sensorReference=route('sensor-reference',[[-1.49,-2.64,.25],[-1.8,-2.64,.4],[-1.8,-.42,.4],[-.3,-.52,.44]],P.purple);
  const beamLinks=Array.from({length:5},(_,i)=>route(`beam-link-${i}`,Array.from({length:5},(_,j)=>[j*.1,0,.1]),[P.red,P.blue,P.red,P.blue,P.gold][i]));
  const wireDots=Array.from({length:12},()=>guide(sphere(.03,[0,0,0],'gold',electronics)));
  const heading=guide(text(system,'A CHANGING RETURN CAN REQUEST AN ALARM',0,5.48,6.8,.26,.25));
  const status=guide(text(system,'',3.4,-2.66,10.8,.23,.15)),footer=guide(text(system,'',3.4,-3.02,10.8,.18,.15));

  const details=[];
  const detail=(id,name,description)=>{const object=part(id,name,description,[0,0,0],system);object.userData.inspectionOnly=id;object.userData.explosionExcluded=true;details.push(object);return object;};
  const principle=detail('principle','How the selected sensor works','Inspect the current sensing method without changing its settings or clock. Schematic distances and enlarged electronics are labeled separately from physical readings.');
  const principleTitle=text(principle,'',0,2.52,5.8,.23),principleSub=text(principle,'',0,2.15,5.7,.18);
  const radarDetail=new THREE.Group(),beamDetail=new THREE.Group(),pirDetail=new THREE.Group();principle.add(radarDetail,beamDetail,pirDetail);
  const card=(parent,value,x,y,w=1.15)=>{box([w,.59,.15],[x,y,0],'ink',parent);boardText(parent,value,x,y,w-.1,.15);};
  card(radarDetail,'OSCILLATOR',-1.86,1.3);card(radarDetail,'TX',.02,1.3,.6);card(radarDetail,'TARGET',1.99,1.3,1.05);
  card(radarDetail,'RX',1.99,.2,.7);card(radarDetail,'× LO',.22,.45,.8);card(radarDetail,'× LO 90°',.22,-.6,1.15);
  line(radarDetail,[[-1.26,1.3,.15],[-.3,1.3,.15]],P.purple);line(radarDetail,[[.35,1.3,.15],[1.45,1.3,.15]],P.purple);
  line(radarDetail,[[2.55,1.3,.15],[2.72,1.3,.15],[2.72,.2,.15],[2.36,.2,.15]],P.blue);
  line(radarDetail,[[1.61,.2,.15],[1.06,.2,.15],[1.06,.45,.15],[.62,.45,.15]],P.blue);
  line(radarDetail,[[1.06,.2,.15],[1.06,-.6,.15],[.82,-.6,.15]],P.blue);
  line(radarDetail,[[-1.86,1,.15],[-1.86,-1.12,.15],[-.45,-1.12,.15],[-.45,-.6,.15]],P.purple);
  line(radarDetail,[[-1.86,.45,.15],[-.2,.45,.15]],P.purple);
  text(radarDetail,'shared reference',-1.17,-1.41,2.1,.16);text(radarDetail,'I',.28,.04,.4,.17);text(radarDetail,'Q',.28,-1.02,.4,.17);
  const phasorCenter=[1.95,-.82,.2];ring(.55,.012,phasorCenter,'metal',radarDetail);line(radarDetail,[[1.33,-.82,.2],[2.57,-.82,.2]],0x90998d);line(radarDetail,[[1.95,-1.44,.2],[1.95,-.2,.2]],0x90998d);
  const phasor=waveform(radarDetail,2,P.red),phasorText=text(radarDetail,'',0,-1.86,5.55,.2);

  for(const x of [-2.37,2.37])box([.28,.68,.42],[x,0,.14],'ink',beamDetail);
  const crossingBody=own(box([.48,C.targetWidth*2.2,.3],[0,0,.2],'clay',beamDetail));
  const crossingNear=waveform(beamDetail,2,P.purple),crossingFar=waveform(beamDetail,2,P.purple);
  line(beamDetail,[[0,-1.58,.06],[0,1.58,.06]],0x8d987e);text(beamDetail,'0.25 m body width along travel',0,1.71,5.5,.18);
  const holdBar=own(box([4.1,.13,.08],[0,-1.71,.1],'gold',beamDetail));
  const crossingText=text(beamDetail,'',0,-2.03,5.5,.19);

  const opticalScale=115,lensFacets=[],rayLines=[],imageLines=[];
  for(const s of BURGLAR_LENSLETS){
    const facet=own(box([.001*opticalScale,.055,.001*opticalScale],[s*opticalScale,0,0],'blue',pirDetail));facet.material.transparent=true;facet.material.opacity=.65;lensFacets.push(facet);
    rayLines.push(waveform(pirDetail,3,P.purple));imageLines.push(waveform(pirDetail,2,P.red));
  }
  line(pirDetail,[[-2.7,0,0],[2.7,0,0]],0x899587);line(pirDetail,[[-2.7,-C.focal*opticalScale,0],[2.7,-C.focal*opticalScale,0]],0x899587);
  const elements=[own(box([.001*opticalScale,.055,.002*opticalScale],[-.001*opticalScale,-C.focal*opticalScale,.04],'gold',pirDetail)),own(box([.001*opticalScale,.055,.002*opticalScale],[.001*opticalScale,-C.focal*opticalScale,.04],'blue',pirDetail))];
  text(pirDetail,'5 ideal lenslets',0,1.62,4.9,.17);text(pirDetail,'+     −',0,-1.7,1.9,.2);
  const opticsText=text(pirDetail,'',0,-2.03,5.55,.18);
  const principleResult=text(principle,'',0,-2.44,5.7,.19);

  const signal=detail('signal','Signals before and after conditioning','Only elapsed physical time is plotted. The microwave carrier is removed by mixing; the visible waveforms are baseband I and Q. Beam mode enlarges the actual pulse timing, and PIR shows thermal inputs and output.');
  const signalTitle=text(signal,'',0,2.5,5.8,.23),signalSub=text(signal,'',0,2.12,5.7,.18);
  const frames=[{x:-2.25,y:.33,w:4.5,h:1.35},{x:-2.25,y:-1.59,w:4.5,h:1.35}];
  for(const f of frames)line(signal,[[f.x,f.y+f.h,.08],[f.x,f.y,.08],[f.x+f.w,f.y,.08]],P.ink);
  const signalCurves=Array.from({length:4},(_,i)=>waveform(signal,450,i%2?P.blue:P.gold));
  const signalThresholds=[waveform(signal,2,P.red),waveform(signal,2,P.red)];
  const signalTop=text(signal,'',0,1.84,5.5,.17),signalBottom=text(signal,'',0,-.05,5.5,.17);
  const signalTimes=[text(signal,'',-1.9,-1.85,1.7,.16),text(signal,'',1.9,-1.85,1.7,.16)];
  const signalCaption=text(signal,'',0,-2.21,5.7,.18),signalResult=text(signal,'',0,-2.53,5.7,.17);

  const record=detail('record','Observation record','The trace stops at the current clock. Thresholds are assigned settings; the first alarm marker appears only after that event occurs.');
  const recordTitle=text(record,'',0,2.5,5.8,.23),recordSub=text(record,'',0,2.13,5.7,.18);
  line(record,[[-2.25,1.7,.08],[-2.25,-1.14,.08],[2.25,-1.14,.08]],P.ink);
  const recordCurve=waveform(record,410,P.gold),recordNegative=waveform(record,2,P.red),recordThreshold=waveform(record,2,P.red),recordCursor=waveform(record,2,0x798674),recordEvent=waveform(record,2,P.red);
  const recordLow=text(record,'0',-2.57,-1.14,.6,.15),recordHigh=text(record,'',-2.57,1.7,.65,.15);
  const recordTimes=[text(record,'0 s',-2.18,-1.42,1,.17),text(record,'',2.12,-1.42,1.3,.17)];
  const recordScale=text(record,'',0,-1.82,5.7,.19),recordResult=text(record,'',0,-2.21,5.7,.2);
  text(record,'History stays visible after a target stops or a beam clears',0,-2.55,5.7,.16);
  return {system,room,floor,walker,target,targetDot,legs,arms,chair,roomPath,outgoing,returning,fixedReturn,waveDots,fanRoot,zones,roomLabel,pathLabel,
    electronics,base,battery,contact,positive,contactEnd,blade,regulator,railText,reference,referenceText,referenceSub,processor,processText,timerText,decision,driver,horn,ceramic,ceramicRest,hornWaves,hornText,wires,paths,refPath,
    sensor,radarHead,pirHead,antennas,pair,pirWindow,beamPosts,posts,sensorPower,sensorReturn,sensorSignal,sensorReference,beamLinks,wireDots,heading,status,footer,
    details,principleTitle,principleSub,radarDetail,beamDetail,pirDetail,phasor,phasorText,crossingBody,crossingNear,crossingFar,holdBar,crossingText,opticalScale,lensFacets,rayLines,imageLines,elements,opticsText,principleResult,
    signalTitle,signalSub,frames,signalCurves,signalThresholds,signalTop,signalBottom,signalTimes,signalCaption,signalResult,
    recordTitle,recordSub,recordCurve,recordNegative,recordThreshold,recordCursor,recordEvent,recordLow,recordHigh,recordTimes,recordScale,recordResult};
}

export function updateBurglarGeometry(g,s,plan){
  const v=s.values,mode=v.mode,scale=burglarRoomScale(v),beamY=2,sensorPoint=[0,0,.9*scale],targetPoint=[s.x*scale,s.z*scale,.9*scale];
  if(mode===1){targetPoint[0]=0;targetPoint[1]=beamY+s.x*scale;}
  g.walker.scale.setScalar(scale);g.walker.position.set(targetPoint[0],targetPoint[1],0);g.walker.rotation.z=mode===1?Math.PI/2:0;
  g.sensor.position.set(0,-.28,.9*scale);
  const local=point=>point.map((value,i)=>value-g.electronics.position.getComponent(i)),height=.9*scale;
  for(const [route,points]of [
    [g.sensorPower,[[-1.08,-1.13,.25],[-1.08,-2.12,.25],local([-.48,-.62,height]),local([-.48,-.70,height])]],
    [g.sensorReturn,[local([.48,-.70,height]),local([.48,-.9,.17]),[2.95,-2.4,.17],[2.95,-.66,.12]]],
    [g.sensorSignal,[local([.16,-.70,height]),local([.16,-1.02,.4]),[.75,-2.52,.4],[.53,-1.01,.28]]],
    [g.sensorReference,[[-1.49,-2.64,.25],[-1.8,-2.64,.4],local([-.16,-1.14,.4]),local([-.16,-.70,height])]],
  ]){route.points=points;route.objects.forEach((object,i)=>rodTo(object,points[i],points[i+1]));}
  const step=s.moving?Math.sin(s.time*v.speed*7)*.13:0;
  g.legs.forEach((leg,i)=>rodTo(leg,[(i?1:-1)*.07,0,.55],[(i?1:-1)*.14,(i?1:-1)*step,.1]));
  g.arms.forEach((arm,i)=>rodTo(arm,[(i?1:-1)*.125,0,1.2],[(i?1:-1)*.24,(i?-1:1)*step,.65]));
  g.target.material.color.setHex(mode===2&&v.contrast===0?P.quiet:0xce825f);g.targetDot.material.color.setHex(mode===0?P.gold:mode===2?P.red:P.ink);
  g.radarHead.visible=mode===0;g.pirHead.visible=mode===2;g.sensor.visible=mode!==1;g.beamPosts.visible=mode===1;g.chair.visible=mode===0;g.fanRoot.visible=mode===2;
  g.posts.forEach((post,i)=>{post.object.position.set(i?2.7:-2.7,beamY,0);post.object.scale.z=(.9*5.4/v.span)/.55;});
  const motion0=burglarMotion(v,0),stop=motion0.stop??s.duration;
  const path=Array.from({length:81},(_,i)=>{const p=burglarMotion(v,C.delay+(stop-C.delay)*i/80);return mode===1?[0,beamY+p.x*scale,.02]:[p.x*scale,p.z*scale,.02];});
  fillLine(g.roomPath,path);
  if(mode===0){
    fillLine(g.outgoing,v.power?[[-.3,0,.9*scale+.03],sensorPoint,targetPoint]:[]);
    fillLine(g.returning,v.power?[targetPoint,[sensorPoint[0]+.025,sensorPoint[1],sensorPoint[2]+.02],[.3,0,.9*scale+.03]]:[]);
    fillLine(g.fixedReturn,v.power?[[.3,0,.9*scale],[1.95,2.8,.5],[0,.1,.9*scale]]:[]);
  }else if(mode===1){
    const height=.9*scale,left=[-2.7+.12,beamY,height],right=[2.7-.12,beamY,height],edge=.001*scale;
    fillLine(g.outgoing,v.power?[left,s.blocked?[-edge,beamY,height]:right]:[]);fillLine(g.returning,[]);fillLine(g.fixedReturn,[]);
  }else{
    fillLine(g.outgoing,[]);fillLine(g.returning,[]);fillLine(g.fixedReturn,[]);
    g.zones.forEach((zone,i)=>{const field=burglarZone(BURGLAR_LENSLETS[Math.floor(i/2)],i%2,v.range),points=[field.lenslet*scale,0,.018,field.x0*scale,v.range*scale,.018,field.x1*scale,v.range*scale,.018];zone.geometry.attributes.position.array.set(points);zone.geometry.attributes.position.needsUpdate=true;zone.geometry.computeBoundingSphere();});
  }
  g.waveDots.forEach((dot,i)=>{
    dot.visible=!!v.power&&mode===0;const q=(s.time*.7+(i%3)/3)%1,a=i<3?sensorPoint:targetPoint,b=i<3?targetPoint:sensorPoint;dot.position.lerpVectors(v3(a),v3(b),q);
  });
  const pathNames=['approach','recede','straight crossing','constant-radius arc'];
  setText(g.roomLabel,mode===0?`${pathNames[v.path]} · ${s.doppler.toFixed(1)} Hz Doppler now`:mode===1?`${v.span} m between posts · ${s.blocked?'beam blocked':'beam reaches receiver'}`:`${v.contrast} °C warmer · ${v.range} m in front of detector`);
  setText(g.pathLabel,mode===0?'Target position is assigned; CW radar does not measure range':mode===1?'Span scaled; posts enlarged. Inspect the crossing to see the target':'Gold and blue fields land on opposite elements');
  rodTo(g.blade,g.positive,v.power?g.contactEnd:[g.positive[0]+.22,g.positive[1]+.43,g.positive[2]]);
  setText(g.railText,`${s.sensorSupply} V`);setText(g.referenceText,['OSCILLATOR','PULSE CLOCK','IDLE REFERENCE'][mode]);setText(g.referenceSub,['24.125 GHz','1 kHz','NO EMITTER'][mode]);
  setText(g.processText,['I / Q FILTER','PULSE CHECK','HEAT CHANGE'][mode]);setText(g.timerText,`${mode===1?v.hold:50} ms TIMER`);g.decision.material.color.setHex(s.active?P.red:s.over?P.gold:P.quiet);
  g.refPath.objects.forEach(o=>o.visible=mode!==2);g.sensorReference.objects.forEach(o=>o.visible=mode===0);
  for(const p of [g.sensorPower,g.sensorReturn,g.sensorSignal])p.objects.forEach(o=>o.visible=mode!==1);
  g.beamLinks.forEach((route,i)=>{
    const right=i>=2,post=[right?2.7:-2.7,beamY-.19,.14*.9*scale/.55],end=i===4?[.53,-1.01,.28]:i%2?[2.95,-.66,.12]:right?[-.67,-1.48,.25]:[-1.49,-2.64,.25];
    const pts=[local(post),local([post[0],beamY-.55,.08]),local([post[0],-.3,.14]),[end[0],-1.8,.14],end];route.points=pts;route.objects.forEach((o,j)=>{rodTo(o,pts[j],pts[j+1]);o.visible=mode===1;});
  });
  g.posts[0].optic.material.color.setHex(v.power?P.gold:P.ink);g.posts[1].optic.material.color.setHex(v.power&&!s.blocked?P.blue:P.ink);
  const flowPaths=g.paths.filter(p=>p.objects.some(o=>o.visible)&&(!['request-latch','drive-horn','return-horn'].includes(p.id)||s.active));g.wireDots.forEach((dot,i)=>{dot.visible=!!v.power;const route=flowPaths[i%flowPaths.length],n=route.points.length-1,t=((s.time*.7+i/12)%1)*n,k=Math.min(n-1,Math.floor(t));dot.position.lerpVectors(v3(route.points[k]),v3(route.points[k+1]),t-k);});
  const positions=g.ceramic.geometry.attributes.position;
  for(let i=0;i<positions.count;i++){const x=g.ceramicRest[i*3],y=g.ceramicRest[i*3+1],z=g.ceramicRest[i*3+2];positions.setXYZ(i,x,y+(s.hornPulse?.035*Math.sin(s.time*15)*Math.max(0,1-(x*x+z*z)/.25):0),z);}
  positions.needsUpdate=true;g.ceramic.geometry.computeVertexNormals();g.ceramic.geometry.computeBoundingSphere();g.hornWaves.forEach(o=>o.visible=s.hornPulse);setText(g.hornText,s.active?'POWERED ALARM':'QUIET');
  setText(g.heading,['A CHANGING RETURN CAN REQUEST AN ALARM','A MISSING BEAM CAN REQUEST AN ALARM','CHANGING HEAT CAN REQUEST AN ALARM'][mode]);
  g.heading.visible=false;
  setText(g.status,`${!v.power?'NO POWER':s.active?'ALARM LATCHED':s.time===0?'READY':s.complete?'NO ALARM':'OBSERVING'} · ${s.time.toFixed(2)} / ${s.duration.toFixed(2)} s`);
  setText(g.footer,'Room scaled · sensors and electronics enlarged · guides and horn motion slowed');

  g.radarDetail.visible=mode===0;g.beamDetail.visible=mode===1;g.pirDetail.visible=mode===2;
  setText(g.principleTitle,['COMPARE THE RETURN WITH ITS REFERENCE','TIME A REAL BEAM INTERRUPTION','ONE LENS ARRAY, TWO OPPOSED ELEMENTS'][mode]);
  setText(g.principleSub,mode===0?'A shared oscillator feeds the transmitter and both mixers':mode===1?'Post spacing compressed here; body width follows its physical path':'Common focal plane · lenslets and elements enlarged 115 times');
  if(mode===0){
    fillLine(g.phasor,[[1.95,-.82,.23],[1.95+.55*Math.cos(s.phase),-.82+.55*Math.sin(s.phase),.23]]);
    setText(g.phasorText,`${s.doppler.toFixed(2)} Hz · ${s.radial<0?'range decreasing':s.radial>0?'range increasing':'constant range now'}`);
  }else if(mode===1){
    g.crossingBody.position.y=s.x*2.2;fillLine(g.crossingNear,v.power?[[-2.2,0,.22],s.blocked?[-.24,0,.22]:[2.2,0,.22]]:[]);fillLine(g.crossingFar,[]);
    const share=Math.min(1,s.held/(v.hold/1000));g.holdBar.scale.x=Math.max(share,.00001);g.holdBar.position.x=-2.05+2.05*share;
    setText(g.crossingText,`${(s.held*1000).toFixed(0)} ms blocked so far · setting ${v.hold} ms`);
  }else{
    const sc=g.opticalScale,front=.009;
    BURGLAR_LENSLETS.forEach((p,i)=>{
      const slope=(s.x-p)/v.range,image=p-C.focal*slope;
      fillLine(g.rayLines[i],[[(p+front*slope)*sc,front*sc,.04],[p*sc,0,.04],[image*sc,-C.focal*sc,.04]]);
      const lo=p-C.focal*(s.x+C.targetWidth/2-p)/v.range,hi=p-C.focal*(s.x-C.targetWidth/2-p)/v.range;
      fillLine(g.imageLines[i],[[lo*sc,-C.focal*sc,.1],[hi*sc,-C.focal*sc,.1]]);
    });
    g.elements.forEach((element,i)=>element.material.color.setHex(i?P.blue:P.gold).multiplyScalar(.35+.65*Math.min(1,(i?s.minus:s.plus)/6e-8)));
    setText(g.opticsText,`Power above initial room: + ${(s.plus*1e9).toFixed(2)} nW · − ${(s.minus*1e9).toFixed(2)} nW`);
  }
  setText(g.principleResult,!v.power?'Signal processing and powered horn are off':s.active?`First alarm recorded at ${s.onset.toFixed(3)} s`:'No alarm recorded at this clock');
  updateSignals(g,s,plan);updateRecord(g,s,plan);
}

const plotCache=new WeakMap();
function gridSamples(plan,times,step){
  let cache=plotCache.get(plan);if(!cache){cache=new Map();plotCache.set(plan,cache);}
  return times.map(time=>{const key=`${step}:${Math.round(time/step)}`;let sample=cache.get(key);if(!sample){sample=burglarAt(plan,time);cache.set(key,sample);}return sample;});
}
function withBeamEdges(times,plan,from,to,pulses=false){
  const edges=[plan.start,plan.end];
  if(pulses)for(let n=Math.floor(from*C.pulseRate);n<=Math.ceil(to*C.pulseRate);n++)edges.push(n/C.pulseRate,n/C.pulseRate+C.pulseWidth);
  for(const time of edges)if(time>from&&time<=to){times.push(Math.max(from,time-1e-10),time);if(time<to)times.push(Math.min(to,time+1e-10));}
  return times.sort((a,b)=>a-b);
}

function updateSignals(g,s,plan){
  const mode=s.values.mode,window=mode===0?.025:mode===1?.005:2,from=Math.max(0,s.time-window),span=Math.max(s.time-from,window),count=mode===2?160:400;
  const step=window/count,times=mode===2?Array.from({length:Math.max(0,Math.floor(s.time/step)-Math.ceil(from/step)+1)},(_,i)=>(Math.ceil(from/step)+i)*step):Array.from({length:count+1},(_,i)=>from+(s.time-from)*i/count);
  if(mode===1)withBeamEdges(times,plan,from,s.time,true);
  const points=mode===2?gridSamples(plan,times,step):times.map(t=>burglarAt(plan,t));
  if(mode===2){times.push(s.time);points.push(s);}
  setText(g.signalTitle,['THE MIXERS REVEAL A SLOWER BEAT','THE RECEIVER CHECKS SHORT LIGHT PULSES','HEAT INPUT BECOMES A CHANGING SIGNAL'][mode]);
  setText(g.signalSub,mode===0?'Baseband only; the 24.125 GHz carrier is not drawn':mode===1?'Actual 1 kHz timing enlarged; 100 μs light pulses':'Inputs relative to the initial room; settled heat gives zero output');
  let top,bottom,topMax,bottomMax;
  if(mode===0){top=points.map(p=>[p.i,p.q]);bottom=points.map(p=>[p.outputA,p.outputB]);}
  else if(mode===1){top=points.map(p=>[p.values.power&&p.pulseOn?100:0,0]);bottom=points.map(p=>[p.pulseOn?p.current*1e9:0,0]);}
  else{top=points.map(p=>[p.plus*1e9,p.minus*1e9]);bottom=points.map(p=>[p.output*1e6,0]);}
  topMax=Math.max(mode===1?100:.01,...top.flat().map(Math.abs));bottomMax=Math.max(mode===2?C.pirThreshold*1e6:mode===1?C.beamThreshold*1e9:.01,...bottom.flat().map(Math.abs));
  const signedTop=mode===0,signedBottom=mode!==1;
  [top,bottom].forEach((values,row)=>{const f=g.frames[row],max=row?bottomMax:topMax,signed=row?signedBottom:signedTop;
    for(let channel=0;channel<2;channel++)fillLine(g.signalCurves[row*2+channel],mode===1&&channel||mode===2&&row===1&&channel?[]:values.map((p,i)=>[f.x+f.w*(times[i]-from)/span,f.y+f.h*(signed?.5+.5*p[channel]/max:p[channel]/max),.2]));
  });
  const lower=g.frames[1];
  g.signalThresholds.forEach((o,i)=>{const threshold=mode===2?C.pirThreshold*1e6:mode===1?C.beamThreshold*1e9:0;fillLine(o,mode===0||mode===1&&i?[]:[[-2.25,lower.y+lower.h*(signedBottom?.5+.5*(i?-1:1)*threshold/bottomMax:threshold/bottomMax),.16],[2.25,lower.y+lower.h*(signedBottom?.5+.5*(i?-1:1)*threshold/bottomMax:threshold/bottomMax),.16]]);});
  setText(g.signalTop,mode===0?`Raw I (gold), Q (blue) · ±${topMax.toFixed(2)} relative`:mode===1?'Emitter drive: 0 to 100 mA':`+ gold, − blue · 0 to ${topMax.toFixed(1)} nW`);
  setText(g.signalBottom,mode===0?`Filtered I, Q · ±${bottomMax.toFixed(2)} relative`:mode===1?`Photocurrent during flashes · 0 to ${bottomMax.toFixed(2)} nA`:`Differential output · ±${bottomMax.toFixed(1)} μV`);
  setText(g.signalTimes[0],`${(from*1000).toFixed(1)} ms`);setText(g.signalTimes[1],`${((from+span)*1000).toFixed(1)} ms`);
  setText(g.signalCaption,mode===0?`Current Doppler ${fixed(s.doppler,2)} Hz · averaged level ${s.level.toFixed(3)}`:mode===1?`Clear-path pulse peak ${(s.clearCurrent*1e9).toFixed(3)} nA; gaps between pulses are expected`:`Changing output ${fixed(s.output*1e6,2)} μV · assigned threshold ±100 μV`);
  setText(g.signalResult,'Traces stop at the current clock; no future samples are shown');
}

function updateRecord(g,s,plan){
  const mode=s.values.mode,n=400,step=s.duration/n,times=Array.from({length:n+1},(_,i)=>step*i).filter(t=>t<s.time);
  if(mode===1)withBeamEdges(times,plan,0,s.time);
  const samples=mode===1?times.map(t=>burglarAt(plan,t)):gridSamples(plan,times,step);samples.push(s);
  const value=p=>mode===0?p.level:mode===1?p.current*1e9:p.output*1e6,threshold=mode===0?C.radarThreshold:mode===1?C.beamThreshold*1e9:C.pirThreshold*1e6;
  const signed=mode===2,max=Math.max(threshold*1.25,...samples.map(p=>Math.abs(value(p))*1.12)),xy=(t,val)=>[-2.25+4.5*t/s.duration,-1.14+2.84*(signed?.5+.5*val/max:val/max),.2];
  fillLine(g.recordCurve,samples.map(p=>xy(p.time,value(p))));fillLine(g.recordThreshold,[xy(0,threshold),xy(s.duration,threshold)]);fillLine(g.recordNegative,signed?[xy(0,-threshold),xy(s.duration,-threshold)]:[]);
  const x=xy(s.time,0)[0];fillLine(g.recordCursor,[[x,-1.14,.15],[x,1.7,.15]]);fillLine(g.recordEvent,s.onset===null?[]:[[xy(s.onset,0)[0],-1.14,.23],[xy(s.onset,0)[0],1.7,.23]]);
  setText(g.recordTitle,['DOPPLER SIGNAL AND ALARM RECORD','BEAM INTERRUPTION AND ALARM RECORD','THERMAL SIGNAL AND ALARM RECORD'][mode]);
  setText(g.recordSub,`${mode===0?'Averaged signal level':mode===1?'Demodulated pulse peak':'Differential output'} · ${mode===0?'relative units':mode===1?'nA':'μV'}`);
  setText(g.recordLow,signed?`−${max.toFixed(0)}`:'0');setText(g.recordHigh,max.toFixed(mode===0?2:1));setText(g.recordTimes[1],`${s.duration.toFixed(2)} s`);
  setText(g.recordScale,`${mode===1?'Below':'Above'} ${mode===2?'±':''}${threshold.toFixed(mode===0?2:mode===1?1:0)} ${mode===0?'relative':mode===1?'nA':'μV'} for ${mode===1?s.values.hold:50} ms → latch`);
  setText(g.recordResult,s.onset===null?`No alarm recorded through ${s.time.toFixed(3)} s`:`First alarm ${s.onset.toFixed(3)} s · request remains latched`);
}

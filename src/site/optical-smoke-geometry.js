import * as THREE from 'three';
import {textLabel,lineObject,fillLine} from './scene-kit.js';
import {SMOKE_SCIENCE as C} from './smoke-detector-science.js';
import {OPTICAL_SMOKE_RUN as R} from './optical-smoke-physics.js';

const P={ink:0x374736,blue:0x2b5d9c,red:0xc14f39,gold:0xe3b45e,ir:0xa863b9,smoke:0x7c8176};
const label=(parent,text,x,y,width=5,height=.2,z=.2,color='#374736')=>textLabel(parent,text,{position:[x,y,z],width,height,color});
const own=mesh=>{mesh.material=mesh.material.clone();return mesh;};
const visual=object=>{object.userData.explosionExcluded=true;object.userData.selectionExcluded=true;return object;};
const line=(parent,points,color=P.ink)=>{const object=lineObject(points.length,color,parent);fillLine(object,points);return object;};
const setText=(object,text)=>object.userData.setText(text);
const vector=p=>new THREE.Vector3(...p);
const setRod=(object,a,b)=>{const av=vector(a),bv=vector(b);object.position.copy(av).add(bv).multiplyScalar(.5);object.scale.y=av.distanceTo(bv)/object.geometry.parameters.height;object.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),bv.sub(av).normalize());};

function boundedCone(halfAngle){
  const points=[0,0,0],indices=[],rings=12,sectors=48;
  for(let ring=0;ring<=rings;ring++){
    const theta=halfAngle*Math.PI/180*ring/rings,length=12*Math.cos(theta)+Math.sqrt(23**2-12**2*Math.sin(theta)**2);
    for(let sector=0;sector<sectors;sector++){const phi=2*Math.PI*sector/sectors;points.push(length*Math.cos(theta),length*Math.sin(theta)*Math.cos(phi),length*Math.sin(theta)*Math.sin(phi));}
  }
  for(let ring=0;ring<rings;ring++)for(let sector=0;sector<sectors;sector++){
    const a=1+ring*sectors+sector,b=1+ring*sectors+(sector+1)%sectors,c=a+sectors,d=b+sectors;indices.push(a,c,d,a,d,b);
  }
  for(let sector=0;sector<sectors;sector++)indices.push(0,1+rings*sectors+sector,1+rings*sectors+(sector+1)%sectors);
  const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(points,3));geometry.setIndex(indices);geometry.computeVertexNormals();return geometry;
}

export function createOpticalSmokeGeometry(kit){
  const {part,box,disk,ring,rod,sphere}=kit;
  const system=part('system','Optical sensing assembly','Follow a light pulse through smoke to a photodiode, measured charge, confirmation and a powered sounder.');
  const base=part('base','Insulating support','Holds the optical chamber and electronics in this enlarged teaching layout.',[0,0,-.18],system);box([6.8,5.65,.24],[0,0,0],'cream',base);
  const board=part('board','Circuit board','Separate supply, return and signal conductors connect the optical stage to the controller.',[0,0,-.02],system);box([6.5,5.35,.08],[0,0,0],'leaf',board);
  const battery=part('battery','Three-volt battery supply','Powers the pulse driver, measuring circuit and sounder driver. The photocurrent does not supply horn energy.',[-1.98,-2,.25],system);
  box([1.52,.68,.44],[0,0,0],'ink',battery);box([.3,.69,.45],[-.6,0,0],'gold',battery);label(battery,'3 V',0,0,1.1,.23,.25,'#f0dfaf');
  const powerStart=[-1.49,-1.6,.25],powerEnd=[-.82,-1.6,.25];sphere(.065,[.49,.4,0],'red',battery);sphere(.065,[-.49,.4,0],'blue',battery);
  const contact=part('contact','Battery contact','An open contact stops light pulses, measurements and powered sound.',[0,0,0],system);sphere(.065,powerEnd,'metal',contact);const blade=rod(powerStart,powerEnd,.035,'gold',contact);
  const controller=part('controller','Pulse controller and horn driver','Times the light pulse, integrates the receiver signal and confirms smoke before driving the sounder.',[.45,-1.65,.22],system);
  box([1.35,.84,.28],[0,0,0],'ink',controller);for(let i=0;i<4;i++)for(const side of [-1,1])rod([side*.66,-.3+i*.2,0],[side*.84,-.3+i*.2,0],.023,'metal',controller);
  label(controller,'MEASURE',0,.16,1.18,.15,.16,'#f0dfaf');label(controller,'CONFIRM',0,-.05,1.18,.15,.16,'#f0dfaf');label(controller,'DRIVE',0,-.25,1.18,.14,.16,'#f0dfaf');const lamp=own(sphere(.1,[0,.57,.07],'red',controller));
  const reservoir=part('reservoir','Pulse supply and energy reservoir','An idealized powered stage stores energy and drives the short emitter pulse. Switching transients and battery sag are omitted.',[2.3,-1.78,.25],system);
  box([.92,.69,.18],[0,0,0],'ink',reservoir);const cap=disk(.2,.55,[-.22,0,.33],'metal',reservoir);cap.rotation.x=0;label(reservoir,'PULSE',.12,0,.74,.14,.15,'#f0dfaf');
  const horn=part('horn','Piezoelectric sounder','A powered driver bends a ceramic and metal diaphragm. Motion and pressure arcs are enlarged and slowed.',[2.33,.65,.27],system);
  disk(.72,.045,[0,0,0],'gold',horn);const ceramic=disk(.5,.035,[0,0,.044],'cream',horn),ceramicRest=ceramic.geometry.attributes.position.array.slice();ring(.73,.045,[0,0,.04],'wood',horn);
  rod([.18,-.25,.077],[.18,-.63,.077],.023,'red',horn);rod([0,-.55,0],[0,-.7,0],.023,'blue',horn);
  const waves=Array.from({length:3},(_,i)=>{const mesh=new THREE.Mesh(new THREE.TorusGeometry(.87+i*.16,.018,6,30,1.45),new THREE.MeshBasicMaterial({color:P.red}));mesh.rotation.z=-.72;mesh.position.z=.1;horn.add(visual(mesh));return mesh;});
  const hornText=visual(label(horn,'Powered sounder',0,1.17,2.15,.17));

  const chamber=part('chamber','Optical sensing chamber','Only smoke in both the illuminated volume and the receiver field contributes. Direct emitter light is excluded.',[-.73,.61,1.68],system),scale=.065;chamber.scale.setScalar(scale);
  const shell=part('shell','Dark chamber shell','Assigned spherical cavity with a cut-away front. Nonreflecting walls are idealized.',[0,0,0],chamber);
  const bowl=new THREE.Mesh(new THREE.SphereGeometry(23,48,24,Math.PI,Math.PI),new THREE.MeshToonMaterial({color:0x43504a,side:THREE.DoubleSide}));shell.add(bowl);ring(23,.42,[0,0,0],'ink',shell);
  const cover=part('cover','Front chamber cover','Remove this front half to inspect the dark sensing space. Air enters through peripheral openings.',[0,0,0],chamber);
  const coverGeometry=new THREE.SphereGeometry(23,48,24,0,Math.PI),vertices=coverGeometry.attributes.position,indices=coverGeometry.index.array,kept=[];
  for(let i=0;i<indices.length;i+=3){
    const face=[indices[i],indices[i+1],indices[i+2]],center=face.reduce((p,index)=>p.add(new THREE.Vector3().fromBufferAttribute(vertices,index)),new THREE.Vector3()).multiplyScalar(1/3);
    const azimuth=(Math.atan2(center.y,center.x)+2*Math.PI)%(Math.PI/6);
    if(!(center.z<3&&azimuth<.29))kept.push(...face);
  }
  coverGeometry.setIndex(kept);const coverMesh=new THREE.Mesh(coverGeometry,new THREE.MeshToonMaterial({color:0x43504a,side:THREE.DoubleSide}));cover.add(coverMesh);kit.covers.push(cover);
  const emitter=part('emitter','Infrared emitter and hood','The 940 nm emitter sends 100 μs pulses. An assigned hood limits its cone to 25°.',[-12,0,0],chamber);
  rod([-4,0,0],[0,0,0],1.5,'ink',emitter);const lens=own(sphere(.58,[0,0,0],P.ir,emitter));
  for(const side of [-1,1])rod([-4,side*.7,0],[-6,side*.7,0],.14,'metal',emitter);
  const hood=new THREE.Mesh(new THREE.CylinderGeometry(2*Math.tan(C.sourceStopAngle*Math.PI/180),2*Math.tan(C.sourceStopAngle*Math.PI/180),2,32,1,true),new THREE.MeshToonMaterial({color:P.ink,side:THREE.DoubleSide}));hood.rotation.z=-Math.PI/2;hood.position.x=1;emitter.add(hood);
  const receiver=part('receiver','Photodiode and viewing tube','An ideal field lens and rear stop define a 5° half-field. Light passes the front pupil to a silicon photodiode behind the stop.',[0,0,0],chamber);
  const tube=new THREE.Mesh(new THREE.CylinderGeometry(1,1,4,32,1,true),new THREE.MeshToonMaterial({color:P.ink,side:THREE.DoubleSide}));tube.rotation.z=-Math.PI/2;tube.position.x=2;receiver.add(tube);kit.covers.push(tube);
  const pupil=disk(.75,.08,[0,0,0],P.blue,receiver);pupil.rotation.set(0,0,Math.PI/2);own(pupil);pupil.material.transparent=true;pupil.material.opacity=.5;pupil.material.depthWrite=false;
  const stop=new THREE.Mesh(new THREE.RingGeometry(4*Math.tan(C.receiverHalfAngle*Math.PI/180),1,32),new THREE.MeshToonMaterial({color:P.ink,side:THREE.DoubleSide}));stop.rotation.y=Math.PI/2;stop.position.x=4;receiver.add(stop);
  const die=box([.2,1.4,1.4],[4.2,0,0],P.blue,receiver);for(const side of [-1,1])rod([4.3,side*.7,0],[6,side*.7,0],.14,'metal',receiver);
  const field=visual(new THREE.Mesh(boundedCone(C.receiverHalfAngle),new THREE.MeshBasicMaterial({color:P.blue,transparent:true,opacity:.12,depthWrite:false,side:THREE.DoubleSide})));
  field.rotation.y=Math.PI;receiver.add(field);field.userData.inspectionOnly='chamber';
  const beamRoot=visual(new THREE.Group());chamber.add(beamRoot);
  const beam=new THREE.Mesh(boundedCone(C.sourceStopAngle),new THREE.MeshBasicMaterial({color:P.ir,transparent:true,opacity:.07,depthWrite:false,side:THREE.DoubleSide}));beam.position.x=-12;beamRoot.add(beam);
  const smokeRoot=visual(new THREE.Group());chamber.add(smokeRoot);
  const particles=Array.from({length:36},(_,i)=>{const z=1-2*(i+.5)/36,r=19*Math.cbrt(((i*17)%36+.5)/36),a=i*2.399963229728653,p=[r*Math.sqrt(1-z*z)*Math.cos(a),r*Math.sqrt(1-z*z)*Math.sin(a),r*z];return {object:sphere(.65,p,P.smoke,smokeRoot),point:p,index:i};});
  const rays=Array.from({length:6},()=>lineObject(3,P.gold,beamRoot)),scatterDots=Array.from({length:6},()=>sphere(.42,[0,0,0],P.gold,beamRoot)),rayTravel=Array.from({length:6},()=>sphere(.2,[0,0,0],P.ir,beamRoot));
  const chamberTitle=visual(label(chamber,'LIGHT REACHES THE RECEIVER THROUGH SMOKE',0,30,65,2.65,1)),chamberText=visual(label(chamber,'',0,-28,65,2.6,1)),chamberNote=visual(label(chamber,'Pulse paths held visible · blue: receiver field',0,-33,65,2.3,1));
  for(const tag of [chamberTitle,chamberText,chamberNote])tag.userData.inspectionOnly='chamber';
  const angleArc=lineObject(49,P.gold,chamber);angleArc.userData.inspectionOnly='chamber';visual(angleArc);
  const angleText=visual(label(chamber,'',6.5,7,15,2,1,'#f0dfaf'));angleText.userData.inspectionOnly='chamber';

  const wires=part('wires','Supply, pulse and signal conductors','Supply and return power the drivers. Separate photodiode leads carry a weak signal to the measuring circuit. Optical leads pass over the chamber rim.',[0,0,0],system),paths=[];
  const route=(id,points,color)=>{const objects=points.slice(1).map((p,i)=>rod(points[i],p,.025,color,wires));const path={id,points,objects};paths.push(path);return path;};
  route('controller-supply',[powerEnd,[-.62,-1.6,.25],[-.62,-1.55,.22],[-.39,-1.55,.22]],'red');
  route('supply-reservoir',[powerEnd,[-.82,-2.5,.25],[2.75,-2.5,.25],[2.75,-1.78,.25]],'red');
  route('battery-return',[[-2.47,-1.6,.25],[-2.47,-2.4,.14],[2.98,-2.4,.14],[2.98,-1.43,.14]],'blue');
  route('controller-return',[[1.29,-1.95,.22],[1.5,-1.95,.14],[1.5,-2.4,.14]],'blue');
  route('reservoir-return',[[2.3,-2.12,.25],[2.3,-2.4,.14]],'blue');
  route('pulse-control',[[1.29,-1.75,.22],[1.65,-1.75,.22],[1.65,-1.78,.25],[1.84,-1.78,.25]],'gold');
  route('horn-drive',[[1.29,-1.35,.22],[2.51,-1.35,.347],[2.51,.02,.347]],'red');
  route('horn-return',[[2.33,-.05,.27],[2.98,-.05,.14],[2.98,-2.4,.14]],'blue');
  const opticalPaths=Array.from({length:4},(_,i)=>route(['emitter-positive','emitter-return','receiver-positive','receiver-return'][i],Array.from({length:6},(_,j)=>[j*.1,0,.1]),[P.red,P.blue,P.gold,P.blue][i]));
  const flowRoot=visual(new THREE.Group());system.add(flowRoot);const flow=Array.from({length:12},()=>sphere(.035,[0,0,0],'gold',flowRoot));
  const heading=visual(label(system,'SMOKE REDIRECTS LIGHT INTO A SIGNAL',0,3.58,6.45,.28,.3)),status=visual(label(system,'',0,-3.45,6.4,.24,.3)),footer=visual(label(system,'',0,-3.82,6.4,.18,.3));

  const details=[];
  const detail=(id,name,description)=>{const object=part(id,name,description,[0,0,0],system);object.userData.inspectionOnly=id;object.userData.explosionExcluded=true;details.push(object);return object;};
  const pulse=detail('pulse','Pulse measurement and confirmation','A potential pulse current is distinct from the last actual measurement. Three consecutive high checks request the horn.');
  label(pulse,'MEASURE A SHORT PULSE, THEN CHECK AGAIN',0,2.3,5.3,.22);label(pulse,'100 μs pulse · enlarged timing diagram',0,1.96,5.15,.18);
  line(pulse,[[-2.15,1.25,.1],[-1.05,1.25,.1],[-1.05,1.62,.1],[1.05,1.62,.1],[1.05,1.25,.1],[2.15,1.25,.1]],P.ir);
  const pulseCurrent=label(pulse,'',0,.98,5.15,.2),pulseCharge=label(pulse,'',0,.64,5.15,.19),pulseLimit=label(pulse,'',0,.29,5.15,.18);
  const checks=Array.from({length:3},(_,i)=>{const object=own(sphere(.19,[-.65+i*.65,-.15,.2],'metal',pulse));label(pulse,String(i+1),-.65+i*.65,-.52,.45,.17);return object;});
  const pulseSample=label(pulse,'',0,-.88,5.15,.19),pulseResult=label(pulse,'',0,-1.27,5.15,.21),pulseNext=label(pulse,'',0,-1.63,5.15,.19);
  label(pulse,'Battery powers the sounder; photocurrent controls the decision',0,-2.15,5.2,.17);

  const beamComparison=detail('beam','Short and long beam paths','Separate ideal straight probes cross the same uniform smoke. These are not extra photodiodes inside the scattering chamber.');
  label(beamComparison,'SAME SMOKE, DIFFERENT DISTANCE',0,2.3,5.3,.24);label(beamComparison,'Separate ideal probes · path lengths drawn at different scales',0,1.95,5.2,.17);
  const beamRows=[];
  for(let i=0;i<2;i++){
    const y=1.05-i*1.3;box([.32,.53,.32],[-2.16,y,0],'ink',beamComparison);box([.32,.64,.32],[2.16,y,0],'metal',beamComparison);
    const segments=Array.from({length:40},(_,j)=>own(box([.093,.12,.1],[-1.94+j*.1,y,.06],P.ir,beamComparison))),screen=own(box([.05,.47,.15],[1.98,y,.08],P.gold,beamComparison));
    label(beamComparison,i?'10 m path':'30 mm path',0,y+.4,4.8,.2);const text=label(beamComparison,'',0,y-.37,4.8,.2);beamRows.push({segments,screen,text});
  }
  const beamText=label(beamComparison,'',0,-1.29,5.15,.19);label(beamComparison,'Retained fraction = exp(−particle count × cross section × length)',0,-1.72,5.2,.16);
  label(beamComparison,'A short beam can stay bright while an off-axis receiver detects light',0,-2.15,5.2,.16);

  const pattern=detail('pattern','One sphere and its angular pattern','A single-sphere angular cross section is not the whole detector signal. The receiver integrates a volume and range of directions.');
  label(pattern,'ONE SPHERE SENDS LIGHT IN MANY DIRECTIONS',0,2.3,5.3,.22);label(pattern,'Relative to forward scattering · logarithmic vertical scale',0,1.95,5.15,.17);
  line(pattern,[[-2.12,1.49,.1],[-2.12,-.65,.1],[2.12,-.65,.1]],P.ink);
  for(let i=0;i<=3;i++)label(pattern,i===0?'1':`10^−${i*2}`,-2.36,1.49-i*2.14/3,.56,.15);
  for(let i=0;i<=4;i++)label(pattern,`${i*45}°`,-2.12+i*4.24/4,-.91,.7,.16);
  const patternCurve=lineObject(181,P.ir,pattern),patternCursor=lineObject(2,P.gold,pattern),patternDot=visual(sphere(.055,[0,0,.24],P.gold,pattern));
  const patternText=label(pattern,'',0,-1.3,5.15,.19),patternVolume=label(pattern,'',0,-1.66,5.15,.19);label(pattern,'Detector current includes geometry, attenuation and many angles',0,-2.15,5.2,.17);

  const chart=detail('chart','Observation record','Shows only elapsed potential pulse current and actual alarm transitions. Checks sample that current at discrete times.');
  label(chart,'WHAT DID THE OPTICAL DETECTOR RECORD?',0,2.3,5.35,.22);const chartText=label(chart,'',0,1.95,5.15,.18);
  line(chart,[[-2.12,1.49,.1],[-2.12,-.72,.1],[2.12,-.72,.1]],P.ink);
  const curve=lineObject(122,P.ir,chart),thresholdLine=lineObject(2,P.red,chart),releaseLine=lineObject(2,P.blue,chart),cursor=lineObject(2,P.ink,chart),eventTemplate=lineObject(40,P.gold,chart);
  const eventMarks=new THREE.LineSegments(eventTemplate.geometry,eventTemplate.material);chart.remove(eventTemplate);chart.add(eventMarks);eventMarks.frustumCulled=false;
  for(let i=0;i<=4;i++)label(chart,String(i*150),-2.12+4.24*i/4,-.97,.7,.16);
  const chartScale=label(chart,'',-1.49,1.32,1.12,.16),chartEvent=label(chart,'',0,-1.36,5.15,.2),chartResult=label(chart,'',0,-1.7,5.15,.19);label(chart,'Assigned smoke experiment; no real-fire warning time predicted',0,-2.15,5.2,.17);
  return {system,base,board,battery,contact,powerStart,powerEnd,blade,controller,reservoir,horn,ceramic,ceramicRest,waves,hornText,lamp,
    chamber,scale,shell,bowl,cover,coverMesh,emitter,lens,hood,receiver,tube,pupil,stop,die,field,beamRoot,beam,smokeRoot,particles,rays,scatterDots,rayTravel,chamberText,angleArc,angleText,
    wires,paths,opticalPaths,flowRoot,flow,heading,status,footer,details,pulseCurrent,pulseCharge,pulseLimit,checks,pulseSample,pulseResult,pulseNext,
    beamRows,beamText,patternCurve,patternCursor,patternDot,patternText,patternVolume,curve,thresholdLine,releaseLine,cursor,eventMarks,chartText,chartScale,chartEvent,chartResult};
}

export function updateOpticalSmokeGeometry(g,s,plan){
  const v=s.values,phase=s.time/R.speed,angle=v.angle*Math.PI/180;
  setRod(g.blade,g.powerStart,v.power?g.powerEnd:[g.powerStart[0]+.35,g.powerStart[1]+.58,g.powerStart[2]]);
  g.receiver.position.set(12*Math.cos(angle),12*Math.sin(angle),0);g.receiver.rotation.z=angle;
  g.lens.material.color.setHex(s.pulseOn?0xf4c5ff:v.power?P.ir:0x685e68);g.lamp.material.color.setHex(s.active?P.red:P.ink);g.beamRoot.visible=!!v.power;
  const positions=g.ceramic.geometry.attributes.position;
  for(let i=0;i<positions.count;i++){const x=g.ceramicRest[i*3],y=g.ceramicRest[i*3+1],z=g.ceramicRest[i*3+2],r2=(x*x+z*z)/.25;positions.setXYZ(i,x,y+(s.hornPulse?.035*Math.sin(phase*15)*Math.max(0,1-r2):0),z);}
  positions.needsUpdate=true;g.ceramic.geometry.computeVertexNormals();g.ceramic.geometry.computeBoundingSphere();g.waves.forEach(wave=>wave.visible=s.hornPulse);
  for(const particle of g.particles){particle.object.visible=particle.index<Math.round(36*Math.min(1,s.mass*1e6/100));particle.object.scale.setScalar(.6+.45*Math.log10(v.size/.1+1));}
  const optical=plan.optical;
  if(g.lastOptical!==optical){
    let total=0;const cumulative=optical.coefficients.map(weight=>(total+=weight));
    g.rayIndices=Array.from({length:6},(_,i)=>Math.max(0,cumulative.findIndex(sum=>sum>=total*(i+.5)/6)));g.lastOptical=optical;
  }
  const endpoints=p=>p.map(x=>x*1000);
  g.rays.forEach((ray,i)=>{
    const point=endpoints(optical.positions[g.rayIndices[i]]),source=endpoints(optical.source),receiver=endpoints(optical.receiver),shown=s.mass>1e-12;
    fillLine(ray,shown?[source,point,receiver]:[]);g.scatterDots[i].visible=g.rayTravel[i].visible=shown;g.scatterDots[i].position.set(...point);
    const t=(phase*.7+i/6)%1;g.rayTravel[i].position.lerpVectors(vector(t<.5?source:point),vector(t<.5?point:receiver),t<.5?t*2:(t-.5)*2);
  });
  fillLine(g.angleArc,Array.from({length:49},(_,i)=>[7*Math.cos(angle*i/48),7*Math.sin(angle*i/48),.7]));setText(g.angleText,`${v.angle}°`);
  setText(g.chamberText,`During a pulse: ${(s.current*1e9).toFixed(3)} nA · overlap ${(s.volume*1e9).toFixed(2)} mm³`);
  g.system.updateMatrixWorld(true);
  const globalPoint=(object,p)=>g.system.worldToLocal(object.localToWorld(vector(p))).toArray();
  for(let i=0;i<4;i++){
    const side=i%2?-.7:.7,isEmitter=i<2,object=isEmitter?g.emitter:g.receiver,pin=globalPoint(object,[isEmitter?-6:6,side,0]);
    const rim=globalPoint(object,[isEmitter?-14:14,side,3]),low=[rim[0],rim[1],.12+i*.055],busY=-1.06-i*.105;
    const end=i===0?[2.08,-1.43,.25]:i===1?[2.98,-1.43,.14]:i===2?[-.39,-1.35,.22]:[-.39,-1.75,.22];
    const points=[pin,rim,low,[rim[0],busY,low[2]],[end[0],busY,low[2]],end],path=g.opticalPaths[i];path.points=points;path.objects.forEach((o,j)=>setRod(o,points[j],points[j+1]));
  }
  const routes=g.opticalPaths;
  g.flow.forEach((dot,i)=>{dot.visible=!!v.power&&(i<6||s.current>0);const path=routes[i%4].points,n=path.length-1,t=((phase*.4+Math.floor(i/4)/3)%1)*n,j=Math.min(n-1,Math.floor(t));dot.position.lerpVectors(vector(path[j]),vector(path[j+1]),t-j);});
  setText(g.status,`${!v.power?'NO POWER':s.active?'ALARM':s.count?`CHECK ${s.count} OF 3`:s.time===0?'READY':s.clearing?'CLEARING':'SAMPLING'} · ${(s.current*1e9).toFixed(3)} nA during a pulse`);
  setText(g.footer,`${s.time.toFixed(1)} / 600 s · ${(s.mass*1e6).toFixed(2)} mg/m³ inside · sound ${v.sound?'on':'off'}`);
  setText(g.pulseCurrent,`Potential pulse now: ${(s.current*1e9).toFixed(3)} nA`);
  setText(g.pulseCharge,s.sample?`Last measured charge: ${(s.sample.charge*1e15).toFixed(1)} fC`:'No measured charge yet; advance to the first sample');
  setText(g.pulseLimit,`Current comparison limit: ${(s.threshold*1e9).toFixed(3)} nA · ${(s.threshold*R.pulse*1e15).toFixed(1)} fC`);
  g.checks.forEach((check,i)=>check.material.color.setHex(i<s.count?P.gold:0xb4c5b0));
  setText(g.pulseSample,s.sample?`Last check ${s.sample.time.toFixed(1)} s: ${(s.sample.current*1e9).toFixed(3)} nA · ${s.sample.hit?'HIGH':'LOW'}`:'No sample recorded');
  setText(g.pulseResult,!v.power?'No power for pulse, measurement or horn':s.active?'Three high checks → powered horn requested':s.count?`${s.count} high check${s.count===1?'':'s'}; confirmation still pending`:'No confirmed smoke alarm');
  setText(g.pulseNext,`Next sample: ${s.nextSample===null?'none':s.nextSample.toFixed(1)+' s'} · ${s.samplesSeen} checks recorded`);
  [s.beamShare,s.roomShare].forEach((share,i)=>{
    const row=g.beamRows[i],distance=i?C.roomDistance:C.beamDistance;
    row.segments.forEach((segment,j)=>{const retained=Math.exp(-s.extinction*distance*(j+.5)/40);segment.material.color.setHex(P.ir).multiplyScalar(.12+.88*retained);});
    row.screen.material.color.setHex(P.gold).multiplyScalar(.08+.92*share);setText(row.text,`${(100*share).toFixed(2)}% of input light remains`);
  });
  setText(g.beamText,`${s.obscuration.toFixed(3)}% lost over 1 m · ${v.power?'same smoke as chamber':'independent ideal probes; chamber is unpowered'}`);
  const xy=(angle,relative)=>[-2.12+4.24*angle/180,-.65+2.14*(Math.log10(Math.max(1e-6,relative))+6)/6,.2],selected=plan.pattern[v.angle];
  fillLine(g.patternCurve,plan.pattern.map(point=>xy(point.angle,point.relative)));const point=xy(v.angle,selected.relative);fillLine(g.patternCursor,[[point[0],-.65,.15],[point[0],1.49,.15]]);g.patternDot.position.set(...point);
  setText(g.patternText,`${v.size} μm sphere · ${v.angle}°: ${selected.relative.toExponential(2)} of forward value`);
  setText(g.patternVolume,`Whole detector: ${(s.current*1e9).toFixed(3)} nA over ${(s.volume*1e9).toFixed(2)} mm³`);
  const elapsed=plan.chart.filter(point=>point.time<s.time),max=Math.max(s.trigger*1.25,s.current*1.12,...elapsed.map(point=>point.current*1.12)),chartXY=(time,current)=>[-2.12+4.24*time/R.duration,-.72+2.21*current/max,.2];
  fillLine(g.curve,[...elapsed.map(point=>chartXY(point.time,point.current)),chartXY(s.time,s.current)]);
  fillLine(g.thresholdLine,v.power?[chartXY(0,s.trigger),chartXY(R.duration,s.trigger)]:[]);fillLine(g.releaseLine,v.power?[chartXY(0,s.release),chartXY(R.duration,s.release)]:[]);
  const x=-2.12+4.24*s.time/R.duration;fillLine(g.cursor,[[x,-.72,.15],[x,1.49,.15]]);fillLine(g.eventMarks,s.events.flatMap(event=>{const x=-2.12+4.24*event.time/R.duration;return [[x,-.72,.24],[x,1.49,.24]];}));
  setText(g.chartText,`${s.time.toFixed(1)} s · purple: pulse current · red/blue: trigger/release`);setText(g.chartScale,`${(max*1e9).toFixed(2)} nA`);
  setText(g.chartEvent,s.onset===null?'No optical alarm recorded':`First optical alarm at ${s.onset.toFixed(1)} s`);
  const release=s.events.findLast(event=>!event.active);setText(g.chartResult,s.active?'Horn requested now':release?`Alarm released at ${release.time.toFixed(1)} s`:`${s.samplesSeen} checks · ${s.count} consecutive high`);
}

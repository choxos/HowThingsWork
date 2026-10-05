import * as THREE from 'three';
import {PHONE_COLORS as C,phoneLabel as label,phoneColor as color,phoneArrow as arrow} from './smartphone-geometry.js';

export function createPhoneDetails(kit,system){
 const make=(id,name,description)=>{const group=kit.part(id,name,description,[0,0,0],system);group.userData.inspectionOnly=id;group.userData.explosionExcluded=true;return group;};
 const touch=make('touch-detail','Touch sensing, enlarged','Transmit rows and receive columns locate a finger through changes in capacitive coupling. Four constructed response weights demonstrate interpolation. These are not predicted capacitances, a field solution or a claim of touch accuracy.');
 label(touch,'Find a touch between crossings',0,1.55);
 const touchCells=Array.from({length:35},(_,i)=>color(kit.box([.29,.29,.015],[(i%5-2)*.36,1.05-Math.floor(i/5)*.31,0],C.white,touch)));
 const touchRows=Array.from({length:7},(_,i)=>color(kit.box([1.88,.014,.012],[0,1.05-i*.31,.022],'gold',touch)));
 const touchColumns=Array.from({length:5},(_,i)=>kit.box([.014,2.16,.012],[(i-2)*.36,.12,.036],'blue',touch));
 for(let i=0;i<7;i++)label(touch,String(i+1),-1.13,1.05-i*.31,.2,.16,.10);
 for(let i=0;i<5;i++)label(touch,String(i+1),(i-2)*.36,1.29,.2,.16,.10);
 const finger=kit.ring(.19,.019,[0,0,.11],'clay',touch),found=kit.ring(.045,.014,[0,0,.13],'ink',touch);
 const touchStatus=label(touch,'',0,-1.18,3.25,.18);
 label(touch,'Constructed response, not capacitance',0,-1.47,3.25,.17);

 const sensor=make('sensor-detail','Three sensing axes, enlarged','Three conceptual spring-and-mass capacitive cells show x, y and z specific-force directions. The z cell is viewed edge-on. Each moving finger approaches one fixed finger and recedes from another. Real chips may use a shared structure; dimensions and deflection are exaggerated.');
 label(sensor,'Spring, mass and changing gaps',0,1.55);
 const cells=['x','y','z'].map((axis,index)=>{
  const group=new THREE.Group();group.position.x=(index-1)*1.1;sensor.add(group);
  const mechanism=new THREE.Group();mechanism.rotation.z=axis==='x'?-Math.PI/2:0;group.add(mechanism);
  const base=kit.box([.85,1.24,.025],[0,0,-.04],'metal',mechanism);
  const fixed=[];
  for(const side of [-1,1]){
   fixed.push(kit.box([.045,1.04,.079],[side*.37,0,.012],'ink',mechanism));
   for(const y of [-.36,-.12,.12,.36])fixed.push(kit.box([.27,.04,.035],[side*.23,y,.028],'ink',mechanism));
  }
  const mass=new THREE.Group();mechanism.add(mass);
  const spine=kit.box([.10,.73,.035],[0,0,.028],'leaf',mass),fingers=[];
  for(const side of [-1,1])for(const y of [-.24,0,.24])fingers.push(kit.box([.24,.04,.035],[side*.17,y,.028],'leaf',mass));
  const springs=[];
  for(const side of [-1,1])for(const end of [-1,1]){
   const anchor=[side*.35,end*.53,.028],seat=[side*.05,end*.32,.028];
   kit.box([.10,.09,.079],[anchor[0],anchor[1],.012],'gold',mechanism);
   const rods=Array.from({length:5},()=>kit.rod([0,0,0],[0,.1,0],.009,'gold',mechanism));
   springs.push({anchor,seat,rods});
  }
  const force=arrow(kit,mechanism,C.blue,[.47,-.3,.12],[.47,.3,.12]);
  label(group,axis.toUpperCase()+(axis==='z'?' · edge view':''),0,.92,1.03,.18);
  const reading=label(group,'',0,-.93,1.03,.18);
  return {axis,group,mechanism,base,fixed,mass,spine,fingers,springs,force,reading};
 });
 label(sensor,'Proof masses deflect against support force',0,-1.30,3.35,.17);
 const sensorStatus=label(sensor,'',0,-1.56,3.35,.16);

 const motor=make('motor-detail','Rotating unbalance, enlarged','A motor turns a mass whose center is offset from the shaft. Its acceleration produces an opposite reaction on the frame. The smooth teaching cycle includes angular acceleration; motion and arrows are not a measured motor speed or phone vibration. A centered mass still turns but removes rotating unbalance.');
 label(motor,'A rotating weight pushes the frame',0,1.55,3.35);
 const housing=kit.disk(.83,.10,[0,.10,-.09],'metal',motor);
 const rim=kit.ring(.75,.04,[0,.10,.02],'ink',motor);
 const rotor=new THREE.Group();rotor.position.y=.10;motor.add(rotor);
 const rotorPlate=kit.disk(.60,.035,[0,0,.045],'leaf',rotor);
 const weight=kit.box([.49,.40,.10],[.31,0,.1125],'gold',rotor);
 const centroid=kit.sphere(.025,[.31,0,.1875],'red',rotor);
 const shaft=kit.disk(.042,.085,[0,.10,.0025],'ink',motor);
 const reaction=arrow(kit,motor,0xc14f39,[0,.10,.3],[.9,.10,.3]);
 label(motor,'Arrow: force on the housing',0,-1.0,3.15,.19);
 const motorStatus=label(motor,'',0,-1.29,3.2,.18);
 label(motor,'DC drive omitted; motion slowed for inspection',0,-1.57,3.3,.16);

 const voice=make('voice-detail','Voice signal path, enlarged','Incoming radio information passes through the antenna, modem and audio processing to the speaker. Your reply goes from microphone to audio encoding, modem and antenna. The two chains show a simplified turn in a normal conversation, not cellular protocol timing or a literal radio bitstream.');
 label(voice,'From radio information to sound and back',0,1.65,3.4,.18);
 label(voice,'Listen',-.88,1.35,1.35,.18);label(voice,'Reply',.88,1.35,1.35,.18);
 const words=[['Network','incoming voice'],['Antenna','radio input'],['Modem','recover data'],['Audio + speaker','move air'],['Microphone','sense pressure'],['Audio encoder','digital reply'],['Modem','radio drive'],['Antenna','network output']];
 const voiceNodes=words.map(([top,bottom],i)=>{
  const x=i<4?-.88:.88,y=1.0-(i%4)*.67;
  const mesh=color(kit.box([1.46,.46,.045],[x,y,0],C.white,voice));
  label(voice,top,x,y+.10,1.36,.15,.08);label(voice,bottom,x,y-.10,1.36,.14,.08);
  if(i%4<3)arrow(kit,voice,C.blue,[x,y-.25,.06],[x,y-.40,.06]);
  return mesh;
 });
 const voiceStatus=label(voice,'',0,-1.57,3.35,.16);
 return {touch,touchCells,touchRows,touchColumns,finger,found,touchStatus,sensor,cells,sensorStatus,motor,housing,rim,rotor,rotorPlate,weight,centroid,shaft,reaction,motorStatus,voice,voiceNodes,voiceStatus};
}

function moveRod(mesh,a,b){
 const start=new THREE.Vector3(...a),end=new THREE.Vector3(...b),delta=end.clone().sub(start);
 mesh.position.copy(start.add(end).multiplyScalar(.5));mesh.scale.y=delta.length()/mesh.geometry.parameters.height;
 mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),delta.normalize());
}

export function updatePhoneDetails(d,state){
 const {values,now}=state;
 for(const [i,mesh]of d.touchCells.entries()){
  const read=values.scenario===0&&Math.floor(i/5)<now.scannedRows;
  mesh.material.color.set(C.white).lerp(new THREE.Color(C.dark),read?now.touch.changes[i]*.8:0);
 }
 d.touchRows.forEach((mesh,i)=>mesh.material.color.set(i===now.activeRow?C.gold:0xb4c5b0));
 d.finger.visible=Boolean(values.contact);d.finger.position.set((values.touchX-2)*.36,1.05-values.touchY*.31,.11);
 d.found.visible=Boolean(state.registered)&&values.scenario===0&&Boolean(values.power);
 if(state.registered)d.found.position.set((state.registered.x-2)*.36,1.05-state.registered.y*.31,.13);
 d.touchStatus.userData.setText(values.scenario===0?now.phase:'Select Touch to run a scan');
 for(const cell of d.cells){
  const value=now.force[cell.axis],drop=-.020*value;cell.mass.position.y=drop;
  for(const spring of cell.springs){
   const points=Array.from({length:6},(_,i)=>{const f=i/5;return [spring.anchor[0]+(spring.seat[0]-spring.anchor[0])*f,spring.anchor[1]+(spring.seat[1]+drop-spring.anchor[1])*f+(i>0&&i<5?(i%2?.026:-.026):0),.028];});
   spring.rods.forEach((rod,i)=>moveRod(rod,points[i],points[i+1]));
  }
  cell.force.visible=Math.abs(value)>1e-8;cell.force.userData.setDirection(new THREE.Vector3(0,Math.sign(value)||1,0));cell.force.userData.setLength(.30*Math.abs(value));
  cell.reading.userData.setText(values.power?`${value.toFixed(2)} g`:'Power off');
 }
 d.sensorStatus.userData.setText(values.scenario===2?'Static pose reference; rotor response omitted':values.power?'Three conceptual cells; deflection enlarged':'Masses still deflect; electronic readout is off');
 d.rotor.rotation.z=now.motor.angle;d.weight.position.x=values.balance?0:.31;d.centroid.position.x=d.weight.position.x;
 const force=now.motor.reaction;
 d.reaction.userData.setDirection(now.motor.relativeForce>1e-8?new THREE.Vector3(force.x,force.y,0).normalize():new THREE.Vector3(1,0,0));d.reaction.userData.setLength(.24+Math.min(4,now.motor.relativeForce)*.15);
 d.reaction.visible=now.motor.relativeForce>1e-8;
 d.motorStatus.userData.setText(values.scenario!==2?'Select Vibration to run the rotor':values.balance?'Centered mass: no rotating unbalance':`Midpoint radial force: ${now.motor.peakRadialRatio}× reference`);
 d.voiceNodes.forEach((mesh,i)=>mesh.material.color.set(i===now.voiceStage?C.gold:i<now.voiceStage?0x91aa7e:C.white));
 d.voiceStatus.userData.setText(values.scenario===3?now.phase:'Select Voice path to follow the conversation');
}

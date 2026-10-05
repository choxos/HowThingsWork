import * as THREE from 'three';
import {textLabel,solidArrow} from './scene-kit.js';

export const MOTOR_LENGTH_SCALE=100;
export const MOTOR_MOTION_SCALE=20;
const color={ink:0x374736,gold:0xe3b45e,blue:0x357386,red:0xc14f39,grid:0xb4c5b0};
const label=(parent,text,x,y,width=3.8,height=.15,z=.12)=>textLabel(parent,text,{width,height,position:[x,y,z]});
function line(parent,points,tone=color.ink){const geometry=new THREE.BufferGeometry().setFromPoints(points.map(p=>new THREE.Vector3(...p))),mesh=new THREE.Line(geometry,new THREE.LineBasicMaterial({color:tone}));parent.add(mesh);return mesh;}
function points(mesh,data){data.forEach((p,i)=>mesh.geometry.attributes.position.setXYZ(i,...p));mesh.geometry.attributes.position.needsUpdate=true;mesh.geometry.computeBoundingSphere();mesh.geometry.computeBoundingBox();}
function sectorGeometry(inner,outer,depth,start,end){
  const shape=new THREE.Shape();shape.absarc(0,0,outer,start,end,false);shape.lineTo(inner*Math.cos(end),inner*Math.sin(end));shape.absarc(0,0,inner,end,start,true);shape.closePath();
  const geometry=new THREE.ExtrudeGeometry(shape,{depth,bevelEnabled:false,curveSegments:96});geometry.translate(0,0,-depth/2);return geometry;
}
function sector(kit,parent,inner,outer,depth,z,start,end,tone){const mesh=kit.box([1,1,1],[0,0,z],tone,parent);mesh.geometry.dispose();mesh.geometry=sectorGeometry(inner,outer,depth,start,end);return mesh;}
function arrow(kit,parent,tone,x,y){const a=solidArrow(kit,tone,parent,.022);a.position.set(x,y,.05);return a;}
function setArrow(a,x,y,scale){const length=Math.hypot(x,y);a.visible=length>1e-12;a.userData.setLength(length*scale);if(length)a.userData.setDirection(new THREE.Vector3(x,y,0));}
const rotated=(p,angle)=>[p[0]*Math.cos(angle)-p[1]*Math.sin(angle),p[0]*Math.sin(angle)+p[1]*Math.cos(angle),p[2]];
function segment(kit,parent,a,b,r,tone){const mesh=kit.rod(a,b,r,tone,parent),length=new THREE.Vector3(...a).distanceTo(new THREE.Vector3(...b));return {mesh,length};}
function moveSegment(s,a,b){const start=new THREE.Vector3(...a),end=new THREE.Vector3(...b),delta=end.clone().sub(start);s.mesh.position.copy(start.add(end).multiplyScalar(.5));s.mesh.scale.y=delta.length()/s.length;s.mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),delta.normalize());}

export function createVibrationMotorGeometry(kit){
  const system=kit.part('system','Vibration motor experiment','A cylindrical brushed motor on an ideal guided carriage. The motor is shown cut away; only carriage displacement is enlarged.');
  const make=(id,name,description,parent=system)=>kit.part(id,name,description,[0,0,0],parent);
  const fixture=make('fixture','Fixed test fixture','Supports the ideal planar guides, optional springs and supply. This fixed jig is outside the moving mass.');fixture.userData.explosionCategory=true;
  kit.box([4.5,.12,3.6],[.45,-.12,0],'cream',fixture);
  for(const x of [-1.5,1.5])for(const z of [-1.35,1.35])kit.box([.17,.16,.17],[x,.02,z],'ink',fixture);
  const holder=kit.box([.50,.12,.80],[2,.03,1.05],'leaf',fixture);
  const carriage=make('carriage','Guided moving carriage','Includes the motor housing and assigned body mass. Ideal guides prevent rotation and support gravity normal to the horizontal plane. Translation is enlarged 20 times.');
  const carriagePlate=kit.box([1.74,.12,1.74],[0,.15,0],'metal',carriage);
  for(const x of [-.6,.6])for(const z of [-.5,.5])kit.rod([x,.21,z],[x,.36,z],.065,'ink',carriage);
  const motor=make('motor','Connected brushed ERM','The rotor turns an eccentric weight. Its acceleration pushes on the shaft bearings and housing. The stator, brushes and housing stay fixed to the carriage.');
  motor.rotation.x=-Math.PI/2;motor.position.y=1.02;
  const housing=make('housing','Cutaway case and end frames','A partial shell reveals the motor. End-frame ribs support two shaft bearings; the real case would enclose the mechanism.',motor);housing.userData.explosionCategory=true;
  const shell=sector(kit,housing,.70,.75,1.18,0,Math.PI*.1,Math.PI*.9,'metal');
  const endFrames=[];
  for(const z of [-.66,.66]){
    sector(kit,housing,.63,.75,.10,z,0,Math.PI*2,'metal');
    for(const a of [Math.PI/2,Math.PI*7/6,Math.PI*11/6])endFrames.push(kit.rod([.11*Math.cos(a),.11*Math.sin(a),z],[.69*Math.cos(a),.69*Math.sin(a),z],.035,'metal',housing));
  }
  const bearings=make('bearings','Two shaft bearings','Front and rear bearings transmit rotor forces to the end frames while allowing the shaft to turn.',motor);
  const bearingMeshes=[-.66,.66].map(z=>sector(kit,bearings,.041,.13,.12,z,0,Math.PI*2,'gold'));
  const stator=make('stator','Opposed permanent magnets','Two fixed magnet arcs establish opposite poles around the rotating three-pole armature. The field distribution is not numerically solved.',motor);
  for(const [i,a]of [0,Math.PI].entries())sector(kit,stator,.55,.70,.70,0,a-Math.PI/3,a+Math.PI/3,i?'blue':'red');
  const rotor=make('rotor','Rotor and eccentric weights','The shaft, iron armature, coils, commutator and fitted weights turn together. The removable spare is stored on the fixture when unused. The balanced motor inertia is assigned separately from the calculated weight inertia.',motor);rotor.userData.explosionCategory=true;
  const shaft=make('shaft','Rotor shaft and weight hub','The shaft runs through both bearings. A concentric hub fills the weight bore and carries the eccentric mass.',rotor);
  const shaftMesh=kit.disk(.04,1.85,[0,0,.095],'ink',shaft),hub=kit.disk(.082,.15,[0,0,.86],'ink',shaft);
  const armature=make('armature','Three-pole iron armature','Three radial iron teeth carry the windings. The rotor is balanced before the eccentric weight is fitted.',rotor);
  kit.disk(.16,.52,[0,0,0],'metal',armature);
  const windings=make('windings','Three connected copper windings','Insulated wire surrounds each radial armature tooth. The three coils join in a closed delta at three commutator nodes. This drawing does not resolve instantaneous coil currents.',rotor);
  const commutator=make('commutator','Three-segment commutator','Three copper segments on an insulating hub rotate with the coils and successively contact the two stationary brushes. The hub supports the segments without shorting them through the shaft.',rotor);
  const commutatorHub=sector(kit,commutator,.04,.07,.15,-.52,0,Math.PI*2,'cream');
  const coilEnds=[],commutatorMeshes=[];
  for(let i=0;i<3;i++){
    const a=i*Math.PI*2/3,core=new THREE.Group();core.rotation.z=a;armature.add(core);
    kit.box([.32,.12,.46],[.30,0,0],'metal',core);kit.box([.08,.34,.49],[.48,0,0],'metal',core);
    const path=[];for(let turn=0;turn<7;turn++){const r=.18+turn*.037;for(const [j,p]of [[r,-.09,-.255],[r,.09,-.255],[r,.09,.255],[r,-.09,.255],[r+.037,-.09,-.255]].entries())path.push(rotated(p,a));}
    kit.tube(path,.012,'clay',windings);coilEnds.push([path[0],path.at(-1)]);
    commutatorMeshes.push(sector(kit,commutator,.07,.18,.13,-.52,a+.035,a+2*Math.PI/3-.035,'clay'));
  }
  const commutatorNodes=Array.from({length:3},(_,i)=>rotated([.155,0,-.46],(i+.5)*Math.PI*2/3));
  for(let i=0;i<3;i++)for(const [j,end]of coilEnds[i].entries()){
    const node=commutatorNodes[(i+j)%3];kit.tube([end,[end[0],end[1],-.36],[node[0],node[1],-.39],node],.01,'clay',windings);
  }
  const brushes=make('brushes','Fixed brushes and insulated holders','Two opposed carbon brushes contact the commutator. Their holders attach to the rear frame; flexible supply leads move with the carriage.',motor);
  const brushMeshes=[],brushTerminals=[];
  for(const side of [-1,1]){
    brushMeshes.push(kit.box([.12,.065,.10],[side*.238,0,-.52],'ink',brushes));
    kit.box([.17,.15,.18],[side*.37,0,-.52],'cream',brushes);
    kit.rod([side*.37,0,-.60],[side*.37,0,-.66],.045,'cream',brushes);
    kit.rod([side*.28,0,-.52],[side*.50,0,-.52],.018,side<0?'ink':'red',brushes);brushTerminals.push([side*.50,0,-.52]);
    // Each brush holder reaches an end-frame ring through an insulating arm.
    kit.rod([side*.37,0,-.66],[side*.70,0,-.66],.025,'cream',brushes);
  }
  const weight=make('weight','Eccentric half-annulus weight','A uniform half-annulus has its center of mass away from the shaft. Its selected mass and centroid offset determine its dimensions and rotational inertia.',rotor);
  const weightMesh=sector(kit,weight,.08,.5,.03,.86,-Math.PI/2,Math.PI/2,'gold');
  const centroid=kit.sphere(.035,[.2,0,.9],'red',weight);centroid.userData.explosionExcluded=true;
  const counterweight=make('counterweight','Optional opposed weight','A removable rotor weight, fitted opposite the first or stored on the fixed spare holder. Both fitted weights add mass and inertia, but their first mass moments cancel.',rotor);
  const counterweightPart=kit.parts.find(part=>part.object===counterweight);
  const counterMesh=sector(kit,counterweight,.08,.5,.03,0,-Math.PI/2,Math.PI/2,'clay');
  const counterCentroid=kit.sphere(.035,[.2,0,.05],'blue',counterweight);counterCentroid.userData.explosionExcluded=true;
  const mount=make('mount','Clamps, springs and dampers','Choose a rigid clamp, ideal free planar guide, or an isotropic linear spring and damper. This schematic fixture does not calibrate a real phone grip.');mount.userData.explosionCategory=true;
  const clamp=new THREE.Group(),elastic=new THREE.Group(),free=new THREE.Group();mount.add(clamp,elastic,free);
  for(const side of [-1,1])kit.box([.17,.34,.4],[side*.88,.18,0],'ink',clamp);
  for(const z of [-.7,.7])kit.rod([-1.3,.02,z],[1.3,.02,z],.025,'blue',free);
  const springs=[],dampers=[];
  for(let i=0;i<4;i++){
    const a=i*Math.PI/2,anchor=[1.5*Math.cos(a),.16,1.35*Math.sin(a)],seat=[.87*Math.cos(a),.16,.87*Math.sin(a)];
    kit.box([.12,.28,.12],[anchor[0],.07,anchor[2]],'ink',elastic);
    const l=line(elastic,Array.from({length:65},()=>anchor.slice()),color.gold);springs.push({anchor,seat,line:l});
    dampers.push({anchor,seat,outer:segment(kit,elastic,anchor,seat,.045,'blue'),inner:segment(kit,elastic,anchor,seat,.018,'ink')});
  }
  const drive=make('drive','Ideal reversible DC drive','Connects a declared DC voltage, opens the motor terminals to coast, or shorts them to brake. Reversal changes supply polarity. The ideal source can absorb energy.');
  kit.box([.70,.38,.65],[2,.12,-.75],'leaf',drive);
  const terminals=[[1.8,.34,-.62],[2.16,.34,-.62]];for(const [i,p]of terminals.entries())kit.sphere(.045,p,i?'red':'ink',drive);
  const leads=make('leads','Flexible motor leads','Two separate conductors connect the fixed drive terminals to the stationary brushes on the moving motor. They are assumed mechanically compliant.');
  const leadLines=terminals.map((p,i)=>line(leads,[p,p,p,p],i?color.red:color.ink));
  const guides=new THREE.Group();guides.userData.explosionExcluded=true;system.add(guides);
  label(guides,'Cylindrical ERM · connected cutaway',.2,2.45,4.5,.18,.2);
  const status=label(guides,'',.2,-.55,4.6,.16,2.3),motionCaption=label(guides,'',.2,-.81,4.6,.15,2.3);
  for(const caption of guides.children)caption.material.side=THREE.FrontSide;

  function detail(id,name,description){const object=make(id,name,description);object.userData.inspectionOnly=id;object.userData.explosionExcluded=true;return object;}
  const circuit=detail('circuit-detail','Drive, current and back EMF','An averaged DC circuit. The motor winding resistance and speed-dependent back EMF set the signed current; torque is proportional to that current.');
  label(circuit,'Voltage → current → torque',0,1.65,3.8,.21);
  const circuitPath=line(circuit,[[-1.05,.75,-.02],[-1.4,.75,-.02],[-1.4,-.55,-.02],[1.4,-.55,-.02],[1.4,.75,-.02],[-.67,.75,-.02]],color.ink);
  for(const x of [-1.4,0,1.4])kit.box([.52,.42,.08],[x,x===0?.75:.05,0],x===0?'clay':x<0?'leaf':'blue',circuit);
  const switchArm=line(circuit,[[-1.05,.75,.02],[-.67,.75,.02]],color.red);
  label(circuit,'Ideal drive',-1.4,-.30,.95,.13);label(circuit,'20 Ω',0,.75,.45,.13);label(circuit,'Back EMF',1.4,-.30,.95,.13);
  const voltageLabel=label(circuit,'',-1.4,.06,.48,.12),emfLabel=label(circuit,'',1.4,.06,.48,.12),currentArrow=arrow(kit,circuit,color.gold,.45,.97);
  const circuitStatus=label(circuit,'',0,1.32,3.8,.16),currentLabel=label(circuit,'',0,-.88,3.8,.17),torqueLabel=label(circuit,'',0,-1.2,3.8,.15);
  label(circuit,'I = (V − Kω) / R when connected; I = 0 when open',0,-1.57,3.95,.14);

  const response=detail('response-detail','Weight force and carriage response','Gold and blue traces show horizontal X and Y carriage displacement. Two arrows distinguish generalized unbalance excitation from the actual weight force on the carriage.');
  label(response,'Rotating force, moving carriage',0,1.73,3.95,.20);
  const excitationArrow=arrow(kit,response,color.gold,-.98,.84),reactionArrow=arrow(kit,response,color.blue,1,.84);
  for(const x of [-.98,1]){line(response,[[x-.44,.84,-.02],[x+.44,.84,-.02]],color.grid);line(response,[[x,.40,-.02],[x,1.28,-.02]],color.grid);label(response,'X',x+.51,.84,.12,.10);label(response,'Y',x+.08,1.25,.12,.10);}
  label(response,'Unbalance excitation',-.98,1.36,1.88,.13);label(response,'Weight on carriage',1,1.36,1.88,.13);
  const forceLabels=[label(response,'',-.98,.31,1.85,.13),label(response,'',1,.31,1.85,.13)];
  for(const y of [-.12,-.62,-1.12])line(response,[[-1.5,y,0],[1.5,y,0]],color.grid);
  const xTrace=line(response,Array.from({length:201},()=>[-1.5,-.62,.04]),color.gold),yTrace=line(response,Array.from({length:201},()=>[-1.5,-.62,.05]),color.blue);
  const upper=label(response,'',-1.76,-.12,.49,.12),lower=label(response,'',-1.76,-1.12,.49,.12);
  label(response,'0 ms',-1.5,-1.31,.5,.12);label(response,'200 ms',1.5,-1.31,.7,.12);
  const responseStatus=label(response,'',0,-1.57,3.9,.15),responseCaption=label(response,'',0,-1.84,3.9,.12);

  const energy=detail('energy-detail','Energy account','Source work equals mechanical energy plus resistance heating, rotor friction and mount damping. The coupled kinetic energy includes both translating body and eccentric weights.');
  label(energy,'Where the electrical work goes',0,1.70,3.9,.20);
  const energyBars=[],energyLabels=[],rows=[['work','Source work','gold'],['energy','Mechanical energy','blue'],['copperLoss','Winding heat','clay'],['rotorLoss','Rotor friction','ink'],['mountLoss','Mount damping','leaf']];
  for(const [i,[key,name,tone]]of rows.entries()){
    const y=1.13-i*.45;label(energy,name,-1.07,y,1.7,.13);
    const bar=kit.box([1.3,.15,.04],[.5,y,0],tone,energy);energyBars.push({key,bar});energyLabels.push(label(energy,'',1.51,y,.72,.12));
  }
  const energyStatus=label(energy,'',0,-1.39,3.9,.15);label(energy,'Work = mechanical energy + three losses',0,-1.70,3.9,.14);
  return {system,motor,housing,shell,endFrames,bearings,bearingMeshes,stator,rotor,shaft,shaftMesh,hub,armature,windings,coilEnds,commutator,commutatorHub,commutatorNodes,commutatorMeshes,brushes,brushMeshes,brushTerminals,weight,weightMesh,centroid,counterweight,counterweightPart,counterMesh,counterCentroid,fixture,holder,carriage,carriagePlate,mount,clamp,elastic,free,springs,dampers,drive,terminals,leads,leadLines,guides,status,motionCaption,circuit,circuitPath,switchArm,voltageLabel,emfLabel,currentArrow,circuitStatus,currentLabel,torqueLabel,response,excitationArrow,reactionArrow,forceLabels,xTrace,yTrace,upper,lower,responseStatus,responseCaption,energy,energyBars,energyLabels,energyStatus,shapeKey:''};
}

export function updateVibrationMotorGeometry(p,s){
  const {values:v,parameters:params}=s,w=params.weight,scale=MOTOR_LENGTH_SCALE,M=MOTOR_MOTION_SCALE;
  const dx=s.x*scale*M,dz=-s.y*scale*M;
  p.carriage.position.set(dx,0,dz);p.motor.position.set(dx,1.02,dz);p.rotor.rotation.z=s.angle;
  const key=`${v.mass}/${v.offset}`;
  if(p.shapeKey!==key){for(const mesh of [p.weightMesh,p.counterMesh]){mesh.geometry.dispose();mesh.geometry=sectorGeometry(w.inner*scale,w.outer*scale,w.thickness*scale,-Math.PI/2,Math.PI/2);}p.shapeKey=key;}
  p.centroid.position.set(v.offset*.1,0,.86+w.thickness*scale/2+.02);
  p.counterCentroid.position.set(v.offset*.1,0,w.thickness*scale/2+.02);
  p.system.updateMatrixWorld(true);
  const weightParent=v.balance?p.rotor:p.fixture;
  if(p.counterweight.parent!==weightParent)weightParent.add(p.counterweight);
  // Logical part ancestry stays with the rotor; physical mounting changes.
  if(v.balance){p.counterweight.position.set(0,0,.86);p.counterweight.rotation.set(0,0,Math.PI);}
  else {p.counterweight.position.set(2,.09+w.thickness*scale/2,1.05);p.counterweight.rotation.set(-Math.PI/2,0,Math.PI/2);}
  p.clamp.visible=v.mount===0;p.elastic.visible=v.mount===2;p.free.visible=v.mount===1;
  p.springs.forEach(({anchor,seat,line:l},i)=>{
    const end=[seat[0]+dx,seat[1],seat[2]+dz],a=new THREE.Vector3(...anchor),delta=new THREE.Vector3(...end).sub(a),across=new THREE.Vector3(-delta.z,0,delta.x).normalize();
    points(l,Array.from({length:65},(_,j)=>{const f=j/64,amp=j===0||j===64?0:.055*Math.sin(j*Math.PI/4);return a.clone().addScaledVector(delta,f).addScaledVector(across,amp).toArray();}));
    const d=p.dampers[i],shift=[0,.10,0],start=anchor.map((x,j)=>x+shift[j]),finish=end.map((x,j)=>x+shift[j]),mid=start.map((x,j)=>x+(finish[j]-x)*.62);
    moveSegment(d.outer,start,mid);moveSegment(d.inner,mid,finish);
  });
  p.leadLines.forEach((l,i)=>{const start=p.terminals[i],end=new THREE.Vector3(...p.brushTerminals[i]).applyMatrix4(p.motor.matrix).toArray();points(l,[start,[1.30,.38,-.50-i*.15],[end[0]+.1,.38,end[2]-.14],end]);});
  p.status.userData.setText(`${s.rpm.toFixed(0)} rpm · ${(s.current*1000).toFixed(1)} mA · ${s.time.toFixed(3)} s`);
  p.motionCaption.userData.setText(`Carriage motion ×${M} · time runs 100 times slower`);
  p.circuitStatus.userData.setText(s.circuit);p.voltageLabel.userData.setText(s.connected?`${s.voltage.toFixed(1)} V`:'Open');p.emfLabel.userData.setText(`${s.backEmf.toFixed(2)} V`);
  points(p.switchArm,[[-1.05,.75,.02],[-.67,s.connected?.75:1.02,.02]]);
  setArrow(p.currentArrow,Math.sign(s.current),0,.55);p.currentArrow.visible=Math.abs(s.current)>1e-12;
  p.currentLabel.userData.setText(`Signed current: ${(s.current*1000).toFixed(2)} mA`);p.torqueLabel.userData.setText(`Electromagnetic torque: ${(s.electromagneticTorque*1e6).toFixed(2)} μN·m`);
  const forceScale=.42/Math.max(.000001,Math.hypot(s.excitation.x,s.excitation.y),Math.hypot(s.weightReaction.x,s.weightReaction.y));
  setArrow(p.excitationArrow,s.excitation.x,s.excitation.y,forceScale);setArrow(p.reactionArrow,s.weightReaction.x,s.weightReaction.y,forceScale);
  [s.excitation,s.weightReaction].forEach((force,i)=>p.forceLabels[i].userData.setText(`${Math.hypot(force.x,force.y).toFixed(3)} N`));
  const span=Math.max(1,s.maxDisplacement*1e6*1.05);
  points(p.xTrace,s.trace.map(t=>[-1.5+3*t.time/.2,-.62+.5*t.x*1e6/span,.04]));points(p.yTrace,s.trace.map(t=>[-1.5+3*t.time/.2,-.62+.5*t.y*1e6/span,.05]));
  p.upper.userData.setText(`+${span.toFixed(0)}`);p.lower.userData.setText(`−${span.toFixed(0)}`);
  p.responseStatus.userData.setText(`X ${(+s.x*1e6).toFixed(2)} μm · Y ${(+s.y*1e6).toFixed(2)} μm`);
  p.responseCaption.userData.setText('Gold X / blue Y · μm · arrows rescale together each instant');
  const max=Math.max(.000001,s.work,s.energy,s.loss);
  p.energyBars.forEach(({key,bar},i)=>{const ratio=Math.max(0,s[key])/max;bar.scale.x=Math.max(1e-9,ratio);bar.position.x=-.15+.65*ratio;p.energyLabels[i].userData.setText(`${(s[key]*1000).toFixed(3)} mJ`);});
  p.energyStatus.userData.setText(`${s.time.toFixed(3)} s · balance residual ${(s.energyResidual*1e9).toFixed(3)} nJ`);
}

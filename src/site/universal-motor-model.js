import * as THREE from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {houseModel,reading as r} from './house-model-kit.js';

const TAU=2*Math.PI;
export const universalMotorConstants=Object.freeze({coilArea:.008,branchResistance:2,fieldResistance:1,fieldPerAmp:.3,inertia:.00008,viscous:.00004,dryFriction:.00015,fanCoefficient:.000001,gapHalf:.025,brushHalf:.075,step:.00005,clockScale:.5,demoTime:4});

export function solveUniversalCircuit(theta,omega,voltage){
 const {coilArea:K,branchResistance:R,fieldResistance:Rf,fieldPerAmp:beta,gapHalf,brushHalf}=universalMotorConstants;
 const distance=(a,b)=>Math.abs(Math.atan2(Math.sin(a-b),Math.cos(a-b))),centers=[0,1,2].map(j=>theta+TAU*j/3);
 const contacts=[0,Math.PI].map(angle=>centers.flatMap((center,j)=>distance(angle,center)<=Math.PI/3-gapHalf+brushHalf+1e-12?[j]:[]));
 const parent=[0,1,2],find=j=>parent[j]===j?j:find(parent[j]);
 for(const nodes of contacts)for(const node of nodes)parent[find(node)]=find(nodes[0]);
 const groups=[0,1,2].map(find),positive=groups[contacts[0][0]],negative=groups[contacts[1][0]],unknown=[...new Set(groups)].filter(g=>g!==negative),size=unknown.length+1;
 if(positive===negative||contacts.some(c=>!c.length))throw new Error('Invalid universal-motor brush topology');
 const matrix=Array.from({length:size},()=>Array(size+1).fill(0)),coefficients=[0,1,2].map(j=>K*beta*omega*Math.sin(theta+TAU*(j+.5)/3));
 for(let row=0;row<unknown.length;row++){
  const group=unknown[row];
  for(let j=0;j<3;j++){const next=(j+1)%3,orientation=(groups[j]===group?1:0)-(groups[next]===group?1:0);if(!orientation)continue;
   for(let column=0;column<unknown.length;column++)matrix[row][column]+=orientation*((groups[j]===unknown[column]?1:0)-(groups[next]===unknown[column]?1:0))/R;
   matrix[row][size-1]-=orientation*coefficients[j]/R;
  }
  if(group===positive)matrix[row][size-1]-=1;
 }
 matrix[size-1][unknown.indexOf(positive)]=1;matrix[size-1][size-1]=Rf;matrix[size-1][size]=voltage;
 for(let column=0;column<size;column++){
  let pivot=column;for(let row=column+1;row<size;row++)if(Math.abs(matrix[row][column])>Math.abs(matrix[pivot][column]))pivot=row;
  [matrix[column],matrix[pivot]]=[matrix[pivot],matrix[column]];const divisor=matrix[column][column];if(Math.abs(divisor)<1e-12)throw new Error('Singular universal-motor circuit');
  for(let k=column;k<=size;k++)matrix[column][k]/=divisor;
  for(let row=0;row<size;row++)if(row!==column){const factor=matrix[row][column];for(let k=column;k<=size;k++)matrix[row][k]-=factor*matrix[column][k];}
 }
 const seriesCurrent=matrix[size-1][size],fieldB=beta*seriesCurrent,potentials=groups.map(g=>g===negative?0:matrix[unknown.indexOf(g)][size]),emfs=coefficients.map(c=>c*seriesCurrent),branchCurrents=potentials.map((v,j)=>(v-potentials[(j+1)%3]-emfs[j])/R);
 const branchTorques=branchCurrents.map((current,j)=>K*fieldB*Math.sin(theta+TAU*(j+.5)/3)*current),torque=branchTorques.reduce((a,b)=>a+b,0),shortedCoils=[0,1,2].filter(j=>groups[j]===groups[(j+1)%3]);
 return {contacts,groups,potentials,seriesCurrent,fieldB,branchCurrents,emfs,branchTorques,torque,shortedCoils,armatureVoltage:potentials[contacts[0][0]],inputPower:voltage*seriesCurrent,fieldLoss:Rf*seriesCurrent**2,armatureLoss:R*branchCurrents.reduce((sum,i)=>sum+i*i,0),convertedPower:torque*omega};
}

export function createUniversalMotorModel(){
 const m=houseModel('Universal motor'),{part,box,cylinder,ring,rod,tube,control,finish}=m,C=universalMotorConstants;
 const system=part('system','Series-wound universal motor and fan','A reduced three-coil armature and two series field windings drive one supported shaft and fan on DC or illustrative slow AC.');
 const base=part('base','Rigid mounting base','Carries the stator, both bearing pedestals, supply and airflow-indicator stand.',[0,0,0],system);box([4.4,.2,4.9],[0,.1,.25],'wood',base);
 const assembly=part('assembly','Supported motor assembly','The rotor axis is z. Two wound stator poles face the laminated armature across narrow air gaps.',[0,1.5,0],system);
 const stator=part('stator','Laminated stator and two pole shoes','The joined iron yoke returns flux between the wound poles. Its separated sheet layers illustrate lamination.',[0,0,0],assembly);
 const yoke=part('yoke','Joined laminated iron yoke','Side limbs, upper and lower bridges form a connected magnetic return path.',[0,0,0],stator);
 const yokeGeometries=[[],[]];
 for(let i=0;i<32;i++){
  const z=-.775+i*.05,color=i%2?'metal':'ink';
  for(const [size,position] of [[[.2,2.34,.046],[-1.62,0,z]],[[.2,2.34,.046],[1.62,0,z]],[[3.04,.18,.046],[0,1.08,z]],[[3.04,.18,.046],[0,-1.08,z]],[[.6,.44,.046],[-1.25,0,z]],[[.6,.44,.046],[1.25,0,z]]]){const mesh=box(size,position,color,yoke);mesh.updateMatrix();mesh.geometry.applyMatrix4(mesh.matrix);yokeGeometries[i%2].push(mesh.geometry);yoke.remove(mesh);}
 }
 for(let i=0;i<2;i++){const mesh=new THREE.Mesh(mergeGeometries(yokeGeometries[i]),new THREE.MeshToonMaterial({color:i?0xb4c5b0:0x78866f}));yoke.add(mesh);yokeGeometries[i].forEach(g=>g.dispose());}
 for(const side of [-1,1]){box([.36,.13,1.8],[side*1.62,-1.235,0],'ink',stator);}
 const poleMeshes=[];for(const side of [-1,1]){const pole=part(side<0?'left-pole':'right-pole',side<0?'Left wound pole':'Right wound pole','The pole direction follows the total series current and reverses with it.',[side*.94,0,0],stator);const mesh=box([.24,.96,1.6],[0,0,0],side<0?'clay':'blue',pole);mesh.material=mesh.material.clone();poleMeshes.push(mesh);}
 const fieldCoils=part('field-coils','Two series-connected stator windings','Both field coils carry the complete brush current, not an individual armature-branch current.',[0,0,0],assembly);
 const windingEnds=[],fieldArrows=[];
 for(const side of [-1,1]){
  const coil=part(side<0?'left-field-coil':'right-field-coil',side<0?'Left series field winding':'Right series field winding','Eighteen visible turns surround the iron neck. Winding sense gives the same +x magnetization for positive series current.',[0,0,0],fieldCoils),start=side<0?-1.49:1.09,points=[];
  for(let i=0;i<=18*48;i++){const angle=i/48*TAU;points.push([start+.4*i/(18*48),.36*Math.cos(angle),1.0*Math.sin(angle)]);}
  const wire=tube(points,.009,'clay',coil);windingEnds.push([points[0],points.at(-1)]);wire.userData.turns=18;
  const arrow=new THREE.ArrowHelper(new THREE.Vector3(0,0,1),new THREE.Vector3(start+.2,.39,-.15),.3,0xf0dfaf,.06,.03);coil.add(arrow);fieldArrows.push(arrow);
 }
 const bearings=part('bearings','Two fixed shaft bearings','Small bearing bores support the shaft while leaving the larger commutator visible from behind.',[0,0,0],assembly);
 for(const z of [-1.57,1.2]){box([.16,1.15,.22],[0,-.725,z],'cream',bearings);ring(.115,.035,[0,0,z],'metal',bearings);ring(.0725,.0075,[0,0,z],'gold',bearings);}
 const rotor=part('rotor','Three-coil laminated rotor','The slotted iron stack, windings, three copper segments, shaft and fan form one mechanically connected rotor.',[0,0,0],assembly);
 const shaft=part('shaft','Continuous steel shaft','Runs through both bearing bores, the armature stack, insulated commutator sleeve and fan hub.',[0,0,0],rotor);rod([0,0,-1.82],[0,0,1.98],.065,'metal',shaft);
 function annularSector(inner,outer,start,span,depth){const shape=new THREE.Shape();shape.moveTo(outer*Math.cos(start),outer*Math.sin(start));shape.absarc(0,0,outer,start,start+span,false);shape.lineTo(inner*Math.cos(start+span),inner*Math.sin(start+span));shape.absarc(0,0,inner,start+span,start,true);shape.closePath();return new THREE.ExtrudeGeometry(shape,{depth,bevelEnabled:false,curveSegments:12});}
 const armature=part('armature-core','Laminated six-slot armature stack','Six slots carry the active sides of three reduced winding branches. The separated iron sheets are mechanically clamped to the shaft.',[0,0,0],rotor);
 const laminationGeometries=[[],[]];
 for(let layer=0;layer<32;layer++){
  const z=-.8+layer*.05;
  const hub=new THREE.CylinderGeometry(.2,.2,.046,32);hub.rotateX(Math.PI/2);hub.translate(0,0,z+.023);laminationGeometries[layer%2].push(hub.toNonIndexed());hub.dispose();
  for(let tooth=0;tooth<6;tooth++){const geometry=annularSector(.19,.69,tooth*TAU/6-25*Math.PI/180,50*Math.PI/180,.046);geometry.translate(0,0,z);laminationGeometries[layer%2].push(geometry);}
 }
 for(let i=0;i<2;i++){const geometry=mergeGeometries(laminationGeometries[i]);armature.add(new THREE.Mesh(geometry,new THREE.MeshToonMaterial({color:i?0xb4c5b0:0x78866f})));laminationGeometries[i].forEach(g=>g.dispose());}
 const clamp=part('armature-clamps','Armature clamping collars','Insulating collars and radial end supports secure the winding ends without shorting them to the shaft.',[0,0,0],rotor);
 for(const z of [-.82,.82]){cylinder(.16,.04,[0,0,z],'cream',clamp).rotation.x=Math.PI/2;for(let i=0;i<6;i++){const a=(i+.5)*TAU/6;rod([.15*Math.cos(a),.15*Math.sin(a),z],[.65*Math.cos(a),.65*Math.sin(a),z],.018,'cream',clamp);}}
 const commutator=part('commutator','Three-segment commutator','Three mutually insulated copper segments connect to a closed ring of three winding branches. Wide brushes bridge a gap during commutation.',[0,0,-1.15],rotor);
 cylinder(.21,.2,[0,0,0],'cream',commutator).rotation.x=Math.PI/2;
 const segmentColors=[0xce825f,0xe3b45e,0x83b4c1];
 for(let j=0;j<3;j++){const segment=part('segment-'+j,'Copper segment S'+j,'A junction between two neighboring winding branches, insulated from the metal shaft.',[0,0,-.09],commutator);segment.add(new THREE.Mesh(annularSector(.21,.30,TAU*j/3-Math.PI/3+C.gapHalf,2*Math.PI/3-2*C.gapHalf,.18),new THREE.MeshToonMaterial({color:segmentColors[j]})));}
 const windingGroup=part('armature-windings','Three closed-ring winding branches','Branch j connects segment Sj to the next segment. Current divides through the connected network, including the shorted commutating branch.',[0,0,0],rotor);
 const coilArrows=[],forceArrows=[];
 function lineTube(points,radius,color,parent){const path=new THREE.CurvePath();for(let i=1;i<points.length;i++)path.add(new THREE.LineCurve3(new THREE.Vector3(...points[i-1]),new THREE.Vector3(...points[i])));const geometry=new THREE.TubeGeometry(path,Math.max(160,points.length*6),radius,8,false),mesh=new THREE.Mesh(geometry,new THREE.MeshToonMaterial({color}));parent.add(mesh);return mesh;}
 for(let j=0;j<3;j++){
  const psi=TAU*(j+.5)/3,phi=TAU*j/3,coil=part('coil-'+j,'Armature branch '+j+' · S'+j+' to S'+((j+1)%3),'The active sides occupy opposite slots. End connections stay fixed to their two copper segments.',[0,0,0],windingGroup),front=-.86-j*.045,back=.86+j*.045,points=[];
  const polar=(radius,angle,z)=>[radius*Math.cos(angle),radius*Math.sin(angle),z],active=psi-Math.PI/2;
  points.push(polar(.26,phi,-1.06),polar(.26,phi,-1.0),polar(.4,phi,-1.0));for(let i=1;i<=8;i++)points.push(polar(.4,phi-(Math.PI/6)*i/8,-1.0));points.push(polar(.64,active,-1.0),polar(.64,active,front),polar(.64,active,back));
  // The rear end turn passes around the shaft; staggered axial planes separate the three end turns.
  const rotate=(x,y,z)=>[x*Math.cos(psi)-y*Math.sin(psi),x*Math.sin(psi)+y*Math.cos(psi),z];points.push(rotate(0,-.16,back));for(let i=1;i<=16;i++){const a=i*Math.PI/16;points.push(rotate(.16*Math.sin(a),-.16*Math.cos(a),back));}points.push(polar(.64,active+Math.PI,back),polar(.64,active+Math.PI,front),polar(.64,active+Math.PI,-1.0),polar(.4,active+Math.PI,-1.0));for(let i=1;i<=8;i++)points.push(polar(.4,active+Math.PI-(Math.PI/6)*i/8,-1.0));points.push(polar(.26,phi+TAU/3,-1.0),polar(.26,phi+TAU/3,-1.06));
  const wire=lineTube(points,.012,segmentColors[j],coil);wire.userData.branch=j;wire.userData.activeAngle=active;wire.userData.area=C.coilArea;
  const arrow=new THREE.ArrowHelper(new THREE.Vector3(0,0,1),new THREE.Vector3(...polar(.67,active,-.25)),.45,0xf0dfaf,.08,.03);coil.add(arrow);coilArrows.push(arrow);
  const force=new THREE.ArrowHelper(new THREE.Vector3(0,1,0),new THREE.Vector3(),.3,segmentColors[j],.07,.03);assembly.add(force);forceArrows.push(force);
 }
 const brushes=part('brushes','Fixed P and Q brushes','P is at +x and Q at −x. Each brush spans more than one insulating gap, temporarily joining neighboring copper segments.',[0,0,-1.15],assembly);
 for(const side of [-1,1]){const brush=part(side>0?'brush-p':'brush-q',side>0?'Brush P at +x':'Brush Q at −x','The fixed carbon face contacts the rotating ring. Its holder and pedestal are seated on the base.',[0,0,0],brushes),angle=side>0?0:Math.PI;
  const contact=new THREE.Mesh(annularSector(.30,.4,angle-C.brushHalf,2*C.brushHalf,.12),new THREE.MeshToonMaterial({color:0x374736}));contact.position.z=-.06;brush.add(contact);box([.24,.12,.18],[side*.49,0,0],'cream',brush);rod([side*.45,0,0],[side*.65,0,0],.017,'gold',brush);rod([side*.55,-.06,0],[side*.55,-1.22,0],.027,'metal',brush);box([.22,.08,.26],[side*.55,-1.26,0],'ink',brush);
 }
 const supply=part('supply','Low-voltage DC or slow-AC source','The chosen voltage is DC magnitude or the peak of a deliberately slow cosine waveform. This is not a mains supply model.',[-1.35,.48,1.9],system);box([1,.56,.72],[0,0,0],'cream',supply);for(const side of [-1,1])cylinder(.045,.06,[side*.3,.31,0],side>0?'clay':'ink',supply);
 const switchPart=part('switch','Series-circuit disconnect','Opening the source removes field current and armature current in the zero-inductance approximation.',[0,.1,.38],supply),switchLever=box([.18,.065,.06],[0,0,0],'clay',switchPart);
 const leads=part('leads','Complete series-field supply circuit','Source → left field coil → right field coil → P brush → armature network → Q brush → source.',[0,0,0],system);
 const absolute=point=>[point[0],point[1]+1.5,point[2]],leftStart=absolute(windingEnds[0][0]),leftEnd=absolute(windingEnds[0][1]),rightStart=absolute(windingEnds[1][0]),rightEnd=absolute(windingEnds[1][1]);
 lineTube([[-1.05,.82,1.9],[-1.05,.24,1.9],[-1.05,.24,-1.42],[-1.49,.24,-1.42],[-1.49,2.05,-1.42],[-1.49,2.05,0],leftStart],.015,0xce825f,leads);
 lineTube([leftEnd,[-1.09,2.05,0],[-1.09,2.05,-1.42],[1.09,2.05,-1.42],[1.09,2.05,0],rightStart],.015,0xce825f,leads);
 lineTube([rightEnd,[1.49,2.15,0],[1.49,2.15,-1.55],[.8,2.15,-1.55],[.8,1.5,-1.55],[.8,1.5,-1.15],[.65,1.5,-1.15]],.015,0xce825f,leads);
 lineTube([[-.65,1.5,-1.15],[-.65,.24,-1.15],[-1.95,.24,-1.15],[-1.95,.24,1.9],[-1.65,.24,1.9],[-1.65,.82,1.9]],.015,0x374736,leads);
 const fan=part('fan','Shaft-mounted useful fan load','The fan turns rigidly with the motor shaft. Its illustrative drag consumes mechanical power.',[0,0,1.72],rotor);cylinder(.15,.24,[0,0,0],'gold',fan).rotation.x=Math.PI/2;
 for(let j=0;j<4;j++){const blade=part('fan-blade-'+j,'Pitched fan blade','The blade root enters the hub attached to the continuous shaft.',[0,0,0],fan);blade.rotation.z=j*Math.PI/2;const mesh=box([.25,.62,.055],[0,.38,0],'leaf',blade);mesh.rotation.y=.35;}
 const stand=part('ribbon-stand','Supported airflow-indicator stand','A fixed clamp supports the strip behind the fan.',[0,0,0],system);box([.3,.1,.3],[.8,.25,2.35],'ink',stand);rod([.8,.3,2.35],[.8,2,2.35],.023,'metal',stand);rod([.8,2,2.35],[0,2,2.35],.023,'metal',stand);box([.12,.06,.06],[0,2,2.35],'gold',stand);
 const ribbon=part('ribbon','Clamped flexible airflow ribbon','A fixed-length strip bends with fan speed as an explicitly qualitative air-movement indicator.',[0,1.97,2.35],system),ribbonGeometry=new THREE.BufferGeometry(),ribbonPositions=new Float32Array(65*2*3),ribbonIndices=[];
 for(let i=0;i<64;i++){const a=i*2;ribbonIndices.push(a,a+1,a+2,a+1,a+3,a+2);}ribbonGeometry.setAttribute('position',new THREE.BufferAttribute(ribbonPositions,3));ribbonGeometry.setIndex(ribbonIndices);ribbon.add(new THREE.Mesh(ribbonGeometry,new THREE.MeshToonMaterial({color:0xe3b45e,side:THREE.DoubleSide})));
 const guard=part('cover','Removable transparent front guard','A supported transparent panel shields the rotating armature. Its actual central opening clears the shaft. Look inside removes the guard for inspection.',[0,0,1.04],assembly);
 const guardShape=new THREE.Shape();guardShape.moveTo(-1.8,-1.24);guardShape.lineTo(1.8,-1.24);guardShape.lineTo(1.8,1.25);guardShape.lineTo(-1.8,1.25);guardShape.closePath();const shaftOpening=new THREE.Path();shaftOpening.absarc(0,0,.24,0,TAU,true);guardShape.holes.push(shaftOpening);guard.add(new THREE.Mesh(new THREE.ExtrudeGeometry(guardShape,{depth:.04,bevelEnabled:false,curveSegments:32}),new THREE.MeshToonMaterial({color:0x83b4c1,transparent:true,opacity:.12,depthWrite:false,side:THREE.DoubleSide})));
 for(const x of [-1.8,1.8]){rod([x,-1.24,.02],[x,1.25,.02],.018,'metal',guard);box([.18,.06,.22],[x,-1.27,.02],'ink',guard);}for(const y of [-1.24,1.25])rod([-1.8,y,.02],[1.8,y,.02],.018,'metal',guard);m.covers.push(guard);
 const field=part('field','Series-field direction indicators','The indicated field reverses when the total series current reverses. Arrows are not a computed field map.',[0,0,0],assembly),fieldIndicators=[];
 for(const z of [-.6,0,.6]){const arrow=new THREE.ArrowHelper(new THREE.Vector3(1,0,0),new THREE.Vector3(-.76,.78,z),1.52,0x83b4c1,.1,.04);field.add(arrow);fieldIndicators.push(arrow);}
 control('operation','Run action',0,1,1,0,'','Power captures a running state after four simulated seconds. Disconnect coasts until the shaft is at rest.',[{value:0,label:'Power the fan'},{value:1,label:'Disconnect and coast'}]);
 control('source','Source waveform',0,1,1,0,'','Choose DC or a deliberately slow AC waveform, not a model of mains-frequency operation.',[{value:0,label:'DC'},{value:1,label:'Slow AC'}]);
 control('voltage','Source voltage',0,6,.5,3,'V','DC magnitude or AC peak amplitude, not AC RMS.');
 control('polarity','Source polarity',-1,1,2,1,'','Reverses both the series field and armature currents. It does not reverse the preferred torque direction.',[{value:1,label:'Normal polarity'},{value:-1,label:'Reversed polarity'}]);
 control('frequency','Slow AC frequency',.5,2,.25,1,'Hz','The cosine waveform starts at its positive crest. Used only for Slow AC.');
 control('load','Fan load',0,2,.25,1,'','Multiplier on the illustrative quadratic fan drag. Zero retains bearing friction.');
 control('startAngle','Starting angle',0,360,1,30,'°','Applied while ready or by Restart rotor; changing it during a run never moves the shaft.');
 let theta=Math.PI/6,omega=0,elapsed=0,actionTime=0,sourceTime=0,accumulator=0,lastClock=0,travel=0,stage='ready',complete=false,blocked=false;
 const sourceVoltage=v=>stage==='ready'||v.operation===1?0:v.voltage*v.polarity*(v.source===1?Math.cos(TAU*v.frequency*sourceTime):1);
 function bendRibbon(){const bend=1.4*Math.tanh(omega/30)*(1+.04*Math.sin(elapsed*11));for(let i=0;i<=64;i++){const t=i/64,y=Math.abs(bend)<1e-9?-.5*t:-.5*Math.sin(bend*t)/bend,z=Math.abs(bend)<1e-9?0:.5*(1-Math.cos(bend*t))/bend;for(let edge=0;edge<2;edge++)ribbonGeometry.attributes.position.setXYZ(i*2+edge,(edge-.5)*.07,y,z);}ribbonGeometry.attributes.position.needsUpdate=true;ribbonGeometry.computeVertexNormals();if(ribbonGeometry.boundingBox)ribbonGeometry.computeBoundingBox();if(ribbonGeometry.boundingSphere)ribbonGeometry.computeBoundingSphere();return bend;}
 const result=finish(v=>{
  const voltage=sourceVoltage(v),e=solveUniversalCircuit(theta,omega,voltage),powered=stage!=='ready'&&v.operation===0,rpm=omega*60/TAU,fanTorque=C.fanCoefficient*v.load*omega*Math.abs(omega),fanPower=fanTorque*omega,ribbonBend=bendRibbon(),sign=Math.sign(e.seriesCurrent)||1;
  rotor.rotation.z=theta;switchLever.rotation.z=powered?0:.5;field.visible=Math.abs(e.fieldB)>1e-6;
  fieldIndicators.forEach(arrow=>{arrow.position.x=sign>0?-.76:.76;arrow.setDirection(new THREE.Vector3(sign,0,0));});fieldArrows.forEach(arrow=>{arrow.visible=Math.abs(e.seriesCurrent)>1e-6;arrow.setDirection(new THREE.Vector3(0,0,sign));});poleMeshes.forEach((mesh,j)=>{mesh.material.color.setHex(Math.abs(e.fieldB)<1e-6?0xb4c5b0:(j===0)===(sign>0)?0xce825f:0x83b4c1);});
  for(let j=0;j<3;j++){coilArrows[j].visible=Math.abs(e.branchCurrents[j])>1e-6;coilArrows[j].setDirection(new THREE.Vector3(0,0,Math.sign(e.branchCurrents[j])||1));const psi=theta+TAU*(j+.5)/3,force=e.fieldB*e.branchCurrents[j]*.1;forceArrows[j].position.set(.64*Math.sin(psi),-.64*Math.cos(psi),0);forceArrows[j].visible=Math.abs(force)>1e-6;forceArrows[j].setDirection(new THREE.Vector3(0,Math.sign(force)||1,0));forceArrows[j].setLength(.1+Math.min(.35,Math.abs(force)*3),.065,.025);}
  const pair=e.contacts.map((nodes,j)=>(j===0?'P: ':'Q: ')+nodes.map(n=>'S'+n).join('+')).join(' · '),status=stage==='ready'?'Ready · rotor at starting angle':blocked?(v.voltage===0?'No start · source voltage is zero':'No start · drive cannot overcome friction'):complete&&v.operation===1?'Stopped · fan has coasted to rest':complete?'Running snapshot · fan driven by the series motor':v.operation===1?'Coasting · field and armature are disconnected':'Powered · series field and armature drive the fan';
  return {state:{theta,omega,rpm,elapsed,actionTime,sourceTime,travel,stage,complete,blocked,powered,voltage,...e,fanTorque,fanPower,ribbonBend,kineticEnergy:.5*C.inertia*omega**2},readings:[r('Your result',status),r('Shaft speed',`${rpm.toFixed(1)} rpm`),r('Source voltage',`${voltage.toFixed(3)} V`,v.source===1?'Slow cosine AC; setting is peak, not RMS.':'Signed DC voltage.'),r('Series current',`${e.seriesCurrent.toFixed(3)} A`,'Both stator windings carry this total brush current.'),r('Field direction',Math.abs(e.fieldB)<1e-6?'No field · current is zero':e.fieldB>0?'Left N · right S':'Left S · right N'),r('Field strength',`${e.fieldB.toFixed(3)} T`,'Assumed B = 0.3 × series current.'),r('Armature branch currents',e.branchCurrents.map((i,j)=>`${j}: ${i.toFixed(3)} A`).join(' · '),'Positive branch j runs from Sj to the next segment.'),r('Brush contacts',pair),r('Commutation',e.shortedCoils.length?'Brush shorts branch '+e.shortedCoils.join(', '):'Two parallel armature paths','A shorted winding can still carry induced current.'),r('Driving torque',`${(e.torque*1000).toFixed(3)} mN·m`),r('Fan power',`${(fanPower*1000).toFixed(2)} mW`,'Illustrative aerodynamic load, not a fan rating.'),r('Rotor travel',`${travel.toFixed(2)} turns`),r('Simulated time',`${elapsed.toFixed(2)} s`,'Motion is shown twice as slowly.'),r('Model limit','Reduced three-coil ring · zero inductance','Slow AC only; assumed resistance, linear field, inertia, friction and fan drag. Not mains-frequency performance.')]};
 });
 const render=result.update;
 result.update=next=>{const before=result.getState().values;render(next);const after=result.getState().values;if(Object.keys(after).some(key=>before[key]!==after[key])){complete=blocked=false;actionTime=0;if(stage==='ready')theta=after.startAngle*Math.PI/180;if(before.source!==after.source||before.frequency!==after.frequency)sourceTime=0;}return render();};
 function advance(seconds){if(!Number.isFinite(seconds)||seconds<=0||complete||blocked)return render();if(stage==='ready')stage='running';const v=result.getState().values;accumulator+=seconds*C.clockScale;
  while(accumulator>=C.step-1e-13&&!complete&&!blocked){accumulator-=C.step;elapsed+=C.step;actionTime+=C.step;sourceTime+=C.step;const e=solveUniversalCircuit(theta,omega,sourceVoltage(v)),drag=C.viscous*omega+C.fanCoefficient*v.load*omega*Math.abs(omega),net=e.torque-drag,friction=omega===0?Math.max(-C.dryFriction,Math.min(C.dryFriction,net)):Math.sign(omega)*C.dryFriction,previous=omega;omega+=(net-friction)/C.inertia*C.step;if(previous*omega<0&&Math.abs(net)<=C.dryFriction)omega=0;theta+=omega*C.step;travel+=Math.abs(omega)*C.step/TAU;
   if(v.operation===1&&omega===0)complete=true;else if(v.operation===0&&actionTime>=C.demoTime-1e-10){complete=Math.abs(omega)>1e-4;blocked=!complete;}else if(v.operation===0&&omega===0&&actionTime>.15&&(v.source===0||v.voltage===0))blocked=true;
   if(complete||blocked){stage=complete?'finished':'blocked';accumulator=0;}
  }return render();
 }
 function restart(defaults=false){if(defaults)render(result.defaults);theta=result.getState().values.startAngle*Math.PI/180;omega=elapsed=actionTime=sourceTime=accumulator=lastClock=travel=0;stage='ready';complete=blocked=false;return render();}
 result.advance=advance;result.animate=clock=>{if(!Number.isFinite(clock))return render();const delta=Math.max(0,clock-lastClock);lastClock=clock;return advance(delta);};result.reset=initialState=>{restart(true);if(initialState?.poweredFan)advance(C.demoTime/C.clockScale+C.step);return render();};
 result.actions=[{label:'Restart rotor at selected angle',part:'system',view:'reset',run:()=>restart()}];result.controls.find(c=>c.key==='frequency').enabledWhen=v=>v.source===1;
 result.playback={label:'Run selected action',stepLabel:'Advance one step',description:'Power captures a running state after four simulated seconds. Disconnect runs to actual rest. Motion is shown twice as slowly.',advance,step:()=>advance(.05),complete:()=>complete,blocked:()=>blocked};
 result.followParts=['rotor','shaft','armature-core','armature-clamps','armature-windings','coil-0','coil-1','coil-2','commutator','segment-0','segment-1','segment-2','fan'];result.framingBounds=new THREE.Box3().setFromObject(result.root);result.resultPart={id:'system',context:'system',focusOnComplete:false,label:'Inspect the series motor and fan',available:()=>true};return result;
}

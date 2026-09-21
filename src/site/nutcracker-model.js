import * as THREE from 'three';
import {houseModel,reading} from './house-model-kit.js';
import {sampleNutcracker,NUTCRACKER_DEFAULTS as D,NUTCRACKER_DOMAINS,NUTCRACKER_CONSTANTS as C} from './nutcracker-physics.js';

export function createNutcrackerModel(){
 const kit=houseModel('Nutcracker'),{root,part,control,finish}=kit,scale=30;
 const system=part('system','Nutcracker','Two hinged second-class levers squeeze a seated nut between the hinge and the hands. The hand-force control applies to each handle.');
 const hinge=part('hinge','Shared hinge','A through-pin joins the two bearing leaves. Its opposing reactions hold the common pivot while both handles turn.',[0,0,0],system);
 const pin=kit.disk(.061,.37,[0,0,0],'ink',hinge);
 const pinCaps=[-.197,.197].map(z=>kit.disk(.089,.03,[0,0,z],'gold',hinge));
 const handles=part('handles','Paired handles','Both long handles move inward. Each handle supplies its own work; together their input equals the work delivered to the shell.',[0,0,0],system);
 handles.userData.explosionPieces=true;
 const upperLever=new THREE.Group(),lowerLever=new THREE.Group();handles.add(upperLever,lowerLever);
 const jaws=part('jaws','Opposing rounded jaws','The rounded bosses touch the nut at its upper and lower poles. Their distance from the hinge determines the force advantage.',[0,0,0],system);
 jaws.userData.explosionPieces=true;
 const bosses=[kit.sphere(C.bossRadius*scale,[0,0,0],'metal',jaws),kit.sphere(C.bossRadius*scale,[0,0,0],'metal',jaws)];
 function bearing(parent,depth,z){
  const shape=new THREE.Shape();shape.absarc(0,0,.14,0,Math.PI*2,false);
  const hole=new THREE.Path();hole.absarc(0,0,.064,0,Math.PI*2,true);shape.holes.push(hole);
  const mesh=kit.disk(1,1,[0,0,z],'metal',parent);mesh.rotation.x=0;mesh.geometry.dispose();
  mesh.geometry=new THREE.ExtrudeGeometry(shape,{depth,bevelEnabled:false,curveSegments:48});mesh.geometry.translate(0,0,-depth/2);return mesh;
 }
 const bearings=[bearing(upperLever,.075,-.1125),bearing(upperLever,.075,.1125),bearing(lowerLever,.14,0)];
 function link(parent,radius=.06,color='metal'){return kit.cylinder(radius,1,[0,0,0],color,parent);}
 function setLink(mesh,a,b){const start=new THREE.Vector3(...a),end=new THREE.Vector3(...b);mesh.position.copy(start).add(end).multiplyScalar(.5);mesh.scale.y=start.distanceTo(end);mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),end.sub(start).normalize());}
 const levers=[upperLever,lowerLever].map((object,index)=>{
  const side=index===0?1:-1,links=Array.from({length:index===0?5:4},()=>link(object)),jawStem=link(object,.065);
  const grip=kit.box([1,.16,.22],[0,0,0],index===0?'clay':'leaf',object),handDot=kit.sphere(.09,[0,0,0],'blue',object);
  return {object,side,links,jawStem,grip,handDot};
 });
 const nut=part('nut','Seated nut','The nut follows the two jaw centers while being compressed. A located, slow seating is assumed; rolling and inertia are outside this model.',[0,0,0],system);
 const shell=part('shell','Nut shell','The shell deforms as one closed surface up to the assumed 2 mm failure compression. After cracking, manual inspection separates the adjoining halves.',[0,0,0],nut);
 const shellHalves=[new THREE.Group(),new THREE.Group()];shell.add(...shellHalves);
 const latitudes=32,longitudes=48,shellMeshes=[],shellTemplates=[];
 function shellPoint(theta,phi,inner){
  const sin=Math.sin(theta),ridge=inner?1:1-.025*sin*sin*(.5+.5*Math.cos(11*phi+1.4*Math.sin(3*theta)));
  return {unit:[sin*Math.cos(phi)*ridge,Math.cos(theta),sin*Math.sin(phi)*ridge],inner};
 }
 for(let half=0;half<2;half++){
  const template=[],base=half*Math.PI,append=(a,b,c)=>template.push(a,b,c);
  for(let i=0;i<latitudes;i++)for(let j=0;j<longitudes;j++)for(const inner of [false,true]){
   const t0=i*Math.PI/latitudes,t1=(i+1)*Math.PI/latitudes,p0=base+j*Math.PI/longitudes,p1=base+(j+1)*Math.PI/longitudes;
   const a=shellPoint(t0,p0,inner),b=shellPoint(t1,p0,inner),c=shellPoint(t1,p1,inner),d=shellPoint(t0,p1,inner);
   if(inner){append(a,b,c);append(a,c,d);}else{append(a,c,b);append(a,d,c);}
  }
  for(const phi of [base,base+Math.PI])for(let i=0;i<latitudes;i++){
   const t0=i*Math.PI/latitudes,t1=(i+1)*Math.PI/latitudes,a=shellPoint(t0,phi,false),b=shellPoint(t1,phi,false),c=shellPoint(t1,phi,true),d=shellPoint(t0,phi,true);append(a,b,c);append(a,c,d);
  }
  const mesh=kit.sphere(1,[0,0,0],'wood',shellHalves[half]);mesh.geometry.dispose();mesh.geometry=new THREE.BufferGeometry();mesh.geometry.setAttribute('position',new THREE.BufferAttribute(new Float32Array(template.length*3),3));mesh.material=mesh.material.clone();mesh.material.side=THREE.DoubleSide;mesh.frustumCulled=false;shellMeshes.push(mesh);shellTemplates.push(template);
 }
 const kernel=part('kernel','Kernel','The kernel is initially enclosed by the shell. It is exposed only after the model reaches shell failure and the cracked shell is moved aside for inspection.',[0,0,0],nut);
 const kernelMesh=kit.sphere(1,[0,0,0],'cream',kernel);kernelMesh.geometry.dispose();kernelMesh.geometry=new THREE.SphereGeometry(1,64,48);
 const kernelPositions=kernelMesh.geometry.attributes.position;
 for(let i=0;i<kernelPositions.count;i++){
  const x=kernelPositions.getX(i),y=kernelPositions.getY(i),z=kernelPositions.getZ(i),phi=Math.atan2(z,x),theta=Math.acos(Math.max(-1,Math.min(1,y)));
  const relief=.91+.065*Math.sin(theta)**2*Math.cos(5*phi+1.5*Math.sin(4*theta))+.025*Math.cos(9*theta);kernelPositions.setXYZ(i,x*relief,y*relief,z*relief);
 }
 kernelPositions.needsUpdate=true;kernelMesh.geometry.computeVertexNormals();
 const fractureLines=[];
 for(const phase of [.9,2.2]){
  const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.BufferAttribute(new Float32Array(65*3),3));
  const line=new THREE.Line(geometry,new THREE.LineBasicMaterial({color:0x493321}));shellHalves[0].add(line);fractureLines.push({line,phase});
 }
 const forceGuide=part('force-guide','Paired force directions','Blue arrows show the available inward force at each hand. Orange arrows show the equal, opposite compressive forces on the shell, projected in front of the nut for clarity.',[0,0,0],system);
 function arrow(color){const object=new THREE.ArrowHelper(new THREE.Vector3(0,1,0),new THREE.Vector3(),1,color,.085,.055);forceGuide.add(object);return object;}
 const handArrows=[arrow(0x397689),arrow(0x397689)],jawArrows=[arrow(0xc27a3f),arrow(0xc27a3f)];
 forceGuide.userData.explosionExcluded=true;for(const lever of levers)lever.handDot.userData.explosionExcluded=true;
 const specs={
  effort:['Available force on each handle','N','The same force limit applies to each moving handle. A larger unused reserve does not add work.'],
  arm:['Hand distance from hinge','cm','Longer handles need less force but move each hand farther inward for the same shell compression.'],
  seat:['Jaw distance from hinge','cm','Moving the seated nut and jaws farther from the hinge reduces the force advantage.'],
  stiffness:['Assumed resistance rise','N/mm','The assumed shell load starts at 20 N and rises with compression. This is an illustrative load, not a measured nut rating.'],
  diameter:['Nut diameter','mm','A larger nut starts the handles farther apart. With the same resistance law, diameter changes the closing angle and time, not the force ratio.']
 };
 for(const [key,[min,max,step]] of Object.entries(NUTCRACKER_DOMAINS)){const [label,unit,help]=specs[key];control(key,label,min,max,step,D[key],unit,help);}
 let elapsed=0,lastClock=0,disposed=false;
 const format=(n,digits=2)=>(Math.abs(n)<.5*10**-digits?0:n).toFixed(digits);
 const result=finish(v=>{
  const s=sampleNutcracker(v,elapsed),a=s.seat*scale,L=s.arm*scale,rx=s.diameter*scale/2,ry=(s.diameter-s.compression)*scale/2,rz=s.diameter*scale*.45,thickness=.0018*scale;
  nut.position.x=s.nutX*scale;
  for(let index=0;index<2;index++){
   const lever=levers[index],{side,links}=lever;lever.object.rotation.z=side*s.displayedAngle;
   const arch=[a*.42,side*.33,0],overJaw=[a,side*.27,0],shoulder=[a+.32,side*.18,0],hand=[L,0,0];
   let next=0;
   if(index===0)for(const z of [-.1125,.1125])setLink(links[next++],[.1,.06,z],arch);else setLink(links[next++],[.1,-.06,0],arch);
   setLink(links[next++],arch,overJaw);setLink(links[next++],overJaw,shoulder);setLink(links[next],shoulder,hand);setLink(lever.jawStem,[a,0,0],overJaw);
   lever.grip.scale.x=.8;lever.grip.position.set(L-.28,0,0);lever.handDot.position.set(L,0,0);
   bosses[index].position.set(s.jawX*scale,side*s.jawY*scale,0);
   shellHalves[index].position.z=(index===0?1:-1)*s.shellRemoval*(rz+.3);
   const positions=shellMeshes[index].geometry.attributes.position,template=shellTemplates[index];
   for(let i=0;i<template.length;i++){const {unit,inner}=template[i],t=inner?thickness:0;positions.setXYZ(i,unit[0]*(rx-t),unit[1]*(ry-t),unit[2]*(rz-t));}
   positions.needsUpdate=true;shellMeshes[index].geometry.computeVertexNormals();shellMeshes[index].geometry.computeBoundingBox();shellMeshes[index].geometry.computeBoundingSphere();
   const handArrow=handArrows[index],jawArrow=jawArrows[index];handArrow.position.set(s.handX*scale,side*s.handY*scale,.14);handArrow.setDirection(new THREE.Vector3(0,-side,0));handArrow.visible=s.availableForceEach>0&&!s.cracked;handArrow.setLength(.25+s.availableForceEach*.012,.085,.055);
   jawArrow.position.set(s.nutX*scale,side*ry,rz+.1);jawArrow.setDirection(new THREE.Vector3(0,-side,0));jawArrow.visible=s.jawCompression>0;jawArrow.setLength(Math.min(ry*.8,.12+s.jawCompression*.002),.07,.045);
  }
  kernelMesh.scale.set(rx*.75,ry*.75,rz*.75);
  for(const {line,phase} of fractureLines){
   line.visible=s.cracked;const positions=line.geometry.attributes.position;
   for(let i=0;i<positions.count;i++){const theta=.15+(Math.PI-.3)*i/(positions.count-1),phi=phase+.12*Math.sin(i*1.7),p=shellPoint(theta,phi,false).unit;positions.setXYZ(i,p[0]*(rx+.001),p[1]*(ry+.001),p[2]*(rz+.001));}
   positions.needsUpdate=true;line.geometry.computeBoundingSphere();
  }
  const outcome=s.cracked?(s.jawWithdrawal===0?'The assumed shell-failure compression is reached. The crack marks appear and squeezing force is removed.':s.jawWithdrawal<1?'The cracked nut stays in place while the jaws are reopened for inspection.':s.shellRemoval===0?'The jaws are clear. The cracked shell is ready to separate for inspection.':s.shellRemoval<1?'The shell halves move apart manually to expose the kernel.':'The kernel is exposed. Jaw reopening and shell separation are manual inspection motions, not a prediction of automatic release.'):s.mode==='stall'?(s.compression>0?'Both handles stop where the required force reaches the available limit. The partly compressed shell remains uncracked.':'The available force cannot overcome the initial assumed shell resistance. The jaws stay seated without compression.'):'Both handles close while the rounded jaws compress the seated shell. Each hand supplies part of the deformation work.';
  return {state:s,readings:[
   reading('Outcome',outcome,'Each handle must supply enough torque throughout compression. Reaching the end of the trial does not itself crack the shell.'),
   reading('Shell condition',s.cracked?'Cracked':'Uncracked','Failure is assigned at 2 mm compression. The later opening of the jaws and shell represents manual inspection.'),
   reading('Shell compression',format(s.compression*1000)+' of 2 mm','Reduction in the full height between the two contacts. Inspect the jaw contact to see this small change at its real geometric scale.'),
   reading('Available force on each handle',format(s.availableForceEach)+' N','The same force limit applies to each hand. Extra unused capacity does not increase the prescribed closing speed or work.'),
   reading('Actual force on each handle',format(s.actualForceEach)+' N','Force currently supplied by each hand. It meets the moving load or reaches the available limit at a stall; it is removed after cracking.'),
   reading('Peak force needed on each handle',format(s.peakRequiredForceEach)+' N','Compare this with the available force. Starting the squeeze can require less force than finishing it.'),
   reading('Lever force ratio',format(s.mechanicalAdvantage)+':1','Hand distance divided by jaw distance. Each lever has this advantage; the two ratios are not multiplied.'),
   reading('Opposing jaw compression',format(s.jawCompression)+' N','Each jaw applies this magnitude in an opposite direction. A pair of 100 N forces means 100 N of compression through the nut, not 200 N.'),
   reading('Available jaw compression',format(s.availableJawCompression)+' N','Capacity from the hand-force limit times the lever ratio. Capacity can exceed the force currently needed.'),
   reading('Assumed resistance at attained compression',format(s.resistance)+' N','Loading curve: 20 N plus the selected rise per millimeter. After cracking this retains the former peak load for comparison, not an ongoing force.'),
   reading('Hinge reaction magnitude on each lever',format(s.hingeReactionEach)+' N','Jaw force minus hand force on that lever. The two hinge reactions oppose one another and vanish after the squeeze ends.'),
   reading('Each hand inward travel',format(s.handTravelEach*1000)+' mm','Vertical movement during the loaded squeeze. Each hand moves half the shell compression times the lever ratio. Later reopening is excluded.'),
   reading('Both hands inward travel',format(s.totalHandTravel*1000)+' mm','Sum of the two inward displacements. Both hands contribute to the work delivered to the shell.'),
   reading('Each hand arc length',format(s.handArcLengthEach*1000)+' mm','The hand follows this longer curved path. Only its vertical displacement contributes work under the modeled vertical force.'),
   reading('Input work from both hands',format(s.inputWork,3)+' J','Total loading work, equal to 20q + kq²/2 with q in meters. It is not necessarily recoverable energy; manual inspection is excluded.'),
   reading('Jaw gap',format(s.jawGap*1000)+' mm','Clear distance between the rounded contacts. During loading it equals nut diameter minus compression; it grows again during manual reopening.'),
   reading('Crack time',s.crackTime===null?'Force limit prevents cracking':format(s.crackTime,3)+' s','Predicted threshold time at the assumed 0.01 rad/s closing rate. Waiting longer cannot overcome an insufficient force limit.'),
   reading('Trial time',format(s.elapsed)+' s','An eight-second attempt including inspection after any successful crack. Reset or a preset restores the whole shell.'),
  ]};
 });
 const render=result.update;result.advance=dt=>{if(Number.isFinite(dt)&&dt>0)elapsed=Math.min(C.duration,elapsed+dt);return render();};result.animate=t=>{const dt=Number.isFinite(t)?Math.max(0,t-lastClock):0;if(Number.isFinite(t))lastClock=t;return result.advance(dt);};result.reset=()=>{elapsed=lastClock=0;return render(result.defaults);};
 result.actions=[['Inspect start (0%)',0],['Inspect quarter (25%)',.25],['Inspect three quarters (75%)',.75],['Inspect result (100%)',1]].map(([label,p])=>({label,part:'system',view:'front',replay:false,run(){elapsed=C.duration*p;return render();}}));
 result.actions.push({label:'Inspect jaw contact',part:'nut',view:'front',replay:false,run:()=>render()},{label:'Inspect whole nutcracker',part:'system',view:'front',replay:false,run:()=>render()});
 result.playback={label:'Squeeze the nutcracker',description:'Choose Inspect jaw contact, then Play to watch the shell and both contacts close up. Inspect whole nutcracker restores the wider view at the same trial time. Each handle attempts to close at 0.01 radians per second, subject to its own available force. Weak squeezing stalls. After shell failure, the jaws reopen and the shell halves are separated for manual inspection.',stepLabel:'Advance the nutcracker by one percent of the trial',advance:result.advance,step:()=>result.advance(C.duration/100),complete:()=>elapsed>=C.duration,blocked:()=>false};
 result.resultPart={id:'kernel',label:'Inspect the exposed kernel',view:'front',focusOnComplete:false,available:()=>result.getState().shellRemoval===1};
 result.frameBoundsForPart=id=>{if(id==='nut'){root.updateMatrixWorld(true);const bounds=new THREE.Box3();for(const object of [nut,jaws])bounds.union(new THREE.Box3().setFromObject(object));return bounds;}if(!['system','handles','jaws','hinge'].includes(id))return null;const s=result.getState(),maximumAngle=s.initialAngle+C.inspectionOpening,y=s.arm*scale*Math.sin(maximumAngle)+.25,z=s.diameter*scale*.9+.4;root.updateWorldMatrix(true,false);return new THREE.Box3(new THREE.Vector3(-.23,-y,-z),new THREE.Vector3(s.arm*scale+.2,y,z)).applyMatrix4(root.matrixWorld);};
 root.rotation.set(.12,-.3,0);result.initialPart='system';result.initialView='front';result.frameVisibleOnly=true;result.framePadding=.5;result.autoFramePart='system';result.selectionOutline=false;result.transparentBackground=true;
 result.parts.find(p=>p.id==='nut').framePadding=.72;result.catalogParts=result.parts.filter(p=>['hinge','handles','jaws','shell','kernel'].includes(p.id));
 result.topology={forceGuide,system,hinge,pin,pinCaps,bearings,handles,upperLever,lowerLever,levers,jaws,bosses,nut,shell,shellHalves,shellMeshes,shellTemplates,kernel,kernelMesh,fractureLines,handArrows,jawArrows,scale,latitudes,longitudes};
 const dispose=result.dispose;result.dispose=()=>{if(!disposed){disposed=true;dispose();}};return result;
}

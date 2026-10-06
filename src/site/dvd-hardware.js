import * as THREE from 'three';
import {fillLine,lineObject,surface,textLabel} from './scene-kit.js';
import {PLAYER_MM,DRIVE,playerAnnulus,playerBearing} from './blu-ray-player-model.js';
import {dvdVideoRgba,DVD_VIDEO_WIDTH,DVD_VIDEO_HEIGHT} from './dvd-video.js';
const GOLD=0xbd8b38,GLASS=0xaac5c9,FAINT=0x93a087;
const mm=(x,y,z)=>[x*PLAYER_MM,y*PLAYER_MM,z*PLAYER_MM];

export function createDvdHardware(kit) {
  const {part}=kit,D=DRIVE;
  const box=(parent,color,x0,x1,y0,y1,z0,z1)=>{const o=surface(kit,new THREE.BoxGeometry((x1-x0)*PLAYER_MM,(y1-y0)*PLAYER_MM,(z1-z0)*PLAYER_MM),color,parent);o.position.set(...mm((x0+x1)/2,(y0+y1)/2,(z0+z1)/2));return o;};
  const cylinder=(parent,color,radius,height,x,y,z)=>{const o=surface(kit,new THREE.CylinderGeometry(radius*PLAYER_MM,radius*PLAYER_MM,height*PLAYER_MM,48),color,parent);o.position.set(...mm(x,y,z));return o;};
  const bearing=(parent,inner,outer,length,x,y,z)=>{const o=surface(kit,playerBearing(inner,outer,length),'metal',parent);o.position.set(...mm(x,y,z));return o;};
  const rod=(parent,a,b,radius,color='metal')=>kit.rod(mm(...a),mm(...b),radius*PLAYER_MM,color,parent);
  const system=part('system','DVD player and video display','A connected DVD player retrieves compressed video bytes and decodes pictures for its screen. Look inside removes the case and half-disc cutaway. The 120 mm disc has its nominal dimensions; the surrounding mechanism is an illustrative layout.');
  const player=part('player','Complete disc player','The spindle carries the disc. A lead screw moves the pickup along two rails; small lens actuators maintain focus and tracking in real drives. The pickup advances outward by the calculated spiral distance during this encoded excerpt. Fine focus and tracking servos and disc loading are not simulated.',[0,0,0],system);
  const chassis=part('chassis','Chassis and case','The base supports the spindle, rail bearings, carriage motor and circuit board. Look inside removes the lid, front wall and front half of the disc. This is an illustrative layout rather than a specific commercial player.',[0,0,0],player);
  const floor=box(chassis,'cream',-68,100,-26,-24,-68,68);
  const back=box(chassis,'cream',-68,100,-24,18,-68,-66),left=box(chassis,'cream',-68,-66,-24,18,-66,66),right=box(chassis,'cream',98,100,-24,18,-66,66);
  const front=box(chassis,'cream',-68,100,-24,18,66,68),lid=box(chassis,'cream',-68,100,18,20,-68,68);
  const frontSlot=box(chassis,'ink',-59,65,-6,-3,68,68.7);
  for(const x of [-54,86])for(const z of [-54,54])cylinder(chassis,'ink',6,4,x,-28,z);

  const spindle=part('spindle','Spindle motor and hub','The motor shaft and hub support and center the disc. At constant linear velocity the same track speed requires more revolutions per minute near the center.',[0,0,0],player);
  const motor=cylinder(spindle,'ink',10,16,0,-16,0),shaft=cylinder(spindle,'metal',2,16,0,0,0),hub=cylinder(spindle,'metal',15,4,0,10,0);
  const center=cylinder(spindle,'metal',7.5,1.2,0,12.6,0);
  const rotorMark=box(spindle,'gold',-1,1,11.9,12,-14,-9);
  const disc=part('disc','Disc and retaining clamp','A 120 mm disc with a 15 mm center hole and a nominal 1.2 mm total thickness. A separate top clamp holds it against the hub. The coarse rings indicate the recorded zone. Inspect the spiral to follow outward tracking; individual 0.74 micrometer turns are too small to resolve at this scale.',[0,0,0],player);
  // Keep the cutaway fixed in the case while surface markings turn. Otherwise a
  // rotating missing sector repeatedly hides the pickup it is meant to reveal.
  const discBack=surface(kit,playerAnnulus(7.5,60,1.2,0,Math.PI),'metal',disc);discBack.position.y=.12;
  const discFront=surface(kit,playerAnnulus(7.5,60,1.2,Math.PI,Math.PI),'metal',disc);discFront.position.y=.12;
  const clamp=cylinder(disc,'ink',15,1.8,0,14.1,0);
  const cap=cylinder(disc,'metal',6,2,0,16,0);
  const clampMark=box(disc,'gold',-1,1,17,17.15,2,5);
  const rings=[];
  for(let radius=24;radius<=58;radius+=5){const line=lineObject(97,FAINT,disc);fillLine(line,Array.from({length:97},(_,i)=>mm(radius*Math.cos(Math.PI*i/96),13.22,-radius*Math.sin(Math.PI*i/96))));rings.push(line);}

  const traverse=part('traverse','Rails and carriage drive','Two rails pass through four hollow pickup bearings. The lower screw passes through a threaded nut fixed to the sled. Its motor and both end bearings share the base. Screw pitch is an illustrative 2 mm per turn.',[0,0,0],player);
  const rails=[],railSupports=[];
  for(const z of [-D.railZ,D.railZ]){
    rails.push(rod(traverse,[D.railStart,D.railY,z],[D.railEnd,D.railY,z],D.railRadius));
    for(const x of [17,73]){
      const b=bearing(traverse,2,3.5,2,x,D.railY,z);railSupports.push(b);
      box(traverse,'metal',x-1,x+1,-24,-11.5,z-3.5,z+3.5);
    }
  }
  const screw=new THREE.Group();screw.position.set(...mm(0,D.screwY,0));traverse.add(screw);
  const core=rod(screw,[D.screwStart,0,0],[D.screwEnd,0,0],1.2,'gold');
  const helixPoints=Array.from({length:961},(_,i)=>{const x=D.screwStart+(D.screwEnd-D.screwStart)*i/960,a=2*Math.PI*(x-D.screwStart)/2;return mm(x,1.2*Math.cos(a),1.2*Math.sin(a));});
  const thread=kit.tube(helixPoints,.003,'gold',screw);
  const screwSupports=[15,73].map(x=>{const o=bearing(traverse,1.5,3,2,x,D.screwY,0);box(traverse,'metal',x-1,x+1,-24,-18,-3,3);return o;});
  const carriageMotor=cylinder(traverse,'ink',5,12,84,-15,0);carriageMotor.rotation.z=Math.PI/2;
  box(traverse,'metal',81,87,-24,-20,-5,5);const coupling=rod(traverse,[74,-15,0],[78,-15,0],1.5);

  const pickup=part('pickup','Sliding optical pickup','The sled rides on rail bearings and is carried by the screw nut. It holds the laser, collimator, beam splitter, quarter-wave plate, fold mirror, objective and photodetector. Beam widths and component sizes are enlarged for teaching.',[.25,0,0],player);
  const sled=box(pickup,'clay',-10,10,-8,-4,-10.5,10.5);
  const bearings=[];for(const x of [-5,5])for(const z of [-12,12])bearings.push(bearing(pickup,2,3,4,x,-8,z));
  const nut=bearing(pickup,1.5,3,6,0,-15,0);nut.material=nut.material.clone();nut.material.color.set(0xc39446);
  box(pickup,'metal',-3,3,-12,-8,-3,3);
  const opticalBase=box(pickup,'metal',-9,8,-4,-3,-5,9);
  const laser=part('laser','Laser and collimator','A 650 nm red laser and collimator feed the pickup. The beam is drawn in a visible false color. Turning the laser off prevents transition detection and video recovery.',[0,0,0],pickup);
  const laserBody=cylinder(laser,'ink',1.5,3,-7,-1,0);laserBody.rotation.z=Math.PI/2;
  box(laser,'metal',-8.5,-5.5,-3,-2.5,-1.5,1.5);
  const collimator=cylinder(laser,GLASS,1.3,.5,-4.8,-1,0);collimator.rotation.z=Math.PI/2;
  box(laser,'metal',-5.05,-4.55,-3,-2.3,-1.3,1.3);
  const splitter=box(pickup,GLASS,-3.8,-2.2,-1.8,-.2,-.8,.8);
  box(pickup,'metal',-3.8,-2.2,-3,-1.8,-.8,.8);
  const splitterFace=box(pickup,'metal',-.06,.06,-.7,.7,-.7,.7);splitterFace.position.set(...mm(-3,-1,0));splitterFace.rotation.y=-Math.PI/4;
  const plate=box(pickup,'blue',-1.8,-1.6,-2.3,.3,-1.3,1.3);box(pickup,'metal',-1.8,-1.6,-3,-2.3,-1.3,1.3);
  const fold=box(pickup,'metal',-.08,.08,-1.1,1.1,-1,1);fold.position.set(...mm(0,-1,0));fold.rotation.z=-Math.PI/4;
  const foldSupport=box(pickup,'metal',-.8,.8,-3,-1-(1.1+.08)/Math.sqrt(2),-1,1);
  const objective=part('objective','Objective lens and actuator','The objective focuses through the transparent cover onto the reflective data layer. Real focus and tracking actuators move it minutely. Their control loop is represented by the holder and suspension, not numerically simulated.',[0,0,0],pickup);
  const objectiveGlass=cylinder(objective,GLASS,2.2,1.2,0,7.4,0);
  const lensHolder=surface(kit,playerAnnulus(2.2,3.2,1.2),'ink',objective);lensHolder.position.y=.068;
  const lensPosts=[];for(const z of [-3.4,3.4]){lensPosts.push(rod(objective,[-2,-3,z],[-2,7,z],.4));rod(objective,[-2,7,z],[0,7,z>0?3.2:-3.2],.3);}
  const detector=part('detector','Photodetector','Returned light is sent from the splitter toward four photodiode segments. Their currents are summed for the read signal. Both pits and lands reflect light; the spatial phase pattern changes the collected signal. Analog amplification, equalization, timing recovery and focus-error optics are outside this model.',[0,0,0],pickup);
  const detectorBody=box(detector,'ink',-4.5,-1.5,-2.5,.5,6,7.5);box(detector,'metal',-4.5,-1.5,-3,-2.5,6,7.5);
  const detectorFace=box(detector,'ink',-4,-2,-2,0,5.95,6);
  const detectorSegments=[];
  for(const x of [-3.52,-2.48])for(const y of [-1.52,-.48])detectorSegments.push(box(detector,'gold',x-.46,x+.46,y-.46,y+.46,5.94,5.95));
  const outgoing=lineObject(4,0x995246,pickup),returning=lineObject(4,GOLD,pickup);
  fillLine(outgoing,[mm(-5.5,-1,0),mm(0,-1,0),mm(0,7.4,0),mm(0,12,0)]);
  fillLine(returning,[mm(.12,12,.12),mm(.12,-.88,.12),mm(-3,-.88,.12),mm(-3,-.88,6)]);
  const lightDots=[kit.sphere(.008,mm(0,0,0),'gold',pickup),kit.sphere(.008,mm(0,0,0),'gold',pickup)];

  const electronics=part('electronics','Decoder board and connections','The pickup sends an electrical signal through a flexible cable. The board reverses EFMplus, deinterleaves sectors, repairs known erasures with PI/PO parity and checks each sector. A buffer supplies recovered MPEG-2 bytes to the video decoder. Analog signal conditioning, clock recovery and the monitor cable protocol are outside the simulation.',[0,0,0],player);
  const board=box(electronics,'leaf',77,96,-22,-20,-50,50);
  const chips=[-32,28].map(z=>box(electronics,'ink',82,92,-20,-16,z-7,z+7));
  for(const x of [80,93])for(const z of [-46,46])cylinder(electronics,'metal',1.5,2,x,-23,z);
  const flex=surface(kit,new THREE.BufferGeometry(),'gold',electronics,true);
  const motorCable=kit.tube([mm(88,-21,-18),mm(70,-23,-18),mm(10,-23,-18),mm(0,-23,-8)],.004,'clay',electronics);
  const feedCable=kit.tube([mm(89,-21,14),mm(93,-21,14),mm(93,-16,4),mm(90,-15,0)],.004,'clay',electronics);
  const outputCable=kit.tube([mm(87,-20,-47),mm(87,-19,-58),mm(87,-14,-66)],.008,'ink',electronics);
  const output=box(chassis,'ink',82,92,-17,-11,-69,-66);
  const status=kit.sphere(.018,mm(83,-8,68.8),'leaf',chassis);status.material=status.material.clone();
  const decoder=box(electronics,'ink',82,92,-20,-16,-6,6),quartz=cylinder(electronics,'metal',2,6,94,-17,0);
  const boardLabels=[['EFM+',-32],['PI/PO',28],['MPEG',0]].map(([text,z])=>{
    const label=textLabel(electronics,text,{width:.09,height:.033,position:mm(87,-15.7,z),color:'#fbf6e9'});label.rotation.x=-Math.PI/2;return label;
  });
  const traces=[kit.tube([mm(87,-19,-25),mm(80,-19,-25),mm(80,-19,21),mm(87,-19,21)],.002,'gold',electronics),
    kit.tube([mm(87,-19,21),mm(94,-19,21),mm(94,-19,0),mm(92,-19,0)],.002,'gold',electronics),
    kit.tube([mm(87,-19,-6),mm(87,-19,-18),mm(95,-19,-18),mm(95,-19,-47),mm(87,-19,-47)],.002,'gold',electronics)];
  const outputs=part('outputs','Recovered video display','The display receives decoded 720 by 576 pictures, shown at a 4:3 display aspect ratio and 25 frames per second. Only recovered MPEG-2 bytes supply its pixels. This model uses independently coded flat-block pictures and no audio.',[0,0,0],player);
  const monitor=part('monitor','Monitor and stand','A supported display is connected to the decoder board. Missing compressed bytes produce a blank, labeled picture rather than substituted source imagery.',[.12,.73,-1.35],outputs);
  const monitorBody=kit.box([1.60,1.20,.18],[0,0,0],'ink',monitor);
  const frame=kit.box([1.51,1.11,.025],[0,0,.101],'metal',monitor);
  const blankPixels=new Uint8Array(DVD_VIDEO_WIDTH*DVD_VIDEO_HEIGHT*4);for(let i=0;i<blankPixels.length;i+=4)blankPixels.set([17,27,38,255],i);
  const videoTexture=new THREE.DataTexture(blankPixels.slice(),DVD_VIDEO_WIDTH,DVD_VIDEO_HEIGHT,THREE.RGBAFormat);videoTexture.flipY=true;videoTexture.colorSpace=THREE.SRGBColorSpace;videoTexture.magFilter=THREE.NearestFilter;videoTexture.minFilter=THREE.NearestFilter;videoTexture.needsUpdate=true;
  const screen=new THREE.Mesh(new THREE.PlaneGeometry(1.40,1.05),new THREE.MeshBasicMaterial({map:videoTexture}));screen.position.z=.118;monitor.add(screen);
  const neck=kit.box([.16,.40,.13],[0,-.80,0],'metal',monitor),foot=kit.box([.62,.04,.42],[0,-1.01,.03],'ink',monitor);
  const connector=kit.box([.10,.055,.025],[.35,-.46,-.102],'gold',monitor);
  const screenLabel=textLabel(monitor,'WAITING FOR DVD DATA',{width:1.35,height:.09,position:[0,-.655,.12]});
  const displayCable=kit.tube([mm(87,-14,-69),[.87,-.20,-1.65],[.47,-.20,-1.65],[.47,.27,-1.452]],.009,'ink',outputs);
  const buffer=box(electronics,'ink',82,92,-20,-16,9,17);
  const bufferLabel=textLabel(electronics,'BUFFER',{width:.095,height:.029,position:mm(87,-15.7,13),color:'#fbf6e9'});bufferLabel.rotation.x=-Math.PI/2;
  for(const cable of [flex,motorCable,feedCable,outputCable])player.add(cable);
  monitor.userData.explosionCategory=true;monitor.userData.explosionRigid=true;
  for(const group of [chassis,spindle,disc,traverse,pickup,electronics]){group.userData.explosionCategory=true;group.userData.explosionRigid=true;}
  for(const object of [...rings,outgoing,returning,...lightDots,flex,motorCable,feedCable,outputCable])object.userData.explosionExcluded=true;
  for(const object of [displayCable,...traces,...boardLabels,bufferLabel])object.userData.explosionExcluded=true;
  flex.geometry.setAttribute('position',new THREE.BufferAttribute(new Float32Array(24),3));flex.geometry.setIndex([0,1,2,1,3,2,2,3,4,3,5,4,4,5,6,5,7,6]);
  return {system,player,chassis,floor,back,left,right,front,lid,frontSlot,spindle,motor,shaft,hub,center,rotorMark,disc,discBack,discFront,clamp,cap,clampMark,rings,traverse,rails,railSupports,screw,core,thread,screwSupports,carriageMotor,coupling,pickup,sled,bearings,nut,opticalBase,laser,laserBody,collimator,splitter,splitterFace,plate,fold,foldSupport,objective,objectiveGlass,lensHolder,lensPosts,detector,detectorBody,detectorFace,outgoing,returning,lightDots,electronics,board,chips,flex,motorCable,feedCable,outputCable,output,status,decoder,quartz,boardLabels,traces,outputs,monitor,monitorBody,frame,videoTexture,screen,neck,foot,connector,screenLabel,displayCable,buffer,bufferLabel,blankPixels,videoKey:null};
}

export function updateDvdHardware(p,s){
  p.pickup.position.x=s.spiral.radiusMm*PLAYER_MM;p.screw.rotation.x=(s.spiral.radiusMm-24)/2*2*Math.PI;
  const angle=-s.spiral.angle;
  p.clampMark.position.set(...mm(3.5*Math.sin(angle),17.075,3.5*Math.cos(angle)));p.clampMark.rotation.y=angle;
  p.rotorMark.position.set(...mm(-11.5*Math.sin(angle),11.95,-11.5*Math.cos(angle)));p.rotorMark.rotation.y=angle;
  const lit=!!s.values.laser&&s.reading;
  fillLine(p.outgoing,[mm(-5.5,-1,0),mm(0,-1,0),mm(0,7.4,0),mm(0,12.6,0)]);
  fillLine(p.returning,[mm(.12,12.6,.12),mm(.12,-.88,.12),mm(-3,-.88,.12),mm(-3,-.88,6)]);
  p.outgoing.visible=p.returning.visible=lit;
  const paths=[[[0,-1,0],[0,12.6,0]],[[0,12.6,.12],[0,-.88,.12],[-3,-.88,.12],[-3,-.88,6]]];
  p.lightDots.forEach((dot,index)=>{
    dot.visible=lit&&s.time>0;const points=paths[index].map(a=>new THREE.Vector3(...mm(...a))),lengths=points.slice(1).map((a,i)=>a.distanceTo(points[i])),total=lengths.reduce((a,b)=>a+b,0);
    let at=((s.time*.8+index*.35)%1)*total,j=0;while(j<lengths.length-1&&at>lengths[j])at-=lengths[j++];dot.position.copy(points[j]).lerp(points[j+1],at/lengths[j]);
  });
  const cable=[[s.spiral.radiusMm+6,-4,9],[s.spiral.radiusMm+6,-2,14],[72,-18,28],[77,-20,18]],vertices=p.flex.geometry.attributes.position.array;
  cable.forEach(([x,y,z],i)=>vertices.set([...mm(x-2,y,z),...mm(x+2,y,z)],i*6));p.flex.geometry.attributes.position.needsUpdate=true;p.flex.geometry.computeVertexNormals();p.flex.geometry.computeBoundingSphere();
  p.status.material.color.set(!s.values.laser?0xc14f39:s.complete?0xc39446:0x91aa7e);
  const key=`${s.values.content}:${s.values.loss}:${s.values.laser}:${s.displaying}:${s.frameIndex}:${!!s.picture}`;
  if(p.videoKey!==key){
    p.videoKey=key;
    const pixels=dvdVideoRgba(s.picture);
    p.videoTexture.image.data.set(pixels??p.blankPixels);p.videoTexture.needsUpdate=true;
  }
  p.screenLabel.userData.setText(!s.values.laser?'LASER OFF':!s.displaying?'READING DVD DATA':s.picture?`DECODED FRAME ${s.frameIndex+1} / 50`:`FRAME ${s.frameIndex+1} UNAVAILABLE`);
}

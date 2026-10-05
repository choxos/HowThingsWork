import * as THREE from 'three';
import {houseModel, reading as r} from './house-model-kit.js';
import {fillLine, lineObject, segmentLines, solidArrow, surface, textLabel} from './scene-kit.js';
import {fixed} from './format.js';
import {DISC_FORMATS, PLAYER, PLAYER_DEFAULTS, PLAYER_DOMAINS, playerPlan, playerAt, playerRpm, playerInterference} from './blu-ray-player-physics.js';

export const PLAYER_MM = .01;
export const DRIVE = Object.freeze({floor: -24, discBottom: 12, railY: -8, railZ: 12, railRadius: 2, railStart: 16, railEnd: 74, screwY: -15, screwRadius: 1.5, screwStart: 14, screwEnd: 74, bearingOffset: 5, bearingLength: 4});
const INK=0x394233, GOLD=0xbd8b38, GLASS=0xaac5c9, FAINT=0x93a087;
const mm=(x,y,z)=>[x*PLAYER_MM,y*PLAYER_MM,z*PLAYER_MM];
const replace=(mesh,geometry)=>{mesh.geometry.dispose();mesh.geometry=geometry;};

/** An annular solid with proper end faces, including a half-disc cutaway. */
export function playerAnnulus(inner,outer,height,start=0,length=2*Math.PI) {
  const shape=new THREE.Shape();
  if(length>=2*Math.PI-1e-8){
    shape.absarc(0,0,outer,0,2*Math.PI,false);
    if(inner>0){const hole=new THREE.Path();hole.absarc(0,0,inner,0,2*Math.PI,true);shape.holes.push(hole);}
  }else{
    shape.moveTo(outer*Math.cos(start),outer*Math.sin(start));shape.absarc(0,0,outer,start,start+length,false);
    shape.lineTo(inner*Math.cos(start+length),inner*Math.sin(start+length));shape.absarc(0,0,inner,start+length,start,true);shape.closePath();
  }
  const geometry=new THREE.ExtrudeGeometry(shape,{depth:height,bevelEnabled:false,curveSegments:96});
  geometry.rotateX(-Math.PI/2);geometry.scale(PLAYER_MM,PLAYER_MM,PLAYER_MM);return geometry;
}

/** A bearing whose bore, not a solid block, receives a shaft parallel to x. */
export function playerBearing(inner,outer,length) {
  const geometry=playerAnnulus(inner,outer,length);geometry.translate(0,-length*PLAYER_MM/2,0);geometry.rotateZ(-Math.PI/2);return geometry;
}

function physicalPlayer(kit) {
  const {part}=kit,D=DRIVE;
  const box=(parent,color,x0,x1,y0,y1,z0,z1)=>{const o=surface(kit,new THREE.BoxGeometry((x1-x0)*PLAYER_MM,(y1-y0)*PLAYER_MM,(z1-z0)*PLAYER_MM),color,parent);o.position.set(...mm((x0+x1)/2,(y0+y1)/2,(z0+z1)/2));return o;};
  const cylinder=(parent,color,radius,height,x,y,z)=>{const o=surface(kit,new THREE.CylinderGeometry(radius*PLAYER_MM,radius*PLAYER_MM,height*PLAYER_MM,48),color,parent);o.position.set(...mm(x,y,z));return o;};
  const bearing=(parent,inner,outer,length,x,y,z)=>{const o=surface(kit,playerBearing(inner,outer,length),'metal',parent);o.position.set(...mm(x,y,z));return o;};
  const rod=(parent,a,b,radius,color='metal')=>kit.rod(mm(...a),mm(...b),radius*PLAYER_MM,color,parent);
  const system=part('system','Blu-ray player','A connected optical-disc player with a spindle, guided pickup and decoder board. The surrounding case and half the disc can be removed to expose the light path. Dimensions of the mechanism are illustrative; the disc diameter, thickness and optical format references are identified separately.');
  const player=part('player','Complete disc player','The spindle carries the disc. A lead screw moves the pickup along two rails; small lens actuators maintain focus and tracking in real drives. This model holds the selected radius while reading a short example. Fine servo motion, loading and signal processing are explained but not simulated.',[0,0,0],system);
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
  const disc=part('disc','Disc and retaining clamp','A 120 mm disc with a 15 mm center hole and a nominal 1.2 mm total thickness. A separate top clamp holds it against the hub. The coarse rings indicate the recorded zone, not actual individual tracks.',[0,0,0],player);
  // Keep the cutaway fixed in the case while surface markings turn. Otherwise a
  // rotating missing sector repeatedly hides the pickup it is meant to reveal.
  const discBack=surface(kit,playerAnnulus(7.5,60,1.2,0,Math.PI),'metal',disc);discBack.position.y=.12;
  const discFront=surface(kit,playerAnnulus(7.5,60,1.2,Math.PI,Math.PI),'metal',disc);discFront.position.y=.12;
  const clamp=cylinder(disc,'ink',15,1.8,0,14.1,0);
  const cap=cylinder(disc,'metal',6,2,0,16,0);
  const clampMark=box(disc,'gold',-1,1,17,17.15,2,5);
  const rings=[];
  for(let radius=25;radius<=58;radius+=5){const line=lineObject(97,FAINT,disc);fillLine(line,Array.from({length:97},(_,i)=>mm(radius*Math.cos(Math.PI*i/96),13.22,-radius*Math.sin(Math.PI*i/96))));rings.push(line);}

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
  const helixPoints=Array.from({length:961},(_,i)=>{const x=D.screwStart+(D.screwEnd-D.screwStart)*i/960,a=2*Math.PI*(x-D.screwStart)/PLAYER.screwPitch;return mm(x,1.2*Math.cos(a),1.2*Math.sin(a));});
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
  const laser=part('laser','Laser and collimator','A compatible player selects a laser and corrected optics for each format: near-infrared for CD, red for DVD and violet for Blu-ray. The infrared beam is shown in a visible false color. This is a simplified selectable source, not one laser changing wavelength.',[0,0,0],pickup);
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
  const detector=part('detector','Photodetector','Returned light is sent from the splitter toward this detector. Both pits and lands reflect light; the spatial phase pattern changes the collected signal. Amplification, equalization and timing recovery precede channel decoding.',[0,0,0],pickup);
  const detectorBody=box(detector,'ink',-4.5,-1.5,-2.5,.5,6,7.5);box(detector,'metal',-4.5,-1.5,-3,-2.5,6,7.5);
  const detectorFace=box(detector,'gold',-4,-2,-2,0,5.95,6);
  const outgoing=lineObject(4,DISC_FORMATS[2].color,pickup),returning=lineObject(4,GOLD,pickup);
  fillLine(outgoing,[mm(-5.5,-1,0),mm(0,-1,0),mm(0,7.4,0),mm(0,12,0)]);
  fillLine(returning,[mm(.12,12,.12),mm(.12,-.88,.12),mm(-3,-.88,.12),mm(-3,-.88,6)]);
  const lightDots=[kit.sphere(.008,mm(0,0,0),'gold',pickup),kit.sphere(.008,mm(0,0,0),'gold',pickup)];

  const electronics=part('electronics','Decoder board and connections','The pickup sends an electrical signal through a flexible cable. Real circuits recover channel timing, decode the modulation, correct errors and interpret stored content. This lesson displays an ideal channel sample, not a movie decoded from actual media.',[0,0,0],player);
  const board=box(electronics,'leaf',77,96,-22,-20,-50,50);
  const chips=[-32,28].map(z=>box(electronics,'ink',82,92,-20,-16,z-7,z+7));
  for(const x of [80,93])for(const z of [-46,46])cylinder(electronics,'metal',1.5,2,x,-23,z);
  const flex=surface(kit,new THREE.BufferGeometry(),'gold',electronics,true);
  const motorCable=kit.tube([mm(88,-21,-18),mm(70,-23,-18),mm(10,-23,-18),mm(0,-23,-8)],.004,'clay',electronics);
  const feedCable=kit.tube([mm(89,-21,14),mm(93,-21,14),mm(93,-16,4),mm(90,-15,0)],.004,'clay',electronics);
  const outputCable=kit.tube([mm(87,-20,-47),mm(87,-19,-58),mm(87,-14,-66)],.008,'ink',electronics);
  const output=box(chassis,'ink',82,92,-17,-11,-69,-66);
  const status=kit.sphere(.018,mm(83,-8,68.8),'leaf',chassis);status.material=status.material.clone();
  for(const group of [chassis,spindle,disc,traverse,pickup,electronics]){group.userData.explosionCategory=true;group.userData.explosionRigid=true;}
  for(const object of [...rings,outgoing,returning,...lightDots,flex,motorCable,feedCable,outputCable])object.userData.explosionExcluded=true;
  return {system,player,chassis,floor,back,left,right,front,lid,frontSlot,spindle,motor,shaft,hub,center,rotorMark,disc,discBack,discFront,clamp,cap,clampMark,rings,traverse,rails,railSupports,screw,core,thread,screwSupports,carriageMotor,coupling,pickup,sled,bearings,nut,opticalBase,laser,laserBody,collimator,splitter,splitterFace,plate,fold,foldSupport,objective,objectiveGlass,lensHolder,lensPosts,detector,detectorBody,detectorFace,outgoing,returning,lightDots,electronics,board,chips,flex,motorCable,feedCable,outputCable,output,status};
}

function playerDetails(kit,system) {
  const make=(id,name,description)=>{const group=kit.part(id,name,description,[3,0,0],system);group.userData.inspectionOnly=id;group.userData.explosionExcluded=true;return group;};
  const label=(parent,text,x,y,height=.17,width=2.8)=>textLabel(parent,text,{height:Math.max(.23,height),width,position:[x,y,.08]});
  const box=(parent,color,width,height,x,y,depth=.06)=>{const o=surface(kit,new THREE.BoxGeometry(width,height,depth),color,parent);o.position.set(x,y,0);return o;};
  const arrow=(parent,color,a,b)=>{const o=solidArrow(kit,color,parent,.009);o.position.set(...a);const v=new THREE.Vector3(...b).sub(new THREE.Vector3(...a));o.userData.setDirection(v);o.userData.setLength(v.length());return o;};
  const optics=make('optics','Optical path, enlarged','An unfolded path diagram. The polarizing splitter passes outgoing light; the quarter-wave plate changes its polarization on the round trip so returning light can be routed to the detector. The physical pickup also uses a fold mirror. Arrows are offset for readability; component spacing and beam width are illustrative.');
  label(optics,'From laser to detector',0,1.4,.20);
  const opticalLaser=box(optics,'ink',.18,.18,0,-.98),collimator=box(optics,GLASS,.28,.055,0,-.66),splitter=box(optics,GLASS,.21,.21,0,-.32),quarter=box(optics,'blue',.28,.045,0,.03),objective=box(optics,GLASS,.5,.08,0,.38),data=box(optics,'metal',.85,.065,0,.92),detector=box(optics,'ink',.16,.23,.85,-.32);
  const separator=lineObject(2,INK,optics);fillLine(separator,[[-.105,-.215,.04],[.105,-.425,.04]]);
  const outward=lineObject(2,DISC_FORMATS[2].color,optics),returned=lineObject(3,GOLD,optics);
  fillLine(outward,[[0,-.89,.06],[0,.888,.06]]);fillLine(returned,[[.03,.888,.065],[.03,-.30,.065],[.77,-.30,.065]]);
  const arrows=[arrow(optics,DISC_FORMATS[2].color,[-.03,-.58,.07],[-.03,-.12,.07]),arrow(optics,DISC_FORMATS[2].color,[-.03,.1,.07],[-.03,.78,.07]),arrow(optics,GOLD,[.04,.81,.075],[.04,.15,.075]),arrow(optics,GOLD,[.21,-.30,.075],[.69,-.30,.075])];
  label(optics,'Laser',0,-1.19,.18,1);
  label(optics,'Collimator',-.81,-.66,.23,1.12);label(optics,'Splitter',.48,-.60,.23,.9);
  label(optics,'Quarter-wave',-.92,.11,.23,1.35);label(optics,'plate',-.92,-.09,.23,1.35);label(optics,'Objective lens',-.94,.41,.23,1.40);
  label(optics,'Reflective data layer',0,1.12,.16,2.3);label(optics,'Detector',.85,-.10,.16,1);
  const opticalNote=label(optics,'Violet out · gold return',0,-1.48,.16,2.9);

  const track=make('track','Track and channel clock, enlarged','A one-dimensional pit profile with exaggerated height. Each marked clock interval is one channel cell; a transition is a channel 1, no transition is a channel 0. The example obeys ordinary run-length limits but is not an encoded sector, sync pattern or payload decoder. The scalar spot-diameter bar is a separate optical size reference, not a detector-contrast model.');
  const trackTitle=label(track,'',0,1.25,.20),trackScale=label(track,'',0,1.01,.16);
  const profile=lineObject(64,INK,track),clockTicks=segmentLines(16,FAINT,track),cursor=segmentLines(1,GOLD,track);
  label(track,'Pit',-1.48,.79,.23,.43);label(track,'Land',-1.48,.52,.23,.43);
  fillLine(cursor,[[-.48,.10,.09],[-.48,.88,.09]]);
  const bitLabels=Array.from({length:12},()=>label(track,'',0,.19,.23,.24));
  const trackAnswer=label(track,'',0,-.12,.17),trackHint=label(track,'Profile height exaggerated',0,-.38,.15);
  const spotBar=segmentLines(3,DISC_FORMATS[2].color,track),pitchBar=segmentLines(3,GOLD,track);
  const spotNote=label(track,'',0,-.89,.16),pitchNote=label(track,'',0,-1.38,.16);
  label(track,'Not a detector-signal prediction',0,-1.66,.23,3.1);

  const layers=make('layers','Disc layers and focus, enlarged','A uniformly enlarged cross-section through a nominal 1.2 mm pressed disc. The beam enters from below and focuses at the reflector. Its cone uses the selected numerical aperture and a stated illustrative refractive index of 1.55. Real high-NA field and aberration calculations are outside this model.');
  const cover=box(layers,GLASS,1.35,1,0,.5),backing=box(layers,'cream',1.35,1,0,1),reflector=box(layers,'metal',1.35,.008,0,.1);
  const cone=segmentLines(4,DISC_FORMATS[2].color,layers),axis=lineObject(2,GOLD,layers);
  const layerTitle=label(layers,'',0,1.63,.25),coverLabel=label(layers,'',0,-.85,.23),backingLabel=label(layers,'',0,-1.12,.23);
  label(layers,'Light enters from below',0,-.59,.23);label(layers,'1.2 mm total · 100× size',0,1.36,.23);
  label(layers,'Ray overlay · reference n = 1.55',0,-1.41,.23,3.1);

  const phase=make('phase','Two-wave interference demonstration','Two equal coherent waves are combined at one point. The bottom trace is their average field; the bar shows its time-averaged intensity relative to the in-phase maximum. This independent demonstration explains cancellation. It does not predict a real disc photodetector signal or prescribe pit depth.');
  const phaseTitle=label(phase,'Two equal waves',0,1.37,.20),phaseNote=label(phase,'',0,1.1,.16);
  const waves=[lineObject(193,DISC_FORMATS[2].color,phase),lineObject(193,GOLD,phase),lineObject(193,INK,phase)];
  for(const [i,name] of ['Field A','Field B','Average field'].entries())label(phase,name,0,[.90,.32,-.22][i],.23);
  const waveZeros=segmentLines(3,FAINT,phase);fillLine(waveZeros,[.59,.05,-.49].flatMap(y=>[[-1.2,y,0],[1.2,y,0]]));
  const intensityFrame=box(phase,'metal',2.4,.12,0,-.95),intensityBar=box(phase,'gold',2.4,.12,0,-.95);intensityBar.position.z=.04;
  const intensityLabel=label(phase,'',0,-1.20,.23),phaseLimit=label(phase,'Concept only; not detector output',0,-1.48,.23,3.05);

  const spin=make('spin','Constant-speed track comparison','For a chosen linear speed, rpm = 60v/(2πr). These reference CLV curves compare CD, DVD and Blu-ray. Many drives use other speed strategies. The model makes no claim that every player runs at constant linear velocity in every mode.');
  const spinTitle=label(spin,'Spindle speed (rpm)',0,1.22,.25),spinNote=label(spin,'',0,.96,.23),spinFrame=segmentLines(2,INK,spin);
  fillLine(spinFrame,[[-.9,-.62,0],[1.2,-.62,0],[-.9,-.62,0],[-.9,.70,0]]);
  const speedCurves=DISC_FORMATS.map(f=>lineObject(67,f.color,spin));
  const speedCursor=segmentLines(2,GOLD,spin),spinHigh=label(spin,'',-1.2,.70,.14,.5);
  label(spin,'0',-1.12,-.62,.14,.3);
  for(const radius of [25,40,58])label(spin,String(radius),-.9+(radius-25)/33*2.1,-.79,.14,.35);
  label(spin,'Radius (mm)',.1,-1.00,.23,2.2);
  const spinResult=label(spin,'',0,-1.28,.23),spinLegend=DISC_FORMATS.map((f,i)=>textLabel(spin,f.name,{height:.23,width:.88,position:[-.88+i*.88,-1.55,.08],color:'#'+f.color.toString(16).padStart(6,'0')}));
  return {optics,opticalLaser,collimator,splitter,quarter,objective,data,detector,separator,outward,returned,arrows,opticalNote,track,trackTitle,trackScale,profile,clockTicks,cursor,bitLabels,trackAnswer,trackHint,spotBar,pitchBar,spotNote,pitchNote,layers,cover,backing,reflector,cone,axis,layerTitle,coverLabel,backingLabel,phase,phaseTitle,phaseNote,waves,waveZeros,intensityFrame,intensityBar,intensityLabel,phaseLimit,spin,spinTitle,spinNote,spinFrame,speedCurves,speedCursor,spinHigh,spinResult,spinLegend};
}

function updatePlayerDetails(d,plan,now) {
  const f=plan.format,color=f.color;
  d.outward.material.color.set(color);d.arrows.slice(0,2).forEach(o=>o.children.forEach(m=>m.material.color.set(color)));
  d.opticalNote.userData.setText(`${f.wavelength} nm out · gold return`);
  d.trackTitle.userData.setText(`${f.name}: ideal channel cells`);
  d.trackScale.userData.setText(`One cell = ${fixed(plan.cellLength,1)} nm`);
  const left=now.travel-3,right=left+10,px=cell=>-1.2+(cell-left)*.24;
  const firstRun=plan.sample.runs.find(run=>left>=run.start&&left<run.end);
  let previous=firstRun?.pit?.79:.52;
  const profile=[[-1.2,previous,.04]],levels=plan.sample.runs.filter(run=>run.end>left&&run.start<right);
  for(const run of levels){const start=Math.max(left,run.start),end=Math.min(right,run.end),height=run.pit?.79:.52;
    profile.push([px(start),previous,.04],[px(start),height,.04],[px(end),height,.04]);previous=height;
  }
  if(right>plan.sample.cells)profile.push([px(plan.sample.cells),.52,.04]);
  profile.push([1.2,right>plan.sample.cells?.52:previous,.04]);fillLine(d.profile,profile);
  const ticks=[];for(let cell=Math.ceil(left);cell<=right;cell++)ticks.push([px(cell),.42,.03],[px(cell),.49,.03]);fillLine(d.clockTicks,ticks);
  const first=Math.ceil(left-.5);
  d.bitLabels.forEach((label,i)=>{const cell=first+i,x=px(cell+.5),inside=x>=-1.2&&x<=1.2&&cell>=0&&cell<plan.sample.cells;
    label.visible=inside;label.userData.place(x,.19,.08);label.userData.setText(inside?String(plan.sample.bits[cell]):'');
  });
  d.trackAnswer.userData.setText(now.complete?`${now.count} cells read · ${now.ones} transitions`:`${now.count} cells read · cursor at ${fixed(now.travel,1)}`);
  const bar=(line,size,y)=>{const half=size/plan.cellLength*.24/2;fillLine(line,[[-half,y,.04],[half,y,.04],[-half,y-.035,.04],[-half,y+.035,.04],[half,y-.035,.04],[half,y+.035,.04]]);};
  bar(d.spotBar,plan.spotDiameter,-.66);bar(d.pitchBar,f.pitch,-1.15);d.spotBar.material.color.set(color);
  d.spotNote.userData.setText(`Scalar spot diameter: ${fixed(plan.spotDiameter,0)} nm`);
  d.pitchNote.userData.setText(`Track spacing: ${fixed(f.pitch,0)} nm`);
  d.cover.scale.y=f.cover;d.cover.position.y=f.cover/2;d.backing.visible=f.backing>0;d.backing.scale.y=Math.max(f.backing,1e-8);d.backing.position.y=f.cover+f.backing/2;d.reflector.position.y=f.cover;
  const inside=Math.asin(f.aperture/1.55),air=Math.asin(f.aperture),atSurface=f.cover*Math.tan(inside),atLens=atSurface+.4*Math.tan(air);
  fillLine(d.cone,[-1,1].flatMap(side=>[[side*atLens,-.4,.06],[side*atSurface,0,.06],[side*atSurface,0,.06],[0,f.cover,.06]]));d.cone.material.color.set(color);
  fillLine(d.axis,[[0,-.5,.07],[0,f.cover,.07]]);
  d.layerTitle.userData.setText(`${f.name}: focus at reflector`);
  d.coverLabel.userData.setText(`${fixed(f.cover,1)} mm transparent cover`);
  d.backingLabel.userData.setText(f.backing?`${fixed(f.backing,1)} mm backing`:'Reflector beyond 1.2 mm substrate');
  d.phaseNote.userData.setText(`${fixed(plan.phase,0)}° relative phase`);
  d.waves.forEach((line,index)=>fillLine(line,Array.from({length:193},(_,i)=>{
    const x=i/192,wave=playerInterference(plan.phase,6*Math.PI*x-2*Math.PI*now.clock),value=[wave.first,wave.second,wave.sum][index];
    return [-1.2+2.4*x,[.59,.05,-.49][index]+value*.17,.025];
  })));
  const power=plan.interference.intensity;d.intensityBar.visible=power>1e-12;d.intensityBar.scale.x=Math.max(power,1e-8);d.intensityBar.position.x=-1.2+1.2*power;
  d.intensityLabel.userData.setText(`${fixed(power*100,0)}% of in-phase intensity`);
  const maxRpm=Math.ceil(playerRpm(DISC_FORMATS[2],25,plan.speed)/1000)*1000;
  const chartPoint=(radius,rpm)=>[-.9+(radius-25)/33*2.1,-.62+rpm/maxRpm*1.32,.02];
  d.speedCurves.forEach((line,i)=>fillLine(line,Array.from({length:67},(_,j)=>{const radius=25+j/2;return chartPoint(radius,playerRpm(DISC_FORMATS[i],radius,plan.speed));})));
  const [x,y]=chartPoint(plan.radius,plan.rpm);fillLine(d.speedCursor,[[x-.035,y,.04],[x+.035,y,.04],[x,y-.035,.04],[x,y+.035,.04]]);
  d.spinHigh.userData.setText(fixed(maxRpm,0));d.spinNote.userData.setText(`${plan.speed}× reference speed · all formats`);
  d.spinResult.userData.setText(`${f.name}: ${fixed(plan.rpm,0)} rpm at ${plan.radius} mm`);
}

export function createBluRayPlayerModel() {
  const kit=houseModel('Blu-ray player'),{control,finish}=kit,p=physicalPlayer(kit),d=playerDetails(kit,p.system);
  control('format','Disc format',...PLAYER_DOMAINS.format,PLAYER_DEFAULTS.format,'','Selects the matching laser, optics and reference read speed.',DISC_FORMATS.map((f,value)=>({value,label:f.name})),{primary:true});
  control('radius','Read radius',...PLAYER_DOMAINS.radius,PLAYER_DEFAULTS.radius,'mm','Move the screw-driven pickup. At fixed track speed the spindle turns slower at larger radii.');
  control('speed','Read-speed multiplier',...PLAYER_DOMAINS.speed,PLAYER_DEFAULTS.speed,'×','Scales spindle speed, track speed and channel rate together. Disc motion is slowed 100×; the channel example uses its own much slower clock.');
  control('phase','Two-wave phase difference',...PLAYER_DOMAINS.phase,PLAYER_DEFAULTS.phase,'°','Changes only the separate interference demonstration. It does not change a real pit depth or predict disc readability.');
  let clock=0,lastClock=0,disposed=false;
  const result=finish(values=>{
    const plan=playerPlan(values);clock=Math.min(clock,plan.duration);const now=playerAt(plan,clock);
    p.pickup.position.x=plan.radius*PLAYER_MM;p.screw.rotation.x=now.screwAngle;
    p.clampMark.position.set(...mm(3.5*Math.sin(now.angle),17.075,3.5*Math.cos(now.angle)));p.clampMark.rotation.y=now.angle;
    p.rotorMark.position.set(...mm(-11.5*Math.sin(now.angle),11.95,-11.5*Math.cos(now.angle)));p.rotorMark.rotation.y=now.angle;
    p.outgoing.material.color.set(plan.format.color);
    const focusY=DRIVE.discBottom+plan.format.cover;
    fillLine(p.outgoing,[mm(-5.5,-1,0),mm(0,-1,0),mm(0,7.4,0),mm(0,focusY,0)]);
    fillLine(p.returning,[mm(.12,focusY,.12),mm(.12,-.88,.12),mm(-3,-.88,.12),mm(-3,-.88,6)]);
    const paths=[[[0,-1,0],[0,focusY,0]],[[0,focusY,.12],[0,-.88,.12],[-3,-.88,.12],[-3,-.88,6]]];
    p.lightDots.forEach((dot,index)=>{const points=paths[index].map(a=>new THREE.Vector3(...mm(...a))),lengths=points.slice(1).map((a,i)=>a.distanceTo(points[i])),total=lengths.reduce((a,b)=>a+b,0);let at=((clock*.8+index*.35)%1)*total,j=0;while(j<lengths.length-1&&at>lengths[j])at-=lengths[j++];dot.position.copy(points[j]).lerp(points[j+1],at/lengths[j]);});
    const cable=[[plan.radius+6,-4,9],[plan.radius+6,-2,14],[72,-18,28],[77,-20,18]],vertices=[],indices=[];
    for(const [x,y,z] of cable){vertices.push(...mm(x-2,y,z),...mm(x+2,y,z));}
    for(let i=1;i<cable.length;i++){const a=2*(i-1);indices.push(a,a+1,a+2,a+1,a+3,a+2);}
    const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));geometry.setIndex(indices);geometry.computeVertexNormals();replace(p.flex,geometry);
    p.status.material.color.set(now.complete?0xc39446:0x91aa7e);
    updatePlayerDetails(d,plan,now);
    return {state:{...plan,now,clock,time:clock},readings:[
      r('Your result',now.complete?`${now.count} channel cells read: ${now.ones} ones and ${now.zeros} zeros`:`${now.count} of ${plan.sample.cells} ideal channel cells read`,'A one marks a transition between pit and land. These channel cells still need modulation decoding and error correction; they are not the original movie or music bits.'),
      r('Spindle',`${fixed(plan.rpm,0)} rpm at ${plan.radius} mm`,`${fixed(plan.linearSpeed,3)} m/s track speed. The disc turns 100 times slower on screen. Radius is held fixed during this short sample; automatic spiral tracking is omitted.`),
      r('Laser and focus',`${plan.format.wavelength} nm · NA ${fixed(plan.format.aperture,2)}`,`${fixed(plan.spotDiameter,0)} nm scalar Airy-reference diameter. Actual high-NA field and detector contrast are not calculated. Near-infrared CD light uses a visible false color.`),
      r('Track',`${fixed(plan.format.pitch,0)} nm spacing · ${fixed(plan.cellLength,1)} nm per cell`,`Ordinary ${plan.format.code} runs span ${plan.format.minimumRun} to ${plan.format.maximumRun} cells. The displayed sequence is a local teaching example, not a fully encoded sector or sync pattern.`),
      r('Read rate',`${fixed(plan.channelRate/1e6,4)} million channel cells/s`,`The close-up shows ${plan.cellsPerSecond} cells/s, ${fixed(plan.channelRate/plan.cellsPerSecond,0)} times slower. This clock differs from the disc-motion clock. ${plan.format.name==='Blu-ray'?'The 1× representative user-data rate is 35.965 Mbit/s after overhead.':'Channel rate includes coding and error-correction overhead.'}`),
      r('Disc layers',`${fixed(plan.format.cover,1)} mm cover · ${fixed(plan.format.backing,1)} mm backing`,`${plan.format.capacity}. Capacity is a nominal format comparison; it is not calculated from the short sample.`),
      r('Two-wave demonstration',`${fixed(plan.interference.intensity*100,0)}% of the in-phase intensity`,`${plan.phase}° phase difference between equal coherent waves. This separate calculation is not a real photodetector reading.`),
    ]};
  });
  const render=result.update;
  result.advance=dt=>{if(Number.isFinite(dt)&&dt>0)clock=Math.min(result.getState().duration,Number((clock+dt).toFixed(12)));return render();};
  result.animate=t=>{const dt=Number.isFinite(t)?Math.max(0,t-lastClock):0;if(Number.isFinite(t))lastClock=t;return result.advance(dt);};
  result.reset=(initial={})=>{clock=Number.isFinite(initial.time)?Math.max(0,initial.time):0;lastClock=0;return render({...result.defaults,...(initial.settings||{})});};
  result.replayState=()=>({settings:result.getState().values,time:0});
  result.playback={label:'Read the channel example',description:'The spindle turns while an ideal channel example passes its clock. The two views use different stated slowdowns; this is not a movie decoder or detector-signal simulation.',stepLabel:'Advance one half-cell at 1×',advance:result.advance,step:()=>result.advance(1/12),complete:()=>result.getState().now.complete,blocked:()=>false};
  result.actions=[['Inspect: complete player','player'],['Inspect: optical pickup','pickup'],['Inspect: light path','optics'],['Inspect: channel clock','track'],['Inspect: disc layers','layers'],['Inspect: two-wave interference','phase'],['Inspect: spindle speed','spin'],['Inspect: carriage drive','traverse'],['Inspect: decoder board','electronics']].map(([label,part])=>({label,part,view:'front',isolate:true,replay:false,run:()=>render()}));
  result.resultPart={id:'track',label:'Inspect the channel result',view:'front',focusOnComplete:false,available:()=>true};
  result.covers.push(p.lid,p.front,p.frontSlot,p.status,p.right,p.discFront);result.initialCutaway=true;
  result.catalogParts=result.parts.filter(part=>!['system','player'].includes(part.id));
  const detailIds=new Set(['optics','track','layers','phase','spin']);
  result.thumbnailOmit=[...detailIds].map(id=>d[id]);
  result.partViewDirections=Object.fromEntries(result.parts.map(part=>[part.id,{front:detailIds.has(part.id)?[0,0,3]:[1.1,1.9,3]}]));
  for(const part of result.parts)part.framePadding=detailIds.has(part.id)?.60:.68;
  result.initialPart='player';result.initialView='front';result.frameVisibleOnly=true;result.framePadding=.70;result.selectionOutline=false;result.transparentBackground=true;
  result.frameBoundsForPart=id=>{
    if(detailIds.has(id)){const bounds={optics:[-1.68,-1.65,1.48,1.55],track:[-1.75,-1.81,1.65,1.41],layers:[-1.65,-1.56,1.65,1.79],phase:[-1.56,-1.65,1.56,1.53],spin:[-1.48,-1.72,1.50,1.37]}[id];return new THREE.Box3(new THREE.Vector3(bounds[0],bounds[1],-.04),new THREE.Vector3(bounds[2],bounds[3],.12)).applyMatrix4(d[id].matrixWorld);}
    if(id==='pickup')return new THREE.Box3(new THREE.Vector3(.14,-.19,-.16),new THREE.Vector3(.69,.13,.16)).applyMatrix4(kit.root.matrixWorld);
    return null;
  };
  result.topology={...p,details:d};const dispose=result.dispose;result.dispose=()=>{if(!disposed){disposed=true;dispose();}};
  return result;
}

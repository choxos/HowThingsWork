import * as THREE from 'three';
import {houseModel,reading as r} from './house-model-kit.js';

const TAU=2*Math.PI, NX=-.85, NZ=.15, FABRIC=1.04, SCALE=.025;
const clamp=x=>Math.max(0,Math.min(1,x));
export function createSewingModel(){
 const m=houseModel('Sewing machine'),{root,part,box,disk,ring,rod,cylinder,control,covers}=m;
 const frame=part('body','Frame and bearings','The rigid frame keeps the needle, shafts, hook and feed aligned.');
 box([3,.18,1.5],[0,.12,0],'leaf',frame);box([.43,1.95,.65],[1.05,1.35,-.15],'leaf',frame);box([2.3,.22,.65],[.05,2.28,-.15],'leaf',frame);
 const cover=box([.55,.92,.65],[NX,1.88,-.15],'leaf',frame);covers.push(cover);
 for(const x of [-.62,.85]){const b=ring(.105,.032,[x,2.05,NZ],'ink',frame);b.rotation.y=Math.PI/2;}
 const drive=part('drive','Handwheel, main shaft and needle crank','One shaft revolution drives one needle cycle. The crank pin and connecting rod stay joined.');
 rod([NX,2.05,NZ],[1.47,2.05,NZ],.047,'metal',drive);
 const wheel=part('handwheel','Handwheel','Turns with the main shaft.',[1.45,2.05,NZ],drive);
 ring(.31,.055,[0,0,0],'ink',wheel).rotation.y=Math.PI/2;
 for(let i=0;i<6;i++){const a=i*TAU/6;rod([0,0,0],[0,.29*Math.cos(a),.29*Math.sin(a)],.024,'metal',wheel);}
 const motor=part('motor','Electric motor and drive belt','The motor turns the handwheel through a belt. The pace control selects a slowed teaching speed.',[1.13,.40,.55]);
 const motorCover=cylinder(.17,.34,[0,0,0],'leaf',motor);motorCover.rotation.z=Math.PI/2;covers.push(motorCover);
 const rotor=part('motor-rotor','Motor rotor and pulley','The small motor pulley turns 3.1 times per handwheel revolution.',[0,0,0],motor);
 rod([-.16,0,0],[.36,0,0],.03,'metal',rotor);disk(.10,.06,[.36,0,0],'gold',rotor).rotation.y=Math.PI/2;rod([.40,0,0],[.40,.085,0],.014,'ink',rotor);
 for(let j=0;j<4;j++){const a=j*TAU/4;box([.22,.055,.055],[0,.12*Math.cos(a),.12*Math.sin(a)],'clay',motor);}
 rod([0,-.17,0],[0,-.21,0],.06,'metal',motor);
 const motorDistance=Math.hypot(1.65,-.40),motorUy=1.65/motorDistance,motorUz=-.40/motorDistance,motorSin=-.21/motorDistance,motorCos=Math.sqrt(1-motorSin**2);
 for(const sign of [-1,1]){const ny=motorSin*motorUy+sign*motorCos*motorUz,nz=motorSin*motorUz-sign*motorCos*motorUy;rod([1.49,2.05+.31*ny,NZ+.31*nz],[1.49,.40+.10*ny,.55+.10*nz],.017,'ink',drive);}
 const crank=part('crank','Needle crank','An off-center pin drives the connecting rod.',[NX,2.05,NZ],drive);disk(.075,.09,[0,0,0],'gold',crank).rotation.y=Math.PI/2;rod([0,0,0],[0,.32,0],.05,'gold',crank);const pin=cylinder(.052,.12,[0,.32,0],'metal',crank);pin.rotation.z=Math.PI/2;
 const needle=part('needle','Needle bar, needle and eye','The bar slides through fixed bearings. Its eye carries red upper thread through the cloth.');
 rod([NX,0,NZ],[NX,.52,NZ],.043,'metal',needle);rod([NX,0,NZ],[NX,-.35,NZ],.013,'metal',needle);ring(.016,.005,[NX,-.30,NZ],'gold',needle);
 for(const y of [1.51,1.79]){const bearing=cylinder(.073,.10,[NX,y,NZ],'ink',frame);covers.push(bearing);}
 const connecting=part('connecting-rod','Crank connecting rod','A fixed-length rod joins the rotating crank pin to the sliding needle bar.',[0,0,0],drive);
 const conrod=rod([0,0,0],[0,1,0],.03,'clay',connecting);
 function link(object,a,b){const av=new THREE.Vector3(...a),bv=new THREE.Vector3(...b),d=bv.clone().sub(av);object.position.copy(av).add(bv).multiplyScalar(.5);object.scale.y=d.length();object.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),d.normalize());}
 const transmission=part('transmission','Timing belt and hook shaft','The large upper pulley drives the half-size lower pulley: two hook turns per needle cycle.');
 const drivePulleys=[];for(const [y,rad] of [[2.05,.24],[.47,.12]]){const pulley=part(y>1?'upper-pulley':'hook-pulley',y>1?'Main-shaft pulley':'Hook-shaft pulley','A spoke makes the shaft rotation visible.',[1.29,y,NZ],transmission);disk(rad,.10,[0,0,0],'gold',pulley).rotation.y=Math.PI/2;rod([.06,0,0],[.06,rad*.85,0],.018,'ink',pulley);drivePulleys.push(pulley);}
 // Tangents to unequal pulleys keep the belt connected to both pitch circles.
 const alpha=Math.asin((.24-.12)/1.58);
 for(const sign of [-1,1])rod([1.29,2.05-.24*Math.sin(alpha),NZ+sign*.24*Math.cos(alpha)],[1.29,.47-.12*Math.sin(alpha),NZ+sign*.12*Math.cos(alpha)],.022,'ink',transmission);
 rod([NX,.47,NZ],[1.29,.47,NZ],.038,'metal',transmission);
 const shaftMark=part('hook-shaft','Rotating hook shaft','Transmits the lower pulley rotation to the hook.',[0,.47,NZ],transmission);rod([NX,.045,0],[1.29,.045,0],.01,'clay',shaftMark);
 const hookAssembly=part('hook-assembly','Rotary hook and bobbin assembly','The rotating hook surrounds a bobbin case held against rotation.',[NX,.47,NZ]);
 const bobbin=part('bobbin','Bobbin and stationary case','Blue lower thread unwinds from the bobbin. A retaining finger holds the case still.',[.03,0,0],hookAssembly);
 for(const x of [-.07,.07]){const flange=disk(.20,.025,[x,0,0],'metal',bobbin);flange.rotation.y=Math.PI/2;}
 const spool=cylinder(.165,.12,[0,0,0],'blue',bobbin);spool.rotation.z=Math.PI/2;
 rod([.14,.17,0],[.14,.27,0],.022,'ink',hookAssembly);rod([.14,.27,0],[.32,.27,0],.022,'ink',hookAssembly);
 const hook=part('hook','Rotary hook and point','The point reaches the needle during its early rise and draws its loop around the bobbin.',[0,0,0],hookAssembly);
 const hookPoints=[];for(let i=0;i<=50;i++){const a=i/50*TAU*.84;hookPoints.push([-.045,.28*Math.cos(a),.28*Math.sin(a)]);}m.tube(hookPoints,.025,'gold',hook);rod([-.045,.28,0],[-.07,.30,0],.014,'gold',hook);
 const plate=part('needle-plate','Needle plate and feed slots','The needle passes through the central opening; feed dogs rise through the side slots.');
 for(const x of [NX-.29,NX+.29])box([.12,.025,.70],[x,FABRIC-.045,NZ],'metal',plate);
 for(const z of [NZ-.36,NZ+.36])box([.68,.025,.12],[NX,FABRIC-.045,z],'metal',plate);
 const foot=part('presser-foot','Presser foot and spring','The lowered foot presses the cloth onto the feed dogs. Lift it to position the fabric.');
 rod([NX+.20,FABRIC+.10,NZ-.13],[NX+.20,1.88,NZ-.13],.035,'metal',foot);m.spring([NX+.20,1.5,NZ-.13],.055,.25,7,foot);
 for(const x of [NX-.10,NX+.10])box([.08,.045,.34],[x,FABRIC+.05,NZ],'metal',foot);rod([NX-.10,FABRIC+.09,NZ-.13],[NX+.20,FABRIC+.09,NZ-.13],.028,'metal',foot);
 const feedAssembly=part('feed-dog','Four-motion feed assembly','Follow the drive through lift and travel to the teeth moving the cloth.');
 const feed=part('feed-bar','Feed dogs and feed bar','Teeth rise, move the cloth with the needle clear, drop, and return below the plate.',[0,0,0],feedAssembly);
 for(const x of [NX-.20,NX+.20]){box([.075,.07,.38],[x,0,NZ],'metal',feed);for(let i=0;i<7;i++)box([.08,.035,.025],[x,.05,NZ-.15+i*.05],'gold',feed);}
 const feedDrive=part('feed-drive','Feed shaft, cams and slotted regulator','A separate 1:1 belt keeps the feed cycle synchronized with the needle. Two grooved cams drive lift and travel; a slotted lever scales travel.',[0,0,0],feedAssembly);
 const feedShaft=part('feed-shaft','Feed shaft and equal pulleys','Equal pulleys give one feed cycle per needle cycle.',[0,0,0],feedDrive);
 rod([NX-.3,.62,-.48],[1.15,.62,-.48],.032,'metal',feedShaft);
 const feedPulleys=[];for(const [y,z] of [[2.05,NZ],[.62,-.48]]){const pulley=part(y>1?'feed-input-pulley':'feed-output-pulley','Feed timing pulley','The matching pulleys turn together.',[1.15,y,z],feedShaft);disk(.16,.07,[0,0,0],'gold',pulley).rotation.y=Math.PI/2;rod([.045,0,0],[.045,.13,0],.015,'ink',pulley);feedPulleys.push(pulley);}
 const beltDy=1.43,beltDz=.63,beltD=Math.hypot(beltDy,beltDz);
 for(const sign of [-1,1])rod([1.15,2.05+sign*.16*beltDz/beltD,NZ-sign*.16*beltDy/beltD],[1.15,.62+sign*.16*beltDz/beltD,-.48-sign*.16*beltDy/beltD],.014,'ink',feedShaft);
 const smooth=t=>{const u=clamp(t);return u*u*(3-2*u);};
 function feedMotion(c){return {lift:.05*(smooth(c/.02)-smooth((c-.14)/.06)),travel:c<.20?.5-smooth((c-.02)/.12):-.5+smooth((c-.24)/.70)};}
 const cams=[];
 for(let index=0;index<2;index++){
  const x=NX+(index?.20:-.20),cam=part(index?'advance-cam':'lift-cam',index?'Feed travel cam':'Feed lift cam','A pin constrained to its guide follows this closed groove.',[x,.62,-.48],feedDrive);
  disk(.315,.025,[.025,0,0],'gold',cam).rotation.y=Math.PI/2;
  for(const offset of [-.025,.025]){const points=[];for(let j=0;j<=180;j++){const angle=j/180*TAU,c=((index?.25:0)-angle/TAU+2)%1,motion=feedMotion(c),radius=(index?.24+.05*motion.travel*2:.19+motion.lift)+offset;points.push([-.01,radius*Math.cos(angle),radius*Math.sin(angle)]);}m.tube(points,.008,'ink',cam);}cams.push(cam);
 }
 const liftFollower=part('lift-follower','Lift follower and horizontal fork','The vertical follower raises a fork. The feed bar can slide along the fork.',[NX-.20,0,0],feedDrive);
 disk(.022,.045,[-.025,0,-.48],'clay',liftFollower).rotation.y=Math.PI/2;
 rod([0,0,-.48],[0,.10,-.48],.025,'metal',liftFollower);
 for(const x of [-.035,.035])rod([x,.10,-.53],[x,.10,.34],.018,'metal',liftFollower);
 const travelFollower=part('travel-follower','Travel cam follower','This guided follower moves horizontally.',[NX+.20,.62,0],feedDrive);
 disk(.022,.045,[-.025,0,0],'clay',travelFollower).rotation.y=Math.PI/2;
 rod([0,0,0],[.10,0,0],.02,'metal',travelFollower);
 const regulator=part('feed-regulator','Slotted stitch-length regulator','Moving the output slider farther from the pivot increases the feed stroke.',[NX+.30,.42,-.24],feedDrive);
 for(const x of [-.028,.028])rod([x,-.04,0],[x,.32,0],.018,'clay',regulator);
 const feedOutput=part('feed-output','Feed travel slider and vertical fork','The horizontal output pushes the feed bar through a vertical sliding joint.',[NX+.20,0,0],feedDrive);
 for(const x of [-.035,.035])rod([x,0,NZ],[x,.65,NZ],.018,'metal',feedOutput);
 rod([0,0,-.24],[0,0,NZ],.025,'metal',feedOutput);disk(.025,.05,[.10,0,-.24],'gold',feedOutput).rotation.y=Math.PI/2;
 const feedGuide=part('feed-guides','Fixed follower guides','Guides constrain lift vertically and travel horizontally.',[0,0,0],feedDrive);
 box([.12,.12,.13],[NX-.20,.76,-.48],'metal',feedGuide);box([.12,.12,.13],[NX+.20,.62,-.24],'metal',feedGuide);
 covers.push(...feedGuide.children);
 const upper=part('upper-thread','Upper thread path','Red thread runs from spool through tension discs and take-up lever to the needle eye and stitch.');
 rod([.40,2.40,-.18],[.40,2.76,-.18],.026,'metal',upper);cylinder(.13,.28,[.40,2.57,-.18],'red',upper);
 for(const z of [.30,.35])disk(.11,.035,[-.34,1.78,z],'gold',upper);
 const takeup=part('take-up','Thread take-up lever','This driven lever supplies slack for the hook loop, then draws the interlock tight.',[NX,2.13,-.40]);
 rod([0,0,0],[0,.45,0],.025,'metal',takeup);ring(.025,.009,[0,.45,0],'gold',takeup);
 const takeLink=rod([0,0,0],[0,1,0],.018,'clay',drive);
 function line(parent,color,count=160,segments=false){const data=new Float32Array(count*3),geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.BufferAttribute(data,3));const object=new (segments?THREE.LineSegments:THREE.Line)(geometry,new THREE.LineBasicMaterial({color,depthTest:true}));parent.add(object);return points=>{points.forEach((p,i)=>data.set(p,i*3));geometry.setDrawRange(0,points.length);geometry.attributes.position.needsUpdate=true;geometry.computeBoundingSphere();};}
 function threadPath(parent,color){const draw=threadSegments(parent,color);return points=>{const pairs=[];for(let i=1;i<points.length;i++)pairs.push(points[i-1],points[i]);draw(pairs);};}
 const upperLine=threadPath(upper,0xc14f39),loopLine=threadPath(upper,0xc14f39),lowerLine=threadPath(bobbin,0x2684b1);
 const cloth=part('cloth','Practice fabric and sewn seam','The pattern moves with the cloth. Red stitches above and blue stitches below remain after the machine stops.');
 box([1.65,.032,2.1],[0,0,0],'cream',cloth);
 const guide=line(cloth,0x927b55),seam=part('seam','Completed lockstitches','Each completed stitch joins upper and lower thread through the fabric.',[0,0,0],cloth);
 function threadSegments(parent,color){const mesh=new THREE.InstancedMesh(new THREE.CylinderGeometry(.009,.009,1,8),new THREE.MeshToonMaterial({color}),300);mesh.count=0;parent.add(mesh);const pose=new THREE.Object3D(),up=new THREE.Vector3(0,1,0);return points=>{mesh.count=points.length/2;for(let i=0;i<points.length;i+=2){const a=new THREE.Vector3(...points[i]),b=new THREE.Vector3(...points[i+1]),delta=b.clone().sub(a);pose.position.copy(a).add(b).multiplyScalar(.5);pose.quaternion.setFromUnitVectors(up,delta.clone().normalize());pose.scale.set(1,delta.length(),1);pose.updateMatrix();mesh.setMatrixAt(i/2,pose.matrix);}mesh.instanceMatrix.needsUpdate=true;mesh.computeBoundingBox();mesh.computeBoundingSphere();};}
 const punctures=new THREE.InstancedMesh(new THREE.SphereGeometry(.012,8,6),new THREE.MeshToonMaterial({color:0x514831}),42);punctures.count=0;seam.add(punctures);
 const redSeam=threadSegments(seam,0xc14f39),blueSeam=threadSegments(seam,0x2684b1);
 control('template','Practice template',0,1,1,0,'','Changing the template starts fresh fabric. The corner template includes a simulated operator turning the cloth at needle-up.',[{value:0,label:'Straight seam · 40 mm'},{value:1,label:'Pocket corner · 20 + 20 mm'}]);
 control('length','Stitch length',1,5,.5,3,'mm','Sets the next feed distance. Completed stitches stay on the cloth.');
 control('rate','Sewing pace',.5,3,.5,1,'stitches/s','Teaching speed: one shaft turn makes one stitch.');
 control('foot','Presser foot',0,1,1,1,'','Lower the foot before sewing.',[{value:1,label:'Down · ready to feed'},{value:0,label:'Up · fabric released'}]);
 control('threaded','Thread setup',0,1,1,1,'','Both threads are required for a lockstitch.',[{value:1,label:'Upper thread + bobbin thread'},{value:0,label:'Bobbin thread missing'}]);
 let cycle=0,distance=0,stitches=[],holes=[],previousTemplate=0,lastClock=0,cycleLength=3,cycleGood=true;
 const pointAt=d=>previousTemplate===0?[0,0,(d-20)*SCALE]:d<=20?[-.25,0,(d-10)*SCALE]:[-.25+(d-20)*SCALE,0,.25];
 function fresh(){cycle=0;distance=0;stitches=[];holes=[];lastClock=0;cycleLength=3;cycleGood=true;}
 const result=m.finish(v=>{
  if(v.template!==previousTemplate){previousTemplate=v.template;fresh();}
  const a=cycle*TAU,cy=2.05+.32*Math.cos(a),cz=NZ+.32*Math.sin(a),slider=cy-Math.sqrt(.70**2-(cz-NZ)**2),needleTip=slider-.35;
  crank.rotation.x=a;wheel.rotation.x=a;rotor.rotation.x=3.1*a;needle.position.y=slider;link(conrod,[NX,cy,cz],[NX,slider,NZ]);
  drivePulleys[0].rotation.x=a;drivePulleys[1].rotation.x=shaftMark.rotation.x=2*a;feedPulleys.forEach(pulley=>pulley.rotation.x=a);
  hook.rotation.x=2*a-2*.55*TAU;
  const dy=cy-2.13,dz=cz+.40,d=Math.hypot(dy,dz),along=(.45**2-.65**2+d*d)/(2*d),across=Math.sqrt(.45**2-along**2);
  const ey=2.13+along*dy/d+across*dz/d,ez=-.40+along*dz/d-across*dy/d;
  takeup.rotation.x=Math.atan2(ez+.40,ey-2.13);const eye=new THREE.Vector3(NX,ey,ez);link(takeLink,[NX,cy,cz],[NX,ey,ez]);
  const feeding=cycle>=.02&&cycle<.14,portion=smooth((cycle-.02)/.12),travel=Math.min(cycleLength,40-distance)*SCALE,motion=feedMotion(cycle);
  feed.position.y=.91+motion.lift;feed.position.z=travel*motion.travel;
  cams.forEach(cam=>cam.rotation.x=a);liftFollower.position.y=feed.position.y-.10;
  const inputTravel=.10*motion.travel,gain=travel/.10;
  travelFollower.position.z=-.24+inputTravel;regulator.rotation.x=Math.atan2(inputTravel,.20);
  feedOutput.position.y=.42+.20*gain;feedOutput.position.z=feed.position.z;
  foot.position.y=v.foot&&!(previousTemplate===1&&distance===20&&cycle<.02)?0:.20;
  const progress=distance+(v.foot?portion*Math.min(cycleLength,40-distance):0),p=pointAt(progress);
  const turn=previousTemplate===1&&distance>=20?-Math.PI/2*(distance===20?smooth(cycle/.02):1):0;
  cloth.rotation.y=turn;const local=new THREE.Vector3(...p).applyAxisAngle(new THREE.Vector3(0,1,0),turn);cloth.position.set(NX-local.x,FABRIC,NZ-local.z);
  guide((previousTemplate===0?[pointAt(0),pointAt(40)]:[pointAt(0),pointAt(20),pointAt(40)]).map(p=>[p[0],.02,p[2]]));
  const upperPoints=[],lowerPoints=[];for(const stitch of stitches){const p=pointAt(stitch.from),q=pointAt(stitch.to);for(const [points,height] of [[upperPoints,.027],[lowerPoints,-.027]]){const end=height>0?-.005:.005,start=[p[0],end,p[2]],finish=[q[0],end,q[2]],rise=[p[0]+(q[0]-p[0])*.15,height,p[2]+(q[2]-p[2])*.15],fall=[p[0]+(q[0]-p[0])*.85,height,p[2]+(q[2]-p[2])*.85];points.push(start,rise,rise,fall,fall,finish);}}redSeam(upperPoints);blueSeam(lowerPoints);
  upperLine([[.40,2.71,-.18],[-.18,2.35,.30],[-.34,1.78,.36],[eye.x,eye.y,eye.z],[NX,1.50,.23],[NX,slider-.30,NZ]]);
  const previousPoint=new THREE.Vector3(...pointAt(distance)).applyAxisAngle(new THREE.Vector3(0,1,0),turn).add(cloth.position);previousPoint.y=FABRIC+.025;
  const needleEye=[NX,slider-.30,NZ],anchor=previousPoint.toArray(),loop=[needleEye];
  if(cycle>=.55&&cycle<1){
   const caughtAngle=(Math.min(cycle,.88)-.55)*2*TAU,tight=smooth((cycle-.88)/.12);
   for(const side of [0,1])for(let i=0;i<=48;i++){const angle=(side?1-i/48:i/48)*caughtAngle,x=NX+(side?.14:-.07),y=.47+.30*Math.cos(angle),z=NZ+.30*Math.sin(angle);loop.push([x+(NX-x)*tight,y+(FABRIC-y)*tight,z+(NZ-z)*tight]);}
  }else if(cycle>=.5){const slack=smooth((cycle-.5)/.05);loop.push([NX-.07*slack,slider-.30+.016*slack,NZ]);}
  loop.push([NX,FABRIC,NZ],anchor);loopLine(loop);
  punctures.count=holes.length;const puncturePose=new THREE.Object3D();holes.forEach((position,i)=>{const p=pointAt(position);puncturePose.position.set(p[0],.016,p[2]);puncturePose.scale.set(1,.25,1);puncturePose.updateMatrix();punctures.setMatrixAt(i,puncturePose.matrix);});punctures.instanceMatrix.needsUpdate=true;punctures.computeBoundingBox();punctures.computeBoundingSphere();
  spool.visible=Boolean(v.threaded);lowerLine(v.threaded?[[0,.17,0],[-.03,FABRIC-.47,0]]:[]);
  const sewn=stitches.reduce((sum,s)=>sum+s.to-s.from,0),complete=distance>=40,stage=complete?(sewn>=40?'Template complete':'Run finished: seam incomplete'):!v.foot?'Lower the presser foot to sew':cycle<.14?'Needle clear: feed dogs advance the cloth':cycle<.5?'Needle carries red thread down':cycle<.62?'Hook catches the rising-needle loop':cycle<.88?'Hook carries the loop around the bobbin':'Take-up tightens the interlock';
  return {state:{phase:cycle,stage,needleTip,feeding,feedDistance:progress-distance,distance,stitches:stitches.map(s=>({...s})),sewn,complete,rodLength:.70,stitchLength:v.length},readings:[r('What is happening',stage),r('Your result',`${stitches.length} lockstitches · ${sewn.toFixed(1)} / 40 mm sewn`),r('Thread check',v.threaded?'Two threads ready':'No bobbin thread: needle holes, no lockstitch'),r('Next stitch',`${v.length} mm`),r('Pattern',v.template?'Pocket corner: operator turns cloth at the corner':'Straight seam'),r('Motion model','Connected rigid parts; enlarged, prescribed thread loop. No fabric or thread-force solver.')]};
 });
 function advance(dt){if(!Number.isFinite(dt)||dt<=0)return result.getState().readings;const v=result.getState().values;if(!v.foot||distance>=40)return result.getState().readings;let remaining=Math.min(dt,120)*v.rate;
  while(remaining>1e-10&&distance<40){if(cycle===0){cycleLength=Math.min(v.length,40-distance,previousTemplate===1&&distance<20?20-distance:40);cycleGood=Boolean(v.threaded);}
   cycleGood=cycleGood&&Boolean(v.threaded);const step=Math.min(1-cycle,remaining);cycle+=step;remaining-=step;
   if(cycle>=1-1e-10){if(cycleGood)stitches.push({from:distance,to:distance+cycleLength});holes.push(distance+cycleLength);distance+=cycleLength;cycle=0;}
  }return result.update();
 }
 result.advance=advance;result.animate=clock=>{const dt=Math.max(0,clock-lastClock);lastClock=clock;return advance(dt);};
 result.reset=()=>{fresh();result.update();};
 result.actions=[{label:'Next stitch stage',run(){const next=[.14,.50,.55,.70,.84,1].find(p=>p>cycle+1e-8)||1;advance((next-cycle)/result.getState().values.rate);}}];
 result.resultPart={id:'seam',context:'cloth',label:'Inspect your stitching',available:()=>holes.length>0};
 result.playback={label:'Sew the template',stepLabel:'Make one stitch',advance,step:()=>advance((1-cycle)/result.getState().values.rate),complete:()=>result.getState().complete,blocked:()=>result.getState().values.foot===0};
 return result;
}

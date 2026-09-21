import * as THREE from 'three';
import {houseModel,reading} from './house-model-kit.js';
import {sampleRobervalBalance,ROBERVAL_BALANCE_DEFAULTS as D,ROBERVAL_BALANCE_DOMAINS,ROBERVAL_BALANCE_CONSTANTS as C} from './roberval-balance-physics.js';

export function createRobervalBalanceModel(){
 const kit=houseModel('Roberval balance'),{root,part,control,finish}=kit;
 const system=part('system','Roberval balance','Two equal beams and two upright carriers keep both pans horizontal. Along-pan load placement changes the internal reactions without changing the mass comparison.');system.scale.setScalar(4);
 function box(size,position,color,parent){const mesh=kit.box(size,position,color,parent);mesh.geometry.dispose();mesh.geometry=new THREE.BoxGeometry(...size);return mesh;}
 function shapeMesh(shape,depth,parent,color='metal'){const mesh=box([1,1,1],[0,0,0],color,parent);mesh.geometry.dispose();mesh.geometry=new THREE.ExtrudeGeometry(shape,{depth,bevelEnabled:false,curveSegments:64});mesh.geometry.translate(0,0,-depth/2);mesh.userData.profile=shape.getPoints();return mesh;}
 function bore(shape,x,y,r=.0066){const hole=new THREE.Path();hole.absarc(x,y,r,0,Math.PI*2,true);shape.holes.push(hole);}
 function annulus(outer,inner,depth,position,parent,color='metal'){const shape=new THREE.Shape();shape.absarc(0,0,outer,0,Math.PI*2,false);bore(shape,0,0,inner);const mesh=shapeMesh(shape,depth,parent,color);mesh.position.set(...position);return mesh;}
 function plate(x0,x1,y0,y1,holes,depth,position,parent,color){const shape=new THREE.Shape();shape.moveTo(x0,y0);shape.lineTo(x1,y0);shape.lineTo(x1,y1);shape.lineTo(x0,y1);shape.closePath();for(const [x,y] of holes)bore(shape,x,y);const mesh=shapeMesh(shape,depth,parent,color);mesh.position.set(...position);return mesh;}
 function beamBody(parent){const shape=new THREE.Shape(),a=C.halfLength,r=.017;shape.moveTo(-a,-r);shape.lineTo(a,-r);shape.absarc(a,0,r,-Math.PI/2,Math.PI/2,false);shape.lineTo(-a,r);shape.absarc(-a,0,r,Math.PI/2,3*Math.PI/2,false);shape.closePath();for(const x of [-a,0,a])bore(shape,x,0);return shapeMesh(shape,.026,parent,'wood');}
 const frame=part('frame','Fixed frame and bored bearings','Paired fixed cheeks hold the two pivot centers 0.35 m apart. Their reactions carry the off-center load couples; the rotating shafts pass through actual bores.',[0,0,0],system);
 const floor=box([1.60,.030,.48],[0,-.395,0],'leaf',frame),frameCheeks=[];
 for(const z of [-.047,.047])frameCheeks.push(plate(-.040,.040,-.38,.230,[[0,-.175],[0,.175]],.014,[0,0,z],frame,'metal'));
 const upper=part('upper-beam','Upper equal-arm beam','The upper beam rotates about its fixed midpoint. Its two end pins are each 0.45 m from the center.',[0,.175,0],system),upperBody=beamBody(upper);
 const lower=part('lower-beam','Lower equal-arm beam','An equal lower beam completes the parallelogram. It rotates through the same angle and keeps the carriers upright.',[0,-.175,0],system),lowerBody=beamBody(lower);
 const pivots=[];
 for(const [group,y,start] of [[upper,.175,-.146],[lower,-.175,-.080]]){
  const shaft=kit.rod([0,0,start],[0,0,.085],.0065,'ink',group),key=box([.005,.006,.024],[.0075,0,0],'metal',group),spacers=[],washers=[];
  for(const sign of [-1,1]){spacers.push(annulus(.015,.0066,.027,[0,0,sign*.0265],group));washers.push(annulus(.015,.0066,.006,[0,0,sign*.057],group));kit.disk(.010,.005,[0,0,sign*.0625],'gold',group);}
  pivots.push({group,center:[0,y,0],shaft,key,spacers,washers});
 }
 const sides={};
 for(const [name,sign,color] of [['left',-1,'clay'],['right',1,'blue']]){
  const title=name[0].toUpperCase()+name.slice(1),carrier=part(name+'-carrier',title+' upright carrier','Two separated, bored end joints supply the carrier force and couple. The fork stays upright and translates with both beam ends.',[sign*.45,0,0],system),cheeks=[],joints=[];
  for(const z of [-.036,.036])cheeks.push(plate(-.022,.022,-.234,.250,[[0,-.175],[0,.175]],.012,[0,0,z],carrier,'metal'));
  const lowerBrace=box([.044,.018,.084],[0,-.225,0],'metal',carrier);
  for(const y of [-.175,.175]){
   const shaft=kit.rod([0,y,-.053],[0,y,.053],.0065,'ink',carrier),spacers=[],washers=[],heads=[];
   for(const side of [-1,1]){spacers.push(annulus(.012,.0066,.017,[0,y,side*.0215],carrier));washers.push(annulus(.013,.0066,.006,[0,y,side*.045],carrier));heads.push(kit.disk(.009,.005,[0,y,side*.0505],'gold',carrier));}
   joints.push({local:[0,y,0],shaft,spacers,washers,heads});
  }
  const pan=part(name+'-pan',title+' horizontal pan','The entire pan translates without rotating, so every load position has the same vertical displacement. The pan is rigidly joined to both carrier cheeks.',[0,0,0],carrier),deck=box([.480,.010,.220],[0,.255,0],color,pan);
  const load=part(name+'-load',title+' secured payload','A top bridge and two side clamps retain the selected point-mass payload. The restraint supplies lateral acceleration and any downward stopping impulse.',[0,.300,0],pan),payload=box([.100,.080,.080],[0,0,0],color,load),clamps=[];
  for(const x of [-.054,.054]){clamps.push(box([.008,.090,.022],[x,.005,0],'metal',load));clamps.push(box([.010,.010,.030],[Math.sign(x)*.055,-.035,0],'gold',load));}
  const clampBridge=box([.116,.010,.022],[0,.045,0],'metal',load);clamps.push(clampBridge);
  const arrow=new THREE.ArrowHelper(new THREE.Vector3(0,-1,0),new THREE.Vector3(),.10,0xc27a3f,.022,.010);carrier.add(arrow);arrow.userData.explosionExcluded=true;
  sides[name]={carrier,cheeks,lowerBrace,joints,pan,deck,load,payload,clamps,clampBridge,arrow};
 }
 const damper=part('damper','Upper-shaft viscous damper','The fixed casing and rotating vane make the assumed damping explicit. Torque is −0.8 times angular speed; the damper supplies no restoring torque at rest.',[0,0,0],system);
 const damperHousing=annulus(.055,.039,.044,[0,.175,-.112],damper,'blue'),damperFoot=box([.030,.030,.080],[0,.106,-.090],'blue',damper),damperEnds=[-.139,-.085].map(z=>annulus(.055,.0066,.010,[0,.175,z],damper,'blue'));
 const damperRotor=new THREE.Group();damperRotor.position.set(0,.175,-.112);damper.add(damperRotor);
 const damperHub=annulus(.015,.0066,.030,[0,0,0],damperRotor),damperKey=box([.005,.006,.028],[.0075,0,0],'metal',damperRotor),damperVane=box([.024,.010,.028],[.025,0,0],'metal',damperRotor);kit.covers.push(...damperEnds);
 const stops=part('stops','Paired travel stops','At either angle limit, two opposite vertical contacts arrest the upper beam. Their resultant force is zero and their couple holds any remaining imbalance.',[0,0,0],system);
 const stopBallRadius=.010,stopFace=C.stopRadius*Math.sin(C.stopAngle)+stopBallRadius,stopBlocks=[],stopPosts=[],stopTies=[],stopLugs=[],lugStems=[];
 for(const sign of [-1,1]){
  const x=sign*C.stopRadius*Math.cos(C.stopAngle),postX=sign*.355;
  stopPosts.push(box([.020,.665,.034],[postX,-.0475,.160],'metal',stops));
  for(const vertical of [-1,1]){const y=.175+vertical*(stopFace+.010);stopBlocks.push(box([.050,.020,.034],[x,y,.160],'red',stops));stopTies.push(box([Math.abs(postX-x),.020,.034],[(postX+x)/2,y,.160],'metal',stops));}
  lugStems.push(kit.rod([sign*.30,0,.013],[sign*.30,0,.160],.006,'metal',upper));stopLugs.push(kit.sphere(stopBallRadius,[sign*.30,0,.160],'gold',upper));
 }
 const pointer=part('pointer','Beam-angle pointer','The pointer turns with the upper beam. Level is a useful reference, while equal masses can also remain freely balanced at a nonzero angle.',[0,0,0],upper);
 const pointerShape=new THREE.Shape();pointerShape.moveTo(-.004,0);pointerShape.lineTo(.004,0);pointerShape.lineTo(.003,.208);pointerShape.lineTo(.008,.208);pointerShape.lineTo(0,.227);pointerShape.lineTo(-.008,.208);pointerShape.lineTo(-.003,.208);pointerShape.closePath();
 const pointerBody=shapeMesh(pointerShape,.004,pointer,'red');pointerBody.position.z=.080;const pointerHub=annulus(.011,.0066,.014,[0,0,.078],pointer,'gold'),pointerKey=box([.005,.006,.014],[.0075,0,.078],'metal',pointer);
 const comparison=part('comparison-arc','Fixed angle comparison arc','The stationary center mark identifies a level beam. The marks represent angle, not a calibrated mass difference.',[0,0,0],system),arcShape=new THREE.Shape();arcShape.absarc(0,0,.248,Math.PI/2-.27,Math.PI/2+.27,false);arcShape.absarc(0,0,.232,Math.PI/2+.27,Math.PI/2-.27,true);arcShape.closePath();
 const arcBody=shapeMesh(arcShape,.012,comparison,'cream');arcBody.position.set(0,.175,.130);
 const arcStand=box([.014,.810,.024],[.095,.025,.130],'metal',comparison),arcTie=box([.040,.014,.024],[.075,.413,.130],'metal',comparison),markPoints=[];
 for(let i=-4;i<=4;i++){const a=Math.PI/2+i*.05,r0=i===0?.230:.235;markPoints.push(new THREE.Vector3(r0*Math.cos(a),.175+r0*Math.sin(a),.137),new THREE.Vector3(.247*Math.cos(a),.175+.247*Math.sin(a),.137));}
 const arcMarks=new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(markPoints),new THREE.LineBasicMaterial({color:0x374736}));comparison.add(arcMarks);
 const specs={
  leftMass:['Left mass','kg','Select a secured payload mass. The heavier side descends after release; zero leaves the retained fixture empty.'],
  rightMass:['Right mass','kg','Masses are compared by equal, opposite travel. Changing a control samples a new trial from the selected initial angle.'],
  leftOffset:['Left offset','m','Move the left load along its horizontal pan. This changes the carrier couple and joint forces without changing the released motion.'],
  rightOffset:['Right offset','m','Positive offsets are to the right on either pan. Both loads remain centered in pan depth.'],
  initialAngle:['Initial beam angle','','Choose the starting tilt and release from rest. Equal masses remain at that angle because the ideal linkage has no restoring torque.',[{value:-.12,label:'Right pan lower · −6.875°'},{value:0,label:'Level · 0°'},{value:.12,label:'Left pan lower · +6.875°'}]],
  gravity:['Gravity','','Gravity changes force and timing while preserving the equal-mass condition.',[{value:0,label:'Earth · 9.81 m/s²'},{value:1,label:'Moon · 1.62 m/s²'}]],
 };
 for(const [key,[min,max,step]] of Object.entries(ROBERVAL_BALANCE_DOMAINS)){const [label,unit,help,options]=specs[key];control(key,label,min,max,step,D[key],unit,help,options);}
 function pose(s,values=s.values){
  upper.rotation.z=lower.rotation.z=damperRotor.rotation.z=s.angle;
  for(const [name,side] of Object.entries(sides)){side.carrier.position.set(...s[name].carrier);side.load.position.x=values[name+'Offset'];side.payload.visible=values[name+'Mass']>0;side.arrow.visible=side.payload.visible;side.arrow.position.set(values[name+'Offset'],.49,0);side.arrow.setLength(.08+.025*values[name+'Mass'],.022,.010);}
 }
 let elapsed=0,lastClock=0,disposed=false;const format=(n,digits=2)=>(Math.abs(n)<.5*10**-digits?0:n).toFixed(digits),number=(label,n,unit,hint,digits=2)=>reading(label,format(n,digits)+(unit?' '+unit:''),hint);
 const result=finish(values=>{
  const s=sampleRobervalBalance(values,elapsed);pose(s,values);
  const outcome=s.atStop?'The '+(s.atStop>0?'left':'right')+' pan is lower and the paired stops hold the remaining imbalance. Stopped motion does not mean equal masses.':s.neutralBalance?(s.angle===0?'Equal masses remain level without a stop reaction.':'Equal masses remain at their selected tilt without a restoring torque or stop reaction.'):'The heavier '+(values.leftMass>values.rightMass?'left':'right')+' pan descends. Both pans remain horizontal as they translate.';
  const readings=[
   reading('Outcome',outcome,'Equal masses can remain freely balanced even when tilted. A travel stop can hold unequal masses motionless, so also check stop torque.'),
   number('Left mass',values.leftMass,'kg','Secured payload on the left pan. Moving it along the pan changes internal forces, not the mass comparison.'),
   number('Right mass',values.rightMass,'kg','Secured payload on the right pan. Equal masses have no gravitational driving torque at any allowed angle.'),
   number('Beam angle',s.angle*180/Math.PI,'°','Positive means left pan lower; negative means right pan lower. The pointer marks angle, not a calibrated mass difference.'),
   number('Stop torque',s.stopTorque,'N m','Paired contacts hold the remaining imbalance. Zero is required for free balance; negative opposes a descending left pan.',3),
   number('Left carrier couple',s.left.panCouple,'N m','Turning effect transmitted by the left carrier joints: offset × support minus payload height × lateral force. Positive is counterclockwise.',3),
   number('Right carrier couple',s.right.panCouple,'N m','Corresponding turning effect on the right carrier. Different couples can coexist with equal masses and free balance.',3),
   number('Fixed-bearing couple',s.fixedBearingCouple,'N m','Sum of the carrier couples carried through the two fixed central bearings. An off-center moment is supported, not erased.',3),
  ];
  for(const name of ['left','right']){const side=s[name],title=name[0].toUpperCase()+name.slice(1);readings.push(
   number(title+' support force',side.supportForce,'N','Upward force on this secured payload equals mass × (gravity + vertical acceleration). During motion it differs from stationary weight.'),
   number(title+' top horizontal force',side.topHorizontalForce,'N','Horizontal force on this carrier at its upper joint. Positive is rightward. Together with the lower force it supplies the lateral force and carrier couple.'),
   number(title+' bottom horizontal force',side.bottomHorizontalForce,'N','Horizontal force at the lower joint. At rest it opposes the upper force, with their 0.35 m spacing providing the off-center couple.'),
   number(title+' stopping impulse Y',side.stoppingImpulse[1],'N s','Vertical momentum change at the last stop. Positive is upward; a rising load needs a downward impulse from its restraint.',3),
  );}
  readings.push(
   number('Driving torque',s.gravityTorque,'N m','Gravity drives the heavier pan down. Moving a load within its horizontal pan does not change this torque.',3),
   number('Damper torque',s.damperTorque,'N m','Opposes angular speed with coefficient 0.8 N m s/rad. It dissipates energy but supplies no restoring torque at rest.',3),
   number('Signed left stop force',s.stopLeftForce,'N','Vertical holding force at the left lug. Positive is upward. The right lug supplies an equal opposite force.'),
   number('Signed right stop force',s.stopRightForce,'N','Opposite holding force at the right lug. The pair has zero resultant force but a nonzero torque when stopped with unequal masses.'),
   number('Gravity',s.gravity,'m/s²','Same local gravity acts on both masses. It changes forces and release timing while preserving equal-mass balance.'),
   reading('Stop impacts',String(s.stopHits),'Counts fully inelastic contacts in this trial. A freely balanced equal-mass release has no impact.'),
   reading('Last impact physical time',s.stopHits?format(s.lastImpactPhysicalTime,3)+' s':'No impact','Actual time at the paired stop contact. Playback shows each physical second over four trial seconds.'),
   number('Kinetic energy',s.kineticEnergy,'J','Energy in the two rotating beams and translating secured payloads. Payload offsets add no rotational inertia because the pans do not rotate.',3),
   number('Potential energy change',s.potentialEnergy,'J','Gravitational energy relative to the selected initial tilt. Lost potential energy becomes motion and heat.',3),
   number('Damper heat',s.damperHeat,'J','Energy dissipated by the viscous damper during motion. It stays recorded after stopping.',3),
   number('Impact heat',s.impactHeat,'J','Incoming kinetic energy converted to heat at the fully inelastic stop. Equal-mass neutral trials dissipate none.',3),
   number('Physical elapsed time',s.physicalTime,'s','Two physical seconds of release are shown over eight seconds of trial time.'),
   number('Trial time',s.elapsed,'s','Time within the slowed trial. Presets and Reset release from rest at the selected starting angle.'),
  );
  return {state:s,readings};
 });
 const render=result.update;result.advance=dt=>{if(Number.isFinite(dt)&&dt>0)elapsed=Math.min(C.duration,elapsed+dt);return render();};result.animate=time=>{const dt=Number.isFinite(time)?Math.max(0,time-lastClock):0;if(Number.isFinite(time))lastClock=time;return result.advance(dt);};result.reset=()=>{elapsed=lastClock=0;return render(result.defaults);};
 result.actions=[['Inspect start (0%)',0],['Inspect quarter (25%)',.25],['Inspect three quarters (75%)',.75],['Inspect result (100%)',1]].map(([label,p])=>({label,part:'system',view:'front',replay:false,run(){elapsed=C.duration*p;return render();}}));
 result.actions.push({label:'Inspect balance pointer',part:'pointer',view:'front',replay:false,run:()=>render()},{label:'Inspect whole balance',part:'system',view:'front',replay:false,run:()=>render()});
 result.playback={label:'Release the balance',description:'Inspect balance pointer compares the pointer with the fixed arc while preserving the trial. Two physical seconds of released motion play over eight seconds. Loads are secured; the visible damper and paired inelastic stops make their reactions explicit.',stepLabel:'Advance the balance by one percent of the trial',advance:result.advance,step:()=>result.advance(C.duration/100),complete:()=>elapsed>=C.duration,blocked:()=>false};
 result.resultPart={id:'pointer',context:'system',label:'Inspect balance and the fixed angle reference',view:'front',focusOnComplete:false,available:()=>elapsed>=C.duration};
 result.frameBoundsForPart=id=>{
  if(id==='pointer'){system.updateWorldMatrix(true,true);return new THREE.Box3().setFromObject(pointer,true).union(new THREE.Box3().setFromObject(arcBody,true)).union(new THREE.Box3().setFromObject(arcMarks,true));}
  if(!['system','upper-beam','lower-beam','left-carrier','right-carrier','left-pan','right-pan','left-load','right-load'].includes(id))return null;
  system.updateWorldMatrix(true,false);return new THREE.Box3(new THREE.Vector3(-.80,-.410,-.24),new THREE.Vector3(.80,.60,.24)).applyMatrix4(system.matrixWorld).union(new THREE.Box3().setFromObject(floor,true));
 };
 root.rotation.set(.08,-.26,0);result.initialPart='system';result.initialView='front';result.frameVisibleOnly=true;result.framePadding=.5;result.autoFramePart='system';result.selectionOutline=false;result.transparentBackground=true;
 result.parts.find(p=>p.id==='pointer').framePadding=.65;result.catalogParts=result.parts.filter(p=>p.id!=='system');
 result.topology={pose,system,frame,floor,frameCheeks,upper,upperBody,lower,lowerBody,pivots,sides,damper,damperHousing,damperFoot,damperEnds,damperRotor,damperHub,damperKey,damperVane,stops,stopBallRadius,stopFace,stopBlocks,stopPosts,stopTies,stopLugs,lugStems,pointer,pointerBody,pointerHub,pointerKey,comparison,arcBody,arcStand,arcTie,arcMarks};
 const dispose=result.dispose;result.dispose=()=>{if(!disposed){disposed=true;dispose();}};return result;
}

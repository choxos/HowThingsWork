import * as THREE from 'three';
import {houseModel,reading} from './house-model-kit.js';
import {sampleCanOpener,CAN_OPENER_DEFAULTS as D,CAN_OPENER_DOMAINS,CAN_OPENER_CONSTANTS as C} from './can-opener-physics.js';

export function createCanOpenerModel(){
 const kit=houseModel('Can opener'),{root,part,control,finish}=kit;
 const system=part('system','Can opener','The hand crank drives two meshing spur gears. The feed wheel advances the rim beneath the sharp cutting wheel.');
 const can=part('can','Can and lid','The can turns beneath the stationary opener. Rim travel comes from the feed wheel, provided the clamp supplies enough traction.',[0,0,0],system);
 const body=part('body','Can body','The cylindrical wall supports the rolled rim. It remains intact as the lid is cut.',[0,0,0],can);
 const shell=kit.cylinder(1,1.35,[0,-.675,0],'metal',body);shell.geometry.dispose();shell.geometry=new THREE.CylinderGeometry(1,1,1.35,96,1,true);shell.material= shell.material.clone();shell.material.side=THREE.DoubleSide;
 const bottom=kit.cylinder(1,.035,[0,-1.34,0],'metal',body),canBands=[-.32,-1.12].map(y=>{const m=kit.ring(1,.025,[0,y,0],'metal',body);m.rotation.x=Math.PI/2;return m;});
 const seamMarker=kit.box([.055,.83,.018],[0,-.7,1.008],'blue',body);
 const rim=part('rim','Rolled rim','The toothed feed wheel contacts the underside of this reinforced edge.',[0,0,0],can),rimMesh=kit.ring(1,.025,[0,-.01,0],'gold',rim);rimMesh.rotation.x=Math.PI/2;
 const lid=part('lid','Cut lid','The remaining metal connection shrinks as the cut travels around the entire circumference. Only a fully cut lid can be lifted for inspection.',[0,0,0],can);
 const lidMesh=kit.cylinder(1,.025,[0,-.025,0],'cream',lid),lidRings=[.55,.76].map(r=>{const m=kit.ring(r,.009,[0,-.008,0],'metal',lid);m.rotation.x=Math.PI/2;return m;});
 const lidMark=kit.box([.12,.006,.45],[0,-.005,.45],'blue',lid);
 const cutSeam=part('cut-seam','Cut and remaining connection','The dark arc is the actual separated length. The light metal still connects the lid until the cut completes one circumference.',[0,0,0],can);
 const seamGeometry=new THREE.BufferGeometry(),seamPositions=new Float32Array(192*18);seamGeometry.setAttribute('position',new THREE.BufferAttribute(seamPositions,3));
 const metalBridge=new THREE.Mesh(seamGeometry,lidMesh.material);metalBridge.frustumCulled=false;cutSeam.add(metalBridge);
 const cutGeometry=new THREE.BufferGeometry(),cutPositions=new Float32Array(193*3);cutGeometry.setAttribute('position',new THREE.BufferAttribute(cutPositions,3));
 const cutLine=new THREE.Line(cutGeometry,new THREE.LineBasicMaterial({color:0x374736}));cutLine.frustumCulled=false;cutSeam.add(cutLine);
 const head=part('clamp-head','Paired handle clamp','The two handles pivot about one hinge. Closing them meshes the spur gears and holds the feed wheel against the can rim.',[0,0,0],system);
 const fixedHandle=part('fixed-handle','Fixed handle and upper bearing','The steel frame holds the crank and cutting-wheel shaft above the rim.',[0,0,.54],head);
 kit.rod([0,.28,0],[.55,-.22,0],.09,'metal',fixedHandle);kit.rod([.55,-.22,0],[2.25,-.65,0],.08,'metal',fixedHandle);kit.rod([1.15,-.38,0],[2.3,-.66,0],.115,'leaf',fixedHandle);
 const upperBearing=kit.disk(.14,.15,[0,.28,0],'ink',fixedHandle);
 const hinge=part('hinge','Handle hinge','The hinge constrains the lower jaw and upper grip to move together about a fixed pivot.',[.55,-.22,.54],head);kit.disk(.14,.32,[0,0,0],'gold',hinge);kit.disk(.06,.35,[0,0,0],'ink',hinge);
 const transmission=part('transmission','Geared drive','Two equal 20-tooth spur gears reverse rotation without changing its magnitude. Shafts connect the gears to the cutter and feed wheel.',[0,0,0],head);
 function spurGear(parent,color){
  const group=new THREE.Group(),shape=new THREE.Shape(),count=20,pitch=.31,pressure=Math.PI/9,base=pitch*Math.cos(pressure),tip=pitch+.031,bottom=pitch-.03875;
  const baseHalf=Math.PI/(2*count)+Math.tan(pressure)-pressure;
  const halfAt=r=>{const angle=Math.acos(base/r);return baseHalf-(Math.tan(angle)-angle);};
  const point=(r,angle,first=false)=>{const x=r*Math.cos(angle),y=r*Math.sin(angle);if(first)shape.moveTo(x,y);else shape.lineTo(x,y);};
  for(let tooth=0;tooth<count;tooth++){
   const center=Math.PI/2+tooth*2*Math.PI/count;point(bottom,center-baseHalf,tooth===0);
   for(let j=0;j<=32;j++){const r=base+(tip-base)*j/32;point(r,center-halfAt(r));}
   const tipHalf=halfAt(tip);for(let j=1;j<=8;j++)point(tip,center-tipHalf+2*tipHalf*j/8);
   for(let j=32;j>=0;j--){const r=base+(tip-base)*j/32;point(r,center+halfAt(r));}
   point(bottom,center+baseHalf);for(let j=1;j<=8;j++)point(bottom,center+baseHalf+(2*Math.PI/count-2*baseHalf)*j/8);
  }
  shape.closePath();parent.add(group);const mesh=kit.box([1,1,1],[0,0,-.06],color,group);mesh.geometry.dispose();mesh.geometry=new THREE.ExtrudeGeometry(shape,{depth:.12,bevelEnabled:false});
  kit.disk(.0465,.17,[0,0,0],'ink',group);group.userData.toothCount=count;group.userData.pitchRadius=pitch;return group;
 }
 const crank=part('crank','Hand crank and upper shaft','The hand applies tangential force at the chosen radius. The crank, upper gear, and cutting disk share a shaft.',[0,.28,.85],transmission);
 const crankArm=kit.rod([0,0,0],[1,0,0],.055,'metal',crank),grip=kit.cylinder(.095,.36,[1,0,.2],'wood',crank);grip.rotation.x=Math.PI/2;
 const upperShaft=kit.rod([0,0,-.91],[0,0,.045],.055,'metal',crank);kit.disk(.11,.08,[0,0,0],'gold',crank);
 const driverGear=part('driver-gear','Upper driving spur gear','The crank turns this 20-tooth gear on the same shaft as the cutting disk.',[0,.28,.3],transmission),driverMesh=spurGear(driverGear,'gold');
 const cutter=part('cutting-wheel','Beveled cutting wheel','The narrow wedge edge concentrates the clamp force into the lid. A duller edge is represented by a greater effective cutting resistance.',[0,.28,-.04],transmission);
 const cutterFaces=[.004,.04].map(thickness=>{
  const profile=[[.065,-.055],[.245,-.055],[.32,-thickness/2],[.32,thickness/2],[.245,.055],[.065,.055],[.065,-.055]].map(([r,z])=>new THREE.Vector2(r,z));
  const m=kit.cylinder(.32,.1,[0,0,0],'metal',cutter);m.geometry.dispose();m.geometry=new THREE.LatheGeometry(profile,96);m.rotation.x=Math.PI/2;return m;
 });
 const cutterStripe=kit.rod([.09,0,.061],[.235,0,.061],.017,'clay',cutter);
 const movingHandle=part('moving-handle','Moving handle and lower jaw','Spreading the grips rotates this lever, lowering the feed wheel and separating the two gears.',[.55,-.22,.54],transmission);
 kit.rod([-.55,-.12,0],[0,0,0],.09,'metal',movingHandle);kit.rod([0,0,0],[1.7,-.17,0],.075,'metal',movingHandle);kit.rod([.62,-.06,0],[1.75,-.175,0],.11,'clay',movingHandle);
 const lowerBearing=kit.disk(.14,.15,[-.55,-.12,0],'ink',movingHandle);
 const drivenGear=part('driven-gear','Lower driven spur gear','The meshing equal gear turns in the opposite direction and drives the toothed feed wheel.',[-.55,-.12,-.24],movingHandle),drivenMesh=spurGear(drivenGear,'clay');drivenMesh.rotation.z=Math.PI/20;
 const feed=part('feed-wheel','Toothed feed wheel','Its 10 mm effective radius converts rotation into rim travel. Low normal force lets it slip beneath the stationary rim.',[-.55,-.12,-.47],movingHandle);
 const feedMesh=kit.disk(.285,.14,[0,0,0],'ink',feed),feedTeeth=[];
 for(let i=0;i<40;i++){const a=i*2*Math.PI/40,m=kit.box([.025,.036,.145],[.291*Math.sin(a),.291*Math.cos(a),0],'metal',feed);m.rotation.z=-a;feedTeeth.push(m);}
 const lowerShaft=kit.rod([0,0,-.035],[0,0,.575],.055,'metal',feed),feedStripe=kit.rod([0,0,.084],[0,.255,.084],.02,'blue',feed);
 const forceGuide=part('force-guide','Force comparison','Blue is the available rim force from the hand-force limit, green is the traction limit, and orange is the required cutting resistance. All bars use the same 0 to 100 N scale.',[.4,-2.55,0],system);
 const textures=[],labels=[];forceGuide.userData.explosionExcluded=true;
 function label(text,x,y,width){
  const canvas=typeof document==='undefined'?null:document.createElement('canvas');let texture;
  if(canvas){canvas.height=128;canvas.width=Math.ceil(canvas.height*width/.21);const ctx=canvas.getContext('2d');ctx.font=canvas.height*.8+'px sans-serif';ctx.fillStyle='#263a2f';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(text,canvas.width/2,canvas.height/2,canvas.width*.96);texture=new THREE.CanvasTexture(canvas);}
  else texture=new THREE.DataTexture(new Uint8Array([0,0,0,0]),1,1);
  texture.colorSpace=THREE.SRGBColorSpace;texture.needsUpdate=true;textures.push(texture);
  const mesh=new THREE.Mesh(new THREE.PlaneGeometry(width,.21),new THREE.MeshBasicMaterial({map:texture,transparent:true,depthWrite:false,toneMapped:false,side:THREE.DoubleSide}));mesh.position.set(x,y,.14);mesh.userData.labelText=text;forceGuide.add(mesh);labels.push(mesh);
 }
 label('Rim force · 0 to 100 N',0,.45,2.5);
 const bars=[];for(let i=0;i<3;i++){label(['Drive limit','Grip limit','Cut load'][i],0,.22-i*.46,1.4);kit.box([2.5,.025,.04],[0,-i*.46,0],'metal',forceGuide);bars.push(kit.box([2.5,.11,.065],[0,-i*.46,.025],['blue','leaf','clay'][i],forceGuide));}

 const handArrow=new THREE.ArrowHelper(new THREE.Vector3(0,1,0),new THREE.Vector3(1,0,.45),.8,0x397689,.1,.06);crank.add(handArrow);
 const clampArrows=[-1,1].map(side=>{const a=new THREE.ArrowHelper(new THREE.Vector3(0,-side,0),new THREE.Vector3(-.5,side*.7,.85),.3,0x6c8959,.09,.05);head.add(a);return a;});
 const cutArrow=new THREE.ArrowHelper(new THREE.Vector3(-1,0,0),new THREE.Vector3(.65,.07,.18),.5,0xc16c45,.09,.05);head.add(cutArrow);
 const status=kit.sphere(.075,[-.45,-.06,.13],'leaf',head);status.material=status.material.clone();
 for(const guide of [handArrow,...clampArrows,cutArrow,status])guide.userData.explosionExcluded=true;
 const specs={
  clamp:['Handle position','',[{value:0,label:'Open'},{value:1,label:'Clamped'}],'Open the handles to disengage the feed wheel and the spur gears.'],
  normal:['Clamp normal force','N',null,'Traction capacity is 0.35 times this force in the teaching model. Compare the green bar with the orange cutting load.'],
  effort:['Available hand force','N',null,'This is the greatest tangential force your hand will supply, not a force consumed when no load needs it. Zero force stops the crank.'],
  arm:['Crank radius','cm',null,'A longer crank provides more torque from the same available hand force. Your hand travels farther each turn.'],
  edge:['Cutting edge','',[{value:0,label:'Sharp: 12 N resistance'},{value:1,label:'Dull: 28 N resistance'}],'A broader bevel raises the assumed total rim resistance from 12 to 28 N. These are teaching loads, not measured ratings.'],
  diameter:['Can diameter','mm',null,'A larger can has more rim to cut and needs more crank turns, even though the required force is unchanged.']
 };
 for(const [key,[min,max,step]] of Object.entries(CAN_OPENER_DOMAINS)){const [label,unit,options,help]=specs[key];control(key,label,min,max,step,D[key],unit,help,options);}
 let elapsed=0,lastClock=0,disposed=false;const fmt=(n,digits=2)=>String(Number(n.toFixed(digits)));
 const result=finish(v=>{
  const s=sampleCanOpener(v,elapsed),radius=s.canRadius*30;
  can.rotation.y=s.canAngle;shell.scale.set(radius,1,radius);bottom.scale.set(radius,1,radius);canBands.forEach(m=>m.scale.set(radius,radius,1));rimMesh.scale.set(radius,radius,1);seamMarker.position.z=radius+.014;
  lidMesh.scale.set(radius-.055,1,radius-.055);lidRings.forEach(m=>m.scale.set(radius,radius,1));lidMark.position.z=radius*.45;lid.position.y=s.lidLift*.68;lid.rotation.x=s.lidLift*.12;
  const withdrawal=s.clamped?s.openerWithdrawal:1;head.position.set(0,.18*withdrawal,radius+.12*withdrawal);movingHandle.rotation.z=.38*withdrawal;
  crank.rotation.z=driverGear.rotation.z=cutter.rotation.z=s.driverAngle;drivenGear.rotation.z=feed.rotation.z=s.feedAngle;
  const crankRadius=s.armRadius*30;crankArm.scale.y=crankRadius;crankArm.position.x=crankRadius/2;grip.position.x=crankRadius;handArrow.position.x=crankRadius;handArrow.visible=v.effort>0;handArrow.setLength(.15+v.effort*.055,.09,.055);
  cutterFaces.forEach((m,i)=>m.visible=i===v.edge);
  const inner=radius-.055,outer=radius-.015,remainingAngle=s.lidReleased?0:2*Math.PI-s.canAngle;
  for(let i=0;i<192;i++){
   const a=i*remainingAngle/192,b=(i+1)*remainingAngle/192;
   const points=[[inner*Math.sin(a),-.0125,inner*Math.cos(a)],[outer*Math.sin(a),0,outer*Math.cos(a)],[outer*Math.sin(b),0,outer*Math.cos(b)],[inner*Math.sin(a),-.0125,inner*Math.cos(a)],[outer*Math.sin(b),0,outer*Math.cos(b)],[inner*Math.sin(b),-.0125,inner*Math.cos(b)]];
   points.forEach((p,j)=>seamPositions.set(p,i*18+j*3));
  }
  seamGeometry.attributes.position.needsUpdate=true;seamGeometry.computeVertexNormals();seamGeometry.computeBoundingBox();seamGeometry.computeBoundingSphere();metalBridge.visible=!s.lidReleased;
  for(let i=0;i<=192;i++){const a=-s.canAngle*i/192;cutPositions.set([(radius-.035)*Math.sin(a),.012,(radius-.035)*Math.cos(a)],i*3);}
  cutGeometry.attributes.position.needsUpdate=true;cutGeometry.computeBoundingBox();cutGeometry.computeBoundingSphere();cutLine.visible=s.cutLength>0;
  [s.driveForceAvailable,s.tractionCapacity,s.cuttingResistance].forEach((value,i)=>{const fraction=value/100;bars[i].scale.x=Math.max(.00001,fraction);bars[i].position.x=-1.25+1.25*fraction;bars[i].visible=value>0;});
  clampArrows.forEach(a=>{a.visible=s.clamped&&!s.lidReleased&&v.normal>0;a.setLength(.18+v.normal*.002,.09,.05);});cutArrow.visible=s.clamped&&!s.lidReleased;cutArrow.setLength(.2+s.cuttingResistance*.018,.09,.05);
  status.material.color.set(s.mode==='stall'?0xbd4e37:s.mode==='slip'?0xe6ab36:s.mode==='open'?0x819aa0:0x75a767);
  const outcomes={open:v.effort?'The upper shaft turns unloaded. The separated lower gear and feed wheel do not advance the can.':'The handles are open and no hand force is available. Nothing turns.',stall:v.effort?'The hand-force limit cannot overcome the active load. The crank stalls and no cut advances.':'Zero available hand force: the crank and can remain still.',slip:'The feed wheel turns, but insufficient grip lets it slip. The can stays still and the lid remains attached.',cutting:'The grip and available torque both meet the cutting load. The rim advances under the cutter.',released:s.openerWithdrawal<1?'The entire circumference is cut. The opener is unclamped and withdrawn before the free lid is lifted for inspection.':'The opener is clear. The free lid is lifted for inspection; this sequence represents separate manual removal.'};
  return {state:s,readings:[
   reading('Outcome',outcomes[s.mode],'Both drive and grip must meet the cutting load. A spinning crank alone does not prove that the can is opening.'),
   reading('Lid connection',s.lidReleased?'Fully separated':'Still attached','Only a complete circuit releases the lid. The final lift illustrates separate manual removal.'),
   reading('Available rim force',fmt(s.driveForceAvailable)+' N','Blue bar: hand-force limit × crank radius ÷ 10 mm feed radius, through equal gears. This is capacity, not force consumed.'),
   reading('Traction capacity',fmt(s.tractionCapacity)+' N','Green bar: 0.35 × clamp normal force when clamped. Insufficient grip lets the feed wheel slide beneath the rim.'),
   reading('Cutting resistance',fmt(s.cuttingResistance)+' N','Orange bar: assumed 12 N sharp-edge or 28 N dull-edge load. These teaching loads are not measured tool ratings.'),
   reading('Hand force needed for cutting',fmt(s.requiredHandForce)+' N','Cutting load × feed radius ÷ crank radius. This force can sustain a cut only when contact also supplies enough grip.'),
   reading('Actual hand force while turning',fmt(s.actualHandForce)+' N','The moving load uses only the force it needs. This becomes zero when turning stops; it does not measure a stationary hand squeeze.'),
   reading('Opening progress',fmt(s.cutFraction*100,1)+' %','Fraction of the complete cutting circuit. Stalling, slipping, or opening the handles prevents further cutting in this resampled trial.'),
   reading('Crank turns',fmt(s.crankTurns)+' of '+fmt(s.turnsRequired)+' needed','Turns so far compared with the no-slip requirement. A slipping or disconnected crank can exceed the required count without cutting.'),
   reading('Rim travel through cut',fmt(s.cutLength*1000,1)+' of '+fmt(s.circumference*1000,1)+' mm','Cut travel compared with the rim circumference. Diameter increases the distance, while the feed radius stays fixed.'),
   reading('Available crank torque',fmt(s.torqueAvailable)+' N m','Available hand force × crank radius in meters. A longer arm raises torque capacity at the same force limit.'),
   reading('Hand travel',fmt(s.handTravel)+' m','Crank angle × crank radius. A longer handle trades greater travel for lower force, not less work.'),
   reading('Input work',fmt(s.workInput,3)+' J','Actual turning torque × crank angle. In this ideal model it equals cutting work plus sliding work, without bearing losses.'),
   reading('Cutting work',fmt(s.cuttingWork,3)+' J','Assumed cutting resistance × cut travel. The same can and edge need the same cutting work with a short or long crank.'),
   reading('Sliding work',fmt(s.slidingWork,3)+' J','Traction force × feed-wheel travel during slip. This energy is dissipated without extending the cut.'),
   reading('Trial time',fmt(elapsed)+' s','A 16-second trial with an attempted half-turn per second. Elapsed time alone never releases the lid.'),
  ]};
 });
 const render=result.update;result.advance=dt=>{if(Number.isFinite(dt)&&dt>0)elapsed=Math.min(C.duration,elapsed+dt);return render();};
 result.animate=t=>{const dt=Number.isFinite(t)?Math.max(0,t-lastClock):0;if(Number.isFinite(t))lastClock=t;return result.advance(dt);};
 result.reset=()=>{elapsed=lastClock=0;return render(result.defaults);};
 result.actions=[['Inspect start (0%)',0],['Inspect quarter (25%)',.25],['Inspect three quarters (75%)',.75],['Inspect result (100%)',1]].map(([label,p])=>({label,part:'system',view:'front',replay:false,run(){elapsed=C.duration*p;return render();}}));
 result.playback={label:'Turn the can opener',description:'The hand attempts half a crank turn per second, within the available force limit. Watch the wheel stall, slip, or cut. The 16-second trial can finish with an attached lid. After a full cut, the opener withdraws before the free lid is lifted to illustrate manual removal.',stepLabel:'Advance the can opener by one percent of the trial',advance:result.advance,step:()=>result.advance(C.duration/100),complete:()=>elapsed>=C.duration,blocked:()=>false};
 result.resultPart={id:'lid',label:'Inspect the lid',view:'front',focusOnComplete:false,available:()=>result.getState().lidReleased};
 result.frameBoundsForPart=id=>{
  if(!['system','crank','transmission','clamp-head'].includes(id))return null;
  const s=result.getState(),radius=s.canRadius*30,arm=s.armRadius*30,arrow=s.values.effort>0?.15+s.values.effort*.055:0,sweep=Math.max(arm+.095,Math.hypot(arm,arrow)+.06);
  root.updateWorldMatrix(true,false);return new THREE.Box3(new THREE.Vector3(-sweep,.28-sweep,radius-.08),new THREE.Vector3(sweep,.46+sweep,radius+1.46)).applyMatrix4(root.matrixWorld);
 };
 root.rotation.set(.35,-.5,0);result.initialPart='system';result.initialView='front';result.frameVisibleOnly=true;result.framePadding=.6;result.autoFramePart='system';result.selectionOutline=false;result.transparentBackground=true;
 result.catalogParts=result.parts.filter(p=>['body','rim','lid','fixed-handle','hinge','crank','driver-gear','cutting-wheel','moving-handle','driven-gear','feed-wheel'].includes(p.id));
 result.topology={forceGuide,labels,system,can,body,shell,bottom,rim,rimMesh,lid,lidMesh,cutSeam,metalBridge,cutLine,head,fixedHandle,movingHandle,hinge,transmission,crank,crankArm,grip,driverGear,driverMesh,drivenGear,drivenMesh,feed,feedMesh,feedTeeth,cutter,cutterFaces,upperBearing,lowerBearing,upperShaft,lowerShaft,feedStripe,cutterStripe,bars,handArrow,clampArrows,cutArrow,status,scale:30,gearPitchRadius:.31,feedEffectiveRadius:.3,closedGearSeparation:.62};
 const dispose=result.dispose;result.dispose=()=>{if(!disposed){disposed=true;dispose();textures.forEach(t=>t.dispose());}};return result;
}

import * as THREE from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {houseModel,reading as r} from './house-model-kit.js';

export function createElectromagnetModel(){
 const m=houseModel('Electromagnet'),{part,box,cylinder,disk,ring,rod,tube,control,finish}=m;
 const tau=Math.PI*2,mu0=4e-7*Math.PI,turns=200,centralArea=Math.PI*.015**2,returnArea=Math.PI*(.04**2-.03**2);
 const inverseAreas=1/centralArea+1/returnArea,coreReluctance=.15/(mu0*1000*centralArea),residualGap=.0002,captureGap=.003;
 const scale=25,initialGap=.002,loadThickness=.008,trayTop=.15,magnetRestY=trayTop+(loadThickness+initialGap)*scale;
 const step=.00005,driverTime=.025,clockScale=.1,gravity=9.81;
 const system=part('system','Electromagnet, hoist and load','Energize the pot-shaped magnet, capture the iron plate through a narrow gap, lift it, and switch off to release it.');
 const gantry=part('gantry','Supported bench gantry','The frame carries the winch and its suspension cable. The current source supplies the magnet separately.',[0,0,0],system);
 for(const x of [-1.48,1.48]){box([.15,3.45,.2],[x,1.8,-.35],'wood',gantry);box([.5,.13,.65],[x,.085,-.35],'ink',gantry);}
 box([3.15,.18,.28],[0,3.45,-.35],'wood',gantry);box([1.3,.08,.1],[0,3.2,-.35],'ink',gantry);for(const x of [-.55,.55])rod([x,3.24,-.35],[x,3.36,-.35],.025,'metal',gantry);
 const tray=part('tray','Receiving tray','Supports the sample before pickup and catches it after release. The load has no horizontal motion in this experiment.',[0,0,0],system);
 box([2.6,.15,2.6],[0,.075,0],'leaf',tray);
 for(const x of [-1.28,1.28])box([.04,.12,2.6],[x,.2,0],'leaf',tray);
 for(const z of [-1.28,1.28])box([2.6,.12,.04],[0,.2,z],'leaf',tray);
 const hoist=part('hoist','Powered vertical hoist','A prescribed, acceleration-limited winch raises the magnet after the plate actually reaches it.',[0,0,0],gantry);
 box([.55,.34,.35],[0,3.26,-.3],'cream',hoist);rod([0,3.36,-.35],[0,3.36,.05],.05,'metal',hoist);
 const drum=part('drum','Cable drum','The suspension cable is paid out or wound in as the hoist height changes.',[0,3.27,.025],hoist);
 cylinder(.15,.2,[0,0,0],'ink',drum).rotation.x=Math.PI/2;disk(.18,.035,[0,0,.12],'gold',drum);disk(.18,.035,[0,0,-.12],'gold',drum);
 const cable=part('cable','Suspension cable','The upper end enters the winch; the lower end stays connected to the lifting eye.',[0,0,0],hoist);
 const suspension=cylinder(.016,1,[0,0,0],'ink',cable);
 const magnet=part('magnet','Suspended pot electromagnet','The center pole and annular outer pole share an iron return path. A current-carrying annular winding magnetizes them.',[0,magnetRestY,0],system);
 const core=part('core','Connected iron core and casing','The top bridge connects the center pole to the surrounding steel casing.',[0,0,0],magnet);
 const central=part('central-pole','Central iron pole','Its circular lower face carries the same total flux as the larger annular outer face.',[0,0,0],core);
 const centerMesh=cylinder(.375,.87,[0,.44,0],'metal',central);
 const outerPole=part('outer-pole','Annular outer pole and casing','The outer ring returns the magnetic flux to the top bridge. Its front half is removed in the cutaway.',[0,0,0],core);
 const outerProfile=[new THREE.Vector2(.75,.005),new THREE.Vector2(1,.005),new THREE.Vector2(1,1.075),new THREE.Vector2(.75,1.075),new THREE.Vector2(.75,.005)];
 const outerMeshes=[];
 for(const front of [true,false]){const shell=new THREE.Mesh(new THREE.LatheGeometry(outerProfile,64,front?-Math.PI/2:Math.PI/2,Math.PI),new THREE.MeshToonMaterial({color:0xb4c5b0,side:THREE.DoubleSide}));outerPole.add(shell);outerMeshes.push(shell);if(front)m.covers.push(shell);}
 const bridge=part('bridge','Iron top bridge','This plate closes the magnetic return path and supports the lifting eye and insulated terminals.',[0,0,0],core);
 for(const front of [true,false]){
  const shape=new THREE.Shape();shape.moveTo(1,0);shape.absarc(0,0,1,0,Math.PI,front);shape.closePath();
  if(front)for(const x of [-.55,.55]){const hole=new THREE.Path();hole.absarc(x,-.07,.055,0,tau,true);shape.holes.push(hole);}
  const geometry=new THREE.ExtrudeGeometry(shape,{depth:.2,bevelEnabled:false,curveSegments:48});geometry.rotateX(-Math.PI/2);
  const plate=new THREE.Mesh(geometry,new THREE.MeshToonMaterial({color:0xb4c5b0,side:THREE.DoubleSide}));plate.position.y=.875;bridge.add(plate);if(front)m.covers.push(plate);
 }
 const eye=part('lifting-eye','Lifting eye','Bolted into the top bridge and permanently connected to the cable.',[0,0,0],magnet);
 rod([0,1.06,0],[0,1.105,0],.035,'metal',eye);ring(.08,.016,[0,1.17,0],'gold',eye);
 const shackle=part('shackle','Pinned cable shackle','The transverse pin bears against the inside of the lifting eye; two side straps connect it to the cable ferrule.',[0,0,0],eye);
 for(const z of [-.06,.06])rod([0,1.214,z],[0,1.34,z],.015,'metal',shackle);rod([0,1.214,-.075],[0,1.214,.075],.02,'ink',shackle);rod([0,1.34,-.06],[0,1.34,.06],.02,'metal',shackle);cylinder(.028,.08,[0,1.36,0],'metal',shackle);
 const spacer=part('surface-spacer','Thin nonmagnetic contact layer','An illustrative 0.2 mm protective layer keeps the modeled magnetic gap positive even when the load reaches the face.',[0,0,0],magnet);
 cylinder(1,residualGap*scale,[0,residualGap*scale/2,0],'cream',spacer);
 const coilPlate=part('coil-plate','Nonmagnetic coil plate','Supports and protects the winding without joining the center and outer magnetic poles.',[0,0,0],magnet);
 const annulus=(inner,outer,bottom,top,parent,color,cutaway=false)=>{
  const profile=[[inner,bottom],[outer,bottom],[outer,top],[inner,top],[inner,bottom]].map(([x,y])=>new THREE.Vector2(x,y));
  for(const front of [true,false]){const object=new THREE.Mesh(new THREE.LatheGeometry(profile,48,front?-Math.PI/2:Math.PI/2,Math.PI),new THREE.MeshToonMaterial({color,side:THREE.DoubleSide}));parent.add(object);if(cutaway&&front)m.covers.push(object);}
 };
 annulus(.38,.748,.005,.09,coilPlate,0xf0dfaf,true);
 const winding=part('coil','200-turn annular coil','Ten layers of twenty connected turns surround the center pole. Front half-turns are hidden only for the cutaway.',[0,0,0],magnet);
 const windingHalves=[[],[]],windingPaths=[];let windingMaterial;
 for(let layer=0;layer<10;layer++){
  const radius=.415+layer*.031;const upward=layer%2===0;
  for(let half=0;half<40;half++){
   const points=[];for(let j=0;j<=12;j++){const progress=(half+j/12)/40,angle=progress*20*tau;points.push([radius*Math.cos(angle),.12+.69*(upward?progress:1-progress),radius*Math.sin(angle)]);}
   const segment=tube(points,.0075,'clay',winding);windingMaterial=segment.material;windingPaths.push(segment.geometry.parameters.path);windingHalves[half%2].push(segment.geometry);winding.remove(segment);
  }
  if(layer<9){const y=upward?.81:.12;rod([radius,y,0],[radius+.031,y,0],.0075,'clay',winding);}
 }
 for(const [index,geometries] of windingHalves.entries()){const merged=new THREE.Mesh(mergeGeometries(geometries),windingMaterial);merged.userData.windingPaths=windingPaths.filter((_,i)=>i%2===index);winding.add(merged);if(index===0)m.covers.push(merged);geometries.forEach(geometry=>geometry.dispose());}
 const terminals=part('terminals','Insulated coil terminals','Two insulated feedthroughs pass through holes in the iron top bridge. Both wires remain connected while the magnet moves.',[0,0,0],magnet);
 for(const x of [-.55,.55]){
  const sleeve=part(x<0?'negative-terminal':'positive-terminal',x<0?'Return terminal':'Outgoing terminal','An insulating sleeve separates this live connection from the iron casing.',[x,0,.07],terminals);
  annulus(.03,.052,.855,1.12,sleeve,0xf0dfaf);annulus(.03,.075,1.075,1.105,sleeve,0xf0dfaf);cylinder(.025,.08,[0,1.14,0],'gold',sleeve);
 }
 const internalLeads=part('internal-leads','Connected winding ends','The inner and outer winding ends pass around the core and through the insulated terminals.',[0,0,0],winding);
 tube([[.415,.12,0],[.394,.12,0],[.394,.845,0],[.55,.845,.07],[.55,1.18,.07]],.006,'clay',internalLeads);
 const outerLead=[[.694,.12,0],[.728,.12,0],[.728,.845,0]];for(let i=1;i<=16;i++){const a=i*Math.PI/16;outerLead.push([.728*Math.cos(a),.845,-.728*Math.sin(a)]);}outerLead.push([-.55,.845,.07],[-.55,1.18,.07]);tube(outerLead,.006,'ink',internalLeads);
 const supply=part('supply','Regulated current source','An idealized powered bench unit drives the chosen current in either direction. It is not modeled as a fixed-inductance voltage circuit.',[-2.05,.65,0],system);
 box([1,.95,.6],[0,0,0],'cream',supply);for(const x of [-.35,.35])box([.14,.17,.48],[x,-.56,0],'ink',supply);box([.68,.22,.035],[0,.22,.315],'ink',supply);
 const gauge=[];for(let i=0;i<6;i++)gauge.push(box([.065,.13,.025],[-.24+i*.095,.22,.34],'leaf',supply));
 const knob=part('current-knob','Current-setting dial','Requests the coil current; the regulated driver approaches it with a 25 ms illustrative response time.',[.23,-.12,.345],supply);disk(.13,.07,[0,0,0],'ink',knob);rod([0,0,.05],[0,.085,.05],.013,'cream',knob);
 const switchPart=part('supply-switch','Supply output switch','Lift energizes the output; Release switches it off. Reset starts with no current.',[-.23,-.12,.345],supply);const lever=box([.11,.2,.06],[0,0,0],'clay',switchPart);
 for(const x of [-.22,.22])disk(.055,.04,[x,-.32,.33],x>0?'clay':'ink',supply);
 const wires=part('wires','Complete supply and return wiring','One conductor goes to the inner winding end; the other returns from the outer end to the current source.',[0,0,0],system);
 for(const side of [-1,1]){
  tube([[-2.05+side*.22,.33,.35],[-1.75+side*.04,.45,.35],[-1.63+side*.04,1.2,-.45],[-1.63+side*.04,3.2,-.45],[side*.55,3.2,.07]],.012,side>0?'clay':'ink',wires);
  rod([side*.55,3.2,-.35],[side*.55,3.2,.07],.03,'cream',gantry);
 }
 const flex=part('flex-leads','Flexible service loops','Fixed-length wires bow outward as the hoist rises. Their ends remain seated in the fixed and moving terminals.',[0,0,0],wires);
 const flexMeshes=[],leadLength=1.9;let lastWireHeight=NaN,wireSpan=0,wireBow=0;
 function leadCurve(side,bow){const top=3.2,bottom=magnetRestY+hoistY*scale+1.18,d=top-bottom;return new THREE.CubicBezierCurve3(new THREE.Vector3(side*.55,top,.07),new THREE.Vector3(side*.55,top-d/3,.07+bow),new THREE.Vector3(side*.55,bottom+d/3,.07+bow),new THREE.Vector3(side*.55,bottom,.07));}
 function updateLeadGeometry(geometry,curve){
  // Keep GPU buffers stable while the exact curve endpoints follow the moving terminals.
  geometry.parameters.path=curve;const frames=curve.computeFrenetFrames(64,false),position=geometry.attributes.position,normal=geometry.attributes.normal;
  const point=new THREE.Vector3(),radial=new THREE.Vector3();
  for(let i=0;i<=64;i++){curve.getPointAt(i/64,point);for(let j=0;j<=8;j++){const angle=j/8*tau;radial.copy(frames.normals[i]).multiplyScalar(-Math.cos(angle)).addScaledVector(frames.binormals[i],Math.sin(angle)).normalize();const index=i*9+j;normal.setXYZ(index,radial.x,radial.y,radial.z);position.setXYZ(index,point.x+.012*radial.x,point.y+.012*radial.y,point.z+.012*radial.z);}}
  position.needsUpdate=normal.needsUpdate=true;if(geometry.boundingBox)geometry.computeBoundingBox();if(geometry.boundingSphere)geometry.computeBoundingSphere();
 }
 const load=part('load','Practice load plate','Only the iron setting is ferromagnetic here. The mass setting changes weight while this illustrative plate size stays fixed.',[0,trayTop+loadThickness*scale/2,0],system);
 const loadMesh=cylinder(1.125,loadThickness*scale,[0,0,0],'metal',load);loadMesh.material=loadMesh.material.clone();
 const field=part('field','Pole and flux-direction indicators','Arrows show the direction of a closed magnetic path, not a calculated field map. The magnet remains energized with a nonmagnetic load.',[0,0,0],magnet);
 const centerArrow=new THREE.ArrowHelper(new THREE.Vector3(0,-1,0),new THREE.Vector3(0,.74,.39),.45,0x83b4c1,.09,.045),returnArrow=new THREE.ArrowHelper(new THREE.Vector3(0,1,0),new THREE.Vector3(.88,.22,.1),.45,0xe3b45e,.09,.045);field.add(centerArrow,returnArrow);
 const forces=part('forces','Forces on the load','Magnetic attraction acts upward. Weight and any solid-contact reaction act downward. Arrow lengths use one shared force scale.',[0,0,0],system);
 const magneticArrow=new THREE.ArrowHelper(new THREE.Vector3(0,1,0),new THREE.Vector3(),.4,0x83b4c1,.08,.04),weightArrow=new THREE.ArrowHelper(new THREE.Vector3(0,-1,0),new THREE.Vector3(),.4,0xce825f,.08,.04),reactionArrow=new THREE.ArrowHelper(new THREE.Vector3(0,-1,0),new THREE.Vector3(),.4,0xe3b45e,.08,.04);forces.add(magneticArrow,weightArrow,reactionArrow);
 control('operation','Run action',0,1,1,0,'','Lift first energizes the magnet and captures the plate. Release switches off while preserving the hoist position.',[{value:0,label:'Energize and lift'},{value:1,label:'Switch off and release'}]);
 control('current','Current setting',0,3,.1,2,'A','The regulated current approaches this setting only while the lift operation is powered.');
 control('polarity','Current direction',-1,1,2,1,'','Reversing an established current passes through zero; equal steady magnitudes attract iron equally.',[{value:1,label:'Normal polarity'},{value:-1,label:'Reversed polarity'}]);
 control('material','Load material',0,1,1,0,'','The nonmagnetic sample feels no ferromagnetic lifting force in this model.',[{value:0,label:'Iron'},{value:1,label:'Nonmagnetic'}]);
 control('mass','Load mass',.1,2,.1,.5,'kg','Changes weight, not the illustrative geometry or a rated lifting capacity.');
 control('height','Hoist target',0,50,1,40,'mm','A target for the powered hoist, not a direct position change. Zero still allows pickup across the initial 2 mm gap.');
 let current=0,loadY=0,loadVelocity=0,hoistY=0,hoistVelocity=0,hoistAcceleration=0,elapsed=0,actionTime=0,accumulator=0,lastClock=0,stage='ready',complete=false,blocked=false,held=false,captured=false,releaseHeight=0;
 function magnetic(v,separation=Math.max(0,initialGap+hoistY-loadY)){const gap=separation+residualGap,valid=separation<=captureGap+1e-10,weight=v.mass*gravity;
  const flux=v.material===0&&valid?Math.min(1.4*centralArea,Math.abs(turns*current)/(coreReluctance+gap/mu0*inverseAreas)):0;
  const force=flux*flux/(2*mu0)*inverseAreas;return {separation,gap,valid,weight,flux,force,required:v.mass*(gravity+hoistAcceleration)};
 }
 const result=finish(v=>{
  const fieldState=magnetic(v),contact=fieldState.separation<1e-9;
  held=contact&&v.material===0&&fieldState.force>=Math.max(0,fieldState.required)&&stage!=='ready';
  const reaction=held?Math.max(0,fieldState.force-fieldState.required):0,powered=stage!=='ready'&&v.operation===0;
  magnet.position.y=magnetRestY+hoistY*scale;load.position.y=trayTop+(loadThickness/2+loadY)*scale;loadMesh.material.color.setHex(v.material===0?0xb4c5b0:0xae8056);
  const cableTop=3.2,cableBottom=magnet.position.y+1.39;suspension.scale.y=cableTop-cableBottom;suspension.position.set(0,(cableTop+cableBottom)/2,0);drum.rotation.z=hoistY*scale/.15;
  if(lastWireHeight!==hoistY){lastWireHeight=hoistY;let low=0,high=2;for(let i=0;i<26;i++){const bow=(low+high)/2;if(leadCurve(1,bow).getLength()>leadLength)high=bow;else low=bow;}wireBow=(low+high)/2;wireSpan=3.2-(magnet.position.y+1.18);
   for(let i=0;i<2;i++){const curve=leadCurve(i?1:-1,wireBow);if(flexMeshes[i])updateLeadGeometry(flexMeshes[i].geometry,curve);else{const geometry=new THREE.TubeGeometry(curve,64,.012,8,false);const mesh=new THREE.Mesh(geometry,new THREE.MeshToonMaterial({color:i?0xce825f:0x374736}));flex.add(mesh);flexMeshes.push(mesh);}}
  }
  knob.rotation.z=-v.current/3*Math.PI*1.5;lever.rotation.x=powered?-.25:.25;gauge.forEach((segment,i)=>segment.visible=Math.abs(current)>i*.5+.02);
  const sign=current<0?-1:1;field.visible=Math.abs(current)>.005;centerArrow.setDirection(new THREE.Vector3(0,-sign,0));returnArrow.setDirection(new THREE.Vector3(0,sign,0));
  const forceScale=.75/Math.max(fieldState.force,fieldState.weight,reaction);for(const [arrow,value,x] of [[magneticArrow,fieldState.force,1.29],[weightArrow,fieldState.weight,1.46],[reactionArrow,reaction,1.63]]){arrow.visible=value>1e-8;arrow.position.set(x,load.position.y,1.0);const length=Math.max(1e-8,value*forceScale);arrow.setLength(length,Math.min(.08,length*.35),Math.min(.045,length*.22));}
  const falling=!held&&loadY>1e-8,hoistAtTarget=Math.abs(hoistY-v.height*.001)<1e-5&&Math.abs(hoistVelocity)<1e-4;
  const status=stage==='ready'?'Ready · plate rests in the tray':complete&&v.operation===1?'Released · plate rests in the tray':complete&&held?'Lifted · plate held above the tray':blocked?(v.material===1?'No lift · nonmagnetic load':!fieldState.valid?'No pickup · load outside the modeled capture gap':'No lift · attraction cannot raise this load'):falling?'Load detached · gravity moves it toward the tray':held?'Plate captured · hoist moving to its target':loadY>0?'Plate rising across the gap':'Current building · testing attraction against weight';
  return {state:{current,loadY,loadVelocity,hoistY,hoistVelocity,hoistAcceleration,elapsed,stage,complete,blocked,held,contact,captured,falling,powered,force:fieldState.force,weight:fieldState.weight,requiredForce:fieldState.required,normalReaction:reaction,gap:fieldState.gap,separation:fieldState.separation,forceValid:fieldState.valid,magneticCircuitValid:fieldState.valid&&v.material===0,flux:fieldState.valid&&v.material===0?fieldState.flux:null,centralFluxDensity:fieldState.valid&&v.material===0?fieldState.flux/centralArea:null,returnFluxDensity:fieldState.valid&&v.material===0?fieldState.flux/returnArea:null,loadHeight:loadY,hoistHeight:hoistY,hoistAtTarget,leadLength,wireSpan,wireBow,currentDirection:Math.abs(current)<.005?0:sign},readings:[r('Your result',status),r('Coil current',`${current.toFixed(2)} A`,'Regulated driver response; sign sets polarity.'),r('Magnetic attraction',v.material===1?'0 N · no ferromagnetic load':fieldState.valid?`${fieldState.force.toFixed(2)} N`:'Not estimated beyond the 3 mm capture gap'),r('Load weight',`${fieldState.weight.toFixed(2)} N`),r('Required lifting force',`${fieldState.required.toFixed(2)} N`,'Includes the prescribed hoist acceleration when in contact.'),r('Magnetic gap',`${(fieldState.gap*1000).toFixed(3)} mm`,'Includes the 0.2 mm nonmagnetic surface layer.'),r('Pole direction',Math.abs(current)<.005?'Unenergized · remanence omitted':sign>0?'Center N · outer ring S':'Center S · outer ring N'),r('Load above tray',`${(loadY*1000).toFixed(2)} mm`),r('Hoist travel',`${(hoistY*1000).toFixed(2)} / ${v.height} mm`),r('Model limit','Narrow-gap teaching model, not a lifting rating','Uniform fields, capped flux density, idealized contacts, no fringing, hysteresis or eddy-current model.')]};
 });
 const render=result.update;
 result.update=next=>{const before=result.getState().values;render(next);const after=result.getState().values;if(Object.keys(after).some(key=>before[key]!==after[key])){complete=false;blocked=false;actionTime=0;if(before.operation!==after.operation&&after.operation===1)releaseHeight=hoistY;}return render();};
 function advance(seconds){if(!Number.isFinite(seconds)||seconds<=0||complete||blocked)return render();if(stage==='ready'){stage='running';releaseHeight=hoistY;}const v=result.getState().values;accumulator+=seconds*clockScale;
  while(accumulator>=step-1e-13&&!complete&&!blocked){accumulator-=step;elapsed+=step;actionTime+=step;const targetCurrent=v.operation===0?v.current*v.polarity:0;current+=(targetCurrent-current)*(1-Math.exp(-step/driverTime));
   const wasContact=Math.abs(loadY-(initialGap+hoistY))<1e-10;
   const targetHeight=v.operation===1?releaseHeight:captured?v.height*.001:hoistY;
   hoistAcceleration=Math.max(-.8,Math.min(.8,400*(targetHeight-hoistY)-40*hoistVelocity));const nextVelocity=Math.max(-.1,Math.min(.1,hoistVelocity+hoistAcceleration*step));hoistAcceleration=(nextVelocity-hoistVelocity)/step;hoistY+=hoistVelocity*step+.5*hoistAcceleration*step*step;hoistVelocity=nextVelocity;
   if(hoistY<0){hoistY=0;hoistVelocity=0;}if(hoistY>.05){hoistY=.05;hoistVelocity=0;}
   const fieldState=magnetic(v,wasContact?0:undefined),ceiling=initialGap+hoistY,supports=fieldState.force>=Math.max(0,fieldState.required)&&v.material===0;
   if(wasContact&&supports){loadY=ceiling;loadVelocity=hoistVelocity;held=true;captured=true;}
   else{held=false;loadVelocity+=(fieldState.force/v.mass-gravity)*step;loadY+=loadVelocity*step;if(loadY>=ceiling){loadY=ceiling;loadVelocity=hoistVelocity;if(supports){held=true;captured=true;}}if(loadY<=0){loadY=0;loadVelocity=0;}}
   const settledCurrent=Math.abs(current-targetCurrent)<.001,atTarget=Math.abs(hoistY-targetHeight)<1e-5&&Math.abs(hoistVelocity)<1e-4;
   complete=v.operation===1?loadY===0&&Math.abs(current)<.001&&atTarget:held&&atTarget&&settledCurrent;
   blocked=v.operation===0&&!held&&loadY===0&&actionTime>.25&&settledCurrent&&(!captured||atTarget);
   if(complete||blocked){
    // Settle within the integration tolerance at a genuinely static endpoint, preserving face contact.
    if(complete){hoistY=targetHeight;hoistVelocity=hoistAcceleration=0;if(held){loadY=initialGap+hoistY;loadVelocity=0;}}
    stage=complete?'finished':'blocked';accumulator=0;
   }
  }return render();
 }
 function fresh(){current=loadY=loadVelocity=hoistY=hoistVelocity=hoistAcceleration=elapsed=actionTime=accumulator=lastClock=0;stage='ready';complete=blocked=held=captured=false;releaseHeight=0;lastWireHeight=NaN;}
 result.advance=advance;result.animate=clock=>{if(!Number.isFinite(clock))return render();const delta=Math.max(0,clock-lastClock);lastClock=clock;return advance(delta);};
 result.reset=()=>{fresh();return render(result.defaults);};
 result.actions=[{label:'Return load to starting tray',part:'system',view:'front',run:()=>{fresh();return render({operation:0});}}];
 result.playback={label:'Run selected action',stepLabel:'Advance one step',description:'Energize and lift captures the load before raising the hoist. Switch off and release lets gravity return it to the tray. Motion and the current driver are slowed ten times.',advance,step:()=>advance(.05),complete:()=>complete,blocked:()=>blocked};
 result.followParts=['magnet','central-pole','outer-pole','coil','coil-plate','load','cable','flex-leads','field','forces'];
 result.framingBounds=new THREE.Box3().setFromObject(result.root);result.framingBounds.expandByPoint(new THREE.Vector3(1.8,3.6,1.4));
 result.resultPart={id:'system',context:'system',view:'front',focusOnComplete:true,label:'Inspect the magnet and load',available:()=>true};return result;
}

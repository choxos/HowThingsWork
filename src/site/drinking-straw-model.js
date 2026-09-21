import * as THREE from 'three';
import {houseModel, reading as r} from './house-model-kit.js';
import {fixed} from './format.js';
import {surface, solidArrow} from './scene-kit.js';
import {sampleStraw, strawPlan, DRINKS, STRAW, STRAW_DEFAULTS as D, STRAW_DOMAINS} from './drinking-straw-physics.js';

const MM = .01, M = 1000 * MM, KPA = 5 * MM, SLOW = .1;
const GLASS = {radius: 40, height: 140, wall: 2, level: 120}, STRAW_X = 12, BOTTOM = STRAW.bottom * 1000;
const COLORS = [0x599db5, 0xd79a43, 0xc0a27e, 0xa36a7e];
const circle = (radius, start = 0, span = Math.PI * 2) => {const s = new THREE.Shape();s.absarc(0, 0, radius, start, start + span, false);return s;};
function annulus(inner, outer, height, start = 0, span = Math.PI * 2) {
  const shape = new THREE.Shape();shape.absarc(0, 0, outer * MM, start, start + span, false);shape.absarc(0, 0, inner * MM, start + span, start, true);shape.closePath();
  const g = new THREE.ExtrudeGeometry(shape, {depth: height * MM, bevelEnabled: false, curveSegments: 64});g.rotateX(-Math.PI / 2);return g;
}
export function createDrinkingStrawModel() {
  const kit = houseModel('Drinking straw'), {root, part, control, finish, covers} = kit;
  const system = part('system', 'Drinking straw', 'A pressure difference lifts liquid through an immersed open tube. This model follows a finite glass and stops at a 20 mL sip or twelve seconds.');
  const glass = part('glass', 'Glass', 'An open glass, 80 mm across inside. Atmospheric pressure acts on its exposed liquid surface.', [0, 0, 0], system);
  const profile = [[0,0],[42,0],[42,140],[40,140],[40,2],[0,2]].map(([x,y])=>new THREE.Vector2(x*MM,y*MM));
  const transparent = (mesh, opacity) => {mesh.material = mesh.material.clone();mesh.material.transparent=true;mesh.material.opacity=opacity;mesh.material.depthWrite=false;return mesh;};
  const rearGlass=transparent(surface(kit,new THREE.LatheGeometry(profile,48,Math.PI/2,Math.PI),'blue',glass),.25);
  const frontGlass=transparent(surface(kit,new THREE.LatheGeometry(profile,48,-Math.PI/2,Math.PI),'blue',glass),.18);covers.push(frontGlass);
  const reservoir=part('reservoir','Drink in the glass','Its level falls by the exact volume transferred into the rising column and through the mouth.',[0,0,0],system);
  const drinkBottom=transparent(surface(kit,new THREE.CylinderGeometry(40*MM,40*MM,(BOTTOM-2)*MM,128,1,true),'blue',reservoir),.5);drinkBottom.position.y=(BOTTOM+2)/2*MM;
  const drinkFloor=transparent(surface(kit,new THREE.CircleGeometry(40*MM,128),'blue',reservoir),.5);drinkFloor.rotation.x=Math.PI/2;drinkFloor.position.y=2*MM;
  const drinkBody=transparent(surface(kit,new THREE.BufferGeometry(),'blue',reservoir),.5);
  const straw=part('straw','Straw wall','A 0.4 mm wall surrounds a genuinely open bore. The submerged end stays clear of the bottom of the glass.',[STRAW_X*MM,0,0],system);
  const tubeSections=Array.from({length:2},()=>transparent(surface(kit,new THREE.BufferGeometry(),'gold',straw),.28));
  const vent=part('vent','Side vent','A large side opening vents the lower straw to atmosphere. This is an ideal full pressure release; a small pinhole can behave differently.',[STRAW_X*MM,0,0],system);
  const ventBack=transparent(surface(kit,new THREE.BufferGeometry(),'gold',vent),.28);
  const ventFront=transparent(surface(kit,new THREE.BufferGeometry(),'gold',vent),.28);
  const ventEdges=[0,1].map(()=>kit.ring(1,.5*MM,[0,0,0],'red',vent));ventEdges.forEach(m=>m.rotation.x=Math.PI/2);
  const column=part('column','Liquid column','Liquid rises in the bore and then enters the mouth. The submerged section starts full; the rising section draws liquid out of the glass.',[STRAW_X*MM,0,0],system);
  const columnMesh=kit.cylinder(1,1,[0,0,0],'blue',column);columnMesh.material=columnMesh.material.clone();
  const tracers=Array.from({length:8},()=>kit.sphere(1,[0,0,0],'ink',column));
  const mouth=part('mouth','Sealed lips','An annular schematic seal surrounds the straw while leaving its center open. Mouth pressure is prescribed, not an anatomical simulation.',[STRAW_X*MM,0,0],system);
  const lips=surface(kit,new THREE.BufferGeometry(),'clay',mouth);
  const pressure=part('pressure','Pressure comparison','Orange shows the imposed pressure difference; blue shows column weight per area. Both use 5 mm per kPa. These are diagram arrows, not extra machine parts.',[0,0,0],system);
  pressure.userData.explosionExcluded=true;
  const push=solidArrow(kit,0xd9822b,pressure,1.1*MM),weight=solidArrow(kit,0x2f6690,pressure,1.1*MM);weight.userData.setDirection(new THREE.Vector3(0,-1,0));
  const atmosphere=part('atmosphere','Atmospheric pressure','Air presses down on the free liquid surface. These three arrows identify where pressure acts; their length is schematic.',[0,0,0],system);atmosphere.userData.explosionExcluded=true;
  const airArrows=[[-25,0],[0,-25],[25,10]].map(([x,z])=>{const a=solidArrow(kit,0x72906d,atmosphere,.9*MM);a.position.set(x*MM,0,z*MM);a.userData.setDirection(new THREE.Vector3(0,-1,0));a.userData.setLength(18*MM);return a;});
  const specs={
    suction:['Pressure reduction','kPa',null,'Pressure below atmosphere maintained by the mouth during the trial.'],
    diameter:['Inside diameter','mm',null,'A wider bore reduces resistance. All tube and liquid dimensions change together.'],
    lift:['Mouth above starting surface','cm',null,'Mouth height stays fixed while the liquid level falls.'],
    drink:['Liquid','',DRINKS.map(({value,label})=>({value,label})),'Illustrative constant-viscosity liquids; thick foods can have more complex rheology.'],
    hole:['Straw seal','',[{value:0,label:'Sealed straw'},{value:1,label:'Open side vent'}],'The open vent is modeled as a complete pressure release in the lower straw.'],
  };
  for(const [key,[min,max,step]]of Object.entries(STRAW_DOMAINS)){const [label,unit,options,help]=specs[key];control(key,label,min,max,step,D[key],unit,help,options,{primary:key==='drink'||key==='hole'});}
  let elapsed=0,lastClock=0,shape='',disposed=false;
  const replace=(mesh,geometry)=>{mesh.geometry.dispose();mesh.geometry=geometry;};
  const result=finish(values=>{
    const s=sampleStraw(values,elapsed),inner=values.diameter/2,outer=inner+.4,top=GLASS.level+values.lift*10,ventY=GLASS.level+values.lift*5;
    const key=`${values.diameter}:${values.lift}`;
    if(key!==shape){
      shape=key;
      replace(tubeSections[0],annulus(inner,outer,ventY-3-BOTTOM));tubeSections[0].position.y=BOTTOM*MM;
      replace(tubeSections[1],annulus(inner,outer,top-ventY-3));tubeSections[1].position.y=(ventY+3)*MM;
      replace(ventBack,annulus(inner,outer,6,0,Math.PI));ventBack.position.y=(ventY-3)*MM;
      replace(ventFront,annulus(inner,outer,6,Math.PI,Math.PI));ventFront.position.y=(ventY-3)*MM;
      ventEdges.forEach((mesh,i)=>{replace(mesh,new THREE.TorusGeometry((outer+.15)*MM,.4*MM,8,48));mesh.position.y=(ventY+(i?3:-3))*MM;});
      const liquidShape=circle(40*MM),hole=new THREE.Path();hole.absarc(STRAW_X*MM,0,outer*MM,0,Math.PI*2,true);liquidShape.holes.push(hole);
      const liquidGeometry=new THREE.ExtrudeGeometry(liquidShape,{depth:1,bevelEnabled:false,curveSegments:64});liquidGeometry.rotateX(-Math.PI/2);
      // Remove the internal horizontal face where this section meets the lower liquid.
      const normals=liquidGeometry.attributes.normal,indices=[];for(let i=0;i<normals.count;i+=3)if(normals.getY(i)>-.9)indices.push(i,i+1,i+2);liquidGeometry.setIndex(indices);
      replace(drinkBody,liquidGeometry);drinkBody.position.y=BOTTOM*MM;
      const lipShape=new THREE.Shape();lipShape.absellipse(0,0,16*MM,10*MM,0,Math.PI*2,false,0);const bore=new THREE.Path();bore.absarc(0,0,outer*MM,0,Math.PI*2,true);lipShape.holes.push(bore);
      const lipGeometry=new THREE.ExtrudeGeometry(lipShape,{depth:8*MM,bevelEnabled:false,curveSegments:64});lipGeometry.rotateX(-Math.PI/2);replace(lips,lipGeometry);lips.position.y=(top-4)*MM;
    }
    ventFront.visible=values.hole===0;ventEdges.forEach(mesh=>mesh.visible=values.hole===1);
    drinkBottom.material.color.set(COLORS[values.drink]);drinkFloor.material.color.set(COLORS[values.drink]);drinkBody.material.color.set(COLORS[values.drink]);columnMesh.material.color.set(COLORS[values.drink]);
    drinkBody.scale.y=(s.level-STRAW.bottom)*M;
    columnMesh.scale.set(inner*MM,(s.columnTop-STRAW.bottom)*M,inner*MM);columnMesh.position.y=(STRAW.bottom+s.columnTop)/2*M;
    const travel=s.volume/s.area*SLOW;
    tracers.forEach((dot,i)=>{const radius=Math.min(.85,inner*.4)/1000,available=top/1000-STRAW.bottom-2*radius;dot.scale.setScalar(radius*M);dot.position.y=(STRAW.bottom+radius+(travel+i*available/tracers.length)%available)*M;dot.visible=s.elapsed>0&&s.dp>0&&dot.position.y/M+radius<=s.columnTop;});
    push.position.set((STRAW_X+inner+9)*MM,s.level*M,0);push.userData.setLength(s.dp/1000*KPA);
    weight.position.set((STRAW_X+inner+18)*MM,s.columnTop*M,0);weight.userData.setLength(s.liftPressure/1000*KPA);
    airArrows.forEach(a=>a.position.y=s.level*M+21*MM);
    const finalReason=s.values.hole?'vent open':!s.dp?'no pressure difference':s.arrivedAt===null?'mouth not reached':'sip still below 20 mL';
    const outcome={ready:'Ready · press Play',vented:'Vented · no rise','no-suction':'No pressure difference · no rise',rising:'Liquid rising',held:'Column held below the mouth',drinking:'Liquid entering the mouth',sipped:'Finished · 20 mL sip',complete:`Trial ended · ${finalReason}`}[s.mode];
    return {state:{...s,top,ventY},readings:[
      r('Your result',outcome),r('Run clock',`${fixed(s.elapsed,3)} s`,'Stops exactly at a 20 mL sip, or at the twelve-second trial limit.'),
      r('Sip collected',`${fixed(s.drunk*1e6,2)} / 20 mL`),r('Flow into mouth now',`${fixed(s.mouthFlow*1e6,2)} mL/s`,'Zero before arrival and after the trial stops.'),
      r('Column above current surface',`${fixed(s.height*100,2)} cm`),r('Surface fall',`${fixed((STRAW.glassDepth-s.level)*1000,2)} mm`,'Volume lost by the glass equals extra liquid in the column plus the sip.'),
      r('Pressure can hold',`${fixed(s.holdHeight*100,2)} cm`,'Ideal hydrostatic height relative to the current free surface.'),
      r('Pressure difference',`${fixed(s.dp/1000,2)} kPa`,'Orange arrow. Working pressure while suction is applied; the stopped frame preserves the trial outcome.'),
      r('Column weight per area',`${fixed(s.liftPressure/1000,3)} kPa`,'Blue arrow on the same length scale as orange.'),
      r('Pressure balance',s.dp?`lift ${fixed(s.liftShare*100,1)}%, wall ${fixed(s.frictionShare*100,1)}%, entry and speed ${fixed(s.kineticShare*100,1)}%`:'No pressure difference','Quasi-steady operating balance at the displayed liquid level.'),
      r('Operating flow regime',s.operatingFlow<1e-12?'At rest':`${s.reynolds<2000?'Laminar':s.reynolds<4000?'Transition':'Turbulent'} · Re ${fixed(s.reynolds,1)}`,'Working-flow prediction at this level, including in a frozen result. Churchill transition is an approximation, not a prediction of individual eddies.'),
      r('Arrival at mouth',s.arrivedAt===null?'Not within 12 s':`${fixed(s.arrivedAt,3)} s`),
      r('20 mL completion',s.sipTime===null?'Not within 12 s':`${fixed(s.sipTime,3)} s`),
      r('Mouth pressure',`${fixed((STRAW.atmosphere-s.mouth)/1000,2)} kPa absolute`,'Atmosphere is fixed at 101.325 kPa. With the vent open, the lower straw remains at atmospheric pressure.'),
    ]};
  });
  const render=result.update;
  result.update=(next={})=>{const before=result.getState().values,readings=render(next);if(Object.keys(D).some(key=>before[key]!==result.getState().values[key])){elapsed=0;return render();}return readings;};
  result.advance=dt=>{if(Number.isFinite(dt)&&dt>0)elapsed=Math.min(strawPlan(result.getState().values).endTime,elapsed+dt);return render();};
  result.animate=t=>{const dt=Number.isFinite(t)?Math.max(0,t-lastClock):0;if(Number.isFinite(t))lastClock=t;return result.advance(dt);};
  result.reset=()=>{elapsed=lastClock=0;root.rotation.set(.16,-.3,0);return render(result.defaults);};
  result.actions=[
    {label:'Early rise',part:'system',view:'front',isolate:false,group:'Run',replay:false,run(){elapsed=Math.min(.04,strawPlan(result.getState().values).endTime/2);return render();}},
    {label:'Finish the trial',part:'system',view:'front',isolate:false,group:'Run',replay:false,run(){elapsed=strawPlan(result.getState().values).endTime;return render();}},
    ...[['See the liquid column','column'],['See the mouth seal','mouth'],['See the side vent','vent'],['See the glass','glass'],['See the whole straw','system']].map(([label,id])=>({label,part:id,view:id==='mouth'?'top':'front',isolate:id!=='system',group:'Look closer',replay:false,run(){root.rotation.set(...(id==='system'?[.16,-.3,0]:id==='vent'?[.22,.65,0]:[0,0,0]));return render();}})),
  ];
  result.playback={label:'Sip through the straw',description:'Watch liquid rise, enter the mouth, and lower the glass level. Stops at exactly 20 mL or twelve seconds. Column motion uses trial time; dark tracers move ten times slower.',stepLabel:'Advance by a hundredth of a second',advance:result.advance,step:()=>result.advance(.01),complete:()=>Boolean(result.getState().complete),blocked:()=>false};
  result.resultPart={id:'system',label:'Inspect final liquid levels',view:'front',focusOnComplete:false,available:()=>Boolean(result.getState().complete)};
  result.frameBoundsForPart=id=>{if(id!=='system')return null;const s=result.getState(),height=Math.max(s.top+18,s.level*1000+s.dp/1000*5+8);root.updateWorldMatrix(true,false);return new THREE.Box3(new THREE.Vector3(-46*MM,0,-46*MM),new THREE.Vector3(52*MM,height*MM,46*MM)).applyMatrix4(root.matrixWorld);};
  root.rotation.set(.16,-.3,0);result.initialPart='system';result.initialView='front';result.frameVisibleOnly=true;result.framePadding=.76;result.selectionOutline=false;result.transparentBackground=true;
  result.topology={system,glass,rearGlass,frontGlass,reservoir,drinkBottom,drinkFloor,drinkBody,straw,tubeSections,vent,ventBack,ventFront,ventEdges,column,columnMesh,tracers,mouth,lips,pressure,push,weight,atmosphere,airArrows,MM,M,KPA,SLOW,GLASS,STRAW_X,BOTTOM};
  const dispose=result.dispose;result.dispose=()=>{if(!disposed){disposed=true;dispose();}};return result;
}

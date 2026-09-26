import * as THREE from 'three';
import {houseModel, reading as r} from './house-model-kit.js';
import {surface} from './scene-kit.js';
import {fixed} from './format.js';
import {faucetConstants as C, FAUCET_DEFAULTS as D, FAUCET_DOMAINS, sampleFaucet, faucetPlan} from './faucet-physics.js';
export {faucetConstants, faucetFlow, washerLeak, aeratorLoss} from './faucet-physics.js';

const MM=.01, M=1000*MM, TAU=2*Math.PI;
const SEAT=94, OUTLET=76, BUCKET={x:160,bottom:-216,radius:125,height:10000000/(Math.PI*125**2)};
function annulus(inner,outer,height,start=0,span=TAU){
  const shape=new THREE.Shape();shape.absarc(0,0,outer*MM,start,start+span,false);shape.absarc(0,0,inner*MM,start+span,start,true);shape.closePath();
  const g=new THREE.ExtrudeGeometry(shape,{depth:height*MM,bevelEnabled:false,curveSegments:48});g.rotateX(-Math.PI/2);return g;
}
function threadGeometry(inner,crest,from,to,phase=0,half=false){
  const positions=[],indices=[],pitch=C.pitch*1000,segments=Math.round((to-from)/pitch*64);
  for(let i=0;i<=segments;i++){
    const y=from+(to-from)*i/segments,a=-(y-124-phase)/pitch*TAU;
    for(const [radius,offset]of [[inner,-.5],[crest,0],[inner,.5]])positions.push(radius*Math.cos(a)*MM,(y+offset)*MM,radius*Math.sin(a)*MM);
    if(i&&(!half||Math.sin(a+TAU/128)<0))for(let j=0;j<3;j++){const k=(j+1)%3,b=(i-1)*3;indices.push(b+j,b+3+j,b+k,b+k,b+3+j,b+3+k);}
  }
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));g.setIndex(indices);g.computeVertexNormals();return g;
}
export function createFaucetModel(){
  const kit=houseModel('Faucet'),{root,part,control,finish,covers}=kit;
  const cylinder=(radius,height,pos,color,parent)=>kit.cylinder(radius*MM,height*MM,pos.map(v=>v*MM),color,parent);
  const rod=(a,b,radius,color,parent)=>kit.rod(a.map(v=>v*MM),b.map(v=>v*MM),radius*MM,color,parent);
  const shell=(inner,outer,height,y,color,parent,start=0,span=TAU)=>{const m=surface(kit,annulus(inner,outer,height,start,span),color,parent);m.position.y=y*MM;return m;};
  const transparent=(mesh,opacity)=>{mesh.material=mesh.material.clone();mesh.material.transparent=true;mesh.material.opacity=opacity;mesh.material.depthWrite=false;return mesh;};
  const system=part('system','Compression faucet and collection bucket','A handwheel turns a threaded spindle in a fixed nut. A washer controls a real open seat. Collect for twenty seconds, close the handle, then check for leakage.');
  const supply=part('supply','Supply tail','The visible 15 mm bore tail supplies the valve from below. The model represents another 20 m of upstream pipe with a fixed resistance; that long run is not drawn.',[0,0,0],system);
  const inletBack=shell(7.5,9,250,-160,'gold',supply,0,Math.PI),inletFront=shell(7.5,9,250,-160,'gold',supply,Math.PI,Math.PI);covers.push(inletFront);
  const body=part('body','Sectioned tap body','The inlet reaches the seat from below. Above the washer, the chamber joins the hollow spout. The missing front wall is a cutaway, not a leak.',[0,0,0],system);
  const bodyBack=[],bodyFront=[];
  for(const [y,h,port]of [[90,6,false],[96,16,true],[112,24,false]]){
    const angle=port?.73:0;
    bodyBack.push(shell(12,16,h,y,'metal',body,angle,Math.PI-angle));
    bodyFront.push(shell(12,16,h,y,'metal',body,Math.PI,Math.PI-angle));
  }
  covers.push(...bodyFront);
  const seat=part('seat','Valve seat','The 12 mm open bore ends in a flat sealing ring. The washer touches its upper face when the handle is closed.',[0,0,0],system);
  const seatMesh=shell(6,12,4,90,'gold',seat);
  const nut=part('nut','Fixed threaded bonnet','The fixed internal thread supports the moving spindle. Its front half is removed here so the matching 1.5 mm pitch can be inspected.',[0,0,0],body);
  shell(4.45,12,34,136,'gold',nut,0,Math.PI);
  const nutFront=shell(4.45,12,34,136,'gold',nut,Math.PI,Math.PI);covers.push(nutFront);
  const femaleThread=surface(kit,threadGeometry(4.45,3.65,136.75,163.75,.75,true),'gold',nut,true);
  const packing=part('packing','Stem packing and cap','A seal around the smooth stem keeps water from escaping beside the handle. Packing compression and friction are not simulated.',[0,0,0],body);
  shell(3.55,8,6,174,'ink',packing,0,Math.PI);shell(3.55,12,4,180,'gold',packing,0,Math.PI);
  shell(4.45,12,4,170,'gold',nut,0,Math.PI);
  const spindle=part('spindle','Threaded spindle assembly','Counterclockwise opening raises this assembly by exactly 1.5 mm per turn. The handle, stem and washer move together.',[0,0,0],system);
  const shaft=cylinder(3.5,93,[0,143.5,0],'gold',spindle);
  const thread=part('thread','Spindle thread','A continuous helical ridge, not stacked rings. Its 1.5 mm lead matches the fixed nut. The ideal screw-force ratio excludes thread and packing friction.',[0,0,0],spindle);
  const maleThread=surface(kit,threadGeometry(3.5,4.3,124,166),'metal',thread,true);
  const washer=part('washer','Sealing washer','A 3 mm rubber washer meets the flat seat. Worn conditions use small equivalent leak areas below display resolution; their color marks wear, not a magnified physical hole.',[0,0,0],spindle);
  const washerMesh=cylinder(9,3,[0,95.5,0],'ink',washer);washerMesh.material=washerMesh.material.clone();
  cylinder(6,2,[0,98,0],'gold',washer);
  const handle=part('handle','Handwheel','The rim is 45 mm from the spindle axis. One newton applied tangentially provides 0.045 N·m of torque, before losses.',[0,0,0],spindle);
  const rim=kit.ring(45*MM,2.5*MM,[0,190*MM,0],'clay',handle);rim.rotation.x=Math.PI/2;
  cylinder(7,6,[0,190,0],'clay',handle);
  for(let i=0;i<4;i++){const a=i*TAU/4;rod([0,190,0],[45*Math.cos(a),190,45*Math.sin(a)],2.5,'clay',handle);}
  const handleMark=kit.sphere(3*MM,[45*MM,190*MM,0],'ink',handle);
  const spout=part('spout','Hollow spout','Water crosses the opened seat, turns into this chamber outlet and leaves downward through a 12 mm bore.',[0,0,0],body);
  const curve=new THREE.CatmullRomCurve3([[13,104,0],[45,115,0],[135,115,0],[160,98,0],[160,76,0]].map(p=>new THREE.Vector3(...p.map(v=>v*MM))));
  const [spoutShell,spoutFront]=[-Math.PI/2,Math.PI/2].map(start=>{
    const shape=new THREE.Shape();shape.absarc(0,0,8*MM,start,start+Math.PI,false);shape.absarc(0,0,6*MM,start+Math.PI,start,true);shape.closePath();
    return surface(kit,new THREE.ExtrudeGeometry(shape,{steps:100,bevelEnabled:false,extrudePath:curve,curveSegments:32}),'metal',spout);
  });covers.push(spoutFront);
  const aerator=part('aerator','Aerator sleeve and screen','The open sleeve and screen add resistance. Air entrainment and individual screen jets are omitted; displayed spout speed is a bulk average over the nominal bore.',[160*MM,0,0],system);
  shell(6,8.5,10,70,'gold',aerator);
  for(const z of [-4,-2,0,2,4]){const x=Math.sqrt(36-z*z);rod([-x,71,z],[x,71,z],.2,'metal',aerator);rod([z,71,-x],[z,71,x],.2,'metal',aerator);}
  const waterway=part('waterway','Water in the valve','Blue water identifies the connected inlet and spout. Moving dots show direction at a schematic speed; they are not a water-velocity scale.',[0,0,0],system);waterway.userData.explosionExcluded=true;
  const inletWater=transparent(cylinder(5.8,254,[0,-33,0],'blue',waterway),.55);
  const curtainWater=transparent(surface(kit,annulus(5.8,9,1),'blue',waterway),.65);curtainWater.position.y=SEAT*MM;
  const spoutWater=transparent(surface(kit,new THREE.TubeGeometry(curve,100,5.7*MM,16,false),'blue',waterway),.6);
  const feedDots=Array.from({length:5},()=>kit.sphere(.8*MM,[0,0,0],'ink',waterway));
  const spoutDots=Array.from({length:5},()=>kit.sphere(.8*MM,[0,0,0],'ink',waterway));
  const stream=part('stream','Water leaving the spout','The continuous jet narrows as gravity accelerates it. Low flows use 0.05 mL drops. Transit delays and aerator bubbles are omitted; all discharged volume is assigned to the bucket.',[0,0,0],system);stream.userData.explosionExcluded=true;
  const jet=transparent(surface(kit,new THREE.CylinderGeometry(1,1,1,24,24,true),'blue',stream),.65);
  jet.position.x=160*MM;
  const jetTemplate=Array.from(jet.geometry.attributes.position.array);
  const drip=kit.sphere(Math.cbrt(3*C.dripVolume*1000/(4*Math.PI))*MM,[160*MM,0,0],'blue',stream);
  const bucket=part('bucket','Ten-liter collection bucket','The inside radius is 125 mm. Its ten-liter mark is 203.72 mm above the inner floor. All water delivered during collection, closure and the leak check is counted.',[160*MM,0,0],system);
  const profile=[[0,-220],[128,-220],[128,-2],[125,-2],[125,-216],[0,-216]].map(([x,y])=>new THREE.Vector2(x*MM,y*MM));
  const bucketBack=transparent(surface(kit,new THREE.LatheGeometry(profile,64,Math.PI/2,Math.PI),'leaf',bucket),.65);
  const bucketFront=transparent(surface(kit,new THREE.LatheGeometry(profile,64,-Math.PI/2,Math.PI),'leaf',bucket),.4);covers.push(bucketFront);
  const bucketMarks=[];
  for(let liters=2;liters<=10;liters+=2){const y=BUCKET.bottom+liters*1000000/(Math.PI*125**2),mark=surface(kit,new THREE.TorusGeometry(125.5*MM,.6*MM,8,48,Math.PI),'ink',bucket);mark.position.y=y*MM;mark.rotation.x=-Math.PI/2;bucketMarks.push(mark);}
  const collectedWater=part('collected-water','Collected water','The level follows the exact integrated discharge divided by the bucket area. No visible stream volume or evaporation is subtracted.',[160*MM,0,0],system);collectedWater.userData.explosionExcluded=true;
  const water=transparent(cylinder(125,1,[0,BUCKET.bottom,0],'blue',collectedWater),.7);
  const specs={
    turns:['Starting handle position','turns',null,'Each opening turn raises the washer 1.5 mm. Closing during playback is a prescribed handle motion.'],
    pressure:['Supply pressure','bar',null,'Upstream pressure above atmosphere; the model keeps it fixed during this trial.'],
    washer:['Washer condition','',[{value:0,label:'New · seals'},{value:1,label:'Worn · slow drip'},{value:2,label:'Damaged · faster drip'}],'Small equivalent leak areas remain when the handle is shut. Wear changes the seal, not the thread pitch.'],
    aerator:['Aerator','',[{value:1,label:'Fitted'},{value:0,label:'Removed'}],'The fitted screen adds resistance. Its air mixing is not simulated.'],
    closing:['Time taken to close','s',null,'After twenty seconds, the prescribed handle position falls linearly to zero over this time. Actual surge pressure is not calculated.'],
  };
  for(const [key,[min,max,step]]of Object.entries(FAUCET_DOMAINS)){const [label,unit,options,help]=specs[key];control(key,label,min,max,step,D[key],unit,help,options,{primary:key==='washer'});}
  let elapsed=0,lastClock=0,disposed=false;
  const result=finish(values=>{
    const s=sampleFaucet(values,elapsed),liters=s.filled;
    spindle.position.y=s.lift*M;spindle.rotation.y=s.turns*TAU;
    washerMesh.material.color.set([0x374736,0x917449,0xbd684a][values.washer]);aerator.visible=Boolean(values.aerator);
    curtainWater.visible=s.lift>0;curtainWater.scale.y=Math.max(.001,s.lift*1000);
    spoutWater.visible=s.flow>0;
    for(let i=0;i<5;i++){
      feedDots[i].position.set(0,(-155+((s.elapsed*25+i*48)%240))*MM,0);feedDots[i].visible=s.flow>0;
      spoutDots[i].position.copy(curve.getPointAt((s.elapsed*.15+i/5)%1));spoutDots[i].visible=s.flow>0;
    }
    const outlet=values.aerator?70:OUTLET,level=BUCKET.bottom+s.bucketLevel*1000,height=outlet-level;
    jet.visible=s.flow>5e-6;
    if(jet.visible){
      const positions=jet.geometry.attributes.position;
      for(let i=0;i<positions.count;i++){
        const u=jetTemplate[i*3+1]+.5,y=level+height*u,velocity=Math.sqrt(s.spoutSpeed**2+2*9.81*(outlet-y)/1000),radius=Math.sqrt(s.flow/(Math.PI*velocity))*M;
        positions.setXYZ(i,jetTemplate[i*3]*radius,y*MM,jetTemplate[i*3+2]*radius);
      }
      positions.needsUpdate=true;jet.geometry.computeVertexNormals();jet.geometry.boundingBox=null;jet.geometry.boundingSphere=null;
    }
    const period=s.flow>0?C.dripVolume*1e-6/s.flow:Infinity,fall=Math.sqrt(2*height/1000/9.81),age=s.elapsed%period;
    drip.visible=s.flow>0&&!jet.visible&&age<fall;drip.position.y=(outlet-4.905*age*age*1000)*MM;
    water.visible=liters>0;water.scale.y=s.bucketLevel*1000;water.position.y=(BUCKET.bottom+s.bucketLevel*500)*MM;
    const outcome=s.complete?(values.turns===0?(s.dripping?'Leak measured with handle shut':'Sealed · no water collected'):(s.shut.flow>0?'Trial ended · closed washer still leaks':'Trial ended · washer sealed')):s.stage==='ready'?'Ready · press Play':s.stage==='collecting'?(s.sealed?'Observing a sealed tap':s.dripping?'Measuring the closed tap’s leak':'Collecting water'):s.stage==='closing'?'Handle closing · water still counted':'Handle shut · checking the seal';
    return {state:{...s,blocked:false},readings:[
      r('Your result',outcome),r('Trial clock',`${fixed(s.elapsed,2)} / ${fixed(s.duration,2)} s`,'Twenty seconds of collection, followed by the selected closure and a two-second seal check. An already shut tap uses a twenty-second leak trial.'),
      r('Handle position now',`${fixed(s.turns,3)} turns`),r('Washer lift',`${fixed(s.lift*1000,3)} mm`,'Exact 1.5 mm pitch. The drawing uses the same lift without exaggeration.'),
      r('Flow now',`${fixed(s.litersPerMinute,3)} L/min`,'Quasi-steady flow at the current opening. Completion holds the final state; a damaged washer still has a nonzero leak.'),
      r('Water collected',`${fixed(liters,4)} L · ${fixed(liters*1000,2)} mL`,'All discharge is integrated, including while closing and during the seal check.'),
      r('Collected while closing',`${fixed(s.closureCollected,2)} mL`),
      r('Effective opening',`${fixed(s.openArea*1e6,1)} mm² · ${s.limitedBy}`,'The smaller of the washer-gap curtain and the seat bore, with a nonzero floor for a damaged seal.'),
      r('Pipe / spout speed',`${fixed(s.pipeSpeed,3)} / ${fixed(s.spoutSpeed,3)} m/s`,'The 15 mm supply pipe and 12 mm spout have different speeds for the same flow.'),
      r('Pressure budget',`${fixed(s.seatDrop,3)} seat + ${fixed(s.pipeDrop,3)} pipe + ${fixed(s.aeratorDrop,3)} screen + ${fixed(s.outletHead,3)} exit = ${fixed(values.pressure,3)} bar`,'The exit term is kinetic-energy head. With a sound closed seal, the supply pressure stands across the seat.'),
      r('Leak with handle shut',`${fixed(s.shut.flow*60*1e6,3)} mL/min · ${fixed(s.dripsPerMinute,1)} drops/min`,'Each illustrative drop is 0.05 mL. Very small leak openings are equivalent hydraulic areas, not resolved cracks.'),
      r('Leak left for one day',`${fixed(s.dayLoss,3)} L`),
      r('Sudden-stop reference',`${fixed(s.suddenStopReference,3)} bar`,'Density × 1200 m/s wave speed × supply-pipe velocity lost from the starting opening to the closed leak. This is a first-wave reference for abrupt flow change, not the actual peak during the chosen closure.'),
      r('Ideal screw-force ratio',`${fixed(s.idealForceRatio,1)} N per 1 N at rim`,'A 45 mm handwheel radius gives 0.045 N·m per newton. Lossless work balance gives force = 2π × torque / 1.5 mm lead. Actual force is lower and depends on friction and washer compression.'),
      r('Ten liters at starting flow',s.open.fillTime===null?'No filling':`${fixed(s.open.fillTime,1)} s`,'An estimate for leaving the starting setting unchanged; this finite trial closes after twenty seconds.'),
    ]};
  });
  const render=result.update;
  result.update=(next={})=>{const before=result.getState().values;const readings=render(next);if(Object.keys(D).some(k=>before[k]!==result.getState().values[k])){elapsed=0;return render();}return readings;};
  result.advance=dt=>{if(Number.isFinite(dt)&&dt>0)elapsed=Math.min(faucetPlan(result.getState().values).duration,elapsed+dt);return render();};
  result.animate=t=>{const dt=Number.isFinite(t)?Math.max(0,t-lastClock):0;if(Number.isFinite(t))lastClock=t;return result.advance(dt);};
  result.reset=()=>{elapsed=lastClock=0;root.rotation.set(.12,-.55,0);return render(D);};
  result.actions=[
    ...[['Start of trial',()=>0],['After ten seconds',()=>10],['Halfway through closure',v=>v.turns>0?20+v.closing/2:20],['Finish the trial',v=>faucetPlan(v).duration]].map(([label,time])=>({label,part:'system',view:'front',isolate:false,group:'Run',replay:false,run(){elapsed=time(result.getState().values);root.rotation.set(.12,-.55,0);return render();}})),
    {label:'See the seat bore',part:'seat',view:'top',isolate:true,group:'Look closer',replay:false,run(){root.rotation.set(0,0,0);return render();}},
    ...[['See the valve seat','seat'],['See the screw and nut','thread'],['See collected water','bucket'],['See the whole faucet','system']].map(([label,id])=>({label,part:id,view:'front',isolate:false,group:'Look closer',replay:false,run(){root.rotation.set(0,id==='system'?-.55:0,0);return render();}})),
  ];
  result.playback={label:'Collect, close and check',description:'Observe twenty seconds of flow, then the chosen handle closure and a two-second leak check. An already closed tap uses twenty seconds. Completion holds the result; pipe dots move at a schematic speed.',stepLabel:'Advance by 0.1 second',advance:result.advance,step:()=>result.advance(.1),complete:()=>result.getState().complete,blocked:()=>false};
  result.resultPart={id:'bucket',context:'system',label:'Inspect collected water',view:'front',focusOnComplete:false,available:()=>result.getState().complete};
  result.initialPart='system';result.initialView='front';result.frameVisibleOnly=true;result.framePadding=.7;result.selectionOutline=false;result.transparentBackground=true;
  result.frameBoundsForPart=id=>{if(id!=='system')return null;root.updateWorldMatrix(true,false);return new THREE.Box3(new THREE.Vector3(-50*MM,-222*MM,-130*MM),new THREE.Vector3(290*MM,205*MM,130*MM)).applyMatrix4(root.matrixWorld);};
  result.parts.find(p=>p.id==='thread').maxZoom=25;result.parts.find(p=>p.id==='seat').maxZoom=25;
  root.rotation.set(.12,-.55,0);
  result.topology={system,supply,body,seat,seatMesh,nut,femaleThread,packing,spindle,shaft,thread,maleThread,washer,washerMesh,handle,rim,handleMark,spout,spoutShell,spoutFront,curve,aerator,waterway,inletWater,curtainWater,spoutWater,feedDots,spoutDots,stream,jet,drip,bucket,bucketBack,bucketFront,bucketMarks,collectedWater,water,MM,M,SEAT,OUTLET,BUCKET};
  const dispose=result.dispose;result.dispose=()=>{if(!disposed){disposed=true;dispose();}};return result;
}

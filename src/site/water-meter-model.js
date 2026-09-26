import * as THREE from 'three';
import {houseModel,reading as r} from './house-model-kit.js';
import {surface} from './scene-kit.js';
import {fixed} from './format.js';
import {spurGearShape} from './gear-geometry.js';
import {mixerWormGeometry,mixerWheelGeometry} from './mixer-worm-geometry.js';
import {meterCarryProfiles,meterProfileGeometry,carryDimensions} from './water-meter-geometry.js';
import {meterConstants as C,METER_DEFAULTS as D,METER_DOMAINS,METER_DURATIONS,METER_INITIALS,meterSizes,sampleWaterMeter} from './water-meter-physics.js';
export {meterResponse,meterConstants,meterSizes} from './water-meter-physics.js';
const MM=.025,TAU=2*Math.PI;
const cyclic=new THREE.Matrix4().makeBasis(new THREE.Vector3(0,0,1),new THREE.Vector3(1,0,0),new THREE.Vector3(0,1,0));
const turn=value=>(value%1)*TAU;
function annulus(inner,outer,length,start=0,span=TAU){
  const s=new THREE.Shape().absarc(0,0,outer,start,start+span,false);s.absarc(0,0,inner,start+span,start,true);s.closePath();
  return new THREE.ExtrudeGeometry(s,{depth:length,bevelEnabled:false,curveSegments:48});
}
function plate(width,height,depth,holes=[]){
  const s=new THREE.Shape();s.moveTo(-width/2,-height/2);s.lineTo(width/2,-height/2);s.lineTo(width/2,height/2);s.lineTo(-width/2,height/2);s.closePath();
  for(const [x,y,radius]of holes)s.holes.push(new THREE.Path().absarc(x,y,radius,0,TAU,true));
  const g=new THREE.ExtrudeGeometry(s,{depth,bevelEnabled:false,curveSegments:32});g.translate(0,0,-depth/2);return g;
}
function texture(draw,width=1024,height=256){
  if(typeof document==='undefined'){const t=new THREE.DataTexture(new Uint8Array([248,243,219,255]),1,1);t.needsUpdate=true;return t;}
  const canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;
  const context=canvas.getContext('2d');draw(context,width,height);
  const t=new THREE.CanvasTexture(canvas);t.colorSpace=THREE.SRGBColorSpace;t.anisotropy=4;return t;
}
export function createWaterMeterModel(){
  const kit=houseModel('Water meter'),{root,part,control,finish,covers}=kit,textures=[];
  const mm=v=>v.map(x=>x*MM);
  const box=(size,pos,color,parent)=>kit.box(mm(size),mm(pos),color,parent);
  const rod=(a,b,radius,color,parent)=>kit.rod(mm(a),mm(b),radius*MM,color,parent);
  const cylinder=(radius,height,pos,color,parent)=>kit.cylinder(radius*MM,height*MM,mm(pos),color,parent);
  const mesh=(geometry,pos,color,parent)=>{geometry.scale(MM,MM,MM);const o=surface(kit,geometry,color,parent);o.position.set(...mm(pos));return o;};
  const group=(id,label,description,pos,parent)=>part(id,label,description,mm(pos),parent);
  const transparent=(object,opacity)=>{object.material=object.material.clone();object.material.transparent=true;object.material.opacity=opacity;object.material.depthWrite=false;return object;};
  const label=(text,width,height,pos,parent,color='#374736')=>{
    const map=texture((ctx,w,h)=>{ctx.fillStyle='#f5edcf';ctx.fillRect(0,0,w,h);ctx.fillStyle=color;ctx.font='600 210px sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(text,w/2,h/2,w-20);},512,256);textures.push(map);
    const o=mesh(new THREE.PlaneGeometry(width,height),pos,'cream',parent);o.material=new THREE.MeshBasicMaterial({map,side:THREE.DoubleSide});return o;
  };
  const system=part('system','Mechanical water meter','Water drives an impeller, two worm stages and a spur train. A fixed dial, a movement marker and seven numbered rollers share that drive.');
  const pipes=group('pipe','Inlet and outlet pipes','Hollow 12 mm bores enter the chamber on opposite sides of the rotor. Blue dots indicate direction at a schematic speed.',[0,0,0],system);
  const pipeShells=[];
  for(const [side,y]of [[-1,-13],[1,13]])for(const half of [0,1]){
    const g=annulus(6,8,30,half*Math.PI,Math.PI);g.rotateY(Math.PI/2);
    const o=mesh(g,[side<0?-57:27,y,-40],'gold',pipes);pipeShells.push(o);if(half===0)covers.push(o);
  }
  const chamber=group('chamber','Measuring chamber','An inlet jet strikes the lower blades. The outlet is above the rotor axis. The retained walls show the wet chamber even when its front cover is removed.',[0,0,0],system);
  const walls=[];
  for(const [side,y]of [[-1,-13],[1,13]]){
    const g=plate(18,46,2,[[0,y,6]]);g.rotateY(Math.PI/2);walls.push(mesh(g,[side*26,0,-40],'gold',chamber));
  }
  walls.push(box([54,2,20],[0,-24,-40],'gold',chamber),box([54,2,20],[0,24,-40],'gold',chamber));
  walls.push(mesh(plate(54,50,2,[[0,0,2.05]]),[0,0,-50],'gold',chamber));
  const wetCover=mesh(plate(54,50,2,[[0,0,2.05]]),[0,0,-30],'gold',chamber);covers.push(wetCover);
  const seal=group('seal','Shaft seal and rotor bearings','A sealed 4 mm shaft carries rotation from the wet chamber into the dry gearbox. Seal friction is represented only by the chosen low-flow response.',[0,0,0],system);
  mesh(annulus(2.02,4,4),[0,0,-32],'ink',seal);mesh(annulus(2.02,4,4),[0,0,-52],'metal',seal);
  const impeller=group('impeller','Impeller and first worm shaft','Eight blades turn a 4 mm shaft. The illustrative calibration is 40 impeller turns per registered liter. Below the chosen starting flow, the entire drive stops.',[0,0,0],system);
  const impellerHub=rod([0,0,-45],[0,0,-35],5,'clay',impeller),blades=[];
  for(let i=0;i<8;i++){const a=i*TAU/8,o=box([16,1.2,10],[12*Math.cos(a),12*Math.sin(a),-40],'clay',impeller);o.rotation.z=a;blades.push(o);}
  const inputShaft=rod([0,0,-53],[0,0,20],2,'metal',impeller);
  const firstWorm=group('first-worm','First single-start worm','One shaft revolution advances the 20-tooth wheel by one tooth. The visible helical thread is conjugate to its wheel.',[0,0,0],impeller);
  const worm1=mesh(mixerWormGeometry(20),[0,0,0],'gold',firstWorm);
  const frame=group('frame','Dry gearbox frame and shaft supports','Fixed bearings support both ends of the drive shafts. Numbered rollers and transfer pinions turn independently on fixed register axles.',[0,0,0],system);
  for(const x of [-30,29])rod([x,-6,-22],[x,153,-22],2,'metal',frame);
  for(const y of [-6,84,153])rod([-30,y,-22],[29,y,-22],2,'metal',frame);
  const bearings=[];
  function bearing(axis,pos,radius,parent=frame){
    const g=annulus(radius+.03,radius+2,3);g.translate(0,0,-1.5);if(axis==='y')g.rotateX(-Math.PI/2);if(axis==='x')g.rotateY(Math.PI/2);
    const o=mesh(g,pos,'ink',parent);bearings.push(o);return o;
  }
  bearing('z',[0,0,19],2);rod([0,0,22],[29,0,22],1.5,'metal',frame);rod([29,0,22],[29,0,-22],1.5,'metal',frame);
  const shaftB=group('first-wheel','20-tooth worm wheel and indicator shaft','The first worm reduces 40 impeller turns to two shaft turns per liter. The same shaft drives the spur train and the red movement marker.',[-22.25,0,0],system);
  const wheel1=mesh(mixerWheelGeometry(20,-1),[0,0,0],'clay',shaftB);
  rod([0,-6,0],[0,153,0],1.8,'metal',shaftB);
  const spur=(teeth,bore,pos,color,parent,phase=0)=>{
    const g=new THREE.ExtrudeGeometry(spurGearShape({teeth,module:.7,bore}),{depth:3,bevelEnabled:false,curveSegments:32});g.translate(0,0,-1.5);g.rotateX(-Math.PI/2);g.rotateY(phase);return mesh(g,pos,color,parent);
  };
  const spurB=spur(20,1.82,[0,70,0],'gold',shaftB);
  const pointerDrive=group('pointer-drive','40-tooth pointer gear and shaft','The 20-tooth driver turns this 40-tooth gear once per liter, in the opposite direction. Its long shaft carries the pointer above the register.',[-1.25,0,0],system);
  const spurC=spur(40,1.82,[0,70,0],'clay',pointerDrive,Math.PI/40);
  rod([0,65,0],[0,153,0],1.8,'metal',pointerDrive);
  const counterDrive=group('counter-drive','20-tooth counter pinion and second worm','The 40-tooth pointer gear drives this 20-tooth pinion at two turns per liter. Its second single-start worm then gives one roller revolution per ten liters.',[19.75,0,0],system);
  const spurD=spur(20,2.02,[0,70,0],'gold',counterDrive);rod([0,65,0],[0,135,0],2,'metal',counterDrive);
  const worm2Geometry=mixerWormGeometry(20).applyMatrix4(cyclic),worm2=mesh(worm2Geometry,[0,110,0],'gold',counterDrive);
  for(const [x,ys,radius]of [[-22.25,[35,145],1.8],[-1.25,[84,145],1.8],[19.75,[84,133],2]])for(const y of ys){bearing('y',[x,y,0],radius);rod([x,y,-4],[x,y,-22],1.2,'metal',frame);}
  const dial=group('dial','Fixed one-liter dial','Ten fixed divisions mark 0.1 liter each. The pointer moves clockwise as viewed from above; the face and its numbers stay still.',[-1.25,150,0],system);
  cylinder(15,1,[0,0,0],'cream',dial);
  const dialMap=texture((ctx,w,h)=>{
    ctx.fillStyle='#f5edcf';ctx.fillRect(0,0,w,h);ctx.fillStyle='#374736';ctx.strokeStyle='#374736';ctx.lineWidth=5;ctx.font='bold 56px sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';
    for(let i=0;i<10;i++){const a=i*TAU/10;ctx.beginPath();ctx.moveTo(w/2+Math.sin(a)*w*.4,h/2-Math.cos(a)*h*.4);ctx.lineTo(w/2+Math.sin(a)*w*.47,h/2-Math.cos(a)*h*.47);ctx.stroke();ctx.fillText(String(i),w/2+Math.sin(a)*w*.3,h/2-Math.cos(a)*h*.3);}
    ctx.font='44px sans-serif';ctx.fillText('1 turn = 1 L',w/2,h*.64);
  },512,512);textures.push(dialMap);
  const dialFace=mesh(new THREE.CircleGeometry(14.8,64),[0,.55,0],'cream',dial);dialFace.rotation.x=-Math.PI/2;dialFace.material=new THREE.MeshBasicMaterial({map:dialMap,side:THREE.DoubleSide});
  const needle=group('needle','One-liter pointer','Exactly one clockwise revolution per registered liter. The pointer is keyed to the 40-tooth gear shaft.',[0,151.4,0],pointerDrive);
  rod([0,0,0],[0,0,-12.8],.55,'red',needle);cylinder(2.6,1.5,[0,0,0],'red',needle);
  const indicator=group('star-wheel','Sensor-movement marker','Two revolutions per registered liter on the first wheel shaft. It helps reveal small movements, but cannot turn while the driving impeller is stopped.',[0,150,0],shaftB);
  for(let i=0;i<4;i++){const a=i*Math.PI/2;rod([0,0,0],[3*Math.cos(a),0,3*Math.sin(a)],.65,'red',indicator);}
  const register=group('register','Cubic-meter roller register','Read four black whole-cubic-meter digits followed by three red decimal places. The rightmost place is one liter. Each higher roller advances as its lower neighbor changes from 9 to 0.',[0,0,0],system);
  const counterWheel=group('counter-wheel','Second 20-tooth worm wheel','This wheel turns once per ten registered liters and drives the rightmost numbered roller. The displayed reading can start from a chosen indexed position.',[19.75,110,22.25],register);
  const wheel2=mesh(mixerWheelGeometry(20,1).applyMatrix4(cyclic),[0,0,0],'clay',counterWheel);
  rod([-5.75,0,0],[5.75,0,0],1.8,'metal',counterWheel);
  const axle=rod([-85,110,22.25],[14,110,22.25],1,'metal',frame);
  const transferAxle=rod([-85,97.4,22.25],[15,97.4,22.25],.65,'metal',frame);
  for(const x of [-85,25.5]){bearing('x',[x,110,22.25],x<0?1:1.8);rod([x,110,18],[x,110,-22],1.4,'metal',frame);rod([x,110,-22],[29,110,-22],1.4,'metal',frame);}
  for(const x of [-85,15]){bearing('x',[x,97.4,22.25],.65);rod([x,97.4,18],[x,97.4,-22],1.2,'metal',frame);}
  const profiles=meterCarryProfiles(),drums=[],transfers=[],carryMeshes=[];
  const maps=['#bd4d37','#263d32'].map(color=>{
    const map=texture((ctx,w,h)=>{ctx.fillStyle='#f5edcf';ctx.fillRect(0,0,w,h);ctx.fillStyle=color;ctx.font='bold 84px sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';for(let n=0;n<=10;n++){ctx.save();ctx.translate(n*w/10,h/2);ctx.rotate(-Math.PI/2);ctx.fillText(String(n%10),0,0);ctx.restore();}},1000,128);
    map.wrapS=THREE.RepeatWrapping;textures.push(map);return map;
  });
  const materials=maps.map(map=>new THREE.MeshBasicMaterial({map}));
  const crossSection=(points,depth,x,color,parent,flip=false)=>{const g=meterProfileGeometry(points,depth,1.03);if(flip)g.rotateZ(Math.PI);g.rotateY(Math.PI/2);return mesh(g,[x,0,0],color,parent);};
  for(let i=0;i<7;i++){
    const x=10-i*14,place=10**i,drum=group(`digit-${i}`,`${place>=1000?place/1000+' m³':place+' L'} roller`,i===0?'One revolution counts ten liters. The next roller advances only during this roller’s 9-to-0 change.':'Twenty teeth on its right side receive two teeth of movement from the transfer pinion for each one-digit carry.',[x,110,22.25],register);
    const g=new THREE.CylinderGeometry(8,8,8,80,1,true);g.rotateZ(-Math.PI/2);
    const body=mesh(g,[0,0,0],'cream',drum);body.material=materials[i<3?0:1];
    for(const end of [-4,4]){const cap=annulus(1.03,8,.2);cap.rotateY(Math.PI/2);mesh(cap,[end-.1,0,0],'cream',drum);}
    if(i>0)crossSection(profiles.full,2,5,'cream',drum);
    if(i<6){
      const projections=crossSection(profiles.input,2,-6.8,'gold',drum,true),collar=crossSection(profiles.collar,1.6,-5,'clay',drum,true);
      const transfer=group(`carry-${i}`,`Carry from ${place} to ${place*10} liters`,'Two drive projections turn this eight-tooth transfer by a quarter revolution. Its alternating wide teeth clear a relieved collar during carry and lock against the round rim between carries.',[x-7.9,97.4,22.25],register);
      const pinion=crossSection(profiles.transfer,4.2,0,'metal',transfer);
      const wideGeometry=meterProfileGeometry(profiles.wide,1.6,.68);wideGeometry.rotateY(Math.PI/2);const wide=mesh(wideGeometry,[2.9,0,0],'metal',transfer);
      transfers.push(transfer);carryMeshes.push({projections,collar,pinion,wide});
    }
    drums.push(drum);
  }
  const window=group('window','Fixed reading window','Black digits give whole cubic meters; red places count 100, 10 and 1 liters from left to right. Digits move upward behind this fixed aperture.',[0,0,0],register);
  box([97,9.65,2],[-32,117.175,32],'leaf',window);box([97,7.65,2],[-32,103.825,32],'leaf',window);
  box([2,22,2],[-79.5,111,32],'leaf',window);box([2,22,2],[15.5,111,32],'leaf',window);
  label('m³',7,3,[10,122,45.2],window);kit.sphere(.45*MM,mm([-25,108.25,33.2]),'ink',window);
  const frameFront=group('case','Upper register casing','The upper drive and register sit outside the wet chamber. Cutaway removes the front, side and roof panels, leaving the frame, window, floor and rear wall.',[0,0,0],system);
  const back=box([120,110,2],[-26,83,-25],'leaf',frameFront);
  const right=box([2,110,71],[35,83,9.5],'leaf',frameFront),left=box([2,110,71],[-87,83,9.5],'leaf',frameFront);covers.push(right,left);
  const roofGeometry=plate(122,71,2,[[3.75,9.5,1.83],[24.75,9.5,1.83],[-4,31.5,2.03],[55,31.5,2.03]]);roofGeometry.rotateX(-Math.PI/2);
  const roof=mesh(roofGeometry,[-26,139,9.5],'leaf',frameFront);covers.push(roof);
  const floorGeometry=plate(122,71,2,[[3.75,9.5,1.83],[-4,31.5,2.03],[55,31.5,2.03]]);floorGeometry.rotateX(-Math.PI/2);
  const floor=mesh(floorGeometry,[-26,27,9.5],'leaf',frameFront);
  const frontLow=box([122,75,2],[-26,65.5,44],'leaf',frameFront),frontHigh=box([122,19,2],[-26,128.5,44],'leaf',frameFront);covers.push(frontLow,frontHigh);
  covers.push(box([6.5,16,2],[-83.75,111,44],'leaf',frameFront),box([18.5,16,2],[25.75,111,44],'leaf',frameFront));
  const waterway=group('waterway','Water route through the rotor','The transparent blue route shows inlet, blade chamber and outlet. Dots mark direction; their speed and this jet path are schematic rather than a fluid simulation.',[0,0,0],system);waterway.userData.explosionExcluded=true;
  const path=new THREE.CatmullRomCurve3([[-57,-13,-40],[-25,-13,-40],[-12,-17,-40],[8,-16,-40],[24,8,-40],[27,13,-40],[57,13,-40]].map(p=>new THREE.Vector3(...mm(p))));
  const water=transparent(surface(kit,new THREE.TubeGeometry(path,100,2.5*MM,12,false),'blue',waterway),.4);
  const dots=Array.from({length:7},()=>kit.sphere(.85*MM,[0,0,0],'ink',waterway));
  const specs={
    flow:['Household draw','L/min',null,'Water intentionally being used. The leak control adds a separate continuous flow.'],
    leak:['Unwanted leak','L/min',null,'Added to household draw. The indicator shares the impeller drive and can also miss very small leaks.'],
    size:['Meter specification','',Object.entries(meterSizes).map(([value,s])=>({value:Number(value),label:s.label})),'Q1 = Q3/R. These two illustrative meters also have different explicitly chosen starting flows.'],
    bias:['Calibration bias','%',null,'Signed error at and above Q1. Both positive and negative values are possible; changing this does not change the permissible-error envelope.'],
    duration:['Observation interval','',METER_DURATIONS,'Every trial takes twenty screen seconds. Long observations are labeled time-lapse; all mechanical turns and volumes use the same physical clock.'],
    initial:['Starting register','',METER_INITIALS,'Index the rollers before the trial. The new volume is added to this reading; changing it resets the observation.'],
  };
  for(const [key,[min,max,step]]of Object.entries(METER_DOMAINS)){const [name,unit,options,help]=specs[key];control(key,name,min,max,step,D[key],unit,help,options,{primary:key==='size'});}
  let clock=0,lastClock=0,disposed=false;
  const result=finish(values=>{
    const s=sampleWaterMeter(values,clock),v=s.registeredVolume;
    impeller.rotation.z=turn(40*v);shaftB.rotation.y=turn(2*v);pointerDrive.rotation.y=-turn(v);counterDrive.rotation.y=turn(2*v);counterWheel.rotation.x=-turn(v/10);
    drums.forEach((drum,i)=>{drum.rotation.x=-turn(s.positions[i]/10);});transfers.forEach((transfer,i)=>{transfer.rotation.x=turn(s.transferTurns[i]);});
    dots.forEach((dot,i)=>{dot.visible=s.flow>0;dot.position.copy(path.getPointAt((clock*.1+i/7)%1));});water.visible=s.flow>0;
    const display=s.display.slice(0,4)+'.'+s.display.slice(4),outcome=s.complete?`${fixed(s.deliveredVolume,3)} L passed · ${fixed(v,3)} L registered`:s.stage==='ready'?'Ready · press Play':s.turning?'Water drives the connected counter':'Water below starting flow · drive still';
    return {state:{...s,blocked:false},readings:[
      r('Your result',outcome),r('Register window',`${display} m³`,'Four black whole-cubic-meter places and three red fractional places. The displayed number is the last completed whole-liter count. During a carry, use the pointer to resolve the fractional liter.'),
      r('Observation clock',`${fixed(s.elapsed,1)} / ${fixed(values.duration,0)} s`,s.timeScale===1?'Real-time observation.':`${s.timeScale}× time-lapse. Fast gears may alias; choose twenty seconds and a low flow to inspect their direction.`),
      r('Water delivered',`${fixed(s.deliveredVolume,4)} L`),r('Volume registered',`${fixed(v,4)} L`,'Change in the counter during this trial, independently of its starting reading.'),
      r('Delivered minus registered',`${fixed(s.missed,4)} L`,'A positive difference is an under-reading. A negative difference is an over-reading, not negative water flow.'),
      r('Total flow',`${fixed(s.flow,3)} L/min`,`${fixed(values.flow,3)} household draw + ${fixed(values.leak,3)} leak.`),
      r('Flow range',s.band,`Q1 ${fixed(s.q1,4)}, Q2 ${fixed(s.q2,4)}, Q3 ${fixed(s.q3,3)}, Q4 ${fixed(s.q4,3)} L/min.`),
      r('Registration error',s.error===null?'Not defined at zero flow':`${fixed(100*s.error,2)}%`,s.limit===null?'No class-2 error comparison at this flow.':`${fixed(100*s.limit,0)}% either side of true volume: ${s.withinBand?'inside':'outside'} the cold-water class-2 comparison envelope. This is not certification.`),
      r('Movement marker',s.starWheel?'Turning with the impeller':'Still with the impeller',`Chosen starting flow: ${fixed(s.starting,3)} L/min. A still indicator cannot rule out every leak.`),
      r('Drive speeds',`${fixed(s.impellerTurnsPerMinute,2)} impeller · ${fixed(s.pointerTurnsPerMinute,3)} pointer rev/min`,'40 impeller turns = 2 first-wheel turns = 1 pointer turn = 0.1 lowest-roller turn per registered liter.'),
      r('Illustrative pressure loss',`${fixed(s.drop,4)} bar`,`${fixed(s.dropAtQ3,2)} bar at Q3, scaled with flow squared. This chosen curve is not the standard’s 0.63 bar maximum.`),
      r('At this flow for one day',`${fixed(s.dayDelivered,0)} L delivered · ${fixed(s.dayRegistered,0)} L registered`,'A projection at unchanged settings, not extra volume included in this trial.'),
      r('Register rollovers',String(s.rollovers),'After 9999.999 m³, the seven-place register wraps. Keep track of rollover when comparing two readings.'),
      r('Model limit','Illustrative direct mechanical drive','Chosen starting flows, smooth low-flow response and 40 turns/L; prescribed flow and ideal gear motion. No turbine torque solver, wear, air, magnetic coupling or calibration certificate.'),
    ]};
  });
  const render=result.update;
  result.update=(next={})=>{const before=result.getState().values,readings=render(next);if(Object.keys(D).some(k=>before[k]!==result.getState().values[k])){clock=0;return render();}return readings;};
  result.advance=dt=>{if(Number.isFinite(dt)&&dt>0)clock=Math.min(C.screenDuration,clock+dt);return render();};
  result.animate=t=>{const dt=Number.isFinite(t)?Math.max(0,t-lastClock):0;if(Number.isFinite(t))lastClock=t;return result.advance(dt);};
  const pose=()=>root.rotation.set(.35,-.38,0);
  result.reset=()=>{clock=lastClock=0;pose();return render(D);};
  result.actions=[
    ...[['Start observation',0],['Halfway through observation',10],['Finish observation',20]].map(([label,time])=>({label,part:'system',view:'front',isolate:false,group:'Run',replay:false,run(){clock=time;pose();return render();}})),
    ...[['See the impeller','impeller'],['See the first worm','first-worm'],['See the pointer','dial'],['Read the rollers','register'],['See decimal carry','carry-0'],['See the whole meter','system']].map(([label,id])=>({label,part:id,view:id==='dial'?'top':'front',isolate:false,group:'Look closer',replay:false,run(){root.rotation.set(id==='dial'?0:id==='carry-0'?-.4:.25,id==='system'?-.38:id==='carry-0'?.6:0,0);return render();}})),
  ];
  result.playback={label:'Observe the flow',description:'Twenty screen seconds measure the selected interval. All driven parts use registered volume. At completion the observation pauses; Play starts a fresh trial.',stepLabel:'Advance by 0.1 screen second',advance:result.advance,step:()=>result.advance(.1),complete:()=>result.getState().complete,blocked:()=>false};
  result.resultPart={id:'register',context:'system',label:'Read the final register',view:'front',focusOnComplete:false,available:()=>result.getState().complete};
  result.initialPart='system';result.initialView='front';result.frameVisibleOnly=true;result.framePadding=.72;result.selectionOutline=false;result.transparentBackground=true;
  result.frameBoundsForPart=id=>{if(!['system','carry-0'].includes(id))return null;root.updateWorldMatrix(true,false);const [lo,hi]=id==='system'?[[-88,-27,-54],[60,156,46]]:[[-10,91,11],[16,120,34]];return new THREE.Box3(new THREE.Vector3(...mm(lo)),new THREE.Vector3(...mm(hi))).applyMatrix4(root.matrixWorld);};
  for(const p of result.parts)if(p.id.startsWith('carry-')||p.id==='first-worm')p.maxZoom=30;
  result.topology={MM,system,pipes,pipeShells,chamber,walls,wetCover,seal,impeller,impellerHub,blades,inputShaft,firstWorm,worm1,frame,bearings,shaftB,wheel1,spurB,pointerDrive,spurC,counterDrive,spurD,worm2,dial,dialFace,needle,indicator,register,counterWheel,wheel2,axle,transferAxle,drums,transfers,carryMeshes,profiles,window,back,left,right,roof,floor,waterway,path,water,dots,textures,carryDimensions};
  const dispose=result.dispose;result.dispose=()=>{if(disposed)return;disposed=true;textures.forEach(t=>t.dispose());dispose();};pose();return result;
}

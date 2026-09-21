import * as THREE from 'three';
import {houseModel,reading as r} from './house-model-kit.js';
import {surface} from './scene-kit.js';
import {fixed} from './format.js';
import {cisternConstants as C,CISTERN_DEFAULTS as D,CISTERN_DOMAINS,CISTERN_FAULTS,createCisternTrial,sampleCistern,flushVolume} from './toilet-tank-physics.js';
export {cisternConstants,siphonDischarge,fillRate,flushVolume,maximumSiphonLift,siphonCeiling} from './toilet-tank-physics.js';
const MM=.016,TAU=2*Math.PI;
function plate(width,height,depth,holes=[]){
  const s=new THREE.Shape();s.moveTo(-width/2,-height/2);s.lineTo(width/2,-height/2);s.lineTo(width/2,height/2);s.lineTo(-width/2,height/2);s.closePath();
  for(const [x,y,radius]of holes)s.holes.push(new THREE.Path().absarc(x,y,radius,0,TAU,true));
  const g=new THREE.ExtrudeGeometry(s,{depth,bevelEnabled:false,curveSegments:40});g.translate(0,0,-depth/2);return g;
}
function ring(inner,outer,height){
  const s=new THREE.Shape().absarc(0,0,outer,0,TAU,false);s.holes.push(new THREE.Path().absarc(0,0,inner,0,TAU,true));
  const g=new THREE.ExtrudeGeometry(s,{depth:height,bevelEnabled:false,curveSegments:48});g.rotateX(-Math.PI/2);return g;
}
function shell(curve,radius,wall,start,span){
  const positions=[],index=[],along=100,around=24;
  for(let side=0;side<2;side++)for(let i=0;i<=along;i++){
    const p=curve.getPoint(i/along),t=curve.getTangent(i/along),n=new THREE.Vector3(-t.y,t.x,0);
    for(let j=0;j<=around;j++){const a=start+span*j/around,rr=radius+wall*side;positions.push(p.x+n.x*rr*Math.cos(a),p.y+n.y*rr*Math.cos(a),p.z+rr*Math.sin(a));}
  }
  const stride=around+1,offset=(along+1)*stride;
  const quad=(a,b,c,d)=>index.push(a,b,c,a,c,d);
  for(let i=0;i<along;i++)for(let j=0;j<around;j++){const a=i*stride+j;quad(a,a+1,a+stride+1,a+stride);quad(a+offset,a+stride+offset,a+stride+1+offset,a+1+offset);}
  for(let i=0;i<along;i++)for(const j of [0,around]){const a=i*stride+j;quad(a,a+stride,a+stride+offset,a+offset);}
  for(const i of [0,along])for(let j=0;j<around;j++){const a=i*stride+j;quad(a,a+offset,a+1+offset,a+1);}
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));g.setIndex(index);g.computeVertexNormals();return g;
}
export function createToiletTankModel(){
  const kit=houseModel('Toilet tank'),{root,part,control,finish,covers}=kit,mm=a=>a.map(x=>x*MM);
  const group=(id,label,description,pos,parent)=>part(id,label,description,mm(pos),parent);
  const box=(size,pos,color,parent)=>kit.box(mm(size),mm(pos),color,parent);
  const rod=(a,b,radius,color,parent)=>kit.rod(mm(a),mm(b),radius*MM,color,parent);
  const cylinder=(radius,height,pos,color,parent)=>kit.cylinder(radius*MM,height*MM,mm(pos),color,parent);
  const mesh=(geometry,pos,color,parent)=>{geometry.scale(MM,MM,MM);const object=surface(kit,geometry,color,parent,true);object.position.set(...mm(pos));return object;};
  const transparent=(o,opacity)=>{if(o.material.side!==THREE.DoubleSide)o.material=o.material.clone();o.material.transparent=true;o.material.opacity=opacity;o.material.depthWrite=false;return o;};
  const system=part('system','Siphon toilet tank','A lifted diaphragm primes the water passage. Gravity drives the flush, air stops tank suction, and the rising float closes the inlet.');
  const tank=group('tank','Cistern and lid','The 400 by 180 mm inner footprint gives the nominal 0.072 m² capacity model. Internal solid displacement is neglected. Look inside removes the front wall, right wall and lid.',[0,0,0],system);
  const floorGeometry=plate(412,192,8,[[150,30,26]]);floorGeometry.rotateX(Math.PI/2);
  const floor=mesh(floorGeometry,[0,-4,0],'cream',tank);
  box([412,344,6],[0,168,-93],'cream',tank);
  box([6,344,192],[-203,168,0],'cream',tank);
  const rightGeometry=plate(192,344,6,[[64,88,5.1]]);rightGeometry.rotateY(Math.PI/2);const right=mesh(rightGeometry,[203,168,0],'cream',tank);covers.push(right);
  const front=mesh(plate(400,340,6,[[185,150,5]]),[0,170,93],'cream',tank);covers.push(front);
  const lidGeometry=plate(418,198,8,[[60,-20,4]]);lidGeometry.rotateX(Math.PI/2);
  const lid=mesh(lidGeometry,[0,344,0],'cream',tank);covers.push(lid);
  const waterPart=group('water','Stored tank water','Transparent blue water follows the measured outside level. Extra water in the raised siphon passage is counted separately.',[0,0,0],system);
  const water=transparent(box([399,1,179],[0,.5,0],'blue',waterPart),.22);
  const siphon=group('siphon','Primed siphon passage','An open bell joins a narrow rising neck, a smooth bend and a falling leg. The outlet is 250 mm below the tank floor.',[0,0,0],system);
  const bell=group('bell','Open-bottom bell','Water enters below the 40 mm lip. The full bell holds water above the outside surface while siphoning.',[60,0,10],siphon);
  const profiles=[new THREE.Vector2(61,40),new THREE.Vector2(65,40),new THREE.Vector2(65,155),new THREE.Vector2(61,155),new THREE.Vector2(61,40)];
  const bellRear=mesh(new THREE.LatheGeometry(profiles,64,Math.PI/2,Math.PI),[0,0,0],'gold',bell);
  const bellFront=mesh(new THREE.LatheGeometry(profiles,64,-Math.PI/2,Math.PI),[0,0,0],'gold',bell);covers.push(bellFront);
  const lip=group('lip','Air-break lip','At 40 mm, air enters the bell and stops the tank from feeding the full siphon. Water already moving in the passage still runs out.',[0,40,0],bell);
  const lipRim=kit.ring(63*MM,1.4*MM,[0,0,0],'red',lip);lipRim.rotation.x=Math.PI/2;
  const cap=group('cap','Bell roof and rod seal','Separate holes carry the rising neck and the sealed lifting rod. The rod passes behind the bend.',[0,0,0],siphon);
  const capGeometry=bore=>{const s=new THREE.Shape().absarc(0,0,65,0,TAU,false);for(const [x,z,r]of [[-25,20,bore/2],[0,-30,3.1]])s.holes.push(new THREE.Path().absarc(x,z,r,0,TAU,true));const g=new THREE.ExtrudeGeometry(s,{depth:4,bevelEnabled:false,curveSegments:48});g.rotateX(Math.PI/2);return g;};
  const capMesh=mesh(capGeometry(32),[60,159,10],'gold',cap);
  const seal=mesh(ring(3.05,6,6),[60,158,-20],'ink',cap);
  const outlet=group('outlet','Hollow neck, bend and outlet','The selected bore sets the real inner radius of both legs. An open fitting crosses the tank floor.',[0,0,0],siphon);
  const curve=new THREE.CurvePath();curve.add(new THREE.LineCurve3(new THREE.Vector3(35,155,30),new THREE.Vector3(35,220,30)));
  class Bend extends THREE.Curve{getPoint(t){return new THREE.Vector3(92.5-57.5*Math.cos(Math.PI*t),220+57.5*Math.sin(Math.PI*t),30);}}
  curve.add(new Bend());curve.add(new THREE.LineCurve3(new THREE.Vector3(150,220,30),new THREE.Vector3(150,-250,30)));
  const rear=mesh(shell(curve,16,3,Math.PI,Math.PI),[0,0,0],'metal',outlet),pipeFront=mesh(shell(curve,16,3,0,Math.PI),[0,0,0],'metal',outlet);covers.push(pipeFront);
  const flange=mesh(ring(16,33,18),[150,-9,30],'ink',outlet);
  const piston=group('lifting-disk','Perforated disk and diaphragm','The membrane closes its ports on the lifting stroke. On return it opens so water can pass through. A torn membrane moves but cannot prime this idealized model.',[60,45,10],siphon);
  const diskShape=new THREE.Shape().absarc(0,0,60,0,TAU,false),ports=[];
  for(let i=0;i<10;i++){const a=i*TAU/10,x=43*Math.cos(a),z=43*Math.sin(a);diskShape.holes.push(new THREE.Path().absarc(x,z,9,0,TAU,true));ports.push([x,z]);}
  const diskGeo=new THREE.ExtrudeGeometry(diskShape,{depth:2,bevelEnabled:false,curveSegments:48});diskGeo.rotateX(Math.PI/2);
  const disk=mesh(diskGeo,[0,0,0],'clay',piston),flaps=[];
  for(const [x,z]of ports){const flap=new THREE.Group();flap.position.set(x*MM,.5*MM,(z-10)*MM);piston.add(flap);const leaf=cylinder(10,1,[0,0,10],'ink',flap);flaps.push({flap,leaf});}
  const actuator=group('actuator','Handle and lift linkage','A supported shaft, lever, crosshead and guided rod lift the diaphragm together.',[0,0,0],system);
  const linkage=group('handle','Flush handle and slotted linkage','A shaft turns the inside lever. Its pin slides across the lifting crosshead, keeping the piston rod vertical. Travel stops once the column is primed.',[185,320,20],actuator);
  const lever=new THREE.Group();linkage.add(lever);rod([0,0,-40],[0,0,88],4,'metal',lever);rod([0,0,0],[-125,0,0],3.5,'gold',lever);rod([0,0,85],[40,0,85],6,'gold',lever);
  const leverPin=cylinder(4,12,[-125,0,0],'ink',lever);leverPin.rotation.x=Math.PI/2;
  const crosshead=group('crosshead','Lifting crosshead and rod','The handle pin slides in the slot while the rod moves vertically through the bell seal and the lid.',[60,320,20],actuator);
  for(const y of [-6,6])box([90,4,10],[40,y,0],'metal',crosshead);
  for(const x of [-5,85])box([4,16,10],[x,0,0],'metal',crosshead);
  rod([0,0,0],[0,0,-40],3,'metal',crosshead);rod([0,0,-40],[0,-275,-40],3,'metal',crosshead);
  const supports=group('supports','Handle bearing and piston guides','Fixed bearings hold the handle shaft and the vertical piston rod.',[0,0,0],actuator);
  for(const z of [20,88]){const bearing=mesh(ring(4.05,8,8),[185,320,z],'ink',supports);bearing.rotation.x=Math.PI/2;}
  box([18,28,8],[185,320,84],'cream',supports);
  const guide=mesh(ring(3.05,7,10),[60,295,-20],'metal',supports);rod([60,295,-25],[60,295,-90],3,'metal',supports);
  const inlet=group('inlet','Supply pipe and float valve','Supply enters above the maximum water level. The float linkage opens the inlet as soon as the water falls, including during a flush.',[0,0,0],system);
  const supplyCurve=new THREE.LineCurve3(new THREE.Vector3(225,256,-64),new THREE.Vector3(182,256,-64));mesh(shell(supplyCurve,3,2,0,TAU),[0,0,0],'gold',inlet);
  for(const x of [156,182]){const g=plate(24,28,2,x===182?[[0,-10,3]]:[]);g.rotateY(Math.PI/2);mesh(g,[x,266,-64],'gold',inlet);}
  box([24,28,2],[169,266,-77],'gold',inlet);for(const [y,radius]of [[251.8,1.5],[281,4]]){const g=plate(28,28,1,[[0,0,radius]]);g.rotateX(Math.PI/2);mesh(g,[169,y,-64],'gold',inlet);}
  const valveHousing=box([24,28,2],[169,266,-51],'gold',inlet);covers.push(valveHousing);
  const floatPart=group('float','Float and rigid arm','The floating ball turns a 320 mm arm around its fixed pivot. A pin near that pivot raises a slotted valve follower. The fault holds this linkage down, so water can submerge the stuck float.',[180,250,-64],inlet);
  const floatArm=rod([0,0,0],[-320,0,0],2.3,'metal',floatPart),floatBall=kit.sphere(24*MM,[-320*MM,0,0],'clay',floatPart);
  rod([180,250,-68],[200,250,-68],3,'metal',inlet);const floatBearing=kit.ring(4*MM,1.5*MM,[180*MM,250*MM,-64*MM],'ink',inlet);
  const valvePin=cylinder(2.2,8,[-12,0,0],'metal',floatPart);valvePin.rotation.x=Math.PI/2;
  const valve=group('valve','Inlet seat, seal and slotted follower','Rising water raises the seal toward the adjusted seat. The slot allows the lever pin to move sideways. A jammed linkage holds the seal open and prevents the float from rising.',[169,0,-64],inlet);
  const follower=group('follower','Slotted valve follower','The nearby lever pin transfers float height to the vertical seal.',[0,0,0],valve);
  for(const y of [-2,2])box([14,1,5],[0,y,0],'metal',follower);
  for(const x of [-7,7])box([1,5,5],[x,0,0],'metal',follower);
  const stem=rod([0,0,0],[0,12,0],1.3,'metal',follower),plug=cylinder(3.8,1,[0,12,0],'ink',follower);
  const seatGeometry=plate(24,24,2,[[0,0,3.5]]);seatGeometry.rotateX(Math.PI/2);const seat=mesh(seatGeometry,[0,0,0],'gold',valve);
  const nozzle=group('nozzle','Air-gap discharge nozzle','Water passes the inlet seat and falls from a nozzle above the overflow level. The blue stream stops when the seal closes.',[0,0,0],inlet);
  const fillPath=new THREE.CurvePath();fillPath.add(new THREE.LineCurve3(new THREE.Vector3(169,270,-64),new THREE.Vector3(169,315,-64)));fillPath.add(new THREE.LineCurve3(new THREE.Vector3(169,315,-64),new THREE.Vector3(145,315,-64)));fillPath.add(new THREE.LineCurve3(new THREE.Vector3(145,315,-64),new THREE.Vector3(145,300,-64)));
  mesh(shell(fillPath,4,2,0,TAU),[0,0,0],'gold',nozzle);
  const fillWater=group('refill','Incoming water','Its rate follows supply pressure and valve opening. It is already flowing while the siphon lowers the tank.',[0,0,0],system);
  const jet=transparent(cylinder(3,1,[145,0,-64],'blue',fillWater),.7);
  const flowPart=group('stream','Water and air in the siphon','Blue markers trace direction through the connected passage. Marker speed is schematic. Stored water and cumulative inlet/outlet volumes are measured separately.',[0,0,0],siphon);
  const flowCurve=new THREE.CurvePath();flowCurve.add(new THREE.LineCurve3(new THREE.Vector3(60,45,10),new THREE.Vector3(35,155,30)));for(const segment of curve.curves)flowCurve.add(segment);
  const route=transparent(mesh(new THREE.TubeGeometry(curve,128,15.6,24,false),[0,0,0],'blue',flowPart),.38);
  const trickle=transparent(mesh(new THREE.TubeGeometry(curve,128,2,10,false),[0,0,0],'blue',flowPart),.7);
  const bellWater=transparent(cylinder(60.8,1,[60,100,10],'blue',flowPart),.24);
  const dots=Array.from({length:16},()=>kit.sphere(3.5*MM,[0,0,0],'blue',flowPart));
  const airPart=group('air','Air admitted under the lip','Air enters when the outside surface uncovers the bell inlet. After rundown the upper passage is vented.',[0,0,0],siphon);
  const bubbles=Array.from({length:7},()=>transparent(kit.sphere(3.2*MM,[0,0,0],'cream',airPart),.7));
  const outletWater=group('discharge','Discharge toward the bowl','All delivered water is counted, including retained-column rundown and overflow. Bowl performance is outside this lesson.',[0,0,0],system);
  const discharge=transparent(cylinder(8,32,[150,-266,30],'blue',outletWater),.7);
  const ignorePick=()=>{};
  for(const object of [waterPart,fillWater,flowPart,airPart,outletWater]){object.userData.explosionExcluded=true;object.traverse(child=>{if(child.isMesh)child.raycast=ignorePick;});}
  const controlCopy={
    level:['Float shutoff level','m','The selected level is below the spill point. A higher setting stores more water; this is a comparison, not a setting recommendation for a real bowl.'],
    bore:['Siphon bore','m','Changes the actual passage radius, gravity discharge and volume needed to prime.'],
    pressure:['Supply pressure','bar','Controls the inlet throughout the cycle. Zero isolates the supply after the initial tank has been filled.'],
    stroke:['Available priming stroke','m','The working diaphragm can lift this far, stopping early if the passage fills. A short stroke can return all displaced water without flushing.'],
    fault:['Condition','','Choose an intact mechanism, a torn diaphragm, or a two-minute observation of a stuck inlet valve.'],
    perDay:['Flushes per day','','Scales a completed normal cycle to annual use. It does not alter the mechanism.'],
  };
  for(const [key,domain]of Object.entries(CISTERN_DOMAINS)){const [label,unit,help]=controlCopy[key];control(key,label,...domain,D[key],unit,help,key==='fault'?CISTERN_FAULTS:undefined,{primary:key==='fault'});}
  let clock=0,lastClock=0,trial=null,signature='',lastBore=NaN,disposed=false;
  const renderState=values=>{
    const next=JSON.stringify(values);if(next!==signature){signature=next;trial=createCisternTrial(values);clock=0;}
    if(lastBore!==values.bore){lastBore=values.bore;route.geometry.dispose();route.geometry=new THREE.TubeGeometry(curve,128,values.bore*500-.4,24,false);route.geometry.scale(MM,MM,MM);capMesh.geometry.dispose();capMesh.geometry=capGeometry(values.bore*1000);capMesh.geometry.scale(MM,MM,MM);flange.geometry.dispose();flange.geometry=ring(values.bore*500,33,18);flange.geometry.scale(MM,MM,MM);for(const [object,start]of [[rear,Math.PI],[pipeFront,0]]){object.geometry.dispose();const g=shell(curve,values.bore*500,3,start,Math.PI);g.scale(MM,MM,MM);object.geometry=g;}}
    const s=sampleCistern(trial,clock),h=s.level*1000;
    water.scale.y=h;water.position.y=h/2*MM;
    piston.position.y=(45+s.lift*1000)*MM;crosshead.position.y=(320+s.lift*1000)*MM;lever.rotation.z=-Math.asin(Math.min(1,s.lift*1000/125));
    for(const {flap,leaf}of flaps){flap.rotation.x=s.stage==='siphoning'||s.stage==='rundown'||s.stage==='returning'&&s.lift>0||values.fault===2&&s.flow>0?-.9:0;leaf.visible=values.fault!==1;}
    const floatHeight=values.fault===2?values.level*1000-30:h;const angle=Math.asin((250-(floatHeight+4))/320);floatPart.rotation.z=angle;
    const pinY=250-12*Math.sin(angle),seatY=250-12*(250-(values.level*1000+4))/320+12.5;
    follower.position.y=pinY*MM;seat.position.y=(seatY+1)*MM;
    fillWater.visible=s.fill>1e-10;jet.position.y=(300+h)/2*MM;jet.scale.y=Math.max(.01,300-h);jet.scale.x=jet.scale.z=Math.sqrt(s.fill/C.fillAtOneBar);
    const flowing=s.flow>1e-10||s.stage==='priming'&&s.pipe>0||s.stage==='returning'&&s.pipe>0;
    flowPart.visible=flowing;route.visible=s.stage==='siphoning'||s.stage==='rundown';trickle.visible=values.fault===2&&s.flow>0;
    const retained=s.stage==='rundown'?Math.max(0,s.pipe/s.drainStart):1,waterHeight=Math.max(0,155-h)*retained;bellWater.visible=(s.stage==='siphoning'||s.stage==='rundown')&&waterHeight>0;bellWater.scale.y=waterHeight;bellWater.position.y=(155-waterHeight/2)*MM;const startSegment=s.stage==='rundown'?Math.floor((1-retained)*128):0;route.geometry.setDrawRange(startSegment*24*6,(128-startSegment)*24*6);
    const fraction=Math.max(.01,Math.min(1,s.pipe/Math.max(s.pipeCapacity,1e-9)));
    const transported=values.fault===2?s.outlet:s.primed?s.outlet+s.primeVolume:s.pipe;
    dots.forEach((dot,i)=>{const u=(transported*180+i/dots.length)%1;dot.visible=s.stage==='rundown'?u>=1-retained:s.stage==='siphoning'||values.fault===2&&s.flow>0||u<fraction;dot.position.copy(flowCurve.getPoint(u).multiplyScalar(MM));});
    airPart.visible=s.stage==='rundown';bubbles.forEach((bubble,i)=>bubble.position.set((30+5*Math.sin(i))*MM,(40+((s.time-(s.flushEnded??s.time))*75+i*14)%170)*MM,40*MM));
    outletWater.visible=s.flow>1e-10;discharge.scale.x=discharge.scale.z=Math.sqrt(s.flow/.0015);
    const outcome=s.complete?(values.fault===2?(s.outlet>0?'Observation ended · inlet still faulty':'Observation ended · no overflow at this supply'):!s.primed?(values.fault===1?'No flush · diaphragm cannot lift water':'No flush · stroke did not fill the passage'):values.pressure===0?'Flush complete · supply off, tank not refilled':'Flush complete · float closed the inlet'):s.stage==='ready'?(values.fault===2?'Ready · observe the stuck inlet':'Ready · press Play'):({priming:'Diaphragm lifting water into the passage',siphoning:'Siphon draining · inlet already responding',returning:'Stroke ended · displaced water returning',rundown:'Air admitted · remaining passage water running out',refilling:'Tank refilling · float rising',observing:s.flow>0?'Overflow trickling down the falling leg':'Stuck inlet raising the water'})[s.stage];
    const text=(n,d=2)=>fixed(n,d);
    return {state:{...s,blocked:false},readings:[
      r('Your result',outcome),r('Water level',`${text(h,1)} mm`,'Outside surface above the tank floor. The bell lip is at 40 mm.'),
      r('Water delivered',`${text(s.outlet*1000,3)} L`,'Cumulative discharge, including rundown or overflow.'),r('Supply water admitted',`${text(s.inlet*1000,3)} L`,'The ordinary float valve can open before the flush ends.'),
      r('Discharge now',`${text(s.flow*1000,3)} L/s`),r('Inlet now',`${text(s.fill*1000,3)} L/s`),
      r('Float valve',`${text(s.valveOpening*100,1)}% open`,values.fault===2?'Jammed linkage holds the seal open; rising water submerges the stuck float.':'The final 30 mm of rising level progressively closes the valve.'),
      r('Upper-passage storage',`${text(s.pipe*1000,3)} L`,'Water held above the outside surface, in the bend and in the falling leg. It is included in the balance.'),
      r('Priming',s.primed?`Column filled at ${text(s.primeAt,3)} s`:values.fault===1?'Torn diaphragm · no pumped volume':s.complete?'Stroke insufficient':'Not yet primed'),
      r('Spill point',`${text(s.spill*1000,1)} mm`,'Above this height, an inlet fault can send water over the siphon bend without a normal flush.'),
      r('Stored charge above lip',`${text(flushVolume(values.level),3)} L`,'Nominal tank area times level drop. Actual delivery also includes water admitted before suction ends and during rundown.'),
      r('Cycle total',values.fault===2?'Two-minute fault observation':`${text(s.perFlush,3)} L`,values.fault===2?'Overflow rate and observed waste are shown above.': 'Prediction for these settings, including the priming result and concurrent inlet.'),
      r('Annual repeated use',values.fault===2?'Not extrapolated from a fault trial':values.pressure===0?'Supply off · no automatic repeat':`${text(s.perYear,2)} m³`,`${values.perDay} completed cycles per day. Initial filling is not counted as a repeated flush.`),
      r('Water balance residual',`${text(Math.abs(s.balance)*1e6,6)} mL`,'Inlet minus outlet minus tank-volume change minus passage-volume change.'),
      r('Physical clock',`${text(s.time,2)} s`),r('Playback clock',`${text(s.screen,2)} / ${text(s.screenDuration,2)} s`,'Flush and rundown use real time. Refill is 10×; the two-minute fault observation is 6×.'),
      r('Model limit','Illustrative cistern, not bowl performance','Ideal diaphragm pump and float linkage; chosen flow coefficients; solid displacement neglected. Post-air-entry rundown is prescribed, not a two-phase flow solution.'),
    ]};
  };
  const result=finish(renderState,{animated:true}),render=result.update;
  result.advance=dt=>{if(Number.isFinite(dt)&&dt>0)clock=Math.min(trial.duration,clock+dt);return render();};
  result.animate=t=>{const dt=Number.isFinite(t)?Math.max(0,t-lastClock):0;if(Number.isFinite(t))lastClock=t;return result.advance(dt);};
  const pose=()=>root.rotation.set(.16,-.22,0);
  result.reset=()=>{clock=lastClock=0;signature='';pose();return render(D);};
  const at=(label,getTime)=>({label,part:'system',view:'front',isolate:false,group:'Run',replay:false,run(){clock=getTime();pose();return render();}});
  result.actions=[at('Start again',()=>0),at('Inspect priming',()=>Math.min(.15,trial.duration)),at('Inspect the falling level',()=>trial.states.find(s=>s.stage==='siphoning'&&s.level<.1)?.screen??trial.duration),at('Inspect air entering',()=>trial.states.find(s=>s.stage==='rundown')?.screen??trial.duration),at('Finish the trial',()=>trial.duration),
    ...[['See the diaphragm','lifting-disk'],['See the float valve','inlet'],['See the whole tank','system']].map(([label,id])=>({label,part:id,view:'front',isolate:false,group:'Look closer',replay:false,run(){pose();return render();}}))];
  result.playback={label:'Run the tank',description:'Follow priming, discharge, air entry and refill. Refill plays 10× faster; the stuck-inlet observation plays 6×. Completion holds the result; Play repeats the selected trial.',stepLabel:'Advance 0.1 screen second',advance:result.advance,step:()=>result.advance(.1),complete:()=>result.getState().complete,blocked:()=>false};
  result.initialPart='system';result.initialView='front';result.frameVisibleOnly=true;result.framePadding=.5;result.transparentBackground=true;result.selectionOutline=false;
  result.resultPart={id:'lip',context:'system',view:'front',focusOnComplete:false,label:'Inspect the air-break lip',available:()=>result.getState().complete};
  result.frameBoundsForPart=id=>{if(id!=='system')return null;root.updateWorldMatrix(true,false);return new THREE.Box3(new THREE.Vector3(...mm([-210,-285,-100])),new THREE.Vector3(...mm([230,425,118]))).applyMatrix4(root.matrixWorld);};
  result.topology={MM,system,tank,floor,front,right,lid,water,siphon,bell,bellRear,bellFront,lip,capMesh,seal,curve,rear,pipeFront,flange,piston,disk,flaps,linkage,lever,leverPin,crosshead,supports,guide,inlet,floatPart,floatArm,floatBall,valvePin,valve,follower,stem,plug,seat,nozzle,jet,flowCurve,route,trickle,bellWater,dots,bubbles,discharge};
  const dispose=result.dispose;result.dispose=()=>{if(disposed)return;disposed=true;dispose();};pose();return result;
}

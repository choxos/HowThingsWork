import * as THREE from 'three';
import {houseModel,reading as r} from './house-model-kit.js';
import {fixed} from './format.js';
import {surface,solidArrow,lineObject,fillLine} from './scene-kit.js';
import {sampleWasher,washerPlan,BEARINGS,WASHER,WASHER_DEFAULTS as D,WASHER_DOMAINS} from './dishwasher-physics.js';

const MM=.005,M=1000*MM,TAU=2*Math.PI,NEWTON=100*MM;
const ARM={y:150,half:200,width:52,thick:16},TIP=190,SUMP={radius:230,inner:100,floor:50};
const PLATES=Array.from({length:8},(_,i)=>({x:-210+i*60,y:470,z:0,radius:105,thickness:4}));
const JET_SECONDS=.09,JET_POINTS=32;
const COLD=new THREE.Color(0x83b4c1),HOT=new THREE.Color(0xdd9560);
const STAGE_COLORS={fill:0x83b4c1,heat:0xd9822b,wash:0x2f6690,drain:0x718273,rinse:0x6fa3c8,dry:0xe3b45e};
export const armNozzles=()=>[{x:TIP,tip:true},{x:-TIP,tip:true},...WASHER.cleanRadii.map((r,i)=>({x:(i%2?-1:1)*r*1000,tip:false}))];
function annulus(inner,outer,height){
  const shape=new THREE.Shape();shape.absarc(0,0,outer*MM,0,TAU,false);
  const hole=new THREE.Path();hole.absarc(0,0,inner*MM,0,TAU,true);shape.holes.push(hole);
  const g=new THREE.ExtrudeGeometry(shape,{depth:height*MM,bevelEnabled:false,curveSegments:48});g.rotateX(-Math.PI/2);return g;
}
// Ballistic droplet flight ends at the first plate face or cabinet boundary.
// Spray breakup, rack wires, splashing and films are outside this jet model.
export function jetFlight(start,velocity,maxTime=JET_SECONDS){
  let end=maxTime;const g=9.81;
  for(const [axis,low,high]of [[0,-.292,.292],[2,-.292,.292]])if(Math.abs(velocity[axis])>1e-12){const t=((velocity[axis]>0?high:low)-start[axis])/velocity[axis];if(t>=0)end=Math.min(end,t);}
  const topDisc=velocity[1]**2-2*g*(.808-start[1]);if(topDisc>=0){const t=(velocity[1]-Math.sqrt(topDisc))/g;if(t>=0)end=Math.min(end,t);}
  if(Math.abs(velocity[0])>1e-12)for(const p of PLATES)for(const face of [-1,1]){
    const t=((p.x+face*p.thickness/2)/1000-start[0])/velocity[0];
    if(t>0&&t<end){const y=start[1]+velocity[1]*t-.5*g*t*t,z=start[2]+velocity[2]*t;if((y-p.y/1000)**2+(z-p.z/1000)**2<=(p.radius/1000)**2)end=t;}
  }
  return end;
}
export function createDishwasherModel({sprayArmLesson=false}={}){
  const kit=houseModel('Dishwasher'),{root,part,control,finish,covers}=kit;
  const box=(size,pos,color,parent)=>kit.box(size.map(v=>v*MM),pos.map(v=>v*MM),color,parent);
  const rod=(a,b,radius,color,parent)=>kit.rod(a.map(v=>v*MM),b.map(v=>v*MM),radius*MM,color,parent);
  const transparent=(mesh,opacity)=>{mesh.material=mesh.material.clone();mesh.material.transparent=true;mesh.material.opacity=opacity;mesh.material.depthWrite=false;return mesh;};
  const system=part('system','Dishwasher','A book-based cutaway with one rack and one reaction-driven spray arm. Follow fresh water through the softener, filter and pump, then out through the drain. Dimensions are shared throughout this illustrative machine.');
  const cabinet=part('cabinet','Cabinet and sump','The sealed tub contains the spray. Front and right panels are removed by Look inside; the circular sump collects returning water.',[0,0,0],system);
  box([600,8,600],[0,-76,0],'metal',cabinet);box([600,900,8],[0,370,-300],'metal',cabinet);box([8,900,600],[-300,370,0],'metal',cabinet);box([600,8,600],[0,816,0],'metal',cabinet);
  covers.push(box([8,900,600],[300,370,0],'metal',cabinet));
  const door=new THREE.Group();cabinet.add(door);covers.push(door);
  box([600,900,12],[0,370,300],'cream',door);box([520,45,6],[0,775,309],'ink',door);
  box([180,12,18],[0,725,315],'metal',door);box([80,24,3],[160,775,314],'blue',door);
  for(const x of [-215,-175])kit.sphere(5*MM,[x*MM,775*MM,315*MM],'gold',door);
  const sumpFloor=surface(kit,annulus(SUMP.inner,SUMP.radius+4,4),'metal',cabinet);sumpFloor.position.y=46*MM;
  const sumpRim=surface(kit,annulus(SUMP.radius,SUMP.radius+4,40),'metal',cabinet);sumpRim.position.y=50*MM;
  for(const x of [-250,250])for(const z of [-250,250])box([28,25,28],[x,-92,z],'ink',cabinet);
  for(const x of [-155,155])for(const z of [-155,155])rod([x,-72,z],[x,46,z],6,'metal',cabinet);
  for(const side of [-1,1])for(const z of [-200,200])box([46,10,20],[side*273,332,z],'metal',cabinet);

  const rack=part('rack','Rack and dishes','Eight vertical plates, separated by 56 mm gaps. Rails support their lower edges and paired prongs hold them upright. The modeled ceramic load is 2.4 kg.',[0,0,0],system);
  const supportY=470-Math.sqrt(105**2-60**2)-2.5;
  for(const z of [-60,60])rod([-250,supportY,z],[250,supportY,z],2.5,'ink',rack);
  for(const z of [-230,230])for(const y of [360,380])rod([-250,y,z],[250,y,z],2.5,'ink',rack);
  for(let x=-240;x<=240;x+=60)rod([x,360,-230],[x,360,230],2,'ink',rack);
  const plates=PLATES.map(p=>{const m=kit.cylinder(p.radius*MM,p.thickness*MM,[p.x*MM,p.y*MM,0],'cream',rack);m.rotation.z=Math.PI/2;m.material=m.material.clone();for(const x of [p.x-6,p.x+6])for(const z of [-60,60])rod([x,360,z],[x,430,z],2,'metal',rack);return m;});
  for(const x of [-250,250]){rod([x,360,-230],[x,360,230],3,'ink',rack);for(const z of [-180,180]){const wheel=kit.cylinder(14*MM,10*MM,[x*MM,350*MM,z*MM],'ink',rack);wheel.rotation.z=Math.PI/2;}box([20,10,510],[x,332,0],'metal',cabinet);}

  const water=part('water','Water in the sump','Water starts empty, fills to 3 L, recirculates and drains. Pool volume matches the reading. Water retained in pipes or on dishes is excluded.',[0,0,0],system);
  const pool=transparent(surface(kit,annulus(SUMP.inner,SUMP.radius,1),'blue',water),.6);
  const heater=part('heater','Base heater','A 1.8 kW element bonded below the sump floor heats the water and dishes. Orange indicates electric power, not a red-hot operating temperature.',[0,0,0],system);
  const element=kit.ring(180*MM,4*MM,[0,42*MM,0],'metal',heater);element.rotation.x=Math.PI/2;element.material=element.material.clone();
  rod([-180,42,0],[-240,42,0],4,'metal',heater);box([28,18,24],[-245,42,0],'ink',heater);

  const filter=part('filter','Return filter','Water flows from the sump through this porous screen to the pump. It catches scraps; this model does not simulate dirt or clogging.',[0,0,0],system);
  for(const y of [50,60,70,80]){const ring=kit.ring(100*MM,1.5*MM,[0,y*MM,0],'metal',filter);ring.rotation.x=Math.PI/2;}
  for(let i=0;i<32;i++){const a=i*TAU/32;rod([100*Math.cos(a),50,100*Math.sin(a)],[100*Math.cos(a),80,100*Math.sin(a)],1,'metal',filter);}
  const funnel=surface(kit,new THREE.CylinderGeometry(100*MM,60*MM,40*MM,48,1,true),'metal',filter,true);funnel.position.y=30*MM;

  const pipeRoutes=[];
  function pipe(points,radius,color,parent,active){
    const curve=new THREE.CatmullRomCurve3(points.map(p=>new THREE.Vector3(...p.map(v=>v*MM))),false,'centripetal');
    const mesh=transparent(surface(kit,new THREE.TubeGeometry(curve,80,radius*MM,16,false),color,parent,true),.36);
    const dots=Array.from({length:5},()=>kit.sphere(radius*.45*MM,[0,0,0],'blue',parent));
    pipeRoutes.push({curve,mesh,dots,active});return mesh;
  }
  const pump=part('pump','Circulation pump','An electric motor turns the impeller. Filtered water enters its center; the outlet feeds the hollow arm. Dots show flow direction at a reduced schematic speed.',[0,0,0],system);
  const casingProfile=[[0,-18],[65,-18],[65,14],[61,14],[61,-14],[0,-14]].map(([x,y])=>new THREE.Vector2(x*MM,y*MM));
  surface(kit,new THREE.LatheGeometry(casingProfile,48,Math.PI/2,Math.PI*1.6),'metal',pump,true);
  box([60,10,50],[0,-67,0],'metal',pump);kit.cylinder(42*MM,40*MM,[0,-42*MM,0],'ink',pump);rod([0,-22,0],[0,8,0],5,'metal',pump);
  const impeller=new THREE.Group();impeller.position.y=0;pump.add(impeller);
  kit.cylinder(55*MM,4*MM,[0,0,0],'gold',impeller);
  for(let i=0;i<6;i++){const a=i*TAU/6,m=box([43,9,4],[30*Math.cos(a),6,-30*Math.sin(a)],'gold',impeller);m.rotation.y=a;}
  pipe([[60,0,0],[90,0,0],[90,100,0],[0,100,0],[0,142,0]],10,'blue',pump,'pump');

  const softener=part('softener','Water softener','Incoming water crosses an ion-exchange resin bed before entering the sump. Resin chemistry and salt regeneration are explained but not simulated.',[0,0,0],system);
  for(const y of [110,210])box([12,14,30],[-291,y,-180],'metal',softener);
  const softCase=transparent(box([60,160,70],[-255,160,-180],'cream',softener),.32);
  for(let i=0;i<24;i++)kit.sphere(7*MM,[(-273+(i%3)*18)*MM,(105+Math.floor(i/6)*32)*MM,(-195+(Math.floor(i/3)%2)*30)*MM],'gold',softener);
  pipe([[-255,80,-180],[-255,110,-180],[-255,210,-180],[-255,240,-180]],8,'blue',softener,'fill');
  const inlet=part('inlet','Fresh-water inlet and valve','The valve admits 4 L/min during each 45-second fill, then closes. The outlet sits above the sump waterline.',[0,0,0],system);
  pipe([[-360,80,-180],[-320,80,-180],[-255,80,-180]],8,'blue',inlet,'fill');
  const valve=box([24,30,24],[-325,80,-180],'gold',inlet);
  pipe([[-255,240,-180],[-255,250,30],[-210,250,30],[-210,85,30]],8,'blue',inlet,'fill');
  const inletStream=kit.cylinder(4*MM,1,[-210*MM,0,30*MM],'blue',inlet);

  const drain=part('drain','Drain pump and hose','A separate pump empties 3 L in one minute. The hose rises in a high loop before reaching the drain. This prescribed flow has no backflow or plumbing-loss simulation.',[0,0,0],system);
  kit.cylinder(26*MM,32*MM,[210*MM,-20*MM,170*MM],'ink',drain);box([35,36,35],[210,-54,170],'metal',drain);
  pipe([[40,-10,35],[150,-25,110],[210,-20,170]],9,'blue',drain,'drain');
  pipe([[210,-20,170],[325,-20,170],[335,700,-170],[350,720,-220],[380,-20,-320]],9,'blue',drain,'drain');

  const arm=part('spray-arm','Rotating spray arm','Pump pressure feeds this open cutaway channel. Backward-leaning tip jets drive rotation; upright jets also carry angular momentum and resist rotation.',[0,ARM.y*MM,0],system);
  box([400,2,52],[0,-7,0],'gold',arm);for(const z of [-25,25])box([400,14,2],[0,1,z],'gold',arm);for(const x of [-199,199])box([2,14,48],[x,1,0],'gold',arm);
  const hub=surface(kit,annulus(10,15,24),'gold',arm);hub.position.y=-24*MM;
  // Feed bore continues through the bottom of the cutaway arm.
  const bottom=arm.children[0];bottom.geometry.dispose();
  const bottomShape=new THREE.Shape();bottomShape.moveTo(-200*MM,-26*MM);bottomShape.lineTo(200*MM,-26*MM);bottomShape.lineTo(200*MM,26*MM);bottomShape.lineTo(-200*MM,26*MM);bottomShape.closePath();
  const bore=new THREE.Path();bore.absarc(0,0,10*MM,0,TAU,true);bottomShape.holes.push(bore);bottom.geometry=new THREE.ExtrudeGeometry(bottomShape,{depth:2*MM,bevelEnabled:false,curveSegments:32});bottom.geometry.rotateX(-Math.PI/2);bottom.position.y=-8*MM;
  const tipPart=part('tip-nozzles','Driving tip nozzles','Two open bores have the selected inside diameter. Their outlet centers stay at 190 mm radius while their backward tilt changes. The close view frames the right-hand nozzle.',[0,0,0],arm);
  const tipNozzles=[1,-1].map(side=>{const id=side>0?'right-tip-nozzle':'left-tip-nozzle',owner=part(id,side>0?'Right driving nozzle':'Left driving nozzle','An open tip bore. Change its inside diameter and backward tilt, then compare flow and arm speed.',[0,0,0],tipPart);kit.parts.find(p=>p.id===id).maxZoom=180;const m=surface(kit,new THREE.BufferGeometry(),'metal',owner);m.userData.side=side;return m;});
  const cleaning=part('cleaning-nozzles','Upright cleaning nozzles','Six open 1.6 mm bores at 60, 120 and 170 mm radius. Their momentum flux differs slightly with radius; it is not a cleaning-efficiency prediction.',[0,0,0],arm);
  const cleanNozzles=armNozzles().filter(n=>!n.tip).map(n=>{const m=surface(kit,annulus(.8,1.6,12),'ink',cleaning);m.position.set(n.x*MM,8*MM,0);return m;});
  const reaction=part('reaction','Jet reaction arrows','Tangential reaction from each tip jet, 100 mm per newton. Diagram arrows, not machine parts.',[0,0,0],arm);reaction.userData.explosionExcluded=true;
  const pushes=[1,-1].map(side=>{const m=solidArrow(kit,0x2f6690,reaction,2*MM);m.position.set(side*TIP*MM,0,0);m.userData.setDirection(new THREE.Vector3(0,0,-side));return m;});
  const spoon=part('spoon','Obstructing spoon','A spoon hangs through the rack and touches the arm’s leading edge. The blocked setting holds the arm while water still flows.',[0,0,0],system);
  box([6,205,6],[120,262.5,-32],'metal',spoon);box([18,12,12],[120,154,-32],'metal',spoon);rod([120,365,-32],[120,365,-10],3,'metal',spoon);

  const spray=part('spray','Water jets','Blue trails follow water emitted from moving nozzles, with gravity, until the first plate or wall. Breakup, wire impacts, splashing and return films are not resolved.',[0,0,0],system);spray.userData.explosionExcluded=true;
  const jetLines=armNozzles().map(()=>lineObject(JET_POINTS,0x3f7fb0,spray));
  const cycle=part('cycle','Cycle timeline','Relative stage durations and cycle position. The cycle clock runs 180 times faster; arm dynamics use playback seconds.',[-300*MM,875*MM,0],system);cycle.userData.explosionExcluded=true;
  const segments=Array.from({length:9},()=>{const m=box([1,15,15],[0,0,0],'cream',cycle);m.material=m.material.clone();return m;});
  const clockDot=kit.sphere(10*MM,[0,0,0],'red',cycle);
  const specs={pump:['Pump shutoff pressure','kPa',null,'Pressure at zero flow. Working pressure falls as flow increases.'],tilt:['Tip jet tilt','degrees',null,'Backward tilt from vertical. Zero tilt gives no driving torque.'],nozzle:['Tip bore diameter','mm',null,'Inside diameter of both driving nozzles. Geometry and flow change together.'],bearing:['Arm condition','',BEARINGS.map(({value,label})=>({value,label})),'Compare free rotation, extra friction and a spoon obstruction.'],temperature:['Wash temperature','°C',null,'The rinse target is 10 °C hotter, capped at 75 °C.']};
  for(const [key,[min,max,step]]of Object.entries(WASHER_DOMAINS)){if(sprayArmLesson&&key==='temperature')continue;const [label,unit,options,help]=specs[key];control(key,label,min,max,step,D[key],unit,help,options,{primary:key==='bearing'});}
  const sample=(values,time)=>{
    // The component lesson observes the first six seconds after pump startup.
    // Reuse the parent's continuous mechanics, skipping its preceding fill.
    const s=sampleWasher(values,time+(sprayArmLesson?WASHER.fill/WASHER.fillRate/WASHER.speedUp:0));
    return sprayArmLesson?{...s,elapsed:time,duration:6,complete:time>=6}:s;
  };
  let elapsed=0,lastClock=0,shape='',disposed=false;
  const result=finish(values=>{
    const s=sample(values,elapsed),tilt=values.tilt*Math.PI/180,key=JSON.stringify(values);
    arm.rotation.y=s.armAngle;impeller.rotation.y=s.impellerAngle;spoon.visible=values.bearing===2;
    if(key!==shape){shape=key;
      tipNozzles.forEach(m=>{m.geometry.dispose();m.geometry=annulus(values.nozzle/2,values.nozzle/2+.8,12/Math.cos(tilt));m.rotation.x=m.userData.side*tilt;m.position.set(m.userData.side*TIP*MM,8*MM,-m.userData.side*12*Math.tan(tilt)*MM);});
      let x=0;s.stages.forEach((stage,i)=>{const width=stage.duration/s.total*600;segments[i].scale.x=width;segments[i].position.x=(x+width/2)*MM;segments[i].material.color.set(STAGE_COLORS[stage.name]);x+=width;});
    }
    const level=s.stored/1000/(Math.PI*((SUMP.radius/1000)**2-(SUMP.inner/1000)**2))*1000;
    pool.scale.y=Math.max(1e-6,level);pool.position.y=SUMP.floor*MM;pool.visible=s.stored>1e-8;
    const warmth=Math.max(0,Math.min(1,(s.temperature-15)/60));pool.material.color.copy(COLD).lerp(HOT,warmth);
    plates.forEach(m=>m.material.color.set(0xf0dfaf).lerp(HOT,warmth*.35));
    element.material.color.set(s.stage==='heat'?0xd9822b:s.stage==='wash'||s.stage==='rinse'?0xc7a26b:0xb4c5b0);
    inletStream.visible=s.stage==='fill'&&s.elapsed>0&&!s.complete;inletStream.scale.y=(85-SUMP.floor-level)*MM;inletStream.position.y=(85+SUMP.floor+level)/2*MM;
    for(const route of pipeRoutes)route.dots.forEach((dot,i)=>{dot.visible=(!s.complete||sprayArmLesson)&&s.elapsed>0&&(route.active==='pump'?s.pumping:s.stage===route.active);dot.position.copy(route.curve.getPointAt((elapsed*.4+i/route.dots.length)%1));});
    const force=s.operating?WASHER.density*s.operating.jets[0].flow*s.operating.jets[0].backward:0;
    pushes.forEach(m=>m.userData.setLength(Math.max(0,force)*NEWTON));
    // Each point represents a different, earlier emission. Nozzle motion is
    // therefore included rather than attaching an already-emitted jet to the arm.
    const history=Array.from({length:JET_POINTS},(_,i)=>{const age=i*(sprayArmLesson ? .035 : JET_SECONDS)/(JET_POINTS-1);return {age,state:elapsed>=age?sample(values,elapsed-age):null};});
    const list=armNozzles();
    list.forEach((n,i)=>{
      const points=[];
      for(const {age,state:h}of history){if(!h?.pumping)continue;
        const theta=h.armAngle,radius=n.x/1000,side=Math.sign(radius),cos=Math.cos(theta),sin=Math.sin(theta),jet=h.operating.jets[i];
        const start=[radius*cos,(ARM.y+20)/1000,-radius*sin],back=n.tip?side*jet.speed*Math.sin(tilt):0;
        const tangent=h.armSpeed*radius-back,velocity=[-sin*tangent,jet.up,-cos*tangent],hit=sprayArmLesson ? .035 : jetFlight(start,velocity);
        if(age>hit)break;
        points.push([(start[0]+velocity[0]*age)*M,(start[1]+velocity[1]*age-4.905*age*age)*M,(start[2]+velocity[2]*age)*M]);
      }
      fillLine(jetLines[i],points);
    });
    clockDot.position.set(s.clock/s.total*600*MM,0,15*MM);
    const minutes=v=>fixed(v/60,1),run=s.operating;
    if(sprayArmLesson){
      const tipTorque=run.jets.filter(n=>n.tip).reduce((sum,n)=>sum+WASHER.density*n.flow*n.radius*n.backward,0);
      const uprightBrake=-run.jets.filter(n=>!n.tip).reduce((sum,n)=>sum+WASHER.density*n.flow*n.radius*n.backward,0);
      const resistance=values.bearing===2?run.jetTorque:s.armSpeed>0?BEARINGS[values.bearing].torque+WASHER.drag*s.armSpeed:Math.min(BEARINGS[values.bearing].torque,run.jetTorque);
      return {state:{...s,reaction:force,tipTorque,uprightBrake,resistance},readings:[
        r('Your result',s.complete?'Trial ended · pump-on snapshot':s.stuck?values.bearing===2?'Spoon holds the spraying arm':'Jets cannot overcome static friction':elapsed===0?'Pump switched on · arm at rest':'Arm accelerating toward steady speed'),
        r('Time since pump start',`${fixed(elapsed,2)} / 6.00 s`,'Playback seconds are mechanical seconds. Completion holds a snapshot; it does not switch off the pump.'),
        r('Arm speed now',`${fixed(s.armSpeed*60/TAU,1)} rpm`),
        r('Steady speed prediction',`${fixed(s.rpm,1)} rpm`,'The speed where driving and resisting torques balance.'),
        r('Time to 90% speed',s.spinUp===null?'No rotation':`${fixed(s.spinUp,2)} s`,'Measured from pump startup, with the selected inertia and friction.'),
        r('Working pump',`${fixed(run.pressure/1000,1)} kPa · ${fixed(run.flow*60000,1)} L/min`,'Shutoff pressure is the control setting. Flow lowers the actual pressure.'),
        r('Two-tip driving torque',`${fixed(tipTorque*1000,2)} N·mm`,'Sum of both tip jets’ angular-momentum contributions.'),
        r('Upright-jet braking torque',`${fixed(uprightBrake*1000,2)} N·mm`,'The six upright jets carry forward momentum away from their moving outlets.'),
        r(values.bearing===2?'Spoon resisting torque':'Bearing and drag resistance',`${fixed(resistance*1000,2)} N·mm`,'Static friction supplies only the torque needed to hold a still arm, up to its limit.'),
        r('Net accelerating torque',`${fixed(run.net*1000,2)} N·mm`,'Tip drive minus upright-jet braking and support resistance.'),
        r('Tip jet relative to nozzle',`${fixed(run.tipSpeed,2)} m/s`,'Total water speed relative to the moving nozzle.'),
        r('Backward jet / forward nozzle',`${fixed(run.tipSpeed*Math.sin(tilt),2)} / ${fixed(s.armSpeed*WASHER.tipRadius,2)} m/s`,'Subtract forward nozzle speed from the relative backward jet component.'),
        r('Tip jet in room',`${fixed(run.jets[0].backward,2)} m/s backward · ${fixed(run.jets[0].up,2)} m/s up`,'These components determine the room-frame trajectory, with gravity after emission.'),
      ]};
    }
    return {state:{...s,reaction:force,level},readings:[
      r('Your result',s.elapsed===0?'Ready · empty sump':s.complete?'Cycle ended · load cooling, dryness not predicted':s.stageLabel),
      r('Cycle clock',`${minutes(s.clock)} / ${minutes(s.total)} min`,'180 cycle seconds per playback second. Arm motion uses playback time.'),
      r('Water in sump',`${fixed(s.stored,2)} L`,'Fresh water enters twice; recirculation reuses the same water.'),
      r('Fresh water / drained',`${fixed(s.waterUsed,2)} / ${fixed(s.drained,2)} L`,'Fresh water minus drained water equals the sump volume.'),
      r('Water and load temperature',s.stored>1e-8?`${fixed(s.temperature,1)} °C`:`Load ${fixed(s.temperature,1)} °C · sump empty`,'One mixed temperature for water and a 2.4 kg ceramic load. Remaining load keeps heat after draining.'),
      r('Arm speed now',`${fixed(s.armSpeed*60/TAU,1)} rpm`,s.stuck?'Blocked or insufficient driving torque.':`Steady prediction ${fixed(s.rpm,1)} rpm; 90% startup in ${fixed(s.spinUp,2)} playback s. Coasts when the pump stops.`),
      r('Pump now',run?`${fixed(run.pressure/1000,1)} kPa · ${fixed(run.flow*60000,1)} L/min`:'Off'),
      r('Steady pump prediction',`${fixed(s.run.pressure/1000,1)} kPa · ${fixed(s.run.flow*60000,1)} L/min`,'Illustrative pump curve, ideal nozzles; pipe pressure losses are omitted.'),
      r('Starting jet torque',`${fixed(s.stallTorque*1000,1)} N·mm`,values.bearing===2?'The spoon prevents rotation.':`Bearing friction ${fixed(BEARINGS[values.bearing].torque*1000,1)} N·mm.`),
      r('Tip jet now',run?`${fixed(run.tipSpeed,2)} m/s relative; ${fixed(run.jets[0].backward,2)} m/s backward in room`:'No jet'),
      r('Recirculated volume',`${fixed(s.recirculated,1)} L`,'Steady-flow cycle estimate, not extra fresh water. Startup hydraulic energy and transient throughput are omitted.'),
      r('First heating stage',`${minutes(s.heatTime)} min`,'Heats the water and ceramic load, allowing for heat loss.'),
      r('Energy used',`${fixed(s.energyUsed/3.6e6,3)} / ${fixed(s.energy/3.6e6,3)} kWh`,'Heater plus steady circulation-pump electricity. Inlet valve, drain motor, controls and evaporation are excluded.'),
    ]};
  });
  const render=result.update;
  result.update=(next={})=>{const before=result.getState().values,readings=render(next);if(Object.keys(D).some(k=>before[k]!==result.getState().values[k])){elapsed=0;return render();}return readings;};
  result.advance=dt=>{if(Number.isFinite(dt)&&dt>0)elapsed=Math.min(sprayArmLesson?6:washerPlan(result.getState().values).total/WASHER.speedUp,elapsed+dt);return render();};
  result.animate=t=>{const dt=Number.isFinite(t)?Math.max(0,t-lastClock):0;if(Number.isFinite(t))lastClock=t;return result.advance(dt);};
  result.reset=()=>{elapsed=lastClock=0;root.rotation.set(...(sprayArmLesson?[.5,-.4,0]:[.18,-.5,0]));return render(result.defaults);};
  const at=(index,share)=>{const p=washerPlan(result.getState().values),s=p.stages[index];elapsed=(s.start+share*s.duration)/WASHER.speedUp;return render();};
  result.actions=[
    ...[['Half a fill',0,.5],['Heat the wash water',1,.5],['Run the wash',2,.3],['Half a drain',3,.5],['Fresh rinse fill',4,.5],['Hot rinse',6,.5],['Finish the cycle',8,1]].map(([label,index,share])=>({label,part:'system',view:'front',isolate:false,group:'Run',replay:false,run:()=>at(index,share)})),
    ...[['See the spray arm','spray-arm','top'],['See a tip nozzle','right-tip-nozzle','top'],['See the pump','pump','top'],['See the filter','filter','front'],['See the heater','heater','top'],['See the whole machine','system','front']].map(([label,id,view])=>({label,part:id,view,isolate:id!=='system',group:'Look closer',replay:false,run(){root.rotation.set(...(id==='system'?[.18,-.5,0]:[0,0,0]));if(id==='right-tip-nozzle')root.quaternion.copy(arm.quaternion).multiply(tipNozzles[0].quaternion).invert();return render();}})),
  ];
  result.playback={label:'Run a dishwasher cycle',description:'Follow two fills, heating, recirculation, draining and a cooling phase. Cycle time runs 180× faster; arm spin-up and coasting use playback seconds. Pipe dots show direction at a schematic speed.',stepLabel:'Advance cycle by 30 seconds',advance:result.advance,step:()=>result.advance(30/WASHER.speedUp),complete:()=>Boolean(result.getState().complete),blocked:()=>false};
  result.resultPart={id:'system',label:'Inspect the finished cycle',view:'front',focusOnComplete:false,available:()=>Boolean(result.getState().complete)};
  result.frameBoundsForPart=id=>{if(id!=='system')return null;root.updateWorldMatrix(true,false);return new THREE.Box3(new THREE.Vector3(-375*MM,-108*MM,-338*MM),new THREE.Vector3(395*MM,905*MM,315*MM)).applyMatrix4(root.matrixWorld);};
  root.rotation.set(.18,-.5,0);result.initialPart='system';result.initialView='front';result.frameVisibleOnly=true;result.framePadding=.7;result.selectionOutline=false;result.transparentBackground=true;
  result.topology={system,cabinet,door,sumpFloor,sumpRim,rack,plates,water,pool,heater,element,filter,funnel,pump,impeller,pipeRoutes,softener,softCase,inlet,valve,inletStream,drain,arm,hub,tipPart,tipNozzles,cleaning,cleanNozzles,reaction,pushes,spoon,spray,jetLines,cycle,segments,clockDot,MM,M,NEWTON,ARM,TIP,SUMP,PLATES,JET_SECONDS,JET_POINTS};
  if(sprayArmLesson){
    const visible=new Set([system,pump,arm,tipPart,...tipNozzles.map(n=>n.parent),cleaning,reaction,spoon,spray]);
    for(const p of result.parts)if(!visible.has(p.object))p.object.visible=false;
    result.parts=result.parts.filter(p=>visible.has(p.object));result.covers=[];
    const assembly=result.parts.find(p=>p.id==='system');assembly.name='Pump and spray arm';assembly.framePadding=.38;assembly.description='A focused cutaway of the dishwasher circulation pump, feed tube and rotating arm. Return water enters the pump from the sump, which is omitted from this close-up.';
    result.parts.find(p=>p.id==='spray').description='The first 35 milliseconds of water emitted from moving outlets, including gravity. The rest of the dishwasher is omitted; these short trails do not model impacts or spray breakup.';
    result.actions=[
      ...[['Pump startup',0],['After half a second',.5],['After one second',1],['Finish the trial',6]].map(([label,time])=>({label,part:'system',view:'front',isolate:false,group:'Run',replay:false,run(){elapsed=time;root.rotation.set(.5,-.4,0);return render();}})),
      ...result.actions.filter(a=>['See a tip nozzle','See the pump'].includes(a.label)),
      {label:'See upright nozzles',part:'cleaning-nozzles',view:'top',isolate:true,group:'Look closer',replay:false,run(){root.rotation.set(0,0,0);return render();}},
      {label:'See the whole assembly',part:'system',view:'front',isolate:false,group:'Look closer',replay:false,run(){root.rotation.set(.5,-.4,0);return render();}},
    ];
    result.playback={label:'Watch spray-arm startup',description:'Watch six seconds after the pump switches on. Completion holds a pump-on snapshot for inspection. Pipe dots show direction at a schematic speed.',stepLabel:'Advance startup by 0.1 second',advance:result.advance,step:()=>result.advance(.1),complete:()=>Boolean(result.getState().complete),blocked:()=>false};
    result.resultPart={id:'system',label:'Inspect the six-second result',view:'front',focusOnComplete:false,available:()=>Boolean(result.getState().complete)};
    result.frameBoundsForPart=id=>{if(id!=='system')return null;root.updateWorldMatrix(true,false);return new THREE.Box3(new THREE.Vector3(-270*MM,-80*MM,-270*MM),new THREE.Vector3(270*MM,570*MM,270*MM)).applyMatrix4(root.matrixWorld);};
    root.rotation.set(.5,-.4,0);
  }
  const dispose=result.dispose;result.dispose=()=>{if(!disposed){disposed=true;dispose();}};return result;
}

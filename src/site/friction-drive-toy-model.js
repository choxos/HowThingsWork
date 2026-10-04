import * as THREE from 'three';
import {houseModel, reading as r} from './house-model-kit.js';
import {fixed} from './format.js';
import {lineObject, chartText, textLabel} from './scene-kit.js';
import {toyPlan, toyAt, phaseAt, TOY, FLOORS, RATIOS, GEARS, RATIO_OPTIONS, RELEASE_OPTIONS, TOY_DEFAULTS, TOY_DOMAINS} from './friction-drive-toy-physics.js';
import {toyGeometry, MM, trainAngles, FLOOR, FLOOR_COLORS} from './friction-drive-toy-geometry.js';

export {shafts, trainAngles, pitchRadius, AXLE, LAYOUT, FLOOR, FLOOR_COLORS} from './friction-drive-toy-geometry.js';
export const SLOW = 4, BLUR = 10;
export const SHARE_COLORS = Object.freeze([0xb8862f,0xc14f39,0x547a54,0xb0735a,0x6f7a73,0x2f6690]);
export const drawnTurns = (rim, factor) => Math.abs(rim) / TOY.wheel * factor / SLOW / (2 * Math.PI);
const wrap = value => ((value + FLOOR.half) % (2 * FLOOR.half) + 2 * FLOOR.half) % (2 * FLOOR.half) - FLOOR.half;

function toyCharts(kit, system) {
  const charts=kit.part('charts','Speed and energy charts','Separate close-ups compare floor speed, driven-wheel rim speed and the full energy account.',[8,0,0],system);charts.userData.explosionExcluded=true;
  const speed=kit.part('speed-chart','Floor speed and driven-wheel speed','The red curve is speed while touching the floor. The gold curve is rear-wheel rim speed, also flywheel speed divided by the gear ratio. A difference means skidding.',[0,2,0],charts);
  const energy=kit.part('energy-chart','Where the hand work goes','Net hand work equals flywheel energy, body motion, raised-body energy and the accumulated losses.',[0,-2,0],charts);
  for(const p of [speed,energy])kit.box([4.8,3.4,.03],[0,.1,-.05],'cream',p);
  const point=(x,y)=>[-1.7+x*3.4,-.9+y*2.1,0];
  kit.rod(point(0,0),point(1,0),.008,'ink',speed);kit.rod(point(0,0),point(0,1),.008,'ink',speed);
  chartText(speed,point,{title:'Push, lift, release and coast',size:.28,x:{min:0,max:1,title:'Physical time · seconds',ticks:[[0,'0']]},y:{min:0,max:1,title:'Speed · m/s',ticks:[[0,'0'],[.5,'1.25'],[1,'2.5']]},legend:[['On the floor',0xc14f39],['Driven wheel rim',0xb8862f]],legendAt:[.96,.97]});
  const endText=textLabel(speed,'',{height:.26,width:.8,position:[1.7,-1.08,.03]});
  const toyLine=lineObject(5000,0xc14f39,speed),wheelLine=lineObject(5000,0xb8862f,speed),cursor=lineObject(2,0x374736,speed);
  textLabel(energy,'Follow the energy',{height:.28,position:[0,1.48,.03]});
  const workText=textLabel(energy,'',{height:.25,width:4.3,position:[0,1.07,.03]});
  const shares=SHARE_COLORS.map(color=>{const mesh=kit.box([1,.32,.03],[0,.64,0],'cream',energy);mesh.material=mesh.material.clone();mesh.material.color.set(color);return mesh;});
  const labels=['Flywheel rotation','Toy motion','Raised toy','Skidding heat','Gears and bearings','Rolling loss'],numbers=[];
  for(let i=0;i<labels.length;i++){
    textLabel(energy,labels[i],{height:.25,align:'left',color:'#'+SHARE_COLORS[i].toString(16).padStart(6,'0'),position:[-1.8,.18-i*.29,.03]});
    numbers.push(textLabel(energy,'',{height:.25,width:1.15,position:[1.45,.18-i*.29,.03]}));
  }
  return {charts,speed,energy,point,endText,toyLine,wheelLine,cursor,shares,numbers,workText};
}
export function createFrictionDriveToyModel(){
  const kit=houseModel('Friction-drive toy'),system=kit.part('system','Friction-drive toy and measurements','Charge a flywheel through the rear wheels, then watch its energy drive the toy to a stop.');
  const hardware=toyGeometry(kit,system),chart=toyCharts(kit,system);
  kit.control('speed','Push speed',...TOY_DOMAINS.speed,TOY_DEFAULTS.speed,'m/s','End speed of each 150 mm push; changing a setting restarts the experiment.',undefined,{primary:true});
  kit.control('pushes','Pushes',...TOY_DOMAINS.pushes,TOY_DEFAULTS.pushes,'','Lift and return between pushes. Repeated slipping pushes can add speed; gripping pushes already reach the chosen speed.');
  kit.control('press','Press down',...TOY_DOMAINS.press,TOY_DEFAULTS.press,'N','Downward force increases available rear-wheel traction.');
  kit.control('gearing','Gear ratio',...TOY_DOMAINS.gearing,TOY_DEFAULTS.gearing,'','Flywheel revolutions per rear-wheel revolution.',RATIO_OPTIONS.map(({value,label})=>({value,label})),{primary:true});
  kit.control('floor','Floor',...TOY_DOMAINS.floor,TOY_DEFAULTS.floor,'','Each surface uses assigned grip, skid and rolling-resistance coefficients.',FLOORS.map(({value,label})=>({value,label})));
  kit.control('release','Release method',...TOY_DOMAINS.release,TOY_DEFAULTS.release,'','Lift and set down at rest, or release while still moving at the end of the final push.',RELEASE_OPTIONS.map(({value,label})=>({value,label})));
  let clock=0,lastClock=0,key='',restoring=false,disposed=false;
  const result=kit.finish(values=>{
    const next=JSON.stringify(values);
    if(next!==key){
      if(!restoring)clock=0;key=next;
      const plan=toyPlan(values),points=[];
      for(const phase of plan.phases){
        const count=Math.max(2,Math.ceil(phase.d/.02));
        for(let i=0;i<=count;i++){const s=phaseAt(plan,phase,phase.d*i/count);points.push([phase.t0+phase.d*i/count,phase.onFloor?s.v:0,s.u]);}
      }
      if(points.length>5000)throw new RangeError('Toy chart capacity exceeded');
      points.forEach(([t,v,u],i)=>{
        chart.toyLine.geometry.attributes.position.array.set(chart.point(t/plan.duration,v/2.5),i*3);
        chart.wheelLine.geometry.attributes.position.array.set(chart.point(t/plan.duration,u/2.5),i*3);
      });
      for(const line of [chart.toyLine,chart.wheelLine]){line.geometry.setDrawRange(0,points.length);line.geometry.attributes.position.needsUpdate=true;line.geometry.computeBoundingSphere();}
      chart.endText.userData.setText(fixed(plan.duration,1));hardware.base.material.color.set(FLOOR_COLORS[values.floor]);
    }
    const plan=toyPlan(values),now=toyAt(plan,clock);clock=now.clock;
    const wheel=-now.turned/TOY.wheel,frontWheel=-now.frontTurned/TOY.wheel,angles=trainAngles(plan.ratio,wheel);
    hardware.machine.position.y=hardware.hand.position.y=now.height*1000*MM;
    hardware.wheels.forEach(item=>{item.group.rotation.z=item.front?frontWheel:wheel;});
    for(const [ratio,set]of Object.entries(hardware.sets)){
      const active=Number(ratio)===plan.ratio;set.nodes.forEach(g=>{g.visible=active;});if(!active)continue;
      const first=GEARS[ratio][0][0]/GEARS[ratio][0][1];
      for(const [name,angle,factor]of [['axleGear',angles.axleGear,1],['pinion',angles.pinion,first],['second',angles.second,first],['flywheelPinion',angles.flywheel,plan.ratio]]){
        const g=set[name];g.group.rotation.z=angle;const blur=drawnTurns(now.u,factor)>BLUR;g.sharp.visible=!blur;g.blur.visible=blur;
      }
      set.flywheel.rotation.z=angles.flywheel;const blur=drawnTurns(now.u,plan.ratio)>BLUR;set.disk.visible=!blur;set.marks.forEach(m=>{m.visible=!blur;});set.blur.visible=blur;
    }
    const released=clock>=plan.releaseAt.t,holding=!released,pressing=holding&&(clock===0||now.kind==='pushing');
    hardware.hand.visible=holding;hardware.press.userData.setLength((pressing?values.press*2.5:0)*MM);hardware.press.position.set(-5*MM,(65+(pressing?values.press*2.5:0))*MM,0);
    const along=now.x*1000;
    hardware.seams.forEach((seam,i)=>{seam.position.x=wrap(i*FLOOR.spacing-along)*MM;});
    const markPlace=Math.round(along/FLOOR.mark)*FLOOR.mark-along;hardware.mark.visible=markPlace>=-FLOOR.half&&markPlace<FLOOR.half;hardware.mark.position.x=markPlace*MM;
    chart.cursor.geometry.attributes.position.array.set([...chart.point(clock/plan.duration,0),...chart.point(clock/plan.duration,1)]);chart.cursor.geometry.attributes.position.needsUpdate=true;chart.cursor.geometry.computeBoundingSphere();
    const e=now.energy,parts=[now.flywheel,now.motion,now.potential,e.skid,e.gears+e.bearing,e.rolling],total=parts.reduce((a,b)=>a+b,0);
    let left=-1.7;
    chart.shares.forEach((segment,i)=>{const width=total>1e-12?3.4*parts[i]/total:0;segment.visible=width>1e-10;segment.scale.x=Math.max(1e-8,width);segment.position.x=left+width/2;left+=width;chart.numbers[i].userData.setText(fixed(parts[i],3)+' J');});
    chart.workText.userData.setText('Net hand work: '+fixed(e.hand,3)+' J');
    const resultText=now.complete?'Stopped · '+fixed(plan.rolled,2)+' m after release':clock===0?'Ready · push, lift, release and coast':now.stage+' · '+fixed(clock,2)+' s';
    const contact=now.complete||clock===0?'At rest':!now.phase.onFloor?'Lifted clear of the floor':now.skidding?'Rear wheels skidding':'Rolling without slip';
    return {state:{...plan,now,complete:now.complete,clock,released,wheel,frontWheel,angles},readings:[
      r('Your result',resultText,now.complete?'Both axles and the flywheel have stopped. Play repeats the selected settings.':'Playback runs at one quarter of physical speed. Inspection preserves this state.'),
      r('Toy speed',fixed(now.phase.onFloor?now.v:0,2)+' m/s on the floor',released?fixed(Math.max(0,now.x-plan.releaseAt.x),2)+' m since release.':'During a carry the hand guides the toy; it is not driving along the floor.'),
      r('Flywheel',fixed(now.rpm,0)+' rpm',fixed(plan.ratio,0)+' flywheel turns for each rear-wheel turn. Its equivalent inertia at the wheel rims is '+fixed(plan.felt*1000,0)+' g.'),
      r('Wheel contact',contact,'Front rims roll at body speed on the floor. Rear rim speed is '+fixed(now.u,2)+' m/s; a difference shows slip.'),
      r('Grip during a push',fixed(plan.need,2)+' N needed · '+fixed(plan.supply,2)+' N available',plan.grips?'After touchdown slip settles, the floor can maintain rolling grip.':'The assigned static limit is too small; a push slips and charges the flywheel less.'),
      r('Power direction',now.drive==='floor'?'Rear wheels → flywheel':now.drive==='flywheel'?'Flywheel → rear wheels':'No power through the gear mesh',!now.phase.onFloor?'The flywheel coasts against its bearings while the hand carries the toy.':'The same train transmits power in both directions.'),
      r('Stored energy',fixed(now.flywheel,3)+' J in the flywheel',fixed(now.motion,3)+' J body motion; '+fixed(now.potential,3)+' J raised-body energy.'),
      r('Energy balance',fixed(e.hand,3)+' J net hand work',fixed(e.skid+e.gears+e.bearing+e.rolling,3)+' J accumulated losses. Net hand work includes energy returned to the hand during a carry.'),
      r('After release',now.complete?fixed(plan.rolled,2)+' m · '+fixed(plan.duration-plan.releaseAt.t,2)+' s':'Run to a stop to measure the outcome','Range depends on charging, release speed, traction and assigned losses; it is not a product measurement.'),
    ]};
  });
  const render=result.update;
  result.advance=dt=>{if(Number.isFinite(dt)&&dt>0)clock+=dt/SLOW;return render();};
  result.animate=time=>{const dt=Number.isFinite(time)?Math.max(0,time-lastClock):0;if(Number.isFinite(time))lastClock=time;return result.advance(dt);};
  result.reset=(initial={})=>{clock=Number.isFinite(initial.time)?Math.max(0,initial.time):0;lastClock=0;restoring=true;try{return render({...result.defaults,...(initial.settings||{})});}finally{restoring=false;}};
  result.replayState=()=>({settings:result.getState().values,time:0});
  const inspect=(label,part,isolate=false,view='front')=>({label,part,isolate,view,replay:false,run:()=>result.update()});
  result.actions=[inspect('Inspect: complete experiment','experiment'),inspect('Inspect: toy car','machine'),inspect('Inspect: supported gears','transmission',true),inspect('Inspect: flywheel and bearings','storage',true),inspect('Inspect: wheels and axles','running-gear',true),inspect('Read the speed chart','speed-chart',true),inspect('Read the energy chart','energy-chart',true)];
  result.playback={label:'Push and let go',description:'One quarter of physical speed. Rapid gears are blurred; pause near the start to inspect their teeth.',stepLabel:'Advance one tenth of a second',advance:result.advance,step:()=>result.advance(.1*SLOW),complete:()=>result.getState().complete,blocked:()=>false};
  result.initialPart=result.autoFramePart='machine';result.initialView='front';result.initialCutaway=true;result.frameVisibleOnly=true;result.framePadding=.63;result.selectionOutline=false;result.transparentBackground=true;
  result.partViewDirections={};
  for(const p of result.parts)result.partViewDirections[p.id]={front:[.55,1.1,3],back:[-.55,.5,-3],side:[3,.3,0],top:[0,3,0],bottom:[0,-3,0]};
  for(const id of ['charts','speed-chart','energy-chart']){result.partViewDirections[id]={front:[0,0,3]};Object.assign(result.parts.find(p=>p.id===id),{framePadding:.43,maxZoom:150});}
  result.thumbnailOmit=[hardware.hand,hardware.floor,chart.charts];
  result.topology={system,...hardware,...chart,MM,SLOW,BLUR};
  const dispose=result.dispose;result.dispose=()=>{if(!disposed){disposed=true;dispose();}};
  return result;
}

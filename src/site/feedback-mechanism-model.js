import * as THREE from 'three';
import {houseModel,reading as r} from './house-model-kit.js';
import {fillRate,cisternConstants} from './toilet-tank-model.js';

export const feedbackConstants=Object.freeze({tankArea:cisternConstants.tankArea,rim:.30,closingBand:cisternConstants.closingBand,fillAtOneBar:cisternConstants.fillAtOneBar,demandTime:120,duration:240,displayDuration:12,unit:.06});
const C=feedbackConstants,modes=['Automatic float','Held open','Held closed'],fmt=(n,d)=>d!==undefined?Number(n.toFixed(d)).toString():Math.abs(n)<1e-6?'0':Number(n.toPrecision(3)).toString();

// Integrate each constant-demand affine region exactly, including its boundary event.
export function sampleFeedback(values,elapsed){
 for(const [key,min,max] of [['mode',0,2],['level',.12,.24],['pressure',0,4],['demand',0,.20]])if(!Number.isFinite(values[key])||values[key]<min||values[key]>max)throw new RangeError(`Invalid ${key}`);
 if(!Number.isInteger(values.mode)||!Number.isFinite(elapsed)||elapsed<0||elapsed>C.duration)throw new RangeError('Invalid mode or observation time');
 const {mode,level:mark,pressure,demand}=values,capacity=C.fillAtOneBar*Math.sqrt(pressure),low=mark-C.closingBand,initialLevel=mark-.06,initialVolume=C.tankArea*initialLevel;
 let level=initialLevel,inletVolume=0,withdrawnVolume=0,overflowVolume=0,unmetVolume=0;
 const flow=h=>mode===0?fillRate(h,mark,pressure):mode===1?capacity:0;
 function integrate(duration,D){
  let remaining=duration;
  for(let event=0;remaining>0&&event<12;event++){
   const q=flow(level),velocity=(q-D)/C.tankArea;
   if((level===0&&velocity<=0)||(level===C.rim&&velocity>=0)){
    const delivered=level===0?Math.min(D,q):D;inletVolume+=q*remaining;withdrawnVolume+=delivered*remaining;unmetVolume+=(D-delivered)*remaining;overflowVolume+=(level===C.rim?Math.max(0,q-D):0)*remaining;remaining=0;break;
   }
   const band=mode===0&&capacity>0&&(level>low||(level===low&&velocity>0))&&(level<mark||(level===mark&&velocity<0));
   const b=band?capacity/C.closingBand:0,a=band?b*mark:q,speed=(a-b*level-D)/C.tankArea;
   let boundary=speed>0?C.rim:0;
   if(mode===0){if(speed>0&&level<low)boundary=low;else if(speed>0&&level<mark)boundary=mark;else if(speed<0&&level>mark)boundary=mark;else if(speed<0&&level>low)boundary=low;}
   let crossing=Infinity;
   if(speed!==0){if(!b)crossing=(boundary-level)/speed;else{const equilibrium=(a-D)/b,ratio=(boundary-equilibrium)/(level-equilibrium);if(ratio>0&&ratio<1)crossing=-Math.log(ratio)*C.tankArea/b;}}
   const dt=Math.min(remaining,crossing),old=level;
   level=dt===crossing?boundary:b?level+((a-D)/b-level)*(-Math.expm1(-b*dt/C.tankArea)):level+speed*dt;
   inletVolume+=C.tankArea*(level-old)+D*dt;withdrawnVolume+=D*dt;remaining-=dt;
  }
  if(remaining>1e-10)throw new Error('Unresolved hydraulic boundary');
 }
 integrate(Math.min(elapsed,C.demandTime),0);if(elapsed>C.demandTime)integrate(elapsed-C.demandTime,demand/1000);
 const requestedFlow=elapsed>=C.demandTime?demand/1000:0,inletFlow=flow(level),withdrawalFlow=level===0?Math.min(requestedFlow,inletFlow):requestedFlow,overflowFlow=level===C.rim?Math.max(0,inletFlow-withdrawalFlow):0,unmetFlow=requestedFlow-withdrawalFlow,opening=mode===0?Math.max(0,Math.min(1,(mark-level)/C.closingBand)):mode===1?1:0,storedVolume=C.tankArea*level;
 const stage=overflowFlow>0?'overflowing':unmetFlow>0?'demand unmet':elapsed<C.demandTime?'before withdrawal':requestedFlow===0?'no withdrawal':inletFlow<withdrawalFlow?'level falling':inletFlow>withdrawalFlow?'level rising':'flows balanced';
 return {elapsed,duration:C.duration,level,mark,mode,capacity,opening,inletFlow,requestedFlow,withdrawalFlow,overflowFlow,unmetFlow,initialLevel,initialVolume,storedVolume,inletVolume,withdrawnVolume,overflowVolume,unmetVolume,balanceError:initialVolume+inletVolume-storedVolume-withdrawnVolume-overflowVolume,stage,withdrawalStage:elapsed<C.demandTime?'Before withdrawal':'Withdrawal active',equilibrium:mode===0&&capacity>0&&requestedFlow>0&&requestedFlow<capacity?mark-C.closingBand*requestedFlow/capacity:null};
}

export function createFeedbackMechanismModel(){
 const m=houseModel('Feedback mechanism'),{part,box,cylinder,sphere,ring,rod,control,finish}=m,U=C.unit,tankWidth=6.6,tankDepth=C.tankArea/(tankWidth*U*U),pivotX=1.5,longArm=5,shortArm=1.6,valveX=3.25,floatRadius=.32,floatOffset=.1;
 const system=part('system','Float feedback loop','Water level moves the float, rigid rocker and slotted follower; the needle changes inlet flow, which changes stored water.');
 const board=part('board','Demonstration base','Illustrative dimensions: one scene unit is 60 mm.',[0,0,0],system);box([10.6,.15,3.1],[0,-1.7,0],'wood',board);
 const tank=part('tank','Water storage tank','0.055 m² plan area, 300 mm rim, flat bottom. The downstream metering pump imposes withdrawal.',[0,0,0],system);
 box([tankWidth+.12,.12,tankDepth+.12],[-.8,-.06,0],'cream',tank);box([tankWidth+.12,5,.08],[-.8,2.5,-tankDepth/2-.04],'cream',tank);for(const x of [-4.16,2.56])box([.12,5,tankDepth],[x,2.5,0],'cream',tank);
 for(const x of [-3.7,2.1])for(const z of [-.8,.8])rod([x,-.12,z],[x,-1.625,z],.07,'ink',tank);
 const cover=part('tank-front','Removable tank front','Look inside removes the opaque front wall and exposes the moving float and water.',[0,0,0],tank);box([tankWidth+.12,5,.08],[-.8,2.5,tankDepth/2+.04],'cream',cover);m.covers.push(cover);
 const waterPart=part('water','Stored water','Its depth is the conserved stored volume divided by tank area.',[0,0,0],tank),water=box([tankWidth,1,tankDepth],[-.8,.5,0],'blue',waterPart);water.material=water.material.clone();water.material.transparent=true;water.material.opacity=.25;water.material.depthWrite=false;water.renderOrder=1;
 const ruler=part('ruler','Fixed 0–300 mm level ruler','Permanent 30 mm ticks; numbers every 60 mm. The gold marker shows the selected shutoff level.',[0,0,0],system);rod([-4.45,0,1.2],[-4.45,5,1.2],.015,'ink',ruler);
 const segments={a:[[0,.1],[.08,.1]],b:[[.08,.1],[.08,0]],c:[[.08,0],[.08,-.1]],d:[[0,-.1],[.08,-.1]],e:[[0,0],[0,-.1]],f:[[0,.1],[0,0]],g:[[0,0],[.08,0]]},digits=['abcdef','bc','abged','abgcd','fgbc','afgcd','afgecd','abc','abcdefg','abfgcd'];
 for(let i=0;i<=10;i++){const y=i*.5;rod([-4.55,y,1.2],[-4.35,y,1.2],.012,'ink',ruler);if(i%2===0)String(i*30).split('').forEach((digit,j)=>{for(const segment of digits[Number(digit)]){const [a,b]=segments[segment];rod([-5.04+j*.13+a[0],y+a[1],1.2],[-5.04+j*.13+b[0],y+b[1],1.2],.012,'ink',ruler);}});}
 const marker=part('shutoff-mark','Float shutoff mark','The inlet closes here at zero demand. Replacing ongoing withdrawal requires a lower level.',[0,0,0],ruler);rod([-4.6,0,1.25],[2.45,0,1.25],.018,'gold',marker);
 const linkage=part('linkage','Rigid float rocker','A fixed-length 5-unit float arm and 1.6-unit valve arm turn about a real axle. Float center is water level plus 6 mm, until the float rests on the floor. Float inertia and force balance are omitted.',[0,0,0],system),rocker=part('rocker','Pivoted rigid lever','The opposite arm rises when the float falls.',[pivotX,0,.8],linkage),lever=rod([-longArm,0,0],[shortArm,0,0],.045,'metal',rocker),floatPart=part('float','Buoyant level-sensing float','Follows the water surface and turns the rocker. This quasistatic model omits float inertia and rests the float on the floor when water is too low.',[0,0,0],rocker),float=sphere(floatRadius,[-longArm,0,0],'clay',floatPart),pin=sphere(.075,[shortArm,0,-.35],'gold',rocker),pinShaft=cylinder(.03,.35,[shortArm,0,-.175],'metal',rocker);pinShaft.rotation.x=Math.PI/2;
 const pivot=part('pivot','Adjustable fixed pivot and valve assembly','Changing the shutoff mark raises this assembly on its support; the supply riser remains connected.',[pivotX,0,.45],linkage);const axle=rod([0,0,-.25],[0,0,.43],.10,'ink',pivot),support=rod([pivotX,-1.625,.2],[pivotX,4.6,.2],.055,'ink',linkage);
 const valve=part('valve','Slotted follower and inlet needle','The lever pin slides horizontally in the follower slot. Its vertical displacement lifts the needle. Flow saturates after the first 30 mm of level deficit. Held modes retract the pin out of the slot.',[valveX,0,.45],system),seat=ring(.24,.012,[0,-.7,0],'ink',valve);seat.rotation.x=Math.PI/2;
 const follower=part('follower','Horizontal pin slot','Rigid horizontal rails accommodate the circular arc of the short lever tip without stretching the lever.',[0,0,0],valve);
 for(const y of [-.1,.1])box([1.9,.05,.12],[-.55,y,0],'gold',follower);for(const x of [-1.5,.4])box([.05,.25,.12],[x,0,0],'gold',follower);
 const needle=rod([0,-2.4,0],[0,0,0],.055,'metal',follower),plug=cylinder(.16,.06,[0,-.67,0],'clay',follower);
 const chamber=part('valve-chamber','Cutaway valve chamber','The supply enters below the annular seat. Only lifting the plug opens the seat into the upper outlet chamber. Front and side casing sections are removed to expose the passage and linkage.',[0,0,0],valve);
 const casing=new THREE.Mesh(new THREE.CylinderGeometry(.33,.33,1.9,32,1,true,2*Math.PI/3,2*Math.PI/3),new THREE.MeshToonMaterial({color:0x91aa7e,side:THREE.DoubleSide}));casing.position.y=-.2;chamber.add(casing);
 const partition=new THREE.Mesh(new THREE.RingGeometry(.145,.33,48),new THREE.MeshToonMaterial({color:0x374736,side:THREE.DoubleSide}));partition.rotation.x=-Math.PI/2;partition.position.y=-.7;chamber.add(partition);
 const upstreamPassage=cylinder(.105,.45,[0,-.925,0],'blue',chamber),valveGap=cylinder(.145,1,[0,-.7,0],'blue',chamber);valveGap.material=valveGap.material.clone();valveGap.material.transparent=true;valveGap.material.opacity=.3;valveGap.material.depthWrite=false;
 const inletPort=[0,-1.15,0],outletPort=[.25,-.45,0];
 const valveGuide=ring(.095,.025,[0,-1.1,0],'ink',valve);valveGuide.rotation.x=Math.PI/2;rod([.095,-1.1,0],[.4,-1.1,0],.035,'ink',valve);rod([.4,-1.1,0],[.4,-1.31,0],.035,'ink',valve);
 const openingGauge=part('opening-gauge','Valve opening indicator','Needle travel beyond the 30 mm closing band is already fully open hydraulically.',[0,0,0],valve);rod([.55,-.7,0],[.55,.75,0],.012,'ink',openingGauge);for(const y of [-.7,-.7+C.closingBand/U*shortArm/longArm])rod([.48,y,0],[.68,y,0],.02,'red',openingGauge);const openingPointer=rod([.43,-.7,0],[.72,-.7,0],.024,'blue',follower);
 const supply=part('supply','Pressurized supply and connected inlet','Supply pressure supplies the energy. A telescoping riser feeds the adjustable valve body and its connected discharge pipe.',[0,0,0],system),supplyRiser=cylinder(.105,1,[valveX,0,.45],'metal',supply);box([.6,.45,.6],[valveX,-1.36,.45],'leaf',supply);
 const discharge=part('inlet-pipe','Valve outlet to tank','The outlet leaves the upper chamber above the seat, then rises above the rim and discharges into the tank. It has no direct junction with the lower supply.',[0,0,0],supply),outletRise=cylinder(.08,1,[4.25,0,.45],'metal',discharge),outletLink=rod([valveX+.25,0,.45],[4.25,0,.45],.08,'metal',discharge);rod([4.25,5.6,.45],[1.95,5.6,.45],.08,'metal',discharge);rod([1.95,5.6,.45],[1.95,5.35,.45],.08,'metal',discharge);
 const inletStream=part('inlet-stream','Inlet water stream','Visible stream area follows actual inlet flow.',[0,0,0],system),inletJet=cylinder(.13,1,[1.95,0,.45],'blue',inletStream);
 const pump=part('pump','Downstream metering pump and receiver','After 120 seconds this ideal downstream pump requests the selected flow. An empty tank can deliver only arriving inlet water; the rest is reported unmet.',[0,0,0],system);rod([.6,.08,.5],[.6,-.55,.5],.11,'metal',pump);const pumpWheel=ring(.23,.09,[.6,-.7,.5],'leaf',pump);rod([.6,-.93,.5],[.6,-1.2,.5],.10,'metal',pump);rod([.6,-1.2,.5],[-.3,-1.2,.5],.10,'metal',pump);box([1.5,.55,.8],[-1.1,-1.35,.5],'cream',pump);const withdrawalJet=rod([-.3,-1.2,.5],[-.5,-1.2,.5],.09,'blue',pump),pumpRotor=rod([.44,-.7,.51],[.76,-.7,.51],.025,'gold',pump);
 const overflow=part('overflow','Overflow over the rim','Any surplus at 300 mm spills visibly into a catch tray and remains in the volume balance.',[0,0,0],system),overflowJet=cylinder(.14,6.35,[2.72,1.825,.93],'blue',overflow),overflowLip=rod([2.4,5,.93],[2.72,5,.93],.10,'blue',overflow);const overflowTray=box([1,.2,.65],[2.8,-1.48,.93],'cream',overflow);
 control('mode','Inlet control',0,2,1,0,'','Automatic connects the float to the inlet. Held modes disengage its pin.',modes.map((label,value)=>({label,value})));
 control('level','Float shutoff level',120,240,30,180,'mm','Each fresh trial begins 60 mm below this mark.');control('pressure','Supply pressure',0,4,1,1,'bar','Fully open inflow is 0.08 × √pressure L/s.');control('demand','Withdrawal after 120 s',0,.20,.04,.04,'L/s','A downstream metering pump requests this flow at 120 seconds.');
 let displayElapsed=0,lastClock=0,started=false,complete=false;
 const result=finish(values=>{
  const s=sampleFeedback({...values,level:values.level/1000},displayElapsed/C.displayDuration*C.duration),height=s.level/U,pivotY=s.mark/U+floatOffset,floatY=Math.max(floatRadius,height+floatOffset),angle=Math.asin((pivotY-floatY)/longArm),automaticLift=shortArm*Math.sin(angle),needleLift=values.mode===0?automaticLift:values.mode===1?C.closingBand/U*shortArm/longArm:0;
  water.visible=s.level>0;water.scale.y=Math.max(height,1e-8);water.position.y=height/2;marker.position.y=s.mark/U;rocker.position.y=pivotY;rocker.rotation.z=angle;pivot.position.y=pivotY;valve.position.y=pivotY;follower.position.y=needleLift;pin.position.z=values.mode===0?-.35:-.02;pinShaft.scale.y=values.mode===0?1:.02/.35;pinShaft.position.z=pin.position.z/2;
  supplyRiser.scale.y=pivotY+inletPort[1]+1.36;supplyRiser.position.y=(-1.36+pivotY+inletPort[1])/2;outletLink.position.y=pivotY+outletPort[1];outletRise.scale.y=5.6-(pivotY+outletPort[1]);outletRise.position.y=(5.6+pivotY+outletPort[1])/2;valveGap.visible=s.inletFlow>0;valveGap.scale.y=Math.max(needleLift,1e-8);valveGap.position.y=-.7+needleLift/2;
  inletJet.visible=s.inletFlow>0;inletJet.scale.y=5.35-height;inletJet.position.y=(5.35+height)/2;inletJet.scale.x=inletJet.scale.z=Math.sqrt(s.inletFlow/C.fillAtOneBar);
  withdrawalJet.visible=s.withdrawalFlow>0;withdrawalJet.scale.x=withdrawalJet.scale.z=Math.sqrt(s.withdrawalFlow/.0002);pumpRotor.rotation.z=s.withdrawnVolume*1500;overflowJet.visible=overflowLip.visible=s.overflowFlow>0;overflowJet.scale.x=overflowJet.scale.z=Math.sqrt(s.overflowFlow/C.fillAtOneBar);
  const state={...s,displayElapsed,progress:displayElapsed/C.displayDuration,started,complete,floatY,pivotY,angle,needleLift,pinEngaged:values.mode===0,controlMode:modes[values.mode]};
  const nearBalance=['level falling','level rising'].includes(s.stage)&&s.requestedFlow>0&&Math.abs(s.inletFlow-s.withdrawalFlow)<=.01*s.requestedFlow;
  return {state,readings:[
   r('Your result',!started?'Ready · observe the float feedback loop':s.overflowFlow>0?'Tank full · surplus water overflows':s.unmetFlow>0?'Tank empty · withdrawal demand is unmet':`${fmt(s.level*1000,1)} mm · ${nearBalance?'flows nearly balanced':s.stage}`,'Nearly balanced means inflow and delivered withdrawal differ by at most 1% of the request. The exact level can still change slowly; the water calculation is not stopped or rounded.'),
   r('Water level',`${fmt(s.level*1000,1)} mm`,'Depth above the flat floor. The float follows the surface; the fixed ruler uses the same millimeters as the shutoff control.'),
   r('Float shutoff level',`${fmt(s.mark*1000,0)} mm`,'Automatic control balances below this mark when positive demand is below inlet capacity.'),
   r('Inlet control',modes[values.mode],'Automatic connects the float to the valve. Held modes retract the pin, so sensing continues without control authority.'),
   r('Valve opening',s.opening>0&&s.opening*100<.05?'< 0.1%':`${fmt(s.opening*100,1)}%`,'The fraction of full inlet capacity. The 30 mm band below the shutoff mark takes the automatic valve from closed to fully open. Tiny positive openings use an upper bound so they do not appear completely closed.'),
   r('Inlet flow',`${fmt(s.inletFlow*1000)} L/s`,'Water actually entering now. Full flow is 0.08 × square root of supply pressure in bar; zero pressure means no inflow.'),
   r('Requested withdrawal',`${fmt(s.requestedFlow*1000)} L/s`,'The downstream pump starts requesting this rate at 120 seconds. A request does not guarantee that water is available.'),
   r('Delivered withdrawal',`${fmt(s.withdrawalFlow*1000)} L/s`,'Water actually leaving through the pump. At an empty tank, delivery cannot exceed arriving inlet water.'),
   r('Overflow now',`${fmt(s.overflowFlow*1000)} L/s`,'Surplus spills only at the 300 mm rim. Include this separate outgoing stream when comparing inflow with withdrawal.'),
   r('Unmet withdrawal',`${fmt(s.unmetFlow*1000)} L/s`,'Requested rate minus delivered rate. A positive value means the empty tank cannot supply the full request.'),
   r('Initial water',`${fmt(s.initialVolume*1000)} L`,'Starting storage, 60 mm below the chosen shutoff mark. Each control edit begins a fresh trial.'),
   r('Stored water',`${fmt(s.storedVolume*1000)} L`,'Current volume equals the 0.055 m² tank area multiplied by water depth. The tank holds at most 16.5 L.'),
   r('Admitted water',`${fmt(s.inletVolume*1000)} L`,'Total inlet water accumulated since the trial began, including water later delivered or spilled.'),
   r('Delivered water',`${fmt(s.withdrawnVolume*1000)} L`,'Total water supplied to the downstream request since withdrawal began at 120 seconds.'),
   r('Overflowed water',`${fmt(s.overflowVolume*1000)} L`,'Total surplus that crossed the rim. It remains in the accounting even after leaving the tank.'),
   r('Unmet demand',`${fmt(s.unmetVolume*1000)} L`,'Accumulated requested water that could not be delivered. These liters never entered the outgoing water balance.'),
   r('Water balance',`${(Math.abs(s.balanceError*1000)<.0005?0:s.balanceError*1000).toFixed(3)} L`,'Initial + admitted − stored − delivered − overflow, calculated from unrounded volumes and shown to the nearest 0.001 L. Other cards are rounded separately and may not add exactly.'),
   r('Withdrawal stage',s.withdrawalStage,'The imposed disturbance starts at exactly 120 physical seconds, halfway through playback.'),
   r('Observation progress',`${fmt(state.progress*100,1)}%`,'Completion of the fixed 240-second trial. Completion does not promise exact steady state.'),
   r('Observation time',`${fmt(s.elapsed,1)} s`,'Physical time since the fresh trial began. Twelve display seconds show 240 physical seconds.'),
   r('Model limit','Illustrative proportional float valve and metered withdrawal','Exact tank balance; quasistatic float draft and floor rest. No float inertia, valve-pressure forces, pump dynamics or control delay. The shutoff mark is not an exact level maintained under withdrawal.')
  ]};
 });
 const render=result.update;function restart(defaults=false,clock=false){displayElapsed=0;started=complete=false;if(clock)lastClock=0;return render(defaults?result.defaults:{});}
 result.update=next=>{const before=result.getState().values;render(next);const after=result.getState().values;return Object.keys(after).some(k=>before[k]!==after[k])?restart():render();};
 function advance(seconds){if(!Number.isFinite(seconds)||seconds<=0||complete)return render();started=true;displayElapsed=Math.min(C.displayDuration,displayElapsed+seconds);if(displayElapsed>=C.displayDuration-1e-12)displayElapsed=C.displayDuration;complete=displayElapsed===C.displayDuration;return render();}
 result.advance=advance;result.animate=clock=>{if(!Number.isFinite(clock))return render();const delta=Math.max(0,clock-lastClock);lastClock=clock;return advance(delta);};result.reset=()=>restart(true,true);
 result.actions=[{label:'Restart selected feedback observation',part:'system',view:'reset',run:()=>restart()},...[[0,'initial state'],[119,'before withdrawal'],[121,'after withdrawal'],[160,'responding'],[240,'final state']].map(([time,label])=>({label:`Inspect ${label} (${time} s)`,part:'system',replay:false,run:()=>{restart();return time?advance(time/C.duration*C.displayDuration):render();}}))];
 result.playback={label:'Observe the feedback loop',stepLabel:'Advance one percent of the observation',description:'Twelve display seconds show 240 physical seconds, with withdrawal starting at 120 seconds.',advance,step:()=>advance(.12),complete:()=>complete,blocked:()=>false};result.resultPart={id:'system',context:'system',focusOnComplete:false,label:'Inspect the whole feedback loop',available:()=>started};result.framingBounds=new THREE.Box3(new THREE.Vector3(-5.4,-1.85,-1.65),new THREE.Vector3(5.4,5.85,1.65));
 result.topology={system,tank,cover,water,marker,rocker,lever,floatPart,float,pin,pinShaft,pivot,axle,support,valve,chamber,casing,partition,upstreamPassage,valveGap,inletPort,outletPort,follower,needle,plug,seat,valveGuide,openingPointer,supplyRiser,outletLink,outletRise,inletJet,pumpWheel,withdrawalJet,overflowJet,overflowLip,overflowTray,tankWidth,tankDepth,longArm,shortArm,valveX,pivotX,floatRadius,floatOffset};
 result.catalogParts=result.parts.filter(p=>p.id!=='system');
 const getState=result.getState;result.getState=()=>{const s=getState();return {...s,values:{...s.values},readings:s.readings.map(x=>({...x}))};};return result;
}

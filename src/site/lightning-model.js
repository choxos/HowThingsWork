import * as THREE from 'three';
import {houseModel,reading} from './house-model-kit.js';
import {LIGHTNING_DEFAULTS as D,LIGHTNING_DOMAINS,STROKE_OPTIONS,CONDUCTOR,RUN,createLightningController} from './lightning-physics.js';
import {createLightningGeometry,updateLightningGeometry} from './lightning-geometry.js';

export function createLightningConductorModel(){
  const kit=houseModel('Lightning conductor'),geometry=createLightningGeometry(kit),controller=createLightningController();
  let plan=controller.getPlan();
  const specs={
    field:['Storm field','kV/m','Changes the separate ideal tip-field study. It does not predict whether a strike attaches.'],
    tip:['Terminal tip radius','mm','Changes the ideal semiellipsoid and its field concentration. Sharper is not a calculated guarantee of interception.'],
    peak:['Peak current','kA','The selected current magnitude is imposed after connection. It is independent of soil and gap in this assigned source model.'],
    stroke:['Pulse shape','','Compare slower and faster reference shapes at the same selected peak current.',STROKE_OPTIONS],
    paths:['Connected routes','','Two equal assigned routes share the current. Opening the right connection before the pulse leaves the left route carrying all of it.',[{value:1,label:'One route; right disconnected'},{value:2,label:'Two equal routes'}]],
    soil:['Soil resistivity','Ω·m','Higher resistivity raises the assigned earth-contact potential and the probe difference. Soil breakdown and transient behavior are excluded.'],
    gap:['Conductor-to-pipe gap','m','Moves the separately bonded pipe. Average field stress is |conductor − pipe voltage| divided by this gap; no exact spark point is inferred.'],
    radius:['Effective earth radius','m','Assigned equivalent hemisphere in uniform soil. This is not a calculated radius or resistance of the illustrative buried rods.'],
    distance:['Near probe distance','m','The near ground probe is this far from the mathematical contact center; the other is one meter farther. Both remain outside the selected contact.'],
  };
  for(const key of Object.keys(D)){const [name,unit,help,options]=specs[key];kit.control(key,name,...LIGHTNING_DOMAINS[key],D[key],unit,help,options);}
  const result=kit.finish(()=>{
    const s=controller.getState();updateLightningGeometry(geometry,s,plan);
    const resultText=s.complete?`${s.values.paths} route${s.values.paths===1?'':'s'} carried a ${s.values.peak} kA peak`:s.phase;
    return {state:{...s,time:s.clock},readings:[
      reading('Your result',resultText,s.complete?`Each connected route peaked at ${(plan.top/s.values.paths/1000).toFixed(1)} kA. Peak conductor-to-pipe stress was ${(plan.gapField/1e6).toFixed(3)} MV/m; no pass/fail distance is calculated.`:'Follow the assumed attachment, then inspect the pulse, nearby pipe, and soil. Changing a setting starts a new record.'),
      reading('Current now',`${(s.current/1000).toFixed(2)} kA`,`${s.values.paths} connected route${s.values.paths===1?'':'s'}: left ${(s.leftCurrent/1000).toFixed(2)} kA, right ${(s.rightCurrent/1000).toFixed(2)} kA. These are magnitudes. For the negative-strike illustration, conventional current points upward.`),
      reading('Conductor minus pipe',`${(s.gap/1e6).toFixed(3)} MV`,`Upper-minus-lower route voltage: ${(s.resistive/1000).toFixed(2)} kV resistive plus ${(s.inductive/1000).toFixed(2)} kV inductive. The pipe shares only the bottom node. The inductive term reverses sign as current falls.`),
      reading('Peak gap stress',`${(plan.gapField/1e6).toFixed(3)} MV/m`,`Peak |ΔV| ${(plan.gapMax/1e6).toFixed(3)} MV across ${s.values.gap.toFixed(2)} m. This average is not the nonuniform field or a breakdown prediction.`),
      reading('Earth-contact potential now',`${(s.earth/1e6).toFixed(3)} MV`,`Relative to remote earth. Assigned R = ρ/(2πa) = ${plan.earthResistance.toFixed(2)} Ω. The ideal resistive model's peak magnitude is ${(plan.earthMax/1e6).toFixed(3)} MV.`),
      reading('One-meter probe difference',`${(s.step/1000).toFixed(2)} kV`,`Now, at ${s.values.distance} and ${s.values.distance+1} m from the contact center. Peak model difference: ${(plan.stepMax/1000).toFixed(2)} kV. This is not a human-exposure or ground-safety calculation.`),
      reading('Ideal tip field',`${(plan.tipField/1e6).toFixed(2)} MV/m`,`${plan.enhancement.toFixed(0)} times the selected storm field for an ideal 2 m semiellipsoid. ${plan.aboveOnset?'Above the 6.79 MV/m historical onset reference, space charge would change this field; no corona extent is predicted.':'Below the 6.79 MV/m historical onset reference. Attachment is still not predicted.'}`),
      reading('Transferred charge',`${s.charge.toFixed(2)} C`,`Cumulative magnitude. Complete mathematical pulse: ${plan.charge.toFixed(2)} C. The 5 ms record captures over 99.99% for either reference shape.`),
      reading('Copper heating energy',`${(s.copperEnergy/1000).toFixed(3)} kJ`,`Total across connected routes, ∫I²R/N dt. Each assigned wall route is ${CONDUCTOR.length} m with ${(CONDUCTOR.resistance*1000).toFixed(2)} mΩ and 10 μH. Roof links and bottom bonds are ideal nodes; skin effect, temperature feedback and mutual inductance are excluded.`),
      reading('Pulse clock',s.attached?`${(s.physicalTime*1e6).toFixed(s.physicalTime<1e-5?2:0)} μs after connection`:'Before connection','The approach occupies 2 seconds of illustration. Then each tenfold increase in pulse time takes 2 seconds of playback, ending at 5 ms. Symbol travel speeds are illustrative.'),
    ]};
  });
  const render=result.update;let previousTime=0,disposed=false;
  const sync=()=>{const values=controller.getState().values;if(Object.keys(values).some(key=>values[key]!==plan.values[key]))plan=controller.getPlan();return render(values);};
  result.update=(values={})=>{controller.update(values);return sync();};
  result.reset=(initial={})=>{controller.reset(initial);previousTime=0;return sync();};
  result.advance=seconds=>{if(Number.isFinite(seconds)&&seconds>0)controller.advance(seconds);return sync();};
  result.animate=time=>{const dt=Number.isFinite(time)?Math.max(0,time-previousTime):0;if(Number.isFinite(time))previousTime=time;return result.advance(dt);};
  result.replayState=controller.replayState;
  result.playback={label:'Follow the lightning pulse',description:'An assumed attachment followed by 5 ms of the selected current shape, on a slowed logarithmic clock.',stepLabel:'Advance the pulse clock',advance:result.advance,step:()=>result.advance(.5),complete:()=>result.getState().complete,blocked:()=>false};
  result.actions=[['Inspect: connected installation','system'],['Inspect: field at the tip','tip-detail'],['Inspect: voltage beside the pipe','gap-detail'],['Inspect: pulse over time','pulse-detail'],['Inspect: ground potential','earth-detail']].map(([label,part])=>({label,part,isolate:true,view:'front',replay:false,run:()=>sync()}));
  result.resultPart={id:'system',label:'Inspect the connected installation',view:'front',focusOnComplete:false,preserveOnReset:true,available:()=>true};
  result.initialPart='system';result.initialView='front';result.initialCutaway=false;result.initialIsolated=true;result.includeCoversInSeparation=true;result.frameVisibleOnly=true;result.framePadding=.60;result.selectionOutline=false;result.transparentBackground=true;result.viewDirections={front:[.70,.38,6],iso:[1.6,.7,6]};
  const details=['tip-detail','gap-detail','pulse-detail','earth-detail'];
  result.partViewDirections=Object.fromEntries(result.parts.map(p=>[p.id,{front:details.includes(p.id)?[0,0,6]:[.70,.38,6]}]));
  for(const part of result.parts)part.framePadding=details.includes(part.id)?.49:.60;
  result.frameBoundsForPart=id=>details.includes(id)?new THREE.Box3(new THREE.Vector3(-2.62,-2.45,-.30),new THREE.Vector3(2.62,2.57,.7)).applyMatrix4(kit.parts.find(p=>p.id===id).object.matrixWorld):null;
  result.thumbnailOmit=[geometry.tip,geometry.gap,geometry.pulse,geometry.earthView,geometry.guides];
  result.catalogParts=result.parts.filter(p=>!['system','house','storm','foundation'].includes(p.id));
  result.topology=geometry;result.physicalPlan=controller.getPlan;result.duration=RUN;result.physicalDuration=.005;
  const dispose=result.dispose;result.dispose=()=>{if(!disposed){disposed=true;dispose();}};
  return result;
}

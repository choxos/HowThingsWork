import * as THREE from 'three';
import {houseModel,reading} from './house-model-kit.js';
import {createVibrationMotorGeometry,updateVibrationMotorGeometry} from './vibration-motor-geometry.js';
import {VIBRATION_DEFAULTS as D,VIBRATION_DOMAINS,createVibrationMotorController} from './vibration-motor-physics.js';

export function vibrationMotorControlVisible(key,v){return !['bodyMass','stiffness','damping'].includes(key)||(key==='bodyMass'?v.mount!==0:v.mount===2);}
export function createVibrationMotorModel(){
  const kit=houseModel('Vibration motor'),geometry=createVibrationMotorGeometry(kit),controller=createVibrationMotorController();
  const names={program:'Drive program',power:'Supply connection',voltage:'Drive voltage',direction:'Initial direction',balance:'Weight arrangement',mass:'Mass of each weight',offset:'Weight centroid offset',mount:'Carriage support',bodyMass:'Body and carriage mass',stiffness:'Mount stiffness per axis',damping:'Mount damping per axis'};
  const options={program:['Continuous drive','Drive then coast','Drive then brake','Drive then reverse'],power:['Disconnected','Connected'],direction:[{label:'Negative rotation',value:-1},{label:'Positive rotation',value:1}],balance:['One eccentric weight','Two opposed weights'],mount:['Rigidly clamped','Free planar guide','Spring and damper guide']};
  const hints={program:'A 200 ms physical record plays 100 times slower. Coast, brake and reverse switch at 75 ms. Changing any setting starts a new trial.',power:'Disconnect before the trial to prevent startup. To spin first and then disconnect, choose Drive then coast.',voltage:'Assigned ideal voltage, not a real motor rating. Zero connected volts shorts the terminals. This model omits stiction and a minimum starting voltage.',direction:'Positive rotation follows local X toward local Y around the vertical shaft. Direction changes the sign of current, speed and torque.',balance:'The second identical weight is fitted on the opposite side of the shaft. Their unbalance cancels, but both add mass and inertia.',mass:'Mass of one uniform half-annulus. Its thickness adjusts while the selected centroid offset stays fixed.',offset:'Distance from shaft axis to the weight center of mass. Outer radius adjusts; the concentric bore radius stays 0.8 mm.',mount:'All mounts hold the housing orientation fixed and support gravity normal to the horizontal plane. Only the last option adds linear restoring force and damping.',bodyMass:'Assigned translating mass excluding the eccentric weights. It includes the housing, balanced motor and carriage. The fixed jig is outside this mass.',stiffness:'The ideal mount supplies −kx and −ky. Both directions use this same linear stiffness.',damping:'The ideal mount supplies −c times velocity in each direction. It dissipates energy rather than restoring a position.'};
  const units={voltage:'V',mass:'g',offset:'mm',bodyMass:'g',stiffness:'N/m',damping:'N·s/m'};
  for(const key of Object.keys(D))kit.control(key,names[key],...VIBRATION_DOMAINS[key],D[key],units[key]||'',hints[key],options[key]?.map((option,i)=>typeof option==='string'?{label:option,value:i}:option),{primary:key==='program',visibleWhen:v=>vibrationMotorControlVisible(key,v)});
  const result=kit.finish(()=>{
    const s=controller.getState(),v=s.values,p=s.parameters,w=p.weight;
    updateVibrationMotorGeometry(geometry,s);
    const readings=[
      reading('Your result',s.phase,!v.power?'No startup without a connected supply.':v.balance?'Opposed weights cancel net unbalance; their added inertia still changes startup.':v.mount===0?'The clamp prevents carriage motion but still carries the rotating force.':'Weight acceleration and carriage recoil are solved together. Inspect the response to see physical displacement.'),
      reading('Physical record',`${(s.time*1000).toFixed(1)} of 200.0 ms`,'One physical millisecond takes 0.1 scene seconds. The drive program switches at 75 ms; changing a control restarts from rest.'),
      reading('Rotor speed',`${s.rpm.toFixed(0)} rpm · ${s.frequency.toFixed(2)} Hz`,'RPM is signed. Vibration frequency is the absolute rotation frequency for one eccentric weight; balanced weights cancel that unbalance.'),
      reading('Motor circuit',`${(s.current*1000).toFixed(2)} mA · ${s.backEmf.toFixed(3)} V back EMF`,`${s.circuit}. Current is (V − Kω)/R when connected and zero when open. R = 20 Ω and K = 0.002 in SI units.`),
      reading('Electromagnetic torque',`${(s.electromagneticTorque*1e6).toFixed(2)} μN·m`,'Torque is K times current. Negative torque during positive rotation slows the rotor; friction also opposes rotation.'),
      reading('Unbalance excitation',`${Math.hypot(s.excitation.x,s.excitation.y).toFixed(3)} N`,`${s.radialForce.toFixed(3)} N radial and ${s.tangentialForce.toFixed(3)} N tangential. The tangential term matters while speed changes.`),
      reading('Weight force on carriage',`${Math.hypot(s.weightReaction.x,s.weightReaction.y).toFixed(3)} N`,'This force also subtracts the weights’ translational inertia. It equals the unbalance excitation for a clamped carriage.'),
      reading('Carriage position',`X ${(s.x*1e6).toFixed(2)} μm · Y ${(s.y*1e6).toFixed(2)} μm`,'The assembly enlarges only carriage translation 20 times. The response plot uses physical micrometers. Housing rotation is prevented by ideal guides.'),
      reading('Calculated weight geometry',`${(w.outer*1000).toFixed(2)} mm outer radius · ${(w.thickness*1000).toFixed(3)} mm thick`,`${v.mass.toFixed(1)} g each; ${v.offset.toFixed(1)} mm centroid offset; 0.8 mm bore radius. Assigned uniform density: 15,630 kg/m³. Red and blue dots mark the individual weight centroids; colors distinguish equal-density weights.`),
      reading('Energy account',`${(s.work*1000).toFixed(3)} mJ work = ${(s.energy*1000).toFixed(3)} mJ stored + ${(s.loss*1000).toFixed(3)} mJ lost`,'Losses include winding resistance, rotor friction and mount damping. The ideal reversible source can absorb energy; no hardware efficiency or temperature is predicted.')
    ];
    if(v.mount===2)readings.push(reading('Uncoupled mount reference',`${p.naturalFrequency.toFixed(2)} Hz · damping ratio ${p.dampingRatio.toFixed(3)}`,'Computed from k, c and total translating mass. The actual trial includes coupling between rotor and carriage; this is not an independent imposed-speed oscillator.'));
    return {state:{...s,time:s.clock,physicalTime:s.time},readings};
  });
  const render=result.update;let lastTime=0,disposed=false;
  result.update=(values={})=>{controller.update(values);return render(controller.getState().values);};
  result.reset=(initial={})=>{controller.reset(initial);lastTime=0;return render(controller.getState().values);};
  result.advance=seconds=>{if(Number.isFinite(seconds)&&seconds>0)controller.advance(seconds);return render(controller.getState().values);};
  result.animate=time=>{const dt=Number.isFinite(time)?Math.max(0,time-lastTime):0;if(Number.isFinite(time))lastTime=time;return result.advance(dt);};
  result.replayState=controller.replayState;
  result.playback={label:'Run the vibration motor',description:'A 200 ms motor trial shown 100 times slower. Inspections preserve the trial.',stepLabel:'Advance the motor',advance:result.advance,step:()=>result.advance(.2),complete:()=>result.getState().complete,blocked:()=>result.getState().blocked};
  result.actions=[['Inspect: complete experiment','system'],['Inspect: connected motor','motor'],['Inspect: drive and current','circuit-detail'],['Inspect: force and carriage motion','response-detail'],['Inspect: energy account','energy-detail']].map(([label,part])=>({label,part,isolate:true,view:'front',replay:false,run:()=>render(controller.getState().values)}));
  result.resultPart={id:'system',label:'Inspect the complete experiment',view:'front',focusOnComplete:false,preserveOnReset:true,available:()=>true};
  result.initialPart='system';result.initialView='front';result.frameVisibleOnly=true;result.framePadding=.65;result.selectionOutline=false;result.transparentBackground=true;
  result.viewDirections={front:[1.8,2.5,3.8]};
  result.followParts=['motor','rotor','carriage','weight','counterweight'];
  const detailIds=['circuit-detail','response-detail','energy-detail'];
  result.partViewDirections=Object.fromEntries(result.parts.map(p=>[p.id,{front:detailIds.includes(p.id)?[0,0,3]:[1.8,2.5,3.8]}]));
  for(const part of result.parts)part.framePadding=detailIds.includes(part.id)?.57:.65;
  result.frameBoundsForPart=id=>{
    if(detailIds.includes(id))return new THREE.Box3(new THREE.Vector3(-2.10,-1.98,-.2),new THREE.Vector3(2.10,1.92,.45)).applyMatrix4(geometry[id==='circuit-detail'?'circuit':id==='response-detail'?'response':'energy'].matrixWorld);
    // Reserve every allowed weight size before playback or a fitting change.
    const range={motor:[-.86,1.04],rotor:[-.86,1.04],weight:[.69,1.04],counterweight:[-.17,.17]}[id];
    return range?new THREE.Box3(new THREE.Vector3(-.78,-.78,range[0]),new THREE.Vector3(.78,.78,range[1])).applyMatrix4(geometry[id].matrixWorld):null;
  };
  result.thumbnailOmit=[geometry.circuit,geometry.response,geometry.energy,geometry.guides];result.catalogParts=result.parts.filter(p=>!['system','motor','rotor'].includes(p.id));
  result.topology=geometry;const dispose=result.dispose;result.dispose=()=>{if(!disposed){disposed=true;dispose();}};
  return result;
}

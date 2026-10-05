import * as THREE from 'three';
import {houseModel,reading} from './house-model-kit.js';
import {createAccelerometerGeometry,updateAccelerometerGeometry} from './accelerometer-geometry.js';
import {ACCELEROMETER_DEFAULTS as D,ACCELEROMETER_DOMAINS,ACCELEROMETER_CAPACITORS,createAccelerometerController} from './accelerometer-physics.js';

const experiments=['Steady pose','Force step','Sinusoidal input','Self-test'];
export function accelerometerControlVisible(key,v){
  return ['experiment','power','axis','capacitor'].includes(key)||(['roll','pitch'].includes(key)&&[0,3].includes(v.experiment))||(key==='support'&&v.experiment===0)||(key==='amplitude'&&[1,2].includes(v.experiment))||(key==='frequency'&&v.experiment===2);
}

export function createAccelerometerModel(){
  const kit=houseModel('Accelerometer'),geometry=createAccelerometerGeometry(kit),controller=createAccelerometerController();
  const names={experiment:'Experiment',power:'3 V supply',axis:'Axis to inspect',roll:'Turn about the face normal',pitch:'Tilt the face upward',support:'Motion condition',amplitude:'Selected-axis input',frequency:'Input frequency',capacitor:'Output capacitor'};
  const options={experiment:experiments,power:['Off','On'],axis:['X','Y','Z'],support:['Held steady','Ideal free fall','Accelerating upward at 1 g'],capacitor:ACCELEROMETER_CAPACITORS.map(n=>n+' μF')};
  const hints={experiment:'Choose a steady force, a step, a sinusoid or internal self-test. The physical input record lasts one second, shown six times slower.',power:'Power is fixed at 3 V when on. Off makes the electronic reading unavailable; a supported proof mass still deflects mechanically.',axis:'Select the direction of the step or sinusoid, and the axis in the enlarged capacitance and response views. All three outputs remain visible on the module.',roll:'The complete module rotates. Positive 90° puts local +X upward; 180° puts local +Y downward.',pitch:'At +90° local +Z points upward. The ideal static reading is then +1 g on Z.',support:'Held: 1 g total specific force. Free fall: zero, although gravity still accelerates the sensor. Upward acceleration of 1 g: 2 g total specific force.',amplitude:'A declared input to the ideal sensing chain, in g. Step begins at 0.1 s. A sinusoid begins at zero with the filter initially at zero.',frequency:'Frequency of the imposed sinusoidal specific-force input. Mechanics are treated as quasi-static; the visible lag belongs to the external RC stage.',capacitor:'Each output uses the selected capacitance with nominal 32 kΩ. Larger capacitance reduces bandwidth and estimated white noise, but slows the electrical response.'};
  for(const key of Object.keys(D))kit.control(key,names[key],...ACCELEROMETER_DOMAINS[key],D[key],['roll','pitch'].includes(key)?'°':key==='amplitude'?'g':key==='frequency'?'Hz':'',hints[key],options[key]?.map((label,value)=>({label,value})),{primary:key==='experiment',visibleWhen:v=>accelerometerControlVisible(key,v)});
  const result=kit.finish(()=>{
    const state=controller.getState(),v=state.values,axis='xyz'[v.axis],vector=data=>'xyz'.split('').map(k=>`${k.toUpperCase()} ${data[k].toFixed(3)}`).join(' · ');
    updateAccelerometerGeometry(geometry,state);
    const readings=[reading('Your result',state.phase,!v.power?'The mass can deflect without power, but electronics cannot report it.':v.experiment===0?v.support===1?'Zero specific force does not mean zero gravity.':`${Math.hypot(...Object.values(state.force)).toFixed(2)} g total specific force. The steady output does not need ongoing motion.`:v.experiment===3?'Electrostatic self-test adds a signed internal perturbation to every axis. It does not change the external motion.':'Inspect the response plot to compare the input with the smoothed output.'),
      reading('Record time',`${state.time.toFixed(3)} of 1.000 s`,v.power?'Press Play to record or Step to advance. One physical second takes six scene seconds. A steady input stays steady during the record.':'Recording is unavailable until power is restored.'),
      reading('External specific force',vector(state.force)+' g','Local X, Y and Z axes rotate with the module. This is a − g expressed in sensor coordinates, not velocity or position.'),
      reading('Analog outputs',v.power?vector(state.voltage)+' V':'Unavailable: supply off','Nominal 3 V example: 1.5 V at zero input, 0.3 V/g sensitivity. Typical ADXL335 reference values, not guaranteed calibration.'),
      reading('Selected-axis response',v.power?`${axis.toUpperCase()}: ${state.equivalent[axis].toFixed(3)} → ${state.filtered[axis].toFixed(3)} g equivalent`:'Readout off',v.experiment===3?'Input includes internal self-test. Typical shifts are −0.325 V on X, +0.325 V on Y and +0.550 V on Z before output filtering.':'The left value drives the ideal readout. The right value is the nominal external RC-filtered result.'),
      reading('External RC filter',`${state.filter.cutoff.toFixed(2)} Hz · ${(state.filter.tau*1000).toFixed(2)} ms`,`${ACCELEROMETER_CAPACITORS[v.capacitor]} μF and nominal 32 kΩ. Sensor internal bandwidth, component tolerances and sampling are omitted.`)];
    if(v.experiment===2)readings.push(reading('Steady-state sine response',`${(state.filter.gain*100).toFixed(1)}% amplitude · ${state.filter.lag.toFixed(1)}° lag`,'The plotted record also includes the startup transient. This analytic ratio describes the external RC stage after that transient.'));
    readings.push(reading('Estimated output noise',v.power?`${state.filter.noiseMg.toFixed(2)} mg RMS on ${axis.toUpperCase()}`:'Unavailable','White-noise approximation: density × √(1.6 × bandwidth). Typical XY density is 150 μg/√Hz, Z is 300. Noise is not added to these ideal traces.'));
    if(v.experiment===0)readings.push(reading('Gravity-based tilt',state.tiltValid?'Usable under the steady-pose assumption':'Not a valid gravity-only tilt trial','An accelerometer alone cannot generally separate gravity from added linear acceleration. Static tilt also cannot reveal heading about gravity.'));
    return {state:{...state,time:state.clock,physicalTime:state.time},readings};
  });
  const render=result.update;let lastTime=0,disposed=false;
  result.update=(values={})=>{controller.update(values);return render(controller.getState().values);};
  result.reset=(initial={})=>{controller.reset(initial);lastTime=0;return render(controller.getState().values);};
  result.advance=seconds=>{if(Number.isFinite(seconds)&&seconds>0)controller.advance(seconds);return render(controller.getState().values);};
  result.animate=time=>{const dt=Number.isFinite(time)?Math.max(0,time-lastTime):0;if(Number.isFinite(time))lastTime=time;return result.advance(dt);};
  result.replayState=controller.replayState;
  result.playback={label:'Record the sensor response',description:'A one-second ideal input record, shown over six scene seconds. Inspect any part without restarting the record.',stepLabel:'Advance the record',advance:result.advance,step:()=>result.advance(.15),complete:()=>result.getState().complete,blocked:()=>result.getState().blocked};
  result.actions=[['Inspect: complete sensor module','module'],['Inspect: suspended mass','mass'],['Inspect: capacitance and readout','capacitive-detail'],['Inspect: input and filtered output','response-detail']].map(([label,part])=>({label,part,view:'front',isolate:true,replay:false,run:()=>render(controller.getState().values)}));
  result.resultPart={id:'module',label:'Inspect the sensor result',view:'front',focusOnComplete:false,preserveOnReset:true,available:()=>true};
  result.initialPart='module';result.initialView='front';result.frameVisibleOnly=true;result.framePadding=.63;result.selectionOutline=false;result.transparentBackground=true;
  const detailIds=['capacitive-detail','response-detail'];
  result.partViewDirections=Object.fromEntries(result.parts.map(p=>[p.id,{front:detailIds.includes(p.id)?[0,0,3]:[.18,.1,3]}]));
  for(const part of result.parts)part.framePadding=detailIds.includes(part.id)?.55:.64;
  result.frameBoundsForPart=id=>detailIds.includes(id)?new THREE.Box3(new THREE.Vector3(-2.04,-1.95,-.3),new THREE.Vector3(2.04,1.93,.55)).applyMatrix4(geometry[id==='capacitive-detail'?'detail':'plot'].matrixWorld):null;
  result.thumbnailOmit=[geometry.detail,geometry.plot,geometry.guides];result.catalogParts=result.parts.filter(p=>!['system','module'].includes(p.id));
  result.topology=geometry;const dispose=result.dispose;result.dispose=()=>{if(!disposed){disposed=true;dispose();}};
  return result;
}

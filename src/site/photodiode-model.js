import * as THREE from 'three';
import {houseModel,reading} from './house-model-kit.js';
import {createPhotodiodeGeometry,updatePhotodiodeGeometry} from './photodiode-geometry.js';
import {createPhotodiodeController,PHOTODIODE_DEFAULTS as D,PHOTODIODE_DOMAINS,PHOTODIODE_EXPERIMENT as E,formatPhotodiodeQuantity as fmt} from './photodiode-physics.js';

export function createPhotodiodeModel(){
  const kit=houseModel('Photodiode'),g=createPhotodiodeGeometry(kit),controller=createPhotodiodeController();
  const specs={
    distance:['Source distance','m','Moving the source changes on-axis irradiance by the inverse-square law. Drawn travel is compressed. A changed control starts a fresh, initially uncharged measurement.'],
    intensity:['Source radiant intensity','mW/sr','Assigned on-axis intensity at 950 nm. More source light generates more collected charge; 0 switches off the source.'],
    background:['Background at detector','mW/m²','Steady background, expressed as equivalent 950 nm irradiance. The direct-beam shutter does not block it.'],
    blocked:['Direct-beam shutter','','Insert an opaque blade into the direct optical path.',[{value:0,label:'Clear beam'},{value:1,label:'Blocked beam'}]],
    drive:['Source timing','','Compare continuous light with 38 kHz flashes at one-third duty. Current modes follow the ideal light waveform; open-circuit voltage takes time to change.',[{value:1,label:'38 kHz pulses · one-third duty'},{value:0,label:'Steady light'}]],
    mode:['Measurement circuit','','Paired switch blades connect both leads to only one instrument.',[{value:0,label:'Reverse bias · 5 V · current meter'},{value:1,label:'Zero bias · short-circuit current'},{value:2,label:'Open circuit · voltage meter'}]],
  };
  for(const key of Object.keys(D)){const [name,unit,help,options]=specs[key];kit.control(key,name,...PHOTODIODE_DOMAINS[key],D[key],unit,help,options);}
  const result=kit.finish(()=>{
    const s=controller.getState(),open=s.values.mode===2;updatePhotodiodeGeometry(g,s);
    return {state:s,readings:[
      reading('Your result',s.status,s.complete?'Measurement complete. Replay restores this experiment’s settings, starting voltage and clock.':'Press Play to compare light with measured current or accumulated voltage.'),
      reading('External current now',fmt(s.externalCurrent,'A'),open?'The ideal voltmeter takes no current. Inside the diode, photocurrent charges its capacitance and competes with diode conduction.':`Cycle mean ${fmt(s.meanExternalCurrent,'A')}. Conventional photocurrent flows from cathode to anode inside the diode, then from anode toward cathode through the external measurement circuit.`),
      reading('Anode minus cathode',fmt(s.voltage,'V'),open?'The anode becomes positive as separated charge accumulates. This voltage is a time-dependent teaching approximation.':s.values.mode===0?'The ideal reverse instrument holds the cathode 5 V above the anode.':'The ideal short-circuit ammeter holds both terminals at the same potential.'),
      reading('Direct light at detector',fmt(s.directIrradiance,'W/m²'),`On-state 950 nm irradiance at ${s.values.distance} m. Radiant intensity divided by distance squared, with the shutter applied. Background is separate.`),
      reading('Direct photocurrent',fmt(s.signalCurrent,'A'),`On-state light contribution. ${fmt(s.backgroundCurrent,'A')} of steady background photocurrent also flows internally. ${s.values.mode===0?'Reverse':'Zero-bias'} responsivity is ${s.responsivity.toFixed(3)} A/W.`),
      reading('Dark baseline',fmt(s.darkCurrent,'A'),s.values.mode===0?'Assigned 2 nA at 5 V, borrowed from the typical 10 V data-sheet reference. This is not a measured 5 V dark-current curve.':'Zero net external dark current in this ideal zero-bias/open model does not mean zero thermal fluctuations or zero total noise.'),
      reading('Collected photocharge',fmt(s.photoCharge,'C'),`${s.collectedPairEquivalents.toPrecision(4)} collected-pair equivalents from ${s.incidentPhotons.toPrecision(4)} incident 950 nm photons over elapsed time. Nominal quantum efficiency ${(100*s.quantumEfficiency).toFixed(1)}%; geometric marker counts are schematic.`),
      reading(open?'Stored charge change':'Charge through meter',fmt(open?s.capacitorChargeChange:s.externalCharge,'C'),open?`C ΔV with assigned 70 pF. ${fmt(s.internalDiodeCharge,'C')} has passed through the internal diode branch. Photocharge equals these two contributions.`:'Integrated external current includes the dark baseline in reverse mode. Partial pulses use their actual on-time.'),
      reading('Reverse shot-noise component',s.shotNoiseDensity===null?'Not applicable in this mode':fmt(s.shotNoiseDensity,'A/√Hz'),'Density √[2q(Idark + Iphoto)]. This is only one noise component; shunt resistance and readout electronics add noise. No total signal-to-noise ratio or TV decode outcome is inferred.'),
      reading('Open-voltage model',`${(s.steadyOpenVoltage*1000).toFixed(2)} mV continuous-light equilibrium`,'This reference uses the zero-bias collection coefficient. In open mode the fitted exponential and assigned 70 pF determine voltage over time; an 8.77 μs flash cannot jump straight to equilibrium. Low-light values are extrapolations.'),
      reading('Measurement clock',`${(s.realTime*1e6).toFixed(2)} μs real · ${s.time.toFixed(2)} / ${E.duration} s view`,`View slowed 19,000 times. Source on-time ${(s.onTime*1e6).toFixed(2)} μs. Prepared starting voltage ${(s.initialVoltage*1000).toFixed(1)} mV.`),
    ]};
  });
  const render=result.update;let previousTime=0,disposed=false;const sync=()=>render(controller.getState().values);
  result.update=(values={})=>{controller.update(values);return sync();};
  result.reset=(initial={})=>{controller.reset(initial);previousTime=0;return sync();};
  result.advance=seconds=>{if(Number.isFinite(seconds)&&seconds>0)controller.advance(seconds);return sync();};
  result.animate=time=>{const dt=Number.isFinite(time)?Math.max(0,time-previousTime):0;if(Number.isFinite(time))previousTime=time;return result.advance(dt);};
  result.replayState=controller.replayState;
  result.playback={label:'Run the photodiode measurement',description:'Follow light, separated charge and electrical output over 24 carrier periods.',stepLabel:'Advance one-sixth of a cycle',advance:result.advance,step:()=>result.advance(1/12),complete:()=>result.getState().complete,blocked:()=>false};
  result.actions=[['Inspect: complete experiment','bench'],['Inspect: photodiode package','detector'],['Inspect: carrier separation','junction'],['Inspect: light and output timing','response'],['Inspect: signal and noise','noise']].map(([label,part])=>({label,part,isolate:true,view:'front',replay:false,run:()=>sync()}));
  result.resultPart={id:'bench',label:'Inspect the measured response',view:'front',focusOnComplete:false,preserveOnReset:true,available:()=>true};
  result.initialPart='bench';result.initialView='front';result.initialCutaway=false;result.initialIsolated=true;result.includeCoversInSeparation=true;result.frameVisibleOnly=true;result.framePadding=.5;result.overviewZoom=1.35;result.selectionOutline=false;result.transparentBackground=true;
  result.viewDirections={front:[-1.8,1.4,6],iso:[-2.8,1.9,6]};const details=['junction','response','noise'];
  result.partViewDirections=Object.fromEntries(result.parts.map(p=>[p.id,{front:details.includes(p.id)?[0,0,6]:p.id==='detector'?[-4.6,1,3]:[-1.8,1.4,6]}]));
  for(const part of result.parts)part.framePadding=part.id==='bench'?.52:details.includes(part.id)?.5:.6;
  result.frameBoundsForPart=id=>details.includes(id)?new THREE.Box3(new THREE.Vector3(-2.75,-2.4,-.2),new THREE.Vector3(2.75,2.5,.6)).applyMatrix4(result.parts.find(p=>p.id===id).object.matrixWorld):null;
  result.thumbnailOmit=[g.junction,g.response,g.noise,g.opticalRoot,g.flowRoot];result.catalogParts=result.parts.filter(p=>!['bench','board'].includes(p.id));result.topology=g;result.duration=()=>E.duration;
  const dispose=result.dispose;result.dispose=()=>{if(!disposed){disposed=true;dispose();}};
  return result;
}

import * as THREE from 'three';
import {houseModel,reading} from './house-model-kit.js';
import {createOpticalSmokeGeometry,updateOpticalSmokeGeometry} from './optical-smoke-geometry.js';
import {createOpticalSmokeController,OPTICAL_SMOKE_DEFAULTS as D,OPTICAL_SMOKE_DOMAINS as DOMAINS,OPTICAL_SMOKE_RUN as R} from './optical-smoke-physics.js';
import {SMOKE_SCIENCE as C} from './smoke-detector-science.js';

export function createOpticalSmokeModel(){
  const kit=houseModel('Optical smoke detector'),g=createOpticalSmokeGeometry(kit),controller=createOpticalSmokeController();
  const specs={
    size:['Particle diameter','μm','Compare equal mass made from different single-size spheres. Actual smoke contains mixed sizes, shapes and optical properties.',[{value:.1,label:'0.1 μm · small spheres'},{value:.3,label:'0.3 μm spheres'},{value:1,label:'1 μm spheres'},{value:3,label:'3 μm · large spheres'}]],
    angle:['Receiver angle','°','Moves the receiver around the chamber. This changes scattering directions and the illuminated volume within its field of view.'],
    growth:['Room smoke increase','mg/m³ per minute','Assigned increase outside the chamber. This is a concentration experiment, not a fire-growth model. Physical changes start a new observation.'],
    program:['Smoke program','','Choose how the room air changes.',[{value:0,label:'Smoke rises throughout observation'},{value:1,label:'Fresh air enters after 180 s'},{value:2,label:'Clean room throughout observation'}]],
    power:['Battery contact','','Opening the contact stops emitter pulses, optical measurements and powered sound. Smoke can still enter.',[{value:1,label:'Battery connected'},{value:0,label:'Battery disconnected'}]],
    sound:['Sound demonstration','','Optional synthesized 3 kHz tone. Cadence runs in real time; pause stops sound. Browser volume is not a rated alarm level.',[{value:0,label:'Sound off'},{value:1,label:'Sound on'}]],
    pace:['Playback pace','','Changes display speed while preserving the physical state. Step always advances five simulated seconds.',[{value:.25,label:'Quarter pace'},{value:.5,label:'Half pace'},{value:1,label:'Normal pace'}]],
  };
  for(const key of Object.keys(D)){const [name,unit,help,options]=specs[key];kit.control(key,name,...DOMAINS[key],D[key],unit,help,options,key==='sound'?{replay:false}:undefined);}
  let playing=false,audioContext=null,oscillator=null,gain=null,audioError=false,audioStart=null,disposed=false;
  const mute=()=>{audioStart=null;if(gain&&audioContext){gain.gain.cancelScheduledValues(audioContext.currentTime);gain.gain.setValueAtTime(0,audioContext.currentTime);}};
  function enableSound(){
    try{const Audio=globalThis.AudioContext;if(!Audio){audioError=true;return;}if(!audioContext){audioContext=new Audio();oscillator=audioContext.createOscillator();gain=audioContext.createGain();gain.gain.value=0;oscillator.frequency.value=3000;oscillator.connect(gain);gain.connect(audioContext.destination);oscillator.start();}audioError=false;audioContext.resume().catch(()=>{audioError=true;});}catch{audioError=true;}
  }
  function soundFor(s){
    if(!audioContext||!gain)return;
    if(!playing||!s.values.sound||!s.values.power||!s.active||s.complete||audioContext.state!=='running'){mute();return;}
    const now=audioContext.currentTime;audioStart??=now;const phase=(now-audioStart)%4;gain.gain.cancelScheduledValues(now);gain.gain.setTargetAtTime(phase<2.5&&phase%1<.5?.025:0,now,.004);
  }
  const result=kit.finish(()=>{
    const s=controller.getState();updateOpticalSmokeGeometry(g,s,controller.getPlan());soundFor(s);
    const soundStatus=!s.values.sound?'Off':audioError?'Audio unavailable':audioContext?.state==='running'?'Ready':'Waiting for browser audio';
    return {state:{...s,soundReady:soundStatus==='Ready'},readings:[
      reading('Your result',s.status,'Compare assigned smoke inputs, sphere sizes and optical geometry. These times do not predict warning time in a real fire.'),
      reading('Current during a pulse',`${(s.current*1e9).toFixed(3)} nA`,`Potential current at the present smoke concentration during a ${R.pulse*1e6} μs emitter pulse. This is not continuous or time-averaged current. Purple and gold path guides remain visible for inspection.`),
      reading('Charge in that pulse',`${(s.charge*1e15).toFixed(1)} fC`,`I × pulse duration gives an expected ${Math.round(s.electrons).toLocaleString('en-US')} photoelectrons. This ideal calculation omits discrete fluctuations, background and readout noise.`),
      reading('Last measured sample',s.sample?`${(s.sample.current*1e9).toFixed(3)} nA at ${s.sample.time.toFixed(1)} s`:'No sample yet',s.sample?`Integrated ${(s.sample.charge*1e15).toFixed(1)} fC against ${(s.sample.threshold*R.pulse*1e15).toFixed(1)} fC. Result ${s.sample.hit?'high':'low'}. A sample retains its measured value while smoke changes between checks.`:'Advance to the next sample to measure the current smoke. A future alarm is not yet an observed result.'),
      reading('Confirmation and threshold',`${s.count} consecutive high checks`,`Trigger ${(s.trigger*1e9).toFixed(3)} nA; release ${(s.release*1e9).toFixed(3)} nA. Selected gain range ${(R.fullRange*1e9).toFixed(1)} nA with assigned limit codes ${R.triggerCode}/${R.steps} and ${R.releaseCode}/${R.steps}. Comparison is ideal, without ADC quantization or saturation.`),
      reading('Light seen by the receiver',`${(s.volume*1e9).toFixed(2)} mm³ of overlap`,`Receiver angle ${s.values.angle}°; half-field ${C.receiverHalfAngle}°. Only illuminated particles within that field contribute. Direct emitter separation ${s.values.angle/2}° exceeds the half-field.`),
      reading('Separate straight-beam probes',`${(s.beamShare*100).toFixed(2)}% over 30 mm · ${(s.roomShare*100).toFixed(2)}% over 10 m`,'Same uniform smoke and equal incident beams. These ideal probes compare attenuation; they are not extra photodiodes in the chamber. Their fractions remain material properties when the chamber battery is disconnected.'),
      reading('Smoke inside',`${(s.mass*1e6).toFixed(2)} mg/m³`,`Room ${(s.roomMass*1e6).toFixed(2)} mg/m³; exchange time ${R.lag} s. Modeled straight-beam loss is ${s.obscuration.toFixed(3)}% over 1 m. Sphere diameter ${s.values.size} μm; number density ${(s.number/1e6).toLocaleString('en-US',{maximumFractionDigits:0})} per cm³.`),
      reading('Sample and alarm record',s.onset===null?'No optical alarm recorded':`First alarm ${s.onset.toFixed(1)} s`,`Checks recorded ${s.samplesSeen}; next ${s.nextSample===null?'none':s.nextSample.toFixed(1)+' s'}. Pending counts reset after a failed check. Clearing can release the alarm while its history stays visible.`),
      reading('Sound demonstration',soundStatus,'Three half-second beeps with half-second gaps, followed by a 1.5 s gap. Optional tone is synthesized at 3 kHz in real time. Drawn diaphragm motion is enlarged and slowed; no rated sound pressure is claimed.'),
      reading('Observation clock',`${s.time.toFixed(1)} / ${R.duration} s`,`Runs ${R.speed*s.values.pace} times faster than real time. Step advances five simulated seconds. Inspection preserves time; physical settings start a new observation.`),
    ]};
  });
  const render=result.update;let previousTime=0;const sync=()=>render(controller.getState().values);
  result.update=(values={})=>{const before=controller.getState();controller.update(values);const after=controller.getState();if(after.values.sound&&!before.values.sound)enableSound();if(!after.values.sound)mute();if(after.time<before.time){playing=false;mute();}return sync();};
  result.reset=(initial={})=>{playing=false;mute();controller.reset(initial);previousTime=0;return sync();};
  result.advance=seconds=>{controller.advance(seconds);return sync();};
  result.animate=time=>{const dt=Number.isFinite(time)?Math.max(0,time-previousTime):0;if(Number.isFinite(time))previousTime=time;return result.advance(dt);};
  result.replayState=controller.replayState;
  result.playback={label:'Run the optical observation',description:'Thirty display seconds show ten minutes of assigned smoke input at normal pace.',stepLabel:'Advance five simulated seconds',advance:seconds=>result.advance(seconds*controller.getState().values.pace),step:()=>result.advance(.25),complete:()=>result.getState().complete,blocked:()=>false,setPlaying:value=>{playing=value===true;if(!playing)mute();sync();}};
  result.actions=[
    ...[['Inspect: connected assembly','system'],['Inspect: optical paths','chamber'],['Inspect: pulse measurement','pulse'],['Inspect: straight beams','beam'],['Inspect: angular scattering','pattern'],['Inspect: observation record','chart'],['Inspect: sounder','horn']].map(([label,part])=>({label,part,isolate:true,cutaway:true,view:'front',replay:false,run:sync})),
    {label:'Advance to next sample',part:'pulse',isolate:true,view:'front',replay:false,run:()=>{const s=controller.getState();if(s.nextSample!==null)controller.advance((s.nextSample-s.time)/R.speed);return sync();}},
    {label:'Clear smoke now',replay:false,run:()=>{controller.clear();return sync();}},
    {label:'Finish observation',part:'chart',isolate:true,view:'front',replay:false,run:()=>result.advance(R.duration/R.speed)},
  ];
  result.resultPart={id:'system',label:'Inspect the optical result',view:'front',focusOnComplete:false,preserveOnReset:true,available:()=>true};
  result.initialPart='system';result.initialView='front';result.initialCutaway=true;result.initialIsolated=true;result.frameVisibleOnly=true;result.includeCoversInSeparation=true;result.framePadding=.6;result.overviewZoom=1.25;result.selectionOutline=false;result.transparentBackground=true;
  const details=g.details.map(p=>p.userData.inspectionOnly);result.viewDirections={front:[-1,-3.2,7],iso:[-4,-3,6]};
  result.partViewDirections=Object.fromEntries(result.parts.map(p=>[p.id,{front:details.includes(p.id)?[0,0,6]:p.id==='chamber'?[0,-1.2,7]:[-1,-3.2,7]}]));
  result.frameBoundsForPart=id=>details.includes(id)?new THREE.Box3(new THREE.Vector3(-2.85,-2.48,-.3),new THREE.Vector3(2.8,2.6,.7)).applyMatrix4(result.parts.find(p=>p.id===id).object.matrixWorld):null;
  for(const part of result.parts)part.framePadding=details.includes(part.id)?.56:part.id==='system'?.59:.65;
  result.thumbnailOmit=[...g.details,g.flowRoot];result.catalogParts=result.parts.filter(p=>!['system','base','board','wires'].includes(p.id));result.topology=g;result.scientificPlan=controller.getPlan;result.duration=()=>R.duration/R.speed;
  const dispose=result.dispose;result.dispose=()=>{if(disposed)return;disposed=true;playing=false;mute();if(oscillator)oscillator.stop();if(audioContext)audioContext.close().catch(()=>{});dispose();};
  return result;
}

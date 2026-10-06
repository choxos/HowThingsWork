import * as THREE from 'three';
import {houseModel,reading} from './house-model-kit.js';
import {createSmokeDetectorGeometry,updateSmokeDetectorGeometry} from './smoke-detector-geometry.js';
import {createSmokeDetectorController,SMOKE_DETECTOR_DEFAULTS as D,SMOKE_DETECTOR_DOMAINS as DOMAINS,SMOKE_DETECTOR_RUN as R,SMOKE_PHOTO_THRESHOLD,SMOKE_PHOTO_CLEAR} from './smoke-detector-physics.js';
import {smokeChambers,SMOKE_SCIENCE} from './smoke-detector-science.js';

export function createReviewedSmokeDetectorModel(){
  const kit=houseModel('Smoke detector'),g=createSmokeDetectorGeometry(kit),controller=createSmokeDetectorController();
  const specifications={
    size:['Particle diameter','μm','Compare equal smoke mass using one sphere size at a time. Actual smoke contains a changing mixture of sizes and shapes.',[{value:.1,label:'0.1 μm · small spheres'},{value:.3,label:'0.3 μm spheres'},{value:1,label:'1 μm spheres'},{value:3,label:'3 μm · large spheres'}]],
    growth:['Room smoke increase','mg/m³ per minute','Assigned smoke input. This does not represent fire growth. Changing a physical setting starts a fresh observation.'],
    battery:['Battery voltage','V','Changes ion-chamber voltage and the low-battery comparison. The optical stage keeps its assigned regulated 3 V supply.'],
    angle:['Receiver angle','°','Move the viewing tube around the chamber. Both scattering angle and overlap with the light cone change.'],
    program:['Smoke program','','Choose how air outside the alarm changes.',[{value:0,label:'Smoke rises throughout observation'},{value:1,label:'Fresh air enters after 180 s'},{value:2,label:'Clean room throughout observation'}]],
    power:['Battery contact','','An open contact removes power from both sensing circuits and the horn. The sealed source continues to ionize air.',[{value:1,label:'Battery connected'},{value:0,label:'Battery disconnected'}]],
    sound:['Sound demonstration','','Optional quiet synthesized tone. Alarm cadence plays in real time while the smoke clock runs at the selected pace. Pause stops sound. Browser volume is not a rated alarm level.',[{value:0,label:'Sound off'},{value:1,label:'Sound on'}]],
    pace:['Playback pace','','Slow the observation without changing smoke input, thresholds or the current state. Step still advances five simulated seconds. Audio cadence stays in real time.',[{value:.25,label:'Quarter pace'},{value:.5,label:'Half pace'},{value:1,label:'Normal pace'}]],
  };
  for(const key of Object.keys(D)){const [name,unit,help,options]=specifications[key];kit.control(key,name,...DOMAINS[key],D[key],unit,help,options,key==='sound'?{replay:false}:undefined);}
  let playing=false,audioContext=null,oscillator=null,gain=null,audioError=false,audioAlarmStart=null,lastChirps=0,disposed=false;
  const mute=()=>{audioAlarmStart=null;if(gain&&audioContext){gain.gain.cancelScheduledValues(audioContext.currentTime);gain.gain.setValueAtTime(0,audioContext.currentTime);}};
  function enableSound(){
    try{const Audio=globalThis.AudioContext;if(!Audio){audioError=true;return;}if(!audioContext){audioContext=new Audio();oscillator=audioContext.createOscillator();gain=audioContext.createGain();gain.gain.value=0;oscillator.frequency.value=3000;oscillator.connect(gain);gain.connect(audioContext.destination);oscillator.start();}audioError=false;audioContext.resume().catch(()=>{audioError=true;});}catch{audioError=true;}
  }
  function audioFor(s){
    if(!audioContext||!gain)return;
    if(!playing||!s.values.sound||!s.values.power||s.complete||audioContext.state!=='running'){mute();lastChirps=s.chirps.length;return;}
    const now=audioContext.currentTime;
    if(s.active){audioAlarmStart??=now;const phase=(now-audioAlarmStart)%4;gain.gain.cancelScheduledValues(now);gain.gain.setTargetAtTime(phase<2.5&&phase%1<.5?.025:0,now,.004);}
    else{audioAlarmStart=null;if(s.chirps.length>lastChirps){gain.gain.cancelScheduledValues(now);gain.gain.setValueAtTime(.025,now);gain.gain.setValueAtTime(0,now+R.chirpDuration);}else if(gain.gain.value!==0)gain.gain.setTargetAtTime(0,now,.004);}
    lastChirps=s.chirps.length;
  }
  const stamp=time=>time===null?'No alarm recorded':`${time.toFixed(1)} s`;
  const result=kit.finish(()=>{
    const s=controller.getState(),plan=controller.getPlan();updateSmokeDetectorGeometry(g,s,plan);audioFor(s);
    const soundStatus=!s.values.sound?'Off':audioError?'Audio unavailable':audioContext?.state==='running'?'Ready':'Waiting for browser audio';
    return {state:{...s,soundReady:soundStatus==='Ready'},readings:[
      reading('Your result',s.status,'Compare selected sphere sizes and assigned smoke inputs. This experiment does not predict warning time or safety in a real fire.'),
      reading('Smoke inside',`${(s.mass*1e6).toFixed(2)} mg/m³`,`Room ${(s.roomMass*1e6).toFixed(2)} mg/m³. The chamber follows with an assigned ${R.lag} s exchange time. The sealed reference remains smoke-free.`),
      reading('Ion chamber current',s.values.power?`${(s.current*1e12).toFixed(2)} pA`:'0 pA · no collection voltage',`Clean-air reference ${(s.cleanCurrent*1e12).toFixed(2)} pA. Saturation ceiling ${(smokeChambers().sensing.saturation*1e12).toFixed(2)} pA. Smoke capture and recombination compete with collection.`),
      reading('Ion detect voltage',`${s.node.toFixed(3)} V`,s.values.power?`Current threshold ${s.ionThreshold.toFixed(3)} V. The series chambers carry equal current; the sensing voltage rises as its conductivity falls. Checks occur every ${R.ionPeriod} s in this teaching controller.`:'Without battery voltage the ions are still produced, but no net drift current drives the detect input.'),
      reading('Optical signal during pulse',`${(s.scattered*1e9).toFixed(3)} nA`,`Trigger ${(SMOKE_PHOTO_THRESHOLD*1e9).toFixed(3)} nA; release ${(SMOKE_PHOTO_CLEAR*1e9).toFixed(3)} nA. These are assigned calibration codes 10 and 7 of 31 in the selected 7.2 nA range. The signal is integrated over the illuminated region seen by the receiver.`),
      reading('Optical confirmation',s.values.power?`${s.photoCount} / 3 consecutive checks`:'Unavailable without power',`Last check ${s.photoLast?s.photoLast.time.toFixed(1)+' s':'none'}. Next ${s.nextPhoto===null?'none in this run':s.nextPhoto.toFixed(1)+' s'}. A failed check before confirmation clears the count.`),
      reading('Recorded alarm onsets',`Ionization: ${stamp(s.ionSeen)}; optical: ${stamp(s.photoSeen)}`,'These are past events in this observation. A sensor may later stop requesting the horn as its signal falls below the lower release threshold.'),
      reading('Straight beam remaining',`${(s.beamShare*100).toFixed(2)}% over 30 mm`,`The same uniform smoke leaves ${(s.roomShare*100).toFixed(2)}% over 10 m. Both percentages refer to equal light entering each path, before smoke loss.`),
      reading('Supply and battery check',s.values.power?`${s.values.battery.toFixed(1)} V battery · ${s.opticalSupply} V optical rail`:'Battery contact open',`${s.chirps.length} low-battery chirps recorded. Below the assigned 7.5 V trip, checks every 40 s request a brief chirp while neither sensor is in alarm. Past chirps remain in the record.`),
      reading('Sound demonstration',soundStatus,'Synthesized 3 kHz tone uses three half-second beeps, separated by half-second gaps, then a 1.5 s gap. It is a timing demonstration at browser volume. The diaphragm motion is enlarged and slowed; it does not reproduce the audible vibration frequency.'),
      reading('Observation clock',`${s.time.toFixed(2)} / ${R.duration} s`,`Smoke evolution runs ${R.speed*s.values.pace} times faster than real time at this pace. Each Step advances 5 simulated seconds. Physical controls restart the trial; inspections and pace changes preserve it.`),
      reading('Physical model',`Single-size spheres · refractive index ${SMOKE_SCIENCE.index}`,'Uniform chamber density, straight CSDA alpha tracks, constant alpha ion-pair yield, continuum diffusion capture, a small effective optical pupil and single scattering. No measured fire, airflow field, absorbing soot, dust, humidity, electrical leakage or acoustic sound level is modeled.'),
    ]};
  });
  const render=result.update;let previousTime=0;const sync=()=>render(controller.getState().values);
  result.update=(values={})=>{const before=controller.getState();controller.update(values);const after=controller.getState();if(after.values.sound&&!before.values.sound)enableSound();if(!after.values.sound)mute();if(after.time<before.time){playing=false;mute();lastChirps=0;}return sync();};
  result.reset=(initial={})=>{playing=false;mute();controller.reset(initial);previousTime=0;lastChirps=0;return sync();};
  result.advance=seconds=>{controller.advance(seconds);return sync();};
  result.animate=time=>{const dt=Number.isFinite(time)?Math.max(0,time-previousTime):0;if(Number.isFinite(time))previousTime=time;return result.advance(dt);};
  result.replayState=controller.replayState;
  result.playback={label:'Run the smoke observation',stepLabel:'Advance five simulated seconds',description:'At normal pace, thirty display seconds show ten minutes of assigned smoke input.',advance:seconds=>result.advance(seconds*controller.getState().values.pace),step:()=>result.advance(.25),complete:()=>result.getState().complete,blocked:()=>false,setPlaying:enabled=>{playing=enabled===true;if(!playing)mute();sync();}};
  result.actions=[
    ...[['Inspect: complete alarm','system'],['Inspect: ionization chambers','ions'],['Inspect: sealed source','source'],['Inspect: optical chamber','chamber'],['Inspect: comparisons and samples','circuit'],['Inspect: observation record','chart'],['Inspect: short and long beams','beam-comparison'],['Inspect: sounder','horn']].map(([label,part])=>({label,part,isolate:true,cutaway:true,view:'front',replay:false,run:sync})),
    {label:'Advance to next optical check',part:'circuit',isolate:true,view:'front',replay:false,run:()=>{const s=controller.getState();if(s.nextPhoto!==null)controller.advance((s.nextPhoto-s.time)/R.speed);return sync();}},
    {label:'Clear smoke now',replay:false,run:()=>{controller.clear();return sync();}},
    {label:'Finish observation',part:'chart',isolate:true,view:'front',replay:false,run:()=>result.advance(R.duration/R.speed)},
  ];
  result.resultPart={id:'system',view:'front',focusOnComplete:false,preserveOnReset:true,label:'Inspect the alarm result',available:()=>true};
  result.initialPart='system';result.initialView='front';result.initialCutaway=true;result.initialIsolated=true;result.frameVisibleOnly=true;result.includeCoversInSeparation=true;result.framePadding=.6;result.overviewZoom=1.32;result.selectionOutline=false;result.transparentBackground=true;
  result.viewDirections={front:[-1.2,-2,6],iso:[-3,-2,6]};const details=['source','circuit','chart','beam-comparison'];
  result.partViewDirections=Object.fromEntries(result.parts.map(p=>[p.id,{front:details.includes(p.id)?[0,0,6]:p.id==='ions'?[2.2,-3,7]:p.id==='chamber'?[0,-.5,6]:[-1.2,-2,6]}]));
  result.frameBoundsForPart=id=>details.includes(id)?new THREE.Box3(new THREE.Vector3(-2.8,-2.48,-.3),new THREE.Vector3(2.8,2.6,.7)).applyMatrix4(result.parts.find(p=>p.id===id).object.matrixWorld):null;
  for(const p of result.parts)p.framePadding=details.includes(p.id)?.55:p.id==='system'?.55:.65;
  result.parts.find(p=>p.id==='receiver').maxZoom=48;
  result.thumbnailOmit=[...g.detailParts,g.flowRoot];result.catalogParts=result.parts.filter(p=>!['system','board','wiring','body'].includes(p.id));result.topology=g;result.duration=()=>R.duration/R.speed;
  result.scientificPlan=controller.getPlan;
  const dispose=result.dispose;result.dispose=()=>{if(disposed)return;disposed=true;playing=false;mute();if(oscillator)oscillator.stop();if(audioContext)audioContext.close().catch(()=>{});dispose();};
  return result;
}

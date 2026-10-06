import * as THREE from 'three';
import {houseModel,reading} from './house-model-kit.js';
import {fixed} from './format.js';
import {createBurglarGeometry,updateBurglarGeometry} from './burglar-alarm-geometry.js';
import {createBurglarController,BURGLAR_DEFAULTS as D,BURGLAR_DOMAINS as DOMAINS,BURGLAR_SCIENCE as C,BURGLAR_WAVELENGTH} from './burglar-alarm-physics.js';

export function createBurglarAlarmModel(){
  const kit=houseModel('Active burglar alarm'),g=createBurglarGeometry(kit),controller=createBurglarController();
  const options=(labels,values=labels.map((_,i)=>i))=>labels.map((label,i)=>({label,value:values[i]}));
  const specs={
    mode:['Sensing method','','Microwave reflection is the active Doppler experiment. Compare it with a beam barrier and a passive thermal detector. Changing physical settings starts a new watch.',options(['Active microwave reflection','Active infrared beam','Passive infrared zones'])],
    path:['Microwave path','','Toward and away change range. A straight crossing has zero radial speed only at closest approach. The circular arc maintains range throughout.',options(['Toward the detector','Away from the detector','Straight across','Constant-radius arc'])],
    speed:['Target speed','m/s','Zero holds the target still. Moving targets start after 0.5 s and stop at the prescribed endpoint. The PIR comparison watches for 12 s.'],
    range:['Assigned path distance','m','Microwave: closest distance for straight paths, radius for the arc. PIR: forward depth of the crossing. This input is not a distance measured by CW radar.'],
    span:['Posts apart','m','Changes on-axis irradiance and pulse photocurrent by inverse-square spreading. This bare emitter/receiver example is not an Optex range calibration.'],
    hold:['Interruption setting','','The beam must remain missing for this duration after arming. Longer settings can ignore short crossings.',options(['50 ms','100 ms','250 ms','500 ms'],[50,100,250,500])],
    contrast:['Target over the room','°C','Changes the thermal radiance of the orange surface. At zero, its radiance matches the room; motion alone creates no PIR contrast.'],
    warming:['Whole scene warms','°C/min','Room and target warm together while keeping their temperature difference. The two elements reject a spatially uniform change when they match.'],
    balance:['Element mismatch','','Assigned responsivity difference. A mismatch leaves some output during common warming. These percentages are examples, not typical calibration data.',options(['Perfectly matched','1% mismatch','10% mismatch'],[0,1,10])],
    power:['Supply contact','','Opening the contact disables active emission, processing and powered sound. The prescribed target and its thermal radiation remain.',options(['Supply disconnected','Supply connected'])],
    sound:['Sound demonstration','','Optional 2 kHz beeps. Pause stops the audio; the default is muted. Browser volume is not a rated alarm level.',options(['Sound off','Sound on'])],
    pace:['Playback pace','','Changes display pace while preserving physical state. Step advances 50 ms; the fine-step action advances 1 ms.',options(['Quarter pace','Half pace','Normal pace'],[.25,.5,1])],
  };
  const enabled={path:v=>v.mode===0,range:v=>v.mode!==1,span:v=>v.mode===1,hold:v=>v.mode===1,contrast:v=>v.mode===2,warming:v=>v.mode===2,balance:v=>v.mode===2};
  for(const key of Object.keys(D)){const [label,unit,help,choices]=specs[key];kit.control(key,label,...DOMAINS[key],D[key],unit,help,choices,{...(enabled[key]?{enabledWhen:enabled[key]}:{}),...(key==='sound'?{replay:false}:{})});}
  let playing=false,audioContext=null,oscillator=null,gain=null,audioError=false,audioStart=null,disposed=false;
  const mute=()=>{audioStart=null;if(gain&&audioContext){gain.gain.cancelScheduledValues(audioContext.currentTime);gain.gain.setValueAtTime(0,audioContext.currentTime);}};
  function enableSound(){
    try{const Audio=globalThis.AudioContext;if(!Audio){audioError=true;return;}if(!audioContext){audioContext=new Audio();oscillator=audioContext.createOscillator();gain=audioContext.createGain();gain.gain.value=0;oscillator.frequency.value=2000;oscillator.connect(gain);gain.connect(audioContext.destination);oscillator.start();}audioError=false;audioContext.resume().catch(()=>{audioError=true;});}catch{audioError=true;}
  }
  function soundFor(s){
    if(!gain||!audioContext)return;
    if(!playing||!s.values.sound||!s.active||s.complete||audioContext.state!=='running'){mute();return;}
    const now=audioContext.currentTime;audioStart??=now;gain.gain.cancelScheduledValues(now);gain.gain.setTargetAtTime((now-audioStart)%1<.5?.02:0,now,.004);
  }
  const result=kit.finish(()=>{
    const s=controller.getState(),v=s.values;updateBurglarGeometry(g,s,controller.getPlan());soundFor(s);
    const soundStatus=!v.sound?'Off':audioError?'Audio unavailable':audioContext?.state==='running'?'Ready':'Waiting for browser audio';
    const rows=[reading('Your result',s.status,'This is an idealized sensing experiment with assigned thresholds and paths. It does not establish real intrusion coverage or product detection range.')];
    if(v.mode===0)rows.push(
      reading('Doppler shift now',`${fixed(s.doppler,2)} Hz`,`${fixed(s.radial,3)} m/s radial velocity; positive shift means approaching. The 24.125 GHz carrier has wavelength ${(BURGLAR_WAVELENGTH*1000).toFixed(3)} mm. Only radial motion changes the round-trip phase of this fixed point reflector.`),
      reading('Actual target motion',`${s.speed.toFixed(2)} m/s · assigned range ${s.distance.toFixed(3)} m`,'The experiment supplies these coordinates. Constant-radius motion has no point-target Doppler. A straight crossing changes from approaching to receding and has zero Doppler only at closest approach. Limbs and changing reflectivity are omitted.'),
      reading('Mixer I and Q',`${fixed(s.i,3)} · ${fixed(s.q,3)} relative`,'Both mixers share the transmitted reference; the second reference is shifted 90°. A fixed chair adds constant I/Q. Mixing removes the carrier and exposes the phase difference.'),
      reading('Filtered and averaged level',`${s.level.toFixed(4)} relative`,'Assigned 2 Hz high-pass and 1 kHz low-pass stages remove DC and limit bandwidth. A 10 ms exponential average of I² + Q² gives the squared decision level. The alarm requires at least 0.08 relative for 50 ms.'),
    );
    else if(v.mode===1)rows.push(
      reading('Beam at the receiver',s.blocked?'Blocked':`${(s.current*1e9).toFixed(3)} nA pulse peak`,`Clear-path peak ${(s.clearCurrent*1e9).toFixed(3)} nA at ${v.span} m. Assigned synchronous threshold ${(C.beamThreshold*1e9).toFixed(1)} nA. Off-times between 1 kHz pulses are expected. The ideal demodulated envelope follows blockage immediately; pulse-phase and sampling latency are omitted from the timer.`),
      reading('Current interruption',`${(s.held*1000).toFixed(1)} ms`,`${v.hold} ms is required after arming. ${s.blockedFor===null?'The stationary target remains on the beam.':`The 0.25 m width and ${v.speed.toFixed(1)} m/s speed give ${(s.blockedFor*1000).toFixed(1)} ms of total blockage.`}`),
      reading('Emitter pulse',`${C.pulseWidth*1e6} μs · ${C.pulseCurrent*1000} mA`,'Assigned 10% duty cycle at 1 kHz. The 0.17 W/sr typical TSAL6100 intensity at 100 mA is transferred approximately from its 20 ms test to these pulses. BPV10NF typical photocurrent uses 5 V bias. No noise or ambient saturation model is included.'),
    );
    else rows.push(
      reading('Power on the opposed elements',`+ ${(s.plus*1e9).toFixed(2)} nW · − ${(s.minus*1e9).toFixed(2)} nW`,'These inputs are relative to the initial uniform room. Five ideal lenslets share one focal plane. Each element receives only the portion of the warm rectangle in its optical fields, including projected geometry.'),
      reading('Changing thermal output',`${fixed(s.output*1e6,2)} μV`,'Two opposed elements feed a thermal response and electrical leakage. A stationary input starts settled and gives zero changing output. The assigned trigger is ±100 μV for 50 ms; a noise specification is not used as a detection threshold.'),
      reading('Target and room temperature',`${(s.body-273.15).toFixed(2)} °C · ${(s.room-273.15).toFixed(2)} °C`,`Ideal 5–14 μm band contrast ${s.bandContrast.toFixed(2)} W/m². Emissivity 0.98 includes reflected room radiation. The paired-element mismatch is ${v.balance}%. Constant thermal emission remains even when nothing moves.`),
    );
    rows.push(
      reading('Confirmation now',s.active?'Alarm latched':`${(s.held*1000).toFixed(1)} ms qualified`,v.mode===1?'The timer clears if the beam returns before the selected wait expires.':'The timer clears when the conditioned signal falls below threshold before 50 ms. No later event is reported before its time.'),
      reading('Recorded alarm',s.onset===null?'None so far':`First request at ${s.onset.toFixed(3)} s`,'The teaching latch keeps the request for the rest of the watch. A target can stop or leave the beam after triggering; Reset begins a new observation.'),
      reading('Power and sound',`${s.supply} V supply · ${s.sensorSupply} V sensor rail · sound ${soundStatus}`,'Ideal regulators and a driver power the sensing head and piezoelectric horn. The weak sensor signal requests the alarm; it does not supply the sound energy. Optional beeps use 2 kHz, half a second on and half a second off.'),
      reading('Observation clock',`${s.time.toFixed(3)} / ${s.duration.toFixed(3)} s`,'Normal pace follows physical time. Inspection pauses without changing settings or the clock. Inspecting inactive hardware does not switch sensing method. Inactive method-specific controls are disabled. Playback speed and sound preserve the physical state.'),
    );
    return {state:{...s,soundReady:soundStatus==='Ready'},readings:rows};
  });
  const render=result.update;let previousTime=0;
  const sync=()=>{const values=controller.getState().values;result.partViewDirections.target.front=values.mode===1?[3,-4,7]:[-.8,-4,7];return render(values);};
  result.update=(values={})=>{const before=controller.getState();controller.update(values);const after=controller.getState();result.autoFramePart=after.values.mode!==before.values.mode?'system':undefined;if(after.values.sound&&!before.values.sound)enableSound();if(!after.values.sound)mute();if(after.time<before.time){playing=false;mute();}return sync();};
  result.reset=(initial={})=>{playing=false;mute();controller.reset(initial);previousTime=0;return sync();};
  result.advance=seconds=>{controller.advance(seconds);return sync();};
  result.animate=time=>{const dt=Number.isFinite(time)?Math.max(0,time-previousTime):0;if(Number.isFinite(time))previousTime=time;return result.advance(dt);};
  result.replayState=controller.replayState;
  result.playback={label:'Run the sensing observation',description:'Watch the selected method follow the prescribed target. Normal pace uses physical seconds.',stepLabel:'Advance 50 milliseconds',advance:seconds=>result.advance(seconds*controller.getState().values.pace),step:()=>result.advance(.05),complete:()=>result.getState().complete,blocked:()=>false,setPlaying:value=>{playing=value===true;if(!playing)mute();sync();}};
  result.actions=[
    ...[['Inspect: connected assembly','system'],['Inspect: room and target','room'],['Inspect: sensing principle','principle'],['Inspect: signal waveforms','signal'],['Inspect: observation record','record'],['Inspect: powered circuit','electronics'],['Inspect: sounder','horn']].map(([label,part])=>({label,part,isolate:true,cutaway:true,view:'front',replay:false,run:sync})),
    {label:'Advance one millisecond',replay:false,run:()=>result.advance(.001)},
    {label:'Finish observation',part:'record',isolate:true,view:'front',replay:false,run:()=>result.advance(controller.getState().duration)},
  ];
  result.resultPart={id:'system',label:'Inspect the sensing result',view:'front',focusOnComplete:false,preserveOnReset:true,available:()=>true};
  result.initialPart='system';result.initialView='front';result.initialCutaway=true;result.initialIsolated=true;result.frameVisibleOnly=true;result.includeCoversInSeparation=true;result.framePadding=.6;result.overviewZoom=1.2;result.selectionOutline=false;result.transparentBackground=true;
  const details=g.details.map(p=>p.userData.inspectionOnly);result.viewDirections={front:[-.8,-4,7],iso:[-4,-4,6],top:[0,0,7],side:[7,0,1],back:[0,5,2],bottom:[0,0,-7]};
  result.partViewDirections=Object.fromEntries(result.parts.map(p=>[p.id,{front:details.includes(p.id)||['electronics','horn','battery','processor','reference','driver','regulator'].includes(p.id)?[0,0,7]:['sensor','radar-head','pir-head','pair'].includes(p.id)?[0,7,3]:[-.8,-4,7]}]));
  result.inspectionObjects=id=>{
    if(details.includes(id))return [g.details.find(p=>p.userData.inspectionOnly===id)];
    if(['pir-head','pair'].includes(id))return [g.sensor,g.pirHead,g.pair];
    if(id==='radar-head'||id==='sensor'&&controller.getState().values.mode===1)return [g.sensor,g.radarHead];
    if(id==='beam-posts')return [g.beamPosts,...g.posts.map(p=>p.object)];
    if(id==='beam-emitter'||id==='beam-receiver')return [g.beamPosts,g.posts[id==='beam-receiver'?1:0].object];
    return id==='fixed'?[g.chair]:[];
  };
  result.frameBoundsForPart=id=>details.includes(id)?new THREE.Box3(new THREE.Vector3(-2.98,-2.72,-.4),new THREE.Vector3(2.98,2.7,.7)).applyMatrix4(result.parts.find(p=>p.id===id).object.matrixWorld):id==='room'?new THREE.Box3(new THREE.Vector3(-3.45,-.3,-.2),new THREE.Vector3(3.45,5.12,1.8)).applyMatrix4(g.room.matrixWorld):null;
  for(const part of result.parts){part.framePadding=details.includes(part.id)?.57:part.id==='system'?.58:.64;part.maxZoom=180;}
  result.thumbnailOmit=[...g.details,g.fanRoot,...g.waveDots,...g.wireDots];result.catalogParts=result.parts.filter(p=>!['system','base','wires'].includes(p.id));result.topology=g;result.scientificPlan=controller.getPlan;result.duration=()=>controller.getState().duration;
  const dispose=result.dispose;result.dispose=()=>{if(disposed)return;disposed=true;playing=false;mute();if(oscillator)oscillator.stop();if(audioContext)audioContext.close().catch(()=>{});dispose();};
  return result;
}

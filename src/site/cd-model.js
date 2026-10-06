import * as THREE from 'three';
import { houseModel, reading } from './house-model-kit.js';
import { CD_DEFAULTS, CD_DOMAINS, CD_SOUNDS, CD_LOSSES, CD_TIMING, createCdController } from './cd-physics.js';
import { createCdHardware, updateCdHardware } from './cd-hardware.js';
import { createCdDetails, updateCdDetails } from './cd-details.js';

export function createCdModel(){
  const kit=houseModel('CD'),hardware=createCdHardware(kit),details=createCdDetails(kit,hardware.system),controller=createCdController();
  const options=(labels,values=labels.map((_,i)=>i))=>labels.map((label,i)=>({label,value:values[i]}));
  const specs={
    content:['Stored sound','Choose the actual 0.4-second stereo PCM that is encoded into the disc pattern, then recovered from the read symbols.',options(CD_SOUNDS)],
    radius:['Read radius','Select a starting position in millimeters. At 58 mm, the excerpt starts slightly inside that edge so every cell fits in the recorded zone. The pickup then follows the real, tiny outward spiral displacement.'],
    velocity:['Recorded track speed','Choose a 1.2–1.4 m/s recording reference. Cell lengths and spindle speed change; channel rate and 44.1 kHz audio remain fixed.',options(['1.2 m/s','1.3 m/s','1.4 m/s'],[12,13,14])],
    loss:['Unreadable symbols','Selected read EFM words are replaced with an invalid word and flagged as known erasures. This demonstrates coding limits, not a physical scratch or its length.',options(CD_LOSSES)],
    laser:['Read laser','Off prevents all transition detection, byte retrieval and audio, even though the spindle can still turn.',options(['Off','On'])],
    phase:['Separate optical-depth example','Compare two equal coherent waves using h = λ/(n × denominator). This changes only the interference diagram, not the recorded bits or real read quality.',options(['Quarter wavelength','Sixth wavelength','Eighth wavelength','Half wavelength'])],
    sound:['Hear recovered samples','Optional stereo playback uses only recovered PCM. Missing samples are muted. Pause, reset, sound off and leaving this item stop audio.',options(['Sound off','Sound on'])],
  };
  for(const key of Object.keys(CD_DEFAULTS)){
    const [label,help,choices]=specs[key];kit.control(key,label,...CD_DOMAINS[key],CD_DEFAULTS[key],key==='radius'?'mm':'',help,choices,key==='sound'?{replay:false}:undefined);
  }
  let playing=false,disposed=false,audioContext=null,audioSource=null,audioRead=null,audioBuffer=null,bufferRead=null,audioError=false,audioStartedAt=0,audioTime=0,previousTime=0;
  const stopSound=()=>{if(audioSource){audioSource.onended=null;try{audioSource.stop();}catch{}audioSource.disconnect();}audioSource=null;audioRead=null;};
  function soundFor(state,plan){
    if(!playing||!state.values.sound||!state.listening||disposed||audioContext?.state!=='running'){stopSound();return;}
    if(audioSource&&audioRead===plan.read)return;
    stopSound();
    if(bufferRead!==plan.read){audioBuffer=audioContext.createBuffer(2,plan.disc.samples,44100);plan.read.audio.forEach((samples,ch)=>audioBuffer.copyToChannel(samples,ch));bufferRead=plan.read;}
    audioSource=audioContext.createBufferSource();audioSource.buffer=audioBuffer;audioSource.connect(audioContext.destination);audioRead=plan.read;audioStartedAt=audioContext.currentTime;audioTime=state.time;audioSource.start(0,state.audioTime);
  }
  function enableSound(){
    try{
      const Audio=globalThis.AudioContext;if(!Audio){audioError=true;return;}
      audioContext??=new Audio();audioError=false;audioContext.resume().then(()=>{if(!disposed)soundFor(controller.getState(),controller.getPlan());}).catch(()=>{audioError=true;stopSound();});
    }catch{audioError=true;stopSound();}
  }
  const result=kit.finish(()=>{
    const s=controller.getState(),p=controller.getPlan(),v=s.values;updateCdHardware(hardware,s);updateCdDetails(details,s,p);soundFor(s,p);
    const soundStatus=!v.sound?'Off':audioError?'Audio unavailable':audioContext?.state==='running'?'Ready':'Waiting for browser audio';
    return {state:{...s,soundReady:soundStatus==='Ready'},readings:[
      reading('Your result',s.status,'The recovered waveform and optional sound come from received EFM symbols, reversed CIRC delays and parity recovery. The reader never substitutes a copy of the intended sound.'),
      reading('From marks to sound',`${s.receivedCells.toLocaleString('en-US')} cells → ${s.decodedSymbols.toLocaleString('en-US')} data symbols → ${s.samplePairs.toLocaleString('en-US')} stereo pairs`,'A channel one marks a change of pit/land level. EFM demodulation yields interleaved bytes, not yet the original PCM. A frame contains 588 channel cells; six stereo sample pairs contribute 24 audio bytes.'),
      reading('Repair and unresolved loss',`${s.stats.erased} flagged symbols · C1 ${s.stats.c1Repaired} repaired · C2 ${s.stats.c2Repaired} repaired`,`${s.stats.missingSamples} unresolved channel samples so far. C1 and C2 each repair up to four known erasures per codeword. C1 failures propagate flags into C2; the counts refer to different stages. Unresolved samples are muted, without interpolation.`),
      reading('Spindle and spiral',`${s.spiral.rpm.toFixed(1)} rpm at ${s.spiral.radiusMm.toFixed(4)} mm`,`${(v.velocity/10).toFixed(1)} m/s recorded track speed; 1.6 µm spiral pitch. Actual outward travel in this excerpt: ${s.spiral.travelMicrometers.toFixed(3)} µm. ${s.spiral.edgeAdjusted?'The excerpt starts just inside 58 mm to fit before the edge.':'The selected radius is the start of this short excerpt.'}`),
      reading('Spot and channel lengths',`${(p.optics.spotDiameterNm/1000).toFixed(2)} µm spot reference · ${p.optics.cellNm.toFixed(1)} nm per cell`,`${p.optics.minRunNm.toFixed(0)}–${p.optics.maxRunNm.toFixed(0)} nm for ordinary 3T–11T runs. The spot is a scalar circular-pupil first-dark-ring diameter at 780 nm and NA 0.45, not a computed analog detector response.`),
      reading('Read clock and audio clock',`${s.time.toFixed(3)} / ${s.duration.toFixed(2)} s · sound ${soundStatus}`,'First 64 cells read at 16 cells/s for inspection. The remainder of the encoded excerpt then takes two on-screen seconds. Disc rotation and radial travel follow the corresponding actual channel time. Recovered audio plays for 0.4 seconds at its original 44.1 kHz rate.'),
      reading('Separate two-wave experiment',`${p.optics.degrees.toFixed(0)}° phase · ${(100*p.optics.intensity).toFixed(0)}% normalized intensity`,`${p.optics.depthNm.toFixed(1)} nm height for optical depth λ/${p.optics.denominator}, using n = 1.55. This is equal-wave interference only. It neither predicts a real disc’s contrast nor changes this digital recording.`),
    ]};
  });
  const render=result.update,sync=()=>render(controller.getState().values);
  result.update=(values={})=>{
    const before=controller.getState();controller.update(values);const after=controller.getState();
    if(Object.keys(values).some(k=>!['phase','sound'].includes(k)&&before.values[k]!==after.values[k])){playing=false;stopSound();}
    if(after.values.sound&&!before.values.sound)enableSound();if(!after.values.sound)stopSound();return sync();
  };
  result.reset=(initial={})=>{
    if(!initial||typeof initial!=='object'||Array.isArray(initial)||Object.keys(initial).some(k=>!['settings','time'].includes(k)))throw new TypeError('Expected CD starting state');
    controller.reset({values:initial.settings??{},time:initial.time??0});playing=false;stopSound();previousTime=0;return sync();
  };
  result.advance=seconds=>{controller.advance(seconds);return sync();};
  result.animate=time=>{const dt=Number.isFinite(time)?Math.max(0,time-previousTime):0;if(Number.isFinite(time))previousTime=time;return result.advance(dt);};
  result.replayState=()=>{const initial=controller.replayState();return {settings:initial.values,time:initial.time};};
  result.playback={label:'Read and recover the CD sound',description:'Follow slowed transitions, decode the excerpt, then play its recovered stereo samples.',stepLabel:'Advance one channel cell in the first close-up',
    advance:seconds=>{
      const state=controller.getState();let elapsed=seconds;
      if(playing&&state.values.sound&&audioContext?.state==='running'){
        if(audioSource)elapsed=Math.max(0,audioTime+audioContext.currentTime-audioStartedAt-state.time);
        else if(state.time<CD_TIMING.readEnd&&state.time+seconds>=CD_TIMING.readEnd)elapsed=CD_TIMING.readEnd-state.time;
      }
      return result.advance(elapsed);
    },step:()=>result.advance(controller.getState().time<4?1/16:.025),complete:()=>controller.getState().complete,blocked:()=>false,
    setPlaying:value=>{playing=value===true;if(!playing)stopSound();sync();},
  };
  result.actions=[
    ['Inspect: complete CD player','player'],['Inspect: optical pickup','pickup'],['Inspect: laser to detector','optics'],['Inspect: spot and transitions','track'],
    ['Inspect: channel frame and EFM','codec'],['Inspect: error correction','errors'],['Inspect: recovered stereo waveform','waveform'],['Inspect: disc layers','layers'],
    ['Inspect: two-wave example','phase'],['Inspect: outward spiral and speed','spin'],['Inspect: carriage drive','traverse'],['Inspect: decoder and DAC','electronics'],['Inspect: stereo speakers','outputs'],
  ].map(([label,part])=>({label,part,isolate:true,cutaway:true,view:'front',replay:false,run:sync}));
  result.resultPart={id:'waveform',label:'Inspect recovered stereo samples',view:'front',focusOnComplete:false,preserveOnReset:true,available:()=>true};
  result.covers.push(hardware.lid,hardware.front,hardware.frontSlot,hardware.status,hardware.right,hardware.discFront);
  result.initialPart='player';result.initialView='front';result.initialIsolated=true;result.initialCutaway=true;result.frameVisibleOnly=true;result.framePadding=.68;result.selectionOutline=false;result.transparentBackground=true;
  const detailIds=details.details.map(p=>p.userData.inspectionOnly);
  result.viewDirections={front:[1.1,2.2,3]};
  kit.root.updateMatrixWorld(true);
  const sceneSize=new THREE.Box3().setFromObject(kit.root).getSize(new THREE.Vector3()),playerSize=new THREE.Box3().setFromObject(hardware.player).getSize(new THREE.Vector3());
  result.overviewZoom=Math.max(sceneSize.x,sceneSize.y,sceneSize.z)*.7/(Math.max(playerSize.x,playerSize.y,playerSize.z)*result.framePadding);
  result.partViewDirections=Object.fromEntries(result.parts.map(p=>[p.id,{front:detailIds.includes(p.id)?[0,0,7]:[1.1,2.2,3]}]));
  result.inspectionObjects=id=>detailIds.includes(id)?[details.panels[id]]:[];
  result.frameBoundsForPart=id=>detailIds.includes(id)?new THREE.Box3(new THREE.Vector3(-3.10,-2.82,-.12),new THREE.Vector3(3.10,2.75,.3)).applyMatrix4(details.panels[id].matrixWorld):
    id==='pickup'?new THREE.Box3(new THREE.Vector3(hardware.pickup.position.x-.11,-.19,-.16),new THREE.Vector3(hardware.pickup.position.x+.11,.14,.16)).applyMatrix4(kit.root.matrixWorld):null;
  for(const part of result.parts){part.framePadding=detailIds.includes(part.id)?.57:.68;part.maxZoom=180;part.inspectionView='front';}
  result.thumbnailOmit=details.details;result.catalogParts=result.parts.filter(p=>!['system','player'].includes(p.id));result.topology={...hardware,details};result.scientificPlan=controller.getPlan;result.duration=()=>controller.getState().duration;
  const dispose=result.dispose;result.dispose=()=>{if(disposed)return;disposed=true;playing=false;stopSound();if(audioContext)audioContext.close().catch(()=>{});dispose();};
  return result;
}

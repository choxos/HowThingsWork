import * as THREE from 'three';
import {houseModel,reading} from './house-model-kit.js';
import {createPhonemeGeometry,updatePhonemeGeometry} from './phonemes-geometry.js';
import {PHONEME_SOUNDS,PHONEME_DEFAULTS as D,PHONEME_DOMAINS as DOMAINS,GROUPS,createPhonemeController,phonemeComparison} from './phonemes-physics.js';

export function createPhonemesModel(){
  const kit=houseModel('Phonemes'),g=createPhonemeGeometry(kit),controller=createPhonemeController();
  const options=(labels,values=labels.map((_,i)=>i))=>labels.map((label,i)=>({label,value:values[i]})),sounds=options(PHONEME_SOUNDS.map(q=>`[${q.ipa}] as in ${q.word}`));
  const specs={
    first:['First sound','Choose a sustained vowel or approximate fricative. Word labels locate the sound; the model plays no full words.',sounds],
    second:['Second sound','A second 800 ms sound follows a 200 ms gap. Compare its source and frequency pattern with the first.',sounds],
    speaker:['Vowel measurements','Historical group means from Peterson and Barney, not a model of every speaker. This changes vowel pitch and formant targets; the approximate fricatives stay fixed.',options(['Men’s averages','Women’s averages','Children’s averages'])],
    pitch:['Second sound pitch','Shift only the second sound’s periodic source by six semitones, keeping its filter fixed. Unvoiced [s] and [ʃ] have no periodic source, so this setting has no effect on them.',options(['Six semitones lower','Published or assigned pitch','Six semitones higher'],[-6,0,6])],
    references:['Vowel chart reference','Changes the published mean markers and nearest-centroid counts. This is an F1/F2 distance illustration, not a phoneme recognizer, and it does not change sound or time.',options(['Men’s means','Women’s means','Children’s means'])],
    rate:['Samples each second','Synthesis includes only components below half this rate. At 8 kHz the upper 4–8 kHz region is unavailable; signals are renormalized, so this does not model telephone loudness.',options(['8,000 samples/s','16,000 samples/s'],[8,16])],
    window:['Frame window','Each complete 25 ms frame is tapered before its Fourier transform. Change this to see the tradeoff between peak width and spectral leakage.',options(['Hamming taper','Hann taper','Rectangular: no taper'])],
    airflow:['Airflow','Off produces actual zero samples and silence. Source settings remain visible as targets, but no measured acoustic energy appears.',options(['Off: no sound','On'])],
    sound:['Hear these samples','Optional playback of the same synthetic samples shown in the analyzer, at their original rate and pitch. Pause, reset, sound off and leaving this item stop audio.',options(['Sound off','Sound on'])],
  };
  for(const key of Object.keys(D)){const [label,help,choices]=specs[key];kit.control(key,label,...DOMAINS[key],D[key],'',help,choices,key==='sound'?{replay:false}:undefined);}
  let playing=false,disposed=false,audioContext=null,audioSource=null,audioAnalysis=null,audioBuffer=null,bufferSamples=null,audioError=false,audioStartedAt=0,audioOffset=0;
  const stopSound=()=>{if(audioSource){audioSource.onended=null;try{audioSource.stop();}catch{}audioSource.disconnect();}audioSource=null;audioAnalysis=null;};
  function soundFor(s,p){
    if(!playing||!s.values.sound||s.complete||disposed||audioContext?.state!=='running'){stopSound();return;}
    if(audioSource&&audioAnalysis===p.analysis)return;
    stopSound();
    if(bufferSamples!==p.samples){audioBuffer=audioContext.createBuffer(1,p.samples.length,p.rate);audioBuffer.copyToChannel(Float32Array.from(p.samples),0);bufferSamples=p.samples;}
    audioSource=audioContext.createBufferSource();audioSource.buffer=audioBuffer;audioSource.connect(audioContext.destination);audioAnalysis=p.analysis;audioStartedAt=audioContext.currentTime;audioOffset=s.time;audioSource.start(0,s.time);
  }
  function enableSound(){
    try{const Audio=globalThis.AudioContext;if(!Audio){audioError=true;return;}audioContext??=new Audio();audioError=false;audioContext.resume().then(()=>{if(!disposed)soundFor(controller.getState(),controller.getPlan());}).catch(()=>{audioError=true;stopSound();});}
    catch{audioError=true;stopSound();}
  }
  const result=kit.finish(()=>{
    const s=controller.getState(),p=controller.getPlan(),v=s.values,[a,b]=p.tokens.map(t=>t.parameters);updatePhonemeGeometry(g,s,p);soundFor(s,p);
    const soundStatus=!v.sound?'Off':audioError?'Audio unavailable':audioContext?.state==='running'?'Ready':'Waiting for browser audio';
    return {state:{...s,soundReady:soundStatus==='Ready',comparison:phonemeComparison(p,s)},readings:[
      reading('Your result',s.complete?phonemeComparison(p,s):s.status,'Symbols identify the chosen synthetic inputs. This lesson reveals acoustic differences; it does not automatically detect phonemes or prove what a listener will hear.'),
      reading('Source and filter',`[${a.ipa}]: ${a.kind==='vowel'?'voice':a.voiced?'voice + noise':'noise'} → [${b.ipa}]: ${b.kind==='vowel'?'voice':b.voiced?'voice + noise':'noise'}`,'Vowels use periodic source harmonics shaped by three resonances. Fricatives use a broad noise filter; [z] adds a low-frequency periodic source. The connected bench illustrates these operations, not anatomical cavities.'),
      reading('Pitch of each source',`${a.f0?a.f0.toFixed(1)+' Hz':'No periodic pitch'} → ${b.f0?b.f0.toFixed(1)+' Hz':'No periodic pitch'}`,'The pitch control shifts only the second periodic source. Vowel formants stay fixed when this control changes. Six semitones multiply frequency by the square root of two.'),
      reading('Vowel formant targets',`${a.formants.length?a.formants.join(' / ')+' Hz':'Not a vowel'} → ${b.formants.length?b.formants.join(' / ')+' Hz':'Not a vowel'}`,'F1, F2 and F3 are measured group means. They are filter parameters, not frequencies detected from the synthetic sound. Harmonics sample that filter; a spectral peak need not lie exactly on a formant.'),
      reading('Measured spectral pattern',s.bandResults.map((x,i)=>x?(x.total?`Sound ${i+1}: ${(x.low*100).toFixed(1)}% below 1 kHz; ${(x.high*100).toFixed(1)}% above 4 kHz`:`Sound ${i+1}: no acoustic energy`):`Sound ${i+1}: waiting`).join(' · '),'These are fractions of FFT power in one middle frame from each completed sound. The same window and scales apply to both. Spectral centroid is the power-weighted mean frequency, not pitch; silence has no centroid.'),
      reading('Samples and complete frames',`${s.arrived.toLocaleString('en-US')} samples · ${s.framesArrived} / ${p.frames.length} frames`,'Each 25 ms frame starts 10 ms after the previous one. Future samples and spectra are hidden. The last result retains a middle frame of the second sound for inspection.'),
      reading('Sampling and window',`${v.rate} kHz · ${['Hamming','Hann','Rectangular'][v.window]} · Nyquist ${p.rate/2} Hz`,`${p.frame.length} samples per frame; ${p.frame.nfft} FFT points; ${p.rate/p.frame.nfft} Hz grid spacing. Zero padding does not add frequency resolution. Strongest window sidelobe: ${p.leakage.sidelobe.toFixed(1)} dB.`),
      reading('Historical vowel variation',`${p.referenceStats.ownGroup} / 1,520 nearest own vowel with own-group means`,`Using ${GROUPS[v.references].name}’s Table II means for everyone gives ${p.referenceStats.right}/1,520, including ${p.referenceStats.children}/300 children. This Euclidean F1/F2 calculation is not a listening score or a validated classifier.`),
      reading('Clock and sound',`${s.time.toFixed(3)} / ${s.duration.toFixed(3)} s · sound ${soundStatus}`,'Each sound lasts 800 ms with 15 ms fades, separated by 200 ms. Audio uses the exact analyzer samples at their normal rate. Pause or inspect a result without changing its settings.'),
    ]};
  });
  const render=result.update,sync=()=>render(controller.getState().values);let previousTime=0;
  result.update=(values={})=>{const before=controller.getState();controller.update(values);const after=controller.getState();if(Object.keys(values).some(k=>!['sound','references'].includes(k)&&before.values[k]!==after.values[k])){playing=false;stopSound();}if(after.values.sound&&!before.values.sound)enableSound();if(!after.values.sound)stopSound();return sync();};
  result.reset=(initial={})=>{if(!initial||typeof initial!=='object'||Array.isArray(initial)||Object.keys(initial).some(k=>!['settings','time'].includes(k)))throw new TypeError('Expected phoneme starting state');playing=false;stopSound();controller.reset({values:initial.settings??{},time:initial.time??0});previousTime=0;return sync();};
  result.advance=seconds=>{controller.advance(seconds);return sync();};
  result.animate=time=>{const dt=Number.isFinite(time)?Math.max(0,time-previousTime):0;if(Number.isFinite(time))previousTime=time;return result.advance(dt);};
  result.replayState=()=>{const initial=controller.replayState();return {settings:initial.values,time:initial.time};};
  result.playback={label:'Compare two speech sounds',description:'Play two synthetic sounds through the analyzer, then compare their patterns.',stepLabel:'Advance 25 milliseconds',advance:seconds=>{
    const state=controller.getState();
    const elapsed=playing&&state.values.sound&&audioSource&&audioContext.state==='running'?Math.max(0,audioOffset+audioContext.currentTime-audioStartedAt-state.time):seconds;
    return result.advance(elapsed);
  },step:()=>result.advance(.025),complete:()=>result.getState().complete,blocked:()=>false,setPlaying:value=>{playing=value===true;if(!playing)stopSound();sync();}};
  result.actions=[...[
    ['Inspect: source and filter','system'],['Inspect: sound source','source'],['Inspect: resonance filters','filters'],['Inspect: one frame and spectrum','spectrum'],['Inspect: changing spectrogram','spectrogram'],['Inspect: measured vowel chart','vowels'],['Inspect: compare both sounds','comparison'],
  ].map(([label,part])=>({label,part,isolate:true,cutaway:true,view:'front',replay:false,run:sync})),
  {label:'Finish both sounds',part:'comparison',isolate:true,cutaway:true,view:'front',replay:false,run:()=>{playing=false;stopSound();return result.advance(controller.getState().duration);}}];
  result.resultPart={id:'comparison',label:'Compare the finished sounds',view:'front',focusOnComplete:false,preserveOnReset:true,available:()=>true};
  result.initialPart='system';result.initialView='front';result.initialCutaway=true;result.initialIsolated=true;result.frameVisibleOnly=true;result.framePadding=.6;result.overviewZoom=1.2;result.selectionOutline=false;result.transparentBackground=true;
  const detailIds=g.details.map(p=>p.userData.inspectionOnly);
  result.viewDirections={front:[0,0,7],iso:[-4,3,7],top:[0,7,.1],side:[7,0,.1],back:[0,0,-7],bottom:[0,-7,.1]};
  result.partViewDirections=Object.fromEntries(result.parts.map(p=>[p.id,{front:[0,0,7]}]));
  result.inspectionObjects=id=>detailIds.includes(id)?[g.details.find(p=>p.userData.inspectionOnly===id)]:[];
  result.frameBoundsForPart=id=>detailIds.includes(id)?new THREE.Box3(new THREE.Vector3(-3.16,-2.78,-.2),new THREE.Vector3(3.16,2.7,.4)).applyMatrix4(result.parts.find(p=>p.id===id).object.matrixWorld):null;
  for(const part of result.parts){part.framePadding=detailIds.includes(part.id)?.57:part.id==='system'?.57:.65;part.maxZoom=180;part.inspectionView='front';}
  result.thumbnailOmit=g.details;result.catalogParts=result.parts.filter(p=>p.id!=='system');result.topology=g;result.scientificPlan=controller.getPlan;result.duration=()=>controller.getState().duration;
  const dispose=result.dispose;result.dispose=()=>{if(disposed)return;disposed=true;playing=false;stopSound();if(audioContext)audioContext.close().catch(()=>{});dispose();};
  return result;
}

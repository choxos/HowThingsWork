import * as THREE from 'three';
import {houseModel,reading} from './house-model-kit.js';
import {createRecognitionGeometry,updateRecognitionGeometry} from './speech-recognition-geometry.js';
import {COMMAND_WORDS,RECOGNITION as C,RECOGNITION_DEFAULTS as D,RECOGNITION_DOMAINS as DOMAINS,createRecognitionController} from './speech-recognition-physics.js';

export function createSpeechRecognitionModel(){
  const kit=houseModel('Speech recognition'),g=createRecognitionGeometry(kit),controller=createRecognitionController();
  const options=(labels,values=labels.map((_,i)=>i))=>labels.map((label,i)=>({label,value:values[i]}));
  const specs={
    word:['Supplied word','Choose a real recording. This label is shown for comparison; the recognizer receives its samples without this answer.',options(COMMAND_WORDS)],
    voice:['Recorded voice','Two dataset contributors read the same words. A and B are anonymous labels, not demographic categories.',options(['Voice A','Voice B'])],
    examples:['Stored examples','Each stored word is a separate take from the input. More examples can help, but this small matcher still makes mistakes.',options(['Voice A only','Voice B only','Both voices'])],
    noise:['Added noise','Fixed noise is mixed before sample-rate conversion. The ratio uses RMS over the complete one-second clean recording. Lower dB means more noise.',options(['No added noise','10 dB: strong noise','20 dB: moderate noise','40 dB: faint noise'],[0,10,20,40])],
    rate:['Samples each second','8 kHz uses an offline antialias filter before downsampling. Its spectrum ends at 4 kHz; 16 kHz extends to 8 kHz.',options(['8,000 samples/s','16,000 samples/s'],[8,16])],
    window:['Frame window','Hamming and Hann taper each 25 ms frame. Rectangular keeps a square cut. Inspect Samples and Spectrum to compare the actual transform.',options(['Hamming taper','Hann taper','Rectangular: no taper'])],
    context:['Word context','Right and write use identical acoustic evidence. Assigned preferences are 50:50 without a clue, 90:10 for directions and 10:90 for writing.',options(['No clue','Directions: Turn ___','Writing: Please ___ it'])],
    application:['Use the word','A command moves the token, starts or stops the runner, or confirms/cancels. Dictation writes text and leaves the application alone.',options(['Run a local command','Write text'])],
    running:['Runner starts','Sets the small runner before speech arrives, independently of the supplied word. Go starts it; stop freezes its current position.',options(['Stopped','Running'])],
    microphone:['Microphone input','Disconnecting input supplies zeros. The battery still powers processing and the screen. This illustration uses supplied recordings and never records you.',options(['Disconnected','Connected'])],
    sound:['Hear the recording','Optional playback of exactly the processed input samples. Pause, reset and sound off stop it. Slower pace also lowers audio pitch.',options(['Sound off','Sound on'])],
    pace:['Playback pace','Changes elapsed-time speed without changing recognition. Step adds 10 ms. At slower pace the recording plays slower and lower in pitch.',options(['Quarter pace','Half pace','Normal pace'],[.25,.5,1])],
  };
  for(const key of Object.keys(D)){const [label,help,choices]=specs[key];kit.control(key,label,...DOMAINS[key],D[key],'',help,choices,key==='sound'?{replay:false}:undefined);}
  let playing=false,disposed=false,context=null,source=null,sourcePlan=null,audioBuffer=null,bufferSamples=null,audioError=false,sourcePace=null;
  const stopSound=()=>{if(source){source.onended=null;try{source.stop();}catch{}source.disconnect();}source=null;sourcePlan=null;sourcePace=null;};
  function soundFor(s,p){
    if(!playing || !s.values.sound || s.time>=p.captureEnd || disposed || context?.state!=='running'){stopSound();return;}
    if(source && sourcePlan===p.analysis && sourcePace===s.values.pace)return;
    stopSound();
    if(bufferSamples!==p.audio.samples){audioBuffer=context.createBuffer(1,p.audio.samples.length,p.rate);audioBuffer.copyToChannel(Float32Array.from(p.audio.samples),0);bufferSamples=p.audio.samples;}
    source=context.createBufferSource();source.buffer=audioBuffer;source.playbackRate.value=s.values.pace;source.connect(context.destination);
    sourcePlan=p.analysis;sourcePace=s.values.pace;
    source.start(context.currentTime+Math.max(0,C.captureStart-s.time)/s.values.pace,Math.max(0,s.time-C.captureStart));
  }
  function enableSound(){
    try{const Audio=globalThis.AudioContext;if(!Audio){audioError=true;return;}context??=new Audio();audioError=false;context.resume().then(()=>{if(!disposed)soundFor(controller.getState(),controller.getPlan());}).catch(()=>{audioError=true;stopSound();});}
    catch{audioError=true;stopSound();}
  }
  const result=kit.finish(()=>{
    const s=controller.getState(),v=s.values,p=controller.getPlan();updateRecognitionGeometry(g,s,p);soundFor(s,p);
    const soundStatus=!v.sound?'Off':audioError?'Audio unavailable':context?.state==='running'?'Ready':'Waiting for browser audio';
    const rows=[
      reading('Your result',s.status,'The known recording label and the inferred word are separate. This small whole-word matcher can reject an uncertain input or confidently select the wrong word.'),
      reading('Input and inferred word',`Recorded “${s.groundTruth}” · selected ${s.word?`“${s.word}”`:'none yet'}`,'Right and write share the same pronunciation. A writing context can choose write without changing any sound samples.'),
      reading('Application result',v.application?(s.dictation?`Text: ${s.dictation}`:'Waiting to write'):`Token (${s.position.map(x=>x.toFixed(2)).join(', ')}) · runner ${s.running?'running':'stopped'}${s.action==='confirm'?' · confirmed':s.action==='cancel'?' · canceled':''}`,'Direction commands move one grid spacing after the decision. Go/stop control a separate runner; yes/no visibly confirm/cancel. Writing mode changes text only.'),
      reading('Arrived samples and frames',`${s.samplesArrived.toLocaleString('en-US')} samples · ${s.framesArrived} / ${p.analysis.count} frames`,`At ${p.rate.toLocaleString('en-US')} samples/s, a frame contains ${p.analysis.length} samples. Frames overlap and start ${p.analysis.shift} samples apart. Blank future regions contain no later input.`),
      reading('Current complete frame',s.frame?`${(s.frame.start/p.rate*1000).toFixed(0)}–${(s.frame.end/p.rate*1000).toFixed(0)} ms · RMS ${s.frame.rms.toFixed(4)}`:'No frame yet','During capture, this is the latest complete frame. At the result, the last frame above the assigned activity level stays available for inspection.'),
      reading('Acoustic match',s.best?`${s.best.word} · distance ${s.best.distance.toFixed(3)} · reference ${s.best.voice?'B':'A'}`:'Waiting for active frames','Twelve nonzero mel cepstral coefficients describe each frame. Dynamic time warping aligns their sequence to each stored whole word. Lower distance fits better; this is not a probability.'),
      reading('Decision margin',s.best?`${s.lead.toFixed(3)} · requires ${C.minimumLead.toFixed(2)}`:'No candidate scores',`Total score = acoustic distance − ${C.contextWeight} ln(context preference). At least ${C.minimumFrames} active frames, distance ≤ ${C.maximumDistance.toFixed(1)} and the shown lead are required. Decisions wait until ${p.decisionTime.toFixed(1)} s. These thresholds are assigned.`),
      reading('Sampling and window',`${v.rate} kHz · ${['Hamming','Hann','Rectangular'][v.window]} · Nyquist ${p.rate/2} Hz`,`${p.analysis.nfft} FFT points give ${p.rate/p.analysis.nfft} Hz spacing. Zero padding adds no frequency resolution. The displayed spectrum uses single-sided amplitude with window coherent-gain correction, from −80 to 0 dBFS.`),
      reading('Recording treatment',`${v.noise?`${v.noise} dB input SNR`:'No added noise'} · ${p.audio.clipped} clipped samples`,'Original 16-bit recordings are peak-normalized to 0.8. Fixed noise is added, then the optional 127-tap offline antialias filter, then PCM16 rounding. The supplied audio is already digital; hardware illustrates the preceding microphone and conversion stages.'),
      reading('Clock and sound',`${s.time.toFixed(3)} / ${s.duration.toFixed(3)} s · sound ${soundStatus}`,'Inspection preserves settings and time. Physical controls prepare a new recording; sound and pace preserve the current experiment. Playback stops at the end of this observation.'),
    ];
    return {state:{...s,soundReady:soundStatus==='Ready'},readings:rows};
  });
  const render=result.update;let previousTime=0;
  const sync=()=>render(controller.getState().values);
  result.update=(values={})=>{const before=controller.getState();controller.update(values);const after=controller.getState();if(Object.keys(values).some(key=>!['pace','sound'].includes(key)&&after.values[key]!==before.values[key])){playing=false;stopSound();}if(after.values.pace!==before.values.pace)stopSound();if(after.values.sound&&!before.values.sound)enableSound();if(!after.values.sound)stopSound();return sync();};
  result.reset=(initial={})=>{if(!initial||typeof initial!=='object'||Array.isArray(initial)||Object.keys(initial).some(key=>!['settings','time'].includes(key)))throw new TypeError('Expected speech recognition starting state');playing=false;stopSound();controller.reset({values:initial.settings??{},time:initial.time??0});previousTime=0;return sync();};
  result.advance=seconds=>{controller.advance(seconds);return sync();};
  result.animate=time=>{const dt=Number.isFinite(time)?Math.max(0,time-previousTime):0;if(Number.isFinite(time))previousTime=time;return result.advance(dt);};
  result.replayState=()=>{const initial=controller.replayState();return {settings:initial.values,time:initial.time};};
  result.playback={label:'Hear a word become a command',description:'Play the one-second recording and follow its samples, word choice and visible result.',stepLabel:'Advance 10 milliseconds',advance:seconds=>result.advance(seconds*controller.getState().values.pace),step:()=>result.advance(.01),complete:()=>result.getState().complete,blocked:()=>false,setPlaying:value=>{playing=value===true;if(!playing)stopSound();sync();}};
  result.actions=[...[
    ['Inspect: connected phone','system'],['Inspect: microphone','microphone'],['Inspect: samples and frames','samples'],['Inspect: spectrum and spectrogram','features'],['Inspect: mel filters and features','mel'],['Inspect: word matching','matches'],['Inspect: word context','context'],['Inspect: screen result','screen'],
  ].map(([label,part])=>({label,part,isolate:true,cutaway:true,view:'front',replay:false,run:sync})),
  {label:'Finish this recording',part:'system',isolate:true,cutaway:true,view:'front',replay:false,run:()=>{playing=false;stopSound();return result.advance(controller.getState().duration);}}];
  result.resultPart={id:'system',label:'Inspect the recognized result',view:'front',focusOnComplete:false,preserveOnReset:true,available:()=>true};
  result.initialPart='system';result.initialView='front';result.initialCutaway=true;result.initialIsolated=true;result.frameVisibleOnly=true;result.includeCoversInSeparation=true;result.framePadding=.6;result.overviewZoom=1.2;result.selectionOutline=false;result.transparentBackground=true;
  const detailIds=g.details.map(p=>p.userData.inspectionOnly);
  result.viewDirections={front:[0,0,7],iso:[-4,3,7],top:[0,7,.1],side:[7,0,.1],back:[0,0,-7],bottom:[0,-7,.1]};
  result.partViewDirections=Object.fromEntries(result.parts.map(p=>[p.id,{front:['microphone','diaphragm'].includes(p.id)?[3,-2,4]:[0,0,7]}]));
  result.inspectionObjects=id=>detailIds.includes(id)?[g.details.find(p=>p.userData.inspectionOnly===id)]:[];
  result.frameBoundsForPart=id=>detailIds.includes(id)?new THREE.Box3(new THREE.Vector3(-2.83,-2.65,-.2),new THREE.Vector3(2.83,2.7,.4)).applyMatrix4(result.parts.find(p=>p.id===id).object.matrixWorld):null;
  for(const part of result.parts){part.framePadding=detailIds.includes(part.id)?.57:part.id==='system'?.57:.64;part.maxZoom=180;part.inspectionView='front';}
  result.thumbnailOmit=[...g.details,g.waves];result.catalogParts=result.parts.filter(p=>!['system','traces'].includes(p.id));result.topology=g;result.scientificPlan=controller.getPlan;result.duration=()=>controller.getState().duration;
  const dispose=result.dispose;result.dispose=()=>{if(disposed)return;disposed=true;playing=false;stopSound();if(context)context.close().catch(()=>{});dispose();};
  return result;
}

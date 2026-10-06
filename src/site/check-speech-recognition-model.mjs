import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import * as THREE from 'three';
import {createSpeechRecognitionModel} from './speech-recognition-model.js';
import {recordedSpeechRecognitionLesson as lesson} from './speech-recognition-lesson.js';
import {RECOGNITION_DEFAULTS as D,RECOGNITION as C,recognitionPlan,recognitionAt} from './speech-recognition-physics.js';
import {recognitionSpectrum} from './speech-recognition-geometry.js';
import {tally,checkFinite,checkDisposal,checkTrialNumbers} from './model-check-kit.mjs';
import {createStudyModel} from './study-models.js';
import {houseComponents} from './house-components.js';
import {createPhonemesModel} from './phonemes-model.js';
const t=tally(),m=createSpeechRecognitionModel(),g=m.topology,outcomes=[],controlCases=[];
const expected=['up','up','up','up','up','no','go',null,'right','write','up','stop','yes','no','left',null,'left',null];
const run=values=>{const p=recognitionPlan(values);return {plan:p,end:recognitionAt(p,3)};};
checkTrialNumbers(lesson,{
 'A word moves the marker':({plan})=>({'1.6':plan.decisionTime}),
 'Watch the spectrogram grow':()=>({}),
 'Eight thousand samples a second':({plan})=>({'200':plan.analysis.length,'400':.025*16000,'8':plan.rate/1000,'31.25':plan.rate/plan.analysis.nfft,'4':plan.rate/2000}),
 'A square cut':({plan})=>({'13.3':-plan.leakage.sidelobe,'42.7':-recognitionPlan().leakage.sidelobe}),
 'A Hann taper':({plan})=>({'31.5':-plan.leakage.sidelobe}),
 'An unfamiliar voice':()=>({}),
 'Examples from that voice':()=>({}),
 'Same sound, no clue':()=>({}),
 'A direction from context':({end})=>({'90':end.best.prior*100,'10':end.candidates.find(x=>x.word==='write').prior*100,'0.110':end.lead}),
 'Write the same sound':()=>({}),
 'Text instead of movement':()=>({}),
 'Stop a moving runner':({plan})=>({'1.6':plan.decisionTime}),
 'Confirm a choice':()=>({}),
 'Cancel a choice':()=>({}),
 'Strong noise changes the result':()=>({}),
 'An uncertain choice':({end})=>({'0.019':end.lead,'0.08':C.minimumLead}),
 'A clear margin can still be wrong':()=>({}),
 'Disconnect the input':()=>({}),
},run,t,m);
assert.deepEqual(m.controls.map(c=>c.key),Object.keys(D));t.add();
const ends=object=>[-1,1].map(sign=>object.localToWorld(new THREE.Vector3(0,sign*object.geometry.parameters.height/2,0)));
for(const [index,trial]of lesson.tryIt.entries()){
 assert.deepEqual(Object.keys(trial.values),Object.keys(D));assert.deepEqual(trial.initialState,{settings:trial.values,time:0});t.add(2);
 t.ok(trial.reset&&trial.isolate&&trial.cutaway&&m.parts.some(p=>p.id===trial.part),'Trial prepares its own inspectable state');
 m.reset({settings:{...D,word:0,microphone:0},time:2});m.reset(trial.initialState);assert.deepEqual(m.getState().values,trial.values);t.near(m.getState().time,0,0,'Trial resets clock');
 for(const time of [0,.325,.65,1.299,1.6,2,3]){
  m.reset({...trial.initialState,time});const s=m.getState(),p=m.scientificPlan();m.root.updateMatrixWorld(true);
  t.near(g.token.position.x,1.53+s.position[0]*.53,1e-12,'Screen x follows command');t.near(g.token.position.y,-.25+s.position[1]*.53,1e-12,'Screen y follows command');
  t.near(g.runnerDot.position.x,.15*Math.cos(s.runnerAngle),1e-12,'Runner follows integrated initial/action state');t.near(g.runnerDot.position.y,.15*Math.sin(s.runnerAngle),1e-12,'Runner angle remains continuous');
  t.ok(g.grid.visible===!s.values.application&&g.runner.visible===!s.values.application,'Dictation hides command display');
  t.near(g.membrane.position.z,.48+(s.stage==='listening'&&s.values.microphone?s.sample*.035:0),1e-12,'Membrane follows arrived input only');
  const blade=ends(g.switchPivot.children[0]),a=new THREE.Vector3(...g.contactA),b=new THREE.Vector3(...g.contactB);
  t.ok(blade.some(v=>v.distanceTo(a)<1e-7),'Mic switch stays attached');t.ok(s.values.microphone?blade.some(v=>v.distanceTo(b)<1e-7):blade.every(v=>v.distanceTo(b)>.1),'Mic disconnection has a visible gap');
  for(const [name,objects]of Object.entries(g.wireMeshes))for(const [i,o]of objects.entries()){const e=ends(o);t.ok(e.some(v=>v.distanceTo(new THREE.Vector3(...g.paths[name][i]))<1e-7)&&e.some(v=>v.distanceTo(new THREE.Vector3(...g.paths[name][i+1]))<1e-7),'Conductor reaches connected endpoints');}
  t.ok(g.spectrogram.geometry.drawRange.count===s.framesArrived*65*6,'Only arrived spectrogram cells drawn');
  if(s.framesArrived){const cells=g.spectrogram.geometry.attributes.position,frame=p.analysis.frames[s.framesArrived-1],i=(s.framesArrived-1)*65*4;t.near(cells.getX(i),-2.3+4.6*((frame.start+p.analysis.length/2)/p.rate-.005),3e-7,'Spectrogram columns use physical frame centers');t.near(cells.getY(i),-1.35,3e-7,'Zero-Hz display band begins at axis');t.near(cells.getY(i+64*4+2),-.15,3e-7,'Nyquist display band ends at axis');}
  const wave=g.waveform.geometry.attributes.position,n=g.waveform.geometry.drawRange.count;
  t.ok(n===Math.ceil(s.samplesArrived/8),'Waveform contains only arrived samples');if(n)t.ok(wave.getX(n-1)<=-2.35+4.7*s.samplesArrived/p.audio.samples.length,'No future waveform');
  if(s.frame){const spectral=recognitionSpectrum(s.frame,p),line=g.spectrum.geometry.attributes.position;for(let k=0;k<spectral.length;k++){t.near(line.getX(k),-2.3+4.6*(k*p.rate/p.analysis.nfft)/8000,3e-7,'Spectrum x is physical frequency');t.near(line.getY(k),.5+(Math.min(0,spectral[k])+80)/80*1.13,3e-7,'Spectrum y matches amplitude dBFS');}}
  else t.ok(g.spectrum.geometry.drawRange.count===0&&g.melBars.every(o=>!o.visible)&&g.cepstralBars.every(o=>!o.visible),'Input diagrams blank before first complete frame');
  const before=structuredClone(s);for(const action of m.actions.filter(a=>a.label.startsWith('Inspect:'))){action.run();assert.deepEqual(m.getState(),before);t.add();}
  t.ok(s.readings.every(r=>!/(undefined|NaN|Infinity)/.test(r.value+' '+r.hint)),'Finite explained readings');checkFinite(m.root,t);
 }
 const s=m.getState();assert.equal(s.word,expected[index],trial.title);t.add();outcomes.push({title:trial.title,word:s.word,action:s.action,position:s.position,lead:s.lead});
 m.reset(m.replayState());assert.deepEqual(m.getState().values,{...trial.values,sound:0});t.near(m.getState().time,3,0,'Reset replays explicitly prepared starting time');m.reset(trial.initialState);m.advance(3);m.reset(m.replayState());t.near(m.getState().time,0,0,'Ordinary prepared replay starts at zero');
}
for(const c of m.controls)for(const value of c.options.map(o=>o.value)){
 m.reset();m.advance(.75);m.update({[c.key]:value});const s=m.getState();t.near(s.values[c.key],value,0,'Every exposed control value is applied');t.near(s.time,['pace','sound'].includes(c.key)||value===D[c.key]?.75:0,1e-12,'Only physical changes reset time');m.playback.step();checkFinite(m.root,t);controlCases.push({key:c.key,value});
}
m.reset();m.playback.step();t.near(m.getState().time,.01,1e-12,'10 ms step');m.update({pace:.25});m.playback.advance(1);t.near(m.getState().time,.26,1e-12,'Quarter pace');m.actions.at(-1).run();t.ok(m.playback.complete(),'Finish reaches result');
for(const rate of [8,16]){m.reset({settings:{rate}});m.actions.at(-1).run();t.ok(m.playback.complete(),'Finish from exactly zero completes before Play');t.near(m.getState().time,m.duration(),0,'Completion and clock use identical endpoint');m.reset(m.replayState());t.near(m.getState().time,0,0,'Finish replay starts from zero');t.near(m.getState().values.rate,rate,0,'Finish replay keeps prepared rate');}
for(const part of m.parts)t.ok(!new THREE.Box3().setFromObject(part.object).isEmpty(),part.id+' has geometry');
t.ok(lesson.parts.every(p=>m.parts.some(x=>x.name===p.name)),'Lesson parts map to visible parts');
assert.equal(houseComponents.Phonemes.createModel,createPhonemesModel);t.add();const registered=createStudyModel('Speech recognition');t.ok(registered.controls.some(c=>c.key==='word'),'New whole-word factory routed');registered.dispose();
const resources=checkDisposal(m,t);

// Audio lifecycle and source samples can be checked without a browser permission.
const originalAudio=globalThis.AudioContext,contexts=[];
class AudioMock{
 constructor(){this.state='running';this.currentTime=10;this.destination={};this.sources=[];contexts.push(this);}
 resume(){return Promise.resolve();}close(){this.state='closed';return Promise.resolve();}
 createBuffer(channels,length,rate){return {channels,length,sampleRate:rate,copyToChannel(values){this.samples=values;}};}
 createBufferSource(){const s={playbackRate:{value:1},connect(){},disconnect(){this.disconnected=true;},start(...args){this.started=args;},stop(){this.stopped=true;}};this.sources.push(s);return s;}
}
try{
 globalThis.AudioContext=AudioMock;const audio=createSpeechRecognitionModel();audio.update({sound:1});audio.playback.setPlaying(true);await Promise.resolve();const context=contexts.at(-1),first=context.sources.at(-1);
 assert.deepEqual(first.started,[10.3,0]);assert.deepEqual(first.buffer.samples,Float32Array.from(audio.scientificPlan().audio.samples));t.add(2);
 audio.advance(.7);audio.playback.setPlaying(false);t.ok(first.stopped&&first.disconnected,'Pause stops and disconnects source');
 audio.playback.setPlaying(true);const resumed=context.sources.at(-1);t.near(resumed.started[1],.4,1e-12,'Resume uses elapsed offset');
 audio.update({pace:.5});t.ok(resumed.stopped,'Pace stops old source');t.near(context.sources.at(-1).playbackRate.value,.5,0,'Pace applied to actual audio');
 audio.update({sound:0});t.ok(context.sources.at(-1).stopped,'Sound off stops source');audio.update({sound:1});audio.playback.setPlaying(true);await Promise.resolve();audio.reset();t.ok(context.sources.at(-1).stopped,'Reset stops source');
 audio.update({sound:1});audio.playback.setPlaying(true);await Promise.resolve();audio.dispose();t.ok(context.sources.at(-1).stopped&&context.state==='closed','Dispose stops source and closes context');
}finally{globalThis.AudioContext=originalAudio;}
const report={passed:true,checks:t.count,parts:m.parts.map(p=>p.id),catalogParts:m.catalogParts.map(p=>p.id),resources,outcomes,controlCases,audioLifecycle:true};
if(process.env.EVIDENCE_DIR){await mkdir(process.env.EVIDENCE_DIR,{recursive:true});await writeFile(process.env.EVIDENCE_DIR+'/model.json',JSON.stringify(report,null,2));}
console.log(`PASS speech recognition model: ${t.count} checks; ${m.parts.length} parts; ${outcomes.length} trials; ${controlCases.length} exposed values; ${resources} resources`);

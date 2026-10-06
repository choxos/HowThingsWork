import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import * as THREE from 'three';
import {createPhonemesModel} from './phonemes-model.js';
import {reviewedPhonemesLesson as lesson} from './phonemes-lesson.js';
import * as P from './phonemes-physics.js';
import {TABLE_I} from './speech-physics.js';
import {houseComponents} from './house-components.js';
import {tally,checkFinite,checkDisposal,checkTrialNumbers} from './model-check-kit.mjs';
const t=tally(),D=P.PHONEME_DEFAULTS,m=createPhonemesModel(),g=m.topology,outcomes=[],controlCases=[];
const run=values=>{const plan=P.phonemePlan(values);return {plan,end:P.phonemeAt(plan,3)};};
checkTrialNumbers(lesson,{
 'Open against close':({plan:p})=>({'730':p.tokens[0].parameters.formants[0],'270':p.tokens[1].parameters.formants[0]}),
 'Front against back':({plan:p})=>({'2,290':p.tokens[0].parameters.formants[1],'870':p.tokens[1].parameters.formants[1]}),
 'Formants in the spectrum':({plan:p})=>({'270':p.tokens[0].parameters.formants[0],'2,290':p.tokens[0].parameters.formants[1],'300':p.tokens[1].parameters.formants[0],'870':p.tokens[1].parameters.formants[1]}),
 'A child’s vowels':({plan:p})=>({'1,030':p.tokens[0].parameters.formants[0],'256':p.tokens[0].parameters.f0,'730':P.TABLE_II.f1[0][4],'124':P.TABLE_II.f0[0][4]}),
 '[ɝ] as in heard':({plan:p})=>({'1,690':p.tokens[0].parameters.formants[2],'1,350':p.tokens[0].parameters.formants[1],'2,240':Math.min(...P.TABLE_II.f3[0].slice(0,9))}),
 'Many speakers, one vowel':()=>({'1,210':P.vowelReferenceStats(0).ownGroup,'1,520':P.MEASUREMENTS.length,'69':P.vowelReferenceStats(0).children,'300':P.MEASUREMENTS.filter(r=>r.group===2).length}),
 'Close vowels':({plan:p})=>({'730':p.tokens[0].parameters.formants[0],'1,090':p.tokens[0].parameters.formants[1],'570':p.tokens[1].parameters.formants[0],'840':p.tokens[1].parameters.formants[1],'1,013':TABLE_I[4][5],'10,273':TABLE_I[4].reduce((a,b)=>a+b,0)}),
 'Same vowel, another pitch':({plan:p})=>({'124.0':p.tokens[0].parameters.f0,'175.4':p.tokens[1].parameters.f0,'730':p.tokens[1].parameters.formants[0],'1,090':p.tokens[1].parameters.formants[1],'2,440':p.tokens[1].parameters.formants[2]}),
 'A vowel becomes a hiss':({plan:p})=>({'6':p.tokens[1].parameters.center/1000}),
 'Sip against ship':({plan:p})=>({'6,000':p.tokens[0].parameters.center,'3,500':p.tokens[1].parameters.center,'6,001':p.bands[0].centroid,'3,471':p.bands[1].centroid}),
 'Sip against zip':({plan:p})=>({'1':1000/1000,'0':p.bands[0].low*100,'32':p.bands[1].low*100}),
 'Lose the highest frequencies':({plan:p})=>({'4':p.rate/2000}),
 'A square frame edge':({plan:p})=>({'13.3':-p.leakage.sidelobe,'42.7':-P.phonemePlan().leakage.sidelobe}),
 'A Hann taper':({plan:p})=>({'25':p.frame.length/p.rate*1000,'31.5':-p.leakage.sidelobe}),
 'No airflow, no acoustic pattern':()=>({}),
},run,t,m);
assert.deepEqual(m.controls.map(c=>c.key),Object.keys(D));t.add();
for(const trial of lesson.tryIt){
 assert.deepEqual(trial.initialState,{settings:trial.values,time:0});assert.deepEqual(Object.keys(trial.values),Object.keys(D));t.add(2);
 t.ok(trial.reset&&trial.isolate&&m.parts.some(p=>p.id===trial.part),'Each experiment prepares its own view and values');
 m.reset({settings:{first:12,second:11,airflow:0,pitch:-6},time:1.95});m.reset(trial.initialState);assert.deepEqual(m.getState().values,trial.values);t.add();
 for(const time of [0,.15,.55,.95,1.15,1.55,1.95,2.1]){
  m.reset({...trial.initialState,time});const s=m.getState(),p=m.scientificPlan(),index=s.active>=0?s.active:s.complete?1:0,q=p.tokens[index].parameters;
  t.ok(g.noiseFilter.visible===(q.kind==='fricative'),'Filter display follows active source');t.ok(g.voicingRoute.visible===!!q.voiced,'Additional voice takes a separate visible path');
  t.ok(g.resonators.every(r=>r.group.visible===(q.kind==='vowel')),'Whole vowel resonators hide during frication');
  t.ok(g.cone.position.z-.01>.225,'Moving sound cone stays in front of its housing');
  for(const gram of [g.overviewGram,g.detailGram]){
   t.near(gram.mesh.geometry.drawRange.count,s.framesArrived*129*6,0,'Only arrived spectrogram columns exist');
   if(s.framesArrived){const a=gram.mesh.geometry.attributes.position,i=(s.framesArrived-1)*129*4,f=p.frames[s.framesArrived-1];t.near(a.getX(i),gram.x+gram.w*((f.start+p.frame.length/2)/p.rate-.005)/p.duration,4e-7,'Spectrogram uses frame center time');t.near(a.getY(i),gram.y,3e-7,'Zero frequency axis');t.near(a.getY(i+128*4+2),gram.y+gram.h,3e-7,'8 kHz axis');}
  }
  const f=s.frame,db=P.phonemeSpectrum(f,p),line=g.spectrumLine.geometry.attributes.position;
  t.near(g.spectrumLine.geometry.drawRange.count,db.length,0,'Spectrum has only actual bins');
  db.forEach((v,k)=>{t.near(line.getX(k),-2.65+5.3*k*p.rate/p.frame.nfft/8000,3e-7,'Spectrum frequency coordinates');t.near(line.getY(k),-1.23+(Math.min(0,v)+80)/80*1.35,3e-7,'Spectrum amplitude coordinates');});
  t.ok(s.finished.every((done,i)=>g.comparisons[i].geometry.drawRange.count===(done?db.length:0)),'Comparison spectrum waits until sound finishes');
  if(s.active<0||!s.values.airflow)t.ok(g.sourceTrace.geometry.drawRange.count===0,'Source trace waits for actual emission');
  else t.ok(g.sourceTrace.geometry.drawRange.count<=Math.min(120,s.arrived-Math.round(p.starts[s.active]*p.rate)),'Source waveform contains no future samples');
  g.selected.forEach((o,i)=>{const f=p.tokens[i].parameters.formants;t.ok(o.visible===(f.length>0),'Only vowels appear in vowel chart');if(f.length){const [x,y]=g.point(f[0],f[1]);t.near(o.position.x,x,1e-12,'Vowel marker follows F2');t.near(o.position.y,y,1e-12,'Vowel marker follows F1');}});
  t.ok(s.readings.every(r=>!/(undefined|NaN|Infinity)/.test(r.value+' '+r.hint)),'Finite explained readings');
  const before=structuredClone(s);for(const action of m.actions.filter(a=>a.label.startsWith('Inspect:'))){action.run();assert.deepEqual(m.getState(),before);t.add();}
  checkFinite(m.root,t);
 }
 outcomes.push({title:trial.title,values:m.getState().values,result:m.getState().comparison,bands:m.getState().bandResults});
 m.reset(trial.initialState);m.advance(3);m.reset(m.replayState());assert.deepEqual(m.getState().values,{...trial.values,sound:0});t.near(m.getState().time,0,0,'Replay starts own prepared experiment');
}
for(const control of m.controls)for(const value of control.options.map(o=>o.value)){
 m.reset();m.advance(.55);m.update({[control.key]:value});const s=m.getState();t.near(s.values[control.key],value,0,'Each exposed control applies');t.near(s.time,['sound','references'].includes(control.key)||value===D[control.key]?.55:0,1e-12,'Only physical changes reset');m.playback.step();checkFinite(m.root,t);controlCases.push({key:control.key,value});
}
m.reset();m.playback.step();t.near(m.getState().time,.025,0,'Step advances 25 ms');m.actions.at(-1).run();t.ok(m.playback.complete(),'Finish completes from short step');
for(const rate of [8,16]){m.reset({settings:{rate}});m.actions.at(-1).run();t.near(m.getState().time,2.1,0,'Finish reaches exact endpoint');m.reset(m.replayState());t.near(m.getState().time,0,0,'Finish from zero replays');t.near(m.getState().values.rate,rate,0,'Rate survives prepared replay');}
for(const part of m.parts)t.ok(!new THREE.Box3().setFromObject(part.object).isEmpty(),part.id+' has geometry');
t.ok(lesson.parts.every(p=>m.parts.some(x=>x.name===p.name)),'Lesson parts map to actual model');
assert.equal(houseComponents.Phonemes.createModel,createPhonemesModel);assert.equal(houseComponents.Phonemes.lesson,lesson);t.add(2);
const resources=checkDisposal(m,t);

const originalAudio=globalThis.AudioContext,contexts=[];
class AudioMock{
 constructor(){this.state='running';this.currentTime=10;this.destination={};this.sources=[];contexts.push(this);}
 resume(){return Promise.resolve();}close(){this.state='closed';return Promise.resolve();}
 createBuffer(channels,length,rate){return {channels,length,sampleRate:rate,copyToChannel(values){this.samples=values;}};}
 createBufferSource(){const s={connect(){},disconnect(){this.disconnected=true;},start(...args){this.started=args;},stop(){this.stopped=true;}};this.sources.push(s);return s;}
}
try{
 globalThis.AudioContext=AudioMock;const audio=createPhonemesModel();audio.update({sound:1});audio.playback.setPlaying(true);await Promise.resolve();const context=contexts.at(-1),first=context.sources.at(-1);
 assert.deepEqual(first.started,[0,0]);assert.deepEqual(first.buffer.samples,Float32Array.from(audio.scientificPlan().samples));t.add(2);
 context.currentTime+=.55;audio.playback.advance(.9);t.near(audio.getState().time,.55,1e-12,'Sound playback follows the audio clock when wall and audio time differ');
 audio.playback.advance(.3);t.near(audio.getState().time,.55,1e-12,'A stalled audio clock cannot cut off a sound early');
 audio.playback.setPlaying(false);t.ok(first.stopped&&first.disconnected,'Pause stops sound');audio.playback.setPlaying(true);const resumed=context.sources.at(-1);t.near(resumed.started[1],.55,1e-12,'Resume preserves offset');
 audio.update({references:2});assert.equal(context.sources.at(-1),resumed);t.add();
 audio.update({sound:0});t.ok(resumed.stopped,'Sound off stops playback');audio.update({sound:1});audio.playback.setPlaying(true);await Promise.resolve();audio.update({second:11});t.ok(context.sources.at(-1).stopped,'New sound stops old audio');
 audio.playback.setPlaying(true);audio.advance(3);t.ok(context.sources.at(-1).stopped,'Completion stops audio');audio.reset();audio.update({sound:1});audio.playback.setPlaying(true);await Promise.resolve();audio.dispose();t.ok(context.sources.at(-1).stopped&&context.state==='closed','Dispose releases audio context');
}finally{globalThis.AudioContext=originalAudio;}
const report={passed:true,checks:t.count,parts:m.parts.map(p=>p.id),outcomes,controlCases,resources,audioLifecycle:true};
if(process.env.EVIDENCE_DIR){await mkdir(process.env.EVIDENCE_DIR,{recursive:true});await writeFile(process.env.EVIDENCE_DIR+'/model.json',JSON.stringify(report,null,2));}
console.log(`PASS phonemes model: ${t.count} checks; ${outcomes.length} trials; ${controlCases.length} control values; ${resources} resources`);

import assert from 'node:assert/strict';
import * as THREE from 'three';
import {mkdir,writeFile} from 'node:fs/promises';
import {createCdModel} from './cd-model.js';
import {reviewedCdLesson as lesson} from './cd-lesson.js';
import {CD_DEFAULTS,CD_DOMAINS,CD_TIMING} from './cd-physics.js';
import {houseComponents} from './house-components.js';
import {tally,checkFinite,checkDisposal} from './model-check-kit.mjs';

const t=tally(),model=createCdModel(),g=model.topology,d=g.details,outcomes=[],controls=[];
assert.deepEqual(model.controls.map(c=>c.key),Object.keys(CD_DEFAULTS));t.add();
for(const trial of lesson.tryIt){
  assert.deepEqual(trial.initialState,{settings:trial.values,time:0});assert.deepEqual(Object.keys(trial.values),Object.keys(CD_DEFAULTS));t.add(2);
  t.ok(trial.reset&&trial.isolate&&model.parts.some(p=>p.id===trial.part),'Prepared trial has its own state and valid inspection');
  model.reset({settings:{content:2,loss:3,laser:0,phase:3,radius:58},time:6.5});model.reset(trial.initialState);assert.deepEqual(model.getState().values,trial.values);t.add();
  for(const time of [0,1,3.625,4.8,5.5,6.15,6.65]){
    model.reset({...trial.initialState,time});const s=model.getState(),p=model.scientificPlan();
    t.near(g.pickup.position.x,s.spiral.radiusMm*.01,1e-12,'Supported pickup follows numerical read radius');
    t.near(g.screw.rotation.x,(s.spiral.radiusMm-25)/2*2*Math.PI,1e-12,'Screw and nut share actual radial travel');
    t.near(g.clampMark.position.x,-.035*Math.sin(s.spiral.angle),1e-12,'Disc turns clockwise from label side, counterclockwise from pickup side');
    t.ok(g.outgoing.visible===(!!s.values.laser&&s.time<6),'Outgoing light requires laser and active read stage');
    t.ok(g.returning.visible===g.outgoing.visible,'Return ray follows same active optical path');
    t.near(g.outgoing.geometry.attributes.position.getY(3),.132,1e-8,'Focus reaches reflective surface above 1.2 mm substrate');
    t.ok(s.readings.every(r=>!/(NaN|undefined|Infinity)/.test(r.value+' '+r.hint)),'Finite learner readings');
    t.near(d.spot.scale.x,p.optics.spotDiameterNm/p.optics.cellNm*(5.4/64)/2,1e-12,'Spot and cell use same spatial scale');
    const last=d.outgoing.geometry.drawRange.count;
    if(last)t.near(d.outgoing.geometry.attributes.position.getY(last-1),1.637,1e-7,'Enlarged optical path reaches reflective layer');
    for(let ch=0;ch<2;ch++){
      t.near(g.speakers[ch].driver.position.z,.306+.014*s.output[ch],1e-12,'Speaker follows actual recovered channel value');
      t.near(d.closeup[ch].geometry.drawRange.count,s.values.laser?Math.min(128,Math.max(0,s.samplePairs-441)):0,0,'Close-up has no future samples');
      const pos=d.closeup[ch].geometry.attributes.position;
      for(let i=0;i<d.closeup[ch].geometry.drawRange.count;i++)t.near(pos.getY(i),-1.265+.30*p.read.recovered.pcm[ch][441+i]/32768,8e-8,'Waveform coordinates contain recovered PCM');
      if(s.samplePairs===0)t.ok(d.waveRows[ch].signal.geometry.drawRange.count===0&&d.waveRows[ch].missing.geometry.drawRange.count===0,'Future waveform and loss flags stay blank');
    }
    if(s.readComplete){
      t.ok(d.correctedLabel.userData.labelText.includes(s.values.loss===3?'unresolved':'checked and complete'),'Error-correction display distinguishes repair from failure');
      t.ok(d.waveRows.every(row=>s.values.loss===3?row.missing.geometry.drawRange.count>0:row.missing.geometry.drawRange.count===0),'Visible loss bands match unresolved PCM');
    }
    const before=structuredClone(s);
    for(const action of model.actions){t.ok(action.replay===false,'Inspection is nonmutating');action.run();assert.deepEqual(model.getState(),before);t.add();}
    checkFinite(model.root,t);
  }
  outcomes.push({title:trial.title,values:model.getState().values,result:model.getState().status,stats:model.getState().stats});
  model.reset(trial.initialState);model.advance(10);model.reset(model.replayState());t.near(model.getState().time,0,0,'Replay starts prepared trial');assert.deepEqual(model.getState().values,{...trial.values,sound:0});t.add();
}
for(const control of model.controls){
  const [lo,hi,step]=CD_DOMAINS[control.key];
  for(let value=lo;value<=hi;value+=step){
    model.reset();model.advance(3);model.update({[control.key]:value});const s=model.getState();
    t.near(s.values[control.key],value,0,'Each exposed value applies');t.near(s.time,['sound','phase'].includes(control.key)||value===CD_DEFAULTS[control.key]?3:0,1e-12,'Only read settings restart experiment');
    model.playback.step();checkFinite(model.root,t);controls.push({key:control.key,value});
  }
}
model.reset();model.playback.step();t.near(model.getState().receivedCells,1,0,'First-stage step advances one channel cell');model.advance(4);const before=model.getState().time;model.playback.step();t.near(model.getState().time,before+.025,1e-12,'Later step advances 25 ms');
for(const part of model.parts)t.ok(!new THREE.Box3().setFromObject(part.object).isEmpty(),part.id+' has real geometry');
t.ok(lesson.parts.every(p=>model.parts.some(x=>x.name===p.name)),'Every lesson part names a model part');
assert.equal(houseComponents.CD.createModel,createCdModel);assert.equal(houseComponents.CD.lesson,lesson);t.add(2);
const resources=checkDisposal(model,t);

const originalAudio=globalThis.AudioContext,contexts=[];
class AudioMock{
  constructor(){this.state='running';this.currentTime=10;this.destination={};this.sources=[];contexts.push(this);}
  resume(){return Promise.resolve();}close(){this.state='closed';return Promise.resolve();}
  createBuffer(channels,length,rate){return {channels,length,sampleRate:rate,samples:[],copyToChannel(values,ch){this.samples[ch]=values.slice();}};}
  createBufferSource(){const source={connect(){},disconnect(){this.disconnected=true;},start(...args){this.started=args;},stop(){this.stopped=true;}};this.sources.push(source);return source;}
}
try{
  globalThis.AudioContext=AudioMock;const audio=createCdModel();audio.update({sound:1});audio.playback.setPlaying(true);await Promise.resolve();const context=contexts.at(-1);
  t.ok(context.sources.length===0,'No audio before recovery');audio.playback.advance(7);t.near(audio.getState().time,6,0,'Large frame step cannot skip start of decoded sound');
  const source=context.sources.at(-1);assert.deepEqual(source.started,[0,0]);assert.deepEqual(source.buffer.samples,audio.scientificPlan().read.audio);t.add(2);
  t.ok(source.buffer.channels===2&&source.buffer.sampleRate===44100&&source.buffer.length===17640,'DAC receives stereo PCM at original sample rate');
  context.currentTime+=.1;audio.playback.advance(1);t.near(audio.getState().time,6.1,1e-12,'Sound follows audio clock');
  audio.playback.advance(1);t.near(audio.getState().time,6.1,1e-12,'Stalled audio clock cannot cut sound short');
  audio.playback.setPlaying(false);t.ok(source.stopped&&source.disconnected,'Pause stops sound');audio.playback.setPlaying(true);const resumed=context.sources.at(-1);t.near(resumed.started[1],.1,1e-12,'Resume starts at current decoded audio offset');
  audio.update({phase:2});assert.equal(context.sources.at(-1),resumed);t.add();audio.update({sound:0});t.ok(resumed.stopped,'Sound off stops source');
  audio.update({sound:1});audio.playback.setPlaying(true);await Promise.resolve();audio.update({content:2});t.ok(context.sources.at(-1).stopped,'Changing recorded sound stops previous output');
  audio.playback.setPlaying(true);audio.playback.advance(6);context.currentTime+=.5;audio.playback.advance(1);t.ok(context.sources.at(-1).stopped,'End of sound stops source');audio.playback.advance(1);t.ok(audio.getState().complete,'Result tail reaches completion');
  audio.reset({settings:{laser:0,sound:1}});audio.playback.setPlaying(true);const sourceCount=context.sources.length;audio.playback.advance(8);audio.playback.advance(1);t.ok(context.sources.length===sourceCount,'Laser-off experiment never starts audio');
  audio.reset({settings:{sound:1}});audio.playback.setPlaying(true);audio.playback.advance(6);audio.dispose();t.ok(context.sources.at(-1).stopped&&context.state==='closed','Dispose stops sound and closes context');
}finally{globalThis.AudioContext=originalAudio;}
const report={passed:true,checks:t.count,outcomes,controls,resources,audioLifecycle:true};
if(process.env.EVIDENCE_DIR){await mkdir(process.env.EVIDENCE_DIR,{recursive:true});await writeFile(process.env.EVIDENCE_DIR+'/model.json',JSON.stringify(report,null,2));}
console.log(`CD model: ${t.count} checks; ${outcomes.length} prepared experiments; ${controls.length} exposed control values; exact stereo audio lifecycle; ${resources} resources disposed.`);

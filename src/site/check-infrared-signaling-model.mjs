import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import * as THREE from 'three';
import {createInfraredSignalingModel} from './infrared-signaling-model.js';
import {createSignalingController,inspectSignalBit,signalTrialTime,SIGNAL_DEFAULTS as D} from './infrared-signaling-physics.js';
import {remoteControlPlan,TV_INITIAL,IR_TIMING} from './remote-control-physics.js';
import {infraredSignalingLesson as lesson} from './infrared-signaling-lesson.js';
import {houseComponents} from './house-components.js';
import {tally,checkFinite,checkDisposal} from './model-check-kit.mjs';

const t=tally(),near=(a,b,why,tolerance=1e-8)=>t.near(a,b,tolerance,why);
for(const bit of [-1,32,.5,NaN]){assert.throws(()=>signalTrialTime({},bit),RangeError);t.add();}
let bits=0;
for(let command=0;command<256;command++)for(const fault of [0,1]){
  const address=255-command,p=remoteControlPlan({address,command,fault}),bytes=[address,255-address,command,(255-command)^fault];
  let expectedTime=.0135;
  for(let index=0;index<32;index++){
    const b=inspectSignalBit(p,index),k=index%8,byte=bytes[Math.floor(index/8)],value=Math.floor(byte/2**k)%2,delta=value?.00225:.001125;
    assert.equal(b.byte,byte);assert.equal(b.value,value);assert.equal(b.weight,2**k);t.add(3);
    near(b.start,expectedTime,'Bit begins after the preceding intervals');near(b.next,expectedTime+delta,'Next mark closes the data interval');near(b.gap,delta-.0005625,'Equal mark leaves the correct quiet gap');
    assert.equal(b.closing,index===31);assert.equal(b.byteBits.reduce((sum,v,i)=>sum+v*2**i,0),byte);t.add(2);
    const before=inspectSignalBit(p,index,b.readAt-1e-9),after=inspectSignalBit(p,index,b.readAt+1e-9);
    t.ok(!before.decoded&&after.decoded,'Selected bit is not available until the next received falling edge');
    expectedTime+=delta;bits++;
  }
  near(expectedTime+.0005625,p.frameEnd,'Closing mark included exactly once');
}
const c=createSignalingController();c.advance(4.8);const before=c.getState();
for(let bit=0;bit<32;bit++){
  c.update({bit});const s=c.getState();near(s.clock,before.clock,'Bit inspection preserves playback time');assert.deepEqual(s.tv,before.tv);assert.equal(s.decodedCount,before.decodedCount);t.add(2);
}
for(const values of [{bit:-1},{bit:32},{bit:.5},{command:256},{address:NaN},{carrier:39},{battery:2.05},{fault:2},{emitter:1},{bit:4,command:Infinity}]){
  const before=c.getState();assert.throws(()=>c.update(values));assert.deepEqual(c.getState(),before);assert.throws(()=>c.reset({settings:values}));assert.deepEqual(c.getState(),before);t.add(4);
}
for(const initial of [null,[],{time:-1},{time:100},{settings:{bit:5},time:Infinity},{settings:{bit:5},extra:0}]){const before=c.getState();assert.throws(()=>c.reset(initial));assert.deepEqual(c.getState(),before);t.add(2);}
for(const values of [{blocked:1},{distance:30},{battery:1.6,distance:20},{carrier:56}]){
  c.reset({settings:values});c.advance(100);t.ok(c.getState().complete&&!c.getState().inspected.decoded&&c.getState().decodedCount===0,'Missing optical output cannot decode selected bit');assert.deepEqual(c.getState().tv,TV_INITIAL);t.add();
}
c.reset({settings:{bit:31}});let p=c.getPlan();c.advance(IR_TIMING.press+(p.marks[33][0]+IR_TIMING.delay+1e-8)*IR_TIMING.slow);
t.ok(c.getState().inspected.decoded&&c.getState().decodedCount===32&&!c.getState().validated,'Last falling edge reads the last bit before closing mark ends');assert.deepEqual(c.getState().tv,TV_INITIAL);t.add();c.advance(1);t.ok(c.getState().accepted,'Complete closing mark permits validation');
const partitions=[.017,.06,.37,1,30].map(step=>{const model=createSignalingController({settings:{command:18,bit:24}});for(let time=0;time<12;time+=step)model.advance(Math.min(step,12-time));return model.getState();});for(const s of partitions)assert.deepEqual(s,partitions[0]);t.add(partitions.length);

const m=createInfraredSignalingModel(),g=m.topology,outcomes=[];
assert.deepEqual(m.controls.map(c=>c.key),Object.keys(D));t.add();
const points=line=>{const a=line.geometry.attributes.position;return Array.from({length:Math.min(a.count,line.geometry.drawRange.count)},(_,i)=>[a.getX(i),a.getY(i),a.getZ(i)]);};
for(const trial of lesson.tryIt){
  assert.deepEqual(trial.values,trial.initialState.settings);assert.deepEqual(Object.keys(trial.values),Object.keys(D));t.add(2);
  t.ok(trial.reset&&trial.isolate&&m.parts.some(p=>p.id===trial.part),'Every trial owns full initial state and an actual inspection');
  m.reset({settings:{command:255,bit:31,distance:30,battery:1.6,blocked:1,fault:1,carrier:56}});m.advance(100);m.reset(trial.initialState);
  const plan=m.physicalPlan(),times=[trial.initialState.time,Math.max(trial.initialState.time,.9),Math.max(trial.initialState.time,5),plan.run];
  for(const time of times){
    m.reset({...trial.initialState,time});const s=m.getState();m.root.updateMatrixWorld(true);
    assert.deepEqual(s.values,trial.values);near(s.time,time,'Trial time is not inherited');
    const b=s.inspected;assert.equal(g.bit.heading.userData.labelText,`${b.byteName} ${b.byte} · bit ${b.bitIndex} = ${b.value}`);assert.equal(g.bit.cells.map(c=>c.text.userData.labelText).join(''),b.byteBits.join(''));t.add(2);
    t.ok(g.bit.cells.filter(c=>c.block.material.color.getHex()===0xe3b45e).length===1,'One selected bit gets a unique visual highlight');
    const tx=points(g.bit.transmitted),rx=points(g.bit.receiver);near(tx[2][0]-tx[0][0],0,'Selected mark starts at diagram time zero',1e-6);near(tx[3][0]-tx[2][0],4.5*.0005625/.0032,'Mark width drawn to time scale',1e-6);
    if(b.received)near(rx[2][0]-tx[2][0],4.5*(10/38000)/.0032,'Receiver trace has the stated delay',1e-6);
    else t.ok(rx.length===2&&rx.every(p=>Math.abs(p[1]-.05)<1e-6),'Rejected light/carrier leaves receiver output high');
    t.ok(points(g.bit.carrier).length===4*b.pulses,'Carrier graph draws every on-pulse');
    near(tx.at(-1)[0],-2.25+4.5*b.windowEnd/.0032,'Trace ends after next received mark, before unpictured bits',1e-6);
    t.ok(g.bit.cursor.visible===(s.started&&b.relativeTime>=0&&b.relativeTime<=b.windowEnd),'Cursor appears only inside the selected interval');
    assert.deepEqual(g.pictures.map(x=>x.visible),[1,2,3,4].map(channel=>s.tv.on&&s.tv.channel===channel));t.add();
    const snapshot=structuredClone(s);for(const action of m.actions){action.run();assert.deepEqual(m.getState(),snapshot);t.add();}
    checkFinite(m.root,t);
  }
  const s=m.getState();outcomes.push({title:trial.title,time:s.time,values:s.values,decoded:s.decodedCount,accepted:s.accepted,tv:s.tv,phase:s.phase});
}
const outcome=name=>outcomes.find(x=>x.title===name);
assert.deepEqual(outcome('Watch a frame').tv,{...TV_INITIAL,channel:3});assert.deepEqual(outcome('A command that raises volume').tv,{...TV_INITIAL,volume:5});assert.deepEqual(outcome('Zero is a whole byte too').tv,{...TV_INITIAL,on:false});t.add(3);
for(const name of ['A different command','Eight ones in a byte','A different device address','One damaged inverse bit']){assert.deepEqual(outcome(name).tv,TV_INITIAL);assert.equal(outcome(name).decoded,32);assert.equal(outcome(name).accepted,false);t.add(3);}
for(const name of ['The wrong carrier','Out of range','Blocked','Tired cells farther away']){assert.deepEqual(outcome(name).tv,TV_INITIAL);assert.equal(outcome(name).decoded,0);t.add(2);}
t.ok(outcome('Tired cells').accepted,'Weak cells nearby still deliver the command');
for(let index=0;index<32;index++){
  m.reset();m.advance(4.8);m.update({bit:index});const s=m.getState(),b=s.inspected,outline=points(g.bit.selected),cx=-2.20+(index%16)*.292,cy=.03-(index>=16?.39:0);
  near(outline[0][0],cx-.145,'Full frame outline follows selected bit',1e-6);near(outline[0][1],cy-.15,'Outline stays on correct byte row',1e-6);near(s.time,4.8,'Model inspection preserves clock');
  t.ok(g.bit.selected.parent===g.signal,'Outline belongs to the isolated frame view');
  m.reset({settings:{bit:index},time:IR_TIMING.press+(b.start+.0002)*IR_TIMING.slow});t.ok(m.getState().inspected.relativeTime>0,'Every selected bit can be visited during its mark');
}
for(const control of m.controls)for(const value of control.options?.map(o=>o.value)??[control.min,control.max]){
  m.reset();m.advance(1);m.update({[control.key]:value});const s=m.getState();near(s.values[control.key],value,'Control accepts offered value');near(s.time,control.key==='bit'||value===D[control.key]?1:0,'Only inspection or unchanged values keep the clock');
}
for(const command of [1,170,255]){m.reset({settings:{command}});m.advance(.3);const pressed=g.keys.filter(k=>k.body.position.z<k.rest.z-.08);assert.deepEqual(pressed.map(k=>k.code),[255]);t.add();}
m.advance(100);const replay=m.replayState();m.reset(replay);t.ok(!m.getState().complete&&m.getState().values.command===255,'Replay starts the selected message again');m.playback.step();near(m.getState().time,.05,'Step exposes part of a bit');
for(const delta of [-1,NaN,Infinity]){const before=m.getState();m.advance(delta);assert.deepEqual(m.getState(),before);t.add();}
for(const part of m.parts){const bounds=new THREE.Box3().setFromObject(part.object);t.ok(!bounds.isEmpty(),`${part.id}: actual inspectable geometry`);}
t.ok(m.parts.length===26&&m.catalogParts.length===22,'Focused route exposes twenty-six parts and twenty-two bookmarks');
assert.equal(houseComponents['Infrared signaling'].createModel,createInfraredSignalingModel);assert.equal(houseComponents['Infrared signaling'].lesson,lesson);t.add(2);
const resources=checkDisposal(m,t),report={passed:true,checks:t.count,bits,trials:outcomes,resources};
if(process.env.EVIDENCE_DIR){await mkdir(process.env.EVIDENCE_DIR,{recursive:true});await writeFile(process.env.EVIDENCE_DIR+'/model.json',JSON.stringify(report,null,2));}
console.log(`PASS infrared signaling: ${t.count} checks; ${bits} bit intervals; ${outcomes.length} full-state trials; ${resources} resources`);

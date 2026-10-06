import assert from 'node:assert/strict';
import {writeFile,mkdir} from 'node:fs/promises';
import * as P from './remote-control-physics.js';
import {LEDS,VT} from './remote-physics.js';

let checks=0,frames=0,states=0;
const ok=(condition,message)=>{checks++;assert.ok(condition,message);};
const near=(actual,expected,tolerance,message)=>ok(Math.abs(actual-expected)<=tolerance,`${message}: ${actual} versus ${expected}`);
const initial=()=>({on:true,channel:2,volume:4,muted:false});
const serialByte=number=>Array.from({length:8},(_,i)=>Math.floor(number/2**i)%2).join('');
const shifted=marks=>marks.map(([start,end])=>[start+10/38000,end+10/38000]);

assert.deepEqual(P.encodeRemoteFrame(0,173).bits.join(''),'00000000111111111011010101001010');checks++;
assert.deepEqual(P.chronologicalByte(26).join(''),'01011000');checks++;
for(let address=0;address<256;address++)for(let command=0;command<256;command++){
  const frame=P.encodeRemoteFrame(address,command),decoded=P.decodeRemoteFrame(shifted(frame.marks));
  const expected=serialByte(address)+serialByte(255-address)+serialByte(command)+serialByte(255-command);
  ok(frame.bits.join('')===expected,'Each byte leaves least-significant bit first');
  ok(decoded.valid&&decoded.address===address&&decoded.command===command,'Receiver recovers the numeric bytes from edges alone');
  near(frame.frameEnd,.0680625,2e-15,'Normal frame duration');
  near(frame.marks[1][0],.0135,1e-15,'Leader start distance');
  ok(frame.bits.reduce((a,b)=>a+b,0)===16,'Complement bytes have sixteen ones');frames++;
}
const original=shifted(P.encodeRemoteFrame(55,26).marks);
const malformed=[];
for(let count=0;count<34;count++)malformed.push(original.slice(0,count));
malformed.push([...original,original.at(-1)]);
for(const item of [new Array(2),[undefined,1],[0,undefined],null,{},'01']){const copy=structuredClone(original);copy[0]=item;malformed.push(copy);}
for(let index=0;index<34;index++){
  for(const width of [-.0001,0,.000001,.03]){const copy=structuredClone(original);copy[index][1]=copy[index][0]+width;malformed.push(copy);}
  for(const bad of [NaN,Infinity,-Infinity]){const copy=structuredClone(original);copy[index][0]=bad;malformed.push(copy);}
}
for(let index=1;index<34;index++){
  const copy=structuredClone(original);copy[index][0]=copy[index-1][1]-.00001;malformed.push(copy);
  const gap=structuredClone(original);for(let i=index;i<gap.length;i++){gap[i][0]+=.004;gap[i][1]+=.004;}malformed.push(gap);
}
for(const frame of malformed)ok(!P.decodeRemoteFrame(frame).valid,'Malformed edges cannot pass decoding');
const corrupt=P.encodeRemoteFrame(55,26,true);
ok(!P.decodeRemoteFrame(shifted(corrupt.marks)).valid,'An altered inverse bit is rejected');
for(const offset of [.001,.075,2])ok(P.decodeRemoteFrame(original.map(([a,b])=>[a+offset,b+offset])).valid,'Decode depends on relative edge times');
for(let index=1;index<34;index++){
  const allowed=structuredClone(original);allowed[index][1]+=.0001;
  ok(P.decodeRemoteFrame(allowed).valid,'Assigned width tolerance accepts a bounded demodulator stretch');
}
const wrongLeader=structuredClone(original);wrongLeader[0][0]=wrongLeader[1][0]-.0001;wrongLeader[0][1]=wrongLeader[0][0]+.00001;
ok(!P.decodeRemoteFrame(wrongLeader).valid,'Draft red probe: no leader is rejected');
ok(!P.decodeRemoteFrame(original.map(([start])=>[start,start+.000001])).valid,'Draft red probe: one-microsecond marks are rejected');

for(let k=0;k<18;k++)for(const color of [1,2])for(const on of [false,true]){
  const voltage=Number((1.6+k*.1).toFixed(1)),circuit=P.remoteCircuit(voltage,color,on);
  near(circuit.rail+.45*circuit.current,voltage,2e-13,'Common cell rail KVL');
  near(circuit.current,circuit.infrared.current+circuit.indicator.current,1e-15,'Both branch currents return through the cells');
  for(const branch of [circuit.indicator,...(on?[circuit.infrared]:[])]){
    const fit=LEDS[branch.index],junction=2*VT*Math.log1p(branch.current/fit.IS);
    near(junction+branch.current*(fit.RS+fit.resistor),circuit.rail,3e-12,'Independent log-form diode branch KVL');
    near(branch.voltage+branch.current*fit.resistor,circuit.rail,3e-12,'Resistor and LED share the loaded rail');
  }
  near(circuit.suppliedPower,circuit.ledPower+circuit.resistorPower+circuit.cellPower,2e-13,'Circuit energy balance');
  if(on)ok(circuit.indicator.current<P.remoteCircuit(voltage,color,false).indicator.current,'Emitter load reduces the indicator rail');
}
function explicitCarrierIntegral(marks,time,frequency){
  let sum=0;
  for(const [start,end] of marks)for(let pulse=0;start+pulse/frequency<Math.min(end,time);pulse++){
    const beginning=start+pulse/frequency;
    sum+=Math.max(0,Math.min(time,end,beginning+1/(3*frequency))-beginning);
  }
  return sum;
}
for(const f of [38000,56000]){
  const frame=P.encodeRemoteFrame(55,26);
  for(const time of [0,.000001,.002,.009,.0135,.01351,.0140625,.014625,.04,frame.frameEnd,frame.frameEnd+1])near(P.frameCarrierTime(frame.marks,time,f),explicitCarrierIntegral(frame.marks,time,f),3e-15,'Carrier integration by explicit pulse intersections');
}
near(P.gatedCarrierTime(.0005625,38000),22/(3*38000),1e-17,'Twenty-two pulses fit a 562.5 microsecond envelope');

const keys=Object.keys(P.REMOTE_CONTROL_DOMAINS);
for(let bits=0;bits<2**keys.length;bits++){
  const settings=Object.fromEntries(keys.map((key,i)=>[key,P.REMOTE_CONTROL_DOMAINS[key][(bits>>i)&1]]));
  const plan=P.remoteControlPlan(settings);
  const times=[0,.3,.6+.0045*150,plan.run*.7,plan.run];
  near(plan.energy,plan.ledEnergy+plan.resistorEnergy+plan.cellEnergy,2e-14,'Complete transmission energy balance');
  near(plan.irradiance,settings.blocked?0:plan.intensity/settings.distance**2,1e-14,'Aligned inverse-square irradiance');
  near(plan.light,plan.irradiance*.005e-6,1e-20,'BPW34-like diagnostic current from 50 microamps at 10 W per square meter');
  for(const time of times){
    const state=P.remoteControlAt(plan,time);
    ok(Object.values(state).filter(x=>typeof x==='number').every(Number.isFinite),'Every scalar state stays finite');
    near(state.energy,state.ledEnergy+state.resistorEnergy+state.cellEnergy,2e-14,'Partial transmission energy balance');
    near(state.onTime,explicitCarrierIntegral(plan.marks,state.started?Math.min(state.time,plan.frameEnd):0,plan.frequency),4e-15,'Partial carrier clock integral');
    ok(state.decodedCount>=0&&state.decodedCount<=32,'Partial byte count stays bounded');
    if(!state.validated)assert.deepEqual(state.tv,initial());checks++;states++;
  }
  const before=P.remoteControlAt(plan,plan.run-1e-7);assert.deepEqual(before.tv,initial());checks++;
  const end=P.remoteControlAt(plan,plan.run);ok(end.complete,'Each corner completes');
  if(settings.blocked||settings.carrier===56||settings.fault||settings.address!==55)ok(!end.accepted,'Rejected frames do not act on the TV');
}
const expected=new Map([[0,{...initial(),on:false}],[18,{...initial(),volume:5}],[19,{...initial(),volume:3}],[26,{...initial(),channel:3}],[27,{...initial(),channel:1}],[21,{...initial(),muted:true}],[255,initial()]]);
for(const [command,tv] of expected){
  const plan=P.remoteControlPlan({command}),end=P.remoteControlAt(plan,plan.run);
  assert.deepEqual(end.tv,tv);checks++;
  ok(end.accepted===(command!==255),'Only assigned TV commands cause their mapped action');
}
for(const settings of [{blocked:1},{distance:30},{battery:1.6,distance:20},{address:56},{fault:1},{carrier:56}]){
  const plan=P.remoteControlPlan(settings),end=P.remoteControlAt(plan,plan.run);
  assert.deepEqual(end.tv,initial());checks++;ok(!end.accepted,'The requested blocked experiment leaves the television unchanged');
}
const base=P.remoteControlPlan(),nearby=P.remoteControlPlan({distance:10}),weak=P.remoteControlPlan({battery:1.6});
near(base.irradiance/nearby.irradiance,4,1e-13,'Twice the distance gives one-quarter irradiance');
ok(weak.on.infrared.current<base.on.infrared.current&&weak.range<base.range,'Weak cells reduce current and model reach');
ok(P.remoteControlPlan({emitter:2}).on.infrared.current>base.on.infrared.current,'A lower-current yellow indicator changes the shared rail');
ok(P.remoteControlPlan({probe:-20}).diagnosticDiode.current<0&&base.diagnosticDiode.current>0,'The diagnostic diode reverses its small current');
ok(Object.isFrozen(base)&&Object.isFrozen(base.marks)&&Object.isFrozen(base.marks[0]),'Plans cannot be mutated by callers');

const single=P.createRemoteControlController(),partitioned=P.createRemoteControlController();single.advance(7);for(let i=0;i<140;i++)partitioned.advance(.05);
near(single.getState().clock,partitioned.getState().clock,3e-14,'Playback partition invariance');
assert.deepEqual(single.getState().decodedBits,partitioned.getState().decodedBits);checks++;
const snapshot=single.getState();single.update({});assert.deepEqual(single.getState(),snapshot);checks++;
const detached=single.getPlan();detached.marks[0][0]=999;ok(single.getPlan().marks[0][0]===0,'Inspection plan copies cannot alter playback');
single.advance(100);ok(single.getState().complete,'Playback stops on the last state');single.reset(single.replayState());ok(single.getState().clock===0&&single.getState().values.command===26,'Replay retains settings and restarts TV state');
single.advance(2);single.update({command:18});ok(single.getState().clock===0&&single.getState().values.command===18,'A new button starts a fresh transmission');
for(const bad of [{distance:0},{distance:1.5},{carrier:40},{battery:NaN},{probe:Infinity},{extra:1},null,[]]){assert.throws(()=>P.remoteControlPlan(bad));checks++;}
for(const bad of [{time:-1},{time:Infinity},{time:100},{oops:0},null,[]]){assert.throws(()=>single.reset(bad));checks++;}
for(const bad of [-1,NaN,Infinity]){assert.throws(()=>single.advance(bad));checks++;}
for(const bad of [-1,1.5,256]){assert.throws(()=>P.encodeRemoteFrame(bad,0));checks++;assert.throws(()=>P.encodeRemoteFrame(0,bad));checks++;}

const report={passed:true,checks,frames,controlCorners:2**keys.length,sampledStates:states,malformedFrames:malformed.length,commands:[...expected.keys()],limits:'Assigned circuit fits and receiver rule; no measured commercial range, AGC reconstruction, or brand command claims.'};
if(process.env.EVIDENCE_DIR){await mkdir(process.env.EVIDENCE_DIR,{recursive:true});await writeFile(process.env.EVIDENCE_DIR+'/physics.json',JSON.stringify(report,null,2)+'\n');}
console.log(`PASS remote control physics: ${checks} checks, ${frames} frames, ${states} sampled states, ${malformed.length} malformed-frame negatives.`);

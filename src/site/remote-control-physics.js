import {validateControls} from './physics-kit.js';
import {LEDS,seriesDiode,intensityAt,radiantPower,photocurrentOf,diodeAt,depletionShare,photonEv,BPW34,TSOP38438,DECLARED} from './remote-physics.js';

// One normal NEC message. Byte order and envelope timing follow Microchip
// AN2933 section 3.2. The 68.625 ms total printed on page 9 is an arithmetic
// error: the specified intervals sum to 68.0625 ms, including the final mark.
export const IR_TIMING=Object.freeze({carrier:38000,duty:1/3,leader:.009,space:.0045,mark:.0005625,zero:.001125,one:.00225,delay:10/38000,slow:150,press:.6});
export const TV_INITIAL=Object.freeze({on:true,channel:2,volume:4,muted:false});
export const TV_ADDRESS=55;
export const REMOTE_KEYS=Object.freeze([
  {value:0,label:'Power',symbol:'Power',effect:'power'},
  {value:18,label:'Volume up',symbol:'Vol +',effect:'volume-up'},
  {value:19,label:'Volume down',symbol:'Vol −',effect:'volume-down'},
  {value:26,label:'Next channel',symbol:'Ch +',effect:'channel-up'},
  {value:27,label:'Previous channel',symbol:'Ch −',effect:'channel-down'},
  {value:21,label:'Mute',symbol:'Mute',effect:'mute'},
  {value:255,label:'Unassigned code 255',symbol:'?',effect:null},
].map(Object.freeze));
export const REMOTE_CONTROL_DEFAULTS=Object.freeze({command:26,address:55,distance:5,battery:3,blocked:0,emitter:0,probe:.7,fault:0,carrier:38});
export const REMOTE_CONTROL_DOMAINS=Object.freeze(Object.fromEntries(Object.entries({command:[0,255,1],address:[0,255,1],distance:[1,30,1],battery:[1.6,3.3,.1],blocked:[0,1,1],emitter:[0,2,1],probe:[-20,.9,.01],fault:[0,1,1],carrier:[38,56,18]}).map(([key,value])=>[key,Object.freeze(value)])));
export const RECEIVER_WINDOW=Object.freeze({leader:.0006,leaderDistance:.0006,mark:.00015,bitDistance:.00025});
const CELL_RESISTANCE=2*DECLARED.cellResistance;
const freeze=value=>{if(value&&typeof value==='object'&&!Object.isFrozen(value)){Object.values(value).forEach(freeze);Object.freeze(value);}return value;};
const byte=value=>{
  if(!Number.isInteger(value)||value<0||value>255)throw new RangeError('Expected an unsigned byte');
  return value;
};
export const chronologicalByte=value=>Array.from({length:8},(_,bit)=>(byte(value)>>bit)&1);
export const commandName=value=>REMOTE_KEYS.find(key=>key.value===value)?.label??`Unassigned code ${value}`;

export function encodeRemoteFrame(address,command,corrupt=false){
  const bytes=[byte(address),address^255,byte(command),(command^255)^(corrupt?1:0)];
  const bits=bytes.flatMap(chronologicalByte),marks=[[0,IR_TIMING.leader]];
  let time=IR_TIMING.leader+IR_TIMING.space;
  for(const bit of bits){marks.push([time,time+IR_TIMING.mark]);time+=bit?IR_TIMING.one:IR_TIMING.zero;}
  marks.push([time,time+IR_TIMING.mark]);
  return {bytes,bits,marks,frameEnd:time+IR_TIMING.mark};
}

/** Decode only received low intervals, without consulting the transmitted word. */
export function decodeRemoteFrame(intervals){
  const bad=reason=>({valid:false,reason,bits:[],bytes:[],address:null,command:null});
  if(!Array.isArray(intervals)||intervals.length!==34)return bad('Incomplete frame');
  for(let i=0;i<intervals.length;i++){
    const item=intervals[i];
    if(!Array.isArray(item)||item.length!==2||!Number.isFinite(item[0])||!Number.isFinite(item[1])||item[0]<0||item[1]<=item[0]||(i&&item[0]<=intervals[i-1][1]))return bad('Invalid edge order');
    const expected=i?IR_TIMING.mark:IR_TIMING.leader,tolerance=i?RECEIVER_WINDOW.mark:RECEIVER_WINDOW.leader;
    if(Math.abs(item[1]-item[0]-expected)>tolerance+1e-12)return bad(i?'Invalid burst width':'Invalid leader width');
  }
  if(Math.abs(intervals[1][0]-intervals[0][0]-IR_TIMING.leader-IR_TIMING.space)>RECEIVER_WINDOW.leaderDistance+1e-12)return bad('Invalid leader spacing');
  const bits=[];
  for(let i=1;i<33;i++){
    const distance=intervals[i+1][0]-intervals[i][0];
    if(Math.abs(distance-IR_TIMING.zero)<=RECEIVER_WINDOW.bitDistance+1e-12)bits.push(0);
    else if(Math.abs(distance-IR_TIMING.one)<=RECEIVER_WINDOW.bitDistance+1e-12)bits.push(1);
    else return bad('Invalid bit spacing');
  }
  const bytes=Array.from({length:4},(_,k)=>bits.slice(k*8,k*8+8).reduce((sum,bit,i)=>sum+(bit<<i),0));
  const valid=(bytes[0]^bytes[1])===255&&(bytes[2]^bytes[3])===255;
  return {valid,reason:valid?'Frame checks passed':'Inverse byte does not match',bits,bytes,address:bytes[0],command:bytes[2]};
}

/** Assigned TV command map. It does not claim a particular manufacturer's codes. */
export function applyRemoteCommand(initial,decoded){
  const tv={...initial};
  if(!decoded.valid)return {tv,accepted:false,reason:decoded.reason};
  if(decoded.address!==TV_ADDRESS)return {tv,accepted:false,reason:`Address ${decoded.address} belongs to another device`};
  const effect=REMOTE_KEYS.find(key=>key.value===decoded.command)?.effect;
  if(!effect)return {tv,accepted:false,reason:`Code ${decoded.command} has no assigned action`};
  if(effect==='power')tv.on=!tv.on;
  else if(!tv.on)return {tv,accepted:true,reason:'TV is off; only Power changes it'};
  else if(effect==='volume-up'){tv.volume=Math.min(10,tv.volume+1);tv.muted=false;}
  else if(effect==='volume-down'){tv.volume=Math.max(0,tv.volume-1);tv.muted=false;}
  else if(effect==='channel-up')tv.channel=tv.channel%4+1;
  else if(effect==='channel-down')tv.channel=(tv.channel+2)%4+1;
  else if(effect==='mute')tv.muted=!tv.muted;
  return {tv,accepted:true,reason:commandName(decoded.command)};
}

/** Two LED branches load the same two-cell rail. Logic/switch losses are excluded. */
export function remoteCircuit(battery,indicatorIndex=1,infraredOn=true){
  if(!Number.isFinite(battery)||battery<1.6||battery>3.3||![1,2].includes(indicatorIndex))throw new RangeError('Invalid remote circuit setting');
  const branch=(index,rail)=>{
    const led=LEDS[index],solution=seriesDiode(led.IS,DECLARED.ideality,led.RS+led.resistor,rail);
    return {index,current:solution.current,junction:solution.junction,voltage:solution.junction+solution.current*led.RS,resistance:led.resistor};
  };
  let lower=0,upper=battery;
  for(let i=0;i<60;i++){
    const rail=(lower+upper)/2,current=branch(indicatorIndex,rail).current+(infraredOn?branch(0,rail).current:0);
    if(rail+CELL_RESISTANCE*current>battery)upper=rail;else lower=rail;
  }
  const rail=(lower+upper)/2,indicator=branch(indicatorIndex,rail);
  const infrared=infraredOn?branch(0,rail):{index:0,current:0,junction:0,voltage:0,resistance:LEDS[0].resistor};
  const current=indicator.current+infrared.current;
  const ledPower=indicator.current*indicator.voltage+infrared.current*infrared.voltage;
  const resistorPower=indicator.current**2*indicator.resistance+infrared.current**2*infrared.resistance;
  const cellPower=current**2*CELL_RESISTANCE;
  return {battery,rail,current,indicator,infrared,ledPower,resistorPower,cellPower,suppliedPower:battery*current};
}

/** Exact on-time for a one-third-duty carrier restarted at each mark's start. */
export function gatedCarrierTime(length,frequency=IR_TIMING.carrier){
  if(!Number.isFinite(length)||length<0||!Number.isFinite(frequency)||frequency<=0)throw new RangeError('Invalid carrier interval');
  const cycles=length*frequency,whole=Math.floor(cycles);
  return (whole*IR_TIMING.duty+Math.min(IR_TIMING.duty,cycles-whole))/frequency;
}
export const frameCarrierTime=(marks,time,frequency)=>marks.reduce((sum,[start,end])=>sum+gatedCarrierTime(Math.max(0,Math.min(time,end)-start),frequency),0);

export function remoteControlPlan(input={}){
  const values=validateControls(input,REMOTE_CONTROL_DEFAULTS,REMOTE_CONTROL_DOMAINS,'remote control');
  const frame=encodeRemoteFrame(values.address,values.command,values.fault===1),frequency=values.carrier*1000;
  const indicatorIndex=values.emitter===2?2:1,on=remoteCircuit(values.battery,indicatorIndex,true),off=remoteCircuit(values.battery,indicatorIndex,false);
  const intensity=intensityAt(on.infrared.current),reach=intensity/values.distance**2,irradiance=values.blocked?0:reach;
  const strong=irradiance>=TSOP38438.nec,tuned=frequency===IR_TIMING.carrier;
  // A discrete teaching rule, not a reconstruction of AGC or the filter curve.
  const output=strong&&tuned?frame.marks.map(([start,end])=>[start+IR_TIMING.delay,end+IR_TIMING.delay]):[];
  const decoded=decodeRemoteFrame(output),decision=applyRemoteCommand(TV_INITIAL,decoded);
  const onTime=frameCarrierTime(frame.marks,frame.frameEnd,frequency),offTime=frame.frameEnd-onTime;
  const charge=on.current*onTime+off.current*offTime;
  const duration=frame.frameEnd+IR_TIMING.delay;
  return freeze({values,...frame,frequency,on,off,intensity,reach,irradiance,strong,tuned,output,decoded,decision,
    range:Math.sqrt(intensity/TSOP38438.nec),light:photocurrentOf(irradiance),dark:BPW34.dark,
    radiantPower:radiantPower(on.infrared.current)/1000,photon:photonEv(940),
    diagnosticDiode:diodeAt(values.probe),depletion:depletionShare(values.probe),
    onTime,offTime,charge,energy:values.battery*charge,ledEnergy:on.ledPower*onTime+off.ledPower*offTime,
    resistorEnergy:on.resistorPower*onTime+off.resistorPower*offTime,cellEnergy:on.cellPower*onTime+off.cellPower*offTime,
    duration,run:IR_TIMING.press+duration*IR_TIMING.slow});
}

export function remoteControlAt(plan,clock){
  if(!Number.isFinite(clock)||clock<0)throw new RangeError('Expected nonnegative remote playback time');
  const time=Math.max(0,Math.min(plan.duration,(clock-IR_TIMING.press)/IR_TIMING.slow));
  const started=clock>=IR_TIMING.press,done=clock>=plan.run;
  const mark=started?plan.marks.findIndex(([start,end])=>time>=start&&time<end):-1;
  const bursting=mark>=0,cycles=bursting?(time-plan.marks[mark][0])*plan.frequency:0;
  const carrierOn=bursting&&(cycles-Math.floor(cycles))<IR_TIMING.duty;
  const sending=started&&time<plan.frameEnd;
  const circuit=carrierOn?plan.on:plan.off;
  const low=started&&plan.output.some(([start,end])=>time>=start&&time<end);
  const receivedEdges=started?plan.output.filter(([start])=>start<=time):[];
  const decodedBits=[];
  for(let i=1;i<receivedEdges.length-1;i++){
    const delta=receivedEdges[i+1][0]-receivedEdges[i][0];
    decodedBits.push(Math.abs(delta-IR_TIMING.zero)<Math.abs(delta-IR_TIMING.one)?0:1);
  }
  const completedMark=started?plan.output.filter(([,end])=>end<=time).length:0;
  const validated=completedMark===34;
  const accepted=validated&&plan.decision.accepted;
  const tv=accepted?{...plan.decision.tv}:{...TV_INITIAL};
  const onTime=started?frameCarrierTime(plan.marks,Math.min(time,plan.frameEnd),plan.frequency):0;
  const elapsed=started?Math.min(time,plan.frameEnd):0,offTime=elapsed-onTime;
  const charge=plan.on.current*onTime+plan.off.current*offTime;
  let phase=clock===0?'Choose a button, then press Play':!started?'The key closes its contact':mark===0?'The handset sends the leader':time<IR_TIMING.leader+IR_TIMING.space?'The leader pauses':time<plan.frameEnd?'The timed bursts carry the code':'The decoder checks the complete frame';
  if(done){
    phase=plan.values.blocked?'No command: the hand blocked the light':!plan.strong?'No command: below the model receiver threshold':!plan.tuned?'No command: this receiver expects 38 kHz':!plan.decoded.valid?`No command: ${plan.decoded.reason.toLowerCase()}`:!plan.decision.accepted?plan.decision.reason:`TV accepted ${commandName(plan.decoded.command)}`;
  }
  return {clock:Math.min(clock,plan.run),time,started,done,complete:done,bursting,mark,cycles,carrierOn,sending,low,decodedBits,decodedCount:decodedBits.length,validated,accepted,tv,phase,
    values:{...plan.values},keyDown:clock>0&&clock<IR_TIMING.press+.25,indicatorOn:sending,
    infraredCurrent:sending&&carrierOn?circuit.infrared.current:0,indicatorCurrent:sending?circuit.indicator.current:0,
    photocurrent:plan.dark+(started&&carrierOn?plan.light:0),envelopePhotocurrent:plan.dark+(bursting?plan.light:0),
    onTime,charge,energy:plan.values.battery*charge,ledEnergy:plan.on.ledPower*onTime+plan.off.ledPower*offTime,
    resistorEnergy:plan.on.resistorPower*onTime+plan.off.resistorPower*offTime,cellEnergy:plan.on.cellPower*onTime+plan.off.cellPower*offTime};
}

export function createRemoteControlController(initial={}){
  let plan=remoteControlPlan(),clock=0;
  const getState=()=>remoteControlAt(plan,clock);
  function reset(state={}){
    if(!state||typeof state!=='object'||Array.isArray(state))throw new TypeError('Expected remote initial state');
    for(const key of Object.keys(state))if(!['settings','time'].includes(key))throw new RangeError(`Unknown remote initial field ${key}`);
    const next=remoteControlPlan(state.settings??{}),time=state.time??0;
    if(!Number.isFinite(time)||time<0||time>next.run)throw new RangeError('Invalid remote initial time');
    plan=next;clock=time;return getState();
  }
  function update(changes={}){
    const values=validateControls(changes,plan.values,REMOTE_CONTROL_DOMAINS,'remote control');
    if(Object.keys(values).some(key=>values[key]!==plan.values[key])){plan=remoteControlPlan(values);clock=0;}
    return getState();
  }
  function advance(seconds){
    if(!Number.isFinite(seconds)||seconds<0)throw new RangeError('Expected nonnegative remote playback interval');
    clock=Math.min(plan.run,clock+seconds);if(plan.run-clock<1e-12)clock=plan.run;return getState();
  }
  reset(initial);
  return {getState,reset,update,advance,getPlan:()=>structuredClone(plan),replayState:()=>({settings:{...plan.values},time:0})};
}

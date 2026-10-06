import {validateControls} from './physics-kit.js';
import {REMOTE_CONTROL_DEFAULTS,REMOTE_CONTROL_DOMAINS,IR_TIMING,remoteControlPlan,createRemoteControlController} from './remote-control-physics.js';

export const SIGNAL_DEFAULTS=Object.freeze({command:26,address:55,bit:16,distance:5,battery:3,blocked:0,fault:0,carrier:38});
export const SIGNAL_DOMAINS=Object.freeze(Object.fromEntries(Object.keys(SIGNAL_DEFAULTS).map(key=>[key,key==='bit'?Object.freeze([0,31,1]):REMOTE_CONTROL_DOMAINS[key]])));
const messageSettings=({bit,...settings})=>({...REMOTE_CONTROL_DEFAULTS,...settings});
const byteNames=['Address','Inverted address','Command','Inverted command'];

/** One selected data interval, including the next mark needed to read it. */
export function inspectSignalBit(plan,index,physicalTime=0){
  if(!Number.isInteger(index)||index<0||index>31)throw new RangeError('Invalid bit');
  if(!Number.isFinite(physicalTime)||physicalTime<0)throw new RangeError('Invalid signal time');
  const byteIndex=Math.floor(index/8),bitIndex=index%8,start=plan.marks[index+1][0],next=plan.marks[index+2][0];
  const received=plan.output.length===34,readAt=received?plan.output[index+2][0]:null;
  return {index,byteIndex,byteName:byteNames[byteIndex],byte:plan.bytes[byteIndex],bitIndex,weight:2**bitIndex,
    value:plan.bits[index],byteBits:plan.bits.slice(byteIndex*8,byteIndex*8+8),start,next,mark:IR_TIMING.mark,
    distance:next-start,gap:next-start-IR_TIMING.mark,windowEnd:next-start+IR_TIMING.mark+IR_TIMING.delay,closing:index===31,received,readAt,
    decoded:received&&physicalTime>=readAt,relativeTime:physicalTime-start,
    pulses:Math.ceil(IR_TIMING.mark*plan.frequency),periods:IR_TIMING.mark*plan.frequency};
}

export function signalTrialTime(settings,index){
  const plan=remoteControlPlan(messageSettings(validateControls(settings,SIGNAL_DEFAULTS,SIGNAL_DOMAINS,'infrared signaling')));
  return IR_TIMING.press+inspectSignalBit(plan,index).start*IR_TIMING.slow;
}

export function createSignalingController(initial={}){
  const core=createRemoteControlController();let values={...SIGNAL_DEFAULTS};
  const getState=()=>{const s=core.getState();return {...s,values:{...values},inspected:inspectSignalBit(core.getPlan(),values.bit,s.time)};};
  function reset(initial={}){
    if(!initial||typeof initial!=='object'||Array.isArray(initial))throw new TypeError('Expected signaling initial state');
    for(const key of Object.keys(initial))if(!['settings','time'].includes(key))throw new RangeError(`Unknown signaling initial field ${key}`);
    const next=validateControls(initial.settings??{},SIGNAL_DEFAULTS,SIGNAL_DOMAINS,'infrared signaling');
    core.reset({settings:messageSettings(next),time:initial.time??0});values=next;return getState();
  }
  function update(changes={}){
    const next=validateControls(changes,values,SIGNAL_DOMAINS,'infrared signaling');
    core.update(messageSettings(next));values=next;return getState();
  }
  reset(initial);
  return {getState,reset,update,advance:seconds=>{core.advance(seconds);return getState();},getPlan:core.getPlan,replayState:()=>({settings:{...values},time:0})};
}

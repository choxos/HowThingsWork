import {validateControls, validTime, clamp} from './physics-kit.js';
import {tiltProfile, twistProfile, cellTransmission, relax, seriesAt, directorAt, srgbDecode, srgbEncode, M1} from './lcd-physics.js';

// An assigned normally-white TN screen, not a calibrated commercial product.
// Retain the independently checked Frank-energy and Jones-matrix mathematics.
// The ideal storage approximation holds pixel voltage between row writes:
// leakage, finite charging, changing LC capacitance and gate feedthrough are omitted.
export const TFT = Object.freeze({columns:480,rows:272,clock:9e6,lineClocks:525,frameLines:285,backPorch:12,frames:12,slow:100,layers:80,pretilt:2*Math.PI/180,maximumDrive:5,voltageStep:.05,stability:.1,sample:.00025,snapshot:.001});
export const TFT_WAVELENGTHS = Object.freeze([630e-9,550e-9,460e-9]);
export const TFT_DEFAULTS = Object.freeze({pattern:0,red:255,green:128,blue:0,background:0,gap:4,backlight:100,addressing:0});
export const TFT_DOMAINS = Object.freeze({pattern:[0,3,1],red:[0,255,1],green:[0,255,1],blue:[0,255,1],background:[0,1,1],gap:[3,6,.5],backlight:[0,100,25],addressing:[0,2,1]});
export const TFT_LINE = TFT.lineClocks/TFT.clock;
export const TFT_FRAME = TFT.frameLines*TFT_LINE;
export const TFT_RECORD = TFT.frames*TFT_FRAME;
export const TFT_DURATION = Number((TFT_RECORD*TFT.slow).toFixed(12));
export const TFT_MATERIAL = M1;
const PREVIOUS_DRIVE=-TFT.maximumDrive;
const TARGET_CODES=Object.freeze({black:[0,0,0],white:[255,255,255],red:[255,0,0],green:[0,255,0],blue:[0,0,255]});
const privatePlans=new WeakMap(),plans=new Map(),optics=new Map(),flows=new Map();
let staticProfiles;

function boundedCache(cache,key,value,maximum=32){if(cache.size>=maximum)cache.delete(cache.keys().next().value);cache.set(key,value);return value;}
function staticTable(){
  if(staticProfiles)return staticProfiles;
  let theta=new Float64Array(TFT.layers+1).fill(TFT.pretilt);
  staticProfiles=Array.from({length:101},(_,i)=>{const volts=i*TFT.voltageStep;theta=tiltProfile(volts,theta);return {volts,theta,phi:twistProfile(theta)};});
  return staticProfiles;
}
function rest(volts){
  const table=staticTable(),seed=table[Math.min(100,Math.max(0,Math.floor(volts/TFT.voltageStep)))];
  const theta=tiltProfile(volts,seed.theta);return {theta,phi:twistProfile(theta)};
}
function transmission(director,gap,channel){return cellTransmission(director.theta,director.phi,gap,TFT_WAVELENGTHS[channel]);}
function staticLight(volts,gap,channel){return transmission(rest(volts),gap,channel);}
function opticalTable(gap){
  if(optics.has(gap))return optics.get(gap);
  const table=staticTable();
  const channels=TFT_WAVELENGTHS.map((_,channel)=>{
    const light=table.map(d=>transmission(d,gap,channel));let best=0;
    for(let i=1;i<light.length;i++)if(light[i]>light[best])best=i;
    let whiteVolts=table[best].volts,white=light[best];
    if(best>0&&best<100){
      let lo=table[best-1].volts,hi=table[best+1].volts;
      const ratio=(Math.sqrt(5)-1)/2;
      let a=hi-ratio*(hi-lo),b=lo+ratio*(hi-lo),fa=staticLight(a,gap,channel),fb=staticLight(b,gap,channel);
      for(let i=0;i<36;i++){
        if(fa>fb){hi=b;b=a;fb=fa;a=hi-ratio*(hi-lo);fa=staticLight(a,gap,channel);}
        else{lo=a;a=b;fa=fb;b=lo+ratio*(hi-lo);fb=staticLight(b,gap,channel);}
      }
      whiteVolts=(lo+hi)/2;white=staticLight(whiteVolts,gap,channel);
    }
    return {light,whiteVolts,white,black:light[100]};
  });
  return boundedCache(optics,gap,channels,8);
}
function targetDrive(gap,channel,linear){
  const curve=opticalTable(gap)[channel];
  if(linear===0)return TFT.maximumDrive;if(linear===1)return curve.whiteVolts;
  const target=curve.black+linear*(curve.white-curve.black);
  let lo=curve.whiteVolts,hi=TFT.maximumDrive;
  for(let i=1;i<=100;i++){
    if(i*TFT.voltageStep<=lo)continue;
    if(curve.light[i]<=target){hi=i*TFT.voltageStep;break;}
    lo=i*TFT.voltageStep;
  }
  for(let i=0;i<34;i++){const mid=(lo+hi)/2;if(staticLight(mid,gap,channel)>target)lo=mid;else hi=mid;}
  return (lo+hi)/2;
}
function response(gap,volts){
  const key=`${gap}/${volts}`;
  if(flows.has(key))return flows.get(key);
  // Sampling extends past the record so interpolation never holds a prematurely
  // truncated endpoint. Director snapshots likewise cover the entire record.
  const duration=Math.ceil(TFT_RECORD/TFT.snapshot)*TFT.snapshot;
  return boundedCache(flows,key,relax(staticTable()[100],volts,gap,duration,{sample:TFT.sample,snapshot:TFT.snapshot,stability:TFT.stability}),64);
}
function paletteEntry(gap,codes){
  const channels=opticalTable(gap),linear=codes.map(c=>srgbDecode(c/255)),drive=linear.map((v,c)=>targetDrive(gap,c,v));
  return {codes:codes.slice(),linear,drive,flows:drive.map(v=>response(gap,v)),target:drive.map((v,c)=>staticLight(v,gap,c)/channels[c].white)};
}
function targetAt(values,row,column){
  if(values.pattern===1)return 'custom';
  if(values.pattern===2)return ['red','green','blue'][Math.min(2,Math.floor(column/160))];
  if(values.pattern===3)return (Math.floor(row/68)+Math.floor(column/60))%2?'black':'custom';
  return row>=72&&row<200&&column>=120&&column<360?'custom':values.background?'white':'black';
}
export function tftControlEnabled(key,values){
  if(['red','green','blue'].includes(key))return values.pattern!==2;
  if(key==='background')return values.pattern===0;
  return true;
}
export function tftScreenPlan(input={}){
  const values=validateControls(input,TFT_DEFAULTS,TFT_DOMAINS,'TFT screen'),key=JSON.stringify(values);
  if(plans.has(key))return plans.get(key);
  const custom=[values.red,values.green,values.blue],names=values.pattern===2?['red','green','blue']:values.pattern===1?['custom']:['custom',values.pattern===0&&values.background?'white':'black'];
  const palette=Object.fromEntries(names.map(name=>[name,paletteEntry(values.gap,name==='custom'?custom:TARGET_CODES[name])]));
  const optical=opticalTable(values.gap),black=optical.map(c=>c.black/c.white),center=palette[targetAt(values,135,239)];
  const plan=Object.freeze({values:Object.freeze(values),duration:TFT_RECORD,sceneDuration:TFT_DURATION,line:TFT_LINE,frame:TFT_FRAME,frameRate:1/TFT_FRAME,black:Object.freeze(black),targetCodes:Object.freeze(center.codes.slice()),targetLinear:Object.freeze(center.linear.slice()),targetLight:Object.freeze(center.target.slice()),targetDrive:Object.freeze(center.drive.slice()),curves:Object.freeze(optical.map(c=>Object.freeze(c.light.map(v=>v/c.white)))),whiteDrives:Object.freeze(optical.map(c=>c.whiteVolts))});
  privatePlans.set(plan,{palette,optical});return boundedCache(plans,key,plan,24);
}
export function tftRowStart(row){if(!Number.isInteger(row)||row<0||row>=TFT.rows)throw new RangeError('Invalid pixel row');return (TFT.backPorch+row)*TFT_LINE;}
function rowState(plan,time,row){
  const first=tftRowStart(row);
  const count=plan.values.addressing===2||time<first?0:Math.min(plan.values.addressing===1?1:TFT.frames,Math.floor((time-first)/TFT_FRAME+1e-10)+1);
  return {writes:count,polarity:count?(count%2?1:-1):-1,age:count?Math.max(0,time-first):0};
}
function pixel(plan,time,row,column){
  const p=privatePlans.get(plan),entry=p.palette[targetAt(plan.values,row,column)],state=rowState(plan,time,row);
  const light=state.writes?entry.flows.map((f,c)=>seriesAt(f.light[c],f.sample,state.age)/p.optical[c].white):plan.black.slice();
  const illuminated=light.map(v=>v*plan.values.backlight/100);
  return {row,column,...state,codes:entry.codes.slice(),target:entry.target.slice(),drive:entry.drive.slice(),held:entry.drive.map(v=>state.writes?state.polarity*v:PREVIOUS_DRIVE),light,illuminated,rgb:illuminated.map(v=>srgbEncode(clamp(v))),clipped:illuminated.some(v=>v>1||v<0)};
}
export function tftPixelAt(plan,time,row,column){
  if(!privatePlans.has(plan))throw new TypeError('Expected TFT screen plan');validTime(time);tftRowStart(row);
  if(!Number.isInteger(column)||column<0||column>=TFT.columns)throw new RangeError('Invalid pixel column');
  return pixel(plan,Math.min(time,TFT_RECORD),row,column);
}
export function sampleTftScreen(plan,time=0){
  if(!privatePlans.has(plan))throw new TypeError('Expected TFT screen plan');validTime(time);
  const t=Math.min(time,TFT_RECORD),p=privatePlans.get(plan),done=t>=TFT_RECORD,frame=Math.min(TFT.frames-1,Math.floor(t/TFT_FRAME)),line=Math.floor((t-frame*TFT_FRAME)/TFT_LINE+1e-10);
  const scan=plan.values.addressing===2||done||(plan.values.addressing===1&&frame>0)?null:line>=TFT.backPorch&&line<TFT.backPorch+TFT.rows?line-TFT.backPorch:null;
  const center=pixel(plan,t,135,239),entry=p.palette[targetAt(plan.values,135,239)];
  const directors=entry.flows.map(f=>center.writes?directorAt(f,center.age):{theta:Float64Array.from(staticTable()[100].theta),phi:Float64Array.from(staticTable()[100].phi)});
  const rows=Array.from({length:TFT.rows},(_,row)=>{
    const boundaries=plan.values.pattern===2?[0,160,320,480]:plan.values.pattern===3?[0,60,120,180,240,300,360,420,480]:plan.values.pattern===0&&row>=72&&row<200?[0,120,360,480]:[0,480];
    return {row,segments:boundaries.slice(0,-1).map((from,i)=>({from,to:boundaries[i+1],rgb:pixel(plan,t,row,from).rgb}))};
  });
  return {values:{...plan.values},time:t,clock:done?TFT_DURATION:t*TFT.slow,done,frame,scanRow:scan,center,directors,rows,frameRate:plan.frameRate,line:plan.line,frameTime:plan.frame,black:plan.black.slice(),targetDrive:plan.targetDrive.slice(),targetLight:plan.targetLight.slice(),whiteDrives:plan.whiteDrives.slice(),curves:plan.curves,backlight:plan.values.backlight/100};
}
export function tftTrace(plan){
  if(!privatePlans.has(plan))throw new TypeError('Expected TFT screen plan');
  return Array.from({length:201},(_,i)=>{const time=(i/200)*TFT_RECORD,p=tftPixelAt(plan,time,135,239);return {time,light:p.illuminated,held:p.held};});
}
export function tftVoltageSteps(plan,time=TFT_RECORD){
  if(!privatePlans.has(plan))throw new TypeError('Expected TFT screen plan');validTime(time);const end=Math.min(time,TFT_RECORD),result=[{time:0,voltage:PREVIOUS_DRIVE}];
  for(let i=0;i<TFT.frames;i++){
    if(plan.values.addressing===2||(plan.values.addressing===1&&i>0))break;
    const at=tftRowStart(135)+i*TFT_FRAME;if(at>end)break;
    result.push({time:at,voltage:result.at(-1).voltage},{time:at,voltage:plan.targetDrive[1]*(i%2?-1:1)});
  }
  result.push({time:end,voltage:result.at(-1).voltage});return result;
}
export function createTftScreenController(initial={}){
  let plan,clock,origin;
  function reset(next={}){
    if(!next||typeof next!=='object'||Array.isArray(next))throw new TypeError('Expected TFT screen initial state');
    for(const key of Object.keys(next))if(!['settings','time'].includes(key))throw new RangeError(`Unknown initial field ${key}`);
    const nextPlan=tftScreenPlan(next.settings??{}),nextTime=Math.min(TFT_DURATION,validTime(next.time??0));
    plan=nextPlan;clock=nextTime;origin={settings:{...plan.values},time:0};return getState();
  }
  function update(changes={}){
    const next=validateControls(changes,plan.values,TFT_DOMAINS,'TFT screen'),nextPlan=tftScreenPlan(next);
    if(Object.keys(next).some(key=>next[key]!==plan.values[key])){clock=0;origin={settings:{...next},time:0};}
    plan=nextPlan;return getState();
  }
  function advance(dt){validTime(dt);clock=Math.min(TFT_DURATION,Number((clock+dt).toFixed(12)));return getState();}
  function getState(){return sampleTftScreen(plan,clock>=TFT_DURATION?TFT_RECORD:clock/TFT.slow);}
  reset(initial);return {reset,update,advance,getState,getPlan:()=>plan,replayState:()=>structuredClone(origin)};
}

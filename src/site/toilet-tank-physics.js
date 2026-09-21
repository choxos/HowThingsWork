// An illustrative single-flush siphon cistern. SI units throughout.
// The float valve responds during the flush as well as afterward. Priming
// transfers water from the tank into the initially air-filled upper passage.
export const cisternConstants = Object.freeze({
  tankWidth: .4, tankDepth: .18, tankArea: .072,
  breakLevel: .04, outletDrop: .25, bendBase: .22, bendRadius: .0575,
  barrelRadius: .061, pistonRadius: .06, barrelTop: .155,
  discharge: .7, gravity: 9.81, fillAtOneBar: .00008, closingBand: .03,
  primeDuration: .6, returnDuration: .4,
  settled: .00001, refillSpeed: 10, observationDuration: 120, observationSpeed: 6,
});
export const CISTERN_DEFAULTS = Object.freeze({level:.18,bore:.032,pressure:2,stroke:.1,fault:0,perDay:5});
export const CISTERN_DOMAINS = Object.freeze({level:[.16,.215,.005],bore:[.025,.045,.001],pressure:[0,5,.5],stroke:[0,.1,.005],fault:[0,2,1],perDay:[1,12,1]});
export const CISTERN_FAULTS = [{value:0,label:'Working diaphragm and fill valve'},{value:1,label:'Torn priming diaphragm'},{value:2,label:'Fill valve stuck open'}];
export const siphonCeiling = Object.freeze({atmosphere:101325,vapor:2339,density:998.2});
export const maximumSiphonLift=(atmosphere=siphonCeiling.atmosphere,vapor=siphonCeiling.vapor,density=siphonCeiling.density)=>(atmosphere-vapor)/(density*cisternConstants.gravity);
export const pipeArea=bore=>Math.PI*bore*bore/4;
const C=cisternConstants,clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
export function risingArea(height,bore){return height<C.barrelTop?Math.PI*C.barrelRadius**2:pipeArea(bore);}
function risingVolume(from,to,bore){
  const lo=Math.max(from,C.breakLevel),hi=Math.min(to,C.bendBase);
  if(hi<=lo)return 0;
  return Math.max(0,Math.min(hi,C.barrelTop)-lo)*Math.PI*C.barrelRadius**2+Math.max(0,hi-Math.max(lo,C.barrelTop))*pipeArea(bore);
}
// Water held above the outside surface, plus the bend and falling leg.
export function siphonStorage(level,bore){return risingVolume(level,C.bendBase,bore)+pipeArea(bore)*(Math.PI*C.bendRadius+C.bendBase+C.outletDrop);}
export const spillLevel=bore=>C.bendBase+C.bendRadius-bore/2;
export function siphonDischarge(level,bore){return level>C.breakLevel?C.discharge*pipeArea(bore)*Math.sqrt(2*C.gravity*(C.outletDrop+level)):0;}
export function fillRate(level,target,pressure,stuck=false){return C.fillAtOneBar*Math.sqrt(Math.max(0,pressure))*(stuck?1:clamp((target-level)/C.closingBand,0,1));}
export function overflowRate(level,bore){return 1.7*Math.PI*bore*Math.max(0,level-spillLevel(bore))**1.5;}
// Stored charge excludes water entering while the siphon runs.
export const flushVolume=startLevel=>Math.max(0,startLevel-C.breakLevel)*C.tankArea*1000;

function rates(s,v){
  const fill=fillRate(s.level,v.level,v.pressure,v.fault===2);
  if(s.stage==='priming'){
    const pump=v.fault===1?0:Math.PI*C.pistonRadius**2*v.stroke/C.primeDuration;
    return {level:(fill-pump)/C.tankArea,pipe:pump,inlet:fill,outlet:0};
  }
  if(s.stage==='siphoning'){
    const outlet=siphonDischarge(Math.max(s.level,C.breakLevel+1e-12),v.bore),level=(fill-outlet)/(C.tankArea-risingArea(s.level,v.bore));
    return {level,pipe:-risingArea(s.level,v.bore)*level,inlet:fill,outlet};
  }
  if(s.stage==='returning'){
    const back=s.drainStart/C.returnDuration;
    return {level:(fill+back)/C.tankArea,pipe:-back,inlet:fill,outlet:0};
  }
  if(s.stage==='rundown'){
    const outlet=s.drainRate*Math.max(0,1-s.stageTime/s.drainDuration);
    return {level:fill/C.tankArea,pipe:-outlet,inlet:fill,outlet};
  }
  const outlet=s.stage==='observing'?overflowRate(s.level,v.bore):0;
  return {level:(fill-outlet)/C.tankArea,pipe:0,inlet:fill,outlet};
}
const keys=['level','pipe','inlet','outlet'];
function rk4(s,v,dt){
  const full=s.stage==='siphoning',stored=h=>C.tankArea*h+siphonStorage(h,v.bore),w=stored(s.level),atTop=stored(C.barrelTop);
  const height=volume=>C.barrelTop+(volume-atTop)/(C.tankArea-(volume>=atTop?pipeArea(v.bore):Math.PI*C.barrelRadius**2));
  const derivative=n=>{const k=rates(n,v);if(full)k.level=k.inlet-k.outlet;return k;};
  const add=(k,d)=>{const n=Object.fromEntries([...Object.entries(s),['stageTime',s.stageTime+d],...keys.map(key=>[key,s[key]+k[key]*d])]);if(full){n.level=height(w+k.level*d);n.pipe=siphonStorage(n.level,v.bore);}return n;};
  const a=derivative(s),b=derivative(add(a,dt/2)),c=derivative(add(b,dt/2)),d=derivative(add(c,dt)),next={...s};
  for(const key of keys)next[key]+=dt*(a[key]+2*b[key]+2*c[key]+d[key])/6;
  if(full){next.level=height(w+dt*(a.level+2*b.level+2*c.level+d.level)/6);next.pipe=siphonStorage(next.level,v.bore);}
  return next;
}

/** Deterministic trajectory, split at priming, air admission and closure events.
 * Rundown is prescribed rather than a two-phase transient-flow calculation.
 * Its declining outlet flow integrates to exactly the retained pipe volume.
 */
export function createCisternTrial(v){
  let s={time:0,screen:0,stage:v.fault===2?'observing':'priming',stageTime:0,level:v.level,pipe:0,inlet:0,outlet:0,drainStart:0,drainRate:0,drainDuration:0,primed:false,primeAt:null,primeVolume:0,flushEnded:null,complete:false,peak:0};
  const states=[{...s,stage:'ready'}];
  const append=()=>states.push({...s});
  const event=(next,predicate,dt)=>{
    if(!predicate(next))return dt;
    let lo=0,hi=dt;for(let i=0;i<35;i++){const mid=(lo+hi)/2;if(predicate(rk4(s,v,mid)))hi=mid;else lo=mid;}return hi;
  };
  for(let step=0;step<150000&&!s.complete;step++){
    const speed=s.stage==='refilling'?C.refillSpeed:s.stage==='observing'?C.observationSpeed:1;
    let dt=s.stage==='refilling'?.2:s.stage==='observing'?.05:.01;
    if(s.stage==='priming')dt=Math.min(dt,C.primeDuration-s.stageTime);
    if(s.stage==='returning')dt=Math.min(dt,C.returnDuration-s.stageTime);
    if(s.stage==='rundown')dt=Math.min(dt,s.drainDuration-s.stageTime);
    if(s.stage==='observing')dt=Math.min(dt,C.observationDuration-s.time);
    let next=rk4(s,v,dt),transition=null;
    if(s.stage==='priming'&&next.pipe>=siphonStorage(next.level,v.bore)){
      dt=event(next,n=>n.pipe>=siphonStorage(n.level,v.bore),dt);transition='siphoning';
    }else if(s.stage==='siphoning'&&next.level<=C.breakLevel){
      dt=event(next,n=>n.level<=C.breakLevel,dt);transition='rundown';
    }else if(s.stage==='refilling'&&v.level-next.level<=C.settled){
      dt=event(next,n=>v.level-n.level<=C.settled,dt);transition='done';
    }
    next=rk4(s,v,dt);next.time=s.time+dt;next.screen=s.screen+dt/speed;next.stageTime=s.stageTime+dt;
    next.peak=Math.max(s.peak,rates(s,v).outlet,rates(next,v).outlet);s=next;
    if(transition==='siphoning'){s.primed=true;s.primeAt=s.time;s.primeVolume=s.pipe;s.peak=Math.max(s.peak,siphonDischarge(s.level,v.bore));}
    if(transition==='rundown'){s.level=C.breakLevel;s.flushEnded=s.time;s.drainStart=s.pipe;s.drainRate=C.discharge*pipeArea(v.bore)*Math.sqrt(2*C.gravity*(C.outletDrop+C.breakLevel));s.drainDuration=2*s.pipe/s.drainRate;}
    if(transition==='done'){
      s.inlet+=(v.level-s.level)*C.tankArea;s.level=v.level;s.complete=true;
    }
    if(!transition&&s.stage==='priming'&&s.stageTime>=C.primeDuration-1e-10){transition='returning';s.drainStart=s.pipe;}
    if(!transition&&s.stage==='returning'&&s.stageTime>=C.returnDuration-1e-10){s.pipe=0;transition='done';s.complete=true;}
    if(!transition&&s.stage==='rundown'&&s.stageTime>=s.drainDuration-1e-10){s.pipe=0;transition=v.pressure>0?'refilling':'done';s.complete=v.pressure===0;}
    if(!transition&&s.stage==='observing'&&s.time>=C.observationDuration-1e-10){transition='done';s.complete=true;}
    if(transition){s.stage=transition;s.stageTime=0;}
    // Enforce conservation without accumulating subtraction error in storage.
    s.outlet=s.inlet-C.tankArea*(s.level-v.level)-s.pipe;
    if(Math.abs(s.outlet)<1e-13)s.outlet=0;
    append();
  }
  if(!s.complete)throw new Error('Cistern trial did not reach its declared end.');
  return {values:{...v},states,duration:s.screen,final:{...s}};
}

export function sampleCistern(trial,screen){
  const t=clamp(screen,0,trial.duration),list=trial.states;
  let lo=0,hi=list.length-1;while(lo<hi){const mid=Math.ceil((lo+hi)/2);if(list[mid].screen<=t)lo=mid;else hi=mid-1;}
  const a=list[lo],b=list[Math.min(lo+1,list.length-1)],u=b.screen>a.screen?(t-a.screen)/(b.screen-a.screen):0,s={...a};
  for(const key of ['time','level','pipe','inlet','outlet','stageTime'])s[key]=a[key]+(b[key]-a[key])*u;
  if(b.stage!==a.stage)s.stageTime=a.stageTime+(s.time-a.time);
  if(t===0)s.stage='ready';
  const v=trial.values,flow=s.stage==='ready'||s.complete&&v.fault!==2?{inlet:0,outlet:0}:rates(s.complete?{...s,stage:'observing'}:s,v);
  // Mechanical stroke stops when the column primes. A torn diaphragm still moves.
  const strokeEnd=s.primeAt??C.primeDuration,liftTime=Math.min(s.time,strokeEnd);
  let lift=v.fault===2?0:v.stroke*liftTime/C.primeDuration;
  if(s.time>strokeEnd)lift*=Math.max(0,1-(s.time-strokeEnd)/C.returnDuration);
  const balance=s.inlet-s.outlet-C.tankArea*(s.level-v.level)-s.pipe;
  return {...s,screen:t,screenDuration:trial.duration,flow:Math.max(0,flow.outlet),fill:Math.max(0,flow.inlet),lift,balance,
    valveOpening:v.fault===2?1:clamp((v.level-s.level)/C.closingBand,0,1),
    perFlush:trial.final.outlet*1000,perYear:trial.final.outlet*v.perDay*365,spill:spillLevel(v.bore),
    pipeCapacity:siphonStorage(s.level,v.bore),final:trial.final};
}

import {validateControls,validTime} from './physics-kit.js';

export const ACCELEROMETER_DEFAULTS=Object.freeze({experiment:0,power:1,axis:1,roll:0,pitch:0,support:0,amplitude:1,frequency:5,capacitor:0});
export const ACCELEROMETER_DOMAINS=Object.freeze(Object.fromEntries(Object.entries({experiment:[0,3,1],power:[0,1,1],axis:[0,2,1],roll:[-180,180,5],pitch:[-90,90,5],support:[0,2,1],amplitude:[-2,2,.25],frequency:[1,20,1],capacitor:[0,2,1]}).map(([k,v])=>[k,Object.freeze(v)])));
export const ACCELEROMETER_AXES=Object.freeze(['x','y','z']);
export const ACCELEROMETER_CAPACITORS=Object.freeze([.1,.47,4.7]); // microfarads
export const ACCELEROMETER_DURATION=6; // six scene seconds represent one second
const selfTest=Object.freeze([-.325/.3,.325/.3,.550/.3]);
const zero=()=>({x:0,y:0,z:0});
const clean=n=>Math.abs(n)<1e-12?0:n;
const copy=value=>structuredClone(value);

/** R = Rx(-pitch) Rz(roll); world +y is upward. Values are specific force in g. */
export function accelerometerForce(roll,pitch,support){
  if(!Number.isFinite(roll)||Math.abs(roll)>180||!Number.isFinite(pitch)||Math.abs(pitch)>90||![0,1,2].includes(support))throw new RangeError('Invalid accelerometer pose');
  const r=roll*Math.PI/180,p=pitch*Math.PI/180,m=[1,0,2][support];
  return {x:clean(m*Math.sin(r)*Math.cos(p)),y:clean(m*Math.cos(r)*Math.cos(p)),z:clean(m*Math.sin(p))};
}

/** Nominal external RC stage only; not the complete sensor transfer function. */
export function accelerometerFilter(capacitor,axis,frequency){
  if(![0,1,2].includes(capacitor)||![0,1,2].includes(axis)||!Number.isFinite(frequency)||frequency<0)throw new RangeError('Invalid accelerometer filter');
  const tau=32000*ACCELEROMETER_CAPACITORS[capacitor]*1e-6,cutoff=1/(2*Math.PI*tau),u=2*Math.PI*frequency*tau;
  return {tau,cutoff,gain:1/Math.hypot(1,u),lag:Math.atan(u)*180/Math.PI,noiseMg:(axis===2?.300:.150)*Math.sqrt(1.6*cutoff)};
}

/** Ideal differential plate analogy. Clearances and scale are illustrative. */
export function accelerometerCapacitance(force){
  if(!Number.isFinite(force)||Math.abs(force)>3)throw new RangeError('Outside the teaching force range');
  const displacement=-.04*force,negative=1/(1+displacement),positive=1/(1-displacement);
  return {displacement,negative,positive,difference:(positive-negative)/(positive+negative)};
}

function sample(v,t){
  const force=(v.experiment===0||v.experiment===3)?accelerometerForce(v.roll,v.pitch,v.experiment===3?0:v.support):zero();
  const equivalent={...force},filtered={...force},axis=ACCELEROMETER_AXES[v.axis],filter=accelerometerFilter(v.capacitor,v.axis,v.frequency);
  const since=Math.max(0,t-.1),step=t>=.1?1:0,settle=-Math.expm1(-since/filter.tau);
  if(v.experiment===1){force[axis]=v.amplitude*step;equivalent[axis]=force[axis];filtered[axis]=v.amplitude*settle;}
  if(v.experiment===2){
    const w=2*Math.PI*v.frequency,u=w*filter.tau;
    force[axis]=v.amplitude*Math.sin(w*t);equivalent[axis]=force[axis];
    filtered[axis]=v.amplitude*(Math.sin(w*t)-u*Math.cos(w*t)+u*Math.exp(-t/filter.tau))/(1+u*u);
  }
  if(v.experiment===3&&v.power)for(let i=0;i<3;i++){
    const key=ACCELEROMETER_AXES[i];equivalent[key]+=selfTest[i]*step;filtered[key]+=selfTest[i]*settle;
  }
  const voltage=Object.fromEntries(ACCELEROMETER_AXES.map(key=>[key,v.power?1.5+.3*filtered[key]:null]));
  return {force,equivalent,filtered,voltage,filter,capacitance:accelerometerCapacitance(equivalent[axis])};
}

export function accelerometerPlan(input={},sceneTime=0){
  const values=validateControls(input,ACCELEROMETER_DEFAULTS,ACCELEROMETER_DOMAINS,'accelerometer'),clock=Math.min(validTime(sceneTime),ACCELEROMETER_DURATION),time=Number((clock/ACCELEROMETER_DURATION).toFixed(12));
  const current=sample(values,time),axis=ACCELEROMETER_AXES[values.axis];
  const trace=Array.from({length:201},(_,i)=>{const t=time*i/200,s=sample(values,t);return {t,input:s.equivalent[axis],output:s.filtered[axis]};});
  const powered=Boolean(values.power),complete=clock>=ACCELEROMETER_DURATION;
  const phase=!powered?'Electronic readout off':values.experiment===0?complete?'Steady record complete':clock===0?'Steady specific force':'Recording steady force':clock===0?'Ready to record':time<.1&&values.experiment!==2?'Waiting for the input step':complete?'Record complete':'Recording response';
  return {values,clock,time,complete:complete||!powered,blocked:!powered,phase,...current,trace,
    carrier:powered?(Math.floor(clock*4)%2? -1:1):0,
    tiltValid:values.experiment===0&&values.support===0,
    displacement:Object.fromEntries(ACCELEROMETER_AXES.map(key=>[key,-.045*current.equivalent[key]]))};
}

export function createAccelerometerController(initial={}){
  let values,clock,origin;
  function reset(next={}){
    if(!next||typeof next!=='object'||Array.isArray(next))throw new TypeError('Expected accelerometer initial state');
    for(const key of Object.keys(next))if(!['settings','time'].includes(key))throw new RangeError(`Unknown initial field ${key}`);
    const plan=accelerometerPlan(next.settings??{},next.time??0);
    values=plan.values;clock=plan.clock;origin={settings:{...values},time:0};return getState();
  }
  function update(changes={}){
    const next=validateControls(changes,values,ACCELEROMETER_DOMAINS,'accelerometer');
    if(Object.keys(next).some(key=>next[key]!==values[key])){clock=0;origin={settings:{...next},time:0};}
    values=next;return getState();
  }
  function advance(dt){validTime(dt);if(values.power)clock=Math.min(ACCELEROMETER_DURATION,Number((clock+dt).toFixed(12)));return getState();}
  function getState(){return accelerometerPlan(values,clock);}
  reset(initial);return {reset,update,advance,getState,replayState:()=>copy(origin)};
}

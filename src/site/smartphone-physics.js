import {validateControls, validTime} from './physics-kit.js';

// Generic teaching phone. Times are scene seconds, not device latencies.
// Touch changes are constructed interpolation weights, not capacitances.
// The rotor follows an authored smooth motion, not a motor voltage model.
export const SMARTPHONE_DEFAULTS=Object.freeze({scenario:0,power:1,touchX:2,touchY:3,contact:1,roll:0,pitch:0,support:0,speed:1,balance:0,network:1});
export const SMARTPHONE_DOMAINS=Object.freeze(Object.fromEntries(Object.entries({scenario:[0,3,1],power:[0,1,1],touchX:[0,4,.5],touchY:[0,6,.5],contact:[0,1,1],roll:[0,90,5],pitch:[0,90,5],support:[0,2,1],speed:[1,2,1],balance:[0,1,1],network:[0,1,1]}).map(([key,range])=>[key,Object.freeze(range)])));
export const SMARTPHONE_DURATIONS=Object.freeze([3.6,2.4,4,6.4]);
export const VOICE_STAGES=Object.freeze(['Network sends incoming voice','Antenna receives radio','Modem recovers digital information','Audio circuit drives the speaker','Microphone senses your reply','Audio circuit encodes the reply','Modem prepares the radio signal','Antenna sends the reply','Reply reaches the network']);
const relevant=[['touchX','touchY','contact'],['roll','pitch','support'],['speed','balance'],['network']];
const clone=value=>structuredClone(value);
const clean=value=>Math.abs(value)<1e-12?0:value;
const finishTime=(time,duration)=>Math.min(Number(validTime(time).toFixed(12)),duration);

/** A synthetic row/column response for showing interpolation, in grid units. */
export function smartphoneTouch(x,y,contact=true){
  if(!Number.isFinite(x)||x<0||x>4||!Number.isFinite(y)||y<0||y>6||typeof contact!=='boolean')throw new RangeError('Invalid teaching touch');
  const changes=Array.from({length:35},(_,i)=>contact?Math.max(0,1-Math.abs(i%5-x))*Math.max(0,1-Math.abs(Math.floor(i/5)-y)):0);
  const total=changes.reduce((sum,n)=>sum+n,0);
  const estimate=total?{x:changes.reduce((sum,n,i)=>sum+n*(i%5),0)/total,y:changes.reduce((sum,n,i)=>sum+n*Math.floor(i/5),0)/total}:null;
  return {changes,total,estimate};
}

/** Specific force in phone axes. R = Rx(-pitch) Rz(roll), world +y upward.
 *  support: held steady, free fall, or upward acceleration of one g.
 *  This is a quasi-static reference, not a vibrating phone sensor prediction.
 */
export function smartphoneSpecificForce(roll,pitch,support){
  if(![roll,pitch].every(n=>Number.isFinite(n)&&n>=0&&n<=90)||![0,1,2].includes(support))throw new RangeError('Invalid phone pose');
  const r=roll*Math.PI/180,p=pitch*Math.PI/180,magnitude=[1,0,2][support];
  return {x:clean(magnitude*Math.sin(r)*Math.cos(p)),y:clean(magnitude*Math.cos(r)*Math.cos(p)),z:clean(magnitude*Math.sin(p))};
}

/** Example software policy, not an operating system algorithm.
 *  Keep history without a usable steady gravity projection; use a dead band.
 */
export function smartphoneOrientation(force,previous,support){
  if(![0,1].includes(previous)||![0,1,2].includes(support)||!force||!['x','y','z'].every(k=>Number.isFinite(force[k])))throw new RangeError('Invalid orientation input');
  if(support!==0||Math.hypot(force.x,force.y)<.3)return {value:previous,reason:'Keep previous orientation: no steady in-screen gravity direction'};
  const difference=Math.abs(force.x)-Math.abs(force.y);
  if(difference>.2)return {value:1,reason:'Landscape: gravity projects mostly along the short edge'};
  if(difference<-.2)return {value:0,reason:'Portrait: gravity projects mostly along the long edge'};
  return {value:previous,reason:'Keep previous orientation: within the teaching dead band'};
}

/** Smooth four-scene-second rotor trial. No product speed or force is inferred.
 *  Reaction per m*r: ω² e_r - α e_t, including the tangential start/stop term.
 *  Relative force uses the slower trial's midpoint radial force as reference.
 *  Body motion is the exaggerated center-of-mass counterpart of the rotor.
 */
export function smartphoneRotor(time,speed=1,balanced=false){
  validTime(time);if(![1,2].includes(speed)||typeof balanced!=='boolean')throw new RangeError('Invalid rotor trial');
  const t=Math.min(time,4),u=Math.PI*t/2;
  const angle=2*Math.PI*speed*(t-2/Math.PI*Math.sin(u));
  const running=t>0&&t<4;
  const omega=running?2*Math.PI*speed*(1-Math.cos(u)):0;
  const alpha=running?Math.PI*Math.PI*speed*Math.sin(u):0;
  const cosine=Math.cos(angle),sine=Math.sin(angle),offset=balanced?0:1;
  const reaction={x:clean(offset*(omega*omega*cosine+alpha*sine)),y:clean(offset*(omega*omega*sine-alpha*cosine))};
  const reference=(4*Math.PI)**2;
  return {angle,omega,alpha,running,offset,reaction,relativeForce:Math.hypot(reaction.x,reaction.y)/reference,peakRadialRatio:offset*speed**2,
    body:{x:clean(offset*.03*(1-cosine)),y:clean(-offset*.03*sine)},weight:{x:offset*cosine,y:offset*sine}};
}

function initialValues(initial){
  if(!initial||typeof initial!=='object'||Array.isArray(initial))throw new TypeError('Expected smartphone initial state');
  for(const key of Object.keys(initial))if(!['settings','time','orientation','registered'].includes(key))throw new RangeError(`Unknown initial field ${key}`);
  const values=validateControls(initial.settings===undefined?{}:initial.settings,SMARTPHONE_DEFAULTS,SMARTPHONE_DOMAINS,'smartphone experiment');
  const clock=finishTime(initial.time===undefined?0:initial.time,SMARTPHONE_DURATIONS[values.scenario]);
  const orientation=initial.orientation===undefined?0:initial.orientation,registered=initial.registered??null;
  if(![0,1].includes(orientation))throw new RangeError('Invalid saved orientation');
  if(registered!==null&&(!registered||typeof registered!=='object'||Array.isArray(registered)||Object.keys(registered).sort().join(',')!=='x,y'||!Number.isFinite(registered.x)||registered.x<0||registered.x>4||!Number.isFinite(registered.y)||registered.y<0||registered.y>6))throw new RangeError('Invalid saved touch');
  return {values,clock,orientation,registered:clone(registered)};
}

export function createSmartphoneController(initial={}){
  let values,clock,orientation,registered,origin;
  const blocked=()=>!values.power||(values.scenario===3&&!values.network);
  function settle(){
    if(blocked()||clock<SMARTPHONE_DURATIONS[values.scenario])return;
    if(values.scenario===0)registered=smartphoneTouch(values.touchX,values.touchY,Boolean(values.contact)).estimate;
    if(values.scenario===1)orientation=smartphoneOrientation(smartphoneSpecificForce(values.roll,values.pitch,values.support),orientation,values.support).value;
  }
  function reset(next={}){
    const valid=initialValues(next);
    values=valid.values;clock=valid.clock;orientation=valid.orientation;registered=valid.registered;
    origin={settings:{...values},orientation,registered:clone(registered),time:0};settle();return getState();
  }
  function update(changes={}){
    const next=validateControls(changes,values,SMARTPHONE_DOMAINS,'smartphone experiment');
    const restart=['scenario','power',...relevant[next.scenario]].some(key=>next[key]!==values[key]);
    values=next;
    if(restart){clock=0;origin={settings:{...values},orientation,registered:clone(registered),time:0};}
    else origin.settings={...values};
    return getState();
  }
  function advance(dt){validTime(dt);if(!blocked())clock=finishTime(clock+dt,SMARTPHONE_DURATIONS[values.scenario]);settle();return getState();}
  function getState(){
    const duration=SMARTPHONE_DURATIONS[values.scenario],isBlocked=blocked(),complete=isBlocked||clock>=duration;
    const touch=smartphoneTouch(values.touchX,values.touchY,Boolean(values.contact));
    const force=smartphoneSpecificForce(values.roll,values.pitch,values.support);
    const candidate=smartphoneOrientation(force,orientation,values.support);
    const scanning=values.power&&values.scenario===0&&clock<2.8;
    const scannedRows=values.power&&values.scenario===0?Math.min(7,Math.floor(Number((clock/.4).toFixed(10)))):0;
    const activeRow=scanning?Math.min(6,scannedRows):-1;
    const motor=smartphoneRotor(values.power&&values.scenario===2?clock:0,values.speed,Boolean(values.balance));
    const voiceStage=values.scenario===3&&!isBlocked?Math.min(8,Math.floor(Number((clock/.8).toFixed(10)))):-1;
    let result,phase;
    if(!values.power){result='Phone powered off';phase='Electronic controls need battery power';}
    else if(values.scenario===0){
      phase=clock<2.8?`Scan row ${activeRow+1} of 7`:clock<3.2?'Controller combines the readings':clock<3.6?'Update the display':'Touch scan complete';
      result=clock<3.6?phase:registered?`Touch registered at ${registered.x+1}, ${registered.y+1}`:'No touch registered';
    }else if(values.scenario===1){
      phase=clock<.8?'Read the three sensor axes':clock<1.6?'Check the gravity projection':clock<2.4?'Choose the screen orientation':'Orientation check complete';
      result=clock<2.4?phase:`${orientation?'Landscape':'Portrait'} retained on screen`;
    }else if(values.scenario===2){
      phase=clock===0?'Ready to run the rotor':clock<4?'Rotor turning':'Rotor stopped';
      result=clock===0?'Ready to compare a rotating weight':clock>=4?values.balance?'Balanced rotor: no rotating unbalance':'Offset rotor: force changed direction as it turned':values.balance?'Rotor turns; mass stays centered':'Offset mass pushes and pulls the frame';
    }else{
      phase=isBlocked?'No network path':VOICE_STAGES[voiceStage];result=isBlocked?'Voice cannot reach the network':phase;
    }
    return {values:{...values},clock,duration,orientation,registered:clone(registered),now:{result,phase,complete,blocked:isBlocked,progress:clock/duration,displayOn:Boolean(values.power),touch,force,candidate,activeRow,scannedRows,motor,voiceStage,voiceDelivered:voiceStage===8,speakerActive:voiceStage===3,microphoneActive:voiceStage===4}};
  }
  reset(initial);return {reset,update,advance,getState,replayState:()=>clone(origin)};
}

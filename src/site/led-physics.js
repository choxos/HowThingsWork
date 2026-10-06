import {LEDS,seriesDiode,DECLARED,CHARGE,PLANCK,LIGHT} from './remote-physics.js';

export const LED_DEFAULTS=Object.freeze({voltage:3,resistance:15,emitter:0,drive:1,distance:1,closed:1});
export const LED_DOMAINS=Object.freeze({voltage:[0,3.3,.1],resistance:[15,330,5],emitter:[0,2,1],drive:[0,1,1],distance:[.1,2,.1],closed:[0,1,1]});
export const LED_EXPERIMENT=Object.freeze({duration:12,slowdown:19000,frequency:38000,duty:1/3,sourceResistance:.45,infraredEfficiency:8/27});

function settings(input={},base=LED_DEFAULTS){
  if(!input||typeof input!=='object'||Array.isArray(input))throw new TypeError('LED settings must be an object');
  const next={...base};
  for(const [key,value] of Object.entries(input)){
    const domain=LED_DOMAINS[key];if(!domain)throw new RangeError(`Unknown LED setting: ${key}`);
    const [min,max,step]=domain,n=(value-min)/step;
    if(!Number.isFinite(value)||value<min||value>max||Math.abs(n-Math.round(n))>1e-7)throw new RangeError(`Invalid LED setting: ${key}`);
    next[key]=value;
  }
  return next;
}

export function ledCircuit(input={}){
  const values=settings(input),device=LEDS[values.emitter],sheet=device.sheet;
  const solved=values.closed?seriesDiode(device.IS,DECLARED.ideality,device.RS+values.resistance+LED_EXPERIMENT.sourceResistance,values.voltage):{junction:0,current:0};
  const current=solved.current,voltage=solved.junction+current*device.RS,ledPower=current*voltage;
  const infrared=values.emitter===0,photonEnergy=PLANCK*LIGHT/(sheet.peak*1e-9);
  // One-point optical scaling is assigned; the sheets do not give these full curves.
  const radiantPower=infrared?ledPower*LED_EXPERIMENT.infraredEfficiency:null;
  const intensity=infrared?.072*radiantPower/.04:.010*current/.010;
  const target=intensity/values.distance**2,duty=values.drive?LED_EXPERIMENT.duty:1;
  return {values,device:sheet.name,wavelength:sheet.peak,infrared,current,voltage,junctionVoltage:solved.junction,
    resistorVoltage:current*values.resistance,sourceDrop:current*LED_EXPERIMENT.sourceResistance,switchVoltage:values.closed?0:values.voltage,
    ledPower,resistorPower:current**2*values.resistance,sourceLoss:current**2*LED_EXPERIMENT.sourceResistance,sourcePower:values.voltage*current,
    radiantPower,nonRadiantPower:infrared?ledPower-radiantPower:null,photonEnergy,photonEv:photonEnergy/CHARGE,
    photonsPerSecond:infrared?radiantPower/photonEnergy:null,externalQuantumEfficiency:infrared&&current>0?radiantPower/photonEnergy/(current/CHARGE):null,
    intensity,target,duty,meanCurrent:current*duty,meanTarget:target*duty,dcLimit:sheet.ifMax,aboveDcRating:current>sheet.ifMax*(1+1e-12)};
}

export function ledOnTime(screenTime,drive){
  if(!Number.isFinite(screenTime)||screenTime<0||screenTime>LED_EXPERIMENT.duration||![0,1].includes(drive))throw new RangeError('Invalid LED integration time or drive');
  if(!drive)return screenTime/LED_EXPERIMENT.slowdown;
  const cycles=screenTime*2,whole=Math.floor(cycles),fraction=cycles-whole;
  return (whole*LED_EXPERIMENT.duty+Math.min(fraction,LED_EXPERIMENT.duty))/LED_EXPERIMENT.frequency;
}

export function createLedController(initial={}){
  let plan,clock=0,replay;
  function reset(input={}){
    if(!input||typeof input!=='object'||Array.isArray(input)||Object.keys(input).some(k=>!['settings','time'].includes(k)))throw new TypeError('Invalid LED initial state');
    const next=ledCircuit(input.settings??{}),time=input.time??0;
    if(!Number.isFinite(time)||time<0||time>LED_EXPERIMENT.duration)throw new RangeError('Invalid LED initial time');
    plan=next;clock=time;replay={settings:{...plan.values},time};return getState();
  }
  function update(input={}){
    const next=ledCircuit(settings(input,plan.values));
    if(Object.keys(next.values).some(k=>next.values[k]!==plan.values[k])){plan=next;clock=0;replay={settings:{...plan.values},time:0};}
    return getState();
  }
  function getState(){
    const complete=clock>=LED_EXPERIMENT.duration;
    let phase=(clock*2)%1;
    if(phase<1e-12||1-phase<1e-12)phase=0;
    if(Math.abs(phase-LED_EXPERIMENT.duty)<1e-12)phase=LED_EXPERIMENT.duty;
    const gate=plan.values.closed&&(!plan.values.drive||phase<LED_EXPERIMENT.duty),onTime=ledOnTime(clock,plan.values.drive)*(plan.values.closed?1:0);
    const status=!plan.values.closed?'Open circuit: no emission':plan.current===0?'Zero drive: no net emission':plan.infrared?'Infrared output: invisible to your eyes':`${plan.values.emitter===1?'Red':'Yellow'} light reaches the target`;
    return {...plan,values:{...plan.values},time:clock,realTime:clock/LED_EXPERIMENT.slowdown,onTime,complete,gate,phase,status,
      instantaneousCurrent:gate?plan.current:0,instantaneousTarget:gate?plan.target:0,
      charge:plan.current*onTime,ledEnergy:plan.ledPower*onTime,sourceEnergy:plan.sourcePower*onTime,resistorEnergy:plan.resistorPower*onTime,sourceLossEnergy:plan.sourceLoss*onTime,
      opticalEnergy:plan.infrared?plan.radiantPower*onTime:null,nonRadiantEnergy:plan.infrared?plan.nonRadiantPower*onTime:null,
      photons:plan.infrared?plan.photonsPerSecond*onTime:null,exposure:plan.target*onTime};
  }
  function advance(seconds){
    if(!Number.isFinite(seconds)||seconds<0)throw new RangeError('LED time step must be nonnegative and finite');
    clock=Math.min(LED_EXPERIMENT.duration,clock+seconds);if(LED_EXPERIMENT.duration-clock<1e-12)clock=LED_EXPERIMENT.duration;return getState();
  }
  reset(initial);return {getState,update,reset,advance,replayState:()=>({...replay,settings:{...replay.settings}})};
}

export function formatLedQuantity(value,unit){
  if(value===null)return 'Not inferred';
  if(value===0)return `0 ${unit}`;
  const magnitude=Math.abs(value),[factor,prefix]=magnitude<1e-9?[1e12,'p']:magnitude<1e-6?[1e9,'n']:magnitude<1e-3?[1e6,'μ']:magnitude<1?[1e3,'m']:[1,''];
  return `${(value*factor).toPrecision(3)} ${prefix}${unit}`;
}

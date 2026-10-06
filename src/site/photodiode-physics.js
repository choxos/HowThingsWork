export const PHOTODIODE_DEFAULTS=Object.freeze({distance:5,intensity:76,background:0,blocked:0,drive:1,mode:0});
export const PHOTODIODE_DOMAINS=Object.freeze({distance:[1,30,1],intensity:[0,150,2],background:[0,2,.1],blocked:[0,1,1],drive:[0,1,1],mode:[0,2,1]});
export const PHOTODIODE_EXPERIMENT=Object.freeze({duration:12,slowdown:19000,frequency:38000,duty:1/3,wavelength:950,area:7.5e-6,reverse:5,dark:2e-9,capacitance:70e-12,reverseCoefficient:(50e-6-2e-9)/10,zeroCoefficient:4.7e-6,charge:1.602176634e-19,planck:6.62607015e-34,light:299792458});
const E=PHOTODIODE_EXPERIMENT;
// Effective exponential matched to one typical Voc point, not a measured I–V curve.
export const PHOTODIODE_VOLTAGE_SCALE=.350/Math.log1p(47e-6/E.dark);

function settings(input={},base=PHOTODIODE_DEFAULTS){
  if(!input||typeof input!=='object'||Array.isArray(input))throw new TypeError('Photodiode settings must be an object');
  const next={...base};
  for(const [key,value] of Object.entries(input)){
    const domain=PHOTODIODE_DOMAINS[key];if(!domain)throw new RangeError(`Unknown photodiode setting: ${key}`);
    const [min,max,step]=domain,n=(value-min)/step;
    if(!Number.isFinite(value)||value<min||value>max||Math.abs(n-Math.round(n))>1e-7)throw new RangeError(`Invalid photodiode setting: ${key}`);
    next[key]=value;
  }
  return next;
}

export function photodiodeCircuit(input={}){
  const values=settings(input),coefficient=values.mode===0?E.reverseCoefficient:E.zeroCoefficient;
  const directIrradiance=values.blocked?0:values.intensity*.001/values.distance**2,backgroundIrradiance=values.background*.001;
  const signalCurrent=coefficient*directIrradiance,backgroundCurrent=coefficient*backgroundIrradiance,darkCurrent=values.mode===0?E.dark:0,duty=values.drive?E.duty:1;
  const photonEnergy=E.planck*E.light/(E.wavelength*1e-9),responsivity=coefficient/E.area;
  return {values,coefficient,responsivity,photonEnergy,photonEv:photonEnergy/E.charge,quantumEfficiency:responsivity*photonEnergy/E.charge,
    directIrradiance,backgroundIrradiance,signalCurrent,backgroundCurrent,darkCurrent,duty,
    meanPhotoCurrent:signalCurrent*duty+backgroundCurrent,onPhotoCurrent:signalCurrent+backgroundCurrent,
    meanExternalCurrent:values.mode===2?0:signalCurrent*duty+backgroundCurrent+darkCurrent,
    steadyOpenVoltage:PHOTODIODE_VOLTAGE_SCALE*Math.log1p(E.zeroCoefficient*(directIrradiance+backgroundIrradiance)/E.dark)};
}

export function photodiodeOnTime(screenTime,drive){
  if(!Number.isFinite(screenTime)||screenTime<0||screenTime>E.duration||![0,1].includes(drive))throw new RangeError('Invalid photodiode integration time or drive');
  if(!drive)return screenTime/E.slowdown;
  const cycles=screenTime*2,whole=Math.floor(cycles),fraction=cycles-whole;
  return (whole*E.duty+Math.min(fraction,E.duty))/E.frequency;
}

export function photodiodeDiodeCurrent(voltage){return E.dark*Math.expm1(voltage/PHOTODIODE_VOLTAGE_SCALE);}

export function advancePhotovoltage(voltage,photocurrent,seconds){
  if(!Number.isFinite(voltage)||voltage<0||!Number.isFinite(photocurrent)||photocurrent<0||!Number.isFinite(seconds)||seconds<0)throw new RangeError('Invalid photovoltage interval');
  if(seconds===0)return voltage;
  const a=PHOTODIODE_VOLTAGE_SCALE,total=photocurrent+E.dark,u0=Math.exp(-voltage/a),equilibrium=E.dark/total;
  const u=equilibrium+(u0-equilibrium)*Math.exp(-total*seconds/(a*E.capacitance));
  return Math.max(0,-a*Math.log(u));
}

export function photodiodeSample(plan,screenTime,initialVoltage=0){
  const onTime=photodiodeOnTime(screenTime,plan.values.drive),realTime=screenTime/E.slowdown;
  let phase=(screenTime*2)%1;
  if(phase<1e-12||1-phase<1e-12)phase=0;
  if(Math.abs(phase-E.duty)<1e-12)phase=E.duty;
  const gate=!plan.values.drive||phase<E.duty,photoCurrent=plan.backgroundCurrent+(gate?plan.signalCurrent:0);
  const photoCharge=plan.signalCurrent*onTime+plan.backgroundCurrent*realTime;
  let voltage=plan.values.mode===0?-E.reverse:0;
  if(plan.values.mode===2){
    voltage=initialVoltage;
    if(!plan.values.drive)voltage=advancePhotovoltage(voltage,plan.onPhotoCurrent,realTime);
    else{
      const cycles=screenTime*2,whole=Math.floor(cycles),fraction=cycles-whole;
      for(let i=0;i<whole;i++){
        voltage=advancePhotovoltage(voltage,plan.onPhotoCurrent,E.duty/E.frequency);
        voltage=advancePhotovoltage(voltage,plan.backgroundCurrent,(1-E.duty)/E.frequency);
      }
      voltage=advancePhotovoltage(voltage,plan.onPhotoCurrent,Math.min(fraction,E.duty)/E.frequency);
      if(fraction>E.duty)voltage=advancePhotovoltage(voltage,plan.backgroundCurrent,(fraction-E.duty)/E.frequency);
    }
  }
  const open=plan.values.mode===2,externalCurrent=open?0:photoCurrent+plan.darkCurrent;
  const capacitorChargeChange=open?E.capacitance*(voltage-initialVoltage):0;
  const incidentEnergy=E.area*(plan.directIrradiance*onTime+plan.backgroundIrradiance*realTime);
  return {time:screenTime,realTime,onTime,phase,gate,photoCurrent,externalCurrent,voltage,photoCharge,capacitorChargeChange,
    externalCharge:open?0:photoCharge+plan.darkCurrent*realTime,internalDiodeCharge:open?photoCharge-capacitorChargeChange:0,
    capacitorCurrent:open?photoCurrent-photodiodeDiodeCurrent(voltage):0,capacitorEnergy:open?.5*E.capacitance*voltage**2:0,
    incidentEnergy,incidentPhotons:incidentEnergy/plan.photonEnergy,collectedPairEquivalents:photoCharge/E.charge,
    shotNoiseDensity:plan.values.mode===0?Math.sqrt(2*E.charge*(plan.darkCurrent+photoCurrent)):null};
}

export function createPhotodiodeController(initial={}){
  let plan,clock=0,initialVoltage=0,replay;
  function reset(input={}){
    if(!input||typeof input!=='object'||Array.isArray(input)||Object.keys(input).some(k=>!['settings','time','initialVoltage'].includes(k)))throw new TypeError('Invalid photodiode initial state');
    const next=photodiodeCircuit(input.settings??{}),time=input.time??0,voltage=input.initialVoltage??0;
    if(!Number.isFinite(time)||time<0||time>E.duration)throw new RangeError('Invalid photodiode initial time');
    if(!Number.isFinite(voltage)||voltage<0||voltage>.35||(next.values.mode!==2&&voltage!==0))throw new RangeError('Invalid photodiode initial voltage');
    plan=next;clock=time;initialVoltage=voltage;replay={settings:{...plan.values},time,initialVoltage};return getState();
  }
  function update(input={}){
    const next=photodiodeCircuit(settings(input,plan.values));
    if(Object.keys(next.values).some(k=>next.values[k]!==plan.values[k])){plan=next;clock=0;initialVoltage=0;replay={settings:{...plan.values},time:0,initialVoltage:0};}
    return getState();
  }
  function getState(){
    const sample=photodiodeSample(plan,clock,initialVoltage),open=plan.values.mode===2;
    const status=open?(sample.capacitorCurrent<0?'Stored charge relaxes inside the diode':plan.onPhotoCurrent>0?'Light builds voltage; external current stays zero':'No light and no stored voltage'):
      plan.values.mode===1?(plan.onPhotoCurrent>0?'Light drives current without an external bias':'Zero-bias short: no net dark current'):
      plan.signalCurrent>0?(plan.signalCurrent<E.dark?'Pulse signal is smaller than the dark baseline':'Light adds photocurrent to the dark baseline'):
      plan.backgroundCurrent>0?'Direct beam blocked or off; background still generates current':'Dark current remains with no incoming light';
    return {...plan,values:{...plan.values},...sample,initialVoltage,complete:clock>=E.duration,status};
  }
  function advance(seconds){
    if(!Number.isFinite(seconds)||seconds<0)throw new RangeError('Photodiode time step must be nonnegative and finite');
    clock=Math.min(E.duration,clock+seconds);if(E.duration-clock<1e-12)clock=E.duration;return getState();
  }
  reset(initial);return {getState,reset,update,advance,replayState:()=>({...replay,settings:{...replay.settings}})};
}

export function formatPhotodiodeQuantity(value,unit){
  if(value===null)return 'Not inferred';
  if(value===0)return `0 ${unit}`;
  const magnitude=Math.abs(value),[factor,prefix]=magnitude<1e-12?[1e15,'f']:magnitude<1e-9?[1e12,'p']:magnitude<1e-6?[1e9,'n']:magnitude<1e-3?[1e6,'μ']:magnitude<1?[1e3,'m']:[1,''];
  return `${(value*factor).toPrecision(3)} ${prefix}${unit}`;
}

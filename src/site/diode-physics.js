import {diodeAt, diodeVoltageAt, seriesDiode, SPICE_1N4148} from './remote-physics.js';

export const DIODE_DEFAULTS = Object.freeze({voltage:6, resistance:220, orientation:1, closed:1});
export const DIODE_DOMAINS = Object.freeze({voltage:[-20,20,.01], resistance:[220,2200,10], orientation:[-1,1,2], closed:[0,1,1]});
export const LOAD = Object.freeze({ambient:25, capacity:.12, thermalResistance:80, duration:12});
const device=SPICE_1N4148;

function settings(input={}, base=DIODE_DEFAULTS) {
  if(!input||typeof input!=='object'||Array.isArray(input))throw new TypeError('Diode settings must be an object');
  const next={...base};
  for(const [key,value] of Object.entries(input)) {
    const domain=DIODE_DOMAINS[key];
    if(!domain)throw new RangeError(`Unknown diode setting: ${key}`);
    const [min,max,step]=domain,steps=(value-min)/step;
    if(!Number.isFinite(value)||value<min||value>max||Math.abs(steps-Math.round(steps))>1e-7)throw new RangeError(`Invalid diode setting: ${key}`);
    next[key]=value;
  }
  return next;
}

export function diodeCurve(voltage) {
  if(!Number.isFinite(voltage)||voltage< -20||voltage>1)throw new RangeError('Diode curve voltage must be between -20 and 1 V');
  return diodeAt(voltage);
}

export function supplyForDiode(voltage,resistance=220) {
  const value=voltage+diodeCurve(voltage).current*resistance;
  return Math.round(value*100)/100;
}
export const TEN_MILLIAMP_VOLTAGE=diodeVoltageAt(.01);

export function diodeCircuit(input={}) {
  const values=settings(input),u=values.orientation*values.voltage,r=values.resistance;
  // R1 is parallel to the complete diode branch, including its internal RS.
  const a=1+r/device.R1,b=device.RS+r/a;
  const junction=values.closed?seriesDiode(device.IS,device.N,b,u/a):{junction:0,current:0};
  const diodeVoltage=junction.junction+device.RS*junction.current;
  const leak=diodeVoltage/device.R1,diodeCurrent=junction.current+leak;
  const current=values.orientation*diodeCurrent,loadVoltage=current*r;
  const power=current*current*r,diodePower=diodeVoltage*diodeCurrent,sourcePower=values.voltage*current;
  const bias=diodeVoltage>1e-9?'Forward bias':diodeVoltage< -1e-9?'Reverse bias':'Zero bias';
  return {values,current,diodeCurrent,diodeVoltage,junctionVoltage:junction.junction,junctionCurrent:junction.current,leak,loadVoltage,power,diodePower,sourcePower,bias,
    switchVoltage:values.closed?0:values.voltage,
    // A qualitative width cue only. This is not a fitted 1N4148 dimension.
    depletionCue:Math.sqrt(Math.max(.02,1-junction.junction/.9))};
}

export function thermalState(power,initialTemperature,time) {
  if(!Number.isFinite(power)||power<0||!Number.isFinite(initialTemperature)||initialTemperature<LOAD.ambient||initialTemperature>200||!Number.isFinite(time)||time<0)throw new RangeError('Invalid load thermal state');
  const initialRise=initialTemperature-LOAD.ambient,tau=LOAD.capacity*LOAD.thermalResistance;
  const rise=initialRise+(power*LOAD.thermalResistance-initialRise)*(-Math.expm1(-time/tau));
  const temperature=LOAD.ambient+rise,energyIn=power*time,stored=LOAD.capacity*rise;
  return {temperature,energyIn,stored,energyOut:energyIn+LOAD.capacity*initialRise-stored};
}

export function createDiodeController(initial={}) {
  let plan,clock=0,startTemperature=LOAD.ambient,replay;
  function reset(input={}) {
    if(!input||typeof input!=='object'||Array.isArray(input)||Object.keys(input).some(key=>!['settings','time','temperature'].includes(key)))throw new TypeError('Invalid diode initial state');
    const next=diodeCircuit(input.settings??{}),time=input.time??0,temperature=input.temperature??LOAD.ambient;
    if(!Number.isFinite(time)||time<0||time>LOAD.duration)throw new RangeError('Invalid diode initial time');
    thermalState(next.power,temperature,time);
    plan=next;clock=time;startTemperature=temperature;replay={settings:{...plan.values},time,temperature};return getState();
  }
  function update(input={}) {
    const next=diodeCircuit(settings(input,plan.values));
    if(Object.keys(next.values).some(key=>next.values[key]!==plan.values[key])) {
      startTemperature=thermalState(plan.power,startTemperature,clock).temperature;clock=0;plan=next;
      replay={settings:{...plan.values},time:0,temperature:startTemperature};
    }
    return getState();
  }
  function getState() {
    const thermal=thermalState(plan.power,startTemperature,clock),complete=clock>=LOAD.duration;
    const status=!plan.values.closed?'Open switch: no circuit current':plan.bias==='Zero bias'?'Balanced junction: zero net current':plan.bias==='Reverse bias'?'Reverse leakage: almost no load power':'Forward conduction: the load receives power';
    const phase=complete?'Comparison complete':clock<2?'Follow the closed circuit':clock<5?'Inspect the diode bias':clock<8?'Compare the current':'Watch the load temperature';
    return {...plan,values:{...plan.values},...thermal,time:clock,complete,status,phase,startTemperature,charge:plan.current*clock};
  }
  function advance(seconds) {
    if(!Number.isFinite(seconds)||seconds<0)throw new RangeError('Diode time step must be nonnegative and finite');
    clock=Math.min(LOAD.duration,clock+seconds);if(LOAD.duration-clock<1e-12)clock=LOAD.duration;return getState();
  }
  reset(initial);
  return {getState,reset,update,advance,replayState:()=>({...replay,settings:{...replay.settings}})};
}

export function formatDiodeCurrent(current) {
  const sign=current<0?'−':'',magnitude=Math.abs(current);
  if(magnitude===0)return '0 A';
  const [scale,unit]=magnitude<1e-6?[1e9,'nA']:magnitude<1e-3?[1e6,'μA']:[1e3,'mA'];
  return `${sign}${(magnitude*scale).toFixed(2)} ${unit}`;
}

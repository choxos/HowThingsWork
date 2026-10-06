import {validateControls} from './physics-kit.js';
import {BURGLAR_DEFAULTS, BURGLAR_DOMAINS, burglarPlan, burglarAt} from './burglar-alarm-physics.js';

export const PIR_KEYS=Object.freeze(['speed','range','contrast','warming','balance','power','sound','pace']);
export const PIR_DEFAULTS=Object.freeze(Object.fromEntries(PIR_KEYS.map(key=>[key,BURGLAR_DEFAULTS[key]])));
export const PIR_DOMAINS=Object.freeze(Object.fromEntries(PIR_KEYS.map(key=>[key,BURGLAR_DOMAINS[key]])));
export const pirValues=values=>Object.fromEntries(PIR_KEYS.map(key=>[key,values[key]]));

export function pirSettings(input={}){
  const values=validateControls(input,PIR_DEFAULTS,PIR_DOMAINS,'passive infrared detector');
  if(![0,1,10].includes(values.balance))throw new RangeError('Unsupported element mismatch');
  if(![.25,.5,1].includes(values.pace))throw new RangeError('Unsupported playback pace');
  return values;
}

export const pirSharedSettings=input=>({...BURGLAR_DEFAULTS,...pirSettings(input),mode:2});
export const pirPlan=(input=PIR_DEFAULTS,options={})=>burglarPlan(pirSharedSettings(input),options);
export const pirAt=(plan,time)=>{const state=burglarAt(plan,time);return {...state,values:pirValues(state.values)};};

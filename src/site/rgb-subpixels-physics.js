import {validateControls, clamp} from './physics-kit.js';
import {srgbDecode, srgbEncode} from './lcd-physics.js';
import {TFT_DEFAULTS, TFT_DOMAINS, createTftScreenController} from './tft-screen-physics.js';

export const RGB_DEFAULTS = Object.freeze({red:255, green:128, blue:0, gap:4, backlight:100, addressing:0});
export const RGB_DOMAINS = Object.freeze(Object.fromEntries(Object.keys(RGB_DEFAULTS).map(key => [key,TFT_DOMAINS[key]])));
export const RGB_PRIMARIES = Object.freeze([[.64,.33],[.30,.60],[.15,.06]].map(Object.freeze));
export const RGB_WHITE = Object.freeze([.3127,.3290]);
// D65 sRGB matrix from the ICC primaries; the rational form is also given by W3C CSS Color 4.
export const RGB_TO_XYZ = Object.freeze([
  [506752/1228815,87881/245763,12673/70218],
  [87098/409605,175762/245763,12673/175545],
  [7918/409605,87881/737289,1001167/1053270],
].map(Object.freeze));

export function rgbColorimetry(light) {
  if (!Array.isArray(light) || light.length!==3 || [0,1,2].some(i=>!Number.isFinite(light[i])||light[i]<0)) throw new RangeError('Expected three finite nonnegative linear-light values');
  const contributions=light.map((value,i)=>RGB_TO_XYZ.map(row=>row[i]*value));
  const xyz=RGB_TO_XYZ.map(row=>row.reduce((sum,value,i)=>sum+value*light[i],0));
  const sum=xyz.reduce((a,b)=>a+b,0), encoded=light.map(value=>srgbEncode(clamp(value)));
  return {light:light.slice(),xyz,xy:sum>0?[xyz[0]/sum,xyz[1]/sum]:null,luminance:xyz[1],contributions,
    encoded,hex:'#'+encoded.map(v=>Math.round(v*255).toString(16).padStart(2,'0')).join('').toUpperCase(),clipped:light.some(v=>v>1)};
}

export function rgbEncodingCurve() {
  return Array.from({length:256},(_,code)=>({code,linear:srgbDecode(code/255)}));
}

function completeSettings(values) {return {...TFT_DEFAULTS,...values,pattern:1,background:0};}
function settingsOnly(values) {return Object.fromEntries(Object.keys(RGB_DEFAULTS).map(key=>[key,values[key]]));}

export function createRgbSubpixelsController(initial={}) {
  const controller=createTftScreenController({settings:completeSettings(RGB_DEFAULTS)});
  function getState() {
    const s=controller.getState(),plan=controller.getPlan(),values=settingsOnly(s.values);
    return {...s,values,color:rgbColorimetry(s.center.illuminated),targetColor:rgbColorimetry(s.targetLight.map(v=>v*s.backlight)),
      targetLinear:plan.targetLinear.slice(),encodedFractions:[values.red,values.green,values.blue].map(v=>v/255)};
  }
  function reset(next={}) {
    if (!next||typeof next!=='object'||Array.isArray(next)) throw new TypeError('Expected RGB initial state');
    for(const key of Object.keys(next)) if(!['settings','time'].includes(key)) throw new RangeError(`Unknown RGB initial field ${key}`);
    const values=validateControls(next.settings??{},RGB_DEFAULTS,RGB_DOMAINS,'RGB subpixels');
    controller.reset({settings:completeSettings(values),time:next.time??0});return getState();
  }
  function update(changes={}) {
    const values=validateControls(changes,settingsOnly(controller.getState().values),RGB_DOMAINS,'RGB subpixels');
    controller.update(completeSettings(values));return getState();
  }
  function advance(dt) {controller.advance(dt);return getState();}
  reset(initial);
  return {getState,reset,update,advance,getPlan:controller.getPlan,
    replayState:()=>({settings:settingsOnly(controller.replayState().settings),time:0})};
}

import assert from 'node:assert/strict';
import {RGB_DEFAULTS,RGB_DOMAINS,RGB_PRIMARIES,RGB_WHITE,RGB_TO_XYZ,rgbColorimetry,rgbEncodingCurve,createRgbSubpixelsController} from './rgb-subpixels-physics.js';
import {TFT,TFT_DEFAULTS,TFT_FRAME,TFT_LINE,TFT_DURATION,tftRowStart,createTftScreenController} from './tft-screen-physics.js';
import {tally} from './model-check-kit.mjs';

const t=tally(),near=(a,b,why,tol=1e-12)=>t.near(a,b,tol,why);
const zero=rgbColorimetry([0,0,0]),white=rgbColorimetry([1,1,1]);
t.ok(zero.xy===null&&zero.luminance===0&&zero.hex==='#000000','Chromaticity is undefined at zero light');
white.xy.forEach((v,i)=>near(v,RGB_WHITE[i],'Equal unit channels make assigned D65'));
near(white.luminance,1,'Assigned white normalizes relative luminance');
for(let i=0;i<3;i++){
 const primary=rgbColorimetry([0,1,2].map(k=>k===i?1:0));
 primary.xy.forEach((v,k)=>near(v,RGB_PRIMARIES[i][k],'Primary matrix reconstructs assigned chromaticities'));
 near(primary.luminance,[.21263900587151036,.715168678767756,.07219231536073371][i],'Independent ICC luminance weight');
}
let colorCases=0;
for(const red of [0,.002,.01,.2,.5,1,1.25])for(const green of [0,.002,.01,.2,.5,1,1.25])for(const blue of [0,.002,.01,.2,.5,1,1.25]){
 const values=[red,green,blue],c=rgbColorimetry(values),half=rgbColorimetry(values.map(v=>v/2));colorCases++;
 for(let k=0;k<3;k++){
  near(c.xyz[k],c.contributions.reduce((sum,part)=>sum+part[k],0),'XYZ adds before chromaticity normalization');
  near(half.xyz[k],c.xyz[k]/2,'Dimming scales every tristimulus value');
 }
 if(c.xy)c.xy.forEach((v,k)=>near(half.xy[k],v,'Uniform dimming preserves chromaticity'));
 t.ok(c.clipped===values.some(v=>v>1),'Display clipping is reported separately from unbounded positive XYZ');
 t.ok(c.encoded.every(v=>v>=0&&v<=1)&&/^#[0-9A-F]{6}$/.test(c.hex),'Display encoding remains valid');
}
const curve=rgbEncodingCurve();
t.ok(curve.length===256&&curve.every((p,i)=>p.code===i),'All 8-bit codes occur in order');
for(let i=1;i<256;i++)t.ok(curve[i].linear>curve[i-1].linear,'Decoded light strictly increases across every code');
for(const [code,expected]of [[0,0],[10,.003035269835488375],[11,.003346535763899161],[128,.21586050011389926],[188,.5028864580325687],[255,1]])near(curve[code].linear,expected,'Known sRGB transfer values');
for(const bad of [[-1,0,0],[NaN,0,0],[Infinity,0,0],[1,2],[1,2,3,4],null,'rgb',Array(3)]){assert.throws(()=>rgbColorimetry(bad),RangeError);t.add();}
t.ok(Object.isFrozen(RGB_TO_XYZ)&&RGB_TO_XYZ.every(Object.isFrozen),'Color matrix cannot be modified');

const controller=createRgbSubpixelsController();let samples=0;
const pulse=(tftRowStart(135)+TFT_LINE/2)*TFT.slow;
for(const settings of [{}, {red:0,green:255,blue:0}, {red:0,green:0,blue:255}, {red:255,green:255,blue:255}, {red:0,green:0,blue:0}, {red:128,green:128,blue:128}, {red:188,green:188,blue:188}, {gap:3}, {gap:6}, {backlight:0}, {backlight:50}, {addressing:1}, {addressing:2}]){
 const full={...RGB_DEFAULTS,...settings};
 const parent=createTftScreenController({settings:{...TFT_DEFAULTS,...full,pattern:1,background:0}});
 for(const time of [0,pulse,5,TFT_DURATION]){
  controller.reset({settings:full,time});parent.reset({settings:{...TFT_DEFAULTS,...full,pattern:1,background:0},time});
  const s=controller.getState(),p=parent.getState();samples++;
  for(const key of ['center','directors','time','clock','done','scanRow','targetLight']){assert.deepEqual(s[key],p[key],`RGB preserves accepted parent ${key}`);t.add();}
  assert.deepEqual(s.values,full);t.add();
  t.ok(!('pattern'in s.values)&&!('background'in s.values),'Only meaningful single-pixel controls are exposed');
 }
}
controller.reset();const full=controller.advance(TFT_DURATION);
for(const backlight of [0,25,50,75,100]){
 controller.reset({settings:{backlight}});const s=controller.advance(TFT_DURATION);
 for(let i=0;i<3;i++){near(s.center.illuminated[i],full.center.illuminated[i]*backlight/100,'Backlight scales each visible aperture');near(s.center.held[i],full.center.held[i],'Backlight does not change held voltage');}
 near(s.color.luminance,full.color.luminance*backlight/100,'Backlight scales relative luminance');
 assert.deepEqual(s.directors,full.directors);t.add();
 t.ok(backlight===0?s.color.xy===null:s.color.xy.every((v,i)=>Math.abs(v-full.color.xy[i])<1e-12),'Only zero illumination has undefined chromaticity');
}
for(const addressing of [0,1,2]){
 controller.reset({settings:{addressing}});const s=controller.advance(TFT_DURATION);
 t.ok(s.center.writes===[12,1,0][addressing],'Addressing has actual causal write count');
 if(addressing<2)s.center.light.forEach((v,i)=>near(v,full.center.light[i],'Ideal hold preserves optical response'));
 else t.ok(s.center.held.every(v=>v===-5)&&s.center.light.every(v=>v<.01),'Disabled gates leave prepared black state');
}
for(const gap of [3,3.5,4,4.5,5,5.5,6]){
 controller.reset({settings:{gap}});const s=controller.advance(TFT_DURATION),p=controller.getPlan();
 t.ok(s.directors.every(d=>d.theta.length===81&&d.phi.length===81),'Every gap uses 80 physical director layers');
 s.targetLight.forEach((v,i)=>near(v,p.black[i]+p.targetLinear[i]*(1-p.black[i]),'Each gap recalibrates target voltage',3e-8));
}
controller.reset();for(let i=0;i<12;i++)controller.advance(TFT_FRAME*TFT.slow);
t.ok(controller.getState().done,'Twelve frame steps complete without a floating-point extra click');
controller.reset({settings:{green:188},time:pulse});t.ok(controller.getState().scanRow===135,'Prepared pulse selects common row');
const before=structuredClone(controller.getState());controller.update({});assert.deepEqual(controller.getState(),before);t.add();
controller.update({green:128});t.ok(controller.getState().clock===0,'Changed target restarts from known prepared state');
controller.advance(5);controller.reset(controller.replayState());t.ok(controller.getState().clock===0&&controller.getState().values.green===128,'Replay retains current settings and starts a new record');
const saved=JSON.stringify(controller.getState());
for(const fn of [()=>controller.update({pattern:1}),()=>controller.update({gap:4.1}),()=>controller.update({red:'255'}),()=>controller.advance(-1),()=>controller.advance(NaN),()=>controller.reset(null),()=>controller.reset({time:Infinity}),()=>controller.reset({settings:{red:0},time:-1}),()=>controller.reset({unknown:1})]){
 assert.throws(fn);t.add();t.ok(JSON.stringify(controller.getState())===saved,'Rejected inputs leave state untouched');
}
for(const [key,[lo,hi,step]]of Object.entries(RGB_DOMAINS))for(const value of [lo-step,hi+step,lo+step/3,NaN,Infinity]){assert.throws(()=>controller.update({[key]:value}));t.add();}
const external=controller.getState();external.values.red=3;external.center.held[0]=3;external.directors[0].theta[1]=3;external.color.light[0]=3;external.color.xyz[0]=3;external.targetLinear[0]=3;
t.ok(JSON.stringify(controller.getState())===saved,'Returned state cannot mutate model trajectories or color');
console.log(`PASS RGB subpixels physics: ${t.count} checks, ${colorCases} linear mixtures, 256 codes, ${samples} parent-parity samples, 7 gaps, 5 backlight levels, 3 addressing modes`);

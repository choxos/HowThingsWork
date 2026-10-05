import assert from 'node:assert/strict';
import {TFT,TFT_DEFAULTS,TFT_DOMAINS,TFT_LINE,TFT_FRAME,TFT_RECORD,TFT_DURATION,tftScreenPlan,tftPixelAt,tftRowStart,sampleTftScreen,tftTrace,tftVoltageSteps,createTftScreenController,tftControlEnabled} from './tft-screen-physics.js';

let checks=0;
const ok=(condition,message)=>{checks++;assert.ok(condition,message);};
const near=(actual,expected,tolerance,message)=>ok(Math.abs(actual-expected)<=tolerance,`${message}: ${actual} vs ${expected}`);
const controller=createTftScreenController();
ok(controller.advance(TFT_DURATION).done,'A full real playback interval reaches completion despite floating-point frame arithmetic');
const plan=tftScreenPlan();
near(TFT_LINE,525/9e6,1e-16,'Chosen line timing');
near(TFT_FRAME,285*525/9e6,1e-16,'Chosen frame timing');
near(plan.targetLinear[1],.21586050011389926,1e-12,'8-bit sRGB code 128 is 21.586% linear light');
ok(plan.targetDrive[0]<.1&&plan.targetDrive[1]>1.5&&plan.targetDrive[1]<2.5&&plan.targetDrive[2]===5,'Normally-white cell reverses brightness versus voltage');
near(plan.targetLight[1],plan.black[1]+plan.targetLinear[1]*(1-plan.black[1]),2e-8,'Chosen green voltage reaches target above the assigned black floor');

for(let row=0;row<TFT.rows;row++){
 const first=(12+row)*525/9e6;
 near(tftRowStart(row),first,1e-15,'Visible row begins after vertical blanking');
 const before=tftPixelAt(plan,first-1e-9,row,239),after=tftPixelAt(plan,first+1e-9,row,239);
 ok(before.writes===0&&before.held.every(v=>v===-5),'Unselected row retains its prepared black charge');
 ok(after.writes===1&&after.held.every(v=>v>=0),'Row pulse writes all three data channels together');
 const second=tftPixelAt(plan,first+TFT_FRAME+1e-9,row,239);
 ok(second.writes===2&&second.held.every(v=>v<=0),'Following frame reverses pixel voltage polarity');
 const finished=tftPixelAt(plan,TFT_RECORD,row,239);
 ok(finished.writes===12,'Every visible row receives twelve writes');
}
const begin=sampleTftScreen(plan),end=sampleTftScreen(plan,TFT_RECORD);
ok(begin.scanRow===null&&begin.center.writes===0,'Record begins in blanking with initial stored charge');
ok(end.done&&end.scanRow===null&&end.center.light[0]>.99,'Completed record holds the picture without a fake active scan row');
ok(end.center.light[1]>.2&&end.center.light[1]<.23&&end.center.light[2]<.005,'Orange patch visibly contains strong red, partial green and only black-floor blue');
const single=sampleTftScreen(tftScreenPlan({addressing:1}),TFT_RECORD);
const disabled=sampleTftScreen(tftScreenPlan({addressing:2}),TFT_RECORD);
ok(single.center.writes===1&&single.center.held[1]>0&&single.scanRow===null,'One-frame experiment stops gate pulses but retains the written voltage');
single.center.light.forEach((v,c)=>near(v,end.center.light[c],1e-12,'Ideal storage retains optical response after gate closes'));
ok(disabled.center.writes===0&&disabled.center.held.every(v=>v===-5),'Disabled gate pulses cannot write the target');
disabled.center.light.forEach((v,c)=>near(v,plan.black[c],1e-12,'Prepared black field remains when addressing is disabled'));
for(const level of [0,25,50,75,100]){
 const s=sampleTftScreen(tftScreenPlan({backlight:level}),TFT_RECORD);
 s.center.light.forEach((v,c)=>near(v,end.center.light[c],1e-12,'Backlight does not change liquid-crystal state'));
 s.center.illuminated.forEach((v,c)=>near(v,end.center.light[c]*level/100,1e-12,'Backlight scales output in linear light'));
}
const bars=tftScreenPlan({pattern:2});
for(const [column,channel]of [[0,0],[159,0],[160,1],[319,1],[320,2],[479,2]]){
 const p=tftPixelAt(bars,TFT_RECORD,135,column);
 ok(p.codes[channel]===255&&p.codes.filter(v=>v===0).length===2,'RGB bars route different data to adjacent column bands');
 ok(p.light[channel]>.95,'Written primary lights its own subpixel during the finite response record');
 ok(p.light[channel]<1,'Record completion does not falsely imply exact optical equilibrium');
}
const checker=tftScreenPlan({pattern:3}),a=tftPixelAt(checker,TFT_RECORD,0,0),b=tftPixelAt(checker,TFT_RECORD,0,60),c=tftPixelAt(checker,TFT_RECORD,68,0);
ok(a.codes[0]===255&&b.codes.every(v=>v===0)&&c.codes.every(v=>v===0),'Checkerboard changes both row and column addressing');
for(const gap of [3,3.5,4,4.5,5,5.5,6]){
 const p=tftScreenPlan({gap}),s=sampleTftScreen(p,TFT_RECORD);
 ok(s.directors.every(d=>d.theta.length===81&&d.phi.length===81),'Optical state uses eighty physical layers');
 ok(s.directors.every(d=>[...d.theta,...d.phi].every(Number.isFinite)),'Director remains finite through cell-gap sweep');
 p.targetLight.forEach((v,k)=>near(v,p.black[k]+p.targetLinear[k]*(1-p.black[k]),3e-8,'Voltage calibration follows each gap and wavelength'));
 ok(s.center.light.every(v=>v>=0&&v<=1.001),'Finite passive transmission on selected gap');
}
const trace=tftTrace(plan),steps=tftVoltageSteps(plan);
ok(trace.length===201&&trace[0].time===0&&trace.at(-1).time===TFT_RECORD,'Response trace covers the whole physical record');
ok(steps.length===26&&steps.at(-1).time===TFT_RECORD,'Twelve voltage reversals retain both sides of each discontinuity');
for(let i=1;i<steps.length-1;i+=2)ok(steps[i].time===steps[i+1].time,'Stored-voltage plot draws abrupt writes without interpolated ramps');

controller.reset();controller.advance(5);const retained=controller.getState();controller.update({});near(controller.getState().time,retained.time,1e-12,'No-op updates preserve trial');
controller.update({red:0});ok(controller.getState().clock===0,'Changing a control starts a named new trial');
controller.advance(TFT_DURATION);ok(controller.getState().done,'Edited trial completes');
controller.reset(controller.replayState());ok(controller.getState().clock===0&&controller.getState().values.red===0,'Replay preserves current settings');
const snapshot=JSON.stringify(controller.getState());
for(const fn of [()=>controller.update({bogus:1}),()=>controller.update({gap:4.1}),()=>controller.advance(-1),()=>controller.advance(NaN),()=>controller.reset({time:Infinity}),()=>controller.reset({unknown:1})]){
 assert.throws(fn);checks++;ok(JSON.stringify(controller.getState())===snapshot,'Invalid update is atomic');
}
for(const [key,[lo,hi,step]]of Object.entries(TFT_DOMAINS)){
 assert.throws(()=>tftScreenPlan({[key]:lo-step}));assert.throws(()=>tftScreenPlan({[key]:hi+step}));checks+=2;
}
const mutated=controller.getState();mutated.values.red=123;mutated.center.held[0]=123;mutated.directors[0].theta[1]=123;
ok(JSON.stringify(controller.getState())===snapshot,'External state edits cannot corrupt cached trajectories');
ok(!tftControlEnabled('red',{...TFT_DEFAULTS,pattern:2})&&!tftControlEnabled('background',{...TFT_DEFAULTS,pattern:1}),'Inactive data controls can be hidden without misleading effects');
console.log(`PASS TFT screen physics: ${checks} checks, 272 row boundaries, 7 gaps, 5 backlight levels, 4 patterns`);

import assert from 'node:assert/strict';
import {DISPLAY, DISPLAY_DEFAULTS, DISPLAY_PATTERNS, displayPlan, displayAt, displayPixels, createDisplayController} from './electronic-paper-physics.js';

let checks=0, cases=0;
const check=(condition,message)=>{checks++;assert.ok(condition,message);};
const same=(actual,expected,message)=>{checks++;assert.deepEqual(actual,expected,message);};
const close=(actual,expected,message)=>check(Math.abs(actual-expected)<1e-9,message);
const patterns=[
  [0,1,1,1,0, 1,0,0,0,1, 1,0,0,0,1, 1,1,1,1,1, 1,0,0,0,1, 1,0,0,0,1, 1,0,0,0,1],
  [1,1,1,1,0, 1,0,0,0,1, 1,0,0,0,1, 1,1,1,1,0, 1,0,0,0,1, 1,0,0,0,1, 1,1,1,1,0],
  Array(35).fill(0),Array(35).fill(1),
];
same(DISPLAY_PATTERNS.map(p=>p.pixels),patterns,'Readable A, B, white and black targets');
for(let technology=0;technology<2;technology++)for(let pattern=0;pattern<4;pattern++)for(let power=0;power<2;power++)for(let reverse=0;reverse<2;reverse++)for(let ambient=0;ambient<2;ambient++)for(let frontlight=0;frontlight<2;frontlight++){
  const settings={technology,pattern,power,reverse,ambient,frontlight};
  for(const start of [...patterns,Array(35).fill(.375)]){
    cases++;
    const request=patterns[pattern].map(v=>technology===0&&reverse?1-v:v);
    const target=power?request:technology?Array(35).fill(1):start;
    const rows=Array.from({length:7},(_,r)=>r).filter(r=>start.slice(r*5,r*5+5).some((v,c)=>v!==target[r*5+c]));
    const duration=(technology&&!power?Math.min(1,rows.length):rows.length)*8/10;
    const p=displayPlan(settings,start);
    same(p.target,target,'Power and selected technology determine destination');same(p.rows,rows,'Only differing rows are addressed');close(p.duration,duration,'Teaching duration');
    for(const time of [0,.1,.4,.8,1.2,2.8,4,5.6,20]){
      const n=displayAt(p,time),t=Math.min(time,duration);
      same(n.visible,Boolean(ambient||power&&frontlight),'Reflective screen needs incident light');same(n.frontLightOn,Boolean(power&&frontlight),'LED requires power');
      for(let i=0;i<35;i++){
        const r=Math.floor(i/5),slot=rows.indexOf(r),changed=start[i]!==target[i];
        const elapsed=technology&&!power?t:t-slot*.8;
        const fraction=changed?Math.max(0,Math.min(1,elapsed/.8)):0;
        close(n.pixels[i],start[i]+(target[i]-start[i])*(3*fraction*fraction-2*fraction*fraction*fraction),'Independent cubic motion reference');
        check(n.pixels[i]>=0&&n.pixels[i]<=1,'Bounded illustration state');
        if(!power) same(n.voltages[i],0,'Disconnected drive has zero potential');
        else if(technology===0){
          const active=slot>=0&&t>=slot*8/10&&t<(slot+1)*8/10;
          same(n.voltages[i],changed&&active?15*Math.sign(target[i]-start[i]):0,'Only selected changing ink cells receive field');
        }else{
          const command=slot<0||t>=slot*8/10?target[i]:start[i];
          same(n.voltages[i],command<.5?(reverse?-20:20):0,'Clear EW cells retain holding voltage');
        }
      }
      if(n.voltage){same(n.blackForce,Math.sign(n.voltage),'Positive pigment follows field');same(n.whiteForce,-Math.sign(n.voltage),'Negative pigment opposes field');}
      if(time>=duration){same(n.pixels,target,'Complete write reaches exact endpoints');same(n.activeRow,-1,'Complete write stops row addressing');}
    }
  }
}

const ink=createDisplayController();ink.advance(2.1);const partial=ink.getState().now.pixels;
ink.update({power:0});same(ink.getState().now.pixels,partial,'Power loss preserves partially written ink');
ink.advance(1000000);same(ink.getState().now.pixels,partial,'Ideal bistable image remains without powered drive');
ink.update({pattern:1,reverse:1});same(ink.getState().now.pixels,partial,'Disconnected page request does not erase ink');
const heldReplay=ink.replayState();ink.reset(heldReplay);same(ink.getState().now.pixels,partial,'Replay while disconnected preserves image');
ink.update({power:1});same(ink.getState().plan.start,partial,'Restored power writes from retained pixels');ink.advance(20);
same(ink.getState().now.pixels,patterns[1].map(v=>1-v),'Restored drive follows queued pattern and polarity');same(ink.getState().now.voltages,Array(35).fill(0),'Completed ink image has no drive');

const wet=createDisplayController({settings:{technology:1,pattern:2},time:20});same(wet.getState().now.pixels,patterns[2],'Voltage uncovers white floor');
same(wet.getState().now.voltages,Array(35).fill(20),'Monostable clear floor requires holding drive');
wet.update({power:0});same(wet.getState().now.pixels,patterns[2],'Power-off does not teleport fluid');wet.advance(.4);
wet.getState().now.pixels.forEach(v=>close(v,.5,'All oil cells return in parallel under capillary force'));
wet.advance(.4);same(wet.getState().now.pixels,patterns[3],'Oil covers all floors without drive');
wet.reset({settings:{technology:1,pattern:0},time:1.2});const wetBefore=wet.getState();wet.update({reverse:1});
same(wet.getState().clock,wetBefore.clock,'EW polarity reversal preserves motion clock');same(wet.getState().now.pixels,wetBefore.now.pixels,'EW polarity reversal preserves oil footprint');
wet.getState().now.voltages.forEach((v,i)=>close(v,-wetBefore.now.voltages[i],'Ideal capacitive response is insensitive to voltage sign'));

for(const controller of [ink,wet]){
  const before=controller.getState();controller.update({ambient:0,frontlight:1});same(controller.getState().clock,before.clock,'Lighting cannot advance time');same(controller.getState().now.pixels,before.now.pixels,'Lighting cannot change stored image');
  controller.reset({settings:DISPLAY_DEFAULTS,pixels:patterns[1],time:1.2});same(controller.getState().values,DISPLAY_DEFAULTS,'Reset honors explicit settings');close(controller.getState().clock,1.2,'Reset honors time');same(controller.getState().plan.start,patterns[1],'Reset honors starting image');
  const stable=controller.getState();
  for(const bad of [null,[],42,{pattern:4},{power:.5},{ambient:NaN},{unknown:1}]){checks++;assert.throws(()=>controller.update(bad));same(controller.getState(),stable,'Rejected update is atomic');}
  for(const bad of [null,[],{time:-1},{time:Infinity},{pixels:[]},{settings:{power:2}}]){checks++;assert.throws(()=>controller.reset(bad));same(controller.getState(),stable,'Rejected reset is atomic');}
}
for(const bad of [new Array(35),Array(35).fill(NaN),Array(35).fill(1.1),Array(35).fill(-.1),[]]){checks++;assert.throws(()=>displayPixels(bad));}
const one=createDisplayController(),many=createDisplayController();one.advance(5.6);for(let i=0;i<560;i++)many.advance(.01);same(many.getState(),one.getState(),'Frame subdivision does not change completed state');
check(one.getState().now.complete,'Exactly 5.6 seconds completes seven teaching rows');
for(let row=0;row<7;row++){const plan=displayPlan({pattern:3});same(displayAt(plan,row*8/10).activeRow,row,'Exact decimal boundary selects new row');}
const switched=createDisplayController({settings:{pattern:3},time:20});switched.update({technology:1});same(switched.getState().plan.start,Array(35).fill(1),'Technology change starts defined dark oil state');switched.update({technology:0});same(switched.getState().plan.start,Array(35).fill(0),'Technology change starts defined white ink state');
console.log(`PASS electronic paper physics: ${checks} checks, ${cases} state/setting cases; charge signs, addressing, retention, passive return and lighting`);

import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {ION_SMOKE_DEFAULTS as D,ION_SMOKE_RUN as R,ionChargeBalance,ionSmokeSignals,ionNormalAlpha,ionSmokePlan,ionSmokeAt,createIonSmokeController} from './ionization-smoke-physics.js';
import {SMOKE_SCIENCE as C,smokeChambers,smokeParticle} from './smoke-detector-science.js';
import {smokeMassAt} from './smoke-detector-physics.js';
import {reviewedIonizationSmokeLesson as lesson} from './ionization-smoke-lesson.js';
import {tally} from './model-check-kit.mjs';

const t=tally(),chambers=smokeChambers();let states=0,maxCurrentError=0,maxBalanceError=0;
for(const size of [.1,.3,1,3])for(let growth=0;growth<=50;growth++)for(let batteryIndex=65;batteryIndex<=95;batteryIndex++)for(const program of [0,1,2])for(const power of [0,1]){
  const values={...D,size,growth,battery:batteryIndex/10,program,power};
  for(const time of [0,180,600]){
    const mass=smokeMassAt(values,time),s=ionSmokeSignals(values,mass);states++;
    const currentError=Math.abs(s.current-s.closed.current)/chambers.sensing.saturation;maxCurrentError=Math.max(maxCurrentError,currentError);
    t.ok(currentError<1e-12,'Kirchhoff current equality across every supported physical setting');
    t.near(s.open.volts+s.closed.volts,s.supply,1e-13,'Kirchhoff voltage sum');
    for(const b of [s.open,s.closed]){
      const residual=Math.abs(b.collected+b.recombined+b.attached-b.generated)/b.generated;maxBalanceError=Math.max(maxBalanceError,residual);
      t.ok(residual<2e-15,'Generation equals collection plus recombination plus attachment');
      t.ok([b.collectionShare,b.recombinationShare,b.attachmentShare].every(x=>Number.isFinite(x)&&x>=0&&x<=1+1e-14),'Finite physical loss shares');
    }
    t.ok(s.current>=0&&s.current<=s.saturation,'Source bounds collection current');
    t.ok(s.node>=s.cleanNode-1e-12&&s.current<=s.cleanCurrent+1e-23,'Smoke raises sensing voltage and lowers series current');
    if(!power)t.ok(s.current===0&&s.open.collected===0&&s.open.density>0&&s.closed.density>0,'Unpowered source still generates an ion population');
    if(program===2||growth===0)t.near(mass,0,0,'Clean program stays clean');
  }
}
for(const chamber of Object.values(chambers)){
  const b=ionChargeBalance(chamber,0);t.near(b.density,Math.sqrt(chamber.q/C.recombination),.002,'Zero-field analytic recombination limit');
  for(const volts of [0,1,9,100,1e6]){
    const s=2*C.ionMobility*volts/chamber.gapMeters**2,expected=chamber.q===0?0:(Math.sqrt(s*s+4*C.recombination*chamber.q)-s)/(2*C.recombination);
    t.ok(Math.abs(ionChargeBalance(chamber,volts).density-expected)/ionChargeBalance(chamber,volts).density<1e-6,'Independent quadratic root agrees across fields');
  }
  t.ok(ionChargeBalance(chamber,1e6).collectionShare>.99999999,'Strong-field current approaches source ceiling');
}
const small=smokeParticle(.1),large=smokeParticle(3);
t.near(large.mass/small.mass,27000,1e-10,'Equal mass has 27000 times fewer large particles');
t.near(large.capture/small.capture,30,1e-12,'Diffusion capture coefficient is 30 times larger');
t.near((small.capture/small.mass)/(large.capture/large.mass),900,1e-10,'Total attachment differs by factor 900');
const alpha=ionNormalAlpha();t.near(alpha.energy+(.8991205510469125),alpha.emitted,1e-12,'Normal cover loss fixture');t.near(alpha.energy,4.5864394489530875,1e-12,'ASTAR exit-energy fixture');
t.near(alpha.range,31.90150324606411,1e-10,'ASTAR free-range fixture');t.near(alpha.pairs,47714.29878832985,1e-7,'Normal-gap ion-pair fixture');t.ok(alpha.pairs<alpha.freePairs&&alpha.after>0,'Electrode intercepts remaining alpha energy');
const outcomes=[];
for(const experiment of lesson.tryIt){
  const plan=ionSmokePlan(experiment.values,{mass:experiment.initialState.mass}),start=ionSmokeAt(plan,0),end=ionSmokeAt(plan,600);
  t.near(start.time,0,0,'Experiment starts at zero');t.near(start.mass,experiment.initialState.mass*1e-6,0,'Experiment initial smoke');
  for(const sample of plan.samples){
    const s=ionSmokeAt(plan,sample.time),before=ionSmokeAt(plan,Math.max(0,sample.time-1e-5));
    t.ok(s.active===(sample.node>=sample.threshold),'Actual sample determines alarm state');
    t.near(s.samplesSeen,before.samplesSeen+1,0,'Every sampling boundary is visible exactly once');
  }
  for(const event of plan.events){const before=ionSmokeAt(plan,event.time-1e-5),after=ionSmokeAt(plan,event.time);t.ok(before.active!==event.active&&after.active===event.active,'Alarm transitions happen at their recorded sample');}
  outcomes.push({title:experiment.title,cleanCurrent:start.current*1e12,endCurrent:end.current*1e12,onset:end.onset,events:end.events,chirps:end.chirps.length});
}
t.near(outcomes[0].onset,38.41,1e-10,'Small-sphere first sample fixture');t.near(outcomes[1].onset,38.41,1e-10,'Trigger experiment reproduces original trial');
t.ok(outcomes[2].onset===null&&outcomes[2].endCurrent/outcomes[2].cleanCurrent>.99,'Large equal-mass spheres do not cross assigned threshold');
t.near(outcomes[3].cleanCurrent,7.33587696220639,1e-10,'Low-voltage current fixture');t.near(outcomes[5].cleanCurrent,10.187005936783748,1e-10,'High-voltage current fixture');
t.near(outcomes[6].onset,225.45,1e-10,'Slow input onset fixture');t.near(outcomes[7].events[1].time,223.78,1e-10,'Clearing release fixture');t.ok(!outcomes[7].events[1].active,'Fresh air releases alarm');
t.ok(outcomes[8].onset===null&&outcomes[8].cleanCurrent===0&&outcomes[8].endCurrent===0,'Disconnected battery cannot alarm');t.ok(outcomes[9].onset===null,'Clean air does not alarm');t.near(outcomes[10].chirps,15,0,'Low battery without smoke has fifteen recorded requests');
const p=ionSmokePlan(),c=createIonSmokeController();
c.advance(5);const before=c.getState();c.clear();t.near(c.getState().time,100,0,'Clear keeps clock');t.near(c.getState().mass,before.mass,1e-16,'Clear keeps concentration continuous');c.advance(1);t.ok(c.getState().mass<before.mass,'Clear then removes smoke');
const saved=c.getState();for(const action of [()=>c.update({size:.2}),()=>c.update({pace:.75}),()=>c.update({growth:NaN}),()=>c.update({battery:10}),()=>c.update({unknown:1}),()=>c.reset({time:601}),()=>c.reset({mass:-1}),()=>c.reset({settings:{size:.2}})]){assert.throws(action);assert.deepEqual(c.getState(),saved);t.add(2);}
for(const seconds of [-1,0,NaN,Infinity]){c.advance(seconds);assert.deepEqual(c.getState(),saved);t.add();}
for(const time of [-1,NaN,Infinity]){assert.throws(()=>ionSmokeAt(p,time));t.add();}
c.reset({settings:{...D,program:2},mass:50,time:7});c.update({pace:.5,sound:1});t.near(c.getState().time,7,0,'Presentation changes preserve time');t.near(c.replayState().settings.sound,0,0,'Replay requires a fresh sound choice');t.near(c.replayState().settings.pace,.5,0,'Replay keeps pace');
c.reset(c.replayState());t.near(c.getState().initialMass,50,0,'Replay keeps prepared smoke');c.update({battery:8});t.near(c.getState().time,0,0,'Physical change starts fresh');t.near(c.getState().initialMass,0,0,'Physical change clears prepared smoke');
for(const values of [{...D},{...D,program:1},{...D,program:2}]){
  let mass=0,dt=.002;for(let time=0;time<300;time+=dt){const mid=time+dt/2,room=values.program===2||values.program===1&&mid>=180?0:values.growth*1e-6*mid/60;mass+=(room-mass)*dt/R.lag;}
  t.ok(Math.abs(mass-smokeMassAt(values,300))<2e-10,'Independent time integration agrees with chamber exchange law');
}
const report={passed:true,checks:t.count,physicalSettings:states/3,states,maxCurrentError,maxBalanceError,alpha,outcomes};
if(process.env.EVIDENCE_DIR){await mkdir(process.env.EVIDENCE_DIR,{recursive:true});await writeFile(process.env.EVIDENCE_DIR+'/physics.json',JSON.stringify(report,null,2));}
console.log(`PASS ionization physics: ${t.count} checks; ${states/3} physical settings; ${states} steady states; ${outcomes.length} trials`);

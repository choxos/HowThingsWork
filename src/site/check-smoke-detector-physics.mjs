import assert from 'node:assert/strict';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {ASTAR_AIR,ASTAR_GOLD,astarAt,mie} from './smoke-physics.js';
import {SMOKE_SCIENCE as C,SMOKE_ALPHA_LINES,smokeAlphaTrack,smokeChamber,smokeChambers,smokeNode,smokeIonDensity,smokeSweep,smokeChamberCurrent,smokeParticle,smokeOpticalKernel,smokeSignals} from './smoke-detector-science.js';
import {SMOKE_DETECTOR_DEFAULTS as D,SMOKE_DETECTOR_DOMAINS as DOMAINS,SMOKE_DETECTOR_RUN as R,SMOKE_PHOTO_THRESHOLD,SMOKE_PHOTO_CLEAR,smokeMassAt,smokeDetectorPlan,smokeDetectorAt,createSmokeDetectorController} from './smoke-detector-physics.js';
import {reviewedSmokeDetectorLesson as lesson} from './smoke-detector-lesson.js';
import {tally} from './model-check-kit.mjs';

const t=tally(),fixture=JSON.parse(await readFile(new URL('./smoke-detector-fixtures.json',import.meta.url)));
const relative=(actual,expected,tolerance,why)=>t.near(actual,expected,Math.max(1e-300,Math.abs(expected))*tolerance,why);
const mieErrors=[];
for(const row of fixture.rows){
  const actual=mie(row.x,row.index,row.angles.map(a=>a*Math.PI/180));
  relative(actual.qext,row.qext,1e-10,'Direct Bessel extinction oracle');relative(actual.qsca,row.qsca,1e-10,'Direct Bessel scattering oracle');
  actual.intensity.forEach((v,i)=>relative(v,row.intensity[i],1e-8,'Legendre-derivative angular oracle'));
  mieErrors.push({diameter:row.diameter,extinction:Math.abs(actual.qext/row.qext-1),angular:Math.max(...actual.intensity.map((v,i)=>Math.abs(v/row.intensity[i]-1)))});
  const bins=20000,mu=Array.from({length:bins},(_,i)=>-1+(i+.5)*2/bins),angular=mie(row.x,row.index,mu.map(Math.acos));
  const crossSection=angular.intensity.reduce((a,b)=>a+b,0)*2/bins*Math.PI/(2*Math.PI/C.wavelength)**2;
  relative(crossSection,row.qsca*Math.PI*(row.diameter*1e-6)**2/4,3e-6,'Angular scattering integrates to total sphere cross section');
}
for(const [medium,table] of [['air',ASTAR_AIR],['gold',ASTAR_GOLD]])for(const [energy,stop,range] of fixture.astar[medium]){
  relative(astarAt(table,energy,1),stop,1e-14,'Primary ASTAR total stopping');relative(astarAt(table,energy,2),range,1e-14,'Primary ASTAR CSDA range');
}
relative(SMOKE_ALPHA_LINES.reduce((sum,line)=>sum+line[1],0),.9934,1e-14,'Absolute alpha probabilities stay unnormalized');
t.near(C.pairEnergy,35.1,0,'Alpha W, not electron W');
const chambers=smokeChambers(),convergence=[];
for(const chamber of Object.values(chambers)){
  const refined=smokeChamber(chamber.gap,{radial:12,sourceAngles:16,directions:48,cosines:160});
  relative(chamber.rate,refined.rate,.002,'Finite-foil source quadrature convergence');convergence.push({gap:chamber.gap,rate:chamber.rate,refined:refined.rate});
  for(const volts of [0,.1,1,4.5,9.5])for(const capture of [0,1,10,100,1000]){
    const n=smokeIonDensity(chamber,volts,capture),sweep=smokeSweep(chamber,volts);
    relative(C.recombination*n*n+(sweep+capture)*n,chamber.q,2e-14,'Ion pair production equals all losses');
    const current=smokeChamberCurrent(chamber,volts,capture);t.ok(current>=0&&current<=chamber.saturation,'Collection respects pair-generation ceiling');
    if(volts===0)t.near(current,0,0,'No battery-driven collection at zero voltage');
  }
}
let seed=420871;const random=()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)+.5)/4294967296;
for(let i=0;i<4000;i++){
  const radius=C.sourceRadius*Math.sqrt(random()),phi=(random()-.5)*Math.PI,source=[radius*Math.cos(phi),radius*Math.sin(phi)],gap=i%2?C.sensingGap:C.referenceGap;
  const p=smokeAlphaTrack(SMOKE_ALPHA_LINES[i%3][0],source,random(),2*Math.PI*random(),gap);
  t.ok(p.end[0]>=-1e-10&&Math.hypot(p.end[0],p.end[1])<=C.radius+1e-10&&p.end[2]<=gap+1e-10,'Alpha remains inside its half-cylinder');
  t.ok(p.deposit>=0&&p.deposit<=p.start&&p.length<=p.range+1e-10,'Alpha loses only available energy');
  if(p.stop==='divider')t.near(p.end[0],0,1e-10,'Divider-stopped ray ends on divider');
  if(p.stop==='wall')t.near(Math.hypot(p.end[0],p.end[1]),C.radius,1e-10,'Wall-stopped ray ends on shell');
  if(p.stop==='electrode')t.near(p.end[2],gap,1e-10,'Electrode-stopped ray ends at gap');
}
for(const supply of [6.5,7,7.5,9,9.5])for(const capture of [0,.1,1,10,100,1000]){
  const node=smokeNode(supply,capture),clean=smokeNode(supply);
  relative(smokeChamberCurrent(chambers.sensing,node,capture),smokeChamberCurrent(chambers.reference,supply-node),2e-12,'Series chamber current continuity');
  t.ok(node>=clean-1e-12&&node<supply,'Smoke raises sensing voltage within rails');
}
const optics=[];
for(const size of [.1,.3,1,3])for(const angle of [15,21,90,165]){
  const kernel=smokeOpticalKernel(size,angle),refined=smokeOpticalKernel(size,angle,{angular:10,azimuths:40,distance:32}),number=80e-6/kernel.particle.mass;
  relative(kernel.current(number),refined.current(number),.0002,'Optical volume integral converges');optics.push({size,angle,current:kernel.current(number),refined:refined.current(number)});
  t.ok(kernel.directSeparation>C.receiverHalfAngle,'Direct emitter remains outside receiver field');
  const axis=kernel.receiver.map(v=>-v/C.receiverDistance),cos=Math.cos(C.receiverHalfAngle*Math.PI/180),tan=Math.tan(C.sourceStopAngle*Math.PI/180);
  for(let i=0;i<kernel.positions.length;i+=17){
    const p=kernel.positions[i],incoming=p.map((v,j)=>v-kernel.source[j]),out=p.map((v,j)=>v-kernel.receiver[j]),length=Math.hypot(...out);
    t.ok(Math.hypot(...p)<=C.chamberRadius+1e-12&&incoming[0]>0&&Math.hypot(incoming[1],incoming[2])<=incoming[0]*tan+1e-12,'Integrated point is inside cavity and lit cone');
    t.ok(out.reduce((sum,v,j)=>sum+v*axis[j],0)/length>=cos-1e-12,'Integrated point lies in receiver view');
    relative(kernel.paths[i],Math.hypot(...incoming)+length,1e-14,'Both attenuation path lengths are included');
  }
  t.near(kernel.current(0),0,0,'Clean air has no smoke-scattered current');
}
// Independently integrate chamber exchange, including the discontinuous room clearing.
for(const program of [0,1,2]){
  const values={...D,program},dt=.01;let mass=110e-6;
  for(let k=0;k<60000;k++){
    const time=k*dt,room=at=>program===2||program===1&&at>=180?0:values.growth*1e-6*at/60;
    const rate=(at,m)=>(room(at)-m)/R.lag;
    const k1=rate(time+1e-9,mass),k2=rate(time+dt/2,mass+dt*k1/2),k3=rate(time+dt/2,mass+dt*k2/2),k4=rate(time+dt-1e-9,mass+dt*k3);
    mass+=dt*(k1+2*k2+2*k3+k4)/6;
    if((k+1)%10000===0)relative(smokeMassAt(values,(k+1)*dt,110e-6),mass,1e-9,'Analytic chamber concentration matches RK4');
  }
}
const outcomes=lesson.tryIt.map(trial=>{const plan=smokeDetectorPlan(trial.values,{mass:trial.initialState.mass}),end=smokeDetectorAt(plan,600);return {title:trial.title,ion:plan.ionAlarm,photo:plan.photoAlarm,changes:plan.changes,chirps:end.chirps.length,endActive:end.active,beam:end.beamShare,room:end.roomShare};});
const expected=[[203.74,398.9],[38.41,null],[null,131.4],[56.78,99.3],[203.74,398.9],[210.42,398.9],[203.74,null],[56.78,99.3],[null,null],[null,null],[1.67,null]];
outcomes.forEach((o,i)=>{for(const [key,index] of [['ion',0],['photo',1]])if(expected[i][index]===null)t.ok(o[key]===null,`${o.title}: no ${key} onset`);else t.near(o[key],expected[i][index],1e-7,`${o.title}: sampled ${key} onset`);});
t.ok(outcomes[4].beam>.99&&Math.round(outcomes[4].room*100)===35,'Short/long path comparison matches prose');
t.near(outcomes[5].chirps,5,0,'Past low-battery chirps remain after alarm');
t.ok(!outcomes[7].endActive&&outcomes[7].changes.length===4,'Clearing releases both and preserves four transitions');
t.near(outcomes[7].changes[2].time,203.3,1e-7,'Optical releases at lower threshold');t.near(outcomes[7].changes[3].time,212.09,1e-7,'Ion releases at lower threshold');
const puff=smokeDetectorPlan({...D,growth:0,program:2},{mass:110});
t.ok(puff.photoSamples[0].hit&&puff.photoSamples[0].count===1&&!puff.photoSamples[1].hit&&puff.photoSamples[1].count===0,'One optical hit followed by miss resets confirmation');
t.near(puff.photoSamples[1].time,12.7,1e-10,'First hit schedules two-second confirmation');t.ok(puff.photoAlarm===null,'One hit never confirms optical alarm');
let combinations=0;
for(const size of [.1,.3,1,3])for(const growth of [0,1,50])for(const battery of [6.5,7.5,9.5])for(const angle of [15,90,165])for(const program of [0,1,2])for(const power of [0,1]){
  const plan=smokeDetectorPlan({...D,size,growth,battery,angle,program,power});combinations++;
  for(const time of [0,10.7,180,220,600]){
    const state=smokeDetectorAt(plan,time);
    t.ok([state.mass,state.current,state.node,state.scattered,state.density,state.roomMass].every(x=>Number.isFinite(x)&&x>=0),'Control cross product yields finite nonnegative physics');
    t.ok(state.active===(state.ionActive||state.photoActive),'Horn combines actual sensor requests');
    if(!power)t.ok(!state.active&&state.current===0&&state.scattered===0&&state.photoCount===0,'Disconnected battery powers neither sensing circuit nor horn');
    if(!growth||program===2)t.ok(!state.active&&state.scattered===0&&state.mass===0,'Clean program never fabricates smoke');
  }
  for(const sample of plan.photoSamples){if(sample.active)t.ok(sample.count===3&&sample.value>=SMOKE_PHOTO_CLEAR,'Confirmed state retains count and release threshold');}
}
const control=createSmokeDetectorController();control.advance(15);const before=control.getState();control.clear();const clearing=control.getState();
t.near(clearing.time,before.time,0,'Clear action preserves clock');relative(clearing.mass,before.mass,1e-14,'Clear action preserves instantaneous smoke');
control.advance(2);t.ok(control.getState().mass<before.mass,'Fresh air removes existing chamber smoke');
control.update({sound:1});const soundTime=control.getState().time;t.near(control.replayState().settings.sound,0,0,'Replay starts with optional sound off');control.update({sound:0});t.near(control.getState().time,soundTime,0,'Sound selection preserves observation');
control.update({angle:90});t.near(control.getState().time,0,0,'Physical control starts fresh trial');
for(const [key,[lo,hi,step]] of Object.entries(DOMAINS))for(const bad of [NaN,Infinity,lo-step,hi+step,lo+step/3])assert.throws(()=>smokeDetectorPlan({...D,[key]:bad}),RangeError);
for(const size of [.2,.4,2])assert.throws(()=>smokeDetectorPlan({...D,size}),RangeError);
for(const bad of [null,[],'bad'])assert.throws(()=>control.reset(bad),TypeError);
for(const bad of [{mass:-1},{mass:501},{time:601},{clearingAt:601},{wrong:1}])assert.throws(()=>control.reset(bad));
for(const time of [-1,NaN,Infinity])assert.throws(()=>smokeDetectorAt(control.getPlan(),time),RangeError);
t.add();
const report={passed:true,checks:t.count,combinations,mieErrors,convergence,optics,outcomes};
if(process.env.EVIDENCE_DIR){await mkdir(process.env.EVIDENCE_DIR,{recursive:true});await writeFile(process.env.EVIDENCE_DIR+'/physics.json',JSON.stringify(report,null,2));}
console.log(`PASS smoke detector physics: ${t.count} checks; ${combinations} control combinations; ${outcomes.length} trials`);

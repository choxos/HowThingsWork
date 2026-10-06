import assert from 'node:assert/strict';
import {mkdir,writeFile,readFile} from 'node:fs/promises';
import {OPTICAL_SMOKE_DEFAULTS as D,OPTICAL_SMOKE_RUN as R,opticalSmokeSignals,opticalSmokePattern,opticalSmokePlan,opticalSmokeAt,opticalSmokePuff,createOpticalSmokeController} from './optical-smoke-physics.js';
import {SMOKE_SCIENCE as C,smokeOptics,smokeOpticalKernel} from './smoke-detector-science.js';
import {smokeMassAt} from './smoke-detector-physics.js';
import {reviewedOpticalSmokeLesson as lesson} from './optical-smoke-lesson.js';
import {tally} from './model-check-kit.mjs';

const t=tally();let states=0,nodes=0,maxConvergence=0;
for(const size of [.1,.3,1,3])for(let angle=15;angle<=165;angle++){
  const optical=smokeOptics(size,angle),particle=optical.particle;
  t.ok(optical.directSeparation>optical.receiverHalfAngle,'Direct emitter is outside receiver field throughout full angle range');
  t.ok(optical.volume>0&&optical.volume<4/3*Math.PI*C.chamberRadius**3,'Nonempty optical overlap lies inside chamber');
  for(let i=0;i<optical.positions.length;i++){
    const p=optical.positions[i],incoming=p.map((x,j)=>x-optical.source[j]),outgoing=p.map((x,j)=>optical.receiver[j]-x),r=Math.hypot(...incoming),l=Math.hypot(...outgoing);
    const cosAngle=incoming.reduce((sum,x,j)=>sum+x*outgoing[j],0)/(r*l);nodes++;
    t.ok(Math.hypot(...p)<=C.chamberRadius+1e-12&&incoming[0]>0&&Math.hypot(incoming[1],incoming[2])<=incoming[0]*Math.tan(C.sourceStopAngle*Math.PI/180)+1e-12,'Every quadrature node lies in actual lit cavity');
    t.near(Math.cos(optical.angles[i]),cosAngle,1e-11,'Local angle follows incoming and outgoing ray vectors');
    t.ok(optical.coefficients[i]>=0&&Number.isFinite(optical.coefficients[i]),'Finite nonnegative collection coefficient');
    t.near(optical.paths[i],r+l,1e-12,'Extinction path includes both physical segments');
  }
  for(let growth=0;growth<=50;growth++)for(const program of [0,1,2])for(const power of [0,1])for(const time of [0,180,600]){
    const values={...D,size,angle,growth,program,power},mass=smokeMassAt(values,time),s=opticalSmokeSignals(values,mass,optical);states++;
    t.ok([s.mass,s.number,s.extinction,s.current,s.charge,s.electrons].every(x=>Number.isFinite(x)&&x>=0),'Finite physical signal across full control grid');
    t.ok(s.beamShare>=s.roomShare&&s.beamShare<=1&&s.roomShare>=0,'Longer path retains no more of same beam');
    t.near(Math.pow(s.beamShare,C.roomDistance/C.beamDistance),s.roomShare,4e-14,'Independent path-length power law');
    t.near(s.charge,s.current*R.pulse,1e-25,'Pulse integration conserves charge');
    if(!power||mass===0)t.near(s.current,0,0,'No powered smoke signal without light or particles');
    if(power&&mass>0)t.ok(s.current>0,'Nonzero finite overlap collects scattered light');
  }
}
for(const size of [.1,.3,1,3])for(const angle of [15,21,45,90,165]){
  const basic=smokeOptics(size,angle),refined=smokeOpticalKernel(size,angle,{angular:10,azimuths:40,distance:32});
  for(const mass of [1e-6,100e-6,500e-6]){const n=mass/basic.particle.mass,a=basic.current(n),b=refined.current(n),error=Math.abs(a-b)/b;maxConvergence=Math.max(maxConvergence,error);t.ok(error<.002,'Doubled quadrature agrees within 0.2% in edge and representative cases');}
}
let independentFixtures=0;
if(process.env.MIE_FIXTURE){
  const fixture=JSON.parse(await readFile(process.env.MIE_FIXTURE,'utf8')),wave=2*Math.PI/C.wavelength;
  for(const row of fixture.rows){
    const pattern=opticalSmokePattern(row.diameter),particle=smokeOptics(row.diameter,21).particle;
    t.ok(Math.abs(particle.qext-row.qext)/row.qext<1e-12,'Extinction matches independent SciPy Bessel fixture');
    row.angles.forEach((angle,i)=>{t.ok(Math.abs(pattern[angle].crossSection-row.intensity[i]/(2*wave*wave))/(row.intensity[i]/(2*wave*wave))<1e-8,'Angular cross section matches independent Bessel fixture');independentFixtures++;});
  }
}
const outcomes=[];
for(const trial of lesson.tryIt){
  const p=opticalSmokePlan(trial.values,{mass:trial.initialState.mass}),start=opticalSmokeAt(p,0),end=opticalSmokeAt(p,600);let count=0,active=false;
  t.near(start.mass,trial.initialState.mass*1e-6,0,'Every trial has its prepared starting smoke');
  for(const [i,sample]of p.samples.entries()){
    const above=sample.current>=(active?end.release:end.trigger);count=active?(above?3:0):above?count+1:0;active=count===3;
    t.ok(sample.hit===above&&sample.count===count&&sample.active===active,'Independent consecutive-check state machine');
    if(i)t.near(sample.time-p.samples[i-1].time,p.samples[i-1].interval,1e-12,'Every interval matches previous observed count');
    const before=opticalSmokeAt(p,sample.time-1e-5),after=opticalSmokeAt(p,sample.time);
    t.near(after.samplesSeen,before.samplesSeen+1,0,'Sample boundary becomes visible exactly once');t.ok(after.pulseOn&&!before.pulseOn,'100 microsecond pulse begins at check');
    t.ok(!opticalSmokeAt(p,sample.time+R.pulse+1e-7).pulseOn,'Emitter pulse ends after selected duration');
  }
  for(const event of p.events){t.ok(opticalSmokeAt(p,event.time-1e-5).active!==event.active&&opticalSmokeAt(p,event.time).active===event.active,'Alarm change happens on recorded sample');}
  outcomes.push({title:trial.title,initialMass:p.initialMass,onset:end.onset,events:end.events,current:end.current*1e9,beam:end.beamShare*100,room:end.roomShare*100,samples:p.samples.length});
}
for(const [index,current,onset]of [[0,13.376492367455903,131.4],[2,.2052888857773577,null],[3,1.2457180460796693,null],[4,3.6048075064591587,398.9],[5,.1029739107406335,null],[6,66.01029149426269,45.8]]){
  t.near(outcomes[index].current,current,1e-10,'Assigned optical-current fixture');if(onset===null)t.ok(outcomes[index].onset===null,'Trial stays below threshold');else t.near(outcomes[index].onset,onset,1e-10,'Assigned confirmed onset fixture');
}
t.near(outcomes[7].events[1].time,197.4,1e-10,'Fresh air releases optical alarm at actual check');t.ok(outcomes[8].current===0&&outcomes[8].samples===0,'Disconnected model performs no powered measurements');t.ok(outcomes[9].current===0&&outcomes[9].onset===null,'Clean air stays quiet');
const puff=opticalSmokePlan({...D,growth:0,program:2},{mass:opticalSmokePuff()});t.ok(puff.samples[0].count===1&&puff.samples[1].count===0&&puff.events.length===0,'Prepared puff passes once, then fails confirmation');t.near(puff.samples[1].time,12.7,1e-12,'Failed confirmation sample occurs after two seconds');
const c=createOpticalSmokeController();c.advance(5);const before=c.getState();c.clear();t.near(c.getState().mass,before.mass,1e-16,'Manual clear is continuous');t.near(c.getState().time,100,0,'Manual clear keeps time');c.advance(1);t.ok(c.getState().mass<before.mass,'Manual clear changes future smoke');
const saved=c.getState();for(const action of [()=>c.update({size:.2}),()=>c.update({pace:.75}),()=>c.update({angle:14}),()=>c.update({growth:NaN}),()=>c.update({unknown:1}),()=>c.reset({time:601}),()=>c.reset({mass:-1}),()=>c.reset({mass:501})]){assert.throws(action);assert.deepEqual(c.getState(),saved);t.add(2);}
for(const seconds of [-1,0,NaN,Infinity]){c.advance(seconds);assert.deepEqual(c.getState(),saved);t.add();}
for(const time of [-1,NaN,Infinity]){assert.throws(()=>opticalSmokeAt(puff,time));t.add();}
c.reset({settings:{...D,program:2},mass:50,time:7});c.update({pace:.5,sound:1});t.near(c.getState().time,7,0,'Presentation changes preserve time');t.near(c.replayState().settings.sound,0,0,'Replay resets optional sound');t.near(c.replayState().settings.pace,.5,0,'Replay preserves pace');
c.reset(c.replayState());t.near(c.getState().initialMass,50,0,'Replay restores prepared puff');c.update({angle:90});t.near(c.getState().time,0,0,'Physical change starts fresh');t.near(c.getState().initialMass,0,0,'Physical change resets prepared smoke');
const report={passed:true,checks:t.count,physicalSettings:states/3,states,nodes,maxConvergence,independentFixtures,outcomes};
if(process.env.EVIDENCE_DIR){await mkdir(process.env.EVIDENCE_DIR,{recursive:true});await writeFile(process.env.EVIDENCE_DIR+'/physics.json',JSON.stringify(report,null,2));}
console.log(`PASS optical physics: ${t.count} checks; ${states/3} physical settings; ${states} states; ${nodes} quadrature nodes; ${independentFixtures} independent angular fixtures; ${outcomes.length} trials`);

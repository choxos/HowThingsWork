import assert from 'node:assert/strict';
import {OLED,OLED_DURATION,OLED_PLAYBACK_DURATION,OLED_DEFAULTS,OLED_DOMAINS,OLED_MAX_CURRENT,oledTargetVoltage,oledCurrent,oledRowStart,createOledPlan,oledDisplayState,createOledDisplayController} from './oled-display-physics.js';
import {tally} from './model-check-kit.mjs';

const t=tally(),near=(a,b,message,tolerance=1e-12)=>t.near(a,b,tolerance,message);
for(let percent=0;percent<=100;percent++)near(oledCurrent(oledTargetVoltage(percent)),percent/100*2e-6,'Inverse square-law programming requests the assigned current',1e-20);
for(const v of [0,.5,1,1.0001,1.5,2,3])near(oledCurrent(v),.5e-6*Math.max(0,v-1)**2,'Independent ideal p-channel saturation law',1e-20);
for(const bad of [-1,101,NaN,Infinity,'50'])assert.throws(()=>oledTargetVoltage(bad));
for(const bad of [-1,NaN,Infinity,'1'])assert.throws(()=>oledCurrent(bad));
const base=createOledPlan({red:100,green:50,blue:1,addressing:1}),write=oledRowStart(0,1),u=[3,1+Math.sqrt(2),1.2];
for(const elapsed of [0,1e-6,20e-6,60e-6,119e-6,120e-6,.001,.1]){
 const s=oledDisplayState(base,write+elapsed);
 s.center.channels.forEach((channel,i)=>near(channel.voltage,u[i]*(1-Math.exp(-Math.min(elapsed,.00012)/.00002)),'Finite row-write RC followed by ideal hold',5e-13));
 t.ok(s.center.selected===(elapsed<120e-6),'Row switch is selected only during its pulse');
}
const hold=oledDisplayState(base,.199).center.channels;
t.ok(hold.every(c=>c.current>0),'All three nonzero targets continue emitting long after the row switch opens');
const leaky=createOledPlan({red:100,green:50,blue:1,addressing:1,retention:1});
for(const elapsed of [.00001,.00012,.001,.010,.030,.1]){
 const s=oledDisplayState(leaky,write+elapsed),effectiveTau=1/(1/.00002+1/.05);
 s.center.channels.forEach((c,i)=>{
  const charged=u[i]*effectiveTau/.00002*(1-Math.exp(-Math.min(elapsed,.00012)/effectiveTau));
  near(c.voltage,charged*Math.exp(-Math.max(0,elapsed-.00012)/.05),'Leakage is parallel to row writing and then discharges the held signal',5e-13);
 });
}
let stateCases=0;
const percentages=[0,25,100];
for(const red of percentages)for(const green of percentages)for(const blue of percentages)
for(const pattern of [0,1,2])for(const addressing of [0,1,2,3])for(const circuit of [0,1,2])for(const retention of [0,1]){
 const plan=createOledPlan({red,green,blue,pattern,addressing,circuit,retention});
 for(const time of [0,.0061,1/60,.04,.2]){
  const s=oledDisplayState(plan,time);stateCases++;
  near(s.total.supplyPower,s.total.drivePower+s.total.oledHeat+s.total.opticalPower,'Emitter energy divides between drive heat, OLED heat and escaped photons',1e-17);
  near(s.total.power,s.total.supplyPower+50e-6,'Electronics load remains separate from emitter power',1e-17);
  t.ok(s.total.oledHeat>=-1e-20&&s.total.drivePower>=0&&s.total.opticalPower>=0,'Every power channel is nonnegative');
  near(s.total.energy,s.total.emitterEnergy+s.total.electronicsEnergy,'Record energy includes a separate electronics contribution',1e-17);
  t.ok(s.pixels.filter(p=>p.active).length===[1,9,5][pattern],'Picture selects the intended physical pixels');
  for(const pixel of s.pixels)for(const [channel,c]of pixel.channels.entries()){
   t.ok(c.current>=0&&c.current<=OLED_MAX_CURRENT+1e-20,'Current stays in the assigned transistor range');
   t.ok(c.current===0||c.saturationMargin>=2.7-1e-12,'Every conducting point has saturation headroom');
   t.ok(c.current>0||c.junctionVoltage===null&&c.sourceDrainVoltage===null&&c.saturationMargin===null,'Nonconducting and open-loop node voltages are unspecified, not reported as measured zero');
   near(c.photonRate,1.2483018148921526e18*c.current,'Assigned external photon yield per coulomb',.001);
   near(c.opticalPower,c.photonRate*6.62607015e-34*299792458/[630e-9,530e-9,460e-9][channel],'Photon energy follows h c / wavelength',1e-20);
   near(c.storedCharge,.5e-12*c.voltage,'Capacitor stores the control signal',1e-25);
   if(!pixel.active||addressing===2||circuit===1||circuit===2&&time>=1/60)t.ok(c.current===0,'Dark, unwritten or disconnected emitters carry no current');
  }
 }
}
const full=oledDisplayState(createOledPlan({pattern:1,red:100,green:100,blue:100}),.2);
near(full.total.current,54e-6,'Nine white pixels draw 27 assigned full currents',1e-18);
near(full.total.power,482e-6,'Full white adds emitter and assigned electronics power',1e-18);
const black=oledDisplayState(createOledPlan({red:0,green:0,blue:0}),.2);
near(black.total.power,50e-6,'Black pixels do not erase electronics consumption',1e-20);
const opened=oledDisplayState(createOledPlan({circuit:2}),.05);
t.ok(!opened.circuitClosed&&opened.center.channels[0].voltage>2.99&&opened.total.current===0,'Opening emitter return stops light while the control signal remains');
const erased=oledDisplayState(createOledPlan({addressing:3}),.05);
t.ok(erased.circuitClosed&&erased.center.channels.every(c=>c.voltage<1)&&erased.total.current===0,'A later black write erases the signal with the emitter circuit still connected');

function referenceCharge(settings){
 const dt=1e-6,held=Array.from({length:3},()=>[0,0,0]);let charge=0;
 const target=[settings.red??100,settings.green??22,settings.blue??0].map(v=>v===0?0:1+2*Math.sqrt(v/100));
 const derivative=(v,on,goal)=>(on?(goal-v)/.00002:0)-(settings.retention?v/.05:0);
 for(let step=0;step<200000;step++){
  const time=(step+.5)*dt,frame=Math.floor(time*60),within=time-frame/60;
  let current=0;
  for(let row=0;row<3;row++){
   const activeColumns=Array.from({length:3},(_,column)=>settings.pattern===1||settings.pattern===2&&(row+column)%2===0||!settings.pattern&&row===1&&column===1).filter(Boolean).length;
   const start=.0005+row/180,on=within>=start&&within<start+.00012&&settings.addressing!==2&&!(settings.addressing===1&&frame>0);
   for(let i=0;i<3;i++){
    const old=held[row][i],goal=settings.addressing===3&&frame>0?0:target[i];
    const k1=derivative(old,on,goal),k2=derivative(old+k1*dt/2,on,goal),k3=derivative(old+k2*dt/2,on,goal),k4=derivative(old+k3*dt,on,goal);
    const next=old+dt*(k1+2*k2+2*k3+k4)/6;held[row][i]=next;
    current+=activeColumns*.5e-6*(Math.max(0,old-1)**2+Math.max(0,next-1)**2)/2;
   }
  }
  if(settings.circuit!==1&&!(settings.circuit===2&&time>=1/60))charge+=current*dt;
 }
 return charge;
}
let integratedCases=0;
for(const settings of [{},{pattern:1},{pattern:2,green:100,blue:100},{addressing:1},{addressing:1,retention:1},{addressing:3},{circuit:1},{circuit:2},{addressing:0,retention:1,pattern:1}]){
 const s=oledDisplayState(createOledPlan(settings),.2),reference=referenceCharge(settings);
 near(s.total.charge,reference,'Analytic delivered charge matches independent 1-microsecond RK4 integration',Math.max(1e-12,reference*3e-4));integratedCases++;
}
const controller=createOledDisplayController();
for(let i=0;i<12;i++)controller.advance(100/60);
t.ok(controller.getState().done,'Exactly twelve frame steps complete without an extra click');
const final=controller.getState();
controller.reset();controller.advance(OLED_PLAYBACK_DURATION);assert.deepEqual(controller.getState(),final);t.add();
controller.reset();for(const dt of [.01,2,.7,4.01,7.3,9])controller.advance(dt);assert.deepEqual(controller.getState(),final);t.add();
controller.reset({settings:{green:75},time:1});const saved=JSON.stringify(controller.getState());
controller.update({});t.ok(JSON.stringify(controller.getState())===saved,'No-op updates preserve time and state');
for(const fn of [()=>controller.reset(null),()=>controller.reset({settings:{red:50},time:-1}),()=>controller.reset({unknown:1}),()=>controller.update({other:1}),()=>controller.advance(NaN),()=>controller.advance(-1)]){
 assert.throws(fn);t.ok(JSON.stringify(controller.getState())===saved,'Invalid input is rejected before mutation');
}
for(const [key,[lo,hi,step]]of Object.entries(OLED_DOMAINS))for(const value of [lo-step,hi+step,lo+step/3,NaN,Infinity])assert.throws(()=>controller.update({[key]:value}));
const external=controller.getState(),externalPlan=controller.getPlan();external.values.red=3;external.center.channels[0].voltage=4;externalPlan.values.red=0;externalPlan.traces[0][0].segments[0].start=3;
t.ok(JSON.stringify(controller.getState())===saved,'Returned values and plan cannot mutate trajectories');
controller.update({red:50});t.ok(controller.getState().clock===0,'Settings edits restart the record');
controller.advance(3);controller.reset(controller.replayState());t.ok(controller.getState().clock===0&&controller.getState().values.red===50,'Replay retains selected settings');
assert.deepEqual(createOledDisplayController().getState().values,OLED_DEFAULTS);t.add();
assert.throws(()=>oledDisplayState(base,-1));assert.throws(()=>oledDisplayState(base,Infinity));
console.log(`PASS OLED physics: ${t.count} checks, ${stateCases} states across all discrete settings and RGB samples 0/25/100, ${integratedCases} independent RK4 charge comparisons`);

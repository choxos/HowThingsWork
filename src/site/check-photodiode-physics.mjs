import assert from 'node:assert/strict';
import {PHOTODIODE_DEFAULTS as D,PHOTODIODE_DOMAINS as domains,PHOTODIODE_EXPERIMENT as E,PHOTODIODE_VOLTAGE_SCALE as a,photodiodeCircuit as circuit,photodiodeSample as sample,photodiodeOnTime as onTime,advancePhotovoltage,createPhotodiodeController as controller} from './photodiode-physics.js';

const near=(actual,expected,label,relative=2e-11,absolute=1e-22)=>assert.ok(Math.abs(actual-expected)<=absolute+relative*Math.max(Math.abs(actual),Math.abs(expected)),`${label}: ${actual} != ${expected}`);
near(circuit().responsivity,(50e-6-2e-9)/75e-6,'reverse responsivity after baseline subtraction');
near(circuit({mode:1}).responsivity,47/75,'zero-bias responsivity');
near(circuit().photonEv,1.3050968256126345,'950 nm photon energy',1e-12);
near(advancePhotovoltage(0,47e-6,.1),.350,'Voc reference');
near(E.reverseCoefficient*10+E.dark,50e-6,'total reverse light-current sheet point');
near(E.zeroCoefficient*10,47e-6,'short-circuit sheet point');
near(circuit().quantumEfficiency,.8700297478264067,'reverse quantum efficiency',1e-12);
for(const [distance,current] of [[1,379.9848e-9],[5,15.199392e-9],[10,3.799848e-9],[25,.60797568e-9],[27,379.9848e-9/729]])near(circuit({distance}).signalCurrent,current,'distance reference');
for(const t of [0,1/12,1/6,.25,.5,.63,11.9,12]){
  const p=circuit(),s=sample(p,t),periods=t*2,expected=(Math.floor(periods)/3+Math.min(periods%1,1/3))/38000;
  near(s.onTime,expected,'partial pulse integration');
  near(s.photoCharge,s.incidentPhotons*p.quantumEfficiency*E.charge,'photon and charge accounting');
  near(s.externalCharge,s.photoCharge+2e-9*s.realTime,'dark plus light charge');
}
assert.equal(sample(circuit(),1/6).gate,false);
assert.equal(sample(circuit(),.5).gate,true);
near(onTime(12,0),3*onTime(12,1),'steady/pulse exposure');
for(const mode of [0,1,2]){
  const p=circuit({mode,blocked:1,background:1}),s=sample(p,12);
  assert.equal(p.signalCurrent,0);near(p.backgroundCurrent,(mode===0?4.9998:4.7)*1e-9,'background survives shutter');
  assert.equal(s.voltage<0,mode===0);assert.equal(s.externalCurrent===0,mode===2);
}
assert.ok(circuit({distance:25}).signalCurrent<circuit().darkCurrent);
assert.ok(circuit({distance:27}).signalCurrent>0);

function referenceIntegration(plan,screenTime,initialVoltage){
  let voltage=initialVoltage,diodeCharge=0,photoCharge=0;
  const end=screenTime/19000,period=1/38000,edges=[0,end];
  if(plan.values.drive)for(let i=0;i<=24;i++)for(const edge of [i*period,(i+1/3)*period])if(edge>0&&edge<end)edges.push(edge);
  edges.sort((x,y)=>x-y);
  const diode=v=>2e-9*Math.expm1(v/a);
  for(let k=1;k<edges.length;k++){
    const left=edges[k-1],right=edges[k],mid=(left+right)/2;
    const lit=!plan.values.drive||(mid/period)%1<1/3;
    const current=plan.backgroundCurrent+(lit?plan.signalCurrent:0),count=512,h=(right-left)/count;
    for(let i=0;i<count;i++){
      const f=v=>(current-diode(v))/70e-12;
      const k1=f(voltage),k2=f(voltage+h*k1/2),k3=f(voltage+h*k2/2),k4=f(voltage+h*k3);
      diodeCharge+=h*(diode(voltage)+2*diode(voltage+h*k1/2)+2*diode(voltage+h*k2/2)+diode(voltage+h*k3))/6;
      photoCharge+=current*h;voltage+=h*(k1+2*k2+2*k3+k4)/6;
    }
  }
  return {voltage,diodeCharge,photoCharge};
}
let odeCases=0;
for(const distance of [1,5,27])for(const drive of [0,1])for(const background of [0,2])for(const initialVoltage of [0,.1]){
  const p=circuit({distance,drive,background,mode:2}),s=sample(p,11.73,initialVoltage),r=referenceIntegration(p,11.73,initialVoltage);
  near(s.voltage,r.voltage,'independent RK4 voltage',2e-8,1e-12);
  near(s.internalDiodeCharge,r.diodeCharge,'independent diode charge',2e-8,1e-19);
  near(s.photoCharge,r.photoCharge,'independent generated charge',2e-10,1e-20);odeCases++;
}
const dark=controller({settings:{mode:2,blocked:1},initialVoltage:.1});
assert.equal(dark.getState().voltage,.1);assert.equal(dark.getState().capacitorChargeChange,0);assert.equal(dark.getState().internalDiodeCharge,0);
const darkFinal=dark.advance(12);assert.ok(darkFinal.voltage>0&&darkFinal.voltage<.1);assert.ok(darkFinal.internalDiodeCharge>0);assert.equal(darkFinal.photoCharge,0);near(darkFinal.internalDiodeCharge,-darkFinal.capacitorChargeChange,'dark discharge');
for(const mode of [0,1,2]){
  const c=controller({settings:{mode}}),start=c.getState(),replay=c.replayState();c.advance(12);assert.ok(c.getState().complete);
  c.reset(replay);assert.deepEqual(c.getState(),start);c.advance(.2);const previous=c.getState();c.update({...previous.values});assert.deepEqual(c.getState(),previous);
  for(const bad of [{mode:8},{distance:0},{background:.15},{intensity:NaN},{bad:2}]){assert.throws(()=>c.update(bad));assert.deepEqual(c.getState(),previous);}
  for(const bad of [{time:13},{initialVoltage:.36},{settings:{mode:0},initialVoltage:.1},{unexpected:1}]){assert.throws(()=>c.reset(bad));assert.deepEqual(c.getState(),previous);}
  assert.throws(()=>c.advance(-1));assert.deepEqual(c.getState(),previous);
  c.update({intensity:78});assert.equal(c.getState().time,0);assert.equal(c.getState().initialVoltage,0);
  for(const fps of [30,60,144]){c.reset({settings:{mode}});for(let i=0;i<12*fps;i++)c.advance(1/fps);const s=c.getState(),expected=sample(circuit({mode}),12);near(s.voltage,expected.voltage,'frame partition voltage',1e-10,1e-12);near(s.photoCharge,expected.photoCharge,'frame partition charge');assert.ok(s.complete);}
}
let combinations=0;
for(let distance=1;distance<=30;distance++)for(let intensity=0;intensity<=150;intensity+=2)for(let bg=0;bg<=20;bg++)for(const blocked of [0,1])for(const drive of [0,1])for(const mode of [0,1,2]){
  const p=circuit({distance,intensity,background:bg/10,blocked,drive,mode}),s=sample(p,12);
  for(const key of ['voltage','photoCurrent','externalCurrent','photoCharge','incidentEnergy'])assert.ok(Number.isFinite(s[key]),key);
  near(p.signalCurrent,blocked?0:intensity*.001/distance**2*(mode===0?4.9998e-6:4.7e-6),'full-grid signal');
  near(s.photoCharge,(p.signalCurrent*(drive?1/3:1)+p.backgroundCurrent)*12/19000,'full-grid charge');
  assert.ok(s.voltage>=-5&&s.voltage<=.35);assert.ok(s.internalDiodeCharge>=-1e-25);combinations++;
}
assert.deepEqual(Object.keys(D),Object.keys(domains));
console.log(JSON.stringify({ok:true,combinations,independentOdeCases:odeCases,checks:['reference points','inverse-square law','partial pulses','photon charge','background','open-circuit charge balance','independent RK4','prepared discharge','atomic validation','reset replay','frame partition']},null,2));

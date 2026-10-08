import assert from 'node:assert/strict';
import {HEATER_DEFAULTS, HEATER_DOMAINS, HEATER_OPTIONS, HEATER_PHYSICS as P,
  heaterSettings, tanklessHeaterPlan, heaterCoilTemperature, heaterPipeTemperature,
  tanklessHeaterAt, createTanklessHeaterController} from './tankless-heater-physics.js';

let checks = 0, combinations = 0, samples = 0, transportSteps = 0;
const ok = (value, message) => {checks++;assert(value, message);};
const eq = (actual, expected) => {checks++;assert.deepEqual(actual, expected);};
const near = (actual, expected, tolerance = 1e-8) => {checks++;assert(Math.abs(actual - expected) <= tolerance, `${actual} != ${expected} within ${tolerance}`);};
const midpoint = (fn, from, to, count = 4096) => {
  const step = (to - from) / count;let sum = 0;
  for (let i = 0; i < count; i++) sum += fn(from + (i + .5) * step);
  return sum * step;
};
const values = Object.fromEntries(Object.entries(HEATER_OPTIONS).map(([key, options]) => [key, options.map(option => option.value)]));
eq(values, {flow:[0,1,4,8,12],set:[35,45,55],inlet:[5,10,20],pipe:[2,5,10]});
eq([P.density,P.specificHeat,P.capacity,P.waterShare,P.activationFlow,P.coilLiters,P.pipeBore], [1,4186,24000,.8,1.5,.5,.014]);
const outcomes = [];
for (const flow of values.flow) for (const set of values.set) for (const inlet of values.inlet) for (const pipe of values.pipe) {
  const setting = {flow,set,inlet,pipe}, plan = tanklessHeaterPlan(setting), rise = set - inlet;
  const expectedFlow = flow < 1.5 ? flow : Math.min(flow, 1440000 / (4186 * rise));
  const expectedHeat = flow < 1.5 ? 0 : expectedFlow * 4186 * rise / 60;
  const coilSeconds = expectedFlow ? 30 / expectedFlow : 0;
  const pipeVolume = Math.PI * .007 ** 2 * pipe * 1000, pipeSeconds = expectedFlow ? pipeVolume * 60 / expectedFlow : 0;
  const closed = flow === 0, heating = flow >= 1.5, hotAt = heating ? 2.5 + coilSeconds + pipeSeconds : null;
  const closeAt = heating ? hotAt + 6 : closed ? 4 : 8;
  const duration = closeAt + (heating ? 2 : closed ? 0 : 1);
  eq(plan.values, setting);near(plan.flow, expectedFlow);near(plan.heat, expectedHeat);near(plan.pipeLiters, pipeVolume);
  near(plan.coilTime, coilSeconds);near(plan.pipeTime, pipeSeconds);eq(plan.hotAt, hotAt);near(plan.closeAt,closeAt);near(plan.duration,duration);
  eq(plan.limited, expectedFlow < flow);ok(plan.heat <= 24000 + 1e-8);
  if (heating) {ok(plan.heat >= 4186 - 1e-8);ok(plan.flow >= 4 - 1e-8);}
  const times = [...new Set([0, .000001, 1, 2, 2.499999, 2.5, 2.6, closeAt - .000001, closeAt, duration - .000001, duration, duration + 99,
    ...(heating ? [hotAt - .000001, hotAt, 2.5 + pipeSeconds, 2.5 + coilSeconds] : []),
    ...Array.from({length:31},(_,i)=>duration*i/30)])].sort((a,b)=>a-b);
  let lastLiters = 0, lastDeliveredEnergy = 0;
  for (const time of times) {
    const now = tanklessHeaterAt(plan,time), held = Math.min(Math.max(0,time),closeAt);samples++;
    ok(Object.values(now).filter(value=>typeof value==='number').every(Number.isFinite));
    eq(now.complete,time>=duration);eq(now.tapOpen,time>0&&time<closeAt&&flow>0);
    eq(now.lit,heating&&time>=2.5&&time<closeAt);eq(now.fan,heating&&time>0&&time<duration);
    near(now.flow,now.tapOpen?expectedFlow:0);near(now.heat,now.lit?expectedHeat:0);
    near(now.fuel,now.heat/.8);near(now.fuel,now.heat+now.loss);
    near(now.deliveredLiters,expectedFlow*held/60);ok(now.deliveredLiters>=lastLiters);lastLiters=now.deliveredLiters;
    near(now.fuelEnergy,now.waterEnergy+now.lostEnergy);near(now.energyResidual,0,1e-7);
    near(now.waterEnergy,now.coilEnergy+now.pipeEnergy+now.deliveredEnergy,1e-7);
    ok(now.deliveredEnergy>=lastDeliveredEnergy-1e-8);lastDeliveredEnergy=now.deliveredEnergy;
    for(let position=0;position<=1.00001;position+=.125){
      const parcelEntered = held - position*coilSeconds;
      const heatedFor = heating ? Math.max(0,held-Math.max(2.5,parcelEntered)) : 0;
      const referenceCoil = inlet + expectedHeat/(.5*4186)*heatedFor;
      const exitTime = held-position*pipeSeconds, coilEntry=exitTime-coilSeconds;
      const pipeHeatedFor=heating?Math.max(0,exitTime-Math.max(2.5,coilEntry)):0;
      const referencePipe=inlet+expectedHeat/(.5*4186)*pipeHeatedFor;
      near(heaterCoilTemperature(plan,position,time),referenceCoil);
      near(heaterPipeTemperature(plan,position,time),referencePipe);
    }
    near(now.tapTemperature,heaterPipeTemperature(plan,1,time));near(now.coilTemperature,heaterCoilTemperature(plan,1,time));
    ok(now.tapTemperature>=inlet-1e-8&&now.tapTemperature<=set+1e-8);
    if (time===0) {eq(now.phase,'ready');eq(now.heat,0);eq(now.fuel,0);eq(now.tapTemperature,inlet);}
    if (time>=duration) {eq(now.flow,0);eq(now.heat,0);eq(now.fan,false);near(now.tapTemperature,heating?set:inlet);}
  }
  for (const time of heating?[3,2.5+coilSeconds*.7,2.5+pipeSeconds+coilSeconds*.45,hotAt,closeAt,duration+5]:[0,3,duration]) {
    const now=tanklessHeaterAt(plan,time);
    const coilEnergy=midpoint(s=>4186*.5*(heaterCoilTemperature(plan,s,time)-inlet),0,1);
    const pipeEnergy=midpoint(s=>4186*pipeVolume*(heaterPipeTemperature(plan,s,time)-inlet),0,1);
    const tapEnergy=midpoint(t=>4186*expectedFlow/60*(heaterPipeTemperature(plan,1,t)-inlet),0,Math.min(time,closeAt),16384);
    near(now.coilEnergy,coilEnergy,.01);near(now.pipeEnergy,pipeEnergy,.025);near(now.deliveredEnergy,tapEnergy,.025);
  }
  const end=tanklessHeaterAt(plan,duration);near(end.hotLiters,heating?expectedFlow/10:0);
  if(heating){near(end.coilEnergy,4186*.5*rise/2);near(end.pipeEnergy,4186*pipeVolume*rise);}
  outcomes.push({settings:setting,flow:+expectedFlow.toFixed(3),heat:+(expectedHeat/1000).toFixed(3),hotAt:hotAt===null?null:+hotAt.toFixed(3)});
  combinations++;
}
eq(combinations,135);

function finiteVolume(settings, coilCells) {
  const {flow,set,inlet,pipe}=settings, actual=Math.min(flow,1440000/(4186*(set-inlet)));
  const coilTime=30/actual, pipeTime=Math.PI*.007**2*pipe*60000/actual;
  const pipeCells=Math.ceil(coilCells*pipeTime/coilTime), count=coilCells+pipeCells;
  const coilStep=coilTime/coilCells, pipeStep=pipeTime/pipeCells, maxStep=.45*Math.min(coilStep,pipeStep);
  const temperatures=new Float64Array(count), next=new Float64Array(count);
  const targets=[2.5+coilTime*.5,2.5+coilTime,2.5+coilTime+pipeTime*.5,2.5+coilTime+pipeTime,2.5+coilTime+pipeTime+2];
  let time=0,errorSquared=0,points=0,maxError=0;
  const plan=tanklessHeaterPlan(settings);
  for(const target of targets){
    while(time<target-1e-12){
      const step=Math.min(maxStep,target-time,time<2.5?2.5-time:Infinity);
      for(let i=0;i<count;i++){
        const source=i<coilCells&&time>=2.5-1e-12?(set-inlet)/coilTime:0;
        next[i]=temperatures[i]+step*((i?temperatures[i-1]:0)-temperatures[i])/(i<coilCells?coilStep:pipeStep)+step*source;
      }
      temperatures.set(next);time+=step;transportSteps++;
    }
    for(let i=0;i<count;i++){
      const expected=(i<coilCells?heaterCoilTemperature(plan,(i+.5)/coilCells,time):heaterPipeTemperature(plan,(i-coilCells+.5)/pipeCells,time))-inlet;
      const difference=Math.abs(temperatures[i]-expected);maxError=Math.max(maxError,difference);errorSquared+=difference*difference;points++;
    }
  }
  return {rms:Math.sqrt(errorSquared/points),maxError,coilCells,pipeCells};
}
const transport=[];
for(const settings of [HEATER_DEFAULTS,{flow:12,set:55,inlet:5,pipe:10},{flow:4,set:35,inlet:20,pipe:2}]){
  const coarse=finiteVolume(settings,128),fine=finiteVolume(settings,512);
  ok(fine.rms<coarse.rms*.6,'Independent transport refinement must converge toward analytic temperatures');
  ok(fine.rms<.16,`Transport RMS ${fine.rms}`);ok(fine.maxError<1.4,`Transport max error ${fine.maxError}`);
  transport.push({settings,coarse,fine});
}

const controller=createTanklessHeaterController();controller.advance(7);const saved=controller.getState();
for(const input of [null,[],false,'bad',{flow:2},{flow:NaN},{flow:Infinity},{set:40},{inlet:15},{pipe:3},{unknown:1}]){controller.update(input);eq(controller.getState(),saved);}
for(const value of [null,false,-1,'1',NaN,Infinity]){controller.advance(value);eq(controller.getState(),saved);}
controller.update(saved.values);eq(controller.getState(),saved);
const exposed=controller.getState();exposed.values.flow=99;exposed.now.tapTemperature=99;eq(controller.getState(),saved);
controller.update({flow:12});eq(controller.getState().clock,0);eq(controller.getState().now.waterEnergy,0);
for(const settings of [{flow:0},{flow:1},{flow:12,inlet:5},{flow:4,set:35,inlet:20,pipe:2}]){
  controller.reset({settings});const initial=controller.getState();controller.advance(1e6);const complete=controller.getState();
  ok(complete.now.complete);controller.reset(controller.replayState());eq(controller.getState(),initial);controller.advance(1e6);eq(controller.getState(),complete);
}
for(const hz of [24,30,60,120]){controller.reset();for(let i=0;i<hz*8;i++)controller.advance(1/hz);near(controller.getState().clock,8);near(controller.getState().now.tapTemperature,tanklessHeaterAt(tanklessHeaterPlan(),8).tapTemperature);}
const plan=tanklessHeaterPlan();eq(tanklessHeaterPlan({}),plan);
for(const object of [HEATER_DEFAULTS,HEATER_DOMAINS,HEATER_OPTIONS,HEATER_OPTIONS.flow,HEATER_OPTIONS.flow[0],P,plan,plan.values])ok(Object.isFrozen(object));
assert.throws(()=>{plan.values.flow=99;});eq(heaterSettings(null),HEATER_DEFAULTS);
eq(tanklessHeaterAt(plan,NaN).clock,0);eq(tanklessHeaterAt(plan,-1).clock,0);
near(tanklessHeaterPlan({pipe:10}).hotAt-tanklessHeaterPlan({pipe:2}).hotAt,Math.PI*.007**2*8*60000/8);
ok(tanklessHeaterPlan({flow:12,inlet:5}).flow<tanklessHeaterPlan({flow:12,inlet:20}).flow);
console.log(JSON.stringify({status:'PASS',checks,combinations,samples,transportSteps,transport,outcomes}));

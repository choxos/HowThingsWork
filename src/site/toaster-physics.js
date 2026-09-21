import {validateControls, validTime, clamp} from './physics-kit.js';

export const TOASTER = Object.freeze({
  volts: 120, coldOhms: 15, sigma: 5.670374419e-8,
  elementCapacity: 45, elementArea: 0.024, emissivity: 0.85, elementConvection: 10,
  toBread: 0.15, sensorShare: 0.005, interiorCapacity: 350, roomLoss: 3.5, airToBread: 12, room: 20,
  slice: 0.05, moisture: 0.38, thickness: 0.015, crust: 0.002, breadHeat: 2800, inward: 1.2, breadArea: 0.0264, crustConductivity: 0.05,
  latent: 2.26e6, fusion: 3.34e5, frozen: -18,
  stripCapacity: 2, stripLoss: 0.04, stripFlexivity: 13.5e-6, stripLength: 0.05, stripThickness: 0.0005,
  durations: Object.freeze([110, 122, 134, 146, 158, 170, 182]),
  browning: 1 / 90, doubling: 10, pause: 30, cutout: 300, lower: 0.6, release: 0.15, rise: 0.35, after: 4, coilPower: 12, step: 0.01, every: 10,
});
export const RESISTANCE_FACTORS = Object.freeze([[20,1],[100,1.01],[200,1.02],[300,1.03],[400,1.04],[500,1.05],[600,1.04],[700,1.04],[800,1.04],[900,1.04],[1000,1.05],[1100,1.06],[1200,1.07]].map(Object.freeze));
export const TIMERS = Object.freeze([Object.freeze({value:0,label:'Heat sensor and solenoid'}),Object.freeze({value:1,label:'Electronic timer and solenoid'})]);
export const STARTS = Object.freeze([Object.freeze({value:0,label:'Cold toaster'}),Object.freeze({value:1,label:'30 seconds after a fresh slice'})]);
export const BREADS = Object.freeze([Object.freeze({value:0,label:'Fresh bread'}),Object.freeze({value:1,label:'Frozen bread'})]);
export const TOASTER_DEFAULTS = Object.freeze({setting:4,timer:0,start:0,bread:0});
export const TOASTER_DOMAINS = Object.freeze({setting:[1,7,1],timer:[0,1,1],start:[0,1,1],bread:[0,1,1]});
const K=273.15, ZONE=2*TOASTER.crust/TOASTER.thickness, ZONE_WATER=TOASTER.slice*ZONE*TOASTER.moisture;

export function resistance(temperature){
  const index=RESISTANCE_FACTORS.findIndex(([T])=>temperature<=T);
  if(index<=0)return TOASTER.coldOhms*(index===0?RESISTANCE_FACTORS[0][1]:RESISTANCE_FACTORS.at(-1)[1]);
  const [Ta,a]=RESISTANCE_FACTORS[index-1],[Tb,b]=RESISTANCE_FACTORS[index];
  return TOASTER.coldOhms*(a+(b-a)*(temperature-Ta)/(Tb-Ta));
}
export const elementPower=temperature=>TOASTER.volts**2/resistance(temperature);
export const stripDeflection=rise=>TOASTER.stripFlexivity*rise*TOASTER.stripLength**2/TOASTER.stripThickness;
export const browningRate=temperature=>temperature>100?TOASTER.browning*2**((temperature-150)/TOASTER.doubling):0;
export const crustDepth=zone=>clamp(1-(zone.ice+zone.water)/ZONE_WATER)*TOASTER.crust;
export const shade=index=>index<0.1?'pale':index<0.4?'light':index<2?'golden':index<8?'dark':'burnt';

export function warmLayer(layer,heat,capacity){
  let {T,ice,water}=layer,steam=0;
  T+=heat/capacity;
  if(ice>0&&T>0){const melt=Math.min(ice,T*capacity/TOASTER.fusion);ice-=melt;water+=melt;T=(T*capacity-melt*TOASTER.fusion)/capacity;}
  if(water>0&&T>100){const boil=Math.min(water,(T-100)*capacity/TOASTER.latent);water-=boil;steam=boil;T=100+((T-100)*capacity-boil*TOASTER.latent)/capacity;}
  return {T,ice,water,steam};
}

export function flows(state,on){
  const f=TOASTER,A=f.elementArea,radiation=T=>f.sigma*f.emissivity*A*((state.Te+K)**4-(T+K)**4),sensorShare=state.sensor===false?0:f.sensorShare;
  let surface=null,toBread=0,airToBread=0,inward=0;
  if(state.inside){
    const heatAt=T=>f.toBread*radiation(T)+f.airToBread*f.breadArea*(state.Ti-T),R=crustDepth(state.zone)/(f.crustConductivity*f.breadArea),drop=R*heatAt(state.zone.T);
    let lo=state.zone.T+Math.min(0,drop),hi=state.zone.T+Math.max(0,drop);
    for(let i=0;i<40;i++){const mid=(lo+hi)/2;if(mid-state.zone.T-R*heatAt(mid)>0)hi=mid;else lo=mid;}
    surface=(lo+hi)/2;toBread=f.toBread*radiation(surface);airToBread=f.airToBread*f.breadArea*(state.Ti-surface);inward=f.inward*(state.zone.T-state.middle.T);
  }
  const toInterior=(1-sensorShare-(state.inside?f.toBread:0))*radiation(state.Ti)+f.elementConvection*A*(state.Te-state.Ti);
  return {power:on?elementPower(state.Te):0,surface,toBread,airToBread,inward,toInterior,toStrip:sensorShare*radiation(state.Tb),stripToRoom:state.sensor===false?0:f.stripLoss*(state.Tb-f.room),toRoom:f.roomLoss*(state.Ti-f.room)};
}

function integrate(start,values,{timer,trip,duration}){
  const f=TOASTER,dt=f.step,zoneCapacity=f.slice*ZONE*f.breadHeat,middleCapacity=f.slice*(1-ZONE)*f.breadHeat;
  const layer=share=>{const water=f.slice*share*f.moisture;return values.bread===1?{T:f.frozen,ice:water,water:0}:{T:f.room,ice:0,water};};
  let state={sensor:values.timer===0,Te:start.Te,Ti:start.Ti,Tb:start.Tb,zone:layer(ZONE),middle:layer(1-ZONE),inside:true,browning:0,steam:0,elementEnergy:0,controlEnergy:0,bread:0,roomEnergy:0};
  const initialIce=state.zone.ice+state.middle.ice,initialStored=f.elementCapacity*state.Te+f.interiorCapacity*state.Ti+f.stripCapacity*state.Tb+zoneCapacity*state.zone.T+middleCapacity*state.middle.T,samples=[];
  let triggered=null,powerOff=null,atTrip=null,atPop=null;
  const snapshot=(t,q)=>({t,sensor:state.sensor,Te:state.Te,Ti:state.Ti,Tb:state.Tb,surfaceT:state.inside?q.surface:atPop.surfaceT,zoneT:state.zone.T,middleT:state.middle.T,water:state.zone.water+state.zone.ice,crust:crustDepth(state.zone),browning:state.browning,steam:state.steam,elementEnergy:state.elementEnergy,controlEnergy:state.controlEnergy,energy:state.elementEnergy+state.controlEnergy,bread:state.bread,roomEnergy:state.roomEnergy,storedEnergy:f.elementCapacity*state.Te+f.interiorCapacity*state.Ti+f.stripCapacity*state.Tb+zoneCapacity*state.zone.T+middleCapacity*state.middle.T-initialStored,latentEnergy:(initialIce-state.zone.ice-state.middle.ice)*f.fusion+state.steam*f.latent,power:q.power,toBread:q.toBread,airToBread:q.airToBread,toStrip:q.toStrip});
  for(let n=0;;n++){
    const t=n*dt;let event=false;
    if(triggered===null&&((timer===0?state.Tb-f.room>=trip:t>=duration-1e-9)||t>=f.cutout-1e-9)){
      triggered=t;atTrip=snapshot(t,flows(state,true));event=true;
    }
    if(triggered!==null&&powerOff===null&&t>=triggered+f.release-1e-9){
      powerOff=t;atPop=snapshot(t,flows(state,true));state.inside=false;event=true;
    }
    const on=powerOff===null,q=flows(state,on),done=powerOff!==null&&t>=powerOff+f.after-1e-9;
    if(n%f.every===0||event||done)samples.push(snapshot(t,q));
    if(done)break;
    const zone=state.inside?warmLayer(state.zone,(q.toBread+q.airToBread-q.inward)*dt,zoneCapacity):{...state.zone,steam:0};
    const middle=state.inside?warmLayer(state.middle,q.inward*dt,middleCapacity):{...state.middle,steam:0};
    state={...state,zone,middle,
      Te:state.Te+(q.power-q.toBread-q.toInterior-q.toStrip)*dt/f.elementCapacity,
      Ti:state.Ti+(q.toInterior-q.toRoom-q.airToBread)*dt/f.interiorCapacity,
      Tb:state.Tb+(q.toStrip-q.stripToRoom)*dt/f.stripCapacity,
      browning:state.browning+(state.inside?browningRate(q.surface)*dt:0),
      steam:state.steam+zone.steam+middle.steam,
      elementEnergy:state.elementEnergy+q.power*dt,
      controlEnergy:state.controlEnergy+(on&&triggered!==null?f.coilPower*dt:0),
      bread:state.bread+(q.toBread+q.airToBread)*dt,
      roomEnergy:state.roomEnergy+(q.toRoom+q.stripToRoom)*dt,
    };
  }
  return {samples,triggered,powerOff,atTrip,atPop,cutout:triggered>=f.cutout-1e-9};
}

function standEmpty(start,seconds){
  const f=TOASTER,dt=f.step;let state={...start,inside:false};
  for(let n=0;n*dt<seconds-1e-9;n++){
    const q=flows(state,false);
    state={...state,Te:state.Te-(q.toInterior+q.toStrip)*dt/f.elementCapacity,Ti:state.Ti+(q.toInterior-q.toRoom)*dt/f.interiorCapacity,Tb:state.Tb+(q.toStrip-q.stripToRoom)*dt/f.stripCapacity};
  }
  return {Te:state.Te,Ti:state.Ti,Tb:state.Tb};
}

const cold={Te:TOASTER.room,Ti:TOASTER.room,Tb:TOASTER.room};
const calibration=integrate(cold,TOASTER_DEFAULTS,{timer:1,duration:TOASTER.durations.at(-1),trip:Infinity});
export const TRIPS=Object.freeze(TOASTER.durations.map(time=>calibration.samples.find(sample=>Math.abs(sample.t-time)<1e-7).Tb-TOASTER.room));
const cache=new Map();

export function toasterPlan(input={}){
  const values=validateControls(input,TOASTER_DEFAULTS,TOASTER_DOMAINS,'toaster'),key=JSON.stringify(values);
  if(cache.has(key))return cache.get(key);
  const f=TOASTER,timing={timer:values.timer,trip:TRIPS[values.setting-1],duration:f.durations[values.setting-1]};
  let start=cold,before=null;
  if(values.start===1){const previous=integrate(cold,{...values,bread:0},timing);before={triggered:previous.triggered,browning:previous.atPop.browning};start=standEmpty(previous.atPop,f.rise+f.pause);}
  const run=integrate(start,values,timing);
  const plan={values,...timing,start,before,...run,popped:f.lower+run.powerOff+f.rise,length:f.lower+run.samples.at(-1).t};
  if(cache.size>=32)cache.delete(cache.keys().next().value);cache.set(key,plan);return plan;
}

export function sampleToaster(input={},time=0){
  validTime(time);
  const plan=toasterPlan(input),f=TOASTER,snap=(value,marks)=>marks.find(mark=>Math.abs(mark-value)<1e-9)??value;
  const clock=snap(Math.min(plan.length,time),[0,f.lower,f.lower+plan.triggered,f.lower+plan.powerOff,plan.popped,plan.length]);
  const heatClock=snap(Math.max(0,clock-f.lower),[0,plan.triggered,plan.powerOff]),samples=plan.samples;
  let lo=0,hi=samples.length-1;
  while(lo+1<hi){const mid=(lo+hi)>>1;if(samples[mid].t<=heatClock)lo=mid;else hi=mid;}
  const a=samples[lo],b=samples[hi],u=clamp((heatClock-a.t)/(b.t-a.t)),now={...plan,clock,heatClock};
  for(const key of ['Te','Ti','Tb','surfaceT','zoneT','middleT','water','crust','browning','steam','elementEnergy','controlEnergy','energy','bread','roomEnergy','storedEnergy','latentEnergy','toBread','airToBread','toStrip'])now[key]=a[key]+(b[key]-a[key])*u;
  const smooth=value=>{const x=clamp(value);return x*x*(3-2*x);};
  now.ready=clock===0;now.on=clock>=f.lower&&heatClock<plan.powerOff;now.coilOn=now.on&&heatClock>=plan.triggered;
  now.sensorContact=plan.values.timer===0&&now.Tb-f.room>=plan.trip-1e-9;
  now.inside=clock>=f.lower&&heatClock<plan.powerOff;
  now.carriage=clock<f.lower?1-smooth(clock/f.lower):smooth((heatClock-plan.powerOff)/f.rise);
  now.catch=clock>0&&clock<f.lower?smooth(clock/0.1):smooth((heatClock-plan.triggered)/f.release)*(1-smooth((heatClock-plan.powerOff-f.rise*.5)/(f.rise*.5)));
  now.power=now.on?elementPower(now.Te):0;now.controlPower=now.coilOn?f.coilPower:0;
  if(!now.on){now.toBread=0;now.airToBread=0;}
  now.complete=clock>=plan.length;now.shade=shade(now.browning);
  now.phase=now.ready?'Ready':clock<f.lower?'Lowering the rack':now.coilOn?'Solenoid releasing catch':now.on?'Toasting':clock<plan.popped?'Rack rising':'Popped';
  return now;
}

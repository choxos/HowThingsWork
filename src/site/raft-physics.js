import {clamp, validateControls} from './physics-kit.js';

export const RAFT = Object.freeze({length:2, width:.2, height:.2, count:6, volume:.48, steelDensity:7850, gravity:9.81, floor:-.95, duration:12, dragLinear:1600, dragQuadratic:800});
export const RAFT_DEFAULTS = Object.freeze({cargo:100, wood:500, water:1000});
export const RAFT_DOMAINS = Object.freeze({cargo:[0,400,10], wood:[300,800,50], water:[1000,1025,25]});
export const raftControls = input => validateControls(input, RAFT_DEFAULTS, RAFT_DOMAINS, 'raft');

export function raftForces(values, bottom, velocity=0) {
  const side=Math.cbrt(values.cargo/(4*RAFT.steelDensity));
  const timberVolume=RAFT.count*RAFT.length*RAFT.width*clamp(-bottom,0,RAFT.height);
  const cargoVolume=4*side*side*clamp(-bottom-RAFT.height,0,side);
  const displaced=timberVolume+cargoVolume, mass=RAFT.volume*values.wood+values.cargo;
  const weight=mass*RAFT.gravity, buoyancy=values.water*RAFT.gravity*displaced;
  const drag=-RAFT.dragLinear*velocity-RAFT.dragQuadratic*velocity*Math.abs(velocity);
  const support=bottom<=RAFT.floor+1e-10&&velocity<=0?Math.max(0,weight-buoyancy-drag):0;
  return {side,timberVolume,cargoVolume,displaced,mass,weight,buoyancy,drag,support,net:buoyancy+drag+support-weight};
}

export function raftEquilibrium(values) {
  const woodMass=RAFT.volume*values.wood, required=(woodMass+values.cargo)/values.water;
  const side=Math.cbrt(values.cargo/(4*RAFT.steelDensity));
  const capacity=RAFT.volume+values.cargo/RAFT.steelDensity;
  const dryCargo=(values.water-values.wood)*RAFT.volume;
  const maxCargo=dryCargo/(1-values.water/RAFT.steelDensity);
  if(required>capacity+1e-12)return {bottom:RAFT.floor,status:'grounded',dryCargo,maxCargo};
  const draft=required<=RAFT.volume?required/(RAFT.count*RAFT.length*RAFT.width):RAFT.height+(required-RAFT.volume)/(4*side*side);
  return {bottom:-draft,status:draft<RAFT.height-1e-9?'dry':draft<=RAFT.height+1e-9?'awash':'wet',dryCargo,maxCargo};
}

export const raftStart = values => ({elapsed:0,bottom:-RAFT.height*values.wood/values.water,velocity:0});

export function advanceRaft(state, values, seconds) {
  if(!Number.isFinite(seconds)||seconds<=0)return {...state};
  let remaining=Math.min(seconds,Math.max(0,RAFT.duration-state.elapsed));
  const next={...state,elapsed:Math.min(RAFT.duration,state.elapsed+remaining)};
  // One vertical degree of freedom. RK4 bounds the step across the waterline;
  // floor contact is inelastic, and lifts off as soon as net free force is up.
  const acceleration=(y,v)=>raftForces(values,y,v).net/(RAFT.volume*values.wood+values.cargo);
  while(remaining>1e-12){
    const h=Math.min(remaining,1/240),y=next.bottom,v=next.velocity;
    const a1=acceleration(y,v),v2=v+a1*h/2,a2=acceleration(y+v*h/2,v2);
    const v3=v+a2*h/2,a3=acceleration(y+v2*h/2,v3),v4=v+a3*h,a4=acceleration(y+v3*h,v4);
    next.bottom+=h*(v+2*v2+2*v3+v4)/6;
    next.velocity+=h*(a1+2*a2+2*a3+a4)/6;
    if(next.bottom<RAFT.floor){next.bottom=RAFT.floor;next.velocity=Math.max(0,next.velocity);}
    remaining-=h;
  }
  return next;
}

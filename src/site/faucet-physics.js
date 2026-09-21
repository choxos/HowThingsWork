export const faucetConstants = Object.freeze({
  pitch:.0015, turnsToStop:4, handleRadius:.045, seatDiameter:.012,
  discharge:.62, pipeLoss:200, pipeDiameter:.015, density:1000,
  waveSpeed:1200, pipeRun:20, bucket:10, bucketRadius:.125,
  dripVolume:.05, collectionSeconds:20, leakSeconds:2,
});
export const FAUCET_DEFAULTS = Object.freeze({turns:1,pressure:2,washer:0,aerator:1,closing:1});
export const FAUCET_DOMAINS = Object.freeze({turns:[0,4,.25],pressure:[.5,6,.5],washer:[0,2,1],aerator:[0,1,1],closing:[.05,2,.05]});
export const washerLeak = Object.freeze({0:0,1:.0007,2:.007});
export const aeratorLoss = Object.freeze({0:0,1:60});
const C=faucetConstants, area=d=>Math.PI*d*d/4;

function coefficients(values){
  const bore=area(C.seatDiameter),pipeArea=area(C.pipeDiameter);
  const pipe=C.pipeLoss/pipeArea**2,aerator=aeratorLoss[values.aerator]/pipeArea**2,outlet=1/bore**2;
  return {bore,pipeArea,pipe,aerator,outlet,other:pipe+aerator+outlet};
}

export function faucetFlow(values){
  const k=coefficients(values),lift=Math.max(0,values.turns)*C.pitch;
  const curtain=Math.PI*C.seatDiameter*lift,leak=washerLeak[values.washer]*1e-6;
  const openArea=Math.max(leak,Math.min(k.bore,curtain));
  const supply=values.pressure*1e5;
  const seat=openArea>0?1/(C.discharge*openArea)**2:0;
  const flow=openArea>0?Math.sqrt(2*supply/C.density/(seat+k.other)):0;
  const drop=coefficient=>C.density*flow**2*coefficient/2/1e5;
  return {
    lift,bore:k.bore,curtain,leak,openArea,flow,litersPerMinute:flow*60000,
    pipeSpeed:flow/k.pipeArea,spoutSpeed:flow/k.bore,
    fillTime:flow>0?C.bucket/(flow*1000):null,
    seatDrop:openArea>0?drop(seat):values.pressure,pipeDrop:drop(k.pipe),
    aeratorDrop:drop(k.aerator),outletHead:drop(k.outlet),
    pipePeriod:2*C.pipeRun/C.waveSpeed,fullSurge:C.density*C.waveSpeed*flow/k.pipeArea/1e5,
    sealed:lift===0&&leak===0,dripping:lift===0&&leak>0,
    limitedBy:openArea===0?'sealed washer':curtain<=leak?'washer leak':curtain<k.bore?'washer gap':'seat bore',
  };
}

// Integral of Q(turns) d(turns), split at the leak floor and the seat-bore cap.
// This keeps collected volume independent of animation frame size during closure.
function flowIntegral(values,turns){
  const k=coefficients(values),c=Math.PI*C.seatDiameter*C.pitch;
  const leak=washerLeak[values.washer]*1e-6,low=leak/c,high=k.bore/c;
  const end=Math.max(0,turns),a=Math.min(end,low),b=Math.min(end,high);
  let total=faucetFlow({...values,turns:0}).flow*a;
  if(b>low){
    const S=C.discharge*Math.sqrt(2*values.pressure*1e5/C.density),B=C.discharge**2*k.other;
    const primitive=t=>S*c*t*t/(Math.sqrt(1+B*c*c*t*t)+1);
    total+=primitive(b)-primitive(low);
  }
  if(end>high)total+=faucetFlow({...values,turns:high}).flow*(end-high);
  return total;
}

export function faucetPlan(values){
  const open=faucetFlow(values),shut=faucetFlow({...values,turns:0});
  const closing=values.turns>0?values.closing:0;
  const duration=C.collectionSeconds+closing+(values.turns>0?C.leakSeconds:0);
  const closureVolume=closing?closing/values.turns*flowIntegral(values,values.turns):0;
  return {open,shut,closing,duration,closureVolume,
    suddenStopReference:C.density*C.waveSpeed*(open.pipeSpeed-shut.pipeSpeed)/1e5,
    idealForceRatio:2*Math.PI*C.handleRadius/C.pitch};
}

export function sampleFaucet(values,time){
  const p=faucetPlan(values),elapsed=Math.max(0,Math.min(p.duration,Number.isFinite(time)?time:0));
  const closingFor=Math.max(0,Math.min(p.closing,elapsed-C.collectionSeconds));
  const turns=p.closing?values.turns*(1-closingFor/p.closing):values.turns;
  const closedFor=Math.max(0,elapsed-C.collectionSeconds-p.closing);
  const duringClosure=p.closing?p.closing/values.turns*(flowIntegral(values,values.turns)-flowIntegral(values,turns)):0;
  const collected=p.open.flow*Math.min(elapsed,C.collectionSeconds)+duringClosure+p.shut.flow*closedFor;
  const flow=faucetFlow({...values,turns});
  const stage=elapsed===0?'ready':elapsed>=p.duration?'complete':elapsed<C.collectionSeconds?'collecting':closingFor<p.closing?'closing':'leak-check';
  return {...flow,...p,elapsed,turns,closingFor,stage,complete:elapsed>=p.duration,
    collected,filled:collected*1000,closureCollected:duringClosure*1e6,
    bucketLevel:collected/(Math.PI*C.bucketRadius**2),
    dripsPerMinute:p.shut.flow*60*1e6/C.dripVolume,
    dayLoss:p.shut.flow*86400*1000,
  };
}

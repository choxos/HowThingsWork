export const BOTTLE_OPENER_DEFAULTS=Object.freeze({effort:16,arm:12,direction:0,stiffness:12,placement:0});
export const BOTTLE_OPENER_DOMAINS={effort:[0,30,1],arm:[5,20,1],direction:[0,90,15],stiffness:[4,20,2],placement:[0,1,1]};
export const BOTTLE_OPENER_CONSTANTS=Object.freeze({hookSpan:.027,hookDrop:.004,preload:20,releaseLift:.003,angularRate:.035,duration:8,withdrawalDuration:.25,removalDuration:.75});

export function sampleBottleOpener(input={},time=0){
 if(!input||typeof input!=='object'||Array.isArray(input))throw new TypeError('Expected bottle-opener controls');
 for(const key of Object.keys(input))if(!Object.hasOwn(BOTTLE_OPENER_DOMAINS,key))throw new RangeError('Unknown '+key);
 const values={...BOTTLE_OPENER_DEFAULTS,...input};
 for(const [key,[lo,hi,step]] of Object.entries(BOTTLE_OPENER_DOMAINS)){const n=values[key];if(!Number.isFinite(n)||n<lo||n>hi||Math.abs((n-lo)/step-Math.round((n-lo)/step))>1e-8)throw new RangeError('Invalid '+key);}
 if(!Number.isFinite(time)||time<0)throw new RangeError('Invalid trial time');
 const c=BOTTLE_OPENER_CONSTANTS,elapsed=Math.min(time,c.duration),engaged=values.placement===0,arm=values.arm/100,direction=values.direction*Math.PI/180,stiffness=values.stiffness*1000;
 const liftAt=a=>c.hookSpan*Math.sin(a)+c.hookDrop*(1-Math.cos(a)),loadArmAt=a=>c.hookSpan*Math.cos(a)+c.hookDrop*Math.sin(a);
 const forceAt=a=>{const momentArm=arm*Math.cos(a+direction);return momentArm>1e-12?(c.preload+stiffness*liftAt(a))*loadArmAt(a)/momentArm:Infinity;};
 let low=0,high=Math.PI/4;for(let i=0;i<60;i++){const mid=(low+high)/2;if(liftAt(mid)<c.releaseLift)low=mid;else high=mid;}const releaseAngle=(low+high)/2;
 const peak=forceAt(releaseAngle),canRelease=engaged&&values.effort+1e-10>=peak;let limit=releaseAngle;
 if(engaged&&!canRelease){if(values.effort<forceAt(0))limit=0;else{low=0;high=releaseAngle;for(let i=0;i<60;i++){const mid=(low+high)/2;if(forceAt(mid)<=values.effort)low=mid;else high=mid;}limit=(low+high)/2;}}
 const releaseTime=canRelease?releaseAngle/c.angularRate:null,released=canRelease&&elapsed>=releaseTime;
 const angle=engaged?Math.min(c.angularRate*elapsed,limit):values.effort>0&&values.direction<90?Math.min(c.angularRate*elapsed,.28,Math.PI/2-direction):0;
 const hookLift=engaged?(released?c.releaseLift:Math.min(c.releaseLift,liftAt(angle))):0,liftFraction=hookLift/c.releaseLift,moving=engaged?!released&&angle<limit:values.effort>0&&angle<Math.min(.28,Math.PI/2-direction);
 const mode=!engaged?'missed':released?'released':angle>=limit&&!canRelease?'stall':'lifting';
 const momentArm=arm*Math.cos(angle+direction),loadArm=loadArmAt(angle),retainingResistance=c.preload+stiffness*hookLift;
 const required=forceAt(angle),actualHandForce=!engaged||released?0:moving?required:values.effort;
 const availableTorque=momentArm>1e-12?values.effort*momentArm:0,requiredTorque=retainingResistance*loadArm;
 const hookForce=engaged&&!released?Math.max(0,actualHandForce*momentArm/loadArm):0;
 const supportHorizontal=-actualHandForce*Math.sin(direction),supportVertical=hookForce-actualHandForce*Math.cos(direction);
 const capWork=c.preload*hookLift+.5*stiffness*hookLift*hookLift,inputWork=capWork;
 const withdrawalProgress=released?Math.min(1,(elapsed-releaseTime)/c.withdrawalDuration):0,removalProgress=released?Math.max(0,Math.min(1,(elapsed-releaseTime-c.withdrawalDuration)/c.removalDuration)):0;
 const openerWithdrawal=withdrawalProgress**2*(3-2*withdrawalProgress),capRemoval=removalProgress**2*(3-2*removalProgress);
 return {values,elapsed,duration:c.duration,progress:elapsed/c.duration,engaged,mode,moving,angle,releaseAngle,stallAngle:engaged&&!canRelease?limit:null,hookLift,releaseLift:c.releaseLift,liftFraction,releaseTime,released,openerWithdrawal,capRemoval,
  arm,direction,availableHandForce:values.effort,actualHandForce,hookForce,retainingResistance,availableTorque,requiredTorque,requiredHandForce:Number.isFinite(required)?required:null,peakRequiredHandForce:Number.isFinite(peak)?peak:null,
  hookX:c.hookSpan*Math.cos(angle)+c.hookDrop*Math.sin(angle),hookY:liftAt(angle)-c.hookDrop,handX:arm*Math.cos(angle),handY:arm*Math.sin(angle),handTravel:arm*angle,inputWork,capWork,energyResidual:inputWork-capWork,supportHorizontal,supportVertical,complete:elapsed>=c.duration};
}

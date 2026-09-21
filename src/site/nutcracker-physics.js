export const NUTCRACKER_DEFAULTS=Object.freeze({effort:30,arm:14,seat:3.5,stiffness:40,diameter:30});
export const NUTCRACKER_DOMAINS={effort:[0,60,1],arm:[10,20,1],seat:[3.5,6,.5],stiffness:[20,80,10],diameter:[24,36,2]};
export const NUTCRACKER_CONSTANTS=Object.freeze({bossRadius:.004,preload:20,failureCompression:.002,angularRate:.01,duration:8,crackHoldDuration:.25,withdrawalDuration:.75,removalDuration:.75,inspectionOpening:.14});

export function sampleNutcracker(input={},time=0){
 if(!input||typeof input!=='object'||Array.isArray(input))throw new TypeError('Expected nutcracker controls');
 for(const key of Object.keys(input))if(!Object.hasOwn(NUTCRACKER_DOMAINS,key))throw new RangeError('Unknown '+key);
 const values={...NUTCRACKER_DEFAULTS,...input};
 for(const [key,[lo,hi,step]] of Object.entries(NUTCRACKER_DOMAINS)){const n=values[key];if(!Number.isFinite(n)||n<lo||n>hi||Math.abs((n-lo)/step-Math.round((n-lo)/step))>1e-8)throw new RangeError('Invalid '+key);}
 if(!Number.isFinite(time)||time<0)throw new RangeError('Invalid trial time');
 const c=NUTCRACKER_CONSTANTS,elapsed=Math.min(time,c.duration),arm=values.arm/100,seat=values.seat/100,diameter=values.diameter/1000,stiffness=values.stiffness*1000,mechanicalAdvantage=arm/seat;
 const initialAngle=Math.asin((diameter+2*c.bossRadius)/(2*seat)),failureAngle=Math.asin((diameter-c.failureCompression+2*c.bossRadius)/(2*seat));
 const availableJawCompression=values.effort*mechanicalAdvantage,peakResistance=c.preload+stiffness*c.failureCompression,peakRequiredForceEach=peakResistance/mechanicalAdvantage;
 const canCrack=availableJawCompression+1e-10>=peakResistance,maxCompression=canCrack?c.failureCompression:Math.max(0,(availableJawCompression-c.preload)/stiffness),limitAngle=Math.asin((diameter-maxCompression+2*c.bossRadius)/(2*seat));
 const crackTime=canCrack?(initialAngle-failureAngle)/c.angularRate:null,cracked=canCrack&&elapsed>=crackTime;
 const angle=Math.max(limitAngle,initialAngle-c.angularRate*elapsed),compression=cracked?c.failureCompression:Math.min(maxCompression,Math.max(0,diameter+2*c.bossRadius-2*seat*Math.sin(angle)));
 const moving=!cracked&&angle>limitAngle+1e-12,mode=cracked?'cracked':!moving?'stall':'compressing',resistance=c.preload+stiffness*compression;
 const requiredForceEach=resistance/mechanicalAdvantage,actualForceEach=cracked?0:Math.min(values.effort,requiredForceEach),jawCompression=actualForceEach*mechanicalAdvantage;
 const smooth=x=>{const p=Math.max(0,Math.min(1,x));return p*p*(3-2*p);};
 const jawWithdrawal=cracked?smooth((elapsed-crackTime-c.crackHoldDuration)/c.withdrawalDuration):0,shellRemoval=cracked?smooth((elapsed-crackTime-c.crackHoldDuration-c.withdrawalDuration)/c.removalDuration):0;
 const displayedAngle=angle+(initialAngle+c.inspectionOpening-angle)*jawWithdrawal,jawGap=2*seat*Math.sin(displayedAngle)-2*c.bossRadius,nutX=seat*Math.cos(angle);
 const handTravelEach=mechanicalAdvantage*compression/2,totalHandTravel=2*handTravelEach,shellDeformationWork=c.preload*compression+.5*stiffness*compression*compression,inputWork=shellDeformationWork;
 return {values,time:elapsed,elapsed,duration:c.duration,progress:elapsed/c.duration,complete:elapsed>=c.duration,trialComplete:elapsed>=c.duration,mode,moving,canCrack,cracked,crackTime,
  arm,seat,diameter,stiffness,mechanicalAdvantage,initialAngle,failureAngle,angle,displayedAngle,angleTravel:initialAngle-angle,stallAngle:canCrack?null:limitAngle,compression,maxCompression,failureCompression:c.failureCompression,compressionFraction:compression/c.failureCompression,
  resistance,peakResistance,availableForceEach:values.effort,actualForceEach,requiredForceEach,peakRequiredForceEach,reserveForceEach:values.effort-actualForceEach,availableJawCompression,jawCompression,hingeReactionEach:jawCompression-actualForceEach,
  handTravelEach,totalHandTravel,handArcLengthEach:arm*(initialAngle-angle),inputWork,shellDeformationWork,energyResidual:inputWork-shellDeformationWork,jawWithdrawal,shellRemoval,jawGap,nutX,jawX:seat*Math.cos(displayedAngle),jawY:seat*Math.sin(displayedAngle),handX:arm*Math.cos(displayedAngle),handY:arm*Math.sin(displayedAngle)};
}

export const CAN_OPENER_DEFAULTS=Object.freeze({clamp:1,normal:80,effort:4,arm:5,edge:0,diameter:80});
export const CAN_OPENER_DOMAINS={clamp:[0,1,1],normal:[0,160,10],effort:[0,12,.5],arm:[2,8,.5],edge:[0,1,1],diameter:[50,120,10]};
export const CAN_OPENER_CONSTANTS=Object.freeze({feedRadius:.01,driverTeeth:20,drivenTeeth:20,friction:.35,sharpResistance:12,dullResistance:28,crankRate:.5,duration:16,openerWithdrawalDuration:.25,lidLiftDuration:.75});

// The operator attempts a slow fixed rate subject to a hand-force limit.
// Only the force actually required by the active load performs work.
export function sampleCanOpener(input={},time=0){
 if(!input||typeof input!=='object'||Array.isArray(input))throw new TypeError('Expected can-opener controls');
 for(const key of Object.keys(input))if(!Object.hasOwn(CAN_OPENER_DOMAINS,key))throw new RangeError('Unknown '+key);
 const values={...CAN_OPENER_DEFAULTS,...input};
 for(const [key,[lo,hi,step]] of Object.entries(CAN_OPENER_DOMAINS)){
  const n=values[key];if(!Number.isFinite(n)||n<lo||n>hi||Math.abs((n-lo)/step-Math.round((n-lo)/step))>1e-8)throw new RangeError('Invalid '+key);
 }
 if(!Number.isFinite(time)||time<0)throw new RangeError('Invalid trial time');
 const c=CAN_OPENER_CONSTANTS,elapsed=Math.min(c.duration,time),clamped=Boolean(values.clamp),canRadius=values.diameter/2000,armRadius=values.arm/100;
 const gearRatio=c.driverTeeth/c.drivenTeeth,torqueAvailable=values.effort*armRadius,driveForceAvailable=torqueAvailable/(gearRatio*c.feedRadius);
 const tractionCapacity=clamped?c.friction*values.normal:0,cuttingResistance=values.edge?c.dullResistance:c.sharpResistance;
 const loadAtWheel=Math.min(tractionCapacity,cuttingResistance),tolerance=1e-10;
 const operation=!clamped?'open':values.effort===0||driveForceAvailable+tolerance<loadAtWheel?'stall':tractionCapacity+tolerance<cuttingResistance?'slip':'cutting';
 const circumference=2*Math.PI*canRadius,turnsRequired=canRadius/(c.feedRadius*gearRatio),cutTime=turnsRequired/c.crankRate;
 const canMove=operation==='cutting',canTurnCrank=values.effort>0&&operation!=='stall';
 const crankTurns=canTurnCrank?c.crankRate*(canMove?Math.min(elapsed,cutTime):elapsed):0,driverAngle=2*Math.PI*crankTurns;
 const feedAngle=clamped?-driverAngle*gearRatio:0,cutterAngle=driverAngle,feedTravel=-feedAngle*c.feedRadius;
 const cutLength=canMove?Math.min(circumference,feedTravel):0,cutFraction=cutLength/circumference,canAngle=cutLength/canRadius;
 const lidReleased=canMove&&elapsed>=cutTime,withdrawalProgress=lidReleased?Math.max(0,Math.min(1,(elapsed-cutTime)/c.openerWithdrawalDuration)):0;
 const liftProgress=lidReleased?Math.max(0,Math.min(1,(elapsed-cutTime-c.openerWithdrawalDuration)/c.lidLiftDuration)):0;
 const openerWithdrawal=withdrawalProgress*withdrawalProgress*(3-2*withdrawalProgress),lidLift=liftProgress*liftProgress*(3-2*liftProgress),mode=lidReleased?'released':operation;
 const moving=canTurnCrank&&!lidReleased,usedWheelForce=operation==='cutting'?cuttingResistance:operation==='slip'?tractionCapacity:0;
 const actualHandForce=moving?usedWheelForce*gearRatio*c.feedRadius/armRadius:0,handTravel=driverAngle*armRadius;
 const workInput=usedWheelForce*gearRatio*c.feedRadius*driverAngle,cuttingWork=cuttingResistance*cutLength,slidingWork=operation==='slip'?tractionCapacity*feedTravel:0;
 return {values,elapsed,duration:c.duration,progress:elapsed/c.duration,clamped,operation,mode,canRadius,armRadius,gearRatio,torqueAvailable,driveForceAvailable,tractionCapacity,cuttingResistance,actualHandForce,requiredHandForce:cuttingResistance*gearRatio*c.feedRadius/armRadius,
  crankTurns,driverAngle,feedAngle,cutterAngle,canAngle,feedTravel,cutLength,circumference,cutFraction,turnsRequired,cutTime,handTravel,workInput,cuttingWork,slidingWork,energyResidual:workInput-cuttingWork-slidingWork,
  lidReleased,openerWithdrawal,lidLift,lidLiftOnset:canMove?cutTime+c.openerWithdrawalDuration:null,moving,complete:elapsed>=c.duration};
}

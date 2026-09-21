export const ROBERVAL_BALANCE_DEFAULTS=Object.freeze({leftMass:1.25,rightMass:1,leftOffset:0,rightOffset:0,initialAngle:0,gravity:0});
export const ROBERVAL_BALANCE_DOMAINS={leftMass:[0,2,.25],rightMass:[0,2,.25],leftOffset:[-.18,.18,.06],rightOffset:[-.18,.18,.06],initialAngle:[-.12,.12,.12],gravity:[0,1,1]};
export const ROBERVAL_BALANCE_GRAVITIES=Object.freeze([9.81,1.62]);
export const ROBERVAL_BALANCE_CONSTANTS=Object.freeze({halfLength:.45,pivotSeparation:.35,payloadHeight:.30,beamMassEach:.25,beamInertiaEach:.016875,combinedBeamInertia:.03375,damping:.8,stopAngle:.2,stopRadius:.30,physicalDuration:2,duration:8,timeScale:4,integrationStep:.001});
const C=ROBERVAL_BALANCE_CONSTANTS;
export function robervalBalanceGeometry(angle,leftOffset=0,rightOffset=0){
 if(!Number.isFinite(angle)||Math.abs(angle)>C.stopAngle||![leftOffset,rightOffset].every(n=>Number.isFinite(n)&&Math.abs(n)<=.18))throw new RangeError('Invalid Roberval geometry');
 const result={};for(const [name,sign,offset] of [['left',-1,leftOffset],['right',1,rightOffset]]){const x=sign*C.halfLength*Math.cos(angle),y=sign*C.halfLength*Math.sin(angle);result[name]={top:[x,y+C.pivotSeparation/2,0],bottom:[x,y-C.pivotSeparation/2,0],carrier:[x,y,0],payload:[x+offset,y+C.payloadHeight,0]};}return result;
}
export function sampleRobervalBalance(input={},time=0){
 if(!input||typeof input!=='object'||Array.isArray(input))throw new TypeError('Expected Roberval balance controls');
 for(const key of Object.keys(input))if(!Object.hasOwn(ROBERVAL_BALANCE_DOMAINS,key))throw new RangeError('Unknown '+key);
 const values={...ROBERVAL_BALANCE_DEFAULTS,...input};
 for(const [key,[lo,hi,step]] of Object.entries(ROBERVAL_BALANCE_DOMAINS)){const n=values[key];if(!Number.isFinite(n)||n<lo||n>hi||Math.abs((n-lo)/step-Math.round((n-lo)/step))>1e-8)throw new RangeError('Invalid '+key);}
 if(![-.12,0,.12].includes(values.initialAngle)||!Number.isInteger(values.gravity))throw new RangeError('Invalid Roberval balance option');
 if(!Number.isFinite(time)||time<0)throw new RangeError('Invalid trial time');
 const elapsed=Math.min(time,C.duration),physicalTime=elapsed/C.timeScale,gravity=ROBERVAL_BALANCE_GRAVITIES[values.gravity],inertia=C.combinedBeamInertia+C.halfLength**2*(values.leftMass+values.rightMass),driveCoefficient=gravity*C.halfLength*(values.leftMass-values.rightMass);
 function rhs(state){const [angle,speed]=state,drive=driveCoefficient*Math.cos(angle);if(speed===0&&((angle<=-C.stopAngle&&drive<0)||(angle>=C.stopAngle&&drive>0)))return [0,0,0];return [speed,(drive-C.damping*speed)/inertia,C.damping*speed**2];}
 function step(state,h){const k1=rhs(state),k2=rhs(state.map((n,i)=>n+h*k1[i]/2)),k3=rhs(state.map((n,i)=>n+h*k2[i]/2)),k4=rhs(state.map((n,i)=>n+h*k3[i]));return state.map((n,i)=>n+h*(k1[i]+2*k2[i]+2*k3[i]+k4[i])/6);}
 let state=[values.initialAngle,0,0],clock=0,impactHeat=0;const impactEvents=[];
 while(clock<physicalTime-1e-13){
  if(rhs(state).every(n=>n===0))break;
  const h=Math.min(C.integrationStep,physicalTime-clock),candidate=step(state,h),lower=candidate[0]<-C.stopAngle||(candidate[1]<0&&candidate[0]<=-C.stopAngle+1e-14),upper=candidate[0]>C.stopAngle||(candidate[1]>0&&candidate[0]>=C.stopAngle-1e-14);
  if(lower||upper){
   const bound=lower?-C.stopAngle:C.stopAngle;let low=0,high=h;
   for(let i=0;i<45;i++){const middle=(low+high)/2,q=step(state,middle)[0];if((bound<0&&q>bound)||(bound>0&&q<bound))low=middle;else high=middle;}
   const hit=step(state,high),stopGeneralizedImpulse=-inertia*hit[1],event={physicalTime:clock+high,elapsed:(clock+high)*C.timeScale,angle:bound,incomingSpeed:hit[1],stopGeneralizedImpulse,stopLeftImpulse:-stopGeneralizedImpulse/(2*C.stopRadius*Math.cos(bound)),stopRightImpulse:stopGeneralizedImpulse/(2*C.stopRadius*Math.cos(bound)),impactHeat:.5*inertia*hit[1]**2};
   for(const [name,sign,mass] of [['left',-1,values.leftMass],['right',1,values.rightMass]])event[name]=[mass*sign*C.halfLength*Math.sin(bound)*hit[1],-mass*sign*C.halfLength*Math.cos(bound)*hit[1],0];
   impactEvents.push(event);impactHeat+=event.impactHeat;state=[bound,0,hit[2]];clock+=high;
  }else{state=candidate;clock+=h;}
 }
 const [angle,speed,damperHeat]=state,acceleration=rhs(state)[1],gravityTorque=driveCoefficient*Math.cos(angle),damperTorque=-C.damping*speed,atStop=speed===0&&angle===-C.stopAngle&&gravityTorque<0?-1:speed===0&&angle===C.stopAngle&&gravityTorque>0?1:0,stopTorque=atStop?-gravityTorque:0,stopLeftForce=-stopTorque/(2*C.stopRadius*Math.cos(angle)),stopRightForce=stopTorque/(2*C.stopRadius*Math.cos(angle)),kineticEnergy=.5*inertia*speed**2,potentialEnergy=-driveCoefficient*(Math.sin(angle)-Math.sin(values.initialAngle)),last=impactEvents.at(-1),sides=robervalBalanceGeometry(angle,values.leftOffset,values.rightOffset);
 for(const [name,sign,mass,offset] of [['left',-1,values.leftMass,values.leftOffset],['right',1,values.rightMass,values.rightOffset]]){
  const ax=sign*C.halfLength*(-Math.cos(angle)*speed**2-Math.sin(angle)*acceleration),ay=sign*C.halfLength*(-Math.sin(angle)*speed**2+Math.cos(angle)*acceleration),fx=mass*ax,supportForce=mass*(gravity+ay),panCouple=offset*supportForce-C.payloadHeight*fx,stoppingImpulse=last?[...last[name]]:[0,0,0],stoppingCouple=offset*stoppingImpulse[1]-C.payloadHeight*stoppingImpulse[0];
  Object.assign(sides[name],{mass,offset,sign,displacement:[sign*C.halfLength*(Math.cos(angle)-Math.cos(values.initialAngle)),sign*C.halfLength*(Math.sin(angle)-Math.sin(values.initialAngle)),0],velocity:[-sign*C.halfLength*Math.sin(angle)*speed,sign*C.halfLength*Math.cos(angle)*speed,0],acceleration:[ax,ay,0],force:[fx,supportForce,0],supportForce,panCouple,topHorizontalForce:fx/2-panCouple/C.pivotSeparation,bottomHorizontalForce:fx/2+panCouple/C.pivotSeparation,stoppingImpulse,stoppingCouple,topHorizontalImpulse:stoppingImpulse[0]/2-stoppingCouple/C.pivotSeparation,bottomHorizontalImpulse:stoppingImpulse[0]/2+stoppingCouple/C.pivotSeparation});
 }
 const fixedUpperHorizontalReaction=sides.left.topHorizontalForce+sides.right.topHorizontalForce,fixedLowerHorizontalReaction=sides.left.bottomHorizontalForce+sides.right.bottomHorizontalForce,fixedBearingCouple=C.pivotSeparation/2*(fixedLowerHorizontalReaction-fixedUpperHorizontalReaction);
 return {values,elapsed,duration:C.duration,progress:elapsed/C.duration,complete:elapsed>=C.duration,physicalTime,angle,speed,acceleration,inertia,gravity,neutralBalance:values.leftMass===values.rightMass,atStop,stoppedImbalance:atStop!==0,gravityTorque,damperTorque,stopTorque,stopLeftForce,stopRightForce,kineticEnergy,potentialEnergy,damperHeat,impactHeat,energyResidual:kineticEnergy+potentialEnergy+damperHeat+impactHeat,torqueResidual:inertia*acceleration-gravityTorque-damperTorque-stopTorque,...sides,fixedUpperHorizontalReaction,fixedLowerHorizontalReaction,fixedBearingCouple,stopHits:impactEvents.length,lastImpactTime:last?.elapsed??0,lastImpactPhysicalTime:last?.physicalTime??0,lastIncomingSpeed:last?.incomingSpeed??0,stopGeneralizedImpulse:last?.stopGeneralizedImpulse??0,stopLeftImpulse:last?.stopLeftImpulse??0,stopRightImpulse:last?.stopRightImpulse??0,impactEvents};
}

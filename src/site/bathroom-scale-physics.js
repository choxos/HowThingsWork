export const BATHROOM_SCALE_DEFAULTS=Object.freeze({mass:60,stiffness:30000,zero:0,position:0,gravity:0});
export const BATHROOM_SCALE_DOMAINS={mass:[0,120,5],stiffness:[20000,40000,2500],zero:[-10,10,1],position:[-.75,.75,.25],gravity:[0,2,1]};
export const BATHROOM_SCALE_CONSTANTS=Object.freeze({leverRatio:4,crankRatio:2,dialStiffness:5,dialInitialTension:.5,mainPreload:1,referenceStiffness:30020,referenceGravity:9.81,dialRadiansPerKg:Math.PI/120,pinionRadius:2*9.81/(4*30020*(Math.PI/120)),leverOutput:.115,leverInput:.02875,pivotX:.105,pivotZ:.09,crankInput:.025,crankOutput:.05,mainInitialLength:.033,dialInitialLength:.14,fullLoadTime:2,unloadStart:6,duration:8});
export const BATHROOM_SCALE_GRAVITIES=Object.freeze([9.81,1.62,3.71]);

export function sampleBathroomScale(input={},time=0){
 if(!input||typeof input!=='object'||Array.isArray(input))throw new TypeError('Expected bathroom-scale controls');
 for(const key of Object.keys(input))if(!Object.hasOwn(BATHROOM_SCALE_DOMAINS,key))throw new RangeError('Unknown '+key);
 const values={...BATHROOM_SCALE_DEFAULTS,...input};
 for(const [key,[lo,hi,step]] of Object.entries(BATHROOM_SCALE_DOMAINS)){const n=values[key];if(!Number.isFinite(n)||n<lo||n>hi||Math.abs((n-lo)/step-Math.round((n-lo)/step))>1e-8)throw new RangeError('Invalid '+key);}
 if(!Number.isInteger(values.gravity))throw new RangeError('Invalid gravity');
 if(!Number.isFinite(time)||time<0)throw new RangeError('Invalid trial time');
 const c=BATHROOM_SCALE_CONSTANTS,elapsed=Math.min(time,c.duration),gravity=BATHROOM_SCALE_GRAVITIES[values.gravity],smooth=p=>p*p*(3-2*p);
 const phase=elapsed<c.fullLoadTime?'loading':elapsed<c.unloadStart?'holding':elapsed<c.duration?'unloading':'complete',loadFraction=elapsed<c.fullLoadTime?smooth(elapsed/c.fullLoadTime):elapsed<=c.unloadStart?1:1-smooth((elapsed-c.unloadStart)/(c.duration-c.unloadStart));
 const selectedWeight=values.mass*gravity,transferredWeight=selectedWeight*loadFraction,operatorSupport=selectedWeight-transferredWeight,effectiveStiffness=values.stiffness+c.dialStiffness*c.crankRatio**2;
 const fullExtension=selectedWeight/(c.leverRatio*effectiveStiffness),plateTravel=fullExtension*loadFraction,platformTravel=plateTravel/c.leverRatio,rackTravel=c.crankRatio*plateTravel;
 const mainSpringForce=c.mainPreload+values.stiffness*plateTravel,dialSpringForce=c.dialInitialTension-c.dialStiffness*rackTravel,dialPlateForce=c.crankRatio*dialSpringForce,plateLoad=transferredWeight/c.leverRatio;
 const mainSpringEnergy=c.mainPreload*plateTravel+.5*values.stiffness*plateTravel**2,dialSpringEnergy=-c.dialInitialTension*rackTravel+.5*c.dialStiffness*rackTravel**2;
 const peakWork=.5*selectedWeight*fullExtension/c.leverRatio,loadingWork=elapsed<c.fullLoadTime?peakWork*loadFraction**2:peakWork,returnedWork=elapsed<=c.unloadStart?0:peakWork*(1-loadFraction**2),inputWork=loadingWork-returnedWork;
 const indicatedMass=transferredWeight/c.referenceGravity*c.referenceStiffness/effectiveStiffness+values.zero,dialAngle=indicatedMass*c.dialRadiansPerKg,carriageShift=-values.zero*c.dialRadiansPerKg*c.pinionRadius;
 const leverAngle=Math.asin(plateTravel/c.leverOutput),crankAngle=Math.asin(plateTravel/c.crankInput),pivotRadius=Math.hypot(c.pivotX,c.pivotZ),supportHalfWidth=c.pivotX-c.pivotX/pivotRadius*c.leverInput*Math.cos(leverAngle),supportHalfDepth=c.pivotZ-c.pivotZ/pivotRadius*c.leverInput*Math.cos(leverAngle);
 const loadShares=[-1,-1,1,1].map(side=>transferredWeight*(1+side*values.position)/4),plateShares=loadShares.map(force=>force/c.leverRatio),pivotReactions=loadShares.map((force,i)=>force-plateShares[i]);
 const plateContactHalfWidth=c.pivotX-c.pivotX/pivotRadius*c.leverOutput*Math.cos(leverAngle),crankFollowerX=c.crankInput*(1-Math.cos(crankAngle)),guideMoment=plateLoad*values.position*plateContactHalfWidth+dialPlateForce*crankFollowerX,guideMomentX=-.020*dialPlateForce,guideMomentMagnitude=Math.hypot(guideMomentX,guideMoment);
 return {values,elapsed,duration:c.duration,progress:elapsed/c.duration,complete:elapsed>=c.duration,phase,loadFraction,gravity,selectedMass:values.mass,selectedWeight,transferredWeight,operatorSupport,effectiveStiffness,fullExtension,plateTravel,mainExtension:plateTravel,platformTravel,rackTravel,
  mainSpringForce,dialSpringForce,dialPlateForce,plateLoad,forceResidual:mainSpringForce-dialPlateForce-plateLoad,mainSpringEnergy,dialSpringEnergy,loadingWork,returnedWork,inputWork,energyResidual:inputWork-mainSpringEnergy-dialSpringEnergy,
  indicatedMass,dialAngle,carriageShift,leverAngle,crankAngle,loadShares,plateShares,pivotReactions,supportHalfWidth,supportHalfDepth,loadX:values.position*supportHalfWidth,plateContactHalfWidth,crankFollowerX,guideMoment,guideMomentX,guideMomentMagnitude,mainSpringLength:c.mainInitialLength+plateTravel,dialSpringLength:c.dialInitialLength-rackTravel,mainFreeLength:c.mainInitialLength-c.mainPreload/values.stiffness,dialFreeLength:c.dialInitialLength-c.dialInitialTension/c.dialStiffness};
}

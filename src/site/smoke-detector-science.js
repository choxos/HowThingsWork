import {ASTAR_AIR,ASTAR_GOLD,astarAt,energyAt,mie} from './smoke-physics.js';

// ASTAR data and the sphere-scattering series are shared with the preserved
// draft. Chamber geometry, alpha yield and optical collection are defined here.
export const SMOKE_SCIENCE=Object.freeze({
  charge:1.602176634e-19,boltzmann:1.380649e-23,temperature:293.15,airDensity:1.2041,
  goldDensity:19.3,ionMobility:1.5e-4,recombination:1.6e-12,pairEnergy:35.1,
  activity:37000,sourceRadius:2.55,coverMicrons:2,radius:10,sensingGap:15,referenceGap:24.7,
  wavelength:940e-9,index:1.5,particleDensity:1000,intensity:.072,sourceDistance:.012,
  receiverDistance:.012,chamberRadius:.023,receiverArea:1.7671458676442586e-6,
  sourceHalfAngle:17,sourceStopAngle:25,receiverHalfAngle:5,responsivity:2/3,
  beamDistance:.03,roomDistance:10,
});
const C=SMOKE_SCIENCE,PI=Math.PI,TAU=2*PI;
// Three principal alpha lines, with their absolute probabilities (IAEA/BIPM).
// The remaining 0.66% and non-alpha emissions are omitted, not renormalized.
export const SMOKE_ALPHA_LINES=Object.freeze([[5.48556,.8445],[5.44286,.1323],[5.38826,.0166]].map(Object.freeze));
export const smokeAirRange=energy=>astarAt(ASTAR_AIR,energy,2)/(C.airDensity*1e-3)*10;
export const smokeAirEnergy=millimeters=>energyAt(ASTAR_AIR,Math.max(0,millimeters)/10*C.airDensity*1e-3);
export const smokeAfterGold=(energy,microns)=>energyAt(ASTAR_GOLD,Math.max(0,astarAt(ASTAR_GOLD,energy,2)-microns*1e-4*C.goldDensity));
export const smokePairsPerMillimeter=energy=>energy>0?astarAt(ASTAR_AIR,energy,1)*C.airDensity*1e-4/(C.pairEnergy*1e-6):0;

/** Ray in the right half-cylinder. The source and top electrode lie at z=0
 * and z=gap. The absorbing divider is x=0. All dimensions are millimeters.
 * Left-side paths use the mirror image. CSDA treats tracks as straight. */
export function smokeAlphaTrack(energy,source,mu,azimuth,gap=C.sensingGap){
  const start=smokeAfterGold(energy,C.coverMicrons/Math.max(mu,1e-12));
  const sine=Math.sqrt(Math.max(0,1-mu*mu)),dx=sine*Math.cos(azimuth),dy=sine*Math.sin(azimuth);
  const radial=dx*dx+dy*dy,dot=source[0]*dx+source[1]*dy;
  const wall=radial>1e-15?(-dot+Math.sqrt(Math.max(0,dot*dot+radial*(C.radius*C.radius-source[0]**2-source[1]**2))))/radial:Infinity;
  const divider=dx<0?-source[0]/dx:Infinity,plate=mu>0?gap/mu:Infinity,range=smokeAirRange(start);
  const length=Math.max(0,Math.min(range,wall,divider,plate));
  const end=[source[0]+length*dx,source[1]+length*dy,length*mu];
  const after=smokeAirEnergy(range-length);
  return {source:[...source,0],end,mu,azimuth,start,after,length,range,deposit:Math.max(0,start-after),stop:length===range?'air':length===divider?'divider':length===wall?'wall':'electrode'};
}

/** Deterministic product quadrature over uniform source area and solid angle.
 * Each foil half contains half the activity; half its emissions head outward.
 * Rays striking the divider, shell or electrode stop depositing energy in air.
 * A constant alpha W value is an approximation, including for partial tracks. */
export function smokeChamber(gap,{radial=6,sourceAngles=8,directions=24,cosines=80}={}){
  let deposit=0;
  for(const [energy,probability] of SMOKE_ALPHA_LINES){
    let sum=0;
    for(let m=0;m<cosines;m++){
      const mu=(m+.5)/cosines,start=smokeAfterGold(energy,C.coverMicrons/mu),range=smokeAirRange(start),sine=Math.sqrt(1-mu*mu);
      if(!start)continue;
      for(let a=0;a<directions;a++){
        const azimuth=TAU*(a+.5)/directions,dx=sine*Math.cos(azimuth),dy=sine*Math.sin(azimuth),s2=sine*sine;
        for(let r=0;r<radial;r++)for(let p=0;p<sourceAngles;p++){
          const rr=C.sourceRadius*Math.sqrt((r+.5)/radial),phi=-PI/2+PI*(p+.5)/sourceAngles,x=rr*Math.cos(phi),y=rr*Math.sin(phi),dot=x*dx+y*dy;
          const wall=(-dot+Math.sqrt(dot*dot+s2*(C.radius*C.radius-rr*rr)))/s2;
          const length=Math.min(range,gap/mu,wall,dx<0?-x/dx:Infinity);
          sum+=start-smokeAirEnergy(range-length);
        }
      }
    }
    deposit+=probability*sum/(radial*sourceAngles*directions*cosines);
  }
  const pairs=deposit/(C.pairEnergy*1e-6),rate=C.activity/4*pairs,volume=PI*(C.radius*1e-3)**2*(gap*1e-3)/2;
  return Object.freeze({gap,gapMeters:gap*1e-3,pairs,rate,volume,q:rate/volume,saturation:C.charge*rate,meanDeposit:deposit});
}
let chambers;
export function smokeChambers(){return chambers??=Object.freeze({sensing:smokeChamber(C.sensingGap),reference:smokeChamber(C.referenceGap)});}
export const smokeSweep=(chamber,volts)=>2*C.ionMobility*Math.max(0,volts)/(chamber.gapMeters**2);
export function smokeIonDensity(chamber,volts,capture=0){const loss=smokeSweep(chamber,volts)+capture;return 2*chamber.q/(loss+Math.sqrt(loss*loss+4*C.recombination*chamber.q));}
export const smokeChamberCurrent=(chamber,volts,capture=0)=>C.charge*chamber.volume*smokeIonDensity(chamber,volts,capture)*smokeSweep(chamber,volts);
export function smokeNode(supply,capture=0){
  if(supply===0)return 0;
  const {sensing,reference}=smokeChambers();let lo=0,hi=supply;
  for(let i=0;i<45;i++){const mid=(lo+hi)/2;if(smokeChamberCurrent(reference,supply-mid)>smokeChamberCurrent(sensing,mid,capture))lo=mid;else hi=mid;}
  return (lo+hi)/2;
}

export function smokeParticle(diameter){
  const meters=diameter*1e-6,x=PI*meters/C.wavelength,{qext,qsca}=mie(x,C.index,[]);
  const diffusion=C.ionMobility*C.boltzmann*C.temperature/C.charge;
  return Object.freeze({diameter,meters,x,qext,qsca,mass:C.particleDensity*PI*meters**3/6,extinction:qext*PI*meters**2/4,capture:2*PI*diffusion*meters});
}

function gauss(order){
  const nodes=[];
  for(let i=0;i<order;i++){
    let z=Math.cos(PI*(i+.75)/(order+.5)),derivative;
    for(let k=0;k<30;k++){
      let p0=1,p1=z;for(let n=2;n<=order;n++){const p=((2*n-1)*z*p1-(n-1)*p0)/n;p0=p1;p1=p;}
      derivative=order*(z*p1-p0)/(z*z-1);const dz=p1/derivative;z-=dz;if(Math.abs(dz)<1e-14)break;
    }
    nodes.push({x:z,weight:2/((1-z*z)*derivative*derivative)});
  }
  return nodes;
}

/** Single-scattering volume integral. Rays start at a small effective receiver
 * pupil and follow its 5-degree field into a spherical chamber. Analytic cone
 * intersections bound the region lit by the hooded LED. This avoids assigning
 * every particle the central scattering angle or inventing a fixed lit volume.
 * The pupil uses the small-area approximation; wall reflections are omitted. */
export function smokeOpticalKernel(diameter,angle,{angular=5,azimuths=20,distance=16}={}){
  const theta=angle*PI/180,c=Math.cos(theta),s=Math.sin(theta),r=C.receiverDistance;
  const receiver=[r*c,r*s,0],source=[-C.sourceDistance,0,0],axis=[-c,-s,0],basis=[-s,c,0];
  const minCos=Math.cos(C.receiverHalfAngle*PI/180),tan=Math.tan(C.sourceStopAngle*PI/180),tan2=tan*tan;
  const angularNodes=gauss(angular),radialNodes=gauss(distance),positions=[],angles=[],weights=[],paths=[];
  const exponent=Math.log(.5)/Math.log(Math.cos(C.sourceHalfAngle*PI/180));let volume=0;
  for(const gn of angularNodes){
    const mu=(1+minCos+(1-minCos)*gn.x)/2,sine=Math.sqrt(1-mu*mu),muWeight=gn.weight*(1-minCos)/2;
    for(let j=0;j<azimuths;j++){
      const phi=TAU*(j+.5)/azimuths,dir=[mu*axis[0]+sine*Math.cos(phi)*basis[0],mu*axis[1]+sine*Math.cos(phi)*basis[1],sine*Math.sin(phi)];
      const dot=receiver[0]*dir[0]+receiver[1]*dir[1],end=-dot+Math.sqrt(dot*dot+C.chamberRadius**2-r*r);
      const q=receiver.map((x,i)=>x-source[i]);
      const a=dir[1]**2+dir[2]**2-tan2*dir[0]**2,b=2*(q[1]*dir[1]+q[2]*dir[2]-tan2*q[0]*dir[0]),cc=q[1]**2+q[2]**2-tan2*q[0]**2;
      const cuts=[0,end];if(Math.abs(dir[0])>1e-14)cuts.push(-q[0]/dir[0]);
      if(Math.abs(a)<1e-14){if(Math.abs(b)>1e-14)cuts.push(-cc/b);}else{const disc=b*b-4*a*cc;if(disc>=0){const root=Math.sqrt(disc);cuts.push((-b-root)/(2*a),(-b+root)/(2*a));}}
      const sorted=cuts.filter(t=>t>=0&&t<=end).sort((a,b)=>a-b);
      for(let k=1;k<sorted.length;k++){
        const low=sorted[k-1],high=sorted[k],mid=(low+high)/2,h=(high-low)/2;if(h<1e-12)continue;
        const test=q.map((x,i)=>x+dir[i]*mid);if(test[0]<=0||test[1]**2+test[2]**2>tan2*test[0]**2)continue;
        const solid=muWeight*TAU/azimuths;
        volume+=solid*(high**3-low**3)/3;
        for(const rn of radialNodes){
          const t=mid+h*rn.x,p=receiver.map((x,i)=>x+t*dir[i]),incoming=p.map((x,i)=>x-source[i]),length=Math.hypot(...incoming),inc=incoming.map(x=>x/length);
          const scattering=Math.acos(Math.max(-1,Math.min(1,-inc.reduce((v,x,i)=>v+x*dir[i],0))));
          positions.push(p);angles.push(scattering);paths.push(length+t);
          weights.push(C.responsivity*C.intensity*inc[0]**exponent/length**2*C.receiverArea*mu*solid*h*rn.weight);
        }
      }
    }
  }
  const particle=smokeParticle(diameter),wave=TAU/C.wavelength,scattering=mie(particle.x,C.index,angles).intensity;
  const coefficients=weights.map((weight,i)=>weight*scattering[i]/(2*wave*wave));
  return {diameter,angle,particle,receiver,source,positions,angles,paths,coefficients,volume,directSeparation:angle/2,receiverHalfAngle:C.receiverHalfAngle,
    current(number){const extinction=number*particle.extinction;let total=0;for(let i=0;i<coefficients.length;i++)total+=coefficients[i]*Math.exp(-extinction*paths[i]);return number*total;}};
}
const optics=new Map();
export function smokeOptics(diameter,angle){const key=`${diameter}:${angle}`;if(!optics.has(key)){if(optics.size>=64)optics.clear();optics.set(key,smokeOpticalKernel(diameter,angle));}return optics.get(key);}

export function smokeSignals(values,mass){
  const optical=smokeOptics(values.size,values.angle),particle=optical.particle,number=mass/particle.mass,capture=particle.capture*number,extinction=particle.extinction*number;
  const supply=values.power?values.battery:0,node=smokeNode(supply,capture),{sensing,reference}=smokeChambers(),cleanNode=smokeNode(supply);
  const current=smokeChamberCurrent(sensing,node,capture),cleanCurrent=smokeChamberCurrent(sensing,cleanNode);
  return {mass,number,capture,extinction,supply,node,current,referenceCurrent:smokeChamberCurrent(reference,supply-node),cleanNode,cleanCurrent,
    density:smokeIonDensity(sensing,node,capture),cleanDensity:smokeIonDensity(sensing,cleanNode),currentShare:cleanCurrent>0?current/cleanCurrent:null,
    scattered:values.power?optical.current(number):0,beamShare:Math.exp(-extinction*C.beamDistance),roomShare:Math.exp(-extinction*C.roomDistance),obscuration:-Math.expm1(-extinction)*100};
}

import * as THREE from 'three';
import {spurGearShape} from './gear-geometry.js';
const TAU=2*Math.PI;
export const carryDimensions=Object.freeze({module:.9,centers:12.6,drumRadius:8,drumPitch:14,drumWidth:8,collarRadius:9.77,projectionTip:9.75});

function profile(teeth,selected,offset=0,tip=Infinity){
  return spurGearShape({teeth,module:.9,pressureAngle:35*Math.PI/180,samples:20,backlash:.03}).getPoints().map(p=>{
    let a=Math.atan2(p.y,p.x),radius=Math.min(p.length(),tip);
    const tooth=(Math.round(a*teeth/TAU)+teeth)%teeth;
    if(selected&&!selected.includes(tooth))radius=Math.min(radius,.9*(teeth/2-1.25));
    a+=offset;return [radius*Math.cos(a),radius*Math.sin(a)];
  });
}

export function meterCarryProfiles(){
  const full=profile(20,null,Math.PI/20),input=profile(20,[3,4],Math.PI/20,carryDimensions.projectionTip);
  const transfer=profile(8),wide=profile(8,[1,3,5,7]),count=720,radii=new Float64Array(count).fill(carryDimensions.collarRadius);
  // The wide teeth sweep a relief into the locking collar during the carry.
  // ponytail: sampled teaching profile with 0.02 mm relief, not a machining file.
  for(let step=0;step<=360;step++){
    const u=step/360,a=u*Math.PI/2,b=-(1-u)*Math.PI/5,ca=Math.cos(a),sa=Math.sin(a),cb=Math.cos(b),sb=Math.sin(b);
    const points=wide.map(([x,y])=>{const px=x*ca-y*sa,py=x*sa+y*ca+carryDimensions.centers;return [px*cb-py*sb,px*sb+py*cb];});
    for(let i=0;i<points.length;i++){
      const p=points[i],q=points[(i+1)%points.length],from=Math.atan2(p[1],p[0]),delta=Math.atan2(p[0]*q[1]-p[1]*q[0],p[0]*q[0]+p[1]*q[1]);
      const lo=Math.ceil(Math.min(from,from+delta)*count/TAU),hi=Math.floor(Math.max(from,from+delta)*count/TAU);
      for(let j=lo;j<=hi;j++){
        const angle=j*TAU/count,den=Math.cos(angle)*(q[1]-p[1])-Math.sin(angle)*(q[0]-p[0]);
        if(Math.abs(den)<1e-12)continue;
        const radius=(p[0]*q[1]-p[1]*q[0])/den;
        if(radius>0){const k=(j%count+count)%count;radii[k]=Math.min(radii[k],radius);}
      }
    }
  }
  const collar=Array.from(radii,(radius,i)=>{
    const relieved=Math.min(radius,radii[(i+count-1)%count],radii[(i+1)%count])-.02,angle=i*TAU/count;
    return [relieved*Math.cos(angle),relieved*Math.sin(angle)];
  });
  return {full,input,transfer,wide,collar};
}

export function meterProfileGeometry(points,depth,bore=0){
  const shape=new THREE.Shape(points.map(([x,y])=>new THREE.Vector2(x,y)));
  if(bore)shape.holes.push(new THREE.Path().absarc(0,0,bore,0,TAU,true));
  const geometry=new THREE.ExtrudeGeometry(shape,{depth,bevelEnabled:false,curveSegments:32});
  geometry.translate(0,0,-depth/2);return geometry;
}

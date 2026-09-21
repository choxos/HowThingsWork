import * as THREE from 'three';
const V=a=>new THREE.Vector3(...a),EPS=1e-8;
const plane=(normal,constant,name)=>({normal:V(normal).normalize(),constant:constant/Math.hypot(...normal),name});
// Finite outward-facing half-spaces, in units of40 mm. First prism flips horizontal Z; second flips vertical Y.
export const PORRO_PRISMS=[
 {vertices:[[0,-.55,-1],[0,-.55,1],[1,-.55,0],[0,-.15,-1],[0,-.15,1],[1,-.15,0]],faces:[plane([-1,0,0],0,'Hypotenuse'),plane([1,0,-1],1,'First reflecting face'),plane([1,0,1],1,'Second reflecting face'),plane([0,-1,0],.55,'Side'),plane([0,1,0],-.15,'Side')]},
 {vertices:[[-.5,-1,.15],[-.5,1,.15],[-1.5,0,.15],[-.5,-1,.55],[-.5,1,.55],[-1.5,0,.55]],faces:[plane([1,0,0],-.5,'Hypotenuse'),plane([-1,-1,0],1.5,'First reflecting face'),plane([-1,1,0],1.5,'Second reflecting face'),plane([0,0,-1],-.15,'Side'),plane([0,0,1],.55,'Side')]},
];
export function binocularInterface(direction,normal,n1,n2){
 if(![n1,n2].every(n=>Number.isFinite(n)&&n>0)||![...direction,...normal].every(Number.isFinite)||Math.hypot(...direction)<EPS||Math.hypot(...normal)<EPS)throw new RangeError('Invalid optical interface');
 const d=V(direction).normalize(),n=V(normal).normalize();if(d.dot(n)>0)n.negate();const cosine=-d.dot(n),eta=n1/n2,k=1-eta*eta*(1-cosine*cosine),tir=k<0,out=tir?d.clone().reflect(n):d.clone().multiplyScalar(eta).addScaledVector(n,eta*cosine-Math.sqrt(Math.max(0,k)));
 return {direction:out.normalize().toArray(),tir,incidence:Math.acos(Math.max(-1,Math.min(1,cosine)))*180/Math.PI};
}
const inside=(point,prism)=>prism.faces.every(face=>V(point).dot(face.normal)<=face.constant+EPS);
export function tracePorro(start=[-.5,-.35,-.35],direction=[1,0,0],index=1.5){
 if(!Number.isFinite(index)||index<1||index>2||![...start,...direction].every(Number.isFinite)||Math.hypot(...direction)<EPS)throw new RangeError('Invalid Porro input');
 const points=[start.slice()],events=[],s={points,events,complete:false,reason:'',glassLength:0,airLength:0,opticalLength:0};let p=V(start),d=V(direction).normalize();
 for(let k=0;k<2;k++){
  const prism=PORRO_PRISMS[k],entry=prism.faces[0],den=d.dot(entry.normal),t=(entry.constant-p.dot(entry.normal))/den;
  if(den>=-EPS||t<-EPS||!Number.isFinite(t)){s.reason='Beam does not approach the next prism';break;}
  const hit=p.clone().addScaledVector(d,Math.max(0,t));if(!inside(hit.toArray(),prism)){points.push(hit.toArray());s.airLength+=Math.max(0,t);s.reason='Missed finite prism entrance';p=hit;break;}
  s.airLength+=Math.max(0,t);points.push(hit.toArray());let change=binocularInterface(d.toArray(),entry.normal.toArray(),1,index);events.push({prism:k,face:0,kind:'Enter glass',point:hit.toArray(),...change});p=hit;d=V(change.direction);let exited=false;
  for(let bounce=0;bounce<10;bounce++){
   let nearest=null;for(let j=0;j<prism.faces.length;j++){const face=prism.faces[j],den=d.dot(face.normal);if(den<=EPS)continue;const distance=(face.constant-p.dot(face.normal))/den;if(distance>EPS&&(!nearest||distance<nearest.distance))nearest={face,j,distance};}
   if(!nearest){s.reason='No forward boundary';break;}
   const {face,j,distance}=nearest;p=p.clone().addScaledVector(d,distance);points.push(p.toArray());s.glassLength+=distance;change=binocularInterface(d.toArray(),face.normal.toArray(),index,1);events.push({prism:k,face:j,kind:change.tir?'Total internal reflection':'Exit glass',point:p.toArray(),...change});d=V(change.direction);
   if(!change.tir){if(j===0){exited=true;break;}s.reason='Total internal reflection failed or beam exited a side';points.push(p.clone().addScaledVector(d,.7).toArray());break;}
  }
  if(!exited){if(!s.reason)s.reason='Different internal path; intended exit not reached';break;}
  if(k===1){s.complete=true;s.reason='Four-reflection Porro path reaches the output';}
 }
 s.intended=s.complete&&events.filter(e=>e.tir).length===4&&events.filter(e=>e.tir).every(e=>e.face===1||e.face===2);if(s.complete&&!s.intended)s.reason='Extra side reflection changes the intended image orientation';s.opticalLength=s.airLength+index*s.glassLength;s.end=p.toArray();s.direction=d.toArray();s.reflections=events.filter(e=>e.tir).length;s.minimumIncidence=Math.min(...events.filter(e=>e.tir||e.face!==0).map(e=>e.incidence));s.criticalAngle=Math.asin(1/index)*180/Math.PI;return s;
}
export const BINOCULARS_DEFAULTS=Object.freeze({mode:0,objective:200,eyepiece:25,index:1.5,angle:0,baseline:120,distance:10,aperture:.12});
const domains={mode:[0,2,1],objective:[200,300,50],eyepiece:[25,50,25],index:[1.4,1.6,.1],angle:[-6,6,1],baseline:[60,120,20],distance:[10,100,10],aperture:[.04,.16,.04]};
export function sampleBinoculars(input={}){
 if(!input||typeof input!=='object'||Array.isArray(input))throw new TypeError('Expected binocular controls');for(const key of Object.keys(input))if(!Object.hasOwn(domains,key))throw new RangeError('Unknown '+key);const v={...BINOCULARS_DEFAULTS,...input};for(const [key,[lo,hi,step]] of Object.entries(domains)){if(!Number.isFinite(v[key])||v[key]<lo-EPS||v[key]>hi+EPS||Math.abs((v[key]-lo)/step-Math.round((v[key]-lo)/step))>1e-7)throw new RangeError('Invalid '+key);v[key]=Number(v[key].toFixed(12));}
 const F=v.objective/40,fe=v.eyepiece/40,reduced=.5+4/v.index+.5,remaining=F-reduced,imageX=-.5+remaining,eyeX=imageX+fe;
 const chief=tracePorro([-.5,-.35,-.35],[1,0,0],v.index),rays=[];
 for(const angle of [-.1,0,.1])for(const pupil of [-v.aperture,0,v.aperture]){
  const theta=-Math.tan(angle*Math.PI/180),u=theta-pupil/F,start=[-.5,-.35+pupil,-.35],ray=tracePorro(start,[1,u,0],v.index);ray.objectAngle=angle;ray.pupil=pupil;ray.points.unshift([-1.8,start[1]-1.3*theta,start[2]]);
  if(ray.complete){const p=V(ray.end),d=V(ray.direction),image=p.clone().addScaledVector(d,(imageX-p.x)/d.x),eyepiece=p.clone().addScaledVector(d,(eyeX-p.x)/d.x),out=V([1,d.y/d.x-(eyepiece.y-.35)/fe,d.z/d.x-(eyepiece.z-.35)/fe]).normalize();ray.image=image.toArray();ray.points.push(image.toArray(),eyepiece.toArray(),eyepiece.clone().addScaledVector(out,.7).toArray());ray.outputDirection=out.toArray();}
  rays.push(ray);
 }
 let spotSpan=0;for(const angle of [-.1,0,.1]){const positions=rays.filter(r=>r.complete&&r.objectAngle===angle).map(r=>r.image[1]);if(positions.length)spotSpan=Math.max(spotSpan,Math.max(...positions)-Math.min(...positions));}
 const disparity=d=>2*Math.atan(v.baseline/2000/d)*180/Math.PI,nearDisparity=disparity(v.distance),farDisparity=disparity(100),probe=tracePorro([-.5,-.35,-.35],[1,0,Math.tan(v.angle*Math.PI/180)],v.index);
 return {values:v,F,fe,imageX,eyeX,reduced,remaining,chief,rays,probe,spotSpan,received:rays.filter(r=>r.complete).length,magnification:F/fe,imageHeight:2*F*Math.tan(.1*Math.PI/180),nearDisparity,farDisparity,relativeDisparity:nearDisparity-farDisparity};
}

import * as THREE from 'three';
import {FILTER, PRECIPITATOR as P, chargeQuantile, driftSpeed} from './air-cleaner-physics.js';
export const MM = .004;
export const point = p => p.map(v => v * MM);
export const PANEL = Object.freeze({front: -135, low: 80, high: 380, width: 200, pleats: 30});
export const PITCH = 300 / PANEL.pleats;
export const PLEAT_DEPTH = Math.sqrt((FILTER.area * 1e6 / (2 * PANEL.pleats * PANEL.width)) ** 2 - (PITCH / 2) ** 2);
export const CELL = Object.freeze({charger: -145, start: -112, end: -12, plates: P.plates});
export const PARTICLES = 32;
export const plateY = i => PANEL.low + P.thickness * 500 + (P.gap + P.thickness) * 1000 * i;
export const pleatX = y => {const halfFold = (y - PANEL.low) / (PITCH / 2), i = Math.floor(halfFold);return PANEL.front + PLEAT_DEPTH * (i % 2 === 0 ? halfFold - i : 1 - (halfFold - i));};
export function pleatGeometry() {
  const positions = [], indices = [];
  for (let i = 0; i <= 2 * PANEL.pleats; i++) for (const z of [-100,100]) positions.push(...point([PANEL.front + (i % 2) * PLEAT_DEPTH, 80 + i * PITCH / 2, z]));
  for (let i = 0; i < 2 * PANEL.pleats; i++) {const a = 2*i;indices.push(a,a+1,a+2,a+1,a+3,a+2);}
  const geometry = new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geometry.setIndex(indices);geometry.computeVertexNormals();return geometry;
}
/** Open transition duct: rectangular at x=60, round at x=170, no end caps. */
export function reducerGeometry() {
  const positions = [], indices = [], segments = 128;
  for (let i = 0; i <= segments; i++) {
    const a = 2*Math.PI*i/segments, y = Math.cos(a), z = Math.sin(a), radius = Math.min(150/Math.max(1e-12,Math.abs(y)),100/Math.max(1e-12,Math.abs(z)));
    positions.push(...point([60,230+radius*y,radius*z]),...point([170,230+100*y,100*z]));
  }
  for(let i=0;i<segments;i++){const a=2*i;indices.push(a,a+1,a+2,a+1,a+3,a+2);}
  const geometry = new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geometry.setIndex(indices);geometry.computeVertexNormals();return geometry;
}
export function annulusGeometry(inner,outer,length) {
  const shape = new THREE.Shape();shape.absarc(0,0,outer*MM,0,2*Math.PI,false);
  const hole = new THREE.Path();hole.absarc(0,0,inner*MM,0,2*Math.PI,true);shape.holes.push(hole);
  const geometry = new THREE.ExtrudeGeometry(shape,{depth:length*MM,bevelEnabled:false,curveSegments:64});geometry.translate(0,0,-length*MM/2);geometry.rotateY(Math.PI/2);return geometry;
}
export function bladeGeometry(angle) {
  const positions=[];
  // A pitched radial blade. Opposite axial edges make a real twisted surface.
  for(const [radius,offset,x] of [[29,-.23,-9],[29,.23,9],[94,-.15,-6],[94,.15,6]])positions.push(...point([x,radius*Math.cos(angle+offset),radius*Math.sin(angle+offset)]));
  const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geometry.setIndex([0,1,2,1,3,2]);geometry.computeVertexNormals();return geometry;
}
const mix = (a,b,u) => a.map((v,i)=>v+(b[i]-v)*u);
function pathAt(points,progress) {
  const u=Math.max(0,Math.min(1,progress))*(points.length-1),i=Math.min(points.length-2,Math.floor(u));return mix(points[i],points[i+1],u-i);
}
/** One finite, stratified teaching cohort. It is not a Monte Carlo CADR estimate. */
export function particleRoute(i,plan) {
  const gap=(i*17)%44, fraction=((i*7)%PARTICLES+.5)/PARTICLES, low=plateY(gap)+P.thickness*500;
  const y=low+fraction*P.gap*1000,z=-87.5+25*((i*3)%8),preY=80+25*Math.min(11,Math.floor((y-80)/25))+18.75;
  const n=chargeQuantile(plan.distribution,((i*13)%PARTICLES+.5)/PARTICLES);
  const target=gap%2===0?low:low+P.gap*1000, direction=gap%2===0?-1:1;
  const w=plan.values.mode===1&&plan.enabled?driftSpeed(n,plan.d,P.plateVoltage/P.gap):0;
  const distance=Math.abs(target-y)/1000, travel=w>0?distance/w*plan.U:null;
  const collectorCaught=travel!==null&&travel<=P.length, filterCaught=((i*11)%PARTICLES+.5)/PARTICLES<plan.efficiency;
  const captured=plan.Q>0&&(plan.values.mode===1?collectorCaught:plan.values.mode===0?filterCaught:false);
  const points=[[-270,preY,z],[-220,preY,z],[-198,preY,z],[-163,preY,z],[plan.values.mode===0?-153:-128,preY,z]];
  let captureIndex=null;
  if(plan.values.mode===0){
    const hit=[pleatX(y),y,z];points.push([PANEL.front-3,y,z],hit);
    if(captured)captureIndex=points.length-1;else points.push([PANEL.front+PLEAT_DEPTH+3,y,z]);
  }else if(plan.values.mode===1){
    points.push([CELL.start,y,z]);
    const x=collectorCaught?CELL.start+travel*1000:CELL.end;
    const yy=collectorCaught?target:y+direction*w*P.length/Math.max(plan.U,1e-30)*1000;
    points.push([x,yy,z]);if(captured)captureIndex=points.length-1;
  }
  if(!captured){
    const angle=.198+2*Math.PI*((i*7)%PARTICLES)/PARTICLES,ry=230+72*Math.cos(angle),rz=72*Math.sin(angle);
    points.push([5,preY,z],[45,preY,z],[100,230+(preY-230)*.4,z*.4],[168,ry,rz],[195,ry,rz],[235,ry,rz],[285,ry,rz],[335,ry,rz]);
  }
  return {points,captured,captureIndex,n,gap,target,y,z,travel,filterHit:plan.values.mode===0?points[6]:null,chargeIndex:plan.values.mode===2?points.length-2:4};
}
export function particleSample(i,plan,clock) {
  const route=particleRoute(i,plan),progress=plan.Q===0?0:Math.max(0,(clock-i*4)/600)*plan.hourly/200;
  const complete=progress>=1,position=pathAt(route.points,progress);
  const charged=plan.enabled&&plan.values.mode!==0&&progress*(route.points.length-1)>=route.chargeIndex&&route.n>0;
  return {...route,position,progress:Math.min(1,progress),charged,status:complete?(route.captured?'captured':'returned'):'in transit',visible:!complete||route.captured};
}

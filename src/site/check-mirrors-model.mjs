import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createMirrorsModel,sampleMirrors,reflectMirrorRay,intersectMirrorSegment,MIRRORS_DEFAULTS as D} from './mirrors-model.js';

// Independent vector reflection and line solve. No private audit inputs are needed.
const deg=180/Math.PI,near=(a,b,t=1e-9)=>assert.ok(Number.isFinite(a)&&Number.isFinite(b)&&Math.abs(a-b)<=t,`${a} != ${b}`);
const nrm=a=>{const l=Math.hypot(...a);return a.map(x=>x/l);};
const reflect=(d,n)=>{d=nrm(d);n=nrm(n);const c=d.reduce((t,x,i)=>t+x*n[i],0);return d.map((x,i)=>x-2*c*n[i]);};
function hit(o,d,c,u,h){const matrix=new THREE.Matrix3().set(d[0],-u[0],0,d[1],-u[1],0,0,0,1);if(Math.abs(matrix.determinant())<1e-10)return null;const v=new THREE.Vector3(c[0]-o[0],c[1]-o[1],0).applyMatrix3(matrix.invert());return v.x>1e-10&&Math.abs(v.y)<=h+1e-10?[o[0]+d[0]*v.x,o[1]+d[1]*v.x]:null;}
const values=[];
for(const distance of [1,1.5,2,2.5,3])for(const height of [.3,.6,.9,1.2])for(const aperture of [.4,.6,.8])values.push({...D,mode:0,distance,height,aperture});
for(const distance of [1,1.5,2,2.5,3])for(const aperture of [.4,.6,.8])for(const radius of [3,4.5,6])for(const bearing of Array.from({length:13},(_,i)=>-60+10*i))values.push({...D,mode:1,distance,aperture,radius,bearing});
for(const focus of [.8,1,1.2])for(const aperture of [.4,.6,.8])for(const offset of [-.3,-.2,-.1,0,.1,.2,.3])values.push({...D,mode:2,focus,aperture,offset});
for(const upperTilt of [-10,-5,0,5,10])for(const lowerTilt of [-10,-5,0,5,10])for(const secondMirror of [0,1])values.push({...D,mode:3,upperTilt,lowerTilt,secondMirror});
assert.equal(values.length,758);
let reflectedRays=0,meshMaxDeviation=0;
const m=createMirrorsModel(),initialGeometries=new Set(),initialMaterials=new Set();m.root.traverse(o=>{if(o.geometry)initialGeometries.add(o.geometry);if(o.material)for(const x of Array.isArray(o.material)?o.material:[o.material])initialMaterials.add(x);});
for(const v of values){
 const s=sampleMirrors(v);if(s.normal){assert.ok(s.incidentAngle>=0&&s.incidentAngle<=90+1e-8);near(s.incidentAngle,s.reflectedAngle,1e-9);}else{assert.equal(v.mode,0);assert.ok(!s.rays.some(r=>r.received&&r.objectPoint===1));}
 for(const r of s.rays){const expected=reflect([r.hit[0]-r.source[0],r.hit[1]-r.source[1]],r.normal);expected.forEach((x,i)=>near(r.reflected[i],x));near(Math.hypot(...r.reflected),1);reflectedRays++;assert.ok(r.end.every(Number.isFinite));if(r.detector)assert.ok(r.detector.every(Number.isFinite));}
 if(v.mode===0){near(s.imageDistance,v.distance);near(s.imageHeightRatio,1);for(const r of s.rays){const ey=r.eye[1],hy=(ey*v.distance+r.virtual[1]*4)/(v.distance+4);near(r.hit[1],hy);assert.equal(r.received,Math.abs(hy)<=v.aperture+1e-10);if(r.received){const arrival=nrm([r.eye[0]-r.hit[0],r.eye[1]-r.hit[1]]);arrival.forEach((x,i)=>near(r.reflected[i],x));}}}
 if(v.mode===1){const ex=v.radius-Math.sqrt(v.radius**2-v.aperture**2),eyeAngle=Math.atan2(v.aperture,v.distance+ex),normalAngle=Math.asin(v.aperture/v.radius),half=eyeAngle+2*normalAngle;near(s.convexField,2*half*deg);assert.ok(s.convexField>s.flatField&&half<Math.PI/2);const low=v.bearing-5,high=v.bearing+5,edge=half*deg;const status=low>=-edge-1e-10&&high<=edge+1e-10?'Fully visible':high<-edge||low>edge?'Not visible':'Partially visible';assert.equal(s.markerVisibility,status);if(status==='Fully visible')assert.ok(s.apparentAngularSpan>0&&s.apparentAngularSpan<10);else assert.equal(s.apparentAngularSpan,null);for(const r of s.rays){near((r.hit[0]-v.radius)**2+r.hit[1]**2,v.radius**2);const scene=nrm([r.source[0]-r.hit[0],r.source[1]-r.hit[1]]);near(Math.atan2(scene[1],-scene[0])*deg,r.bearing,1e-8);const outgoing=nrm([s.eye[0]-r.hit[0],-r.hit[1]]);outgoing.forEach((x,i)=>near(r.reflected[i],x));}}
 if(v.mode===2){for(const r of s.rays){near(r.hit[0],-(r.hit[1]**2)/(4*v.focus));near(r.end[0],-4);assert.ok(r.reflected[0]<0);assert.ok(Math.abs(r.end[1])<1.913);const toward=nrm([r.end[0]-r.hit[0],r.end[1]-r.hit[1]]);toward.forEach((x,i)=>near(x,r.reflected[i]));}if(v.offset===0){near(s.angularSpread,0,1e-10);near(s.screenFootprint,2*v.aperture);}else assert.ok(s.angularSpread>0);}
 if(v.mode===3){const a=(-45+v.upperTilt)/deg,b=(-45+v.lowerTilt)/deg,u=[Math.cos(a),Math.sin(a)],l=[Math.cos(b),Math.sin(b)];let count=0;for(const r of s.rays){const p=hit(r.source,[1,0],[0,1.2],u,.65);p.forEach((x,i)=>near(x,r.hit[i]));const d=reflect([1,0],[-u[1],u[0]]),q=v.secondMirror?hit(p,d,[0,-1.2],l,.65):null;assert.equal(Boolean(r.secondHit),Boolean(q));if(q){q.forEach((x,i)=>near(x,r.secondHit[i]));const out=reflect(d,[-l[1],l[0]]),time=out[0]>1e-10?(3-q[0])/out[0]:-1,received=time>0&&Math.abs(q[1]+time*out[1]+1.2)<=.22+1e-10;assert.equal(r.received,received);count+=received;}else{assert.equal(r.received,false);assert.equal(r.detector,null);}}assert.equal(s.received,count);const known=v.secondMirror?(v.upperTilt===0&&v.lowerTilt===0?3:(v.upperTilt===5&&v.lowerTilt===10||v.upperTilt===-5&&v.lowerTilt===-10)?1:0):0;assert.equal(count,known);}
 m.update(v);m.actions[3].run();const state=m.getState();assert.equal(state.progress,1);assert.equal(state.mode,v.mode);assert.equal(m.topology.parts.screen.visible,v.mode===2);assert.equal(m.topology.parts.eye.visible,v.mode!==2);assert.equal(m.topology.parts.obstacle.visible,v.mode===3);
 assert.equal(state.readings.length,[10,12,10,9][v.mode]);
 assert.ok(state.readings.every(r=>r.hint&&r.value!=='Not applicable'));
 for(const control of m.controls)assert.equal(control.visibleWhen(v),control.enabledWhen(v));
 for(const [i,r] of s.rays.entries()){
  const line=m.topology.raySlots[i].incident.body.geometry.attributes.position.array;near(line[0],r.source[0],3e-7);near(line[1],r.source[1],3e-7);
  if(v.mode===1){const y=r.hit[1],step=2*v.aperture/64,index=Math.min(63,Math.max(0,Math.floor((y+v.aperture)/step))),t=(y+v.aperture-index*step)/step,ya=-v.aperture+index*step,yb=ya+step;const ax=v.radius-Math.sqrt(v.radius**2-ya**2),bx=v.radius-Math.sqrt(v.radius**2-yb**2),error=Math.abs(ax+(bx-ax)*t-r.hit[0]);meshMaxDeviation=Math.max(meshMaxDeviation,error);assert.ok(error<.00003);}
 }
 m.root.updateMatrixWorld(true);m.root.traverse(o=>{if(!o.geometry)return;assert.ok(initialGeometries.has(o.geometry),'Persistent geometry identity');const p=o.geometry.attributes.position;if(p)for(const x of p.array)assert.ok(Number.isFinite(x));});
}
// Final 3D surfaces retain the exact optical section and a physical backing.
for(const mode of [0,1,2,3])for(const cutaway of [true,false]){
 m.update({...D,mode});m.actions[cutaway?5:4].run();
 for(const r of m.topology.reflectors){if(!r.mesh.visible)continue;const s=r.surface,p=r.mesh.geometry.attributes.position,layer=r.rows*r.cols;
  for(let row=0;row<r.rows;row+=8)for(const col of [0,16,32]){const i=row*r.cols+col,x=p.getX(i),y=p.getY(i),z=p.getZ(i);
   if(s.kind==='flat')near(x,0,1e-6);
   if(s.kind==='convex')near((x-s.radius)**2+y*y+z*z,s.radius**2,2e-6);
   if(s.kind==='parabola')near(x,-(y*y+z*z)/(4*s.focus),1e-6);
   if(s.kind==='segment')near((x-s.center[0])*s.normal[0]+(y-s.center[1])*s.normal[1],0,1e-6);
   near(Math.hypot(p.getX(i+layer)-x,p.getY(i+layer)-y,p.getZ(i+layer)-z),.045,1e-6);
   assert.ok(cutaway?z<=1e-8:true);
  }
 }
}
const centered=sampleMirrors();near(centered.object[0][1]+centered.object[1][1],0);near(centered.eye[0],-4);near(centered.eye[1],-1.1);near(centered.object[0][0],centered.eye[0]/2);
// Scalar anchors independently derived and kept explicit, not read from private fixtures.
near(sampleMirrors({mode:2,offset:-.3}).screenFootprint,.4462694,1e-7);near(sampleMirrors({mode:2,offset:.3}).screenFootprint,3.2854426,1e-7);
const partial=sampleMirrors({mode:1,distance:2,radius:6,aperture:.8,bearing:40});assert.equal(partial.markerVisibility,'Partially visible');assert.equal(partial.marker.center,null);assert.notEqual(partial.marker.low,null);
near(sampleMirrors({mode:3}).incidentAngle,45);assert.equal(sampleMirrors({mode:3,secondMirror:0}).rays[1].detector,null);
for(const bad of [{mode:4},{distance:0},{height:NaN},{offset:.05},{constructor:0},JSON.parse('{"__proto__":1}')])assert.throws(()=>sampleMirrors(bad));
assert.throws(()=>reflectMirrorRay([0,0],[1,0]));assert.equal(intersectMirrorSegment([0,0],[1,0],[0,1],[1,0],1),null);
// Trace state changes no optical result; stage geometry exposes sequential bounces.
m.update({...D,mode:3});m.actions[1].run();assert.equal(m.topology.raySlots[0].reflected.body.object.visible,false);m.advance(.5);assert.equal(m.topology.raySlots[0].second.body.object.visible,false);m.actions[2].run();assert.equal(m.topology.detectorHits.filter(x=>x.object.visible).length,3);m.update({lowerTilt:10,upperTilt:5});assert.equal(m.getState().progress,0);m.actions[3].run();assert.equal(m.topology.detectorHits.filter(x=>x.object.visible).length,1);m.update({secondMirror:0});assert.equal(m.controls.find(c=>c.key==='lowerTilt').enabledWhen(m.getState().values),false);assert.equal(m.topology.reflectors[1].mesh.visible,false);assert.equal(m.topology.reflectors[1].stand.visible,false);
m.actions[4].run();for(const [id,p] of Object.entries(m.topology.parts))if(id!=='mirror')assert.equal(p.visible,false);assert.equal(m.transparentBackground,true);for(const r of m.topology.reflectors){r.mesh.geometry.computeBoundingBox();assert.ok(r.mesh.geometry.boundingBox.max.z-r.mesh.geometry.boundingBox.min.z>=1.29);}
m.reset();near(m.getState().elapsed,0);assert.deepEqual(m.getState().values,D);m.playback.step();near(m.getState().elapsed,.08);m.advance(20);assert.ok(m.playback.complete());m.reset();assert.ok(!m.playback.complete());
for(const mode of [0,1,2,3]){
 m.reset({diagram:true});m.update({...D,mode});near(m.root.rotation.y,.6);assert.deepEqual(m.replayState(),{diagram:true});
 m.actions[6].run();assert.deepEqual(m.replayState(),{diagram:false});
 m.actions[7].run();const view=m.replayState();m.reset(view);m.update({...D,mode});near(m.root.rotation.y,.6);
 m.reset();near(m.root.rotation.y,1.3);assert.deepEqual(m.replayState(),{diagram:false});
}
// Resource ownership: the factory owns each material/geometry/texture exactly once.
const counts=new Map();for(const x of [...initialGeometries,...initialMaterials,...m.topology.textures]){counts.set(x,0);x.addEventListener('dispose',()=>counts.set(x,counts.get(x)+1));}m.dispose();m.dispose();for(const n of counts.values())assert.equal(n,1);
console.log(JSON.stringify({passed:true,activeConfigurations:values.length,reflectedRays,maximumConvexChordErrorCm:meshMaxDeviation,ownedResources:counts.size,notes:'Exact analytical surfaces; displayed65-row chord interpolation differs by less than0.00003cm. Ray diagrams are eight-second teaching constructions, not physical flight times.'}));

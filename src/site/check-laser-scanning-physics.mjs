import assert from 'node:assert/strict';
import * as THREE from 'three';
import {scanPlan, scanAt, projectScanPoint, reconstructScanPoint, ridgeIntersection, SCAN, SCANNER, SCAN_DOMAINS} from './printing-physics.js';

let checks = 0, rays = 0, samples = 0, plans = 0;
const ok = (value, message) => { assert.ok(value, message); checks++; };
const near = (a,b,tolerance=1e-9) => ok(Math.abs(a-b)<=tolerance, `${a} differs from ${b}`);
const vector = (a,b,tolerance=1e-9) => a.forEach((value,i)=>near(value,b[i],tolerance));
const final = values => { const p=scanPlan(values); return scanAt(p,p.duration); };

assert.equal(scanAt(scanPlan({}),0).held,0,'A reset scan must contain no acquired points'); checks++;
for (const sideSign of [-1,1]) {
  const optics={standoff:30,focal:20,baseline:10,sideSign};
  vector(projectScanPoint([4,10,7],optics),[4,10*sideSign]);
  vector(reconstructScanPoint([4,10*sideSign],optics,7),[4,10,7]);
  for (const x of [-12,-4,0,7,12]) for (const height of [0,6,12]) {
    const point=[x,height,3], image=projectScanPoint(point,optics);
    vector(reconstructScanPoint(image,optics,3),point);
    vector(reconstructScanPoint(image,{...optics,ridge:99},3),point);
  }
}
for (const baseline of [0,-1,NaN,Infinity]) assert.throws(()=>projectScanPoint([0,0,0],{standoff:66,focal:20,baseline,sideSign:1}),RangeError);
for (const image of [[0,0],[0,-1],[NaN,2],[0,Infinity],[0]]) assert.throws(()=>reconstructScanPoint(image,scanPlan({}),0),RangeError);
assert.throws(()=>projectScanPoint([0,66,0],scanPlan({})),RangeError);
assert.throws(()=>ridgeIntersection([0,1],[0,0,0],6),RangeError);

// The independent obstruction oracle intersects the rendered box triangles.
const raycaster=new THREE.Raycaster(), origin=new THREE.Vector3(), end=new THREE.Vector3(), direction=new THREE.Vector3();
for (const ridge of [2,6,12]) for (const standoff of [53.5,66,78.5]) for (const baseline of [4,8,16]) for (const side of [0,1]) {
  const plan=scanPlan({ridge,standoff,baseline,side}), box=new THREE.Mesh(new THREE.BoxGeometry(12,ridge,4),new THREE.MeshBasicMaterial({side:THREE.DoubleSide}));
  box.position.y=ridge/2;box.updateMatrixWorld(true);const bounds=new THREE.Box3().setFromObject(box).expandByScalar(1e-9);
  const hit = (from,to) => {
    origin.fromArray(from);end.fromArray(to);direction.copy(end).sub(origin);const length=direction.length();direction.normalize();
    raycaster.set(origin,direction);raycaster.near=1e-8;raycaster.far=length-1e-8;
    for(const intersection of raycaster.intersectObject(box)) {
      // A corner touched without entering the closed solid is a tangent, not an obstruction.
      if(bounds.containsPoint(intersection.point.clone().addScaledVector(direction,1e-6))) return intersection.point.toArray();
    }
    return null;
  };
  for(const sample of plan.samples) {
    const laserHit=hit(sample.laser,sample.target), cameraHit=hit(sample.receiver,sample.target);
    ok(sample.lit===!laserHit,'Illumination agrees with the actual solid');
    ok(sample.seen===(!laserHit&&!cameraHit),'Camera visibility agrees with the actual solid');
    vector(sample.laserEnd,laserHit||sample.target,1e-7);vector(sample.receiverEnd,cameraHit||sample.target,1e-7);
    rays+=2;
  }
  box.geometry.dispose();box.material.dispose();
}

for(const ridge of [0,6,12]) for(const standoff of [53.5,66,78.5]) for(const baseline of [4,8,16]) for(const side of [0,1]) for(const pixel of [0,1,2]) for(const subpixel of [0,1]) for(const spacing of [0,1,2]) {
  const p=scanPlan({ridge,standoff,baseline,side,pixel,subpixel,spacing});plans++;
  const done=scanAt(p,6), expectedSide=side===0?1:-1;
  ok(done.attempted===p.profiles*p.columns.length,'All selected upper-face positions attempted');
  ok(done.held+done.gaps===done.attempted,'Return accounting');
  ok(Object.values(done.reasons).reduce((a,b)=>a+b,0)===done.gaps,'Missing reason accounting');
  ok(done.cloud.every(point=>point.every(Number.isFinite)),'Every output coordinate is finite');
  for(const sample of p.samples) {
    samples++;
    near(sample.receiver[2]-sample.laser[2],-expectedSide*baseline);
    near(sample.receiver[0],0);near(sample.laser[0],0);
    const expectedHeight=Math.abs(sample.x)<=6&&Math.abs(sample.z)<=2?ridge:0;
    near(sample.surface,expectedHeight);
    if(sample.reason==='range') ok(sample.depth<53.5||sample.depth>78.5,'Only points outside the depth window rejected for range');
    if(!sample.point) { ok(sample.measured===null,'No height invented for a rejected point');continue; }
    ok(sample.lit&&sample.seen&&sample.depth>=53.5&&sample.depth<=78.5,'Only visible, in-range records returned');
    const C=new THREE.Vector3(0,standoff,sample.z-expectedSide*baseline), P=new THREE.Vector3(...sample.target);
    const detectorPoint=P.clone().sub(C).multiplyScalar(20/(standoff-P.y)).add(C);
    vector(sample.image,[detectorPoint.x-C.x,detectorPoint.z-C.z],1e-12);
    const grid=p.pixel/(subpixel===0?1:50), uv=sample.image.map(value=>Math.floor(value/grid+.5)*grid);
    vector(sample.reached,uv,1e-12);
    const cameraDirection=new THREE.Vector3(uv[0]/20,-1,uv[1]/20), scale=(sample.z-C.z)/cameraDirection.z;
    const recovered=C.addScaledVector(cameraDirection,scale);
    vector(sample.point,recovered.toArray(),1e-10);
    const v=Math.abs(sample.image[1]), dLow=20*baseline/(v+grid/2), dHigh=20*baseline/(v-grid/2);
    ok(sample.measured>=standoff-dHigh-1e-9&&sample.measured<=standoff-dLow+1e-9,'Exact nonlinear quantization bound');
    near(sample.measured,sample.point[1]);near(sample.error,sample.measured-sample.surface);
  }
}

for(const baseline of [4,8,16]) for(const ridge of [6,12]) {
  const a=scanPlan({baseline,ridge,side:0}),b=scanPlan({baseline,ridge,side:1});
  const positions=(plan,reason,mirror=false)=>plan.samples.filter(s=>s.reason===reason).map(s=>`${s.x},${mirror?-s.z:s.z}`).sort();
  assert.deepEqual(positions(a,'hidden',true),positions(b,'hidden'));checks++;
  assert.deepEqual(positions(a,'unlit'),positions(b,'unlit'));checks++;
}
for(const spacing of [0,1,2]) {
  const p=scanPlan({ridge:12,spacing}),end=scanAt(p,6);
  let prior=0;
  for(const time of [0,1e-7,.01,.249999,.25,.5,1,2.9,3,5.999,6,8]) {
    const now=scanAt(p,time);ok(now.held>=prior,'Acquisition is monotone');prior=now.held;
    assert.deepEqual(now.cloud,end.cloud.slice(0,now.held));checks++;
    near(now.position,Math.min(time,6)*4-12);
    ok(now.profiles===(time===0?0:Math.min(p.profiles,Math.floor(Math.min(time,6)*4/p.spacing+1e-9)+1)),'Profile timing');
  }
  let elapsed=0;for(let i=0;i<600;i++)elapsed+=.01;
  assert.deepEqual(scanAt(p,Math.min(6,elapsed+1e-10)).cloud,end.cloud);checks++;
}
for(const [key,[lo,hi,step]] of Object.entries(SCAN_DOMAINS)) {
  for(let value=lo;value<=hi+1e-9;value+=step) {
    const p=scanPlan({[key]:Number(value.toFixed(6))});ok(scanAt(p,0).cloud.length===0,`${key} begins empty`);
    for(const depth of [SCANNER.start,SCANNER.end]) {
      const microns=depth*depth*p.grid/(p.focal*p.baseline)*1000;
      ok(microns>=.1&&microns<=1000,'Full chart domain contains every control setting');
    }
  }
  assert.throws(()=>scanPlan({[key]:lo-step}),RangeError);assert.throws(()=>scanPlan({[key]:hi+step}),RangeError);
}
const fixtures=[ [{},625,0], [{ridge:0},625,0], [{ridge:12},600,25], [{ridge:12,side:1},600,25], [{baseline:16},612,13], [{baseline:4},625,0], [{ridge:12,spacing:2},49,0], [{standoff:53.5},560,65] ];
for(const [values,held,gaps] of fixtures) { const s=final(values);ok(s.held===held&&s.gaps===gaps,'Named comparison outcome'); }
near(final({}).middle.measured,5.99993999994,1e-10);near(final({subpixel:0}).middle.measured,6.023240994115,1e-10);
const p=scanPlan({});near(p.resolutionMicrons,2.01465);near(scanPlan({baseline:16}).resolutionMicrons,p.resolutionMicrons/2);
console.log(JSON.stringify({ok:true,checks,plans,samples,meshRays:rays,fixtures:fixtures.length}));

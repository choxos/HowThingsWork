import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createCapillaryModel, MM, APPARATUS as A, DETAIL, capillaryChartPoint} from './capillary-model.js';
import {CAPILLARY_DEFAULTS, capillaryPlan} from './capillary-physics.js';
import {capillaryActionLesson as lesson} from './pens-lessons.js';
import {tally, checkDisposal, checkFinite, checkControlsMove} from './model-check-kit.mjs';

const t=tally(),model=createCapillaryModel(),B=model.topology;
let poses=0,rays=0,vertices=0;
const reset=(settings,time=0)=>{model.reset({settings,time});model.root.updateMatrixWorld(true);return model.getState();};
function hit(objects,origin,direction){rays++;return new THREE.Raycaster(new THREE.Vector3(...origin).multiplyScalar(MM),new THREE.Vector3(...direction)).intersectObjects([].concat(objects),false);}
function volume(mesh){
  const g=mesh.geometry,p=g.attributes.position,index=g.index,n=index?index.count:p.count;
  const a=new THREE.Vector3(),b=new THREE.Vector3(),c=new THREE.Vector3();let sum=0;
  for(let i=0;i<n;i+=3){a.fromBufferAttribute(p,index?index.getX(i):i);b.fromBufferAttribute(p,index?index.getX(i+1):i+1);c.fromBufferAttribute(p,index?index.getX(i+2):i+2);sum+=a.dot(b.cross(c))/6;}
  return Math.abs(sum*mesh.scale.x*mesh.scale.y*mesh.scale.z)/MM**3;
}
const bounds=mesh=>new THREE.Box3().setFromObject(mesh);
for(const liquid of [0,1,2])for(const radius of [.1,.2,.5])for(const depth of [5,15,60])for(const wetting of [0,1,2,3]){
  const s=reset({liquid,radius,depth,wetting}),theta=s.angle*Math.PI/180;
  const expected=2*s.liquid.tension*Math.cos(theta)/(s.liquid.density*9.81*radius*.001)*1000;
  t.near(s.height,expected,1e-10,'render state agrees with independent signed pressure balance');
  t.ok(B.column.visible===(depth+expected>1e-10),'tube contains liquid only when interior equilibrium is accessible');
  for(const mesh of [B.tubeBack,B.tubeFront]){
    const box=bounds(mesh);t.near(box.min.y/MM,-depth,2e-6,'tube mouth follows immersion');t.near(box.max.y/MM,220-depth,3e-5,'tube length remains 220 mm');
    t.near(volume(mesh),Math.PI*(4-radius*radius)*220/2,.001*Math.PI*(4-radius*radius)*220/2,'actual wall is a half annular solid');
    const p=mesh.geometry.attributes.position;let smallest=Infinity,largest=0;
    for(let i=0;i<p.count;i++){const r=Math.hypot(p.getX(i),p.getZ(i))/MM;smallest=Math.min(smallest,r);largest=Math.max(largest,r);}
    t.near(smallest,radius,2e-7,'inner wall uses the physical bore radius');t.near(largest,2,2e-7,'outer glass radius remains fixed');
  }
  t.ok(hit([B.tubeBack,B.tubeFront],[0,230,0],[0,-1,0]).length===0,'bore remains open from top to bottom');
  t.ok(hit([B.tubeBack,B.tubeFront],[1,230,0],[0,-1,0]).length>0,'glass surrounds the open bore');
  const inner=hit([B.tubeBack,B.tubeFront],[0,100-depth,0],[1,0,0]);t.ok(inner.length>0,'bore has a real inner wall');t.near(inner[0].distance/MM,radius,2e-6,'ray from center meets bore radius');
  t.ok(hit(B.bathSurface,[0,2,0],[0,-1,0]).length===0,'bath surface does not cover empty or depressed tube');
  t.ok(hit(B.bathSurface,[2.1,2,0],[0,-1,0]).length>0,'bath surface reaches outside the tube wall');
  t.ok(hit(B.bathSurface,[60,2,0],[0,-1,0]).length===0,'bath surface has an opening around both wedge plates');
  t.ok(hit(B.bathSurface,[60,2,1.1],[0,-1,0]).length>0,'bath remains connected alongside the wedge');
  t.near(bounds(B.lowerTube).min.y/MM,-66,3e-5,'liquid below tube meets bath floor');t.near(bounds(B.lowerTube).max.y/MM,-depth,3e-5,'lower reservoir liquid reaches tube mouth');
  t.near(bounds(B.lowerWedge).min.y/MM,-66,3e-5,'liquid below wedge meets bath floor');t.near(bounds(B.lowerWedge).max.y/MM,-depth,3e-5,'lower reservoir liquid reaches plate mouths');
  for(const mesh of B.plates){const box=bounds(mesh);t.near(box.min.y/MM,-depth,2e-6,'both plate mouths are immersed');t.near(box.max.y/MM,220-depth,3e-5,'both plates retain their length');}
  // Probe the actual plate gap from its center at three locations.
  for(const x of [1,20,39])for(const side of [-1,1]){
    const hits=hit(B.plates,[40+x,100-depth,0],[0,0,side]);t.ok(hits.length>0,'glass bounds both sides of gap');t.near(hits[0].distance/MM,(.1+.9*x/40)/2,3e-6,'plate faces meet actual half-gap');
  }
  const p=B.sheet.geometry.attributes.position;
  if(p){
    for(let i=0;i<p.count;i++){
      const x=p.getX(i)/MM,y=p.getY(i)/MM,z=p.getZ(i)/MM,gap=.1+.9*x/40;
      t.near(Math.abs(z),gap/2,2e-6,'liquid sheet touches both inner plate faces');
      const top=2*s.liquid.tension*Math.cos(theta)/(s.liquid.density*9.81*gap*.001)*1000;
      t.near(y,i%4<2?-depth:Math.max(-depth,top),3e-5,'actual sheet follows local signed balance');
      t.ok(y>=-depth-3e-5&&y<220-depth,'sheet stays between immersed opening and top');vertices++;
    }
  }
  const tangent=B.tangents.geometry.attributes.position;
  for(const [i,side] of [[0,-1],[2,1]]){
    t.near(tangent.getX(i),side*DETAIL.bore,1e-8,'tangent begins at wall contact');t.near(tangent.getY(i),0,0,'contact uses meniscus wall level');t.near(tangent.getZ(i),.002,1e-9,'tangent remains on same cross-section plane');
    const dx=tangent.getX(i+1)-tangent.getX(i),dy=tangent.getY(i+1)-tangent.getY(i);
    const angle=Math.atan2(-side*dx,-dy)*180/Math.PI;t.near(angle,s.angle,1e-5,'drawn tangent gives selected angle through liquid');
  }
  const curve=B.menCurve.geometry.attributes.position,cos=Math.cos(theta),R=radius/Math.max(1e-15,Math.abs(cos));
  for(let i=0;i<curve.count;i++){
    const x=radius*(-1+2*i/(curve.count-1)),y=curve.getY(i)*radius/DETAIL.bore;
    t.near(curve.getX(i)*radius/DETAIL.bore,x,3e-8,'curve abscissa uses uniform enlargement');
    const expectedY=Math.abs(cos)<1e-12?0:-Math.sign(cos)*(Math.sqrt(Math.max(0,R*R-x*x))-Math.sqrt(Math.max(0,R*R-radius*radius)));
    t.near(y,expectedY,5e-5,'enlarged curve has uniform scale and spherical curvature');
  }
  const chart=B.curve.geometry.attributes.position;for(let i=0;i<chart.count;i++){
    const size=.1+.9*i/180,expectedPoint=capillaryChartPoint(size,s.height*radius/size);
    t.near(chart.getX(i),expectedPoint[0],1e-7,'chart size coordinate');t.near(chart.getY(i),expectedPoint[1],1e-7,'chart signed height coordinate');
    t.ok(chart.getY(i)>=-.500001&&chart.getY(i)<=.750001,'all height curves stay inside chart');
  }
  const physical=[B.column,B.sheet,B.tubeBack,B.tubeFront,...B.plates].map(o=>[o.geometry.uuid,o.position.toArray()]);
  for(const time of [0,1,3,5,6]){model.reset({settings:s.values,time});assert.deepEqual([B.column,B.sheet,B.tubeBack,B.tubeFront,...B.plates].map(o=>[o.geometry.uuid,o.position.toArray()]),physical,'guide cannot silently move physical equilibrium');}
  const snapshot=JSON.stringify(model.getState());for(const action of model.actions){action.run();t.ok(JSON.stringify(model.getState())===snapshot,'inspection preserves settings and guide stage');}
  checkFinite(model.root,t);poses++;
}
for(const trial of lesson.tryIt){const s=reset(trial.initialState.settings,trial.initialState.time);assert.deepEqual(trial.values,trial.initialState.settings);assert.deepEqual(Object.keys(trial.values).sort(),Object.keys(CAPILLARY_DEFAULTS).sort());t.ok(model.parts.some(p=>p.id===trial.part),'every trial selects an existing inspection');t.ok(s.clock===trial.initialState.time,'named stage is applied');}
const expectedTrials=[74.2099898063,148.4199796126,29.6839959225,74.2099898063,74.2099898063,28.7745648331,-26.699246421,-10.6796985684,-26.699246421,37.1049949032,0,-37.1049949032,-26.699246421];
lesson.tryIt.forEach((trial,i)=>t.near(capillaryPlan(trial.values).height,expectedTrials[i],1e-9,'each named trial computes its stated signed height'));
checkControlsMove(model,()=>({column:volume(B.column),sheet:volume(B.sheet),stand:B.carriage.position.y,color:B.liquidMaterial.color.getHex()}),()=>{},t);
reset({liquid:2,radius:.5},3);const settings=model.getState().values;model.reset(model.replayState());assert.deepEqual(model.getState().values,settings);t.near(model.getState().clock,0,0,'replay restarts explanation with selected comparison');
for(let i=0;i<60;i++)model.playback.step();t.ok(model.playback.complete(),'60 explanation steps complete');
const before=JSON.stringify(model.getState());for(const dt of [0,-1,NaN,Infinity])model.advance(dt);t.ok(JSON.stringify(model.getState())===before,'invalid increments do not change guide');
const resources=checkDisposal(model,t);
console.log(JSON.stringify({passed:true,checks:t.count,poses,rays,vertices,trials:lesson.tryIt.length,resources}));

import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createVibrationMotorModel,vibrationMotorControlVisible} from './vibration-motor-model.js';
import {eccentricVibrationMotorLesson as lesson} from './vibration-motor-lesson.js';
import {MOTOR_LENGTH_SCALE as L,MOTOR_MOTION_SCALE as A} from './vibration-motor-geometry.js';
import {tally,checkDisposal} from './model-check-kit.mjs';
const t=tally(),m=createVibrationMotorModel(),p=m.topology;let poses=0,shapeCases=0;
const near=(a,b,tol=1e-9)=>t.ok(Number.isFinite(a)&&Math.abs(a-b)<=tol,`${a} differs from ${b}`);
function volumeCentroid(geometry){
 const a=geometry.attributes.position,index=geometry.index;let volume=0;const centroid=new THREE.Vector3();
 for(let i=0;i<(index?.count??a.count);i+=3){const vertices=[0,1,2].map(j=>new THREE.Vector3().fromBufferAttribute(a,index?index.getX(i+j):i+j)),v=vertices[0].dot(vertices[1].clone().cross(vertices[2]))/6;volume+=v;centroid.add(vertices.reduce((s,v)=>s.add(v),new THREE.Vector3()).multiplyScalar(v/4));}
 return {volume,centroid:centroid.divideScalar(volume)};
}
t.ok(m.parts.length===21&&new Set(m.parts.map(p=>p.id)).size===21,'21 unique physical and teaching groups');
// Read connections back from the actual drawing paths, not from result numbers.
for(let i=0;i<3;i++){
 const coil=p.windings.children[i].geometry.parameters.path;
 near(coil.getPoint(0).distanceTo(new THREE.Vector3(...p.coilEnds[i][0])),0);
 near(coil.getPoint(1).distanceTo(new THREE.Vector3(...p.coilEnds[i][1])),0);
 for(let j=0;j<2;j++){
  const lead=p.windings.children[3+i*2+j].geometry.parameters.path;
  near(lead.getPoint(0).distanceTo(coil.getPoint(j)),0);
  const node=p.commutatorNodes[(i+j)%3];near(lead.getPoint(1).distanceTo(new THREE.Vector3(...node)),0);
  t.ok(Math.hypot(node[0],node[1])>.07&&Math.hypot(node[0],node[1])<.18&&node[2]>=-.585&&node[2]<=-.455,'Winding terminates on copper, inside its commutator segment');
 }
}
for(const brush of p.brushMeshes){const inner=Math.abs(brush.position.x)-brush.geometry.parameters.width/2;t.ok(inner<=.18&&inner>.17,'Carbon brush reaches the commutator surface');}
{
 const vertices=p.commutatorHub.geometry.attributes.position,radii=Array.from({length:vertices.count},(_,i)=>Math.hypot(vertices.getX(i),vertices.getY(i)));
 near(Math.min(...radii),.04,1e-8);near(Math.max(...radii),.07,1e-8);
 t.ok(p.commutatorHub.parent===p.commutator,'Insulating hub stays with commutator segments in separation');
 t.ok(p.guides.children.every(c=>c.material.side===THREE.FrontSide),'Captions do not show mirrored text from behind');
}
for(const rib of p.endFrames){rib.updateMatrix();const h=rib.geometry.parameters.height,a=new THREE.Vector3(0,-h/2,0).applyMatrix4(rib.matrix),b=new THREE.Vector3(0,h/2,0).applyMatrix4(rib.matrix);t.ok(Math.hypot(a.x,a.y)<.13&&Math.hypot(b.x,b.y)>.63&&Math.hypot(b.x,b.y)<.75,'End-frame rib connects bearing to outer ring');}
near(p.shaftMesh.geometry.parameters.radiusTop,.04);t.ok(p.shaftMesh.geometry.parameters.height/2+p.shaftMesh.position.z>1,'Shaft extends through both bearings and the weight hub');
for(const mass of [.1,.3,.6])for(const offset of [1.5,2,2.5,3]){
 m.reset({settings:{mass,offset}});const s=m.getState(),w=s.parameters.weight,{volume,centroid}=volumeCentroid(p.weightMesh.geometry);shapeCases++;
 near(volume/L**3*w.mass/(w.mass/15630),w.mass,w.mass*.0003);
 near(centroid.x/L,w.eccentricity,1e-7);near(centroid.y,0,1e-8);near(centroid.z,0,1e-8);
 near(p.centroid.position.x,offset*.1);t.ok(.86-w.thickness*L/2>.72,'Weight clears front bearing at every selected shape');
 t.ok(w.outer*L<.75,'Weight fits inside the declared maximum motor radius');
 for(const mesh of [p.weightMesh,p.counterMesh]){mesh.geometry.computeBoundingBox();near(mesh.geometry.boundingBox.max.z-mesh.geometry.boundingBox.min.z,w.thickness*L,1e-8);}
}
const configurations=[{},{power:0},{voltage:0},{direction:-1},{balance:1},{program:1},{program:2},{program:3},{mount:1},{mount:2},{mount:2,program:3,voltage:4.5,mass:.6,offset:3,stiffness:10000,damping:.5},{mount:1,balance:1},{mount:2,balance:1}];
for(const settings of configurations)for(const time of [0,7.49,7.5,10,20]){
 m.reset({settings,time});m.root.position.set(.3,-.1,.5);m.root.rotation.set(.12,.31,-.21);m.update({});m.root.updateMatrixWorld(true);const s=m.getState();poses++;
 near(p.motor.position.x,s.x*L*A);near(p.motor.position.z,-s.y*L*A);near(p.carriage.position.x,p.motor.position.x);near(p.rotor.rotation.z,s.angle);
 for(const [i,l]of p.leadLines.entries()){
  const position=l.geometry.attributes.position,expected=new THREE.Vector3(...p.brushTerminals[i]).applyMatrix4(p.motor.matrix);
  near(new THREE.Vector3().fromBufferAttribute(position,3).distanceTo(expected),0,1e-7);
  near(new THREE.Vector3().fromBufferAttribute(position,0).distanceTo(new THREE.Vector3(...p.terminals[i])),0,1e-7);
 }
  if(s.values.balance){
  t.ok(p.counterweight.parent===p.rotor&&p.counterweightPart.parentId==='rotor','Fitted counterweight belongs to the rotor in isolation and separation');
  const e=s.values.offset*.1,main=p.weight.localToWorld(new THREE.Vector3(e,0,.86)),other=p.counterweight.localToWorld(new THREE.Vector3(e,0,0)),axis=p.motor.localToWorld(new THREE.Vector3(0,0,.86));
  near(main.add(other).multiplyScalar(.5).distanceTo(axis),0,1e-9);
 }else {t.ok(p.counterweight.parent===p.fixture&&p.counterweightPart.parentId==='rotor','Unused rotor component physically rests on the fixed spare holder');near(p.counterweight.position.x,2);near(p.counterweight.position.z,1.05);near(p.counterweight.position.y-s.parameters.weight.thickness*L/2,.09);}
 t.ok(p.clamp.visible===(s.values.mount===0)&&p.free.visible===(s.values.mount===1)&&p.elastic.visible===(s.values.mount===2),'Exactly the selected support is visible');
 for(const {anchor,seat,line}of p.springs){const a=line.geometry.attributes.position;near(new THREE.Vector3().fromBufferAttribute(a,0).distanceTo(new THREE.Vector3(...anchor)),0,1e-7);near(a.getX(64),seat[0]+p.motor.position.x,1e-7);near(a.getZ(64),seat[2]+p.motor.position.z,1e-7);}
 for(const [i,key]of ['x','y'].entries())for(const j of [0,100,200]){const a=[p.xTrace,p.yTrace][i].geometry.attributes.position,span=Math.max(1,s.maxDisplacement*1e6*1.05);near(a.getX(j),-1.5+3*s.trace[j].time/.2,1e-7);near(a.getY(j),-.62+.5*s.trace[j][key]*1e6/span,1e-7);}
 t.ok(p.switchArm.geometry.attributes.position.getY(1)>.9===!s.connected,'Open circuit has a lifted switch');
 t.ok(p.currentArrow.visible===(Math.abs(s.current)>1e-12),'No current arrow for a zero current');
 if(s.values.balance)t.ok(!p.excitationArrow.visible&&!p.reactionArrow.visible,'Balanced pair creates no net weight-force arrow');
 const before=structuredClone(s);for(const action of m.actions){action.run();assert.deepEqual(m.getState(),before,'Inspection preserves the complete trial');t.add();}
 const b=new THREE.Box3().setFromObject(p.system);t.ok(!b.isEmpty()&&[...b.min,...b.max].every(Number.isFinite),'Finite geometry');
}
for(const mount of [0,1,2]){t.ok(vibrationMotorControlVisible('bodyMass',{mount})===(mount!==0),'Body mass visible for translating support');for(const key of ['stiffness','damping'])t.ok(vibrationMotorControlVisible(key,{mount})===(mount===2),'Elastic parameters only on elastic support');}
for(const preset of lesson.tryIt){m.reset(preset.initialState);m.update(preset.values);t.ok(m.parts.some(p=>p.id===preset.part),'Preset points to a real inspection');t.ok(m.getState().readings.every(r=>r.label&&r.value&&r.hint),'Every result has a named explanation');m.advance(20);t.ok(m.getState().complete,'Preset finishes or explicitly blocks');}
m.reset({time:20});near(m.getState().rpm,9502.9444,.001);near(m.getState().current,.0504854,1e-7);
for(const [program,rpm]of [[1,2720.3143],[2,295.4565],[3,-8912.0314]]){m.reset({settings:{program},time:20});near(m.getState().rpm,rpm,.001);}
m.reset({settings:{voltage:1.5},time:20});near(m.getState().radialForce,.1485473378,1e-8);
const resources=checkDisposal(m,t);console.log(`PASS vibration motor model: ${t.count} checks, ${poses} poses, ${shapeCases} weight meshes, ${lesson.tryIt.length} presets, ${resources} resources`);

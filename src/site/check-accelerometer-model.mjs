import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createAccelerometerModel,accelerometerControlVisible} from './accelerometer-model.js';
import {capacitiveAccelerometerLesson as lesson} from './accelerometer-lesson.js';
import {tally,checkDisposal} from './model-check-kit.mjs';
const t=tally(),m=createAccelerometerModel(),p=m.topology;let poses=0;
const near=(a,b,tol=1e-9)=>t.ok(Math.abs(a-b)<tol,`${a} differs from ${b}`);
t.ok(m.parts.length===20,'Twenty named physical/concept groups');
t.ok(new Set(m.parts.map(p=>p.id)).size===20,'Unique selectable IDs');
for(const mount of p.mounts){mount.updateMatrix();const a=new THREE.Vector3(0,-.17,0).applyMatrix4(mount.matrix),b=new THREE.Vector3(0,.17,0).applyMatrix4(mount.matrix);near(a.z+p.center[2],-.16);near(b.z,-.06);}
t.ok(m.catalogParts.some(p=>p.id==='response-detail'),'Response chart supports a part bookmark without entering the parts inventory');
m.root.updateMatrixWorld(true);
const bounds=o=>new THREE.Box3().setFromObject(o);
for(const {z,side,arm,stand}of p.plateSupports){
 t.ok(bounds(arm).intersectsBox(bounds(z<0?p.rear:p.front)),'Each fixed Z plate touches its supporting arms');
 t.ok(bounds(arm).intersectsBox(bounds(stand)),'Each supporting arm touches an insulating standoff');
 t.ok(bounds(stand).intersectsBox(bounds(p.frame.children[side<0?0:1])),'Each standoff reaches a real fixed-frame beam');
}
for(const {points,segments}of p.sensingLeads){
 for(let i=0;i<2;i++){
  const rod=segments[i];rod.updateMatrix();
  const length=rod.geometry.parameters.height;
  const endpoints=[new THREE.Vector3(0,-length/2,0).applyMatrix4(rod.matrix),new THREE.Vector3(0,length/2,0).applyMatrix4(rod.matrix)];
  near(endpoints[0].distanceTo(new THREE.Vector3(...points[i])),0);near(endpoints[1].distanceTo(new THREE.Vector3(...points[i+1])),0);
 }
 near(points[0][0],p.frame.position.x+.98+.06);near(points[0][2],p.frame.position.z);near(points[2][0],1.10-.46/2,.02);
}
for(const experiment of [0,1,2,3]){
 const visible=m.controls.filter(c=>accelerometerControlVisible(c.key,{experiment})).map(c=>c.key);
 t.ok(visible.includes('experiment')&&visible.includes('axis')&&visible.includes('power')&&visible.includes('capacitor'),'Core controls always visible');
 t.ok(visible.includes('frequency')===(experiment===2),'Frequency only for sinusoid');
 t.ok(visible.includes('support')===(experiment===0),'Motion condition only for pose');
}
for(const settings of [{},{roll:180},{roll:-90},{pitch:90},{pitch:-90},{support:1},{support:2},{power:0},...Array.from({length:3},(_,axis)=>({experiment:3,axis})),...Array.from({length:3},(_,axis)=>({experiment:2,axis,amplitude:2,frequency:20}))])for(const time of [0,.6,1.2,3,6]){
 m.reset({settings,time});m.root.updateMatrixWorld(true);const s=m.getState();poses++;
 for(const key of ['x','y','z'])near(p.mass.position[key]-p.center['xyz'.indexOf(key)],s.displacement[key]);
 // Physical front/rear clearance remains positive throughout the full trial domain.
 t.ok(s.displacement.z>-.1875,'Mass stays above the rear plate');
 t.ok(s.displacement.z+.08<.2675,'Mass stays below the front plate');
 t.ok(Math.abs(s.displacement.x)<.16&&Math.abs(s.displacement.y)<.16,'Finger-side clearance remains positive');
 // Check in module coordinates: rotating the entire module must not change gaps.
 const massZ=[s.displacement.z,s.displacement.z+.08];
 for(const {z,side}of p.plateSupports){
  t.ok(z+.014<massZ[0]||z-.014>massZ[1],'Plate arms clear the suspended mass vertically');
  t.ok(Math.abs(side*.98-s.displacement.x)>.72+.018,'Insulating standoffs clear the moving fingers laterally');
 }
 const position=p.outputTrace.geometry.attributes.position;
 near(p.massLead.geometry.attributes.position.getX(0),p.middle.position.x,1e-8);
 near(p.massLead.geometry.attributes.position.getY(0),p.middle.position.y-.85/2,1e-8);
 near(p.massLead.geometry.attributes.position.getX(3),0);
 t.ok(p.outputTrace.geometry.boundingBox.max.x>=-1.55+3.1*s.physicalTime-2e-7,'Dynamic trace bounds follow the record');
 for(const i of [0,100,200]){near(position.getX(i),-1.55+3.1*s.trace[i].t,2e-7);near(position.getY(i),s.trace[i].output*.31,2e-7);}
 for(const [i,key]of [...'xyz'].entries())t.ok(p.outputs[i].userData.textLabel===true||p.outputs[i].userData.setText,'Output labels are live text');
 const b=new THREE.Box3().setFromObject(p.module);t.ok(!b.isEmpty()&&[...b.min,...b.max].every(Number.isFinite),'Finite module bounds');
 const before=structuredClone(s);for(const action of m.actions){action.run();assert.deepEqual(m.getState(),before,'Inspection preserves every setting and sample');t.ok(m.parts.some(p=>p.id===action.part),'Inspection target exists');}
}
for(const trial of lesson.tryIt){
 m.reset(trial.initialState);m.update(trial.values);
 t.ok(m.parts.some(p=>p.id===trial.part),'Preset has a real view');
 t.ok(m.getState().readings.every(r=>r.label&&r.value&&r.hint),'Named result and explanation');
 const snapshot=m.getState();t.ok(snapshot.clock===(trial.initialState.time??0),'Applying same preset controls preserves its authored time');
 m.advance(10);t.ok(m.getState().complete,'Every preset reaches completion or explicit power block');
}
m.reset({settings:{experiment:1,capacitor:2},time:1.2});near(m.getState().filtered.y,.48567139308789875,1e-6);
m.reset({settings:{experiment:3},time:6});near(m.getState().voltage.x,1.175);near(m.getState().voltage.y,2.125);near(m.getState().voltage.z,2.05);
m.reset({settings:{power:0}});t.ok(!p.inputTrace.visible&&!p.outputTrace.visible,'No electrical trace without power');t.ok(p.mass.position.y<p.center[1],'Unpowered supported mass still deflects');
m.reset({settings:{support:1}});t.ok(!p.forceArrow.visible,'Zero-force arrow disappears');
t.ok(m.resultPart.preserveOnReset,'Preset reset preserves chosen inspection framing');
const resources=checkDisposal(m,t);console.log(`PASS accelerometer model: ${t.count} checks, ${poses} poses, ${lesson.tryIt.length} presets, ${resources} resources`);

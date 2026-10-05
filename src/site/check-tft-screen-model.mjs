import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createTftScreenModel} from './tft-screen-model.js';
import {tftScreenLesson as lesson} from './tft-screen-lesson.js';
import {TFT,TFT_DURATION,TFT_RECORD,TFT_FRAME,tftPixelAt,tftVoltageSteps} from './tft-screen-physics.js';
import {studyLessons} from './study-lessons.js';
import {createStudyModel} from './study-models.js';
import {tally,checkDisposal} from './model-check-kit.mjs';

const t=tally(),m=createTftScreenModel(),p=m.topology;let poses=0,textureSamples=0;
const near=(a,b,tolerance=1e-7)=>t.ok(Number.isFinite(a)&&Math.abs(a-b)<=tolerance,`${a} differs from ${b}`);
const layers=['reflector','light-guide','diffuser','rear-polarizer','rear-glass','pixel-electrodes','rear-alignment','liquid-crystal','front-alignment','common-electrode','color-filters','front-glass','front-polarizer'];
let previous=-Infinity;
for(const id of layers){const object=m.parts.find(p=>p.id===id).object,mesh=object.children[0];t.ok(mesh.position.z>previous,'Drawn physical layers follow rear-to-front light order');previous=mesh.position.z;}
near(p.picture.geometry.parameters.width/p.picture.geometry.parameters.height,480/272);
t.ok(p.display.texture.colorSpace===THREE.SRGBColorSpace&&p.display.texture.magFilter===THREE.NearestFilter,'Picture uses encoded pixel samples without interpolating adjacent pixels');
p.sourceRibbon.updateMatrix();
for(const i of [0,1]){
 const endpoint=new THREE.Vector3(0,(i?1:-1)*p.sourceRibbon.geometry.parameters.height/2,0).applyMatrix4(p.sourceRibbon.matrix);near(endpoint.distanceTo(p.sourceEndpoints[i]),0);
 const support=(i?p.source:p.board).children[0];support.updateMatrixWorld(true);t.ok(new THREE.Box3().setFromObject(support).containsPoint(endpoint),'Source ribbon physically meets board and driver');
}
t.ok(p.guides.children.every(mesh=>mesh.material.side===THREE.FrontSide),'Assembled captions cannot appear as mirrored writing from behind');
for(let i=0;i<10;i++){
 const rod=p.polarizerAxes[i],direction=new THREE.Vector3(0,1,0).applyQuaternion(rod.quaternion);
 t.ok(rod.position.x>(i%2?1.275:-1.325),'Polarizer axis marks lie on the visible face, outside the slab');
 near(Math.abs(direction.dot(new THREE.Vector3(...(i%2?[0,0,1]:[0,1,0])))),1);
}
const cases=[{}, {pattern:1,red:255,green:255,blue:255}, {pattern:2}, {pattern:3}, {background:1}, {backlight:0}, {backlight:50}, {addressing:1}, {addressing:2}, {gap:3}, {gap:6}];
for(const settings of cases)for(const time of [0,.86,5,TFT_DURATION]){
 m.reset({settings,time});const s=m.getState(),plan=m.physicalPlan();poses++;
 for(const [row,column]of [[0,0],[72,120],[135,239],[135,160],[135,320],[271,479]]){
  const pixel=tftPixelAt(plan,s.physicalTime,row,column),at=((271-row)*480+column)*4;
  for(let c=0;c<3;c++)t.ok(p.display.bytes[at+c]===Math.round(pixel.rgb[c]*255),'Drawn pixel equals that actual row and column response');
  t.ok(p.display.bytes[at+3]===255,'Display pixel is opaque');textureSamples++;
 }
 const c=s.center;
 for(let i=0;i<3;i++){near(p.channelMeshes[i].material.color.toArray()[i],c.illuminated[i]);near(p.mixed.material.color.toArray()[i],c.illuminated[i]);}
 for(let i=0;i<9;i++){
  const theta=s.directors[1].theta[i*10],phi=s.directors[1].phi[i*10],direction=new THREE.Vector3(0,1,0).applyQuaternion(p.directorRods[i].quaternion);
  near(direction.x,Math.sin(theta));near(direction.y,Math.cos(theta)*Math.cos(phi));near(direction.z,Math.cos(theta)*Math.sin(phi));
 }
 t.ok(p.incoming.visible===(s.values.backlight>0),'No incident light without backlight');
 t.ok(p.outgoing.visible===(c.illuminated[1]>1e-7),'Output light cue follows modeled transmission');
 near(p.switchArm.geometry.attributes.position.getY(1),s.scanRow===135?.57:.80);
 const step=tftVoltageSteps(plan),drawn=p.voltageTrace.geometry.attributes.position;
 t.ok(drawn.count===step.length,'Held-voltage plot preserves each side of each jump');
 step.forEach((point,i)=>{near(drawn.getX(i),-1.68+3.4*point.time/TFT_RECORD);near(drawn.getY(i),-.69+.078*point.voltage);});
 near(p.cursor.geometry.attributes.position.getX(0),-1.68+3.4*s.physicalTime/TFT_RECORD);
 t.ok(s.readings.every(r=>r.label&&r.value&&r.hint&&!/NaN|undefined|Infinity/.test(r.value)),'All readouts are finite and explained');
 const before=structuredClone(s);for(const action of m.actions){action.run();assert.deepEqual(m.getState(),before,'Every inspection preserves the entire record');t.add();}
 m.root.updateMatrixWorld(true);const b=new THREE.Box3().setFromObject(p.system);t.ok(!b.isEmpty()&&[...b.min,...b.max].every(Number.isFinite),'Finite scene bounds');
}
for(const preset of lesson.tryIt){m.reset(preset.initialState);m.update(preset.values);t.ok(m.parts.some(p=>p.id===preset.part),'Each preset opens a real inspection');m.advance(TFT_DURATION);t.ok(m.getState().complete,'Each trial completes');}
m.reset();m.playback.step();near(m.getState().physicalTime,TFT_FRAME,1e-12);for(let i=1;i<12;i++)m.playback.step();t.ok(m.getState().complete,'Twelve frame steps reach the exact playback endpoint');
m.reset(m.replayState());t.ok(!m.getState().complete&&m.getState().time===0,'Replay restores the chosen black-prepared trial');
t.ok(studyLessons['LCD screen']===lesson,'Parent route uses reviewed lesson');
const routed=createStudyModel('LCD screen');t.ok(routed.topology.picture.isMesh&&routed.controls.some(c=>c.key==='addressing'),'Parent route uses active-matrix model');routed.dispose();
const resources=checkDisposal(m,t);console.log(`PASS TFT screen model: ${t.count} checks, ${poses} poses, ${textureSamples} pixel samples, ${lesson.tryIt.length} presets, ${resources} resources`);

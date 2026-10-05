import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createSmartphoneLearningModel} from './smartphone-model.js';
import {smartphoneLearningLesson as lesson} from './smartphone-lesson.js';
import {studyLessons} from './study-lessons.js';
import {houseComponents} from './house-components.js';
import {createSmartphoneModel} from './phone-model.js';
import {createAccelerometerModel} from './accelerometer-model.js';
import {tally,checkDisposal,checkFinite} from './model-check-kit.mjs';
const t=tally(),m=createSmartphoneLearningModel(),p=m.topology,d=p.details;
const near=(a,b,message)=>t.near(a,b,2e-7,message);
const bounds=mesh=>new THREE.Box3().setFromObject(mesh);
const overlap=(a,b)=>['x','y','z'].every(k=>a.max[k]>b.min[k]+2e-7&&b.max[k]>a.min[k]+2e-7);
const separate=(a,b,message)=>t.ok(!overlap(bounds(a),bounds(b)),message);
m.root.updateMatrixWorld(true);
t.ok(m.initialPart==='phone'&&!m.initialCutaway,'Open with a complete connected phone');
t.ok(m.resultPart.preserveOnReset,'Reset preserves phone inspection');
t.ok(studyLessons.Smartphone===lesson,'Reviewed main lesson binding');
t.ok(houseComponents['Vibration motor'].createModel===createSmartphoneModel,'Unreviewed vibration motor retains its draft factory');
t.ok(houseComponents.Accelerometer.createModel===createAccelerometerModel,'Reviewed accelerometer uses its dedicated model');
t.ok(m.controls.length===11&&m.controls.find(c=>c.key==='scenario').primary,'Experiment selector immediately available');
for(const group of [d.touch,d.sensor,d.motor,d.voice])t.ok(group.position.length()===0&&group.userData.inspectionOnly&&group.userData.explosionExcluded,'Details stay centered and outside physical inventory');
for(const part of lesson.parts)t.ok(m.parts.some(p=>p.name===part.name),`Named hardware exists: ${part.name}`);
for(const panel of p.rear)separate(panel,p.cameraBody,'Case has a clear camera opening');
for(const plate of p.boardPieces){separate(plate,p.motorMount,'Board notch clears motor mount');separate(plate,p.batteryCell,'Battery and board do not occupy the same volume');}
for(const ribbon of p.displayRibbon)separate(ribbon,p.motorMount,'Display cable avoids motor mount');
for(const bezel of p.bezel.children)for(const layer of [p.screen,p.touchLayer,p.coverGlass])separate(bezel,layer,'Bezel supports display edges without piercing the front layers');
for(const bezel of p.bezel.children)for(const ribbon of p.displayRibbon)separate(bezel,ribbon,'Display flex reaches screen behind the bezel');
near(bounds(p.rear[0]).max.z,bounds(p.batteryCell).min.z,'Battery rests on rear shell');
near(bounds(p.rear[0]).max.z,bounds(p.motorMount).min.z,'Motor mount rests on rear shell');
near(bounds(p.motorMount).max.z,bounds(p.motorHousing).min.z,'Motor housing rests on mount');
near(bounds(p.speakerBody).max.z,bounds(p.speakerCone).min.z,'Speaker diaphragm meets body');
near(bounds(p.microphoneBody).max.z,bounds(p.microphoneDiaphragm).min.z,'Microphone diaphragm meets package');
near(bounds(p.cameraLens).max.z,bounds(p.cameraBody).min.z,'Camera lens meets body');
near(bounds(p.boardPieces[0]).max.z,bounds(p.cameraConnector).min.z,'Camera ribbon connector reaches board');
for(const chip of [...Object.values(p.chipMeshes),p.audioChip,p.sensorChip])near(bounds(p.boardPieces[0]).max.z,bounds(chip).min.z,'Each chip mounted on board plane');
for(const ledge of p.ledges)near(bounds(ledge).max.z,bounds(p.screen).min.z,'Frame ledge supports display');
near(bounds(p.touchLayer).max.z,bounds(p.coverGlass).min.z,'Touch layer meets protective glass');
near(bounds(p.coverGlass).max.z,bounds(p.finger).min.z,'Contact marker rests on glass instead of entering it');
near(bounds(d.rotorPlate).max.z,bounds(d.weight).min.z,'Enlarged weight rests on rotor plate');
near(bounds(d.housing).max.z,bounds(d.shaft).min.z,'Enlarged shaft reaches motor housing');
for(const dt of [-.001,NaN,undefined,Infinity]){const before=m.getState();m.advance(dt);assert.deepEqual(m.getState(),before);t.add();}

let poses=0;
for(const roll of [0,30,45,90])for(const pitch of [0,45,90])for(const support of [0,1,2])for(const power of [0,1]){
  m.reset({settings:{scenario:1,roll,pitch,support,power},time:2.4,orientation:1});m.root.updateMatrixWorld(true);const s=m.getState();poses++;
  const world=new THREE.Vector3(s.now.force.x,s.now.force.y,s.now.force.z).applyQuaternion(p.phone.quaternion);
  near(world.x,0,'Phone-axis force rotates back to world vertical');near(world.z,0,'Tilt transforms normal-axis force correctly');near(world.y,[1,0,2][support],'World support reference magnitude');
  const textDirection=new THREE.Vector3(1,0,0).applyQuaternion(p.app.quaternion).applyQuaternion(p.phone.quaternion);
  if(roll===90&&pitch===0&&support===0)near(textDirection.x,1,'Landscape text remains upright in world view');
  for(const cell of d.cells){
    const force=s.now.force[cell.axis];near(cell.mass.position.y,-.020*force,'Proof mass moves opposite supporting specific force');
    for(const finger of cell.fingers)for(const fixed of cell.fixed)separate(finger,fixed,'Moving and fixed comb fingers retain clearance');
    if(force){const direction=new THREE.Vector3(0,1,0).applyQuaternion(cell.force.quaternion).applyQuaternion(cell.mechanism.quaternion);near(cell.axis==='x'?direction.x:direction.y,1,'Force arrows follow conceptual sensing axis');}
    for(const spring of cell.springs){const start=spring.rods[0],end=spring.rods.at(-1);const a=new THREE.Vector3(0,-start.geometry.parameters.height/2,0).applyMatrix4(start.matrixWorld),b=new THREE.Vector3(0,end.geometry.parameters.height/2,0).applyMatrix4(end.matrixWorld);const anchor=new THREE.Vector3(...spring.anchor).applyMatrix4(cell.mechanism.matrixWorld),seat=new THREE.Vector3(spring.seat[0],spring.seat[1]+cell.mass.position.y,spring.seat[2]).applyMatrix4(cell.mechanism.matrixWorld);near(a.distanceTo(anchor),0,'Spring anchored to fixed frame');near(b.distanceTo(seat),0,'Spring reaches moving mass');}
  }
  const stable=JSON.stringify(s);for(const action of m.actions){action.run();t.ok(JSON.stringify(m.getState())===stable,'Inspection preserves operation and history');}
  t.ok(p.screenUI.visible===Boolean(power),'Battery control changes screen visibility');
}
for(const balance of [0,1])for(const speed of [1,2])for(const time of [0,.2,.7,1,2,3,3.8,4]){
  m.reset({settings:{scenario:2,balance,speed},time});m.root.updateMatrixWorld(true);const s=m.getState();poses++;
  near(p.motorRotor.rotation.z,d.rotor.rotation.z,'Whole phone and detail share rotor angle');
  separate(p.motorWeight,p.motorHousing,'Rotating weight clears fixed motor housing at every sampled phase');
  near(p.motorWeight.position.x,balance?0:.065,'Physical weight follows balance control');
  near(d.weight.position.x,balance?0:.31,'Enlarged weight follows balance control');
  if(s.now.motor.relativeForce>1e-8){const direction=new THREE.Vector3(0,1,0).applyQuaternion(d.reaction.quaternion),expected=new THREE.Vector3(s.now.motor.reaction.x,s.now.motor.reaction.y,0).normalize();near(direction.distanceTo(expected),0,'Housing-force arrow follows full radial plus tangential reaction');}else t.ok(!d.reaction.visible,'No force arrow at rest or for centered weight');
  t.ok(m.getState().readings.every(r=>r.value&&!/NaN|undefined|Infinity/.test(r.value+r.hint)),'Named finite results');
}
for(const trial of lesson.tryIt){m.reset(trial.initialState);assert.deepEqual(m.getState().values,trial.values);t.ok(m.parts.some(p=>p.id===trial.part),'Preset inspects existing part');m.advance(20);t.ok(m.playback.complete(),'Every preset completes or names a blocked outcome');}
const run=title=>{m.reset(lesson.tryIt.find(x=>x.title===title).initialState);m.advance(20);return m.getState();};
assert.deepEqual(run('Register a touch').registered,{x:2,y:3});
assert.deepEqual(run('Touch between crossings').registered,{x:1.5,y:2.5});
assert.deepEqual(run('Reach the corner').registered,{x:0,y:6});
assert.equal(run('Lift the finger').registered,null);
t.ok(!run('Remove electrical power').now.displayOn,'Power-off preset gives dark screen');
assert.equal(run('Turn to landscape').orientation,1);
assert.equal(run('Lay a landscape phone face up').orientation,1);
assert.equal(run('Let the phone fall freely').orientation,1);
assert.equal(run('Accelerate upward').now.force.y,2);
assert.equal(run('Hold near the orientation boundary').orientation,1);
t.ok(run('Run an offset weight').now.motor.body.x===0,'Completed motor trial returns frame');
assert.equal(run('Double the rotor speed').now.motor.peakRadialRatio,4);
assert.equal(run('Center the rotating weight').now.motor.relativeForce,0);
t.ok(run('Follow a conversation').now.voiceDelivered,'Voice completes full route');
t.ok(!run('Lose the network path').now.voiceDelivered&&m.playback.blocked(),'Network failure cannot claim delivery');
t.add(12);
m.reset({settings:{scenario:1,roll:90}});m.advance(2.4);m.update({support:1});m.advance(2.4);assert.equal(m.getState().orientation,1);m.reset(m.replayState());m.advance(2.4);assert.equal(m.getState().orientation,1);t.add(2);
checkFinite(m.root,t);const resources=checkDisposal(m,t);
console.log(`PASS smartphone model: ${t.count} checks, ${poses} poses, ${lesson.tryIt.length} presets, ${resources} resources`);

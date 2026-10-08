import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createPartExplosion} from './part-explosion.js';
import {createMagneticAlarmModel,MAGNETIC_ALARM_SHAPE as S} from './magnetic-alarm-model.js';
import {MAGNETIC_ALARM_DEFAULTS as D,MAGNETIC_ALARM_DOMAINS as DOMAINS,MAGNETIC_ALARM_OPTIONS as OPTIONS} from './magnetic-alarm-physics.js';
import {magneticAlarmLesson as lesson} from './magnetic-alarm-lesson.js';
import {createSafetyModel} from './safety-models.js';
import {safetyLessons} from './safety-lessons.js';

let checks=0,combinations=0,poses=0;
const ok=(condition,message)=>{assert.ok(condition,message);checks++;};
const eq=(a,b)=>{assert.deepEqual(a,b);checks++;};
const near=(a,b,tolerance=1e-7)=>ok(Math.abs(a-b)<=tolerance,`${a} != ${b}`);
const model=createMagneticAlarmModel(),g=model.topology,world=object=>object.getWorldPosition(new THREE.Vector3());
const bounds=object=>new THREE.Box3().setFromObject(object);
eq(model.controls.map(control=>control.key),Object.keys(D));
for(const control of model.controls){eq([control.min,control.max,control.step],DOMAINS[control.key]);eq(control.options,OPTIONS[control.key]);}
eq(model.parts.length,16);eq(model.catalogParts.length,12);eq(model.covers.length,2);
ok(model.initialCutaway&&model.initialIsolated&&model.frameVisibleOnly);eq(model.initialPart,'system');
near(model.overviewZoom*model.framePadding,.7);ok(model.frameBoundsForPart('system').equals(bounds(g.system)),'Opening and reset share the complete assembly boundary.');
for(const part of model.parts)ok(part.name&&part.description&&(!part.parentId||model.parts.some(parent=>parent.id===part.parentId)));
for(const part of lesson.parts)ok(model.parts.some(candidate=>candidate.name===part.name),part.name);
near(g.sensePath.getPoint(0).distanceTo(new THREE.Vector3(...g.batteryPlus)),0);
near(g.sensePath.getPoint(1).distanceTo(new THREE.Vector3(...g.batteryPlus)),0);
near(g.soundPath.getPoint(0).distanceTo(new THREE.Vector3(...g.batteryPlus)),0);
near(g.soundPath.getPoint(1).distanceTo(new THREE.Vector3(...g.batteryPlus)),0);
eq(g.wireRoutes.up.at(-1),g.upper);eq(g.wireRoutes.returnUpper[0],g.lower);
eq(g.wireRoutes.returnLower.at(-1),g.batteryMinus);eq(g.wireRoutes.outputReturn.at(-1),g.batteryMinus);
near(bounds(g.supplyTerminals[0]).max.y,g.batteryPlus[1]);near(bounds(g.supplyTerminals[1]).min.y,g.batteryMinus[1]);
near(bounds(g.supplyContact).min.y,g.batteryPlus[1]);near(bounds(g.supplyContact).max.y,g.wireRoutes.feed[0][1]);
const originalGeometry=new Map();model.root.traverse(object=>{if(object.geometry)originalGeometry.set(object,object.geometry.uuid);});
const symbolicGeometry=new Set();for(const guide of [g.forceGroup,...g.senseDots,...g.soundDots,...g.soundWaves])guide.traverse(object=>{if(object.geometry)symbolicGeometry.add(object.geometry);});
for(const clock of [0,5]) {
  model.reset({clock});const exploded=createPartExplosion(model,new THREE.PerspectiveCamera(),1),copied=new Set();
  exploded.root.traverse(object=>{if(object.geometry)copied.add(object.geometry);});
  ok([...symbolicGeometry].every(geometry=>!copied.has(geometry)),'Separated inventory excludes current, force and sound symbols.');
  ok(g.pads.every(pad=>copied.has(pad.geometry)),'Separated inventory preserves physical contacts.');
  exploded.dispose();
}
model.reset();
function pose(full=false) {
  poses++;const state=model.getState();model.root.updateMatrixWorld(true);
  near(g.sash.position.y,state.opening*S.scale);near(g.bar.position.x,S.barX+state.barTravel*S.scale);
  near(world(g.magnet).distanceTo(world(g.tip))/S.scale,state.separation);
  const active=g.springVariants.filter(variant=>variant.group.visible);
  eq(active.length,1);eq(active[0].preload,state.values.spring);eq(active[0].travel,state.barTravel);
  eq(g.springVariants.filter(variant=>variant.anchor.visible).length,1);
  near((g.bar.position.x-active[0].anchorX)/S.scale,5+state.values.spring/.1+state.barTravel);
  eq(g.cableBridge.visible,Boolean(state.values.cable));eq(g.cutEnds.every(end=>end.visible),!state.values.cable);
  near(g.supplyContact.rotation.z,state.values.power?0:.8);near(g.outputContact.rotation.z,state.alarm?0:-.9);
  eq(g.senseDots.every(dot=>dot.visible),state.senseCurrent>0);eq(g.soundDots.every(dot=>dot.visible),state.sounderCurrent>0);
  eq(g.soundWaves.every(wave=>wave.visible),state.alarm);
  near(g.pull.userData.length/g.restore.userData.length,state.magneticPull/state.springPull,1e-6);
  eq(g.contactLabel.userData.labelText,state.closed?'CONTACTS CLOSED':'CONTACTS OPEN');
  eq(g.latchLabel.userData.labelText,state.latched?'SET':'CLEAR');eq(g.voltageLabel.userData.labelText,`${state.senseVoltage} V`);
  eq(g.sounderLabel.userData.labelText,state.alarm?'ALARM ON':state.voltage?'QUIET':'NO POWER');
  ok(state.readings.every(row=>!/NaN|Infinity|undefined|null/.test(row.value+' '+(row.hint||''))));
  if(full) {
    for(const pad of g.pads)near(bounds(pad).min.x-(S.barX+state.barTravel*S.scale+.015),state.closed?0:.06);
    for(const [i,dot] of g.senseDots.entries())near(dot.position.distanceTo(g.sensePath.getPointAt((state.senseCharge/.006+i/g.senseDots.length)%1)),0);
    const activeSeconds=state.sounderEnergy/1.2;
    for(const [i,dot] of g.soundDots.entries())near(dot.position.distanceTo(g.soundPath.getPointAt((activeSeconds/3+i/g.soundDots.length)%1)),0);
    model.root.traverse(object=>{
      ok([...object.position.toArray(),...object.scale.toArray(),...object.quaternion.toArray()].every(Number.isFinite));
      if(object.geometry)eq(object.geometry.uuid,originalGeometry.get(object));
    });
  }
}
for(const gap of [8,12,16])for(const magnet of [.8,1,1.2])for(const spring of [.8,1,1.2])for(let opening=0;opening<=16;opening+=.25)for(const cable of [0,1])for(const armed of [0,1])for(const power of [0,1])for(const sound of [0,1]) {
  model.reset({settings:{opening,gap,magnet,spring,cable,armed,power,sound}});pose();
  model.advance(5);pose();model.advance(5);pose();combinations++;
}
const trials=[];
for(const trial of lesson.tryIt) {
  eq(trial.values,trial.initialState.settings);ok(trial.reset&&trial.isolate&&trial.view==='front');
  model.reset(trial.initialState);near(model.getState().clock,trial.initialState.clock);pose(true);
  const before=model.getState();for(const action of model.actions.filter(action=>action.part)){action.run();eq(model.getState(),before);eq(action.replay,false);ok(model.parts.some(part=>part.id===action.part));}
  model.advance(10);pose(true);const end=model.getState();trials.push({title:trial.title,initial:before.alarm,final:end.alarm,closed:end.closed});
  const replay=model.replayState();model.reset(replay);near(model.getState().clock,0);model.advance(10);eq(model.getState(),end);
}
eq(trials.map(trial=>[trial.initial,trial.final]),[[false,true],[false,false],[false,true],[false,true],[true,true],[true,true],[false,false],[false,false],[true,true],[true,true]]);
model.reset({settings:{...D,opening:7,magnet:1.2}});model.advance(10);ok(!model.getState().alarm);
model.reset({settings:{...D,opening:7.25,spring:1}});model.advance(10);ok(!model.getState().alarm);
model.reset();model.playback.step();near(model.getState().clock,.25);model.animate(.25);near(model.getState().clock,.5);
const saved=model.getState();for(const invalid of [null,-1,NaN,Infinity,.1]){model.animate(invalid);eq(model.getState(),saved);}
for(const invalid of [null,[],{gap:9},{magnet:2},{opening:NaN},{unknown:1}]){const before=model.getState();model.update(invalid);eq(model.getState(),before);}
model.advance(10);const complete=model.getState(),exposed=model.getState();exposed.values.gap=999;exposed.thresholds.release=999;exposed.firstTrip.clock=-1;exposed.readings[0].value='bad';eq(model.getState(),complete);
model.actions.at(-1).run();ok(!model.getState().alarm);model.update({cable:0});ok(model.getState().alarm);model.actions.at(-1).run();ok(model.getState().resetBlocked);
eq(safetyLessons['Magnetic burglar alarm'],lesson);const routed=createSafetyModel('Magnetic burglar alarm');eq(routed.controls,model.controls);routed.advance(10);ok(routed.getState().alarm);routed.dispose();
const prose=JSON.stringify(lesson)+model.parts.map(part=>part.name+part.description).join('')+model.controls.map(control=>control.label+control.help).join('');
ok(!/[—–]| - |--/.test(prose));ok(!/\b(centre|colour|metre|litre|behaviour|modelling|grey|analyse|fibre)\b/i.test(prose));ok(lesson.sources.every(source=>source.url.startsWith('https://')));
const resources=new Set();model.root.traverse(object=>{
  if(object.geometry){resources.add(object.geometry);ok([...object.geometry.attributes.position.array].every(Number.isFinite));}
  for(const material of object.material?Array.isArray(object.material)?object.material:[object.material]:[]){resources.add(material);for(const value of Object.values(material))if(value?.isTexture)resources.add(value);}
});
const disposed=new Map([...resources].map(resource=>[resource,0]));for(const resource of resources)resource.addEventListener('dispose',()=>disposed.set(resource,disposed.get(resource)+1));
model.dispose();model.dispose();ok([...disposed.values()].every(count=>count===1));
console.log(JSON.stringify({status:'PASS',checks,combinations,poses,parts:model.parts.length,trials,disposed:resources.size},null,2));

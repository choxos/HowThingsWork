import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createJoystickModel, JOYSTICK_DEFAULTS as D, JOYSTICK_DOMAINS} from './joystick-model.js';
import {createGamesControllerModel, CONTROLLER} from './games-controller-model.js';
import {joystickLesson as lesson} from './games-controller-lessons.js';
import {createPartExplosion} from './part-explosion.js';
import {tally, checkFinite, checkDisposal} from './model-check-kit.mjs';

const t = tally(), model = createJoystickModel(), parent = createGamesControllerModel(), p = model.topology, q = model.joystickTopology;
const near = (actual, expected, label, tolerance = 1e-9) => t.near(actual, expected, tolerance, label);
const state = () => JSON.stringify(model.getState()), mm = q.mm, snapshot = () => [p.lever.quaternion.toArray(), p.gates.map(g=>g.visible), [...p.stepLine.geometry.attributes.position.array], [...p.zoneCircle.geometry.attributes.position.array], q.arrow.visible, q.arrow.line.scale.toArray()];
assert.deepEqual(model.controls.map(c=>c.key), ['release','gate','bits','deadzone']);
assert.equal(model.parts.length,24);assert.equal(new Set(model.parts.map(p=>p.id)).size,24);
assert(model.parts.every(p=>!p.parentId||model.parts.some(parent=>parent.id===p.parentId)));
assert(Object.keys(model.partViewDirections).every(id=>model.parts.some(part=>part.id===id)), 'camera targets belong to the focused joystick');
assert.equal(model.initialPart,'rig');assert.equal(model.initialIsolated,true);
assert(!p.system.visible);assert(!model.parts.some(part=>['button','feedback','console','screen'].includes(part.id)));

const expected = [
  s=>s.clock===-.02&&s.now.stick.held,
  s=>s.clock===0&&Math.abs(s.now.stick.angles[0]*180/Math.PI-23)<1e-10&&s.now.stick.angles[1]===0,
  s=>s.clock===0&&s.now.stick.angles.every(a=>a>0)&&s.values.gate===0,
  s=>s.clock===0&&s.values.gate===1&&s.now.stick.angles.every(a=>Math.abs(a*180/Math.PI-23)<1e-10),
  s=>s.clock===0&&s.readings.find(r=>r.label==='Spring model').value.startsWith('11.50'),
  s=>s.now.stick.s<0&&Math.abs(s.now.stick.speed)<1e-10,
  s=>!s.now.stick.moving&&s.now.stick.s<0,
  s=>!s.now.stick.moving&&s.values.release===2&&Math.abs(s.restTilt-5)<1e-10,
  s=>s.now.sample.codes[0]===463&&s.dividers[0].volts<1.65&&s.dividers[1].volts===1.65,
  s=>s.bits===8&&!s.now.stick.moving,
  s=>s.bits===12&&!s.now.stick.moving,
  s=>s.gameOutput.strength===1&&s.full.share>1.4,
  s=>s.values.release===2&&s.gameOutput.strength===0,
  s=>s.values.deadzone===20&&s.gameOutput.strength>0&&s.gameOutput.strength<.03,
  s=>s.values.deadzone===0&&s.gameOutput.strength>.21,
  s=>s.now.sample.codes[0]===463,
  s=>s.clock===.3&&model.playback.complete(),
];
assert.equal(expected.length,lesson.tryIt.length);
for(const [i,preset] of lesson.tryIt.entries()){
  assert.deepEqual(preset.values,preset.initialState.settings);
  model.reset({time:.31,settings:{release:2,gate:1,bits:0,deadzone:0}});
  model.reset(preset.initialState);model.update(preset.values);
  const s=model.getState();assert.deepEqual(s.values,preset.values);t.ok(expected[i](s),preset.title+' has its named initial state');
  near(s.clock,preset.initialState.time-.02,preset.title+' exact time');
  assert(model.parts.some(part=>part.id===preset.part));checkFinite(model.root,t);
}
for(const action of model.actions){model.reset({time:.14,settings:{release:2,bits:0,deadzone:0}});const before=state();action.run();assert.equal(state(),before,action.label+' preserves state');assert(model.parts.some(part=>part.id===action.part));}
let controlCases=0;
for(const [key,[min,max,step]] of Object.entries(JOYSTICK_DOMAINS))for(let value=min;value<=max+1e-9;value+=step){
  const settings={...D,[key]:value};model.reset({settings,time:.32});assert(model.playback.complete());
  model.reset(model.replayState());assert.deepEqual(model.getState().values,settings);near(model.getState().clock,-.02,'replay starts at ready');
  model.playback.step();near(model.getState().clock,-.015,'step advances 5 ms');
  const before=state();model.update({[key]:value});assert.equal(state(),before,'same control value preserves time');
  const other=value===min?min+step:min;model.update({[key]:other});near(model.getState().clock,-.02,'changed control restarts');
  for(const saved of Object.keys(D).filter(k=>k!==key))assert.equal(model.getState().values[saved],settings[saved],'editing one control preserves others');
  controlCases++;
}
for(const control of model.controls){
  const before=()=>{model.reset({settings:{...D,release:2},time:.14});return snapshot();};
  const first=before();const value=control.key==='release'?0:control.key==='bits'?0:control.key==='deadzone'?0:1;
  model.reset({settings:{...D,release:2,[control.key]:value},time:.14});assert.notDeepEqual(snapshot(),first,control.key+' changes the drawing');
}
model.reset({settings:{release:1,gate:1,bits:2,deadzone:0},time:.14});const held=state();model.update({rumble:1,debounce:8,display:80,polling:2});assert.equal(state(),held,'unoffered controls do not change the child');
model.reset({settings:{release:1},time:.03});model.advance(.6);const one=model.getState().clock;model.reset({settings:{release:1},time:.03});for(let i=0;i<6;i++)model.advance(.1);near(model.getState().clock,one,'frame partition preserves physical time');

let combinations=0;
for(const release of [0,1,2])for(const gate of [0,1])for(const bits of [0,1,2])for(let deadzone=0;deadzone<=40;deadzone+=2){
  const settings={release,gate,bits,deadzone};
  for(const time of [0,.025,.14,.32]){
    model.reset({settings,time});parent.reset({settings,time});const s=model.getState(),n=s.now,ps=parent.getState();
    assert.deepEqual(s.values,settings);near(s.clock,ps.clock,'child and parent clock');
    model.root.updateMatrixWorld(true);parent.root.updateMatrixWorld(true);
    for(const key of ['lever','yokeA','yokeB','springPlate','wiperA','wiperB'])for(let i=0;i<16;i++)near(p[key].matrixWorld.elements[i],parent.topology[key].matrixWorld.elements[i],'reused '+key+' geometry');
    for(let axis=0;axis<2;axis++){
      const angle=n.stick.angles[axis],fraction=.5+.4*angle/(23*Math.PI/180),divider=s.dividers[axis];
      near(divider.volts,3.3*fraction,'ideal continuous divider voltage');near(divider.lower,10000*fraction,'lower resistance');near(divider.lower+divider.upper,10000,'constant total resistance');near(divider.current,.00033,'constant track current');
      const sampled=.5+.4*n.sample.stick.angles[axis]/(23*Math.PI/180);assert.equal(n.sample.codes[axis],Math.floor(sampled*2**s.bits),'independent ADC code');
    }
    const report=n.frame?.reading.report||[0,0],length=Math.hypot(...report),threshold=deadzone/100*32767;
    const command=length>threshold?(Math.min(length,32767)-threshold)/(32767-threshold):0;
    near(s.gameOutput.strength,command,'independent circular dead zone');near(Math.hypot(...s.gameOutput.vector),command,'command vector magnitude');
    assert.equal(q.responseValue.userData.labelText,(command*100).toFixed(1)+'%','diagram prints the actual command');
    assert.equal(q.arrow.visible,command>1e-12);assert.equal(q.zero.visible,!q.arrow.visible);
    if(q.arrow.visible){const tip=q.arrow.cone.position.clone().applyMatrix4(q.arrow.matrix);near(Math.hypot(tip.x,tip.y),q.radius*command,'drawn command arrow length');}
    assert(s.readings.every(r=>!/(?:NaN|Infinity|undefined)/.test(r.value)));assert.equal(s.readings.length,9);
  }
  combinations++;
}
const bounds=object=>new THREE.Box3().setFromObject(object);
model.reset();model.root.updateMatrixWorld(true);
const boardBounds=bounds(q.board);near(boardBounds.max.y,CONTROLLER.pcb*mm,'board top supports module',1e-8);
near(bounds(q.chip).min.y,boardBounds.max.y,'ADC rests on board',1e-8);
for(const support of q.supports){const b=bounds(support);near(b.max.y,boardBounds.min.y,'standoff meets board underside',1e-8);near(b.min.y,0,'standoff base',1e-8);}
for(const terminal of q.terminals)near(bounds(terminal).min.y,boardBounds.max.y,'supply pad meets board',1e-8);
for(const pin of q.adcPins){near(bounds(pin.foot).min.y,boardBounds.max.y,'ADC terminal foot meets board',1e-8);assert(bounds(pin.contact).intersectsBox(bounds(pin.foot)));}
let wireIndex=0;
for(const connection of q.connections)for(let i=1;i<connection.points.length;i++){
  const wire=q.wires[wireIndex],sleeve=q.sleeves[wireIndex++],half=wire.geometry.parameters.height/2;
  const a=new THREE.Vector3(0,-half,0).applyMatrix4(wire.matrixWorld).divideScalar(mm),b=new THREE.Vector3(0,half,0).applyMatrix4(wire.matrixWorld).divideScalar(mm);
  near(a.distanceTo(new THREE.Vector3(...connection.points[i-1])),0,'drawn wire starts at recorded node',1e-8);
  near(b.distanceTo(new THREE.Vector3(...connection.points[i])),0,'drawn wire ends at recorded node',1e-8);
  near(sleeve.geometry.parameters.radiusTop/mm,.23,'actual insulation radius');
  assert(bounds(sleeve).min.y>=boardBounds.max.y-1e-8,'insulation clears board surface');
}
assert.equal(wireIndex,q.wires.length);assert.equal(wireIndex,q.sleeves.length);
for(const name of ['X input','Y input','ADC ground','ADC supply']){
  const endpoint=new THREE.Vector3(...q.connections.find(c=>c.name===name).points.at(-1)).multiplyScalar(mm);
  assert(q.adcPins.some(pin=>bounds(pin.contact).containsPoint(endpoint)),name+' physically meets a metal ADC terminal');
}

// Independent finite-segment distance: an interior stationary point or one of
// four endpoint-to-segment minima contains the constrained minimum.
function segmentDistance(a,b,c,d){
  const p=new THREE.Vector3(...a),u=new THREE.Vector3(...b).sub(p),q=new THREE.Vector3(...c),v=new THREE.Vector3(...d).sub(q),w=p.clone().sub(q);
  const A=u.dot(u),B=u.dot(v),C=v.dot(v),D=u.dot(w),E=v.dot(w),den=A*C-B*B,clip=x=>Math.max(0,Math.min(1,x));
  const candidates=[[0,clip(E/C)],[1,clip((E+B)/C)],[clip(-D/A),0],[clip((B-D)/A),1]];
  if(den>1e-12){const s=(B*E-C*D)/den,z=(A*E-B*D)/den;if(s>=0&&s<=1&&z>=0&&z<=1)candidates.push([s,z]);}
  return Math.min(...candidates.map(([s,z])=>w.clone().addScaledVector(u,s).addScaledVector(v,-z).length()));
}
let minimumWireGap=Infinity;
for(let i=0;i<q.connections.length;i++)for(let j=i+1;j<q.connections.length;j++){
  const a=q.connections[i],b=q.connections[j];if(a.net===b.net)continue;
  for(let k=1;k<a.points.length;k++)for(let l=1;l<b.points.length;l++){
    const gap=segmentDistance(a.points[k-1],a.points[k],b.points[l-1],b.points[l])-.46;minimumWireGap=Math.min(minimumWireGap,gap);t.ok(gap>0,a.name+' and '+b.name+' insulation does not overlap');
  }
}
const pinPositions={ 'X input':[-63,14.3,41.5], 'X ground':[-65.5,14.3,41.5], 'X supply':[-60.5,14.3,41.5], 'Y input':[-53.5,14.3,32], 'Y ground':[-53.5,14.3,34.5], 'Y supply':[-53.5,14.3,29.5] };
for(const [name,pin]of Object.entries(pinPositions))assert.deepEqual(q.connections.find(c=>c.name===name).points[0],pin,name+' reaches its own sensor terminal');
assert.equal(q.connections.length,8);
for(const id of ['timeline','map','adc','response'])assert.equal(model.parts.find(p=>p.id===id).object.userData.inspectionOnly,id);
for(const [width,height]of [[760,620],[360,620]]){
  const camera=new THREE.OrthographicCamera(-3,3,3,-3,.01,100);camera.position.set(.65,1.6,3);camera.lookAt(0,.4,0);camera.updateMatrixWorld();
  const before=state(),explosion=createPartExplosion(model,camera,width/height,{width,height});explosion.update(1);
  assert.deepEqual(new Set(explosion.categories.map(c=>c.id)),new Set(['joystick','pots','test-electronics']));
  assert(!explosion.items.some(item=>['response','timeline','map','adc','button','feedback'].includes(item.id)));
  const inverse=camera.quaternion.clone().invert(),rectangle=item=>{const box=new THREE.Box3();for(const x of [item.bounds.min.x,item.bounds.max.x])for(const y of [item.bounds.min.y,item.bounds.max.y])for(const z of [item.bounds.min.z,item.bounds.max.z])box.expandByPoint(new THREE.Vector3(x,y,z).add(item.group.position).applyQuaternion(inverse));return box;};
  for(let i=0;i<explosion.items.length;i++)for(let j=i+1;j<explosion.items.length;j++){const a=rectangle(explosion.items[i]),b=rectangle(explosion.items[j]);t.ok(a.max.x<=b.min.x||b.max.x<=a.min.x||a.max.y<=b.min.y||b.max.y<=a.min.y,'separated parts do not overlap');}
  explosion.dispose();assert.equal(state(),before,'separation preserves state');
}
checkFinite(model.root,t);const resources=checkDisposal(model,t);parent.dispose();
console.log(`PASS joystick: ${t.count} checks, ${combinations} settings, ${lesson.tryIt.length} exact presets, ${controlCases} control values, ${model.actions.length} preserving actions, ${model.parts.length} parts, minimum wire clearance ${minimumWireGap.toFixed(3)} mm, ${resources} resources released once.`);

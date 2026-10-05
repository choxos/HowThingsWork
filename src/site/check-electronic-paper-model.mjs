import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createElectronicPaperDisplayModel} from './electronic-paper-model.js';
import {electronicPaperDisplayLesson as lesson} from './electronic-paper-lesson.js';
import {DISPLAY_PATTERNS} from './electronic-paper-physics.js';
import {studyLessons} from './study-lessons.js';
import {houseComponents} from './house-components.js';
import {tally, checkDisposal} from './model-check-kit.mjs';
const t=tally(),m=createElectronicPaperDisplayModel(),p=m.topology,d=p.details;
const near=(a,b,message)=>t.ok(Math.abs(a-b)<1e-7,message);
const localBounds=mesh=>{mesh.geometry.computeBoundingBox();mesh.updateMatrix();return mesh.geometry.boundingBox.clone().applyMatrix4(mesh.matrix);};
const volume=mesh=>{const v=localBounds(mesh).getSize(new THREE.Vector3());return v.x*v.y*v.z;};
const disjoint=(a,b)=>{const x=localBounds(a),y=localBounds(b);return ['x','y','z'].some(k=>x.max[k]<=y.min[k]+1e-7||y.max[k]<=x.min[k]+1e-7);};
t.ok(m.initialPart==='reader'&&!m.initialCutaway,'Opening view is connected reader');
t.ok(m.resultPart.preserveOnReset,'Resetting the displayed reader preserves its inspection framing');
for(const id of ['addressing','capsule','wetting','lighting','filters'])t.ok(d[id].position.length()===0,'Hidden inspection diagrams share the reader origin without shifting whole-machine framing');
t.ok(m.controls.length===6&&m.controls.find(c=>c.key==='technology').primary,'Technology visible immediately');
for(const dt of [-.001,NaN,undefined,Infinity]){const before=m.getState();m.advance(dt);assert.deepEqual(m.getState(),before,'Invalid browser frame deltas cannot move or break display');}
t.ok(studyLessons['Electronic paper']===lesson,'New main lesson is routed');
for(const name of ['Electronic ink','Electrowetting display','E-reader']){const old=houseComponents[name].createModel();t.ok(old.controls.some(c=>c.key==='gap'),'Unreviewed component retains old factory');old.dispose();}
for(const [a,b] of [[p.rear,p.batteryCell],[p.substrate,p.page],[p.page,p.guide],[p.guide,p.protective]])near(localBounds(a).max.z,localBounds(b).min.z,'Physical stack layers touch');
for(const led of p.leds){near(localBounds(p.guide).max.x,localBounds(led).min.x,'LED feeds guide edge');near(localBounds(led).max.x,localBounds(p.ledStrip).min.x,'LED contacts supporting strip');}
for(const ledge of p.ledges)near(localBounds(ledge).max.z,localBounds(p.substrate).min.z,'Case ledge supports backplane');
near(localBounds(p.board).max.z,localBounds(p.chip).min.z,'Controller chip mounted on board');
near(localBounds(p.board).max.z,localBounds(p.pmic).min.z,'Power circuit mounted on board');

let poses=0;
for(const technology of [0,1])for(const pattern of [0,1,2,3])for(const reverse of [0,1])for(const time of [0,.2,.4,.8,2.4,5.6]){
  m.reset({settings:{technology,pattern,reverse},time});const s=m.getState();poses++;
  t.ok(s.readings.every(r=>r.value&&!/NaN|undefined|Infinity/.test(r.value+r.hint)),'Named finite readings');
  for(const [i,mesh] of p.pixelMeshes.entries()){const expected=new THREE.Color(0xf5f1dc).lerp(new THREE.Color(0x394233),s.now.pixels[i]);near(mesh.material.color.r,expected.r,'Physical pixel reflects current animation state');}
  for(const black of d.pigmentBlack)for(const white of d.pigmentWhite)t.ok(black.position.distanceTo(white.position)>=.18,'Opposite pigments do not collide on illustrated paths');
  for(const bead of [...d.pigmentBlack,...d.pigmentWhite])t.ok(Math.abs(bead.position.y)+.09<.785,'Particles remain between electrodes');
  for(const bead of [...d.pigmentBlack,...d.pigmentWhite])t.ok(bead.position.length()+bead.geometry.parameters.radius<.773,'Pigments remain inside curved capsule wall');
  for(const black of d.pigmentBlack)for(const white of d.pigmentWhite)t.ok(Math.hypot(black.position.x-white.position.x,black.position.y-white.position.y)>.15,'Both pigment colors stay visible in front projection');
  for(const [a,sign] of [[d.fieldArrow,s.now.field],[d.blackArrow,s.now.blackForce],[d.whiteArrow,s.now.whiteForce]]){
    if(technology===0&&sign){const v=new THREE.Vector3(0,1,0).applyQuaternion(a.quaternion);near(v.y,sign,'Arrow follows field or qE');t.ok(a.visible,'Active force arrow visible');}
    else t.ok(!a.visible,'Inactive pigment comparison has no false drive arrow');
  }
  near(volume(d.oil),.09,'Oil volume conserved independently of footprint');
  near(volume(d.waterAbove)+(d.waterLeft.visible?volume(d.waterLeft):0),.585,'Water volume conserved');
  t.ok(disjoint(d.oil,d.waterAbove)&&disjoint(d.oil,d.waterLeft),'Water and oil occupy complementary regions');
  near(localBounds(d.oil).min.y,-.62,'Oil rests on hydrophobic dielectric');
  near(localBounds(d.waterAbove).max.y,.28,'Fluid remains within fixed cell height');
  near(localBounds(d.waterAbove).max.y,localBounds(d.common).min.y,'Conductive water contacts common electrode');
  const stable=JSON.stringify(s);for(const action of m.actions){action.run();t.ok(JSON.stringify(m.getState())===stable,'Inspection cannot mutate clock or settings');}
}
for(const experiment of lesson.tryIt){m.reset(experiment.initialState);assert.deepEqual(m.getState().values,experiment.values);t.ok(m.parts.some(p=>p.id===experiment.part),'Preset inspects existing part');m.advance(20);t.ok(m.playback.complete(),'Every preset has reachable completion');}
m.reset({settings:{power:0},pixels:DISPLAY_PATTERNS[0].pixels});const held=m.getState().now.pixels;m.update({pattern:1});assert.deepEqual(m.getState().now.pixels,held);m.reset(m.replayState());assert.deepEqual(m.getState().now.pixels,held);
m.reset({settings:{ambient:0},pixels:held,time:20});t.ok(p.pixelMeshes.every(mesh=>mesh.material.color.equals(p.page.material.color)),'Dark room hides pattern without changing stored state');assert.deepEqual(m.getState().now.pixels,held);
m.update({frontlight:1});t.ok(p.leds.every(mesh=>mesh.material.emissive.getHex()!==0)&&d.guided.every(mesh=>mesh.visible),'Powered front-light path is visible');
m.update({power:0});t.ok(p.leds.every(mesh=>mesh.material.emissive.getHex()===0)&&d.guided.every(mesh=>!mesh.visible),'Power off extinguishes LEDs');
m.reset({settings:{technology:1,pattern:2,power:0},pixels:Array(35).fill(0)});t.ok(!m.playback.blocked(),'Passive capillary return playable without power');m.advance(.8);assert.deepEqual(m.getState().now.pixels,Array(35).fill(1));
m.reset({settings:{technology:1,pattern:3}});t.ok(m.getState().readings[0].value==='Oil-covered display; no holding drive'&&m.getState().now.voltages.every(v=>v===0),'Powered all-dark oil display does not falsely claim holding voltage');
m.reset({settings:{technology:1,pattern:3},pixels:Array(35).fill(0),time:.4});t.ok(d.oilStatus.userData.labelText==='0 V · oil spreading','Unpowered selected cell is still spreading before it reaches dark');
const resources=checkDisposal(m,t);
console.log(`PASS electronic paper model: ${t.count} checks, ${poses} poses, ${lesson.tryIt.length} presets, ${resources} resources`);

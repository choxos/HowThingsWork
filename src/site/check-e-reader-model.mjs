import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createEReaderModel} from './e-reader-model.js';
import {eReaderLesson} from './e-reader-lesson.js';
import {READER_BOOKS, READER_PAGE, readerRequested} from './e-reader-physics.js';

const model = createEReaderModel(), g = model.topology;
const near = (a, b, tolerance = 1e-7) => assert(Math.abs(a-b) <= tolerance, `${a} != ${b}`);
const bounds = mesh => new THREE.Box3().setFromBufferAttribute(mesh.geometry.attributes.position).translate(mesh.position);
const snapshot = () => JSON.stringify(model.getState());
const distance = (a, b) => Math.hypot(...[0,1,2].map(axis => {
  const first = a.userData.ends.map(point => point[axis]), second = b.userData.ends.map(point => point[axis]);
  return Math.max(0, Math.min(...first)-Math.max(...second), Math.min(...second)-Math.max(...first));
}));
for (const lead of g.ledFeed) for (const signal of g.dataLeads) assert(distance(lead, signal) > .016, 'LED supply clears display signal conductors');
for (const lead of g.ledFeed) for (const other of g.ledReturn) assert(distance(lead, other) > .016, 'LED supply and return stay separate');
assert.equal(model.controls.length, 5);assert.equal(model.controls.flatMap(control => control.options).length, 12);
assert.equal(model.parts.length, 15);assert.equal(model.catalogParts.length, 13);assert.equal(eReaderLesson.tryIt.length, 8);
assert.deepEqual(model.covers, [g.backplane,g.page,g.touch,g.frontlight]);
assert.deepEqual(model.thumbnailOmit, [g.capsule,g.lightpath]);
for (const id of ['capsule','lightpath']) {assert.equal(g[id].userData.inspectionOnly,id);assert.equal(g[id].userData.explosionExcluded,true);}
assert.equal(g.pageRow.parent,g.backplane);assert.equal(g.selectedMarker.parent,g.backplane);
near(bounds(g.rear).max.z, bounds(g.board).min.z);
for (const mesh of [g.batteryCell,g.powerChip,g.memoryChip,g.processorChip,g.bufferChip,g.driverChip]) near(bounds(g.board).max.z, bounds(mesh).min.z);
for (const support of g.supports) near(bounds(support).max.z, bounds(g.substrate).min.z);
for (const [under, above] of [[g.inkSheet,g.touchSheet],[g.touchSheet,g.guide]]) assert(bounds(above).min.z-bounds(under).max.z >= -1e-7, 'Display layers do not interpenetrate');
near(bounds(g.inkSheet).max.z, g.pageSurface.position.z-.0005);
near(bounds(g.guide).min.z, bounds(g.touchSheet).max.z);
assert(bounds(g.substrate).min.z > bounds(g.batteryCell).max.z);
assert.equal(g.electrodes.count, READER_PAGE.cells);
const matrix = new THREE.Matrix4(), position = new THREE.Vector3();
for (let index=0; index<6912; index++) {
  g.electrodes.getMatrixAt(index, matrix);position.setFromMatrixPosition(matrix);
  near(position.x, -1.08+(index%72+.5)*.03);near(position.y, 1.62-(Math.floor(index/72)+.5)*.03);near(position.z, .046);
}
const guide = bounds(g.opticalGuide), opticalPage = bounds(g.opticalPage);
for (const point of g.guidedPoints.slice(1)) {assert(point[0]>=guide.min.x-1e-7 && point[0]<=guide.max.x+1e-7);assert(point[1]>=guide.min.y-1e-7 && point[1]<=guide.max.y+1e-7);assert(point[2]>guide.max.z);}
for (let index=2; index<g.guidedPoints.length-1; index++) {
  const before = new THREE.Vector3(...g.guidedPoints[index]).sub(new THREE.Vector3(...g.guidedPoints[index-1])).normalize();
  const after = new THREE.Vector3(...g.guidedPoints[index+1]).sub(new THREE.Vector3(...g.guidedPoints[index])).normalize();
  near(before.x, after.x);near(before.y, -after.y);
}
near(g.hit[1], opticalPage.max.y);assert(g.hit[0]>opticalPage.min.x && g.hit[0]<opticalPage.max.x);
const incident = new THREE.Vector3(...g.hit).sub(new THREE.Vector3(...g.guidedPoints.at(-1))).normalize();
const reflected = new THREE.Vector3(...g.outgoing).sub(new THREE.Vector3(...g.hit)).normalize();
near(incident.x, reflected.x);near(incident.y, -reflected.y);
model.root.updateMatrixWorld(true);
for (const wire of [...g.supplyLeads,...g.dataLeads,...g.ledFeed,...g.ledReturn,...g.guideRays]) {
  const height = wire.geometry.parameters.height, world = wire.parent.matrixWorld;
  const actual = [-1,1].map(sign=>new THREE.Vector3(0,sign*height/2,0).applyMatrix4(wire.matrixWorld));
  for (let side=0;side<2;side++) near(actual[side].distanceTo(new THREE.Vector3(...wire.userData.ends[side]).applyMatrix4(world)),0);
}
const geometryIds = [g.pageSurface,g.inkSheet,...g.black,...g.white].map(mesh=>mesh.geometry.uuid);
let combinations=0, pixelSamples=0;
for (const book of [0,1,2]) for (const page of [0,1]) for (const power of [0,1]) for (const ambient of [0,1]) for (const frontlight of [0,1,2]) {
  const settings={book,page,power,ambient,frontlight};model.reset({settings,pixels:readerRequested({book:(book+1)%3,page:1-page})});
  for (const seconds of [0,.4,.28,.5,10]) {
    model.advance(seconds);const {now,values}=model.getState();assert.deepEqual(values,settings);
    for (let index=0;index<6912;index++) {
      const row=Math.floor(index/72),offset=((95-row)*72+index%72)*4,expected=Math.round(now.illumination*(245-223*now.pixels[index]));
      assert.equal(g.bitmap[offset],expected);assert.equal(g.bitmap[offset+1],expected);assert.equal(g.bitmap[offset+2],expected);assert.equal(g.bitmap[offset+3],255);pixelSamples++;
    }
    for (const mesh of g.black) near(mesh.position.z,-.5+now.pixels[now.selected]);
    for (const mesh of g.white) near(mesh.position.z,.5-now.pixels[now.selected]);
    for (const mesh of [...g.black,...g.white]) assert(mesh.position.length()+.075<.8, 'Pigments remain inside their capsule');
    for (const black of g.black) for (const white of g.white) assert(black.position.distanceTo(white.position)>.15, 'Opposing pigment paths do not collide');
    for (const arrow of [g.blackArrow,g.whiteArrow]) {near(arrow.userData.length,now.direction?.64:0);assert.equal(arrow.visible,Boolean(now.direction));}
    for (const marker of [g.pageRow,g.activeBackRow]) {assert.equal(marker.visible,now.activeRow>=0);if(marker.visible)near(marker.position.y,1.62-(now.activeRow+.5)*.03);}
    assert.equal(g.guided.visible,now.frontLight>0);
    for (const arrow of [g.extraction,g.reflection]) {near(arrow.userData.length,now.frontLight?arrow.userData.nominalLength:0);assert.equal(arrow.visible,Boolean(now.frontLight));}
    for (const led of g.leds) assert(led.material.color.equals(g.emitter.material.color));
    assert.equal(g.pageSurface.material.map,g.pageTexture);assert.equal(g.pageTexture.image.data,g.bitmap);
    assert.equal(g.pageTexture.flipY,false);assert.equal(g.pageTexture.magFilter,THREE.NearestFilter);
    const before=snapshot();for (const action of model.actions) {action.run();assert.equal(snapshot(),before);assert.equal(action.replay,false);}
  }
  assert(model.playback.complete());combinations++;
}
assert.deepEqual([g.pageSurface,g.inkSheet,...g.black,...g.white].map(mesh=>mesh.geometry.uuid),geometryIds);
const outcomes=[];
for (const trial of eReaderLesson.tryIt) {
  assert.deepEqual(trial.values,trial.initialState.settings);assert(trial.reset && trial.isolate && trial.view==='front');assert(model.parts.some(part=>part.id===trial.part));
  model.reset(trial.initialState);const initial=model.getState();model.advance(100);const final=model.getState();outcomes.push([final.now.readback.name,final.now.pending,final.now.visible]);
  model.reset(model.replayState());assert.deepEqual(model.getState().now.pixels,initial.now.pixels);model.advance(100);assert.deepEqual(model.getState().now,final.now);
}
assert.deepEqual(outcomes,[['Light · page 1',false,true],['Light · page 2',false,true],['Rain · page 1',false,true],['Seeds · page 2',false,true],['Seeds · page 1',true,true],['Rain · page 2',false,false],['Light · page 2',false,true],['Seeds · page 1',false,true]]);
for (let book=0;book<3;book++) for (let page=0;page<2;page++) {model.reset({settings:{book,page}});model.advance(100);assert.deepEqual(model.getState().now.pixels,READER_BOOKS[book].pages[page].pixels);}
model.reset();model.playback.step();near(model.getState().clock,.15);
const before=snapshot();for(const bad of [{book:3},{page:.5},{power:2},{ambient:NaN},{frontlight:Infinity},{missing:1},null,[]]) {assert.throws(()=>model.update(bad));assert.equal(snapshot(),before);}
model.reset();model.animate(.4);near(model.getState().clock,.4);model.animate(.7);near(model.getState().clock,.7);
const resources=new Set();model.root.traverse(object=>{
  if(object.geometry){resources.add(object.geometry);assert([...object.geometry.attributes.position.array].every(Number.isFinite));}
  for(const material of object.material?Array.isArray(object.material)?object.material:[object.material]:[]){resources.add(material);for(const value of Object.values(material))if(value?.isTexture)resources.add(value);}
});
const disposed=new Map([...resources].map(resource=>[resource,0]));for(const resource of resources)resource.addEventListener('dispose',()=>disposed.set(resource,disposed.get(resource)+1));
model.dispose();model.dispose();assert([...disposed.values()].every(count=>count===1));
console.log(`PASS: ${combinations} control combinations, ${pixelSamples} material-to-texture samples, 8 trials, 15 parts, 6912 electrodes, layer contacts, conductor clearance, pigment bounds, light paths, replay and ${resources.size} singly disposed resources.`);

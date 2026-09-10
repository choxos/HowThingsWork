import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createHornModel} from './horn-model.js';

function trial(settings={},step=.05){const model=createHornModel();model.update(settings);let closed=false,open=false;for(let i=0;i<2500&&!model.getState().complete;i++){model.advance(step);const s=model.getState();closed||=s.contactClosed;open||=!s.contactClosed;assert.ok(s.airGap>0,'bar must not hit fixed pole');assert.ok(s.current>=0&&Number.isFinite(s.current));model.root.updateMatrixWorld(true);model.root.traverse(o=>{assert.ok(o.matrixWorld.elements.every(Number.isFinite));if(o.geometry?.attributes.position)assert.ok(o.geometry.attributes.position.array.every(Number.isFinite));});
 const parts=Object.fromEntries(model.parts.map(p=>[p.id,p.object]));const mesh=parts.diaphragm.children.find(o=>o.isMesh),positions=mesh.geometry.attributes.position;
 // The entire clamped outer edge stays put while the inner boundary follows the bar.
 for(let layer=0;layer<2;layer++)for(let sector=0;sector<=64;sector++){const outer=(layer*25+24)*65+sector,inner=layer*25*65+sector;assert.ok(Math.abs(positions.getY(outer)-(.6+(layer?.009:-.009)))<1e-6);assert.ok(Math.abs(positions.getY(inner)-(.6+s.x*100+(layer?.009:-.009)))<1e-6);}
 const leafMesh=parts['contact-leaf'].children.find(o=>o.geometry?.type==='BufferGeometry'),leafPoints=leafMesh.geometry.attributes.position;let measuredLength=0,previousPoint;
 for(let station=0;station<33;station++){const center=new THREE.Vector3();for(let corner=0;corner<4;corner++)center.add(new THREE.Vector3().fromBufferAttribute(leafPoints,station*4+corner));center.multiplyScalar(.25);if(previousPoint)measuredLength+=center.distanceTo(previousPoint);previousPoint=center;}
 assert.ok(Math.abs(measuredLength-.48)<1e-6,'actual leaf centerline remains constant');
 const body=parts['moving-bar'].children.find(o=>o.geometry?.type==='CylinderGeometry'),pole=parts['fixed-pole'].children.find(o=>o.geometry?.type==='CylinderGeometry'),bodyBox=new THREE.Box3().setFromObject(body),poleBox=new THREE.Box3().setFromObject(pole);
 assert.ok(Math.abs((poleBox.min.y-bodyBox.max.y)/100-s.airGap)<1e-8,'actual pole faces agree with reported air gap');
 const actuator=parts.collar.children.find(o=>o.geometry?.type==='RoundedBoxGeometry'),extension=parts['contact-leaf'].children.filter(o=>o.geometry?.type==='RoundedBoxGeometry')[1],actuatorBox=new THREE.Box3().setFromObject(actuator),extensionBox=new THREE.Box3().setFromObject(extension);
 assert.ok(actuatorBox.max.x>extensionBox.min.x&&actuatorBox.min.x<extensionBox.max.x&&actuatorBox.max.z>extensionBox.min.z&&actuatorBox.min.z<extensionBox.max.z,'actuator stays beneath the leaf extension');
 assert.ok(Math.abs(extensionBox.min.y-actuatorBox.max.y-Math.max(0,.035-s.x*100))<1e-7,'actual actuator reaches the leaf at the switching displacement');
 const buttonCoil=parts['button-spring'].children.find(o=>o.geometry?.type==='TubeGeometry'),path=buttonCoil.geometry.parameters.path,start=path.getPoint(0),end=path.getPoint(1);assert.ok(start.distanceTo(new THREE.Vector3(.028,0,-.025))<1e-9);assert.ok(Math.abs(end.z-(s.pressed?.0375:.1275))<1e-9,'spring stays seated against bridge');assert.ok(Math.abs(path.getLength()-s.buttonSpringLength)<1e-8,'spring wire length is conserved');
 const shaft=parts.plunger.children.find(o=>o.geometry?.type==='CylinderGeometry'),shaftBox=new THREE.Box3().setFromObject(shaft),guideZ=parts['button-guide'].getWorldPosition(new THREE.Vector3()).z+.125;assert.ok(shaftBox.min.z<guideZ&&shaftBox.max.z>guideZ,'shaft stays inside supported guide');
 const fixed=parts['fixed-contact'].children.find(o=>o.geometry?.type==='RoundedBoxGeometry');const moving=parts['contact-leaf'].children.find(o=>o.geometry?.type==='RoundedBoxGeometry');const a=new THREE.Box3().setFromObject(fixed),b=new THREE.Box3().setFromObject(moving);assert.ok(Math.abs((b.min.y-a.max.y)/100-s.contactGap)<1e-8,'contact readout must equal real face gap');
 }assert.ok(model.getState().complete,'trial must finish');return {model,state:model.getState(),closed,open};}
const normal=trial();assert.ok(normal.state.cycles>=8&&normal.state.breaks>=8);assert.ok(normal.open&&normal.closed);assert.ok(normal.state.frequency>230&&normal.state.frequency<280);assert.ok(normal.state.producedTone);assert.equal(normal.state.x,0);assert.equal(normal.state.current,0);
const weak=trial({voltage:6});assert.equal(weak.state.cycles,0);assert.equal(weak.state.breaks,0);assert.ok(!weak.state.producedTone);
const held=trial({contact:1});assert.equal(held.state.current,0);assert.equal(held.state.peak,0);assert.equal(held.state.breaks,0);assert.ok(!held.state.producedTone);
const bypass=trial({contact:2});assert.ok(!bypass.state.producedTone);assert.equal(bypass.state.cycles,0);
const slow=trial({},.017);for(const key of ['cycles','breaks','elapsed','frequency','peak','trough'])assert.ok(Math.abs(normal.state[key]-slow.state[key])<1e-10,`fixed step independent of display frames: ${key}`);
const max=trial({voltage:15,holdTime:.12});assert.ok(max.state.cycles>25);
normal.model.reset();assert.equal(normal.model.getState().stage,'ready');assert.equal(normal.model.getState().cycles,0);assert.equal(normal.model.getState().current,0);normal.model.update({voltage:Infinity,holdTime:NaN,contact:9});assert.equal(normal.model.getState().values.voltage,12);assert.equal(normal.model.getState().values.holdTime,.04);assert.equal(normal.model.getState().values.contact,2);
for(const entry of [normal,weak,held,bypass,slow,max])entry.model.dispose();
console.log('Horn dynamics, face gaps, clamped diaphragm, frame independence, failure modes, completion and reset passed.');

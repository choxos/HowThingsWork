import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createBluRayPlayerModel, DRIVE, PLAYER_MM} from './blu-ray-player-model.js';
import {bluRayPlayerLesson as lesson} from './blu-ray-player-lesson.js';
import {createStudyModel} from './study-models.js';
import {studyLessons} from './study-lessons.js';
import {houseComponents} from './house-components.js';
import {tally,checkFinite,checkControlsMove,checkDisposal} from './model-check-kit.mjs';

const t=tally(),model=createBluRayPlayerModel(),T=model.topology,D=T.details;
const points=line=>Array.from({length:line.geometry.drawRange.count},(_,i)=>new THREE.Vector3().fromBufferAttribute(line.geometry.attributes.position,i));
const near=(a,b,message,epsilon=1e-7)=>t.near(a,b,epsilon,message);
const bounds=o=>new THREE.Box3().setFromObject(o);
const volume=g=>{let total=0;const p=g.attributes.position,index=g.index,a=new THREE.Vector3(),b=new THREE.Vector3(),c=new THREE.Vector3();for(let i=0;i<(index?.count??p.count);i+=3){a.fromBufferAttribute(p,index?index.getX(i):i);b.fromBufferAttribute(p,index?index.getX(i+1):i+1);c.fromBufferAttribute(p,index?index.getX(i+2):i+2);total+=a.dot(b.cross(c))/6;}return total;};

// Mechanical interfaces are checked from transformed geometry, not labels.
model.root.updateMatrixWorld(true);
near(bounds(T.motor).min.y,bounds(T.floor).max.y,'motor rests on chassis');
near(bounds(T.motor).max.y,bounds(T.shaft).min.y,'motor reaches spindle shaft');
near(bounds(T.shaft).max.y,bounds(T.hub).min.y,'shaft reaches hub');
near(bounds(T.hub).max.y,bounds(T.discBack).min.y,'hub supports disc');
near(bounds(T.discBack).max.y,bounds(T.clamp).min.y,'clamp holds top of disc');
near(bounds(T.clamp).max.y,bounds(T.cap).min.y,'cap meets clamp');
for(const disc of [T.discBack,T.discFront]) {
  const expected=Math.PI*(60**2-7.5**2)*1.2/2*PLAYER_MM**3;
  near(volume(disc.geometry),expected,'positive solid half-disc volume',expected*.001);
}
near(volume(T.bearings[0].geometry),Math.PI*(3**2-2**2)*4*PLAYER_MM**3,'hollow bearing has outward faces',1e-7);
for(const bearing of T.railSupports)near(bounds(bearing).min.y,-.115,'rail sleeve touches support post');
for(const bearing of T.screwSupports)near(bounds(bearing).min.y,-.18,'screw sleeve touches support post');

// Reflection normals must agree with the displayed connected light route.
const foldNormal=new THREE.Vector3(1,0,0).applyQuaternion(T.fold.quaternion);
near(bounds(T.fold).min.y,bounds(T.foldSupport).max.y,'fold mirror rests on its support');
near(new THREE.Vector3(1,0,0).reflect(foldNormal).distanceTo(new THREE.Vector3(0,1,0)),0,'fold sends light up');
near(new THREE.Vector3(0,-1,0).reflect(foldNormal).distanceTo(new THREE.Vector3(-1,0,0)),0,'fold returns light toward splitter');
const splitNormal=new THREE.Vector3(1,0,0).applyQuaternion(T.splitterFace.quaternion);
near(new THREE.Vector3(-1,0,0).reflect(splitNormal).distanceTo(new THREE.Vector3(0,0,1)),0,'splitter sends return to detector');
const diagonal=points(D.separator),direction=diagonal[1].clone().sub(diagonal[0]).normalize(),normal=new THREE.Vector3(-direction.y,direction.x,0);
near(new THREE.Vector3(0,-1,0).reflect(normal).distanceTo(new THREE.Vector3(1,0,0)),0,'unfolded return path has matching reflection');
const path=points(T.outgoing);near(path[0].x,-.055,'beam starts at laser aperture');near(path.at(-1).y,.121,'Blu-ray beam reaches reflector behind cover');
near(points(T.returning).at(-1).z,.06,'return reaches detector face');

let poses=0,rayProbes=0;
for(const format of [0,1,2])for(const radius of [25,41,58])for(const speed of [1,2,4])for(const phase of [0,90,180,270,360]) {
  model.reset({settings:{format,radius,speed,phase},time:.5});model.root.updateMatrixWorld(true);poses++;
  const state=model.getState();near(T.pickup.position.x,radius/100,'pickup uses selected millimeter radius');
  near(points(T.outgoing).at(-1).y,(12+[1.2,.6,.1][format])/100,'selected format focuses behind the right cover thickness');
  near(T.screw.rotation.x/(2*Math.PI),(radius-25)/2,'two-millimeter screw pitch drives selected position');
  for(const b of T.bearings) {
    const c=b.getWorldPosition(new THREE.Vector3()),bb=bounds(b);
    near(c.y,DRIVE.railY*PLAYER_MM,'bearing centered on rail height');
    near(Math.abs(c.z),DRIVE.railZ*PLAYER_MM,'bearing centered on a rail');
    t.ok(bb.min.x>=.16-1e-7&&bb.max.x<=.74+1e-7,'whole moving bearing remains on supported rail');
    const open=new THREE.Raycaster(new THREE.Vector3(c.x-.1,c.y,c.z),new THREE.Vector3(1,0,0));
    t.ok(open.intersectObject(b,false).length===0,'rail bore is genuinely open');rayProbes++;
    const outer=new THREE.Raycaster(new THREE.Vector3(c.x,c.y+.1,c.z),new THREE.Vector3(0,-1,0));
    const hit=outer.intersectObject(b,false)[0];t.ok(Boolean(hit),'outward bearing face receives ray');near(hit.point.y-c.y,.03,'first hit is bearing outer wall',1e-6);rayProbes++;
  }
  near(bounds(T.nut).min.x,(radius-3)/100,'nut moves with sled');
  near(bounds(T.nut).max.y,-.12,'nut meets sled stem');
  const flex=T.flex.geometry.attributes.position;
  near((flex.getX(0)+flex.getX(1))/2,(radius+6)/100,'flex cable starts on moving pickup');
  near(flex.getY(0),-.04,'flex starts at sled top');near(flex.getY(2),-.02,'flex passes above rail');
  near((flex.getX(6)+flex.getX(7))/2,.77,'flex ends on circuit board');near(flex.getY(6),-.20,'flex reaches board top');
  near(bounds(D.cover).max.y-bounds(D.cover).min.y,[1.2,.6,.1][format],'enlarged cover has correct thickness');
  near(D.reflector.position.y,[1.2,.6,.1][format],'focus layer matches cover');
  near(D.backing.position.y-D.backing.scale.y/2,D.reflector.position.y,'backing begins at reflector');
  const cone=points(D.cone),a=cone[1].clone().sub(cone[0]),b=cone[3].clone().sub(cone[2]);
  near(Math.abs(a.x)/a.length(),[.45,.6,.85][format],'air cone matches NA');
  near(1.55*Math.abs(b.x)/b.length(),[.45,.6,.85][format],'reference plastic obeys Snell geometry');
  near(cone[3].y,D.reflector.position.y,'reference rays reach data layer');
  const independentPower=(1+Math.cos(phase*Math.PI/180))/2;
  near(D.intensityBar.scale.x,Math.max(independentPower,1e-8),'bar is normalized squared-field intensity');
  t.ok(D.intensityBar.visible===(independentPower>1e-12),'zero intensity has no visible fill');
  for(const [i,line] of D.speedCurves.entries())for(const [j,point] of points(line).entries()) {
    const rad=25+j/2,max=Math.ceil(60*4.917*speed/(2*Math.PI*.025)/1000)*1000;
    near(point.x,-.9+(rad-25)/33*2.1,'rpm chart radius axis');
    near(point.y,-.62+(60*[1.2,3.49,4.917][i]*speed/(2*Math.PI*rad/1000))/max*1.32,'rpm chart ordinate');
  }
  const before=JSON.stringify(state);for(const action of model.actions){action.run();t.ok(JSON.stringify(model.getState())===before,`${action.part} preserves all lesson state`);}
  t.ok(!/NaN|undefined|Infinity/.test(JSON.stringify(state.readings)),'all readings finite and defined');
}

const snapshot=()=>[T.pickup.position.x,T.screw.rotation.x,T.clampMark.position.toArray(),T.outgoing.material.color.getHex(),D.cover.scale.y,D.intensityBar.scale.x,points(D.spotBar).map(v=>v.toArray())];
checkControlsMove(model,snapshot,m=>m.advance(.5),t);
model.reset();model.playback.step();near(model.getState().clock,1/12,'half-cell step');
model.advance(100);t.ok(model.playback.complete(),'readout reaches a bounded completion');
assert.deepEqual([model.getState().now.count,model.getState().now.ones,model.getState().now.zeros],[42,10,32]);t.add();
model.update({radius:58,speed:4,phase:90});const replay=model.replayState();model.reset(replay);
assert.deepEqual(model.getState().values,{format:2,radius:58,speed:4,phase:90});near(model.getState().clock,0,'replay preserves choices and starts at zero');
for(const test of lesson.tryIt){model.reset(test.initialState);assert.deepEqual(model.getState().values,test.values);near(model.getState().clock,test.initialState.time,test.title+' applied time');t.ok(model.parts.some(p=>p.id===test.part),test.title+' opens a real view');checkFinite(model.root,t);}
t.ok(lesson.parts.every(item=>model.parts.some(p=>p.name===item.name)),'every teaching part names an actual selectable object');
t.ok(lesson.sources.every(source=>source.url.startsWith('https://')),'source links present');
t.ok(model.controls.find(c=>c.key==='format').primary,'format selection visible immediately');
t.ok(model.initialCutaway,'internal mechanism opens by default');
t.ok(['optics','track','layers','phase','spin'].every(id=>D[id].userData.inspectionOnly===id&&D[id].userData.explosionExcluded),'separate diagrams stay out of whole-player view and inventory');
t.ok([T.chassis,T.spindle,T.disc,T.traverse,T.pickup,T.electronics].every(o=>o.userData.explosionCategory&&o.userData.explosionRigid),'six assemblies remain connected while separated');
const routed=createStudyModel('Blu-ray player');t.ok(routed.parts.some(p=>p.id==='traverse')&&studyLessons['Blu-ray player']===lesson,'whole-player route selects rebuilt model and lesson');routed.dispose();
const cd=houseComponents.CD.createModel();t.ok(cd.parts.some(p=>p.id==='codec')&&cd.parts.some(p=>p.id==='waveform'),'reviewed CD keeps its dedicated decoding and recovered-audio views');cd.dispose();
const dvd=houseComponents.DVD.createModel();t.ok(dvd.parts.some(p=>p.id==='codec')&&dvd.parts.some(p=>p.id==='video'),'DVD keeps its dedicated sector decoding and recovered-video views');dvd.dispose();
for(const name of ['CD-ROM','Optical-disc readout']){const draft=houseComponents[name].createModel();t.ok(draft.parts.some(p=>p.id==='pit'),'separate optical drafts preserve their own model');draft.dispose();}
checkFinite(model.root,t);
const released=checkDisposal(model,t);
console.log(`PASS Blu-ray player model: ${t.count} checks, ${poses} setting poses, ${rayProbes} physical bearing probes, ${lesson.tryIt.length} preset states, ${released} resources released exactly once.`);

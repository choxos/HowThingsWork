import assert from 'node:assert/strict';
import {createLensesModel,sampleLenses,lensTrainMatrix,LENSES_DEFAULTS as D} from './lenses-model.js';
import {lensesLesson} from './lenses-lesson.js';
const near=(a,b,t=1e-8)=>assert.ok(Number.isFinite(a)&&Number.isFinite(b)&&Math.abs(a-b)<=t,`${a} != ${b}`);
const configurations=[];
for(const mode of [0,1])for(const focal of [1,1.5,2,2.5])for(let distance=.5;distance<=4;distance+=.25)for(const height of [.3,.6,.9,1.2])for(const aperture of [.2,.3,.4,.5,.6])for(const screenOffset of mode===0&&distance>=1?[-1,-.75,-.5,-.25,0,.25,.5,.75,1]:[0])configurations.push({...D,mode,focal,distance,height,aperture,screenOffset});
for(let zoom=0;zoom<=100;zoom+=10)for(const compensate of [0,1])for(const height of [.3,.6,.9,1.2])for(const aperture of [.2,.3,.4,.5,.6])configurations.push({...D,mode:2,zoom,compensate,height,aperture});
let rays=0,turns=0;
for(const values of configurations){
 const s=sampleLenses(values);near(s.matrix[0]*s.matrix[3]-s.matrix[1]*s.matrix[2],1);
 if(values.mode<2){const f=values.mode===1?-values.focal:values.focal,d=values.focal*values.distance,den=d-f;assert.equal(s.atInfinity,values.mode===0&&values.distance===1);if(!s.atInfinity){near(s.imageX,f*d/den);near(s.magnification,-f/den);assert.equal(s.virtual,s.imageX<0);}else{assert.equal(s.imageX,null);assert.equal(s.magnification,null);}}
 else{near(s.objectX,-6);near(s.screenX,5);near(s.lenses[2].x,3);if(values.compensate||values.zoom===0){near(s.imageX,5);near(s.pointBlur,0);assert.ok(s.inFocus);assert.ok(s.fieldOfView>0);near(s.sensorCoverage,Math.min(1,.44/(Math.abs(s.magnification)*values.height)));}else{assert.equal(s.inFocus,false);assert.ok(s.pointBlur>0);assert.equal(s.fieldOfView,null);assert.equal(s.sensorCoverage,null);}}
 for(const r of s.rays){
  let x=r.source[0],y=r.source[1],slope=(r.firstHeight-y)/(s.lenses[0].x-x);rays++;
  for(let i=0;i<r.turns.length;i++){const l=s.lenses[i],t=r.turns[i];y+=slope*(l.x-x);x=l.x;near(t.x,x);near(t.y,y);near(t.incoming,slope);assert.ok(Math.abs(y)<=l.aperture+1e-8);slope-=y/l.f;near(t.outgoing,slope);turns++;}
  if(r.transmitted){near(r.end[1],y+slope*(r.end[0]-x));if(r.virtual){near(r.virtual[1],y+slope*(r.virtual[0]-x));near(r.end[0],s.eye[0]);assert.ok(Math.abs(r.end[1]-s.eye[1])<=.04000001);}if(s.mode===2)assert.equal(r.received,Math.abs(r.end[1])<=.220000001);}
  else {const l=s.lenses[r.blockedAt];y+=slope*(l.x-x);assert.ok(Math.abs(y)>l.aperture);near(r.end[0],l.x);near(r.end[1],y);assert.equal(r.received,false);}
 }
 if(s.mode===0&&!s.virtual){const expected=2*values.aperture*Math.abs(1+s.screenX/(-s.objectX)-s.screenX/values.focal);near(s.pointBlur,expected);}
 // Independently propagate two arbitrary input rays to check the matrix mapping.
 for(const [y0,u0] of [[.13,.021],[-.24,-.033]]){let x=s.objectX,y=y0,u=u0;for(const lens of s.lenses){y+=(lens.x-x)*u;u-=y/lens.f;x=lens.x;}near(y,s.matrix[0]*y0+s.matrix[1]*u0);near(u,s.matrix[2]*y0+s.matrix[3]*u0);}
}
const wide=sampleLenses({mode:2}),tele=sampleLenses({mode:2,zoom:100});near(wide.lenses[1].x,2.073453021693376);near(tele.lenses[1].x,2.288218227904235);near(wide.magnification,-.26954418474447345);near(tele.magnification,-.5980202532269295);assert.ok(tele.fieldOfView<wide.fieldOfView);let previous=wide;for(let zoom=10;zoom<=100;zoom+=10){const s=sampleLenses({mode:2,zoom});assert.ok(s.lenses[0].x<previous.lenses[0].x&&s.lenses[1].x>previous.lenses[1].x);assert.ok(Math.abs(s.magnification)>Math.abs(previous.magnification));previous=s;}
const m=createLensesModel(),geometries=new Set(),materials=new Set();m.root.traverse(o=>{if(o.geometry)geometries.add(o.geometry);if(o.material)materials.add(o.material);});
assert.equal(lensesLesson.tryIt.length,22);
// Pin the two teaching anchors independently of the matrix implementation.
const sameSize=sampleLenses(),magnifier=sampleLenses({distance:.5});
near(sameSize.imageX,3);near(sameSize.magnification,-1);near(sameSize.imageHeight,.6);assert.equal(sameSize.real,true);
near(magnifier.imageX,-1.5);near(magnifier.magnification,2);near(magnifier.imageHeight,1.2);assert.equal(magnifier.virtual,true);
assert.ok(m.getState().readings.every(r=>r.hint),'Every reading explains its meaning');
for(const preset of lensesLesson.tryIt){assert.deepEqual(Object.keys(preset.values).sort(),Object.keys(D).sort());m.reset();m.update(preset.values);assert.deepEqual(m.getState().values,preset.values);m.actions[3].run();const s=m.getState();assert.equal(s.progress,1);
 assert.ok(s.readings.every(r=>r.hint&&r.value!=='Not applicable'));
 assert.equal(s.readings.length,s.mode===2?(s.inFocus?18:17):s.virtual?11:13);
 assert.equal(s.readings.some(r=>r.label==='Focal length'),s.mode<2);
 assert.equal(s.readings.some(r=>r.label==='Effective focal length'),s.mode===2&&s.inFocus);
 for(const c of m.controls)assert.equal(c.visibleWhen(s.values),c.enabledWhen(s.values));assert.equal(m.topology.parts.eye.visible,s.virtual);assert.equal(m.topology.parts.image.visible,!s.atInfinity);assert.equal(m.resultPart.available(),!s.atInfinity);
 if(!s.atInfinity){near(m.topology.imageCat.position.x,s.imageX);near(m.topology.imageCat.scale.y,s.magnification*s.values.height);}
 for(const [i,r] of s.rays.entries()){const p=m.topology.slots[i].segments[0].body.geometry.attributes.position;near(p.getX(0),r.source[0],1e-6);near(p.getY(0),r.source[1],1e-6);}
 m.root.traverse(o=>{if(o.geometry){assert.ok(geometries.has(o.geometry));for(const value of o.geometry.attributes.position.array)assert.ok(Number.isFinite(value));}});
}
m.update({...D,mode:2,zoom:10,compensate:0,aperture:.2});assert.ok(m.getState().pointBlur>0&&m.getState().pointBlur<.005);assert.equal(m.getState().readings.find(r=>r.label==='Point-bundle blur').value,'<0.01 cm');
m.reset();m.playback.step();near(m.getState().elapsed,.08);m.advance(20);assert.ok(m.playback.complete());m.update({distance:1});assert.ok(m.getState().atInfinity);assert.equal(m.topology.imageCat.visible,false);m.reset();assert.ok(!m.playback.complete());
for(const mode of [0,1,2]){m.update({...D,mode});for(const [i,lens] of m.getState().lenses.entries()){const mesh=m.topology.lensMeshes[i].mesh,g=mesh.geometry.attributes.position,layer=33*49,axis=Math.abs(g.getX(layer)-g.getX(0)),edge=Math.abs(g.getX(layer+32*49)-g.getX(32*49));assert.ok(lens.f>0?axis>edge:axis<edge);near(mesh.geometry.boundingBox.max.y-mesh.geometry.boundingBox.min.y,2*lens.aperture,1e-6);}}
const counts=new Map([...geometries,...materials].map(r=>[r,0]));for(const r of counts.keys())r.addEventListener('dispose',()=>counts.set(r,counts.get(r)+1));m.dispose();m.dispose();for(const n of counts.values())assert.equal(n,1);
for(const input of [{mode:3},{focal:0},{distance:NaN},{zoom:5},{aperture:1},{extra:2}])assert.throws(()=>sampleLenses(input));
console.log(JSON.stringify({passed:true,configurations:configurations.length,rays,refractions:turns,presets:22,ownedResources:counts.size,wide:{middle:wide.lenses[1].x,magnification:wide.magnification,field:wide.fieldOfView},tele:{middle:tele.lenses[1].x,magnification:tele.magnification,field:tele.fieldOfView}}));

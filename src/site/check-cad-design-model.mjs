import assert from 'node:assert/strict';
import {FrontSide} from 'three';
import {createCADDesignModel, CUP, CHART, chartY} from './cad-design-model.js';
import {DESIGN_DEFAULTS, DESIGN_DOMAINS, designPlan} from './printing-physics.js';
import {cadDesignLesson} from './printing-lessons.js';

let poses = 0, points = 0;
const near = (a,b) => assert.ok(Math.abs(a-b)<2e-6*Math.max(1,Math.abs(b)), `${a} != ${b}`);
const linePoints = line => {
  const count = line.geometry.drawRange.count, attribute = line.geometry.attributes.position;
  assert.ok(Number.isFinite(count) && count <= attribute.count);
  return Array.from({length:count},(_,i)=>[attribute.getX(i),attribute.getY(i),attribute.getZ(i)]);
};
const m = createCADDesignModel(), t = m.topology;
t.system.traverse(object => { if (object.userData.textLabel) assert.equal(object.material.side, FrontSide, 'captions must not read backward from the rear'); });
function pose() {
  const s = m.getState(); poses++;
  assert.ok(s.readings.every(r=>!(/NaN|Infinity|undefined/.test(r.value))));
  assert.equal(m.playback.complete(), s.clock >= s.duration);
  if (s.now.meshed) {
    const attribute = t.cup.geometry.attributes.position, index = t.cup.geometry.index;
    assert.equal(attribute.count,s.surface.vertices.length); assert.equal(index.count,3*s.triangles);
    s.surface.vertices.forEach((v,i)=>{v.forEach((n,j)=>near(attribute.array[3*i+j],n*CUP)); points++;});
    assert.deepEqual(Array.from(index.array),s.surface.faces.flat());
    assert.equal(t.meshEdges.geometry.drawRange.count,s.triangles*6,'no clipped mesh edges');
  }
  const error = linePoints(t.errorBar);
  near(Math.abs(error[0][1]-error[1][1]),s.outerError*s.facetScale*CUP);
  assert.equal(t.facetScale.userData.labelText,`Close-up: ${s.facetScale.toFixed(1)}× the cup scale`);
  const layers = linePoints(t.sliceLines), expected = s.slices.flatMap(slice=>{
    const y = -.8 + slice.middle*CUP, x=Math.max(...s.surface.vertices.map(p=>p[0]))*CUP, inner=x*s.inner/s.radius;
    return slice.floor?[[-x,y],[x,y]]:[[-x,y],[-inner,y],[inner,y],[x,y]];
  });
  assert.equal(layers.length,expected.length,'every layer is drawn');
  expected.forEach((point,i)=>point.forEach((n,j)=>near(layers[i][j],n)));
  const selected = s.slices[s.selectedLayer], loops = selected.paths.filter(p=>p.kind==='perimeter');
  t.pathLoops.forEach((line,i)=>{
    const drawn=linePoints(line), planned=loops[i]?.points||[];
    assert.equal(drawn.length,planned.length);
    planned.forEach((point,j)=>point.forEach((n,k)=>near(drawn[j][k],n*CUP)));
  });
  const fill=linePoints(t.infillLines), planned=selected.paths.filter(p=>p.kind==='infill').flatMap(p=>p.points);
  assert.equal(fill.length,planned.length,'every counted infill segment is drawn');
  planned.forEach((point,j)=>point.forEach((n,k)=>near(fill[j][k],n*CUP)));
  assert.ok(chartY(s.outerError)>=CHART.y&&chartY(s.outerError)<=CHART.y+CHART.h);
  assert.equal(t.fileTotal.userData.labelText,`${s.triangles} triangles → ${s.bytes.toLocaleString('en-US')} bytes`);
  if(selected.reduced)assert.match(t.pathNote.userData.labelText,/(centered loop fits|matching pairs fit)/);
  return s;
}
pose();
for (const time of [1,3,4.5,6,7.5,9,10.5,12,13.5,15]) {m.reset();m.advance(time);pose();}
for(const [key,[min,max,step]] of Object.entries(DESIGN_DOMAINS))for(let value=min;value<=max+1e-9;value+=step){
  m.reset();m.update({[key]:Number(value.toFixed(8))});m.advance(15);pose();
}
for(let bits=0;bits<256;bits++){
  m.reset();const values={};Object.entries(DESIGN_DOMAINS).forEach(([key,range],i)=>{values[key]=range[(bits>>i)&1];});m.update(values);m.advance(15);pose();
}
for(const trial of cadDesignLesson.tryIt){
  assert.deepEqual(Object.keys(trial.values),Object.keys(DESIGN_DEFAULTS));assert.equal(trial.reset,true);
  m.reset();m.update(trial.values);assert.equal(m.getState().clock,0);m.advance(15);pose();
  assert.ok(m.parts.some(p=>p.id===trial.part));
  assert.equal(trial.isolate,!['system','solid'].includes(trial.part));
}
m.reset();m.advance(15);m.update({height:24});assert.equal(m.getState().clock,0);assert.equal(m.playback.complete(),false);
m.advance(7);m.update({height:24});assert.equal(m.getState().clock,7,'same value preserves progress');
for(let i=0;i<80;i++)designPlan({radius:6+i%15,facets:8+8*Math.floor(i/15)});
m.advance(1);assert.equal(m.getState().clock,8,'evicting the plan cache does not reset playback');
for(const action of m.actions){m.reset();action.run();assert.equal(m.playback.complete(),true);pose();}
m.reset();m.update({height:24,layer:.05});m.advance(15);assert.equal(pose().layers,480);
const disposal=new Map();m.root.traverse(o=>{if(o.geometry)disposal.set(o.geometry,0);for(const mat of o.material?(Array.isArray(o.material)?o.material:[o.material]):[])disposal.set(mat,0);});
for(const resource of disposal.keys())resource.addEventListener('dispose',()=>disposal.set(resource,disposal.get(resource)+1));
m.dispose();m.dispose();assert.ok([...disposal.values()].every(count=>count===1));
console.log(JSON.stringify({ok:true,poses,meshVerticesRead:points,resourcesDisposed:disposal.size,presets:cadDesignLesson.tryIt.length}));

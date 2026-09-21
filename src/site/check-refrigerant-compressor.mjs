import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as THREE from 'three';
import {sampleCompressor, compressorStageAngle, COMPRESSOR_DEFAULTS as D, COMPRESSOR_DOMAINS, swept} from './refrigerant-compressor-physics.js';
import {createPartExplosion} from './part-explosion.js';
import {createRefrigerantCompressorModel} from './refrigerant-compressor-model.js';
import {refrigerantCompressorLesson as lesson} from './refrigerator-lessons.js';
import {checkDisposal, checkFinite, checkRefusals, tally} from './model-check-kit.mjs';
const t = tally(), m = createRefrigerantCompressorModel(), p = m.topology, MM = p.MM, observations = [];
let poses = 0;
for (let evaporating = -25; evaporating <= -10; evaporating += 5) for (let condensing = 25; condensing <= 50; condensing += 5) for (let clearance = 2; clearance <= 8; clearance += 2) {
  const values = {evaporating, condensing, clearance, angle: 0}, ref = sampleCompressor(values), c = ref.cycle;
  assert.ok(c.volumetric > 0 && c.volumetric < 1);
  let integral = 0, previous;
  // Independent fine quadrature and slider-crank equations, not the chart's sampling.
  for (let i = 0; i <= 10000; i++) {
    const angle = i * 360 / 10000, th = angle * Math.PI / 180;
    const v = Math.PI * .01 ** 2 * (.016 * clearance / 100 + .038 - .008 * Math.cos(th) - Math.sqrt(.03 ** 2 - (.008 * Math.sin(th)) ** 2));
    const Vc = clearance / 100 * Math.PI * .01 ** 2 * .016, Vb = Vc + Math.PI * .01 ** 2 * .016;
    const P = angle < 180 ? Math.max(c.Pe, c.Pc * (Vc / v) ** 1.1) : Math.min(c.Pc, c.Pe * (Vb / v) ** 1.1);
    if (previous) integral -= (P + previous.P) / 2 * (v - previous.v);
    previous = {v, P};
  }
  t.near(integral, ref.idealWork, ref.idealWork * 1e-5, 'loop integral gives ideal work');
  t.near(ref.mass * 2900 / 60, c.flow, 1e-15, 'intake mass gives running flow');
  t.near(ref.freshVolume + ref.lostVolume, swept(), 1e-15, 'fresh plus lost intake equals swept volume');
  const stages = new Set();
  for (let angle = 0; angle <= 360; angle++) {
    m.update({...values, angle});const s=m.getState();stages.add(s.stage);poses++;
    t.ok(!(s.suctionOpen && s.dischargeOpen), 'valves never open together');
    t.ok(s.pressure >= c.Pe * (1 - 1e-12) && s.pressure <= c.Pc * (1 + 1e-12), 'pressure bounded by imposed reservoirs');
    if (s.suctionOpen) t.near(s.pressure, c.Pe, 1e-8, 'intake at suction pressure');
    if (s.dischargeOpen) t.near(s.pressure, c.Pc, 1e-8, 'delivery at discharge pressure');
    const th=angle*Math.PI/180, wristY=p.CRANK_Y+.008e3*Math.cos(th)+Math.sqrt(30**2-(8*Math.sin(th))**2);
    t.near(p.pistonHead.position.y/MM,wristY,1e-10,'slider follows rod');
    t.near(p.wrist.position.y,p.pistonHead.position.y,1e-12,'wrist stays in piston');
    const top=p.pistonHead.position.y+6*MM,gap=p.head.position.y-top;
    t.ok(gap>0,'piston never penetrates head');
    t.near(Math.PI*(.01)**2*(gap/MM/1000),s.volume,1e-15,'drawn chamber volume matches physics');
    t.near(p.gas.scale.y,gap,1e-12,'gas fills chamber');
    const a=new THREE.Vector3(0,15*MM,0).applyQuaternion(p.link.quaternion).add(p.link.position),b=new THREE.Vector3(0,-15*MM,0).applyQuaternion(p.link.quaternion).add(p.link.position);
    t.near(a.distanceTo(new THREE.Vector3(0,wristY*MM,p.Z*MM)),0,1e-12,'rod meets wrist');
    t.near(b.distanceTo(new THREE.Vector3(8*Math.sin(th)*MM,(p.CRANK_Y+8*Math.cos(th))*MM,p.Z*MM)),0,1e-12,'rod meets crank pin');
    t.ok(p.suctionValve.position.y-.1*MM>top,'inlet reed never strikes piston');
    assert.equal(p.inletArrow.visible,s.suctionOpen);assert.equal(p.outletArrow.visible,s.dischargeOpen);
    t.near(p.suctionValve.position.y,p.head.position.y-(.1+(s.suctionOpen?Math.min(1.2,(gap/MM-.2)*.7):0))*MM,1e-12,'inlet opens inward');
    t.near(p.dischargeValve.position.y,p.head.position.y+(3.1+(s.dischargeOpen?1.2:0))*MM,1e-12,'outlet opens outward');
    const xy=p.point(s.volume,s.pressure);t.near(p.dot.position.x,xy[0],1e-12,'chart volume');t.near(p.dot.position.y,xy[1],1e-12,'chart pressure');
  }
  assert.deepEqual([...stages],[0,1,2,3]);assert.equal(m.getState().suctionOpen,false);assert.equal(m.getState().dischargeOpen,false);
  for(let stage=0;stage<4;stage++)assert.equal(sampleCompressor({...values,angle:compressorStageAngle(stage,values)}).stage,stage,'inspection enters named stage');
  observations.push({values,ratio:c.ratio,intake:c.volumetric,mass:ref.mass,idealWork:ref.idealWork});
}
for(const values of [{}, {clearance:8}, {condensing:50}, {evaporating:-25}, {clearance:8,condensing:50,evaporating:-25}]){
 const s=sampleCompressor(values);if(Object.keys(values).length)t.ok(s.freshVolume<sampleCompressor().freshVolume,'named comparison reduces intake');
}
for(const trial of lesson.tryIt){m.reset();m.update(trial.values);assert.deepEqual(m.getState().values,trial.values);assert.ok(m.parts.some(p=>p.id===trial.part));assert.equal(trial.cutaway,true);m.advance(8);assert.equal(m.getState().complete,true);checkFinite(m.root,t);}
m.reset();m.advance(2);t.near(m.getState().angle,90,1e-12,'eight-second turn');const paused=m.getState();m.advance(0);assert.deepEqual(m.getState(),paused);m.playback.step();t.near(m.getState().angle,105,1e-12,'step 15 degrees');m.update({clearance:8});t.near(m.getState().angle,0,1e-12,'changed control restarts');m.advance(100);assert.ok(m.getState().complete);const complete=m.getState();m.advance(100);assert.deepEqual(m.getState(),complete);m.reset();assert.equal(m.getState().angle,0);
for(const action of m.actions){m.advance(8);action.run();if(action.part==='pump')assert.equal(m.getState().stageName.toLowerCase(),action.label.slice(9));}
checkRefusals(sampleCompressor,COMPRESSOR_DOMAINS,t);
m.reset();
const explosion=createPartExplosion(m,new THREE.OrthographicCamera());
assert.deepEqual(explosion.categories.map(c=>c.id).sort(),['case','motor','pump']);
assert.ok(explosion.items.filter(u=>u.id==='case').length>4,'housing pieces separate');
assert.ok(explosion.items.filter(u=>u.id==='motor').length>3,'motor pieces separate');
assert.ok(!explosion.items.some(u=>u.id==='indicator'),'chart is not hardware');
explosion.dispose();
const resources=checkDisposal(m,t);
const report={passed:true,checks:t.count,operatingPoints:observations.length,poses,trials:lesson.tryIt.length,resources,observations};
if(process.env.HTW_REPORT)fs.writeFileSync(process.env.HTW_REPORT,JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({...report,observations:undefined}));

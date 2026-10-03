import assert from 'node:assert/strict';
import * as THREE from 'three';
import {generatorPlan, generatorAt, COIL, BRIDGE, GENERATOR_DEFAULTS} from './grid-physics.js';
import {createGeneratorModel, METER, BENCH, CHART, chartX, chartY} from './grid-generator-model.js';
import {electricGeneratorLesson, acGeneratorLesson, dcGeneratorLesson, generatorSlipRingsLesson} from './grid-generator-lessons.js';
import {tally, checkDisposal} from './model-check-kit.mjs';
import {createPartExplosion} from './part-explosion.js';
import {componentParentIds, groupCatalogEntries, catalogMachineComponents} from './catalog-hierarchy.js';

const t = tally();
let states = 0, poses = 0, contacts = 0;
const near = (a,b,label,tolerance=1e-8) => t.near(a,b,tolerance*Math.max(1,Math.abs(b)),label);
const direction = arrow => new THREE.Vector3(0,1,0).applyQuaternion(arrow.quaternion);
const anchors = [
  [{}, 125.66370614359175, 124.6584603195747, 88.14684262424544, 0, 776.9865864623489, 6.265619833232383],
  [{load:1}, 125.66370614359175, 116.28637302301576, 82.22688292416285, 0, 6761.260275423984, 545.2280286101902],
  [{output:1}, 125.66370614359175, 124.6584603195747, 88.14604722743958, 79.31169663982412, 776.9725641822008, 8.032538419835499],
  [{output:1,closed:0},125.66370614359175,125.66370614359175,88.85685695228165,79.95126616152767,0,1.7670316622702307],
];
for (const [values,peak,terminalPeak,rms,mean,load,heat] of anchors) {
  const p=generatorPlan(values);
  for(const [key,expected] of Object.entries({peak,terminalPeak,terminalRms:rms,terminalMean:mean,loadPower:load,windingPower:heat}))near(p[key],expected,'independent circuit anchor '+key);
}
for(const output of [0,1])for(const closed of [0,1])for(const speed of [0,60,1500,3000,3600])for(const field of [0,.5,1.2])for(const turns of [2,20,40])for(const load of [1,10,50]) {
  const p=generatorPlan({output,closed,speed,field,turns,load});
  near(p.winding,1.68e-8*turns*.6/2.5e-6,'copper resistance from sourced resistivity and declared wire');
  for(let i=0;i<=48;i++) {
    const s=generatorAt(p,(p.period??0)*i/48);
    near(s.loadVoltage,s.current*load,'resistor Ohm law');
    if(closed)near(s.terminal,s.loadVoltage,'brushes and closed load share terminal voltage');
    else near(s.loadVoltage,0,'disconnected load has no voltage');
    near(s.coilEmf,s.coilCurrent*p.winding+(s.bridged?0:(output?Math.sign(Math.sin(s.theta)):1)*s.terminal),'coil loop voltage balance');
    near(s.drivePower,s.loadPower+s.windingPower,'instantaneous power conservation');
    near(s.torque*p.omega,s.drivePower,'shaft torque supplies electrical work');
    t.ok(s.torque>=-1e-10&&s.loadPower>=0&&s.windingPower>=0,'passive circuit never drives shaft');
    if(!speed||!field)t.ok(s.current===0&&s.coilEmf===0,'zero induction boundary');
    states++;
  }
}
// Midpoint quadrature independently averages a full turn, including the short bridges.
for(const values of [{},{output:1},{output:1,closed:0},{load:1},{turns:40,speed:3600,field:1.2}]) {
  const p=generatorPlan(values),n=90000;
  let voltage=0,square=0,load=0,heat=0,drive=0;
  for(let i=0;i<n;i++) {const s=generatorAt(p,p.period*(i+.5)/n);voltage+=s.terminal;square+=s.terminal**2;load+=s.loadPower;heat+=s.windingPower;drive+=s.drivePower;}
  near(voltage/n,p.terminalMean,'mean output integrated',1e-6);
  near(Math.sqrt(square/n),p.terminalRms,'RMS output integrated',1e-6);
  near(load/n,p.loadPower,'load energy per turn integrated',1e-6);
  near(heat/n,p.windingPower,'winding heat including open-load commutation',1e-6);
  near(drive/n,p.drivePower,'integrated shaft input',1e-6);
}
const model=createGeneratorModel(),g=model.topology;
t.ok(model.controls.find(control=>control.key==='output').primary,'contact arrangement is a primary scene control');
model.root.updateMatrixWorld(true);
for(let i=0;i<2;i++) {
  const point=g.ringKeys[i].getWorldPosition(new THREE.Vector3());
  const ray=new THREE.Raycaster(point.clone().add(new THREE.Vector3(0,0,20)),new THREE.Vector3(0,0,-1));
  t.ok(ray.intersectObjects([g.ringKeys[i],g.ringMeshes[i]],false)[0]?.object===g.ringKeys[i],'rotation marker visible on the front-facing ring surface');
}
const materialBefore=model.root.rotation.clone();model.root.rotation.set(0,0,0);
model.root.updateMatrixWorld(true);
const fixedRingBrushes=g.ringBrushes.map(brush=>brush.matrixWorld.clone());
function rayHit(mesh,point,outward) {
  const ray=new THREE.Raycaster(point.clone().addScaledVector(outward,.04),outward.clone().negate(),0,.08);
  return ray.intersectObject(mesh,false).length>0;
}
for(const output of [0,1])for(const turns of [2,20,40])for(const share of [0,.003,.007,.0625,.125,.25,179/360,.5,.503,.507,.75,1]) {
  model.reset();model.update({output,turns});model.advance(COIL.show*share);model.root.updateMatrixWorld(true);
  const s=model.getState(),now=s.now;poses++;
  t.ok(g.rings.visible===!output&&g.commutator.visible===!!output,'only installed contacts visible');
  near(g.spinner.rotation.x,now.theta,'drawn winding phase');near(g.driveSpinner.rotation.x,now.theta,'driver coupled to shaft');
  near(g.ringSpinner.rotation.x,now.theta,'slip rings turn with the winding');
  for(let i=0;i<2;i++)assert.deepEqual(g.ringBrushes[i].matrixWorld.toArray(),fixedRingBrushes[i].toArray(),'slip-ring brushes remain fixed');
  if(!output)for(const [i,x] of [BENCH.ringA,BENCH.ringB].entries()) {
    const point=g.ringSpinner.localToWorld(new THREE.Vector3(x+.3,.08,0));
    const ray=new THREE.Raycaster(point,new THREE.Vector3(-1,0,0),0,.6);
    t.ok(ray.intersectObject(g.ringMeshes[i],false).length===0,'copper annulus leaves insulation space around the metal shaft');
  }
  const path=g.windings.userData.path;
  t.ok(path.length===turns*4+1,'one continuous wound path');
  for(let k=0;k<turns;k++) {
    const a=new THREE.Vector3(...path[k*4+1]),b=new THREE.Vector3(...path[k*4+2]);
    near(a.distanceTo(b)/METER,.2,'active side length');
    near(Math.abs(path[k*4][2]-path[k*4+1][2])/METER,.1,'turn width');
  }
  const leads=output?g.barLeads:g.ringLeads;
  for(let i=0;i<2;i++)assert.deepEqual(leads[i].userData.path[0],i?path.at(-1):path[0],'lead starts at actual winding end');
  if(output)for(const side of [1,-1]) {
    const point=g.barSpinner.localToWorld(new THREE.Vector3(BENCH.barX+.3,side*.14,0));
    const ray=new THREE.Raycaster(point,new THREE.Vector3(-1,0,0),0,.6);
    t.ok(g.segments.every(mesh=>ray.intersectObject(mesh,false).length===0),'insulating slot has no copper end cap');
    t.ok(ray.intersectObject(g.segmentInsulators[side>0?0:1],false).length>0,'visible nonconducting separator fills the slot');
  }
  g.windings.geometry.computeBoundingBox();
  const localBox=g.windings.geometry.boundingBox.clone().applyMatrix4(g.spinner.matrix);
  t.ok(localBox.min.y>-.8&&localBox.max.y<.8,'copper clears both poles over rotation');
  for(let side=-1;side<=1;side+=2) {
    const x=output?BENCH.barX:(side>0?BENCH.ringB:BENCH.ringA),assembly=output?g.commutator:g.rings;
    for(const angle of [-4.9,0,4.9]) {
      const a=angle*Math.PI/180,radial=new THREE.Vector3(0,side*Math.cos(a),side*Math.sin(a));
      const point=new THREE.Vector3(x,0,0).addScaledVector(radial,.18);assembly.localToWorld(point);
      const meshes=output?g.segments:g.ringMeshes;
      const hit=meshes.map(m=>rayHit(m,point,radial));
      if(!output)t.ok(hit[side>0?1:0]&&!hit[side>0?0:1],'brush contact on its own complete ring');
      else t.ok(hit.filter(Boolean).length<=1,'segments remain electrically separated at each contact point');
      contacts++;
    }
    if(output) {
      const hits=new Set();for(let a=-4.9;a<=4.91;a+=.2) {
        const rad=a*Math.PI/180,outward=new THREE.Vector3(0,side*Math.cos(rad),side*Math.sin(rad));
        const point=new THREE.Vector3(x,0,0).addScaledVector(outward,.18);assembly.localToWorld(point);
        g.segments.forEach((m,index)=>{if(rayHit(m,point,outward))hits.add(index);});
      }
      t.ok(hits.size>0,'wide brush always touches copper');
      t.ok((hits.size===2)===now.bridged,'drawn brush bridging agrees with electrical mask');
    }
  }
  for(const arrow of g.currentArrows)if(arrow.visible)near(direction(arrow).x,Math.sign(now.current),'both load arrows follow same series current');
  for(let i=0;i<2;i++)if(g.forceArrows[i].visible) {
    const force=direction(g.forceArrows[i]),current=direction(g.coilCurrentArrows[i]),lorentz=current.clone().cross(new THREE.Vector3(0,-1,0));
    near(force.dot(lorentz),1,'reaction force follows I cross B');
    t.ok(g.forceArrows[i].position.clone().cross(force).x<=1e-10,'drawn reaction opposes positive rotation');
  }
  const curve=g.ringTrace.geometry.attributes.position;
  for(let i=0;i<curve.count;i+=20){near(curve.getX(i),chartX(s.chart[i].theta),'chart angle',1e-6);near(curve.getY(i),chartY(s.chart[i].rings),'loaded voltage chart',1e-6);t.ok(Math.abs(s.chart[i].rings)<=CHART.volts,'trace fits voltage scale');}
}
model.root.rotation.copy(materialBefore);
assert.equal(componentParentIds['generator-slip-rings'],'electric-generator');
const generatorEntry={id:'electric-generator'},ringEntry={id:'generator-slip-rings'};
const families=groupCatalogEntries([generatorEntry,ringEntry]);
assert.equal(families.length,1);assert.equal(families[0].entry,generatorEntry);
assert.deepEqual(families[0].components,[ringEntry]);assert.deepEqual(catalogMachineComponents(families[0].components),[]);
const ringExpected = [
  ['Follow one ring',124.66,88.15,12.466,50,777.0,6.266,400],
  ['Open the switch',125.66,88.86,0,50,0,0,400],
  ['More turns behind them',247.34,174.89,24.734,50,3058.8,49.333,400],
  ['Turn slower',62.33,44.07,6.233,25,194.2,1.566,200],
  ['A heavier load',116.29,82.23,116.286,50,6761.3,545.228,400],
  ['A lighter load',125.46,88.71,2.509,50,157.4,.254,400],
];
for(const [i,trial] of generatorSlipRingsLesson.tryIt.entries()) {
  const [title,peak,rms,current,hz,power,heat,slowed]=ringExpected[i];assert.equal(trial.title,title);
  assert.deepEqual(Object.keys(trial.values).sort(),Object.keys(GENERATOR_DEFAULTS).sort());
  model.reset();model.update(trial.values);const plan=model.getState();
  t.near(plan.terminalPeak,peak,.0051,title+' peak voltage');t.near(plan.terminalRms,rms,.0051,title+' RMS voltage');
  near(plan.frequency,hz,title+' physical frequency');near(plan.slow,slowed,title+' explicit display slowing');
  t.near(plan.loadPower,power,.051,title+' mean load');t.near(plan.windingPower,heat,.00051,title+' winding heat');
  model.advance(2);const a=model.getState().now;model.advance(4);const b=model.getState().now;
  t.near(a.current,current,.00051,title+' current peak');near(a.current,-b.current,title+' opposite half-turn current');
  near(a.terminal,-b.terminal,title+' opposite half-turn voltage');
  t.ok(!a.bridged&&!b.bridged,title+' complete rings never bridge winding ends');
  model.advance(2);t.ok(model.playback.complete(),title+' completes one displayed turn');
}
const dcExpected = [
  ['Watch the split ring',79.31,777.0,8.033],['The brush bridges the gap',157.36,3058.8,52.866],
  ['Open the switch',79.95,0,1.767],['Turn slower',39.66,194.2,2.008],
  ['A lighter load',79.82,157.4,2.021],['Halve the field',39.66,194.2,2.008],
];
for(const [i,trial] of dcGeneratorLesson.tryIt.entries()) {
  const [title,mean,power,heat]=dcExpected[i];assert.equal(trial.title,title);
  model.reset();model.update(trial.values);const p=model.getState();
  t.near(p.terminalMean,mean,.0051,title+' stated mean voltage');
  t.near(p.loadPower,power,.051,title+' stated mean load');t.near(p.windingPower,heat,.00051,title+' stated winding loss');
  model.advance(2);const a=model.getState().now;model.advance(4);const b=model.getState().now;
  near(a.terminal,b.terminal,title+' equal positive output peaks');near(a.current,b.current,title+' same load direction');
  near(a.coilCurrent,-b.coilCurrent,title+' internal winding current still reverses');
  t.ok(a.terminal>0&&a.current>=0&&b.current>=0,title+' no negative pulse');
  model.advance(2);t.ok(model.playback.complete(),title+' completed cycle');
}
const checkpointModel=createGeneratorModel({commutatorLesson:true}),checkpoint=checkpointModel.actions.at(-1);
assert.equal(checkpoint.label,'Pause at brush bridge');
for(const speed of [0,1500,3000,3600])for(const turns of [20,40])for(const closed of [0,1])for(const field of [0,.5,1]) {
  const values={output:0,speed,turns,closed,field,load:50};checkpointModel.update(values);checkpointModel.advance(6);checkpoint.run();
  const p=checkpointModel.getState(),s=p.now;
  assert.deepEqual(p.values,{...values,output:1},'checkpoint preserves experiment settings and selects split ring');
  near(s.theta,speed?179*Math.PI/180:0,'checkpoint phase');
  t.ok(s.bridged&&s.current===0&&s.terminal===0,'checkpoint connects an internal short, not the load');
  const emf=turns*field*.02*(2*Math.PI*speed/60)*Math.sin(179*Math.PI/180);
  near(s.coilCurrent,emf/(turns*.6*1.68e-8/2.5e-6),'checkpoint current independently follows winding resistance');
  t.ok(checkpointModel.playback.blocked()===!speed,'checkpoint cannot start a stopped shaft');
  const theta=s.theta;checkpointModel.advance(.1);
  if(speed)t.ok(checkpointModel.getState().now.theta>theta,'play continues after checkpoint');
}
checkpointModel.reset();near(checkpointModel.getState().clock,0,'checkpoint reset returns to start');checkpointModel.dispose();
const expected = [
  ['Turn the shaft',88.15,777.0,783.3],['Turn half as fast',44.07,194.2,195.8],['Double the turns',174.89,3058.8,3108.1],
  ['Switch the field off',0,0,0],['Open the switch',88.86,0,0],['A heavier load',82.23,6761.3,7306.5],['Hold the shaft still',0,0,0],
  ['Change to a split ring',79.31,777.0,785.0],['Open the split-ring load',79.95,0,1.8],
];
for(const [i,trial] of electricGeneratorLesson.tryIt.entries()) {
  assert.equal(trial.title,expected[i][0]);assert.deepEqual(Object.keys(trial.values).sort(),Object.keys(GENERATOR_DEFAULTS).sort());
  model.reset();model.update(trial.values);model.advance(8);const s=model.getState();
  near(s.alternating?s.terminalRms:s.terminalMean,expected[i][1],trial.title+' output',.0005);
  t.near(s.loadPower,expected[i][2],.051,trial.title+' average load');t.near(s.drivePower,expected[i][3],.051,trial.title+' shaft input');
  t.ok(s.turning?model.playback.complete():model.playback.blocked(),trial.title+' named finished or blocked state');
}
for(const lesson of [electricGeneratorLesson,acGeneratorLesson,dcGeneratorLesson,generatorSlipRingsLesson])for(const trial of lesson.tryIt) {
  model.reset();model.update(trial.values);model.advance(8);const s=model.getState();
  t.ok(s.readings.every(x=>!/(NaN|undefined|Infinity)/.test(x.value)),'all shared lesson trials produce finite readings');
}
const acExpected = [
  ['Watch one whole turn',88.15,50,777.0,6.266],['Turn faster',105.78,60,1118.9,9.022],
  ['Turn slower',44.07,25,194.2,1.566],['Halve the field',44.07,50,194.2,1.566],
  ['A lighter load',88.71,50,157.4,.254],['Open the switch',88.86,50,0,0],
];
for(const [i,trial] of acGeneratorLesson.tryIt.entries()) {
  const [title,rms,hz,watts,heat]=acExpected[i];assert.equal(trial.title,title);
  model.reset();model.update(trial.values);const p=model.getState();
  t.near(p.terminalRms,rms,.0051,title+' stated RMS');near(p.frequency,hz,title+' frequency');
  t.near(p.loadPower,watts,.051,title+' stated load power');t.near(p.windingPower,heat,.00051,title+' stated winding heat');
  model.advance(2);const first=model.getState().now;model.advance(4);const second=model.getState().now;
  near(first.terminal,-second.terminal,title+' equal opposite voltage peaks');
  near(first.current,-second.current,title+' equal opposite current peaks');
  near(first.loadPower,second.loadPower,title+' both half turns heat equally');
  near(first.loadPower,2*p.loadPower,title+' sine peak heating twice average');
  near(first.flux,0,title+' quarter turn flux zero');near(second.flux,0,title+' three quarter turn flux zero');
  t.ok(first.torque>=0&&second.torque>=0,title+' torque opposes drive in both half turns');
  if(!trial.values.closed)t.ok(first.current===0&&first.terminal>0&&first.torque===0,'open AC load retains voltage without electromagnetic drag');
  model.advance(2);t.ok(model.playback.complete(),title+' completes');
}
model.reset();model.advance(2);const time=model.getState().clock;
for(const action of model.actions){action.run();near(model.getState().clock,time,'inspection preserves phase');t.ok(model.parts.some(p=>p.id===action.part),'inspection target exists');}
model.update({load:1});near(model.getState().clock,0,'changed setting restarts experiment');
model.advance(8);t.ok(model.playback.complete(),'one turn ends');model.reset();t.ok(!model.playback.complete(),'reset enables replay');
model.advance(2);const quarter=model.getState().now;model.reset();for(let i=0;i<200;i++)model.advance(.01);near(model.getState().now.terminal,quarter.terminal,'frame-step independence');
model.reset();model.update({speed:0});t.ok(model.playback.blocked(),'zero speed explicitly blocked');
model.reset();model.advance(2);
for(const aspect of [.65,1.25,2]) {
  const camera=new THREE.OrthographicCamera(-10,10,10,-10,.01,100);camera.position.set(8,5,12);camera.lookAt(0,0,0);camera.updateMatrixWorld(true);
  const state=JSON.stringify(model.getState()),view=createPartExplosion(model,camera,aspect);
  try {
    assert.deepEqual(new Set(view.categories.map(c=>c.id)),new Set(['stationary-group','rotating-group','circuit-group','output']));
    t.ok(view.items.every(item=>!['system','forces'].includes(item.id)),'guides do not become scattered parts');
    for(const category of view.categories)for(let i=0;i<category.items.length;i++)for(let j=i+1;j<category.items.length;j++) {
      const a=category.inner.get(category.items[i]),b=category.inner.get(category.items[j]);
      t.ok(Math.abs(a.x-b.x)>=(a.w+b.w)/2-1e-8||Math.abs(a.y-b.y)>=(a.h+b.h)/2-1e-8,'separated parts do not overlap');
    }
    for(const amount of [0,.5,1,0]){view.update(amount);assert.equal(JSON.stringify(model.getState()),state,'separation preserves experiment');}
    t.ok(view.items.every(item=>item.group.position.length()<1e-10),'exact reassembly');
  }finally{view.dispose();}
}
model.dispose();
const released=checkDisposal(createGeneratorModel(),t);
const checkpointReleased=checkDisposal(createGeneratorModel({commutatorLesson:true}),t);
console.log(`PASS generator: ${t.count} checks; ${states} circuit states; ${poses} geometry poses; ${contacts} contact probes; ${released+checkpointReleased} resources disposed once across both variants.`);

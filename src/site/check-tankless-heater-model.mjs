import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createTanklessHeaterModel, HEATER_SHAPE as S, heaterOutletPaths, heaterWaterColor} from './tankless-heater-model.js';
import {HEATER_DEFAULTS, HEATER_OPTIONS, HEATER_PHYSICS as P, tanklessHeaterPlan} from './tankless-heater-physics.js';
import {tanklessHeaterLesson as lesson} from './tankless-heater-lesson.js';
import {createHeatingModel} from './heating-models.js';
import {heatingLessons} from './heating-lessons.js';

let checks=0,combinations=0,poses=0,colorSamples=0,routeSamples=0;
const ok=(condition,message)=>{checks++;assert(condition,message);};
const eq=(actual,expected)=>{checks++;assert.deepEqual(actual,expected);};
const near=(actual,expected,tolerance=1e-7)=>{checks++;assert(Math.abs(actual-expected)<=tolerance,`${actual} != ${expected}; tolerance ${tolerance}`);};
const vector=point=>new THREE.Vector3(...point);
const bounds=object=>{object.updateMatrix();return new THREE.Box3().setFromBufferAttribute(object.geometry.attributes.position).applyMatrix4(object.matrix);};
const model=createTanklessHeaterModel(),g=model.topology;
eq(model.controls.map(control=>control.key),['flow','set','inlet','pipe']);
for(const control of model.controls)eq(control.options,HEATER_OPTIONS[control.key]);
eq(model.parts.length,13);eq(model.catalogParts.length,10);eq(model.covers.length,14);
ok(model.initialCutaway&&model.initialIsolated&&model.frameVisibleOnly);eq(model.initialPart,'system');
for(const part of model.parts){ok(part.name&&part.description);ok(!part.parentId||model.parts.some(parent=>parent.id===part.parentId));}
for(const part of lesson.parts)ok(model.parts.some(candidate=>candidate.name===part.name));
near(g.inletCurve.getPoint(1).distanceTo(g.coilCurve.getPoint(0)),0);
ok(bounds(g.waterGate).min.z>g.inletCurve.getPoint(0).z+g.inletWater.radius,'The schematic water valve remains visible in the cutaway');
ok(bounds(g.waterGate).max.z<bounds(g.valveFront).min.z,'The exterior cap covers the schematic water valve');
const outlet=g.coilCurve.getPoint(1).add(g.heater.position);
const gasEnd=g.gasCurve.getPoint(1),airEnd=g.airCurve.getPoint(1);
ok(bounds(g.manifold).containsPoint(gasEnd));ok(bounds(g.manifold).distanceToPoint(airEnd)<1e-7);
near(bounds(g.manifold).max.y,bounds(g.ports[0]).min.y,.008);
for(const port of g.ports)near(bounds(port).max.y,g.flames[0].position.y,.003);
for(const hood of [g.hoodBack,g.hoodFront]){
  ok(bounds(hood).min.z>bounds(g.back).max.z,'The exhaust hood stays inside the back wall');
  ok(bounds(hood).max.z<bounds(g.cover.children[0]).min.z,'The exhaust hood stays behind the front cover');
  near(bounds(hood).max.y,bounds(g.flueBack).min.y);
}
near(bounds(g.flueBack).max.y,g.flueRims[1].position.y);
for(const fin of g.fins)ok(bounds(fin).max.z>=g.coilCurve.getPoint(0).z-S.coilRadius,'Fins contact the copper tube');
ok(bounds(g.thermistor).min.z<=g.coilCurve.getPoint(1).z+S.coilRadius,'The temperature sensor contacts the water tube');
const wireTargets=[g.sensorBack,g.gasBody,g.sensorRod,g.thermistor,g.valveBack,g.fanBack];
for(const [i,points] of g.wirePaths.entries()){
  ok(bounds(g.board).distanceToPoint(vector(points[0]))<.013,'Each control wire begins on the board');
  ok(bounds(wireTargets[i]).distanceToPoint(vector(points.at(-1)))<.013,`Wire ${i} ends on its component`);
  near(g.wires[i].geometry.parameters.path.getPoint(0).distanceTo(vector(points[0])),0);
  near(g.wires[i].geometry.parameters.path.getPoint(1).distanceTo(vector(points.at(-1))),0);
}
for(const {value} of HEATER_OPTIONS.pipe){
  const paths=heaterOutletPaths(value),route=g.pipeVariants.find(route=>route.value===value);
  near(paths.pipe.getPoint(0).distanceTo(outlet),0);
  near(paths.pipe.getPoint(1).distanceTo(paths.tap.getPoint(0)),0);
  near(paths.tap.getPoint(1).distanceTo(vector(S.nozzle)),0);
  near(paths.whole.getLength(),paths.pipe.getLength()+paths.tap.getLength());
  near(route.end,paths.pipe.getLength()/paths.whole.getLength());
  near(paths.pipe.getTangent(1).dot(paths.tap.getTangent(0)),1);
  near(paths.tap.getTangent(1).dot(vector([0,-1,0])),1);
}
eq(g.tapWater.fluid.parent,g.tap);eq(g.tapWater.cover.parent,g.tap);
eq(g.pipe.parent,g.delivery);eq(g.tap.parent,g.delivery);eq(model.actions.at(-1).part,'delivery');
ok(bounds(g.tapWater.fluid).min.y<bounds(g.basin).max.y,'The isolated faucet riser reaches through the sink floor');
near(bounds(g.stem).min.y,1.59);near(bounds(g.basin).max.y,S.drain[1]);
near(g.waste.geometry.parameters.path.getPoint(0).distanceTo(vector(S.drain)),0);
const geometryIds=new Map();model.root.traverse(object=>{if(object.geometry)geometryIds.set(object,object.geometry.uuid);});
const temperature=(state,position,pipe=false)=>{
  if(!state.active)return state.values.inlet;
  const elapsed=Math.max(0,Math.min(state.clock,state.closeAt)-2.5-(pipe?position*state.pipeTime:0));
  return state.values.inlet+(state.values.set-state.values.inlet)*Math.min(pipe?1:position,elapsed/state.coilTime);
};
function inspectRoute(route,state,kind){
  const start=route.start??0,span=(route.end??1)-start,colors=route.fluid.geometry.attributes.color;
  for(const i of [0,Math.floor(route.segments/4),Math.floor(route.segments/2),route.segments]){
    const fraction=start+span*i/route.segments;
    const t=kind==='inlet'?state.values.inlet:temperature(state,fraction,kind==='pipe'),expected=heaterWaterColor(t);
    for(const vertex of [i*13,i*13+6,i*13+12]){
      near(colors.getX(vertex),expected.r,1e-6);near(colors.getY(vertex),expected.g,1e-6);near(colors.getZ(vertex),expected.b,1e-6);colorSamples++;
    }
  }
  const volume=kind==='inlet'?.18:kind==='coil'?P.coilLiters:state.pipeLiters;
  for(const [i,dot] of route.dots.entries()){
    const fraction=(state.now.deliveredLiters/volume+i/route.dots.length)%1;
    eq(dot.visible,state.now.flow>0&&fraction>=start&&fraction<start+span);
    if(dot.visible){const point=route.curve.getPointAt((fraction-start)/span);point.z+=route.radius;near(dot.position.distanceTo(point),0);routeSamples++;}
  }
}
function inspectPose(){
  poses++;const state=model.getState(),{now,values,readings}=state,route=g.pipeVariants.find(route=>route.group.visible);
  eq(g.pipeVariants.filter(route=>route.group.visible).map(route=>route.value),[values.pipe]);
  near(g.tapWater.start,route.end);
  inspectRoute(g.inletWater,state,'inlet');inspectRoute(g.coilWater,state,'coil');inspectRoute(route,state,'pipe');inspectRoute(g.tapWater,state,'pipe');
  const pipeColors=route.fluid.geometry.attributes.color,tapColors=g.tapWater.fluid.geometry.attributes.color;
  for(const component of ['getX','getY','getZ'])near(pipeColors[component](route.segments*13),tapColors[component](0));
  eq(g.stream.visible,now.flow>0);eq(g.drops.every(dot=>dot.visible),now.flow>0);eq(g.splash.visible,now.flow>0);
  eq(g.flames.every(flame=>flame.visible),now.lit);eq(g.gasDots.every(dot=>dot.visible),now.lit);
  eq(g.airDots.every(dot=>dot.visible),now.fan);eq(g.exhaustDots.every(dot=>dot.visible),now.fan);eq(g.spark.visible,now.spark);
  near(g.turbine.rotation.z,-now.deliveredLiters*2*Math.PI);near(g.waterGate.rotation.z,now.waterValve*Math.PI/2);
  near(g.gasDisc.position.y,.735+.11*now.fuelValve);near(g.gasStem.position.y,.85+.11*now.fuelValve);
  near(g.rotor.rotation.z,state.active?-Math.min(state.clock,state.duration)*8:0);
  near(g.handle.rotation.y,now.tapOpen?Math.PI/2:0);
  for(const flame of g.flames)if(flame.visible)ok(bounds(flame).max.y<g.coilCurve.getPoint(0).y-S.coilRadius,'Flames remain below the tube');
  if(now.flow>0){
    near(bounds(g.stream).max.y,S.nozzle[1]);near(bounds(g.stream).min.y,S.drain[1]);near(g.stream.scale.x,.037*Math.sqrt(now.flow/8));
    for(const dot of g.drops){ok(dot.position.y>=S.drain[1]&&dot.position.y<=S.nozzle[1]);near(dot.position.x,S.nozzle[0]);}
  }
  eq(g.resultStatus.userData.labelText,now.tapOpen?'WATER AT THE TAP':now.deliveredLiters>0?'LAST DELIVERY':'TAP CLOSED');
  eq(g.temperatureLabel.userData.labelText,now.deliveredLiters>0?`${now.tapTemperature.toFixed(1)} °C`:'No flow');
  eq(g.flowLabel.userData.labelText,`${(now.deliveredLiters>0?state.actualFlow:0).toFixed(2)} L/min`);
  ok(readings.every(reading=>!/NaN|Infinity|undefined|null/.test(reading.value+' '+(reading.hint||''))));
  model.root.traverse(object=>{
    ok([...object.position.toArray(),...object.scale.toArray(),...object.quaternion.toArray()].every(Number.isFinite));
    if(object.geometry)eq(object.geometry.uuid,geometryIds.get(object));
  });
}
for(const {value:flow} of HEATER_OPTIONS.flow)for(const {value:set} of HEATER_OPTIONS.set)for(const {value:inlet} of HEATER_OPTIONS.inlet)for(const {value:pipe} of HEATER_OPTIONS.pipe){
  const settings={flow,set,inlet,pipe},plan=tanklessHeaterPlan(settings);
  const times=plan.active?[0,.75,2.25,2.6,plan.warmAt+plan.coilTime/2,plan.hotAt+.5,plan.closeAt+.5,plan.duration]:[0,.75,plan.closeAt-.1,plan.duration];
  for(const time of times){
    model.reset({settings});model.advance(time/P.playbackRate);inspectPose();
    const before=model.getState();for(const action of model.actions){action.run();eq(model.getState(),before);eq(action.replay,false);ok(model.parts.some(part=>part.id===action.part));}
  }
  combinations++;
}
const trials=[];
for(const trial of lesson.tryIt){
  eq(trial.values,trial.initialState.settings);ok(trial.reset&&trial.isolate&&trial.view==='front');
  model.reset(trial.initialState);const initial=model.getState();eq(initial.clock,0);near(initial.now.tapTemperature,initial.values.inlet);
  model.advance(1000);const complete=model.getState();ok(complete.now.complete);trials.push([+complete.now.tapTemperature.toFixed(2),+complete.actualFlow.toFixed(2),+(complete.targetHeat/1000).toFixed(2),complete.hotAt===null?null:+complete.hotAt.toFixed(1)]);
  model.reset(model.replayState());eq(model.getState(),initial);model.advance(1000);eq(model.getState(),complete);
}
eq(trials,[[45,8,19.53,12],[10,0,0,null],[10,1,0,null],[45,9.83,24,10.3],[55,7.64,24,12.5],[45,8.6,24,11.4],[35,4,4.19,14.6],[45,8,19.53,8.6],[45,8,19.53,17.8]]);
model.reset();model.playback.step();near(model.getState().clock,1);model.animate(.5);near(model.getState().clock,2);
const saved=model.getState();for(const invalid of [null,-1,NaN,Infinity,.1]){model.animate(invalid);eq(model.getState(),saved);}
model.animate(1);near(model.getState().clock,3);
for(const invalid of [null,[],{flow:2},{inlet:15},{set:NaN},{unknown:1}]){const before=model.getState();model.update(invalid);eq(model.getState(),before);}
model.advance(1000);const complete=model.getState(),exposed=model.getState();exposed.values.flow=99;exposed.now.flow=99;exposed.readings[0].value='bad';eq(model.getState(),complete);
model.update({flow:4});eq(model.getState().clock,0);eq(model.getState().now.deliveredLiters,0);eq(model.replayState().settings,{...HEATER_DEFAULTS,flow:4});
eq(heatingLessons['Gas boiler'],lesson);const routed=createHeatingModel('Gas boiler');eq(routed.controls,model.controls);routed.advance(1000);near(routed.getState().now.tapTemperature,45);routed.dispose();
const prose=JSON.stringify(lesson)+model.parts.map(part=>part.name+part.description).join('')+model.controls.map(control=>control.label+control.help).join('');
ok(!/[—–]| - |--/.test(prose));ok(!/\b(centre|colour|metre|litre|behaviour|modelling|grey|analyse|fibre)\b/i.test(prose));
ok(!/\bthe book\b|page 146/i.test(prose));ok(lesson.sources.every(source=>source.url.startsWith('https://')));
const resources=new Set();model.root.traverse(object=>{
  if(object.geometry){resources.add(object.geometry);ok([...object.geometry.attributes.position.array].every(Number.isFinite));}
  for(const material of object.material?Array.isArray(object.material)?object.material:[object.material]:[]){resources.add(material);for(const value of Object.values(material))if(value?.isTexture)resources.add(value);}
});
const disposed=new Map([...resources].map(resource=>[resource,0]));
for(const resource of resources)resource.addEventListener('dispose',()=>disposed.set(resource,disposed.get(resource)+1));
model.dispose();model.dispose();ok([...disposed.values()].every(count=>count===1));
console.log(JSON.stringify({status:'PASS',checks,combinations,poses,colorSamples,routeSamples,parts:model.parts.length,trials:trials.length,disposed:resources.size}));

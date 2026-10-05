import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createRgbSubpixelsModel} from './rgb-subpixels-model.js';
import {rgbAperturesLesson as lesson} from './rgb-subpixels-lesson.js';
import {RGB_DEFAULTS,RGB_DOMAINS} from './rgb-subpixels-physics.js';
import {TFT,TFT_FRAME,TFT_DURATION} from './tft-screen-physics.js';
import {houseComponents} from './house-components.js';
import {tally,checkFinite,checkDisposal} from './model-check-kit.mjs';

const t=tally(),m=createRgbSubpixelsModel(),p=m.topology,near=(a,b,why,tol=1e-8)=>t.near(a,b,tol,why);let poses=0;
const bounds=o=>new THREE.Box3().setFromObject(o),direction=o=>new THREE.Vector3(0,1,0).applyQuaternion(o.quaternion);
m.root.updateMatrixWorld(true);
const layers=[p.backlight,p.guide,p.rearPolarizer,p.rearGlass,p.electrodes,p.rearAlignment,p.crystal,p.frontAlignment,p.common,p.filters,p.frontGlass,p.analyzer];
for(let i=1;i<layers.length;i++)t.ok(bounds(layers[i]).getCenter(new THREE.Vector3()).z>bounds(layers[i-1]).getCenter(new THREE.Vector3()).z,'Physical layers follow rear-to-front light order');
for(let i=0;i<3;i++){
 for(const [rod,ends]of [[p.dataRods[i],p.dataEndpoints[i]],[p.pixelRods[i],p.pixelConnections[i]]]){
  rod.updateMatrix();for(let k=0;k<2;k++){const endpoint=new THREE.Vector3(0,(k?1:-1)*rod.geometry.parameters.height/2,0).applyMatrix4(rod.matrix);near(endpoint.distanceTo(new THREE.Vector3(...ends[k])),0,'Drawn wire reaches authored terminal');}
 }
 t.ok(bounds(p.switches[i]).containsPoint(new THREE.Vector3(...p.dataEndpoints[i][1])),'Data line meets its own TFT');
 t.ok(bounds(p.switches[i]).expandByScalar(1e-10).containsPoint(new THREE.Vector3(...p.pixelConnections[i][0])),'Pixel wire meets its own TFT');
 t.ok(bounds(p.pads[i]).expandByScalar(1e-10).containsPoint(new THREE.Vector3(...p.pixelConnections[i][1])),'Pixel wire meets its own electrode');
 t.ok(bounds(p.gateRod).intersectsBox(bounds(p.switches[i])),'Common gate touches all three TFT symbols');
 t.ok(!bounds(p.gateRod).intersectsBox(bounds(p.storage.children[i*5+1])),'Gate crosses each storage lead without joining its electrical node');
 const target=p.gateRod.position.clone();target.x=p.switches[i].position.x;
 const front=new THREE.Vector3(...m.viewDirections.front).normalize(),ray=new THREE.Raycaster(target.clone().addScaledVector(front,10),front.negate());
 t.ok(ray.intersectObjects([p.support,p.stack,p.electronics],true)[0]?.object===p.gateRod,'Selected gate remains visible in front of connected assembly');
 const c=p.opticalChannels[i];near(Math.abs(direction(c.rearAxis).dot(direction(c.frontAxis))),0,'Polarizer axes are crossed');
 for(const [slab,axis]of [[c.rear,c.rearAxis],[c.front,c.frontAxis]])t.ok(axis.position.y>slab.geometry.parameters.height/2,'Axis cue lies on visible slab surface');
}
t.ok(p.guides.children.every(mesh=>mesh.material.side===THREE.FrontSide),'Captions cannot appear as mirrored text behind pixel');
assert.deepEqual(m.controls.map(c=>c.key),Object.keys(RGB_DEFAULTS));t.add();
for(const c of m.controls){assert.deepEqual([c.min,c.max,c.step],RGB_DOMAINS[c.key]);t.ok(c.help.length>30,'Control explains actual consequence');}
const byTitle=new Map();
for(const preset of lesson.tryIt){
 assert.deepEqual(preset.values,preset.initialState.settings);t.add();
 t.ok(m.parts.some(part=>part.id===preset.part),'Each trial opens an existing part');
 for(const time of [preset.initialState.time,5,TFT_DURATION]){
  m.reset({...preset.initialState,time});m.update(preset.values);const s=m.getState();poses++;
  for(let i=0;i<3;i++){
   const color=p.windows[i].material.color.toArray();for(let j=0;j<3;j++)near(color[j],j===i?s.center.illuminated[i]:0,'Aperture uses its own actual linear channel');
   near(p.mixture.material.color.toArray()[i],s.center.illuminated[i],'Swatch uses actual light, not requested code');
   const channel=p.opticalChannels[i];
   near(channel.front.position.y,.125*s.values.gap+.20,'Analyzer responds to selected cell gap');
   t.ok(channel.rear.position.y<-.125*s.values.gap&&channel.filter.position.y>.125*s.values.gap&&channel.filter.position.y<channel.front.position.y,'Optical inset preserves polarizer, LC, filter, analyzer order');
   for(let j=0;j<9;j++){
    const d=direction(channel.rods[j]),theta=s.directors[i].theta[j*10],phi=s.directors[i].phi[j*10];
    near(d.x,Math.cos(theta)*Math.cos(phi),'Drawn director X');near(d.y,Math.sin(theta),'Drawn director along light axis');near(d.z,Math.cos(theta)*Math.sin(phi),'Drawn director Z');
   }
   t.ok(channel.incoming.visible===(s.values.backlight>0)&&channel.outgoing.visible===(s.center.illuminated[i]>1e-8),'Light arrows disappear when illumination disappears');
   near(p.codeMarkers[i].position.x,-1.66+3.32*s.center.codes[i]/255,'Encoding marker horizontal position');near(p.codeMarkers[i].position.y,-.99+2.4*s.targetLinear[i],'Encoding marker decoded light');
  }
  for(const [marker,xy]of [[p.current,s.color.xy],[p.target,s.targetColor.xy]]){
   t.ok(marker.visible===(xy!==null),'No fabricated chromaticity at zero light');
   if(xy){near(marker.position.x,-1.67+3.34*xy[0]/.8,'Actual chromaticity X');near(marker.position.y,-.97+2.5*xy[1]/.8,'Actual chromaticity Y');}
  }
  t.ok(s.readings.every(r=>r.label&&r.value&&r.hint&&!/NaN|undefined|Infinity/.test(r.value)),'All visible readouts are finite or explicitly explain no light');
  const before=structuredClone(s);for(const action of m.actions){action.run();assert.deepEqual(m.getState(),before,'Inspection preserves all state and readings');t.add();}
  checkFinite(m.root,t);
 }
 t.ok(m.getState().complete,'Every authored trial completes');byTitle.set(preset.title,structuredClone(m.getState()));
}
const at=title=>byTitle.get(title),orange=at('Make the default orange');
t.ok(at('Use half green light').center.illuminated[1]>2*orange.center.illuminated[1],'Half-linear green trial supplies more than twice code-128 green');
for(const [title,channel]of [['Make red',0],['Make green',1],['Make blue',2]]){const s=at(title);t.ok(s.center.illuminated[channel]>.95&&s.center.illuminated.filter((_,i)=>i!==channel).every(v=>v<.01),'Named primary opens only selected channel above leakage');}
for(const [title,off]of [['Combine red and green',2],['Combine green and blue',0],['Combine red and blue',1]])t.ok(at(title).center.illuminated.every((v,i)=>i===off?v<.01:v>.95),'Named secondary has two open channels');
t.ok(at('Request white').center.illuminated.every(v=>v>.95)&&at('Request black').center.illuminated.every(v=>v>0&&v<.01),'White and illuminated black differ from no-light state');
near(at('Compare middle code with light').targetLinear[0],.21586050011389926,'Gray 128 trial');near(at('Request roughly half the light').targetLinear[0],.5028864580325687,'Gray 188 trial');
near(at('Dim the same color').color.luminance,orange.color.luminance/2,'Dim preset halves relative luminance');
t.ok(at('Remove the backlight').color.xy===null&&at('Remove the backlight').center.writes===12,'No-light preset still writes the pixel');
t.ok(at('Write once, then hold').center.writes===1&&at('Leave every gate closed').center.writes===0,'Hold and disabled presets have distinct causal states');
t.ok(at('Use a thinner liquid-crystal gap').center.light[0]>at('Use a thicker liquid-crystal gap').center.light[0]+.01,'Gap presets expose different finite-time optical response');
m.reset(lesson.tryIt.at(-1).initialState);t.ok(m.getState().scanRow===135&&p.gateRod.material.color.getHex()===0xe3b45e,'Pulse preset begins with visibly selected common gate');
m.reset();for(let i=0;i<12;i++)m.playback.step();t.ok(m.getState().complete,'Twelve frame steps complete');m.reset(m.replayState());near(m.getState().time,0,'Replay starts at zero');m.playback.step();near(m.getState().physicalTime,TFT_FRAME,'One step advances one physical frame');
const route=houseComponents['RGB subpixels'];
t.ok(route?.lesson===lesson&&route.createModel===createRgbSubpixelsModel&&route.part==='system'&&route.isolate===false,'Actual component route binds dedicated pixel lesson and connected model');
const resources=checkDisposal(m,t);console.log(`PASS RGB subpixels model: ${t.count} checks, ${poses} poses, ${lesson.tryIt.length} causal presets, ${resources} resources`);

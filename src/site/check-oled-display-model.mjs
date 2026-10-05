import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createOledDisplayModel} from './oled-display-model.js';
import {oledDisplayLesson as lesson} from './oled-display-lesson.js';
import {OLED,OLED_DEFAULTS,OLED_DOMAINS,OLED_PLAYBACK_DURATION} from './oled-display-physics.js';
import {studyLessons} from './study-lessons.js';
import {createStudyModel} from './study-models.js';
import {houseComponents} from './house-components.js';
import {componentParentIds} from './catalog-hierarchy.js';
import {tally,checkFinite,checkDisposal} from './model-check-kit.mjs';

const t=tally(),m=createOledDisplayModel(),p=m.topology,near=(a,b,why,tolerance=1e-8)=>t.near(a,b,tolerance,why);
const bounds=o=>new THREE.Box3().setFromObject(o),direction=o=>new THREE.Vector3(0,1,0).applyQuaternion(o.quaternion);
let poses=0;
m.root.updateMatrixWorld(true);
const layers=[p.encapsulation.children[0],p.cathode,p.etl,p.emitters,p.htl,p.anodes,p.glass];
for(let i=1;i<layers.length;i++)t.ok(bounds(layers[i]).getCenter(new THREE.Vector3()).z>bounds(layers[i-1]).getCenter(new THREE.Vector3()).z,'Bottom-emitting stack runs from rear seal through cathode, organics and anode to front glass');
t.ok(p.pixels.length===9&&p.pixels.every(pixel=>pixel.channels.length===3),'All nine physical pixels contain three independently lit apertures');
for(const pixel of p.pixels)for(const channel of pixel.channels)for(const object of [channel.sw,channel.drive]){
 const transistor=bounds(object);
 t.ok(transistor.min.z>bounds(p.anodes).max.z&&transistor.max.z<bounds(p.glass).min.z,'TFTs sit on the substrate side of the anodes, not behind the common cathode');
 for(const other of p.pixels)for(const aperture of other.channels){const light=bounds(aperture.window);t.ok(transistor.max.x<light.min.x||transistor.min.x>light.max.x||transistor.max.y<light.min.y||transistor.min.y>light.max.y,'TFT symbols stay beside the bottom-emitting apertures');}
}
for(const column of p.dataPaths)t.ok(bounds(p.dataChip).expandByScalar(1e-10).containsPoint(new THREE.Vector3(...column.source)),'Every column fanout begins at the data-driver chip');
for(const wire of p.rowWires)t.ok(bounds(wire).intersectsBox(bounds(p.rowDriver.children[0])),'Every selected row line reaches the row-driver chip');
for(const [index,terminals]of p.terminals.entries()){
 const channel=p.pixels[terminals.row*3+terminals.column].channels[terminals.channel],box=bounds(channel.drive).expandByScalar(1e-10);
 t.ok(box.containsPoint(new THREE.Vector3(...terminals.source))&&box.containsPoint(new THREE.Vector3(...terminals.drain)),'Source and drain wires reach the drive-TFT body');
 t.ok(bounds(p.anodes.children[index]).expandByScalar(1e-7).containsPoint(new THREE.Vector3(...terminals.anode)),'Each drain lead reaches its matching transparent anode within Float32 geometry precision');
 t.ok(terminals.drain[2]>terminals.anode[2]&&terminals.anode[2]>=bounds(p.anodes.children[index]).max.z-1e-10,'Drain-to-anode leads approach from the substrate side without crossing the cathode or organic layers');
 t.ok(bounds(p.rowWires[terminals.row]).intersectsBox(bounds(channel.sw)),'Selected row line reaches every switching-TFT symbol in its row');
 t.ok(!bounds(p.storage.children[index*4+1]).intersectsBox(bounds(p.storage.children[index*4+2])),'Storage capacitor plates retain a dielectric gap');
}
t.ok(p.guides.children.every(mesh=>mesh.material.side===THREE.FrontSide),'Main captions are not mirrored behind the display');
assert.deepEqual(m.controls.map(c=>c.key),Object.keys(OLED_DEFAULTS));t.add();
for(const control of m.controls){assert.deepEqual([control.min,control.max,control.step],OLED_DOMAINS[control.key]);t.ok(control.help.length>30,'Every control explains a physical consequence');}
const byTitle=new Map();
for(const trial of lesson.tryIt){
 assert.deepEqual(trial.values,trial.initialState.settings);t.add();t.ok(m.parts.some(part=>part.id===trial.part),'Every preset opens an existing physical or diagram part');
 for(const time of [trial.initialState.time,1,3,OLED_PLAYBACK_DURATION]){
  m.reset({...trial.initialState,time});m.update(trial.values);const s=m.getState();poses++;
  for(const [index,pixel]of p.pixels.entries())for(const [i,channel]of pixel.channels.entries()){
   channel.window.material.color.toArray().forEach((value,j)=>near(value,j===i?s.pixels[index].channels[i].light:0,'Physical aperture color follows actual current, not the requested target'));
  }
  p.mixture.material.color.toArray().forEach((value,i)=>near(value,s.light[i],'Combined color cue uses actual normalized center emission'));
  near(p.returnPivot.rotation.z,s.circuitClosed?0:.6,'Visible common return follows electrical state');
  near(p.returnDetailPivot.rotation.z,s.circuitClosed?0:-.65,'Circuit close-up shows the same return state');
  t.ok(p.writeChannel.material.color.getHex()===(s.center.selected?0xe3b45e:0xc8cbbc),'Electronic write channel follows center-row selection without mechanical motion');
  for(let i=0;i<3;i++){
   const carriers=p.carrierChannels[i],on=s.center.channels[i].current>0;
   t.ok(carriers.holes.every(c=>c.dot.visible===on)&&carriers.electrons.every(c=>c.dot.visible===on)&&carriers.photons.every(c=>c.visible===on)&&carriers.lightArrow.visible===on,'Carrier and photon cues stop in every zero-current state');
   t.ok(direction(carriers.lightArrow).y<-.999,'Escaped light points toward the transparent anode and substrate');
   for(let j=0;j<3;j++){
    const h=carriers.holes[j].dot.position,e=carriers.electrons[j].dot.position;
    t.ok(h.y>=-.38&&h.y<=.50&&e.y>=.50&&e.y<=1.35,'Hole and electron tracks approach the same emissive plane from opposite sides');
    t.ok(h.x<=.52&&e.x>=.52&&Math.abs(h.x+e.x-1.04)<1e-10,'Opposite carriers converge laterally toward the excited state without crossing layer names');
   }
  }
  const energy=[s.total.opticalPower,s.total.oledHeat,s.total.drivePower,s.total.electronicsPower];
  energy.forEach((power,i)=>{const bar=p.energyRows[i].bar;near(bar.scale.x,Math.max(1e-8,1.93*power/s.total.power),'Energy chart shows explicitly labeled shares of current total power');t.ok(bar.visible===(power>0),'Zero-power channels have no misleading bar');});
  t.ok(s.readings.every(r=>r.label&&r.value&&r.hint&&!/NaN|undefined|Infinity/.test(r.value)),'Every visible reading is defined');
  const before=structuredClone(s);for(const action of m.actions){action.run();assert.deepEqual(m.getState(),before,'Inspection preserves controls, voltages, delivered energy and time');t.add();}
  checkFinite(m.root,t);
 }
 t.ok(m.getState().complete,'Every authored trial completes');byTitle.set(trial.title,structuredClone(m.getState()));
}
const at=title=>byTitle.get(title);
for(const [title,channel]of [['Red light only',0],['Green light only',1],['Blue light only',2]])t.ok(at(title).light.every((v,i)=>i===channel?v>.999:v===0),'Each primary preset lights only its named channel');
near(at('White across the panel').total.power,482e-6,'White preset produces the promised assigned whole-panel power',1e-17);
near(at('Half the linear drive').total.current,at('White across the panel').total.current/2,'Half-drive preset halves emitter current',1e-17);
near(at('A black picture still uses electronics').total.power,50e-6,'Black preset retains electronics consumption',1e-17);
near(at('Light nine pixels instead of one').total.current,9*at('Make an orange center pixel').total.current,'Nine-pixel trial scales actual emitter current',1e-17);
t.ok(at('A checkerboard picture').pixels.filter(pixel=>pixel.active).length===5,'Checkerboard trial has five programmed pixels');
t.ok(at('Hold after one frame').center.writes===1&&at('Hold after one frame').light[0]>.99,'Single-write hold keeps red emitting');
t.ok(at('Disable every row write').center.writes===0&&at('Disable every row write').total.current===0,'Disabled rows never program the picture');
t.ok(at('Write light, then erase it').circuitClosed&&at('Write light, then erase it').total.current===0,'Erasure leaves power return closed');
for(const title of ['Open the emitter return from the start','Interrupt a lit emitter'])t.ok(!at(title).circuitClosed&&at(title).center.channels[0].voltage>2.99&&at(title).total.current===0,'Open-return trial keeps control signal while stopping emission');
t.ok(at('Watch a leaky signal fade').total.current===0&&at('Refresh the leaky signal').total.current>0,'Refresh replenishes a deliberately leaky signal');
m.reset(lesson.tryIt.find(trial=>trial.title==='Catch a row write').initialState);t.ok(m.getState().center.selected&&p.writeChannel.material.color.getHex()===0xe3b45e&&m.getState().center.channels[0].voltage>1,'Prepared row-write preset starts in the actual finite charging interval');
const firstPhoton=p.carrierChannels[0].photons[0].position.clone();m.advance(.02);t.ok(firstPhoton.distanceTo(p.carrierChannels[0].photons[0].position)>0,'Running state moves photon cues');
m.reset();for(let i=0;i<12;i++)m.playback.step();t.ok(m.getState().complete,'Twelve steps complete the record');m.reset(m.replayState());near(m.getState().time,0,'Replay restarts selected settings');m.playback.step();near(m.getState().physicalTime,1/60,'One step advances a physical frame');
assert.equal(studyLessons['OLED display'],lesson);assert.equal(houseComponents['OLED display'],undefined);assert.equal(componentParentIds['oled-display'],undefined);t.add(3);
const routed=createStudyModel('OLED display');t.ok(routed.root.name==='OLED display'&&routed.controls.length===7,'Whole-display factory returns the dedicated OLED model');routed.dispose();
const resources=checkDisposal(m,t);console.log(`PASS OLED model: ${t.count} checks, ${poses} poses, ${lesson.tryIt.length} causal presets, 27 connected emitters, ${resources} resources`);

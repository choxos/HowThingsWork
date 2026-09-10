import * as THREE from 'three';
import {houseModel,reading as r} from './house-model-kit.js';
import {createConsumerModel} from './consumer-model.js';
import {createEarthModel} from './earth-model.js';
import {createSocketModel} from './socket-model.js';
import {createMeterModel} from './meter-model.js';
import {createBreakerModel} from './breaker-model.js';
import {createFuseModel} from './fuse-model.js';
import {createLightingModel} from './lighting-model.js';
import {createCleaningModel} from './cleaning-models.js';
const TAU=Math.PI*2;
export function createSafetyModel(name){
 if(name==='Power socket')return createSocketModel();
 if(name==='Protective earth wire')return createEarthModel();
 if(name==='Consumer unit')return createConsumerModel();
 if(name==='Electricity meter')return createMeterModel();
 if(name==='Circuit breaker')return createBreakerModel();
 if(name==='Fuse')return createFuseModel();
 if(name==='Two-way light switch')return createLightingModel();
 if(name==='Fire extinguisher')return createCleaningModel(name);
 if(!['Two-way light switch','Magnetic burglar alarm','Smoke detector','Active burglar alarm','Lightning conductor'].includes(name))return null;
 const m=houseModel(name),{root,part,box,cylinder,disk,sphere,ring,rod,tube,control,finish,covers}=m;
 if(name==='Magnetic burglar alarm'){
  const frame=part('frame','Fixed door frame','Carries the magnetic switch.');box([.18,2,.25],[-.25,1,0],'wood',frame);const door=part('door','Door and attached magnet','The magnet moves away from the switch as the door opens.',[-1.2,.1,0]);box([1,.1,1.6],[.5,1,0],'leaf',door).rotation.x=Math.PI/2;
  const magnet=part('magnet','Permanent magnet','Its field holds the reed contacts together when close enough.',[1,1.5,.2],door);box([.15,.25,.1],[0,0,0],'clay',magnet);
  const reed=part('reed','Reed switch','Flexible magnetic contacts meet in a sufficient field. The alarm monitors whether this loop remains closed.',[-.2,1.6,.2]);const contactA=rod([0,-.13,0],[0,0,0],.018,'gold',reed),contactB=rod([0,0,0],[0,.13,0],.018,'gold',reed);
  const alarm=part('alarm','Alarm controller and sounder','Detects an opened monitoring loop while armed.',[.65,1.4,0]);box([.6,.7,.2],[0,0,0],'cream',alarm);const lamp=sphere(.07,[0,.18,.15],'red',alarm);lamp.material=lamp.material.clone();
  control('open','Door opening',0,80,5,0,'°');control('armed','Alarm armed',0,1,1,1,'','A closed-loop example; contact arrangements differ between devices.',[{value:0,label:'Disarmed'},{value:1,label:'Armed'}]);
  return finish((v,t)=>{door.rotation.y=-v.open*Math.PI/180;const closed=v.open<8,sounding=v.armed===1&&!closed;contactB.rotation.z=closed?0:-.3;lamp.material.emissive.setHex(0xd92b16);lamp.material.emissiveIntensity=sounding?1+.5*Math.sin(t*TAU*2):0;return {state:{closed,sounding},readings:[r('Reed contacts',closed?'Closed by nearby magnet':'Open: magnet moved away'),r('Alarm',sounding?'Triggered':v.armed?'Armed and quiet':'Disarmed'),r('Signal path','Magnet position → contact state → alarm controller'),r('Threshold','8° is an illustrative switching threshold, not a specified sensing distance')]};},{animated:true});
 }
 if(name==='Smoke detector'){
  const casePart=part('case','Detector housing','Allows air into the sensing chamber while shielding internal components.');const cover=cylinder(.95,.25,[0,.3,0],'cream',casePart);covers.push(cover);cylinder(.95,.08,[0,.14,0],'leaf',casePart);
  const chamber=part('chamber','Optical sensing chamber','In the photoelectric mode, smoke scatters light into a sensor positioned away from the direct beam.');for(let i=0;i<16;i++){const a=i*TAU/16;const b=box([.08,.28,.18],[.65*Math.cos(a),.3,.65*Math.sin(a)],'ink',chamber);b.rotation.y=-a;}
  const emitter=part('emitter','Light emitter','Directs light across the chamber.');sphere(.08,[-.5,.3,0],'red',emitter);const beam=rod([-.45,.3,0],[.45,.3,0],.015,'gold',emitter);
  const sensor=part('sensor','Photodiode','Receives scattered light from the off-axis path.');box([.16,.14,.16],[0,.3,.5],'blue',sensor);
  const scatter=part('scatter','Scattered light path','Smoke redirects some emitter light toward the photodiode.');rod([0,.3,0],[0,.3,.43],.014,'gold',scatter);
  const ions=part('ions','Ionization chamber electrodes','A tiny ionization current is reduced when smoke changes the charge transport. This alternate mode is shown separately.');for(const x of [-.35,.35])box([.04,.3,.7],[x,.3,0],'gold',ions);
  const particles=Array.from({length:20},(_,i)=>sphere(.025,[Math.sin(i*2)*.45,.3,Math.cos(i*3)*.45],'wood'));
  const alarm=part('alarm','Sounder and indicator','Triggers after the sensed signal passes a threshold.');const light=sphere(.07,[.75,.25,0],'red',alarm);light.material=light.material.clone();
  control('smoke','Smoke level',0,1,.05,0,'relative','A normalized signal illustration, not a smoke-concentration or sensitivity standard.');control('type','Detector principle',0,1,1,0,'','The two sensing principles respond differently to smoke.',[{value:0,label:'Optical scattering'},{value:1,label:'Ionization-current change'}]);
  return finish((v,t)=>{const sounding=v.smoke>=.4;emitter.visible=sensor.visible=v.type===0;ions.visible=v.type===1;scatter.visible=v.type===0&&v.smoke>0;scatter.scale.x=1;particles.forEach((particle,i)=>{particle.visible=i<Math.round(v.smoke*20);particle.position.y=.3+.035*Math.sin(t*TAU+i);});light.material.emissive.setHex(0xff321a);light.material.emissiveIntensity=sounding?1+.5*Math.sin(t*TAU*2):0;return {state:{sounding,signal:v.type?1-v.smoke:v.smoke},readings:[r(v.type?'Relative chamber current':'Relative scattered-light signal',`${Math.round((v.type?1-v.smoke:v.smoke)*100)}%`),r('Alarm state',sounding?'Threshold crossed':'Quiet'),r('Sensor principle',v.type?'Smoke changes ion charge transport':'Smoke scatters light onto an off-axis sensor'),r('Model threshold','40% is chosen for this experiment; it is not a detector specification')]};},{animated:true});
 }
 if(name==='Active burglar alarm'){
  const source=part('source','Infrared emitter','Sends a beam toward the receiver in active-beam mode.',[-1.1,.8,0]);box([.3,.8,.35],[0,0,0],'leaf',source);sphere(.09,[.18,0,0],'gold',source);
  const receiver=part('receiver','Receiver and controller','Detects loss of the beam; in PIR mode, detects a changing infrared pattern.',[1.1,.8,0]);box([.35,.8,.35],[0,0,0],'cream',receiver);const sensor=sphere(.1,[-.2,0,0],'blue',receiver);
  const beam=part('beam','Invisible infrared beam shown in gold','A teaching overlay makes the otherwise invisible beam visible.');rod([-.9,.8,0],[.9,.8,0],.02,'gold',beam);
  const person=part('target','Warm moving target','Interrupts the active beam or crosses the zones of a passive sensor.',[0,.5,0]);sphere(.16,[0,.55,0],'wood',person);box([.27,.5,.2],[0,.15,0],'clay',person);
  const lens=part('lens','PIR Fresnel lens and sensing zones','The lens directs different regions onto paired pyroelectric elements. Movement changes the balance of received infrared energy.',[1,.8,.2]);for(let i=0;i<5;i++)rod([0,0,0],[-1.7,(i-2)*.25,(i-2)*.15],.009,'blue',lens);
  const lamp=sphere(.065,[1.1,1.13,.2],'red');lamp.material=lamp.material.clone();
  control('position','Target position across detection area',-1,1,.05,-1,'','Move across the center line to interrupt the beam.');control('mode','Detection method',0,1,1,0,'','Passive infrared emits no interrogation beam.',[{value:0,label:'Active infrared beam'},{value:1,label:'Passive infrared motion sensor'}]);control('moving','Target movement',0,1,1,1,'','PIR responds to changes, not simply the presence of a warm stationary object.',[{value:0,label:'Stationary'},{value:1,label:'Moving'}]);
  return finish((v,t)=>{person.position.z=v.position;const interrupted=Math.abs(v.position)<.2,sounding=v.mode===0?interrupted:v.moving===1&&Math.abs(v.position)<.8;source.visible=beam.visible=v.mode===0;lens.visible=v.mode===1;if(v.mode===0)beam.scale.x=interrupted?.5:1;lamp.material.emissive.setHex(0xff321a);lamp.material.emissiveIntensity=sounding?1+.5*Math.sin(t*TAU*2):0;return {state:{sounding,interrupted},readings:[r('Detector output',sounding?'Alarm condition':'Quiet'),r('Active mode',interrupted?'Beam interrupted':'Beam reaches receiver'),r('Passive mode','Looks for changing thermal radiation across sensing zones'),r('Model','Geometric threshold illustration; signal processing and environmental effects omitted')]};},{animated:true});
 }
 const building=part('building','Building','An air terminal and bonded conductors provide a designed lightning-current path.');box([1.6,1.8,1.1],[0,.95,0],'cream',building);const roof=box([1.95,.16,1.45],[0,1.95,0],'clay',building);roof.rotation.z=.08;
 const conductor=part('conductor','Air terminal and down conductor','Carries intercepted lightning current toward the earth termination.');rod([0,1.95,0],[0,2.7,0],.025,'gold',conductor);tube([[0,2.4,0],[.8,2.1,0],[.9,.15,0],[.9,-.35,0]],.025,'gold',conductor);
 const earth=part('earth','Earth termination and bonding','Spreads current into the ground and bonds conductive parts to limit hazardous potential differences.');box([2.7,.12,1.8],[0,0,0],'wood',earth);for(const x of [.5,.9,1.3])rod([x,0,0],[x,-.4,0],.025,'metal',earth);
 const flash=part('flash','Illustrative current pulse','Lightning is a rapid transient. Moving markers show the intended path, not the actual waveform.');const dots=Array.from({length:10},()=>sphere(.045,[0,0,0],'gold',flash));
 control('strike','Illustrate a strike',0,1,1,0,'','A conceptual current path, not a lightning-protection design.',[{value:0,label:'No strike'},{value:1,label:'Current pulse'}]);control('current','Pulse current illustration',5,50,5,20,'kA','Higher current increases voltage across the same path impedance.');control('resistance','Example path resistance',1,10,1,2,'Ω','V = IR is only a resistive illustration; real lightning paths also have inductance.');
 return finish((v,t)=>{dots.forEach((dot,i)=>{const phase=(t*2+i/10)%1;dot.visible=Boolean(v.strike);dot.position.set(phase<.2?0:.9,2.7-phase*3,0);dot.scale.setScalar(.5+v.current/50);});return {state:{voltage:v.strike?v.current*v.resistance:0},readings:[r('Resistive voltage illustration',`${v.strike?v.current*v.resistance:0} kV`),r('Current path','Air terminal → bonded down conductor → earth termination'),r('What protection does','Controls the path; does not make lightning harmless'),r('Model limit','No strike probability, protection radius, surge waveform, or installation design')]};},{animated:true});
}

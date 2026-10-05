import * as THREE from 'three';
import {houseModel,reading as r} from './house-model-kit.js';
import {PHONE_COLORS as C,createPhoneAssembly} from './smartphone-geometry.js';
import {createPhoneDetails,updatePhoneDetails} from './smartphone-details.js';
import {SMARTPHONE_DEFAULTS as D,SMARTPHONE_DOMAINS,createSmartphoneController} from './smartphone-physics.js';

const experiments=['Touch','Orientation','Vibration','Voice path'];
export function smartphoneControlVisible(key,values){
  return ['scenario','power'].includes(key)||[['touchX','touchY','contact'],['roll','pitch','support'],['speed','balance'],['network']][values.scenario].includes(key);
}

function updatePhone(p,d,state){
  const {values:v,now:n}=state,touch=v.scenario===0,orientation=v.scenario===1;
  p.phone.rotation.set(orientation?-v.pitch*Math.PI/180:0,0,orientation?v.roll*Math.PI/180:0,'XYZ');
  p.phone.position.set(n.motor.body.x,n.motor.body.y,0);
  p.screen.material.color.set(v.power?C.white:0x1c251f);p.screenUI.visible=Boolean(v.power);
  p.touchGrid.visible=touch;p.guides.visible=orientation;
  p.headline.visible=p.status.visible=p.portraitContent.visible=touch;
  p.icons.forEach((mesh,i)=>{mesh.visible=touch;mesh.material.color.set(Math.floor(i/5)<n.scannedRows?C.white:0xb4c5b0).lerp(new THREE.Color(C.gold),Math.floor(i/5)<n.scannedRows?n.touch.changes[i]:0);});
  p.gridRows.forEach((mesh,i)=>mesh.material.color.set(i===n.activeRow&&v.power?C.gold:0xb4c5b0));
  p.finger.visible=Boolean(v.contact);p.finger.position.set((v.touchX-2)*.255,1.03-v.touchY*.29,.241);
  p.cursor.visible=touch&&Boolean(state.registered);if(state.registered)p.cursor.position.set((state.registered.x-2)*.255,1.03-state.registered.y*.29,.009);
  p.status.userData.setText(n.complete?(state.registered?'Touch registered':'No touch'):n.activeRow>=0?`Scanning row ${n.activeRow+1}`:state.clock<3.2?'Processing touch':'Updating screen');
  p.app.visible=!touch;p.app.rotation.z=orientation&&state.orientation?-Math.PI/2:0;
  p.appTitle.userData.setText(experiments[v.scenario]);
  p.appValue.userData.setText(orientation?state.orientation?'Landscape':'Portrait':v.scenario===2?n.motor.running?'Vibrating':n.complete?'Trial complete':'Ready':!v.network?'No network':n.voiceDelivered?'Reply delivered':n.speakerActive?'Listening':n.microphoneActive?'Speaking':'Connecting');
  p.appFooter.userData.setText(orientation?n.complete?'Orientation kept':'Press Play to check':v.scenario===2?v.balance?'Centered weight':'Offset weight':n.voiceDelivered?'Conversation traced':'Information flow');
  p.appIcon.material.color.set(v.scenario===3&&!v.network?0xc14f39:n.complete?0x91aa7e:C.blue);
  p.appIcon.scale.setScalar(n.speakerActive||n.microphoneActive?1+.06*Math.sin(state.clock*20):1);
  p.motorRotor.rotation.z=n.motor.angle;p.motorWeight.position.x=v.balance?0:.065;
  p.speakerCone.material.color.set(n.speakerActive?C.gold:0xb4c5b0);
  p.speakerCone.position.z=-.0325+(n.speakerActive?.003*Math.sin(state.clock*20):0);
  p.microphoneDiaphragm.material.color.set(n.microphoneActive?C.gold:0x374736);
  p.chipMeshes.processor.material.color.set(v.power&&((touch&&state.clock>=2.8&&state.clock<3.6)||(orientation&&state.clock<2.4))?C.gold:0x374736);
  p.chipMeshes.modem.material.color.set([2,6].includes(n.voiceStage)?C.gold:0x374736);
  p.audioChip.material.color.set([3,5].includes(n.voiceStage)?C.gold:0x374736);
  p.sensorChip.material.color.set(orientation&&v.power?C.gold:C.blue);
  updatePhoneDetails(d,state);
}

export function createSmartphoneLearningModel(){
  const kit=houseModel('Smartphone'),p=createPhoneAssembly(kit),d=createPhoneDetails(kit,p.system),controller=createSmartphoneController();
  const names={scenario:'Experiment',power:'Battery power',touchX:'Touch column position',touchY:'Touch row position',contact:'Finger contact',roll:'Turn in the screen plane',pitch:'Tilt screen toward face up',support:'Motion condition',speed:'Rotor comparison speed',balance:'Weight position',network:'Cellular network'};
  const choices={scenario:experiments,power:['Off','On'],contact:['Lifted','Touching'],support:['Held steady','Free fall','Accelerating upward at 1 g'],speed:[{value:1,label:'Reference speed'},{value:2,label:'Twice the speed'}],balance:['Offset from shaft','Centered on shaft'],network:['Unavailable','Available']};
  const help={scenario:'Choose a complete input-to-output experiment. Inspecting a part preserves its time and settings.',power:'Electronics and the display need power. Turning power off stops the teaching operation; battery chemistry and spin-down are omitted.',touchX:'Zero is the leftmost column; four is the rightmost. Half steps put the finger between crossings.',touchY:'Zero is the top row; six is the bottom. Half steps demonstrate interpolation.',contact:'Lift the finger, then run a scan to clear the registered touch.',roll:'Rotate the whole phone about its screen normal. Press Play to let the example software check orientation.',pitch:'At 90° the screen faces upward. Gravity has no projection in its plane, so the software retains its previous orientation.',support:'A steady phone reads 1 g in total; ideal free fall reads zero. Upward acceleration adds to the support force.',speed:'Both trials use the same smooth speed profile. At the midpoint, twice the angular speed gives four times the radial force.',balance:'Center the weight while keeping it turning. The modeled rotating unbalance disappears.',network:'Without a network path, this voice example cannot deliver a reply. No cellular coverage or protocol performance is predicted.'};
  for(const key of Object.keys(D)){
    const options=choices[key]?.map((item,value)=>typeof item==='string'?{label:item,value}:item);
    kit.control(key,names[key],...SMARTPHONE_DOMAINS[key],D[key],['roll','pitch'].includes(key)?'°':'',help[key],options,{primary:key==='scenario',visibleWhen:values=>smartphoneControlVisible(key,values)});
  }
  const result=kit.finish(()=>{
    const state=controller.getState(),{values:v,now:n}=state;updatePhone(p,d,state);
    const readings=[r('Your result',n.result,n.blocked?'Restore battery power or the network path, then press Play.':`${n.phase}. Animation time is deliberately slowed; it does not predict device latency.`)];
    if(v.scenario===0)readings.push(r('Touch position',state.registered?`Column ${state.registered.x+1}, row ${state.registered.y+1}`:'No registered touch','The display changes only after a complete scan. Row and column numbers begin at 1; position controls begin at 0.'),r('Sensing',v.power?`${n.scannedRows} of 7 rows read`:'Electronics off','Transmit/receive coupling changes near a finger. Four constructed weights demonstrate interpolation; these are not measured capacitances or a prediction of touch accuracy.'));
    if(v.scenario===1)readings.push(r('Specific force',v.power?`x ${n.force.x.toFixed(2)} · y ${n.force.y.toFixed(2)} · z ${n.force.z.toFixed(2)} g`:'Electronic readout off','Phone axes: x across the short edge, y along the long edge, z out of the screen. This is an ideal static or uniformly accelerating reference, without sensor noise.'),r('Orientation policy',state.orientation?'Landscape':'Portrait',n.candidate.reason+'. The dead band and hold rule are teaching software, not an operating-system specification.'));
    if(v.scenario===2)readings.push(r('Rotating unbalance',v.balance?'Zero at every angle':`${n.motor.peakRadialRatio}× reference radial force at the midpoint`,'F = m r ω² for steady rotation. The animated start and stop also include the tangential reaction from angular acceleration. No real motor force or speed is inferred.'),r('Frame motion',v.balance?'Frame stays still':'Exaggerated opposite motion','An ideal free-body center-of-mass illustration. Grip stiffness, damping, real phone displacement and motor electrical behavior are outside this model.'));
    if(v.scenario===3)readings.push(r('Voice path',n.voiceDelivered?'Reply delivered':n.blocked?'Unavailable':n.phase,'Listen: network → antenna → modem → audio circuit → speaker. Reply: microphone → audio encoding → modem → antenna → network. This is a functional diagram, not radio flight time.'),r('Other board circuits','Processor, memory, wireless, navigation and SIM','These support the phone. A SIM authenticates a subscription; it is not a stage carrying the voice waveform.'));
    return {state:{...state,time:state.clock},readings};
  });
  const render=result.update;let lastClock=0,disposed=false;
  result.update=(values={})=>{controller.update(values);return render(controller.getState().values);};
  result.reset=(initial={})=>{controller.reset(initial);lastClock=0;return render(controller.getState().values);};
  result.advance=dt=>{if(Number.isFinite(dt)&&dt>0)controller.advance(dt);return render(controller.getState().values);};
  result.animate=time=>{const dt=Number.isFinite(time)?Math.max(0,time-lastClock):0;if(Number.isFinite(time))lastClock=time;return result.advance(dt);};
  result.replayState=controller.replayState;
  result.playback={label:'Run the phone experiment',description:'A slowed teaching sequence. Select an experiment, set its controls, then watch the connected phone or inspect an enlarged mechanism.',stepLabel:'Advance one teaching step',advance:result.advance,step:()=>result.advance(.2),complete:()=>result.getState().now.complete,blocked:()=>result.getState().now.blocked};
  result.actions=[['Inspect: complete phone','phone'],['Inspect: populated circuit board','board'],['Inspect: touch sensing','touch-detail'],['Inspect: three sensing axes','sensor-detail'],['Inspect: rotating unbalance','motor-detail'],['Inspect: voice signal path','voice-detail']].map(([label,part])=>({label,part,view:'front',isolate:true,replay:false,run:()=>render(controller.getState().values)}));
  result.resultPart={id:'phone',label:'Inspect the phone result',view:'front',focusOnComplete:false,preserveOnReset:true,available:()=>true};
  result.covers.push(p.bezel,p.display,p.touch);result.initialCutaway=false;
  const detailIds=['touch-detail','sensor-detail','motor-detail','voice-detail'],detailObjects=[d.touch,d.sensor,d.motor,d.voice];
  result.thumbnailOmit=[...detailObjects,p.guides,p.touchGrid];
  result.catalogParts=result.parts.filter(part=>!['system','phone'].includes(part.id));
  result.partViewDirections=Object.fromEntries(result.parts.map(part=>[part.id,{front:detailIds.includes(part.id)?[0,0,3]:[.18,.09,3]}]));
  for(const part of result.parts)part.framePadding=detailIds.includes(part.id)?.55:.72;
  result.initialPart='phone';result.initialView='front';result.frameVisibleOnly=true;result.framePadding=.72;result.selectionOutline=false;result.transparentBackground=true;
  result.frameBoundsForPart=id=>detailIds.includes(id)?new THREE.Box3(new THREE.Vector3(-1.78,-1.75,-.3),new THREE.Vector3(1.78,1.83,.5)).applyMatrix4(detailObjects[detailIds.indexOf(id)].matrixWorld):null;
  result.topology={...p,details:d};const dispose=result.dispose;result.dispose=()=>{if(!disposed){disposed=true;dispose();}};
  return result;
}

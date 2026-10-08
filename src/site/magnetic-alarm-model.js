import * as THREE from 'three';
import {houseModel,reading} from './house-model-kit.js';
import {solidArrow,textLabel} from './scene-kit.js';
import {MAGNETIC_ALARM_DEFAULTS as D,MAGNETIC_ALARM_DOMAINS as DOMAINS,MAGNETIC_ALARM_OPTIONS as OPTIONS,MAGNETIC_ALARM_PHYSICS as P,createMagneticAlarmController} from './magnetic-alarm-physics.js';

export const MAGNETIC_ALARM_SHAPE=Object.freeze({scale:.06,barX:-.65,sensorY:1.55,sensorZ:.5,contactX:-.55,contactOffset:.14});
const S=MAGNETIC_ALARM_SHAPE, GOLD=0xdaaa49, BLUE=0x438ca8, RED=0xc95742, GREEN=0x6d9866, DARK=0x445349;
const label=(parent,text,position,width,height=.14,color='#394233')=>textLabel(parent,text,{position,width,height,color});
const own=object=>{object.material=object.material.clone();return object;};
const vector=point=>new THREE.Vector3(...point);
function path(points) {
  const curve=new THREE.CurvePath();points.slice(1).forEach((point,i)=>curve.add(new THREE.LineCurve3(vector(points[i]),vector(point))));return curve;
}
function wires(kit,parent,points,color,radius=.018) {return points.slice(1).map((point,i)=>kit.rod(points[i],point,radius,color,parent));}

function buildAlarm(kit) {
  const {part,box,disk,cylinder,rod,ring,sphere}=kit;
  const system=part('system','Window and connected alarm','Follow the moving magnet, spring contacts, sensing loop and separately powered sounder.');
  const window=part('window','Window frame and guide','The fixed frame guides the sash vertically and supports the stationary switch.',[0,0,0],system);
  for(const x of [-.30,1.90]){box([.16,3.12,.28],[x,1.80,0],'cream',window);box([.025,2.91,.05],[x+.03,1.80,.18],'metal',window);}
  box([2.40,.15,.35],[.80,.26,0],'wood',window);box([2.40,.15,.35],[.80,3.34,0],'wood',window);
  box([2.06,.10,.10],[.80,1.98,-.08],'wood',window);
  const fixedGlass=own(box([1.94,1.28,.025],[.80,2.67,-.08],'blue',window));fixedGlass.material.transparent=true;fixedGlass.material.opacity=.15;fixedGlass.material.depthWrite=false;
  const sash=part('sash','Sliding sash','The sash carries the magnet upward when the window opens.',[0,0,0],window);
  for(const x of [-.17,1.77])box([.12,1.67,.13],[x,1.255,.19],'wood',sash);
  for(const y of [.42,2.09])box([2.06,.12,.13],[.80,y,.19],'wood',sash);
  const glass=own(box([1.82,1.54,.025],[.80,1.255,.16],'blue',sash));glass.material.transparent=true;glass.material.opacity=.15;glass.material.depthWrite=false;
  rod([.61,.51,.30],[.99,.51,.30],.033,'metal',sash);
  const magnet=part('magnet','Permanent magnet','Its horizontal magnetic axis stays fixed while the sash changes its height. It attracts the metal bar without an electrical supply.',[0,S.sensorY,S.sensorZ],sash);
  box([.12,.16,.17],[-.06,0,0],BLUE,magnet);box([.12,.16,.17],[.06,0,0],RED,magnet);
  label(magnet,'S',[-.06,0,.092],.075,.10);label(magnet,'N',[.06,0,.092],.075,.10);
  const mount=box([1,.055,.13],[0,S.sensorY,.35],'metal',sash);
  const liftLabel=label(window,'WINDOW CLOSED',[.80,3.60,.27],1.90,.17);

  const sensor=part('sensor','Magnet-operated contact switch','A preloaded spring draws the metal bar away from two fixed contacts. Magnetic attraction can hold the bar against both.',[0,0,0],system);
  box([1.44,.80,.16],[-1.13,S.sensorY,.24],'cream',sensor);
  for(const y of [1.17,1.93])box([1.44,.055,.35],[-1.13,y,.40],'cream',sensor);
  box([.055,.80,.35],[-1.825,S.sensorY,.40],'cream',sensor);
  for(const y of [1.25,1.85])box([.22,.055,.13],[-.42,y,.16],'metal',sensor);
  const sensorCover=box([1.42,.79,.055],[-1.13,S.sensorY,.65],'leaf',sensor);kit.covers.push(sensorCover);
  for(const y of [1.32,1.78])box([.28,.06,.13],[-.61,y,.50],'cream',sensor);
  const bar=part('bar','Metal contact bar','The guided bar moves one illustrative millimeter toward the magnet. Its right face then bridges the two fixed contacts.',[S.barX,S.sensorY,S.sensorZ],sensor);
  box([.030,.40,.09],[0,0,0],'metal',bar);
  const tip=box([.031,.07,.095],[0,0,0],'ink',bar);
  const spring=part('spring','Preloaded return spring','A more stretched spring pulls harder. Its mechanical anchor moves when you change preload.',[0,0,0],sensor);
  const springVariants=[];
  for(const preload of [.8,1,1.2])for(const travel of [0,1]) {
    const group=new THREE.Group(),restLength=5+preload/P.springRate,anchorX=S.barX-restLength*S.scale;
    group.position.set(anchorX,S.sensorY,S.sensorZ);group.rotation.z=-Math.PI/2;spring.add(group);
    const coil=kit.spring([0,0,0],.043,(restLength+travel)*S.scale,8,group,.010);
    const anchor=box([.07,.20,.11],[anchorX,S.sensorY,S.sensorZ],'ink',spring);
    springVariants.push({group,anchor,coil,preload,travel,anchorX});
  }
  const contacts=part('contacts','Two fixed electrical contacts','The metal bar joins these terminals only while its right face touches both pads.',[0,0,0],sensor);
  const pads=[-1,1].map(side=>box([.05,.07,.10],[S.contactX,S.sensorY+side*S.contactOffset,S.sensorZ],'gold',contacts));
  const forceGroup=new THREE.Group();forceGroup.position.set(S.barX,S.sensorY+.27,S.sensorZ+.06);sensor.add(forceGroup);
  const pull=solidArrow(kit,RED,forceGroup,.010),restore=solidArrow(kit,BLUE,forceGroup,.010);
  pull.userData.setDirection(vector([1,0,0]));restore.userData.setDirection(vector([-1,0,0]));
  label(sensor,'SPRING  ←  BAR  →  MAGNET',[-1.02,2.10,.67],1.82,.12);
  const contactLabel=label(sensor,'CONTACTS CLOSED',[-1.12,1.01,.56],1.64,.15);

  const cable=part('cable','Two-wire sensing loop','The small sensing current needs both contacts and both wires. A broken return lead is shown as a real gap.',[0,0,0],system);
  const batteryPlus=[-1.70,-.26,.50],supplyNode=[-1.70,-.06,.50],batteryMinus=[-1.70,-.84,.50];
  const resistorIn=[-1.31,-.06,.50],resistorOut=[-.89,-.06,.50];
  const upper=[S.contactX,S.sensorY+S.contactOffset,S.sensorZ],lower=[S.contactX,S.sensorY-S.contactOffset,S.sensorZ];
  const feed=[supplyNode,resistorIn],up=[resistorOut,[-.65,-.06,.50],[-.65,.26,.50],[-1.95,.26,.50],[-1.95,2.22,.50],[-.50,2.22,.50],[-.50,1.69,.50],upper];
  const returnUpper=[lower,[-.40,1.41,.50],[-.40,.80,.50]],returnLower=[[-.40,.66,.50],[-.40,-1.01,.50],[-1.70,-1.01,.50],batteryMinus];
  for(const route of [feed,up,returnUpper,returnLower])wires(kit,cable,route,'clay');
  const cableBridge=rod(returnUpper.at(-1),returnLower[0],.018,'clay',cable);
  const cutEnds=[.80,.66].map(y=>sphere(.025,[-.40,y,.50],'gold',cable));
  const cableLabel=label(cable,'SENSING LOOP',[-1.12,.58,.56],1.37,.14);
  const sensePath=path([batteryPlus,supplyNode,resistorIn,resistorOut,...up.slice(1),[S.barX+.06,upper[1],.50],[S.barX+.06,lower[1],.50],lower,...returnUpper.slice(1),...returnLower,batteryPlus]);
  const senseDots=Array.from({length:22},()=>sphere(.027,[0,0,0],GOLD,system));

  const controller=part('controller','Powered alarm controller','The open-loop signal sets a latch. A separate output contact supplies the sounder, so the sensing wire does not carry its power.',[0,0,0],system);
  box([2.28,1.24,.18],[-.89,-.55,.20],'cream',controller);
  for(const y of [.04,-1.14])box([2.28,.055,.41],[-.89,y,.41],'cream',controller);
  for(const x of [-2.00,.22])box([.055,1.24,.41],[x,-.55,.41],'cream',controller);
  const controllerCover=box([2.25,1.22,.05],[-.89,-.55,.70],'leaf',controller);kit.covers.push(controllerCover);
  const supply=part('supply','12 V teaching supply','An ideal DC source powers the sensing resistor and a separate sounder branch. Disconnecting it silences the alarm and clears the volatile latch.',[0,0,0],controller);
  box([.34,.50,.24],[-1.70,-.55,.40],'leaf',supply);
  const supplyTerminals=[box([.11,.05,.10],[-1.70,-.285,.50],'gold',supply),box([.11,.05,.10],[-1.70,-.815,.50],'metal',supply)];
  label(supply,'12 V',[-1.70,-.56,.54],.28,.12);
  const supplyContact=new THREE.Group();supplyContact.position.copy(vector(batteryPlus));supply.add(supplyContact);rod([0,0,0],[0,.20,0],.019,'gold',supplyContact);sphere(.025,supplyNode,'metal',supply);
  const resistor=part('resistor','12 kΩ sensing resistor','Limits the closed-loop sensing current to 1 mA. The controller input draws no current in this ideal circuit.',[-1.10,-.06,.50],controller);
  box([.42,.12,.13],[0,0,0],'wood',resistor);for(const x of [-.12,0,.12])box([.02,.14,.15],[x,0,0],'gold',resistor);
  label(resistor,'12 kΩ',[0,.19,.06],.57,.13);
  const latch=part('latch','Alarm memory and sensing input','With power and arming selected, an open loop stores an alarm request. Closing the window does not erase that request.',[-.80,-.50,.49],controller);
  box([.55,.48,.08],[0,0,0],'ink',latch);
  const senseLamp=own(disk(.037,.02,[-.12,.09,.06],GREEN,latch)),alarmLamp=own(disk(.037,.02,[.12,.09,.06],DARK,latch));
  label(latch,'SENSE    LATCH',[0,-.04,.061],.48,.073,'#f8efd9');
  const voltageLabel=label(latch,'0 V',[-.12,.18,.062],.25,.10,'#f8efd9'),latchLabel=label(latch,'CLEAR',[.12,-.15,.062],.27,.08,'#f8efd9');
  wires(kit,controller,[resistorOut,[-.80,-.06,.56],[-.80,-.26,.56]],BLUE,.011);
  const driver=part('driver','Sounder output contact','The teaching controller closes this separate power path while an armed alarm is latched.',[-.11,-.73,.50],controller);
  const outputContact=new THREE.Group();driver.add(outputContact);rod([0,0,0],[0,.28,0],.023,'gold',outputContact);disk(.035,.04,[0,0,0],'metal',driver);disk(.035,.04,[0,.28,0],'metal',driver);
  wires(kit,controller,[[-.525,-.50,.56],[-.24,-.50,.56],[-.24,-.59,.56]],GREEN,.012);
  label(driver,'OUTPUT',[0,-.15,.06],.55,.11);

  const sounder=part('sounder','Powered sounder','The separate load receives 1.2 W when the output contact closes. Visible vibration and optional audio indicate that the alarm is operating.',[1.04,-.50,.28],system);
  const body=cylinder(.37,.35,[0,0,.12],'ink',sounder);body.rotation.x=Math.PI/2;
  ring(.37,.038,[0,0,.32],'metal',sounder);
  const diaphragm=part('diaphragm','Vibrating diaphragm','This exaggerated slow vibration represents a much faster sound-producing motion.',[0,0,.32],sounder);
  const membrane=own(disk(.32,.02,[0,0,0],'cream',diaphragm));disk(.095,.065,[0,0,.035],'metal',diaphragm);
  const soundWaves=Array.from({length:3},()=>{const wave=own(ring(.37,.014,[0,0,.40],RED,sounder));wave.material.transparent=true;wave.material.depthWrite=false;return wave;});
  const sounderLabel=label(sounder,'QUIET',[0,-.55,.31],1.03,.17);
  const soundPlus=[1.04,-.13,.28],soundMinus=[1.04,-.87,.28];
  const soundFeed=[supplyNode,[-1.91,-.06,.50],[-1.91,.19,.18],[1.04,.19,.18],soundPlus];
  const soundReturn=[soundMinus,[1.04,-1.02,.28],[.05,-1.02,.28],[.05,-.45,.50],[-.11,-.45,.50]];
  const outputReturn=[[-.11,-.73,.50],[-.11,-1.08,.50],[-1.70,-1.08,.50],batteryMinus];
  for(const route of [soundFeed,soundReturn,outputReturn])wires(kit,system,route,BLUE,.021);
  sphere(.029,soundPlus,'gold',system);sphere(.029,soundMinus,'gold',system);
  const soundPath=path([batteryPlus,...soundFeed,[1.04,-.50,.28],...soundReturn,...outputReturn,batteryPlus]);
  const soundDots=Array.from({length:19},()=>sphere(.034,[0,0,0],BLUE,system));
  for(const guide of [forceGroup,...senseDots,...soundDots,...soundWaves])guide.userData.explosionExcluded=true;
  for(const assembly of [window,sash,magnet,sensor,bar,spring,contacts,cable,controller,supply,resistor,latch,driver,sounder,diaphragm])assembly.userData.explosionRigid=true;
  return {system,window,sash,magnet,mount,bar,tip,spring,springVariants,contacts,pads,sensor,sensorCover,controller,controllerCover,cable,cableBridge,cutEnds,forceGroup,pull,restore,liftLabel,contactLabel,cableLabel,supplyContact,outputContact,senseLamp,alarmLamp,voltageLabel,latchLabel,sounder,diaphragm,membrane,soundWaves,sounderLabel,sensePath,soundPath,senseDots,soundDots,wireRoutes:{feed,up,returnUpper,returnLower,soundFeed,soundReturn,outputReturn},supplyTerminals,batteryPlus,batteryMinus,upper,lower};
}

function drawAlarm(g,s) {
  g.sash.position.y=s.opening*S.scale;g.magnet.position.x=S.barX+s.values.gap*S.scale;
  const mountStart=-.17,mountEnd=g.magnet.position.x;g.mount.scale.x=Math.max(.05,Math.abs(mountEnd-mountStart)+.18);g.mount.position.x=(mountStart+mountEnd)/2;
  g.bar.position.x=S.barX+s.barTravel*S.scale;
  for(const variant of g.springVariants){const active=variant.preload===s.values.spring&&variant.travel===s.barTravel;variant.group.visible=active;variant.anchor.visible=active;}
  g.forceGroup.position.x=g.bar.position.x;g.pull.userData.setLength(.36*s.magneticPull/(s.magneticPull+s.springPull));g.restore.userData.setLength(.36*s.springPull/(s.magneticPull+s.springPull));
  g.cableBridge.visible=Boolean(s.values.cable);g.cutEnds.forEach(end=>end.visible=!s.values.cable);
  g.supplyContact.rotation.z=s.values.power?0:.8;g.outputContact.rotation.z=s.alarm?0:-.9;
  g.senseLamp.material.color.set(s.voltage?s.senseVoltage?RED:GREEN:DARK);g.alarmLamp.material.color.set(s.alarm?RED:DARK);
  g.voltageLabel.userData.setText(`${s.senseVoltage} V`);g.latchLabel.userData.setText(s.latched?'SET':'CLEAR');
  g.liftLabel.userData.setText(s.opening?`LIFT ${s.opening.toFixed(2)} mm`:'WINDOW CLOSED');
  g.contactLabel.userData.setText(s.closed?'CONTACTS CLOSED':'CONTACTS OPEN');g.cableLabel.userData.setText(s.values.cable?'SENSING LOOP':'CABLE BROKEN');
  g.sounderLabel.userData.setText(s.alarm?'ALARM ON':s.voltage?'QUIET':'NO POWER');
  const activeSeconds=s.sounderEnergy/(P.voltage*P.voltage/P.sounderResistance);
  g.diaphragm.position.z=.32+(s.alarm?.015*Math.sin(activeSeconds*Math.PI*6):0);g.membrane.material.color.set(s.alarm?0xe9a48b:0xdfd9bd);
  g.soundWaves.forEach((wave,i)=>{wave.visible=s.alarm;const phase=(activeSeconds*1.3+i/3)%1;wave.scale.setScalar(1+phase*.7);wave.position.z=.39+phase*.50;wave.material.opacity=(1-phase)*.55;});
  g.senseDots.forEach((dot,i)=>{dot.visible=s.senseCurrent>0;dot.position.copy(g.sensePath.getPointAt((s.senseCharge/.006+i/g.senseDots.length)%1));});
  g.soundDots.forEach((dot,i)=>{dot.visible=s.sounderCurrent>0;dot.position.copy(g.soundPath.getPointAt((activeSeconds/3+i/g.soundDots.length)%1));});
}

function resultText(s) {
  if(!s.values.power)return 'No supply: the magnet and spring still move the contacts, but neither circuit can power the sounder.';
  if(!s.values.armed)return s.loopClosed?'Disarmed: the sensing loop is intact and the sounder is quiet.':'Disarmed: the loop is open, but the controller does not request an alarm.';
  if(s.resetBlocked)return 'Alarm retriggered: the sensing loop is still open. Restore the loop before clearing, or disarm to silence the alarm.';
  if(s.alarm)return s.loopClosed?'Alarm retained: the contacts have reclosed and sensing current has returned, but the stored request keeps the sounder on.':s.values.cable?'Alarm on: the spring opened the contacts, sensing current stopped, and the controller powered the sounder.':'Alarm on: a cable break interrupted the sensing loop. The sounder still has its separate power path.';
  return s.complete?'Cycle complete: the sensing loop is intact and no alarm request is stored.':`Armed and quiet: magnetic attraction holds both contacts closed.${s.clock===0?' Play to open and close the window.':''}`;
}

export function createMagneticAlarmModel() {
  const kit=houseModel('Magnetic burglar alarm'),g=buildAlarm(kit),controller=createMagneticAlarmController();
  const specs={opening:['Maximum window lift','mm','Play lifts the sash this far, holds it briefly, then closes it. Changes preserve the current cycle position.'],gap:['Magnet mounting distance','mm','Horizontal center-to-tip distance with the bar released. These are illustrative positions, not installation clearances.'],magnet:['Magnet strength','','Relative magnetic moment. Stronger attraction can hold the contacts through a larger window movement.'],spring:['Spring preload','','Moving the anchor stretches the spring before the bar moves. More preload makes the contacts release sooner.'],cable:['Sensing cable','','A break interrupts the same loop as open contacts. The supply to the sounder is a separate branch.'],armed:['Alarm setting','','Disarming clears the stored request while leaving the sensing circuit active. Arming an open loop triggers immediately in this teaching controller.'],power:['Supply connection','','Disconnecting power removes both circuit currents and clears the volatile alarm memory. Magnetic attraction remains.'],sound:['Hear the alarm','','Optional quiet 1 kHz tone while playback is running. Pause and completion mute it without clearing the illustrated alarm.']};
  for(const key of Object.keys(D)){const [name,unit,help]=specs[key];kit.control(key,name,...DOMAINS[key],D[key],unit,help,OPTIONS[key],key==='sound'?{replay:false}:undefined);}
  let playing=false,audioContext=null,oscillator=null,gain=null,audioError=false,disposed=false,previousTime=0;
  const mute=()=>{if(gain&&audioContext){gain.gain.cancelScheduledValues(audioContext.currentTime);gain.gain.setValueAtTime(0,audioContext.currentTime);}};
  function enableSound() {
    try{const Audio=globalThis.AudioContext;if(!Audio){audioError=true;return;}if(!audioContext){audioContext=new Audio();oscillator=audioContext.createOscillator();gain=audioContext.createGain();gain.gain.value=0;oscillator.frequency.value=1000;oscillator.connect(gain);gain.connect(audioContext.destination);oscillator.start();}audioError=false;audioContext.resume().catch(()=>{audioError=true;});}catch{audioError=true;}
  }
  const model=kit.finish(()=>{
    const s=controller.getState();drawAlarm(g,s);
    if(gain&&audioContext){if(playing&&s.values.sound&&s.alarm&&!s.complete&&audioContext.state==='running')gain.gain.setTargetAtTime(.016,audioContext.currentTime,.005);else mute();}
    const soundStatus=!s.values.sound?'Off':audioError?'Unavailable in this browser':audioContext?.state==='running'?(playing&&s.alarm&&!s.complete?'Playing':'Ready; silent while paused or quiet'):'Waiting for browser audio';
    return {state:s,readings:[
      reading('Your result',resultText(s)),
      reading('Window and contacts',`${s.opening.toFixed(2)} mm lift · ${s.closed?'closed':'open'}`,`Magnet-to-tip separation: ${s.separation.toFixed(2)} mm. The metal bar ${s.closed?'bridges both fixed terminals':'rests against its released stop'}.`),
      reading('Magnetic pull / spring pull',`${(s.magneticPull/s.springPull).toFixed(2)}×`,'The red and blue arrows compare opposing pulls. They use an ideal point-magnet and linear-spring model, with an arbitrary force scale.'),
      reading('Release and pickup',s.thresholds.release===null?'Too weak to hold the bar':`${s.thresholds.release.toFixed(2)} mm release · ${s.thresholds.pickup===null?'no pickup':`${s.thresholds.pickup.toFixed(2)} mm pickup`}`,s.thresholds.pickup===null?'Starting released, the magnet cannot close this switch even with the window shut.':'Release occurs on opening; pickup occurs on closing. The bar is closer to the magnet while held, so these positions differ.'),
      reading('Sensing circuit',`${(s.senseCurrent*1000).toFixed(1)} mA · ${s.senseVoltage} V at input`,'The 12 kΩ resistor limits current. A powered, closed loop holds the input at 0 V; an open loop raises it to 12 V.'),
      reading('Sounder branch',`${(s.sounderCurrent*1000).toFixed(0)} mA · ${(s.voltage*s.sounderCurrent).toFixed(1)} W`,'A separate output contact powers the illustrative 120 Ω load. Opening the small sensing loop does not disconnect the sounder supply.'),
      reading('Alarm memory',s.firstTrip?`Set at ${s.firstTrip.clock.toFixed(3)} s`:'Clear',s.firstTrip?`${s.firstTrip.cause==='cable'?'A cable break':'Released contacts'} first requested the alarm at ${s.firstTrip.opening.toFixed(2)} mm lift. Closing the loop does not clear it.`:'Disarming, disconnecting power, or clearing an intact loop removes the request.'),
      reading('Observation and audio',`${s.clock.toFixed(2)} / 10 s · sound ${soundStatus}`,'The window motion is prescribed. Current markers and diaphragm vibration are slowed teaching symbols. Inspection preserves the clock and alarm history.'),
    ]};
  });
  const render=model.update,readState=model.getState,sync=()=>render(controller.getState().values);
  model.getState=()=>({...controller.getState(),readings:readState().readings.map(row=>({...row}))});
  model.update=(input={})=>{const before=controller.getState();controller.update(input);const after=controller.getState();if(after.values.sound&&!before.values.sound)enableSound();if(!after.values.sound)mute();return sync();};
  model.reset=(initial={})=>{playing=false;mute();controller.reset(initial);previousTime=0;return sync();};
  model.advance=seconds=>{controller.advance(seconds);return sync();};
  model.animate=time=>{if(!Number.isFinite(time)||time<previousTime)return sync();const delta=time-previousTime;previousTime=time;return model.advance(delta);};
  model.replayState=controller.replayState;
  model.playback={label:'Open and close the window',description:'A ten-second teaching cycle: open, hold, close. Pause to inspect; the alarm stays latched after the contacts close.',stepLabel:'Advance a quarter second',advance:model.advance,step:()=>model.advance(.25),complete:()=>controller.getState().complete,blocked:()=>false,setPlaying:value=>{playing=value===true;if(!playing)mute();sync();}};
  model.actions=[...[['Inspect: complete installation','system'],['Inspect: magnet and contacts','sensor'],['Inspect: sensing controller','controller'],['Inspect: powered sounder','sounder']].map(([label,part])=>({label,part,isolate:!['sensor','controller'].includes(part),view:'front',replay:false,run:sync})),{label:'Clear alarm memory',replay:false,run:()=>{controller.clearAlarm();return sync();}}];
  model.resultPart={id:'system',label:'Inspect the alarm result',view:'front',focusOnComplete:false,preserveOnReset:true,available:()=>true};
  model.initialPart='system';model.initialView='front';model.initialCutaway=true;model.initialIsolated=true;model.frameVisibleOnly=true;model.includeCoversInSeparation=true;model.selectionOutline=false;model.transparentBackground=true;model.framePadding=.60;model.overviewZoom=.7/model.framePadding;
  model.viewDirections={front:[.35,.16,8],iso:[3,2,7],side:[8,.3,.5],back:[0,.3,-8],top:[.4,8,.4],bottom:[.4,-8,.4]};
  model.partViewDirections=Object.fromEntries(model.parts.map(part=>[part.id,{front:[.35,.16,8]}]));
  model.frameBoundsForPart=id=>id==='system'?new THREE.Box3().setFromObject(g.system):id==='sensor'?new THREE.Box3().setFromObject(g.sensor).union(new THREE.Box3().setFromObject(g.magnet)):undefined;
  model.parts.forEach(part=>{part.framePadding=part.id==='system'?.60:.64;});
  model.catalogParts=model.parts.filter(part=>!['system','window','sensor','controller'].includes(part.id));model.topology=g;
  const dispose=model.dispose;model.dispose=()=>{if(disposed)return;disposed=true;playing=false;mute();if(oscillator)oscillator.stop();if(audioContext)audioContext.close().catch(()=>{});dispose();};
  return model;
}

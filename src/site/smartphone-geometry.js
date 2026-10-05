import * as THREE from 'three';
import {textLabel,solidArrow} from './scene-kit.js';

export const PHONE_COLORS={dark:0x394233,white:0xf5f1dc,gold:0xc29243,blue:0x83b4c1};
export const phoneLabel=(parent,text,x,y,width=3.2,height=.2,z=.2)=>textLabel(parent,text,{width,height,position:[x,y,z]});
export const phoneColor=mesh=>{mesh.material=mesh.material.clone();return mesh;};
export const phoneGlass=(mesh,opacity=.09)=>{phoneColor(mesh);Object.assign(mesh.material,{transparent:true,opacity,depthWrite:false});return mesh;};
export function phoneArrow(kit,parent,color,start,end){
 const arrow=solidArrow(kit,color,parent,.014),a=new THREE.Vector3(...start),b=new THREE.Vector3(...end),delta=b.sub(a);
 arrow.position.copy(a);arrow.userData.setDirection(delta);arrow.userData.setLength(delta.length());return arrow;
}

export function createPhoneAssembly(kit){
 const {dark,white}=PHONE_COLORS;
 const system=kit.part('system','Smartphone','A generic connected phone. Choose an experiment to trace a touch, interpret orientation, compare an unbalanced rotor, or follow voice information. Packaging is illustrative.');
 const phone=kit.part('phone','Complete phone','Display and touch layers connect to a processor board. The battery powers sensing, processing, radio and audio. Look inside exposes the mounted parts.',[0,0,0],system);
 const make=(id,name,description,parent=phone)=>kit.part(id,name,description,[0,0,0],parent);
 const casing=make('case','Case and mounting frame','The rear shell, bezel and internal ledges support the phone. The rear camera has a real opening in this simplified case.');
 const rear=[];
 // Four rectangles leave a camera opening centered at (-0.57, 1.5).
 for(const [size,at]of [[[1.96,3.19,.07],[0,-.305,-.19]],[[1.96,.21,.07],[0,1.795,-.19]],[[.21,.4,.07],[-.875,1.49,-.19]],[[1.35,.4,.07],[.305,1.49,-.19]]])rear.push(kit.box(size,at,'ink',casing));
 const bezel=new THREE.Group();casing.add(bezel);
 for(const x of [-.915,.915])kit.box([.13,3.8,.26],[x,0,-.025],'ink',bezel);
 // Thin front bars leave internal clearance and openings for both sound ports.
 const frontBar=(x0,x1,y0,y1)=>kit.box([x1-x0,y1-y0,.05],[(x0+x1)/2,(y0+y1)/2,.08],'ink',bezel);
 frontBar(-.86,-.215,1.62,1.9);frontBar(.215,.86,1.62,1.9);
 frontBar(-.215,.215,1.62,1.7475);frontBar(-.215,.215,1.8025,1.9);
 frontBar(-.86,-.6325,-1.9,-1.62);frontBar(-.5475,.86,-1.9,-1.62);
 frontBar(-.6325,-.5475,-1.9,-1.795);frontBar(-.6325,-.5475,-1.755,-1.62);
 const ledges=[-.82,.82].map(x=>kit.box([.06,3.2,.05],[x,0,.02],'ink',casing));
 const battery=make('battery','Battery and leads','A rechargeable cell provides electrical energy. Power management on the board supplies the different circuits. This lesson does not predict charge life or charging behavior.');
 const batteryCell=kit.box([1.16,2.30,.12],[-.25,.04,-.095],'metal',battery);
 phoneLabel(battery,'Battery',-.25,.1,.83,.16,-.027);
 const board=make('board','Main circuit board','Copper tracks and connectors join processing, memory, sensing, radio and audio circuits. Named chips can be inspected individually; the populated board stays together in the parts inventory.');board.userData.explosionRigid=true;
 // A connected lower rail leaves a real notch around the motor mount.
 const boardPieces=[kit.box([.37,2.56,.05],[.685,.10,-.13],'leaf',board),kit.box([1.67,.12,.05],[0,-1.24,-.13],'leaf',board),kit.box([.97,.26,.05],[-.35,-1.43,-.13],'leaf',board),kit.box([.29,.26,.05],[.69,-1.43,-.13],'leaf',board)];
 const chips={},chipMeshes={};
 const entries=[
  ['processor','Processor and memory interface','Runs software and coordinates inputs and outputs. A real system-on-chip integrates several functions.',.99,.28],
  ['memory','Flash memory','Stores programs and data without power; working memory is also needed while software runs.',.61,.24],
  ['modem','Cellular modem and transceiver','Converts between digital information and radio signals. The radio front end drives the antenna and receives incoming signals.',.25,.24],
  ['wireless','Wi-Fi and Bluetooth circuitry','Supports local wireless links. These interfaces are separate from the cellular voice path illustrated here.',-.09,.24],
  ['navigation','Satellite navigation receiver','Uses signals from navigation satellites with software to estimate location. That position calculation is outside these experiments.',-.43,.24],
  ['power','Power management','Distributes and regulates battery power for the board and its connected devices.',-.77,.22],
  ['sim','Subscriber identity module','A secure SIM identifies and authenticates a subscription. This generic board uses an embedded chip; removable SIM cards are another implementation. The SIM does not carry the voice signal.',-1.06,.16],
 ];
 for(const [id,name,description,y,h]of entries){
  const group=make(id,name,description,board);chips[id]=group;chipMeshes[id]=phoneColor(kit.box([.26,h,.06],[.685,y,-.075],'ink',group));
  for(const x of [.53,.84])kit.box([.05,h*.7,.02],[x,y,-.095],'gold',group);
 }
 const audio=make('audio','Audio conversion and amplifier','Input circuitry digitizes a microphone signal. Output circuitry turns received digital audio into an electrical drive for the speaker.',board);
 const audioChip=phoneColor(kit.box([.30,.24,.06],[-.47,-1.37,-.075],'ink',audio));
 const sensor=make('sensor','Three-axis motion sensor','A microscopic spring-supported structure and differential capacitance sensing measure specific force. The enlarged view separates three conceptual axes; it does not reproduce a particular chip layout.',board);
 const sensorChip=phoneColor(kit.box([.18,.18,.06],[-.02,-1.37,-.075],'blue',sensor));
 const batteryLeads=[kit.rod([.33,-.72,-.095],[.50,-.72,-.095],.009,'red',battery),kit.rod([.33,-.85,-.095],[.50,-.85,-.095],.009,'ink',battery)];
 const display=make('display','Display and flexible cable','A light-emitting screen shows the software response. This generic emissive display is not a reproduction of a particular OLED pixel layout. A flexible cable carries power and data from the board.');
 const screen=phoneColor(kit.box([1.70,3.24,.06],[0,0,.075],white,display));
 const screenUI=new THREE.Group();screenUI.position.z=.108;display.add(screenUI);
 const headline=phoneLabel(screenUI,'Touch experiment',0,1.31,1.45,.14,0);
 const icons=Array.from({length:35},(_,i)=>phoneColor(kit.box([.16,.16,.005],[(i%5-2)*.255,1.03-Math.floor(i/5)*.29,0],'metal',screenUI)));
 const cursor=kit.ring(.10,.012,[0,0,.009],'gold',screenUI);
 const portraitContent=new THREE.Group();screenUI.add(portraitContent);
 for(const [width,y]of [[1.2,-1.08],[.92,-1.23],[1.06,-1.38]])kit.box([width,.027,.004],[0,y,0],dark,portraitContent);
 const status=phoneLabel(screenUI,'Ready',0,-.86,1.5,.12,.009);
 const app=new THREE.Group();screenUI.add(app);
 const appCard=phoneColor(kit.box([1.38,1.62,.005],[0,0,.01],'metal',app));
 const appTitle=phoneLabel(app,'',0,.55,1.26,.16,.025);
 const appIcon=phoneColor(kit.disk(.25,.012,[0,.02,.025],'blue',app));
 const appValue=phoneLabel(app,'',0,-.44,1.26,.13,.025);
 const appFooter=phoneLabel(app,'',0,-.65,1.26,.105,.025);
 const displayRibbon=[kit.box([.17,.06,.06],[-.13,-1.53,-.075],'gold',display),kit.box([.17,.08,.018],[-.13,-1.57,-.036],'gold',display),kit.box([.17,.025,.072],[-.13,-1.60,.009],'gold',display),kit.box([.20,.055,.015],[-.13,-1.59,.0375],'gold',display)];
 const touch=make('touch','Touch electrodes and cover glass','Transparent transmitting and receiving electrodes form a capacitive touch surface over the display. The visible grid is enlarged and simplified; it is normally nearly invisible.');
 const touchLayer=phoneGlass(kit.box([1.72,3.26,.016],[0,0,.120],'blue',touch),.035);
 const coverGlass=phoneGlass(kit.box([1.74,3.28,.018],[0,0,.137],white,touch),.035);
 const glassEdges=[[-.868,-1.638,.137,.868,-1.638,.137],[.868,-1.638,.137,.868,1.638,.137],[.868,1.638,.137,-.868,1.638,.137],[-.868,1.638,.137,-.868,-1.638,.137]].map(v=>phoneGlass(kit.rod(v.slice(0,3),v.slice(3),.004,'blue',touch),.45));
 const touchGrid=new THREE.Group();touchGrid.userData.explosionExcluded=true;touch.add(touchGrid);
 const gridColumns=Array.from({length:5},(_,i)=>kit.box([.008,2.00,.004],[(i-2)*.255,.16,.149],'blue',touchGrid));
 const gridRows=Array.from({length:7},(_,i)=>phoneColor(kit.box([1.30,.008,.004],[0,1.03-i*.29,.150],'gold',touchGrid)));
 const finger=phoneGlass(kit.sphere(.095,[0,0,.241],'clay',touchGrid),.65);
 const touchLead=kit.rod([-.79,-1.60,.12],[-.79,-1.56,-.105],.011,'gold',touch);
 const antenna=make('antenna','Antenna and radio feed','Conductive antenna sections exchange electromagnetic energy with the environment. A feed connects them to the radio front end. Real phones use multiple antennas and matching circuits.');
 const antennaPieces=[kit.box([.020,1.15,.045],[.990,.49,.002],'gold',antenna),kit.box([.020,.27,.045],[.990,-1.27,.002],'gold',antenna)];
 const radioFeed=kit.rod([.815,.25,-.075],[.98,.25,.002],.010,'gold',antenna);
 const speaker=make('speaker','Loudspeaker and sound outlet','An amplifier drives a diaphragm that moves air. The voice-path experiment highlights received sound; diaphragm motion is deliberately slowed.');
 const speakerBody=kit.box([.68,.25,.11],[0,1.51,-.1],'ink',speaker);
 const speakerCone=phoneColor(kit.box([.51,.15,.025],[0,1.51,-.0325],'metal',speaker));
 const speakerDuct=[kit.box([.43,.14,.11],[0,1.705,-.01],'ink',speaker),kit.box([.43,.055,.098],[0,1.775,.094],'ink',speaker)];
 const grille=kit.box([.43,.055,.018],[0,1.775,.152],'metal',speaker);
 const speakerLeads=[kit.rod([.34,1.46,-.075],[.51,1.34,-.105],.009,'gold',speaker),kit.rod([.34,1.54,-.075],[.85,1.37,-.105],.009,'ink',speaker)];
 const microphone=make('microphone','Microphone and sound inlet','A small microphone converts pressure variations into an electrical signal. Audio circuitry prepares the reply for processing and transmission.');
 const microphoneBody=kit.box([.20,.19,.09],[-.59,-1.66,-.11],'metal',microphone);
 const microphoneDiaphragm=phoneColor(kit.box([.12,.10,.015],[-.59,-1.66,-.0575],'ink',microphone));
 const microphoneInlet=kit.box([.085,.040,.018],[-.59,-1.775,.152],'ink',microphone);
 const microphoneDuct=[kit.rod([-.59,-1.66,-.05],[-.59,-1.775,-.05],.018,'ink',microphone),kit.rod([-.59,-1.775,-.05],[-.59,-1.775,.143],.018,'ink',microphone)];
 const microphoneLead=kit.rod([-.59,-1.565,-.075],[-.59,-1.49,-.075],.009,'gold',microphone);
 const motor=make('motor','Vibration motor and mounting','A DC motor rotates an off-center mass. Reaction forces enter the frame through its housing. Moving the mass to the shaft demonstrates why balanced rotation does not give the same rotating unbalance.');
 const motorMount=kit.box([.39,.40,.05],[.34,-1.57,-.13],'metal',motor);
 const motorHousing=kit.disk(.18,.055,[.34,-1.57,-.0775],'metal',motor);
 const motorRotor=new THREE.Group();motorRotor.position.set(.34,-1.57,-.03);motor.add(motorRotor);
 const motorWeight=kit.box([.15,.12,.026],[.065,0,0],'gold',motorRotor);
 const motorShaft=kit.disk(.025,.05,[.34,-1.57,-.04],'ink',motor);
 const motorLead=kit.rod([.34,-1.40,-.0775],[.12,-1.37,-.105],.009,'gold',motor);
 const camera=make('camera','Camera module','A lens directs light onto an image sensor connected to the board. Camera image formation is a separate mechanism; the voice experiment does not use this camera.');
 const cameraBody=kit.box([.37,.37,.12],[-.57,1.49,-.15],'ink',camera);
 const cameraLens=kit.disk(.11,.04,[-.57,1.49,-.23],'blue',camera);
 const cameraRibbon=kit.box([1.12,.075,.02],[.145,1.36,-.08],'gold',camera);
 const cameraConnector=kit.box([.10,.05,.015],[.685,1.34,-.0975],'gold',camera);
 const guides=new THREE.Group();guides.userData.explosionExcluded=true;phone.add(guides);
 const axes=[phoneArrow(kit,guides,0xc14f39,[-.63,-1.28,.23],[-.28,-1.28,.23]),phoneArrow(kit,guides,0x83b4c1,[-.63,-1.28,.23],[-.63,-.97,.23]),phoneArrow(kit,guides,0xc29243,[-.63,-1.28,.23],[-.63,-1.28,.62])];
 const axisLabels=[phoneLabel(guides,'x',-.20,-1.28,.12,.10,.23),phoneLabel(guides,'y',-.63,-.89,.12,.10,.23),phoneLabel(guides,'z',-.72,-1.40,.12,.10,.68)];
 return {system,phone,casing,rear,bezel,ledges,battery,batteryCell,batteryLeads,board,boardPieces,chips,chipMeshes,audio,audioChip,sensor,sensorChip,display,screen,screenUI,headline,icons,cursor,portraitContent,status,app,appCard,appTitle,appIcon,appValue,appFooter,displayRibbon,touch,touchLayer,coverGlass,glassEdges,touchGrid,gridColumns,gridRows,finger,touchLead,antenna,antennaPieces,radioFeed,speaker,speakerBody,speakerCone,speakerDuct,grille,speakerLeads,microphone,microphoneBody,microphoneDiaphragm,microphoneInlet,microphoneDuct,microphoneLead,motor,motorMount,motorHousing,motorRotor,motorWeight,motorShaft,motorLead,camera,cameraBody,cameraLens,cameraRibbon,cameraConnector,guides,axes,axisLabels};
}

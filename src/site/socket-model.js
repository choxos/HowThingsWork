import * as THREE from 'three';
import {houseModel,reading as r} from './house-model-kit.js';

export function createSocketModel(){
 const m=houseModel('Power socket'),{part,box,cylinder,disk,sphere,rod,spring,control,finish,covers}=m;
 const system=part('system','Plug, socket and connected lamp','Insertion moves a mechanical shutter before the power pins reach their contacts.');
 const socket=part('socket','Fixed socket assembly','An earth-pin-operated shutter example. Other sockets use different interlocks.',[0,0,0],system);
 const face=part('face','Insulating face and recessed apertures','Three shaped apertures guide the pins toward separate contacts.',[0,0,0],socket);
 const shape=new THREE.Shape();shape.moveTo(-.7,.15);shape.lineTo(.7,.15);shape.lineTo(.7,1.95);shape.lineTo(-.7,1.95);shape.closePath();
 const pins=[{id:'earth',x:0,y:1.45,w:.1,h:.2,length:1.1,color:'leaf'},{id:'neutral',x:-.4,y:.85,w:.22,h:.12,length:.8,color:'blue'},{id:'line',x:.4,y:.85,w:.22,h:.12,length:.8,color:'clay'}];
 for(const pin of pins){const hole=new THREE.Path(),w=pin.w/2+.025,h=pin.h/2+.025;hole.moveTo(pin.x-w,pin.y-h);hole.lineTo(pin.x-w,pin.y+h);hole.lineTo(pin.x+w,pin.y+h);hole.lineTo(pin.x+w,pin.y-h);hole.closePath();shape.holes.push(hole);}
 const plate=box([1,1,1],[0,0,-.08],'cream',face);plate.geometry.dispose();plate.geometry=new THREE.ExtrudeGeometry(shape,{depth:.08,bevelEnabled:false});
 for(const y of [.3,1.8])disk(.045,.03,[0,y,.02],'metal',face);
 const backing=box([1.4,1.8,.08],[0,1.05,-1.12],'cream',socket);covers.push(backing);for(const x of [-.67,.67])covers.push(box([.06,1.8,1.12],[x,1.05,-.56],'cream',socket));
 const shutter=part('shutter','Sliding insulating shutter','The longer earth pin pushes the cam down, uncovering both power apertures.',[0,0,0],socket);
 for(const x of [-.4,.4])box([.3,.24,.05],[x,.85,-.115],'leaf',shutter);
 rod([-.55,.55,-.16],[.55,.55,-.16],.025,'leaf',shutter);for(const x of [-.55,.55])rod([x,.55,-.16],[x,1.3,-.16],.025,'leaf',shutter);rod([-.55,1.3,-.16],[.55,1.3,-.16],.025,'leaf',shutter);
 const cam=part('cam','Sloping cam surface','The entering earth pin presses this ramp; the linked shutter moves down.',[0,0,0],shutter);
 const rampShape=new THREE.Shape();rampShape.moveTo(-.04,1.3);rampShape.lineTo(-.04,1.35);rampShape.lineTo(-.32,1.63);rampShape.lineTo(-.32,1.3);rampShape.closePath();
 const ramp=box([1,1,1],[.06,0,0],'leaf',cam);ramp.geometry.dispose();ramp.geometry=new THREE.ExtrudeGeometry(rampShape,{depth:.12,bevelEnabled:false});ramp.rotation.y=-Math.PI/2;
 const springPart=part('spring','Shutter return spring','Compression stores energy; withdrawal lets the spring close the shutter.',[0,.15,-.16],socket);const returnSpring=spring([0,0,0],.045,.4,7,springPart);
 const contacts=part('contacts','Three separate spring contacts','The pins enter recessed clips. The earth connection is separate from the normal load circuit.',[0,0,0],socket);
 for(const pin of pins){const back=pin.id==='earth'?-1.04:-.72;for(const sign of [-1,1])box([.035,pin.h+.06,-.4-back],[pin.x+sign*(pin.w/2+.01),pin.y,(-.4+back)/2],'gold',contacts);box([pin.w+.07,pin.h+.06,.035],[pin.x,pin.y,back],'gold',contacts);}
 const supply=part('supply','12 V teaching supply and socket switch','This low-voltage analogue supplies the normal lamp circuit.',[-1.15,1.0,-.45],system);box([.3,.65,.3],[0,0,0],'leaf',supply);rod([-.06,.2,.16],[.06,.2,.16],.012,'ink',supply);rod([0,.14,.16],[0,.26,.16],.012,'ink',supply);rod([-.06,-.2,.16],[.06,-.2,.16],.012,'ink',supply);
 const wires=part('socket-wires','Socket supply conductors','The switch interrupts line. Return and protective bond follow distinct paths.',[0,0,0],socket);
 const wire=(points,color,parent=wires)=>points.slice(1).forEach((p,i)=>rod(points[i],p,.014,color,parent));
 const switchPart=part('switch','Socket line switch','An open switch stops power even with the plug fully inserted.',[-.95,1.65,-.45],socket);const switchBlade=part('switch-blade','Moving switch blade','Rotates to open the line path.',[0,0,0],switchPart);rod([0,0,0],[.3,0,0],.025,'gold',switchBlade);for(const x of [0,.3])disk(.04,.05,[x,0,0],'metal',switchPart);
 wire([[-1.15,1.325,-.45],[-1.15,1.65,-.45],[-.95,1.65,-.45]],'clay');wire([[-.65,1.65,-.45],[.4,1.65,-1.2],[.4,.85,-1.2],[.4,.85,-.72]],'clay');wire([[-1.15,.675,-.45],[-.4,.675,-1.2],[-.4,.85,-1.2],[-.4,.85,-.72]],'blue');wire([[-1.15,.675,-.45],[-1.15,.5,-1.3],[0,.5,-1.3],[0,1.45,-1.3],[0,1.45,-1.04]],'leaf');
 const plug=part('plug','Moving plug and cable terminals','The body carries the pins together along the same insertion axis.',[0,0,1.5],system);
 const plugCover=box([1.25,1.35,.18],[0,1.025,.11],'cream',plug);covers.push(plugCover);
 for(const pin of pins){const p=part('pin-'+pin.id,pin.id==='earth'?'Longer earth pin':pin.id==='line'?'Line pin and insulating sleeve':'Neutral pin and insulating sleeve','The metal tip enters its matching spring contact.',[pin.x,pin.y,0],plug);box([pin.w,pin.h,pin.length],[0,0,-pin.length/2],'gold',p);if(pin.id!=='earth')box([pin.w+.008,pin.h+.008,.3],[0,0,-.15],'ink',p);box([pin.w,pin.h,.12],[0,0,.06],'gold',p);}
 const fuse=part('plug-fuse','Plug fuse in the line conductor','A cartridge fuse is connected in series with the flexible cable. Fuse melting is explored in its separate lesson.',[.4,.62,.1],plug);cylinder(.05,.3,[0,0,0],'cream',fuse);for(const y of [-.15,.15])cylinder(.055,.05,[0,y,0],'metal',fuse);
 wire([[.4,.85,.1],[.4,.77,.1]],'clay',plug);wire([[.4,.47,.1],[.2,.35,.1]],'clay',plug);wire([[-.4,.85,.1],[-.4,.5,.1],[-.2,.35,.1]],'blue',plug);wire([[0,1.45,.1],[0,.35,.1]],'leaf',plug);
 const grip=part('grip','Cable grip','The cable enters through an insulating strain-relief support.',[0,.35,.1],plug);box([.55,.12,.12],[0,0,0],'ink',grip);
 const lamp=part('lamp','Connected desk lamp','Power reaches the lamp only when both power pins engage and the socket switch is closed.',[1.75,.4,.65],system);
 cylinder(.32,.08,[0,0,0],'metal',lamp);cylinder(.04,.55,[0,.3,0],'metal',lamp);cylinder(.12,.15,[0,.65,0],'cream',lamp);const bulb=sphere(.2,[0,.86,0],'cream',lamp);bulb.material=bulb.material.clone();bulb.material.transparent=true;bulb.material.opacity=.5;
 wire([[-.15,0,0],[-.15,.65,0],[-.06,.86,0],[.06,.86,0],[.15,.65,0],[.15,0,0]],'gold',lamp);
 const light=new THREE.PointLight(0xffcb72,0,2.5,2);light.position.set(0,.88,0);lamp.add(light);box([.7,.015,.65],[1.75,.2,1.05],'cream',system);
 const cable=part('cable','Flexible cable conductors','Separate line and return wires power the lamp; the earth conductor bonds its metal base.',[0,0,0],system);
 const cableWires=[{start:.2,end:1.6,color:'clay'},{start:-.2,end:1.9,color:'blue'},{start:0,end:1.75,color:'leaf'}].map((entry,i)=>({...entry,y:.08-i*.07,segments:Array.from({length:3},()=>cylinder(.014,1,[0,0,0],entry.color,cable))}));
 control('insertion','Plug insertion',0,1,.01,0,'','Move along the fixed insertion axis, or run the complete insertion.');control('switch','Socket switch',0,1,1,1,'','The switch controls the supply separately from the shutters.',[{value:0,label:'Off'},{value:1,label:'On'}]);
 let lastClock=0,insertion=0,lastInsertion=0;
 const result=finish(v=>{const p=1.5-1.38*v.insertion,travel=Math.max(0,Math.min(.28,1.06-p)),earthContact=p-1.1<=-.4,powerContacts=p-.8<=-.4,powered=powerContacts&&Boolean(v.switch);
 plug.position.z=p;shutter.position.y=-travel;returnSpring.scale.y=(.4-travel)/.4;switchBlade.rotation.z=v.switch?0:.9;bulb.material.emissive.setHex(0xffcb72);bulb.material.emissiveIntensity=powered?2:0;light.intensity=powered?2:0;
 cableWires.forEach(({start,end,y,segments})=>{const points=[[start,.35,p+.1],[start,y,p+.4],[end,y,.65],[end,.4,.65]].map(a=>new THREE.Vector3(...a));segments.forEach((segment,i)=>{segment.position.copy(points[i]).add(points[i+1]).multiplyScalar(.5);const delta=points[i+1].clone().sub(points[i]);segment.scale.y=delta.length();segment.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),delta.normalize());});});
 return {state:{position:p,travel,earthContact,powerContacts,powered,current:powered?.5:0,complete:v.insertion>=1},readings:[r('Your result',powered?'Connected lamp illuminates the page':powerContacts?'Plug connected · socket switch off':'Lamp off · power pins not connected'),r('Insertion',(v.insertion*100).toFixed(0)+'%'),r('Shutter',travel===0?'Closed':travel>=.28?'Open':'Moving under the earth-pin cam'),r('Earth contact',earthContact?'Engaged':'Separated'),r('Line and neutral contacts',powerContacts?'Engaged':'Separated'),r('Lamp current',powered?'0.50 A':'0.00 A','12 V and a constant 24 Ω teaching load.')]};},{animated:true});
 function advance(seconds){if(!Number.isFinite(seconds)||seconds<=0)return result.update();const current=result.getState().values.insertion;if(current!==lastInsertion)insertion=current;insertion=Math.min(1,insertion+seconds/3);const readings=result.update({insertion});lastInsertion=result.getState().values.insertion;return readings;}
 result.advance=advance;result.animate=clock=>{const dt=Math.max(0,clock-lastClock);lastClock=clock;return advance(dt);};result.reset=()=>{lastClock=0;insertion=0;lastInsertion=0;};
 result.actions=[{label:'Withdraw the plug',run(){result.update({insertion:0});}}];result.playback={description:'The plug advances over three teaching seconds. Watch the shutter move before the recessed power contacts connect.',label:'Insert the plug',stepLabel:'Advance insertion',advance,step:()=>advance(.15),complete:()=>result.getState().complete,blocked:()=>false};result.resultPart={id:'lamp',context:'system',label:'Inspect the powered lamp',available:()=>true};return result;
}

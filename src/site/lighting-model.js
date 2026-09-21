import * as THREE from 'three';
import {houseModel,reading as r} from './house-model-kit.js';
const TAU=Math.PI*2, observationDuration=6;
export function createLightingModel(){
 const m=houseModel('Two-way light switch'),{part,box,cylinder,disk,sphere,rod,tube,control,finish}=m;
  const supply=part('supply','DC teaching supply','Provides a voltage between the positive and negative terminals.',[-1.25,.85,0]);box([.3,.65,.25],[0,0,0],'leaf',supply);box([.12,.06,.15],[0,.37,0],'gold',supply);rod([-.08,.24,.15],[.08,.24,.15],.015,'ink',supply);rod([0,.16,.15],[0,.32,.15],.015,'ink',supply);rod([-.08,-.23,.15],[.08,-.23,.15],.015,'ink',supply);
  const switches=part('switches','Two changeover switches','Either switch selects one of two traveler wires. The lamp circuit closes when both select the same traveler.');const handles=[];
  for(const side of [-1,1]){const sw=part(side<0?'switch-a':'switch-b',side<0?'First switch':'Second switch','A common contact connects to one of two alternative contacts.',[side*.6,1.72,0],switches);disk(.065,.08,[0,0,0],'ink',sw);const handle=part(side<0?'contact-a':'contact-b','Moving contact','The contact pivots between the two traveler terminals.',[0,0,.06],sw);rod([0,0,0],[-side*Math.hypot(.28,.15),0,0],.035,'gold',handle);handles.push({handle,side});for(const y of [-.15,.15])disk(.04,.08,[-side*.28,y,0],'metal',sw);}
  const wiring=part('wiring','Traveler and return wires','Follow the contacts and wires to find a continuous route through the filament.');
  const line=(points,color,parent=wiring,radius=.025)=>{const conductor=new THREE.Group();parent.add(conductor);return points.slice(1).map((point,i)=>rod(points[i],point,radius,color,conductor));};
  supply.userData.explosionRigid=true;wiring.userData.explosionPieces=true;
  const travelers=[1.87,1.57].map(y=>line([[-.32,y,0],[.32,y,0]],'clay')[0]);travelers.forEach(wire=>wire.material=wire.material.clone());
  const outgoing=[[.6,1.72,0],[1.65,1.72,0],[1.65,.64,0],[1.26,.64,0]];
  const incoming=[[-1.25,1.22,0],[-1.25,1.72,0],[-.6,1.72,0]];
  line(incoming,'clay');line(outgoing,'clay');
  line([[1.14,.64,0],[1.14,.3,0],[.24,.3,0]],'ink');line([[-.24,.3,0],[-1.25,.3,0],[-1.25,.5,0]],'ink');
  const station=part('light-station','Lamp and reading surface','The powered filament lights the page beneath it.');
  const lamp=part('lamp','Lamp and filament','Current heats the filament. In this constant-resistance approximation, filament power is I²R.',[1.2,.9,0],station);
  const holder=cylinder(.14,.16,[0,-.24,0],'cream',lamp);holder.material=holder.material.clone();holder.material.transparent=true;holder.material.opacity=.35;
  const bulb=sphere(.25,[0,0,0],'cream',lamp);bulb.material=bulb.material.clone();bulb.material.transparent=true;bulb.material.opacity=.18;bulb.material.depthWrite=false;
  const filament=part('filament','Coiled filament','The thin resistive coil joins two separate support leads inside the glass.',[0,0,0],lamp);
  const coil=Array.from({length:121},(_,i)=>[-.09+.18*i/120,.04*Math.sin(i*TAU/20),.04*Math.cos(i*TAU/20)]);
  const wire=tube(coil,.008,'gold',filament);wire.material=wire.material.clone();
  line([[-.06,-.26,0],[-.06,-.14,0],coil[0]],'metal',filament,.012);line([[.06,-.26,0],[.06,-.14,0],coil.at(-1)],'metal',filament,.012);
  const glow=new THREE.PointLight(0xffcf75,0,3,2);glow.position.set(0,0,.08);lamp.add(glow);
  const page=part('illuminated-page','Illuminated reading page','Toggle either switch and watch the light on this reading surface.',[1.05,.12,.68],station);
  box([.94,.08,.75],[0,-.05,0],'wood',page);
  const paper=box([.85,.012,.66],[0,0,0],'cream',page);paper.material=new THREE.MeshStandardMaterial({color:0xe8dfc3,roughness:1});
  for(let row=0;row<7;row++)for(const side of [-1,1])box([row===6?.21:.32,.005,.012],[side*.21,.009,-.24+row*.065],'ink',page);
  rod([0,.012,-.29],[0,.012,.29],.005,'wood',page);
  const resistor=part('resistor','Variable series resistor','More series resistance lowers current when the supply voltage is held fixed.',[0,.3,0]);box([.48,.15,.18],[0,0,0],'wood',resistor);for(let i=0;i<5;i++)box([.025,.17,.19],[-.15+i*.075,0,0],'gold',resistor);
  const electrons=part('electrons','Electron-flow markers','Blue markers move from the negative terminal through the external DC circuit toward the positive terminal. Their speed encodes current; real drift is much slower.');const dots=Array.from({length:18},()=>sphere(.045,[0,0,0],'blue',electrons));
  const paths=[1.87,1.57].map(y=>{const points=[[-1.25,.5,0],[-1.25,.3,0],[1.14,.3,0],[1.14,.64,0],[1.14,.76,0],...coil.map(([x,y,z])=>[x+1.2,y+.9,z]),[1.26,.76,0],[1.26,.64,0],...outgoing.slice(0,-1).reverse(),[.32,y,0],[-.32,y,0],[-.6,1.72,0],...incoming.slice(0,-1).reverse()];const path=new THREE.CurvePath();points.slice(1).forEach((point,i)=>path.add(new THREE.LineCurve3(new THREE.Vector3(...points[i]),new THREE.Vector3(...point))));return path;});
  control('first','First switch',0,1,1,0,'','Toggle either switch to change the circuit route.',[{value:0,label:'Upper traveler'},{value:1,label:'Lower traveler'}]);control('second','Second switch',0,1,1,0,'','Both must select the same traveler for a complete path.',[{value:0,label:'Upper traveler'},{value:1,label:'Lower traveler'}]);
  control('voltage','Supply voltage',0,24,.5,12,'V','Raising voltage increases current through the same resistance.');control('resistance','Added series resistance',0,60,2,0,'Ω','The example lamp itself has a constant 12 Ω resistance.');
  let elapsed=0,charge=0,lastClock=0;
  const result=finish(v=>{
    const complete=v.first===v.second,current=complete?v.voltage/(12+v.resistance):0;
    const power=current*current*12,resistorPower=current*current*v.resistance,brightness=power/(power+12);
    handles.forEach(({handle,side},i)=>{const selection=i?v.second:v.first;handle.rotation.z=side*(selection?1:-1)*Math.atan(.15/.28);});
    travelers.forEach((wire,i)=>wire.material.color.setHex(current>0&&v.first===i?0xe8a54a:0x687569));
    bulb.material.color.setRGB(.65+brightness*.35,.61+brightness*.29,.42+brightness*.28);
    bulb.material.emissive.setHex(0xffbd55);bulb.material.emissiveIntensity=brightness*2;
    wire.material.emissive.setHex(0xffb335);wire.material.emissiveIntensity=brightness*3;
    glow.intensity=brightness*5;paper.material.color.setRGB(.18+brightness*.95,.19+brightness*.87,.17+brightness*.67);
    dots.forEach((dot,i)=>{dot.visible=current>0;dot.position.copy(paths[v.first].getPointAt((charge/4+i/dots.length)%1));});
    return {state:{current,power,resistorPower,brightness,complete,totalPower:v.voltage*current,elapsed,charge},readings:[
      r('Your result',current>0?'Page illuminated':complete?'Page unlit · supply is off':'Page unlit · route interrupted','The same current calculation drives the filament glow and light on the page.'),
      r('Connection',complete?(v.first?'Lower traveler connects both switches':'Upper traveler connects both switches'):'Switches select different travelers','Toggling either switch changes whether the two ends share a traveler.'),
      r('Circuit current',current.toFixed(3)+' A','For a closed route, I = V / (12 Ω + added resistance). An open route carries no current.'),
      r('Lamp voltage',(current*12).toFixed(2)+' V','The lamp receives I × 12 Ω. Added series resistance takes the remaining supply voltage.'),
      r('Lamp power',power.toFixed(2)+' W','P = I² × 12 Ω. More lamp power produces more visible glow in this model.'),
      r('Series-resistor power',resistorPower.toFixed(2)+' W','This is energy transferred to the added resistor each second, not extra light from the lamp.'),
      r('Time observed',elapsed.toFixed(2)+' s','Run or step through a six-second observation. Pause freezes the charge-flow markers.'),
      r('Charge through lamp',charge.toFixed(2)+' C','Accumulated only while observing: 1 A transfers 1 coulomb per second. The blue markers are symbolic, not individual electrons.'),
    ]};
  },{animated:true});
  function advance(dt){
    if(!Number.isFinite(dt)||dt<=0)return result.update();
    const seconds=Math.min(dt,Math.max(0,observationDuration-elapsed));
    charge+=result.getState().current*seconds;elapsed=Math.min(observationDuration,elapsed+seconds);
    if(observationDuration-elapsed<1e-9)elapsed=observationDuration;
    return result.update();
  }
  result.advance=advance;
  result.animate=clock=>{if(!Number.isFinite(clock))return result.update();const dt=Math.max(0,clock-lastClock);lastClock=clock;return advance(dt);};
  result.reset=()=>{elapsed=0;charge=0;lastClock=0;};
  result.playback={label:'Observe charge flow',stepLabel:'Observe half a second',description:'Observe six seconds of this DC circuit. Markers show electron-flow direction at an exaggerated speed. Switches and brightness respond immediately to your settings.',advance,step:()=>advance(.5),complete:()=>elapsed>=observationDuration,blocked:()=>false};
  result.resultPart={id:'illuminated-page',context:'light-station',label:'Inspect the reading light',available:()=>true};
  return result;
}

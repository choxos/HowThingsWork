import * as THREE from 'three';
import {houseModel,reading as r} from './house-model-kit.js';

export function createEarthModel(){
 const m=houseModel('Protective earth wire'),{part,box,cylinder,disk,sphere,rod,control,finish,covers}=m;
 const system=part('system','A separate path for fault current','Compare the normal lamp circuit with a fault from its supply lead to the metal enclosure.');
 const source=part('source','Bonded 12 V teaching supply','The protective conductor returns to this supply reference, completing a circuit.',[-1.5,.65,0],system);
 box([.35,.9,.3],[0,0,0],'leaf',source);rod([-.07,.3,.17],[.07,.3,.17],.015,'ink',source);rod([0,.23,.17],[0,.37,.17],.015,'ink',source);rod([-.07,-.3,.17],[.07,-.3,.17],.015,'ink',source);
 const wires=part('wires','Normal supply and return wires','The lamp has its own two-wire circuit. Normal load current does not need the enclosure bond.',[0,0,0],system);
 const wire=(points,color='clay',parent=wires)=>points.slice(1).forEach((p,i)=>rod(points[i],p,.02,color,parent));
 wire([[-1.5,1.1,0],[-1.5,1.45,.12],[-1.05,1.45,.12]]);
 const protective=part('protective','Overcurrent disconnection contact','Opens after current exceeds the illustrative threshold for half a teaching second.',[-1.05,1.45,.12],system);
 const blade=part('blade','Opening contact blade','A lasting contact gap stops both load and fault current.',[0,0,0],protective);rod([0,0,0],[.4,0,0],.025,'gold',blade);
 for(const x of [0,.4])disk(.04,.06,[x,0,0],'metal',protective);box([.56,.28,.14],[.2,0,-.1],'cream',protective);
 wire([[-.65,1.45,.12],[-.1,1.45,.12],[-.1,1.2,.12]]);
 const enclosure=part('enclosure','Accessible metal enclosure','Color indicates case voltage relative to the source bond, not temperature.',[0,0,0],system);
 const panels=[box([1.05,1.1,.06],[.7,.75,-.22],'metal',enclosure),box([.06,1.1,.5],[.2,.75,0],'metal',enclosure),box([1.05,.06,.5],[.7,.2,0],'metal',enclosure),box([.06,1.1,.5],[1.2,.75,0],'metal',enclosure),box([1.05,.06,.5],[.7,1.3,0],'metal',enclosure)];
 const cover=box([1.05,1.1,.05],[.7,.75,.28],'metal',enclosure);panels.push(cover);covers.push(cover);panels.forEach(panel=>panel.material=panel.material.clone());
 const lamp=part('lamp','Lamp on an insulating mount','Its normal supply and return remain separate from the surrounding metal.',[.7,.65,.05],system);
 box([.35,.14,.28],[0,-.14,0],'cream',lamp);cylinder(.1,.16,[0,0,0],'cream',lamp);const bulb=sphere(.19,[0,.22,0],'cream',lamp);bulb.material=bulb.material.clone();bulb.material.transparent=true;bulb.material.opacity=.45;
 wire([[-.1,-.14,.07],[-.06,.22,.07],[.06,.22,.07],[.1,-.14,.07]],'gold',lamp);
 const sleeves=part('sleeves','Insulating feedthroughs','Insulating sleeves separate the normal wires from the metal wall.',[0,0,0],system);for(const y of [.36,1.05]){const sleeve=cylinder(.065,.12,[.2,y,.12],'cream',sleeves);sleeve.rotation.z=Math.PI/2;}
 wire([[-.1,1.2,.12],[-.1,1.05,.12],[.6,1.05,.12],[.6,.51,.12]]);wire([[.8,.51,.12],[.8,.36,.12],[-1.25,.36,.12],[-1.25,.2,0],[-1.5,.2,0]],'blue');
 const fault=part('fault','Insulation-fault connection','Closing this conceptual fault bridge connects the supply lead to the case.',[-.1,1.2,.12],system);rod([0,0,0],[.3,0,0],.022,'clay',fault);
 const earth=part('earth','Protective earth conductor','Carries fault current from the case back to the source bond.',[0,0,0],system);
 const path=[[.3,.2,.12],[.3,0,.12],[-.35,0,.12],[-.65,0,.12],[-1.5,0,.12],[-1.5,.2,0]];
 wire(path.slice(0,3),'leaf',earth);wire(path.slice(3),'leaf',earth);const earthBridge=rod(path[2],path[3],.02,'leaf',earth);disk(.06,.035,[.3,.2,.13],'gold',earth);disk(.045,.04,[-1.5,.2,.04],'gold',earth);
 const flow=part('flow','Fault-current markers','Markers on the green conductor follow conventional current back to the supply reference. Their speed is exaggerated.',[0,0,0],earth);
 const curve=new THREE.CurvePath();path.slice(1).forEach((p,i)=>curve.add(new THREE.LineCurve3(new THREE.Vector3(...path[i]),new THREE.Vector3(...p))));const dots=Array.from({length:9},()=>sphere(.035,[0,0,0],'gold',flow));
 control('fault','Insulation condition',0,1,1,0,'','Compare an insulated lead with a lead connected to the case.',[{value:0,label:'Intact insulation'},{value:1,label:'Supply-to-case fault'}]);
 control('earth','Protective earth connection',0,1,1,1,'','A break interrupts only the protective path, not the normal lamp return.',[{value:0,label:'Broken'},{value:1,label:'Connected'}]);
 control('resistance','Protective path resistance',.2,20,.2,.2,'Ω','Higher resistance reduces fault current and raises case voltage in this fixed circuit.');
 let tripped=false,exposure=0,elapsed=0,lastClock=0;
 function electrical(v){const parallel=v.fault&&v.earth?1/(1/24+1/(.2+v.resistance)):24,total=tripped?0:12/(.2+parallel),bus=total*parallel,earthCurrent=v.fault&&v.earth?bus/(.2+v.resistance):0;return {total,bus,earthCurrent,loadCurrent:bus/24,caseVoltage:v.fault?(v.earth?earthCurrent*v.resistance:bus):v.earth?0:null};}
 const result=finish(v=>{const s=electrical(v);blade.rotation.z=tripped?.9:0;fault.rotation.z=v.fault?0:-.9;earthBridge.visible=Boolean(v.earth);bulb.material.emissive.setHex(0xffcb72);bulb.material.emissiveIntensity=1.5*s.bus/12;
 const color=s.caseVoltage===null?new THREE.Color(0xe3b45e):new THREE.Color(0xb4c5b0).lerp(new THREE.Color(0xc14f39),s.caseVoltage/12);panels.forEach(panel=>panel.material.color.copy(color));dots.forEach((dot,i)=>{dot.visible=s.earthCurrent>0;dot.position.copy(curve.getPoint((elapsed*.7+i/dots.length)%1));});
 return {state:{...s,tripped,exposure,elapsed,complete:elapsed>=3},readings:[r('Your result',tripped?'Protection opened · lamp off':v.fault&&!v.earth?'Case energized · no fault-return path':v.fault&&s.total<=1.5?'Case energized · current too low to trip':v.fault?'Fault current flows · awaiting disconnection':'Lamp lit · no protective-earth current'),r('Case voltage',s.caseVoltage===null?'Floating · not determined':s.caseVoltage.toFixed(3)+' V','Relative to the bonded supply reference; color is a voltage overlay.'),r('Protective-earth current',s.earthCurrent.toFixed(3)+' A'),r('Lamp current',s.loadCurrent.toFixed(3)+' A'),r('Supply current',s.total.toFixed(3)+' A','Lamp current plus protective-earth current.'),r('Observed time',elapsed.toFixed(2)+' / 3 s'),r('Trip progress',tripped?'Latched open':(exposure/.5*100).toFixed(0)+'%','Illustrative rule: above 1.5 A for 0.5 teaching seconds.')]};},{animated:true});
 function advance(seconds){if(!Number.isFinite(seconds)||seconds<=0)return result.update();const dt=Math.min(seconds,Math.max(0,3-elapsed));if(!tripped){exposure=electrical(result.getState().values).total>1.5?exposure+dt:0;if(exposure>=.5){exposure=.5;tripped=true;}}elapsed+=dt;return result.update();}
 result.advance=advance;result.animate=clock=>{const dt=Math.max(0,clock-lastClock);lastClock=clock;return advance(dt);};result.reset=()=>{tripped=false;exposure=0;elapsed=0;lastClock=0;};
 result.actions=[{label:'Reset protective contact',run(){tripped=false;exposure=0;elapsed=0;result.update();}},{label:'Restart observation',run(){elapsed=0;}}];
 result.playback={description:'Observe the fault path for three teaching seconds. The deliberately slowed contact opens only if enough current flows.',label:'Observe the fault path',stepLabel:'Observe one tenth second',advance,step:()=>advance(.1),complete:()=>elapsed>=3,blocked:()=>false};
 result.resultPart={id:'system',context:'system',label:'Inspect the complete fault loop',available:()=>true};return result;
}

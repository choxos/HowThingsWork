import * as THREE from 'three';
import {houseModel,reading as r} from './house-model-kit.js';
export function createFuseModel(){
 const m=houseModel('Fuse'),{part,box,cylinder,sphere,rod,control,finish}=m;
 const circuit=part('circuit','Protected lamp circuit','The fuse is in series: opening its element stops current through the load.');
 const supply=part('supply','12 V teaching supply','A fixed low-voltage source drives the series circuit.',[-1.15,.6,0],circuit);box([.32,.65,.28],[0,0,0],'leaf',supply);rod([-.07,.2,.16],[.07,.2,.16],.012,'ink',supply);rod([0,.13,.16],[0,.27,.16],.012,'ink',supply);rod([-.07,-.2,.16],[.07,-.2,.16],.012,'ink',supply);
 const fuse=part('fuse','Cartridge fuse','Metal end caps connect through one thin element inside an insulating enclosure.',[0,1.3,0],circuit);
 const shell=cylinder(.17,1.2,[0,0,0],'cream',fuse);shell.rotation.z=Math.PI/2;shell.material=shell.material.clone();shell.material.transparent=true;shell.material.opacity=.14;shell.material.depthWrite=false;
 for(const x of [-.6,.6]){const cap=cylinder(.18,.2,[x,0,0],'metal',fuse);cap.rotation.z=Math.PI/2;}
 const element=part('element','Fusible element','Resistive heating competes with cooling. Melting removes the narrow bridge.',[0,0,0],fuse);
 const left=rod([-.61,0,0],[-.07,0,0],.025,'gold',element),right=rod([.07,0,0],[.61,0,0],.025,'gold',element),bridge=rod([-.07,0,0],[.07,0,0],.012,'gold',element);
 for(const mesh of [left,right,bridge])mesh.material=mesh.material.clone();
 const beads=[-.075,.075].map(x=>sphere(.035,[x,0,0],'gold',element));
 const load=part('load','Protected lamp','The load lights while current flows. A melted fuse interrupts its supply.',[1.15,.6,0],circuit);cylinder(.13,.18,[0,-.19,0],'metal',load);const bulb=sphere(.24,[0,.03,0],'cream',load);bulb.material=bulb.material.clone();const light=new THREE.PointLight(0xffc26a,0,2);light.position.set(0,.05,.3);load.add(light);
 const wiring=part('wiring','Series wires','There is no bypass around the fusible element.',[0,0,0],circuit);
 const paths=[[[-1.15,.93,0],[-1.15,1.3,0],[-.7,1.3,0]],[[.7,1.3,0],[1.5,1.3,0],[1.5,.36,0],[1.21,.36,0]],[[1.09,.36,0],[1.09,.08,0],[-1.15,.08,0],[-1.15,.27,0]]];
 for(const points of paths)points.slice(1).forEach((p,i)=>rod(points[i],p,.025,'clay',wiring));rod([1.09,.36,0],[1.09,.6,0],.014,'gold',load.parent);rod([1.09,.6,0],[1.21,.6,0],.014,'gold',load.parent);rod([1.21,.6,0],[1.21,.36,0],.014,'gold',load.parent);
 control('resistance','Lamp resistance',6,48,.5,24,'Ω','Lower resistance draws more current from the same 12 V supply.');
 control('power','Supply switch',0,1,1,1,'','Turn the supply off to stop heating and allow cooling.',[{value:0,label:'Off'},{value:1,label:'On'}]);
 let heat=0,melted=false,elapsed=0,lastClock=0;
 const result=finish(v=>{const current=v.power&&!melted?12/(v.resistance+.05):0,power=current*current*v.resistance;
 bridge.visible=!melted;beads.forEach(bead=>bead.visible=melted);
 for(const mesh of [left,right,bridge]){mesh.material.emissive.setHex(0xff3300);mesh.material.emissiveIntensity=heat*2;}
 bulb.material.emissive.setHex(0xffc26a);bulb.material.emissiveIntensity=power/(power+6)*2;light.intensity=power/(power+6)*3;
 return {state:{current,power,heat,melted,elapsed},readings:[r('Your result',melted?'Fuse melted · lamp off':current?'Element intact · lamp lit':'Supply off · element cooling'),r('Circuit current',current.toFixed(3)+' A'),r('Element heating',(heat*100).toFixed(1)+'% of melting rise','Normalized temperature rise, not degrees Celsius.'),r('Time observed',elapsed.toFixed(2)+' s'),r('Teaching fuse','1 A steady-current reference; 4 s thermal time constant','Illustrative thermal model, not a rated product or trip curve.')]};},{animated:true});
 function advance(dt){if(!Number.isFinite(dt)||dt<=0)return result.update();const v=result.getState().values,current=v.power&&!melted?12/(v.resistance+.05):0,target=current*current;
 const tripTime=!melted&&target>1?4*Math.log((target-heat)/(target-1)):Infinity;
 if(tripTime<=dt){elapsed+=tripTime;heat=1;melted=true;}else{heat=target+(heat-target)*Math.exp(-dt/4);elapsed+=dt;}
 return result.update();}
 result.advance=advance;result.animate=clock=>{const dt=Math.max(0,clock-lastClock);lastClock=clock;return advance(dt);};
 result.reset=()=>{heat=0;melted=false;elapsed=0;lastClock=0;};
 result.actions=[{label:'Replace the fuse',run(){heat=0;melted=false;result.update();}}];
 result.playback={label:'Run the circuit',stepLabel:'Observe one second',advance,step:()=>advance(1),complete:()=>melted,blocked:()=>false};
 result.resultPart={id:'element',context:'circuit',label:'Inspect the fuse element',available:()=>true};
 return result;
}

import * as THREE from 'three';
import {houseModel,reading as r} from './house-model-kit.js';
export function createConsumerModel(){
 const m=houseModel('Consumer unit'),{part,box,cylinder,disk,sphere,rod,control,finish,covers}=m;
 const system=part('system','Two independently fused circuits','A common supply feeds two parallel branches, each with its own fuse.');
 const cabinet=part('cabinet','Distribution enclosure','Supports and covers the main switch, busbars and protective devices.',[0,0,0],system);box([2.4,1.6,.1],[0,.85,-.2],'cream',cabinet);for(const x of [-1.17,1.17])box([.06,1.6,.4],[x,.85,0],'cream',cabinet);const cover=box([2.35,1.6,.08],[0,.85,.23],'leaf',cabinet);covers.push(cover);
 const source=part('source','12 V teaching supply','The fixed supply holds each parallel branch at approximately the same voltage.',[-1.6,.65,0],system);box([.3,.65,.25],[0,0,0],'leaf',source);rod([-.06,.22,.15],[.06,.22,.15],.012,'ink',source);rod([0,.16,.15],[0,.28,.15],.012,'ink',source);rod([-.06,-.22,.15],[.06,-.22,.15],.012,'ink',source);
 const wires=part('wires','Supply, branch and return conductors','Follow the common busbar into each fuse, through its lamps and back along the return.',[0,0,0],system);
 const wire=(points,color='clay')=>points.slice(1).forEach((p,i)=>rod(points[i],p,.018,color,wires));
 const main=part('main','Linked main isolator','One operating action separates both supply conductors in this model.',[0,0,0],system),blades=[];
 for(const y of [.62,.32]){const pole=part('main-pole-'+y,'Main switch contact','The moving blade opens a physical gap before the shared busbar.',[-1.1,y,.04],main);rod([0,0,0],[.4,0,0],.025,'gold',pole);rod([.12,0,0],[.12,0,.05],.018,'metal',pole);blades.push(pole);disk(.04,.06,[-1.1,y,.04],'metal',main);disk(.04,.06,[-.7,y,.04],'metal',main);}
 const handle=part('main-handle','Insulating linkage','The two moving contacts turn together.',[-1.1,.47,.09],main);rod([0,-.15,0],[0,.15,0],.025,'ink',handle);
 wire([[-1.6,.975,0],[-1.3,.975,0],[-1.3,.62,.04],[-1.1,.62,.04]]);wire([[-1.6,.325,0],[-1.3,.325,0],[-1.3,.32,.04],[-1.1,.32,.04]],'blue');
 const live=part('live-bus','Supply busbar','Both branch fuses connect to this common conductor.',[0,0,0],system);rod([-.7,.62,.04],[.95,.62,.04],.035,'clay',live);
 const neutral=part('return-bus','Return bar','Normal lamp current returns through this conductor.',[0,0,0],system);rod([-.7,.32,.04],[.95,.32,.04],.035,'blue',neutral);
 const earth=part('earth-bar','Unswitched protective bond','This separate bond connects the enclosure to the supply reference. It carries no normal load current.',[0,0,0],system);rod([-.95,.1,.02],[.95,.1,.02],.025,'leaf',earth);rod([.8,.1,.02],[.8,.1,-.2],.025,'leaf',earth);wire([[-1.6,.325,0],[-1.6,.03,0],[-.95,.03,.02],[-.95,.1,.02]],'leaf');
 const branches=[];
 for(const [i,x] of [[0,-.35],[1,.65]]){
  const branch=part('branch-'+i,i?'Study lighting circuit':'Kitchen lighting circuit','Lamps on this branch share one protective fuse.',[0,0,0],system);
  const fuse=part('fuse-'+i,i?'Study fuse':'Kitchen fuse','This element opens only its own branch after sufficient heating.',[x,1.12,.04],branch);
  const shell=cylinder(.105,.65,[0,0,0],'cream',fuse);shell.material=shell.material.clone();shell.material.transparent=true;shell.material.opacity=.18;shell.material.depthWrite=false;
  for(const y of [-.32,.32])cylinder(.115,.12,[0,y,0],'metal',fuse);
  rod([0,-.34,0],[0,-.05,0],.02,'gold',fuse);rod([0,.05,0],[0,.34,0],.02,'gold',fuse);const bridge=rod([0,-.05,0],[0,.05,0],.012,'gold',fuse);bridge.material=bridge.material.clone();
  wire([[x,.62,.04],[x,.74,.04],[x,.8,.04]]);wire([[x,1.44,.04],[x-.22,1.65,.04],[x-.22,3.12,.04]]);wire([[x+.22,.32,.04],[x+.22,3.12,.04]],'blue');
  box([.64,1.55,.06],[x,2.4,-.12],'cream',branch);const lamps=[];for(let j=0;j<4;j++){const y=1.92+j*.36,lamp=part('lamp-'+i+'-'+j,(i?'Study':'Kitchen')+' lamp '+(j+1),'A 24 Ω lamp is another parallel load on this branch.',[x,y,.04],branch);cylinder(.065,.09,[x,y-.1,.04],'cream',branch);const bulb=sphere(.11,[0,.035,0],'cream',lamp);bulb.material=bulb.material.clone();bulb.material.transparent=true;bulb.material.opacity=.4;rod([-.03,-.14,0],[-.03,.035,0],.008,'gold',lamp);rod([-.03,.035,0],[.03,.035,0],.008,'gold',lamp);rod([.03,.035,0],[.03,-.14,0],.008,'gold',lamp);wire([[x-.22,y-.14,.04],[x-.12,y-.14,.04]]);wire([[x-.06,y-.14,.04],[x-.03,y-.14,.04]]);const localSwitch=part('lamp-switch-'+i+'-'+j,'Local lamp switch','Only a closed local switch adds this lamp to the branch load.',[x-.12,y-.14,.04],branch);rod([0,0,0],[.06,0,0],.009,'gold',localSwitch);wire([[x+.03,y-.14,.04],[x+.22,y-.14,.04]],'blue');lamps.push({lamp,bulb,localSwitch});}
  box([.13,.13,.25],[x,1.12,-.12],'ink',cabinet);branches.push({fuse,bridge,lamps});
 }
 control('kitchen','Kitchen lamps',0,4,1,1,'','Each additional closed lamp switch adds another parallel load to the kitchen branch.');control('study','Study lamps',0,4,1,1,'','The study has a separate fuse.');control('main','Main isolator',0,1,1,1,'','Disconnects both branches together.',[{value:0,label:'Off'},{value:1,label:'On'}]);
 let heat=[0,0],blown=[false,false],elapsed=0,lastClock=0;
 const currents=v=>[v.kitchen,v.study].map((count,i)=>v.main&&!blown[i]&&count?12/(24/count+.05):0);
 const result=finish(v=>{const amps=currents(v);blades.forEach(blade=>blade.rotation.z=v.main?0:.8);handle.position.set(-1.1+.12*Math.cos(v.main?0:.8),.47+.12*Math.sin(v.main?0:.8),.09);
 branches.forEach(({bridge,lamps},i)=>{bridge.visible=!blown[i];bridge.material.emissive.setHex(0xff3300);bridge.material.emissiveIntensity=heat[i]*2;lamps.forEach(({bulb,localSwitch},j)=>{const active=j<(i?v.study:v.kitchen);localSwitch.rotation.z=active?0:-.7;bulb.material.emissive.setHex(0xffcb72);bulb.material.emissiveIntensity=amps[i]>0&&active?1.3:0;});});
 return {state:{heat:[...heat],blown:[...blown],elapsed,currents:amps,total:amps[0]+amps[1],complete:elapsed>=10},readings:[r('Your result',blown[0]&&!blown[1]&&amps[1]>0?'Kitchen off · study still lit':blown[1]&&!blown[0]&&amps[0]>0?'Study off · kitchen still lit':!v.main?'Main isolator open · both branches off':blown.every(Boolean)?'Both fuses melted · both branches off':amps.some(value=>value>0)?'Connected lamps lit':'No lamps drawing current'),r('Kitchen branch',blown[0]?'Fuse melted · no current':amps[0].toFixed(3)+' A'),r('Study branch',blown[1]?'Fuse melted · no current':amps[1].toFixed(3)+' A'),r('Supply current',(amps[0]+amps[1]).toFixed(3)+' A','Sum of the two branch currents.'),r('Observed time',elapsed.toFixed(2)+' / 10 s'),r('Fuse heat',heat.map(value=>(value*100).toFixed(0)+'%').join(' / '),'Normalized kitchen / study temperature rise; same illustrative thermal rule as the fuse lesson.')]};},{animated:true});
 function advance(seconds){if(!Number.isFinite(seconds)||seconds<=0)return result.update();const dt=Math.min(seconds,Math.max(0,10-elapsed)),amps=currents(result.getState().values);
 for(let i=0;i<2;i++){const target=amps[i]*amps[i],trip=!blown[i]&&target>1?4*Math.log((target-heat[i])/(target-1)):Infinity;if(trip<=dt){blown[i]=true;heat[i]=Math.exp(-(dt-trip)/4);}else heat[i]=target+(heat[i]-target)*Math.exp(-dt/4);}
 elapsed+=dt;return result.update();}
 result.advance=advance;result.animate=clock=>{const dt=Math.max(0,clock-lastClock);lastClock=clock;return advance(dt);};result.reset=()=>{heat=[0,0];blown=[false,false];elapsed=0;lastClock=0;};
 result.actions=[{label:'Replace blown fuses',run(){blown.forEach((value,i)=>{if(value){blown[i]=false;heat[i]=0;}});elapsed=0;result.update();}},{label:'Restart observation',run(){elapsed=0;}}];
 result.playback={description:'Observe ten simulated seconds. Each branch heats its own fuse; the other branch can keep working after a fuse opens.',label:'Run the circuit check',stepLabel:'Observe one second',advance,step:()=>advance(1),complete:()=>elapsed>=10,blocked:()=>false};
 result.resultPart={id:'system',context:'system',label:'Inspect both circuits',available:()=>true};return result;
}

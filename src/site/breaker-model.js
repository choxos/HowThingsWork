import * as THREE from 'three';
import {houseModel,reading as r} from './house-model-kit.js';
export function createBreakerModel(){
 const m=houseModel('Circuit breaker'),{part,box,cylinder,disk,sphere,rod,tube,ring,control,finish}=m;
 const circuit=part('circuit','Protected circuit','An electromagnet releases a spring-loaded contact when the current is too large.');
 const frame=part('frame','Insulating body and bearings','Fixed guides keep the moving core and contact arm aligned.',[0,0,0],circuit);box([1.8,1.7,.12],[0,1.05,-.2],'cream',frame);
 const supply=part('supply','12 V teaching supply','Provides the energy for the lamp and sensing coil.',[-1.25,.65,0],circuit);box([.3,.6,.24],[0,0,0],'leaf',supply);rod([-.06,.19,.14],[.06,.19,.14],.012,'ink',supply);rod([0,.13,.14],[0,.25,.14],.012,'ink',supply);rod([-.06,-.18,.14],[.06,-.18,.14],.012,'ink',supply);
 const magnet=part('magnet','Series electromagnet','The coil carries the load current. Its magnetic pull grows strongly as current increases.',[-.4,1.1,0],circuit);
 const winding=Array.from({length:181},(_,i)=>[-.3+.6*i/180,.13*Math.cos(i*Math.PI/10),.13*Math.sin(i*Math.PI/10)]);tube(winding,.025,'clay',magnet);
 for(const x of [-.31,.31]){const guide=cylinder(.16,.04,[x,0,0],'ink',magnet);guide.rotation.z=Math.PI/2;}
 const plunger=part('plunger','Moving iron core and retaining hook','A strong magnetic pull slides the core left and withdraws the retaining hook.',[0,0,0],circuit);rod([-.62,1.1,0],[.24,1.1,0],.055,'metal',plunger);rod([.24,1.1,0],[.24,1.5,0],.035,'metal',plunger);rod([.24,1.5,0],[.44,1.5,0],.035,'metal',plunger);
 const returnSpring=part('return-spring','Core return spring','The spring pushes the core back when the coil loses current.',[-.10,1.1,0],circuit);const springPoints=Array.from({length:81},(_,i)=>[.33*i/80,.08*Math.cos(i*Math.PI/10),.08*Math.sin(i*Math.PI/10)]);const spring=tube(springPoints,.012,'gold',returnSpring);box([.04,.24,.2],[-.11,1.1,0],'ink',frame);
 const contact=part('contact','Moving contact arm','The arm pivots upward after the hook releases it.',[-.35,1.4,0],circuit);rod([0,0,0],[.7,0,0],.035,'gold',contact);sphere(.06,[.7,0,0],'metal',contact);disk(.07,.1,[0,0,0],'ink',contact);
 const fixed=part('fixed-contact','Fixed contact and outlet','The stationary terminal touches the moving contact only while the arm is closed.',[.35,1.295,0],circuit);sphere(.045,[0,0,0],'metal',fixed);rod([0,0,0],[.43,0,0],.03,'gold',fixed);
 const openingSpring=part('opening-spring','Contact opening spring','A torsion spring stores energy while the contact is latched.',[-.35,1.4,.08],circuit);ring(.11,.014,[0,0,0],'metal',openingSpring);rod([-.1,0,0],[-.1,-.18,0],.014,'metal',openingSpring);const springLeg=part('spring-arm','Spring bearing leg','The spring leg follows the pivoting contact.',[0,0,0],openingSpring);rod([.1,0,0],[.28,0,0],.014,'metal',springLeg);
 const arc=part('arc-chute','Arc splitter plates','Real contact separation can produce an arc. Metal plates cool and divide it; arcing is not simulated.',[.53,1.65,-.05],circuit);for(let i=0;i<5;i++)box([.31,.025,.28],[0,i*.08,0],'metal',arc);
 const load=part('load','Protected lamp','The light goes out when the moving contact separates.',[1.3,.65,0],circuit);cylinder(.14,.18,[0,-.2,0],'metal',load);const bulb=sphere(.23,[0,.02,0],'cream',load);bulb.material=bulb.material.clone();bulb.material.transparent=true;bulb.material.opacity=.3;bulb.material.depthWrite=false;rod([-.06,-.26,0],[-.06,.02,0],.01,'gold',load);rod([-.06,.02,0],[.06,.02,0],.015,'gold',load);rod([.06,.02,0],[.06,-.26,0],.01,'gold',load);const glow=new THREE.PointLight(0xffc779,0,2);glow.position.set(0,.1,.3);load.add(glow);
 const wiring=part('wiring','Series current path','Supply → coil → contact → lamp → supply. The sensing coil has no separate power source.',[0,0,0],circuit);
 const wire=points=>points.slice(1).forEach((p,i)=>rod(points[i],p,.025,'clay',wiring));
 wire([[-1.25,.95,0],[-1.25,1.23,0],[-.7,1.23,0]]);wire([[-.1,1.23,0],[-.05,1.23,.2],[-.35,1.4,.2],[-.35,1.4,0]]);wire([[.78,1.295,0],[1.65,1.295,0],[1.65,.39,0],[1.36,.39,0]]);wire([[1.24,.39,0],[1.24,.12,0],[-1.25,.12,0],[-1.25,.35,0]]);
 control('resistance','Lamp resistance',6,48,.5,24,'Ω','Lower resistance draws more current from the fixed 12 V supply.');
 control('supply','Supply switch',0,1,1,1,'','The magnetic trip is driven by circuit current.',[{value:0,label:'Off'},{value:1,label:'On'}]);
 let pull=0,angle=0,tripped=false,elapsed=0,lastClock=0;
 const result=finish(v=>{const current=v.supply&&angle<1e-8?12/(v.resistance+.2):0,overload=current>1.5;
 plunger.position.x=-pull;spring.scale.x=(.33-pull)/.33;contact.rotation.z=angle;springLeg.rotation.z=angle;bulb.material.emissive.setHex(0xffc779);bulb.material.emissiveIntensity=current?1.3:0;glow.intensity=current?2:0;
 return {state:{current,pull,angle,tripped,elapsed,overload,complete:tripped&&angle>=.85&&pull<=1e-8},readings:[r('Your result',angle>0?'Contacts separated · lamp off':tripped?'Latch released · contact opening':overload?'Overload · run to watch the trip':current?'Contacts closed · lamp lit':'Supply off'),r('Mechanism',angle>=.85?'Open and latched off':tripped?'Opening spring lifts the arm':pull>0?'Core withdraws the retaining hook':'Hook holds the arm closed'),r('Circuit current',current.toFixed(3)+' A'),r('Time observed',elapsed.toFixed(2)+' s'),r('Trip model','Magnetic release above 1.5 A','Illustrative threshold and slowed motion, not a rated breaker or trip curve.')]};},{animated:true});
 function advance(dt){if(!Number.isFinite(dt)||dt<=0)return result.update();let remaining=dt;
 while(remaining>1e-9){const step=Math.min(remaining,.01),v=result.getState().values,current=v.supply&&angle<1e-8?12/(v.resistance+.2):0;
 if(!tripped){pull=Math.max(0,Math.min(.3,pull+(current>1.5?.3/.7:-.6)*step));if(pull>=.22){tripped=true;}}
 else{angle=Math.min(.85,angle+1.7*step);pull=Math.max(0,pull-.6*step);}
 elapsed+=step;remaining-=step;result.update();if(tripped&&angle>=.85&&pull===0)break;}
 return result.update();}
 result.advance=advance;result.animate=clock=>{const dt=Math.max(0,clock-lastClock);lastClock=clock;return advance(dt);};
 result.reset=()=>{pull=0;angle=0;tripped=false;elapsed=0;lastClock=0;};
 result.actions=[{label:'Reset the breaker',run(){pull=0;angle=0;tripped=false;result.update();}}];
 result.playback={label:'Run the circuit',stepLabel:'Advance the trip mechanism',advance,step:()=>advance(.2),complete:()=>result.getState().complete,blocked:()=>false};
 result.resultPart={id:'contact',context:'circuit',label:'Inspect the open contact',available:()=>angle>0};return result;
}

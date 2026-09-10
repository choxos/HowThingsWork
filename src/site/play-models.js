import * as THREE from 'three';
import {houseModel,reading as r} from './house-model-kit.js';
const TAU=2*Math.PI;
export function createPlayModel(name){
 if(!['Friction-drive toy','Games controller','Virtual reality headset','Unicycle'].includes(name))return null;
 const m=houseModel(name),{root,part,box,cylinder,disk,sphere,ring,rod,gear,control,finish,covers}=m;
 if(name==='Friction-drive toy'){
  const body=part('body','Toy body','Supports the wheels and geared flywheel.');const shell=box([2,.55,.9],[0,.75,0],'clay',body);covers.push(shell);box([2,.12,.8],[0,.43,0],'leaf',body);
  const axle=part('axle','Driven wheel axle','Rolling without slip relates wheel speed to forward speed.');rod([-.65,.35,-.65],[-.65,.35,.65],.045,'metal',axle);
  const wheels=[];for(const x of [-.65,.65])for(const z of [-.55,.55]){const wheel=part(`wheel-${x}-${z}`,'Wheel','Ground contact turns this wheel.',[x,.35,z]);disk(.3,.1,[0,0,0],'ink',wheel);rod([-.23,0,.07],[.23,0,.07],.025,'gold',wheel);wheels.push(wheel);}
  const transmission=part('transmission','Speed-increasing gears','The smaller gear and flywheel turn faster than the large axle gear.');const large=gear(.24,24,[-.65,.35,0],'gold',transmission),small=gear(.12,12,[-.29,.35,0],'metal',transmission);
  const flywheel=part('flywheel','Flywheel','Stores rotational kinetic energy.',[-.29,.35,-.25]);disk(.28,.15,[0,0,0],'blue',flywheel);rod([-.22,0,.1],[.22,0,.1],.022,'cream',flywheel);
  control('speed','Rolling speed',0,1,.05,.3,'m/s','Wheel radius 0.03 m; the 2:1 speed ratio follows the shown tooth counts.');control('inertia','Flywheel inertia',.00001,.0001,.00001,.00004,'kg·m²','Inertia is an input property; the drawing does not identify a specific material.');
  return finish((v,t)=>{const wheelOmega=v.speed/.03,omega=2*wheelOmega;wheels.forEach(w=>w.rotation.z=-wheelOmega*t);large.rotation.z=-wheelOmega*t;small.rotation.z=flywheel.rotation.z=omega*t;flywheel.scale.x=flywheel.scale.y=Math.sqrt(v.inertia/.00004);const energy=.5*v.inertia*omega**2;return{state:{omega,energy},readings:[r('Wheel angular speed',`${wheelOmega.toFixed(2)} rad/s`),r('Flywheel angular speed',`${omega.toFixed(2)} rad/s`),r('Stored flywheel energy',`${energy.toFixed(4)} J`),r('Scope','Imposed rolling speed; coast-down and friction losses are not solved')]};},{animated:true});
 }
 if(name==='Games controller'){
  const body=part('body','Controller body','Supports input devices and electronics.');box([2.2,.8,.45],[0,.7,0],'leaf',body);
  const joystick=part('joystick','Joystick gimbal','Two perpendicular sensing axes report stick position.',[-.6,.95,.3]);ring(.23,.04,[0,0,0],'metal',joystick);const stick=part('stick','Control stick','Tilts in two directions.',[0,0,0],joystick);rod([0,0,0],[0,.4,0],.045,'ink',stick);sphere(.12,[0,.4,0],'clay',stick);
  const sensors=part('sensors','Position sensors','The normalized axis readings are mapped to a game input.');for(const x of [-.85,-.35])box([.12,.2,.13],[x,.8,.3],'gold',sensors);
  const button=part('button','Action button','A switch produces a discrete input.');const key=disk(.14,.08,[.7,.85,.3],'clay',button);
  const console=part('console','Console and display','Software receives input and updates its state.');box([1.5,1,.08],[0,1.9,-.3],'ink',console);const cursor=sphere(.07,[0,1.9,-.2],'gold',console);
  control('x','Stick X',-1,1,.1,0,'');control('y','Stick Y',-1,1,.1,0,'');control('deadzone','Radial dead zone',0,.5,.05,.15,'','Inputs inside this radius map to zero; outside it, the remaining radius is rescaled.');control('pressed','Action button',0,1,1,0,'','',[{value:0,label:'Released'},{value:1,label:'Pressed'}]);
  return finish(v=>{const length=Math.hypot(v.x,v.y),magnitude=length>v.deadzone?(Math.min(1,length)-v.deadzone)/(1-v.deadzone):0,x=length?magnitude*v.x/length:0,y=length?magnitude*v.y/length:0;stick.rotation.z=-v.x*.4;stick.rotation.x=v.y*.4;cursor.position.set(x*.6,1.9+y*.35,-.2);cursor.scale.setScalar(v.pressed?1.6:1);key.position.z=v.pressed?.27:.3;return{state:{x,y,magnitude},readings:[r('Mapped X / Y',`${x.toFixed(2)} / ${y.toFixed(2)}`),r('Action input',v.pressed?'Pressed':'Released'),r('Input processing',magnitude?'Outside dead zone':'Inside dead zone'),r('Scope','Position mapping demonstration, not a running game or a particular console protocol')]};});
 }
 if(name==='Virtual reality headset'){
  const headset=part('headset','Headset and displays','Separate eye views create binocular depth cues.',[0,1.3,0]);const shell=box([1.6,.75,.6],[0,0,0],'leaf',headset);covers.push(shell);
  for(const side of [-1,1]){const optics=part(side<0?'left-eye':'right-eye',side<0?'Left-eye optics':'Right-eye optics','A display and lens deliver the corresponding eye view.',[side*.38,0,0],headset);box([.55,.5,.035],[0,0,-.2],'blue',optics);ring(.23,.045,[0,0,.31],'metal',optics);}
  const imu=part('imu','Inertial measurement unit','Gyroscopes measure angular rate; orientation estimation integrates measurements and uses other references.',[0,.43,0],headset);box([.23,.1,.2],[0,0,0],'gold',imu);
  const scene=part('scene','Stationary world target','The reference target stays in world coordinates.');sphere(.2,[0,1.3,-1.5],'clay',scene);
  const rays=part('view-rays','View-direction markers','The displayed viewing direction responds after the selected illustrative latency.');const ray=rod([0,1.3,0],[0,1.3,-1.25],.02,'gold',rays);
  control('rate','Head yaw rate',-60,60,5,20,'°/s');control('seconds','Elapsed turn time',0,2,.05,.5,'s');control('latency','Display latency',0,100,5,20,'ms');control('ipd','Eye separation',55,75,1,64,'mm','Optical groups move with the illustrative eye-separation setting.');
  return finish(v=>{const actual=v.rate*v.seconds,shown=v.rate*Math.max(0,v.seconds-v.latency/1000),error=actual-shown;headset.rotation.y=actual*Math.PI/180;rays.rotation.y=shown*Math.PI/180;for(const p of m.parts.filter(p=>['left-eye','right-eye'].includes(p.id)))p.object.position.x=(p.id==='left-eye'?-1:1)*.38*v.ipd/64;return{state:{actual,shown,error},readings:[r('Head yaw',`${actual.toFixed(1)}°`),r('Delayed view yaw',`${shown.toFixed(1)}°`),r('Angular lag',`${error.toFixed(2)}°`),r('Scope','Constant-rate yaw and pure delay; stereo rendering and sensor fusion are not running')]};});
 }
 const wheel=part('wheel','Wheel and fixed cranks','A typical unicycle couples the cranks directly to the wheel.',[0,.65,0]);ring(.6,.07,[0,0,0],'ink',wheel);for(let i=0;i<12;i++){const a=i*TAU/12;rod([0,0,0],[.57*Math.cos(a),.57*Math.sin(a),0],.009,'metal',wheel);}rod([0,0,0],[.23,0,.16],.025,'gold',wheel);rod([0,0,0],[-.23,0,-.16],.025,'gold',wheel);box([.18,.04,.2],[.23,0,.2],'leaf',wheel);box([.18,.04,.2],[-.23,0,-.2],'leaf',wheel);
 const frame=part('frame','Fork and saddle','The fork supports the axle while the saddle supports the rider.');for(const z of [-.13,.13])rod([0,.65,z],[0,1.4,z],.035,'clay',frame);rod([0,1.4,0],[0,1.9,0],.04,'metal',frame);box([.5,.13,.25],[0,1.95,0],'leaf',frame);
 control('cadence','Pedaling cadence',-60,60,5,20,'rpm');control('radius','Wheel radius',.2,.4,.01,.3,'m');
 return finish((v,t)=>{const omega=v.cadence*TAU/60,speed=omega*v.radius;wheel.rotation.z=-omega*t;wheel.scale.setScalar(v.radius/.3);wheel.position.y=.05+.6*v.radius/.3;frame.position.y=wheel.position.y-.65;return{state:{omega,speed},readings:[r('Wheel speed',`${v.cadence} rpm`),r('Rolling speed',`${speed.toFixed(2)} m/s`),r('Distance per revolution',`${(TAU*v.radius).toFixed(2)} m`),r('Scope','Direct drive and no slip; rider balance and contact dynamics are not simulated')]};},{animated:true});
}

import * as THREE from 'three';
import {houseModel,reading as r} from './house-model-kit.js';

export function createTweezersModel(){
 const m=houseModel('Tweezers'),{part,box,control,finish}=m;
 const length=60,rigidity=16000,thickness=.6,openGap=12,blockWidth=4,scale=.05,restHeight=.12,liftHeight=1.1,friction=.3;
 const compliance=(x,a)=>(x<=a?x*x*(3*a-x):a*a*(3*x-a))/(6*rigidity);
 const system=part('system','Tweezers, block and tray','Squeeze the connected spring arms to grip the block, lift it, then release it into the tray.');
 const tool=part('tool','Connected spring tweezers','The whole tool moves upward. Its two continuous arms share a welded heel.',[0,0,0],system);tool.rotation.z=-Math.PI/2;
 const joint=part('joint','Joined heel / effective fulcrum','The joined heel supports both spring arms. There is no pivot pin.',[0,0,0],tool);box([.15,.12,.25],[.015,0,0],'ink',joint);
 const armParts=[];
 for(const side of [-1,1]){
  const id=side===1?'right':'left',arm=part(id+'-arm',side===1?'Right spring arm':'Left spring arm','A continuous elastic arm bends under finger pressure and the opposing tip reaction.',[0,0,0],tool);
  const geometry=new THREE.BufferGeometry(),positions=new Float32Array(61*4*3),indices=[];
  for(let i=0;i<60;i++)for(let j=0;j<4;j++){const a=i*4+j,b=i*4+(j+1)%4,c=a+4,d=b+4;indices.push(a,b,c,b,d,c);}
  indices.push(0,2,1,0,3,2,240,241,242,240,242,243);geometry.setAttribute('position',new THREE.BufferAttribute(positions,3));geometry.setIndex(indices);
  const mesh=new THREE.Mesh(geometry,new THREE.MeshToonMaterial({color:0xb4c5b0}));arm.add(mesh);
  const tip=part(id+'-tip',side===1?'Right gripping pad':'Left gripping pad','This short flat pad makes contact with one side of the block. Its load is represented at the end of the spring arm.',[0,0,0],arm);box([.2,thickness*scale,.22],[.1,0,0],'gold',tip);
  const finger=part(id+'-finger',side===1?'Right finger effort':'Left finger effort','Finger effort lies between the joined heel and the gripping tip.',[0,0,0],arm);box([.18,.09,.28],[0,0,0],'blue',finger);
  const arrow=new THREE.ArrowHelper(new THREE.Vector3(0,-side,0),new THREE.Vector3(),.3,0x83b4c1,.08,.045);arm.add(arrow);
  const reaction=new THREE.ArrowHelper(new THREE.Vector3(0,-side,0),new THREE.Vector3(),.15,0xe3b45e,.055,.035);arm.add(reaction);
  armParts.push({side,mesh,tip,finger,arrow,reaction});
 }
 const block=part('block','Small practice block','The block is carried only while the two pads contact it and the modeled friction can support its weight.',[0,restHeight,0],system);box([blockWidth*scale,.2,.16],[0,0,0],'clay',block);
 const tray=part('tray','Receiving tray','Supports the block at rest and catches it after release.',[0,0,0],system);box([.95,.06,.65],[0,-.01,0],'leaf',tray);for(const x of [-.46,.46])box([.03,.12,.65],[x,.035,0],'leaf',tray);for(const z of [-.31,.31])box([.95,.12,.03],[0,.035,z],'leaf',tray);
 const weight=part('weight','Block weight','Gravity acts downward. The gold tip forces create friction that can support this weight.',[0,0,0],system),weightArrow=new THREE.ArrowHelper(new THREE.Vector3(0,-1,0),new THREE.Vector3(),.25,0xce825f,.065,.04);weight.add(weightArrow);
 control('operation','Run action',0,1,1,0,'','Choose whether to pick up the block or release it.',[{value:0,label:'Grip and lift the block'},{value:1,label:'Release into the tray'}]);
 control('squeeze','Squeeze the arms',0,1,.01,0,'','Applies a fraction of your chosen force to each arm. Released objects fall when you advance or run the action.');
 control('fingerPosition','Effort position',.3,.85,.05,.55,'fraction','Distance from the joined heel divided by spring-arm length.');
 control('effort','Force on each arm',.5,6,.1,3,'N','At full squeeze. Some force bends the spring arms before the tips contact the block.');
 control('lift','Lift the tweezers',0,1,.01,0,'','The block follows only if the grip can support it. Lifting with open tips leaves it behind.');
 control('mass','Block mass',2,30,1,10,'g','Changes the weight that friction must support; block size stays the same.');
 let held=false,falling=false,blockY=restHeight,heldOffset=0,velocity=0,elapsed=0,accumulator=0,progress=null,lastClock=0,lastShape='';
 const result=finish(v=>{
  const center=restHeight+liftHeight*v.lift,overlap=held||Math.abs(blockY-center)<.2-1e-8,force=v.effort*v.squeeze,a=length*v.fingerPosition;
  const requiredDeflection=(openGap-(overlap?blockWidth:0))/2,normal=Math.max(0,(force*compliance(length,a)-requiredDeflection)/compliance(length,length));
  const inward=x=>force*compliance(x,a)-normal*compliance(x,length),gap=Math.max(overlap?blockWidth:0,openGap-2*inward(length));
  const normalOnBlock=overlap?normal:0,capacity=2*friction*normalOnBlock,weightN=v.mass*.001*9.81,canHold=overlap&&normalOnBlock>0&&capacity>=weightN;
  if(held&&!canHold){held=false;falling=blockY>restHeight+1e-9;velocity=0;}
  if(!held&&canHold&&(!falling||velocity<1e-9)){held=true;falling=false;heldOffset=blockY-center;}
  if(held){blockY=Math.max(restHeight,center+heldOffset);heldOffset=blockY-center;velocity=0;}
  if(falling&&elapsed>0){
   // The gravity/friction ratio is physical; the fall clock is slowed for inspection.
   const acceleration=3*(1-capacity/weightN),duration=acceleration<0?Math.min(elapsed,velocity/-acceleration):elapsed;blockY-=velocity*duration+.5*acceleration*duration*duration;velocity=Math.max(0,velocity+acceleration*duration);
   if(blockY<=restHeight){blockY=restHeight;velocity=0;falling=false;}
  }
  elapsed=0;
  tool.position.y=(length+2)*scale+center;block.position.y=blockY;weight.position.set(.2,blockY,.14);weightArrow.setLength(.15+v.mass*.009,.065,.04);
  const signature=[force,a,normal].join(':');
  if(signature!==lastShape){lastShape=signature;for(const {side,mesh} of armParts){const p=mesh.geometry.attributes.position;for(let i=0;i<=60;i++)for(let j=0;j<4;j++){const outside=j===1||j===2?1:-1;p.setXYZ(i*4+j,i*scale,side*(thickness/2+openGap*i/(2*length)-inward(i))*scale+outside*thickness*scale/2,j<2?-.11:.11);}p.needsUpdate=true;mesh.geometry.computeVertexNormals();mesh.geometry.computeBoundingSphere();mesh.geometry.computeBoundingBox();}}
  for(const {side,tip,finger,arrow,reaction} of armParts){const fingerY=side*(thickness/2+openGap*a/(2*length)-inward(a))*scale;tip.position.set(length*scale,side*(thickness+gap)*scale/2,0);finger.position.set(a*scale,fingerY+side*.08,0);arrow.position.set(a*scale,fingerY+side*(.28+force*.03),.2);arrow.setLength(.16+force*.03,.065,.04);reaction.visible=normalOnBlock>0;reaction.position.set((length+2)*scale,side*(gap*scale/2+.2),.17);}
  const complete=v.operation===0?held&&v.lift===1:v.squeeze===0&&!held&&!falling&&blockY===restHeight,blocked=v.operation===0&&v.squeeze===1&&!held&&!falling;
  const status=falling?'Block released · advance to watch it fall':complete&&v.operation===1?'Block released · resting in tray':held&&v.lift===1?'Block lifted · held above tray':held?'Block gripped · ready to lift':normalOnBlock>0?'Tips touch · grip cannot support the weight':overlap?'Open tips · block in tray':'Empty tweezers · block left behind';
  return {state:{held,falling,complete,blocked,normalForce:normalOnBlock,holdingCapacity:capacity,weight:weightN,tipGap:gap,blockHeight:blockY-restHeight,forceRatio:force?normalOnBlock/force:0},readings:[r('Your result',status),r('Tip gap',gap.toFixed(2)+' mm'),r('Grip force per pad',normalOnBlock.toFixed(2)+' N'),r('Holding capacity',capacity.toFixed(3)+' N · weight '+weightN.toFixed(3)+' N'),r('Next action',complete&&v.operation===0?'Choose Release into the tray to open the arms.':falling?'Run or advance to continue the slowed fall.':blocked?'Move your fingers toward the tips, increase force, or lower the open tool over the block.':held?'Lift the whole tool while keeping the squeeze.':'Squeeze while the open tips surround the block.')]};
 });
 const update=result.update;result.update=next=>{progress=null;return update(next);};
 function advance(seconds){
  if(!Number.isFinite(seconds)||seconds<=0)return update();accumulator+=seconds;progress??={squeeze:result.getState().values.squeeze,lift:result.getState().values.lift};
  while(accumulator>=.01-1e-9){accumulator-=.01;const state=result.getState();if(state.values.operation===0){if(progress.squeeze<1)progress.squeeze=Math.min(1,progress.squeeze+.005);else if(held)progress.lift=Math.min(1,progress.lift+.0035);}else progress.squeeze=Math.max(0,progress.squeeze-.005);elapsed=.01;update(progress);if(result.getState().complete||result.getState().blocked){accumulator=0;break;}}
  return result.getState().readings;
 }
 function fresh(){held=false;falling=false;blockY=restHeight;velocity=0;heldOffset=0;progress=null;accumulator=0;elapsed=0;update({operation:0,squeeze:0,lift:0});}
 result.advance=advance;result.animate=clock=>{const dt=Math.max(0,clock-lastClock);lastClock=clock;return advance(dt);};result.reset=()=>{fresh();lastClock=0;update(result.defaults);};
 result.actions=[{label:'Return block to starting tray',part:'system',view:'front',run:fresh}];
 result.playback={label:'Run selected action',stepLabel:'Advance one step',description:'Grip and lift holds the block above the tray. Release opens the arms and lets the block fall. Pause freezes both the tool and the falling block.',advance,step:()=>advance(.2),complete:()=>result.getState().complete,blocked:()=>result.getState().blocked};
 result.followParts=['tool','joint','left-arm','right-arm','left-tip','right-tip','left-finger','right-finger','block','weight'];
 result.framingBounds=new THREE.Box3().setFromObject(result.root);result.framingBounds.max.y+=liftHeight;
 result.resultPart={id:'system',context:'system',view:'front',focusOnComplete:true,label:'Inspect the tool and block',available:()=>true};return result;
}

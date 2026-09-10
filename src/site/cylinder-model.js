import * as THREE from 'three';
import {houseModel,reading as r} from './house-model-kit.js';

export function createCylinderModel({editableKey=false}={}){
 const m=houseModel(editableKey?'Keys':'Cylinder lock'),{part,box,cylinder,disk,ring,rod,spring,control,finish,covers}=m;
 const system=part('system','Door and cylinder lock','The matching key frees a plug whose cam retracts the latch. The door opens only after the latch clears the frame.');
 const frame=part('frame','Fixed door frame and strike','The extended latch enters the opening in this stationary frame.',[0,0,0],system);
 box([.22,2.75,.36],[-1.85,1.375,0],'wood',frame);
 box([.22,1,.36],[1.45,.5,0],'wood',frame);box([.22,1.25,.36],[1.45,2.125,0],'wood',frame);
 box([3.55,.18,.36],[-.2,2.85,0],'wood',frame);
 for(const y of [1.06,1.46])box([.35,.14,.5],[1.4,y,0],'metal',frame);
 box([.09,.54,.5],[1.61,1.26,0],'metal',frame);
 const door=part('door','Hinged door','The lock, key and latch move with the door; the strike stays on the frame.',[-1.7,0,0],system);
 for(const y of [.45,2.35])cylinder(.065,.3,[0,y,0],'metal',door);
 box([2.9,.6,.14],[1.45,.36,0],'clay',door);box([2.9,.58,.14],[1.45,2.42,0],'clay',door);
 box([.16,1.55,.14],[.08,1.4,0],'clay',door);box([.16,1.55,.14],[2.82,1.4,0],'clay',door);
 const panel=box([2.58,1.48,.12],[1.45,1.4,0],'clay',door);covers.push(panel);
 const lock=part('lock','Enlarged latch assembly','The teaching cutaway exposes the pin cylinder and the connected latch drive.',[2.2,1.26,1.16],door);
 const shell=part('housing','Stationary cylinder shell','The shell holds the upper driver pins while the plug turns inside it.',[0,0,0],lock);
 const shellArc=new THREE.Mesh(new THREE.CylinderGeometry(.47,.47,1.65,48,1,true,Math.PI,Math.PI),new THREE.MeshToonMaterial({color:0x91aa7e,side:THREE.DoubleSide}));shellArc.rotation.x=Math.PI/2;shell.add(shellArc);
 for(const z of [-.85,.85])ring(.45,.035,[0,0,z],'leaf',shell);
 box([.23,.08,1.72],[0,1.22,0],'leaf',shell);for(const z of [-.84,.84])rod([0,.45,z],[0,1.22,z],.045,'leaf',shell);
 for(const x of [-.28,.28])rod([x,-.28,-1.16],[x,-.28,-.82],.045,'leaf',shell);
 const plug=part('plug','Rotating plug','The lower pins rotate with this cylinder once all five joints clear its boundary.',[0,0,0],lock);
 const plugArc=new THREE.Mesh(new THREE.CylinderGeometry(.4,.4,1.65,48,1,true,Math.PI,Math.PI),new THREE.MeshToonMaterial({color:0xf0dfaf,side:THREE.DoubleSide}));plugArc.rotation.x=Math.PI/2;plug.add(plugArc);
 rod([0,0,-1.12],[0,0,-.82],.07,'metal',plug);
 const floor=part('keyway-floor','Keyway floor','Supports the blade and stops the spring-loaded lower pins when the key is absent.',[0,0,0],plug);box([.14,.035,1.72],[0,-.3125,0],'cream',floor);
 const shear=part('shear-line','Shear line','The blue guide marks the plug boundary. Every pin joint must meet it.',[0,0,0],lock);rod([-.08,.4,-.75],[-.08,.4,.75],.012,'blue',shear);
 const key=part('key','Key blade and bow','A continuous sloping profile lifts the pins as the key slides inward.',[0,0,0],plug);
 ring(.21,.055,[0,-.13,1.23],'gold',key);box([.13,.24,.18],[0,-.17,.95],'gold',key);
 const heights=[.17,.3,.2,.34,.24],positions=heights.map((_,i)=>-.64+i*.32);
 const blade=box([1,1,1],[-.055,-.24,0],'gold',key);blade.rotation.y=-Math.PI/2;
 let profile=[],lastProfile='';
 function setProfile(pattern,selectedPin,cutError){
  const cuts=heights.map((h,i)=>editableKey?Math.max(.025,Math.min(.5,h+(i===selectedPin-1?cutError:0))):h+(pattern===1&&i===2?.11:pattern===2?(i%2?.09:-.08):0));
  const signature=cuts.join(',');if(signature===lastProfile)return;lastProfile=signature;
  profile=[[-.92,-.055],[-.87,.015],...positions.flatMap((z,i)=>[[z-.055,cuts[i]],[z+.055,cuts[i]]]),[.9,.12]];
  const shape=new THREE.Shape();shape.moveTo(-.92,-.055);shape.lineTo(.9,-.055);for(const [z,h] of [...profile].reverse())shape.lineTo(z,h);shape.closePath();
  blade.geometry.dispose();blade.geometry=new THREE.ExtrudeGeometry(shape,{depth:.11,bevelEnabled:false});
 }
 function contact(z){if(z<profile[0][0]||z>profile.at(-1)[0])return -.055;for(let i=1;i<profile.length;i++){const [b,hb]=profile[i],[a,ha]=profile[i-1];if(z<=b)return ha+(hb-ha)*(z-a)/(b-a);}return 0;}
 const pins=part('pins','Five spring-loaded pin stacks','Every joint must align, including the one under a wrong cut.',[0,0,0],lock);
 const pinParts=heights.map((h,i)=>{
  const z=positions[i],length=.64-h;
  const stack=part('pin-'+(i+1),'Pin stack '+(i+1),'The blue mark shows the plug boundary. The pin joint must meet it before turning.',[0,0,z],pins);rod([.085,.4,-.1],[.085,.4,.1],.009,'blue',stack);
  const lowerGroup=part('key-pin-'+(i+1),'Lower key pin '+(i+1),'Rests on the key and rotates with the plug.',[0,0,0],stack);const lower=cylinder(.045,length,[0,0,0],'clay',lowerGroup);
  const driver=part('driver-pin-'+(i+1),'Upper driver pin '+(i+1),'Its bottom must clear the plug before rotation.',[0,0,0],stack);cylinder(.045,.45,[0,.225,0],'gold',driver);
  const coil=part('pin-spring-'+(i+1),'Pin spring '+(i+1),'Keeps the pin pair in contact with the key and restores the obstruction on withdrawal.',[0,0,0],stack);const winding=spring([0,0,0],.05,.3,5,coil,.0075);
  return {lower,lowerGroup,driver,coil,winding,length};
 });
 const drive=part('latch-drive','Cam, follower and spring latch','The cam roller slides vertically in its follower while pulling the latch sideways.',[0,0,0],lock);
 const cam=part('cam','Plug cam and roller','The roller runs inside a vertical slot. Its horizontal movement pulls the latch inward.',[0,0,-1.1],drive);
 rod([0,0,0],[0,.34,0],.055,'gold',cam);disk(.065,.16,[0,.34,-.04],'metal',cam);
 const latch=part('bolt','Sliding latch and slotted follower','The slot allows vertical roller travel while transferring its horizontal travel to the latch.',[0,0,0],drive);
 for(const x of [-.09,.09])box([.045,.605,.08],[x,.1925,-1.16],'metal',latch);
 for(const y of [-.11,.495])box([.225,.045,.08],[0,y,-1.16],'metal',latch);
 rod([.11,.08,-1.16],[.46,.08,-1.16],.04,'metal',latch);rod([.46,.08,-1.16],[.46,0,-1.16],.045,'metal',latch);
 box([.48,.2,.25],[.69,0,-1.16],'metal',latch);rod([.42,-.28,-1.16],[.48,0,-1.16],.035,'metal',latch);
 const guide=part('guide','Latch guides and spring seat','These fixed guides constrain the bolt to slide toward and away from the frame.',[0,0,0],drive);
 for(const x of [.46,.7]){box([.08,.07,.4],[x,-.16,-1.16],'leaf',guide);box([.08,.07,.4],[x,.16,-1.16],'leaf',guide);}
 box([.08,.16,.25],[-.04,-.28,-1.16],'leaf',guide);
 const returnSpring=part('return-spring','Latch return spring','Retraction compresses this spring. Releasing the key lets it extend the latch and return the cam.',[0,-.28,-1.16],drive);const coil=spring([0,0,0],.065,.42,8,returnSpring,.005);coil.rotation.z=-Math.PI/2;
 control('operation','Run action',0,1,1,0,'','Run the selected sequence, or adjust each stage yourself.',[{value:0,label:'Unlock and open'},{value:1,label:'Close and relock'}]);
 if(editableKey){
  control('selectedPin','Cut to inspect',1,5,1,3,'','Count from the blade tip toward the bow. Withdraw before selecting a different cut.');
  control('cutError','Change selected cut',-.2,.2,.02,0,'model units','Withdraw the key before editing. Positive values raise the cut; negative values lower it.');
 }else control('keyPattern','Key pattern',0,2,1,0,'','Withdraw the key before choosing another pattern.',[{value:0,label:'Matching key'},{value:1,label:'One incorrect cut'},{value:2,label:'Different key'}]);
 control('insertion','Key insertion',0,1,.01,0,'','The key can slide only when the plug is at its starting angle.');
 control('turn','Attempt to turn',0,80,1,0,'°','Aligned pins permit turning. The 80° stop keeps this cam away from dead center.');
 control('door','Open the door',0,65,1,0,'°','Retract the latch past the frame first. Close the door with the latch retracted.');
 let lastDoor=0,lastTurn=0,lastInsertion=0,lastKey=0,lastClock=0,lastSelectedPin=3,lastCutError=0,progress={};
 const result=finish(v=>{
  if(lastTurn>0)v.insertion=lastInsertion;
  if(lastInsertion>0){if(editableKey){v.selectedPin=lastSelectedPin;v.cutError=lastCutError;}else v.keyPattern=lastKey;}
  setProfile(v.keyPattern,v.selectedPin,v.cutError);const shift=2*(1-v.insertion),offsets=positions.map((z,i)=>contact(z-shift)-heights[i]),ready=offsets.every(o=>Math.abs(o)<1e-6);
  const turn=ready?v.turn:0,angle=turn*Math.PI/180,travel=.34*Math.sin(angle),clear=.93-travel<.7;
  if(!clear&&v.door!==lastDoor)v.door=lastDoor;
  plug.rotation.z=angle;key.position.z=shift;cam.rotation.z=angle;latch.position.x=-travel;coil.userData.setLength(.42-travel);door.rotation.y=-v.door*Math.PI/180;
  pinParts.forEach(({lower,lowerGroup,driver,coil,winding,length},i)=>{const joint=.4+offsets[i];lowerGroup.rotation.z=angle;lower.position.y=joint-length/2;driver.position.y=turn>0?.4:joint;coil.position.y=driver.position.y+.45;winding.userData.setLength(1.2-coil.position.y);});
  lastDoor=v.door;lastTurn=turn;lastInsertion=v.insertion;lastKey=v.keyPattern;lastSelectedPin=v.selectedPin;lastCutError=v.cutError;
  const blocked=v.insertion===1&&!ready&&(v.operation===0||v.door>0),complete=v.operation===0?v.door===65:v.door===0&&turn===0&&v.insertion===0;
  return {state:{unlocked:ready,turn,boltTravel:travel,boltClear:clear,pinOffsets:offsets,doorAngle:v.door,complete,blocked},readings:[r('Your result',v.operation===1&&complete?'Door secured · key removed':v.door>0?'Door open · passage clear':clear?'Latch clear · ready to open':'Door held closed by the latch'),r('Pin alignment',ready?'All five joints aligned':offsets.filter(o=>Math.abs(o)>=1e-6).length+' of 5 joints away from the shear line'),r('Actual plug turn',turn+'°'),r('Latch retraction',Math.round(travel/(.34*Math.sin(80*Math.PI/180))*100)+'%'),r('Door opening',v.door+'°'),r('Next action',v.operation===1&&complete?'Choose Unlock and open to start another cycle.':v.door>0?'Retract the latch before closing; return the key upright before withdrawing.':clear?'Open the door.':ready?'Turn the key to pull the latch clear.':blocked?'Return the turn control to zero, withdraw this key, then compare a different pattern.':'Insert the key and watch the five pin joints.')]};
 },{animated:true});
 const update=result.update;result.update=next=>{progress={};return update(next);};
 function advance(seconds){
  if(!Number.isFinite(seconds)||seconds<=0)return update();
  let remaining=seconds;const closing=result.getState().values.operation===1;
  if(closing&&result.getState().turn===0)update({turn:0});
  const prepare=[...(result.getState().turn>0?[]:[['insertion',1,.5]]),['turn',80,40]],steps=closing?[...(result.getState().doorAngle>0?[...prepare,['door',0,40]]:[]),['turn',0,40],['insertion',0,.5]]:[...prepare,['door',65,40]];
  for(const [key,end,rate] of steps){
   const state=result.getState();if(key==='turn'&&end>0&&!state.unlocked)break;if(key==='door'&&!state.boltClear)break;
   const start=progress[key]??state.values[key],duration=Math.abs(end-start)/rate,used=Math.min(remaining,duration);
   progress[key]=used===duration?end:start+Math.sign(end-start)*used*rate;update({[key]:progress[key]});remaining-=used;if(remaining<=1e-9)break;
  }
  return update();
 }
 result.advance=advance;result.animate=clock=>{const dt=Math.max(0,clock-lastClock);lastClock=clock;return advance(dt);};
 result.reset=()=>{lastDoor=lastTurn=lastInsertion=lastKey=lastClock=0;lastSelectedPin=3;lastCutError=0;progress={};update(result.defaults);};
 result.controls.find(c=>c.key==='insertion').enabledWhen=()=>result.getState().turn===0;
 for(const key of editableKey?['selectedPin','cutError']:['keyPattern'])result.controls.find(c=>c.key===key).enabledWhen=v=>v.insertion===0;
 result.playback={label:'Run selected action',stepLabel:'Advance the lock',description:'Opening inserts the key, turns the cam and opens the door. Relocking closes the door with the latch retracted, returns the cam, then withdraws the key.',advance,step:()=>advance(.15),complete:()=>result.getState().complete,blocked:()=>result.getState().blocked};
 result.resultPart={id:'system',context:'system',focusOnComplete:true,label:'Inspect the doorway',available:()=>true};return result;
}

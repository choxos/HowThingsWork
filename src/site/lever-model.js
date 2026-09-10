import * as THREE from 'three';
import {houseModel,reading as r} from './house-model-kit.js';

export function createLeverModel(){
 const m=houseModel('Lever lock'),{part,box,cylinder,disk,ring,rod,tube,control,finish,covers}=m,rad=Math.PI/180;
 const system=part('system','Door and lever lock','The key must lift every gate before its drive shoulder can slide the deadbolt.');
 const frame=part('frame','Fixed frame and strike','The extended bolt crosses the door gap and enters this fixed strike.',[0,0,0],system);
 box([.18,2.7,.3],[-1.85,1.35,0],'wood',frame);box([3.75,.18,.3],[-.05,2.75,0],'wood',frame);
 for(const [y,h] of [[.5,1],[2.03,1.3]])box([.2,h,.3],[1.7,y,0],'wood',frame);
 for(const y of [1.05,1.35])box([.35,.1,.35],[1.65,y,0],'metal',frame);box([.08,.4,.35],[1.87,1.2,0],'metal',frame);
 const door=part('door','Hinged door','The lock moves with this door; the frame does not.',[-1.7,0,0],system);
 for(const y of [.4,2.3])cylinder(.06,.25,[0,y,0],'metal',door);
 for(const y of [.35,2.35])box([3.15,.55,.12],[1.57,y,0],'clay',door);
 for(const x of [.08,3.07])box([.16,1.5,.12],[x,1.35,0],'clay',door);
 covers.push(box([2.85,1.45,.1],[1.57,1.35,0],'clay',door));
 const lock=part('lock','Enlarged lever-lock assembly','A conventional fixed-pivot study with three lever plates and a bolt-mounted stump.',[2, .3,.4],door);
 const housing=part('case','Case and fixed pivots','The case supports the lever pivot, key bearing and straight bolt guides.',[0,0,0],lock);
 box([2.1,1.45,.08],[.05,.57,-.35],'leaf',housing);rod([-.8,.75,-.34],[-.8,.75,.52],.055,'metal',housing);
 for(const x of [-.55,1.05]){box([.08,.065,.22],[x,1.055,-.2],'leaf',housing);box([.08,.065,.22],[x,.745,-.2],'leaf',housing);}
 ring(.09,.025,[0,0,-.3],'metal',housing);
 const bolt=part('bolt','Deadbolt, stump and drive slot','The stump crosses the gates. The wide drive slot lets the key arrange the levers before sliding the bolt.',[0,0,0],lock);
 box([1.65,.2,.16],[.65,.9,-.2],'metal',bolt);const stump=part('stump','Bolt stump','This peg travels with the deadbolt and must fit through all three gates.',[.45,.9,0],bolt);rod([0,0,-.18],[0,0,.5],.035,'gold',stump);
 const talon=part('talon','Bolt drive slot','A key-driven roller runs freely across the slot, then presses a side to move the bolt. The open bottom lets it leave.',[0,0,0],bolt);
 for(const x of [-.075,.675])box([.08,.7,.09],[x,.35,.65],'metal',talon);
 box([.83,.065,.09],[.3,.73,.65],'metal',talon);const bracket=part('bolt-bracket','Bolt drive bracket','Connects the front drive slot to the bolt behind the plates, passing above the return springs.',[0,0,0],talon);rod([.3,.76,.65],[.3,1.55,.65],.035,'metal',bracket);rod([.3,1.55,.65],[.3,1.55,-.2],.035,'metal',bracket);rod([.3,1.55,-.2],[.3,.9,-.2],.035,'metal',bracket);
 const key=part('key','Three-shouldered teaching key','Rounded shoulders keep each lever raised during the bolt-driving part of a full turn.',[0,0,0],lock);
 rod([0,0,-.3],[0,0,1.25],.045,'gold',key);ring(.2,.045,[0,0,1.48],'gold',key);rod([0,0,1.25],[0,-.18,1.48],.035,'gold',key);
 const drive=part('key-drive','Key drive shoulder and roller','This rigid arm turns with the key and presses the sides of the bolt slot.',[0,0,.65],key);
 rod([0,0,0],[.6,0,0],.04,'gold',drive);disk(.035,.12,[.6,0,0],'gold',drive);
 const pack=part('lever-pack','Three spring-held levers','All three narrow gates must admit the same moving stump.',[0,0,0],lock);
 const target=[.06,.12,.18],pivot=new THREE.Vector2(-.8,.75),edge=-.32,halfGate=.057,stumpRadius=.035;
 const radii=target.map(a=>.8*Math.sin(a)+.75*Math.cos(a)+edge),cams=[],levers=[],springParts=[],pathGuides=[];
 function polygon(points){const s=new THREE.Shape();points.forEach(([x,y],i)=>i?s.lineTo(x,y):s.moveTo(x,y));s.closePath();return s;}
 function extrude(shape,parent,color,depth=.06){const mesh=new THREE.Mesh(new THREE.ExtrudeGeometry(shape,{depth,bevelEnabled:false}),new THREE.MeshToonMaterial({color}));parent.add(mesh);return mesh;}
 for(let i=0;i<3;i++){
  const z=-.08+i*.2,a=target[i],c=Math.cos(a),s=Math.sin(a),left=[.65*c+.15*s,.15*c-.65*s],right=[1.25*c+.15*s,.15*c-1.25*s];
  const lever=part('tumbler-'+(i+1),'Lever tumbler '+(i+1),'Its pivot is fixed. Its lower land touches one key shoulder; the narrow gate joins two resting pockets.',[-.8,.75,z],pack);
  const l=left[0]+.085,rr=right[0]-.085,line=x=>left[1]-(x-left[0])*Math.tan(a),w=halfGate/Math.cos(a);
  const hole=polygon([[left[0]-.085,-.26],[l,-.26],[l,line(l)-w],[rr,line(rr)-w],[rr,-.26],[right[0]+.085,-.26],[right[0]+.085,.26],[rr,.26],[rr,line(rr)+w],[l,line(l)+w],[l,.26],[left[0]-.085,.26]]);
  const shape=polygon([[-.1,edge],[1.48,edge],[1.48,.34],[-.1,.34]]);shape.holes.push(hole);extrude(shape,lever,i===1?0xe3b45e:0xce825f);disk(.055,.08,[0,0,.03],'metal',lever);levers.push(lever);
  const gate=part('gate-'+(i+1),'Gate '+(i+1),'The blue edges identify the narrow passage; the larger end pockets let the lever drop after the bolt moves.',[0,0,0],lever);
  for(const sign of [-1,1])rod([l,line(l)+sign*w,.071],[rr,line(rr)+sign*w,.071],.006,'blue',gate);
  const guide=part('bolt-path-'+(i+1),'Bolt path guide '+(i+1),'This blue reference stays at the bolt height so you can compare the gate with the route the stump needs.',[0,0,0],lever);rod([.65,.15,.085],[1.25,.15,.085],.005,'blue',guide);const marker=ring(.035,.005,[1.25,.15,.085],'blue',guide);pathGuides.push({guide,marker});
  const shoulder=part('key-shoulder-'+(i+1),'Key shoulder '+(i+1),'Its curved edge remains in contact with this lever land during bolt travel.',[0,0,z-.01],key);cams.push({parent:shoulder,mesh:null});
  const leaf=part('spring-'+(i+1),'Lever return spring '+(i+1),'A leaf spring is fixed to the case and bears on the lever, restoring its resting angle.',[0,0,0],pack);
  box([.1,.08,.09],[-.9,1.25,z+.03],'leaf',housing);springParts.push({parent:leaf,mesh:tube([[-.9,1.25,z+.03],[-.3,1.35,z+.03],[.3,1.1,z+.03]],.012,'metal',leaf),z:z+.03});
 }
 let pattern=-1;
 function setPattern(next){if(next===pattern)return;pattern=next;cams.forEach((cam,i)=>{const radius=radii[i]+(next===1&&i===1?.075:next===2?-.07:0),points=[[0,0]];for(let d=-90;d<=120;d+=2)points.push([radius*Math.cos(d*rad),radius*Math.sin(d*rad)]);if(cam.mesh){cam.mesh.geometry.dispose();cam.mesh.material.dispose();cam.parent.remove(cam.mesh);}cam.mesh=extrude(polygon(points),cam.parent,0xe3b45e,.08);cam.radius=radius;});}
 function angles(degrees){const phase=(degrees-90)*rad;return cams.map(cam=>{function gap(a){const normal=a+Math.PI/2,relative=normal-phase;let best=Math.max(Math.cos(relative+Math.PI/2),Math.cos(relative-2*Math.PI/3),0);for(let k=-1;k<=1;k++)if(relative+k*2*Math.PI>=-Math.PI/2&&relative+k*2*Math.PI<=2*Math.PI/3)best=1;return cam.radius*best-(.8*Math.sin(a)+.75*Math.cos(a)+edge);}if(gap(0)<=0)return 0;let lo=0,hi=.5;for(let j=0;j<28;j++){const a=(lo+hi)/2;if(gap(a)>0)lo=a;else hi=a;}return(lo+hi)/2;});}
 function clearGate(angles){return angles.every((a,i)=>{const delta=target[i]-a;return [.75,1.15].every(x=>Math.abs(x*Math.sin(delta)+.15*Math.cos(delta)-.15)+stumpRadius<halfGate);});}
 control('operation','Run action',0,1,1,0,'','Choose a full opening or closing sequence.',[{value:0,label:'Unlock and open'},{value:1,label:'Close and relock'}]);
 control('keyPattern','Key pattern',0,2,1,0,'','Withdraw the key before changing its shoulders.',[{value:0,label:'Matching key'},{value:1,label:'One shoulder too high'},{value:2,label:'Shoulders too low'}]);
 control('insertion','Key insertion',0,1,.01,0,'','Insert fully before turning; withdraw only after a full turn.');
 control('turn','Turn the key',0,360,.1,0,'°','A full turn lifts the levers, slides the bolt and lets the springs lower the levers. Reverse the turn to relock.');
 control('door','Open the door',0,65,1,0,'°','The deadbolt must clear the fixed frame before the door moves.');
 let lastTurn=0,lastInsertion=0,lastPattern=0,lastDoor=0,travel=0,blocked=false,lastClock=0,progress={};
 const result=finish(v=>{
  if(lastTurn>0&&lastTurn<360)v.insertion=lastInsertion;if(lastInsertion>0)v.keyPattern=lastPattern;setPattern(v.keyPattern);
  const requested=v.insertion===1?v.turn:lastTurn;blocked=false;
  for(let angle=lastTurn;Math.abs(requested-angle)>1e-8;){const direction=Math.sign(requested-angle),boundary=(direction>0?Math.floor(angle/90)+1:Math.ceil(angle/90)-1)*90,next=angle+direction*Math.min(1,Math.abs(requested-angle),Math.abs(boundary-angle)),phase=(next-90)*rad,x=.6*Math.cos(phase),y=.6*Math.sin(phase);let boltX=-travel;if(y>=-1e-9)boltX=Math.max(x-.6,Math.min(x,boltX));if(Math.abs(boltX+travel)>1e-8&&!clearGate(angles(next))){blocked=true;break;}travel=Math.max(0,Math.min(.6,-boltX));angle=next;lastTurn=next;}
  v.turn=lastTurn;const raised=v.insertion===1?angles(lastTurn):[0,0,0],ready=clearGate(raised),boltClear=1.475-travel<1.15;
  blocked ||= v.insertion===1&&Math.abs(lastTurn-180)<1e-8&&!ready;
  if(!boltClear&&v.door!==lastDoor)v.door=lastDoor;door.rotation.y=-v.door*rad;bolt.position.x=-travel;key.rotation.z=(lastTurn-90)*rad;key.position.z=2*(1-v.insertion);
  levers.forEach((lever,i)=>{lever.rotation.z=raised[i];pathGuides[i].guide.rotation.z=-raised[i];pathGuides[i].marker.position.x=1.25-travel;const spring=springParts[i],x=pivot.x+.95*Math.cos(raised[i])-.34*Math.sin(raised[i]),y=pivot.y+.95*Math.sin(raised[i])+.34*Math.cos(raised[i]);const replacement=new THREE.TubeGeometry(new THREE.CatmullRomCurve3([new THREE.Vector3(-.9,1.25,spring.z),new THREE.Vector3(-.3,1.42,spring.z),new THREE.Vector3(x,y,spring.z)]),32,.012,8,false);spring.mesh.geometry.dispose();spring.mesh.geometry=replacement;});
  lastInsertion=v.insertion;lastPattern=v.keyPattern;lastDoor=v.door;const complete=v.operation===0?v.door===65:v.door===0&&travel<1e-8&&v.insertion===0;
  return {state:{turn:lastTurn,boltTravel:travel,boltClear,leverAngles:raised,gatesClear:ready,doorAngle:v.door,blocked,complete},readings:[r('Your result',complete&&v.operation===1?'Door secured · key removed':v.door>0?'Door open · passage clear':boltClear?'Deadbolt clear · ready to open':'Door held closed by the deadbolt'),r('Lever gates',ready?'All three passages clear':'At least one gate blocks bolt travel'),r('Bolt retraction',Math.round(travel/.6*100)+'%'),r('Key turn',lastTurn+'°'),r('Next action',blocked?'The key shoulder leaves a gate obstructed. Reverse to the starting position, withdraw and compare a matching key.':v.door>0?'Choose Close and relock.':boltClear?'Finish the turn, withdraw the key and open the door.':v.insertion<1?'Insert the key fully.':'Turn the key and watch its shoulders lift the levers.')]};
 });
 const update=result.update;result.update=next=>{progress={};return update(next);};
 function advance(seconds){if(!Number.isFinite(seconds)||seconds<=0)return update();let remaining=seconds;const closing=result.getState().values.operation===1,steps=closing?[...(lastDoor>0&&!result.getState().boltClear?[['insertion',1,.6],['turn',360,100]]:[]),['door',0,40],...(lastDoor>0||lastTurn>0||travel>1e-8?[['insertion',1,.6],['turn',0,100]]:[]),['insertion',0,.6]]:[...(lastTurn<360?[['insertion',1,.6],['turn',360,100]]:[]),['insertion',0,.6],['door',65,40]];for(const [key,end,rate] of steps){const state=result.getState(),start=progress[key]??state.values[key],duration=Math.abs(end-start)/rate,used=Math.min(remaining,duration);progress[key]=used===duration?end:start+Math.sign(end-start)*used*rate;update({[key]:progress[key]});remaining-=used;if(result.getState().blocked||remaining<=1e-9)break;}return result.getState().readings;}
 result.advance=advance;result.animate=clock=>{const dt=Math.max(0,clock-lastClock);lastClock=clock;return advance(dt);};result.reset=()=>{lastTurn=lastInsertion=lastPattern=lastDoor=travel=lastClock=0;progress={};update(result.defaults);};
 result.controls.find(c=>c.key==='insertion').enabledWhen=()=>[0,360].includes(result.getState().turn);result.controls.find(c=>c.key==='keyPattern').enabledWhen=v=>v.insertion===0;
 result.playback={label:'Run selected action',stepLabel:'Advance the lock',description:'The selected key lifts the levers, moves the bolt, then lets the springs return. Opening reveals a clear doorway; closing ends with the key removed.',advance,step:()=>advance(.12),complete:()=>result.getState().complete,blocked:()=>result.getState().blocked};
 result.resultPart={id:'system',context:'system',focusOnComplete:true,label:'Inspect the doorway',available:()=>true};return result;
}

import * as THREE from 'three';
import {houseModel,reading as r} from './house-model-kit.js';

export function createZipperModel(){
 const m=houseModel('Zipper'),{part,box,rod,ring,control,finish,covers}=m,rad=Math.PI/180;
 const garment=part('garment','Separating jacket front','Two separate garment panels are fastened by seating the bottom pin and closing the tooth chain.');
 const body=part('body','Separate garment panels','Each panel is sewn to its own zipper tape. No seam connects the two lower edges.',[0,0,0],garment);
 const fastening=part('zipper','Complete separating zipper','The slider stays on the box side when the insertion pin is withdrawn.',[0,0,0],garment);
 const tapes=part('tapes','Continuous fabric tapes','Each beaded inner edge carries a row of teeth; its outer edge is sewn to one garment panel.',[0,0,0],fastening);
 const teeth=part('teeth','Staggered nesting teeth','The projection of one tooth fits the recess of the next tooth on the opposite tape.',[0,0,0],fastening);
 const sides=[-1,1],count=12,pitch=.24,start=.42,rootX=.31,curveRadius=.35,branchAngle=Math.PI/4,curveLength=curveRadius*branchAngle;
 function path(s,spread){
  if(s<=0)return {x:0,y:s,angle:0};
  let angle=Math.min(branchAngle,s/curveRadius),x=curveRadius*(1-Math.cos(angle)),y=curveRadius*Math.sin(angle);
  if(s>curveLength){const radius=.9+.7*spread;angle=Math.max(0,branchAngle-(s-curveLength)/radius);x+=radius*(Math.cos(angle)-Math.cos(branchAngle));y+=radius*(Math.sin(branchAngle)-Math.sin(angle))+Math.max(0,s-curveLength-radius*branchAngle);}
  return {x,y,angle};
 }
 function headSurface(upper,front){
  const points=[],indices=[],columns=24,rows=6;
  for(let j=0;j<=rows;j++)for(let i=0;i<=columns;i++){const u=.19+.24*i/columns,w=(front?0:-.08)+.08*j/rows,bump=.14*Math.sin(Math.PI*i/columns)**2*Math.cos(Math.PI*w/.16)**2;points.push(u,bump+(upper?.05:-.05),w);}
  for(let j=0;j<rows;j++)for(let i=0;i<columns;i++){const a=j*(columns+1)+i,b=a+1,c=a+columns+1,d=c+1;indices.push(...(upper?[a,c,b,b,c,d]:[a,b,c,b,d,c]));}
  const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(points,3));geometry.setIndex(indices);geometry.computeVertexNormals();return geometry;
 }
 const upperHead=[headSurface(true,false),headSurface(true,true)],lowerHead=[headSurface(false,false),headSurface(false,true)],toothParts=[];
 function headRim(front){
  const geometry=new THREE.BufferGeometry(),points=[],corners=front?[[.19,0],[.19,.08],[.43,.08],[.43,0]]:[[.43,0],[.43,-.08],[.19,-.08],[.19,0]];
  for(let i=0;i<3;i++){const [u,w]=corners[i],[v,z]=corners[i+1];points.push(u,-.05,w,v,-.05,z,u,.05,w,v,-.05,z,v,.05,z,u,.05,w);}
  geometry.setAttribute('position',new THREE.Float32BufferAttribute(points,3));geometry.computeVertexNormals();return geometry;
 }
 const rims=[headRim(false),headRim(true)],sectionPoints=Array.from({length:25},(_,i)=>new THREE.Vector2(.19+.24*i/24,.05+.14*Math.sin(Math.PI*i/24)**2));sectionPoints.push(...sectionPoints.map(p=>new THREE.Vector2(p.x,p.y-.1)).reverse());const sectionGeometry=new THREE.ShapeGeometry(new THREE.Shape(sectionPoints));
 for(const side of sides)for(let i=0;i<count;i++){
  const ordinal=2*i+(side===-1?1:2),tooth=part('tooth-'+ordinal,'Tooth '+ordinal,'This tooth stays attached to its tape while its head nests with the neighboring teeth.',[0,0,0],teeth),tone=side===-1?'gold':'cream';
  tooth.scale.x=-side;
  const jaws=part('jaws-'+ordinal,'Tape jaws '+ordinal,'Two jaws grip the tape edge; the projecting neck connects them to the locking head.',[0,0,0],tooth);
  for(const z of [-.035,.035])box([.1,.1,.025],[-.025,0,z],tone,jaws);
  box([.165,.1,.09],[.1075,0,0],tone,jaws);
  const head=part('head-'+ordinal,'Nesting head '+ordinal,'Its raised face and hollow opposite face allow sequential nesting, with small teaching clearances.',[0,0,0],tooth);
  const projection=part('projection-'+ordinal,'Locking projection '+ordinal,'The raised face enters the recess in the next tooth along the joined chain.',[0,0,0],head);
  const recess=part('recess-'+ordinal,'Receiving recess '+ordinal,'The hollow face receives the projection of the preceding tooth.',[0,0,0],head);
  const material=new THREE.MeshToonMaterial({color:side===-1?0xe3b45e:0xf0dfaf,side:THREE.DoubleSide});
  for(let half=0;half<2;half++){const top=new THREE.Mesh(upperHead[half],material),bottom=new THREE.Mesh(lowerHead[half],material),rim=new THREE.Mesh(rims[half],material);projection.add(top);recess.add(bottom);head.add(rim);if(half)covers.push(top,bottom,rim);}
  const section=part('head-section-'+ordinal,'Head cross-section '+ordinal,'Look inside removes the front half of the head. This cut face exposes the solid wall between the projection and receiving recess.',[0,0,0],head);section.add(new THREE.Mesh(sectionGeometry,new THREE.MeshToonMaterial({color:side===-1?0xe3b45e:0xf0dfaf,side:THREE.DoubleSide})));
  toothParts.push({tooth,ordinal,side,s:start+i*pitch+(side===1?pitch/2:0)});
 }
 const slider=part('slider','Y-channel slider','Upward travel toward the separated rows closes the chain behind this slider.',[0,0,0],fastening);
 function extrusion(points,z,depth,color,parent){const shape=new THREE.Shape();points.forEach(([x,y],i)=>i?shape.lineTo(x,y):shape.moveTo(x,y));shape.closePath();const mesh=new THREE.Mesh(new THREE.ExtrudeGeometry(shape,{depth,bevelEnabled:false}),new THREE.MeshToonMaterial({color,side:THREE.DoubleSide}));mesh.position.z=z;parent.add(mesh);return mesh;}
 const outline=[[-.46,-.25],[.46,-.25],[.46,.1],[.82,.68],[.18,.68],[0,.42],[-.18,.68],[-.82,.68],[-.46,.1]];
 const back=part('back-plate','Rear slider plate','Supports one face of the guided teeth.',[0,0,0],slider);extrusion(outline,-.13,.03,0xb4c5b0,back);
 const front=part('front-plate','Removable front slider plate','Together the two plates contain the teeth; Look inside removes this plate for inspection.',[0,0,0],slider);covers.push(extrusion(outline,.1,.03,0xb4c5b0,front));
 const wedge=part('wedge','Upper separating wedge','Its central tip enters between the rows during opening.',[0,0,0],slider);extrusion([[0,.42],[.175,.68],[-.175,.68]],-.1,.2,0xce825f,wedge);
 const walls=part('walls','Paired closing guides','Their converging faces guide the tape jaws toward the joined path; the middle slot lets fabric pass.',[0,0,0],slider);
 for(const side of sides){
  function guidePoint(s,offset){const a=Math.max(0,Math.min(branchAngle,s/curveRadius)),d=Math.max(0,s-curveLength);return [side*(rootX+curveRadius*(1-Math.cos(a))+d*Math.sin(a)+offset*Math.cos(a)),s<0?s:curveRadius*Math.sin(a)+d*Math.cos(a)-offset*Math.sin(a)];}
  const points=Array.from({length:37},(_,i)=>guidePoint(-.25+i*(curveLength+.6)/36,.083));points.push(...Array.from({length:37},(_,i)=>guidePoint(curveLength+.35-i*(curveLength+.6)/36,.135)));
  for(const z of [-.1,.025])extrusion(points,z,.075,0xb4c5b0,walls);
 }
 const pullMount=part('pull-mount','Pull-tab hinge and bridge','Carries the pull from the tab to the connected slider body.',[0,0,0],slider);rod([0,.56,.12],[0,.24,.18],.035,'metal',pullMount);rod([-.12,.24,.18],[.12,.24,.18],.03,'metal',pullMount);
 const pull=part('pull','Hinged pull tab','Tilting the tab changes the handhold, not the amount of chain already joined.',[0,.24,.18],slider);
 for(const x of [-.1,.1])rod([x,0,0],[x,-.3,0],.03,'gold',pull);const bow=ring(.1,.03,[0,-.3,0],'gold',pull);bow.scale.y=1.25;covers.push(pullMount,pull);
 const stops=part('stops','Travel stops','The retaining box stops downward travel. The upper stops limit closing travel.',[0,0,0],fastening);
 const bottom=part('bottom-connector','Bottom pin and retaining box','Lower the slider to the box, guide the free pin through its empty channel, and seat the pin before closing.',[0,0,0],fastening);
 const retainingBox=part('retaining-box','Retaining box','The box belongs to the left tape. Its open upper socket receives the removable insertion pin.',[0,0,0],bottom);
 box([.88,.04,.24],[0,-.1,0],'metal',retainingBox);
 for(const x of [-.42,.42])box([.04,.2,.24],[x,.02,0],'metal',retainingBox);
 box([.8,.2,.035],[0,.02,-.1025],'metal',retainingBox);
 covers.push(box([.8,.2,.035],[0,.02,.1025],'metal',retainingBox));
 box([.59,.2,.17],[-.105,.02,0],'metal',retainingBox);
 const boxPin=part('box-pin','Fixed box pin','This pin remains fixed in the retaining box and keeps the lowered slider on the left tape.',[0,0,0],bottom);
 box([.065,.4,.09],[-rootX,.12,0],'gold',boxPin);
 const insertionPin=part('insertion-pin','Removable insertion pin','This free-side pin enters downward through the slider into the retaining box. Withdraw it only after unzipping fully.',[0,0,0],bottom);
 box([.065,.4,.09],[0,0,0],'gold',insertionPin);
 const stopAngle=.15/curveRadius,stopReach=(rootX+curveRadius*(1-Math.cos(stopAngle))-.05*Math.sin(stopAngle))/Math.cos(stopAngle);
 const topStops=sides.map(side=>{const object=part(side===-1?'left-stop':'right-stop',side===-1?'Left upper stop':'Right upper stop','This wider member meets its partner when the slider reaches the closing end.',[0,0,0],stops);object.scale.x=-side;const block=new THREE.Mesh(new THREE.BoxGeometry(stopReach+.075,.1,.16),new THREE.MeshToonMaterial({color:0xb4c5b0}));block.position.x=(stopReach-.075)/2;object.add(block);return {side,object};});
 const cloth=[],cords=[],stitches=[];
 function ribbon(parent,color){const geometry=new THREE.BufferGeometry(),vertices=new Float32Array(65*2*3),indices=[];for(let i=0;i<64;i++){const a=i*2;indices.push(a,a+1,a+2,a+1,a+3,a+2);}geometry.setAttribute('position',new THREE.BufferAttribute(vertices,3));geometry.setIndex(indices);const mesh=new THREE.Mesh(geometry,new THREE.MeshToonMaterial({color,side:THREE.DoubleSide}));parent.add(mesh);return mesh;}
 for(const side of sides){
  cloth.push({side,panel:ribbon(body,side===-1?0xce825f:0x91aa7e),tape:ribbon(tapes,0xf0dfaf)});
  const cord=new THREE.Mesh(new THREE.BufferGeometry(),new THREE.MeshToonMaterial({color:0xe3b45e}));tapes.add(cord);cords.push(cord);
  const line=new THREE.LineSegments(new THREE.BufferGeometry(),new THREE.LineBasicMaterial({color:0x374736}));tapes.add(line);stitches.push(line);
 }
 control('operation','Run action',0,1,1,0,'','Run the complete bottom-connection and slider sequence.',[{value:0,label:'Fasten the jacket'},{value:1,label:'Separate the jacket'}]);
 control('alignment','Bring the sides together',0,1,.01,0,'','Align the free pin above the slider. Sideways movement is available only with the pin fully withdrawn.');
 control('insertion','Seat the bottom pin',0,1,.01,0,'','Guide the pin down through the lowered slider into the box. Unzip fully before withdrawing it.');
 control('closure','Close the zipper',0,1,.01,0,'','Move upward to close the chain; downward to open it.');
 control('spread','Open tape spread',0,1,.05,.65,'','Changes the curve of the loose tapes outside the slider. Joined teeth remain nested.');
 control('pullAngle','Pull-tab angle',0,70,5,35,'°','Turn off Look inside to see the hinged handhold. Tilting it does not change closure.');
 let lastShape='',lastClock=0,progress=null,lastClosure=0,lastInsertion=0;
 const result=finish(v=>{
  if(v.closure>0&&(v.insertion<1||v.alignment<1)){if(lastClosure>0){v.insertion=1;v.alignment=1;}else v.closure=0;}
  if(v.insertion>0&&v.alignment<1){if(lastInsertion>0)v.alignment=1;else v.insertion=0;}
  lastClosure=v.closure;lastInsertion=v.insertion;
  const position=.37+3.23*v.closure,lift=(1-v.insertion)*1.3,gap=(1-v.alignment)*1.3,signature=[v.closure,v.spread,v.insertion,v.alignment].join(':');
  function tapePoint(s,side){const p=path(s+(side===1?lift:0)-position,v.spread);return {...p,x:side*(rootX+p.x)+(side===1?gap:0),y:position+p.y};}
  const pin=tapePoint(.12,1);insertionPin.position.set(pin.x,pin.y,0);insertionPin.rotation.z=-pin.angle;
  slider.position.y=position;pull.rotation.x=-v.pullAngle*rad;
  if(signature!==lastShape){
   lastShape=signature;
   for(const {tooth,side,s} of toothParts){const p=tapePoint(s,side);tooth.position.set(p.x,p.y,0);tooth.rotation.z=-side*p.angle;}
   for(const {side,object} of topStops){const p=tapePoint(3.75,side);object.position.set(p.x,p.y,0);object.rotation.z=-side*p.angle;}
   cloth.forEach(({side,panel,tape},index)=>{
    const pp=panel.geometry.attributes.position,tp=tape.geometry.attributes.position,points=[],seam=[];
    for(let i=0;i<=64;i++){
     const s=.32+3.58*i/64,p=tapePoint(s,side),x=p.x,y=p.y,c=Math.cos(p.angle),sn=Math.sin(p.angle),outerX=x+side*.2*c,outerY=y-.2*sn;
     tp.setXYZ(i*2,x,y,0);tp.setXYZ(i*2+1,outerX,outerY,0);pp.setXYZ(i*2,outerX,outerY,-.012);pp.setXYZ(i*2+1,x+side*.95,y,-.03);points.push(new THREE.Vector3(x+side*.025*c,y-.025*sn,0));
     if(i<64){seam.push(new THREE.Vector3(x+side*.155*c,y-.155*sn,.012),new THREE.Vector3(x+side*.155*c-side*.018*sn,y-.155*sn+.018*c,.012));}
    }
    for(const mesh of [panel,tape]){mesh.geometry.attributes.position.needsUpdate=true;mesh.geometry.computeVertexNormals();mesh.geometry.computeBoundingSphere();mesh.geometry.computeBoundingBox();}
    cords[index].geometry.dispose();cords[index].geometry=new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points),64,.018,6,false);stitches[index].geometry.dispose();stitches[index].geometry=new THREE.BufferGeometry().setFromPoints(seam);
   });

  }
  const seated=v.insertion===1&&v.alignment===1,joined=seated?Math.max(0,toothParts.filter(t=>t.s<=position).length-1):0,complete=v.operation===0?v.closure===1:v.closure===0&&v.insertion===0&&v.alignment===0;
  const status=v.closure===1?'Jacket fastened · chain closed':v.closure>0?'Jacket partly fastened':v.insertion===1?'Bottom pin seated · ready to zip':v.insertion>0?'Pin passing through slider · not seated':v.alignment===1?'Pin aligned above slider':'Jacket sides completely separated';
  const next=v.operation===0?(v.alignment<1?'Bring the free pin above the empty slider channel.':v.insertion<1?'Seat the pin fully so the first teeth line up.':v.closure<1?'Pull the slider upward to join the rows.':'Choose Separate the jacket to reverse the full sequence.'):(v.closure>0?'Lower the slider all the way to the retaining box.':v.insertion>0?'Withdraw the pin upward through the slider.':v.alignment>0?'Move the free garment side away.':'The slider and box stay with the left garment side.');
  return {state:{closure:v.closure,insertion:v.insertion,alignment:v.alignment,joinedLinks:joined,totalLinks:2*count-1,complete,sliderPosition:position,pinSeated:seated},readings:[r('Your result',status),r('Bottom connector',seated?'Pin seated in retaining box':Math.round(v.insertion*100)+'% inserted'),r('Nested neighbor pairs',joined+' of '+(2*count-1)),r('Slider travel',Math.round(v.closure*100)+'%'),r('Next action',next)]};
 });
 result.controls.find(c=>c.key==='alignment').enabledWhen=v=>v.insertion===0&&v.closure===0;
 result.controls.find(c=>c.key==='insertion').enabledWhen=v=>v.alignment===1&&v.closure===0;
 result.controls.find(c=>c.key==='closure').enabledWhen=v=>v.alignment===1&&v.insertion===1;
 const update=result.update;result.update=next=>{progress=null;return update(next);};
 function advance(seconds){
  if(!Number.isFinite(seconds)||seconds<=0)return update();
  const state=result.getState();progress??={...state.values};
  const closing=state.values.operation===0,steps=closing?[['alignment',1,.45],['insertion',1,.3],['closure',1,.2]]:[['closure',0,.2],['insertion',0,.3],['alignment',0,.45]];
  for(const [key,target,rate] of steps){const distance=Math.abs(target-progress[key]),duration=distance/rate;if(seconds>=duration){progress[key]=target;seconds-=duration;}else{progress[key]+=Math.sign(target-progress[key])*seconds*rate;break;}}
  return update(progress);
 }
 result.advance=advance;result.animate=clock=>{const dt=Math.max(0,clock-lastClock);lastClock=clock;return advance(dt);};result.reset=()=>{lastClock=0;progress=null;lastClosure=0;lastInsertion=0;update(result.defaults);};
 result.playback={label:'Run selected action',stepLabel:'Advance one step',description:'Fasten: align the sides, seat the pin, then zip upward. Separate: unzip fully, withdraw the pin, then move the sides apart.',advance,step:()=>advance(.25),complete:()=>result.getState().complete,blocked:()=>false};
 result.followParts=['insertion-pin','bottom-connector','slider','wedge','walls','front-plate','back-plate','pull-mount','pull',...toothParts.flatMap(({ordinal})=>['tooth','jaws','head','projection','recess','head-section'].map(prefix=>prefix+'-'+ordinal))];
 result.resultPart={id:'garment',context:'garment',focusOnComplete:true,label:'Inspect the jacket',available:()=>true};return result;
}

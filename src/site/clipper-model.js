import * as THREE from 'three';
import {houseModel,reading as r} from './house-model-kit.js';

export function createClipperModel(){
 const m=houseModel('Nail clippers'),{part,box,cylinder,disk,rod,control,finish}=m;
 const length=2.5,postX=2.18,rear=.04,thickness=.06,edgeHeight=.14,rollerRadius=.07,camArm=.25,camDrop=.09,nailThickness=.05;
 const bend=x=>x*x*(3*length-x)/(2*length**3),slope=x=>(6*length*x-3*x*x)/(2*length**3);
 function bisect(fn,lo,hi){for(let i=0;i<45;i++){const mid=(lo+hi)/2;if(fn(mid)>0)hi=mid;else lo=mid;}return (lo+hi)/2;}
 const closedAmplitude=bisect(a=>rear+a-edgeHeight/Math.hypot(1,a*slope(length)),0,edgeHeight);
 function contact(amplitude,angle,height){
  const postTilt=Math.atan(amplitude*slope(postX)),pivotX=postX+height*Math.sin(postTilt),pivotY=-rear-amplitude*bend(postX)+height*Math.cos(postTilt),handleAngle=angle-postTilt;
  const camX=pivotX-camArm*Math.cos(handleAngle)+camDrop*Math.sin(handleAngle),camY=pivotY-camArm*Math.sin(handleAngle)-camDrop*Math.cos(handleAngle),distance=rollerRadius+thickness/2;
  let contactX=camX;
  for(let i=0;i<15;i++){const tangent=amplitude*slope(contactX);contactX=camX+distance*tangent/Math.hypot(1,tangent);}
  const tangent=amplitude*slope(contactX),normal=new THREE.Vector2(-tangent,1).normalize(),contactY=rear+amplitude*bend(contactX);
  return {amplitude,postTilt,pivotX,pivotY,handleAngle,camX,camY,contactX,contactY,normal,error:camY-contactY-distance*normal.y,gap:2*(rear+amplitude-edgeHeight/Math.hypot(1,amplitude*slope(length)))};
 }
 const postHeight=bisect(h=>contact(closedAmplitude,0,h).error,0,1);
 function geometry(squeeze){const angle=-.8*(1-squeeze),amplitude=bisect(a=>-contact(a,angle,postHeight).error,0,1);return contact(amplitude,angle,postHeight);}
 const open=geometry(0),contactSqueeze=bisect(s=>nailThickness-geometry(s).gap,0,1);
 function forceRatio(squeeze,fingerPosition){
  const lo=geometry(Math.max(0,squeeze-.0001)),hi=geometry(Math.min(1,squeeze+.0001)),arm=2.2*fingerPosition;
  return ((hi.pivotY-arm*Math.sin(hi.handleAngle)+.13*Math.cos(hi.handleAngle))-(lo.pivotY-arm*Math.sin(lo.handleAngle)+.13*Math.cos(lo.handleAngle)))/(hi.gap-lo.gap);
 }
 const system=part('system','Clipper and practice nail','A rear-joined pair of spring arms closes its edges through a handle, cam and retaining post.');
 const arms=part('spring-arms','Paired spring arms','Both arms bend along their length. Their rear join is fixed in this demonstration.',[0,0,0],system);
 const join=part('rear-joint','Joined rear end','The two strips share this supported rear attachment. The front post is not a blade hinge.',[0,0,0],arms);box([.15,.15,.43],[.015,0,0],'ink',join);
 const samples=[...new Set([...Array.from({length:49},(_,i)=>length*i/48),postX-.08,postX+.15,postX-.09,postX+.09])].sort((a,b)=>a-b);
 function blade(side){
  const group=part(side===1?'upper-blade':'lower-blade',side===1?'Upper spring blade':'Lower spring blade','A continuous bending strip with clearance for the retaining post.',[0,0,0],arms),vertices=[],indices=[];
  const holeBack=side===1?.08:.09,holeFront=side===1?.15:.09;
  const solid=(i,j)=>i>=0&&i<samples.length-1&&j>=0&&j<3&&!(samples[i]>=postX-holeBack-1e-8&&samples[i+1]<=postX+holeFront+1e-8&&j===1);
  const z=(x,j)=>[-(.2+.07*x/length),-.1,.1,.2+.07*x/length][j];
  function face(points){const n=vertices.length;vertices.push(...points);indices.push(n,n+1,n+2,n,n+2,n+3);}
  for(let i=0;i<samples.length-1;i++)for(let j=0;j<3;j++){
   if(!solid(i,j))continue;const a=samples[i],b=samples[i+1];
   const p=(x,y,k)=>[x,y,z(x,k)];
   face([p(a,1,j),p(a,1,j+1),p(b,1,j+1),p(b,1,j)]);face([p(a,-1,j),p(b,-1,j),p(b,-1,j+1),p(a,-1,j+1)]);
   if(!solid(i-1,j))face([p(a,-1,j),p(a,-1,j+1),p(a,1,j+1),p(a,1,j)]);
   if(!solid(i+1,j))face([p(b,-1,j+1),p(b,-1,j),p(b,1,j),p(b,1,j+1)]);
   if(!solid(i,j-1))face([p(b,-1,j),p(a,-1,j),p(a,1,j),p(b,1,j)]);
   if(!solid(i,j+1))face([p(a,-1,j+1),p(b,-1,j+1),p(b,1,j+1),p(a,1,j+1)]);
  }
  const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(new Float32Array(vertices.length*3),3));geometry.setIndex(indices);const mesh=new THREE.Mesh(geometry,new THREE.MeshToonMaterial({color:0xb4c5b0}));group.add(mesh);
  return {group,side,mesh,vertices};
 }
 const blades=[blade(1),blade(-1)];
 const edgeParts=blades.map(({group,side})=>{
  const edge=part(side===1?'upper-edge':'lower-edge',side===1?'Upper cutting edge':'Lower cutting edge','The sharp opposed edge cuts the narrow bridge in the practice strip.',[0,0,0],group);
  const shape=new THREE.Shape();shape.moveTo(-.08,.03);shape.lineTo(0,.03);shape.lineTo(0,-edgeHeight);shape.lineTo(-.025,-edgeHeight+.045);shape.closePath();
  const geometry=new THREE.ExtrudeGeometry(shape,{depth:.54,bevelEnabled:false});geometry.translate(0,0,-.27);const mesh=new THREE.Mesh(geometry,new THREE.MeshToonMaterial({color:0xe3b45e}));mesh.scale.y=side;edge.add(mesh);return {edge,side};
 });
 const post=part('post','Retaining post and lower head','The head bears under the lower arm. Tension in the post pulls that arm upward while the cam pushes the upper arm down.',[postX,0,0],system);
 cylinder(.052,postHeight+.07,[0,postHeight/2,0],'ink',post);cylinder(.12,.045,[0,-thickness/2-.0225,0],'gold',post);
 for(const z of [-.115,.115])box([.11,.18,.065],[0,postHeight-.015,z],'metal',post);
 disk(.05,.32,[0,postHeight,0],'gold',post);
 const handle=part('handle','Operating handle','The finger acts farther from the post than the cam contact. The post moves with the lower spring arm.',[0,0,0],system);
 box([2.1,.065,.29],[-1.25,.045,0],'clay',handle);
 const seatRadius=.055,seatAngle=Math.asin(.0125/seatRadius),seatX=Math.sqrt(seatRadius**2-.0125**2),seatShape=new THREE.Shape();
 seatShape.moveTo(-.28,.0125);seatShape.lineTo(-seatX,.0125);seatShape.absarc(0,0,seatRadius,Math.PI-seatAngle,seatAngle,true);seatShape.lineTo(.08,.0125);seatShape.lineTo(.08,.0775);seatShape.lineTo(-.28,.0775);seatShape.closePath();
 const seatGeometry=new THREE.ExtrudeGeometry(seatShape,{depth:.14,bevelEnabled:false});seatGeometry.translate(0,0,-.07);handle.add(new THREE.Mesh(seatGeometry,new THREE.MeshToonMaterial({color:0xce825f})));
 const cam=part('cam','Rounded cam heel','The rounded heel stays tangent to the bending upper arm. It is shown as a circular teaching cam.',[-camArm,-camDrop,0],handle);disk(rollerRadius,.24,[0,0,0],'gold',cam);rod([0,0,0],[.1,.12,0],.035,'clay',cam);
 const finger=part('finger','Finger effort marker','Move the blue marker toward the handle end to gain leverage.',[0,0,0],handle);box([.15,.1,.36],[0,0,0],'blue',finger);
 const nailResult=part('nail-result','Clipped nail and fragment','The retained strip has a new edge. Its detached fragment moves into the tray along an illustrative path.',[0,0,0],system);
 const cutX=length+edgeHeight*Math.sin(Math.atan(closedAmplitude*slope(length)));
 const nail=part('nail','Practice nail strip','This artificial strip has a visible thin bridge at the cutting line; it is not an anatomical nail model.',[0,0,0],nailResult);box([3.12-cutX-.035,nailThickness,.4],[(3.12+cutX+.035)/2,0,0],'cream',nail);
 const web=part('cut-bridge','Material at the cutting line','The opposed edges thin this enlarged bridge before it separates.',[cutX,0,0],nail);const webMesh=box([.07,nailThickness,.4],[0,0,0],'cream',web);
 const fragment=part('fragment','Detached nail clipping','After release, the clipping moves sideways clear of the blades before falling into the tray.',[0,0,0],nailResult);
 const fragmentShape=new THREE.Shape();fragmentShape.moveTo(cutX-.035,-.2);fragmentShape.lineTo(2.37,-.2);fragmentShape.quadraticCurveTo(2.32,-.2,2.32,0);fragmentShape.quadraticCurveTo(2.32,.2,2.37,.2);fragmentShape.lineTo(cutX-.035,.2);fragmentShape.closePath();
 const fragmentGeometry=new THREE.ExtrudeGeometry(fragmentShape,{depth:nailThickness,bevelEnabled:false});fragmentGeometry.translate(0,0,-nailThickness/2);const fragmentMesh=new THREE.Mesh(fragmentGeometry,new THREE.MeshToonMaterial({color:0xf0dfaf}));fragmentMesh.rotation.x=Math.PI/2;fragment.add(fragmentMesh);
 const holder=part('holder','Practice-strip holder','Supports the retained end so the short free edge lies between the jaws.',[3.13,0,0],nailResult);for(const side of [-1,1])box([.2,.12,.55],[0,side*.085,0],'wood',holder);for(const z of [-.25,.25])cylinder(.025,.3,[0,0,z],'metal',holder);
 const tray=part('tray','Clipping tray','Receives the fragment after it has cleared the side of the blades.',[2.42,-.68,.6],nailResult);box([.65,.06,.65],[0,0,0],'leaf',tray);for(const x of [-.31,.31])box([.04,.15,.65],[x,.065,0],'leaf',tray);for(const z of [-.31,.31])box([.65,.15,.04],[0,.065,z],'leaf',tray);
 const forces=part('force-arrows','Force directions','Blue shows finger effort; gold shows the cam push and post pull. Arrows show directions, not measured forces.',[0,0,0],system);
 const arrows=[0x83b4c1,0xe3b45e,0xe3b45e].map(color=>{const arrow=new THREE.ArrowHelper(new THREE.Vector3(0,-1,0),new THREE.Vector3(),.32,color,.075,.045);forces.add(arrow);return arrow;});
 control('squeeze','Press the lever',0,1,.01,0,'','A weak input stops at the strip. Release the handle to let the spring arms reopen.');
 control('fingerPosition','Finger distance along lever',.35,1,.05,1,'fraction','Farther from the post gives more ideal edge force for the same finger force.');
 control('effort','Finger force',1,20,1,5,'N','The ideal kinematic estimate excludes spring work and friction.');
 control('resistance','Example strip resistance',10,80,5,25,'N','An adjustable teaching threshold, not a measured nail resistance.');
 let cut=false,drop=0,progress=null,lastClock=0,lastAmplitude=-1;
 const result=finish(v=>{
  const contactForce=v.effort*forceRatio(contactSqueeze,v.fingerPosition),canCut=contactForce>=v.resistance;
  if(!cut&&!canCut&&v.squeeze>contactSqueeze)v.squeeze=contactSqueeze;
  const g=geometry(v.squeeze),ratio=forceRatio(v.squeeze,v.fingerPosition),blocked=!cut&&!canCut&&v.squeeze>=contactSqueeze-1e-7;
  if(!cut&&canCut&&g.gap<=.006)cut=true;
  if(cut)drop=Math.max(drop,Math.max(0,Math.min(1,(g.gap-nailThickness)/(open.gap-nailThickness))));
  if(g.amplitude!==lastAmplitude){
   lastAmplitude=g.amplitude;
   for(const {side,mesh,vertices} of blades){const position=mesh.geometry.attributes.position;vertices.forEach(([x,level,z],i)=>{const angle=Math.atan(g.amplitude*slope(x));position.setXYZ(i,x-side*level*thickness/2*Math.sin(angle),side*(rear+g.amplitude*bend(x))+level*thickness/2*Math.cos(angle),z);});position.needsUpdate=true;mesh.geometry.computeVertexNormals();mesh.geometry.computeBoundingSphere();}
  }
  for(const {edge,side} of edgeParts){edge.position.set(length,side*(rear+g.amplitude),0);edge.rotation.z=side*Math.atan(g.amplitude*slope(length));}
  post.position.y=-rear-g.amplitude*bend(postX);post.rotation.z=-g.postTilt;handle.position.set(g.pivotX,g.pivotY,0);handle.rotation.z=g.handleAngle;finger.position.set(-2.2*v.fingerPosition,.13,0);
  web.visible=!cut;webMesh.scale.y=Math.max(.001,Math.min(1,g.gap/nailThickness));fragment.position.set(0,-.625*Math.max(0,(drop-.55)/.45)**2,.6*Math.min(1,drop/.55));
  const fingerX=g.pivotX-2.2*v.fingerPosition*Math.cos(g.handleAngle)-.13*Math.sin(g.handleAngle),fingerY=g.pivotY-2.2*v.fingerPosition*Math.sin(g.handleAngle)+.13*Math.cos(g.handleAngle);
  arrows[0].position.set(fingerX,fingerY+.52,.3);arrows[0].setDirection(new THREE.Vector3(0,-1,0));
  arrows[1].position.set(g.contactX+g.normal.x*.32,g.contactY+g.normal.y*.32,.34);arrows[1].setDirection(new THREE.Vector3(-g.normal.x,-g.normal.y,0));
  arrows[2].position.set(postX-Math.sin(g.postTilt)*.32,post.position.y-Math.cos(g.postTilt)*.32,.34);arrows[2].setDirection(new THREE.Vector3(Math.sin(g.postTilt),Math.cos(g.postTilt),0));
  const complete=cut&&v.squeeze===0&&drop>=1-1e-8;
  return {state:{cut,drop,complete,blocked,forceRatio:ratio,outputForce:v.effort*ratio,jawGap:Math.max(0,g.gap),contactSqueeze,contact:g},readings:[r('Your result',complete?'Nail edge clipped · fragment in tray':cut?'Clipped · release to clear the fragment':blocked?'Strip held · more leverage or effort needed':'Fresh strip · ready to clip'),r('Ideal force ratio',ratio.toFixed(2)+' ×'),r('Ideal edge force now',(v.effort*ratio).toFixed(1)+' N'),r('At first contact',contactForce.toFixed(1)+' N available · '+v.resistance+' N required'),r('Next action',complete?'Load a fresh strip to compare another setting.':blocked?'Move the finger farther along the handle or increase effort, then run again.':cut?'Release the handle or run the return.':'Run the clipping action, or press the lever yourself.')]};
 },{animated:true});
 const update=result.update;result.update=next=>{progress=null;return update(next);};
 function advance(seconds){
  if(!Number.isFinite(seconds)||seconds<=0)return update();let remaining=seconds;
  for(let stage=0;stage<2&&remaining>0;stage++){
   const state=result.getState(),end=cut?0:1,start=progress??state.values.squeeze,used=Math.min(remaining,Math.abs(end-start)/.65);progress=start+Math.sign(end-start)*used*.65;
   if(Math.abs(progress-end)<1e-9)progress=end;update({squeeze:progress});remaining-=used;
   if(result.getState().blocked)break;if(progress===end)progress=null;else break;
  }
  return update();
 }
 result.advance=advance;result.animate=clock=>{const dt=Math.max(0,clock-lastClock);lastClock=clock;return advance(dt);};result.reset=()=>{cut=false;drop=0;progress=null;lastClock=0;update(result.defaults);};
 result.actions=[{label:'Load a fresh strip',part:'system',view:'front',run:()=>{cut=false;drop=0;progress=null;update({squeeze:0});}}];
 result.playback={label:'Run clipping action',stepLabel:'Advance the clipper',description:'Press, clip the example strip, and release. A weak input stops at contact so you can change the leverage or effort.',advance,step:()=>advance(.15),complete:()=>result.getState().complete,blocked:()=>result.getState().blocked};
 result.resultPart={id:'nail-result',context:'nail-result',view:'top',focusOnComplete:true,label:'Inspect the clipped result',available:()=>result.getState().cut};return result;
}

import * as THREE from 'three';
import {houseModel,reading} from './house-model-kit.js';
import {sampleBottleOpener,BOTTLE_OPENER_DEFAULTS as D,BOTTLE_OPENER_DOMAINS,BOTTLE_OPENER_CONSTANTS as C} from './bottle-opener-physics.js';

export function createBottleOpenerModel(){
 const kit=houseModel('Bottle opener'),{root,part,control,finish}=kit,system=part('system','Bottle opener','A short hooked end lifts the cap between the supporting toe and the hand.');
 function lathe(parent,profile,color,segments=168){const mesh=kit.cylinder(1,1,[0,0,0],color,parent);mesh.geometry.dispose();mesh.geometry=new THREE.LatheGeometry(profile.map(p=>new THREE.Vector2(...p)),segments);return mesh;}
 function exactBox(size,pos,color,parent){const mesh=kit.box(size,pos,color,parent);mesh.geometry.dispose();mesh.geometry=new THREE.BoxGeometry(...size);return mesh;}
 const bottle=part('bottle','Glass bottle','The neck and its bead hold the crimped crown. The bottle stays still during the lever experiment.',[0,0,0],system);
 const body=lathe(bottle,[[0,-2.2],[.64,-2.2],[.66,-2.15],[.66,-1.25],[.375,-.65],[.29,-.65],[.58,-1.3],[.58,-2.13],[0,-2.13],[0,-2.2]],'leaf');
 const neck=part('neck','Bottle neck','The narrow neck supports the retaining bead and the mouth.',[0,0,0],bottle),neckMesh=lathe(neck,[[.375,-.65],[.375,-.1],[.29,-.1],[.29,-.65],[.375,-.65]],'leaf');
 const bead=part('bead','Retaining bead and mouth','The crown skirt curls under the bulge. Its inward edge must open out before the cap can be removed.',[0,0,0],neck);
 const glassProfile=[[.375,-.1],[.375,-.08],[.41,-.055],[.415,-.03],[.402,-.005],[.385,0],[.285,0],[.29,-.1],[.375,-.1]],beadMesh=lathe(bead,glassProfile,'leaf');
 bottle.userData.explosionRigid=true;
 const crownSegments=336;
 const cap=part('cap','Crown cap','The top rocks with the opener while the attached skirt bends around the retaining bead. The release clearance is an assumed teaching threshold.',[0,0,0],system);
 const crownTop=part('crown-top','Cap top','The far upper edge receives the support force while the hook lifts the opposite skirt.',[-.4,.045,0],cap),roof=kit.cylinder(.43,.03,[.4,-.015,0],'gold',crownTop);roof.geometry.dispose();roof.geometry=new THREE.CylinderGeometry(.43,.43,.03,crownSegments);
 const liner=part('liner','Sealing liner','A thin liner bridges the cap top and the glass mouth before lifting.',[.4,-.0375,0],crownTop),linerMesh=kit.cylinder(.382,.015,[0,0,0],'cream',liner);linerMesh.geometry.dispose();linerMesh.geometry=new THREE.CylinderGeometry(.382,.382,.015,crownSegments);
 const crimps=part('retaining-crimps','Connected retaining crimps','The corrugated skirt stays joined to the cap top. Its inward return progressively bends around the glass bead, then opens at the release threshold.',[0,0,0],cap);
 const crownGeometry=new THREE.BufferGeometry(),crownPositions=new Float32Array(crownSegments*2*18);crownGeometry.setAttribute('position',new THREE.BufferAttribute(crownPositions,3));
 const crownMaterial=roof.material.clone();crownMaterial.side=THREE.DoubleSide;const crownMesh=new THREE.Mesh(crownGeometry,crownMaterial);crownMesh.frustumCulled=false;crimps.add(crownMesh);
 const crownRings=[[],[],[]];
 const opener=part('opener','Rigid second-class lever','The hook lies between the support and hand. A located support is assumed to resist sideways slipping.',[-.4,.045,0],system);
 const toolYaw=new THREE.Group(),lever=new THREE.Group();opener.add(toolYaw);toolYaw.add(lever);
 const support=part('support','Supporting toe','The lower edge rests on the far top of the cap. The ideal located contact supplies vertical and horizontal reactions.',[0,0,0],lever),supportPad=exactBox([.07,.04,.18],[.035,.02,0],'metal',support);
 for(const z of [-.1,.1])kit.rod([.035,.04,z],[.1,.14,z],.025,'metal',support);
 for(const side of [-1,1])kit.tube([[.1,.14,side*.1],[.2,.16,side*.3],[.68,.16,side*.3],[.92,.08,side*.12]],.03,'metal',lever);
 const crosspiece=kit.rod([.92,.08,-.12],[.92,.08,.12],.03,'metal',lever);
 const hook=part('hook','Cap hook','The toe fits below the near crown skirt. It rises with the rigid lever, in direct proportion to the geometric hook lift.',[0,0,0],lever);
 const hookStem=exactBox([.035,.23,.12],[.9325,-.035,0],'metal',hook),hookToe=exactBox([.105,.03,.12],[.8625,-.135,0],'metal',hook);kit.rod([.89,.08,0],[.935,.08,0],.04,'metal',hook);
 const handle=part('handle','Long handle','The chosen hand distance determines the moment arm. A longer handle trades a longer hand path for a smaller required force.',[0,0,0],lever);
 kit.rod([.92,.08,0],[1.05,0,0],.05,'metal',handle);const handleMesh=kit.box([1,.10,.23],[1.55,0,0],'clay',handle);
 const effortPoint=part('effort-point','Hand position','The hand force direction is fixed relative to vertical throughout each trial.',[3.6,0,0],handle),handDot=kit.sphere(.075,[0,0,0],'blue',effortPoint);
 opener.userData.explosionRigid=true;cap.userData.explosionRigid=true;
 const forceGuide=part('force-guide','Force directions','Blue shows the available hand force. Orange shows the actual cap force on the hook. Red shows the reaction from the ideal located support.',[0,0,0],system);
 function arrow(color){const object=new THREE.ArrowHelper(new THREE.Vector3(0,1,0),new THREE.Vector3(),1,color,.09,.055);forceGuide.add(object);return object;}
 forceGuide.userData.explosionExcluded=true;handDot.userData.explosionExcluded=true;
 const handArrow=arrow(0x397689),hookArrow=arrow(0xc27a3f),supportArrow=arrow(0xb94e3a);
 const specs={effort:['Available hand force','N',null,'Only the force needed by the current load performs work. A larger unused force reserve does not add work.'],arm:['Hand distance from support','cm',null,'The hook is 27 mm horizontally from the support before lifting. Compare hand force and travel.'],direction:['Pull direction from vertical','°',null,'Zero degrees is upward. Ninety degrees pulls sideways and supplies no initial lifting moment.'],stiffness:['Assumed resistance rise','N/mm',null,'The aggregate resistance starts at 20 N and rises with hook lift. This is a teaching load, not a measured crown rating.'],placement:['Hook placement','',[{value:0,label:'Seated below skirt'},{value:1,label:'Misses the skirt'}],'The misplaced hook sits outside the crown. The unloaded tool can turn without lifting the cap.']};
 for(const [key,[min,max,step]] of Object.entries(BOTTLE_OPENER_DOMAINS)){const [label,unit,options,help]=specs[key];control(key,label,min,max,step,D[key],unit,help,options);}
 let elapsed=0,lastClock=0,disposed=false;const format=(n,digits=2)=>n===null?'No positive lifting moment':String(Number(n.toFixed(digits)));
 function glassRadius(y){if(y>0||y<-.1)return y<-.1?.375:0;const profile=glassProfile.slice(0,6);for(let i=1;i<profile.length;i++)if(y<=profile[i][1]){const [r0,y0]=profile[i-1],[r1,y1]=profile[i];return r0+(r1-r0)*(y-y0)/(y1-y0);}return 0;}
 const result=finish(v=>{
  const s=sampleBottleOpener(v,elapsed),capAngle=s.engaged?s.angle:0,cos=Math.cos(capAngle),sin=Math.sin(capAngle);
  crownTop.rotation.z=capAngle;cap.position.y=s.capRemoval*.95;
  const rotate=(r,phi,y)=>new THREE.Vector3(-.4+(r*Math.cos(phi)+.4)*cos-(y-.045)*sin,.045+(r*Math.cos(phi)+.4)*sin+(y-.045)*cos,r*Math.sin(phi));
  function moveOut(point,radius){const current=Math.hypot(point.x,point.z);if(radius>current){const previousX=point.x;point.x*=radius/current;point.z*=radius/current;point.y+=(point.x-previousX)*Math.tan(capAngle);}return point;}
  for(let i=0;i<crownSegments;i++){
   const phi=i*2*Math.PI/crownSegments,a=rotate(.43,phi,.03),b=rotate(.435+.007*(1+Math.cos(21*phi))/2,phi,-.075),c=rotate(.39,phi,-.075);
   for(let j=0;j<4;j++){
    moveOut(b,Math.max(glassRadius(b.y)+.004,s.released&&b.y<.02?.425:0));
    moveOut(c,Math.max(glassRadius(c.y)+.0002,c.y<.02?(s.released?.418:.39+.024*s.liftFraction**2):0));
   }
   crownRings[0][i]=a;crownRings[1][i]=b;crownRings[2][i]=c;
  }
  for(let band=0;band<2;band++)for(let i=0;i<crownSegments;i++){
   const j=(i+1)%crownSegments,a=crownRings[band][i],b=crownRings[band+1][i],c=crownRings[band+1][j],d=crownRings[band][j];
   [a,b,c,a,c,d].forEach((p,k)=>crownPositions.set(p.toArray(),(band*crownSegments+i)*18+k*3));
  }
  crownGeometry.attributes.position.needsUpdate=true;crownGeometry.computeVertexNormals();crownGeometry.computeBoundingBox();crownGeometry.computeBoundingSphere();
  const withdrawal=s.openerWithdrawal*1.05;opener.position.set(-.4+withdrawal*Math.cos(s.angle),.045+withdrawal*Math.sin(s.angle),0);toolYaw.rotation.y=v.placement?-.55:0;lever.rotation.z=s.angle;
  const handDistance=s.arm*30;handleMesh.scale.x=handDistance-1.05+.15;handleMesh.position.x=(1.05+handDistance+.15)/2;effortPoint.position.x=handDistance;
  root.updateMatrixWorld(true);const inverse=system.matrixWorld.clone().invert(),position=o=>o.getWorldPosition(new THREE.Vector3()).applyMatrix4(inverse);
  const handPosition=position(effortPoint),hookPosition=lever.localToWorld(new THREE.Vector3(C.hookSpan*30,-C.hookDrop*30,0)).applyMatrix4(inverse),supportPosition=position(support);
  handArrow.position.copy(handPosition);handArrow.setDirection(new THREE.Vector3(Math.sin(s.direction)*Math.cos(toolYaw.rotation.y),Math.cos(s.direction),-Math.sin(s.direction)*Math.sin(toolYaw.rotation.y)));handArrow.visible=v.effort>0&&!s.released;handArrow.setLength(Math.max(.001,v.effort*.025),.09,.055);
  hookArrow.position.copy(hookPosition);hookArrow.setDirection(new THREE.Vector3(0,-1,0));hookArrow.visible=s.hookForce>0;hookArrow.setLength(Math.max(.001,s.hookForce*.015),.09,.055);
  const reaction=new THREE.Vector3(s.supportHorizontal,s.supportVertical,0);supportArrow.position.copy(supportPosition);supportArrow.visible=reaction.length()>1e-10;supportArrow.setDirection(reaction.length()>0?reaction.clone().normalize():new THREE.Vector3(0,1,0));supportArrow.setLength(Math.max(.001,reaction.length()*.015),.09,.055);
  const outcome=s.mode==='missed'?'No lifting force is transmitted to the cap because the hook misses the skirt.':s.mode==='stall'?(s.hookLift>0?'The cap bends partway, then stalls where the required hand force reaches the available limit.':'The available lifting moment cannot overcome the initial retaining resistance.'):s.mode==='released'?(s.openerWithdrawal<1?'The retaining crimps have cleared. The opener slides away before the cap is lifted for inspection.':s.capRemoval===0?'The opener is clear. The cap is ready to lift for inspection.':s.capRemoval<1?'The opener is clear. The cap is lifting for inspection.':'The opener is clear and the cap is removed for inspection. This separate motion is not an ejection prediction.'):'The supported lever lifts the hooked skirt while the attached crimps deform around the neck bead.';
  return {state:s,readings:[
   reading('Outcome',outcome,'The hook must engage and the useful hand torque must meet the rising load throughout the opening.'),
   reading('Cap attachment',s.released?'Released':'Still retained','The cap releases only after the hooked edge reaches the assumed 3 mm threshold. The later lift represents manual removal.'),
   reading('Hook lift',format(s.hookLift*1000)+' of 3 mm','Actual edge lift compared with the release threshold. Inspect the cap contact to see this small movement without exaggerating its geometry.'),
   reading('Available hand force',format(s.availableHandForce)+' N','Maximum force your hand can supply. Unused reserve does not increase the prescribed opening speed or work.'),
   reading('Actual hand force',format(s.actualHandForce)+' N','Force currently supplied. During motion it meets the load; at a stall it reaches your limit. It becomes zero after release or with a missed hook.'),
   reading('Peak hand force needed for release',!s.engaged?'No hook engagement':s.peakRequiredHandForce===null?'No positive lifting moment':format(s.peakRequiredHandForce)+' N','Compare this requirement with your available force. A force sufficient to start may still be too small to finish.'),
   reading('Required hand force at current angle',!s.engaged?'No hook engagement':s.requiredHandForce===null?'No positive lifting moment':format(s.requiredHandForce)+' N','Force that would balance the modeled retaining load at this angle. After release this is the former loading requirement, not an ongoing force.'),
   reading('Retaining resistance',format(s.retainingResistance)+' N','Assumed loading curve: 20 N plus the selected rise per millimeter of lift. After release this reports the load reached just before detachment.'),
   reading('Hook force',format(s.hookForce)+' N','Actual upward force on the cap. The orange arrow shows its equal downward reaction on the hook. Both vanish after release or a missed contact.'),
   reading('Available torque',format(s.availableTorque)+' N m','Hand-force limit × perpendicular moment arm. An outward pull loses useful torque as the handle rises.'),
   reading('Required torque',format(s.requiredTorque)+' N m','Retaining load × horizontal hook moment arm. This loading-path requirement remains for comparison after release or missed engagement.'),
   reading('Support horizontal reaction',format(s.supportHorizontal)+' N','Reaction on the opener. A negative value opposes an outward pull. The model assumes a located support that does not slip.'),
   reading('Support vertical reaction',format(s.supportVertical)+' N','Upward support force balancing the hook reaction and vertical hand force. A negative value indicates a downward reaction in the assumed located contact.'),
   reading('Lever angle',format(s.angle*180/Math.PI,1)+'°','Rotation from the starting position. The default cap needs only about 6.3 degrees, which is easier to inspect close up.'),
   reading('Hand travel',format(s.handTravel*1000,1)+' mm','Arc traveled by the hand. A longer handle trades greater travel for lower required force.'),
   reading('Cap deformation work',format(s.capWork,3)+' J','Integral of the assumed resistance over the lift: 20q + kq²/2. Ideal hand work equals this value; it is not necessarily recoverable elastic energy.'),
   reading('Trial time',format(elapsed)+' s','An eight-second attempt at 0.035 radians per second, subject to the force limit. Waiting does not release a stalled cap.'),
  ]};
 });
 const render=result.update;result.advance=dt=>{if(Number.isFinite(dt)&&dt>0)elapsed=Math.min(C.duration,elapsed+dt);return render();};result.animate=t=>{const dt=Number.isFinite(t)?Math.max(0,t-lastClock):0;if(Number.isFinite(t))lastClock=t;return result.advance(dt);};result.reset=()=>{elapsed=lastClock=0;return render(result.defaults);};
 result.actions=[['Inspect start (0%)',0],['Inspect quarter (25%)',.25],['Inspect three quarters (75%)',.75],['Inspect result (100%)',1]].map(([label,p])=>({label,part:'system',view:'front',replay:false,run(){elapsed=C.duration*p;return render();}}));
 result.actions.push({label:'Inspect cap contact',part:'hook',view:'front',replay:false,run:()=>render()},{label:'Inspect whole opener',part:'system',view:'front',replay:false,run:()=>render()});
 result.playback={label:'Lift the bottle cap',description:'Choose Inspect cap contact, then Play to watch the small lift beside the retaining bead. Inspect whole opener restores the wider view without changing the trial. The hand attempts 0.035 radians per second, subject to its force limit. An underpowered attempt stalls partway. A completed attempt first withdraws the opener, then moves the released cap aside for inspection.',stepLabel:'Advance the bottle opener by one percent of the trial',advance:result.advance,step:()=>result.advance(C.duration/100),complete:()=>elapsed>=C.duration,blocked:()=>false};
 result.resultPart={id:'cap',label:'Inspect the released crown',view:'front',focusOnComplete:false,available:()=>result.getState().released};
 result.frameBoundsForPart=id=>{if(id==='hook'){root.updateMatrixWorld(true);const bounds=new THREE.Box3();for(const object of [cap,bead,support,hook])bounds.union(new THREE.Box3().setFromObject(object));return bounds;}if(!['system','opener','handle'].includes(id))return null;const s=result.getState();root.updateWorldMatrix(true,false);return new THREE.Box3(new THREE.Vector3(-.72,-2.25,-.72),new THREE.Vector3(s.arm*30+.95,Math.max(1.55,s.arm*30*Math.sin(.28)+.9),vRangeZ(s.values.placement))).applyMatrix4(root.matrixWorld);};
 function vRangeZ(placement){return placement?result.getState().arm*30*Math.sin(.55)+.4:.72;}
 root.rotation.set(.18,-.32,0);result.initialPart='system';result.initialView='front';result.frameVisibleOnly=true;result.framePadding=.5;result.autoFramePart='system';result.selectionOutline=false;result.transparentBackground=true;
 result.parts.find(p=>p.id==='hook').framePadding=.75;result.catalogParts=result.parts.filter(p=>['bottle','bead','crown-top','liner','retaining-crimps','support','hook','handle'].includes(p.id));
 result.topology={forceGuide,system,bottle,body,neck,neckMesh,bead,beadMesh,glassProfile,cap,crownTop,roof,liner,linerMesh,crimps,crownMesh,crownRings,opener,toolYaw,lever,crosspiece,support,supportPad,hook,hookToe,hookStem,handle,handleMesh,effortPoint,handDot,handArrow,hookArrow,supportArrow,scale:30,pivot:new THREE.Vector3(-.4,.045,0)};
 const dispose=result.dispose;result.dispose=()=>{if(!disposed){disposed=true;dispose();}};return result;
}

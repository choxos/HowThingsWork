import * as THREE from 'three';
import {houseModel,reading} from './house-model-kit.js';
import {sampleBathroomScale,BATHROOM_SCALE_DEFAULTS as D,BATHROOM_SCALE_DOMAINS,BATHROOM_SCALE_CONSTANTS as C} from './bathroom-scale-physics.js';

export function createBathroomScaleModel({plateTeaching=false}={}){
 const kit=houseModel('Bathroom scale'),{root,part,control,finish}=kit,scale=30;
 const system=part('system','Bathroom scale','Four third-class levers move a common plate against a tension spring. A lighter spring drives the rack, pinion, and horizontal dial.');system.scale.setScalar(scale);
 function box(size,pos,color,parent){const mesh=kit.box(size,pos,color,parent);mesh.geometry.dispose();mesh.geometry=new THREE.BoxGeometry(...size);return mesh;}
 function shapeMesh(shape,depth,parent,color='metal'){const mesh=box([1,1,1],[0,0,0],color,parent);mesh.geometry.dispose();mesh.geometry=new THREE.ExtrudeGeometry(shape,{depth,bevelEnabled:false,curveSegments:64});mesh.geometry.translate(0,0,-depth/2);return mesh;}
 function annulus(outer,inner,depth,parent,color='metal'){const shape=new THREE.Shape();shape.absarc(0,0,outer,0,Math.PI*2,false);const hole=new THREE.Path();hole.absarc(0,0,inner,0,Math.PI*2,true);shape.holes.push(hole);return shapeMesh(shape,depth,parent,color);}
 function link(parent,r=.0015,color='metal'){return kit.cylinder(r,1,[0,0,0],color,parent);}
 function setLink(mesh,a,b){const start=new THREE.Vector3(...a),end=new THREE.Vector3(...b);mesh.position.copy(start).add(end).multiplyScalar(.5);mesh.scale.y=start.distanceTo(end);mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),end.sub(start).normalize());}
 const base=part('base','Chassis and fixed supports','The base carries the four fulcrums, spring anchor, crank bearing, rack guide, and zero-adjustment track.',[0,0,0],system);
 const floor=box([.31,.004,.23],[.025,.002,0],'leaf',base),walls=new THREE.Group();base.add(walls);
 for(const x of [-.127,.177])box([.006,.08,.23],[x,.044,0],'leaf',walls);for(const z of [-.112,.112])box([.298,.08,.006],[.025,.044,z],'leaf',walls);kit.covers.push(walls);
 const platform=part('platform','Load platform and four feet','Four flat foot pads rest on the lever input contacts. The platform remains horizontal while their small horizontal arcs slide under the pads.',[0,0,0],system);
 const pinionX=.08,rackZ=.02,pinionZ=rackZ-C.pinionRadius,dialRadius=.039,platformFrame=[];
 for(const z of [-.104,.104,-.0713,0,.0713])for(const [left,right] of z===0?[[-.124,pinionX-.045],[pinionX+.045,.174]]:[[-.124,.174]])platformFrame.push(box([right-left,.003,.006],[(left+right)/2,.0845,z],'clay',platform));
 for(const x of [-.121,.171])platformFrame.push(box([.006,.003,.214],[x,.0845,0],'clay',platform));
 if(plateTeaching)kit.covers.push(...platformFrame);
 const plateShape=new THREE.Shape();plateShape.moveTo(-.124,-.109);plateShape.lineTo(.174,-.109);plateShape.lineTo(.174,.109);plateShape.lineTo(-.124,.109);plateShape.closePath();
 const window=new THREE.Path();window.absarc(pinionX,-pinionZ,.042,0,Math.PI*2,true);plateShape.holes.push(window);
 const platformSkin=shapeMesh(plateShape,.003,platform,'clay');platformSkin.rotation.x=-Math.PI/2;platformSkin.position.y=.0875;kit.covers.push(platformSkin);
 const leversPart=part('levers','Four third-class levers','Each platform force acts one quarter of the distance to the plate contact. Their four outputs add, while load position changes the individual shares.',[0,0,0],system);
 const levers=[],pivotRadius=Math.hypot(C.pivotX,C.pivotZ);
 for(const sx of [-1,1])for(const sz of [-1,1]){
  const dx=-sx*C.pivotX/pivotRadius,dz=-sz*C.pivotZ/pivotRadius,yaw=Math.atan2(-dz,dx),pivot=new THREE.Group(),rotation=new THREE.Group();pivot.position.set(sx*C.pivotX,.04,sz*C.pivotZ);pivot.rotation.y=yaw;pivot.add(rotation);leversPart.add(pivot);
  const bearing=annulus(.004,.00155,.004,rotation),beam=kit.rod([.003,0,0],[C.leverOutput,0,0],.0015,'metal',rotation);
  const input=kit.sphere(.003,[0,0,0],'gold',leversPart),output=kit.sphere(.003,[0,0,0],'metal',leversPart),pin=kit.rod([sx*C.pivotX-dz*.008,.04,sz*C.pivotZ+dx*.008],[sx*C.pivotX+dz*.008,.04,sz*C.pivotZ-dx*.008],.0015,'ink',base);
  for(const offset of [-.006,.006])kit.cylinder(.0025,.036,[sx*C.pivotX-dz*offset,.022,sz*C.pivotZ+dx*offset],'metal',base);
  const footX=sx*(C.pivotX-C.pivotX/pivotRadius*C.leverInput),footZ=sz*(C.pivotZ-C.pivotZ/pivotRadius*C.leverInput),pad=box([.012,.002,.012],[footX,.044,footZ],'metal',platform),post=kit.cylinder(.002,.038,[footX,.064,footZ],'metal',platform);
  levers.push({sx,sz,dx,dz,pivot,rotation,bearing,beam,input,output,pin,pad,post});
 }
 const calibration=part('calibration','Load-carrying calibrating plate','All four lever outputs press this plate downward. It stretches the main spring and lowers the bearing surface under the dial crank.',[0,0,0],system);
 const plateProfile=new THREE.Shape();plateProfile.moveTo(-.034,-.026);plateProfile.lineTo(.034,-.026);plateProfile.lineTo(.034,.026);plateProfile.lineTo(-.034,.026);plateProfile.closePath();
 const guideRods=[],guideCollars=[];
 for(const x of [-.030,.030])for(const z of [-.018,.010]){
  const hole=new THREE.Path();hole.absarc(x,-z,.00155,0,Math.PI*2,true);plateProfile.holes.push(hole);
  guideRods.push(kit.cylinder(.0015,.064,[x,.036,z],'ink',base));const collar=annulus(.0028,.00155,.006,calibration);collar.rotation.x=Math.PI/2;collar.position.set(x,.0355,z);guideCollars.push(collar);
 }
 const plate=shapeMesh(plateProfile,.003,calibration,'gold');plate.rotation.x=-Math.PI/2;plate.position.y=.0355;
 const springLowerHook=kit.rod([0,.037,0],[0,.038,0],.001,'metal',calibration),followerPost=box([.006,.029,.006],[.003,.0515,.02],'gold',calibration),followerPad=box([.020,.002,.009],[.003,.067,.02],'gold',calibration);
 const mainSpring=part('spring','Main tension spring','The upper end is fixed to the chassis; the lower end follows the plate. The spring lengthens under load and supplies the main restoring force.',[0,0,0],system);
 const mainAnchorSupports=[];
 for(const x of [-.045,.045])mainAnchorSupports.push(kit.cylinder(.002,.067,[x,.0375,-.025],'metal',base));
 mainAnchorSupports.push(kit.rod([-.045,.071,-.025],[.045,.071,-.025],.002,'metal',base),kit.rod([0,.071,-.025],[0,.071,0],.002,'metal',base));
 const mainCoil=kit.spring([0,0,0],.006,C.mainInitialLength,8,mainSpring,.0008),mainLowerEnd=link(mainSpring,.0008),mainUpperEnd=kit.rod([.006,.071,0],[0,.071,0],.0008,'metal',mainSpring);
 const crank=part('crank','Bell crank and sliding follower','The plate supports a rounded follower on the short arm. The light dial spring pulls the long arm through a pin in a vertical rack slot.',[.025,.07,.02],system),crankRotation=new THREE.Group();crank.add(crankRotation);
 const crankBearing=annulus(.004,.00155,.004,crankRotation),crankInput=kit.rod([-.003,0,0],[-C.crankInput,0,0],.0015,'metal',crankRotation),crankOutput=kit.rod([0,-.003,0],[0,-C.crankOutput,0],.0015,'metal',crankRotation),follower=kit.sphere(.002,[-C.crankInput,0,0],'gold',crankRotation);
 const crankPin=kit.rod([.025,.07,.018],[.025,.07,.050],.0015,'ink',base),crankSupport=box([.007,.066,.004],[.025,.037,.047],'metal',base);
 const roller=kit.disk(.002,.006,[0,-C.crankOutput,.003],'gold',crankRotation);
 const rack=part('rack','Guided toothed rack','The rack slides horizontally. Its vertical slot accepts the crank pin’s small vertical arc without changing the exact 2:1 displacement ratio.',[0,0,0],system);
 const slotLeft=box([.002,.024,.006],[.022,.025,.023],'metal',rack),slotRight=box([.002,.024,.006],[.028,.025,.023],'metal',rack),slotTop=box([.008,.002,.006],[.025,.036,.023],'metal',rack),slotBottom=box([.008,.002,.006],[.025,.014,.023],'metal',rack);
 const toothCount=20,pitch=2*Math.PI*C.pinionRadius/toothCount,module=2*C.pinionRadius/toothCount,pressure=Math.PI/9,addendum=module,dedendum=1.25*module;
 const rackBack=box([.097,.003,.003],[.0765,.02,rackZ+dedendum+.0015],'metal',rack),rackTeeth=[];
 for(let i=-26;i<=22;i++){
  const center=pinionX+i*pitch,half=pitch/4,shape=new THREE.Shape();shape.moveTo(-half-dedendum*Math.tan(pressure),dedendum);shape.lineTo(half+dedendum*Math.tan(pressure),dedendum);shape.lineTo(half-addendum*Math.tan(pressure),-addendum);shape.lineTo(-half+addendum*Math.tan(pressure),-addendum);shape.closePath();
  const tooth=shapeMesh(shape,.003,rack);tooth.rotation.x=Math.PI/2;tooth.position.set(center,.02,rackZ);tooth.userData.profile=shape.getPoints();rackTeeth.push(tooth);
 }
 const rackGuide=box([.13,.002,.005],[.09,.0175,rackZ+dedendum+.0015],'ink',base);box([.006,.0135,.005],[.15,.01075,rackZ+dedendum+.0015],'metal',base);
 const rackSlideRail=box([.097,.003,.003],[.0785,.02,.029],'metal',rack),rackSlideTies=[.030,.125].map(x=>box([.003,.003,.0305-(rackZ+dedendum+.003)],[x,.02,(.0305+rackZ+dedendum+.003)/2],'metal',rack));
 const rackUpperGuide=box([.020,.002,.007],[.105,.0225,.029],'ink',base),rackLowerGuide=box([.020,.002,.007],[.105,.0175,.029],'ink',base),rackFrontGuide=box([.020,.005,.002],[.105,.02,.0265],'ink',base),rackBackGuide=box([.020,.005,.002],[.105,.02,.0315],'ink',base);
 const rackUpperSupport=box([.004,.0185,.002],[.105,.01325,.040],'metal',base),rackGuideBridge=box([.004,.002,.0105],[.105,.0225,.03575],'metal',base);
 const dialSpring=part('dial-spring','Light dial tension spring','This spring pulls the rack toward its fixed anchor. It shortens as the plate descends, releasing a small amount of its initial stored energy.',[0,0,0],system);
 const dialCoil=kit.spring([0,0,0],.0012,C.dialInitialLength,24,dialSpring,.00025);dialCoil.rotation.z=-Math.PI/2;
 const dialMovingHook=link(dialSpring,.0004),dialFixedHook=kit.rod([.165,.0128,.033],[.165,.014,.033],.0004,'metal',dialSpring),rackSpringBracket=kit.rod([.028,.014,.026],[.025,.014,.033],.0007,'metal',rack);kit.cylinder(.002,.01,[.165,.009,.033],'metal',base);
 const zero=part('zero','Zero adjustment and carriage','The screw moves the pinion and dial along the rack. It changes the indicated zero without moving the loaded plate, rack, or either spring.',[0,0,0],system),carriage=new THREE.Group();zero.add(carriage);
 const track=box([.032,.004,.021],[pinionX,.006,pinionZ],'metal',base),carriageFoot=box([.017,.004,.016],[pinionX,.01,pinionZ],'gold',carriage);
 const shaftBearing=annulus(.003,.00155,.006,carriage);shaftBearing.rotation.x=Math.PI/2;shaftBearing.position.set(pinionX,.015,pinionZ);
 const zeroScrew=kit.rod([.067,.01,pinionZ],[.182,.01,pinionZ],.0008,'metal',zero),zeroKnob=kit.disk(.006,.004,[.183,.01,pinionZ],'gold',zero);zeroKnob.rotation.y=Math.PI/2;
 const pinion=part('pinion','Dial pinion and shaft','The involute pinion meshes with the rack. Rack travel relative to the zero carriage sets the angle of the same connected dial shaft.',[pinionX,.02,pinionZ],carriage);
 const gearShape=new THREE.Shape(),gearBase=C.pinionRadius*Math.cos(pressure),gearTip=C.pinionRadius+addendum,gearRoot=C.pinionRadius-dedendum,baseHalf=Math.PI/(2*toothCount)+Math.tan(pressure)-pressure-1e-7;
 const halfAt=r=>{const angle=Math.acos(gearBase/r);return baseHalf-(Math.tan(angle)-angle);},profilePoint=(r,a,first=false)=>{if(first)gearShape.moveTo(r*Math.cos(a),r*Math.sin(a));else gearShape.lineTo(r*Math.cos(a),r*Math.sin(a));};
 for(let tooth=0;tooth<toothCount;tooth++){
  const center=Math.PI/2+tooth*2*Math.PI/toothCount;profilePoint(gearRoot,center-baseHalf,tooth===0);
  for(let j=0;j<=48;j++){const r=gearBase+(gearTip-gearBase)*j/48;profilePoint(r,center-halfAt(r));}
  const tipHalf=halfAt(gearTip);for(let j=1;j<=8;j++)profilePoint(gearTip,center-tipHalf+2*tipHalf*j/8);
  for(let j=48;j>=0;j--){const r=gearBase+(gearTip-gearBase)*j/48;profilePoint(r,center+halfAt(r));}
  profilePoint(gearRoot,center+baseHalf);for(let j=1;j<=8;j++)profilePoint(gearRoot,center+baseHalf+(2*Math.PI/toothCount-2*baseHalf)*j/8);
 }
 gearShape.closePath();const pinionMesh=shapeMesh(gearShape,.003,pinion,'gold');pinionMesh.rotation.set(Math.PI/2,0,Math.PI/toothCount);pinionMesh.userData.profile=gearShape.getPoints();
 const shaft=kit.cylinder(.0015,.065,[0,.0245,0],'ink',pinion);
 const dial=part('dial','Horizontal graduated dial','The nominal Earth calibration is fixed. The dial turns past the fixed datum line; changing spring stiffness or gravity changes the reading.',[0,.056,0],pinion);
 const dialRing=annulus(dialRadius,.022,.0015,dial,'cream');dialRing.rotation.x=Math.PI/2;
 for(const angle of [0,Math.PI*2/3,Math.PI*4/3])kit.rod([0,0,0],[.025*Math.cos(angle),0,.025*Math.sin(angle)],.001,'cream',dial);
 const marks=[];for(let kg=-10;kg<=200;kg+=2){const a=-kg*C.dialRadiansPerKg,r0=kg%10===0?.034:.036,r1=.038;marks.push(new THREE.Vector3(Math.sin(a)*r0,.0008,Math.cos(a)*r0),new THREE.Vector3(Math.sin(a)*r1,.0008,Math.cos(a)*r1));}
 const markGeometry=new THREE.BufferGeometry().setFromPoints(marks),markLines=new THREE.LineSegments(markGeometry,new THREE.LineBasicMaterial({color:0x374736}));dial.add(markLines);
 const segmentPaths=[[[0,1],[.6,1]],[[.6,1],[.6,.5]],[[.6,.5],[.6,0]],[[0,0],[.6,0]],[[0,.5],[0,0]],[[0,1],[0,.5]],[[0,.5],[.6,.5]]],digits={0:[0,1,2,3,4,5],1:[1,2],2:[0,1,6,4,3],3:[0,1,6,2,3],4:[5,6,1,2],5:[0,5,6,2,3],6:[0,5,6,4,2,3],7:[0,1,2],8:[0,1,2,3,4,5,6],9:[0,1,2,3,5,6],'-':[6]};
 const numberLabels=[];for(const kg of [-10,0,20,40,60,80,100,120,140,160,180,200]){
  const text=String(kg),a=-kg*C.dialRadiansPerKg,size=.004,label=new THREE.Group(),points=[];label.position.set(Math.sin(a)*.029,.0009,Math.cos(a)*.029);label.rotation.y=a;
  [...text].forEach((character,index)=>{for(const segment of digits[character])for(const [x,y] of segmentPaths[segment])points.push(new THREE.Vector3((x+index*.8-text.length*.4)*size,0,(.5-y)*size));});
  label.add(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(points),new THREE.LineBasicMaterial({color:0x374736})));label.userData.mass=kg;dial.add(label);numberLabels.push(label);
 }
 const datum=kit.rod([pinionX-.006,.078,pinionZ+.038],[pinionX+.006,.078,pinionZ+.038],.00035,'red',zero);kit.rod([pinionX+.006,.078,pinionZ+.038],[pinionX+.014,.078,pinionZ+.044],.001,'metal',zero);kit.cylinder(.0015,.074,[pinionX+.014,.041,pinionZ+.044],'metal',zero);
 const load=part('load','Transferred load and operator support','The downward arrow shows weight transferred to the scale. The upward arrow shows the remaining weight carried by the operator during gradual loading and unloading.',[0,0,0],platform),loadPad=box([.023,.002,.005],[0,.090,0],'blue',load);
 function arrow(color){const object=new THREE.ArrowHelper(new THREE.Vector3(0,-1,0),new THREE.Vector3(),.03,color,.003,.0018);system.add(object);return object;}
 const loadArrow=arrow(0xc27a3f),operatorArrow=arrow(0x397689),contactArrows=levers.map(()=>arrow(0xc27a3f));
 const plateForceOverlay=plateTeaching?new THREE.Group():null,plateForceArrows=[];let mainPlateArrow=null,crankPlateArrow=null;
 if(plateForceOverlay){
  plateForceOverlay.name='Forces applied to the calibrating plate';calibration.add(plateForceOverlay);
  const makeForce=(color,sign,name)=>{const object=new THREE.ArrowHelper(new THREE.Vector3(0,sign,0),new THREE.Vector3(),.012,color,.0025,.0015);object.name=name;object.traverse(child=>{if(child.material){child.material.depthTest=false;child.material.depthWrite=false;child.renderOrder=20;}});plateForceOverlay.add(object);return object;};
  for(const name of ['Left-front','Left-back','Right-front','Right-back'])plateForceArrows.push(makeForce(0xc27a3f,-1,name+' force on plate'));
  mainPlateArrow=makeForce(0x33804a,1,'Main-spring force on plate');crankPlateArrow=makeForce(0x397689,-1,'Crank force on plate');
 }
 load.userData.explosionExcluded=true;for(const object of [loadArrow,operatorArrow,...contactArrows,plateForceOverlay].filter(Boolean))object.userData.explosionExcluded=true;
 const plateContextObjects=[calibration,mainSpring,crank,follower,crankPin,crankSupport,...guideRods,...mainAnchorSupports,...levers.map(lever=>lever.output)];
 function setPlateForce(object,force,contact,sign){
  const length=.008+.024*Math.sqrt(force/300);object.visible=force>0;object.setLength(length,.0025,.0015);object.position.set(...contact);if(sign<0)object.position.y+=length;
 }
 const specs={mass:['Selected mass','kg','The operator gradually transfers this mass’s weight to the platform, holds it, then takes it off.'],stiffness:['Main spring stiffness','N/m','The dial retains its nominal calibration. A softer main spring moves farther and overreads on Earth.'],zero:['Zero-setting offset','kg','Move the pinion carriage along the rack. A zero offset shifts readings without changing spring extension.'],position:['Lateral load position','','Negative is left, positive is right. Four ideal support shares change while their sum remains the same.'],gravity:['Gravity','', 'The dial retains its Earth calibration. The same mass exerts less weight in weaker gravity.',[{value:0,label:'Earth · 9.81 m/s²'},{value:1,label:'Moon · 1.62 m/s²'},{value:2,label:'Mars · 3.71 m/s²'}]]};
 for(const [key,[min,max,step]] of Object.entries(BATHROOM_SCALE_DOMAINS)){const [label,unit,help,options]=specs[key];control(key,label,min,max,step,D[key],unit,help,options);}
 let elapsed=0,lastClock=0,disposed=false;const format=(n,digits=2)=>(Math.abs(n)<.5*10**-digits?0:n).toFixed(digits);
 const result=finish(v=>{
  const s=sampleBathroomScale(v,elapsed);platform.position.y=-s.platformTravel;calibration.position.y=-s.plateTravel;
  for(let i=0;i<levers.length;i++){
   const lever=levers[i];lever.rotation.rotation.z=-s.leverAngle;
   const position=radius=>[lever.sx*C.pivotX+lever.dx*radius*Math.cos(s.leverAngle),.04-radius*Math.sin(s.leverAngle),lever.sz*C.pivotZ+lever.dz*radius*Math.cos(s.leverAngle)];lever.input.position.set(...position(C.leverInput));lever.output.position.set(...position(C.leverOutput));
   contactArrows[i].position.copy(lever.input.position).add(new THREE.Vector3(0,.018,0));contactArrows[i].visible=s.loadShares[i]>0;contactArrows[i].setLength(.006+s.loadShares[i]/12000,.003,.0018);
  }
  mainCoil.position.set(0,.038-s.plateTravel,0);mainCoil.userData.setLength(s.mainSpringLength);setLink(mainLowerEnd,[0,.038-s.plateTravel,0],[.006,.038-s.plateTravel,0]);
  crankRotation.rotation.z=s.crankAngle;rack.position.x=s.rackTravel;roller.quaternion.setFromAxisAngle(new THREE.Vector3(0,0,1),-s.crankAngle).multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1,0,0),Math.PI/2));
  dialCoil.position.set(.025+s.rackTravel,.014,.033);dialCoil.userData.setLength(s.dialSpringLength);setLink(dialMovingHook,[.025+s.rackTravel,.014,.033],[.025+s.rackTravel,.0128,.033]);
  carriage.position.x=s.carriageShift;pinion.rotation.y=s.dialAngle;zeroKnob.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),new THREE.Vector3(1,0,0));zeroKnob.rotateY(-s.carriageShift*2*Math.PI/.001);
  load.position.x=s.loadX;loadArrow.position.set(s.loadX-.008,.117-s.platformTravel,0);loadArrow.visible=s.transferredWeight>0;loadArrow.setLength(.007+.021*s.loadFraction,.003,.0018);operatorArrow.position.set(s.loadX+.008,.089-s.platformTravel,0);operatorArrow.setDirection(new THREE.Vector3(0,1,0));operatorArrow.visible=s.operatorSupport>0;operatorArrow.setLength(.007+.021*(1-s.loadFraction),.003,.0018);
  if(plateTeaching){
   loadArrow.visible=operatorArrow.visible=false;contactArrows.forEach(object=>{object.visible=false;});
   for(let i=0;i<levers.length;i++)setPlateForce(plateForceArrows[i],s.plateShares[i],[levers[i].output.position.x,.037,levers[i].output.position.z],-1);
   setPlateForce(mainPlateArrow,s.mainSpringForce,[0,.037,0],1);setPlateForce(crankPlateArrow,s.dialPlateForce,[s.crankFollowerX,.068,.020],-1);
  }
  const outcome=s.phase==='loading'?'The operator gradually transfers weight. The platform descends, the main spring extends, and the dial spring pulls the rack.':s.phase==='holding'?'The load is fully supported. Main spring tension balances the four lever outputs plus the light dial-spring bias.':s.phase==='unloading'?'The operator takes the weight back. The main spring raises the plate and returns the dial while stored energy is recovered.':v.zero===0?'The platform is unloaded and the dial has returned to zero. Supplied loading work has been recovered in this ideal cycle.':'The platform is unloaded. The dial returns to the selected zero-setting offset, showing why zero adjustment matters.';
  return {state:s,readings:[
   ...(plateTeaching?[
    reading('Plate force arrows','Orange: downward lever forces. Green: upward main-spring tension. Blue: downward crank bias.','Arrow lengths are illustrative; the force readings below give the actual modeled magnitudes in newtons.'),
    ...['Left-front','Left-back','Right-front','Right-back'].map((name,i)=>reading(name+' plate force',format(s.plateShares[i])+' N','This lever delivers one quarter of its platform support force to the common plate. The four contributions add.')),
    reading('Plate-guide lateral couple',format(s.guideMoment,3)+' N m','Signed turning moment from unequal left/right lever shares and the moving crank contact. Guides react it without allowing plate rotation.'),
    reading('Plate-guide fore/aft couple',format(s.guideMomentX,3)+' N m','Signed moment from the crank bias acting in front of the plate center. The fore/aft guides prevent tipping.'),
    reading('Plate-guide couple magnitude',format(s.guideMomentMagnitude,3)+' N m','Combined magnitude of the two perpendicular moments. These ideal guide reactions do no work because the plate does not rotate.'),
   ]:[]),
   reading('Outcome',outcome,'Weight is transferred over two seconds, held until six seconds, then removed. This is quasistatic loading, not a bounce simulation.'),
   reading('Indicated mass',format(s.indicatedMass)+' kg','Read the graduation at the fixed red index. The dial retains its Earth calibration; changing zero shifts the reading while changing stiffness alters sensitivity.'),
   reading('Transferred weight force',format(s.transferredWeight)+' N','Force actually carried by the platform: selected mass × gravity × transferred fraction. A spring scale senses this force.'),
   reading('Load transferred',format(s.loadFraction*100,1)+' %','The operator gradually transfers the load and takes it back. Inspect quarter holds the complete load; Inspect result shows the unloaded zero.'),
   reading('Operator support',format(s.operatorSupport)+' N','Remaining weight supported off the scale during loading and unloading. It is zero while the full load rests on the platform.'),
   reading('Each left support force',format(s.loadShares[0])+' N','Both left supports carry this amount. Moving the load left increases their shares without changing the total indication in this ideal model.'),
   reading('Each right support force',format(s.loadShares[2])+' N','Both right supports carry this amount. Twice the left value plus twice the right value equals transferred weight.'),
   reading('Platform travel',format(s.platformTravel*1000,3)+' mm','Small downward displacement from unloaded position. The platform is kept level by the four equal-ratio supports.'),
   reading('Plate travel',format(s.plateTravel*1000,3)+' mm','Four times platform travel. This extends the main tension spring and lowers the crank follower.'),
   reading('Rack travel',format(s.rackTravel*1000,3)+' mm','Twice plate travel through the first-class crank. Meshing with the pinion turns the dial.'),
   reading('Main spring tension',format(s.mainSpringForce)+' N','The 1 N initial tension plus stiffness × plate travel. It balances lever output and the dial mechanism bias.'),
   reading('Dial spring tension',format(s.dialSpringForce,3)+' N','Starts at 0.5 N and decreases as the rack approaches the fixed anchor. This light spring keeps pulling the indicating mechanism.'),
   reading('Combined lever output',format(s.plateLoad)+' N','Sum of four downward forces on the plate, equal to one quarter of the platform load. Greater travel comes with reduced force.'),
   reading('Dial force on plate',format(s.dialPlateForce,3)+' N','The crank applies twice the light-spring tension downward on the plate. At zero load this balances the main spring preload.'),
   reading('Loading work supplied',format(s.loadingWork,3)+' J','Work accumulated while the operator gradually applies the load. It stays recorded during the hold and unloading.'),
   reading('Work returned on unloading',format(s.returnedWork,3)+' J','Energy recovered during controlled unloading. It equals all loading work at the end of this ideal lossless cycle.'),
   reading('Net input work',format(s.inputWork,3)+' J','Loading work minus returned work. Equals the combined change in the two springs’ stored energy relative to the unloaded state.'),
   reading('Main spring energy change',format(s.mainSpringEnergy,3)+' J','Energy gained as the preloaded main spring extends. Both its initial tension and increasing spring force contribute.'),
   reading('Dial spring energy change',format(s.dialSpringEnergy,3)+' J','Negative during loading: the dial spring shortens and releases part of its initial stored energy. This is included in the combined balance.'),
   reading('Zero-carriage shift',format(s.carriageShift*1000,3)+' mm','Moves the pinion along the rack to change dial phase. It changes the zero without changing either spring extension or load sensitivity.'),
   reading('Trial time',format(s.elapsed)+' s','Eight-second load, hold and unload sequence. The end reading checks zero; the two-second reading checks the selected load.'),
  ]};
 });
 const render=result.update;result.advance=dt=>{if(Number.isFinite(dt)&&dt>0)elapsed=Math.min(C.duration,elapsed+dt);return render();};result.animate=t=>{const dt=Number.isFinite(t)?Math.max(0,t-lastClock):0;if(Number.isFinite(t))lastClock=t;return result.advance(dt);};result.reset=()=>{elapsed=lastClock=0;return render(result.defaults);};
 result.actions=[['Inspect start (0%)',0],['Inspect quarter (25%)',.25],['Inspect three quarters (75%)',.75],['Inspect result (100%)',1]].map(([label,p])=>({label,part:plateTeaching?'calibration':'system',view:'front',replay:false,run(){elapsed=C.duration*p;return render();}}));
 if(!plateTeaching)result.actions.push({label:'Inspect dial reading',part:'dial',isolate:true,view:'front',replay:false,run:()=>render()},{label:'Inspect whole scale',part:'system',view:'front',replay:false,run:()=>render()});
 result.playback={label:'Load and unload the scale',description:(plateTeaching?'':'Turn on Look inside to follow the levers and springs. Inspect dial reading magnifies the fixed red index without changing the trial. ')+ 'Transfer the selected weight over two seconds, hold for four seconds, then remove it over two seconds. This is controlled quasistatic loading, not a spring-bounce simulation.',stepLabel:'Advance the scale by one percent of the trial',advance:result.advance,step:()=>result.advance(C.duration/100),complete:()=>elapsed>=C.duration,blocked:()=>false};
 result.resultPart=plateTeaching?{id:'calibration',context:'system',label:'Inspect the unloaded plate and its balanced preloads',view:'front',focusOnComplete:false,available:()=>elapsed>=C.duration}:{id:'dial',context:'zero',label:'Inspect the return to zero',view:'front',focusOnComplete:false,available:()=>elapsed>=C.duration};
 result.frameBoundsForPart=id=>{
  if(!plateTeaching&&id==='dial'){root.updateMatrixWorld(true);return new THREE.Box3().setFromObject(dial).union(new THREE.Box3().setFromObject(datum));}
  if(plateTeaching&&id==='calibration'){system.updateWorldMatrix(true,true);const bounds=new THREE.Box3(new THREE.Vector3(-.050,.002,-.030),new THREE.Vector3(.058,.092,.053)).applyMatrix4(system.matrixWorld);for(const object of plateContextObjects)bounds.union(new THREE.Box3().setFromObject(object,true));return bounds;}
  if(!['system','platform','load'].includes(id))return null;system.updateWorldMatrix(true,false);return new THREE.Box3(new THREE.Vector3(-.134,-.002,-.12),new THREE.Vector3(.194,.122,.12)).applyMatrix4(system.matrixWorld);
 };
 root.rotation.set(.7,-.24,0);result.initialPart=plateTeaching?'calibration':'system';result.initialView='front';result.initialCutaway=plateTeaching;result.frameVisibleOnly=true;result.framePadding=.5;result.autoFramePart=plateTeaching?'calibration':'system';result.selectionOutline=false;result.transparentBackground=true;
 if(!plateTeaching){result.catalogParts=result.parts.filter(p=>!['system','load'].includes(p.id));}
 result.topology={system,base,floor,walls,platform,platformFrame,platformSkin,leversPart,levers,calibration,plate,guideRods,guideCollars,springLowerHook,followerPost,followerPad,mainSpring,mainCoil,mainLowerEnd,mainUpperEnd,mainAnchorSupports,crank,crankRotation,crankBearing,crankInput,crankOutput,crankPin,crankSupport,follower,roller,rack,slotLeft,slotRight,slotTop,slotBottom,rackBack,rackTeeth,rackGuide,rackSlideRail,rackSlideTies,rackUpperGuide,rackLowerGuide,rackFrontGuide,rackBackGuide,rackUpperSupport,rackGuideBridge,dialSpring,dialCoil,dialMovingHook,dialFixedHook,rackSpringBracket,zero,carriage,track,carriageFoot,shaftBearing,zeroScrew,zeroKnob,pinion,pinionMesh,shaft,dial,dialRing,markLines,numberLabels,datum,load,loadPad,loadArrow,operatorArrow,contactArrows,plateTeaching,plateForceOverlay,plateForceArrows,mainPlateArrow,crankPlateArrow,plateContextObjects,scale,toothCount,pitch,module,pinionX,pinionZ,rackZ};
 const dispose=result.dispose;result.dispose=()=>{if(!disposed){disposed=true;dispose();}};return result;
}

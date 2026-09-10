import * as THREE from 'three';
import {houseModel,reading as r} from './house-model-kit.js';

export function createWindowShadeModel(){
 const m=houseModel('Window shade'),{part,box,rod,disk,ring,sphere,control,finish}=m;
 const tau=Math.PI*2,step=Math.PI/2,top=2.55,core=.2,clothThickness=.012,total=2.35,windowHeight=2.15;
 const fullRadius=Math.sqrt(core*core+clothThickness*total/Math.PI);
 const lengthAt=angle=>fullRadius*angle-clothThickness*angle*angle/(4*Math.PI);
 const angleAt=length=>2*Math.PI/clothThickness*(fullRadius-Math.sqrt(fullRadius*fullRadius-clothThickness*length/Math.PI));
 const maxAngle=angleAt(total),pivotRadius=.16,pawlLength=.1,toeRadius=.004,seatRadius=.095;
 const seatedBeta=Math.acos((seatRadius*seatRadius-pivotRadius*pivotRadius-pawlLength*pawlLength)/(2*pivotRadius*pawlLength));
 const baseAngle=Math.asin(toeRadius/seatRadius)-Math.atan2(pawlLength*Math.sin(seatedBeta),pivotRadius+pawlLength*Math.cos(seatedBeta));
 const system=part('system','Window and spring roller','Lower the fabric to cover the window. A gentle release catches; a tug and brisk release lets the spring rewind it.');
 const window=part('window','Window opening','The useful result is a covered or uncovered window.',[0,0,0],system);
 for(const x of [-1.35,1.35])box([.12,2.39,.12],[x,1.395,-.22],'wood',window);
 for(const y of [.26,2.53])box([2.8,.12,.12],[0,y,-.22],'wood',window);
 box([2.58,windowHeight,.04],[0,1.395,-.28],'blue',window);box([.035,windowHeight,.045],[0,1.395,-.245],'cream',window);
 const assembly=part('assembly','Connected roller mechanism','The spring, roller and pawl carrier share one axis; the central stem and notched hub remain fixed.',[0,top,0],system);
 const supports=part('supports','Mounting brackets','A rectangular tang fixes the central stem to the right bracket. The roller turns in its bearings.',[0,0,0],assembly);
 for(const x of [-1.47,1.47]){box([.07,.16,.1],[x,-.3,-.24],'wood',supports);rod([x,-.22,-.24],[x,-.055,0],.02,'metal',supports);const halfY=x>0?.0225:.031,halfZ=x>0?.025:.031;for(const z of [-halfZ-.0125,halfZ+.0125])box([.065,2*halfY+.05,.025],[x,0,z],'metal',supports);for(const y of [-halfY-.0125,halfY+.0125])box([.065,.025,2*halfZ],[x,y,0],'metal',supports);}
 const shaft=part('shaft','Fixed central rod','The rod is anchored to the right bracket and to one end of the coil spring.',[0,0,0],assembly);rod([-.93,0,0],[1.4,0,0],.03,'ink',shaft);box([.15,.045,.05],[1.44,0,0],'ink',shaft);
 const roller=part('roller','Rotating roller tube','The tube turns with the fabric and locking disk, around the fixed central rod.',[0,0,0],assembly);
 rod([-1.51,0,0],[-1.32,0,0],.026,'metal',roller);rod([-1.32,-.19,0],[-1.32,.19,0],.012,'metal',roller);
 const shell=new THREE.Mesh(new THREE.CylinderGeometry(core,core,2.64,64,1,true),new THREE.MeshToonMaterial({color:0xb4c5b0,side:THREE.DoubleSide}));shell.rotation.z=Math.PI/2;roller.add(shell);m.covers.push(shell);
 for(const x of [-1.32,1.32]){const hoop=ring(.192,.014,[x,0,0],'metal',roller);hoop.rotation.y=Math.PI/2;}
 // Narrow longitudinal ribs remain in the cutaway so the end disk stays visibly connected.
 for(const a of [Math.PI*.2,Math.PI*1.2])rod([-1.32,.19*Math.cos(a),.19*Math.sin(a)],[1.32,.19*Math.cos(a),.19*Math.sin(a)],.008,'metal',roller);
 const spool=part('spool','Wound shade fabric','The wound radius decreases as cloth leaves the roll. Cloth thickness is enlarged to make the layers visible.',[0,0,0],assembly);
 const wound=new THREE.Mesh(new THREE.CylinderGeometry(1,1,2.62,64,1,true),new THREE.MeshToonMaterial({color:0xf0dfaf,side:THREE.DoubleSide}));wound.rotation.z=Math.PI/2;spool.add(wound);m.covers.push(wound);
 const fabric=part('fabric','Hanging fabric','The hanging length comes from the same roller angle that winds the spring.',[0,0,0],assembly),sheet=box([2.62,1,clothThickness],[0,-.5,0],'cream',fabric);
 const rail=part('rail','Bottom rail and pull ring','The rail keeps its thickness while the fabric unrolls.',[0,0,0],system);box([2.67,.06,.06],[0,0,0],'wood',rail);rod([0,-.03,0],[0,-.17,0],.012,'ink',rail);ring(.055,.01,[0,-.22,0],'gold',rail);
 const spring=part('spring','Axial winding spring','One end is fixed to the central rod; the other turns with the roller. Lowering adds relative turns.',[0,0,0],assembly);
 const fixedAnchor=part('fixed-anchor','Fixed spring anchor','This collar is fixed to the central rod.',[-.88,0,0],shaft);const anchor=disk(.065,.04,[0,0,0],'ink',fixedAnchor);anchor.rotation.set(0,0,Math.PI/2);
 const movingAnchor=part('moving-anchor','Rotating spring anchor','The outer spring end is secured to the roller.',[.88,0,0],roller);const bearing=ring(.0525,.0125,[0,0,0],'gold',movingAnchor);bearing.rotation.y=Math.PI/2;for(const sign of [-1,1])rod([0,sign*.06,0],[0,sign*.19,0],.013,'gold',movingAnchor);
 const springMaterial=new THREE.MeshToonMaterial({color:0xce825f});let coil,springRadius=.11;
 const initialSpringAngle=14*tau+baseAngle,wireLength=Math.hypot(1.52,initialSpringAngle*.11)+.24+.155;
 function springPath(angle){
  const sweep=initialSpringAngle+angle;
  // Spaced coils fit a fixed axial span. Preserve wire length; this is not an elastic equilibrium solver.
  let low=.04,high=.11;for(let i=0;i<32;i++){const radius=(low+high)/2,length=Math.hypot(1.52,sweep*radius)+2*Math.hypot(.12,.11-radius)+.155;if(length>wireLength)high=radius;else low=radius;}
  springRadius=(low+high)/2;
  const radius=springRadius,helix=new THREE.Curve();helix.getPoint=(t,target=new THREE.Vector3())=>target.set(-.76+1.52*t,radius*Math.cos(sweep*t),radius*Math.sin(sweep*t));
  helix.getPointAt=helix.getPoint;helix.getLength=()=>Math.hypot(1.52,sweep*radius);
  const a=new THREE.Vector3(-.88,0,0),b=new THREE.Vector3(-.88,.11,0),c=helix.getPoint(0),d=helix.getPoint(1),e=new THREE.Vector3(.88,.11*Math.cos(sweep),.11*Math.sin(sweep)),f=new THREE.Vector3(.88,.065*Math.cos(sweep),.065*Math.sin(sweep)),path=new THREE.CurvePath();
  for(const curve of [new THREE.LineCurve3(a,b),new THREE.LineCurve3(b,c),helix,new THREE.LineCurve3(d,e),new THREE.LineCurve3(e,f)])path.add(curve);
  return path;
 }
 const locking=part('locking','Pawls and fixed ratchet','Inspect from Side and isolate this assembly to compare the stationary hub with the two rotating catches.',[1.2,0,0],assembly);
 const hub=part('hub','Stationary four-stop ratchet','Four steep faces can stop a pawl. The hub is fixed to the central rod.',[.01,0,0],locking);
 const cam=new THREE.Shape(),camPoints=[];for(let i=0;i<4;i++){for(let j=0;j<=24;j++){const a=(i+j/24)*step,rad=.072+.043*j/24;const y=rad*Math.cos(a),z=rad*Math.sin(a);camPoints.push([y,z]);if(i===0&&j===0)cam.moveTo(y,z);else cam.lineTo(y,z);}}cam.closePath();
 const hubMesh=new THREE.Mesh(new THREE.ExtrudeGeometry(cam,{depth:.025,bevelEnabled:false}),new THREE.MeshToonMaterial({color:0xe3b45e}));hub.add(hubMesh);
 // Local disk coordinates map directly to world y/z through an explicit basis.
 hubMesh.geometry.rotateY(Math.PI/2);hubMesh.geometry.rotateX(Math.PI/2);
 const carrier=part('carrier','Rotating locking disk','The disk is secured to the roller and carries two hinged pawls.',[0,0,0],locking);
 const diskHoop=ring(.175,.014,[0,0,0],'blue',carrier);diskHoop.rotation.y=Math.PI/2;
 const plate=part('disk-plate','Annular locking-disk plate','The two pawl pivots are mounted through this rotating plate. Its central hole clears the fixed rod.',[-.018,0,0],carrier),plateShape=new THREE.Shape(),hole=new THREE.Path();plateShape.absarc(0,0,.175,0,tau,false);hole.absarc(0,0,.04,0,tau,true);plateShape.holes.push(hole);for(const y of [-pivotRadius,pivotRadius]){const bore=new THREE.Path();bore.absarc(y,0,.012,0,tau,true);plateShape.holes.push(bore);}const plateGeometry=new THREE.ExtrudeGeometry(plateShape,{depth:.008,bevelEnabled:false,curveSegments:32});plateGeometry.rotateY(Math.PI/2);plateGeometry.rotateX(Math.PI/2);plate.add(new THREE.Mesh(plateGeometry,new THREE.MeshToonMaterial({color:0x83b4c1})));
 const pawls=[];
 for(let i=0;i<2;i++){
  const mount=part('pivot-'+i,'Pawl '+(i+1)+' pivot','The pivot travels with the locking disk and lets the pawl swing.',[.023,0,0],carrier);
  const pin=disk(.012,.07,[0,0,0],'ink',mount);pin.rotation.set(0,0,Math.PI/2);
  const pawl=part('pawl-'+i,'Hinged pawl '+(i+1),'At a slow stop an upper pawl can settle against a ratchet face. During the illustrated rapid rewind both swing clear.',[0,0,0],mount);
  rod([0,0,0],[0,.105,-.045],.003,'clay',pawl);rod([0,.105,-.045],[0,pawlLength,0],.003,'clay',pawl);sphere(toeRadius,[0,pawlLength,0],'clay',pawl);
  pawls.push({mount,pawl});
 }
 control('operation','Run action',0,1,1,0,'','Lower to the chosen coverage, or tug the existing shade and let it return.',[{value:0,label:'Lower and gently hold'},{value:1,label:'Tug and release'}]);
 control('coverage','Requested window coverage',.2,1,.05,.75,'fraction','The catch settles at the next available stop, so final coverage is approximate. Used when lowering.');
 control('release','Release after the tug',0,1,1,1,'','A guided slow release lets a pawl catch again. Brisk release demonstrates pawls held clear during spring rewind.',[{value:0,label:'Gentle: catch again'},{value:1,label:'Brisk: rewind'}]);
 let angle=0,stage='ready',stageClock=0,destination=0,settleAngle=0,complete=false,accumulator=0,lastClock=0,lastAngle=NaN;
 function pointDistance(p,a,b){const dx=b[0]-a[0],dy=b[1]-a[1],t=Math.max(0,Math.min(1,((p[0]-a[0])*dx+(p[1]-a[1])*dy)/(dx*dx+dy*dy)));return Math.hypot(p[0]-a[0]-t*dx,p[1]-a[1]-t*dy);}
 function segmentDistance(a,b,c,d){const cross=(p,q,r)=>(q[0]-p[0])*(r[1]-p[1])-(q[1]-p[1])*(r[0]-p[0]);if(cross(a,b,c)*cross(a,b,d)<0&&cross(c,d,a)*cross(c,d,b)<0)return 0;return Math.min(pointDistance(a,c,d),pointDistance(b,c,d),pointDistance(c,a,b),pointDistance(d,a,b));}
 function clearance(a,b){const p=[pivotRadius*Math.cos(a),pivotRadius*Math.sin(a)],c=Math.cos(a+b),s=Math.sin(a+b),elbow=[p[0]+.105*c+.045*s,p[1]+.105*s-.045*c],toe=[p[0]+pawlLength*c,p[1]+pawlLength*s];let gap=1;for(let i=0;i<camPoints.length;i++){const u=camPoints[i],v=camPoints[(i+1)%camPoints.length];gap=Math.min(gap,segmentDistance(p,elbow,u,v),segmentDistance(elbow,toe,u,v));}return gap-toeRadius;}
 function contactBeta(a){let b=2.1;while(b<2.8&&clearance(a,b+.02)>0)b+=.02;let high=b+.02;for(let i=0;i<15;i++){const mid=(b+high)/2;if(clearance(a,mid)>0)b=mid;else high=mid;}return b;}
 const result=finish(v=>{
  const length=lengthAt(angle),radius=fullRadius-clothThickness*angle/tau;
  roller.rotation.x=angle+baseAngle;carrier.rotation.x=angle+baseAngle;spool.rotation.x=angle+baseAngle;wound.scale.set(radius,1,radius);
  fabric.position.set(0,0,radius);sheet.scale.y=.08+length;sheet.position.y=-(.08+length)/2;rail.position.set(0,top-.08-length-.03,radius);
  if(lastAngle!==angle){lastAngle=angle;const geometry=new THREE.TubeGeometry(springPath(angle),900,.006,6,false);if(coil){coil.geometry.dispose();coil.geometry=geometry;}else{coil=new THREE.Mesh(geometry,springMaterial);spring.add(coil);}}
  for(let i=0;i<2;i++){
   const a=i*Math.PI,world=angle+baseAngle+a,upper=Math.cos(world)>0;
   pawls[i].mount.position.set(.023,pivotRadius*Math.cos(a),pivotRadius*Math.sin(a));
   const open=stage==='rewind'||stage==='clear';let beta=open?2.1:upper?contactBeta(world):2.1;
   if((stage==='held'||stage==='ready'&&Math.abs(angle/step-Math.round(angle/step))<1e-8)&&upper&&angle>0)beta=seatedBeta;
   if(stage==='settle'&&upper)beta=Math.min(beta,seatedBeta);
   pawls[i].pawl.rotation.x=a+beta;
  }
  const held=stage==='held'||stage==='ready'&&angle>0&&Math.abs(angle/step-Math.round(angle/step))<1e-8,raised=stage==='raised',winding=angle/tau,coverage=Math.min(1,length/windowHeight);
  return {state:{angle,extension:length,coverage,stage,held,complete,winding,springRadius,wireLength,rollerRadius:radius},readings:[r('Your result',raised?'Shade raised · window uncovered':held?(coverage===1?'Shade held · window fully covered':'Shade held · window partly covered'):stage==='rewind'?'Spring rewinding · window opening':stage==='lower'?'Lowering · covering the window':stage==='tug'?'Tug moves the catch off its stop':'Ready to lower the shade'),r('Window covered',Math.round(coverage*100)+'%'),r('Added spring winding',winding.toFixed(2)+' turns'),r('Coil diameter',((springRadius/.11)*100).toFixed(1)+'% of raised position'),r('Holding mechanism',held?'Upper pawl against a fixed stop':stage==='rewind'||stage==='clear'?'Both pawls clear':stage==='lower'?'Pawls passing the stationary ratchet':'Inspect the fixed hub and moving pawls'),r('Next action',held?'Choose Tug and release, then compare gentle and brisk release.':raised?'Lower the shade to cover the window again.':'Run the selected hand motion.') ]};
 });
 const render=result.update;
 function start(){const v=result.getState().values;stageClock=0;complete=false;if(v.operation===0){settleAngle=Math.min(Math.floor(maxAngle/step)*step,Math.max(Math.ceil(angle/step-1e-9),(v.coverage===1?Math.ceil:Math.round)(angleAt(windowHeight*v.coverage)/step))*step);destination=Math.min(maxAngle,settleAngle+.18);stage='lower';}else if(angle<=1e-9){stage='raised';complete=true;}else{destination=Math.min(maxAngle,angle+.48);settleAngle=Math.floor(destination/step)*step;stage='tug';}}
 result.update=next=>{const changed=next&&Object.keys(next).some(k=>next[k]!==result.getState().values[k]);if(changed){stage='ready';complete=false;stageClock=0;}return render(next);};
 function advance(seconds){if(!Number.isFinite(seconds)||seconds<=0)return render();if(stage==='ready')start();accumulator+=seconds;while(accumulator>=.01-1e-9&&!complete){accumulator-=.01;stageClock+=.01;const v=result.getState().values;
  if(stage==='lower'||stage==='tug'){angle=Math.min(destination,angle+(stage==='lower'?.9:1.8)*.01);if(angle>=destination){stage=stage==='lower'||v.release===0?'settle':'clear';stageClock=0;}}
  else if(stage==='settle'){angle=Math.max(settleAngle,angle-.6*.01);if(angle<=settleAngle){stage='held';complete=true;}}
  else if(stage==='clear'){if(stageClock>=.25){stage='rewind';stageClock=0;}}
  else if(stage==='rewind'){angle=Math.max(0,angle-2.8*.01);if(angle===0){stage='raised';complete=true;}}
  render();
 }if(complete)accumulator=0;return render();}
 function reset(){angle=0;stage='ready';stageClock=0;complete=false;accumulator=0;lastClock=0;render(result.defaults);}
 result.advance=advance;result.animate=clock=>{const dt=Math.max(0,clock-lastClock);lastClock=clock;return advance(dt);};result.reset=reset;
 result.playback={label:'Run selected action',stepLabel:'Advance one step',description:'Guided hand motions demonstrate lowering, gentle settling, tugging and spring rewind. Pause freezes the mechanism; Advance one step continues it.',advance,step:()=>advance(.2),complete:()=>complete,blocked:()=>false};
 result.followParts=['rail','carrier','pivot-0','pivot-1','pawl-0','pawl-1'];
 result.framingBounds=new THREE.Box3().setFromObject(result.root);result.framingBounds.min.y=Math.min(result.framingBounds.min.y,top-.08-total-.03-.285);
 result.resultPart={id:'system',context:'system',view:'front',focusOnComplete:true,label:'Inspect the window coverage',available:()=>true};return result;
}

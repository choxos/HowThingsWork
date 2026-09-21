import * as THREE from 'three';
import {houseModel,reading} from './house-model-kit.js';
import {fixed} from './format.js';
import {createMirrorCat} from './mirror-cat.js';

export const TELESCOPES_DEFAULTS=Object.freeze({mode:0,eyepiece:.5,aperture:.9,field:1,focus:0,tracking:1,latitude:45,declination:20});
const domains={mode:[0,4,1],eyepiece:[.25,1,.25],aperture:[.6,1.2,.3],field:[.5,2,.5],focus:[-.1,.1,.05],tracking:[0,3,1],latitude:[30,60,15],declination:[0,60,20]};
const names=['Astronomical refractor','Terrestrial refractor','Cassegrain reflector','Coudé reflector','Track the sky'],rad=Math.PI/180,duration=8,EPS=1e-9;
function controls(input){if(!input||typeof input!=='object'||Array.isArray(input))throw new TypeError('Expected telescope controls');for(const key of Object.keys(input))if(!Object.hasOwn(domains,key))throw new RangeError('Unknown '+key);const v={...TELESCOPES_DEFAULTS,...input};for(const [key,[lo,hi,step]] of Object.entries(domains)){if(!Number.isFinite(v[key])||v[key]<lo-EPS||v[key]>hi+EPS||Math.abs((v[key]-lo)/step-Math.round((v[key]-lo)/step))>1e-8)throw new RangeError('Invalid '+key);v[key]=Number(v[key].toFixed(12));}return v;}
export function telescopeSky(latitude,declination,hourAngle){
 if(![latitude,declination,hourAngle].every(Number.isFinite)||Math.abs(latitude)>90||Math.abs(declination)>90)throw new RangeError('Invalid sky coordinates');
 const p=latitude*rad,d=declination*rad,h=hourAngle*rad,east=-Math.cos(d)*Math.sin(h),north=Math.cos(p)*Math.sin(d)-Math.sin(p)*Math.cos(d)*Math.cos(h),up=Math.sin(p)*Math.sin(d)+Math.cos(p)*Math.cos(d)*Math.cos(h);
 return {altitude:Math.asin(Math.max(-1,Math.min(1,up)))/rad,azimuth:(Math.atan2(east,north)/rad+360)%360,vector:[east,up,north]};
}
const direction=(alt,az)=>[Math.cos(alt*rad)*Math.sin(az*rad),Math.sin(alt*rad),Math.cos(alt*rad)*Math.cos(az*rad)];
// Exact plane reflection after the paraxial powered mirrors. Both folds have x+y=c.
function fold(points,center,focus){const a=points.at(-1),dx=focus[0]-a[0],dy=focus[1]-a[1],c=center[0]+center[1],t=(c-a[0]-a[1])/(dx+dy),hit=[a[0]+t*dx,a[1]+t*dy],sum=focus[0]+focus[1]-c;points.push(hit);return [focus[0]-sum,focus[1]-sum];}
export function sampleTelescopes(input={},progress=1){
 const v=controls(input);if(!Number.isFinite(progress)||progress<0||progress>1)throw new RangeError('Invalid progress');
 const mode=v.mode===4?2:v.mode,reflector=mode>=2,F=reflector?18:3,relay=mode===1,focusPoint=mode===3?[3,-1]:reflector?[4,0]:[relay?5:3,0],eyeX=focusPoint[0]+v.eyepiece+v.focus,eyeY=focusPoint[1],imageSign=relay?1:-1;
 const s={values:v,modeName:names[v.mode],mode,progress,elapsed:duration*progress,F,focusPoint,eyeX,eyeY,imageHeight:2*F*Math.tan(v.field*rad/2),imageSign,magnification:imageSign*F/v.eyepiece,inFocus:v.focus===0,rays:[],divergence:0,area:Math.PI*(v.aperture*10)**2*(reflector?.75:1),exitPupil:200*v.aperture*v.eyepiece/F};
 for(const angle of [-v.field/2,0,v.field/2])for(const fraction of reflector?[-1,-.8,-.6,0,.6,.8,1]:[-1,-.5,0,.5,1]){
  const theta=-Math.tan(angle*rad),h=v.aperture*fraction,points=[[-3,h-3*theta]],ray={angle,theta,h,points,received:false,blocked:null,turns:[]};s.rays.push(ray);
  let y=h,u=theta,fx=focusPoint[0],fy=focusPoint[1]+(relay?-1:1)*F*theta;
  if(reflector){
   const shadow=h-2*theta;if(Math.abs(shadow)<v.aperture*.5-EPS){points.push([-2,shadow]);ray.blocked='Secondary shadow';continue;}
   points.push([0,h]);if(Math.abs(h)<v.aperture*.4-EPS){ray.blocked='Primary hole';continue;}
   u=theta-h/3;y=h+2*u;ray.turns.push({f:3,height:h,incoming:theta,outgoing:u});points.push([-2,y]);
   if(Math.abs(y)>v.aperture*.5+EPS){ray.blocked='Missed secondary';continue;}
   const before=u;u-=y/(-1.2);ray.turns.push({f:-1.2,height:y,incoming:before,outgoing:u});const hole=y+2*u;points.push([0,hole]);
   if(Math.abs(hole)>v.aperture*.4+EPS){ray.blocked='Primary-hole edge';continue;}
   if(mode===3){let target=[4,F*theta];target=fold(points,[1,0],target);target=fold(points,[1,-1],target);fx=target[0];fy=target[1];}
  }else{
   points.push([0,h]);u-=h/3;ray.turns.push({f:3,height:h,incoming:theta,outgoing:u});
   if(relay){points.push([3,3*theta]);y=h+4*u;points.push([4,y]);const before=u;u-=y/.5;ray.turns.push({f:.5,height:y,incoming:before,outgoing:u});}
  }
  points.push([fx,fy]);const last=points.at(-2),slope=(fy-last[1])/(fx-last[0]);y=fy+slope*(eyeX-fx);points.push([eyeX,y]);
  if(Math.abs(y-eyeY)>.65+EPS){ray.blocked='Eyepiece edge';continue;}
  u=slope-(y-eyeY)/v.eyepiece;ray.turns.push({f:v.eyepiece,height:y-eyeY,incoming:slope,outgoing:u});points.push([eyeX+.8,y+.8*u]);ray.received=true;ray.outputSlope=u;
 }
 for(const angle of [-v.field/2,0,v.field/2]){const bundle=s.rays.filter(r=>r.received&&r.angle===angle).map(r=>r.outputSlope);if(bundle.length)s.divergence=Math.max(s.divergence,Math.max(...bundle)-Math.min(...bundle));}
 s.received=s.rays.filter(r=>r.received).length;
 s.lightGain=s.area/(Math.PI*.35**2);
 const initial=telescopeSky(v.latitude,v.declination,-30),target=telescopeSky(v.latitude,v.declination,-30+15*progress),altitude=[1,3].includes(v.tracking)?target.altitude:initial.altitude,azimuth=[1,2].includes(v.tracking)?target.azimuth:initial.azimuth,aim=direction(altitude,azimuth),dot=aim.reduce((sum,x,i)=>sum+x*target.vector[i],0),error=Math.acos(Math.max(-1,Math.min(1,dot)))/rad;
 s.sky={initial,target,altitude,azimuth,aim,error,inField:error<=v.field/2+EPS,minutes:progress*60};
 s.outcome=v.mode===4?(s.sky.inField?'The target center remains inside the selected field.':'The target center has drifted outside the selected field.'):(s.inFocus?'Each admitted object-point bundle leaves the eyepiece parallel, for a relaxed eye.':'The shifted eyepiece sends each object-point bundle out with different slopes; infinity focus is lost.');return s;
}

export function createTelescopesModel(){
 const kit=houseModel('Telescopes'),{root,part,finish,control}=kit,system=part('system','Telescopes','Follow an ideal optical path or track the sky with two mount axes.');
 const optical=part('optical','Optical assembly','Powered surfaces use paraxial vertex-plane optics; the two coudé plane folds are exact.',[0,0,0],system),mount=part('mount','Two-axis mount','Azimuth turns about vertical; altitude tips about a horizontal axis.',[0,0,0],system),resultGroup=part('result','Image and eyepiece','The real image is viewed through an eyepiece. At correct spacing, the final image is at infinity.',[0,0,0],optical);
 const parts={};for(const [id,label,desc] of [['objective','Objective or primary','Collects light and forms the first real image.'],['secondary','Secondary and relay','A convex secondary extends the Cassegrain focus; the terrestrial convex relay reverses the image again.'],['folds','Coudé plane mirrors','Two additional plane reflections take the converging beam to a side focus.'],['rays','Ray paths','Blue incident rays and orange transmitted/reflected rays. Red crosses mark a blocked sample.'],['source','Distant cat reference','An angular reference only, not a nearby source. Incoming rays from each distant point are parallel.'],['image','Real image','A small flat cat marks the real focal image. Its displayed height follows the angular object size.'],['eyepiece','Eyepiece and eye','The eyepiece uses the real image as its object. Correct separation makes each outgoing bundle parallel.']])parts[id]=part(id,label,desc,[0,0,0],['image','eyepiece'].includes(id)?resultGroup:optical);
 const housing=part('housing','Cutaway tube and supports','A schematic open tube locates the powered elements. The rear beam and eyepiece station remain exposed in reflector views; supports do not add optical power.',[0,0,0],optical);
 const shell=new THREE.Mesh(new THREE.CylinderGeometry(1,1,1,48,1,true,Math.PI/2,Math.PI),new THREE.MeshStandardMaterial({color:0xc3d0c9,roughness:.8,side:THREE.DoubleSide}));shell.rotation.z=Math.PI/2;housing.add(shell);
 const collars=[0,1].map(()=>{const ring=new THREE.Mesh(new THREE.RingGeometry(1,1.045,48),new THREE.MeshStandardMaterial({color:0x617466,roughness:.7,side:THREE.DoubleSide}));ring.rotation.y=Math.PI/2;housing.add(ring);return ring;});
 const rail=kit.box([1,.13,.28],[0,0,0],'ink',housing),supports=[0,1,2].map(()=>kit.box([.12,1,.2],[0,0,0],'metal',housing));
 function line(parent,color,capacity=2){const geometry=new THREE.BufferGeometry(),array=new Float32Array(capacity*3);geometry.setAttribute('position',new THREE.BufferAttribute(array,3));const mesh=new THREE.Line(geometry,new THREE.LineBasicMaterial({color}));mesh.frustumCulled=false;parent.add(mesh);return {mesh,set(points){for(let i=0;i<capacity;i++){const p=points[Math.min(i,points.length-1)]||[0,0,0];array.set([p[0],p[1],p[2]||0],3*i);}geometry.setDrawRange(0,points.length);geometry.attributes.position.needsUpdate=true;geometry.computeBoundingBox();mesh.visible=points.length>1;}};}
 function arrow(parent,color){const body=line(parent,color),head=line(parent,color,3);return {body,set(a,b,p=1){if(p<=0){body.set([]);head.set([]);return;}const end=a.map((x,i)=>x+(b[i]-x)*Math.min(1,p)),dx=end[0]-a[0],dy=end[1]-a[1],len=Math.hypot(dx,dy);body.set([a,end]);if(len<.05){head.set([]);return;}const x=a[0]+dx*.55,y=a[1]+dy*.55;head.set([[x-.08*dx/len-.035*dy/len,y-.08*dy/len+.035*dx/len],[x,y],[x-.08*dx/len+.035*dy/len,y-.08*dy/len-.035*dx/len]]);},hide(){body.set([]);head.set([]);}};}
 function lens(parent){const mesh=new THREE.Mesh(new THREE.SphereGeometry(1,32,24),new THREE.MeshStandardMaterial({color:0x78bbcc,transparent:true,opacity:.25,depthWrite:false,roughness:.2}));parent.add(mesh);return mesh;}
 const objective=lens(parts.objective),relay=lens(parts.secondary),eyepiece=lens(parts.eyepiece);
 // Vertex-plane powers determine rays; these shallow surfaces communicate mirror shape only.
 function mirror(parent,inner){const geometry=new THREE.RingGeometry(inner,1,64,12),p=geometry.attributes.position;for(let i=0;i<p.count;i++){const y=p.getX(i),z=p.getY(i),r2=y*y+z*z;p.setXYZ(i,-.10*r2,y,z);}geometry.computeVertexNormals();const mesh=new THREE.Mesh(geometry,new THREE.MeshStandardMaterial({color:0xc3ccd0,metalness:.75,roughness:.2,side:THREE.DoubleSide}));parent.add(mesh);return mesh;}
 const primary=mirror(parts.objective,.4),secondary=mirror(parts.secondary,0),flats=[0,1].map(()=>{const mesh=kit.box([.025,1.5,1.1],[0,0,0],'metal',parts.folds);mesh.rotation.z=Math.PI/4;return mesh;});flats[0].position.set(1,0,0);flats[1].position.set(1,-1,0);
 const sourceCat=createMirrorCat(parts.source),imageCat=createMirrorCat(parts.image);sourceCat.position.set(-2.65,1.65,0);sourceCat.scale.setScalar(.65);
 const eye=new THREE.Group();parts.eyepiece.add(eye);const eyeball=kit.sphere(.13,[0,0,0],'cream',eye);eyeball.scale.set(.7,1,1);const iris=kit.sphere(.065,[-.085,0,0],'blue',eye);iris.scale.x=.3;const pupil=kit.sphere(.032,[-.105,0,0],'ink',eye);pupil.scale.x=.3;
 const imageFrame=line(parts.image,0x7d5a90,5),slots=Array.from({length:21},()=>({segments:Array.from({length:10},(_,i)=>arrow(parts.rays,i?0xb55628:0x1a6488)),miss:line(parts.rays,0xb22d2d,5)}));
 const yaw=new THREE.Group(),pitch=new THREE.Group();mount.add(yaw);yaw.add(pitch);const tube=kit.cylinder(.55,2.6,[0,0,0],'blue',pitch);tube.rotation.x=Math.PI/2;const rim=kit.ring(.55,.035,[0,0,1.32],'gold',pitch);kit.box([1.5,.15,1.1],[0,-.9,0],'ink',mount);kit.cylinder(.55,.15,[0,-.72,0],'metal',yaw);for(const x of [-.8,.8])kit.box([.15,1,.25],[x,-.25,0],'gold',yaw);kit.rod([-.9,0,0],[.9,0,0],.065,'metal',yaw);
 const targetLine=line(mount,0xb55628),aimLine=line(mount,0x1a6488),star=kit.sphere(.07,[0,0,0],'gold',mount),reticle=kit.ring(.035,.008,[0,0,0],'red',mount);
 const specs=[['mode','Arrangement','',names.map((label,value)=>({label,value}))],['eyepiece','Eyepiece focal length','× 100 mm'],['aperture','Objective radius','× 100 mm'],['field','Cat height / tracking field','°'],['focus','Eyepiece focus offset','× 100 mm'],['tracking','Mount motors','',[{value:0,label:'Both off'},{value:1,label:'Both axes track'},{value:2,label:'Azimuth only'},{value:3,label:'Altitude only'}]],['latitude','Observer latitude','° N'],['declination','Target declination','° N']];
 for(const [key,label,unit,options] of specs){const [min,max,step]=domains[key],enabledWhen=v=>['mode','field'].includes(key)||(['tracking','latitude','declination'].includes(key)?v.mode===4:v.mode!==4);control(key,label,min,max,step,TELESCOPES_DEFAULTS[key],unit,key==='field'?'Full angular cat height in optics; full circular field diameter in tracking.':key==='focus'?'Zero places the real image exactly one eyepiece focal length ahead of the eyepiece.':'Change this setting and compare the connected geometry and readings.',options,{primary:key==='mode',enabledWhen,visibleWhen:enabledWhen});}
 let elapsed=duration,lastClock=0,disposed=false;const fmt=(n,unit='',digits=1)=>fixed(n,digits)+(unit?' '+unit:'');
 const result=finish(v=>{const s=sampleTelescopes(v,elapsed/duration),track=v.mode===4,p=s.progress;optical.visible=!track;mount.visible=track;
  objective.visible=s.mode<2;objective.scale.set(.10,v.aperture,v.aperture);primary.visible=s.mode>=2;primary.scale.setScalar(v.aperture);secondary.visible=s.mode>=2;secondary.position.x=-2;secondary.scale.set(v.aperture*.5,v.aperture*.5,v.aperture*.5);relay.visible=s.mode===1;relay.position.x=4;relay.scale.set(.07,.7,.7);parts.folds.visible=s.mode===3;
  const tubeRadius=Math.max(v.aperture,.7)+.10,tubeStart=s.mode>=2?-2.1:-.1,tubeEnd=s.mode>=2?.12:s.eyeX+.1,railStart=tubeStart-.1,railEnd=s.eyeX+.18,railY=Math.min(-tubeRadius-.35,s.eyeY-1);
  shell.position.x=(tubeStart+tubeEnd)/2;shell.scale.set(tubeRadius,tubeEnd-tubeStart,tubeRadius);
  collars.forEach((ring,i)=>{ring.position.x=i?tubeEnd:tubeStart;ring.scale.setScalar(tubeRadius);});
  rail.position.set((railStart+railEnd)/2,railY,0);rail.scale.x=railEnd-railStart;
  supports.forEach((post,i)=>{const top=i===2?s.eyeY-.65:-tubeRadius,base=railY+.065;post.position.set(i===2?s.eyeX:i===0?tubeStart+.12:tubeEnd-.12,(base+top)/2,0);post.scale.y=top-base;});
  eyepiece.position.set(s.eyeX,s.eyeY,0);eyepiece.scale.set(.07,.65,.65);eye.position.set(s.eyeX+.8,s.eyeY,0);
  parts.image.visible=p>=.75;imageCat.position.set(...s.focusPoint,0);imageCat.scale.set(.006,s.imageSign*s.imageHeight,s.imageSign*s.imageHeight);const [x,y]=s.focusPoint,h=s.imageHeight;imageFrame.set([[x,y-.6*h,-.42*h],[x,y+.6*h,-.42*h],[x,y+.6*h,.42*h],[x,y-.6*h,.42*h],[x,y-.6*h,-.42*h]]);
  slots.forEach((slot,i)=>{slot.segments.forEach(segment=>segment.hide());slot.miss.set([]);const r=s.rays[i];if(!r)return;const count=r.points.length-1;for(let j=0;j<count;j++)slot.segments[j].set(r.points[j],r.points[j+1],Math.max(0,Math.min(1,p*count-j)));if(r.blocked&&p===1){const [x,y]=r.points.at(-1);slot.miss.set([[x-.05,y-.05],[x+.05,y+.05],[x,y],[x-.05,y+.05],[x+.05,y-.05]]);}});
  yaw.rotation.y=s.sky.azimuth*rad;pitch.rotation.x=-s.sky.altitude*rad;const target=s.sky.target.vector.map(n=>n*2.5),aim=s.sky.aim.map(n=>n*2.5);targetLine.set([[0,0,0],target]);aimLine.set([[0,0,0],aim]);star.position.set(...target);reticle.position.set(...aim);reticle.quaternion.setFromUnitVectors(new THREE.Vector3(0,0,1),new THREE.Vector3(...s.sky.aim));reticle.scale.setScalar(2.5*Math.tan(v.field*rad/2)/.035);
  const details=track?[
   reading('Target altitude',fmt(s.sky.target.altitude,'°'),'Elevation of the orange celestial target above the local horizon.'),
   reading('Target azimuth',fmt(s.sky.target.azimuth,'°'),'Direction around the horizon, measured eastward from north: north 0°, east 90°.'),
   reading('Mount altitude',fmt(s.sky.altitude,'°'),'Tube elevation. The altitude motor follows the target; when off, it holds the starting elevation.'),
   reading('Mount azimuth',fmt(s.sky.azimuth,'°'),'Fork direction around the vertical axis. The azimuth motor follows the target or holds its starting direction.'),
   reading('Pointing error',fmt(s.sky.error,'°'),'True angle between telescope aim and target direction. The target center is inside the field only if this angle is no more than half the selected field diameter.'),
   reading('Target in field',s.sky.inField?'Yes':'No','Tests the target center against the red aiming circle. Center tracking does not remove rotation of the surrounding star field.'),
   reading('Sidereal time elapsed',fmt(s.sky.minutes,'min'),'The target hour angle advances 15° in 60 sidereal minutes, compressed into eight display seconds.'),
  ]:[
   reading('Effective focal length',fmt(s.F*100,'mm'),'The objective or mirror pair converts incoming angle to real-image height. A folded reflector can have an effective focal length longer than its tube.'),
   reading('Paraxial angular magnification',s.inFocus?fmt(s.magnification,'×'):'Unavailable: eyepiece out of focus','First-order ratio of viewing angles at relaxed-eye focus. A minus sign means inverted; a plus sign means upright. Large drawn output angles exceed this approximation.'),
   reading('Real image height',fmt(s.imageHeight*100,'mm'),'Full height of the focal image formed by the selected angular cat height. Changing the eyepiece does not change this intermediate image.'),
   reading('Image orientation',s.imageSign>0?'Upright':'Inverted','Orientation of the real focal image. The terrestrial relay adds a second inversion, restoring an upright view.'),
   reading('Collecting area',fmt(s.area,'cm²'),'Geometric entrance area: πR² for a clear lens, or three-quarters of it after the chosen reflector secondary obstruction. Coating losses and off-axis vignetting are excluded.'),
   reading('Area relative to a 7 mm pupil',fmt(s.lightGain,'×'),'Ratio of collecting areas, not a prediction of perceived brightness. A smaller eye pupil may reject part of the emerging beam.'),
   reading('Exit pupil diameter',s.inFocus?fmt(s.exitPupil,'mm'):'Unavailable: eyepiece out of focus','Outer objective diameter divided by magnification magnitude at correct spacing. The reflector pupil also has a central obstruction; a 7 mm eye cannot accept a larger beam in full.'),
   reading('Outgoing bundle slope spread',fmt(s.divergence,'',3),'Largest slope difference within a received object-point bundle. Zero means parallel output at infinity focus. A positive value shows lost focus; this is not an angle in degrees.'),
   reading('Received sample rays',s.received+' / '+s.rays.length,'Paths admitted by the secondary, primary hole and eyepiece checks. Samples are geometric probes, not equal portions of light power.'),
  ];
  return {state:s,readings:[
   reading('Outcome',s.outcome,'Optics playback reveals a fixed ray solution. Tracking playback changes the target direction and the motor-controlled mount orientation.'),
   reading('Arrangement',s.modeName,'Choose refracting or reflecting optics, or the separate two-axis tracking demonstration. Only relevant controls and readings are shown.'),
   ...details,
   reading('Trace progress',fmt(p*100,'%'),'Progress through the teaching construction or the compressed tracking hour, not light transmission.'),
   reading('Trace time',fmt(elapsed,'s',2),'Eight display seconds show the complete ray path or one sidereal hour. This is not the light-travel time.'),
  ]};
 });
 const render=result.update;result.advance=seconds=>{if(Number.isFinite(seconds)&&seconds>0)elapsed=Math.min(duration,elapsed+seconds);return render();};result.animate=clock=>{if(Number.isFinite(clock)){const dt=Math.max(0,clock-lastClock);lastClock=clock;return result.advance(dt);}return render();};result.reset=()=>{elapsed=lastClock=0;return render(result.defaults);};result.actions=[['Inspect start (0%)',0],['Inspect quarter (25%)',.25],['Inspect three quarters (75%)',.75],['Inspect result (100%)',1]].map(([label,p])=>({label,part:'system',view:'front',replay:false,run(){elapsed=p*duration;return render();}}));
 result.playback={label:'Trace optics or track the sky',description:'Powered lenses and curved mirrors use ideal paraxial vertex-plane optics. Coudé plane folds use geometric reflection. The distant cat is an angular reference, not a nearby parallel-ray source. Eight seconds reveal the rays or advance one sidereal hour of sky motion. Blue marks the telescope aim and orange the target direction in tracking mode.',stepLabel:'Advance construction by one percent',advance:result.advance,step:()=>result.advance(.08),complete:()=>elapsed>=duration,blocked:()=>false};
 result.parts.find(part=>part.id==='image').maxZoom=1000;result.resultPart={id:'image',label:'Inspect real image',view:'side',focusOnComplete:false,available:()=>result.getState().values.mode!==4&&elapsed>=6};root.rotation.y=-.3;result.initialPart='system';result.initialView='front';result.frameVisibleOnly=true;result.framePadding=.55;result.autoFramePart='system';result.selectionOutline=false;result.transparentBackground=true;result.topology={parts,optical,mount,housing,shell,collars,rail,supports,sourceCat,imageCat,eye,objective,primary,secondary,relay,eyepiece,flats,slots,yaw,pitch,star,reticle};const dispose=result.dispose;result.dispose=()=>{if(!disposed){disposed=true;dispose();}};return result;
}

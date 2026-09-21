import * as THREE from 'three';
import {houseModel, reading} from './house-model-kit.js';
import {fixed} from './format.js';
import {createMirrorCat,mirrorCatPose,applyMirrorCatPose,catMirrorMaterial} from './mirror-cat.js';

export const MIRRORS_DEFAULTS = Object.freeze({mode:0,distance:2,height:.6,aperture:.8,radius:3,bearing:0,focus:1,offset:0,upperTilt:0,lowerTilt:0,secondMirror:1});
export const MIRRORS_CONSTANTS = Object.freeze({duration:8,screenX:-4,eye:[-4,-1.1],pupil:.06,markerHalfAngle:5,periscopeHalfLength:.65,detectorX:3,detectorY:-1.2,detectorHalfOpening:.22,viewport:[-4.6,4.6,-2.6,2.6]});
const C=MIRRORS_CONSTANTS,RAD=Math.PI/180,DEG=180/Math.PI,EPS=1e-10;
const domains={mode:[0,3,1],distance:[1,3,.5],height:[.3,1.2,.3],aperture:[.4,.8,.2],radius:[3,6,1.5],bearing:[-60,60,10],focus:[.8,1.2,.2],offset:[-.3,.3,.1],upperTilt:[-10,10,5],lowerTilt:[-10,10,5],secondMirror:[0,1,1]};
const names=['Flat mirror','Convex driving mirror','Concave headlamp','Periscope'];
const add=(a,b)=>[a[0]+b[0],a[1]+b[1]],sub=(a,b)=>[a[0]-b[0],a[1]-b[1]],mul=(a,k)=>[a[0]*k,a[1]*k],dot=(a,b)=>a[0]*b[0]+a[1]*b[1],cross=(a,b)=>a[0]*b[1]-a[1]*b[0];
const unit=a=>{const n=Math.hypot(...a);if(!Number.isFinite(n)||n<1e-15)throw new RangeError('Direction must be finite and nonzero');return mul(a,1/n);};
export function reflectMirrorRay(direction,normal){const d=unit(direction),n=unit(normal);return sub(d,mul(n,2*dot(d,n)));}
export function intersectMirrorSegment(origin,direction,center,tangent,halfLength){
 const d=unit(direction),u=unit(tangent),den=cross(d,u);if(Math.abs(den)<1e-12)return null;
 const delta=sub(center,origin),travel=cross(delta,u)/den,coordinate=cross(delta,d)/den;
 if(travel<=EPS||Math.abs(coordinate)>halfLength+EPS)return null;
 return {point:add(origin,mul(d,travel)),travel,coordinate};
}
function validated(input={}){if(!input||typeof input!=='object'||Array.isArray(input))throw new TypeError('Expected control values');for(const key of Object.keys(input))if(!Object.hasOwn(domains,key))throw new RangeError('Unknown control '+key);const v={...MIRRORS_DEFAULTS,...input};for(const [key,[lo,hi,step]] of Object.entries(domains)){const x=v[key];if(!Number.isFinite(x)||x<lo-EPS||x>hi+EPS||Math.abs((x-lo)/step-Math.round((x-lo)/step))>1e-8)throw new RangeError('Invalid '+key);v[key]=Number(x.toFixed(12));}return v;}
function boundary(point,direction){const d=unit(direction),[l,r,b,t]=C.viewport;const times=[];if(d[0]>EPS)times.push((r-point[0])/d[0]);if(d[0]<-EPS)times.push((l-point[0])/d[0]);if(d[1]>EPS)times.push((t-point[1])/d[1]);if(d[1]<-EPS)times.push((b-point[1])/d[1]);const dt=Math.min(...times.filter(x=>x>EPS));return add(point,mul(d,Number.isFinite(dt)?dt:0));}
function rayRecord(source,hit,normal,received=false){const incident=unit(sub(hit,source)),reflected=reflectMirrorRay(incident,normal);return {source,hit,normal:unit(normal),incident,reflected,received};}
function angle(a,b){return Math.acos(Math.max(-1,Math.min(1,dot(unit(a),unit(b)))))*DEG;}
export function sampleMirrors(input={}){
 const v=validated(input),s={values:v,mode:v.mode,modeName:names[v.mode],rays:[],surfaces:[],outcome:'',normal:null};
 if(v.mode===0){
  s.object=[[-v.distance,-v.height/2],[-v.distance,v.height/2]];s.virtualImage=[[v.distance,-v.height/2],[v.distance,v.height/2]];s.eye=C.eye.slice();s.imageDistance=v.distance;s.imageHeightRatio=1;
  s.surfaces=[{kind:'flat',center:[0,0],tangent:[0,1],halfLength:v.aperture}];
  for(let point=0;point<2;point++)for(const pupilOffset of [-C.pupil,0,C.pupil]){
   const source=s.object[point],virtual=s.virtualImage[point],eye=[C.eye[0],C.eye[1]+pupilOffset],f=-eye[0]/(virtual[0]-eye[0]),hit=add(eye,mul(sub(virtual,eye),f));
   const received=Math.abs(hit[1])<=v.aperture+EPS,ray=rayRecord(source,hit,[-1,0],received);
   Object.assign(ray,{objectPoint:point,eye,virtual,apertureHit:received,end:received?eye:boundary(source,ray.incident)});s.rays.push(ray);
  }
  s.received=s.rays.filter(r=>r.received).length;s.outcome=`${s.received} of 6 sampled paths reach the pupil. The geometric image is upright behind the mirror.`;
  s.normal=s.rays.find(r=>r.received&&r.objectPoint===1)||null;
 }else if(v.mode===1){
  s.eye=[-v.distance,0];const point=y=>[v.radius-Math.sqrt(v.radius*v.radius-y*y),y],theta=y=>Math.atan2(y,v.distance+point(y)[0])+2*Math.asin(y/v.radius),alpha=y=>Math.atan2(y,v.distance+point(y)[0]);
  const edge=theta(v.aperture);s.convexField=2*edge*DEG;s.flatField=2*Math.atan2(v.aperture,v.distance)*DEG;s.sourceAngularSpan=10;
  const solve=bearing=>{const target=bearing*RAD;if(Math.abs(target)>edge+EPS)return null;let lo=-v.aperture,hi=v.aperture;for(let i=0;i<60;i++){const mid=(lo+hi)/2;if(theta(mid)<target)lo=mid;else hi=mid;}return (lo+hi)/2;};
  s.marker={bearing:v.bearing,low:solve(v.bearing-5),center:solve(v.bearing),high:solve(v.bearing+5)};
  s.markerVisibility=s.marker.low!==null&&s.marker.high!==null?'Fully visible':(v.bearing+5<-edge*DEG||v.bearing-5>edge*DEG)?'Not visible':'Partially visible';
  s.apparentAngularSpan=s.markerVisibility==='Fully visible'?(alpha(s.marker.high)-alpha(s.marker.low))*DEG:null;
  s.surfaces=[{kind:'convex',radius:v.radius,aperture:v.aperture}];
  for(const [role,y] of [['field-low',-v.aperture],['field-high',v.aperture],['marker-low',s.marker.low],['marker-center',s.marker.center],['marker-high',s.marker.high]]){
   if(y===null)continue;const hit=point(y),n=unit(sub(hit,[v.radius,0])),back=reflectMirrorRay(sub(hit,s.eye),n),source=boundary(hit,back),ray=rayRecord(source,hit,n,true);Object.assign(ray,{role,bearing:theta(y)*DEG,apparentAngle:alpha(y)*DEG,end:s.eye});s.rays.push(ray);
  }
  s.flatComparison=[-v.aperture,v.aperture].map(y=>{const hit=[0,y],back=reflectMirrorRay(sub(hit,s.eye),[-1,0]);return {hit,source:boundary(hit,back),eye:s.eye};});
  s.normal=s.rays.find(r=>r.role==='marker-center')||s.rays[0];s.outcome=`${s.markerVisibility}. Wider angular coverage is compared with an equal flat aperture; no perfect spherical image is assumed.`;
 }else if(v.mode===2){
  s.source=[-v.focus+v.offset,0];s.focus=[-v.focus,0];s.surfaces=[{kind:'parabola',focus:v.focus,aperture:v.aperture}];
  for(let i=0;i<9;i++){const y=-v.aperture+2*v.aperture*i/8,hit=[-y*y/(4*v.focus),y],ray=rayRecord(s.source,hit,[-1,-y/(2*v.focus)],true),travel=(C.screenX-hit[0])/ray.reflected[0];if(travel<=0)throw new RangeError('Headlamp ray does not reach front screen');ray.end=add(hit,mul(ray.reflected,travel));ray.angle=Math.atan2(ray.reflected[1],-ray.reflected[0])*DEG;s.rays.push(ray);}
  const ys=s.rays.map(r=>r.end[1]),angles=s.rays.map(r=>r.angle);s.screenFootprint=Math.max(...ys)-Math.min(...ys);s.angularSpread=Math.max(...angles)-Math.min(...angles);s.collimated=s.angularSpread<1e-9;
  s.normal=s.rays.at(-1);s.outcome=s.collimated?'At the focus: reflected rays are parallel.':'Off focus: reflected rays are not parallel. A small footprint at one screen does not establish collimation.';
 }else{
  const surface=(y,tilt)=>{const a=(-45+tilt)*RAD;return {kind:'segment',center:[0,y],tangent:[Math.cos(a),Math.sin(a)],normal:y>0?[Math.sin(a),-Math.cos(a)]:[-Math.sin(a),Math.cos(a)],halfLength:C.periscopeHalfLength};};
  const upper=surface(1.2,v.upperTilt),lower=surface(-1.2,v.lowerTilt);s.surfaces=v.secondMirror?[upper,lower]:[upper];s.lowerMount=lower;s.object=[[-3,1.05],[-3,1.35]];s.eye=[C.detectorX,C.detectorY];s.receivedPattern=[];
  for(const y of [1.05,1.2,1.35]){
   const source=[-3,y],first=intersectMirrorSegment(source,[1,0],upper.center,upper.tangent,upper.halfLength);if(!first)throw new RangeError('Source misses upper mirror');
   const ray=rayRecord(source,first.point,upper.normal),second=v.secondMirror?intersectMirrorSegment(first.point,ray.reflected,lower.center,lower.tangent,lower.halfLength):null;
   Object.assign(ray,{secondHit:second?.point||null,secondNormal:second?lower.normal:null,secondReflected:second?reflectMirrorRay(ray.reflected,lower.normal):null});
   const start=ray.secondHit||ray.hit,d=ray.secondReflected||ray.reflected,travel=d[0]>EPS?(C.detectorX-start[0])/d[0]:null,detector=second&&travel>EPS?add(start,mul(d,travel)):null;
   ray.received=Boolean(second&&detector&&Math.abs(detector[1]-C.detectorY)<=C.detectorHalfOpening+EPS);ray.detector=detector;ray.end=ray.received?detector:boundary(start,d);ray.reason=!v.secondMirror?'Lower mirror missing':!second?'Misses lower mirror':!ray.received?'Misses detector':'Received';s.rays.push(ray);if(ray.received)s.receivedPattern.push(detector[1]);
  }
  s.received=s.rays.filter(r=>r.received).length;s.directBlocked=true;s.directHit=[-1,.4];s.orientationPreserved=v.upperTilt===v.lowerTilt&&Boolean(v.secondMirror);s.normal=s.rays[1];s.outcome=`${s.received} of 3 rays reach the detector. ${!v.secondMirror?'The lower reflection is absent.':s.received===3?'The bent path clears the direct-line obstacle.':'Finite mirror or detector apertures reject misaligned paths.'}`;
 }
 if(s.normal){s.incidentAngle=angle(mul(s.normal.incident,-1),s.normal.normal);s.reflectedAngle=angle(s.normal.reflected,s.normal.normal);}
 return s;
}

// Finite cat points are separate from the distant angular field comparison.
// Curved surfaces do not in general give all reflected rays one common image.
export function sampleCatConstruction(values){
 const s=sampleMirrors(values),pose=mirrorCatPose(s.values),rays=[];
 if(s.mode===0)return s.rays;
 if(s.mode===3){
  const reflectPoint=(p,surface)=>sub(p,mul(surface.normal,2*dot(sub(p,surface.center),surface.normal)));
  for(const ray of s.rays){const firstImage=reflectPoint(ray.source,s.surfaces[0]);const virtual=ray.secondHit?reflectPoint(firstImage,s.surfaces[1]):firstImage;rays.push({...ray,virtual,extensionStart:ray.secondHit||ray.hit,extensionDirection:mul(ray.secondReflected||ray.reflected,-1)});}
  return rays;
 }
 const surface=s.surfaces[0],v=s.values;
 for(const end of [-.5,.5]){
  const source=add(pose.position.slice(0,2),mul([-pose.direction[1],pose.direction[0]],pose.height*end));
  for(const fraction of [-.6,0,.6]){
   const y=fraction*v.aperture,hit=surface.kind==='convex'?[v.radius-Math.sqrt(v.radius**2-y*y),y]:[-y*y/(4*v.focus),y];
   const normal=surface.kind==='convex'?sub(hit,[v.radius,0]):[-1,-y/(2*v.focus)],ray=rayRecord(source,hit,normal);
   ray.end=boundary(hit,ray.reflected);ray.virtual=add(hit,mul(ray.reflected,-2));ray.extensionStart=hit;ray.objectPoint=end;rays.push(ray);
  }
 }
 return rays;
}

export function createMirrorsModel(){
 const kit=houseModel('Mirrors'),{root,part,box,control,finish}=kit;
 const ink=0x263c35,blue=0x14557d,orange=0x993f18,gray=0x65716c,purple=0x6b468b,red=0x9e2828;
 const system=part('system','Mirrors','A geometrical-optics section. Distances are illustrative centimeters; trace playback is a teaching construction, not light-travel time.');
 const parts={};for(const [id,name,description] of [
  ['mirror','Reflecting surfaces','The silver surface has real width and thickness. Its front cross-section follows the exact optical profile; finite ends reject rays.'],['source','Cat object','A three-dimensional cat faces the mirror in every arrangement. The point-source headlamp experiment samples its center; distant field guides are a separate angular comparison.'],['eye','Eye or detector','Only paths within the stated pupil or detector opening are received.'],['rays','Physical light paths','Blue incident paths and orange reflected paths travel on the front side of the reflecting surface. Arrowheads indicate their physical direction.'],['image','Geometric constructions','Purple dashed lines extend the cat rays backward. They are not light behind a mirror. Curved rays need not share one exact image point; a pale whole cat is drawn only for plane-mirror constructions.'],['normal','Surface normal','The normal is perpendicular to the actual reflecting surface at the selected hit. Angles are measured from it.'],['screen','Headlamp screen','The screen samples one plane. Small width here alone does not prove that the rays are parallel.'],['obstacle','Periscope obstacle and supports','An opaque obstacle blocks the direct object-to-detector line; the aligned two-reflection route passes above and below it.']])parts[id]=part(id,name,description,[0,0,0],system);
 const textures=new Set(),labels=[],ownedMaterials=new Set();
 function line(parent,color,capacity=2,dashed=false){const a=new Float32Array(capacity*3),geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.BufferAttribute(a,3).setUsage(THREE.DynamicDrawUsage));geometry.setDrawRange(0,0);if(dashed)geometry.setAttribute('lineDistance',new THREE.BufferAttribute(new Float32Array(capacity),1));const material=dashed?new THREE.LineDashedMaterial({color,dashSize:.085,gapSize:.06}):new THREE.LineBasicMaterial({color});ownedMaterials.add(material);const object=new THREE.Line(geometry,material);object.frustumCulled=false;parent.add(object);return {object,geometry,capacity,set(points){if(points.length>capacity)throw new RangeError('Line capacity exceeded');let distance=0;for(let i=0;i<points.length;i++){a[3*i]=points[i][0];a[3*i+1]=points[i][1];a[3*i+2]=points[i][2]??.025;if(i)distance+=Math.hypot(points[i][0]-points[i-1][0],points[i][1]-points[i-1][1]);if(dashed)geometry.attributes.lineDistance.array[i]=distance;}for(let i=points.length;i<capacity;i++){a[3*i]=points.at(-1)?.[0]||0;a[3*i+1]=points.at(-1)?.[1]||0;a[3*i+2]=.025;}geometry.setDrawRange(0,points.length);geometry.attributes.position.needsUpdate=true;if(dashed)geometry.attributes.lineDistance.needsUpdate=true;geometry.computeBoundingBox();object.visible=points.length>1;}};}
 function segment(parent,color,dashed=false){const body=line(parent,color,2,dashed),head=line(parent,color,3);return {body,head,set(a,b,progress=1,arrow=true){if(progress<=0||Math.hypot(...sub(a,b))<1e-9){body.set([]);head.set([]);return;}const end=add(a,mul(sub(b,a),Math.min(1,progress)));body.set([a,end]);if(!arrow){head.set([]);return;}const d=unit(sub(end,a)),mid=add(a,mul(sub(end,a),.64)),rear=sub(mid,mul(d,.13)),side=mul([-d[1],d[0]],.055);head.set([add(rear,side),mid,sub(rear,side)]);},hide(){body.set([]);head.set([]);}};}
 function pointMarker(parent,color,open=false,r=.06){const object=line(parent,color,33);object.set(Array.from({length:33},(_,i)=>[r*Math.cos(i*Math.PI/16),r*Math.sin(i*Math.PI/16)]));if(!open){const crossbar=line(parent,color,2);crossbar.set([[-r,0],[r,0]]);object.crossbar=crossbar;}return {object:object.object,set(p,visible=true){object.object.position.set(p[0],p[1],0);object.object.visible=visible;if(object.crossbar){object.crossbar.object.position.copy(object.object.position);object.crossbar.object.visible=visible;}}};}
 const reflectors=[];
 function reflector(){
  const rows=65,cols=33,layer=rows*cols,positions=new Float32Array(layer*2*3),indices=[];
  const quad=(a,b,c,d)=>indices.push(a,b,c,a,c,d);
  for(let i=0;i<rows-1;i++)for(let j=0;j<cols-1;j++){const a=i*cols+j;quad(a,a+cols,a+cols+1,a+1);quad(a+layer,a+1+layer,a+cols+1+layer,a+cols+layer);}
  for(let i=0;i<rows-1;i++)for(const j of [0,cols-1]){const a=i*cols+j;quad(a,a+layer,a+cols+layer,a+cols);}
  for(let j=0;j<cols-1;j++)for(const i of [0,rows-1]){const a=i*cols+j;quad(a,a+1,a+1+layer,a+layer);}
  const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.BufferAttribute(positions,3));geometry.setIndex(indices);
  const material=new THREE.MeshStandardMaterial({color:0xe6edf0,metalness:1,roughness:.08,side:THREE.DoubleSide});ownedMaterials.add(material);
  const mesh=new THREE.Mesh(geometry,material);parts.mirror.add(mesh);const face=line(parts.mirror,ink,rows),stand=box([.15,.15,.13],[0,0,-.135],'metal',parts.mirror);
  const data={mesh,face,stand,capacity:rows,rows,cols,set(surface,cutaway=false){
   mesh.visible=face.object.visible=Boolean(surface);stand.visible=false;if(!surface)return;
   const ps=[];
   for(let i=0;i<rows;i++)for(let j=0;j<cols;j++){
    const t=2*i/(rows-1)-1,half=surface.halfLength??surface.aperture,y=t*half;
    const width=surface.kind==='parabola'?Math.sqrt(Math.max(0,half*half-y*y)):surface.kind==='segment'?.65:.8;
    const z=(cutaway?j/(cols-1)-1:2*j/(cols-1)-1)*width;
    let p,n;
    if(surface.kind==='flat'){p=[0,y,z];n=[-1,0,0];}
    else if(surface.kind==='segment'){const q=add(surface.center,mul(surface.tangent,y));p=[...q,z];n=[...surface.normal,0];}
    else if(surface.kind==='convex'){p=[surface.radius-Math.sqrt(surface.radius**2-y*y-z*z),y,z];n=new THREE.Vector3(p[0]-surface.radius,y,z).normalize().toArray();}
    else{p=[-(y*y+z*z)/(4*surface.focus),y,z];n=new THREE.Vector3(-1,-y/(2*surface.focus),-z/(2*surface.focus)).normalize().toArray();}
    const index=i*cols+j;positions.set(p,index*3);positions.set(p.map((x,k)=>x-.045*n[k]),(index+layer)*3);
    if(j===(cutaway?cols-1:(cols-1)/2))ps.push([p[0],p[1],.025]);
   }
   geometry.attributes.position.needsUpdate=true;geometry.computeVertexNormals();geometry.computeBoundingBox();face.set(ps);face.object.visible=cutaway;data.surface=surface;data.cutaway=cutaway;
  }};reflectors.push(data);return data;
 }
 reflector();reflector();
 const sourceCat=createMirrorCat(parts.source),imageCat=createMirrorCat(parts.image,true);
 reflectors.forEach((r,i)=>{r.mesh.material.dispose();r.mesh.material=catMirrorMaterial(root,sourceCat,reflectors,i);r.mesh.onBeforeRender=(_renderer,_scene,camera)=>r.mesh.material.userData.update(camera);});
 const sourceArrow=segment(parts.source,blue),imageArrow=segment(parts.image,purple,true),eyeOpening=segment(parts.eye,ink),screenLine=segment(parts.screen,ink),normalLine=segment(parts.normal,gray,true),directLine=segment(parts.obstacle,red,true);
 const sourcePoint=pointMarker(parts.source,orange,false,.075),focusPoint=pointMarker(parts.source,purple,true,.065);
 const sourceSupport=box([.13,.13,.13],[0,0,-.135],'metal',parts.source),eyeSupport=box([.14,.14,.13],[0,0,-.135],'metal',parts.eye);
 const detectorHits=Array.from({length:3},()=>pointMarker(parts.eye,orange,false,.045));
 const eyeBody=new THREE.Group();parts.eye.add(eyeBody);
 for(const [size,color,z] of [[[.19,.12,.08],0xf4f6f6,0],[[.075,.075,.035],0x397b9d,.073],[[.036,.045,.018],0x152e38,.105]]){
  const material=new THREE.MeshStandardMaterial({color,roughness:.3});ownedMaterials.add(material);const mesh=new THREE.Mesh(new THREE.SphereGeometry(1,20,12),material);mesh.scale.set(...size);mesh.position.z=z;eyeBody.add(mesh);
 }
 const eyeMark=pointMarker(parts.eye,ink,true,.10),screenHits=Array.from({length:9},()=>pointMarker(parts.screen,orange,true,.045));
 const obstacle=box([.07,1.2,.22],[-1,0,-.09],'ink',parts.obstacle);
 const upperHousing=line(parts.obstacle,gray,5),lowerHousing=line(parts.obstacle,gray,5),tubeLeft=line(parts.obstacle,gray,2),tubeRight=line(parts.obstacle,gray,2);
 upperHousing.set([[-.72,1.75],[.72,1.75],[.72,.7],[-.72,.7],[-.72,1.75]]);lowerHousing.set([[-.72,-.7],[.72,-.7],[.72,-1.75],[-.72,-1.75],[-.72,-.7]]);tubeLeft.set([[-.72,.7],[-.72,-.7]]);tubeRight.set([[.72,.7],[.72,-.7]]);
 const raySlots=Array.from({length:9},()=>({incident:segment(parts.rays,blue),reflected:segment(parts.rays,orange),second:segment(parts.rays,orange),extension:segment(parts.image,purple,true),miss:pointMarker(parts.rays,red,true,.065)}));
 const catRaySlots=Array.from({length:6},()=>({incident:segment(parts.rays,blue),reflected:segment(parts.rays,orange),extension:segment(parts.image,purple,true)}));
 const comparisons=Array.from({length:2},()=>({incoming:segment(parts.image,gray,true),outgoing:segment(parts.image,gray,true)}));
 const gauge=line(parts.image,gray,65),markerSpan=line(parts.image,purple,17),markerDot=pointMarker(parts.image,purple,false,.065);gauge.set(Array.from({length:65},(_,i)=>{const a=(-70+140*i/64)*RAD;return [3.4-.75*Math.cos(a),.75*Math.sin(a)];}));
 const controls=[['mode','Arrangement','', 'Choose an optical arrangement.',names.map((label,value)=>({label,value})),()=>true],['distance','Object / eye distance','cm','Flat: object distance. Convex: eye distance. Other modes use fixed positions.',null,v=>v.mode<2],['height','Cat height','cm','Only the flat-mirror cat height changes.',null,v=>v.mode===0],['aperture','Mirror half-height','cm','Finite reflecting aperture, from the axis to either edge.',null,v=>v.mode<3],['radius','Convex radius','cm','Radius of the actual spherical cap; larger means flatter.',null,v=>v.mode===1],['bearing','Distant marker bearing','°','Center of a ten-degree distant marker. Only the convex scene uses this input.',null,v=>v.mode===1],['focus','Parabolic focal distance','cm','Changes the actual parabolic profile and nominal bulb focus.',null,v=>v.mode===2],['offset','Bulb offset from focus','cm','Positive moves toward the vertex; negative moves away.',null,v=>v.mode===2],['upperTilt','Upper mirror tilt','°','Added to the baseline minus45° tangent.',null,v=>v.mode===3],['lowerTilt','Lower mirror tilt','°','Installed lower mirror only: added to the baseline minus45° tangent.',null,v=>v.mode===3&&v.secondMirror===1],['secondMirror','Lower mirror','', 'Removing this reflecting surface leaves the support in the cutaway.',[{value:0,label:'Missing'},{value:1,label:'Installed'}],v=>v.mode===3]];
 for(const [key,name,unitText,help,options,enabledWhen] of controls){const [min,max,step]=domains[key];control(key,name,min,max,step,MIRRORS_DEFAULTS[key],unitText,help,options,{primary:key==='mode',enabledWhen,visibleWhen:enabledWhen});}
 let elapsed=C.duration,lastClock=0,lastValues='',sample=null,disposed=false,showPaths=true,surfaceCutaway=false,diagramView=false;
 const fmt=(x,unitText='')=>x===undefined||x===null?'Unavailable: no received upper-point ray':fixed(x,2)+(unitText?' '+unitText:'');
 const result=finish(values=>{
  for(const key of Object.keys(values))values[key]=Number(values[key].toFixed(12));
  const key=JSON.stringify(values)+showPaths+surfaceCutaway;if(key!==lastValues){const modeChanged=sample&&sample.mode!==values.mode;sample=sampleMirrors(values);if(modeChanged)root.rotation.y=diagramView?.6:values.mode===3?-1.5:values.mode===2?1.5:1.3;lastValues=key;reflectors.forEach((r,i)=>{r.set(sample.surfaces[i]||(i===1?sample.lowerMount:null),surfaceCutaway);if(values.mode===3&&i===1&&!values.secondMirror){r.mesh.visible=false;r.face.object.visible=false;}});}
  const s=sample,p=elapsed/C.duration,inc=Math.min(1,p/.33),ref=Math.max(0,Math.min(1,(p-.33)/.34)),construction=Math.max(0,Math.min(1,(p-.67)/.33));
  parts.eye.visible=values.mode!==2;parts.screen.visible=values.mode===2;parts.obstacle.visible=values.mode===3;parts.image.visible=construction>0;parts.normal.visible=Boolean(s.normal)&&p>=.67;
  gauge.object.visible=markerSpan.object.visible=values.mode===1&&construction>0;markerDot.set([3.4-.75*Math.cos(values.bearing*RAD),.75*Math.sin(values.bearing*RAD)],values.mode===1&&construction>0);
  if(values.mode===1)markerSpan.set(Array.from({length:17},(_,i)=>{const a=(values.bearing-5+10*i/16)*RAD;return [3.4-.75*Math.cos(a),.75*Math.sin(a)];}));
  sourceArrow.hide();imageArrow.hide();eyeOpening.hide();screenLine.hide();normalLine.hide();directLine.hide();sourcePoint.set([0,0],false);focusPoint.set([0,0],false);
  if(s.object){sourceArrow.set(...s.object,1);sourceSupport.position.set(s.object[0][0],s.object[0][1],-.135);}else if(values.mode===2){sourcePoint.set(s.source);focusPoint.set(s.focus);sourceSupport.position.set(...s.source,-.135);}sourceSupport.visible=values.mode!==1;
  if(s.eye){eyeBody.position.set(...s.eye,0);const target=new THREE.Vector3(0,values.mode===3?-1.2:0,0);eyeBody.quaternion.setFromUnitVectors(new THREE.Vector3(0,0,1),target.sub(eyeBody.position).normalize());eyeMark.set(s.eye);const half=values.mode===3?C.detectorHalfOpening:C.pupil;eyeOpening.set([s.eye[0],s.eye[1]-half],[s.eye[0],s.eye[1]+half],1,false);eyeSupport.position.set(...s.eye,-.135);}else eyeMark.set([0,0],false);
  const pose=mirrorCatPose(values);applyMirrorCatPose(sourceCat,pose);sourceCat.visible=true;sourceArrow.hide();
  imageCat.visible=(values.mode===0||values.mode===3)&&construction>0;
  if(values.mode===0){imageCat.position.set(values.distance,0,0);imageCat.quaternion.copy(sourceCat.quaternion);imageCat.scale.set(-values.height,values.height,values.height);}
  if(values.mode===3){
   sourceCat.updateMatrix();const matrix=sourceCat.matrix.clone();
   for(const surface of s.surfaces){const [nx,ny]=surface.normal,d=dot(surface.center,surface.normal);const reflection=new THREE.Matrix4().set(1-2*nx*nx,-2*nx*ny,0,2*d*nx,-2*nx*ny,1-2*ny*ny,0,2*d*ny,0,0,1,0,0,0,0,1);matrix.premultiply(reflection);}
   matrix.decompose(imageCat.position,imageCat.quaternion,imageCat.scale);
  }
  if(s.virtualImage&&values.mode!==0)imageArrow.set(...s.virtualImage,construction);if(values.mode===2)screenLine.set([C.screenX,-2.25],[C.screenX,2.25],1,false);
  if(s.normal)normalLine.set(s.normal.hit,add(s.normal.hit,mul(s.normal.normal,.55)),construction,false);
  if(values.mode===3)directLine.set(s.object[0].map((x,i)=>i?1.2:x),s.directHit,construction,false);
  for(let i=0;i<9;i++){const slot=raySlots[i],r=s.rays[i];slot.incident.hide();slot.reflected.hide();slot.second.hide();slot.extension.hide();slot.miss.set([0,0],false);screenHits[i].set([0,0],false);if(!r)continue;
   for(const segment of [slot.incident,slot.reflected])for(const line of [segment.body,segment.head]){line.object.material.color.set(values.mode===1||values.mode===2?gray:segment===slot.incident?blue:orange);line.object.material.transparent=values.mode===1||values.mode===2;line.object.material.opacity=values.mode===1||values.mode===2?.35:1;}
   slot.incident.set(r.source,r.apertureHit===false?r.end:r.hit,inc);
   if(r.apertureHit!==false){slot.reflected.set(r.hit,r.secondHit||r.end,r.secondHit?Math.min(1,ref*2):ref);if(r.secondHit)slot.second.set(r.secondHit,r.end,Math.max(0,ref*2-1));}
   if(r.virtual&&r.received)slot.extension.set(r.hit,r.virtual,construction,false);
   if(!r.received)slot.miss.set(r.end,ref>=1);if(values.mode===2)screenHits[i].set(r.end,ref>=1);
  }
  const catRays=sampleCatConstruction(values);
  catRaySlots.forEach((slot,i)=>{slot.incident.hide();slot.reflected.hide();slot.extension.hide();const r=catRays[i];if(!r)return;
   if(values.mode===1||values.mode===2){slot.incident.set(r.source,r.hit,inc);slot.reflected.set(r.hit,r.end,ref);}
   if(values.mode!==0)slot.extension.set(r.extensionStart||r.hit,r.virtual,construction,false);
  });
  detectorHits.forEach((marker,i)=>{const ray=s.rays[i];marker.set(ray?.detector||[3,-1.2],values.mode===3&&Boolean(ray?.received)&&ref>=1);});
  comparisons.forEach((pair,i)=>{pair.incoming.hide();pair.outgoing.hide();if(values.mode===1){const r=s.flatComparison[i];pair.incoming.set(r.source,r.hit,construction,false);pair.outgoing.set(r.hit,r.eye,construction,false);}});
  for(const [id,group] of Object.entries(parts))if(id!=='mirror')group.visible=showPaths&&group.visible;
  parts.source.visible=showPaths;parts.rays.visible=showPaths;
  for(const r of reflectors)r.stand.visible=false;
  sourceSupport.visible=eyeSupport.visible=false;
  const outcome=p===1?s.outcome:'Trace construction in progress. Optical values describe the selected arrangement.';
  kit.parts[0].framePadding=diagramView?.55:[.30,.50,.55,.55][values.mode];
  const details=values.mode===0?[
   reading('Object distance',fmt(values.distance,'cm'),'Perpendicular distance from the cat center to the mirror plane. The eye stays farther away and off to one side.'),
   reading('Image distance',fmt(s.imageDistance,'cm behind'),'Backward extensions locate the plane-mirror image equally far behind the surface; no light travels there.'),
   reading('Image height ratio',fmt(s.imageHeightRatio),'Geometrical image height divided by object height. A finite mirror can hide part of that full-size image.'),
   reading('Received rays',s.received+' / 6','Two cat heights times three pupil samples. This count describes sampled visibility, not brightness.'),
  ]:values.mode===1?[
   reading('Convex field of view',fmt(s.convexField,'°'),'Full angular field of distant directions admitted by the spherical aperture to the fixed point eye.'),
   reading('Flat comparison field',fmt(s.flatField,'°'),'Distant angular field for an equal flat aperture at the same eye distance.'),
   reading('Selected bearing',fmt(values.bearing,'°'),'Center direction of the separate ten-degree-wide distant marker; this is not the finite cat distance.'),
   reading('Marker visibility',s.markerVisibility,'Both marker edges must fit for full visibility. At an edge the view can be partial.'),
   reading('Apparent angular span',s.apparentAngularSpan===null?'Unavailable: marker is clipped or outside':fmt(s.apparentAngularSpan,'°'),'Angle between the two received marker-edge directions at the eye. Reported only when both edges are visible.'),
   reading('Source angular span',fmt(s.sourceAngularSpan,'°'),'The distant comparison marker always spans ten degrees before reflection. Compare this with its apparent span.'),
  ]:values.mode===2?[
   reading('Focal distance',fmt(values.focus,'cm'),'Distance from the parabolic vertex to its focus. Only a point at this focus produces an exactly parallel axial beam.'),
   reading('Bulb offset',fmt(values.offset,'cm'),'Chosen point-source displacement from focus: positive toward the vertex, negative away. The extended cat is shown separately.'),
   reading('Reflected angular spread',fmt(s.angularSpread,'°'),'Largest minus smallest direction among nine reflected point-source rays. Zero means these sampled directions are parallel.'),
   reading('Screen footprint',fmt(s.screenFootprint,'cm'),'Highest minus lowest sampled hit at the screen four centimeters in front. A narrow spot alone does not mean parallel rays.'),
  ]:[
   reading('Received rays',s.received+' / 3','Three sampled cat heights. A ray must reach both finite mirrors and fit the detector opening.'),
   reading('Direct line','Blocked by the obstacle','The red direct route stops at the obstacle; the reflected route must pass around it.'),
   reading('Image orientation',!values.secondMirror?'Second reflection absent':s.orientationPreserved?'Preserved by parallel mirrors':'Rotated by nonparallel mirrors','Two reflections in parallel planes preserve orientation. This construction does not guarantee that every ray reaches the opening.'),
  ];
  return {state:{...s,elapsed,progress:p},readings:[
   reading('Outcome',outcome,'Optical results come from the selected geometry. Trace playback reveals those paths without changing their solution.'),
   reading('Mode',s.modeName,'Each arrangement has its own relevant controls, measurements and finite-aperture conditions.'),
   ...details,
   reading('Incident angle',fmt(s.incidentAngle,'°'),'Angle from the local normal at the selected surface hit. A missing received upper-point path has no selected flat-mirror angle.'),
   reading('Reflected angle',fmt(s.reflectedAngle,'°'),'Measured from the same local normal. Reflection preserves this angle, including on curved surfaces.'),
   reading('Trace progress',fixed(p*100,1)+' %','Fraction of the teaching construction revealed, not the fraction of light transmitted.'),
   reading('Trace time',fixed(elapsed,2)+' s','Eight display seconds reveal a static optical solution. This is not physical light-travel time.'),
  ]};
 });
 const render=result.update;result.update=(next={})=>{const old=JSON.stringify(result.getState().values);render(next);if(JSON.stringify(result.getState().values)!==old&&elapsed<C.duration)elapsed=0;result.autoFramePart=showPaths?'system':'mirror';return render();};
 result.advance=seconds=>{if(Number.isFinite(seconds)&&seconds>0){showPaths=true;elapsed=Math.min(C.duration,elapsed+seconds);}return render();};result.animate=clock=>{if(!Number.isFinite(clock))return render();const dt=Math.max(0,clock-lastClock);lastClock=clock;return result.advance(dt);};result.reset=(initialState)=>{surfaceCutaway=false;showPaths=true;diagramView=initialState?.diagram===true;root.rotation.y=diagramView?.6:1.3;elapsed=lastClock=0;return render(result.defaults);};
 result.replayState=()=>({diagram:diagramView});
 result.actions=[['Inspect start (0%)',0],['Inspect incident paths (33%)',.33],['Inspect reflections (67%)',.67],['Inspect full result (100%)',1]].map(([label,fraction])=>({label,part:'system',replay:false,view:'front',run(){showPaths=true;elapsed=fraction*C.duration;return render();}}));
 result.actions.push({label:'Show mirrors only',replay:false,part:'mirror',run(){surfaceCutaway=false;showPaths=false;return render();}});
 result.actions.push({label:'Inspect central cutaway',replay:false,part:'system',run(){surfaceCutaway=true;showPaths=true;return render();}});
 result.playback={label:'Trace the light paths',description:'Blue arrows: incident light. Orange arrows: reflected light. Purple dashes: backward ray extensions. A pale cat marks an exact plane-mirror image. Curved surfaces can have different apparent origins for different rays. Gray paths: distant-field or central-point beam comparison. View reflected cat shows the surface image; View ray diagram separates its construction. Playback takes eight seconds, not the physical light-travel time.',stepLabel:'Advance the construction by one percent',advance:result.advance,step:()=>result.advance(.08),complete:()=>elapsed>=C.duration,blocked:()=>false};
 result.resultPart={id:'system',label:'Inspect the complete ray diagram',focusOnComplete:false,available:()=>elapsed===C.duration,view:'front'};result.framingBounds=new THREE.Box3(new THREE.Vector3(-4.8,-2.6,-1),new THREE.Vector3(4.8,2.6,1));
 root.rotation.y=1.3;
 result.initialPart='system';
 result.initialView='front';
 result.frameVisibleOnly=true;
 result.selectionOutline=false;
 result.reflectionLighting=false;
 result.transparentBackground=true;
 result.topology={system,parts,sourceCat,imageCat,eyeBody,reflectors,raySlots,comparisons,sourceArrow,imageArrow,eyeOpening,screenLine,normalLine,catRaySlots,screenHits,detectorHits,obstacle,sourceSupport,eyeSupport,labels,textures};
 result.actions.push({label:'View reflected cat',replay:false,part:'mirror',view:'front',run(){diagramView=false;root.rotation.y=result.getState().values.mode===3?-1.5:result.getState().values.mode===2?1.5:1.3;surfaceCutaway=false;showPaths=true;return render();}});
 result.actions.push({label:'View ray diagram',replay:false,part:'system',view:'front',run(){diagramView=true;root.rotation.y=.6;showPaths=true;return render();}});
 const originalDispose=result.dispose;result.dispose=()=>{if(disposed)return;disposed=true;originalDispose();textures.forEach(t=>t.dispose());};
 return result;
}

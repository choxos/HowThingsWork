import * as THREE from 'three';
import {thinLens} from '../physics.ts';
import {houseModel,reading} from './house-model-kit.js';
import {fixed} from './format.js';
import {createMirrorCat} from './mirror-cat.js';

export const LENSES_DEFAULTS=Object.freeze({mode:0,focal:1.5,distance:2,height:.6,aperture:.5,screenOffset:0,zoom:0,compensate:1});
export const LENSES_ZOOM=Object.freeze({objectX:-6,rearX:3,sensorX:5,sensorHalfHeight:.22,focals:[2.5,-.75,1]});
const domains={mode:[0,2,1],focal:[1,2.5,.5],distance:[.5,4,.25],height:[.3,1.2,.3],aperture:[.2,.6,.1],screenOffset:[-1,1,.25],zoom:[0,100,10],compensate:[0,1,1]};
const EPS=1e-9,duration=8,names=['Convex lens','Concave lens','Three-lens zoom'];
export function multiplyLensMatrices(a,b){return [a[0]*b[0]+a[1]*b[2],a[0]*b[1]+a[1]*b[3],a[2]*b[0]+a[3]*b[2],a[2]*b[1]+a[3]*b[3]];}
const propagation=d=>[1,d,0,1],element=f=>[1,0,-1/f,1];
export function lensTrainMatrix(lenses,from,to){let m=[1,0,0,1],x=from;for(const lens of lenses){m=multiplyLensMatrices(element(lens.f),multiplyLensMatrices(propagation(lens.x-x),m));x=lens.x;}return multiplyLensMatrices(propagation(to-x),m);}
export function zoomLensPositions(zoom,compensate=1){
 if(!Number.isFinite(zoom)||zoom<0||zoom>100||![0,1].includes(compensate))throw new RangeError('Invalid zoom setup');
 const x=.5-zoom/100,Z=LENSES_ZOOM;
 const solve=front=>{
  const b=middle=>lensTrainMatrix([{x:front,f:2.5},{x:middle,f:-.75},{x:3,f:1}],-6,5)[1];
  const c=b(0),v1=b(1),a=(b(2)-2*v1+c)/2,linear=v1-c-a,discriminant=linear*linear-4*a*c;
  if(discriminant<0)throw new RangeError('No compensated zoom position');
  const roots=[(-linear-Math.sqrt(discriminant))/(2*a),(-linear+Math.sqrt(discriminant))/(2*a)].filter(r=>r>front+.2&&r<2.8).sort((a,b)=>a-b);
  if(!roots.length)throw new RangeError('Compensating lens lies outside its mount');return roots[0];
 };
 return [{x,f:Z.focals[0]},{x:solve(compensate?x:.5),f:Z.focals[1]},{x:Z.rearX,f:Z.focals[2]}];
}
function validate(input){if(!input||typeof input!=='object'||Array.isArray(input))throw new TypeError('Expected lens controls');for(const key of Object.keys(input))if(!Object.hasOwn(domains,key))throw new RangeError('Unknown control '+key);const v={...LENSES_DEFAULTS,...input};for(const [key,[lo,hi,step]] of Object.entries(domains)){if(!Number.isFinite(v[key])||v[key]<lo-EPS||v[key]>hi+EPS||Math.abs((v[key]-lo)/step-Math.round((v[key]-lo)/step))>1e-8)throw new RangeError('Invalid '+key);v[key]=Number(v[key].toFixed(12));}return v;}
function passRay(source,firstHeight,lenses,endX){
 let x=source[0],y=source[1],slope=(firstHeight-y)/(lenses[0].x-x);const points=[source],turns=[];
 for(let i=0;i<lenses.length;i++){
  const lens=lenses[i];y+=slope*(lens.x-x);x=lens.x;points.push([x,y]);
  if(Math.abs(y)>lens.aperture+EPS)return {source,firstHeight,points,turns,blockedAt:i,transmitted:false,end:[x,y]};
  const incoming=slope;slope-=y/lens.f;turns.push({x,y,incoming,outgoing:slope,f: lens.f});
 }
 const end=[endX,y+slope*(endX-x)];points.push(end);return {source,firstHeight,points,turns,transmitted:true,slope,end};
}
function pupilInterval(source,lenses){
 const d=lenses[0].x-source[0];let low=-lenses[0].aperture,high=lenses[0].aperture;
 for(let i=0;i<lenses.length;i++){
  const partial=lensTrainMatrix(lenses.slice(0,i),source[0],lenses[i].x),a=partial[1]/d,b=(partial[0]-a)*source[1],aperture=lenses[i].aperture;
  if(Math.abs(a)<EPS){if(Math.abs(b)>aperture)return null;continue;}
  const limits=[(-aperture-b)/a,(aperture-b)/a].sort((x,y)=>x-y);low=Math.max(low,limits[0]);high=Math.min(high,limits[1]);if(low>high+EPS)return null;
 }
 return [low,high];
}
export function sampleLenses(input={}){
 const v=validate(input),zoom=v.mode===2,f=v.mode===1?-v.focal:v.focal;
 const lenses=(zoom?zoomLensPositions(v.zoom,v.compensate):[{x:0,f}]).map(l=>({...l,aperture:v.aperture}));
 const objectX=zoom?-6:-v.focal*v.distance,last=lenses.at(-1),matrix=lensTrainMatrix(lenses,objectX,last.x);
 const image=zoom?(Math.abs(matrix[3])<EPS?{distance:Infinity,magnification:null,real:false}:{distance:-matrix[1]/matrix[3],magnification:1/matrix[3],real:-matrix[1]/matrix[3]>0}):thinLens(f,-objectX);
 const atInfinity=!Number.isFinite(image.distance),imageX=atInfinity?null:last.x+image.distance,magnification=atInfinity?null:image.magnification,virtual=!atInfinity&&!image.real;
 const screenX=zoom?5:(image.real&&!atInfinity?imageX:3*v.focal)+v.screenOffset*v.focal,eye=virtual?[3*v.focal,-.75*v.height]:null,endX=eye?eye[0]:screenX;
 const s={values:v,mode:v.mode,modeName:names[v.mode],lenses,objectX,objectHeight:v.height,imageX,magnification,atInfinity,virtual,real:!atInfinity&&image.real,screenX,eye,rays:[],matrix,pointBlur:0,pupilIntervals:[]};
 for(const objectY of [-v.height/2,0,v.height/2]){
  const source=[objectX,objectY],interval=pupilInterval(source,lenses);s.pupilIntervals.push(interval);
  let heights;
  if(virtual){const d=-objectX,e=eye[0],den=1+e/d-e/f;heights=[-.04,0,.04].map(offset=>(eye[1]+offset+e*objectY/d)/den);}
  else{heights=[-v.aperture,0,v.aperture];if(interval){const mid=(interval[0]+interval[1])/2;if(!heights.some(h=>Math.abs(h-mid)<1e-8))heights.push(mid);}}
  for(const h of heights){const ray=passRay(source,h,lenses,endX);ray.received=ray.transmitted&&(!zoom||Math.abs(ray.end[1])<=LENSES_ZOOM.sensorHalfHeight+EPS);if(virtual&&ray.transmitted)ray.virtual=[imageX,magnification*objectY];s.rays.push(ray);}
  if(interval&&!virtual){const extremes=interval.map(h=>passRay(source,h,lenses,endX).end[1]);s.pointBlur=Math.max(s.pointBlur,Math.abs(extremes[1]-extremes[0]));}
 }
 s.received=s.rays.filter(r=>r.received).length;s.transmitted=s.rays.filter(r=>r.transmitted).length;
 s.imageKind=atInfinity?'At infinity':virtual?'Virtual, upright':magnification<0?'Real, inverted':'Real, upright';
 s.inFocus=s.real&&Math.abs(screenX-imageX)<1e-7;
 s.imageHeight=atInfinity?null:Math.abs(magnification)*v.height;
 s.sensorCoverage=zoom&&s.inFocus?Math.min(1,2*LENSES_ZOOM.sensorHalfHeight/s.imageHeight):null;
 s.fieldOfView=zoom&&s.inFocus?2*Math.atan(LENSES_ZOOM.sensorHalfHeight/(Math.abs(magnification)*(lenses[0].x-objectX)))*180/Math.PI:null;
 s.effectiveFocal=zoom?-1/lensTrainMatrix(lenses,lenses[0].x,last.x)[2]:f;
 s.outcome=atInfinity?'Each object point sends out a parallel bundle. No finite screen position focuses it.':virtual?`${s.received} of ${s.rays.length} sampled rays reach the eye. Backward extensions locate an upright virtual image.`:zoom?`${s.inFocus?'The moving pair keeps the image on the fixed sensor.':'The locked middle lens leaves the sensor out of focus.'} ${!s.inFocus?'The field and crop readings require a focused sensor.':s.sensorCoverage<1?'The image exceeds the sensor height and is cropped.':'The geometric image fits the sensor height.'}`:s.inFocus?'The screen lies at the real-image plane; rays from each object point meet there.':'The screen is away from the image plane. Rays from each object point spread into a blur.';
 return s;
}

export function createLensesModel(){
 const kit=houseModel('Lenses'),{root,part,control,finish}=kit;
 const system=part('system','Lenses','An ideal thin-lens ray construction. The glass solids illustrate shape; refraction is represented at each lens center.');
 const resultGroup=part('result','Image and receiver','Compare the calculated image with the receiving screen, sensor, or eye.',[0,0,0],system);
 const parts={};for(const [id,name,description] of [
  ['source','Cat object','The cat remains fixed during zoom. Three sampled object heights produce the ray bundles.'],['lenses','Glass lenses','Convex lenses have positive focal length; concave lenses have negative focal length. In zoom mode the front and middle lenses move while the rear lens stays fixed.'],['rays','Light rays','Blue arrows approach the lenses; orange arrows emerge. Rays outside a finite aperture stop at its mount.'],['image','Image construction','A flat cat marks the ideal image plane. Purple backward extensions locate virtual images; these are not light traveling backward.'],['screen','Screen or sensor','A real image is focused only at its image plane. In zoom mode the rectangular sensor stays fixed and records only the portion inside its border.'],['eye','Eye','The pupil faces the lens. Only paths through the lens aperture and into the sampled pupil are received.'],['focus','Focal points','These points belong to the selected single lens. Parallel rays converge here, or appear to diverge from here.']])parts[id]=part(id,name,description,[0,0,0],['image','screen','eye'].includes(id)?resultGroup:system);
 function stroke(parent,color,capacity=2,dashed=false){const geometry=new THREE.BufferGeometry(),position=new Float32Array(capacity*3);geometry.setAttribute('position',new THREE.BufferAttribute(position,3));if(dashed)geometry.setAttribute('lineDistance',new THREE.BufferAttribute(new Float32Array(capacity),1));const material=dashed?new THREE.LineDashedMaterial({color,dashSize:.08,gapSize:.06}):new THREE.LineBasicMaterial({color});const mesh=new THREE.Line(geometry,material);mesh.frustumCulled=false;parent.add(mesh);return {mesh,geometry,set(points){let distance=0;for(let i=0;i<capacity;i++){const p=points[Math.min(i,points.length-1)]||[0,0,0];position.set([p[0],p[1],p[2]??.015],3*i);if(i<points.length&&i)distance+=Math.hypot(...p.map((x,k)=>x-(points[i-1][k]||0)));if(dashed)geometry.attributes.lineDistance.array[i]=distance;}geometry.setDrawRange(0,points.length);geometry.attributes.position.needsUpdate=true;if(dashed)geometry.attributes.lineDistance.needsUpdate=true;geometry.computeBoundingBox();mesh.visible=points.length>1;}};}
 function arrow(parent,color,dashed=false){const body=stroke(parent,color,2,dashed),head=stroke(parent,color,3);return {body,head,set(a,b,p=1){if(p<=0||Math.hypot(b[0]-a[0],b[1]-a[1])<1e-9){body.set([]);head.set([]);return;}const end=[a[0]+(b[0]-a[0])*Math.min(1,p),a[1]+(b[1]-a[1])*Math.min(1,p)],dx=end[0]-a[0],dy=end[1]-a[1],length=Math.hypot(dx,dy),x=a[0]+dx*.62,y=a[1]+dy*.62;body.set([a,end]);if(dashed){head.set([]);return;}head.set([[x-.10*dx/length-.045*dy/length,y-.10*dy/length+.045*dx/length],[x,y],[x-.10*dx/length+.045*dy/length,y-.10*dy/length-.045*dx/length]]);},hide(){body.set([]);head.set([]);}};}
 const lensMeshes=[];
 for(let k=0;k<3;k++){
  const rows=33,cols=49,layer=rows*cols,positions=new Float32Array(layer*2*3),indices=[];const quad=(a,b,c,d)=>indices.push(a,b,c,a,c,d);
  for(let side=0;side<2;side++)for(let i=0;i<rows-1;i++)for(let j=0;j<cols-1;j++){const a=side*layer+i*cols+j;quad(a,a+cols,a+cols+1,a+1);}
  for(let j=0;j<cols-1;j++){const a=(rows-1)*cols+j;quad(a,a+1,a+1+layer,a+layer);}
  const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.BufferAttribute(positions,3));geometry.setIndex(indices);
  const mesh=new THREE.Mesh(geometry,new THREE.MeshStandardMaterial({color:0x77bfd1,transparent:true,opacity:.23,roughness:.25,side:THREE.DoubleSide,depthWrite:false}));parts.lenses.add(mesh);
  const outline=stroke(parts.lenses,0x386a76,65);
  lensMeshes.push({mesh,outline,geometry,set(lens){mesh.visible=outline.mesh.visible=Boolean(lens);if(!lens)return;const r=Math.abs(lens.f),ap=lens.aperture,sag=r-Math.sqrt(r*r-ap*ap);for(let side=0;side<2;side++)for(let i=0;i<rows;i++)for(let j=0;j<cols;j++){const radial=ap*i/(rows-1),angle=j*2*Math.PI/(cols-1),rise=r-Math.sqrt(r*r-radial*radial),half=lens.f>0?.03+sag-rise:.03+rise;positions.set([lens.x+(side?1:-1)*half,radial*Math.cos(angle),radial*Math.sin(angle)],(side*layer+i*cols+j)*3);}geometry.attributes.position.needsUpdate=true;geometry.computeVertexNormals();geometry.computeBoundingBox();outline.set(Array.from({length:65},(_,i)=>[lens.x,ap*Math.cos(i*Math.PI/32),ap*Math.sin(i*Math.PI/32)]));}});
 }
 const sourceCat=createMirrorCat(parts.source),imageCat=createMirrorCat(parts.image,true);
 for(const mesh of imageCat.children){mesh.material.dispose();mesh.material=new THREE.MeshBasicMaterial({color:0x997ac5,transparent:true,opacity:.3,depthWrite:false});}
 const slots=Array.from({length:12},()=>({segments:Array.from({length:4},(_,i)=>arrow(parts.rays,i?0xb95422:0x17618a)),extension:arrow(parts.image,0x79559d,true),miss:stroke(parts.rays,0xb43d35,5)}));
 const screen=stroke(parts.screen,0x344537,5),focusDots=[-1,1].map(()=>kit.sphere(.045,[0,0,0],'clay',parts.focus));
 const eye=new THREE.Group();parts.eye.add(eye);for(const [size,color,z] of [[[.17,.11,.08],0xf4f6f6,0],[[.07,.07,.035],0x397b9d,.073],[[.03,.045,.018],0x152e38,.105]]){const mesh=new THREE.Mesh(new THREE.SphereGeometry(1,20,12),new THREE.MeshStandardMaterial({color}));mesh.scale.set(...size);mesh.position.z=z;eye.add(mesh);}eye.rotation.y=-Math.PI/2;
 const controls=[
  ['mode','Arrangement','','Select a single lens or the three-lens zoom.',names.map((label,value)=>({label,value})),()=>true],
  ['focal','Focal-length magnitude','cm','Positive for convex, negative for concave. Zoom uses three fixed lens powers.',null,v=>v.mode<2],
  ['distance','Object distance','× |f|','Move the object relative to the focal distance. At 1×f a convex lens sends each point into a parallel bundle.',null,v=>v.mode<2],
  ['height','Cat height','cm','Changes the object and its image height. A tall object can exceed the zoom sensor.',null,()=>true],
  ['aperture','Lens half-aperture','cm','Changes the clear radius. Aperture controls admitted paths, not the ideal focal length.',null,()=>true],
  ['screenOffset','Screen offset','× |f|','Offset from the real-image plane. With the cat exactly at the focus, no finite image exists: the reference screen is instead 3×f behind the lens.',null,v=>v.mode===0&&v.distance>=1],
  ['zoom','Zoom toward telephoto','%','Move the front lens toward the fixed object. Compensation moves the concave lens toward the fixed rear lens.',null,v=>v.mode===2],
  ['compensate','Move the middle lens too','','Hold it at its wide-angle position to demonstrate lost focus.',[{value:1,label:'Coordinated movement'},{value:0,label:'Middle lens held still'}],v=>v.mode===2],
 ];
 for(const [key,label,unit,help,options,enabledWhen] of controls){const [min,max,step]=domains[key];control(key,label,min,max,step,LENSES_DEFAULTS[key],unit,help,options,{primary:key==='mode',enabledWhen,visibleWhen:enabledWhen});}
 let elapsed=duration,lastClock=0,lastKey='',sample,disposed=false;
 const fmt=(v,unit='cm')=>v===null||v===undefined?'No finite image':fixed(v,2)+(unit?' '+unit:'');
 const result=finish(values=>{
  const key=JSON.stringify(values);if(key!==lastKey){sample=sampleLenses(values);lastKey=key;lensMeshes.forEach((mesh,i)=>mesh.set(sample.lenses[i]));}
  const s=sample,p=elapsed/duration,construction=Math.max(0,(p-.75)/.25);
  sourceCat.position.set(s.objectX,0,0);sourceCat.scale.setScalar(values.height);
  parts.image.visible=p>.75&&!s.atInfinity;imageCat.visible=!s.atInfinity;
  imageCat.children.forEach((mesh,i)=>{mesh.material.color.copy(s.real?sourceCat.children[i].material.color:new THREE.Color(0x997ac5));mesh.material.opacity=(s.real?1:.3)*construction;mesh.material.transparent=!s.real||construction<1;mesh.material.depthWrite=s.real&&construction>=1;});
  if(!s.atInfinity){imageCat.position.set(s.imageX,0,0);imageCat.scale.set(.012,s.magnification*values.height,s.magnification*values.height);}
  parts.eye.visible=Boolean(s.eye);if(s.eye)eye.position.set(...s.eye,0);
  parts.screen.visible=!s.virtual;const half=s.mode===2?LENSES_ZOOM.sensorHalfHeight:Math.max(.6,(s.imageHeight||values.height)*.65),width=s.mode===2?.36:Math.max(.5,half*.65);
  screen.set([[s.screenX,-half,-width],[s.screenX,half,-width],[s.screenX,half,width],[s.screenX,-half,width],[s.screenX,-half,-width]]);
  parts.focus.visible=s.mode<2;focusDots.forEach((dot,i)=>dot.position.set((i?1:-1)*values.focal,0,0));
  slots.forEach((slot,i)=>{slot.segments.forEach(segment=>segment.hide());slot.extension.hide();slot.miss.set([]);const ray=s.rays[i];if(!ray)return;
   for(let j=0;j<ray.points.length-1;j++){const progress=j===0?p/.25:(p-.25)/(.5/(s.lenses.length))-j+1;slot.segments[j].set(ray.points[j],ray.points[j+1],Math.max(0,Math.min(1,progress)));}
   if(ray.virtual&&ray.transmitted)slot.extension.set(ray.points.at(-2),ray.virtual,construction);
   if((!ray.transmitted||!ray.received)&&p>=.75){const [x,y]=ray.end;slot.miss.set([[x-.05,y-.05],[x+.05,y+.05],[x,y],[x-.05,y+.05],[x+.05,y-.05]]);}
  });
  const details=s.mode===2?[
   ...(s.inFocus?[reading('Effective focal length',fmt(s.effectiveFocal),'Combined paraxial power of the three lenses, measured from a principal plane rather than the last glass element. This is not the image position or the finite-distance magnification.')]:[]),
   reading('Front lens position',fmt(s.lenses[0].x),'Axial coordinate in the fixed zoom frame. This convex lens moves toward the cat as zoom increases.'),
   reading('Middle lens position',fmt(s.lenses[1].x),'The concave lens moves to preserve focus at the fixed sensor. Holding it at its wide-angle position breaks that condition.'),
   reading('Rear lens position',fmt(s.lenses[2].x),'The rear convex lens stays at x = 3 cm throughout zoom.'),
   reading('Field of view',s.inFocus?fmt(s.fieldOfView,'°'):'Unavailable: sensor out of focus','Full vertical angle of the object-plane height mapped onto the focused sensor, measured from the front lens. This finite-distance teaching value is withheld when focus is lost.'),
   reading('Sensor height coverage',s.inFocus?fmt(s.sensorCoverage*100,'% of image'):'Unavailable: sensor out of focus','Fraction of the full centered image height inside the 0.44 cm sensor. Below 100% means cropping, not dimmer light. Reported only at focus.'),
  ]:[reading('Focal length',fmt(s.mode===1?-values.focal:values.focal),'Signed thin-lens focal length: positive converges parallel input; negative diverges it. This belongs to the lens, not the object distance.')];
  return {state:{...s,elapsed,progress:p},readings:[
   reading('Outcome',p===1?s.outcome:'Trace construction in progress. Optical values describe the selected arrangement.','The optical solution stays fixed during the eight-second teaching trace. Controls change its geometry.'),
   reading('Arrangement',s.modeName,'A single convex or concave lens, or a coordinated three-lens zoom with a fixed object and sensor.'),
   reading('Image kind',s.imageKind,'Real rays meet at a real image. Backward extensions locate a virtual image. At the convex focus, each point produces a parallel bundle and no finite image plane.'),
   reading('Object distance',fmt(s.lenses[0].x-s.objectX),'Distance from the cat plane to the first lens, positive for the real object on the incoming side.'),
   reading('Image position',s.atInfinity?'At infinity':fmt(s.imageX),'Axial coordinate x: the single lens is at zero. Zoom uses a fixed origin, with its rear lens at 3 cm and sensor at 5 cm. Negative single-lens values locate a virtual image on the object side.'),
   reading('Signed magnification',fmt(s.magnification,'×'),'Image height divided by object height. A minus sign means inverted; a plus sign means upright. This linear ratio is not perceived angular magnification.'),
   reading('Image height',fmt(s.imageHeight),'Full geometrical image height before sensor cropping. No finite height is assigned when the image lies at infinity.'),
   ...(!s.virtual?[
    reading('Screen / sensor position',fmt(s.screenX),'Axial coordinate of the receiving plane. Moving a screen changes the blur there, not the image plane. The zoom sensor stays at x = 5 cm.'),
    reading('Point-bundle blur',s.pointBlur>1e-8&&s.pointBlur<.005?'<0.01 cm':fmt(s.pointBlur),'Largest vertical span of an admitted object-point bundle at the receiving plane. Zero is ideal focus; a positive span is defocus. Diffraction and brightness are not modeled.'),
   ]:[]),
   ...details,
   reading('Received sample rays',s.received+' / '+s.rays.length,'Drawn paths reaching the eye or receiving plane. Zoom paths must also fit inside the sensor height. Samples are not equal portions of optical power.'),
   reading('Trace progress',fixed(p*100,1)+' %','Fraction of the ray construction revealed, not optical transmission.'),
   reading('Trace time',fixed(elapsed,2)+' s','Eight display seconds reveal the construction. This is not physical light-travel time.'),
  ]};
 });
 const render=result.update;result.update=(next={})=>{const before=JSON.stringify(result.getState().values);render(next);if(before!==JSON.stringify(result.getState().values)&&elapsed<duration)elapsed=0;return render();};
 result.advance=seconds=>{if(Number.isFinite(seconds)&&seconds>0)elapsed=Math.min(duration,elapsed+seconds);return render();};result.animate=clock=>{if(Number.isFinite(clock)){const dt=Math.max(0,clock-lastClock);lastClock=clock;return result.advance(dt);}return render();};result.reset=()=>{elapsed=lastClock=0;return render(result.defaults);};
 result.actions=[['Inspect start (0%)',0],['Inspect first lens (25%)',.25],['Inspect transmitted rays (75%)',.75],['Inspect full image (100%)',1]].map(([label,fraction])=>({label,part:'system',view:'front',replay:false,run(){elapsed=duration*fraction;return render();}}));
 result.actions.push({label:'Inspect lens shapes',part:'lenses',replay:false,view:'front',run:()=>render()});
 result.playback={label:'Trace refraction and the image',description:'Ideal thin-lens approximation: blue incident rays, orange transmitted rays, and purple virtual-image extensions. Real glass refracts at two surfaces and can produce aberrations. The flat cat marks the calculated image plane; only the part inside the zoom sensor border is recorded. Eight seconds reveal the construction, not light-travel time.',stepLabel:'Advance the lens construction by one percent',advance:result.advance,step:()=>result.advance(.08),complete:()=>elapsed>=duration,blocked:()=>false};
 result.resultPart={id:'image',context:'result',label:'Inspect image formation',view:'side',focusOnComplete:false,available:()=>elapsed===duration&&!sample.atInfinity};
 root.rotation.y=-.35;result.initialPart='system';result.initialView='front';result.frameVisibleOnly=true;result.autoFramePart='system';result.selectionOutline=false;result.transparentBackground=true;
 result.topology={parts,sourceCat,imageCat,eye,lensMeshes,slots,screen,focusDots};const dispose=result.dispose;result.dispose=()=>{if(disposed)return;disposed=true;dispose();};return result;
}

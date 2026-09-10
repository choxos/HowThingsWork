import * as THREE from 'three';
import {houseModel,reading as r} from './house-model-kit.js';

export function createRatchetModel(){
 const m=houseModel('Ratchet'),{part,box,rod,disk,ring,sphere,control,finish}=m;
 const step=Math.PI/6,pivot=[.6,-1.04],elbow=[.39,1.22],toe=[.16,1.065],points=[];
 const system=part('system','Ratchet demonstrator','Advance the pointer, then try to undo that movement with the catch engaged or released.');
 const frame=part('frame','Fixed supporting frame','The wheel axle, pawl pivot and elastic return anchor are secured to this same frame.',[0,0,0],system);
 box([2.7,2.8,.12],[0,1.4,-.3],'wood',frame);box([2.9,.14,.8],[0,.07,-.2],'ink',frame);
 const assembly=part('assembly','Wheel and holding catch','The wheel turns around its fixed axle. The catch pivots on a separate fixed pin.',[0,1.5,0],system);
 const axle=part('axle','Fixed wheel axle','Runs through the wheel bore, perpendicular to the wheel face.',[0,0,0],assembly);
 rod([0,0,-.3],[0,0,.2],.06,'metal',axle);ring(.07,.01,[0,0,0],'ink',axle);disk(.12,.035,[0,0,.12],'metal',axle);
 const wheel=part('ratchet','Asymmetric ratchet wheel','Twelve sloping ramps pass the pawl. Twelve steep radial faces stop reverse travel.',[0,0,0],assembly);
 const shape=new THREE.Shape();for(let i=0;i<12;i++)for(let j=0;j<=16;j++){const a=(i+j/16)*step,rad=.64+.2*j/16,p=[rad*Math.cos(a),rad*Math.sin(a)];points.push(p);if(i===0&&j===0)shape.moveTo(...p);else shape.lineTo(...p);}shape.closePath();
 const bore=new THREE.Path();bore.absarc(0,0,.08,0,Math.PI*2,true);shape.holes.push(bore);
 const gearMesh=new THREE.Mesh(new THREE.ExtrudeGeometry(shape,{depth:.14,bevelEnabled:false,curveSegments:32}),new THREE.MeshToonMaterial({color:0xe3b45e}));gearMesh.position.z=-.07;wheel.add(gearMesh);
 const pointer=part('pointer','Retained position pointer','Its position on the fixed scale is the useful output: forward progress is retained while the pawl holds.',[0,0,0],wheel);
 rod([.16,0,.09],[.54,0,.09],.017,'ink',pointer);sphere(.035,[.54,0,.09],'ink',pointer);
 const scale=part('scale','Fixed position scale','Each interval is one tooth, or 30 degrees. The reading also counts complete turns.',[0,0,0],assembly);
 for(let i=0;i<12;i++){const a=i*step;rod([.92*Math.cos(a),.92*Math.sin(a),-.17],[1.02*Math.cos(a),1.02*Math.sin(a),-.17],.013,i===0?'clay':'cream',scale);}
 const mount=part('pivot','Fixed pawl pivot','The frame supports this hinge. A reverse tooth force turns the catch toward engagement.',[...pivot,0],assembly);
 rod([0,0,-.3],[0,0,.09],.045,'metal',mount);
 const pawl=part('pawl','Hinged holding pawl','The hooked arm clears the tooth ring except at its rounded toe. Ramps lift it; a stopping face seats it.',[0,0,0],mount);
 rod([0,0,0],[...elbow,0],.016,'clay',pawl);rod([...elbow,0],[...toe,0],.016,'clay',pawl);sphere(.025,[...toe,0],'clay',pawl);disk(.07,.025,[0,0,.065],'ink',mount);
 const stopPin=part('pawl-stop','Pawl seating stop','The seated pawl bears against this fixed pin. Reverse tooth force presses the pawl into the stop; forward ramps lift it away.',[0,0,0],assembly),armLength=Math.hypot(...elbow),stopCenter=[pivot[0]+elbow[0]*.2-elbow[1]/armLength*.041,pivot[1]+elbow[1]*.2+elbow[0]/armLength*.041];
 rod([...stopCenter,-.3],[...stopCenter,.035],.025,'metal',stopPin);
 const bias=part('bias','Elastic return band','A stretched elastic band pulls the pawl back toward the teeth. Its anchors remain connected as the pawl lifts.',[0,0,0],assembly);
 const fixed=[pivot[0]-.2,pivot[1]+.1,.15],moving=[elbow[0]*.3,elbow[1]*.3,.15];
 rod([fixed[0],fixed[1],-.3],fixed,.018,'metal',bias);rod([moving[0],moving[1],0],moving,.018,'metal',pawl);
 const band=rod(fixed,[pivot[0]+moving[0],pivot[1]+moving[1],.15],.014,'blue',bias),restLength=Math.hypot(moving[0]+.2,moving[1]-.1);
 control('direction','Requested direction',-1,1,2,1,'','Advance clockwise, or try to reverse the position already reached.',[{value:1,label:'Advance clockwise'},{value:-1,label:'Reverse counterclockwise'}]);
 control('stroke','Requested travel',1,6,1,3,'teeth','One tooth is 30°. Each action starts at the current position.');
 control('release','Holding pawl',0,1,1,0,'','Lift the catch clear to allow movement in either direction.',[{value:0,label:'Engaged'},{value:1,label:'Lifted clear'}]);
 let angle=0,beta=0,checkpoint=0,stage='ready',complete=false,clock=0,target=0,stop=0,lastClock=0,accumulator=0,wasReleased=false;
 function distance(p,a,b){const dx=b[0]-a[0],dy=b[1]-a[1],t=Math.max(0,Math.min(1,((p[0]-a[0])*dx+(p[1]-a[1])*dy)/(dx*dx+dy*dy)));return Math.hypot(p[0]-a[0]-t*dx,p[1]-a[1]-t*dy);}
 function segments(a,b,c,d){const cross=(p,q,r)=>(q[0]-p[0])*(r[1]-p[1])-(q[1]-p[1])*(r[0]-p[0]);if(cross(a,b,c)*cross(a,b,d)<0&&cross(c,d,a)*cross(c,d,b)<0)return 0;return Math.min(distance(a,c,d),distance(b,c,d),distance(c,a,b),distance(d,a,b));}
 function clearance(b){const c=Math.cos(b),s=Math.sin(b),world=p=>[pivot[0]+p[0]*c-p[1]*s,pivot[1]+p[0]*s+p[1]*c],e=world(elbow),t=world(toe),ca=Math.cos(angle),sa=Math.sin(angle),cam=points.map(p=>[p[0]*ca+p[1]*sa,-p[0]*sa+p[1]*ca]);let gap=2;for(let i=0;i<cam.length;i++){const a=cam[i],d=cam[(i+1)%cam.length];gap=Math.min(gap,segments(pivot,e,a,d)-.016,segments(e,t,a,d)-.016,distance(t,a,d)-.025);}return gap;}
 function contact(){
  let open=beta;
  while(clearance(open)<-1e-10&&open>-.45)open=Math.max(-.45,open-.01);
  while(open<0){const closed=Math.min(0,open+.01);if(clearance(closed)<-1e-10){let hi=closed;for(let i=0;i<20;i++){const mid=(open+hi)/2;if(clearance(mid)>=0)open=mid;else hi=mid;}return open;}open=closed;}
  return 0;
 }
 const result=finish(v=>{
  if(wasReleased&&!v.release){beta=0;checkpoint=Math.floor(angle/step+1e-9)*step;}beta=v.release?-.45:contact();wasReleased=!!v.release;if(!v.release&&beta===0)checkpoint=Math.floor(angle/step+1e-9)*step;wheel.rotation.z=-angle;pawl.rotation.z=beta;
  const c=Math.cos(beta),s=Math.sin(beta),a=new THREE.Vector3(...fixed),b=new THREE.Vector3(pivot[0]+moving[0]*c-moving[1]*s,pivot[1]+moving[0]*s+moving[1]*c,.15),length=a.distanceTo(b);
  band.position.copy(a.clone().add(b).multiplyScalar(.5));band.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),b.sub(a).normalize());band.scale.set(Math.sqrt(restLength/length),length/restLength,Math.sqrt(restLength/length));
  const blocked=stage==='blocked',held=stage==='held';
  return {state:{angle,beta,stage,complete,blocked,held,position:angle/step,clearance:clearance(beta)},readings:[r('Your result',blocked?'Reverse blocked · advanced position retained':held?'Pawl holding · advanced position retained':stage==='free'?'Pawl released · position can move either way':stage==='settle'?'Settling back to the next stop':stage==='move'?'Turning the wheel':v.direction===-1&&!v.release?'Ready · pawl blocks counterclockwise; lift it clear to reverse':'Ready · choose direction and press Play'),r('Retained position',(angle/step).toFixed(2)+' teeth'),r('Wheel rotation',(angle*180/Math.PI).toFixed(1)+'°'),r('Pawl',v.release?'Lifted clear':held||blocked?'Toe against stopping face':'Following the tooth profile'),r('Next comparison','Change direction or lift the pawl, then press Play to act from this position.') ]};
 });
 const render=result.update;
 result.update=next=>{const before=result.getState().values;const readings=render(next);if(Object.keys(before).some(k=>before[k]!==result.getState().values[k])){stage='ready';complete=false;clock=0;return render();}return readings;};
 function tick(dt){const v=result.getState().values;if(stage==='ready'){clock=0;if(v.direction===-1&&!v.release){stop=checkpoint;stage=angle>stop+1e-9?'settle':'blocked';}else{stop=v.release?angle+v.direction*v.stroke*step:(Math.floor(angle/step+1e-9)+v.stroke)*step;target=stop+(v.release?0:.12);stage='move';}}
  clock+=dt;if(stage==='move'){const d=target-angle;angle+=Math.sign(d)*Math.min(Math.abs(d),dt*.8);if(Math.abs(angle-target)<1e-9){angle=target;stage=v.release?'free':'settle';complete=!!v.release;}}
  else if(stage==='settle'){angle=Math.max(stop,angle-dt*.45);if(angle<=stop){stage=v.direction===-1?'blocked':'held';complete=true;}}
  else if(stage==='blocked'&&clock>=.5)complete=true;return render();}
 function advance(dt){if(!Number.isFinite(dt)||dt<=0||complete)return render();accumulator+=dt;while(accumulator>=.01-1e-9&&!complete){accumulator-=.01;tick(.01);}if(complete)accumulator=0;return render();}
 result.reset=(initialState={})=>{angle=Number.isFinite(initialState.position)?Math.trunc(initialState.position)*step:0;beta=0;checkpoint=angle;accumulator=0;wasReleased=false;stage='ready';complete=false;clock=0;lastClock=0;return render(result.defaults);};
 result.advance=advance;result.animate=t=>{const dt=Math.max(0,t-lastClock);lastClock=t;return advance(dt);};
 result.playback={label:'Run selected action',stepLabel:'Advance one step',description:'Move the wheel through the requested teeth, then watch the holding result.',advance,step:()=>advance(.2),complete:()=>complete,blocked:()=>false};
 result.followParts=['ratchet','pointer','pawl'];result.resultPart={id:'system',context:'system',view:'front',focusOnComplete:true,label:'Inspect the retained position',available:()=>true};return result;
}

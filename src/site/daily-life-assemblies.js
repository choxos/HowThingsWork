import * as THREE from 'three';
import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js';

const tones={wood:0xa66145,cream:0xf0dfaf,ink:0x374736,leaf:0x91aa7e,metal:0xb4c5b0,gold:0xe3b45e,wall:0xe8dec6};

export function createDailyLifeAssembly(id) {
  if(id!=='front-door')return null;
  const root=new THREE.Group(),parts=[],materials=new Map();
  const gradient=new THREE.DataTexture(new Uint8Array([95,180,255]),3,1,THREE.RedFormat);
  gradient.minFilter=gradient.magFilter=THREE.NearestFilter;gradient.needsUpdate=true;
  const outline=new THREE.MeshBasicMaterial({color:tones.ink,side:THREE.BackSide});
  function mesh(geometry,tone,pos,parent=root){
    if(!materials.has(tone))materials.set(tone,new THREE.MeshToonMaterial({color:tones[tone],gradientMap:gradient}));
    const object=new THREE.Mesh(geometry,materials.get(tone));object.position.set(...pos);object.castShadow=true;object.receiveShadow=true;parent.add(object);
    const edge=new THREE.Mesh(geometry,outline);edge.scale.setScalar(1.012);edge.userData.outline=true;object.add(edge);return object;
  }
  const box=(size,pos,tone,parent=root)=>mesh(new RoundedBoxGeometry(...size,2,Math.min(...size)*.12),tone,pos,parent);
  const cylinder=(r,h,pos,tone,parent=root)=>mesh(new THREE.CylinderGeometry(r,r,h,24),tone,pos,parent);
  const disk=(r,h,pos,tone,parent=root)=>{const o=cylinder(r,h,pos,tone,parent);o.rotation.x=Math.PI/2;return o;};
  const ring=(r,t,pos,tone,parent=root)=>mesh(new THREE.TorusGeometry(r,t,8,32),tone,pos,parent);
  function part(id,name,pos,description,route,parent=root){
    const object=new THREE.Group();object.name=name;object.position.set(...pos);parent.add(object);
    parts.push({id,name,object,description,...(route?{route}: {})});return object;
  }

  root.name='Front door assembly';root.userData.machine='Front door';
  const frame=part('frame','Frame and threshold',[0,0,0],'The frame is fixed to the wall. The hinges attach to one jamb, and the lock strikes attach to the opposite jamb.');
  box([.16,3.2,.3],[-.84,1.6,0],'cream',frame);box([.16,3.2,.3],[.84,1.6,0],'cream',frame);
  box([1.84,.16,.3],[0,3.12,0],'cream',frame);box([1.84,.1,.48],[0,.05,.03],'wood',frame);
  box([.62,3.4,.21],[-1.23,1.7,-.055],'wall');box([.9,3.4,.21],[1.37,1.7,-.055],'wall');box([3.34,.24,.21],[.14,3.32,-.055],'wall');
  box([3.65,.08,1.1],[.14,-.04,.16],'cream');
  const door=part('door','Door leaf',[-.755,.11,.095],'This redwood-colored panel turns as one piece around the vertical hinge axis. The mounted locks travel with it. The opening control assumes both locks are released.');
  box([1.5,2.91,.11],[.75,1.455,-.035],'wood',door);
  for(const x of [.39,1.11])for(const y of [.67,2.04]){
    box([.58,1.05,.035],[x,y,.036],'cream',door);
    box([.5,.96,.04],[x,y,.059],'wood',door);
  }
  box([1.36,.11,.045],[.75,1.38,.039],'wood',door);
  const hinges=part('hinges','Three hinges',[0,0,0],'The three hinge pins share one vertical axis. Frame-side leaves stay fixed; door-side leaves rotate with the door.');
  for(const y of [.43,1.6,2.78]){
    box([.11,.2,.024],[-.811,y,.104],'gold',hinges);
    cylinder(.034,.23,[-.755,y,.095],'gold',hinges);
    cylinder(.043,.024,[-.755,y+.126,.095],'gold',hinges);
    box([.11,.2,.024],[.055,y-.11,.009],'gold',door);
    for(const dy of [-.055,.055])disk(.01,.008,[-.825,y+dy,.121],'ink',hinges);
  }
  const cylinderLock=part('cylinder-lock','Cylinder deadbolt',[1.3,1.66,.087],'An upper cylinder lock operates a separate deadbolt. Open this mechanism to inspect its key, pin stacks, plug, and bolt.','#machine/cylinder-lock',door);
  disk(.107,.036,[0,0,0],'gold',cylinderLock);disk(.067,.046,[0,0,.015],'metal',cylinderLock);
  box([.015,.064,.008],[0,-.008,.043],'ink',cylinderLock);
  box([.028,.032,.008],[.008,-.019,.044],'ink',cylinderLock);
  const leverLock=part('lever-lock','Lever lock and handle',[1.3,1.23,.083],'This lower lever lock is separate from the upper cylinder deadbolt. Its handle operates the spring latch; its key operates its locking mechanism.','#machine/lever-lock',door);
  box([.16,.39,.035],[0,0,0],'gold',leverLock);disk(.046,.074,[0,.075,.043],'metal',leverLock);
  box([.21,.045,.055],[-.074,.075,.094],'gold',leverLock);
  disk(.021,.008,[0,-.09,.025],'ink',leverLock);box([.014,.035,.008],[0,-.11,.025],'ink',leverLock);
  for(const y of [-.155,.155])disk(.009,.008,[0,y,.025],'ink',leverLock);
  for(const y of [1.77,1.34]){
    box([.03,.23,.11],[.752,y-.11,-.035],'gold',door);
    box([.025,.23,.13],[.75,y,-.025],'metal',frame);
    box([.028,.075,.064],[.735,y,-.022],'ink',frame);
  }
  const bell=part('electric-bell','Electric bell and button',[1.27,2.37,.12],'The wall-mounted bell stays still when the door opens. Follow the wire to its push button, then open the bell to inspect its electromagnet, contacts, and hammer.','#machine/electric-bell');
  box([.42,.49,.07],[0,0,0],'wood',bell);
  const gong=mesh(new THREE.SphereGeometry(.175,32,16,0,Math.PI*2,0,Math.PI/2),'gold',[0,.045,.065],bell);gong.rotation.x=Math.PI/2;gong.scale.y=.45;
  disk(.023,.03,[0,.045,.154],'ink',bell);
  box([.16,.07,.055],[.104,-.124,.13],'metal',bell);
  box([.012,.87,.018],[.16,-.645,-.006],'ink',bell);
  box([.2,.29,.07],[.16,-1.17,.011],'cream',bell);disk(.055,.03,[.16,-1.17,.067],'ink',bell);
  const keys=part('keys','Keys on their hook',[-1.16,1.92,.1],'The shapes of the keys match different lock mechanisms. Open the key lesson to compare cuts and see why one wrong cut blocks a lock.','#machine/keys');
  box([.33,.19,.045],[0,.11,0],'wood',keys);cylinder(.018,.105,[0,.09,.065],'metal',keys);
  ring(.084,.012,[0,0,.085],'gold',keys);
  for(const [x,angle] of [[-.045,-.16],[.045,.2]]){
    const key=new THREE.Group();key.position.set(x,-.075,.097);key.rotation.z=angle;keys.add(key);
    ring(.042,.012,[0,0,0],'gold',key);box([.026,.18,.018],[0,-.122,0],'gold',key);
    for(let i=0;i<3;i++)box([.032,.018,.02],[.017,-.11-i*.032,0],'gold',key);
  }
  const controls=[{key:'open',label:'Open the door',min:0,max:90,step:1,initial:0,unit:'°',help:'Turn the whole door on its hinges. This assembly view assumes the locks are released; inspect each lock to operate its mechanism.'}];
  let angle=0,readings=[];
  function update(values={}){
    if(Number.isFinite(values.open))angle=Math.round(Math.max(0,Math.min(90,values.open)));
    door.rotation.y=angle*Math.PI/180;
    readings=[{label:'Door opening',value:`${angle}°`},{label:'Mounted mechanisms',value:'Two separate locks and one wall bell'},{label:'Assembly state',value:'Locks released for positioning',hint:'Enter a mechanism to explore locking, key matching, or the bell circuit.'}];
    return readings;
  }
  function dispose(){const geometries=new Set();root.traverse(o=>{if(o.geometry)geometries.add(o.geometry);});geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());outline.dispose();gradient.dispose();}
  update();
  return {root,covers:[],controls,defaults:{open:0},parts,update,dispose,getState:()=>({angle,values:{open:angle},readings:readings.map(r=>({...r}))})};
}

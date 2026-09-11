import * as THREE from 'three';
import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js';

export function houseModel(name){
 const root=new THREE.Group(),parts=[],covers=[],controls=[],values={},materials=new Map();
 const colors={leaf:0x91aa7e,clay:0xce825f,cream:0xf0dfaf,ink:0x374736,blue:0x83b4c1,wood:0xae8056,metal:0xb4c5b0,gold:0xe3b45e,red:0xc14f39};
 const gradient=new THREE.DataTexture(new Uint8Array([95,180,255]),3,1,THREE.RedFormat);gradient.minFilter=gradient.magFilter=THREE.NearestFilter;gradient.needsUpdate=true;
 function material(color){const tone=colors[color]??color;if(!materials.has(tone))materials.set(tone,new THREE.MeshToonMaterial({color:tone,gradientMap:gradient}));return materials.get(tone);}
 function mesh(geometry,pos=[0,0,0],color='metal',parent=root){const object=new THREE.Mesh(geometry,material(color));object.position.set(...pos);parent.add(object);return object;}
 function part(id,label,description,pos=[0,0,0],parent=root){const object=new THREE.Group();object.position.set(...pos);object.name=label;parent.add(object);let ancestor=parent;while(ancestor!==root&&!parts.some(p=>p.object===ancestor))ancestor=ancestor.parent;const parentId=parts.find(p=>p.object===ancestor)?.id;parts.push({id,name:label,description,object,...(parentId?{parentId}: {})});return object;}
 const box=(size,pos,color,parent)=>mesh(new RoundedBoxGeometry(...size,2,Math.min(...size)*.1),pos,color,parent);
 const cylinder=(r,h,pos,color,parent)=>mesh(new THREE.CylinderGeometry(r,r,h,32),pos,color,parent);
 const disk=(r,h,pos,color,parent)=>{const o=cylinder(r,h,pos,color,parent);o.rotation.x=Math.PI/2;return o;};
 const sphere=(r,pos,color,parent)=>mesh(new THREE.SphereGeometry(r,24,16),pos,color,parent);
 const ring=(r,t,pos,color,parent)=>mesh(new THREE.TorusGeometry(r,t,8,48),pos,color,parent);
 function rod(a,b,r=.025,color='metal',parent=root){const av=new THREE.Vector3(...a),bv=new THREE.Vector3(...b);const object=cylinder(r,av.distanceTo(bv),av.clone().add(bv).multiplyScalar(.5).toArray(),color,parent);object.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),bv.sub(av).normalize());return object;}
 function tube(points,r=.025,color='metal',parent=root){return mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points.map(p=>new THREE.Vector3(...p))),Math.max(32,points.length*3),r,8,false),[0,0,0],color,parent);}
 function gear(radius,teeth,pos,color,parent){const group=new THREE.Group();group.position.set(...pos);parent.add(group);disk(radius*.9,.12,[0,0,0],color,group);for(let i=0;i<teeth;i++){const a=i*Math.PI*2/teeth;const tooth=box([radius*.17,radius*.2,.13],[Math.sin(a)*radius,Math.cos(a)*radius,0],color,group);tooth.rotation.z=-a;}disk(radius*.15,.17,[0,0,0],'ink',group);return group;}
 function spring(pos,r,h,turns,parent,wireRadius=.02){
  function geometry(height){const points=[];for(let i=0;i<=turns*20;i++){const a=i*Math.PI/10;points.push(new THREE.Vector3(pos[0]+r*Math.cos(a),pos[1]+height*i/(turns*20),pos[2]+r*Math.sin(a)));}return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points),Math.max(32,points.length*3),wireRadius,8,false);}
  const coil=mesh(geometry(h),[0,0,0],'metal',parent);
  coil.userData.setLength=height=>{if(height===h)return;h=height;coil.geometry.dispose();coil.geometry=geometry(height);};
  return coil;
 }
 // `extra` carries per-control flags; `replay:false` keeps a setting out of the
 // replayed experiment, so a control the learner opts into (sound, say) starts
 // from its initial value again rather than repeating itself unasked.
 function control(key,label,min,max,step,initial,unit='',help='',options,extra){controls.push({key,label,min,max,step,initial,unit,help,...(options?{options}: {}),...(extra||{})});values[key]=initial;}
 function finish(run,{animated=false}={}){let phase=0,readings=[],state={};const defaults={...values};function render(){const result=run(values,phase);readings=result.readings;state=result.state||{};return readings;}function update(next={}){for(const control of controls){const value=next[control.key];if(!Number.isFinite(value))continue;const bounded=Math.max(control.min,Math.min(control.max,value));if(control.options&&!control.options.some(option=>option.value===bounded))continue;values[control.key]=Number(Math.max(control.min,Math.min(control.max,control.min+Math.round((bounded-control.min)/control.step)*control.step)).toPrecision(12));}return render();}function animate(next){phase=Number.isFinite(next)?Math.max(0,next):0;return render();}update();root.name=name;root.userData.machine=name;return {root,parts,covers,controls,defaults,update,...(animated?{animate}:{}),getState:()=>({...state,values:{...values},readings}),dispose(){const geometries=new Set();root.traverse(object=>{if(object.geometry)geometries.add(object.geometry);if(object.material){for(const mat of (Array.isArray(object.material)?object.material:[object.material]))if(![...materials.values()].includes(mat))mat.dispose();}});geometries.forEach(geometry=>geometry.dispose());materials.forEach(mat=>mat.dispose());gradient.dispose();}};}
 return {root,parts,covers,control,part,box,cylinder,disk,sphere,ring,rod,tube,gear,spring,finish};
}
export const reading=(label,value,hint)=>({label,value,...(hint?{hint}: {})});

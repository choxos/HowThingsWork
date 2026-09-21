import * as THREE from 'three';
import {createToiletTankModel} from './toilet-tank-model.js';
import {cisternConstants as C,pipeArea} from './toilet-tank-physics.js';
import {reading as r} from './house-model-kit.js';
import {segmentLines,fillLine} from './scene-kit.js';
import {fixed} from './format.js';

export function createSiphonModel(){
  const model=createToiletTankModel(),{root,topology}=model,{MM,system}=topology;
  const base={update:model.update,reset:model.reset,advance:model.advance,getState:model.getState,frame:model.frameBoundsForPart};
  model.controls=model.controls.filter(c=>c.key!=='perDay').map(c=>({...c,...(c.key==='pressure'?{initial:0}:{}),...(c.key==='level'?{label:'Initial water level',help:'Sets the filled starting surface and float shutoff level. Compare the blue driving head with the gold lift to the bend centerline.'}:{})}));
  model.defaults=Object.fromEntries(model.controls.map(c=>[c.key,c.initial]));
  const guides=new THREE.Group();guides.userData.explosionExcluded=true;system.add(guides);
  const down=new THREE.Vector3(0,-1,0),up=new THREE.Vector3(0,1,0);
  const headArrow=new THREE.ArrowHelper(down,new THREE.Vector3(),1,0x26788f,.16,.10);
  const liftArrow=new THREE.ArrowHelper(up,new THREE.Vector3(),1,0xa76d16,.16,.10);
  guides.add(headArrow,liftArrow);
  const headTicks=segmentLines(2,0x26788f,guides),liftTicks=segmentLines(2,0xa76d16,guides);
  guides.traverse(o=>{o.raycast=()=>{};});
  const point=(x,y,z=110)=>[x*MM,y*MM,z*MM];
  function refresh(){
    const s=base.getState(),h=s.level*1000,crest=(C.bendBase+C.bendRadius)*1000;
    headArrow.position.set(...point(-245,h));headArrow.setLength((h+C.outletDrop*1000)*MM,.16,.10);
    liftArrow.position.set(...point(245,h));liftArrow.setDirection(h<=crest?up:down);liftArrow.setLength(Math.abs(crest-h)*MM,.16,.10);liftArrow.visible=Math.abs(crest-h)>1e-6;
    fillLine(headTicks,[point(-200,h,90),point(-245,h),point(-245,-250),point(150,-250,30)]);
    fillLine(liftTicks,[point(200,h,90),point(245,h),point(245,crest),point(92.5,crest,30)]);
    return model.getState().readings;
  }
  model.getState=()=>{
    const s=base.getState(),{perDay,...values}=s.values;
    const h=s.level+C.outletDrop,lift=C.bendBase+C.bendRadius-s.level;
    const readings=s.readings.filter(row=>!['Annual repeated use','Cycle total'].includes(row.label)).map(row=>row.label==='Your result'&&s.stage==='siphoning'&&values.pressure===0?{...row,value:'Siphon draining · supply isolated'}:row);
    readings.splice(2,0,
      r('Driving head · blue',`${fixed(h*1000,1)} mm`,'Left arrow: outside surface down to the outlet. A positive head cannot start an air-filled passage by itself.'),
      r('Lift to crest · gold',`${fixed(lift*1000,1)} mm`,'Right arrow: outside surface to the bend centerline. Negative means the outside surface is above the bend centerline. This guide measures height, not pressure or flow.'),
      r('Full-column speed',s.stage==='siphoning'?`${fixed(s.flow/pipeArea(values.bore),3)} m/s`:'No full siphoning column','Discharge divided by bore area, only while the whole column is primed. Direction dots have schematic speed.'));
    return {...s,values,drivingHead:h,crestLift:lift,readings};
  };
  model.update=next=>{base.update(next);return refresh();};
  model.advance=dt=>{base.advance(dt);return refresh();};
  model.reset=()=>{base.reset();return model.update(model.defaults);};
  model.actions=model.actions.map(action=>({...action,run(){action.run();return refresh();}}));
  model.playback={...model.playback,label:'Run the siphon',advance:model.advance};
  model.frameBoundsForPart=id=>{
    if(id!=='system')return base.frame(id);
    root.updateWorldMatrix(true,false);
    return new THREE.Box3(new THREE.Vector3(...point(-270,-285,-100)),new THREE.Vector3(...point(270,425,118))).applyMatrix4(root.matrixWorld);
  };
  Object.assign(topology,{guides,headArrow,liftArrow,headTicks,liftTicks});
  model.reset();return model;
}

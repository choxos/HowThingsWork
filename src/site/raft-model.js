import * as THREE from 'three';
import {houseModel,reading as r} from './house-model-kit.js';
import {solidArrow,surface} from './scene-kit.js';
import {fixed} from './format.js';
import {RAFT,RAFT_DEFAULTS,raftStart,raftForces,raftEquilibrium,advanceRaft} from './raft-physics.js';

export function createRaftModel(){
  const kit=houseModel('Raft'),{part,box,rod,control,finish}=kit;
  const system=part('system','Raft, cargo and water','Follow the loaded raft and compare gravity with displaced-water support.');
  const moving=new THREE.Group();moving.name='Moving raft';system.add(moving);
  const timbers=part('timbers','Six buoyant timbers','Each squared timber is 2 m long, 0.20 m wide and 0.20 m deep. Total timber volume is 0.480 m³.',[0,0,0],moving);timbers.userData.explosionCategory=true;
  for(let i=0;i<6;i++){
    const timber=part('timber-'+i,'Timber '+(i+1),'Water pushes upward on the immersed volume of this solid timber.',[0,.1,(i-2.5)*.208],timbers);
    surface(kit,new THREE.BoxGeometry(2,.2,.2),i%2?'wood':'gold',timber);
    for(const x of [-1.001,1.001])for(const d of [.05,.11]){
      const points=[[x,-d/2,-d/2],[x,d/2,-d/2],[x,d/2,d/2],[x,-d/2,d/2],[x,-d/2,-d/2]];points.slice(1).forEach((p,j)=>rod(points[j],p,.0015,0x886744,timber));
    }
  }
  const bindings=part('bindings','Rope bindings','Two continuous bindings keep the timbers together. Their small mass and displaced volume are neglected.',[0,0,0],moving);bindings.userData.explosionCategory=true;
  for(const [i,x] of [-.78,.78].entries()){
    const binding=part('binding-'+i,(i?'Right':'Left')+' rope binding','A continuous lashing surrounds the six timbers.',[x,0,0],bindings);
    const points=[[0,.21,-.626],[0,.21,.626],[0,0,.626],[0,0,-.626],[0,.21,-.626]];points.slice(1).forEach((p,j)=>rod(points[j],p,.008,'cream',binding));
  }
  const cargo=part('cargo','Steel cargo','Four equal blocks share the selected cargo mass. Their submerged volume also displaces water.',[0,0,0],moving);cargo.userData.explosionCategory=true;
  const blocks=[];
  for(let i=0;i<4;i++){
    const block=part('cargo-'+i,'Steel block '+(i+1),'One quarter of the cargo mass. Steel density is fixed at 7,850 kg/m³.',[(i%2?1:-1)*.36,.2,(i<2?1:-1)*.312],cargo);
    const mesh=surface(kit,new THREE.BoxGeometry(1,1,1),'metal',block);blocks.push({block,mesh});
  }
  const reference=part('water','Water and depth reference','The blue surface stays at zero. The bottom is 0.95 m below it. This is a water sample, not a wall that can hold the raft up.',[0,0,0],system);
  const water=surface(kit,new THREE.PlaneGeometry(2.65,1.75),'blue',reference,true);water.rotation.x=-Math.PI/2;water.material=water.material.clone();water.material.transparent=true;water.material.opacity=.22;water.material.depthWrite=false;water.raycast=()=>{};
  const corners=[[-1.325,0,-.875],[1.325,0,-.875],[1.325,0,.875],[-1.325,0,.875],[-1.325,0,-.875]];corners.slice(1).forEach((p,i)=>rod(corners[i],p,.006,'blue',reference));
  const floor=part('bottom','Riverbed reference','After sinking, the bottom supplies the force that buoyancy cannot supply.',[0,RAFT.floor-.025,0],reference);box([2.65,.05,1.75],[0,0,0],'cream',floor);
  const gauge=part('depth','Depth scale','Marks at 0.1 m intervals measure distance below the fixed water surface.',[-1.24,0,-.83],reference);rod([0,0,0],[0,-.95,0],.009,'ink',gauge);for(let i=0;i<=9;i++)rod([0,-i*.1,0],[i%5? .06:.1,-i*.1,0],.006,'ink',gauge);
  const forces=part('forces','Force comparison','Arrows share a scale of one meter per 6,000 N. These are a force diagram beside the raft, not extra physical parts.',[0,0,0],system);
  const arrows={};
  for(const [i,[id,name,color,description]] of [['weight','Weight',0xc57148,'Gravity pulls the combined mass downward.'],['buoyancy','Buoyancy',0x458aab,'The upward force equals the weight of displaced water.'],['support','Bottom support',0x62665d,'The riverbed pushes upward only while the raft rests on it.'],['drag','Water resistance',0x668d59,'Damping opposes vertical speed and vanishes at rest.']].entries()){
    const p=part(id,name,description,[1.5+i*.16,-.5,0],forces);const arrow=solidArrow(kit,color,p,.014);arrows[id]={part:p,arrow};
  }
  control('cargo','Cargo mass',0,400,10,100,'kg','Four steel blocks share this mass. Changing a setting restarts the observation clock and preserves the current position.');
  control('wood','Timber density',300,800,50,500,'kg/m³','Same timber volume; denser wood leaves less capacity for cargo.');
  control('water','Water density',1000,1025,25,1000,'kg/m³','Compare the same load in fresh water and a representative salt water.',[{value:1000,label:'Fresh water · 1,000 kg/m³'},{value:1025,label:'Salt water · 1,025 kg/m³'}]);
  let state=raftStart(RAFT_DEFAULTS),started=false,previous={...RAFT_DEFAULTS},lastClock=0;
  const result=finish(values=>{
    if(Object.keys(values).some(k=>values[k]!==previous[k]))state.elapsed=0;
    previous={...values};if(!started)state=raftStart(values);
    const f=raftForces(values,state.bottom,state.velocity),eq=raftEquilibrium(values),freeboard=state.bottom+RAFT.height;
    moving.position.y=state.bottom;
    for(const {block,mesh} of blocks){block.visible=values.cargo>0;mesh.scale.setScalar(Math.max(f.side,1e-9));mesh.position.y=f.side/2;}
    const magnitudes={weight:-f.weight,buoyancy:f.buoyancy,support:f.support,drag:f.drag};
    for(const [id,{part:p,arrow}] of Object.entries(arrows)){const value=magnitudes[id];p.position.y=value<0?.6:-.7;arrow.userData.setDirection(new THREE.Vector3(0,value<0?-1:1,0));arrow.userData.setLength(Math.abs(value)/6000);}
    const grounded=f.support>1e-6,settled=Math.abs(state.velocity)<.003&&Math.abs(f.net)<8;
    const status=grounded?'Resting on the bottom':!settled?'Moving '+(state.velocity>.003?'up':state.velocity<-.003?'down':f.net<0?'down':'up'):freeboard>.0005?'Floating · deck above water':freeboard>=-.0005?'Floating · deck awash':'Floating · cargo partly submerged';
    return {state:{...state,...f,freeboard,equilibrium:eq,complete:state.elapsed>=RAFT.duration,started,status},readings:[
      r('Your result',status),r('Observation',state.elapsed.toFixed(2)+' / 12 s','Play follows the vertical motion; pause or step to compare forces.'),
      r('Total mass',f.mass.toFixed(1)+' kg','Timber '+(RAFT.volume*values.wood).toFixed(1)+' kg + cargo '+values.cargo+' kg.'),
      r('Displaced water',(f.displaced*1000).toFixed(1)+' L',(values.water*f.displaced).toFixed(1)+' kg of displaced water.'),
      r('Deck above water',fixed(freeboard*100,1)+' cm','A negative value means the deck is below the surface.'),
      r('Weight · orange ↓',f.weight.toFixed(0)+' N'),r('Buoyancy · blue ↑',f.buoyancy.toFixed(0)+' N'),
      r('Bottom support · gray ↑',f.support.toFixed(0)+' N'),r('Water resistance · green',Math.abs(f.drag).toFixed(0)+' N'+(Math.abs(f.drag)<.5?'':f.drag>0?' ↑':' ↓')),
      r('Dry-deck cargo limit',eq.dryCargo.toFixed(1)+' kg','At this mass the timber tops reach the surface. This is not a safe load rating.'),
      r('Predicted resting state',eq.status==='grounded'?'On the bottom':eq.status==='dry'?'Deck above water':eq.status==='awash'?'Deck at the surface':'Cargo partly submerged','For unchanged settings. Fully submerged flotation limit: '+eq.maxCargo.toFixed(1)+' kg of cargo.'),
    ]};
  },{animated:true});
  function advance(seconds){if(!Number.isFinite(seconds)||seconds<=0)return result.update();started=true;state=advanceRaft(state,result.getState().values,seconds);return result.update();}
  result.advance=advance;result.animate=clock=>{const dt=Math.max(0,clock-lastClock);lastClock=clock;return dt?advance(dt):result.update();};
  result.reset=()=>{started=false;lastClock=0;state=raftStart(RAFT_DEFAULTS);result.update(RAFT_DEFAULTS);};
  result.actions=[{label:'Finish this observation',run:()=>advance(RAFT.duration-state.elapsed),replay:false},{label:'Unload the raft',run(){started=true;state.elapsed=0;result.update({cargo:0});},replay:false}];
  result.playback={label:'Observe the raft',stepLabel:'Observe half a second',description:'Watch twelve simulated seconds of vertical motion. Changing a setting preserves position and starts a new observation.',advance,step:()=>advance(.5),complete:()=>state.elapsed>=RAFT.duration,blocked:()=>false};
  result.resultPart={id:'system',context:'system',label:'Inspect raft and forces',available:()=>true};
  result.framingBounds=new THREE.Box3(new THREE.Vector3(-1.4,-1.03,-.9),new THREE.Vector3(2.08,.7,.9));
  return result;
}

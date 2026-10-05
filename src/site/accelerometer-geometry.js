import * as THREE from 'three';
import {textLabel,solidArrow} from './scene-kit.js';

const colors={ink:0x374736,blue:0x83b4c1,gold:0xe3b45e,red:0xc14f39};
const label=(parent,text,x,y,width=2,height=.14,z=.35)=>textLabel(parent,text,{width,height,position:[x,y,z]});
const dynamic=mesh=>{mesh.material=mesh.material.clone();return mesh;};
function line(parent,points,color){
  const geometry=new THREE.BufferGeometry().setFromPoints(points.map(p=>new THREE.Vector3(...p)));
  const object=new THREE.Line(geometry,new THREE.LineBasicMaterial({color}));parent.add(object);return object;
}
function setPoints(object,points){
  const data=object.geometry.attributes.position;
  points.forEach((point,i)=>data.setXYZ(i,...point));data.needsUpdate=true;object.geometry.computeBoundingSphere();object.geometry.computeBoundingBox();
}
function arrow(kit,parent,color,start,direction,length){
  const object=solidArrow(kit,color,parent,.014);object.position.set(...start);object.userData.setDirection(new THREE.Vector3(...direction));object.userData.setLength(length);return object;
}

export function createAccelerometerGeometry(kit){
  const system=kit.part('system','Accelerometer teaching module','A connected cutaway: suspended silicon, sensing electronics, three output filters and a power connection. Geometry is conceptual, not an ADXL335 teardown.');
  const module=kit.part('module','Complete sensor module','The module turns three components of specific force into three analog outputs. The selected pose rotates its local axes relative to upward in the world.',[0,0,0],system);
  const make=(id,name,description,parent=module)=>kit.part(id,name,description,[0,0,0],parent);
  const board=make('board','Module circuit board','Carries the sensor package, power decoupling and the three external output capacitors. The visible paths connect the functional stages.');
  kit.box([3.55,3.4,.12],[0,0,-.22],'leaf',board);
  for(const x of [-1.56,1.56])for(const y of [-1.47,1.47])kit.ring(.075,.018,[x,y,-.15],'gold',board);
  const frame=make('frame','Fixed silicon frame and anchors','The frame moves with the package. Four flexible corner suspensions support one shared proof mass. Orthogonal detectors sense its displacement.');
  const center=[-.4,.35,.24];frame.position.set(...center);
  for(const x of [-.98,.98])kit.box([.12,2.08,.12],[x,0,0],'ink',frame);
  for(const y of [-.98,.98])kit.box([1.86,.12,.12],[0,y,0],'ink',frame);
  const mounts=[];
  for(const x of [-.98,.98])for(const y of [-.98,.98])mounts.push(kit.rod([x,y,-.40],[x,y,-.06],.055,'ink',frame));
  const mass=make('mass','Shared suspended proof mass','Specific force deflects the mass opposite the indicated positive reading. This enlarged drawing omits real dimensions, resonance, cross-axis coupling and flexure design.');mass.position.set(...center);
  kit.box([.8,.8,.08],[0,0,.04],'metal',mass);
  for(const a of [-.22,.22])for(const sign of [-1,1]){
    kit.box([.025,.32,.055],[a,sign*.56,.04],'metal',mass);
    kit.box([.32,.025,.055],[sign*.56,a,.04],'metal',mass);
  }
  const electrodes=make('electrodes','Opposed fixed sensing fingers','The moving fingers lie between fixed electrodes. Opposed excitation lets electronics detect the sign and size of a capacitance imbalance. The front and rear plates represent out-of-plane sensing.');electrodes.position.set(...center);
  for(const a of [-.22,.22])for(const sign of [-1,1])for(const offset of [-.19,.19]){
    kit.box([.025,.39,.055],[a+offset,sign*.745,.04],offset<0?'blue':'gold',electrodes);
    kit.box([.39,.025,.055],[sign*.745,a+offset,.04],offset<0?'blue':'gold',electrodes);
  }
  for(const sign of [-1,1]){
    kit.box([1.18,.045,.055],[0,sign*.92,.04],'blue',electrodes);
    kit.box([.045,1.18,.055],[sign*.92,0,.04],'gold',electrodes);
  }
  const rear=kit.box([.68,.68,.025],[0,0,-.20],'blue',electrodes);
  const front=dynamic(kit.box([.68,.68,.025],[0,0,.28],'gold',electrodes));Object.assign(front.material,{transparent:true,opacity:.16,depthWrite:false});
  const plateSupports=[];
  for(const z of [-.20,.28])for(const side of [-1,1]){
    const arm=kit.rod([side*.33,0,z],[side*.98,0,z],.014,z<0?'blue':'gold',electrodes);
    const stand=kit.rod([side*.98,0,0],[side*.98,0,z],.018,'cream',electrodes);
    plateSupports.push({z,side,arm,stand});
  }
  const springs=make('springs','Flexible silicon suspensions','The anchored flexures provide a restoring force. Their motion is exaggerated; this is not a manufacturing layout.');springs.position.set(...center);
  const flexures=[];
  for(const x of [-1,1])for(const y of [-1,1]){
    kit.box([.1,.1,.11],[x*.87,y*.87,.015],'ink',springs);
    const points=[[x*.87,y*.87,.04],[x*.67,y*.87,.04],[x*.67,y*.67,.04],[x*.4,y*.4,.04]];
    flexures.push({x,y,line:line(springs,points,colors.ink)});
  }
  const electronics=make('electronics','Excitation, demodulation and amplifier','Alternating excitation probes capacitance even when the mass is stationary. A phase-sensitive readout recovers a signed signal; the amplifier sets the nominal output sensitivity.');
  kit.box([.46,1.18,.15],[1.10,.32,-.08],'ink',electronics);
  textLabel(electronics,'Readout',{width:.43,height:.11,position:[1.1,.38,.02],color:'#f5f1dc'});
  const sensingLeads=[];
  for(const y of [-.07,.19,.45]){
    const points=[[.64,y,.24],[.76,y,.16],[.88,y,-.08]];
    sensingLeads.push({points,segments:[kit.rod(points[0],points[1],.018,'gold',electronics),kit.rod(points[1],points[2],.018,'gold',electronics)]});
  }
  const filters=[],outputs=[];
  for(let i=0;i<3;i++){
    const x=-1.02+i*.98,axis='XYZ'[i];
    const channel=make('channel-'+axis.toLowerCase(),axis+' output filter and terminal',`The ${axis} output capacitor and its terminal form one channel. The three output channels stay separate.`);channel.userData.explosionRigid=true;
    const filter=make('filter-'+axis.toLowerCase(),axis+' output capacitor',`An external capacitor from ${axis} OUT to common forms a low-pass filter with the nominal internal 32 kΩ resistance. It smooths the electrical output, not the mechanical mass.`,channel);
    kit.box([.28,.36,.16],[x,-1.0,-.07],'cream',filter);
    kit.rod([x,-.73,-.11],[x,-.82,-.11],.017,'gold',filter);kit.rod([x,-1.18,-.11],[x,-1.35,-.11],.017,'gold',filter);
    kit.rod([x,-1.35,-.11],[x,-1.35,-.14],.018,'gold',board);
    label(filter,axis+' filter',x,-1.02,.57,.11,.04);
    // Each output is a separate track on the board. Do not merge the three rails.
    line(board,[[.96+i*.14,-.27,-.14],[.96+i*.14,-.32-i*.10,-.14],[x,-.32-i*.10,-.14],[x,-.82,-.14]],colors.gold);
    filters.push(filter);
    const output=make('output-'+axis.toLowerCase(),axis+' output terminal',`The nominal powered ${axis} output is 1.5 V + 0.3 V/g times the filtered equivalent input. This is an ideal electrical example at 3 V, not individual-device calibration.`,channel);
    kit.box([.1,.17,.13],[x+.3,-1.47,-.08],'gold',output);
    line(board,[[x,-.76,-.11],[x+.3,-.76,-.11],[x+.3,-1.47,-.11]],colors.gold);
    outputs.push(label(output,axis+' 1.500 V',x,-1.72,.88,.14));
  }
  const supply=make('supply','3 V supply and decoupling','The sensor electronics require power. A local supply capacitor helps stabilize the rail; output readings are unavailable when power is off.');
  kit.box([.16,.32,.13],[1.49,1.04,-.08],'cream',supply);
  kit.box([.15,.15,.12],[1.05,1.45,-.08],'red',supply);kit.box([.15,.15,.12],[1.36,1.45,-.08],'ink',supply);
  // Board traces remain on the board in the inventory. Common crosses outputs
  // on a different layer, rather than electrically joining their signal nodes.
  line(board,[[1.05,1.45,-.11],[1.05,1.04,-.11],[1.49,1.04,-.11]],colors.red);
  line(board,[[1.36,1.45,-.14],[1.62,1.45,-.14],[1.62,-1.35,-.14],[-1.25,-1.35,-.14]],colors.ink);
  line(board,[[1.49,1.04,-.11],[1.10,1.04,-.11],[1.10,.91,-.11]],colors.red);
  line(board,[[1.49,.88,-.14],[1.62,.88,-.14]],colors.ink);
  label(supply,'3 V',1.05,1.60,.26,.10,.01);label(supply,'COM',1.38,1.60,.30,.10,.01);
  const indicator=dynamic(kit.sphere(.045,[1.48,.68,.02],'leaf',supply));
  const guides=new THREE.Group();module.add(guides);guides.userData.explosionExcluded=true;
  label(guides,'Three-axis capacitive sensor',-.26,1.86,2.85,.18);
  label(guides,'Conceptual cutaway; motion enlarged',0,2.14,3.4,.14);
  const axes=[arrow(kit,guides,colors.red,[-1.38,-.66,.3],[1,0,0],.38),arrow(kit,guides,colors.blue,[-1.38,-.66,.3],[0,1,0],.38),arrow(kit,guides,colors.gold,[-1.38,-.66,.3],[0,0,1],.38)];
  label(guides,'x',-.90,-.66,.16,.13,.3);label(guides,'y',-1.38,-.16,.16,.13,.3);label(guides,'z',-1.55,-.65,.16,.13,.74);

  const detail=kit.part('capacitive-detail','Capacitance and electrical readout','An isolated one-axis plate analogy. The mass shifts opposite specific force. The nearer electrode has larger capacitance; AC excitation and synchronous demodulation can detect a static gap.',[0,0,0],system);
  detail.userData.inspectionOnly='capacitive-detail';detail.userData.explosionExcluded=true;
  label(detail,'A stationary gap still gives a signal',0,1.65,3.65,.2);
  label(detail,'Ideal plate analogy; no microscopic dimensions',0,1.36,3.65,.14);
  const fixedNegative=dynamic(kit.box([.09,1.0,.22],[-.9,.25,0],'blue',detail)),fixedPositive=dynamic(kit.box([.09,1.0,.22],[.9,.25,0],'gold',detail));
  const middle=kit.box([.10,.85,.24],[0,.25,0],'metal',detail);
  const gapLabels=[label(detail,'C−',-.95,1.0,1.25,.18),label(detail,'C+',.95,1.0,1.25,.18)];
  const driveLabels=[label(detail,'− drive',-.95,-.47,1.2,.16),label(detail,'+ drive',.95,-.47,1.2,.16)];
  for(const x of [-.9,.9]){
    line(detail,[[x,-.25,0],[x,-.68,0]],colors.ink);
    kit.box([.30,.16,.12],[x,-.76,0],'ink',detail);
  }
  const massLead=line(detail,[[0,-.175,0],[0,-.50,0],[0,-.70,0],[0,-.82,0]],colors.ink);
  kit.box([.44,.18,.12],[0,-.91,0],'ink',detail);
  label(detail,'Opposed carrier → demodulator → amplifier',0,-1.05,3.9,.17);
  const capReadout=label(detail,'',0,-1.39,3.8,.16),forceArrow=arrow(kit,detail,colors.red,[0,.87,.2],[1,0,0],.5);
  label(detail,'Deflection opposite the positive reading',0,-1.70,3.7,.14);

  const plot=kit.part('response-detail','Input and filtered output','A one-second record of the selected axis. Gold is the demodulated equivalent input; blue is the output after the nominal external RC stage. Self-test adds internal actuation. Both traces are in g-equivalent units.',[0,0,0],system);
  plot.userData.inspectionOnly='response-detail';plot.userData.explosionExcluded=true;
  label(plot,'Electrical filter: input and output',0,1.7,3.8,.2);
  label(plot,'Gold: input     Blue: filtered output',0,1.39,3.8,.15);
  for(const g of [-3,0,3]){line(plot,[[-1.55,g*.31,0],[1.55,g*.31,0]],0xb4c5b0);label(plot,String(g)+' g',-1.80,g*.31,.43,.12);}
  line(plot,[[-1.55,-1,0],[-1.55,1,0]],colors.ink);
  label(plot,'0 s',-1.55,-1.17,.4,.13);label(plot,'1 s',1.55,-1.17,.4,.13);
  const inputTrace=line(plot,Array.from({length:201},()=>[-1.55,0,.04]),0xa67628),outputTrace=line(plot,Array.from({length:201},()=>[-1.55,0,.05]),0x357386);
  const inputDot=kit.sphere(.043,[-1.55,0,.06],'gold',plot),outputDot=kit.sphere(.032,[-1.55,0,.10],'blue',plot);
  const cursor=line(plot,[[0,-1,0],[0,1,0]],colors.ink),plotStatus=label(plot,'',0,-1.48,3.8,.17),plotCaption=label(plot,'',0,-1.76,3.8,.14);
  return {system,module,board,frame,mounts,mass,electrodes,rear,front,plateSupports,springs,flexures,center,electronics,sensingLeads,filters,outputs,supply,indicator,guides,axes,detail,middle,massLead,fixedNegative,fixedPositive,gapLabels,driveLabels,capReadout,forceArrow,plot,inputTrace,outputTrace,inputDot,outputDot,cursor,plotStatus,plotCaption};
}

export function updateAccelerometerGeometry(p,state){
  const {values:v}=state,pose=v.experiment===0||v.experiment===3;
  p.module.rotation.set(pose?-v.pitch*Math.PI/180:0,0,pose?v.roll*Math.PI/180:0,'XYZ');
  const d=state.displacement;p.mass.position.set(p.center[0]+d.x,p.center[1]+d.y,p.center[2]+d.z);
  for(const {x,y,line:l}of p.flexures)setPoints(l,[[x*.87,y*.87,.04],[x*.67+d.x*.3,y*.87,.04+d.z*.3],[x*.67+d.x*.7,y*.67+d.y*.7,.04+d.z*.7],[x*.4+d.x,y*.4+d.y,.04+d.z]]);
  p.outputs.forEach((text,i)=>{const key='xyz'[i];text.userData.setText(v.power?`${key.toUpperCase()} ${state.voltage[key].toFixed(3)} V`:`${key.toUpperCase()} off`);});
  p.indicator.material.color.set(v.power?0x91aa7e:0x374736);
  const cap=state.capacitance;p.middle.position.x=cap.displacement*.805;
  setPoints(p.massLead,[[p.middle.position.x,-.175,0],[p.middle.position.x,-.50,0],[0,-.70,0],[0,-.82,0]]);
  p.gapLabels[0].userData.setText(`C− ${cap.negative.toFixed(3)} C₀`);p.gapLabels[1].userData.setText(`C+ ${cap.positive.toFixed(3)} C₀`);
  p.driveLabels[0].userData.setText(v.power?`Drive ${state.carrier>0?'−':'+'}`:'Drive off');p.driveLabels[1].userData.setText(v.power?`Drive ${state.carrier>0?'+':'−'}`:'Drive off');
  p.fixedNegative.material.color.set(!v.power?colors.ink:state.carrier>0?colors.blue:colors.gold);p.fixedPositive.material.color.set(!v.power?colors.ink:state.carrier>0?colors.gold:colors.blue);
  const input=state.equivalent['xyz'[v.axis]];
  p.forceArrow.userData.setDirection(new THREE.Vector3(Math.sign(input)||1,0,0));p.forceArrow.userData.setLength(Math.abs(input)*.3);p.forceArrow.visible=Math.abs(input)>1e-9;
  p.capReadout.userData.setText(v.power?`${'XYZ'[v.axis]} equivalent input ${input.toFixed(3)} g · output ${state.voltage['xyz'[v.axis]].toFixed(3)} V`:'No excitation or electronic output');
  setPoints(p.inputTrace,state.trace.map(s=>[-1.55+3.1*s.t,s.input*.31,.04]));setPoints(p.outputTrace,state.trace.map(s=>[-1.55+3.1*s.t,s.output*.31,.05]));
  p.inputTrace.visible=p.outputTrace.visible=Boolean(v.power);setPoints(p.cursor,[[-1.55+3.1*state.time,-1,.02],[-1.55+3.1*state.time,1,.02]]);
  p.inputDot.position.set(-1.55+3.1*state.time,input*.31,.06);p.outputDot.position.set(-1.55+3.1*state.time,state.filtered['xyz'[v.axis]]*.31,.10);p.inputDot.visible=p.outputDot.visible=Boolean(v.power);
  p.plotStatus.userData.setText(v.power?`${state.time.toFixed(3)} s · ${state.filter.cutoff.toFixed(2)} Hz cutoff`:'Electronic readout off');
  p.plotCaption.userData.setText(v.experiment===3?'Self-test adds internal actuation, not external acceleration':'One physical second, shown over six scene seconds');
}

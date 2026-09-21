import * as THREE from 'three';
import {houseModel, reading} from './house-model-kit.js';
import {fixed} from './format.js';

const L=.001,W=50e-6,H=5e-6,RHO=2330,E=160e9;
const MP=RHO*1e-6*40e-6,MB=4*RHO*L*W*H,ME=MP+13*MB/35,BASE=MP+MB/2,K=4*E*W*H**3/L**3;
export const crashSensorConstants=Object.freeze({
  beamLength:L,beamWidth:W,beamThickness:H,squareSide:.001,squareThickness:40e-6,
  density:RHO,youngModulus:E,proofMass:MP,beamMass:MB,effectiveMass:ME,baseMass:BASE,stiffness:K,
  naturalFrequency:Math.sqrt(K/ME)/(2*Math.PI),gaugeFactor:100,nominalResistance:1000,padFraction:.05,padAverageFactor:.95,
  excitation:3.3,filterTime:.002,threshold:.001,voltsPerMeter:3.3*100*.95*3*H/L**2,
  duration:.025,displayDuration:12,step:1e-6,traceStep:5e-6,dimensionScale:2000,deflectionFactor:500,
  relativeBound:6.044311944404698e-7,genericRelativeBound:1.226438642e-6,
  defaults:Object.freeze({deceleration:20,pulseDuration:.004,damping:.7,supply:1}),
});
const C=crashSensorConstants,domains={deceleration:[-20,-10,0,10,20],pulseDuration:[.001,.002,.004,.008],damping:[.25,.7,1],supply:[0,1]};
function controls(input={}){
  if(!input||typeof input!=='object'||Array.isArray(input))throw new TypeError('Expected crash sensor controls');
  for(const key of Object.keys(input))if(!Object.hasOwn(domains,key))throw new RangeError('Unknown control '+key);
  const values={...C.defaults,...input};for(const [key,allowed] of Object.entries(domains))if(!allowed.includes(values[key]))throw new RangeError('Invalid '+key);return values;
}
/** Four physical arms only, R1 through R4. No motion or decision inputs. */
export function crashSensorBridge(resistances,supplyVoltage){
  if(!Array.isArray(resistances)||resistances.length!==4||Array.from(resistances).some(r=>!Number.isFinite(r)||r<=0)||!Number.isFinite(supplyVoltage)||supplyVoltage<0)throw new RangeError('Expected four positive resistances and nonnegative excitation');
  const [r1,r2,r3,r4]=resistances,leftCurrent=supplyVoltage/(r1+r2),rightCurrent=supplyVoltage/(r3+r4),leftVoltage=leftCurrent*r2,rightVoltage=rightCurrent*r4;
  return {leftVoltage,rightVoltage,bridgeVoltage:leftVoltage-rightVoltage,leftCurrent,rightCurrent,supplyCurrent:leftCurrent+rightCurrent};
}
function frame(values,t){
  const A=values.deceleration,T=values.pulseDuration,w=2*Math.PI/T;
  if(t>=T)return {frameAcceleration:0,frameVelocityChange:-A*T/2,frameDisplacementChange:-A*T*t/2+A*T*T/4};
  return {frameAcceleration:-A*Math.sin(Math.PI*t/T)**2,frameVelocityChange:-A*t/2+A*Math.sin(w*t)/(2*w),frameDisplacementChange:-A*t*t/4+A*Math.sin(w*t/2)**2/w**2};
}
function derivative(y,t,values){
  const [q,v,z]=y,c=2*values.damping*Math.sqrt(K*ME),force=-BASE*frame(values,t).frameAcceleration;
  // Exact full-active bridge identity, evaluated before subtracting two nearly
  // equal rounded midpoint voltages. It is the resistance law, not input A.
  const voltage=values.supply*C.voltsPerMeter*q;
  return [v,(force-c*v-K*q)/ME,(voltage-z)/C.filterTime,force*v,c*v*v];
}
function rk4(y,t,h,values){
  const a=derivative(y,t,values),b=derivative(y.map((v,i)=>v+h*a[i]/2),t+h/2,values),c=derivative(y.map((v,i)=>v+h*b[i]/2),t+h/2,values),d=derivative(y.map((v,i)=>v+h*c[i]),t+h,values);
  return y.map((v,i)=>v+h*(a[i]+2*b[i]+2*c[i]+d[i])/6);
}
function crossing(y,t,h,values){
  let lo=0,hi=h;for(let j=0;j<36;j++){const mid=(lo+hi)/2;if(rk4(y,t,mid,values)[2]>=C.threshold)hi=mid;else lo=mid;}return t+hi;
}
let currentTrial;
function stateAt(values,time){
  const key=Object.keys(domains).map(k=>values[k]).join(',');
  if(currentTrial?.key!==key)currentTrial={key,states:new Float64Array((Math.round(C.duration/C.step)+1)*5),filled:0,firstCrossing:null};
  const trial=currentTrial,index=Math.min(Math.floor(time/C.step+1e-9),Math.round(C.duration/C.step));
  while(trial.filled<index){
    const j=trial.filled,t=j*C.step,y=Array.from(trial.states.subarray(j*5,j*5+5)),next=rk4(y,t,C.step,values);
    if(values.supply&&trial.firstCrossing===null&&y[2]<C.threshold&&next[2]>=C.threshold)trial.firstCrossing=crossing(y,t,C.step,values);
    trial.states.set(next,(j+1)*5);trial.filled++;
  }
  const base=Array.from(trial.states.subarray(index*5,index*5+5)),fraction=time-index*C.step,y=fraction>1e-15?rk4(base,index*C.step,fraction,values):base;
  let first=trial.firstCrossing!==null&&trial.firstCrossing<=time?trial.firstCrossing:null;
  if(first===null&&values.supply&&fraction>1e-15&&base[2]<C.threshold&&y[2]>=C.threshold)first=crossing(base,index*C.step,fraction,values);
  return {y,first};
}
export function sampleCrashSensor(input={},elapsed=0){
  const values=controls(input);if(!Number.isFinite(elapsed)||elapsed<0||elapsed>C.duration)throw new RangeError('Observation time must be in [0,.025] seconds');
  const {y,first}=stateAt(values,elapsed),[q,v,z,work,loss]=y,c=2*values.damping*Math.sqrt(K*ME),s=.95*3*H*q/L**2;
  const padStrains=[-s,s,s,-s],resistances=padStrains.map(e=>1000*(1+100*e)),supplyVoltage=values.supply*C.excitation,bridge=crashSensorBridge(resistances,supplyVoltage),motion=frame(values,elapsed);
  const mechanicalEnergy=.5*ME*v*v+.5*K*q*q;
  return {values,elapsed,...motion,relative:q,relativeVelocity:v,relativeAcceleration:derivative(y,elapsed,values)[1],padStrains,resistances,supplyVoltage,...bridge,
    bridgeVoltage:values.supply*C.voltsPerMeter*q,filterState:z,filteredVoltage:values.supply?z:null,signalAvailable:Boolean(values.supply),comparison:Boolean(values.supply&&z>=C.threshold),latched:first!==null,firstCrossing:first,
    springForce:-K*q,dampingForce:-c*v,baseForce:-BASE*motion.frameAcceleration,mechanicalEnergy,baseWork:work,dampingLoss:loss,energyError:mechanicalEnergy+loss-work,
    stage:elapsed===0?'Initial state':elapsed<values.pulseDuration?'Prescribed pulse':'Free mechanical response and filter recovery'};
}
const format=(v,n=3)=>fixed(v,n);

export function createCrashSensorModel({mechanicsLesson=false}={}){
  const kit=houseModel('Crash sensor'),{root,part,box,control,finish}=kit;
  const ink=0x374736,muted=0x929b91,blue=0x195b91,orange=0x9b4514,green=0x47785b,red=0xa84337;
  const textures=new Set(),labels=[],wires=[],histories=[];
  function label(text,x,y,parent,width=1.6,height=.23,z=.17){
    let canvas,context,metrics=null;
    const pixelWidth=Math.min(4096,Math.ceil(128*width/height)),pixelHeight=Math.max(32,Math.round(pixelWidth*height/width));
    if(typeof document!=='undefined')canvas=document.createElement('canvas');
    else if(typeof OffscreenCanvas!=='undefined')canvas=new OffscreenCanvas(pixelWidth,pixelHeight);
    if(canvas){canvas.width=pixelWidth;canvas.height=pixelHeight;context=canvas.getContext('2d');}
    let texture;
    if(context){
      context.clearRect(0,0,pixelWidth,pixelHeight);context.fillStyle='#263a2f';context.textAlign='center';context.textBaseline='alphabetic';
      let font=pixelHeight;context.font=font+'px sans-serif';let measured=context.measureText(text);
      font*=Math.min(pixelWidth*.90/measured.width,pixelHeight*.80/(measured.actualBoundingBoxAscent+measured.actualBoundingBoxDescent));
      context.font=font+'px sans-serif';measured=context.measureText(text);
      const baseline=(pixelHeight+measured.actualBoundingBoxAscent-measured.actualBoundingBoxDescent)/2;
      context.fillText(text,pixelWidth/2,baseline);
      metrics={pixelWidth,pixelHeight,font,textWidth:measured.width,left:pixelWidth/2-measured.actualBoundingBoxLeft,right:pixelWidth/2+measured.actualBoundingBoxRight,top:baseline-measured.actualBoundingBoxAscent,bottom:baseline+measured.actualBoundingBoxDescent};
      texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;
    }else texture=new THREE.DataTexture(new Uint8Array([0,0,0,0]),1,1);
    texture.needsUpdate=true;textures.add(texture);
    const object=new THREE.Mesh(new THREE.PlaneGeometry(width,height),new THREE.MeshBasicMaterial({map:texture,transparent:true,depthWrite:false,depthTest:false,side:THREE.DoubleSide}));
    object.position.set(x,y,z);object.renderOrder=5;object.userData={labelText:text,canvasBacked:Boolean(context),width,height,metrics};parent.add(object);labels.push(object);return object;
  }
  function line(points,color,parent,segments=false){
    const geometry=new THREE.BufferGeometry().setFromPoints(points.map(p=>new THREE.Vector3(...p)));
    const object=segments?new THREE.LineSegments(geometry,new THREE.LineBasicMaterial({color})):new THREE.Line(geometry,new THREE.LineBasicMaterial({color}));parent.add(object);return object;
  }
  function wire(points,parent,net){const object=line(points,ink,parent);object.userData.net=net;wires.push(object);return object;}
  function point(radius,color,parent,open=false){
    if(open)return line(Array.from({length:33},(_,i)=>[radius*Math.cos(i*Math.PI/16),radius*Math.sin(i*Math.PI/16),0]),color,parent);
    const object=new THREE.Mesh(new THREE.SphereGeometry(radius,12,8),new THREE.MeshBasicMaterial({color}));parent.add(object);return object;
  }
  function arrow(parent,color){return line(Array.from({length:6},()=>[0,0,0]),color,parent,true);}
  function setArrow(object,start,end){
    const a=new THREE.Vector3(...start),b=new THREE.Vector3(...end),d=b.clone().sub(a),length=d.length();object.visible=length>1e-10;if(!object.visible)return;
    d.normalize();let side=new THREE.Vector3(0,1,0).cross(d);if(side.lengthSq()<.01)side.set(1,0,0);side.normalize();const back=b.clone().addScaledVector(d,-Math.min(.16,length*.3));
    const pts=[a,b,b,back.clone().addScaledVector(side,.065),b,back.clone().addScaledVector(side,-.065)];pts.forEach((v,i)=>object.geometry.attributes.position.setXYZ(i,v.x,v.y,v.z));object.geometry.attributes.position.needsUpdate=true;object.geometry.computeBoundingSphere();
  }
  const system=part('system','Crash sensor','A declared four-beam sensor, powered bridge and finite filter feed an arbitrary demonstration threshold. This does not predict airbag deployment.');
  const chip=part('chip','Square and four flexures','Co-moving chip. Dimensions are enlarged; normal deflection has a separate 500× enlargement. Computed strain uses the physical displacement.',[-4,5,0],system);
  const framePart=part('frame','Chip frame and mounting','Four fixed clamps share a supported frame around an open cavity. +Z is a horizontal sensitive axis; gravity loading in the chip plane is omitted.',[0,0,0],chip);
  const board=box([7.1,7.1,.08],[0,0,-1.49],0xffffff,framePart),frameBars=[],posts=[];
  for(const y of [-3.175,3.175])frameBars.push(box([6.7,.35,.08],[0,y,0],'metal',framePart));
  for(const x of [-3.175,3.175])frameBars.push(box([.35,6,.08],[x,0,0],'metal',framePart));
  for(const x of [-3.175,3.175])for(const y of [-3.175,3.175])posts.push(box([.18,.18,1.41],[x,y,-.745],'metal',framePart));
  const squarePart=part('square','Inertial square','The 1 mm square translates normal to the chip. Relative motion is square minus frame; the mass is not rotated or deformed.',[0,0,0],chip);
  const square=box([2,2,.08],[0,0,0],'cream',squarePart);
  const reference=line([[-1,-1,0],[1,-1,0],[1,1,0],[-1,1,0],[-1,-1,0]],muted,chip);
  const flexures=part('flexures','Four bending strips','Four finite 1 mm × 50 µm × 5 µm strips join both clamps. Their cubic shape has zero slope at each end. Top strain changes sign along each strip.',[0,0,0],chip);
  const configurations=[{id:1,d:[0,-1],start:[0,3],interval:[0,.05],name:'R1 frame-end gauge',net:['Vs','L']},{id:2,d:[-1,0],start:[3,0],interval:[.95,1],name:'R2 square-end gauge',net:['L','0']},{id:3,d:[1,0],start:[-3,0],interval:[.95,1],name:'R3 square-end gauge',net:['Vs','R']},{id:4,d:[0,1],start:[0,-3],interval:[0,.05],name:'R4 frame-end gauge',net:['R','0']}];
  const beams=[],gauges=[],packagePads=[];
  function surface(config,u,side,normalOffset,q){
    const [dx,dy]=config.d,bx=-dy,by=dx,Q=C.dimensionScale*C.deflectionFactor*q;
    const slope=Q*(6*u-6*u*u)/2,den=Math.sqrt(1+slope*slope);
    return [config.start[0]+2*u*dx+side*bx-normalOffset*slope*dx/den,config.start[1]+2*u*dy+side*by-normalOffset*slope*dy/den,Q*(3*u*u-2*u*u*u)+normalOffset/den];
  }
  function strip(config,parent){
    const segments=80,positions=new Float32Array((segments+1)*4*3),indices=[];
    for(let j=0;j<segments;j++)for(let face=0;face<4;face++){const a=j*4+face,b=j*4+(face+1)%4,c=b+4,d=a+4;indices.push(a,b,d,b,c,d);}
    indices.push(0,2,1,0,3,2,segments*4,segments*4+1,segments*4+2,segments*4,segments*4+2,segments*4+3);
    const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.BufferAttribute(positions,3).setUsage(THREE.DynamicDrawUsage));geometry.setIndex(indices);
    const object=new THREE.Mesh(geometry,new THREE.MeshStandardMaterial({color:0xb4c5b0,side:THREE.DoubleSide,roughness:.75}));parent.add(object);
    const item={object,geometry,positions,config,segments};beams.push(item);return item;
  }
  for(const config of configurations){
    strip(config,flexures);
    const parent=part('resistor-'+config.id,config.name,'This actual 50 µm pad uses uniform average top strain over u='+config.interval.join(' to ')+'. It is bridge arm R'+config.id+', between '+config.net.join(' and ')+'.',[0,0,0],chip);
    const positions=new Float32Array(5*2*3),indices=[];for(let j=0;j<4;j++){const a=j*2;indices.push(a,a+1,a+2,a+1,a+3,a+2);}
    const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.BufferAttribute(positions,3).setUsage(THREE.DynamicDrawUsage));geometry.setIndex(indices);
    const material=new THREE.MeshBasicMaterial({color:muted,side:THREE.DoubleSide,polygonOffset:true,polygonOffsetFactor:-2,polygonOffsetUnits:-2}),object=new THREE.Mesh(geometry,material);parent.add(object);
    const leads=[];
    for(let terminal=0;terminal<2;terminal++){
      const path=wire(Array.from({length:90},()=>[0,0,0]),parent,config.net[terminal]);
      const pad=box([.10,.07,.015],[3.25,2.8-(config.id*2-2+terminal)*.8,.0475],'gold',framePart);packagePads.push({object:pad,config,terminal});
      const electrode=line([[0,0,0],[0,0,0]],0xe3b45e,parent);leads.push({object:path,terminal,pad,electrode});
    }
    gauges.push({config,parent,object,geometry,positions,leads});
  }
  const inputArrow=arrow(chip,orange),qArrow=arrow(chip,blue);
  label('1 mm square · four 1 mm strips',0,3.95,chip,6.7,.43);
  label('Deflection only: 500× extra enlargement',0,-3.99,chip,7.1,.40);
  label('Blue: compression · red: tension',0,4.43,chip,6.9,.38);
  label('+forward / +Z',2.05,1.25,chip,2.4,.35);
  const bridgePart=part('bridge','Equivalent circuit','This is the same four gauges shown as a circuit, not four additional resistors. Separate midpoint inputs are measured at high impedance.',[4,5,0],system);
  const circuitBoard=box([6.8,7.1,.10],[0,0,-.12],0xffffff,bridgePart);
  label('Equivalent circuit: the same R1–R4',0,3.18,bridgePart,6.4,.46);
  const resistorSymbols=[];
  for(const [id,x,y] of [[1,-1.1,.75],[2,-1.1,-.75],[3,1.1,.75],[4,1.1,-.75]]){
    const body=box([.43,.54,.08],[x,y,.015],'cream',bridgePart);resistorSymbols.push(body);
    label('R'+id,x+(x<0?-.60:.60),y,bridgePart,.65,.35);
    wire([[x,y-.27,.065],[x,y-.75,.065]],bridgePart,id===2||id===4?'0':id===1?'L':'R');
    wire([[x,y+.27,.065],[x,y+.75,.065]],bridgePart,id===1||id===3?'Vs':id===2?'L':'R');
  }
  wire([[-1.1,1.5,.065],[1.1,1.5,.065]],bridgePart,'Vs');wire([[-1.1,-1.5,.065],[1.1,-1.5,.065]],bridgePart,'0');
  const nodes={Vs:[0,1.5,.065],L:[-1.1,0,.065],R:[1.1,0,.065],'0':[0,-1.5,.065]};
  for(const [net,pos] of Object.entries(nodes)){const dot=point(.06,ink,bridgePart);dot.position.set(...pos);label(net,pos[0]+(net==='L'?-.55:.38),pos[1]+.16,bridgePart,.6,.30);}
  const supplyPart=part('supply','Bridge supply and switch','A fixed 3.3 V source feeds the bridge when the switch closes. Off disconnects this source; the grounded resistive network has zero excitation.',[0,0,0],bridgePart);
  const sourceBox=box([1.4,.60,.15],[0,2.48,.04],'cream',supplyPart);label('3.3 V',0,2.48,supplyPart,1.18,.35,.13);
  wire([[0,2.18,.10],[0,1.95,.10]],supplyPart,'Vs-source');wire([[-.7,2.48,.1],[-2.35,2.48,.1],[-2.35,-1.5,.1],[0,-1.5,.065]],supplyPart,'0');
  const switchBlade=line([[0,1.95,.1],[0,1.5,.1]],ink,supplyPart);
  const terminalDots=[];for(const y of [1.5,1.95]){const dot=point(.055,ink,supplyPart);dot.position.set(0,y,.1);terminalDots.push(dot);}
  const conditioner=part('conditioner','Differential input and 2 ms filter','Left minus right midpoint drives a unity-gain first-order filter. Its finite response comes from the actual signed bridge signal.',[0,-2.2,0],bridgePart);
  const filterBox=box([2.9,.70,.14],[0,0,.015],'cream',conditioner);label('L − R → 2 ms filter',0,0,conditioner,2.7,.37,.12);
  wire([[-1.1,0,.065],[-1.8,0,.12],[-1.8,-2.2,.12],[-1.45,-2.2,.12]],bridgePart,'L');
  wire([[1.1,0,.065],[1.8,0,.12],[1.8,-2.2,.12],[1.45,-2.2,.12]],bridgePart,'R');
  const decision=part('decision','Demonstration comparison and event memory','Current comparison follows the conditioned signal. The separate event lamp remembers an earlier +1 mV crossing until reset. This arbitrary rule is not an airbag algorithm.',[0,-3.2,0],bridgePart);
  const decisionBox=box([5.9,.66,.14],[0,0,.015],'cream',decision);
  const mounts=[];
  for(const [body,width,depth] of [...resistorSymbols.map(body=>[body,.43,.08]),[sourceBox,1.4,.15],[filterBox,2.9,.14],[decisionBox,5.9,.14]]){
    const back=body.position.z-depth/2,height=back+.07;
    for(const side of [-1,1]){const object=box([.07,.10,height],[body.position.x+side*width*.25,body.position.y,-.07+height/2],'metal',body.parent);mounts.push({object,body,height,back});}
  }
  const circuitPins=[];
  for(let i=0;i<resistorSymbols.length;i++){const body=resistorSymbols[i];for(const side of [-1,1])circuitPins.push(kit.rod([body.position.x,body.position.y+side*.24,.045],[body.position.x,body.position.y+side*.27,.065],.008,'gold',bridgePart));}
  for(const side of [-1,1])circuitPins.push(kit.rod([side*1.42,-2.2,.06],[side*1.45,-2.2,.12],.008,'gold',bridgePart));
  circuitPins.push(kit.rod([0,-2.52,.06],[0,-2.55,.10],.008,'gold',bridgePart),kit.rod([0,-2.9,.06],[0,-2.87,.10],.008,'gold',bridgePart));
  wire([[0,-2.55,.1],[0,-2.87,.1]],bridgePart,'conditioned information');
  const currentLamp=point(.12,green,decision),eventLamp=point(.12,orange,decision);currentLamp.position.set(-2.45,0,.15);eventLamp.position.set(.55,0,.15);
  label('Now ≥1 mV',-1.28,0,decision,2.1,.35,.14);label('Earlier event',1.92,0,decision,2.15,.35,.14);
  // Package-to-circuit conductors terminate at the named four nodes. The
  // circuit symbols represent the already connected implanted gauges.
  const connections=[];
  for(const pad of packagePads){
    const a=pad.object.position.clone().add(chip.position),net=pad.config.net[pad.terminal],n=nodes[net],end=[bridgePart.position.x+n[0],bridgePart.position.y+n[1],n[2]];
    const laneZ=.25+(pad.config.id*2+pad.terminal)*.035,edgeX=.25+(pad.config.id*2+pad.terminal)*.025;
    const object=wire([[a.x,a.y,a.z],[a.x+.25,a.y,laneZ],[edgeX,a.y,laneZ],[edgeX,end[1],laneZ],[end[0],end[1],laneZ],end],system,net);connections.push({object,pad,net,end});
  }
  let lastQ=NaN;
  function updateChip(q,strains){
    if(q!==lastQ){
      squarePart.position.z=C.dimensionScale*C.deflectionFactor*q;
      for(const beam of beams){for(let j=0;j<=beam.segments;j++)for(let v=0;v<4;v++){const side=[-.05,.05,.05,-.05][v],normal=[-.005,-.005,.005,.005][v];beam.positions.set(surface(beam.config,j/beam.segments,side,normal,q),(j*4+v)*3);}beam.geometry.attributes.position.needsUpdate=true;beam.geometry.computeVertexNormals();beam.geometry.computeBoundingSphere();}
      for(const gauge of gauges){const [lo,hi]=gauge.config.interval;
        for(let j=0;j<=4;j++)for(let side=0;side<2;side++)gauge.positions.set(surface(gauge.config,lo+(hi-lo)*j/4,side?.03:-.03,.005,q),(j*2+side)*3);
        gauge.geometry.attributes.position.needsUpdate=true;gauge.geometry.computeVertexNormals();gauge.geometry.computeBoundingSphere();
        for(const lead of gauge.leads){const u=lead.terminal?hi:lo,side=lead.terminal?.043:-.043;for(let j=0;j<2;j++)lead.electrode.geometry.attributes.position.setXYZ(j,...surface(gauge.config,u,j?.03:-.03,.005,q));lead.electrode.geometry.attributes.position.needsUpdate=true;lead.electrode.geometry.computeBoundingSphere();const points=[surface(gauge.config,u,0,.005,q),surface(gauge.config,u,side,.005,q)];
          for(let j=Math.round(u*80);j>=0;j--)points.push(surface(gauge.config,j/80,side,.005,q));
          const start=points.at(-1),lane=.055+(gauge.config.id*2+lead.terminal)*.015;
          points.push([start[0],start[1],lane]);
          const route=gauge.config.id===1?[[start[0],3.175],[3.175,3.175]]:gauge.config.id===2?[[3.175,start[1]]]:gauge.config.id===3?[[-3.175,start[1]],[-3.175,-3.175],[3.175,-3.175]]:[[start[0],-3.175],[3.175,-3.175]];
          for(const [x,y] of route)points.push([x,y,lane]);points.push([3.175,lead.pad.position.y,lane],lead.pad.position.toArray());while(points.length<90)points.push(points.at(-1));
          points.forEach((p,i)=>lead.object.geometry.attributes.position.setXYZ(i,...p));lead.object.geometry.attributes.position.needsUpdate=true;lead.object.geometry.computeBoundingSphere();
        }
      }
      lastQ=q;
    }
    gauges.forEach((g,i)=>{const e=strains[i],color=e>1e-14?red:e< -1e-14?blue:muted;g.object.material.color.setHex(color);});
    setArrow(qArrow,[1.4,0,0],[1.4,0,C.dimensionScale*C.deflectionFactor*q]);
  }
  const records=part('records','Actual motion and signal records','Fixed scales show only the observed past. Frame quantities are changes relative to initial uniform motion, not a reconstructed car trajectory.',[0,0,0],system);
  let recordDuration=C.duration;
  function history(parent,color,key,transform,dashed=false){
    const capacity=Math.round(C.duration/C.traceStep)+2,positions=new Float32Array(capacity*3),times=new Float64Array(capacity),exact=new Float64Array(capacity*3),distances=new Float64Array(capacity);
    const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.BufferAttribute(positions,3).setUsage(THREE.DynamicDrawUsage));geometry.setDrawRange(0,0);
    if(dashed)geometry.setAttribute('lineDistance',new THREE.BufferAttribute(new Float32Array(capacity),1).setUsage(THREE.DynamicDrawUsage));
    const object=new THREE.Line(geometry,dashed?new THREE.LineDashedMaterial({color,dashSize:.12,gapSize:.08,depthTest:false}):new THREE.LineBasicMaterial({color}));object.frustumCulled=false;object.renderOrder=dashed?3:2;parent.add(object);
    const marker=point(dashed?.085:.045,color,parent,dashed);marker.renderOrder=4;
    const item={object,geometry,positions,times,exact,distances,capacity,key,transform,dashed,marker};histories.push(item);return item;
  }
  function plot(id,name,x,y,max,unit,key,multiplier,second=null){
    const parent=part(id,id==='signal-record'?'Bridge and conditioned signal':name,'Only elapsed values on a fixed '+unit+' scale.',[x,y,0],records),left=-2.18,width=4.9,half=1.02,grid=[],tickLabels=[];
    box([6.8,3.9,.055],[0,0,-.04],'cream',parent);
    for(const t of [0,5,10,15,20,25]){const X=left+width*t/25;grid.push([X,-half,.015],[X,half,.015]);const full=label(String(t),X,-1.29,parent,.76,.43),early=label(String(t/5),X,-1.29,parent,.76,.43);early.visible=false;tickLabels.push({full,early});}
    for(const value of [-max,0,max]){const Y=value/max*half;grid.push([left,Y,.015],[left+width,Y,.015]);label(String(value),left-.62,Y,parent,1.0,.44);}
    line(grid,muted,parent,true);label(name.replace(' record','')+' ('+unit+')',.1,1.57,parent,6.2,.50);const timeLabel=label('Time (ms)',.1,-1.77,parent,2.7,.37),earlyLabel=label('Early view: 0–5 ms',.1,-1.77,parent,4.8,.37);earlyLabel.visible=false;
    const transform=field=>s=>[left+width*s.elapsed/recordDuration,half*s[field]*multiplier/max,.08];
    const first=history(parent,blue,key,transform(key)),other=second?history(parent,orange,second,transform(second),true):null;
    const legends=[];
    if(second){legends.push(label('Solid: bridge',-1.6,-2.27,parent,2.95,.40),label('Dashed: filtered',1.6,-2.27,parent,3.15,.40));}
    return {parent,max,left,width,half,first,other,legends,tickLabels,timeLabel,earlyLabel};
  }
  const accelerationRecord=plot('acceleration-record','Frame acceleration record',-4,-1.05,25,'m/s²','frameAcceleration',1);
  const displacementRecord=plot('displacement-record','Square displacement record',4,-1.05,.75,'µm','relative',1e6);
  const signalRecord=plot('signal-record','Signal record',-4,-5.55,3,'mV','bridgeVoltage',1e3,'filterState');
  const frameRecord=plot('frame-record','Frame displacement change record',4,-5.55,2,'mm','frameDisplacementChange',1e3);
  label('Relative to initial uniform motion',0,-2.27,frameRecord.parent,6.3,.39);
  const thresholdLine=line([[signalRecord.left,signalRecord.half/3,.06],[signalRecord.left+signalRecord.width,signalRecord.half/3,.06]],ink,signalRecord.parent);
  label('+1 mV',1.72,.57,signalRecord.parent,1.9,.35);
  const unavailable=label('Supply off: measurement unavailable',0,0,signalRecord.parent,5.5,.49,.18);
  let elapsed=0,started=false,complete=false,lastClock=0,historyKey='',gridCount=0,previousTime=-1;
  function writeVertex(item,index,s){
    const p=item.transform(s);item.times[index]=s.elapsed;item.positions.set(p,index*3);item.exact.set(p,index*3);
    if(item.dashed){item.distances[index]=index?item.distances[index-1]+Math.hypot(...p.map((v,j)=>v-item.exact[(index-1)*3+j])):0;item.geometry.attributes.lineDistance.array[index]=item.distances[index];}
  }
  function updateHistories(s){
    const key=Object.keys(domains).map(k=>s.values[k]).join(',')+','+recordDuration;if(key!==historyKey||s.elapsed<previousTime){historyKey=key;gridCount=0;}
    const windowTime=Math.min(s.elapsed,recordDuration),last=Math.floor(windowTime/C.traceStep+1e-9);
    for(let i=gridCount;i<=last;i++){const state=sampleCrashSensor(s.values,Math.min(C.duration,i*C.traceStep));for(const h of histories)writeVertex(h,i,state);}
    gridCount=last+1;const fraction=windowTime-last*C.traceStep>1e-15,count=last+1+(fraction?1:0),endpoint=windowTime===s.elapsed?s:sampleCrashSensor(s.values,windowTime);
    for(const h of histories){if(fraction)writeVertex(h,last+1,endpoint);h.geometry.setDrawRange(0,windowTime>0?count:0);h.geometry.attributes.position.needsUpdate=true;if(h.dashed)h.geometry.attributes.lineDistance.needsUpdate=true;h.marker.position.set(...h.transform(endpoint));h.marker.visible=s.elapsed<=recordDuration;}
    for(const h of [signalRecord.first,signalRecord.other]){h.object.visible=s.signalAvailable;h.marker.visible=s.signalAvailable&&s.elapsed<=recordDuration;}
    for(const plot of [accelerationRecord,displacementRecord,signalRecord,frameRecord]){for(const pair of plot.tickLabels){pair.full.visible=recordDuration===C.duration;pair.early.visible=recordDuration!==C.duration;}plot.timeLabel.visible=recordDuration===C.duration;plot.earlyLabel.visible=recordDuration!==C.duration;}
    signalRecord.legends.forEach(o=>{o.visible=s.signalAvailable;});unavailable.visible=!s.signalAvailable;previousTime=s.elapsed;
  }
  control('deceleration','Signed deceleration pulse',-20,20,10,20,'m/s²','Positive means acceleration opposite +forward. This is a prescribed pulse, not a vehicle impact or stopping model.');
  control('pulseDuration','Pulse duration',.001,.008,.001,.004,'','Equal peak pulses can give different filtered results. Every selection starts a fresh trial.',[1,2,4,8].map(ms=>({value:ms/1000,label:ms+' ms'})));
  control('damping','Damping ratio',.25,1,.05,.7,'','Linear modal loss changes the mechanical response. No fabricated extra dashpot is implied.',[.25,.7,1].map(value=>({value,label:String(value)})));
  control('supply','Bridge supply',0,1,1,1,'','Off opens the fixed 3.3 V source route; mechanics continue, but conditioned measurement is unavailable.',[{value:0,label:'Off'},{value:1,label:'On'}]);
  const result=finish(values=>{
    const s=sampleCrashSensor(values,elapsed);updateChip(s.relative,s.padStrains);updateHistories(s);
    // The arrow's direction is the actual +Z acceleration, not the signed
    // deceleration-control convention.
    setArrow(inputArrow,[2.05,1.65,0],[2.05,1.65,s.frameAcceleration/20*.95]);
    switchBlade.geometry.attributes.position.setXYZ(1,values.supply?0:.35,values.supply?1.5:1.70,.1);switchBlade.geometry.attributes.position.needsUpdate=true;switchBlade.geometry.computeBoundingSphere();
    currentLamp.material.color.setHex(s.comparison?0x288542:0x7d8178);eventLamp.material.color.setHex(s.latched?0xc17419:0x7d8178);
    const state={...s,started,complete,progress:elapsed/C.duration};
    const f=(name,value,unit,hint,n=3)=>reading(name,format(value,n)+' '+unit,hint);
    const availability='Unavailable (supply off)',comparison=s.signalAvailable?(s.comparison?'Above threshold':'Below threshold'):availability,event=s.signalAvailable?(s.latched?'Recorded':'Not recorded'):availability;
    const readings=[reading('Your result',!s.signalAvailable?'Mechanical response continues; no powered measurement or decision':s.comparison?'Conditioned signal is above the demonstration threshold; event recorded':s.latched?'Signal is now below threshold; the earlier event remains recorded':'No positive threshold event has occurred in the observed past','The current comparison and retained event answer different questions. Neither predicts deployment in a real vehicle.'),
      f('Frame acceleration',s.frameAcceleration,'m/s²','Acceleration along +forward. A positive deceleration setting produces a negative pulse here.'),
      f('Frame velocity change',s.frameVelocityChange,'m/s','Change from the initial uniform motion, not total vehicle speed. It remains after the pulse ends.'),
      f('Frame displacement change',s.frameDisplacementChange*1e3,'mm','Position relative to continuation of the initial uniform motion. This is not a vehicle stopping distance.'),
      f('Square relative displacement',s.relative*1e6,'µm','Square minus frame along the sensitive axis. Actual micrometers; the drawing enlarges this deflection another 500 times.'),
      f('Square relative velocity',s.relativeVelocity*1e3,'mm/s','Rate of square motion relative to its frame. Its sign can reverse during recovery.'),
      f('R1 / R4 mean strain',s.padStrains[0]*1e6,'µε','Average over each 50 µm frame-end sensing pad. Negative means compression, positive means tension.'),
      f('R2 / R3 mean strain',s.padStrains[1]*1e6,'µε','Average over each square-end sensing pad. Bending gives the opposite strain to the frame-end pads.'),
      ...s.resistances.map((r,i)=>f('R'+(i+1)+' resistance',r,'Ω','The same physical pad shown in the circuit: 1,000 Ω × (1 + 100 × mean strain). Resistance changes even without electrical supply.')),
      f('Bridge supply voltage',s.supplyVoltage,'V','Excitation across both bridge branches. Off disconnects the selected 3.3 V source.',2),
      f('Left midpoint voltage',s.leftVoltage,'V','R2 divider voltage relative to the lower node. Four decimals retain its small change around 1.65 V.',4),
      f('Right midpoint voltage',s.rightVoltage,'V','R4 divider voltage relative to the lower node. The differential uses unrounded midpoint values.',4),
      f('Bridge differential voltage',s.bridgeVoltage*1e3,'mV','Left minus right. The four active sensing pads reinforce the signed output; balanced powered zero differs from supply off.'),
      s.signalAvailable?f('Conditioned voltage',s.filteredVoltage*1e3,'mV','Output of the two-millisecond filter driven by the bridge voltage. Its lag depends on the whole past signal.'):reading('Conditioned voltage',availability,'Without excitation there is no powered measurement, even though the square can still move.'),
      f('Supply current',s.supplyCurrent*1e3,'mA','Sum of both branch currents. A balanced powered bridge still draws current; heating is not modeled.'),
      f('Demonstration threshold',C.threshold*1e3,'mV','Arbitrary positive comparison level for this lesson, not a vehicle deployment threshold.'),
      reading('Current comparison',comparison,'Compares the unrounded conditioned voltage with +1 mV now. Rounded readings do not determine the decision.'),
      reading('Retained event',event,'Remembers the first positive crossing even after the signal falls below the level. A fresh trial clears it.'),
      reading('First threshold crossing',!s.signalAvailable?availability:s.firstCrossing===null?'Not yet':format(s.firstCrossing*1e3)+' ms','First crossing in the observed past, located within an integration step. No future samples determine this reading.'),
      f('Natural frequency',C.naturalFrequency,'Hz','Undamped frequency from stiffness and effective modal mass. Damping and the electrical filter have separate roles.',1),
      f('Restoring force',s.springForce*1e6,'µN','−kq: the strips oppose displacement relative to the frame.'),
      f('Damping force',s.dampingForce*1e6,'µN','−cq′: modal loss opposes relative velocity. No separate visible dashpot is implied.'),
      f('Base forcing',s.baseForce*1e6,'µN','−mb × frame acceleration: equivalent forcing in the relative-motion equation, including distributed strip mass.'),
      f('Relative mechanical energy',s.mechanicalEnergy*1e12,'pJ','Relative kinetic energy plus bending energy. A rounded zero can retain a smaller finite numerical residual.'),
      f('Base forcing work',s.baseWork*1e12,'pJ','Integral of base forcing times relative velocity since the trial began. This is signed work, not total crash energy.'),
      f('Damping loss',s.dampingLoss*1e12,'pJ','Accumulated integral of c(q′)². Nonnegative energy removed from the modeled relative motion.'),
      f('Energy balance error',s.energyError*1e12,'pJ','Mechanical energy plus damping loss minus base work. Zero to displayed precision does not mean exact numerical equality.'),
      f('Observation time',elapsed*1e3,'ms','Physical time since the pulse began. Twelve display seconds cover twenty-five milliseconds.'),
      f('Recording duration',25,'ms','Length of the complete teaching record, chosen to show pulse and recovery. The early signal inspection magnifies the first five milliseconds.'),
      f('Observation progress',state.progress*100,'%','Fraction of the complete record observed. Completion pauses the state without forcing residuals to zero.',1),
      reading('Drawing scales','1 mm square; 500× extra deflection enlargement; charts use actual units','Frame position and velocity are changes relative to initial uniform motion. Gauge strain uses physical displacement, not magnified curvature.'),
      reading('Model limit','Linear four-beam equivalent; finite average pads; ideal bridge and filter; arbitrary decision','Readings are rounded for display, without clamping the physical state or changing the comparison. One mechanical coordinate; no vehicle deployment or fabrication calibration.')];
    if(mechanicsLesson){
      readings[0]=reading('Your result',values.deceleration===0?'No imposed acceleration: square stays centered and unstrained':elapsed===0?'Square centered and unstrained; ready for the prescribed pulse':elapsed<values.pulseDuration?'Base forcing, restoring force and damping determine relative acceleration':'Pulse ended; restoring force and damping govern the remaining recovery','Displacement, velocity and acceleration can have different signs. Rounded zero can retain a smaller finite response.');
      readings.push(f('Relative force sum',(s.baseForce+s.springForce+s.dampingForce)*1e6,'µN','Unrounded base, restoring and damping forces added together. This generalized force equals effective modal mass times relative acceleration.'),
        f('Relative acceleration',s.relativeAcceleration,'m/s²','Square acceleration minus frame acceleration. A negative value slows positive relative velocity; it does not require negative displacement.'));
      const first=['Your result','Observation time','Square relative displacement','Square relative velocity','Relative acceleration','Relative force sum','Base forcing','Restoring force','Damping force','Relative mechanical energy','Base forcing work','Damping loss','Energy balance error','R1 / R4 mean strain','R2 / R3 mean strain','Natural frequency','Frame acceleration','Frame velocity change','Frame displacement change'];
      return {state,readings:[...first.map(label=>readings.find(r=>r.label===label)),...readings.filter(r=>!first.includes(r.label))]};
    }
    return {state,readings};
  });
  const render=result.update;
  function restart(defaults=false,clock=false){recordDuration=C.duration;elapsed=0;started=complete=false;gridCount=0;previousTime=-1;if(clock)lastClock=0;return render(defaults?result.defaults:{});}
  result.update=next=>{const before=result.getState().values;render(next);return Object.keys(before).some(k=>before[k]!==result.getState().values[k])?restart():render();};
  function advance(seconds){if(!Number.isFinite(seconds)||seconds<=0||complete)return render();started=true;elapsed=Math.min(C.duration,elapsed+seconds*C.duration/C.displayDuration);if(elapsed>C.duration-1e-14)elapsed=C.duration;complete=elapsed===C.duration;return render();}
  result.advance=advance;result.animate=clock=>{if(!Number.isFinite(clock))return render();const dt=Math.max(0,clock-lastClock);lastClock=clock;return advance(dt);};result.reset=()=>restart(true,true);
  const stages=[['Inspect start (0 ms)',()=>0],['Inspect pulse midpoint (T/2)',T=>T/2],['Inspect late pulse (3T/4)',T=>3*T/4],['Inspect pulse end (T)',T=>T],['Inspect early recovery (T + 1 ms)',T=>T+.001],['Inspect later recovery (T + 4 ms)',T=>T+.004],['Inspect final record (25 ms)',()=>C.duration]];
  result.actions=[{label:'Restart experiment',replay:false,run:()=>restart()},...stages.map(([label,time])=>({label,replay:false,run:()=>{const t=time(result.getState().values.pulseDuration),window=recordDuration;restart();if(mechanicsLesson)recordDuration=window;return t?advance(t*C.displayDuration/C.duration):render();}})),...[
    ['Inspect the chip','chip','iso'],['Inspect flexure bending','flexures','iso'],['Inspect the equivalent bridge','bridge','front'],['Inspect the signal record','signal-record','front'],['Inspect the motion records','records','front']
  ].map(([label,id,view])=>({label,part:id,isolate:true,view,replay:false,run:()=>{if(id==='signal-record')recordDuration=C.duration;return render();}})),{label:'Inspect early signal (0–5 ms)',part:'signal-record',isolate:true,view:'front',replay:false,run:()=>{recordDuration=.005;return render();}}];
  if(mechanicsLesson)result.actions.push(...[.005,.025].map(duration=>({label:`Inspect displacement record (0–${duration*1000} ms)`,part:'displacement-record',isolate:true,view:'front',replay:false,run:()=>{recordDuration=duration;return render();}})));
  result.playback={label:'Observe the sensor response',stepLabel:'Advance one percent of the observation',description:'Twelve display seconds show twenty-five physical milliseconds.',advance,step:()=>advance(.12),complete:()=>complete,blocked:()=>false};
  result.resultPart={id:'system',context:'system',view:'front',focusOnComplete:false,label:'Inspect the sensor and retained records',available:()=>started};
  if(mechanicsLesson)result.resultPart={id:'displacement-record',context:'displacement-record',view:'front',focusOnComplete:false,label:'Inspect the square displacement record',available:()=>started};
  result.initialPart='chip';result.initialView='iso';result.initialIsolated=true;result.selectionOutline=false;result.framePadding=.65;
  result.framingBounds=new THREE.Box3(new THREE.Vector3(-8.6,-8.3,-2),new THREE.Vector3(8.6,9.8,2));
  result.topology={get recordDuration(){return recordDuration;},system,chip,framePart,board,frameBars,posts,squarePart,square,reference,flexures,beams,gauges,packagePads,connections,surface,setDisplacementForCheck(q){if(!Number.isFinite(q)||Math.abs(q)>C.genericRelativeBound)throw new RangeError('Diagnostic displacement outside envelope');const e=.95*3*H*q/L**2;updateChip(q,[-e,e,e,-e]);lastQ=NaN;},bridgePart,circuitBoard,resistorSymbols,nodes,supplyPart,sourceBox,switchBlade,terminalDots,conditioner,filterBox,decision,decisionBox,mounts,circuitPins,currentLamp,eventLamp,inputArrow,qArrow,records,accelerationRecord,displacementRecord,signalRecord,frameRecord,thresholdLine,unavailable,histories,labels,textures,wires};
  const getState=result.getState;result.getState=()=>{const s=getState();return {...s,values:{...s.values},padStrains:[...s.padStrains],resistances:[...s.resistances],readings:s.readings.map(r=>({...r}))};};
  const dispose=result.dispose;let disposed=false;result.dispose=()=>{if(disposed)return;disposed=true;dispose();textures.forEach(t=>t.dispose());};
  return result;
}

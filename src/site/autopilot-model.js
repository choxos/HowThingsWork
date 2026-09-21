import * as THREE from 'three';
import {houseModel, reading} from './house-model-kit.js';
import {fixed} from './format.js';

const RAD=Math.PI/180, DEG=180/Math.PI;
export const autopilotConstants=Object.freeze({
  gravity:9.80665, airspeed:50, servoTime:.15, flightPathTime:2,
  angularGain:4, angularDamping:2, rateGain:.8, heightGain:.002,
  duration:30, displayDuration:15, step:.002, traceStep:.02,
  mapScale:.004, headingAxis:12, heightAxis:25, aileronAxis:12, elevatorAxis:3,
  defaults:Object.freeze({headingError:10,heightError:20,crosswind:0,feedback:1}),
});
const C=autopilotConstants;
const domains={headingError:[-10,-5,0,5,10],heightError:[-20,-10,0,10,20],crosswind:[-5,0,5],feedback:[0,1]};
function controls(input={}){
  if(!input||typeof input!=='object'||Array.isArray(input))throw new TypeError('Expected autopilot controls');
  for(const key of Object.keys(input))if(!Object.hasOwn(domains,key))throw new RangeError('Unknown control '+key);
  const values={...C.defaults,...input};
  for(const [key,allowed] of Object.entries(domains))if(!allowed.includes(values[key]))throw new RangeError('Invalid '+key);
  return values;
}
const measurementKeys=['heading','bank','bankRate','height','pitch','pitchRate'];
/** Calibrated measurement input only. Position, wind, time and initial conditions are not controller inputs. */
export function autopilotController(measurements,feedback){
  if(!measurements||measurementKeys.some(k=>!Number.isFinite(measurements[k]))||Object.keys(measurements).some(k=>!measurementKeys.includes(k)))throw new TypeError('Expected the six calibrated measurements');
  if(feedback!==0&&feedback!==1)throw new RangeError('Invalid automatic correction setting');
  const {heading,bank,bankRate,height,pitch,pitchRate}=measurements;
  const bankCommandRad=feedback?-heading:null,pitchCommandRad=feedback?-C.heightGain*height:null;
  return {bankCommandRad,pitchCommandRad,
    aileronCommandRad:feedback?bankCommandRad-bank-C.rateGain*bankRate:0,
    elevatorCommandRad:feedback?pitchCommandRad-pitch-C.rateGain*pitchRate:0};
}
const measured=y=>({heading:y[0],bank:y[1],bankRate:y[2],height:y[4],pitch:y[5],pitchRate:y[6]});
function derivative(y,values){
  const u=autopilotController(measured(y),values.feedback),cg=Math.cos(y[8]);
  return [C.gravity/C.airspeed*Math.tan(y[1]),y[2],C.angularGain*y[3]-C.angularDamping*y[2],(u.aileronCommandRad-y[3])/C.servoTime,
    C.airspeed*Math.sin(y[8]),y[6],C.angularGain*y[7]-C.angularDamping*y[6],(u.elevatorCommandRad-y[7])/C.servoTime,
    (y[5]-y[8])/C.flightPathTime,C.airspeed*cg*Math.sin(y[0])+values.crosswind,C.airspeed*cg*Math.cos(y[0])];
}
function rk4(y,h,values){
  const a=derivative(y,values),b=derivative(y.map((v,i)=>v+h*a[i]/2),values),c=derivative(y.map((v,i)=>v+h*b[i]/2),values),d=derivative(y.map((v,i)=>v+h*c[i]),values);
  return y.map((v,i)=>v+h*(a[i]+2*b[i]+2*c[i]+d[i])/6);
}
let currentTrial;
function stateAt(values,time){
  const key=Object.keys(domains).map(k=>values[k]).join(',');
  if(currentTrial?.key!==key){
    const states=new Float64Array((Math.round(C.duration/C.step)+1)*11);
    states[0]=values.headingError*RAD;states[4]=values.heightError;
    currentTrial={key,states,filled:0};
  }
  const trial=currentTrial,index=Math.min(Math.floor((time+1e-12)/C.step),Math.round(C.duration/C.step));
  while(trial.filled<index){
    const j=trial.filled,y=Array.from(trial.states.subarray(j*11,j*11+11)),next=rk4(y,C.step,values);
    trial.states.set(next,(j+1)*11);trial.filled++;
  }
  const y=Array.from(trial.states.subarray(index*11,index*11+11)),fraction=time-index*C.step;
  return fraction>1e-12?rk4(y,fraction,values):y;
}
export function sampleAutopilot(input={},elapsed=0){
  const values=controls(input);
  if(!Number.isFinite(elapsed)||elapsed<0||elapsed>C.duration)throw new RangeError('Observation time must be in [0,30] seconds');
  const y=stateAt(values,elapsed),measurements=measured(y),u=autopilotController(measurements,values.feedback),d=derivative(y,values);
  return {values,elapsed,headingRad:y[0],bankRad:y[1],bankRateRadPerS:y[2],aileronRad:y[3],heightM:y[4],pitchRad:y[5],pitchRateRadPerS:y[6],elevatorRad:y[7],flightPathRad:y[8],eastM:y[9],northM:y[10],measurements,...u,
    turnRateRadPerS:d[0],verticalSpeedMPerS:d[4],eastSpeedMPerS:d[9],northSpeedMPerS:d[10],groundTrackRad:Math.atan2(d[9],d[10]),angleOfAttackPerturbationRad:y[5]-y[8],aileronPositionErrorRad:u.aileronCommandRad-y[3],elevatorPositionErrorRad:u.elevatorCommandRad-y[7]};
}
const format=(v,n=2)=>v!==0&&Math.abs(v)<.5*10**-n?v.toPrecision(2):fixed(v,n);

export function createAutopilotModel(){
  const kit=houseModel('Autopilot'),{root,part,box,sphere,rod,control,finish}=kit;
  const ink=0x374736,muted=0x929b91,blue=0x195b91,orange=0x9b4514,green=0x47785b;
  const textures=new Set(),labels=[],wires=[],gauges=[];
  function line(points,color,parent,segments=false,dashed=false){
    const geometry=new THREE.BufferGeometry().setFromPoints(points.map(p=>new THREE.Vector3(...p)));
    const material=dashed?new THREE.LineDashedMaterial({color,dashSize:.11,gapSize:.08,depthTest:false}):new THREE.LineBasicMaterial({color});
    const object=segments?new THREE.LineSegments(geometry,material):new THREE.Line(geometry,material);
    parent.add(object);if(dashed)object.computeLineDistances();return object;
  }
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
      texture=new THREE.CanvasTexture(canvas);
    }else texture=new THREE.DataTexture(new Uint8Array([0,0,0,0]),1,1);
    texture.needsUpdate=true;textures.add(texture);
    const object=new THREE.Mesh(new THREE.PlaneGeometry(width,height),new THREE.MeshBasicMaterial({map:texture,transparent:true,depthWrite:false,depthTest:false,side:THREE.DoubleSide}));
    object.position.set(x,y,z);object.renderOrder=5;object.userData={labelText:text,canvasBacked:Boolean(context),width,height,metrics};parent.add(object);labels.push(object);return object;
  }
  function annulus(inner,outer,length,position,parent,color='metal'){
    const shape=new THREE.Shape();shape.absarc(0,0,outer,0,Math.PI*2,false);const hole=new THREE.Path();hole.absarc(0,0,inner,0,Math.PI*2,true);shape.holes.push(hole);
    const geometry=new THREE.ExtrudeGeometry(shape,{depth:length,bevelEnabled:false,curveSegments:16});geometry.translate(0,0,-length/2);geometry.rotateY(Math.PI/2);
    const object=new THREE.Mesh(geometry,new THREE.MeshStandardMaterial({color:color==='metal'?0xaeb9b0:ink,roughness:.7}));object.position.set(...position);parent.add(object);return object;
  }
  function filledPoint(radius,color,parent){const object=new THREE.Mesh(new THREE.SphereGeometry(radius,12,8),new THREE.MeshBasicMaterial({color}));parent.add(object);return object;}
  function outline(radius,parent,color=orange){const pts=Array.from({length:33},(_,i)=>[radius*Math.cos(i*Math.PI/16),radius*Math.sin(i*Math.PI/16),0]);return line(pts,color,parent);}
  function information(points,color,parent){
    const object=line(points,color,parent);const a=new THREE.Vector3(...points.at(-2)),b=new THREE.Vector3(...points.at(-1)),direction=b.clone().sub(a).normalize();
    let side=new THREE.Vector3(-direction.y,direction.x,0);if(side.length()<.1)side.set(1,0,0);side.normalize();
    line([b.clone().addScaledVector(direction,-.13).addScaledVector(side,.055).toArray(),b.toArray(),b.clone().addScaledVector(direction,-.13).addScaledVector(side,-.055).toArray()],color,parent);return object;
  }
  const system=part('system','Autopilot','Two ideal measurement paths command finite surface servos. Actual motion changes the next heading and height measurements. The ground map is not a commanded route.');
  const aircraft=part('aircraft','Aircraft and control surfaces','Enlarged co-moving inspection. Surface angles and attitude changes are actual model states, without angular magnification.',[-4,7.3,0],system);
  const yaw=new THREE.Group(),pitch=new THREE.Group(),bank=new THREE.Group();aircraft.add(yaw);yaw.add(pitch);pitch.add(bank);
  const fuselage=sphere(1,[0,0,0],'cream',bank);fuselage.scale.set(.35,.32,2.25);
  const nose=sphere(.07,[0,0,-2.24],'red',bank);
  const wings=[box([3.10,.12,1.15],[1.85,0,-.125],'leaf',bank),box([3.10,.12,1.15],[-1.85,0,-.125],'leaf',bank)];
  const tail=box([2.9,.09,.57],[0,.42,1.385],'leaf',bank),tailMount=box([.16,.27,.4],[0,.31,1.4],'metal',bank);
  const fin=box([.08,.6,.65],[0,.40,1.175],'leaf',bank);
  const deck=box([.48,.06,1.1],[0,.36,-.05],'wood',bank),deckFeet=[];
  for(const x of [-.16,.16])for(const z of [-.45,.35])deckFeet.push(box([.055,.12,.055],[x,.28,z],'metal',bank));
  const sensors=part('sensors','Calibrated sensors','Ideal attitude/heading channels and a separate pressure-height channel. A gyro does not directly measure height.',[0,0,0],bank);
  const sensorBoxes=[box([.19,.14,.24],[-.12,.46,-.37],'blue',sensors),box([.19,.14,.24],[.12,.46,-.37],'leaf',sensors)];
  const computer=part('computer','Control computer','The heading and height channels compare calibrated measurements to fixed targets. Wind and position are not controller inputs.',[0,0,0],bank);
  const computerBox=box([.4,.16,.3],[0,.47,.24],'gold',computer);
  const wiring=part('signal-wiring','Command and position-feedback wiring','Fixed airframe routes carry schematic information between supported packages and servo encoders. No electrical current or power is calculated.',[0,0,0],bank);
  const terminals=[];
  function terminal(position,parent=wiring){const object=sphere(.022,position,'ink',parent);terminals.push(object);return object;}
  function wire(points,color){const object=line(points,color,wiring);wires.push({object,points:points.map(p=>p.slice())});return object;}
  for(const x of [-.12,.12]){terminal([x,.46,-.25]);terminal([x,.47,.09]);wire([[x,.46,-.25],[x,.50,-.08],[x,.47,.09]],green);}
  const ailerons=part('ailerons','Opposed ailerons','Positive equivalent aileron raises the right trailing edge and lowers the left. Both move by integrated actual angles, not requested angles.',[0,0,0],bank);
  const elevator=part('elevator','Elevator and torque tube','The two elevator halves share one supported torque tube. Positive deflection raises both trailing edges and gives the chosen nose-up response.',[0,0,0],bank);
  const hinges=[],servos=[],supports=[];
  function servo(id,name,origin,parent,shaftStart,shaftEnd){
    const holder=part(id,name,'A fixed case and coaxial output shaft carry the actual angle. The fixed encoder reads the shaft position; its error drives the finite servo response.',origin,parent);
    const casing=annulus(.04,.14,.22,[0,0,0],holder);
    const rotor=new THREE.Group();holder.add(rotor);const shaft=rod([shaftStart,0,0],[shaftEnd,0,0],.022,'metal',rotor);
    const sign=shaftEnd<.1?-1:1;
    const collar=annulus(.022,.065,.035,[sign*.16,0,0],rotor);
    const encoder=annulus(.075,.105,.025,[sign*.22,0,0],holder,'ink');
    const encoderMount=rod([sign*.09,-.13,0],[sign*.22,-.103,0],.009,'metal',holder);
    const marker=rod([sign*.245,0,0],[sign*.245,.06,0],.006,'clay',rotor);
    const fixedMark=line([[sign*.2326,.08,0],[sign*.2326,.105,0]],green,holder);
    const cmd=terminal([origin[0],origin[1]+.14,origin[2]],wiring),feedbackTerminal=terminal([origin[0]+sign*.22,origin[1]+.105,origin[2]],wiring);
    const item={holder,casing,rotor,shaft,collar,encoder,encoderMount,marker,fixedMark,cmd,feedbackTerminal,origin:origin.slice(),shaftStart,shaftEnd,sign};servos.push(item);return item;
  }
  for(const side of [1,-1]){
    const group=new THREE.Group();group.position.set(side*1.5,0,.65);ailerons.add(group);
    const surface=box([1.7,.06,.66],[side*.85,0,.36],'clay',group);
    // The left group is mirrored in span only; its rotation remains about local +X.
    const h={side,group,surface,origin:[side*1.5,0,.65],trailing:[[0,0,.69],[side*1.7,0,.69]]};hinges.push(h);
    const srv=servo(side===1?'right-servo':'left-servo',side===1?'Right aileron servo and encoder':'Left aileron servo and encoder',[side*1.22,0,.65],bank,side===1?-.03:-2.12,side===1?2.12:.03);h.servo=srv;
    // Both endpoint brackets attach the wing to bored bearings, away from the moving surface span.
    for(const x of [side*1.22,side*3.34]){
      supports.push(rod([x,-.03,.40],[x,-.06,.65],.025,'metal',bank));
      supports.push(annulus(.027,.06,.065,[x,0,.65],bank));
    }
    supports.push(rod([side*1.22,-.03,.38],[side*1.22,-.14,.65],.035,'metal',bank));
    for(const x of [side*1.58,side*3.12])box([.08,.05,.09],[x-side*1.5,0,.025],'metal',group);
    terminal([side*.19,.48,.24]);
    const dest=srv.cmd.position.toArray();wire([[side*.19,.48,.24],[side*.45,.13,.24],[side*1.22,.13,.24],dest],blue);
    wire([srv.feedbackTerminal.position.toArray(),[side*1.44,.16,.43],[side*.42,.16,.43],[side*.19,.47,.39]],green);terminal([side*.19,.47,.39]);
  }
  const elevatorGroup=new THREE.Group();elevatorGroup.position.set(0,.42,1.8);elevator.add(elevatorGroup);
  const elevatorSurfaces=[box([1.02,.05,.57],[-.89,0,.315],'clay',elevatorGroup),box([1.02,.05,.57],[.89,0,.315],'clay',elevatorGroup)];
  const elevatorServo=servo('elevator-servo','Elevator servo and encoder',[0,.42,1.8],bank,-1.55,1.55);
  for(const x of [-1.48,1.48]){supports.push(rod([Math.sign(x)*1.40,.42,1.55],[x,.36,1.8],.025,'metal',bank));supports.push(annulus(.027,.06,.065,[x,.42,1.8],bank));}
  supports.push(rod([0,.15,1.8],[0,.28,1.8],.055,'metal',bank));
  for(const x of [-1.3,-.5,.5,1.3])box([.07,.05,.09],[x,0,.025],'metal',elevatorGroup);
  terminal([0,.48,.39]);wire([[0,.48,.39],[.28,.48,.5],[.28,.58,1.5],elevatorServo.cmd.position.toArray()],blue);
  terminal([.15,.48,.39]);wire([elevatorServo.feedbackTerminal.position.toArray(),[.34,.54,1.58],[.34,.52,.52],[.15,.48,.39]],green);
  const airDirection=line(Array.from({length:6},()=>[0,0,0]),green,system,true);airDirection.position.set(-.2,7,0);
  label('Air-motion direction',-.2,8.3,system,2.3);
  const reference=line([[-.2,5.9,0],[.40,5.9,0],[-.2,5.9,0],[-.2,6.5,0],[-.2,5.9,0],[-.2,5.9,-.6]],muted,system,true);label('Trim reference',-.2,5.60,system,1.8,.24);label('Enlarged co-moving aircraft · actual angles',-4,9.15,system,6.2,.27);

  function gauge(parent,x,y,width,max,first,second,title){
    const group=new THREE.Group();group.position.set(x,y,.15);parent.add(group);
    line([[-width/2,0,0],[width/2,0,0]],muted,group);
    line([[-width/2,-.07,0],[-width/2,.07,0],[0,-.11,0],[0,.11,0],[width/2,-.07,0],[width/2,.07,0]],muted,group,true);
    const actual=filledPoint(.048,blue,group),requested=second?outline(.075,group):null;actual.position.z=.02;
    if(requested)requested.position.z=.025;
    const titleLabel=label(title,0,.28,group,width+.22,.34),item={group,width,max,first,second,actual,requested,titleLabel};gauges.push(item);return item;
  }
  function loop(id,name,x,vertical){
    const parent=part(id,name,'Schematic information flow runs downward: sensor, comparison, finite servo and aircraft response. Green returns measurements; orange closes the local encoder loop. Blue dots show the first named value and orange rings the second. Act/req compares actual surface angle with its request.',[x,1.2,0],system);
    label(name,0,3.65,parent,5.4,.44);
    const centers=[2.8,1.3,-.2,-1.7],names=['Sensor','Compare','Servo','Airframe'];
    const blocks=centers.map((y,i)=>{const block=box([4.6,1.05,.08],[0,y,0],'cream',parent);label(names[i],-1.25,y+.10,parent,1.8,.38);return block;});
    for(let i=0;i<3;i++)information([[0,centers[i]-.54,.11],[0,centers[i+1]+.54,.11]],blue,parent);
    information([[-2.31,-1.7,.10],[-2.70,-1.7,.10],[-2.70,2.8,.10],[-2.31,2.8,.10]],green,parent);
    information([[2.31,-.40,.12],[2.60,-.40,.12],[2.60,.10,.12],[2.31,.10,.12]],orange,parent);
    const scales=vertical?[25,3,3,3]:[12,12,12,12];
    const specs=vertical?[
      ['heightM',null,'Height m'],['pitchCommandRad',null,'Pitch req. °'],['elevatorRad','elevatorCommandRad','Act/req °'],['pitchRad','flightPathRad','Pitch/path °']
    ]:[['headingRad',null,'Heading °'],['bankCommandRad',null,'Bank req. °'],['aileronRad','aileronCommandRad','Act/req °'],['bankRad',null,'Bank °']];
    const rowGauges=specs.map(([a,b,title],i)=>gauge(parent,.9,centers[i]-.08,2,scales[i],a,b,title));
    return {parent,blocks,gauges:rowGauges};
  }
  const headingLoop=loop('heading-loop','Heading feedback loop',-6.1,false),heightLoop=loop('height-loop','Height feedback loop',-.05,true);
  const map=part('ground-track','Ground track and original north line','Equal east/north distance scales. Gray is the original north line, not a route command. The nose mark follows heading; the blue retained path follows ground velocity.',[6.1,-.65,0],system);
  const mapScale=C.mapScale,mapOrigin=[0,0];
  const mapGrid=[];for(const E of [-450,0,450])mapGrid.push([E*mapScale,0,0],[E*mapScale,6,0]);for(const N of [0,500,1000,1500])mapGrid.push([-1.8,N*mapScale,0],[1.8,N*mapScale,0]);
  line(mapGrid,muted,map,true);const northLine=line([[0,0,.01],[0,6,.01]],muted,map);
  label('Ground position',0,6.57,map,4.7,.57);label('Equal E/N scale',0,7.18,map,4.7,.55);
  for(const N of [0,500,1000,1500])label(String(N),-2.55,N*mapScale,map,1.30,.55);
  for(const E of [-450,0,450])label(String(E),E*mapScale,-.40,map,1.25,.52);
  label('East m',0,-1.03,map,2.4,.55);label('North',-2.55,5.22,map,1.48,.55);label('m',-2.55,4.67,map,.6,.48);label('Gray: original north line',0,7.77,map,4.8,.46);
  const mapMarker=new THREE.Group();map.add(mapMarker);const mapDot=filledPoint(.045,blue,mapMarker);mapDot.position.z=.07;
  const mapNose=line([[0,0,.1],[0,.17,.1],[-.055,.10,.1],[0,.17,.1],[.055,.10,.1]],ink,mapMarker);
  const trackGauge=gauge(map,0,8.40,3.25,20,'headingRad','groundTrackRad','Heading / track');trackGauge.titleLabel.visible=false;label('Heading',-1.05,8.90,map,2.18,.55);label('Track',1.08,8.90,map,1.8,.55);label('±20°',0,9.43,map,1.7,.51);
  const records=part('records','Retained response records','Only elapsed model states are recorded. Neutral axes are fixed references; blue is actual and orange dashed is requested.',[0,0,0],system);
  const histories=[];
  function history(parent,color,key,transform,dashed=false){
    const capacity=Math.round(C.duration/C.traceStep)+2,positions=new Float32Array(capacity*3),exact=new Float64Array(capacity*3),times=new Float64Array(capacity),distances=new Float64Array(capacity);
    const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.BufferAttribute(positions,3).setUsage(THREE.DynamicDrawUsage));geometry.setDrawRange(0,0);
    if(dashed)geometry.setAttribute('lineDistance',new THREE.BufferAttribute(new Float32Array(capacity),1).setUsage(THREE.DynamicDrawUsage));
    const object=new THREE.Line(geometry,dashed?new THREE.LineDashedMaterial({color,dashSize:.12,gapSize:.09,depthTest:false}):new THREE.LineBasicMaterial({color}));object.frustumCulled=false;object.renderOrder=dashed?3:2;parent.add(object);
    const point=dashed?outline(.075,parent,color):filledPoint(.047,color,parent);point.renderOrder=4;
    const item={object,geometry,positions,exact,times,distances,capacity,key,transform,dashed,point};histories.push(item);return item;
  }
  const mapHistory=history(map,blue,'position',s=>[s.eastM*mapScale,s.northM*mapScale,.04]);
  mapHistory.point.visible=false;
  function plot(id,name,x,y,max,unit,key,command){
    const parent=part(id,name,'Fixed signed '+unit+' scale. Only elapsed values; blue actual'+(command?', orange dashed command. Coincident pointers share the same value.':'.'),[x,y,0],records);
    const width=4.9,half=1.02,left=-2.18,points=[];
    box([6.8,3.9,.055],[0,0,-.04],'cream',parent);
    for(const t of [0,10,20,30]){const X=left+width*t/30;points.push([X,-half,.015],[X,half,.015]);label(String(t),X,-1.29,parent,1.02,.46);}
    for(const value of [-max,0,max]){const Y=value/max*half;points.push([left,Y,.015],[left+width,Y,.015]);label(String(value),left-.62,Y,parent,.92,.46);}
    const shortTitle=id==='aileron-record'?'Aileron':id==='elevator-record'?'Elevator':id==='heading-record'?'Heading error':'Height error';
    line(points,muted,parent,true);label(shortTitle+' ('+unit+')',.10,1.57,parent,6.1,.52);label('Time (s)',.10,-1.77,parent,2.5,.36);
    const transform=field=>s=>[left+width*s.elapsed/30,half*s[field]*(field.endsWith('Rad')?DEG:1)/max,.08];
    const actual=history(parent,blue,key,transform(key)),requested=command?history(parent,orange,command,transform(command),true):null;
    if(command){label('Solid: actual',-1.65,-2.33,parent,3,.44);label('Dashed: command',1.65,-2.33,parent,3.15,.44);}
    return {parent,max,width,half,left,actual,requested};
  }
  const headingRecord=plot('heading-record','Heading error record',-3.85,-4.00,12,'°','headingRad');
  const heightRecord=plot('height-record','Height error record',3.85,-4.00,25,'m','heightM');
  const aileronRecord=plot('aileron-record','Aileron command and actual record',-3.85,-8.35,12,'°','aileronRad','aileronCommandRad');
  const elevatorRecord=plot('elevator-record','Elevator command and actual record',3.85,-8.35,3,'°','elevatorRad','elevatorCommandRad');
  let elapsed=0,started=false,complete=false,lastClock=0,historyKey='',gridCount=0,previousTime=-1;
  function writeVertex(item,index,state){
    const p=item.transform(state);item.times[index]=state.elapsed;item.positions.set(p,index*3);item.exact.set(p,index*3);
    if(item.dashed){item.distances[index]=index?item.distances[index-1]+Math.hypot(...p.map((v,j)=>v-item.exact[(index-1)*3+j])):0;item.geometry.attributes.lineDistance.array[index]=item.distances[index];}
  }
  function updateHistories(s){
    const key=Object.keys(domains).map(k=>s.values[k]).join(',');
    if(key!==historyKey||s.elapsed<previousTime){historyKey=key;gridCount=0;}
    const last=Math.floor((s.elapsed+1e-10)/C.traceStep);
    for(let i=gridCount;i<=last;i++){const state=sampleAutopilot(s.values,Math.min(30,i*C.traceStep));for(const h of histories)writeVertex(h,i,state);}
    gridCount=last+1;
    const fraction=s.elapsed-last*C.traceStep>1e-10,count=last+1+(fraction?1:0);
    for(const h of histories){
      if(fraction)writeVertex(h,last+1,s);
      h.geometry.setDrawRange(0,s.elapsed>0?count:0);h.geometry.attributes.position.needsUpdate=true;
      if(h.dashed)h.geometry.attributes.lineDistance.needsUpdate=true;
      h.point.position.set(...h.transform(s));
    }
    mapHistory.point.visible=false;previousTime=s.elapsed;
  }
  control('headingError','Initial heading departure',-10,10,5,10,'°','Positive is east of north. Each change starts steady flight at the selected departure.');
  control('heightError','Initial height departure',-20,20,10,20,'m','Positive is above the fixed target. Zero is relative trim height, not ground level.');
  control('crosswind','Eastward crosswind',-5,5,5,0,'m/s','Adds ground velocity. Holding north heading does not capture a north ground route.');
  control('feedback','Automatic correction',0,1,1,1,'','Off begins a fresh neutral-surface trial; sensors and flight remain active.',[{value:0,label:'Off'},{value:1,label:'On'}]);
  const result=finish(values=>{
    const s=sampleAutopilot(values,elapsed);yaw.rotation.y=-s.headingRad;pitch.rotation.x=s.pitchRad;bank.rotation.z=-s.bankRad;
    for(const h of hinges){h.group.rotation.x=-h.side*s.aileronRad;h.servo.rotor.rotation.x=-h.side*s.aileronRad;}
    elevatorGroup.rotation.x=-s.elevatorRad;elevatorServo.rotor.rotation.x=-s.elevatorRad;
    mapMarker.position.set(s.eastM*mapScale,s.northM*mapScale,.06);mapMarker.rotation.z=-s.headingRad;
    const direction=[1.5*Math.cos(s.flightPathRad)*Math.sin(s.headingRad),1.5*Math.sin(s.flightPathRad),-1.5*Math.cos(s.flightPathRad)*Math.cos(s.headingRad)];
    const end=new THREE.Vector3(...direction),unit=end.clone().normalize(),side=new THREE.Vector3(Math.cos(s.headingRad),0,Math.sin(s.headingRad)),base=end.clone().addScaledVector(unit,-.18);
    const arrowPoints=[[0,0,0],direction,base.clone().addScaledVector(side,.065).toArray(),direction,direction,base.clone().addScaledVector(side,-.065).toArray()];
    arrowPoints.forEach((p,i)=>airDirection.geometry.attributes.position.setXYZ(i,...p));airDirection.geometry.attributes.position.needsUpdate=true;airDirection.geometry.computeBoundingSphere();
    for(const g of gauges){const first=s[g.first],second=g.second?s[g.second]:null;g.group.visible=first!==null;if(first!==null)g.actual.position.x=first*(g.first.endsWith('Rad')?DEG:1)/g.max*g.width/2;if(g.requested)g.requested.position.x=second*(g.second.endsWith('Rad')?DEG:1)/g.max*g.width/2;}
    updateHistories(s);
    const state={...s,started,complete,progress:elapsed/C.duration,stage:complete?'Thirty-second observation complete; residual motion retained':started?'Observation in progress':'Initial steady-flight departure'};
    const f=(name,value,unit,hint,n=2)=>reading(name,format(value,n)+' '+unit,hint),angle=(name,value,hint)=>value===null?reading(name,'Inactive',hint):f(name,value*DEG,'°',hint);
    const readings=[
      reading('Automatic correction',values.feedback?'On':'Off','Off starts a fresh trial with neutral surfaces. Sensors and forward flight continue.'),
      angle('Heading error',s.headingRad,'Ideal measured nose direction minus the north target. Positive points east of north; this is not a ground-route error.'),
      f('Height error',s.heightM,'m','Ideal pressure-height measurement minus the selected airborne altitude. Positive is above target; zero does not mean ground level.'),
      angle('Commanded bank',s.bankCommandRad,'Outer heading loop requests the opposite of the measured heading error. Inactive when automatic correction is off.'),
      angle('Bank angle',s.bankRad,'Actual integrated roll attitude. Bank changes the rate of heading correction; a command cannot change it instantly.'),
      f('Bank angle rate',s.bankRateRadPerS*DEG,'°/s','Rate of change of bank. Positive can roll an existing negative bank back toward level.'),
      angle('Commanded pitch',s.pitchCommandRad,'Outer height loop requests −0.002 radians per meter of height error. Inactive with correction off.'),
      angle('Pitch relative to trim',s.pitchRad,'Actual nose attitude relative to the assumed level-flight trim attitude, not the climb or descent angle.'),
      f('Pitch angle rate',s.pitchRateRadPerS*DEG,'°/s','Rate of change of pitch. Rate feedback reduces excessive continuing correction.'),
      angle('Flight-path angle',s.flightPathRad,'Direction of air-relative travel above or below horizontal. It follows pitch with a two-second lag.'),
      angle('Angle-of-attack perturbation',s.angleOfAttackPerturbationRad,'Pitch minus flight-path angle. This is a change from trim, not absolute wing angle of attack.'),
      angle('Commanded aileron',s.aileronCommandRad,'Requested equivalent surface angle from desired bank minus actual bank and rate feedback.'),
      angle('Actual aileron',s.aileronRad,'Integrated servo position. Positive raises the right trailing edge and lowers the left; actual surface angles are not magnified.'),
      angle('Aileron position error',s.aileronPositionErrorRad,'Requested angle minus actual shaft angle. This local feedback error drives the finite 0.15-second servo response.'),
      angle('Commanded elevator',s.elevatorCommandRad,'Requested elevator angle from desired pitch minus actual pitch and rate feedback.'),
      angle('Actual elevator',s.elevatorRad,'Integrated elevator shaft angle. Both halves move together; positive raises both trailing edges in this model.'),
      angle('Elevator position error',s.elevatorPositionErrorRad,'Requested elevator angle minus actual shaft angle. The servo keeps moving while this error is nonzero.'),
      f('Heading rate',s.turnRateRadPerS*DEG,'°/s','Near-level coordinated turn rate g/V × tan(bank). Fixed air-relative speed is 50 m/s.'),
      f('Vertical speed',s.verticalSpeedMPerS,'m/s','50 × sin(flight-path angle). Positive climbs; negative descends. Residual motion remains at completion.'),
      f('Eastward wind',values.crosswind,'m/s','Steady ground-relative advection. Negative is westward. Wind is not an input to these heading/height controllers.'),
      f('East ground velocity',s.eastSpeedMPerS,'m/s','East component of air-relative velocity plus wind. This can remain nonzero with zero heading error.'),
      f('North ground velocity',s.northSpeedMPerS,'m/s','North component of the fixed air-relative speed, accounting for heading and flight-path angle.'),
      f('East position',s.eastM,'m','Integrated east ground velocity since the trial began. Holding north does not erase earlier sideways travel.'),
      f('North position',s.northM,'m','Integrated north ground velocity. Correctly held targets still permit forward flight.'),
      angle('Ground track',s.groundTrackRad,'Direction of ground velocity, measured east of north. Compare with heading error to see wind drift.'),
      f('Observation time',elapsed,'s','Physical seconds elapsed. Next observation stage visits 0, 0.15, 1, 3, 10, 20 and 30 seconds without changing the chosen view.'),
      f('Observation progress',state.progress*100,'%','Fraction of the thirty-second trial recorded. Fifteen display seconds show thirty physical seconds.',1),
      reading('View scale','Enlarged co-moving aircraft; equal east/north ground-map distance scales','Actual angular deflections are not enlarged. Blue history is elapsed flight; gray is the original north line, not a route command.'),
      reading('Model limit','Reduced near-trim teaching response; ideal attitude and pressure-height channels; constant airspeed and trim support','Heading and height hold, no route controller. Two-decimal readings retain two significant figures for tiny residuals rather than rounding them to zero. No actuator power or six-degree-of-freedom claim.'),
    ];
    return {state,readings};
  });
  const render=result.update;
  function restart(defaults=false,clock=false){elapsed=0;started=complete=false;gridCount=0;previousTime=-1;if(clock)lastClock=0;return render(defaults?result.defaults:{});}
  result.update=next=>{const before=result.getState().values;render(next);return Object.keys(before).some(k=>before[k]!==result.getState().values[k])?restart():render();};
  function advance(seconds){if(!Number.isFinite(seconds)||seconds<=0||complete)return render();started=true;elapsed=Math.min(30,elapsed+seconds*2);if(elapsed>30-1e-12)elapsed=30;complete=elapsed===30;return render();}
  result.advance=advance;result.animate=clock=>{if(!Number.isFinite(clock))return render();const delta=Math.max(0,clock-lastClock);lastClock=clock;return advance(delta);};result.reset=()=>restart(true,true);
  const stages=[0,.15,1,3,10,20,30];
  result.actions=[{label:'Restart selected autopilot observation',replay:false,run:()=>restart()},{label:'Next observation stage',replay:false,run:()=>{const time=stages.find(t=>t>elapsed+1e-10)??0;restart();return time?advance(time/2):render();}},...[
    ['Inspect the aircraft and surfaces','aircraft'],['Inspect the heading loop','heading-loop'],['Inspect the height loop','height-loop'],['Inspect the ground track','ground-track'],['Inspect response records','records']
  ].map(([label,id])=>({label,part:id,isolate:true,view:id==='aircraft'?'iso':'front',replay:false,run:()=>render()}))];
  result.playback={label:'Observe automatic correction',stepLabel:'Advance one percent of the observation',description:'Fifteen display seconds show thirty physical seconds.',advance,step:()=>advance(.15),complete:()=>complete,blocked:()=>false};
  result.resultPart={id:'system',context:'system',view:'front',focusOnComplete:false,label:'Inspect flight and retained responses',available:()=>started};
  result.framingBounds=new THREE.Box3(new THREE.Vector3(-10,-11.2,-4),new THREE.Vector3(10,9.4,4));
  result.initialPart='aircraft';result.initialView='iso';result.initialIsolated=true;result.framePadding=.65;result.selectionOutline=false;
  result.followParts=['aircraft','sensors','computer','signal-wiring','ailerons','elevator','right-servo','left-servo','elevator-servo'];
  result.topology={system,aircraft,yaw,pitch,bank,fuselage,nose,wings,tail,tailMount,fin,deck,deckFeet,sensors,sensorBoxes,computer,computerBox,wiring,terminals,wires,ailerons,hinges,servos,supports,elevator,elevatorGroup,elevatorSurfaces,elevatorServo,airDirection,reference,headingLoop,heightLoop,gauges,map,mapScale,mapOrigin,northLine,mapMarker,mapDot,mapNose,mapHistory,trackGauge,records,headingRecord,heightRecord,aileronRecord,elevatorRecord,histories,labels,textures};
  const getState=result.getState;result.getState=()=>{const s=getState();return {...s,values:{...s.values},measurements:{...s.measurements},readings:s.readings.map(v=>({...v}))};};
  const dispose=result.dispose;result.dispose=()=>{dispose();textures.forEach(texture=>texture.dispose());};
  return result;
}

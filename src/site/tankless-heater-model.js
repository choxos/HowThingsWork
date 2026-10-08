import * as THREE from 'three';
import {houseModel, reading} from './house-model-kit.js';
import {solidArrow, textLabel} from './scene-kit.js';
import {HEATER_DEFAULTS, HEATER_DOMAINS, HEATER_OPTIONS, HEATER_PHYSICS as P,
  tanklessHeaterPlan, heaterCoilTemperature, heaterPipeTemperature, createTanklessHeaterController} from './tankless-heater-physics.js';

const BLUE = 0x388fb8, ORANGE = 0xe9a147, RED = 0xd25b40, COPPER = 0xb8784f, AIR = 0x8bb9c7, DARK = 0x374736;
export const HEATER_SHAPE = Object.freeze({heaterX:1.25, coilRadius:.070, waterRadius:.046, pipeRadius:.073,
  nozzle:[-2.40,1.35,.08], drain:[-2.40,.23,.08]});
const label = (parent,text,position,width,height=.16,color='#394233') => textLabel(parent,text,{position,width,height,color});
const material = (color,opacity=1) => new THREE.MeshStandardMaterial({color,roughness:.62,metalness:.08,side:THREE.DoubleSide,
  transparent:opacity<1,opacity,depthWrite:opacity===1});
const own = object => {object.material=object.material.clone();return object;};
function mesh(parent,geometry,appearance,position=[0,0,0]) {
  const object=new THREE.Mesh(geometry,appearance);object.position.set(...position);parent.add(object);return object;
}
function roundedPath(points,radius=.12) {
  const vectors=points.map(point=>new THREE.Vector3(...point)), path=new THREE.CurvePath();
  let start=vectors[0];
  for(let i=1;i<vectors.length-1;i++) {
    const current=vectors[i], before=vectors[i-1], after=vectors[i+1];
    const distance=Math.min(radius,current.distanceTo(before)/2,current.distanceTo(after)/2);
    const entry=current.clone().lerp(before,distance/current.distanceTo(before));
    const exit=current.clone().lerp(after,distance/current.distanceTo(after));
    path.add(new THREE.LineCurve3(start,entry));path.add(new THREE.QuadraticBezierCurve3(entry,current,exit));start=exit;
  }
  path.add(new THREE.LineCurve3(start,vectors.at(-1)));return path;
}
export function heaterCoilCurve() {
  const path=new THREE.CurvePath(), left=-.55, right=.75, base=1.82, gap=.30;
  for(let row=0;row<6;row++) {
    const y=base+row*gap, forward=row%2===0;
    const from=new THREE.Vector3(forward?left:right,y,.08), to=new THREE.Vector3(forward?right:left,y,.08);
    path.add(new THREE.LineCurve3(from,to));
    if(row<5) {
      const sign=forward?1:-1, x=to.x, end=new THREE.Vector3(x,y+gap,.08);
      path.add(new THREE.CubicBezierCurve3(to,new THREE.Vector3(x+sign*.20,y,.08),new THREE.Vector3(x+sign*.20,y+gap,.08),end));
    }
  }
  return path;
}
export function heaterOutletPaths(length) {
  const shared=[[.70,3.32,.08],[.12,3.32,.08],[.12,.15,.08]], end=[[-1.70,.15,.08]];
  const middle=length===2?[]:length===5?[[-.45,.15,.08],[-.45,-.30,.08],[-1.35,-.30,.08],[-1.35,.15,.08]]:
    [[-.30,.15,.08],[-.30,-.60,.08],[-.90,-.60,.08],[-.90,-.12,.08],[-1.50,-.12,.08],[-1.50,.15,.08]];
  const pipe=roundedPath([...shared,...middle,...end],.12);
  const tap=roundedPath([end.at(-1),[-1.95,.15,.08],[-1.95,1.65,.08],[-2.40,1.65,.08],HEATER_SHAPE.nozzle],.12);
  const whole=new THREE.CurvePath();whole.add(pipe);whole.add(tap);
  return {pipe,tap,whole,join:pipe.getLength()/whole.getLength()};
}
export const heaterOutletCurve=length=>heaterOutletPaths(length).whole;
export function heaterWaterColor(temperature) {
  const position=Math.max(0,Math.min(1,(temperature-5)/50));
  return position<.6?new THREE.Color(BLUE).lerp(new THREE.Color(ORANGE),position/.6):new THREE.Color(ORANGE).lerp(new THREE.Color(RED),(position-.6)/.4);
}
function waterRoute(kit,parent,curve,segments,radius,coverRadius,rings=8) {
  const geometry=new THREE.TubeGeometry(curve,segments,radius,12,false);
  geometry.setAttribute('color',new THREE.BufferAttribute(new Float32Array(geometry.attributes.position.count*3),3));
  const fluid=mesh(parent,geometry,new THREE.MeshStandardMaterial({vertexColors:true,roughness:.48,metalness:0}));
  const cover=mesh(parent,new THREE.TubeGeometry(curve,segments,coverRadius,12,false),material(COPPER));kit.covers.push(cover);
  const bands=Array.from({length:rings},(_,i)=>{
    const fraction=i/(rings-1), point=curve.getPointAt(fraction), tangent=curve.getTangentAt(fraction);
    const band=kit.ring(coverRadius,.014,point.toArray(),COPPER,parent);band.quaternion.setFromUnitVectors(new THREE.Vector3(0,0,1),tangent);return band;
  });
  const dots=Array.from({length:14},()=>own(kit.sphere(radius*.45,[0,0,0],0xf9f4db,parent)));
  return {curve,segments,radius,fluid,cover,bands,dots};
}
function paintRoute(route,temperature,travel,flowing) {
  const colors=route.fluid.geometry.attributes.color, color=new THREE.Color(), start=route.start??0, span=(route.end??1)-start;
  for(let ring=0;ring<=route.segments;ring++) {
    color.copy(heaterWaterColor(temperature(start+span*ring/route.segments)));
    for(let j=0;j<=12;j++) colors.setXYZ(ring*13+j,color.r,color.g,color.b);
  }
  colors.needsUpdate=true;
  route.dots.forEach((dot,i)=>{const fraction=(travel+i/route.dots.length)%1;dot.visible=flowing&&fraction>=start&&fraction<start+span;
    dot.position.copy(route.curve.getPointAt(Math.max(0,Math.min(1,(fraction-start)/span))));dot.position.z+=route.radius;});
}
function arrow(kit,parent,color,point,direction,thickness=.016) {
  const object=solidArrow(kit,color,parent,thickness);object.position.set(...point);object.userData.setDirection(new THREE.Vector3(...direction));return object;
}
function halfCylinder(parent,radius,height,center,color,front=false,bottomRadius=radius) {
  return mesh(parent,new THREE.CylinderGeometry(radius,bottomRadius,height,40,1,true,front?-Math.PI/2:Math.PI/2,Math.PI),material(color),center);
}

function buildHeater(kit) {
  const system=kit.part('system','Heater and hot-water tap','One connected water, fuel and combustion-air system. Look inside reveals the mechanism. Water color encodes temperature; the long outlet pipe is compressed in length.');
  const heater=kit.part('heater','Complete tankless heater','Opening the tap creates water demand. The controller supplies gas and air to heat the flowing water, then stops the flame when the tap closes.',[HEATER_SHAPE.heaterX,0,0],system);
  const casing=kit.part('casing','Casing and removable cover','The casing encloses the water tube and combustion assembly. Look inside removes the front cover and selected pipe walls; it does not disconnect the paths.',[0,0,0],heater);
  const back=kit.box([2.50,3.92,.07],[0,2.24,-.46],'metal',casing);
  const sides=[-1,1].map(sign=>kit.box([.065,3.92,.92],[sign*1.25,2.24,0],'cream',casing));
  const base=kit.box([2.55,.075,.92],[0,.28,0],'cream',casing);
  const top=[kit.box([1.07,.075,.92],[-.72,4.20,0],'cream',casing),kit.box([.87,.075,.92],[.82,4.20,0],'cream',casing)];
  const cover=new THREE.Group();casing.add(cover);kit.covers.push(cover);
  kit.box([2.55,3.95,.09],[0,2.24,.52],'cream',cover);
  label(cover,'ON-DEMAND HOT WATER',[0,3.48,.574],1.95,.18);
  kit.box([1.06,.64,.025],[0,.90,.58],'ink',cover);
  const outsideSetting=label(cover,'45 °C',[0,.96,.605],.90,.24,'#f2e6c6');
  label(cover,'TEMPERATURE',[0,.73,.605],.88,.10,'#f2e6c6');

  const inlet=kit.part('inlet','Flow sensor and water valve','Flow through the inlet spins the turbine. The ideal controller can restrict this water valve when full burner power cannot heat the requested flow to the chosen temperature. The drawn valve angle is schematic.',[0,0,0],heater);
  const inletCurve=roundedPath([[-.85,-.20,.08],[-.85,1.52,.08],[-.55,1.52,.08],[-.55,1.82,.08]],.10);
  const inletWater=waterRoute(kit,inlet,inletCurve,72,.048,.072,5);
  const sensorBack=kit.disk(.18,.055,[-.85,.85,-.02],'metal',inlet);
  const sensorFront=kit.disk(.18,.06,[-.85,.85,.20],'metal',inlet);kit.covers.push(sensorFront);
  const turbine=new THREE.Group();turbine.position.set(-.85,.85,.13);inlet.add(turbine);
  kit.disk(.026,.05,[0,0,0],'ink',turbine);
  for(let i=0;i<6;i++){const blade=kit.box([.026,.15,.025],[0,.065,0],'gold',turbine);blade.rotation.z=i*Math.PI/3;blade.position.set(-.065*Math.sin(i*Math.PI/3),.065*Math.cos(i*Math.PI/3),0);}
  const valveBack=kit.disk(.16,.07,[-.85,1.27,-.01],'metal',inlet);
  const waterGate=kit.box([.18,.025,.055],[-.85,1.27,.17],'ink',inlet);
  const valveFront=kit.disk(.16,.04,[-.85,1.27,.23],'metal',inlet);kit.covers.push(valveFront);
  const inletArrow=arrow(kit,inlet,BLUE,[-1.05,.0,.14],[0,1,0],.012);
  label(inlet,'COLD IN',[-.85,-.40,.10],.72,.13);

  const coil=kit.part('coil','Water tube and heat exchanger','Water stays inside this continuous tube while hot combustion gases pass around it. The temperature color follows a plug-flow calculation along this same path. The model spreads heating uniformly along the coil and neglects the metal’s thermal mass.',[0,0,0],heater);
  const coilCurve=heaterCoilCurve(), coilWater=waterRoute(kit,coil,coilCurve,240,HEATER_SHAPE.waterRadius,HEATER_SHAPE.coilRadius,14);
  const supports=[-1,1].map(sign=>kit.box([.06,1.82,.055],[sign*.92,2.57,-.17],'metal',coil));
  const fins=Array.from({length:9},(_,i)=>kit.box([.022,1.68,.24],[-.46+i*.14,2.57,-.10],'metal',coil));

  const gas=kit.part('gas','Fuel valve and gas supply','The yellow supply leads through the controlled gas valve to the burner manifold. Its opening and route markers follow firing rate. Fuel remains separate from the water.',[0,0,0],heater);
  const gasCurve=roundedPath([[1.08,-.20,.08],[1.08,1.39,.08],[-.53,1.39,.08]],.08);
  const gasTube=mesh(gas,new THREE.TubeGeometry(gasCurve,72,.043,12,false),material(0xd9b665));
  const gasWall=mesh(gas,new THREE.TubeGeometry(gasCurve,72,.060,12,false),material(0xe3b45e));kit.covers.push(gasWall);
  const gasBody=kit.box([.32,.41,.20],[1.08,.78,-.07],'metal',gas);
  const gasCover=kit.box([.32,.41,.05],[1.08,.78,.15],'metal',gas);kit.covers.push(gasCover);
  const gasSeat=kit.ring(.073,.018,[1.08,.72,.08],'ink',gas);gasSeat.rotation.x=Math.PI/2;
  const gasDisc=kit.cylinder(.075,.032,[1.08,.735,.08],'gold',gas);
  const gasStem=kit.cylinder(.018,.17,[1.08,.85,.08],'ink',gas);
  const gasDots=Array.from({length:12},()=>kit.sphere(.014,[0,0,0],0xf4cf77,gas));
  label(gas,'GAS',[1.08,-.40,.10],.47,.13);

  const burner=kit.part('burner','Burner, spark and flame sensor','Gas meets combustion air at the burner. A spark starts the flame; a flame sensor reports combustion to the controller. Flame size denotes the heat rate, with no flame-temperature or chemical-kinetics calculation.',[0,0,0],heater);
  const manifold=kit.box([1.36,.16,.38],[.10,1.43,-.01],'ink',burner);
  const ports=Array.from({length:7},(_,i)=>kit.cylinder(.045,.045,[-.47+i*.19,1.525,.04],'gold',burner));
  const flames=ports.map(port=>{
    const geometry=new THREE.ConeGeometry(.056,1,14);geometry.translate(0,.5,0);
    return mesh(burner,geometry,new THREE.MeshBasicMaterial({color:ORANGE,transparent:true,opacity:.90}),[port.position.x,1.55,.04]);
  });
  const sparkRod=kit.rod([-.64,1.38,.24],[-.57,1.63,.17],.018,'cream',burner);
  const sensorRod=kit.rod([.82,1.39,.23],[.68,1.67,.04],.019,'metal',burner);
  const spark=kit.tube([[-.57,1.63,.17],[-.54,1.58,.12],[-.50,1.64,.06],[-.47,1.59,.04]],.010,0xf1e79d,burner);
  const flameSignal=own(kit.sphere(.037,[.85,1.37,.25],'ink',burner));

  const fan=kit.part('fan','Combustion-air fan','The fan starts before ignition, supplies air during firing and runs briefly after the tap closes. Its air path joins the burner. Fan rotation is illustrative, not an RPM prediction.',[0,0,0],heater);
  const airCurve=roundedPath([[.27,-.20,-.17],[.27,1.35,-.17]],.1);
  const airDuct=mesh(fan,new THREE.TubeGeometry(airCurve,32,.13,20,false),material(AIR,.20));
  const fanBack=kit.disk(.33,.05,[.27,.87,-.27],'metal',fan), fanRing=kit.ring(.32,.045,[.27,.87,.02],'ink',fan);
  const rotor=new THREE.Group();rotor.position.set(.27,.87,-.015);fan.add(rotor);kit.disk(.07,.06,[0,0,0],'gold',rotor);
  for(let i=0;i<7;i++){
    const a=i*2*Math.PI/7, blade=kit.box([.065,.21,.032],[-.15*Math.sin(a),.15*Math.cos(a),0],'ink',rotor);blade.rotation.z=a+.28;
  }
  const fanCover=kit.disk(.30,.028,[.27,.87,.055],'metal',fan);kit.covers.push(fanCover);
  const airDots=Array.from({length:10},()=>kit.sphere(.030,[0,0,0],AIR,fan));
  const airArrow=arrow(kit,fan,AIR,[.48,-.02,.12],[0,1,0],.013);
  label(fan,'AIR',[.27,-.40,.1],.46,.13);

  const flue=kit.part('flue','Combustion chamber and flue','Hot gas rises between the water-tube passes, then leaves through the hood and flue. Combustion products and domestic water never mix. Orange markers indicate heat-carrying exhaust, not its exact composition or temperature.',[0,0,0],heater);
  const chamberBack=kit.box([1.72,1.92,.04],[.10,2.51,-.35],'cream',flue);
  const hoodBack=halfCylinder(flue,.23,.40,[.10,3.68,-.08],0xb8c3b4,false,.82);
  const hoodFront=halfCylinder(flue,.23,.40,[.10,3.68,-.08],0xb8c3b4,true,.82);kit.covers.push(hoodFront);
  for(const hood of [hoodBack,hoodFront]) {
    const points=hood.geometry.attributes.position;
    for(let i=0;i<points.count;i++)if(points.getY(i)<0)points.setZ(i,points.getZ(i)*.4);
    points.needsUpdate=true;hood.geometry.computeVertexNormals();
  }
  const flueBack=halfCylinder(flue,.23,1.00,[.10,4.38,-.08],0xb8c3b4);
  const flueFront=halfCylinder(flue,.23,1.00,[.10,4.38,-.08],0xb8c3b4,true);kit.covers.push(flueFront);
  const flueRims=[3.88,4.88].map(y=>{const ring=kit.ring(.23,.022,[.10,y,-.08],'metal',flue);ring.rotation.x=Math.PI/2;return ring;});
  const exhaustDots=Array.from({length:24},(_,i)=>own(kit.sphere(.029,[0,0,0],ORANGE,flue)));
  const exhaustArrow=arrow(kit,flue,ORANGE,[.10,4.54,.04],[0,1,0],.021);
  label(flue,'EXHAUST',[.10,5.08,-.08],.88,.14);

  const controller=kit.part('controller','Temperature control','The control reads flow and water temperature, adjusts the fuel valve, and limits water flow when required heat exceeds capacity. This demonstration uses an ideal control law, not a real circuit design or feedback-tuning model.',[0,0,0],heater);
  const board=kit.box([.63,.50,.08],[-.29,.63,.02],'leaf',controller);
  const screen=kit.box([.49,.25,.035],[-.29,.69,.085],'ink',controller);
  const settingLabel=label(controller,'45 °C',[-.29,.70,.109],.45,.17,'#fff1cb');
  const demandLamp=own(kit.sphere(.035,[-.49,.48,.084],'ink',controller));
  const flameLamp=own(kit.sphere(.035,[-.10,.48,.084],'ink',controller));
  const wirePaths=[
    [[-.58,.60,0],[-.66,.60,-.16],[-.66,.86,-.16],[-.85,.86,-.03]],
    [[.01,.62,0],[.75,.62,-.16],[.94,.78,-.16]],
    [[-.25,.87,0],[-.25,1.20,-.26],[.82,1.20,-.26],[.82,1.39,.23]],
    [[-.48,.87,0],[-1.01,.87,-.18],[-1.01,3.32,-.18],[-.55,3.32,.14]],
    [[-.58,.76,0],[-.72,.76,-.21],[-.72,1.27,-.21],[-.85,1.27,-.03]],
    [[.01,.47,0],[.27,.47,-.26],[.27,.87,-.26]],
  ];
  const wires=wirePaths.map(points=>kit.tube(points,.013,DARK,controller));
  const thermistor=kit.disk(.10,.035,[-.55,3.32,.155],'gold',controller);

  const delivery=kit.part('delivery','Outlet pipe and tap','Follow the separate hot-water outlet from the heater to the faucet. Water already in this route must move out before the heated water arrives.',[0,0,0],system);
  const pipe=kit.part('pipe','Outlet pipe to the tap','The pipe first contains cool water. Heated water must travel through this whole route before reaching the tap. Pipe length changes stored volume and transit time; its drawn length is compressed and pipe heat loss is omitted.',[0,0,0],delivery);
  const pipeVariants=HEATER_OPTIONS.pipe.map(({value})=>{
    const paths=heaterOutletPaths(value),group=new THREE.Group();pipe.add(group);
    const route=waterRoute(kit,group,paths.pipe,160,.048,HEATER_SHAPE.pipeRadius,12);
    return {value,group,...route,start:0,end:paths.join};
  });
  const pipeLabel=label(pipe,'5 m outlet pipe',[-.95,-.82,.10],1.56,.17);
  label(pipe,'length compressed',[-.95,-1.02,.10],1.56,.13);

  const tap=kit.part('tap','Tap and delivered water','The same water route ends at this tap. Stream width follows delivered flow; stream color and thermometer follow the arriving water. The draining sink is a useful result view, not a storage tank.',[0,0,0],delivery);
  const tapWater=waterRoute(kit,tap,heaterOutletPaths(HEATER_DEFAULTS.pipe).tap,64,.048,HEATER_SHAPE.pipeRadius,5);
  const stem=kit.cylinder(.10,.28,[-1.95,1.73,.08],'gold',tap);
  const handle=new THREE.Group();handle.position.set(-1.95,1.89,.08);tap.add(handle);
  kit.box([.55,.065,.065],[0,0,0],'gold',handle);kit.sphere(.065,[-.275,0,0],'gold',handle);kit.sphere(.065,[.275,0,0],'gold',handle);
  const spoutRim=kit.ring(.078,.018,HEATER_SHAPE.nozzle,'gold',tap);spoutRim.rotation.x=Math.PI/2;
  const basin=kit.box([1.28,.10,.95],[-2.40,.18,.02],'cream',tap);
  const basinWalls=[
    ...[-1,1].map(sign=>kit.box([.07,.26,.95],[-2.40+sign*.62,.35,.02],'cream',tap)),
    ...[-1,1].map(sign=>kit.box([1.25,.26,.055],[-2.40,.35,.02+sign*.46],'cream',tap)),
  ];
  const drain=kit.disk(.12,.014,HEATER_SHAPE.drain,'ink',tap);drain.rotation.x=0;
  const waste=kit.tube([HEATER_SHAPE.drain,[-2.40,-.10,.08],[-2.20,-.25,.08],[-2.20,-.50,.08]],.055,'metal',tap);
  const stream=mesh(tap,new THREE.CylinderGeometry(1,1,1,16),material(BLUE,.76));
  const drops=Array.from({length:10},()=>own(kit.sphere(.029,[0,0,0],BLUE,tap)));
  const splash=own(kit.ring(.16,.014,[-2.40,.242,.08],BLUE,tap));splash.rotation.x=Math.PI/2;
  const resultPanel=kit.box([1.76,.77,.045],[-2.14,2.57,.16],'cream',tap);
  const resultStatus=label(tap,'TAP CLOSED',[-2.14,2.82,.188],1.60,.13);
  const temperatureLabel=label(tap,'10.0 °C',[-2.14,2.58,.188],1.60,.29);
  const flowLabel=label(tap,'0.00 L/min',[-2.14,2.32,.188],1.60,.15);
  return {system,heater,casing,back,sides,base,top,cover,outsideSetting,inlet,inletCurve,inletWater,sensorBack,sensorFront,turbine,valveBack,waterGate,valveFront,inletArrow,
    coil,coilCurve,coilWater,supports,fins,gas,gasCurve,gasTube,gasWall,gasBody,gasCover,gasSeat,gasDisc,gasStem,gasDots,burner,manifold,ports,flames,sparkRod,sensorRod,spark,flameSignal,
    fan,airCurve,airDuct,fanBack,fanRing,rotor,fanCover,airDots,airArrow,flue,chamberBack,hoodBack,hoodFront,flueBack,flueFront,flueRims,exhaustDots,exhaustArrow,
    controller,board,screen,settingLabel,demandLamp,flameLamp,wirePaths,wires,thermistor,delivery,pipe,pipeVariants,pipeLabel,tap,tapWater,stem,handle,spoutRim,basin,basinWalls,drain,waste,stream,drops,splash,resultPanel,resultStatus,temperatureLabel,flowLabel};
}

function drawHeater(g,state) {
  const {now,values}=state, plan=tanklessHeaterPlan(values), observed=Math.min(state.clock,plan.closeAt), flowing=now.flow>0;
  paintRoute(g.inletWater,()=>values.inlet,now.deliveredLiters/.18,flowing);
  paintRoute(g.coilWater,s=>heaterCoilTemperature(plan,s,state.clock),now.deliveredLiters/P.coilLiters,flowing);
  g.pipeVariants.forEach(route=>{route.group.visible=route.value===values.pipe;if(route.group.visible){
    paintRoute(route,s=>heaterPipeTemperature(plan,s,state.clock),now.deliveredLiters/plan.pipeLiters,flowing);
    g.tapWater.start=route.end;paintRoute(g.tapWater,s=>heaterPipeTemperature(plan,s,state.clock),now.deliveredLiters/plan.pipeLiters,flowing);
  }});
  g.pipeLabel.userData.setText(`${values.pipe} m outlet pipe`);
  g.turbine.rotation.z=-now.deliveredLiters*2*Math.PI;
  g.waterGate.rotation.z=now.waterValve*Math.PI/2;g.inletArrow.userData.setLength(flowing?.32:0);
  g.gasDisc.position.y=.735+.11*now.fuelValve;g.gasStem.position.y=.85+.11*now.fuelValve;
  g.gasDots.forEach((dot,i)=>{dot.visible=now.lit;dot.position.copy(g.gasCurve.getPointAt((observed*.24*now.fuelValve+i/g.gasDots.length)%1));dot.position.z+=.040;});
  g.flames.forEach((flame,i)=>{flame.visible=now.lit;flame.scale.set(1,.05+.14*now.fuelValve*(.94+.06*Math.sin(state.clock*9+i)),1);});
  g.spark.visible=now.spark;g.flameSignal.material.color.set(now.lit?ORANGE:DARK);
  g.rotor.rotation.z=plan.active?-Math.min(state.clock,plan.duration)*8:0;
  g.airDots.forEach((dot,i)=>{dot.visible=now.fan;dot.position.copy(g.airCurve.getPointAt((state.clock*.43+i/g.airDots.length)%1));});
  g.airArrow.userData.setLength(now.fan?.32:0);
  g.exhaustDots.forEach((dot,i)=>{
    dot.visible=now.fan;const u=(state.clock*.22+i/g.exhaustDots.length)%1,y=1.56+u*3.20;
    const width=y<3.48?.56:y<3.88?.56-(y-3.48)*.95:.13;
    dot.position.set(.10+width*((i%3)-1),y,-.15);
    dot.material.color.set(now.lit?ORANGE:AIR);
  });
  g.exhaustArrow.userData.setLength(now.fan?.28:0);
  g.exhaustArrow.traverse(object=>{if(object.material)object.material.color.set(now.lit?ORANGE:AIR);});
  g.settingLabel.userData.setText(`${values.set} °C`);g.outsideSetting.userData.setText(`${values.set} °C`);
  g.demandLamp.material.color.set(now.tapOpen?BLUE:DARK);g.flameLamp.material.color.set(now.lit?ORANGE:DARK);
  g.handle.rotation.y=now.tapOpen?Math.PI/2:0;
  const color=heaterWaterColor(now.tapTemperature), length=HEATER_SHAPE.nozzle[1]-HEATER_SHAPE.drain[1], radius=.037*Math.sqrt(now.flow/8);
  g.stream.visible=flowing;g.stream.position.set(-2.40,(HEATER_SHAPE.nozzle[1]+HEATER_SHAPE.drain[1])/2,.08);g.stream.scale.set(Math.max(1e-8,radius),length,Math.max(1e-8,radius));g.stream.material.color.copy(color);
  g.drops.forEach((dot,i)=>{dot.visible=flowing;const fraction=(state.clock*.8+i/g.drops.length)%1;dot.position.set(-2.40,HEATER_SHAPE.nozzle[1]-length*fraction,.08);dot.scale.setScalar(Math.max(1e-8,Math.sqrt(now.flow/8)));dot.material.color.copy(color);});
  g.splash.visible=flowing;g.splash.material.color.copy(color);
  g.resultStatus.userData.setText(now.tapOpen?'WATER AT THE TAP':now.deliveredLiters>0?'LAST DELIVERY':'TAP CLOSED');
  g.temperatureLabel.userData.setText(now.deliveredLiters>0?`${now.tapTemperature.toFixed(1)} °C`:'No flow');
  g.flowLabel.userData.setText(`${(now.deliveredLiters>0?state.actualFlow:0).toFixed(2)} L/min`);
}

function resultText(state) {
  const {now,values}=state;
  if(now.phase==='ready')return values.flow===0?'Ready to observe a closed tap. No water demand means no firing.':`Ready: ${values.inlet} °C water in the coil and pipe. Play to draw water.`;
  if(values.flow===0)return now.complete?'Observation complete. The tap stayed closed; water, gas and fan never started.':'The tap stays closed. Water, gas and fan remain off.';
  if(!state.active)return now.complete?`The trickle delivered ${now.deliveredLiters.toFixed(2)} L at ${values.inlet} °C. It never activated the burner.`:'A 1 L/min trickle flows, but it is below the model’s 1.5 L/min ignition threshold. The water stays cool.';
  if(now.phase==='purging')return 'The tap is open. The flow sensor turns and the fan clears the combustion path before gas is admitted.';
  if(now.phase==='igniting')return 'The ignition sequence is starting. Water already flows through the coil and tap.';
  if(now.phase==='pipe-transit')return `The flame is heating water in the coil. Water at the tap is still ${now.tapTemperature.toFixed(1)} °C while the outlet pipe clears.`;
  if(now.phase==='warming')return `Warming water has reached the tap: ${now.tapTemperature.toFixed(1)} °C. The coil and pipe are still reaching steady operation.`;
  if(now.phase==='hot')return `${now.tapTemperature.toFixed(1)} °C water arrives at ${now.flow.toFixed(2)} L/min.${state.limited?' Full heat output limits the flow below your request.':' The burner modulates to meet your setting.'}`;
  if(now.phase==='fan-run-on')return 'The tap has closed and the flame is off. The fan briefly clears remaining combustion gases.';
  return `Delivered ${now.deliveredLiters.toFixed(2)} L; the last water was ${now.tapTemperature.toFixed(1)} °C at ${state.actualFlow.toFixed(2)} L/min. Tap, fuel valve and fan are now off.`;
}

export function createTanklessHeaterModel() {
  const kit=houseModel('Gas boiler'), controller=createTanklessHeaterController(), g=buildHeater(kit);
  kit.control('flow','Tap demand',...HEATER_DOMAINS.flow,HEATER_DEFAULTS.flow,'L/min','The requested flow. This ideal controller reduces actual flow if it cannot supply the chosen temperature at that rate.',HEATER_OPTIONS.flow);
  kit.control('set','Desired temperature',...HEATER_DOMAINS.set,HEATER_DEFAULTS.set,'°C','A hotter setting needs more heat per liter. At full output, less water can reach that temperature.',HEATER_OPTIONS.set);
  kit.control('inlet','Cold-water temperature',...HEATER_DOMAINS.inlet,HEATER_DEFAULTS.inlet,'°C','Colder incoming water needs a larger temperature rise. Compare flame output and delivered flow.',HEATER_OPTIONS.inlet);
  kit.control('pipe','Outlet-pipe length',...HEATER_DOMAINS.pipe,HEATER_DEFAULTS.pipe,'m','A longer pipe holds more cool water and delays hot arrival. Its drawn length is compressed. Each change prepares a fresh cold-start run.',HEATER_OPTIONS.pipe);
  const model=kit.finish(()=>{
    const state=controller.getState(),{now,values}=state;drawHeater(g,state);
    return {state,readings:[
      reading('Your result',resultText(state)),
      reading('Water at the tap',now.deliveredLiters>0?`${now.tapTemperature.toFixed(1)} °C`:'No water delivered',now.tapOpen?'Color in the stream follows this arriving water temperature.':now.deliveredLiters>0?'Temperature of the last water delivered. The tap is now closed.':'Press Play to observe the selected demand.'),
      reading(now.deliveredLiters>0&&!now.tapOpen?'Last delivered flow':'Delivered flow',`${(now.deliveredLiters>0?state.actualFlow:0).toFixed(2)} L/min`,`${now.deliveredLiters>0&&!now.tapOpen?'The tap is now closed. This was the flow during delivery. ':''}${state.limited?`Your ${values.flow} L/min request exceeds the illustrative heat capacity. During delivery, the controller allows ${state.actualFlow.toFixed(2)} L/min to hold ${values.set} °C.`:`Requested flow: ${values.flow} L/min. The flow sensor and tap stream follow actual flow.`}`),
      reading('Heat entering water',`${(now.heat/1000).toFixed(2)} kW`,now.lit?'During warm-up, some heat remains in the coil and pipe; it has not all reached the tap. Maximum modeled transfer is 24 kW.':'The burner is off, so it supplies no heat to the water.'),
      reading('Fuel energy rate',`${(now.fuel/1000).toFixed(2)} kW`,`${(now.loss/1000).toFixed(2)} kW is assigned to exhaust and surroundings. The illustrative split is 80% to water, 20% elsewhere.`),
      reading('Time to chosen temperature',state.active?`${state.hotAt.toFixed(1)} model s`:'Not reached',state.active?`Includes ignition, coil warm-up and ${state.pipeTime.toFixed(1)} s transport through ${state.pipeLiters.toFixed(2)} L of outlet-pipe water.`:values.flow===0?'A closed tap creates no demand.':'The trickle never crosses the ignition threshold.'),
      reading('Water delivered',`${now.deliveredLiters.toFixed(2)} L`,now.complete?'Includes the cool and warming water delivered before steady hot water. The sink drains throughout.':'The cumulative volume equals actual flow integrated while the tap is open.'),
    ]};
  });
  const render=model.update, readState=model.getState;let previousTime=0,disposed=false;
  const sync=()=>render(controller.getState().values);
  model.getState=()=>({...controller.getState(),readings:readState().readings.map(item=>({...item}))});
  model.update=(input={})=>{controller.update(input);return sync();};
  model.reset=(initial={})=>{controller.reset(initial);previousTime=0;return sync();};
  model.advance=seconds=>{controller.advance(Number.isFinite(seconds)?seconds*P.playbackRate:0);return sync();};
  model.animate=time=>{if(!Number.isFinite(time)||time<previousTime)return sync();const delta=time-previousTime;previousTime=time;return model.advance(delta);};
  model.replayState=controller.replayState;
  model.playback={label:'Draw water and follow the heating cycle',description:'A fresh cold start, hot-water delivery, tap closure and fan run-on. Playback runs at twice model time. A closed tap or trickle remains unheated.',stepLabel:'Advance one model second',advance:model.advance,step:()=>model.advance(.5),complete:()=>model.getState().now.complete,blocked:()=>false};
  model.actions=[['Inspect: complete system','system'],['Inspect: heat exchanger','coil'],['Inspect: fuel and flame','heater'],['Inspect: pipe and tap','delivery']].map(([label,part])=>({label,part,isolate:true,view:'front',replay:false,run:sync}));
  model.resultPart={id:'tap',label:'Inspect delivered water',view:'front',focusOnComplete:false,preserveOnReset:true,available:()=>true};
  model.initialPart='system';model.initialView='front';model.initialIsolated=true;model.initialCutaway=true;
  model.frameVisibleOnly=true;model.framePadding=.60;model.selectionOutline=false;model.transparentBackground=true;model.overviewZoom=.7/model.framePadding;
  model.frameBoundsForPart=id=>id==='system'?new THREE.Box3().setFromObject(g.system):undefined;
  model.viewDirections={front:[.3,.18,8],iso:[3,2.1,7]};
  model.partViewDirections=Object.fromEntries(model.parts.map(part=>[part.id,{front:[.3,.18,8]}]));
  model.parts.forEach(part=>{part.framePadding=['system','heater','delivery'].includes(part.id)?.60:.65;});
  model.catalogParts=model.parts.filter(part=>!['system','heater','delivery'].includes(part.id));model.topology=g;
  const dispose=model.dispose;model.dispose=()=>{if(!disposed){disposed=true;dispose();}};return model;
}

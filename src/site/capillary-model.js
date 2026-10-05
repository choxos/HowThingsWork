import * as THREE from 'three';
import {houseModel, reading as r} from './house-model-kit.js';
import {fixed} from './format.js';
import {fillLine, lineObject, segmentLines, surface, textLabel} from './scene-kit.js';
import {CAPILLARY as C, CAPILLARY_DEFAULTS, CAPILLARY_DOMAINS, CAPILLARY_FLUIDS, CAPILLARY_WETTING, capillaryPlan, capillaryAt, capillaryGap, capillaryWedge, capillarySurface} from './capillary-physics.js';

export const MM = .01;
export const APPARATUS = Object.freeze({floor: -66, bottom: -68, rim: 3, x0: -14, x1: 84, z0: -11, z1: 11, tubeOuter: 2, wedgeX: 40, plate: .5, railX: 96, clampY: 205});
export const DETAIL = Object.freeze({bore: .32, wall: .08, bottom: -.65, top: .5, tangent: .19});
export const PLOT = Object.freeze({x: -.55, y: -.5, width: 1.1, height: 1.25, low: -80, high: 160});
const GLASS = 0xb9cbd0, GUIDE = 0xc08c36, INK = 0x394233, FAINT = 0x889781;
const point = (x, y, z = 0) => [x * MM, y * MM, z * MM];
const polygon = points => new THREE.Shape(points.map(([x,y]) => new THREE.Vector2(x,y)));
const replace = (mesh, geometry) => {mesh.geometry.dispose(); mesh.geometry = geometry;};

/** Extrude an x/z footprint upward without reversing the solid's faces. */
function verticalExtrusion(shape,height){
  const geometry=new THREE.ExtrudeGeometry(shape,{depth:height,bevelEnabled:false});
  geometry.rotateX(-Math.PI/2);geometry.scale(MM,MM,-MM);
  // The reflected z coordinate reverses handedness. Reverse each triangle too,
  // preserving the transformed outward normals and correct front-face culling.
  if(geometry.index){
    const index=geometry.index.array;for(let i=0;i<index.length;i+=3)[index[i+1],index[i+2]]=[index[i+2],index[i+1]];
    geometry.index.needsUpdate=true;
  }else{
    for(const attribute of Object.values(geometry.attributes)){
      const a=attribute.array,n=attribute.itemSize;
      for(let i=0;i<attribute.count;i+=3)for(let k=0;k<n;k++){const j=(i+1)*n+k,l=(i+2)*n+k;[a[j],a[l]]=[a[l],a[j]];}
      attribute.needsUpdate=true;
    }
  }
  return geometry;
}

/** Solid annular tube wall, open at both ends, with a longitudinal cut face. */
export function capillaryWall(radius, start, length = Math.PI) {
  const points=[];
  for (let i=0;i<=64;i++){const a=start+length*i/64;points.push([APPARATUS.tubeOuter*Math.sin(a),APPARATUS.tubeOuter*Math.cos(a)]);}
  for (let i=64;i>=0;i--){const a=start+length*i/64;points.push([radius*Math.sin(a),radius*Math.cos(a)]);}
  return verticalExtrusion(polygon(points),C.length);
}

/** Constant-thickness glass plates bounding an actual 0.1–1.0 mm wedge. */
export function capillaryPlate(side) {
  const a = side * C.narrowGap / 2, b = side * C.wideGap / 2, d = side * APPARATUS.plate;
  const outline = polygon([[0,a],[C.wedgeWidth,b],[C.wedgeWidth,b+d],[0,a+d]]);
  return verticalExtrusion(outline,C.length);
}

/** Closed liquid sheet; local parallel-plate equilibrium ignores along-wedge curvature. */
export function capillarySheet(plan, count = 160) {
  const vertices = [], indices = [];
  const threshold = -2 * plan.liquid.tension * Math.cos(plan.angle*Math.PI/180) / (plan.liquid.density*C.gravity*plan.depth*.001) * 1000;
  const from = Math.max(0, (threshold-C.narrowGap)/(C.wideGap-C.narrowGap)*C.wedgeWidth);
  if (from >= C.wedgeWidth) return new THREE.BufferGeometry();
  for (let i=0;i<=count;i++) {
    const x=from+(C.wedgeWidth-from)*i/count, gap=capillaryGap(x), top=Math.max(-plan.depth,capillaryWedge(plan,x).height);
    for (const [y,z] of [[-plan.depth,-gap/2],[-plan.depth,gap/2],[top,-gap/2],[top,gap/2]]) vertices.push(...point(x,y,z));
    if (i) {const a=4*(i-1),b=4*i;for(const [p,q] of [[0,1],[1,3],[3,2],[2,0]])indices.push(a+p,b+p,a+q,a+q,b+p,b+q);}
  }
  indices.push(0,2,1,1,2,3);const end=4*count;indices.push(end,end+1,end+2,end+1,end+3,end+2);
  const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));geometry.setIndex(indices);geometry.computeVertexNormals();return geometry;
}

/** Bath footprint has real openings for the tube and both glass plates. */
export function capillaryBathShape() {
  const A=APPARATUS, shape=polygon([[A.x0,A.z0],[A.x1,A.z0],[A.x1,A.z1],[A.x0,A.z1]]);
  const tube=new THREE.Path();tube.absarc(0,0,A.tubeOuter,0,2*Math.PI,true);shape.holes.push(tube);
  const wedge=new THREE.Path();wedge.moveTo(A.wedgeX,-C.narrowGap/2-A.plate);wedge.lineTo(A.wedgeX,C.narrowGap/2+A.plate);wedge.lineTo(A.wedgeX+C.wedgeWidth,C.wideGap/2+A.plate);wedge.lineTo(A.wedgeX+C.wedgeWidth,-C.wideGap/2-A.plate);wedge.closePath();shape.holes.push(wedge);
  return shape;
}
export const capillaryChartPoint = (size, height) => [PLOT.x+(size-.1)/.9*PLOT.width,PLOT.y+(height-PLOT.low)/(PLOT.high-PLOT.low)*PLOT.height,0];

export function createCapillaryModel() {
  const kit=houseModel('Capillary action'), {part,control,finish}=kit, A=APPARATUS;
  const box=(parent,color,x0,x1,y0,y1,z0,z1)=>{const mesh=surface(kit,new THREE.BoxGeometry((x1-x0)*MM,(y1-y0)*MM,(z1-z0)*MM),color,parent);mesh.position.set(...point((x0+x1)/2,(y0+y1)/2,(z0+z1)/2));return mesh;};
  const system=part('system','Capillary action apparatus','An open tube and two nearly parallel plates share one liquid bath. Physical dimensions are drawn on one scale. Levels show ideal equilibrium immediately; playback guides the explanation, not filling time.');
  const bench=part('capillary','Connected capillary bench','The glass extends 220 mm from each immersed mouth. Change depth to lower the glass through the same bath surface. A fixed reservoir level and ideal contact angles are assumed.',[0,0,0],system);
  const stand=part('stand','Stand and adjustable clamps','A base and vertical rail hold a sliding crossbar. A collar grips the outside of the tube and pads grip both plates. Lowering this assembly changes immersion without changing the required height relative to the bath.',[0,0,0],bench);
  const base=box(stand,'wood',-18,104,-73,-68,-16,16), rail=box(stand,'metal',94,98,-68,224,-3,3);
  const carriage=new THREE.Group();stand.add(carriage);
  const arm=box(carriage,'metal',2,94,203,207,-4,-2);
  const collar=surface(kit,new THREE.LatheGeometry([[2,201],[3,201],[3,209],[2,209],[2,201]].map(([x,y])=>new THREE.Vector2(x*MM,y*MM)),48), 'metal',carriage);
  const railSocket=polygon([[93,-4],[99,-4],[99,4],[93,4]]), railHole=new THREE.Path();railHole.moveTo(94,-3);railHole.lineTo(94,3);railHole.lineTo(98,3);railHole.lineTo(98,-3);railHole.closePath();railSocket.holes.push(railHole);
  const sliderGeometry=verticalExtrusion(railSocket,8);
  const slider=surface(kit,sliderGeometry,'metal',carriage);slider.position.y=201*MM;
  const pads=[-1,1].map(side=>{
    const inner=x=>side*(capillaryGap(x-40)/2+A.plate),outer=side<0?-4:1.5;
    const geometry=verticalExtrusion(polygon([[58,inner(58)],[62,inner(62)],[62,outer],[58,outer]]),19);
    const mesh=surface(kit,geometry,'ink',carriage,true);mesh.position.y=201*MM;return mesh;
  });
  const clampTop=box(carriage,'ink',58,62,220,222,-4,1.5);

  const bath=part('bath','Open liquid bath','The outside liquid surface is the zero-height reference. Look inside removes the front wall and the bulk liquid to expose the immersed mouths; the surface with openings remains. The bath is treated as large enough to keep a fixed level.',[0,0,0],bench);
  const floor=box(bath,'cream',A.x0-1,A.x1+1,A.bottom,A.floor,A.z0-1,A.z1+1);
  const back=box(bath,GLASS,A.x0-1,A.x1+1,A.floor,A.rim,A.z0-1,A.z0);
  const left=box(bath,GLASS,A.x0-1,A.x0,A.floor,A.rim,A.z0,A.z1);
  const right=box(bath,GLASS,A.x1,A.x1+1,A.floor,A.rim,A.z0,A.z1);
  const front=box(bath,GLASS,A.x0-1,A.x1+1,A.floor,A.rim,A.z1,A.z1+1);
  const liquidMaterial=new THREE.MeshToonMaterial({color:CAPILLARY_FLUIDS[0].color,side:THREE.DoubleSide});
  const liquidMesh=(geometry,parent)=>{const mesh=surface(kit,geometry,'blue',parent);mesh.material=liquidMaterial;return mesh;};
  const bathSurface=liquidMesh(new THREE.ShapeGeometry(capillaryBathShape(),64),bath);bathSurface.rotation.x=Math.PI/2;bathSurface.scale.setScalar(MM);
  const bathBulk=liquidMesh(new THREE.ExtrudeGeometry(capillaryBathShape(),{depth:-A.floor,bevelEnabled:false,curveSegments:64}),bath);bathBulk.rotation.x=Math.PI/2;bathBulk.scale.setScalar(MM);
  const lowerTube=liquidMesh(new THREE.BufferGeometry(),bath),lowerWedge=liquidMesh(new THREE.BufferGeometry(),bath);
  const zero=segmentLines(1,FAINT,bath);fillLine(zero,[point(A.x0-3,0,13),point(A.x1+3,0,13)]);

  const tube=part('tube','Open glass tube','The hollow bore has the selected true radius, with an outside radius of 2 mm. Its bottom is immersed and its top is open to the same ambient air as the bath. Look inside removes the front half of the glass.',[0,0,0],bench);
  const tubeBack=surface(kit,new THREE.BufferGeometry(),GLASS,tube,true),tubeFront=surface(kit,new THREE.BufferGeometry(),GLASS,tube,true);
  const column=liquidMesh(new THREE.BufferGeometry(),tube);
  const tubeRim=lineObject(65,INK,tube);
  const heightMark=segmentLines(3,GUIDE,tube);
  const levelLabel=textLabel(tube,'',{height:.24,width:.95,align:'left',position:point(-103,85,3)});

  const wedge=part('wedge','Wedge of glass plates','Two 220 mm plates leave a gap from 0.10 to 1.00 mm across 40 mm. Each local gap uses the parallel-plate pressure balance. This neglects along-wedge curvature and flow; the curved height profile is an approximation.',[A.wedgeX*MM,0,0],bench);
  const plates=[-1,1].map(side=>surface(kit,capillaryPlate(side),GLASS,wedge,true));
  const sheet=liquidMesh(new THREE.BufferGeometry(),wedge);
  const wedgeEdge=lineObject(161,INK,wedge),plateOutline=segmentLines(4,FAINT,wedge);
  const match=segmentLines(1,GUIDE,wedge);

  const meniscus=part('meniscus','Meniscus, enlarged','A uniformly enlarged cross-section through the tube axis. Wall contact, surface tangent and curved liquid meet in the same plane. This spherical-cap reference neglects gravity across the meniscus. If liquid cannot enter, it shows the required interior shape, not a liquid surface actually inside the tube.',[1.7,.6,0],system);
  const menWalls=[-1,1].map(side=>{const mesh=surface(kit,new THREE.BoxGeometry(DETAIL.wall,DETAIL.top-DETAIL.bottom,.07),GLASS,meniscus);mesh.position.set(side*(DETAIL.bore+DETAIL.wall/2),(DETAIL.top+DETAIL.bottom)/2,-.035);return mesh;});
  const menLiquid=liquidMesh(new THREE.BufferGeometry(),meniscus),menCurve=lineObject(129,INK,meniscus),tangents=segmentLines(2,GUIDE,meniscus);
  const menTitle=textLabel(meniscus,'',{height:.15,width:1.5,position:[0,.83,0]}),menScale=textLabel(meniscus,'',{height:.15,width:1.5,position:[0,-.79,0]});
  const menStatus=textLabel(meniscus,'',{height:.135,width:1.5,position:[0,.65,0]});
  const contactDots=[-1,1].map(side=>{const mesh=kit.sphere(.014,[side*DETAIL.bore,0,.002],'gold',meniscus);return mesh;});

  const chart=part('chart','Pressure-balance height chart','Required signed height versus tube radius or local plate gap. The same ideal expression applies to either dimension. A height below the immersed mouth cannot be realized inside an initially air-filled channel. The gold mouth reference is a geometric limit, not a second equilibrium.',[1.7,.6,0],system);
  const chartFrame=segmentLines(4,INK,chart),chartZero=segmentLines(1,FAINT,chart),mouthLine=segmentLines(1,GUIDE,chart),curve=lineObject(181,INK,chart),cursor=segmentLines(2,GUIDE,chart);
  fillLine(chartFrame,[[PLOT.x,PLOT.y,0],[PLOT.x+PLOT.width,PLOT.y,0],[PLOT.x+PLOT.width,PLOT.y,0],[PLOT.x+PLOT.width,PLOT.y+PLOT.height,0],[PLOT.x+PLOT.width,PLOT.y+PLOT.height,0],[PLOT.x,PLOT.y+PLOT.height,0],[PLOT.x,PLOT.y+PLOT.height,0],[PLOT.x,PLOT.y,0]]);
  fillLine(chartZero,[capillaryChartPoint(.1,0),capillaryChartPoint(1,0)]);
  for(const height of [-80,0,80,160])textLabel(chart,String(height),{height:.12,align:'right',position:[PLOT.x-.04,capillaryChartPoint(.1,height)[1],0]});
  for(const size of [.1,.5,1])textLabel(chart,fixed(size,1),{height:.12,position:[capillaryChartPoint(size,0)[0],PLOT.y-.09,0]});
  textLabel(chart,'Radius / gap (mm)',{height:.15,width:1.55,position:[0,PLOT.y-.25,0]});
  textLabel(chart,'Required height (mm)',{height:.16,width:1.7,position:[0,PLOT.y+PLOT.height+.17,0]});
  const chartNote=textLabel(chart,'',{height:.135,width:1.6,position:[0,PLOT.y-.44,0]});

  control('liquid','Liquid',...CAPILLARY_DOMAINS.liquid,CAPILLARY_DEFAULTS.liquid,'','Rounded reference properties. Mercury is a virtual comparison only.',CAPILLARY_FLUIDS.map((x,value)=>({value,label:x.name})),{primary:true});
  control('radius','Tube inner radius',...CAPILLARY_DOMAINS.radius,CAPILLARY_DEFAULTS.radius,'mm','Halving the radius doubles the ideal signed height. The glass outside diameter stays 4 mm.');
  control('depth','Immersion depth',...CAPILLARY_DOMAINS.depth,CAPILLARY_DEFAULTS.depth,'mm','Distance from the bath surface to the bottom openings. Required height stays fixed; sufficient depth can admit a nonwetting liquid.');
  control('wetting','Contact angle',...CAPILLARY_DOMAINS.wetting,CAPILLARY_DEFAULTS.wetting,'','Use reference glass or an assigned angle to isolate wetting. Assigned angles are not claims about a particular coating.',CAPILLARY_WETTING.map(x=>({...x})));
  let clock=0,lastClock=0,key='',disposed=false;
  const result=finish(values=>{
    const plan=capillaryPlan(values),now=capillaryAt(plan,clock),next=JSON.stringify(values);
    if(next!==key){
      key=next;liquidMaterial.color.set(plan.liquid.color);
      carriage.position.y=-plan.depth*MM;
      replace(lowerTube,new THREE.CylinderGeometry(A.tubeOuter*MM,A.tubeOuter*MM,(-plan.depth-A.floor)*MM,128));lowerTube.position.y=(A.floor-plan.depth)*MM/2;
      const lowerShape=polygon([[A.wedgeX,-C.narrowGap/2-A.plate],[A.wedgeX+C.wedgeWidth,-C.wideGap/2-A.plate],[A.wedgeX+C.wedgeWidth,C.wideGap/2+A.plate],[A.wedgeX,C.narrowGap/2+A.plate]]);
      const lowerGeometry=verticalExtrusion(lowerShape,-plan.depth-A.floor);replace(lowerWedge,lowerGeometry);lowerWedge.position.y=A.floor*MM;
      tubeBack.position.y=tubeFront.position.y=-plan.depth*MM;
      replace(tubeBack,capillaryWall(plan.radius,Math.PI/2));replace(tubeFront,capillaryWall(plan.radius,-Math.PI/2));
      plates.forEach(mesh=>mesh.position.y=-plan.depth*MM);
      const rim=Array.from({length:65},(_,i)=>point(plan.radius*Math.cos(2*Math.PI*i/64),C.length-plan.depth,plan.radius*Math.sin(2*Math.PI*i/64)));fillLine(tubeRim,rim);
      const profile=[[0,-plan.depth],[plan.radius,-plan.depth]];
      for(let i=0;i<=64;i++){const radius=plan.radius*(1-i/64);profile.push([radius,plan.height+capillarySurface(plan.angle,plan.radius,radius)]);}
      replace(column,new THREE.LatheGeometry(profile.map(([x,y])=>new THREE.Vector2(x*MM,y*MM)),64));column.visible=plan.enters;
      fillLine(heightMark,plan.enters&&Math.abs(plan.height)>1e-8?[point(-5,0),point(-5,plan.height),point(-7,0),point(-3,0),point(-7,plan.height),point(-3,plan.height)]:[]);
      const levelText=plan.enters?`${fixed(plan.height,1)} mm`:'No entry';levelLabel.userData.setText(levelText);levelLabel.userData.place(-1.03,(plan.enters?plan.height: -plan.depth)*MM+.12,.03);
      replace(sheet,capillarySheet(plan));sheet.visible=Boolean(sheet.geometry.attributes.position?.count);
      const edge=[];for(let i=0;i<=160;i++){const x=C.wedgeWidth*i/160,balance=capillaryWedge(plan,x);if(balance.accessible)edge.push(point(x,balance.height,capillaryGap(x)/2));}fillLine(wedgeEdge,edge);
      const a=capillaryGap(0)/2+A.plate,b=capillaryGap(C.wedgeWidth)/2+A.plate,bottom=-plan.depth,top=C.length-plan.depth;
      fillLine(plateOutline,[point(0,bottom,a),point(40,bottom,b),point(40,bottom,b),point(40,top,b),point(40,top,b),point(0,top,a),point(0,top,a),point(0,bottom,a)]);
      const x=(plan.radius-C.narrowGap)/(C.wideGap-C.narrowGap)*C.wedgeWidth;
      fillLine(match,plan.enters?[point(x,bottom,.6),point(x,capillaryWedge(plan,x).height,.6)]:[]);
      const scale=DETAIL.bore/plan.radius,points=[];
      for(let i=0;i<=128;i++){const x=-plan.radius+2*plan.radius*i/128;points.push([x*scale,capillarySurface(plan.angle,plan.radius,Math.abs(x))*scale]);}
      replace(menLiquid,new THREE.ShapeGeometry(polygon([[-DETAIL.bore,DETAIL.bottom],[DETAIL.bore,DETAIL.bottom],...points.slice().reverse()])));
      fillLine(menCurve,points.map(([x,y])=>[x,y,.001]));
      const angle=plan.angle*Math.PI/180;
      fillLine(tangents,[-1,1].flatMap(side=>[[side*DETAIL.bore,0,.002],[side*(DETAIL.bore-Math.sin(angle)*DETAIL.tangent),-Math.cos(angle)*DETAIL.tangent,.002]]));
      menTitle.userData.setText(`${fixed(plan.angle,0)}° contact angle`);
      menStatus.userData.setText(plan.enters?'Interior surface':'Required shape only');
      menScale.userData.setText(`${fixed(scale/MM,0)}× · ${fixed(2*plan.radius,2)} mm bore`);
      const plot=[];for(let i=0;i<=180;i++){const size=.1+.9*i/180,height=plan.height*plan.radius/size;plot.push(capillaryChartPoint(size,height));}fillLine(curve,plot);curve.material.color.set(plan.liquid.color);
      fillLine(mouthLine,[capillaryChartPoint(.1,-plan.depth),capillaryChartPoint(1,-plan.depth)]);
      const [cx,cy]=capillaryChartPoint(plan.radius,plan.height);fillLine(cursor,[[cx-.025,cy,.003],[cx+.025,cy,.003],[cx,cy-.025,.003],[cx,cy+.025,.003]]);
      chartNote.userData.setText(`Mouth: −${fixed(plan.depth,0)} mm`);
    }
    const emphasis=now.stage==='contact'?GUIDE:INK;tangents.material.color.set(emphasis);contactDots.forEach(dot=>dot.material.color.set(now.stage==='contact'?GUIDE:0x9caa8e));
    heightMark.material.color.set(now.stage==='height'?0xc04f35:GUIDE);match.material.color.copy(heightMark.material.color);
    const stages={ready:'Equilibrium shown · Play explains why',contact:'1. Contact angle sets the surface curvature',pressure:'2. Curvature creates a pressure difference',height:'3. Hydrostatic pressure balances the surface pressure',complete:'Guide complete · change a setting to compare'};
    liquidMaterial.color.set(plan.liquid.color);if(now.stage==='pressure')liquidMaterial.color.lerp(new THREE.Color(GUIDE),.25);
    const level=plan.enters?(Math.abs(plan.height)<1e-8?'Level with the bath':`${fixed(Math.abs(plan.height),1)} mm ${plan.height>0?'above':'below'} the bath`):'Liquid cannot enter this ideal dry tube';
    return {state:{...plan,now,clock,time:clock},readings:[
      r('Your result',level,stages[now.stage]),
      r('Guide',stages[now.stage],'The six-second guide changes emphasis, not liquid level. It is not a prediction of filling time.'),
      r('Surface pressure',`${fixed(plan.pull,1)} Pa: air minus liquid`,`2γ cos θ / r, using ${fixed(plan.angle,0)}°. Liquid pressure just below the ideal meniscus is ${fixed(plan.tube.liquidGauge,1)} Pa relative to ambient air. Both open air spaces have the same ambient pressure.`),
      r('Required height',`${fixed(plan.height,2)} mm relative to the bath`,plan.enters?'This signed Jurin height balances hydrostatic pressure. The meniscus-volume correction is neglected.':`The required level is below the mouth at −${fixed(plan.depth,0)} mm. An initially dry channel therefore cannot reach that interior equilibrium at this depth; its entrance surface is not calculated.`),
      r('Immersed opening',`${fixed(plan.depth,0)} mm below the bath`,`The bath supplies ${fixed(plan.head,1)} Pa of hydrostatic pressure at this depth. The tube and plates move together on their support; depth does not change the required signed height.`),
      r('Wedge comparison',`${fixed(capillaryWedge(plan,0).height,1)} to ${fixed(capillaryWedge(plan,40).height,1)} mm required`,`Local gaps run from 0.10 to 1.00 mm. The ideal plate-gap formula equals the tube formula when gap equals radius. Only regions with a required level above their mouth contain liquid in this model.`),
      r('Liquid reference',`${plan.liquid.name} · ${fixed(plan.liquid.tension*1000,1)} mN/m`,`Density ${plan.liquid.density} kg/m³. Rounded textbook values are not a calibrated set at one exact temperature. Assigned contact angles isolate wetting; viscosity affects motion but not this equilibrium.`),
    ]};
  });
  const render=result.update;
  result.advance=dt=>{if(Number.isFinite(dt)&&dt>0)clock=Math.min(C.duration,Number((clock+dt).toFixed(12)));return render();};
  result.animate=t=>{const dt=Number.isFinite(t)?Math.max(0,t-lastClock):0;if(Number.isFinite(t))lastClock=t;return result.advance(dt);};
  result.reset=(initial={})=>{clock=Number.isFinite(initial.time)?Math.max(0,Math.min(C.duration,initial.time)):0;lastClock=0;return render({...result.defaults,...(initial.settings||{})});};
  result.replayState=()=>({settings:result.getState().values,time:0});
  result.actions=[['Inspect: complete apparatus','capillary'],['Inspect: tube and level','tube'],['Inspect: plate wedge','wedge'],['Inspect: enlarged meniscus','meniscus'],['Inspect: pressure-balance chart','chart'],['Inspect: liquid bath','bath'],['Inspect: adjustable stand','stand']].map(([label,part])=>({label,part,view:'front',isolate:true,replay:false,run:()=>render()}));
  result.playback={label:'Explain the balance',description:'Contact angle, pressure difference, then hydrostatic balance. Levels remain at equilibrium throughout; six seconds is an explanation schedule, not a filling time.',stepLabel:'Advance guide 0.1 s',advance:result.advance,step:()=>result.advance(.1),complete:()=>clock>=C.duration,blocked:()=>false};
  result.resultPart={id:'capillary',label:'Inspect the balanced apparatus',view:'front',focusOnComplete:false,available:()=>true};
  result.covers.push(front,bathBulk,lowerTube,lowerWedge,tubeFront,plates[1]);result.initialCutaway=true;
  for(const group of [meniscus,chart]){group.userData.inspectionOnly=group===meniscus?'meniscus':'chart';group.userData.explosionExcluded=true;}
  for(const group of [stand,bath,tube,wedge]){group.userData.explosionCategory=true;group.userData.explosionRigid=true;}
  for(const group of [tube,wedge])group.traverse(o=>{if(o.userData.textLabel||o.isLine)o.userData.explosionExcluded=true;});
  result.catalogParts=result.parts.filter(p=>!['system','capillary'].includes(p.id));
  result.partViewDirections=Object.fromEntries(result.parts.map(p=>[p.id,{front:['meniscus','chart'].includes(p.id)?[0,0,3]:[.5,.3,3]}]));
  result.parts.find(p=>p.id==='meniscus').framePadding=.66;result.parts.find(p=>p.id==='chart').framePadding=.60;
  result.initialPart='capillary';result.initialView='front';result.frameVisibleOnly=true;result.framePadding=.67;result.selectionOutline=false;result.transparentBackground=true;
  result.frameBoundsForPart=id=>{
    if(id==='meniscus'||id==='chart')return new THREE.Box3().setFromObject(id==='meniscus'?meniscus:chart);
    if(id==='tube')return new THREE.Box3(new THREE.Vector3(-1.03,-.6,-.02),new THREE.Vector3(.03,2.15,.03)).applyMatrix4(kit.root.matrixWorld);
    if(id==='wedge')return new THREE.Box3(new THREE.Vector3(.4,-.6,-.01),new THREE.Vector3(.8,2.15,.01)).applyMatrix4(kit.root.matrixWorld);
    return null;
  };
  result.topology={system,bench,stand,base,rail,carriage,arm,collar,slider,pads,clampTop,bath,floor,back,left,right,front,bathSurface,bathBulk,lowerTube,lowerWedge,zero,tube,tubeBack,tubeFront,column,tubeRim,heightMark,levelLabel,wedge,plates,sheet,wedgeEdge,plateOutline,match,meniscus,menWalls,menLiquid,menCurve,tangents,contactDots,menTitle,menScale,menStatus,chart,chartFrame,chartZero,mouthLine,curve,cursor,chartNote,liquidMaterial};
  const dispose=result.dispose;result.dispose=()=>{if(!disposed){disposed=true;dispose();}};
  return result;
}

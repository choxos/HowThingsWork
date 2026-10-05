import * as THREE from 'three';
import {textLabel,solidArrow} from './scene-kit.js';
import {RGB_PRIMARIES,RGB_WHITE,rgbEncodingCurve} from './rgb-subpixels-physics.js';

const tones=[0xc14f39,0x528345,0x357386],ink=0x374736;
const label=(parent,text,x,y,width=4.7,height=.15,z=.1)=>textLabel(parent,text,{width,height,position:[x,y,z]});
function line(parent,points,color=ink){const mesh=new THREE.Line(new THREE.BufferGeometry().setFromPoints(points.map(p=>new THREE.Vector3(...p))),new THREE.LineBasicMaterial({color}));parent.add(mesh);return mesh;}
function flat(parent,width,height,position,color=0xffffff){const mesh=new THREE.Mesh(new THREE.PlaneGeometry(width,height),new THREE.MeshBasicMaterial({color,side:THREE.DoubleSide,toneMapped:false}));mesh.position.set(...position);parent.add(mesh);return mesh;}
function point(parent,color,radius=.047){const mesh=new THREE.Mesh(new THREE.SphereGeometry(radius,12,8),new THREE.MeshBasicMaterial({color,toneMapped:false}));parent.add(mesh);return mesh;}
function arrow(kit,parent,color){const mesh=solidArrow(kit,color,parent,.022);mesh.userData.setDirection(new THREE.Vector3(0,1,0));return mesh;}
const chartPoint=([x,y])=>[-1.67+3.34*x/.8,-.97+2.50*y/.8,.055];

export function createRgbSubpixelsGeometry(kit){
  const system=kit.part('system','Connected RGB pixel','An enlarged three-aperture region of a generic TN LCD. Light comes from the common backlight; independent pixel voltages control the three filtered channels.');
  const make=(id,name,description,parent=system)=>kit.part(id,name,description,[0,0,0],parent);
  const support=make('support','Support and illumination','A retaining frame holds the common light source and optical stack.');support.userData.explosionCategory=true;
  const frame=make('frame','Retaining frame','Holds the enlarged three-aperture region together. This frame and all layer thicknesses are illustrative.',support);
  for(const y of [-.58,1.34])kit.box([3.86,.15,1.10],[0,y,-.04],'ink',frame);
  for(const x of [-1.855,1.855])kit.box([.15,1.79,1.10],[x,.38,-.04],'ink',frame);
  const backlight=make('backlight','Common white backlight','Supplies light behind all three apertures. Its normalized level changes illumination without changing stored voltage.',support);
  kit.box([3.56,1.76,.08],[0,.38,-.57],'cream',backlight);
  const whiteLight=flat(backlight,3.54,1.74,[0,.38,-.523]);
  const guide=make('light-guide','Light guide and diffuser','Distributes illumination across the pixel region. A detailed scattering solution is not modeled.',support);
  kit.box([3.55,1.75,.065],[0,.38,-.473],'blue',guide);
  const stack=make('optical-stack','Shared optical layers','Crossed polarizers surround the glass, patterned electrodes, alignment layers, liquid crystal and color-filter mosaic.');stack.userData.explosionCategory=true;
  function layer(id,name,description,z,depth,tone){const p=make(id,name,description,stack);kit.box([3.55,1.75,depth],[0,.38,z],tone,p);return p;}
  const rearPolarizer=layer('rear-polarizer','Rear polarizer','Selects the input linear polarization; its axis is perpendicular to the front analyzer.',-.418,.025,'ink');
  const rearGlass=layer('rear-glass','Rear glass substrate','Supports the pixel electrodes and thin-film transistor pattern.',-.344,.11,'blue');
  const electrodes=make('pixel-electrodes','Three pixel electrodes','Each patterned electrode receives its own data voltage. All three share the same row-select pulse.',stack);
  const xs=[-1.14,0,1.14];
  const pads=xs.map(x=>kit.box([1.07,1.68,.024],[x,.38,-.269],'metal',electrodes));
  const rearAlignment=layer('rear-alignment','Rear alignment layer','Anchors the director at the rear surface.',-.243,.018,'wood');
  const crystal=make('liquid-crystal','Three liquid-crystal shutters','The optical calculation follows a director profile for each color channel. Each voltage controls transmission; the liquid crystal does not create red, green or blue light.',stack);
  const cellSheets=xs.map(x=>{const mesh=kit.box([1.07,1.68,.265],[x,.38,-.096],'gold',crystal);mesh.material=new THREE.MeshBasicMaterial({color:0xe3b45e,transparent:true,opacity:.25,depthWrite:false});return mesh;});
  const seal=make('seal','Seal and gap spacers','Retain the liquid crystal and establish its physical gap. The drawn stack is enlarged independently of the 3–6 micrometer gap.',stack);
  for(const y of [-.495,1.255])kit.box([3.55,.028,.265],[0,y,-.096],'ink',seal);
  for(const x of [-1.762,1.762])kit.box([.027,1.75,.265],[x,.38,-.096],'ink',seal);
  for(const x of [-1.70,-.57,.57,1.70])kit.disk(.018,.265,[x,1.19,-.096],'cream',seal);
  const frontAlignment=layer('front-alignment','Front alignment layer','Its anchoring direction is turned 90 degrees from the rear direction.',.052,.018,'wood');
  const common=layer('common-electrode','Transparent common electrode','Provides the shared reference voltage for all three liquid-crystal capacitors.',.078,.022,'metal');
  const filters=make('filter-mosaic','RGB filter mosaic and black matrix','Three colored apertures occupy one common patterned layer. The dark matrix separates them. Aperture widths and filter spectra are teaching choices.',stack);
  kit.box([3.55,1.75,.024],[0,.38,.106],'ink',filters);
  const filterMeshes=xs.map((x,i)=>kit.box([1.06,1.68,.015],[x,.38,.127],tones[i],filters));
  const frontGlass=layer('front-glass','Front glass substrate','Supports the color-filter mosaic and common electrode.',.199,.11,'blue');
  const analyzer=layer('front-analyzer','Front analyzer and transmitted apertures','The crossed analyzer turns polarization changes into intensity changes. The three visible windows show the calculated RGB transmission.',.278,.025,'ink');
  const windows=xs.map(x=>flat(analyzer,1.06,1.68,[x,.38,.293]));
  const electronics=make('electronics','Row and data circuit','One row-select signal controls three TFTs; separate data lines write three voltages. Storage and LC capacitance share the common reference.');electronics.userData.explosionCategory=true;
  const board=make('board','Illustrative driver support','Supports an enlarged circuit diagram of the three subpixel connections. This is not a manufacturing layout.',electronics);kit.box([3.56,.62,.11],[0,-1.035,-.36],'leaf',board);
  const data=make('data-lines','Three independent data lines','Separate red, green and blue data voltages arrive at the three thin-film transistors.',electronics);
  const dataEndpoints=xs.map(x=>[[x,-1.25,-.245],[x,-.89,-.245]]);
  const dataRods=dataEndpoints.map((ends,i)=>kit.rod(...ends,.020,tones[i],data));
  const tfts=make('tfts','Three thin-film transistors','A common gate pulse selects all three subpixels together. Turning a transistor off does not erase its stored pixel voltage.',electronics);
  const switches=xs.map(x=>kit.box([.16,.15,.07],[x,-.84,-.245],'ink',tfts));
  const pixelConnections=xs.map(x=>[[x,-.765,-.245],[x,-.45,-.269]]);
  const pixelRods=pixelConnections.map(ends=>kit.rod(...ends,.016,'metal',tfts));
  const gate=make('gate-line','Common row gate line','Selects the red, green and blue transistors during the same row interval.',electronics);const gateRod=kit.rod([-1.70,-.82,-.215],[1.70,-.82,-.215],.014,'gold',gate);gateRod.material=gateRod.material.clone();
  const storage=make('storage','Three storage capacitors','Each written pixel voltage is retained ideally between writes. Leakage, feedthrough and changing LC capacitance are omitted.',electronics);
  for(const x of xs){
    kit.rod([x,-.75,-.23],[x+.29,-.75,-.18],.012,'metal',storage);kit.rod([x+.29,-.75,-.18],[x+.29,-.98,-.18],.012,'metal',storage);
    for(const y of [-.98,-1.08])kit.box([.24,.025,.045],[x+.29,y,-.18],'metal',storage);
    kit.rod([x+.29,-1.08,-.18],[x+.29,-1.28,-.18],.012,'metal',storage);
  }
  const reference=make('common-feed','Common reference connection','Connects the storage capacitors and common electrode to the same ideal reference.',electronics);
  kit.rod([-1.65,-1.28,-.18],[1.65,-1.28,-.18],.014,'ink',reference);
  kit.rod([1.65,-1.28,-.18],[1.65,-.50,.078],.014,'ink',reference);
  const guides=new THREE.Group();guides.userData.explosionExcluded=true;system.add(guides);
  label(guides,'RGB subpixels · one enlarged LCD pixel',0,1.90,4.9,.20,.5);
  xs.forEach((x,i)=>label(guides,['Red','Green','Blue'][i],x,1.63,1.06,.14,.52));
  const mixture=flat(guides,1.14,.48,[.65,-1.78,.3]);label(guides,'Computed mixture',-1.05,-1.78,1.65,.15,.36);
  const status=label(guides,'',0,-2.17,4.85,.15,.34);
  label(guides,'Enlarged layers · the eye combines unresolved light',0,-2.46,4.95,.13,.34);
  for(const mesh of guides.children)if(mesh.material)mesh.material.side=THREE.FrontSide;
  function detail(id,name,description){const p=make(id,name,description);p.userData.inspectionOnly=id;p.userData.explosionExcluded=true;return p;}

  const optics=detail('optics-detail','Three filtered optical paths','An enlarged path for each color. Rods follow the calculated director; arrow size is a normalized intensity cue. The filters remain separate while their light adds to the mixed color.');
  label(optics,'One white source; three controlled filtered paths',0,1.96,5.0,.19);
  const opticalChannels=xs.map((_,i)=>{
    const x=(i-1)*1.61,group=new THREE.Group();group.position.x=x;optics.add(group);
    const rear=kit.box([.97,.038,.65],[0,-.7,0],'blue',group),front=kit.box([.97,.038,.65],[0,.7,0],'blue',group);
    const rearAxis=kit.rod([-.42,0,0],[.42,0,0],.015,'ink',rear),frontAxis=kit.rod([0,0,-.30],[0,0,.30],.015,'ink',front);
    rearAxis.position.y=.040;frontAxis.position.y=.040;
    const filter=kit.box([.91,.045,.58],[0,.80,0],tones[i],group);
    const rods=Array.from({length:9},()=>kit.rod([0,0,0],[.36,0,0],.018,'gold',group));
    const incoming=arrow(kit,group,0xe3b45e),outgoing=arrow(kit,group,tones[i]);
    label(group,['Red','Green','Blue'][i],0,1.59,1.36,.16);
    const lightLabel=label(group,'',0,-1.56,1.48,.14),voltageLabel=label(group,'',0,-1.86,1.48,.13);
    return {group,rear,front,rearAxis,frontAxis,filter,rods,incoming,outgoing,lightLabel,voltageLabel};
  });
  const opticalFooter=label(optics,'',0,-2.15,4.95,.13);

  const encoding=detail('encoding-detail','Encoded codes and linear light','The sRGB curve maps an encoded code to a linear fraction of the white-minus-black target range. It does not predict that the liquid crystal has already reached that target.');
  label(encoding,'Half the code is not half the light',0,1.91,4.95,.20);
  const curvePoint=(code,light)=>[-1.66+3.32*code/255,-.99+2.40*light,.04];
  for(const share of [0,.25,.5,.75,1]){line(encoding,[curvePoint(0,share),curvePoint(255,share)],0xb4c5b0);label(encoding,`${Math.round(share*100)}%`,-2.00,-.99+2.4*share,.55,.12);}
  line(encoding,rgbEncodingCurve().map(p=>curvePoint(p.code,p.linear)),ink);
  for(const code of [0,128,188,255])label(encoding,String(code),curvePoint(code,0)[0],-1.21,.55,.12);
  label(encoding,'Encoded sRGB code',0,-1.43,3.8,.14);
  const codeMarkers=tones.map(t=>point(encoding,t,.055));
  const codeReadings=tones.map((_,i)=>label(encoding,'',(i-1)*1.59,-1.74,1.49,.13));
  label(encoding,'Linear target range excludes the finite LCD black floor',0,-2.04,4.98,.13);

  const color=detail('color-detail','Additive color and chromaticity','Linear RGB intensities add as CIE XYZ tristimulus values. The triangle shows the assigned sRGB primaries, not all colors a person can see.');
  label(color,'Three primaries define a limited color gamut',0,1.93,5.0,.19);
  for(const v of [0,.2,.4,.6,.8]){
    line(color,[chartPoint([v,0]),chartPoint([v,.8])],0xd5ddca);line(color,[chartPoint([0,v]),chartPoint([.8,v])],0xd5ddca);
    label(color,v.toFixed(1),chartPoint([v,0])[0],-1.20,.47,.12);label(color,v.toFixed(1),-1.97,chartPoint([0,v])[1],.47,.12);
  }
  line(color,[...RGB_PRIMARIES,RGB_PRIMARIES[0]].map(chartPoint),ink);
  const vertices=RGB_PRIMARIES.map((xy,i)=>{const dot=point(color,tones[i],.045);dot.position.set(...chartPoint(xy));label(color,['R','G','B'][i],dot.position.x+.12,dot.position.y+.12,.35,.13,.08);return dot;});
  const [wx,wy]=chartPoint(RGB_WHITE);line(color,[[wx-.055,wy,.06],[wx+.055,wy,.06]],ink);line(color,[[wx,wy-.055,.06],[wx,wy+.055,.06]],ink);
  const current=point(color,0xe3b45e,.055),target=new THREE.Mesh(new THREE.RingGeometry(.067,.085,24),new THREE.MeshBasicMaterial({color:ink,side:THREE.DoubleSide,toneMapped:false}));color.add(target);
  label(color,'CIE x',0,-1.45,1.2,.14);label(color,'CIE y',-2.01,1.74,.7,.13);
  const colorReading=label(color,'',0,-1.74,4.99,.14);
  label(color,'Filled: current · ring: steady target · +: D65 white',0,-2.05,5.03,.13);
  return {system,support,frame,backlight,whiteLight,guide,stack,rearPolarizer,rearGlass,electrodes,pads,rearAlignment,crystal,cellSheets,seal,frontAlignment,common,filters,filterMeshes,frontGlass,analyzer,windows,electronics,board,data,dataEndpoints,dataRods,tfts,switches,pixelConnections,pixelRods,gate,gateRod,storage,reference,guides,mixture,status,optics,opticalChannels,opticalFooter,encoding,codeMarkers,codeReadings,color,vertices,current,target,colorReading};
}

export function updateRgbSubpixelsGeometry(p,s){
  const c=s.center,light=c.illuminated;
  p.whiteLight.material.color.setRGB(s.backlight,s.backlight,s.backlight);
  p.windows.forEach((mesh,i)=>{const rgb=[0,0,0];rgb[i]=light[i];mesh.material.color.setRGB(...rgb);});
  p.mixture.material.color.setRGB(...light);
  p.gateRod.material.color.setHex(s.scanRow===135?0xe3b45e:0xae8056);
  p.status.userData.setText(`${s.done?'Record complete':s.values.addressing===2?'Gate pulses disabled':c.writes?'Three stored voltages':'Waiting for row write'} · ${(s.time*1000).toFixed(1)} ms`);
  const halfGap=.125*s.values.gap;
  p.opticalChannels.forEach((channel,i)=>{
    channel.rear.position.y=-halfGap-.12;channel.front.position.y=halfGap+.20;channel.filter.position.y=halfGap+.12;
    channel.rods.forEach((rod,j)=>{const theta=s.directors[i].theta[j*10],phi=s.directors[i].phi[j*10];rod.position.set(0,-halfGap+2*halfGap*j/8,0);rod.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),new THREE.Vector3(Math.cos(theta)*Math.cos(phi),Math.sin(theta),Math.cos(theta)*Math.sin(phi)));});
    channel.incoming.position.set(0,-1.30,0);channel.incoming.userData.setLength(Math.max(.02,1.15-halfGap));channel.incoming.visible=s.backlight>0;channel.incoming.scale.set(s.backlight,1,s.backlight);
    channel.outgoing.position.set(0,halfGap+.28,0);channel.outgoing.userData.setLength(.34*Math.min(1,light[i]));channel.outgoing.visible=light[i]>1e-8;
    channel.lightLabel.userData.setText(`${['R','G','B'][i]} ${(100*light[i]).toFixed(2)}% light`);channel.voltageLabel.userData.setText(`${c.held[i].toFixed(3)} V held`);
    p.codeMarkers[i].position.set(-1.66+3.32*s.encodedFractions[i],-.99+2.4*s.targetLinear[i],.10+i*.08);
    p.codeReadings[i].userData.setText(`${['R','G','B'][i]} ${c.codes[i]} → ${(100*s.targetLinear[i]).toFixed(1)}%`);
  });
  p.opticalFooter.userData.setText(`Gap ${s.values.gap.toFixed(1)} μm · crossed axes · backlight ${s.values.backlight}%`);
  for(const [mesh,xy]of [[p.current,s.color.xy],[p.target,s.targetColor.xy]]){mesh.visible=xy!==null;if(xy)mesh.position.set(...chartPoint(xy));}
  p.current.position.z=.10;p.target.position.z=.09;
  p.colorReading.userData.setText(s.color.xy?`Current x ${s.color.xy[0].toFixed(4)}, y ${s.color.xy[1].toFixed(4)} · relative Y ${(100*s.color.luminance).toFixed(2)}%`:'No light: chromaticity is undefined');
}

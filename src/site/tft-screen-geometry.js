import * as THREE from 'three';
import {textLabel,solidArrow} from './scene-kit.js';
import {TFT,TFT_RECORD,tftPixelAt,tftTrace,tftVoltageSteps} from './tft-screen-physics.js';

const tones={ink:0x374736,grid:0xb4c5b0,red:0xc14f39,green:0x528345,blue:0x357386,gold:0xe3b45e};
const label=(parent,text,x,y,width=4.6,height=.16,z=.12)=>textLabel(parent,text,{width,height,position:[x,y,z]});
function line(parent,points,color=tones.ink){const object=new THREE.Line(new THREE.BufferGeometry().setFromPoints(points.map(p=>new THREE.Vector3(...p))),new THREE.LineBasicMaterial({color}));parent.add(object);return object;}
function setLine(object,points){const old=object.geometry.attributes.position;if(old.count!==points.length){object.geometry.dispose();object.geometry=new THREE.BufferGeometry().setFromPoints(points.map(p=>new THREE.Vector3(...p)));}else{points.forEach((p,i)=>old.setXYZ(i,...p));old.needsUpdate=true;}object.geometry.computeBoundingSphere();object.geometry.computeBoundingBox();}
function flat(parent,width,height,position,color=0xffffff){const mesh=new THREE.Mesh(new THREE.PlaneGeometry(width,height),new THREE.MeshBasicMaterial({color,side:THREE.DoubleSide,toneMapped:false}));mesh.position.set(...position);parent.add(mesh);return mesh;}
function screenTexture(){const bytes=new Uint8Array(TFT.columns*TFT.rows*4),texture=new THREE.DataTexture(bytes,TFT.columns,TFT.rows);texture.colorSpace=THREE.SRGBColorSpace;texture.magFilter=texture.minFilter=THREE.NearestFilter;texture.generateMipmaps=false;return {bytes,texture};}
function arrow(kit,parent,x,y,length,color=tones.gold){const object=solidArrow(kit,color,parent,.023);object.position.set(x,y,.08);object.userData.setDirection(new THREE.Vector3(1,0,0));object.userData.setLength(length);return object;}

export function createTftScreenGeometry(kit){
  const system=kit.part('system','Connected LCD screen','A generic edge-lit, normally-white twisted-nematic screen. Thin layers are enlarged in depth so their order can be inspected.');
  const make=(id,name,description,parent=system)=>kit.part(id,name,description,[0,0,0],parent);
  const enclosure=make('enclosure','Screen frame and reflector','The bezel retains the optical stack; a rear reflector returns light toward the viewer.');enclosure.userData.explosionCategory=true;
  const frame=make('frame','Retaining frame','Four rails enclose the optical stack. The depth is exaggerated for teaching.',enclosure);
  for(const y of [-1.46,1.46])kit.box([5.20,.18,1.04],[0,y,0],'ink',frame);
  for(const x of [-2.51,2.51])kit.box([.18,2.76,1.04],[x,0,0],'ink',frame);
  const reflector=make('reflector','Rear reflector','Reflects light leaving the back of the guide toward the liquid-crystal stack.',enclosure);kit.box([4.84,2.76,.04],[0,0,-.48],'cream',reflector);
  const backlight=make('backlight','Edge-lit backlight','White LEDs feed a light guide. A diffuser smooths the emerging illumination. Brightness is normalized, not a wattage prediction.');backlight.userData.explosionCategory=true;
  const leds=make('leds','White LED strip','This illustrative strip shines into the left edge of the guide. The exact package count is not used to infer electrical power.',backlight);
  kit.box([.12,2.70,.13],[-2.36,0,-.36],'leaf',leds);
  const ledMeshes=[];for(let i=0;i<10;i++){const mesh=kit.box([.09,.11,.10],[-2.27,-1.20+i*.267,-.36],'cream',leds);mesh.material=new THREE.MeshBasicMaterial({color:0xffffff,toneMapped:false});ledMeshes.push(mesh);}
  const guide=make('light-guide','Light guide and extraction pattern','Light travels across the clear guide and is scattered out by its extraction pattern.',backlight);kit.box([4.50,2.72,.14],[.08,0,-.36],'blue',guide);
  for(let i=0;i<12;i++)for(let j=0;j<7;j++)kit.disk(.013,.004,[-2.03+i*.38,-1.17+j*.39,-.287],'cream',guide);
  const diffuser=make('diffuser','Diffuser film','Spreads the extracted illumination before it reaches the rear polarizer.',backlight);kit.box([4.80,2.72,.03],[0,0,-.267],'cream',diffuser);
  const cell=make('cell','Active-matrix liquid-crystal stack','Glass, electrodes, alignment layers, liquid crystal and filters are clamped together between two crossed polarizers.');cell.userData.explosionCategory=true;
  const layer=(id,name,description,z,depth,tone)=>{const object=make(id,name,description,cell);kit.box([4.80,2.72,depth],[0,0,z],tone,object);return object;};
  const rearPolarizer=layer('rear-polarizer','Rear polarizer','Selects one linear polarization from the backlight. Its axis is crossed with the front analyzer.',-.230,.025,'ink');
  const rearGlass=layer('rear-glass','Rear glass substrate','Supports the thin-film transistor matrix and transparent pixel electrodes.',-.164,.10,'blue');
  const electrodes=layer('pixel-electrodes','TFT matrix and pixel electrodes','Gate lines select a row. Data lines write voltages through thin-film transistors into storage and liquid-crystal capacitances.',-.094,.028,'leaf');
  for(let i=0;i<17;i++)kit.box([.009,2.68,.006],[-2.28+i*.285,0,-.076],'gold',electrodes);
  for(let j=0;j<9;j++)kit.box([4.76,.008,.006],[0,-1.28+j*.32,-.074],'gold',electrodes);
  for(let i=0;i<16;i++)for(let j=0;j<8;j++){
    const x=-2.28+i*.285,y=-1.28+j*.32;
    kit.box([.045,.055,.012],[x+.030,y+.033,-.066],'ink',electrodes);
    kit.box([.18,.20,.004],[x+.15,y+.18,-.071],'metal',electrodes);
  }
  const rearAlignment=layer('rear-alignment','Rear alignment layer','Anchors molecular orientation at the rear glass surface.',-.064,.016,'wood');
  const liquid=layer('liquid-crystal','Twisted liquid-crystal layer','The director rotates through the cell at low field and tilts under electric drive. The gap control sets a physical 3–6 micrometer layer; its drawn thickness is enlarged.',.004,.112,'gold');
  const seal=make('seal','Perimeter seal and spacers','A sealed border and distributed spacers hold the glass apart and retain the liquid crystal.',cell);
  for(const y of [-1.35,1.35])kit.box([4.80,.022,.112],[0,y,.004],'ink',seal);
  for(const x of [-2.39,2.39])kit.box([.022,2.72,.112],[x,0,.004],'ink',seal);
  for(const x of [-1.9,0,1.9])for(const y of [-1,1])kit.disk(.012,.112,[x,y,.004],'cream',seal);
  const frontAlignment=layer('front-alignment','Front alignment layer','Its anchoring direction is turned 90 degrees from the rear direction.',.068,.016,'wood');
  const common=layer('common-electrode','Transparent common electrode','Provides the common voltage reference across the liquid-crystal layer.',.087,.022,'metal');
  const filters=layer('color-filters','Red, green and blue filters','Each pixel has three filtered apertures. Stripe pitch is enlarged in this construction view.',.113,.024,'ink');
  for(let i=0;i<48;i++)kit.box([.088,2.66,.008],[-2.35+i*.1,0,.129],[tones.red,tones.green,tones.blue][i%3],filters);
  const frontGlass=layer('front-glass','Front glass substrate','Carries the color filter and common electrode in this generic stack.',.187,.10,'blue');
  const analyzer=layer('front-polarizer','Front analyzer and visible picture','The crossed front polarizer converts the liquid crystal’s polarization change into transmitted intensity. The image uses the calculated row responses.',.254,.024,'ink');
  const display=screenTexture(),picture=flat(analyzer,4.80,2.72,[0,0,.269]);picture.material.map=display.texture;picture.material.side=THREE.FrontSide;picture.material.addEventListener('dispose',()=>display.texture.dispose());
  const electronics=make('electronics','Drive electronics and connections','Timing, bias, source and gate circuits work together to address the optical stack.');electronics.userData.explosionCategory=true;
  const board=make('board','Timing and bias board','A controller times the row writes. Bias and reference circuits supply the driver voltage levels.',electronics);kit.box([3.60,.54,.10],[0,-1.81,-.35],'leaf',board);
  for(const [x,w]of [[-1.15,.55],[0,.65],[1.12,.42]]){kit.box([w,.30,.09],[x,-1.81,-.25],'ink',board);for(const side of [-1,1])for(let j=0;j<6;j++)kit.box([.025,.06,.025],[x-w*.4+j*w*.16,-1.81+side*.18,-.25],'metal',board);}
  const source=make('source-driver','Source driver and data ribbon','Source outputs set the RGB subpixel voltages in parallel for the selected row.',electronics);kit.box([4.28,.18,.08],[0,-1.36,-.081],'ink',source);
  const sourceEndpoints=[new THREE.Vector3(0,-1.58,-.305),new THREE.Vector3(0,-1.36,-.081)],sourceDelta=sourceEndpoints[1].clone().sub(sourceEndpoints[0]);
  const sourceRibbon=kit.box([3.28,sourceDelta.length(),.025],sourceEndpoints[0].clone().add(sourceEndpoints[1]).multiplyScalar(.5).toArray(),'gold',source);sourceRibbon.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),sourceDelta.normalize());
  const gate=make('gate-driver','Gate driver and row ribbon','Gate pulses turn on one row of thin-film transistors at a time.',electronics);kit.box([.15,2.38,.065],[-2.35,0,-.072],'ink',gate);
  kit.box([.10,1.72,.025],[-2.57,-.89,-.20],'gold',gate);kit.box([.91,.10,.025],[-2.16,-1.70,-.20],'gold',gate);kit.box([.30,.10,.16],[-2.44,-.08,-.15],'gold',gate);kit.box([.12,.18,.15],[-1.76,-1.72,-.26],'gold',gate);
  const power=make('backlight-feed','Backlight power connection','A separate connection drives the white LEDs; changing this drive changes illumination without changing stored pixel voltage.',electronics);
  kit.tube([[-1.62,-1.87,-.29],[-2.11,-1.90,-.37],[-2.33,-1.55,-.36],[-2.36,-1.32,-.36]],.016,'red',power);
  const guides=new THREE.Group();guides.userData.explosionExcluded=true;system.add(guides);
  label(guides,'LCD screen · connected layers',0,1.82,5.2,.21,.35);
  const status=label(guides,'',0,-2.36,5.4,.18,.36);
  label(guides,'Layer depth enlarged · rotate for the drive board',0,-2.64,5.4,.16,.36);
  for(const mesh of guides.children)mesh.material.side=THREE.FrontSide;
  function detail(id,name,description){const object=make(id,name,description);object.userData.inspectionOnly=id;object.userData.explosionExcluded=true;return object;}
  const optics=detail('optics-detail','Polarization and liquid crystal','Enlarged center green subpixel. Rods follow the calculated director profile; arrow width is a normalized light cue, not a field solution.');
  label(optics,'Voltage changes polarization, then brightness',0,1.78,4.8,.20);
  const opticalStatus=label(optics,'',0,1.45,4.7,.15);
  for(const x of [-1.35,1.25])kit.box([.05,1.32,.8],[x,.26,0],'blue',optics);
  const polarizerAxes=[];
  for(let i=0;i<5;i++){polarizerAxes.push(kit.rod([-1.31,-.36,-.32+i*.16],[-1.31,.87,-.32+i*.16],.012,'ink',optics));polarizerAxes.push(kit.rod([1.29,-.24+i*.24,-.38],[1.29,-.24+i*.24,.38],.012,'ink',optics));}
  label(optics,'Rear polarizer',-1.45,-.68,1.35,.13);label(optics,'Front analyzer',1.39,-.68,1.4,.13);label(optics,'Green-filtered output',1.4,-1.02,1.75,.13);
  label(optics,'Twisted molecular directors',0,.98,2.35,.14);
  const directorRods=[];for(let i=0;i<=8;i++)directorRods.push(kit.rod([-.91+i*.225,.1,0],[-.91+i*.225,.5,0],.020,'gold',optics));
  const incoming=arrow(kit,optics,-2.16,.25,.62),outgoing=arrow(kit,optics,1.39,.25,.66,tones.green);
  const opticalReading=label(optics,'',0,-1.37,4.7,.17);
  label(optics,'Normal incidence · crossed axes · gap enlarged',0,-1.74,4.7,.14);

  const matrix=detail('matrix-detail','Row selection and stored voltage','An enlarged center green subpixel circuit. The gate pulse writes the data voltage; ideal storage holds it when the transistor turns off.');
  label(matrix,'Write a row, then hold its voltage',0,1.78,4.8,.20);
  const gateStatus=label(matrix,'',0,1.43,4.8,.15);
  line(matrix,[[-1.87,.57,-.02],[-.59,.57,-.02]],tones.blue);line(matrix,[[-.24,.57,-.02],[1.34,.57,-.02]],tones.blue);
  const switchArm=line(matrix,[[-.59,.57,.03],[-.24,.80,.03]],tones.gold);
  line(matrix,[[-.43,1.02,0],[-.43,.85,0]],tones.gold);label(matrix,'Gate',-.45,1.16,.75,.13);
  label(matrix,'Data line',-1.51,.91,1.10,.14);label(matrix,'TFT',-.44,.31,.67,.14);
  for(const x of [.35,1.34]){line(matrix,[[x,.57,0],[x,.04,0]],tones.blue);line(matrix,[[x,-.17,0],[x,-.66,0]],tones.blue);line(matrix,[[x-.19,.04,0],[x+.19,.04,0]],tones.ink);line(matrix,[[x-.19,-.17,0],[x+.19,-.17,0]],tones.ink);}
  line(matrix,[[.35,-.66,0],[1.90,-.66,0]],tones.ink);label(matrix,'Common reference',.98,-.93,2.12,.14);
  label(matrix,'Storage',.32,-.40,.9,.12);label(matrix,'LC cell',1.35,-.40,.86,.12);
  const heldLabel=label(matrix,'',0,-1.31,4.7,.17),writeLabel=label(matrix,'',0,-1.68,4.7,.14);

  const rgb=detail('rgb-detail','RGB apertures and mixed pixel','The three filtered channels add in linear light. Code values are sRGB encoded; 128 is about 21.6% of the white-minus-black range, not half the light.');
  label(rgb,'Three apertures make one colored pixel',0,1.78,4.8,.20);
  const channelMeshes=[],channelLabels=[],codeLabels=[];
  for(let i=0;i<3;i++){const x=-1.30+i*1.30;channelMeshes.push(flat(rgb,.72,.84,[x,.75,0]));label(rgb,['Red','Green','Blue'][i],x,1.34,1.15,.15);channelLabels.push(label(rgb,'',x,.12,1.25,.14));codeLabels.push(label(rgb,'',x,-.18,1.25,.12));}
  const mixed=flat(rgb,1.14,.53,[0,-.91,0]);label(rgb,'Mixed pixel',-1.38,-.90,1.2,.15);
  const rgbStatus=label(rgb,'',0,-1.48,4.8,.15);label(rgb,'Light percentages use each channel’s assigned white',0,-1.81,4.8,.13);

  const response=detail('response-detail','Optical response and polarity','Center-pixel RGB light above; center green stored voltage below. A finished record need not mean full optical equilibrium.');
  label(response,'Stored voltage changes fast; liquid crystal follows',0,1.82,4.95,.19);
  for(const y of [.3,.8,1.3])line(response,[[-1.68,y,0],[1.72,y,0]],tones.grid);
  label(response,'100%',-1.99,1.30,.47,.11);label(response,'0%',-1.98,.3,.4,.11);
  const traces=[tones.red,tones.green,tones.blue].map(t=>line(response,Array.from({length:201},()=>[-1.68,.3,.03]),t));
  label(response,'R / G / B light · % of channel white',0,1.53,4.3,.13);
  for(const y of [-1.08,-.69,-.30])line(response,[[-1.68,y,0],[1.72,y,0]],tones.grid);
  label(response,'+5 V',-1.99,-.30,.47,.11);label(response,'−5 V',-1.99,-1.08,.47,.11);
  const voltageTrace=line(response,[[-1.68,-1.08,.04],[1.72,-1.08,.04]],tones.gold);
  label(response,'0 ms',-1.66,-1.33,.6,.12);label(response,'199.5 ms',1.56,-1.33,.94,.12);
  const cursor=line(response,[[-1.68,1.30,.10],[-1.68,-1.08,.10]],tones.ink);
  const responseStatus=label(response,'',0,-1.68,4.8,.14);
  return {system,enclosure,frame,reflector,backlight,leds,ledMeshes,guide,diffuser,cell,rearPolarizer,rearGlass,electrodes,rearAlignment,liquid,seal,frontAlignment,common,filters,frontGlass,analyzer,display,picture,electronics,board,source,sourceRibbon,sourceEndpoints,gate,power,guides,status,optics,polarizerAxes,opticalStatus,directorRods,incoming,outgoing,opticalReading,matrix,gateStatus,switchArm,heldLabel,writeLabel,rgb,channelMeshes,channelLabels,codeLabels,mixed,rgbStatus,response,traces,voltageTrace,cursor,responseStatus,tracePlan:null,trace:null};
}

export function updateTftScreenGeometry(p,s,plan){
  const c=s.center,bytes=p.display.bytes;
  for(const row of s.rows)for(const segment of row.segments){const rgb=segment.rgb.map(v=>Math.round(v*255));for(let x=segment.from;x<segment.to;x++){const at=((TFT.rows-1-row.row)*TFT.columns+x)*4;bytes[at]=rgb[0];bytes[at+1]=rgb[1];bytes[at+2]=rgb[2];bytes[at+3]=255;}}
  p.display.texture.needsUpdate=true;p.ledMeshes.forEach(mesh=>mesh.material.color.setRGB(s.backlight,s.backlight,s.backlight));
  const phase=s.values.addressing===2?'Gate pulses disabled':s.done?'Record complete':s.scanRow===null?'Between row writes':`Writing row ${s.scanRow+1} of 272`;
  p.status.userData.setText(`${phase} · ${(s.time*1000).toFixed(1)} ms`);
  p.opticalStatus.userData.setText(`Center green: ${c.held[1].toFixed(2)} V · gap ${s.values.gap.toFixed(1)} μm`);
  p.directorRods.forEach((rod,i)=>{const theta=s.directors[1].theta[i*10],phi=s.directors[1].phi[i*10],direction=new THREE.Vector3(Math.sin(theta),Math.cos(theta)*Math.cos(phi),Math.cos(theta)*Math.sin(phi));rod.position.set(-.91+i*.225,.30,0);rod.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),direction);});
  p.incoming.visible=s.backlight>0;p.incoming.scale.set(Math.max(.02,s.backlight),1,Math.max(.02,s.backlight));p.outgoing.visible=c.illuminated[1]>1e-7;p.outgoing.scale.set(Math.max(.02,c.illuminated[1]),1,Math.max(.02,c.illuminated[1]));
  p.opticalReading.userData.setText(`Green output ${(100*c.illuminated[1]).toFixed(2)}% · backlight ${s.values.backlight}%`);
  const on=s.scanRow===135;
  setLine(p.switchArm,[[-.59,.57,.03],[-.24,on?.57:.80,.03]]);
  p.gateStatus.userData.setText(on?'Center row selected: all column voltages write together':'Center row gate off: pixel voltage remains stored');
  p.heldLabel.userData.setText(`Center green holds ${c.held[1].toFixed(3)} V · ${c.writes} writes`);
  p.writeLabel.userData.setText(s.values.addressing===2?'Prepared black charge stays; target data never writes':s.values.addressing===1?'One frame writes; ideal storage then holds indefinitely':'Next frame reverses voltage sign, preserving target brightness');
  p.channelMeshes.forEach((mesh,i)=>{const rgb=[0,0,0];rgb[i]=c.illuminated[i];mesh.material.color.setRGB(...rgb);p.channelLabels[i].userData.setText(`${(100*c.illuminated[i]).toFixed(2)}% light`);p.codeLabels[i].userData.setText(`Target code ${c.codes[i]}`);});
  p.mixed.material.color.setRGB(...c.illuminated);p.rgbStatus.userData.setText(`Computed center · target ${c.codes.join(' / ')} · backlight ${s.values.backlight}%`);
  if(p.tracePlan!==plan){p.trace=tftTrace(plan);p.tracePlan=plan;}
  p.traces.forEach((trace,i)=>setLine(trace,p.trace.map(point=>[-1.68+3.4*point.time/TFT_RECORD,.3+Math.min(1.06,point.light[i]),.03+i*.005])));
  setLine(p.voltageTrace,tftVoltageSteps(plan).map(point=>[-1.68+3.4*point.time/TFT_RECORD,-.69+.078*point.voltage,.04]));
  const x=-1.68+3.4*s.time/TFT_RECORD;setLine(p.cursor,[[x,1.30,.10],[x,-1.08,.10]]);
  p.responseStatus.userData.setText(`${(s.time*1000).toFixed(1)} ms · green ${c.held[1].toFixed(2)} V · ${c.writes} writes`);
}

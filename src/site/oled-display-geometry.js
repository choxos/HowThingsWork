import * as THREE from 'three';
import {textLabel,solidArrow} from './scene-kit.js';

const ink=0x374736,tones=[0xc14f39,0x528345,0x357386];
const label=(p,text,x,y,width=4.8,height=.15,z=.12,color='#374736')=>textLabel(p,text,{width,height,position:[x,y,z],color});
function line(parent,points,color=ink){const m=new THREE.Line(new THREE.BufferGeometry().setFromPoints(points.map(p=>new THREE.Vector3(...p))),new THREE.LineBasicMaterial({color}));parent.add(m);return m;}
function flat(parent,w,h,pos,color=0xffffff){const m=new THREE.Mesh(new THREE.PlaneGeometry(w,h),new THREE.MeshBasicMaterial({color,side:THREE.DoubleSide,toneMapped:false}));m.position.set(...pos);parent.add(m);return m;}
function clear(mesh,color,opacity){mesh.material=new THREE.MeshBasicMaterial({color,transparent:true,opacity,depthWrite:false,side:THREE.DoubleSide});return mesh;}
function marker(parent,color,r=.045){const m=new THREE.Mesh(new THREE.SphereGeometry(r,12,8),new THREE.MeshBasicMaterial({color,toneMapped:false}));parent.add(m);return m;}
function arrow(kit,parent,color,start,end){const a=solidArrow(kit,color,parent,.018),v=new THREE.Vector3(...end).sub(new THREE.Vector3(...start));a.position.set(...start);a.userData.setDirection(v);a.userData.setLength(v.length());return a;}
const palette=i=>[0,1,2].map(k=>i===k?1:0);

export function createOledDisplayGeometry(kit){
  const system=kit.part('system','Connected OLED display','A nine-pixel teaching panel with RGB emitters, row and data drivers, and a distinct emitter-current supply. Its dimensions and routing are illustrative.');
  const make=(id,name,description,parent=system)=>kit.part(id,name,description,[0,0,0],parent);
  const housing=make('housing','Display frame and backing','Holds the emitting panel and its driving electronics. A real panel contains many more pixels.');housing.userData.explosionCategory=true;
  const frame=make('frame','Retaining frame','Retains the transparent substrate, patterned OLED layers and rear seal.',housing);
  for(const y of [-.85,1.91])kit.box([4.50,.14,.51],[0,y,-.09],'ink',frame);
  for(const x of [-2.18,2.18])kit.box([.14,2.64,.51],[x,.53,-.09],'ink',frame);
  const rear=make('rear-shell','Rear protective cover','Protects the driver wiring behind the panel. Remove the cover to inspect the circuit.',housing);kit.box([4.34,2.67,.075],[0,.53,-.53],'leaf',rear);kit.covers.push(rear);
  const stand=make('stand','Display stand','Supports the display. It carries no optical or electrical function.',housing);
  kit.box([.27,.70,.24],[0,-1.65,-.26],'ink',stand);kit.box([1.72,.12,.65],[0,-2.02,-.23],'ink',stand);
  const stack=make('panel-stack','Bottom-emitting panel stack','Light leaves the emissive layer toward the transparent anode and front substrate. The rear cathode is reflective in this selected architecture.');stack.userData.explosionCategory=true;
  function sheet(id,name,description,z,thickness,color,opacity){const p=make(id,name,description,stack),m=kit.box([4.17,2.50,thickness],[0,.53,z],color,p);if(opacity!==undefined)clear(m,color,opacity);return p;}
  const encapsulation=sheet('encapsulation','Rear encapsulation and edge seal','Keeps moisture and oxygen away from sensitive electrodes and organic layers. Degradation is not simulated.',-.39,.085,0x83b4c1,.30);
  for(const y of [-.75,1.81])kit.box([4.17,.035,.28],[0,y,-.18],'wood',encapsulation);
  const cathode=sheet('cathode','Common metal cathode','Supplies electrons to the organic stack and connects to the emitter-return line. All emitters share this return electrode.',-.24,.025,0xb4c5b0);
  const etl=sheet('electron-transport','Electron injection and transport region','Moves injected electrons from the cathode toward the emissive zone. Several functional films are grouped here.',-.168,.060,0x83b4c1,.22);
  const emitters=make('emissive-layer','Patterned RGB emissive layer','Different organic emitters produce red, green and blue light. Their contributions are controlled independently.',stack);
  const colorParts=['Red','Green','Blue'].map((name,i)=>make(['red-emitters','green-emitters','blue-emitters'][i],`${name} organic emitters`,`${name} emitting regions across the nine illustrative pixels. Their material intensity follows calculated current.`,emitters));
  const htl=sheet('hole-transport','Hole injection and transport region','Transports holes from the positive anode toward the emissive zone. This is a simplified grouping of organic layers.',-.052,.05,0xe3b45e,.11);
  const anodes=make('anodes','Patterned transparent anodes','Each emitter has an anode connected to its own drive transistor. Anode and cathode must form a powered current path.',stack);
  const glass=sheet('glass','Transparent front substrate','Supports the transparent anodes. In this bottom-emitting example, generated light leaves through this substrate.',.083,.075,0x83b4c1,.11);
  const electronics=make('electronics','Active-matrix driving circuit','Two TFTs and a storage capacitor serve each subpixel. The row/data circuit writes the control signal; the emitter rail supplies light-producing current.');electronics.userData.explosionCategory=true;
  const board=make('driver-board','Driver support and insulating backplane','Supports schematic row, data and emitter connections. The displayed wiring is not a fabrication mask.',electronics);
  kit.box([4.17,.43,.075],[0,-1.18,-.30],'leaf',board);
  const data=make('data-driver','Data driver and column lines','Nine column lines program independent RGB signals. Target percentages are linear current fractions, not encoded image codes.',electronics);
  const dataChip=kit.box([1.13,.23,.13],[0,-1.18,-.17],'ink',data);
  const rowDriver=make('row-driver','Row driver and select lines','Selects each row for 120 microseconds in the assigned 60 Hz scan. The P-type switching TFT is enabled by a low gate signal.',electronics);
  kit.box([.28,2.30,.028],[-1.96,.43,.026],'ink',rowDriver);
  const rowWires=Array.from({length:3},(_,row)=>{const y=1.29-row*.78,m=kit.rod([-1.97,y-.38,.04],[1.95,y-.38,.04],.004,'gold',rowDriver);m.material=m.material.clone();return m;});
  const switches=make('write-tfts','Row-selected write TFTs','Connect each data column to a drive gate during the selected row interval. Opening this switch isolates the signal node; it does not interrupt the emitter current.',electronics);
  const drives=make('drive-tfts','Current-setting drive TFTs','High-side P-type drive transistors take current from the 8 V rail and deliver it to the OLED anodes. The held source-to-gate voltage controls this current.',electronics);
  const storage=make('storage','Storage capacitors','Store the source-to-gate control voltage. The light-producing current follows the drive channel, not a path through the capacitor dielectric.',electronics);
  const supply=make('emitter-feed','Emitter supply and return','The assigned 8 V rail feeds the drive TFTs; a separate return closes the common-cathode path. Its switch can interrupt emission while row writing continues.',electronics);
  kit.box([.66,.27,.16],[1.53,-1.18,-.12],'wood',supply);
  const feedPath=[[1.53,-1.045,-.12],[1.53,-.79,.025],[1.93,-.79,.025],[1.93,1.66,.025],[-1.71,1.66,.025]];
  for(let i=1;i<feedPath.length;i++)kit.rod(feedPath[i-1],feedPath[i],.005,'red',supply);
  const returnPath=[[-1.60,-1.18,-.23],[-1.83,-1.18,-.23],[-1.83,-.72,-.24]];
  for(let i=1;i<returnPath.length;i++)kit.rod(returnPath[i-1],returnPath[i],.016,'blue',supply);
  const returnToSupply=[[-1.24,-1.18,-.23],[-1.24,-1.48,-.23],[1.53,-1.48,-.23],[1.53,-1.315,-.12]];
  for(let i=1;i<returnToSupply.length;i++)kit.rod(returnToSupply[i-1],returnToSupply[i],.016,'blue',supply);
  const returnSwitch=kit.rod([-1.59,-1.18,-.23],[-1.24,-1.18,-.23],.019,'metal',supply),returnPivot=new THREE.Group();supply.add(returnPivot);returnPivot.position.set(-1.59,-1.18,-.23);returnSwitch.position.sub(returnPivot.position);returnPivot.add(returnSwitch);
  const terminals=[],dataPaths=[];
  for(let column=0;column<3;column++)for(let channel=0;channel<3;channel++){
    const x=(column-1)*1.21+(channel-1)*.34-.167,source=[(column*3+channel-4)*.105,-1.065,-.17],bend=[x,-.93,.011];
    kit.rod(source,bend,.003,tones[channel],data);kit.rod(bend,[x,1.59,.011],.003,tones[channel],data);
    dataPaths.push({column,channel,source,bend});
  }
  const pixels=[];
  for(let row=0;row<3;row++)for(let column=0;column<3;column++){
    const channels=[],y=1.29-row*.78;
    for(let channel=0;channel<3;channel++){
      const x=(column-1)*1.21+(channel-1)*.34;
      const window=flat(colorParts[channel],.305,.58,[x,y,-.101],0x000000);
      clear(kit.box([.31,.59,.018],[x,y,-.008],0xb4c5b0,anodes),0xb4c5b0,.10);
      const sw=kit.box([.055,.055,.030],[x-.08,y-.365,.025],'ink',switches),drive=kit.box([.055,.075,.030],[x+.065,y-.375,.025],'wood',drives);
      const gate=[x+.0225,y-.375,.03],source=[x+.065,y-.3375,.025],drain=[x+.065,y-.4125,.025],anode=[x+.13,y-.295,.001];
      kit.rod([x-.167,y-.365,.011],[x-.08,y-.365,.025],.003,tones[channel],switches);
      kit.rod([x-.08,y-.3375,.025],gate,.003,'gold',switches);
      kit.rod([1.93,y-.315,.025],[source[0],y-.315,.025],.005,'red',supply);
      kit.rod([source[0],y-.315,.025],source,.005,'red',supply);
      kit.rod(drain,anode,.003,'metal',drives);
      kit.rod(gate,[x+.137,y-.375,.03],.003,'gold',storage);
      for(const cy of [y-.375,y-.345])kit.box([.04,.008,.018],[x+.137,cy,.03],'metal',storage);
      kit.rod([x+.137,y-.345,.03],source,.003,'red',storage);
      terminals.push({row,column,channel,gate,source,drain,anode});channels.push({window,sw,drive});
    }
    pixels.push({row,column,channels});
  }
  const guides=new THREE.Group();guides.userData.explosionExcluded=true;system.add(guides);
  label(guides,'OLED · nine enlarged pixels',0,2.42,4.9,.26,.31);
  label(guides,'Gold outline marks the center pixel',0,2.13,5.1,.20,.31);
  const status=label(guides,'',0,-2.36,5.1,.21,.31),powerLabel=label(guides,'',0,-2.64,5.1,.20,.31);
  const selectedFrame=new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints([[-.535,.83,.14],[.535,.83,.14],[.535,.19,.14],[-.535,.19,.14]].map(p=>new THREE.Vector3(...p))),new THREE.LineBasicMaterial({color:0xe3b45e}));guides.add(selectedFrame);
  const mixture=flat(guides,.92,.30,[1.43,-1.89,.31]);label(guides,'Color cue',1.43,-1.61,1.36,.21,.31);
  for(const m of guides.children)if(m.material)m.material.side=THREE.FrontSide;
  function detail(id,name,description){const p=make(id,name,description);p.userData.inspectionOnly=id;p.userData.explosionExcluded=true;return p;}
  const circuit=detail('circuit-detail','Stored signal and emitter current','Schematic of the center red subpixel. Separate signal and power paths explain why row selection can end while light continues.');
  label(circuit,'Center red · stored signal and current',0,2.07,5.05,.26);
  const wire=(points,color=ink)=>line(circuit,points.map(([x,y])=>[x,y,.06]),color);
  wire([[-1.60,.32],[-.96,.32]],0x528345);wire([[-.66,.32],[-.12,.32],[-.12,.80],[.61,.80]],0xe3b45e);
  wire([[-.81,-.45],[-.81,.11]],0x357386);
  const writeChannel=kit.rod([-.96,.32,.06],[-.66,.32,.06],.019,'metal',circuit);writeChannel.material=writeChannel.material.clone();
  wire([[-.98,.14],[-.64,.14]],0x357386);wire([[-.81,.11],[-.81,.14]],0x357386);
  label(circuit,'Data',-1.43,.64,.78,.24);label(circuit,'Row',-.83,-.70,.65,.24);const writeLabel=label(circuit,'',-1.40,-.10,1.08,.22);
  wire([[.92,1.58],[.92,1.12]],0xc14f39);wire([[.92,.56],[.92,-.07]],0xc14f39);
  const driveBlock=kit.box([.40,.57,.055],[.92,.84,.06],'wood',circuit);label(circuit,'Drive',1.51,.99,.8,.24);label(circuit,'TFT',1.51,.70,.8,.24);
  wire([[-.12,.80],[-.12,1.02]],0xe3b45e);wire([[-.12,1.18],[-.12,1.58],[.92,1.58]],0xc14f39);
  for(const y of [1.02,1.18])kit.box([.40,.025,.035],[-.12,y,.06],'metal',circuit);
  label(circuit,'Cstore',-.67,1.29,.88,.23);label(circuit,'+8 V',.94,1.76,1.04,.24);
  const emitter=flat(circuit,.50,.43,[.92,-.31,.08],0x000000);wire([[.92,-.525],[.92,-.89]],0x357386);
  label(circuit,'OLED',1.63,-.32,.85,.24);wire([[.92,-1.19],[.92,-1.43],[-1.96,-1.43],[-1.96,1.58],[-.12,1.58]],0x357386);
  const returnContact=kit.rod([.92,-.89,.06],[.92,-1.19,.06],.019,'metal',circuit),returnDetailPivot=new THREE.Group();circuit.add(returnDetailPivot);returnDetailPivot.position.set(.92,-.89,.06);returnContact.position.sub(returnDetailPivot.position);returnDetailPivot.add(returnContact);
  label(circuit,'Return',1.73,-.99,1.05,.23);label(circuit,'switch',1.73,-1.25,1.05,.23);label(circuit,'0 V',-1.57,-1.24,.64,.22);
  const sourceGap=flat(circuit,.12,.58,[-1.96,.12,.08],0xf9f5e8);kit.box([.30,.42,.055],[-1.96,.12,.09],'cream',circuit);label(circuit,'DC',-1.96,.12,.28,.18,.13);
  label(circuit,'+',-2.20,.29,.22,.20,.13);label(circuit,'−',-2.20,-.05,.22,.20,.13);
  const currentArrow=arrow(kit,circuit,0xc14f39,[1.3,.37,.08],[1.3,-.05,.08]);
  const circuitVoltage=label(circuit,'',0,-1.76,5.0,.23),circuitCurrent=label(circuit,'',0,-2.05,5.0,.23);
  const signalNode=marker(circuit,0xe3b45e,.04);signalNode.position.set(-.12,.80,.09);
  label(circuit,'Signal',-.83,.82,1.00,.23);
  const carriers=detail('carriers-detail','From charge carriers to light','Side view of three enlarged bottom-emitting OLED stacks. Electrons and holes approach the emissive zone from opposite electrodes. Symbols show paths, not individual charges or physical transit times.');
  label(carriers,'Charges meet; the organic layer emits',0,2.16,5.0,.27);
  const carrierChannels=[0,1,2].map(i=>{
    const group=new THREE.Group();group.position.x=(i-1)*1.65;carriers.add(group);
    label(group,['Red','Green','Blue'][i],0,1.78,1.50,.25);
    const names=['Cathode −','e⁻ layer','Emitter','h⁺ layer','Anode +','Glass'];
    const ys=[1.38,1.00,.50,.00,-.43,-.72],colors=[0xb4c5b0,0x83b4c1,tones[i],0xe3b45e,0xb4c5b0,0x83b4c1];
    const layers=ys.map((y,j)=>{const mesh=kit.box([1.29,j===2?.34:.27,.22],[0,y,0],colors[j],group);if(j===5)clear(mesh,colors[j],.25);label(group,names[j],-.12,y,1.00,.25,.15,j===2?'#fff9e9':'#172b1b');return mesh;});
    const holes=Array.from({length:3},()=>{const dot=marker(group,0xe3b45e,.060);const sign=label(dot,'+',0,0,.13,.14,.063);return {dot,sign};});
    const electrons=Array.from({length:3},()=>{const dot=marker(group,0x357386,.060);const sign=label(dot,'−',0,0,.13,.14,.063,'#fff9e9');return {dot,sign};});
    const excited=marker(group,tones[i],.092);excited.position.set(.52,.50,.26);
    const photons=Array.from({length:3},()=>marker(group,tones[i],.032));
    const lightArrow=arrow(kit,group,tones[i],[.52,-.88,.18],[.52,-1.37,.18]);
    const rate=label(group,'',0,-1.59,1.55,.24);
    return {group,layers,holes,electrons,excited,photons,lightArrow,rate};
  });
  label(carriers,'Escaped photons per second · e⁻ electrons · h⁺ holes',0,-1.92,5.0,.21);
  const carrierStatus=label(carriers,'',0,-2.22,5.0,.24);
  const energy=detail('energy-detail','Picture and energy budget','The emitter rail supplies optical output, transistor heating and non-emitted OLED energy. A separate assigned electronics load remains even when the picture is black.');
  label(energy,'Where the electrical power goes',0,2.05,5.0,.27);
  label(energy,'0%',-.51,1.74,.60,.19);label(energy,'100%',1.42,1.74,.65,.19);
  const energyRows=[['Light out',0xe3b45e],['OLED heat',0xce825f],['TFT heat',0x83b4c1],['Electronics',0x91aa7e]].map(([title,color],i)=>{
    const y=1.40-i*.63;label(energy,title,-1.48,y,1.58,.25);flat(energy,1.93,.25,[.455,y,.02],0xe8e7d7);const bar=flat(energy,1,.25,[-.51,y,.05],color),value=label(energy,'',1.94,y,1.10,.23);return {bar,value};
  });
  label(energy,'Bars show shares of current total power',0,-.91,5.0,.22);
  const energyTotal=label(energy,'',0,-1.33,5.0,.24),energyRecord=label(energy,'',0,-1.65,5.0,.22);
  label(energy,'Assigned circuit · switching losses excluded',0,-2.00,5.04,.21);
  return {system,housing,frame,rear,stand,stack,encapsulation,cathode,etl,emitters,colorParts,htl,anodes,glass,electronics,board,data,dataChip,dataPaths,rowDriver,rowWires,switches,drives,storage,supply,returnPivot,terminals,pixels,guides,status,powerLabel,selectedFrame,mixture,circuit,writeChannel,writeLabel,driveBlock,emitter,returnDetailPivot,sourceGap,currentArrow,circuitVoltage,circuitCurrent,signalNode,carriers,carrierChannels,carrierStatus,energy,energyRows,energyTotal,energyRecord};
}

export function updateOledDisplayGeometry(p,s){
  p.pixels.forEach((pixel,index)=>pixel.channels.forEach((channel,i)=>{channel.window.material.color.setRGB(...palette(i).map(v=>v*s.pixels[index].channels[i].light));}));
  p.mixture.material.color.setRGB(...s.light);
  p.rowWires.forEach((wire,row)=>wire.material.color.setHex(s.selectedRow===row?0xe3b45e:0xae8056));
  p.returnPivot.rotation.z=s.circuitClosed?0:.60;
  p.status.userData.setText(`${s.done?'Record complete':s.selectedRow===null?'Rows holding their signals':`Writing row ${s.selectedRow+1}`} · ${(s.time*1000).toFixed(2)} ms`);
  p.powerLabel.userData.setText(`Emitter current ${(s.total.current*1e6).toFixed(2)} μA · total power ${(s.total.power*1e6).toFixed(2)} μW`);
  const red=s.center.channels[0],writing=s.center.selected;
  p.writeChannel.material.color.setHex(writing?0xe3b45e:0xc8cbbc);p.writeLabel.userData.setText(`TFT ${writing?'on':'off'}`);p.returnDetailPivot.rotation.z=s.circuitClosed?0:-.65;
  p.emitter.material.color.setRGB(red.light,0,0);p.currentArrow.visible=red.current>0;p.currentArrow.scale.x=.3+.7*red.light;
  p.signalNode.scale.setScalar(.75+.25*red.voltage/3);
  p.circuitVoltage.userData.setText(`VSG ${red.voltage.toFixed(3)} V · row ${writing?'on':'off'} · ${s.center.writes} writes`);
  p.circuitCurrent.userData.setText(`OLED ${(red.current*1e6).toFixed(3)} μA · return ${s.circuitClosed?'closed':'open'}`);
  p.carrierChannels.forEach((channel,i)=>{
    const emitter=s.center.channels[i],on=emitter.current>0,phase=s.clock*.65;
    channel.holes.forEach(({dot},j)=>{const f=(phase+j/3)%1;dot.position.set(.52-.08*(1-f),-.38+.88*f,.23);dot.visible=on;});
    channel.electrons.forEach(({dot},j)=>{const f=(phase+j/3)%1;dot.position.set(.52+.08*(1-f),1.35-.85*f,.23);dot.visible=on;});
    channel.excited.visible=on;channel.excited.scale.setScalar(.7+.3*Math.sin(phase*Math.PI*2)**2);
    channel.photons.forEach((dot,j)=>{const f=(phase+j/3)%1;dot.position.set(.52,.40-1.79*f,.25);dot.visible=on;});
    channel.lightArrow.visible=on;channel.lightArrow.scale.x=.15+.85*emitter.light;channel.lightArrow.scale.z=.15+.85*emitter.light;
    channel.rate.userData.setText(`${(emitter.photonRate/1e12).toFixed(2)} × 10¹²`);
  });
  p.carrierStatus.userData.setText(!s.circuitClosed?'Return open: injection stops':s.light.some(v=>v>0)?'Current supplies light · no backlight':'No emitter current: no emitted light');
  const powers=[s.total.opticalPower,s.total.oledHeat,s.total.drivePower,s.total.electronicsPower];
  p.energyRows.forEach((row,i)=>{const width=1.93*powers[i]/s.total.power;row.bar.scale.x=Math.max(width,1e-8);row.bar.position.x=-.51+width/2;row.bar.visible=powers[i]>0;row.value.userData.setText(`${(powers[i]*1e6).toFixed(2)} μW`);});
  const count=s.pixels.filter(pixel=>pixel.active).length;
  p.energyTotal.userData.setText(`Total ${(s.total.power*1e6).toFixed(2)} μW · ${count} programmed ${count===1?'pixel':'pixels'}`);
  p.energyRecord.userData.setText(`Record energy ${(s.total.energy*1e6).toFixed(3)} μJ · ${(s.time*1000).toFixed(1)} ms elapsed`);
}

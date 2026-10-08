import * as THREE from 'three';
import {houseModel, reading} from './house-model-kit.js';
import {textLabel, solidArrow} from './scene-kit.js';
import {ADD_DEFAULTS, ADD_DOMAINS, ADD_KEYS, createAdditionController} from './calculator-addition-physics.js';

const DARK = 0x374736, GOLD = 0xe3b45e, BLUE = 0x83b4c1, PAPER = 0xf5f1dc, SCREEN = 0xc6d1ba, INK = 0x1c241a;
const label = (parent,text,position,width,height=.14,color='#394233') => textLabel(parent,text,{position,width,height,color});
const own = mesh => {mesh.material=mesh.material.clone();return mesh;};
const flat = (mesh,color=PAPER) => {mesh.material=new THREE.MeshBasicMaterial({color,toneMapped:false});return mesh;};
const clear = mesh => {own(mesh);mesh.material.transparent=true;mesh.material.opacity=.08;mesh.material.depthWrite=false;return mesh;};
function wire(kit,parent,points,color='gold',radius=.009) {
  return points.slice(1).map((point,index)=>{const mesh=own(kit.rod(points[index],point,radius,color,parent));mesh.userData.ends=[points[index],point];return mesh;});
}
function ray(kit,parent,from,to) {
  const arrow=solidArrow(kit,GOLD,parent,.017),direction=new THREE.Vector3(...to).sub(new THREE.Vector3(...from));
  arrow.position.set(...from);arrow.userData.setDirection(direction);arrow.userData.nominalLength=direction.length();arrow.userData.setLength(0);return arrow;
}
function digitMeshes(kit,parent,center,scale=1,color=INK) {
  const shape={a:[0,.28,.28,.052],b:[.166,.14,.052,.225],c:[.166,-.14,.052,.225],d:[0,-.28,.28,.052],e:[-.166,-.14,.052,.225],f:[-.166,.14,.052,.225],g:[0,0,.28,.052]};
  return Object.fromEntries(Object.entries(shape).map(([name,[x,y,w,h]])=>[name,flat(kit.box([w*scale,h*scale,.008],[center[0]+x*scale,center[1]+y*scale,center[2]],'ink',parent),color)]));
}
function inspection(kit,system,id,name,description) {
  const group=kit.part(id,name,description,[0,0,0],system);group.userData.inspectionOnly=id;group.userData.explosionExcluded=true;return group;
}

function buildCalculator(kit) {
  const system=kit.part('system','Calculator','A connected addition-only teaching calculator. Enter two numbers, follow decimal carry and read the reflective LCD result. Dimensions and scene timings are illustrative.');
  const calculator=kit.part('calculator','Complete calculator','The selected operands are entered one key at a time. The display shows current entry until the calculated result is transferred. Inspection preserves the experiment.',[0,0,0],system);
  const casing=kit.part('case','Case and open bezel','A rear shell, edge walls and open key grid support the circuit board, keys and display.',[0,0,0],calculator);
  const rear=kit.box([2.64,4.68,.10],[0,0,-.20],'ink',casing);
  const walls=[kit.box([.16,4.68,.40],[-1.24,0,.05],'ink',casing),kit.box([.16,4.68,.40],[1.24,0,.05],'ink',casing),kit.box([2.32,.18,.40],[0,2.25,.05],'ink',casing),kit.box([2.32,.18,.40],[0,-2.25,.05],'ink',casing)];
  label(casing,'CALCULATOR',[0,1.985,.257],1.92,.16,'#f5f1dc');
  label(casing,'ADD TWO NUMBERS',[0,-2.24,.257],1.84,.11,'#f5f1dc');
  const facegrid=kit.part('grid','Key supports','Openings in the face let each key stem move toward its contact pads. Look inside removes these supports and key caps to reveal the matrix.',[0,0,0],calculator);
  const rails=[...[-1.12,-.36,.36,1.12].map(x=>kit.box([.15,2.67,.06],[x,-.85,.135],'leaf',facegrid)),...[.51,-.17,-.79,-1.41,-2.08].map(y=>kit.box([2.24,.16,.06],[0,y,.135],'leaf',facegrid)),kit.box([2.24,.52,.06],[0,.73,.135],'leaf',facegrid)];
  label(facegrid,'ADDITION',[0,.73,.168],1.40,.14);
  const board=kit.part('board','Circuit board','Separated row and column traces connect contact pads to the controller. Trace height and pad size are enlarged for inspection.',[0,0,0],calculator);
  const substrate=kit.box([2.25,4.16,.075],[0,-.02,-.1125],'leaf',board);
  const battery=kit.part('battery','Battery and power switch','A battery supplies the controller and LCD drive. Device power Off clears volatile registers and removes drive in the immediate-shutdown teaching approximation.',[0,0,0],calculator);
  const cell=kit.disk(.27,.10,[-.66,.73,-.025],'metal',battery);label(battery,'+ BATTERY',[-.66,.73,.027],.51,.10);
  const powerSwitch=own(kit.box([.24,.12,.09],[-.65,.39,-.02],'ink',battery));
  const powerLeads=[...wire(kit,battery,[[-.49,.53,-.025],[-.49,.39,-.025],[-.53,.39,-.025]],'red'),...wire(kit,battery,[[-.77,.39,-.025],[-.96,.39,-.025],[-.96,1.08,-.025],[.22,1.08,-.025],[.22,.95,-.025]],'red'),...wire(kit,battery,[[-.39,.73,-.025],[-.20,.73,-.025],[-.20,.59,-.025],[.03,.59,-.025]],'ink')];
  const chip=kit.part('chip','Input registers, adder and decoder','One illustrative chip collects scanned keys, stores operands, adds decimal columns and decodes each display digit into seven segment selections. Enlarged inspections reveal those states.',[0,0,0],calculator);
  const packageMesh=own(kit.box([.72,.55,.10],[.39,.675,-.025],'ink',chip));
  label(chip,'CONTROLLER',[.39,.80,.028],.64,.085,'#f5f1dc');
  const chipStatus=label(chip,'Ready',[.39,.66,.028],.62,.09,'#f5f1dc');
  const registerLabel=label(chip,'A: ·  B: ·',[.39,.53,.028],.64,.085,'#f5f1dc');
  const matrix=kit.part('matrix','Key contact matrix','Each key bridges one row and one column. The controller drives a row low, reads columns, confirms a stable key and waits for release. Only one ideal key is pressed at a time.',[0,0,0],calculator);
  const rows=[],columns=[],pads=[],keyCenters=ADD_KEYS.map((key,index)=>({key,x:(index%3-1)*.72,y:.14-Math.floor(index/3)*.62,row:Math.floor(index/3),column:index%3}));
  for(let row=0;row<4;row++) {
    const y=.14-row*.62-.15;
    rows.push(wire(kit,matrix,[[-.94,y,.012],[.94,y,.012],[1.00+row*.024,y,.012],[1.00+row*.024,.50+row*.10,.012],[.75,.50+row*.10,.012]],'metal',.007));
  }
  for(let column=0;column<3;column++) {
    const x=(column-1)*.72+.16,y=.25+column*.035,z=.075+column*.023,pin=.18+column*.19;
    columns.push(wire(kit,matrix,[[x,-1.88,.033],[x,y,.033],[x,y,z],[pin,y,z],[pin,.40,z],[pin,.40,.015]],'metal',.007));
  }
  for(const point of keyCenters) {
    const left=own(kit.box([.10,.16,.025],[point.x-.065,point.y,.0675],'metal',matrix)),right=own(kit.box([.10,.16,.025],[point.x+.065,point.y,.0675],'metal',matrix));
    const rowLead=wire(kit,matrix,[[point.x-.065,point.y,.055],[point.x-.065,point.y-.15,.055],[point.x-.065,point.y-.15,.012]],'metal',.007);
    const columnLead=wire(kit,matrix,[[point.x+.065,point.y,.055],[point.x+.16,point.y,.055],[point.x+.16,point.y,.033]],'metal',.007);
    pads.push({left,right,rowLead,columnLead,...point});
  }
  const keys=kit.part('keys','Moving keys and conductive contacts','The pressed key lowers a conductive contact onto two pads. Digit keys enter numbers; + stores the first operand and = starts addition. Keys are animated from the operand controls.',[0,0,0],calculator);
  const caps=keyCenters.map(point=>{
    const group=new THREE.Group();group.position.set(point.x,point.y,.30);keys.add(group);
    const cap=own(kit.box([.57,.46,.12],[0,0,0],point.key==='+'||point.key==='='?'gold':'cream',group));
    const stem=kit.disk(.12,.10,[0,0,-.075],'ink',group),contact=kit.disk(.14,.04,[0,0,-.13],'ink',group);
    label(group,point.key,[0,0,.064],.34,.28);return {group,cap,stem,contact,...point};
  });
  const connector=kit.part('connector','Display connection','The controller sends decoded segment selections and a repeating common phase to the LCD. This schematic connection does not claim a commercial pin count.',[0,0,0],calculator);
  const ribbon=[kit.box([.38,.29,.025],[.44,1.095,.025],'gold',connector),kit.box([.38,.03,.115],[.44,1.235,.090],'gold',connector)];
  const display=kit.part('display','Reflective three-digit result','Current display-register digits control 21 segment positions. Leading positions are blank. Ambient light reveals the surface; it emits no light.',[0,0,0],calculator);
  const frame=[kit.box([2.22,.08,.15],[0,1.01,.21],'ink',display),kit.box([2.22,.08,.15],[0,1.85,.21],'ink',display),kit.box([.08,.76,.15],[-1.07,1.43,.21],'ink',display),kit.box([.08,.76,.15],[1.07,1.43,.21],'ink',display)];
  const stack=kit.part('lcdstack','LCD layers','A rear reflector, crossed polarizers, glass and transparent electrodes surround the liquid crystal. Enlarged thicknesses make their order visible. Inspect the light path for the optical mechanism.',[0,0,0],display);
  const layers=[
    {name:'Reflector',z:.146,color:'metal'}, {name:'Rear polarizer',z:.170,color:'ink'}, {name:'Rear glass and common electrode',z:.194,color:'blue'},
    {name:'Liquid crystal',z:.218,color:'cream'}, {name:'Front glass and segment electrodes',z:.242,color:'blue'}, {name:'Front polarizer',z:.266,color:'ink'},
  ].map(item=>{const mesh=kit.box([2.05,.76,.024],[0,1.43,item.z],item.color,stack);mesh.name=item.name;return mesh;});
  const screen=flat(kit.box([2.035,.745,.012],[0,1.43,.284],'cream',display),SCREEN);
  const digits=[-.57,0,.57].map(x=>digitMeshes(kit,display,[x,1.43,.295],1));
  return {system,calculator,casing,rear,walls,facegrid,rails,board,substrate,battery,cell,powerSwitch,powerLeads,chip,packageMesh,chipStatus,registerLabel,matrix,rows,columns,pads,keys,caps,connector,ribbon,display,frame,stack,layers,screen,digits};
}

function buildMatrixView(kit,system) {
  const matrixview=inspection(kit,system,'matrixview','Follow the scanned key','An enlarged copy of the same four-row, three-column matrix. Gold marks the driven low row and any column pulled low through the pressed key. Other rows are not driven.');
  const rowLines=[],columnLines=[],keys=[];
  for(let row=0;row<4;row++) {
    const y=.88-row*.67;rowLines.push(wire(kit,matrixview,[[-1.55,y,.02],[1.20,y,.02]],'metal',.018));label(matrixview,`R${row+1}`,[-1.87,y,.05],.42,.20);
  }
  for(let column=0;column<3;column++) {
    const x=-.90+column*.9;columnLines.push(wire(kit,matrixview,[[x,1.2,.08],[x,-1.45,.08]],'metal',.018));label(matrixview,`C${column+1}`,[x,-1.69,.1],.5,.20);
  }
  ADD_KEYS.forEach((key,index)=>{
    const x=-.90+(index%3)*.9,y=.88-Math.floor(index/3)*.67,contact=own(kit.disk(.235,.08,[x,y,.18],'cream',matrixview));
    label(matrixview,key,[x,y,.225],.36,.26);keys.push({key,contact});
  });
  label(matrixview,'One row low; read the columns',[0,1.64,.12],4.3,.23);
  const status=label(matrixview,'Waiting for a key',[0,-2.06,.12],4.5,.22);
  const accepted=label(matrixview,'Accepted: none',[0,-2.40,.12],4.5,.21);
  return {matrixview,rowLines,columnLines,matrixKeys:keys,matrixStatus:status,acceptedLabel:accepted};
}

function buildAdder(kit,system) {
  const adder=inspection(kit,system,'adder','Follow decimal carry','The same entered registers feed ones, tens and hundreds in order. Each completed column keeps its units digit and passes any ten to the next column. This is a teaching algorithm, not a commercial chip layout.');
  label(adder,'DECIMAL ADDITION',[0,1.85,.1],4.6,.28);
  const operands=label(adder,'A: waiting    B: waiting',[0,1.40,.1],4.8,.24),status=label(adder,'Keys must be entered first',[0,.99,.1],4.8,.21);
  const stages=[1,10,100].map((place,index)=>{
    const y=.43-index*.76,plate=own(kit.box([4.4,.58,.06],[0,y,0],'cream',adder));
    const name=place===1?'ONES':place===10?'TENS':'HUNDREDS';label(adder,name,[-1.52,y+.13,.036],1.12,.16);
    const equation=label(adder,'Waiting',[-.78,y-.13,.036],2.65,.20),output=label(adder,'Digit ·',[1.27,y+.11,.036],1.3,.21),carry=label(adder,'Carry ·',[1.27,y-.14,.036],1.3,.18);
    return {plate,equation,output,carry,place};
  });
  const transfer=label(adder,'Display waits for transfer',[0,-2.14,.1],4.8,.23);
  return {adder,adderOperands:operands,adderStatus:status,adderStages:stages,transferLabel:transfer};
}

function buildDecoder(kit,system) {
  const decoder=inspection(kit,system,'decoder','Decode digits and alternate drive','Electrical diagram of the current display register. Four BCD bits choose segments a-g. The two shown half-cycles repeat: selected segments oppose the common electrode; unselected segments follow it. Diagram illumination is independent of ambient light.');
  label(decoder,'CURRENT DISPLAY REGISTER',[0,2.10,.08],5.2,.27);
  const decoderDigits=[-1.35,0,1.35].map(x=>digitMeshes(kit,decoder,[x,1.21,.08],1.45,GOLD));
  const bcdLabels=[-1.35,0,1.35].map(x=>label(decoder,'blank',[x,.50,.08],1.22,.21));
  const maskLabels=[-1.35,0,1.35].map(x=>label(decoder,'none',[x,.17,.08],1.28,.17));
  label(decoder,'a',[1.35,1.87,.09],.3,.17);label(decoder,'b',[1.73,1.42,.09],.3,.17);label(decoder,'c',[1.73,1.02,.09],.3,.17);label(decoder,'d',[1.35,.67,.09],.3,.17);label(decoder,'e',[.97,1.02,.09],.3,.17);label(decoder,'f',[.97,1.42,.09],.3,.17);label(decoder,'g',[2.02,1.22,.09],.3,.17);
  label(decoder,'REPEATING HALF-CYCLES',[0,-.31,.08],5.2,.23);
  label(decoder,'First     Second',[.73,-.65,.08],3.4,.20);
  const commonLabel=label(decoder,'Common:     0           V',[0,-.96,.08],4.8,.23);
  const segmentLabel=label(decoder,'Ones a:     V           0',[0,-1.30,.08],4.8,.23);
  const differenceLabel=label(decoder,'Across LC:  +V          −V',[0,-1.64,.08],4.8,.23);
  const phaseLabel=label(decoder,'On segment: alternating field; zero mean',[0,-2.07,.08],5.2,.19);
  return {decoder,decoderDigits,bcdLabels,maskLabels,commonLabel,segmentLabel,differenceLabel,phaseLabel};
}

function buildOptics(kit,system) {
  const optics=inspection(kit,system,'optics','Follow reflected light','An enlarged cross-section compares segment a of the ones digit with the unselected background. The chosen normally bright twisted-nematic arrangement returns light when undriven and blocks it when driven. Paths and polarization labels are qualitative.');
  label(optics,'REFLECTIVE LCD',[0,2.20,.12],5.0,.28);
  const selectedLabel=label(optics,'Ones digit: segment a',[-1.14,1.78,.12],2.45,.20);label(optics,'Background',[1.25,1.78,.12],2.10,.20);
  const opticalLayers=[{name:'Front polarizer H',y:1.13,color:'blue'},{name:'Liquid crystal',y:.45,color:'cream'},{name:'Rear polarizer V',y:-.23,color:'blue'},{name:'Reflector',y:-.75,color:'metal'}].map(({name,y,color})=>{
    const plate=clear(kit.box([4.52,.14,.18],[0,y,0],color,optics));label(optics,name,[0,y,.12],1.65,.15);return plate;
  });
  const lightPaths=[-1.38,1.38].map(x=>({
    incident:ray(kit,optics,[x-.24,1.59,.19],[x-.24*.51/2.26,-.16,.19]),
    towardMirror:ray(kit,optics,[x-.24*.37/2.26,-.30,.19],[x,-.67,.19]),
    reflected:ray(kit,optics,[x,-.67,.19],[x+.24,1.59,.19]),
  }));
  const selectedMode=label(optics,'H rotates to V',[-1.35,-1.15,.12],2.45,.21),backgroundMode=label(optics,'H rotates to V',[1.35,-1.15,.12],2.45,.21);
  const opticalStatus=label(optics,'Ambient light returns from both areas',[0,-1.61,.12],5.1,.22);
  label(optics,'Electrodes and layer thicknesses simplified',[0,-2.04,.12],5.1,.18);
  return {optics,opticalLayers,lightPaths,selectedLabel,selectedMode,backgroundMode,opticalStatus};
}

function updateGeometry(g,{values,now}) {
  g.screen.material.color.setHex(values.ambient?SCREEN:0x000000);
  g.digits.forEach((digit,index)=>Object.entries(digit).forEach(([segment,mesh])=>mesh.material.color.setHex(values.ambient?now.digits[index].mask.includes(segment)?INK:SCREEN:0x000000)));
  g.caps.forEach(item=>{item.group.position.z=.30-(now.pressed===item.key ? .07 : 0);item.cap.material.color.setHex(now.pressed===item.key?GOLD:item.key==='+'||item.key==='='?GOLD:0xf0dfaf);});
  const paint=(meshes,active)=>meshes.forEach(mesh=>mesh.material.color.setHex(active?GOLD:0xb4c5b0));
  g.rows.forEach((meshes,index)=>paint(meshes,index===now.scanRow));g.columns.forEach((meshes,index)=>paint(meshes,index===now.columnLow));
  g.pads.forEach(item=>{paint([item.left,...item.rowLead],item.row===now.scanRow);paint([item.right,...item.columnLead],item.column===now.columnLow);});
  g.packageMesh.material.color.setHex(!values.power?DARK:now.stage.startsWith('Add')?0x9b743e:0x466c50);
  g.powerSwitch.material.color.setHex(values.power?0x6e9958:DARK);g.chipStatus.userData.setText(!values.power?'Off':now.written?'Result':now.pressed?'Read key':now.stage.startsWith('Add')?'Add':'Ready');
  g.registerLabel.userData.setText(`A: ${now.first??'·'}  B: ${now.second??'·'}`);
  g.rowLines.forEach((meshes,index)=>paint(meshes,index===now.scanRow));g.columnLines.forEach((meshes,index)=>paint(meshes,index===now.columnLow));
  g.matrixKeys.forEach(item=>item.contact.material.color.setHex(now.pressed===item.key?GOLD:0xf0dfaf));
  g.matrixStatus.userData.setText(now.pressed?`Key ${now.pressed} · R${now.scanRow+1} low · ${now.columnLow>=0?`C${now.columnLow+1} low`:'columns high'}`:values.power?'No key held':'No power; no scan');
  g.acceptedLabel.userData.setText(`Accepted: ${now.acceptedKeys.join(' ')||'none'}`);
  g.adderOperands.userData.setText(`A: ${now.first??'waiting'}    B: ${now.second??'waiting'}`);g.adderStatus.userData.setText(now.stage);
  g.adderStages.forEach((item,index)=>{const column=now.columns[index];item.plate.material.color.setHex(column.active?GOLD:column.complete?0xd5dfbe:0xf0dfaf);item.equation.userData.setText(column.a===null?'Waiting':`${column.a} + ${column.b} + ${column.carryIn} = ${column.total??'·'}`);item.output.userData.setText(`Digit ${column.digit??'·'}`);item.carry.userData.setText(`Carry ${column.carryOut??'·'}`);});
  g.transferLabel.userData.setText(now.written?`Display now reads ${now.readback}`:values.power?`Display still reads ${now.readback}`:'Display blank; registers clear');
  g.decoderDigits.forEach((digit,index)=>Object.entries(digit).forEach(([segment,mesh])=>mesh.material.color.setHex(now.digits[index].mask.includes(segment)?DARK:0xe2e2cb)));
  g.bcdLabels.forEach((item,index)=>item.userData.setText(now.digits[index].bcd??'blank'));g.maskLabels.forEach((item,index)=>item.userData.setText(now.digits[index].mask||'none'));
  const selected=now.drive[2].a,on=selected.on;
  g.commonLabel.userData.setText(`Common:     0           ${values.power?'V':'0'}`);
  g.segmentLabel.userData.setText(`Ones a:     ${on?'V':'0'}           ${values.power&&!on?'V':'0'}`);
  g.differenceLabel.userData.setText(`Across LC:  ${on?'+V':'0'}          ${on?'−V':'0'}`);
  g.phaseLabel.userData.setText(!values.power?'Power off: no drive':on?'Selected segment: alternating field; zero mean':'Unselected segment: no voltage difference');
  g.lightPaths.forEach((paths,index)=>{const returns=values.ambient&&!(index===0&&on);paths.incident.userData.setLength(values.ambient?paths.incident.userData.nominalLength:0);paths.towardMirror.userData.setLength(returns?paths.towardMirror.userData.nominalLength:0);paths.reflected.userData.setLength(returns?paths.reflected.userData.nominalLength:0);});
  g.selectedMode.userData.setText(on?'H stays H; blocked':'H rotates to V');g.backgroundMode.userData.setText('H rotates to V');
  g.opticalStatus.userData.setText(!values.ambient?'No ambient light returns':on?'Segment dark; background returns light':'Both areas return light');
}

export function createCalculatorAdditionModel() {
  const kit=houseModel('Calculator'),hardware=buildCalculator(kit),g={...hardware,...buildMatrixView(kit,hardware.system),...buildAdder(kit,hardware.system),...buildDecoder(kit,hardware.system),...buildOptics(kit,hardware.system)},controller=createAdditionController();
  kit.control('first','First number',...ADD_DOMAINS.first,ADD_DEFAULTS.first,'','Choose an integer from 0 to 99. Changing either operand clears the trial; Play enters its digits through the keys.',undefined,{primary:true});
  kit.control('second','Second number',...ADD_DOMAINS.second,ADD_DEFAULTS.second,'','Choose the number to add. The answer appears only after key entry, decimal addition and display transfer.');
  kit.control('power','Device power',...ADD_DOMAINS.power,ADD_DEFAULTS.power,'','Off clears volatile registers and removes LCD drive. On starts a fresh trial; press Play to enter the selected numbers.',[{label:'Off',value:0},{label:'On',value:1}]);
  kit.control('ambient','Ambient light',...ADD_DOMAINS.ambient,ADD_DEFAULTS.ambient,'','Turn room light Off to hide the reflective screen. Calculation keeps its state. Restore light to see the current digits without recomputing.',[{label:'Off',value:0},{label:'On',value:1}]);
  const result=kit.finish(()=>{
    const state=controller.getState(),{values,now}=state;updateGeometry(g,state);
    const visible=!values.ambient?'Screen dark':!values.power?'Blank display':now.written?`${now.readback} · result`:`${now.readback} · entry`;
    const completed=now.columns.filter(column=>column.complete),carries=completed.filter(column=>column.carryOut).map(column=>column.place===1?'ones → tens':'tens → hundreds');
    return {state:{...state,time:state.clock},readings:[
      reading('Your result',visible,!values.ambient?'This LCD reflects light. Restore Ambient light to see the current powered display register.':!values.power?'Power Off removes drive and clears registers. Turn Device power On, then press Play.':now.written?`${now.first} + ${now.second} = ${now.readback}. The result is read from the actual segment selections.`:'Press Play to enter the selected numbers. The screen shows accepted entry digits until the result is transferred.'),
      reading('Calculator operation',now.stage,'Key scans, stable-key checks, decimal columns and display transfer use explanatory scene timing.'),
      reading('Accepted keys',now.acceptedKeys.join(' ')||'None',`Planned entry: ${now.sequence.join(' ')}. A key is accepted only after its row and column have been scanned and checked.`),
      reading('Operand registers',`A: ${now.first??'empty'} · B: ${now.second??'empty'}`,'The + key stores A. The = key stores B and starts addition. Choosing operands does not preload either register.'),
      reading('Decimal carry',carries.join(' · ')||(completed.length?'No carry so far':'No column completed'),'Each decimal column adds its two digits and incoming carry. The ones digit stays; a ten passes into the next column.'),
      reading('Display register',now.readback,!values.power?'No drive or retained electronic result. Shutdown and liquid-crystal relaxation are immediate in this model.':`BCD: ${now.digits.map(digit=>digit.bcd??'blank').join(' · ')}. Electrical state remains inspectable in darkness; the physical screen needs ambient light.`),
      reading('LCD drive',values.power?'Alternating phases':'Off','Selected segments oppose the common electrode in two repeating half-cycles. Unselected segments follow it. V is symbolic; no real voltage, frequency or battery lifetime is predicted.'),
    ]};
  });
  const render=result.update,readState=result.getState;let previousTime=0,disposed=false;const sync=()=>render(controller.getState().values);
  result.getState=()=>{const state=controller.getState();return {...state,time:state.clock,readings:readState().readings.map(item=>({...item}))};};
  result.update=(input={})=>{controller.update(input);return sync();};result.reset=(initial={})=>{controller.reset(initial);previousTime=0;return sync();};
  result.advance=seconds=>{controller.advance(seconds);return sync();};
  result.animate=time=>{const delta=Number.isFinite(time)?Math.max(0,time-previousTime):0;if(Number.isFinite(time))previousTime=time;return result.advance(delta);};result.replayState=controller.replayState;
  result.playback={label:'Enter numbers and add',description:'Enter the chosen digits through the key matrix, add decimal columns and transfer the result to the reflective display.',stepLabel:'Advance calculator operation',advance:result.advance,step:()=>result.advance(.12),complete:()=>result.getState().now.complete,blocked:()=>!result.getState().values.power,blockedReason:'Turn Device power On, then press Play to enter the selected numbers.'};
  result.actions=[['Inspect: complete calculator','calculator'],['Inspect: key scanning','matrixview'],['Inspect: decimal carry','adder'],['Inspect: BCD and LCD drive','decoder'],['Inspect: reflected light','optics']].map(([label,part])=>({label,part,isolate:true,view:'front',replay:false,run:()=>sync()}));
  result.resultPart={id:'display',label:'Read the current digits',view:'front',focusOnComplete:false,preserveOnReset:true,available:()=>true};
  result.covers.push(g.keys,g.facegrid,g.display);result.initialCutaway=false;result.initialPart='calculator';result.initialView='front';result.initialIsolated=true;result.frameVisibleOnly=true;result.framePadding=.56;result.selectionOutline=false;result.transparentBackground=true;
  kit.root.updateMatrixWorld(true);const bodyBounds=new THREE.Box3().setFromObject(g.calculator),size=bodyBounds.getSize(new THREE.Vector3()),center=bodyBounds.getCenter(new THREE.Vector3());
  const details=[g.matrixview,g.adder,g.decoder,g.optics];for(const detail of details)detail.position.add(center.clone().sub(new THREE.Box3().setFromObject(detail).getCenter(new THREE.Vector3())));
  kit.root.updateMatrixWorld(true);const rootSize=new THREE.Box3().setFromObject(kit.root).getSize(new THREE.Vector3());result.overviewZoom=Math.max(rootSize.x,rootSize.y,rootSize.z)*.7/(Math.max(size.x,size.y,size.z)*.56);
  result.viewDirections={front:[.22,.16,8],iso:[3,2.8,6]};result.partViewDirections=Object.fromEntries(result.parts.map(part=>[part.id,{front:['matrixview','adder','decoder','optics','display'].includes(part.id)?[0,0,6]:part.id==='lcdstack'?[3,1,5]:[.22,.16,8]}]));
  for(const part of result.parts){part.framePadding=['system','calculator'].includes(part.id)?.56:.60;if(part.id==='lcdstack')part.inspectionView='front';}
  result.inspectionObjects=id=>details.filter(detail=>detail.userData.inspectionOnly===id);result.thumbnailOmit=details;result.catalogParts=result.parts.filter(part=>!['system','calculator'].includes(part.id));result.topology=g;
  const dispose=result.dispose;result.dispose=()=>{if(!disposed){disposed=true;dispose();}};return result;
}

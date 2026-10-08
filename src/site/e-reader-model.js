import * as THREE from 'three';
import {houseModel, reading} from './house-model-kit.js';
import {solidArrow, textLabel} from './scene-kit.js';
import {READER_BOOKS, READER_DEFAULTS, READER_DOMAINS, READER_PAGE, createReaderController} from './e-reader-physics.js';

const DARK = 0x374736, WHITE = 0xf5f1dc, GOLD = 0xe3b45e, BLUE = 0x83b4c1;
const label = (parent, text, position, width, height = .13, color = '#394233') => textLabel(parent, text, {position, width, height, color});
const ownColor = mesh => {mesh.material = mesh.material.clone();return mesh;};
const glass = (mesh, opacity = .035) => {ownColor(mesh);mesh.material.transparent = true;mesh.material.opacity = opacity;mesh.material.depthWrite = false;return mesh;};
const lightSurface = mesh => {mesh.material = new THREE.MeshBasicMaterial({color: WHITE, toneMapped: false});return mesh;};
const screenPoint = index => [-1.08 + (index % 72 + .5) * .03, 1.62 - (Math.floor(index / 72) + .5) * .03];
function outline(mesh, color = BLUE) {
  mesh.geometry.computeBoundingBox();const {min, max} = mesh.geometry.boundingBox;
  const corners = [0, 1, 2, 3, 4, 5, 6, 7].map(i => new THREE.Vector3(i & 1 ? max.x : min.x, i & 2 ? max.y : min.y, i & 4 ? max.z : min.z));
  const pairs = [[0,1],[2,3],[4,5],[6,7],[0,2],[1,3],[4,6],[5,7],[0,4],[1,5],[2,6],[3,7]];
  const lines = new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(pairs.flatMap(([a, b]) => [corners[a], corners[b]])), new THREE.LineBasicMaterial({color, transparent: true, opacity: .65, depthWrite: false}));
  lines.raycast = () => {};mesh.add(lines);return lines;
}
function wire(kit, parent, points, color = 'gold', radius = .008) {
  return points.slice(1).map((point, index) => {const mesh = kit.rod(points[index], point, radius, color, parent);mesh.userData.ends = [points[index], point];return mesh;});
}
function arrow(kit, parent, from, to, color = GOLD, thickness = .018) {
  const object = solidArrow(kit, color, parent, thickness), start = new THREE.Vector3(...from), end = new THREE.Vector3(...to);
  object.position.copy(start);object.userData.setDirection(end.clone().sub(start));object.userData.nominalLength = start.distanceTo(end);object.userData.setLength(0);return object;
}

function buildReader(kit) {
  const system = kit.part('system', 'E-reader', 'A stored-book reader, with enlarged pigment and front-light inspections. Current material pixels determine the visible page. Geometry and timing are illustrative.');
  const reader = kit.part('reader', 'Complete e-reader', 'Choose a stored title and page, then follow retrieval, composition and a reflective page update. Power removal retains current ink but disables the front-light LEDs.', [0,0,0], system);
  const casing = kit.part('case', 'Case and display supports', 'A rear shell, mounting ledges and open bezel support the electronics and display stack. Layer thicknesses are enlarged.', [0,0,0], reader);
  const rear = kit.box([2.66,3.88,.085], [0,0,-.1975], 'ink', casing);
  const bezel = [
    kit.box([.22,3.88,.36], [-1.22,0,.02], 'ink', casing), kit.box([.22,3.88,.36], [1.22,0,.02], 'ink', casing),
    kit.box([2.22,.26,.36], [0,1.81,.02], 'ink', casing), kit.box([2.22,.56,.36], [0,-1.66,.02], 'ink', casing),
  ];
  const supports = [-1.10,1.10].map(x => kit.box([.06,3.02,.175], [x,.18,-.0675], 'metal', casing));
  label(casing, 'E-READER', [0,-1.67,.205], 1.55, .19, '#f5f1dc');
  const powerIndicator = lightSurface(kit.box([.055,.055,.015], [.95,-1.74,.2075], 'leaf', casing));
  const electronics = kit.part('electronics', 'Circuit board and power circuit', 'The board connects book storage, processor, framebuffer and driver. Its power circuit supplies the display and front-light LEDs; no electrical power value is predicted.', [0,0,0], reader);
  const board = kit.box([2.08,3,.075], [0,.18,-.1175], 'leaf', electronics);
  const powerChip = ownColor(kit.box([.40,.27,.055], [.62,-.65,-.0525], 'ink', electronics));
  label(electronics, 'POWER', [.62,-.65,-.023], .35, .085, '#f5f1dc');
  const battery = kit.part('battery', 'Battery and supply leads', 'The battery powers the active processor, display update and front light. A retained pigment image does not power these components.', [0,0,0], reader);
  const batteryCell = kit.box([1,2.35,.07], [-.49,.34,-.045], 'metal', battery);
  label(battery, 'BATTERY', [-.49,.34,-.008], .82, .18);
  const terminals = [kit.box([.055,.065,.025], [.0375,-.50,-.046], 'red', battery), kit.box([.055,.065,.025], [.0375,-.66,-.046], 'ink', battery)];
  const supplyLeads = [
    ...wire(kit, battery, [[.065,-.5,-.046],[.17,-.5,-.046],[.17,-.60,-.046],[.42,-.60,-.046]], 'red'),
    ...wire(kit, battery, [[.065,-.66,-.046],[.23,-.66,-.046],[.23,-.70,-.046],[.42,-.70,-.046]], 'ink'),
  ];
  const memory = kit.part('memory', 'Stored miniature books', 'Nonvolatile memory holds Light, Rain and Seeds, each with two original miniature pages. Device power loss does not erase these stored texts.', [0,0,0], reader);
  const memoryChip = ownColor(kit.box([.6,.50,.055], [.62,1.30,-.0525], 'ink', memory));
  label(memory, 'BOOKS', [.62,1.45,-.023], .50, .09, '#f5f1dc');
  ['Light','Rain','Seeds'].forEach((name, index) => label(memory, name, [.62,1.33-index*.10,-.023], .48, .085, '#f5f1dc'));
  const processor = kit.part('processor', 'Text and page processor', 'The processor reads the selected stored text and lays out its letters. This is an explanatory sequence, not an ebook file-format decoder.', [0,0,0], reader);
  const processorChip = ownColor(kit.box([.6,.55,.055], [.62,.65,-.0525], 'ink', processor));
  label(processor, 'PROCESSOR', [.62,.73,-.023], .52, .085, '#f5f1dc');
  const processorLabel = label(processor, 'Ready', [.62,.57,-.023], .52, .095, '#f5f1dc');
  const framebuffer = kit.part('framebuffer', 'Page framebuffer', 'Temporary electronic memory holds the requested pixel pattern. That pattern can differ from the physical page while a write is pending or in progress.', [0,0,0], reader);
  const bufferChip = ownColor(kit.box([.6,.48,.055], [.62,-.10,-.0525], 'ink', framebuffer));
  label(framebuffer, 'FRAMEBUFFER', [.62,.01,-.023], .54, .075, '#f5f1dc');
  const bufferLabel = label(framebuffer, 'Waiting', [.62,-.13,-.023], .52, .09, '#f5f1dc');
  const dataLeads = [
    ...wire(kit, processor, [[.62,1.05,-.05],[.62,.925,-.05]]),
    ...wire(kit, framebuffer, [[.62,.375,-.05],[.62,.14,-.05]]),
  ];
  const driver = kit.part('driver', 'Display driver and flexible connection', 'The driver transfers row and column commands through the flexible connection to the TFT backplane. Real controllers use more complicated update waveforms.', [0,0,0], reader);
  const driverChip = ownColor(kit.box([1.2,.18,.06], [.3,-1.05,-.05], 'ink', driver));
  label(driver, 'DISPLAY DRIVER', [.3,-1.05,-.018], 1.10, .095, '#f5f1dc');
  dataLeads.push(...wire(kit, driver, [[.92,-.10,-.05],[.97,-.10,-.05],[.97,-1.05,-.05],[.90,-1.05,-.05]]));
  const ribbon = [kit.box([.30,.21,.012], [.3,-1.245,-.06], 'gold', driver), kit.box([.30,.012,.0875], [.3,-1.345,-.01625], 'gold', driver), kit.box([.30,.035,.015], [.3,-1.3275,.0275], 'gold', driver)];
  const backplane = kit.part('backplane', 'TFT pixel backplane', 'The teaching array has 72 columns and 96 rows. Separate pixel electrodes sit over switching sites. The highlighted row receives commands while unchanged pixels retain their material image.', [0,0,0], reader);
  const substrate = kit.box([2.22,3.02,.025], [0,.18,.0325], 'metal', backplane);
  const electrodes = new THREE.InstancedMesh(new THREE.BoxGeometry(.026,.026,.002), new THREE.MeshBasicMaterial({color: 0x718573}), READER_PAGE.cells);
  const matrix = new THREE.Matrix4();
  for (let index = 0; index < READER_PAGE.cells; index++) {const [x,y] = screenPoint(index);matrix.makeTranslation(x,y,.046);electrodes.setMatrixAt(index,matrix);}
  electrodes.instanceMatrix.needsUpdate = true;backplane.add(electrodes);
  const activeBackRow = kit.box([2.16,.026,.002], [0,0,.048], 'gold', backplane);
  const page = kit.part('page', 'Reflective book page', 'This surface reads only current pigment states and illumination. It can show a requested page, an older retained page, a partial update or no visible content in darkness.', [0,0,0], reader);
  const inkSheet = lightSurface(kit.box([2.16,2.88,.02], [0,.18,.058], 'cream', page));
  const bitmap = new Uint8Array(READER_PAGE.cells * 4), pageTexture = new THREE.DataTexture(bitmap,72,96,THREE.RGBAFormat);
  pageTexture.colorSpace = THREE.SRGBColorSpace;pageTexture.minFilter = pageTexture.magFilter = THREE.NearestFilter;pageTexture.flipY = false;pageTexture.generateMipmaps = false;
  const pageMaterial = new THREE.MeshBasicMaterial({map: pageTexture, toneMapped: false});pageMaterial.addEventListener('dispose', () => pageTexture.dispose());
  const pageSurface = new THREE.Mesh(new THREE.PlaneGeometry(2.16,2.88), pageMaterial);pageSurface.position.set(0,.18,.0685);page.add(pageSurface);
  const pageRow = glass(kit.box([2.16,.009,.002], [0,0,.071], 'gold', backplane), .75);
  const selectedMarker = kit.ring(.031,.004,[0,0,.073],'gold',backplane);
  const touch = kit.part('touch', 'Touch surface and reading input', 'A transparent touch layer lies above the ink. The book and page controls stand in for reading commands. This lesson does not simulate its sensing electronics.', [0,0,0], reader);
  const touchSheet = glass(kit.box([2.16,2.88,.015], [0,.18,.0775], 'blue', touch), .018);outline(touchSheet, BLUE);
  const frontlight = kit.part('frontlight', 'E-reader front-light panel', 'LEDs along the lower edge inject light into a transparent guide above the display. Extraction directs light down onto the reflective ink. Device power is required for the LEDs.', [0,0,0], reader);
  const guide = glass(kit.box([2.16,2.88,.05], [0,.18,.110], 'cream', frontlight), .025);outline(guide, GOLD);
  const ledStrip = kit.box([2.12,.07,.035], [0,-1.305,.11], 'metal', frontlight);
  const leds = [-.90,-.54,-.18,.18,.54,.90].map(x => lightSurface(kit.box([.06,.025,.03], [x,-1.27,.11], 'cream', frontlight)));
  const ledFeed = wire(kit, frontlight, [[.62,-.785,-.069],[1.01,-.785,-.069],[1.01,-1.35,-.069],[1.01,-1.35,.11],[1.01,-1.34,.11]], 'red');
  const ledReturn = wire(kit, frontlight, [[.42,-.70,-.05],[.30,-.70,-.05],[.30,-.87,-.05],[-1.01,-.87,-.05],[-1.01,-1.35,-.05],[-1.01,-1.35,.11],[-1.01,-1.34,.11]], 'ink');
  return {system,reader,casing,rear,bezel,supports,powerIndicator,electronics,board,powerChip,battery,batteryCell,terminals,supplyLeads,memory,memoryChip,processor,processorChip,processorLabel,framebuffer,bufferChip,bufferLabel,dataLeads,driver,driverChip,ribbon,backplane,substrate,electrodes,activeBackRow,page,inkSheet,bitmap,pageTexture,pageSurface,pageRow,selectedMarker,touch,touchSheet,frontlight,guide,ledStrip,leds,ledFeed,ledReturn};
}

function buildCapsule(kit, system) {
  const capsule = kit.part('capsule', 'Selected pigment cell', 'An enlarged illustrative capsule under the indicated pixel. Positive black and negative white follow the current Carta convention. The model does not assume one capsule per real pixel.', [0,0,0], system);
  capsule.userData.inspectionOnly = 'capsule';capsule.userData.explosionExcluded = true;
  const shell = glass(kit.sphere(.80,[0,0,0],'blue',capsule), .055);
  const common = glass(kit.box([1.9,1.9,.04],[0,0,.85],'blue',capsule), .07);outline(common, BLUE);
  const pixelElectrode = kit.box([1.9,1.9,.04],[0,0,-.85],'metal',capsule);outline(pixelElectrode, GOLD);
  const black = [], white = [];
  for (const x of [-.36,-.12,.12,.36]) {black.push(kit.sphere(.075,[x,-.18,-.50],'ink',capsule));white.push(kit.sphere(.075,[x,.18,.50],'cream',capsule));}
  const blackArrow = arrow(kit,capsule,[1.25,-.15,-.32],[1.25,-.15,.32],DARK,.025);
  const whiteArrow = arrow(kit,capsule,[-1.25,.15,.32],[-1.25,.15,-.32],BLUE,.025);
  label(capsule,'Selected pigment cell',[0,1.25,.1],3.0,.22);
  const pixelLabel = label(capsule,'Row 1 · column 1',[0,-1.31,.1],3.25,.18);
  const pigmentLabel = label(capsule,'White at front',[0,-1.56,.1],3.25,.18);
  label(capsule,'Black +',[1.25,-.65,.1],.9,.16);label(capsule,'White −',[-1.25,-.65,.1],.9,.16);
  return {capsule,shell,common,pixelElectrode,black,white,blackArrow,whiteArrow,pixelLabel,pigmentLabel};
}

function buildLighting(kit, system) {
  const lightpath = kit.part('lightpath', 'Front-light path through the guide', 'An enlarged cross-section follows edge LED light through internal reflections, down onto the page and back toward the reader. Arrows are selected explanatory paths, not a complete optical calculation.', [0,0,0], system);
  lightpath.userData.inspectionOnly = 'lightpath';lightpath.userData.explosionExcluded = true;
  const opticalGuide = glass(kit.box([4.4,.60,.42],[0,.15,0],'blue',lightpath), .13);outline(opticalGuide, BLUE);
  const opticalTouch = glass(kit.box([4.4,.12,.42],[0,-.56,0],'blue',lightpath), .16);outline(opticalTouch, BLUE);
  const opticalPage = lightSurface(kit.box([4.4,.22,.42],[0,-1.03,0],'cream',lightpath));outline(opticalPage, DARK);
  const emitter = lightSurface(kit.box([.32,.42,.45],[-2.46,.15,0],'cream',lightpath));
  const guidedPoints = [[-2.30,.15,.245],[-2.20,.15,.245],[-1.70,.45,.245],[-.70,-.15,.245],[.30,.45,.245],[1.30,-.15,.245]];
  const guided = new THREE.Group();lightpath.add(guided);const guideRays = wire(kit,guided,guidedPoints,'gold',.018);
  const extractor = kit.sphere(.033,[1.30,-.15,.245],'gold',lightpath), hit = [1.54,-.92,.245], outgoing = [1.54+(1.15+.92)*(.24/.77),1.15,.245];
  const extraction = arrow(kit,lightpath,[1.30,-.15,.245],hit,GOLD,.018), reflection = arrow(kit,lightpath,hit,outgoing,GOLD,.018);
  label(lightpath,'Edge LED',[-2.46,-.28,.26],1.1,.18);
  label(lightpath,'Light guide',[0,.79,.26],2.5,.20);
  label(lightpath,'Touch sheet',[-1.1,-.75,.26],1.6,.16);
  label(lightpath,'Reflective page',[0,-1.40,.26],3.0,.20);
  label(lightpath,'Toward reader',[1.55,1.42,.26],2.4,.18);
  const lightLabel = label(lightpath,'Front light off',[-.80,1.12,.26],2.6,.18);
  return {lightpath,opticalGuide,opticalTouch,opticalPage,emitter,guided,guidedPoints,guideRays,extractor,extraction,reflection,hit,outgoing,lightLabel};
}

function updateReaderGeometry(g, state) {
  const {values, now} = state;
  for (let index = 0; index < READER_PAGE.cells; index++) {
    const row = Math.floor(index / 72), column = index % 72, offset = ((95-row)*72+column)*4;
    const shade = Math.round(now.illumination * (245-(245-22)*now.pixels[index]));
    g.bitmap[offset]=g.bitmap[offset+1]=g.bitmap[offset+2]=shade;g.bitmap[offset+3]=255;
  }
  g.pageTexture.needsUpdate = true;g.inkSheet.material.color.setRGB(now.illumination*.9,now.illumination*.9,now.illumination*.9);
  const [selectedX,selectedY] = screenPoint(now.selected);
  g.selectedMarker.position.set(selectedX,selectedY,.073);g.selectedMarker.visible = now.activeRow >= 0;
  for (const marker of [g.activeBackRow,g.pageRow]) {marker.visible = now.activeRow >= 0;marker.position.y = 1.62-(now.activeRow+.5)*.03;}
  g.powerIndicator.material.color.setHex(values.power ? 0x75ad61 : 0x263427);
  g.memoryChip.material.color.setHex(now.stage === 'Reading stored text' ? 0x9b743e : DARK);
  g.processorChip.material.color.setHex(now.stage === 'Composing pixels' ? 0x9b743e : DARK);
  g.bufferChip.material.color.setHex(now.framebufferReady ? 0x4f725f : DARK);
  g.driverChip.material.color.setHex(now.activeRow >= 0 ? 0x9b743e : DARK);
  g.powerChip.material.color.setHex(values.power ? 0x496e48 : DARK);
  g.processorLabel.userData.setText(!values.power ? 'Off' : now.stage === 'Reading stored text' ? 'Read text' : now.stage === 'Composing pixels' ? 'Lay out' : 'Ready');
  g.bufferLabel.userData.setText(!values.power ? 'Off' : now.framebufferReady ? 'Pixels ready' : 'Waiting');
  for (const led of [...g.leds,g.emitter]) led.material.color.setRGB(.08+.92*now.frontLight,.09+.85*now.frontLight,.07+.64*now.frontLight);
  const pigment = now.pixels[now.selected];g.black.forEach(mesh => {mesh.position.z = -.50+pigment;});g.white.forEach(mesh => {mesh.position.z = .50-pigment;});
  g.blackArrow.position.z = now.direction >= 0 ? -.32 : .32;g.whiteArrow.position.z = now.direction >= 0 ? .32 : -.32;
  g.blackArrow.userData.setDirection(new THREE.Vector3(0,0,now.direction || 1));g.whiteArrow.userData.setDirection(new THREE.Vector3(0,0,-now.direction || -1));
  for (const item of [g.blackArrow,g.whiteArrow]) item.userData.setLength(now.direction ? .64 : 0);
  g.pixelLabel.userData.setText(`Row ${Math.floor(now.selected/72)+1} · column ${now.selected%72+1}`);
  g.pigmentLabel.userData.setText(pigment < 1e-10 ? 'White at front' : pigment > 1-1e-10 ? 'Black at front' : 'Pigment between states');
  g.guided.visible = now.frontLight > 0;
  for (const item of [g.extraction,g.reflection]) item.userData.setLength(now.frontLight ? item.userData.nominalLength : 0);
  g.opticalPage.material.color.setRGB(now.illumination*.94,now.illumination*.94,now.illumination*.94);
  g.lightLabel.userData.setText(now.frontLight ? `Front light: ${values.frontlight === 1 ? 'Low' : 'Bright'}` : values.power ? 'Front light off' : 'No device power');
}

export function createEReaderModel() {
  const kit = houseModel('E-reader'), hardware = buildReader(kit), g = {...hardware,...buildCapsule(kit,hardware.system),...buildLighting(kit,hardware.system)}, controller = createReaderController();
  const choices = labels => labels.map((label,value) => ({label,value}));
  const controls = {
    book: ['Stored book', READER_BOOKS.map(book=>book.title), 'Choose a stored miniature book. The request waits for writing; the existing pigment page stays until updated.'],
    page: ['Requested page', ['Page 1','Page 2'], 'Turn forward or back within the selected book, then press Play to write the requested page.'],
    power: ['Device power', ['Off','On'], 'Off stops the update and front-light LEDs. Ink retains its current complete or partial image. Reconnect and press Play to fulfill a pending request.'],
    ambient: ['Ambient light', ['Off','On'], 'Room light reveals the reflective page without moving pigment. Hardware and enlarged views stay lit for inspection.'],
    frontlight: ['Front light', ['Off','Low','Bright'], 'Powered edge LEDs illuminate the page from above through a guide. This changes visibility without rewriting pixels.'],
  };
  for (const key of Object.keys(READER_DEFAULTS)) {const [name,options,help]=controls[key];kit.control(key,name,...READER_DOMAINS[key],READER_DEFAULTS[key],'',help,choices(options),{primary:key==='book'});}
  const result = kit.finish(() => {
    const state = controller.getState(), {values,now} = state;updateReaderGeometry(g,state);
    const requested = READER_BOOKS[values.book].pages[values.page], stored = now.readback.name;
    const visible = !now.visible ? 'Page dark; image retained' : now.pending ? `${stored}; ${values.power ? 'update pending' : 'request waiting'}` : stored;
    return {state:{...state,time:state.clock},readings:[
      reading('Your result',visible,!now.visible?'The ink does not emit light. Turn on ambient light, or power the front light, to reveal its current image.':now.pending?'The displayed material image and requested page differ. Press Play with Device power On to finish the update.':'The readable page comes from current material pixels. Pixel drive is zero after writing.'),
      reading('Stored in the ink',stored,now.readback.complete?READER_BOOKS[now.readback.book].pages[now.readback.page].lines.join(' '):'A blank or partly updated physical image can remain when power is removed.'),
      reading('Requested page',requested.name,`${now.matchedPixels} of ${READER_PAGE.cells} teaching pixels currently match. Stored book text, framebuffer and pigment image are separate states.`),
      reading('Reader operation',now.stage,now.activeRow>=0?`Row ${now.activeRow+1} of 96 is active; ${now.writtenPixels} of ${now.changedPixels} changed pixels have reached their targets.`:'Retrieval, page composition and the row schedule are explanatory scene timing, not measured device performance.'),
      reading('Pixel drive',now.activeRow>=0?'Writing selected row':'Off',`Selected cell: row ${Math.floor(now.selected/72)+1}, column ${now.selected%72+1}. ${now.direction>0?'Black moves toward the front.':now.direction<0?'White moves toward the front.':'Its pigments keep their current state.'}`),
      reading('Page illumination',!now.visible?'None':values.ambient?'Ambient light'+(now.frontLight?' and front light':''):`Front light ${values.frontlight===1?'Low':'Bright'}`,now.frontLight?'The LED guide sends light down onto the ink. Reflected light returns toward the reader.':'Device power is required for front-light LEDs. Ambient light can reveal ink even when device power is Off.'),
    ]};
  });
  const render = result.update;let previousTime=0,disposed=false;const sync=()=>render(controller.getState().values);
  result.update=(input={})=>{controller.update(input);return sync();};
  result.reset=(initial={})=>{controller.reset(initial);previousTime=0;return sync();};
  result.advance=seconds=>{if(Number.isFinite(seconds)&&seconds>0)controller.advance(seconds);return sync();};
  result.animate=time=>{const delta=Number.isFinite(time)?Math.max(0,time-previousTime):0;if(Number.isFinite(time))previousTime=time;return result.advance(delta);};
  result.replayState=controller.replayState;
  result.playback={label:'Write the requested page',description:'Read stored text, prepare pixels and update the reflective page. An unpowered request waits without erasing the current image.',stepLabel:'Advance page update',advance:result.advance,step:()=>result.advance(.15),complete:()=>result.getState().now.complete,blocked:()=>false};
  result.actions=[['Inspect: complete reader','reader'],['Inspect: stored books','memory'],['Inspect: display driver','driver'],['Inspect: readable page','page'],['Inspect: selected pigment cell','capsule'],['Inspect: front-light path','lightpath']].map(([label,part])=>({label,part,isolate:true,view:'front',replay:false,run:()=>sync()}));
  result.resultPart={id:'page',label:'Read the current page',view:'front',focusOnComplete:false,preserveOnReset:true,available:()=>true};
  result.covers.push(g.backplane,g.page,g.touch,g.frontlight);result.initialCutaway=false;
  result.initialPart='reader';result.initialView='front';result.initialIsolated=true;result.frameVisibleOnly=true;result.framePadding=.56;result.selectionOutline=false;result.transparentBackground=true;
  kit.root.updateMatrixWorld(true);
  const readerBounds=new THREE.Box3().setFromObject(g.reader),size=readerBounds.getSize(new THREE.Vector3()),center=readerBounds.getCenter(new THREE.Vector3());
  for(const detail of [g.capsule,g.lightpath])detail.position.add(center.clone().sub(new THREE.Box3().setFromObject(detail).getCenter(new THREE.Vector3())));
  kit.root.updateMatrixWorld(true);const rootSize=new THREE.Box3().setFromObject(kit.root).getSize(new THREE.Vector3());
  result.overviewZoom=Math.max(rootSize.x,rootSize.y,rootSize.z)*.7/(Math.max(size.x,size.y,size.z)*.56);
  result.viewDirections={front:[.20,.15,8],iso:[3,2.8,6]};
  result.partViewDirections=Object.fromEntries(result.parts.map(part=>[part.id,{front:part.id==='capsule'?[2,-3,6]:part.id==='page'||part.id==='lightpath'?[0,0,6]:[.20,.15,8]}]));
  for(const part of result.parts)part.framePadding=['system','reader','capsule'].includes(part.id)?.56:.60;
  result.inspectionObjects=id=>id==='capsule'?[g.capsule]:id==='lightpath'?[g.lightpath]:[];
  result.thumbnailOmit=[g.capsule,g.lightpath];result.catalogParts=result.parts.filter(part=>!['system','reader'].includes(part.id));result.topology=g;
  const dispose=result.dispose;result.dispose=()=>{if(!disposed){disposed=true;dispose();}};return result;
}

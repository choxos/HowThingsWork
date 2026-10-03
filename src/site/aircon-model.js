import * as THREE from 'three';
import {houseModel, reading as r} from './house-model-kit.js';
import {fixed} from './format.js';
import {clamp} from './physics-kit.js';
import {chartText, fillLine, lineObject, segmentLines, solidArrow, textLabel} from './scene-kit.js';
import {
  airconPlan, airconAt, roomAt, relativeHumidity, saturatedRatio, buckPressure, humidityRatio, waterLatent, dewPointOf, vaporPressureOf,
  AIRCON_DEFAULTS, AIRCON_DOMAINS, AIR, DECLARED, R410A, RATED, WATER, MOLAR_RATIO, GAMMA,
} from './aircon-physics.js';

// ---------------------------------------------------------------------------
// Air conditioner: the indoor and outdoor units cut open at representative size with the
// refrigerant running between them, what the air does crossing the cold coil,
// and the room through a cool down.
//
// Scale: both units are drawn at representative size, 1 mm to 0.002 scene units, the
// indoor unit 840 by 295 mm and the outdoor unit 800 by 550 mm, everything
// inside them illustrative in size and place. The two charts are not to scale.
//
// Time: the run plays 60 times faster than the real thing, said in the part
// text and in a reading.
// ---------------------------------------------------------------------------

export const MM = 0.002;

/** The indoor unit, mm about the middle of its casing: the casing, the cold coil, the fan, the drain pan and its pipe. */
export const INDOOR = Object.freeze({
  origin: Object.freeze([-1.12, 0.75, 0]),
  casing: Object.freeze([840, 295, 205]),
  coil: Object.freeze([-350, 350, 25, 112]), tubes: 7, tube: 9,
  fan: Object.freeze([0, -43, 45]), blades: 18,
  pan: Object.freeze([-380, 380, -120, -108]), drain: Object.freeze([-375, -365, -300, -120]),
  inlet: Object.freeze([-140, 120]), outlet: Object.freeze([150, -118]),
});

/** The outdoor unit, mm about the middle of its casing: the casing, the hot coil, the fan and the compressor. */
export const OUTDOOR = Object.freeze({
  origin: Object.freeze([1.12, 0.62, 0]),
  casing: Object.freeze([800, 550, 300]),
  coil: Object.freeze([-330, -230, -230, 230]), tubes: 9, tube: 9,
  fan: Object.freeze([60, 90, 175]), blades: 5,
  compressor: Object.freeze([-40, -170, 95]),
});

/** The refrigerant's way round, as corners in scene units, and how many markers ride it. */
export const LOOP = Object.freeze({markers: 36, thickness: 0.012, marker: 0.019});

/** What the air does crossing the coil, drawn as a psychrometric chart: where it sits, its size, and the ranges it spans. */
export const PSYCHRO = Object.freeze({
  x: -1.95, y: -1.12, w: 1.62, h: 0.74,
  temperature: Object.freeze([-15, 40]), ratio: Object.freeze([0, 0.036]), curve: 111, tickEvery: 10, tick: 0.022, dot: 0.026,
});

/** The room through the run: where the chart sits, its size, and the two scales it carries. */
export const CHART = Object.freeze({
  x: 0.33, y: -1.12, w: 1.62, h: 0.74,
  temperature: Object.freeze([15, 35]), humidity: Object.freeze([0, 100]), tickEvery: 300, tick: 0.022, mark: 0.03, cursor: 0.022,
});

export const COLORS = Object.freeze({
  casing: 0xe9e4d8, shell: 0x2f3336, inside: 0xf3ede1, metal: 0xb4c5b0, faint: 0x9aa39a, chart: 0x374736,
  cold: 0x3f7fbf, hot: 0xc14f39, warm: 0xe3b45e, liquid: 0x7d5ba6, vapor: 0x86a5bf,
  water: 0x3f7fbf, air: 0xf0dfaf, set: 0x7d5ba6, comfort: 0xa9bfd6, dew: 0x7d5ba6, ice: 0x83b4c1,
});

/** Where a temperature and a humidity ratio fall on the psychrometric chart. */
export const psychroX = celsius => PSYCHRO.x + clamp((celsius - PSYCHRO.temperature[0]) / (PSYCHRO.temperature[1] - PSYCHRO.temperature[0])) * PSYCHRO.w;
export const psychroY = ratio => PSYCHRO.y + clamp((ratio - PSYCHRO.ratio[0]) / (PSYCHRO.ratio[1] - PSYCHRO.ratio[0])) * PSYCHRO.h;
/** Where a time, a temperature and a relative humidity fall on the room chart. */
export const chartX = (plan, t) => CHART.x + clamp(t / plan.duration) * CHART.w;
export const chartY = celsius => CHART.y + clamp((celsius - CHART.temperature[0]) / (CHART.temperature[1] - CHART.temperature[0])) * CHART.h;
export const humidityY = percent => CHART.y + clamp((percent - CHART.humidity[0]) / (CHART.humidity[1] - CHART.humidity[0])) * CHART.h;

const cold = new THREE.Color(COLORS.cold), hot = new THREE.Color(COLORS.hot);
/** The color of refrigerant or air at `celsius`, between the two ends of the loop's range. */
export const heatColor = celsius => cold.clone().lerp(hot, clamp((celsius - 0) / 60));

export function createAirConditionerModel() {
  const kit = houseModel('Air conditioner'), {part, control, finish} = kit;
  let clock = 0, lastClock = 0, disposed = false;
  const unlit = (color, extra = {}) => new THREE.MeshBasicMaterial({color, ...extra});
  const flat = (color, parent, extra) => { const mesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), unlit(color, extra)); parent.add(mesh); return mesh; };
  const rect = (mesh, x0, x1, y0, y1, z = 0) => { mesh.position.set((x0 + x1) / 2, (y0 + y1) / 2, z); mesh.scale.set(Math.max(1e-9, x1 - x0), Math.max(1e-9, y1 - y0), 1); };
  const millimeters = (mesh, x0, x1, y0, y1, z = 0) => rect(mesh, x0 * MM, x1 * MM, y0 * MM, y1 * MM, z);
  const outline = (line, x0, x1, y0, y1, z, scale = MM) => fillLine(line, [[x0, y0], [x1, y0], [x1, y1], [x0, y1], [x0, y0]].map(([x, y]) => [x * scale, y * scale, z]));
  const circlePoints = (cx, cy, radius, count, z, scale = MM) => Array.from({length: count}, (_, i) => { const a = 2 * Math.PI * i / (count - 1); return [(cx + radius * Math.cos(a)) * scale, (cy + radius * Math.sin(a)) * scale, z]; });

  const solidBox = (color, parent) => {
    const object = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial({color, roughness: 0.7}));
    parent.add(object); return object;
  };
  const volume = (object, x0, x1, y0, y1, z0, z1) => {
    object.position.set((x0+x1)*MM/2,(y0+y1)*MM/2,(z0+z1)*MM/2);
    object.scale.set((x1-x0)*MM,(y1-y0)*MM,(z1-z0)*MM);
  };
  const pipe = (points, radius, color, parent) => {
    const curve = new THREE.CurvePath();
    for(let i=1;i<points.length;i++) curve.add(new THREE.LineCurve3(new THREE.Vector3(...points[i-1]),new THREE.Vector3(...points[i])));
    const mesh = new THREE.Mesh(new THREE.TubeGeometry(curve,Math.max(64,points.length*12),radius,10,false),new THREE.MeshStandardMaterial({color,roughness:0.45,metalness:0.3}));
    mesh.userData.centerline=curve;mesh.userData.points=points;parent.add(mesh);return mesh;
  };
  const serpentine = (bounds, count, z) => {
    const [left,right,bottom,top]=bounds,points=[];
    for(let i=0;i<count;i++){
      const y=bottom+(top-bottom)*i/(count-1),xs=i%2?[right,left]:[left,right];
      points.push(...xs.map(x=>[x*MM,y*MM,z]));
    }
    return points;
  };
  const shell = (parent, dimensions) => {
    const [w,h,depth]=dimensions,back=solidBox(COLORS.casing,parent),walls=[];
    volume(back,-w/2,w/2,-h/2,h/2,-depth/2,-depth/2+5);
    for(const bounds of [[-w/2,-w/2+5,-h/2,h/2],[w/2-5,w/2,-h/2,h/2],[-w/2,w/2,-h/2,-h/2+5]]){
      const wall=solidBox(COLORS.casing,parent);volume(wall,...bounds,-depth/2,depth/2);walls.push(wall);
    }
    return {back,walls};
  };
  const [indoorW, indoorH] = INDOOR.casing, [outdoorW, outdoorH] = OUTDOOR.casing;
  const system = part('system', 'Air conditioner, cut open', `Both units cut open at representative size, the indoor one ${fixed(indoorW, 0)} mm wide and the outdoor one ${fixed(outdoorH, 0)} mm tall, everything inside them illustrative: the cold coil and fan indoors, the compressor, hot coil and fan outdoors, and the refrigerant running between them. Beneath, what the room's air does crossing the cold coil, and the room through a cool down. Press Play to switch it on: the run plays ${DECLARED.slower} times faster than the real thing.`);

  // The indoor unit, cut open.
  const indoor = part('indoor', 'Indoor unit, cut open', `The indoor unit, ${fixed(indoorW, 0)} mm by ${fixed(indoorH, 0)} mm, drawn at representative size and cut open from the front. Room air is drawn in at the top, crosses the cold coil, and is blown back out at the bottom, colder and, when the coil is below its dew point, drier.`, INDOOR.origin, system);
  const indoorShell = shell(indoor, INDOOR.casing), indoorBoard = indoorShell.back;
  const indoorLine = lineObject(5, COLORS.shell, indoor);
  outline(indoorLine, -indoorW / 2, indoorW / 2, -indoorH / 2, indoorH / 2, -0.008);

  const evaporator = part('evaporator', 'Cold coil', `The coil the refrigerant boils in, ${INDOOR.tubes} tubes across the airflow. It is colder than the room air, so heat runs into it, and any water the air cannot keep at that temperature condenses on it. Its color follows the temperature the refrigerant boils at.`, INDOOR.origin, system);
  const [coil0, coil1, coilLow, coilHigh] = INDOOR.coil;
  const evaporatorPath = serpentine(INDOOR.coil,INDOOR.tubes,0.03);
  const coilTubes = [pipe(evaporatorPath,INDOOR.tube*MM/2,COLORS.cold,evaporator)];
  const coilFins=[];
  for(let x=coil0+12;x<coil1;x+=24){const fin=solidBox(COLORS.metal,evaporator);volume(fin,x-1,x+1,coilLow-6,coilHigh+6,-50,28);coilFins.push(fin);}
  const frost = lineObject(5, COLORS.ice, evaporator);
  outline(frost, coil0 - 14, coil1 + 14, coilLow - 14, coilHigh + 14, -0.005);

  const fanPart = part('fan', 'Indoor fan', `The fan that pulls room air over the cold coil and pushes it back out. How much air it moves decides how much of the coil's work goes into cooling the air and how much into drying it: the less air, the colder the coil runs and the more of what it takes out is water.`, INDOOR.origin, system);
  const [fanX, fanY, fanR] = INDOOR.fan;
  const rotor = new THREE.Group();
  rotor.position.set(fanX*MM,fanY*MM,0);fanPart.add(rotor);
  const fanLength=650*MM,fanRadius=fanR*MM;
  const fanRing=kit.ring(fanRadius,0.007,[-fanLength/2,fanY*MM,0],COLORS.shell,fanPart);fanRing.rotation.y=Math.PI/2;
  const farRing=kit.ring(fanRadius,0.007,[fanLength/2,fanY*MM,0],COLORS.shell,fanPart);farRing.rotation.y=Math.PI/2;
  const shaft=kit.rod([-fanLength/2-0.025,0,0],[fanLength/2+0.025,0,0],0.009,COLORS.shell,rotor);
  const blades=new THREE.Group();rotor.add(blades);
  for(let i=0;i<INDOOR.blades;i++){
    const angle=i*2*Math.PI/INDOOR.blades,blade=kit.box([fanLength,0.009,0.024],[0,fanRadius*0.88*Math.cos(angle),fanRadius*0.88*Math.sin(angle)],COLORS.metal,blades);
    blade.rotation.x=angle+0.4;
  }
  for(const x of [-fanLength/2,0,fanLength/2]){const support=kit.disk(fanRadius,0.006,[x,0,0],COLORS.metal,rotor);support.rotation.set(0,0,Math.PI/2);}
  const airIn = solidArrow(kit, COLORS.air, fanPart, 0.008), airOut = solidArrow(kit, COLORS.cold, fanPart, 0.008);
  airIn.position.set(INDOOR.inlet[0] * MM, (indoorH / 2 + 60) * MM, -0.004);
  airIn.userData.setDirection(new THREE.Vector3(0, -1, 0));
  airOut.position.set(INDOOR.outlet[0] * MM, INDOOR.outlet[1] * MM, -0.004);
  airOut.userData.setDirection(new THREE.Vector3(0, -1, 0));

  const drain = part('drain', 'Drain pan and pipe', 'The pan under the coil that catches the water condensing on it, and the pipe that carries it outside. The drops appear only while the coil is below the dew point of the air reaching it.', INDOOR.origin, system);
  const [pan0, pan1, panLow, panHigh] = INDOOR.pan;
  const panBody = solidBox(COLORS.metal,drain);
  volume(panBody,pan0,pan1,panLow,panHigh,-65,65);
  for(const y of [panLow,panHigh]){const lip=solidBox(COLORS.metal,drain);volume(lip,pan0,pan1,y,y+3,-65,65);}
  const [drain0,drain1,drainLow,drainHigh]=INDOOR.drain;
  const drainPipe=pipe([[(drain0+drain1)*MM/2,drainHigh*MM,0],[(drain0+drain1)*MM/2,drainLow*MM,0]],(drain1-drain0)*MM/2,COLORS.metal,drain);
  const drops=Array.from({length:7},()=>{const drop=kit.sphere(0.009,[0,0,0],COLORS.water,drain);drop.scale.y=1.5;drop.userData.explosionExcluded=true;drop.raycast=()=>{};return drop;});

  // The outdoor unit, cut open.
  const outdoor = part('outdoor', 'Outdoor unit, cut open', `The outdoor unit, ${fixed(outdoorW, 0)} mm by ${fixed(outdoorH, 0)} mm, drawn at representative size and cut open. Everything the cold coil took out of the room, and everything the compressor put in, leaves here into the outdoor air, which is why the unit blows hot and why a hot day makes the whole loop work harder.`, OUTDOOR.origin, system);
  const outdoorShell=shell(outdoor,OUTDOOR.casing),outdoorBoard=outdoorShell.back;
  const outdoorLine = lineObject(5, COLORS.shell, outdoor);
  outline(outdoorLine, -outdoorW / 2, outdoorW / 2, -outdoorH / 2, outdoorH / 2, -0.008);

  const condenser = part('condenser', 'Hot coil', `The coil the refrigerant condenses in, ${OUTDOOR.tubes} tubes deep against the outdoor air. It has to sit above the outdoor air to give its heat away, so the hotter the day, the hotter the refrigerant has to be squeezed, and the harder the compressor has to work. Its color follows the condensing temperature.`, OUTDOOR.origin, system);
  const [cond0,cond1,condLow,condHigh]=OUTDOOR.coil;
  const condenserPath=serpentine(OUTDOOR.coil,OUTDOOR.tubes,0.05);
  const condTubes=[pipe(condenserPath,OUTDOOR.tube*MM/2,COLORS.hot,condenser)];
  const condenserFins=[];
  for(let x=cond0+5;x<cond1;x+=10){const fin=solidBox(COLORS.metal,condenser);volume(fin,x-0.7,x+0.7,condLow-8,condHigh+8,-90,35);condenserFins.push(fin);}
  const outFanPart = part('outdoor-fan', 'Outdoor fan', 'The fan that drags outdoor air through the hot coil and throws it out of the front. Without it the coil would have to run far hotter to shed the same heat.', OUTDOOR.origin, system);
  const [oFanX, oFanY, oFanR] = OUTDOOR.fan;
  const outFanRing=kit.ring(oFanR*MM,0.012,[oFanX*MM,oFanY*MM,0.10],COLORS.shell,outFanPart);
  const outRotor=new THREE.Group();outRotor.position.set(oFanX*MM,oFanY*MM,0.10);outFanPart.add(outRotor);
  const outBlades=new THREE.Group();outRotor.add(outBlades);
  kit.disk(oFanR*MM*0.15,0.08,[0,0,0],COLORS.shell,outRotor);
  kit.rod([0,0,-0.24],[0,0,0.035],0.015,COLORS.shell,outRotor);
  for(let i=0;i<OUTDOOR.blades;i++){
    const angle=i*2*Math.PI/OUTDOOR.blades,blade=kit.box([oFanR*MM*0.75,oFanR*MM*0.25,0.018],[oFanR*MM*0.52*Math.cos(angle),oFanR*MM*0.52*Math.sin(angle),0],COLORS.metal,outBlades);
    blade.rotation.set(0.3,0,angle);
  }
  const outdoorArrow = solidArrow(kit, COLORS.hot, outFanPart, 0.008);
  outdoorArrow.position.set(oFanX*MM,oFanY*MM,0.16);
  outdoorArrow.userData.setDirection(new THREE.Vector3(0, 0, 1));

  const compressor = part('compressor', 'Compressor', `The pump that drives the whole loop: it swallows low pressure vapor from the cold coil and squeezes it up to the pressure at which it will condense against the outdoor air. Everything it puts in has to leave through the hot coil as well, which is why the outdoor unit always sheds more than the room loses.`, OUTDOOR.origin, system);
  const [compX, compY, compR] = OUTDOOR.compressor;
  const compressorBody=kit.cylinder(compR*MM*0.64,compR*MM*1.6,[compX*MM,compY*MM,0],COLORS.shell,compressor);
  const compressorRing=kit.ring(compR*MM*0.64,0.012,[compX*MM,(compY+compR*0.8)*MM,0],COLORS.metal,compressor);compressorRing.rotation.x=Math.PI/2;
  const crank=new THREE.Group();crank.position.set(compX*MM,compY*MM,0);compressor.add(crank);
  const crankArm=kit.cylinder(0.017,0.07,[0,compR*MM*0.9,0],COLORS.metal,crank);
  for(const x of [-1,1])kit.box([0.09,0.025,0.13],[(compX+x*55)*MM,(compY-compR*0.83)*MM,0],COLORS.metal,compressor);

  const expansion = part('expansion', 'Expansion valve', `The narrow way between the high pressure side and the low pressure side. Liquid squeezes through it and drops straight to the boiling pressure of the cold coil, and part of it flashes to vapor as it does, which is what makes the rest cold enough to take heat out of the room.`, [0, 0.62, 0], system);
  const expansionMark=kit.box([0.085,0.065,0.08],[0,0,0.09],COLORS.liquid,expansion);
  kit.cylinder(0.027,0.075,[0,0.06,0.09],COLORS.metal,expansion);

  // The refrigerant's way round.
  const loopPart = part('loop', 'Refrigerant loop', `The one closed circuit the refrigerant never leaves: cold vapor from the coil indoors to the compressor, hot vapor from the compressor to the coil outdoors, warm liquid back to the expansion valve, and a cold liquid and vapor mixture from there to the coil indoors again. The markers carry the color of the refrigerant on that leg and are drawn going round once every ${fixed(DECLARED.lap, 0)} s of the run.`, [0, 0, 0], system);
  const absolute=(point,origin)=>point.map((value,i)=>value+origin[i]);
  const evaporatorIn=absolute(evaporatorPath[0],INDOOR.origin),evaporatorOut=absolute(evaporatorPath.at(-1),INDOOR.origin);
  const condenserIn=absolute(condenserPath[0],OUTDOOR.origin),condenserOut=absolute(condenserPath.at(-1),OUTDOOR.origin);
  const suction=[OUTDOOR.origin[0]+(compX-55)*MM,OUTDOOR.origin[1]+compY*MM,0.08];
  const discharge=[OUTDOOR.origin[0]+(compX+55)*MM,OUTDOOR.origin[1]+(compY+45)*MM,0.08];
  const valveIn=[0,0.62-0.0325,0.09],valveOut=[0,0.62+0.0325,0.09];
  const circuits=[
    {phase:'evaporator',points:evaporatorPath.map(p=>absolute(p,INDOOR.origin)),mesh:coilTubes[0]},
    {phase:'suction',points:[evaporatorOut,[evaporatorOut[0]+0.08,evaporatorOut[1],0.03],[evaporatorOut[0]+0.08,0.18,0.13],[suction[0],0.18,0.13],suction]},
    {phase:'compressor',points:[suction,discharge]},
    {phase:'discharge',points:[discharge,[discharge[0],condenserIn[1]-0.025,0.15],[condenserIn[0],condenserIn[1]-0.025,0.15],condenserIn]},
    {phase:'condenser',points:condenserPath.map(p=>absolute(p,OUTDOOR.origin)),mesh:condTubes[0]},
    {phase:'liquid',points:[condenserOut,[condenserOut[0]+0.06,condenserOut[1],0.05],[condenserOut[0]+0.06,0.02,0.18],[0,0.02,0.18],valveIn]},
    {phase:'valve',points:[valveIn,valveOut]},
    {phase:'feed',points:[valveOut,[-0.23,valveOut[1],0.18],[-0.23,1.10,0.18],[evaporatorIn[0]-0.04,1.10,0.03],[evaporatorIn[0]-0.04,evaporatorIn[1],0.03],evaporatorIn]},
  ];
  kit.rod([suction[0]-OUTDOOR.origin[0],suction[1]-OUTDOOR.origin[1],suction[2]],[compX*MM,compY*MM,0],LOOP.thickness/2,COLORS.metal,compressor);
  kit.rod([discharge[0]-OUTDOOR.origin[0],discharge[1]-OUTDOOR.origin[1],discharge[2]],[compX*MM,(compY+45)*MM,0],LOOP.thickness/2,COLORS.metal,compressor);
  const route=new THREE.CurvePath();
  for(const section of circuits){
    if(!section.mesh && !['compressor','valve'].includes(section.phase))section.mesh=pipe(section.points,LOOP.thickness/2,COLORS.metal,loopPart);
    section.start=route.getLength();
    for(let i=1;i<section.points.length;i++)route.add(new THREE.LineCurve3(new THREE.Vector3(...section.points[i-1]),new THREE.Vector3(...section.points[i])));
    section.end=route.getLength();
  }
  const loopLine=lineObject(circuits.reduce((n,section)=>n+section.points.length-1,1),COLORS.faint,loopPart);
  fillLine(loopLine,[...circuits.flatMap(section=>section.points.slice(0,-1)),circuits.at(-1).points.at(-1)]);
  loopLine.visible=false;loopLine.userData.explosionExcluded=true;
  const markers=Array.from({length:LOOP.markers},()=>{
    const object=kit.sphere(LOOP.marker/2,[0,0,0],COLORS.vapor,loopPart);object.material=object.material.clone();object.userData.explosionExcluded=true;object.raycast=()=>{};return object;
  });

  // What the air does crossing the coil.
  const psychro = part('psychro', 'What the air does crossing the coil', `Every state the room's air can be in: its temperature across, from ${fixed(-PSYCHRO.temperature[0], 0)} °C below zero to ${fixed(PSYCHRO.temperature[1], 0)} °C above, and the water it carries up, from nothing to ${fixed(1000 * PSYCHRO.ratio[1], 0)} grams for each kilogram of dry air. The curve is saturation, the most the air can hold. Air enters at the upper mark, is dragged toward the coil's mark on the curve, and leaves at the mark between them. Moving down means less water vapor; moving left means a lower temperature.`, [0, 0, 0], system);
  const psychroFrame = lineObject(5, COLORS.chart, psychro);
  outline(psychroFrame, PSYCHRO.x, PSYCHRO.x + PSYCHRO.w, PSYCHRO.y, PSYCHRO.y + PSYCHRO.h, 0, 1);
  const saturation = lineObject(PSYCHRO.curve, COLORS.chart, psychro);
  const psychroTicks = segmentLines(4, COLORS.faint, psychro);
  const process = lineObject(3, COLORS.cold, psychro);
  const dewLine = segmentLines(1, COLORS.dew, psychro);
  const enterDot = flat(COLORS.hot, psychro), coilDot = flat(COLORS.cold, psychro), leaveDot = flat(COLORS.liquid, psychro);

  // The room through the run.
  const chartPart = part('chart', 'The room through the run', `What the room reads from the moment the unit is switched on: its temperature on the dark curve, from ${fixed(CHART.temperature[0], 0)} to ${fixed(CHART.temperature[1], 0)} °C, and its relative humidity on the pale one, from ${fixed(CHART.humidity[0], 0)} to ${fixed(CHART.humidity[1], 0)} percent, with a tick every ${fixed(CHART.tickEvery / 60, 0)} minutes. The violet line is your setting and the pale band is the comfort range the Air conditioning page gives.`, [0, 0, 0], system);
  const chartFrame = lineObject(5, COLORS.chart, chartPart);
  outline(chartFrame, CHART.x, CHART.x + CHART.w, CHART.y, CHART.y + CHART.h, 0, 1);
  const comfortBand = flat(COLORS.comfort, chartPart, {transparent: true, opacity: 0.25});
  const setLine = segmentLines(1, COLORS.set, chartPart);
  const chartTicks = segmentLines(Math.ceil(DECLARED.longest / CHART.tickEvery), COLORS.chart, chartPart);
  const guideRoom = lineObject(DECLARED.samples, COLORS.faint, chartPart), guideHumidity = lineObject(DECLARED.samples, COLORS.faint, chartPart);
  const curveRoom = lineObject(DECLARED.samples + 1, COLORS.hot, chartPart), curveHumidity = lineObject(DECLARED.samples + 1, COLORS.cold, chartPart);
  const reachedMark = segmentLines(1, COLORS.set, chartPart), cursor = segmentLines(2, COLORS.chart, chartPart);

  // The charts' words. Titles sit at the charts' left, clear of the leaders that meet their tops.
  const TEXT = 0.058, css = color => `#${color.toString(16).padStart(6, '0')}`;
  const words = (parent, text, x, y, options = {}) => textLabel(parent, text, {height: TEXT, position: [x, y, 0.001], color: css(COLORS.chart), ...options});
  const P = PSYCHRO, signedText = value => `${value < 0 ? '−' : ''}${Math.abs(value)}`;
  chartText(psychro, (celsius, ratio) => [psychroX(celsius), psychroY(ratio), 0], {
    size: TEXT,
    x: {min: P.temperature[0], max: P.temperature[1], title: 'Air temperature, °C', ticks: [-10, 0, 10, 20, 30, 40].map(celsius => [celsius, signedText(celsius)])},
    y: {min: P.ratio[0], max: P.ratio[1], title: 'Water, grams per kg of dry air', ticks: [0, 0.01, 0.02, 0.03].map(ratio => [ratio, fixed(ratio * 1000, 0)])},
    legend: [['Saturation', COLORS.chart], ['Air in', COLORS.hot], ['At the coil', COLORS.cold], ['Air out', COLORS.liquid]], legendAt: [3, P.ratio[1]],
  });
  words(psychro, 'Air crossing the coil', P.x, P.y + P.h + 0.17, {align: 'left', weight: '600'});
  chartText(chartPart, (share, celsius) => [CHART.x + share * CHART.w, chartY(celsius), 0], {
    size: TEXT,
    x: {min: 0, max: 1, title: `Minutes, a tick every ${fixed(CHART.tickEvery / 60, 0)}`, ticks: [[0, '0']]},
    y: {min: CHART.temperature[0], max: CHART.temperature[1], title: '°C', ticks: [15, 20, 25, 30, 35].map(celsius => [celsius, String(celsius)])},
  });
  words(chartPart, 'Room temperature and humidity', CHART.x, CHART.y + CHART.h + 0.17, {align: 'left', weight: '600'});
  [0, 50, 100].forEach(percent => words(chartPart, `${percent}%`, CHART.x + CHART.w + 0.02, humidityY(percent), {align: 'left', color: css(COLORS.cold)}));
  [['Room',COLORS.hot],['Humidity',COLORS.cold],['Setting',COLORS.set],['Comfort band',COLORS.comfort]].forEach(([text,color],i)=>{
    const x=CHART.x+0.23+(i%2)*0.75,y=CHART.y+CHART.h+0.09-Math.floor(i/2)*0.06;
    words(chartPart,text,x,y,{align:'left'});
    const swatch=flat(color,chartPart);rect(swatch,x-0.075,x-0.025,y-0.014,y+0.014,0.002);
  });
  const minuteLabels=Array.from({length:5},(_,i)=>words(chartPart,String((i+1)*5),CHART.x,CHART.y-0.055));
  const endMinute=words(chartPart,'30.0',CHART.x+CHART.w,CHART.y-0.055);
  const indoorTitle=words(system,'Indoor unit',INDOOR.origin[0],1.41,{height:0.09,weight:'600'});
  const outdoorTitle=words(system,'Outdoor unit',OUTDOOR.origin[0],1.41,{height:0.09,weight:'600'});
  const roomLabel=words(system,'Room 28.0 °C',INDOOR.origin[0],1.29,{height:0.075,width:1.9});
  const outsideLabel=words(system,'Outside 35 °C',OUTDOOR.origin[0],1.29,{height:0.075,width:1.9});
  for(const label of [indoorTitle,outdoorTitle,roomLabel,outsideLabel]){label.userData.explosionExcluded=true;label.raycast=()=>{};}
  const leaders = segmentLines(2, COLORS.faint, system);
  leaders.userData.explosionExcluded=true;leaders.raycast=()=>{};

  const connections=part('connections','Connections between units','Refrigerant pipes join the indoor and outdoor units through the expansion valve.',[0,0,0],system);
  const observations=part('observations','Air and room measurements','Two charts compare the air crossing the evaporator with the room during cooling.',[0,0,0],system);
  const groupParts=(parent,children)=>{const owner=kit.parts.find(item=>item.object===parent);for(const object of children){parent.attach(object);kit.parts.find(item=>item.object===object).parentId=owner.id;}};
  kit.root.updateMatrixWorld(true);
  groupParts(indoor,[evaporator,fanPart,drain]);groupParts(outdoor,[condenser,outFanPart,compressor]);
  groupParts(connections,[loopPart,expansion]);groupParts(observations,[psychro,chartPart]);

  const d = AIRCON_DEFAULTS, D = AIRCON_DOMAINS;
  control('room', 'Room air temperature', ...D.room, d.room, '°C', 'How warm the room is when the unit is switched on, and so how warm the air first reaching the cold coil is.');
  control('humidity', 'Relative humidity', ...D.humidity, d.humidity, '%', `How much of the water the room's air could hold at that temperature it is actually holding. This decides the dew point, and so whether the coil takes any water out at all.`);
  control('flow', 'Indoor airflow', ...D.flow, d.flow, 'm³/s', 'How much room air the indoor fan pushes over the coil each second. Less air means a colder coil and a larger share of the work spent drying rather than cooling.');
  control('outdoor', 'Outdoor air temperature', ...D.outdoor, d.outdoor, '°C', 'How warm the air the hot coil has to dump its heat into is. The refrigerant has to be squeezed above this to condense at all.');
  control('volume', 'Room volume', ...D.volume, d.volume, 'm³', 'How much room there is to cool. A larger room holds more heat, so the same unit takes longer over it.');
  control('set', 'Thermostat setting', ...D.set, d.set, '°C', 'The temperature the run stops at. The run ends when the room reaches it, or after half an hour if it never does.');

  const result = finish(v => {
    const plan = airconPlan(v), now = airconAt(plan, clock), values = plan.values;
    const cycle = now.cycle, air = cycle.air, running = !plan.already && !now.arrived;
    roomLabel.userData.setText(`Room ${fixed(now.room.celsius,1)} °C · ${fixed(now.room.humidity,0)}% RH`);
    outsideLabel.userData.setText(`Outside ${fixed(values.outdoor,0)} °C`);
    minuteLabels.forEach((label,i)=>{const minute=(i+1)*5;label.visible=minute*60<plan.duration-60;label.userData.place(chartX(plan,minute*60),CHART.y-0.055);});
    endMinute.userData.setText(fixed(plan.duration/60,1));

    // The coils take the color of the refrigerant in them.
    const coldColor = heatColor(cycle.evaporating), hotColor = heatColor(cycle.condensing);
    for (const tube of coilTubes) tube.material.color.copy(coldColor);
    for (const tube of condTubes) tube.material.color.copy(hotColor);
    frost.visible = cycle.icing;

    // The fans and the compressor turn while the unit runs.
    rotor.rotation.x = -now.t * values.flow * 0.8;
    outRotor.rotation.z = -now.t * 0.12;
    crank.rotation.y = now.t * 0.18;
    airIn.userData.setLength(running ? 0.03 + 0.22 * values.flow : 0);
    airOut.userData.setLength(running ? 0.03 + 0.22 * values.flow : 0);
    outdoorArrow.userData.setLength(running ? 0.10 + cycle.outdoorHeat / 18000 : 0);

    // The drops, only while the coil is below the dew point of the air reaching it.
    drops.forEach((drop, i) => {
      const phase = (clock / 6 + i / drops.length) % 1;
      drop.visible = running && air.condensate > 0;
      const x = (INDOOR.drain[0] + INDOOR.drain[1]) / 2 * MM;
      const top = INDOOR.pan[2] * MM;
      drop.position.set(x,top-0.05-phase*0.28,0.015);
    });

    const total=route.getLength();
    markers.forEach((marker,i)=>{
      const fraction=(i/LOOP.markers+now.turn)%1,section=circuits.find(section=>fraction*total<=section.end)||circuits.at(-1);
      marker.position.copy(route.getPoint(fraction));marker.visible=running;
      marker.material.color.copy(heatColor(['evaporator','feed','valve'].includes(section.phase)?cycle.evaporating:section.phase==='suction'?cycle.evaporating+DECLARED.superheat:['compressor','discharge'].includes(section.phase)?cycle.compressor.discharge:cycle.condensing));
    });

    // What the air does crossing the coil.
    fillLine(saturation, Array.from({length: PSYCHRO.curve}, (_, i) => {
      const end = Math.min(PSYCHRO.temperature[1],dewPointOf(vaporPressureOf(PSYCHRO.ratio[1])));
      const celsius = PSYCHRO.temperature[0] + (end - PSYCHRO.temperature[0]) * i / (PSYCHRO.curve - 1);
      return [psychroX(celsius), psychroY(saturatedRatio(celsius)), 0];
    }));
    fillLine(psychroTicks, Array.from({length: 4}, (_, i) => {
      const x = psychroX(PSYCHRO.temperature[0] + (i + 1) * PSYCHRO.tickEvery);
      return [[x, PSYCHRO.y, 0], [x, PSYCHRO.y - PSYCHRO.tick, 0]];
    }).flat());
    const enter = [psychroX(now.room.celsius), psychroY(now.room.ratio)];
    const onCoil = [psychroX(cycle.evaporating), psychroY(air.saturated)];
    const leave = [psychroX(air.leavingC), psychroY(air.leavingRatio)];
    fillLine(process, [[...enter, 0.002], [...leave, 0.002], [...onCoil, 0.002]]);
    fillLine(dewLine, [[PSYCHRO.x, enter[1], 0.001], [psychroX(now.room.dew), enter[1], 0.001]]);
    for (const [dot, point] of [[enterDot, enter], [coilDot, onCoil], [leaveDot, leave]]) {
      rect(dot, point[0] - PSYCHRO.dot / 2, point[0] + PSYCHRO.dot / 2, point[1] - PSYCHRO.dot / 2, point[1] + PSYCHRO.dot / 2, 0.003);
    }

    // The room through the run.
    rect(comfortBand, CHART.x, CHART.x + CHART.w, humidityY(RATED.comfort[0]), humidityY(RATED.comfort[1]), -0.001);
    fillLine(setLine, [[CHART.x, chartY(values.set), 0], [CHART.x + CHART.w, chartY(values.set), 0]]);
    const tickCount = Math.max(0, Math.ceil(plan.duration / CHART.tickEvery) - 1);
    fillLine(chartTicks, Array.from({length: tickCount}, (_, i) => {
      const x = chartX(plan, (i + 1) * CHART.tickEvery);
      return [[x, CHART.y, 0], [x, CHART.y - CHART.tick, 0]];
    }).flat());
    fillLine(guideRoom, plan.chart.map(sample => [chartX(plan, sample.t), chartY(sample.celsius), 0]));
    fillLine(guideHumidity, plan.chart.map(sample => [chartX(plan, sample.t), humidityY(sample.humidity), 0]));
    const shown = clock > 0 ? plan.chart.filter(sample => sample.t < now.t) : [];
    const roomNow = now.room;
    fillLine(curveRoom, clock > 0 ? [...shown.map(sample => [chartX(plan, sample.t), chartY(sample.celsius), 0]), [chartX(plan, now.t), chartY(roomNow.celsius), 0]] : []);
    fillLine(curveHumidity, clock > 0 ? [...shown.map(sample => [chartX(plan, sample.t), humidityY(sample.humidity), 0]), [chartX(plan, now.t), humidityY(roomNow.humidity), 0]] : []);
    reachedMark.visible = plan.reaches;
    if (plan.reaches) fillLine(reachedMark, [[chartX(plan, plan.reached), CHART.y, 0], [chartX(plan, plan.reached), CHART.y + CHART.mark, 0]]);
    const cx = Math.min(Math.max(chartX(plan, now.t), CHART.x + CHART.cursor), CHART.x + CHART.w - CHART.cursor);
    const mark = y => [[cx - CHART.cursor, y, 0], [cx + CHART.cursor, y, 0]];
    fillLine(cursor, clock > 0 ? [...mark(chartY(roomNow.celsius)), ...mark(humidityY(roomNow.humidity))] : []);

    // Leaders from the indoor unit down to the two charts.
    fillLine(leaders, [
      [INDOOR.origin[0], INDOOR.origin[1] - (indoorH / 2 + 30) * MM, 0], [PSYCHRO.x + PSYCHRO.w / 2, PSYCHRO.y + PSYCHRO.h, 0],
      [OUTDOOR.origin[0], OUTDOOR.origin[1] - (outdoorH / 2 + 30) * MM, 0], [CHART.x + CHART.w / 2, CHART.y + CHART.h, 0],
    ]);

    // Readings.
    const minutes = seconds => `${fixed(seconds / 60, 1)} min`;
    const status = plan.already ? `Ready · the room is already at or below your ${fixed(values.set, 0)} °C setting, so there is nothing for the unit to cool; raise the room or lower the setting`
      : clock <= 0 ? `Ready · at ${fixed(values.room, 0)} °C and ${fixed(values.humidity, 0)}% this unit will take ${fixed(cycle.cooling, 0)} W out of the room${plan.reaches ? ` and reach ${fixed(values.set, 0)} °C in ${minutes(plan.reached)}` : `, but not reach ${fixed(values.set, 0)} °C within the half hour`}; press Play to switch it on`
      : now.arrived ? `Done · the room reached ${fixed(values.set, 0)} °C after ${minutes(plan.reached)}, at ${fixed(roomNow.humidity, 0)}% relative humidity; thermostat switched the compressor off`
      : now.done ? `Preview ended · after ${minutes(now.t)} the room is at ${fixed(roomNow.celsius, 1)} °C, short of the ${fixed(values.set, 0)} °C asked for`
      : `Cooling · ${minutes(now.t)} in, the room reads ${fixed(roomNow.celsius, 1)} °C and ${fixed(roomNow.humidity, 0)}%`;
    const split = `Of the ${fixed(cycle.cooling, 0)} W, ${fixed(air.sensible, 0)} W is sensible, the part that lowers the air’s temperature, and ${fixed(air.latent, 0)} W is latent, the part that condenses its water; ${fixed(100 * cycle.share, 0)}% of the capacity is cooling and ${fixed(100 - 100 * cycle.share, 0)}% is drying.`;
    return {
      state: {...plan, now, cycle, clock},
      readings: [
        r('Your result', cycle.icing && running ? `${status}. Coil below freezing: frost buildup would change this result and is not simulated.` : status),
        r('Cooling', `${fixed(cycle.cooling, 0)} W, ${fixed(cycle.tons, 2)} tons`, `A ton of refrigeration is ${RATED.btu.toLocaleString('en-US')} BTU an hour, about ${fixed(RATED.ton, 0)} W. This illustrative unit is not a product rating. ${split}`),
        r('Air across the coil', `${fixed(now.room.celsius, 1)} °C in, ${fixed(air.leavingC, 1)} °C out`, `The coil's surface sits at the ${fixed(cycle.evaporating, 1)} °C the refrigerant boils at, and ${fixed(100 * DECLARED.contact, 0)}% of the air is brought to it while the rest slips past, so the air leaves at ${fixed(air.leavingC, 1)} °C and ${fixed(air.leavingHumidity, 0)}% relative humidity. Cooling air without drying it raises its relative humidity, which is why air can leave a coil colder and damper at once.`),
        r('Water taken out', air.condensate > 0 ? `${fixed(air.condensate * 3600, 2)} kg/h` : 'none', air.condensate > 0
          ? `The air comes in carrying ${fixed(1000 * now.room.ratio, 2)} g of water for each kilogram of dry air, a dew point of ${fixed(now.room.dew, 1)} °C. The coil is below that, so the air cannot keep it all: it leaves with ${fixed(1000 * air.leavingRatio, 2)} g/kg and the rest, ${fixed(air.condensate * 3600, 2)} kg an hour, runs down the pan.`
          : `The air comes in carrying ${fixed(1000 * now.room.ratio, 2)} g of water for each kilogram of dry air, a dew point of ${fixed(now.room.dew, 1)} °C. The coil at ${fixed(cycle.evaporating, 1)} °C is above that, so nothing condenses and every watt goes into cooling.`),
        r('Sensible and latent', `${fixed(100 * cycle.share, 0)}% cooling, ${fixed(100 - 100 * cycle.share, 0)}% drying`, `Sensible heat is the air's mass flow times its heat capacity of ${fixed(AIR.heat, 0)} J/(kg·K) times the drop in temperature; latent heat is the water condensed times the ${fixed(waterLatent(cycle.evaporating) / 1000, 0)} kJ/kg it gives up at the coil. ${split}`),
        r('Compressor', `${fixed(cycle.compressor.work, 0)} W`, `It swallows vapor at ${fixed(cycle.compressor.low / 1e5, 2)} bar and pushes it out at ${fixed(cycle.compressor.high / 1e5, 2)} bar, a pressure ratio of ${fixed(cycle.compressor.ratio, 2)}. The ideal-gas estimate puts discharge vapor at ${fixed(cycle.compressor.discharge,1)} °C before the condenser cools it. Its ${fixed(1e6 * DECLARED.displacement, 0)} cm³ swept ${DECLARED.rpm.toLocaleString('en-US')} times a minute fills only ${fixed(100 * cycle.compressor.volumetric, 1)}% of the way, because the gas left in its clearance has to expand again first, so it moves ${fixed(cycle.compressor.mass * 1000, 2)} g of refrigerant a second.`),
        r('Refrigerant', `boils at ${fixed(cycle.evaporating, 1)} °C, condenses at ${fixed(cycle.condensing, 1)} °C`, `${R410A.name} has a normal boiling point of ${fixed(R410A.boiling, 2)} °C. Saturation pressures and liquid enthalpy follow the manufacturer’s equations; vapor enthalpy is interpolated from its table. All pressures shown are absolute. Throttling preserves enthalpy, so each kilogram absorbs ${fixed(cycle.effect / 1000, 1)} kJ in the evaporator, including the declared superheat.`),
        r('Heat put outdoors', `${fixed(cycle.outdoorHeat, 0)} W`, `Everything taken out of the room plus everything the compressor put in has to leave through the hot coil: ${fixed(cycle.cooling, 0)} W and ${fixed(cycle.compressor.work, 0)} W make ${fixed(cycle.outdoorHeat, 0)} W. The coil sheds it at ${fixed(DECLARED.condenser, 0)} W for each degree it stands above the ${fixed(values.outdoor, 0)} °C outdoors, which puts it at ${fixed(cycle.condensing, 1)} °C.`),
        r('Coefficient of performance', fixed(cycle.cop, 2), `Cooling over the work it takes: ${fixed(cycle.cooling, 0)} W for ${fixed(cycle.compressor.work, 0)} W. Fan power is omitted, so this compressor-only ratio is not a whole-system efficiency rating. A perfect machine moving heat across the same ${fixed(cycle.lift, 1)} °C would reach ${fixed(cycle.carnot, 1)}, so this one is ${fixed(100 * cycle.cop / cycle.carnot, 0)}% of the best there is.`),
        r('The room', plan.already ? 'already at the setting' : plan.reaches ? `${fixed(values.set, 0)} °C after ${minutes(plan.reached)}` : `${fixed(plan.settled.celsius, 1)} °C after half an hour`, `The room's ${fixed(values.volume, 0)} m³ of air weighs ${fixed(plan.dryMass, 1)} kg, and with its furnishings and surfaces it holds ${fixed(plan.heatCapacity / 1000, 0)} kJ for each degree. Outdoor air leaks ${fixed(DECLARED.roomLoss, 0)} W back in for each degree the room is cooler than outdoors, ${fixed(DECLARED.roomLoss * (values.outdoor - roomNow.celsius), 0)} W of it now.`),
        r('Sped up', `${DECLARED.slower} times faster`, `The run plays ${DECLARED.slower} times faster than the real thing: this one takes ${minutes(plan.duration)} and plays in ${fixed(plan.duration / DECLARED.slower, 0)} s. Both units are drawn at representative size, and the two charts are not to scale.`),
      ].map(reading => {
        if (running || ['Your result', 'The room', 'Sped up'].includes(reading.label)) return reading;
        const values = {'Cooling': '0 W', 'Air across the coil': 'Fan stopped', 'Water taken out': 'none', 'Sensible and latent': 'No heat transfer modeled', 'Compressor': '0 W', 'Refrigerant': 'Circulation stopped', 'Heat put outdoors': '0 W', 'Coefficient of performance': 'Off'};
        return r(reading.label, values[reading.label], 'The thermostat is satisfied. Compressor, fans and refrigerant circulation are off. Residual coil cooling and later thermostat cycling are outside this model.');
      }),
    };
  });

  const render = result.update;
  result.update = patch => {
    const current = result.getState().values;
    if (patch && result.controls.some(control => Number.isFinite(patch[control.key]) && patch[control.key] !== current[control.key])) { clock = 0; lastClock = 0; }
    return render(patch);
  };
  const duration = () => result.getState().duration;
  result.advance = dt => { if (!result.getState().already && Number.isFinite(dt) && dt > 0) clock = Math.min(duration(), clock + dt * DECLARED.slower); return render(); };
  result.animate = t => { const dt = Number.isFinite(t) ? Math.max(0, t - lastClock) : 0; if (Number.isFinite(t)) lastClock = t; return result.advance(dt); };
  result.reset = () => { clock = 0; lastClock = 0; return render(result.defaults); };
  result.actions = [
    {label: 'Inspect: the cold coil', part: 'evaporator', view: 'front', replay: false, run() { return render(); }},
    {label: 'Inspect: the refrigerant loop', part: 'loop', view: 'front', replay: false, run() { return render(); }},
    {label: 'Inspect: the air chart', part: 'psychro', view: 'front', replay: false, run() { return render(); }},
    {label: 'Inspect: the room', part: 'chart', view: 'front', replay: false, run() { return render(); }},
  ];
  result.playback = {
    label: 'Switch it on',
    description: `The unit runs until the room reaches your setting, or for half an hour if it never does. The run plays ${DECLARED.slower} times faster than the real thing.`,
    stepLabel: `Advance ${fixed(CHART.tickEvery / 60, 0)} min`,
    advance: result.advance,
    step: () => result.advance(CHART.tickEvery / DECLARED.slower),
    complete: () => clock >= duration(),
    blocked: () => result.getState().already,
  };
  result.resultPart = {id: 'chart', label: 'Inspect the room', view: 'front', focusOnComplete: false, available: () => clock >= duration()};

  kit.root.rotation.set(0.08, -0.12, 0);
  result.initialPart = 'system';
  result.initialView = 'front';
  result.frameVisibleOnly = true;
  result.framePadding = 0.55;
  result.selectionOutline = false;
  result.transparentBackground = true;
  result.topology = {
    roomLabel, outsideLabel, minuteLabels, endMinute, circuits, route, evaporatorPath, condenserPath, coilFins, condenserFins, indoorShell, outdoorShell, system, indoor, indoorBoard, indoorLine, evaporator, coilTubes, frost, fanPart, fanRing, rotor, blades, airIn, airOut,
    drain, panBody, drainPipe, drops, outdoor, outdoorBoard, outdoorLine, condenser, condTubes, outFanPart, outFanRing,
    outRotor, outBlades, outdoorArrow, compressor, compressorRing, compressorBody, crank, crankArm, expansion, expansionMark,
    loopPart, loopLine, markers, psychro, psychroFrame, saturation, psychroTicks, process, dewLine, enterDot, coilDot, leaveDot,
    chartPart, chartFrame, comfortBand, setLine, chartTicks, guideRoom, guideHumidity, curveRoom, curveHumidity, reachedMark, cursor, leaders,
  };
  const dispose = result.dispose;
  result.dispose = () => { if (!disposed) { disposed = true; dispose(); } };
  return result;
}

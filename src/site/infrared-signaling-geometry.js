import {textLabel,fillLine,lineObject} from './scene-kit.js';
import {IR_TIMING} from './remote-control-physics.js';

const C={ink:0x374736,gray:0xb9c2ad,ir:0x8a5cc2,blue:0x357386,gold:0xe3b45e};
const label=(parent,text,x,y,width=5.2,height=.21)=>textLabel(parent,text,{position:[x,y,.24],width,height,color:'#374736'});
const trace=(parent,count,color)=>{const line=lineObject(count,color,parent);line.frustumCulled=false;return line;};
const span=.0032,x=time=>-2.25+4.5*time/span;
function envelope(intervals,until,base,amplitude){
  const end=Math.max(0,Math.min(span,until)),points=[[x(0),base,.12]];
  for(const [start,stop] of intervals){if(start>end)break;points.push([x(start),base,.12],[x(start),base+amplitude,.12],[x(Math.min(stop,end)),base+amplitude,.12]);if(stop>end)return points;points.push([x(stop),base,.12]);}
  points.push([x(end),base,.12]);return points;
}

export function createSignalBitGeometry(kit,parent){
  const root=kit.part('bit','One bit and its next mark','Compare equal light bursts with different gaps. The receiver measures from one falling edge to the next; the closing mark supplies the last edge.',[0,0,0],parent);
  root.userData.inspectionOnly='bit';root.userData.explosionExcluded=true;
  label(root,'THE GAP CARRIES THIS BIT',0,2.36,5.2,.27);
  const heading=label(root,'',0,2.02),number=label(root,'',0,1.69,5.2,.18);
  const cells=Array.from({length:8},(_,i)=>{
    const block=kit.box([.44,.27,.025],[-1.82+i*.52,1.34,.04],C.gray,root);block.material=block.material.clone();
    return {block,text:label(root,'',-1.82+i*.52,1.34,.38,.20)};
  });
  label(root,'LED envelope: up means a burst of flashes',0,.99,5.2,.18);
  const transmitted=trace(root,12,C.gray),sent=trace(root,12,C.ir);
  label(root,'Receiver output: low means a detected burst',0,.27,5.2,.18);
  const receiver=trace(root,12,C.gray),received=trace(root,12,C.blue),cursor=trace(root,2,C.gold);
  for(const ms of [0,1,2,3])label(root,`${ms} ms`,x(ms/1000),-.49,.62,.15);
  const distance=label(root,'',0,-.78,5.2,.19),gap=label(root,'',0,-1.05,5.2,.19);
  const carrier=trace(root,160,C.ir);label(root,'Same mark, carrier enlarged separately',0,-1.36,5.2,.18);
  const carrierText=label(root,'',0,-2.00,5.2,.18),status=label(root,'',0,-2.28,5.2,.19);
  const selected=trace(parent,5,C.gold);selected.visible=false;selected.userData.inspectionOnly='signal';selected.userData.explosionExcluded=true;
  return {root,heading,number,cells,transmitted,sent,receiver,received,cursor,distance,gap,carrier,carrierText,status,selected};
}

export function updateSignalBitGeometry(g,s,plan){
  const b=s.inspected,key=`${s.values.bit}:${JSON.stringify(plan.values)}`;
  const marks=[[0,b.mark],[b.distance,b.distance+b.mark]],output=b.received?marks.map(([a,z])=>[a+IR_TIMING.delay,z+IR_TIMING.delay]):[];
  if(g.key!==key){
    g.key=key;g.heading.userData.setText(`${b.byteName} ${b.byte} · bit ${b.bitIndex} = ${b.value}`);
    g.number.userData.setText(`Sent left to right · selected weight ${b.weight} · frame bit ${b.index+1}/32`);
    g.cells.forEach(({block,text},i)=>{text.userData.setText(String(b.byteBits[i]));block.material.color.setHex(i===b.bitIndex?C.gold:C.gray);});
    fillLine(g.transmitted,envelope(marks,b.windowEnd,.43,.32));fillLine(g.receiver,envelope(output,b.windowEnd,.05,-.30));
    g.distance.userData.setText(`Start to start: ${(b.distance*1000).toFixed(3)} ms → ${b.value}`);
    g.gap.userData.setText(`Burst 562.5 μs · quiet ${(b.gap*1e6).toFixed(1)} μs${b.closing?' · next = closing mark':''}`);
    const points=[];
    for(let i=0;i<b.pulses;i++){const a=i/plan.frequency,z=Math.min(b.mark,(i+IR_TIMING.duty)/plan.frequency),cx=t=>-2.25+4.5*t/b.mark;points.push([cx(a),-1.79,.12],[cx(a),-1.52,.12],[cx(z),-1.52,.12],[cx(z),-1.79,.12]);}
    fillLine(g.carrier,points);g.carrierText.userData.setText(`${s.values.carrier} kHz · ${b.pulses} on-pulses · ${b.periods.toFixed(3)} periods`);
  }
  const until=s.started?Math.min(b.relativeTime,b.windowEnd):0;
  fillLine(g.sent,until>=0&&s.started?envelope(marks,until,.43,.32):[]);fillLine(g.received,until>=0&&s.started?envelope(output,until,.05,-.30):[]);
  fillLine(g.cursor,[[x(Math.max(0,Math.min(span,until))),-.27,.17],[x(Math.max(0,Math.min(span,until))),.77,.17]]);
  g.cursor.visible=s.started&&b.relativeTime>=0&&b.relativeTime<=b.windowEnd;
  g.status.userData.setText(!b.received?'No received edges: inspect the light path':b.decoded?`Bit ${b.value} read from the next falling edge`:b.relativeTime<0?'This bit has not started yet':'Waiting for the next received falling edge');
  const row=b.index>=16?1:0,col=b.index%16,cx=-2.20+col*.292,cy=.03-row*.39;
  fillLine(g.selected,[[cx-.145,cy-.15,.18],[cx+.145,cy-.15,.18],[cx+.145,cy+.15,.18],[cx-.145,cy+.15,.18],[cx-.145,cy-.15,.18]]);g.selected.visible=true;
}

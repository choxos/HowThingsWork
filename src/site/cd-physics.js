import { validateControls, validTime } from './physics-kit.js';
import { CD_SAMPLE_RATE, CD_CHANNEL_RATE, CD_FRAME_BITS, CD_CIRC_TAIL, cdPcmFrames, cdCircEncode, cdEfmEncode, cdNrziLevels, cdDetectTransitions, cdEraseSymbols, cdEfmDecode, cdCircDecode, cdRecoveredPcm } from './cd-codec.js';

export const CD_DEFAULTS = Object.freeze({ content: 0, radius: 25, velocity: 12, loss: 0, laser: 1, phase: 0, sound: 0 });
export const CD_DOMAINS = Object.freeze({ content: [0,2,1], radius: [25,58,1], velocity: [12,14,1], loss: [0,3,1], laser: [0,1,1], phase: [0,3,1], sound: [0,1,1] });
export const CD_SOUNDS = Object.freeze(['Low stereo notes', 'High stereo notes', 'Rising stereo chime']);
export const CD_LOSSES = Object.freeze(['Clean reading', 'One unreadable symbol', 'Eight unreadable frames', '196 unreadable frames']);
export const CD_PHASE_DENOMINATORS = Object.freeze([4,6,8,2]);
export const CD_TIMING = Object.freeze({ slowCells:64, slowEnd:4, readEnd:6, audio:.4, duration:6.65 });
export const CD_REFERENCE = Object.freeze({ wavelength:780, aperture:.45, refractiveIndex:1.55, substrate:1.2, pitch:1.6e-6, inner:.025, outer:.058, firstDark:3.8317059702075125 });
export const cdSettings = (values = {}) => validateControls(values, CD_DEFAULTS, CD_DOMAINS, 'CD');

export function cdOptics(phase = 0, velocity = 12) {
  cdSettings({phase,velocity});
  const denominator = CD_PHASE_DENOMINATORS[phase], radians = 4*Math.PI/denominator;
  return { denominator, radians, degrees:radians*180/Math.PI, depthNm:CD_REFERENCE.wavelength/(CD_REFERENCE.refractiveIndex*denominator),
    intensity:(1+Math.cos(radians))/2, spotDiameterNm:CD_REFERENCE.firstDark/Math.PI*CD_REFERENCE.wavelength/CD_REFERENCE.aperture,
    cellNm:velocity/10/CD_CHANNEL_RATE*1e9, minRunNm:3*velocity/10/CD_CHANNEL_RATE*1e9, maxRunNm:11*velocity/10/CD_CHANNEL_RATE*1e9 };
}

export function cdSpiral(radius, velocity, seconds, totalSeconds = seconds) {
  cdSettings({radius,velocity}); validTime(seconds); validTime(totalSeconds);
  if (seconds > totalSeconds) throw new RangeError('Read time exceeds the excerpt');
  const v = velocity/10, pitch = CD_REFERENCE.pitch, delta = pitch*v*totalSeconds/Math.PI;
  // At the outer limit, place the complete excerpt just before 58 mm.
  const start = Math.min(radius/1000,Math.sqrt(CD_REFERENCE.outer**2-delta));
  const now = Math.sqrt(start**2+pitch*v*seconds/Math.PI), rpm = 60*v/(2*Math.PI*now), turns = (now-start)/pitch;
  const referenceTurns = (CD_REFERENCE.outer-CD_REFERENCE.inner)/pitch;
  const referenceLength = Math.PI*(CD_REFERENCE.outer**2-CD_REFERENCE.inner**2)/pitch;
  return {startMm:start*1000,radiusMm:now*1000,endMm:Math.sqrt(start**2+delta)*1000,travelMicrometers:(now-start)*1e6,
    turns,angle:turns*2*Math.PI,rpm,innerRpm:60*v/(2*Math.PI*CD_REFERENCE.inner),outerRpm:60*v/(2*Math.PI*CD_REFERENCE.outer),
    referenceTurns,referenceLength,referenceMinutes:referenceLength/v/60,edgeAdjusted:start<radius/1000-1e-12};
}

const discs = new Map();
export function cdStoredDisc(content = 0) {
  cdSettings({content}); if (discs.has(content)) return discs.get(content);
  const count = Math.round(CD_SAMPLE_RATE*CD_TIMING.audio), pcm = [new Int16Array(count),new Int16Array(count)];
  for (let i = 0; i < count; i++) {
    const t = i/CD_SAMPLE_RATE, segment = content===2?Math.min(2,Math.floor(3*i/count)):0;
    const start = content===2?segment*CD_TIMING.audio/3:0, end = content===2?(segment+1)*CD_TIMING.audio/3:CD_TIMING.audio;
    const ramp = Math.max(0,Math.min(1,(t-start)/.01,(end-t-1/CD_SAMPLE_RATE)/.01)), envelope = .5-.5*Math.cos(Math.PI*ramp);
    const frequency = content===2?[440,554.36526195,659.25511383][segment]:content===1?440:220;
    for (let ch = 0; ch < 2; ch++) pcm[ch][i] = Math.round(22000*envelope*Math.sin(2*Math.PI*frequency*(ch?1.5:1)*(t-start)));
  }
  const input = cdPcmFrames(pcm), circ = cdCircEncode(input), channel = cdEfmEncode(circ.frames), levels = cdNrziLevels(channel.bits);
  const disc = {content,name:CD_SOUNDS[content],pcm,input,circ,channel,levels,samples:count,seconds:channel.bits.length/CD_CHANNEL_RATE};
  discs.set(content,disc); return disc;
}

const readings = new Map();
function prefix(items, value) {
  const result = new Uint32Array(items.length+1);
  items.forEach((item, i) => { result[i+1] = result[i]+value(item); });
  return result;
}

export function cdReadDisc(content = 0, loss = 0) {
  cdSettings({content,loss}); const key = `${content}:${loss}`;
  if (readings.has(key)) return readings.get(key);
  const disc = cdStoredDisc(content), positions = [], lossStart = Math.floor(disc.input.length/2);
  if (loss===1) positions.push([lossStart,7]);
  if (loss>=2) for (let n = lossStart; n < lossStart+(loss===2?8:196); n++) for (let j = 0; j < 32; j++) positions.push([n,j]);
  // Ideal transition detection is the explicit optical/digital boundary. The
  // loss exercise overwrites selected read symbols; it is not a scratch model.
  const idealBits = cdDetectTransitions(disc.levels), received = positions.length?cdEraseSymbols(idealBits,positions):idealBits;
  const efm = cdEfmDecode(received), circ = cdCircDecode(efm.frames), recovered = cdRecoveredPcm(circ.frames);
  const audio = recovered.pcm.map(channel => Float32Array.from(channel,x=>x/32768));
  const cumulative = {
    erased:prefix(efm.frames,frame=>frame.filter(x=>x<0).length),
    c1Repaired:prefix(circ.events.c1,x=>x.repaired),c1Failed:prefix(circ.events.c1,x=>x.failed),
    c2Repaired:prefix(circ.events.c2,x=>x.repaired),c2Failed:prefix(circ.events.c2,x=>x.failed),
    missing:prefix(circ.frames,frame=>Array.from({length:12},(_,j)=>frame[2*j]<0||frame[2*j+1]<0).filter(Boolean).length),
  };
  const result = {disc,loss,lossStart,positions,received,efm,circ,recovered,audio,cumulative}; readings.set(key,result); return result;
}

export function cdPlan(input = {}) {
  const values = cdSettings(input), disc = cdStoredDisc(values.content), read = values.laser?cdReadDisc(values.content,values.loss):null;
  return {values,disc,read,optics:cdOptics(values.phase,values.velocity),duration:CD_TIMING.duration};
}

export function cdAt(plan, time) {
  validTime(time); const t = Math.min(time,plan.duration), v = plan.values, total = plan.disc.channel.bits.length;
  const progressCells = t<=CD_TIMING.slowEnd?t/CD_TIMING.slowEnd*CD_TIMING.slowCells:
    CD_TIMING.slowCells+Math.min(1,(t-CD_TIMING.slowEnd)/(CD_TIMING.readEnd-CD_TIMING.slowEnd))*(total-CD_TIMING.slowCells);
  const cells = Math.min(total,Math.floor(progressCells+1e-7)), receivedCells = v.laser?cells:0, frames = Math.floor(receivedCells/CD_FRAME_BITS);
  const c1Frames = Math.max(0,frames-1), c2Frames = Math.max(0,frames-109), recoveredFrames = Math.max(0,frames-CD_CIRC_TAIL);
  const samplePairs = Math.min(plan.disc.samples,6*recoveredFrames), within = receivedCells%CD_FRAME_BITS;
  const decodedSymbols = frames*32+Math.max(0,Math.min(32,Math.floor((within-41)/17)));
  const readComplete = receivedCells===total, complete = t===plan.duration, listening = t>=CD_TIMING.readEnd&&t<CD_TIMING.readEnd+CD_TIMING.audio&&!!v.laser;
  const audioTime = Math.max(0,Math.min(CD_TIMING.audio,t-CD_TIMING.readEnd)), sampleIndex = Math.min(plan.disc.samples-1,Math.floor(audioTime*CD_SAMPLE_RATE));
  const stats = {erased:0,c1Repaired:0,c1Failed:0,c2Repaired:0,c2Failed:0,missingSamples:0};
  if (plan.read) {
    const p = plan.read.cumulative; stats.erased = p.erased[frames]; stats.c1Repaired = p.c1Repaired[c1Frames]; stats.c1Failed = p.c1Failed[c1Frames];
    stats.c2Repaired = p.c2Repaired[c2Frames]; stats.c2Failed = p.c2Failed[c2Frames]; stats.missingSamples = p.missing[recoveredFrames];
  }
  const spiral = cdSpiral(v.radius,v.velocity,cells/CD_CHANNEL_RATE,plan.disc.seconds), phase = complete?'complete':listening?'sound':t>=CD_TIMING.readEnd?'result':t<=CD_TIMING.slowEnd?'one-symbol':'excerpt';
  const status = !v.laser?'Laser off: no detected transitions, recovered bytes or audio.':
    complete?stats.missingSamples?`${stats.missingSamples.toLocaleString('en-US')} unresolved stereo-channel samples were muted. The other samples were recovered.`:`All ${plan.disc.samples.toLocaleString('en-US')} stereo sample pairs recovered${stats.erased?' after correcting the flagged loss':''}.`:
    listening?'The DAC plays the recovered left and right samples at 44,100 pairs per second.':
    t===0?'Follow the first transition cells, then decode and hear a 0.4-second stereo excerpt.':
    phase==='one-symbol'?`${receivedCells} of the first 64 channel cells read slowly; ${decodedSymbols} data symbols demodulated.`:
    readComplete?'Recovered samples remain available for inspection.':`${frames.toLocaleString('en-US')} channel frames read; ${samplePairs.toLocaleString('en-US')} stereo sample pairs recovered.`;
  return {time:t,duration:plan.duration,values:{...v},phase,complete,readComplete,listening,audioTime,sampleIndex,cells,receivedCells,frames,c1Frames,c2Frames,recoveredFrames,samplePairs,decodedSymbols,stats,spiral,status,
    readFrame:Math.min(plan.disc.circ.frames.length-1,Math.floor(cells/CD_FRAME_BITS)),readCell:cells%CD_FRAME_BITS,
    detectorBit:receivedCells?plan.read.received[receivedCells-1]:null,detectorLevel:receivedCells?plan.disc.levels[receivedCells-1]:null,
    output:listening?plan.read.recovered.pcm.map(channel=>channel[sampleIndex]/32768):[0,0]};
}

export function createCdController(initial = {}) {
  let plan, time, start;
  function reset(input = {}) {
    if (!input||typeof input!=='object'||Array.isArray(input)||Object.keys(input).some(k=>!['values','time'].includes(k))) throw new TypeError('Expected CD starting state');
    const next = cdPlan(input.values??{}), t = validTime(input.time??0);
    if (t>next.duration) throw new RangeError('Starting time exceeds CD experiment');
    plan = next; time = t; start = {values:{...next.values,sound:0},time:t}; return cdAt(plan,time);
  }
  reset(initial);
  return {reset,getState:()=>cdAt(plan,time),getPlan:()=>plan,replayState:()=>({values:{...start.values},time:start.time}),
    update(input = {}) {
      const values = validateControls(input,plan.values,CD_DOMAINS,'CD'), changed = Object.keys(values).some(k=>!['phase','sound'].includes(k)&&values[k]!==plan.values[k]);
      const next = cdPlan(values);
      if (changed) {time=0;start={values:{...values,sound:0},time:0};} else start.values.phase=values.phase;
      plan=next;return cdAt(plan,time);
    },
    advance(seconds) {validTime(seconds);time=Math.min(plan.duration,Number((time+seconds).toFixed(12)));return cdAt(plan,time);},
  };
}

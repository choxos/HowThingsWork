import assert from 'node:assert/strict';
import {DISC_FORMATS, PLAYER, PLAYER_DEFAULTS, PLAYER_DOMAINS, playerSettings, playerPlan, playerAt, playerRpm, playerInterference} from './blu-ray-player-physics.js';

let checks = 0;
const near = (a,b,epsilon=1e-9) => {assert.ok(Math.abs(a-b)<=epsilon, `${a} differs from ${b}`);checks++;};
const equal = (a,b) => {assert.deepEqual(a,b);checks++;};
// Independent transcription from ECMA-130, ECMA-267 and BDA's BD-ROM paper.
const reference = [
  [780,.45,1600,1.2,4321800,1.2,0,3,11],
  [650,.60,740,3.49,26156250,.6,.6,3,11],
  [405,.85,320,4.917,66000000,.1,1.1,2,8],
];
for (const [i,f] of DISC_FORMATS.entries()) {
  equal([f.wavelength,f.aperture,f.pitch,f.velocity,f.channelRate,f.cover,f.backing,f.minimumRun,f.maximumRun],reference[i]);
  near(f.cover+f.backing,1.2);
}
equal(playerSettings(),PLAYER_DEFAULTS);
for(const [key,[lo,hi,step]] of Object.entries(PLAYER_DOMAINS)) {
  for(const value of [lo-step,hi+step,NaN,Infinity,-Infinity,'1']) {assert.throws(()=>playerSettings({[key]:value}),RangeError);checks++;}
  assert.throws(()=>playerSettings({[key]:lo+step/3}),RangeError);checks++;
}
let poses=0;
for(let format=0;format<3;format++)for(let radius=25;radius<=58;radius++)for(let speed=1;speed<=4;speed++) {
  const p=playerPlan({format,radius,speed});poses++;
  const circumference=2*Math.PI*radius/1000;
  near(p.rpm/60*circumference,p.linearSpeed);
  near(p.channelRate*p.cellLength*1e-9,p.linearSpeed);
  near(p.rpm*radius,playerRpm(p.format,25,speed)*25,1e-7);
  near(p.spotDiameter,1.2196698912665045*p.format.wavelength/p.format.aperture,1e-8);
  equal(p.sample.cells,format===2?42:54);
  equal(p.sample.bits.filter(Boolean).length,10);
  for(const run of p.sample.runs) {
    assert.ok(run.length>=p.format.minimumRun&&run.length<=p.format.maximumRun);checks++;
    equal(p.sample.bits.slice(run.start,run.end),[1,...Array(run.length-1).fill(0)]);
    for(const cell of [run.start+.25,run.end-.25]) {
      const n=playerAt(p,cell/p.cellsPerSecond);
      equal(n.run,run);near(n.travel,cell);equal(n.currentCell,Math.floor(cell));
    }
  }
  for(let cell=0;cell<=p.sample.cells;cell++) {
    const n=playerAt(p,cell/p.cellsPerSecond);
    equal(n.count,cell);equal(n.ones+n.zeros,cell);equal(n.recovered.length,cell);
    near(n.angle/(2*Math.PI)*PLAYER.spinSlowdown,n.clock*p.rpm/60,1e-10);
  }
  const end=playerAt(p,p.duration+20);
  equal(end.complete,true);equal(end.recovered,p.sample.bits);near(end.clock,p.duration);
  equal(playerAt(p,0).recovered,[]);equal(playerAt(p,0).complete,false);
  for(const time of [-1,NaN,Infinity]){assert.throws(()=>playerAt(p,time),RangeError);checks++;}
}
// Time-average independently summed fields. Intensity is quadratic in field,
// not the height of the summed waveform or an optical-disc reflectance claim.
for(let phase=0;phase<=360;phase+=5) {
  let power=0;const N=2048;
  for(let k=0;k<N;k++) {
    const x=2*Math.PI*k/N,a=Math.sin(x),b=Math.sin(x+phase*Math.PI/180),w=playerInterference(phase,x);
    near(w.first,a);near(w.second,b);near(w.sum,(a+b)/2);
    power+=(a+b)**2/N;
  }
  near(playerInterference(phase).intensity,power/2,1e-12);
}
near(playerInterference(0).intensity,1);near(playerInterference(90).intensity,.5);near(playerInterference(180).intensity,0);near(playerInterference(360).intensity,1);
near(playerPlan().cellLength,74.5);near(playerPlan().duration,7);
equal(Math.round(playerPlan({radius:58}).rpm),810);
console.log(`PASS Blu-ray player physics: ${checks} checks, ${poses} format/radius/speed settings, 73 independent wave-power integrals.`);

import assert from 'node:assert/strict';
import {WET_CELL, WET_DEFAULTS, wetSettings, wetProfile, wetColor, wetPlan, wetAt, createWettingController} from './electrowetting-physics.js';

const near = (a, b, message = '') => assert(Math.abs(a - b) < 1e-10, `${message}: ${a} != ${b}`);
const volume = points => points.slice(1).reduce((sum, point, i) => sum + (point[0] - points[i][0]) * (point[1] + points[i][1]) / 2 * 1.5, 0);
const initials = [[0,0,0], [.8,.8,.8], [.8,0,0], [0,.8,0], [0,0,.8], [.8,.4,0], [.27,.61,.13]];
let combinations = 0, samples = 0;
for (const red of [0,1,2]) for (const green of [0,1,2]) for (const blue of [0,1,2]) for (const power of [0,1]) for (const light of [0,1]) {
  const values = {red,green,blue,power,light}, target = [red,green,blue].map(v => power ? .4 * v : 0);combinations++;
  for (const initial of initials) {
    const plan = wetPlan(values, initial);assert.deepEqual(initial, plan.start);assert.deepEqual(plan.target, target);
    const first = wetAt(plan, 0);assert.deepEqual(first.open, initial);
    for (const time of [0,1e-9,.2,.7,1.2,1.6-1e-12,1.6,10]) {
      const now = wetAt(plan,time);samples++;
      assert.deepEqual(now.drive, power ? [red,green,blue] : [0,0,0]);
      for (let i=0;i<3;i++) {
        assert(now.open[i]>=Math.min(initial[i],target[i])-1e-12 && now.open[i]<=Math.max(initial[i],target[i])+1e-12);
        near(now.color.rgb[i], light * now.open[i] / .8);near(now.covered[i],1-now.open[i]);
        const profile = wetProfile(now.open[i]);near(volume(profile.oil),1.3*1.5*.03,'Oil volume');
        near(1.3*1.5*.44-volume(profile.water),1.3*1.5*(.44-.03),'Water volume');
        near(profile.front + 1.3/2,1.3*(1-now.open[i]),'Footprint determines uncovered area');
        assert(profile.height>0 && profile.height<.44);
        for (const [x,z] of profile.oil) assert(Number.isFinite(x+z) && x>=-.65-1e-12 && x<=.65+1e-12 && z>=0 && z<.44);
      }
      if(time>=1.6) {assert(now.complete);assert.deepEqual(now.open,target);}
    }
  }
}
assert.equal(combinations,108);assert.equal(samples,6048);
for(const [open,name] of [[[0,0,0],'Dark'],[[.8,0,0],'Red'],[[0,.8,0],'Green'],[[0,0,.8],'Blue'],[[.8,.8,0],'Yellow'],[[.8,0,.8],'Magenta'],[[0,.8,.8],'Cyan'],[[.8,.8,.8],'White'],[[.8,.4,0],'Orange']])assert.equal(wetColor(open).name,name);
assert.equal(wetColor([.8,.8,.8],0).name,'No incident light');
for(const stop of [.1,.4,.8,1.2,1.6]) {
  const c=createWettingController({settings:{red:2,green:2,blue:2}});c.advance(stop);const before=c.getState();
  c.update({power:0});assert.deepEqual(c.getState().now.open,before.now.open);assert.deepEqual(c.getState().now.drive,[0,0,0]);
  c.advance(.4);assert(c.getState().now.open.every((v,i)=>v<before.now.open[i]));
  const closing=c.getState();c.update({red:0,green:0,blue:2});assert.deepEqual(c.getState().now.open,closing.now.open);near(c.getState().clock,closing.clock);
  c.advance(20);assert.deepEqual(c.getState().now.open,[0,0,0]);
  c.update({power:1});assert.deepEqual(c.getState().now.open,[0,0,0]);c.advance(20);assert.deepEqual(c.getState().now.open,[0,0,.8]);
}
const c=createWettingController();c.advance(.7);const midway=c.getState();
c.update({red:0,green:2});assert.deepEqual(c.getState().now.open,midway.now.open);assert.equal(c.getState().clock,0);c.advance(10);assert.deepEqual(c.getState().now.open,[0,.8,0]);
const change=createWettingController();change.advance(.4);const held=change.getState();
change.update({light:0});assert.deepEqual(change.getState().now.open,held.now.open);near(change.getState().clock,held.clock);assert.deepEqual(change.getState().now.color.rgb,[0,0,0]);
change.update({light:1});assert.deepEqual(change.getState(),held);change.update({...WET_DEFAULTS});assert.deepEqual(change.getState(),held);
const replay=change.replayState();change.advance(100);change.reset(replay);assert.deepEqual(change.getState().now.open,[0,0,0]);
const input={settings:{red:1,green:2,blue:0,power:1,light:1},openings:[.1,.2,.3],time:.3}, frozen=JSON.stringify(input), independent=createWettingController(input);
independent.advance(.2);assert.equal(JSON.stringify(input),frozen);independent.getState().now.open[0]=99;assert(independent.getState().now.open[0]<1);
for(const bad of [null,[],{red:-1},{blue:3},{green:.5},{light:NaN},{power:Infinity},{unknown:1}])assert.throws(()=>wetSettings(bad));
for(const bad of [null,[],[0,0],[0,0,NaN],[0,0,.81],[-.01,0,0]])assert.throws(()=>wetPlan({},bad));
for(const bad of [-1,NaN,Infinity])assert.throws(()=>wetAt(wetPlan(),bad));
for(const run of [()=>independent.update({blue:3}),()=>independent.reset({openings:[1,0,0]}),()=>independent.reset({time:-1}),()=>independent.advance(-1)]){const before=independent.getState();assert.throws(run);assert.deepEqual(independent.getState(),before,'Invalid mutation is transactional');}
near(WET_CELL.maxOpen,.8);console.log(`PASS: ${combinations} settings combinations, ${initials.length} initial images and ${samples} samples; conserved fluid volumes, reflected color, held drive, power-off return, interruptions, light, replay and validation.`);

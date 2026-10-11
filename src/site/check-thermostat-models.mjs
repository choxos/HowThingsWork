import assert from 'node:assert/strict';
import * as P from './thermostat-physics.js';
import * as L from './thermostat-lessons.js';
import './check-wax-thermostat-physics.mjs';
import './check-wax-thermostat-model.mjs';

// Preserve shared material constants while each thermostat has its own physics checks.
const expected = {
  expansion: {brass: 19e-6, iron: 11.8e-6, carbonSteel: 10.8e-6, steel: [11.0e-6, 13.0e-6], copper: 17e-6, invar: 1.2e-6, aluminum: 23.1e-6},
  expansionOther: {brass: [18e-6, 19e-6], ironForged: 11.3e-6, ironPure: 12.0e-6, steel: [10.8e-6, 12.5e-6], copper: [16e-6, 16.7e-6], invar: 1.5e-6},
  modulus: {brass: 106e9, wroughtIron: 193e9, steel: 200e9, copper: 110e9},
  brass: {density: [8400, 8730], melting: [900, 940]},
  orifice: {discharge: [0.6, 0.85], supply: 2000, supplyMbar: 20},
  gas: {density: 0.657, densityAt: 25, calorific: 38.7e6},
};
for (const [key, name] of [['expansion', 'EXPANSION'], ['expansionOther', 'EXPANSION_OTHER'], ['modulus', 'MODULUS'], ['brass', 'BRASS'], ['orifice', 'ORIFICE'], ['gas', 'GAS']]) assert.deepEqual(P[name], expected[key]);
const SRC = expected;
// Every expansion coefficient sits inside the company the other table keeps.
assert.ok(SRC.expansion.brass >= SRC.expansionOther.brass[0] && SRC.expansion.brass <= SRC.expansionOther.brass[1], 'brass expands as both tables say');
assert.ok(SRC.expansion.iron > SRC.expansionOther.ironForged && SRC.expansion.iron < SRC.expansionOther.ironPure, 'the iron taken lies between forged and pure');
assert.ok(SRC.expansion.carbonSteel >= SRC.expansionOther.steel[0] && SRC.expansion.carbonSteel <= SRC.expansionOther.steel[1], 'and carbon steel inside the steel spread');
assert.ok(SRC.expansion.brass > SRC.expansion.iron && SRC.expansion.iron > SRC.expansion.carbonSteel && SRC.expansion.invar < SRC.expansion.carbonSteel / 5,
  'brass outgrows iron, iron outgrows carbon steel, and invar hardly grows at all');


// These lessons must continue to explain three different actuator mechanisms.
{
  const lessons = [L.bimetalThermostatLesson, L.rodThermostatLesson, L.waxThermostatLesson];
  const names = ['bimetal', 'rod', 'wax'];
  for (let i = 0; i < lessons.length; i++) for (let j = i + 1; j < lessons.length; j++) {
    for (const field of ['simple', 'overview', 'misconception', 'limits']) {
      assert.ok(lessons[i][field] !== lessons[j][field], `${names[i]} and ${names[j]} do not share their ${field}`);
    }
    assert.ok(lessons[i].quiz.question !== lessons[j].quiz.question, `${names[i]} and ${names[j]} ask different questions`);
    assert.ok(lessons[i].steps.every((step, k) => step.title !== lessons[j].steps[k]?.title), `and walk through different steps`);
    assert.ok(lessons[i].deeper.every((item, k) => item.title !== lessons[j].deeper[k]?.title), 'and go deeper in different directions');
  }
  // The rod and wax pages describe their own actuator, not the bimetal one.
  assert.ok(!/bimetal/i.test(L.rodThermostatLesson.overview), 'the rod overview never mentions a bimetal strip');
  assert.ok(/tube/i.test(L.rodThermostatLesson.overview) && /rod/i.test(L.rodThermostatLesson.overview), 'it names the tube and rod that actually move its valve');
  assert.ok(/melt/i.test(L.waxThermostatLesson.overview), 'the wax overview is about melting');
  // The bimetal page keeps its own subject: its deeper sections are about bending,
  // not about the rod, the wax or a gas bypass, which belong to the sibling pages.
  const deeper = L.bimetalThermostatLesson.deeper.map(item => item.title).join(' | ');
  assert.ok(/expansion|motion/.test(deeper), 'the bimetal page explains the movement it depends on');
  assert.ok(!/wax/i.test(deeper) && !/bypass/i.test(deeper) && !/rod thermostat/i.test(deeper), 'and does not pad itself with its siblings');
}
console.log('PASS shared thermostat materials and distinct lesson content.');

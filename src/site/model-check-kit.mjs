// What every analytic model check owes the viewer and the reader, shared so
// each check file can spend its length on its own physics.
import assert from 'node:assert/strict';
import {fixed} from './format.js';

export function tally() {
  let count = 0;
  return {
    near(actual, expected, tolerance, message) {
      count++;
      assert.ok(Number.isFinite(actual) && Math.abs(actual - expected) <= tolerance, `${message}: ${actual} is not ${expected} within ${tolerance}`);
    },
    ok(condition, message) { count++; assert.ok(condition, message); },
    add(n = 1) { count += n; },
    get count() { return count; },
  };
}

const quoted = text => text.match(/(?<![A-Za-z\d.,])(?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d+)?/g) || [];

/**
 * Every number a trial's observation quotes is one the claim computes from the
 * model, formatted to the digits quoted, and every number in its instruction
 * is one of the trial's settings. `claims[title](state)` returns {text: value}.
 */
export function checkTrialNumbers(lesson, claims, run, t, model) {
  assert.deepEqual(Object.keys(claims), lesson.tryIt.map(trial => trial.title), 'a claim for every trial, in order');
  for (const trial of lesson.tryIt) {
    const values = claims[trial.title](run(trial.values), trial);
    assert.deepEqual([...new Set(quoted(trial.observe))].sort(), Object.keys(values).sort(), `${trial.title}: every quoted number is checked`);
    for (const [text, value] of Object.entries(values)) {
      assert.equal(fixed(value, (text.split('.')[1] || '').length), text, `${trial.title}: quotes ${text}`);
      t?.add();
    }
    const settings = new Set(Object.values(trial.values).map(value => String(Number(value))));
    // An option is chosen by its label, and a label often names the quantity it
    // stands for, so a number the reader reads off the chosen option counts too.
    for (const control of model?.controls || []) {
      if (!control.options) continue;
      const chosen = control.options.find(option => option.value === trial.values[control.key]);
      if (chosen) for (const number of quoted(chosen.label)) settings.add(String(Number(number.replaceAll(',', ''))));
    }
    for (const number of quoted(trial.instruction)) {
      assert.ok(settings.has(String(Number(number.replaceAll(',', '')))), `${trial.title}: instruction number ${number} is a setting`);
      t?.add();
    }
  }
}

/** Numbers quoted in free text (deeper sections, part text) match what the model computes. */
export function checkQuotedText(text, expected, t) {
  for (const [snippet, computed] of Object.entries(expected)) {
    assert.equal(computed, snippet, `computed text for ${snippet}`);
    assert.ok(text.includes(snippet), `text quotes ${snippet}`);
    t?.add();
  }
}

/**
 * Every control changes both the readings and the drawing. `snapshot()` returns
 * something comparable about the scene; `settle(model)` puts the model at the
 * moment to compare, after the control is applied.
 */
export function checkControlsMove(model, snapshot, settle = () => {}, t) {
  for (const control of model.controls) {
    const other = control.options ? control.options.find(option => option.value !== control.initial).value : control.initial === control.max ? control.min : control.max;
    const look = values => {
      model.reset();
      if (values) model.update(values);
      settle(model);
      model.root.updateMatrixWorld(true);
      return [JSON.stringify(model.getState().readings), JSON.stringify(snapshot())];
    };
    const before = look(null), after = look({[control.key]: other});
    assert.notEqual(after[0], before[0], `${control.key} changes the readings`);
    assert.notEqual(after[1], before[1], `${control.key} changes the drawing`);
    t?.add(2);
  }
}

/** Finite transforms and vertices everywhere in the scene. */
export function checkFinite(root, t) {
  root.updateMatrixWorld(true);
  root.traverse(object => {
    assert.ok(object.matrixWorld.elements.every(Number.isFinite), `${object.name || object.type}: finite transform`);
    const positions = object.geometry?.attributes?.position?.array;
    if (positions) for (const value of positions) assert.ok(Number.isFinite(value), `${object.name || object.type}: finite vertex`);
  });
  t?.add();
}

/** Disposing twice releases every geometry, material and texture exactly once. */
export function checkDisposal(model, t) {
  const resources = new Set();
  model.root.traverse(object => {
    if (object.geometry) resources.add(object.geometry);
    for (const material of object.material ? [].concat(object.material) : []) {
      resources.add(material);
      for (const key of ['map', 'gradientMap']) if (material[key]) resources.add(material[key]);
    }
  });
  const counts = new Map([...resources].map(resource => [resource, 0]));
  for (const resource of resources) resource.addEventListener('dispose', () => counts.set(resource, counts.get(resource) + 1));
  model.dispose();
  model.dispose();
  assert.ok([...counts.values()].every(count => count === 1), 'every geometry, material and texture disposed exactly once');
  t?.add();
  return resources.size;
}

/** A physics sampler refuses controls off their domain and times that are not a trial time. */
export function checkRefusals(sample, domains, t) {
  for (const [key, [lo, hi, step]] of Object.entries(domains)) {
    for (const bad of [NaN, Infinity, lo - step, hi + step, lo + step / 3]) assert.throws(() => sample({[key]: bad}), RangeError, `${key} = ${bad} refused`);
  }
  for (const bad of [null, [], 'x']) assert.throws(() => sample(bad), TypeError);
  assert.throws(() => sample({wrong: 1}), RangeError);
  for (const bad of [-1, NaN, Infinity]) assert.throws(() => sample({}, bad), RangeError);
  t?.add();
}

/** Two closed outlines, as arrays of {x, y}, share no crossing edges. */
export function outlinesCross(first, second) {
  const edges = polygon => polygon.map((a, i) => [a, polygon[(i + 1) % polygon.length]]);
  const area = (a, b, c) => (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
  const box = ([a, b]) => [Math.min(a.x, b.x), Math.max(a.x, b.x), Math.min(a.y, b.y), Math.max(a.y, b.y)];
  const A = edges(first).map(edge => [edge, box(edge)]), B = edges(second).map(edge => [edge, box(edge)]);
  for (const [[a, b], [ax0, ax1, ay0, ay1]] of A) {
    for (const [[c, d], [bx0, bx1, by0, by1]] of B) {
      if (ax1 < bx0 || bx1 < ax0 || ay1 < by0 || by1 < ay0) continue;
      if (area(a, b, c) * area(a, b, d) < -1e-18 && area(c, d, a) * area(c, d, b) < -1e-18) return true;
    }
  }
  return false;
}

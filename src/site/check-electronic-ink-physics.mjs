import assert from 'node:assert/strict';
import {INK_PATCH, INK_DEFAULTS, INK_WORDS, createInkController, inkAt, inkPixels, inkPlan, inkReadback, inkRequested, inkSettings} from './electronic-ink-physics.js';

const white = Array(119).fill(0), black = Array(119).fill(1);
const same = (a, b) => assert.deepEqual(a, b);
const close = (a, b) => assert(Math.abs(a - b) < 1e-10, `${a} != ${b}`);
assert.equal(INK_PATCH.columns * INK_PATCH.rows, 119);
assert.equal(INK_WORDS.length, 4);
for (const item of INK_WORDS) {
  assert.equal(item.rows.length, 7);
  assert(item.rows.every(row => /^[01]{17}$/.test(row)));
  assert.equal(item.pixels.length, 119);
}
// Independently written raster references check the visible glyphs and spacing.
same(INK_WORDS[1].rows, ['01111001110011111', '10000010001000100', '10000010001000100', '10000011111000100', '10000010001000100', '10000010001000100', '01111010001000100']);
same(INK_WORDS[2].rows, ['01111001110011110', '10000010001010001', '10000010001010001', '10000011111011110', '10000010001010100', '10000010001010010', '01111010001010001']);
same(inkReadback(white), {text: '', contrast: 0, complete: true});
same(inkReadback(black), {text: '', contrast: 1, complete: true});
for (let word = 0; word < 4; word++) for (const contrast of [0, 1]) same(inkReadback(inkRequested({word, contrast})), {text: INK_WORDS[word].text, contrast, complete: true});
const altered = [...INK_WORDS[0].pixels]; altered[0] = 1 - altered[0];
assert.equal(inkReadback(altered).complete, false);
assert.equal(inkReadback(Array(119).fill(.5)).complete, false);
const partial = inkAt(inkPlan({word: 2}, INK_WORDS[1].pixels), 1.2).pixels;
const starts = [white, black, INK_WORDS[0].pixels, INK_WORDS[1].pixels, partial, Array.from({length:119}, (_, i) => i % 2)];
let combinations = 0, samples = 0;
for (let word = 0; word < 4; word++) for (const contrast of [0, 1]) for (const power of [0, 1]) for (const light of [0, 1]) {
  const settings = {word, contrast, power, light};
  for (const start of starts) {
    const plan = inkPlan(settings, start), requested = INK_WORDS[word].pixels.map(value => contrast ? 1 - value : value);
    same(inkAt(plan, 0).pixels, start);
    const final = inkAt(plan, 100);
    same(final.pixels, power ? requested : start);
    assert(final.voltages.every(value => value === 0));
    assert.equal(final.visible, Boolean(light));
    assert.equal(final.matchedCells, (power ? requested : start).filter((value, i) => Math.abs(value - requested[i]) < 1e-10).length);
    for (const time of [0, .2, .4, .8, 1.2, 3.2, 5.6, Math.max(0, plan.duration - 1e-13), plan.duration, 100]) {
      const now = inkAt(plan, time);
      assert(Number.isInteger(now.activeRow) && now.activeRow >= -1 && now.activeRow < 7);
      assert(Number.isInteger(now.selected) && now.selected >= 0 && now.selected < 119);
      assert(now.pixels.every((value, i) => Number.isFinite(value) && value >= Math.min(start[i], plan.target[i]) - 1e-10 && value <= Math.max(start[i], plan.target[i]) + 1e-10));
      now.voltages.forEach((voltage, i) => {
        assert([0, -15, 15].includes(voltage));
        if (voltage) {
          assert(power && !now.complete && Math.floor(i / 17) === now.activeRow);
          assert.equal(Math.sign(voltage), Math.sign(plan.target[i] - start[i]));
        }
      });
      assert.equal(now.blackForce, now.field);
      assert.equal(now.whiteForce, -now.field);
      if (!power) same(now.pixels, start);
      samples++;
    }
  }
  combinations++;
}
const update = inkPlan({word: 2}, INK_WORDS[1].pixels);
assert(update.changed.length > 0 && update.changed.every(index => index % 17 >= 12));
for (const time of [0, .2, .8, 1.2, 5.6, 100]) {
  const now = inkAt(update, time);
  for (let i = 0; i < 119; i++) if (i % 17 < 12) assert.equal(now.pixels[i], INK_WORDS[1].pixels[i]);
}
for (const stop of [.1, .8, 1.2, 2.4, 5.6]) {
  const control = createInkController({settings:{word:2}, pixels:INK_WORDS[1].pixels});
  control.advance(stop);const before = control.getState();
  control.update({light:0});same(control.getState().now.pixels, before.now.pixels);assert.equal(control.getState().clock, before.clock);
  control.update({power:0});const retained = control.getState().now.pixels;
  assert.equal(control.getState().now.selected, before.now.selected, 'Removing power retains the inspected pixel, including at row boundaries');
  assert(control.getState().now.voltages.every(value => value === 0));
  control.update({word:0});control.advance(1e5);same(control.getState().now.pixels, retained);
  control.update({power:1,light:1});same(control.getState().now.pixels, retained);
  control.advance(100);same(control.getState().now.pixels, INK_WORDS[0].pixels);
  const replay = control.replayState();control.reset(replay);same(control.getState().now.pixels, retained);
  control.advance(100);same(control.getState().now.pixels, INK_WORDS[0].pixels);
}
const heldPartial = createInkController({settings:{word:2,power:0},pixels:partial}).getState();
assert(heldPartial.now.pixels[heldPartial.now.selected] > 0 && heldPartial.now.pixels[heldPartial.now.selected] < 1, 'An interrupted-image inspection selects unfinished pigment');
const controller = createInkController();controller.advance(.4);
const before = controller.getState();controller.update({...INK_DEFAULTS});same(controller.getState(), before);
for (const bad of [null, [], 3, {word:4}, {word:-1}, {word:.5}, {power:NaN}, {light:Infinity}, {extra:1}]) {
  assert.throws(() => inkSettings(bad));assert.throws(() => controller.update(bad));same(controller.getState(), before);
}
for (const bad of [[], Array(118).fill(0), Array(119), Array(119).fill(NaN), [...white.slice(0,118),2]]) assert.throws(() => inkPixels(bad));
for (const time of [-1, NaN, Infinity]) {
  assert.throws(() => inkAt(inkPlan(), time));assert.throws(() => controller.advance(time));
  assert.throws(() => controller.reset({time}));same(controller.getState(), before);
}
const divided = createInkController();for (let i = 0; i < 28; i++) divided.advance(.2);
close(divided.getState().clock, 5.6);assert(divided.getState().now.complete);same(divided.getState().now.pixels, INK_WORDS[0].pixels);
const exposed = divided.getState();exposed.values.word = 3;exposed.now.pixels[0] = .123;same(divided.getState().now.pixels, INK_WORDS[0].pixels);
assert(Object.isFrozen(divided.getState().plan.start));
console.log(`PASS: ${combinations} settings combinations, ${starts.length} initial images and ${samples} samples; glyphs, polarity, retention, partial updates, replay, light and validation.`);

import assert from 'node:assert/strict';
import {READER_BOOKS, READER_DEFAULTS, READER_DOMAINS, READER_PAGE, createReaderController, readerAt, readerPixels, readerPlan, readerReadback, readerRequested, readerSettings} from './e-reader-physics.js';

const same = (a, b) => assert.deepEqual(a, b), blank = Array(READER_PAGE.cells).fill(0);
const pages = READER_BOOKS.flatMap(book => book.pages);
assert.equal(pages.length, 6);assert.equal(new Set(pages.map(page => page.pixels.join(''))).size, 6);
assert.equal(READER_PAGE.cells, READER_PAGE.columns * READER_PAGE.rows);
for (const [book, item] of READER_BOOKS.entries()) for (const [page, stored] of item.pages.entries()) {
  const readback = readerReadback(stored.pixels);assert.equal(readback.book, book);assert.equal(readback.page, page);
  assert(stored.pixels.every(value => value === 0 || value === 1));assert(stored.pixels.filter(Boolean).length > 500);
  assert(stored.lines.every(line => line.length <= 11));
  for (let row = 0; row < READER_PAGE.rows; row++) for (let column = 0; column < READER_PAGE.columns; column++) {
    if (row < 3 || row >= READER_PAGE.rows - 3 || column < 3 || column >= READER_PAGE.columns - 3) assert.equal(stored.pixels[row * READER_PAGE.columns + column], 0, 'Page margins remain white');
  }
  const number = page ? ['01110','10001','00001','00010','00100','01000','11111'] : ['00100','01100','00100','00100','00100','00100','01110'];
  for (let row = 0; row < 7; row++) same(stored.pixels.slice((18 + row) * 72 + 48, (18 + row) * 72 + 53), [...number[row]].map(Number));
  assert(Object.isFrozen(stored) && Object.isFrozen(stored.lines) && Object.isFrozen(stored.pixels));
}
assert.equal(readerReadback(blank).name, 'Blank page');
const partial = pages[0].pixels.map((value, index) => value !== pages[2].pixels[index] && index % 3 === 0 ? .5 : value);
assert.equal(readerReadback(partial).name, 'Partial page');
const initialImages = [blank, ...pages.map(page => page.pixels), partial];
let combinations = 0, samples = 0;
for (const book of [0, 1, 2]) for (const page of [0, 1]) for (const power of [0, 1]) for (const ambient of [0, 1]) for (const frontlight of [0, 1, 2]) {
  const values = {book, page, power, ambient, frontlight}, request = pages[book * 2 + page].pixels;++combinations;
  for (const start of initialImages) {
    const plan = readerPlan(values, start), changed = start.map((value, index) => power && Math.abs(value - request[index]) > 1e-10 ? index : -1).filter(index => index >= 0), changedSet = new Set(changed);
    same(plan.changed, changed);same(plan.start, start);same(readerAt(plan, 0).pixels, start);
    assert(Object.isFrozen(plan) && Object.isFrozen(plan.start) && Object.isFrozen(plan.target));
    let previous = start;
    for (const time of [...new Set([0, .349, .35, .649, .65, .68, plan.duration / 2, Math.max(0, plan.duration - .03), plan.duration, plan.duration + 1])].sort((a, b) => a - b)) {
      const now = readerAt(plan, time), goal = power ? request : start;++samples;
      assert(now.pixels.every(value => Number.isFinite(value) && value >= 0 && value <= 1));
      assert(now.pixels.every((value, index) => Math.abs(value - goal[index]) <= Math.abs(previous[index] - goal[index]) + 1e-10), 'Material approaches only its current target');
      assert(now.pixels.every((value, index) => changedSet.has(index) || value === start[index]), 'Unaddressed material retains its state');
      assert(now.directions.every((value, index) => value === 0 || power && Math.floor(index / 72) === now.activeRow && Math.sign(goal[index] - start[index]) === value));
      if (now.activeRow >= 0) assert.equal(now.directions.filter(Boolean).length, changed.filter(index => Math.floor(index / 72) === now.activeRow).length);
      if (time < .65 || !power || now.complete) assert(now.directions.every(value => value === 0));
      if (time <= .65) same(now.pixels, start);
      assert.equal(now.frontLight, power ? frontlight / 2 : 0);assert.equal(now.illumination, Math.min(1, ambient + (power ? frontlight / 2 : 0)));
      assert.equal(now.visible, now.illumination > 0);assert.equal(now.pending, now.pixels.some((value, index) => Math.abs(value - request[index]) > 1e-10));
      if (now.complete) {same(now.pixels, goal);assert.equal(now.activeRow, -1);assert.equal(now.writtenPixels, changed.length);}
      if (!power) {assert.equal(now.stage, 'Off');assert.equal(now.textLoaded, false);assert.equal(now.framebufferReady, false);}
      previous = now.pixels;
    }
    if (power) {const end = readerAt(plan, plan.duration);assert.equal(end.readback.book, book);assert.equal(end.readback.page, page);}
    same(start, plan.start);
  }
}
assert.equal(combinations, 72);
const controller = createReaderController({settings: {book: 1}, pixels: pages[0].pixels});
assert.equal(controller.getState().now.stage, 'Reading stored text');controller.advance(.4);
assert.equal(controller.getState().now.stage, 'Composing pixels');same(controller.getState().now.pixels, pages[0].pixels);
controller.advance(.8);const moving = controller.getState();assert.equal(moving.now.stage, 'Writing display');assert(moving.now.pending);
controller.update({ambient: 0, frontlight: 2});same(controller.getState().now.pixels, moving.now.pixels);assert.equal(controller.getState().clock, moving.clock);
same(controller.getState().now.directions, moving.now.directions);controller.update({book: 1});assert.equal(controller.getState().clock, moving.clock);
controller.update({power: 0});same(controller.getState().now.pixels, moving.now.pixels);assert.equal(controller.getState().now.frontLight, 0);assert(!controller.getState().now.visible);
controller.update({book: 2, page: 1, frontlight: 1});controller.advance(10000);same(controller.getState().now.pixels, moving.now.pixels);assert(controller.getState().now.pending);
controller.update({ambient: 1});same(controller.getState().now.pixels, moving.now.pixels);assert(controller.getState().now.visible);
controller.update({power: 1});same(controller.getState().now.pixels, moving.now.pixels);assert.equal(controller.getState().clock, 0);
controller.advance(100);same(controller.getState().now.pixels, pages[5].pixels);assert(controller.getState().now.directions.every(value => value === 0));
controller.update({page: 0});controller.advance(100);same(controller.getState().now.pixels, pages[4].pixels);
controller.update({page: 1});controller.advance(100);same(controller.getState().now.pixels, pages[5].pixels);
const replay = controller.replayState();same(replay.pixels, pages[4].pixels);controller.reset(replay);same(controller.getState().now.pixels, pages[4].pixels);
controller.advance(.8);const partialBefore = controller.getState();controller.update({book: 0, page: 0});same(controller.getState().now.pixels, partialBefore.now.pixels);
controller.advance(100);same(controller.getState().now.pixels, pages[0].pixels);
for (const invalid of [{book: 3}, {page: -1}, {power: .5}, {ambient: NaN}, {frontlight: 3}, {missing: 1}, [], null]) {
  const before = controller.getState();assert.throws(() => controller.update(invalid));same(controller.getState(), before);
}
for (const invalid of [{time: -1}, {selected: -1}, {pixels: []}, null]) {const before = controller.getState();assert.throws(() => controller.reset(invalid));same(controller.getState(), before);}
for (const seconds of [-1, Infinity, NaN]) {const before = controller.getState();assert.throws(() => controller.advance(seconds));same(controller.getState(), before);}
assert.throws(() => readerPixels(Array(6912)));assert.throws(() => readerPixels([...blank.slice(1), 2]));
same(readerSettings(), READER_DEFAULTS);assert(Object.values(READER_DOMAINS).every(Object.isFrozen));
const mutable = readerRequested();mutable[0] = 1;assert.equal(READER_BOOKS[0].pages[0].pixels[0], 0);
console.log(`PASS: ${combinations} settings combinations, ${initialImages.length} starting images and ${samples} state samples; six readable pages, margins, page numbers, staged updates, changed rows, retention, power-gated lighting, interruption, replay and transactional validation.`);

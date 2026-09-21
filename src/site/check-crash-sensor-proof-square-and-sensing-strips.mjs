import assert from 'node:assert/strict';
import {mkdir, writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {chromium} from 'playwright';
import {crashSensorProofSquareAndSensingStripsLesson as lesson} from './crash-sensor-proof-square-and-sensing-strips-lesson.js';
import {crashSensorBrowserReference,crashSensorReadingTolerance} from './check-crash-sensor.mjs';
import {neighborhoodCatalog} from './catalog-data.js';
import {houseComponents} from './house-components.js';

const keys = ['deceleration', 'pulseDuration', 'damping', 'supply'];
const tuples = [
  [20, .004, .7, 1], [0, .004, .7, 1], [10, .004, .7, 1],
  [20, .001, .7, 1], [20, .002, .25, 1], [20, .001, .25, 1],
  [20, .001, 1, 1], [-20, .004, .7, 1], [-20, .001, .25, 1],
  [20, .004, .7, 0],
];
const stageLabels = [
  'Inspect start (0 ms)', 'Inspect pulse midpoint (T/2)',
  'Inspect late pulse (3T/4)', 'Inspect pulse end (T)',
  'Inspect early recovery (T + 1 ms)', 'Inspect later recovery (T + 4 ms)',
  'Inspect final record (25 ms)',
];
const stageTimes = duration => [0, duration / 2, 3 * duration / 4, duration, duration + .001, duration + .004, .025];
const inspections = [
  ['Inspect the chip', 'Square and four flexures'],
  ['Inspect flexure bending', 'Four bending strips'],
  ['Inspect the equivalent bridge', 'Equivalent circuit'],
  ['Inspect the signal record', 'Bridge and conditioned signal'],
  ['Inspect the motion records', 'Actual motion and signal records'],
];

export async function checkCrashSensorProofSquareAndSensingStripsBrowser() {
  const evidence = new URL('../../'+(process.env.EVIDENCE_DIR||'documentation/audit/evidence/crash-sensor-proof-square-and-sensing-strips/')+'/', import.meta.url);
  await mkdir(evidence, {recursive: true});
  const browser = await chromium.launch({headless: true});
  const page = await browser.newPage({viewport: {width: 1440, height: 1000}}), errors = [];
  page.setDefaultTimeout(10000);
  page.on('pageerror', error => errors.push(error.message));
  const control = key => page.locator(`[data-control="${key}"]`);
  const number = key => page.locator(`[data-number="${key}"]`);
  const read = () => page.locator('.daily-readings > div').evaluateAll(nodes => Object.fromEntries(
    nodes.map(node => [node.querySelector('dt')?.textContent, node.querySelector('dd')?.textContent]),
  ));
  const numeric=text=>parseFloat(text.replaceAll(',',''));
  const near = (actual, expected, tolerance = .0005001) => assert.ok(
    Number.isFinite(actual) && Math.abs(actual - expected) <= tolerance,
    `${actual} differs from ${expected}, tolerance ${tolerance}`,
  );
  const frames = () => page.evaluate(() => new Promise(resolve => requestAnimationFrame(
    () => requestAnimationFrame(() => requestAnimationFrame(resolve)),
  )));
  const shot = async name => {await page.mouse.move(0,0);await page.locator('canvas').evaluate(c=>c.scrollIntoView({block:'start',behavior:'instant'}));await page.waitForTimeout(150);return page.screenshot({path:new URL(`browser-${name}.png`,evidence).pathname,clip:await page.locator('canvas').boundingBox()});};
  const sceneShot=shot;
  const inspect = index => page.getByRole('button', {name: stageLabels[index], exact: true}).click();
  const setValue = async (key, value) => {
    if (key === 'deceleration') await number(key).fill(String(value));
    else await control(key).selectOption(String(value));
  };
  async function armReplayCapture() {
    await page.locator('[data-play]').evaluate(button => {
      window.proofSquareReplayStart = null;
      button.addEventListener('click', () => {
        window.proofSquareReplayStart = Object.fromEntries([...document.querySelectorAll('.daily-readings > div')]
          .map(node => [node.querySelector('dt')?.textContent, node.querySelector('dd')?.textContent]));
      }, {once: true});
    });
  }
  async function takeReplayCapture() {
    return page.evaluate(() => {
      const value = window.proofSquareReplayStart;
      delete window.proofSquareReplayStart;
      return value;
    });
  }
  async function compare(values, elapsed, timeResolution = 0) {
    const readings = await read(), reference = crashSensorBrowserReference(values, elapsed);
    // Enclose the half-unit rounding of paused milliseconds separately from
    // the displayed precision of each physical reading.
    const endpoints = timeResolution ? [-1, 1].map(sign => crashSensorBrowserReference(values, Math.max(0, elapsed + sign * timeResolution))) : [];
    for(const r of [reference,...endpoints]){
      const force=r.expected['Base forcing']+r.expected['Restoring force']+r.expected['Damping force'];
      r.expected['Relative force sum']=force;
      r.expected['Relative acceleration']=force*1e-6/(2330*.001**2*40e-6+13/35*(4*2330*.001*50e-6*5e-6));
    }
    for (const [label, expected] of Object.entries(reference.expected)) {
      assert.ok(Object.hasOwn(readings, label), `Missing ${label}`);
      const timeRounding = Math.max(0, ...endpoints.map(endpoint => Math.abs(endpoint.expected[label] - expected)));
      near(numeric(readings[label]), expected, crashSensorReadingTolerance(label) + timeRounding);
    }
    near(numeric(readings['Energy balance error']), 0, .0000001);
    if (values.supply) {
      near(numeric(readings['Conditioned voltage']), reference.filtered * 1000,.0005001+Math.max(0,...endpoints.map(r=>Math.abs(r.filtered-reference.filtered)*1000)));
      assert.equal(readings['Current comparison'], reference.comparison ? 'Above threshold' : 'Below threshold');
      assert.equal(readings['Retained event'], reference.latched ? 'Recorded' : 'Not recorded');
      if (reference.firstCrossing === null) assert.equal(readings['First threshold crossing'], 'Not yet');
      else near(numeric(readings['First threshold crossing']), reference.firstCrossing * 1000, .0005001);
    } else {
      for (const label of ['Conditioned voltage', 'Current comparison', 'Retained event', 'First threshold crossing']) {
        assert.match(readings[label], /unavailable.*supply off/i, label);
      }
    }
    assert.equal(await page.locator('.daily-readings>div').count(),37);assert.equal(await page.locator('.daily-readings>div').filter({has:page.locator('p')}).count(),37);
    assert.match(readings['Drawing scales'], /500/);
    assert.match(readings['Model limit'], /linear|four.beam/i);
    return {values: {...values}, elapsed, readings};
  }
  async function assertChipFocus(part='chip') {
    assert.equal(await page.locator('.daily-part-detail h3').textContent(), part==='chip'?'Square and four flexures':'Square displacement record');
    assert.equal(await page.locator('.daily-part-path button[data-parent]').last().getAttribute('data-parent'), part);
    assert.equal(await page.getByRole('checkbox', {name: 'Isolate selected part', exact: true}).isChecked(), true);
  }
  async function focusDisplacement(held, early) {
    await page.getByRole('button', {name: early ? 'Inspect displacement record (0–5 ms)' : 'Inspect displacement record (0–25 ms)', exact: true}).click();
    assert.equal(await page.locator('.daily-part-detail h3').textContent(), 'Square displacement record');
    assert.equal(await page.locator('.daily-part-path button[data-parent]').last().getAttribute('data-parent'), 'displacement-record');
    assert.equal(await page.getByRole('checkbox', {name: 'Isolate selected part', exact: true}).isChecked(), true);
    assert.deepEqual(await read(), held);
  }
  async function preset(index) {
    await page.getByRole('tab', {name: 'Try it yourself', exact: true}).click();
    await page.getByRole('button', {name: 'Set up this experiment', exact: true}).nth(index).click();
    await page.getByRole('tab', {name: 'Controls', exact: true}).click();
    for (const key of keys) assert.equal(Number(await control(key).inputValue()), lesson.tryIt[index].values[key]);
    await compare(lesson.tryIt[index].values, 0);
    await assertChipFocus(lesson.tryIt[index].part);
  }
  try {
    const titles = ['Follow inertia and restoring forces', 'Keep the frame in steady motion',
      'Halve displacement, quarter the energy', 'End the pulse with relative motion',
      'Compare a two-millisecond pulse', 'Watch lightly damped rebound', 'Compare critical restoration',
      'Reverse motion, preserve energy', 'Follow reversed rebound', 'Remove power, retain mechanical recovery'];
    assert.deepEqual(lesson.tryIt.map(experiment => experiment.title), titles);
    assert.equal(lesson.tryIt.length, 10);
    for (const [i, tuple] of tuples.entries()) {
      assert.deepEqual(lesson.tryIt[i].values, Object.fromEntries(keys.map((key, j) => [key, tuple[j]])));
      assert.equal(lesson.tryIt[i].reset, true);
      const chart=[3,4,6,8].includes(i);
      assert.equal(lesson.tryIt[i].part, chart?'displacement-record':'chip');
      assert.equal(lesson.tryIt[i].isolate, true);
      assert.equal(lesson.tryIt[i].view, chart?'front':'iso');
    }
    const name = 'Crash-sensor proof square and sensing strips', slug = 'crash-sensor-proof-square-and-sensing-strips';
    const entries = neighborhoodCatalog.entries.filter(entry => entry.name === name);
    assert.equal(entries.length, 1);
    assert.equal(entries[0].id, slug);
    assert.equal(entries[0].group, 'airbag');
    const group = neighborhoodCatalog.groups.find(candidate => candidate.id === entries[0].group);
    assert.equal(group.items[0], 'Airbag');
    assert.equal(group.place, 'workshop');
    assert.equal(group.room, 'Garage');
    const component = houseComponents[name];
    assert.equal(component.machine, 'Crash sensor');
    assert.equal(component.part, 'chip');
    assert.equal(component.isolate, true);assert.equal(component.view,'iso');assert.equal(typeof component.createModel,'function');
    assert.equal(component.lesson, lesson);
    const entryContract = {name, slug, canonicalGroup: group.id, canonicalParent: 'Microchip deceleration sensor', provider: component.machine};
    await page.goto(`${process.env.SITE_URL || 'http://127.0.0.1:4177/'}#list`);
    await page.locator('#catalog-search').fill(name);
    const nested=page.locator(`.catalog-components button[data-entry="${slug}"]`);
    assert.equal(await nested.count(),0,'Passive sensing parts are not catalog machines');
    assert.equal(await page.locator('td>button[data-entry="crash-sensor"]').count(),1);
    assert.equal(await page.locator(`td>button[data-entry="${slug}"]`).count(),0,'Component stays below its whole item');
    await page.screenshot({path:new URL('browser-nested-catalog-entry.png',evidence).pathname});
    await page.locator('button[data-entry="crash-sensor"]').click();
    await page.locator(`.daily-related a[href="#machine/${slug}"]`).click();
    await page.getByRole('heading', {name, exact: true}).waitFor();
    assert.equal(new URL(page.url()).hash, `#machine/${slug}`);
    assert.equal(await page.title(), `${name} · How Things Work`);
    assert.equal(await page.locator('.house-breadcrumbs [aria-current="page"]').textContent(), name);
    assert.equal(await page.locator('.daily-simple').textContent(), lesson.simple);
    assert.equal(await page.locator('.daily-overview').textContent(), lesson.overview);
    assert.ok(lesson.related.includes('Microchip deceleration sensor'));
    assert.match(lesson.overview, /microchip deceleration sensor/i);
    const parentLink = page.locator('.daily-related a[href="#machine/microchip-deceleration-sensor"]');
    assert.equal(await parentLink.count(), 1);
    await parentLink.click();
    await page.getByRole('heading', {name: 'Crash sensor', exact: true}).waitFor();
    assert.equal(new URL(page.url()).hash, '#machine/crash-sensor');
    assert.match(await page.locator('.daily-overview').innerText(), /Microchip deceleration sensor names this same sensing device/);
    await page.goto(`${process.env.SITE_URL || 'http://127.0.0.1:4177/'}#machine/${slug}`);
    await page.getByRole('heading', {name, exact: true}).waitFor();
    await assertChipFocus();
    assert.equal(await page.locator('[data-control]').count(), 4);
    for (const key of ['pulseDuration', 'damping', 'supply']) assert.equal(await control(key).evaluate(node => node.tagName), 'SELECT');
    assert.equal(await page.getByRole('checkbox', {name: 'Look inside', exact: true}).count(), 0);
    assert.equal(await page.locator('[data-result]').isDisabled(), true);
    await shot('initial');
    const trials = [];
    for (let i = 0; i < tuples.length; i++) {
      await preset(i);
      const rows = [], times = stageTimes(lesson.tryIt[i].values.pulseDuration);
      for (const [j, time] of times.entries()) {
        await inspect(j);
        rows.push(await compare(lesson.tryIt[i].values, time));
        if ([0, 3, 4, 5, 8, 9].includes(i) && [2, 3, 4, 6].includes(j)) await shot(`preset-${i}-stage-${j}`);
      }
      trials.push(rows);
      console.log(`PASS experiment ${i + 1}: ${lesson.tryIt[i].title}`);
    }
    const value = (i, j, label) => numeric(trials[i][j].readings[label]);
    const signedMechanical = ['Square relative displacement', 'Square relative velocity',
      'R1 / R4 mean strain', 'R2 / R3 mean strain', 'Restoring force', 'Damping force',
      'Base forcing', 'Relative force sum', 'Relative acceleration', 'Frame acceleration', 'Frame velocity change', 'Frame displacement change'];
    const quadratic = ['Relative mechanical energy', 'Base forcing work', 'Damping loss'];
    const mechanicalComparisons = [];
    for (let j = 0; j < stageLabels.length; j++) {
      for (const label of signedMechanical) {
        near(2 * value(2, j, label), value(0, j, label), .0015001);
        near(value(7, j, label), -value(0, j, label), .0010001);
        near(value(9, j, label), value(0, j, label), .0010001);
        near(value(1, j, label), 0);
      }
      for (const label of quadratic) {
        near(4 * value(2, j, label), value(0, j, label), .0025001);
        near(value(7, j, label), value(0, j, label), .0010001);
        near(value(9, j, label), value(0, j, label), .0010001);
        near(value(1, j, label), 0);
      }
      for (let i = 0; i < tuples.length; i++) {
        const displacement = value(i, j, 'Square relative displacement') * 1e-6;
        const velocity = value(i, j, 'Square relative velocity') * .001;
        const modalMass = 2330 * .001 ** 2 * 40e-6 + 13 / 35 * (4 * 2330 * .001 * 50e-6 * 5e-6);
        const kineticPj = .5 * modalMass * velocity ** 2 * 1e12;
        const elasticPj = .5 * 4 * displacement ** 2 * 1e12;
        // Propagate rounding of displayed q and velocity through the quadratic energy.
        const dq=.0005e-6,dv=.0005e-3,energyRounding=(.5*modalMass*(2*Math.abs(velocity)*dv+dv*dv)+2*(2*Math.abs(displacement)*dq+dq*dq))*1e12;
        near(value(i, j, 'Relative mechanical energy'), kineticPj + elasticPj, .0005001+energyRounding);
        near(value(i, j, 'Relative mechanical energy') + value(i, j, 'Damping loss'), value(i, j, 'Base forcing work'), .0015001);
        if (j > 3) assert.ok(value(i, j, 'Relative mechanical energy') <= value(i, j - 1, 'Relative mechanical energy') + .000001);
        mechanicalComparisons.push({preset: i, stage: j, kineticPj, elasticPj,
          netRelativeForceMicroN: value(i, j, 'Base forcing') + value(i, j, 'Restoring force') + value(i, j, 'Damping force')});
      }
    }
    near(value(0, 1, 'Square relative displacement'), .457905834684);
    near(value(0, 1, 'Square relative velocity'), .124825465220);
    near(value(0, 1, 'R2 / R3 mean strain'), 6.525158144240);
    near(value(0, 1, 'Base forcing'), 1.8873);
    near(value(0, 1, 'Restoring force'), -1.831623338734);
    near(value(0, 1, 'Damping force'), -.107195423387);
    // This is a dynamic generalized-force sum. It need not vanish, nor have
    // the sign of the current relative velocity or displacement.
    const midpointNet = value(0, 1, 'Base forcing') + value(0, 1, 'Restoring force') + value(0, 1, 'Damping force');
    near(midpointNet, -.051518762121, .0015001);
    assert.ok(midpointNet < 0 && value(0, 1, 'Square relative velocity') > 0);
    near(value(0, 1, 'Relative mechanical energy'), .420088342257);
    near(value(2, 1, 'Relative mechanical energy'), .105022085564);
    near(value(3, 3, 'Frame acceleration'), 0);
    near(value(3, 3, 'Square relative displacement'), .226648622111);
    near(value(3, 3, 'Square relative velocity'), -1.106743896879);
    near(value(3, 3, 'Relative mechanical energy'), .160348723455);
    assert.ok(value(3, 3, 'Restoring force') < 0 && value(3, 3, 'Damping force') > 0);
    near(value(6, 3, 'Square relative displacement'), .229938527624);
    near(value(6, 3, 'Square relative velocity'), -.759892387582);
    assert.ok(value(6, 3, 'Relative mechanical energy') > 0);
    near(value(4, 6, 'Frame velocity change'), -.02);
    near(value(0, 6, 'Frame velocity change'), -.04);
    assert.ok(value(4, 6, 'Frame displacement change') < value(4, 3, 'Frame displacement change'));
    await preset(8);
    await inspect(3);
    await page.locator('[data-step]').click();
    const reverseRebound = await compare(lesson.tryIt[8].values, .00125);
    assert.ok(numeric(reverseRebound.readings['Square relative displacement']) > 0);
    assert.ok(numeric(reverseRebound.readings['Bridge differential voltage']) > 1);
    assert.ok(numeric(reverseRebound.readings['Conditioned voltage']) < 0);
    assert.equal(reverseRebound.readings['Retained event'], 'Not recorded');
    await shot('reverse-rebound');
    await focusDisplacement(reverseRebound.readings, true);
    await sceneShot('early-window-reverse-1_25ms');
    await focusDisplacement(reverseRebound.readings, false);
    await sceneShot('full-window-reverse-1_25ms');
    await inspect(6);
    const lateWindowState = await read();
    await focusDisplacement(lateWindowState, true);
    await sceneShot('early-window-after-end-no-current-marker');
    await page.getByRole('button', {name: 'Reset experiment', exact: true}).click();
    await assertChipFocus();
    await compare(lesson.tryIt[0].values, 0);
    await sceneShot('reset-restored-full-window');
    await page.getByRole('button', {name: 'Inspect early signal (0–5 ms)', exact: true}).click();
    await preset(0);
    await inspect(3);
    await compare(lesson.tryIt[0].values, .004);
    await sceneShot('preset-restored-full-window');
    const allControls = [];
    for (const deceleration of [-20, -10, 0, 10, 20]) for (const pulseDuration of [.001, .002, .004, .008]) {
      for (const damping of [.25, .7, 1]) for (const supply of [0, 1]) {
        const values = {deceleration, pulseDuration, damping, supply};
        for (const key of keys) await setValue(key, values[key]);
        await compare(values, 0);
        await inspect(2);
        allControls.push(await compare(values, .75 * pulseDuration));
        if (allControls.length % 24 === 0) console.log(`PASS control settings ${allControls.length}/120`);
      }
    }
    await preset(0);
    await page.locator('[data-step]').click();
    await compare(lesson.tryIt[0].values, .00025);
    await page.locator('[data-play]').click();
    await frames();
    await page.locator('[data-play]').click();
    const paused = await read();
    await frames();
    assert.deepEqual(await read(), paused);
    await preset(0);
    const started = Date.now();
    await page.locator('[data-play]').click();
    await page.waitForFunction(() => document.querySelector('[data-play]')?.getAttribute('aria-pressed') === 'false', null, {timeout: 50000});
    const playbackWallSeconds = (Date.now() - started) / 1000;
    assert.ok(playbackWallSeconds >= 11, `Playback ended too soon: ${playbackWallSeconds}s`);
    await compare(lesson.tryIt[0].values, .025);
    await page.locator('[data-result]').click();
    await compare(lesson.tryIt[0].values, .025);
    await shot('completed-result');
    // Observe reset synchronously after the host's real click handler. A later
    // Playwright pause click can take several frames and is not a fixed time gate.
    await armReplayCapture();
    await page.locator('[data-play]').click();
    await frames();
    await page.locator('[data-play]').click();
    const replayStart = await takeReplayCapture();
    for (const [label, expected] of Object.entries(crashSensorBrowserReference(lesson.tryIt[0].values, 0).expected)) {
      near(numeric(replayStart[label]), expected,crashSensorReadingTolerance(label));
    }
    near(numeric(replayStart['Conditioned voltage']), 0);
    assert.equal(replayStart['Retained event'], 'Not recorded');
    assert.equal(replayStart['First threshold crossing'], 'Not yet');
    const replay = await read(), replayTime = numeric(replay['Observation time']);
    assert.ok(replayTime > 0 && replayTime < 25, `Replay did not advance within a fresh trial: ${replayTime} ms`);
    await compare(lesson.tryIt[0].values, replayTime / 1000, .5e-6);
    await frames();
    assert.deepEqual(await read(), replay);
    for (const [key, next] of Object.entries({deceleration: -10, pulseDuration: .008, damping: 1, supply: 0})) {
      await inspect(6);
      await setValue(key, next);
      near(numeric((await read())['Observation time']), 0);
    }
    await page.getByRole('button', {name: 'Reset experiment', exact: true}).click();
    await assertChipFocus();
    await compare(lesson.tryIt[0].values, 0);
    for (const key of keys) assert.equal(Number(await control(key).inputValue()), lesson.tryIt[0].values[key]);
    await number('deceleration').focus();
    await page.keyboard.press('ArrowDown');
    assert.equal(Number(await control('deceleration').inputValue()), 10);
    near(numeric((await read())['Observation time']), 0);
    await number('deceleration').fill('14');
    await number('deceleration').blur();
    assert.equal(Number(await control('deceleration').inputValue()), 10);
    assert.equal(Number(await number('deceleration').inputValue()), 10);
    await number('deceleration').fill('35');
    await number('deceleration').blur();
    assert.equal(Number(await control('deceleration').inputValue()), 20);
    assert.equal(Number(await number('deceleration').inputValue()), 20);
    await preset(0);
    await inspect(3);
    const held = await read();
    for (const [name, part] of inspections) {
      await page.getByRole('button', {name, exact: true}).click();
      assert.equal(await page.locator('.daily-part-detail h3').textContent(), part);
      assert.deepEqual(await read(), held);
      await shot(name.toLowerCase().replaceAll(' ', '-'));
    }
    await page.locator('[data-isolate]').uncheck();
    await page.locator('[data-labels]').check();
    assert.ok(await page.locator('button[data-label-part]:visible').count() >= 10);
    for (const id of ['chip', 'frame', 'square', 'flexures']) {
      const label = page.locator(`button[data-label-part="${id}"]`);
      await label.click();
      assert.equal(await label.getAttribute('aria-pressed'), 'true');
      assert.deepEqual(await read(), held);
    }
    await shot('labels');
    await page.locator('[data-labels]').uncheck();
    await page.getByRole('checkbox', {name: 'Isolate selected part', exact: true}).check();
    assert.deepEqual(await read(), held);
    await shot('isolated-flexures');
    await page.getByRole('checkbox', {name: 'Isolate selected part', exact: true}).uncheck();
    await page.getByRole('button', {name: 'Restart experiment', exact: true}).click();
    await compare(lesson.tryIt[0].values, 0);
    await preset(9);
    await inspect(3);
    const unpowered = await read();
    await page.getByRole('button', {name: 'Inspect the signal record', exact: true}).click();
    assert.deepEqual(await read(), unpowered);
    await shot('unpowered-signal');
    await inspect(6);
    await armReplayCapture();
    await page.locator('[data-play]').click();
    await frames();
    await page.locator('[data-play]').click();
    const offReplayStart = await takeReplayCapture();
    for (const [label, expected] of Object.entries(crashSensorBrowserReference(lesson.tryIt[9].values, 0).expected)) {
      near(numeric(offReplayStart[label]), expected,crashSensorReadingTolerance(label));
    }
    assert.match(offReplayStart['Conditioned voltage'], /unavailable/i);
    assert.match(offReplayStart['Retained event'], /unavailable/i);
    const offReplay = await read(), offReplayTime = numeric(offReplay['Observation time']);
    assert.ok(offReplayTime > 0 && offReplayTime < 25, `Unpowered replay did not advance within a fresh trial: ${offReplayTime} ms`);
    await compare(lesson.tryIt[9].values, offReplayTime / 1000, .5e-6);
    await frames();
    assert.deepEqual(await read(), offReplay);
    assert.equal(await page.locator('.daily-quiz > p').first().textContent(), lesson.quiz.question);
    assert.match(lesson.quiz.question, /pulse/i);
    assert.match(lesson.quiz.question, /end|finish|zero/i);
    await page.getByRole('button', {name: lesson.quiz.options[lesson.quiz.answer], exact: true}).click();
    await page.getByText(/That’s right/).waitFor();
    await page.setViewportSize({width: 390, height: 844});
    const phoneTrials=[];
    for (let i=0;i<tuples.length;i++) {
      await preset(i);
      const phoneRows=[];
      for(const [j,time] of stageTimes(lesson.tryIt[i].values.pulseDuration).entries()){await inspect(j);phoneRows.push(await compare(lesson.tryIt[i].values,time));}
      phoneTrials.push(phoneRows);
      await inspect(2);
      await compare(lesson.tryIt[i].values, .75 * lesson.tryIt[i].values.pulseDuration);
      await shot(`phone-${i}-late-pulse`);
      for (const name of ['Inspect the chip', 'Inspect flexure bending', 'Inspect the motion records']) {
        const before = await read();
        await page.getByRole('button', {name, exact: true}).click();
        assert.deepEqual(await read(), before);
        await page.getByRole('checkbox', {name: 'Isolate selected part', exact: true}).check();
        assert.deepEqual(await read(), before);
        await shot(`phone-${i}-${name.toLowerCase().replaceAll(' ', '-')}`);
        await page.getByRole('checkbox', {name: 'Isolate selected part', exact: true}).uncheck();
      }
      await inspect(3);
      await compare(lesson.tryIt[i].values, lesson.tryIt[i].values.pulseDuration);
      if (i === 0) {
        assert.equal((await read())['Current comparison'], 'Below threshold');
        assert.equal((await read())['Retained event'], 'Recorded');
        await shot('phone-default-retained-event');
      }
      if ([5, 8].includes(i)) {
        await page.locator('[data-step]').click();
        const beforeWindow = await compare(lesson.tryIt[i].values, .00125);
        await focusDisplacement(beforeWindow.readings, true);
        await sceneShot(`phone-${i}-early-displacement-1_25ms`);
        await focusDisplacement(beforeWindow.readings, false);
        await sceneShot(`phone-${i}-full-displacement-1_25ms`);
      }
      await inspect(6);
      await compare(lesson.tryIt[i].values, .025);
      if (i === 8) {
        const late = await read();
        await focusDisplacement(late, true);
        await sceneShot('phone-early-window-after25ms');
        await focusDisplacement(late, false);
        await sceneShot('phone-full-window-after25ms');
      }
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
      await shot(`phone-${i}-final`);
    }
    await page.getByRole('button', {name: 'Reset experiment', exact: true}).click();
    await assertChipFocus();
    await compare(lesson.tryIt[0].values, 0);
    await shot('phone-reset-chip-focus');
    assert.deepEqual(errors, []);
    const report = {
      passed: true, entryContract, trials, phoneTrials, allControls, mechanicalComparisons, midpointNet, reverseRebound, paused, replayStart, replay, replayTime, offReplayStart, offReplay, playbackWallSeconds, errors,
      cover: {available: false, scope: 'Intentionally open construction; no cover-toggle pass claimed'},
      checks: 'Nested Q0053 catalog route, Microchip canonical component link, Airbag group and direct Crash sensor provider; mechanical lesson/quiz; initial/reset connected chip focus and explicit preset views with isolation. Ten complete presets at seven stages on desktop and phone and all120 settings initial/interior. Reused exact independently validated crashSensorBrowserReference, no duplicated ODE or production sampler import. Dynamic force signs, finite pulse-end motion, critical finite recovery, opposite finite-pad strains, half linear observables and quarter relative energy/base work/damping loss, reversed energy equality, Off mechanical equality, unforced energy decay and continued frame motion. Actual12s playback, causal pause/0.25ms step/replay reset snapshot/result/control normalization. State-preserving angled flexure and mechanical-chart inspections, labels/isolation/keyboard/quiz/390px. Direct early/full displacement actions and full restoration preserve every reading; screenshots capture early/late axes and out-of-window markers but do not alone establish geometry or legibility. Root native and independent geometry gates remain separate.',

    };
    await writeFile(new URL('browser-results.json', evidence), JSON.stringify(report, null, 2) + '\n');
    console.log(JSON.stringify({passed: true, experiments: trials.length+phoneTrials.length, settings: allControls.length, playbackWallSeconds}, null, 2));
    return report;
  } finally {
    await browser.close();
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) await checkCrashSensorProofSquareAndSensingStripsBrowser();

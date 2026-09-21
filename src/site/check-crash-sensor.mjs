import assert from 'node:assert/strict';
import {mkdir, writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {chromium} from 'playwright';
import {crashSensorLesson as lesson} from './crash-sensor-lesson.js';

const keys = ['deceleration', 'pulseDuration', 'damping', 'supply'];
const tuples = [
  [20, .004, .7, 1], [0, .004, .7, 1], [10, .004, .7, 1],
  [20, .001, .7, 1], [20, .008, .7, 1], [20, .001, .25, 1],
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

// Independent literal beam/bridge/filter equations; no production sampler or cache.
// The exported oracle is separately checked against an augmented matrix exponential.
export function crashSensorBrowserReference(values, elapsed) {
  const {deceleration: amplitude, pulseDuration: duration, damping, supply} = values;
  const length = .001, width = 50e-6, thickness = 5e-6, density = 2330;
  const proofMass = density * .001 ** 2 * 40e-6;
  const beamMass = 4 * density * length * width * thickness;
  const mass = proofMass + 13 * beamMass / 35, baseMass = proofMass + beamMass / 2;
  const stiffness = 4 * 160e9 * width * thickness ** 3 / length ** 3;
  const lossCoefficient = 2 * damping * Math.sqrt(stiffness * mass);
  const excitation = 3.3 * supply, threshold = .001, filterTime = .002;
  const acceleration = time => time < duration ? -amplitude * Math.sin(Math.PI * time / duration) ** 2 : 0;
  const electrical = displacement => {
    const strain = .95 * 3 * thickness * displacement / length ** 2;
    const resistances = [1 - 100 * strain, 1 + 100 * strain, 1 + 100 * strain, 1 - 100 * strain].map(v => 1000 * v);
    const [r1, r2, r3, r4] = resistances;
    const left = excitation * r2 / (r1 + r2), right = excitation * r4 / (r3 + r4);
    return {strain, resistances, left, right, voltage: left - right, current: excitation / (r1 + r2) + excitation / (r3 + r4)};
  };
  const derivative = (time, state) => {
    const [displacement, velocity, filtered] = state;
    const forcing = -baseMass * acceleration(time);
    return [
      velocity, (forcing - stiffness * displacement - lossCoefficient * velocity) / mass,
      (electrical(displacement).voltage - filtered) / filterTime,
      forcing * velocity, lossCoefficient * velocity * velocity,
    ];
  };
  const advance = (state, time, dt) => {
    const a = derivative(time, state);
    const b = derivative(time + dt / 2, state.map((v, j) => v + dt * a[j] / 2));
    const c = derivative(time + dt / 2, state.map((v, j) => v + dt * b[j] / 2));
    const d = derivative(time + dt, state.map((v, j) => v + dt * c[j]));
    return state.map((v, j) => v + dt * (a[j] + 2 * b[j] + 2 * c[j] + d[j]) / 6);
  };
  let state = [0, 0, 0, 0, 0], firstCrossing = null;
  for (const [start, finish] of [[0, Math.min(duration, elapsed)], [duration, elapsed]]) {
    if (finish <= start) continue;
    const steps = Math.ceil((finish - start) / .00000025), dt = (finish - start) / steps;
    for (let i = 0; i < steps; i++) {
      const time = start + i * dt, next = advance(state, time, dt);
      if (supply && firstCrossing === null && state[2] < threshold && next[2] >= threshold) {
        let low = 0, high = dt;
        for (let j = 0; j < 32; j++) {
          const middle = (low + high) / 2;
          if (advance(state, time, middle)[2] >= threshold) high = middle;
          else low = middle;
        }
        firstCrossing = time + (low + high) / 2;
      }
      state = next;
    }
  }
  const [relative, velocity, filtered, baseWork, dampingLoss] = state;
  const bridge = electrical(relative), frequency = 2 * Math.PI / duration;
  const frameVelocity = elapsed <= duration
    ? -amplitude * elapsed / 2 + amplitude * Math.sin(frequency * elapsed) / (2 * frequency)
    : -amplitude * duration / 2;
  const frameDisplacement = elapsed <= duration
    ? -amplitude * elapsed ** 2 / 4 + amplitude * (1 - Math.cos(frequency * elapsed)) / (2 * frequency ** 2)
    : -amplitude * duration * elapsed / 2 + amplitude * duration ** 2 / 4;
  const mechanicalEnergy = .5 * mass * velocity ** 2 + .5 * stiffness * relative ** 2;
  return {
    relative, velocity, filtered, firstCrossing, bridge, baseWork, dampingLoss, mechanicalEnergy,
    comparison: Boolean(supply && filtered >= threshold), latched: firstCrossing !== null,
    expected: {
      'Frame acceleration': acceleration(elapsed), 'Frame velocity change': frameVelocity,
      'Frame displacement change': frameDisplacement * 1000,
      'Square relative displacement': relative * 1e6, 'Square relative velocity': velocity * 1000,
      'R1 / R4 mean strain': -bridge.strain * 1e6, 'R2 / R3 mean strain': bridge.strain * 1e6,
      ...Object.fromEntries(bridge.resistances.map((value, i) => [`R${i + 1} resistance`, value])),
      'Bridge supply voltage': excitation, 'Left midpoint voltage': bridge.left,
      'Right midpoint voltage': bridge.right, 'Bridge differential voltage': bridge.voltage * 1000,
      'Supply current': bridge.current * 1000, 'Demonstration threshold': 1,
      'Natural frequency': Math.sqrt(stiffness / mass) / (2 * Math.PI),
      'Restoring force': -stiffness * relative * 1e6, 'Damping force': -lossCoefficient * velocity * 1e6,
      'Base forcing': -baseMass * acceleration(elapsed) * 1e6,
      'Relative mechanical energy': mechanicalEnergy * 1e12, 'Base forcing work': baseWork * 1e12,
      'Damping loss': dampingLoss * 1e12, 'Energy balance error': (mechanicalEnergy + dampingLoss - baseWork) * 1e12,
      'Observation time': elapsed * 1000, 'Recording duration': 25, 'Observation progress': elapsed / .025 * 100,
    },
  };
}

// Half a displayed unit plus floating-point slack; physical oracle tolerances remain unchanged.
export const crashSensorReadingTolerance=label=>label==='Observation progress'||label==='Natural frequency'?.0500001:label==='Bridge supply voltage'?.0050001:label==='Left midpoint voltage'||label==='Right midpoint voltage'?.0000501:.0005001;

export async function checkCrashSensorBrowser() {
  const evidence = new URL('../../'+(process.env.EVIDENCE_DIR||'documentation/audit/evidence/crash-sensor/')+'/', import.meta.url);
  await mkdir(evidence, {recursive: true});
  const browser = await chromium.launch({headless: true});
  const page = await browser.newPage({viewport: {width: 1440, height: 1000}}), errors = [];
  const reports=[];let viewportWidth=1440;
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
  const shot = async name => {await page.mouse.move(0,0);await page.locator('canvas').evaluate(c=>c.scrollIntoView({block:'start',behavior:'instant'}));await page.waitForTimeout(150);return page.screenshot({path:new URL(`browser-${name}-${viewportWidth}.png`,evidence).pathname,clip:await page.locator('canvas').boundingBox()});};
  const sceneShot=shot;
  const inspect = async index => {const selected=await page.locator('.daily-part-path [data-parent]').last().getAttribute('data-parent');await page.getByRole('button',{name:stageLabels[index],exact:true}).click();assert.equal(await page.locator('.daily-part-path [data-parent]').last().getAttribute('data-parent'),selected,'Time stage retains inspection');};
  const setValue = async (key, value) => {
    if (key === 'deceleration') await number(key).fill(String(value));
    else await control(key).selectOption(String(value));
  };
  async function armReplayCapture() {
    await page.locator('[data-play]').evaluate(button => {
      window.crashSensorReplayStart = null;
      button.addEventListener('click', () => {
        window.crashSensorReplayStart = Object.fromEntries([...document.querySelectorAll('.daily-readings > div')]
          .map(node => [node.querySelector('dt')?.textContent, node.querySelector('dd')?.textContent]));
      }, {once: true});
    });
  }
  async function takeReplayCapture() {
    return page.evaluate(() => {
      const value = window.crashSensorReplayStart;
      delete window.crashSensorReplayStart;
      return value;
    });
  }
  async function compare(values, elapsed, timeResolution = 0) {
    const readings = await read(), reference = crashSensorBrowserReference(values, elapsed);
    // Enclose the half-unit rounding of paused milliseconds separately from
    // the displayed precision of each physical reading.
    const endpoints = timeResolution ? [-1, 1].map(sign => crashSensorBrowserReference(values, Math.max(0, elapsed + sign * timeResolution))) : [];
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
    assert.equal(await page.locator('.daily-readings>div').count(),35);assert.equal(await page.locator('.daily-readings>div').filter({has:page.locator('p')}).count(),35);
    assert.match(readings['Drawing scales'], /500/);
    assert.match(readings['Model limit'], /linear|four.beam/i);
    return {values: {...values}, elapsed, readings};
  }
  const renderedPixels=()=>page.evaluate(async()=>{document.querySelector('[data-control="deceleration"]').dispatchEvent(new Event('input',{bubbles:true}));const c=document.querySelector('canvas'),copy=new OffscreenCanvas(c.width,c.height),context=copy.getContext('2d');context.drawImage(c,0,0);const pixels=context.getImageData(0,0,copy.width,copy.height).data;if(!pixels.some((v,i)=>i%4===3&&v>0))throw new Error('Geometry must be rendered');return {width:copy.width,height:copy.height,hash:Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',pixels))).map(v=>v.toString(16).padStart(2,'0')).join('')};});
  async function preset(index) {
    await page.locator('[data-isolate]').uncheck();await page.locator('[data-view="top"]').click();
    await page.getByRole('tab', {name: 'Try it yourself', exact: true}).click();
    await page.getByRole('button', {name: 'Set up this experiment', exact: true}).nth(index).click();
    await page.getByRole('tab', {name: 'Controls', exact: true}).click();
    for (const key of keys) assert.equal(Number(await control(key).inputValue()), lesson.tryIt[index].values[key]);
    await compare(lesson.tryIt[index].values, 0);
    assert.equal(await page.locator('[data-isolate]').isChecked(),true);assert.equal(await page.locator('.daily-part-path [data-parent]').last().getAttribute('data-parent'),lesson.tryIt[index].part);
    await shot('setup-'+index);const expected=await renderedPixels();await page.locator(`[data-view="${lesson.tryIt[index].view}"]`).click();await shot('view-check-'+index);assert.deepEqual(await renderedPixels(),expected,'Preset restores exact rendered view');
  }
  try {
    assert.equal(lesson.tryIt.length, 10);
    for (const [i, tuple] of tuples.entries()) {
      assert.deepEqual(lesson.tryIt[i].values, Object.fromEntries(keys.map((key, j) => [key, tuple[j]])));
      assert.equal(lesson.tryIt[i].reset, true);
      assert.equal(lesson.tryIt[i].part,['chip','bridge','signal-record','signal-record','signal-record','chip','displacement-record','signal-record','signal-record','chip'][i]);
      assert.equal(lesson.tryIt[i].isolate, true);
    }
    for(const width of [1440,390]){viewportWidth=width;await page.goto('about:blank');await page.setViewportSize({width,height:width===390?844:1000});
    await page.goto(`${process.env.SITE_URL || 'http://127.0.0.1:4177/'}#machine/crash-sensor`);
    await page.getByRole('heading', {name: 'Crash sensor', exact: true}).waitFor();
    assert.equal(await page.locator('[data-control]').count(), 4);
    for (const key of ['pulseDuration', 'damping', 'supply']) assert.equal(await control(key).evaluate(node => node.tagName), 'SELECT');
    assert.equal(await page.getByRole('checkbox', {name: 'Look inside', exact: true}).count(), 0);
    assert.equal(await page.locator('[data-result]').isDisabled(), true);
    assert.equal(await page.locator('.daily-part-path [data-parent]').last().getAttribute('data-parent'),'chip');assert.equal(await page.locator('[data-isolate]').isChecked(),true);
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
    assert.ok(value(0, 2, 'Conditioned voltage') > 1 && value(0, 3, 'Conditioned voltage') < 1);
    assert.equal(trials[0][2].readings['Current comparison'], 'Above threshold');
    assert.equal(trials[0][3].readings['Current comparison'], 'Below threshold');
    assert.equal(trials[0][3].readings['Retained event'], 'Recorded');
    near(value(0, 3, 'First threshold crossing'), 2.46880887051, .0005001);
    near(value(4, 6, 'First threshold crossing'), 3.57457306716, .0005001);
    near(value(1, 6, 'Left midpoint voltage'), 1.65);
    near(value(1, 6, 'Supply current'), 3.3);
    near(value(4, 6, 'Frame displacement change'), -1.68);
    near(value(4, 6, 'Frame velocity change'), -.08);
    assert.ok(crashSensorBrowserReference(lesson.tryIt[0].values,.025).filtered>0,'Physical filter residual remains positive');
    assert.equal(value(0,6,'Conditioned voltage'),0,'Final tiny residual rounds to displayed zero');
    for (let j = 0; j < stageLabels.length; j++) {
      for (const label of ['Square relative displacement', 'Square relative velocity', 'Frame displacement change', 'R1 resistance', 'R2 resistance', 'Base forcing work', 'Damping loss']) {
        near(value(0, j, label), value(9, j, label), .0010001);
      }
      for (const label of ['Square relative displacement', 'Square relative velocity', 'Bridge differential voltage', 'Conditioned voltage']) {
        near(value(2, j, label) * 2, value(0, j, label), .0015001);
        near(value(7, j, label), -value(0, j, label), .0010001);
      }
      // Preserve the merged microchip lesson's electrical comparisons.
      for (const resistor of ['R1 resistance', 'R2 resistance', 'R3 resistance', 'R4 resistance']) {
        near(2 * (value(2, j, resistor) - 1000), value(0, j, resistor) - 1000, .0015001);
        near(value(7, j, resistor) - 1000, -(value(0, j, resistor) - 1000), .0010001);
        near(value(9, j, resistor), value(0, j, resistor), .0010001);
      }
      for (const i of [0, 1, 2, 7]) {
        near((value(i, j, 'Left midpoint voltage') + value(i, j, 'Right midpoint voltage')) / 2, 1.65);
        near(value(i, j, 'Supply current'), 3.3);
      }
      near(value(9, j, 'Supply current'), 0);
      near(value(9, j, 'Bridge differential voltage'), 0);
      assert.equal(trials[7][j].readings['Retained event'], 'Not recorded');
    }
    await preset(8);
    await inspect(3);
    await page.locator('[data-step]').click();
    const reverseRebound = await compare(lesson.tryIt[8].values, .00125);
    assert.ok(numeric(reverseRebound.readings['Square relative displacement']) > 0);
    assert.ok(numeric(reverseRebound.readings['Bridge differential voltage']) > 1);
    assert.ok(numeric(reverseRebound.readings['Conditioned voltage']) < 0);
    assert.equal(reverseRebound.readings['Retained event'], 'Not recorded');
    await shot('reverse-rebound');
    await page.getByRole('button', {name: 'Inspect early signal (0–5 ms)', exact: true}).click();
    assert.equal(await page.locator('.daily-part-detail h3').textContent(), 'Bridge and conditioned signal');
    assert.deepEqual(await read(), reverseRebound.readings);
    await sceneShot('early-window-reverse-1_25ms');
    await page.getByRole('button', {name: 'Inspect the signal record', exact: true}).click();
    assert.deepEqual(await read(), reverseRebound.readings);
    await sceneShot('full-window-reverse-1_25ms');
    await inspect(6);
    const lateWindowState = await read();
    await page.getByRole('button', {name: 'Inspect early signal (0–5 ms)', exact: true}).click();
    assert.deepEqual(await read(), lateWindowState);
    await sceneShot('early-window-after-end-no-current-marker');
    await page.getByRole('button', {name: 'Reset experiment', exact: true}).click();
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
    for (const id of ['resistor-1', 'resistor-2', 'conditioner', 'decision']) {
      const label = page.locator(`button[data-label-part="${id}"]`);
      await label.click();
      assert.equal(await label.getAttribute('aria-pressed'), 'true');
      assert.deepEqual(await read(), held);
    }
    await shot('labels');
    await page.locator('[data-labels]').uncheck();
    await page.getByRole('checkbox', {name: 'Isolate selected part', exact: true}).check();
    assert.deepEqual(await read(), held);
    await shot('isolated-decision');
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
    await page.getByRole('button', {name: lesson.quiz.options[lesson.quiz.answer], exact: true}).click();
    await page.getByText(/That’s right/).waitFor();
    await page.setViewportSize({width: 390, height: 844});
    for (const i of [0, 1, 3, 4, 8, 9]) {
      await preset(i);
      await inspect(2);
      await compare(lesson.tryIt[i].values, .75 * lesson.tryIt[i].values.pulseDuration);
      await shot(`phone-${i}-late-pulse`);
      for (const name of ['Inspect flexure bending', 'Inspect the equivalent bridge', 'Inspect the signal record']) {
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
      if (i === 8) {
        await page.locator('[data-step]').click();
        const beforeWindow = await compare(lesson.tryIt[i].values, .00125);
        await page.getByRole('button', {name: 'Inspect early signal (0–5 ms)', exact: true}).click();
        assert.deepEqual(await read(), beforeWindow.readings);
        await sceneShot('phone-early-window-reverse-1_25ms');
        await page.getByRole('button', {name: 'Inspect the signal record', exact: true}).click();
        assert.deepEqual(await read(), beforeWindow.readings);
        await sceneShot('phone-full-window-reverse-1_25ms');
      }
      await inspect(6);
      await compare(lesson.tryIt[i].values, .025);
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
      await shot(`phone-${i}-final`);
    }
    assert.deepEqual(errors, []);
    const report = {
      passed: true, trials, allControls, reverseRebound, paused, replayStart, replay, replayTime, offReplayStart, offReplay, playbackWallSeconds, errors,
      cover: {available: false, scope: 'Intentionally open construction; no cover-toggle pass claimed'},
      checks: 'Ten complete presets at seven stages; all120 settings initial/interior; independent literal RK4 at0.25us including work/loss and refined first crossing; finite-pad bridge and node currents; default3ms above versus4ms below with retained event; reverse raw rebound versus filtered sign; Off unchanged mechanics and unavailable measurements; finite frame travel and residuals; actual12s playback, pause,0.25ms step, fresh replay/reset/control changes/normalization; state-preserving inspections/labels/isolation, quiz and390px layout. Early0–5ms and full25ms view actions preserve every reading at1.25ms; captured axes/current-marker/reset/preset scenes require separate visual inspection and focused geometry verification. Screenshots do not by themselves certify visual legibility or physical geometry.',
    };
    await writeFile(new URL('browser-results-'+width+'.json', evidence), JSON.stringify(report, null, 2) + '\n');
    console.log(JSON.stringify({passed: true, experiments: trials.length, settings: allControls.length, playbackWallSeconds}, null, 2));
    reports.push({width,...report});
    }
    await writeFile(new URL('browser.json',evidence),JSON.stringify({base:process.env.SITE_URL,cases:reports.flatMap(r=>r.trials.map((_,index)=>({width:r.width,index}))),settings:reports.reduce((n,r)=>n+r.allControls.length,0),errors},null,2)+'\n');return reports;
  } finally {
    await browser.close();
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) await checkCrashSensorBrowser();

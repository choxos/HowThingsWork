import assert from 'node:assert/strict';
import {mkdir, writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {chromium} from 'playwright';
import {autopilotLesson as lesson} from './autopilot-lesson.js';

const degrees = 180 / Math.PI;
const times = [0, .15, 1, 3, 10, 20, 30];
const tuples = [
  [10, 20, 0, 1], [-10, -20, 0, 1], [10, 0, 0, 1], [0, 20, 0, 1],
  [0, 0, 0, 1], [10, 20, 0, 0], [0, 0, 5, 1], [0, 0, -5, 1],
  [10, 20, 5, 1], [5, 10, 0, 1],
];
const keys = ['headingError', 'heightError', 'crosswind', 'feedback'];
const inspections = [
  ['Inspect the aircraft and surfaces', 'Aircraft and control surfaces'],
  ['Inspect the heading loop', 'Heading feedback loop'],
  ['Inspect the height loop', 'Height feedback loop'],
  ['Inspect the ground track', 'Ground track and original north line'],
  ['Inspect response records', 'Retained response records'],
];

// Literal reference equations, independent of the production sampler/controller/cache.
// Exporting this oracle lets a separate audit compare it with source references.
export function autopilotBrowserReference(values, elapsed) {
  const {headingError, heightError, crosswind, feedback} = values;
  let state = [headingError / degrees, 0, 0, 0, heightError, 0, 0, 0, 0, 0, 0];
  const derivative = y => {
    const [heading, bank, bankRate, aileron, height, pitch, pitchRate, elevator, path] = y;
    const aileronCommand = feedback ? -heading - bank - .8 * bankRate : 0;
    const elevatorCommand = feedback ? -.002 * height - pitch - .8 * pitchRate : 0;
    return [
      (9.80665 / 50) * Math.tan(bank), bankRate, 4 * aileron - 2 * bankRate,
      (aileronCommand - aileron) / .15, 50 * Math.sin(path), pitchRate,
      4 * elevator - 2 * pitchRate, (elevatorCommand - elevator) / .15,
      (pitch - path) / 2, 50 * Math.cos(path) * Math.sin(heading) + crosswind,
      50 * Math.cos(path) * Math.cos(heading),
    ];
  };
  const count = Math.ceil(elapsed * 2000), dt = count ? elapsed / count : 0;
  for (let i = 0; i < count; i++) {
    const a = derivative(state);
    const b = derivative(state.map((v, j) => v + dt * a[j] / 2));
    const c = derivative(state.map((v, j) => v + dt * b[j] / 2));
    const d = derivative(state.map((v, j) => v + dt * c[j]));
    state = state.map((v, j) => v + dt * (a[j] + 2 * b[j] + 2 * c[j] + d[j]) / 6);
  }
  const [heading, bank, bankRate, aileron, height, pitch, pitchRate, elevator, path, east, north] = state;
  const bankCommand = feedback ? -heading : null;
  const pitchCommand = feedback ? -.002 * height : null;
  const aileronCommand = feedback ? bankCommand - bank - .8 * bankRate : 0;
  const elevatorCommand = feedback ? pitchCommand - pitch - .8 * pitchRate : 0;
  const eastVelocity = 50 * Math.cos(path) * Math.sin(heading) + crosswind;
  const northVelocity = 50 * Math.cos(path) * Math.cos(heading);
  return {
    state, bankCommand, pitchCommand,
    expected: {
      'Heading error': heading * degrees, 'Height error': height,
      'Bank angle': bank * degrees, 'Bank angle rate': bankRate * degrees,
      'Pitch relative to trim': pitch * degrees, 'Pitch angle rate': pitchRate * degrees,
      'Flight-path angle': path * degrees, 'Angle-of-attack perturbation': (pitch - path) * degrees,
      'Commanded aileron': aileronCommand * degrees, 'Actual aileron': aileron * degrees,
      'Aileron position error': (aileronCommand - aileron) * degrees,
      'Commanded elevator': elevatorCommand * degrees, 'Actual elevator': elevator * degrees,
      'Elevator position error': (elevatorCommand - elevator) * degrees,
      'Heading rate': (9.80665 / 50) * Math.tan(bank) * degrees,
      'Vertical speed': 50 * Math.sin(path), 'Eastward wind': crosswind,
      'East ground velocity': eastVelocity, 'North ground velocity': northVelocity,
      'East position': east, 'North position': north,
      'Ground track': Math.atan2(eastVelocity, northVelocity) * degrees,
      'Observation time': elapsed, 'Observation progress': elapsed / 30 * 100,
    },
  };
}

export async function checkAutopilotBrowser() {
  const evidence = new URL('../../'+(process.env.EVIDENCE_DIR || 'documentation/audit/evidence/autopilot')+'/', import.meta.url);
  await mkdir(evidence, {recursive: true});
  const browser = await chromium.launch({headless: true});
  const page = await browser.newPage({viewport: {width: 1440, height: 1000}});
  const errors = [];
  const reports=[];let viewportWidth=1440;
  page.setDefaultTimeout(10000);
  page.on('pageerror', error => errors.push(error.message));
  const control = key => page.locator(`[data-control="${key}"]`);
  const number = key => page.locator(`[data-number="${key}"]`);
  const read = () => page.locator('.daily-readings > div').evaluateAll(nodes => Object.fromEntries(
    nodes.map(node => [node.querySelector('dt')?.textContent, node.querySelector('dd')?.textContent]),
  ));
  const near = (actual, expected, tolerance = .000006) => assert.ok(
    Number.isFinite(actual) && Math.abs(actual - expected) <= tolerance,
    `${actual} differs from ${expected}, tolerance ${tolerance}`,
  );
  const numeric=text=>parseFloat(text.replaceAll(',',''));
  const displayNear=(actual,expected)=>near(actual,expected,expected!==0&&Math.abs(expected)<.005?Math.max(1e-9,.5*10**(Math.floor(Math.log10(Math.abs(expected)))-1)):.005000001);
  const frames = () => page.evaluate(() => new Promise(resolve => requestAnimationFrame(
    () => requestAnimationFrame(() => requestAnimationFrame(resolve)),
  )));
  const shot = async name => {await page.mouse.move(0,0);await page.locator('canvas').evaluate(c=>c.scrollIntoView({block:'start',behavior:'instant'}));await page.waitForTimeout(150);return page.screenshot({path:new URL(`browser-${name}-${viewportWidth}.png`,evidence).pathname,clip:await page.locator('canvas').boundingBox()});};
  const inspect = async index => {await page.getByRole('button',{name:'Restart selected autopilot observation',exact:true}).click();for(let i=0;i<index;i++)await page.getByRole('button',{name:'Next observation stage',exact:true}).click();};
  const renderedPixels=()=>page.evaluate(async()=>{document.querySelector('[data-control="headingError"]').dispatchEvent(new Event('input',{bubbles:true}));const source=document.querySelector('canvas'),copy=new OffscreenCanvas(source.width,source.height),context=copy.getContext('2d');context.drawImage(source,0,0);const pixels=context.getImageData(0,0,copy.width,copy.height).data;if(!pixels.some((value,i)=>i%4===3&&value>0))throw new Error('model geometry must be rendered');return {width:copy.width,height:copy.height,sha256:Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',pixels))).map(v=>v.toString(16).padStart(2,'0')).join('')};});
  const setValue = async (key, value) => {
    if (key === 'feedback') await control(key).selectOption(String(value));
    else await number(key).fill(String(value));
  };
  async function compare(values, elapsed) {
    const readings = await read(), reference = autopilotBrowserReference(values, elapsed);
    assert.equal(readings['Automatic correction'], values.feedback ? 'On' : 'Off');
    for (const [label, expected] of Object.entries(reference.expected)) {
      assert.ok(Object.hasOwn(readings, label), `Missing ${label}`);
      if(label==='Observation progress')near(numeric(readings[label]),expected,.051);else displayNear(numeric(readings[label]),expected);
    }
    for (const [label, expected] of [['Commanded bank', reference.bankCommand], ['Commanded pitch', reference.pitchCommand]]) {
      if (expected === null) assert.match(readings[label], /inactive/i);
      else displayNear(numeric(readings[label]), expected * degrees);
    }
    assert.match(readings['View scale'], /co-moving/i);
    assert.match(readings['Model limit'], /trim/i);
    assert.equal(Object.keys(readings).length,29);assert.equal(await page.locator('.daily-readings>div>p').count(),29);
    for(const removed of ['Airspeed','Recording duration','Measured heading','Measured relative height'])assert.equal(Object.hasOwn(readings,removed),false);
    return {values: {...values}, elapsed, readings};
  }
  async function preset(index) {
    await page.locator('[data-isolate]').uncheck();await page.locator('[data-view="top"]').click();
    await page.getByRole('tab', {name: 'Try it yourself', exact: true}).click();
    await page.getByRole('button', {name: 'Set up this experiment', exact: true}).nth(index).click();
    await page.getByRole('tab', {name: 'Controls', exact: true}).click();
    for (const key of keys) assert.equal(Number(await control(key).inputValue()), lesson.tryIt[index].values[key]);
    await compare(lesson.tryIt[index].values, 0);
    assert.equal(await page.locator('[data-isolate]').isChecked(),true);assert.equal(await page.locator('.daily-part-path [data-parent]').last().getAttribute('data-parent'),lesson.tryIt[index].part);
    await shot('setup-'+index);const pixels=await renderedPixels();await page.locator(`[data-view="${lesson.tryIt[index].view}"]`).click();await shot('view-check-'+index);assert.deepEqual(await renderedPixels(),pixels,'preset restores its exact rendered view');
  }
  try {
    assert.equal(lesson.tryIt.length, 10);
    for (const [i, tuple] of tuples.entries()) {
      assert.deepEqual(lesson.tryIt[i].values, Object.fromEntries(keys.map((key, j) => [key, tuple[j]])));
      assert.equal(lesson.tryIt[i].reset, true);
      assert.equal(lesson.tryIt[i].part, [5,6,7,8].includes(i)?'ground-track':'aircraft');
      assert.equal(lesson.tryIt[i].isolate, true);
    }
    for(const width of [1440,390]){viewportWidth=width;await page.goto('about:blank');await page.setViewportSize({width,height:width===390?844:1000});
    await page.goto(`${process.env.SITE_URL || 'http://127.0.0.1:4177/'}#machine/autopilot`);
    await page.getByRole('heading', {name: 'Autopilot', exact: true}).waitFor();
    assert.equal(await page.locator('[data-control]').count(), 4);
    assert.equal(await control('feedback').evaluate(node => node.tagName), 'SELECT');
    assert.equal(await page.locator('[data-result]').isDisabled(), true);
    assert.equal(await page.locator('[data-isolate]').isChecked(),true);assert.equal(await page.locator('.daily-part-path [data-parent]').last().getAttribute('data-parent'),'aircraft');assert.equal(await page.locator('[data-action]').count(),7);
    await shot('initial');
    const trials = [];
    for (let i = 0; i < tuples.length; i++) {
      await preset(i);
      const rows = [];
      for (const [j, time] of times.entries()) {
        await inspect(j);
        rows.push(await compare(lesson.tryIt[i].values, time));
        if ([0, 2, 3, 5, 6, 8].includes(i) && [0, 1, 3, 6].includes(j)) await shot(`preset-${i}-stage-${j}`);
      }
      trials.push(rows);
      console.log(`PASS experiment ${i + 1}: ${lesson.tryIt[i].title}`);
    }
    const value = (i, j, label) => numeric(trials[i][j].readings[label]);
    near(value(0, 0, 'Commanded aileron'), -10);
    near(value(0, 0, 'Actual aileron'), 0);
    displayNear(value(0, 3, 'Actual aileron'), .530542);
    assert.ok(value(0, 3, 'Bank angle') < 0 && value(0, 3, 'Heading error') > 0);
    assert.ok(value(0, 3, 'Bank angle rate') > 0 && value(0, 3, 'Heading rate') < 0);
    assert.ok(Math.abs(value(3, 4, 'Pitch relative to trim') - value(3, 4, 'Flight-path angle')) > .2);
    displayNear(value(0, 6, 'Height error'), .109792591);
    displayNear(value(0, 6, 'Heading error'), .001718099);assert.ok(value(0,6,'Heading error')>0,'finite residual remains visible');
    assert.ok(value(0, 6, 'Vertical speed') <= -.03 && value(0, 6, 'North ground velocity') > 49);
    near(value(4, 6, 'North position'), 1500);
    near(value(5, 6, 'Heading error'), 10);
    near(value(5, 6, 'Height error'), 20);
    displayNear(value(6, 6, 'Ground track'), 5.710593);
    near(value(6, 6, 'East position'), 150);
    near(value(7, 6, 'East position'), -150);
    for (const [j, time] of times.entries()) {
      near(value(8, j, 'East position') - value(0, j, 'East position'), 5 * time, .010000001);
      for (const label of ['Heading error', 'Height error', 'Bank angle', 'Actual aileron', 'Actual elevator', 'North position']) {
        near(value(8, j, label), value(0, j, label), .000012);
      }
    }
    const allControls = [];
    for (const headingError of [-10, -5, 0, 5, 10]) for (const heightError of [-20, -10, 0, 10, 20]) {
      for (const crosswind of [-5, 0, 5]) for (const feedback of [0, 1]) {
        const values = {headingError, heightError, crosswind, feedback};
        for (const key of keys) await setValue(key, values[key]);
        await compare(values, 0);
        await inspect(3);
        allControls.push(await compare(values, 3));
        if (allControls.length % 30 === 0) console.log(`PASS control settings ${allControls.length}/150`);
      }
    }
    await preset(0);
    await page.locator('[data-step]').click();
    await compare(lesson.tryIt[0].values, .3);
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
    assert.ok(playbackWallSeconds >= 14, `Playback ended too soon: ${playbackWallSeconds}s`);
    await compare(lesson.tryIt[0].values, 30);
    await page.locator('[data-result]').click();
    await compare(lesson.tryIt[0].values, 30);
    await shot('completed-result');
    await page.locator('[data-play]').click();
    await frames();
    await page.locator('[data-play]').click();
    const replayTime = parseFloat((await read())['Observation time']);
    assert.ok(replayTime > 0 && replayTime < 2);
    for (const [key, next] of Object.entries({headingError: -5, heightError: -10, crosswind: 5, feedback: 0})) {
      await inspect(6);
      await setValue(key, next);
      near(parseFloat((await read())['Observation time']), 0);
    }
    await page.getByRole('button', {name: 'Reset experiment', exact: true}).click();
    await compare(lesson.tryIt[0].values, 0);
    for (const key of keys) assert.equal(Number(await control(key).inputValue()), lesson.tryIt[0].values[key]);
    await number('headingError').focus();
    await page.keyboard.press('ArrowDown');
    assert.equal(Number(await control('headingError').inputValue()), 5);
    near(parseFloat((await read())['Observation time']), 0);
    await number('headingError').fill('7');
    await number('headingError').blur();
    assert.equal(Number(await control('headingError').inputValue()), 5);
    assert.equal(Number(await number('headingError').inputValue()), 5);
    await number('heightError').fill('25');
    await number('heightError').blur();
    assert.equal(Number(await control('heightError').inputValue()), 20);
    assert.equal(Number(await number('heightError').inputValue()), 20);
    await preset(8);
    await inspect(4);
    const held = await read();
    for (const [name, part] of inspections) {
      await page.getByRole('button', {name, exact: true}).click();
      assert.equal(await page.locator('.daily-part-detail h3').textContent(), part);
      assert.deepEqual(await read(), held);
      await shot(name.toLowerCase().replaceAll(' ', '-'));
    }
    for(const id of ['heading-record','height-record','aileron-record','elevator-record']){
      await page.locator('[data-isolate]').uncheck();await page.locator('[data-labels]').check();await page.locator(`button[data-label-part="${id}"]`).click();await page.locator('[data-labels]').uncheck();await page.locator('[data-isolate]').check();await page.locator('[data-view="front"]').click();assert.deepEqual(await read(),held);await shot(id);
    }
    await page.getByRole('button', {name: 'Inspect the aircraft and surfaces', exact: true}).click();
    const cover = page.getByRole('checkbox', {name: 'Look inside', exact: true});
    const coverAvailable = await cover.count() === 1;
    if (coverAvailable) {
      await cover.uncheck();
      assert.deepEqual(await read(), held);
      await shot('covered-aircraft');
      await cover.check();
      assert.deepEqual(await read(), held);
    } else {
      assert.equal(await cover.count(), 0);
      await shot('exposed-aircraft');
    }
    await page.locator('[data-isolate]').uncheck();
    await page.locator('[data-labels]').check();
    assert.ok(await page.locator('button[data-label-part]:visible').count() > 5);
    await shot('labels');
    for (const id of ['sensors', 'right-servo', 'elevator-servo']) {
      await page.locator(`button[data-label-part="${id}"]`).click();
      assert.equal(await page.locator(`button[data-label-part="${id}"]`).getAttribute('aria-pressed'), 'true');
      assert.deepEqual(await read(), held);
    }
    await page.locator('[data-labels]').uncheck();
    await page.getByRole('checkbox', {name: 'Isolate selected part', exact: true}).check();
    assert.deepEqual(await read(), held);
    await shot('isolated-servo');
    await page.getByRole('checkbox', {name: 'Isolate selected part', exact: true}).uncheck();
    await page.getByRole('button', {name: 'Restart selected autopilot observation', exact: true}).click();
    await compare(lesson.tryIt[8].values, 0);
    await preset(5);
    await inspect(6);
    await page.locator('[data-play]').click();
    await frames();
    await page.locator('[data-play]').click();
    const offReplay = await read(), offReplayTime = parseFloat(offReplay['Observation time']);
    assert.ok(offReplayTime > 0 && offReplayTime < 2);
    assert.equal(offReplay['Automatic correction'], 'Off');
    near(parseFloat(offReplay['Heading error']), 10);
    near(parseFloat(offReplay['Height error']), 20);
    near(parseFloat(offReplay['Actual aileron']), 0);
    near(parseFloat(offReplay['Actual elevator']), 0);
    assert.ok(parseFloat(offReplay['North position']) > 0);
    await page.getByRole('button', {name: lesson.quiz.options[lesson.quiz.answer], exact: true}).click();
    await page.getByText(/That’s right/).waitFor();
    await page.setViewportSize({width: 390, height: 844});
    for (const i of [0, 2, 3, 5, 6, 8]) {
      await preset(i);
      await inspect(3);
      await compare(lesson.tryIt[i].values, 3);
      for (const name of ['Inspect the aircraft and surfaces', 'Inspect the ground track', 'Inspect response records']) {
        const before = await read();
        await page.getByRole('button', {name, exact: true}).click();
        assert.deepEqual(await read(), before);
        await shot(`phone-${i}-${name.toLowerCase().replaceAll(' ', '-')}`);
      }
      await inspect(6);
      await compare(lesson.tryIt[i].values, 30);
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
      await shot(`phone-${i}-final`);
    }
    assert.deepEqual(errors, []);
    const report = {
      passed: true, trials, allControls, replayTime, playbackWallSeconds, offReplay, errors,
      cover: {available: coverAvailable, scope: coverAvailable ? 'Visual cover toggle preserves state' : 'Not applicable: intentionally exposed units; no removable cover or cover-toggle pass claimed'},
      checks: 'Ten complete presets at seven stages; all150 settings initial/interior; independent fourfold-refined RK4; measured/command/actual states, lag, finite residuals, heading/track/wind; actual15s play, pause, step, replay, reset, controls and normalization; inspections, labels, isolation, cover, quiz and390px layout.',
    };
    await writeFile(new URL(`browser-results-${width}.json`, evidence), JSON.stringify(report, null, 2) + '\n');reports.push({width,...report});
    console.log(JSON.stringify({passed: true, experiments: trials.length, settings: allControls.length, playbackWallSeconds}, null, 2));
    }
    await writeFile(new URL('browser.json',evidence),JSON.stringify({base:process.env.SITE_URL,cases:reports.flatMap(r=>r.trials.map((_,index)=>({width:r.width,index}))),settings:reports.reduce((n,r)=>n+r.allControls.length,0),errors},null,2)+'\n');return reports;
  } finally {
    await browser.close();
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) await checkAutopilotBrowser();

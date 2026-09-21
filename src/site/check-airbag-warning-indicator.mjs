import assert from 'node:assert/strict';
import {mkdir, writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {chromium} from 'playwright';
import {airbagWarningIndicatorLesson as lesson} from './airbag-warning-indicator-lesson.js';
import {neighborhoodCatalog} from './catalog-data.js';
import catalogParts from './catalog-parts.json' with {type: 'json'};

const keys = ['power', 'report', 'lamp', 'sound'];
const titles = ['Follow normal startup', 'Report a condition from the start', 'Report a condition after startup',
  'Remove the visible startup check', 'Hide a reported condition behind a dark lamp',
  'Report a later condition with a failed lamp', 'Keep the lamp lit after its command ends',
  'Mask a stuck lamp with a continuous command', 'See agreement return without erasing the past',
  'Remove power from the example'];
const tuples = [[1, 0, 0], [1, 1, 0], [1, 2, 0], [1, 0, 1], [1, 1, 1],
  [1, 2, 1], [1, 0, 2], [1, 1, 2], [1, 2, 2], [0, 0, 0]].map(tuple=>[...tuple,0]);
const stageTimes = [0, 3, 6, 7, 8, 9, 12];
const stageLabels = ['Inspect start (0 s)', 'Inspect 3 s', 'Inspect 6 s boundary', 'Inspect 7 s',
  'Inspect 8 s boundary', 'Inspect 9 s', 'Inspect final record (12 s)'];
const optionLabels = {
  power: ['Off', 'On'],
  sound: ['Muted','Sound on'],
  report: ['No imposed report', 'Report present from start', 'Report appears at 8 s'],
  lamp: ['Working output', 'Cannot illuminate', 'Stuck illuminated'],
};

// Independent literal interval table. This checker neither imports a production
// sampler nor requires private source/audit files. Browser readings are checked
// against this literal electrical and timing reference.
export function airbagWarningIndicatorBrowserReference(values, elapsed) {
  const intervals = [
    [[false, true], [false, false], [false, false]],
    [[true, true], [true, true], [true, true]],
    [[false, true], [false, false], [true, true]],
  ];
  if (!values.power) return {phase: 'Unpowered', reported: null, command: null,
    visible: false, startup: null, comparison: 'Unavailable',current:0,resistorPower:0,ledPower:0,branchPower:0,switchClosed:false,missing:null,backup:null,tone:false};
  const interval = elapsed < 6 ? 0 : elapsed < 8 ? 1 : 2;
  const [reported, command] = intervals[values.report][interval];
  const visible = [command, false, true][values.lamp];
  return {phase: interval === 0 ? 'Startup check' : 'Continuing monitoring', reported, command,
    visible, startup: interval === 0, comparison: command === visible ? 'Matches' : 'Differs',
    current:visible?10:0,resistorPower:visible?100:0,ledPower:visible?20:0,branchPower:visible?120:0,
    switchClosed:values.lamp===2||command,missing:command&&!visible,backup:values.lamp===1&&elapsed>=1,
    tone:values.lamp===1&&[1,1.5,2,2.5,3,5,5.5,6,6.5,7,9,9.5,10,10.5,11].some(start=>elapsed>=start&&elapsed<start+.25)};
}

export async function checkAirbagWarningIndicatorBrowser() {
  const evidence = new URL('../../'+(process.env.EVIDENCE_DIR||'documentation/audit/evidence/airbag-warning-indicator/')+'/', import.meta.url);
  await mkdir(evidence, {recursive: true});
  const browser = await chromium.launch({headless: true});
  const page = await browser.newPage({viewport: {width: 1440, height: 1000}}), errors = [];
  page.setDefaultTimeout(10000);
  page.on('pageerror', error => errors.push(error.message));
  const control = key => page.locator(`[data-control="${key}"]`);
  const read = () => page.locator('.daily-readings > div').evaluateAll(nodes => Object.fromEntries(
    nodes.map(node => [node.querySelector('dt')?.textContent, node.querySelector('dd')?.textContent]),
  ));
  const near = (a, b, tolerance = .0050001) => assert.ok(Number.isFinite(a) && Math.abs(a - b) <= tolerance, `${a} differs from ${b}`);
  const frames = () => page.evaluate(() => new Promise(resolve => requestAnimationFrame(
    () => requestAnimationFrame(() => requestAnimationFrame(resolve)),
  )));
  const shot=async name=>{await page.mouse.move(0,0);await page.locator('canvas').evaluate(c=>c.scrollIntoView({block:'start',behavior:'instant'}));await page.waitForTimeout(150);return page.screenshot({path:new URL('browser-'+name+'.png',evidence).pathname,clip:await page.locator('canvas').boundingBox()});};
  const sceneShot=shot;
  const frameMargin=async()=>{const b=await page.evaluate(()=>{document.querySelector('[data-control="power"]').dispatchEvent(new Event('input',{bubbles:true}));const c=document.querySelector('canvas'),copy=new OffscreenCanvas(c.width,c.height),ctx=copy.getContext('2d');ctx.drawImage(c,0,0);const p=ctx.getImageData(0,0,c.width,c.height).data,b={width:c.width,height:c.height,left:c.width,right:0,top:c.height,bottom:0};for(let y=0;y<c.height;y++)for(let x=0;x<c.width;x++)if(p[(y*c.width+x)*4+3]>0){b.left=Math.min(b.left,x);b.right=Math.max(b.right,x);b.top=Math.min(b.top,y);b.bottom=Math.max(b.bottom,y);}return b;});assert.ok(b.right>b.left&&b.bottom>b.top,'actual geometry rendered');assert.ok(Math.min(b.left,b.top,b.width-1-b.right,b.height-1-b.bottom)>=8,'complete focused scene needs margins: '+JSON.stringify(b));return b;};
  const inspect = i => page.getByRole('button', {name: stageLabels[i], exact: true}).click();
  const setValue = (key, value) => control(key).selectOption(String(value));
  const stateFromReadings = readings => ({
    reported: /unavailable/i.test(readings['Reported condition']) ? null : readings['Reported condition'] === 'Present',
    command: /unavailable/i.test(readings['Lamp command']) ? null : readings['Lamp command'] === 'On',
    visible: readings['Visible lamp'] === 'Lit',
    startup: /unavailable/i.test(readings['Initial interval']) ? null : readings['Initial interval'] === 'Active',
    comparison: /unavailable/i.test(readings['Command and lamp']) ? 'Unavailable' : readings['Command and lamp'],
    current:parseFloat(readings['LED branch current']),resistorPower:parseFloat(readings['Resistor dissipation']),ledPower:parseFloat(readings['LED electrical power']),branchPower:parseFloat(readings['LED branch input power']),
    switchClosed:readings['Switch conduction']==='Conducting',
    missing:/unavailable/i.test(readings['Missing requested current'])?null:readings['Missing requested current']==='Yes',
    backup:/unavailable/i.test(readings['Retained backup request'])?null:readings['Retained backup request']==='Recorded',
    tone:readings['Backup tone pulse']==='On',
  });
  function compareReadings(readings, values, elapsed, roundedTime = false) {
    assert.equal(Object.keys(readings).length, 22);
    near(parseFloat(readings['Observation time']), elapsed);
    near(parseFloat(readings['Recording duration']), 12);
    near(parseFloat(readings['Observation progress']), elapsed / 12 * 100, roundedTime?.093:.051);
    assert.equal(readings['Shared power'], optionLabels.power[values.power]);
    assert.equal(readings['Imposed report'], optionLabels.report[values.report]);
    assert.equal(readings['Indicator path'], optionLabels.lamp[values.lamp]);
    assert.ok(readings['Your result']?.length > 0);
    assert.match(readings['Model limit'], /schematic|diagnos|teaching/i);
    const accepted = { 'Reported condition': ['Present', 'None'], 'Lamp command': ['On', 'Off'],
      'Visible lamp': ['Lit', 'Dark'], 'Initial interval': ['Active', 'Finished'], 'Command and lamp': ['Matches', 'Differs'] };
    for (const [label, variants] of Object.entries(accepted)) {
      if (!values.power && label !== 'Visible lamp') assert.match(readings[label], /unavailable/i, label);
      else assert.ok(variants.includes(readings[label]), `${label}: ${readings[label]}`);
    }
    // A paused printed time may round across an exact boundary. Accept a whole
    // consistent state from its half-unit enclosure, never a mix of row values.
    const times = roundedTime ? [elapsed, Math.max(0, elapsed - .005), Math.min(12, elapsed + .005)] : [elapsed];
    const actual = stateFromReadings(readings);
    assert.ok(times.some(time => {
      const {phase, ...expected} = airbagWarningIndicatorBrowserReference(values, time);
      return JSON.stringify(actual) === JSON.stringify(expected);
    }), `State differs at ${elapsed}s: ${JSON.stringify(actual)}`);
    return {values: {...values}, elapsed, readings: {...readings}, state: actual};
  }
  const compare = async (values, elapsed, roundedTime = false) => compareReadings(await read(), values, elapsed, roundedTime);
  async function assertSystemFocus(part='circuit') {
    assert.equal(await page.locator('.daily-part-path button[data-parent]').last().getAttribute('data-parent'), part);
    assert.equal(await page.getByRole('checkbox', {name: 'Isolate selected part', exact: true}).isChecked(), true);
  }
  async function preset(i) {
    await page.getByRole('tab', {name: 'Try it yourself', exact: true}).click();
    await page.getByRole('button', {name: 'Set up this experiment', exact: true}).nth(i).click();
    await page.getByRole('tab', {name: 'Controls', exact: true}).click();
    for (const key of keys) assert.equal(Number(await control(key).inputValue()), lesson.tryIt[i].values[key]);
    await compare(lesson.tryIt[i].values, 0);
    await assertSystemFocus(lesson.tryIt[i].part);await frameMargin();
  }
  const partNames = {system: 'Airbag warning indicator', monitor: 'Monitor and startup timer',
    'indicator-path': 'Controlled electronic switch', lamp: 'AIRBAG warning LED', records: 'Observed indicator history',circuit:'Connected lamp-drive circuit',buzzer:'Backup sounder'};
  async function selectInspection(name, id, held) {
    await page.getByRole('button', {name, exact: true}).click();
    assert.equal(await page.locator('.daily-part-path button[data-parent]').last().getAttribute('data-parent'), id);
    assert.equal(await page.locator('.daily-part-detail h3').textContent(), partNames[id]);
    assert.deepEqual(await read(), held);
  }
  async function captureReplay(values) {
    await page.locator('[data-play]').evaluate(button => {
      window.warningReplayStart = null;
      button.addEventListener('click', () => {
        window.warningReplayStart = Object.fromEntries([...document.querySelectorAll('.daily-readings > div')]
          .map(node => [node.querySelector('dt')?.textContent, node.querySelector('dd')?.textContent]));
      }, {once: true});
    });
    await page.locator('[data-play]').click();
    await frames();
    await page.locator('[data-play]').click();
    const reset = await page.evaluate(() => {const result = window.warningReplayStart; delete window.warningReplayStart; return result;});
    compareReadings(reset, values, 0);
    const paused = await read(), time = parseFloat(paused['Observation time']);
    assert.ok(time > 0 && time < 12, `Replay did not advance inside a fresh observation: ${time}`);
    compareReadings(paused, values, time, true);
    await frames();
    assert.deepEqual(await read(), paused);
    return {reset, paused, time};
  }
  try {
    assert.equal(lesson.tryIt.length, 10);
    assert.deepEqual(lesson.tryIt.map(experiment => experiment.title), titles);
    for (const [i, tuple] of tuples.entries()) {
      assert.deepEqual(lesson.tryIt[i].values, Object.fromEntries(keys.map((key, j) => [key, tuple[j]])));
      assert.equal(lesson.tryIt[i].reset, true);
      assert.equal(lesson.tryIt[i].part,[2,5,7,8].includes(i)?'records':i===3?'lamp':i===6?'indicator-path':'circuit');
      assert.equal(lesson.tryIt[i].isolate,true);assert.equal(lesson.tryIt[i].view,'front');
    }
    const name = 'Airbag warning indicator', slug = 'airbag-warning-indicator';
    const entry = neighborhoodCatalog.entries.filter(item => item.name === name);
    assert.equal(entry.length, 1); assert.equal(entry[0].id, slug); assert.equal(entry[0].group, 'airbag');
    const group = neighborhoodCatalog.groups.find(item => item.id === entry[0].group);
    assert.equal(group.items[0], 'Airbag'); assert.equal(group.place, 'workshop'); assert.equal(group.room, 'Garage');
    await page.goto(`${process.env.SITE_URL || 'http://127.0.0.1:4177/'}#list`);
    await page.locator('#catalog-search').fill(name);
    assert.equal(await page.locator('button[data-entry]').count(), 1);
    assert.equal(await page.locator(`button[data-entry="${slug}"]`).textContent(), name);
    await page.screenshot({path:new URL('browser-named-gallery.png',evidence).pathname});
    assert.equal(await page.locator('td>button[data-entry="'+slug+'"]').count(),1,'Whole item has one catalog row');
    assert.equal(await page.locator('a[data-part-link]').count(),0,'Individual parts stay inside the viewer');
    const catalogLinks=catalogParts[slug].map(part=>({href:`#machine/${slug}?part=${encodeURIComponent(part.id)}`,name:part.name}));
    assert.deepEqual(catalogLinks.map(link=>new URLSearchParams(link.href.split('?')[1]).get('part')),['board','power','indicator-path','resistor','lamp','monitor','report-input','buzzer','wires','feedback','records']);
    for(const link of catalogLinks){
      await page.evaluate(href=>{location.hash=href;},link.href);
      await page.waitForFunction(part=>document.querySelector('.daily-part-detail h3')?.textContent===part,link.name);
      assert.equal(await page.locator('.daily-part-detail h3').isVisible(),true);
    }
    await page.evaluate(()=>{location.hash='list';});
    await page.locator('#catalog-search').fill(name);
    await page.locator(`button[data-entry="${slug}"]`).click();
    await page.getByRole('heading', {name, exact: true}).waitFor();
    assert.equal(new URL(page.url()).hash, `#machine/${slug}`);
    assert.equal(await page.title(), `${name} · How Things Work`);
    assert.equal(await page.locator('.house-breadcrumbs [aria-current="page"]').textContent(), name);
    assert.equal(await page.locator('.daily-simple').textContent(), lesson.simple);
    assert.equal(await page.locator('.daily-overview').textContent(), lesson.overview);
    assert.equal(await page.locator('[data-control]').count(), 4);
    for (const key of keys) {
      assert.equal(await control(key).evaluate(node => node.tagName), 'SELECT');
      assert.deepEqual(await control(key).locator('option').allTextContents(), optionLabels[key]);
    }
    assert.equal(await page.getByRole('checkbox', {name: 'Look inside', exact: true}).count(), 0);
    assert.equal(await page.locator('[data-result]').isDisabled(), true);
    await compare(lesson.tryIt[0].values, 0);
    await frameMargin();await shot('initial');
    const trials = [];
    for (let i = 0; i < tuples.length; i++) {
      await preset(i); const rows = [];
      for (const [j, time] of stageTimes.entries()) {
        await inspect(j); rows.push(await compare(lesson.tryIt[i].values, time));
        if ([0, 1, 2, 3, 6, 7, 8, 9].includes(i) && [2, 3, 4, 6].includes(j)) await shot(`preset-${i}-stage-${j}`);
      }
      trials.push(rows); console.log(`PASS experiment ${i + 1}: ${titles[i]}`);
    }
    for (let j = 0; j < stageTimes.length; j++) {
      assert.deepEqual(trials[1][j].state, trials[7][j].state, 'Continuous-command working/stuck observations must coincide');
      assert.equal(trials[4][j].state.command, true); assert.equal(trials[4][j].state.visible, false);
    }
    assert.equal(trials[0][1].state.visible, true); assert.equal(trials[0][2].state.visible, false);
    assert.equal(trials[2][3].state.command, false); assert.equal(trials[2][4].state.command, true);
    assert.equal(trials[0][3].state.visible, trials[3][3].state.visible);
    assert.notEqual(trials[0][1].state.visible, trials[3][1].state.visible);
    assert.equal(trials[8][3].state.comparison, 'Differs'); assert.equal(trials[8][4].state.comparison, 'Matches');
    await preset(0);
    const allControls = [];
    for (const power of [0, 1]) for (const report of [0, 1, 2]) for (const lamp of [0, 1, 2]) {
      const values = {power, report, lamp, sound:0};
      for (const key of keys) await setValue(key, values[key]);
      await compare(values, 0); const rows = [];
      for (const [j, time] of stageTimes.entries()) {await inspect(j); rows.push(await compare(values, time));}
      allControls.push({values, rows});
    }
    console.log('PASS all18 control settings at all7 stages');
    await preset(0); await page.locator('[data-step]').click(); await compare(lesson.tryIt[0].values, .12);
    await page.locator('[data-play]').click(); await frames(); await page.locator('[data-play]').click();
    const paused = await read(), pauseTime = parseFloat(paused['Observation time']);
    assert.ok(pauseTime > .12 && pauseTime < 12);
    compareReadings(paused, lesson.tryIt[0].values, pauseTime, true); await frames(); assert.deepEqual(await read(), paused);
    await preset(8);
    const started = Date.now(); await page.locator('[data-play]').click();
    await page.waitForFunction(() => document.querySelector('[data-play]')?.getAttribute('aria-pressed') === 'false', null, {timeout: 50000});
    const playbackWallSeconds = (Date.now() - started) / 1000;
    assert.ok(playbackWallSeconds >= 5.5, `Playback ended too soon: ${playbackWallSeconds}s`);
    await compare(lesson.tryIt[8].values, 12);
    await page.locator('[data-result]').click(); await compare(lesson.tryIt[8].values, 12); await shot('completed-result');
    const replay = await captureReplay(lesson.tryIt[8].values);
    for (const [key, value] of Object.entries({power: 0, report: 1, lamp: 1})) {
      await inspect(6); await setValue(key, value); near(parseFloat((await read())['Observation time']), 0);
    }
    await page.getByRole('button', {name: 'Reset experiment', exact: true}).click();
    for (const key of keys) assert.equal(Number(await control(key).inputValue()), lesson.tryIt[0].values[key]);
    await compare(lesson.tryIt[0].values, 0);
    // Native select typeahead works across the platform's popup conventions.
    // Observe real input/change events; do not replace keyboard use with selectOption.
    await inspect(3);
    await control('report').evaluate(select => {
      window.warningKeyboardEvents = [];
      for (const type of ['input', 'change']) select.addEventListener(type, event => {
        window.warningKeyboardEvents.push({type: event.type, value: event.target.value});
      }, {once: true});
    });
    await control('report').focus(); await page.keyboard.press('r'); await page.keyboard.press('Tab');
    assert.equal(Number(await control('report').inputValue()), 1);
    const keyboardEvents = await page.evaluate(() => {
      const events = window.warningKeyboardEvents; delete window.warningKeyboardEvents; return events;
    });
    assert.deepEqual(keyboardEvents, [{type: 'input', value: '1'}, {type: 'change', value: '1'}]);
    await compare({...lesson.tryIt[0].values, report: 1}, 0);
    await preset(8); await inspect(3); const held = await read();
    for (const [name, id] of [['Inspect the monitor', 'monitor'], ['Inspect the indicator path', 'indicator-path'],
      ['Inspect the warning lamp', 'lamp'], ['Inspect the record', 'records']]) {
      await selectInspection(name, id, held); await shot(`inspect-${id}`);
    }
    for (const id of ['report-record', 'command-record', 'lamp-record']) {
      await selectInspection('Inspect the record', 'records', held);
      await page.locator(`button[data-part="${id}"]`).click();
      assert.equal(await page.locator('.daily-part-path button[data-parent]').last().getAttribute('data-parent'), id);
      assert.deepEqual(await read(), held); await sceneShot(`row-${id}`);
    }
    await page.locator('[data-isolate]').uncheck();
    await page.locator('[data-labels]').check(); assert.ok(await page.locator('button[data-label-part]:visible').count() >= 7);
    for (const id of ['power', 'report-input', 'monitor', 'indicator-path', 'lamp']) {
      const button = page.locator(`button[data-label-part="${id}"]`); await button.click();
      assert.equal(await button.getAttribute('aria-pressed'), 'true'); assert.deepEqual(await read(), held);
    }
    await shot('labels'); await page.locator('[data-labels]').uncheck();
    await page.getByRole('checkbox', {name: 'Isolate selected part', exact: true}).check();
    assert.deepEqual(await read(), held); await sceneShot('isolated-lamp');
    await page.getByRole('checkbox', {name: 'Isolate selected part', exact: true}).uncheck();
    await page.getByRole('button', {name: 'Restart experiment', exact: true}).click();
    await compare(lesson.tryIt[8].values, 0);
    for (const key of keys) assert.equal(Number(await control(key).inputValue()), lesson.tryIt[8].values[key]);
    await preset(9); await inspect(6); const offReplay = await captureReplay(lesson.tryIt[9].values);
    assert.equal(await page.locator('.daily-quiz > p').first().textContent(), lesson.quiz.question);
    await page.getByRole('button', {name: lesson.quiz.options[lesson.quiz.answer], exact: true}).click();
    await page.getByText(/That’s right/).waitFor();
    await page.setViewportSize({width: 390, height: 844});
    const phoneTrials=[];
    for (let i=0;i<10;i++) {
      await preset(i);
      const phoneRows=[];
      for (const j of [0,1,2,3,4,5,6]) {
        await inspect(j); const row = await compare(lesson.tryIt[i].values, stageTimes[j]);phoneRows.push(row);
        await selectInspection('Inspect the warning lamp', 'lamp', row.readings); await sceneShot(`phone-${i}-${j}-lamp`);
        await selectInspection('Inspect the record', 'records', row.readings); await sceneShot(`phone-${i}-${j}-record`);
        assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
      }
      phoneTrials.push(phoneRows);
    }
    await preset(8); await inspect(6); const phoneHeld = await read();
    for (const id of ['report-record', 'command-record', 'lamp-record']) {
      await selectInspection('Inspect the record', 'records', phoneHeld);
      await page.locator(`button[data-part="${id}"]`).click();
      assert.deepEqual(await read(), phoneHeld); await sceneShot(`phone-row-${id}`);
    }
    await shot('phone-final-history');
    await page.getByRole('button', {name: 'Reset experiment', exact: true}).click();
    await compare(lesson.tryIt[0].values, 0); await shot('phone-reset');
    assert.deepEqual(errors, []);
    const result = {passed: true, trials, phoneTrials, allControls, paused, replay, offReplay, playbackWallSeconds, keyboardEvents, errors,
      checks: 'Whole catalog row/route/title/lesson/quiz and Airbag group; ten exact complete presets × seven stages; all18 tuples × seven stages against independent literal interval table. Right-continuous6/8 boundaries, null unpowered command/report and dark actual light, masked continuous-command path failure, earlier mismatch followed by current agreement. Actual6s play for12s simulation, pause,.12s step, fresh replay exact reset snapshot and causal current values, controls/defaultreset/restartpreservedvalues/keyboard. State-preserving inspections, real row selection, labels/isolation and390px output/history navigation. Screenshots support separate native review; actual step-mesh vertices, null gaps and retained-prefix geometry are checked in focused/independent lanes, not by browser hooks. Separate native touch, audio and public gates remain required.'};
    await writeFile(new URL('browser-results.json', evidence), JSON.stringify(result, null, 2) + '\n');
    console.log(JSON.stringify({passed: true, experiments: trials.length+phoneTrials.length, settings: allControls.length, playbackWallSeconds}));
    return result;
  } finally {await browser.close();}
}
if (process.argv[1] === fileURLToPath(import.meta.url)) await checkAirbagWarningIndicatorBrowser();

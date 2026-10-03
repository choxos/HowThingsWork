import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';
import { powerLineInsulatorLesson as lesson } from './power-line-insulator-lesson.js';
const base = process.env.SITE_URL || 'http://127.0.0.1:4173/';
const output = process.env.EVIDENCE_DIR || 'documentation/power-line-insulator-browser';
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, hasTouch: true, reducedMotion: 'reduce' });
page.setDefaultTimeout(20000);
const errors = [], outcomes = [], controlCases = [];
page.on('pageerror', error => errors.push(error.message));
const reading = label => page.locator('.daily-readings > div').filter({ has: page.getByText(label, { exact: true }) }).locator('dd');
const value = async (label) => parseFloat(await reading(label).innerText());
const near = (actual, expected, tolerance = .00011) => assert.ok(Math.abs(actual - expected) <= tolerance, actual + ' differs from ' + expected);
const canvas = page.locator('canvas');
const capture = async (name) => { await canvas.scrollIntoViewIfNeeded(); await canvas.screenshot({ path: output + '/' + name + '.png' }); };
const reset = () => page.getByRole('button', { name: 'Reset experiment', exact: true }).click();
async function preset(index) {
    await page.getByRole('tab', { name: 'Try it yourself', exact: true }).click();
    await page.locator('[data-experiment]').nth(index).click();
    await page.getByRole('tab', { name: 'Controls', exact: true }).click();
}
async function edit(key, next) {
    if (key === 'voltage') {
        await page.locator('[data-number="voltage"]').fill(String(next));
        await page.keyboard.press('Tab');
    }
    else
        await page.locator('[data-control="' + key + '"]').selectOption(String(next));
}
async function snapshot(v, elapsed = 0) {
    const g = (v.insulation + v.connected) / 12, node = v.voltage / (1 + g), I = node * g, IL = node * v.connected / 12, IS = node * v.insulation / 12;
    const Psource = v.voltage * I, PL = node * IL, PS = node * IS, PF = I * I, t = elapsed / 1000, phase = 100 * Math.PI * t;
    const factor = t + Math.sin(2 * phase) / (200 * Math.PI), instant = 2 * Math.cos(phase) ** 2;
    for (const [label, expected] of Object.entries({ 'Source RMS voltage': v.voltage, 'Supported node RMS voltage': node, 'Consumer RMS voltage': v.connected ? node : 0 }))
        near(await value(label), expected, .00051);
    for (const [label, expected] of Object.entries({ 'Source RMS current': I, 'Consumer RMS current': IL, 'Support RMS current': IS, 'Source instantaneous current': Math.SQRT2 * I * Math.cos(phase), 'Consumer instantaneous current': Math.SQRT2 * IL * Math.cos(phase), 'Support instantaneous current': Math.SQRT2 * IS * Math.cos(phase), 'Mean source power': Psource, 'Mean consumer power': PL, 'Mean support-path power': PS, 'Mean feeder loss': PF, 'Instantaneous source power': instant * Psource, 'Instantaneous consumer power': instant * PL, 'Instantaneous support power': instant * PS, 'Instantaneous feeder loss': instant * PF, 'Source work': Psource * factor * 1000, 'Delivered consumer energy': PL * factor * 1000, 'Support-path energy': PS * factor * 1000, 'Feeder heat': PF * factor * 1000 }))
        near(await value(label), expected);
    near(await value('Simulated time'), elapsed);
    assert.equal(await reading('Insulation model').innerText(), v.insulation ? 'Illustrative 12 Ω path' : 'Ideal dielectric · open electrical path');
    assert.ok(!/NaN|undefined|Infinity/.test(await page.locator('.daily-readings').innerText()));
    return { voltage: v.voltage, insulation: v.insulation, connected: v.connected, nodeVoltage: await value('Supported node RMS voltage'), consumerCurrent: await value('Consumer RMS current'), supportCurrent: await value('Support RMS current'), consumerPower: await value('Mean consumer power'), supportPower: await value('Mean support-path power'), consumerEnergy: await value('Delivered consumer energy'), supportEnergy: await value('Support-path energy'), feederHeat: await value('Feeder heat'), sourceWork: await value('Source work') };
}
try {
    await page.goto(new URL('#list', base).href);
    await page.locator('.catalog-table tbody tr').first().waitFor();
    assert.equal(await page.locator('[data-entry="power-line-insulator"]').count(), 0, 'Passive insulator is not a standalone machine or smaller machine');
    await page.locator('button[data-entry="electricity-transmission"]').click();
    await page.getByRole('heading', {name: 'Electricity transmission', exact: true}).waitFor();
    await page.locator('.daily-related a[href="#machine/power-line-insulator"]').click();
    await page.getByRole('heading', {name: 'Power-line insulator', exact: true}).waitFor();
    await page.goto(new URL('#machine/power-line-insulator', base).href);
    await page.getByRole('heading', { name: 'Power-line insulator', exact: true }).waitFor();
    await page.locator('[data-control="insulation"]').waitFor();
    assert.equal(await page.locator('[data-control]').count(), 3);
    assert.equal(await page.locator('[data-number]').count(), 1);
    const selector = await page.locator('[data-control="insulation"]').boundingBox(), scene = await canvas.boundingBox();
    assert.ok(selector.y < scene.y, 'support model selector appears above scene');
    await snapshot(lesson.tryIt[0].values);
    await capture('opening');
    await page.screenshot({ path: output + '/opening-page.png' });
    for (const [index, trial] of lesson.tryIt.entries()) {
        await preset(index);
        for (const [key, expected] of Object.entries(trial.values))
            assert.equal(Number(await page.locator('[data-control="' + key + '"]').inputValue()), expected);
        await snapshot(trial.values);
        for (let step = 0; step < 16; step++)
            await page.locator('[data-step]').click();
        assert.equal(await page.locator('[data-play]').getAttribute('aria-pressed'), 'false');
        outcomes.push({ title: trial.title, ...await snapshot(trial.values, 40) });
        assert.match(await reading('Your result').innerText(), !trial.values.voltage ? /Source zero/ : trial.values.insulation ? (trial.values.connected ? /both draw current/ : /support path still draws current/) : (trial.values.connected ? /ideal support current is zero/ : /voltage remains across ideal insulation/));
        await capture('preset-' + index);
    }
    assert.ok(outcomes[1].nodeVoltage < outcomes[0].nodeVoltage && outcomes[1].consumerPower < outcomes[0].consumerPower);
    assert.equal(outcomes[2].consumerEnergy, 0);
    assert.ok(outcomes[2].supportEnergy > 0);
    assert.equal(outcomes[3].sourceWork, 0);
    assert.equal(outcomes[4].sourceWork, 0);
    await preset(0);
    await page.locator('[data-play]').click();
    await page.waitForTimeout(650);
    await page.locator('[data-play]').click();
    assert.ok(await value('Simulated time') > 0 && await value('Simulated time') < 40);
    const paused = await page.locator('.daily-readings').innerText();
    await page.waitForTimeout(300);
    assert.equal(await page.locator('.daily-readings').innerText(), paused);
    await preset(0);
    for (let i = 0; i < 14; i++)
        await page.locator('[data-step]').click();
    await page.locator('[data-play]').click();
    await page.waitForFunction(() => document.querySelector('[data-play]').getAttribute('aria-pressed') === 'false', null, { timeout: 60000 });
    await snapshot(lesson.tryIt[0].values, 40);
    await page.locator('[data-result]').click();
    await capture('result');
    await page.locator('[data-play]').click();
    await page.waitForTimeout(300);
    await page.locator('[data-play]').click();
    assert.ok(await value('Simulated time') < 40 && await value('Delivered consumer energy') < 408.9942);
    for (const [key, options] of Object.entries({ voltage: [0, 6, 12, 18, 24], insulation: [0, 1], connected: [0, 1] })) {
        for (const next of options) {
            await reset();
            await edit(key, next);
            await snapshot({ ...lesson.tryIt[0].values, [key]: next });
            controlCases.push({ key, value: next });
        }
    }
    for (const [key, next] of [['voltage', 24], ['insulation', 1], ['connected', 0]]) {
        await reset();
        await page.locator('[data-step]').click();
        near(await value('Simulated time'), 2.5);
        await edit(key, next);
        await snapshot({ ...lesson.tryIt[0].values, [key]: next });
    }
    await reset();
    const inspectState = await page.locator('.daily-readings').innerText();
    for (const [name, file] of [['Inspect the insulating attachment', 'insulating-attachment'], ['Inspect the complete support return', 'support-return']]) {
        await page.getByRole('button', { name, exact: true }).click();
        assert.equal(await page.locator('.daily-readings').innerText(), inspectState);
        await capture(file);
    }
    for (const [name, angle] of [['Pause at zero current', 90], ['Pause at reversed currents', 180]]) {
        await page.locator('[data-play]').click();
        await page.getByRole('button', { name, exact: true }).click();
        assert.equal(await page.locator('[data-play]').getAttribute('aria-pressed'), 'false');
        near(await value('Electrical phase'), angle);
        await snapshot(lesson.tryIt[0].values, angle / 18);
        await capture('phase-' + angle);
    }
    await page.getByRole('button', { name: 'Restart the selected insulator run', exact: true }).click();
    await snapshot(lesson.tryIt[0].values);
    await page.locator('[data-labels]').check();
    await page.locator('button[data-label-part="lower-fitting"]').click();
    await page.locator('[data-labels]').uncheck();
    await page.locator('[data-isolate]').check();
    await canvas.scrollIntoViewIfNeeded();
    let box = await canvas.boundingBox(), hit;
    const popup = page.locator('.daily-part-popup');
    for (let iy = 4; iy <= 16 && !hit; iy++)
        for (let ix = 4; ix <= 16; ix++) {
            await page.mouse.move(box.x + box.width * ix / 20, box.y + box.height * iy / 20);
            if (await popup.isVisible() && await popup.innerText() === 'Line clamp and lower fitting') {
                hit = [box.x + box.width * ix / 20, box.y + box.height * iy / 20];
                break;
            }
        }
    assert.ok(hit);
    await page.mouse.click(...hit);
    assert.equal(await popup.innerText(), 'Line clamp and lower fitting');
    await page.mouse.move(box.x + 10, box.y + 10);
    const beforeMove = await canvas.screenshot();
    await page.mouse.move(...hit);
    await page.mouse.down();
    await page.mouse.move(hit[0] + 40, hit[1] + 25, { steps: 10 });
    await page.mouse.up();
    await page.mouse.move(box.x + 10, box.y + 10);
    assert.ok(!beforeMove.equals(await canvas.screenshot()));
    await page.locator('.daily-heading h1').click();
    assert.equal(await popup.isVisible(), false);
    assert.equal(await page.locator('.daily-part-detail h3').count(), 0);
    await page.locator('[data-isolate]').uncheck();
    await page.locator('[data-labels]').check();
    await page.locator('button[data-label-part="upper-fitting"]').click();
    await page.locator('.daily-heading h1').click();
    assert.equal(await page.locator('button[data-label-part="upper-fitting"]').getAttribute('aria-pressed'), 'false');
    await page.locator('[data-labels]').uncheck();
    await page.locator('[data-view="reset"]').click();
    const beforeZoom = await canvas.screenshot();
    await page.locator('[data-view="in"]').click();
    assert.ok(!beforeZoom.equals(await canvas.screenshot()));
    assert.equal(await page.locator('[data-separation]').inputValue(), '0');
    await page.locator('[data-view="out"]').click();
    assert.equal(await page.locator('[data-separation]').inputValue(), '0');
    await canvas.scrollIntoViewIfNeeded();
    box = await canvas.boundingBox();
    await page.mouse.move(box.x + 20, box.y + 20);
    const beforeRotate = await canvas.screenshot();
    await page.mouse.down();
    await page.mouse.move(box.x + 110, box.y + 55, { steps: 12 });
    await page.mouse.up();
    assert.ok(!beforeRotate.equals(await canvas.screenshot()));
    await page.locator('[data-view="reset"]').click();
    await canvas.scrollIntoViewIfNeeded();
    box = await canvas.boundingBox();
    await page.mouse.move(box.x + 20, box.y + 20);
    const held = await page.locator('.daily-readings').innerText();
    for (let i = 0; i < 8; i++)
        await page.mouse.wheel(0, 240);
    await page.waitForFunction(() => document.querySelector('[data-separation]').value === '100');
    assert.equal(await page.locator('.daily-readings').innerText(), held);
    for (const name of ['Source and feeder', 'Insulation and mechanical support', 'Consumer and common return'])
        assert.ok((await page.locator('.daily-inventory-labels').innerText()).includes(name));
    await page.waitForFunction(() => Number(document.querySelector('[data-explosion]').dataset.explosion) > .999);
    await capture('grouped-parts');
    for (const insulation of [1, 0]) {
        await edit('insulation', insulation);
        await snapshot(lesson.tryIt[insulation].values);
        assert.equal(await page.locator('[data-separation]').inputValue(), '0', 'control edits restore assembly before updating geometry');
        await page.locator('[data-separation]').fill('100');
        await page.locator('[data-separation]').dispatchEvent('input');
        await page.waitForFunction(() => Number(document.querySelector('[data-explosion]').dataset.explosion) > .999);
        await snapshot(lesson.tryIt[insulation].values);
        await capture(insulation ? 'grouped-finite' : 'grouped-ideal');
    }
    await page.locator('[data-reassemble]').click();
    for (const view of ['Front', 'Side', 'Back', 'Top', 'Underneath', 'Angled']) {
        await page.getByRole('button', { name: view, exact: true }).click();
        await capture('view-' + view.toLowerCase());
    }
    for (const width of [390, 320]) {
        await page.setViewportSize({ width, height: width === 390 ? 844 : 568 });
        const tools = page.getByRole('navigation', { name: 'Lesson tools' });
        await tools.getByRole('button', { name: 'Try it yourself', exact: true }).click();
        await page.locator('[data-experiment]').nth(1).click();
        await tools.getByRole('button', { name: 'Controls', exact: true }).click();
        await snapshot(lesson.tryIt[1].values);
        await page.locator('[data-step]').click();
        near(await value('Electrical phase'), 45);
        assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
        await page.locator('[data-view="reset"]').click();
        await capture('phone-' + width);
        await page.screenshot({ path: output + '/phone-page-' + width + '.png' });
    }
    await page.setViewportSize({ width: 390, height: 844 });
    const session = await page.context().newCDPSession(page);
    async function pinch(from, to) {
        await canvas.scrollIntoViewIfNeeded();
        const b = await canvas.boundingBox(), x = b.x + b.width / 2, y = b.y + b.height / 2;
        const points = d => [{ x: x - d, y, id: 0 }, { x: x + d, y, id: 1 }];
        await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: points(from) });
        for (let i = 1; i <= 12; i++)
            await session.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: points(from + (to - from) * i / 12) });
        await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    }
    try {
        await pinch(120, 20);
        assert.ok(Number(await page.locator('[data-separation]').inputValue()) > 0);
        await capture('phone-pinch');
        await pinch(20, 120);
        await page.waitForFunction(() => document.querySelector('[data-separation]').value === '0');
    }
    finally {
        await session.detach();
    }
    await page.setViewportSize({ width: 1440, height: 1000 });
    for (const [index] of lesson.quiz.options.entries()) {
        await page.locator('[data-answer]').nth(index).click();
        assert.equal(await page.locator('.daily-answer').innerText(), (index === lesson.quiz.answer ? 'That’s right. ' : 'Try thinking through the parts again. ') + lesson.quiz.explanation);
    }
    await page.locator('.daily-return').click();
    assert.match(page.url(), /#place\/discovery/);
    assert.deepEqual(errors, []);
    const report = { passed: true, outcomes, controlCases, explicitReturnBalance: true, mechanicalAttachment: true, idealAndFiniteSupport: true, groupedModeEdits: true, pause: true, completion: true, replay: true, checkpoints: true, hoverClick: true, deselection: true, objectDrag: true, backgroundRotation: true, zoomOnlyButtons: true, wheelSeparation: true, pinch: true, mobileWidths: [390, 320], quiz: true, returnToPlace: true, errors };
    await writeFile(output + '/browser.json', JSON.stringify(report, null, 2) + '\n');
    console.log(JSON.stringify(report));
}
finally {
    await browser.close();
}

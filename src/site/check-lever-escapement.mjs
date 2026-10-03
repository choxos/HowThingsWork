import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';
import {leverEscapementLesson as lesson} from './watch-lessons.js';
import {balance} from './watch-physics.js';
const base = process.env.SITE_URL || 'http://127.0.0.1:4173/', output = process.env.EVIDENCE_DIR || 'documentation/lever-escapement-browser';
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, hasTouch: true, reducedMotion: 'reduce' });
page.setDefaultTimeout(20000);
const errors = [], outcomes = [], controlCases = [], actions = [], selections = [];
page.on('pageerror', e => errors.push(e.message));
const canvas = page.locator('canvas');
const reading = label => page.locator('.daily-readings > div').filter({ has: page.getByText(label, { exact: true }) }).locator('dd');
const value = async (label) => parseFloat((await reading(label).innerText()).replaceAll(',', ''));
const tab = name => page.getByRole('tab', { name, exact: true }).click();
const capture = async (name) => { await canvas.scrollIntoViewIfNeeded(); await canvas.screenshot({ path: output + '/' + name + '.png' }); };
const reset = () => page.getByRole('button', { name: 'Reset experiment', exact: true }).click();
async function preset(i) { await tab('Try it yourself'); await page.locator('[data-experiment]').nth(i).click(); await tab('Controls'); }
async function edit(key, next) { if (['alloy'].includes(key))
    await page.locator('[data-control="' + key + '"]').selectOption(String(next));
else {
    await page.locator('[data-number="' + key + '"]').fill(String(next));
    await page.keyboard.press('Tab');
} }
const near = (a, b, e = .00051) => assert.ok(Math.abs(a - b) <= e, a + ' differs from ' + b);
async function laws(v) {
    const expected = balance(v);
    near(await value('Supported swing'), expected.predictedAmplitude * 180 / Math.PI, .0051);
    near(await value('Balance frequency'), expected.frequency, .00000051);
    near(await value('Mainspring'), expected.torque * 1000, .000051);
    near(await value('Energy per beat'), expected.beatEnergy * 1e6, .000051);
    if (expected.running) near(await value('Outside fork passage'), 100 * (1 - 2 * Math.asin((18.2334023803 * Math.PI / 180) / expected.amplitude) / Math.PI), .0051);
    else assert.equal(await reading('Outside fork passage').innerText(), 'Unavailable while stopped');
    assert.equal(await page.locator('[data-play]').isDisabled(), !expected.running);
    if (!expected.running) assert.equal(await reading('Rate').innerText(), 'Unavailable while stopped');
    assert.ok(!/NaN|undefined|Infinity/.test(await page.locator('.daily-readings').innerText()));
    return {running: expected.running, frequency: await value('Balance frequency'), swing: await value('Supported swing'), rate: await reading('Rate').innerText()};
}
try {
    await page.goto(new URL('#list', base).href);
    const listedWatch = page.locator('button[data-entry="lever-escapement"]');
    await listedWatch.waitFor();
    const row = listedWatch.locator('xpath=ancestor::tr');
    assert.equal(await row.locator('button[data-entry="mechanical-watch"]').count(), 1);
    assert.equal(await listedWatch.locator('xpath=ancestor::ul[contains(@class,"catalog-components")]').count(), 1);
    assert.match(await row.innerText(), /The house/);
    assert.match(await row.innerText(), /Measuring and time/);
    await listedWatch.click();
    await page.getByRole('heading', {name: 'Lever escapement', exact: true, level: 1}).waitFor();
    await page.goto(new URL('#machine/lever-escapement', base).href);
    await page.getByRole('heading', {name: 'Lever escapement', exact: true, level: 1}).waitFor();
    await canvas.waitFor();
    assert.equal(await reading('Working contact').innerText(), 'Locked; balance free');
    assert.equal(await page.locator('[data-control]').count(), 4);
    await capture('opening');
    await page.screenshot({ path: output + '/opening-page.png' });
    const expected = ['Locked; balance free', 'Unlocking', 'Taking up fork clearance', 'Impulse', 'Free drop', 'Drawing to the bank', 'Locked; balance free', 'Unlocking', 'Impulse', 'Free drop', 'Locked; balance free', 'Locked; balance free', 'Locked; balance free', 'Locked; balance free', 'Stopped; no continuing drive', 'Locked; balance free', 'Locked; balance free', 'Locked; balance free'];
    for (const [i, p] of lesson.tryIt.entries()) {
        await preset(i);
        for (const [key, v] of Object.entries(p.values))
            assert.equal(Number(await page.locator('[data-control="' + key + '"]').inputValue()), v);
        assert.equal(await reading('Working contact').innerText(), expected[i], p.title);
        const outcome = await laws(p.values);
        if (i === 10) { assert.equal(await value('Completed releases'), 2); near(await value('Escape wheel advance'), 24); }
        if (i === 1) assert.ok(await value('Escape wheel advance') < 0);
        if (i === 14) {
            const held = await page.locator('.daily-readings').innerText();
            await page.locator('[data-step]').click();
            assert.equal(await page.locator('.daily-readings').innerText(), held);
        }
        outcomes.push({title: p.title, result: expected[i], ...outcome});
        await capture('preset-' + i);
    }
    await preset(0);
    await page.locator('[data-step]').click();
    assert.equal(await value('Completed releases'), 1);
    await page.locator('[data-step]').click();
    assert.equal(await value('Completed releases'), 2);
    await page.locator('[data-play]').click();
    await page.waitForTimeout(700);
    await page.locator('[data-play]').click();
    const paused = await page.locator('.daily-readings').innerText();
    await page.waitForTimeout(300);
    assert.equal(await page.locator('.daily-readings').innerText(), paused);
    await preset(0);
    for (let i = 0; i < 15; i++) await page.locator('[data-step]').click();
    await page.locator('[data-play]').click();
    await page.waitForFunction(() => document.querySelector('[data-play]').getAttribute('aria-pressed') === 'false', null, {timeout: 12000});
    assert.equal(await value('Completed releases'), 16);
    await page.locator('[data-play]').click();
    await page.waitForTimeout(250);
    await page.locator('[data-play]').click();
    assert.ok(await value('Completed releases') < 16);
    for (const [key, options] of Object.entries({index: [-5, 0, 1, 5], alloy: [0, 1], temperature: [0, 10, 20, 30, 40], hours: [0, 24, 43, 44]}))
        for (const v of options) {
            await reset();
            await edit(key, v);
            await laws({ ...lesson.tryIt[0].values, [key]: v });
            controlCases.push({ key, value: v });
        }
    await preset(0);
    for (let i = 0; i < await page.locator('[data-action]').count(); i++) {
        await reset();
        await page.locator('[data-cutaway]').check();
        await page.locator('[data-action]').nth(i).click();
        const name = await page.locator('[data-action]').nth(i).innerText(), result = await reading('Working contact').innerText();
        if (name.includes('drop'))
            assert.equal(result, 'Free drop');
        if (name.includes('contact') || name.includes('impulse'))
            assert.equal(result, 'Impulse');
        if (name.includes('unlocking')) assert.equal(result, 'Unlocking');
        if (name.includes('fork clearance')) assert.equal(result, 'Taking up fork clearance');
        if (name.endsWith('draw')) assert.equal(result, 'Drawing to the bank');
        actions.push({ name, result, part: await page.locator('.daily-part-detail h3').innerText() });
        await capture('action-' + i);
    }
    await page.locator('[data-labels]').check();
    const labels = await page.locator('button[data-label-part]').evaluateAll(elements => elements.map(el => ({id: el.dataset.labelPart, name: el.innerText})));
    for (const part of labels) {
        await page.getByRole('button', {name: 'Inspect: complete watch', exact: true}).click();
        await page.locator('[data-cutaway]').uncheck();
        if (part.id === 'charts') await page.getByRole('button', {name: 'Inspect: wind and temperature charts', exact: true}).click();
        await page.locator('button[data-label-part="' + part.id + '"]').click();
        assert.equal(await page.locator('.daily-part-detail h3').innerText(), part.name);
        assert.equal(await page.locator('button[data-label-part="' + part.id + '"]').getAttribute('aria-pressed'), 'true');
        selections.push(part);
    }
    await page.locator('[data-labels]').uncheck();
    await edit('hours', 44);
    await page.getByRole('button', {name: 'Inspect: wind and temperature charts', exact: true}).click();
    await capture('stopped-charts');
    assert.equal(await reading('Rate').innerText(), 'Unavailable while stopped');
    await reset();
    await page.locator('[data-cutaway]').check();
    await page.getByRole('button', { name: 'Inspect: entry impulse', exact: true }).click();
    await canvas.scrollIntoViewIfNeeded();
    let box = await canvas.boundingBox(), hit;
    const popup = page.locator('.daily-part-popup');
    for (let iy = 5; iy <= 15 && !hit; iy++)
        for (let ix = 5; ix <= 15; ix++) {
            const p = [box.x + box.width * ix / 20, box.y + box.height * iy / 20];
            await page.mouse.move(...p);
            if (await popup.isVisible() && await popup.innerText() === 'Entry pallet') {
                hit = p;
                break;
            }
        }
    assert.ok(hit, 'Working pallet is selectable');
    await page.mouse.click(...hit);
    assert.equal(await popup.innerText(), 'Entry pallet');
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
    await page.locator('[data-labels]').check();
    await page.locator('button[data-label-part="entry-pallet"]').click();
    await page.locator('.daily-heading h1').click();
    assert.equal(await page.locator('button[data-label-part="entry-pallet"]').getAttribute('aria-pressed'), 'false');
    await page.locator('[data-labels]').uncheck();
    await preset(0);
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
    await preset(0);
    await canvas.scrollIntoViewIfNeeded();
    box = await canvas.boundingBox();
    await page.mouse.move(box.x + 20, box.y + 20);
    const held = await page.locator('.daily-readings').innerText();
    for (let i = 0; i < 8; i++)
        await page.mouse.wheel(0, 240);
    await page.waitForFunction(() => document.querySelector('[data-separation]').value === '100');
    assert.equal(await page.locator('.daily-readings').innerText(), held);
    await capture('grouped-parts');
    await page.locator('[data-reassemble]').click();
    await page.getByRole('button', { name: 'Inspect: complete watch', exact: true }).click();
    for (const view of ['Front', 'Side', 'Back', 'Top', 'Underneath', 'Angled']) {
        await page.getByRole('button', { name: view, exact: true }).click();
        await capture('view-' + view.toLowerCase());
    }
    for (const width of [390, 320]) {
        await page.setViewportSize({ width, height: width === 390 ? 844 : 568 });
        const tools = page.getByRole('navigation', { name: 'Lesson tools' });
        await tools.getByRole('button', { name: 'Try it yourself', exact: true }).click();
        await page.locator('[data-experiment]').nth(4).click();
        await tools.getByRole('button', { name: 'Controls', exact: true }).click();
        assert.equal(await reading('Working contact').innerText(), 'Free drop');
        await page.getByRole('button', { name: 'Inspect: entry impulse', exact: true }).click();
        assert.equal(await reading('Working contact').innerText(), 'Impulse');
        assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
        await capture('phone-' + width);
        await page.screenshot({ path: output + '/phone-page-' + width + '.png' });
    }
    await page.setViewportSize({ width: 390, height: 844 });
    const session = await page.context().newCDPSession(page);
    async function pinch(from, to) { await canvas.scrollIntoViewIfNeeded(); const b = await canvas.boundingBox(), x = b.x + b.width / 2, y = b.y + b.height / 2, points = d => [{ x: x - d, y, id: 0 }, { x: x + d, y, id: 1 }]; await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: points(from) }); for (let i = 1; i <= 12; i++)
        await session.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: points(from + (to - from) * i / 12) }); await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); }
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
    for (const [i] of lesson.quiz.options.entries()) {
        await page.locator('[data-answer]').nth(i).click();
        assert.equal(await page.locator('.daily-answer').innerText(), (i === lesson.quiz.answer ? 'That’s right. ' : 'Try thinking through the parts again. ') + lesson.quiz.explanation);
    }
    await page.locator('.daily-return').click();
    assert.ok(!page.url().endsWith('#machine/lever-escapement'));
    assert.deepEqual(errors, []);
    const report = { passed: true, outcomes, controlCases, actions, selections, pause: true, beatStep: true, completion: true, replay: true, hoverClick: true, deselection: true, objectDrag: true, backgroundRotation: true, zoomOnlyButtons: true, wheelSeparation: true, pinch: true, mobileWidths: [390, 320], quiz: true, return: true, errors };
    await writeFile(output + '/browser.json', JSON.stringify(report, null, 2) + '\n');
    console.log(JSON.stringify(report));
}
catch (error) {
    await writeFile(output + '/failure.json', JSON.stringify({message: error.message, errors, url: page.url(), body: await page.locator('body').innerText().catch(() => '')}, null, 2));
    await page.screenshot({path: output + '/failure.png'}).catch(() => {});
    throw error;
}
finally {
    await browser.close();
}

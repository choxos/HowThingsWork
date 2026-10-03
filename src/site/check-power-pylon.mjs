import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';
import { powerPylonLesson as lesson } from './power-pylon-lesson.js';
const base = process.env.SITE_URL || 'http://127.0.0.1:4173/';
const output = process.env.EVIDENCE_DIR || 'documentation/power-pylon-browser';
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, hasTouch: true, reducedMotion: 'reduce' });
page.setDefaultTimeout(20000);
const errors = [], outcomes = [], controlCases = [];
page.on('pageerror', error => errors.push(error.message));
const reading = label => page.locator('.daily-readings > div').filter({ has: page.getByText(label, { exact: true }) }).locator('dd');
const value = async (label) => parseFloat(await reading(label).innerText());
const near = (actual, expected, tol = .00051) => assert.ok(Math.abs(actual - expected) <= tol, actual + ' differs from ' + expected);
const canvas = page.locator('canvas');
const capture = async (name) => { await canvas.scrollIntoViewIfNeeded(); await canvas.screenshot({ path: output + '/' + name + '.png' }); };
const reset = () => page.getByRole('button', { name: 'Reset experiment', exact: true }).click();
async function preset(index) { await page.getByRole('tab', { name: 'Try it yourself', exact: true }).click(); await page.locator('[data-experiment]').nth(index).click(); await page.getByRole('tab', { name: 'Controls', exact: true }).click(); }
async function edit(key, next) { await page.locator('[data-number="' + key + '"]').fill(String(next)); await page.keyboard.press('Tab'); }
async function snapshot(v, t = 0) {
    const a = v.tension, q = v.span / (2 * a), sag = a * (Math.cosh(q) - 1), minimum = v.height - sag, length = 2 * a * Math.sinh(q), vertical = length / 2, force = Math.hypot(a, vertical), progress = t / 6;
    const x = t === 0 || t === 6 ? 0 : (progress - .5) * v.span, y = v.height - a * (Math.cosh(q) - Math.cosh(x / a));
    for (const [label, expected] of Object.entries({ 'Attachment height': v.height, 'Support spacing': v.span, 'Horizontal tension': v.tension, 'Calculated sag': sag, 'Configured minimum height': minimum, 'Cable length': length, 'Cable weight': length, 'Vertical load per support': vertical, 'Endpoint tension': force, 'Inspection progress': 100 * progress, 'Inspection time': t, 'Probe position': x, 'Probe height': y }))
        near(await value(label), expected);
    if (!t)
        assert.equal(await reading('Measured minimum height').innerText(), 'Not inspected');
    else
        near(await value('Measured minimum height'), progress >= .5 ? minimum : y);
    assert.ok(!/NaN|undefined|Infinity/.test(await page.locator('.daily-readings').innerText()));
    return { height: v.height, span: v.span, tension: v.tension, sag: await value('Calculated sag'), minimum: await value('Configured minimum height'), length: await value('Cable length'), vertical: await value('Vertical load per support'), endpoint: await value('Endpoint tension'), progress: await value('Inspection progress') };
}
try {
    await page.goto(new URL('#list',base).href);
    await page.locator('.catalog-table tbody tr').first().waitFor();
    assert.equal(await page.locator('[data-entry="power-pylon"]').count(),0,'Structural support is not a standalone or smaller machine');
    await page.locator('#principle-filter').selectOption('forces-and-structures');
    assert.equal(await page.locator('[data-entry="electricity-transmission"]').count(),1,'Structural filtering keeps the parent');
    await page.locator('button[data-entry="electricity-transmission"]').click();
    await page.getByRole('heading',{name:'Electricity transmission',exact:true}).waitFor();
    await page.locator('.daily-related a[href="#machine/power-pylon"]').click();
    await page.getByRole('heading',{name:'Power pylon',exact:true}).waitFor();
    await page.goto(new URL('#machine/power-pylon', base).href);
    await page.getByRole('heading', { name: 'Power pylon', exact: true }).waitFor();
    await page.locator('[data-number="height"]').waitFor();
    assert.equal(await page.locator('[data-control]').count(), 3);
    assert.equal(await page.locator('[data-number]').count(), 3);
    await snapshot(lesson.tryIt[0].values);
    await capture('opening');
    await page.screenshot({ path: output + '/opening-page.png' });
    for (const [index, trial] of lesson.tryIt.entries()) {
        await preset(index);
        for (const [key, expected] of Object.entries(trial.values))
            assert.equal(Number(await page.locator('[data-control="' + key + '"]').inputValue()), expected);
        await snapshot(trial.values);
        for (let step = 0; step < 20; step++)
            await page.locator('[data-step]').click();
        assert.equal(await page.locator('[data-play]').getAttribute('aria-pressed'), 'false');
        outcomes.push({ title: trial.title, ...await snapshot(trial.values, 6) });
        assert.match(await reading('Your result').innerText(), /Lowest cable point measured/);
        await capture('preset-' + index);
    }
    near(outcomes[1].minimum - outcomes[0].minimum, 2);
    near(outcomes[1].sag, outcomes[0].sag);
    near(outcomes[1].endpoint, outcomes[0].endpoint);
    assert.ok(outcomes[2].minimum < outcomes[0].minimum && outcomes[2].length > outcomes[0].length);
    assert.ok(outcomes[3].sag < outcomes[0].sag && outcomes[3].endpoint > outcomes[0].endpoint);
    assert.ok(outcomes[4].minimum > .23 && outcomes[4].minimum < .24);
    assert.ok(outcomes[5].minimum > outcomes[0].minimum);
    assert.ok(outcomes[6].minimum > 5.77);
    await preset(0);
    await page.locator('[data-play]').click();
    await page.waitForTimeout(650);
    await page.locator('[data-play]').click();
    assert.ok(await value('Inspection time') > 0 && await value('Inspection time') < 6);
    const paused = await page.locator('.daily-readings').innerText();
    await page.waitForTimeout(300);
    assert.equal(await page.locator('.daily-readings').innerText(), paused);
    await preset(0);
    for (let i = 0; i < 18; i++)
        await page.locator('[data-step]').click();
    await page.locator('[data-play]').click();
    await page.waitForFunction(() => document.querySelector('[data-play]').getAttribute('aria-pressed') === 'false', null, { timeout: 60000 });
    await snapshot(lesson.tryIt[0].values, 6);
    await page.locator('[data-result]').click();
    await capture('result');
    await page.locator('[data-play]').click();
    await page.waitForTimeout(300);
    await page.locator('[data-play]').click();
    assert.ok(await value('Inspection time') < 6);
    for (const [key, options] of Object.entries({ height: [3, 4, 5, 6], span: [8, 10, 12, 14, 16], tension: [12, 18, 24, 30, 36] }))
        for (const next of options) {
            await reset();
            await edit(key, next);
            await snapshot({ ...lesson.tryIt[0].values, [key]: next });
            controlCases.push({ key, value: next });
        }
    for (const [key, next] of [['height', 6], ['span', 8], ['tension', 36]]) {
        await reset();
        await page.locator('[data-step]').click();
        await snapshot(lesson.tryIt[0].values, .3);
        await edit(key, next);
        await snapshot({ ...lesson.tryIt[0].values, [key]: next });
    }
    await reset();
    await page.locator('[data-number="height"]').focus();
    await page.keyboard.press('ArrowUp');
    await page.keyboard.press('Tab');
    await snapshot({ ...lesson.tryIt[0].values, height: 4 });
    await reset();
    const inspectState = await page.locator('.daily-readings').innerText();
    for (const [name, file] of [['Inspect the left attachment', 'left-attachment'], ['Inspect the right attachment', 'right-attachment']]) {
        await page.getByRole('button', { name, exact: true }).click();
        assert.equal(await page.locator('.daily-readings').innerText(), inspectState);
        await capture(file);
    }
    for (const [name, time] of [['Pause one quarter across the span', 1.5], ['Pause at the lowest point', 3]]) {
        await page.locator('[data-play]').click();
        await page.getByRole('button', { name, exact: true }).click();
        assert.equal(await page.locator('[data-play]').getAttribute('aria-pressed'), 'false');
        await snapshot(lesson.tryIt[0].values, time);
        await capture('checkpoint-' + time);
    }
    await page.getByRole('button', { name: 'Restart the selected inspection sweep', exact: true }).click();
    await snapshot(lesson.tryIt[0].values);
    await page.locator('[data-labels]').check();
    await page.locator('button[data-label-part="left-attachment"]').click();
    await page.locator('[data-labels]').uncheck();
    await page.locator('[data-isolate]').check();
    await canvas.scrollIntoViewIfNeeded();
    let box = await canvas.boundingBox(), hit;
    const popup = page.locator('.daily-part-popup');
    for (let iy = 4; iy <= 16 && !hit; iy++)
        for (let ix = 4; ix <= 16; ix++) {
            await page.mouse.move(box.x + box.width * ix / 20, box.y + box.height * iy / 20);
            if (await popup.isVisible() && await popup.innerText() === 'Left insulating suspension and clamp') {
                hit = [box.x + box.width * ix / 20, box.y + box.height * iy / 20];
                break;
            }
        }
    assert.ok(hit);
    await page.mouse.click(...hit);
    assert.equal(await popup.innerText(), 'Left insulating suspension and clamp');
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
    await page.locator('button[data-label-part="right-attachment"]').click();
    await page.locator('.daily-heading h1').click();
    assert.equal(await page.locator('button[data-label-part="right-attachment"]').getAttribute('aria-pressed'), 'false');
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
    for (const name of ['Left rigid pylon', 'Right rigid pylon', 'Suspended span and reference'])
        assert.ok((await page.locator('.daily-inventory-labels').innerText()).includes(name));
    await page.waitForFunction(() => Number(document.querySelector('[data-explosion]').dataset.explosion) > .999);
    await capture('grouped-parts');
    for (const tension of [36, 12]) {
        await edit('tension', tension);
        await snapshot({ ...lesson.tryIt[0].values, tension });
        assert.equal(await page.locator('[data-separation]').inputValue(), '0');
        await page.locator('[data-separation]').fill('100');
        await page.locator('[data-separation]').dispatchEvent('input');
        await page.waitForFunction(() => Number(document.querySelector('[data-explosion]').dataset.explosion) > .999);
        await capture('grouped-tension-' + tension);
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
        near(await value('Inspection progress'), 5);
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
    const report = { passed: true, outcomes, controlCases, exactCatenary: true, mechanicalAttachment: true, supportForceBalance: true, groupedModeEdits: true, pause: true, completion: true, replay: true, checkpoints: true, hoverClick: true, deselection: true, objectDrag: true, backgroundRotation: true, zoomOnlyButtons: true, wheelSeparation: true, pinch: true, mobileWidths: [390, 320], quiz: true, returnToPlace: true, errors };
    await writeFile(output + '/browser.json', JSON.stringify(report, null, 2) + '\n');
    console.log(JSON.stringify(report));
}
finally {
    await browser.close();
}

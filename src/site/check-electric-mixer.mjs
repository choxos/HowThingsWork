import assert from 'node:assert/strict';
import {mkdir, writeFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import {electricMixerLesson as lesson} from './beaters-lessons.js';
import {sampleMixer, MIXER_DEFAULTS, MIXER_DOMAINS} from './beaters-physics.js';
import {fixed} from './format.js';

const readings = page => page.locator('.daily-readings>div').evaluateAll(ns => Object.fromEntries(ns.map(n => [n.querySelector('dt').textContent, n.querySelector('dd').textContent])));
async function preset(page, i) { await page.getByRole('tab', {name:'Try it yourself',exact:true}).click(); await page.locator(`[data-experiment="${i}"]`).click(); await page.getByRole('tab',{name:'Controls',exact:true}).click(); }
function compare(r, values, time) {
  const s = sampleMixer(values, time), rpm = s.speedNow * 60 / (2 * Math.PI);
  const expected = {
    'Run clock': `${fixed(s.elapsed / 60, 2)} / ${values.minutes} min`,
    'Motor and beaters now': `${fixed(rpm, 0)} / ${fixed(rpm / s.G, 0)} rpm`,
    'Speed while powered': `${fixed(s.rpm, 0)} rpm motor · ${fixed(s.beaterRate * 60, 0)} rpm each beater`,
    'Motor temperature rise': `${fixed(s.rise, 1)} °C above room`,
    'Thermal cutoff': s.cutout === null ? 'No trip at this fixed load' : `${fixed(s.cutout / 60, 2)} min if left on`,
    'Work delivered to mixture': `${fixed(s.work / 1000, 2)} kJ`,
    'Electrical input while powered': `${fixed(s.inputPower, 1)} W · ${fixed(s.voltage, 1)} V · ${fixed(s.current, 2)} A`,
    'Power to both beaters': `${fixed(s.outputPower, 1)} W`,
    'Worm drive efficiency': `${fixed(s.eta * 100, 1)}% · ${fixed(s.gearLoss, 1)} W lost`,
    'Motor heating while powered': `${fixed(s.loss, 1)} W`,
    'Cooling while powered': `${fixed(s.conductance, 2)} W per °C`,
    'Torque on each beater': `${fixed(s.beaterTorque * 1000, 0)} N·mm`,
  };
  assert.equal(Object.keys(r).length, 13);
  for (const [key, value] of Object.entries(expected)) assert.equal(r[key], value, key);
  assert.match(r['Your result'], s.mode === 'ready' ? /^Ready/ : s.tripped ? /^Cutoff opened/ : s.complete ? /^Finished/ : /^Running/);
  return s;
}

export async function checkElectricMixer(page, {base, dir, prefix='local', widths=[1440,390], playback=true, boundaries=true}) {
  await mkdir(dir, {recursive:true}); const observations=[], playbackCases=[];
  const shot=async name => { await page.mouse.move(0,0); await page.locator('canvas').scrollIntoViewIfNeeded(); await page.waitForTimeout(250); await page.locator('canvas').screenshot({path:`${dir}/${prefix}-${name}.png`}); };
  const actions = ['After one minute','At the stopping event','Finish the trial'];
  for (const width of widths) {
    await page.setViewportSize({width,height:width===390?844:1000}); await page.goto('about:blank'); await page.goto(base+'#machine/electric-mixer'); await page.locator('[data-control="wheel"]').waitFor(); await page.evaluate(()=>document.fonts.ready);
    assert.equal(await page.locator('h1').innerText(),'Electric mixer'); assert.equal(await page.locator('[data-control]').count(),5); assert.equal(await page.locator('[data-action]').count(),9); assert.equal(await page.locator('[data-experiment]').count(),10);
    const primary=await page.locator('.daily-primary-controls select').evaluate(e=>{const b=e.getBoundingClientRect();return scrollY===0&&b.top>=0&&b.bottom<=innerHeight&&b.height>=44&&document.elementFromPoint(b.x+b.width/2,b.y+b.height/2)===e;});
    assert.equal(primary,true); await page.screenshot({path:`${dir}/${prefix}-opening-${width}.png`});
    for (let i=0;i<lesson.tryIt.length;i++) {
      await preset(page,i); const values=lesson.tryIt[i].values; compare(await readings(page),values,0);
      for (const [key,value] of Object.entries(values)) {assert.equal(Number(await page.locator(`[data-control="${key}"]`).inputValue()),value);assert.equal(await page.locator(`[data-control="${key}"]`).isEnabled(),true);}
      const p=sampleMixer(values,0), times=[Math.min(60,p.seconds),Math.min(p.cutout??p.seconds,p.seconds),p.seconds], states=[];
      for (let j=0;j<3;j++) {await page.getByRole('button',{name:actions[j],exact:true}).click();const r=await readings(page),s=compare(r,values,times[j]);states.push(r);assert.equal(await page.locator('[data-result]').isDisabled(),!s.complete);await shot(`trial-${width}-${i}-${j}`);}
      assert.ok(await page.locator('.daily-readings>div').evaluateAll(ns=>ns.every(n=>n.querySelector('p')?.textContent.length>15))); assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
      observations.push({width,trial:i,title:lesson.tryIt[i].title,states});
    }
    const closeups=[['See the worm drive','Worm and both wheels'],['See both beaters','Both beaters'],['See the motor and fan','Electric motor'],['See the cutoff','Thermal cutoff'],['See the bearings','Shaft bearings'],['See the whole mixer','Electric mixer']];
    for (const i of [0,2,8,9]) {
      await preset(page,i);await page.getByRole('button',{name:actions[0],exact:true}).click();const held=await readings(page);
      for (const [label,name] of closeups) {await page.getByRole('button',{name:label,exact:true}).click();assert.equal(await page.locator('.daily-part-detail h3').innerText(),name);assert.deepEqual(await readings(page),held);assert.equal(await page.locator('[data-isolate]').isChecked(),name!=='Electric mixer');await shot(`close-${width}-${i}-${name.replaceAll(' ','-')}`);}
    }
    await preset(page,0);const held=await readings(page);await page.locator('[data-cutaway]').uncheck();await shot(`cover-${width}`);assert.deepEqual(await readings(page),held);await page.locator('[data-cutaway]').check();
    await page.locator('[data-separation]').fill('100');await page.locator('[data-separation]').dispatchEvent('input');await page.waitForTimeout(900);await shot(`separated-${width}`);const categories=await page.locator('[data-category]').allTextContents();assert.ok(categories.includes('Worm and both wheels'));assert.ok(categories.includes('Both beaters'));assert.deepEqual(await readings(page),held);
    for (const direction of ['in','out']) {await page.locator(`[data-view="${direction}"]`).click();assert.equal(await page.locator('[data-separation]').inputValue(),'100');}
    await page.locator('[data-reassemble]').click();await page.waitForTimeout(900);assert.equal(await page.locator('[data-separation]').inputValue(),'0');
    if (boundaries) {
      for (const [key,[min,max]] of Object.entries(MIXER_DOMAINS)) for (const value of key==='mixture'?[0,1,2,3,4]:key==='wheel'?[20,30,40]:[min,max]) {
        await preset(page,0);await page.getByRole('button',{name:actions[0],exact:true}).click();const input=page.locator(`[data-control="${key}"]`);
        if (['wheel','mixture','fan'].includes(key)) await input.selectOption(String(value)); else {await input.fill(String(value));await input.dispatchEvent('input');}
        const values={...MIXER_DEFAULTS,[key]:value}; compare(await readings(page),values,value===MIXER_DEFAULTS[key]?60:0);
        await page.getByRole('button',{name:actions[2],exact:true}).click();compare(await readings(page),values,values.minutes*60);
      }
      await page.getByRole('button',{name:'Reset experiment',exact:true}).click();compare(await readings(page),MIXER_DEFAULTS,0);
      await page.locator('[data-control="setting"]').focus();await page.keyboard.press('ArrowLeft');assert.equal(await page.locator('[data-control="setting"]').inputValue(),'2');
    }
  }
  if (playback) for (const i of [0,2,7]) {
    await preset(page,i);const values=lesson.tryIt[i].values;
    await page.locator('[data-step]').click();compare(await readings(page),values,.1);
    await page.locator('[data-play]').click();await page.waitForFunction(()=>parseFloat([...document.querySelectorAll('.daily-readings>div')].find(n=>n.querySelector('dt').textContent==='Run clock').querySelector('dd').textContent)>.15);
    await page.locator('[data-play]').click();const held=await readings(page);await page.waitForTimeout(350);assert.deepEqual(await readings(page),held);
    await page.locator('[data-play]').click();await page.waitForFunction(()=>document.querySelector('[data-play]').getAttribute('aria-pressed')==='false',null,{timeout:45000});const ended=await readings(page);compare(ended,values,values.minutes*60);assert.equal(await page.locator('[data-result]').isDisabled(),false);
    await shot(`continuous-${i}`);await page.locator('[data-result]').click();await page.locator('[data-play]').click();await page.waitForFunction(()=>parseFloat([...document.querySelectorAll('.daily-readings>div')].find(n=>n.querySelector('dt').textContent==='Run clock').querySelector('dd').textContent)<.5);await page.locator('[data-play]').click();
    for (const [key,value] of Object.entries(values)) assert.equal(await page.locator(`[data-control="${key}"]`).inputValue(),String(value));
    await page.locator('[data-play]').click();await page.getByRole('button',{name:'See the worm drive',exact:true}).click();assert.equal(await page.locator('[data-play]').getAttribute('aria-pressed'),'false');
    playbackCases.push({trial:i,step:true,pause:true,completion:ended,replay:true,inspectionStops:true});
  }
  const result={passed:true,observations,playbackCases};await writeFile(`${dir}/${prefix}-mixer-browser.json`,JSON.stringify(result,null,2)+'\n');return result;
}
if(typeof process!=='undefined'&&process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href) {
  const {chromium}=await import('playwright'),browser=await chromium.launch({headless:true});
  try {const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));page.setDefaultTimeout(20000);page.setDefaultNavigationTimeout(45000);
    const r=await checkElectricMixer(page,{base:process.env.SITE_URL||'http://localhost:5194/',dir:process.env.EVIDENCE_DIR||'/tmp/howthingswork-electric-mixer',prefix:process.env.EVIDENCE_PREFIX||'local'});assert.deepEqual(errors,[]);console.log(JSON.stringify({passed:true,presetStageChecks:r.observations.length*3,playbackCases:r.playbackCases.length,errors}));
  } finally {await browser.close();}
}

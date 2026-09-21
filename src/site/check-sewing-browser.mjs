import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {mkdir,writeFile} from 'node:fs/promises';
import {utilityLessons} from './utility-lessons.js';
const base=process.env.SITE_URL||'http://127.0.0.1:5175/';
const evidence=process.env.EVIDENCE_DIR||'/tmp/howthingswork-sewing';await mkdir(evidence,{recursive:true});const cases=[];
const browser=await chromium.launch({headless:true});
const page=await browser.newPage({viewport:{width:1440,height:1000},reducedMotion:'reduce'}),errors=[];
page.on('pageerror',error=>errors.push(error.message));
try{
 await page.goto(`${base}#machine/sewing-machine`);
 const result=page.locator('.daily-readings');
 await page.getByRole('button',{name:'Sew the template',exact:true}).waitFor();
 assert.equal(await page.getByRole('button',{name:'Inspect your stitching',exact:true}).isDisabled(),true);
 await page.getByRole('spinbutton',{name:'Stitch length value',exact:true}).fill('5');
 await page.getByRole('spinbutton',{name:'Sewing pace value',exact:true}).fill('3');
 await page.getByRole('button',{name:'Sew the template',exact:true}).click();
 await page.getByRole('combobox',{name:'Presser foot',exact:true}).selectOption('0');
 assert.equal(await page.locator('[data-play]').getAttribute('aria-pressed'),'false');
 assert.match(await result.textContent(),/Lower the presser foot/);
 const paused=await result.textContent();await page.waitForTimeout(350);assert.equal(await result.textContent(),paused);
 await page.getByRole('combobox',{name:'Presser foot',exact:true}).selectOption('1');
 await page.getByRole('button',{name:'Sew the template',exact:true}).click();
 await page.waitForFunction(()=>document.querySelector('.daily-readings').textContent.includes('Template complete'),{timeout:30000});
 assert.match(await result.textContent(),/8 lockstitches · 40.0 \/ 40 mm sewn/);
 assert.equal(await page.locator('[data-play]').getAttribute('aria-pressed'),'false');
 await page.getByRole('button',{name:'Inspect your stitching',exact:true}).click();
 assert.match(await page.locator('.daily-part-detail').textContent(),/Completed lockstitches/);
 await page.screenshot({path:'/tmp/howthingswork-sewing-finished.png',fullPage:true});
 await page.getByRole('button',{name:'Reset experiment',exact:true}).click();
 await page.getByRole('combobox',{name:'Thread setup',exact:true}).selectOption('0');
 await page.getByRole('button',{name:'Make one stitch',exact:true}).click();
 assert.match(await result.textContent(),/0 lockstitches · 0.0 \/ 40 mm sewn/);
 await page.getByRole('combobox',{name:'Thread setup',exact:true}).selectOption('1');
 await page.getByRole('button',{name:'Make one stitch',exact:true}).click();
 assert.match(await result.textContent(),/1 lockstitch · 3.0 \/ 40 mm sewn/);
 await page.getByRole('tab',{name:'Try it yourself',exact:true}).click();
 await page.getByRole('button',{name:'Set up this experiment',exact:true}).nth(2).click();
 assert.match(await result.textContent(),/0 lockstitches · 0.0 \/ 40 mm sewn/);
 await page.getByRole('tab',{name:'Controls',exact:true}).click();
 await page.getByRole('spinbutton',{name:'Sewing pace value',exact:true}).fill('3');
 await page.getByRole('button',{name:'Sew the template',exact:true}).click();
 await page.waitForFunction(()=>document.querySelector('.daily-readings').textContent.includes('Template complete'),{timeout:30000});
 assert.match(await result.textContent(),/14 lockstitches · 40.0 \/ 40 mm sewn/);
 await page.getByRole('button',{name:'Inspect your stitching',exact:true}).click();
 await page.getByRole('button',{name:'Top',exact:true}).click();
 await page.screenshot({path:'/tmp/howthingswork-sewing-corner.png',fullPage:true});
 await page.goto(`${base}#machine/lockstitch`);await page.getByRole('button',{name:'Next stitch stage',exact:true}).waitFor();
 assert.match(await page.locator('.daily-overview').textContent(),/needle carries upper thread/);
 assert.equal(await page.locator('.daily-part-path [data-parent]').last().getAttribute('data-parent'),'stitch-formation');assert.equal(await page.getByRole('checkbox',{name:'Isolate selected part',exact:true}).isChecked(),true);
 for(let i=0;i<3;i++)await page.getByRole('button',{name:'Next stitch stage',exact:true}).click();
 assert.match(await result.textContent(),/Hook catches/);
 await page.screenshot({path:'/tmp/howthingswork-sewing-hook.png',fullPage:true});
 await page.goto(`${base}#machine/feed-dog`);await page.getByRole('button',{name:'Next stitch stage',exact:true}).waitFor();
 assert.match(await page.locator('.daily-overview').textContent(),/Feed dogs are toothed bars/);
 await page.getByRole('button',{name:'Next stitch stage',exact:true}).click();
 await page.getByRole('tab',{name:'Meet the parts',exact:true}).click();
 assert.match(await page.getByRole('tabpanel',{name:'Meet the parts',exact:true}).textContent(),/Slotted stitch-length regulator/);
 for(const [id,part] of [['bobbin-and-bobbin-thread','hook-assembly'],['needle-and-needle-thread','stitch-formation'],['rotary-sewing-hook','stitch-formation'],['rotary-shuttle','stitch-formation'],['thread-take-up-lever','take-up'],['feed-dog-lift-and-advance-linkages','feed-linkages']]){
  await page.goto(`${base}#machine/${id}`);await page.getByRole('button',{name:'Next stitch stage',exact:true}).waitFor();
  assert.equal(await page.locator('.daily-part-path [data-parent]').last().getAttribute('data-parent'),part);
  assert.ok((await page.locator('.daily-overview').textContent()).length>100);
  await page.getByRole('tab',{name:'Try it yourself',exact:true}).click();await page.getByRole('button',{name:'Set up this experiment',exact:true}).first().click();
  assert.match(await result.textContent(),/0 lockstitches · 0.0 \/ 40 mm sewn/);
 }
 await page.setViewportSize({width:390,height:844});
 assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
 assert.deepEqual(errors,[]);
 for(const width of [1440,390]){
  await page.setViewportSize({width,height:width===390?844:1000});await page.goto('about:blank');await page.goto(base+'#machine/sewing-machine');await page.locator('[data-play]').waitFor();
  const capture=async name=>{await page.locator('canvas').evaluate(c=>c.scrollIntoView({block:'start',behavior:'instant'}));await page.waitForTimeout(150);await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));return page.screenshot({path:`${evidence}/${name}-${width}.png`,clip:await page.locator('canvas').boundingBox()});},read=label=>page.locator('.daily-readings>div').filter({has:page.locator('dt',{hasText:new RegExp('^'+label+'$')})}).locator('dd'),values=async()=>Object.fromEntries(await page.locator('[data-control]').evaluateAll(inputs=>inputs.map(input=>[input.dataset.control,Number(input.value)])));
   const renderedPixels=()=>page.evaluate(async()=>{document.querySelector('[data-control="length"]').dispatchEvent(new Event('input',{bubbles:true}));const source=document.querySelector('canvas'),copy=new OffscreenCanvas(source.width,source.height),context=copy.getContext('2d');context.drawImage(source,0,0);const pixels=context.getImageData(0,0,copy.width,copy.height).data;if(!pixels.some((value,i)=>i%4===0&&value<100&&pixels[i+1]<100&&pixels[i+2]<100))throw new Error('rendered canvas must contain dark case or hook geometry');return {width:copy.width,height:copy.height,sha256:Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',pixels))).map(v=>v.toString(16).padStart(2,'0')).join('')};});
  await capture('opening');
  for(const [index,preset] of utilityLessons['Sewing machine'].tryIt.entries()){
   await page.locator('[data-labels]').check();await page.locator('button[data-label-part="handwheel"]').click();await page.locator('[data-labels]').uncheck();await page.locator('[data-isolate]').check();await page.locator('[data-cutaway]').uncheck();await page.locator('[data-view="top"]').click();await page.getByRole('tab',{name:'Try it yourself',exact:true}).click();await page.locator(`[data-experiment="${index}"]`).click();await page.getByRole('tab',{name:'Controls',exact:true}).click();assert.deepEqual(await values(),preset.values);assert.equal(await page.locator('[data-isolate]').isChecked(),false);assert.equal(await page.locator('[data-cutaway]').isChecked(),true);assert.equal(await page.locator('.daily-part-detail h3').count(),0);assert.equal(await page.locator('.daily-readings>div>p').count(),10);assert.match(await read('Your result').textContent(),/^0 lockstitches/);await capture('initial-'+index);const initial=await renderedPixels();await page.locator('[data-view="reset"]').click();await capture('view-check-'+index);assert.deepEqual(await renderedPixels(),initial,'parent preset restores exact rendered whole-machine view');
   if(index===4){assert.equal(await page.locator('[data-play]').isDisabled(),true);await page.locator('[data-step]').click();assert.equal(await read('Cycle position').textContent(),'0.0%');assert.equal(await read('Fabric progress').textContent(),'0.0 / 40 mm advanced');await capture('blocked-foot');await page.locator('[data-control="foot"]').selectOption('1');}
   await page.locator('[data-step]').click();assert.equal(await read('Fabric progress').textContent(),`${preset.values.length.toFixed(1)} / 40 mm advanced`);await capture('first-stitch-'+index);
   if(index===3){assert.match(await read('Your result').textContent(),/^0 lockstitches/);await page.locator('[data-control="threaded"]').selectOption('1');await page.locator('[data-step]').click();assert.equal(await read('Your result').textContent(),'1 lockstitch · 3.0 / 40 mm sewn');assert.equal(await read('Fabric progress').textContent(),'6.0 / 40 mm advanced');await capture('thread-recovered');}
   await page.locator('[data-number="rate"]').fill('3');assert.equal(await read('Sewing pace').textContent(),'180 cycles/min');await page.locator('[data-play]').click();await page.waitForTimeout(180);await page.getByRole('button',{name:'Pause',exact:true}).click();const paused=await read('Cycle position').textContent();await page.waitForTimeout(180);assert.equal(await read('Cycle position').textContent(),paused);await capture('paused-'+index);await page.locator('[data-play]').click();await page.locator('[data-play][title^="Play again"]').waitFor({timeout:30000});assert.equal(await read('Your result').textContent(),index===1?'8 lockstitches · 40.0 / 40 mm sewn':index===3?'13 lockstitches · 37.0 / 40 mm sewn':'14 lockstitches · 40.0 / 40 mm sewn');assert.equal(await read('Fabric progress').textContent(),'40.0 / 40 mm advanced');await capture('complete-'+index);await page.locator('[data-result]').click();assert.equal(await page.locator('[data-isolate]').isChecked(),true);assert.equal(await page.locator('.daily-part-detail h3').textContent(),'Completed lockstitches');await page.locator('[data-view="top"]').click();await capture('top-result-'+index);await page.locator('[data-view="bottom"]').click();await capture('bottom-result-'+index);await page.locator('[data-play]').evaluate(b=>{b.click();b.click()});assert.deepEqual(await values(),{...preset.values,rate:3,foot:1,threaded:1});assert.equal(await page.locator('[data-isolate]').isChecked(),false);assert.equal(await read('Fabric progress').textContent(),'0.0 / 40 mm advanced');assert.match(await read('Your result').textContent(),/^0 lockstitches/);await capture('replay-'+index);cases.push({width,preset:index,complete:true,missingGap:index===3,footRecovery:index===4,replay:true});
  }
  await page.locator('[data-reset-controls]').click();await page.locator('[data-labels]').check();await page.locator('button[data-label-part="take-up"]').click();await page.locator('[data-labels]').uncheck();await page.locator('[data-isolate]').check();await page.locator('[data-view="side"]').click();for(let i=0;i<5;i++)await page.getByRole('button',{name:'Next stitch stage',exact:true}).click();assert.equal(await read('Cycle position').textContent(),'84.0%');assert.equal(await read('Take-up eye lift').textContent(),'0.000 model units');await capture('take-up-dwell');await page.getByRole('button',{name:'Next stitch stage',exact:true}).click();assert.equal(await read('Cycle position').textContent(),'94.0%');assert.match(await read('What is happening').textContent(),/tightens/);assert.ok(parseFloat(await read('Take-up eye lift').textContent())>0);await capture('take-up-recovery');await page.getByRole('button',{name:'Next stitch stage',exact:true}).click();assert.equal(await read('Your result').textContent(),'1 lockstitch · 3.0 / 40 mm sewn');
  await page.locator('[data-view="reset"]').click();await page.locator('[data-separation]').fill('100');await page.getByText('Fully separated',{exact:true}).waitFor();await page.locator('[data-view="in"]').click();await page.locator('[data-view="out"]').click();assert.equal(await page.locator('[data-separation]').inputValue(),'100');await capture('separated');await page.locator('[data-reassemble]').click();assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
 }
 assert.equal(cases.length,10);assert.deepEqual(errors,[]);await writeFile(`${evidence}/browser.json`,JSON.stringify({cases,errors},null,2)+'\n');
 console.log('PASS sewing browser: completion, foot-up pause, persistent result, thread failure, fresh experiments, corner template, component lessons and mobile layout.');
}finally{await browser.close();}

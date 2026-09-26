import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {houseComponents} from './house-components.js';
import {crashSensorLesson as lesson} from './crash-sensor-lesson.js';
import {microchipDecelerationSensorLesson} from './microchip-deceleration-sensor-lesson.js';
import {neighborhoodCatalog} from './published-catalog.js';

const alias=houseComponents['Microchip deceleration sensor'];
assert.equal(alias.redirectTo,'crash-sensor');
assert.equal(neighborhoodCatalog.entries.find(e=>e.id===alias.redirectTo)?.name,'Crash sensor');
assert.equal(alias.lesson,lesson);assert.equal(microchipDecelerationSensorLesson,lesson);
assert.match(lesson.overview,/Microchip deceleration sensor names this same sensing device/);
for(const title of ['Work through the bridge at two milliseconds','Separate midpoint average from differential output'])assert.ok(lesson.deeper.some(d=>d.title===title));
assert.equal(lesson.tryIt.length,10);
console.log('PASS Microchip deceleration sensor: one published sensor, retained name and electrical explanations.');
if(process.env.MODEL_ONLY!=='1'){
 const {chromium}=await import('playwright'),browser=await chromium.launch({headless:true}),base=process.env.SITE_URL||'http://127.0.0.1:5193/',out=process.env.EVIDENCE_DIR||'/tmp/howthingswork-microchip-alias',cases=[],errors=[];await mkdir(out,{recursive:true});
 try{
  for(const width of [1440,390]){
   const page=await browser.newPage({viewport:{width,height:width===390?844:1000},reducedMotion:'reduce'});page.on('pageerror',e=>errors.push(e.message));
   const landed=async()=>{await page.waitForURL('**/#machine/crash-sensor');await page.getByRole('heading',{name:'Crash sensor',exact:true}).waitFor();assert.match(await page.locator('.daily-overview').innerText(),/Microchip deceleration sensor names this same sensing device/);assert.equal(await page.locator('.daily-part-path [data-parent]').last().getAttribute('data-parent'),'chip');assert.equal(await page.locator('[data-isolate]').isChecked(),true);assert.equal(await page.locator('.daily-related a[href="#machine/microchip-deceleration-sensor"]').count(),0);assert.equal(await page.locator('[data-experiment]').count(),10);assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));};
   const capture=async name=>{await page.mouse.move(0,0);await page.locator('canvas').evaluate(c=>c.scrollIntoView({block:'start',behavior:'instant'}));await page.waitForTimeout(150);await page.screenshot({path:out+'/'+name+'-'+width+'.png',clip:await page.locator('canvas').boundingBox()});};
   await page.goto(base+'#machine/microchip-deceleration-sensor');await landed();await capture('direct-opening');await page.getByText('Work through the bridge at two milliseconds',{exact:true}).click();assert.match(await page.locator('body').innerText(),/unrounded divider voltages/);await page.getByText('Separate midpoint average from differential output',{exact:true}).click();assert.match(await page.locator('body').innerText(),/10.89 mW/);cases.push({width,entry:'direct',naming:true,electricalContent:true});
   await page.getByRole('button',{name:'Back to The workshop',exact:true}).click();await page.getByRole('heading',{name:'The workshop',exact:true}).waitFor();// The alternate name is listed once, beneath the machine that holds it.
  assert.equal(await page.locator('button[data-entry="microchip-deceleration-sensor"]').count(),1);await page.locator('button[data-entry="crash-sensor"]').click();await landed();await capture('room-opening');await page.goBack();await page.getByRole('heading',{name:'The workshop',exact:true}).waitFor();await page.goForward();await landed();cases.push({width,entry:'room',backForward:true});
   await page.goto(base+'#list');await page.getByRole('heading',{name:'Explore the finished collection.',exact:true}).waitFor();await page.locator('#catalog-search').fill('Microchip deceleration sensor');const row=page.locator('tr').filter({has:page.locator('[data-entry="crash-sensor"]')});assert.equal(await row.locator('.catalog-components [data-entry="microchip-deceleration-sensor"]').count(),1);assert.equal(await page.locator('td>button[data-entry="microchip-deceleration-sensor"]').count(),0);await row.locator('[data-entry="crash-sensor"]').click();await landed();await capture('catalog-opening');await page.goBack();await page.getByRole('heading',{name:'Explore the finished collection.',exact:true}).waitFor();cases.push({width,entry:'catalog',canonical:true,back:true});
   await page.goto(base+'#machine/crash-sensor-proof-square-and-sensing-strips');await page.getByRole('heading',{name:'Crash-sensor proof square and sensing strips',exact:true}).waitFor();await page.locator('.daily-related a[href="#machine/microchip-deceleration-sensor"]').click();await landed();await capture('related-opening');await page.goBack();await page.getByRole('heading',{name:'Crash-sensor proof square and sensing strips',exact:true}).waitFor();cases.push({width,entry:'related',back:true});await page.close();
  }
  assert.equal(cases.length,8);assert.deepEqual(errors,[]);await writeFile(out+'/browser.json',JSON.stringify({base,cases,errors},null,2)+'\n');console.log('PASS eight desktop/phone direct, room, catalog and related-link paths; history, naming and merged electrical content.');
 }finally{await browser.close();}
}

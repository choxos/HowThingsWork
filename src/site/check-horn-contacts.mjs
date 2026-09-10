import assert from 'node:assert/strict';
import {chromium} from 'playwright';

const browser=await chromium.launch({headless:true}),page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];
page.on('pageerror',error=>errors.push(error.message));
try{
 await page.goto(`${process.env.SITE_URL||'http://127.0.0.1:5175/'}#machine/horn-make-and-break-contacts`);
 await page.getByRole('heading',{name:'Horn make-and-break contacts',exact:true}).waitFor();
 const isolated=page.getByRole('checkbox',{name:'Isolate selected part',exact:true}),detail=page.locator('.daily-part-detail');
 assert.equal(await isolated.isChecked(),false);assert.match(await detail.textContent(),/Mechanically operated contact breaker/);
 for(const [index,outcome] of [[0,'9 diaphragm cycles · sustained tone produced'],[1,'No sustained tone'],[2,'No sustained tone']]){
  await page.getByRole('tab',{name:'Try it yourself',exact:true}).click();
  await page.getByRole('button',{name:'Set up this experiment',exact:true}).nth(index).click();
  await page.getByRole('tab',{name:'Controls',exact:true}).click();
  assert.equal(await isolated.isChecked(),false);assert.match(await detail.textContent(),/Mechanically operated contact breaker/);
  await page.getByRole('button',{name:'Advance one step',exact:true}).click();
  assert.match(await page.locator('.daily-readings').textContent(),/Watching the diaphragm build motion|Steady magnetic pull|Open circuit/);
  await page.getByRole('button',{name:'Sound the horn',exact:true}).click();
  await page.waitForFunction(text=>document.querySelector('.daily-readings')?.textContent.includes(text)&&document.querySelector('[data-play]')?.getAttribute('aria-pressed')==='false',outcome);
  assert.match(await detail.textContent(),/Connected electric horn/);
 }
 await isolated.check();await page.getByRole('button',{name:'Reset experiment',exact:true}).click();
 assert.equal(await isolated.isChecked(),false);assert.match(await detail.textContent(),/Mechanically operated contact breaker/);
 await page.getByRole('button',{name:'The insulated actuator on the moving iron bar.',exact:true}).click();
 assert.match(await page.locator('.daily-answer').textContent(),/That’s right/);
 await page.locator('.daily-related a').filter({hasText:'Electromagnetic make-and-break contacts'}).click();
 await page.getByRole('heading',{name:'Electromagnetic make-and-break contacts',exact:true}).waitFor();
 assert.match(await detail.textContent(),/contact/i);
 await page.locator('.daily-related a').filter({hasText:'Horn make-and-break contacts'}).click();
 await page.getByRole('heading',{name:'Horn make-and-break contacts',exact:true}).waitFor();
 assert.match(await detail.textContent(),/Mechanically operated contact breaker/);
 assert.equal(await page.locator('.daily-related a').filter({hasText:'Electromagnetic make-and-break contacts'}).count(),1);
 await page.screenshot({path:'/tmp/howthingswork-horn-contacts-lesson.png',fullPage:true});
 await page.setViewportSize({width:390,height:844});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
 assert.deepEqual(errors,[]);
 console.log('PASS horn contacts browser: dedicated connected route, three stepped experiments and whole-horn outcomes, reset context, quiz and mobile.');
}finally{await browser.close();}

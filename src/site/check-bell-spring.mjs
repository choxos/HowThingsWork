import assert from 'node:assert/strict';
import {chromium} from 'playwright';

const browser=await chromium.launch({headless:true}),page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];
page.on('pageerror',error=>errors.push(error.message));
try{
 await page.goto(`${process.env.SITE_URL||'http://127.0.0.1:5175/'}#machine/electric-bell-return-spring`);
 await page.getByRole('heading',{name:'Electric-bell return spring',exact:true}).waitFor();
 const isolated=page.getByRole('checkbox',{name:'Isolate selected part',exact:true}),detail=page.locator('.daily-part-detail');
 assert.equal(await isolated.isChecked(),false);assert.match(await detail.textContent(),/Torsion return spring/);
 for(const [index,outcome] of [[0,'3 strikes · the bell rang repeatedly'],[1,'One strike · no repeated ringing'],[2,'No strikes · the bell stayed quiet']]){
  await page.getByRole('tab',{name:'Try it yourself',exact:true}).click();
  await page.getByRole('button',{name:'Set up this experiment',exact:true}).nth(index).click();
  await page.getByRole('tab',{name:'Controls',exact:true}).click();
  assert.equal(await isolated.isChecked(),false);assert.match(await detail.textContent(),/Torsion return spring/);
  await page.getByRole('button',{name:'Advance one step',exact:true}).click();
  assert.match(await page.locator('.daily-readings').textContent(),/Button held/);
  await page.getByRole('button',{name:'Ring the bell',exact:true}).click();
  await page.waitForFunction(text=>document.querySelector('.daily-readings')?.textContent.includes(text)&&document.querySelector('[data-play]')?.getAttribute('aria-pressed')==='false',outcome);
  assert.match(await detail.textContent(),/Connected electric bell/);
 }
 await isolated.check();await page.getByRole('button',{name:'Reset experiment',exact:true}).click();
 assert.equal(await isolated.isChecked(),false);assert.match(await detail.textContent(),/Torsion return spring/);
 await page.getByRole('button',{name:'It remains loaded while the magnet holds the armature inward.',exact:true}).click();
 assert.match(await page.locator('.daily-answer').textContent(),/That’s right/);
 await page.screenshot({path:'/tmp/howthingswork-bell-spring-lesson.png',fullPage:true});
 await page.setViewportSize({width:390,height:844});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
 assert.deepEqual(errors,[]);
 console.log('PASS bell spring browser: dedicated connected route, three stepped experiments and whole-bell outcomes, reset context, quiz and mobile.');
}finally{await browser.close();}

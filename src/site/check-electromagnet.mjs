import assert from 'node:assert/strict';
import {chromium} from 'playwright';
const browser=await chromium.launch({headless:true}),page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];
page.on('pageerror',e=>errors.push(e.message));
try{
 await page.goto(`${process.env.SITE_URL||'http://127.0.0.1:5175/'}#machine/electromagnet`);
 await page.getByRole('heading',{name:'Electromagnet',exact:true}).waitFor();
 const play=()=>page.getByRole('button',{name:'Run selected action',exact:true}).click();
 const wait=text=>page.waitForFunction(t=>document.querySelector('.daily-readings')?.textContent.includes(t)&&document.querySelector('[data-play]')?.getAttribute('aria-pressed')==='false',text,{timeout:60000});
 for(const [i,outcome] of [[0,'Lifted · plate held above the tray'],[1,'No lift · attraction cannot raise this load'],[2,'Lifted · plate held above the tray'],[3,'No lift · nonmagnetic load'],[4,'No lift · attraction cannot raise this load']]){
  await page.getByRole('tab',{name:'Try it yourself',exact:true}).click();await page.getByRole('button',{name:'Set up this experiment',exact:true}).nth(i).click();await page.getByRole('tab',{name:'Controls',exact:true}).click();
  assert.match(await page.locator('.daily-readings').textContent(),/Ready · plate rests in the tray/);
  await play();try{await wait(outcome);}catch(error){console.error('Preset',i,await page.locator('.daily-readings').textContent());throw error;}console.log('PASS preset',i);
  if(i===0||i===2){assert.ok(Math.abs(Number((await page.locator('.daily-readings').textContent()).match(/Load above tray([\d.]+) mm/)[1])-42)<.02);assert.match(await page.locator('.daily-readings').textContent(),i===0?/Center N · outer ring S/:/Center S · outer ring N/);await page.getByRole('combobox',{name:'Run action',exact:true}).selectOption('1');await play();await wait('Released · plate rests in the tray');assert.match(await page.locator('.daily-readings').textContent(),/Load above tray0.00 mm/);}
  if(i===3)assert.match(await page.locator('.daily-readings').textContent(),/2.00 A/);
 }
 await page.getByRole('button',{name:'Reset experiment',exact:true}).click();await page.getByRole('button',{name:'Advance one step',exact:true}).click();assert.doesNotMatch(await page.locator('.daily-readings').textContent(),/Ready · plate rests in the tray/);
 await page.getByRole('button',{name:'Return load to starting tray',exact:true}).click();assert.match(await page.locator('.daily-readings').textContent(),/Ready · plate rests in the tray/);
 await page.getByRole('button',{name:'The poles reverse, but the iron is still attracted.',exact:true}).click();assert.match(await page.locator('.daily-answer').textContent(),/That’s right/);
 await page.setViewportSize({width:390,height:844});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));assert.deepEqual(errors,[]);
 console.log('PASS electromagnet browser: all five presets, held height and poles, both releases, powered nonmagnetic failure, step, tray reset, quiz and mobile.');
}finally{await browser.close();}

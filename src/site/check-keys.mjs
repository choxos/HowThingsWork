import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {createCylinderModel} from './cylinder-model.js';
const m=createCylinderModel({editableKey:true});
for(let selectedPin=1;selectedPin<=5;selectedPin++)for(const cutError of [-.2,-.12,.12,.2]){
 m.reset();m.update({selectedPin,cutError});m.advance(10);const state=m.getState();
 assert.equal(state.blocked,true);assert.equal(state.turn,0);assert.equal(state.doorAngle,0);assert.equal(state.pinOffsets.filter(x=>Math.abs(x)>1e-6).length,1);
 assert.equal(Math.sign(state.pinOffsets[selectedPin-1]),Math.sign(cutError));
 m.update({selectedPin:6-selectedPin,cutError:0});assert.equal(m.getState().values.selectedPin,selectedPin);assert.equal(m.getState().values.cutError,cutError);
 m.update({insertion:0});m.update({cutError:0});m.advance(10);assert.equal(m.getState().doorAngle,65);
}
m.reset();m.advance(10);m.update({cutError:.12,selectedPin:1,insertion:0});assert.equal(m.getState().values.cutError,0);assert.equal(m.getState().values.selectedPin,3);assert.equal(m.getState().values.insertion,1);
m.update({operation:1});m.advance(10);assert.equal(m.getState().complete,true);assert.equal(m.getState().values.insertion,0);
m.update({selectedPin:5,cutError:.2});m.reset();assert.equal(m.getState().values.selectedPin,3);assert.equal(m.getState().values.cutError,0);m.advance(10);assert.equal(m.getState().doorAngle,65);m.dispose();
const browser=await chromium.launch({headless:true}),page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];
page.on('pageerror',e=>errors.push(e.message));
try{
 await page.goto(`${process.env.SITE_URL||'http://127.0.0.1:5175/'}#machine/keys`);await page.getByRole('heading',{name:'Keys',exact:true}).waitFor();
 for(const index of [1,2]){
  await page.getByRole('tab',{name:'Try it yourself',exact:true}).click();await page.getByRole('button',{name:'Set up this experiment',exact:true}).nth(index).click();await page.getByRole('tab',{name:'Controls',exact:true}).click();await page.getByRole('button',{name:'Run selected action',exact:true}).click();
  await page.waitForFunction(()=>document.querySelector('[data-number="insertion"]').value==='1');assert.match(await page.locator('.daily-readings').textContent(),/1 of 5 joints away/);assert.match(await page.locator('.daily-readings').textContent(),/Actual plug turn0°/);assert.equal(await page.getByRole('spinbutton',{name:'Change selected cut value',exact:true}).isDisabled(),true);
  await page.getByRole('button',{name:'Pin stack 3',exact:true}).click();await page.getByRole('checkbox',{name:'Isolate selected part',exact:true}).check();await page.screenshot({path:`/tmp/howthingswork-key-cut-${index}.png`,fullPage:true});
 }
 await page.getByRole('tab',{name:'Try it yourself',exact:true}).click();await page.getByRole('button',{name:'Set up this experiment',exact:true}).nth(3).click();await page.getByRole('tab',{name:'Controls',exact:true}).click();await page.getByRole('spinbutton',{name:'Change selected cut value',exact:true}).fill('0');await page.getByRole('button',{name:'Run selected action',exact:true}).click();await page.waitForFunction(()=>document.querySelector('[data-number="door"]').value==='65');assert.match(await page.locator('.daily-readings').textContent(),/Door open/);await page.screenshot({path:'/tmp/howthingswork-key-repaired-open.png',fullPage:true});
 await page.getByRole('combobox',{name:'Run action',exact:true}).selectOption('1');await page.getByRole('button',{name:'Run selected action',exact:true}).click();await page.waitForFunction(()=>document.querySelector('.daily-readings').textContent.includes('Door secured · key removed'));assert.equal(await page.getByRole('spinbutton',{name:'Change selected cut value',exact:true}).isDisabled(),false);
 await page.getByRole('button',{name:'Only one pattern places every pin joint correctly.',exact:true}).click();assert.match(await page.locator('.daily-answer').textContent(),/That’s right/);await page.getByRole('button',{name:'Reset experiment',exact:true}).click();assert.equal(await page.getByRole('spinbutton',{name:'Change selected cut value',exact:true}).inputValue(),'0');
 await page.setViewportSize({width:390,height:844});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
 await page.setViewportSize({width:1440,height:1000});await page.goto(`${process.env.SITE_URL||'http://127.0.0.1:5175/'}#machine/lever-lock-key`);await page.getByRole('heading',{name:'Lever-lock key',exact:true}).waitFor();
 await page.getByRole('tab',{name:'Try it yourself',exact:true}).click();await page.getByRole('button',{name:'Set up this experiment',exact:true}).nth(0).click();await page.getByRole('tab',{name:'Controls',exact:true}).click();await page.getByRole('button',{name:'Run selected action',exact:true}).click();await page.waitForFunction(()=>document.querySelector('[data-number="turn"]').value==='180');assert.equal(await page.getByRole('spinbutton',{name:'Open the door value',exact:true}).inputValue(),'0');
 await page.getByRole('tab',{name:'Try it yourself',exact:true}).click();await page.getByRole('button',{name:'Set up this experiment',exact:true}).nth(1).click();await page.getByRole('tab',{name:'Controls',exact:true}).click();await page.getByRole('button',{name:'Advance the lock',exact:true}).click();assert.equal(await page.getByRole('spinbutton',{name:'Turn the key value',exact:true}).inputValue(),'147');assert.match(await page.locator('.daily-readings').textContent(),/Bolt retraction0%/);
 await page.getByRole('tab',{name:'Try it yourself',exact:true}).click();await page.getByRole('button',{name:'Set up this experiment',exact:true}).nth(2).click();await page.getByRole('tab',{name:'Controls',exact:true}).click();await page.getByRole('button',{name:'Run selected action',exact:true}).click();await page.waitForFunction(()=>document.querySelector('[data-number="door"]').value==='65');assert.equal(await page.getByRole('spinbutton',{name:'Key insertion value',exact:true}).inputValue(),'0');await page.screenshot({path:'/tmp/howthingswork-lever-key-open.png',fullPage:true});
 await page.getByRole('button',{name:'Continue until its drive roller contacts the slot wall.',exact:true}).click();assert.match(await page.locator('.daily-answer').textContent(),/That’s right/);await page.getByRole('button',{name:'Reset experiment',exact:true}).click();assert.equal(await page.getByRole('spinbutton',{name:'Turn the key value',exact:true}).inputValue(),'0');
 await page.setViewportSize({width:390,height:844});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));assert.deepEqual(errors,[]);
 console.log('PASS Keys: all five edited positions, high/low obstruction, immutable seated shape, repaired opening, return/reset, lever-key drive and withdrawal, both quizzes/mobile.');
}finally{await browser.close();}

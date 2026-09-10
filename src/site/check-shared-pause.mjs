import assert from 'node:assert/strict';
import {chromium} from 'playwright';
const browser=await chromium.launch({headless:true}),page=await browser.newPage(),errors=[];
page.on('pageerror',error=>errors.push(error.message));
try{
 await page.route('**/pause-fixture',route=>route.fulfill({contentType:'text/html',body:'<!doctype html><div id="fixture" style="width:900px"></div>'}));
 await page.goto(new URL('pause-fixture',process.env.SITE_URL||'http://127.0.0.1:5179/').href);
 const observed=await page.evaluate(async()=>{
  const [{mountDailyLifeViewer},{houseModel,reading}]=await Promise.all([import('/src/site/daily-life-viewer.js'),import('/src/site/house-model-kit.js')]);
  const kit=houseModel('Pause fixture');kit.part('body','Body','Fixture geometry');kit.box([1,1,1],[0,0,0],'leaf');kit.control('setting','Setting',0,1,1,0);let ticks=0;
  const model=kit.finish(()=>({state:{ticks},readings:[reading('Observed ticks',String(ticks))]}));model.animate=()=>model.update();model.playback={label:'Run fixture',stepLabel:'Step fixture',advance:()=>{ticks++;return model.update();},step:()=>model.update(),complete:()=>false,blocked:()=>false};
  const nativeRequest=requestAnimationFrame,nativeCancel=cancelAnimationFrame;let scheduled;
  window.requestAnimationFrame=callback=>{scheduled=callback;return 1;};window.cancelAnimationFrame=()=>{scheduled=undefined;};
  const host=document.querySelector('#fixture'),viewer=mountDailyLifeViewer(host,'Pause fixture',model),play=host.querySelector('[data-play]'),read=()=>host.querySelector('.daily-readings dd').textContent;
  play.click();const time=performance.now()+300;scheduled(time);const afterFirst=read();scheduled(time+50);const beforePause=read(),actualBeforePause=model.getState().ticks;play.click();const afterPause=read(),actualAfterPause=model.getState().ticks;
  viewer.apply({setting:1});const afterControl=read();viewer.dispose();window.requestAnimationFrame=nativeRequest;window.cancelAnimationFrame=nativeCancel;
  return {afterFirst,beforePause,actualBeforePause,afterPause,actualAfterPause,afterControl};
 });
 assert.equal(observed.afterFirst,'1');assert.equal(observed.beforePause,'1','the second frame falls inside the display throttle');assert.equal(observed.actualBeforePause,2);assert.equal(observed.afterPause,'2','pause flushes the final modeled state');assert.equal(observed.actualAfterPause,2);assert.equal(observed.afterControl,'2','a later control cannot appear to advance a paused model');assert.deepEqual(errors,[]);console.log('PASS shared pause flushes the stopped state before a later control update');
}finally{await browser.close();}

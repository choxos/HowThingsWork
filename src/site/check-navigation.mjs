import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {neighborhoodCatalog as catalog} from './published-catalog.js';
const base=process.env.SITE_URL||'http://127.0.0.1:5175/';
const browser=await chromium.launch({channel:'chrome',headless:true});
const page=await browser.newPage({viewport:{width:1440,height:1000},reducedMotion:'reduce',hasTouch:true}),errors=[];
page.on('pageerror',e=>errors.push(e.message));
const visit=async route=>{await page.goto('about:blank');await page.goto(new URL('#'+route,base).href);await page.locator('h1').waitFor();await page.locator('.house-zoom-controls, .daily-operation-tabs').first().waitFor();};
try{
 await visit('place/home');
 const rooms=await page.locator('.house-zoom-controls option').allTextContents();
 assert.equal(rooms.length,new Set(catalog.groups.filter(g=>g.place==='home').map(g=>g.room)).size);
 for(let i=0;i<rooms.length;i++){
  await visit('place/home');await page.getByRole('combobox',{name:'Look toward'}).selectOption(String(i));
  const roomRoute=await page.locator('[data-zoom-target][data-selected]').getAttribute('href');
  await page.getByRole('button',{name:'Zoom in',exact:true}).click();await page.waitForURL('**'+roomRoute);await page.locator('.house-room-pin').first().waitFor({state:'detached'});
  await page.locator('.house-zoom-controls').waitFor();const options=await page.locator('.house-zoom-controls option').count();
  await page.getByRole('combobox',{name:'Look toward'}).selectOption(String(options-1));
  const target=page.locator('[data-zoom-target][data-selected]');assert.equal(await target.isVisible(),true);
  const machineRoute=await target.getAttribute('href');await page.getByRole('button',{name:'Zoom in',exact:true}).click();await page.waitForURL('**'+machineRoute);await page.locator('.daily-canvas-wrap canvas').waitFor();
  await page.locator('.daily-return').click();await page.waitForURL('**'+roomRoute);
 }
 await visit('place/home');await page.locator('.house-room-pin').filter({hasText:'Kitchen'}).hover();
 for(let i=0;i<6;i++)await page.mouse.wheel(0,-100);await page.waitForURL('**#room/kitchen');await page.locator('.house-room-pin').first().waitFor({state:'detached'});
 await page.locator('.house-zoom-controls').waitFor();await page.waitForTimeout(300);
 await page.getByRole('combobox',{name:'Look toward'}).selectOption('0');
 const first=page.locator('[data-zoom-target][data-selected]'),firstRoute=await first.getAttribute('href');await first.hover();
 for(let i=0;i<6;i++)await page.mouse.wheel(0,-100);await page.waitForURL('**'+firstRoute);
 await visit('room/kitchen');await page.getByRole('button',{name:'Zoom out',exact:true}).click();await page.waitForURL('**#place/home');
 await page.locator('.house-room-pin').first().waitFor();await page.locator('.house-zoom-controls').waitFor();
 await page.getByRole('combobox',{name:'Look toward'}).selectOption('0');
 const keyboardRoute=await page.locator('[data-zoom-target][data-selected]').getAttribute('href');await page.locator('.house-zoom-scene').focus();await page.keyboard.press('+');await page.waitForURL('**'+keyboardRoute);
 // Machine +/- change camera scale only. Wheel changes grouped separation and never leaves the machine.
 await visit('machine/electric-bell');const canvas=page.locator('canvas'),separation=page.locator('[data-separation]');
 for(const amount of ['0','100']){
  await separation.fill(amount);
  for(const direction of ['out','in']){const before=await canvas.screenshot();await page.locator('[data-view="'+direction+'"]').click();assert.ok(!before.equals(await canvas.screenshot()),direction+' changes rendered camera scale');assert.equal(await separation.inputValue(),amount);assert.equal(new URL(page.url()).hash,'#machine/electric-bell');}
 }
 await page.locator('[data-reassemble]').click();await canvas.hover();await page.mouse.wheel(0,240);
 await page.waitForFunction(()=>Number(document.querySelector('[data-separation]').value)>0);
 await separation.fill('100');await canvas.hover();await page.mouse.wheel(0,400);assert.equal(new URL(page.url()).hash,'#machine/electric-bell');
 await page.mouse.wheel(0,-900);await page.waitForFunction(()=>Number(document.querySelector('[data-separation]').value)<100);
 // Native touch follows the same rule, including gestures beginning over category labels.
 await page.setViewportSize({width:390,height:844});await separation.fill('100');await canvas.scrollIntoViewIfNeeded();
 const cdp=await page.context().newCDPSession(page),b=await canvas.boundingBox(),x=b.x+b.width/2,y=b.y+b.height/2;
 async function pinch(from,to){
  const points=r=>[{x:x-r,y,id:1},{x:x+r,y,id:2}];
  await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:points(from)});
  for(let i=1;i<=12;i++)await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:points(from+(to-from)*i/12)});
  await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
 }
 await pinch(20,140);await page.waitForFunction(()=>Number(document.querySelector('[data-separation]').value)<100);
 await separation.fill('0');await pinch(140,20);await page.waitForFunction(()=>Number(document.querySelector('[data-separation]').value)>0);
 assert.equal(new URL(page.url()).hash,'#machine/electric-bell');assert.equal(await page.evaluate(()=>visualViewport.scale),1);
 assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
 await page.locator('.daily-return').click();await page.waitForURL('**#room/doors-and-daily-life');
 await page.getByRole('button',{name:'Zoom out',exact:true}).click();await page.waitForURL('**#place/home');
 await page.getByRole('button',{name:'Zoom out',exact:true}).click();await page.waitForURL('**#neighborhood');
 assert.deepEqual(errors,[]);
 const report={base,result:'PASS',rooms:rooms.length,roomDestinations:true,backButtons:true,keyboard:true,wheel:true,nativePinch:true,plusMinusZoomOnly:true,errors};
 if(process.env.EVIDENCE_DIR){await mkdir(process.env.EVIDENCE_DIR,{recursive:true});await writeFile(process.env.EVIDENCE_DIR+'/navigation.json',JSON.stringify(report,null,2)+'\n');}
 console.log(JSON.stringify(report));
}finally{await browser.close();}

import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {chromium} from 'playwright';

const base=process.env.SITE_URL||'http://127.0.0.1:5193/',out=process.env.EVIDENCE_DIR||'/tmp/howthingswork-pinch-labels';
await mkdir(out,{recursive:true});
const browser=await chromium.launch({headless:true}),page=await browser.newPage({hasTouch:true,reducedMotion:'reduce'}),session=await page.context().newCDPSession(page),observations=[],errors=[];
page.on('pageerror',error=>errors.push(error.message));
async function pinch(from,to){
 await page.locator('canvas').scrollIntoViewIfNeeded();const box=await page.locator('canvas').boundingBox(),x=box.x+box.width/2,y=box.y+box.height/2;
 await session.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:x-from,y,id:0},{x:x+from,y,id:1}]});
 for(let i=1;i<=12;i++){const distance=from+(to-from)*i/12;await session.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:x-distance,y,id:0},{x:x+distance,y,id:1}]});}
 await session.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
}
try{
 for(const width of [1440,390])for(const [id,part] of [['lever-lock-key','key-shoulder-2'],['circuit-breaker','plunger']]){
  await page.setViewportSize({width,height:width===390?844:1000});await page.goto(base+'#machine/'+id);await page.locator('canvas').waitFor();
  for(const input of ['mouse','touch']){
   await page.locator('[data-labels]').uncheck();await page.locator('[data-view="reset"]').click();await pinch(145,35);
   assert(Number(await page.locator('[data-separation]').inputValue())>0,'Real pinch separates parts');
   await pinch(35,145);assert.equal(await page.locator('[data-separation]').inputValue(),'0','Reverse pinch reassembles');
   assert.equal(await page.locator('.daily-part-detail h3').count(),0,'Pinch does not select a part');assert.equal(await page.locator('.daily-part-popup').isVisible(),false,'Pinch does not open a popup');
   await page.locator('[data-labels]').check();const label=page.locator(`button[data-label-part="${part}"]`),name=await label.textContent();
   if(input==='mouse')await label.click();else await label.tap();
   assert.equal(await label.getAttribute('aria-pressed'),'true','First '+input+' label click after pinch selects '+part);
   assert.equal(await page.locator('.daily-part-detail h3').textContent(),name);await page.locator('[data-isolate]').check();await page.keyboard.press('Escape');
   assert.equal(await page.locator('.daily-part-detail h3').count(),0);assert.equal(await page.locator('[data-isolate]').isChecked(),false);
   await label.click();await page.locator('.daily-heading h1').click();assert.equal(await page.locator('.daily-part-detail h3').count(),0,'Outside click clears selection');
   observations.push({id,width,input,selected:name,pinchDoesNotSelect:true,escapeClears:true,outsideClears:true});
  }
 }
 assert.deepEqual(errors,[]);console.log('PASS pinch to labels:',observations.length,'real mouse/touch cases; selection, Escape, outside dismissal and no ghost pinch selection.');
}catch(error){await writeFile(out+'/failure.json',JSON.stringify({url:page.url(),error:String(error),observations},null,2));await page.screenshot({path:out+'/failure.png',fullPage:true});throw error;}
finally{await writeFile(out+'/browser.json',JSON.stringify({observations,errors},null,2)+'\n');await browser.close();}

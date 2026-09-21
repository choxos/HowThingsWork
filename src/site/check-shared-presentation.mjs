import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {chromium} from 'playwright';
const base=process.env.SITE_URL||'http://127.0.0.1:5193/';
const output=process.env.EVIDENCE_DIR||'/tmp/htw-shared-presentation';
await mkdir(output,{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true});
const page=await browser.newPage({viewport:{width:1440,height:1000},hasTouch:true,reducedMotion:'reduce'}),errors=[],observations=[];
page.on('pageerror',error=>errors.push(error.message));
const visit=async id=>{await page.goto(new URL('#machine/'+id,base).href);await page.locator('canvas').waitFor();};
async function reachable(locator){
 await locator.waitFor({state:'visible'});
 assert.ok(await locator.evaluate(el=>{const b=el.getBoundingClientRect(),target=document.elementFromPoint(b.x+b.width/2,b.y+b.height/2);return b.top>=0&&b.bottom<=innerHeight+1&&el.contains(target);}),await locator.textContent());
}
try{
 await visit('refrigerant-compressor');
 assert.equal(await page.locator('.daily-mobile-tools').isVisible(),false);
 const back=await page.locator('.daily-return').boundingBox(),guide=await page.locator('.daily-guide').boundingBox();
 assert.ok(Math.abs(back.x-guide.x)<2&&back.y+back.height<=guide.y,'Back button above left column');
 for(const selector of ['.daily-guide','.daily-operation']){
  await page.locator(selector).evaluate(el=>el.scrollTop=el.scrollHeight);
  const column=await page.locator(selector).boundingBox(),tabs=page.locator(selector+' > .daily-operation-tabs'),b=await tabs.boundingBox();
  assert.ok(Math.abs(b.y-column.y)<2,selector+' tabs remain visible at end of panel');
  await reachable(tabs.getByRole('tab').first());
 }
 const contrast=await page.locator('footer').evaluate(el=>{
  const rgb=s=>s.match(/[\d.]+/g).slice(0,3).map(Number);
  const luminance=color=>rgb(color).reduce((sum,v,i)=>sum+[.2126,.7152,.0722][i]*(v/255<=.04045?v/255/12.92:((v/255+.055)/1.055)**2.4),0);
  const fg=getComputedStyle(el).color,bg=getComputedStyle(document.body).backgroundColor,a=luminance(fg),b=luminance(bg);
  return {fg,bg,ratio:(Math.max(a,b)+.05)/(Math.min(a,b)+.05)};
 });assert.ok(contrast.ratio>=4.5,JSON.stringify(contrast));
 assert.equal(await page.locator('.daily-operation').evaluate(el=>getComputedStyle(el).scrollbarWidth),'thin');
 observations.push({width:1440,stickyPanels:2,backAboveGuide:true,contrast});
 await page.screenshot({path:output+'/desktop.png'});
 for(const viewport of [{width:390,height:844},{width:320,height:568},{width:650,height:390}]){
  await page.setViewportSize(viewport);await visit('3d-printer');await page.locator('[data-separation]').fill('100');
  const tools=page.getByRole('navigation',{name:'Lesson tools'});
  for(const [label,tabId] of [['Try it yourself','operation-tab-1'],['Controls','operation-tab-0'],['How it works','guide-tab-0']]){
   await tools.getByRole('button',{name:label,exact:true}).click();
   const tab=page.locator('#'+tabId);assert.equal(await tab.getAttribute('aria-selected'),'true');assert.equal(await tab.evaluate(el=>el===document.activeElement),true);
   await reachable(tab);
   assert.equal(await page.locator('[data-separation]').inputValue(),'100','tool navigation preserves separation');
  }
  await tools.getByRole('button',{name:'Try it yourself',exact:true}).click();
  await page.getByRole('button',{name:'Set up this experiment',exact:true}).first().click();
  await tools.getByRole('button',{name:'Controls',exact:true}).click();
  await page.getByRole('tab',{name:'Controls',exact:true}).focus();await page.keyboard.press('ArrowRight');
  assert.equal(await page.locator('#operation-tab-1').getAttribute('aria-selected'),'true');
  await tools.getByRole('button',{name:'How it works',exact:true}).click();await page.keyboard.press('ArrowRight');
  assert.equal(await page.getByRole('tab',{name:'Meet the parts',exact:true}).getAttribute('aria-selected'),'true');
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
  observations.push({...viewport,shortcuts:3,fullySeparated:true,keyboardTabs:true});
  await page.screenshot({path:output+'/phone-'+viewport.width+'x'+viewport.height+'.png'});
 }
 // Route disposal and resize must leave one current toolbar, with no stale height.
 await page.setViewportSize({width:1440,height:1000});await visit('mirrors');
 assert.equal(await page.locator('.daily-mobile-tools').count(),1);assert.equal(await page.locator('.daily-mobile-tools').isVisible(),false);
 assert.equal(await page.locator('.daily-canvas-wrap').evaluate(el=>getComputedStyle(el).position),'relative');
 await page.setViewportSize({width:390,height:844});await page.emulateMedia({reducedMotion:'no-preference'});
 await page.getByRole('navigation',{name:'Lesson tools'}).getByRole('button',{name:'How it works',exact:true}).click();
 await page.waitForFunction(()=>{const b=document.querySelector('#guide-tab-0').getBoundingClientRect();return b.top>=61&&b.top<90;});
 await reachable(page.locator('#guide-tab-0'));
 assert.deepEqual(errors,[]);
 const report={base,result:'PASS',observations,normalAndReducedMotion:true,errors};await writeFile(output+'/shared-presentation.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));
}finally{await browser.close();}

import assert from 'node:assert/strict';
import {chromium} from 'playwright';

const browser=await chromium.launch({headless:true}),page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];
page.on('pageerror',error=>errors.push(error.message));
await page.addInitScript(()=>{
 const Native=window.AudioContext;window.hornAudio={contexts:[],peak:0,recent:0};
 window.AudioContext=class extends Native{constructor(...args){super(...args);window.hornAudio.contexts.push(this);const analyser=this.createAnalyser();analyser.connect(this.destination);const buffer=new Float32Array(analyser.fftSize);const timer=setInterval(()=>{if(this.state==='closed'){clearInterval(timer);return;}analyser.getFloatTimeDomainData(buffer);window.hornAudio.recent=Math.max(...buffer.map(Math.abs));window.hornAudio.peak=Math.max(window.hornAudio.peak,window.hornAudio.recent);},10);const createGain=this.createGain.bind(this);this.createGain=()=>{const gain=createGain(),connect=gain.connect.bind(gain);gain.connect=target=>connect(target===this.destination?analyser:target);return gain;};}};
});
const reading=label=>page.locator('.daily-readings > div').filter({has:page.getByText(label,{exact:true})}).locator('dd').textContent();
const play=()=>page.getByRole('button',{name:'Sound the horn',exact:true}).click();
const finish=()=>page.waitForFunction(()=>document.querySelector('[data-play]')?.getAttribute('aria-pressed')==='false'&&document.querySelector('.daily-readings')?.textContent.includes('ButtonReleased'));
try{
 await page.goto(`${process.env.SITE_URL||'http://127.0.0.1:5175/'}#machine/electric-horn`);
 await page.getByRole('heading',{name:'Electric horn',exact:true}).waitFor();
 assert.equal(await page.locator('.house-breadcrumbs a[href="#place/workshop"]').count(),1,'horn belongs to the workshop');
 assert.equal(await page.locator('.house-breadcrumbs a[href="#place/home"]').count(),0);
 assert.equal(await page.evaluate(()=>window.hornAudio.contexts.length),0,'sound requires opt-in');
 await page.getByRole('combobox',{name:'Horn sound',exact:true}).selectOption('1');await play();
 await page.waitForFunction(()=>window.hornAudio.recent>.001);
 await page.getByRole('button',{name:'Pause',exact:true}).click();
 await page.waitForTimeout(180);assert.ok(await page.evaluate(()=>window.hornAudio.recent<.00001),'pause silences real output');
 const pausedCycles=await reading('Diaphragm cycles');await page.waitForTimeout(150);assert.equal(await reading('Diaphragm cycles'),pausedCycles);
 await page.getByRole('button',{name:'Advance one step',exact:true}).click();await page.waitForTimeout(100);assert.ok(await page.evaluate(()=>window.hornAudio.recent<.00001),'stepping remains silent');
 await play();await page.waitForFunction(()=>window.hornAudio.recent>.001);await finish();
 assert.match(await reading('Your result'),/sustained tone produced/);assert.ok(Number(await reading('Diaphragm cycles'))>3);
 assert.match(await page.locator('.daily-part-detail').textContent(),/Connected electric horn/);
 await page.waitForTimeout(150);assert.ok(await page.evaluate(()=>window.hornAudio.recent<.00001),'completion silences output');
 await page.screenshot({path:'/tmp/howthingswork-horn-result.png',fullPage:true});
 await play();assert.equal(await page.getByRole('combobox',{name:'Horn sound',exact:true}).inputValue(),'0','completed Play resets before replay');await finish();
 for(const index of [0,1,2,3]){
  await page.getByRole('tab',{name:'Try it yourself',exact:true}).click();await page.getByRole('button',{name:'Set up this experiment',exact:true}).nth(index).click();await page.getByRole('tab',{name:'Controls',exact:true}).click();
  await play();await finish();assert.match(await reading('Your result'),index===0?/sustained tone produced/:/No sustained tone/);
  assert.match(await page.locator('.daily-part-detail').textContent(),/Connected electric horn/);
 }
 await page.getByRole('button',{name:'The spring action of the clamped diaphragm.',exact:true}).click();assert.match(await page.locator('.daily-answer').textContent(),/That’s right/);
 await page.setViewportSize({width:390,height:844});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
 await page.getByRole('button',{name:'Whole machine',exact:true}).click();await page.getByRole('button',{name:'Make the model smaller',exact:true}).click();await page.waitForURL('**#place/workshop');
 await page.waitForFunction(()=>window.hornAudio.contexts.every(context=>context.state==='closed'));
 await page.getByRole('searchbox',{name:'Find a machine or idea',exact:true}).fill('Electric horn');await page.getByRole('button',{name:'Electric horn',exact:true}).click();await page.getByRole('heading',{name:'Electric horn',exact:true}).waitFor();await page.getByRole('tab',{name:'Controls',exact:true}).waitFor();
 await page.locator('#list-link').click();await page.locator('[data-list-kind="models"]').click();await page.getByRole('searchbox',{name:'Find a machine or idea',exact:true}).fill('Electric horn');assert.equal(await page.getByRole('button',{name:'Electric horn',exact:true}).count(),1,'horn is discoverable in the 3D list');
 assert.deepEqual(errors,[]);
 console.log('PASS horn browser: workshop route/exit, optional real audio, pause/step/resume/completion silence, replay reset, four experiments, whole-horn results, quiz and mobile.');
}finally{await browser.close();}

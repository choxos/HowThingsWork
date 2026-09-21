// Silent, caption-free tour of the public site. Requires installed Playwright and ffmpeg.
// Run: node scripts/record-tour.mjs [site URL]
// A caller with an existing browser can instead call recordTour(page, options).
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {writeFileSync} from 'node:fs';
import {mkdir, mkdtemp, readFile, writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join, resolve} from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';

const ROOT = fileURLToPath(new URL('../', import.meta.url));

function cursor() {
  const install = () => {
    if (document.getElementById('tour-cursor')) return;
    const dot = document.createElement('div');
    dot.id = 'tour-cursor';
    dot.popover = 'manual';
    dot.setAttribute('aria-hidden', 'true');
    dot.style.cssText = 'position:fixed;inset:auto;left:-40px;top:-40px;width:18px;height:18px;margin:-9px 0 0 -9px;padding:0;border-radius:50%;background:rgba(69,102,75,.65);border:2px solid #fbf6e9;box-shadow:0 1px 5px #0005;pointer-events:none;overflow:visible;transition:transform .12s';
    document.documentElement.append(dot);
    dot.showPopover();
    addEventListener('mousemove', e => { dot.style.left = `${e.clientX}px`; dot.style.top = `${e.clientY}px`; }, true);
    addEventListener('mousedown', () => { dot.style.transform = 'scale(.65)'; }, true);
    addEventListener('mouseup', () => { dot.style.transform = ''; }, true);
  };
  if (document.readyState === 'loading') addEventListener('DOMContentLoaded', install, {once:true});
  else install();
}

// The capture frame. 1440 by 1080 CSS at a 4/3 device scale is 1920 by 1440
// device pixels: a four by three video, taller than the old sixteen by nine one,
// which is what a timeline on X gives the most room to.
export const FRAME = {css: {width: 1440, height: 1080}, video: {width: 1920, height: 1440}, chrome: 87};

export async function recordTour(page, {
  base = 'https://howthingswork.xera.ac/',
  raw,
  progress = {},
  startAt = '',
} = {}) {
  raw ||= await mkdtemp(join(tmpdir(), 'htw-tour-'));
  await mkdir(join(raw, 'frames'), {recursive:true});
  const cdp = await page.context().newCDPSession(page);
  const errors = [], chapters = [];
  const onError = error => errors.push(error.message);
  page.on('pageerror', onError);
  await page.addInitScript(cursor);
  await page.emulateMedia({reducedMotion:'no-preference'});
  const screen=await page.evaluate(()=>({width:innerWidth,height:innerHeight,scale:devicePixelRatio}));
  assert.equal(screen.width,FRAME.css.width);assert.equal(screen.height,FRAME.css.height);
  assert.ok(Math.abs(screen.scale-4/3)<.001,'Use native Chrome device scale 4/3 for a sharp capture');
  progress.raw=raw;
  const beat = ms => page.waitForTimeout(ms);
  let pointer = {x:70,y:85}, active = null, number = 0, started = !startAt;
  const frame = ({data,metadata,sessionId}) => {
    cdp.send('Page.screencastFrameAck', {sessionId}).catch(() => {});
    if (!active) return;
    const file = join(raw, 'frames', `${String(number++).padStart(6,'0')}.jpg`);
    writeFileSync(file, Buffer.from(data, 'base64'));
    active.frames.push({file,at:metadata.timestamp});
  };
  cdp.on('Page.screencastFrame', frame);
  async function glide(x,y,ms=650) {
    const from = {...pointer}, steps = Math.max(2, Math.round(ms/25));
    for (let i=1;i<=steps;i++) {
      const t=i/steps, ease=t*t*(3-2*t);
      await page.mouse.move(from.x+(x-from.x)*ease,from.y+(y-from.y)*ease);
      await beat(ms/steps);
    }
    pointer={x,y};
  }
  async function press(locator) {
    const b=await locator.boundingBox();
    assert.ok(b && b.y>=0 && b.y+b.height<=FRAME.css.height, 'Tour target must be fully visible');
    await glide(b.x+b.width/2,b.y+b.height/2);
    await beat(180);await page.mouse.down();await beat(90);await page.mouse.up();
  }
  async function scroll(top) {
    await page.evaluate(y=>scrollTo({top:y,behavior:'smooth'}),top);await beat(1100);
  }
  async function frameMachine() {
    const selector = await page.locator('[data-control="mode"]').count()
      ? '[data-control="mode"]' : '.daily-canvas-wrap';
    const y=await page.locator(selector).evaluate(e=>e.getBoundingClientRect().top+scrollY-28);
    await scroll(y);
  }
  async function chooseMode(value) {
    const select=page.locator('[data-control="mode"]');
    await press(select);await beat(400);await page.keyboard.press('Escape');
    await select.selectOption(String(value));
    assert.equal(await select.inputValue(),String(value));
    await beat(700);await frameMachine();
    await press(page.getByRole('button',{name:/^Inspect full (result|image) \(100%\)$/}));
    const rays=page.getByRole('button',{name:'View ray diagram',exact:true});
    if(await rays.count()) await press(rays);
    await beat(2700);
  }
  async function load(hash) {
    await page.goto(base+hash,{waitUntil:'networkidle'});
    await page.locator('h1').waitFor();
    await page.evaluate(cursor);
    await page.evaluate(()=>document.fonts.ready);
    await beat(700);
  }
  async function scene(name,setup,actions) {
    if (!started && name !== startAt) return;
    started = true;
    progress.chapter=name;progress.phase='setup';
    await setup();
    active={name,frames:[],start:Date.now()/1000};
    await cdp.send('Page.startScreencast',{format:'jpeg',quality:90,maxWidth:FRAME.video.width,maxHeight:FRAME.video.height,everyNthFrame:1});
    progress.phase='recording';
    await page.mouse.move(pointer.x+1,pointer.y);await page.mouse.move(pointer.x,pointer.y);
    await actions();await beat(500);
    active.end=Date.now()/1000;chapters.push(active);active=null;
    await cdp.send('Page.stopScreencast');
    assert.ok(chapters.at(-1).frames.length>10,`No usable frames: ${name}`);
    await writeFile(join(raw,'capture.json'),JSON.stringify({base,chapters,errors},null,2)+'\n');
  }
  // Leaving one machine for the next is part of the tour, not something that
  // happens while the camera is off. A visitor goes out through the header or the
  // back button, watches the place close around them, and zooms into the next
  // machine; so these run inside a chapter's actions, never in its setup.
  async function toNeighborhood() {
    await scroll(0);await beat(700);
    await press(page.getByRole('link',{name:'Neighborhood',exact:true}).first());
    await page.locator('.zoom-scene').waitFor();await page.evaluate(cursor);await beat(1900);
  }
  async function backToPlace(name) {
    await scroll(0);await beat(700);
    await press(page.getByRole('button',{name:new RegExp(`Back to ${name}`)}).first());
    await page.locator('.zoom-scene').waitFor();await page.evaluate(cursor);await beat(1900);
  }
  async function zoomInto(place,machine) {
    if(place){await press(page.locator(`[data-place="${place}"]`).first());await beat(2400);}
    await press(page.locator(`[data-machine="${machine}"]`).first());
    await page.waitForFunction(id=>location.hash===`#machine/${id}`,machine,{timeout:20000});
    await page.locator('h1').waitFor();await page.evaluate(cursor);await beat(1600);
    await frameMachine();await beat(1300);
  }
  try {
    await scene('Explore the neighborhood',()=>load('#neighborhood'),async()=>{
      await beat(3400);
      await press(page.locator('a[href="#place/home"]').first());await beat(2800);
      await press(page.locator('a[href="#room/sewing-corner"]').first());await beat(3300);
      await press(page.locator('a[data-machine="sewing-machine"]').first());await beat(2700);
      await frameMachine();await beat(1400);
    });
    await scene('Watch a complete mechanism',async()=>{},async()=>{
      await press(page.locator('[data-play]'));await beat(16500);
      assert.equal(await page.locator('[data-play]').getAttribute('aria-pressed'),'false');
      await beat(2000);
      await press(page.getByRole('button',{name:'Reset experiment',exact:true}));await beat(1000);
      const b=await page.locator('canvas').boundingBox();
      await glide(b.x+35,b.y+55);await page.mouse.down();await glide(b.x+170,b.y+85,1100);await page.mouse.up();await beat(1200);
      await press(page.locator('[data-view="reset"]'));await beat(900);
      await press(page.locator('[data-view="in"]'));await beat(1300);
      assert.equal(await page.locator('[data-separation]').inputValue(),'0');
      await press(page.locator('[data-view="reset"]'));
    });
    await scene('Meet and separate the parts',async()=>{},async()=>{
      await press(page.getByRole('tab',{name:'Meet the parts',exact:true}));await beat(1700);
      const b=await page.locator('canvas').boundingBox();
      await glide(b.x+b.width*.40,b.y+b.height*.40);await beat(1500);
      assert.ok(await page.locator('.daily-part-popup').isVisible(),'Part hover popup');
      await page.mouse.down();await beat(90);await page.mouse.up();await beat(1700);
      await page.keyboard.press('Escape');await beat(700);
      await glide(b.x+25,b.y+30);
      for(let i=0;i<8;i++){await page.mouse.wheel(0,220);await beat(120);}
      await beat(3300);
      assert.equal(await page.locator('[data-separation]').inputValue(),'100');
      await press(page.locator('[data-reassemble]'));await beat(2000);
    });
    await scene('Find the smaller machines',async()=>{},async()=>{
      await scroll(0);await beat(700);
      await press(page.getByRole('link',{name:'All machines & ideas',exact:true}).first());
      await page.locator('#catalog-search').waitFor();await page.evaluate(cursor);await beat(1700);
      await press(page.locator('#catalog-search'));
      await page.keyboard.type('refrigerator',{delay:110});await beat(2600);
      await press(page.locator('[data-entry="refrigerant-compressor"]'));await beat(2300);
      await frameMachine();await beat(900);
    });
    await scene('Follow a compressor cycle',async()=>{},async()=>{
      await press(page.locator('[data-play]'));await beat(8600);
      assert.equal(await page.locator('[data-play]').getAttribute('aria-pressed'),'false');
      await beat(1600);
      await press(page.getByRole('tab',{name:'Try it yourself',exact:true}));await beat(1700);
      await press(page.getByRole('tab',{name:'Controls',exact:true}));await beat(1000);
    });
    await scene('Travel to the mirrors',async()=>{},async()=>{
      await toNeighborhood();
      await zoomInto('studio','mirrors');
      // The flat mirror it opens on, then the convex one beside it.
      await chooseMode(0);await chooseMode(1);
    });
    await scene('Turn a lens in the light',async()=>{},async()=>{
      await backToPlace('The studio');
      await zoomInto(null,'lenses');
      await chooseMode(0);
      // One lens, turned in the beam, rather than a march through all three.
      const b=await page.locator('canvas').boundingBox();
      await glide(b.x+b.width*.18,b.y+b.height*.30);
      await page.mouse.down();
      await glide(b.x+b.width*.82,b.y+b.height*.38,2700);
      await glide(b.x+b.width*.46,b.y+b.height*.64,1900);
      await page.mouse.up();await beat(1900);
      await press(page.locator('[data-view="reset"]'));await beat(1400);
    });
    await scene('Watch a printer lay down a layer',async()=>{},async()=>{
      await backToPlace('The studio');
      await press(page.locator('[data-zoom="out"]').first());await beat(2100);
      await zoomInto('workshop','3d-printer');
      await press(page.locator('[data-play]'));await beat(22500);
      assert.equal(await page.locator('[data-play]').getAttribute('aria-pressed'),'false');
      await beat(2200);
    });
    await scene('Keep exploring',async()=>{},async()=>{
      await backToPlace('The workshop');
      await press(page.locator('[data-zoom="out"]').first());await beat(2200);
      await glide(980,590,1000);await beat(4000);
    });
    assert.deepEqual(errors,[],'Tour must have no page errors');
    progress.status='recorded';progress.raw=raw;progress.frames=number;
    return {raw,base,chapters,errors};
  } finally {
    active=null;await cdp.send('Page.stopScreencast').catch(()=>{});
    cdp.off('Page.screencastFrame',frame);page.off('pageerror',onError);
    await cdp.detach();
  }
}

function run(command,args) {
  return new Promise((resolve,reject)=>{
    const child=spawn(command,args,{stdio:['ignore','pipe','pipe']});let out='',err='';
    child.stdout.on('data',d=>{out+=d;});child.stderr.on('data',d=>{err+=d;});
    child.on('error',reject);child.on('close',code=>code===0?resolve(out):reject(new Error(`${command}: ${code}\n${err}`)));
  });
}

export async function encodeTour(raw, output=join(ROOT,'documentation/tour.mp4')) {
  const capture=JSON.parse(await readFile(join(raw,'capture.json'),'utf8'));
  assert.deepEqual(capture.errors,[]);
  const concat=['ffconcat version 1.0'],chapters=[];let time=0;
  for(const chapter of capture.chapters){
    const start=time;
    for(let i=0;i<chapter.frames.length;i++){
      const f=chapter.frames[i],end=chapter.frames[i+1]?.at??chapter.end;
      const duration=Math.max(1/120,end-f.at);
      concat.push(`file '${f.file.replaceAll("'","'\\''")}'`,'option framerate 1000',`duration ${duration.toFixed(6)}`);time+=duration;
    }
    chapters.push({name:chapter.name,start,end:time});
  }
  const last=capture.chapters.at(-1).frames.at(-1);concat.push(`file '${last.file.replaceAll("'","'\\''")}'`,'option framerate 1000');
  await writeFile(join(raw,'frames.ffconcat'),concat.join('\n')+'\n');
  await run('ffmpeg',['-hide_banner','-loglevel','error','-n','-f','concat','-safe','0','-i',join(raw,'frames.ffconcat'),'-vf','setsar=1,fps=30','-c:v','libx264','-preset','slow','-crf','20','-pix_fmt','yuv420p','-an','-sn','-t',time.toFixed(6),'-movflags','+faststart',output]);
  const probe=JSON.parse(await run('ffprobe',['-v','error','-show_streams','-show_format','-of','json',output]));
  assert.equal(probe.streams.length,1);assert.equal(probe.streams[0].codec_type,'video');
  assert.equal(probe.streams[0].width,FRAME.video.width);assert.equal(probe.streams[0].height,FRAME.video.height);
  assert.ok(Number(probe.format.duration)>90);
  assert.ok(Math.abs(Number(probe.format.duration)-time)<.1,'Encoded timing must match capture timing');
  const report={base:capture.base,width:FRAME.video.width,height:FRAME.video.height,seconds:Number(probe.format.duration),bytes:Number(probe.format.size),audio:false,subtitles:false,pageErrors:capture.errors,chapters};
  await writeFile(join(ROOT,'documentation/tour.json'),JSON.stringify(report,null,2)+'\n');
  return report;
}

if(typeof process!=="undefined" && process.argv[1] && import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
  const {chromium}=await import('playwright');
  const browser=await chromium.launch({channel:'chrome',headless:true,args:['--force-device-scale-factor=1.333333333',`--window-size=${FRAME.css.width},${FRAME.css.height+FRAME.chrome}`]});
  try{
    const page=await browser.newPage({viewport:null});const {raw}=await recordTour(page,{base:process.argv[2]||undefined});
    console.log(JSON.stringify(await encodeTour(raw),null,2));
  }finally{await browser.close();}
}

import {imageUrl} from './image-url.js';
function leverModel(position) { return 100 * (100 - position) / position; }
function circuitModel(voltage, closed) { return { current: closed ? voltage / 6 : 0, power: closed ? voltage * voltage / 6 : 0 }; }
function boatModel(boxes) {
  const mass = 60 + 45 * boxes;
  return { mass, floating: mass <= 300, depth: (-150 + Math.sqrt(22500 + 1.75 * (mass / 300) * 14800)) / .875 };
}

if (typeof document !== 'undefined') {
  const places = {
    workshop: { name: 'The workshop', icon: '⚒', x: 53, y: 29, tag: 'Make a little effort go further', title: 'Big ideas on a little workbench.', story: 'A wooden beam, a heavy box, and a clever place to put the support. There’s more to this workshop than meets the eye.', experiment: 'levers', sample: 'A little push. A big lift.', description: 'Move the support and discover the quiet power of a lever.' },
    home: { name: 'The house', icon: '⌂', x: 23, y: 28, tag: 'Find the spark in the everyday', title: 'There’s a discovery in every room.', story: 'Behind a familiar glow is a tiny journey. Step inside and follow the path that brings a lamp to life.', experiment: 'electricity', sample: 'Let there be light.', description: 'Close a circuit and see what makes the bulb glow.' },
    river: { name: 'The riverside', icon: '≈', x: 82, y: 66, tag: 'Wonder down by the water', title: 'Some things float. But why?', story: 'The boat is waiting by the old boathouse. Bring a few boxes aboard and see how the water carries the load.', experiment: 'floating', sample: 'One more box aboard?', description: 'Load the little boat and watch how deep it sits.' }
  };
  const app = document.querySelector('#app');
  let value = 50;
  let closed = true;
  const fmt = n => Number(n.toFixed(1)).toLocaleString();
  const mapMarkup = () => `<div class="map-wrap"><div class="map"><div class="world"><img src="${imageUrl('neighborhood')}" alt="A painted neighborhood with a yellow house, open workshop, leafy lanes, and a boathouse by the river."></div>${Object.entries(places).map(([key,p])=>`<a class="pin" data-place="${key}" href="#${key}" style="left:${p.x}%;top:${p.y}%">${p.name}<span aria-hidden="true">↗</span></a>`).join('')}</div><p class="map-caption"><span class="dot"></span> Follow your curiosity. Choose a place.</p></div>`;
  function paintMap(key) {
    const p = places[key];
    const world = document.querySelector('.world');
    world.style.transform = p ? `translate(${(50-p.x)*1.65}%, ${(50-p.y)*1.65}%) scale(1.65)` : '';
    document.querySelectorAll('.pin').forEach(pin => { pin.hidden = !!p; });
    document.querySelector('.map-caption').innerHTML = p ? `<span class="dot"></span> You’re at ${p.name.toLowerCase()}. Take a look inside.` : '<span class="dot"></span> Follow your curiosity. Choose a place.';
    document.querySelector('.map-reset')?.remove();
    if (p) document.querySelector('.map-wrap').insertAdjacentHTML('beforeend','<a class="map-reset" href="#">← Whole neighborhood</a>');
  }
  function render() {
    const [key, experiment] = location.hash.slice(1).split('/');
    const p = places[key];
    const discovery = p && experiment === p.experiment;
    if (discovery) {
      value = key === 'workshop' ? 50 : key === 'home' ? 6 : 2;
      closed = true;
      app.innerHTML = `<div class="layout discovery"><section class="reading"><a class="back" href="#${key}">← Back to ${p.name.toLowerCase()}</a><p class="eyebrow">A discovery at ${p.name.toLowerCase()}</p><h1 tabindex="-1">${p.sample}</h1><p class="intro">${p.description}</p><p class="hint">${key === 'workshop' ? 'Try moving the support closer to the box. How much push do you need now?' : key === 'home' ? 'Flip the switch, then turn up the battery. Watch what happens to the light.' : 'Add a box at a time. Can the water keep carrying the extra weight?'}</p><details><summary>Why does it happen?</summary><p>${key === 'workshop' ? 'A lever balances turning effects around its support. A longer distance on your side means less force is needed to lift the same load. The tradeoff: your end must move farther. Here we show the force needed to balance a 100 N load, ignoring the beam’s weight and friction.' : key === 'home' ? 'Electric current needs a complete path. With the switch closed, a larger battery voltage pushes more current through the bulb. This example treats the bulb as a fixed 6 Ω resistance. Real filament bulbs change resistance as they heat up.' : 'A floating boat pushes aside water equal to its own weight, including its cargo. More cargo means the hull sits deeper. Our example boat weighs 60 kg, each box adds 45 kg, and the hull can displace 300 kg of water before it floods. This is a simplified illustration, not a boat capacity guide.'}</p></details></section><section class="experiment" aria-label="Interactive ${p.experiment} experiment"><div id="drawing"></div><div class="controls"><label class="control-label" for="amount"><span>${key === 'workshop' ? 'Move the support' : key === 'home' ? 'Battery voltage' : 'Cargo boxes'}</span><output id="amount-value" for="amount"></output></label><input id="amount" type="range" min="${key === 'workshop' ? 20 : 0}" max="${key === 'workshop' ? 80 : key === 'home' ? 12 : 6}" step="1" value="${value}"><div class="ends"><span>${key === 'workshop' ? 'Closer to your push' : key === 'home' ? '0 volts' : 'Empty boat'}</span><span>${key === 'workshop' ? 'Closer to the box' : key === 'home' ? '12 volts' : '6 boxes'}</span></div><div class="readouts" id="readouts" aria-live="polite"></div></div></section></div>`;
      document.querySelector('#amount').addEventListener('input', e => { value = Number(e.target.value); updateExperiment(key); });
      updateExperiment(key);
    } else {
      const keepMap = !!document.querySelector('.world');
      if (!keepMap) app.innerHTML = `<div class="layout"><section class="reading"></section>${mapMarkup()}</div>`;
      document.querySelector('.reading').innerHTML = p ? `<a class="back" href="#">← Back to the neighborhood</a><p class="eyebrow">${p.name}</p><h1 tabindex="-1">${p.title}</h1><p class="intro">${p.story}</p><div class="sample"><p class="eyebrow">Look inside</p><h3>${p.sample}</h3><p>${p.description}</p><a class="primary" href="#${key}/${p.experiment}">Try it yourself <span aria-hidden="true">→</span></a></div>` : `<p class="eyebrow">Welcome, curious minds</p><h1 tabindex="-1">A little neighborhood.<br>A world to discover.</h1><p class="intro">Everyday places are full of wonderful ideas. Pick a place, take a closer look, and try something out.</p><div class="places">${Object.entries(places).map(([id,place])=>`<a class="place-link" href="#${id}"><span class="place-icon" aria-hidden="true">${place.icon}</span><span><span class="place-name">${place.name}</span><small>${place.tag}</small></span><span class="arrow" aria-hidden="true">↗</span></a>`).join('')}</div>`;
      if (!keepMap && p) requestAnimationFrame(()=>requestAnimationFrame(()=>paintMap(key))); else paintMap(key);
    }
    document.title = `${discovery ? p.sample : p ? p.name : 'A neighborhood of discoveries'} · How Things Work`;
    document.querySelector('h1').focus({preventScroll:true});
    window.scrollTo({top:0,behavior:'instant'});
  }
  const pot = (x,y) => `<g transform="translate(${x} ${y})"><path d="M-19 0h38l-5 31h-28z" fill="#c78361"/><path d="M0 0v-40m0 20q-35-30-30-7t30 15m0-20q30-36 31-13t-31 23" fill="#91a675"/><path d="M-22 0h44v7h-44z" fill="#d69a73"/></g>`;
  const svgStart = label => `<svg class="scene" viewBox="0 0 840 520" role="img" aria-label="${label}" xmlns="http://www.w3.org/2000/svg"><defs><pattern id="grain" width="17" height="19" patternUnits="userSpaceOnUse"><circle cx="3" cy="7" r=".6" fill="#394233" opacity=".07"/><circle cx="12" cy="16" r=".7" fill="#394233" opacity=".06"/></pattern><radialGradient id="glow"><stop stop-color="#ffe89e" stop-opacity=".9"/><stop offset="1" stop-color="#ffe89e" stop-opacity="0"/></radialGradient><clipPath id="water"><path d="M0 310H840V520H0z"/></clipPath></defs><g stroke="#46513d" stroke-width="2.4" stroke-linejoin="round" stroke-linecap="round">`;
  const room = (home=false) => `<path d="M0 0H840V520H0z" fill="${home?'#ece3c5':'#ead5ba'}" stroke="none"/><path d="M0 377H840V520H0z" fill="#d0b28a"/><path d="M0 425H840M0 480H840M130 377L60 520M360 377L340 520M600 377L660 520" opacity=".24"/><path d="M65 48H239V219H65z" fill="#c4d6c0"/><path d="M73 187q30-95 75-44t83-62v130H73" fill="#94aa7b" stroke="none"/><path d="M65 48H239V219H65zM152 48V219M65 125H239" fill="none" stroke="#eaf0da" stroke-width="12"/><path d="M53 225H250" stroke="#967b59" stroke-width="8"/><path d="M578 102H768V117H578z" fill="#ad8b61"/>${pot(722,101)}${home?'<path d="M600 101V62H618V101M623 101V49H640V101M645 101V68H660V101" fill="#cc856c"/>':'<path d="M609 120v57m-13-51h26m37-5v56m-12-45q12-19 24 0v20h-24z" fill="#9ca998" stroke-width="6"/>'}<path d="M98 381l34-30H735l34 30v20H98z" fill="#bd9361"/><path d="M117 402H149V507H125zM713 402H746L738 507H713z" fill="#a78055"/><path d="M98 381H769M133 365H737" fill="none"/>${pot(55,389)}`;
  const svgEnd = '</g><rect width="840" height="520" fill="url(#grain)" pointer-events="none"/></svg>';
  function updateExperiment(key) {
    let scene, readouts;
    const readout = (label,text) => `<div class="readout"><small>${label}</small><strong>${text}</strong></div>`;
    if (key === 'workshop') {
      const x = 160 + 520 * value / 100;
      const force = leverModel(value);
      scene = svgStart('A wooden lever with a movable support, a downward push at the left, and a 100 newton load on the right.') + room() + `<path d="M${x-32} 349L${x} 269L${x+32} 349z" fill="#829774"/><path d="M146 249H694V269H146z" fill="#cda36a"/><path d="M153 256H685" stroke="#e6c58e"/><circle cx="${x}" cy="271" r="5" fill="#ece6ca"/><path d="M680 269v22"/><path d="M647 291H713V345H647z" fill="#c78261"/><path d="M647 291l14-12h39l13 12M676 293V345" fill="none"/><text x="680" y="329" text-anchor="middle" stroke="none" fill="#fff4dc" font-family="Nunito" font-size="16">100 N</text><path d="M160 155V231m-11-13 11 13 11-13" fill="none" stroke="#45664b" stroke-width="6"/><text x="160" y="141" text-anchor="middle" stroke="none" fill="#45664b" font-family="Nunito" font-size="18">Your push</text><path d="M160 363H${x}m-4-5 4 5-4 5" fill="none" stroke="#566947" stroke-dasharray="4 5"/>` + svgEnd;
      document.querySelector('#amount-value').textContent = `${value}% along the beam`;
      readouts = readout('Push needed to balance',`${fmt(force)} N`) + readout('Load on the other end','100 N');
    } else if (key === 'home') {
      const model = circuitModel(value,closed);
      scene = svgStart(`A battery and ${closed?'closed':'open'} switch connected to a ${model.power?'glowing':'dark'} bulb.`) + room(true) + `<ellipse cx="616" cy="270" rx="120" ry="120" fill="url(#glow)" stroke="none" opacity="${model.power/24}"/><path d="M246 279H390M464 279H574M622 317V355H246V320" fill="none" stroke="#62786a" stroke-width="6"/><path d="M213 278H278V330H213z" fill="#c88b64"/><path d="M222 266H239V278H222M254 266H268V278H254" fill="#a5ae95"/><text x="245" y="311" text-anchor="middle" stroke="none" fill="#fff4dc" font-family="Nunito" font-size="20">${value} V</text><path d="M377 288H477V304H377z" fill="#c6b18b"/><path d="M390 279L464 ${closed?279:243}" stroke="#b27b55" stroke-width="7"/><circle cx="390" cy="279" r="5" fill="#f3e9cd"/><circle cx="464" cy="279" r="5" fill="#f3e9cd"/><path d="M573 263c-28-56 53-83 65-33 5 18-7 29-16 42v23h-39v-23z" fill="${model.power?'#f5da84':'#e9e9ce'}"/><path d="M597 279l-9-34 12 10 12-10-9 34" fill="none" stroke="#a38b52"/><path d="M581 288H624V318H581z" fill="#8c9b84"/><path d="M581 297H624M581 308H624"/><path d="M566 319H638V331H566z" fill="#ab8961"/>` + svgEnd;
      document.querySelector('#amount-value').textContent = `${value} V`;
      readouts = `<button class="switch" id="switch" aria-pressed="${closed}">Switch: ${closed?'on':'off'}</button>` + readout('Current',`${fmt(model.current)} A`) + readout('Bulb power',`${fmt(model.power)} W`);
    } else {
      const model = boatModel(value);
      const bottom = model.floating ? 310+model.depth : 448;
      const top = bottom-80;
      let boxes = '';
      for(let i=0;i<value;i++) { const x=340+(i%3)*49, y=top-37-Math.floor(i/3)*39; boxes+=`<path d="M${x} ${y}h44v37h-44z" fill="${i%2?'#c88b62':'#d6ac70'}"/><path d="M${x+22} ${y}v37m-22-31 44 25" fill="none" opacity=".45"/>`; }
      scene = svgStart(`A small boat carrying ${value} boxes, ${model.floating?'floating':'overloaded and sinking'}.`) + `<path d="M0 0H840V520H0z" fill="#dce6cf" stroke="none"/><path d="M0 212Q130 148 260 211T540 196T840 174V310H0z" fill="#aec29b" stroke="none"/><path d="M564 102l90-55 126 57v192H564z" fill="#a7bbb1"/><path d="M543 105l111-70 144 72-9 15-135-64-105 65z" fill="#aa7861"/><path d="M605 156H673V255H605z" fill="#6d897b"/><path d="M704 151H752V202H704z" fill="#e4e3bf"/><path d="M728 151V202M704 176H752"/><path d="M572 277H840V304H550z" fill="#ba986e"/><path d="M592 304V392M778 304V409" stroke="#9e7e5b" stroke-width="14"/><path d="M61 0q91 101 51 283M102 80Q177 54 187 148M92 42Q9 67 17 152" fill="none" stroke="#879b71" stroke-width="17"/><path d="M8 80q49-85 93-19 40-57 93 23l-16 57q-30-65-65-27-59-38-96 30z" fill="#89a578" stroke="none"/><path d="M0 310H840V520H0z" fill="#87b8bb" stroke="none"/>${boxes}<path d="M310 ${top}H530L495 ${bottom}H345z" fill="#cb8261"/><path d="M309 ${top}H531" stroke="#ebe0b8" stroke-width="9"/><path d="M325 ${top+30}H516M338 ${top+61}H503" stroke="#a76651"/><g clip-path="url(#water)"><path d="M300 ${top-5}H540V${bottom+5}H300z" fill="#87b8bb" opacity=".6" stroke="none"/></g><path d="M0 310q27-6 53 0t53 0t53 0t53 0t53 0t53 0t53 0t53 0t53 0t53 0t53 0t53 0t53 0t53 0t53 0t53 0M115 361h55m20 51h90m245-66h52m33 92h97M360 475h90" fill="none" stroke="#d6e5d8" stroke-width="3"/>` + svgEnd;
      document.querySelector('#amount-value').textContent = `${value} ${value === 1 ? 'box' : 'boxes'}`;
      readouts = readout('Boat + cargo',`${model.mass} kg`) + readout('On the water',model.floating?'Floating':'Too much cargo');
    }
    document.querySelector('#drawing').innerHTML = scene;
    const activeControl = document.activeElement?.id;
    document.querySelector('#readouts').innerHTML = readouts + '<button class="reset" id="reset">Reset</button>';
    document.querySelector('#switch')?.addEventListener('click',()=>{closed=!closed;updateExperiment(key);});
    document.querySelector('#reset').addEventListener('click',()=>{value=key==='workshop'?50:key==='home'?6:2;closed=true;document.querySelector('#amount').value=value;updateExperiment(key);});
    if(activeControl==='switch'||activeControl==='reset') document.getElementById(activeControl)?.focus({preventScroll:true});
  }
  document.querySelector('#about').addEventListener('click',()=>document.querySelector('dialog').showModal());
  document.querySelectorAll('.close,.close-dialog').forEach(button=>button.addEventListener('click',()=>document.querySelector('dialog').close()));
  addEventListener('hashchange',render);
  addEventListener('keydown',event=>{if(event.key==='Escape'&&!document.querySelector('dialog').open&&location.hash)location.hash=location.hash.includes('/')?location.hash.split('/')[0]:'';});
  render();
}

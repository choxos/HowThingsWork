import {validateControls, validTime} from './physics-kit.js';

// Pulse shapes: Heidler et al., ICLP 2008, equation 7 and Table 5.
// Field geometry: Stolzenburg and Marshall, arXiv:2108.04138, equations 1–2.
// The circuit and equivalent earth radius below are assigned teaching models.
export const FIRST = Object.freeze({key:'slow',label:'Slow 10/350 μs shape',k:.93,tau1:19e-6,tau2:485e-6});
export const SUBSEQUENT = Object.freeze({key:'fast',label:'Fast 0.25/100 μs shape',k:.993,tau1:.454e-6,tau2:143e-6});
export const STROKES = Object.freeze([FIRST,SUBSEQUENT]);
export const HEIDLER = Object.freeze({exponent:10,band:Object.freeze([.3,.9])});
export const CONDUCTOR = Object.freeze({length:10,diameter:.008,area:Math.PI*.004**2,resistance:1.68e-8*10/(Math.PI*.004**2),inductance:10e-6});
export const CORONA = Object.freeze({onset:6.79e6});
export const DECLARED = Object.freeze({height:2,attachment:2,clock:Object.freeze({start:1e-7,end:5e-3,decade:2}),samples:241,window:Object.freeze({half:.03,below:.02,above:.04}),spacing:5000,contours:32,points:32});
export const LIGHTNING_DEFAULTS = Object.freeze({field:10,tip:.5,peak:100,stroke:0,paths:2,soil:100,gap:1,radius:1,distance:5});
export const LIGHTNING_DOMAINS = Object.freeze({field:[0,20,1],tip:[.5,25,.5],peak:[25,200,25],stroke:[0,1,1],paths:[1,2,1],soil:[50,1000,50],gap:[.1,1.2,.05],radius:[.5,2,.5],distance:[3,12,1]});
for(const domain of Object.values(LIGHTNING_DOMAINS))Object.freeze(domain);
export const STROKE_OPTIONS = Object.freeze(STROKES.map((s,value)=>Object.freeze({value,label:s.label})));
export const RUN = DECLARED.attachment+DECLARED.clock.decade*Math.log10(DECLARED.clock.end/DECLARED.clock.start);
export const timeOfClock = clock => clock<=DECLARED.attachment?0:DECLARED.clock.start*10**((Math.min(clock,RUN)-DECLARED.attachment)/DECLARED.clock.decade);
export const clockOfTime = t => t<=0?0:DECLARED.attachment+Math.max(0,DECLARED.clock.decade*Math.log10(Math.min(t,DECLARED.clock.end)/DECLARED.clock.start));

const GAUSS = (() => {
  const n = 16, nodes = [], weights = [];
  const legendre = x => { let p0 = 1, p1 = x; for (let j = 2; j <= n; j++) [p0, p1] = [p1, ((2 * j - 1) * x * p1 - (j - 1) * p0) / j]; return [p1, n * (x * p1 - p0) / (x * x - 1)]; };
  for (let i = 1; i <= n; i++) {
    let x = Math.cos(Math.PI * (i - 0.25) / (n + 0.5));
    for (let iteration = 0; iteration < 50; iteration++) { const [value, slope] = legendre(x), step = value / slope; x -= step; if (Math.abs(step) < 1e-16) break; }
    const slope = legendre(x)[1];
    nodes.push(x);
    weights.push(2 / ((1 - x * x) * slope * slope));
  }
  return Object.freeze({nodes: Object.freeze(nodes), weights: Object.freeze(weights)});
})();
const gauss = (fn, a, b) => { const half = (b - a) / 2, middle = (a + b) / 2; let sum = 0; for (let i = 0; i < GAUSS.nodes.length; i++) sum += GAUSS.weights[i] * fn(middle + half * GAUSS.nodes[i]); return sum * half; };
/** ∫ fn from 0 to `upTo` over a stroke's panels: one up to a twentieth of τ1, then eight to a decade out to 60 τ2. */
const integrate = (edges, fn, upTo = Infinity) => { let sum = 0; for (let j = 1; j < edges.length && edges[j - 1] < upTo; j++) sum += gauss(fn, edges[j - 1], Math.min(edges[j], upTo)); return sum; };
const panelsOf = stroke => { const edges = [0], first = 0.05 * stroke.tau1, last = 60 * stroke.tau2; for (let k = 0; first * 10 ** (k / 8) < last; k++) edges.push(first * 10 ** (k / 8)); edges.push(last); return Object.freeze(edges); };
/** Where a function with one maximum on [lo, hi] peaks. */
const peakOf = (fn, lo, hi) => {
  const ratio = (Math.sqrt(5) - 1) / 2;
  let a = lo, b = hi, c = b - ratio * (b - a), d = a + ratio * (b - a), fc = fn(c), fd = fn(d);
  for (let k = 0; k < 200 && b - a > 1e-15 * b; k++) {
    if (fc > fd) { b = d; d = c; fd = fc; c = b - ratio * (b - a); fc = fn(c); } else { a = c; c = d; fc = fd; d = a + ratio * (b - a); fd = fn(d); }
  }
  return (a + b) / 2;
};
/** Where fn, negative at lo and positive at hi, crosses zero. */
const rootOf = (fn, lo, hi) => { let a = lo, b = hi; for (let k = 0; k < 200; k++) { const m = (a + b) / 2; if (m <= a || m >= b) break; if (fn(m) < 0) a = m; else b = m; } return (a + b) / 2; };

/** The current, A, at t seconds after the strike attaches, for a stroke whose table peak is `peak`. */
export function currentOf(stroke, peak, t) {
  if (!(t > 0)) return 0;
  const fraction = 1 / (1 + (stroke.tau1 / t) ** HEIDLER.exponent);
  return peak / stroke.k * fraction * Math.exp(-t / stroke.tau2);
}
/** Its rate of change, A/s: the function differentiated. */
export function slopeOf(stroke, peak, t) {
  if (!(t > 0)) return 0;
  const fraction = 1 / (1 + (stroke.tau1 / t) ** HEIDLER.exponent), decay = Math.exp(-t / stroke.tau2);
  if (fraction === 0 || decay === 0) return 0;
  return peak / stroke.k * decay * fraction * (HEIDLER.exponent * (1 - fraction) / t - 1 / stroke.tau2);
}

/** Each stroke's shape for a table peak of 1 A: when it peaks and how high, its 10%, 30% and 90% times on the front, its half value on the tail, its steepest rise and when, the average steepness from 30% to 90%, and its charge and specific energy. */
export const SHAPES = Object.freeze(STROKES.map(stroke => {
  const current = t => currentOf(stroke, 1, t), slope = t => slopeOf(stroke, 1, t);
  const peakTime = peakOf(current, stroke.tau1, 10 * stroke.tau1), top = current(peakTime);
  const rise = share => rootOf(t => current(t) - share * top, 0, peakTime);
  const [t10, t30, t90] = [0.1, HEIDLER.band[0], HEIDLER.band[1]].map(rise);
  const half = rootOf(t => top / 2 - current(t), peakTime, 60 * stroke.tau2);
  const steepestTime = peakOf(slope, stroke.tau1 / 10, peakTime), edges = panelsOf(stroke);
  return Object.freeze({edges, peakTime, top, t10, t30, t90, half, steepestTime, steepest: slope(steepestTime), average: (HEIDLER.band[1] - HEIDLER.band[0]) * top / (t90 - t30), charge: integrate(edges, current), energy: integrate(edges, t => current(t) ** 2)});
}));

/** Moore's field enhancement at the tip of a semi-ellipsoid c tall with tip radius a, from c/a. */
export function enhancementOf(ratio) {
  const excess = 1 / (ratio - 1), eta = Math.sqrt(1 + excess), above = excess / (eta + 1);
  return 1 / (eta * excess * (0.5 * Math.log((eta + 1) / above) - 1 / eta));
}

/** The Legendre function of the second kind, Q1(x) = (x/2)·ln((x + 1)/(x − 1)) − 1, for x > 1, and its slope. */
export const legendreQ1 = x => x / 2 * Math.log((x + 1) / (x - 1)) - 1;
const legendreQ1Slope = x => 0.5 * Math.log((x + 1) / (x - 1)) - x / ((x - 1) * (x + 1));

/** A prolate spheroid c tall above the ground with tip radius a: its half width b, foci at ±f and surface ξ0 = c/f. */
export function spheroidOf(tip, height = DECLARED.height) {
  const b = Math.sqrt(tip * height), f = Math.sqrt(height * height - tip * height), xi = height / f;
  return Object.freeze({a: tip, b, c: height, f, xi, q: legendreQ1(xi)});
}
const shapeG = (s, xi) => xi - s.xi * legendreQ1(xi) / s.q;
const shapeSlope = (s, xi) => 1 - s.xi * legendreQ1Slope(xi) / s.q;

/** Prolate spheroidal coordinates (ξ, η) of a point r from the axis and z above the ground. */
export function prolateOf(s, r, z) { const near = Math.hypot(r, z - s.f), far = Math.hypot(r, z + s.f); return {xi: (near + far) / (2 * s.f), eta: (far - near) / (2 * s.f)}; }
/** The potential, V, outside the grounded spheroid in an ambient field pointing up (V/m). */
export function potentialAt(s, ambient, r, z) { const {xi, eta} = prolateOf(s, r, z); return -ambient * s.f * eta * shapeG(s, xi); }
function fieldOf(s, ambient, xi, eta) {
  const g = shapeG(s, xi), slope = shapeSlope(s, xi), across = (1 - eta) * (1 + eta), along = (xi - 1) * (xi + 1);
  return ambient * Math.sqrt((eta * eta * slope * slope * along + g * g * across) / (along + across));
}
/** The field's size, V/m, at a point outside the spheroid. */
export function fieldAt(s, ambient, r, z) { const {xi, eta} = prolateOf(s, r, z); return fieldOf(s, ambient, xi, eta); }
/** The field, V/m, on the axis at a height z above the ground, above the tip. */
export const axisFieldAt = (s, ambient, z) => ambient * shapeSlope(s, z / s.f);

/** The point at (ξ, u), u = √(1 − η²): its distance from the axis and its height above the tip, m. */
const pointOf = (s, xi, u) => [s.f * Math.sqrt((xi - 1) * (xi + 1)) * u, s.f * xi * Math.sqrt((1 - u) * (1 + u)) - s.c];
/** The ξ outside the surface where `below(ξ)` stops holding, found by halving ξ − 1 geometrically. */
function xiWhere(s, below) {
  let lo = s.xi, hi = 1 + 2 * (s.xi - 1);
  while (below(hi)) { lo = hi; hi = 1 + 2 * (hi - 1); }
  for (let k = 0; k < 40; k++) { const middle = 1 + Math.sqrt((lo - 1) * (hi - 1)); if (below(middle)) lo = middle; else hi = middle; }
  return 1 + Math.sqrt((lo - 1) * (hi - 1));
}

/** The equipotentials in the close up's window, 5 kV apart: each a list of [x, y] m about the tip, running from the window's edge on the left over the axis to its edge on the right. */
export function contoursOf(s, ambient) {
  if (!(ambient > 0)) return [];
  const {half, below, above} = DECLARED.window, reach = -potentialAt(s, ambient, 0, s.c + above), count = Math.min(DECLARED.contours, Math.floor(reach / DECLARED.spacing + 1e-9)), lines = [];
  for (let k = 1; k <= count; k++) {
    const volts = k * DECLARED.spacing;
    const at = u => { const target = volts / (ambient * s.f * Math.sqrt((1 - u) * (1 + u))); return pointOf(s, xiWhere(s, xi => shapeG(s, xi) < target), u); };
    const inside = u => { const [x, y] = at(u); return x <= half && y >= -below; };
    let lo = 0, hi = 1 - 1e-9;
    for (let j = 0; j < 36; j++) { const middle = (lo + hi) / 2; if (inside(middle)) lo = middle; else hi = middle; }
    const right = Array.from({length: DECLARED.points + 1}, (_, j) => at(lo * j / DECLARED.points));
    lines.push({volts, points: [...right.slice(1).reverse().map(([x, y]) => [-x, y]), ...right]});
  }
  return lines;
}

// A hemispherical contact in homogeneous soil: integrate rho I/(2 pi r²)
// from the observation radius to remote earth. Radius is an assigned equivalent,
// not inferred from the rods drawn in the installation illustration.
export const earthResistanceOf = (soil,radius) => soil/(2*Math.PI*radius);
export const groundPotentialOf = (soil,current,distance) => -soil*current/(2*Math.PI*distance);
export const gapVoltageOf = (stroke,peakParameter,paths,t) => -(CONDUCTOR.resistance*currentOf(stroke,peakParameter,t)+CONDUCTOR.inductance*slopeOf(stroke,peakParameter,t))/paths;

export function lightningPlan(input={}) {
  const values=validateControls(input,LIGHTNING_DEFAULTS,LIGHTNING_DOMAINS,'lightning conductor');
  const stroke=STROKES[values.stroke],shape=SHAPES[values.stroke];
  const top=values.peak*1000,peak=top/shape.top;
  const spheroid=spheroidOf(values.tip/1000),enhancement=enhancementOf(DECLARED.height*1000/values.tip),ambient=values.field*1000;
  const gapTime=peakOf(t=>-gapVoltageOf(stroke,peak,values.paths,t),stroke.tau1/10,shape.peakTime);
  const gapMax=-gapVoltageOf(stroke,peak,values.paths,gapTime),earthResistance=earthResistanceOf(values.soil,values.radius);
  const energy=shape.energy*peak**2,charge=shape.charge*peak;
  return {values,stroke,shape,top,peak,spheroid,enhancement,ambient,tipField:enhancement*ambient,
    onsetField:CORONA.onset/enhancement,aboveOnset:enhancement*ambient>=CORONA.onset,
    contours:contoursOf(spheroid,ambient),gapTime,gapMax,gapField:gapMax/values.gap,
    peakTime:shape.peakTime,steepest:shape.steepest*peak,steepestTime:shape.steepestTime,
    earthResistance,earthMax:earthResistance*top,charge,energy,copperEnergy:energy*CONDUCTOR.resistance/values.paths,
    stepMax:Math.abs(groundPotentialOf(values.soil,top,values.distance)-groundPotentialOf(values.soil,top,values.distance+1)),duration:RUN,
    samples:Array.from({length:DECLARED.samples},(_,j)=>{const t=DECLARED.clock.start*(DECLARED.clock.end/DECLARED.clock.start)**(j/(DECLARED.samples-1));return {t,current:currentOf(stroke,peak,t),gap:gapVoltageOf(stroke,peak,values.paths,t),earth:-earthResistance*currentOf(stroke,peak,t)};})};
}

export function lightningAt(plan,time) {
  const t=validTime(time),{stroke,peak,values}=plan,current=currentOf(stroke,peak,t),slope=slopeOf(stroke,peak,t);
  const branchCurrent=current/values.paths,inductive=-CONDUCTOR.inductance*slope/values.paths,resistive=-CONDUCTOR.resistance*branchCurrent,gap=inductive+resistive,earth=-plan.earthResistance*current;
  const near=groundPotentialOf(values.soil,current,values.distance),far=groundPotentialOf(values.soil,current,values.distance+1);
  const charge=integrate(plan.shape.edges,u=>currentOf(stroke,peak,u),t),specificEnergy=integrate(plan.shape.edges,u=>currentOf(stroke,peak,u)**2,t);
  return {t,current,slope,branchCurrent,leftCurrent:branchCurrent,rightCurrent:values.paths===2?branchCurrent:0,inductive,resistive,gap,earth,top:earth+gap,field:Math.abs(gap)/values.gap,
    share:current/plan.top,near,far,step:Math.abs(near-far),charge,copperEnergy:CONDUCTOR.resistance*specificEnergy/values.paths,
    copperPower:CONDUCTOR.resistance*current**2/values.paths,magneticEnergy:CONDUCTOR.inductance*current**2/(2*values.paths),earthPower:plan.earthResistance*current**2};
}
export const sampleLightning = (input={},time=0)=>lightningAt(lightningPlan(input),time);

export function createLightningController(initial={}) {
  let plan=lightningPlan(),clock=0;
  const getState=()=>{
    const physicalTime=timeOfClock(clock),sample=lightningAt(plan,physicalTime),done=clock>=RUN;
    const phase=clock===0?'Ready to follow a strike':clock<1?'A leader approaches the roof':clock<DECLARED.attachment?'An upward streamer connects':done?'Pulse complete':physicalTime<plan.peakTime?'The current is rising':'The current is decaying';
    return {...sample,values:{...plan.values},clock,physicalTime,complete:done,blocked:false,phase,attached:clock>=DECLARED.attachment,
      record:{peakCurrent:plan.top,gapMax:plan.gapMax,gapField:plan.gapField,earthMax:plan.earthMax,stepMax:plan.stepMax,charge:plan.charge,copperEnergy:plan.copperEnergy},
      tipField:plan.tipField,enhancement:plan.enhancement,aboveOnset:plan.aboveOnset,earthResistance:plan.earthResistance};
  };
  function reset(next={}) {
    if(!next||typeof next!=='object'||Array.isArray(next))throw new TypeError('Expected lightning initial state');
    for(const key of Object.keys(next))if(!['settings','time'].includes(key))throw new RangeError(`Unknown lightning initial field ${key}`);
    const nextPlan=lightningPlan(next.settings??{}),nextClock=next.time??0;
    if(!Number.isFinite(nextClock)||nextClock<0||nextClock>RUN)throw new RangeError('Invalid lightning initial time');
    plan=nextPlan;clock=nextClock;return getState();
  }
  function update(changes={}) {
    const values=validateControls(changes,plan.values,LIGHTNING_DOMAINS,'lightning conductor');
    if(Object.keys(values).some(key=>values[key]!==plan.values[key])){plan=lightningPlan(values);clock=0;}
    return getState();
  }
  function advance(seconds) {
    if(!Number.isFinite(seconds)||seconds<0)throw new RangeError('Expected nonnegative lightning playback interval');
    clock=Math.min(RUN,clock+seconds);if(RUN-clock<1e-12)clock=RUN;return getState();
  }
  reset(initial);
  return {getState,reset,update,advance,getPlan:()=>structuredClone(plan),replayState:()=>({settings:{...plan.values},time:0})};
}

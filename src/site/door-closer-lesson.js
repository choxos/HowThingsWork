import {DOOR_DEFAULTS} from './door-closer-physics.js';

const trial = (title, instruction, observe, values = {}) =>
  ({title, instruction, observe, values: {...DOOR_DEFAULTS, ...values}, reset: true, part: 'system', isolate: false, view: 'front'});

export const doorCloserLesson = {
  simple: 'How can a spring shut a door without letting it slam?',
  overview: 'Opening the door turns a shaft, moves a rack and piston, and compresses a spring. After release, the spring drives the same parts backward. Oil must pass from one side of the piston to the other through a restricted passage, which slows the return. Follow the door plan, enlarged cutaway, highlighted oil path and angle trace together. Press Play, then compare a valve change with a change in spring strength.',
  steps: [
    {title: 'Store part of the opening work', body: 'The hand turns the door and shaft. A fixed pinion moves the rigid rack left, so the piston compresses the spring. Some hand work is stored; some already becomes heat through friction and oil resistance.'},
    {title: 'Let oil cross the piston', body: 'The shrinking spring chamber sends oil through the opening bypass. Beyond the back-check angle, an enabled back check selects a more restrictive path. The highlighted path and arrow show where oil is going.'},
    {title: 'Release and reverse', body: 'At the target angle the hand lets go. If its push is too weak to get there, it releases at the first turning point instead. Momentum may carry the door farther before the spring begins the return.'},
    {title: 'Control the return with a restriction', body: 'During closing, oil moves from the right chamber back toward the spring. The opening bypass shuts. A smaller sweep passage needs more pressure for the same flow, producing greater resistance and a slower main sweep.'},
    {title: 'Reach the latch', body: 'Near shut, a separate latch passage controls speed. The bolt adds a resisting load. A strong enough spring can finish slowly; a weaker spring may need arrival energy or stop short. The final result reports what happened.'},
  ],
  parts: [
    {name: 'Frame, hinge and swing', role: 'The pivot, physical stop and colored sweep zones.'},
    {name: 'Door leaf, in plan', role: 'A rotating leaf whose width and mass determine its inertia.'},
    {name: 'Latch bolt and strike', role: 'The load the closing door must overcome near shut.'},
    {name: 'Closer, cut open', role: 'Fixed shaft, rigid rack, piston and compression spring moving together.'},
    {name: 'Oil paths and valves', role: 'The selected route connects the two oil chambers; inactive routes are shut.'},
    {name: 'The angle, through the swing', role: 'Blue traces elapsed motion; the faint curve previews the calculated whole swing.'},
  ],
  tryIt: [
    trial('Let it close', 'Press Play with the normal settings.', 'The spring shortens during opening, expands after release and closes the door. Oil takes the bypass, back-check, sweep and latch paths at different stages.'),
    trial('Turn the sweep valve down', 'Press Play with the smaller sweep passage.', 'The main closing sweep takes about four times as long. The spring setting and latch passage stay unchanged.', {sweep: 0.15}),
    trial('Open the sweep valve up', 'Press Play with the larger sweep passage.', 'The door returns through the main sweep much faster. Compare the sweep time and arrival speed with the normal trial.', {sweep: 0.6}),
    trial('Shut the latch valve down', 'Press Play with the smaller latch passage.', 'The main sweep is unchanged. The final approach is much slower, but this spring still drives the bolt home.', {latch: 0.15}),
    trial('Throw it open with the back check off', 'Press Play with a strong push and no back check.', 'The door strikes its opening stop. The energy budget reports energy absorbed there.', {push: 150, backcheck: 0}),
    trial('Throw it open with the back check on', 'Press Play with the same strong push and back check enabled.', 'The selected opening restriction raises pressure and removes motion energy. In this trial the door turns back before the stop.', {push: 150}),
    trial('Fit a spring too weak for the door', 'Press Play with the weakest spring level.', 'The door opens, then returns but stops short at the bolt. Stored spring energy remains at the end.', {size: 1}),
    trial('Push too gently to reach the target', 'Press Play with a weaker hand push and the normal release target.', 'The door turns back before reaching its target. Hand release reports the actual earlier angle; the door still closes afterward.', {push: 30}),
    trial('Try a wider, heavier leaf', 'Press Play with the largest door preset and the normal spring.', 'The larger inertia changes opening and closing motion. This door still latches because it arrives with enough motion energy.', {door: 7}),
    trial('Take arrival energy from the heavy leaf', 'Press Play with the same large leaf and a smaller latch passage.', 'The last part slows enough that the spring cannot overcome the bolt load. Compare this stopped-short result with the preceding trial.', {door: 7, latch: 0.15}),
  ],
  deeper: [
    {title: 'Why diameter matters so much', body: 'For the declared sharp-orifice model, Q = Cd A sqrt(2 ΔP / ρ). Rearranging gives ΔP = ρ Q² / (2 Cd² A²). Halving a circular hole’s diameter quarters its area and multiplies the pressure required for the same flow by sixteen. With nearly unchanged driving torque, the resulting steady flow is about one quarter as large. This explains the slower sweep; it is not a calibration of a real needle valve.'},
    {title: 'Spring torque and hydraulic resistance work together', body: 'The piston flow is its area times rack speed. The rack speed is pinion radius times shaft speed. Pressure acts on the piston and returns a resisting torque through the pinion. Both spring torque and restriction size therefore affect closing speed; the spring does not set force independently of all motion.'},
    {title: 'Why the heavy door behaves differently', body: 'A uniform leaf has hinge inertia I = m b² / 3. More mass or width requires more torque for the same angular acceleration. During a slow sweep, inertia matters less because the door is nearly at a balance between driving and resisting torques. At release and near the latch, its stored motion energy can matter greatly.'},
    {title: 'Why the last stretch has another valve', body: 'The latch path can change final approach speed while leaving the main sweep unchanged. In this model it takes over below 12 degrees, and the bolt resists the last 5 degrees. A slow approach can still latch with sufficient spring torque. Compare the two heavy-leaf trials to see a case where removing arrival energy instead prevents latching.'},
    {title: 'What the back check can and cannot do', body: 'The model selects a restrictive opening path beyond 70 degrees. Hydraulic resistance grows with speed and spends energy as heat. A physical stop still matters: back check is resistance, not a lock or a guarantee against impact. The cited TS 83 describes its own self-regulating backcheck; this constant-orifice calculation does not reproduce that product’s internal response.'},
    {title: 'Account for the whole swing', body: 'Hand work becomes oil heat, friction heat, bolt work, impact energy and any energy left in the spring or moving door. The final energy balance keeps these terms separate. Spring energy is measured above the closed, preloaded position, so a zero reading at shut does not mean the spring has no preload.'},
  ],
  misconception: 'Oil supplies resistance, not the energy that closes the door. The spring supplies that energy. A speed adjustment changes motion and arrival energy, so it can affect whether a particular load latches, but it does not strengthen the spring.',
  limits: 'This is a supplementary hydraulic-closer lesson. The book’s door-return spring illustration uses a stretched spring; it does not supply this hydraulic design. The scene uses an ideal direct shaft drive instead of an overhead arm linkage. Seven spring levels are declared model settings, not certified EN power sizes. The reference level supplies 47 N·m at 60 degrees, split equally between preload and added torque; other levels use declared multiples. Reference door widths and test masses come from the dhf guide, whose test masses are not service-weight limits. The model assumes a 38.1 mm bore, 12 mm pinion radius, oil density 870 kg/m³, discharge coefficient 0.62, ideal switched passages, a constant bolt load and a uniform leaf. It omits oil compressibility, leakage, temperature, wind, detailed valve porting and the real arm geometry. Very high computed pressure exposes those idealizations; it is not a hardware prediction. Neither the timing nor the spring level certifies an installed door.',
  sources: [
    {title: 'LCN: Door Closer Reference Guide, hydraulic mechanism and 4040XP anatomy', url: 'https://www.lcnclosers.com/content/dam/allegion-us-2/web-files/lcn/information-documents/LCN_4040XP_Brochure_015520.pdf'},
    {title: 'dormakaba: TS 83 technical brochure, separate closing ranges and backcheck', url: 'https://dormakaba-res.cloudinary.com/image/upload/v1745407038/dormakaba-prod/120000000136-dormakaba-door-closer-ts83-technical-folder-en.pdf'},
    {title: 'dhf: Controlled Door Closing Devices, test dimensions and rating distinctions', url: 'https://www.dhfonline.org.uk/media/documents/documents37a.pdf'},
    {title: 'OpenStax: Bernoulli’s equation and fluid flow', url: 'https://openstax.org/books/university-physics-volume-1/pages/14-6-bernoullis-equation'},
  ],
  quiz: {
    question: 'With the same spring and door, which change slows the main closing sweep?',
    options: [
      'Make the sweep passage smaller, increasing resistance at the same flow.',
      'Make the sweep passage larger, letting oil cross more easily.',
      'Increase the hand push, so the return must always be slower.',
    ],
    answer: 0,
    explanation: 'The smaller sweep passage needs more pressure to pass the same oil flow. That pressure resists the piston, so the door settles to a slower sweep. The separate latch passage governs the final approach.',
  },
};

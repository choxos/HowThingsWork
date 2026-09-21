import {WHISK_DEFAULTS, MIXER_DEFAULTS} from './beaters-physics.js';

const whiskTrial = (title, instruction, observe, values = {}) => ({title, instruction, observe, values: {...WHISK_DEFAULTS, ...values}, reset: true, part: 'system', isolate: false, view: 'front'});
const mixerTrial = (title, instruction, observe, values = {}) => ({title, instruction, observe, values: {...MIXER_DEFAULTS, ...values}, reset: true, part: 'system', isolate: false, view: 'front'});

const beaterDrag = 'The beaters’ drag uses the standard laminar plus turbulent power curve of a stirrer with teaching constants, and mixture thicknesses and densities that are teaching values: water, raw egg whites, soft peaks, stiff peaks and cookie dough.';

export const eggWhiskLesson = {
  simple: 'How does one slow turn of a handle become two fast beaters turning opposite ways, and why is stiff foam so hard work?',
  overview: 'A hand egg whisk uses bevel gears. The handle turns a large crown wheel with teeth on both faces. A small pinion meshes with each face, so the two beater shafts turn several times faster than the handle and in opposite directions. The speed-up has a price: in a thick mixture the drag on the beaters grows with their speed, so at a fixed crank rate the force on the handle grows approximately with the square of the gear ratio.',
  steps: [
    {title: 'Turn the crank', body: 'The crank is fixed to the crown wheel, so one turn of the handle is one turn of the wheel.'},
    {title: 'Mesh with the crown', body: 'The crown wheel carries teeth on both faces near its rim. At the bottom of the wheel, a pinion on a vertical shaft meshes with each face.'},
    {title: 'Speed the beaters up', body: 'Each pinion turns once for every twelve crown teeth that pass, so the beaters turn crown teeth over pinion teeth times as fast as the crank.'},
    {title: 'Turn them opposite ways', body: 'The front pinion meets the teeth on the front face and the back pinion the teeth on the back. The teeth pass both pinions the same way, so the pinions, and the beaters, turn in opposite directions.'},
    {title: 'Pass the blades', body: 'The beaters overlap. Their blades are set 45 degrees apart and the gears keep them in step, so the blades pass through each other’s space without touching.'},
    {title: 'Feel the mixture', body: 'In this teaching model, thick foam resists approximately in proportion to how fast the beaters move. Speeding the beaters up by a ratio multiplies that resistance by the ratio and the handle’s share of it by the ratio again, so the force grows with the ratio squared.'},
  ],
  parts: [
    {name: 'Crank and crown wheel', role: 'The input: a large wheel with teeth on both faces, turned directly by the hand.'},
    {name: 'Bevel pinions', role: 'Small gears on the beater shafts, one on each face of the crown wheel, turning much faster and in opposite directions.'},
    {name: 'Beaters', role: 'Two four-bladed wire beaters that overlap and pass between each other.'},
    {name: 'Frame and handle', role: 'Holds the axle and shafts and gives the other hand a grip.'},
    {name: 'Bowl and mixture', role: 'The load: its thickness sets how hard the beaters are to turn.'},
  ],
  tryIt: [
    whiskTrial('Beat soft peaks', 'Play with the middle gears, soft peaks, a 1.5 turn a second crank rate and 12 N to give.', 'The pinions turn four times for each turn of the crank, so the beaters spin at 360 rpm in opposite directions. The crank needs 4.9 N, and 2.63 W goes into the mixture.'),
    whiskTrial('Beat water', 'Choose water and play.', 'Water barely resists: 0.46 N on the crank. Its Reynolds number is 16,224, and inertial drag dominates this comparison.', {mixture: 0}),
    whiskTrial('Beat stiff peaks', 'Choose stiff peaks and play.', 'Holding 1.5 turns a second would need 28.4 N. Your 12 N slows the crank to 0.64 turns a second and the beaters to 153 rpm.', {mixture: 3}),
    whiskTrial('Try cookie dough', 'Choose cookie dough and play.', 'A hand whisk is the wrong tool: the aimed rate would need 942.8 N, and your hand turns the crank only 0.02 turns a second.', {mixture: 4}),
    whiskTrial('Use the smallest crown', 'Choose the smallest crown wheel and play.', 'Three to one turns the beaters at 270 rpm for only 2.73 N.', {gear: 0}),
    whiskTrial('Use the largest crown', 'Choose the largest crown wheel and play.', 'Five to one reaches 450 rpm but needs 7.72 N: 1.67 times the speed of three to one for 2.83 times the force, close to the ratio squared.', {gear: 2}),
    whiskTrial('Crank twice as fast', 'Aim for 3 turns a second and play.', 'The beaters reach 720 rpm and the force rises to 10.16 N, a little more than double, while the power rises to 11.49 W.', {rate: 3}),
    whiskTrial('Stiff peaks with less speed-up', 'Choose stiff peaks and the smallest crown wheel.', 'With your hand at its 12 N limit, three to one turns the beaters at 203 rpm, faster than the 153 rpm of four to one. When force is what runs out, less speed-up beats faster.', {mixture: 3, gear: 0}),
    whiskTrial('Push harder on stiff peaks', 'Choose stiff peaks and give 30 N.', 'Now the crank holds 1.5 turns a second with 28.4 N, putting 15.23 W into the foam.', {mixture: 3, force: 30}),
    whiskTrial('Crank slowly', 'Aim for 0.5 turns a second and play.', 'The beaters turn at 120 rpm for 1.59 N.', {rate: 0.5}),
  ],
  deeper: [
    {title: 'A crown wheel and two pinions', body: 'A crown wheel is a gear with its teeth on its face rather than its rim, so a pinion can mesh with it at right angles. With the same tooth size on both, the pinion turns crown teeth over pinion teeth times as fast: 48 over 12 is four. Two pinions on opposite faces are pushed the same way by the teeth passing between them, which makes them turn opposite ways. With equal beater loads, their opposite reaction torques about the vertical shafts cancel. The holding hand still resists the crank torque about the horizontal axle; unequal loads would also leave a twisting reaction.'},
    {title: 'Why the force grows as the ratio squared', body: 'In a thick mixture the drag torque on a beater is nearly proportional to its speed. A ratio G makes the beaters G times faster, so each needs G times the torque, and the crank must supply G times that again. Changing from three to one to five to one raises the force from 2.73 N to 7.72 N, close to five thirds squared.'},
    {title: 'Thick and thin mixtures', body: 'For this rotating stirrer, Reynolds number is density times turns per second times beater diameter squared, divided by viscosity. It compares fluid inertia with viscosity. Soft peaks flow at a Reynolds number of about 1, where drag is proportional to speed; water at 16,224, where drag grows with the square of speed in this fixed-property comparison. The scene does not simulate splashing or foam formation.'},
    {title: 'Blades that pass each other', body: 'The two beaters are closer together than their width, so their blades overlap between the shafts. Set 45 degrees apart and geared to turn at exactly the same speed in opposite directions, each blade crosses the overlap while the other beater’s blades are clear of it.'},
    {title: 'When your hand is the limit', body: 'If the hand can only give a fixed force, the crank slows until the drag matches it. In a thick mixture that makes the beater speed proportional to the force divided by the ratio, so a smaller crown wheel beats stiff foam faster than a bigger one. Speed-up only helps when there is force to spare.'},
  ],
  misconception: 'More gear speed-up is not always better. At a fixed crank rate in a viscous mixture, it raises the force approximately with the ratio squared, and once your hand is at its limit a smaller ratio turns the beaters faster.',
  limits: 'Illustrative hand whisk with a 60 mm crank, 12-tooth pinions on a 36, 48 or 60-tooth crown wheel of 2.5 mm module, gears 95% efficient, and two 52 mm four-blade beaters. ' + beaterDrag + ' The hand either holds its aimed crank rate or slows to the rate its force limit allows; no fatigue, no foam changing as it is whipped, no inertia. The 25-degree spherical-involute bevel teeth share cone apexes and an 8 mm face width, with 0.05 mm combined pitch backlash taken up on the driving flanks. Surface meshes approximate the ideal profiles; this is not a tooth-strength or manufacturing model. Animation runs at one quarter speed; its clock and work use trial seconds. Completion freezes the eight-second record rather than predicting a coast to rest. All five mixtures keep fixed effective viscosity and density; real foams and dough are non-Newtonian, and no whipping progress or air entrainment is predicted.',
  sources: [
    {title: 'KHK: bevel gear pitch cones and dimensions', url: 'https://khkgears.net/gear-knowledge/gear-technical-reference/calculation-gear-dimensions/'},
    {title: 'Dong, Zhang and Xu: spherical involute tooth surfaces', url: 'https://www.frontiersin.org/journals/mechanical-engineering/articles/10.3389/fmech.2025.1643228/full'},
    {title: 'University of Michigan: impeller Reynolds and power numbers', url: 'https://public.websites.umich.edu/~elements/01chap/html/reactors/mixing/dn.htm'},
    {title: 'OpenStax College Physics 2e: viscosity and laminar flow', url: 'https://openstax.org/books/college-physics-2e/pages/12-4-viscosity-and-laminar-flow-poiseuilles-law'},
    {title: 'OpenStax College Physics 2e: rotational work and power', url: 'https://openstax.org/books/college-physics-2e/pages/10-4-rotational-kinetic-energy-work-and-energy-revisited'},
  ],
  quiz: {
    question: 'Your hand is already pushing as hard as it can on stiff foam. Which crown wheel beats it faster?',
    options: [
      'The smaller one: less speed-up means less force per beater turn, so the crank turns faster.',
      'The bigger one, because it always multiplies the speed more.',
      'Neither: the beater speed depends only on the foam.',
    ],
    answer: 0,
    explanation: 'In thick foam the force grows as the ratio squared, so at a fixed force the crank rate falls as one over the ratio squared and the beater speed as one over the ratio.',
  },
};

export const electricMixerLesson = {
  simple: 'Why does a mixer slow its motor down, and what happens when thick dough and poor cooling make it too hot?',
  overview: 'A motor turns a single-start worm between two toothed wheels. Every motor turn moves each wheel one tooth, so the beaters turn much more slowly and in opposite directions. The reduction increases torque, while sliding friction uses some power. Thicker mixtures slow the motor and raise current. A fan on the same shaft carries heat away; an illustrative thermal cutoff opens if the motor gets too hot.',
  steps: [
    {title: 'Choose a voltage', body: 'The five settings apply 4.8 to 24 V to this permanent-magnet DC teaching motor. Higher voltage gives more available speed and torque. This is not a model of every household mixer motor.'},
    {title: 'Advance one tooth', body: 'A single thread is joined to the worm core on the motor shaft. One full turn advances both wheels one tooth. Thirty-tooth wheels turn once for thirty motor turns.'},
    {title: 'Keep both beaters in step', body: 'The worm meets the wheels on opposite sides. They turn opposite ways, with the beater blades set 45 degrees apart so they pass without touching.'},
    {title: 'Meet the load', body: 'Thick mixtures require more torque. The motor slows, its back EMF falls and current rises. It settles where available torque balances the mixture and the motor’s own drag.'},
    {title: 'Account for power', body: 'Electrical input becomes useful work in the mixture, copper and iron heating, bearing friction, worm friction and work moving air. Reduction changes speed and torque; it does not create power.'},
    {title: 'Move cooling air', body: 'The shaft-mounted fan moves air along the motor. Removing it visibly removes both blades and airflow. A slowing motor also turns its fan more slowly.'},
    {title: 'Stop and cool', body: 'The selected timer stops the motor, or the illustrative cutoff opens earlier at an 80 °C rise above room temperature. After a trip, the stopped fan cannot help. The motor cools naturally and stays off until a new trial.'},
  ],
  parts: [
    {name: 'Worm and both wheels', role: 'One thread drives two conjugate wheel profiles at 20:1, 30:1 or 40:1 reduction.'},
    {name: 'Both beaters', role: 'Interleaved wire loops turn opposite ways while their shafts stay fixed in the wheel bores.'},
    {name: 'Electric motor', role: 'Permanent magnets, a wound rotor, brushes and a segmented commutator convert electrical input into rotation.'},
    {name: 'Cooling fan', role: 'A fan on the motor shaft moves air over the motor while it runs.'},
    {name: 'Thermal cutoff', role: 'An illustrative temperature switch that visibly opens and stops the drive.'},
    {name: 'Shaft bearings', role: 'Bored sleeves and supported motor bearings hold the rotating shafts.'},
    {name: 'Housing and handle', role: 'A connected frame supports the drive, speed switch and hand grip.'},
    {name: 'Bowl and mixture', role: 'A fixed teaching load whose viscosity and density set the beater drag.'},
  ],
  tryIt: [
    mixerTrial('Whip stiff peaks', 'Run the default four-minute trial. Watch the clock, then inspect the stopped mixer.', 'While powered, the motor runs at 8,029 rpm and each beater at 268 rpm. The trial ends normally with a 7.5 °C motor temperature rise. Both speeds then read zero.'),
    mixerTrial('Mix cookie dough', 'Run cookie dough for one minute at setting 3 with the fan fitted.', 'The load slows the motor to 2,685 rpm and the beaters to 89 rpm. They receive 31.3 W. This short trial ends before the predicted 2.51-minute cutoff.', {mixture: 4, minutes: 1}),
    mixerTrial('Take the fan out', 'Run dough at setting 2 for eight minutes with the fan removed.', 'The fan and airflow disappear. Natural cooling is only 0.50 W per °C. The cutoff opens after 6.01 minutes; motor and beaters stop, and the motor cools for the rest of the trial.', {setting: 2, mixture: 4, fan: 0, minutes: 8}),
    mixerTrial('Keep the fan fitted', 'Repeat eight minutes in dough at setting 2 with the fan fitted.', 'Fan cooling delays the predicted trip to 9.24 minutes, so this eight-minute trial finishes normally. Compare the useful work delivered with the fan-removed trial.', {setting: 2, mixture: 4, fan: 1, minutes: 8}),
    mixerTrial('Beat water', 'Run the default trial with water.', 'Water offers little resistance. The motor reaches 8,547 rpm and the beaters receive only 0.12 W. Motor and fan losses still consume power.', {mixture: 0}),
    mixerTrial('Turn the speed down', 'Run stiff peaks at setting 1.', 'The motor runs at 2,627 rpm and each beater at 88 rpm. The beaters receive 0.90 W.', {setting: 1}),
    mixerTrial('Turn the speed up', 'Run stiff peaks at setting 5.', 'The motor reaches 13,387 rpm and each beater 446 rpm, receiving 23.4 W in total. More speed also produces more motor heat.', {setting: 5}),
    mixerTrial('Full speed in dough', 'Run dough at setting 5, with the fan fitted. Watch the cutoff, then let the trial finish.', 'The beaters initially receive 87.6 W, but the heavy current heats the motor quickly. The cutoff opens after 0.77 minutes. The fan stops with the motor, which cools for the remaining trial.', {setting: 5, mixture: 4}),
    mixerTrial('Fewer teeth on the wheels', 'Run stiff peaks with the 20-tooth wheels.', 'The beaters reach 381 rpm rather than the default 268 rpm. Their higher load slows the motor to 7,628 rpm. The coarser thread has a 7.71° lead and 55.2% efficiency in this model.', {wheel: 20}),
    mixerTrial('More teeth on the wheels', 'Run stiff peaks with the 40-tooth wheels.', 'More reduction slows the beaters to 205 rpm. Because the shaft spacing is fixed, the finer thread has a 3.87° lead and 38.6% efficiency. More reduction does not mean less friction loss per unit of useful power.', {wheel: 40}),
  ],
  deeper: [
    {title: 'Why speed reduction gives more torque', body: 'The worm’s single start advances each wheel one tooth per revolution. Each beater speed is motor speed divided by tooth count. The pair shares the output power equally, so each beater receives half the transmitted torque multiplied by the ratio. Losses reduce that gain.'},
    {title: 'Geometry and efficiency must agree', body: 'The shaft spacing is 44.5 mm and the worm pitch diameter is 12 mm. Keeping those dimensions fixes each wheel’s pitch radius at 16.25 mm. Changing tooth count changes axial module and lead: 7.71°, 5.16° or 3.87°. With 20° normal pressure angle and friction 0.1, the modeled efficiencies are 55.2%, 45.5% and 38.6%. Real efficiency also depends on lubrication, materials, speed, load and alignment.'},
    {title: 'Where the motor settles', body: 'For this DC motor, voltage equals resistance times current plus back EMF. Electromagnetic torque is current times the torque constant. Thick dough slows the rotor, reducing back EMF and increasing current. Copper heating rises with current squared. The torque constant, resistance and voltage are shared by the load and power calculations, so input power balances all outputs and losses.'},
    {title: 'Follow temperature through time', body: 'Motor heating equals copper, iron and bearing losses. One 240 J per °C heat capacity warms against natural and fan cooling. Temperature rise approaches heat input divided by thermal conductance. At the illustrative 80 °C rise threshold, the cutoff latches open: heat production and forced cooling stop. Natural cooling continues. A cooler final reading after a trip does not mean the motor never overheated.'},
    {title: 'Beater reactions cancel in one direction', body: 'Equal opposite beater loads cancel torque about the vertical shaft direction. Motor torque, worm thrust, unequal mixture forces and transient loads still reach the housing. The mixer does not become force-free in the hand.'},
    {title: 'Two useful time scales', body: 'The run clock advances twenty times faster than real time so a long heating trial stays short. Rotation is shown sixty times slower than actual operation so teeth can be inspected. Ratios and cutoff events stay synchronized, but revolutions seen on screen are not a count of revolutions during the heating trial.'},
  ],
  misconception: 'A fan does not guarantee that a heavily loaded motor stays cool. Slow running reduces its airflow, and high current can produce heat faster than even a fitted fan removes it.',
  limits: 'Illustrative 24 V permanent-magnet DC mixer, not a calibrated appliance or a universal AC motor. Ideal no-load speed 15,000 rpm and stall torque 0.6 N·m; resistance and torque constant are derived consistently from those values. Steady operating speed is reached immediately; startup, inertia, coasting, saturation, temperature-dependent resistance and controller behavior are omitted. A one-start, straight-sided axial worm drives relieved conjugate wheel flanks; finite tessellation, 0.02 mm radial relief and simplified tooth roots are for teaching, not manufacturing. Friction 0.1 is illustrative and fixed. ' + beaterDrag + ' The 52 mm beater loads are equal and fixed; no foam growth or food-quality prediction. Motor heat is lumped into one 240 J per °C node; worm heat and fan work are outside it, and their thermal coupling is omitted. Natural conductance is 0.5 W per °C; fan cooling scales with speed. The 80 °C rise cutoff is an explicit teaching extension, not a product safety rating. Replay or any changed setting starts a cold trial. Displayed gear motion and the heating clock use separate time scales.',
  sources: [
    {title: 'KHK: worm dimensions, lead and tooth geometry', url: 'https://khkgears.net/gear-knowledge/gear-technical-reference/calculation-gear-dimensions/'},
    {title: 'KHK: worm efficiency and operating conditions', url: 'https://khkgears.net/pdf/worm-tech.pdf'},
    {title: 'maxon: motor equations, torque, back EMF and losses', url: 'https://support.maxongroup.com/hc/en-us/articles/360013761160-Motor-data-and-simulation'},
  ],
  quiz: {
    question: 'Why can thick dough make this motor slow down and heat up?',
    options: ['More load lowers speed and back EMF, so current and copper heating rise.', 'The worm gear slips whenever the mixture is thick.', 'The cooling fan adds electrical voltage to the motor.'],
    answer: 0,
    explanation: 'The load needs more torque. In this DC model, lower speed means less back EMF and more current; copper heating grows with current squared. Slower rotation also reduces fan cooling.',
  },
};

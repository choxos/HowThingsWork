import {WATCH_DEFAULTS, balance} from './watch-physics.js';
import {WATCH_CONTACT_ANGLES} from './watch-escapement.js';

const trial = (part, view = 'front', isolate = false) => (title, instruction, observe, values = {}, initialState = {phase: 0}) => ({title, instruction, observe, values: {...WATCH_DEFAULTS, ...values}, initialState, reset: true, part, isolate, view});
const watchTrial = trial('movement');
const leverTrial = trial('escapement');
const springTrial = trial('hairspring');
const barrelTrial = trial('barrel');
const chartTrial = trial('charts', 'front', true);
const startingSwing = balance(WATCH_DEFAULTS).amplitude;
const phaseAtAngle = (angle, side = 0) => ({phase: side / 2 + Math.acos(-angle / startingSwing) / (2 * Math.PI)});
const limits = 'Original teaching movement with an English-form ratchet lever, not a replica of a particular watch. The 49 mg balance is treated as a thin ring of mean radius 4.5 mm; support-spoke, roller and spring inertia are neglected. The active hairspring is 84.0035 mm at the center regulator setting and 20 °C, plus a 2 mm terminal; its section is 0.12 × 0.03 mm and its reference modulus is 195 GPa. One regulator mark changes active length by 0.02%. The 220 × 1.2 × 0.14 mm mainspring uses a declared linear bending law with a 200 GPa modulus and 5.5 turns of usable winding above its free shape. Thirty percent of mean barrel work reaches an oscillator with Q = 250. The uncompensated thermal example uses an illustrative modulus slope of −240 ppm/°C and expansion of 11.5 ppm/°C. The ideal compensated example has expansion of 8 ppm/°C and a modulus chosen to exactly cancel size changes; neither is a commercial alloy specification. Balance expansion is 12 ppm/°C. Spring contours preserve ribbon length, end attachment and coil clearance; their shapes are kinematic illustrations, not elastic stress solutions. Balance motion is a settled harmonic approximation. Tooth, fork, jewel, banking and safety contacts are geometric; short clearance travel is interpolated, not a collision simulation. Positional errors, magnetism, shock transients, lubrication, finite-amplitude spring error and thermal expansion of the train are omitted. Winding and hand setting are prepared states; their hardware is omitted. The upper impulse roller is translucent to expose the jewel. Playback covers two watch seconds at one-tenth speed.';
const sources = [
  {title: 'H. R. Playtner: An Analysis of the Lever Escapement', url: 'https://www.gutenberg.org/ebooks/21978'},
  {title: 'OpenStax University Physics: torsional pendulums', url: 'https://openstax.org/books/university-physics-volume-1/pages/15-4-pendulums'},
];

export const watchLesson = {
  simple: 'How does a wound spring become seconds, minutes and hours without a battery?',
  overview: 'Follow one connected drive through an open mechanical watch. The mainspring turns a barrel; four meshing gear pairs carry its push to a lever escapement. The balance wheel and hairspring set the rhythm, while the same train turns the hands. Freeze an unlocking, impulse or release to see the contact, then compare winding, regulation and temperature.',
  steps: [
    {title: 'Store energy in the mainspring', body: 'Winding bends a steel ribbon away from its free shape. In this running view its inner end is held at the arbor, while the outer hook pulls the barrel around. The 96-tooth barrel gear drives a 12-tooth pinion.'},
    {title: 'Carry the drive through the train', body: 'The center, third, fourth and escape arbors are connected by real meshing teeth. Each wheel and its pinion turn together. The four speed ratios multiply to 7,680 escape-wheel turns for one barrel turn.'},
    {title: 'Let the balance unlock a pallet', body: 'The hairspring brings the balance back toward its middle position. Its flat-faced ruby enters the fork and pushes the lever away from a banking pin. The escape wheel recoils slightly as the tooth climbs the sloped locking face.'},
    {title: 'Return a push to the balance', body: 'Once unlocked, the wheel tooth slides along the inclined pallet face. It drives the lever through the opposite side of the fork, giving the balance energy. This ratchet-tooth design puts the lifting action on the pallet.'},
    {title: 'Catch the next tooth and swing free', body: 'The departing tooth clears its pallet, leaving a short free drop before the other pallet catches a tooth. Draw brings the lever to the opposite bank. The ruby leaves the fork; horns and a notched safety roller guard against accidental unlocking.'},
    {title: 'Count the oscillations', body: 'At the nominal rate the balance completes four cycles per second, with eight alternating beats. The 15-tooth escape wheel turns 16 times per minute, the fourth wheel once per minute, and the center wheel once per hour. A separate twelve-to-one reduction turns the hour hand.'},
  ],
  parts: [
    {name: 'Mainspring and barrel', role: 'Store energy in one continuous ribbon and transmit its torque to the first gear pair.'},
    {name: 'Wheel train', role: 'Carry torque to the escapement and connect the minute and seconds arbors.'},
    {name: 'Lever escapement', role: 'Alternate locking, unlocking, impulse and release through actual working contacts.'},
    {name: 'Balance wheel and rollers', role: 'Provide rotational inertia, carry the impulse jewel and operate the safety roller.'},
    {name: 'Hairspring and regulator', role: 'Supply restoring torque; movable curb pins choose the active spring length.'},
    {name: 'Twelve-to-one hand reduction', role: 'Turn the hour sleeve once for twelve minute-arbor revolutions.'},
    {name: 'Watch face and hands', role: 'Show seconds, minutes and hours from the same mechanical train.'},
    {name: 'Plate, bearings and supports', role: 'Keep the rotating arbors aligned and hold the fixed spring attachments.'},
    {name: 'Wind and temperature comparisons', role: 'Compare predicted swing and rate on labeled explanatory plots.'},
  ],
  tryIt: [
    watchTrial('Fully wound', 'Play the assembled movement, then pause it.', 'The initial supported swing is 242.47° each way at 4 Hz, or 28,800 beats per hour. The ideal compensated setting has 0.00 s/day of modeled rate error.'),
    leverTrial('The balance unlocks the wheel', 'Inspect the entry pallet as the ruby enters the fork.', 'Working contact says Unlocking. The balance drives the fork, and the escape wheel recoils slightly on the locking face.', {}, phaseAtAngle((WATCH_CONTACT_ANGLES.enter + WATCH_CONTACT_ANGLES.unlock) / 2)),
    leverTrial('A push on the entry pallet', 'Freeze the middle of the first impulse.', 'Working contact says Impulse, Entry pallet. The tooth and pallet touch while the opposite fork wall pushes the ruby.', {}, {phase: 0.25}),
    leverTrial('A push on the exit pallet', 'Compare the return beat.', 'Working contact says Impulse, Exit pallet. The lever and balance move the other way, but the wheel still advances in the same direction.', {}, {phase: 0.75}),
    leverTrial('The brief free drop', 'Freeze just after the entry tooth leaves its pallet.', 'Working contact says Free drop. Neither pallet touches a tooth during this clearance interval.', {}, phaseAtAngle(WATCH_CONTACT_ANGLES.release + WATCH_CONTACT_ANGLES.drop / 2)),
    leverTrial('One tooth, two beats', 'Compare the mechanism after one complete balance cycle.', 'The release counter reads 2. The escape wheel has advanced one of its 15 teeth; the lever has returned to its first bank.', {}, {phase: 1}),
    trial('train', 'iso', true)('Follow the connected train', 'Inspect the center, third and fourth wheels and their pinions.', 'Each large wheel drives the next small pinion in the opposite direction. The center arbor turns once for 60 fourth-wheel turns.'),
    trial('watch-face', 'back')('Read the three hands', 'Prepare ten hours of use and play while looking at the front face.', 'The prepared dial starts at 10:00, with hour and minute hands apart. The small seconds hand advances through the fourth-wheel arbor. All three hands are mechanically connected, not independent animations.', {hours: 10}),
    trial('motion-work', 'iso', true)('Reduce minutes to hours', 'Inspect the two small gear pairs under the face.', 'The 12:36 and 10:40 pairs give 3 × 4 = 12. Two direction reversals keep minute and hour hands turning together.'),
    springTrial('Shorten the active spring', 'Move the regulator one mark toward fast.', 'The curb pins move along the terminal, leaving 83.9867 mm active at 20 °C. The watch gains 8.64 s/day. No ribbon is removed.', {index: 1}),
    barrelTrial('A day of nominal use', 'Prepare the wind remaining after 24 nominal hours.', 'The spring retains 2.5 winding turns. Torque is 3.9184 mN·m and supported swing is 163.47°, while the ideal frequency remains 4 Hz.', {hours: 24}),
    chartTrial('Almost run down', 'Prepare 43 nominal hours of use.', 'Only 0.125 winding turn remains. Torque is 0.1959 mN·m and supported swing is 36.55°, still above this model’s engagement threshold.', {hours: 43}),
    watchTrial('No wind left', 'Prepare 44 nominal hours of use.', 'The mechanism stops and playback is blocked. Continuing power is zero; the running-rate reading is unavailable and its chart marker is hidden.', {hours: 44}),
    chartTrial('An uncompensated warm spring', 'Choose the uncompensated thermal response at 30 °C.', 'With the stated illustrative coefficients, the watch loses 99.21 s/day. Warming weakens this spring enough to slow its natural oscillation.', {alloy: 0, temperature: 30}),
    chartTrial('Ideal thermal compensation', 'Compare the compensated response at 30 °C.', 'The model remains at 4 Hz and 0.00 s/day of rate error because its chosen modulus change exactly balances expansion. This is an ideal comparison, not a promise about a real alloy.', {temperature: 30}),
    watchTrial('Work replaces losses', 'Compare mainspring torque, delivered work and balance energy.', 'Initially the balance receives a mean 0.0705 µJ per beat, or 0.5642 µW. Its settled oscillation holds 5.6123 µJ. Those figures follow the connected train and the declared losses.'),
  ],
  deeper: [
    {title: 'What sets the rate?', body: 'For the ideal torsional oscillator, frequency is √(κ/I)/(2π): κ is restoring torque per radian and I is rotational inertia. The modeled flat spring has κ = Ewt³/(12L), with modulus E, ribbon height w, thickness t and active length L. Shortening L increases stiffness and frequency.'},
    {title: 'Why the regulator does not cut the spring', body: 'Two curb pins constrain a point near the outer end. Moving that constraint changes how much ribbon flexes with the balance. The remaining terminal still exists between the pins and the fixed stud. This model treats the pins as an ideal clamp; real pin clearance also affects behavior.'},
    {title: 'Draw, horns and the safety roller', body: 'Draw holds the lever at a bank between beats. If a jolt tries to move it, the guard dart meets the safety roller before a pallet can unlock. Near the roller notch, the fork horns protect the handoff to the ruby. The notch provides room for the normal working stroke.'},
    {title: 'Where the stored energy goes', body: 'The illustrative mainspring obeys τ = κₘθ and stores κₘθ²/2 above its free shape. Gearing trades angular speed for torque; it does not create energy. The chosen transmission efficiency and quality factor determine the settled amplitude. The rate calculation neglects disturbance from the escapement.'},
    {title: 'Winding and usable reserve', body: 'The declared 5.5 winding turns correspond to 44 hours at the nominal train rate. Usable reserve is slightly shorter because the balance eventually cannot cross the engagement region. Here that geometric threshold is 18.23° each way. It is not a general stopping amplitude for real watches.'},
    {title: 'Temperature and real watch errors', body: 'Temperature changes spring elasticity and dimensions, and the balance’s size. Compensation aims to make their combined effect small. Actual watches also respond to position, magnetism, lubrication, shocks and the changing swing as wind runs down; the ideal compensated curve does not include these errors.'},
    {title: 'Ratchet teeth and club teeth', body: 'The English-form ratchet wheel used here supplies impulse through a point sliding along a pallet. A club-tooth design divides the lifting action between wheel tooth and pallet. Both use a detached balance, but their working faces must be constructed differently.'},
  ],
  misconception: 'More winding mainly supplies more energy and supports a wider swing. It does not choose the ideal oscillator’s natural frequency. Real watches can still change rate as their amplitude changes.',
  limits,
  sources,
  quiz: {
    question: 'With the same wind and temperature, what happens when the regulator shortens the active hairspring?',
    options: ['Restoring stiffness increases, so the balance oscillates faster.', 'The gears change their tooth ratios.', 'The mainspring gains stored energy.'],
    answer: 0,
    explanation: 'Shorter active length makes κ larger. With the same rotational inertia, √(κ/I)/(2π) increases. The gear ratios and prepared mainspring winding remain unchanged.',
  },
};

export const leverEscapementLesson = {
  simple: 'How can a watch keep its balance swinging while letting the spring-driven wheels advance one tooth at a time?',
  overview: 'Follow a detached ratchet lever inside the connected watch. Look inside removes the upper hairspring and bridge from the view so the working contacts stay visible; turn it off to restore them. A tooth rests against one ruby pallet while the balance swings freely. Near the middle of a swing, the balance jewel enters the fork and unlocks that pallet. The tooth then pushes its sloping impulse face, sending energy back through the fork to the balance. A short drop transfers the wheel to the opposite pallet. The next beat repeats the exchange in the other direction.',
  steps: [
    {title: 'Hold the train', body: 'The mainspring presses a tooth against a locking face. Its slope draws the lever toward a banking pin; the balance jewel is outside the fork.'},
    {title: 'Spend energy to unlock', body: 'The returning jewel takes up one fork wall and turns the lever away from its bank. The locking face pushes the escape wheel slightly backward before the tooth reaches the impulse face.'},
    {title: 'Take up clearance', body: 'The tooth begins driving the pallet and lever. A tiny gap lets the fork exchange its driving wall without pinching the finite-width jewel.'},
    {title: 'Return energy to the balance', body: 'The tooth slides along the impulse face. The opposite fork wall now pushes the jewel in the direction the balance is moving.'},
    {title: 'Drop, lock and draw', body: 'After leaving the impulse face, the tooth crosses a small gap with neither pallet in contact. The opposite locking face catches the wheel and draws the lever toward its other bank.'},
    {title: 'Leave the balance free', body: 'The jewel leaves the fork. The hairspring slows and reverses the balance for the return beat. One full back-and-forth cycle advances the escape wheel by one tooth space.'},
  ],
  parts: [
    {name: 'Escape wheel and pinion', role: 'Bring torque from the train to 15 ratchet teeth; one complete balance cycle releases one tooth space.'},
    {name: 'Pallet lever and fork', role: 'Link the two pallet stones to the fork; rotate ten degrees between the two banks.'},
    {name: 'Entry pallet', role: 'Lock the first tooth, unlock with slight recoil, then receive its impulse.'},
    {name: 'Exit pallet', role: 'Repeat the exchange on the return beat.'},
    {name: 'Fork and safety horns', role: 'Exchange driving walls around the jewel and help guide reentry while the roller notch passes the guard.'},
    {name: 'Flat-faced impulse jewel', role: 'First drive the fork during unlocking, then receive its push during impulse.'},
    {name: 'Guard dart', role: 'Work against the safety-roller rim to limit unintended lever movement outside the fork passage.'},
    {name: 'Notched safety roller', role: 'Turn with the balance; admit the guard through its notch only near the intended passage.'},
    {name: 'Balance wheel and rollers', role: 'Carry rotational inertia and the two rollers; continue swinging freely away from the fork.'},
    {name: 'Hairspring and regulator', role: 'Provide restoring torque and set the oscillator rate through the active spring length.'},
    {name: 'Mainspring and barrel', role: 'Supply the train with stored energy; less remaining winding produces a smaller settled balance swing.'},
  ],
  tryIt: [
    leverTrial('Start at the entry lock', 'Inspect the held tooth and the detached balance jewel.', 'Your result says Entry pallet, Locked; balance free. The lever rests at +5 degrees. The initial supported swing is 242.47 degrees each way.'),
    leverTrial('The balance pays to unlock', 'Freeze the incoming jewel against the fork wall.', 'The entry pallet is Unlocking. Power path now begins with Balance. The wheel has recoiled slightly from its initial lock.', {}, phaseAtAngle((WATCH_CONTACT_ANGLES.enter + WATCH_CONTACT_ANGLES.unlock) / 2)),
    trial('fork')('Exchange fork walls', 'Look closely just after the locking face releases.', 'Working contact says Taking up fork clearance. The tooth drives the lever while the fork crosses its small clearance around the jewel.', {}, phaseAtAngle(WATCH_CONTACT_ANGLES.unlock + WATCH_CONTACT_ANGLES.takeup / 2)),
    leverTrial('Push through the entry pallet', 'Inspect the middle of the first impulse.', 'The entry pallet is in Impulse. Power path now runs from the mainspring through the train, pallet and fork to the balance.', {}, {phase: 0.25}),
    leverTrial('Catch the free drop', 'Freeze the gap after the first impulse face ends.', 'Your result says Free drop; neither pallet touches. The wheel moves across the gap before the exit pallet catches it.', {}, phaseAtAngle(WATCH_CONTACT_ANGLES.release + WATCH_CONTACT_ANGLES.drop / 2)),
    trial('fork')('Draw toward the exit bank', 'Inspect the end of the first fork passage.', 'The exit locking face is Drawing to the bank. The lever approaches −5 degrees, then the jewel leaves the fork.', {}, phaseAtAngle((WATCH_CONTACT_ANGLES.release + WATCH_CONTACT_ANGLES.drop + WATCH_CONTACT_ANGLES.takeup + WATCH_CONTACT_ANGLES.leave) / 2)),
    leverTrial('Wait at the exit lock', 'Compare the opposite turning point of the balance.', 'The exit pallet holds the wheel, the lever rests at −5 degrees, and one release is complete. The balance is detached again.', {}, {phase: 0.5}),
    leverTrial('Unlock on the return beat', 'Inspect the opposite wall of the fork.', 'The exit pallet is Unlocking. The balance again spends energy to release the held tooth, with slight wheel recoil.', {}, phaseAtAngle((WATCH_CONTACT_ANGLES.enter + WATCH_CONTACT_ANGLES.unlock) / 2, 1)),
    leverTrial('Push through the exit pallet', 'Compare the second impulse with the first.', 'The exit pallet is in Impulse. Lever and balance move the other way, but the escape wheel again advances clockwise.', {}, {phase: 0.75}),
    leverTrial('Drop onto the entry pallet', 'Freeze the second short clearance gap.', 'Neither pallet touches during Free drop. The entry pallet is next to catch the wheel.', {}, phaseAtAngle(WATCH_CONTACT_ANGLES.release + WATCH_CONTACT_ANGLES.drop / 2, 1)),
    leverTrial('One tooth, two releases', 'Compare the starting lock with one full cycle later.', 'Completed releases reads 2 and Escape wheel advance reads 24.000 degrees. One of 15 tooth spaces has passed. The two individual half-step angles are slightly unequal.', {}, {phase: 1}),
    trial('safety-roller', 'iso')('Inspect the safety geometry', 'Compare the lower notched roller, guard dart and fork horns.', 'At this detached position the guard has clearance from the solid roller rim. The rim limits a displaced lever; the horns guide the jewel when the notch is near the guard. This view does not simulate a shock.'),
    leverTrial('Less winding, smaller swing', 'Prepare 24 nominal hours of use, then play both beats.', 'Supported swing falls to 163.47 degrees; mean energy per beat is 0.0321 microjoules. The balance spends 92.88% of each cycle outside the fork passage.', {hours: 24}),
    leverTrial('Close to the engagement limit', 'Prepare 43 nominal hours of use and play.', 'The 36.55-degree swing still clears the 18.233-degree passage threshold. Outside fork passage falls to 66.75%; mean beat energy is only 0.0016 microjoules.', {hours: 43}),
    leverTrial('Winding exhausted', 'Prepare all 44 nominal hours of use.', 'The balance rests, the escape wheel stays held, and playback is blocked. Mean delivered work and power are zero; no running rate or free-time fraction is reported.', {hours: 44}),
    leverTrial('Let the oscillator set the rate', 'Move the regulator five marks toward fast, then play.', 'The shorter active spring raises balance frequency to 4.002002 Hz and the ideal rate gains 43.23 seconds per day. The same 15 teeth and two releases per cycle remain.', {index: 5}),
    leverTrial('Warm the uncompensated spring', 'Compare a 30-degree setting with the default temperature.', 'The illustrative uncompensated spring gives 3.995407 Hz and loses 99.21 seconds per day. The escapement follows the slower balance; it does not impose its own pace.', {alloy: 0, temperature: 30}),
    leverTrial('Apply ideal thermal compensation', 'Keep 30 degrees and compare the ideal compensated response.', 'Frequency returns to 4.000000 Hz with zero modeled rate error. This exact cancellation is a declared idealization, not a commercial alloy claim.', {alloy: 1, temperature: 30}),
  ],
  deeper: [
    {title: 'Detached does not mean never touching', body: 'The harmonic balance is outside the ±18.233-degree fork passage for 95.21% of the fully wound cycle. That is a time fraction, derived from the angle trajectory, not the ratio of two angles. Small internal clearances can add more moments without contact. As winding weakens, the same passage occupies more of the smaller swing.'},
    {title: 'Draw explains the small recoil', body: 'An inclined locking face lets wheel torque hold the lever toward its bank. Unlocking must overcome that draw, so the wheel moves slightly backward. During impulse the mainspring returns more energy through the train and fork. The displayed energy is mean net delivered work per beat; the model does not resolve impact losses or an instantaneous torque waveform.'},
    {title: 'Ratchet teeth and pallet lift', body: 'This original English-form ratchet lever puts the lifting face on the pallet. A Swiss club-tooth design distributes lift differently. Shared principles do not make their geometry interchangeable.'},
    {title: 'Why the extra roller and horns?', body: 'The solid safety-roller rim obstructs the guard if the lever strays while the balance is detached. Its notch provides passage near the intended impulse. Around the transition, curved fork horns help guide the jewel. Clearances and overlap matter; these safeguards do not guarantee immunity to arbitrary shocks or damage.'},
    {title: 'Count cycles, then reduce them', body: 'Two beats release one 24-degree tooth space. At the nominal four cycles per second, this escape wheel turns 16 times per minute. Its 8-tooth pinion meshes with the fourth wheel’s 128 teeth, so the seconds arbor turns once per minute. Rate changes originate in the balance and hairspring.'},
    {title: 'Work and loss balance', body: 'The connected train transmits mean barrel work with a declared 30% overall delivery efficiency. With Q = 250, settled oscillator loss equals mean delivered work each cycle. Less winding reduces torque and amplitude. The ideal harmonic spring keeps the same natural frequency until insufficient swing prevents repeated releases; real escapement and spring errors are outside this model.'},
  ],
  misconception: 'The mainspring supplies energy; the balance and hairspring set the pace. The escapement links them by alternating restraint and impulse. It neither supplies energy by itself nor forces the balance to an independently chosen frequency.',
  limits: 'Look inside hides the upper hairspring, collar and balance bridge to expose the lower fork and safety contacts. Turn it off to see their assembled positions. ' + limits,
  sources,
  quiz: {
    question: 'The mainspring is weaker, but the balance still passes fully through the fork. What changes in this ideal model?',
    options: ['Mean work and swing decrease; the balance keeps the same natural frequency.', 'The escape wheel skips every other tooth to maintain its speed.', 'The fork replaces the missing mainspring energy.'],
    answer: 0,
    explanation: 'With the same spring stiffness and balance inertia, natural frequency stays fixed. Less mean energy supports a smaller swing. Once that swing cannot complete the fork passage, repeated releases stop.',
  },
};

const oscillatorTrial = trial('oscillator');
const energyTrial = trial('energy', 'front', true);
export const hairspringLesson = {
  simple: 'How does a thin spiral spring return a watch balance, exchange energy with it and set its natural pace?',
  overview: 'One end of the hairspring follows the balance collar; the other remains attached to a fixed stud. Turning the balance changes the ribbon’s curvature and stores elastic energy. Its restoring torque points back toward equilibrium. As the balance returns, that elastic energy becomes kinetic energy; inertia then carries the balance past equilibrium and bends the spring the other way. The blue arrow shows restoring torque. Look inside hides the upper bridge so the spring and attachments stay visible.',
  steps: [
    {title: 'Bend one attached ribbon', body: 'At the first turning point the balance has stopped momentarily. The spring is deflected, its elastic energy is greatest and its torque points back toward equilibrium.'},
    {title: 'Trade spring energy for motion', body: 'The returning balance speeds up as spring deflection decreases. The energy panel shows elastic energy falling while kinetic energy rises.'},
    {title: 'Cross with zero restoring torque', body: 'At equilibrium the spring torque and elastic energy are zero, but the balance is moving fastest. Its inertia carries it onward; zero torque does not mean zero motion.'},
    {title: 'Store energy on the other side', body: 'The balance now works against the spring. Motion slows, elastic energy rises and the opposite turning point is reached. Restoring torque has reversed direction.'},
    {title: 'Replace losses with the escapement', body: 'The mainspring supplies mean work through the toothed train and lever. The hairspring exchanges energy with the balance each swing; it is not the watch’s long-term energy supply.'},
    {title: 'Regulate the natural period', body: 'The curb pins change active spring length while the unused terminal remains attached. A shorter active ribbon is stiffer and produces a shorter period. Temperature can change both stiffness and balance inertia.'},
  ],
  parts: [
    {name: 'Balance and hairspring', role: 'The coupled oscillator: rotational inertia and a returning elastic ribbon.'},
    {name: 'Hairspring and regulator', role: 'One continuous ribbon with an active spiral and a retained outer terminal.'},
    {name: 'Inner spring collar', role: 'Attach the inner ribbon end to the rotating balance staff.'},
    {name: 'Fixed outer stud', role: 'Anchor the far end of the terminal in the movement.'},
    {name: 'Regulator and curb pins', role: 'Select working length without adding or removing ribbon material.'},
    {name: 'Balance wheel and rollers', role: 'Carry rotational kinetic energy and connect to the lever near equilibrium.'},
    {name: 'Spring and balance energy', role: 'An explanatory panel shows elastic and kinetic energy on one shared scale.'},
    {name: 'Wind and temperature comparisons', role: 'Separate comparison plots show winding-dependent swing and modeled thermal rate.'},
  ],
  tryIt: [
    oscillatorTrial('Spring energy at a turning point', 'Inspect the deflected spring before the balance returns.', 'Angle is −242.47 degrees, restoring torque is +2.6524 microNewton-meters, elastic energy is 5.6123 microjoules and kinetic energy is zero. The blue arrow points counterclockwise.'),
    energyTrial('Half spring energy, half motion', 'Compare both bars one eighth of a cycle later.', 'Each bar reads 2.8062 microjoules. The balance is returning toward equilibrium, so spring energy is becoming motion.', {}, {phase: .125}),
    oscillatorTrial('Zero torque, greatest speed', 'Freeze the first equilibrium crossing.', 'Angle and spring torque read zero. Angular velocity is +106.359 rad/s and kinetic energy is 5.6123 microjoules. The torque arrow disappears because the spring is momentarily undeflected.', {}, {phase: .25}),
    oscillatorTrial('Reverse the restoring torque', 'Compare the opposite turning point.', 'Angle is +242.47 degrees and restoring torque is −2.6524 microNewton-meters. Kinetic energy is again zero; the blue arrow now points clockwise.', {}, {phase: .5}),
    oscillatorTrial('Cross equilibrium the other way', 'Freeze the return crossing.', 'Restoring torque is again zero, but angular velocity is now −106.359 rad/s. The same equilibrium position can be crossed in either direction.', {}, {phase: .75}),
    energyTrial('Watch energy return to the spring', 'Inspect the balance moving away from equilibrium.', 'Elastic and kinetic energy are each 2.8062 microjoules. Your result now says Balance motion → spring energy.', {}, {phase: .375}),
    trial('spring-collar')('Find the moving inner attachment', 'Look where the blue ribbon reaches the collar.', 'The inner end follows the balance staff. During playback the ribbon bends while that attachment remains connected.'),
    trial('spring-stud')('Find the fixed outer attachment', 'Inspect the far end of the terminal.', 'The outer stud stays fixed while the active spiral opens and closes. The same whole ribbon remains present.'),
    trial('spring-regulator')('Shorten the working ribbon', 'Move the regulator five marks toward fast.', 'Active length becomes 83.9195 mm, stiffness rises to 0.627387 microNewton-meters per radian, and full-cycle period falls to 0.249875 seconds. The ideal rate gains 43.23 seconds per day.', {index: 5}),
    trial('spring-regulator')('Lengthen the working ribbon', 'Compare five marks toward slow.', 'Active length becomes 84.0875 mm, stiffness falls to 0.626133 microNewton-meters per radian, and period rises to 0.250125 seconds. The ideal rate loses 43.17 seconds per day.', {index: -5}),
    oscillatorTrial('Smaller swing, same natural period', 'Prepare 24 nominal hours of winding use.', 'Supported swing falls to 163.47 degrees and turning-point elastic energy to 2.5511 microjoules. The ideal period stays 0.250000 seconds; this is a full cycle, not a single tick.', {hours: 24}),
    energyTrial('Very little energy remains', 'Prepare 43 nominal hours of use.', 'Only 0.1276 microjoules remain in the settled oscillator, supporting a 36.55-degree swing. The energy bars use the same scale as before; the ideal period still stays 0.250000 seconds.', {hours: 43}),
    oscillatorTrial('The spring cannot supply its own losses', 'Prepare 44 nominal hours of use.', 'The balance rests, the torque arrow vanishes and both energies read zero. Playback is blocked. The natural spring-and-balance period is still defined, but the stopped watch has no running rate.', {hours: 44}),
    chartTrial('Warm an uncompensated spring', 'Choose the illustrative uncompensated response at 40 degrees.', 'The ideal ribbon stiffness becomes 0.624181 microNewton-meters per radian and period 0.250576 seconds. The modeled watch loses 198.56 seconds per day.', {alloy: 0, temperature: 40}),
    chartTrial('Cool the same example', 'Compare the uncompensated response at 0 degrees.', 'The stiffness becomes 0.629333 microNewton-meters per radian and period 0.249428 seconds. The modeled watch gains 198.02 seconds per day.', {alloy: 0, temperature: 0}),
    chartTrial('Cancel thermal effects ideally', 'Compare the ideal compensated response at 40 degrees.', 'Stiffness and balance inertia both increase, but their ratio remains fixed. Period is 0.250000 seconds and modeled rate error is zero. This is an exact teaching idealization, not a named alloy guarantee.', {alloy: 1, temperature: 40}),
    trial('movement')('Follow the replacement energy', 'Play the complete connected movement.', 'The mainspring drives the train and lever. Each nominal beat delivers 0.0705 microjoules on average to replace modeled losses, while about 5.6123 microjoules alternate between spring and balance.'),
    energyTrial('Return after one complete cycle', 'Compare the first turning point with one full cycle later.', 'Elapsed watch time reads 0.250000 seconds with two completed releases. At the displayed precision, the bars return to 5.6123 microjoules of spring energy and zero kinetic energy.', {}, {phase: 1}),
  ],
  deeper: [
    {title: 'Torque points toward equilibrium', body: 'The ideal law is τ = −κθ. Its minus sign means a positive angular displacement produces negative restoring torque, and vice versa. Torque vanishes at equilibrium, while angular speed can be greatest there. Inertia, rather than a continuing spring push, carries the balance across that point.'},
    {title: 'Where the stiffness formula comes from', body: 'A thin rectangular strip has bending rigidity Ebt³/12, where E is Young’s modulus, b is ribbon height and t is its radial thickness. Treating the active strip as bending under a uniform end couple gives κ = Ebt³/(12L). For the same material and section, shorter active length means greater angular stiffness. This ideal bending law does not calculate the detailed stress or end forces of a manufactured hairspring.'},
    {title: 'The period depends on a ratio', body: 'Combining Iθ̈ = −κθ with a harmonic solution gives T = 2π√(I/κ). The reference 49 mg thin ring at 4.5 mm mean radius has I = 9.9225 × 10⁻¹⁰ kg·m². With κ = 0.626759 microNewton-meters per radian, its period is 0.25 seconds: four complete cycles or eight beats per second.'},
    {title: 'Energy changes form', body: 'Elastic energy is U = κθ²/2; balance kinetic energy is K = Iω²/2. In the harmonic approximation their sum is the current settled oscillator energy. The panel resolves this exchange within a cycle. Average escapement work replaces average loss through the separate energy budget; the model does not resolve each instantaneous friction or impact loss.'},
    {title: 'Regulation does not cut the spring', body: 'The curb pins change which length is active. The inactive terminal and both attachments remain. At the reference setting the working length is 84.0035 mm, followed by a 2 mm terminal. Moving the regulator trades length between the working and inactive portions while retaining all ribbon material; temperature changes its dimensions through the stated expansion coefficient.'},
    {title: 'Why real watches need more than this equation', body: 'Real rate can depend on amplitude, position, end geometry, contact friction, magnetism and temperature. The offered thermal responses are declared numerical examples. Neither represents a universal steel grade, Nivarox specification or silicon spring. No overcoil or material-specific immunity is pictured or predicted.'},
    {title: 'A spiral spring can also return a pointer', body: 'A pressure instrument can use a hairspring to bias its pointer and maintain linkage tension. That is an equilibrium role rather than a freely repeating timing oscillator. This scene focuses on the watch balance; it does not simulate a pressure capsule or barometer linkage.'},
  ],
  misconception: 'The hairspring does store elastic energy when deflected, then returns it to the balance. The separate mainspring provides the long-term energy supply that replaces losses through the escapement.',
  limits: 'The blue torque arrow and energy panel are explanatory guides, not physical watch parts. Arrow arc length is proportional to torque magnitude; bars share a 0–6 microjoule scale. Angular velocity and energy partition use the current settled harmonic amplitude, without an amplitude-derivative or instantaneous impact-loss correction. Look inside hides the upper balance bridge. ' + limits,
  sources,
  quiz: {
    question: 'At the equilibrium crossing, the spring’s restoring torque is zero. What happens to the moving balance?',
    options: ['Its inertia carries it across; the spring then bends the other way and slows it.', 'It must stop because zero torque means zero speed.', 'The spring suddenly creates extra energy to push it across.'],
    answer: 0,
    explanation: 'Zero torque means zero instantaneous angular acceleration from the spring, not zero angular velocity. At equilibrium the ideal oscillator’s energy is kinetic; the returning torque grows with opposite displacement afterward.',
  },
};

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
  simple: 'How does a watch’s lever escapement count the balance’s swings and keep it going?',
  overview: 'The lever escapement sits between the wheels, always pushing, and the balance, which must swing freely. A small lever with two jeweled pallets locks the escape wheel. Near the middle of each swing the balance’s roller jewel knocks the lever’s fork over: one pallet releases a tooth, the tooth pushes the lever, and the lever pushes the balance on its way. Then the other pallet locks the next tooth, and the balance swings on untouched.',
  steps: [
    {title: 'Lock', body: 'A pallet stone holds an escape wheel tooth; the lever rests against its banking pin.'},
    {title: 'Unlock', body: 'The balance’s roller jewel enters the fork and turns the lever, sliding the pallet off the tooth.'},
    {title: 'Impulse', body: 'The freed tooth pushes across the pallet’s slanted face, driving the lever, and the fork drives the roller jewel.'},
    {title: 'Lock again', body: 'The other pallet catches the next tooth, and the lever comes to rest against its other banking pin.'},
    {title: 'Swing free', body: 'The roller jewel leaves the fork, and the balance finishes its swing with nothing touching it.'},
  ],
  parts: [
    {name: 'Lever escapement', role: 'The escape wheel, the pallet lever and its banking pins.'},
    {name: 'Balance wheel', role: 'Carries the roller jewel that works the lever.'},
    {name: 'Wheel train', role: 'Keeps the escape wheel pressing on the pallets.'},
    {name: 'Hairspring', role: 'Brings the balance back for the next beat.'},
  ],
  tryIt: [
    leverTrial('Lock, unlock, push', 'Watch the lever.', 'Each beat the lever moves 10 degrees from one banking pin to the other, letting the 15-tooth escape wheel turn half a tooth: 12 degrees.'),
    leverTrial('Counting to sixty', 'Count the escape wheel’s turns.', 'At 8 beats a second the escape wheel turns 16 times a minute, and the fourth wheel, geared 16 to 1, takes the seconds hand once round.'),
    leverTrial('A push every beat', 'Look at the energy.', 'Each beat the lever gives the balance 0.122 µJ, exactly what its swing loses in that beat.'),
    leverTrial('Free most of the time', 'Watch where the fork meets the balance.', 'The fork touches the roller jewel only within 26 degrees of the middle of a 318.3 degree swing; for the rest the balance swings free.'),
    leverTrial('A weaker push', 'Set the watch to 36 hours after winding.', 'The swing falls to 221.8 degrees and each beat’s push to 0.059 µJ, but the lever still unlocks every tooth.', {hours: 36}),
    leverTrial('Too little swing', 'Set the watch to 44 hours after winding.', 'The balance can no longer swing the 110 degrees needed to work the lever, and the escape wheel stays locked.', {hours: 44}),
  ],
  deeper: [
    {title: 'Detached', body: 'Because the balance is touched only near the middle of its swing, the escapement disturbs its timing very little. That freedom is the lever escapement’s great advantage over the older verge and cylinder escapements.'},
    {title: 'Draw', body: 'The pallets are angled so that the escape wheel’s pull holds the lever against its banking pin between beats. A jolt to the watch cannot unlock the wheel by accident.'},
    {title: 'Jewels', body: 'The pallets and roller are synthetic ruby, hard and slippery, so they wear very little even after hundreds of millions of beats a year.'},
  ],
  misconception: 'The lever does not set the watch’s pace. It only lets the wheels step when the balance allows and passes the balance its push.',
  limits,
  sources,
  quiz: {
    question: 'Why is it an advantage that the lever touches the balance only near the middle of its swing?',
    options: ['The balance swings freely most of the time, so its natural pace is barely disturbed.', 'It saves the mainspring from turning.', 'It makes the watch tick louder.'],
    answer: 0,
    explanation: 'The less the escapement interferes, the more the watch’s timing depends only on the balance and hairspring.',
  },
};

export const hairspringLesson = {
  simple: 'How does a hair-thin spiral spring set the pace of a watch?',
  overview: 'The hairspring is the watch’s timekeeper as much as the balance is. Its inner end turns with the balance and its outer end is held still, so every swing coils it tighter or looser, and it pushes back in proportion to the angle. That proportional push is what makes the balance keep an even beat. Its stiffness depends on its length, its height, the cube of its thickness, and the metal’s stiffness, which temperature can change.',
  steps: [
    {title: 'Twist and push back', body: 'Turn the balance and the spiral coils tighter; it pushes back harder the further it is turned.'},
    {title: 'Swing past the middle', body: 'The balance overshoots the middle, coiling the spring the other way, and it pushes back again.'},
    {title: 'Keep the same beat', body: 'Because the push grows with the angle, a wide swing and a narrow one take the same time.'},
    {title: 'Adjust its length', body: 'The regulator’s curb pins hold the spring near its outer end. Moving them shortens or lengthens the part that works.'},
  ],
  parts: [
    {name: 'Hairspring', role: 'The spiral spring, its stud and the regulator.'},
    {name: 'Balance wheel', role: 'The swinging mass the spring pushes back.'},
    {name: 'Charts', role: 'The rate against temperature for steel and Nivarox.'},
  ],
  tryIt: [
    springTrial('The spring sets the beat', 'Inspect the hairspring.', '84.00 mm of spring 0.03 mm thick pushes back with 0.627 µN·m per radian, swinging the 9.92 mg·cm² balance 4 times a second.'),
    springTrial('A shorter spring, a faster beat', 'Move the regulator five marks toward fast.', 'The working length shrinks by 0.10%, the spring stiffens, and the watch gains 43.23 s a day.', {index: 5}),
    chartTrial('Steel softens in the heat', 'Choose carbon steel at 40 °C.', 'Its stiffness falls to 0.624 µN·m per radian, and the watch loses 198.56 s a day.', {alloy: 0, temperature: 40}),
    chartTrial('And stiffens in the cold', 'Choose carbon steel at 0 °C.', 'Now the watch gains 198.02 s a day.', {alloy: 0, temperature: 0}),
    chartTrial('The compensating alloy', 'Choose Nivarox at 30 °C.', 'Nivarox’s stiffness rises just enough to offset the balance and spring growing, and the watch gains only 2.59 s a day.', {temperature: 30}),
    springTrial('Wide and narrow swings', 'Set the watch to 36 hours after winding.', 'The swing is down to 221.8 degrees, yet each swing still takes 0.250000 s: a push that grows with the angle keeps big and small swings in step.', {hours: 36}),
  ],
  deeper: [
    {title: 'Stiffness from shape', body: 'A spiral spring’s stiffness is its modulus times its height times the cube of its thickness, divided by twelve times its length. Thickness matters most: a spring 10% thinner is 27% softer, so hairsprings are drawn to a thousandth of a millimeter.'},
    {title: 'Breathing', body: 'As the balance swings, the spiral’s coils open and close. Breguet’s overcoil, bending the outer end up and over the spiral, keeps the coils centered as they breathe, so the balance is not pulled to one side.'},
    {title: 'From steel to silicon', body: 'Steel hairsprings rusted, magnetized and changed with temperature. Nivarox and similar alloys fixed temperature and magnetism; today some watches use springs etched from silicon, coated to cancel their temperature change.'},
  ],
  misconception: 'A hairspring is not wound up to store energy. It only borrows the balance’s energy on each swing and gives it back, setting the pace; the mainspring supplies the energy.',
  limits,
  sources,
  quiz: {
    question: 'The regulator is moved toward fast. What does it do to the hairspring?',
    options: ['Shortens its working length, making it stiffer, so the balance swings faster.', 'Winds it tighter, storing more energy.', 'Makes the balance wheel lighter.'],
    answer: 0,
    explanation: 'A shorter spring pushes back harder for the same twist, so the balance swings back sooner.',
  },
};

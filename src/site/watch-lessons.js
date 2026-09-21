import {WATCH_DEFAULTS} from './watch-physics.js';

const trial = (part, view) => (title, instruction, observe, values = {}) => ({title, instruction, observe, values: {...WATCH_DEFAULTS, ...values}, reset: true, part, isolate: false, view});
const watchTrial = trial('system', 'front');
const leverTrial = trial('escapement', 'front');
const springTrial = trial('hairspring', 'front');
const barrelTrial = trial('barrel', 'front');
const chartTrial = trial('charts', 'front');

const limits = 'Illustrative watch: a 49 mg balance ring at 4.5 mm radius, and a hairspring 0.12 mm tall and 0.03 mm thick with a modulus of 195 GPa, cut to swing at exactly 4 Hz at 20 °C. Each regulator mark changes the working length by 0.02%. Carbon steel’s modulus falls 240 millionths a degree and Nivarox’s rises 6; their expansions are 11.5 and 8 millionths and the balance’s 12. A mainspring of 0.012 N·m fading to 40% over 42 hours and to nothing two hours later, 30% of its power reaching a balance with a Q of 250, and a lever needing 110 degrees of swing. Not modeled: the escapement disturbing the balance, positional errors, magnetism, and the real mainspring curve. Time is slowed tenfold.';
const sources = [
  {title: 'OpenStax University Physics: the torsional pendulum', url: 'https://openstax.org/books/university-physics-volume-1/pages/15-4-pendulums'},
  {title: 'Balance spring: stiffness, temperature and alloys', url: 'https://en.wikipedia.org/wiki/Balance_spring'},
  {title: 'Lever escapement', url: 'https://en.wikipedia.org/wiki/Lever_escapement'},
];

export const watchLesson = {
  simple: 'How does a mechanical watch keep time with no battery, and why did old watches run slow in summer?',
  overview: 'A mechanical watch is a pendulum clock folded into a wrist. Instead of a weight it has a coiled mainspring; instead of a pendulum, a balance wheel that swings back and forth on a hairspring. The lever escapement lets the wheels move half a tooth at each swing and gives the balance a tiny push. Change the regulator, the temperature, the hairspring’s alloy and how long ago it was wound, and watch what changes and what does not.',
  steps: [
    {title: 'Wind the mainspring', body: 'Turning the crown coils a steel ribbon tight inside the barrel. As it unwinds, over a day and a half or more, it turns the barrel and the wheel train.'},
    {title: 'Swing the balance', body: 'The balance wheel twists its hairspring as it turns. The spring pushes back, the balance swings the other way, and the two keep a steady beat.'},
    {title: 'Let a tooth go', body: 'Near the middle of each swing, the balance’s roller jewel knocks the lever over. A pallet releases the escape wheel, which moves half a tooth before the other pallet stops it.'},
    {title: 'Push the balance', body: 'As the tooth slides across a pallet it pushes the lever, and the lever’s fork pushes the balance, making up what friction took.'},
    {title: 'Count the beats', body: 'At 4 swings a second, the wheels step 8 times a second, and the fourth wheel turns the seconds hand once a minute.'},
  ],
  parts: [
    {name: 'Mainspring and barrel', role: 'Store the energy and turn the wheels.'},
    {name: 'Wheel train', role: 'Carry the barrel’s turning to the escape wheel and the seconds hand.'},
    {name: 'Lever escapement', role: 'Releases the wheels in steps and pushes the balance.'},
    {name: 'Balance wheel', role: 'Swings back and forth to set the beat.'},
    {name: 'Hairspring', role: 'Pushes the balance back toward the middle; the regulator adjusts it.'},
    {name: 'Movement plate', role: 'Carries everything.'},
    {name: 'Charts', role: 'The swing as the mainspring runs down, and the rate against temperature.'},
  ],
  tryIt: [
    watchTrial('Wind it and watch', 'Play with the watch fully wound.', 'The balance swings 318.3 degrees each way, 4 times a second, which makes 28,800 beats an hour, and the watch keeps perfect time: 0.00 s a day off.'),
    springTrial('Move the regulator', 'Move the regulator one mark toward fast.', 'Shortening the hairspring’s working length by 0.02% makes the watch gain 8.64 s a day.', {index: 1}),
    barrelTrial('A day later', 'Set the watch to 24 hours after winding.', 'The mainspring’s push has fallen to 7.89 mN·m and the swing to 258.0 degrees, yet the watch still keeps time.', {hours: 24}),
    chartTrial('Nearly run down', 'Set the watch to 43 hours after winding.', 'With only 2.40 mN·m left, the swing drops to 142.4 degrees.', {hours: 43}),
    watchTrial('Stopped', 'Set the watch to 44 hours after winding.', 'The mainspring is spent; the balance cannot swing the 110 degrees the lever needs, so the watch stops.', {hours: 44}),
    chartTrial('A steel hairspring in summer', 'Choose a carbon steel hairspring at 30 °C.', 'Steel grows softer as it warms, and the watch loses 99.21 s a day.', {alloy: 0, temperature: 30}),
    chartTrial('Nivarox in summer', 'Choose a Nivarox hairspring at 30 °C.', 'Nivarox hardly changes, and the watch gains just 2.59 s a day.', {temperature: 30}),
    watchTrial('Where the energy goes', 'Compare the mainspring with the balance.', 'The balance receives 0.972 µW, 0.122 µJ each beat, and holds 9.67 µJ in its swing.'),
  ],
  deeper: [
    {title: 'A pendulum without gravity', body: 'The balance and hairspring swing for the same reason a pendulum does, but the spring provides the restoring push, so a watch keeps time on its side, upside down, or on a running wrist. Its period is 2π times the square root of the balance’s inertia over the spring’s stiffness.'},
    {title: 'Why summer slowed old watches', body: 'Warm steel is slightly softer, and a softer hairspring lets the balance swing more slowly. A steel hairspring lost about 10 s a day for every degree, which is why makers once built balances that changed shape with temperature, until alloys such as Nivarox, whose stiffness hardly changes, made that unnecessary.'},
    {title: 'Power reserve', body: 'This mainspring runs the watch for about 42 hours before its push fades too far. An automatic watch keeps it wound with a swinging rotor moved by the wrist.'},
    {title: 'Two and a half centuries old', body: 'Thomas Mudge invented the lever escapement in the 1750s. Almost every mechanical watch since has used it, because it leaves the balance free for most of each swing.'},
  ],
  misconception: 'A running-down mainspring does not make a good watch run slow. The balance and hairspring set the pace; a weaker push only makes the swing smaller, until it is too small to work at all.',
  limits,
  sources,
  quiz: {
    question: 'What sets how fast a mechanical watch runs?',
    options: ['The balance wheel’s inertia and the hairspring’s stiffness.', 'How tightly the mainspring is wound.', 'The number of teeth on the escape wheel.'],
    answer: 0,
    explanation: 'The balance and hairspring swing at their own natural pace. The mainspring only keeps them swinging, and the wheels only count the swings.',
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

import {CLOCK_DEFAULTS} from './pendulum-clock-physics.js';

const trial = (part, view) => (title, instruction, observe, values = {}) => ({title, instruction, observe, values: {...CLOCK_DEFAULTS, ...values}, reset: true, part, isolate: false, view});
const clockTrial = trial('system', 'front');
const pendulumTrial = trial('pendulum', 'front');
const chartTrial = trial('chart', 'front');
const escapementTrial = trial('escapement', 'front');

const limits = 'Illustrative wall regulator: a 1.5 kg bob on a light rod, with the period of a simple pendulum and its circular error, in gravity of 9.81 m/s². The rod expands 11.5, 19 or 1.2 millionths a degree for steel, brass and invar, from its length at 20 °C. The weight falls 0.15 m a day and a quarter of its power reaches the pendulum, which loses 2π/Q of its energy each period, with Q of 3,000 when clean and 1,000 when dirty. The pallets need a swing of 1 degree each way. Not modeled: the rod’s mass, air density, the escapement disturbing the period, the suspension spring, and the weight’s pull changing as the cord unwinds. The clock runs in real time.';
const sources = [
  {title: 'OpenStax College Physics 2e: the simple pendulum', url: 'https://openstax.org/books/college-physics-2e/pages/16-4-the-simple-pendulum'},
  {title: 'Pendulum clock: escapements, temperature and circular error', url: 'https://en.wikipedia.org/wiki/Pendulum_clock'},
  {title: 'Anchor escapement', url: 'https://en.wikipedia.org/wiki/Anchor_escapement'},
];

export const pendulumClockLesson = {
  simple: 'How does a swinging weight keep a clock on time, and why does a warm room slow it down?',
  overview: 'A pendulum clock splits the job in two. A falling weight provides the energy, turning a train of wheels, but it would run down in seconds if nothing held it back. The anchor escapement holds the wheels still and lets them move half a tooth at each swing of the pendulum, giving the pendulum a small push each time. The pendulum’s swing, set by its length, fixes the pace. Change the length, the room, the rod, the weight and the dirt, and see how the rate changes.',
  steps: [
    {title: 'Store energy in a weight', body: 'Winding the clock raises a weight. As it falls, its cord turns the barrel and the wheel train.'},
    {title: 'Hold the wheels back', body: 'The escape wheel at the top of the train pushes on the anchor’s pallets, which lock it in turn.'},
    {title: 'Let a tooth go each swing', body: 'The pendulum rocks the anchor through its crutch. Each swing frees the wheel to move half a tooth, which carries the seconds hand along one step: the tick and the tock.'},
    {title: 'Push the pendulum', body: 'As each tooth slides off a pallet it pushes the pendulum a little, replacing the energy that friction and air take from the swing.'},
    {title: 'Let length set the pace', body: 'The time for a swing depends on the pendulum’s length and gravity, and hardly at all on its weight or how far it swings, so the clock keeps an even pace.'},
  ],
  parts: [
    {name: 'Pendulum', role: 'Sets the pace; the rating nut adjusts its length.'},
    {name: 'Anchor escapement', role: 'Lets the wheels move half a tooth each swing and pushes the pendulum.'},
    {name: 'Wheel train', role: 'Carries the weight’s energy to the escapement and turns the hands.'},
    {name: 'Driving weight', role: 'Provides all the clock’s energy as it falls.'},
    {name: 'Dial and hands', role: 'Show hours, minutes and seconds.'},
    {name: 'Rate against temperature', role: 'Shows how warmth changes the rate for each rod.'},
    {name: 'Case', role: 'Protects the movement from dust and drafts.'},
  ],
  tryIt: [
    clockTrial('Keep time', 'Play with the 993.8 mm steel pendulum at 20 °C.', 'It swings 2.34 degrees each way, beating once a second, and keeps perfect time: 0.00 s a day off.'),
    pendulumTrial('Raise the bob a millimeter', 'Set the pendulum to 992.8 mm.', 'One millimeter shorter, the clock gains 43.50 s a day, 304.5 s in a week.', {length: 992.8}),
    chartTrial('A warm room', 'Set the room to 30 °C.', 'The steel rod grows 114.3 µm, and the clock loses 4.97 s a day.', {temperature: 30}),
    chartTrial('A brass rod', 'Choose a brass rod in a 30 °C room.', 'Brass grows more, 188.8 µm, and the clock loses 8.21 s a day.', {rod: 1, temperature: 30}),
    chartTrial('An invar rod', 'Choose an invar rod in a 30 °C room.', 'Invar hardly grows, 11.9 µm, so the clock loses only 0.52 s a day.', {rod: 2, temperature: 30}),
    pendulumTrial('A lighter weight', 'Set the weight to 1 kg.', 'With only 4.26 µJ of push a beat, the swing shrinks to 1.35 degrees, and a smaller swing is quicker: the clock gains 6.01 s a day.', {weight: 1}),
    clockTrial('A dirty clock', 'Choose a dry and dirty movement with a 2 kg weight.', 'Friction eats the swing down to 1.10 degrees, just enough to unlock the pallets, and the clock gains 7.01 s a day.', {care: 1, weight: 2}),
    escapementTrial('Too little to go on', 'Choose a dry and dirty movement with a 1 kg weight.', 'The swing could only reach 0.78 degrees, less than the 1 degree the pallets need, so the clock stops.', {care: 1, weight: 1}),
  ],
  deeper: [
    {title: 'Why length sets the pace', body: 'A pendulum’s period grows with the square root of its length. Shortening this one by a millimeter, 1 part in about a thousand, shortens its period by half that share, and the clock gains 43.5 s a day. That is why the rating nut has such a fine thread.'},
    {title: 'Keeping the length steady', body: 'Metals grow as they warm: steel by 11.5 millionths of its length a degree, brass by 19. Clockmakers fought this with gridirons of brass and steel rods whose growths cancel, and with jars of mercury that rise as the rod falls, until invar, an alloy of iron and nickel growing just 1.2 millionths a degree, made it easy.'},
    {title: 'Circular error', body: 'A pendulum is not quite even: a wider swing takes a little longer. At 2.34 degrees each way this one is 104 parts per million slower than a tiny swing. A steady push keeps the swing, and so the error, constant; a change in the weight or in friction changes the rate.'},
    {title: 'Galileo and Huygens', body: 'Galileo noticed that a pendulum’s swings keep time whatever their size, near enough. Christiaan Huygens built the first pendulum clock in 1656, and clocks went from losing a quarter of an hour a day to losing seconds.'},
  ],
  misconception: 'The weight does not set the clock’s speed. It only supplies energy; the pendulum sets the pace, and a heavier weight changes the rate only slightly, through the size of the swing.',
  limits,
  sources,
  quiz: {
    question: 'A pendulum clock runs slow in a warm summer. What should you do to the bob?',
    options: ['Raise it, shortening the pendulum.', 'Lower it, lengthening the pendulum.', 'Add weight to the bob.'],
    answer: 0,
    explanation: 'Warmth lengthened the rod, so each swing takes a little longer. Raising the bob with the rating nut restores the length, and the clock speeds back up.',
  },
};

export const anchorEscapementLesson = {
  simple: 'How does an anchor escapement let a clock’s wheels move only one step at each swing of the pendulum?',
  overview: 'The escapement is the gatekeeper between the clock’s energy and its timekeeper. An anchor shaped like a ship’s anchor rocks with the pendulum. Its two pallets dip in turn between the teeth of the escape wheel, which the weight is always trying to turn. Each time one pallet lifts out, the wheel jumps forward half a tooth until the other pallet catches it, and as the tooth slides off the pallet it gives the pendulum a push.',
  steps: [
    {title: 'Lock', body: 'One pallet sits in the path of a tooth, and the whole train stands still.'},
    {title: 'Unlock', body: 'The pendulum swings the anchor far enough to lift that pallet clear of the tooth.'},
    {title: 'Impulse', body: 'The tooth slides along the pallet’s slanting face, pushing the anchor, and through the crutch the pendulum.'},
    {title: 'Drop', body: 'The tooth leaves the pallet, the wheel jumps, and a tooth on the other side lands on the other pallet: the tick.'},
    {title: 'Repeat', body: 'On the swing back the other pallet does the same: the tock. Two beats move the wheel one tooth.'},
  ],
  parts: [
    {name: 'Anchor escapement', role: 'The escape wheel, the anchor and its pallets, and the crutch.'},
    {name: 'Pendulum', role: 'Rocks the anchor and is pushed by it.'},
    {name: 'Wheel train', role: 'Keeps the escape wheel pressing on the pallets.'},
    {name: 'Dial and hands', role: 'The seconds hand rides on the escape wheel.'},
  ],
  tryIt: [
    escapementTrial('Tick and tock', 'Watch the escapement.', 'The escape wheel’s 30 teeth each pass both pallets, so it turns 6 degrees at every beat and once a minute, carrying the seconds hand.'),
    escapementTrial('A push every beat', 'Look at the energy.', 'Each beat the pallets give the pendulum 12.77 µJ from the falling weight, exactly what the swing loses in that beat.'),
    escapementTrial('Weight into swing', 'Compare the weight with the swing.', 'The 3 kg weight falls 0.15 m a day, and 12.77 µW of its power reaches the pendulum.'),
    escapementTrial('A heavier weight, a wider swing', 'Set the weight to 5 kg.', 'A 5 kg weight gives 21.29 µJ a beat, and the swing grows to 3.02 degrees each way.', {weight: 5}),
    escapementTrial('The escapement follows the pendulum', 'Set the pendulum to 992.8 mm.', 'The escapement lets a tooth go whenever the pendulum says: now every 0.99952 s instead of every 1.00002 s.', {length: 992.8}),
    escapementTrial('Too weak to unlock', 'Choose a dry and dirty movement with a 1 kg weight.', 'At 0.78 degrees the pendulum cannot swing the pallets clear of the teeth, and everything stops.', {care: 1, weight: 1}),
  ],
  deeper: [
    {title: 'Why it recoils', body: 'In an anchor escapement the pallets keep moving after they lock a tooth, pushing the wheel slightly backward before the pendulum turns. That recoil is why the seconds hand of an old clock seems to shudder at each step.'},
    {title: 'Detached from the pendulum', body: 'The anchor touches the escape wheel all the time, so its friction and push disturb the pendulum a little. Better escapements such as the deadbeat, used in precision regulators, lock without recoil and push only briefly near the middle of the swing.'},
    {title: 'A tooth a second', body: 'With a pendulum beating seconds and a 30-tooth escape wheel, the wheel turns once a minute, which is why the seconds hand can sit straight on its arbor.'},
  ],
  misconception: 'The escapement does not keep time on its own. It only releases the wheels when the pendulum allows; lengthen the pendulum and the escapement simply follows.',
  limits,
  sources,
  quiz: {
    question: 'What would happen to the wheels if the anchor were taken out?',
    options: ['They would spin fast and the weight would fall in seconds.', 'They would stop at once.', 'They would keep turning at the same pace.'],
    answer: 0,
    explanation: 'Nothing would hold the train back. The escapement is what turns the weight’s steady pull into small, regular steps.',
  },
};

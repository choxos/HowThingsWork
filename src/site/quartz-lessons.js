import {QUARTZ_CLOCK_DEFAULTS, KINETIC_DEFAULTS} from './quartz-physics.js';

const trial = (defaults, part, view) => (title, instruction, observe, values = {}) => ({title, instruction, observe, values: {...defaults, ...values}, reset: true, part, isolate: false, view});
const clockTrial = trial(QUARTZ_CLOCK_DEFAULTS, 'system', 'front');
const quartzTrial = trial(QUARTZ_CLOCK_DEFAULTS, 'quartz', 'front');
const dividerTrial = trial(QUARTZ_CLOCK_DEFAULTS, 'divider', 'front');
const motorTrial = trial(QUARTZ_CLOCK_DEFAULTS, 'motor', 'front');
const chartTrial = trial(QUARTZ_CLOCK_DEFAULTS, 'chart', 'front');
const watchTrial = trial(KINETIC_DEFAULTS, 'system', 'front');
const storeTrial = trial(KINETIC_DEFAULTS, 'chart', 'front');

const clockLimits = 'Illustrative quartz clock: a quartz tuning fork of 0.25 mm tines cut to ring at 32,768 Hz at 25 °C, slowing by 0.034 parts per million for each degree squared away from it, with a quality factor of 60,000 and a trimming capacitor worth a few parts per million. Fifteen halvings, a stepping motor turning half a turn a pulse and gears of 30 to 1. The motor draws 3 mA for 32 ms each second and the circuit 10 µA from a 2,400 mAh AA cell. A quartz plate 1 cm square and 1 mm thick shows the piezoelectric effect at 2.31 pC a newton. Not modeled: aging, the drive level, the motor’s magnetics and the battery’s falling voltage. The clock runs in real time.';
const kineticLimits = 'Illustrative kinetic watch: the movement draws 0.3 mA for 5 ms each second and 0.1 µA more, at 1.5 V, from a 5 mAh rechargeable store. While worn it harvests 2 µW at a desk, 10 µW walking and 30 µW running, averaged over the day. The quartz slows by 0.034 parts per million for each degree squared from 25 °C. Not modeled: the rotor’s real motion, the generator’s gearing and losses, the store’s charging efficiency and self-discharge, and the hour-by-hour pattern of wear. Thirty days play a day a second.';
const clockSources = [
  {title: 'OpenStax College Physics 2e: simple harmonic motion and resonance', url: 'https://openstax.org/books/college-physics-2e/pages/16-8-forced-oscillations-and-resonance'},
  {title: 'Crystal oscillator: quartz tuning forks at 32,768 Hz', url: 'https://en.wikipedia.org/wiki/Crystal_oscillator'},
  {title: 'Quartz clock', url: 'https://en.wikipedia.org/wiki/Quartz_clock'},
];

export const quartzClockLesson = {
  simple: 'How does a cheap quartz clock keep better time than a fine mechanical one?',
  overview: 'A quartz clock’s timekeeper is a tiny tuning fork made of quartz crystal, ringing 32,768 times a second. Quartz is piezoelectric, so an electronic circuit can both drive the fork and feel it ring, keeping it going at its own very steady pace. A chip halves that frequency fifteen times to get one pulse a second, and each pulse nudges a stepping motor that turns the hands.',
  steps: [
    {title: 'Ring the fork', body: 'The chip’s oscillator circuit applies a voltage that bends the quartz tines; their springing back makes a voltage the circuit feels and reinforces.'},
    {title: 'Keep a steady pace', body: 'Quartz rings so cleanly that the circuit barely disturbs it, and its frequency hardly changes with the battery or the circuit.'},
    {title: 'Halve it fifteen times', body: 'A chain of flip-flops each halves the frequency. 32,768 is 2 multiplied by itself 15 times, so the last stage ticks once a second.'},
    {title: 'Step the motor', body: 'Each pulse magnetizes a coil the other way, flipping a small magnet half a turn.'},
    {title: 'Turn the hands', body: 'Gears carry the motor’s steps to the seconds, minute and hour hands.'},
  ],
  parts: [
    {name: 'Quartz crystal', role: 'The tuning fork that sets the pace, beside a squeezed quartz plate showing the piezoelectric effect.'},
    {name: 'Divider chip', role: 'Halves the frequency down to one pulse a second.'},
    {name: 'Stepping motor', role: 'Turns half a turn at each pulse.'},
    {name: 'Hands', role: 'Step once a second.'},
    {name: 'AA cell', role: 'Powers the circuit and motor for years.'},
    {name: 'Rate against temperature', role: 'Shows the crystal running fastest at 25 °C.'},
    {name: 'Movement case', role: 'Holds it all.'},
  ],
  tryIt: [
    clockTrial('Run a minute', 'Play a minute at 20 °C.', 'The crystal rings 32,767.9721 times a second, 0.850 parts per million slow, so the clock loses 0.073 s a day: 2.20 s in a month.'),
    chartTrial('At its best temperature', 'Set the room to 25 °C.', 'Quartz is cut to ring fastest here: exactly 32,768 Hz, and the clock keeps perfect time.', {temperature: 25}),
    chartTrial('A cold room', 'Set the room to 0 °C.', '25 degrees from its best, the crystal is 21.250 parts per million slow, and the clock loses 1.836 s a day, 55.08 s in a month.', {temperature: 0}),
    chartTrial('A warm room', 'Set the room to 35 °C.', 'Ten degrees too warm costs only 3.400 parts per million: 0.294 s a day.', {temperature: 35}),
    clockTrial('Trim it', 'Set the trimming capacitor to 5 ppm.', 'At 20 °C the clock now gains 0.359 s a day, 4.150 parts per million fast.', {trim: 5}),
    dividerTrial('Count down to seconds', 'Inspect the divider lamps.', 'Fifteen halvings: 32,768 is 2 multiplied by itself 15 times, so the last stage gives 1 pulse a second.'),
    motorTrial('The stepping motor', 'Watch the motor.', 'Each pulse turns the rotor half a turn, and gears of 30 to 1 move the seconds hand 6 degrees.'),
    clockTrial('The battery', 'Look at the battery.', 'The clock draws 106.0 µA on average, mostly in 32 ms pulses to the motor, so an AA cell lasts 2.58 years.'),
  ],
  deeper: [
    {title: 'Why quartz is so steady', body: 'A good mechanical watch’s balance has a quality factor of a few hundred; this quartz fork’s is 60,000. The more cleanly an oscillator rings, the less the circuit that keeps it going can pull it off its pace.'},
    {title: 'The temperature curve', body: 'A tuning-fork crystal runs fastest at 25 °C and slower either side, by 0.034 parts per million for each degree squared. A watch on a wrist stays near that; a clock in a cold hall loses nearly two seconds a day.'},
    {title: 'Better quartz', body: 'Some quartz clocks measure their own temperature and correct for it, and radio clocks set themselves from time signals broadcast by atomic clocks.'},
  ],
  misconception: 'The battery does not set a quartz clock’s pace. It only keeps the crystal ringing and the motor stepping; the crystal alone decides the time, which is why a quartz clock keeps good time right up until the battery dies.',
  limits: clockLimits,
  sources: clockSources,
  quiz: {
    question: 'Why do quartz clock crystals ring at 32,768 Hz?',
    options: ['Because 32,768 is 2 to the 15th, so fifteen halvings give exactly one pulse a second.', 'Because quartz can only ring at that frequency.', 'Because it is too high for people to hear.'],
    answer: 0,
    explanation: 'Halving is the simplest thing a chip can do. Any power of two would work; 32,768 Hz is a convenient, low-power size for a small crystal.',
  },
};

export const quartzOscillatorLesson = {
  simple: 'How does a quartz crystal become a timekeeper?',
  overview: 'The oscillator is a quartz tuning fork and a small amplifier in a loop. Quartz bends when a voltage is applied and makes a voltage when it bends, so the amplifier can push the tines and hear them spring back. Only the fork’s own natural frequency survives the round trip, and because quartz loses so little energy each swing, that frequency is extraordinarily steady.',
  steps: [
    {title: 'Shape the fork', body: 'The tines’ length, thickness, stiffness and density set the frequency at which they naturally ring.'},
    {title: 'Close the loop', body: 'The amplifier feeds the fork’s voltage back to it, in step with its motion.'},
    {title: 'Make up the losses', body: 'Each swing the circuit replaces the tiny energy the quartz loses, so the ringing never dies away.'},
    {title: 'Stay on pace', body: 'Because the fork loses so little, the circuit barely has to push, and barely pulls it off its natural frequency.'},
  ],
  parts: [
    {name: 'Quartz crystal', role: 'The tuning fork in its sealed can.'},
    {name: 'Divider chip', role: 'Contains the amplifier and counts the swings.'},
    {name: 'Rate against temperature', role: 'The crystal’s one weakness: temperature.'},
  ],
  tryIt: [
    quartzTrial('A fork of quartz', 'Inspect the tuning fork.', 'Tines 2.59 mm long and 0.25 mm thick ring at 32,768 Hz, set by their length, thickness, stiffness and density.'),
    quartzTrial('Ringing on and on', 'Look at how long a ring lasts.', 'With a quality factor of 60,000, a ring dies away only over 0.583 s, some 19,000 swings.'),
    dividerTrial('Why 32,768', 'Count the halvings.', '32,768 is 2 to the 15th power, so 15 flip-flops divide it exactly to 1 pulse a second.'),
    chartTrial('Cold quartz', 'Set the room ten degrees below zero.', '35 degrees from its best, the crystal slows by 41.650 parts per million: 3.599 s a day.', {temperature: -10}),
    chartTrial('Pull it to time', 'Set the trimming capacitor to 0.5 ppm at 25 °C.', 'Half a part per million is 0.043 s a day, 15.8 s in a year.', {trim: 0.5, temperature: 25}),
    chartTrial('A hot room', 'Set the room to 50 °C.', 'Too warm slows it just as too cold does: 21.250 parts per million, the same as at 0 °C.', {temperature: 50}),
  ],
  deeper: [
    {title: 'A beam that rings', body: 'Each tine is a cantilever. Its first way of bending rings at a frequency that grows with its thickness and falls with the square of its length, so halving the length would quadruple the frequency.'},
    {title: 'Quality factor', body: 'A ring dies away over Q divided by pi times the frequency: 0.583 s for this fork, though it swings 32,768 times each second. A mechanical watch’s balance, with a Q of a few hundred, loses its swing in seconds.'},
  ],
  misconception: 'The electronics do not decide the frequency. They only keep the crystal ringing; the crystal’s shape and material decide the pace.',
  limits: clockLimits,
  sources: clockSources,
  quiz: {
    question: 'What would halving the tines’ length do to the fork’s frequency?',
    options: ['Make it four times as high.', 'Make it twice as high.', 'Leave it the same.'],
    answer: 0,
    explanation: 'A cantilever’s ringing frequency goes as one over the square of its length.',
  },
};

export const piezoelectricityLesson = {
  simple: 'How can squeezing a crystal make electricity, and electricity make a crystal move?',
  overview: 'In quartz, the positive and negative ions sit in a lopsided pattern. Squeeze the crystal and the pattern shifts, leaving one face slightly positive and the other slightly negative: a voltage appears. Run it backward and a voltage pushes the ions, bending the crystal. Quartz clocks use both directions every second, and gas lighters use the first to make a spark.',
  steps: [
    {title: 'Squeeze', body: 'A force on the crystal shifts its charged ions slightly.'},
    {title: 'Separate charge', body: 'The shift leaves opposite charges on opposite faces, 2.31 pC for each newton in quartz.'},
    {title: 'See a voltage', body: 'The faces act as a small capacitor, so that charge shows as a voltage.'},
    {title: 'Run it backward', body: 'Apply a voltage instead and the crystal bends a little: the effect works both ways.'},
  ],
  parts: [
    {name: 'Quartz crystal', role: 'The clamped plate and its meter, beside the clock’s tuning fork.'},
  ],
  tryIt: [
    quartzTrial('Squeeze the plate', 'Squeeze the quartz plate with 10 N.', 'The squeeze frees 23.10 pC of charge; on a plate 1 cm square and 1 mm thick that makes 5.80 V.'),
    quartzTrial('Squeeze harder', 'Squeeze with 50 N.', 'Five times the squeeze frees five times the charge: 115.50 pC and 28.99 V.', {squeeze: 50}),
    quartzTrial('Let go', 'Take the squeeze off the plate.', 'No stress, no separated charge: 0.00 V.', {squeeze: 0}),
    quartzTrial('Every newton counts', 'Squeeze with 20 N.', 'At 2.31 pC for each newton, 20 N frees 46.20 pC and makes 11.60 V.', {squeeze: 20}),
    quartzTrial('A tiny capacitor', 'Compare the charge with the voltage.', 'The plate is a capacitor of only 3.98 pF, so a few picocoulombs make several volts.'),
    quartzTrial('Both ways at once', 'Think of the crystal in the clock.', 'In the tuning fork the effect runs both ways: the chip’s voltage bends the tines, and their bending makes a voltage back, 32,768 times a second.'),
  ],
  deeper: [
    {title: 'Discovered by the Curies', body: 'Pierre and Jacques Curie found the effect in 1880. Within forty years quartz plates were steadying radio transmitters, and by the 1970s quartz tuning forks were in wristwatches.'},
    {title: 'Stronger materials', body: 'Man-made ceramics such as lead zirconate titanate are hundreds of times more piezoelectric than quartz. A hammer striking one in a gas lighter makes thousands of volts, enough for a spark.'},
  ],
  misconception: 'A piezoelectric crystal is not a battery. It makes a voltage only while the squeeze changes, and the charge leaks away when the squeeze stays still.',
  limits: clockLimits,
  sources: [...clockSources, {title: 'Piezoelectricity', url: 'https://en.wikipedia.org/wiki/Piezoelectricity'}],
  quiz: {
    question: 'What does a quartz clock use the piezoelectric effect for?',
    options: ['To make the crystal ring and to sense its ringing, both at once.', 'To charge its battery.', 'To turn the hands.'],
    answer: 0,
    explanation: 'The circuit’s voltage bends the quartz, and the quartz’s bending makes a voltage back: that two-way link lets the circuit keep the fork ringing at its own pace.',
  },
};

export const kineticWatchLesson = {
  simple: 'How does a kinetic watch run on the movement of your wrist?',
  overview: 'A kinetic watch keeps time with quartz like any quartz watch, but it has no battery to replace. A half-moon weight swings on a bearing whenever the wrist moves. Through gears it spins a tiny generator, and the current charges a rechargeable store. Whether the store fills or empties depends on how long and how busily the watch is worn, against the small, steady power the movement uses.',
  steps: [
    {title: 'Swing the weight', body: 'Every arm movement swings the off-center weight around its bearing.'},
    {title: 'Spin the generator', body: 'Gears step the swinging up about a hundredfold, spinning a magnet past a coil.'},
    {title: 'Store the energy', body: 'The generator’s current charges a rechargeable cell.'},
    {title: 'Run the quartz movement', body: 'The store powers the crystal, divider and stepping motor, a couple of microwatts day and night.'},
    {title: 'Balance the books', body: 'Worn enough, the store fills; left in a drawer, it slowly empties, over months.'},
  ],
  parts: [
    {name: 'Oscillating weight', role: 'Swings with the wrist.'},
    {name: 'Generator', role: 'Turns the swinging into current.'},
    {name: 'Energy store', role: 'Holds the energy for the dark hours.'},
    {name: 'Quartz and stepping motor', role: 'Keep time and move the hands.'},
    {name: 'Stored energy', role: 'The store’s level over a month.'},
    {name: 'Movement', role: 'Carries it all.'},
  ],
  tryIt: [
    watchTrial('Wear it walking', 'Wear it 8 h a day while walking, starting 20% full.', 'Walking harvests 10 µW; 8 h of it brings 0.288 J a day, more than the 0.207 J the watch uses, so the store gains 0.081 J a day.'),
    storeTrial('A desk job', 'Wear it 8 h a day sitting at a desk.', 'Desk work brings only 2 µW, so the store loses 0.150 J a day and the watch stops after 36.1 days.', {activity: 0}),
    storeTrial('Left in a drawer', 'Put a full watch away in a drawer.', 'Using 2.40 µW, the full 27 J store runs it for 130.2 days.', {worn: 0, start: 100}),
    watchTrial('Breaking even', 'Compare the harvest with the use.', 'Walking, 5.76 h of wear a day keeps the store level.'),
    storeTrial('A long day on your feet', 'Wear it 16 h a day while walking.', 'The store gains 0.369 J a day and fills in 58.6 days.', {worn: 16}),
    watchTrial('A short run', 'Run with it 2 h a day.', 'Running harvests 30 µW, and 2 h of it just beats the 0.207 J a day the watch uses.', {activity: 2, worn: 2}),
    watchTrial('A cold wrist', 'Wear it on a wrist at 0 °C.', 'The quartz slows by 21.250 parts per million: 1.836 s a day.', {temperature: 0}),
    watchTrial('Where the power goes', 'Look at what uses the power.', 'The motor’s 5 ms pulses of 0.3 mA each second make 1.5 µA of the watch’s 1.6 µA.'),
  ],
  deeper: [
    {title: 'Tiny power, long life', body: 'The whole movement uses about 2.4 µW, so a store holding the energy of a few seconds of a flashlight bulb runs it for months.'},
    {title: 'Automatic mechanical watches', body: 'Mechanical automatic watches use the same swinging weight to wind a mainspring instead of turning a generator; the kinetic watch turns that idea electric.'},
  ],
  misconception: 'A kinetic watch does not charge from being wound or from light. Only the swinging weight charges it, so it needs to be worn, and worn long enough.',
  limits: kineticLimits,
  sources: [...clockSources, {title: 'Automatic quartz watches', url: 'https://en.wikipedia.org/wiki/Automatic_quartz'}],
  quiz: {
    question: 'A kinetic watch has been in a drawer for two months. What happened to it?',
    options: ['It kept running on its store, which is now about half empty.', 'It stopped the moment it was taken off.', 'It kept charging from the room’s vibrations.'],
    answer: 0,
    explanation: 'A full store runs the movement for over four months, so two months in a drawer uses a little under half of it.',
  },
};

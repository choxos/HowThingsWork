import {CLOCK_DEFAULTS} from './pendulum-clock-physics.js';

const trial = (part, view = 'front', isolate = false) => (title, instruction, observe, values = {}, initialState = {phase: 0}) => ({title, instruction, observe, values: {...CLOCK_DEFAULTS, ...values}, initialState, reset: true, part, isolate, view});
const clockTrial = trial('system');
const pendulumTrial = trial('regulator');
const chartTrial = trial('chart', 'front', true);
const escapementTrial = trial('escapement', 'front', true);

const limits = 'An original teaching regulator with a 1.5 kg point-mass bob, a light rod, and gravity of 9.81 m/s². Its fixed gears are designed for a two-second full pendulum period. The period includes the circular-error terms through the fourth power of amplitude; the drawn swing is harmonic. This is settled operation, not a startup or decay simulation. A 30-tooth Graham deadbeat escape wheel advances four degrees during contact and two during drop at each beat. Locking faces are concentric with the anchor pivot; tooth contact is solved geometrically. Impact, contact friction, backlash motion, gear inertia, and escapement-induced timing errors are not solved. The ideal crutch has no play. Work comes from a fixed-radius drum through the actual tooth ratios: at the designed rate the weight falls 0.15 m per day. A quarter of that work reaches the bob. Loss is 2π/Q of pendulum energy per full period, with Q of 3,000 when clean and 1,000 when dirty. Sustained operation requires amplitude above 1.12 degrees. Below that threshold the displayed mechanism remains at a static contact. Rod expansion is modeled as 11.5, 19, or 1.2 millionths per degree Celsius for steel, brass, or invar. Air-density changes, bob expansion, rod mass, suspension elasticity, winding, and the end of the weight’s travel are omitted. Physical motion is real time; day and week errors are projections at unchanged conditions.';
const sources = [
  {title: 'OpenStax College Physics 2e: the simple pendulum', url: 'https://openstax.org/books/college-physics-2e/pages/16-4-the-simple-pendulum'},
  {title: 'Laurie Penman, Clockmaking Elements: Horological Times, August 2010', url: 'https://www.awci.com/wp-content/uploads/ht/August2010.pdf'},
  {title: 'Laurie Penman, Clockmaking Elements: Horological Times, September 2010', url: 'https://www.awci.com/wp-content/uploads/ht/September2010.pdf'},
  {title: 'Clockmaking Elements construction correction: Horological Times, October 2010', url: 'https://www.awci.com/wp-content/uploads/ht/October2010.pdf'},
];

export const pendulumClockLesson = {
  simple: 'How do a falling weight, a swinging pendulum, and a train of gears turn motion into time?',
  overview: 'The weight supplies energy; the pendulum sets the pace. Between them, an anchor escapement alternately locks the gears and releases them. During each release a tooth pushes the anchor and replenishes the pendulum’s losses. Every hand follows that same train, so the hands stop whenever the escape wheel locks. Start with the whole clock, then inspect the movement and the two working pallet faces. Adjust the rating nut, temperature, driving weight, and friction to see why a real clock needs regulation.',
  steps: [
    {title: 'Pull the winding drum', body: 'The cord leaves the drum at its left tangent. A falling weight turns it counterclockwise, unwinding the cord. The great wheel and drum share an arbor.'},
    {title: 'Pass motion through real teeth', body: 'The 160-tooth great wheel drives a 20-tooth center pinion. A 120:20 pair drives the third arbor, and a 200:20 pair drives the escape arbor. Three external meshes reverse direction three times.'},
    {title: 'Lock without recoil', body: 'An escape-wheel tooth rests on a curved pallet face centered on the anchor pivot. The pendulum keeps swinging while the wheel, the whole train, and the hands remain still.'},
    {title: 'Give a push, then release', body: 'As the anchor reaches the sloping impulse face, a tooth slides along it and pushes the pendulum. The wheel turns four degrees in contact and two more after the tooth leaves. The opposite pallet then locks it. The return swing repeats the sequence on the other side.'},
    {title: 'Count beats with fixed ratios', body: 'Two beats advance one tooth of the 30-tooth escape wheel. Sixty beats turn it once, carrying the seconds hand. The center shaft turns once per sixty escape-wheel turns, carrying the minute hand. A separate twelve-to-one reduction drives the hour hand.'},
    {title: 'Regulate the pace', body: 'The full pendulum period depends mainly on suspension-to-bob length and gravity. Raise the bob to shorten the period. Warmth lengthens the rod; a wider swing also takes slightly longer. Fixed gears count those beats even when their pace is imperfect.'},
  ],
  parts: [
    {name: 'Driving weight and cord', role: 'Supply work by unwinding a fixed-radius drum; actual descent follows the train.'},
    {name: 'Wheel train', role: 'Three meshing pairs carry energy to the escape wheel and connect the seconds and minute shafts.'},
    {name: 'Anchor escapement', role: 'Two concentric locking faces hold the train; two impulse faces return energy to the pendulum.'},
    {name: 'Pendulum and crutch', role: 'Rock together about the same axis. The ideal fork transmits each impulse to the rod.'},
    {name: 'Bob and rating nut', role: 'The nut supports the bob on a threaded rod. Its height sets the effective pendulum length.'},
    {name: 'Twelve-to-one hand reduction', role: '30:90 and 18:72 pairs turn the hour sleeve once per twelve minute-shaft turns.'},
    {name: 'Case and bearings', role: 'Support the arbors. Look inside removes the enclosing panels.'},
    {name: 'Temperature comparison', role: 'A labeled explanatory chart, not a physical clock part. It compares each rod with itself at 20 °C.'},
  ],
  tryIt: [
    clockTrial('Follow the ticking clock', 'Play one minute of settled operation, or advance one beat at a time.', 'At the default setting the swing is 2.34 degrees each way and the full period is 2.000047 s. The clock loses 2.02 s/day; it is not silently calibrated to perfect time.'),
    escapementTrial('Hold the train still', 'Start at an entry-pallet lock, then play and watch the tooth.', 'The pendulum moves along the curved locking face while the wheel holds still. The Escapement reading begins at Locked.', {}, {phase: .05}),
    escapementTrial('Push on the entry pallet', 'Start halfway through the entry impulse. Follow the tooth along the sloping face.', 'The Escapement reading begins at Impulse. The tooth pushes the anchor clockwise, transferring work in the direction of its swing.', {}, {phase: .25}),
    escapementTrial('Push on the exit pallet', 'Start halfway through the return impulse on the opposite pallet.', 'The tooth pushes the anchor counterclockwise. Both half swings receive positive work even though the anchor reverses direction.', {}, {phase: .75}),
    trial('train', 'iso', true)('Follow the toothed train', 'Inspect the stacked gears and their shared shafts. Play to watch the train lock and release together.', 'The center-to-third ratio is 6:1 and third-to-escape is 10:1. Their product is 60:1; the seconds shaft turns sixty times per minute-shaft turn.'),
    trial('motion-work', 'iso', true)('Reduce minutes to hours', 'Inspect the two hand-reduction meshes and the hollow hour sleeve.', 'The 30:90 pair reduces speed threefold, and the 18:72 pair reduces it fourfold. The product is 12:1. Two direction reversals make the hour and minute hands turn the same way.'),
    pendulumTrial('Raise the bob a millimeter', 'Set the suspension-to-bob length to 992.8 mm. The nut slides up the threaded rod.', 'The clock gains 41.47 s/day, or 290.3 s in a week. This is a 43.49 s/day increase from the default rate.', {length: 992.8}),
    pendulumTrial('Regulate with a fine adjustment', 'Set the length to 993.75 mm, only 0.05 mm shorter than the default.', 'The rate changes from losing 2.02 s/day to gaining 0.15 s/day. Fine length adjustment matters; the fixed gears have not changed.', {length: 993.75}),
    chartTrial('A warm room', 'Set the steel rod in a 30 °C room. Compare the red marker with the 20 °C baseline.', 'The effective length grows 114.3 µm. The clock loses 6.99 s/day in total, 4.97 s/day more than at 20 °C.', {temperature: 30}),
    chartTrial('A brass rod', 'Choose brass at 30 °C and compare its steeper line with steel.', 'The effective length grows 188.8 µm. Total loss is 10.23 s/day; the temperature change adds 8.20 s/day of loss.', {rod: 1, temperature: 30}),
    chartTrial('An invar rod', 'Choose invar at 30 °C and compare its shallow line.', 'The effective length grows 11.9 µm. Total loss is 2.54 s/day; warming adds only 0.52 s/day of loss. A stable rod does not remove the starting calibration error.', {rod: 2, temperature: 30}),
    trial('pendulum')('A lighter driving weight', 'Use a 1 kg driving weight in the clean movement, then play.', 'Energy delivered per beat falls to 4.26 µJ. The settled swing narrows to 1.35 degrees; smaller circular error makes the clock gain 3.99 s/day.', {weight: 1}),
    trial('pendulum')('A heavier driving weight', 'Use a 5 kg driving weight in the clean movement.', 'Energy per beat rises to 21.29 µJ and the swing widens to 3.02 degrees. The clock loses 8.03 s/day. More drive does not directly make the gears count faster.', {weight: 5}),
    clockTrial('Keep a dirty movement running', 'Choose the dirty movement and a 2.5 kg driving weight.', 'The supported swing is 1.23 degrees, above the release requirement. Playback runs, and the clock gains 4.49 s/day.', {care: 1, weight: 2.5}),
    escapementTrial('Fall below the release threshold', 'Reduce that dirty movement to a 2 kg driving weight.', 'The predicted swing is only 1.10 degrees, below the required 1.12 degrees. The model shows a stopped contact; playback, continuing descent, and delivered power are blocked.', {care: 1, weight: 2}),
    escapementTrial('Too little to go on', 'Use a 1 kg driving weight with the dirty movement.', 'The predicted swing is 0.78 degrees. No repeated beat can be sustained. Choose a clean movement or more drive to restore operation.', {care: 1, weight: 1}),
  ],
  deeper: [
    {title: 'Period versus counted time', body: 'For a small swing, T = 2π√(L/g). This train counts a full pendulum cycle as two seconds regardless of its actual duration. Its average daily error is 86,400 × (2/T − 1). The default period is slightly longer than two seconds, explaining the small loss. A clock does not know that its pendulum has slowed.'},
    {title: 'Lock, impulse, and drop', body: 'This is the deadbeat form of an anchor escapement. A circular locking face centered on the anchor pivot can slide past a stationary tooth without forcing the wheel backward. The straight impulse face then permits controlled forward motion and transfers work. During drop neither pallet is pushing the pendulum. A recoil anchor has different faces and can move the train backward; that is not what is drawn here.'},
    {title: 'Why the weight hardly moves', body: 'The barrel-to-escape ratio is 8 × 6 × 10 = 480. A six-degree escape advance turns the drum by only 0.0125 degrees. With this drum radius the weight drops about 1.736 µm per beat, or 104.17 µm per displayed minute. The small movement is physically real, not enlarged for effect. At nominal rate it adds up to 15 cm per day.'},
    {title: 'Energy sets the supported swing', body: 'Weight work per beat is mass × gravity × drum descent. A quarter reaches the bob. At the settled amplitude, two impulses per period replace the loss 2πE/Q. The bob’s peak energy is mgL(1 − cos θ). A dirty movement loses more energy, so the same driving weight supports a smaller swing. If that swing cannot unlock and clear a pallet, this steady-running solution is rejected.'},
    {title: 'Circular error', body: 'A wider swing takes slightly longer than a tiny one. The period multiplier used here is 1 + θ²/16 + 11θ⁴/3072, with θ in radians. At the default 2.34-degree amplitude the increase is about 104 parts per million. This explains why a change in driving weight or friction can change the rate despite unchanged rod length.'},
    {title: 'Compare temperature changes fairly', body: 'The graph subtracts each rod’s own rate at 20 °C, using the same weight, length, and movement condition. It shows thermal sensitivity rather than total calibration error. Steel and brass slow more as they warm; low-expansion invar changes less. When the clock cannot sustain a swing, the graph hides its running-rate curves instead of inventing a rate.'},
    {title: 'Hands share one cause', body: 'The seconds hand is fixed to the escape arbor, the minute hand to the center arbor, and the hour hand to a sleeve driven by the motion work. They advance during impulse and drop, then stop during lock. Removing the escapement would remove the pacing constraint; the train would no longer keep time.'},
  ],
  misconception: 'A heavier driving weight does not directly dictate clock speed. It supplies more work per beat. That changes the supported amplitude, which changes the pendulum period slightly; the tooth ratios stay fixed.',
  limits,
  sources,
  quiz: {
    question: 'A pendulum clock begins losing more time after the room warms. Which adjustment speeds it up?',
    options: ['Raise the bob with the rating nut.', 'Lower the bob with the rating nut.', 'Increase the driving weight.'],
    answer: 0,
    explanation: 'Raising the bob shortens the effective pendulum length, reducing the period. It can compensate for thermal lengthening without changing the gear ratios.',
  },
};

export const anchorEscapementLesson = {
  simple: 'How do two pallets stop a clock train, release it, and return energy to a pendulum?',
  overview: 'This Graham deadbeat escapement links a weight-driven wheel to a pendulum. A tooth first rests on a curved locking face. As the pendulum rocks the anchor, that tooth reaches the sloping impulse face and pushes the anchor while still touching it. Only then does it leave. The wheel drops forward until the opposite pallet catches another tooth. Inspect both working faces, pause in the gap, and count two beats per tooth. The clock dial is removed in this lesson to expose the contacts; the drive, crutch, and pendulum remain available for inspection.',
  steps: [
    {title: 'Hold the wheel', body: 'The entry pallet holds a tooth on a locking face centered on the anchor pivot. The pendulum keeps swinging, but the wheel and its connected train stay still.'},
    {title: 'Pass from lock to impulse', body: 'As the anchor rocks, the tooth reaches the corner between the locking face and the sloping impulse face. Unlocking starts motion without breaking contact.'},
    {title: 'Return energy', body: 'The driven tooth slides along the impulse face, pushes the anchor, and passes work through the crutch to the pendulum. Here the wheel turns four degrees during this contact.'},
    {title: 'Clear, then drop', body: 'The tooth leaves the impulse face. Neither pallet touches a tooth during the brief gap. The wheel advances two more degrees until a tooth meets the opposite locking face.'},
    {title: 'Repeat on the other side', body: 'The return swing uses the exit pallet. Each completed release advances the wheel six degrees. Two beats, one full pendulum cycle, advance one twelve-degree tooth space.'},
  ],
  parts: [
    {name: 'Anchor escapement', role: 'The 30-tooth escape wheel, rocking anchor, two pallets, and rear crutch form the pacing mechanism.'},
    {name: 'Escape wheel', role: 'Thirty teeth make twelve-degree tooth spaces. Each beat releases half a tooth space.'},
    {name: 'Anchor and crutch', role: 'The rigid anchor carries both pallets and transmits their impulses to the pendulum through the rear fork.'},
    {name: 'Entry pallet', role: 'One curved face locks the wheel; its sloping face gives the first impulse. Inspect the contact close up.'},
    {name: 'Exit pallet', role: 'The opposite pallet receives the next tooth and gives the return impulse.'},
    {name: 'Pendulum and rating nut', role: 'The pendulum rocks with the anchor through the crutch. Its suspension-to-bob length sets most of the beat interval.'},
    {name: 'Wheel train', role: 'Three meshing gear pairs carry torque from the winding barrel to the escape-wheel shaft.'},
    {name: 'Driving weight and cord', role: 'The falling weight unwinds the drum and supplies work. No continuing drop occurs while the train is locked.'},
    {name: 'Temperature comparison', role: 'An explanatory chart compares each rod with itself at 20 °C. It is not a physical clock part.'},
  ],
  tryIt: [
    escapementTrial('Entry lock', 'Inspect the paused first locking contact, then advance one beat.', 'Entry pallet locked appears with zero completed beats and zero wheel turn. One beat changes this to exit lock, one beat, and six degrees.', {}, {phase: .05}),
    {...escapementTrial('Entry impulse', 'Inspect the first tooth pushing its pallet.', 'Entry pallet impulse appears. The tooth still touches the sloping face; the wheel has started turning but has not completed its first release.', {}, {phase: .25}), part: 'entry-pallet', isolate: false},
    {...escapementTrial('First free drop', 'Pause just after the first tooth leaves.', 'Free drop appears with no working contact. Wheel turn is between four and six degrees; the next locking tooth has not arrived.', {}, {phase: .325}), part: 'entry-pallet', isolate: false},
    escapementTrial('Exit lock', 'Inspect the opposite locking contact.', 'Exit pallet locked appears with one completed beat and six degrees of wheel turn. The pendulum can move while the train remains still.', {}, {phase: .55}),
    {...escapementTrial('Exit impulse', 'Inspect the return push.', 'Exit pallet impulse appears. The wheel has turned between six and ten degrees; one release is complete and the second is underway.', {}, {phase: .75}), part: 'exit-pallet', isolate: false},
    {...escapementTrial('Second free drop', 'Pause after the return impulse.', 'Free drop appears again. Wheel turn is between ten and twelve degrees; the entry pallet will catch the next tooth.', {}, {phase: .825}), part: 'exit-pallet', isolate: false},
    escapementTrial('Two beats, one tooth', 'Compare this state with Entry lock.', 'Two completed beats give twelve degrees of wheel turn, exactly one tooth space. Sixty beats make a full revolution. That takes one minute only at the designed two-second pendulum period.', {}, {phase: 1}),
    escapementTrial('More drive, wider swing', 'Use a 5 kg weight and inspect the impulse.', 'Delivered energy rises from 12.77 to 21.29 µJ per beat, and the supported swing widens from 2.34 to 3.02 degrees each way. The gear ratios remain unchanged.', {weight: 5}, {phase: .25}),
    escapementTrial('Shorter pendulum, faster beats', 'Set the pendulum length to 992.8 mm.', 'Time per beat falls from 1.000023 to 0.999520 seconds. Six degrees per beat remains fixed, so the wheel completes revolutions sooner.', {length: 992.8}, {phase: .25}),
    escapementTrial('Warm a brass rod', 'Use brass at 30 °C, then inspect the temperature chart.', 'The actual length becomes 993.9888 mm. Time per beat increases and the clock loses 10.23 seconds per day. The chart compares this rod with itself at 20 °C.', {rod: 1, temperature: 30}, {phase: .25}),
    escapementTrial('Too weak to release', 'Use a 1 kg weight with the dry and dirty movement.', 'The predicted swing is only 0.78 degrees, below the 1.12-degree release requirement. Stopped appears; playback and continuing delivered power are blocked.', {care: 1, weight: 1}),
    escapementTrial('Restore a clean movement', 'Keep the 1 kg weight but restore the clean movement.', 'The supported swing becomes 1.35 degrees, enough to release the pallets. Playback returns and each beat delivers 4.26 µJ. This is a new settled state, not a simulated startup.', {weight: 1}, {phase: .25}),
  ],
  deeper: [
    {title: 'Why the wheel does not recoil', body: 'A deadbeat locking face is concentric with the anchor pivot. The anchor can turn while a tooth rests against that face without forcing the wheel backward. A recoil anchor uses different faces and may reverse the train slightly. Only the deadbeat form is drawn here.'},
    {title: 'A contact, not a detached escapement', body: 'The tooth touches a locking or impulse face for most of each swing. Real sliding friction can disturb the pendulum; those contact losses and timing disturbances are not solved here. A watch lever escapement instead frees its balance for most of the cycle.'},
    {title: 'Beat count and elapsed time differ', body: 'One beat is a half swing. With 30 teeth and half a tooth space per beat, one wheel revolution needs 60 beats. Its actual duration is 30 full pendulum periods. The fixed train counts beats even when length, temperature, or amplitude changes their duration.'},
    {title: 'Work replaces loss', body: 'Weight work equals mass × gravity × drum descent. A quarter reaches the bob in this teaching model. At the settled swing, two impulses per cycle replace the modeled loss 2πE/Q. More drive widens the swing; larger loss narrows it. A supported swing below the release threshold is rejected as a running state.'},
    {title: 'What the drop animation means', body: 'The geometry enforces tooth clearance and arrival at the opposite locking face. It interpolates the short free motion; it does not solve wheel acceleration or impact. Contact impulses have the correct work direction, but the drawn harmonic swing is not a transient force simulation.'},
  ],
  misconception: 'The weight supplies energy; it does not set the beat interval directly. The pendulum sets the pace, and the escapement both counts that motion and returns energy to it.',
  limits: limits + ' The dial is hidden for contact inspection. Wheel turn is measured from the start of the demonstration; a preset may start partway through a cycle. Completed beats count finished releases, not fractional tooth motion.',
  sources,
  quiz: {
    question: 'When does a tooth push the pendulum through the anchor?',
    options: ['While it slides along the impulse face, before it leaves the pallet.', 'Only after it has cleared both pallets.', 'While the wheel is stationary on a locking face.'],
    answer: 0,
    explanation: 'The impulse requires tooth contact. After clearance the wheel drops freely until another tooth meets the opposite locking face.',
  },
};

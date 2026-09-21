import {SPINNER_DEFAULTS} from './salad-spinner-physics.js';

const trial = (title, instruction, observe, values = {}) => ({title, instruction, observe, values: {...SPINNER_DEFAULTS, ...values}, reset: true, part: 'system', isolate: false, view: 'front'});

export const saladSpinnerLesson = {
  simple: 'How do a few turns of a crank throw the water off a salad, and why do some drops stay?',
  overview: 'A salad spinner hides an epicyclic gear under its lid. The crank turns a gear ring, three planet gears on fixed pins pass the motion on, and a small sun gear spins the basket several times faster the other way. Spinning asks every drop on the leaves to be pulled around a circle. Surface tension can hold small drops there but not big ones, so the big drops fly off along straight lines to the bowl. Follow the gear, the effort of winding the basket up, and the size of the smallest drop that leaves.',
  steps: [
    {title: 'Turn the crank', body: 'The crank is fixed to the gear ring, an internal gear with 72 teeth pointing inward. One turn of the crank is one turn of the ring.'},
    {title: 'The ring drives the planets', body: 'Three planet gears sit on pins fixed in the lid. The ring’s teeth push them round on their pins, the same way the ring turns. Because the pins cannot move, the planets can only spin in place.'},
    {title: 'The planets drive the sun', body: 'The planets’ inner sides push the small sun gear the other way. Its speed is the ring’s tooth count over its own: 72 over 18 makes it turn four times for each turn of the crank.'},
    {title: 'Wind the basket up', body: 'The sun’s shaft turns the basket through a one-way clutch. Through the gear, the basket’s inertia feels the ratio squared at the crank, so spinning up takes all the force your hand gives. Once up to speed, the hand only has to beat drag.'},
    {title: 'Hold the salad on its circle', body: 'The basket wall pushes the leaves inward to keep them turning. Every drop on a leaf must be pulled inward too, by surface tension where it touches the leaf. The pull needed grows with the speed squared.'},
    {title: 'Let the big drops go', body: 'Surface tension’s grip grows with the size of a drop, but the pull needed grows with its mass, which grows faster. Above a critical size the grip is not enough, and the drop lets go. It flies off in a straight line along its circle, through the slots, to the bowl. Smaller drops, and a thin film, stay.'},
    {title: 'Let go and stop', body: 'When you stop cranking, the clutch lets the basket run on. Drag slows it slowly; the brake turns its energy into heat and stops it in a few seconds. No more water leaves as it slows, because the drops that could leave are already gone.'},
  ],
  parts: [
    {name: 'Crank and gear ring', role: 'The input: an internal gear with 72 teeth turned directly by the hand.'},
    {name: 'Planet gears and fixed pins', role: 'Three idler gears between ring and sun. Pins fixed in the lid make the carrier stand still, which is what multiplies the speed.'},
    {name: 'Sun gear and shaft', role: 'The small output gear. It turns the ring’s tooth count over its own times as fast as the crank, the other way.'},
    {name: 'One-way clutch', role: 'Rollers wedge between ramps on the sun shaft and an outer ring attached to the basket. During coasting they move into wider gaps, releasing the drive.'},
    {name: 'Perforated basket', role: 'Keeps the leaves on their circle and lets thrown water through its slots.'},
    {name: 'Brake button, spring and pad', role: 'A guided plunger presses the pad onto the basket rim after cranking; the return spring lifts it clear when released.'},
    {name: 'Wet salad and drops', role: 'Leaves carrying drops of every size. Each drop’s size and distance from the axis decide the speed at which it leaves.'},
    {name: 'Outer bowl and basket bearings', role: 'The bowl catches water and supports a rounded bottom pivot. A collar attached to the lid keeps the rotating basket centered.'},
  ],
  tryIt: [
    trial('Spin the default salad', 'Play with the 18-tooth sun, a 2.5 turn a second crank rate, 10 N on the knob, 4 s of cranking, 150 g of salad and the brake.', 'The crank reaches its rate in 1.72 s and the basket holds 600 rpm. Drops with radii bigger than 0.22 mm fly off, leaving 3.4 g of the 30 g of water. With the brake on, everything stops at 8.1 s.'),
    trial('Use the smallest sun', 'Choose the 12-tooth sun and play.', 'Six to one would spin the basket at 900 rpm, but 10 N cannot wind it up in 4 s: it peaks at 886 rpm. Only the 1.5 g film stays on the salad, and the hand puts in 14.23 J instead of 7.33 J.', {sun: 12}),
    trial('Use the largest sun', 'Choose the 24-tooth sun and play.', 'Three to one reaches its 450 rpm in 0.95 s, but the pull at the wall is only 25 g, so 6.4 g of water stays.', {sun: 24}),
    trial('Crank slowly', 'Aim for 1 turn a second and play.', 'The basket turns at only 240 rpm. The wall pulls 7 g, drops with radii up to 0.54 mm stay, and 13.1 g of water is left.', {rate: 1}),
    trial('Halve the speed', 'Aim for 1.25 turns a second and play.', 'The basket turns at 300 rpm and the wall pulls 11 g. At twice that speed, 600 rpm, the pull is 44 g, four times as much, and the water left falls from 10.7 g to 3.4 g.', {rate: 1.25}),
    trial('Crank weakly', 'Set the hand force to 2 N and play.', 'The crank never reaches its rate. The basket peaks at 243 rpm and 12.9 g of water stays.', {force: 2}),
    trial('Let go too soon', 'Crank for 1 s and play.', 'The basket gets only to 353 rpm before you stop, and 9.0 g of water stays.', {crank: 1}),
    trial('Double the salad', 'Put 300 g of salad in and play.', 'There is twice the water, 60 g, and the spin-up is slower: 600 rpm arrives at 2.62 s instead of 1.72 s. The share left is the same 11%, now 6.8 g.', {load: 300}),
    trial('Let it coast', 'Choose to let it coast and play.', 'Only drag slows the basket now. Twenty seconds after you start it is still turning at 265 rpm.', {brake: 0}),
    trial('Spin as fast as you can', 'Choose the 12-tooth sun, aim for 3 turns a second, and push with 20 N.', 'The basket reaches 1,080 rpm and a pull of 143 g. Only the 1.5 g film is left, and the hand has put in 22.91 J.', {sun: 12, rate: 3, force: 20}),
    trial('Feel the hand force', 'Play the default spin and watch the hand force on the knob.', 'Spinning up takes the whole 10 N. Holding 600 rpm takes only 0.74 N, just enough to beat drag.'),
  ],
  deeper: [
    {title: 'Why a planetary gear', body: 'With the planet carrier held still by the lid, a turn of the ring turns the sun the other way by the ratio of their tooth counts: 72 over 18 is four. Each planet turns the same way as the ring on its own pin and passes the motion on without changing the ratio. Three planets share the load and keep the sun centered, and they fit evenly only when the ring and sun tooth counts add up to a multiple of three: 72 plus 18 is 90.'},
    {title: 'The hand feels the ratio squared', body: 'To give the basket an angular acceleration, the sun must supply a torque, and the crank must supply that torque times the ratio while turning the ratio times more slowly. Together the basket’s moment of inertia is felt multiplied by the ratio squared. The default basket and salad have 2.93 g·m², which the hand feels as 46.9 g·m². Spinning up to 600 rpm stores 5.78 J in the basket.'},
    {title: 'What holds a drop on a leaf', body: 'Surface tension pulls along the edge where a drop meets the leaf. How much it can hold depends on how differently that edge sits at the front and back of the drop, which the model takes as 0.3 on the difference of the cosines of the contact angles. For an ideal hemispherical drop of radius a and mass (2/3)πρa³ turning at speed ω on a circle of radius r, that grip, γ times 2a times 0.3, matches the pull the drop needs, its mass times ω²r, when a is the square root of 3γ times 0.3 over πρω²r. At 600 rpm at the basket wall that is 0.22 mm.'},
    {title: 'Drops leave in a straight line', body: 'A drop that lets go keeps the velocity it already had, which points along its circle, not outward. Seen from above it flies along the tangent, through the slots, to the bowl. Riding inside the basket it looks as if something threw it outward, and that is what the word centrifugal describes. From outside, nothing pushed it: the basket simply stopped pulling it inward.'},
    {title: 'Four times the pull for twice the speed', body: 'The acceleration needed to stay on a circle is ω²r. At 300 rpm the basket wall needs 11 g; at 600 rpm it needs 44 g. The largest drop that can stay goes as one over the speed, so doubling the speed halves it.'},
    {title: 'The one-way clutch and the brake', body: 'The sun shaft carries two ramps inside a ring attached to the basket. Rollers wedge in the narrow gaps and transmit driving torque. When the crank stops, the basket ring carries the rollers toward wider gaps, so the shaft can stop while the basket coasts. Roller engagement and release are shown as ideal positions, without a friction/contact calculation. The brake plunger compresses its return spring and presses a pad against the upper basket rim. Its assigned friction torque turns that energy into heat: 5.00 J in the default trial. Letting it coast gives the energy to drag instead, over a much longer time.'},
    {title: 'What the model leaves out', body: 'Real leaves hold water in folds and films that vary a great deal, and drops thrown from inner leaves can be caught by outer ones. The salad shifts outward as it spins, the inertia falls as water leaves, the gears have friction, and the air in the bowl is dragged round. The contact-angle factor, the drop sizes and the drag are teaching values chosen to give sensible numbers, not measurements.'},
  ],
  misconception: 'Drops are not flung straight outward. They stop being pulled around and fly off along the tangent to their circle.',
  limits: 'Illustrative crank spinner: a 72-tooth gear ring on a 45 mm crank, three planets on fixed pins, a 12, 18 or 24-tooth sun, a 110 mm basket and a 125 mm bowl. The hand applies its full force until it reaches its target crank rate, then holds that rate. Drag is a fixed plus linear plus quadratic torque and the brake a fixed torque. Water sits as ideal hemispherical drops from 0.2 to 3 mm in radius, evenly spread in log size by volume, with 5% as a film that never leaves; drops leave instantly once the basket is fast enough for them. The roller-clutch positions illustrate engagement and overrun; transient contact deformation and slip are not simulated. Surface tension 0.072 N/m and a contact-angle factor of 0.3 are teaching values. Turning parts are drawn 20 times slower than real, drops cross to the bowl in half a second, and drops under 1.5 mm are drawn at 1.5 mm.',
  sources: [
    {title: 'OpenStax College Physics 2e: centripetal acceleration', url: 'https://openstax.org/books/college-physics-2e/pages/6-2-centripetal-acceleration'},
    {title: 'OpenStax College Physics 2e: rotational kinetic energy', url: 'https://openstax.org/books/college-physics-2e/pages/10-4-rotational-kinetic-energy-work-and-energy-revisited'},
    {title: 'OpenStax College Physics 2e: cohesion and adhesion in liquids, surface tension', url: 'https://openstax.org/books/college-physics-2e/pages/11-8-cohesion-and-adhesion-in-liquids-surface-tension-and-capillary-action'},
    {title: 'MIT: epicyclic drive ratios and fixed-carrier gearing', url: 'https://pergatory.mit.edu/2.007/resources/FUNdaMENTALs%20Book%20pdf/FUNdaMENTALs%20Topic%206.PDF'},
    {title: 'Salad-spinner freewheel clutch and spring-loaded brake examples', url: 'https://patents.google.com/patent/US20150374174A1/en'},
  ],
  quiz: {
    question: 'A drop lets go of a leaf at the basket wall. Which way does it travel?',
    options: [
      'Along the tangent to its circle, the way it was already moving.',
      'Straight outward from the center of the basket.',
      'Backward, against the way the basket turns.',
    ],
    answer: 0,
    explanation: 'Once surface tension stops pulling it inward, nothing changes the drop’s velocity, which points along its circle. It keeps going in that straight line until it meets the bowl.',
  },
};

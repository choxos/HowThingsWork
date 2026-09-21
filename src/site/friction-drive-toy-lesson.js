import {TOY_DEFAULTS} from './friction-drive-toy-physics.js';

const trial = part => (title, instruction, observe, values = {}) => ({title, instruction, observe, values: {...TOY_DEFAULTS, ...values}, reset: true, part, isolate: false, view: 'front'});
const wheelsTrial = trial('wheels'), flywheelTrial = trial('flywheel'), gearsTrial = trial('gears'), chartTrial = trial('charts'), floorTrial = trial('floor');

export const frictionDriveToyLesson = {
  simple: 'How does pushing a friction toy along the floor make it drive off by itself?',
  overview: 'A friction-drive toy hides a small steel flywheel, geared to its rear wheels so it spins many times faster than they do. Pushing the toy along the floor turns the wheels, and the floor’s grip on them spins the flywheel up. Let go, and the flywheel turns the wheels and drives the toy on until friction wins. Try pressing harder, changing the gearing, the floor, and how you let go.',
  steps: [
    {title: 'Press and push', body: 'The hand presses the toy onto the floor and pushes it forward, turning its wheels.'},
    {title: 'Spin the flywheel', body: 'Gears turn the flywheel many times faster than the wheels, storing the push’s energy in its spin.'},
    {title: 'Push again', body: 'Lifted back, the flywheel spins on; each new push can bring it faster.'},
    {title: 'Let go', body: 'Now the flywheel turns the wheels, and the floor’s grip drives the toy forward.'},
    {title: 'Roll to a stop', body: 'Rolling resistance and the gears and bearings slowly take the energy away.'},
  ],
  parts: [
    {name: 'Body', role: 'Holds the wheels, gears and flywheel.'},
    {name: 'Wheels', role: 'Grip the floor, or skid.'},
    {name: 'Gear train', role: 'Turns the flywheel many times faster than the wheels.'},
    {name: 'Flywheel', role: 'Stores energy in its spin.'},
    {name: 'Hand and press', role: 'Pushes the toy and presses it down.'},
    {name: 'Floor', role: 'Grips the wheels, and slides past as the toy moves.'},
    {name: 'Charts', role: 'Speeds over the run, and where the work goes.'},
  ],
  tryIt: [
    flywheelTrial('Pump it up', 'Push it three times, pressing with 4 N.', 'A push needs 3.00 N of grip but the floor gives only 2.07 N, so the wheels skid and each push adds less: the flywheel reaches 0.90, then 1.07, then 1.11 m/s in toy terms, 8,486 rpm.'),
    flywheelTrial('Press harder', 'Press with 8 N.', 'Now the floor can grip with up to 3.67 N, enough: every push brings the flywheel to the full 1.50 m/s, 11,459 rpm, and the toy rolls 3.00 m.', {press: 8}),
    wheelsTrial('Set it down', 'Watch the wheels as it is set down still.', 'The spinning wheels skid for 0.23 s while the flywheel hauls the toy up to 0.72 m/s; then it rolls on, 1.65 m in all.'),
    chartTrial('Let go mid-push', 'Let go of it moving, at the end of the last push.', 'Already moving at the push speed, it skids for only 0.08 s and rolls 4.44 m; the same toy with no flywheel would roll 3.82 m.', {release: 1}),
    gearsTrial('Gear it up', 'Choose the highest gearing, press with 20 N and push 6 times.', 'Geared 24 to 1, the flywheel feels like 1.26 kg at the wheels. Even pressed with 20 N the wheels skid, but the pushes spin it to 17,507 rpm, and the toy rolls 6.69 m.', {gearing: 2, press: 20, pushes: 6}),
    gearsTrial('Gear it down', 'Choose the lowest gearing.', 'Geared 6 to 1, the flywheel feels like only 79 g: the wheels grip easily, but it stores just 0.089 J and the toy rolls 0.47 m.', {gearing: 0}),
    floorTrial('Slippery tiles', 'Try it on tiles.', 'Tiles grip the pressed wheels with at most 1.29 N, so every push skids: the flywheel reaches only 0.79 m/s and the toy rolls 1.02 m.', {floor: 0}),
    chartTrial('Where the work goes', 'Watch the bar over the run.', 'The hand puts 0.717 J into the toy, yet only 0.195 J is in the flywheel when it lets go: 0.322 J has already gone into skidding.'),
  ],
  deeper: [
    {title: 'Why the gears matter', body: 'Geared N to 1, the flywheel turns N times as fast as the wheels, so for the same push it stores N squared times the energy. At the wheels it feels like extra mass: 79 g at 6 to 1, 316 g at 12 to 1, and 1.26 kg at 24 to 1, next to a toy of 120 g.'},
    {title: 'Why pressing helps', body: 'The floor can push on a wheel only so hard before it skids: static friction is at most the friction coefficient times the load. Pressing down adds load, so the wheels can grip and turn the flywheel as fast as the push instead of slipping.'},
    {title: 'The skid when it starts', body: 'Set down still, the toy’s spinning wheels skid until the toy catches up with them. Like two carts that collide and stick, the toy and flywheel end at one speed and some energy always turns into heat. Letting go while moving avoids most of it.'},
    {title: 'Why it slows evenly', body: 'Rolling resistance and the bearings push back with a steady force, so the toy loses speed at a steady rate, 0.16 m/s each second on a wooden floor at 12 to 1, and rolls a distance that grows with the square of its starting speed.'},
  ],
  misconception: 'A friction toy does not store its energy in a spring. The energy is in a spinning flywheel, and friction with the floor is what lets the push put it in and lets the flywheel get it out.',
  limits: 'Illustrative toy: 120 g on wheels 30 mm across; a steel flywheel 20 mm across and 4 mm thick, geared 6, 12 or 24 to 1; gears passing on 80% of the power; bearing friction of 40 µN m; pushes of 150 mm, with the hand carrying the toy back in 0.3 s; floors gripping with up to 0.5 to 1.0 times the load and skidding at 0.4 to 0.9, with rolling resistance 0.02 to 0.12 of the weight. Not modeled: air drag, the wheels’ own spin, bouncing and steering. The run plays at a quarter of real speed; parts turning more than ten times a second as drawn are shown blurred.',
  sources: [
    {title: 'Wikipedia: friction motor', url: 'https://en.wikipedia.org/wiki/Friction_motor'},
    {title: 'OpenStax University Physics Volume 1: moment of inertia and rotational kinetic energy', url: 'https://openstax.org/books/university-physics-volume-1/pages/10-4-moment-of-inertia-and-rotational-kinetic-energy'},
    {title: 'OpenStax University Physics Volume 1: rolling motion', url: 'https://openstax.org/books/university-physics-volume-1/pages/11-1-rolling-motion'},
    {title: 'OpenStax University Physics Volume 1: friction', url: 'https://openstax.org/books/university-physics-volume-1/pages/6-2-friction'},
    {title: 'OpenStax University Physics Volume 1: types of collisions', url: 'https://openstax.org/books/university-physics-volume-1/pages/9-4-types-of-collisions'},
  ],
  quiz: {
    question: 'Why does pressing a friction toy down while you push it help?',
    options: ['It lets the wheels grip instead of skid, so the push spins the flywheel up.', 'It winds a spring inside the toy.', 'It makes the flywheel heavier.'],
    answer: 0,
    explanation: 'The floor can only push on the wheels up to the friction coefficient times the load on them. Pressing adds load, so the floor can supply the force needed to spin the flywheel without the wheels skidding.',
  },
};

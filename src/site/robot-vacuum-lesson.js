import {ROBOT_DEFAULTS} from './robot-vacuum-physics.js';

const trial = part => (title, instruction, observe, values = {}) => ({title, instruction, observe, values: {...ROBOT_DEFAULTS, ...values}, reset: true, part, isolate: false, view: 'front'});
const roomTrial = trial('system'), chartTrial = trial('charts'), floorTrial = trial('floor'), robotTrial = trial('robot');

export const robotVacuumLesson = {
  simple: 'How does a robot vacuum clean a whole room by itself, and why do some finish so much faster?',
  overview: 'A robot vacuum is a low disk on two driven wheels with brushes and a small fan. It steers by running its wheels at different speeds and feels its way with a bumper. The simplest robots just drive until they bump and turn at random; the swept floor fills quickly at first and then ever more slowly. Robots that know where they are sweep in rows and then run along the edges, and finish in a fraction of the time. Try the strategies in an empty room and in one with a sofa and a table.',
  steps: [
    {title: 'Drive', body: 'Both wheels turn together and the robot rolls straight, its brushes sweeping a band 280 mm wide.'},
    {title: 'Bump', body: 'When its bumper touches a wall or a table leg, it stops and backs off.'},
    {title: 'Turn', body: 'It spins on the spot, its wheels turning opposite ways, to the new heading its strategy picks.'},
    {title: 'Cover the floor', body: 'Run after run, the swept bands join up until little of the floor is left.'},
  ],
  parts: [
    {name: 'Robot', role: 'Two wheels, a bumper, a side brush and a main brush.'},
    {name: 'Floor', role: 'Shaded cell by cell as it is swept.'},
    {name: 'Sofa and table', role: 'Things to bump into and drive under.'},
    {name: 'Charging dock', role: 'Where the robot starts.'},
    {name: 'Recent path', role: 'The robot’s last minute of travel.'},
    {name: 'Coverage race', role: 'The three strategies against the clock.'},
  ],
  tryIt: [
    roomTrial('Let it bounce', 'Start cleaning.', 'Bouncing at random, it sweeps 73.0% of the floor it can reach in 5 min, but the last patches come slowly: reaching 90% takes 12.0 min, and in 20 min it bumps into things 181 times.'),
    chartTrial('Rows beat bouncing', 'Switch to rows, then edges, in the empty room.', 'Sweeping back and forth, it passes 90% after 2.9 min and 99% after 3.4 min; bouncing at random needs 8.6 min to pass 90% and still falls short of 99% after 20 min.', {strategy: 2, room: 0}),
    floorTrial('The edges', 'Watch the floor as the rows finish.', 'After 11 lane shifts the rows leave strips along the walls. A lap along the edges, about 67 s long, brings the floor to 100% by 5 min.', {strategy: 2, room: 0}),
    chartTrial('Furniture in the way', 'Keep rows, then edges, in the furnished room.', 'Table legs end rows early and the sofa blocks them, so passing 90% takes 5.2 min instead of 2.9, and reaching 99% takes 19.4 min.', {strategy: 2}),
    chartTrial('A spiral first', 'Switch to spiral, then bounce.', 'Winding out from the dock, it meets the wall within seconds and then simply bounces: 74.4% after 5 min, about the same as the 73.0% of bouncing from the start.', {strategy: 1}),
    floorTrial('Corners', 'Look into the corners of the empty room.', 'A round robot 340 mm across cannot reach 4.9% of the open floor: the corners, and the 10 mm it keeps clear of the walls.', {room: 0}),
    robotTrial('How it turns', 'Watch the wheels at a bump.', 'Its wheels run in opposite directions at 0.14 m/s, spinning it on the spot at 69.8° a second, so a quarter turn takes 1.29 s.'),
    robotTrial('Battery', 'Clean until the end.', 'Drawing 33 W, it uses 29.4% of its 37.44 Wh battery, leaving about 48 min of cleaning.'),
  ],
  deeper: [
    {title: 'Steering with two wheels', body: 'A robot like this has no steering wheel. Driving both wheels equally moves it straight; different speeds curve its path; opposite speeds spin it in place. On its tightest spiral, of radius 150 mm, the outer wheel runs 7.57 times as fast as the inner.'},
    {title: 'Why random still works', body: 'Each straight run sweeps a band across the room, and random bands overlap more and more as the floor fills. The swept share closes on the whole floor like a fading exponential: quickly at first, then slower and slower.'},
    {title: 'Maps and rows', body: 'Sweeping in rows only works if the robot knows where it is. Real ones count wheel turns and look around with cameras or lasers to build a map; this model simply knows its position exactly.'},
    {title: 'Round versus square', body: 'A round robot can turn anywhere without catching on anything, but it cannot fit into a corner. Some robots have a flat front so their brushes reach further into corners.'},
  ],
  misconception: 'A robot vacuum does not need a map to clean a room: bouncing at random eventually covers almost all of it. A map makes cleaning far faster, not possible.',
  limits: 'Illustrative robot: 340 mm across with wheels 230 mm apart, driving at 0.28 m/s and sweeping a band 280 mm wide; it backs off 30 mm at a bump and keeps 10 mm clear of everything; random turns of 100 to 260 degrees from a fixed seed; lanes 0.25 m apart; a 16 m lap of the edges. A 4 m by 3 m room, empty or with a sofa and a table, in 20 mm cells. Battery 14.4 V and 2.6 Ah feeding 33 W. Not modeled: wheel slip, position errors, sensors seeing ahead, the dirt itself, and returning to charge. The 20 minutes play sixty times faster than real time.',
  sources: [
    {title: 'Wikipedia: differential wheeled robot', url: 'https://en.wikipedia.org/wiki/Differential_wheeled_robot'},
    {title: 'OpenStax University Physics Volume 1: rotational variables', url: 'https://openstax.org/books/university-physics-volume-1/pages/10-1-rotational-variables'},
    {title: 'OpenStax University Physics Volume 1: uniform circular motion', url: 'https://openstax.org/books/university-physics-volume-1/pages/4-4-uniform-circular-motion'},
  ],
  quiz: {
    question: 'Why does a randomly bouncing robot take so long to sweep the last few percent of a room?',
    options: ['Its runs keep crossing floor it has already swept.', 'Its battery weakens as it goes.', 'Dust settles back onto the swept floor.'],
    answer: 0,
    explanation: 'Once most of the floor is swept, each new random run lands mostly on swept floor, so the remaining patches are found only by chance.',
  },
};

import {DOOR_DEFAULTS} from './door-closer-physics.js';

const trial = (part, view = 'front') => (title, instruction, observe, values = {}) =>
  ({title, instruction, observe, values: {...DOOR_DEFAULTS, ...values}, reset: true, part, isolate: false, view});

const onTrace = trial('trace'), onLatch = trial('latch'), onFrame = trial('frame');

export const doorCloserLesson = {
  simple: 'Why does a door on a closer swing shut briskly and then ease into its frame?',
  overview: 'A door closer is two machines in one body. A spring stores everything the hand spends opening the door and gives all of it back to shut it. A piston on the same rack pushes oil through a small adjustable hole, and because the pressure a hole needs grows as the square of the flow through it, that hole, and not the spring, decides how fast the door may travel. A second hole takes over for the last few degrees so the door still has something left when it meets its latch, and a third catches a door flung open before it reaches the wall. Press Play to push the door open and let go, then change the valves, the spring and the door.',
  steps: [
    {title: 'Store what the hand spends', body: 'Opening the door turns a pinion, the pinion drives a rack along, and the rack compresses a spring. The wider the door goes the harder the spring pushes back, which is why the last part of opening is the heaviest.'},
    {title: 'Push oil, not the door', body: 'The same rack carries a piston in a body full of oil. While the door is being opened a check valve lets the oil round the piston almost freely, so the hand feels the spring and little else.'},
    {title: 'Send it through a hole', body: 'Let go, and the spring drives the piston back. Now the oil has to leave through a small hole, and the pressure that takes rises as the square of how fast the piston is moving.'},
    {title: 'Settle at a speed', body: 'The door speeds up until the moment the oil resists with matches the moment the spring pushes with, and then travels at that speed. Opening the hole a little lets the door go much faster.'},
    {title: 'Drive the bolt home', body: 'At the end the latch bolt has to be pushed back against its own spring. A closer that cannot do that leaves the door standing open, which is the only failure that matters on a fire door.'},
  ],
  parts: [
    {name: 'Frame, hinge and swing', role: 'Where the leaf turns, and the zones of its arc where each valve is in charge.'},
    {name: 'Door leaf, in plan', role: 'The leaf itself, drawn at the width the standard tabulates against each power size.'},
    {name: 'Latch bolt and strike', role: 'The one thing the closer has to beat at the end of the swing.'},
    {name: 'Closer, cut open', role: 'Spring, rack, pinion and piston in one body, with the oil either side of the piston.'},
    {name: 'The three orifices', role: 'The holes the oil has to get through, which are what set the speed.'},
    {name: 'The angle, through the swing', role: 'How far open the door stands from one moment to the next, with the pressure behind it.'},
  ],
  tryIt: [
    onTrace('Let it close', 'Press Play. The hand pushes the door to 80 degrees, lets go, and the closer takes it from there.',
      'The door coasts on to 93.7°, where the back check has it. Coming back it takes 5.13 s to go from 90° to 12° from the latch, it latches 7.69 s after the push began, and it reaches the strike at 16.4°/s.'),
    onTrace('Turn the sweep valve down', 'Set the sweep valve to 0.15 mm and press Play.',
      'The same spring now takes 20.59 s to bring the door from 90° to 12°. Halving the hole quarters its area and quadruples the pressure the oil needs at any speed, so the door settles four times slower.', {sweep: 0.15}),
    onTrace('Open the sweep valve up', 'Set the sweep valve to 0.6 mm and press Play.',
      'Now the door covers the same stretch in 1.34 s, well inside the 5 s an accessible door is supposed to take, and it hits its strike at 21.5°/s instead of 16.4. This is the setting that makes a door bang.', {sweep: 0.6}),
    onLatch('Shut the latch valve down', 'Set the latch valve to 0.15 mm and press Play.',
      'The sweep is untouched at 5.13 s, but the last stretch now takes so long that the door creeps onto its strike at 1.0°/s and the whole close runs to 13.56 s. This is how a door ends up resting against its frame instead of latching.', {latch: 0.15}),
    onFrame('Throw it open with the back check off', 'Switch the back check off, set the push to 150 N·m and press Play.',
      'Nothing slows the door on the way out. It reaches the stop still doing 197°/s and puts 106.8 J into it, which is what breaks handles and plaster.', {push: 150, backcheck: 0}),
    onFrame('Throw it open with the back check on', 'Switch the back check back on, leave the push at 150 N·m and press Play.',
      'The same shove now meets a third hole on the way out, and the oil behind it stands at 198.8 bar. The door stops at 119.8° without ever touching the stop.', {push: 150}),
    onLatch('Fit a closer too weak for the door', 'Choose the weakest closer offered and press Play.',
      'The spring holds only 7.8 N·m at the shut position while the bolt asks 19.0 N·m, so the door stops 3.2° short and stands there holding 0.44 J against a bolt it cannot open.', {size: 1}),
  ],
  deeper: [
    {title: 'Why the hole decides and the oil does not', body: 'A sharp hole passes Cd·A·sqrt(2·dP/rho), so turning that round, the pressure it needs is rho·Q²/(2·Cd²·A²). The flow is the piston area times the pinion radius times the door’s speed, so the moment the closer resists with goes as the speed squared and as the inverse square of the hole’s area. At 0.3 mm that is 580.0 N·m for every (rad/s)², and at 0.15 mm it is 9,279.5, sixteen times as much, because halving a diameter quarters an area and the area comes in squared.'},
    {title: 'What a power size is', body: 'BS EN 1154 grades closers by the door they are meant to shut. Size 1 is for a leaf up to 750 mm and 20 kg and size 7 for 1,600 mm and 160 kg, with 950 mm and 60 kg at size 3 in between. DIN 18040 fixes the other end of the same size 3: its opening moment may not exceed 47 N·m between 0 and 60 degrees. A door closer on a fire door has to be at least a size 3, because the standard judges sizes 1 and 2 too weak at the latch.'},
    {title: 'Why the door’s weight hardly enters', body: 'Between the two ends of the swing the door travels at whatever speed makes the oil resist as hard as the spring pushes, and neither of those has the door’s mass in it. The 1,600 mm, 160 kg leaf takes 5.02 s from 90 to 12 degrees on this closer against 5.13 s for the 950 mm, 60 kg leaf, although its moment of inertia is 136.5 kg·m² against 18.1. Its weight shows up where speed is changing: it takes longer to push open, and it arrives at the latch carrying 4.11 J instead of 0.74.'},
    {title: 'Why the last few degrees get their own valve', body: 'The Door closer page calls the second setting the latch speed, the rate over the last ten to fifteen degrees of the arc, and says it is there to be set faster than the sweep so the door latches properly. Here the change happens at 12 degrees. It matters because the bolt has to be driven back over the last 5 degrees, and on this leaf that asks 19.0 N·m against the 23.5 N·m the spring has left when the door is shut.'},
    {title: 'What the back check is for', body: 'dormakaba’s TS 83 folder describes a back check whose resistance begins beyond about 70 degrees and answers in proportion to how hard the door is thrown, so that it is almost imperceptible on a door opened gently. Switch it off and a hard shove carries this door into its stop at 197°/s, leaving 106.8 J in the stop. Switch it on and the same shove dies at 119.8°.'},
    {title: 'A machine for throwing energy away', body: 'Over one ordinary swing the hand puts in 83.8 J, the spring holds 68.4 J of it at the top of the arc, and by the time the door is shut 76.5 J has gone into warming the oil, 4.9 J into friction and 1.66 J into the bolt, with 0.74 J arriving as the bang. None of it is kept. That is the whole design: store the hand’s work, then spend it again slowly enough that nobody is hit by the door.'},
  ],
  misconception: 'The oil does not shut the door; the spring does, and the oil only decides how fast. Turning the speed valves can never make a door close harder, and a door that will not latch is asking for a stronger spring or a wider latch orifice, not a slower sweep.',
  limits: 'One leaf on one hinge, in plan, with no wind, no smoke seals, no draft and no change with temperature. The spring is taken as affine in the door angle, which is what a straight rack gives, with its moment at 60 degrees scaled from the one sourced figure, the 47 N·m of a size 3 closer, in proportion to each size’s tabulated test door mass, and split half as preload and half as rate. The pinion pitch radius of 12 mm, the bypass and back check orifices, the latch force of 20 N at the leading edge over the last 5 degrees, the hinge and seal friction, the stop at 120 degrees and what it absorbs, and the oil at 870 kg/m³ with a discharge coefficient of 0.62 are all declared. The arm and its geometry, the pressure relief valve real closers carry, delayed action, cavitation in the oil and the way it thins as it warms are left out.',
  sources: [
    {title: 'Wikipedia: Door closer', url: 'https://en.wikipedia.org/wiki/Door_closer'},
    {title: 'dhf Best Practice Guide: controlled door closing devices to BS EN 1154', url: 'https://www.dhfonline.org.uk/media/documents/documents37a.pdf'},
    {title: 'Wikipedia in German: Türschließer, on the opening moment DIN 18040 allows', url: 'https://de.wikipedia.org/wiki/T%C3%BCrschlie%C3%9Fer'},
    {title: 'dormakaba TS 83 technical folder', url: 'https://dormakaba-res.cloudinary.com/image/upload/v1745407038/dormakaba-prod/120000000136-dormakaba-door-closer-ts83-technical-folder-en.pdf'},
    {title: 'LCN door closer reference guide, 4040XP', url: 'https://www.lcnclosers.com/content/dam/allegion-us-2/web-files/lcn/information-documents/LCN_4040XP_Brochure_015520.pdf'},
    {title: 'Wikipedia: Orifice plate', url: 'https://en.wikipedia.org/wiki/Orifice_plate'},
    {title: 'Wikipedia: Discharge coefficient', url: 'https://en.wikipedia.org/wiki/Discharge_coefficient'},
    {title: 'Wikipedia: List of moments of inertia', url: 'https://en.wikipedia.org/wiki/List_of_moments_of_inertia'},
    {title: 'Wikipedia: Hooke’s law', url: 'https://en.wikipedia.org/wiki/Hooke%27s_law'},
    {title: 'Wikipedia: Mineral oil', url: 'https://en.wikipedia.org/wiki/Mineral_oil'},
    {title: 'Wikipedia: Standard gravity', url: 'https://en.wikipedia.org/wiki/Standard_gravity'},
  ],
  quiz: {
    question: 'A door on a closer slams into its frame. Which adjustment is the one that fixes it?',
    options: [
      'Close the sweep valve down, so the oil has a smaller hole to get out through.',
      'Fit a stronger spring, so the door is under firmer control all the way.',
      'Open the latch valve up, so the last part of the swing is quicker.',
    ],
    answer: 0,
    explanation: 'The spring decides how hard the door is pushed and the hole decides how fast it may go. Closing the sweep valve from 0.6 mm to 0.3 mm takes this door from 1.34 s to 5.13 s between 90° and 12°, on the same spring.',
  },
};

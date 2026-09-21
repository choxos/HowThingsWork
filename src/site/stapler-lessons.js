import {STAPLER_DEFAULTS} from './stapler-physics.js';

const trial = part => (title, instruction, observe, values = {}) => ({title, instruction, observe, values: {...STAPLER_DEFAULTS, ...values}, reset: true, part, isolate: false, view: 'front'});
const systemTrial = trial('system'), detailTrial = trial('detail'), chartTrial = trial('chart');

export const sources = {
  stapler: {title: 'Wikipedia: Stapler', url: 'https://en.wikipedia.org/wiki/Stapler'},
  staple: {title: 'Wikipedia: Staple (fastener)', url: 'https://en.wikipedia.org/wiki/Staple_(fastener)'},
  energized: {title: 'Google Patents: US6918525B2, spring energized desktop stapler', url: 'https://patents.google.com/patent/US6918525B2/en'},
  thickness: {title: 'Google Patents: US6942136B2, stapler apparatus to staple stacks of paper with different thicknesses', url: 'https://patents.google.com/patent/US6942136B2/en'},
  lever: {title: 'Wikipedia: Lever', url: 'https://en.wikipedia.org/wiki/Lever'},
  modulus: {title: 'Wikipedia: Section modulus', url: 'https://en.wikipedia.org/wiki/Section_modulus'},
  grammage: {title: 'Wikipedia: Grammage', url: 'https://en.wikipedia.org/wiki/Grammage'},
};

export const limits = 'A desktop stapler pressed slowly over one staple and drawn at true size, with the blade 160 mm in front of the hinge and the magazine’s nose 9 mm above the anvil at rest. Staples from the table of sizes: 26/6 of 0.405 mm wire with a 12.7 mm crown, and 24/6 and 24/8 of 0.511 mm wire with a 12.9 mm crown, since the table gives 24/8 no crown width; crowns measured across the outside and legs to the top of the crown, all as round wire. Each sheet 0.1 mm. Every force is illustrative and grows in a straight line with travel: a magazine spring of 3 N, rising 0.2 N every millimeter; a return spring of 5 N, rising 0.5 N every millimeter; glue that gives way at 40 N after 0.15 mm; 6 N at each tip while it cuts; 12 N for every millimeter of each leg in the paper; and 28 N to fold each leg of 0.405 mm wire, scaled by the cube of the diameter for thicker wire, with cutting and rubbing the same for every wire. They are sized so a 26/6 staple’s hardest push, pressed over the blade, stays within the 15 to 30 pounds-force a patent reports, from 1 to 25 sheets. Folded legs turn a sharp corner and lie flat along the back of the stack; legs that run into each other are drawn passing, though real ones jam, buckle or curl back up through the paper. Not modeled: the arm’s weight and friction at the pins, the paper squeezing under the nose, feeding the next staple, and how firmly the folded legs hold. The blade goes down at 4 mm a second.';

export const staplerLesson = {
  simple: 'How does a stapler fold a staple’s legs behind the paper?',
  overview: 'Pressing the arm lowers the magazine onto the paper, then pushes a blade down on the front staple. The blade breaks it off the strip and drives its two legs straight through the stack, and the anvil underneath folds whatever comes out the back. Change the paper, the staple, the anvil and where you press to see how much leg is left to fold, whether the legs meet, and what the arm asks of your hand.',
  steps: [
    {title: 'Close on the paper', body: 'The magazine comes down until its nose rests on the paper, held up only by a light spring.'},
    {title: 'Break off one staple', body: 'The blade pushes on the front staple, and the glue holding it to the strip gives way.'},
    {title: 'Pierce the stack', body: 'The legs go straight down through every sheet, rubbing on the paper as they go.'},
    {title: 'Fold against the anvil', body: 'Where the tips come out the back of the stack, grooves in the anvil turn them along the paper, toward each other or apart.'},
  ],
  parts: [
    {name: 'Arm and blade', role: 'A lever about the hinge: the hand pushes on the arm, and the arm pushes the blade.'},
    {name: 'Magazine and staples', role: 'Holds the strip and brings the front staple down onto the paper.'},
    {name: 'Springs', role: 'Hold the magazine up and lift the arm after a press.'},
    {name: 'Base and anvil', role: 'The anvil’s grooves fold the legs.'},
    {name: 'Paper', role: 'The stack the legs must get through.'},
    {name: 'Cut across the nose', role: 'The staple, the paper and the anvil drawn 6 times larger.'},
    {name: 'Pushes', role: 'The hand’s push and the blade’s, on one scale.'},
    {name: 'Push over the press', role: 'Force against travel, for the blade and for the hand.'},
  ],
  tryIt: [
    systemTrial('Press over the blade', 'Keep 10 sheets, press over the blade and press Play.', 'The magazine comes down onto the paper. The blade breaks the front staple off its strip and the arm gives way, then the legs pierce the 1.0 mm stack and the anvil folds the 4.6 mm of each leg that comes out the back toward the middle. Pressed over the blade, the hand pushes exactly as hard as the blade and moves exactly as far.'),
    chartTrial('Press near the hinge', 'Press 80 mm from the hinge, half as far out as the blade.', 'The hand now pushes 2.0 times as hard as the blade but moves only 8.0 mm while the blade goes down 16.1 mm. On the chart the orange line stands twice as high and half as wide as the steel one, over the same area: the same work.', {hand: 80}),
    detailTrial('A thick stack', 'Set 40 sheets.', 'The 4.0 mm stack leaves only 1.6 mm of each leg to fold under the paper, and the legs rub through four times as much paper: the hardest push rises to 161.0 N.', {sheets: 40}),
    detailTrial('Too thick to staple', 'Set 60 sheets.', 'The 6.0 mm stack is thicker than the 5.6 mm of leg under the crown. The tips stop inside the paper, the anvil has nothing to fold, and the staple holds nothing together.', {sheets: 60}),
    detailTrial('Long legs on thin paper', 'Choose the long-legged staples and set 2 sheets.', 'Each leg comes 7.3 mm out through the 0.2 mm stack, farther than the 6.19 mm from a leg to the middle of the crown, so the legs run 2.19 mm past each other.', {staple: 2, sheets: 2}),
    detailTrial('Pin instead', 'Keep the long legs and 2 sheets, and turn the anvil to temporary.', 'Folded outward, away from each other, the legs can never meet: their tips end 26.97 mm apart. Stapled this way the sheets hold more weakly, but the staple pulls out far more easily.', {staple: 2, sheets: 2, anvil: 1}),
    systemTrial('Thicker wire', 'Choose the staples of thicker wire with the shorter legs.', 'Folding a leg of 0.511 mm wire takes 2.01 times the force a leg of 0.405 mm wire takes, because the force to bend a round wire grows with the cube of its diameter. The hardest push rises from 89.0 N to 145.5 N.', {staple: 1}),
    chartTrial('More sheets, a harder press', 'Set 25 sheets.', 'The hardest push comes as the legs fold, now through 2.5 mm of paper: 125.0 N, or 28.1 pounds-force, against 15.7 pounds-force on 2 sheets. These forces are illustrative, sized to the 15 to 30 pounds-force a patent reports for a conventional stapler.', {sheets: 25}),
  ],
  deeper: [
    {title: 'A lever about the hinge', body: 'Typical staplers are third-class levers: the hand pushes between the hinge and the blade. The arm turns about the hinge, so every point on it moves down in proportion to its distance from the hinge, and in a slow press the hand’s work is the blade’s. Pressed 80 mm from the hinge, half the blade’s 160 mm, the hand pushes twice as hard as the blade and moves half as far. Pressed over the blade, as a patent describes a common desktop stapler, 15 pounds to move the staple 1 mm takes 15 pounds to move the handle the same 1 mm.'},
    {title: 'Resists, gives way, resists again', body: 'Three forces must be overcome: breaking the staple off the strip, piercing the papers, and folding the legs behind them. So the handle resists, suddenly gives way, and then resists again. On the chart the glue lets go 0.15 mm into the drive and the arm drops free until the tips reach the paper; the legs then rub harder as more of them is in the paper, and the fold is the hardest part.'},
    {title: 'How much leg comes through', body: 'Take the crown’s wire and the stack from the leg’s length, and the rest comes out the back to be folded. A 26/6 staple has 5.595 mm of leg under its crown, so 10 sheets leave 4.595 mm to fold, and from 56 sheets on nothing comes through. As a patent puts it, if the legs are shorter than the stack is thick, the staple will not go through and hold the sheets together.'},
    {title: 'Why short legs never meet', body: 'From the middle of one leg to the middle of the crown is half the crown’s width less half the wire: 6.15 mm on a 26/6 staple. Even through a single sheet its legs come only 5.495 mm out, so folded inward they can never meet. A 24/8 staple’s legs come out far enough to meet on 12 sheets or fewer. Long legs on a thin stack wrap around and stick out of the top, a patent warns, where they can hurt the person handling the pages.'},
    {title: 'Bending a round wire', body: 'A leg stays folded only once its metal yields right across the wire. The bending moment that takes is the wire’s strength times its plastic section modulus, which for a round wire is its diameter cubed over 6. So a wire 1.26 times as thick takes 2.01 times the force to fold, if both are equally strong and bent alike. The US standard’s heavy duty office staple has a flat leg, 500 μm by 800 μm.'},
    {title: 'Two anvil settings', body: 'The anvil usually has two settings. In the permanent setting it folds the legs toward the middle of the crown, for papers not expected to come apart. Turned to the temporary setting, it folds them outward, leaving the legs and crown more or less in a straight line: the papers hold more weakly, but the staple is much easier to remove.'},
    {title: 'How thick is a sheet', body: 'Paper is sold by weight, not thickness. Common 20-pound bond copy paper is roughly 97 to 114 μm thick, so this stapler takes every sheet as 0.1 mm.'},
  ],
  misconception: 'A stapler does not bend the legs on their way through the paper. They go through straight; only the part that comes out the back meets the anvil, and only that part can be folded.',
  limits,
  sources: [sources.stapler, sources.staple, sources.energized, sources.thickness, sources.lever, sources.modulus, sources.grammage],
  quiz: {
    question: 'Why can a 24/8 staple’s legs run into each other on 2 sheets, while a 26/6 staple’s legs never do?',
    options: ['Through a thin stack, a 24/8 leg comes out farther than the distance from the leg to the middle of the crown.', 'Thicker wire bends farther than thin wire.', 'The anvil folds harder when there is less paper.'],
    answer: 0,
    explanation: 'Each 24/8 leg comes 7.3 mm out through 2 sheets, past the 6.19 mm to the middle. A 26/6 leg never comes more than 5.495 mm out, short of its 6.15 mm.',
  },
};

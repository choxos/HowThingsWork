import {STAPLER_DEFAULTS, staplerPlan, STAPLER} from './stapler-physics.js';
import {staplerCyclePlan} from './stapler-cycle.js';

const trial = (part, title, observe, values = {}, moment = (p, c) => c.duration) => {
  const settings = {...STAPLER_DEFAULTS, ...values}, plan = staplerPlan(settings), cycle = staplerCyclePlan(plan), time = moment(plan, cycle);
  return {title, instruction: 'The settings and observation time are applied. Press Play to continue an intermediate moment or replay a completed cycle.', observe, values: settings, initialState: {settings, time}, reset: true, part, isolate: true, view: 'front'};
};
const atDrop = drop => (plan, cycle) => cycle.pressStart + drop(plan) / STAPLER.speed;

export const limits = 'Assigned teaching geometry, not a product or capacity rating. The blade follows an ideal vertical guide 160 mm from the arm hinge; the magazine pivots onto an incompressible stack. Each sheet is assigned 0.1 mm thickness. Wire is rectangular; leg height and crown width are outside dimensions in this model. The 6 mm specimens use section dimensions from two manufacturer examples; the 8 mm specimen is an assigned comparison. Every force coefficient is illustrative: magazine resistance starts at 3 N and grows 0.2 N/mm; drive return resistance starts at 5 N and grows 0.5 N/mm; separation rises to 40 N over 0.15 mm; each penetrating tip adds 6 N, each embedded millimeter adds 12 N per leg, and light-wire folding adds 28 N per leg. These values are not fitted to measured hand forces. Folding is planar with sharp corners and stops at first inward-tip interference. Paper compression, tearing, staple buckling, bend-radius effects, pin friction, product compatibility and holding strength are not predicted. Two supported leaf strips illustrate return action; their deformation is not a beam-stress solution. Return and feed are prescribed slow motions, with no rebound or feed-force calculation. One cycle uses one of eight loaded staples; replay reloads the starting row.';

export const staplerLesson = {
  simple: 'How do a blade, an anvil and two kinds of spring turn a row of staples into fastened pages?',
  overview: 'Press the arm to lower the magazine, separate one staple and drive its legs through the paper. Anvil grooves turn the emerging ends. Leaf springs then raise the driver and magazine, and a coil spring advances the next staple. Inspect the working parts, enlarge the fold or compare hand force with blade force. The default cutaway exposes the mechanism; uncheck Look inside to restore the covers.',
  steps: [
    {title: 'Lower the magazine', body: 'The arm brings the magazine onto the stack. Its hinge and front guide keep the leading staple aligned with the driver.'},
    {title: 'Drive one staple', body: 'The driver separates the front staple from the strip, then forces its tips through the paper. The remaining row stays behind the driver.'},
    {title: 'Turn the emerging ends', body: 'Anvil grooves guide the ends inward or outward. Only the length that emerges beyond the back of the paper can form a clinch.'},
    {title: 'Return, then feed', body: 'Leaf return springs lift the blade and magazine. Once the driver clears the next crown, the coil spring pushes the follower and strip forward by one staple pitch.'},
  ],
  parts: [
    {name: 'Arm and blade', role: 'The hinged arm supplies the push to an ideal vertically guided driver. An orange marker shows the chosen hand position.'},
    {name: 'Magazine and staples', role: 'The hinged channel, rails and front guide support and position the staples.'},
    {name: 'Staple strip and follower', role: 'Seven spare staples sit behind the active one. Gold marks the next staple so its half-millimeter advance can be followed.'},
    {name: 'Leaf return springs', role: 'Two schematic supported leaves lift the arm and magazine after the drive.'},
    {name: 'Base and anvil', role: 'Supports the stack and guides the emerging legs into grooves.'},
    {name: 'Paper', role: 'An assigned stack thickness; its compression and holding strength are not modeled.'},
    {name: 'Cut across the nose', role: 'A separate enlarged inspection of the driver, staple, paper and anvil.'},
    {name: 'Force during the press', role: 'Separate force-versus-travel curves show the ideal lever’s equal input and output work.'},
  ],
  tryIt: [
    trial('system', 'One complete cycle', 'The light staple has clinched 10 sheets. Each leg emerged 4.60 mm. The driver has returned, the gold staple has advanced 0.50 mm, and seven staples remain in the magazine.'),
    trial('system', 'Magazine on the paper', 'The magazine nose now touches the 1.00 mm stack. The driver has moved 7.710 mm since contacting the crown; separation of the front staple is about to begin.', {}, atDrop(p => p.closed)),
    trial('detail', 'The strip lets go', 'The front staple has moved 0.15 mm relative to its row. The assigned separation resistance drops; the tips are still above the paper.', {}, atDrop(p => p.broken + .001)),
    trial('detail', 'Halfway through the paper', 'Both tips are 0.50 mm into the 1.00 mm stack. They have not reached the anvil, so no part of either leg is folded yet.', {}, atDrop(p => p.touch + p.stack / 2)),
    trial('detail', 'Watch the fold grow', 'Each tip has emerged 2.00 mm and turned inward. The crown is still 2.60 mm above its final seated position.', {}, atDrop(p => p.anvil + 2)),
    trial('system', 'Return after the press', 'The deposited staple stays in the paper while the leaf return assembly raises the blade and magazine. The spare row has not advanced yet.', {}, (p, c) => c.releaseStart + 1.1),
    trial('strip', 'Before the next feed', 'The driver is back, 0.30 mm above the loaded crown height. The gold staple is still one 0.50 mm pitch behind the delivery position; seven staples remain.', {}, (p, c) => c.releaseFinish),
    trial('strip', 'Next staple ready', 'The gold staple and follower have both advanced 0.50 mm. The feed coil has lengthened by the same amount. Compare with Before the next feed at the same magnification.'),
    trial('chart', 'Press near the hinge', 'At 80 mm from the hinge, hand force doubles and hand travel halves. Blade travel is 16.10 mm; hand travel is 8.05 mm. Both curves enclose 0.484 J of assigned work.', {hand: 80}),
    trial('detail', 'A thick stack', 'Forty assigned sheets make a 4.00 mm stack. Only 1.60 mm of each light-staple leg emerges to fold. Assigned peak blade force is 161.1 N; this is not a product capacity test.', {sheets: 40}),
    trial('detail', 'Too short for a clinch', 'The 6.00 mm stack leaves both tips 0.40 mm inside the paper when the crown seats. There is no emerging leg to clinch. The model does not calculate frictional holding.', {sheets: 60}),
    trial('detail', 'Long legs meet', 'The long specimen on two sheets would leave 7.35 mm per leg to fold inward, but each tip has only 6.20 mm to reach the middle. Motion stops at tip contact, with the crown 1.15 mm above seating. No overlapping legs or jam force is predicted.', {staple: 2, sheets: 2}),
    trial('detail', 'Turn the ends outward', 'With the same long specimen and two sheets, outward grooves let the full 7.35 mm emerge on each side. The crown seats, the tip separation reaches 27.10 mm, and the return/feed cycle completes.', {staple: 2, sheets: 2, anvil: 1}),
    trial('chart', 'Thicker rectangular wire', 'Increasing in-plane thickness from 0.40 to 0.45 mm while keeping width at 0.50 mm raises the assigned folding force by 1.266 times, not the cube of a round-wire diameter. Other assigned force terms are unchanged.', {staple: 1}),
    trial('chart', 'Keep the whole force curve', 'With the long specimen, 70 assigned sheets and the hand at 80 mm, peak hand force reaches 495.9 N. The chart expands to include it. This illustrates the assigned force law, not a claim that a desktop stapler can staple 70 sheets.', {sheets: 70, staple: 2, hand: 80}),
  ],
  deeper: [
    {title: 'The lever trades force for travel', body: 'For vertical forces at fixed horizontal distances, moment balance gives hand force × hand distance = blade force × 160 mm. The ideal arm geometry gives the inverse travel ratio. Moving the hand from 160 to 80 mm therefore doubles force and halves travel, leaving work unchanged. The plotted areas integrate force over each point’s own travel.'},
    {title: 'A force profile is not a product measurement', body: 'Separation, penetration and clinching resist different stages of the press. The lesson assigns simple coefficients to make those stages visible. A patent describes the same broad resistance stages, but it does not calibrate these curves. Actual forces depend on the stapler, staple material, paper, speed and friction.'},
    {title: 'Count the leg that can emerge', body: 'For these outside dimensions, emerging length = leg height − crown wire thickness − stack thickness. The light specimen on 10 sheets gives 6 − 0.40 − 1.00 = 4.60 mm. A positive value permits a fold in this geometry; it does not by itself predict joint strength.'},
    {title: 'Stop at interference', body: 'The heavy specimen’s leg centerline is 6.20 mm from the middle. On 13 sheets or fewer, the assigned 8 mm legs would extend past the middle if fully folded inward. The planar model stops when the flat ends meet. A real staple may twist, buckle or curl; those three-dimensional contact effects are outside this lesson.'},
    {title: 'Why the section shape matters', body: 'For rectangular wire with width b and in-plane thickness t, integrating distance from the neutral axis over the yielded section gives plastic section modulus Z = bt²/4. With equal yield stress and equal bending moment arm, folding force scales with Z. The chosen 0.45/0.40 thickness ratio therefore gives (0.45/0.40)² = 1.265625, since width is unchanged.'},
    {title: 'Two spring jobs', body: 'The leaf return assembly separates the driver and anvil after a press. The compressed coil behind the follower pushes the remaining staple row toward the nose. The feed waits for driver clearance in this slow teaching cycle; the model prescribes timing and does not solve spring dynamics.'},
    {title: 'Staple labels do not determine capacity', body: 'Manufacturer examples give rectangular section dimensions, and product sheet counts depend on the specified staples, paper and tool. Here thickness is assigned as 0.1 mm per sheet and the longer specimen is a comparison. The offered settings deliberately include failed clinches and cannot be used as a safe product rating.'},
  ],
  misconception: 'The blade drives the legs through the stack; the anvil turns only the ends that emerge. The coil spring feeds the next staple, while the leaf return assembly raises the mechanism.',
  limits,
  sources: [
    {title: 'US3951325A: conventional stapler, leaf return and spring-fed follower', url: 'https://patents.google.com/patent/US3951325A/en'},
    {title: 'KYA: 26/6 staple section and crown dimensions', url: 'https://www.kyafasteners.com/26-6-Office-Staples-For-Office-Staplers-pd42896096.html'},
    {title: 'KYA: 24/6 staple section and crown dimensions', url: 'https://www.kyafasteners.com/24-6-Office-Staples-For-Office-Staplers-pd49909896.html'},
    {title: 'US6918525B2: background on separation, penetration and clinching resistance', url: 'https://patents.google.com/patent/US6918525B2/en'},
    {title: 'US6942136B2: problems caused by mismatched staple and stack lengths', url: 'https://patents.google.com/patent/US6942136B2/en'},
    {title: 'Rapid: an example of a product-specific staple and sheet rating', url: 'https://www.rapid.com/en-gb/products/stapling--punching/staples-and-accessories/rapid-standard-staples-26-6_24861800/'},
  ],
  quiz: {
    question: 'Why must the driver rise before the next staple moves into position?',
    options: ['The driver occupies the delivery channel; raising it clears the path for the spring-fed row.', 'The paper must cool down first.', 'The leaf spring pushes staples forward through the magazine.'],
    answer: 0,
    explanation: 'The leaf return assembly raises the driver. Once its lower edge clears the next crown, the coil spring can push the follower and row forward by one staple pitch.',
  },
};

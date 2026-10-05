import {UNICYCLE_DEFAULTS} from './unicycle-physics.js';

const trial = (part, title, observe, values = {}, time = 10) => {
  const settings = {...UNICYCLE_DEFAULTS, ...values};
  return {title, instruction: 'The settings and observation time are applied. Press Play to replay this run from its start.', observe, values: settings, initialState: {settings, time}, reset: true, part, isolate: true, view: 'front'};
};

export const unicycleLesson = {
  simple: 'How can pedaling keep one wheel under a leaning rider?',
  overview: 'A unicyclist balances forward and back by moving the wheel under their body. Pedal torque both accelerates the wheel and turns the rider in the opposite direction. Explore an assigned balance controller: change how late it reacts, how hard it can push and how high the rider sits. The moving ground marks show travel while the unicycle stays centered.',
  steps: [
    {title: 'Begin with a lean', body: 'In the default 24-inch example, the assigned rider’s center of mass is 1.16 m above the ground. A forward lean grows unless the rider corrects it.'},
    {title: 'Notice it after a delay', body: 'The controller responds to past lean, turning rate and speed. Before those readings arrive, it holds the relative crank acceleration at its previous command. Holding still can require pedal torque.'},
    {title: 'Move the wheel underneath', body: 'Pedaling forward rolls the wheel under a forward lean. The equal and opposite torque on the rider also helps turn the body back toward upright.'},
    {title: 'Read the outcome', body: 'Replay a full ten-second run or inspect a chosen moment. Read lean, speed and torque separately; each chart fits its entire curve. The simulation stops when lean reaches 45°, before a crash or dismount.'},
  ],
  parts: [
    {name: 'Wheel and axle', role: 'The tire, rim, spokes and axle rotate together. With the assigned direct or 1:1 chain drive, one crank revolution makes one wheel revolution relative to the frame.'},
    {name: 'Cranks and pedals', role: 'Transmit force and torque; a longer crank gives more torque for the same perpendicular force.'},
    {name: 'Frame and saddle', role: 'Support the rider. The giraffe variants raise the crank axle and connect it to the wheel with a chain.'},
    {name: 'Rider', role: 'An illustrative body and moving legs. Dynamics concentrate the assigned rider mass at the marked point.'},
    {name: 'Measurements', role: 'Ground marks, force arrows, center-of-mass guides and three charts explain motion; they are not machine components.'},
  ],
  tryIt: [
    trial('system', 'Hold the cranks still', 'Holds the cranks still: from a 3° lean, the model reaches its 45° stop at 1.36 s. The small-angle characteristic growth time is 0.40 s; growth from rest follows a hyperbolic cosine, not a pure exponential.', {rider: 1}),
    trial('lean', 'Pedal under the lean', 'Pedals to balance: readings arrive 190 ms late. Lean first grows to 3.72°, then shrinks. The wheel rolls 0.61 m and the rider ends nearly upright.'),
    trial('lean', 'React more slowly', 'At 300 ms, swings grow and the model reaches its stop 4.9 s in. For small disturbances without torque saturation, this controller’s local delay boundary is about 260 ms.', {delay: 300}),
    trial('system', 'A giraffe', 'The saddle is 3.05 m up and the assigned center of mass is 3.21 m high. Its small-angle growth time is 0.60 s and local delay boundary about 387 ms. At the selected 300 ms delay this run stays up, with a peak lean of 3.81°.', {delay: 300, seat: 3}),
    trial('torque', 'A hard shove', 'The assigned force limit gives 61.8 N·m on 79 mm cranks. The controller saturates and the 15° starting lean reaches the stop at 0.90 s. A locally stable delay cannot guarantee recovery from a large lean.', {lean: 15, crank: 79}),
    trial('torque', 'Longer cranks', 'At the same 15° starting lean, 125 mm cranks allow 97.7 N·m. This run needs at most 67.0 N·m; lean peaks at 18.68° and recovers.', {lean: 15}),
    trial('speed', 'Ride off', 'Starting upright, the controller first rolls the wheel back 5.2 cm to create a forward lean. The largest lean is 7.35°; speed settles near the requested 1.5 m/s.', {lean: 0, speed: 1.5}),
    trial('system', 'A bigger wheel', 'A 36-inch wheel travels 2.873 m per full ground-frame wheel turn; the 24-inch wheel travels 1.915 m. In these 10 s runs the wheel turns 4.26 times versus 6.58, with slightly different balance transients.', {lean: 0, speed: 1.5, wheel: 3}),
    trial('system', 'Before feedback arrives', 'At 0.180 s the rider leans 3.31°, but the delayed reading is still upright. The cranks have not yet received a corrective acceleration command; holding them relative to the body still takes torque.', {}, .18),
    trial('system', 'The first new lean reading', 'At 0.190 s the controller receives the initial 3° lean. The actual lean has already reached 3.34°. Its new command begins to turn the cranks relative to the frame.', {}, .19),
    trial('system', 'Roll back first', 'At 0.625 s the wheel is 5.2 cm behind its start and about to move forward. The body is already leaning forward, ready for the wheel to accelerate under it.', {lean: 0, speed: 1.5}, .625),
    trial('system', 'No feedback delay', 'At 0.190 s the zero-delay controller has reduced the initial 3° lean to 2.79°. Compare the first new reading trial, where delayed correction has only just begun.', {delay: 0}, .19),
    trial('system', 'Perfectly upright', 'With zero initial lean, zero requested speed and no disturbance, every position and force correction remains zero. An exact equilibrium can persist in an ideal model even when a nearby disturbed state would move.', {lean: 0}),
    trial('system', 'A smaller wheel', 'At the same 1.5 m/s requested speed, the 20-inch wheel makes about 7.97 ground-frame turns in this run. Smaller wheels need more revolutions per meter.', {lean: 0, speed: 1.5, wheel: 0}),
  ],
  deeper: [
    {title: 'An inverted pendulum on a wheel', body: 'With the relative crank angle held fixed and small lean, the model gives θ̈ = w²θ. Here w² = mgl / J, with l the point mass height above the axle and J = 2Mr² + m(r + l)². From rest, θ(t) = θ(0) cosh(wt). The unstable exponential mode has growth time 1/w: 0.40 s for the default unicycle and 0.60 s for the tallest assigned giraffe. This approximation does not describe a whole large-angle fall.'},
    {title: 'Equal and opposite torque', body: 'The wheel receives pedal torque; the rider receives its opposite. The same action changes forward travel and body lean. The model solves these coupled equations rather than prescribing an animation of a balanced rider.'},
    {title: 'A deliberately ideal leg motor', body: 'The controller requests crank acceleration relative to the frame. An ideal inner actuator supplies the torque required by the coupled dynamics, up to a symmetric cap. The cap is the assigned rider weight, 782 N, times crank length: 61.8 N·m for 79 mm or 97.7 N·m for 125 mm. Force is allowed perpendicular to the crank at every angle, including positions where a real downward-only pedal push would have a dead spot.'},
    {title: 'Delay limits have conditions', body: 'The chosen controller combines delayed lean, lean rate and speed error. Its gains scale with the unicycle dimensions. The displayed boundary comes from linearization around upright with no torque saturation, so it predicts local stability, not recovery from every shove. Human balance can also use prediction, several senses, body movements and learned strategies; the assigned 190 ms delay is not a measurement of a rider.'},
    {title: 'Why roll backward to start forward?', body: 'Accelerating the wheel forward tends to rotate the body back. This controller first moves the wheel back, creating a forward lean, then accelerates forward to catch it. A real rider can also lean by moving their body; that extra motion is not modeled.'},
    {title: 'Height and gearing', body: 'The tall variants use equal-sized chain sprockets, giving a 1:1 ratio relative to the frame. Raising the assigned point mass slows the growth of a small lean. Real tall unicycles add frame mass, flex and mounting difficulty that this comparison leaves out.'},
    {title: 'Sideways balance is a different problem', body: 'Forward/back lean rotates about an axis parallel to the wheel axle, so gyroscopic precession does not provide the restoring action shown here. Sideways balance involves steering and body motion and is outside this model. Wheel spin alone is not a universal explanation of cycle stability.'},
  ],
  misconception: 'A turning wheel does not automatically keep this rider upright. Active pedal torque moves the wheel and turns the body; feedback delay and limited torque can still let a lean grow.',
  limits: 'Assigned teaching parameters: rider mass 79.7 kg, nominal leg reach 825 mm, point mass 158 mm above the saddle, and a 2 kg hoop wheel. These are not measurements of a seated rider or population-average body model. The rigid point-mass body balances in one vertical plane with perfect rolling grip and a massless frame. Before the initial lean, delayed history is upright and still; the speed target is known immediately. An ideal acceleration actuator has a symmetric torque cap equal to weight times crank length. No pedal dead spots, muscle dynamics, lateral balance, steering, body bending, slip, tire deformation, rolling resistance, chain stretch or frame inertia. The run uses 0.5 ms steps and stops at the first sample crossing a lean of 45°; its crossing time is interpolated. It plays at half speed. Charts show the whole planned trace with a current-time cursor, including the stop sample. Numerical outcomes describe this controller, not riding instructions or product performance.',
  sources: [
    {title: 'Unicycle.com: learning to ride and moving the wheel under the rider', url: 'https://www.unicycle.com/learning-to-ride/'},
    {title: 'Unicycle.com: giraffe assembly and chain drive', url: 'https://www.unicycle.com/content/doc/INS-UDC-013-US.pdf'},
    {title: 'Gajbhiye, Banavar and Delgado: wheeled inverted-pendulum dynamics', url: 'https://arxiv.org/abs/1612.01814'},
    {title: 'Insperger, Milton and Stépán: delayed balance control and its assumptions', url: 'https://doi.org/10.1098/rsif.2012.0763'},
    {title: 'Kooijman and colleagues: cycle stability is not explained by gyroscopic effects alone', url: 'https://arendschwab.com/research/stablebicycle/'},
  ],
  quiz: {
    question: 'Why does this controller briefly roll the wheel backward when starting forward?',
    options: ['To create a forward lean before accelerating the wheel under the rider.', 'The cranks slip before they grip.', 'Wheel spin automatically pulls the rider upright.'],
    answer: 0,
    explanation: 'The backward movement shifts the support behind the body. In the ride off trial the wheel rolled back 5.2 cm, then accelerated forward under the lean. This is the behavior of the assigned controller.',
  },
};

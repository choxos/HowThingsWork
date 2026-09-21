import {UNICYCLE_DEFAULTS} from './unicycle-physics.js';

const trial = (part, view = 'front') => (title, instruction, observe, values = {}) => ({title, instruction, observe, values: {...UNICYCLE_DEFAULTS, ...values}, reset: true, part, isolate: false, view});
const systemTrial = trial('system'), leanTrial = trial('lean'), speedTrial = trial('speed'), torqueTrial = trial('torque');

export const sources = {
  unicycle: {title: 'Wikipedia: Unicycle', url: 'https://en.wikipedia.org/wiki/Unicycle'},
  crankset: {title: 'Wikipedia: Crankset', url: 'https://en.wikipedia.org/wiki/Crankset'},
  pendulum: {title: 'Wikipedia: Inverted pendulum', url: 'https://en.wikipedia.org/wiki/Inverted_pendulum'},
  com: {title: 'Wikipedia: Center of mass', url: 'https://en.wikipedia.org/wiki/Center_of_mass'},
  chronometry: {title: 'Wikipedia: Mental chronometry', url: 'https://en.wikipedia.org/wiki/Mental_chronometry'},
  ansur: {title: 'OPEN Design Lab, Penn State: ANSUR II, the 2012 anthropometric survey of US Army personnel', url: 'https://www.openlab.psu.edu/datasets/ansur-ii/'},
  ansurMen: {title: 'ANSUR II public data: men', url: 'https://tools.openlab.psu.edu/publicData/ANSUR_II_MALE_Public.csv'},
  ansurWomen: {title: 'ANSUR II public data: women', url: 'https://tools.openlab.psu.edu/publicData/ANSUR_II_FEMALE_Public.csv'},
  selfBalancing: {title: 'Wikipedia: Electric unicycle', url: 'https://en.wikipedia.org/wiki/Electric_unicycle'},
};

const limits = 'A practiced rider whose reflexes match the unicycle, balancing only forward and back: 79.7 kg, with a crotch height of 825 mm and a trochanterion height of 883 mm, the mean of the 6,068 US Army personnel measured in ANSUR II, seated upright with legs straight to a pedal at the bottom and the center of mass 10 cm above the trochanter; a 2 kg wheel carried at its rim, rolling without slipping; legs that push with at most the rider’s weight, at right angles to the crank at every crank angle; reflexes to the lean, its rate and the speed, each sensed one reaction delay late, from a rider upright and still before the run, with the delay standing for the whole loop from lean to leg force. Not modeled: balance from side to side and steering, dead spots where a crank points straight up or down, the frame’s own mass, the body bending, rolling resistance and slipping. The run stops at a lean of 45° and plays at half speed.';

export const unicycleLesson = {
  simple: 'How does anyone stay up on one wheel?',
  overview: 'A unicycle has one wheel and nothing to steer with, so on its own it falls over. The rider keeps it up by pedaling: whenever it leans forward they roll the wheel forward under the lean, and whenever it leans back they roll the wheel back. Every correction comes a reaction delay late, and the legs can push only so hard. Change the delay, the saddle, the cranks and the speed to see what makes balancing possible.',
  steps: [
    {title: 'Sit on a pendulum', body: 'The rider’s center of mass is 1.16 m above the ground, balanced over the small patch where the tire touches it. Tipped even slightly, it falls further.'},
    {title: 'Notice the lean', body: 'The rider senses the lean, but only after a reaction delay.'},
    {title: 'Pedal under it', body: 'The legs turn the cranks and with them the wheel, rolling the tire forward under a forward lean or back under a backward one.'},
    {title: 'Lean to change speed', body: 'To speed up, the rider leans forward first; to slow down, back.'},
  ],
  parts: [
    {name: 'Wheel', role: 'Rolls under the rider; its size sets how far each turn of the cranks goes.'},
    {name: 'Cranks and pedals', role: 'Carry the legs’ push to the wheel; their length sets the torque a push gives.'},
    {name: 'Frame and saddle', role: 'Hold the rider over the axle; on a giraffe a chain drives the wheel.'},
    {name: 'Rider', role: 'The weight to be balanced, and the one balancing it.'},
    {name: 'Center of mass', role: 'The top of the pendulum.'},
    {name: 'Charts', role: 'Lean, speed and pedal torque over time.'},
  ],
  tryIt: [
    systemTrial('Hold the cranks still', 'Choose Holds the cranks still and press Play.', 'From a 3° lean the unicycle and rider tip over together as one body on the tire: the lean grows e times every 0.40 s and passes 45° 1.36 s in.', {rider: 1}),
    leanTrial('Pedal under the lean', 'Keep Pedals to balance and press Play.', 'The legs answer 190 ms late, so the lean first grows to 3.72°. Then the wheel rolls forward under it, 0.61 m in all, and the rider ends upright.'),
    leanTrial('React more slowly', 'Set the reaction delay to 300 ms and press Play.', 'These reflexes keep this unicycle up only for delays under 260 ms. At 300 ms each push comes too late, the swings grow, and the rider falls 4.9 s in.', {delay: 300}),
    systemTrial('A giraffe', 'Keep the delay at 300 ms and choose the tallest giraffe saddle.', 'With the saddle 3.05 m up and the center of mass at 3.21 m, the lean grows e times only every 0.60 s. These reflexes now work for delays under 387 ms, and the rider stays up, leaning at most 3.81°.', {delay: 300, seat: 3}),
    torqueTrial('A hard shove', 'Set the starting lean to 15° and the cranks to 79 mm.', 'Catching that lean needs more torque than the rider’s whole weight gives on a 79 mm crank, 61.8 N·m. The legs are held at that limit and the rider falls 0.90 s in.', {lean: 15, crank: 79}),
    torqueTrial('Longer cranks', 'Keep the 15° lean and set the cranks back to 125 mm.', 'The same push now gives up to 97.7 N·m. The hardest moment takes 67.0 N·m, the lean peaks at 18.68° and the rider recovers.', {lean: 15}),
    speedTrial('Ride off', 'Set the starting lean to 0° and the speed wanted to 1.5 m/s.', 'To lean the rider forward, the wheel first rolls back 5.2 cm. Then it carries them off, leaning at most 7.35°, up to 1.5 m/s.', {lean: 0, speed: 1.5}),
    systemTrial('A bigger wheel', 'Keep 1.5 m/s with no starting lean and choose the biggest wheel.', 'A 36-inch wheel rolls 2.873 m for each turn of the cranks, against 1.915 m for the 24-inch wheel, so in the 10 s run the wheel and cranks turn 4.26 times instead of 6.58.', {lean: 0, speed: 1.5, wheel: 3}),
  ],
  deeper: [
    {title: 'An upside-down pendulum', body: 'A unicycle and its rider make an inverted pendulum, pivoting on the tire with the center of mass on top. Tipped a little, gravity tips it further, and tall pendulums fall more slowly than short ones. Holding the cranks still, the lean here grows e times every 0.40 s on a standard unicycle and every 0.60 s on a giraffe with its saddle 3.05 m up.'},
    {title: 'Pedaling under the lean', body: 'The rider has nothing to push against but the pedals. Turning the cranks forward rolls the wheel forward under a forward lean, and the same torque pushes back on the rider’s body, turning it back toward upright. Both catch the lean at once.'},
    {title: 'The legs as a motor', body: 'On a standard unicycle one turn of the cranks is one turn of the wheel. The torque is the push times the crank length, so a push of the rider’s whole weight, 782 N, gives 61.8 N·m on a 79 mm crank and 97.7 N·m on a 125 mm one. Indoor riders commonly use 100 mm cranks, some as short as 79 mm, while mountain riders use cranks longer than 125 mm.'},
    {title: 'Always late', body: 'A rider notices a lean and pushes back only after a delay; a simple reaction to something seen takes about 190 ms. A push that answers an old lean can arrive after the lean has already reversed, and then it feeds the swing. With these reflexes the standard unicycle stays up for delays under 260 ms, and no reflexes to the lean and its rate alone could keep it up with a delay of 568 ms or more.'},
    {title: 'Roll back to go forward', body: 'To speed up forward the rider must lean forward first, or the push that speeds the wheel up would tip them back. The quickest way to lean forward is to roll the wheel back from under the body. A cart balancing a pole does the same: a sudden command to move one way first moves the cart the other way.'},
    {title: 'Side to side', body: 'This model balances only forward and back. Side to side, a rider steers the wheel back under the lean by twisting and tilting it. Self-balancing electric unicycles do the forward and back balancing with a motor, sensing the lean with accelerometers and gyroscopes, and still leave side to side to the rider.'},
  ],
  misconception: 'The spinning wheel does not hold a unicycle up forward and back. A forward lean turns the rider about a line parallel to the axle, which the wheel’s spin does nothing to resist; only pedaling the wheel back under the center of mass catches it.',
  limits,
  sources: [sources.unicycle, sources.crankset, sources.pendulum, sources.com, sources.chronometry, sources.ansur, sources.ansurMen, sources.ansurWomen, sources.selfBalancing],
  quiz: {
    question: 'Why does a unicycle roll backward for a moment as its rider sets off forward?',
    options: ['To lean the rider forward, so the wheel can then speed up under them without tipping them back.', 'The cranks slip before they grip.', 'The tire squashes under the push.'],
    answer: 0,
    explanation: 'Speeding the wheel up forward pushes the rider’s body back, so the rider must lean forward first. In the ride off trial the wheel rolled back 5.2 cm before carrying the rider off.',
  },
};

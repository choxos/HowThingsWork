import {VR_DEFAULTS} from './vr-headset-physics.js';

const trial = (part, view = 'front') => (title, instruction, observe, values = {}) => ({title, instruction, observe, values: {...VR_DEFAULTS, ...values}, reset: true, part, isolate: false, view});
const viewTrial = trial('view'), timelineTrial = trial('timeline'), errorsTrial = trial('errors'), focusTrial = trial('focus'), opticsTrial = trial('optics'), imuTrial = trial('imu', 'top');

export const sources = {
  lavalle: {title: 'Steven M. LaValle: Virtual Reality, chapters 4 to 9', url: 'http://lavalle.pl/vr/'},
  headset: {title: 'Wikipedia: Virtual reality headset', url: 'https://en.wikipedia.org/wiki/Virtual_reality_headset'},
  cardboard: {title: 'Wikipedia: Google Cardboard', url: 'https://en.wikipedia.org/wiki/Google_Cardboard'},
  vac: {title: 'Wikipedia: Vergence-accommodation conflict', url: 'https://en.wikipedia.org/wiki/Vergence-accommodation_conflict'},
  ipd: {title: 'Wikipedia: Pupillary distance', url: 'https://en.wikipedia.org/wiki/Pupillary_distance'},
  imu: {title: 'Wikipedia: Inertial measurement unit', url: 'https://en.wikipedia.org/wiki/Inertial_measurement_unit'},
  gyro: {title: 'Wikipedia: Vibrating structure gyroscope', url: 'https://en.wikipedia.org/wiki/Vibrating_structure_gyroscope'},
  mpu: {title: 'InvenSense: MPU-6000 and MPU-6050 product specification, revision 3.1', url: 'https://cdn.sparkfun.com/datasheets/Components/General%20IC/PS-MPU-6000A.pdf'},
};

const limits = 'Illustrative headset: the head turns about one vertical axis only, 60° to the left in 1 s or in half-second swings of 25° each way, each a minimum-jerk blend; a gyroscope read 1,000 times a second as the mean rate over each millisecond, with the offset and scale you set and no noise or rounding; a camera fixed in the room that measures the true yaw 60 times a second, exactly and at once; LaValle’s complementary filter; frames started 90 times a second and lit for 2 ms; thin lenses of 45 mm focal length 15 mm in front of the eyes, with the screen 41 to 45 mm behind them; eyes 63 mm apart; and a comfort limit of 0.4 D. Not modeled: pitch, roll and position, the accelerometer and magnetometer, scan-out, lens distortion and color fringes, the eyes’ own movements, and how people adapt. The camera stands much closer than a real one would, and the run plays five times slower than real time.';

export const vrHeadsetLesson = {
  simple: 'How do two small screens a few centimeters from your eyes become a room that stays put when you turn your head?',
  overview: 'A virtual reality headset puts a lens in front of each eye and a screen just inside the lenses’ focal length, so the screen looks large and far away. It draws a slightly different view for each eye, and redraws both as your head moves. To follow your head it adds up a gyroscope’s readings a thousand times a second, and lets a camera correct the drift. Every frame takes time to draw, so the headset draws each one for where your head will be when it lights. Move your head, spoil the gyroscope, take away prediction and move the screen to see each job.',
  steps: [
    {title: 'Measure the turning', body: 'A gyroscope chip reports how fast the headset is turning, 1,000 times a second. Adding up its readings gives which way the head points.'},
    {title: 'Correct the drift', body: 'Small errors in the readings add up too. A camera in the room sees which way the headset points 60 times a second, and every reading nudges the estimate toward its latest image.'},
    {title: 'Start a frame', body: 'The headset starts a frame 90 times a second, drawn for the latest estimate carried forward to the moment the frame will light.'},
    {title: 'Light the screen', body: 'Once the latency has passed, the frame lights for just 2 ms, so that a turning eye does not smear it.'},
    {title: 'Look through the lenses', body: 'Each lens makes its half of the screen look far away. The two halves show the scene from each eye’s own position, so the eyes aim at a near object while still focusing on the far image of the screen.'},
  ],
  parts: [
    {name: 'Lenses', role: 'Magnify the screen and put its image far away.'},
    {name: 'Display panel', role: 'A view for each eye.'},
    {name: 'Inertial measurement unit', role: 'Its gyroscope reports how fast the head turns.'},
    {name: 'Tracking camera', role: 'Sees which way the headset truly points.'},
    {name: 'Headset shell and strap', role: 'Hold it all in front of the eyes.'},
    {name: 'Charts', role: 'Yaw over time, how far off, frames close up, what the left eye sees, the lens, and aim and focus.'},
  ],
  tryIt: [
    viewTrial('Turn your head', 'Press Play and watch what the left eye sees.', 'Turning 60° to the left at up to 112.5°/s, the landmarks the display draws never stray more than 0.08° from where the room’s landmarks truly are: each frame is drawn for where the head will be when it lights, 20 ms after it starts.'),
    viewTrial('No prediction', 'Choose no prediction, press Play and watch the two rows.', 'Drawn for where the head pointed when each frame started, the picture falls up to 2.37° behind the head, 1.01 s into the run as the turn is fastest: the room seems to swing along with you.', {prediction: 0}),
    errorsTrial('A 1990s headset', 'Choose no prediction and set the latency to 60 ms.', 'Without prediction, 60 ms of latency leaves the picture up to 6.84° behind a head turning at 112.5°/s, nearly three times the 2.37° at 20 ms.', {prediction: 0, latency: 60}),
    errorsTrial('Predict further ahead', 'Set the latency to 60 ms.', 'Predicting 60 ms ahead at the gyroscope’s latest rate misses whenever the head speeds up or slows down on the way: the picture is off by up to 0.65°, eight times the 0.08° at 20 ms.', {latency: 60}),
    timelineTrial('A fast gyroscope', 'Set the gyroscope scale error to 3% and choose no correction.', 'Reading every turn 3% too fast, the estimate turns 61.80° while the head turns 60°, and with nothing to correct it the room stays turned 1.80° after the head stops.', {scale: 3, correction: 0}),
    errorsTrial('The camera corrects it', 'Set the gyroscope scale error to 3% and choose the firmer camera correction.', 'Blended in at α = 0.01, the camera’s images pull the estimate back within about a tenth of a second, and the run ends 0.00° off. But an image can be 16.3 ms old, so while the head turns the pull drags the estimate up to 0.57° behind.', {scale: 3, correction: 2}),
    focusTrial('A near object', 'Set the virtual object to 0.3 m.', 'To aim at an object 0.3 m away the eyes turn in 11.99° between them, a demand of 3.33 D, while the lenses keep their focus on the screen’s image at 0.50 D: a conflict of 2.83 D, far beyond the 0.4 D most people find comfortable.', {distance: 0.3}),
    opticsTrial('Screen at the focal length', 'Set the screen to 45 mm from the lens.', 'With the screen exactly at the lens’s 45 mm focal length, the rays from each screen point leave the lens parallel and the image is infinitely far away. Just 1.0 mm closer, at 44 mm, the image is 2.00 m from the eye.', {screen: 45}),
  ],
  deeper: [
    {title: 'Why lenses', body: 'An eye cannot focus on a screen a few centimeters away. LaValle explains that a lens with the screen at its focal length sends each point’s light out parallel, as if from infinitely far away, and with the screen a little closer it makes a virtual image at a finite distance, from 1/s1 + 1/s2 = 1/f. Optical power is measured in diopters, one over the focal length in meters: this 45 mm lens is 22.2 D.'},
    {title: 'Two views', body: 'Each eye’s view is drawn from that eye’s own position, 63 mm apart here. An object 2.0 m away is 0.90° to the right of straight ahead for the left eye and 0.90° to the left for the right eye, and the brain reads the difference as depth.'},
    {title: 'Low persistence', body: 'If each frame stayed lit until the next, a world-fixed object would sit still on the screen for a whole frame while the eye, turning to keep it in view, swept on across it. LaValle describes lighting the display for only one or two milliseconds each frame, at 90 frames a second or more so that the flicker cannot be seen.'},
    {title: 'How much latency', body: 'In early systems, LaValle writes, the time from motion to photons was often over 100 ms, and 60 ms was considered acceptable in the 1990s. Modern headsets reach around 15 to 25 ms and predict the rest away, and a Valve engineer has put the ideal latency at 7 to 15 ms.'},
    {title: 'Aim and focus', body: 'Headset optics often place the screen’s image somewhere between two meters and infinity. The eyes focus there even when the scene puts an object close, so aim and focus disagree; most people tolerate up to about 0.4 D of this conflict.'},
  ],
  misconception: 'The eyes do not focus on a screen a few centimeters away. The lenses put its image meters away, or infinitely far, and that is where the eyes focus, even when a virtual object looks close.',
  limits,
  sources: [sources.lavalle, sources.headset, sources.cardboard, sources.vac, sources.ipd, sources.mpu],
  quiz: {
    question: 'Why does a headset draw each frame for where your head will be, rather than where it is?',
    options: ['A frame lights tens of milliseconds after it starts, and the head keeps turning meanwhile.', 'The gyroscope measures the future.', 'The lenses slow the light down.'],
    answer: 0,
    explanation: 'Without prediction, 20 ms of latency left the picture up to 2.37° behind a head turning at 112.5°/s. Drawing each frame for where the head would be cut that to 0.08°.',
  },
};

export const headTrackingLesson = {
  simple: 'How does a headset know which way your head is pointing, when its sensor only feels how fast it turns?',
  overview: 'A gyroscope does not know which way it points. It reports how fast it is turning, and the headset adds up its readings a thousand times a second to follow the head. Every error in a reading is added up too, so the estimate drifts: an offset drifts steadily with time, a scale error with how far you turn. A camera in the room measures the head’s direction on its own, and a filter blends that in, gently enough that the corrections go unnoticed.',
  steps: [
    {title: 'Feel the turning', body: 'Inside the chip, tiny vibrating structures feel Coriolis forces while it turns, and it reports the rate of turning 1,000 times a second.'},
    {title: 'Add it up', body: 'Each reading times one millisecond is how far the head turned in that millisecond. Adding them up gives the head’s yaw.'},
    {title: 'Watch the drift', body: 'An offset adds the same small turn every millisecond. A scale error adds a share of every real turn.'},
    {title: 'Correct with the camera', body: 'At every reading, a complementary filter moves the estimate a small fraction α of the way toward the camera’s latest image.'},
  ],
  parts: [
    {name: 'Inertial measurement unit', role: 'The gyroscope and accelerometer chip.'},
    {name: 'Tracking camera', role: 'Measures which way the headset points.'},
    {name: 'Yaw over time', role: 'The head, the estimate and the frames.'},
    {name: 'How far off', role: 'The drift and the slip, magnified.'},
    {name: 'Frames close up', role: 'Readings, images and frames in the last 120 ms.'},
  ],
  tryIt: [
    imuTrial('Add up the readings', 'Choose no correction, press Play and watch the gyroscope.', 'Its readings rise to 112.50°/s halfway through the turn and fall back to nothing. Added up, the run’s 3,000 readings give 60.00°, exactly the head’s turn, because this gyroscope is perfect.', {correction: 0}),
    errorsTrial('An offset', 'Choose to hold still, set the gyroscope offset to 0.5°/s and choose no correction.', 'Reading 0.5°/s while nothing moves, the estimate turns 1.50° in 3 s: the room slowly rotates around a wearer who is perfectly still.', {motion: 2, offset: 0.5, correction: 0}),
    timelineTrial('A scale error', 'Set the gyroscope scale error to 3% and choose no correction.', 'Before the turn the estimate does not drift at all. After the 60° turn it is 1.80° too far, 3% of the turn, and stays there: this error grows with how far the head turns, not with time.', {scale: 3, correction: 0}),
    errorsTrial('Shake it off', 'Shake your head with a 3% scale error and no correction.', 'Each 25° swing out adds 0.75° of error and each swing back takes it away again: facing forward after the last swing, the estimate is 0.00° off.', {motion: 1, scale: 3, correction: 0}),
    errorsTrial('A gentle pull', 'Hold still with a 0.5°/s offset and choose the gentler camera correction.', 'At α = 0.0001 the pull acts over about 10 s, so after 3 s the estimate has still drifted 1.30° instead of 1.50°. Left longer, it would settle 5.00° off: a gentle correction needs a well-calibrated gyroscope.', {motion: 2, offset: 0.5, correction: 1}),
    errorsTrial('A firm pull', 'Keep the 0.5°/s offset, turn your head, and choose the firmer camera correction.', 'At α = 0.01 the offset’s drift is held to 0.05° by the end of the run. But during the turn an image can be 16.3 ms old, and the pull drags the estimate 0.83° behind the head: the kind of correction LaValle warns the wearer may notice.', {offset: 0.5, correction: 2}),
  ],
  deeper: [
    {title: 'Why it drifts', body: 'LaValle models a gyroscope’s reading as ω̂ = a + bω. Added up over time, the offset a builds an error that grows steadily, and the scale b one that grows with every turn, so tracking error grows faster when the head turns more quickly. Even a perfectly calibrated gyroscope drifts, he notes, because of rounding, sampling and noise.'},
    {title: 'Calibration', body: 'Before calibration, the MPU-6050’s datasheet allows its gyroscope to read up to 20°/s while perfectly still and to be up to 3% off in scale. Headsets calibrate against a better reference, and LaValle warns that a headset warming up during use can spoil its calibration.'},
    {title: 'The filter', body: 'LaValle’s complementary filter moves the estimate a fraction α of the way toward the other sensor, with α close to zero: 0.0001 in his example. With a camera taking 60 images a second and the gyroscope 1,000 readings, the same image serves for 16 or 17 readings in a row.'},
    {title: 'Tilt and yaw', body: 'An accelerometer feels gravity, so it can say which way is up and correct the head’s tilt, but only while the head is not accelerating much. It cannot tell which way the head faces. That takes a magnetometer, which nearby iron and circuit boards disturb, or a camera.'},
    {title: 'Why not position too', body: 'Adding up an accelerometer’s readings twice to find position makes a calibration error grow with the square of time instead of in step with it. LaValle notes that this becomes unbearable within a fraction of a second, which is why headsets track position with cameras.'},
  ],
  misconception: 'A gyroscope does not tell the headset which way it faces. It only reports how fast it turns, and the direction comes from adding up its readings, errors and all.',
  limits,
  sources: [sources.lavalle, sources.imu, sources.gyro, sources.mpu],
  quiz: {
    question: 'A gyroscope reads every turn 3% too fast. When is the estimate furthest off?',
    options: ['When the head has turned furthest from where it started.', 'After the longest time, whatever the head does.', 'Never: a scale error cancels itself out.'],
    answer: 0,
    explanation: 'A scale error adds a share of every turn, so it follows the angle turned: 1.80° after a 60° turn, and 0.00° once a shaking head faces forward again.',
  },
};

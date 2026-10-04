import {VR_DEFAULTS, vrPlan} from './vr-headset-physics.js';

const trial = (part, view = 'front') => (title, instruction, observe, values = {}) => ({title, instruction, observe, values: {...VR_DEFAULTS, ...values}, reset: true, part, isolate: false, view});
const viewTrial = trial('view'), timelineTrial = trial('timeline'), errorsTrial = trial('errors'), focusTrial = trial('focus'), opticsTrial = trial('optics'), imuTrial = trial('imu', 'top');

export const sources = {
  lavalle: {title: 'LaValle: virtual reality systems and their assumptions', url: 'https://lavalle.pl/vr/'},
  optics: {title: 'LaValle: thin lenses and virtual images', url: 'https://lavalle.pl/vr/vrch4.pdf'},
  rendering: {title: 'LaValle: rendering delay and viewpoint prediction', url: 'https://lavalle.pl/vr/vrch7.pdf'},
  tracking: {title: 'LaValle: gyroscopes and complementary tracking', url: 'https://lavalle.pl/vr/vrch9.pdf'},
  audio: {title: 'LaValle: binaural timing and level cues', url: 'https://lavalle.pl/vr/node365.html'},
  trackedAudio: {title: 'LaValle: tracking the virtual ears', url: 'https://lavalle.pl/vr/node383.html'},
  hrtf: {title: 'LaValle: head-related transfer functions', url: 'https://lavalle.pl/vr/node382.html'},
  evaluation: {title: 'LaValle: evaluating perception and comfort', url: 'https://lavalle.pl/vr/node385.html'},
  mpu: {title: 'TDK InvenSense: MPU-6000/6050 specification, revision 3.4', url: 'https://product.tdk.com/system/files/dam/doc/product/sensor/mortion-inertial/imu/data_sheet/mpu-6000-datasheet1.pdf'},
};

const limits = 'Illustrative tethered headset with one display split into two eye views, supported optics and electronics, two earphones and an external rendering computer. The wearer is a geometric reference, not an anatomical fit model. Dimensions and functional connections are assigned; detailed circuits, protocols, rendering workload and power conversion are omitted. Tracking covers yaw only: a 60-degree turn, repeated swings or a stationary head. The gyroscope reports the mean rate over each 1 ms interval with assigned offset and scale errors. A perfect, zero-delay camera reports yaw at 60 Hz; its most recent sample is reused in a complementary filter. Pitch, roll, translation, sensor noise and quantization are omitted. Frames start at 90 Hz and flash for 2 ms after the chosen delay. Error plots clip at ±12°; numerical summaries retain the full error. Error summaries measure flash onset; the panel and comparison diagram hold the last flash for inspection. Thin-lens optics use a 45 mm focal length, 15 mm eye relief, 63 mm eye spacing and screen distances from 41 to 45 mm. Lens distortion, chromatic aberration, accommodation dynamics, eye movement, flicker perception and comfort are not simulated. The focus comparison uses the initial straight-ahead object geometry. Sound cues use direct paths from a fixed source 2 m from the head center to point ears 160 mm apart at 343 m/s. Head shadow, pinnae, level differences, room reflections, HRTFs and audio transport delay are omitted; no sound is played. Ear cues follow the current tracker estimate rather than the delayed visual frame. The external camera is drawn nearby to keep the system legible. Playback is five times slower than the three-second observation.';

const experiment = (title, instruction, observe, time, part = 'system', overrides = {}) => {
  const values = {...VR_DEFAULTS, ...overrides};
  return {title, instruction, observe, values, initialState: {settings: values, time: typeof time === 'function' ? time(vrPlan(values)) : time}, reset: true, part, isolate: true, view: 'front'};
};

export const vrHeadsetLesson = {
  simple: 'How can pictures and sound stay in a virtual room while the headset turns with your head?',
  overview: 'A headset sends head-motion measurements to a computer and receives new eye views and ear signals. Lenses make a nearby display appear farther away. Two viewpoints create stereo depth, while tracking changes the images and sound cues as the wearer turns. Inspect the connected hardware, compare the real and rendered directions, then change the timing and optical setup.',
  steps: [
    {title: 'Measure and estimate', body: 'The gyroscope measures turning rate. Adding its samples estimates yaw. The assigned camera periodically supplies an independent direction, and the filter gradually corrects drift.'},
    {title: 'Prepare two eye views', body: 'The computer uses the estimated head pose and separate eye positions to draw two views of the virtual scene. This illustrative panel holds the views side by side.'},
    {title: 'Predict across the delay', body: 'A new frame takes time to reach the display. Predicting the viewing direction at flash onset reduces the mismatch, but acceleration and tracking errors can still spoil the prediction.'},
    {title: 'Send light through the lenses', body: 'Each lens bends rays from its display area toward the corresponding eye. The screen appears farther away, while the difference between the two pictures supplies a stereo depth cue.'},
    {title: 'Update both ear signals', body: 'A source fixed in the virtual world changes direction relative to the ears as the head turns. The computer updates separate audio channels; earphones reproduce them. The sound diagram shows one simplified timing cue.'},
  ],
  parts: [
    {name: 'Case and fit', role: 'Hold the supported hardware in its wearing pose.'},
    {name: 'Optics and display', role: 'Deliver a separate magnified view to each eye.'},
    {name: 'Tracking sensor', role: 'Report head-turn rate to the computer.'},
    {name: 'Interface and earphones', role: 'Exchange tracking data and return image and sound signals.'},
    {name: 'External computer and camera', role: 'Render the virtual scene and supply an independent pose reference.'},
    {name: 'Timing, optics and sound diagrams', role: 'Make the model’s otherwise invisible calculations inspectable.'},
  ],
  tryIt: [
    experiment('Turn your head', 'Press Play and follow the wearer.', 'The head turns left, carrying the display, lenses and earphones. The computer updates the two eye views and sound cues to keep the virtual world in place.', 0),
    experiment('Inside the headset', 'Inspect the cutaway, then turn Look inside off and on.', 'The lens bridge reaches the case walls. The display, sensor board and interface board have supports. Earphone and host signal bundles connect the functional parts.', 0, 'device'),
    experiment('Two views on one panel', 'Inspect the display from the eye side.', 'Distant landmarks line up alike in both halves, but the nearby gold object occupies different horizontal positions because the eyes have different viewpoints.', .1, 'display'),
    experiment('Trace the lens rays', 'Follow light from the screen point through the lens into the pupil.', 'The outgoing rays diverge as though they came from an enlarged virtual image. The faint backward extensions indicate that image direction.', 0, 'optics'),
    experiment('Screen at the focal length', 'Inspect the ray diagram with the screen at 45 mm.', 'Rays from the same screen point leave parallel, placing its ideal image at infinity. The focus demand is zero diopters.', 0, 'optics', {screen: 45}),
    experiment('A near virtual object', 'Compare aim and focus for an object 0.3 m away.', 'The initial eye geometry requires 3.33 D of vergence demand while the screen image requires about 0.50 D of focus, a difference of 2.83 D. This measures optical mismatch, not comfort.', 0, 'focus', {distance: .3}),
    experiment('Nearly matching aim and focus', 'Compare the default object distance and screen position.', 'An object at 2.0 m has almost the same focus demand as this screen image at about 2.00 m. Changing virtual depth changes vergence demand without moving the physical display.', 0, 'focus'),
    experiment('Tracking during the turn', 'Compare room directions with the held display frame.', 'The upper row uses the current head direction. The lower row holds the most recently flashed picture. They can differ between flashes even when prediction is accurate at flash onset.', 1.026, 'view'),
    experiment('No prediction', 'Inspect the worst flash onset without prediction.', 'The greatest flash-onset error is 2.37° in this assigned turn. The frame used an older pose, so its picture lags the head.', p => p.worstSlip.flash, 'view', {prediction: 0}),
    experiment('More delay without prediction', 'Read the errors with a 60 ms delay.', 'The largest flash-onset error rises to 6.84°. This compares two assigned delays; it is not a specification for a generation of headsets.', p => p.worstSlip.flash, 'errors', {prediction: 0, latency: 60}),
    experiment('Predict further ahead', 'Keep the 60 ms delay and restore prediction.', 'The largest flash-onset error falls to 0.65°. Constant-rate prediction cannot fully anticipate the turn’s acceleration and deceleration.', p => p.worstSlip.flash, 'errors', {latency: 60}),
    experiment('A fast gyroscope', 'Inspect the completed turn with scale error and no correction.', 'A 3% scale error turns the estimate through 61.80° while the head turns 60°. The remaining drift is 1.80°.', 3, 'timeline', {scale: 3, correction: 0}),
    experiment('The camera corrects it', 'Compare the same scale error with firmer correction.', 'The final drift rounds to 0.00°, but the held camera measurements pull the estimate as much as 0.57° behind during the turn. Correcting one error can introduce another.', 3, 'errors', {scale: 3, correction: 2}),
    experiment('An offset while still', 'Inspect a stationary head with offset and no correction.', 'A 0.5°/s reading accumulates 1.50° of drift in 3 s even though the head never moves.', 3, 'errors', {motion: 2, offset: .5, correction: 0}),
    experiment('Read a display flash', 'Inspect the sensor, camera, frame-start and illumination rows.', 'Many gyro readings occur between camera samples. Frame work spans the assigned delay, and each bottom bar marks a brief display flash. The preview holds images between flashes for inspection.', p => p.frames[90].flash + .001, 'frames'),
    experiment('A sound on the left', 'Compare the two direct-path ear cues before turning.', 'For this fixed source, the left signal leads the right by about 0.404 ms. Different ear arrival times are one cue to sound direction; the diagram does not synthesize a complete spatial sound.', 0, 'sound', {correction: 0}),
    experiment('Turn toward the sound', 'Compare the cues after turning toward the same source.', 'The source is now straight ahead in the estimated head frame. Both direct paths have equal length, so both ear signals arrive together.', 1.5, 'sound', {correction: 0}),
    experiment('Freeze the ear cues', 'Repeat that turn while keeping the initial ear signals.', 'The left signal still leads by 0.404 ms. The cue remains attached to the headset instead of following the source fixed in the virtual world.', 1.5, 'sound', {correction: 0, soundTracking: 0}),
    experiment('Errors beyond the chart', 'Inspect a fast shake with a 100 ms delay and no prediction.', 'The largest flash-onset error is 18.32°. The red plot clips at 12° in either direction; its flat edge is a display limit, not a constant physical error. The numerical summary retains the full value.', p => p.worstSlip.flash, 'errors', {motion: 1, latency: 100, prediction: 0}),
    experiment('Read the final result', 'Inspect the completed observation, then press Play to repeat it.', 'The result reports the largest flash-onset error and final tracker drift. Replay keeps the timing, optics and sound settings you selected.', 3),
  ],
  deeper: [
    {title: 'Direction comes from accumulated rate', body: 'A gyroscope measures angular velocity, not absolute direction. Offset accumulates with time; scale error accumulates with net rotation. An independent reference can limit drift, but its noise, delay and correction strength matter.'},
    {title: 'Prediction is a model of the next moment', body: 'This experiment carries the latest measured rate forward to flash onset. It predicts constant-rate motion well. Acceleration, stale measurements and calibration errors explain its remaining error. Real systems may also reproject a rendered image shortly before display.'},
    {title: 'Flash onset is one specific metric', body: 'The reported maximum compares rendered and true yaw at the start of each flash. It does not bound every instant of the illumination interval or the age of the held preview. Short illumination can reduce smear during eye movement; flicker and perception are outside this model.'},
    {title: 'Near screen, distant image', body: 'The thin-lens relation is 1/f = 1/s + 1/s′. A screen inside the focal length has a negative image distance, corresponding to a virtual image on the screen side. At the focal length its rays leave parallel. Eye relief is included when calculating focus demand.'},
    {title: 'Stereo depth and optical focus differ', body: 'The separate eye images can depict different depths while the screen’s optical image remains at one distance. The focus diagram measures this mismatch for the initial straight-ahead geometry. A numerical difference alone does not establish whether a person will be comfortable.'},
    {title: 'Two delays are not a full sound scene', body: 'The audio diagram divides straight-line source-to-ear distances by the assigned sound speed. Real spatial audio also needs frequency-dependent head and pinna filtering, level differences, reflections and suitable tracking. Those are not represented by this two-point-ear model.'},
  ],
  misconception: 'Putting a screen in front of the eyes is not enough. The optics, separate eye views, tracked rendering and changing ear signals must work together as the head moves.',
  limits,
  sources: [sources.optics, sources.rendering, sources.tracking, sources.audio, sources.trackedAudio, sources.hrtf, sources.evaluation, sources.mpu],
  related: ['Games controller', 'Video games console', 'Lenses'],
  quiz: {
    question: 'Why must the computer change both images and ear signals when the head turns?',
    options: ['The scene should stay fixed in the virtual world while the display and earphones move with the wearer.', 'The lenses rotate the virtual world mechanically.', 'A gyroscope directly outputs a finished picture and sound.'],
    answer: 0,
    explanation: 'Tracking estimates the new viewing and listening pose. The computer uses that pose to prepare the next eye views and ear signals.',
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
  sources: [sources.tracking, sources.mpu],
  quiz: {
    question: 'A gyroscope reads every turn 3% too fast. When is the estimate furthest off?',
    options: ['When the head has turned furthest from where it started.', 'After the longest time, whatever the head does.', 'Never: a scale error cancels itself out.'],
    answer: 0,
    explanation: 'A scale error adds a share of every turn, so it follows the angle turned: 1.80° after a 60° turn, and 0.00° once a shaking head faces forward again.',
  },
};

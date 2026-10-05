import {TRACKING_DEFAULTS, sampleHeadTracking} from './head-tracking-physics.js';

const experiment = (title, instruction, observe, time, part = 'tracking-step', settings = {}) => {
  const values = {...TRACKING_DEFAULTS, ...settings};
  const at = typeof time === 'function' ? time(sampleHeadTracking(values)) : time;
  return {title, instruction, observe, values, initialState: {settings: values, time: at}, reset: true, part, isolate: true, view: 'front'};
};

export const headTrackingLesson = {
  simple: 'How do turning-rate readings become a head direction, and how can a camera correct the errors?',
  overview: 'A MEMS gyroscope measures turning rate. Multiplying each reading by its time interval gives a small angle; adding those angles estimates the head’s direction. An offset accumulates even while the head stays still. A scale error follows the net turn. Here an independent camera supplies occasional direction measurements, and a complementary filter pulls the estimate toward the latest one. Inspect the connected headset, then follow one numerical update and compare the resulting traces.',
  steps: [
    {title: 'Set the starting direction', body: 'The head and estimate begin at zero degrees. This registers the initial forward direction; adding rate measurements cannot discover an unknown starting angle.'},
    {title: 'Read the gyroscope', body: 'The assigned sensor reports 1,000 times a second. Each reading is the average turning rate during the preceding millisecond, with the selected offset and scale error.'},
    {title: 'Add one small angle', body: 'Multiply degrees per second by 0.001 seconds. Add that angle to the previous corrected estimate. The first row of the update diagram shows this integration before camera correction.'},
    {title: 'Use the latest camera direction', body: 'The assigned camera measures direction 60 times a second. Between images, the filter reuses the last camera measurement, so it can lag a turning head even though each captured measurement is exact.'},
    {title: 'Correct and remember', body: 'Add α times the difference between the camera direction and the integrated estimate. Keep this corrected estimate for the next update. A larger gain removes offset drift faster but follows the older camera measurements more strongly.'},
  ],
  parts: [
    {name: 'Connected system', role: 'The wearer, supported headset sensor, external camera and computer linked by cables.'},
    {name: 'Gyroscope chip', role: 'Supplies turning-rate readings; internal MEMS motion is explained in text.'},
    {name: 'Tracking camera', role: 'Supplies an independent direction at each image time.'},
    {name: 'One tracking update', role: 'Shows integration and camera correction as separate arithmetic steps.'},
    {name: 'Head and estimated direction', role: 'Compares true yaw, camera samples and corrected estimates.'},
    {name: 'Tracking error over time', role: 'Shows the complete error trace on a labeled scale that fits it.'},
  ],
  tryIt: [
    experiment('Start the tracker', 'Inspect the connected system, then press Play or Step.', 'The head starts facing the registered zero direction. The chip moves with the headset; the camera stays fixed in the room.', 0, 'system'),
    experiment('A reading during the turn', 'Read the paused update halfway through the turn with camera correction off.', 'At 1.000 s the rate reads 112.50°/s. Multiplying by 0.001 s adds about 0.11250° to the previous estimate, bringing it to 30.00000°. Replay to see the rate rise and fall.', 1, 'tracking-step', {correction: 0}),
    experiment('Add up the readings', 'Inspect the completed turn with a perfect gyroscope and no correction.', 'The 3,000 interval readings add to 60.00°, exactly the assigned turn. The estimate and head curves coincide because this model uses exact interval means and no noise.', 3, 'tracking-heading', {correction: 0}),
    experiment('An offset', 'Hold the head still, add a 0.5°/s offset and turn correction off.', 'The completed estimate is +1.50° after 3 s even though the head never moved. The error grows at 0.5° per second.', 3, 'tracking-drift', {motion: 2, offset: .5, correction: 0}),
    experiment('Reverse the offset', 'Keep the head still and use a negative offset.', 'A −0.5°/s reading adds −0.000500° per sample. After 3 s the estimate is −1.50°, on the other side of the unchanged head direction.', 3, 'tracking-step', {motion: 2, offset: -.5, correction: 0}),
    experiment('A scale error', 'Read the completed 60° turn with the gyro reading 3% too fast.', 'The estimate reaches 61.80°, an error of +1.80°. With zero offset and no correction, a scale error follows the signed angle turned rather than elapsed time.', 3, 'tracking-heading', {scale: 3, correction: 0}),
    experiment('At the end of a swing', 'Pause after the first 25° swing with a 3% scale error.', 'At 1.000 s the head is at 25.00° and the estimate at 25.75°. The +0.75° error changes sign when the head swings to the other side.', 1, 'tracking-heading', {motion: 1, scale: 3, correction: 0}),
    experiment('Shake it off', 'Inspect the same repeated swings after the head returns to its start.', 'Each outward 25° swing adds 0.75° of scale error and the return removes it. The final error is 0.00° here because offset, noise and camera correction are all absent.', 3, 'tracking-drift', {motion: 1, scale: 3, correction: 0}),
    experiment('A gentle pull', 'Use the gentle camera correction on a stationary head with a 0.5°/s offset.', 'After 3 s the error is still about +1.30°, smaller than the uncorrected +1.50°. The small gain acts slowly and leaves a nonzero steady error when a constant offset persists.', 3, 'tracking-drift', {motion: 2, offset: .5, correction: 1}),
    experiment('A firm pull while still', 'Use the stronger correction on that same stationary head.', 'The estimate settles near +0.0495°. Each sample adds +0.000500° from the offset; the camera removes nearly the same amount. Strong correction does not make a persistent offset disappear exactly.', 3, 'tracking-step', {motion: 2, offset: .5, correction: 2}),
    experiment('A firm pull during a turn', 'Inspect the largest tracking error with a 0.5°/s offset and strong camera correction.', 'During the turn the estimate falls about 0.83° behind the head because the held camera direction is older. The final error is much smaller after the head stops. The curve distinguishes the transient error from the endpoint.', plan => plan.worstDrift.stage / 1000, 'tracking-drift', {offset: .5, correction: 2}),
    experiment('Hold the camera measurement', 'Inspect sample 1,016 during a turn with strong camera correction.', 'The camera measurement is still the one captured at 1.000 s, now 16.000 ms old. Integration moves forward, while correction pulls toward the older 30.000° direction.', 1.016, 'tracking-step', {correction: 2}),
    experiment('A fresh camera measurement', 'Advance to the next gyro sample.', 'At 1.017 s the newest camera measurement was captured at 1.016667 s. It is only 0.333 ms old, so the correction target jumps forward while the gyro continues its millisecond updates.', 1.017, 'tracking-step', {correction: 2}),
    experiment('Read the completed result', 'Return to the connected system after the default three-second run.', 'The result states both the final tracking error and the largest sample error during the run. Replay keeps the chosen tracking settings and starts from the registered zero direction.', 3, 'system'),
  ],
  deeper: [
    {title: 'What the chip senses', body: 'A MEMS gyroscope drives microscopic structures to vibrate. Rotation produces a Coriolis response across that driven motion; electronics sense it and calibrate a turning-rate output. An IMU can package several gyro and accelerometer axes together. This drawing shows the package and board, not its internal resonator or sensing circuit.'},
    {title: 'Offset and scale', body: 'The sensor model is measured rate = offset + scale × true mean rate. Here scale = 1 + the percentage error divided by 100. With correction off and the correct initial direction, error = offset × elapsed time + (scale − 1) × net yaw. Returning to the starting yaw cancels this scale term, but does not cancel an offset accumulated during the trip.'},
    {title: 'Integrate, then blend', body: 'First compute integrated = previous estimate + measured rate × 0.001 s. Then compute corrected = integrated + α × (camera − integrated), equivalently (1 − α) × integrated + α × camera. The corrected value feeds the next step. With α = 0, the camera is ignored.'},
    {title: 'One camera sample, many gyro updates', body: 'At the assigned 60 Hz and 1,000 Hz rates, the same camera measurement serves for 16 or 17 gyro updates. An exact camera measurement can therefore become a stale correction target during movement. Real capture, processing and transmission delays would add further complications.'},
    {title: 'Correction has a time scale', body: 'For a stationary head and constant offset a, the error follows e[k] = (1 − α) × (e[k−1] + a × 0.001). Its steady value is (1 − α) × a × 0.001 / α. With a = 0.5°/s it is 4.9995° at α = 0.0001 and 0.0495° at α = 0.01. Those are mathematical long-run limits, not additional simulated runs. The exact decay time is −0.001 / ln(1 − α): about 10 s and 0.0995 s respectively.'},
    {title: 'Calibration and additional axes', body: 'Real sensors also have noise, quantization, temperature effects and axis misalignment. Calibration and additional references address different errors. An accelerometer can help estimate tilt when linear acceleration is small, but gravity alone cannot reveal yaw. Full orientation needs three-dimensional rotations; tracking position requires additional information. This lesson deliberately solves only the one-axis yaw problem.'},
  ],
  misconception: 'A rate reading is not a direction reading. Direction depends on the initial registration and every integrated sample, while camera correction is a separate operation with its own update rate.',
  limits: 'Assigned yaw-only teaching model, not a production headset tracker or an anatomical model. The initial head and estimate are registered at zero. Three seconds of smooth movement play five times slower; each gyroscope reading is the exact interval-mean rate plus selected constant offset and scale error. The ideal camera measures yaw at 60 Hz with no error, delivery delay, image processing, field-of-view restriction or occlusion. Its latest measurement is reused at 1,000 Hz. Alpha is a fixed complementary gain. Pitch, roll, translation, noise, quantization, temperature drift, calibration procedures and internal MEMS motion are not simulated. Curves show the entire planned run; the vertical cursor marks the selected sample. Tracking error is measured at gyro samples, not throughout display illumination. Optics, frame timing, prediction and sound retain the parent headset defaults and are not controlled here. Functional cables and hardware supports are illustrative; the camera is drawn nearby for legibility.',
  sources: [{title: 'LaValle: rate integration, registration and complementary tracking', url: 'https://lavalle.pl/vr/vrch9.pdf'}],
  quiz: {
    question: 'With zero offset and camera correction off, a gyroscope reads every turn 3% too fast. When is its direction estimate furthest off?',
    options: ['When the absolute net yaw from the starting direction is greatest.', 'After the longest time, regardless of movement.', 'It is always correct because opposite turns cancel.'],
    answer: 0,
    explanation: 'In this yaw-only model, scale error is 3% of net turn: 1.80° after a 60° turn and zero after returning to the start. This cancellation does not remove offset drift, noise or errors from other mechanisms.',
  },
};

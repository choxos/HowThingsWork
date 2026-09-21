import {PHONE_DEFAULTS} from './phone-physics.js';

const trial = (defaults, part, view = 'front') => (title, instruction, observe, values = {}) => ({title, instruction, observe, values: {...defaults, ...values}, reset: true, part, isolate: false, view});

export const sources = {
  accelerometer: {title: 'Wikipedia: Accelerometer', url: 'https://en.wikipedia.org/wiki/Accelerometer'},
  capacitiveSensing: {title: 'Wikipedia: Capacitive sensing', url: 'https://en.wikipedia.org/wiki/Capacitive_sensing'},
  touchscreen: {title: 'Wikipedia: Touchscreen', url: 'https://en.wikipedia.org/wiki/Touchscreen'},
  an2934: {title: 'Microchip: AN2934, Capacitive Touch Sensor Design Guide', url: 'https://ww1.microchip.com/downloads/aemDocuments/documents/TXFG/ApplicationNotes/ApplicationNotes/Capacitive-Touch-Sensor-Design-Guide-DS00002934-B.pdf'},
  smartphone: {title: 'Wikipedia: Smartphone', url: 'https://en.wikipedia.org/wiki/Smartphone'},
  adxl335: {title: 'Analog Devices: ADXL335 datasheet, Rev. A', url: 'https://www.sparkfun.com/datasheets/Components/SMD/adxl335.pdf'},
  coin: {title: 'Adafruit: vibration motor specification, model 10B27.3018', url: 'https://cdn-shop.adafruit.com/product-files/1201/P1012_datasheet.pdf'},
  otherCoin: {title: 'SparkFun: coin type vibration motor specification, model B1034.FL45-00-015', url: 'https://cdn.sparkfun.com/datasheets/Robotics/B1034.FL45-00-015.pdf'},
  ab004: {title: 'Precision Microdrives: AB-004, understanding ERM vibration motor characteristics', url: 'https://www.precisionmicrodrives.com/ab-004'},
  ab020: {title: 'Precision Microdrives: AB-020, understanding linear resonant actuator characteristics', url: 'https://www.precisionmicrodrives.com/ab-020'},
  ab027: {title: 'Precision Microdrives: AB-027, eccentric mass parameters for vibration motors', url: 'https://www.precisionmicrodrives.com/ab-027'},
  ab028: {title: 'Precision Microdrives: AB-028, vibration motor comparison guide', url: 'https://www.precisionmicrodrives.com/ab-028'},
  coinMotors: {title: 'Precision Microdrives: coin vibration motors', url: 'https://www.precisionmicrodrives.com/coin-vibration-motors'},
  massSpring: {title: 'Wikipedia: Mass-spring-damper model', url: 'https://en.wikipedia.org/wiki/Mass-spring-damper_model'},
  qFactor: {title: 'Wikipedia: Q factor', url: 'https://en.wikipedia.org/wiki/Q_factor'},
  capacitor: {title: 'Wikipedia: Capacitor', url: 'https://en.wikipedia.org/wiki/Capacitor'},
  rc: {title: 'Wikipedia: RC circuit', url: 'https://en.wikipedia.org/wiki/RC_circuit'},
  lowPass: {title: 'Wikipedia: Low-pass filter', url: 'https://en.wikipedia.org/wiki/Low-pass_filter'},
  fluctuation: {title: 'Wikipedia: Fluctuation-dissipation theorem', url: 'https://en.wikipedia.org/wiki/Fluctuation-dissipation_theorem'},
  equipartition: {title: 'Wikipedia: Equipartition theorem', url: 'https://en.wikipedia.org/wiki/Equipartition_theorem'},
  boltzmann: {title: 'Wikipedia: Boltzmann constant', url: 'https://en.wikipedia.org/wiki/Boltzmann_constant'},
  gravity: {title: 'Wikipedia: Standard gravity', url: 'https://en.wikipedia.org/wiki/Standard_gravity'},
  centripetal: {title: 'Wikipedia: Centripetal force', url: 'https://en.wikipedia.org/wiki/Centripetal_force'},
  haptics: {title: 'Wikipedia: Haptic technology', url: 'https://en.wikipedia.org/wiki/Haptic_technology'},
  vibratingAlert: {title: 'Wikipedia: Vibrating alert', url: 'https://en.wikipedia.org/wiki/Vibrating_alert'},
};

/** What the accelerometer takes without a source. */
export const accelerometerLimits = 'Not from a source: sense gaps of 1.5 μm, a proof mass of 1 μg damped critically, one pole for each filter, and a temperature of 25 °C. The cells are drawn as single axis cells, as the Accelerometer page says multi axis accelerometers usually are, though the ADXL335 senses all three axes with one structure; its z axis, which reads nothing with the phone upright, is left out. The masses are taken to follow the buzz exactly, and how the filter settles as a buzz starts and stops is left out. The screen turns to landscape when the x axis reads more than the y axis; real phones hold the last orientation and wait before turning.';

/** What the motor and the phone's shaking take without a source. */
export const motorLimits = 'Not from a source: a phone of 150 g that shakes as a free body; the motor sheet’s 1.0 G taken as the peak of the block’s shaking; the motor starting at 2.3 V, the most its sheet lets it need, and turning in proportion to the voltage from there, with no time to spin up or slow down; and its weight taken as a half disk of tungsten carbide 1.5 mm thick, sized to give that 1.0 G. The buzz lasts 100 ms.';

// ---------------------------------------------------------------------------
// Smartphone.
// ---------------------------------------------------------------------------

const phoneTouch = trial(PHONE_DEFAULTS, 'touch'), phoneCells = trial(PHONE_DEFAULTS, 'accelerometer'), phoneChart = trial(PHONE_DEFAULTS, 'output');

/** What the touchscreen takes without a source. */
export const touchLimits = 'Not from a source: the Capacitive sensing page’s 12-by-16 array laid over a screen of 66 by 136 mm, its rows driving and its columns sensing; each crossing’s change falling off from the fingertip’s center as a bell curve with a spread of 4 mm, the fingertip’s radius, since AN2934 says there is no simple way to work out a mutual sensor’s touch capacitance; and a controller that reports the center of the changes at the strongest crossing and its neighbors, two columns and one row each side, taking the first it finds, row by row from the bottom, when two change alike. The fingertip stays at least 12 mm from the screen’s sides and 9 mm from its top and bottom, so those neighbors are always on the screen, and one fingertip touches at a time.';

export const smartphoneLimits = `The phone is drawn at true size with an illustrative body and its shaking 2,000 times larger, the touch grid under the fingertip 3 times larger, the accelerometer’s cells as a schematic with their masses’ movement 60 times its share of the gap, and the motor 10 times larger. The motor turns 100 times slower than it does. ${touchLimits} ${accelerometerLimits} ${motorLimits}`;

export const smartphoneLesson = {
  simple: 'How does a phone find your fingertip, tell which way is up, and buzz?',
  overview: 'A phone’s screen is covered by a grid of transparent lines: rows pulsed one at a time and columns that pick up each pulse, with a capacitor wherever a row crosses a column. A fingertip draws away part of the coupling at the crossings beneath it, and the controller finds the touch from how much each one changes. Inside, an accelerometer’s silicon masses on springs tell which way is up, and a coin motor spinning an off-center weight buzzes the phone. Move your fingertip, turn the phone, lift it or let it fall, and press Play to buzz it.',
  steps: [
    {title: 'Pulse the rows', body: 'The controller pulses the driving rows under the glass one at a time, and each pulse couples into every sensing column that crosses it.'},
    {title: 'Find the fingertip', body: 'A fingertip draws away part of that coupling where it lies, most at the nearest crossing, and the controller takes the center of the changes as the touch.'},
    {title: 'Feel which way is down', body: 'Inside the accelerometer, silicon masses on springs sag against whatever holds the phone up, and capacitors measure how far.'},
    {title: 'Turn the screen', body: 'One cell along the phone’s width and one along its length tell which way is down, and the phone turns its screen to match.'},
    {title: 'Buzz', body: 'A motor spins an off-center weight, which pulls the phone around a small circle many times a second.'},
  ],
  parts: [
    {name: 'Smartphone, true size', role: 'The phone, with its touch grid over the screen and its accelerometer and motor outlined inside.'},
    {name: 'Touchscreen, close up', role: 'The crossings around your fingertip, shaded by how much each changes, and where the controller finds the touch.'},
    {name: 'Accelerometer, cut open', role: 'Two sensing cells, one for each of the phone’s axes in its screen.'},
    {name: 'What the accelerometer reads', role: 'The two outputs through a buzz.'},
    {name: 'Vibration motor, cut open', role: 'The spinning off-center weight that shakes the phone.'},
  ],
  tryIt: [
    phoneTouch('Touch the screen', 'Look at the close up above the phone.', 'Your fingertip lies nearest sensing column 5 and driving row 6. That crossing changes by 68% of its change with the fingertip centered on it, its neighbors less, and the controller finds the touch at 26.0, 49.8 mm, 0.24 mm from your fingertip’s center.'),
    phoneTouch('Halfway between two rows', 'Set the fingertip up to 51 mm.', 'Halfway between two driving rows 8.5 mm apart, both crossings change by 54%. The controller takes the lower as the strongest and still finds the touch 0.07 mm from your fingertip’s center.', {along: 51}),
    phoneTouch('Just past a row', 'Set the fingertip up to 49 mm.', 'The fingertip sits 2.25 mm above row 6, and the controller finds the touch 0.31 mm short of it, toward the row: about as far off as it gets on this screen, since the rows are farther apart than the fingertip is wide.', {along: 49}),
    phoneCells('Hold it upright', 'Look at the two cells.', 'The y axis reads 1.00 g and the x axis 0.00 g. The y cell’s mass sags 8.2 nm, 0.55% of its 1.5 μm gap, and the y output sits at 1.800 V.'),
    phoneCells('Turn it sideways', 'Set the turn to 90° and look at the cells.', 'Now the x axis reads 1.00 g and the y axis 0.00 g: the x cell’s mass sags instead, and the screen turns to landscape.', {turn: 90}),
    phoneCells('Let it fall', 'Set the lift to its lowest, as if the hand let go.', 'Falling freely, both axes read 0.00 g and both masses sit in the middle of their gaps: the masses and their frame fall together, so nothing presses on the springs.', {lift: -1}),
    phoneChart('Buzz it', 'Press Play and watch the chart.', 'The motor turns at 11,000 rpm, 183 times a second, and shakes the phone at 0.50 g. The filter at 1,058 Hz passes 99% of that, so each output swings 0.49 g either side of its steady reading.'),
  ],
  deeper: [
    {title: 'Rows and columns', body: 'The Capacitive sensing page says a mutual capacitance sensor has a capacitor at each crossing of a row and a column, so a 12-by-16 array has 192. Laid over this 66 by 136 mm screen, its 16 driving rows are 8.5 mm apart and its 12 sensing columns 5.5 mm apart. The Touchscreen page says pulses go to the lines one at a time and couple into every line that crosses them, that a finger near the surface reduces the capacitance where they cross, and that the lines are a transparent conductor such as indium tin oxide.'},
    {title: 'Between the crossings', body: 'Microchip’s AN2934 takes a fingertip as a disc 5 to 10 mm across, 8 mm typically, and calls an electrode pitch of about 5 mm ideal for it, so that a touch anywhere overlaps at least two electrodes each way. The columns’ 5.5 mm keeps that; the rows’ 8.5 mm, inside the note’s range of 4 to 10 mm, can leave the fingertip over one row alone. Weighing the strongest crossing with its neighbors, the controller finds a touch within 0.31 mm of the fingertip’s center anywhere on this screen, and exactly on it when the fingertip sits on a crossing.'},
    {title: 'Two effects, one answer', body: 'AN2934 says a fingertip over a mutual sensor does two things: it couples the driving line to the sensing line more strongly, and it carries charge away to earth through the body, 100 to 200 pF, and a touch usually lowers the capacitance measured. The Capacitive sensing page adds that sensing each row and column on its own gives a stronger signal but cannot place two fingers, while measuring every crossing can follow several at once. The note asks for two touches to be at least twice the pitch apart: 11 mm across this grid and 17 mm along it.'},
    {title: 'What an accelerometer reads', body: 'The Accelerometer page says one at rest on the Earth reads about 1 g upward, because the ground pushes it up, and one in free fall reads zero: it measures its proper acceleration, not gravity itself. So an upright phone’s y axis reads 1.00 g, a phone pushed upward at 1 g reads 2.00 g, and a dropped phone reads 0.00 g. The inertial accelerometer in an aircraft’s autopilot measures the same thing.'},
    {title: 'Nanometers', body: 'A mass on a spring sags until the spring pushes as hard as the acceleration needs, a distance of a/ωn² whatever the mass, since a heavier mass needs a stiffer spring to keep the same resonance. The ADXL335’s sheet gives a sensor resonant frequency of 5.5 kHz, so 1 g sags its masses 8.21 nm. Against a sense gap of 1.5 μm that is 0.55%, which is why the masses’ movement is drawn 60 times its share of the gap.'},
    {title: 'The motor’s pull', body: 'Precision Microdrives’ AB-004 gives the force of an off-center weight as mrω², and the Centripetal force page says twice the speed needs four times the force. The motor’s sheet gives 1.0 G on a 75 g block at 3.0 V and 11,000 rpm, a force of 0.74 N, so its weight’s mass times its offset is 0.55 g·mm. As a half disk of tungsten carbide, 15.63 g/cm³ on AB-027, 1.5 mm thick, that is a weight 3.29 mm in radius and 0.40 g, its center of mass 1.39 mm from the shaft.'},
  ],
  misconception: 'A capacitive touchscreen does not feel how hard a finger presses. It measures how much the finger draws away from the coupling between its lines, which is why the Capacitive sensing page says a gloved finger may not be sensed.',
  limits: smartphoneLimits,
  sources: [sources.capacitiveSensing, sources.touchscreen, sources.an2934, sources.accelerometer, sources.smartphone, sources.adxl335, sources.coin, sources.ab004, sources.ab027, sources.massSpring, sources.capacitor, sources.rc, sources.centripetal, sources.vibratingAlert, sources.haptics, sources.gravity],
  quiz: {
    question: 'How does the phone place a touch that falls between the grid’s crossings?',
    options: ['It weighs how much the crossings around it change and takes the center of those changes.', 'It picks the nearest crossing and reports that.', 'It measures how hard the finger presses on each crossing.'],
    answer: 0,
    explanation: 'Just past a driving row, at 49 mm up, the nearest crossing alone would put the touch 2.57 mm off; weighing it with its neighbors, the controller finds the touch 0.31 mm from the fingertip’s center.',
  },
};

// ---------------------------------------------------------------------------
// Accelerometer.
// ---------------------------------------------------------------------------

const cells = trial(PHONE_DEFAULTS, 'accelerometer'), held = trial(PHONE_DEFAULTS, 'phone'), readout = trial(PHONE_DEFAULTS, 'output');

export const accelerometerLesson = {
  simple: 'How does a speck of silicon feel which way is down?',
  overview: 'An accelerometer like Analog Devices’ ADXL335 hangs a polysilicon proof mass on polysilicon springs over its chip. When the chip is pushed, the mass lags until the bent springs push it along, and a differential capacitor measures the bend. A phone uses one cell along each axis to tell which way is down. Turn the phone, push it up or let it fall, and change the filter.',
  steps: [
    {title: 'A mass on springs', body: 'Polysilicon springs hold the proof mass over the chip and resist its movement.'},
    {title: 'Pushed, it lags', body: 'When the chip is pushed, the mass lags behind until the bent springs push it along as hard as the chip is pushed.'},
    {title: 'Fingers and gaps', body: 'Each finger on the mass sits between two fixed fingers, so the lag narrows one gap and widens the other.'},
    {title: 'A balanced divider', body: 'The fixed fingers are driven by square waves out of phase, so the mass’s fingers pick up a voltage in proportion to the lag.'},
    {title: 'Filter the output', body: 'A capacitor on each output sets how fast the reading can change, trading bandwidth for noise.'},
  ],
  parts: [
    {name: 'Accelerometer, cut open', role: 'Two sensing cells, their masses, springs and fingers.'},
    {name: 'What the accelerometer reads', role: 'The two outputs, filtered.'},
    {name: 'Smartphone, true size', role: 'The phone whose turn and lift the cells feel.'},
  ],
  tryIt: [
    cells('Hold it upright', 'Look at the gold cell.', 'The y cell’s mass sags 8.2 nm, narrowing one gap to 1.4918 μm and widening the other to 1.5082 μm, and the y output reads 1.00 g at 1.800 V.'),
    held('Just past halfway', 'Set the turn to 50°.', 'The x axis reads 0.77 g and the y axis 0.64 g. The model turns the screen once x reads more than y, which an upright phone does past 45°.', {turn: 50}),
    cells('Push it up', 'Set the lift to 1 g.', 'The y axis reads 2.00 g: the mass sags 16.4 nm, 1.09% of its gap, and the output rises to 2.100 V, still inside the sheet’s range of 3 g.', {lift: 1}),
    cells('Let it fall', 'Set the lift to its lowest.', 'Both axes read 0.00 g and both outputs sit at 1.500 V, the reading for no acceleration at all.', {lift: -1}),
    readout('The sheet’s test capacitor', 'Choose the 0.1 μF capacitor and press Play.', 'The sheet measures its specifications with 0.1 μF, a bandwidth of 50 Hz. The buzz at 183 Hz comes through at 26%, 75° late, and the noise is 1.34 mg rms.', {filter: 0.1}),
    readout('The largest capacitor', 'Choose the 4.7 μF capacitor and press Play.', 'A bandwidth of 1 Hz passes only 0.6% of the buzz, so the outputs barely move, and the noise falls to 0.20 mg rms.', {filter: 4.7}),
  ],
  deeper: [
    {title: 'Proper acceleration', body: 'The Accelerometer page says an accelerometer measures proper acceleration, the acceleration it feels relative to free fall: at rest it reads about 1 g upward and in free fall zero. It also says multi axis accelerometers are usually built from single axis ones along different axes, as the two cells are drawn.'},
    {title: 'Sag without the mass', body: 'The Mass-spring-damper model page gives ωn = √(k/m), and the spring holds the mass where kx = ma, so x = a/ωn²: the sheet’s 5.5 kHz alone sets 8.21 nm for each g. A proof mass of 1 μg would need a spring of 1.19 N/m and feel 9.8 nN at 1 g. At the buzz’s 183 Hz, 30 times below resonance, the mass follows within 0.11% for any damping from critical to none.'},
    {title: 'A divider that stays straight', body: 'With the fixed plates driven by square waves 180° out of phase, a finger between them sits at the drive times (C1 − C2)/(C1 + C2), which for plates of εA/d is exactly its movement over the gap. The sheet says phase sensitive demodulation then finds the size and direction of the acceleration, giving 300 mV for each g about 1.5 V at 3 V.'},
    {title: 'Noise from heat', body: 'The Fluctuation-dissipation theorem page says the random forces that jostle a particle in a fluid are the same ones that drag on it. For a mass damped by air that jostling reads as √(4kBTωn/(Qm)): 109 μg/√Hz for a proof mass of 1 μg, critically damped at 25 °C, against the sheet’s 150 μg/√Hz. By the Equipartition theorem page, which gives each quadratic energy ½kBT, the mass then shakes 58.7 pm rms.'},
    {title: 'One pole', body: 'The sheet’s filter is its 32 kΩ resistor with your capacitor, a single pole whose bandwidth is 1/(2π × 32 kΩ × C), where the RC circuit page gives its gain as 1/√2. Its rms noise factor of 1.6 is π/2, 1.57, rounded up: a single pole lets noise through as if its band were that much wider.'},
    {title: 'Testing itself', body: 'Setting the self test pin puts an electrostatic force on the beam: the sheet gives a typical change of 325 mV on y, which at 300 mV for each g reads as 1.08 g. The chip survives shocks of 10,000 g and measures at least 3 g each way.'},
  ],
  misconception: 'An accelerometer does not measure speed or position. It reads the push on its frame, and a phone can only work out where it went by adding up those readings.',
  limits: `The cells are drawn as a schematic with their masses’ movement 60 times its share of the gap. ${accelerometerLimits}`,
  sources: [sources.accelerometer, sources.adxl335, sources.massSpring, sources.qFactor, sources.capacitor, sources.rc, sources.lowPass, sources.fluctuation, sources.equipartition, sources.boltzmann, sources.smartphone, sources.gravity],
  quiz: {
    question: 'Why does a heavier proof mass not sag farther, if the resonance stays the same?',
    options: ['Keeping the resonance takes a stiffer spring in the same proportion, so the sag a/ωn² is unchanged.', 'Gravity pulls less on heavier masses.', 'The capacitors hold heavier masses in place.'],
    answer: 0,
    explanation: 'The sag is a/ωn², so the sheet’s 5.5 kHz gives 8.21 nm for each g whatever the mass.',
  },
};

// ---------------------------------------------------------------------------
// Vibration motor.
// ---------------------------------------------------------------------------

const motor = trial(PHONE_DEFAULTS, 'motor'), shaken = trial(PHONE_DEFAULTS, 'phone'), felt = trial(PHONE_DEFAULTS, 'output');

export const vibrationMotorLesson = {
  simple: 'How does a spinning weight make a phone buzz?',
  overview: 'A coin vibration motor spins a small off-center weight. The shaft must pull the weight around its circle, and the weight pulls back on the shaft toward itself, so the pull turns with the weight and shakes the phone around a small circle. Press Play to buzz it, and change the voltage to see how the speed and the force change.',
  steps: [
    {title: 'Apply a voltage', body: 'A DC voltage across the brushes drives current through the flat coils, which turn in the magnet’s field.'},
    {title: 'Spin the weight', body: 'The coils carry an off-center weight of dense tungsten carbide around with them.'},
    {title: 'Pull on the shaft', body: 'Keeping the weight on its circle takes a force toward the shaft, so the weight pulls the shaft toward itself.'},
    {title: 'Shake the phone', body: 'That pull turns with the weight, so the phone is pulled around a small circle once every turn.'},
    {title: 'Feel it', body: 'The phone’s own accelerometer reads the buzz as a swing on both of its axes in the screen.'},
  ],
  parts: [
    {name: 'Vibration motor, cut open', role: 'The coin motor with its off-center weight.'},
    {name: 'Smartphone, true size', role: 'The phone the motor shakes.'},
    {name: 'What the accelerometer reads', role: 'The buzz as the phone’s accelerometer feels it.'},
  ],
  tryIt: [
    motor('Buzz', 'Press Play and watch the weight.', 'At 3.0 V the motor turns 11,000 rpm, 183 turns a second, and its weight pulls on the shaft with 0.74 N, always toward the weight.'),
    shaken('Watch the phone shake', 'Press Play and watch the phone.', 'The pull shakes the 150 g phone at 0.50 g around a circle 3.70 μm in radius, drawn 2,000 times larger as 7.4 mm.'),
    motor('Full voltage', 'Set the motor voltage to 3.8 V and press Play.', 'The motor turns 13,933 rpm and pulls with 1.18 N, so the phone shakes at 0.80 g. The circle stays 3.70 μm: a faster weight shakes harder, not farther.', {drive: 3.8}),
    motor('Just enough to start', 'Set the motor voltage to 2.3 V and press Play.', 'At the most its sheet lets it need to start, the motor turns 8,433 rpm, 141 turns a second, and pulls with only 0.43 N.', {drive: 2.3}),
    motor('Too little', 'Set the motor voltage to 2.2 V and press Play.', 'The motor does not start, and nothing shakes the phone.', {drive: 2.2}),
    felt('What the phone feels', 'Press Play and watch the chart.', 'The accelerometer’s outputs swing 0.49 g either side of their steady readings, 90° apart, since the pull turns through both axes.'),
  ],
  deeper: [
    {title: 'Force from speed', body: 'AB-004 says the voltage sets the speed, the two directly proportional, and that the vibration grows with the square, since the force of the off-center weight is mrω². The Centripetal force page says the same: twice the speed needs four times the force. From 3.0 V to 3.8 V the speed rises 27% and the force 60%.'},
    {title: 'The weight', body: 'AB-027 says eccentric masses are often tungsten carbide for its density of 15.63 g/cm³, and gives a sector’s center of mass as 2r sin θ/(3θ). For a half disk, θ = π/2, that is 4r/(3π). The model sizes a half disk 1.5 mm thick to match the sheet’s shaking: 3.29 mm in radius and 0.40 g, its center of mass 1.39 mm out, together 0.55 g·mm.'},
    {title: 'Measured on a block', body: 'The motor’s sheet measures 1.0 G on a 75 g block at 3.0 V. AB-004 says Precision Microdrives quotes its motors on a 100 g mass, as a typical hand held application such as a mobile phone, where this motor would give 0.75 G, and on a 150 g phone 0.50 g.'},
    {title: 'Coin motors', body: 'Adafruit’s sheet rates this 10 mm motor at 11,000 ± 3,000 rpm and 75 mA at 3.0 V, and SparkFun’s 10 mm coin motor at 13,000 ± 3,000 rpm and 60 mA at 3.0 V. Precision Microdrives’ table puts brushed motors like these between 30 and 500 Hz, and it recommends switching coin motors hard on and off above their start voltage.'},
    {title: 'Linear resonant actuators', body: 'The Haptic technology page says Apple’s Taptic Engine is a linear resonant actuator, a mass moved back and forth by a voice coil, and that these respond faster than spinning weights. Precision Microdrives’ table gives them 150 to 205 Hz, driven within 5 Hz of their resonance because of their high Q, and AB-020 gives its C10-100 a typical start time of 5 ms and stop time of 275 ms.'},
    {title: 'A slowed clock', body: 'The motor turns 100 times slower here than it does: the buzz of 100 ms takes 10 s, and each turn at 11,000 rpm, 5.5 ms, takes 0.55 s.'},
  ],
  misconception: 'A vibration motor does not buzz because it runs roughly. A balanced motor spins smoothly; the buzz comes from the off-center weight pulling the shaft around.',
  limits: `The motor is drawn 10 times larger and turns 100 times slower than it does, and the phone’s shaking is drawn 2,000 times larger. ${motorLimits}`,
  sources: [sources.coin, sources.otherCoin, sources.ab004, sources.ab027, sources.ab028, sources.ab020, sources.coinMotors, sources.centripetal, sources.haptics, sources.vibratingAlert, sources.accelerometer],
  quiz: {
    question: 'Why does the motor pull harder at a higher voltage?',
    options: ['It turns faster, and the pull on its weight grows with the square of the speed.', 'A higher voltage makes the weight heavier.', 'The weight moves farther from the shaft.'],
    answer: 0,
    explanation: 'At 3.8 V the motor turns 27% faster than at 3.0 V and pulls 60% harder, 1.18 N instead of 0.74 N.',
  },
};

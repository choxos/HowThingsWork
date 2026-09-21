import {PAD_DEFAULTS} from './games-controller-physics.js';

const trial = part => (title, instruction, observe, values = {}) => ({title, instruction, observe, values: {...PAD_DEFAULTS, ...values}, reset: true, part, isolate: false, view: 'front'});
const joystickTrial = trial('joystick'), potsTrial = trial('pots'), timelineTrial = trial('timeline'), mapTrial = trial('map'), adcTrial = trial('adc'), bounceTrial = trial('bounce'), latencyTrial = trial('latency'), screenTrial = trial('screen'), consoleTrial = trial('console');

export const sources = {
  xinput: {title: 'Microsoft Learn: getting started with XInput (dead zones)', url: 'https://learn.microsoft.com/en-us/windows/win32/xinput/getting-started-with-xinput'},
  alps: {title: 'ALPS Alpine: RKJXV122400R thumbstick module specifications', url: 'https://tech.alpsalpine.com/e/products/detail/RKJXV122400R/'},
  stick: {title: 'Wikipedia: Analog stick', url: 'https://en.wikipedia.org/wiki/Analog_stick'},
  potentiometer: {title: 'Wikipedia: Potentiometer', url: 'https://en.wikipedia.org/wiki/Potentiometer'},
  adc: {title: 'Wikipedia: Analog-to-digital converter (resolution)', url: 'https://en.wikipedia.org/wiki/Analog-to-digital_converter'},
  bounce: {title: 'Wikipedia: Switch (contact bounce and debouncing)', url: 'https://en.wikipedia.org/wiki/Switch'},
  hid: {title: 'Wikipedia: USB human interface device class (polling)', url: 'https://en.wikipedia.org/wiki/USB_human_interface_device_class'},
  lag: {title: 'Wikipedia: Lag (video games)', url: 'https://en.wikipedia.org/wiki/Lag_(video_games)'},
  displayLag: {title: 'Wikipedia: Display lag', url: 'https://en.wikipedia.org/wiki/Display_lag'},
};

const limits = 'Illustrative controller: a thumbstick module like ALPS Alpine’s RKJXV, tilting 23° each way, its 14 mN m operating torque split into 11.5 mN m of spring at full tilt and 2.5 mN m of friction to match its 5° return precision; a lever and cap of 5 × 10⁻⁷ kg m² about the pivot, damped to a tenth of critical; potentiometers covering the middle 80% of their tracks; an ideal ADC on 3.3 V, scanned every millisecond; contacts that bounce in one fixed pattern for 2.6 ms; a console that hears every change in its reports; and a game at 60 frames a second whose character walks at up to 5 m/s. Not modeled: potentiometer wear, noise and calibration, the thumb itself, wireless links, the operating system, and scan-out down the screen. The console and monitor are drawn at a fifth of their size, and the run plays fifty times slower than real time.';

export const gamesControllerLesson = {
  simple: 'How does a thumb on a stick become a character moving on a screen, and why does a press take a sixteenth of a second to show?',
  overview: 'A games controller measures where its thumbstick points with two potentiometers, turns their voltages into numbers, and answers the console when it asks. A spring pulls the stick back toward center, but friction in its gimbal can hold it a few degrees off, so games ignore a dead zone around the center. The button’s contacts bounce before they settle, so the controller waits for its scans to agree. Then the game waits for its next frame, and the screen adds its own delay. Let go of the stick, press the button, and follow both all the way to the screen.',
  steps: [
    {title: 'Tilt the stick', body: 'The lever pivots in a gimbal. Two slotted yokes at right angles each turn with the part of the tilt across their slot, and each turns a potentiometer.'},
    {title: 'Measure the voltages', body: 'Each potentiometer is a voltage divider: its wiper’s voltage follows how far its yoke has turned. The controller’s ADC turns each voltage into a whole number every millisecond.'},
    {title: 'Debounce the button', body: 'The button’s contacts bounce apart and together before they settle. The firmware believes a press only when several scans in a row agree.'},
    {title: 'Answer the poll', body: 'The console asks the controller for a report at a fixed rate, 125 times a second here unless you choose faster, and the controller sends its latest numbers.'},
    {title: 'Run the frame', body: 'At the start of each frame the game takes the latest report, ignores the stick inside its dead zone, and moves the character. The frame reaches the screen one frame later, plus the display’s own lag.'},
  ],
  parts: [
    {name: 'Thumbstick', role: 'A lever in a gimbal, centered by a spring.'},
    {name: 'Potentiometers', role: 'Turn each yoke’s angle into a voltage.'},
    {name: 'Button and contacts', role: 'A rubber dome and a carbon pill that bridges two pads.'},
    {name: 'Circuit board', role: 'Samples, debounces and reports.'},
    {name: 'Cable', role: 'Carries the console’s polls and the controller’s reports.'},
    {name: 'Console', role: 'Runs the game frame by frame.'},
    {name: 'Monitor', role: 'Shows each frame after its own lag.'},
    {name: 'Charts', role: 'The stick over time, the stick map, the ADC close up, the press close up, and where the time goes.'},
  ],
  tryIt: [
    timelineTrial('Let go of the stick', 'Press Play and watch the stick over time.', 'Let go at the gate, the stick swings 8.13° past center and comes to rest 2.72° to the left, 26.4 ms after letting go, where friction can hold it. Its report of −3,880 is 11.8% of full travel, inside the 24% dead zone, so the character stops.'),
    joystickTrial('Ease it back', 'Choose to ease the stick back from the right.', 'Eased back, the stick stops as soon as its spring can no longer beat friction: 5.00° from center, the most the datasheet’s return precision allows. It reads 21.9% of full travel, still inside the 24% dead zone.', {release: 2}),
    screenTrial('A smaller dead zone', 'Ease the stick back again, and set the dead zone to 20%.', 'The same resting stick now reads more than the dead zone, 21.9% against 20%. With no thumb on the stick, the character creeps across the screen at 0.12 m/s.', {release: 2, deadzone: 20}),
    mapTrial('The diagonal', 'Choose to flick the stick up and right.', 'Against the round gate each yoke turns only 16.7°, yet together they read 102.7% of full travel. The game clamps the magnitude at 32,767, so the diagonal is no faster than straight ahead.', {release: 1}),
    mapTrial('A square gate', 'Flick the stick up and right into a square gate.', 'In the square gate’s corner both yokes turn the full 23°, and the report reads 141.4% of full travel. Clamped, the character still walks only at full speed, but the stick map is a square.', {release: 1, gate: 1}),
    adcTrial('Fewer bits', 'Choose the coarsest ADC.', 'With 8 bits, one step of the ADC is 0.225° of tilt and 320 in the report, four times coarser than with 10 bits: the red steps are plain to see.', {bits: 0}),
    bounceTrial('No debounce', 'Set debounce to 1 scan and choose the fastest polling rate.', 'Believing single scans, the firmware sees the contacts part and close again and counts 2 presses, and polling at 1,000 Hz the console hears both. Over every timing, that happens to 50% of presses.', {debounce: 1, polling: 2}),
    latencyTrial('Where the time goes', 'Press Play and watch the bars.', 'This press reaches the screen 61.7 ms after the contacts touch: 7.3 ms debouncing, 1.2 ms waiting for a poll, 6.5 ms waiting for a frame, 16.7 ms drawing it and 30 ms in the display.'),
  ],
  deeper: [
    {title: 'Why a dead zone at all', body: 'The XInput documentation defines the dead zone as the movement a controller reports while its sticks are untouched and centered, and warns that it varies from controller to controller. A stick that friction holds a few degrees off center is one reason; wear and the potentiometers’ tolerances are others.'},
    {title: 'Round sticks, square numbers', body: 'Each yoke reports its own angle, so a stick pushed diagonally against a round gate reads a little more than full, and one in a square gate’s corner reads 1.41 times full. The documentation’s example clamps the magnitude before rescaling it, which keeps diagonals from moving faster.'},
    {title: 'Why debounce', body: 'Metal contacts that strike together bounce apart one or more times before they settle; the oscilloscope trace Wikipedia shows bounces for 2.6 ms. Reading the button once and trusting it would count one press as several.'},
    {title: 'Frames, not milliseconds', body: 'A game acts on input only at the start of a frame, 16.7 ms apart at 60 frames a second. Missing a frame by 0.1 ms means waiting for the whole next one, so a few milliseconds of debouncing can cost 16.7 ms.'},
    {title: 'How much lag matters', body: 'Testing reported on Wikipedia found that about 200 ms from input to visible response is distracting, and that the most responsive games reach 67 ms before the display adds its own lag, which has been measured between 10 and 68 ms.'},
  ],
  misconception: 'A dead zone is not a sign of a sloppy game or a broken stick. Every released stick comes to rest a little off center, and without a dead zone the game would read that as a push.',
  limits,
  sources: [sources.xinput, sources.alps, sources.stick, sources.adc, sources.bounce, sources.hid, sources.lag, sources.displayLag],
  quiz: {
    question: 'Why does a game ignore small readings from a released stick?',
    options: ['A released stick rests slightly off center, and the game would read that as a push.', 'Small readings take too long to send.', 'The ADC cannot measure small angles.'],
    answer: 0,
    explanation: 'Friction in the gimbal can hold a released stick a few degrees from center, so the game needs a dead zone to tell resting from pushing.',
  },
};

export const joystickLesson = {
  simple: 'How does a thumbstick measure where it points, and why does it never quite return to center?',
  overview: 'A thumbstick is a lever on a ball pivot. Two slotted yokes at right angles turn with its tilt, each moving the wiper of a potentiometer, so two voltages say where the stick points. A spring under the lever’s foot pushes it back toward center, but friction in the gimbal fights the spring, so a released stick settles anywhere within a few degrees of center. Flick it, ease it back, and change its gate to see what the controller measures.',
  steps: [
    {title: 'Tilt the lever', body: 'The lever pivots on a ball. The gate, an opening in the module’s top, stops it at 23° in every direction.'},
    {title: 'Turn the yokes', body: 'Each yoke has a slot along it. Tilt along the slot slides the lever through it; tilt across the slot turns the yoke.'},
    {title: 'Read the potentiometers', body: 'Each yoke turns a wiper along a resistive track, a voltage divider whose wiper voltage follows the yoke’s angle.'},
    {title: 'Spring back, and stop short', body: 'The spring pushes the lever toward center and friction resists. Wherever the spring’s push falls below friction, the lever stays.'},
  ],
  parts: [
    {name: 'Thumbstick', role: 'Lever, ball pivot, yokes, gate and spring.'},
    {name: 'Potentiometers', role: 'One on each yoke.'},
    {name: 'Stick over time', role: 'The stick’s true tilt and its reports.'},
    {name: 'Stick map', role: 'The reports as a map of the stick.'},
  ],
  tryIt: [
    joystickTrial('Two yokes', 'Choose to flick the stick up and right.', 'Tilted 23° toward the upper right, the lever turns each yoke only 16.7°: each yoke feels just the part of the tilt across its slot.', {release: 1}),
    joystickTrial('Spring against friction', 'Look at the thumbstick.', 'The spring pushes with 11.5 mN m at full tilt and friction resists with 2.5 mN m, so the spring wins only beyond 5° from center.'),
    timelineTrial('Snapping back', 'Press Play and watch the stick over time.', 'Let go at the gate, the lever swings 8.13° past center in 13.2 ms, then settles 2.72° on the far side.'),
    timelineTrial('Eased back', 'Choose to ease the stick back from the right.', 'Eased back, it stops at 5.00° and reads 7,160, just under the 7,864 of a 24% dead zone.', {release: 2}),
    potsTrial('The potentiometers', 'Press Play and look at the potentiometers.', 'Resting 2.72° to the left, the X wiper sits at 1.494 V instead of 1.650 V at center, and the 10-bit ADC reads 463 instead of 512.'),
    mapTrial('A square gate', 'Flick the stick up and right into a square gate.', 'In the square gate’s corner the lever tilts 31.0°, and the reports reach 141.4% of full travel.', {release: 1, gate: 1}),
  ],
  deeper: [
    {title: 'Potentiometers and Hall sensors', body: 'Most analog sticks use potentiometers, whose wipers wear as they rub along their tracks. Hall-effect sensors, which measure a magnet’s field without touching it, came back in the 2020s as a sturdier choice.'},
    {title: 'Return precision', body: 'The module’s datasheet promises the lever returns within 5° of center, and rates it for 2,000,000 movements. A game’s dead zone has to cover that 5°, which is 21.7% of the 23° travel.'},
    {title: 'Drift', body: 'If a controller takes its neutral position while the stick is held off center, or the stick wears, the game reads the center as a push and the character walks by itself. Players call it drift.'},
  ],
  misconception: 'A spring does not return a stick exactly to center. It returns it until friction can hold it, and that can be several degrees away.',
  limits,
  sources: [sources.alps, sources.stick, sources.potentiometer, sources.xinput],
  quiz: {
    question: 'Why does a released thumbstick stop a little off center?',
    options: ['Near center the spring’s push is too weak to beat friction in the gimbal.', 'The potentiometers push it away from center.', 'The gate holds it off center.'],
    answer: 0,
    explanation: 'The spring’s push shrinks toward center. Inside the band where it is weaker than friction, nothing moves the lever any further.',
  },
};

export const videoGamesConsoleLesson = {
  simple: 'Why does a button press take tens of milliseconds to show on screen?',
  overview: 'A console does not see a button the moment it is pressed. The controller first waits for its contacts to stop bouncing, then for the console to poll it. The game acts on the report only at the start of its next frame, draws that frame, and sends it to a screen that adds its own lag. Each wait depends on where the press falls between the ticks of clocks that run independently, so the same press can take different times.',
  steps: [
    {title: 'Debounce', body: 'The controller calls the button pressed once its scans agree.'},
    {title: 'Poll', body: 'The console asks for a report at a fixed rate, and the press waits for the next one.'},
    {title: 'Wait for a frame', body: 'The game reads its input at the start of each frame.'},
    {title: 'Draw and display', body: 'Drawing the frame takes one frame, and the screen takes its display lag to show it.'},
  ],
  parts: [
    {name: 'Console', role: 'Polls the controller and runs the game.'},
    {name: 'Monitor', role: 'Shows each frame after its own lag.'},
    {name: 'Press close up', role: 'Contacts, scans, the firmware, polls and the console.'},
    {name: 'Where the time goes', role: 'This press, the average, and the spread.'},
  ],
  tryIt: [
    bounceTrial('Polls', 'Look at the press close up.', 'Polling 125 times a second, the console asks every 8 ms. This press waits 1.2 ms for a poll; over every timing the wait is 4.0 ms on average.'),
    latencyTrial('Poll faster', 'Choose the fastest polling rate.', 'At 1,000 Hz the average wait for a poll falls to 0.5 ms, and the average from touch to screen from 65.6 ms to 62.1 ms.', {polling: 2}),
    consoleTrial('Waiting for a frame', 'Press Play and watch the console’s light.', 'The game reads its input only at the start of each frame, every 16.7 ms: a report waits 8.3 ms on average, then drawing the frame takes another 16.7 ms.'),
    bounceTrial('A frame missed', 'Set debounce to 8 scans.', 'Needing 8 scans, the firmware takes 10.3 ms, and the report reaches the console 16.5 ms after the touch, just after the frame at 15.0 ms. The press waits a whole frame more and shows after 78.3 ms instead of 61.7 ms.', {debounce: 8}),
    latencyTrial('A slow display', 'Set the display lag to 80 ms.', 'The same press now shows 111.7 ms after the touch, and 115.6 ms on average: the display alone adds 50 ms.', {display: 80}),
    latencyTrial('Every timing', 'Look at where the time goes.', 'Over every timing of the controller’s scans, the console’s polls and the game’s frames, a press shows between 51.4 and 78.9 ms after the touch, 65.6 ms on average.'),
  ],
  deeper: [
    {title: 'Polling', body: 'A USB device speaks only when the host asks. Standard USB mice are polled 125 times a second by default, and full-speed devices can be polled up to 1,000 times a second.'},
    {title: 'Frames are the unit', body: 'A game that misses a frame by 0.1 ms acts on the input a full frame later. At 60 frames a second that is 16.7 ms, more than all of this controller’s debouncing and polling together.'},
    {title: 'Display lag', body: 'Displays have been measured taking between 10 and 68 ms to start showing a frame, and televisions that process the picture are among the slowest. Many offer a game mode that cuts the processing.'},
    {title: 'How much is too much', body: 'An input lag below 30 ms is generally considered unnoticeable in a television, about 200 ms from input to visible response is distracting, and the most responsive games reach 67 ms before the display adds its own lag.'},
  ],
  misconception: 'A faster polling rate does not make a game respond much faster. At 60 frames a second, waiting for the next frame and drawing it cost far more than waiting for a poll.',
  limits,
  sources: [sources.hid, sources.lag, sources.displayLag, sources.bounce, sources.xinput],
  quiz: {
    question: 'Which wait usually costs the most between a press and the screen?',
    options: ['The frame: waiting for the next one and drawing it, before the display’s own lag.', 'The USB poll.', 'The ADC conversion.'],
    answer: 0,
    explanation: 'At 125 Hz a poll adds 4.0 ms on average, while a 60 Hz frame adds 8.3 ms of waiting and 16.7 ms of drawing before the display’s own lag.',
  },
};

import {PAD_DEFAULTS, padPlan, CLOCKS, FEEDBACK} from './games-controller-physics.js';

const trial = part => (title, instruction, observe, settings = {}) => { const values = {...PAD_DEFAULTS,...settings}; return {title,instruction,observe,values,initialState:{settings:values,time:0},reset:true,part,isolate:true,view:'front'}; };
const joystickTrial = trial('joystick'), potsTrial = trial('pots'), timelineTrial = trial('timeline'), mapTrial = trial('map'), adcTrial = trial('adc'), bounceTrial = trial('bounce'), latencyTrial = trial('latency'), screenTrial = trial('screen'), consoleTrial = trial('console');

export const sources = {
  xinput: {title: 'Microsoft Learn: getting started with XInput (dead zones)', url: 'https://learn.microsoft.com/en-us/windows/win32/xinput/getting-started-with-xinput'},
  alps: {title: 'ALPS Alpine: RKJXV122400R thumbstick module specifications', url: 'https://tech.alpsalpine.com/e/products/detail/RKJXV122400R/'},
  stick: {title: 'ALPS Alpine: thumbstick travel and return specifications', url: 'https://tech.alpsalpine.com/e/products/detail/RKJXV122400R/'},
  potentiometer: {title: 'ALPS Alpine: voltage-divider and high-impedance ADC connection', url: 'https://tech.alpsalpine.com/e/products/detail/RKJXV122400R/'},
  adc: {title: 'Analog Devices: analog-to-digital conversion and quantization', url: 'https://wiki.analog.com/university/courses/electronics/text/chapter-20'},
  bounce: {title: 'Texas Instruments: debounce a switch', url: 'https://www.ti.com/document-viewer/lit/html/SCEA094'},
  hid: {title: 'USB-IF: Human Interface Device specification, input and output reports', url: 'https://www.usb.org/sites/default/files/hid1_12.pdf'},
  lag: {title: 'Microsoft Learn: frame-based input and button state', url: 'https://learn.microsoft.com/en-us/windows/win32/xinput/getting-started-with-xinput'},
  displayLag: {title: 'Microsoft Learn: frame-based input processing', url: 'https://learn.microsoft.com/en-us/windows/win32/xinput/getting-started-with-xinput'},
  rumble: {title: 'Precision Microdrives: eccentric rotating mass motor characteristics', url: 'https://www.precisionmicrodrives.com/ab-004'},
};

const limits = 'Illustrative wired gamepad with one active stick, one button and two rumble motors. The 23° axial travel and 10 kΩ tracks are representative specifications; the geometry is not a commercial module replica. Assigned dynamics use a linear spring and Coulomb friction along a radial coordinate in yoke-angle space, with 11.5 mN m spring torque at full axial travel, 2.5 mN m friction, generalized inertia 5 × 10⁻⁷ kg m² and one tenth critical damping. These are not manufacturer measurements. The drawn spring illustrates restoring action; its cam geometry does not determine the assigned linear torque law. Tracks span the middle 80% of a 3.3 V divider. An ideal ADC scans every millisecond; midpoint report mapping omits neutral calibration. One assigned contact trace bounces for 2.6 ms. Observed report edges are queued until the next 60 Hz game frame, which takes one frame to draw before the chosen display delay. The first accepted press sends one feedback command with an assigned 1 ms transfer, then motors ramp for 20 ms, hold for 40 ms and brake for 30 ms. Their assigned speed curves and dense weights determine mount force; driver electrical dynamics, carrier mass, hand loading and shell vibration are omitted. Console and monitor are drawn at one fifth scale. The 300 ms observation plays 50 times slower and ends with the button still held. Other buttons, a second stick, wear, noise, wireless links, operating-system scheduling and display scan-out are omitted.';

const experiment = (title, instruction, observe, time, part = 'experiment', settings = {}) => {
  const values = {...PAD_DEFAULTS,...settings}, plan = padPlan(values);
  return {title,instruction,observe,values,initialState:{settings:values,time:typeof time === 'function' ? time(plan) - CLOCKS.start : time},reset:true,part,isolate:true,view:'front'};
};

export const gamesControllerLesson = {
  simple: 'How does a thumbstick move a game character, why does a button response take time, and how does the game send a rumble back?',
  overview: 'Two potentiometers turn stick direction into voltages. An ADC turns those voltages into numbers, while the controller checks whether a button is pressed. The console reads reports, applies a dead zone and updates the game. A displayed ring marks each press the game received. A return command drives two off-center motor weights. Follow the entire path, then compare drift, duplicate presses, timing and feedback.',
  steps: [
    {title:'Turn two sensors',body:'Tilting the lever turns perpendicular yokes and their potentiometer wipers. Each wiper divides a fixed supply voltage according to its angle.'},
    {title:'Convert voltage into numbers',body:'The ideal ADC samples both wipers every millisecond. More bits make smaller voltage steps. Two signed axis values and a button bit form the illustrative report.'},
    {title:'Wait for stable contact',body:'The button bridges a pulled-up input to ground. Its input changes from 3.3 V to 0 V. Several agreeing scans reject short contact bounces.'},
    {title:'Send the latest report',body:'The host asks 125 times a second by default. Faster polling shortens this wait, but the game still processes input on its own frame clock.'},
    {title:'Move and display',body:'The game ignores small stick readings inside its dead zone and limits maximum speed. It draws the next frame, then the monitor adds the selected display delay.'},
    {title:'Send feedback back',body:'The first accepted press triggers a motor command. Off-center weights rotate, pulling on the motor mounts in a changing direction. The two assigned speeds give different rumble frequencies.'},
  ],
  parts: [
    {name:'Controller shell',role:'Hollow panels and supports hold the mechanisms.'},
    {name:'Thumbstick and sensors',role:'A supported gimbal, return spring and two voltage-divider potentiometers.'},
    {name:'Button and contacts',role:'A guided cap presses a carbon pill onto two board pads.'},
    {name:'Circuit board',role:'Power regulation, input sampling, debounce and reports.'},
    {name:'Rumble feedback',role:'A driver, wiring and two mounted eccentric-mass motors.'},
    {name:'USB cable',role:'Carries power, input reports and output commands.'},
    {name:'Console and monitor',role:'Show the delayed result of the controller input.'},
    {name:'Measurements',role:'Separate readable views of motion, ADC steps, bounce and timing.'},
  ],
  tryIt: [
    experiment('Run the complete experiment','Press Play from the ready state.','Watch the stick return, the button close, the report reach the game, the weights turn and a ring appear on screen.',0),
    experiment('Let go of the stick','Inspect the first overshoot, then resume to the resting position.','With the assigned dynamics, the stick swings 8.13° past center and settles 2.72° left after 26.4 ms. Its report is −3,880, or 11.8% of full travel, inside the 24% dead zone.',p=>p.motion.run.half,'stick-mechanism'),
    experiment('Ease it back','Inspect the stick after a slow return.','The chosen friction model holds it at 5.00° from center. Its 21.9% report remains inside the 24% dead zone. This is one assigned example, not a rule for every controller.',.14,'stick-mechanism',{release:2}),
    experiment('A smaller dead zone','Inspect the screen after the eased stick has stopped. Resume to watch the creep.','The unchanged resting report is 21.9%, above the 20% dead zone. The character keeps moving at 0.12 m/s even though the stick is untouched.',.27,'screen',{release:2,deadzone:20}),
    experiment('The diagonal','Inspect the round gate map at release.','Each yoke turns 16.7°, and together they report 102.7% of full magnitude. Clamping at 32,767 prevents diagonal motion from exceeding full speed.',.02,'map',{release:1}),
    experiment('A square gate','Compare the square outline and diagonal starting point.','Both yokes reach 23°, giving 141.4% report magnitude. The game still limits character speed; the mechanical gate allows a greater diagonal tilt.',.02,'map',{release:1,gate:1}),
    experiment('Read the sensor voltages','Inspect both wipers after the stick settles.','The X divider settles below its center voltage. Read its voltage, ADC code and signed report together. Track current remains constant as the wiper moves.',.14,'pots'),
    experiment('Fewer bits','Inspect the coarse conversion steps around the resting angle.','At 8 bits, one ADC step is 0.225° of tilt and about 320 in the report, four times coarser than 10 bits.',.14,'adc',{bits:0}),
    experiment('More bits','Compare with the finer conversion steps.','A 12-bit converter has sixteen times as many codes as an 8-bit converter. Finer quantization does not remove mechanical friction or button delay.',.14,'adc',{bits:2}),
    experiment('Contact bounce','Inspect the small contact gap during the assigned bounce.','The cap is down but the carbon pill briefly separates from the pads. The raw input is high again; the five-scan filter has not accepted the press.',.0615,'button'),
    experiment('No debounce','Inspect the complete contact and report traces.','Single-scan decisions count 2 presses from one physical press here. At 1,000 Hz the console receives both. Across uniformly distributed clock phases, duplicate presses occur in 50% of cases for this assigned trace.',.16,'bounce',{debounce:1,polling:2}),
    experiment('Where the time goes','Read the complete timing breakdown.','This press takes 61.7 ms: 7.3 ms debouncing, 1.2 ms waiting for a poll, 6.5 ms waiting for a frame, 16.7 ms drawing and 30 ms display delay.',.16,'latency'),
    experiment('Poll faster','Compare the timing distribution with the default polling rate.','Faster polling cuts average report wait. This particular press still catches the same game frame, so its screen time is unchanged; the average over all clock phases improves.',.16,'latency',{polling:2}),
    experiment('Wait for more scans','Inspect the longer debounce and the missed frame.','Eight agreeing scans reject bounce but deliver this press after an earlier frame has started. Its visible response moves to the following frame.',.18,'latency',{debounce:8}),
    experiment('A slower display','Inspect the screen while this frame is still delayed, then resume.','The game has received the press and sent feedback, but the ring is not visible yet. Increasing display delay does not delay the motor command.',.14,'experiment',{display:80}),
    experiment('Follow rumble feedback','Inspect the motor weights during the steady part of the pulse.','The large weight turns at the assigned 80 Hz and the small one at 150 Hz. Force arrows rotate with the weights; their lengths also account for acceleration during ramps.',p=>p.press.frame+FEEDBACK.transfer+.03,'feedback'),
    experiment('Turn feedback off','Compare the same moment with the motors disabled.','The weights remain stationary. Stick readings, button reports and screen timing are unchanged.',p=>p.press.frame+FEEDBACK.transfer+.03,'feedback',{rumble:0}),
    experiment('Read the final result','Inspect the end of the observation, then press Play to repeat.','The stick and motor pulse have settled. The button remains held. The result reports the resting dead-zone outcome and measured press latency; this is the end of the observation, not a button release.',.32),
  ],
  deeper: [
    {title:'Voltage, not changing track current',body:'Each 10 kΩ track has 3.3 V across its ends, so it carries 0.33 mA regardless of wiper position in this ideal circuit. A high-impedance ADC senses the divider voltage without drawing appreciable wiper current.'},
    {title:'A tolerance does not define a spring',body:'A manufacturer’s travel, operating-torque and return-position specifications do not uniquely determine friction, stiffness, inertia or damping. The motion here uses an explicitly assigned reduced model. Some real sticks return close to electrical center; others need calibration or a dead zone.'},
    {title:'Round dead zones and diagonal limits',body:'The game measures the length of the two-axis report vector, ignores values inside the chosen threshold, and rescales the rest. It clamps the magnitude before rescaling, so a square gate’s diagonal cannot make the character move faster.'},
    {title:'Quantization and calibration',body:'The ideal ADC has equally spaced voltage bins. Mapping each bin midpoint to a signed report can leave a small nonzero neutral reading. Commercial controllers may calibrate center and endpoints; this experiment deliberately omits that calibration.'},
    {title:'Events can be lost between samples',body:'The example queues changes observed in reports until the game reads them. Short transitions that happen entirely between polls are missed. An API that exposes only the latest state can also miss changes between game frames. The illustrated queue is an explicit choice.'},
    {title:'Timing depends on phase',body:'Scans, polls and game frames have different phases. The histogram integrates all uniformly distributed phases for the chosen fixed bounce trace. Its range and average describe this pipeline, not universal measurements of games or displays.'},
    {title:'Rumble is a return path',body:'The game sends an output command; the motor driver supplies electrical power. At steady speed, each eccentric weight produces a rotating force with magnitude m r ω². Ramping adds a tangential force. Force does not specify how far the held controller moves; that also depends on its mass, stiffness, damping and the hands holding it.'},
  ],
  misconception: 'A larger dead zone can hide small unwanted reports, but it also discards small intentional movements. More ADC bits, faster polling and stronger debounce each change a different stage of the input path.',
  limits,
  sources:[sources.alps,sources.xinput,sources.adc,sources.bounce,sources.hid,sources.rumble],
  quiz:{question:'Why can turning up display delay postpone the ring without postponing the rumble command?',options:['The game sends feedback when it accepts the press, before the delayed frame is visible.','The motors read the monitor’s pixels.','The controller skips debounce whenever rumble is enabled.'],answer:0,explanation:'Input reaches the game first. The return command and the rendered frame then follow separate paths with different delays.'},
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

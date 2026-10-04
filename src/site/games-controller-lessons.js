import {PAD_DEFAULTS, padPlan, CLOCKS, FEEDBACK} from './games-controller-physics.js';

export {videoGamesConsoleLesson} from './video-games-console-lesson.js';

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

const joystickExperiment = (title, instruction, observe, time, part = 'rig', overrides = {}) => {
  const values = Object.fromEntries(['release', 'gate', 'bits', 'deadzone'].map(key => [key, overrides[key] ?? PAD_DEFAULTS[key]]));
  return {title, instruction, observe, values, initialState: {settings: values, time: typeof time === 'function' ? time(padPlan(values)) - CLOCKS.start : time}, reset: true, part, isolate: true, view: 'front'};
};

export const joystickLesson = {
  simple: 'How do two sensors measure one thumbstick, and why can the same resting position produce different game commands?',
  overview: 'Follow a thumbstick from its supported pivot to two voltage-divider sensors and a powered ADC board. Releasing the stick lets the assigned spring and friction model bring it to rest. The electronics sample the voltages, produce two numbers and apply a dead zone. Compare the mechanical position with the command that reaches the game.',
  steps: [
    {title: 'Limit the tilt', body: 'The ball pivot supports the lever. A round gate limits total tilt to 23°. The alternative square gate permits both yokes to reach 23°, allowing more diagonal tilt.'},
    {title: 'Resolve two directions', body: 'Perpendicular slotted yokes turn with the two components of tilt. Each shaft is supported and coupled to its own potentiometer wiper.'},
    {title: 'Divide the voltage', body: 'Both 10 kΩ tracks have 3.3 V across their fixed ends. Moving a wiper changes its output voltage while total track current stays constant.'},
    {title: 'Sample and digitize', body: 'The two center terminals connect to separate ADC inputs. The ideal converter samples every millisecond; more bits divide the voltage range into finer bins.'},
    {title: 'Return and interpret', body: 'The assigned spring restores the lever while friction can hold it off center. The game ignores reports inside its chosen dead zone and rescales the remaining range.'},
  ],
  parts: [
    {name: 'Lever, frame and spring', role: 'A supported pivot, two slotted yokes, a finite gate and a spring-loaded return plate.'},
    {name: 'Potentiometers', role: 'Two resistive tracks and moving wipers measure the yoke angles.'},
    {name: 'Test board and supports', role: 'Hold the module and ADC together on an illustrative fixture.'},
    {name: 'Insulated sensor wiring', role: 'Separate supply, ground and the two sensor signals.'},
    {name: 'Two-channel ADC', role: 'Turns sampled voltages into numbers.'},
    {name: 'Measurements', role: 'Motion, gate map, conversion steps and the resulting game command.'},
  ],
  tryIt: [
    joystickExperiment('Release and follow the signal', 'Press Play to release the stick, then inspect any part without changing the moment.', 'The lever, yokes, wipers and spring move together. Voltage, ADC code, report and game command update at their stated clocks.', 0),
    joystickExperiment('One axis at the gate', 'Inspect the held lever just before it moves back.', 'The X yoke is at 23° while the Y yoke remains at 0°. The two wiper voltages differ even though there is only one lever.', .02, 'stick-mechanism'),
    joystickExperiment('Two yokes on a diagonal', 'Compare the same round gate with a diagonal release.', 'Total lever tilt is still 23°, but each yoke turns about 16.7°. Both wipers move.', .02, 'stick-mechanism', {release: 1}),
    joystickExperiment('A square gate', 'Inspect the square opening and the lever at its corner.', 'Both yokes reach 23°, so total lever tilt reaches about 31°. The shape of the mechanical stop changes the reachable directions.', .02, 'joystick', {release: 1, gate: 1}),
    joystickExperiment('The return spring', 'Inspect the loaded spring and plate, then press Play.', 'The lever foot stays in contact with the moving plate. The assigned restoring torque is about 11.5 mN m at full axial travel; this value is not measured from the drawn spring.', .02, 'return-spring'),
    joystickExperiment('The first overshoot', 'Inspect the first turning point after a sharp release.', 'With these assigned dynamics, the stick has swung 8.13° past center after 13.2 ms. Resume to see friction and damping bring it to rest.', p => p.motion.run.half, 'stick-mechanism'),
    joystickExperiment('Rest after a sharp release', 'Inspect the settled position and the two sensors.', 'The model rests 2.72° to the left. The X output is below its neutral voltage; resting off center is a modeled outcome, not a rule for every real stick.', .14, 'stick-mechanism'),
    joystickExperiment('Ease the stick back', 'Compare the end of a slow hand-guided return.', 'The chosen friction model holds the lever at 5.00° on the original side. The way it was released changed its resting position.', .14, 'stick-mechanism', {release: 2}),
    joystickExperiment('Voltage without changing track current', 'Inspect both wipers after the sharp release has settled.', 'The X divider is about 1.494 V while Y remains at 1.650 V. Each complete track still carries 0.33 mA; its moving contact measures a voltage.', .14, 'pots'),
    joystickExperiment('Coarser conversion', 'Inspect the conversion staircase with 8 bits.', 'There are 256 possible codes. Around the resting angle, each step spans about 0.225° of yoke rotation.', .14, 'adc', {bits: 0}),
    joystickExperiment('Finer conversion', 'Compare the same resting position with 12 bits.', 'There are 4,096 possible codes, sixteen times as many as at 8 bits. Smaller steps do not change the mechanical resting angle.', .14, 'adc', {bits: 2}),
    joystickExperiment('Limit the diagonal command', 'Read the command while the stick is held at the square gate corner.', 'The two-axis report can exceed 100% in magnitude, but the game command is clamped to 100%. The arrow shows a command, not a force.', .02, 'response', {release: 1, gate: 1}),
    joystickExperiment('Ignore an unwanted resting report', 'Inspect the response after easing the stick back.', 'The resting report is about 21.9% of full magnitude. A 24% dead zone suppresses it, leaving no commanded movement.', .14, 'response', {release: 2}),
    joystickExperiment('Reduce the dead zone', 'Compare the same resting stick with a 20% threshold.', 'The report now falls outside the threshold. A small command remains after rescaling, even though the stick has not moved.', .14, 'response', {release: 2, deadzone: 20}),
    joystickExperiment('Remove the dead zone', 'Compare again with a zero threshold.', 'The unchanged resting report now gives about 21.9% command. A dead zone filters input; it does not recenter the mechanism.', .14, 'response', {release: 2, deadzone: 0}),
    joystickExperiment('Trace the powered inputs', 'Inspect the test board and its connections.', 'Both fixed track ends reach supply and ground, while the two center terminals reach separate ADC inputs. Insulated wires use different heights at crossings.', .14, 'test-electronics'),
    joystickExperiment('Read the final result', 'Inspect the completed observation, then press Play to repeat.', 'The result names the resting tilt and remaining game command. Replay keeps the selected settings and starts again from the held gate position.', .32),
  ],
  deeper: [
    {title: 'Tolerance is not a required offset', body: 'The cited module specifies a ±5° return tolerance. That is an allowed bound, not a promise to stop five degrees away. It does not determine stiffness, friction, inertia or damping. The return dynamics in this demonstration are assigned separately.'},
    {title: 'Mechanical center and electrical center', body: 'A centered lever need not map to exactly zero after quantization and calibration. This ideal model maps ADC bin midpoints without center calibration; real calibration and sensor variation can change the relationship.'},
    {title: 'A dead zone is a tradeoff', body: 'A threshold can suppress unwanted small reports, but also discards small intentional movements. Microsoft recommends testing multiple controllers because the required dead zone varies between units. No single angular tolerance fixes the correct threshold for every controller.'},
    {title: 'Sampling holds an older measurement', body: 'The wipers move continuously. The ADC samples every 1 ms, the example host receives a report every 8 ms and the game updates its command at 60 Hz. The motion chart separates true tilt, received reports and game-frame samples.'},
    {title: 'Voltage-divider loading', body: 'The ideal ADC draws no wiper current. A real input that loads the divider changes its output voltage. The cited module is intended for a high-impedance ADC connection; this lesson does not simulate that loading or electrical noise.'},
  ],
  misconception: 'More ADC bits improve voltage resolution. They do not change the spring, remove friction or guarantee a centered resting position.',
  limits: 'Illustrative potentiometer thumbstick and powered test fixture, not a commercial module replica or production schematic. The 23° axial travel and 10 kΩ tracks use representative specifications. The spring, Coulomb friction, inertia and damping are assigned reduced dynamics along a radial path in yoke-angle space; the drawn cam and coil do not determine that torque law. Round and square gates, supported shafts, wiper contact and spring contact are modeled geometrically. Ideal 3.3 V tracks span the middle 80% of supply; loading, noise, wear, calibration and a center-push switch are omitted. Three prescribed releases compare axial, diagonal and eased motion. The ADC samples every 1 ms, reports arrive every 8 ms and a 60 Hz game clock applies the selected dead zone. The response arrow is normalized game command, not force or physical displacement. The 300 ms observation plays 50 times slower. External supply electronics and the rest of the controller are omitted; inspect the Games controller lesson for button and rumble mechanisms.',
  sources: [sources.alps, sources.adc, sources.xinput],
  quiz: {
    question: 'Why can a finer ADC still report an off-center stick after release?',
    options: ['It measures the resting position more finely without changing the mechanical return.', 'Its extra bits push the lever away from center.', 'A finer ADC disables the return spring.'],
    answer: 0,
    explanation: 'Resolution changes the size of voltage steps. The same assigned spring and friction still determine the resting lever position.',
  },
};

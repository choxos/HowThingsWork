import {positioningDefaults} from './three-axis-physics.js';

const trial = (title, observe, values = {}, part = 'system', view = 'reset') => ({title, instruction: 'Set up this experiment, then press Play. Pause or step to inspect the motion.', observe, values: {...positioningDefaults, ...values}, reset: true, part, isolate: ['step-grid','motion-profile'].includes(part), view});

export const threeAxisLesson = {
  simple: 'How does a printer reach a point in three dimensions?',
  overview: 'A coordinate needs three linked motions. The head slides left and right for X, the plate moves backward and forward for Y, and a screw lifts the whole gantry for Z. Choose a target and watch the cold nozzle approach its orange marker. The controller coordinates the motor commands along one path. Then compare coarse and fine steps, or add play to the horizontal coupling and see why a correct motor count can still leave the head in the wrong place.',
  steps: [
    {title: 'Choose a point on the plate', body: 'X and Y locate a point across the plate; Z gives its height above it. The colored arrows and orange target are virtual coordinate guides.'},
    {title: 'Share one motion profile', body: 'The controller accelerates, travels and brakes along a common reference path. Each axis covers its own share of that distance.'},
    {title: 'Send motor increments', body: 'The controller converts each coordinate into motor commands. Whole steps or smaller microstep commands approximate the path, and the final commands arrive at its endpoint together.'},
    {title: 'Turn rotation into travel', body: 'Closed timing belts move the head and plate. The rotating screw lifts its captive nut and the gantry; guide rods prevent unwanted rotation.'},
    {title: 'Compare command and result', body: 'The nozzle position follows the mechanism. Rounding limits the commanded endpoint, and clearance in the X coupling can separate head position from the belt command after a reversal.'},
  ],
  parts: [
    {name: 'Controller and motors', role: 'Turn the requested coordinate and motion profile into a coordinated sequence of commanded increments.'},
    {name: 'X belt and head carriage', role: 'Carry the head left and right while two rails constrain its motion.'},
    {name: 'Y belt and plate', role: 'Move the plate opposite to the nozzle Y coordinate measured on it.'},
    {name: 'Z screw, nut and gantry', role: 'Turn screw rotation into vertical lift while guide rods keep the gantry aligned.'},
    {name: 'Slotted X coupling', role: 'Makes adjustable horizontal play visible. The belt pin must cross its clearance before moving the head the other way.'},
    {name: 'Target and coordinate guides', role: 'Show the requested point and commanded path in plate coordinates. These are annotations, not printed material.'},
    {name: 'Magnified command grid', role: 'Shows requested X between available endpoint commands. Its labeled window changes size with step mode.'},
    {name: 'Speed profile', role: 'Shows the common reference speed and the current time through acceleration, cruising and braking.'},
  ],
  tryIt: [
    trial('Coordinate all three axes', 'The head moves right, the plate moves backward and the gantry rises together. The nozzle approaches the plate-relative target. Small final X/Y differences are command rounding.'),
    trial('Move only X', 'Only the head carriage and its belt move. Plate travel and gantry lift stay at zero.', {targetX: 6, targetY: 0, targetZ: .2}, 'system', 'front'),
    trial('Move only Y', 'The plate moves backward while the head stays fixed in the room. Relative to the moving plate, the nozzle travels in positive Y.', {targetX: 0, targetY: 6, targetZ: .2}, 'system', 'side'),
    trial('Move only Z', 'The screw turns and the captive nut raises the entire X gantry. The head does not slide along its rails and the plate does not move.', {targetX: 0, targetY: 0, targetZ: 6}, 'system', 'front'),
    trial('Request a point between whole steps', 'The orange requested X lies between command lines. The nearest whole-step command is about 8.85 μm above the request. The head reaches that command when there is no coupling play.', {targetX: 6.4, targetY: 4.2, targetZ: 4.2, microsteps: 1}, 'step-grid', 'front'),
    trial('Use sixteenth-step commands', 'The same request now has sixteen times finer command spacing. Its X endpoint error is about −0.58 μm. The magnified window is also sixteen times narrower; this is command resolution, not a promise about real accuracy.', {targetX: 6.4, targetY: 4.2, targetZ: 4.2, microsteps: 16}, 'step-grid', 'front'),
    trial('Return with a tight coupling', 'This X-only move takes the head out and brings the belt back to its initial count. With no play, the nozzle returns to its starting point too.', {targetX: 6, targetY: 0, targetZ: .2, roundTrip: 1}),
    trial('Return with coupling play', 'The same X-only move brings the belt back to zero but leaves the head 0.5 mm to its right. Use Inspect the reversal, then step: the pin crosses the slot while the head initially stays still.', {targetX: 6, targetY: 0, targetZ: .2, roundTrip: 1, play: .5}),
    trial('Accelerate gently', 'The sloping ramps take most of this move. The reference profile never reaches the requested speed before it must brake.', {speed: 5, acceleration: 1}, 'motion-profile', 'front'),
    trial('Accelerate more quickly', 'The same requested move reaches its speed limit, holds it for a while, then brakes. Compare the duration with the gentle-acceleration experiment.', {speed: 5, acceleration: 10}, 'motion-profile', 'front'),
    trial('Make a very short move', 'Even with the higher acceleration, this short move has no cruising section. Its triangular speed profile peaks far below the requested speed.', {targetX: .1, targetY: .1, targetZ: .2, speed: 5, acceleration: 10}, 'motion-profile', 'front'),
    trial('Move to the opposite side', 'The X head goes left and the Y plate goes forward, while Z still rises. Changing coordinate signs reverses the appropriate drives.', {targetX: -6, targetY: -4, targetZ: 4}),
  ],
  deeper: [
    {title: 'The coordinate belongs to the plate', body: 'A printer needs the nozzle position relative to its work. In this arrangement the nozzle has no separate forward-back slide. Moving the plate backward puts the nozzle farther forward on the plate. A stationary observer therefore sees opposite signs for plate travel and relative nozzle Y.'},
    {title: 'How the axes cooperate', body: 'A linear move uses one fraction of the planned distance for every axis. An axis with twice as far to go receives twice the travel over that move. The reference speed is limited when its vertical component would exceed the chosen Z limit. Real commands occur in discrete increments, so the motor path is a small staircase around the continuous reference.'},
    {title: 'Where command spacing comes from', body: 'Distance per motor revolution divided by commanded increments per revolution gives linear spacing. This miniature teaching machine uses 200 full steps per turn, belt pulleys carrying 7.539822 mm per turn, and a screw with 2 mm lead. Sixteenth stepping multiplies the command count by sixteen. These are this model’s dimensions and settings, not universal printer specifications.'},
    {title: 'Resolution is not accuracy', body: 'Microstepping offers more commanded positions and smoother motion. It does not establish where a loaded motor will actually settle. Construction tolerances, current regulation and load also matter. Here the rotor follows every commanded increment exactly, so the displayed rounding error is only one possible contribution to real positioning error.'},
    {title: 'Why the slot loses motion', body: 'The coupling begins against the face that drives positive X. On reversal, the pin moves across the horizontal clearance before contacting the other face. The carriage does not slide along X during that interval; Y and Z commands can still continue. A positive X move followed by a return therefore leaves the head displaced by the play, provided the excursion exceeds that play. This is an explicit teaching coupling, not a claim that every timing belt has such slack.'},
    {title: 'Reading the two diagrams', body: 'The command grid magnifies eight X increments around the active requested endpoint. Its full width is labeled in micrometers. The speed plot uses simulated seconds and the reference path speed; its orange cursor marks current time. A triangle means the move brakes before reaching the requested speed. Both diagrams are virtual views of the same active motion model.'},
    {title: 'What the book and this model show', body: 'The book shows a side-to-side head, a forward-back plate and a screw lift, driven by stepper motors. Its horizontal drives use chains and cogs. This teaching variant uses closed timing belts and pulleys, with the same rotation-to-travel relationship. The nozzle stays cold and no plastic is deposited during this positioning lesson.'},
  ],
  misconception: 'A correct command count does not prove that a real tool reached the requested point. Command rounding, mechanical play and unmodeled motor or load errors can separate those positions.',
  limits: 'Illustrative miniature Cartesian printer with calibrated initial coordinates. All motors follow commanded steps exactly. The X slot has prescribed horizontal clearance; no backlash is imposed on the gravity-loaded Z screw. No homing, motor torque or current, lost steps, vibration, belt stretch, feedback correction, heat or extrusion is simulated. Acceleration is a reference envelope, with instantaneous ideal step transitions and abrupt reference acceleration changes. Editing a target, speed or acceleration stops and replans from the current pose. Changing step mode, coupling play or move type restarts from the initial pose. Playback runs at half real time. Virtual diagrams have their own labeled scales.',
  sources: [
    {title: 'Marlin: G0 and G1, coordinated linear moves', url: 'https://marlinfw.org/docs/gcode/G000-G001.html'},
    {title: 'Prusa: motor steps and travel calculator', url: 'https://blog.prusa3d.com/calculator_3416/'},
    {title: 'Analog Devices: microstepping, resolution and accuracy', url: 'https://www.analog.com/en/resources/analog-dialogue/articles/mastering-precision-understanding-microstepping.html'},
  ],
  quiz: {
    question: 'Why does the plate move backward when the requested nozzle Y is positive?',
    options: ['Nozzle coordinates are measured relative to the plate, so moving the plate backward moves the nozzle forward on it.', 'The controller accidentally reverses the Y motor.', 'The Z screw changes the direction of the plate.'],
    answer: 0,
    explanation: 'The head stays at the same forward-back position in the room. The plate moves underneath it, so their relative Y displacement has the opposite sign to plate travel.',
  },
};

import {GRINDER_DEFAULTS} from './meat-grinder-physics.js';

const trial = (title, instruction, observe, values = {}) => ({title, instruction, observe, values: {...GRINDER_DEFAULTS, ...values}, reset: true, part: 'system', isolate: false, view: 'front'});
export const meatGrinderLesson = {
  simple: 'How do a crank, a feed screw and a rotating knife make mince, and what happens when your hand cannot keep the requested speed?',
  overview: 'Turn the handle and follow the connected shaft. The screw carries material from the open hopper toward a fixed plate. A knife turns against the inside face of that plate and shears material at its holes. Smaller holes or more resistant feed need greater pressure. Your hand must supply both the conveying work and the knife torque. Compare steady motion, slower motion under load and a complete stall.',
  steps: [
    {title: 'Hold the body still', body: 'The clamp grips both faces of the table. The rear bearing supports the shaft, while the handle turns outside the table edge.'},
    {title: 'Feed an open channel', body: 'Material enters through the hopper opening. Fixed ribs resist its rotation. In this teaching model, a continuously supplied channel carries the same volume forward each turn.'},
    {title: 'Turn the screw', body: 'The 120 mm handle drives the auger directly. Its joined helical flight advances the feed markers one 25 mm pitch per turn without moving the screw itself along the barrel.'},
    {title: 'Build enough pressure', body: 'The feed is represented by a paste with a yield stress and viscosity. It stays still below its threshold. Above that threshold, more flow needs more pressure.'},
    {title: 'Shear against the fixed plate', body: 'The square shaft drives the four-bladed knife. Its flat faces touch the plate at the hole entrances. A locating notch holds the plate stationary; the front collar seats it against the barrel.'},
    {title: 'Match effort to output', body: 'If your hand can supply the needed torque, the crank reaches the requested speed. With less force it turns more slowly. Below the breakaway force it stalls, and no mince or mechanical work is produced.'},
    {title: 'Collect the result', body: 'Run eight seconds and compare collected mass and work. The handle stops at completion. Replay starts a fresh trial, while close-up views preserve the current moment.'},
  ],
  parts: [
    {name: 'Crank handle and grip', role: 'Convert hand force into shaft torque; the grip can turn freely in the hand.'},
    {name: 'Feed auger and drive shaft', role: 'A connected core and flight convey material toward the cutting head.'},
    {name: 'Open hopper and barrel ribs', role: 'Admit feed and oppose its rotation with the screw.'},
    {name: 'Rear bearing and table clamp', role: 'Support the rotating shaft and hold the body fixed.'},
    {name: 'Four-bladed knife', role: 'Turns with the square shaft and shears material against the plate.'},
    {name: 'Perforated plate and retaining collar', role: 'Provide fixed cutting edges and resist flow through the holes.'},
    {name: 'Collection bowl', role: 'Shows the accumulated output of the trial.'},
  ],
  tryIt: [
    trial('Run the medium plate', 'Play with medium resistance feed and the medium plate.', 'At 1 turn/s, the hand needs 4.83 N and the operating pressure is 77.4 kPa. The eight-second trial collects 103.9 g.'),
    trial('Use the fine plate', 'Play with the fine plate and the same requested rate.', 'Its 33 holes are 4.5 mm across. Holding 1 turn/s needs 6.32 N and 114.0 kPa. Enough force keeps the output per turn unchanged.', {plate: 0}),
    trial('Use the coarse plate', 'Play with the coarse plate.', 'The 10 holes are 8 mm across. The pressure falls to 52.9 kPa and the hand force to 3.83 N.', {plate: 2}),
    trial('Increase feed resistance', 'Play with high resistance paste and the medium plate.', 'Greater yield stress and viscosity raise operating pressure to 182.2 kPa and hand force to 9.11 N. These are illustrative paste properties, not a measured meat comparison.', {meat: 2}),
    trial('Reduce feed resistance', 'Play with low resistance paste.', 'Operating pressure falls to 38.7 kPa and hand force to 3.25 N.', {meat: 0}),
    trial('Use a dull knife', 'Play with the dull knife and the medium plate.', 'The same conveying flow and pressure now need 9.00 N at the handle because the knife consumes more torque.', {knife: 1}),
    trial('Complete a demanding run', 'Play with high resistance paste, the fine plate and a dull knife.', 'The requested rate needs 17.03 N. Your 30 N capacity is sufficient, so the crank completes the normal output.', {meat: 2, plate: 0, knife: 1}),
    trial('Slow under limited force', 'Play the demanding setup with only 12 N available.', 'The crank reaches 0.159 turns/s instead of 1. It still works, but collects only 16.5 g in eight seconds.', {meat: 2, plate: 0, knife: 1, force: 12}),
    trial('Stall completely', 'Play the same demanding setup with only 10 N available.', 'The breakaway force is 10.19 N. Ten newtons cannot start flow: the crank stays still, and collected mass and mechanical work remain zero.', {meat: 2, plate: 0, knife: 1, force: 10}),
    trial('Turn twice as fast', 'Request 2 turns/s with the medium plate and enough available force.', 'Output doubles to 207.8 g in eight seconds, but viscous resistance raises required hand force to 5.93 N. Input power rises to 8.94 W.', {rate: 2}),
    trial('Check the work balance', 'Finish the default trial, then compare work and power readings.', 'Pressure flow, screw friction and knife work add up to all work supplied by the hand. Nothing moves after the eight-second run finishes.'),
  ],
  deeper: [
    {title: 'A screw that conveys', body: 'The screw rotates but does not advance. Restraining the feed from co-rotating lets its flight push material axially. The channel volume, pitch and filling fraction determine the assumed volume per turn. Real grinders can slip, leak backward or feed unevenly.'},
    {title: 'Why the knife needs the plate', body: 'The plate supplies stationary cutting edges. The knife shears material on the upstream face as it enters the holes. It does not reach around the front to snip the visible strands. Their later breakup in this view is schematic.'},
    {title: 'Yield pressure is not flowing pressure', body: 'For a round hole, the wall stress is pressure drop times hole diameter divided by four times hole length. A yield-stress paste cannot flow until this stress exceeds its yield stress. Viscosity requires additional pressure once flow starts.'},
    {title: 'Where the work goes', body: 'The hand supplies pressure times displaced volume, knife torque times rotation, and screw friction. Using the actual displaced channel volume keeps this balance consistent even though the channel is only partly full. The blue effective-push arrow is pressure work per turn divided by the pitch, not the load on the whole plate.'},
    {title: 'A force limit can slow a machine', body: 'Available hand torque sets a maximum operating pressure after allowing for knife torque and screw losses. That pressure determines how much paste can pass through the holes. If it cannot sustain the target flow, the crank settles at a lower rate; below the yield threshold it stops.'},
    {title: 'From the source to this model', body: 'The Way Things Work Now, page 67, explains the mincer using the combined action of the crank and auger and shows a rotating cutter against a fixed plate. Dimensions, paste properties, force limits and work calculations here are teaching choices beyond that spread.'},
  ],
  misconception: 'More available hand force does not automatically make more mince. Once the requested rate is reached, unused force capacity changes nothing. It matters when the existing load would slow or stall the handle.',
  limits: 'Illustrative hand grinder, not an appliance rating or food-processing prediction. Handle radius 120 mm; screw pitch 25 mm, root diameter 20 mm and flight diameter 50 mm in a 52 mm bore; constant channel filling 30%; density 1050 kg/m³. A 6 mm plate has 4.5, 6 or 8 mm holes, with their number rounded down from a 25% open-area target. Low/medium/high paste means yield stress 5/10/20 kPa and plastic viscosity 100/200/600 Pa·s; these are invented teaching values, not measured meats. Steady, no-slip Bingham pipe flow omits entrance effects in short holes. Screw efficiency uses friction 0.3 at the mean flight radius; knife torque is fixed at 0.2 or 0.7 N·m. Constant, already primed feed; no inertia, backflow, compression, heat or texture prediction. Feed spheres and the collected pile are visual markers, not deformable meat. Front strands break every 35 mm for display, independently of the actual upstream cutting. Clamp and collar thread engagement is simplified. A real grinder must follow its manufacturer’s instructions; never feed it with fingers.',
  sources: [
    {title: 'FAO: Small-scale sausage production, grinder mechanism', url: 'https://www.fao.org/4/x6556e/x6556e01.htm'},
    {title: 'Weston manual grinder: assembly, bearing, knife, plate and clamp', url: 'https://m.media-amazon.com/images/I/C1BiNCMLd7S.pdf'},
    {title: 'Duque-Daza and Alexiadis (2021), section 5.2.1: Bingham pipe flow', url: 'https://doi.org/10.3390/chemengineering5030061'},
  ],
  quiz: {
    question: 'You keep the requested crank rate but fit a finer plate. What determines whether output stays the same?',
    options: ['Whether your hand can supply the higher force needed at that rate.', 'The number of holes alone, regardless of hand force.', 'Only the knife speed; resistance never matters.'],
    answer: 0,
    explanation: 'With enough force, the imposed volume per turn and requested rate stay unchanged. A force-limited hand produces a slower rate or a complete stall, so actual output can fall.',
  },
};

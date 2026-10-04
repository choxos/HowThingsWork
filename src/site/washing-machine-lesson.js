import {WASHER_DEFAULTS} from './washing-machine-physics.js';

const trial = (title, instruction, observe, time, part = 'machine', settings = {}, isolate = false, view = 'front') => {
  const values = {...WASHER_DEFAULTS, ...settings};
  return {title, instruction, observe, values, initialState: {time, settings: values}, reset: true, part, isolate, view};
};

export const washingMachineLesson = {
  simple: 'How can one drum wash with a slow tumble, rinse away detergent, and spin out water while its cabinet stays put?',
  overview: 'Follow water from the inlet valve and detergent drawer into a suspended tub. Inside it, a motor turns a perforated drum. Slow tumbling lifts and drops the laundry through the bath. The pump drains that bath, then a faster spin extracts some of the water still held in the fabric. Fresh-water rinses dilute the remaining detergent. Springs, counterweights and dampers control the vibration from a lopsided load. The program ends with braking, settling and an unlocked door.',
  steps: [
    {title: 'Fill and lock', body: 'The door locks. The inlet valve opens and water flushes detergent from the drawer into the tub. A level signal ends filling.'},
    {title: 'Warm the bath', body: 'The element below the drum heats the well-mixed bath to the chosen temperature. The cold program leaves the heater off.'},
    {title: 'Lift and drop', body: 'The motor turns the shaft, drum and lifters together. At the slow washing speed, laundry rises and falls through the bath.'},
    {title: 'Drain the free water', body: 'The drum slows to a stop. Water runs through the sump and trap into the pump, which sends it up the drain hose.'},
    {title: 'Extract retained water', body: 'The drum accelerates. Laundry stays against the wall while water passes through the perforations into the tub and out through the running pump.'},
    {title: 'Dilute and repeat', body: 'After braking, a fresh fill mixes with water retained by the fabric. Rinsing and another extraction remove more of the remaining detergent.'},
    {title: 'Stop before unlocking', body: 'The final spin brakes smoothly. The suspension settles, the pump stops and the door unlocks. Read the retained water, detergent, water use and energy totals.'},
  ],
  parts: [
    {name: 'Cabinet and loading door', role: 'The fixed frame, window, flexible seal and interlock contain and protect the moving mechanism.'},
    {name: 'Tub, drum and laundry', role: 'The watertight outer tub holds the bath; the perforated inner drum and lifters move the fabric.'},
    {name: 'Motor and drum drive', role: 'A direct-drive rotor, continuous shaft, sealed bearings and drum spider transfer rotation.'},
    {name: 'Suspension', role: 'Springs connect the tub to upper anchors. Telescoping dampers connect it to the base.'},
    {name: 'Fill, heat and drain circuit', role: 'Valve, drawer, hoses, heater, sensors, trap and pump form one connected water circuit.'},
    {name: 'Control and sensing', role: 'The controller uses level, temperature and lock signals to sequence the program.'},
    {name: 'Bunched part of the load', role: 'The gold fabric marker makes the selected imbalance visible.'},
    {name: 'Program and suspension charts', role: 'Separate close-ups reveal speed changes, heating and resonance.'},
  ],
  tryIt: [
    trial('Run a complete program', 'Press Play and follow the full cycle.', 'The drum first tumbles, then drains and spins between rinses. At completion it stops and the door unlocks.', 0),
    trial('Follow the incoming water', 'Inspect the water circuit during the wash fill.', 'Flow markers travel from the valve through the drawer hose. Supplied water is split between soaked fabric and free bath water.', 40, 'water-circuit'),
    trial('Heat the wash', 'Inspect the element during heating.', 'The red element is drawing power. Temperature rises toward 40 °C while the drum tumbles.', 500, 'heater'),
    trial('Lift and drop the laundry', 'Watch the drum at its 50 rpm wash speed.', 'The cloth markers leave the wall and fall through the bath. The drum, shaft and motor rotor stay connected.', 1259, 'washing'),
    trial('Drain before spinning', 'Follow used wash water through the sump, trap and pump.', 'The drum has stopped. Free water leaves through the raised outlet hose; the fabric still retains water.', 2069, 'water-circuit'),
    trial('Pin the laundry to the wall', 'Watch the extraction after the wash.', 'At 800 rpm the laundry circles with the drum. Retained water falls as the pump removes water extracted through the holes.', 2179, 'washing'),
    trial('Rinse with fresh water', 'Inspect the first rinse.', 'Fresh water has diluted the detergent carried over from the wash. The next drain and spin remove more of it.', 2390, 'water-circuit'),
    trial('Finish a cold wash', 'Read the completed program with heating disabled.', 'Heater energy is zero. Motor and pump energy remain, and the bath temperature can drift toward the warmer room.', 1e6, 'program-chart', {temperature: 15}, true),
    trial('Use one rinse', 'Read the final detergent and water totals.', 'One rinse uses less water but leaves more detergent than the default two-rinse program.', 1e6, 'machine', {rinses: 1}),
    trial('Use three rinses', 'Compare the final totals with one rinse.', 'More fresh-water dilution leaves less detergent, using additional water and motor/pump energy.', 1e6, 'machine', {rinses: 3}),
    trial('Finish with a gentle spin', 'Compare the result at 400 rpm.', 'More water stays in the fabric after the slower final spin. The drum still brakes to a stop before completion.', 1e6, 'machine', {spin: 400}),
    trial('Finish with a faster spin', 'Compare the result at 1,400 rpm.', 'Higher rotational pressure extracts more pore water. Bound water remains, so spinning does not make the laundry completely dry.', 1e6, 'machine', {spin: 1400}),
    trial('Balance the load', 'Watch a final spin with zero selected imbalance.', 'The balanced cloth markers rotate without an excess gold lump. This ideal symmetric load produces no lateral suspension forcing.', 3460, 'washing', {imbalance: 0}),
    trial('Pass through resonance', 'Inspect the suspension early in the final spin.', 'The drum is near the suspension’s natural frequency. Its recent peak swing is larger than at the eventual high spin speed.', 3290.1, 'suspension'),
    trial('Try a lopsided load', 'Watch 0.5 kg of excess load on one side.', 'The gold marker and larger tub swing reveal the imbalance. This teaching controller limits the requested 1,200 rpm spin to 600 rpm.', 3301, 'washing', {imbalance: 0.5}),
    trial('Brake through resonance', 'Watch the end of the final spin.', 'Speed is falling toward zero. The suspension also passes through resonance while slowing down; the door remains locked.', 3663.5, 'suspension'),
    trial('Inspect the finished result', 'Read the final retained water, detergent and energy.', 'Free bath water is drained, the drum and pump are stopped, and the door is unlocked. Some water remains inside the fabric.', 1e6),
  ],
  deeper: [
    {title: 'One drum, two useful speeds', body: 'At the top of a rotating drum, gravity already pulls laundry inward. At a low speed, gravity can pull a loose piece away from the wall. At high speed, the wall must supply additional inward force to keep it moving in a circle. For a thin layer at this model’s 250 mm radius, the transition is about 60 rpm; the centers of thick folds lie farther inward and need a slightly higher speed.'},
    {title: 'Water leaves through real holes', body: 'The drum holds fabric but lets water pass through its perforations. During spinning, a pressure difference develops through wet fabric. Larger pores release water more readily than small pores, while some water remains bound within fibers. The pore distribution and retained-water values here are assigned examples, not laundry-performance measurements.'},
    {title: 'A rinse is a dilution step', body: 'The fabric carries some detergent solution into each rinse. Mixing it with fresh water reduces the concentration. Draining and spinning then remove some of that diluted solution. Repeating the process reduces the retained detergent again. This ideal mixing calculation does not model detergent binding to fabric or actual stain removal.'},
    {title: 'Resonance appears on the way up and down', body: 'An off-center load produces a rotating force. Near the suspension’s natural frequency, about 203 rpm for the assigned mass and stiffness, the tub can move more strongly. Dampers dissipate energy. At a much higher speed, less of the rotating force reaches the cabinet. Braking passes through this frequency range again.'},
    {title: 'Heating has an energy cost', body: 'Water, fabric and steel all store heat. The model accounts for heater input, warm water sent down the drain, cold water admitted during filling and exchange with the room. Selecting a cold wash eliminates heater input, but not the energy used by the motor and pump.'},
  ],
  misconception: 'A faster spin mainly removes water. It does not replace the slow washing tumble and fresh-water rinses, and it does not dry the fabric completely.',
  limits: 'Illustrative front loader with assigned dimensions, program durations and power demands, not a particular appliance or care recommendation. The bath is ideally mixed; its conserved quantities are resolved at one-second intervals. Soil, foam, detergent adsorption, fabric collisions, drum reversals and sump hold-up are omitted. Spin extraction uses an assigned pore distribution and bound-water floor. Suspension is a linear horizontal oscillator with a fixed 40 kg equivalent moving mass; the selected imbalance is prescribed. A 600 rpm limit above 0.4 kg imbalance illustrates a control response, not manufacturer firmware. The program plays 60× faster; drawn rotation is capped at 120 rpm. Steady-wash cloth markers follow ballistic paths at their center radius, while ramp transitions and slowed suspension movement are explanatory animations. Red on the heater indicates power, not literal glow.',
  sources: [
    {title: 'Bosch front-loader guide: components, sensors and drainage', url: 'https://media3.bosch-home.com/Documents/9001481964_A.pdf'},
    {title: 'OpenStax University Physics Volume 1: centripetal force', url: 'https://openstax.org/books/university-physics-volume-1/pages/6-3-centripetal-force'},
    {title: 'OpenStax College Physics 2e: surface tension and capillary action', url: 'https://openstax.org/books/college-physics-2e/pages/11-8-cohesion-and-adhesion-in-liquids-surface-tension-and-capillary-action'},
    {title: 'OpenStax University Physics Volume 1: forced oscillations', url: 'https://openstax.org/books/university-physics-volume-1/pages/15-6-forced-oscillations'},
    {title: 'OpenStax College Physics 2e: temperature change and heat capacity', url: 'https://openstax.org/books/college-physics-2e/pages/14-2-temperature-change-and-heat-capacity'},
  ],
  quiz: {
    question: 'Why does the washer tumble slowly for washing but spin quickly afterward?',
    options: ['Slow tumbling lifts and drops the fabric; fast spinning extracts retained water.', 'Fast spinning adds detergent to the fabric.', 'The outer tub must rotate faster than the inner drum.'],
    answer: 0,
    explanation: 'Washing uses motion through the bath. Extraction uses rapid rotation to remove some water through the perforated drum, followed by braking and drainage.',
  },
};

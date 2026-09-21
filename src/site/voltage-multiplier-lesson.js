import {MULTIPLIER_DEFAULTS} from './voltage-multiplier-physics.js';

const trial = part => (title, instruction, observe, values = {}) => ({title, instruction, observe, values: {...MULTIPLIER_DEFAULTS, ...values}, reset: true, part, isolate: false, view: 'front'});
const ladderTrial = trial('system'), chartTrial = trial('charts'), pumpTrial = trial('pump'), loadTrial = trial('load');

export const voltageMultiplierLesson = {
  simple: 'How can diodes and capacitors turn a 50 V source into nearly 200 V?',
  overview: 'A Cockcroft-Walton ladder stacks capacitor charges. A column of pump capacitors rides on the alternating source, so its nodes swing up and down; a column of smoothing capacitors rises steadily from ground. Diodes zigzag between the columns, letting charge climb one way only: near every negative peak into the pump column, near every positive peak across to the smoothing column. Each stage adds up to twice the peak. A load bleeds charge from the top, so the output sags and ripples, and the sag grows steeply as stages are added.',
  steps: [
    {title: 'Charge the first capacitor', body: 'Near the negative peak, the first diode lets the first pump capacitor charge to the peak voltage.'},
    {title: 'Lift it', body: 'Half a cycle later the source swings positive and lifts that capacitor, so its top reaches twice the peak, and the next diode passes charge to the first smoothing capacitor.'},
    {title: 'Climb the ladder', body: 'Every cycle repeats this a rung higher, until each smoothing capacitor holds twice the peak.'},
    {title: 'Feed the load', body: 'Between refills the load draws charge from the top, so the output dips a little each cycle and settles below the ideal.'},
  ],
  parts: [
    {name: 'Alternating source', role: 'The transformer’s winding, swinging between plus and minus the peak.'},
    {name: 'Pump capacitors', role: 'Ride on the source and lift charge.'},
    {name: 'Smoothing capacitors', role: 'Stack up the steady output.'},
    {name: 'Diodes', role: 'One-way valves for charge; red while conducting.'},
    {name: 'Load resistor and output', role: 'Draw current from the top.'},
    {name: 'Circuit board', role: 'Holds the ladder.'},
    {name: 'Charts', role: 'Every node now, and the output over 40 cycles.'},
  ],
  tryIt: [
    ladderTrial('Switch it on', 'Switch on the source.', 'The output climbs: 36.3 V after one cycle, 143.6 V after 10 and 180.5 V after 40, settling at 182.8 V from a 50 V source.'),
    chartTrial('No load', 'Take the load away.', 'The output settles at 197.2 V: the ideal 200 V less 0.7 V for each of its 4 diodes.', {load: 0}),
    chartTrial('Ripple', 'Watch the output once it has settled.', 'Each cycle the 91.4 µA load drains the top and the diodes refill it, so the output ripples by 5.09 V.'),
    chartTrial('More stages', 'Use 4 stages.', 'The ideal output doubles to 400 V, but the sag grows far faster than the stages: it settles at 314.0 V, and after 40 cycles has only reached 265.0 V.', {stages: 4}),
    chartTrial('Faster source', 'Raise the frequency to 500 Hz.', 'Refilled ten times as often, the capacitors lose less between refills: the ripple falls to 0.57 V and the output rises to 195.0 V.', {frequency: 500}),
    pumpTrial('Bigger capacitors', 'Use 5 µF capacitors.', 'Each holds five times the charge at the same voltage, so the ripple falls to 1.12 V and the output settles at 193.7 V.', {capacitance: 5}),
    chartTrial('The textbook formula', 'Compare the estimate.', 'For ideal diodes and a steady 100 µA, the formula gives 186.0 V with 6.00 V of ripple; the simulated ladder gives 182.8 V and 5.09 V.'),
    loadTrial('Too heavy a load', 'Use 4 stages at 100 V with 0.5 µF and 500 µA.', 'The formula breaks down, predicting a sag of 1,000 V from an 800 V ideal. The real ladder settles at 350.9 V, its load drawing only 219.3 µA.', {stages: 4, peak: 100, capacitance: 0.5, load: 500}),
  ],
  deeper: [
    {title: 'Why charge climbs', body: 'A diode is a one-way valve for charge. Each pump node rides on the capacitors below it, so when the source swings positive it lifts every stored charge by twice the peak, and a diode lets some of it step across to the smoothing column.'},
    {title: 'The cost of stages', body: 'Charge reaching the top has passed through every rung, and each rung refills only once a cycle, so the sag grows roughly with the cube of the number of stages. A faster source or bigger capacitors move more charge each second.'},
    {title: 'Where it is used', body: 'Air cleaners, photocopiers and particle accelerators use such ladders, often driven at tens of kilohertz so small capacitors suffice, to reach thousands of volts from a modest supply.'},
    {title: 'Not free energy', body: 'The ladder raises voltage, not energy. The load’s power comes from the source, less what the diodes and the winding turn to heat.'},
  ],
  misconception: 'A voltage multiplier does not create energy. It raises the voltage by giving up current, and every milliwatt at the output comes from the source.',
  limits: 'Illustrative ladder: equal capacitors; a source with 50 Ω of winding resistance; silicon diodes idealized as a 0.7 V drop in series with 5 Ω when conducting and 1 GΩ when not; a load resistor sized to draw the set current at the ideal output. Simulated by modified nodal analysis with backward Euler, 240 steps a cycle for 400 cycles from uncharged capacitors. Not modeled: diode capacitance and recovery, capacitor leakage, the transformer’s inductance, stray capacitance, and corona. The first 40 cycles play two to a second.',
  sources: [
    {title: 'IIT Kharagpur Virtual Labs: Cockcroft-Walton multiplier theory', url: 'https://vhv-iitkgp.vlabs.ac.in/exp/cockroft-walton-voltage/theory.html'},
    {title: 'Spellman High Voltage: what is a voltage multiplier?', url: 'https://www.spellmanhv.com/en/Technical-Resources/FAQs/Technology-Terminology/What-is-a-voltage-multiplier'},
    {title: 'OpenStax University Physics Volume 2: RC circuits', url: 'https://openstax.org/books/university-physics-volume-2/pages/10-5-rc-circuits'},
    {title: 'OpenStax University Physics Volume 2: capacitors in series and in parallel', url: 'https://openstax.org/books/university-physics-volume-2/pages/8-2-capacitors-in-series-and-in-parallel'},
  ],
  quiz: {
    question: 'At the same load, what does doubling the source frequency do to the ripple?',
    options: ['Roughly halves it.', 'Roughly doubles it.', 'Leaves it unchanged.'],
    answer: 0,
    explanation: 'The capacitors are refilled twice as often, so they lose about half as much charge, and voltage, between refills.',
  },
};

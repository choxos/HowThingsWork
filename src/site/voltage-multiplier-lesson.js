import {MULTIPLIER_DEFAULTS} from './voltage-multiplier-physics.js';

const trial = (title, instruction, observe, values = {}, cycle = 0, part = 'system', isolate = false) => {
  const settings = {...MULTIPLIER_DEFAULTS, window: 0, ...values};
  return {title, instruction, observe, values: settings, initialState: {settings, cycle}, reset: true, part, isolate, view: 'front'};
};

export const voltageMultiplierLesson = {
  simple: 'How can one alternating source build a higher voltage, and why does the output sag under load?',
  overview: 'Follow a positive-output Cockcroft-Walton ladder. Pump capacitors move with the alternating source. Diodes pass conventional current in one direction, charging a second column whose capacitor voltages add together. Charge transfer takes time, and the load removes charge between refills. Compare the first 40 cycles with a magnified view of cycle 400. A late cycle is not automatically a steady state.',
  steps: [
    {title: 'Charge near a negative peak', body: 'The AC terminal goes negative. Odd-numbered diodes can conduct into the pump column. The first pump capacitor approaches one source peak of voltage in the lightly loaded limit.'},
    {title: 'Lift the pump nodes', body: 'As the source swings positive, stored capacitor voltage adds to the source voltage. Even-numbered diodes can transfer charge toward the smoothing column. Red diode bodies show forward conventional current; their silver bands identify the cathodes.'},
    {title: 'Add voltage differences', body: 'The output is the sum of the smoothing-capacitor voltages. In the ideal no-load limit each stage adds twice the source peak. Equal smoothing capacitors then hold approximately equal voltage and charge, even though their top nodes sit at increasing voltages relative to ground.'},
    {title: 'Supply the load', body: 'The load resistor draws charge from the output between refills. Output voltage falls and rises within each cycle. Actual current depends on the resistor and the changing voltage; the nominal control is only the current it would draw at ideal output.'},
    {title: 'Check whether charging has finished', body: 'Compare matched points in cycles 399 and 400. A waveform can contain both repeated ripple and continuing startup drift. The readings report the measured cycle range and node change instead of assuming every setting has settled.'},
  ],
  parts: [
    {name: 'Alternating source', role: 'An external sinusoidal source behind assigned winding resistance, connected at AC and the 0 V reference.'},
    {name: 'Pump capacitors', role: 'A column that moves with the AC source and transfers charge through the rectifiers.'},
    {name: 'Smoothing capacitors', role: 'A column whose individual voltage differences sum to the output.'},
    {name: 'Diodes', role: 'Rectifiers labeled D1 onward; a silver band marks each cathode.'},
    {name: 'Load resistor and output', role: 'An adjustable resistive demand and the final output terminal; zero demand opens the branch.'},
    {name: 'Node voltages', role: 'Voltages of AC, pump nodes P1 onward and smoothing nodes S1 onward, all measured relative to ground.'},
    {name: 'Startup output', role: 'The first 40 cycles, starting with uncharged capacitors.'},
    {name: 'Late-cycle output', role: 'A magnified output waveform during cycle 400, including any remaining drift.'},
  ],
  tryIt: [
    trial('Start with empty capacitors','Press Play to follow the first 40 source cycles.','The initial output is zero. It reaches about 36.3 V after one cycle and 180.5 V after 40 cycles with the default load.'),
    trial('A negative half-cycle','Inspect the diodes at cycle 0.75.','The ideal source is at its negative peak. Match the red rectifiers to their D labels, and compare the AC terminal with the pump nodes.',{},.75,'diodes'),
    trial('The following positive half-cycle','Inspect cycle 1.25.','The ideal source is now at its positive peak. The conducting diode pattern changes as charge moves toward the smoothing column.',{},1.25,'diodes'),
    trial('Add the capacitor voltages','Open the node-voltage chart at cycle 10.','Smoothing node voltages are measured from ground, while each capacitor spans two neighboring nodes. The listed capacitor differences add to the output.',{},10,'node-chart',true),
    trial('Compare startup with later output','Inspect the complete first-40-cycle curve.','The red startup trace approaches the gray cycle-400 mean, about 182.8 V. The gray line is a separate timed comparison, not an assumed limiting voltage.',{},40,'charts',true),
    trial('Watch one late cycle','Press Play in the cycle-400 window.','The default output varies from about 180.243 V to 185.329 V. Matched-phase node changes from the previous cycle are below 0.001 V.',{window:1},399,'ripple-chart',true),
    trial('Remove the external load','Inspect cycle 400 with zero nominal demand.','The resistor branch opens. External load current and delivered power become zero. Output approaches the diode-drop limit of about 197.2 V for this two-stage example.',{window:1,load:0},399.75,'load'),
    trial('Add more stages','Compare a four-stage startup.','Ideal output doubles from 200 V to 400 V, but charging takes longer and the loaded voltage is lower than that ideal. At cycle 40, output is about 265.0 V.',{stages:4},40,'charts',true),
    trial('Refill more often','Compare the 500 Hz source during cycle 400.','The measured cycle range falls to about 0.57 V, compared with 5.09 V at 50 Hz. Playback is deliberately slowed; physical frequency still changes the circuit solution.',{window:1,frequency:500},399.5,'ripple-chart',true),
    trial('Store more charge','Compare 5 µF capacitors during cycle 400.','The cycle range falls to about 1.12 V. A larger capacitance stores more charge at the same voltage; its larger package here is an illustration, not a component specification.',{window:1,capacitance:5},399.5,'ripple-chart',true),
    trial('Demand too much current','Inspect the heavy-load late cycle.','A small-load formula gives a voltage drop larger than the ideal output, so its predicted output is invalid. The simulated resistive circuit still produces a positive voltage and draws less than its nominal 500 µA.',{window:1,stages:4,peak:100,capacitance:.5,load:500},399.5,'load'),
    trial('Catch a ladder still charging','Compare cycles 399 and 400 at the slow no-load setting.','Four stages with 5 µF capacitors at 1,000 Hz have not settled by cycle 400. The mean is about 791.0 V and the largest node change exceeds 0.01 V. Do not call its whole cycle range steady ripple.',{window:1,stages:4,peak:100,frequency:1000,capacitance:5,load:0},399.5,'ripple-chart',true),
    trial('Finish and replay','Open the end of the late window, then press Play.','The same settings replay cycle 400 from its calculated starting charge. Choosing the startup window begins again with empty capacitors; inspecting a part preserves the current checkpoint.',{window:1},400,'system'),
  ],
  deeper: [
    {title: 'Potential is not the same as stored charge', body: 'A high node voltage is measured relative to a reference. Capacitor charge depends on the voltage difference between its own plates: Q = C times that difference. The smoothing column adds voltage differences; it does not require progressively larger charge on equal capacitors at the ideal no-load limit.'},
    {title: 'Why the load matters', body: 'During each source period the load removes charge. More current, smaller capacitors or fewer refills per second tend to increase voltage variation. Adding stages also increases internal voltage drop, especially as the stage count grows.'},
    {title: 'What the textbook comparison assumes', body: 'The reference formula assumes equal capacitors, ideal rectifiers, a stiff source and a small constant load current. Here the source has resistance, diodes have forward drop and resistance, and the load is a resistor. Its actual current varies with output voltage. The reference and simulated circuit therefore need not give identical numbers.'},
    {title: 'A late sample is not an infinite-time limit', body: 'The circuit is calculated for 400 cycles. The late chart shows the last one, and its matched-phase difference from the preceding cycle is measured explicitly. A small one-cycle change is evidence of near repetition, not a proof that the asymptotic voltage has been reached.'},
    {title: 'Positive and negative outputs', body: 'This example has positive output relative to ground. Reversing all the rectifiers gives the corresponding negative-output principle used for supplies such as negative ionizing needles. The example does not model an ionizer discharge or its nonlinear load.'},
    {title: 'Energy comes from the source', body: 'Voltage multiplication does not create power. Delivered resistive power is the average of voltage squared divided by resistance. The source also supplies energy stored in capacitors and dissipated in the winding and diodes.'},
  ],
  misconception: 'A taller voltage ladder is not a source of free energy, and a higher node voltage does not mean every successive capacitor holds more charge.',
  limits: 'An illustrative positive-output half-wave Cockcroft-Walton circuit, not a construction design or a validated commercial supply. Equal ideal capacitors, 50 Ω source resistance, and silicon rectifiers represented by a 0.7 V drop plus 5 Ω in the forward branch, with a 1 GΩ leakage path in parallel. The nominal-load control sets a resistor from ideal output voltage; zero removes it. Backward-Euler nodal analysis uses 240 steps per cycle for a finite 400-cycle run, with every diode-state solve checked. Startup playback keeps 60 samples per cycle; late playback uses all 240 samples of cycle 400. The cycle-to-cycle drift is shown instead of assuming steady state. Package sizes are visual proxies, not capacitance or voltage-rating specifications. Diode recovery and capacitance, capacitor ESR and leakage, transformer inductance, stray capacitance, insulation failure and corona are not calculated. Startup plays two cycles per second; the late window plays a quarter cycle per second.',
  sources: [
    {title: 'IIT Kharagpur Virtual Labs: Cockcroft-Walton multiplier theory', url: 'https://vhv-iitkgp.vlabs.ac.in/exp/cockroft-walton-voltage/theory.html'},
    {title: 'Spellman High Voltage: what is a voltage multiplier?', url: 'https://www.spellmanhv.com/en/Technical-Resources/FAQs/What-is-a-voltage-multiplier'},
    {title: 'OpenStax University Physics Volume 2: RC circuits', url: 'https://openstax.org/books/university-physics-volume-2/pages/10-5-rc-circuits'},
    {title: 'OpenStax University Physics Volume 2: capacitors in series and in parallel', url: 'https://openstax.org/books/university-physics-volume-2/pages/8-2-capacitors-in-series-and-in-parallel'},
  ],
  quiz: {
    question: 'Can the output still be changing slowly after many source cycles?',
    options: ['Yes. Compare matching phases in consecutive cycles before assuming steady operation.', 'No. Every multiplier finishes charging after exactly one cycle.', 'No. A high voltage proves charging has stopped.'],
    answer: 0,
    explanation: 'The late waveform can include continuing charging as well as ripple. Matched-phase changes expose that drift.',
  },
};

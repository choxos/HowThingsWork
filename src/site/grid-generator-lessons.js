import {GENERATOR_DEFAULTS} from './grid-physics.js';
import {sources, generatorLimits} from './grid-sources.js';

const sourceList = [sources.generatorPhysics, sources.terminalVoltage, sources.magneticTorque, sources.conductorResistance, sources.unswGenerator];
const trial = (part, defaults = {}) => (title, instruction, observe, values = {}) => ({title, instruction, observe, values: {...GENERATOR_DEFAULTS, ...defaults, ...values}, reset: true, part, isolate: false, view: 'front'});
const chart = trial('output'), coil = trial('coil'), load = trial('load');
const parts = [
  {name: 'North and south poles', role: 'Provide the field across the rotating winding.'},
  {name: 'Connected rotating winding', role: 'Changes its magnetic flux as the shaft turns.'},
  {name: 'Driven pulley and shaft', role: 'Carry mechanical work into the machine.'},
  {name: 'Two slip rings and fixed brushes', role: 'Carry the alternating output across a rotating joint.'},
  {name: 'Split ring and fixed brushes', role: 'Exchange the winding connections every half turn.'},
  {name: 'Resistor and series switch', role: 'Dissipate electrical power or interrupt the load path.'},
  {name: 'Brush voltage over one turn', role: 'Compare both contact arrangements at the same settings.'},
];
const deeper = [
  {title: 'Flux and voltage peak at different angles', body: 'Flux is the field passing through the loop. It is largest when the loop plane is perpendicular to the field, and zero when the plane is parallel. For a uniform field, flux linkage is N B A cos θ, where θ measures the angle between the field and the loop normal. Faraday’s law gives coil EMF N B A ω sin θ. Voltage peaks when flux changes fastest, not when flux is largest.'},
  {title: 'Generated voltage is not delivered voltage', body: 'The winding has resistance as well as induction. With a closed load, current is generated EMF divided by winding resistance plus load resistance. The brush voltage is current times load resistance. The missing voltage is dropped inside the winding. Opening the load switch removes that drop, so the brushes can retain a voltage even while the resistor receives none.'},
  {title: 'RMS, mean and instantaneous readings', body: 'RMS voltage is the steady voltage that would heat the same resistor at the same average rate. For a sine it is peak voltage divided by the square root of two. Its signed mean is zero. A split ring turns the negative half cycles positive, so the mean becomes positive too. The short bridging intervals slightly reduce its RMS output. The graph and instantaneous readings follow the shaft phase; average power describes a whole turn.'},
  {title: 'The load pushes back', body: 'Current in the active wire sides feels magnetic forces. Their combined torque opposes the imposed rotation. At every instant, required drive torque times angular speed equals resistor heating plus winding heating. The ideal driver supplies that work while holding speed. With slip rings and the load open, current and electromagnetic reaction vanish; real bearing and air resistance would remain.'},
  {title: 'What the split ring changes', body: 'Each half is permanently joined to one winding end. When the internal voltage reverses, the brushes exchange halves, keeping one output polarity. The output still pulses. In this model the brushes briefly bridge both halves and short the winding, even if the load switch is open. That produces copper loss. Predicting sparks would require winding inductance and an arc model, which are omitted.'},
  {title: 'What this bench leaves out', body: 'More turns increase induction and copper resistance. Faster rotation increases both voltage and frequency. Those relations assume a fixed uniform field and an ideal drive. Real generators also have magnetic saturation, winding inductance, heating, regulation and mechanical limits. Large alternators commonly rotate a magnetic field inside stationary three-phase output windings, rather than taking the full output through these brushes.'},
];
export const electricGeneratorLesson = {
  simple: 'How does turning a coil deliver electricity, and why does the load push back?',
  overview: 'Turn the shaft and watch a connected winding rotate between magnetic poles. Its changing flux induces voltage. A closed circuit lets current flow through the external resistor, heating both the load and the copper winding. Compare slip rings with a split ring using the Contacts selector. The chart compares their brush voltages; the current arrows and installed contacts follow your selection.',
  steps: [
    {title: 'Supply mechanical work', body: 'An ideal driver turns the pulley, shaft and winding together.'},
    {title: 'Change the flux', body: 'The loop alternates between facing the magnetic field and lying parallel to it.'},
    {title: 'Induce voltage', body: 'The changing flux produces a voltage around the winding. Faster change produces more voltage.'},
    {title: 'Complete the circuit', body: 'Brushes contact the selected rings. With the switch closed, current flows through the resistor and returns to the other brush.'},
    {title: 'Feel the reaction', body: 'Magnetic forces on that current oppose rotation. The shaft supplies every watt delivered and every watt lost in the winding.'},
  ],
  parts,
  tryIt: [
    chart('Turn the shaft', 'Press Play and compare the two traces.', 'The coil induces 125.66 V peak. Winding loss lowers the brush output to 124.66 V peak, or 88.15 V RMS. Frequency is 50.00 Hz. The resistor takes 777.0 W on average; the shaft supplies 783.3 W.'),
    chart('Turn half as fast', 'Run the slower setting and compare voltage and power.', 'The generated peak falls to 62.83 V and the brush RMS voltage to 44.07 V. Frequency is 25.00 Hz. Average load power falls to 194.2 W, one quarter of the original value.', {speed: 1500}),
    coil('Double the turns', 'Inspect the thicker connected winding, then run it.', 'The generated peak doubles to 251.33 V, while brush RMS output becomes 174.89 V. Winding resistance doubles to 0.1613 Ω, so load power is 3,058.8 W rather than exactly four times the original.', {turns: 40}),
    coil('Switch the field off', 'Run the shaft with no magnetic field.', 'The shaft and winding still turn, but coil EMF, current, reaction forces and electrical power stay at zero.', {field: 0}),
    load('Open the switch', 'Run with slip rings and the load disconnected.', 'Brush voltage rises to 88.86 V RMS because there is no winding drop. The resistor receives 0 V and 0 A. Both load power and electromagnetic shaft power are zero.', {closed: 0}),
    load('A heavier load', 'Run with a smaller resistance and compare shaft power.', 'Current peaks at 116.29 A. Brush voltage peaks at 116.29 V, below the 125.66 V generated inside the coil. Average load power is 6,761.3 W, winding loss 545.2 W, and shaft input 7,306.5 W.', {load: 1}),
    coil('Hold the shaft still', 'Inspect the stationary winding and its readings.', 'Playback is blocked. Flux linkage stays at 400.0 mWb·turn, while coil EMF, current and power are zero. A static field alone does not generate voltage.', {speed: 0}),
    chart('Change to a split ring', 'Run and watch the contacts exchange winding ends.', 'The load current keeps one direction. Brush output averages 79.31 V and the resistor receives 777.0 W on average. Winding heating rises to 8.03 W because the brushes briefly bridge both halves.', {output: 1}),
    load('Open the split-ring load', 'Run the split ring with its external switch open.', 'Load current stays zero, but the short bridge intervals still cause 1.77 W of average winding heating and shaft input. Opening the external circuit does not remove the internal short.', {output: 1, closed: 0}),
  ],
  deeper,
  misconception: 'The magnet provides the field, not the output energy. The mechanical driver supplies the load power and winding losses.',
  limits: generatorLimits,
  sources: sourceList,
  quiz: {
    question: 'With slip rings installed, what happens if the shaft keeps turning but the load switch opens?',
    options: ['The brushes retain voltage, but load current and electromagnetic reaction vanish.', 'The coil stops inducing voltage because the circuit is open.', 'The magnet supplies the missing current by losing its field.'],
    answer: 0,
    explanation: 'Rotation still changes flux, so the coil still induces voltage. The broken load path prevents current. With no winding current, there is no electromagnetic reaction torque in this ideal model; real friction would remain.',
  },
};

const ac = trial('system'), acLoad = trial('load');
export const acGeneratorLesson = {
  ...electricGeneratorLesson,
  simple: 'Why does a generator’s current reverse while its resistor keeps heating?',
  overview: 'Two continuous slip rings keep each winding end attached to the same fixed brush. The coil voltage changes sign every half turn, so a connected resistor receives alternating current. Voltage and current reverse together; their product remains nonnegative. Watch the blue trace and compare instantaneous current with average load power.',
  steps: [
    {title: 'Start facing the field', body: 'At the starting angle, flux linkage is greatest but its instantaneous rate of change is zero. Voltage and current are both zero.'},
    {title: 'Turn through the first quarter', body: 'Press Step four times. The loop is parallel to the field and flux passes through zero. Positive brush voltage and load current reach their peaks.'},
    {title: 'Keep the connections', body: 'Each winding end remains wired to its own complete slip ring. Fixed brushes follow those same terminals throughout the turn.'},
    {title: 'Reverse the current', body: 'Eight more steps reach three quarters of a turn. Voltage and current have equal negative peaks. The gold load arrows reverse, while the resistor heats at the same rate as at the positive peak.'},
    {title: 'Complete the cycle', body: 'After sixteen steps, the machine returns to its starting phase. One shaft revolution produces one complete AC cycle in this two-pole model.'},
  ],
  tryIt: [
    ac('Watch one whole turn', 'Press Step four times, then eight more times, to compare opposite half turns. Play runs a complete turn.', 'Brush voltage reaches +124.66 V and −124.66 V, with load current +12.466 A and −12.466 A. Instantaneous load power is 1,554.0 W at either peak. RMS voltage is 88.15 V, frequency 50.00 Hz, and average load power 777.0 W.'),
    ac('Turn faster', 'Run the faster shaft.', 'At 3600 rpm, brush output is 105.78 V RMS and frequency is 60.00 Hz.', {speed: 3600}),
    ac('Turn slower', 'Run at half the original speed.', 'Brush output is 44.07 V RMS at 25.00 Hz. Load power falls to 194.2 W.', {speed: 1500}),
    ac('Halve the field', 'Keep the speed but reduce the field.', 'Brush output is 44.07 V RMS. Frequency stays at 50.00 Hz, and average load power falls to 194.2 W.', {field: 0.5}),
    acLoad('A lighter load', 'Increase the load resistance.', 'Peak current falls to 2.51 A and average load power to 157.4 W. Winding loss is 0.254 W.', {load: 50}),
    acLoad('Open the switch', 'Disconnect the resistor while the coil turns.', 'Brush output rises to 88.86 V RMS. The resistor’s current, voltage and power are all zero.', {closed: 0}),
  ],
  deeper: [
    {title: 'Frequency counts complete cycles', body: 'This machine has one north pole and one south pole. One revolution contains both a positive and a negative half cycle. Divide rpm by 60 to get cycles per second: 3000 rpm gives 50 Hz. Current reverses twice during that cycle. More turns or a stronger field changes voltage, not frequency.'},
    {title: 'Zero mean does not mean zero heating', body: 'The positive and negative currents cancel in a signed average, but their squares do not. For this sine wave, RMS current is peak current divided by √2. With the default 10 Ω resistor it is 8.815 A, giving 777.0 W average heating. At either current peak, instantaneous heating is twice the average.'},
    {title: 'What the signs mean', body: 'Positive current travels left to right through the pictured resistor. Negative current travels right to left. Neither sign says that energy is negative: resistor voltage changes sign with current, so their product is nonnegative. Gold arrows show conventional current; electrons in the copper move in the opposite direction.'},
    ...deeper,
  ],
  sources: [...sourceList, sources.acPower],
  misconception: 'An AC current with zero signed average can deliver positive average power. Heating depends on current squared.',
  quiz: {question: 'Why does the resistor heat during both halves of an AC cycle?', options: ['Voltage and current reverse together, keeping their product nonnegative.', 'The resistor stores the negative current until it becomes positive.', 'The slip rings secretly rectify the current.'], answer: 0, explanation: 'For this resistive load, voltage equals current times positive resistance. Power is therefore current squared times resistance, regardless of current direction.'},
};

const dc = trial('output', {output: 1}), dcLoad = trial('load', {output: 1});
export const dcGeneratorLesson = {
  ...electricGeneratorLesson,
  simple: 'How can a reversing coil deliver current in one direction?',
  overview: 'The split ring swaps which winding end each brush contacts every half turn. That exchange coincides with the internal voltage reversal, so the external current keeps one sign. The output is pulsating DC, not a steady battery voltage. Watch the red trace and inspect the curved brush faces at the insulating gaps.',
  tryIt: [
    dc('Watch the split ring', 'Run and follow the red trace.', 'The brush peak is 124.66 V and its mean is 79.31 V. There are two positive pulses in each turn.'),
    dc('The brush bridges the gap', 'Run the larger winding and inspect the crossings.', 'The winding resistance is 0.1613 Ω. Brush bridges account for 3.534 W of its 52.866 W average heating. Switching sparks are outside this resistive model.', {turns: 40}),
    dcLoad('Open the switch', 'Disconnect the external load.', 'Load power is zero, but internal brush bridges still cause 1.767 W of winding heating.', {closed: 0}),
    dc('Turn slower', 'Run at half speed.', 'The brush peak falls to 62.33 V and its mean to 39.66 V.', {speed: 1500}),
    dcLoad('A lighter load', 'Increase resistance while keeping the same speed.', 'Average load power falls to 157.4 W. The load current still has one direction.', {load: 50}),
    dc('Halve the field', 'Run with half the field strength.', 'The brush mean falls to 39.66 V and average load power to 194.2 W.', {field: 0.5}),
  ],
  misconception: 'The split ring reverses connections. It neither smooths the voltage nor stores energy between pulses.',
  quiz: {question: 'What does a split ring do that continuous slip rings do not?', options: ['It exchanges the winding ends connected to the brushes every half turn.', 'It stores charge to fill the spaces between pulses.', 'It prevents the internal coil voltage from reversing.'], answer: 0, explanation: 'The internal voltage still reverses. Swapping its connection at the same time preserves the external polarity.'},
};

const rings = trial('rings');
export const generatorSlipRingsLesson = {
  ...acGeneratorLesson,
  simple: 'How does a fixed circuit stay connected to a rotating winding?',
  overview: 'Each winding end connects to its own insulated copper ring. A stationary carbon brush rubs continuously on each ring, so the coil can turn without twisting a fixed wire. The two connections retain their identities through every angle. Select slip rings, inspect their brushes, then watch a full turn.',
  tryIt: [
    rings('Follow one ring', 'Watch the light marker turn with each copper ring.', 'Each brush stays fixed on its own ring. Loaded brush voltage peaks at 124.66 V and changes sign every half turn.'),
    rings('Open the switch', 'Open the circuit beyond the brushes.', 'Both brushes still touch their rings, but load current is zero. The brushes retain 125.66 V peak.', {closed: 0}),
    rings('More turns behind them', 'Run with more winding turns.', 'The two rings retain their connections while brush voltage rises to 247.34 V peak.', {turns: 40}),
    rings('Turn slower', 'Halve the shaft speed.', 'The rings turn more slowly and deliver 62.33 V peak at 25.00 Hz.', {speed: 1500}),
    rings('A heavier load', 'Reduce the external resistance.', 'Peak current through the contacts rises to 116.29 A in this ideal circuit. Real brush ratings and heating would constrain operation.', {load: 1}),
    rings('A lighter load', 'Increase the external resistance.', 'Peak current falls to 2.51 A and average load power to 157.4 W. Contact identity remains unchanged.', {load: 50}),
  ],
  misconception: 'Slip rings transfer a connection across a rotating joint. They do not convert AC to DC.',
  quiz: {question: 'Why use two separate slip rings?', options: ['Each winding end needs its own continuous, insulated connection.', 'One ring carries voltage and the other carries current.', 'A second ring cancels the negative half of the waveform.'], answer: 0, explanation: 'Separate rings preserve the two winding terminals. Each brush follows one terminal continuously, allowing either current direction.'},
};

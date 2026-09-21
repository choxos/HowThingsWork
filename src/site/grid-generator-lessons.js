import {GENERATOR_DEFAULTS} from './grid-physics.js';
import {sources, generatorLimits} from './grid-sources.js';

const trial = (defaults, part, view = 'front') => (title, instruction, observe, values = {}) => ({title, instruction, observe, values: {...defaults, ...values}, reset: true, part, isolate: false, view});

const machineOutput = trial(GENERATOR_DEFAULTS, 'output'), machineCoil = trial(GENERATOR_DEFAULTS, 'coil'), machineLoad = trial(GENERATOR_DEFAULTS, 'load');

export const electricGeneratorLesson = {
  simple: 'How does turning a coil make electricity?',
  overview: 'A generator is a coil of wire turning between the poles of a magnet. As it turns, the amount of magnetic field passing through it rises and falls, and a changing field through a loop of wire makes a voltage around that loop. The faster it changes, the bigger the voltage. Two sliding contacts carry the voltage off the turning coil to a circuit that does not turn. Press Play to watch one whole turn, then change the speed, the field, the turns and the load.',
  steps: [
    {title: 'Turn the shaft', body: 'A turbine, an engine or a hand turns the shaft the coil is fixed to.'},
    {title: 'Change the flux through the loop', body: 'Edge on to the field the loop holds the most field; a quarter turn later it holds none.'},
    {title: 'Induce a voltage', body: 'A loop whose field is changing has a voltage around it, and the more turns the loop has, the more voltage.'},
    {title: 'Take it off the turning coil', body: 'Brushes rub on rings fixed to the shaft, so a circuit that does not turn can reach a coil that does.'},
    {title: 'Pay for it at the shaft', body: 'The current in the coil feels the field and pushes back against the turning, so whoever turns the shaft pays for every watt delivered.'},
  ],
  parts: [
    {name: 'The two poles and their field', role: 'The field the coil turns in.'},
    {name: 'The turning coil', role: 'The loop whose field changes as it turns.'},
    {name: 'Two slip rings', role: 'Contacts that hand the coil voltage out as it stands.'},
    {name: 'The split ring', role: 'Contacts that hand out its size instead, so the output keeps one sign.'},
    {name: 'The two outputs, over one turn', role: 'What each set of contacts delivers, drawn against each other.'},
    {name: 'The load and the switch', role: 'What the machine is driving, and the way to disconnect it.'},
  ],
  tryIt: [
    machineOutput('Turn the shaft', 'Press Play and watch both curves.', 'The coil reaches 125.66 V at its peak, which is 88.86 V RMS, and it does it 50 times a second. The resistor takes 777.0 W and the shaft has to supply 783.3 W.'),
    machineOutput('Turn half as fast', 'Set the shaft speed to 1500 rpm and press Play.', 'Half the speed is half the rate the field through the loop changes, so the peak falls to 62.83 V and the frequency to 25.00 Hz. The power falls by four, to 194.2 W, because the voltage and the current both halve.', {speed: 1500}),
    machineCoil('Double the turns', 'Set the turns to 40 and press Play.', 'Twice the turns give twice the peak, 251.33 V, but they also give twice the winding resistance, 0.1613 Ω, out of twice the wire, 24.0 m of it. The resistor takes 3,058.8 W.', {turns: 40}),
    machineCoil('Switch the field off', 'Set the field to 0 and press Play.', 'With nothing between the poles the loop holds 0.000 mWb and nothing changes, so the coil makes 0.00 V however fast the shaft turns.', {field: 0}),
    machineLoad('Open the switch', 'Open the switch and press Play.', 'The coil still reaches 125.66 V, but nothing can flow: 0.00 A, 0.0 W at the resistor, and the shaft turns as freely as if the poles were not there.', {closed: 0}),
    machineLoad('A heavier load', 'Set the load to 1 Ω and press Play.', 'A smaller resistor draws more: the current peaks at 116.29 A, the resistor takes 6,761.3 W, and the winding itself wastes 545.228 W on top. The shaft now has to supply 7,306.5 W.', {load: 1}),
    machineCoil('Hold the shaft still', 'Set the shaft speed to 0 and press Play.', 'A strong field alone does nothing at all. The loop holds 400.000 mWb and holds it, so the coil makes 0.00 V and the resistor takes 0.0 W.', {speed: 0}),
  ],
  deeper: [
    {title: 'The rate, not the amount', body: 'Faraday’s law says the voltage around a closed loop is the rate at which the magnetic flux through it changes, with a minus sign that says the current it drives opposes the change. Edge on to the field the loop holds the most flux, and at that instant it makes no voltage at all, because the flux is at a turning point. A quarter turn later the flux is zero and changing fastest, and that is where the voltage peaks. For a loop of N turns and area A turning at ω in a field B, that peak is N B A ω: 20 turns of 0.02 m² at 1 T and 314.2 rad/s give 125.66 V.'},
    {title: 'Two ways to count one sine', body: 'A sine that peaks at 125.66 V is not 125.66 V of useful voltage. What heats a resistor is the square of the current averaged over the cycle, and for a sine that works out as the peak divided by the square root of two: 88.86 V. A commutated output, which is the same sine with its negative halves turned over, has the same square and so heats the resistor exactly as hard; what changes is its average, 2/π of the peak, which here is 79.95 V.'},
    {title: 'The winding is part of the circuit', body: 'Every turn of the coil adds voltage, and every turn adds wire. At 20 turns the loop carries 12.0 m of 2.5 mm² copper, whose resistivity of 1.68 × 10⁻⁸ Ω·m makes 0.0806 Ω. That resistance is in series with the load, so it takes its share of the current and turns it into heat inside the machine: 6.266 W here, against 777.0 W delivered.'},
    {title: 'Speed and frequency are the same thing', body: 'One pole pair gives one cycle a turn, so the frequency is the speed divided by 60. In general the speed follows N = 120 f / P, with P the number of poles: a machine with 2 poles has to turn at 3,000 rpm to make 50 Hz and 3,600 rpm to make 60 Hz, and one with four poles at half that. A generator on a grid is not free to choose its speed.'},
    {title: 'Where the energy comes from', body: 'The current in the coil sits in the field, and a current in a field feels a force. Those forces push back against the turning, so the shaft has to work harder the more the machine delivers. At the bench settings 777.0 W goes to the resistor, 6.266 W heats the winding, and the shaft supplies 783.3 W: the magnet supplies none of it. Open the switch and the current stops, the pushback stops, and the shaft turns free.'},
    {title: 'What a real machine does instead', body: 'A power station generator turns the field and keeps the windings still, so only the small direct current that makes the field has to cross sliding contacts, while the heavy output comes off fixed terminals. It has many coils in slots in iron rather than one loop in air, and three sets of them a third of a cycle apart. The bench here keeps one loop so that the flux, the voltage and the contacts can all be watched at once.'},
  ],
  misconception: 'The magnet is not the source of the energy. It supplies the field, and the field is not used up; every watt that leaves the terminals is a watt the shaft had to put in.',
  limits: generatorLimits,
  sources: [sources.induction, sources.faraday, sources.generator, sources.alternator, sources.commutator, sources.slipRing, sources.resistivity],
  quiz: {
    question: 'The shaft keeps turning at the same speed in the same field, but the switch is opened. What happens?',
    options: ['The coil still makes its voltage, but no current flows and the shaft turns free.', 'The coil stops making a voltage, because there is nowhere for it to go.', 'The magnet runs down, because nothing is drawing from it.'],
    answer: 0,
    explanation: 'A voltage needs a changing flux, which the turning coil still has; a current needs a path, which the open switch has taken away. With no current there is no force on the coil, so the shaft costs nothing beyond friction.',
  },
};

// ---------------------------------------------------------------------------
// AC generator: the slip ring machine, seen at its output.
// ---------------------------------------------------------------------------

const AC_DEFAULTS = {...GENERATOR_DEFAULTS, output: 0};
const ac = trial(AC_DEFAULTS, 'output'), acLoad = trial(AC_DEFAULTS, 'load');

export const acGeneratorLesson = {
  simple: 'Why does a generator deliver a current that keeps changing direction?',
  overview: 'A coil turning steadily in a field passes the field one way for half a turn and the other way for the next half, so the voltage it makes rises, falls, and goes as far the other way. Two slip rings, one on each end of the coil, hand that out exactly as it is. What comes out is alternating current, and how often it changes direction is set by how fast the shaft turns. Watch the blue curve while you change the speed, the field and the load.',
  steps: [
    {title: 'Start edge on', body: 'With the loop edge on to the field it holds the most flux and makes no voltage.'},
    {title: 'Sweep through the field', body: 'A quarter turn later the loop holds no flux at all, and the flux is changing fastest, so the voltage peaks.'},
    {title: 'Pass the halfway point', body: 'Half a turn on, the loop is edge on again the other way round, and the voltage goes back through zero.'},
    {title: 'Go the other way', body: 'Through the second half turn the flux changes the other way, so the voltage does too.'},
    {title: 'Hand it out unchanged', body: 'Each slip ring keeps its own brush all the way round, so the sign of the voltage reaches the circuit intact.'},
  ],
  parts: [
    {name: 'The two outputs, over one turn', role: 'The sine the slip rings deliver, drawn against what the split ring would.'},
    {name: 'Two slip rings', role: 'The contacts that keep the sign.'},
    {name: 'The turning coil', role: 'The loop whose flux rises and falls twice a turn.'},
    {name: 'The load and the switch', role: 'The circuit the alternating current runs in.'},
  ],
  tryIt: [
    ac('Watch one whole turn', 'Press Play and follow the blue curve.', 'The blue curve is a sine: it rises to 125.66 V, falls back through zero and goes as far the other way, once every turn. Its root mean square is 88.86 V, which is the peak divided by the square root of two, and at this speed the coil does it 50 times a second.'),
    ac('Turn faster', 'Set the shaft speed to 3600 rpm and press Play.', 'Faster is both more voltage and more cycles: the peak rises to 150.80 V, the root mean square to 106.63 V and the frequency to 60.00 Hz.', {speed: 3600}),
    ac('Turn slower', 'Set the shaft speed to 1500 rpm and press Play.', 'At half the speed the peak is 62.83 V and the frequency 25.00 Hz. A generator that has to hold a frequency has to hold a speed.', {speed: 1500}),
    ac('Halve the field', 'Set the field to 0.5 T and press Play.', 'Half the field is half the flux, 200.000 mWb, so half the voltage, 62.83 V at the peak, and a quarter of the power, 194.2 W.', {field: 0.5}),
    acLoad('A lighter load', 'Set the load to 50 Ω and press Play.', 'A bigger resistor draws less: the current peaks at 2.51 A and the resistor takes 157.4 W, while the winding wastes only 0.254 W.', {load: 50}),
    acLoad('Open the switch', 'Open the switch and press Play.', 'The rings still carry the coil out to the brushes and the curve is unchanged at 125.66 V, but with the circuit open the current is 0.00 A and the resistor takes 0.0 W.', {closed: 0}),
  ],
  deeper: [
    {title: 'Why a sine and not something else', body: 'The flux through the loop is the field times the area times the cosine of the angle it has turned through, because only the part of the area square on to the field counts. The voltage is the rate that changes at, and the rate a cosine changes at is a sine. So a coil turning steadily in a steady field makes a sine, and nothing else: the shape comes from the geometry, not from the wire.'},
    {title: 'Speed sets the frequency', body: 'One pole pair gives one cycle a turn, so the frequency is the speed over 60, and the relation in general is N = 120 f / P. A machine with 2 poles turns at 3,000 rpm for 50 Hz, the frequency of the grid in Great Britain, and 3,600 rpm for the 60 Hz of North America. Every generator on a grid turns in step with every other.'},
    {title: 'What the root mean square is for', body: 'A resistor does not care which way the current runs, only how big it is, and the heat follows the square. Averaging the square over a cycle and taking the root gives the steady current that would heat the resistor the same: for a sine it is the peak over the square root of two. That is why 88.86 V RMS here does the work of a steady 88.86 V, though the peak is 125.66 V.'},
    {title: 'Speed changes two things at once', body: 'Turning faster raises the voltage and raises the frequency together, because both come from the same rate of change. That is why the power at a fixed resistor goes as the square of the speed: half the speed gave 194.2 W where full speed gave 777.0 W. A real machine holds its speed and changes its field instead when it wants to change its voltage.'},
    {title: 'The sign survives the contacts', body: 'The slip ring page describes a stationary graphite or metal brush rubbing on the outside of a rotating ring: a joint that turns without breaking. Because each ring is a complete circle joined to one end of the coil, the brush on it is always on that same end, so the voltage arrives with its sign intact. Nothing about the rings rectifies anything.'},
  ],
  misconception: 'Alternating current is not current that goes nowhere. It delivers real power: the voltage and the current reverse together, so their product stays positive and the resistor heats up all the way through the cycle.',
  limits: generatorLimits,
  sources: [sources.alternator, sources.generator, sources.slipRing, sources.faraday, sources.mains, sources.nationalGrid],
  quiz: {
    question: 'What sets how often the current from an alternating generator changes direction?',
    options: ['How fast the shaft turns, together with the number of poles.', 'How strong the field between the poles is.', 'How big a resistor is connected across the brushes.'],
    answer: 0,
    explanation: 'The coil passes one pole pair once a turn, so the speed and the poles fix the frequency. The field and the load change how much voltage and current there is, and not how often either reverses.',
  },
};

// ---------------------------------------------------------------------------
// DC generator: the same machine with a split ring.
// ---------------------------------------------------------------------------

const DC_DEFAULTS = {...GENERATOR_DEFAULTS, output: 1};
const dc = trial(DC_DEFAULTS, 'commutator'), dcOutput = trial(DC_DEFAULTS, 'output'), dcLoad = trial(DC_DEFAULTS, 'load');

export const dcGeneratorLesson = {
  simple: 'How can a coil that keeps reversing deliver a current that does not?',
  overview: 'Inside the coil nothing changes: the voltage still reverses every half turn. What changes is the way it is taken off. Instead of two rings, one ring is cut in half, and each half is joined to one end of the coil. The halves turn with the shaft, so every half turn each brush meets the other half, exactly when the coil reverses. The two reversals cancel, and the brush that was positive stays positive. Watch the red curve while you change the turns, the speed and the load.',
  steps: [
    {title: 'Let the coil reverse', body: 'The coil does what it always did: its voltage changes sign every half turn.'},
    {title: 'Cut the ring in half', body: 'Each half of the ring is joined to one end of the coil and turns with it.'},
    {title: 'Swap at the crossing', body: 'The gaps pass the brushes just as the coil voltage passes through zero, so each brush changes ends at that moment.'},
    {title: 'Keep one sign outside', body: 'Two reversals at once leave the outside circuit with a voltage that never goes below zero.'},
    {title: 'Live with the bridge', body: 'The brush is wider than the gap, so for a moment it touches both halves and shorts the coil.'},
  ],
  parts: [
    {name: 'The split ring', role: 'The ring cut in two, which swaps ends every half turn.'},
    {name: 'The two outputs, over one turn', role: 'The one sided curve, drawn against the sine the slip rings would give.'},
    {name: 'The turning coil', role: 'The loop, still reversing inside.'},
    {name: 'The load and the switch', role: 'The circuit that sees a current in one direction only.'},
  ],
  tryIt: [
    dcOutput('Watch the split ring', 'Press Play and follow the red curve.', 'The red curve never goes below zero. It is the same size as the blue one, reaching 125.66 V, but every half turn the split ring swaps which half each brush touches, so the sign never gets out. Its average is 79.95 V.'),
    dc('The brush bridges the gap', 'Set the turns to 40 and press Play, then look at the bottom of the red curve.', 'The brush face is wider than the gap, so at every crossing it touches both halves at once and the load gets nothing: that is the notch. While it lasts the coil is shorted through its own 0.1613 Ω and wastes 3.534 W of the 52.866 W the winding takes. That short is why a commutator sparks.', {turns: 40}),
    dcLoad('Open the switch', 'Open the switch and press Play.', 'The resistor takes 0.0 W, and yet the winding still takes 1.767 W, because the bridge shorts the coil through itself whatever the switch is doing.', {closed: 0}),
    dcOutput('Turn slower', 'Set the shaft speed to 1500 rpm and press Play.', 'The shape does not change, only the size: the peak is 62.83 V and the average 39.98 V.', {speed: 1500}),
    dcLoad('A lighter load', 'Set the load to 50 Ω and press Play.', 'The resistor takes 157.4 W, which is what the slip rings gave at the same setting. The split ring changes which way the current runs and not how big it is.', {load: 50}),
    dcOutput('Halve the field', 'Set the field to 0.5 T and press Play.', 'Half the field halves the whole curve: the average falls to 39.98 V and the resistor takes 194.2 W.', {field: 0.5}),
  ],
  deeper: [
    {title: 'A switch that keeps time with the coil', body: 'The commutator page calls it a rotary electrical switch that periodically reverses the current direction between the rotor and the external circuit, and in a generator a mechanical rectifier. It works only because it is fixed to the same shaft as the coil: the swap happens at the same instant as the reversal, every time, at any speed, without anything having to measure anything.'},
    {title: 'One sided, but not steady', body: 'The output is direct in the sense that it never changes sign, but it is nowhere near flat: it runs from zero up to 125.66 V and back, twice a turn. Its average is 2/π of the peak, 79.95 V. A machine with many coils and many segments overlaps their humps and comes out much smoother; a single loop cannot.'},
    {title: 'Wider than the gap, on purpose', body: 'The commutator page says brushes are made wider than the insulated gap, to ensure that brushes are always in contact with an armature coil. The cost is that for a moment the brush spans both halves and shorts the coil through itself. Here that moment is 2° either side of each crossing, where the coil voltage is almost nothing, and it still costs 1.767 W in the winding.'},
    {title: 'The same power, either way out', body: 'Turning the negative halves over does not change how big the current is, only which way it runs, and a resistor only cares how big it is. So the same coil at the same speed into the same resistor delivers 777.0 W through slip rings and 776.973 W through a split ring, the difference being the notches.'},
    {title: 'Why these machines went away', body: 'The commutator page notes that commutators are relatively inefficient and need periodic maintenance such as brush replacement, so commutated machines are declining in use. The generator page says the same of dynamos: alternating current came to dominate because it can be transformed to and from very high voltages, which lets power travel a long way without wasting much.'},
  ],
  misconception: 'The split ring does not smooth anything and does not store anything. It is a switch: it reverses the connection at the same moment the coil reverses, so the two cancel.',
  limits: generatorLimits,
  sources: [sources.commutator, sources.generator, sources.alternator, sources.faraday, sources.slipRing],
  quiz: {
    question: 'What does a split ring do that two slip rings do not?',
    options: ['It swaps which end of the coil each brush touches, every half turn.', 'It stores charge between half turns so the output stays level.', 'It stops the coil reversing inside the machine.'],
    answer: 0,
    explanation: 'The coil reverses either way. The split ring turns with it and swaps ends at the same instant, so the two reversals cancel and the outside circuit keeps one sign.',
  },
};

// ---------------------------------------------------------------------------
// Generator slip rings: the joint that turns.
// ---------------------------------------------------------------------------

const RING_DEFAULTS = {...GENERATOR_DEFAULTS, output: 0};
const ring = trial(RING_DEFAULTS, 'rings'), ringCoil = trial(RING_DEFAULTS, 'coil');

export const generatorSlipRingsLesson = {
  simple: 'How do you get a wire off something that keeps turning?',
  overview: 'A coil that turns cannot be joined to a circuit that does not, because the wire would wind up and break. The answer is a sliding joint: a metal ring fixed to the shaft, and a block of carbon held against it that does not turn. The ring can go round for ever while the carbon stays put, and current crosses where they touch. One ring is needed for each end of the coil, and each ring keeps its own brush, which is why the voltage arrives with its sign intact.',
  steps: [
    {title: 'Fix a ring to the shaft', body: 'A complete circle of copper turns with the coil and is joined to one of its ends.'},
    {title: 'Press a brush against it', body: 'A block of soft carbon is held against the ring by a spring and does not turn.'},
    {title: 'Let it rub', body: 'The two stay in contact all the way round, so current can cross the joint at any angle.'},
    {title: 'Give the other end its own ring', body: 'A second ring, insulated from the first, carries the other end of the coil out.'},
    {title: 'Keep the sign', body: 'Because each brush stays on its own ring, the voltage reaches the circuit exactly as the coil made it.'},
  ],
  parts: [
    {name: 'Two slip rings', role: 'The sliding joints themselves, with their brushes.'},
    {name: 'The turning coil', role: 'What the rings are joined to.'},
    {name: 'The load and the switch', role: 'The circuit on the other side of the joint.'},
  ],
  tryIt: [
    ring('Follow one ring', 'Press Play and watch the white key on each ring.', 'The key shows the ring going round while its brush stays put. The joint never breaks, so the coil’s 125.66 V reaches the load through it with the sign the coil gave it.'),
    ring('Open the switch', 'Open the switch and press Play.', 'The rings are still touching their brushes and the coil still reaches 125.66 V, but the circuit is broken further along, so the current is 0.00 A. A contact that is closed is not the same thing as a circuit that is closed.', {closed: 0}),
    ringCoil('More turns behind them', 'Set the turns to 40 and press Play.', 'The same two rings now carry 251.33 V. A slip ring does not care how many turns are behind it: it is a joint, not a part of the winding.', {turns: 40}),
    ring('Turn slower', 'Set the shaft speed to 1500 rpm and press Play.', 'At half the speed the rings rub half as fast and carry 62.83 V at 25.00 Hz. Wear at the joint follows the speed; what crosses it does not.', {speed: 1500}),
    ring('A heavier load', 'Set the load to 1 Ω and press Play.', 'The current through the joint peaks at 116.29 A. A real brush has to be big enough to carry it without burning, which is why brushes are sized by current and not by voltage.', {load: 1}),
    ring('A lighter load', 'Set the load to 50 Ω and press Play.', 'A bigger resistor draws 2.51 A through the same joint, and the resistor takes 157.4 W. The same rings suit both.', {load: 50}),
  ],
  deeper: [
    {title: 'What a slip ring is for', body: 'The slip ring page describes it as an electromechanical device that allows the transmission of power and electrical signals from a stationary to a rotating structure, and says it can eliminate damage prone wires dangling from movable joints. That is the whole idea: a joint that can turn for ever.'},
    {title: 'Why carbon', body: 'The brush is carbon because carbon is soft, conducts, and wears away instead of wearing the ring away. When a brush is worn out it is pulled out and replaced; the ring, which is expensive, stays. The commutator page makes the same point about carbon brushes wearing faster by design.'},
    {title: 'Rings against a split ring', body: 'Both are sliding joints, and the only difference is what the metal under the brush is joined to. A complete ring is joined to one end of the coil for ever, so the sign gets out; a ring cut in half swaps ends every half turn, so it does not. Nothing else about them differs.'},
    {title: 'Which part of a real machine turns', body: 'The alternator page says the revolving field type has the advantage that the rotor circuit carries much less power than the armature circuit, making the slip ring connections smaller and less costly, and that only two contacts are needed for the direct current rotor. So a power station machine turns its magnet and keeps its output windings still, and the sliding joints carry only the small field current.'},
    {title: 'The joint is not the circuit', body: 'Two brushes touching two rings is a path that is intact, and no more. Open the switch beyond them and the current stops, though nothing at the joint has changed. It is worth watching the current fall to 0.00 A while the coil goes on making 125.66 V.'},
  ],
  misconception: 'A slip ring does not turn alternating current into anything else. It is a joint that turns, and it hands the coil voltage on exactly as it found it.',
  limits: generatorLimits,
  sources: [sources.slipRing, sources.alternator, sources.commutator, sources.generator],
  quiz: {
    question: 'Why does a generator need slip rings at all?',
    options: ['Because the coil turns and the circuit does not, and a fixed wire would wind up and break.', 'Because the coil voltage has to be smoothed before it leaves the machine.', 'Because the current has to be turned into direct current before it can be used.'],
    answer: 0,
    explanation: 'The rings are a joint that turns. The ring goes round with the coil, the carbon brush stays put, and current crosses where they rub, at any angle and for as long as the machine runs.',
  },
};

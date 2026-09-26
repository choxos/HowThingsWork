import {TRANSFORMER_DEFAULTS} from './grid-physics.js';
import {sources, transformerLimits} from './grid-sources.js';

const trial = (defaults, part, view = 'front') => (title, instruction, observe, values = {}) => ({title, instruction, observe, values: {...defaults, ...values}, reset: true, part, isolate: false, view});

const cycle = trial(TRANSFORMER_DEFAULTS, 'cycle'), coils = trial(TRANSFORMER_DEFAULTS, 'windings'), spend = trial(TRANSFORMER_DEFAULTS, 'losses'), iron = trial(TRANSFORMER_DEFAULTS, 'core');

export const transformerLesson = {
  simple: 'How do you change the voltage of an alternating supply without touching it?',
  overview: 'Two coils are wound on one loop of iron, and nothing joins them but the iron. An alternating voltage on the first drives a magnetic flux round the core, and that flux, rising and falling, makes a voltage in the second. How much voltage depends on nothing but how many turns each coil has. The current goes the other way: the side with more turns carries less current. What comes out is a little less than what goes in, because the copper and the iron each take their cut. Press Play, then change the turns, the load, the steel and the metal.',
  steps: [
    {title: 'Drive the first winding', body: 'An alternating voltage across the primary drives a flux round the core that rises and falls with it.'},
    {title: 'Share the flux', body: 'The iron carries almost all of that flux round to the second winding, which is wound on the same loop.'},
    {title: 'Make a voltage in the second', body: 'Each turn of either winding stands the same voltage, so the two voltages are in the ratio of the turns.'},
    {title: 'Balance the currents', body: 'What the secondary draws, the primary supplies in the inverse ratio, so the ampere turns on the two sides balance.'},
    {title: 'Pay the two tolls', body: 'The windings heat with the square of the current, and the iron heats whenever the machine is switched on.'},
  ],
  parts: [
    {name: 'The iron core', role: 'The loop that carries the flux from one winding to the other.'},
    {name: 'The two windings', role: 'The turns that set the voltage ratio.'},
    {name: 'Two cycles, drawn out', role: 'The voltage, the flux and the magnetizing current, and how they sit against one another.'},
    {name: 'Where the power goes', role: 'What reaches the load and what the copper and the core take.'},
    {name: 'What the secondary supplies', role: 'The circuit on the outgoing side.'},
  ],
  tryIt: [
    cycle('Run two cycles', 'Press Play and watch the three curves.', 'The flux runs a quarter cycle behind the voltage, because it is the flux changing that makes the voltage in the first place. 132 kV in comes out as 11 kV, 239.8 A in comes out as 2,863.6 A, and 99.535 percent of what goes in comes out.'),
    coils('More turns on the secondary', 'Set the secondary turns drawn to 10 and press Play.', 'Twice the turns give twice the voltage, 22 kV, and the primary has to draw twice the current, 478.4 A against the 239.8 A it drew before. The turns are the only thing that set it.', {secondaryTurns: 10}),
    spend('Nothing drawn at all', 'Set the load to 0 percent and press Play.', 'With nothing drawn the copper takes 0.00 kW, and yet the core still takes 15.65 kW and the machine still draws 1.20 A from the line. A transformer left switched on pays that bill all year.', {load: 0}),
    spend('The load it likes best', 'Set the load to 35 percent and press Play.', 'At 35 percent of rating the copper takes 16.10 kW, about what the core is taking, and the machine is at its best: 99.713 percent, against the 99.535 percent it manages at full load.', {load: 35}),
    iron('An amorphous core', 'Choose the amorphous core and press Play.', 'The core loss falls from 15.65 kW to 4.70 kW and the machine climbs to 99.570 percent. The copper loss does not move at all.', {core: 1}),
    coils('Aluminum windings', 'Choose aluminum windings and press Play.', 'Aluminum of the same cross section has more resistance than copper, so the winding loss rises from 131.45 kW to 220.65 kW and the machine falls to 99.255 percent.', {winding: 1}),
    iron('Too few turns', 'Set the primary turns drawn to 30 and press Play.', 'Half the primary turns leave twice the flux in the iron, 3.301 T, far past the 1.5 T at which electrical steel’s loss is quoted, and the core loss goes up fourfold to 62.61 kW.', {primaryTurns: 30}),
  ],
  deeper: [
    {title: 'Why the turns are the whole answer', body: 'Both windings sit on the same core and see the same flux, so by Faraday’s law each turn of either one stands the same voltage: the rate the shared flux changes at. A winding of many turns stands many times that, and one of few turns stands few times it. The transformer page writes it as V_P / V_S = N_P / N_S, and adds that the voltage ratio and the turns ratio are both inversely proportional to the current ratio.'},
    {title: 'A quarter cycle behind', body: 'The flux is the voltage added up over time, so where the voltage is at a peak the flux is at a standstill and where the voltage passes zero the flux is at its most. That is a quarter cycle of lag, and the transformer page says it plainly: with sinusoidal supply, core flux lags the induced EMF by 90 degrees. The magnetizing current keeps step with the flux, not with the voltage, which is why it carries no power.'},
    {title: 'What the turns leave in the iron', body: 'The universal EMF equation ties the four together: E = 2π f N A B over the square root of two, about 4.44 f N A B. At a fixed voltage and frequency, fewer turns or a smaller core mean more flux, and the core loss follows the square of it, because the transformer page says eddy current losses are proportional to the square of the applied voltage. Halving the turns here takes the iron from 1.651 T to 3.301 T and the core loss from 15.65 kW to 62.61 kW.'},
    {title: 'The two losses behave differently', body: 'The transformer page separates them: hysteresis and eddy current losses are constant at all load levels and dominate at no load, while winding loss increases as load increases. So one bill is fixed and one follows the square of the load, and a machine is at its most efficient where the two are equal, here at 34.5 percent of rating. The regulation sets its efficiency figure at exactly that point and calls it the Peak Efficiency Index.'},
    {title: 'What the load looks like from the other side', body: 'A load on the secondary is seen by the primary through the square of the turns ratio: the transformer page gives Z′ = a² Z. Here 3.841 Ω on the secondary looks like 553.14 Ω to the line. A transformer changes what a circuit looks like as surely as it changes its voltage, which is why it is used to match one to another as well as to step up and down.'},
    {title: 'How good these machines are', body: 'The transformer page says the efficiency of typical distribution transformers is between about 98 and 99 percent, and that efficiency tends to improve with capacity. The regulation asks a 400 kVA unit for no more than 3,250 W of load loss and 387 W of no load loss, and asks a machine of 100 MVA or more to reach a Peak Efficiency Index of 99.770 percent.'},
  ],
  misconception: 'A transformer does not make power. Whatever it gives out in volts it takes back in amps, and a little more besides, for the copper and the iron.',
  limits: transformerLimits,
  sources: [sources.transformer, sources.faraday, sources.steel, sources.ecodesign, sources.distributionTransformer, sources.resistivity],
  quiz: {
    question: 'What decides how much a transformer changes the voltage by?',
    options: ['The ratio of the number of turns on the two windings.', 'How thick the wire in each winding is.', 'How much current the load is drawing.'],
    answer: 0,
    explanation: 'Both windings see the same flux, so each turn stands the same voltage and the two voltages are in the ratio of the turns. The wire thickness sets the loss and the load sets the current, and neither sets the ratio.',
  },
};

// ---------------------------------------------------------------------------
// Transformer turns ratio.
// ---------------------------------------------------------------------------

const ratio = trial(TRANSFORMER_DEFAULTS, 'windings');

export const transformerTurnsRatioLesson = {
  simple: 'Why does counting turns tell you the voltage?',
  overview: 'Both windings are wound on the same loop of iron and both see the same flux, so every turn of either winding stands exactly the same voltage. Count the turns and you have the answer: the two voltages are in the ratio of the counts, and nothing else about the windings comes into it. Change either count and watch the output follow, and watch what else changes with it.',
  steps: [
    {title: 'Share one flux', body: 'One loop of iron carries the same flux through both windings.'},
    {title: 'Give every turn the same voltage', body: 'Each turn stands the rate the shared flux changes at, whichever winding it belongs to.'},
    {title: 'Add the turns up', body: 'A winding stands its number of turns times that, so the two voltages are in the ratio of the counts.'},
    {title: 'Balance the currents', body: 'The currents go the other way, so that the ampere turns on the two sides cancel in the core.'},
    {title: 'Watch the flux as well', body: 'Fewer turns on the driven side mean more flux in the iron for the same voltage.'},
  ],
  parts: [
    {name: 'The two windings', role: 'The turns themselves, drawn one by one.'},
    {name: 'The iron core', role: 'The loop that carries the shared flux.'},
    {name: 'Two cycles, drawn out', role: 'The flux the turns leave in the iron.'},
  ],
  tryIt: [
    ratio('Count what is there', 'Press Play and count the turns on each leg.', 'There are 60 turns drawn on the incoming leg and 5 on the outgoing one, so the voltage comes down in that ratio: 132 kV in, 11 kV out.'),
    ratio('Twice the outgoing turns', 'Set the secondary turns drawn to 10 and press Play.', 'Twice the turns on the outgoing winding give twice the voltage: 22 kV.', {secondaryTurns: 10}),
    ratio('Four times the outgoing turns', 'Set the secondary turns drawn to 20 and press Play.', 'Four times the turns give four times the voltage, 44 kV, and the incoming winding has to draw four times the current, 955.7 A.', {secondaryTurns: 20}),
    ratio('The same on both sides', 'Set the secondary turns drawn to 60 and press Play.', 'With the same count on both legs the voltage comes out as it went in: 132 kV. A transformer wound like this changes nothing but still keeps the two circuits apart, which is sometimes the only reason it is there.', {secondaryTurns: 60}),
    ratio('Half the incoming turns', 'Set the primary turns drawn to 30 and press Play.', 'Halving the incoming turns doubles the ratio just as doubling the outgoing turns did, and gives the same 22 kV. But it is not the same machine: the flux in the iron doubles to 3.301 T.', {primaryTurns: 30}),
    ratio('Volts for every turn', 'Set the primary turns drawn to 30 and the secondary turns drawn to 10, then press Play.', 'Fewer turns on both sides give the same 44 kV as before, but now every real turn has to stand 220.00 V instead of 110.00 V, and the flux is twice as big, 3.301 T. The ratio is what sets the voltage; the counts themselves set the flux.', {primaryTurns: 30, secondaryTurns: 10}),
  ],
  deeper: [
    {title: 'The ratio, and nothing else', body: 'The transformer page gives the ideal transformer identity: V_P / V_S = I_S / I_P = N_P / N_S. Not the thickness of the wire, not the size of the core, not what the load is doing. Those change what the machine wastes and what it can stand, and they leave the ratio alone.'},
    {title: 'Why the currents go the other way', body: 'A current in the secondary makes its own magnetomotive force round the core, which would change the flux, which would change the primary voltage. It cannot, because the supply holds the primary voltage. So the primary draws exactly the current that cancels it, and the ampere turns balance. That is why the side with more turns carries less current.'},
    {title: 'The counts set the flux', body: 'Two windings of 30 and 10 have the same ratio as 60 and 20 and give the same voltage, but they are not the same machine. With half the turns on the driven side, every turn has to stand twice the voltage, and the flux in the iron doubles: from 1.651 T to 3.301 T here. Real iron will not take that, and the core loss, which follows the square of the flux, would go up fourfold anyway.'},
    {title: 'Turns you can count, and turns that are really there', body: 'A winding standing 132 kV needs more turns than can be drawn: at 1.651 T through a core of 0.3 m² it needs 1,200 of them. Every turn drawn here stands for 20 real turns, so 60 drawn is 1,200 real. The ratio is the same either way, which is the point: it is a ratio.'},
    {title: 'What it looks like from the other side', body: 'A load is seen through the square of the ratio, so a small resistance on a low voltage winding looks like a large one to a high voltage line: here 3.841 Ω becomes 553.14 Ω. Change the turns and that changes as the square, which is a faster change than the voltage itself.'},
  ],
  misconception: 'Two windings with the same ratio are not the same transformer. The ratio fixes the voltage; the actual number of turns fixes how hard the iron is driven.',
  limits: transformerLimits,
  sources: [sources.transformer, sources.faraday, sources.steel, sources.ecodesign],
  quiz: {
    question: 'Two transformers have the same turns ratio, but one has half as many turns on each winding. What differs?',
    options: ['The one with fewer turns drives twice the flux through its core.', 'The one with fewer turns gives twice the output voltage.', 'Nothing differs, because only the ratio matters.'],
    answer: 0,
    explanation: 'The ratio sets the voltage, so both give the same output. But each turn of the smaller winding has to stand twice the voltage, so the flux doubles and the core loss goes up fourfold.',
  },
};

// ---------------------------------------------------------------------------
// The same machine at three places: transmission, distribution, home supply.
// ---------------------------------------------------------------------------

const UP = {...TRANSFORMER_DEFAULTS, stage: 0, primaryTurns: 3, secondaryTurns: 60};
const up = trial(UP, 'core'), upSpend = trial(UP, 'losses'), upCoils = trial(UP, 'windings');

export const transmissionTransformerLesson = {
  simple: 'Why is the voltage raised the moment the power leaves the station?',
  overview: 'A generator makes a few tens of thousands of volts, which is as much as its insulation will stand. That is far too little to carry hundreds of megawatts any distance, because the current would be enormous and the line would waste most of it as heat. So the first thing a power station does is put its output through a transformer wound the other way round: few turns in, many turns out. The voltage goes up and the current comes down in the same proportion, and only then does the power set off.',
  steps: [
    {title: 'Take what the generator makes', body: 'The station makes its power at a voltage its own insulation can stand.'},
    {title: 'Wind the transformer the other way round', body: 'Few turns on the incoming side, many on the outgoing one.'},
    {title: 'Raise the voltage', body: 'The outgoing voltage is the incoming voltage times the turns ratio.'},
    {title: 'Lower the current', body: 'The same power at a higher voltage needs a smaller current, in the same proportion.'},
    {title: 'Send it away', body: 'The line beyond carries that smaller current, and wastes far less because of it.'},
  ],
  parts: [
    {name: 'The iron core', role: 'The biggest core of the three, for the biggest machine.'},
    {name: 'The two windings', role: 'Few turns in, many out.'},
    {name: 'Where the power goes', role: 'The losses of a very large machine.'},
    {name: 'What the secondary supplies', role: 'The line that is about to carry it away.'},
  ],
  tryIt: [
    up('Step it up for the journey', 'Press Play and watch both windings.', 'A power station makes 20 kV. This machine turns it into 400 kV, twenty times as much, and the current goes the other way: 20,074.8 A in, 1,000.0 A out.'),
    upSpend('Nothing drawn at all', 'Set the load to 0 percent and press Play.', 'With nothing drawn the core still takes 158.73 kW, and the machine draws 100.31 A from the station just to stay magnetized.', {load: 0}),
    upSpend('The load it likes best', 'Set the load to 35 percent and press Play.', 'At 35 percent of rating the machine reaches 99.771 percent, which is the figure the regulation asks of a machine this size.', {load: 35}),
    up('An amorphous core', 'Choose the amorphous core and press Play.', 'The core loss falls from 158.73 kW to 47.62 kW and the machine climbs to 99.656 percent. On a machine that is never switched off, that is a great deal of energy over a year.', {core: 1}),
    upCoils('Half the outgoing turns', 'Set the secondary turns drawn to 30 and press Play.', 'Half the turns give half the voltage, 200 kV, so the same rated current carries half the power while the losses stay where they were, and the machine falls to 99.260 percent.', {secondaryTurns: 30}),
    upSpend('Pushed past its rating', 'Set the load to 120 percent and press Play.', 'At 120 percent the outgoing winding carries 1,200.0 A, the copper loss rises to 1,919.58 kW, and the machine falls to 99.569 percent. Losses that follow the square of the current punish overloading twice over.', {load: 120}),
  ],
  deeper: [
    {title: 'What a station actually makes', body: 'The transmission page says power is produced at a relatively low voltage between about 480 V and 22 kV, depending on the size of the unit, and that the station transformer steps it up to between 100 kV and 1,000 kV for transmission. The 20 kV here is inside that band, and 400 kV is the top voltage of the grid in Great Britain.'},
    {title: 'Why not generate at 400 kV', body: 'Because the insulation would have to be inside the machine, between turns that are moving, in oil and hydrogen and heat. It is far easier to insulate a transformer, which has no moving parts, than a generator, which does. So the machine makes what it can and the transformer does the rest.'},
    {title: 'How good a machine this size has to be', body: 'The regulation sets a minimum Peak Efficiency Index of 99.770 percent for a liquid immersed large power transformer of 100 MVA or more, from the second of its two tiers. It is a stiff figure: at 400 MVA it allows 158.73 kW of no load loss and 1,333.04 kW of load loss, which sounds enormous until you set it against 400 MW passing through.'},
    {title: 'The core it needs', body: 'To stand 400 kV at 50 Hz through 1,200 real turns, the core has to carry 1.667 T through 0.9 m² of iron. That is a block of laminated steel about 949 mm square, and the machine around it is the size of a house. Everything about a transformer scales with the flux it has to carry.'},
    {title: 'Switched on for ever', body: 'The distribution transformer page makes the point about smaller machines, and it is truer of this one: a transformer is energized 24 hours a day even when it carries no load, so its no load loss is paid every hour of every year. That is why the regulation caps the no load loss separately, and why amorphous cores are worth their cost.'},
  ],
  misconception: 'Stepping the voltage up does not create power or push the current harder. It trades volts for amps at constant power, and it is the smaller current that saves the line.',
  limits: transformerLimits,
  sources: [sources.transmission, sources.transformer, sources.ecodesign, sources.nationalGrid, sources.steel],
  quiz: {
    question: 'Why does a power station step its voltage up before sending the power away?',
    options: ['Because the same power then needs less current, and the line wastes far less.', 'Because high voltage travels faster along the wires.', 'Because the transformer adds power that the generator could not make.'],
    answer: 0,
    explanation: 'What a line wastes follows the square of the current. Raising the voltage lowers the current in the same proportion for the same power, so the waste falls as the square of the ratio.',
  },
};

const MID = {...TRANSFORMER_DEFAULTS, stage: 1, primaryTurns: 60, secondaryTurns: 5};
const mid = trial(MID, 'losses'), midCore = trial(MID, 'core'), midCoils = trial(MID, 'windings');

export const distributionTransformerLesson = {
  simple: 'What happens to the voltage when the power reaches a town?',
  overview: 'The grid carries power across a country at a few hundred thousand volts. No town can use that, and no cable can be buried under a street at that voltage. So at a grid supply point a large transformer steps it down to a few thousand volts, and from there it goes out along the roads to factories, to trains and to the smaller transformers that feed houses. It is the same machine as the one at the power station, wound the other way round.',
  steps: [
    {title: 'Take the grid voltage in', body: 'The incoming winding stands the voltage the grid line arrives at.'},
    {title: 'Wind fewer turns on the way out', body: 'The outgoing winding has a fraction of the turns, so it makes a fraction of the voltage.'},
    {title: 'Let the current rise', body: 'The same power at a lower voltage means a larger current, so the outgoing winding is made of thicker metal.'},
    {title: 'Send it out along the roads', body: 'The lower voltage goes out to industry, to railways and to the streets.'},
    {title: 'Keep paying the core', body: 'The core is magnetized all day and all night whether anybody is drawing power or not.'},
  ],
  parts: [
    {name: 'Where the power goes', role: 'The two tolls the machine takes, and how they change with the load.'},
    {name: 'The iron core', role: 'The loop that is magnetized whenever the machine is live.'},
    {name: 'The two windings', role: 'Many turns in, few out.'},
    {name: 'What the secondary supplies', role: 'The town beyond.'},
  ],
  tryIt: [
    mid('Step it down for the town', 'Press Play and watch both windings.', '132 kV comes in and 11 kV goes out, twelve times down, and the current goes the other way: 239.8 A in and 2,863.6 A out of a machine rated 31.500 MVA.'),
    mid('Nothing drawn at all', 'Set the load to 0 percent and press Play.', 'With the town asleep the copper takes nothing, and yet the core takes 15.65 kW and the machine draws 1.20 A from the grid all the same.', {load: 0}),
    mid('The load it likes best', 'Set the load to 35 percent and press Play.', 'At 35 percent of rating the copper takes 16.10 kW, which is about what the core is taking, and the machine reaches 99.713 percent. A transformer sized for the worst hour of the year spends most of its life near here.', {load: 35}),
    midCore('An amorphous core', 'Choose the amorphous core and press Play.', 'The core loss falls from 15.65 kW to 4.70 kW and the machine climbs to 99.570 percent. Nothing about the load has changed.', {core: 1}),
    midCoils('Aluminum windings', 'Choose aluminum windings and press Play.', 'The winding loss rises from 131.45 kW to 220.65 kW and the machine falls to 99.255 percent, because aluminum of the same cross section has more resistance than copper.', {winding: 1}),
    mid('The worst hour of the year', 'Set the load to 120 percent and press Play.', 'Pushed to 120 percent the outgoing winding carries 3,436.4 A, the copper loss rises to 189.29 kW, and the machine falls to 99.461 percent.', {load: 120}),
  ],
  deeper: [
    {title: 'What comes out here', body: 'The distribution page says substations lower the transmission voltage to medium voltage ranging between 2 kV and 33 kV, and that 11 kV and 33 kV are common in the United Kingdom. The 11 kV here is that. The National Grid page gives 132 kV as the lowest of the grid voltages, so this is the step from one to the other.'},
    {title: 'Not everybody needs a second step', body: 'The book makes the point and so does the distribution page: some current goes directly to factories with high voltage machines and to high speed electric trains. A customer big enough to take 11 kV takes it, and owns the transformer that steps it down inside its own building.'},
    {title: 'Two bills, one of them fixed', body: 'The copper bill follows the square of the load, so it is nothing at night and worst at the peak. The core bill does not move: 15.65 kW whether the town is drawing 31.500 MVA or nothing at all. Over a year, on a machine that is rarely near full load, the fixed bill can be the larger of the two, which is why the regulation caps it separately.'},
    {title: 'Why the cheaper metal costs more', body: 'Copper is 1.68 × 10⁻⁸ Ω·m and aluminum is 2.82 × 10⁻⁸ Ω·m, so the same cross section of aluminum has 1.68 times the resistance and wastes 1.68 times as much. A real machine wound in aluminum uses more of it to make up the difference, which makes the windings bigger and the machine bigger, and the trade is a price, not a free lunch.'},
    {title: 'The current is where the size is', body: 'The outgoing winding here carries 2,863.6 A against the incoming winding’s 239.8 A, twelve times as much, so it is made of a thick ribbon rather than a wire. In a transformer the high voltage winding is thin and long and the low voltage winding is short and thick, and looking at one tells you which side you are on.'},
  ],
  misconception: 'The step down does not happen at the house. Most of it happens here, at a substation feeding a whole district, and only the last small step happens near the street.',
  limits: transformerLimits,
  sources: [sources.distribution, sources.nationalGrid, sources.transformer, sources.ecodesign, sources.resistivity, sources.distributionTransformer],
  quiz: {
    question: 'Why does the transformer at a substation waste power even when nobody is drawing any?',
    options: ['Its core is magnetized all the time, and magnetizing iron costs power.', 'Its windings heat up even with no current in them.', 'It is slowly losing the charge stored in it.'],
    answer: 0,
    explanation: 'Hysteresis and eddy currents in the core are there whenever the machine is switched on, and do not depend on the load. Here that is 15.65 kW, hour after hour, whatever the town is doing.',
  },
};

const HOME = {...TRANSFORMER_DEFAULTS, stage: 2, primaryTurns: 55, secondaryTurns: 2};
const home = trial(HOME, 'load'), homeCoils = trial(HOME, 'windings'), homeSpend = trial(HOME, 'losses');

export const homeSupplyTransformerLesson = {
  simple: 'What is inside the last box before the wires reach a house?',
  overview: 'The cable along the street is still at a few thousand volts, which would be lethal in a kitchen. The last transformer, in a small building or on a pole at the end of the road, drops it to the voltage the house is wired for, and feeds a few hundred houses between them. It is the smallest of the three machines and the one that is closest to being always on and rarely busy.',
  steps: [
    {title: 'Take the street voltage in', body: 'The incoming winding stands the voltage of the cable along the road.'},
    {title: 'Wind very few turns out', body: 'The outgoing winding has a small fraction of the turns, and makes a small fraction of the voltage.'},
    {title: 'Carry a large current', body: 'The outgoing winding is a thick ribbon, because everything that leaves here leaves as amps.'},
    {title: 'Split it between the houses', body: 'One machine feeds a street, and each house takes what it needs from the same pair of wires.'},
    {title: 'Sit there all year', body: 'It is never switched off, and for most of the day it is carrying a fraction of what it could.'},
  ],
  parts: [
    {name: 'What the secondary supplies', role: 'The street, and what it is drawing.'},
    {name: 'The two windings', role: 'Many turns in, almost none out.'},
    {name: 'Where the power goes', role: 'The two tolls, on the smallest of the three machines.'},
    {name: 'The iron core', role: 'The smallest core, magnetized all year.'},
  ],
  tryIt: [
    home('The last step down', 'Press Play and watch the outgoing side.', '11 kV comes in and 400 V goes out, and the outgoing winding carries 1,000.0 A. The core takes 0.39 kW and the copper 3.25 kW, so 99.099 percent of what comes in reaches the street.'),
    homeSpend('The street at night', 'Set the load to 0 percent and press Play.', 'With nobody drawing anything the copper takes nothing, and the machine still takes 0.39 kW from the cable and draws 0.19 A. Multiply that by every street in a country and it is a power station on its own.', {load: 0}),
    homeSpend('A quiet afternoon', 'Set the load to 35 percent and press Play.', 'At 35 percent of rating the copper takes 0.40 kW, about what the core takes, and the machine is at its best: 99.442 percent.', {load: 35}),
    homeCoils('Twice the outgoing turns', 'Set the secondary turns drawn to 4 and press Play.', 'Twice the turns give 800 V, which is exactly the right answer to the wrong question: no socket in the house would survive it.', {secondaryTurns: 4}),
    homeCoils('Aluminum windings', 'Choose aluminum windings and press Play.', 'The winding loss rises from 3.25 kW to 5.46 kW and the machine falls to 98.560 percent, below the band the page gives for typical distribution transformers.', {winding: 1}),
    home('Everyone home at once', 'Set the load to 120 percent and press Play.', 'At 120 percent the outgoing winding carries 1,200.0 A, the copper loss rises to 4.68 kW, and the machine falls to 98.955 percent. A transformer can be overloaded for a while; what stops it is heat.', {load: 120}),
  ],
  deeper: [
    {title: 'What comes out of it', body: 'The distribution page describes the European arrangement as a three phase four wire system giving a phase to phase voltage of 400 volts and a single phase voltage of 230 volts between any one phase and neutral. The 400 V here is the first of those; what arrives at a socket is the second. In North America the same last transformer gives 120 and 240 V instead.'},
    {title: 'An exact ratio, somewhere', body: 'The distribution transformer page gives a North American pole transformer whose 7.2 kV phase to neutral primary is exactly 30 times the 240 V on its split phase secondary. Ratios like that are not accidents: the whole ladder of voltages is chosen so that the turns come out as workable whole numbers.'},
    {title: 'How small these machines are', body: 'The distribution transformer page says they typically have ratings less than 200 kVA, though some standards allow larger units to be called by the same name. The 400 kVA machine here is at the large end of a street transformer, feeding a few hundred houses. Its regulation figures are 3,250 W of load loss and 387 W of no load loss.'},
    {title: 'Designed for the load it will actually see', body: 'The same page says these machines are energized 24 hours a day even when they carry no load, so reducing iron losses is vital, and that they usually do not operate at full load, so they are designed to have maximum efficiency at lower loads. That is exactly what the bench shows: the best point is at 34.5 percent of rating, not at the top.'},
    {title: 'Why the losses are not the same proportion here', body: 'This machine reaches 99.099 percent at full load where the grid machine reached 99.628 percent. Bigger transformers are better, because the copper and the iron grow with the surface while the power grows with the volume. The transformer page says as much: efficiency tends to improve with increasing transformer capacity.'},
  ],
  misconception: 'The last transformer is not inside the house. It is at the end of the street or in a small building nearby, and the wiring inside a house is all at the voltage that comes out of it.',
  limits: transformerLimits,
  sources: [sources.distributionTransformer, sources.distribution, sources.mains, sources.transformer, sources.ecodesign],
  quiz: {
    question: 'Why is the last transformer before a house designed to be most efficient well below its rating?',
    options: ['Because it spends most of its life carrying a fraction of what it could.', 'Because it is only switched on at times of light load.', 'Because a light load puts more current through its windings.'],
    answer: 0,
    explanation: 'The core loss is paid every hour of the year and the copper loss follows the square of the load. A machine that is rarely busy is best made with a low core loss, which puts its best point at a low load.',
  },
};

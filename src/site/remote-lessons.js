import {REMOTE_DEFAULTS} from './remote-physics.js';

const trial = (defaults, part, view = 'front') => (title, instruction, observe, values = {}) => ({title, instruction, observe, values: {...defaults, ...values}, reset: true, part, isolate: false, view});

export const sources = {
  remoteControl: {title: 'Wikipedia: Remote control', url: 'https://en.wikipedia.org/wiki/Remote_control'},
  consumerIr: {title: 'Wikipedia: Consumer IR', url: 'https://en.wikipedia.org/wiki/Consumer_IR'},
  rc5: {title: 'Wikipedia: RC-5', url: 'https://en.wikipedia.org/wiki/RC-5'},
  carrier: {title: 'Wikipedia: Carrier wave', url: 'https://en.wikipedia.org/wiki/Carrier_wave'},
  bandPass: {title: 'Wikipedia: Band-pass filter', url: 'https://en.wikipedia.org/wiki/Band-pass_filter'},
  agc: {title: 'Wikipedia: Automatic gain control', url: 'https://en.wikipedia.org/wiki/Automatic_gain_control'},
  inverseSquare: {title: 'Wikipedia: Inverse-square law', url: 'https://en.wikipedia.org/wiki/Inverse-square_law'},
  alkaline: {title: 'Wikipedia: Alkaline battery', url: 'https://en.wikipedia.org/wiki/Alkaline_battery'},
  aaa: {title: 'Wikipedia: AAA battery', url: 'https://en.wikipedia.org/wiki/AAA_battery'},
  formats: {title: 'Vishay: Data Formats for IR Remote Control', url: 'https://www.vishay.com/docs/80071/dataform.pdf'},
  tsop: {title: 'Vishay: TSOP382 and TSOP384 IR receiver modules', url: 'https://www.vishay.com/docs/82491/tsop382.pdf'},
  tsal6200: {title: 'Vishay: TSAL6200 infrared emitting diode', url: 'https://www.vishay.com/docs/81010/tsal6200.pdf'},
  tlh: {title: 'Vishay: TLHR540x and TLHY540x LEDs', url: 'https://www.vishay.com/docs/83012/tlhr540x_tlhy540x.pdf'},
  bpw34: {title: 'Vishay: BPW34 silicon PIN photodiode', url: 'https://www.vishay.com/docs/81521/bpw34.pdf'},
  e92: {title: 'Energizer: E92 AAA alkaline cell', url: 'https://data.energizer.com/pdfs/e92.pdf'},
  nexperiaSheet: {title: 'Nexperia: 1N4148 and 1N4448 high speed diodes', url: 'https://assets.nexperia.com/documents/data-sheet/1N4148_1N4448.pdf'},
  nexperiaSpice: {title: 'Nexperia: 1N4148 SPICE model', url: 'https://assets.nexperia.com/documents/spice-model/1N4148.txt'},
  diode: {title: 'Wikipedia: Diode', url: 'https://en.wikipedia.org/wiki/Diode'},
  pn: {title: 'Wikipedia: p-n junction', url: 'https://en.wikipedia.org/wiki/P%E2%80%93n_junction'},
  shockley: {title: 'Wikipedia: Shockley diode equation', url: 'https://en.wikipedia.org/wiki/Shockley_diode_equation'},
  modelling: {title: 'Wikipedia: Diode modeling', url: 'https://en.wikipedia.org/wiki/Diode_modelling'},
  depletion: {title: 'Wikipedia: Depletion region', url: 'https://en.wikipedia.org/wiki/Depletion_region'},
  n4148: {title: 'Wikipedia: 1N4148 signal diode', url: 'https://en.wikipedia.org/wiki/1N4148_signal_diode'},
  thermal: {title: 'Wikipedia: Thermal voltage', url: 'https://en.wikipedia.org/wiki/Thermal_voltage'},
  led: {title: 'Wikipedia: Light-emitting diode', url: 'https://en.wikipedia.org/wiki/Light-emitting_diode'},
  photon: {title: 'Wikipedia: Photon energy', url: 'https://en.wikipedia.org/wiki/Photon_energy'},
  bandGap: {title: 'Wikipedia: Band gap', url: 'https://en.wikipedia.org/wiki/Band_gap'},
  infrared: {title: 'Wikipedia: Infrared', url: 'https://en.wikipedia.org/wiki/Infrared'},
  planck: {title: 'Wikipedia: Planck constant', url: 'https://en.wikipedia.org/wiki/Planck_constant'},
  photodiode: {title: 'Wikipedia: Photodiode', url: 'https://en.wikipedia.org/wiki/Photodiode'},
  pin: {title: 'Wikipedia: PIN diode', url: 'https://en.wikipedia.org/wiki/PIN_diode'},
  dark: {title: 'Wikipedia: Dark current', url: 'https://en.wikipedia.org/wiki/Dark_current_(physics)'},
  shot: {title: 'Wikipedia: Shot noise', url: 'https://en.wikipedia.org/wiki/Shot_noise'},
  nep: {title: 'Wikipedia: Noise-equivalent power', url: 'https://en.wikipedia.org/wiki/Noise-equivalent_power'},
  responsivity: {title: 'Wikipedia: Responsivity', url: 'https://en.wikipedia.org/wiki/Responsivity'},
  quantum: {title: 'Wikipedia: Quantum efficiency', url: 'https://en.wikipedia.org/wiki/Quantum_efficiency'},
  silicon: {title: 'Wikipedia: Silicon', url: 'https://en.wikipedia.org/wiki/Silicon'},
};

/** What the handset's transmitter takes without a source. */
export const transmitterLimits = 'Not from a source: a 15 Ω resistor in the infrared LED\'s loop, 225 mΩ in each cell and a switch with no drop; the infrared LED\'s ideality taken as 2, with its saturation current and series resistance solved through its sheet\'s two typical forward voltages, and its radiant intensity growing as a power of the current between the sheet\'s two typical points; everything at 25 °C.';

/** What the light's path, the receiver and the TV take without a source. */
export const receiverLimits = 'Also not from a source: the light path straight and facing the receiver, with nothing absorbed or reflected; the receiver\'s threshold taken as sharp, and its output delayed 10 carrier cycles and as long as each burst; the TV splitting a 0 from a 1 at 1.6875 ms; a closing burst after the last bit, and the bits sent in the order Vishay\'s note prints them.';

/** What the photodiode takes without a source. */
export const photodiodeLimits = 'Also not from a source: the BPW34 standing in for the receiver module\'s own PIN photodiode, whose size and sensitivity its sheet does not give, reverse biased by 5 V, with its dark current taken from 10 V and its 950 nm responsivity used at 940 nm; its diode law as two exponentials, a diffusion current fitted to its open circuit voltage and a generation current making up the rest of its dark current; one pair drawn for each 1 nA, up to 40.';

/** What the red and yellow LEDs take without a source. */
export const ledLimits = 'Also not from a source: the red and yellow LEDs taking the infrared LED\'s ideality and series resistance, with their saturation currents fitted to their one typical forward voltage; a 100 Ω resistor for the indicator; the infrared LED\'s radiant power in proportion to its radiant intensity; carriers drawn moving at a rate on a log scale of the current, and infrared drawn in violet.';

/** What the 1N4148 takes without a source. */
export const diodeLimits = 'Not from a source: the 1N4148 as Nexperia\'s SPICE model runs it at 25 °C, with the breakdown it puts at 110 V left out, beyond the probe\'s reach; its depletion region drawn as an abrupt junction\'s, its width growing as the square root of the model\'s 0.869 V junction potential less the voltage and never under 0.14 of its width with no voltage, rather than by the model\'s own capacitance law; carriers drawn crossing at a rate on a log scale of the current from 1 nA to 1 A.';

const scales = 'The handset is drawn at true size with an illustrative body and board, the room 250 times smaller and the 1N4148\'s package 10 times larger; the junctions are not to scale, and the frame runs 150 times slower than it does.';

const parts = roles => [
  {name: 'Handset, true size', role: roles[0]},
  {name: 'Room, seen from above', role: roles[1]},
  {name: 'Signal, bit by bit', role: roles[2]},
  {name: 'LED junction, close up', role: roles[3]},
  {name: 'Receiver photodiode, cut open', role: roles[4]},
  {name: '1N4148 junction, close up', role: roles[5]},
];

// ---------------------------------------------------------------------------
// Remote control.
// ---------------------------------------------------------------------------

const remoteSignal = trial(REMOTE_DEFAULTS, 'signal'), remoteRoom = trial(REMOTE_DEFAULTS, 'room'), remoteHandset = trial(REMOTE_DEFAULTS, 'handset'), remoteLed = trial(REMOTE_DEFAULTS, 'led');

export const remoteControlLesson = {
  simple: 'How does a remote control tell the TV which key you pressed?',
  overview: 'A remote control sends a code as flashes of infrared light. Pressing a key wakes an encoder chip, which switches an infrared LED on and off in bursts of a fast carrier, spaced to spell out the key\'s code. A photodiode in the TV\'s receiver turns the flashes into a tiny current, the receiver keeps only bursts at its carrier frequency, and the TV reads the bits from the spacing. Press Play to press a key, then move the TV away, run the cells down or put a hand in the beam.',
  steps: [
    {title: 'Press a key', body: 'The key closes a contact on the board, and the encoder chip looks up the code for that key.'},
    {title: 'Build the frame', body: 'The chip sends a long leader burst, then the handset\'s address and the key\'s command, each followed by its inverse so the TV can check them.'},
    {title: 'Flash the LED', body: 'A transistor switches the infrared LED on and off at the carrier frequency in a burst for every bit, and the indicator LED lights.'},
    {title: 'Cross the room', body: 'The light spreads as it travels, so the irradiance it brings falls as the square of the distance; a hand in the way stops it.'},
    {title: 'Decode the bits', body: 'The receiver\'s photodiode turns each burst into current, its filter keeps only the carrier, and the TV times the gaps between pulses to read each bit.'},
  ],
  parts: parts([
    'The keys, encoder chip, transistor, cells and the two LEDs.',
    'The beam spreading toward the TV, and a hand that can stop it.',
    'The LED\'s bursts, the photodiode\'s current and the receiver\'s output through one frame.',
    'Where electrons and holes meet and give out the light.',
    'Where the light frees the charges that make the signal.',
    'The junction every diode in the chain is built on.',
  ]),
  tryIt: [
    remoteSignal('Send a key', 'Press Play and watch the chart.', 'The leader is a 9 ms burst and 4.5 ms of quiet. Then come 32 bits, each opening with a burst of 22 cycles of the 38 kHz carrier and spaced 1.125 ms apart for a 0 or 2.25 ms for a 1. By the frame\'s end at 68.08 ms the TV has decoded command 26 from address 55.'),
    remoteRoom('Move the TV away', 'Set the distance to 20 m and press Play.', 'At 20 m the light is spread over 16 times the area it covers at 5 m, so only 0.19 mW/m² reaches the receiver. That is still above the 0.12 mW/m² it needs, and the TV decodes command 26.', {distance: 20}),
    remoteRoom('Too far', 'Set the distance to 26 m and press Play.', 'At 26 m the light is down to 0.11 mW/m², under the 0.12 mW/m² the receiver needs. The photodiode still makes 0.6 nA in each burst, but the receiver\'s output stays high and the TV decodes nothing.', {distance: 26}),
    remoteRoom('A hand in the beam', 'Choose a hand in the beam and press Play.', 'The LED still flashes at 106 mA, but no light gets past the hand. The photodiode carries only its 2 nA dark current, and the TV decodes nothing.', {blocked: 1}),
    remoteHandset('Tired cells', 'Set the cells to 1.6 V and press Play.', 'The LED now takes 24.8 mA instead of 106 mA, its radiant intensity falls from 76 to 20 mW/sr, and its light stays above the threshold only out to 12.9 m. At 5 m the TV still decodes command 26.', {battery: 1.6}),
    remoteSignal('Another key', 'Set the command to 255 and press Play.', 'Command 255 sends eight ones, and its inverse eight zeros. Every frame holds as many ones as zeros, so this one also ends at 68.08 ms, and the TV decodes command 255.', {command: 255}),
    remoteLed('The indicator', 'Choose the red indicator and press Play.', 'While the frame is sent the red LED lights, passing 10.4 mA through its 100 Ω resistor at 1.96 V. Its photons carry 1.95 eV each, against 1.32 eV for the infrared LED\'s.', {emitter: 1}),
  ],
  deeper: [
    {title: 'A frame of fixed length', body: 'Vishay\'s note on remote control codes gives the NEC frame: a 9 ms leader burst and 4.5 ms of quiet, then 8 address bits and 8 command bits, each byte followed by its inverse. A byte and its inverse hold 8 ones between them, so every frame has 16 ones at 2.25 ms and 16 zeros at 1.125 ms, 54 ms of bits, and the word always takes 67.5 ms. The note\'s example, address 00110111 and command 00011010, goes out as 00110111 11001000 00011010 11100101, which is what the model sends for command 26.'},
    {title: 'The carrier', body: 'The note gives each bit\'s burst as 22 pulses of 8.77 μs every 26.3 μs: a third of each cycle lit, at 38 kHz. It also calls the burst half of the 1.125 ms bit, 562.5 μs, while 22 cycles at 38 kHz last 578.9 μs; the model sends the 22 cycles. Lit a third of the time and only during bursts, the LED averages 14.6 mA over a frame, and one key press draws 1.00 mC.'},
    {title: 'What the receiver accepts', body: 'The TSOP38438\'s sheet asks for bursts of at least 10 cycles with at least 12 cycles of quiet after each, and no more than 1,700 short bursts a second. The NEC frame\'s bursts are 22 cycles, its shortest quiet 20.75 cycles, and even a run of zeros sends only 889 bursts a second. Read literally, its rule for bursts longer than 70 cycles would ask for 1,710 cycles of quiet after the 342 cycle leader, more than the 1,517 left in the note\'s 108 ms slot; the sheet does not say how it counts a leader, and it marks the NEC code as preferred for this receiver.'},
    {title: 'How far it reaches', body: 'The receiver needs 0.12 mW/m² for an NEC signal, and at most 0.25 mW/m². At 106 mA the LED\'s 76 mW/sr stays above 0.12 mW/m² out to 25.2 m. The receiver\'s sheet gives a typical 30 m with a TSAL6200 at 50 mA; this model\'s 38.0 mW/sr at 50 mA would reach only 17.8 m, and 30 m would need 0.042 mW/m². The sheet does not say how its test was set up, so the gap is left as it stands.'},
    {title: 'Weaker than the dark current', body: 'At 5 m the photodiode makes 15.2 nA in each burst, on top of its 2 nA dark current. At the threshold it makes only 0.6 nA, less than the dark current, yet the dark current is steady and the bursts flash at 38 kHz. In the receiver\'s band of 3.8 kHz the dark current\'s shot noise is 1.56 pA, 384 times smaller than that 0.6 nA.'},
    {title: 'A slowed clock', body: 'The frame runs 150 times slower here: its 68.08 ms and the receiver\'s 263 μs delay take 10.3 s. While a key is held, the NEC code repeats in 108 ms slots, sending only the leader and a single bit after the first frame.'},
  ],
  misconception: 'A remote control does not send a steady beam that the TV simply sees or misses. It sends a code in timed bursts, and the TV acts only on a frame whose bytes check against their inverses.',
  limits: `${scales} ${transmitterLimits} ${receiverLimits} ${photodiodeLimits}`,
  sources: [sources.remoteControl, sources.consumerIr, sources.formats, sources.tsop, sources.tsal6200, sources.bpw34, sources.e92, sources.inverseSquare, sources.shot, sources.photodiode, sources.alkaline, sources.aaa],
  quiz: {
    question: 'Why does the TV ignore a lamp shining on its receiver?',
    options: ['The receiver keeps only light flashing in bursts at its carrier frequency, and a lamp\'s light does not flash that way.', 'The lamp\'s light is too dim to reach the photodiode.', 'The photodiode responds only to infrared, and lamps give out none.'],
    answer: 0,
    explanation: 'Steady light adds only a steady current, which the receiver\'s band pass filter drops. A frame is bursts of the 38 kHz carrier, and the receiver\'s sheet lists light from bulbs and sunlight among what it suppresses.',
  },
};

// ---------------------------------------------------------------------------
// Infrared signaling.
// ---------------------------------------------------------------------------

const signaling = trial(REMOTE_DEFAULTS, 'signal');

export const infraredSignalingLesson = {
  simple: 'How is a key\'s code carried by flashes of light?',
  overview: 'Infrared signaling sends bits as bursts of light rather than as steady light. The NEC code most remotes use switches the LED on and off at a carrier frequency in short bursts of the same length, and tells one bit value from the other by how long the quiet after each burst lasts. The receiver passes only the carrier, turns each burst into a pulse, and the TV times the pulses. Press Play and watch the frame go by, then change the command, the distance and the cells.',
  steps: [
    {title: 'Choose a carrier', body: 'The LED flashes thousands of times a second, and the receiver is tuned to that one rate.'},
    {title: 'Group flashes into bursts', body: 'Every bit opens with a burst of carrier flashes of the same length.'},
    {title: 'Put the bit in the quiet', body: 'A short quiet after the burst means one bit value and a long quiet the other: pulse distance coding.'},
    {title: 'Send each byte twice', body: 'The address and the command each go out as they are and then turned over, so a wrong bit shows.'},
    {title: 'Time the pulses', body: 'The receiver\'s output drops for each burst it hears, and the TV measures the time from one drop to the next.'},
  ],
  parts: parts([
    'The encoder chip that builds the frame and the LED that flashes it.',
    'The path the bursts cross, which a hand can block.',
    'The frame through time: the LED\'s bursts, the photodiode\'s current, the output and the bits.',
    'The junction that turns each burst of current into a burst of light.',
    'The photodiode and chain that turn the bursts back into pulses.',
    'The diode junction the LED and photodiode are both built on.',
  ]),
  tryIt: [
    signaling('Watch a frame', 'Press Play and watch the chart.', 'The leader burst lasts 9 ms, 342 cycles of the carrier, and 4.5 ms of quiet follows. Each bit\'s burst lasts 579 μs, and the receiver\'s output falls 263 μs after each burst begins.'),
    signaling('Read the address', 'Press Play and watch the marks under the output.', 'The first eight marks go short, short, tall, tall, short, tall, tall, tall: the address, 55. The next eight turn each one over, and the TV checks one byte against the other.'),
    signaling('A different command', 'Set the command to 170 and press Play.', 'Command 170 alternates tall and short marks, and its inverse short and tall. The frame still ends at 68.08 ms, and the TV decodes command 170.', {command: 170}),
    signaling('Out of range', 'Set the distance to 30 m and press Play.', 'The LED sends the same bursts, but at 30 m each makes only 0.4 nA in the photodiode, on top of its 2 nA dark current. The light is under the threshold, so the output never falls and no mark appears.', {distance: 30}),
    signaling('Blocked', 'Choose a hand in the beam and press Play.', 'The LED row still shows every burst at 106 mA, but the photodiode row stays at its dark current and the output stays high.', {blocked: 1}),
    signaling('Tired cells', 'Set the cells to 1.6 V and press Play.', 'The bursts in the LED row shrink to 24.8 mA and the photodiode\'s pulses to 4.0 nA, but the bits are timed the same, and the TV still decodes command 26.', {battery: 1.6}),
  ],
  deeper: [
    {title: 'Pulse distance coding', body: 'Vishay\'s note describes pulse distance coding: every burst has the same length, and the time between bursts carries the bit. In the NEC code a 0 is a pulse distance of 1.125 ms and a 1 of 2.25 ms. The model\'s TV splits them at 1.6875 ms, halfway, so a pulse could arrive 562.5 μs early or late and still be read right.'},
    {title: 'Each byte twice', body: 'The address 00110111 goes out and then 11001000, each bit turned over, and the command follows the same way. The TV checks each byte against its inverse, so a single flipped bit shows. It also means a frame always holds 16 ones and 16 zeros, and always takes 67.5 ms to its closing burst.'},
    {title: 'RC5, another code', body: 'The RC5 code uses a 36 kHz carrier and bi-phase coding: each of its 14 bits is half quiet and half a burst of 32 pulses, so a bit lasts 64 carrier periods, 1.778 ms, a word 24.889 ms, and the word repeats every 4,096 periods, 113.778 ms, while a key is held. Vishay\'s note rounds these to 1.78 ms, 24.9 ms and 114 ms, and labels a half bit 868 μs, where 32 cycles of 36 kHz last 888.9 μs. The TSOP38438 needs a little less light for RC5, 0.08 mW/m² against 0.12 mW/m² for NEC.'},
    {title: 'Tuned to the carrier', body: 'The receiver\'s sheet gives its band pass as f0/10 wide at half power, 3.8 kHz at 38 kHz, and says it suppresses steady light and continuous signals at any frequency. Its output falls between 7 and 13 carrier cycles after a burst begins; the model takes 10, 263 μs.'},
    {title: 'One maker, one address', body: 'The Consumer IR page names NEC\'s 38 kHz code as the most common, and says each maker has its own code in the frame, so a TV is not set off by another maker\'s remote. The frame runs 150 times slower here: with the receiver\'s delay its 68.34 ms take 10.3 s.'},
  ],
  misconception: 'The bits are not the carrier\'s flashes. Every bit opens with a burst of the same length, and the bit is in the quiet that follows.',
  limits: `The frame runs 150 times slower than it does. ${transmitterLimits} ${receiverLimits}`,
  sources: [sources.formats, sources.tsop, sources.consumerIr, sources.rc5, sources.carrier, sources.bandPass, sources.agc, sources.remoteControl, sources.tsal6200],
  quiz: {
    question: 'In the NEC code, what tells the TV which bit was sent?',
    options: ['How long the quiet after its burst lasts.', 'How bright its burst is.', 'How many flashes its burst holds.'],
    answer: 0,
    explanation: 'Every bit opens with a burst of 22 cycles. A 0 is a pulse distance of 1.125 ms and a 1 of 2.25 ms, and the TV splits them at 1.6875 ms.',
  },
};

// ---------------------------------------------------------------------------
// Diode.
// ---------------------------------------------------------------------------

const junctionTrial = trial(REMOTE_DEFAULTS, 'junction');

export const diodeLesson = {
  simple: 'Why does a diode let current through one way only?',
  overview: 'A diode is a junction of two kinds of silicon: p type, with spare holes, and n type, with spare electrons. Where they meet, electrons fill holes and leave a thin depletion region with no free carriers and a voltage across it. Make the p side positive and the barrier shrinks, carriers pour across and the current climbs steeply; make it negative and the region widens, so only the few pairs that heat makes can cross. Slide the diode voltage, press Play to set the carriers moving, and watch the junction and its curve.',
  steps: [
    {title: 'Two kinds of silicon', body: 'Impurities give the p side spare holes and the n side spare electrons.'},
    {title: 'A barrier forms', body: 'Near the junction electrons fill holes, leaving a depletion region with no free carriers and a voltage across it.'},
    {title: 'Forward bias', body: 'A positive p side lowers the barrier and narrows the region, so carriers cross and the current rises steeply with the voltage.'},
    {title: 'Reverse bias', body: 'A negative p side raises the barrier and widens the region, so almost nothing crosses.'},
    {title: 'A little leaks', body: 'Heat keeps making pairs in the depletion region, and its field carries them across as a tiny reverse current.'},
  ],
  parts: parts([
    'Where diodes do their work: both LEDs light only when forward biased.',
    'The path between the diode that sends the light and the one that receives it.',
    'The photodiode\'s reverse current, rising with every burst.',
    'A diode whose carriers give out light as they meet.',
    'A diode held in reverse, whose small current follows the light.',
    'The p side, n side and depletion region of a signal diode, with its curve.',
  ]),
  tryIt: [
    junctionTrial('Forward', 'Press Play and watch the junction.', 'At 0.70 V the diode passes 6.45 mA. Holes and electrons stream across a depletion region 0.44 times as wide as with no voltage.'),
    junctionTrial('Its test point', 'Set the diode voltage to 0.72 V and press Play.', 'At 0.72 V it passes 9.34 mA. The model reaches the sheet\'s 10 mA test current at 0.724 V, under the 1 V most the sheet allows.', {probe: 0.72}),
    junctionTrial('A little more voltage', 'Set the diode voltage to 0.8 V and press Play.', 'At 0.80 V it passes 34.40 mA, 5.3 times the current at 0.70 V. Without its 0.6458 Ω series resistance the current would grow tenfold every 113 mV.', {probe: 0.8}),
    junctionTrial('Reverse bias', 'Slide the diode voltage to its lowest setting and press Play.', 'At 20 V reversed only 7.78 nA flows back, well under the sheet\'s 25 nA, and the depletion region is 4.90 times as wide as with no voltage. A few pairs made by heat cross it.', {probe: -20}),
    junctionTrial('No voltage', 'Set the diode voltage to 0 V and press Play.', 'With no voltage no current flows and nothing crosses, yet the depletion region is still there, set by the junction itself.', {probe: 0}),
    junctionTrial('Below the fixed drop', 'Set the diode voltage to 0.6 V and press Play.', 'A fixed drop of 0.7 V would pass nothing at 0.60 V, yet the junction already passes 0.90 mA, and it still passes 0.1 mA at 0.49 V.', {probe: 0.6}),
  ],
  deeper: [
    {title: 'The Shockley equation', body: 'An ideal junction passes I = Is(e^(V/(nVT)) − 1). VT = kT/q is 25.69 mV at 25 °C; the Shockley page gives 25.852 mV at 300 K. Nexperia\'s model of the 1N4148 gives Is = 4.352 nA and n = 1.906, so the current grows tenfold every 113 mV, and in reverse it settles to −Is.'},
    {title: 'Resistance and R1', body: 'A real diode\'s curve levels off at high current: the model puts 0.6458 Ω in series, which at 0.90 V takes 0.068 V of the drop. Beside the diode sits R1 of 5.827 GΩ, which Nexperia says is not a physical part but improves the model in reverse: at 20 V reversed it carries 3.43 nA of the 7.78 nA.'},
    {title: 'Against the sheet', body: 'The sheet promises at most 1 V at 10 mA and 25 nA at 20 V reversed; the model gives 0.724 V and 7.78 nA. The 1N4448 on the same sheet is held to 0.62 to 0.72 V at 5 mA, and the model\'s 1N4148 gives 0.687 V there. Hot, the leakage grows: at a junction of 150 °C the sheet allows 50 μA.'},
    {title: 'The depletion region', body: 'The p-n junction page gives an abrupt junction\'s depletion width as growing with the square root of the voltage across it. Taking the model\'s junction potential of 0.869 V as that voltage with nothing applied, the region is 4.90 times as wide at 20 V reversed and 0.44 times as wide at 0.70 V forward. The same model fits the 1N4148\'s capacitance with a grading coefficient of 0.03, so the real part\'s capacitance changes far less than an abrupt junction\'s would; the drawing follows the abrupt junction.'},
    {title: 'The fixed drop', body: 'Many circuits treat a silicon diode as a fixed drop: the Diode page gives silicon\'s threshold as 0.6 to 0.7 V. The steep curve is why that works: from 0.1 mA to 10 mA, a hundredfold change, the model\'s voltage moves only from 0.492 to 0.724 V.'},
    {title: 'Heat makes pairs', body: 'At room temperature heat keeps making electron and hole pairs. In the depletion region the field sweeps them apart before they meet again, a current that hardly changes with the voltage: the model\'s diode passes 4.35 nA of it at 5 V reversed and at 20 V alike, and R1 adds the rest.'},
  ],
  misconception: 'A diode does not switch on at a fixed voltage. Its current grows steeply but smoothly with the voltage, and the fixed drop is a simplification.',
  limits: `The 1N4148's package is drawn 10 times larger and its junction is not to scale. ${diodeLimits}`,
  sources: [sources.diode, sources.pn, sources.shockley, sources.modelling, sources.depletion, sources.n4148, sources.thermal, sources.nexperiaSheet, sources.nexperiaSpice],
  quiz: {
    question: 'Why does a diode pass almost no current in reverse?',
    options: ['The reverse voltage widens the depletion region and holds the carriers back, so only pairs made by heat cross.', 'A fuse inside the diode opens.', 'The n side runs out of electrons.'],
    answer: 0,
    explanation: 'At 20 V reversed the model\'s 1N4148 passes 7.78 nA, against 6.45 mA at 0.70 V forward.',
  },
};

// ---------------------------------------------------------------------------
// Light-emitting diode.
// ---------------------------------------------------------------------------

const ledTrial = trial(REMOTE_DEFAULTS, 'led');

export const lightEmittingDiodeLesson = {
  simple: 'How does a light-emitting diode turn current into light?',
  overview: 'An LED is a diode whose junction gives out light. Forward biased, electrons from its n side and holes from its p side meet at the junction, and when an electron drops into a hole it can give out a photon carrying about the energy of the material\'s band gap. So the material sets the color, and light of a shorter wavelength needs a higher voltage. Press Play to light the remote\'s LEDs, then choose each LED and change the cells.',
  steps: [
    {title: 'Forward bias', body: 'The cells make the p side positive, so holes and electrons flow toward the junction.'},
    {title: 'Recombine', body: 'At the junction an electron drops into a hole.'},
    {title: 'Give out a photon', body: 'The energy it gives up can leave as a photon, set by the semiconductor\'s band gap.'},
    {title: 'Set the color', body: 'A wider band gap gives photons of more energy and a shorter wavelength: infrared, then red, then yellow.'},
    {title: 'Limit the current', body: 'A resistor in series sets the current, because the LED\'s own current climbs steeply with the voltage.'},
  ],
  parts: parts([
    'The infrared transmitter at the top and the indicator by the keys.',
    'Where the transmitter\'s beam spreads over the room.',
    'The bursts of current that flash the transmitter.',
    'Holes and electrons meeting, and the light they give out, beside the three LEDs\' curves.',
    'The diode at the other end, which turns the light back into current.',
    'The same kind of junction in a diode that gives out no light.',
  ]),
  tryIt: [
    ledTrial('The transmitter', 'Press Play and watch the junction.', 'In each burst the TSAL6200 passes 106.3 mA at 1.36 V, and holes and electrons meet at its junction. Its 940 nm photons carry 1.32 eV each.'),
    ledTrial('Light out, power in', 'Press Play and read the LED close up.', 'Of the 144 mW the LED takes in a burst, 42.3 mW leaves as light, 29%: about 0.30 photons for each electron that crosses.'),
    ledTrial('The red indicator', 'Choose the red indicator and press Play.', 'The TLHR5400 passes 10.4 mA through its 100 Ω resistor at 1.96 V. Its 635 nm photons carry 1.95 eV each, more than the transmitter\'s.', {emitter: 1}),
    ledTrial('Yellow in its place', 'Choose the yellow LED and press Play.', 'The TLHY5400\'s photons carry 2.12 eV at 585 nm, so it needs more voltage: through the same 100 Ω it passes only 6.6 mA, at 2.33 V.', {emitter: 2}),
    ledTrial('Red on tired cells', 'Choose the red indicator, set the cells to 1.6 V and press Play.', 'From 1.6 V the red LED passes only 11.17 μA, about a thousandth of what fresh cells gave it: too dim to see, and drawn dark here.', {emitter: 1, battery: 1.6}),
    ledTrial('Yellow on tired cells', 'Choose the yellow LED, set the cells to 1.6 V and press Play.', 'From 1.6 V the yellow LED passes 4.75 nA and stays dark: each of its photons needs 2.12 eV, more than the 1.6 eV the cells can give an electron.', {emitter: 2, battery: 1.6}),
  ],
  deeper: [
    {title: 'Color from the band gap', body: 'An LED\'s color is set by the energy electrons need to cross its band gap, and a photon\'s energy is hc/λ: 1.32 eV at 940 nm, 1.95 eV at 635 nm and 2.12 eV at 585 nm. Each sheet\'s typical forward voltage sits a little above: 1.35 V at 100 mA for the TSAL6200, 2 V at 20 mA for the TLHR5400 and 2.4 V at 20 mA for the TLHY5400. The Diode page gives about 1.2 V for infrared GaAs, and from 1.6 V for red up to 4 V for violet.'},
    {title: 'How much becomes light', body: 'At 100 mA the TSAL6200\'s sheet gives 40 mW of light for 135 mW in at 1.35 V: 30%, or 0.30 photons for each electron. In the handset, at 106.3 mA, the model gives 42.3 mW of 144 mW, 29%. The LED page notes efficiency droop: an LED\'s efficiency falls as its current rises.'},
    {title: 'Why a resistor', body: 'An LED\'s current grows tenfold for every 118 mV more across its junction, so the voltage alone would set the current poorly. The handset\'s 15 Ω resistor takes 1.59 V and sets the current at 106 mA; with no resistor the cells\' 3.0 V would push 1.27 A through the LED, 13 times its 100 mA rating.'},
    {title: 'Pulses, not steady light', body: 'The TSAL6200\'s sheet allows 100 mA steady, 200 mA in pulses of 100 μs at half duty, and 1.5 A in a surge of 100 μs. The handset lights it a third of each carrier cycle and only in bursts, 9.37 ms in a 68.08 ms frame, so it averages 14.6 mA and one key press draws 1.00 mC.'},
    {title: 'Invisible light', body: 'Infrared begins at about 780 nm, so the 940 nm light is invisible to the eye, though the Remote control page notes a phone camera can see it. Consumer IR uses about 870 nm or 930 to 950 nm, the longer band because water in the air blocks sunlight there, leaving less of it to blind the receiver.'},
    {title: 'Candelas, not watts', body: 'The indicators\' sheet gives their brightness as luminous intensity, 10 mcd at 10 mA for both the red and the yellow: light weighted by how the eye sees it, not its power, so no efficiency is worked out for them. They spread their light to ±30° at half intensity, where the transmitter keeps to ±17° to send more of it toward the TV.'},
  ],
  misconception: 'An LED does not glow because it is hot. Its light comes from electrons dropping into holes at the junction, and its color comes from its material.',
  limits: `The LED's junction is not to scale. ${transmitterLimits} ${ledLimits}`,
  sources: [sources.led, sources.photon, sources.bandGap, sources.diode, sources.infrared, sources.consumerIr, sources.remoteControl, sources.tsal6200, sources.tlh, sources.planck],
  quiz: {
    question: 'Why does a yellow LED need more voltage than an infrared one?',
    options: ['Its photons carry more energy, so each electron must bring more.', 'Yellow light passes through its plastic less easily.', 'Its resistor is larger.'],
    answer: 0,
    explanation: 'A 585 nm photon carries 2.12 eV and a 940 nm photon 1.32 eV. The TLHY5400\'s sheet gives 2.4 V at 20 mA, and the TSAL6200\'s 1.35 V at 100 mA.',
  },
};

// ---------------------------------------------------------------------------
// Photodiode.
// ---------------------------------------------------------------------------

const receiverTrial = trial(REMOTE_DEFAULTS, 'receiver');

export const photodiodeLesson = {
  simple: 'How does a photodiode turn light into a signal?',
  overview: 'A photodiode is a diode held in reverse, so almost no current flows through it in the dark. Light absorbed in its junction frees electrons and holes, the junction\'s field sweeps them apart, and the current rises in step with the light. In a TV\'s receiver it catches the remote\'s bursts. Press Play to send a frame, then move the TV and put a hand in the beam.',
  steps: [
    {title: 'Hold it in reverse', body: 'A voltage across the diode, cathode positive, leaves a wide region with a field across it.'},
    {title: 'Absorb a photon', body: 'A photon with more energy than silicon\'s band gap frees an electron and leaves a hole.'},
    {title: 'Sweep the pair apart', body: 'The field carries the electron to the n side and the hole to the p side before they can meet again.'},
    {title: 'Count the current', body: 'The current is the light\'s power times the responsivity, on top of the dark current.'},
    {title: 'Pick out the signal', body: 'The receiver amplifies the current and keeps only bursts at its carrier frequency.'},
  ],
  parts: parts([
    'The LED whose flashes the photodiode catches.',
    'The distance and the hand that set how much light arrives.',
    'The photodiode\'s current rising with every burst.',
    'The junction at the other end, working the other way round.',
    'The p, intrinsic and n layers, the pairs the light frees, and the receiver\'s chain.',
    'An ordinary junction, whose reverse current comes from heat alone.',
  ]),
  tryIt: [
    receiverTrial('Light in, current out', 'Press Play and watch the photodiode.', 'In each burst 3.05 mW/m² falls on its 7.5 mm² and frees 15.2 nA, on top of the 2 nA dark current. The field sweeps each pair apart.'),
    receiverTrial('Twice as far', 'Set the distance to 10 m and press Play.', 'At 10 m the light is spread over four times the area, so the irradiance falls to 0.76 mW/m² and the photocurrent to 3.8 nA, a quarter of the 15.2 nA at 5 m.', {distance: 10}),
    receiverTrial('Close up', 'Set the distance to 1 m and press Play.', 'At 1 m the photodiode makes 380.7 nA in each burst, 190 times its dark current.', {distance: 1}),
    receiverTrial('In the dark', 'Choose a hand in the beam and press Play.', 'No light arrives. Only the 2 nA dark current flows, from pairs made by heat, and the receiver\'s chain stays unlit.', {blocked: 1}),
    receiverTrial('Weaker than the dark current', 'Set the distance to 25 m and press Play.', 'At 25 m each burst frees only 0.6 nA, less than the dark current. But the bursts flash at 38 kHz and the dark current does not, so the receiver still passes them and the TV decodes command 26.', {distance: 25}),
    receiverTrial('Past its reach', 'Set the distance to 27 m and press Play.', 'At 27 m the light falls to 0.10 mW/m², under the receiver\'s 0.12 mW/m². The photodiode\'s block still lights, but the receiver\'s chain goes no further and nothing is decoded.', {distance: 27}),
  ],
  deeper: [
    {title: 'Responsivity', body: 'The BPW34 passes 50 μA in reverse under 1 mW/cm² of 950 nm light. On its 7.5 mm² that light is 75 μW, so its responsivity is 0.667 A/W. A 950 nm photon carries 1.31 eV, so 0.667 A/W is 0.87 electrons for each photon.'},
    {title: 'Silicon\'s cutoff', body: 'Silicon\'s band gap of 1.12 eV matches a photon of 1,107 nm; longer wavelengths carry too little energy to free a pair and pass through. The BPW34\'s sheet gives its sensitivity from 430 to 1,100 nm, peaking at 900 nm, but only as a plot, so the model uses its 950 nm responsivity at the remote\'s 940 nm.'},
    {title: 'Dark current', body: 'With no light the BPW34 passes 2 nA at 10 V reversed, and at most 30 nA: pairs that heat makes in its depletion region. A PIN diode\'s wide intrinsic layer keeps that region almost the same size at any reverse bias, and the model uses the same 2 nA at 5 V. Light of 0.4 mW/m² would make as much current.'},
    {title: 'Shot noise', body: 'A current made of separate charges carries shot noise √(2qIΔf). For the 2 nA dark current that is 2.53 × 10⁻¹⁴ A/√Hz, and divided by the responsivity a noise equivalent power of 3.80 × 10⁻¹⁴ W/√Hz, against the 4 × 10⁻¹⁴ W/√Hz on the sheet. In the receiver\'s 3.8 kHz band it is 1.56 pA, so even the 0.6 nA at the threshold stands 384 times above it.'},
    {title: 'Without the bias', body: 'Left open, a photodiode makes a voltage instead, like a solar cell: the sheet gives 350 mV under 1 mW/cm². The model rebuilds that with two currents, a diffusion current of 54.9 pA and a generation current of 1.95 nA, and gives 102 mV at 5 m. Reverse biased, in photoconductive mode, its current follows the light instead.'},
    {title: 'Inside the receiver', body: 'The TSOP38438 holds a PIN photodiode and a preamplifier, with an IR filter in its epoxy, and its sheet draws the chain as automatic gain control, band pass and demodulator. It draws 0.35 mA at 3.3 V, needs 0.12 mW/m² for the NEC code and at most 0.25, and still times its pulses right up to 30 W/m². Its own photodiode\'s size and sensitivity are not given, so the BPW34 stands in for it.'},
  ],
  misconception: 'A photodiode does not store light or glow. Each photon it absorbs frees a pair of charges, and the current follows the light as it arrives.',
  limits: `The photodiode is not to scale. ${transmitterLimits} ${receiverLimits} ${photodiodeLimits}`,
  sources: [sources.photodiode, sources.pin, sources.dark, sources.shot, sources.nep, sources.responsivity, sources.quantum, sources.silicon, sources.bandGap, sources.bpw34, sources.tsop, sources.agc],
  quiz: {
    question: 'Why is a photodiode held in reverse bias?',
    options: ['So its current follows the light, with only a small dark current when none falls.', 'So it gives out light the way an LED does.', 'So it stores charge between bursts.'],
    answer: 0,
    explanation: 'Reversed, the BPW34 passes 2 nA in the dark and 15.2 nA more in each burst at 5 m: its 0.667 A/W times the light\'s power.',
  },
};

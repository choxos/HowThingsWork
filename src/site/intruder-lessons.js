import {INTRUDER_DEFAULTS} from './intruder-physics.js';

const trial = (defaults, part, view = 'front') => (title, instruction, observe, values = {}) => ({title, instruction, observe, values: {...defaults, ...values}, reset: true, part, isolate: false, view});

export const sources = {
  optex: {title: 'Optex: AX-100TFR and AX-200TFR installation instructions', url: 'https://s3-eu-west-1.amazonaws.com/optex-europe/sensor-downloads/Intrusion-Detection/Manuals/optex-ax-100-200tfr-manual-en.pdf'},
  emitter: {title: 'Vishay: TSAL6100 high power infrared emitting diode, 940 nm', url: 'https://www.vishay.com/docs/81009/tsal6100.pdf'},
  photodiode: {title: 'Vishay: BPV10NF silicon PIN photodiode', url: 'https://www.vishay.com/docs/81503/bpv10nf.pdf'},
  papirs: {title: 'Panasonic: PaPIRs EKM standard detection type', url: 'https://datasheet.octopart.com/EKMB1301112K-Panasonic-datasheet-137355968.pdf'},
  papirsNotes: {title: 'Panasonic: PIR motion sensor EKMB, EKMC, AMN2, 3', url: 'https://media.digikey.com/pdf/Data%20Sheets/Panasonic%20Sensors%20PDFs/EKMB_MC_AMN2_3_Rev_Sep_2012.pdf'},
  lhi: {title: 'Excelitas: LHi 968 pyroelectric detector', url: 'https://datasheet.octopart.com/LHI-968-Excelitas-Technology-datasheet-71248.pdf'},
  murata: {title: 'Murata: pyroelectric infrared sensors, catalog S21E', url: 'https://docs.rs-online.com/2936/0900766b80ef302b.pdf'},
  pir: {title: 'Wikipedia: Passive infrared sensor', url: 'https://en.wikipedia.org/wiki/Passive_infrared_sensor'},
  pyro: {title: 'Wikipedia: Pyroelectricity', url: 'https://en.wikipedia.org/wiki/Pyroelectricity'},
  fresnel: {title: 'Wikipedia: Fresnel lens', url: 'https://en.wikipedia.org/wiki/Fresnel_lens'},
  photoelectric: {title: 'Wikipedia: Photoelectric sensor', url: 'https://en.wikipedia.org/wiki/Photoelectric_sensor'},
  motion: {title: 'Wikipedia: Motion detector', url: 'https://en.wikipedia.org/wiki/Motion_detector'},
  stefan: {title: 'Wikipedia: Stefan-Boltzmann law', url: 'https://en.wikipedia.org/wiki/Stefan%E2%80%93Boltzmann_law'},
  wien: {title: 'Wikipedia: Wien’s displacement law', url: 'https://en.wikipedia.org/wiki/Wien%27s_displacement_law'},
  planck: {title: 'Wikipedia: Planck’s law', url: 'https://en.wikipedia.org/wiki/Planck%27s_law'},
  emissivity: {title: 'Wikipedia: Emissivity', url: 'https://en.wikipedia.org/wiki/Emissivity'},
  infrared: {title: 'Wikipedia: Infrared', url: 'https://en.wikipedia.org/wiki/Infrared'},
  walking: {title: 'Wikipedia: Preferred walking speed', url: 'https://en.wikipedia.org/wiki/Preferred_walking_speed'},
  security: {title: 'Wikipedia: Security alarm', url: 'https://en.wikipedia.org/wiki/Security_alarm'},
};

/** What the passive detector takes without a source, in both lessons. */
export const zoneLimits = 'Not from a source: the lens, 5 facets in one row of 12.5 mm focal length aimed at the walker’s middle, with the two elements 1 mm apart; their thermal lag of 0.1 s and electrical leak of 1.0 s; a threshold of 50.0 μV, the largest noise the sheet allows; everything in view warming together; and the facets’ collecting area of 0.230 mm², fitted so that Panasonic’s test target just reaches the threshold at the 5 m its sheet specifies. The lens’s transmission, its blur and everything else lost between the room and the elements sit inside that one fitted area, so it is far smaller than a facet of the drawn lens. The walker is Panasonic’s target, 700 by 250 mm at one surface temperature, walking a straight line at a steady speed with the room settled before the watch begins. A real detector stacks several rows of zones, amplifies before it decides, and counts pulses; here one row, the elements’ own volts and one crossing of the threshold are enough.';

/** What the beam barrier takes without a source. */
export const beamLimits = 'Not from a source: the beam is taken as a line between the two lenses, so the body either covers it or does not; Optex’s maximum arrival distance of 265 m is taken as where the beam falls to what the receiver needs, with its power falling as the square of the distance; and the transmitter flashes 1,000 times a second, with the receiver answering every flash. The second beam Optex stacks above the first, the alignment of the two lenses, and rain, snow and fog, which weaken the beam until the receiver reports trouble, are all left out.';

// ---------------------------------------------------------------------------
// Active burglar alarm: the machine, with both methods.
// ---------------------------------------------------------------------------

const beamAt = trial({...INTRUDER_DEFAULTS, mode: 0}, 'crossing'), beamSignal = trial({...INTRUDER_DEFAULTS, mode: 0}, 'signal');
const beamPlan = trial({...INTRUDER_DEFAULTS, mode: 0}, 'beam');
const zoneSignal = trial({...INTRUDER_DEFAULTS, mode: 1}, 'signal'), zonePlan = trial({...INTRUDER_DEFAULTS, mode: 1}, 'zones');

export const activeBurglarAlarmLesson = {
  simple: 'How does an alarm notice someone it cannot see?',
  overview: 'An active alarm sends something out and watches for it to come back or to arrive. This one flashes infrared across a path from a transmitter to a receiver, and sounds when the beam stays blocked for longer than its setting waits out. A passive alarm sends nothing: a lens splits its view into zones, each landing on one of two pyroelectric elements wired against each other, and a warm body crossing the zones makes the pair swing one way and then the other. Choose a method and press Play to send a walker across.',
  steps: [
    {title: 'Flash the beam', body: 'The transmitter pulses an infrared diode at a rate of its own, so the receiver can tell its beam from sunlight and from the next barrier along.'},
    {title: 'Watch the beam arrive', body: 'The receiver has far more light than it needs while the path is clear, which is what leaves room for dirt and weather.'},
    {title: 'Wait out the interruption', body: 'A body covering the line cuts every flash off. The receiver sounds only if that lasts longer than the setting on its board, so a bird or a leaf passes unremarked.'},
    {title: 'Or send nothing at all', body: 'The passive detector has no emitter. Its lens gathers the infrared the room already gives off, sorting directions into zones that land on one element or the other.'},
    {title: 'Answer to the difference', body: 'The two elements are wired against each other, so warmth spread over the whole view cancels and only a body crossing from one zone to the next moves the output.'},
  ],
  parts: [
    {name: 'Two burglar alarms, from above', role: 'The barrier across a path and the detector on a wall, side by side.'},
    {name: 'Beam barrier, from above', role: 'The transmitter, the receiver and the beam the walker crosses.'},
    {name: 'Where the walker crosses the beam', role: 'The body covering the line, close up.'},
    {name: 'Detection zones, from above', role: 'The strips of room the lens sends onto each element.'},
    {name: 'Fresnel lens and its two elements, cut open', role: 'Where a direction lands once the facets have bent it.'},
    {name: 'What the alarm sees', role: 'The power arriving at the receiver, or what the two elements give.'},
  ],
  tryIt: [
    beamAt('Walk through the beam', 'Press Play and watch the walker reach the line.', 'The beam arrives 78 times stronger than the receiver needs. The body covers the line for 250 ms, longer than the 50 ms this setting waits out, so the alarm sounds 1.93 s into the watch.'),
    beamSignal('Wait out a slow crossing', 'Choose the slow movement setting, 500 ms, and press Play.', 'The body still covers the line for 250 ms, half of the 500 ms this setting waits out, so the beam comes back before the receiver has counted it out and nothing sounds. At this setting only a walker at 0.5 m/s or slower is caught.', {hold: 500}),
    beamAt('Jog past the walking setting', 'Set the walker to 3.0 m/s, choose the walking setting, 250 ms, and press Play.', 'At 3.0 m/s the body covers the line for only 83 ms, so the receiver lets the jogger through: this setting catches a walker at 1.0 m/s or slower.', {speed: 3, hold: 250}),
    beamPlan('Stand in the beam', 'Set the walker to 0 m/s, so it stands on the line, and press Play.', 'A body that does not move covers the line all the same, so no flash arrives and the alarm sounds from the start of the watch. A barrier catches a still body, which the passive detector cannot.', {speed: 0}),
    beamSignal('Bring the posts closer', 'Set the posts 10 m apart and press Play.', 'The beam now arrives 702 times stronger than the threshold rather than 78, since its power falls as the square of the distance. Flashed bare at 1 A the emitter would drive 87.0 nA through the photodiode, 870 times its dark current.', {span: 10}),
    zoneSignal('Send nothing out', 'Choose passive infrared zones and press Play.', 'The walker, 4 °C warmer than the room, sends 23.2 W/m² more than the wall behind. Crossing the zones 5.0 m away it swings the pair to the 50.0 μV threshold 6.07 s into the watch.', {mode: 1}),
    zonePlan('Stand still in the zones', 'Choose passive infrared zones, set the walker to 0 m/s and press Play.', 'The + element keeps taking 11.87 nW more than the − element for the whole watch, and the output holds at 0.0 μV. What the barrier catches at once, the passive detector cannot see at all.', {mode: 1, speed: 0}),
  ],
  deeper: [
    {title: 'A beam with power to spare', body: 'Optex rates the AX-100TFR for 30 m and gives 265 m as the farthest its beam still arrives. Take that as the distance where the beam falls to what the receiver needs, and take its power to fall as the square of the distance: at 30 m the receiver has 78 times what it needs, and at 10 m 702 times. That spare power is not waste. It is what lets the barrier keep working through dirt on the lens, and Optex has its receiver report trouble when rain, snow or heavy fog hold the beam below its level for more than 20 s.'},
    {title: 'Flashes, not a glow', body: 'The transmitter flashes rather than shining steadily. Vishay’s TSAL6100 gives 1,450 mW/sr in 100 μs flashes of 1 A against 170 mW/sr at a steady 100 mA, 8.5 times as much, and the receiver answers only to flashes at its own rate, so steady sunlight moves it not at all. Optex gives its barriers 4 such rates so that two of them side by side do not answer each other. The lenses matter: bare, flashed at 1 A, the emitter would drive 9.7 nA through a BPV10NF photodiode 30 m away, 97 times its dark current of 0.1 nA, and a real barrier gathers far more than that with a lens at each end.'},
    {title: 'How long is long enough', body: 'The receiver counts how long the beam stays dark. Optex offers 50, 100, 250 and 500 ms, named for running, jogging, walking and slow movement. Panasonic’s test target is 250 mm deep across its path, so those settings catch anything at 5.0, 2.5, 1.0 and 0.5 m/s or slower: a typical walk of 1.4 m/s covers the line for 179 ms, which the running and jogging settings catch and the walking setting does not.'},
    {title: 'Warm bodies shine in the dark', body: 'Stefan and Boltzmann give the power a surface radiates as εσT⁴. Skin, whose emissivity the Emissivity page puts at 0.97 to 0.999, at 4 °C over a room at 25 °C sends 24.0 W/m² more than the wall behind it, and 23.2 W/m² of that, 96%, lies beyond the 5 μm where the sensor’s filter opens. Wien’s law puts the peak of the body’s spectrum at 9.59 μm and the room’s at 9.72 μm, both around the 10 μm the Infrared page gives for a body at normal temperature.'},
    {title: 'Two elements, wired against each other', body: 'The Passive infrared sensor page says pairs of elements are wired as opposite inputs, so that infrared rising across the whole sensor cancels itself and only a moving source shows. With everything in view warming at 30 °C a minute, one element alone would give 67.9 μV, past the 50.0 μV threshold; the pair, matched to 1% on the LHi 968’s sheet, gives 0.9 μV.'},
    {title: 'The other kind of active detector', body: 'The barrier here is the simplest active detector: something sent from one post to another. The Motion detector page describes the other kind, which fills a room with microwaves or ultrasound and listens for the frequency of the reflection to change, the way a radar speed trap does, and that is the arrangement an automatic door usually watches you with. Detectors that carry both a microwave sender and a passive infrared pair sound only when the two agree, which is how they shrug off a warm draft or a swinging branch.'},
  ],
  misconception: 'A passive detector sends nothing out, so there is no beam across the room to step over. What it cannot do is notice a body that holds still, which is exactly what the barrier is best at.',
  limits: `${beamLimits} ${zoneLimits} The clock runs in real time, 4 s of it for the beam and 12 s for the zones.`,
  sources: [sources.optex, sources.emitter, sources.photodiode, sources.photoelectric, sources.papirs, sources.papirsNotes, sources.lhi, sources.murata, sources.pir, sources.pyro, sources.motion, sources.stefan, sources.wien, sources.emissivity, sources.infrared, sources.walking, sources.security],
  quiz: {
    question: 'Why does someone standing still set the barrier off but not the passive detector?',
    options: [
      'The barrier needs its beam to arrive and a still body covers it all the same, while the passive detector answers only to change.',
      'The passive detector switches itself off while nothing in the room moves.',
      'A body that stands still stops giving off infrared.',
    ],
    answer: 0,
    explanation: 'Standing on the line keeps every flash from arriving, so the receiver sounds after the 50 ms it waits out. Standing in a zone keeps the + element 11.87 nW above the − element, steadily, and the output holds at 0.0 μV.',
  },
};

// ---------------------------------------------------------------------------
// Passive infrared movement detector.
// ---------------------------------------------------------------------------

const zoneWalk = trial({...INTRUDER_DEFAULTS, mode: 1}, 'zones'), zoneLens = trial({...INTRUDER_DEFAULTS, mode: 1}, 'lens'), zoneChart = trial({...INTRUDER_DEFAULTS, mode: 1}, 'signal');

export const passiveInfraredLesson = {
  simple: 'How does a detector feel a warm body move without sending anything out?',
  overview: 'Everything warm gives off infrared, and a body gives off more than the wall behind it. A faceted lens sorts directions into zones: half of them land on one pyroelectric element and half on the other, and the two are wired against each other. A body crossing from a zone of one element into a zone of the other changes the power on them unequally, and the elements answer to change alone, so warmth spread over the whole view, and a body standing still, both pass unnoticed. Press Play to send a walker across, and change the path, the speed and how much warmer than the room the body is.',
  steps: [
    {title: 'Give off heat', body: 'The walker’s surface is warmer than the walls, so it sends more infrared toward the lens than the background it hides.'},
    {title: 'Sort directions into zones', body: 'Each facet of the lens gathers one narrow strip of the room and lays its image across the elements, so a direction becomes a place.'},
    {title: 'Land on one element', body: 'The image of a body to the right of a facet’s axis falls on the element to the left, and a body a little farther right falls in the gap, where neither element sees it.'},
    {title: 'Change, and be measured', body: 'A pyroelectric element makes a voltage while it is warming or cooling, and its charge leaks away when the warming stops, so a steady view gives nothing.'},
    {title: 'Take the difference', body: 'The elements are wired against each other, so only the difference leaves the pair: it swings one way as the body enters a zone of the first element and the other way as it reaches a zone of the second.'},
  ],
  parts: [
    {name: 'Detection zones, from above', role: 'The strips of room the facets send onto each element, and the path the walker takes.'},
    {name: 'Fresnel lens and its two elements, cut open', role: 'The facets, and where the body’s infrared lands on the pair.'},
    {name: 'What the alarm sees', role: 'The power on each element, and the difference the pair gives.'},
    {name: 'Two burglar alarms, from above', role: 'The barrier beside it, for comparison.'},
  ],
  tryIt: [
    zoneWalk('Walk across the zones', 'Press Play and watch the walker cross the fan of zones.', 'The body crosses a − zone, then a gap, then a + zone, and the output swings one way and then the other. It reaches the 50.0 μV threshold 6.07 s in, swinging at 0.59 Hz, where the elements give 4,332 V/W.'),
    zoneLens('Follow a direction onto an element', 'Press Play and watch the lens while the walker crosses.', 'Each facet turns a direction into a place on the pair 12.5 mm behind it, so the body to the right of a facet’s axis lands on the left element. At 5.0 m each zone is 0.40 m wide and the next + zone is 1.71 m along the path.'),
    zoneChart('Come closer', 'Set the path 3.0 m from the detector and press Play.', 'The zones are narrower here, 0.24 m across, and the body fills more of each: the output peaks at 81.7 μV and crosses the threshold 10 times instead of once.', {range: 3}),
    zoneChart('Twice as warm as the room', 'Set the body 8.0 °C over the room, the path 7.0 m away, and press Play.', 'Twice the difference sends 47.3 W/m² instead of 23.2, and this walk now reaches out to 7.3 m, 1.45 times the 5.0 m it reaches at 4 °C. Panasonic gives about 1.4 times, and 7 m, for its own sensors.', {contrast: 8, range: 7}),
    zoneWalk('Stand still in a zone', 'Set the walker to 0 m/s and press Play.', 'The + element keeps taking 11.87 nW more than the − element, but the output holds at 0.0 μV: what the elements answer to is change, and there is none.', {speed: 0}),
    zoneChart('Warm the whole view', 'Set the walker to 0 m/s, warm everything in view at 30 °C a minute and press Play.', 'Sunlight or warm air raises the power on both elements together. One element alone would read 67.9 μV, past the threshold; wired against each other and matched to 1%, the pair gives 0.9 μV and nothing sounds.', {speed: 0, warming: 30}),
    zoneChart('Run past', 'Set the walker to 6.0 m/s and press Play.', 'Crossing a zone faster than the elements can warm, the swing at 3.52 Hz meets a responsivity of 1,970 V/W rather than the 4,000 V/W the sheet gives at 1 Hz. The output peaks at 20.8 μV and no path within 10 m of the detector trips it.', {speed: 6}),
  ],
  deeper: [
    {title: 'Heat you cannot see', body: 'Stefan and Boltzmann give a surface’s power as εσT⁴. Taking skin at an emissivity of 0.98, inside the 0.97 to 0.999 the Emissivity page gives, a body 4 °C over a room at 25 °C sends 24.0 W/m² more than the wall it hides, and 23.2 W/m² of that, 96%, lies beyond the 5 μm at which the Murata sheet’s filter opens. Wien’s law puts the body’s peak at 9.59 μm and the room’s at 9.72 μm: both are heat, and the detector must pick one out against the other.'},
    {title: 'Zones out of facets', body: 'Each element is 1 mm wide and 2 mm tall and sits 12.5 mm behind a facet, which makes a zone 4.55° wide and 9.15° tall; the 1 mm gap between the elements becomes a blind strip of the same kind. Five facets put 10 zones across 87°, and at 5 m each is 0.40 m wide with the next + zone 1.71 m along the path. Panasonic packs 64 zones behind a lens 9.5 mm across, and the Fresnel lens page notes that a detector wants no image at all, only energy gathered from a wide view.'},
    {title: 'Only while it changes', body: 'The Pyroelectricity page says such a crystal makes a temporary voltage when it is heated or cooled, and that the voltage fades through leakage once the temperature settles. The model gives the elements a thermal lag of 0.1 s and an electrical leak of 1.0 s, neither from a source, which together turn the sheet’s 4,000 V/W at 1 Hz into 4,332 V/W at the 0.59 Hz of a walk and 1,970 V/W at the 3.52 Hz of a run. The threshold, 50.0 μV, is the largest noise the LHi 968’s sheet allows over its 0.3 to 10 Hz band.'},
    {title: 'Why there are two', body: 'A single element would answer to anything that warmed its whole view: sunlight moving across a floor, or warm air from a heater. Wired against each other, the pair subtracts. With everything in view warming at 30 °C a minute, one element alone would give 67.9 μV and the pair 0.9 μV, all of it the 1% by which the two elements fail to match. Panasonic warns of the other side of the same coin: a body that enters a + zone and a − zone at once cancels itself, and may not be detected at all.'},
    {title: 'Farther when the difference is larger', body: 'The signal grows with the difference in temperature and falls with the square of the distance, so the range grows as the square root of the difference. The model’s collecting area is fitted so the standard target reaches the threshold at 5.0 m at 4 °C; at 8 °C the same walk reaches 7.3 m, 1.45 times as far, against the about 1.4 times, and the 7 m, Panasonic gives. A body only 1 °C from the room is not caught at any distance the model watches.'},
    {title: 'Photodiodes in the drawing', body: 'Books often draw the passive detector as a line of lenses focusing infrared onto photodiodes. A photodiode does answer to infrared, but to the near infrared of a remote control rather than the far infrared of a body: what sits behind the lens of a real detector is a pair of pyroelectric elements, as Murata, Excelitas and Panasonic all sell them. The other thing worth knowing from Panasonic: a body walking straight toward the detector, rather than across its view, moves from zone to zone so slowly that it may not be detected.'},
  ],
  misconception: 'A passive detector does not measure how warm you are. It answers only while the infrared falling on its two elements changes by different amounts, which is why it sees you crossing its zones and not standing between them.',
  limits: `The zones are drawn 50 times smaller than true size and the lens and elements 8 times larger, and the clock runs in real time, 12 s of it. ${zoneLimits}`,
  sources: [sources.pir, sources.pyro, sources.fresnel, sources.lhi, sources.murata, sources.papirs, sources.papirsNotes, sources.stefan, sources.wien, sources.planck, sources.emissivity, sources.infrared, sources.motion, sources.walking],
  quiz: {
    question: 'Why does a room warming slowly not set a passive detector off?',
    options: [
      'Both elements warm together, and wired against each other their signals cancel.',
      'The lens will not pass a change that slow.',
      'Warm air gives off no infrared at all.',
    ],
    answer: 0,
    explanation: 'With everything in view warming at 30 °C a minute, one element alone would read 67.9 μV, past the 50.0 μV threshold, while the matched pair gives 0.9 μV.',
  },
};

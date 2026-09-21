import {SMOKE_DEFAULTS} from './smoke-physics.js';

const trial = (defaults, part, view = 'front') => (title, instruction, observe, values = {}) => ({title, instruction, observe, values: {...defaults, ...values}, reset: true, part, isolate: false, view});

export const sources = {
  smokeDetector: {title: 'Wikipedia: Smoke detector', url: 'https://en.wikipedia.org/wiki/Smoke_detector'},
  americium: {title: 'Wikipedia: Americium-241', url: 'https://en.wikipedia.org/wiki/Americium-241'},
  ionizationChamber: {title: 'Wikipedia: Ionization chamber', url: 'https://en.wikipedia.org/wiki/Ionization_chamber'},
  alpha: {title: 'Wikipedia: Alpha particle', url: 'https://en.wikipedia.org/wiki/Alpha_particle'},
  stopping: {title: 'Wikipedia: Stopping power (particle radiation)', url: 'https://en.wikipedia.org/wiki/Stopping_power_(particle_radiation)'},
  astar: {title: 'NIST ASTAR: stopping powers and ranges for alpha particles', url: 'https://physics.nist.gov/PhysRefData/Star/Text/ASTAR.html'},
  tn973: {title: 'NBS Technical Note 973: Smoke Detector Design and Smoke Properties', url: 'https://nvlpubs.nist.gov/nistpubs/Legacy/TN/nbstechnicalnote973.pdf'},
  tn1455: {title: 'NIST Technical Note 1455: Performance of Home Smoke Alarms', url: 'https://nvlpubs.nist.gov/nistpubs/Legacy/TN/nbstechnicalnote1455.pdf'},
  mie: {title: 'Wikipedia: Mie scattering', url: 'https://en.wikipedia.org/wiki/Mie_scattering'},
  rayleigh: {title: 'Wikipedia: Rayleigh scattering', url: 'https://en.wikipedia.org/wiki/Rayleigh_scattering'},
  beerLambert: {title: 'Wikipedia: Beer-Lambert law', url: 'https://en.wikipedia.org/wiki/Beer%E2%80%93Lambert_law'},
  einstein: {title: 'Wikipedia: Einstein relation (kinetic theory)', url: 'https://en.wikipedia.org/wiki/Einstein_relation_(kinetic_theory)'},
  diffusion: {title: 'Wikipedia: Diffusion-controlled reaction', url: 'https://en.wikipedia.org/wiki/Diffusion-controlled_reaction'},
  mobility: {title: 'Wikipedia: Ionocraft, for the mobility of air ions', url: 'https://en.wikipedia.org/wiki/Ionocraft'},
  airDensity: {title: 'Wikipedia: Density of air', url: 'https://en.wikipedia.org/wiki/Density_of_air'},
  gold: {title: 'Wikipedia: Gold', url: 'https://en.wikipedia.org/wiki/Gold'},
  battery: {title: 'Wikipedia: Nine-volt battery', url: 'https://en.wikipedia.org/wiki/Nine-volt_battery'},
  mc14467: {title: 'Freescale MC14467-1 ionization smoke detector IC, from the Internet Archive', url: 'https://web.archive.org/web/20081207134617id_/http://www.freescale.com/files/analog/doc/data_sheet/MC14467-1.pdf'},
  re46c190: {title: 'Microchip RE46C190 photoelectric smoke detector ASIC, from the Internet Archive', url: 'https://web.archive.org/web/20190201191308id_/http://ww1.microchip.com/downloads/en/DeviceDoc/RE46C190-DS-20002271C-Final1.pdf'},
  tsal6200: {title: 'Vishay TSAL6200 infrared emitting diode', url: 'https://www.vishay.com/docs/81010/tsal6200.pdf'},
  bpw34: {title: 'Vishay BPW34 silicon photodiode', url: 'https://www.vishay.com/docs/81521/bpw34.pdf'},
};

/** What every lesson here takes without a source. */
export const smokeLimits = 'Not from a source: the chamber drawn as two halves of one cylinder over one source, 10 mm in radius, the open half 15 mm from the source to its plate and the sealed half 24.7 mm, which is where calibration puts it so that a smoke of 0.3 μm sounds the alarm near the middle of NIST’s range; a quarter of the decays into each half, the silver backing taking the rest; a recombination coefficient of 1.6 × 10⁻¹² m³/s; a low battery trip of 7.5 V, inside the datasheet’s window; the optical chamber’s 12 mm from the emitter to the smoke and 12 mm on to the photodiode, a lit volume 6 mm across and 10 mm long, a beam 30 mm long inside the chamber and 10 m across a room; smoke of one size at a time, of refractive index 1.5 and density 1,000 kg/m³, growing at a steady rate and reaching a chamber with a lag of 20 s; and a run of 10 minutes.';

/** What the model leaves out. */
export const smokeLeftOut = 'Left out: the ion cloud is taken as evenly spread through each chamber, though the alphas leave their pairs along their tracks, and the pairs one alpha leaves are counted for a chamber with no wall through it, so the divider between the halves is ignored; particles are taken as uncharged spheres that catch ions at the diffusion limit, which flatters the smallest of them; soot absorbs light and the smoke here only scatters it; air movement through the chambers, humidity, dust and the drift of a source over years are all absent; and the horn is drawn as arcs, not heard.';

const parentChart = trial(SMOKE_DEFAULTS, 'chart'), parentIons = trial(SMOKE_DEFAULTS, 'ions'), parentChamber = trial(SMOKE_DEFAULTS, 'chamber'), parentCircuit = trial(SMOKE_DEFAULTS, 'circuit');

// ---------------------------------------------------------------------------
// Smoke detector.
// ---------------------------------------------------------------------------

export const smokeDetectorLesson = {
  simple: 'How does a smoke alarm know there is a fire before you do?',
  overview: 'A smoke alarm watches a small sample of the air. In one kind, a speck of americium keeps the air inside a chamber ionized, a battery draws a tiny current through it, and smoke particles drifting in catch ions on their way to the plates, so the current falls. In the other kind, an infrared emitter shines across a dark chamber and a photodiode sits off to one side, seeing nothing until smoke arrives to send some of that light its way. Either way a comparator watches one number, and when it crosses a line the horn sounds. Press Play to let smoke build up in the room and watch both kinds decide.',
  steps: [
    {title: 'Ionize the air', body: 'A speck of americium fires alpha particles across an air gap, and each one knocks electrons off air molecules along its path, leaving pairs of charged air.'},
    {title: 'Draw a current', body: 'A voltage across the gap pulls the two kinds of ion to opposite plates. The current that flows is smaller than anything a household circuit carries.'},
    {title: 'Let smoke catch the ions', body: 'Smoke particles drifting into the open chamber catch ions and lumber toward the plates far more slowly, so fewer charges arrive and the current falls.'},
    {title: 'Or scatter a beam of light', body: 'In an optical chamber the emitter faces away from the photodiode, so it stays dark until smoke particles send some of the light sideways onto it.'},
    {title: 'Compare, and sound the horn', body: 'A comparator checks its chamber every few seconds against a threshold set at calibration, and drives the horn when it is crossed. The same chip watches the battery and chirps when it is low.'},
  ],
  parts: [
    {name: 'The alarm, true size', role: 'The disk on the ceiling, opened up, with its battery, horn and two chambers.'},
    {name: 'Ionization chambers, cut open', role: 'One source between an open half and a sealed half, with the ions and the smoke.'},
    {name: 'The americium button', role: 'The source itself, and what one alpha particle leaves behind it.'},
    {name: 'Optical chamber, cut open', role: 'The emitter, the smoke it lights, and the two photodiodes.'},
    {name: 'What the circuit decides', role: 'The gauges the two comparators watch, and the horn.'},
    {name: 'The run', role: 'How far each detector has come toward its alarm as the smoke builds up.'},
  ],
  tryIt: [
    parentChart('Watch both alarms', 'Press Play and watch the two curves.', 'The ionization chamber crosses its set point at 264 s and the horn sounds at 266 s, when the smoke inside dims a beam by 4.32% a meter. The photodiode passes its limit at 400 s and its alarm sounds at 410 s, at 6.65% a meter.'),
    parentIons('Smoke you cannot see', 'Choose 0.1 μm particles and press Play.', 'The ionization alarm sounds at 45 s, when this smoke dims a beam by only 0.02% a meter. By the end of the run the open half is down to 1.46 pA of the 13.37 pA it carries in clean air, and the photodiode has never reached its limit.', {size: 0.1}),
    parentChamber('Smoke from smoldering', 'Choose 3 μm particles and press Play.', 'The photodiode passes its limit at 470 s and the alarm sounds at 474 s, at 10.15% a meter. The ionization chamber ends the run still carrying 99.5% of its clean current, and never sounds at all.', {size: 3}),
    parentChart('A faster fire', 'Set the smoke growth to 50 mg/m³ a minute and press Play.', 'Both alarms come sooner, the ionization at 68 s and the photoelectric at 99 s, and both at the obscurations they needed before: 4.32% and 6.65% a meter. A faster fire does not change what each detector needs, only when it arrives.', {growth: 50}),
    parentChamber('The beam straight through', 'Press Play and watch the photodiode down the beam.', 'By the end there is 96.7 mg/m³ of smoke inside, 9.96% obscuration a meter, and the photodiode 30 mm down the beam still receives 99.69% of the 400 μA it reads in clean air. The same smoke over 10 m, the width of a room, would leave 35.0% of the beam.'),
    parentCircuit('A low battery', 'Set the battery to 7 V and press Play.', 'Below the 7.5 V trip the alarm chirps for 10 ms every 40 s, 6 times before the ionization alarm takes over at 272 s. The set point follows the battery down, so the alarm still comes at 4.44% a meter.', {battery: 7}),
    parentChamber('Move the photodiode', 'Set the scattering angle to 90° and press Play.', 'This smoke sends 0.345 of the light sideways that it sends at 21°, so the photodiode ends the run at 29.5 nA against its 56.1 nA limit and never alarms. The ionization alarm still sounds at 266 s.', {angle: 90}),
  ],
  deeper: [
    {title: 'Ion pairs by the hundred thousand', body: 'Americium-241 gives off an alpha particle of 5.486 MeV in 85% of its decays, and a smoke alarm holds about 37 kBq of it, some 0.29 μg. Half the alphas go into the silver backing of the button; the rest cross its gold cover, 2 μm of it, one percent of the button’s thickness, which costs them 0.899 MeV. What is left, 4.587 MeV, would carry an alpha 31.9 mm through air, and since a pair of ions takes 33.97 eV of it, one alpha stopping in air would leave 135,028 pairs. The open half chamber, 15 mm from the source to its plate, takes 39,687 of them.'},
    {title: 'A current with a ceiling', body: 'If every pair reached a plate the open half would carry 58.8 pA, the current the source alone fixes. It carries 13.37 pA, 23% of that, because at 3.06 V an ion takes 245 ms on average to cross and many meet an ion of the other sign first. That is what makes the chamber sensitive: Litton found the usual theory holds while the current stays below 0.4 of the saturation current, and a chamber run near saturation has almost nothing left to lose.'},
    {title: 'What smoke does to the ions', body: 'A particle sweeps up ions at the diffusion limit 4πDR, which the Diffusion-controlled reaction page gives for a sphere, with D from the Einstein relation. For air ions that is 3.79 × 10⁻⁶ m²/s, so a particle 0.3 μm across catches at 7.14 × 10⁻¹² m³/s. At the obscuration where the alarm sounds an ion meets a particle in 49 ms, against the 245 ms it needs to cross the chamber in clean air. NBS Technical Note 973 gives the chamber signal as proportional to the number of particles times their diameter, so at a fixed mass of smoke the smaller the particles the stronger the signal: doubling the diameter cuts it by a factor of 4.'},
    {title: 'Light thrown sideways', body: 'How much light a particle throws to one side is Mie’s answer for a sphere, and it swings hard with size and angle. A particle 0.1 μm across, far smaller than the 940 nm the emitter sends, is in Rayleigh’s corner, where scattering falls with the sixth power of diameter; one of 3 μm is larger than the wavelength and throws its light forward. Technical Note 973 says a small forward angle gives the best signal and angles around 90° the worst, and the detector it measured used 21° with a 940 nm emitter.'},
    {title: 'Two ways to use a beam', body: 'The Smoke detector page describes both optical layouts. A beam type watches the light that arrives and alarms when smoke has dimmed it; a chamber type points the emitter away from the photodiode and alarms when smoke sends some light back. The book shows the beam. The reason a household alarm uses the other is here in the readings: over the 30 mm inside the chamber, smoke thick enough to alarm takes less than half a percent of the beam, while it lifts the off-axis photodiode from nothing to tens of nanoamperes. Obscuration only bites over a long path, which is why beam detectors are strung across atriums and auditoriums.'},
    {title: 'Which alarm answers which fire', body: 'NIST’s 2004 study, quoted on the Smoke detector page, found ionization alarms 57 to 62 seconds faster on flaming fires, and photoelectric alarms 47 to 53 minutes faster on smoldering ones. The reason is size. Flaming smoke is mostly 0.01 to 0.3 μm, which is plenty of surface to catch ions but too little to scatter; smoldering smoke is 0.3 to 10.0 μm, which scatters well but, for the same mass, offers far fewer particles to the ions. The NFPA’s answer is an alarm with both, which is what is drawn here.'},
  ],
  misconception: 'A smoke alarm does not smell smoke or feel heat. It watches one small number, a current or a photocurrent, and sounds when that number crosses a line that was set when the alarm was built.',
  limits: `The alarm is drawn at true size, its ionization chambers 4 times larger, the americium button 15 times larger across and 150 times larger through its thickness, and its optical chamber 2.5 times larger. The run of 10 minutes is drawn 20 times faster. Ions and smoke particles are drawn as dots, far bigger and far fewer than they are. ${smokeLimits} ${smokeLeftOut}`,
  sources: [sources.smokeDetector, sources.americium, sources.ionizationChamber, sources.alpha, sources.stopping, sources.astar, sources.tn973, sources.tn1455, sources.mie, sources.rayleigh, sources.beerLambert, sources.einstein, sources.diffusion, sources.mobility, sources.mc14467, sources.re46c190, sources.tsal6200, sources.bpw34, sources.battery],
  quiz: {
    question: 'Why does a smoke alarm with two sensors answer more fires than either sensor alone?',
    options: ['The two answer different smoke: one to the small particles of a flaming fire, the other to the large ones that smolder.', 'Two sensors give the horn twice the power.', 'The second sensor is a spare that takes over when the first one wears out.'],
    answer: 0,
    explanation: 'At 0.1 μm the ionization alarm sounds at 45 s and the photodiode never reaches its limit; at 3 μm the photoelectric alarm sounds at 474 s and the chamber ends the run at 99.5% of its clean current.',
  },
};

// ---------------------------------------------------------------------------
// Ionization smoke detector.
// ---------------------------------------------------------------------------

export const IONIZATION_DEFAULTS = {...SMOKE_DEFAULTS, size: 0.1};
const ionIons = trial(IONIZATION_DEFAULTS, 'ions'), ionCircuit = trial(IONIZATION_DEFAULTS, 'circuit'), ionSource = trial(IONIZATION_DEFAULTS, 'source'), ionChart = trial(IONIZATION_DEFAULTS, 'chart');

export const ionizationDetectorLesson = {
  simple: 'How can a current through air notice smoke?',
  overview: 'An ionization detector keeps a little air permanently ionized with a speck of americium, and draws a steady, very small current through it. Smoke particles that drift in are enormous next to an ion, and an ion that lands on one crawls instead of flying, so it is far more likely to meet an ion of the other sign and vanish before it reaches a plate. The current falls. A second chamber, sealed against smoke, carries the same current from the battery, so the plate between them is a voltage that rises as soon as the open chamber weakens, and a comparator watches that voltage. Press Play and watch the ions thin out.',
  steps: [
    {title: 'Fire alpha particles', body: 'The americium button sends alpha particles out through a thin gold cover into the air of both halves.'},
    {title: 'Leave pairs of ions', body: 'Each alpha strips electrons from air molecules all along its path; every electron joins another molecule, so the air fills with pairs of charged air.'},
    {title: 'Collect them', body: 'The battery puts one half chamber above the plate between them and the other below, so ions drift to the plates and their charge becomes a current.'},
    {title: 'Let smoke slow them', body: 'A smoke particle that catches an ion carries it at a crawl, so it recombines on the way instead of arriving, and the open half carries less.'},
    {title: 'Watch the plate between', body: 'The sealed half keeps carrying what it always did, so the plate between the two halves climbs toward the comparator’s set point, and the horn sounds.'},
  ],
  parts: [
    {name: 'Ionization chambers, cut open', role: 'The open half, the sealed half, the source between them and the ions they hold.'},
    {name: 'The americium button', role: 'The source, its gold cover, and the ion pairs one alpha leaves.'},
    {name: 'What the circuit decides', role: 'The chamber current, the plate voltage against the set point, and the battery.'},
    {name: 'The run', role: 'The voltage climbing toward the set point as the smoke builds up.'},
    {name: 'The alarm, true size', role: 'Where the chamber sits inside the alarm on the ceiling.'},
  ],
  tryIt: [
    ionIons('Watch the ions thin out', 'Press Play and watch the open half.', 'In clean air the open half carries 13.37 pA at 3.06 V. By the end of the run the smoke has taken all but 1.46 pA, 10.9% of it, and the dots that stand for the ions thin out with it.'),
    ionCircuit('Where the alarm point is', 'Press Play and watch the second gauge.', 'The plate between the halves starts at 3.06 V and climbs. It reaches the set point, 4.50 V, at 45 s, with 4.5 mg/m³ of smoke inside the chamber, which would dim a beam by only 0.02% a meter.'),
    ionIons('Bigger particles slip past', 'Choose 3 μm particles and press Play.', 'The same 96.7 mg/m³ of smoke arrives, but as particles 27,000 times fewer, each catching ions only 30 times as fast, so the chamber ends the run at 99.5% of its clean current and never alarms.', {size: 3}),
    ionCircuit('A weaker battery', 'Set the battery to 6.5 V and press Play.', 'Less voltage across both halves means a weaker sweep and more recombination, so the clean current falls from 13.37 pA to 9.97 pA. The set point falls with the battery, though, so the alarm still comes at 47 s.', {battery: 6.5}),
    ionSource('What one alpha leaves', 'Look at the americium button.', 'An alpha leaves the gold cover with 4.587 MeV, enough for 31.9 mm of air, and the plate stops it after 15 mm. It leaves 39,687 ion pairs on the way, out of the 135,028 it would leave if it stopped in air.'),
    ionIons('The ceiling on the current', 'Set the battery to 9.5 V and press Play.', 'A stronger field rescues more ions from recombining, so the clean current rises from 13.37 pA to 14.02 pA. That is still 23.8% of the 58.8 pA the chamber would carry if every pair reached a plate, which is the most the source can give.', {battery: 9.5}),
    ionChart('A slow fire', 'Set the smoke growth to 1 mg/m³ a minute and press Play.', 'The chamber needs the same 4.5 mg/m³ inside it, and a fire this slow takes 292 s to put it there. What the detector needs does not change; only the waiting does.', {growth: 1}),
  ],
  deeper: [
    {title: 'Why a sealed chamber sits beside it', body: 'The Ionization chamber page says a detector also carries a reference chamber, sealed but ionized the same way, so that comparing the two currents cancels changes from air pressure, temperature, or the aging of the source. Here the two halves are in series across the battery and the comparator watches the plate between them, which moves only when one side changes and the other does not.'},
    {title: 'Ions, and how they end', body: 'The alphas keep about 8.67 million ion pairs in every cubic centimeter of the open half. Each one either reaches a plate, which takes 245 ms on average at 3.06 V, or meets an ion of the other sign. Both endings are in the same balance: what the alphas make is what the sweep and the recombination take away, and the current follows the ion density.'},
    {title: 'What a particle does to an ion', body: 'An ion that lands on a smoke particle is stuck to something many thousand times heavier, and drifts a few thousand times more slowly, so it is almost certain to meet an ion of the other sign before it arrives. NBS Technical Note 973 writes the loss of chamber signal as the number of particles times their diameter, over a chamber constant built from the ion generation rate and the recombination coefficient; the same note says sensitivity goes as the inverse square root of the source strength, so a weaker source makes a more sensitive chamber and a noisier one.'},
    {title: 'Picoamperes, and the guard around them', body: 'The Ionization chamber page puts chamber currents between femtoamperes and picoamperes, and here the open half carries 13.37 pA. The MC14467-1 answers that with a detect input that leaks at most 1 pA and a guard on the pins either side of it, held within 100 mV of the input, so that leakage across the board surface has no voltage to drive it. NIST’s own measuring chamber, at 18 V, read 95 pA in clean air and 63.5 pA at 2.9% obscuration a meter.'},
    {title: 'What the chip does all day', body: 'The MC14467-1 wakes every 1.67 s to compare the plate voltage with its set point, half the supply. When it does see smoke it drops to a 40 ms period and drives the horn 160 ms on and 80 ms off. Every 24 of its slow cycles, about 40 s, it checks the battery under a 10 mA load, and chirps for 10 ms when the battery is low. Between all that it draws about 5 μA.'},
    {title: 'What is inside the button', body: 'The Americium-241 page describes the source as americium dioxide mixed with gold, rolled into a foil with a silver backing and a gold front, cut into discs 5.1 mm across and 0.2 mm thick, each in an aluminum holder. The gold cover is about one percent of that thickness. It is thin for a reason: 10.2 μm of gold would stop the alphas outright, and Technical Note 973 warns that the plating thickness is critical. The model follows the ASTAR tables, which put an alpha through 6.6 μm of gold at 2.087 MeV and 11.2 mm of air, where that note gives 4.5 mm.'},
  ],
  misconception: 'The americium is not what sounds the alarm, and it does not run out either. It only keeps the air in the chamber conducting; what the alarm listens to is the current that smoke takes away, and the source outlives the alarm by centuries.',
  limits: `The chambers are drawn 4 times larger and the button 15 times larger across and 150 times larger through its thickness; ions and smoke particles are dots, far bigger and far fewer than they are, their number following the ion density and the mass of smoke. The run of 10 minutes is drawn 20 times faster. ${smokeLimits} ${smokeLeftOut}`,
  sources: [sources.smokeDetector, sources.americium, sources.ionizationChamber, sources.alpha, sources.stopping, sources.astar, sources.tn973, sources.tn1455, sources.einstein, sources.diffusion, sources.mobility, sources.airDensity, sources.gold, sources.mc14467, sources.battery],
  quiz: {
    question: 'Why does smoke lower the current through an ionization chamber?',
    options: ['Ions stick to smoke particles, crawl instead of drifting, and meet an opposite ion before they reach a plate.', 'Smoke blocks the alpha particles, so no ions are made at all.', 'Smoke shorts the two plates together, so the current goes around the meter.'],
    answer: 0,
    explanation: 'At the obscuration where this alarm sounds an ion meets a particle in 49 ms, against the 245 ms it needs to cross the chamber in clean air, and the current falls from 13.37 pA toward 1.46 pA.',
  },
};

// ---------------------------------------------------------------------------
// Optical smoke detector.
// ---------------------------------------------------------------------------

export const OPTICAL_DEFAULTS = {...SMOKE_DEFAULTS, size: 3};
const optChamber = trial(OPTICAL_DEFAULTS, 'chamber'), optCircuit = trial(OPTICAL_DEFAULTS, 'circuit'), optChart = trial(OPTICAL_DEFAULTS, 'chart');

export const opticalDetectorLesson = {
  simple: 'How does a beam of light notice smoke?',
  overview: 'An optical detector shines infrared light across a small dark chamber and puts a photodiode to one side, facing away from the beam, behind baffles that keep the emitter out of its view. In clean air it sees nothing. A smoke particle in the beam throws light in every direction, and a little of it lands on the photodiode; the more smoke, the more light, and when the current crosses a limit stored when the alarm was calibrated, the horn sounds. A second photodiode here, straight down the beam, shows the other way to use light: watching the beam dim. Press Play and watch both.',
  steps: [
    {title: 'Shine a beam into the dark', body: 'The emitter fires a short infrared pulse across a chamber whose walls and baffles are meant to swallow every stray ray.'},
    {title: 'Keep the photodiode out of the beam', body: 'The photodiode looks at the lit volume from one side, so in clean air almost nothing reaches it.'},
    {title: 'Let smoke scatter the light', body: 'Each particle in the beam sends light in all directions, most of it forward, and the share that goes the photodiode’s way becomes a current.'},
    {title: 'Compare with the stored limit', body: 'The chip digitizes what the photodiode collected during the pulse and compares it with the limit written into its memory at calibration.'},
    {title: 'Wait for it to hold', body: 'One reading over the limit is not enough; the chip checks again and again in quick succession, and only a run of them sounds the horn.'},
  ],
  parts: [
    {name: 'Optical chamber, cut open', role: 'The emitter, its beam, the smoke it lights and the two photodiodes.'},
    {name: 'What the circuit decides', role: 'The photodiode current against the limit stored at calibration.'},
    {name: 'The run', role: 'The photocurrent climbing toward that limit as the smoke builds up.'},
    {name: 'The alarm, true size', role: 'Where the optical chamber sits inside the alarm on the ceiling.'},
    {name: 'Ionization chambers, cut open', role: 'The other kind of sensor, fed the same smoke for comparison.'},
  ],
  tryIt: [
    optChamber('Watch the light arrive', 'Press Play and watch the photodiode off the beam.', 'It passes its 56.1 nA limit at 470 s and, three readings later, the alarm sounds at 474 s, with smoke enough to dim a beam by 10.15% a meter.'),
    optChamber('The beam itself hardly dims', 'Press Play and watch the photodiode down the beam.', 'At the end of the run the chamber holds 12.89% obscuration a meter, and that photodiode still receives 99.59% of the 400 μA it reads in clean air over its 30 mm. The same smoke across 10 m of room would leave 25.2%.'),
    optChamber('Around to the side', 'Set the scattering angle to 90° and press Play.', 'Smoke this size throws its light forward: at 90° the photodiode collects 0.102 of what it collects at 21°, which is 7.4 nA at the end of the run, and the alarm never sounds.', {angle: 90}),
    optChamber('Forward, but not far forward', 'Set the scattering angle to 45° and press Play.', 'At 45° the photodiode collects 0.274 of what it collects at 21°, 19.8 nA by the end, and the alarm still never sounds. The angle a chamber is built at is part of how sensitive it is.', {angle: 45}),
    optChart('Smaller particles', 'Choose 0.3 μm particles and press Play.', 'The alarm still comes, at 410 s, with 6.65% obscuration a meter inside the chamber, close to the middle threshold NIST measured for photoelectric alarms.', {size: 0.3}),
    optChamber('Smoke you cannot see', 'Choose 0.1 μm particles and press Play.', 'Particles this small scatter almost nothing: the photodiode ends the run at 2.4 nA against its 56.1 nA limit, and never alarms. The ionization chamber, fed the same smoke, sounds at 45 s.', {size: 0.1}),
    optChart('A faster fire', 'Set the smoke growth to 50 mg/m³ a minute and press Play.', 'The alarm comes at 121 s instead of 474 s, and at the same 10.15% obscuration a meter. What the chamber needs is a concentration, not a speed.', {growth: 50}),
  ],
  deeper: [
    {title: 'How much light one particle throws', body: 'Mie’s solution gives how a sphere scatters a wave, as a series whose terms Bohren and Huffman set out, and the model works it out for each particle size at the wavelength the emitter uses, 940 nm. Size decides everything. At 0.1 μm the particle is in Rayleigh’s corner, where scattering goes with the sixth power of diameter, so the same mass of smoke scatters hundreds of times less. At 1 μm and 3 μm the particle is comparable to the wavelength and throws light strongly forward.'},
    {title: 'Where to put the photodiode', body: 'Technical Note 973 says the strongest signal is at a small forward angle and the weakest around 90° to 100°, and the detector it measured used a nominal 21° with an emitter at 940 nm. That is what the model starts at. Moving the photodiode to 90° costs a factor of ten for 3 μm smoke and about a third for 0.3 μm, because a large particle beams its light forward and a small one spreads it.'},
    {title: 'Scattering against obscuration', body: 'Beer and Lambert’s law turns a concentration into the share of a beam that survives a path, and NIST writes that as obscuration, the percent a beam loses in a meter or a foot. Both optical layouts use the same law, but at opposite ends: the beam type asks how much is missing from a long path, and the chamber type asks how much arrived somewhere the beam does not reach. Over the 30 mm inside this chamber, smoke that alarms takes under half a percent of the beam, which is why the chamber type wins indoors.'},
    {title: 'The pulse, the limit and the three readings', body: 'The RE46C190 powers its chamber up once every 10.7 s, pulses the emitter for 100 μs, integrates the photodiode current over that pulse and compares the result with a limit stored in memory at calibration. The limit can be set in 31 steps up to 58 nA; the 56.1 nA here is 30 of them. One reading over the limit shortens the next wait to 2.0 s, a second shortens it to 1.0 s, and three in a row sound the horn, which is why the alarm follows the crossing by 3 s.'},
    {title: 'What the emitter and the photodiode are', body: 'The emitter is modeled on a TSAL6200, which gives 72 mW/sr at 100 mA into a beam of half angle 17°, and the photodiode on a BPW34, 7.5 mm² of silicon giving 50 μA in an irradiance of 1 mW/cm² at 950 nm, which is a responsivity of 0.667 A/W. Those two numbers, with the geometry, set how many nanoamperes a given smoke is worth, and so where the limit has to sit.'},
    {title: 'Why it misses the flaming fire', body: 'The smoke of a flaming fire is mostly 0.01 to 0.3 μm, and the Smoke detector page reports NIST finding photoelectric alarms 57 to 62 seconds slower there, against 47 to 53 minutes faster on smoldering fires. The model shows the same split: at 0.1 μm the photodiode never reaches its limit, while the ionization chamber sounds within a minute.'},
  ],
  misconception: 'The photodiode in a household alarm is not watching the beam get dimmer. It is looking away from the beam at darkness, and waiting for smoke to send it some light.',
  limits: `The optical chamber is drawn 2.5 times larger, and smoke particles as dots far bigger and far fewer than they are. The run of 10 minutes is drawn 20 times faster. The chamber is taken as perfectly black, with no light reaching the photodiode in clean air, and the lit volume is the same whatever the angle. ${smokeLimits} ${smokeLeftOut}`,
  sources: [sources.smokeDetector, sources.mie, sources.rayleigh, sources.beerLambert, sources.tn973, sources.tn1455, sources.re46c190, sources.tsal6200, sources.bpw34, sources.astar],
  quiz: {
    question: 'Why does a household optical alarm point its emitter away from its photodiode?',
    options: ['So the photodiode sees darkness until smoke scatters light its way, which is a far larger change than the dimming of the beam.', 'So the emitter does not overheat the photodiode.', 'So the beam can be aimed at the ceiling, where smoke gathers first.'],
    answer: 0,
    explanation: 'Smoke that takes the photodiode from nothing to 56.1 nA removes only 0.32% of the beam over the 30 mm inside the chamber.',
  },
};

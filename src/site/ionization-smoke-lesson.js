import {ION_SMOKE_DEFAULTS as D} from './ionization-smoke-physics.js';

const trial=(title,instruction,observe,part,changes={},mass=0)=>{
  const values={...D,...changes};
  return {title,instruction,observe,part,values,initialState:{settings:{...values},time:0,mass},reset:true,isolate:true,cutaway:true,view:'front'};
};

export const reviewedIonizationSmokeLesson={
  simple:'How can a current through air notice smoke?',
  overview:'A sealed source keeps making charged molecules in a small air gap. Battery voltage pulls positive and negative ions toward opposite electrodes. Smoke catches some of these quick carriers and puts their charge onto much slower particles, so the current falls. A smoke-free reference chamber shares the same current. The voltage between the chambers shifts, a circuit notices, and battery power drives a sounder. Run the observation, then inspect where the ions go.',
  steps:[
    {title:'Make charged air',body:'Alpha particles from the sealed source lose energy in air. They leave positive ions and electrons that can attach to molecules, forming negative ions.'},
    {title:'Collect a small current',body:'The battery field draws opposite signs toward opposite electrodes. Some ions recombine before collection. The source sets a ceiling on how much charge can be collected each second.'},
    {title:'Put smoke in the fast path',body:'Smoke enters the sensing half and captures mobile ions. Their charge stays on the particles, but their motion becomes much slower. Fewer mobile carriers contribute to the current.'},
    {title:'Shift the shared voltage',body:'Both series chambers must carry the same current. As the sensing half becomes less conductive, more battery voltage appears across it and less across the reference. The current falls in both halves.'},
    {title:'Compare, then supply sound',body:'A sampled voltage above the comparison level requests the horn. The tiny chamber signal controls the decision; the battery supplies the sounder’s power. Clearing smoke can release the alarm.'},
  ],
  parts:[
    {name:'Two ionization chambers',role:'One smoke-sensing gap and one smoke-free reference share a source electrode.'},
    {name:'Sealed source foil',role:'Supplies alpha particles even when the battery contact is open.'},
    {name:'Comparator and horn driver',role:'Reads the shared voltage without drawing substantial current, then drives the sounder.'},
    {name:'Where the mobile ions go',role:'Shows collection, recombination and attachment as three parts of one charge balance.'},
    {name:'One alpha and its ion pairs',role:'Follows energy deposited before a normal track reaches the electrode.'},
    {name:'Observation record',role:'Keeps elapsed voltage history and actual alarm transitions.'},
  ],
  tryIt:[
    trial('Watch the ions thin out','Press Play. Compare the two gas paths, then inspect charge balance.','With 0.1 μm spheres, current falls from 9.73 to 0.86 pA by 600 s. Smoke captures most mobile sensing ions. The reference stays smoke-free, but it also carries the smaller series current.','ions'),
    trial('Where the alarm point is','Press Play or advance sample by sample. Watch the sensing-voltage bar.','At 9 V supply, the trigger is 4.50 V. The first above-threshold sample occurs at 38.41 s in this assigned input. The release level is lower, at 4.40 V.','circuit'),
    trial('Bigger particles, same mass','Run the 3 μm trial and compare it with the small-sphere trial.','At equal mass, these spheres are 27,000 times fewer than 0.1 μm spheres. Each has 30 times the diffusion capture coefficient, so total capture is 900 times lower. Current remains at 99.3% of its clean value; no alarm occurs here.','ions',{size:3}),
    trial('A weaker battery','Inspect the starting current, then run the observation.','At 6.5 V, clean-air current is 7.34 pA rather than 9.73 pA. The trigger also falls, to 3.25 V. This trial first alarms at the 38.41 s sample. Reduced voltage does not turn off the radioactive source.','circuit',{battery:6.5}),
    trial('What one alpha leaves','Inspect the foil and track. Play to follow the illustrative alpha.','A normal alpha enters air with 4.586 MeV. It leaves about 47,714 pairs over the 15 mm gap, then deposits its remaining energy in the electrode. Its free-air range would be 31.90 mm. Oblique and wall-limited tracks differ.','source',{growth:0,program:2}),
    trial('The ceiling on the current','Inspect the clean-air current, then compare with “Clean air, no smoke alarm.”','A stronger field raises clean current to 10.19 pA. That is 29.9% of the 34.10 pA ceiling set by the modeled source deposition. More voltage collects more pairs; it does not make the source emit faster.','balance',{battery:9.5,growth:0,program:2}),
    trial('A slower smoke input','Run the 1 mg/m³-per-minute concentration ramp.','The first alarm occurs at 225.45 s rather than 38.41 s. The chamber needs a similar concentration to reach its threshold, but it takes longer to arrive. This comparison does not predict a fire’s growth or warning time.','chart',{growth:1}),
    trial('Clear the air','Run until the assigned fresh air enters at 180 s.','Current recovers as the smoke leaves. The alarm releases at 223.78 s when a sample is below 4.40 V. The record keeps both alarm onset and release.','chart',{program:1}),
    trial('Ions without battery power','Watch the alpha tracks and inspect charge balance.','The sealed source still creates ions, but collection current is zero. Recombination and attachment consume the mobile population. Neither the comparator nor the horn has electrical power.','ions',{power:0}),
    trial('Clean air, no smoke alarm','Run the full observation with clean room air.','The source keeps generating ions and current stays at 9.73 pA. A steady clean-air signal remains below the trigger, so no smoke alarm is requested.','balance',{growth:0,program:2}),
    trial('Low battery in clean air','Run the clean-air trial with a 7 V battery. Enable sound to hear its brief chirps.','The smoke comparison stays quiet. Fifteen low-battery checks request chirps during 600 s. This battery warning is distinct from the smoke alarm.','circuit',{battery:7,growth:0,program:2}),
  ],
  deeper:[
    {title:'Charge moves; it does not vanish',body:'Attachment removes a small ion from the fast mobile population by moving its charge onto a smoke particle. Recombination instead neutralizes opposite charges. The model counts both losses separately, and omits current carried by the much slower charged particles. It does not assume every captured ion immediately recombines.'},
    {title:'The reference does not hold current fixed',body:'A high-impedance input reads the shared electrode. In steady state, its negligible loading means the two chamber currents match. Smoke shifts the division of battery voltage until that equality holds again. A reference can reduce some common environmental changes, but perfect cancellation of pressure, humidity, temperature or aging is not modeled or claimed.'},
    {title:'Three terms balance one source',body:'The uniform small-ion calculation is q = αn² + (s + βN)n. Source production q balances recombination αn², collection sn and attachment βNn. Here n is the density of each sign, s = 2μV/L², and N is particle number per volume. The current is e times chamber volume times sn. The balance view exposes the three fractions.'},
    {title:'Why size matters at equal mass',body:'For assigned spheres, number varies as diameter to the power −3. A continuum diffusion capture coefficient varies as diameter. Their product therefore varies as diameter to the power −2. This is an idealized trend: real smoke is polydisperse, may carry charge, and need not obey continuum diffusion capture at the smallest sizes.'},
    {title:'Alpha energy and finite geometry',body:'The calculation integrates emission over a finite foil, direction and three principal alpha energies. Oblique rays cross more cover material. Rays then stop in air, an electrode, the shell or the divider. Only energy deposited in air produces modeled ion pairs. The displayed normal track is one example, not the chamber-average pair yield.'},
    {title:'Picoamperes need a careful input',body:'The MC14467-1 data sheet describes a guarded, high-impedance detect input, a nominal half-supply threshold and hysteresis. The illustrated guard sits near the detect voltage to reduce leakage. The lesson uses those ideas in a simplified controller, with fixed 1.67 s checks. The real chip changes its timing during alarm and has additional interactions omitted here.'},
    {title:'The source changes slowly',body:'Americium-241 decays over centuries, so its activity is effectively constant during this ten-minute experiment. It still decays; it does not last forever. The detector’s electrical power and useful service life are separate from that slow nuclear process.'},
  ],
  misconception:'The chamber’s tiny current does not power the horn. It provides a signal that controls a separately powered driver. Opening the battery contact leaves alpha emission running but removes collection voltage and alarm power.',
  limits:'An enlarged teaching layout, not a product construction drawing. Assigned half-cylinder radius 10 mm, gaps 15 and 24.7 mm, source activity 37 kBq, foil diameter 5.1 mm and cover thickness 2 μm. The calculation uses uniform density, straight CSDA tracks, a constant approximate alpha yield of 35.1 eV per pair, one ion mobility, no space-charge field, and continuum capture by uncharged spheres. Smoke density is 1000 kg/m³; optical obscuration uses nonabsorbing index-1.5 spheres. The prescribed room concentration exchanges with the chamber in 20 s. No fire, airflow field, humidity, leakage, heavy-particle current or measured warning time is modeled. The source stays constant over 600 s. Particle counts, sizes, alpha flight, wire-current markers and diaphragm motion are illustrative. The controller and synthesized three-beep cadence are not a bit-accurate implementation of a particular alarm.',
  sources:[
    {title:'NIST: how smoke detectors work',url:'https://www.nist.gov/how-do-you-measure-it/how-do-smoke-detectors-work'},
    {title:'NBS Technical Note 973: smoke detector design and smoke properties',url:'https://www.govinfo.gov/content/pkg/GOVPUB-C13-84636d2fa7d6bee93126fa5ec3f368f5/pdf/GOVPUB-C13-84636d2fa7d6bee93126fa5ec3f368f5.pdf'},
    {title:'NXP: MC14467-1 ionization detector circuit',url:'https://www.nxp.com/docs/en/data-sheet/MC14467-1.pdf'},
    {title:'NIST ASTAR: alpha stopping powers and ranges',url:'https://physics.nist.gov/PhysRefData/Star/Text/ASTAR.html'},
    {title:'IAEA: nuclear data for safeguards',url:'https://www-nds.iaea.org/sgnucdat/safeg2008.pdf'},
    {title:'Garty, Harken and Brenner: traceable dosimetry for MeV ion beams',url:'https://arxiv.org/abs/2201.09778'},
  ],
  quiz:{question:'Smoke enters only the sensing half. What happens to the series circuit?',options:['Both chamber currents fall; the shared voltage shifts toward the sensing half’s trigger.','The reference current stays fixed while the sensing current falls.','Smoke removes power from the radioactive source.'],answer:0,explanation:'The high-impedance input draws negligible current, so both gas paths carry equal current. A new voltage division lets the clean reference and smoky sensing chamber carry the same smaller current.'},
};

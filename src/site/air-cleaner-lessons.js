import {AIR_CLEANER_DEFAULTS} from './air-cleaner-physics.js';

const trial = part => (title, instruction, observe, values = {}) => ({title, instruction, observe, values: {...AIR_CLEANER_DEFAULTS, ...values}, reset: true, part, isolate: false, view: 'front'});
const towerTrial = trial('system'), chartTrial = trial('charts'), filterTrial = trial('filter'), collectorTrial = trial('collector'), chargerTrial = trial('charger'), particleTrial = trial('particles');

const epa = {
  guide: {title: 'US EPA: guide to air cleaners in the home', url: 'https://www.epa.gov/indoor-air-quality-iaq/guide-air-cleaners-home'},
  hepa: {title: 'US EPA: what is a HEPA filter?', url: 'https://www.epa.gov/indoor-air-quality-iaq/what-hepa-filter'},
  ionizers: {title: 'US EPA: ionizers and other ozone-generating air cleaners', url: 'https://www.epa.gov/indoor-air-quality-iaq/what-are-ionizers-and-other-ozone-generating-air-cleaners'},
  precipitators: {title: 'US EPA: electrostatic precipitators', url: 'https://www.epa.gov/air-emissions-monitoring-knowledge-base/monitoring-control-technique-electrostatic-precipitators'},
};

export const airCleanerLesson = {
  simple: 'How does an air cleaner catch particles far smaller than the gaps in its filter?',
  overview: 'An air cleaner is a fan that pushes room air through something that catches particles. A HEPA filter is not a sieve: the gaps between its fibers are far wider than the smoke particles it stops. Tiny particles jitter into fibers, middling ones brush against them, heavy ones cannot turn with the air, and in between lies a size the filter finds hardest. How fast a room clears depends as much on how much air the fan moves as on how well the filter catches. Try the sizes, the fan speed, and the other two ways of catching.',
  steps: [
    {title: 'Draw the air in', body: 'The fan pulls room air through the grille and a coarse pre-filter that stops hair and lint.'},
    {title: 'Slow it down', body: 'The filter mat is pleated so a large area fits in the frame, and the air creeps through it at a few centimeters a second.'},
    {title: 'Catch the particles', body: 'Small particles wander into fibers by diffusion, middling ones touch fibers by interception, and heavy ones crash into fibers by impaction. Once touching, they stick.'},
    {title: 'Blow the clean air back', body: 'The fan returns the air to the room, where it mixes with the rest and dilutes what is left.'},
  ],
  parts: [
    {name: 'Tower', role: 'Grilles in and out, and the housing between.'},
    {name: 'Pre-filter', role: 'Stops hair and lint.'},
    {name: 'HEPA-grade filter', role: 'A pleated mat of fine glass fibers.'},
    {name: 'Activated carbon', role: 'Holds some gas molecules; no help with particles.'},
    {name: 'Ionizing wires', role: 'Charge particles in the electrostatic cell.'},
    {name: 'Collector plates', role: 'Catch charged particles.'},
    {name: 'Fan', role: 'Moves the air.'},
    {name: 'Particles', role: 'Caught or sent back into the room.'},
    {name: 'Charts', role: 'What gets through, and how the room clears.'},
  ],
  tryIt: [
    towerTrial('Catch smoke', 'Run the cleaner on high.', 'The filter lets through only 1.9 in every 100,000 particles of this size, catching 99.998%, so the fan’s 200 m³ an hour is almost all clean air: 6.67 times the room’s air each hour.'),
    chartTrial('The room clears', 'Watch the room over the hour.', 'Half the particles are gone in 5.8 min, and 90.8% in 20 min. Without the cleaner, fresh air alone would still leave 84.5%.'),
    chartTrial('The hardest size', 'Find the highest point on the chart.', 'Particles 0.18 µm across get through most, and still 99.985% are caught. Smaller ones are caught better by diffusion, larger ones by interception and impaction.'),
    filterTrial('Tiny particles', 'Choose the smallest particles.', 'Particles 0.01 µm across dart about so much that fibers they pass catch them, and essentially none get through.', {size: 0}),
    filterTrial('How fibers catch', 'Look at one fiber’s catch.', 'For 0.3 µm particles, a single fiber catches 17.8% of those heading for it by interception, 7.2% by diffusion and 2.7% by impaction, and the 0.4 mm mat puts many fibers in each particle’s way.'),
    chartTrial('Turn the fan down', 'Set the fan to low.', 'Slower air lets diffusion catch even more, 99.9999%, but 60 m³ an hour clears the room slowly: half in 16.6 min. The power falls from 62.1 W to 6.6 W.', {fan: 0}),
    collectorTrial('Plates instead', 'Switch to the electrostatic precipitator.', 'Its plates catch 82.7% of the 0.3 µm particles, so it delivers 165.4 m³ of clean air an hour, for 5.7 W instead of 62.1 W.', {mode: 1}),
    chargerTrial('An ionizer alone', 'Switch to the ionizer without plates.', 'It charges the particles but catches none. Drifting to the walls at 2.43 µm/s, they leave 59.2% in the air after an hour, against 60.3% with no cleaner at all.', {mode: 2}),
  ],
  deeper: [
    {title: 'Not a sieve', body: 'The gaps between fibers are many times wider than a smoke particle. Particles are caught because they touch a fiber and stick, held by van der Waals forces, not because they are too big to pass.'},
    {title: 'The most penetrating size', body: 'Diffusion weakens as particles grow while interception and impaction strengthen, so the catch dips in between. For this filter at full speed the dip falls at 0.18 µm, which is why filters are tested near that size.'},
    {title: 'Clean air delivery rate', body: 'What matters for a room is the clean air delivered: the air moved times the share caught. A near-perfect filter behind a weak fan can lose to a leakier one moving more air.'},
    {title: 'Carbon for gases', body: 'Particles and gases are different problems. Activated carbon holds some gas molecules on its enormous inner surface until it fills; a particle filter does nothing for them.'},
  ],
  misconception: 'A HEPA filter does not work like a sieve with holes smaller than the particles. Its gaps are wide; particles are caught when they touch fibers, and the very smallest particles are caught best.',
  limits: 'Illustrative filter: glass fibers 0.6 µm across, 4% solid and 0.4 mm thick, pleated into 1.85 m², by single-fiber filtration theory as Hinds gives it; unit-density spheres; a 30 m³ room with 12 m² of floor and 64 m² of surfaces, fresh air half a room’s worth an hour, and the air perfectly mixed. The electrostatic cell charges particles at 560,000 V/m with 5 × 10¹⁴ ions per m³ and catches them on plates 6 mm apart and 100 mm long at 5 kV; the ionizer’s room field is taken as 20 V/m. Not modeled: particles bouncing off fibers, filters loading up, charge leaking away, ozone, and gases. The hour plays sixty times faster than real time.',
  sources: [epa.guide, epa.hepa, epa.ionizers],
  quiz: {
    question: 'Which particles does a HEPA filter find hardest to catch?',
    options: ['Middling ones, around 0.1 to 0.3 µm across.', 'The very smallest ones.', 'The largest ones.'],
    answer: 0,
    explanation: 'The smallest are caught by diffusion and the largest by interception and impaction. In between, both are weak, so a middling size gets through most.',
  },
};

export const electrostaticPrecipitatorLesson = {
  simple: 'How can electricity pull smoke out of the air without a filter?',
  overview: 'A two-stage electrostatic precipitator first charges the particles, then pulls them onto plates. Thin wires at high voltage make a corona that fills the air with ions, and passing particles pick up charge. Between closely spaced plates at 5 kV, the charged particles drift sideways across the stream and stick. The air meets almost no resistance, so the fan works lightly, but how much is caught depends on the charge, the time between the plates, and the particle’s size.',
  steps: [
    {title: 'Make ions', body: 'The field at a thin wire is so intense that it tears air molecules into ions, a faint glow called a corona.'},
    {title: 'Charge the particles', body: 'Ions driven along the field lines, and ions wandering by chance, stick to passing particles.'},
    {title: 'Drift across', body: 'Between the plates, the field pulls each charged particle sideways while the air carries it along.'},
    {title: 'Stick and stay', body: 'Particles that reach a plate stay there until the plates are washed.'},
  ],
  parts: [
    {name: 'Ionizing wires', role: 'Make the ions that charge particles.'},
    {name: 'Collector plates', role: 'Pull charged particles out of the stream.'},
    {name: 'Fan', role: 'Moves the air through the open channels.'},
    {name: 'Particles', role: 'Caught on a plate or carried back out.'},
    {name: 'Charts', role: 'What gets through at each size, and how the room clears.'},
  ],
  tryIt: [
    collectorTrial('Charge and collect', 'Switch to the electrostatic precipitator.', 'A 0.3 µm particle picks up 24.9 charges and drifts toward a plate at 10.11 cm/s, and 82.7% are caught in one pass.', {mode: 1}),
    collectorTrial('More time between the plates', 'Set the fan to low.', 'The air crosses the 100 mm plates at 27.78 cm/s instead of 92.59 cm/s, and 99.81% are caught.', {mode: 1, fan: 0}),
    chartTrial('Too small to charge', 'Choose the smallest particles.', 'A 0.01 µm particle carries 0.13 charges on average, so 87.5% carry none at all and pass straight through: only 12.5% are caught.', {mode: 1, size: 0}),
    collectorTrial('Large particles', 'Pick bigger particles.', 'A 1 µm particle takes on 195.9 charges, mostly by field charging, and 95.8% are caught.', {mode: 1, size: 4}),
    chargerTrial('Two ways to charge', 'Look at the ionizing wires.', 'At 0.3 µm, field charging supplies 13.1 charges and diffusion charging 11.8: ions driven along the field lines and ions wandering by chance.', {mode: 1}),
    towerTrial('Light on the fan', 'Compare the power.', 'Open channels cost the fan only 25 Pa, so the cleaner draws 5.7 W, 1.05 W of it for the corona.', {mode: 1}),
  ],
  deeper: [
    {title: 'Field charging and diffusion charging', body: 'Large particles gather ions carried along the field lines until their own charge turns the field away, a limit that grows with the square of their size. Small particles gain charge mostly from ions that bump into them by chance, which is slow and weak.'},
    {title: 'The Deutsch equation', body: 'If the air between the plates is well stirred, each short stretch catches the same share of what reaches it, so the share let through falls exponentially with plate length and drift speed, and rises with air speed.'},
    {title: 'Ozone', body: 'A corona that makes ions also makes some ozone, an irritating gas. Two-stage cells for rooms run at modest voltages to keep it low.'},
  ],
  misconception: 'An electrostatic precipitator does not destroy particles; it moves them. They stay on the plates until someone washes them off, and dirty plates catch less.',
  limits: 'Illustrative two-stage cell: ionizing wires at 7 kV charging particles in a 25 mm zone at 560,000 V/m with 5 × 10¹⁴ ions per m³; plates 6 mm apart and 100 mm long at 5 kV across 0.06 m² of channels; unit-density spheres with a dielectric constant of 2.5, their charges spread as a Poisson distribution. Not modeled: charge leaking away, particles bouncing off or blowing off the plates, ozone, and the plates loading up. The hour plays sixty times faster than real time.',
  sources: [epa.precipitators, epa.ionizers, epa.guide],
  quiz: {
    question: 'Why does a precipitator catch the very smallest particles poorly?',
    options: ['Most of them never pick up a charge.', 'They are too heavy to drift.', 'The plates are too far apart for them to fit.'],
    answer: 0,
    explanation: 'A 0.01 µm particle carries on average far less than one charge, so most carry none and the field cannot move them.',
  },
};

export const ionizerLesson = {
  simple: 'Does charging the particles in a room clean its air?',
  overview: 'An ionizer sends ions into the air from a sharp needle at high voltage. Particles pick up charge, but with no plates nearby they have to find a wall, a floor or a curtain on their own, pushed only by weak fields in the room. Charging alone removes very little; what an ionizer does remove ends up as grime on nearby surfaces, and some ionizers also make ozone.',
  steps: [
    {title: 'Make ions at a needle', body: 'The field at the needle’s sharp tip tears air molecules into ions.'},
    {title: 'Charge the particles', body: 'Ions stick to particles in the air that passes the needle.'},
    {title: 'Wait for a wall', body: 'With no plates, charged particles drift slowly toward walls, floor and furniture, and most stay airborne far longer than in a filter.'},
  ],
  parts: [
    {name: 'Ionizing wires', role: 'Here a single needle at the outlet.'},
    {name: 'Fan', role: 'Moves air past the needle.'},
    {name: 'Particles', role: 'Charged, then back into the room.'},
    {name: 'Charts', role: 'The room clearing with and without the ionizer.'},
  ],
  tryIt: [
    chargerTrial('Charge without catching', 'Switch to the ionizer without plates.', 'The particles carry 24.9 charges each, just as in the precipitator, but nothing inside the cleaner catches them.', {mode: 2}),
    chartTrial('Drift to the walls', 'Run for an hour.', 'In a room field of 20 V/m they drift at only 2.43 µm/s, so after an hour 59.2% remain, against 60.3% with no cleaner.', {mode: 2}),
    chartTrial('Compare a filter', 'Switch to the HEPA filter.', 'The same fan pushing air through a filter leaves 0.08% after an hour.', {mode: 0}),
    particleTrial('Big particles settle anyway', 'Pick the largest particles.', 'Particles 10 µm across fall out of the air by themselves: half are gone in 8.1 min, and the ionizer only brings that down from 8.5 min.', {mode: 2, size: 6}),
    chargerTrial('Tiny particles', 'Pick the smallest particles.', 'At 0.01 µm, 87.5% of the particles pick up no charge at all.', {mode: 2, size: 0}),
  ],
  deeper: [
    {title: 'Why the drift is so slow', body: 'A charged particle moves through air at its mobility times the field. Room fields are thousands of times weaker than between a precipitator’s plates, so the drift is millimeters an hour instead of centimeters a second.'},
    {title: 'Where the dirt goes', body: 'Particles that do leave the air settle on the nearest surfaces, often as dark marks on walls near the unit.'},
    {title: 'Ozone', body: 'Some ionizers make ozone, which irritates lungs and does not clean the air of particles.'},
  ],
  misconception: 'More ions do not mean cleaner air. Charging particles only helps if something then catches them; without plates or a filter, most stay in the air you breathe.',
  limits: 'Illustrative ionizer: particles charged as in the precipitator’s 25 mm zone, then drifting to the room’s 64 m² of surfaces in a field taken as 20 V/m, as if every particle in a 30 m³ room carried that charge, which flatters the ionizer. Fresh air half a room’s worth an hour. Not modeled: ozone, charged particles clumping together, deposits near the unit, and charge leaking away.',
  sources: [epa.ionizers, epa.guide],
  quiz: {
    question: 'Why does an ionizer without plates remove so few particles?',
    options: ['Nothing strong pulls the charged particles out of the air.', 'The ions cancel each other out.', 'Charged particles grow too big to move.'],
    answer: 0,
    explanation: 'The fields in a room are weak, so charged particles drift toward walls extremely slowly and mostly stay airborne.',
  },
};

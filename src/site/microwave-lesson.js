import {OVEN_DEFAULTS} from './microwave-physics.js';

const trial = (title, instruction, observe, values = {}, part = 'system', view = 'front') => ({
  title, instruction, observe, values: {...OVEN_DEFAULTS, ...values}, reset: true, part, view, isolate: part === 'food' || part === 'field',
});

export const microwaveLesson = {
  simple: 'How do microwaves become heat, and why can a rotating bowl still contain cold spots?',
  overview: 'Follow energy from the electrical supply to the magnetron, through the hollow waveguide, and into the food. The metal cavity reflects the waves; the glass bowl transmits much of their energy; the food absorbs it. A changing electric field acts on polar molecules, and their delayed response dissipates energy as heat. Compare moving the food with changing the wave pattern, then watch heat spread during standing.',
  steps: [
    {title: 'Make microwave energy', body: 'The power supply drives a magnetron with 800 W of microwave output while on. At 2.45 GHz, the field completes 2.45 billion cycles per second. Electrical input would be larger because conversion is not perfectly efficient.'},
    {title: 'Guide it into the cavity', body: 'The antenna couples energy into a hollow metal waveguide. Follow the orange direction guides through the actual ceiling opening. A thin protective inlet cover transmits microwaves while keeping food splashes out.'},
    {title: 'Reflect, transmit and absorb', body: 'Waves reflect from the conducting cavity walls, pass through the idealized glass bowl and deposit energy in the food. Reflections interfere, so energy deposition can vary strongly from place to place.'},
    {title: 'Turn field energy into heat', body: 'In the enlarged molecular sketch, the electric field changes direction and the polar molecule responds with a delay. In real food, molecular interactions turn this response into thermal energy. The sketch is slowed enormously; it is not a literal molecular trajectory.'},
    {title: 'Move food or change the field', body: 'The turntable carries each food volume along a circular path. The mode stirrer rotates metal blades to change the field pattern. Neither mechanism guarantees uniform heating. The center stays on the rotation axis, but its field can be weak or strong.'},
    {title: 'Let conduction continue', body: 'After RF input ends, warmer volumes transfer heat to cooler neighbors. The blue minimum rises and red maximum falls. The green mean stays fixed here because the experiment omits heat loss.'},
  ],
  parts: [
    {name: 'Electrical supply and magnetron', role: 'Convert electrical input into microwave output; conventional burst control changes the fraction of time on.'},
    {name: 'Waveguide and cavity inlet', role: 'Carry microwave energy through a hollow passage and an opening in the metal ceiling.'},
    {name: 'Reflecting cavity and outer cabinet', role: 'Surround the food and electrical compartment. Cutaway panels are a viewing aid.'},
    {name: 'Door, screen and interlocks', role: 'The conducting screen and door construction attenuate leakage. Latch-operated switches stop microwave generation when the door opens.'},
    {name: 'Mode stirrer', role: 'Rotating metal blades change the reflection pattern; this is not a fan that blows hot air over the food.'},
    {name: 'Turntable motor, shaft and rollers', role: 'Drive and support the plate carrying the bowl.'},
    {name: 'Open glass bowl and food', role: 'Contain the sample. Its temperature colors come directly from the conserved thermal field.'},
    {name: 'Timer and power display', role: 'Gold shows heating time, red shows duty cycle and the lamp indicates RF output.'},
    {name: 'Temperature chart', role: 'Compare coldest volume, mass-weighted mean and hottest volume over the same 300-second trial.'},
    {name: 'Molecular and field guides', role: 'Explain energy transfer and the chosen field pattern; these are illustrations, not extra appliance parts.'},
  ],
  tryIt: [
    trial('Heat the reference sample', 'Play the 0.3 kg sample at full power for 60 oven seconds, or choose Inspect end of heating.', 'The model deposits 37.29 kJ. Its mean reaches 49.7°C, but individual volumes range from 24.3 to 73.5°C. Equal mean temperature does not mean every part is equally warm.'),
    trial('Watch the standing period', 'Choose Inspect end of heating, then Inspect after standing.', 'The 24.3–73.5°C range narrows to 27.9–64.5°C by 300 s. The mean remains 49.7°C because the model has no heat loss.', {}, 'food', 'top'),
    trial('Half power for twice as long', 'Play at 50% for 120 s. Use the ten-second step button to see output alternate between on and off.', 'The 10 s on / 10 s off bursts deposit the same 37.29 kJ as the reference trial. The mean is again 49.7°C; the hottest volume reaches 71.7°C after the longer heating period.', {level: 50, seconds: 120}),
    trial('Keep food and field stationary', 'Play with both drives stopped, then inspect the end of heating.', 'The hottest volume reaches 87.7°C, compared with 73.5°C on the turntable. The mean is unchanged. Fixed food volumes remain under fixed hot spots.', {stirring: 0}, 'food', 'top'),
    trial('Turn the mode stirrer', 'Play with stationary food and the rotating mode stirrer.', 'The field guides move while the bowl stays still. The food range at 60 s is 31.7–70.1°C. This chosen moving pattern heats more evenly than the stationary pattern.', {stirring: 2}),
    trial('Use both moving mechanisms', 'Play with the turntable and mode stirrer, as shown together in the source illustration.', 'The bowl moves through a pattern that also changes. At 60 s the range is 31.7–69.0°C. Improvement here is specific to this chosen field and sample, not a universal guarantee.', {stirring: 3}),
    trial('Put a strong field at the center', 'Play with the strong-center field and the turntable. Compare the center of the top with the reference trial.', 'The top center reaches 60.1°C instead of 28.5°C. A turntable leaves the center on its axis, but that location is not necessarily a cold spot.', {field: 1}, 'food', 'top'),
    trial('Heat a smaller portion', 'Play the 0.1 kg sample for 60 s.', 'The chosen coupling deposits less total energy, 18.89 kJ, but there is less mass to warm. The mean reaches 65.1°C and the hottest volume 97.3°C.', {mass: 0.1}),
    trial('Heat a larger portion', 'Play the 1 kg sample for the same 60 s.', 'The wider sample gains 47.68 kJ, yet its mean is only 31.4°C because that energy is shared by more mass. Its hottest volume reaches 39.8°C.', {mass: 1}),
    trial('Run with microwave output off', 'Play the zero-power comparison. The turntable can move, but RF output stays off.', 'The entire sample remains at 20.0°C and gains 0.00 kJ. Mechanical motion alone does not produce the modeled microwave heating.', {level: 0}),
    trial('Reach the experiment limit', 'Request 300 s at full power and inspect the end of heating, then the final standing state.', 'The first volume reaches 100°C at about 91.0 s, so this experiment stops RF input and continues conduction. It does not predict boiling, and this cutoff is not a claim about real oven controls.', {seconds: 300}),
    trial('Compare wavelength and spot spacing', 'Use the stationary field. Play briefly, then pause to inspect the isolated field guides from above.', 'Adjacent field-guide rings are 6.1 cm apart. The chosen pattern uses half the 12.2 cm free-space wavelength. Frequency times wavelength is the speed of light; a real loaded oven need not have this simple pattern.', {stirring: 0, seconds: 10}, 'field', 'top'),
  ],
  deeper: [
    {title: 'A polar molecule is not a tiny motor', body: 'The field exerts torque on a molecule with separated charge. In a liquid or water-rich material, collisions and neighboring molecules impede its response. The delayed polarization response can dissipate field energy. Other food constituents and mobile ions also affect absorption; the little rotating sketch is only a causal picture.'},
    {title: 'Interference does not promise a cold center', body: 'A simple standing wave has intensity maxima separated by half a wavelength along its standing-wave direction. Real ovens contain multiple reflected fields, and their patterns depend on cavity geometry, the load and temperature-dependent material properties. This lesson deliberately offers several field positions rather than declaring the center universally cold.'},
    {title: 'Penetration depth depends on the food', body: 'Microwave energy can be deposited below the surface, but it attenuates as it travels through absorbing material. The relevant depth depends on dielectric properties, frequency and temperature. The 1.2 cm attenuation length here is a chosen teaching input, not a rule for every watery food. The model combines side, top and bottom exposure.'},
    {title: 'Why standing helps', body: 'Conduction transfers energy from hot volumes to cold ones without creating heat. In this insulated model, the sum of all stored thermal energy remains fixed after RF input ends. Real food also exchanges heat with its container and surroundings; moving liquids can transfer heat by convection.'},
    {title: 'Conventional and inverter power control', body: 'This supply switches 800 W of microwave output on and off in 20 s cycles. At 30%, it runs for 6 s and rests for 14 s. Some inverter ovens regulate power differently, so burst control must not be presented as a limit shared by all magnetrons or ovens.'},
    {title: 'The door is more than a perforated sheet', body: 'A conducting screen with openings small compared with the microwave wavelength strongly attenuates transmission, while visible light passes through. The door frame, seals and interlocks are also part of the system. Saying that no wave can ever pass through a small hole would be too absolute.'},
    {title: 'The energy ledger closes', body: 'Each finite volume stores mass × specific heat × temperature rise. Every conductive exchange is added to one volume and subtracted from its neighbor. Microwave deposition is normalized so its sum equals the chosen absorbed power. The chart, colors and energy reading therefore come from the same state.'},
  ],
  misconception: 'A turntable does not guarantee even heating, and the center is not always the coldest point. It averages the paths traveled by the food, while absorption, field position, depth and conduction still matter.',
  limits: 'This is a qualitative heating experiment, not a prediction for cooking food. An 800 W RF source uses conventional 20 s burst cycles. The sample is a nonflowing, water-like cylinder 5 cm deep, divided into 1,156 finite volumes. Density is 1,000 kg/m³, heat capacity 4,186 J/(kg·K) and conductivity 0.6 W/(m·K), held constant. Chosen coupling is 1 − exp(−mass/0.2 kg). A prescribed horizontal field pattern and 1.2 cm exponential side/top/bottom exposure are normalized to that absorbed power. The field is not solved from Maxwell’s equations for this geometry. A turntable rotates at 6 rpm of oven time; the mode-stirrer proxy moves the pattern around a circle every 8 s. Paired conduction conserves energy with insulated boundaries. There is no fluid convection, thawing, evaporation, container heating, heat loss or temperature-dependent dielectric response. At the first 100°C volume, the experiment stops RF input and continues standing to 300 s. This artificial model boundary is not a real oven safety control. Oven time runs ten times faster than playback; the molecular picture is independently slowed and enlarged.',
  sources: [
    {title: 'OpenStax College Physics 2e: microwave heating and electromagnetic waves', url: 'https://openstax.org/books/college-physics-2e/pages/24-3-the-electromagnetic-spectrum'},
    {title: 'FDA: microwave ovens, heating and door interlocks', url: 'https://www.fda.gov/radiation-emitting-products/resources-you-radiation-emitting-products/microwave-ovens'},
    {title: 'Panasonic: conventional and inverter microwave power control', url: 'https://www.panasonic.com/ca/consumer/home-appliances-learn/panasonickitchen/30yearsofinverter.html'},
    {title: 'Zhang and Datta: coupled electromagnetic and thermal modeling of microwave heating', url: 'https://pubmed.ncbi.nlm.nih.gov/10935193/'},
    {title: 'MIT 6.013: waveguide modes and cutoff frequencies', url: 'https://www.ocw.mit.edu/courses/6-013-electromagnetics-and-applications-spring-2009/d9425aa2b1acd0c1fc121965ad7eafec_MIT6_013S09_lec16.pdf'},
  ],
  quiz: {
    question: 'The center of the bowl stays on the turntable axis. What follows from that?',
    options: ['It samples the field at that location, which may be weak or strong.', 'It must always be the coldest point.', 'The turntable makes the entire bowl equally hot.'],
    answer: 0,
    explanation: 'Rotation does not move the center to another position, but the field there need not be weak. The strong-center experiment reverses the reference comparison. A mode stirrer can change the field at that same location.',
  },
};

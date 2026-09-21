// The pages and sheets behind the generator, the transformer and the line, and
// the sentences each lesson has to say about what the models leave out.

export const sources = {
  induction: {title: 'Wikipedia: Electromagnetic induction', url: 'https://en.wikipedia.org/wiki/Electromagnetic_induction'},
  faraday: {title: 'Wikipedia: Faraday’s law of induction', url: 'https://en.wikipedia.org/wiki/Faraday%27s_law_of_induction'},
  generator: {title: 'Wikipedia: Electric generator', url: 'https://en.wikipedia.org/wiki/Electric_generator'},
  alternator: {title: 'Wikipedia: Alternator', url: 'https://en.wikipedia.org/wiki/Alternator'},
  commutator: {title: 'Wikipedia: Commutator (electric)', url: 'https://en.wikipedia.org/wiki/Commutator_(electric)'},
  slipRing: {title: 'Wikipedia: Slip ring', url: 'https://en.wikipedia.org/wiki/Slip_ring'},
  transformer: {title: 'Wikipedia: Transformer', url: 'https://en.wikipedia.org/wiki/Transformer'},
  distributionTransformer: {title: 'Wikipedia: Distribution transformer', url: 'https://en.wikipedia.org/wiki/Distribution_transformer'},
  steel: {title: 'Wikipedia: Electrical steel', url: 'https://en.wikipedia.org/wiki/Electrical_steel'},
  ecodesign: {title: 'Commission Regulation (EU) No 548/2014 on power transformers', url: 'https://eur-lex.europa.eu/legal-content/EN/TXT/HTML/?uri=CELEX:32014R0548'},
  resistivity: {title: 'Wikipedia: Electrical resistivity and conductivity', url: 'https://en.wikipedia.org/wiki/Electrical_resistivity_and_conductivity'},
  transmission: {title: 'Wikipedia: Electric power transmission', url: 'https://en.wikipedia.org/wiki/Electric_power_transmission'},
  distribution: {title: 'Wikipedia: Electric power distribution', url: 'https://en.wikipedia.org/wiki/Electric_power_distribution'},
  overhead: {title: 'Wikipedia: Overhead power line', url: 'https://en.wikipedia.org/wiki/Overhead_power_line'},
  acsr: {title: 'Wikipedia: Aluminium-conductor steel-reinforced cable', url: 'https://en.wikipedia.org/wiki/Aluminium-conductor_steel-reinforced_cable'},
  sheet: {title: 'Priority Wire and Cable: ACSR bare aluminum conductor sheet', url: 'https://www.prioritywire.com/specs/ACSR.pdf'},
  insulator: {title: 'Wikipedia: Insulator (electricity)', url: 'https://en.wikipedia.org/wiki/Insulator_(electricity)'},
  victorTransmission: {title: 'Victor Insulators: 2026 transmission catalog', url: 'https://www.victorinsulators.com/wp-content/uploads/2026/04/Victor-Insulators-2026-Catalog_full-Transmission.pdf'},
  victorDistribution: {title: 'Victor Insulators: 2026 distribution catalog', url: 'https://www.victorinsulators.com/wp-content/uploads/2026/04/Victor-Insulators-2026-Catalog_full-Distribution.pdf'},
  tower: {title: 'Wikipedia: Transmission tower', url: 'https://en.wikipedia.org/wiki/Transmission_tower'},
  corona: {title: 'Wikipedia: Corona discharge', url: 'https://en.wikipedia.org/wiki/Corona_discharge'},
  dielectric: {title: 'Wikipedia: Dielectric strength', url: 'https://en.wikipedia.org/wiki/Dielectric_strength'},
  mains: {title: 'Wikipedia: Mains electricity', url: 'https://en.wikipedia.org/wiki/Mains_electricity'},
  nationalGrid: {title: 'Wikipedia: National Grid (Great Britain)', url: 'https://en.wikipedia.org/wiki/National_Grid_(Great_Britain)'},
};

/** What every lesson on the bench generator leaves out or takes without a source. */
export const generatorLimits = 'Not from a source: a single rectangular loop of 200 by 100 mm wound with 2.5 mm² copper wire, a field of 0 to 1.2 T, loads of 1 to 50 Ω, and a commutator whose gaps are 6° wide and whose brush faces are 10°. A real machine has a slotted iron armature carrying many coils, a shaped air gap, and a commutator of many segments. The drive is ideal: it holds the speed you ask for whatever the coil is doing. The winding has resistance but no inductance, and friction, windage, iron loss, armature reaction and the stored energy of the spinning rotor are all left out. The field is taken as the same everywhere between the poles.';

/** What every lesson on the transformer leaves out or takes without a source. */
export const transformerLimits = 'Not from a source: the core areas of 0.9, 0.3 and 0.03 m², the window drawn the same 1.2 by 1.8 m at every stage, and 20 real turns for every turn drawn. The magnetizing current is taken as 0.5 percent of rated current at rated flux and in proportion to the flux, where the real relation bends and saturates. The load and no load losses of the two larger stages are set so that each just reaches the Peak Efficiency Index the regulation asks of its rating, keeping the ratio of one loss to the other that the 400 kVA unit has. An aluminum winding is taken to have the same cross section as a copper one, so it wastes the ratio of their resistivities more; a real machine would use more aluminum. The machine is drawn as one winding pair carrying the whole rating, where a real one is three of them; the core is linear and never saturates; leakage, inrush, temperature and the tap changer are left out.';

/** What every lesson on the line leaves out or takes without a source. */
export const lineLimits = 'Not from a source: a power factor of 1, a span of 200 to 500 m, a pull of 12 to 30 percent of what would break the conductor, 8 m of clearance under the lowest point and 3 m of steel above the top crossarm. The line has resistance but no inductance and no capacitance, and its resistance is the sheet figure at 75 °C whatever the current is really doing. The string is worked out from creepage alone, at the lower end of the sourced range; the voltage it can stand comes from a straight line fitted to six units on a maker sheet whose creepage runs from 2,164 to 4,350 mm, read beyond that range at the highest voltages. The surface it leaks along is taken as 500 MΩ for every mm of creepage dry and 500 kΩ wet, which is declared. Ice, wind, conductor creep, temperature, corona loss, the ground wire and the second and third phases of the tower are left out.';

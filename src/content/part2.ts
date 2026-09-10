import type {Topic} from '../topics.ts';

/** Part 2 of the book: harnessing the elements. */
export const part2: Topic[] = [
  {
    id: 'floating',
    index: 11,
    part: 2,
    name: 'Floating',
    category: 'Harnessing the elements',
    tagline: 'Weight against water pushed aside',
    blurb: 'A body floats when it can shove aside its own weight of fluid.',
    summary:
      'Push something into water and the water pushes back, exactly as hard as the weight of the water it had to move out of the way. A body settles at the depth where that upward push equals its own weight, or it goes to the bottom because even fully submerged it cannot shove aside enough.',
    principle:
      'The push upward is the weight of the fluid displaced, and nothing about the material enters into it. So the only number that decides the outcome is average density: its mass divided by how much room it takes up, compared with the same figure for the fluid. Steel is eight times denser than water and a lump of it sinks. Beat that steel into a shell around a great deal of air and the average comes out well under water, so the ship floats and sits at exactly the depth where the displaced water matches its weight.',
    legend: {effort: 'the hull\u2019s own weight', delivered: 'the water\u2019s upthrust'},
    parts: [
      {
        id: 'hull',
        name: 'The hull',
        role: 'What is being floated',
        description:
          'A shell enclosing far more air than material. What matters is not what it is made of but the average density of everything inside its outline, cargo and air included.',
        principle:
          'The hull settles until the water it has pushed aside weighs the same as the hull does. Load it and it settles deeper; unload it and it rises, because the balance has to be struck again.',
      },
      {
        id: 'ballast',
        name: 'Ballast and cargo',
        role: 'Density on demand',
        description:
          'What is loaded into the hold. Here it is solid, filling the hull from the keel up; a submarine does the same job with tanks it can flood with water or blow empty with compressed air.',
        principle:
          'Load more and the average density rises toward the water’s, so the hull sits lower or, past the crossover, goes under. Take it out and it rises again. A submarine spends its life within a few percent either side of neutral.',
      },
      {
        id: 'line',
        name: 'The load line',
        role: 'How deep it may sit',
        description:
          'A mark on the side showing the deepest the hull may legally float. Different marks apply to different waters, because water is not all equally dense.',
        principle:
          'Sea water is about two and a half percent denser than fresh, so the same ship sits a little higher at sea than in a river, and higher again in cold water than in warm. Some of the extra marks account for that, and the rest are allowances for the weather a given ocean is likely to give her in a given season.',
      },
      {
        id: 'water',
        name: 'The water',
        role: 'What does the pushing',
        description:
          'The fluid the hull sits in. Its density is half of every calculation on this bench.',
        principle:
          'Pressure in a fluid grows with depth, so the bottom of a submerged body is pressed harder than its top. That difference, summed over the whole surface, is the upthrust, and it works out to exactly the weight of the fluid displaced.',
      },
    ],
    applications: [
      {name: 'Ships', note: 'A steel hull encloses enough air to bring its average density well under the water’s, and cargo is loaded until the marks on the side say stop.'},
      {name: 'Submarines', note: 'Ballast tanks trade air for water to cross from floating to submerged, and hydroplanes steer the depth once it is moving.'},
      {name: 'Airships and balloons', note: 'The same rule in air. A hot air balloon floats because heating the air inside it makes it less dense than the air outside; a gas airship uses helium for the same reason.'},
      {name: 'Hydrometers', note: 'A weighted float sits deeper in a thin liquid than a dense one, so the depth it settles at reads the density directly.'},
      {name: 'Stabilizers', note: 'Small wings on a ship’s flanks turn the water flowing past into a force that resists roll, the same trick a wing uses in air.'},
    ],
    facts: [
      ['Chapter', 'Part 2 · Harnessing the elements'],
      ['Family', 'Fluid statics'],
      ['Set by', 'Average density against the fluid’s'],
      ['Trades', 'Nothing: it is a balance, not a machine'],
    ],
  },
  {
    id: 'flying',
    index: 12,
    part: 2,
    name: 'Flying',
    category: 'Harnessing the elements',
    tagline: 'Air turned downward',
    blurb: 'A wing throws air down, and the air pushes the wing up.',
    summary:
      'A wing is a device for turning a great deal of air downward. Air leaving the wing carries downward momentum it did not arrive with, and the push that gave it that momentum has an equal and opposite partner acting on the wing. That partner is lift.',
    principle:
      'Tilt the wing further into the flow and it deflects more air, so lift grows in step with the angle, roughly a tenth of a unit of lift coefficient per degree. It also grows with the square of the speed, because faster flight meets more air per second and throws each parcel down harder. The pressure difference between the upper and lower surfaces is how that push is delivered to the structure, not a separate cause, and it has nothing to do with the two halves of a parted airflow needing to meet again at the trailing edge. Keep tilting and the flow eventually cannot follow the upper surface: it separates, lift collapses, and the wing has stalled.',
    legend: {effort: 'drag, the price of it', delivered: 'lift'},
    parts: [
      {
        id: 'wing',
        name: 'The wing',
        role: 'What turns the air',
        description:
          'A section curved on top and set at an angle to the oncoming air. The curve helps the flow stay attached at larger angles; the angle is what does most of the turning.',
        principle:
          'The wing has to leave the air moving downward. Everything else follows: the lift it gets, the drag it pays for that lift, and the angle past which the flow gives up and lift is lost.',
      },
      {
        id: 'flow',
        name: 'The airflow',
        role: 'What gets turned',
        description:
          'The air arriving level and leaving with a downward slant. The size of that slant, multiplied by how much air is passing, is the whole of the lift.',
        principle:
          'Faster flight sends more air past per second and turns each parcel harder, so lift grows with the square of the speed. That is why an aircraft takes off only above a certain speed and why it must land above one too.',
      },
      {
        id: 'forces',
        name: 'Lift and drag',
        role: 'What comes out',
        description:
          'Lift acts square to the oncoming air, drag along it. The ratio of the two is the single figure that decides how far an aircraft can glide with the engines off.',
        principle:
          'Some drag is the price of having any shape at all. The rest is the price of making lift, and it grows with the square of the lift and falls with the slenderness of the wing, which is why a glider’s wings are so long and thin.',
      },
      {
        id: 'flap',
        name: 'The flap',
        role: 'A bigger wing when needed',
        description:
          'A hinged section at the trailing edge, lowered for takeoff and landing and tucked away in cruise.',
        principle:
          'Lowering this hinged flap increases the wing’s curve, allowing more lift at low speed, with extra drag. Some real flaps also slide outward to increase area. This model assumes a lower stall angle with the flap down; the actual change depends on the wing and flap design.',
      },
    ],
    applications: [
      {name: 'Airliner wing', note: 'Flaps and slats for slow flight, spoilers to dump lift on landing, ailerons to roll. Every one of them changes how much air the wing turns.'},
      {name: 'Helicopter rotor', note: 'A wing that makes its own airspeed by going round. Changing the pitch of the blades changes the lift; changing it once per revolution tilts the whole machine.'},
      {name: 'Glider', note: 'Very long, very slender wings, because the drag that comes with lift falls as the wing gets slimmer. Fifty meters forward for every meter down is achievable.'},
      {name: 'Sail', note: 'A wing stood on its edge. It turns air sideways, and a boat can therefore sail across the wind, and even partly into it.'},
      {name: 'Hydrofoil', note: 'The same shape in water, which is eight hundred times denser, so a small foil lifts a whole hull clear of the surface.'},
    ],
    facts: [
      ['Chapter', 'Part 2 · Harnessing the elements'],
      ['Family', 'Fluid dynamics'],
      ['Set by', 'Angle, speed and wing area'],
      ['Trades', 'Drag for lift'],
    ],
  },
  {
    id: 'pressure-power',
    index: 13,
    part: 2,
    name: 'Pressure power',
    category: 'Harnessing the elements',
    tagline: 'Force sent down a pipe',
    blurb: 'A push on trapped fluid can send a larger push to another piston.',
    summary:
      'Squeeze a fluid in a closed container and the pressure rises by the same amount at every point in it, wherever you press. Put a small piston at one end and a large one at the other and the same pressure acts on a larger area, so a larger force comes out. It is a lever whose arms are pipes and can be routed anywhere.',
    principle:
      'Pressure is force spread over area, and pressing on a trapped fluid raises it by the same amount everywhere in it. The pressure itself still varies a little with height, because the fluid has weight, but the change is passed on undiminished. So the force out is the force in multiplied by the ratio of the areas, and the bargain is the familiar one: the large piston moves that many times less far, because the volume that leaves one cylinder is the volume that arrives at the other. A liquid barely compresses, so little motion is used up compressing it. Pressure changes travel quickly through it, but not instantly. A gas gives first, storing energy in the squeeze, which makes it springy and forgiving where a liquid is much stiffer.',
    parts: [
      {
        id: 'small',
        name: 'The small piston',
        role: 'Where the effort goes in',
        description:
          'The pedal cylinder, the master cylinder, the hand pump. A modest force on a small area is enough to raise the pressure a long way.',
        principle:
          'This piston sets the pressure: force divided by its own area. Make it smaller and the same push produces more pressure, and therefore more force at the other end, over a proportionally longer stroke.',
      },
      {
        id: 'large',
        name: 'The large piston',
        role: 'Where the work comes out',
        description:
          'The ram, the brake cylinder, the jack. Its area is the multiplier.',
        principle:
          'The same pressure acting on a larger area gives a larger force. Its travel is the volume pushed in divided by its own area, so a piston twenty five times the area moves a twenty fifth as far.',
      },
      {
        id: 'fluid',
        name: 'The fluid',
        role: 'What carries the pressure',
        description:
          'Oil or brake fluid for a hydraulic system, air for a pneumatic one. The choice decides how the machine feels.',
        principle:
          'A liquid hardly compresses, so a piston can transmit motion through it with little springiness. A gas compresses much more, so its pressure must build before it can lift the load. Precise positioning usually needs feedback; either type of system can use control loops.',
      },
      {
        id: 'load',
        name: 'The load',
        role: 'What is being moved',
        description:
          'Whatever the large piston pushes: a brake pad, a car on a jack, the blade of a press.',
        principle:
          'No energy appears from nowhere. For the ideal liquid press, work at the small piston equals work at the large one: force trades against travel. With gas, some input energy is stored during compression or exchanged as heat. Real systems also lose energy through friction and leaks.',
      },
    ],
    applications: [
      {name: 'Car brakes', note: 'One pedal, four wheels. Pressure raised at the master cylinder appears undiminished at every wheel cylinder, and each acts on a much larger piston.'},
      {name: 'Power steering', note: 'A belt-driven pump keeps oil under pressure; a valve on the steering column lets it into one side of a ram, so the wheels are turned by the engine and the driver only steers the valve.'},
      {name: 'Excavator', note: 'Rams at every joint, each with a hose to a pump. Any joint can be given a great deal of force without a gear train reaching it.'},
      {name: 'Pneumatic drill', note: 'Compressed air drives a piston back and forth onto the tool. The springiness of the air is exactly what suits it to hammering.'},
      {name: 'Aerosol and pumps', note: 'Pressure difference moving fluid about: propellant pushing a liquid out through a nozzle, a piston or a spinning impeller pushing water along a pipe.'},
    ],
    facts: [
      ['Chapter', 'Part 2 · Harnessing the elements'],
      ['Family', 'Force multiplier'],
      ['Set by', 'The ratio of the piston areas'],
      ['Trades', 'Stroke for force'],
    ],
  },
  {
    id: 'exploiting-heat',
    index: 14,
    part: 2,
    name: 'Exploiting heat',
    category: 'Harnessing the elements',
    tagline: 'Work from a difference',
    blurb: 'Heat becomes work only while it is flowing from hot to cold.',
    summary:
      'A heat engine needs a difference in temperature to keep producing work. What an engine exploits is a difference in temperature: heat flows from the hot side to the cold side, and on the way through, some of it can be diverted into work. Run the same machine backward and it will carry heat the other way, from cold to hot, if you pay it in work.',
    principle:
      'The best possible efficiency of a cyclic engine working between two fixed temperatures depends only on those temperatures, measured from absolute zero. Real engines fall below this limit. It is one minus the cold temperature divided by the hot. Widen the gap and more can be had. Close it and nothing can. At least the rest of the heat must be dumped at the cold side; that part is not lost to inefficiency but required, because heat only flows one way on its own and the engine has to leave it somewhere. Run it in reverse and the ratio turns over: the most heat an ideal refrigerator can move for each unit of work is the cold temperature divided by the gap, so across the narrow gap between a kitchen and a freezer it moves several units for one, and across a wide gap it moves less than one.',
    legend: {effort: 'work, in or out', delivered: '', note: 'Duct width is heat; arrow length is work.'},
    parts: [
      {
        id: 'cylinder',
        name: 'The cylinder',
        role: 'Where the work happens',
        description:
          'A piston in a bore, with valves at the head. Gas admitted hot pushes the piston out; gas released cool lets it return.',
        principle:
          'Work is force multiplied by distance, and here it is pressure multiplied by the volume swept. Every trick in engine design is about getting more pressure while the piston is going out than while it is coming back.',
      },
      {
        id: 'hot',
        name: 'The hot side',
        role: 'Where the heat comes from',
        description:
          'Burning fuel, a nuclear core, concentrated sunlight, a furnace. What matters is the temperature it reaches, not the fuel.',
        principle:
          'Raise this temperature and the share available as work rises with it. That is why engines are pushed to the limits of what their materials will stand, and why turbine blades are cooled from the inside.',
      },
      {
        id: 'cold',
        name: 'The cold side',
        role: 'Where the rest must go',
        description:
          'The radiator, the cooling tower, the outside air. Every heat engine has one, and it is not a design failure.',
        principle:
          'Heat only flows down a temperature difference, so an engine must have somewhere colder to reject the part it cannot use. That rejected heat is the reason no engine reaches a hundred percent. The two temperatures set the least of it that must go; every real loss in the machine adds to that figure.',
      },
      {
        id: 'working',
        name: 'The working fluid',
        role: 'What carries the heat',
        description:
          'Steam in a power station, burning gas in an engine, a refrigerant in a fridge. It goes round and round while the heat passes through it.',
        principle:
          'The fluid picks heat up on the hot side, expands and does work, is cooled, and is squeezed back to where it started. A refrigerant does the same cycle in reverse, boiling at low pressure inside the cabinet and condensing at high pressure outside it.',
      },
    ],
    applications: [
      {name: 'Four stroke engine', note: 'Intake, compression, power, exhaust. Only the third stroke does work; a flywheel carries the crank through the other three.'},
      {name: 'Steam power station', note: 'Fuel heats water into high pressure steam, the steam drives a turbine, and a condenser cooled by river or sea water is the cold side that makes the whole thing possible.'},
      {name: 'Jet engine', note: 'A compressor squeezes air, fuel burns in it, and a turbine takes back just enough work to drive the compressor. What is left leaves through the nozzle as thrust.'},
      {name: 'Refrigerator', note: 'The cycle backward. A refrigerant boils inside the cabinet and takes heat with it, then a compressor squeezes it hot so it can give that heat up to the room.'},
      {name: 'Heat pump', note: 'A refrigerator pointed the other way round, warming a house from outside air. Because it moves heat rather than making it, it delivers more warmth than the electricity it consumes.'},
    ],
    facts: [
      ['Chapter', 'Part 2 · Harnessing the elements'],
      ['Family', 'Energy conversion'],
      ['Set by', 'The two temperatures, in kelvin'],
      ['Trades', 'Heat rejected for work delivered'],
    ],
  },
  {
    id: 'nuclear-power',
    index: 15,
    part: 2,
    name: 'Nuclear power',
    category: 'Harnessing the elements',
    tagline: 'Energy from the nucleus',
    blurb: 'Split a heavy nucleus and the pieces weigh less than it did.',
    summary:
      'Break a heavy nucleus apart and the fragments, added up, weigh a shade less than what you started with. That missing mass leaves as energy, and because mass converts at the square of the speed of light, a very small shortfall is an enormous amount. Each split also throws out neutrons, which is what lets one reaction start the next.',
    principle:
      'A reactor is a machine for holding a chain reaction exactly at break even. Every fission releases two or three neutrons; if on average exactly one of them goes on to cause another fission, the rate holds steady. That average is the multiplication factor. Below one the reaction dies away; above one it climbs. How fast it climbs is not simply the factor: a small fraction of the neutrons arrive late, seconds after the fission that made them, and while the excess stays inside that fraction the reaction can only build at the pace those stragglers allow, which is slow enough to steer. Past it the prompt neutrons alone are enough and the rise is measured in fractions of a second. Control rods absorb neutrons without splitting, so pushing them further into the core lowers the factor. The whole of reactor operation is holding that number at one.',
    legend: 'none',
    parts: [
      {
        id: 'fuel',
        name: 'Fuel rods',
        role: 'What splits',
        description:
          'Tubes packed with pellets of uranium oxide, enriched so that enough of it is the isotope that splits readily.',
        principle:
          'A nucleus struck by a slow neutron splits into two lighter nuclei, and the pieces fly apart at speed. That speed is heat, and heat is what the whole power station is built to collect.',
      },
      {
        id: 'control',
        name: 'Control rods',
        role: 'What holds it steady',
        description:
          'Rods of a material that swallows neutrons without splitting, driven into and out of the core between the fuel.',
        principle:
          'Every neutron a control rod absorbs is one that cannot cause a fission. Pushing the rods in lowers the multiplication factor; drawing them out raises it. Full insertion shuts the reaction down.',
      },
      {
        id: 'coolant',
        name: 'The coolant',
        role: 'What takes the heat away',
        description:
          'Water, gas or liquid metal, pumped through the core and out to a heat exchanger.',
        principle:
          'The coolant does two jobs. It carries heat out to make steam, and in a water cooled reactor it also slows the neutrons down, which makes the fuel far likelier to catch them. Fast reactors are built to work without that step, but this kind is not: lose the water and both jobs stop at once.',
      },
      {
        id: 'core',
        name: 'The core and shield',
        role: 'What contains it',
        description:
          'A steel pressure vessel around the fuel, inside meters of concrete.',
        principle:
          'Fission produces radiation and fragments that stay radioactive long after the reaction stops. Containment is therefore not only about pressure but about keeping those products in, during operation and for a long time afterward.',
      },
    ],
    applications: [
      {name: 'Power reactor', note: 'Heat from the core makes steam, and from there it is an ordinary steam power station: turbine, generator, condenser.'},
      {name: 'Ship propulsion', note: 'A core the size of a room runs for years without refuelling, which is why submarines and icebreakers use them.'},
      {name: 'Radioisotopes', note: 'Reactors make isotopes for medical imaging and treatment, and for gauges that measure thickness without touching what they measure.'},
      {name: 'Fusion research', note: 'Joining light nuclei releases more energy again and leaves far less behind, but it needs temperatures no material can touch. One approach holds the fuel in a magnetic field; another squeezes a pellet of it so hard and so fast that it burns before it can fly apart.'},
      {name: 'The Sun', note: 'The same fusion, held together by its own gravity, which is the only container large enough to make it easy.'},
    ],
    facts: [
      ['Chapter', 'Part 2 · Harnessing the elements'],
      ['Family', 'Energy release'],
      ['Set by', 'The multiplication factor'],
      ['Trades', 'Control for output'],
    ],
  },
];

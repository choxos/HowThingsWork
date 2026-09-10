import type {Topic} from '../topics.ts';

/** Part 4: electricity and automation. */
export const part4: Topic[] = [
  {
    id: 'electricity',
    index: 21,
    part: 4,
    name: 'Electricity',
    category: 'Electricity and automation',
    tagline: 'Charge pushed round a loop',
    blurb: 'A voltage pushes, a resistance holds back, and what flows is the difference.',
    summary:
      'Metals are full of electrons that no single atom owns. Left alone they jostle about in every direction and nothing happens. Give them a push, by joining the metal to something that has more electrons at one end than the other, and the whole crowd drifts one way. That drift is a current, and it does not begin at one end and arrive at the other: the push travels at nearly the speed of light, so every electron in the loop starts moving at once.',
    principle:
      'Three quantities describe the whole of it. Voltage is the energy each unit of charge carries, current is how much charge passes a point each second, and resistance is how hard the material makes that passage. For a metal at a steady temperature they are tied together simply: current is voltage divided by resistance. Power follows at once, because energy per charge times charge per second is energy per second: watts are volts times amps. Put resistances one after another and they add, since the same current has to fight through each in turn. Put them side by side and the current has a choice of paths, so more of it flows and the pair behaves as something smaller than either.',
    legend: 'none',
    parts: [
      {
        id: 'supply',
        name: 'The supply',
        role: 'What does the pushing',
        description:
          'A cell or a generator holding one terminal at a higher energy than the other. It does not make electrons; the wire is already full of them. It makes a difference in energy across the loop.',
        principle:
          'Its voltage is fixed here, and every reading follows from it. The energy it delivers each second is its voltage times the current it happens to be pushing, so a lower resistance costs it more, not less.',
      },
      {
        id: 'resistor',
        name: 'The resistance',
        role: 'What holds the current back',
        description:
          'A length of poor conductor. The slider changes it. In parallel a second identical branch is switched in beside it.',
        principle:
          'The moving charges collide with the lattice and give up energy as heat, which is why a resistance warms and why a kettle element is nothing more than a deliberately poor conductor.',
      },
      {
        id: 'flow',
        name: 'The current',
        role: 'What actually moves',
        description:
          'The beads on the wire stand for charge in transit. They move together, all the way round the loop, because a circuit is full before it is switched on.',
        principle:
          'The beads are drawn far faster than electrons really drift. The real drift is well under a millimeter a second even at several amps, and the readout carries that figure. What arrives quickly is the push, not the particles.',
      },
      {
        id: 'lamp',
        name: 'The lamp',
        role: 'Where the energy goes',
        description:
          'A load that turns electrical energy into light and heat. Its brightness here follows the power actually delivered, not the current alone.',
        principle:
          'Power is what a load cares about. Halving the resistance doubles the current and doubles the power, so the lamp brightens; but every watt of it has to come out of the supply.',
      },
    ],
    applications: [
      {name: 'House wiring', note: 'Sockets are wired in parallel so each appliance gets the full supply voltage and can be switched without disturbing the others.'},
      {name: 'Fuse and breaker', note: 'A deliberately weak link that melts, or a switch that trips, when the current passes what the wire can carry without overheating.'},
      {name: 'Heating element', note: 'A resistance chosen so that the power it dissipates at the supply voltage is exactly the heat wanted.'},
      {name: 'Battery', note: 'A chemical reaction that keeps one electrode short of electrons and the other in surplus, maintaining the push as current drains it.'},
      {name: 'Lightning', note: 'The same difference in charge, built up in a cloud until the air itself breaks down and conducts.'},
    ],
    facts: [
      ['Chapter', 'Part 4 · Electricity and automation'],
      ['Family', 'Electrical'],
      ['Set by', 'Voltage and resistance'],
      ['Trades', 'Current against resistance'],
    ],
  },
  {
    id: 'magnetism',
    index: 22,
    part: 4,
    name: 'Magnetism',
    category: 'Electricity and automation',
    tagline: 'A field made by moving charge',
    blurb: 'Every current is wrapped in a field, and a coil gathers it into a bar magnet.',
    summary:
      'A magnet has two ends that behave differently and cannot be separated: break one in half and each half grows the pole it lost. What sets up that field is charge in motion, whether it is a current in a wire or the spin of electrons inside iron. Wind the wire into a coil and every turn adds its field to the next, so a few hundred turns of thin wire make something that behaves exactly like a bar magnet, except that it can be switched off.',
    principle:
      'Inside a long coil the field is the magnetic constant times the turns per meter times the current. Notice what is missing: the width of the coil, and the number of turns on its own. A hundred turns in ten centimeters and two hundred in twenty give the same field. Slide iron into the middle and the field multiplies by hundreds, because the iron’s own domains line up and add their fields to yours. Once they are all lined up the iron has nothing more to add, and further current builds field only as thin air would. Outside the coil the field spreads into the same closed loops a bar magnet makes, leaving one end and returning to the other, never stopping anywhere.',
    legend: {effort: 'the field direction', delivered: 'the force on the compass', note: 'Arrow length is field strength.'},
    parts: [
      {
        id: 'coil',
        name: 'The coil',
        role: 'What makes the field',
        description:
          'Insulated wire wound in a helix. The slider changes the current through it; the variants change what sits inside it.',
        principle:
          'Each turn contributes the same field, so for a coil much longer than it is wide the total depends on how tightly the turns are packed along the length rather than on how many there are altogether. The compass beside this coil is answering to the exact field of a coil of finite length, which falls away past the ends and is a good deal weaker there than in the middle.',
      },
      {
        id: 'core',
        name: 'The core',
        role: 'What multiplies it',
        description:
          'Soft iron, which has domains of its own that swing into line with an applied field. Air, by contrast, does nothing at all.',
        principle:
          'The iron multiplies the field by its relative permeability, several hundred for soft iron. It is treated here as a constant multiplier. In a real core the multiplying stops once every domain is aligned, after which more current adds field only as air would, and the multiplier itself is not one number but a curve.',
      },
      {
        id: 'field',
        name: 'The field lines',
        role: 'What the field looks like',
        description:
          'Closed loops in the dipole form, stretched along the axis so they span the coil: the distance from the middle is the equatorial radius times the square of the sine of the angle from the axis. This is a drawing of what a field like this looks like, not a computation of this coil\u2019s own field.',
        principle:
          'The lines crowd where the field is strong and spread where it is weak, and none of them ends. They are a drawing convention, not objects; the field is present everywhere between them. How many are drawn follows the logarithm of the field, because the slider and the core between them cover four decades and a count in proportion would run from four lines to sixty thousand.',
      },
      {
        id: 'compass',
        name: 'The compass',
        role: 'What answers to it',
        description:
          'A small magnet free to turn. It lines up along the sum of two fields: the coil\u2019s, worked out exactly for a coil of this length at the distance the compass stands, and an assumed 50 microteslas of the earth\u2019s own field lying across the bench, which is what it rests on when the coil is off.',
        principle:
          'The needle turns until its own poles sit along the local field, so its angle is the arctangent of the coil\u2019s field over the earth\u2019s. A compass lying flat answers to the horizontal part of the earth\u2019s field, which in most places is well under the fifty microteslas of the whole of it; this bench assumes the whole of it lies horizontally.',
      },
    ],
    applications: [
      {name: 'Electromagnet', note: 'A crane magnet lifting scrap: switched on it holds tons, switched off it drops them, which no permanent magnet can do.'},
      {name: 'Relay', note: 'A small current through a coil pulls an iron armature that closes contacts carrying a much larger one.'},
      {name: 'Loudspeaker', note: 'A coil in a permanent field, driven by a varying current, pushing a cone back and forth against the air.'},
      {name: 'Magnetic recording', note: 'A coil writes a pattern of magnetized regions on a moving surface, and later reads it back.'},
      {name: 'Compass', note: 'The earth is itself a large, slightly crooked dipole, which is why a needle points near, but not at, the geographic pole.'},
    ],
    facts: [
      ['Chapter', 'Part 4 · Electricity and automation'],
      ['Family', 'Electromagnetic'],
      ['Set by', 'Turns per meter and current'],
      ['Trades', 'Field against current'],
    ],
  },
  {
    id: 'electric-motors',
    index: 23,
    part: 4,
    name: 'Electric motors',
    category: 'Electricity and automation',
    tagline: 'A field pushing on a current',
    blurb: 'Put a current across a field and it is shoved sideways. Hinge it and it turns.',
    summary:
      'A wire carrying current across a magnetic field is pushed, and the push is at right angles to both. Lay a loop of wire in a field so that its two long sides carry current in opposite directions, and one side is pushed up while the other is pushed down. The loop turns. That is the whole of a motor, and everything else in one is arrangements for keeping it turning past the point where the pushing would stop.',
    principle:
      'The turning force is the number of turns, the field, the current and the area of the loop, all multiplied, times the cosine of the angle between the plane of the loop and the field. The forces on the wires do not change with that angle; the levers do. Flat along the field, the two forces have their longest levers and the twist is greatest. Square across the field, both forces pull straight outward through the shaft and the twist is nothing at all: the dead point. A commutator reverses the current exactly there, so the loop is pushed the same way round again rather than being pulled back. As the motor speeds up it generates a voltage of its own that opposes the supply, and the current it draws is only what is left over. That is why a motor draws its heaviest current at the instant of starting, and why loading it down makes it draw more.',
    legend: {effort: 'force on the near side', delivered: 'force on the far side', note: 'Arrow length is force; the pair makes a couple.'},
    parts: [
      {
        id: 'coil',
        name: 'The armature coil',
        role: 'What gets pushed',
        description:
          'A loop of wire on a shaft, lying in the gap between the poles. The slider changes the current in it.',
        principle:
          'Both of its long sides feel a force, and because the current runs opposite ways along them, so do the forces. A pair of equal opposite forces on either side of a shaft is a pure twist. The forces themselves keep the same size whatever angle the coil is at; what changes as it turns is the lever each one has.',
      },
      {
        id: 'magnet',
        name: 'The field magnet',
        role: 'What does the pushing',
        description:
          'A pair of poles either side of the coil, shaped to keep the field across the gap as even as it can be.',
        principle:
          'The field here is fixed. Doubling it would double the twist just as surely as doubling the current, which is why large motors bother with strong field magnets.',
      },
      {
        id: 'commutator',
        name: 'The commutator',
        role: 'What keeps it turning',
        description:
          'A split ring on the shaft with brushes pressing on it. Twice a turn the gap passes the brushes and the connections swap over.',
        principle:
          'Without it the coil would swing to the dead point and stop, or oscillate. With it the current in the coil reverses exactly as the coil passes that point, so the push stays in the same direction of rotation.',
      },
      {
        id: 'forces',
        name: 'The forces',
        role: 'What the arrows show',
        description:
          'One arrow on each long side, drawn to the same scale. They keep their length at every angle; the bar below the shaft is the twist, and that is what shrinks as the coil turns away from the flat position.',
        principle:
          'They are the field times the current times the length of wire in the field, and they stay that size at every angle. The twist is those forces times their levers, and it is the lever that shrinks to nothing at the dead point. The pair never adds up to a net push on the shaft, only a twist, which is why the motor turns rather than flying across the room.',
      },
    ],
    applications: [
      {name: 'Power tools', note: 'A brushed motor with the field from an electromagnet in series with the armature, which gives it a very strong twist at low speed.'},
      {name: 'Electric vehicle', note: 'Brushless motors with the switching done electronically, so nothing rubs and nothing sparks.'},
      {name: 'Hard disc and fan', note: 'Small brushless motors held at a precise speed by counting their own back voltage.'},
      {name: 'Locomotive', note: 'The same principle at thousands of amps, with the motors doubling as brakes by generating instead of driving.'},
      {name: 'Moving coil meter', note: 'A motor deliberately restrained by a spring, so its deflection reads the current rather than spinning on.'},
    ],
    facts: [
      ['Chapter', 'Part 4 · Electricity and automation'],
      ['Family', 'Electromagnetic'],
      ['Set by', 'Current, field, turns and area'],
      ['Trades', 'Twist against speed'],
    ],
  },
  {
    id: 'generators-and-transformers',
    index: 24,
    part: 4,
    name: 'Generators and transformers',
    category: 'Electricity and automation',
    tagline: 'The motor effect run backward',
    blurb: 'Move a coil through a field and a voltage appears. Change the field instead and it still does.',
    summary:
      'A motor and a generator are the same machine. Push current into a coil in a field and it turns; turn the coil in a field and a voltage appears at its ends, which drives a current as soon as there is a circuit to carry it. What matters is change: a coil sitting still in a steady field, however strong, generates nothing. A transformer takes this to its conclusion and moves nothing at all. Two coils share an iron core, an alternating current in the first makes a changing field, and the second sees that change and generates a voltage of its own.',
    principle:
      'The voltage a turning coil generates peaks at the turns times the field times the area times the angular rate, and it varies as a sine wave through the turn, because the rate at which the coil cuts through the field varies. For a coil turned at a steady rate in an even field, which is what makes the output a sine in the first place, the useful steady value is the peak divided by the square root of two. That ratio belongs to the sine and to no other shape of wave. In a transformer the same changing field threads both coils, so each turn of each coil sees the same change and the voltages are in the ratio of the turns. Nothing is created: in the ideal case the power out equals the power in, so more volts means proportionally fewer amps. That trade is what makes long distance transmission possible, because the heat wasted in a line is the current squared times its resistance, and raising the voltage tenfold cuts the waste a hundredfold.',
    legend: 'none',
    parts: [
      {
        id: 'coil',
        name: 'The coil',
        role: 'Where the voltage appears',
        description:
          'In Generator, a loop turned through the field by hand or by an engine. In Transformer, the primary winding, fed with alternating current.',
        principle:
          'Only change generates. The upper trace is the flux through the coil: it is greatest when the coil faces the field square on and crosses zero when the coil is edge on to it. The lower trace is the voltage, which is the rate that flux is changing, so it peaks exactly where the flux crosses zero and is itself zero where the flux is greatest.',
      },
      {
        id: 'field',
        name: 'The field',
        role: 'What is cut, or what changes',
        description:
          'A permanent field between poles in Generator, and a field in the iron core carried from the primary to the secondary in Transformer.',
        principle:
          'The core exists to keep the field inside it, so that nearly all of what the primary makes reaches the secondary. Leakage is real and is not modeled here.',
      },
      {
        id: 'output',
        name: 'The output',
        role: 'What comes out',
        description:
          'Slip rings and a trace in Generator; the secondary winding and its own trace in Transformer. The slider changes how many turns the output winding has.',
        principle:
          'Each machine has one voltage scale used by both its traces, so the secondary is taller or shorter than the primary by exactly the turns ratio. In Generator the upper trace is the flux through the coil, drawn at a fixed height because it is not a voltage, and the lower one is the voltage: notice that the voltage peaks where the flux crosses zero.',
      },
      {
        id: 'load',
        name: 'The load and the line',
        role: 'What it is all for',
        description:
          'The far end of the arrangement: a lamp, and in Transformer the length of line between the two.',
        principle:
          'The line has resistance, so it wastes the square of the current it carries. Sending the same power at a higher voltage means less current, and the waste falls with the square of the voltage.',
      },
    ],
    applications: [
      {name: 'Power station', note: 'Steam, water or wind turns a large generator; transformers step the output up for transmission and back down for use.'},
      {name: 'Bicycle dynamo', note: 'A magnet spun by the wheel past a coil, generating whenever the bicycle moves and not otherwise.'},
      {name: 'Phone charger', note: 'A small transformer, or its switching equivalent, dropping the supply to a few volts.'},
      {name: 'Induction hob', note: 'A coil under the glass makes a rapidly changing field, and the pan itself becomes the shorted secondary that heats.'},
      {name: 'Regenerative braking', note: 'A vehicle’s motors run as generators, so slowing down puts charge back rather than making brake dust.'},
    ],
    facts: [
      ['Chapter', 'Part 4 · Electricity and automation'],
      ['Family', 'Electromagnetic'],
      ['Set by', 'Rate of change and the turns ratio'],
      ['Trades', 'Voltage against current'],
    ],
  },
  {
    id: 'sensors-and-detectors',
    index: 25,
    part: 4,
    name: 'Sensors and detectors',
    category: 'Electricity and automation',
    tagline: 'The world turned into a voltage',
    blurb: 'Put something that answers to the world in half of a divider, and read the middle.',
    summary:
      'A machine that governs itself has to measure something first. Nearly every measurement ends the same way: a component whose electrical behavior changes with the quantity of interest is placed in a circuit, and the circuit turns that change into a voltage that a meter or a processor can read. The sensor is rarely the clever part. The arrangement around it, which turns a small change into a readable one and keeps everything else from changing at the same time, usually is.',
    principle:
      'The standard arrangement is the potential divider: two resistances in a line across the supply, with the reading taken between them. The output is the supply times the lower resistance divided by the total, so as the sensor changes, the middle point moves. A thermistor drops its resistance sharply as it warms, following an exponential law fitted over a limited range. A platinum element does the opposite and does it gently, rising by about 0.385 percent of its ice point resistance for each degree, in a line straight enough to trust across a wide span. A strain gauge, which this bench does not show, works the same way for a different quantity: glued to a beam it gets longer and thinner as the beam bends, and its resistance rises by about twice the fractional stretch. A thermocouple needs no supply at all: two different metals joined make their own small voltage, some tens of microvolts for each kelvin of difference between the joint and the cold end. In every case the answer is a voltage, and in every case it is only as good as the reference it is compared against.',
    legend: 'none',
    parts: [
      {
        id: 'sensor',
        name: 'The sensing element',
        role: 'What answers to the world',
        description:
          'A thermistor bead, a platinum element or a thermocouple junction, depending on the variant. The slider changes the temperature all three are asked to read.',
        principle:
          'Each has its own law and its own units, and every one of the three laws here is an approximation with a stated range. The readout names the law being used, because a sensor quoted without its model is not a measurement.',
      },
      {
        id: 'divider',
        name: 'The divider',
        role: 'What turns a resistance into a voltage',
        description:
          'A fixed resistance above and the sensor below, across the supply. The bar between them shows where the middle point sits.',
        principle:
          'The output is largest for a given change when the two halves are near equal, which is why the fixed half is chosen to match the sensor at the middle of the range being measured.',
      },
      {
        id: 'meter',
        name: 'The readout',
        role: 'What reads the middle',
        description:
          'A needle on a scale, standing for anything that measures a voltage: a meter, an amplifier, or the input of a processor.',
        principle:
          'It is assumed to draw no current of its own. A real meter that loads the divider changes the very voltage it is trying to read, which is one of the oldest traps in measurement.',
      },
      {
        id: 'reference',
        name: 'The reference',
        role: 'What it is measured against',
        description:
          'The fixed supply, and for the thermocouple the cold end whose temperature has to be known separately.',
        principle:
          'Every reading here is a comparison. If the supply sags or the cold end drifts, the reading moves without anything happening in the world, which is why a good instrument spends most of its effort on its reference.',
      },
    ],
    applications: [
      {name: 'Thermostat', note: 'A thermistor or bimetal strip deciding when a heater runs, which is the simplest machine that governs itself.'},
      {name: 'Weighing scale', note: 'Strain gauges on a metal element, usually four in a bridge so that bending is read and temperature is canceled.'},
      {name: 'Kiln and engine probes', note: 'Thermocouples, which survive temperatures that would destroy anything with a semiconductor in it.'},
      {name: 'Smoke detector', note: 'A light beam or a small ionization chamber whose current changes when smoke enters, latching an alarm.'},
      {name: 'Automatic doors', note: 'An infrared or microwave detector answering to movement, wired so that the failure of the sensor opens rather than traps.'},
    ],
    facts: [
      ['Chapter', 'Part 4 · Electricity and automation'],
      ['Family', 'Instrumentation'],
      ['Set by', 'The sensing law and the reference'],
      ['Trades', 'Sensitivity against range'],
    ],
  },
];

import type {Topic} from '../topics.ts';

/** Part 1 of the book: the mechanics of movement. */
export const part1: Topic[] = [
  {
    id: 'inclined-plane',
    index: 1,
    part: 1,
    name: 'The inclined plane',
    category: 'The mechanics of movement',
    tagline: 'Trade distance for effort',
    blurb: 'A longer slope needs a smaller push over a longer trip.',
    summary:
      'A ramp does not reduce the work of lifting something. It spreads that work over a longer path, so the force you need at any moment gets smaller. Every wedge, blade, plow and zipper is a version of the same idea.',
    principle:
      'Raising a load to a given height always stores the same amount of energy in it. In an ideal machine, with no friction and steady motion, the work you put in equals that energy, and work is force multiplied by the distance you apply it over. Stretching the distance therefore shrinks the force: a slope three times as long as the height it climbs needs a third of the force, applied over three times the distance.',
    parts: [
      {
        id: 'slope',
        name: 'Sloping face',
        role: 'The plane itself',
        description:
          'The working surface of the ramp. In the ideal case its length compared with the height it climbs is the only number that matters. A real surface adds friction and rolling resistance on top of that figure, which is why a rough ramp is harder work than a smooth one of the same shape.',
        principle:
          'Push the load along the slope and gravity resists with only the component of its weight that acts along the surface, which is the weight times height divided by slope length. Lengthen the slope and that component falls, while the journey gets correspondingly longer.',
      },
      {
        id: 'lift',
        name: 'Vertical face',
        role: 'The comparison',
        description:
          'The bare height the load has to gain. Hoisting straight up this face is the shortest route and the hardest one, because nothing is there to share the weight.',
        principle:
          'Lifting vertically means supporting the full weight for the whole climb. It is the reference against which every ramp is measured, and the total work done is identical.',
      },
      {
        id: 'load',
        name: 'The load',
        role: 'What gets raised',
        description:
          'The mass being moved. Its weight sets the scale of everything else: the force along the slope, the force straight up, and the energy stored once it arrives at the top.',
        principle:
          'At the top the load holds gravitational energy equal to its weight times the height gained, whichever route it took. That is why no ramp can cheat the total, and why the numbers here assume steady motion: speeding the load up costs extra energy on the way.',
      },
      {
        id: 'wedge',
        name: 'The wedge',
        role: 'A plane that moves',
        description:
          'Turn an inclined plane on its side and drive it forward instead of climbing it, and you have a wedge. Doorstops, axes, chisels, plow blades and the slider of a zipper are all wedges.',
        principle:
          'The wedge travels a long way forward and pushes its load a short way sideways, so a modest shove becomes a powerful parting force at right angles to the motion.',
      },
    ],
    applications: [
      {name: 'Cylinder lock', note: 'The serrations of a key are a row of wedges that raise each spring loaded pin to exactly the right height, freeing the cylinder to turn.'},
      {name: 'Axe and scissors', note: 'A blade is a wedge. A long stroke in one direction becomes a strong parting force across it.'},
      {name: 'The plow', note: 'Coulter, share and moldboard are three wedges in a row that cut, free, then turn over the top layer of soil.'},
      {name: 'The zipper', note: 'One wedge inside the slider pries the teeth apart, and two more force them back together in sequence.'},
      {name: 'The screw', note: 'A screw thread is an inclined plane wrapped around a cylinder, which is why a small turn drives a large clamping force.'},
    ],
    facts: [
      ['Chapter', 'Part 1 · The mechanics of movement'],
      ['Family', 'Simple machine'],
      ['Trades', 'Distance for force'],
      ['Ideal efficiency', 'Work in equals work out'],
    ],
  },
  {
    id: 'levers',
    index: 2,
    part: 1,
    name: 'Levers',
    category: 'The mechanics of movement',
    tagline: 'A bar, a pivot, and a bargain',
    blurb: 'Where you push counts as much as how hard you push.',
    summary:
      'A lever is a bar that tilts on a pivot. Where you push matters as much as how hard, because effort and load are traded against their distances from the pivot. Three arrangements of those points cover almost every lever ever built.',
    principle:
      'Effort multiplied by its distance from the fulcrum equals load multiplied by its distance from the fulcrum, with each distance measured square to the line the force acts along. Move the effort further out and less of it is needed, but it has to travel further to do the same job.',
    parts: [
      {
        id: 'bar',
        name: 'The bar',
        role: 'The rigid link',
        description:
          'A stiff beam, plank, handle or bone. Its only requirement is that it does not bend, so that a movement at one point becomes a fixed, predictable movement at every other point.',
        principle:
          'Because the bar is rigid, every point on it swings through the same angle. Points further from the pivot therefore sweep longer arcs, which is the whole source of the lever advantage.',
      },
      {
        id: 'fulcrum',
        name: 'The fulcrum',
        role: 'The pivot',
        description:
          'The fixed point the bar turns about. It can be a stone under a plank, a hinge pin, a wheel axle, or a wrist joint.',
        principle:
          'The fulcrum carries whatever the effort and the load do not cancel between them, while still allowing rotation. Sliding it changes both arm lengths at once, which is why a small move can transform the machine.',
      },
      {
        id: 'effort',
        name: 'The effort',
        role: 'What you supply',
        description:
          'The force applied to the bar: a hand on a handle, a foot on a pedal, a hydraulic ram on a boom.',
        principle:
          'The effort moves through an arc set by its distance from the fulcrum. Far out, it is gentle and long. Close in, it is fierce and short.',
      },
      {
        id: 'load',
        name: 'The load',
        role: 'What resists',
        description:
          'The weight to be raised or the resistance to be overcome: a nail in a plank, a shell to crack, a wheel rim to grip.',
        principle:
          'The load swings through its own arc: opposite to the effort in a first class lever, and the same way as the effort in the other two, where both sit on one side of the fulcrum. Whichever class it is, force and travel are exact inverses of the effort side, so the work balances.',
      },
    ],
    applications: [
      {name: 'First class', note: 'Fulcrum in the middle. A balance, a nail extractor, a pair of scissors, the crank of a bathroom scale.'},
      {name: 'Second class', note: 'Load in the middle. A wheelbarrow, a bottle opener, a nutcracker. Always multiplies force.'},
      {name: 'Third class', note: 'Effort in the middle. A fishing rod, tweezers, a hammer swing, an excavator boom. Always multiplies speed and reach.'},
      {name: 'Grand piano action', note: 'A chain of levers turns a fingertip movement into a faster, longer hammer stroke, then catches the hammer so the note can repeat.'},
      {name: 'Bicycle brake', note: 'A hand lever multiplies the squeeze and passes it down a cable to a pair of brake arms, which share that pull between the two sides of the rim.'},
    ],
    facts: [
      ['Chapter', 'Part 1 · The mechanics of movement'],
      ['Family', 'Simple machine'],
      ['Classes', 'First, second, third'],
      ['Law', 'Effort × arm = load × arm'],
    ],
  },
  {
    id: 'wheel-and-axle',
    index: 3,
    part: 1,
    name: 'The wheel and axle',
    category: 'The mechanics of movement',
    tagline: 'A lever bent into a circle',
    blurb: 'A rotating lever that never runs out of stroke.',
    summary:
      'Bend a lever around until it comes back on itself and you get a wheel and axle: a rotating lever that never runs out of stroke. The rim is the long arm, the axle is the short one, and the center is the fulcrum.',
    principle:
      'Effort applied at the rim turns the axle with greater force but through a shorter distance. Drive the axle instead and the rim surface moves faster than the axle surface, trading that force back for speed. Both turn through the same angle at every moment; only the distance each covers differs.',
    parts: [
      {
        id: 'wheel',
        name: 'Wheel and handles',
        role: 'The long arm',
        description:
          'The outer part: a rim, a set of cranked handles, a screwdriver grip, a steering wheel, a windmill sail, a waterwheel paddle.',
        principle:
          'A point on the rim sweeps a large circle for each turn. The wider the wheel, the longer that journey, and the lighter the force needed at the rim to produce the same torque.',
      },
      {
        id: 'axle',
        name: 'Axle drum',
        role: 'The short arm',
        description:
          'The inner shaft the wheel is fixed to. Rope winds onto it, a drill bit screws into it, or a gear train takes power off it.',
        principle:
          'The axle turns through exactly the same angle as the wheel, but its surface travels a much shorter distance. The same torque acting at a smaller radius means a much larger force along that surface.',
      },
      {
        id: 'rope',
        name: 'Rope and load',
        role: 'Where the force lands',
        description:
          'The line wound around the drum, and whatever hangs on the end of it. One full turn of the machine raises the load by one circumference of the axle.',
        principle:
          'Winding the rope converts rotation back into a straight pull. The load rises slowly and steadily, which is exactly the price paid for lifting it easily.',
      },
      {
        id: 'frame',
        name: 'Frame and bearings',
        role: 'What holds it still',
        description:
          'The posts, base and bearing surfaces that fix the center of rotation in place so the machine turns rather than tips.',
        principle:
          'The frame absorbs everything that is not rotation. Good bearings keep friction small, so almost all the effort put in reaches the load.',
      },
    ],
    applications: [
      {name: 'Winch', note: 'Handles form the wheel, the drum forms the axle. A light pull at the handles becomes a heavy pull on the rope, and one turn raises the load by one circumference of the drum.'},
      {name: 'Screwdriver and faucet', note: 'A fat handle turning a thin shaft. The wider the grip, the more torque reaches the screw or the washer.'},
      {name: 'Waterwheel', note: 'Water pushes on paddles at the rim and delivers a strong, slow drive at the central shaft.'},
      {name: 'Windmill', note: 'Wind along the sails produces a much stronger force at the wind shaft, which gearing passes on to a grindstone or pump.'},
      {name: 'Wind turbine', note: 'The same principle at modern scale, with a gearbox raising the shaft speed to suit a generator.'},
    ],
    facts: [
      ['Chapter', 'Part 1 · The mechanics of movement'],
      ['Family', 'Simple machine'],
      ['Also known as', 'Rotating lever'],
      ['Trades', 'Turn radius for force'],
    ],
  },
  {
    id: 'gears-and-belts',
    index: 4,
    part: 1,
    name: 'Gears and belts',
    category: 'The mechanics of movement',
    tagline: 'Rotation, passed along',
    blurb: 'Two wheels of different size trade speed against force.',
    summary:
      'Put two wheels of different size together and turning one turns the other, faster or slower, harder or easier. Teeth make the link certain, a belt makes it forgiving, and the ratio between the wheels is the whole story.',
    principle:
      'Teeth cannot slip past one another, so the two wheels must turn through matching arcs at their rims. The wheel with more teeth therefore turns more slowly, and in exact proportion it turns with more torque. A belt does the same job by friction, and leaves both wheels turning the same way instead of opposite ways.',
    parts: [
      {
        id: 'driver',
        name: 'Driving gear',
        role: 'Where power arrives',
        description:
          'The wheel connected to the source of motion: a pedal crank, a motor shaft, a hand. Its size is the reference every other wheel in the train is measured against.',
        principle:
          'Whatever speed and torque arrive here are what the train has to work with. Making this wheel smaller against its partner buys torque at the far end and costs speed.',
      },
      {
        id: 'driven',
        name: 'Driven gear',
        role: 'Where power leaves',
        description:
          'The wheel that carries the motion onward to a grindstone, a road wheel, a clock hand, a beater.',
        principle:
          'Give it more teeth than the driver and it turns slower, with correspondingly more torque, in exact proportion to the tooth counts. Give it fewer and the trade runs the other way: faster, and weaker.',
      },
      {
        id: 'teeth',
        name: 'Meshing teeth',
        role: 'The certain link',
        description:
          'Interlocking teeth of matching pitch. Tooth count and spacing together set the pitch diameter. Meshing gears need compatible teeth; their tooth counts set the speed ratio.',
        principle:
          'Because a tooth cannot slip past its neighbor, the two wheels stay in step turn after turn. That is what makes gears suitable for clocks, where a belt would drift.',
      },
      {
        id: 'belt',
        name: 'Belt and pulleys',
        role: 'The forgiving link',
        description:
          'A loop of rubber or leather running over two smooth wheels. A chain over toothed sprockets does the same job of spanning a distance, but engages like a gear rather than gripping by friction.',
        principle:
          'A friction belt trades certainty for tolerance: it spans a distance, absorbs shock, and slips rather than breaks under overload. Either way the loop does not cross, so both wheels turn the same way, which is the visible difference from a geared pair.',
      },
    ],
    applications: [
      {name: 'Bicycle derailleur', note: 'A chain moved between sprockets of different size, changing the ratio between the pedals and the rear wheel to suit the hill.'},
      {name: 'Clock train', note: 'Spur gears in a fixed ratio make the minute hand turn exactly twelve times for every turn of the hour hand.'},
      {name: 'Bevel gears', note: 'Teeth cut on a cone pass rotation around a corner, as in an egg whisk or a car differential.'},
      {name: 'Worm gear', note: 'A screw meshing with a toothed wheel gives an enormous speed reduction in one compact step, as in a speedometer.'},
      {name: 'Rack and pinion', note: 'A gear meshing with a straight toothed bar turns rotation into a straight line, as in car steering.'},
    ],
    facts: [
      ['Chapter', 'Part 1 · The mechanics of movement'],
      ['Family', 'Motion transmission'],
      ['Set by', 'The ratio of tooth counts'],
      ['Trades', 'Speed for torque'],
    ],
  },
  {
    id: 'cams-and-cranks',
    index: 5,
    part: 1,
    name: 'Cams and cranks',
    category: 'The mechanics of movement',
    tagline: 'Turning into to and fro',
    blurb: 'Rotation converted into a repeating push, and back again.',
    summary:
      'Most sources of power turn, and most jobs need something pushed back and forth. A cam is a shaped wheel that lifts a follower as it passes; a crank is a wheel with an off-center pin and a rod. One converts rotation into any motion you care to draw, the other into a smooth stroke that also works in reverse.',
    principle:
      'A cam gives you the freedom to shape the motion: the profile you cut is the movement you get, and it can only push, so a spring must bring the follower back. A crank gives you a fixed stroke of twice its throw, and it is the one that runs right round in either direction, so a piston can turn a shaft as readily as a shaft can drive a piston.',
    parts: [
      {
        id: 'cam',
        name: 'The cam',
        role: 'A wheel with a shape',
        description:
          'A disc mounted off-center, or cut with one or more lobes, turning on a shaft. The lobe is the instruction: its height is the lift and its width is the timing.',
        principle:
          'As the shaft turns, the radius under the follower changes, and the follower has no choice but to move with it. Change the profile and you change the motion, without changing anything else.',
      },
      {
        id: 'follower',
        name: 'The follower',
        role: 'What the cam moves',
        description:
          'The rod, lever or valve stem held against the cam. In a car engine it is the valve that lets fuel in and exhaust out.',
        principle:
          'The cam can only push the follower away. A spring, or the follower\u2019s own weight, is what keeps the two in contact so the return half of the motion happens at all.',
      },
      {
        id: 'crank',
        name: 'The crank',
        role: 'A wheel with a pin',
        description:
          'A wheel or shaft carrying a pin set away from the center. The distance from the center to the pin is called the throw.',
        principle:
          'The pin sweeps a circle, and its travel across the machine is the stroke: twice the throw, every turn, whatever else changes.',
      },
      {
        id: 'rod',
        name: 'Connecting rod',
        role: 'The link that swings',
        description:
          'A rigid link hinged at the crank pin and at whatever it drives: a piston, a wiper blade, a sprinkler arm.',
        principle:
          'The rod turns the pin\u2019s circle into a straight stroke, swinging from side to side to absorb the difference. A longer rod swings less and delivers a smoother, more even motion.',
      },
    ],
    applications: [
      {name: 'Engine crankshaft', note: 'Pistons pushed down by burning fuel turn cranks, and the same cranks push the pistons back up. A crank running in both directions is what makes an engine possible.'},
      {name: 'Engine camshaft', note: 'One cam per valve, cut to open it at the right moment and let a spring shut it again.'},
      {name: 'Windshield wipers', note: 'A motor, reduced by a worm gear, turns a crank that sweeps the blades to and fro.'},
      {name: 'Lawn sprinkler', note: 'Water drives a turbine, worm gears cut the speed right down, and a crank swings the spray arm slowly across the grass.'},
      {name: 'Electric trimmer', note: 'A crank drives two serrated blades back and forth across each other, so the gaps open and close as paired wedges.'},
    ],
    facts: [
      ['Chapter', 'Part 1 · The mechanics of movement'],
      ['Family', 'Motion conversion'],
      ['Cam gives', 'Any profile you cut'],
      ['Crank gives', 'A stroke of twice the throw'],
    ],
  },
  {
    id: 'pulleys',
    index: 6,
    part: 1,
    name: 'Pulleys',
    category: 'The mechanics of movement',
    tagline: 'Share a load between strands',
    blurb: 'More supporting rope strands share the weight, but you must pull more rope.',
    summary:
      'A single wheel on a hook lets you pull down to lift up, which is worth having and nothing more. Hang a second wheel on the load itself and the rope now runs up and down twice, so two strands share the weight and you pull half as hard over twice the distance. Keep threading and the sharing keeps going.',
    principle:
      'Count the strands of rope running up out of the moving block. That number is the advantage, because the load’s weight is divided equally between them and your hand only has to match one strand’s share. The rope has to come from somewhere: raising the load by a meter shortens every one of those strands by a meter, so you haul in that many meters. Wheels alone buy you nothing; only strands under the moving block count.',
    parts: [
      {
        id: 'fixed',
        name: 'Fixed block',
        role: 'The wheels that stay put',
        description:
          'One or more grooved wheels, called sheaves, hung from the beam. They turn as the rope passes, but they never travel.',
        principle:
          'A fixed sheave changes the direction of a pull without changing its size, which is why the first wheel on its own is worth one and nothing more. Pulling down instead of up lets you add your own weight to the effort, and that is a real gain, just not a mechanical one.',
      },
      {
        id: 'moving',
        name: 'Moving block',
        role: 'The wheels that ride with the load',
        description:
          'Sheaves hung from the load itself, so they rise as it rises. Every sheave here adds two strands to the count.',
        principle:
          'The weight of the load is carried by all the strands leaving this block at once, and because it is one continuous rope under one tension, each strand carries the same share. Your hand supplies one share.',
      },
      {
        id: 'rope',
        name: 'The rope',
        role: 'One tension throughout',
        description:
          'A single line threaded between the two blocks and finished off at an anchor point on one of them.',
        principle:
          'Because the sheaves turn freely, the tension is the same everywhere along the rope. That single fact is what makes the load split evenly between the strands, and it is also what makes real pulleys fall short: a stiff rope and tight bearings lose a little tension at every wheel.',
      },
      {
        id: 'load',
        name: 'The load',
        role: 'What comes up',
        description:
          'The weight hung from the moving block, or straight from the rope end when there is only one strand.',
        principle:
          'However the rope is threaded, raising the load a given height stores the same energy in it. All the threading changes is how gently you have to supply that energy, and how much rope has to pass through your hands to do it.',
      },
    ],
    applications: [
      {name: 'Block and tackle', note: 'Two blocks of several sheaves each, the oldest way to let one person lift a boat, an engine or a beam.'},
      {name: 'Tower crane', note: 'The hook block hangs on several strands, so a modest winch on the jib lifts a great deal, slowly.'},
      {name: 'Elevator', note: 'Cables over a drive wheel with a counterweight on the other end, so the motor lifts only the difference between the car and the counterweight.'},
      {name: 'Chain hoist', note: 'Two sprockets of slightly different size on one shaft, with the chain looped through a moving sprocket, so a light pull raises a heavy engine a few millimeters at a time.'},
      {name: 'Sailing rigs', note: 'A tackle on the mainsheet lets one arm hold a sail full of wind.'},
    ],
    facts: [
      ['Chapter', 'Part 1 · The mechanics of movement'],
      ['Family', 'Force multiplier'],
      ['Set by', 'The number of supporting strands'],
      ['Trades', 'Rope length for pull'],
    ],
  },
  {
    id: 'screws',
    index: 7,
    part: 1,
    name: 'Screws',
    category: 'The mechanics of movement',
    tagline: 'A ramp wrapped round a shaft',
    blurb: 'One turn of the head carries the thread forward by its lead.',
    summary:
      'Cut a long thin triangle out of paper and roll it round a pencil: the sloping edge becomes a thread. A screw is that ramp made solid, and everything true of a ramp is true of it. Your hand travels the whole way round a circle while the thread creeps forward by one small step.',
    principle:
      'In one turn your hand covers the circumference of the circle it describes, and the thread advances by its lead, the distance from one turn of the thread to the next. The ratio between those two distances is the advantage, and it is huge: a wrench on an ordinary bolt is worth a factor of several hundred. It is also the one simple machine whose ideal figure you should not trust, because friction in the thread swallows most of the gain. That same friction is what stops the load from spinning the screw back out, which is why a screw holds and a ramp does not.',
    legend: 'none',
    parts: [
      {
        id: 'thread',
        name: 'The thread',
        role: 'The ramp itself',
        description:
          'A helical ridge cut into the shaft. The distance between one crest and the next is the pitch; the distance the thread advances in one turn is the lead, which equals the pitch unless several threads are started side by side.',
        principle:
          'Unroll one turn of the thread and you get a right triangle: the circumference along the base, the lead up the side. The angle between them is the same slope angle a ramp has, and a finer thread is a gentler ramp.',
      },
      {
        id: 'nut',
        name: 'The follower',
        role: 'What travels',
        description:
          'The nut, the jack platform or the workpiece the thread pushes. It cannot turn, so the only way it can go is along.',
        principle:
          'The follower is held against turning, so the thread passing under it can do nothing but drive it forward one lead per turn. Take away that restraint and the thread simply spins inside it and nothing moves.',
      },
      {
        id: 'lever',
        name: 'The turning arm',
        role: 'Where the effort goes in',
        description:
          'A wrench, a handle, a screwdriver grip or the head of the bolt. Its radius sets the circle your hand travels.',
        principle:
          'Doubling the length of the wrench doubles the circle and doubles the advantage, which is why the arm and the thread work as one machine and why a long bar on a short bolt is such an effective, and such a destructive, combination.',
      },
      {
        id: 'unwrapped',
        name: 'The unrolled ramp',
        role: 'The same thread, laid flat',
        description:
          'A triangle whose base is the circumference of the shaft and whose height is one lead, standing beside the screw for comparison.',
        principle:
          'Wrap this triangle round the shaft and its sloping edge lies exactly along the thread. The screw hides a very long, very gentle ramp inside a very short cylinder, which is the whole trick.',
      },
    ],
    applications: [
      {name: 'Nuts and bolts', note: 'Tightening winds the thread against itself until the bolt is stretched, and its own springiness holds the joint together.'},
      {name: 'Micrometer', note: 'A fine thread turns a barely visible movement into a large sweep of the scale, so thousandths of a millimeter can be read off.'},
      {name: 'Drill bit', note: 'The flutes are a thread that carries chips out of the hole while the cutting edges work at the bottom.'},
      {name: 'Auger', note: 'A large open thread that moves grain, soil or minced meat along a tube instead of pulling itself into one.'},
      {name: 'Screw jack', note: 'A car’s scissor jack turns a hand crank into enough force to lift a corner of the car, and stays where it is left.'},
    ],
    facts: [
      ['Chapter', 'Part 1 · The mechanics of movement'],
      ['Family', 'Force multiplier'],
      ['Set by', 'Turning circle divided by lead'],
      ['Trades', 'Many turns for a short, strong push'],
    ],
  },
  {
    id: 'rotating-wheels',
    index: 8,
    part: 1,
    name: 'Rotating wheels',
    category: 'The mechanics of movement',
    tagline: 'Spin as a store and a stabilizer',
    blurb: 'A spinning wheel keeps its speed, and keeps its axis pointing.',
    summary:
      'Anything that spins fast enough behaves differently from the same object standing still. It resists being slowed, so it can carry a machine through the gaps between power strokes. It resists being turned aside, so it can hold a direction for a compass or an instrument. Both come from the same reluctance to change.',
    principle:
      'Every scrap of the rim would travel in a straight line if it could. Holding it on its circle takes a force pulling inward, supplied by the material of the wheel, and that force grows with the square of the spin rate. The same stubbornness appears twice more. Energy stored in the spin also grows with the square of the rate, so a heavy rim turning quickly is a useful reservoir. And a torque that tries to tip the axis does not tip it: it swings the axis sideways instead, slowly, and the faster the spin the more slowly it swings.',
    legend: {delivered: 'the pull that holds the rim on its circle'},
    parts: [
      {
        id: 'rotor',
        name: 'The wheel',
        role: 'What spins',
        description:
          'A disc or a rim on a shaft. Mass placed far out at the rim counts for far more than mass near the middle.',
        principle:
          'A wheel resists a change of spin in proportion to how much mass it has and how far out that mass sits, measured as the square of the distance. Doubling the radius of the rim quadruples its contribution, which is why flywheels are heavy at the edge and light in the middle.',
      },
      {
        id: 'rim',
        name: 'Rim mass',
        role: 'What is held on course',
        description:
          'A weight riding at the outside of the wheel, standing for all the material out there.',
        principle:
          'The arrow on it points inward, toward the center, because that is the direction of the force actually acting. Viewed from the stationary frame, circular motion requires a net inward force; no extra outward force is needed. A rotating observer can describe an apparent centrifugal force. Cut the rim and the piece flies off along the tangent, not along the radius, which is exactly what a broken grinding wheel does.',
      },
      {
        id: 'shaft',
        name: 'The shaft',
        role: 'The axis of spin',
        description:
          'The axle the wheel turns about, and the line that a gyroscope tries to hold fixed.',
        principle:
          'Spin gives the shaft a direction it is reluctant to give up. Push on it and the axis moves at right angles to your push, which is the behavior that looks like magic and is only a torque changing a direction rather than a speed.',
      },
      {
        id: 'mount',
        name: 'The mounting',
        role: 'How it is held',
        description:
          'Two bearings for a flywheel, so the axis is fixed; one pivot for a gyroscope, so the axis is free to wander.',
        principle:
          'The mounting decides which behavior you see. Hold both ends and the wheel is a store of energy. Hold one end and gravity applies a steady twist that the spin turns into a slow, level circling of the axis.',
      },
    ],
    applications: [
      {name: 'Engine flywheel', note: 'A car engine fires on one cylinder at a time; the flywheel carries the crankshaft through the rest of the cycle and smooths what would otherwise be a series of jolts.'},
      {name: 'Potter’s wheel', note: 'A heavy wheel kicked up to speed keeps turning steadily while both hands are busy with the clay.'},
      {name: 'Gyrocompass', note: 'A spinning rotor, acted on by gravity and Earth’s rotation and steadied by damping, settles toward true north. Local magnets do not set its direction.'},
      {name: 'Artificial horizon', note: 'A gyroscope in gimbals stays level, so the instrument face can show the pilot how the aircraft is tilted relative to it.'},
      {name: 'Centrifuge', note: 'Spinning a tube makes the denser contents settle outward far faster than gravity alone would move them.'},
    ],
    facts: [
      ['Chapter', 'Part 1 · The mechanics of movement'],
      ['Family', 'Energy store and stabilizer'],
      ['Set by', 'Spin rate and where the mass sits'],
      ['Trades', 'Steadiness for the effort of spinning up'],
    ],
  },
  {
    id: 'springs',
    index: 9,
    part: 1,
    name: 'Springs',
    category: 'The mechanics of movement',
    tagline: 'Force put away for later',
    blurb: 'Push it out of shape and it pushes back in proportion.',
    summary:
      'A spring is a piece of material bent, coiled or twisted so that it can be moved a long way while the metal itself is barely strained. Within that range it pushes back in exact proportion to how far you have moved it, which makes it equally good at measuring a force, returning a mechanism and storing energy for later.',
    principle:
      'Move a spring away from its resting shape and the force it returns grows in step with the distance, so a spring twice as far compressed pushes twice as hard. Energy is not force but the sum of force over distance, so it grows with the square: twice the squeeze holds four times the energy. Push a spring beyond its working range and it takes a permanent set, the proportion is lost and the spring is finished.',
    legend: 'none',
    parts: [
      {
        id: 'spring',
        name: 'The spring',
        role: 'The elastic element',
        description:
          'A coil, a leaf or a bar, according to the job. A coil is a long wire twisted along its length; a leaf is a beam bent across it; a torsion bar is twisted end to end.',
        principle:
          'All three obey the same rule and differ only in how much room they need and how they are anchored. Stiffness comes from the material and the shape: a longer coil, a thinner leaf or a slimmer bar is softer.',
      },
      {
        id: 'load',
        name: 'The load',
        role: 'What deflects it',
        description:
          'The weight, hand or wheel pressing on the spring.',
        principle:
          'The spring settles at the point where its own push exactly equals the load. That is why a spring can weigh things: the position it settles at is a direct reading of the force applied.',
      },
      {
        id: 'gauge',
        name: 'The scale',
        role: 'Deflection read off',
        description:
          'A marked track alongside the spring, the same idea as the face of a kitchen scale or a luggage balance.',
        principle:
          'Because force and deflection stay in proportion, the marks can be evenly spaced. A scale with uneven marks is a sign that something in the mechanism is not a simple spring.',
      },
      {
        id: 'seat',
        name: 'The anchor',
        role: 'What it pushes against',
        description:
          'The attachment to a frame, a chassis or a mounting bracket. It stays still on this bench, but need not stay still in every machine.',
        principle:
          'A spring stores energy when its ends move closer together or farther apart from their resting separation. Both ends can be moving. The anchor supplies the opposing force here; on a car, the wheel and body mountings both move as the spring cushions a bump.',
      },
    ],
    applications: [
      {name: 'Vehicle suspension', note: 'Coils, leaves or torsion bars let the wheels follow the road while the body stays roughly level. A damper alongside turns the spring’s stored energy into heat, or the car would bounce for a mile.'},
      {name: 'Spring balance', note: 'A calibrated coil turns a weight into a length that can be read off directly.'},
      {name: 'Stapler', note: 'One spring pushes the staples forward under the head, another returns the arm after the blow.'},
      {name: 'Clockwork', note: 'A flat spring wound into a barrel releases its energy slowly through a train of gears.'},
      {name: 'Valve springs', note: 'A cam can only push a valve open; the spring is what shuts it again, and it has to do so faster than the engine turns.'},
    ],
    facts: [
      ['Chapter', 'Part 1 · The mechanics of movement'],
      ['Family', 'Energy store'],
      ['Set by', 'Stiffness and deflection'],
      ['Trades', 'Deflection for force, both ways'],
    ],
  },
  {
    id: 'friction',
    index: 10,
    part: 1,
    name: 'Friction',
    category: 'The mechanics of movement',
    tagline: 'The tax and the grip',
    blurb: 'The same resistance that wastes effort is what lets anything hold.',
    summary:
      'Every ideal figure in this part of the study assumes friction away. Real machines cannot. Two surfaces pressed together resist sliding. When they slide, some energy becomes heat. When they grip without sliding, friction can hold a knot or help a tire push against the road without that same sliding loss.',
    principle:
      'The resistance is proportional to how hard the surfaces are pressed together, and to a good approximation it does not depend on how much of them is touching: a wide block and a narrow one of the same weight need the same pull. The constant of proportion belongs to the pair of materials, not to either alone. The sliding coefficient sets the pull while moving. A different, usually larger static coefficient sets the angle at which a resting block starts to slip: the tangent of that angle equals the static coefficient. Sliding friction changes mechanical energy into heat. Static friction is the grip before sliding: it adjusts to the force needed, up to a limit, and does not require continual heating. This example uses a sliding coefficient 80% of its static coefficient; real pairs of surfaces have their own values.',
    legend: 'none',
    parts: [
      {
        id: 'block',
        name: 'The block',
        role: 'What resists sliding',
        description:
          'A weight resting on the surface. Its own weight sets how hard the two are pressed together.',
        principle:
          'On level ground, the pull needed to start it moving is its weight multiplied by the static coefficient. Once it is moving the pull needed usually drops a little, which is why something stuck lets go with a jerk.',
      },
      {
        id: 'surface',
        name: 'The surface',
        role: 'The other half of the pair',
        description:
          'The plane the block rests on, tilted here so the slip angle can be read directly.',
        principle:
          'Raise the surface and gravity’s pull along it grows while its press into the surface falls. At the angle whose tangent equals the coefficient the two cross over, and the block goes. Rubber on dry road slips near forty degrees; steel on ice barely past five.',
      },
      {
        id: 'brake',
        name: 'Brake disc and pads',
        role: 'Friction put to work',
        description:
          'A disc turning with the wheel and two pads squeezed against it.',
        principle:
          'The pads make no attempt to be slippery. Clamping force multiplied by the coefficient, applied at the radius of the pads, is the braking torque, and the car’s energy of motion leaves as heat in the disc. That is why hard braking makes discs glow and why they are drilled and vented.',
      },
      {
        id: 'bearing',
        name: 'Ball bearing',
        role: 'Friction avoided',
        description:
          'Hardened balls held between an inner and an outer race.',
        principle:
          'Rolling replaces sliding. The contact patch is tiny and it never scrubs, so the resistance drops by a factor of tens or hundreds. Oil does the same job differently, by keeping a film of liquid between surfaces that would otherwise touch at all.',
      },
    ],
    applications: [
      {name: 'Tires', note: 'Tread patterns clear water so the rubber can reach the road; the grip that results is the only thing steering, driving or stopping a car.'},
      {name: 'Disc brakes', note: 'A hydraulic circuit multiplies pedal force into clamping force, and the whole car’s motion becomes heat.'},
      {name: 'Clutch', note: 'A friction plate squeezed between engine and gearbox lets the two meet at different speeds and come together gradually.'},
      {name: 'Parachute', note: 'Friction with the air, spread over a large canopy, is what limits the fall to a survivable speed.'},
      {name: 'Bearings and oil', note: 'Every rotating machine spends its design effort on keeping the unavoidable friction small and putting it somewhere it can be cooled.'},
    ],
    facts: [
      ['Chapter', 'Part 1 · The mechanics of movement'],
      ['Family', 'Resistance'],
      ['Set by', 'The pair of materials and the pressing force'],
      ['Trades', 'Effort for grip'],
    ],
  },
];

import {RAFT_DEFAULTS} from './raft-physics.js';
const trial=(title,instruction,observe,values={})=>({title,instruction,observe,reset:true,values:{...RAFT_DEFAULTS,...values}});

export const raftLesson={
  simple:'How much cargo can six timbers carry? Load the raft, compare weight with buoyancy, and find out when the deck goes under.',
  overview:'A raft pushes water aside. Pressure from that water gives an upward force, called buoyancy. Adding cargo first pulls the raft down; more timber enters the water, so buoyancy grows. The raft can settle when upward and downward forces balance. Once all the timber is underwater, the timber cannot displace any more water. This model also counts the volume of the steel cargo when it gets wet, so a submerged deck does not always mean the whole assembly must sink.',
  steps:[
    {title:'Build the raft',body:'Six squared timbers, each 2 m × 0.20 m × 0.20 m, provide 0.480 m³ of solid volume. Two rope bindings hold them together. With timber density 500 kg/m³, the wood weighs 240 kg. Gaps between timbers fill with water and add no displacement.'},
    {title:'Place the cargo',body:'The cargo control sets the total mass of four equal steel blocks. Each block is drawn at its calculated size using a fixed density of 7,850 kg/m³. A fresh experiment begins with the raft at its unloaded floating depth and the selected cargo placed on it.'},
    {title:'Let it settle',body:'Press Play or advance half a second. Gravity initially exceeds buoyancy when cargo is added. The raft moves down and its immersed volume grows. Water resistance opposes motion. At rest, water resistance is zero and buoyancy alone supports a floating raft.'},
    {title:'Watch the deck reach the water',body:'At 240 kg of cargo in fresh water, the default wood is fully immersed. The timber tops meet the surface. A lighter load leaves positive freeboard, the height of the deck above the water.'},
    {title:'Count wet cargo too',body:'A small extra load can still reach equilibrium after some cargo enters the water. Steel displaces water too, even though its own density is much greater than water. With 260 kg of cargo, the deck is underwater but the combined raft and blocks can still float.'},
    {title:'Distinguish sinking from grounding',body:'With 320 kg of cargo, even the fully submerged timber and blocks cannot displace enough water. The raft sinks to the reference bottom, 0.95 m deep. A gray arrow then shows the bottom supporting the weight that buoyancy cannot support.'},
    {title:'Unload and recover',body:'After the raft grounds, choose Unload the raft and press Play. The wood still displaces water but the heavy blocks are gone. Buoyancy lifts the raft away from the bottom; it returns to its unloaded floating depth.'},
  ],
  parts:[
    {name:'Six buoyant timbers',role:'Provide the solid displaced volume and carry their own weight.'},
    {name:'Rope bindings',role:'Keep the timbers together; their small mass and volume are omitted.'},
    {name:'Steel cargo',role:'Adds load and, when immersed, adds displaced volume.'},
    {name:'Water and depth reference',role:'Shows a fixed water surface and a bottom 0.95 m below it.'},
    {name:'Force comparison',role:'Orange weight points down; blue buoyancy, gray bottom support, and green resistance show the other vertical forces on one scale.'},
  ],
  tryIt:[
    trial('Carry 100 kg','Play, then compare the two main force arrows.','The raft settles with about 5.8 cm of deck above fresh water. Buoyancy supports 340 kg of wood and cargo.'),
    trial('Double the cargo','Play with 200 kg, keeping the same wood and water.','Displacement rises from 340 L to 440 L. Only about 1.7 cm of freeboard remains.',{cargo:200}),
    trial('Reach the timber limit','Play with 240 kg of cargo.','All 480 L of timber volume is immersed. The deck settles at the water surface.',{cargo:240}),
    trial('Float with a wet deck','Play with 260 kg of cargo.','The deck goes under, but immersed steel adds enough displacement for the combined assembly to float. The total displaced water approaches 500 L.',{cargo:260}),
    trial('Sink, then unload','Play with 320 kg. Once it rests on the bottom, choose Unload the raft and play again.','Buoyancy remains present on the bottom. Removing cargo eliminates the bottom reaction and the raft rises to its unloaded depth.',{cargo:320}),
    trial('Use denser timber','Play with wood density 800 kg/m³ and 100 kg of cargo.','The wood itself weighs 384 kg. The dry-deck cargo limit falls to 96 kg; this cargo wets the deck.',{wood:800}),
    trial('Use salt water','Play with 240 kg of cargo in the representative salt water.','The same weight needs less displaced volume. The deck stays about 0.5 cm above water instead of being awash.',{cargo:240,water:1025}),
    trial('Float empty','Play with no cargo.','Half of the default timber depth is immersed. The wood displaces 240 L and the deck stays 10 cm above fresh water.',{cargo:0}),
  ],
  deeper:[
    {title:'Displacement is volume, buoyancy is force',body:'If V is the submerged solid volume and ρ is water density, buoyancy is ρgV. The matching weight is mg. A freely floating assembly at rest therefore displaces m/ρ of water. Here g = 9.81 m/s². A raft that sinks still receives buoyancy; the force is insufficient to hold it up.'},
    {title:'Two different cargo limits',body:'The dry-deck limit is (water density − wood density) × timber volume. It is 240 kg for the default wood in fresh water. Fully immersed steel adds cargo mass / steel density of displaced volume. Including it raises the largest cargo mass that can be supported when everything is submerged to about 275.0 kg. Between those limits, the raft can float with a wet deck. These ideal thresholds are not safe working loads.'},
    {title:'Why salt water changes the depth',body:'At the same mass, denser water supplies the same buoyancy from less displacement. The selected salt-water value is 1,025 kg/m³; actual density changes with salinity and temperature. Changing the water setting does not change the weight of the raft.'},
    {title:'Why the motion stops',body:'The motion follows mass × vertical acceleration = buoyancy − weight + water resistance + bottom support. Resistance is −1,600v − 800v|v| newtons for vertical speed v in m/s. These illustrative damping coefficients make settling easy to observe; they are not measured drag data. Floor contact removes downward speed without a bounce. An upward force can lift the raft off again.'},
    {title:'Reading the arrows',body:'The arrows form a force diagram beside the raft. Every 6,000 N occupies one meter in the scene. At floating equilibrium, orange and blue lengths match. During motion, the green arrow opposes velocity. At rest on the bottom, blue plus gray matches orange. Their positions do not represent centers of pressure or torque arms.'},
  ],
  misconception:'A submerged deck is not identical to loss of all flotation. Cargo that enters the water adds displacement. Conversely, a raft resting on the bottom is not floating merely because its motion has stopped.',
  limits:'A level, rigid raft with one vertical degree of freedom in still water. Exact rectangular timber and cube volumes are used. Timber density is uniform; waterlogging, waves, water-level rise, currents, roll, pitch, capsizing and bending are omitted. Cargo stays fastened and evenly distributed. Rope mass and volume are neglected. Drag coefficients are illustrative; added fluid inertia is omitted. The reference bottom is 0.95 m deep with an inelastic contact. The twelve-second observation may still show slow motion near neutral buoyancy; the separate predicted resting state describes unchanged settings. Controls preserve current position after motion starts. New presets and Reset experiment start at the unloaded depth. This is a physics lesson, not a vessel design or load-rating tool.',
  sources:[{title:'OpenStax University Physics: Archimedes’ principle and buoyancy',url:'https://openstax.org/books/university-physics-volume-1/pages/14-4-archimedes-principle-and-buoyancy'}],
  quiz:{question:'A loaded raft is resting on the bottom. What supports its weight?',options:['Buoyancy plus the upward force from the bottom.','Only the bottom; submerged objects lose all buoyancy.','Only buoyancy, because the raft has stopped moving.'],answer:0,explanation:'Displaced water still supplies buoyancy. The bottom supplies the remaining upward force needed for balance.'},
};

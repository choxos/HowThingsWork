import {dcMotorLesson} from './dc-motor-lesson.js';

export const commutatorLesson={
 simple:'How can a rotating wire keep pushing the same way? Watch two copper halves exchange brushes and reverse the coil current.',
 overview:'The split-ring commutator is a rotating electrical switch attached to the motor shaft. Each copper segment stays connected to its own winding end. Two stationary brushes touch opposite sides of the ring. As the shaft turns, the brushes exchange segments, reversing conventional current in the winding every half-turn. This switching lets the magnetic torque keep driving the fan in the selected direction. The surrounding motor remains visible because the commutator depends on its winding, supply, magnetic field and moving shaft.',
 steps:[
  {title:'Separate the rotating and fixed parts',body:'Inspect the ring from the back. Copper segment A is the orange half; B is the gold half. Both rotate with the shaft. The two dark brush tips and their cream holders stay fixed.'},
  {title:'Read the current connection',body:'Advance one step. Brush pair names the segment touching each fixed side of the ring. The +x and −x names identify positions, even if you reverse the supply. Coil current is conventional current; its sign refers to one marked winding side.'},
  {title:'Exchange the copper halves',body:'Continue stepping through a half-turn. Each brush reaches an insulating gap and then the other copper segment. The winding ends never disconnect from their own segments; it is the brush-to-segment pairing that changes.'},
  {title:'Compare current and torque',body:'Across the exchange, winding current changes sign. The coil has also turned over, so the reversed force directions can keep driving torque in the same rotational direction. Run the action to see this repeated switching drive the shaft-mounted fan.'},
  {title:'Test a gap without stored motion',body:'Start at the dead center. Both brushes meet insulation and the resting rotor cannot start itself. The explicit small push adds motion; inertia can then carry it into conducting contact.'},
  {title:'Keep motion separate from power',body:'After a powered run, disconnect and coast. The rotating halves still exchange brush positions for a while, but current stays zero because the supply circuit is open. The fan eventually rests.'},
 ],
 parts:[
  {name:'Copper segment A and copper segment B',role:'Stay attached to separate winding ends and rotate together with the shaft.'},
  {name:'Insulating gaps and sleeve',role:'Separate the copper halves from one another and from the metal shaft.'},
  {name:'Two fixed carbon brushes',role:'Supply opposite sides of the ring without rotating the external wires.'},
  {name:'Winding, shaft and magnetic poles',role:'Provide the current path, rotation and magnetic forces that give the switch a purpose.'},
  {name:'Fan and supported ribbon',role:'Make the parent motor’s useful output visible while commutation repeats.'},
 ],
 tryIt:[
  {title:'Exchange brushes, keep driving',instruction:'Advance several small steps while comparing Brush pair with Coil current. Then run the action.',observe:'Each fixed brush alternates between A and B. Coil current reverses across the gaps while driving torque keeps the fan turning in the normal direction.',reset:true,part:'commutator',view:'back',isolate:false,values:{operation:0,voltage:3,polarity:1,field:.6,load:1,startAngle:45}},
  {title:'Rest in the insulating gaps',instruction:'Run from the dead center. Then choose Give the rotor a small push and run again.',observe:'Insulation leaves the circuit open, so the resting shaft cannot move itself. The push supplies motion that can carry the brushes into copper contact.',reset:true,part:'commutator',view:'back',isolate:false,values:{operation:0,voltage:3,polarity:1,field:.6,load:1,startAngle:0}},
  {title:'Reverse the supply, retain the switching',instruction:'Step through the first contacts with reversed supply polarity, then run.',observe:'The same fixed brushes still exchange A and B, but the supply reversal changes the driving direction. The fan turns the other way.',reset:true,part:'commutator',view:'back',isolate:false,values:{operation:0,voltage:3,polarity:-1,field:.6,load:1,startAngle:45}},
  {title:'Switch contacts without electrical drive',instruction:'First run this powered preset. Then choose Disconnect and coast and run or step again.',observe:'Brush pair continues changing while the shaft coasts, but Coil current and Driving torque stay zero. Switching alone cannot replace the source’s energy.',reset:true,part:'commutator',view:'back',isolate:false,values:{operation:0,voltage:3,polarity:1,field:.6,load:1,startAngle:45}},
 ],
 deeper:[
  {title:'A connection swap, not a reversing battery',body:'During a normal powered run the supply polarity stays fixed. The commutator reverses the winding’s connection to that supply. Its copper halves remain mechanically and electrically tied to their own winding ends throughout the rotation.'},
  {title:'Why the gaps matter',body:'The 1° brush faces are narrower than the 8° insulating gaps. They therefore cannot bridge both copper halves. During the gap interval, the idealized winding current is zero. A moving rotor can coast across; one resting there has neither current-driven torque nor stored motion.'},
  {title:'Geometry determines the sign',body:'At zero angle A is above the shaft and B below it. When sin θ is positive, the +x brush meets B and the −x brush meets A; the pairing reverses when sin θ is negative. Reversing supply polarity changes current direction without changing this geometrical pairing.'},
 ],
 misconception:'The commutator does not push the rotor through a gap or supply energy. It exchanges electrical connections; the source provides energy and an already moving rotor carries its own inertia.',
 limits:dcMotorLesson.limits,
 sources:dcMotorLesson.sources,
 quiz:{question:'What changes when a brush passes from one copper half to the other?',options:['Which winding end is connected to that fixed brush.','Which copper half is permanently attached to each winding end.','The permanent magnets exchange their north and south poles.'],answer:0,explanation:'Each winding end stays attached to its own copper half. Rotation changes which half touches the fixed brush, reversing the winding’s connection to the supply.'},
};

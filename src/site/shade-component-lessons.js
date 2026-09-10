import {dailyLifeLessons} from './daily-life-lessons.js';

export const shadeComponentLessons={
 'Window-shade pawls and locking disk':{
  simple:'Which part stays still while the shade turns? Watch two hinged catches travel around a fixed ratchet, then compare a gentle stop with a brisk release.',
  overview:'The blue locking disk is attached to the roller. It carries the two pawl pivots around the gold central ratchet, which is fixed to the supported rod. Each pawl can also swing about its own pivot. In a slow stop, an upper pawl settles against a steep face and prevents spring-driven reverse rotation. A short downward tug moves it off that face. In the guided brisk return, both pawls remain clear while the spring raises the shade.',
  steps:[
   {title:'Separate the two kinds of motion',body:'The end view opens with this assembly isolated. The gold ratchet stays still. The blue disk and black pivots go around it; the thin clay-colored pawls can swing relative to those pivots.'},
   {title:'Pass the tooth ramps',body:'Advance Lower and gently hold one step at a time. The active upper pawl follows the ratchet outline without passing through the solid tooth. The lower pawl is shown clear.'},
   {title:'Seat against a steep face',body:'Run the rest of the lowering action. The slight return ends at a holding position. The result view shows the shade staying down. Select Pawls and fixed ratchet again to inspect the contact.'},
   {title:'Back away before returning',body:'Choose Tug and release with Gentle: catch again. The downward tug moves the catch off the stop, but the guided slow return lets it catch again.'},
   {title:'Keep both pawls clear',body:'Repeat with Brisk: rewind. In the isolated end view both catches clear the hub during return; at completion the whole window is uncovered.'},
  ],
  parts:[
   {name:'Stationary four-stop ratchet',role:'Its steep faces provide fixed barriers to reverse motion.'},
   {name:'Rotating locking disk',role:'Connects the roller to the two moving pawl pivots.'},
   {name:'Pawl pivots',role:'Travel around the central axis while allowing each pawl to swing.'},
   {name:'Hooked pawl tips',role:'Pass tooth ramps and meet stopping faces without entering the solid hub.'},
  ],
  tryIt:[
   {title:'Track a pivot and its pawl',instruction:'Advance the lowering action several steps. Compare the stationary gold hub, moving black pivot, and swinging clay pawl. Then run to the held result.',observe:'Going around the hub and swinging about a pivot are different motions. The disk turns while the hub stays fixed, then a pawl catches and the shade stays down.',reset:true,part:'locking',view:'side',isolate:true,values:{operation:0,coverage:.6,release:0}},
   {title:'A gentle return seats again',instruction:'Run to lower and hold the shade. Choose Tug and release, keep Gentle: catch again, and return to this assembly using Explore the parts. Run again.',observe:'The catch backs off during the tug and seats again on the slow return. The shade remains at a holding position.',reset:true,part:'locking',view:'side',isolate:true,values:{operation:0,coverage:.75,release:0}},
   {title:'Clear the hub for rewind',instruction:'Run to lower the shade, then choose Tug and release with Brisk: rewind. Select this assembly again and run the release.',observe:'Both pawls are clear of the fixed ratchet during rewind. With no engaged catch blocking the roller, the spring raises the shade and uncovers the window.',reset:true,part:'locking',view:'side',isolate:true,values:{operation:0,coverage:.75,release:1}},
  ],
  deeper:[
   {title:'A fixed hub can be a ratchet',body:'A ratchet does not require the toothed member to rotate. Here the toothed hub stays fixed and the pawls travel around it. Relative motion and contact still impose the one-way holding constraint.'},
   {title:'Two pivots do not mean two catches at once',body:'The two pawls are opposed around the disk. At a slow stop, gravity favors engagement of an upper pawl. The other need not be seated for the shade to hold.'},
   {title:'A visible contact, not a force rating',body:'The stopping pose places the active pawl tip against a fixed tooth face. This shows the blocking geometry. The model does not calculate contact force, tooth strength, wear, or a safe shade load.'},
  ],
  misconception:'The central ratchet is not the rotating wheel in this mechanism. The roller carries the disk and pawls around a fixed hub.',
  limits:dailyLifeLessons['Window shade'].limits,
  sources:dailyLifeLessons['Window shade'].sources,
  quiz:{question:'What blocks the spring from rewinding a gently released shade?',options:['A pawl on the rotating disk seats against a fixed ratchet face.','The fixed rod starts turning with the spring.','Both pawls permanently join the hub.'],answer:0,explanation:'The engaged pawl and fixed tooth face block relative reverse motion. Clearing the pawl removes that constraint.'},
 },
 'Window-shade winding spring':{
  simple:'Where does the shade get the energy to roll back up? Follow the spring from its fixed end to its rotating end, wind it by lowering the shade, then release the catch.',
  overview:'The copper-colored wire runs around the central rod. Its left end is secured to the stationary rod; its right end turns with the roller. Pulling the fabric down changes the relative angle of those ends. The spring winds more tightly. A pawl holds the roller after the pull. Once the catch clears, the spring can return the roller and lift the fabric.',
  steps:[
   {title:'Find the two anchors',body:'The black collar at the left belongs to the fixed rod. The gold bar at the right belongs to the roller. Follow the continuous copper wire between them. Keep Look inside on to see through the tube.'},
   {title:'Wind by doing work',body:'Run Lower and gently hold. The right anchor turns while the left stays still. The coil diameter decreases and the spaced turns become closer together. The wire does not grow to make the extra winding.'},
   {title:'Hold the stored energy',body:'The completed result shows a covered window. The engaged pawl blocks reverse roller motion; it does not remove the spring winding. Reopen the spring from Explore the parts to inspect it.'},
   {title:'Return the work to the shade',body:'Choose Tug and release with Brisk: rewind. Run again. As the spring loses its added winding, the roller takes up the fabric. The completed result is an uncovered window.'},
  ],
  parts:[
   {name:'Fixed spring anchor',role:'Connects the left wire end to the supported central rod.'},
   {name:'Spaced spring coils',role:'Accommodate the changing end angle within the available axial space.'},
   {name:'Rotating spring anchor',role:'Connects the right wire end to the roller tube.'},
   {name:'Pawl and fixed stop',role:'Hold the roller against the spring until the catch is released.'},
  ],
  tryIt:[
   {title:'Wind and hold a little',instruction:'Advance several steps while looking at the spring ends, then run to completion. Use Explore the parts to revisit the spring after the window result.',observe:'One anchor stays fixed and one turns. The partly covered window stays down with added winding still in the spring.',reset:true,part:'spring',view:'front',isolate:false,values:{operation:0,coverage:.2,release:0}},
   {title:'Wind farther for full coverage',instruction:'Run the lowering action. Compare Added spring winding and Coil diameter with the first experiment.',observe:'More fabric is unrolled, the spring has more added winding and a smaller coil diameter, and the window ends fully covered.',reset:true,part:'spring',view:'front',isolate:false,values:{operation:0,coverage:1,release:0}},
   {title:'Let the winding lift the shade',instruction:'Run once to lower the shade. Choose Tug and release, keep Brisk: rewind, select the spring again, and run the return.',observe:'The spring loses its added winding while the roller lifts the fabric. At completion the diameter returns to its raised value and the window is uncovered.',reset:true,part:'spring',view:'front',isolate:false,values:{operation:0,coverage:.75,release:1}},
  ],
  deeper:[
   {title:'End angle matters',body:'Turning both ends together would rotate the spring without adding relative winding. This mechanism holds the rod end still while the roller end turns.'},
   {title:'Torsion spring, bending wire',body:'The spring exerts a torque about its axis, but the wire in a helical torsion spring primarily experiences bending stress. Winding in the intended direction reduces the body diameter.'},
   {title:'Space for winding',body:'Real designs must keep clearance from the supporting rod and neighboring coils. This example uses spaced coils over a fixed axial span, with changing diameter and pitch. Its continuous path preserves wire length, including the short end leads.'},
  ],
  misconception:'The release tug does not supply all the lifting energy. Lowering the shade previously stored energy in the spring.',
  limits:dailyLifeLessons['Window shade'].limits+' The coil has a fixed axial span and short idealized end bends. Its radius is chosen to preserve total wire length. This constrains a visual shape, not stress, buckling, spring rate, preloading, or elastic equilibrium. Zero added winding means the raised reference position, not necessarily a relaxed real spring.',
  sources:[...dailyLifeLessons['Window shade'].sources,{title:'Lee Spring: torsion-spring deformation and clearance',url:'https://www.leespring.co.uk/learn-about-torsion-springs'}],
  quiz:{question:'Why does lowering the shade wind its spring?',options:['The roller end turns relative to the fixed rod end.','Both ends turn together by the same angle.','The wire grows longer to make new coils.'],answer:0,explanation:'The supported rod holds one end still while the roller turns the other. That relative end rotation winds the spring.'},
 },
 'Window-shade roller shaft and fixed central rod':{
  simple:'Does the whole roller turn as one solid piece? Follow the fixed inner rod and the outer tube while you lower, hold and raise the shade.',
  overview:'Two members share the same horizontal axis. The hollow outer roller turns with the shade fabric, the locking disk and the gold spring anchor. The black central rod stays fixed. Its rectangular end fits the right bracket, and it holds the other spring anchor and the stationary ratchet. This separation lets the spring wind between a stationary end and a rotating end.',
  steps:[
   {title:'Follow the supported rod',body:'The lesson opens on the black central rod. Follow it rightward to its rectangular end in the bracket. That fitted shape keeps the rod from turning. The black spring collar and gold central ratchet belong to this stationary side.'},
   {title:'Find the hollow rotating member',body:'Choose Connected roller mechanism, then Rotating roller tube. Turn Look inside off briefly to see the cloth-covered outside of the roll, then on to reveal the rod and spring again. The tube surrounds the rod; they are separate parts.'},
   {title:'Compare their motion',body:'Advance Lower and gently hold. Watch the gold outer spring anchor and the tube ribs move around the axis while the black rod and its bracket stay fixed. Run to completion to see the fabric covering the window.'},
   {title:'Reverse only the roller',body:'Choose Tug and release with Brisk: rewind and run. The outer roller reverses to take up cloth. The central rod still stays fixed, providing the stationary spring connection. The completed result is an uncovered window.'},
  ],
  parts:[
   {name:'Fixed central rod and rectangular tang',role:'Keep the inner spring end and central ratchet stationary through the bracket connection.'},
   {name:'Rotating roller tube',role:'Carries the cloth around the same axis as the fixed rod.'},
   {name:'Annular rotating spring anchor',role:'Turns around the rod with a clear central opening and connects the spring to the tube.'},
   {name:'Rotating locking disk',role:'Carries the pawl pivots around the stationary ratchet.'},
  ],
  tryIt:[
   {title:'Keep one side stationary',instruction:'Advance several steps while following the fixed rod and right bracket. Then run to the held result.',observe:'The rod and bracket stay still while fabric leaves the rotating roller. The window is partly covered and the pawl holds the result.',reset:true,part:'shaft',view:'front',isolate:false,values:{operation:0,coverage:.45,release:0}},
   {title:'Look through the outer tube',instruction:'Toggle Look inside off and on, then run the lowering action. Follow the rotating tube ribs and gold spring anchor in the cutaway.',observe:'The tube rotates around a separate fixed rod. Its motion also turns the locking disk and outer spring anchor, and ends with the window fully covered.',reset:true,part:'roller',view:'front',isolate:false,values:{operation:0,coverage:1,release:0}},
   {title:'Reverse around the same rod',instruction:'Run once to lower the shade, then choose Tug and release with Brisk: rewind and run again. Revisit the fixed rod before the return if you want a closer view.',observe:'The roller reverses and takes up the fabric while the rod remains stationary. The window ends uncovered.',reset:true,part:'shaft',view:'front',isolate:false,values:{operation:0,coverage:.75,release:1}},
  ],
  deeper:[
   {title:'An axis is not necessarily a rotating part',body:'The axis describes the line about which motion occurs. Several members can share that line while some turn and others remain fixed. Here the outer roller turns around a stationary inner rod.'},
   {title:'A fixed connection gives the spring something to react against',body:'The bracket prevents the rod end from following the roller. Without that stationary connection, this spring would not gain the intended relative end rotation as the shade is lowered.'},
   {title:'Clearance makes independent motion possible',body:'The annular outer spring anchor has a hole around the rod. Its spokes connect outward to the roller without cutting through the fixed rod. The illustrated clearances permit separate motion but do not calculate bearing contact or friction.'},
  ],
  misconception:'The roller and central rod share an axis, but they do not rotate together. The spring and ratchet depend on their separate connections.',
  limits:dailyLifeLessons['Window shade'].limits+' The fitted bracket slot, tang and annular anchor are representative connection geometry, not manufacturing dimensions. Bearing reactions, friction and load capacity are not calculated.',
  sources:dailyLifeLessons['Window shade'].sources,
  quiz:{question:'Which pair moves together when the shade is lowered?',options:['The outer roller and its gold spring anchor.','The fixed rod and outer roller.','The right mounting bracket and pawl pivots.'],answer:0,explanation:'The outer spring anchor belongs to the rotating roller. The central rod and mounting bracket remain stationary.'},
 },
};

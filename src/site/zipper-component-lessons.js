import {dailyLifeLessons} from './daily-life-lessons.js';

export const zipperComponentLessons={
 'Zipper bottom pin and box':{
  simple:'What is the small fitting you join before zipping a jacket? Thread the free pin through the slider and seat it in the retaining box.',
  overview:'The retaining box and fixed box pin stay on one garment side. The other side has a removable insertion pin. With the slider touching the box, the free pin enters from above, travels through the empty slider channel and reaches the box floor. This positions the first teeth for closing. Unzip fully before withdrawing the pin upward and separating the sides.',
  steps:[
   {title:'Find what stays behind',body:'The box, fixed pin and lowered slider belong to the left side. The loose right side carries the insertion pin.'},
   {title:'Enter through the slider',body:'Bring the sides together, then advance Seat the bottom pin. Keep Look inside on to see the path through the channel toward the box.'},
   {title:'Seat before closing',body:'At partial insertion, the pin tip has not reached the box floor and the first opposing teeth are displaced along the zipper. Fully seat the pin before raising the slider.'},
   {title:'Detach in reverse order',body:'Return the slider to the box, withdraw the free pin upward through the channel, then move the sides apart.'},
  ],
  parts:[
   {name:'Retaining box',role:'Provides the receiving socket and bottom seating surface.'},
   {name:'Fixed box pin',role:'Stays on the box side and retains the lowered slider.'},
   {name:'Removable insertion pin',role:'Threads through the vacant slider channel into the box.'},
   {name:'Lowered slider',role:'Guides the incoming pin and later joins the tooth rows.'},
  ],
  tryIt:[
   {title:'Thread the free pin',instruction:'Start aligned above the empty channel. Keep Look inside selected and isolation off. Increase Seat the bottom pin slowly from zero to one.',observe:'The pin descends through the slider toward the socket. Closing becomes available only after full seating in this normal-use model.',reset:true,part:'bottom-connector',view:'front',values:{operation:0,alignment:1,insertion:0,closure:0,spread:.65,pullAngle:70}},
   {title:'Compare incomplete seating',instruction:'Start with the pin halfway inserted. Compare its tip with the box floor and its first tooth with the opposite row. Seat the pin, then advance the closing action.',observe:'Full insertion aligns the start of the chain. The slider then travels upward, leaving joined teeth behind.',reset:true,part:'bottom-connector',view:'front',values:{operation:0,alignment:1,insertion:.5,closure:0,spread:.65,pullAngle:70}},
   {title:'Free the second side',instruction:'Start unzipped but still seated. Run Separate the jacket while watching the bottom connector.',observe:'The free pin withdraws upward through the slider before the right side moves away. The box and slider remain with the left side.',reset:true,part:'bottom-connector',view:'front',values:{operation:1,alignment:1,insertion:1,closure:0,spread:.65,pullAngle:70}},
  ],
  deeper:[{title:'A normal operating sequence',body:'The disabled controls teach the recommended order. They are not evidence of a universal physical interlock: forcing a slider with incomplete insertion can damage some real zipper designs.'}],
  misconception:'The removable pin enters the box from above through the slider. It is not pushed sideways into a closed box, and the slider must be fully down before withdrawal.',
  limits:dailyLifeLessons.Zipper.limits,
  sources:dailyLifeLessons.Zipper.sources,
  quiz:{question:'The teeth are unzipped, but the jacket sides are still connected at the bottom. What comes next?',options:['Withdraw the free pin upward through the lowered slider.','Pull the slider upward again.','Pull the retaining box off its tape.'],answer:0,explanation:'With the slider against the box, withdraw the removable pin through its channel. The garment sides can then separate.'},
 },
 'Interlocking zipper teeth':{
  simple:'Why do joined teeth hold together, yet release through the slider? Inspect two nested shapes and follow their separation.',
  overview:'The teeth alternate between the two tapes. In this enlarged design each head has a raised face and a hollow opposite face. A raised face fits into the next tooth’s hollow. Moving the nested heads directly sideways would bring their solid walls into contact. The slider releases them in order by bending the two tape paths apart, changing the position and angle of each head relative to its neighbors.',
  steps:[
   {title:'Compare neighboring faces',body:'The selected gold head belongs to one tape; its cream neighbor belongs to the other. Keep Look inside selected to see a section through the nested shapes.'},
   {title:'Find the retaining wall',body:'The gold projection rises inside the cream recess. A straight sideways shift would run the sloping walls into each other. The model does not calculate a pulling force or breaking load.'},
   {title:'Release through a changing path',body:'Run Separate the jacket from the close-up. The view follows the selected tooth. As the slider reaches it, the tooth turns outward with its tape and separates from its neighbors.'},
   {title:'Join in reverse',body:'Run Fasten the jacket from the opening experiment. Successive heads converge and nest again, fastening the jacket.'},
  ],
  parts:[
   {name:'Locking projection',role:'The raised face occupies the hollow of a neighboring tooth.'},
   {name:'Receiving recess',role:'Its solid wall limits sideways movement of the nested projection.'},
   {name:'Head cross-section',role:'Exposes the thickness between the raised and hollow faces when Look inside is selected.'},
   {name:'Tape jaws and neck',role:'Attach the head to its continuous flexible tape.'},
   {name:'Slider and tapes',role:'Change the tooth paths so neighbors can join or separate sequentially.'},
  ],
  tryIt:[
   {title:'Read the nested shapes',instruction:'Start with head 7 joined to its neighbors. Keep Look inside on and isolation off. Compare the gold raised face with the cream hollow above it. Isolate the head only if you want to inspect its own wall.',observe:'The adjacent heads overlap in depth without occupying the same solid space. Isolation removes the neighbors; turn it off to see the interlock.',reset:true,part:'head-7',view:'front',values:{alignment:1,insertion:1,operation:1,closure:.5,spread:.65,pullAngle:70}},
   {title:'Follow one tooth out',instruction:'Start with the slider just above the selected tooth. Advance Separate the jacket several steps, then run it to completion.',observe:'The selected tooth changes angle and moves outward as the slider passes it. Its neighbors release in sequence, ending with the pin withdrawn and the garment sides apart.',reset:true,part:'head-7',view:'front',values:{alignment:1,insertion:1,operation:1,closure:.3,spread:.65,pullAngle:70}},
   {title:'Bring neighbors together',instruction:'Start with the rows separated near head 7. Advance Fasten the jacket and watch the raised face enter the next recess. Run the rest of the action.',observe:'The heads converge, align and nest; the final chain fastens the jacket.',reset:true,part:'head-7',view:'front',values:{alignment:1,insertion:1,operation:0,closure:.15,spread:.65,pullAngle:70}},
   {title:'Distinguish loose tape from joined teeth',instruction:'Start with head 7 already joined. Change Open tape spread from zero to one, then use the previous experiment to release the head through the slider.',observe:'The control reshapes only the loose tape outside the slider. Joined heads stay in place. It is not a lateral-force or strength test.',reset:true,part:'head-7',view:'front',values:{alignment:1,insertion:1,operation:1,closure:.5,spread:0,pullAngle:70}},
  ],
  deeper:[
   {title:'A shape constraint, not an unbreakable bond',body:'The nested walls resist a direct sideways displacement. Real teeth and tapes can deform or fail under sufficient load; this prescribed-motion model does not predict that load.'},
   {title:'The hollow lies on the opposite face',body:'The projection and recess are on opposite faces along the chain. They are not flat hooks that meet side-to-side. Turn off Look inside and rotate the view to compare the complete head with its section.'},
   {title:'Many geometries can fasten',body:'This example uses enlarged projection-and-recess heads. Coil elements and molded teeth use other detailed shapes. Do not infer that every zipper has this exact head.'},
  ],
  misconception:'Opening does not require all the teeth to move straight apart at once. The slider guides successive neighbors through a separating path.',
  limits:dailyLifeLessons.Zipper.limits+' The loose-tape spread control is not a sideways pull on the joined chain. No interactive lateral-load test is provided.',
  sources:dailyLifeLessons.Zipper.sources,
  quiz:{question:'Why does the slider release teeth that resist a direct sideways separation?',options:['It changes neighboring positions and angles in sequence.','It melts the head surfaces.','It makes every tooth disappear at once.'],answer:0,explanation:'The changing tape paths disengage neighboring heads one after another. Their shapes remain intact.'},
 },
 'Zipper slide wedges':{
  simple:'How can the same slider join teeth in one direction and separate them in the other? Follow its three guiding faces.',
  overview:'The slider contains a branching channel between two plates. Its central upper wedge separates the rows when the slider travels down into the joined chain. Its paired lower guides bring the rows together when it travels up toward the open tapes. These surfaces belong to one rigid slider. They do not move independently: the teeth follow different parts of the channel as the direction reverses.',
  steps:[
   {title:'Expose the channel',body:'Keep Look inside selected to remove the front plate and handhold. Find the central clay-colored divider and the two curved side guides.'},
   {title:'Follow the closing guides',body:'Advance the slider upward. In this close-up the view follows the slider, so the teeth appear to travel downward through its two branches and join below.'},
   {title:'Reverse through the divider',body:'Choose Separate the jacket. The slider now travels down the chain. In the moving view the teeth approach from below and separate around the central wedge.'},
   {title:'Connect the channel to the result',body:'Run to either end. The view returns to the jacket so you can see a fastened opening or two fully separated sides.'},
  ],
  parts:[
   {name:'Upper separating wedge',role:'Diverts the two rows to opposite sides during opening.'},
   {name:'Paired closing guides',role:'Curve the tooth paths together during closing.'},
   {name:'Front and rear plates',role:'Contain the teeth on both faces while leaving side slots for the tapes.'},
   {name:'Pull-tab hinge and bridge',role:'Transmit hand movement to the complete slider body.'},
   {name:'Nesting tooth heads',role:'Join after converging through the slider and separate sequentially on reverse travel.'},
  ],
  tryIt:[
   {title:'Join through two branches',instruction:'Start partway up with the front plate and handhold removed. Advance the slider several steps, then run Fasten the jacket. Keep the surrounding teeth visible.',observe:'The view follows the slider. Teeth pass down through the two branches and nest below; at completion the view shows the fastened jacket.',reset:true,part:'slider',view:'front',values:{alignment:1,insertion:1,operation:0,closure:.25,spread:.65,pullAngle:70}},
   {title:'Separate around one divider',instruction:'Start with most of the chain joined. Advance Separate the jacket in steps, watching the central wedge, then run to the bottom stop.',observe:'Teeth arrive from the joined path below and diverge around the wedge. The final jacket opening ends with two separate garment sides.',reset:true,part:'slider',view:'front',values:{alignment:1,insertion:1,operation:1,closure:.75,spread:.65,pullAngle:70}},
   {title:'Inspect the fixed surfaces',instruction:'Start halfway up. Isolate the selected slider and turn off Look inside to see its two plates. Turn Look inside back on, then compare the separating wedge and paired closing guides below.',observe:'The guides and divider remain fixed relative to the slider. Isolation hides the teeth, so turn it off before following engagement.',reset:true,part:'slider',view:'front',values:{alignment:1,insertion:1,operation:0,closure:.5,spread:.65,pullAngle:70}},
  ],
  deeper:[
   {title:'One channel, two directions',body:'The slider geometry is unchanged when you reverse your pull. Reversing which end receives the teeth changes convergence into separation.'},
   {title:'A moving viewpoint',body:'In the close-up, the camera follows the selected slider part without changing its scale. The apparent tooth motion is relative to that slider. The whole-jacket view shows the slider’s actual direction along the tapes.'},
   {title:'Geometry is not a force measurement',body:'These guiding faces redirect the tooth paths. Their shape alone does not give a numerical pulling force: friction, tape tension and deformation also matter.'},
  ],
  misconception:'The three wedges do not open and close like jaws. They are fixed surfaces of one slider that moves along the chain.',
  limits:dailyLifeLessons.Zipper.limits,
  sources:dailyLifeLessons.Zipper.sources,
  quiz:{question:'What changes when you reverse the pull to open the jacket?',options:['Teeth enter the same channel from the joined end.','The central wedge folds away.','The paired guides move apart like pliers.'],answer:0,explanation:'The fixed channel is traversed in reverse. Its central divider separates the successive teeth into two rows.'},
 },
};

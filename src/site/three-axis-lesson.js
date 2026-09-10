export const threeAxisLesson={
 simple:'How can a moving head and a moving plate bring a nozzle to one point in space? Choose a target, move each axis separately, then coordinate all three.',
 overview:'The target is measured relative to the build plate. A belt moves the head sideways for X. Another belt moves the plate in the opposite direction to the requested Y movement of the nozzle across it. A screw raises the gantry for Z. Their combined motion brings the nozzle tip to the target. This is a positioning move: the nozzle stays cold and no plastic is fed or deposited.',
 steps:[
  {title:'Choose a destination',body:'Requested X, Y and Z describe a point relative to the plate. The colored target and its height guide are explanatory markers attached to that plate, not printer hardware.'},
  {title:'Move only X',body:'Run the sideways experiment. The X belt carries the head along its horizontal guides. The plate and gantry height stay fixed.'},
  {title:'Move only Y',body:'Run the plate-motion experiment. The head stays still in the room while the plate moves oppositely beneath it. The nozzle nevertheless moves to positive Y relative to the plate.'},
  {title:'Move only Z',body:'Run the lift experiment. The rotating screw and captive nut raise the gantry along its vertical guides. Z is the height above the plate; Z lift measures travel from the starting height of 0.2 mm.'},
  {title:'Coordinate the axes',body:'Run the combined experiment. The drives share the same progress along a straight line in plate coordinates. The target moves with the plate until the nozzle reaches it.'},
  {title:'Inspect the reached point',body:'At completion the actual coordinates match the requested coordinates and distance to target is zero. Plastic deposited remains zero. Change a target to make another move from the current position, or reset to the starting position.'},
 ],
 parts:[
  {name:'X belt and head guides',role:'Translate the nozzle sideways.'},
  {name:'Y belt and plate guides',role:'Move the plate opposite to the desired relative nozzle travel.'},
  {name:'Z screw and captive nut',role:'Convert screw rotation into gantry lift.'},
  {name:'Virtual target and height guide',role:'Show the destination in coordinates attached to the build plate.'},
 ],
 tryIt:[
  {title:'Move the head sideways',instruction:'Start at X 0, Y 0, Z 0.2 mm and run to X 8 mm.',observe:'Only the head moves sideways. The nozzle reaches the target without moving the plate or raising the gantry.',reset:true,part:'system',isolate:false,values:{targetX:8,targetY:0,targetZ:.2,speed:2}},
  {title:'Move the plate for Y',instruction:'Start again and request Y 8 mm while keeping X 0 and Z 0.2 mm.',observe:'The plate moves -8 mm in the room. The nozzle reaches +8 mm relative to the plate, meeting the target that the plate carries.',reset:true,part:'system',isolate:false,values:{targetX:0,targetY:8,targetZ:.2,speed:2}},
  {title:'Raise the nozzle',instruction:'Start again and request Z 8 mm with X and Y unchanged.',observe:'The screw raises the gantry by 7.8 mm from its 0.2-mm starting height. No horizontal drive needs to move.',reset:true,part:'system',isolate:false,values:{targetX:0,targetY:0,targetZ:8,speed:2}},
  {title:'Coordinate all three axes',instruction:'Start again and request X 6, Y -6 and Z 6 mm.',observe:'The head, plate and lift move together. Their combined relative motion follows a straight line to the same plate-mounted target.',reset:true,part:'system',isolate:false,values:{targetX:6,targetY:-6,targetZ:6,speed:2}},
  {title:'Reverse the X direction',instruction:'Start again and request X -8 mm.',observe:'The X belt drive turns oppositely and carries the head to the other side. The plate and gantry height stay fixed.',reset:true,part:'system',isolate:false,values:{targetX:-8,targetY:0,targetZ:.2,speed:2}},
 ],
 deeper:[
  {title:'Relative motion explains the moving plate',body:'A positive requested nozzle displacement can come from moving the nozzle forward or moving its reference plate backward. This printer uses the latter for Y. The target must stay attached to the plate for the comparison to remain meaningful.'},
  {title:'Positioning and deposition are separate commands',body:'A travel move changes X, Y and Z without commanding extrusion. Heating and filament feed become necessary when material is to be deposited; they are not required for this cold positioning experiment.'},
  {title:'Speed changes arrival time',body:'The speed control changes progress along the same requested line. A separate 3-mm/s vertical limit can reduce the coordinated speed when a move has a large Z component. Neither setting changes the destination.'},
 ],
 misconception:'All three coordinates do not require the nozzle itself to move in three room directions. The plate supplies the relative Y movement in this arrangement.',
 limits:'This Cartesian teaching model uses toothed belts for X and Y and a screw for Z. It follows ideal commanded motion within a small workspace; it does not simulate motor currents, acceleration, backlash, missed steps, homing, calibration or measured positioning accuracy. The starting pose is prescribed, not found by a homing cycle. Motion runs at half simulated speed for observation. The target and height guide are virtual annotations. No extrusion, heating or print job is performed.',
 sources:[{title:'Marlin: linear moves and separate extrusion coordinates',url:'https://marlinfw.org/docs/gcode/G000-G001.html'}],
 quiz:{question:'The nozzle stays still in the room while the plate moves backward. Can its Y coordinate relative to the plate increase?',options:['Yes. The reference plate moves in the opposite direction.','No. Only motion of the nozzle in the room can change that coordinate.','Only if plastic is being extruded.'],answer:0,explanation:'A coordinate relative to the plate depends on their separation. Moving the plate backward changes that separation even with a stationary nozzle.'},
};

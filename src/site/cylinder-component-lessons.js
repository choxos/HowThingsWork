import {dailyLifeLessons} from './daily-life-lessons.js';

export const cylinderComponentLessons={
 'Lock cylinder (plug)':{
  simple:'Which part turns inside a lock? Free the plug, follow its shaft to the latch, and open the door.',
  overview:'The plug is the inner cylinder containing the keyway. It turns inside a shell attached to the door. With the wrong key, a pin crosses their boundary and connects the two parts. The matching key places every pin joint at that boundary. The plug can then carry the key and lower pins around while its rear shaft turns the latch cam. The shell stays attached to the door throughout.',
  steps:[
   {title:'Find the moving boundary',body:'Inspect the inner plug and the surrounding shell. The blue shear-line guide marks the boundary at the pin joints.'},
   {title:'Try an obstructed turn',body:'Seat the key with one incorrect cut and request a turn. Pin stack 3 crosses the boundary, so the actual plug angle stays at zero.'},
   {title:'Follow a free turn',body:'Seat the matching key and turn it. The keyway floor, key and lower pins turn with the plug. The upper drivers remain in the shell.'},
   {title:'Use the rotation',body:'The rear shaft turns the cam. Its follower retracts the latch until it clears the strike. Run the opening action to see the whole door move.'},
  ],
  parts:[
   {name:'Plug and keyway floor',role:'Support the key and lower pins and rotate together when the boundary is clear.'},
   {name:'Stationary shell',role:'Supports the upper pins and stays fixed relative to the door.'},
   {name:'Split pin stacks',role:'Prevent rotation whenever a solid pin crosses the plug boundary.'},
   {name:'Rear shaft and cam',role:'Carry the plug’s rotation to the sliding latch mechanism.'},
  ],
  tryIt:[
   {title:'Request a blocked turn',instruction:'Start with one incorrect cut seated and a 60° turn requested. Inspect pin stack 3, then compare the actual plug angle.',observe:'The requested angle is not achieved. The lower pin obstructs the boundary and the latch remains extended.',reset:true,part:'pins',view:'side',values:{keyPattern:1,insertion:1,turn:60,door:0}},
   {title:'Carry the key around',instruction:'Start with a matching key turned 30°. Inspect the plug and keyway floor. Try the Key insertion control, then continue turning.',observe:'The plug and key turn together. Insertion is locked while turned; the cam has moved the latch but 30° has not cleared the strike.',reset:true,part:'plug',view:'front',values:{keyPattern:0,insertion:1,turn:30,door:0}},
   {title:'Turn rotation into an opening',instruction:'Start with the matching key seated and upright. Run the opening action.',observe:'The plug turns, its cam pulls the latch clear, and the complete door swings open.',reset:true,part:'lock',view:'back',values:{keyPattern:0,insertion:1,turn:0,door:0}},
   {title:'Return before withdrawing',instruction:'Start with the door closed and the plug turned. Run Close and relock.',observe:'The plug returns upright before the key withdraws. The pins restore the obstruction and the door is secured.',reset:true,part:'lock',view:'side',values:{operation:1,keyPattern:0,insertion:1,turn:80,door:0}},
  ],
  deeper:[
   {title:'Fixed depends on the reference',body:'The shell is stationary relative to the door during a key turn. When the door opens, both the shell and the plug travel with it. The strike remains on the building’s frame.'},
   {title:'Matching and driving are separate jobs',body:'The pin joints determine whether the plug can turn. Once it can, the shaft and cam transmit that turn to the latch. Correct alignment alone does not retract the latch.'},
  ],
  misconception:'The whole lock does not spin inside the door. The plug turns inside its shell; later the door carries both parts through the doorway.',
  limits:dailyLifeLessons['Cylinder lock'].limits,
  sources:dailyLifeLessons['Cylinder lock'].sources,
  quiz:{question:'The matching key is seated but has not turned. What happens to the latch?',options:['It remains extended until the plug drives the cam.','It retracts as soon as the pins align.','It turns around with the upper driver pins.'],answer:0,explanation:'Pin alignment permits rotation. Turning the plug then drives the cam and pulls the latch sideways.'},
 },
 'Cylinder-lock cam and bolt':{
  simple:'How does a turning key pull a latch sideways? Follow the cam roller into its slotted follower, then open the door.',
  overview:'The matching key has already freed the cylinder in this close-up. A cam on the rear of the plug carries a roller. The roller sits inside a vertical slot attached to the latch. When the cam turns, the roller moves both sideways and downward. The slot lets it move downward but transfers the sideways movement to the latch. Retraction compresses a spring and clears the fixed strike so the door can open.',
  steps:[
   {title:'Find the connection',body:'The plug shaft turns the gold cam. Its roller fits between the two upright sides of the follower slot.'},
   {title:'Separate the two movements',body:'Turn the key slowly. The roller moves down through the slot while pushing one side of it sideways. The follower and latch slide together.'},
   {title:'Clear the strike',body:'At a small turn, the latch still overlaps the frame opening. Continue turning until the tip clears the strike, then open the door.'},
   {title:'Return through the same connection',body:'With the door closed, reduce the turn. The extending spring pushes the latch and follower back, returning the cam toward its starting angle.'},
  ],
  parts:[
   {name:'Plug shaft and cam',role:'Carry the key’s rotation to an offset roller.'},
   {name:'Roller and vertical slot',role:'Allow one component of roller motion while transferring the other to the latch.'},
   {name:'Follower and latch',role:'Slide together in fixed guides. The latch tip enters the door-frame strike.'},
   {name:'Return spring',role:'Compresses as the latch retracts; its stored energy can drive the return movement.'},
   {name:'Fixed strike',role:'Retains the closed door while the latch overlaps its opening.'},
  ],
  tryIt:[
   {title:'Turn without enough clearance',instruction:'Begin with the matching key seated and turn it to 30°. Try opening the door.',observe:'The latch has moved, but its tip still overlaps the strike. The door stays closed.',reset:true,values:{keyPattern:0,insertion:1,turn:30,door:0}},
   {title:'Make enough room',instruction:'Begin at 60°, then increase Open the door or run the opening action.',observe:'The retracted latch clears the strike and the door swings open with its lock attached.',reset:true,values:{keyPattern:0,insertion:1,turn:60,door:0}},
   {title:'Compare equal angle steps',instruction:'Start at zero. Compare the latch movement from 0° to 30° with the movement from 30° to 60°.',observe:'Equal turns do not give equal latch travel. Follow the roller’s circular path and its horizontal projection.',reset:true,values:{keyPattern:0,insertion:1,turn:0,door:0}},
  ],
  deeper:[
   {title:'A circle supplies the sliding motion',body:'For this roller geometry, latch retraction is r sin θ, where r is the distance from the cam axis to the roller and θ is the angle from its upright starting position. The follower slot accommodates the roller’s vertical position, r cos θ.'},
   {title:'Why stop before a quarter-turn?',body:'At exactly 90°, a horizontal spring force through the roller would pass through the cam axis and produce no returning torque. The 80° stop keeps a turning arm available. The animation prescribes the motion rather than solving spring forces.'},
  ],
  misconception:'Moving the latch a little does not necessarily release the door. Its tip must move far enough to clear the fixed strike.',
  limits:dailyLifeLessons['Cylinder lock'].limits,
  sources:dailyLifeLessons['Cylinder lock'].sources,
  quiz:{question:'Why can the roller move downward while the latch moves only sideways?',options:['The vertical slot allows that part of the roller’s motion.','The roller disconnects from the cam.','The latch bends downward and springs back.'],answer:0,explanation:'The roller slides along the slot. The slot’s side walls transfer horizontal movement to the guided latch.'},
 },
 'Lock pin stacks':{
  simple:'Why can one misplaced pin stop the whole lock? Compare the five joints, then try turning the key.',
  overview:'Each stack has a lower pin, an upper driver pin and a spring. The lower pins have different lengths. A matching key raises them by different amounts until all five joints reach the boundary between the rotating plug and the fixed shell. A joint below that boundary leaves an upper pin across it. A joint above it leaves a lower pin across it. Either solid obstruction prevents the plug from turning.',
  steps:[
   {title:'Look at the resting pins',body:'With the key out, the lower pins rest on the keyway floor. Every upper pin extends across the plug boundary, joining the rotating and stationary parts.'},
   {title:'Follow the slopes',body:'Insert the key slowly. Each sloping cut lifts a lower pin, its upper driver and its spring. The lower pins have different lengths, so equal lifts would not align their joints.'},
   {title:'Compare all five joints',body:'Seat the matching key. The five joints meet the blue shear-line guide. Now the plug and lower pins can turn; the upper pins stay in the shell.'},
   {title:'Find a single obstruction',body:'Reset and compare one incorrect cut. Inspect pin stack 3. Its lower pin rises through the boundary, so requesting a turn leaves the plug and latch still.'},
  ],
  parts:[
   {name:'Lower key pin',role:'Follows the key surface. Its length helps determine the required cut height.'},
   {name:'Upper driver pin',role:'Bridges the plug and shell at rest. A correct key lifts its bottom to the shear line.'},
   {name:'Pin spring',role:'Maintains contact during insertion and pushes the pair down during withdrawal.'},
   {name:'Shear line',role:'The boundary between the rotating plug and stationary shell, shown by a blue guide.'},
   {name:'Keyway floor and key',role:'The floor supports the resting lower pins; the entering key lifts them to a new set of heights.'},
  ],
  tryIt:[
   {title:'Free every joint',instruction:'Start with the matching key seated. Turn it slowly, then run the opening sequence.',observe:'The lower pins turn with the plug. The upper drivers stay in the housing, and the door can open.',reset:true,values:{keyPattern:0,insertion:1,turn:0,door:0}},
   {title:'Inspect the one wrong cut',instruction:'Start with the altered key seated and request a turn. Select Pin stack 3, then isolate it to inspect both pins and its spring.',observe:'The lower pin crosses the boundary. One obstruction is enough to leave the plug at zero degrees.',reset:true,values:{keyPattern:1,insertion:1,turn:60,door:0}},
   {title:'Restore the obstruction',instruction:'Start with the matching key upright. Slowly reduce Key insertion to zero.',observe:'The springs lower the pin pairs. Without the key, the upper pins span the plug boundary again.',reset:true,values:{keyPattern:0,insertion:1,turn:0,door:0}},
  ],
  deeper:[
   {title:'Every stack has a veto',body:'Clearing four barriers cannot cancel the fifth. This is a physical version of an AND condition: all five paths must be clear before one shared plug can move.'},
   {title:'A target height, not maximum height',body:'Both low and high joints can obstruct the boundary. The key must place each joint at the required height; simply lifting every pin farther does not solve the matching problem.'},
  ],
  misconception:'The pins do not disappear when the key works. The lower pins move with the plug, while the upper drivers stay in the fixed shell.',
  limits:dailyLifeLessons['Cylinder lock'].limits,
  sources:dailyLifeLessons['Cylinder lock'].sources,
  quiz:{question:'A wrong cut puts a pin joint above the shear line. Which part can block rotation?',options:['The lower key pin now crosses the boundary.','No part blocks it because higher is always better.','The other four springs lift the plug out.'],answer:0,explanation:'The lower pin extends into the stationary shell. That solid connection obstructs rotation even though the upper driver has moved clear.'},
 },
 'Lock return springs':{
  simple:'What resets the lock after your hand stops turning? Watch the latch spring return the cam, then the pin springs lower the pins.',
  overview:'This close-up follows two spring systems in a pin-cylinder latch. Turning the cam retracts the latch and compresses its return spring. When you release the turned key, that spring extends the latch and returns the cam through its follower. The smaller pin springs have a different job: as the key withdraws, they keep the pins following its slopes and restore the barriers across the plug boundary. Lever locks use springs to return pivoting plates instead of these pin pairs.',
  steps:[
   {title:'Store energy while retracting',body:'Turning the cam pulls the latch inward and compresses its spring. The latch stays retracted while the door is closed.'},
   {title:'Return the latch and cam',body:'Run the closing action. Once the door is closed, the latch spring extends, pushing the follower and rotating the cam back toward zero.'},
   {title:'Withdraw the upright key',body:'The key can slide out only after its rotation has returned to zero. The pin springs lower the pairs along the withdrawing key profile.'},
   {title:'Check the secured result',body:'The latch is back inside the strike and the driver pins bridge the plug boundary. The next attempted opening again needs a matching key.'},
  ],
  parts:[
   {name:'Latch return spring',role:'Stores energy during retraction and extends the latch through its follower.'},
   {name:'Cam and follower',role:'Transmit the return movement back to the key and plug.'},
   {name:'Pin springs',role:'Keep each pin pair in contact with the key and restore its resting obstruction.'},
   {name:'Fixed spring seats',role:'Provide the reaction points against which the springs push.'},
   {name:'Strike and keyway floor',role:'The strike receives the latch; the keyway floor stops the lower pins after withdrawal.'},
  ],
  tryIt:[
   {title:'Watch the latch spring',instruction:'Start with the closed door and retracted latch. Advance the closing action in steps.',observe:'The latch spring lengthens and the cam returns before the key begins to slide out.',reset:true,part:'latch-drive',view:'back',values:{operation:1,keyPattern:0,insertion:1,turn:80,door:0}},
   {title:'Watch the pin springs',instruction:'Start with the key upright and fully seated. Run or step through withdrawal.',observe:'The five smaller springs lengthen as the pins follow the key down. Upper drivers restore the obstruction.',reset:true,part:'pins',view:'side',values:{operation:1,keyPattern:0,insertion:1,turn:0,door:0}},
   {title:'Follow the complete return',instruction:'Start with the door open and the latch held back. Run Close and relock.',observe:'The door closes first, the latch spring returns the cam, and the key withdraws. The final result is a secured door.',reset:true,part:'system',view:'front',values:{operation:1,keyPattern:0,insertion:1,turn:80,door:65}},
  ],
  deeper:[
   {title:'Two jobs, two spring systems',body:'The latch spring helps return a driven mechanism. The pin springs maintain contact and reset its matching check. Neither spring decides which key fits; the key and pin shapes determine that.'},
   {title:'Energy needs a reaction point',body:'A compressed spring pushes on both ends. One end reacts against a fixed seat while the other moves the latch or pin. Without those supports, a spring drawn beside the mechanism would not explain its motion.'},
  ],
  misconception:'Withdrawing a turned key is not the return action. The cam first returns to its starting angle; only then can the key slide out and let the pins reset.',
  limits:'This is the pin-cylinder spring arrangement. '+dailyLifeLessons['Cylinder lock'].limits+' Spring motion is shown slowly at prescribed rates; it is not a force, damping or stored-energy simulation.',
  sources:dailyLifeLessons['Cylinder lock'].sources,
  quiz:{question:'The latch is extended, but the matching key is still upright and seated. What has not reset yet?',options:['The pin joints are still aligned until the key withdraws.','The door frame must rotate.','The cam has to detach from the plug.'],answer:0,explanation:'The latch spring can return the bolt while the seated key still holds every pin joint at the shear line. Withdrawal lets the pin springs restore the obstruction.'},
 },
};

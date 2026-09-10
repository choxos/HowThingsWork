import {dailyLifeLessons} from './daily-life-lessons.js';

export const leverComponentLessons={
 'Lever-lock key':{
  simple:'How can one key lift three plates and move a bolt? Follow its shoulders through a complete turn.',
  overview:'A lever-lock key has more than one job. Its shaped shoulders lift the lever plates until their gates admit the bolt stump. Its drive feature then moves the bolt. This teaching key separates those jobs into three broad curved shoulders and a drive roller, making their contacts visible. A full opening turn raises the plates, retracts the bolt, lets the plates return, and brings the key back to its withdrawal position.',
  steps:[
   {title:'Inspect the shoulders',body:'With the key out, compare its three curved shoulders. Each meets a different lever plate when the key is inserted.'},
   {title:'Arrange the gates',body:'Turn the matching key to 135 degrees. Its shoulders hold the plates at different angles, but all gates clear the same bolt path.'},
   {title:'Drive the bolt',body:'Continue past 180 degrees. The key roller presses the side of the drive slot, retracting the bolt through the aligned gates.'},
   {title:'Complete the turn',body:'Near the end, the shoulders move away and the springs lower the plates around the bolt’s end pockets. At 360 degrees the key can withdraw, and the retracted bolt allows opening.'},
  ],
  parts:[
   {name:'Bow and shaft',role:'Carry the turning input along the inserted key.'},
   {name:'Three key shoulders',role:'Contact the lever lands and set their raised angles.'},
   {name:'Drive arm and roller',role:'Transfer the key turn to the bolt slot after initial free movement.'},
   {name:'Lever lands and gates',role:'Turn shoulder shape into a permitted or obstructed bolt path.'},
  ],
  tryIt:[
   {title:'One high shoulder stops the drive',instruction:'Start with one shoulder too high. Run the opening action and inspect the middle plate.',observe:'The key can raise the plates, but further driving turn stops at 180 degrees. The bolt and door remain closed.',reset:true,part:'lock',view:'front',values:{keyPattern:1,insertion:0,turn:0}},
   {title:'Separate lifting from driving',instruction:'The matching key is at 135 degrees. Advance once, then keep advancing past 180 degrees.',observe:'The gates are already clear before bolt travel begins. The drive roller later makes contact and pulls the bolt.',reset:true,part:'key',view:'front',values:{keyPattern:0,insertion:1,turn:135}},
   {title:'Finish and remove the key',instruction:'Begin with the matching key out. Run the entire opening action.',observe:'The key raises the plates, retracts the bolt, completes its turn and withdraws. The door opens with the bolt still retracted.',reset:true,part:'lock',view:'front',values:{keyPattern:0,insertion:0,turn:0}},
  ],
  deeper:[
   {title:'Two kinds of shape matching',body:'A pin-cylinder key sets split pin joints at a cylinder boundary. This lever key sets plate gates at a bolt path. Both need the right pattern, but they release different barriers.'},
   {title:'A teaching drive makes the sequence visible',body:'Commercial lever keys and bolt contacts vary. Here broad shoulder sectors maintain lift while a separate rigid roller drives the bolt. Their shapes make contact and timing easy to inspect; they are not a manufactured key pattern.'},
  ],
  misconception:'A key that enters the lock has not necessarily passed its matching test. One incorrect shoulder can leave a gate across the bolt path.',
  limits:dailyLifeLessons['Lever lock'].limits,
  sources:dailyLifeLessons['Lever lock'].sources,
  quiz:{question:'At 135 degrees all three gates are clear, but the bolt has not moved. What must the key do next?',options:['Continue until its drive roller contacts the slot wall.','Withdraw immediately to pull the bolt out.','Lift every plate as high as possible.'],answer:0,explanation:'Gate alignment permits travel. The key’s driving contact must then supply that travel; lifting alone does not retract the bolt.'},
 },
 'Lever-lock return springs':{
  simple:'Why does the bolt stay retracted when the springs lower the plates? Finish the key turn and follow the spring contacts.',
  overview:'Each lever plate has a return spring anchored to the lock case. A key shoulder pushes the plate upward against its spring. When that shoulder passes, the spring lowers the plate around the same fixed pivot. The bolt stump can sit in a large end pocket while this happens. The springs restore the gate barriers; they do not drive this deadbolt back into the door frame.',
  steps:[
   {title:'Find both ends of the spring',body:'One end is fixed to the case. The curved leaf bears on the top of its lever plate. It stays connected to that plate as the key raises it.'},
   {title:'Start with the bolt retracted',body:'The selected state is 270 degrees into the opening turn. The key shoulders still support the three raised plates, and the stump has crossed their gates into the left-hand pockets.'},
   {title:'Move the shoulders away',body:'Advance the key. As the shoulder sectors pass the lever lands, the springs lower the plates. Watch the bolt stay retracted while the narrow gates leave its path.'},
   {title:'Check what has reset',body:'At the end of the turn, the plates are down and the key can withdraw. The door can open because the bolt is still clear of the strike.'},
   {title:'Compare the locking return',body:'Reverse the key with the door closed. It raises the plates, extends the bolt, then lets the springs lower the plates around the other end pockets. The secured result needs both bolt extension and restored barriers.'},
  ],
  parts:[
   {name:'Fixed spring seats',role:'Provide the reaction points that let the springs press on the plates.'},
   {name:'Leaf springs',role:'Bear on the lever tops and return the plates as key support moves away.'},
   {name:'Lever plates and pivot',role:'Stay attached while turning upward and returning downward.'},
   {name:'Key shoulders and lands',role:'Hold the plates raised during the bolt-driving part of the turn.'},
   {name:'End pockets and stump',role:'Let the plates settle without moving the bolt to its other position.'},
  ],
  tryIt:[
   {title:'Return the plates, keep the bolt',instruction:'Start at 270 degrees and run the selected opening action, or advance a few times.',observe:'The springs lower the plates; bolt retraction stays at 100%. The key withdraws and the door opens.',reset:true,part:'lever-pack',values:{insertion:1,turn:270}},
   {title:'Inspect the other resting pockets',instruction:'The door is closed and the key has completed its opening turn. Run Close and relock.',observe:'The plates rise again before the key extends the bolt. They then settle around the opposite pockets and the door is secured.',reset:true,part:'lever-pack',values:{operation:1,insertion:1,turn:360}},
   {title:'Look at one spring contact',instruction:'At the raised state, inspect the third return spring and then advance the key toward the end of its turn.',observe:'Its case end stays fixed while its contact end follows the returning plate.',reset:true,part:'spring-3',view:'front',values:{insertion:1,turn:270}},
  ],
  deeper:[
   {title:'Returning a barrier is different from returning a bolt',body:'A spring latch can extend its bolt when a cam releases it. These lever springs act on the plates. A new key turn must raise the barriers and positively drive the deadbolt to its other position.'},
   {title:'A large pocket has a job',body:'If the opening were only a narrow passage, the plate could not drop around the stump at the end of the operation. The larger end pockets allow that return; the narrow passage still controls movement between them.'},
  ],
  misconception:'The leaf springs do not pull the deadbolt back. They lower the lever plates; the key drives the bolt.',
  limits:dailyLifeLessons['Lever lock'].limits,
  sources:dailyLifeLessons['Lever lock'].sources,
  quiz:{question:'The key has finished the opening turn and the plates have dropped. What happens to the bolt?',options:['It stays retracted while the stump rests in the end pockets.','The lever springs automatically extend it.','It detaches from the key and falls out.'],answer:0,explanation:'The springs restore the plate positions. The end pockets allow this without changing bolt position; a matching key must drive the bolt again.'},
 },
 'Lever-lock tumblers and stumps':{
  simple:'Why can one over-raised plate stop the whole bolt? Compare its gate with the blue bolt path.',
  overview:'The lever plates are a stack of barriers. Each has two large resting pockets joined by a narrow gate. The key must position all three gates so one peg on the bolt can pass through them. This model calls that bolt-mounted peg the stump. The blue guide in each plate marks its required route, so you can isolate a plate and still compare the opening with the path.',
  steps:[
   {title:'Find the resting pocket',body:'With the key absent, the bolt stump rests in a large pocket. The narrow gate is away from the path, so the bolt cannot cross to the other pocket.'},
   {title:'Lift with the matching shoulders',body:'Insert the matching key and turn to 135 degrees. The plates rotate by different amounts. Their blue gate edges now surround the same horizontal bolt path.'},
   {title:'Test one over-raised plate',body:'Set up the wrong-shoulder experiment and inspect lever tumbler 2. Its gate is above the blue path. The stump cannot pass through its lower edge, even though the other gates are clear.'},
   {title:'Follow the crossing',body:'Return to the matching-key experiment and run the opening action. The peg slides with the bolt through all three passages and comes to rest in the other pockets.'},
   {title:'Check the barrier again',body:'Finish the turn. The springs lower the plates and move the gates away from the bolt path again, this time holding the retracted bolt. The door can now open.'},
  ],
  parts:[
   {name:'Three lever plates',role:'Each contributes an independent gate that can prevent bolt travel.'},
   {name:'Narrow gates',role:'Provide the shared passage only at the correct plate angles.'},
   {name:'End pockets',role:'Leave room for the stump while a plate returns to rest.'},
   {name:'Bolt stump',role:'Moves with the deadbolt and checks all three openings at once.'},
   {name:'Blue path guides',role:'Show the required stump route during close-up or isolated inspection; they are teaching markers.'},
  ],
  tryIt:[
   {title:'One shoulder too high',instruction:'The wrong key has reached the drive stage. Isolate lever tumbler 2 and compare its gate with the blue guide.',observe:'Metal crosses the required path. More key rotation is blocked and the bolt remains extended.',reset:true,part:'tumbler-2',view:'front',values:{keyPattern:1,insertion:1,turn:360}},
   {title:'All gates clear',instruction:'The matching key holds the plates at their required angles. Inspect the stack, then run the opening action.',observe:'The stump can cross every gate. The bolt clears the strike and the door opens.',reset:true,part:'lever-pack',view:'front',values:{insertion:1,turn:135}},
   {title:'Follow the peg itself',instruction:'Start as bolt motion begins. Select the bolt stump, then advance the key.',observe:'The same peg moves through each plate; it does not rotate with the key or disappear when a gate blocks it.',reset:true,part:'stump',view:'front',values:{insertion:1,turn:180}},
  ],
  deeper:[
   {title:'Different angles can make one path',body:'Gate shapes differ between the three plates. They do not need identical lifting angles; they need openings at the same required bolt route.'},
   {title:'A peg tests every layer',body:'One clear gate is insufficient. The rigid stump passes through the whole stack, so any plate edge across its path prevents bolt movement.'},
  ],
  misconception:'More lift is not always better. A gate raised too far misses the bolt path just as a gate left too low does.',
  limits:dailyLifeLessons['Lever lock'].limits,
  sources:dailyLifeLessons['Lever lock'].sources,
  quiz:{question:'Two gates are clear, but the third is too high. What can the bolt stump do?',options:['Pass the two clear plates and leave the bolt behind.','Move only after the third gate also clears its path.','Lift the last plate by ignoring its key shoulder.'],answer:1,explanation:'The rigid peg and bolt move together. Every plate opening must admit the same path before they can cross the stack.'},
 },

 'Lever-lock bolt and bolt pin':{
  simple:'Why can the key turn before the bolt starts moving? Follow the drive roller, then clear the door frame.',
  overview:'The deadbolt slides in fixed guides and carries a peg through the lever plates. Here that peg is called the bolt stump. A roller on the key drive fits inside a wide, open-bottom slot attached to the bolt. Some of the turn moves the roller across free space. After it reaches a side wall, further rotation pushes the bolt sideways, provided every lever gate is clear.',
  steps:[
   {title:'See what slides together',body:'The deadbolt, its stump and the drive slot form one moving assembly. The guides and door-frame strike stay fixed relative to their supports.'},
   {title:'Turn across the free space',body:'At the selected 135-degree position, the roller is inside the wide slot but has not reached its driving wall. The lever gates are clear, yet the bolt is still fully extended.'},
   {title:'Make contact with the wall',body:'As the turn passes 180 degrees, the roller presses the left wall. The whole bolt assembly translates; its stump must fit through the three lever gates.'},
   {title:'Clear the strike',body:'Retraction must move the bolt tip past the fixed strike. A small movement is not enough. After sufficient travel, the door can swing open.'},
   {title:'Drive the return positively',body:'With the door closed, reverse the key. Its roller takes up free movement in the opposite direction, then presses the other wall to extend the bolt.'},
  ],
  parts:[
   {name:'Deadbolt',role:'Enters the fixed strike to retain the closed door.'},
   {name:'Bolt stump or pin',role:'Travels through the lever openings with the bolt.'},
   {name:'Wide drive slot',role:'Allows initial free roller movement and then transfers a sideways push.'},
   {name:'Key drive and roller',role:'Convert the turning input into force on a slot wall.'},
   {name:'Fixed guides and strike',role:'Constrain straight bolt travel and provide the door-holding connection.'},
  ],
  tryIt:[
   {title:'Turn without translating yet',instruction:'Start at 135 degrees and advance the lock once.',observe:'The roller moves through the slot, but bolt retraction stays at zero.',reset:true,part:'bolt',values:{insertion:1,turn:135}},
   {title:'Some travel is insufficient',instruction:'Start at 195 degrees and try to open the door.',observe:'The bolt has begun retracting, but still overlaps the strike. The door stays closed.',reset:true,part:'bolt',values:{insertion:1,turn:195}},
   {title:'Make enough clearance',instruction:'Start at 225 degrees and run the selected opening action.',observe:'The bolt clears the strike. The key finishes its turn and withdraws; the door opens.',reset:true,part:'bolt',values:{insertion:1,turn:225}},
   {title:'Drive the other direction',instruction:'The bolt is fully retracted and the door is closed. Run Close and relock.',observe:'The roller eventually presses the opposite wall, extending the bolt before the plates settle and the key comes out.',reset:true,part:'bolt',values:{operation:1,insertion:1,turn:360}},
  ],
  deeper:[
   {title:'Free movement has a purpose',body:'The key must arrange the plate gates before demanding bolt travel. The wide slot in this teaching drive makes that timing visible without disconnecting its parts.'},
   {title:'Rotation and translation are different',body:'The roller follows a circle. During contact its horizontal coordinate sets the bolt position, while it changes height along the slot wall. Equal angle changes do not produce equal bolt travel.'},
  ],
  misconception:'Turning the key does not guarantee immediate bolt motion. The drive must take up its free movement, and every gate must admit the stump.',
  limits:dailyLifeLessons['Lever lock'].limits,
  sources:dailyLifeLessons['Lever lock'].sources,
  quiz:{question:'The roller touches the driving wall, but a lever gate is obstructed. What happens?',options:['The stump jumps over the plate.','The bolt bends through the gate.','The bolt and further driving turn remain blocked.'],answer:2,explanation:'The rigid bolt and stump cannot translate through a plate edge. The connected drive cannot continue its bolt-moving part of the turn until every gate is clear.'},
 },

};

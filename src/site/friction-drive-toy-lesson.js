import {TOY_DEFAULTS, toyPlan} from './friction-drive-toy-physics.js';

const moment = (plan, kind, fraction = .5, last = false) => {
  const phases = plan.phases.filter(p => p.kind === kind), phase = last ? phases.at(-1) : phases[0];
  return phase.t0 + fraction * phase.d;
};
const trial = (title, instruction, observe, time, part = 'experiment', settings = {}, isolate = false) => {
  const values = {...TOY_DEFAULTS,...settings}, plan = toyPlan(values);
  return {title,instruction,observe,values,initialState:{settings:values,time:typeof time==='function'?time(plan):time},reset:true,part,isolate,view:'front'};
};

export const frictionDriveToyLesson = {
  simple: 'How does pushing a toy charge a flywheel, and why does the toy keep moving after you let go?',
  overview: 'Rear tires grip the floor and turn a large gear. Two gear pairs make a small steel flywheel spin much faster than the wheels. Its rotation stores energy. During a lift the flywheel keeps spinning; when the toy touches down, it can turn the rear wheels and drive the car forward. Follow the hand, the independent front axle, the changing power direction and the losses that finally bring everything to rest.',
  steps: [
    {title:'Press and push',body:'The hand pushes the roof and presses downward. More downward force increases the assigned traction available at the rear tires.'},
    {title:'Increase the speed through gears',body:'The rear-axle gear turns a small pinion. A second large gear fixed to that pinion turns the final small pinion and flywheel. Two external meshes reverse rotation twice.'},
    {title:'Carry back without reversing the flywheel',body:'The hand lifts the toy clear of the floor and returns it. The geared rear wheels and flywheel coast forward while the whole toy moves backward.'},
    {title:'Touch down and charge again',body:'Spinning rear tires initially slip ahead of the hand. As the hand catches up, floor friction spins up the flywheel. Repeated slipping pushes can increase its speed, but a gripping push already reaches the chosen speed.'},
    {title:'Choose how to release',body:'Set the toy down at rest and the rear tires skid while accelerating its body. Release it while moving and less speed matching may be needed. The unconnected front wheels roll at body speed.'},
    {title:'Return stored energy',body:'Once the tires roll without slip, the flywheel and moving body share one linked speed. Power can flow back through the same gears.'},
    {title:'Account for the stop',body:'Tire skidding, gear losses, bearing friction and rolling resistance dissipate energy. The final reading gives distance and time after release; both axles and the flywheel stop.'},
  ],
  parts:[
    {name:'Body and chassis',role:'Hollow panels, wheel arches, rails and roof support a recognizable toy car.'},
    {name:'Wheels and axles',role:'Rear tires drive the gears. The front axle turns independently.'},
    {name:'Supported gear train',role:'Bored plates support the rear axle, fixed compound-gear pin and fast shaft.'},
    {name:'Compound gear and pinion',role:'Two gears fixed together provide the link between the two meshes.'},
    {name:'Flywheel and bearings',role:'A steel disk stores rotational energy while its bushes support the fast shaft.'},
    {name:'Hand and floor',role:'The hand supplies work; contact with the floor transfers force to the tires.'},
    {name:'Speed and energy charts',role:'Readable close-ups distinguish rolling from slipping and track every modeled energy store and loss.'},
  ],
  tryIt:[
    trial('Run the complete experiment','Press Play from rest.','Three pushes charge the flywheel. The hand lifts and sets the toy down, then it coasts to a measured stop.',0),
    trial('Charge on the first push','Watch the rear wheels and flywheel during the first stroke.','The floor drives the gear train. With this press setting the rear rims lag behind the moving body because the tires slip.',p=>moment(p,'pushing',.75),'machine'),
    trial('Carry the spinning toy back','Inspect the airborne return.','The hand moves backward while the flywheel and rear wheels keep rotating forward. The floor supplies no traction during the lift.',p=>moment(p,'lifted'),'experiment'),
    trial('Compare front and rear wheels','Inspect the wheels just after a stationary release.','Rear rims turn faster than the body while the rear tires skid. Front wheels roll more slowly at the actual body speed.',p=>p.releaseAt.t+.02,'running-gear',{},true),
    trial('Press harder','Inspect the launch after charging with 8 N of downward force.','Enough grip lets each push reach the selected wheel speed. Compare the stored energy and final range with the default 4 N press.',p=>p.releaseAt.t+.03,'machine',{press:8}),
    trial('Set it down still','Watch the start of the free run.','The body starts from rest while the flywheel is already spinning. Tire slip turns part of the stored energy into heat.',p=>p.releaseAt.t+.03),
    trial('Release while moving','Watch the launch at the end of the last push.','The body already moves at the chosen push speed. Speed matching differs from a stationary set-down, and the final range changes.',p=>p.releaseAt.t+.03,'experiment',{release:1}),
    trial('Inspect the two gear meshes','Inspect the stationary train before charging.','Count the large gear and small pinion in each pair. The middle pinion and gear turn together; the flywheel turns twelve times per rear-wheel revolution.',0,'transmission',{},true),
    trial('Use higher gearing','Read the completed run with a 24-to-1 ratio, six pushes and a 20 N press.','The flywheel presents greater effective inertia at the wheels. Charging needs more traction; a larger ratio alone does not guarantee a faster charge.',1e6,'machine',{gearing:2,press:20,pushes:6}),
    trial('Use lower gearing','Read the completed run with a 6-to-1 ratio.','The flywheel is easier to spin up but stores less energy at the same wheel speed. Compare its after-release range.',1e6,'machine',{gearing:0}),
    trial('Try slippery tiles','Watch the final charging stroke on tiles.','Lower assigned grip makes the rear wheels slip more during charging. The flywheel gains less speed.',p=>moment(p,'pushing',.8,true),'machine',{floor:0}),
    trial('Roll across carpet','Read the completed run on carpet.','The assigned carpet provides more charging grip but greater rolling resistance. Better grip does not necessarily mean a longer coast.',1e6,'machine',{floor:2}),
    trial('Make a gentle push','Read the completed run with a 0.5 m/s push.','A slower stroke requires less traction, but stores less energy at a given ratio.',1e6,'machine',{speed:.5}),
    trial('Make a faster push','Read the completed run with a 2.5 m/s push and a 20 N press.','A faster wheel speed can store more flywheel energy, provided the floor supplies enough traction.',1e6,'machine',{speed:2.5,press:20}),
    trial('Read the speed comparison','Inspect the complete speed record.','The two curves separate when rear tires slip. During an airborne carry, floor speed is zero while the driven wheels keep spinning.',1e6,'speed-chart',{},true),
    trial('Follow the energy','Inspect the energy account during an airborne carry.','Energy is shared between the flywheel, body motion, raised body and accumulated losses. The hand can also recover energy while slowing and lowering the toy.',p=>moment(p,'lifted'),'energy-chart',{},true),
    trial('Inspect the stopped result','Read the final energy account.','The flywheel, both axles and body are stopped. Net hand work has become the modeled losses; Play replays the selected settings.',1e6,'energy-chart',{},true),
  ],
  deeper:[
    {title:'Why a small flywheel matters',body:'Rotational kinetic energy is one half of the moment of inertia times angular speed squared. Gearing raises flywheel speed, so a small disk can store substantial energy. Its equivalent inertia at the wheel rims is I times the square of the ratio divided by wheel radius squared. This also makes a high ratio harder to charge.'},
    {title:'A supported, reversible train',body:'This model uses two pairs of spur gears on parallel shafts. The compound pinion and large gear share one hub; the final pinion is fixed to the flywheel shaft. When wheels charge the flywheel, the train increases speed. When the flywheel drives the wheels, the same train reduces speed and increases available wheel torque, with losses in either direction.'},
    {title:'Static grip and sliding friction',body:'Rolling without slip requires the tire contact to remain stationary relative to the floor. Static friction supplies whatever force is needed up to its limit. When rear-wheel rim speed differs from body speed, the tire slides and dissipates energy. The front axle is not geared to the flywheel and follows the body instead.'},
    {title:'Repeated pushes have a limit',body:'During a return the flywheel loses some speed to bearing friction. On touchdown its wheels can initially be faster than the body. The next push catches up and adds energy. If a stroke already has enough traction to reach the selected speed, more identical strokes do not raise that ceiling.'},
    {title:'The hand can take energy back',body:'Lifting raises gravitational potential energy. Carrying changes body speed as well. The hand supplies or absorbs that work; the ledger records its net contribution. The flywheel continues to lose energy in its bearings even when the tires are clear of the floor.'},
    {title:'Why release method changes range',body:'A stationary set-down spends part of the flywheel energy accelerating the body, with tire slip during speed matching. Releasing an already moving toy starts with additional body kinetic energy. The final range therefore reflects both charging and release conditions, rather than flywheel energy alone.'},
  ],
  misconception:'The floor supplies traction, not free energy. The hand charges a rotating flywheel; no spring or battery powers this toy.',
  limits:'Assigned illustrative toy: 120 g total translating mass, 30 mm wheels, and a solid steel flywheel 20 mm across and 4 mm thick. The two gear meshes use 6-, 12- or 24-to-1 overall ratios and 80% combined power transfer. Constant flywheel bearing friction is 40 µN m. Pushes cover 150 mm; prescribed hand-guided carries last 0.3 s and lift 20 mm. Normal load is assigned equally to the two axles; pitch, dynamic load transfer, bouncing, steering, air drag and rotational inertia of the wheels/gears are omitted. Front wheels coast freely while airborne. Surface coefficients and distances are illustrative, not measurements of a product or floor. Motion plays at one quarter of physical speed; parts above ten drawn turns per second are blurred. Tooth flanks use a 30° involute profile with small backlash; root fillets, deformation, wear and strength are not simulated.',
  sources:[
    {title:'Inertia motor vehicle: supported compound gear train and flywheel',url:'https://patents.google.com/patent/US3955429A/en'},
    {title:'OpenStax: moment of inertia and rotational kinetic energy',url:'https://openstax.org/books/university-physics-volume-1/pages/10-4-moment-of-inertia-and-rotational-kinetic-energy'},
    {title:'OpenStax: rolling motion',url:'https://openstax.org/books/university-physics-volume-1/pages/11-1-rolling-motion'},
    {title:'OpenStax: static and kinetic friction',url:'https://openstax.org/books/university-physics-volume-1/pages/6-2-friction'},
    {title:'KHK: involute tooth geometry and gear contact',url:'https://khkgears.net/new/gear_knowledge/gear_technical_reference/involute_gear_profile.html'},
  ],
  quiz:{
    question:'Why can the toy move forward after the hand lets go?',
    options:['Its spinning flywheel returns stored energy through the gears and rear wheels.','The floor creates new energy as the wheels turn.','A hidden spring unwinds inside the flywheel.'],
    answer:0,
    explanation:'The hand supplied the energy while charging. The flywheel returns some of it through the gear train; friction and other losses eventually bring the toy to rest.',
  },
};

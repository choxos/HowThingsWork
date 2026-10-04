import {ROBOT_DEFAULTS} from './robot-vacuum-physics.js';

const trial = (title, instruction, observe, part, time, settings = {}, view = 'front', isolate = false) => {
  const values = {...ROBOT_DEFAULTS, ...settings};
  return {title, instruction, observe, values, initialState: {settings: values, time}, reset: true, part, view, isolate, cutaway: true};
};
export const robotVacuumLesson = {
  simple: 'How can a robot vacuum clean around obstacles, avoid a floor edge, and return to recharge?',
  overview: 'Two driven wheels steer a small vacuum around the room. Brushes guide debris into a bin while a fan draws air through a filter. Sensors tell the controller when to stop and turn. Cleaning ends when its timer finishes or its battery reaches a reserve; the robot then finds a clear route back, aligns with its dock and recharges. Follow the working robot close up, inspect its parts, or switch to the whole-room view.',
  steps: [
    {title: 'Collect', body: 'The roller feeds the floor inlet. Debris stays in the bin, while air continues through the filter, blower and exhaust.'},
    {title: 'Steer', body: 'Equal wheel speeds move straight. Different speeds bend the path. Opposite speeds turn the robot in place.'},
    {title: 'Sense', body: 'Solid obstacles trigger a stop and retreat. Downward sensors detect a floor edge, which needs a different response from driving over an ordinary patch of floor.'},
    {title: 'Return', body: 'The selected cleaning time or a 15% battery reserve ends cleaning. Brushes and suction stop; the wheels bring the robot back around obstacles.'},
    {title: 'Recharge', body: 'The robot aligns with the dock and reverses onto its two charging contacts. A powered dock restores the battery; an unplugged dock cannot.'},
  ],
  parts: [
    {name: 'Body and bumper', role: 'Support and protect the mechanism.'},
    {name: 'Wheel drives', role: 'Two motorized wheels steer; a free support wheel swivels.'},
    {name: 'Brushes and suction path', role: 'Roller, side brush, inlet, bin, filter, blower and exhaust form one connected cleaning system.'},
    {name: 'Power and sensing', role: 'Battery, controller, floor sensors, dock receiver and contacts coordinate the mission.'},
    {name: 'Charging dock', role: 'Guide the final approach and provide charging power.'},
    {name: 'Room and coverage map', role: 'Show obstacles, a possible stairwell, and which floor cells passed under the main head.'},
  ],
  tryIt: [
    trial('A complete mission', 'Press Play to clean, return and recharge.', 'The close-up follows the robot. Open the whole-room inspection to see its route. Gold marks main-head passes; it does not claim every speck of dirt was removed.', 'robot', 0),
    trial('Opposite wheels turn', 'Inspect the two wheel drives, then advance one step.', 'Left wheel reverses while right wheel moves forward. Their spokes turn opposite ways, even though the center stays in place.', 'drive', 15),
    trial('Follow the suction path', 'Inspect the roller, bin, filter and blower.', 'Blue markers continue through the filter to the fan and exhaust. Collected debris stays in the bin. Brushes and suction stop when return travel begins.', 'cleaner', 30),
    trial('An obstacle stops it', 'Watch the first stop near a wall.', 'The proximity sensors highlight red. The robot backs away and turns; it does not pass through the wall.', 'robot', 14.34),
    trial('A floor edge is different', 'Inspect the robot beside the stairwell, then step forward.', 'Downward sensors detect missing floor. The robot retreats and turns while its wheels remain supported. This is an edge stop, not an obstacle bump.', 'robot', 59.64, {room: 2}),
    trial('Rows across an empty room', 'Compare the curves and their five-minute checkpoint.', 'This rows-first run passes its main head over about 85% of the exposed floor in five minutes. The comparison chart uses the same room for all three controllers.', 'charts', 300, {room: 0, strategy: 2}, 'front', true),
    trial('Random runs overlap', 'Compare this five-minute result with the rows preset.', 'This fixed random run reaches about 57% in the empty room. Runs repeatedly cross earlier paths. One seed and one room do not establish a universal speed ranking.', 'charts', 300, {room: 0}, 'front', true),
    trial('Furniture changes the route', 'Inspect the whole room at five minutes.', 'The sofa blocks travel and the table legs interrupt runs. This random run covers about 42% of exposed floor. Floor under the sofa and legs is excluded from the percentage.', 'system', 300, {}, 'top'),
    trial('A spiral uses unequal speeds', 'Inspect the wheels near the beginning of a spiral.', 'Both wheels move forward, but the outside wheel moves faster. The curved path straightens as the spiral widens; meeting an obstacle changes this controller to random bounce.', 'drive', 2.6, {strategy: 1, room: 0}),
    trial('Time to go home', 'Inspect the return route after five minutes.', 'Cleaning has stopped. The red route avoids obstacles, and coverage stays fixed while the wheel drives bring the robot back.', 'system', 301, {}, 'top'),
    trial('Low battery returns early', 'Begin with 20% battery and a five-minute cleaning timer.', 'The robot reaches its 15% reserve after about 3.4 minutes, so it returns before the timer ends. The reserve must still power its journey home.', 'system', 205.2, {charge: 0}, 'top'),
    trial('Align the charging contacts', 'Watch the final slow approach.', 'The beacon guides alignment. Both wheels reverse toward the dock; charging has not started because the underside contacts have not yet met its pads.', 'robot', 308.23),
    trial('Energy flows into the battery', 'Inspect the dock just after contact.', 'Both wheels and the cleaning mechanisms have stopped. The dock stores 20 W in the battery from a 25 W input; the assigned 5 W difference covers losses and docked electronics.', 'dock', 339.23),
    trial('An unplugged dock cannot charge', 'Inspect the same return with dock power disconnected.', 'The ideal stored dock location still permits alignment, but there is no infrared beacon and no charging. The mission ends with the battery below full.', 'dock', 310, {dockPower: 0}),
    trial('Returned and recharged', 'Inspect the completed mission, then press Play to repeat it.', 'The robot has returned to its starting pose and reached 100% battery. The coverage map stays unchanged during charging. Replay uses the selected settings.', 'robot', 900),
  ],
  deeper: [
    {title: 'Wheel motion sets the path', body: 'With wheel separation b, center speed is (left speed + right speed)/2 and turn rate is (right speed − left speed)/b. The model integrates each constant-speed interval as an exact circular arc. Equal and opposite speeds give zero center speed but a nonzero turn rate.'},
    {title: 'Sensing and planning have different jobs', body: 'The floor sensors ask whether supporting floor continues nearby. Obstacle sensors ask whether something blocks the body. A return planner asks which connected path reaches the dock. Real machines combine uncertain measurements and can make mistakes; this demonstration has an exact room map and pose.'},
    {title: 'A pass is not a cleanliness measurement', body: 'A 20 mm floor cell turns gold when its center enters the main cleaning-head rectangle. Side-brush contact alone is not counted. Every exposed cell stays in the denominator, including narrow strips and corners the robot may miss. Surface type, particle size and suction affect real pickup.'},
    {title: 'Why charging takes longer', body: 'Power is energy per second. Cleaning draws an assigned 33 W and returning 8 W; the dock stores 20 W. A five-minute clean uses 2.75 Wh before return travel. Restoring the same energy at 20 W takes more than eight minutes, although playback accelerates that interval.'},
  ],
  misconception: 'Returning to the dock does not prove the whole floor is clean. A timer or low battery can end a run with unvisited patches, and even a cleaning-head pass does not guarantee complete dirt removal.',
  limits: 'Illustrative robot and controllers, not a commercial product or safety simulation. Assigned dimensions: 340 mm body diameter, 230 mm wheel spacing, 35 mm wheel radius and a 210 × 45 mm main-head footprint centered 55 mm ahead of the wheel axle. A 4 × 3 m room uses 20 mm coverage cells. Ideal proximity sensing leaves 10 mm from solid obstacles; eight downward sensors conservatively reject a proposed 20 ms step into missing floor. Sensor reflectance errors, wheel slip, dynamic obstacles and pickup efficiency are omitted. Return navigation uses a known map, exact pose and an ideal dock beacon; with dock power off it uses the stored dock pose. Battery capacity is assigned as 37.44 Wh, with constant powers rather than motor-current or electrochemical models. Charging does not taper. Cleaning plays 30× real time, return travel 3× and charging 240×; brush and air-marker speeds are illustrative. Random turns use one fixed seed. The comparison chart continues each controller for 20 minutes with enough battery, independently of the selected mission cutoff.',
  sources: [
    {title: 'Modern Robotics: odometry', url: 'https://modernrobotics.northwestern.edu/nu-gm-book-resource/13-4-odometry/'},
    {title: 'iRobot 600 Series owner guide: parts and charging', url: 'https://www.shopirobot.com.au/media/wysiwyg/606userguide.pdf'},
    {title: 'iRobot: returning to the Home Base', url: 'https://homesupport.irobot.com/articles/en_US/Knowledge/10224'},
    {title: 'iRobot: navigation technologies', url: 'https://support.irobot.ca/articles/en_US/Knowledge/31056'},
  ],
  quiz: {
    question: 'The robot reaches its dock with only part of the floor covered. What could explain this?',
    options: ['Its cleaning timer ended or its battery reserve triggered a return.', 'Docking proves all exposed floor was cleaned.', 'Its wheels must have stopped turning whenever it changed direction.'],
    answer: 0,
    explanation: 'Returning is a control decision, not a cleanliness certificate. Check the timer, battery reserve and coverage result separately.',
  },
};

import {neighborhoodCatalog} from './catalog-data.js';
import {zoomMarkup, bindZoom, disposeZoom} from './zoom.js';
document.querySelectorAll('[data-entry-count]').forEach(node=>node.textContent=neighborhoodCatalog.entries.length);
document.querySelectorAll('[data-group-count]').forEach(node=>node.textContent=neighborhoodCatalog.groups.length);
const planApp = document.querySelector('#catalog-app');
const groupsById = new Map(neighborhoodCatalog.groups.map(group => [group.id, group]));
const placesById = new Map(neighborhoodCatalog.places.map(place => [place.id, place]));
const principlesById = new Map(neighborhoodCatalog.principles.map(principle => [principle.id, principle]));
const allEntries = neighborhoodCatalog.entries.map(entry => ({...entry, ...groupsById.get(entry.group), id: entry.id}));
const modeledNames = new Set(["Spark gap","Solenoid","Spark plug","Ignition-coil primary and secondary windings","Induction coil","Distributor","Contact-breaker ignition","Car ignition system","Power pylon","Power-line insulator","Home-supply transformer","Distribution transformer","Transmission transformer","Electricity transmission","Transformer turns ratio","Transformer","Generator slip rings","DC generator","AC generator","Electric generator","Laser scanning of 3D objects","Computer-aided design","Three-axis positioning","Layer-by-layer fabrication","Printer filament reel","Heated extrusion nozzle","3D printer","Stepper motor","Electric motor","Motor rotor","Universal motor",'Commutator','Direct-current motor','Electromagnet','Electric-horn moving iron bar','Horn make-and-break contacts','Electric horn','Vibrating horn diaphragm',...neighborhoodCatalog.places.flatMap(place=>place.featured),...allEntries.filter(entry=>entry.place==="home").map(entry=>entry.name)]);
const entriesById = new Map(allEntries.map(entry => [entry.id, entry]));
const entriesByName = new Map(allEntries.map(entry => [entry.name, entry]));
const filters = {query: '', place: '', room: '', principle: ''};
let listKind = 'entries';
let routePlace = '';
const escapeText = value => String(value).replace(/[&<>"']/g, character => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[character]));
const searchable = value => value.normalize('NFKD').replace(/\p{Diacritic}/gu,'').toLowerCase();
const shortName = name => ({'Digital single-lens reflex camera':'DSLR camera','Condenser microphone':'Microphone','Optical microscope':'Microscope','Combine harvester':'Combine harvester'}[name] || name);

function illustration(name) {
  const ink = '#42513c', wood = '#ba9165', clay = '#c77f5f', green = '#91a480', blue = '#8cb7bd', cream = '#eee3bd';
  const drawings = {
    'Sewing machine': `<path d="M22 95h135v13H22z" fill="${wood}"/><path d="M41 91V35q0-12 13-12h68q17 0 17 17v47h-25V58H65v33z" fill="${green}"/><circle cx="141" cy="45" r="15" fill="${cream}"/><path d="M63 58v23m-6 0h14m-18 15h38"/><path d="M79 23v-9h13v9" fill="${clay}"/>`,
    'Refrigerator': `<rect x="48" y="12" width="84" height="109" rx="8" fill="${green}"/><path d="M48 51h84M119 22v19m0 21v33"/><path d="M57 121v5m67-5v5"/><rect x="61" y="22" width="30" height="19" fill="${cream}"/>`,
    'Toaster': `<path d="M28 62q0-21 22-21h77q23 0 23 21v46H28z" fill="${clay}"/><path d="M48 40V23q15-18 31 0v17m10 0V23q15-18 31 0v17" fill="${cream}"/><path d="M42 108v7m93-7v7M139 63v28m-6-14h16"/><circle cx="52" cy="87" r="6" fill="${green}"/>`,
    'Cylinder lock': `<rect x="24" y="20" width="75" height="91" rx="8" fill="${wood}"/><circle cx="62" cy="64" r="22" fill="${cream}"/><path d="M58 61h29v8H58z" fill="${ink}"/><path d="M90 64h44m-7 0v10m-12-10v8" stroke-width="6"/><circle cx="146" cy="64" r="14" fill="none" stroke-width="6"/>`,
    'Quartz clock': `<circle cx="88" cy="67" r="48" fill="${clay}"/><circle cx="88" cy="67" r="40" fill="${cream}"/><path d="M88 34v6m33 27h-6m-27 33v-6m-33-27h6M88 67V46m0 21 20 10" stroke-width="4"/><circle cx="88" cy="67" r="4" fill="${ink}"/>`,
    'Vacuum cleaner': `<path d="M51 106l17-69h29l14 69z" fill="${green}"/><path d="M83 37V16h30" stroke-width="7" fill="none"/><path d="M38 104h84v13H38z" fill="${clay}"/><path d="M104 54q57-4 35 45" fill="none" stroke="${wood}" stroke-width="9"/><circle cx="48" cy="117" r="7" fill="${ink}"/><circle cx="111" cy="117" r="7" fill="${ink}"/>`,
    'Power drill': `<path d="M32 34h91v40H78l-9 40H45l7-40H32z" fill="${green}"/><path d="M123 40h23v28h-23z" fill="${wood}"/><path d="M146 54h27m-23-7 6 14m0-14 6 14m0-14 6 14" fill="none"/><path d="M36 44h27m-27 9h27m-6 21h14"/><path d="M50 114h28v7H42z" fill="${clay}"/>`,
    'Bicycle brake': `<circle cx="40" cy="89" r="29" fill="${cream}"/><circle cx="140" cy="89" r="29" fill="${cream}"/><path d="M40 89 69 48 95 89H40L61 69h64l15 20-18-55h19M69 48h-15m38 41 31-20M31 62l5-7 12 1 5 10" fill="none" stroke="${clay}" stroke-width="5"/><path d="M141 34q21 6 9 15m-11-7h-8" fill="none"/>`,
    'Tower crane': `<path d="M72 118V29h19v89M72 42l19 14-19 14 19 14-19 14 19 14M21 30H165V41H21z" fill="${cream}"/><path d="M30 30 79 11 155 30M118 41v41m0 0v12q0 13-11 7" fill="none"/><path d="M12 42h34v19H12zM103 104h29v18h-29z" fill="${clay}"/>`,
    '3D printer': `<path d="M33 116V22h113v94H33z" fill="${green}"/><path d="M45 34h89v66H45z" fill="${cream}"/><path d="M45 50h89M89 34v22" fill="none"/><path d="M78 52h23v15H78l11 12z" fill="${clay}"/><path d="M66 100v-9l23-12 23 12v9M66 91l23 9 23-9" fill="${wood}"/><path d="M46 110h86"/>`,
    'Differential': `<path d="M9 67h44m73 0h43" stroke="${wood}" stroke-width="13"/><circle cx="89" cy="67" r="38" fill="${green}"/><circle cx="89" cy="67" r="27" fill="${cream}"/><path d="M66 50l23 17-23 17zm46 0-23 17 23 17zM79 41l10 15 10-15M79 94l10-15 10 15" fill="${clay}"/>`,
    'Industrial robot': `<path d="M41 117h96v-15H41z" fill="${green}"/><path d="M78 100V73L45 45l22-28 52 24 18 32-18 10-21-28-34-17" fill="${clay}"/><circle cx="58" cy="31" r="12" fill="${cream}"/><circle cx="80" cy="74" r="12" fill="${cream}"/><path d="M135 74l18 11m-1-9 8 12-12 12" fill="none" stroke-width="5"/>`,
    'Computer': `<rect x="26" y="20" width="124" height="78" rx="6" fill="${green}"/><path d="M35 29h106v57H35z" fill="${blue}"/><path d="M83 98v12m-22 6h57M47 45h33m-33 10h70m-70 10h45" stroke="${cream}" stroke-width="5"/><path d="M32 115h110l12 12H20z" fill="${wood}"/>`,
    'Optical microscope': `<path d="M37 117h109v-13H37zM87 105V84q50-7 44-45" fill="${green}" stroke-width="9"/><path d="M65 21l23-11 27 48-24 12z" fill="${clay}"/><path d="M91 66l-8 14m-37 8h78m-43 2v14" fill="none" stroke-width="6"/><circle cx="130" cy="64" r="12" fill="${cream}"/>`,
    'Nuclear reactor': `<path d="M31 118V49a57 42 0 0 1 114 0v69z" fill="${green}"/><path d="M45 118V51a43 28 0 0 1 86 0v67z" fill="${cream}"/><path d="M64 76h46v35H64z" fill="${clay}"/><path d="M75 49v41m11-41v41m11-41v41" stroke-width="5"/><path d="M110 85h29v-18h19v39h-48" fill="none" stroke="${blue}" stroke-width="5"/>`,
    'Space probe': `<path d="M66 50h45v47H66z" fill="${wood}"/><path d="M8 52h48v39H8zM121 52h48v39h-48z" fill="${blue}"/><path d="M24 52v39m16-39v39m-32-19h48m81-20v39m16-39v39m-32-19h48" stroke-width="1.4"/><path d="M88 50V35m-28-8q29 31 59-2l-28-15z" fill="${cream}"/><path d="M89 10 94 1m-20 96-9 22m40-22 10 22"/>`,
    'MRI scanner': `<path d="M29 28h105q25 39 0 79H29z" fill="${green}"/><ellipse cx="130" cy="67" rx="31" ry="43" fill="${cream}"/><ellipse cx="130" cy="67" rx="19" ry="29" fill="${blue}"/><path d="M77 86h95v13H77zM105 99v23m49-23v23" fill="${wood}"/><path d="M43 43h26v12H43z" fill="${clay}"/>`,
    'Airplane': `<path d="M14 69l59-13 17-42h16l-6 40 57 10q17 6 0 13l-57 4 5 35H91L73 82 14 78z" fill="${cream}"/><path d="M73 57 39 28H23l30 37m21 17-39 21H20l31-27" fill="${clay}"/><path d="M115 63h12m-12 9h12" stroke="${blue}" stroke-width="5"/>`,
    'Windmill': `<path d="M68 116l9-69h29l9 69z" fill="${clay}"/><path d="M69 49l23-19 23 19z" fill="${wood}"/><path d="M92 56 50 17m42 39 40-41m-40 41 40 40m-40-40L49 97" stroke-width="6"/><path d="M48 14l-9 10 35 33 9-10zM133 11l11 11-35 33-11-11zM134 99l11-11-35-33-11 11zM47 101l-10-11 35-33 10 11z" fill="${cream}"/><circle cx="92" cy="56" r="6" fill="${green}"/>`,
    'Hot-air balloon': `<path d="M47 48a41 36 0 1 1 82 0q-7 27-32 47H79Q53 76 47 48z" fill="${clay}"/><path d="M88 13q-28 33-9 82h18q19-49-9-82z" fill="${cream}"/><path d="M79 95v13m18-13v13M73 109h30l-5 16H78z" fill="${wood}"/>`,
    'Quadcopter': `<path d="M86 71 45 39m45 34 46-34M87 73l-44 29m45-29 49 29" stroke="${clay}" stroke-width="9"/><ellipse cx="44" cy="37" rx="31" ry="8" fill="${green}"/><ellipse cx="137" cy="37" rx="31" ry="8" fill="${green}"/><ellipse cx="44" cy="101" rx="31" ry="8" fill="${green}"/><ellipse cx="137" cy="101" rx="31" ry="8" fill="${green}"/><path d="M71 57h34v28H71z" fill="${cream}"/><path d="M85 85v13h17v-10" fill="${wood}"/>`,
    'Combine harvester': `<path d="M32 45h69l17 32h37v30H24V69z" fill="${green}"/><path d="M103 41h33v35h-23z" fill="${blue}"/><path d="M35 35h53v13H35z" fill="${clay}"/><circle cx="61" cy="105" r="21" fill="${ink}"/><circle cx="129" cy="108" r="14" fill="${ink}"/><circle cx="61" cy="105" r="11" fill="${cream}"/><path d="M149 86h21v31h-29m13-26 13 24m-15-9h19M38 56 12 46" fill="none" stroke-width="5"/>`,
    'Lawn sprinkler': `<path d="M35 111h114M51 109V93h84v16" stroke="${wood}" stroke-width="7" fill="none"/><path d="M55 82h76v13H55z" fill="${green}"/><path d="M61 81q-47-48-45-8M77 79q-28-66-36-51M91 78V17m14 63q28-66 36-51m-22 52q47-48 45-8" fill="none" stroke="${blue}" stroke-width="3" stroke-dasharray="3 5"/>`,
    'Binoculars': `<path d="M39 32h33l9 62H23zM109 32h33l17 62h-58z" fill="${green}"/><ellipse cx="52" cy="94" rx="30" ry="21" fill="${blue}"/><ellipse cx="129" cy="94" rx="30" ry="21" fill="${blue}"/><path d="M70 61h42v18H70zM40 24h29v14H40zM111 24h29v14h-29z" fill="${wood}"/><path d="M41 87q10-7 19 0m59 0q10-7 19 0" stroke="${cream}" stroke-width="4"/>`,
    'Grand piano': `<path d="M33 81V39q0-25 25-22l82 18q14 4 8 25l-13 31H33z" fill="${wood}"/><path d="M33 80h113v21H33z" fill="${cream}"/><path d="M43 80v21m12-21v21m12-21v21m12-21v21m12-21v21m12-21v21m12-21v21m12-21v21M39 101v23m94-23v23"/><path d="M45 80v12m24-12v12m12-12v12m24-12v12m12-12v12" stroke-width="6"/><path d="M33 39 148 26 135 77" fill="${clay}"/>`,
    'Digital single-lens reflex camera': `<path d="M25 45h32l9-18h46l10 18h33v63H25z" fill="${green}"/><circle cx="91" cy="76" r="30" fill="${wood}"/><circle cx="91" cy="76" r="22" fill="${blue}"/><circle cx="85" cy="70" r="8" fill="${cream}"/><path d="M34 34h20v11H34zM126 54h16v11h-16z" fill="${clay}"/>`,
    'Printing press': `<path d="M27 28h125v82H27z" fill="${green}"/><path d="M39 37h100v57H39z" fill="${cream}"/><circle cx="63" cy="61" r="17" fill="${clay}"/><circle cx="111" cy="61" r="17" fill="${wood}"/><path d="M38 84h102l23 23H60z" fill="#faf2d6"/><path d="M64 91h55m-48 6h55M37 110v13m104-13v13"/>`,
    'Condenser microphone': `<rect x="68" y="17" width="43" height="63" rx="20" fill="${green}"/><path d="M58 49v14a32 32 0 0 0 64 0V49M90 95v24m-25 2h50" fill="none" stroke="${wood}" stroke-width="6"/><path d="M78 31h22M78 40h22M78 49h22M78 58h22" stroke="${cream}" stroke-width="3"/>`,
    'Violin': `<path d="M79 48q-34-5-31 20l13 11q-23 38 27 40 46-2 22-40l12-11q3-23-29-20" fill="${clay}"/><path d="M80 14h15v70H80z" fill="${wood}"/><path d="M79 14l-6-8h27l-5 8m-12 7v91m8-91v91m-18-7h30m26-85 20 99" fill="none"/><path d="M70 68q-8 10 1 22m37-22q8 10-1 22" fill="none" stroke-width="3"/>`,
    'Video projector': `<path d="M25 55l21-21h99v71H25z" fill="${green}"/><path d="M25 55h120M145 36l21 17v51h-21" fill="${wood}"/><circle cx="118" cy="79" r="16" fill="${blue}"/><path d="M37 71h42m-42 8h42m-42 8h42M41 105v10m101-10v10"/><path d="M55 43h29" stroke="${clay}" stroke-width="5"/>`,
    'Passenger boat': `<path d="M14 83h151l-23 29H40z" fill="${clay}"/><path d="M36 53h97v30H36zM56 32h62v21H56z" fill="${cream}"/><path d="M66 32V19h21v13" fill="${wood}"/><path d="M46 64h10m9 0h10m9 0h10m9 0h10m-48-22h11m12 0h11" stroke="${blue}" stroke-width="7"/><path d="M7 118q14-7 28 0t28 0t28 0t28 0t28 0t28 0" fill="none" stroke="${blue}"/>`,
    'Submarine': `<path d="M36 63h95q30 0 29 24t-29 25H36q-28 0-28-25t28-24z" fill="${green}"/><path d="M75 63V42h31v21M91 42V25h15" fill="${clay}"/><circle cx="47" cy="86" r="8" fill="${blue}"/><circle cx="80" cy="86" r="8" fill="${blue}"/><circle cx="113" cy="86" r="8" fill="${blue}"/><path d="M161 86h12m-1-13v27" fill="none" stroke-width="5"/>`,
    'Waterwheel': `<circle cx="89" cy="64" r="47" fill="${wood}"/><circle cx="89" cy="64" r="35" fill="${cream}"/><path d="M89 29v70M54 64h70M64 39l50 50m-50 0 50-50" stroke-width="5"/><circle cx="89" cy="64" r="9" fill="${clay}"/><path d="M15 115q14-7 28 0t28 0t28 0t28 0t28 0" fill="none" stroke="${blue}" stroke-width="4"/>`,
    'Yacht': `<path d="M32 96h126l-26 23H54z" fill="${wood}"/><path d="M94 94V10L44 84h49M101 22l43 66h-43z" fill="${cream}"/><path d="M43 83h50M105 33l15 26" stroke="${clay}" stroke-width="5"/><path d="M15 125q14-7 28 0t28 0t28 0t28 0t28 0" fill="none" stroke="${blue}"/>`,
    'Piston pump': `<path d="M56 113V48h44v65z" fill="${green}"/><path d="M69 48V28h53M61 73h34M100 58h33v20h-18" fill="none" stroke-width="8"/><path d="M48 113h61v10H48z" fill="${wood}"/><path d="M122 29h25" stroke="${clay}" stroke-width="10"/><path d="M124 83v12m0 5v4" stroke="${blue}" stroke-width="4"/>`,
    'Hydrofoil': `<path d="M21 65h138l-24 20H39z" fill="${clay}"/><path d="M45 44h65l15 21H45z" fill="${cream}"/><path d="M58 47h15v12H58zM83 47h15v12H83z" fill="${blue}"/><path d="M60 84l-12 28h31m43-28 12 28h-30" fill="none" stroke="${wood}" stroke-width="6"/><path d="M8 101q14-7 28 0t28 0t28 0t28 0t28 0t28 0" fill="none" stroke="${blue}"/>`
  };
  const drawing = drawings[name] || `<path d="M17 29q35-10 71 8 36-18 73-8v84q-37-10-73 8-36-18-71-8z" fill="${cream}"/><path d="M88 37v84M30 49l39 7m-39 7 39 7m-39 7 39 7m36-28 39-7m-39 21 39-7m-39 21 39-7" fill="none"/>`;
  return `<svg viewBox="0 0 180 135" aria-hidden="true" xmlns="http://www.w3.org/2000/svg"><ellipse cx="90" cy="125" rx="67" ry="5" fill="#b8ae8733"/><g stroke="${ink}" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">${drawing}</g></svg>`;
}

const sampleDescriptions = {
  'Sewing machine': 'A rotating motor drives a timed sequence of needle, hook, and fabric movements. Cams and cranks help form each stitch and advance the cloth.',
  'Refrigerator': 'A circulating refrigerant carries heat from the cold compartment to the room outside. The compressor supplies the work needed to move that heat.',
  'Toaster': 'Electrical resistance heats the elements around the bread. A timer or temperature-sensitive mechanism releases the spring-loaded rack.',
  'Cylinder lock': 'The slopes on the right key lift each pin pair until their gaps line up, freeing the cylinder to turn.',
  'Quartz clock': 'A vibrating quartz crystal supplies a regular timing signal. An electronic circuit divides those pulses to drive the hands or display.',
  'Vacuum cleaner': 'A fan creates a pressure difference that moves air into the cleaner. Dirt travels with that airflow and is trapped by the collection system.',
  'Power drill': 'The motor turns a cutting bit. Spiral grooves carry loosened material out of the hole as the bit advances.',
  'Bicycle brake': 'A set of levers transfers the squeeze of your hand to the brake blocks. Friction at the wheel turns motion into heat.',
  'Tower crane': 'The jib, trolley, pulleys, and counterweight work together to place a heavy load. The tower carries the lifting assembly above the building site.',
  '3D printer': 'Controlled motors move a printing head through three dimensions. Material is deposited in successive layers to build the shape.',
  'Differential': 'A set of gears lets the driving wheels rotate at different speeds, as they must when the car turns a corner.',
  'Industrial robot': 'Programmed instructions drive motors or hydraulic actuators. Sensors help the controller measure position and correct movement.',
  'Computer': 'Input devices provide data, memory stores it, and a processor follows instructions. Output devices turn the results into pictures, sound, text, or movement.',
  'Optical microscope': 'An objective lens forms an enlarged image of a nearby specimen. An eyepiece magnifies that image again.',
  'Nuclear reactor': 'Controlled fission releases heat in the reactor core. A coolant carries heat away, and a separate steam system can drive a turbine and generator.',
  'Space probe': 'Instruments collect observations while a radio link sends data over enormous distances. Onboard power and control systems let the probe work between instructions from Earth.',
  'MRI scanner': 'A strong magnetic field and radio pulses produce signals from atomic nuclei in the body. A computer uses the measured signals to form an image.',
  'Airplane': 'The wings produce lift as air flows around them. Hinged control surfaces change the forces on the aircraft to turn, climb, descend, or roll.',
  'Windmill': 'Wind moves the sails, turning a central shaft. Gears transmit that rotation to machinery such as a pump or grindstone.',
  'Hot-air balloon': 'Heating the air inside the envelope lowers its density. The surrounding air supplies the buoyant force that can lift the balloon and basket.',
  'Quadcopter': 'Four controlled rotors produce lift. Changing their relative thrusts tilts and turns the craft, while opposite rotations help balance reaction torques.',
  'Combine harvester': 'Several linked mechanisms cut the crop, separate the grain, and move it into storage. Augers transport material through the machine.',
  'Lawn sprinkler': 'Incoming water drives a small turbine. Reduction gears and a crank turn that fast rotation into a slow sweep of the spray tube.',
  'Binoculars': 'Two small telescopes provide separate views for the eyes. Prisms fold the light path and turn the images the right way up.',
  'Grand piano': 'Pressing a key moves a linked set of levers, sending a hammer toward a string. Dampers and pedals control how the strings continue to vibrate.',
  'Digital single-lens reflex camera': 'A mirror directs the lens image into the viewfinder. When a picture is taken, the mirror moves aside and the shutter exposes the sensor.',
  'Printing press': 'Rotating cylinders transfer ink from printing plates onto moving paper. Separate color units build up the final image.',
  'Condenser microphone': 'Sound moves a thin diaphragm beside another plate. The changing electrical capacitance is converted into a signal that follows the sound.',
  'Violin': 'A bowed string vibrates, and the body of the violin helps radiate that vibration as sound. String length, tension, and mass affect pitch.',
  'Video projector': 'Light is controlled pixel by pixel and focused onto a screen. LCD panels control transmitted light; DLP chips use tiny tilting mirrors.',
  'Passenger boat': 'The hull displaces enough water to support the boat’s weight. Propellers, rudders, and thrusters control how the vessel moves.',
  'Submarine': 'Ballast tanks change the submarine’s weight and buoyancy. Hydroplanes help control depth while it moves through the water.',
  'Waterwheel': 'Flowing or falling water pushes the wheel’s paddles. The turning axle passes that energy to a connected machine.',
  'Yacht': 'Sails interact with the wind while the hull and keel interact with the water. Together these forces let the boat sail across the wind and tack toward it.',
  'Piston pump': 'A piston changes the volume of a chamber. Valves direct the flow so repeated strokes draw fluid in and push it out.',
  'Hydrofoil': 'Submerged foils generate lift as the boat gains speed. Raising the hull out of the water reduces the drag acting on it.'
};

function mapView(place) {
  return zoomMarkup(place);
}

function filterControls(list=false) {
  const scoped = filters.place ? allEntries.filter(entry=>entry.place===filters.place) : allEntries;
  const rooms = [...new Set(scoped.map(entry=>entry.room))].sort();
  return `<div class="filters ${list?'list-filters':''}"><div class="filter"><label for="catalog-search">Find a machine or idea</label><input id="catalog-search" type="search" placeholder="Try sewing machine, satellite, or gears" value="${escapeText(filters.query)}"></div>${list?`<div class="filter"><label for="place-filter">Place</label><select id="place-filter"><option value="">Everywhere</option>${neighborhoodCatalog.places.map(p=>`<option value="${p.id}" ${filters.place===p.id?'selected':''}>${escapeText(p.name)}</option>`).join('')}</select></div>`:''}<div class="filter"><label for="room-filter">Room or area</label><select id="room-filter"><option value="">All rooms</option>${rooms.map(room=>`<option ${filters.room===room?'selected':''}>${escapeText(room)}</option>`).join('')}</select></div><div class="filter"><label for="principle-filter">Principle</label><select id="principle-filter"><option value="">All principles</option>${neighborhoodCatalog.principles.map(c=>`<option value="${c.id}" ${filters.principle===c.id?'selected':''}>${escapeText(c.name)}</option>`).join('')}</select></div></div>`;
}

function filteredEntries() {
  const query = searchable(filters.query.trim());
  return allEntries.filter(entry => (location.hash!=='#list'||listKind!=='models'||modeledNames.has(entry.name)) && (!filters.place || entry.place===filters.place) && (!filters.room || entry.room===filters.room) && (!filters.principle || entry.principle===filters.principle) && (!query || searchable([entry.name,entry.room,principlesById.get(entry.principle)?.name || ''].join(' ')).includes(query)));
}

function renderResults() {
  const container = document.querySelector('#results');
  if (!container) return;
  const entries = filteredEntries();
  const onList = location.hash === '#list';
  document.querySelector('#result-count').textContent = `${entries.length} of ${filters.place ? allEntries.filter(e=>e.place===filters.place).length : allEntries.length} machines, components & ideas`;
  if (!entries.length) {
    container.innerHTML = '<p class="no-results">No entries match these filters. Try a shorter search or choose “All rooms” and “All principles.”</p>';
    return;
  }
  if (onList) {
    container.innerHTML = `<table class="catalog-table"><thead><tr><th scope="col">Machine or idea</th><th scope="col">Find it in</th><th scope="col">Principle</th></tr></thead><tbody>${entries.map(entry=>`<tr><td><button data-entry="${entry.id}">${escapeText(entry.name)}</button><small>${modeledNames.has(entry.name)?'3D discovery':'Catalogued'}</small></td><td><a href="#place/${entry.place}">${escapeText(placesById.get(entry.place).name)}</a><small>${escapeText(entry.room)}</small></td><td>${escapeText(principlesById.get(entry.principle)?.name || 'General ideas')}</td></tr>`).join('')}</tbody></table>`;
  } else {
    const grouped = new Map();
    entries.forEach(entry => { const list=grouped.get(entry.group)||[];list.push(entry);grouped.set(entry.group,list); });
    container.innerHTML = `<div class="group-grid">${[...grouped.values()].map(items=>`<section class="machine-group"><h3>${escapeText(items[0].items[0])}</h3><p class="group-meta">${escapeText(items[0].room)}</p><div class="entry-links">${items.map(entry=>`<button class="entry-link" data-entry="${entry.id}">${escapeText(entry.name)}</button>`).join('')}</div></section>`).join('')}</div>`;
  }
}

function bindFilters() {
  document.querySelector('#catalog-search')?.addEventListener('input', event=>{filters.query=event.target.value;renderResults();});
  document.querySelector('#room-filter')?.addEventListener('change', event=>{filters.room=event.target.value;renderResults();});
  document.querySelector('#principle-filter')?.addEventListener('change', event=>{filters.principle=event.target.value;renderResults();});
  document.querySelector('#place-filter')?.addEventListener('change', event=>{
    filters.place=event.target.value;filters.room='';
    const rooms=[...new Set(allEntries.filter(entry=>!filters.place||entry.place===filters.place).map(entry=>entry.room))].sort();
    document.querySelector('#room-filter').innerHTML='<option value="">All rooms</option>'+rooms.map(room=>`<option>${escapeText(room)}</option>`).join('');
    renderResults();
  });
}

function showListBody() {
  document.querySelectorAll('[data-list-kind]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.listKind===listKind)));
  document.querySelector('#list-body').innerHTML=filterControls(true)+'<p class="result-count" id="result-count" role="status"></p><div id="results"></div>';
  bindFilters();renderResults();
}

let housePage=null,houseGeneration=0;
async function renderPlan() {
  if(location.hash.startsWith('#/topic/')){
    location.replace(`studies.html${location.hash}`);
    return;
  }
  const generation=++houseGeneration;
  housePage?.dispose();housePage=null;
  disposeZoom();
  const route=location.hash.replace(/^#/, '');
  const routeEntry=route.startsWith('machine/')?entriesById.get(route.slice(8)):null;
  if(route==='place/home'||route.startsWith('room/')||route==='assembly/front-door'||routeEntry){
    const {mountHouse}=await import('./house.js');
    if(generation!==houseGeneration)return;
    housePage=mountHouse(planApp,route,neighborhoodCatalog);
    if(housePage){document.querySelector('#map-link').setAttribute('aria-current','page');document.querySelector('#list-link').setAttribute('aria-current','false');return;}
  }
  routePlace=routeEntry?.place||(route.startsWith('place/')?route.slice(6):'');
  const place=placesById.get(routePlace);
  const onList=route==='list';
  document.querySelector('#map-link').setAttribute('aria-current',onList?'false':'page');
  document.querySelector('#list-link').setAttribute('aria-current',onList?'page':'false');
  filters.query='';filters.room='';filters.principle='';filters.place=place?.id||'';
  if(onList) {
    planApp.innerHTML='<span class="badge">Explore the collection</span><h1 class="list-title" tabindex="-1">Every machine has a place.</h1><p class="list-intro">Browse the whole collection, or find something familiar. The list and the neighborhood lead to the same discoveries.</p><div class="reference-tools"><button data-list-kind="entries" aria-pressed="true">Machines & ideas</button><button data-list-kind="models" aria-pressed="false">3D discoveries · '+modeledNames.size+'</button></div><section id="list-body" aria-label="Machine catalog"></section>';
    document.querySelectorAll('[data-list-kind]').forEach(button=>button.addEventListener('click',()=>{listKind=button.dataset.listKind;showListBody();}));
    showListBody();
  } else if(place) {
    const count=allEntries.filter(entry=>entry.place===place.id).length;
    const rooms=[...new Set(neighborhoodCatalog.groups.filter(group=>group.place===place.id).map(group=>group.room))];
    planApp.innerHTML=`<div class="plan-layout"><section class="plan-intro"><a class="back" href="#neighborhood">← Back to the neighborhood</a><h1 class="place-title" tabindex="-1">${escapeText(place.name)}</h1><p class="intro">${escapeText(place.description)}</p><p class="room-summary">${rooms.length} rooms and areas · ${count} catalogued entries</p><a class="page-link" href="#list">See the full list</a><p class="plan-note">Scroll or pinch toward a machine. Zoom back out to return to the neighborhood.</p></section>${mapView(place)}</div><section class="collection" aria-label="All machines in ${escapeText(place.name)}"><div class="collection-heading"><div><h2>Keep looking around.</h2><p>Pick a room, or browse everything in this place.</p></div></div>${filterControls()}<p class="result-count" id="result-count" role="status"></p><div id="results"></div></section>`;
    bindFilters();renderResults();
  } else {
    planApp.innerHTML=`<div class="plan-layout"><section class="plan-intro"><span class="badge">Explore the neighborhood</span><h1 tabindex="-1">A little neighborhood.<br>A world to discover.</h1><p class="intro">Zoom toward a place. Watch its walls fade away, then move closer to a machine to look inside.</p><a class="primary" href="#list">Browse all machines & ideas</a><p class="plan-note">Explore the house with working mechanisms and component close-ups, plus 3D models across the neighborhood. Other catalog entries remain reading topics.</p></section>${mapView()}</div><section class="place-directory" aria-label="Places in the neighborhood">${neighborhoodCatalog.places.map(p=>`<a class="directory-item" href="#place/${p.id}"><span class="color-dot" style="background:${p.color}" aria-hidden="true"></span><div><h2>${escapeText(p.name)}</h2><p>${escapeText(p.description)}</p></div></a>`).join('')}</section>`;
  }
  if (!onList) bindZoom(place,routeEntry);
  document.title=`${onList?'All machines & ideas':routeEntry?routeEntry.name:place?place.name:'The whole neighborhood'} · How Things Work`;
  document.querySelector('h1').focus({preventScroll:true});
  window.scrollTo({top:0,behavior:'instant'});
}

function showDetails(id) {
  if(entriesById.has(id))location.hash=`machine/${id}`;
}
planApp.addEventListener('click',event=>{const button=event.target.closest('button[data-entry]');if(button)showDetails(button.dataset.entry);});
document.querySelector('#about').addEventListener('click',()=>document.querySelector('#plan-about').showModal());
document.querySelectorAll('dialog .close').forEach(button=>button.addEventListener('click',()=>button.closest('dialog').close()));
addEventListener('hashchange',renderPlan);
renderPlan();

export {allEntries, entriesByName, placesById, principlesById, escapeText, shortName, illustration, sampleDescriptions, renderPlan};

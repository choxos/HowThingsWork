import {printerLesson} from './printer-lesson.js';

export const heatedNozzleLesson={
 simple:'Why does a nozzle need both heat and filament feed to lay a bead? Follow solid filament through the cutaway hotend and compare its incoming speed with the plastic leaving it.',
 overview:'The feed gear grips solid filament against an idler and pushes it into the hotend. The cold side guides the filament; a narrow heat break limits heat spreading upward. An electrical heater warms the lower block so the plastic can soften. Pressure supplied by the advancing filament drives this material through the narrowing nozzle onto the print. Follow the connected feed rollers, central material path and growing bead in this close-up.',
 steps:[
  {title:'Grip the solid filament',body:'Find the two rollers above the hotend. The driven gear pushes filament downward while the idler holds it against the gear. Their rotation follows filament consumption, which is slower than the nozzle moving across the plate.'},
  {title:'Keep the upper feed path firm',body:'The finned cold side and narrow heat break separate the guided incoming filament from the heated lower region. This cutaway exposes the central bore; the material stays inside that passage.'},
  {title:'Wait for the heater',body:'Run the first experiment from a cold nozzle. Actual temperature rises toward the target while flow remains zero. The 170 degree permission threshold belongs to this illustrative controller; it is not a universal melting point. The lower material color is only a qualitative cue for the heated region.'},
  {title:'Push softened material through the outlet',body:'Once feed is permitted, the rollers advance filament and the moving nozzle lays material along the prepared path. The model begins primed. Incoming volume and deposited volume are equal, without a pressure delay or stored melt calculation.'},
  {title:'Match feed to the bead',body:'Compare Plastic flow with Filament feed while a line is being deposited. A thicker bead needs more volume for each millimeter of travel. Slower travel needs less volume each second. Both rates drop to zero on nondepositing travel and at completion.'},
  {title:'Inspect what the nozzle made',body:'Run the job to completion and inspect the printed tray. Its base and walls are accumulated deposited paths. The missing-filament experiment preserves a partial tray while demonstrating why a hot nozzle alone cannot supply new material.'},
 ],
 parts:[
  {name:'Feed gear and idler',role:'Grip incoming filament and advance it into the heated path.'},
  {name:'Cold side and heat break',role:'Guide firm filament above the region intended to soften it.'},
  {name:'Heater and melt block',role:'Supply heat to the lower material path; actual temperature takes time to change.'},
  {name:'Narrowing nozzle and outlet',role:'Carry softened material to the bead laid on the moving plate.'},
  {name:'Deposited bead',role:'Records actual extrusion and remains attached to the growing tray.'},
 ],
 tryIt:[
  {title:'Heat and feed a bead',instruction:'Run from a cold hotend while watching the central bore and the two flow readings.',observe:'Flow remains zero during heating. Once permitted, the rollers feed about 0.998 mm of filament per simulated second while depositing at 2.40 mm³/s. Travel between beads pauses extrusion.',reset:true,part:'extruder',view:'front',isolate:false,values:{temperature:200,loaded:1,layerHeight:.2,speed:20}},
  {title:'Keep the nozzle too cold',instruction:'Try to extrude with a target below the controller threshold. Then raise the target to 200 degrees and run.',observe:'The cold interlock holds both feed and deposition at zero. Correcting the target allows warmup before the first bead appears.',reset:true,part:'extruder',view:'front',isolate:false,values:{temperature:160,loaded:1,layerHeight:.2,speed:20}},
  {title:'Keep heat but remove the supply',instruction:'This setup first prints part of the tray, then reports missing filament. Run, inspect the preserved material, and reload filament to continue.',observe:'The nozzle is already warm, but the missing-material interlock prevents new feed or deposition. Reloading continues the unfinished bead and eventually completes the same tray.',reset:true,initialState:{partiallyPrinted:true},part:'extruder',view:'front',isolate:false,values:{temperature:200,loaded:0,layerHeight:.2,speed:20}},
  {title:'Halve the required flow',instruction:'Run the same fine-layer job at half the path speed and compare the readings during deposition.',observe:'Plastic flow is 1.20 mm³/s and incoming filament speed is about 0.499 mm/s. Both halve, but the completed tray still requires the same total supplied volume.',reset:true,part:'extruder',view:'front',isolate:false,values:{temperature:200,loaded:1,layerHeight:.2,speed:10}},
  {title:'Feed a thicker bead',instruction:'Start a new job with twice the layer height at the original path speed.',observe:'The rectangular bead area doubles, so deposition needs 4.80 mm³/s and about 1.996 mm/s of filament feed. Six layers replace twelve while retaining the same tray height and total nominal volume.',reset:true,part:'extruder',view:'front',isolate:false,values:{temperature:200,loaded:1,layerHeight:.4,speed:20}},
 ],
 deeper:[
  {title:'Two speeds connected by volume',body:'In this rectangular-bead approximation, plastic flow equals bead width times layer height times depositing path speed. Divide this flow by the circular area of the incoming 1.75-mm filament to obtain its feed speed. A thin bead can therefore be laid quickly while the thicker filament enters slowly.'},
  {title:'Heat makes flow possible; feed supplies pressure',body:'A real hotend has a finite heating and flow capacity. The needed pressure depends on material and temperature as well as nozzle geometry and flow rate. This model explains the connected path but does not calculate pressure, viscosity or maximum throughput.'},
  {title:'The missing-filament setup is simplified',body:'The sensor state hides the modeled supply and primed bore and immediately pauses the job. A real nozzle may retain melt or ooze after upstream filament runs out. Those reservoir and delay effects are omitted here.'},
  {title:'A paused rate is a frozen snapshot',body:'Pause freezes temperature, feed, motion and deposition together. The displayed instantaneous rates describe that frozen simulated state; no new volume accumulates until playback resumes.'},
 ],
 misconception:'Heating does not pull the reel or create plastic. Advancing filament supplies material and pressure, while heat enables the material to soften.',
 limits:printerLesson.limits,
 sources:[...printerLesson.sources,{title:'Prusa: maximum volumetric speed and bead flow',url:'https://help.prusa3d.com/article/max-volumetric-speed_127176'}],
 quiz:{question:'At the same bead size, what happens when depositing path speed is halved?',options:['Required plastic flow and filament feed speed both halve.','The nozzle creates the missing plastic from heat.','Filament must enter twice as fast.'],answer:0,explanation:'Each millimeter of path still needs the same bead volume. Covering half as many millimeters per second requires half the incoming volume per second.'},
};

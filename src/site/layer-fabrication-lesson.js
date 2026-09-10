import {printerLesson} from './printer-lesson.js';

export const layerFabricationLesson={
 simple:'How do flat paths become a three-dimensional object? Build a tray, then pause at its finished base and distinguish moving to a new layer from actually depositing that layer.',
 overview:'A prepared print is a sequence of paths grouped by height. The nozzle lays a bead along the depositing paths and travels without material between them. Once the paths of a layer are complete, a screw raises the head for the next layer. The base of this tray uses filled paths; the upper layers follow its perimeter and leave the center open. The object is the accumulated history of actual deposition on the moving plate.',
 steps:[
  {title:'Start with an empty plate',body:'Run the fine-layer experiment. Heating comes first, so the active layer may already say 1 while Completed layers and Printed height remain zero. A layer number does not make material appear.'},
  {title:'Trace a layer instead of revealing a sheet',body:'The nozzle first traces the outer boundary, then fills the base with connected lines. Each bead grows only along the depositing distance already traveled. A partially completed layer is visible as a partial set of paths.'},
  {title:'Stop at the completed base',body:'Choose the finished-base setup. It has already deposited two fine layers, totaling a 0.4-mm base and 60.048 cubic millimeters of nominal material. Its next planned layer is 3, but Completed layers is still 2. The upper walls have not appeared.'},
  {title:'Raise the head without adding plastic',body:'Advance one step from that base setup. The head rises and travels toward the first wall path while Printed height stays 0.40 mm and deposited volume stays unchanged. Motion into a new plane is not itself deposition.'},
  {title:'Deposit the next wall',body:'Advance again or run. The first upper wall bead starts growing at the new height. Printed height can rise before Completed layers does, because the rest of that layer still needs its own paths. The empty center of these wall layers is intentional.'},
  {title:'Compare complete jobs',body:'A 0.2-mm layer height needs twelve layers to reach 2.4 mm; a 0.4-mm layer height needs six. Both jobs retain the same 0.4-mm base and final nominal material volume. Changing layer height starts a newly prepared job and clears old material.'},
 ],
 parts:[
  {name:'Prepared layer paths',role:'Specify where to deposit and where to travel without material at each height.'},
  {name:'Nozzle and supplied bead',role:'Add material only during actual extrusion along a path.'},
  {name:'Moving build plate',role:'Carries every earlier bead as one deposited history.'},
  {name:'Z screw and gantry',role:'Raise the head for the next discrete layer.'},
  {name:'Filled base and perimeter walls',role:'Make the useful open tray from different path patterns at different heights.'},
 ],
 tryIt:[
  {title:'Build twelve fine layers',instruction:'Start from a cold nozzle and empty plate with 0.2-mm layers. Run the complete tray.',observe:'Individual paths form the base and then the walls. Twelve completed layers reach a printed height of 2.40 mm; the object does not appear as twelve ready-made sheets.',reset:true,part:'bed',isolate:false,values:{temperature:200,loaded:1,layerHeight:.2,speed:20}},
  {title:'Continue above the finished base',instruction:'This setup has already printed the complete 0.4-mm base. Advance one step to watch the lift and travel, then advance again to begin the upper wall.',observe:'At first there are two completed layers, 0.40 mm of printed height and 60.05 mm³ of displayed material. The first step moves the head without changing those values. Later deposition raises the printed height while the third layer is still incomplete.',reset:true,initialState:{basePrinted:true},part:'print',isolate:false,values:{temperature:200,loaded:1,layerHeight:.2,speed:20}},
  {title:'Build six coarse layers',instruction:'Start a new 0.4-mm-layer job and compare its finished tray with the fine-layer result.',observe:'Six completed layers reach the same 2.40-mm height. A single layer forms the 0.4-mm base. Thicker individual beads and fewer paths still deliver the same nominal total volume in this prepared design.',reset:true,part:'bed',isolate:false,values:{temperature:200,loaded:1,layerHeight:.4,speed:20}},
  {title:'Resume a partial layer',instruction:'This setup prints part of the job, then reports missing filament. Run to observe the stop; load filament and continue.',observe:'The partial layer and every earlier bead remain on the plate during the interruption. Restoring material continues the same unfinished path, then completes the remaining layers without duplicating the partial print.',reset:true,initialState:{partiallyPrinted:true},part:'print',isolate:false,values:{temperature:200,loaded:0,layerHeight:.2,speed:20}},
 ],
 deeper:[
  {title:'Three different measures of progress',body:'Active layer identifies the current or next planned layer. Completed layers counts layers whose planned paths have finished. Printed height measures the material that is already present. A lift or partly deposited upper layer can make these measures differ without any inconsistency.'},
  {title:'A layer need not be solid throughout',body:'The lower tray layers have interior paths because the base must be filled. Its upper layers contain only the wall perimeter. Leaving the center empty is the intended geometry, not a missing section of material.'},
  {title:'Finer layers change vertical sampling',body:'Thinner layers can represent height changes more finely, but do not automatically improve every horizontal detail, material strength or surface property. This flat-walled tray provides a controlled layer-count comparison; it does not predict print quality for arbitrary shapes.'},
  {title:'Changing settings does not rewrite history',body:'Speed or temperature changes preserve already deposited material. Layer height changes the planned job and therefore starts a new print. The displayed tray is never stretched to impersonate a different layer plan.'},
 ],
 misconception:'Raising the nozzle to the next layer does not create that layer. The next paths must actually receive material before they become part of the object.',
 limits:printerLesson.limits+' These are discrete horizontal layers, not continuous-Z spiral-vase printing. The finished-base setup executes the normal path prefix and stops before its next lift. A completed-layer count is distinct from the active layer. Layer comparisons do not establish watertightness, bonding, strength or general print quality.',
 sources:printerLesson.sources,
 quiz:{question:'The head has risen above a completed base, but no new material has left the nozzle. Has the tray become taller?',options:['No. Its printed height changes only when new material is deposited.','Yes. Nozzle height and printed height are always identical.','Yes. Selecting the next layer creates it automatically.'],answer:0,explanation:'Nondepositing travel changes the tool position while preserving the existing object. The upper layer begins only when its own bead is laid.'},
};

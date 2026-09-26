import {Box3,Vector3} from 'three';
import {createSiphonModel} from './siphon-model.js';
import {createPolarizedLightModel} from './polarized-light-model.js';
import {createLCDModel} from './lcd-model.js';
import {rotatingSprayArmLesson} from './dishwasher-lessons.js';
import {createDishwasherModel} from './dishwasher-model.js';
import {createRefrigerantCompressorModel} from './refrigerant-compressor-model.js';
import {refrigerantCompressorLesson} from './refrigerator-lessons.js';
import {anchorEscapementLesson} from './pendulum-clock-lessons.js';
import {leverEscapementLesson, hairspringLesson} from './watch-lessons.js';
import {quartzOscillatorLesson, piezoelectricityLesson} from './quartz-lessons.js';
import {electrostaticPrecipitatorLesson, ionizerLesson} from './air-cleaner-lessons.js';
import {joystickLesson, videoGamesConsoleLesson} from './games-controller-lessons.js';
import {headTrackingLesson} from './vr-headset-lessons.js';
import {capillaryActionLesson} from './pens-lessons.js';
import {cdLesson, dvdLesson, cdRomLesson, opticalReadoutLesson} from './optical-lessons.js';
import {electronicInkLesson, electrowettingLesson, eReaderLesson} from './epaper-lessons.js';
import {accelerometerLesson, vibrationMotorLesson} from './phone-lessons.js';
import {infraredSignalingLesson, diodeLesson, lightEmittingDiodeLesson, photodiodeLesson} from './remote-lessons.js';
import {rgbSubpixelsLesson, oledDisplayLesson} from './lcd-lessons.js';
import {polarizingFilterLesson, liquidCrystalsLesson, polarizingSunglassesLesson, binocularPrismsLesson} from './polarizers-lessons.js';
import {acGeneratorLesson, dcGeneratorLesson, generatorSlipRingsLesson} from './grid-generator-lessons.js';
import {transformerTurnsRatioLesson, transmissionTransformerLesson, distributionTransformerLesson, homeSupplyTransformerLesson} from './grid-transformer-lessons.js';
import {powerLineInsulatorLesson, powerPylonLesson} from './grid-line-lessons.js';
import {phonemesLesson} from './speech-lessons.js';
import {createCrashSensorModel} from './crash-sensor-model.js';
import {createPrinterModel} from './printer-model.js';
import {createSewingModel} from './sewing-model.js';
import {layerFabricationLesson} from './layer-fabrication-lesson.js';
import {printerReelLesson} from './printer-reel-lesson.js';
import {heatedNozzleLesson} from './heated-nozzle-lesson.js';
import {motorRotorLesson} from './motor-rotor-lesson.js';
import {commutatorLesson} from './commutator-lesson.js';
import {electricMotorLesson} from './electric-motor-lesson.js';
import {bellComponentLessons} from './bell-component-lessons.js';
import {createBellModel} from './bell-model.js';
import {hornComponentLessons} from './horn-component-lessons.js';
import {createHornModel} from './horn-model.js';
import {shadeComponentLessons} from './shade-component-lessons.js';
import {createWindowShadeModel} from './window-shade-model.js';
import {zipperComponentLessons} from './zipper-component-lessons.js';
import {createZipperModel} from './zipper-model.js';
import {utilityComponentLessons} from './utility-lessons.js';
import {cylinderComponentLessons} from './cylinder-component-lessons.js';
import {leverComponentLessons} from './lever-component-lessons.js';
import {createLeverModel} from './lever-model.js';
import {createCylinderModel} from './cylinder-model.js';
import {microchipDecelerationSensorLesson} from './microchip-deceleration-sensor-lesson.js';
import {crashSensorProofSquareAndSensingStripsLesson} from './crash-sensor-proof-square-and-sensing-strips-lesson.js';
import {scaleCalibratingPlateLesson} from './scale-calibrating-plate-lesson.js';
import {createBathroomScaleModel} from './bathroom-scale-model.js';
import {ionizationDetectorLesson, opticalDetectorLesson} from './smoke-lessons.js';
import {passiveInfraredLesson} from './intruder-lessons.js';
export const houseComponents={
 'Crash-sensor proof square and sensing strips':{machine:'Crash sensor',createModel:()=>createCrashSensorModel({mechanicsLesson:true}),part:'chip',view:'iso',isolate:true,lesson:crashSensorProofSquareAndSensingStripsLesson,intro:crashSensorProofSquareAndSensingStripsLesson.simple},
 'Microchip deceleration sensor':{machine:'Crash sensor',part:'chip',redirectTo:'crash-sensor',lesson:microchipDecelerationSensorLesson},
 'Layer-by-layer fabrication':{machine:'3D printer',createModel:()=>createPrinterModel({layerFabrication:true}),initialState:{partiallyPrinted:true},part:'bed',isolate:false,lesson:layerFabricationLesson,intro:layerFabricationLesson.simple},
 'Printer filament reel':{machine:'3D printer',createModel:()=>createPrinterModel({reelLesson:true}),part:'filament',isolate:false,lesson:printerReelLesson,intro:printerReelLesson.simple},
 'Heated extrusion nozzle':{machine:'3D printer',createModel:()=>{const model=createPrinterModel();model.playback.label='Run heated extrusion';return model;},part:'extruder',view:'front',isolate:false,lesson:heatedNozzleLesson,intro:heatedNozzleLesson.simple},
 'Motor rotor':{machine:'Universal motor',part:'rotor',view:'back',isolate:false,lesson:motorRotorLesson,intro:motorRotorLesson.simple},
 'Electric motor':{machine:'Direct-current motor',part:'system',redirectTo:'direct-current-motor',lesson:electricMotorLesson},
 'Commutator':{machine:'Direct-current motor',part:'commutator',view:'back',isolate:false,lesson:commutatorLesson,intro:commutatorLesson.simple},
 'Horn make-and-break contacts':{machine:'Electric horn',createModel:()=>{const model=createHornModel();model.resultPart.focusOnComplete=false;return model;},part:'contacts',view:'front',isolate:false,lesson:hornComponentLessons['Horn make-and-break contacts'],intro:hornComponentLessons['Horn make-and-break contacts'].simple},
 'Electric-horn moving iron bar':{machine:'Electric horn',createModel:()=>{const model=createHornModel();model.resultPart.focusOnComplete=false;return model;},part:'moving-bar',view:'front',isolate:false,lesson:hornComponentLessons['Electric-horn moving iron bar'],intro:hornComponentLessons['Electric-horn moving iron bar'].simple},
 'Vibrating horn diaphragm':{machine:'Electric horn',createModel:()=>{const model=createHornModel();model.resultPart.focusOnComplete=false;return model;},part:'diaphragm',view:'front',isolate:false,lesson:hornComponentLessons['Vibrating horn diaphragm'],intro:hornComponentLessons['Vibrating horn diaphragm'].simple},
 'Electric-bell return spring':{machine:'Electric bell',createModel:()=>{const model=createBellModel({springLesson:true});model.resultPart.focusOnComplete=false;return model;},part:'spring',view:'front',isolate:false,lesson:bellComponentLessons['Electric-bell return spring'],intro:bellComponentLessons['Electric-bell return spring'].simple},
 'Electric-bell hammer and metal bell':{machine:'Electric bell',createModel:()=>{const model=createBellModel({hammerLesson:true});model.resultPart.focusOnComplete=false;return model;},part:'gong',view:'front',isolate:false,lesson:bellComponentLessons['Electric-bell hammer and metal bell'],intro:bellComponentLessons['Electric-bell hammer and metal bell'].simple},
 'Electric-bell pushbutton switch':{machine:'Electric bell',createModel:()=>{const model=createBellModel({buttonLesson:true});model.resultPart.focusOnComplete=false;return model;},part:'button',view:'top',isolate:false,lesson:bellComponentLessons['Electric-bell pushbutton switch'],intro:bellComponentLessons['Electric-bell pushbutton switch'].simple},
 'Electromagnetic make-and-break contacts':{machine:'Electric bell',createModel:()=>{const model=createBellModel();model.resultPart.focusOnComplete=false;return model;},part:'contacts',view:'front',isolate:false,lesson:bellComponentLessons['Electromagnetic make-and-break contacts'],intro:bellComponentLessons['Electromagnetic make-and-break contacts'].simple},
 'Electric-bell armature':{machine:'Electric bell',createModel:()=>{const model=createBellModel();model.resultPart.focusOnComplete=false;return model;},part:'armature',view:'front',isolate:false,lesson:bellComponentLessons.Armature,intro:bellComponentLessons.Armature.simple},
 'Window-shade roller shaft and fixed central rod':{machine:'Window shade',createModel:()=>createWindowShadeModel({rodLesson:true}),part:'shaft',view:'front',isolate:false,lesson:shadeComponentLessons['Window-shade roller shaft and fixed central rod'],intro:shadeComponentLessons['Window-shade roller shaft and fixed central rod'].simple},
 'Window-shade winding spring':{machine:'Window shade',createModel:()=>{const model=createWindowShadeModel();model.resultPart.focusOnComplete=false;return model;},part:'spring',view:'front',isolate:false,lesson:shadeComponentLessons['Window-shade winding spring'],intro:shadeComponentLessons['Window-shade winding spring'].simple},
 'Window-shade pawls and locking disk':{machine:'Window shade',createModel:()=>{const model=createWindowShadeModel();model.resultPart.focusOnComplete=false;return model;},part:'locking',view:'side',isolate:true,lesson:shadeComponentLessons['Window-shade pawls and locking disk'],intro:shadeComponentLessons['Window-shade pawls and locking disk'].simple},
 'Zipper bottom pin and box':{machine:'Zipper',createModel:()=>{
  const model=createZipperModel(),connector=model.parts.find(part=>part.id==='bottom-connector').object,bounds=new Box3();
  for(const spread of [0,1]){model.update({...model.defaults,spread});bounds.union(new Box3().setFromObject(connector));}
  model.reset();model.parts.find(part=>part.id==='bottom-connector').framePadding=.6;model.frameBoundsForPart=id=>id==='bottom-connector'?bounds.clone().applyMatrix4(model.root.matrixWorld):undefined;
  model.followParts=model.followParts.filter(id=>id!=='bottom-connector');model.resultPart.focusOnComplete=false;return model;
 },isolate:false,part:'bottom-connector',view:'front',values:{alignment:1,insertion:0,closure:0},lesson:zipperComponentLessons['Zipper bottom pin and box'],intro:zipperComponentLessons['Zipper bottom pin and box'].simple},
 'Interlocking zipper teeth':{machine:'Zipper',createModel:()=>{const model=createZipperModel();model.frameBoundsForPart=id=>{if(id!=='head-7')return;const bounds=new Box3().setFromObject(model.parts.find(part=>part.id===id).object);return bounds.expandByVector(bounds.getSize(new Vector3()).multiplyScalar(.65));};model.resultPart.focusOnComplete=false;return model;},isolate:false,part:'head-7',view:'front',values:{alignment:1,insertion:1,closure:.5},lesson:zipperComponentLessons['Interlocking zipper teeth'],intro:zipperComponentLessons['Interlocking zipper teeth'].simple},
 'Zipper slide wedges':{machine:'Zipper',createModel:()=>{const model=createZipperModel({sliderLesson:true});model.resultPart.focusOnComplete=false;return model;},isolate:false,part:'slider',view:'front',values:{alignment:1,insertion:1,closure:.35},lesson:zipperComponentLessons['Zipper slide wedges'],intro:zipperComponentLessons['Zipper slide wedges'].simple},
 'Lever-lock key':{machine:'Lever lock',createModel:()=>{const model=createLeverModel();model.resultPart.focusOnComplete=false;model.followParts=model.parts.filter(part=>!['system','frame','door'].includes(part.id)).map(part=>part.id);return model;},isolate:false,part:'key',view:'front',values:{insertion:1},lesson:leverComponentLessons['Lever-lock key'],intro:leverComponentLessons['Lever-lock key'].simple},
 'Lock cylinder (plug)':{machine:'Cylinder lock',createModel:()=>{const model=createCylinderModel();model.parts.find(part=>part.id==='plug').framePadding=1.05;model.resultPart.focusOnComplete=false;model.followParts=model.parts.filter(part=>!['system','frame','door'].includes(part.id)).map(part=>part.id);return model;},isolate:false,part:'plug',view:'side',values:{insertion:1},lesson:cylinderComponentLessons['Lock cylinder (plug)'],intro:cylinderComponentLessons['Lock cylinder (plug)'].simple},
 'Lever-lock bolt and bolt pin':{machine:'Lever lock',createModel:()=>{const model=createLeverModel({boltLesson:true});model.resultPart.focusOnComplete=false;model.followParts=model.parts.filter(part=>!['system','frame','door'].includes(part.id)).map(part=>part.id);return model;},isolate:false,part:'bolt',values:{insertion:1,turn:135},lesson:leverComponentLessons['Lever-lock bolt and bolt pin'],intro:leverComponentLessons['Lever-lock bolt and bolt pin'].simple},
 'Lever-lock tumblers and stumps':{machine:'Lever lock',createModel:()=>{const model=createLeverModel();model.parts.find(part=>part.id==='stump').framePadding=1;model.frameBoundsForPart=id=>id==='stump'?new Box3().setFromObject(model.parts.find(part=>part.id==='lever-pack').object):undefined;model.resultPart.focusOnComplete=false;model.followParts=model.parts.filter(part=>!['system','frame','door'].includes(part.id)).map(part=>part.id);return model;},isolate:false,part:'lever-pack',view:'front',lesson:leverComponentLessons['Lever-lock tumblers and stumps'],intro:leverComponentLessons['Lever-lock tumblers and stumps'].simple},
 'Lever-lock return springs':{machine:'Lever lock',createModel:()=>{const model=createLeverModel({springLesson:true});model.resultPart.focusOnComplete=false;model.followParts=model.parts.filter(part=>!['system','frame','door'].includes(part.id)).map(part=>part.id);return model;},isolate:false,part:'lever-pack',values:{insertion:1,turn:270},lesson:leverComponentLessons['Lever-lock return springs'],intro:leverComponentLessons['Lever-lock return springs'].simple},
 'Lock return springs':{machine:'Cylinder lock',createModel:()=>{const model=createCylinderModel({springLesson:true});model.parts.find(part=>part.id==='plug').framePadding=1.05;model.resultPart.focusOnComplete=false;model.followParts=model.parts.filter(part=>!['system','frame','door'].includes(part.id)).map(part=>part.id);return model;},isolate:false,part:'latch-drive',view:'back',values:{operation:1,insertion:1,turn:80},lesson:cylinderComponentLessons['Lock return springs'],intro:cylinderComponentLessons['Lock return springs'].simple},
 'Lock pin stacks':{machine:'Cylinder lock',createModel:()=>{const model=createCylinderModel({pinLesson:true});model.resultPart.focusOnComplete=false;model.followParts=model.parts.filter(part=>!['system','frame','door'].includes(part.id)).map(part=>part.id);return model;},isolate:false,part:'pins',view:'side',lesson:cylinderComponentLessons['Lock pin stacks'],intro:cylinderComponentLessons['Lock pin stacks'].simple},
 'Cylinder-lock cam and bolt':{machine:'Cylinder lock',createModel:()=>{const model=createCylinderModel({camLesson:true});model.resultPart.focusOnComplete=false;model.followParts=model.parts.filter(part=>!['system','frame','door'].includes(part.id)).map(part=>part.id);return model;},isolate:false,part:'latch-drive',view:'back',values:{insertion:1},lesson:cylinderComponentLessons['Cylinder-lock cam and bolt'],intro:cylinderComponentLessons['Cylinder-lock cam and bolt'].simple},
 'Scale calibrating plate':{machine:'Bathroom scale',part:'calibration',view:'front',isolate:false,createModel:()=>createBathroomScaleModel({plateTeaching:true}),lesson:scaleCalibratingPlateLesson,intro:scaleCalibratingPlateLesson.simple},
 'Anchor escapement':{machine:'Mechanical clock',part:'escapement',isolate:true,view:'front',lesson:anchorEscapementLesson,intro:anchorEscapementLesson.simple},
 'Lever escapement':{machine:'Mechanical watch',part:'escapement',isolate:false,view:'front',lesson:leverEscapementLesson,intro:leverEscapementLesson.simple},
'Hairspring':{machine:'Mechanical watch',part:'hairspring',isolate:false,view:'front',lesson:hairspringLesson,intro:hairspringLesson.simple},
 'Lockstitch':{lesson:utilityComponentLessons.Lockstitch,machine:'Sewing machine',createModel:()=>{const model=createSewingModel();model.resultPart.focusOnComplete=false;model.followParts=[...model.followParts,'stitch-formation','needle','hook-assembly','hook','bobbin','take-up','take-up-rocker'];return model;},part:'stitch-formation',view:'side',isolate:true,intro:'A hook carries a loop of upper thread around the bobbin thread; the take-up then tightens their interlock.'},
 'Feed-dog':{lesson:utilityComponentLessons['Feed-dog'],machine:'Sewing machine',createModel:()=>{const model=createSewingModel({feedLesson:true});model.resultPart.focusOnComplete=false;return model;},part:'feed-bar',view:'side',isolate:true,intro:'Toothed bars rise, move the cloth while the needle is clear, drop, and return.'},
 'Bobbin and bobbin thread':{machine:'Sewing machine',createModel:()=>{const model=createSewingModel();model.resultPart.focusOnComplete=false;model.followParts=[...model.followParts,'hook-assembly'];return model;},part:'hook-assembly',view:'iso',isolate:true,lesson:utilityComponentLessons['Bobbin and bobbin thread'],intro:utilityComponentLessons['Bobbin and bobbin thread'].simple},
 'Needle and needle thread':{machine:'Sewing machine',createModel:()=>{const model=createSewingModel({needleLesson:true});model.resultPart.focusOnComplete=false;model.followParts=[...model.followParts,'stitch-formation','needle'];return model;},part:'stitch-formation',view:'iso',isolate:true,lesson:utilityComponentLessons['Needle and needle thread'],intro:utilityComponentLessons['Needle and needle thread'].simple},
 'Rotary sewing hook':{machine:'Sewing machine',createModel:()=>{const model=createSewingModel({hookLesson:true});model.resultPart.focusOnComplete=false;model.followParts=[...model.followParts,'stitch-formation','hook-assembly','hook'];return model;},part:'stitch-formation',view:'iso',isolate:true,initialState:{phase:.55},lesson:utilityComponentLessons['Rotary sewing hook'],intro:utilityComponentLessons['Rotary sewing hook'].simple},
 'Rotary shuttle':{machine:'Sewing machine',part:'stitch-formation',redirectTo:'rotary-sewing-hook',lesson:utilityComponentLessons['Rotary sewing hook']},
 'Thread take-up lever':{machine:'Sewing machine',createModel:()=>{const model=createSewingModel({takeUpLesson:true});model.resultPart.focusOnComplete=false;model.followParts=[...model.followParts,'take-up','take-up-rocker'];return model;},part:'take-up',view:'side',isolate:true,lesson:utilityComponentLessons['Thread take-up lever'],intro:utilityComponentLessons['Thread take-up lever'].simple},
 'Feed-dog lift and advance linkages':{machine:'Sewing machine',createModel:()=>{const model=createSewingModel({feedLesson:true,linkageLesson:true});model.resultPart.focusOnComplete=false;model.followParts=[...model.followParts,'feed-linkages'];return model;},part:'feed-linkages',view:'iso',isolate:true,lesson:utilityComponentLessons['Feed-dog lift and advance linkages'],intro:utilityComponentLessons['Feed-dog lift and advance linkages'].simple},
 'Siphon':{machine:'Toilet tank',createModel:createSiphonModel,part:'system',isolate:false,view:'front',lesson:utilityComponentLessons['Siphon'],intro:utilityComponentLessons['Siphon'].simple},
 'Rotating spray arm':{machine:'Dishwasher',createModel:()=>createDishwasherModel({sprayArmLesson:true}),part:'system',isolate:false,view:'front',lesson:rotatingSprayArmLesson,intro:rotatingSprayArmLesson.simple},
 'Capillary action':{machine:'Dip pen',part:'capillary',isolate:false,view:'front',lesson:capillaryActionLesson,intro:capillaryActionLesson.simple},
 'Refrigerant compressor':{machine:'Refrigerator',createModel:createRefrigerantCompressorModel,part:'system',isolate:false,view:'front',lesson:refrigerantCompressorLesson,intro:refrigerantCompressorLesson.simple},
 'CD':{machine:'Blu-ray player',part:'track',isolate:false,view:'front',values:{format:0},lesson:cdLesson,intro:cdLesson.simple},
 'DVD':{machine:'Blu-ray player',part:'track',isolate:false,view:'front',values:{format:1},lesson:dvdLesson,intro:dvdLesson.simple},
 'CD-ROM':{machine:'Blu-ray player',part:'signal',isolate:false,view:'front',values:{format:0},lesson:cdRomLesson,intro:cdRomLesson.simple},
 'Optical-disc readout':{machine:'Blu-ray player',part:'pickup',isolate:false,view:'front',lesson:opticalReadoutLesson,intro:opticalReadoutLesson.simple},
 'Electronic ink':{machine:'Electronic paper',part:'cell',isolate:false,view:'front',values:{ink:1},lesson:electronicInkLesson,intro:electronicInkLesson.simple},
 'Electrowetting display':{machine:'Electronic paper',part:'wetting',isolate:false,view:'front',lesson:electrowettingLesson,intro:electrowettingLesson.simple},
 'E-reader':{machine:'Electronic paper',part:'reader',isolate:false,view:'front',values:{ink:1},lesson:eReaderLesson,intro:eReaderLesson.simple},
 'Accelerometer':{machine:'Smartphone',part:'accelerometer',isolate:false,view:'front',lesson:accelerometerLesson,intro:accelerometerLesson.simple},
 'Vibration motor':{machine:'Smartphone',part:'motor',isolate:false,view:'front',lesson:vibrationMotorLesson,intro:vibrationMotorLesson.simple},
 'RGB subpixels':{machine:'LCD screen',part:'subpixels',isolate:false,view:'front',lesson:rgbSubpixelsLesson,intro:rgbSubpixelsLesson.simple},
 'OLED display':{machine:'LCD screen',part:'oled',isolate:false,view:'front',lesson:oledDisplayLesson,intro:oledDisplayLesson.simple},
 'Electrostatic precipitator':{machine:'Air cleaner',part:'collector',values:{mode:1},isolate:false,view:'front',lesson:electrostaticPrecipitatorLesson,intro:electrostaticPrecipitatorLesson.simple},
 'Ionizer':{machine:'Air cleaner',part:'charger',values:{mode:2},isolate:false,view:'front',lesson:ionizerLesson,intro:ionizerLesson.simple},
 'Quartz oscillator':{machine:'Quartz clock',part:'fork',isolate:true,view:'front',lesson:quartzOscillatorLesson,intro:quartzOscillatorLesson.simple},
 'Piezoelectricity':{machine:'Quartz clock',part:'plate',isolate:true,view:'front',lesson:piezoelectricityLesson,intro:piezoelectricityLesson.simple},
 'Infrared signaling':{machine:'Remote control',part:'signal',view:'front',isolate:false,lesson:infraredSignalingLesson,intro:infraredSignalingLesson.simple},
 'Diode':{machine:'Remote control',part:'junction',view:'front',isolate:false,lesson:diodeLesson,intro:diodeLesson.simple},
 'Light-emitting diode':{machine:'Remote control',part:'led',view:'front',isolate:false,lesson:lightEmittingDiodeLesson,intro:lightEmittingDiodeLesson.simple},
 'Photodiode':{machine:'Remote control',part:'receiver',view:'front',isolate:false,lesson:photodiodeLesson,intro:photodiodeLesson.simple},
 'Ionization smoke detector':{machine:'Smoke detector',part:'ions',values:{size:0.1},view:'front',isolate:false,lesson:ionizationDetectorLesson,intro:ionizationDetectorLesson.simple},
 'Optical smoke detector':{machine:'Smoke detector',part:'chamber',values:{size:3},view:'front',isolate:false,lesson:opticalDetectorLesson,intro:opticalDetectorLesson.simple},
 'Passive infrared movement detector':{machine:'Active burglar alarm',part:'lens',isolate:false,view:'front',values:{mode:1},lesson:passiveInfraredLesson,intro:passiveInfraredLesson.simple},
 'Joystick':{machine:'Games controller',part:'joystick',isolate:false,view:'front',lesson:joystickLesson,intro:joystickLesson.simple},
 'Video games console':{machine:'Games controller',part:'console',isolate:false,view:'front',lesson:videoGamesConsoleLesson,intro:videoGamesConsoleLesson.simple},
 'Phonemes':{machine:'Speech recognition',part:'vowels',isolate:false,view:'front',lesson:phonemesLesson,intro:phonemesLesson.simple},
 'Head tracking':{machine:'Virtual reality headset',part:'imu',isolate:false,view:'top',lesson:headTrackingLesson,intro:headTrackingLesson.simple},
 'Polarizing filter':{machine:'Polarized light',createModel:()=>{const model=createPolarizedLightModel();model.parts.find(part=>part.id==='first').framePadding=1.6;return model;},part:'first',isolate:false,view:'front',values:{mode:0,insert:1,middle:45,first:0,analyzer:90},lesson:polarizingFilterLesson,intro:polarizingFilterLesson.simple},
 'Liquid crystals':{machine:'Liquid crystal display',createModel:()=>{const model=createLCDModel();model.parts.find(part=>part.id==='molecules').framePadding=1.6;return model;},part:'molecules',isolate:false,view:'front',values:{mode:0,drive:0,battery:1},lesson:liquidCrystalsLesson,intro:liquidCrystalsLesson.simple},
 'Polarizing sunglasses':{machine:'Polarized light',part:'glasses',isolate:false,view:'front',values:{mode:1,brewster:1,material:0,glasses:1,analyzer:0},lesson:polarizingSunglassesLesson,intro:polarizingSunglassesLesson.simple},
 'Binocular prisms':{machine:'Binoculars',part:'probe',isolate:false,view:'front',values:{mode:1,index:1.5,angle:0},lesson:binocularPrismsLesson,intro:binocularPrismsLesson.simple},
 'AC generator':{machine:'Electric generator',part:'output',isolate:false,view:'front',values:{output:0},lesson:acGeneratorLesson,intro:acGeneratorLesson.simple},
 'DC generator':{machine:'Electric generator',part:'commutator',isolate:false,view:'front',values:{output:1},lesson:dcGeneratorLesson,intro:dcGeneratorLesson.simple},
 'Generator slip rings':{machine:'Electric generator',part:'rings',isolate:false,view:'front',values:{output:0},lesson:generatorSlipRingsLesson,intro:generatorSlipRingsLesson.simple},
 'Transformer turns ratio':{machine:'Transformer',part:'windings',isolate:false,view:'front',lesson:transformerTurnsRatioLesson,intro:transformerTurnsRatioLesson.simple},
 'Transmission transformer':{machine:'Transformer',part:'core',isolate:false,view:'front',values:{stage:0,primaryTurns:3,secondaryTurns:60},lesson:transmissionTransformerLesson,intro:transmissionTransformerLesson.simple},
 'Distribution transformer':{machine:'Transformer',part:'losses',isolate:false,view:'front',values:{stage:1,primaryTurns:60,secondaryTurns:5},lesson:distributionTransformerLesson,intro:distributionTransformerLesson.simple},
 'Home-supply transformer':{machine:'Transformer',part:'load',isolate:false,view:'front',values:{stage:2,primaryTurns:55,secondaryTurns:2},lesson:homeSupplyTransformerLesson,intro:homeSupplyTransformerLesson.simple},
 'Power-line insulator':{machine:'Electricity transmission',part:'insulator',isolate:false,view:'front',lesson:powerLineInsulatorLesson,intro:powerLineInsulatorLesson.simple},
 'Power pylon':{machine:'Electricity transmission',part:'pylon',isolate:false,view:'front',lesson:powerPylonLesson,intro:powerPylonLesson.simple},
};

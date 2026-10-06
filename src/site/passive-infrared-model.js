import {createBurglarAlarmModel} from './burglar-alarm-model.js';
import {BURGLAR_SCIENCE as C} from './burglar-alarm-physics.js';
import {PIR_KEYS,PIR_DEFAULTS,pirValues,pirSettings,pirSharedSettings} from './passive-infrared-physics.js';
import {reading} from './house-model-kit.js';
import {fixed} from './format.js';

export function createPassiveInfraredModel(){
  const model=createBurglarAlarmModel(),g=model.topology;
  const base={update:model.update,reset:model.reset,advance:model.advance,getState:model.getState,replayState:model.replayState};
  model.root.name='Passive infrared movement detector';
  model.defaults={...PIR_DEFAULTS};
  model.controls=model.controls.filter(control=>PIR_KEYS.includes(control.key)).map(control=>{
    const own={...control};delete own.enabledWhen;
    if(own.key==='range'){own.label='Path in front of detector';own.help='Forward depth of the crossing. Greater depth widens each optical field and changes collected power. This is an assigned path, not a measured or certified detection range.';}
    if(own.key==='speed')own.help='Zero starts with a warm target already settled in one field. Moving targets start after 0.5 s. Each observation lasts 12 physical seconds; slow targets may not finish their crossing.';
    if(own.key==='power')own.help='The contact supplies the buffer, processing and sounder. Opening it does not stop target motion or incoming thermal radiation. Passive means no transmitted sensing beam, not no power supply.';
    return own;
  });

  // Omitted hardware stays attached for the shared owner's resource disposal.
  const omitted=new Set(['fixed','radar-head','beam-posts','beam-emitter','beam-receiver','reference']);
  for(const part of model.parts)if(omitted.has(part.id)){part.object.visible=false;part.object.userData.selectionExcluded=true;part.object.userData.explosionExcluded=true;}
  model.parts=model.parts.filter(part=>!omitted.has(part.id));
  model.partViewDirections=Object.fromEntries(Object.entries(model.partViewDirections).filter(([id])=>!omitted.has(id)));
  for(const part of model.parts)if(['sensor','pir-head','pair'].includes(part.id))part.inspectionView='front';
  for(const path of g.paths)if(['return-reference','reference-power'].includes(path.id))path.objects.forEach(object=>object.visible=false);
  const names={
    system:['Passive infrared alarm','Thermal radiation reaches a lens array and opposed pyroelectric elements. The buffered changing signal requests a separate supply-powered sounder.'],
    room:['Room and thermal fields','Gold and blue regions send radiation to opposite elements. The target crosses at an assigned forward depth; these ideal optical fields are not certified room coverage.'],
    target:['Warm moving surface','Only the orange 0.25 by 0.7 m rectangle contributes modeled thermal contrast. Its pale limbs show movement but do not add heat to the calculation.'],
    sensor:['Passive sensing head','A filtered infrared window and ideal lens array collect radiation already arriving from the room. No light or microwave is transmitted.'],
    regulator:['Ten-volt sensor supply','An ideal regulator supplies the buffered thermal sensor and processing. The assigned 12 V battery separately supplies the sounder driver.'],
    wires:['Supply, return and thermal signal','Red carries supply, blue return and gold the weak buffered sensor signal. Current markers are symbolic; sensor output does not power the sounder.'],
    principle:['Lens-to-element mapping','Five ideal lenslets share one focal plane. Follow incoming directions and the finite target image onto the opposed elements. The enlarged diagram uses the same mapping as the power calculation.'],
    signal:['Thermal inputs and changing output','Compare incident powers with the opposed electrical output over elapsed time. Thermal lag and electrical leakage are included. No future trace is shown.'],
  };
  for(const part of model.parts)if(names[part.id])[part.name,part.description]=names[part.id];
  const historyLabel=g.recordResult.parent.children.at(-1);
  historyLabel.userData.setText('History stays visible after the warm target stops');
  model.catalogParts=model.parts.filter(part=>!['system','base','wires'].includes(part.id));

  model.getState=()=>{
    const state=base.getState(),values=pirValues(state.values);
    const rows=state.readings.map(row=>({...row}));
    rows.find(row=>row.label==='Observation clock').hint='Each watch lasts 12 physical seconds. Inspection preserves settings and clock. Playback pace and sound preserve the thermal state. Reset restores the prepared experiment.';
    rows.splice(4,0,
      reading('Element contributions',`+ ${fixed(state.outputA*1e6,2)} μV · − ${fixed(state.outputB*1e6,2)} μV`,'Calculated contributions to the buffered output, not two accessible pins. Their difference gives the single output. Values read zero with the buffer unpowered; the elements can still generate changing charge.'),
      reading('Width of one optical field',`${(values.range*C.elementWidth/C.focal).toFixed(3)} m`,'Width on the plane of the target path. The 1 mm element and 12.5 mm focal length give width = depth × 1/12.5. A finite target can overlap field edges or more than one field.'),
      reading('Peak observed so far',`${(state.peak*1e6).toFixed(2)} μV`,'Largest absolute opposed output already observed in this watch. The assigned alarm threshold is 100 μV with 50 ms continuous confirmation. This value never includes a later event.'),
    );
    return {...state,values,readings:rows};
  };
  const readings=()=>model.getState().readings;
  model.update=(changes={})=>{const values=pirSettings({...pirValues(base.getState().values),...changes});base.update(pirSharedSettings(values));return readings();};
  model.reset=(initial={})=>{
    if(!initial||typeof initial!=='object'||Array.isArray(initial)||Object.keys(initial).some(key=>!['settings','time'].includes(key)))throw new TypeError('Invalid passive infrared starting state');
    base.reset({...initial,settings:pirSharedSettings(initial.settings??PIR_DEFAULTS)});return readings();
  };
  model.advance=seconds=>{base.advance(seconds);return readings();};
  model.replayState=()=>{const initial=base.replayState();return {...initial,settings:pirValues(initial.settings)};};
  const labels={system:'Inspect: connected detector',room:'Inspect: thermal fields',principle:'Inspect: lens and elements',signal:'Inspect: thermal signals',record:'Inspect: observation record',electronics:'Inspect: powered circuit',horn:'Inspect: sounder'};
  model.actions=model.actions.map(action=>({...action,label:action.label.startsWith('Inspect:')?labels[action.part]:action.label,run:()=>{action.run();return readings();}}));
  model.playback.label='Run the thermal observation';model.playback.description='Watch incoming infrared and the opposed output for 12 physical seconds. The target may stop or remain in transit.';
  model.resultPart.label='Inspect the thermal result';
  model.reset();
  return model;
}

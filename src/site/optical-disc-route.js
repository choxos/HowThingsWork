import {opticalDiscEntries} from './optical-disc-entries.js';
import {mountHousePresentation} from './house-presentation.js';

const runtime={
 allLessons:{},
 houseComponents:opticalDiscEntries,
 createHouseModel:name=>opticalDiscEntries[name]?.createModel(),
};

export function mountHouse(host,route,catalog,options={}) {
 const entry=catalog.entries.find(item=>route==='machine/'+item.id);
 if(!entry||!Object.hasOwn(opticalDiscEntries,entry.name))return null;
 return mountHousePresentation(host,route,catalog,options,runtime);
}

import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {dirname,resolve,relative,isAbsolute} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import ts from 'typescript';
import {neighborhoodCatalog as catalog} from '../src/site/published-catalog.js';
import {houseComponents} from '../src/site/house-components.js';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const site=resolve(root,'src/site'),parsed=new Map(),modules=new Map();
const output=resolve(site,'house-route-data.js');
const quote=JSON.stringify;

async function source(path){
 path=resolve(path);
 if(!parsed.has(path)){
  const text=await readFile(path,'utf8');
  const tree=ts.createSourceFile(path,text,ts.ScriptTarget.Latest,true,ts.ScriptKind.JS);
  assert.equal(tree.parseDiagnostics.length,0,path+': valid registry source required');
  const imports=new Map(),variables=new Map();
  for(const statement of tree.statements){
   if(ts.isImportDeclaration(statement)){
    const bindings=statement.importClause?.namedBindings;
    if(bindings&&ts.isNamedImports(bindings))for(const binding of bindings.elements){
     const specifier=statement.moduleSpecifier.text;
     imports.set(binding.name.text,{path:specifier.startsWith('.')?resolve(dirname(path),specifier):specifier,exported:(binding.propertyName||binding.name).text});
    }
   }
   if(ts.isVariableStatement(statement))for(const declaration of statement.declarationList.declarations){
    if(ts.isIdentifier(declaration.name))variables.set(declaration.name.text,declaration.initializer);
   }
  }
  parsed.set(path,{path,text,tree,imports,variables});
 }
 return parsed.get(path);
}

async function moduleValue(binding){
 if(!modules.has(binding.path))modules.set(binding.path,import(pathToFileURL(binding.path).href));
 return (await modules.get(binding.path))[binding.exported];
}

async function objectProperties(file,name){
 const object=file.variables.get(name);
 assert(object&&ts.isObjectLiteralExpression(object),name+': expected object registry');
 const entries=new Map();
 for(const property of object.properties){
  if(ts.isSpreadAssignment(property)){
   assert(ts.isIdentifier(property.expression),name+': expected named registry spread');
   const binding=file.imports.get(property.expression.text);
   assert(binding,name+': registry spread must be imported');
   for(const [key,value] of await objectProperties(await source(binding.path),binding.exported))entries.set(key,value);
  }else{
   assert(ts.isPropertyAssignment(property)&&!ts.isComputedPropertyName(property.name),name+': expected named registry property');
   entries.set(property.name.text,{file,node:property.initializer});
  }
 }
 return entries;
}

function value(node,name,file){
 if(ts.isStringLiteral(node))return node.text;
 if(ts.isIdentifier(node)){
  if(node.text==='name')return name;
  assert(file.variables.has(node.text),'Unknown factory guard variable: '+node.text);
  return value(file.variables.get(node.text),name,file);
 }
 if(ts.isArrayLiteralExpression(node))return node.elements.map(item=>value(item,name,file));
 if(ts.isPrefixUnaryExpression(node)&&node.operator===ts.SyntaxKind.ExclamationToken)return !value(node.operand,name,file);
 if(ts.isBinaryExpression(node)&&node.operatorToken.kind===ts.SyntaxKind.EqualsEqualsEqualsToken)return value(node.left,name,file)===value(node.right,name,file);
 if(ts.isCallExpression(node)&&ts.isPropertyAccessExpression(node.expression)&&node.expression.name.text==='includes'){
  assert.equal(node.arguments.length,1);
  return value(node.expression.expression,name,file).includes(value(node.arguments[0],name,file));
 }
 throw new Error('Unsupported model dispatch guard: '+node.getText(file.tree));
}

async function factoryFor(name,dispatchers){
 for(const binding of dispatchers){
  const file=await source(binding.path);
  const declaration=file.tree.statements.find(node=>ts.isFunctionDeclaration(node)&&node.name?.text===binding.exported);
  assert(declaration?.body,binding.exported+': expected model dispatcher');
  for(const statement of declaration.body.statements){
   if(!ts.isIfStatement(statement)||!value(statement.expression,name,file))continue;
   assert(ts.isReturnStatement(statement.thenStatement),'Expected direct model return');
   const call=statement.thenStatement.expression;
   if(call.kind===ts.SyntaxKind.NullKeyword)break;
   assert(ts.isCallExpression(call)&&ts.isIdentifier(call.expression),'Expected named factory call');
   const selected=file.imports.get(call.expression.text);
   assert(selected,'Factory must be imported: '+call.expression.text);
   return {binding:selected,args:call.arguments.map(argument=>argument.getText(file.tree)).join(',')};
  }
 }
 return null;
}

function importsIn(node,file){
 const found=new Map();
 const visit=node=>{
  if(ts.isIdentifier(node)&&file.imports.has(node.text))found.set(node.text,file.imports.get(node.text));
  ts.forEachChild(node,visit);
 };
 visit(node);
 return found;
}

function importText(bindings,commonImports){
 const groups=new Map();
 for(const [local,binding] of bindings){
  if(!isAbsolute(binding.path)){
   if(commonImports.has(local))assert.deepEqual(commonImports.get(local),binding,'Common import collision');
   commonImports.set(local,binding);continue;
  }
  const specifier='./'+relative(site,binding.path).replaceAll('\\','/');
  if(!groups.has(specifier))groups.set(specifier,[]);
  groups.get(specifier).push(binding.exported===local?local:binding.exported+':'+local);
 }
 return groups.size?'const ['+[...groups.values()].map(names=>'{'+names.join(',')+'}').join(',')+']=await Promise.all(['+[...groups.keys()].map(path=>'import('+quote(path)+')').join(',')+']);':'';
}

export async function generateHouseRoutes(){
 const house=await source(resolve(site,'house.js'));
 const all=house.variables.get('allLessons');
 assert(all&&ts.isObjectLiteralExpression(all));
 const lessons={},lessonBindings=new Map();
 for(const spread of all.properties){
  assert(ts.isSpreadAssignment(spread)&&ts.isIdentifier(spread.expression));
  const binding=house.imports.get(spread.expression.text),collection=await moduleValue(binding);
  for(const [name,lesson] of Object.entries(collection)){lessons[name]=lesson;lessonBindings.set(name,binding);}
 }
 const dispatcher=house.tree.statements.find(node=>ts.isFunctionDeclaration(node)&&node.name?.text==='createHouseModel');
 const dispatchers=[];
 const collect=node=>{
  if(ts.isBinaryExpression(node)&&node.operatorToken.kind===ts.SyntaxKind.BarBarToken){collect(node.left);collect(node.right);return;}
  assert(ts.isCallExpression(node)&&ts.isIdentifier(node.expression));
  assert.equal(node.arguments.length,1);assert.equal(node.arguments[0].getText(house.tree),'name');
  const binding=house.imports.get(node.expression.text);assert(binding);dispatchers.push(binding);
 };
 assert(ts.isReturnStatement(dispatcher.body.statements[0]));collect(dispatcher.body.statements[0].expression);
 const components=await objectProperties(await source(resolve(site,'house-components.js')),'houseComponents');
 const metadata={allLessons:{},houseComponents:{}},loaders=[],previews=[],manifest=[],commonImports=new Map();
 for(const entry of catalog.entries){
  const component=houseComponents[entry.name],group=catalog.groups.find(group=>group.items.includes(entry.name));
  const canonicalName=component?.machine||(lessons[entry.name]?entry.name:group?.items[0]);
  if(lessons[entry.name])metadata.allLessons[entry.name]={simple:lessons[entry.name].simple};
  if(component)metadata.houseComponents[entry.name]=Object.fromEntries(['machine','intro','redirectTo'].filter(key=>component[key]!==undefined).map(key=>[key,component[key]]));
  assert(component?.lesson||lessons[canonicalName]||component?.redirectTo,entry.id+': missing lesson');
  const factory=await factoryFor(canonicalName,dispatchers);
  assert(factory||component?.createModel||component?.redirectTo,entry.id+': missing model');
  const componentSource=components.get(entry.name);
  assert.equal(Boolean(componentSource),Boolean(component),entry.name+': component source');
  const bindings=componentSource?importsIn(componentSource.node,componentSource.file):new Map();
  assert(!bindings.has('routeFallbackFactory')&&!bindings.has('routeCanonicalLessons'),'Reserved generated binding');
  if(factory)bindings.set('routeFallbackFactory',factory.binding);
  const lessonBinding=lessonBindings.get(canonicalName);
  if(lessonBinding)bindings.set('routeCanonicalLessons',lessonBinding);
  const componentText=componentSource?componentSource.node.getText(componentSource.file.tree):'undefined';
  const lessonText=lessonBinding?'routeCanonicalLessons['+quote(canonicalName)+']':'undefined';
  loaders.push(quote(entry.id)+':async()=>{'+importText(bindings,commonImports)+'return {name:'+quote(entry.name)+',canonicalName:'+quote(canonicalName)+',component:'+componentText+',canonicalLesson:'+lessonText+',createHouseModel:name=>'+(factory?'name==='+quote(canonicalName)+'?routeFallbackFactory('+factory.args+'):null':'null')+'};}');
  const previewBindings=new Map(),properties=[];
  if(componentSource){
   assert(ts.isObjectLiteralExpression(componentSource.node));
   for(const property of componentSource.node.properties){
    assert(ts.isPropertyAssignment(property)&&!ts.isComputedPropertyName(property.name));
    if(!['machine','createModel','part','values','initialState'].includes(property.name.text))continue;
    properties.push(property.getText(componentSource.file.tree));
    for(const [name,binding] of importsIn(property.initializer,componentSource.file))previewBindings.set(name,binding);
   }
  }
  const previewFactory=!component?.createModel&&factory;
  if(previewFactory)previewBindings.set('routeFallbackFactory',previewFactory.binding);
  const previewComponent=componentSource?'{'+properties.join(',')+'}':'undefined';
  previews.push(quote(entry.id)+':async()=>{'+importText(previewBindings,commonImports)+'return {name:'+quote(entry.name)+',component:'+previewComponent+',createHouseModel:name=>'+(previewFactory?'name==='+quote(canonicalName)+'?routeFallbackFactory('+previewFactory.args+'):null':'null')+'};}');
  manifest.push({id:entry.id,name:entry.name,canonicalName,modules:[...new Set([...bindings.values()].map(binding=>isAbsolute(binding.path)?relative(root,binding.path).replaceAll('\\','/'):binding.path))],previewModules:[...new Set([...previewBindings.values()].map(binding=>isAbsolute(binding.path)?relative(root,binding.path).replaceAll('\\','/'):binding.path))]});
 }
 const common=[...commonImports].map(([local,binding])=>'import {'+binding.exported+(binding.exported===local?'':' as '+local)+'} from '+quote(binding.path)+';').join('\n');
 const text='// Rebuild with node scripts/house-routes.mjs after changing model or lesson registries.\n'+
  common+'\n'+
  'export const housePresentationMetadata='+JSON.stringify(metadata,null,2)+';\n'+
  'export const houseRouteLoaders={\n'+loaders.join(',\n')+'\n};\n'+
  'export const housePreviewLoaders={\n'+previews.join(',\n')+'\n};\n';
 return {text,manifest};
}

if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const {text,manifest}=await generateHouseRoutes();
 if(process.argv.includes('--check'))assert.equal(await readFile(output,'utf8'),text,'House route data is stale; run node scripts/house-routes.mjs');
 else await writeFile(output,text);
 console.log('House route data: '+manifest.length+' published routes; native model and lesson registries retained.');
}

import {validateAddonAsset} from './addon-assets.mjs';
import fs from 'node:fs/promises';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { packPbo, readPbo } from './pbo.mjs';
export const DEFAULT_TOOLS='C:\\Program Files (x86)\\Steam\\steamapps\\common\\Arma 3 Tools';
const executables={binarize:['Binarize','binarize_x64.exe'],config:['CfgConvert','CfgConvert.exe'],texture:['ImageToPAA','ImageToPAA.exe']};
export async function checkTools(folder){const result={folder};for(const [key,parts] of Object.entries(executables)){try{await fs.access(path.join(folder,...parts));result[key]=true;}catch{result[key]=false;}}result.ready=result.binarize&&result.config&&result.texture;return result;}
async function run(exe,args,cwd,log){
  log(path.basename(exe)+' '+args.join(' '));
  return new Promise((resolve,reject)=>{
    const child=spawn(exe,args,{cwd,windowsHide:true,shell:false});let output='';
    const timeout=setTimeout(()=>{child.kill();reject(new Error('La herramienta superó 10 minutos. Revisa el registro.'));},600000);
    const collect=b=>{const line=b.toString();output=(output+line).slice(-50000);log(line);};child.stdout.on('data',collect);child.stderr.on('data',collect);
    child.on('error',e=>{clearTimeout(timeout);reject(e);});child.on('close',code=>{clearTimeout(timeout);code===0?resolve(output):reject(new Error(path.basename(exe)+' terminó con código '+code+'\n'+output));});
  });
}
export async function buildAddon(payload,outputRoot,toolsFolder,onLog=()=>{}){
  if(!/^[a-z][a-z0-9_]{2,39}$/.test(payload.id)||payload.model!==payload.id+'_building')throw new Error('Identificador de addon inválido.');
  const bytes=Buffer.from(payload.p3d);if(bytes.toString('ascii',0,4)!=='MLOD'||bytes.length>150000000)throw new Error('Modelo de origen inválido.');
  const proxyModels=payload.proxyModels||[],proxyNames=new Set();let proxySize=0;
  if(!Array.isArray(proxyModels)||proxyModels.length>500)throw Error('Lista de proxies inválida.');
  for(const proxy of proxyModels){
    if(!/^furniture_[1-9][0-9]*$/.test(proxy.name)||proxyNames.has(proxy.name))throw Error('Nombre de proxy inválido.');
    proxyNames.add(proxy.name);const data=Buffer.from(proxy.p3d);proxySize+=data.length;
    if(data.toString('ascii',0,4)!=='MLOD'||proxySize>150000000)throw Error('Modelo de proxy inválido.');
  }
  if(!(await checkTools(toolsFolder)).ready)throw new Error('Faltan herramientas de Arma 3. Selecciona su carpeta de instalación.');
  const job=await fs.mkdtemp(path.join(outputRoot,'abt-build-'));
  const source=path.join(job,'source',payload.id),compiled=path.join(job,'compiled'),mod=path.join(job,'@'+payload.id),addons=path.join(mod,'addons');
  await fs.mkdir(path.join(source,'data'),{recursive:true});await fs.mkdir(compiled,{recursive:true});await fs.mkdir(addons,{recursive:true});
  const lines=[];const log=s=>{lines.push(s);onLog(s);};
  try{
    const modelCfg=payload.modelCfg.replace('class CfgModels {','class CfgModels {\n'+proxyModels.map(p=>`class ${p.name} {sectionsInherit="";sections[]={};skeletonName="";};`).join('\n'));
    await fs.writeFile(path.join(source,payload.model+'.p3d'),bytes);await fs.writeFile(path.join(source,'model.cfg'),modelCfg,'utf8');await fs.writeFile(path.join(source,'config.cpp'),payload.config,'utf8');
    for(const proxy of proxyModels)await fs.writeFile(path.join(source,proxy.name+'.p3d'),Buffer.from(proxy.p3d));
    await fs.writeFile(path.join(source,'$PBOPREFIX$'),payload.id);await fs.writeFile(path.join(mod,'mod.cpp'),payload.mod,'utf8');
    const files=[];
    const libraryNames=new Set();let librarySize=0;
    for(const file of payload.libraryFiles||[]){
      if(!/^data\/library\/[a-f0-9-]{36}\/[a-f0-9]{20}(?:_[a-z0-9]+)?\.(paa|rvmat|bisurf)$/.test(file.name)||libraryNames.has(file.name)||typeof file.data!=='string'||file.data.length>280000000)throw Error('Recurso de biblioteca inválido.');
      const data=Buffer.from(file.data,'base64');librarySize+=data.length;if(librarySize>256*1024*1024)throw Error('Los materiales superan 256 MB.');
      libraryNames.add(file.name);await fs.mkdir(path.dirname(path.join(source,file.name)),{recursive:true});await fs.writeFile(path.join(source,file.name),data);files.push({name:file.name,data});
    }
    const assetNames=new Set();
    for(const asset of payload.assets||[]){
      validateAddonAsset(asset,assetNames);
      assetNames.add(asset.name);await fs.mkdir(path.dirname(path.join(source,asset.name)),{recursive:true});await fs.writeFile(path.join(source,asset.name),asset.text,'utf8');files.push({name:asset.name.replaceAll('/','\\'),data:Buffer.from(asset.text,'utf8')});
    }
    if(payload.stats?.lights&&!['data/light_on.rvmat','data/light_off.rvmat','scripts/light.sqf'].every(n=>assetNames.has(n)))throw new Error('Faltan archivos de la luz.');
    if(payload.stats?.seats&&!['stringtable.xml','scripts/seat_init.sqf','scripts/seat_request.sqf','scripts/seat_apply.sqf'].every(n=>assetNames.has(n)))throw new Error('Faltan archivos de los asientos.');
    if(payload.stats?.windows&&!['data/glass.rvmat','data/glass_fire.rvmat','data/glass.bisurf','scripts/glass.sqf'].every(n=>assetNames.has(n)))throw new Error('Faltan archivos de los cristales.');
    for(const texture of payload.textures||[]){
      if(!/^(texture_\d+_(co|ca)|glass_\d+_(intact|cracked)_ca)$/.test(texture.name)||typeof texture.png!=='string'||texture.png.length>50000000)throw new Error('Textura de exportación inválida.');
      const input=path.join(source,'data',texture.name+'.png'),output=path.join(source,'data',texture.name+'.paa');
      await fs.writeFile(input,Buffer.from(texture.png,'base64'));
      await run(path.join(toolsFolder,...executables.texture),[input,output],source,log);
      const data=await fs.readFile(output);if(data.length<16)throw new Error('Conversión PAA vacía: '+texture.name);
      files.push({name:'data\\'+texture.name+'.paa',data});
    }
    log('Binarizando modelo P3D…');
    for(const proxy of proxyModels){
      await run(path.join(toolsFolder,...executables.binarize),['-always','-silent','-maxProcesses=0','-addon='+source,'-binpath='+path.join(toolsFolder,'Binarize'),source,compiled,proxy.name+'.p3d'],path.dirname(source),log);
      const data=await fs.readFile(path.join(compiled,proxy.name+'.p3d'));
      if(data.toString('ascii',0,4)!=='ODOL')throw Error('No se pudo binarizar el proxy '+proxy.name);
      files.push({name:proxy.name+'.p3d',data});
    }
    // Resolve vanilla resources for Binarize without redistributing them in the PBO.
    if(payload.stats?.windows&&bytes.includes(Buffer.from('a3\\structures_f\\data\\windows\\glass.rvmat'))){
      const staged=new Set();
      async function stageVanilla(relative){
        if(staged.has(relative))return;
        if(!/^a3[\\/][a-z0-9_\\/.]+$/i.test(relative)||relative.includes('..'))throw Error('Ruta de recurso de Arma inválida.');
        staged.add(relative);let data;
        for(const base of [path.parse(outputRoot).root,'P:\\']){try{data=await fs.readFile(path.join(base,relative));break;}catch{}}
        if(!data)throw Error('Falta '+relative+'. Extrae los datos de Arma 3 en la unidad de trabajo P: con Arma 3 Tools.');
        const destination=path.join(path.dirname(source),relative);await fs.mkdir(path.dirname(destination),{recursive:true});await fs.writeFile(destination,data);
        if(relative.endsWith('.rvmat'))for(const match of data.toString('utf8').matchAll(/texture\s*=\s*"(a3[^"]+)"/gi))await stageVanilla(match[1]);
      }
      for(const file of ['glass.rvmat','glass_destruct_new.rvmat','glass_ca.paa','glass_ca_destruct_new.paa'])await stageVanilla('a3\\structures_f\\data\\windows\\'+file);
    }
    const binarizeLog=await run(path.join(toolsFolder,...executables.binarize),['-always','-silent','-maxProcesses=0','-addon='+source,'-binpath='+path.join(toolsFolder,'Binarize'),source,compiled,payload.model+'.p3d'],path.dirname(source),log);
    if(payload.stats?.shadowFaces&&/duplicate shadowbuffer|shadows disabled/i.test(binarizeLog))throw new Error('Binarize rechazó o desactivó una sombra. Revisa la capa de sombras y el registro.');
    if(payload.stats?.windows&&/cannot load material file[^\r\n]*glass|cannot load[^\r\n]*glass\.bisurf/i.test(binarizeLog))throw new Error('No se pudo cargar el material del cristal durante la binarización.');
    const modelData=await fs.readFile(path.join(compiled,payload.model+'.p3d'));
    if(modelData.toString('ascii',0,4)!=='ODOL')throw new Error('Binarize no produjo un P3D ODOL. No se generará un PBO incompleto.');
    for(const proxy of proxyModels)if(!modelData.includes(Buffer.from(proxy.name)))throw Error('El edificio ha perdido la referencia al proxy '+proxy.name);
    for(let i=1;i<=(payload.stats?.doors||0);i++){
      if(!modelData.includes(Buffer.from(`door_${i}_source`)))throw new Error('Falta la animación de la puerta '+i+' en el modelo binarizado.');
    }
    for(let i=1;i<=(payload.stats?.windows||0);i++)if(!modelData.includes(Buffer.from(`glass_${i}_source`))||!modelData.includes(Buffer.from(`glass_${i}_hide`)))throw new Error('Falta la animación del cristal '+i+' en el modelo binarizado.');
    log('Binarizando configuración…');
    const configPath=path.join(compiled,'config.bin');
    await run(path.join(toolsFolder,...executables.config),['-bin','-dst',configPath,path.join(source,'config.cpp')],source,log);
    const configData=await fs.readFile(configPath);if(!configData.subarray(0,4).equals(Buffer.from([0,114,97,80])))throw new Error('La configuración no está binarizada.');
    files.push({name:payload.model+'.p3d',data:modelData},{name:'config.bin',data:configData});
    const pbo=packPbo(payload.id,files),verified=readPbo(pbo);
    if(verified.prefix!==payload.id||verified.files.length!==files.length)throw new Error('Falló la verificación del PBO.');
    const pboPath=path.join(addons,payload.id+'.pbo');await fs.writeFile(pboPath,pbo);
    await fs.writeFile(path.join(job,'export-report.json'),JSON.stringify({name:payload.label,stats:payload.stats,warnings:payload.warnings,files:verified.files.map(f=>({name:f.name,size:f.size})),binarized:true},null,2));
    log('PBO verificado: modelo ODOL + config.bin + texturas.');
    return {ok:true,job,mod,pbo:pboPath,warnings:payload.warnings,stats:payload.stats};
  }catch(e){log('ERROR: '+e.message);throw new Error(e.message+'\nArchivos y registro conservados en: '+job);}
  finally{await fs.writeFile(path.join(job,'build.log'),lines.join('\n'));}
}


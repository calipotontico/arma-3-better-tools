const fs=require('node:fs/promises');
const path=require('node:path');
const {spawn}=require('node:child_process');
const {prepareEdenMission,edenArguments}=require('./eden-launch.cjs');
function safeName(name){return String(name||'proyecto').replace(/[<>:"/\\|?*\x00-\x1f]/g,'_').replace(/[. ]+$/,'').slice(0,100)||'proyecto';}
async function uniqueProject(folder,name){
  await fs.mkdir(folder,{recursive:true});
  const base=safeName(name);
  for(let i=0;i<10000;i++){
    const file=path.join(folder,base+(i?' '+(i+1):'')+'.calipo.json');
    try{const handle=await fs.open(file,'wx');await handle.close();return file;}catch(e){if(e.code!=='EEXIST')throw e;}
  }
  throw Error('Too many projects with this name');
}
function installWorkspace({ipcMain,allow,dialog,win,app,tr,preferences,persist,getOutput}){
  let current=null;const offered=new Set();
  ipcMain.handle('workspace:settings',event=>{allow(event);return preferences;});
  ipcMain.handle('workspace:choose',async(event,key)=>{
    allow(event);if(!['projects','exports','arma'].includes(key))throw Error('Invalid setting');
    const result=await dialog.showOpenDialog(win(),{title:tr('Elegir ubicación','Choose location'),defaultPath:preferences[key],properties:[key==='arma'?'openFile':'openDirectory',...(key==='arma'?[]:['createDirectory'])],...(key==='arma'?{filters:[{name:'Arma 3',extensions:['exe']}]}:{})});
    if(!result.canceled){
      const value=result.filePaths[0];
      if(key==='arma'&&!/^arma3(?:_x64)?\.exe$/i.test(path.basename(value)))throw Error(tr('Selecciona arma3_x64.exe o arma3.exe.','Select arma3_x64.exe or arma3.exe.'));
      preferences[key]=value;await persist();
    }
    return preferences;
  });
  ipcMain.handle('workspace:list',async event=>{
    allow(event);await fs.mkdir(preferences.projects,{recursive:true});offered.clear();
    const rows=[];
    for(const entry of await fs.readdir(preferences.projects,{withFileTypes:true})){
      if(!entry.isFile()||!/\.json$/i.test(entry.name))continue;
      const file=path.join(preferences.projects,entry.name),stat=await fs.stat(file);offered.add(file);
      let preview=null;
      try{const image=await fs.readFile(file+'.preview.jpg');if(image.length<500000)preview='data:image/jpeg;base64,'+image.toString('base64');}catch{}
      rows.push({path:file,name:entry.name,modified:stat.mtimeMs,preview});
    }
    return rows.sort((a,b)=>b.modified-a.modified);
  });
  ipcMain.handle('workspace:open',async(event,file)=>{
    allow(event);
    if(!file){const result=await dialog.showOpenDialog(win(),{defaultPath:preferences.projects,properties:['openFile'],filters:[{name:tr('Proyecto','Project'),extensions:['json']}]});if(result.canceled)return null;file=result.filePaths[0];offered.add(file);}
    if(!offered.has(file))throw Error('Unknown project');
    if((await fs.stat(file)).size>600000000)throw Error('Project too large');
    return {text:await fs.readFile(file,'utf8'),path:file,name:path.basename(file)};
  });
  ipcMain.handle('workspace:accept',(event,file)=>{allow(event);if(!offered.has(file))throw Error('Unknown project');current=file;});
  ipcMain.handle('workspace:reset',event=>{allow(event);current=null;});
  ipcMain.handle('workspace:save',async(event,text,name,saveAs,preview)=>{
    allow(event);if(typeof text!=='string'||text.length>600000000)throw Error('Project too large');
    let destination=current,created=false;
    if(saveAs){
      const result=await dialog.showSaveDialog(win(),{defaultPath:current||path.join(preferences.projects,safeName(name)+'.calipo.json'),filters:[{name:tr('Proyecto','Project'),extensions:['json']}]});
      if(result.canceled)return {ok:false};destination=result.filePath;
    }else if(!destination){destination=await uniqueProject(preferences.projects,name);created=true;}
    try{await fs.writeFile(destination+'.abt-saving',text,'utf8');await fs.rename(destination+'.abt-saving',destination);}
    catch(e){if(created)await fs.unlink(destination).catch(()=>{});throw e;}
    current=destination;
    // A preview failure must never invalidate a successfully saved project.
    try{if(typeof preview==='string'&&preview.length<650000&&/^data:image\/jpeg;base64,[A-Za-z0-9+/=]+$/.test(preview))await fs.writeFile(destination+'.preview.jpg',Buffer.from(preview.split(',')[1],'base64'));}catch{}
    return {ok:true,path:destination};
  });
  ipcMain.handle('workspace:play',async event=>{
    allow(event);const mod=getOutput();if(!mod)throw Error(tr('Exporta primero el mod.','Export the mod first.'));
    if(!preferences.arma)throw Error(tr('Selecciona el ejecutable de Arma 3 en Ajustes.','Select the Arma 3 executable in Settings.'));
    await fs.access(preferences.arma);await fs.access(path.join(mod,'addons'));
    if(mod.includes(';'))throw Error(tr('La ruta del mod no puede contener punto y coma.','The mod path cannot contain a semicolon.'));
    const mission=await prepareEdenMission(app.getPath('userData'));
    await new Promise((resolve,reject)=>{const child=spawn(preferences.arma,edenArguments(mod,mission),{cwd:path.dirname(preferences.arma),detached:true,stdio:'ignore',shell:false});child.once('error',reject);child.once('spawn',()=>{child.unref();resolve();});});
    return true;
  });
}
module.exports={installWorkspace,uniqueProject,safeName};

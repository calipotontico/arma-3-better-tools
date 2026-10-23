const { app, BrowserWindow, ipcMain, dialog, shell, screen }=require('electron');
const {revealForClose}=require('./close-window.cjs');
const {copyBundledDirectory}=require('./bundled-library.cjs');
const path=require('node:path');
const fs=require('node:fs/promises');
const {pathToFileURL}=require('node:url');
// Keep the existing profile (settings, Chromium storage and material library).
const previousProfile=app.getPath('userData');
app.setName('Arma 3 Better Tools');
app.setPath('userData',app.isPackaged?path.join(app.getPath('appData'),'Arma 3 Better Tools by Calipo'):previousProfile);
let win,toolsFolder,lastOutput,busy=false,projectPath=null,closeAllowed=false,language='es',updates;
app.whenReady().then(async()=>{
  const pipeline=await import('./build-addon.mjs');
  const {MaterialLibrary}=await import('./material-library.mjs');
  const {PolyHaven}=await import('./polyhaven.mjs');
  const polyhaven=new PolyHaven(path.join(app.getPath('userData'),'polyhaven-cache'));
  const settings=path.join(app.getPath('userData'),'desktop-settings.json');
  toolsFolder=pipeline.DEFAULT_TOOLS;
  const preferences={projects:path.join(app.getPath('documents'),'Arma 3 Better Tools','Projects'),exports:path.join(app.getPath('documents'),'Arma 3 Better Tools','Exports'),arma:''};
  try{const saved=JSON.parse(await fs.readFile(settings,'utf8'));toolsFolder=saved.toolsFolder||toolsFolder;language=saved.language==='en'?'en':'es';for(const key of Object.keys(preferences))if(typeof saved.workspace?.[key]==='string')preferences[key]=saved.workspace[key];}catch{}
  if(!preferences.arma){const candidate=path.join(path.dirname(toolsFolder),'Arma 3','arma3_x64.exe');try{await fs.access(candidate);preferences.arma=candidate;}catch{}}
  const persist=()=>fs.writeFile(settings,JSON.stringify({toolsFolder,language,workspace:preferences}));
  const tr=(es,en)=>language==='en'?en:es;
  const index=path.join(__dirname,'..','dist','index.html');
  function allow(event){if(event.sender!==win.webContents||event.senderFrame!==win.webContents.mainFrame||event.senderFrame.url!==pathToFileURL(index).href)throw new Error('Origen no autorizado.');}
  require('./project-workspace.cjs').installWorkspace({ipcMain,allow,dialog,win:()=>win,app,tr,preferences,persist,getOutput:()=>lastOutput});
  const release=require('./release-config.json');
  // Public builds do not initialize an online updater.
  const autoUpdater=null;
  const {Updates}=require('./updates.cjs');
  updates=new Updates(autoUpdater,!!autoUpdater&&app.isPackaged&&release.updatesEnabled,state=>{if(!win?.isDestroyed())win?.webContents.send('updates:state',state);if(state.status==='error')closeAllowed=false;});
  ipcMain.handle('app:info',event=>{allow(event);return {version:require('../package.json').version,language};});
  for(const method of ['list','details','thumbnail','download','listTextures','textureDetails','textureThumbnail','downloadTexture'])ipcMain.handle('polyhaven:'+method,(event,...args)=>{allow(event);return polyhaven[method](...args);});
  ipcMain.handle('app:language',async(event,value)=>{allow(event);if(!['es','en'].includes(value))throw Error('Invalid language');language=value;await persist();return language;});
  ipcMain.handle('updates:state',event=>{allow(event);return updates.state;});
  ipcMain.handle('updates:check',event=>{allow(event);return updates.check();});
  ipcMain.handle('updates:download',event=>{allow(event);return updates.download();});
  ipcMain.handle('updates:install',event=>{allow(event);if(busy)throw Error(tr('Espera a que termine la exportación del addon.','Wait for the addon export to finish.'));return updates.install(()=>{closeAllowed=true;});});
  ipcMain.handle('project:reset',event=>{allow(event);projectPath=null;});
  ipcMain.handle('project:save',async(event,text,name)=>{allow(event);if(typeof text!=='string'||text.length>600000000)throw Error('Proyecto demasiado grande.');
    let destination=projectPath;if(!destination){const picked=await dialog.showSaveDialog(win,{title:tr('Guardar proyecto','Save project'),defaultPath:path.join(app.getPath('documents'),String(name||'proyecto').replace(/[^a-z0-9 _.-]/gi,'_')+'.calipo.json'),filters:[{name:tr('Proyecto Calipo','Calipo project'),extensions:['json']}]});if(picked.canceled)return {ok:false,canceled:true};destination=picked.filePath;}
    const temporary=destination+'.abt-saving';await fs.writeFile(temporary,text,'utf8');await fs.rename(temporary,destination);projectPath=destination;return {ok:true,path:destination};
  });
  ipcMain.handle('project:confirm-close',async event=>{allow(event);revealForClose(win,screen);const result=await dialog.showMessageBox(win,{type:'question',title:tr('Cambios sin guardar','Unsaved changes'),message:tr('¿Quieres guardar los cambios antes de continuar?','Save your changes before continuing?'),buttons:[tr('Guardar','Save'),tr('Cerrar sin guardar','Discard changes'),tr('Cancelar','Cancel')],defaultId:0,cancelId:2,noLink:true});return ['save','discard','cancel'][result.response];});
  ipcMain.handle('project:close',event=>{allow(event);closeAllowed=true;win.close();});
  const libraryFolder=path.join(app.getPath('userData'),'material-library');
  // Copy bundled CC0 resources once; never overwrite personal edits or names.
  const bundled=path.join(__dirname,'builtin-catalog');
  await fs.mkdir(libraryFolder,{recursive:true});
  for(const entry of await fs.readdir(bundled,{withFileTypes:true}).catch(()=>[])){
    if(!entry.isDirectory()||! /^[a-f0-9-]{36}$/.test(entry.name))continue;
    const target=path.join(libraryFolder,entry.name);
    try{await fs.access(path.join(target,'entry.json'));}catch{await copyBundledDirectory(path.join(bundled,entry.name),target);}
  }
  const library=()=>new MaterialLibrary(libraryFolder,toolsFolder);
  ipcMain.handle('materials:list',event=>{allow(event);return library().list();});
  ipcMain.handle('materials:get',(event,id)=>{allow(event);return library().get(id);});
  ipcMain.handle('materials:rename',(event,id,name)=>{allow(event);return library().rename(id,name);});
  ipcMain.handle('materials:import',async(event,name)=>{allow(event);
    const texture=await dialog.showOpenDialog(win,{title:tr('Textura del material','Material texture'),properties:['openFile'],filters:[{name:tr('Texturas','Textures'),extensions:['paa','png','jpg','jpeg','tga']}]});if(texture.canceled)return null;
    const material=await dialog.showOpenDialog(win,{title:tr('RVMAT del material','Material RVMAT'),defaultPath:path.dirname(texture.filePaths[0]),properties:['openFile'],filters:[{name:tr('Material de Arma','Arma material'),extensions:['rvmat']}]});if(material.canceled)return null;
    return library().import(texture.filePaths[0],material.filePaths[0],name);
  });
  ipcMain.handle('tools:status',event=>{allow(event);return pipeline.checkTools(toolsFolder);});
  ipcMain.handle('tools:choose',async event=>{allow(event);const result=await dialog.showOpenDialog(win,{title:tr('Carpeta de Arma 3 Tools','Arma 3 Tools folder'),properties:['openDirectory'],defaultPath:toolsFolder});if(!result.canceled){const check=await pipeline.checkTools(result.filePaths[0]);if(!check.ready)return check;toolsFolder=result.filePaths[0];await persist();}return pipeline.checkTools(toolsFolder);});
  ipcMain.handle('addon:build',async(event,payload)=>{
    allow(event);if(busy)return {ok:false,error:'Ya hay una compilación en curso.'};busy=true;
    try{lastOutput=null;await fs.mkdir(preferences.exports,{recursive:true});
      const result=await pipeline.buildAddon(payload,preferences.exports,toolsFolder,text=>win?.webContents.send('addon:log',text));if(result.ok)lastOutput=result.mod;return result;
    }catch(error){return {ok:false,error:error.message};}finally{busy=false;}
  });
  ipcMain.handle('addon:show',async event=>{allow(event);if(lastOutput)return shell.openPath(lastOutput);});
  win=new BrowserWindow({width:1500,height:950,minWidth:1000,minHeight:700,title:app.name,icon:path.join(__dirname,'branding','app.ico'),autoHideMenuBar:true,backgroundColor:'#14181d',webPreferences:{preload:path.join(__dirname,'preload.cjs'),contextIsolation:true,nodeIntegration:false,sandbox:true}});
  win.on('close',event=>{if(!closeAllowed){event.preventDefault();revealForClose(win,screen);win.webContents.send('project:close-request');}});
  win.webContents.setWindowOpenHandler(({url,frameName})=>url==='about:blank'&&frameName==='abt-uv'?{action:'allow',overrideBrowserWindowOptions:{autoHideMenuBar:true,title:'Editor UV',webPreferences:{nodeIntegration:false,contextIsolation:true,sandbox:true}}}:{action:'deny'});
  win.webContents.on('did-create-window',child=>{child.webContents.setWindowOpenHandler(()=>({action:'deny'}));child.webContents.on('will-navigate',e=>e.preventDefault());});
  win.webContents.on('will-navigate',(e,url)=>{if(url!==pathToFileURL(index).href)e.preventDefault();});
  win.webContents.session.setPermissionRequestHandler((_,__,callback)=>callback(false));
  win.webContents.session.on('will-download',(_,item)=>{item.setSaveDialogOptions({defaultPath:path.join(app.getPath('documents'),item.getFilename())});});
  await win.loadFile(index);
  setTimeout(()=>updates.check(),8000).unref();
}).catch(error=>{
  console.error('Application startup failed',error);
  dialog.showErrorBox(language==='en'?'Unable to start':'No se ha podido iniciar',String(error?.message||error));
  app.exit(1);
});
app.on('window-all-closed',()=>app.quit());



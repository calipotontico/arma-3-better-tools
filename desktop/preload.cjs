const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('desktop',{
  workspace:{settings:()=>ipcRenderer.invoke('workspace:settings'),choose:key=>ipcRenderer.invoke('workspace:choose',key),list:()=>ipcRenderer.invoke('workspace:list'),open:file=>ipcRenderer.invoke('workspace:open',file),accept:file=>ipcRenderer.invoke('workspace:accept',file),play:()=>ipcRenderer.invoke('workspace:play')},
  polyhaven:{list:()=>ipcRenderer.invoke('polyhaven:list'),details:id=>ipcRenderer.invoke('polyhaven:details',id),thumbnail:id=>ipcRenderer.invoke('polyhaven:thumbnail',id),download:(id,resolution)=>ipcRenderer.invoke('polyhaven:download',id,resolution)},
  app:{info:()=>ipcRenderer.invoke('app:info'),language:value=>ipcRenderer.invoke('app:language',value)},
  updates:{state:()=>ipcRenderer.invoke('updates:state'),check:()=>ipcRenderer.invoke('updates:check'),download:()=>ipcRenderer.invoke('updates:download'),install:()=>ipcRenderer.invoke('updates:install'),onState:handler=>{const listener=(_,state)=>handler(state);ipcRenderer.on('updates:state',listener);return()=>ipcRenderer.removeListener('updates:state',listener);}},
  project:{reset:()=>ipcRenderer.invoke('workspace:reset'),save:(text,name,saveAs,preview)=>ipcRenderer.invoke('workspace:save',text,name,saveAs,preview),confirmClose:()=>ipcRenderer.invoke('project:confirm-close'),close:()=>ipcRenderer.invoke('project:close'),onClose:handler=>{ipcRenderer.on('project:close-request',handler);}},
  materials:{list:()=>ipcRenderer.invoke('materials:list'),get:id=>ipcRenderer.invoke('materials:get',id),import:name=>ipcRenderer.invoke('materials:import',name),rename:(id,name)=>ipcRenderer.invoke('materials:rename',id,name)},
  tools:()=>ipcRenderer.invoke('tools:status'),
  chooseTools:()=>ipcRenderer.invoke('tools:choose'),
  build:payload=>ipcRenderer.invoke('addon:build',payload),
  showOutput:()=>ipcRenderer.invoke('addon:show'),
  onLog:handler=>{const listener=(_,text)=>handler(text);ipcRenderer.on('addon:log',listener);return()=>ipcRenderer.removeListener('addon:log',listener);}
});

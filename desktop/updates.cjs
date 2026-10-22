// Keep update state independent of the window and testable without Electron.
class Updates {
  constructor(updater, enabled, notify=()=>{}) {
    this.updater=updater;this.notify=notify;this.state={status:enabled?'idle':'disabled',version:'',notes:'',percent:0};this.pending=null;
    if(!enabled)return;
    updater.autoDownload=false;updater.autoInstallOnAppQuit=false;updater.allowDowngrade=false;updater.allowPrerelease=false;
    const info=i=>({version:String(i.version||''),notes:(Array.isArray(i.releaseNotes)?i.releaseNotes.map(n=>n.note||'').join('\n'):String(i.releaseNotes||'')).slice(0,50000)});
    updater.on('checking-for-update',()=>this.set({status:'checking',error:''}));
    updater.on('update-available',i=>this.set({status:'available',...info(i)}));
    updater.on('update-not-available',()=>this.set({status:'current'}));
    updater.on('download-progress',p=>this.set({status:'downloading',percent:Math.round(p.percent)}));
    updater.on('update-downloaded',i=>this.set({status:'ready',percent:100,...info(i)}));
    updater.on('error',e=>this.set({status:'error',error:String(e.message||e).slice(0,2000)}));
  }
  set(values){Object.assign(this.state,values);this.notify({...this.state});}
  async check(){
    if(this.state.status==='disabled'||['available','downloading','ready','installing'].includes(this.state.status))return this.state;
    if(!this.pending)this.pending=this.updater.checkForUpdates().catch(e=>this.set({status:'error',error:e.message})).finally(()=>{this.pending=null;});
    await this.pending;return this.state;
  }
  async download(){
    if(this.state.status!=='available')return this.state;
    this.set({status:'downloading',percent:0});
    try{await this.updater.downloadUpdate();}catch(e){this.set({status:'error',error:e.message});}return this.state;
  }
  install(allowClose){if(this.state.status!=='ready')return false;this.set({status:'installing'});allowClose();this.updater.quitAndInstall(false,true);return true;}
}
module.exports={Updates};

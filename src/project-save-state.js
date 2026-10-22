export class ProjectSaveState{
  revision=0;saved=0;pending=null;
  get dirty(){return this.revision!==this.saved;}
  changed(){this.revision++;}
  clean(){this.saved=this.revision;}
  save(write){
    if(this.pending)return this.pending;
    const revision=this.revision;
    this.pending=Promise.resolve().then(write).then(ok=>{if(ok)this.saved=revision;return !!ok&&!this.dirty;}).finally(()=>{this.pending=null;});
    return this.pending;
  }
  async mayClose(ask,save){if(!this.dirty)return true;const action=await ask();return action==='discard'||action==='save'&&await save();}
}

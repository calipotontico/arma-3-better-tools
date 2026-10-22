// Snapshots retain immutable geometry/material references instead of copying model data.
export function cloneScene(source) {
  const copy = source.clone(true);
  function ids(a,b) { b.uuid=a.uuid; a.children.forEach((c,i)=>ids(c,b.children[i])); }
  ids(source,copy);
  return copy;
}
export class History {
  constructor(capture,apply,limit=40){this.capture=capture;this.apply=apply;this.limit=limit;this.clear();}
  clear(){this.past=[];this.future=[];}
  record(label){this.past.push({state:this.capture(),label});if(this.past.length>this.limit)this.past.shift();this.future=[];}
  undo(){if(!this.past.length)return;const entry=this.past.pop();this.future.push({state:this.capture(),label:entry.label});this.apply(entry.state);return entry.label;}
  redo(){if(!this.future.length)return;const entry=this.future.pop();this.past.push({state:this.capture(),label:entry.label});this.apply(entry.state);return entry.label;}
}

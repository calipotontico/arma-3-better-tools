// View-only visibility: retained in projects, but never excludes addon geometry.
export function setEditorVisible(object,visible){
  if(visible){if('abtOriginalVisible' in object.userData){object.visible=object.userData.abtOriginalVisible;delete object.userData.abtOriginalVisible;}}
  else {if(!('abtOriginalVisible' in object.userData))object.userData.abtOriginalVisible=object.visible;object.visible=false;}
}
export function withExportVisibility(root,run){
  const changed=[];root.traverse(o=>{if('abtOriginalVisible' in o.userData){changed.push([o,o.visible]);o.visible=o.userData.abtOriginalVisible;}});
  try{return run();}finally{for(const [o,v] of changed)o.visible=v;}
}
export function selectedMeshes(objects){const result=new Set();for(const object of objects)object.traverse(o=>{if(o.isMesh)result.add(o.uuid);});return [...result];}

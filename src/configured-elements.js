import { readLights, writeLights } from './lighting-data.js';
import { Box3, Vector3 } from 'three';
export function configuredElements(root,doors,tab){
  const entries=[];
  if(tab==='seats')root?.traverse(object=>{if(object.isMesh&&object.userData.armaSeat)entries.push({object,label:object.name||'Asiento',type:'seats'});});
  if(tab==='doors')for(const [id,d] of Object.entries(doors)){const object=root?.getObjectByProperty('uuid',id);if(object&&d.confirmed!==false)entries.push({object,label:object.name||'Puerta sin nombre',type:'doors'});}
  if(tab==='glass')root?.traverse(object=>{if(object.isMesh&&object.userData.armaGlass)entries.push({object,label:object.name||'Cristal sin nombre',type:'glass'});});
  if(tab==='lights'){
    const switches=new Map();
    for(const light of readLights(root)){
      const lamp=root?.getObjectByProperty('uuid',light.lampId),button=root?.getObjectByProperty('uuid',light.switchId);
      if(lamp)entries.push({object:lamp,label:light.name||lamp.name||'Lámpara',type:'lights'});
      if(button)switches.set(button.uuid,button);
    }
    for(const object of switches.values())entries.push({object,label:object.name||'Interruptor sin nombre',type:'switch'});
  }
  return entries;
}
export function renameConfigured(root,entry,value){
  const name=String(value).trim().slice(0,80);
  if(!name)throw Error('Escribe un nombre para el elemento.');
  const object=root?.getObjectByProperty('uuid',entry.object.uuid);
  if(!object)throw Error('El elemento ya no existe.');
  object.name=name;
  if(entry.type==='lights'||entry.type==='switch'){
    const lights=structuredClone(readLights(root));
    if(entry.type==='lights')for(const light of lights)if(light.lampId===object.uuid)light.name=name;
    writeLights(root,lights);
  }
}
export function focusElement(camera,controls,object){
  object.updateWorldMatrix(true,true);const box=new Box3().setFromObject(object);if(box.isEmpty())return;
  const center=box.getCenter(new Vector3()),radius=Math.max(.65,box.getSize(new Vector3()).length()/2);
  const direction=camera.position.clone().sub(controls.target).normalize();if(!direction.lengthSq())direction.set(1,.5,1).normalize();
  const vertical=camera.fov*Math.PI/360,horizontal=Math.atan(Math.tan(vertical)*camera.aspect);
  const distance=radius/Math.sin(Math.min(vertical,horizontal))*1.25;
  camera.position.copy(center).addScaledVector(direction,distance);controls.target.copy(center);
  camera.near=Math.min(camera.near,Math.max(.001,distance/1000));camera.far=Math.max(camera.far,distance*10);
  camera.updateProjectionMatrix();controls.update();
}

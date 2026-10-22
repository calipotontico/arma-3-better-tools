export const lightName=(base,index)=>index?`${base}_${index+1}`:base;
const empty=Object.freeze([]),legacy=new WeakMap();
export function readLights(root){
  if(root?.userData.armaLights)return root.userData.armaLights;
  const data=root?.userData.armaLight;if(!data)return empty;
  let cached=legacy.get(root);if(cached?.[0]!==data){cached=[data];legacy.set(root,cached);}return cached;
}
export function writeLights(root,lights){root.userData.armaLights=lights;delete root.userData.armaLight;}
export function lightDefaults(){return {name:'Nueva luz',color:'#fff0ce',intensity:1000,range:8,initialOn:false,actionOn:'Encender luz',actionOff:'Apagar luz',position:[0,0,0],switchPosition:[0,0,0]};}
export function syncSwitch(lights,index){
  const d=lights[index];if(!d?.switchId)return;
  for(const other of lights)if(other!==d&&other.switchId===d.switchId){other.initialOn=d.initialOn;other.actionOn=d.actionOn;other.actionOff=d.actionOff;other.switchPosition=[...d.switchPosition];other.interactionMode=d.interactionMode;other.allowedSides=d.allowedSides? [...d.allowedSides]:undefined;}
}
export function moveLightPoint(root,index,key,position){
  if(!['position','switchPosition'].includes(key)||!Array.isArray(position)||position.length!==3||!position.every(Number.isFinite))throw Error('Punto de luz inválido.');
  const lights=structuredClone(readLights(root));
  if(!lights[index])throw Error('La luz ya no existe.');
  lights[index][key]=[...position];
  if(key==='switchPosition')syncSwitch(lights,index);
  writeLights(root,lights);
}

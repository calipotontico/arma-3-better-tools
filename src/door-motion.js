import {Vector3,Matrix4} from 'three';
export function doorGroups(doors){
 const groups=[];doors.forEach((door,index)=>{let group=door.switchId&&groups.find(g=>g.door.switchId===door.switchId);if(!group){group={door,index,members:[]};groups.push(group);}group.members.push(index);});return groups;
}
export function syncDoorSwitch(doors,id){
 const source=doors[id];if(!source?.switchId)return;
 for(const d of Object.values(doors))if(d!==source&&d.switchId===source.switchId)for(const key of ['trigger','interactionMode','allowedSides','actionOpen','actionClose']){if(source[key]===undefined)delete d[key];else d[key]=structuredClone(source[key]);}
}
export function validateDoorMotion(d){
 if(d.motion!==undefined&&!['rotation','translation'].includes(d.motion))throw Error('Tipo de puerta inválido.');
 if(d.motion==='translation'&&(!Array.isArray(d.slide)||d.slide.length!==3||!d.slide.every(Number.isFinite)||Math.hypot(...d.slide)<.001))throw Error('El desplazamiento de la corredera debe ser mayor que cero.');
 if(d.switchId!==undefined&&typeof d.switchId!=='string')throw Error('Interruptor de puerta inválido.');
}
export function slideMatrix(baseWorld,parentWorld,slide,progress){return new Matrix4().copy(parentWorld).invert().multiply(new Matrix4().makeTranslation(...slide.map(v=>v*progress))).multiply(baseWorld);}
export function slideDelta(slide,delta){const origin=new Vector3().applyMatrix4(delta);return new Vector3(...slide).applyMatrix4(delta).sub(origin).toArray();}

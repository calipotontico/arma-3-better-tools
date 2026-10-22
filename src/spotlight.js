import * as THREE from 'three';
import {getLanguage} from './i18n.js';
export function spotDirection(light){
  const yaw=THREE.MathUtils.degToRad(light.spotHeading??0),pitch=THREE.MathUtils.degToRad(light.spotTilt??-90);
  return new THREE.Vector3(Math.sin(yaw)*Math.cos(pitch),Math.sin(pitch),-Math.cos(yaw)*Math.cos(pitch));
}
export function validateSpot(light){
  if(light.type!==undefined&&!['point','spot'].includes(light.type))throw Error(getLanguage()==='en'?'Invalid light type':'Tipo de luz inválido');
  if(light.type!=='spot')return;
  if(!Number.isFinite(light.spotAngle)||light.spotAngle<5||light.spotAngle>160||!Number.isFinite(light.spotHeading)||!Number.isFinite(light.spotTilt)||Math.abs(light.spotTilt)>90)throw Error(getLanguage()==='en'?'Use an opening of 5–160° and a tilt of −90–90°.':'Usa una apertura de 5–160° y una inclinación de −90–90°.');
}
export function spotCone(){
  const geometry=new THREE.ConeGeometry(1,1,32,1,true);
  // Tip at the origin, extending along local -Y.
  geometry.translate(0,-.5,0);
  return new THREE.Mesh(geometry,new THREE.MeshBasicMaterial({color:0xffa052,transparent:true,opacity:.12,side:THREE.DoubleSide,depthWrite:false}));
}
export function updateSpotCone(cone,position,direction,range,angle){
  cone.position.copy(position);cone.quaternion.setFromUnitVectors(new THREE.Vector3(0,-1,0),direction.clone().normalize());
  const radius=range*Math.tan(THREE.MathUtils.degToRad(angle/2));cone.scale.set(radius,range,radius);
}

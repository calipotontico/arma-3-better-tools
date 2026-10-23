import {Vector3,Box3,MathUtils} from 'three';
import {getLanguage,onLanguage} from './i18n.js';
export const viewDirections={front:[0,0,1],back:[0,0,-1],right:[1,0,0],left:[-1,0,0],top:[0,1,0],bottom:[0,-1,0]};
export function setFixedView(camera,controls,view,bounds){
  const direction=viewDirections[view];if(!direction)return;
  // Flush residual orbit damping before setting an exact axis view.
  const damping=controls.enableDamping;controls.enableDamping=false;controls.update();
  const center=bounds&&!bounds.isEmpty()?bounds.getCenter(new Vector3()):controls.target.clone();
  const size=bounds&&!bounds.isEmpty()?bounds.getSize(new Vector3()).length():camera.position.distanceTo(center);
  const angle=Math.min(MathUtils.degToRad(camera.fov)/2,Math.atan(Math.tan(MathUtils.degToRad(camera.fov)/2)*camera.aspect));
  const distance=Math.max(size/(2*Math.sin(angle)) *1.12,.1);
  controls.target.copy(center);camera.up.set(0,1,0);
  camera.position.copy(center).addScaledVector(new Vector3(...direction),distance);camera.near=Math.max(size/10000,.0001);camera.far=Math.max(size*100,distance*10);camera.lookAt(center);camera.updateProjectionMatrix();
  controls.enableRotate=false;controls.update();controls.enableDamping=damping;
}
export function installCameraViews({camera,controls,root}){
  const bar=document.querySelector('.viewbar'),label=bar.querySelector('span');label.setAttribute('data-no-i18n','');
  const select=document.createElement('select');select.id='cameraView';select.setAttribute('data-no-i18n','');
  const labels={free:['Libre','Free'],front:['Frontal','Front'],back:['Trasera','Back'],right:['Lateral derecha','Right'],left:['Lateral izquierda','Left'],top:['Superior','Top'],bottom:['Inferior','Bottom']};
  for(const key of Object.keys(labels)){const option=document.createElement('option');option.value=key;select.append(option);}bar.insertBefore(select,document.getElementById('frame'));
  let saved=null;
  function sync(){const en=getLanguage()==='en';for(const o of select.options)o.textContent=labels[o.value][en?1:0];select.setAttribute('aria-label',en?'Camera view':'Vista de cámara');label.textContent=select.value==='free'?(en?'FREE VIEW':'VISTA LIBRE'):labels[select.value][en?1:0].toUpperCase();}
  select.onchange=()=>{
    if(select.value==='free'){const damping=controls.enableDamping;controls.enableDamping=false;controls.update();camera.up.set(0,1,0);if(saved){camera.position.copy(saved.position);controls.target.copy(saved.target);}controls.enableRotate=true;controls.update();controls.enableDamping=damping;saved=null;}
    else{if(!saved)saved={position:camera.position.clone(),target:controls.target.clone()};setFixedView(camera,controls,select.value,root()?new Box3().setFromObject(root()):null);}sync();
  };
  onLanguage(sync);sync();return {frame(){if(select.value!=='free'){setFixedView(camera,controls,select.value,root()?new Box3().setFromObject(root()):null);return true;}return false;}};
}

import {readLights,writeLights} from './lighting-data.js';
import {getLanguage,onLanguage} from './i18n.js';

const fields={doors:['motion','angle','slide'],lights:['color','intensity','range'],glass:['color','opacity','resistance','explosion','minimalHit','bulletproof']};
export function settingsEntries(root,doors,kind){
  if(kind==='doors')return Object.entries(doors).filter(([id,d])=>d.confirmed!==false&&root?.getObjectByProperty('uuid',id)).map(([id,data])=>({id,name:root.getObjectByProperty('uuid',id).name,data}));
  if(kind==='lights')return readLights(root).map((data,i)=>({id:String(i),name:data.name,data}));
  const entries=[];root?.traverse(m=>{if(m.isMesh&&m.userData.armaGlass)entries.push({id:m.uuid,name:m.name,data:m.userData.armaGlass});});return entries;
}
export function copySettings(root,doors,kind,sourceId,targetIds){
  if(!fields[kind])throw Error('Unknown settings type');
  const entries=settingsEntries(root,doors,kind),source=entries.find(e=>e.id===sourceId);
  if(!source)return 0;
  const targets=entries.filter(e=>e.id!==sourceId&&targetIds.includes(e.id));
  const lights=kind==='lights'?structuredClone(readLights(root)):null;
  for(const target of targets){
    const data=structuredClone(target.data);
    for(const key of fields[kind]){if(source.data[key]===undefined)delete data[key];else data[key]=structuredClone(source.data[key]);}
    if(kind==='doors')doors[target.id]=data;
    else if(kind==='glass')root.getObjectByProperty('uuid',target.id).userData.armaGlass=data;
    else lights[Number(target.id)]=data;
  }
  if(lights&&targets.length)writeLights(root,lights);
  return targets.length;
}
export function installCopySettings(api){
  const panel=document.createElement('details');panel.id='copySettingsPanel';panel.setAttribute('data-no-i18n','');
  document.querySelector('.properties').append(panel);
  const tr=(es,en)=>getLanguage()==='en'?en:es;
  function render(){
    panel.innerHTML=`<summary>${tr('Copiar ajustes','Copy settings')}</summary><p>${tr('Puertas: movimiento y apertura. Luces: color, intensidad y alcance. Cristales: apariencia y resistencia. Se conservan nombres, posiciones, permisos e interruptores.','Doors: movement and opening. Lights: color, intensity and range. Glass: appearance and resistance. Names, positions, permissions and switches are preserved.')}</p><label>${tr('Tipo','Type')}<select id="copyKind"><option value="doors">${tr('Puertas','Doors')}</option><option value="lights">${tr('Luces','Lights')}</option><option value="glass">${tr('Cristales','Glass')}</option></select></label><label>${tr('Copiar desde','Copy from')}<select id="copySource"></select></label><label>${tr('Aplicar a (Ctrl + clic para varios)','Apply to (Ctrl + click for multiple)')}<select multiple size="5" id="copyTargets"></select></label><button id="copyRefresh">${tr('Actualizar lista','Refresh list')}</button><button class="primary" id="copyApply">${tr('Copiar ajustes','Copy settings')}</button>`;
    const $=id=>panel.querySelector('#'+id);
    function targets(){const old=[...$('copyTargets').selectedOptions].map(o=>o.value);$('copyTargets').replaceChildren(...settingsEntries(api.root(),api.doors(),$('copyKind').value).filter(e=>e.id!==$('copySource').value).map(e=>{const o=new Option(e.name,e.id);o.selected=old.includes(e.id);return o;}));}
    function refresh(){const old=$('copySource').value,entries=settingsEntries(api.root(),api.doors(),$('copyKind').value);$('copySource').replaceChildren(...entries.map(e=>new Option(e.name,e.id)));if(entries.some(e=>e.id===old))$('copySource').value=old;targets();}
    $('copyKind').onchange=refresh;$('copySource').onchange=targets;$('copyRefresh').onclick=refresh;
    panel.ontoggle=()=>{if(panel.open)refresh();};
    $('copyApply').onclick=()=>{const ids=[...$('copyTargets').selectedOptions].map(o=>o.value);if(!ids.length)return;api.close();api.record(tr('Copiar ajustes','Copy settings'));const count=copySettings(api.root(),api.doors(),$('copyKind').value,$('copySource').value,ids);api.refresh();api.status(tr(`Ajustes copiados a ${count} elementos. Ctrl + Z deshace.`,`Settings copied to ${count} items. Ctrl + Z undoes.`));};
    refresh();
  }
  render();onLanguage(render);
}

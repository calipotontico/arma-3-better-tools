import {english} from './i18n-en.js';
let language='es';
try{language=localStorage.getItem('abt-language')==='en'?'en':'es';}catch{}
const roots=new Map(),originals=new WeakMap(),listeners=new Set();
export const getLanguage=()=>language;
export const onLanguage=fn=>{listeners.add(fn);return()=>listeners.delete(fn);};
const patterns=[
  [/^(Deshecho|Rehecho): (.*)$/,(_,action,label)=>(action==='Deshecho'?'Undone: ':'Redone: ')+t(label)],
  [/^(.*) · (\d+) piezas\. Selecciona la puerta\.$/,'$1 · $2 parts. Select the door.'],
  [/^Puerta creada con (\d+) piezas\. Ahora comparten eje y apertura\.$/,'Door created with $1 parts. They now share an axis and opening.'],
  [/^Añadir (\d+) pieza\(s\) a «(.*)»$/,'Add $1 part(s) to “$2”'],
  [/^Piezas añadidas a «(.*)»\. Se conservan su eje y su ángulo de apertura\.$/,'Parts added to “$1”. Its axis and opening angle are preserved.'],
  [/^Localizado: (.*)\. Usa Encuadrar modelo para volver al edificio completo\.$/,'Located: $1. Use Frame model to return to the entire building.'],
  [/^Editar solo (.*)$/,'Edit only $1'],[/^Sacar (.*) de la puerta, conservándolo en el modelo$/,'Remove $1 from the door, keeping it in the model'],
  [/^Tamaño exportado: (.*) m de ancho × (.*) m de alto × (.*) m de fondo\.$/,'Export size: $1 m wide × $2 m high × $3 m deep.'],
  [/^([\d]+) recursos guardados en tu biblioteca\.$/,'$1 resources saved in your library.'],
  [/^([\d]+) caras UV seleccionadas\.$/,'$1 UV faces selected.'],
  [/^([\d]+) vértices seleccionados \(incluye duplicados de UV\)$/,'$1 selected vertices (includes UV duplicates)'],
  [/^([\d]+) triángulos seleccionados$/,'$1 selected triangles'],
  [/^([\d]+) piezas seleccionadas$/,'$1 selected parts'],
  [/^Lámpara: (.*)$/,'Lamp: $1'],[/^Interruptor: (.*)$/,'Switch: $1'],[/^Pieza: (.*)$/,'Part: $1'],
  [/^Este interruptor controla: (.*)$/,'This switch controls: $1'],
  [/^Localizar (.*)$/,'Locate $1'],[/^Renombrar (.*)$/,'Rename $1'],[/^Nuevo nombre de (.*)$/,'New name for $1'],
  [/^No se pudo guardar: (.*)$/,'Could not save: $1'],[/^No se pudo abrir: (.*)$/,'Could not open: $1'],
  [/^(.*) aplicado a (\d+) piezas\. Ctrl \+ Z deshace\.$/,'$1 applied to $2 parts. Ctrl + Z undoes.'],
  [/^Posición de la luz · X \/ Y \/ Z en metros del visor$/,'Light position · X / Y / Z in viewport meters'],
  [/^Punto de interacción · X \/ Y \/ Z en metros del visor$/,'Interaction point · X / Y / Z in viewport meters'],
  [/^(Mover|Girar|Escalar|Desplazamiento|Posición de la luz|Punto de interacción) ([XYZ])$/,(_,label,axis)=>t(label)+' '+axis],
  [/^Material (\d+)$/,'Material $1'],
  [/^(.*)\. Ctrl \+ Z deshace\.$/,(_,label)=>t(label)+'. Ctrl + Z undoes.'],
];
export function t(text){
  if(language==='es'||typeof text!=='string')return text;
  const trimmed=text.trim(),translated=english[trimmed];
  if(translated!==undefined)return text.replace(trimmed,translated);
  for(const [pattern,replacement] of patterns)if(pattern.test(trimmed))return text.replace(trimmed,trimmed.replace(pattern,replacement));
  return text;
}
// This adapter translates existing controls without replacing elements or their listeners.
// Editable values, user labels, filenames and code stay exactly as entered.
const excluded='script,style,textarea,pre,[data-no-i18n],.element-name,.member-row > span,#tree,#memberOwnerName,#configPreview,#buildLog,#libraryList,#lightList,#lightSwitchList option:not([value=""]),#glassList option:not([value=""]),#scaleDoor option:not([value=""]),#layerSource,#layerItem,#scaleReferenceDoor option:not([value=""])';
function translateNode(node){
  const element=node.nodeType===3?node.parentElement:node;
  if(!element?.closest||element.closest(excluded))return;
  if(node.nodeType===3){
    let record=originals.get(node);
    if(!record||node.nodeValue!==record.rendered)record={source:node.nodeValue};
    record.rendered=t(record.source);originals.set(node,record);
    if(node.nodeValue!==record.rendered)node.nodeValue=record.rendered;
  }else if(node.nodeType===1){
    let record=originals.get(node)||{};
    for(const name of ['title','aria-label','placeholder'])if(node.hasAttribute(name)){
      const value=node.getAttribute(name);let entry=record[name];if(!entry||value!==entry.rendered)entry={source:value};
      entry.rendered=t(entry.source);record[name]=entry;if(value!==entry.rendered)node.setAttribute(name,entry.rendered);
    }
    originals.set(node,record);
  }
}
function scan(root){translateNode(root);const doc=root.ownerDocument||root;const walker=doc.createTreeWalker(root,5);let node;while((node=walker.nextNode()))translateNode(node);}
export function observeLanguage(doc=document){
  if(roots.has(doc))return;
  const observer=new MutationObserver(records=>{for(const r of records){if(r.type==='childList')for(const n of r.addedNodes)scan(n);else translateNode(r.target);}});
  observer.observe(doc.documentElement,{subtree:true,childList:true,characterData:true,attributes:true,attributeFilter:['title','aria-label','placeholder']});roots.set(doc,observer);doc.documentElement.lang=language;scan(doc.documentElement);
  doc.defaultView?.addEventListener('unload',()=>{observer.disconnect();roots.delete(doc);},{once:true});
}
export function setLanguage(value){
  language=value==='en'?'en':'es';try{localStorage.setItem('abt-language',language);}catch{}
  for(const [doc] of roots){doc.documentElement.lang=language;scan(doc.documentElement);}
  for(const fn of listeners)fn(language);
}

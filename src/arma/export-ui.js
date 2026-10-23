import {reviewModel} from './preflight.js';
import {getLanguage,onLanguage} from '../i18n.js';
import { exportModel } from './export-model.js';
import * as THREE from 'three';
export function installExportUI(api){
  const $=id=>document.getElementById(id),modal=$('exportDialog');let payload=null;
  const play=document.createElement('button'),folder=document.createElement('button'),location=document.createElement('p');
  play.id='playArma';play.hidden=true;play.dataset.noI18n='';folder.dataset.noI18n='';location.dataset.noI18n='';location.className='hint';
  const workspace=window.desktop?.workspace;
  if(workspace){
    $('showAddon').after(play,folder,location);
    const labels=()=>{play.textContent=getLanguage()==='en'?'Test in Arma 3':'Probar en Arma 3';folder.textContent=getLanguage()==='en'?'Change export folder…':'Cambiar carpeta de exportación…';};
    labels();onLanguage(labels);
    const showLocation=values=>location.textContent=values.exports;
    workspace.settings().then(showLocation).catch(()=>{});
    folder.onclick=async()=>{try{showLocation(await workspace.choose('exports'));}catch(e){$('buildLog').textContent=e.message;}};
    play.onclick=async()=>{play.disabled=true;try{await workspace.play();$('buildLog').textContent+='\n'+(getLanguage()==='en'?'Arma 3 is opening Eden on VR with the exported mod. Place your building in the editor. Close an existing game before testing a new export.':'Arma 3 está abriendo Eden en VR con el mod exportado. Coloca tu edificio en el editor. Cierra el juego anterior antes de probar otra exportación.');}catch(e){$('buildLog').textContent+='\n'+e.message;}finally{play.disabled=false;}};
  }
  const sizing=document.createElement('section');sizing.innerHTML=`<h3>Comprobar tamaño real</h3><p id="realDimensions" class="hint"></p><div class="export-actions"><button type="button" data-units="1">Modelo en metros</button><button type="button" data-units="0.01">Modelo en centímetros</button><button type="button" data-units="0.001">Modelo en milímetros</button></div><label for="scaleDoor">Puerta de referencia</label><select id="scaleDoor"></select><label for="realDoorHeight">Altura real de esa puerta en metros</label><input id="realDoorHeight" type="number" min="0.01" step="0.01" value="2.1"><button type="button" id="fitDoorScale">Calcular escala con esta puerta</button><p class="hint">2,10 m es una referencia orientativa: introduce la altura que quieras para tu puerta. El ajuste se aplica al modelo, las colisiones, los suelos y Memory en el visor. Cierra este panel para comparar con la figura de 1,80 m. El factor pendiente vuelve a 1 para no aplicar la escala dos veces.</p><p id="scaleWarning" role="status"></p>`;
  $('addonScale').closest('.export-fields').after(sizing);
  function dimensions(){
    const root=api.root();if(!root)return;api.close();root.updateWorldMatrix(true,true);
    const scale=$('addonScale').valueAsNumber,size=new THREE.Box3().setFromObject(root).getSize(new THREE.Vector3());
    if(!Number.isFinite(scale)||scale<=0){$('realDimensions').textContent='Introduce una escala positiva.';return;}
    const m=size.multiplyScalar(scale);$('realDimensions').textContent=`Tamaño exportado: ${m.x.toFixed(2)} m de ancho × ${m.y.toFixed(2)} m de alto × ${m.z.toFixed(2)} m de fondo.`;
    const door=root.getObjectByProperty('uuid',$('scaleDoor').value),height=door?new THREE.Box3().setFromObject(door).getSize(new THREE.Vector3()).y*scale:0;
    $('scaleWarning').textContent=door?`Altura exportada de la puerta: ${height.toFixed(2)} m.`+(height>4||height<1?' Revisa la escala: esta altura es poco habitual para una puerta de paso.':''):m.y>100?'El edificio supera los 100 m de altura. Revisa las unidades del modelo.':'';
  }
  function applyVisibleScale(){try{api.applyScale($('addonScale').valueAsNumber);$('addonScale').value=1;dimensions();}catch(e){$('scaleWarning').textContent=e.message;}}
  $('addonScale').addEventListener('input',dimensions);$('addonScale').addEventListener('change',applyVisibleScale);$('scaleDoor').onchange=dimensions;
  sizing.querySelectorAll('[data-units]').forEach(b=>b.onclick=()=>{$('addonScale').value=Number(b.dataset.units)/(api.root()?.userData.armaAppliedScale||1);applyVisibleScale();});
  $('fitDoorScale').onclick=()=>{
    const door=api.root()?.getObjectByProperty('uuid',$('scaleDoor').value),real=$('realDoorHeight').valueAsNumber;
    if(!door||!Number.isFinite(real)||real<=0){$('scaleWarning').textContent='Selecciona una puerta e introduce su altura real.';return;}
    api.close();const height=new THREE.Box3().setFromObject(door).getSize(new THREE.Vector3()).y,scale=real/height;
    if(!Number.isFinite(scale)||scale<=0||scale>1000){$('scaleWarning').textContent='No se puede calcular la escala de esta puerta.';return;}
    $('addonScale').value=scale;applyVisibleScale();
  };
  const review=document.createElement('section');review.setAttribute('data-no-i18n','');
  const reviewButton=document.createElement('button'),reviewResults=document.createElement('div');reviewButton.type='button';reviewButton.id='reviewModel';reviewResults.id='reviewResults';reviewResults.style.maxHeight='240px';reviewResults.style.overflow='auto';review.append(reviewButton,reviewResults);sizing.after(review);
  const labelReview=()=>reviewButton.textContent=getLanguage()==='en'?'Review model':'Revisar modelo';onLanguage(labelReview);labelReview();
  function runReview(){api.close();const issues=reviewModel(api.root(),api.doors(),options(),getLanguage());reviewResults.replaceChildren();
    const summary=document.createElement('p');summary.textContent=getLanguage()==='en'?'Structural checks only; test collisions and interactions in Arma.':'Revisión estructural; prueba colisiones e interacciones en Arma.';reviewResults.append(summary);
    for(const issue of issues){const p=document.createElement('p');p.textContent=(issue.level==='error'?'⛔ ':'⚠ ')+issue.object+': '+issue.message;reviewResults.append(p);}
    if(!issues.length){const p=document.createElement('p');p.textContent=getLanguage()==='en'?'No structural issues found.':'Sin incidencias estructurales detectadas.';reviewResults.append(p);}return issues;
  }
  reviewButton.onclick=runReview;
  function options(){return {id:$('addonId').value.trim(),label:$('addonLabel').value.trim(),author:$('addonAuthor').value.trim(),scale:$('addonScale').valueAsNumber,collision:$('addonCollision').checked,roadway:$('addonRoadway').checked};}
  function prepare(){if(!api.root())throw new Error('Importa un modelo antes de exportar.');api.close();const issues=runReview();if(issues.some(i=>i.level==='error'))throw Error(getLanguage()==='en'?'Resolve the errors in Review model before exporting.':'Corrige los errores de Revisar modelo antes de exportar.');const settings=options();api.root().userData.armaExport=settings;payload=exportModel(api.root(),api.doors(),settings);$('configPreview').value=payload.config+'\n// -------- model.cfg --------\n'+payload.modelCfg;$('exportSummary').textContent=`${payload.stats.faces} caras · ${payload.stats.doors} puertas · ${payload.stats.lods} LODs\n`+payload.warnings.join('\n');return payload;}
  $('openExport').onclick=async()=>{
    if(workspace){play.hidden=true;workspace.settings().then(values=>location.textContent=values.exports).catch(()=>{});}
    if(!api.root()){api.status('Importa un modelo antes de exportar.');return;}
    const saved=api.root().userData.armaExport;if(saved){$('addonId').value=saved.id;$('addonLabel').value=saved.label;$('addonAuthor').value=saved.author;$('addonScale').value=saved.scale;$('addonCollision').checked=saved.collision;$('addonRoadway').checked=saved.roadway;}
    else $('addonScale').value=1;
    $('scaleDoor').replaceChildren(new Option('Selecciona una puerta creada',''),...Object.entries(api.doors()).filter(([id,d])=>d.confirmed!==false&&api.root().getObjectByProperty('uuid',id)).map(([id])=>new Option(api.root().getObjectByProperty('uuid',id).name||'Puerta',id)));
    dimensions();runReview();
    modal.showModal();$('buildAddon').disabled=!window.desktop;
    $('toolStatus').textContent=window.desktop?'Comprobando Arma 3 Tools…':'La compilación está disponible en la aplicación de escritorio. Aquí puedes revisar las configs.';
    if(window.desktop){const status=await window.desktop.tools();$('toolStatus').textContent=status.ready?'Arma 3 Tools detectado: '+status.folder:'Selecciona la carpeta de Arma 3 Tools antes de compilar.';$('buildAddon').disabled=!status.ready;}
  };
  $('closeExport').onclick=()=>modal.close();
  $('previewConfig').onclick=()=>{try{prepare();}catch(e){$('exportSummary').textContent=e.message;}};
  $('chooseTools').onclick=async()=>{if(!window.desktop)return;const tools=await window.desktop.chooseTools();$('toolStatus').textContent=tools.ready?'Herramientas listas: '+tools.folder:'Faltan Binarize, CfgConvert o ImageToPAA en esa carpeta.';$('buildAddon').disabled=!tools.ready;};
  $('showAddon').onclick=()=>window.desktop?.showOutput();
  window.desktop?.onLog(text=>{$('buildLog').textContent=($('buildLog').textContent+'\n'+text).slice(-40000);$('buildLog').scrollTop=$('buildLog').scrollHeight;});
  let building=false;modal.addEventListener('cancel',e=>{if(building)e.preventDefault();});
  $('buildAddon').onclick=async()=>{
    play.hidden=true;folder.disabled=true;
    if(building)return;building=true;$('buildAddon').disabled=true;$('closeExport').disabled=true;$('previewConfig').disabled=true;$('chooseTools').disabled=true;$('showAddon').hidden=true;
    $('buildLog').textContent='Preparando el modelo y las configuraciones…';
    try{const data=prepare();const result=await window.desktop.build(data);if(result.canceled){$('buildLog').textContent='Exportación cancelada.';return;}
      if(!result.ok)throw new Error(result.error);$('buildLog').textContent+='\n\nPBO BINARIZADO VERIFICADO\n'+result.pbo+'\n\nAñade la carpeta @'+data.id+' como mod local en el launcher de Arma 3. Busca el edificio en Eden > Arma 3 Better Tools. La prueba dentro del juego sigue siendo necesaria.';$('showAddon').hidden=false;play.hidden=!workspace;
    }catch(e){$('buildLog').textContent+='\nERROR: '+e.message;}
    finally{building=false;folder.disabled=false;$('buildAddon').disabled=false;$('closeExport').disabled=false;$('previewConfig').disabled=false;$('chooseTools').disabled=false;}
  };
}


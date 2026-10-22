import releases from './releases.json';
import {getLanguage,setLanguage,t,onLanguage,observeLanguage} from './i18n.js';
export function installAppSettings({mayClose,status}){
  const button=document.createElement('button');button.id='appSettings';button.textContent='Ajustes y novedades';document.querySelector('header').append(button);
  const dialog=document.createElement('dialog');dialog.id='appSettingsDialog';dialog.innerHTML='<div class="dialog-header"><h2>Ajustes y novedades</h2><button id="closeAppSettings">Cerrar</button></div><label>Idioma<select id="appLanguage"><option value="es">Español</option><option value="en">English</option></select></label><p class="hint">Se guarda automáticamente. No cambia nombres ni textos de acciones del proyecto.</p><p id="appVersion" data-no-i18n></p><h3>Actualizaciones</h3><p id="updateState" role="status"></p><progress id="updateProgress" max="100" hidden></progress><div class="export-actions"><button id="checkUpdates">Buscar actualizaciones</button><button id="downloadUpdate" hidden>Descargar actualización</button><button id="installUpdate" hidden>Reiniciar y actualizar</button></div><details id="availableNotes" hidden><summary>Novedades de la actualización disponible</summary><pre id="remoteNotes"></pre></details><p class="hint">La exportación de PBO necesita Arma 3 Tools instalado en tu equipo.</p><h3>Historial de novedades</h3><div id="releaseHistory" data-no-i18n></div>';
  document.body.append(dialog);const $=id=>dialog.querySelector('#'+id);
  let version=releases[0].version,state={status:window.desktop?.updates?'idle':'browser'},installing=false;
  const notice=document.createElement('dialog');notice.id='updateNotice';notice.dataset.noI18n='';
  const noticeTitle=document.createElement('h2'),noticeNotes=document.createElement('pre'),noticeStatus=document.createElement('p'),noticeActions=document.createElement('div'),acceptUpdate=document.createElement('button'),later=document.createElement('button');
  noticeNotes.style.whiteSpace='pre-wrap';noticeNotes.style.maxHeight='45vh';noticeNotes.style.overflow='auto';noticeActions.className='export-actions';acceptUpdate.className='primary';acceptUpdate.id='acceptUpdate';later.id='updateLater';noticeActions.append(acceptUpdate,later);notice.append(noticeTitle,noticeNotes,noticeStatus,noticeActions);document.body.append(notice);
  let prompted=false;
  const tr=(es,en)=>getLanguage()==='en'?en:es;
  later.onclick=()=>notice.close();
  acceptUpdate.onclick=async()=>{
    try{if(state.status==='available')accept(await window.desktop.updates.download());
      else if(state.status==='ready'&&!installing){installing=true;render();try{if(await mayClose())await window.desktop.updates.install();}finally{installing=false;render();}}
    }catch(e){noticeStatus.textContent=e.message;}
  };
  const labels={idle:'Preparado para buscar actualizaciones.',checking:'Buscando actualizaciones…',current:'Tienes la última versión.',available:'Actualización disponible.',downloading:'Descargando actualización…',ready:'Actualización lista. Guarda tu trabajo antes de reiniciar.',installing:'Reiniciando para actualizar…',error:'No se pudo actualizar. Puedes seguir trabajando y volver a intentarlo.',disabled:'Actualizaciones pendientes de activar en el servidor.',browser:'Las actualizaciones están disponibles en la app de escritorio.'};
  function render(){
    $('appLanguage').value=getLanguage();$('appVersion').textContent=t('Versión')+' '+version;
    $('updateState').textContent=t(labels[state.status]||labels.idle)+(state.version?' · '+state.version:'')+(state.status==='downloading'?' · '+state.percent+'%':'');
    $('checkUpdates').disabled=!['idle','current','error'].includes(state.status);$('downloadUpdate').hidden=state.status!=='available';$('installUpdate').hidden=state.status!=='ready';$('installUpdate').disabled=installing;
    $('updateProgress').hidden=state.status!=='downloading';$('updateProgress').value=state.percent||0;
    $('availableNotes').hidden=!state.notes;$('remoteNotes').textContent=state.notes||'';
    button.textContent=state.status==='available'?tr('Actualización disponible','Update available'):t(state.status==='ready'?'Reiniciar y actualizar':'Ajustes y novedades');
    noticeTitle.textContent=tr('Nueva actualización: ','New update: ')+state.version;
    noticeNotes.textContent=state.notes||tr('Nueva versión disponible.','A new version is available.');
    noticeStatus.textContent=t(labels[state.status]||labels.idle)+(state.status==='downloading'?' '+state.percent+'%':'');
    acceptUpdate.textContent=state.status==='ready'?tr('Guardar y reiniciar','Save and restart'):tr('Actualizar','Update');
    acceptUpdate.disabled=installing||!['available','ready'].includes(state.status);later.textContent=tr('Más tarde','Later');
    $('releaseHistory').replaceChildren();for(const release of releases){const section=document.createElement('section'),h=document.createElement('h4'),list=document.createElement('ul');h.textContent=release.version+' · '+release.date;for(const note of release[getLanguage()]){const li=document.createElement('li');li.textContent=note;list.append(li);}section.append(h,list);$('releaseHistory').append(section);}
  }
  button.onclick=()=>{render();dialog.showModal();};$('closeAppSettings').onclick=()=>dialog.close();
  $('appLanguage').onchange=async()=>{setLanguage($('appLanguage').value);try{await window.desktop?.app?.language(getLanguage());}catch{status(t('No se pudo guardar el idioma.'));}};
  const accept=value=>{state=value;render();if(state.status==='available'&&!prompted){prompted=true;notice.showModal();}};
  $('checkUpdates').onclick=async()=>{try{accept(await window.desktop.updates.check());}catch{accept({status:'error'});}};
  $('downloadUpdate').onclick=async()=>{try{accept(await window.desktop.updates.download());}catch{accept({status:'error'});}};
  $('installUpdate').onclick=async()=>{if(installing)return;installing=true;render();try{if(await mayClose())await window.desktop.updates.install();}catch(e){status(t(e.message));}finally{installing=false;render();}};
  window.desktop?.updates?.onState(accept);onLanguage(render);observeLanguage();render();
  (async()=>{try{if(window.desktop?.app){const info=await window.desktop.app.info();version=info.version;setLanguage(info.language);accept(await window.desktop.updates.state());}
    const key='abt-changelog-seen';if(localStorage.getItem(key)!==version){render();if(!document.querySelector('dialog[open]')){dialog.showModal();localStorage.setItem(key,version);}}}catch{render();}})();
}

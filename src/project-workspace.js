import {getLanguage,onLanguage} from './i18n.js';
const tr=(es,en)=>getLanguage()==='en'?en:es;
export function installWorkspaceUI({open,save,status}){
  const desktop=window.desktop?.workspace;if(!desktop)return;
  const $=id=>document.getElementById(id);
  const settings=document.createElement('section');settings.dataset.noI18n='';settings.className='workspace-settings';
  const title=document.createElement('h3');settings.append(title);
  const labels={projects:['Carpeta de proyectos','Projects folder'],exports:['Carpeta de exportación','Export folder'],arma:['Ejecutable de Arma 3','Arma 3 executable']};
  const rows={};
  for(const key of Object.keys(labels)){
    const label=document.createElement('label'),text=document.createElement('span'),path=document.createElement('input'),button=document.createElement('button');
    path.readOnly=true;path.id='workspace-'+key;button.type='button';button.id='chooseWorkspace-'+key;
    label.append(text,path);settings.append(label,button);rows[key]={text,path,button};
    button.onclick=async()=>{try{fill(await desktop.choose(key));}catch(e){status(e.message);}};
  }
  $('appVersion').before(settings);
  function fill(values){for(const key of Object.keys(rows))rows[key].path.value=values[key]||'';}
  desktop.settings().then(fill).catch(e=>status(e.message));
  const saveAs=document.createElement('button');saveAs.id='saveAs';saveAs.dataset.noI18n='';$('save').after(saveAs);saveAs.onclick=()=>save(true);
  const modal=document.createElement('dialog');modal.id='projectLibrary';modal.dataset.noI18n='';
  const header=document.createElement('div');header.className='dialog-header';
  const heading=document.createElement('h2'),close=document.createElement('button'),browse=document.createElement('button'),list=document.createElement('div'),message=document.createElement('p');
  list.className='project-library-grid';close.onclick=()=>modal.close();header.append(heading,close);modal.append(header,browse,message,list);document.body.append(modal);
  async function load(file){try{const project=await desktop.open(file);if(project&&await open(project)){await desktop.accept(project.path);modal.close();}}catch(e){message.textContent=e.message;}}
  browse.onclick=()=>load();
  const render=()=>{
    title.textContent=tr('Carpetas y pruebas','Folders and testing');
    for(const key of Object.keys(rows)){rows[key].text.textContent=tr(...labels[key]);rows[key].path.setAttribute('aria-label',tr(...labels[key]));rows[key].button.textContent=tr('Cambiar','Change');}
    saveAs.textContent=tr('Guardar como…','Save as…');heading.textContent=tr('Mis proyectos','My projects');close.textContent=tr('Cerrar','Close');browse.textContent=tr('Abrir desde otra carpeta…','Open from another folder…');
  };onLanguage(render);render();
  return async()=>{
    render();list.replaceChildren();message.textContent=tr('Cargando proyectos…','Loading projects…');modal.showModal();
    try{
      const projects=await desktop.list();message.textContent=projects.length?'':tr('No hay proyectos guardados en esta carpeta.','No projects saved in this folder.');
      for(const project of projects){
        const card=document.createElement('button');card.className='project-library-card';
        if(project.preview){const image=document.createElement('img');image.src=project.preview;image.alt='';image.loading='lazy';card.append(image);}
        else{const placeholder=document.createElement('span');placeholder.className='project-library-placeholder';placeholder.textContent=tr('Sin vista previa','No preview');card.append(placeholder);}
        const name=document.createElement('strong'),date=document.createElement('small');name.textContent=project.name;date.textContent=new Date(project.modified).toLocaleString(getLanguage());card.append(name,date);card.title=project.path;card.onclick=()=>load(project.path);list.append(card);
      }
    }catch(e){message.textContent=e.message;}
  };
}

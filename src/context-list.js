import { configuredElements } from './configured-elements.js';
export function installContextList(api){
  const list=document.getElementById('doorList'),count=document.getElementById('doorCount'),heading=count.parentElement;
  const title=document.createElement('span');title.className='context-list-title';heading.replaceChildren(title,count);
  let tab='objects',previous='',previousRoot=null;
  function update(){
    const root=api.root(),labels={doors:['PUERTAS','No hay puertas creadas.'],glass:['VENTANAS','No hay cristales configurados.'],lights:['LUCES E INTERRUPTORES','No hay luces configuradas.']};
    labels.seats=['ASIENTOS','No hay asientos creados.'];
    const visible=!!labels[tab];heading.hidden=list.hidden=!visible;if(!visible)return;
    const entries=configuredElements(root,api.doors(),tab),chosen=api.selection();
    const signature=JSON.stringify([tab,entries.map(e=>[e.object.uuid,e.label,chosen.includes(e.object)])]);
    if(signature===previous&&root===previousRoot)return;previous=signature;previousRoot=root;
    title.textContent=labels[tab][0];count.textContent=entries.length;list.replaceChildren();
    if(!entries.length){const note=document.createElement('p');note.className='hint';note.textContent=labels[tab][1];list.append(note);}
    let lastType=null;
    for(const entry of entries){
      if(tab==='lights'&&entry.type!==lastType){const h=document.createElement('h3');h.className='element-group';h.textContent=entry.type==='switch'?'Interruptores':'Luces';list.append(h);}lastType=entry.type;
      const row=document.createElement('div');row.className='element-card';row.classList.toggle('selected',chosen.includes(entry.object));
      const button=document.createElement('button');button.className='element-name';button.textContent=entry.label;button.dataset.entryType=entry.type;button.setAttribute('aria-pressed',String(chosen.includes(entry.object)));button.onclick=e=>{api.select(entry.object,e.ctrlKey||e.metaKey||e.shiftKey);if(entry.type==='seats')window.dispatchEvent(new CustomEvent('select-seat',{detail:entry.object.uuid}));};
      const actions=document.createElement('div');actions.className='element-actions';
      const locate=document.createElement('button');locate.textContent='Localizar';locate.setAttribute('aria-label','Localizar '+entry.label);locate.onclick=()=>api.locate(entry.object);
      const rename=document.createElement('button');rename.textContent='Renombrar';rename.setAttribute('aria-label','Renombrar '+entry.label);
      const form=document.createElement('form');form.className='element-rename';form.hidden=true;
      const input=document.createElement('input');input.type='text';input.maxLength=80;input.value=entry.label;input.setAttribute('aria-label','Nuevo nombre de '+entry.label);
      const save=document.createElement('button');save.textContent='Guardar';save.type='submit';
      const cancel=document.createElement('button');cancel.textContent='Cancelar';cancel.type='button';cancel.onclick=()=>{form.hidden=true;actions.hidden=false;rename.focus();};
      form.append(input,save,cancel);form.onsubmit=e=>{e.preventDefault();if(api.rename(entry,input.value)){previous='';update();}};
      input.onkeydown=e=>{if(e.key==='Escape'){e.preventDefault();cancel.click();}};
      rename.onclick=()=>{form.hidden=false;actions.hidden=true;input.focus();input.select();};
      actions.append(locate,rename);row.append(button,actions,form);list.append(row);
    }
  }
  return {update,setTab(value){tab=value;previous='';update();}};
}

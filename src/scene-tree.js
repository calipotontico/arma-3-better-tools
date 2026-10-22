import {t,onLanguage} from './i18n.js';
import {setEditorVisible,selectedMeshes} from './scene-organization.js';
export function installSceneTree(api){
  let anchor=null,anchorRoot=null;
  const tree=document.getElementById('tree'),tools=document.createElement('details');tools.className='scene-groups';tools.open=true;
  tools.innerHTML='<summary>Grupos de escena</summary><div class="scene-group-actions"><input id="sceneGroupName" placeholder="Nombre del grupo" aria-label="Nombre del grupo"><button id="createSceneGroup">Agrupar selección</button><button id="showAllParts">Mostrar todo</button></div><div id="sceneGroups"></div>';
  tree.before(tools);
  const $=id=>document.getElementById(id),groups=()=>api.root()?.userData.abtSceneGroups||[];
  function change(label,fn){if(!api.root())return;api.record(label);fn();api.clear();render();}
  function button(label,fn){const b=document.createElement('button');b.type='button';b.textContent=t(label);b.onclick=fn;return b;}
  function eye(objects){const b=button('',()=>change('Cambiar visibilidad',()=>{const show=objects.some(o=>'abtOriginalVisible' in o.userData);objects.forEach(o=>setEditorVisible(o,show));}));
    const hidden=objects.length>0&&objects.every(o=>'abtOriginalVisible' in o.userData);b.className='visibility-eye';b.classList.toggle('is-hidden',hidden);b.title=t(hidden?'Mostrar':'Ocultar');b.setAttribute('aria-label',b.title);b.setAttribute('aria-pressed',String(!hidden));return b;}
  $('createSceneGroup').onclick=()=>{const members=selectedMeshes(api.selection());if(!members.length)return;const name=$('sceneGroupName').value.trim()||t('Grupo');change('Crear grupo de escena',()=>{const r=api.root();(r.userData.abtSceneGroups??=[]).push({id:crypto.randomUUID(),name,members});});$('sceneGroupName').value='';};
  $('showAllParts').onclick=()=>change('Mostrar todo',()=>api.root().traverse(o=>setEditorVisible(o,true)));
  function render(){
    const root=api.root();tree.replaceChildren();$('sceneGroups').replaceChildren();
    if(root!==anchorRoot){anchor=null;anchorRoot=root;}
    $('showAllParts').disabled=!root;
    if(!root)return;
    for(const group of groups()){
      const objects=group.members.map(id=>root.getObjectByProperty('uuid',id)).filter(Boolean),row=document.createElement('details');row.className='scene-group';
      const heading=document.createElement('summary'),title=document.createElement('span');title.textContent=group.name;title.setAttribute('data-no-i18n','');
      const visibility=eye(objects);visibility.addEventListener('click',e=>e.preventDefault());heading.append(title,visibility);row.append(heading);
      const name=document.createElement('input');name.value=group.name;name.setAttribute('aria-label',t('Nombre del grupo'));name.onchange=()=>change('Renombrar grupo',()=>{group.name=name.value.trim()||group.name;});
      const select=button('Seleccionar grupo',()=>api.selectMany(objects));
      const add=button('Añadir selección',()=>change('Editar grupo',()=>{group.members=[...new Set([...group.members,...selectedMeshes(api.selection())])];}));
      const remove=button('Quitar selección',()=>{const ids=selectedMeshes(api.selection());change('Editar grupo',()=>{group.members=group.members.filter(id=>!ids.includes(id));});});
      const dissolve=button('Desagrupar',()=>change('Desagrupar',()=>{root.userData.abtSceneGroups=groups().filter(g=>g!==group);}));
      row.append(name,select,add,remove,dissolve);$('sceneGroups').append(row);
    }
    const selectedIds=new Set(selectedMeshes(api.selection()));
    let i=0;root.traverse(mesh=>{if(!mesh.isMesh)return;const row=document.createElement('div');row.className='scene-piece';row.dataset.uuid=mesh.uuid;row.setAttribute('aria-pressed','false');
      const b=button('',e=>{
        const rows=[...tree.children].filter(r=>!r.hidden),from=rows.findIndex(r=>r.dataset.uuid===anchor),to=rows.indexOf(row);
        if(e.shiftKey&&from>=0){api.selectMany(rows.slice(Math.min(from,to),Math.max(from,to)+1).map(r=>root.getObjectByProperty('uuid',r.dataset.uuid)),e.ctrlKey||e.metaKey);}
        else {anchor=mesh.uuid;api.select(mesh,e.ctrlKey||e.metaKey);}
      });b.className='piece-label';b.dataset.piece='';b.textContent=mesh.name||`Pieza ${++i}`;b.setAttribute('data-no-i18n','');row.classList.toggle('piece-hidden','abtOriginalVisible' in mesh.userData);row.classList.toggle('selected',selectedIds.has(mesh.uuid));row.append(b,eye([mesh]));tree.append(row);
    });
  }
  onLanguage(render);render();return {render};
}

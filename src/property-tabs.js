// Move existing controls, retaining their listeners and editor state.
export function installPropertyTabs({leaveComponents,stopGizmos,onChange=()=>{}}){
  const $=id=>document.getElementById(id),aside=document.querySelector('.properties');
  const definitions=[['objects','Objetos'],['textures','Texturas'],['doors','Puertas'],['layers','Geometrías'],['shadows','Sombras'],['lights','Luces'],['glass','Cristales'],['ladders','Escaleras'],['scale','Escala'],['assets','Biblioteca 3D'],['seats','Asientos']];
  definitions.push(['interiors','Interiores']);
  const nav=document.createElement('div');nav.className='property-tabs';nav.setAttribute('role','tablist');nav.setAttribute('aria-label','Herramientas del edificio');
  const content=document.createElement('div');content.className='property-content';
  const panels=new Map(),buttons=new Map();
  for(const [id,label] of definitions){
    const button=document.createElement('button');button.type='button';button.id='tab-'+id;button.textContent=label;button.setAttribute('role','tab');button.setAttribute('aria-controls','panel-'+id);nav.append(button);buttons.set(id,button);
    const panel=document.createElement('section');panel.id='panel-'+id;panel.className='property-page';panel.setAttribute('role','tabpanel');panel.setAttribute('aria-labelledby',button.id);panels.set(id,panel);content.append(panel);
    button.onclick=()=>activate(id);
    button.onkeydown=e=>{const keys=['ArrowRight','ArrowLeft','Home','End'];if(!keys.includes(e.key))return;e.preventDefault();const i=definitions.findIndex(d=>d[0]===id),next=e.key==='Home'?0:e.key==='End'?definitions.length-1:(i+(e.key==='ArrowRight'?1:-1)+definitions.length)%definitions.length;activate(definitions[next][0]);buttons.get(definitions[next][0]).focus();};
  }
  const move=(id,node)=>{if(node)panels.get(id).append(node);};
  // These sections were previously nested together in the layer editor.
  for(const [id,control] of [['scale','buildingScale'],['shadows','shadowScope'],['lights','lampName'],['glass','glassList']])move(id,$(control).closest('section'));
  move('layers',$('layerPanel'));
  move('ladders',$('ladderPanel'));
  move('assets',$('polyhavenPanel'));
  move('seats',$('seatPanel'));
  move('interiors',$('interiorPanel'));
  move('textures',$('materialLibrary'));
  move('objects',$('subobjectPanel'));
  move('objects',$('faceOrientation').closest('section'));
  move('objects',$('editPanel'));
  move('objects',$('copySettingsPanel'));
  move('textures',$('materialFields').closest('details'));
  const context=document.createElement('div');context.className='property-selection';
  for(const id of ['selectionName','selectionHint','memberContext'])context.append($(id));
  aside.querySelector(':scope > .section-title')?.remove();
  aside.querySelector(':scope > .scope')?.remove();
  for(const child of [...aside.children])move('doors',child);
  aside.append(nav,context,content);
  let active=null;const scroll=new Map();
  function activate(id){
    if(id===active)return;
    if(active)scroll.set(active,content.scrollTop);
    if(id!=='layers'&&$('layerMode').value!=='visual'){$('layerMode').value='visual';$('layerMode').dispatchEvent(new Event('change'));}
    if(id!=='objects'&&id!=='layers'){leaveComponents();$('faceOrientation').checked=false;}
    stopGizmos();active=id;
    if(id==='seats')$('seatRefresh')?.click();
    for(const [key,panel] of panels){panel.hidden=key!==id;buttons.get(key).setAttribute('aria-selected',String(key===id));buttons.get(key).tabIndex=key===id?0:-1;}
    content.scrollTop=scroll.get(id)||0;
    onChange(id);
  }
  $('layerMode').addEventListener('change',()=>{if($('layerMode').value!=='visual')activate('layers');});
  $('componentMode').addEventListener('change',()=>{if($('componentMode').value!=='objects'&&$('layerMode').value==='visual')activate('objects');});
  $('doorList').addEventListener('click',e=>{if(e.target.closest('button')?.dataset.entryType==='doors')activate('doors');});
  activate('objects');
}

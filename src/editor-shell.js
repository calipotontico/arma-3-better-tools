import {t,onLanguage,getLanguage} from './i18n.js';
import {modelStats} from './model-tools.js';

// Presentation only: move original elements so IDs, listeners and state survive.
export function installEditorShell({root=()=>null,selection=()=>[]}={}){
  const $=id=>document.getElementById(id),header=document.querySelector('body > header');
  document.body.classList.add('editor-shell');
  const make=(tag,cls,text)=>{const el=document.createElement(tag);el.className=cls;if(text)el.textContent=text;return el;};
  const brand=header.querySelector('.brand'),identity=make('div','project-identity');
  const project=make('strong','project-title'),saved=make('span','save-indicator');
  project.setAttribute('data-no-i18n','');saved.setAttribute('role','status');
  identity.append(project,saved);
  const files=make('div','project-actions'),history=make('div','history-actions'),end=make('div','header-end');
  files.append($('loadProject'),$('save'));if($('saveAs'))files.append($('saveAs'));files.append($('import'));history.append($('undo'),$('redo'));
  end.append($('appSettings'),$('openExport'));
  header.querySelector('.phase')?.remove();header.append(brand,identity,files,history,end);
  $('openExport').classList.add('primary');$('import').classList.remove('primary');
  $('import').textContent='Importar modelo';
  // Avoid an accidental navigation from the brand in a browser preview.
  brand.removeAttribute('href');
  // Longer guidance stays available without dominating the inspector.
  for(const hint of document.querySelectorAll('.property-content p.hint:not([id])')){
    if(hint.textContent.length<100)continue;
    const help=make('details','inline-help'),summary=make('summary','','Ayuda');
    hint.before(help);help.append(summary,hint);
  }
  const refreshIdentity=()=>{const name=$('modelName');project.textContent=name.hasAttribute('data-no-i18n')?name.textContent:t('Sin modelo');
    const dirty=document.title.startsWith('*');saved.textContent=t(dirty?'Cambios sin guardar':'Sin cambios pendientes');saved.classList.toggle('dirty',dirty);};
  new MutationObserver(refreshIdentity).observe($('modelName'),{childList:true,subtree:true,characterData:true});
  new MutationObserver(refreshIdentity).observe(document.querySelector('title'),{childList:true,subtree:true,characterData:true});
  onLanguage(refreshIdentity);refreshIdentity();

  const tools=make('div','workspace-bar');tools.append(document.querySelector('.work-tabs'),$('editToolbar'));
  $('viewport').prepend(tools);
  const stats=make('div','model-stats');stats.id='modelStats';stats.setAttribute('data-no-i18n','');
  $('viewport').append(stats);
  const updateStats=()=>{
    const en=getLanguage()==='en',total=modelStats([root()]),chosen=modelStats(selection());
    const fmt=new Intl.NumberFormat(en?'en-US':'es-ES');
    const line=(label,s)=>`${label}: ${fmt.format(s.objects)} ${en?'objects':'objetos'} · ${fmt.format(s.triangles)} ${en?'faces (triangles)':'caras (triángulos)'} · ${fmt.format(s.vertices)} ${en?'vertices':'vértices'}`;
    const value=line(en?'Model':'Modelo',total)+'\n'+line(en?'Selection':'Selección',chosen);
    if(stats.textContent!==value)stats.textContent=value;
    stats.title=en?'Includes hidden model parts. Imported faces are triangulated; original quads/ngons are not available. Vertices include UV seams.':'Incluye piezas ocultas del modelo. Las caras importadas están trianguladas; no se conserva el número original de quads o polígonos. Los vértices incluyen las costuras UV.';
  };
  updateStats();setInterval(updateStats,500);onLanguage(updateStats);
  const inspector=make('div','inspector-heading','Inspector');document.querySelector('.properties').prepend(inspector);
  // Original details stay intact; these extra groups only wrap existing controls.
  for(const [id,label] of [['subobjectPanel','Selección y componentes'],['settings','Eje y apertura'],['materialLibrary','Biblioteca compartida']]){
    const node=$(id),group=make('details','inspector-group'),summary=make('summary','',label);group.open=true;
    node.before(group);group.append(summary,node);
  }
  // Reparent controls, never clone them: existing events and disabled fieldsets survive.
  function fold(first,last,es,en,open=false){
    if(!first||!last||first.parentElement!==last.parentElement)return;
    const group=make('details','compact-group'),summary=make('summary');
    summary.setAttribute('data-no-i18n','');
    const update=()=>{summary.textContent=getLanguage()==='en'?en:es;};
    update();onLanguage(update);group.open=open;first.before(group);group.append(summary);
    let node=first;while(node){const next=node.nextSibling;group.append(node);if(node===last)break;node=next;}
  }
  fold($('members')?.previousElementSibling,$('ungroup'),'Piezas de la puerta','Door parts');
  fold($('actionOpen')?.closest('section'),$('actionOpen')?.closest('section'),'Textos de interacción','Interaction labels');
  const position=$('px')?.closest('.coordinates');
  fold(position?.previousElementSibling,position,'Posición del eje','Axis position');
  fold($('glassColor')?.previousElementSibling,$('glassOpacity'),'Aspecto en el visor','Viewport appearance');
  fold($('glassResistance')?.previousElementSibling,$('glassMinimal'),'Resistencia y daño','Resistance and damage',true);
  fold($('lampColor')?.previousElementSibling,$('lampInitial')?.parentElement,'Iluminación','Lighting',true);
  fold($('lampOnText')?.previousElementSibling,$('lampOffText'),'Textos de interacción','Interaction labels');
  const lightPoint=$('lampPointX')?.parentElement,switchPoint=$('switchPointX')?.parentElement;
  fold(lightPoint?.previousElementSibling,switchPoint,'Puntos Memory','Memory points');
  for(const [id,es,en] of [['newLight','Crear luz','Create light'],['assignGlass','Crear cristal','Create glass']]){
    const button=$(id);button.classList.add('primary');button.setAttribute('data-no-i18n','');
    const update=()=>button.textContent=getLanguage()==='en'?en:es;update();onLanguage(update);
  }
  // Keep the scene list flat in DOM (existing selection/rename uses its children),
  // but expose actual hierarchy depth and filter without rebuilding the buttons.
  const search=make('input','scene-search');search.type='search';search.id='sceneSearch';search.placeholder='Buscar piezas…';search.setAttribute('aria-label','Buscar piezas');
  $('modelName').after(search);
  const empty=make('p','scene-no-results','No hay piezas coincidentes.');empty.hidden=true;$('tree').after(empty);
  function filter(){
    const query=search.value.trim().toLocaleLowerCase();let visible=0;
    for(const button of $('tree').children){let depth=0,object=root()?.getObjectByProperty('uuid',button.dataset.uuid);
      for(let p=object?.parent;p&&p!==root();p=p.parent)depth++;
      button.style.setProperty('--tree-depth',Math.min(depth,6));
      button.hidden=!!query&&!button.textContent.toLocaleLowerCase().includes(query);if(!button.hidden)visible++;
    }
    empty.hidden=!query||visible>0;
  }
  search.addEventListener('input',filter);new MutationObserver(filter).observe($('tree'),{childList:true,subtree:true,characterData:true});filter();

  for(const [id,icon] of [['loadProject','folder'],['save','save'],['import','plus'],['openExport','export'],['appSettings','settings'],['frame','frame']])$(id).dataset.icon=icon;
  for(const button of $('editToolbar').children)button.dataset.icon=button.dataset.mode;
  for(const [side,selector] of [['left','.objects'],['right','.properties']]){
    const pane=document.querySelector(selector),handle=make('div','pane-resizer '+side);
    handle.tabIndex=0;handle.setAttribute('role','separator');handle.setAttribute('aria-orientation','vertical');
    // Labels below intentionally use the same ES/EN adapter as every tool.
    handle.setAttribute('aria-label',side==='left'?'Anchura de escena':'Anchura del inspector');
    const key='abt-pane-'+side,variable='--'+side+'-width',defaults=side==='left'?280:370;
    function apply(value){const max=Math.max(200,Math.min(side==='left'?390:480,(innerWidth-400)/2));
      const width=Math.max(200,Math.min(max,Number(value)||defaults));document.body.style.setProperty(variable,width+'px');handle.setAttribute('aria-valuemin','200');handle.setAttribute('aria-valuemax',String(Math.round(max)));handle.setAttribute('aria-valuenow',String(Math.round(width)));return width;}
    let stored;try{stored=localStorage.getItem(key);}catch{}apply(stored||defaults);
    const persist=width=>{try{localStorage.setItem(key,width);}catch{}};
    handle.addEventListener('pointerdown',e=>{if(e.button!==0)return;e.preventDefault();handle.setPointerCapture(e.pointerId);
      const x=e.clientX,start=pane.getBoundingClientRect().width;document.body.classList.add('resizing-panes');
      const move=event=>apply(start+(event.clientX-x)*(side==='left'?1:-1));
      const finish=()=>{persist(handle.getAttribute('aria-valuenow'));document.body.classList.remove('resizing-panes');handle.removeEventListener('pointermove',move);handle.removeEventListener('pointerup',finish);handle.removeEventListener('pointercancel',finish);};
      handle.addEventListener('pointermove',move);handle.addEventListener('pointerup',finish);handle.addEventListener('pointercancel',finish);
    });
    handle.addEventListener('keydown',e=>{if(!['ArrowLeft','ArrowRight','Home'].includes(e.key))return;e.preventDefault();persist(apply(e.key==='Home'?defaults:Number(handle.getAttribute('aria-valuenow'))+(e.key==='ArrowRight'?16:-16)*(side==='left'?1:-1)));});
    handle.addEventListener('dblclick',()=>persist(apply(defaults)));
    window.addEventListener('resize',()=>apply(handle.getAttribute('aria-valuenow')));document.querySelector('main').append(handle);
  }
}

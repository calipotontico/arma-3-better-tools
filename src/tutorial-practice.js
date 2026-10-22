export const practiceSteps=[
 ['objects',null,'Desplazar cámara','Pan camera','Mantén Alt y arrastra con el botón izquierdo sobre el visor para desplazar la cámara.','Hold Alt and drag with the left mouse button in the viewport to pan.','pan'],
 ['objects',null,'Girar cámara','Orbit camera','Mantén Alt y arrastra con el botón derecho para girar alrededor del modelo.','Hold Alt and drag with the right mouse button to orbit the model.','orbit'],
 ['objects',null,'Acercar y alejar','Zoom','Gira la rueda del ratón sobre el visor para acercarte o alejarte.','Scroll the mouse wheel over the viewport to zoom in or out.','zoom'],
 ['objects','tree','Seleccionar una pieza','Select a part','Haz clic en una pieza del visor o de la lista para seleccionarla.','Click a part in the viewport or scene list to select it.','single'],
 ['objects','tree','Añadir a la selección','Add to selection','Mantén Ctrl y haz clic en otra pieza. Deben quedar al menos dos seleccionadas.','Hold Ctrl and click another part. At least two parts must remain selected.','multiple'],
 ['objects',null,'Selección rectangular','Rectangle selection','Arrastra con el botón izquierdo, sin Alt, para dibujar un rectángulo que incluya piezas completas.','Drag with the left button, without Alt, to draw a rectangle containing complete parts.','box'],
 ['objects','tree','Seleccionar un tramo','Select a range','Selecciona una pieza de la lista y, manteniendo Mayús, pulsa otra más abajo.','Select a part in the list, then hold Shift and click another farther down.','range']
];
export function observePractice({canvas,camera,controls,selection},complete){
 let start=null;
 const snapshot=e=>({x:e.clientX,y:e.clientY,button:e.button,alt:e.altKey,ctrl:e.ctrlKey,shift:e.shiftKey,pos:camera.position.clone(),target:controls.target.clone(),ids:selection().map(o=>o.uuid)});
 canvas.addEventListener('pointerdown',e=>start=snapshot(e),true);
 canvas.addEventListener('pointerup',e=>{const s=start;start=null;if(!s)return;setTimeout(()=>{
  const moved=Math.hypot(e.clientX-s.x,e.clientY-s.y)>5,changed=camera.position.distanceTo(s.pos)>0.0001||controls.target.distanceTo(s.target)>0.0001;
  if(s.alt&&moved&&changed)complete(s.button===0?'pan':s.button===2?'orbit':'');
  else if(!s.alt&&s.button===0){const ids=selection().map(o=>o.uuid),different=ids.join()!==s.ids.join();if(moved&&ids.length)complete('box');else if(!moved&&ids.length&&different)complete(s.ctrl&&ids.length>1?'multiple':'single');}
 },50);});
 canvas.addEventListener('pointercancel',()=>start=null);
 canvas.addEventListener('wheel',()=>{const before=camera.position.distanceTo(controls.target);setTimeout(()=>{if(Math.abs(before-camera.position.distanceTo(controls.target))>0.0001)complete('zoom');},100);},{passive:true,capture:true});
 document.getElementById('tree').addEventListener('click',e=>{if(!e.target.closest('.piece-label'))return;setTimeout(()=>{const count=selection().length;if(e.shiftKey&&count>1)complete('range');else if(e.ctrlKey&&count>1)complete('multiple');else if(count===1)complete('single');},0);});
}
export function movableTutorial(card,word){
 const heading=card.querySelector('.tutorial-heading'),exit=card.querySelector('#tutorialExit');
 for(const [name,symbol] of [['minimize','−'],['maximize','□']]){const button=document.createElement('button');button.type='button';button.textContent=symbol;button.id='tutorial-'+name;exit.before(button);button.onclick=()=>{if(name==='minimize'){card.classList.toggle('tutorial-minimized');card.classList.remove('tutorial-maximized');}else{card.classList.toggle('tutorial-maximized');card.classList.remove('tutorial-minimized');}update();};}
 const update=()=>{document.getElementById('tutorial-minimize').title=word('Minimizar / restaurar','Minimize / restore');document.getElementById('tutorial-maximize').title=word('Ampliar / restaurar','Expand / restore');};update();
 const clamp=()=>{const r=card.getBoundingClientRect();card.style.left=Math.max(8,Math.min(innerWidth-r.width-8,r.left))+'px';card.style.top=Math.max(8,Math.min(innerHeight-40,r.top))+'px';card.style.bottom='auto';card.style.transform='none';};
 heading.addEventListener('pointerdown',e=>{if(e.button!==0||e.target.closest('button')||card.classList.contains('tutorial-maximized'))return;e.preventDefault();clamp();const r=card.getBoundingClientRect(),x=e.clientX,y=e.clientY;heading.setPointerCapture(e.pointerId);
 const move=v=>{card.style.left=r.left+v.clientX-x+'px';card.style.top=r.top+v.clientY-y+'px';clamp();};
 const end=()=>{heading.removeEventListener('pointermove',move);heading.removeEventListener('pointerup',end);heading.removeEventListener('pointercancel',end);};heading.addEventListener('pointermove',move);heading.addEventListener('pointerup',end);heading.addEventListener('pointercancel',end);});
 window.addEventListener('resize',()=>{if(!card.hidden&&!card.classList.contains('tutorial-maximized'))clamp();});return update;
}


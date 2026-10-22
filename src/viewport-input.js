import { Box3, Vector3, MOUSE } from 'three';

export function meshesInRectangle(meshes,camera,rect){
  camera.updateMatrixWorld();const found=[];
  for(const mesh of meshes){
    let visible=true;for(let p=mesh;p;p=p.parent)if(!p.visible)visible=false;if(!visible)continue;
    mesh.updateWorldMatrix(true,false);mesh.geometry.computeBoundingBox();const box=mesh.geometry.boundingBox;if(!box||box.isEmpty())continue;
    const projected=new Box3();let clipped=false;
    for(const x of [box.min.x,box.max.x])for(const y of [box.min.y,box.max.y])for(const z of [box.min.z,box.max.z]){
      const p=new Vector3(x,y,z).applyMatrix4(mesh.matrixWorld).project(camera);if(![p.x,p.y,p.z].every(Number.isFinite)||p.z<-1||p.z>1)clipped=true;projected.expandByPoint(p);
    }
    if(!clipped&&projected.min.x>=rect.minX&&projected.max.x<=rect.maxX&&projected.min.y>=rect.minY&&projected.max.y<=rect.maxY)found.push(mesh);
  }
  return found;
}

export function installViewportInput(api){
  const {canvas,controls}=api;let start=null;
  const marquee=document.createElement('div');marquee.style.cssText='position:absolute;pointer-events:none;z-index:4;border:1px solid #ffb479;background:#ffb47922;display:none';canvas.parentElement.append(marquee);
  controls.mouseButtons={LEFT:null,MIDDLE:MOUSE.DOLLY,RIGHT:null};
  function end(){start=null;marquee.style.display='none';}
  canvas.addEventListener('pointerdown',e=>{
    controls.mouseButtons.LEFT=e.altKey?MOUSE.PAN:null;controls.mouseButtons.RIGHT=e.altKey?MOUSE.ROTATE:null;
    if(e.altKey){end();api.navigate?.(true);return;}
    if(e.button!==0||api.busy())return;
    start={x:e.clientX,y:e.clientY,ctrl:e.ctrlKey||e.metaKey,subtract:(e.ctrlKey||e.metaKey)&&e.shiftKey};canvas.setPointerCapture(e.pointerId);
  },true);
  canvas.addEventListener('pointermove',e=>{
    if(!start||api.dragging()){if(api.dragging())end();return;}
    if(Math.hypot(e.clientX-start.x,e.clientY-start.y)<5||api.layerActive())return;
    const r=canvas.getBoundingClientRect();Object.assign(marquee.style,{display:'block',left:Math.min(start.x,e.clientX)-r.left+'px',top:Math.min(start.y,e.clientY)-r.top+'px',width:Math.abs(e.clientX-start.x)+'px',height:Math.abs(e.clientY-start.y)+'px'});
  });
  canvas.addEventListener('pointerup',e=>{
    if(e.button!==0||!start)return;const s=start;end();if(api.dragging()||e.altKey)return;
    const r=canvas.getBoundingClientRect(),distance=Math.hypot(e.clientX-s.x,e.clientY-s.y);
    if(distance<5){api.click(e,s);return;}
    if(api.layerActive())return;
    const x=v=>(v-r.left)/r.width*2-1,y=v=>1-(v-r.top)/r.height*2;
    api.box({minX:Math.min(x(s.x),x(e.clientX)),maxX:Math.max(x(s.x),x(e.clientX)),minY:Math.min(y(s.y),y(e.clientY)),maxY:Math.max(y(s.y),y(e.clientY))},s);
  });
  const finishNavigation=()=>api.navigate?.(false);canvas.addEventListener('pointerup',()=>queueMicrotask(finishNavigation));canvas.addEventListener('pointercancel',finishNavigation);window.addEventListener('blur',finishNavigation);
  canvas.addEventListener('pointercancel',end);canvas.addEventListener('lostpointercapture',end);window.addEventListener('blur',end);
  document.querySelector('.viewport-footer').textContent='ARRASTRAR IZQUIERDO: selección · CTRL: añadir · CTRL + MAYÚS: quitar · ALT + IZQUIERDO: mover cámara · ALT + DERECHO: orbitar · RUEDA: zoom';
}

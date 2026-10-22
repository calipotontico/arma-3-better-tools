import * as THREE from 'three';
import { TransformControls } from 'three/addons/controls/TransformControls.js';
import { activePoints, linkedPoints, movePoints, weldPoints, transformPoints } from './point-editing.js';

export function invertTriangles(source,faces){
  const g=source.index?source.toNonIndexed():new THREE.BufferGeometry().copy(source);delete g.parameters;
  const attributes=[...Object.values(g.attributes),...Object.values(g.morphAttributes).flat()];
  for(const face of faces){
    const first=face*3;if(!Number.isInteger(face)||face<0||first+2>=g.attributes.position.count)throw new Error('Cara inválida.');
    for(const a of attributes)for(let c=0;c<a.itemSize;c++){const v=a.getComponent(first,c);a.setComponent(first,c,a.getComponent(first+2,c));a.setComponent(first+2,c,v);}
    for(const normal of [g.attributes.normal,...g.morphAttributes.normal||[]].filter(Boolean))for(let i=first;i<first+3;i++)normal.setXYZ(i,-normal.getX(i),-normal.getY(i),-normal.getZ(i));
    if(g.attributes.tangent)for(let i=first;i<first+3;i++)g.attributes.tangent.setW(i,-g.attributes.tangent.getW(i));
  }
  g.userData=structuredClone(source.userData);
  if(source.userData.weldGroups){const corners=new Map();for(let i=0;i<g.attributes.position.count;i++){const f=Math.floor(i/3),corner=faces.has(f)?f*3+2-i%3:i,old=source.index?source.index.getX(corner):corner;if(!corners.has(old))corners.set(old,[]);corners.get(old).push(i);}g.userData.weldGroups=source.userData.weldGroups.map(group=>group.flatMap(i=>corners.get(i)||[]));}
  for(const a of attributes)a.needsUpdate=true;if(!g.attributes.normal)g.computeVertexNormals();return g;
}
export function triangleIndices(g,face){return [0,1,2].map(i=>g.index?g.index.getX(face*3+i):face*3+i);}
export function facesFromPoints(g,points){const result=[];for(let f=0;f<Math.floor((g.index?.count??g.attributes.position.count)/3);f++)if(triangleIndices(g,f).every(i=>points.has(i)))result.push(f);return result;}

export function installSubobjects(api){
  let mode='objects',selection=new Map();const overlay=new THREE.Group();api.scene.add(overlay);
  const panel=document.createElement('section');panel.id='subobjectPanel';panel.innerHTML=`<label for="componentMode">Seleccionar</label><select id="componentMode"><option value="objects">Objetos</option><option value="faces">Caras</option><option value="points">Puntos</option></select><div id="componentTools" hidden><p class="hint">Clic o rectángulo. Ctrl añade; Ctrl + Mayús quita. El rectángulo incluye elementos ocultos. Las caras son los triángulos del modelo importado.</p><p id="componentCount"></p><button id="componentInvert">Invertir caras seleccionadas</button><button id="pointsToFaces">Seleccionar caras de estos puntos</button><div id="pointTools" hidden><button id="pointGizmo">Mover puntos en el visor</button><label>Desplazamiento X / Y / Z (unidades del visor)</label><div class="coordinates"><input id="pointDX" aria-label="Desplazamiento X" type="number" value="0" step="0.1"><input id="pointDY" aria-label="Desplazamiento Y" type="number" value="0" step="0.1"><input id="pointDZ" aria-label="Desplazamiento Z" type="number" value="0" step="0.1"></div><button id="pointMove">Aplicar desplazamiento</button><button id="pointWeld">Soldar al centro de la selección</button><p class="hint">Soldado por pieza: conserva las UV y une el movimiento de los duplicados de textura. Elimina las caras que colapsen. No une objetos separados.</p></div><button id="componentClear">Limpiar selección</button></div>`;document.querySelector('.properties').prepend(panel);
  const $=id=>document.getElementById(id);
  const proxy=new THREE.Object3D(),gizmo=new TransformControls(api.camera,api.canvas);api.scene.add(proxy,gizmo.getHelper());gizmo.setMode('translate');
  let moving=false,dragging=false,suppress=false,records=[],start=new THREE.Matrix4();
  function targets(){return meshes().filter(m=>selection.get(m.uuid)?.size).map(m=>{m.updateWorldMatrix(true,false);if(Math.abs(m.matrixWorld.determinant())<1e-12)throw new Error('La pieza tiene una escala nula.');return {mesh:m,source:m.geometry,ids:linkedPoints(m.geometry,mode==='faces'?new Set([...selection.get(m.uuid)].flatMap(f=>triangleIndices(m.geometry,f))):selection.get(m.uuid)),world:m.matrixWorld.clone(),inverse:m.matrixWorld.clone().invert()};});}
  function applyMove(items,delta){for(const r of items){const local=delta.clone().applyMatrix4(r.inverse).sub(new THREE.Vector3().applyMatrix4(r.inverse)),next=movePoints(r.source,r.ids,local.toArray());if(r.mesh.geometry!==r.source)r.mesh.geometry.dispose();r.mesh.geometry=next;}}
  function refreshGizmo(){if(dragging)return;gizmo.detach();if(mode==='objects'||!moving)return;const items=targets(),box=new THREE.Box3();for(const r of items)for(const i of r.ids)box.expandByPoint(world(r.mesh,i));if(!box.isEmpty()){proxy.position.copy(box.getCenter(new THREE.Vector3()));proxy.quaternion.identity();proxy.scale.set(1,1,1);proxy.updateMatrixWorld();gizmo.attach(proxy);}}
  gizmo.addEventListener('dragging-changed',e=>{api.controls.enabled=!e.value;});
  gizmo.addEventListener('mouseDown',()=>{records=targets();api.record('Transformar componentes');start.copy(proxy.matrixWorld);dragging=true;suppress=true;});
  gizmo.addEventListener('objectChange',()=>{if(!dragging)return;proxy.updateMatrixWorld(true);const delta=proxy.matrixWorld.clone().multiply(start.clone().invert());if(Math.abs(delta.determinant())<1e-12)return;for(const r of records){const next=transformPoints(r.source,r.ids,r.inverse.clone().multiply(delta).multiply(r.world));if(r.mesh.geometry!==r.source)r.mesh.geometry.dispose();r.mesh.geometry=next;}draw();});
  gizmo.addEventListener('mouseUp',()=>{dragging=false;draw();setTimeout(()=>suppress=false,0);api.status('Puntos movidos. Ctrl + Z lo deshace.');});
  window.addEventListener('keydown',e=>{if(dragging&&(e.ctrlKey||e.metaKey)){e.preventDefault();e.stopImmediatePropagation();}},true);
  function meshes(){const out=[];api.root()?.traverse(m=>{if(!m.isMesh||!m.geometry.attributes.position)return;for(let p=m;p;p=p.parent)if(!p.visible)return;out.push(m);});return out;}
  function clearOverlay(){for(const o of [...overlay.children]){o.geometry.dispose();o.material.dispose();overlay.remove(o);}}
  function world(m,i){return new THREE.Vector3().fromBufferAttribute(m.geometry.attributes.position,i).applyMatrix4(m.matrixWorld);}
  function eachFace(m,fn){const g=m.geometry,count=g.index?.count??g.attributes.position.count;for(let i=Math.ceil(g.drawRange.start/3);i<Math.floor(Math.min(count,g.drawRange.start+g.drawRange.count)/3);i++)fn(i,triangleIndices(g,i));}
  function draw(){clearOverlay();$('componentTools').hidden=mode==='objects';document.body.classList.toggle('editing-components',mode!=='objects');$('componentInvert').hidden=mode!=='faces';$('pointsToFaces').hidden=mode!=='points';let count=0;
    $('pointTools').hidden=mode!=='points';if(mode==='objects'){gizmo.detach();return;}api.root()?.updateWorldMatrix(true,true);
    const selected=[],all=[];
    for(const m of meshes()){const ids=selection.get(m.uuid)||new Set();count+=ids.size;
      if(mode==='points')for(const i of activePoints(m.geometry)){const p=world(m,i).toArray();all.push(...p);if(ids.has(i))selected.push(...p);}
      else eachFace(m,(f,vertices)=>{const p=vertices.map(i=>world(m,i).toArray());for(let i=0;i<3;i++)all.push(...p[i],...p[(i+1)%3]);if(ids.has(f))selected.push(...p.flat());});
    }
    function add(values,type,material){const g=new THREE.BufferGeometry().setAttribute('position',new THREE.Float32BufferAttribute(values,3)),o=new type(g,material);o.renderOrder=20;overlay.add(o);}
    if(mode==='points'){add(all,THREE.Points,new THREE.PointsMaterial({color:0x74c7f7,size:4,sizeAttenuation:false,depthTest:false}));add(selected,THREE.Points,new THREE.PointsMaterial({color:0xffa052,size:7,sizeAttenuation:false,depthTest:false}));}
    else{add(all,THREE.LineSegments,new THREE.LineBasicMaterial({color:0x74c7f7,transparent:true,opacity:.25,depthTest:false}));add(selected,THREE.Mesh,new THREE.MeshBasicMaterial({color:0xffa052,side:THREE.DoubleSide,transparent:true,opacity:.7,depthTest:false,depthWrite:false}));}
    $('componentCount').textContent=`${count} ${mode==='points'?'vértices seleccionados (incluye duplicados de UV)':'triángulos seleccionados'}`;$('componentInvert').disabled=!count;$('pointsToFaces').disabled=!count;
    for(const id of ['pointGizmo','pointMove','pointWeld'])$(id).disabled=!count;refreshGizmo();
  }
  function setMode(value){if($('layerMode').value!=='visual'){mode='objects';selection.clear();gizmo.detach();$('componentMode').value=value;draw();return;}api.close();api.clear();api.stop();moving=false;gizmo.detach();mode=value;selection.clear();$('componentMode').value=value;draw();}
  function apply(hits,gesture){if(!gesture.ctrl&&!gesture.subtract)selection.clear();for(const [m,i] of hits){if(!selection.has(m.uuid))selection.set(m.uuid,new Set());if(gesture.subtract)selection.get(m.uuid).delete(i);else selection.get(m.uuid).add(i);}draw();}
  function projected(m,i){return world(m,i).project(api.camera);}
  function inside(p,r){return p.z>=-1&&p.z<=1&&p.x>=r.minX&&p.x<=r.maxX&&p.y>=r.minY&&p.y<=r.maxY;}
  $('componentMode').onchange=()=>setMode($('componentMode').value);
  $('componentClear').onclick=()=>{selection.clear();draw();};
  $('pointGizmo').onclick=()=>setTransformMode(moving?'select':'translate');
  function setTransformMode(value){moving=value!=='select';if(moving)gizmo.setMode(value);refreshGizmo();}
  $('pointMove').onclick=()=>{try{const delta=['X','Y','Z'].map(a=>$('pointD'+a).valueAsNumber);if(!delta.every(Number.isFinite))throw new Error('Introduce tres desplazamientos válidos.');if(delta.every(v=>v===0))return;const items=targets();if(!items.length)return;api.record('Mover puntos');applyMove(items,new THREE.Vector3(...delta));draw();api.status('Puntos movidos. Ctrl + Z lo deshace.');}catch(e){api.status(e.message);}};
  $('pointWeld').onclick=()=>{try{const items=targets().filter(r=>r.ids.size>=2);if(!items.length)throw new Error('Selecciona al menos dos puntos de una misma pieza.');const changes=items.map(r=>[r.mesh,weldPoints(r.source,r.ids)]);api.record('Soldar puntos');for(const [mesh,g] of changes)mesh.geometry=g;selection.clear();draw();api.status('Puntos soldados por pieza, conservando las UV. Ctrl + Z lo deshace.');}catch(e){api.status(e.message);}};
  $('componentInvert').onclick=()=>{const targets=meshes().filter(m=>selection.get(m.uuid)?.size);if(!targets.length)return;const changed=targets.map(m=>[m,invertTriangles(m.geometry,selection.get(m.uuid))]);api.record('Invertir caras seleccionadas');for(const [m,g] of changed)m.geometry=g;selection.clear();draw();api.status('Caras seleccionadas invertidas. Ctrl + Z lo deshace.');};
  $('pointsToFaces').onclick=()=>{const next=new Map();for(const m of meshes())next.set(m.uuid,new Set(facesFromPoints(m.geometry,selection.get(m.uuid)||new Set())));mode='faces';selection=next;$('componentMode').value=mode;draw();};
  $('layerMode').addEventListener('change',()=>{setMode($('componentMode').value);});
  return {selectedFaces:()=>mode==='faces'?meshes().filter(m=>selection.get(m.uuid)?.size).map(mesh=>({mesh,faces:new Set(selection.get(mesh.uuid))})):[],selectedObjects:()=>meshes().filter(m=>selection.get(m.uuid)?.size),active:()=>mode!=='objects',busy:()=>dragging||suppress||!!gizmo.axis,isDragging:()=>dragging||suppress,stopGizmo(){moving=false;gizmo.detach();},reset(){selection.clear();draw();},setMode,setTransformMode,
    box(rect,gesture){if(mode==='objects')return false;const hits=[];for(const m of meshes())if(mode==='points'){for(const i of activePoints(m.geometry))if(inside(projected(m,i),rect))hits.push([m,i]);}else eachFace(m,(f,ids)=>{if(ids.every(i=>inside(projected(m,i),rect)))hits.push([m,f]);});apply(hits,gesture);return true;},
    click(ray,event,gesture){if(mode==='objects')return false;api.root()?.updateWorldMatrix(true,true);let hits=[];
      if(mode==='faces'){let nearest=Infinity;for(const m of meshes())eachFace(m,(f,ids)=>{const point=ray.ray.intersectTriangle(...ids.map(i=>world(m,i)),false,new THREE.Vector3());if(point){const distance=point.distanceTo(ray.ray.origin);if(distance<nearest){nearest=distance;hits=[[m,f]];}}});}
      else{const r=api.canvas.getBoundingClientRect(),x=event.clientX-r.left,y=event.clientY-r.top;let nearest=9;for(const m of meshes())for(const i of activePoints(m.geometry)){const p=projected(m,i);if(p.z<-1||p.z>1)continue;const d=Math.hypot((p.x+1)*r.width/2-x,(1-p.y)*r.height/2-y);if(d<nearest-.01){nearest=d;hits=[[m,i]];}else if(Math.abs(d-nearest)<.01)hits.push([m,i]);}}
      apply(hits,gesture);return true;}
  };
}

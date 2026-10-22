import { observeLanguage } from './i18n.js';
import * as THREE from 'three';

export function transformUV(geometry,{x=0,y=0,angle=0,scaleX=1,scaleY=1}){
  if(![x,y,angle,scaleX,scaleY].every(Number.isFinite)||scaleX===0||scaleY===0)throw Error('Introduce valores válidos y una escala distinta de cero.');
  if(!geometry.attributes.uv)throw Error('Esta pieza no tiene un mapa UV.');
  const result=new THREE.BufferGeometry().copy(geometry);delete result.parameters;const uv=geometry.attributes.uv,values=new Float32Array(uv.count*2),r=angle*Math.PI/180,c=Math.cos(r),s=Math.sin(r);
  for(let i=0;i<uv.count;i++){const u=(uv.getX(i)-.5)*scaleX,v=(uv.getY(i)-.5)*scaleY;values[i*2]=u*c-v*s+.5+x;values[i*2+1]=u*s+v*c+.5+y;}
  result.setAttribute('uv',new THREE.BufferAttribute(values,2));return result;
}

export function uvEdges(geometry){
  const uv=geometry.attributes.uv;if(!uv)return [];
  const index=geometry.index,count=index?.count??uv.count,edges=new Map();
  for(let i=geometry.drawRange.start;i+2<Math.min(count,geometry.drawRange.start+geometry.drawRange.count);i+=3){
    const vertices=[0,1,2].map(j=>{const n=index?index.getX(i+j):i+j;return [uv.getX(n),uv.getY(n)];});
    for(let j=0;j<3;j++){const a=vertices[j],b=vertices[(j+1)%3],key=[a.join(','),b.join(',')].sort().join(':');edges.set(key,[a,b]);}
  }return [...edges.values()];
}

export function uvTriangles(g){
  const uv=g.attributes?.uv;if(!uv)return [];
  const out=[],count=g.index?.count??uv.count;
  for(let i=g.drawRange.start;i+2<Math.min(count,g.drawRange.start+g.drawRange.count);i+=3)out.push({face:i/3,points:[0,1,2].map(j=>{const n=g.index?g.index.getX(i+j):i+j;return [uv.getX(n),uv.getY(n)];})});return out;
}
export function transformUVFaces(source,faces,options){
  if(!faces.size)throw Error('Selecciona caras en el mapa UV.');
  const g=source.index?source.toNonIndexed():new THREE.BufferGeometry().copy(source);delete g.parameters;g.userData=structuredClone(source.userData);
  if(source.index&&g.userData.weldGroups){const corners=new Map();for(let i=0;i<source.index.count;i++){const v=source.index.getX(i);if(!corners.has(v))corners.set(v,[]);corners.get(v).push(i);}g.userData.weldGroups=g.userData.weldGroups.map(group=>group.flatMap(v=>corners.get(v)||[]));}
  const uv=g.attributes.uv;if(!uv)throw Error('La pieza no tiene UV.');
  const ids=[...faces].flatMap(f=>{if(!Number.isInteger(f)||f<0||f*3+2>=uv.count)throw Error('Cara UV inválida.');return [f*3,f*3+1,f*3+2];});
  const center=[0,1].map(axis=>{const values=ids.map(i=>uv.getComponent(i,axis));return (values.reduce((a,b)=>Math.min(a,b),Infinity)+values.reduce((a,b)=>Math.max(a,b),-Infinity))/2;});
  const {x=0,y=0,angle=0,scaleX=1,scaleY=1}=options;
  if(![x,y,angle,scaleX,scaleY].every(Number.isFinite)||scaleX===0||scaleY===0)throw Error('Introduce valores UV válidos.');
  const r=angle*Math.PI/180,c=Math.cos(r),s=Math.sin(r);
  for(const i of ids){const u=(uv.getX(i)-center[0])*scaleX,v=(uv.getY(i)-center[1])*scaleY;uv.setXY(i,u*c-v*s+center[0]+x,u*s+v*c+center[1]+y);}uv.needsUpdate=true;return g;
}

// Keep coincident triangle corners together, but preserve seams with different UVs.
export function uvVertices(g){
  const uv=g.attributes?.uv,p=g.attributes?.position;if(!uv||!p)return [];
  const groups=new Map(),count=g.index?.count??uv.count;
  for(let c=g.drawRange.start;c<Math.min(count,g.drawRange.start+g.drawRange.count);c++){
    const i=g.index?g.index.getX(c):c,key=[p.getX(i),p.getY(i),p.getZ(i),uv.getX(i),uv.getY(i)].join(',');
    if(!groups.has(key))groups.set(key,{ids:[],point:[uv.getX(i),uv.getY(i)]});
    const group=groups.get(key);if(!group.ids.includes(i))group.ids.push(i);
  }return [...groups.values()];
}
export function moveUVVertices(source,ids,x,y){
  if(!ids.size)throw Error('Selecciona vértices UV.');
  if(!Number.isFinite(x)||!Number.isFinite(y))throw Error('Desplazamiento UV inválido.');
  const g=new THREE.BufferGeometry().copy(source);delete g.parameters;g.userData=structuredClone(source.userData);
  const uv=g.attributes.uv;if(!uv)throw Error('La pieza no tiene UV.');
  for(const i of ids){if(!Number.isInteger(i)||i<0||i>=uv.count)throw Error('Vértice UV inválido.');uv.setXY(i,uv.getX(i)+x,uv.getY(i)+y);}
  uv.needsUpdate=true;return g;
}

export function uvViewPoint(view,x,y){return [(x-view.x)/view.zoom,1-(y-view.y)/view.zoom];}
export function zoomUVView(view,x,y,factor){
  const zoom=Math.max(.1,Math.min(100,view.zoom*factor)),ratio=zoom/view.zoom;
  return {zoom,x:x-(x-view.x)*ratio,y:y-(y-view.y)*ratio};
}

export function installUVEditor(api){
  const panel=document.createElement('section');panel.id='uvEditor';panel.hidden=true;
  panel.innerHTML='<div class="uv-toolbar"><h3>Editor UV</h3><button id="uvBack">Volver al modelo</button></div><p id="uvName" class="hint"></p><div class="uv-toolbar"><select id="uvMode" aria-label="Herramienta UV"><option value="vertices">Vértices: seleccionar y arrastrar</option><option value="select">Seleccionar caras</option><option value="move">Mover selección</option><option value="rotate">Girar selección</option><option value="scale">Escalar selección</option></select><button id="uvAll">Seleccionar todo</button><button id="uvNone">Deseleccionar</button></div><label><input id="uvBackground" type="checkbox" checked> Mostrar textura de fondo</label><select id="uvMaterial" aria-label="Textura de fondo"></select><canvas id="uvCanvas" width="768" height="768" aria-label="Editor de caras UV"></canvas><p class="hint">Rueda: zoom sobre el cursor. Botón central + arrastrar: mover vista. Vértices: pulsa y arrastra un punto para moverlo. Arrastra sobre un espacio vacío para seleccionar varios. Ctrl añade; Ctrl + Mayús quita. Elige mover, girar o escalar y arrastra. Los puntos naranjas están seleccionados. Ctrl + Z deshace.</p><fieldset id="uvFields" disabled><label>Desplazamiento U / V</label><div class="coordinates"><input id="uvX" type="number" value="0" step=".01" aria-label="Desplazamiento U"><input id="uvY" type="number" value="0" step=".01" aria-label="Desplazamiento V"></div><label>Escala U / V</label><div class="coordinates"><input id="uvScaleX" type="number" value="1" step=".1" aria-label="Escala U"><input id="uvScaleY" type="number" value="1" step=".1" aria-label="Escala V"></div><label>Giro en grados<input id="uvAngle" type="number" value="0" step="1"></label><button id="uvApply">Aplicar a caras seleccionadas</button><div class="uv-toolbar"><select id="uvResolution" aria-label="Resolución PNG"><option>1024</option><option selected>2048</option><option>4096</option></select><input id="uvLineColor" type="color" value="#000000" aria-label="Color de líneas"><button id="uvExport">Exportar PNG transparente</button></div></fieldset><p class="hint">El PNG contiene solo las líneas de toda la pieza, sin fondo ni textura. Se exporta el cuadrado 0–1; lo que quede fuera se recorta.</p>';
  document.querySelector('main').insertBefore(panel,document.querySelector('.properties'));
  const tabs=document.createElement('nav');tabs.className='work-tabs';tabs.setAttribute('role','tablist');tabs.setAttribute('aria-label','Área de trabajo');tabs.innerHTML='<button id="workModel" role="tab" aria-selected="true">Modelo 3D</button><button id="workUV" role="tab" aria-selected="false">Editor UV</button>';document.querySelector('main').before(tabs);
  const $=id=>panel.querySelector('#'+id)||document.getElementById(id),canvas=$('uvCanvas');let lastMesh,lastGeometry,lastMaterial,faces=new Set(),vertices=new Set(),drag=null;
  let floating=null,view={zoom:1,x:0,y:0},pan=null;
  const resetView=document.createElement('button');resetView.textContent='Restablecer vista';panel.querySelector('.uv-toolbar').append(resetView);
  resetView.onclick=()=>{if(drag||pan)return;view={zoom:1,x:0,y:0};paint();};
  const anchor=document.createComment('UV dock');panel.before(anchor);
  const detach=document.createElement('button');detach.textContent='↗ Abrir en otra ventana';panel.querySelector('.uv-toolbar').append(detach);
  function dock(){
    if(!floating)return;
    const old=floating;floating=null;anchor.after(panel);document.body.classList.remove('uv-detached');detach.textContent='↗ Abrir en otra ventana';
    if(!old.closed)old.close();paint();
  }
  detach.onclick=()=>{
    if(floating){dock();return;}
    const popup=window.open('about:blank','abt-uv','width=900,height=900');
    if(!popup){api.status('No se ha podido abrir la ventana UV.');return;}
    floating=popup;popup.document.title='Editor UV · Arma 3 Better Tools';
    for(const node of document.querySelectorAll('link[rel="stylesheet"],style')){const copy=node.cloneNode(true);if(copy.tagName==='LINK')copy.href=node.href;popup.document.head.append(copy);}
    const style=popup.document.createElement('style');style.textContent='body{margin:0;overflow:auto;height:auto}#uvEditor{min-height:100vh;box-sizing:border-box;border:0}';popup.document.head.append(style);
    popup.document.body.append(panel);document.body.classList.add('uv-detached');detach.textContent='↙ Volver a acoplar';
    observeLanguage(popup.document);popup.addEventListener('beforeunload',dock);
    popup.addEventListener('keydown',e=>{if((e.ctrlKey||e.metaKey)&&['s','z','y'].includes(e.key.toLowerCase())){if(e.key.toLowerCase()!=='s'&&/INPUT|TEXTAREA/.test(e.target.tagName))return;e.preventDefault();document.body.dispatchEvent(new KeyboardEvent('keydown',{bubbles:true,key:e.key,ctrlKey:e.ctrlKey,metaKey:e.metaKey,shiftKey:e.shiftKey}));}});
    paint();
  };
  window.addEventListener('unload',()=>{if(floating&&!floating.closed)floating.close();});
  const selected=()=>{const items=api.selection();return items.length===1&&items[0].isMesh?items[0]:null;};
  function lines(target,g,color,width){const ctx=target.getContext('2d');ctx.strokeStyle=color;ctx.lineWidth=width;ctx.beginPath();for(const [a,b] of uvEdges(g)){ctx.moveTo(a[0]*target.width,(1-a[1])*target.height);ctx.lineTo(b[0]*target.width,(1-b[1])*target.height);}ctx.stroke();}
  function paint(){const ctx=canvas.getContext('2d');ctx.clearRect(0,0,768,768);const mesh=selected();if(!mesh?.geometry.attributes.uv)return;
    ctx.save();ctx.translate(view.x*768,view.y*768);ctx.scale(view.zoom,view.zoom);ctx.strokeStyle='#8795a6';ctx.lineWidth=1/view.zoom;ctx.strokeRect(0,0,768,768);
    const mats=Array.isArray(mesh.material)?mesh.material:[mesh.material],map=mats[Number($('uvMaterial').value)||0]?.map;
    if($('uvBackground').checked&&map?.image){ctx.save();ctx.globalAlpha=.75;if(!map.flipY){ctx.translate(0,768);ctx.scale(1,-1);}try{ctx.drawImage(map.image,0,0,768,768);}catch{}ctx.restore();}
    ctx.fillStyle='#ff9f404d';for(const t of uvTriangles(mesh.geometry))if(faces.has(t.face)){ctx.beginPath();t.points.forEach(([u,v],i)=>i?ctx.lineTo(u*768,(1-v)*768):ctx.moveTo(u*768,(1-v)*768));ctx.closePath();ctx.fill();}
    lines(canvas,mesh.geometry,'#ffbd7e',1.5/view.zoom);
    if($('uvMode').value==='vertices')for(const v of uvVertices(mesh.geometry)){ctx.beginPath();ctx.arc(v.point[0]*768,(1-v.point[1])*768,(vertices.has(v.ids[0])?5:3.5)/view.zoom,0,Math.PI*2);ctx.fillStyle=vertices.has(v.ids[0])?'#ff8c32':'#e5f4ff';ctx.fill();ctx.strokeStyle='#172029';ctx.lineWidth=1/view.zoom;ctx.stroke();}
    if((drag?.mode==='select'||drag?.mode==='vertexSelect')&&drag.end){ctx.strokeStyle='#ffffff';ctx.lineWidth=1/view.zoom;ctx.strokeRect(drag.start[0]*768,(1-drag.start[1])*768,(drag.end[0]-drag.start[0])*768,(drag.start[1]-drag.end[1])*768);}
    ctx.restore();
  }
  function update(){const mesh=selected();if(mesh===lastMesh&&mesh?.geometry===lastGeometry&&mesh?.material===lastMaterial)return;
    if(mesh!==lastMesh){faces.clear();vertices.clear();drag=null;}lastMesh=mesh;lastGeometry=mesh?.geometry;lastMaterial=mesh?.material;
    const mats=mesh?(Array.isArray(mesh.material)?mesh.material:[mesh.material]):[],previous=$('uvMaterial').value;
    $('uvMaterial').replaceChildren(...mats.map((m,i)=>new Option(m.userData.armaLibrary?.name||'Material '+(i+1),String(i))));$('uvMaterial').value=previous||'0';
    $('uvFields').disabled=!mesh?.geometry.attributes.uv;$('uvName').toggleAttribute('data-no-i18n',!!mesh);$('uvName').textContent=mesh?(mesh.name||'Pieza')+(mesh.geometry.attributes.uv?'':' · Sin mapa UV'):'Selecciona una sola pieza del modelo.';paint();
  }
  function open(){api.close();api.stop?.();document.body.classList.add('uv-workspace');$('workModel').setAttribute('aria-selected','false');$('workUV').setAttribute('aria-selected','true');panel.hidden=false;if(floating)floating.focus();update();paint();}
  $('workUV').onclick=open;$('workModel').onclick=$('uvBack').onclick=()=>{dock();document.body.classList.remove('uv-workspace');$('workModel').setAttribute('aria-selected','true');$('workUV').setAttribute('aria-selected','false');panel.hidden=true;};
  $('uvMode').onchange=()=>{vertices.clear();paint();};
  $('uvAll').onclick=()=>{vertices=new Set(uvVertices(selected()?.geometry||{}).flatMap(v=>v.ids));faces=new Set(uvTriangles(selected()?.geometry||{}).map(t=>t.face));paint();};$('uvNone').onclick=()=>{faces.clear();vertices.clear();paint();};$('uvBackground').onchange=$('uvMaterial').onchange=paint;
  const screenPoint=e=>{const r=canvas.getBoundingClientRect();return [(e.clientX-r.left)/r.width,(e.clientY-r.top)/r.height];};
  const point=e=>uvViewPoint(view,...screenPoint(e));
  canvas.addEventListener('wheel',e=>{e.preventDefault();if(drag||pan)return;const delta=e.deltaY*(e.deltaMode===1?16:e.deltaMode===2?canvas.clientHeight:1);view=zoomUVView(view,...screenPoint(e),Math.exp(-Math.max(-500,Math.min(500,delta))*.0015));paint();},{passive:false});
  canvas.onauxclick=e=>{if(e.button===1)e.preventDefault();};
  canvas.onpointerdown=e=>{if(e.button===1){e.preventDefault();if(drag||pan)return;canvas.setPointerCapture(e.pointerId);pan={start:screenPoint(e),view:{...view}};canvas.style.cursor='grabbing';return;}if(pan||drag)return;if(e.button!==0||!selected()?.geometry.attributes.uv)return;e.preventDefault();canvas.setPointerCapture(e.pointerId);drag={mode:$('uvMode').value,start:point(e),source:selected().geometry,mesh:selected(),ctrl:e.ctrlKey||e.metaKey,subtract:(e.ctrlKey||e.metaKey)&&e.shiftKey,recorded:false};
    if(drag.mode==='vertices'){
      const r=canvas.getBoundingClientRect(),p=drag.start;
      const hits=uvVertices(drag.source).filter(v=>Math.hypot((v.point[0]-p[0])*r.width*view.zoom,(v.point[1]-p[1])*r.height*view.zoom)<=9);
      if(hits.length){const ids=hits.flatMap(v=>v.ids);if(!drag.ctrl&&!ids.some(i=>vertices.has(i)))vertices.clear();for(const i of ids)drag.subtract?vertices.delete(i):vertices.add(i);drag.mode=drag.subtract?'vertexClick':'vertexMove';drag.ids=new Set(vertices);}
      else drag.mode='vertexSelect';paint();
    }
  };
  canvas.onpointermove=e=>{if(pan){const p=screenPoint(e);view={...pan.view,x:pan.view.x+p[0]-pan.start[0],y:pan.view.y+p[1]-pan.start[1]};paint();return;}if(!drag)return;drag.end=point(e);if(drag.mode==='select'||drag.mode==='vertexSelect'){paint();return;}if(drag.mode==='vertexClick'||(drag.mode==='vertexMove'?!drag.ids.size:!faces.size))return;const dx=drag.end[0]-drag.start[0],dy=drag.end[1]-drag.start[1];if(!drag.recorded&&Math.hypot(dx,dy)*view.zoom<.003)return;
    try{const options=drag.mode==='move'?{x:dx,y:dy}:drag.mode==='rotate'?{angle:dx*360}:{scaleX:Math.exp(dx*3),scaleY:Math.exp(dx*3)};const next=drag.mode==='vertexMove'?moveUVVertices(drag.source,drag.ids,dx,dy):transformUVFaces(drag.source,faces,options);if(!drag.recorded){api.close();api.record(drag.mode==='vertexMove'?'Mover vértices UV':'Transformar caras UV');if(drag.mode!=='vertexMove')vertices.clear();drag.recorded=true;}drag.mesh.geometry=next;lastGeometry=next;paint();}catch(error){api.status(error.message);}
  };
  canvas.onpointerup=e=>{if(pan){if(e.button===1){pan=null;canvas.style.cursor='';}return;}if(e.button!==0||!drag)return;const d=drag;drag=null;const end=point(e);
    if(d.mode==='vertexSelect'){
      if(!d.ctrl)vertices.clear();
      for(const v of uvVertices(d.source))if(v.point.every((n,i)=>n>=Math.min(d.start[i],end[i])&&n<=Math.max(d.start[i],end[i])))for(const id of v.ids)d.subtract?vertices.delete(id):vertices.add(id);
      api.status('Arrastra un punto seleccionado para mover la selección UV.');
    }else if(d.mode==='select'){const click=Math.hypot(end[0]-d.start[0],end[1]-d.start[1])*view.zoom<.007;let hits=[];
      for(const t of uvTriangles(d.source)){if(click){const [a,b,c]=t.points,den=(b[1]-c[1])*(a[0]-c[0])+(c[0]-b[0])*(a[1]-c[1]);if(Math.abs(den)<1e-12)continue;const u=((b[1]-c[1])*(end[0]-c[0])+(c[0]-b[0])*(end[1]-c[1]))/den,v=((c[1]-a[1])*(end[0]-c[0])+(a[0]-c[0])*(end[1]-c[1]))/den;if(u>=0&&v>=0&&u+v<=1)hits.push(t.face);}else if(t.points.every(p=>p.every((v,i)=>v>=Math.min(d.start[i],end[i])&&v<=Math.max(d.start[i],end[i]))))hits.push(t.face);}
      if(click&&hits.length>1)hits=[hits.find(f=>!faces.has(f))??hits[hits.length-1]];if(!d.ctrl)faces.clear();for(const f of hits)d.subtract?faces.delete(f):faces.add(f);api.status(faces.size+' caras UV seleccionadas.');
    }else if(d.recorded)api.status('UV ajustados. Ctrl + Z deshace.');paint();
  };
  canvas.onpointercancel=()=>{pan=null;canvas.style.cursor='';if(drag?.recorded)drag.mesh.geometry=drag.source;drag=null;lastGeometry=null;update();};
  $('uvApply').onclick=()=>{try{const mesh=selected();if(!mesh)throw Error('Selecciona una pieza.');const next=transformUVFaces(mesh.geometry,faces,{x:$('uvX').valueAsNumber,y:$('uvY').valueAsNumber,angle:$('uvAngle').valueAsNumber,scaleX:$('uvScaleX').valueAsNumber,scaleY:$('uvScaleY').valueAsNumber});api.close();api.record('Ajustar caras UV');vertices.clear();mesh.geometry=next;update();api.status('UV ajustados. Ctrl + Z deshace.');}catch(e){api.status(e.message);}};
  $('uvExport').onclick=()=>{const mesh=selected();if(!mesh?.geometry.attributes.uv)return;const output=document.createElement('canvas');output.width=output.height=Number($('uvResolution').value);lines(output,mesh.geometry,$('uvLineColor').value,Math.max(1,output.width/1024));output.toBlob(blob=>{if(!blob)return;const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=(mesh.name||'pieza').replace(/[^a-z0-9_-]/gi,'_')+'_UV.png';a.click();setTimeout(()=>URL.revokeObjectURL(url),60000);api.status('PNG UV: solo líneas sobre fondo transparente.');},'image/png');};
  return {update,open};
}

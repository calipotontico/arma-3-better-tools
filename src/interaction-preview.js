import * as THREE from 'three';
import {TransformControls} from 'three/addons/controls/TransformControls.js';
import {getLanguage,onLanguage} from './i18n.js';
export function setSeatPose(mesh,position,worldHeading){
  mesh.updateWorldMatrix(true,false);
  const previous=previewPose(mesh,'seat');
  const exit=previous.exit.clone().sub(previous.position).applyAxisAngle(new THREE.Vector3(0,1,0),worldHeading-previous.heading).add(position);
  const direction=new THREE.Vector3(-Math.sin(worldHeading),0,-Math.cos(worldHeading)).transformDirection(mesh.matrixWorld.clone().invert());
  mesh.userData.armaSeat={...mesh.userData.armaSeat,position:mesh.worldToLocal(position.clone()).toArray(),exit:mesh.worldToLocal(exit).toArray(),heading:THREE.MathUtils.radToDeg(Math.atan2(direction.x,-direction.z))};
}
export function previewPose(mesh,kind,progress=.5){
  mesh.updateWorldMatrix(true,false);
  const data=mesh.userData[kind==='seat'?'armaSeat':'armaLadder'];
  if(!data)return null;
  const world=p=>mesh.localToWorld(new THREE.Vector3(...p));
  if(kind==='seat'){
    const a=THREE.MathUtils.degToRad(data.heading),direction=new THREE.Vector3(Math.sin(a),0,-Math.cos(a)).transformDirection(mesh.matrixWorld);
    return {position:world(data.position),exit:world(data.exit),heading:Math.atan2(-direction.x,-direction.z)};
  }
  const start=world(data.start),end=world(data.end),direction=end.clone().sub(start);direction.y=0;
  return {position:start.clone().lerp(end,progress),start,exit:end,heading:Math.atan2(-direction.x,-direction.z)};
}
function figure(seated){
  const group=new THREE.Group(),material=new THREE.MeshStandardMaterial({color:0xff973d,transparent:true,opacity:.72,roughness:.8});
  const box=(size,position)=>{const m=new THREE.Mesh(new THREE.BoxGeometry(...size),material);m.position.set(...position);group.add(m);};
  const limb=(a,b,r=.065)=>{const start=new THREE.Vector3(...a),end=new THREE.Vector3(...b),delta=end.clone().sub(start);const m=new THREE.Mesh(new THREE.CylinderGeometry(r,r,delta.length(),8),material);m.position.copy(start.add(end).multiplyScalar(.5));m.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),delta.normalize());group.add(m);};
  const hip=seated?.57:.95,shoulder=hip+.48;
  box([.34,.48,.22],[0,hip+.24,0]);
  const head=new THREE.Mesh(new THREE.SphereGeometry(.14,14,10),material);head.position.set(0,shoulder+.2,0);group.add(head);
  for(const x of [-.12,.12]){
    const knee=seated?[x,.53,-.43]:[x,hip-.30,-.20],ankle=seated?[x,.09,-.43]:[x,hip-.70,-.08];
    limb([x,hip,0],knee,.08);limb(knee,ankle,.065);box([.13,.10,.25],[ankle[0],ankle[1]-.04,ankle[2]-.07]);
    limb([x*1.7,shoulder,0],[x*1.9,shoulder-.20,-.23]);limb([x*1.9,shoulder-.20,-.23],[x*1.9,seated?hip+.12:shoulder+.12,-.44]);
  }
  return group;
}
export function installInteractionPreview({scene,root,camera,canvas,orbit,record,stopOthers,refresh,status}){
  const group=new THREE.Group();group.name='Editor interaction preview';scene.add(group);
  const seated=figure(true),climbing=figure(false);group.add(seated,climbing);
  const markerMaterial=new THREE.MeshBasicMaterial({color:0x6ed7af});
  const start=new THREE.Mesh(new THREE.SphereGeometry(.065,12,8),markerMaterial),exit=start.clone();group.add(start,exit);
  const line=new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(),new THREE.Vector3()]),new THREE.LineBasicMaterial({color:0x6ed7af}));group.add(line);
  let active=null;const controls={};
  const gizmo=new TransformControls(camera,canvas);gizmo.setSpace('world');scene.add(gizmo.getHelper());
  let dragging=false,suppress=false,editing=null;
  const tr=(es,en)=>getLanguage()==='en'?en:es;
  function stopGizmo(){gizmo.detach();editing=null;dragging=false;orbit.enabled=true;}
  function activate(mode){
    const mesh=root()?.getObjectByProperty('uuid',document.getElementById('seatList')?.value);
    if(!mesh?.userData.armaSeat){status(tr('Crea o selecciona un asiento primero.','Create or select a seat first.'));return;}
    stopOthers();controls.seat.check.checked=true;active={kind:'seat',id:mesh.uuid};editing=mesh;
    const pose=previewPose(mesh,'seat');group.visible=true;seated.visible=true;climbing.visible=false;seated.position.copy(pose.position);seated.rotation.set(0,pose.heading,0);
    gizmo.setMode(mode);gizmo.showX=mode==='translate';gizmo.showZ=mode==='translate';gizmo.showY=true;gizmo.attach(seated);
    status(tr('Arrastra las flechas para colocar el muñeco o el aro verde para girarlo. Ctrl + Z deshace.','Drag the arrows to position the figure or the green ring to rotate it. Ctrl + Z undoes changes.'));
  }
  gizmo.addEventListener('dragging-changed',e=>{orbit.enabled=!e.value;});
  gizmo.addEventListener('mouseDown',()=>{if(!editing)return;record(tr('Colocar personaje sentado','Position seated character'));dragging=true;suppress=true;});
  gizmo.addEventListener('objectChange',()=>{
    if(!dragging||!editing)return;const facing=new THREE.Vector3(0,0,-1).applyQuaternion(seated.quaternion);setSeatPose(editing,seated.position,Math.atan2(-facing.x,-facing.z));
    const input=document.getElementById('seatHeading');if(input)input.value=Number(editing.userData.armaSeat.heading.toFixed(3));
  });
  gizmo.addEventListener('mouseUp',()=>{dragging=false;refresh();setTimeout(()=>suppress=false,0);});
  window.addEventListener('keydown',e=>{if(dragging&&(e.ctrlKey||e.metaKey)){e.preventDefault();e.stopImmediatePropagation();}else if(e.key==='Escape')stopGizmo();},true);
  seated.add(new THREE.ArrowHelper(new THREE.Vector3(0,0,-1),new THREE.Vector3(0,.65,-.15),.75,0x6ed7af,.16,.08));
  for(const [kind,id] of [['seat','seatPanel'],['ladder','ladderPanel']]){
    const host=document.getElementById(id),section=document.createElement('section');section.dataset.noI18n='';
    const label=document.createElement('label'),check=document.createElement('input'),text=document.createElement('span'),hint=document.createElement('p');check.type='checkbox';check.checked=true;check.id=kind+'Preview';label.append(check,text);section.append(label,hint);hint.className='hint';
    let range=null;
    if(kind==='seat'){
      for(const [mode,es,en] of [['translate','Mover muñeco','Move figure'],['rotate','Girar muñeco','Rotate figure'],['done','Terminar ajuste','Finish adjustment']]){
        const button=document.createElement('button');button.id='seatFigure-'+mode;section.append(button);
        const label=()=>button.textContent=tr(es,en);label();onLanguage(label);button.onclick=()=>mode==='done'?stopGizmo():activate(mode);
      }
    }
    if(kind==='ladder'){range=document.createElement('input');range.type='range';range.min=0;range.max=100;range.value=50;range.id='ladderPreviewProgress';section.append(range);}
    // Panels rebuild on language changes. Reattach the same controls afterwards.
    const attach=()=>{host.prepend(section);text.textContent=getLanguage()==='en'?'Show character preview':'Mostrar vista previa del personaje';hint.textContent=getLanguage()==='en'?'Approximate pose. Green points mark entry/exit. Validate the animation in Arma.':'Postura orientativa. Los puntos verdes indican entrada/salida. Comprueba la animación en Arma.';if(kind==='seat')hint.textContent=tr('Mueve y gira el muñeco para guardar la posición y orientación del asiento. La flecha indica hacia dónde mira. Postura orientativa; comprueba el ajuste final en Arma.','Move and rotate the figure to save the seat position and heading. The arrow shows its facing direction. Approximate pose; verify the final fit in Arma.');if(range)range.setAttribute('aria-label',getLanguage()==='en'?'Climb progress':'Progreso de subida');};
    attach();onLanguage(attach);controls[kind]={host,check,range};
    window.addEventListener('edit-'+kind+'-memory',event=>{active={kind,id:event.detail.id};});
  }
  return {stopGizmo,busy:()=>dragging||suppress||!!gizmo.axis,isDragging:()=>dragging||suppress,
    pick(ray){if(!group.visible||!seated.visible||!ray.intersectObject(seated,true).length)return false;activate('translate');return true;},
    update(){
    const model=root();group.visible=false;if(!model)return;
    if(editing&&(model.getObjectByProperty('uuid',editing.uuid)!==editing||!editing.userData.armaSeat||!controls.seat.host.checkVisibility()||!controls.seat.check.checked||document.getElementById('seatList')?.value!==editing.uuid))stopGizmo();
    for(const kind of ['seat','ladder'])if(controls[kind].host.checkVisibility()){
      const id=document.getElementById(kind+'List')?.value;if(id)active={kind,id};
    }
    if(!active)return;
    const {kind,id}=active,c=controls[kind],memory=document.getElementById('layerMode');
    if(!c.check.checked||(!c.host.checkVisibility()&&!(memory?.value==='memory'&&memory.checkVisibility())))return;
    const mesh=model.getObjectByProperty('uuid',id);if(!mesh)return;
    for(let p=mesh;p;p=p.parent)if(!p.visible)return;
    const pose=previewPose(mesh,kind,c.range?Number(c.range.value)/100:.5);if(!pose)return;
    group.visible=true;seated.visible=kind==='seat';climbing.visible=kind==='ladder';const person=kind==='seat'?seated:climbing;
    if(!dragging){person.position.copy(pose.position);person.rotation.set(0,pose.heading,0);}
    exit.position.copy(pose.exit);start.position.copy(pose.start||pose.position);line.visible=kind==='ladder';
    if(pose.start){const positions=line.geometry.attributes.position;positions.setXYZ(0,pose.start.x,pose.start.y,pose.start.z);positions.setXYZ(1,pose.exit.x,pose.exit.y,pose.exit.z);positions.needsUpdate=true;line.geometry.computeBoundingSphere();}
  }};
}

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Group, Mesh, BoxGeometry, PlaneGeometry, MeshStandardMaterial, Texture } from 'three';
import { exportModel } from './export-model.js';
import { configs } from './config.js';
import { tintPixels } from './texture-color.js';
import { groupDoor, proposeAxis } from '../door.js';
import { defaultShape, rectangularOpening, setShapes } from '../layers.js';
import { cloneScene, History } from '../history.js';
import { ObjectLoader } from 'three';
import { invertFaces } from '../editing.js';
import { invertTriangles } from '../subobjects.js';
import { planRecalculation, applyRecalculation } from '../recalculate.js';
import { scaleBuilding } from '../scale-editor.js';
import { generateShadows } from '../shadows.js';
import { glassDefaults,glassPixels,glassHitPoints,glassFireShape } from '../glass.js';
import { packPbo, readPbo } from '../../desktop/pbo.mjs';
import {readLights,writeLights,syncSwitch,moveLightPoint,lightDefaults} from '../lighting-data.js';
import { lightConfig } from './light-config.js';

// Independent reader checks record boundaries, selection masks and face indices.
function readMlod(bytes){
  const b=Buffer.from(bytes);let p=0;
  const u=()=>{const v=b.readUInt32LE(p);p+=4;return v;},f=()=>{const v=b.readFloatLE(p);p+=4;return v;};
  const s=n=>{const v=b.toString('ascii',p,p+n);p+=n;return v;};
  const z=()=>{const end=b.indexOf(0,p);assert.ok(end>=p);return s(end-p+1).slice(0,-1);};
  assert.equal(s(4),'MLOD');assert.equal(u(),257);const count=u(),lods=[];
  for(let i=0;i<count;i++){
    assert.equal(s(4),'P3DM');assert.equal(u(),28);assert.equal(u(),256);
    const np=u(),nn=u(),nf=u();u();const points=[];for(let j=0;j<np;j++){points.push([f(),f(),f()]);u();}p+=nn*12;
    const faces=[];for(let j=0;j<nf;j++){const n=u();assert.ok(n===3||n===4);const face=[];for(let k=0;k<4;k++){const vertex=u(),normal=u(),uv=[f(),f()];if(k<n){assert.ok(vertex<np);assert.ok(normal<nn);face.push({vertex,uv});}}u();const texture=z(),material=z();faces.push({vertices:face,texture,material});}
    assert.equal(s(4),'TAGG');const tags={};for(;;){assert.equal(b[p++],1);const name=z(),size=u();tags[name]=b.subarray(p,p+size);p+=size;if(name==='#EndOfFile#')break;}
    lods.push({points,faces,tags,resolution:f()});
  }assert.equal(p,b.length);return lods;
}
const options={id:'abt_test',label:'Test building',author:'Calipo',scale:1,collision:true,roadway:true};
test('Lamp HDR emission turns off independently of the lightpoint intensity',()=>{
  const result=lightConfig('abt_test',{...lightDefaults(),color:'#ffffff',intensity:500});
  assert.ok(result.assets.find(a=>a.name==='data/light_on.rvmat').text.includes('emmisive[]={100,100,100,1}'));
  assert.ok(result.assets.find(a=>a.name==='data/light_off.rvmat').text.includes('emmisive[]={0,0,0,1}'));
  const script=result.assets.find(a=>a.name==='scripts/light.sqf').text;
  assert.ok(script.includes('setLightIntensity (if (_on) then {500} else {0})'));
  assert.ok(script.includes('setObjectMaterial [0, if (_on)'));
});
test('Moving light Memory preserves mesh transforms, shares switches, saves, undoes and exports scaled coordinates',async()=>{
  let root=new Group();const meshes=Array.from({length:5},()=>new Mesh(new BoxGeometry(.1,.1,.1)));root.add(...meshes);root.scale.setScalar(.5);root.updateMatrixWorld(true);
  writeLights(root,[0,1,2].map(i=>({...lightDefaults(),lampId:meshes[i].uuid,switchId:meshes[i===2?4:3].uuid})));
  const history=new History(()=>cloneScene(root),r=>{root=cloneScene(r);});
  history.record('Mover emisión');moveLightPoint(root,1,'position',[2,4,6]);
  history.record('Mover interruptor');moveLightPoint(root,1,'switchPosition',[8,10,12]);
  assert.deepEqual(readLights(root)[0].switchPosition,[8,10,12]);
  assert.deepEqual(readLights(root)[2].switchPosition,[0,0,0]);
  assert.deepEqual(readLights(root)[0].position,[0,0,0]);
  assert.ok(root.children.every(m=>m.position.length()===0));
  history.undo();assert.deepEqual(readLights(root)[0].switchPosition,[0,0,0]);
  assert.deepEqual(readLights(root)[1].position,[2,4,6]);
  history.redo();root=await new ObjectLoader().parseAsync(root.toJSON());
  const memory=readMlod(exportModel(root,{},options).p3d).find(l=>Math.abs(l.resolution/1e15-1)<1e-6);
  for(const name of ['abt_light_switch','abt_light_switch_2']){
    const index=[...memory.tags[name]].findIndex(v=>v===1);assert.deepEqual(memory.points[index],[4,5,-6]);
  }
  const index=[...memory.tags.abt_light_pos_2].findIndex(v=>v===1);assert.deepEqual(memory.points[index],[1,2,-3]);
  assert.throws(()=>moveLightPoint(root,1,'position',[NaN,0,0]),/inválido/);
});
test('Multiple lights share explicit switches with independent materials, Memory and glass indices',async()=>{
  let root=new Group();const meshes=Array.from({length:6},()=>new Mesh(new BoxGeometry(.1,.1,.1)));root.add(...meshes);meshes.forEach((m,i)=>m.position.x=i);
  root.userData.armaLight={name:'Entrada',lampId:meshes[0].uuid,switchId:meshes[3].uuid,color:'#ffffff',intensity:500,range:4,initialOn:false,actionOn:'Encender entrada',actionOff:'Apagar entrada',position:[0,2,0],switchPosition:[3,1,0]};
  const history=new History(()=>cloneScene(root),r=>{root=cloneScene(r);}),all=structuredClone(readLights(root));history.record('Añadir luces');
  all.push({...all[0],name:'Recepción',lampId:meshes[1].uuid,position:[1,2,0]},{...all[0],name:'Exterior',lampId:meshes[2].uuid,switchId:meshes[4].uuid,position:[2,2,0],switchPosition:[4,1,0],initialOn:true});
  all[0].initialOn=true;syncSwitch(all,0);writeLights(root,all);meshes[5].userData.armaGlass={...glassDefaults};
  root=await new ObjectLoader().parseAsync(root.toJSON());root.scale.setScalar(.5);
  const result=exportModel(root,{},options),lods=readMlod(result.p3d),memory=lods.find(l=>Math.abs(l.resolution/1e15-1)<1e-6);
  assert.equal(result.stats.lights,3);for(const name of ['abt_light_pos','abt_light_pos_2','abt_light_pos_3','abt_light_switch_2'])assert.ok(memory.tags[name]);
  assert.deepEqual(memory.points[2],[.5,1,-0]);
  assert.equal((result.config.match(/class LightOn/g)||[]).length,2);
  assert.ok(!result.config.includes('class LightOn_2'));assert.ok(result.config.includes('class LightOn_3'));
  const script=result.assets.find(a=>a.name==='scripts/light.sqf').text;
  assert.ok(script.includes('setObjectMaterial [2,'));assert.ok(script.includes("getVariable ['abt_light_on_3',true]" )||script.includes('getVariable ["abt_light_on_3",true]'));
  assert.equal((script.match(/getVariable \["abt_light_on",true\]/g)||[]).length,2);
  assert.ok(result.assets.find(a=>a.name==='data/light_3_on.rvmat'));
  assert.ok(result.assets.find(a=>a.name==='scripts/glass.sqf').text.includes('["Glass_1_hitpoint",3,'));
  assert.ok(lods[0].tags.abt_lamp_3);
  history.undo();assert.equal(readLights(root).length,1);history.redo();assert.equal(readLights(root).length,3);
  root.userData.armaLights[1].lampId=root.userData.armaLights[0].lampId;assert.throws(()=>exportModel(root,{},options),/más de una luz/);
});
test('Clean glass exports transparent procedural color, reverse faces and vanilla damage',()=>{
  const root=new Group(),pane=new Mesh(new PlaneGeometry(1,1));root.add(pane);pane.userData.armaGlass={...glassDefaults};
  const result=exportModel(root,{},options),v=readMlod(result.p3d)[0];
  assert.equal(v.faces.length,4);assert.equal(result.textures.length,0);
  for(let i=0;i<4;i+=2){const a=v.faces[i],b=v.faces[i+1];
    const front=a.vertices.map(x=>v.points[x.vertex]),back=b.vertices.map(x=>v.points[x.vertex]).reverse();
    front.forEach((point,j)=>assert.ok(Math.abs(Math.hypot(...point.map((n,k)=>n-back[j][k]))-.001)<1e-6));
    assert.ok(a.vertices.every(x=>x.uv[0]>=.014&&x.uv[0]<=.186&&x.uv[1]>=.019&&x.uv[1]<=.781));
    assert.ok(a.vertices.every(x=>b.vertices.every(y=>x.vertex!==y.vertex)));
    assert.equal(a.texture,'#(argb,8,8,3)color(0.16,0.18,0.18,0.025,ca)');
    assert.equal(b.material,String.raw`abt_test\data\glass.rvmat`);
  }
  const script=result.assets.find(a=>a.name==='scripts/glass.sqf').text;
  assert.ok(script.includes(String.raw`a3\structures_f\data\windows\glass_ca_destruct_new.paa`));
  assert.ok(script.includes('setObjectMaterial'));assert.ok(script.includes('glass_destruct_new.rvmat'));
  assert.equal([...v.tags.Glass_1_hide].filter(Boolean).length,v.points.length+v.faces.length);
});
test('Bullet-resistant glass has a separate physical material while retaining damage, save and undo',async()=>{
  let root=new Group();const ordinary=new Mesh(new BoxGeometry(1,1,.001)),armored=new Mesh(new BoxGeometry(1,1,.001));root.add(ordinary,armored);ordinary.userData.armaGlass={...glassDefaults};armored.userData.armaGlass={...glassDefaults};armored.position.x=2;
  const history=new History(()=>cloneScene(root),s=>{root=cloneScene(s);});history.record('antibalas');armored.userData.armaGlass={...glassDefaults,bulletproof:true,resistance:.01};root.updateMatrixWorld(true);root=await new ObjectLoader().parseAsync(root.toJSON());
  const result=exportModel(root,{},options,{encodeGlassTexture:()=>''}),fire=readMlod(result.p3d).find(l=>Math.abs(l.resolution/7e15-1)<1e-6);
  assert.equal(fire.faces.filter(f=>f.material.endsWith('glass_fire.rvmat')).length,12);assert.equal(fire.faces.filter(f=>f.material.endsWith('glass_armored.rvmat')).length,12);
  assert.ok(result.assets.find(a=>a.name==='data/glass_armored.bisurf').text.includes('bulletPenetrability=1;'));assert.ok(result.assets.find(a=>a.name==='data/glass.bisurf').text.includes('bulletPenetrability=69;'));
  assert.ok(result.config.includes('armor=0.01;'));assert.ok(fire.tags.Glass_2_hide);assert.ok(result.modelCfg.includes('source="Glass_2_source"'));assert.ok(result.assets.find(a=>a.name==='scripts/glass.sqf').text.includes('_damage >= 0.5'));
  history.undo();assert.equal(root.children[1].userData.armaGlass.bulletproof,false);history.redo();assert.equal(root.children[1].userData.armaGlass.bulletproof,true);
  delete root.children[0].userData.armaGlass.bulletproof;assert.equal(exportModel(root,{},options,{encodeGlassTexture:()=>''}).stats.windows,2);
});
test('Ballistic thickness stays at least 3cm after scale and rotation without modifying source shapes',()=>{
  const m=new Mesh(new BoxGeometry(1,1,.001));m.userData.armaGlass={...glassDefaults,bulletproof:true};m.scale.set(.01,.02,.01);m.rotation.y=.5;m.updateMatrixWorld(true);
  const s={size:[1,1,.001],center:[0,0,0],rotation:[0,0,0]},before=structuredClone(s),out=glassFireShape(m,s,.5);
  assert.ok(Math.abs(out.size[2]*.01*.5-.03)<1e-9);assert.deepEqual(s,before);assert.equal(out.size[0],1);
  m.userData.armaGlass.bulletproof=false;assert.deepEqual(glassFireShape(m,s,.5),s);
});
test('Windows move to last faces without corrupting door selections, export damage and remove physical glass with hide bone',async()=>{
  let root=new Group();const wall=new Mesh(new BoxGeometry(3,3,.2)),door=new Mesh(new BoxGeometry(1,2,.1)),pane=new Mesh(new BoxGeometry(1,1,.01));root.add(wall,door,pane);pane.position.set(2,1,.1);pane.rotation.y=.2;
  const doors={[door.uuid]:{...proposeAxis(door),confirmed:true}},history=new History(()=>cloneScene(root),s=>{root=cloneScene(s);});history.record('window');pane.userData.armaGlass={...glassDefaults};generateShadows([wall,door,pane]);root.updateMatrixWorld(true);
  root=await new ObjectLoader().parseAsync(root.toJSON());const result=exportModel(root,doors,options,{encodeGlassTexture:()=>''}),lods=readMlod(result.p3d),v=lods[0];
  assert.equal(result.stats.windows,1);assert.equal(result.textures.length,0);assert.ok(v.faces.slice(-24).every(f=>f.texture.includes('0.025,ca)')));assert.ok(v.faces.slice(0,-24).every(f=>!f.material.endsWith('glass.rvmat')));
  const mask=v.tags.Glass_1_hide.subarray(v.points.length);assert.ok([...mask.slice(-24)].every(Boolean));assert.ok([...mask.slice(0,-24)].every(n=>n===0));assert.equal([...v.tags.door_1.subarray(v.points.length)].filter(Boolean).length,12);
  for(const resolution of [1e13,7e15]){const l=lods.find(l=>Math.abs(l.resolution/resolution-1)<1e-6);assert.equal([...l.tags.Glass_1_hide.subarray(l.points.length)].filter(Boolean).length,12);}
  assert.ok(!lods.find(l=>Math.abs(l.resolution/6e15-1)<1e-6).tags.Glass_1_hide);assert.ok(!lods.find(l=>l.resolution===10000).tags.Glass_1_hide);
  const hp=lods.find(l=>Math.abs(l.resolution/5e15-1)<1e-6);assert.ok(hp.points.length>20);assert.equal(hp.faces.length,0);assert.ok(hp.tags.Glass_1);
  assert.ok(result.config.includes('destrType="DestructBuilding"'));assert.ok(result.config.includes('source="Hit"'));assert.ok(result.config.includes('convexComponent="Glass_1_hide"'));assert.ok(result.modelCfg.includes('hideValue=0.999'));
  assert.ok(result.assets.find(a=>a.name==='scripts/glass.sqf').text.includes('["Glass_1_hitpoint",0,'));assert.equal((result.config.match(/class EventHandlers/g)||[]).length,1);
  history.undo();assert.equal(exportModel(root,doors,options).stats.windows,0);history.redo();assert.equal(root.getObjectByProperty('uuid',pane.uuid).userData.armaGlass.resistance,.001);
  assert.throws(()=>exportModel(root,doors,{...options,collision:false}),/colisiones/);
});
test('Glass and light share one initializer and separate hidden selection indices',()=>{
  const cfg=configs(options,[],{color:'#ffffff',intensity:100,range:3,initialOn:false},[{...glassDefaults,id:1},{...glassDefaults,id:2}]);
  assert.equal((cfg.config.match(/class EventHandlers/g)||[]).length,1);assert.ok(cfg.config.includes('hiddenSelections[]={"abt_lamp","Glass_1_hide","Glass_2_hide"}'));
  const s=cfg.assets.find(a=>a.name==='scripts/glass.sqf').text;assert.ok(s.includes('["Glass_1_hitpoint",1,'));assert.ok(s.includes('["Glass_2_hitpoint",2,'));assert.ok(s.includes('_damage >= 0.5'));assert.ok(s.includes('getHitPointDamage'));
});
test('Generated crack texture retains transparent background and damage sampling respects transformed triangles',()=>{
  const a=glassPixels(glassDefaults,false),b=glassPixels(glassDefaults,true);assert.equal(a.length,256*256*4);assert.ok(a[3]>0&&a[3]<255);assert.ok(b.some((v,i)=>v!==a[i]));assert.ok(b.some((v,i)=>i%4===3&&v===a[i]));
  const m=new Mesh(new BoxGeometry(1,1,.01));m.scale.setScalar(2);m.position.set(3,2,1);m.updateMatrixWorld(true);const p=glassHitPoints(m);assert.ok(p.every(([x,y,z])=>x>=2&&x<=4&&y>=1&&y<=3&&z<-.98&&z>-1.02));
});
test('Light assignments, switch Memory, materials and actions survive save, scale and undo',async()=>{
  let root=new Group();const lamp=new Mesh(new BoxGeometry(.3,.2,.2)),button=new Mesh(new BoxGeometry(.1,.1,.1));root.add(lamp,button);
  const history=new History(()=>cloneScene(root),s=>{root=cloneScene(s);});history.record('light');
  root.userData.armaLight={lampId:lamp.uuid,switchId:button.uuid,color:'#ffcc88',intensity:1500,range:7,initialOn:true,actionOn:'Encender "entrada"',actionOff:'Apagar entrada',position:[1,2,3],switchPosition:[4,5,6]};
  root.scale.setScalar(.5);root.updateMatrixWorld(true);root=await new ObjectLoader().parseAsync(root.toJSON());
  const result=exportModel(root,{},options),lods=readMlod(result.p3d),visual=lods[0],memory=lods.find(l=>l.resolution>9e14&&l.resolution<2e15);
  assert.equal(result.stats.lights,1);assert.equal(result.assets.length,3);
  assert.equal(visual.faces.filter(f=>f.material==='abt_test\\data\\light_on.rvmat').length,12);
  assert.ok(visual.tags.abt_lamp);assert.ok(result.modelCfg.includes('sections[]={"abt_lamp"}'));
  assert.deepEqual(memory.points[0],[.5,1,-1.5]);assert.deepEqual(memory.points[1],[2,2.5,-3]);
  assert.ok(memory.tags.abt_light_pos);assert.ok(memory.tags.abt_light_switch);
  assert.ok(result.config.includes('displayName="Encender ""entrada"""'));assert.ok(result.config.includes('abt_light_switch'));
  const script=result.assets.find(a=>a.name.endsWith('.sqf')).text;
  assert.ok(script.includes('hasInterface'));assert.ok(script.includes('createVehicleLocal'));assert.ok(script.includes('setObjectMaterial'));assert.ok(script.includes('deleteVehicle _light'));
  history.undo();assert.equal(root.userData.armaLight,undefined);history.redo();assert.equal(root.userData.armaLight.lampId,lamp.uuid);
  root.userData.armaLight.initialOn=false;assert.ok(readMlod(exportModel(root,{},options).p3d)[0].faces.some(f=>f.material.endsWith('light_off.rvmat')));
  root.userData.armaMemory=[{name:'abt_light_switch',position:[0,0,0]}];assert.throws(()=>exportModel(root,{},options),/reservados/);delete root.userData.armaMemory;
  assert.throws(()=>exportModel(root,{[lamp.uuid]:{...proposeAxis(root.children[0]),confirmed:true}},options),/fuera de las puertas/);
  root.remove(root.getObjectByProperty('uuid',button.uuid));assert.throws(()=>exportModel(root,{},options),/ya no existen/);
});
test('Generated shadows preserve openings, closed volumes, sharp edges and animated door selections through save and undo',async()=>{
  let root=new Group();const wall=new Mesh(new BoxGeometry(4,3,.2)),leaf=new Mesh(new BoxGeometry(1,2,.1));root.add(wall,leaf);leaf.position.y=1;
  setShapes(wall,'geometry',rectangularOpening(defaultShape(wall),1.2,2.2,true));
  const doors={[leaf.uuid]:{...proposeAxis(leaf),confirmed:true}};
  const history=new History(()=>cloneScene(root),s=>{root=cloneScene(s);});history.record('shadow');generateShadows([wall,leaf]);
  root=await new ObjectLoader().parseAsync(root.toJSON());
  const result=exportModel(root,doors,options),l=readMlod(result.p3d).find(l=>l.resolution===10000);
  assert.equal(l.faces.length,48);assert.equal(l.points.length,32);assert.equal(l.tags['#SharpEdges#'].length,4*18*8);
  assert.equal([...l.tags.door_1.subarray(0,l.points.length)].filter(Boolean).length,8);
  assert.equal([...l.tags.door_1.subarray(l.points.length)].filter(Boolean).length,12);
  const edges=new Map();for(const f of l.faces){assert.equal(f.vertices.length,3);assert.equal(f.texture,'');assert.equal(f.material,'');for(let i=0;i<3;i++){const k=[f.vertices[i].vertex,f.vertices[(i+1)%3].vertex].sort((a,b)=>a-b).join(':');edges.set(k,(edges.get(k)||0)+1);}}
  assert.ok([...edges.values()].every(n=>n===2));
  assert.equal(root.getObjectByProperty('uuid',wall.uuid).userData.armaLayers.shadow.length,3);
  assert.ok(result.modelCfg.includes('selection="door_1"'));
  history.undo();assert.equal(exportModel(root,doors,options).stats.shadowFaces,0);
  history.redo();assert.equal(exportModel(root,doors,options).stats.shadowFaces,48);
});
test('Door action labels persist through history and export with config escaping and legacy defaults',()=>{
  const root=new Group(),mesh=new Mesh(new BoxGeometry(1,2,.1));mesh.name='Acceso principal';root.add(mesh);
  let doors={[mesh.uuid]:{...proposeAxis(mesh),confirmed:true}};
  const history=new History(()=>structuredClone(doors),s=>{doors=structuredClone(s);});
  history.record('action text');doors[mesh.uuid].actionOpen='Entrar a "recepción"';doors[mesh.uuid].actionClose='Cerrar acceso';
  const config=()=>exportModel(root,JSON.parse(JSON.stringify(doors)),options).config;
  assert.ok(config().includes('displayName="Entrar a ""recepción"""'));
  assert.ok(config().includes('displayName="Cerrar acceso"'));
  assert.ok(config().includes('position="door_1_trigger"'));
  history.undo();assert.ok(config().includes('displayName="Abrir Acceso principal"'));
  history.redo();assert.ok(config().includes('displayName="Cerrar acceso"'));
  doors[mesh.uuid].actionOpen='   ';assert.ok(config().includes('displayName="Abrir Acceso principal"'));
});
test('Generated collision solids have clockwise MLOD winding, including mirrored and rotated objects',()=>{
  for(const reflected of [false,true]){
    const root=new Group(),mesh=new Mesh(new BoxGeometry(2,3,4));root.add(mesh);
    mesh.rotation.set(.2,.5,.1);mesh.scale.set(reflected?-2:2,1.5,.5);mesh.position.set(7,2,-4);
    const lods=readMlod(exportModel(root,{},options).p3d);
    for(const resolution of [0,1e13,6e15,7e15]){
      const l=lods.find(l=>l.resolution===Math.fround(resolution));let volume=0;
      for(const face of l.faces){const [a,b,c]=face.vertices.map(v=>l.points[v.vertex]);volume+=(a[0]*(b[1]*c[2]-b[2]*c[1])+a[1]*(b[2]*c[0]-b[0]*c[2])+a[2]*(b[0]*c[1]-b[1]*c[0]))/6;}
      assert.ok(Math.abs(volume+36)<.0001,`MLOD solid must enclose clockwise volume -36, got ${volume}`);
    }
  }
});
test('Explicit Roadway faces face upwards in the clockwise MLOD convention',()=>{
  const root=new Group(),mesh=new Mesh(new BoxGeometry(2,.2,4));root.add(mesh);
  setShapes(mesh,'roadway',[defaultShape(mesh,true)]);
  const floor=readMlod(exportModel(root,{},options).p3d).find(l=>l.resolution===Math.fround(3e15));
  for(const face of floor.faces){const [a,b,c]=face.vertices.map(v=>floor.points[v.vertex]);const crossY=(b[2]-a[2])*(c[0]-a[0])-(b[0]-a[0])*(c[2]-a[2]);assert.ok(crossY<0);}
});
test('Scale baked into the viewport exports the same LODs as the previous export multiplier',()=>{
  const root=new Group(),m=new Mesh(new BoxGeometry(100,210,10));root.add(m);m.position.set(30,105,20);setShapes(m,'geometry',[defaultShape(m)]);root.userData.armaMemory=[{name:'custom',position:[100,200,300]}];
  const doors={[m.uuid]:{...proposeAxis(m),confirmed:true,trigger:[50,100,10]}};
  const before=readMlod(exportModel(root,doors,{...options,scale:.01}).p3d);scaleBuilding(root,doors,.01);
  const after=readMlod(exportModel(root,doors,options).p3d);assert.equal(before.length,after.length);before.forEach((lod,l)=>assert.deepEqual(after[l].points,lod.points));
});
test('Recalculated Roadway exports four patches around a clear stair opening',()=>{
  const root=new Group(),m=new Mesh(new BoxGeometry(6,.2,6));root.add(m);
  setShapes(m,'roadway',[[[-2,.1,0],[2,0,6]],[[2,.1,0],[2,0,6]],[[0,.1,-2],[2,0,2]],[[0,.1,2],[2,0,2]]].map(([center,size])=>({center,size,rotation:[0,0,0]})));
  m.geometry.scale(2,1,2);applyRecalculation([planRecalculation(m)]);
  const road=readMlod(exportModel(root,{},options).p3d).find(l=>Math.abs(l.resolution/3e15-1)<1e-6);assert.equal(road.faces.length,8);
  for(const face of road.faces){const p=face.vertices.map(v=>road.points[v.vertex]);assert.ok(!(Math.min(...p.map(v=>v[0]))<0&&Math.max(...p.map(v=>v[0]))>0&&Math.min(...p.map(v=>v[2]))<0&&Math.max(...p.map(v=>v[2]))>0));}
});
test('A single inverted triangle exports without changing its neighbouring faces or UV mapping',()=>{
  const root=new Group(),mesh=new Mesh(new BoxGeometry(2,3,1));root.add(mesh);
  const before=readMlod(exportModel(root,{},options).p3d)[0];mesh.geometry=invertTriangles(mesh.geometry,new Set([0]));
  const after=readMlod(exportModel(root,{},options).p3d)[0];
  const corners=(lod,face)=>face.vertices.map(v=>({point:lod.points[v.vertex],uv:v.uv}));
  before.faces.forEach((face,i)=>assert.deepEqual(corners(after,after.faces[i]),i===0?corners(before,face).toReversed():corners(before,face)));
});
test('Flipped visual faces export with reversed winding and matching UVs',()=>{
  const root=new Group(),mesh=new Mesh(new BoxGeometry(2,3,1));root.add(mesh);
  const before=readMlod(exportModel(root,{},options).p3d)[0];invertFaces([mesh]);
  const after=readMlod(exportModel(root,{},options).p3d)[0];
  assert.deepEqual(after.points,before.points);
  before.faces.forEach((face,i)=>assert.deepEqual(after.faces[i].vertices,face.vertices.toReversed()));
});
test('Centimetre conversion scales every LOD, edited floor and Memory point consistently',()=>{
  const root=new Group(),wall=new Mesh(new BoxGeometry(400,300,20)),leaf=new Mesh(new BoxGeometry(100,210,10));root.add(wall,leaf);leaf.position.set(50,105,20);
  setShapes(wall,'geometry',rectangularOpening(defaultShape(wall),100,210,true));
  setShapes(wall,'roadway',[{name:'Floor',center:[0,-150,0],size:[400,0,300],rotation:[0,0,0]}]);
  root.userData.armaMemory=[{name:'lamp_pos',position:[30,250,10]}];
  const doors={[leaf.uuid]:{...proposeAxis(leaf),confirmed:true,trigger:[50,100,30]}};
  const original=readMlod(exportModel(root,doors,options).p3d),scaled=readMlod(exportModel(root,doors,{...options,scale:.01}).p3d);
  assert.equal(original.length,scaled.length);
  original.forEach((lod,l)=>{assert.equal(scaled[l].points.length,lod.points.length);lod.points.forEach((point,p)=>point.forEach((v,a)=>assert.ok(Math.abs(scaled[l].points[p][a]-v*.01)<1e-5)));});
});
test('Edited openings produce independent, closed components instead of filling the doorway',()=>{
  const root=new Group(),wall=new Mesh(new BoxGeometry(4,3,.2));root.add(wall);
  setShapes(wall,'geometry',rectangularOpening(defaultShape(wall),1,2,true));
  setShapes(wall,'view',[]);
  const lods=readMlod(exportModel(root,{},options).p3d),geo=lods.find(l=>Math.abs(l.resolution/1e13-1)<1e-6),fire=lods.find(l=>Math.abs(l.resolution/7e15-1)<1e-6),view=lods.find(l=>Math.abs(l.resolution/6e15-1)<1e-6);
  assert.equal(geo.points.length,24);assert.equal(fire.points.length,8);assert.equal(view.points.length,0);
  for(const name of ['Component01','Component02','Component03']){
    const vertices=geo.points.filter((_,i)=>geo.tags[name][i]);
    assert.equal(vertices.length,8);
    const lo=[0,1,2].map(a=>Math.min(...vertices.map(p=>p[a]))),hi=[0,1,2].map(a=>Math.max(...vertices.map(p=>p[a])));
    assert.ok(!(lo[0]<0&&hi[0]>0&&lo[1]<0&&hi[1]>0),'a component must not cross the clear doorway');
    const edges=new Map();for(const face of geo.faces.filter((_,i)=>geo.tags[name][geo.points.length+i]))for(let j=0;j<3;j++){const k=[face.vertices[j].vertex,face.vertices[(j+1)%3].vertex].sort((a,b)=>a-b).join(':');edges.set(k,(edges.get(k)||0)+1);}assert.ok([...edges.values()].every(n=>n===2),'every component is a closed manifold');
  }
});
test('Explicit floors, excluded floors, custom memory and door trigger survive project reload and export',async()=>{
  let root=new Group();const floor=new Mesh(new BoxGeometry(4,.2,4)),leaf=new Mesh(new BoxGeometry(1,2,.1));root.add(floor,leaf);floor.position.x=10;
  setShapes(floor,'roadway',[{name:'Landing',center:[0,2,0],size:[2,0,3],rotation:[0,0,0]}]);setShapes(leaf,'roadway',[]);
  root.userData.armaMemory=[{name:'lamp_pos',position:[1,2,3]}];
  const doors={[leaf.uuid]:{...proposeAxis(leaf),confirmed:true,trigger:[4,5,6]}};
  root.updateMatrixWorld(true);root=await new ObjectLoader().parseAsync(root.toJSON());
  const lods=readMlod(exportModel(root,doors,options).p3d),road=lods.find(l=>Math.abs(l.resolution/3e15-1)<1e-6),mem=lods.find(l=>Math.abs(l.resolution/1e15-1)<1e-6);
  assert.equal(road.faces.length,2);for(const face of road.faces)for(const v of face.vertices){assert.equal(road.points[v.vertex][1],2);assert.ok(road.points[v.vertex][0]>=9);}
  assert.deepEqual(mem.points.find((_,i)=>mem.tags.lamp_pos[i]),[1,2,-3]);assert.deepEqual(mem.points.find((_,i)=>mem.tags.door_1_trigger[i]),[4,5,-6]);
  const axis=mem.points.filter((_,i)=>mem.tags.door_1_axis[i]);assert.ok(Math.abs(Math.hypot(...axis[1].map((v,i)=>v-axis[0][i]))-doors[leaf.uuid].height)<1e-5);
});
test('Undo and redo preserve independent layer edits without sharing mutable project data',()=>{
  let root=new Group();const wall=new Mesh(new BoxGeometry(4,3,.2));root.add(wall);setShapes(wall,'geometry',[defaultShape(wall)]);
  const history=new History(()=>cloneScene(root),s=>{root=cloneScene(s);});history.record('Opening');setShapes(root.children[0],'geometry',rectangularOpening(defaultShape(wall),1,1,false));history.undo();assert.equal(root.children[0].userData.armaLayers.geometry.length,1);history.redo();assert.equal(root.children[0].userData.armaLayers.geometry.length,4);
  assert.throws(()=>rectangularOpening(defaultShape(wall),8,1,false));
});
test('P3D carries grouped door selections, collision bones, memory axis and matching configs',()=>{
  const root=new Group(),leaf=new Mesh(new BoxGeometry(1,2,.1)),handle=new Mesh(new BoxGeometry(.1,.1,.1)),floor=new Mesh(new BoxGeometry(4,.1,4));
  leaf.position.y=1;handle.position.set(.4,1,.1);root.add(leaf,handle,floor);
  const door=groupDoor(root,[leaf,handle]),settings={[door.uuid]:{...proposeAxis(door),confirmed:true}};
  const result=exportModel(root,settings,options),lods=readMlod(result.p3d);
  assert.equal(result.stats.doors,1);assert.equal(lods.length,6);
  const selection=lods[0].tags.door_1;
  assert.equal([...selection.subarray(lods[0].points.length)].reduce((a,b)=>a+b,0),24);
  const geometry=lods.find(l=>Math.abs(l.resolution/1e13-1)<1e-6);assert.ok(geometry.tags.door_1);assert.equal(geometry.tags['#Mass#'].length,geometry.points.length*4);
  const memory=lods.find(l=>Math.abs(l.resolution/1e15-1)<1e-6);assert.deepEqual([...memory.tags.door_1_axis],[1,1,0]);
  assert.ok(result.modelCfg.includes('door_1_axis'));assert.ok(result.config.includes("animateSource ['Door_1_source',1]"));
});
test('Export respects transforms, scale, repeated UVs and skips unconfirmed doors',()=>{
  const root=new Group(),material=new MeshStandardMaterial();material.map=new Texture();material.map.repeat.set(3,2);material.map.flipY=false;
  const mesh=new Mesh(new BoxGeometry(1,2,1),material);mesh.position.set(10,2,3);root.add(mesh);
  const result=exportModel(root,{[mesh.uuid]:{...proposeAxis(mesh),confirmed:false}},{...options,scale:.1,collision:false,roadway:false},{encodeTexture:()=>''});
  const lods=readMlod(result.p3d);assert.equal(result.stats.doors,0);assert.equal(lods.length,2);assert.equal(result.textures.length,1);
  assert.ok(lods[0].points.every(p=>p[0]>=.94&&p[0]<=1.06&&p[2]<0));
  assert.ok(lods[0].faces.some(face=>face.vertices.some(v=>v.uv[0]===3)));
});
test('Invalid export identifiers and empty models fail before producing an addon',()=>{
  assert.throws(()=>configs({...options,id:'../escape'},[]),/identificador/i);
  assert.throws(()=>exportModel(new Group(),{},options),/caras visibles/);
  const config=configs({...options,label:'Test "quoted"\nname'},[]).config;
  assert.ok(config.includes('Test ""quoted"" name'));
});
test('PBO directory and SHA1 round-trip; damaged content is rejected',()=>{
  const data=packPbo('abt_test',[{name:'model.p3d',data:Buffer.from('ODOL-data')},{name:'config.bin',data:Buffer.from([0,114,97,80])}]);
  const parsed=readPbo(data);assert.equal(parsed.prefix,'abt_test');assert.equal(parsed.files[0].data.toString(),'ODOL-data');
  data[data.length-23]^=1;assert.throws(()=>readPbo(data),/Checksum/);
});
test('Baking tint preserves alpha and uses linear color factors',()=>{
  const pixels=new Uint8ClampedArray([255,255,255,128,0,0,0,255]);tintPixels(pixels,{r:1,g:.5,b:0},.5);
  assert.equal(pixels[0],255);assert.ok(pixels[1]>=187&&pixels[1]<=188);assert.equal(pixels[2],0);assert.equal(pixels[3],64);assert.equal(pixels[7],128);
});
test('Native ladders retain local Memory through save, scale, undo and export',()=>{
  const root=new Group(),mesh=new Mesh(new BoxGeometry(.7,3,.1),new MeshStandardMaterial());root.add(mesh);mesh.name='ladder_1';mesh.position.set(2,1.5,4);
  mesh.userData.armaLadder={start:[0,-1.5,.25],end:[0,1.5,-.25]};
  root.updateMatrixWorld(true);const snapshot=cloneScene(root),loaded=new ObjectLoader().parse(root.toJSON());scaleBuilding(loaded,{},2);
  const result=exportModel(loaded,{[loaded.children[0].uuid]:{confirmed:false}},options),memory=readMlod(result.p3d).find(l=>Math.abs(l.resolution-1e15)/1e15<.001);
  assert.match(result.config,/ladders\[\]=\{\{"abt_ladder_1_start","abt_ladder_1_end",2\.5\}\}/);
  assert.deepEqual(memory.points,[[4,0,-8.5],[4,6,-7.5]]);assert.ok(memory.tags.abt_ladder_1_start);assert.ok(memory.tags.abt_ladder_1_end);
  assert.equal(result.stats.ladders,1);assert.deepEqual(readMlod(exportModel(snapshot,{},options).p3d).find(l=>Math.abs(l.resolution-1e15)/1e15<.001).points,[[2,0,-4.25],[2,3,-3.75]]);
  loaded.children[0].userData.armaLadder.end=[0,1.5,.25];assert.throws(()=>exportModel(loaded,{},options),/orientación|facing/);
  loaded.children[0].userData.armaLadder.end=[0,-2,0];assert.throws(()=>exportModel(loaded,{},options));
});

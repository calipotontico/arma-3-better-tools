const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs/promises'),os=require('node:os'),path=require('node:path');
const {installWorkspace}=require('./project-workspace.cjs');
test('Project workspace preserves opened paths, separates Save as, avoids collisions and lists previews',async t=>{
  const folder=await fs.mkdtemp(path.join(os.tmpdir(),'abt-workspace-'));t.after(()=>fs.rm(folder,{recursive:true,force:true}));
  const handlers={},preferences={projects:folder,exports:folder,arma:''};let picked,saveDialogs=0;
  installWorkspace({ipcMain:{handle:(name,fn)=>handlers[name]=fn},allow:()=>{},dialog:{showSaveDialog:async()=>{saveDialogs++;return {filePath:picked};},showOpenDialog:async()=>({filePaths:[picked]})},win:()=>null,app:{},tr:a=>a,preferences,persist:async()=>{},getOutput:()=>null});
  const invoke=(name,...args)=>handlers['workspace:'+name]({},...args);
  const preview='data:image/jpeg;base64,'+Buffer.from('thumbnail').toString('base64');
  const first=await invoke('save','{"first":1}','building',false,preview);assert.equal(saveDialogs,0);
  await invoke('save','{"first":2}','building',false,preview);assert.equal(await fs.readFile(first.path,'utf8'),'{"first":2}');
  await invoke('reset');const second=await invoke('save','{"second":1}','building',false);assert.notEqual(first.path,second.path);
  const rows=await invoke('list');assert.equal(rows.length,2);assert.equal(rows.find(r=>r.path===first.path).preview,preview);
  await invoke('open',first.path);await invoke('accept',first.path);await invoke('save','{"first":3}','building',false);
  assert.equal(await fs.readFile(first.path,'utf8'),'{"first":3}');assert.equal(await fs.readFile(second.path,'utf8'),'{"second":1}');
  picked=path.join(folder,'different.json');await invoke('save','{"copy":1}','building',true);assert.equal(saveDialogs,1);
  await invoke('save','{"copy":2}','building',false);assert.equal(await fs.readFile(picked,'utf8'),'{"copy":2}');
  await assert.rejects(invoke('open',path.join(folder,'unoffered.json')),/Unknown/);
  await assert.rejects(invoke('play'),/Exporta/);
});

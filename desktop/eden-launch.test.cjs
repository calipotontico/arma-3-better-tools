const{test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs/promises'),path=require('node:path'),os=require('node:os');
const{prepareEdenMission,edenArguments}=require('./eden-launch.cjs');
test('Eden opens a VR mission with the mod and preserves subsequent user edits',async t=>{
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'abt-eden-'));t.after(()=>fs.rm(dir,{recursive:true,force:true}));
 const mission=await prepareEdenMission(dir);assert.ok(mission.endsWith(path.join('ABT_pruebas.VR','mission.sqm')));assert.match(await fs.readFile(mission,'utf8'),/version=54/);
 const args=edenArguments('C:\\My mods\\@hospital',mission);assert.equal(args.at(-1),mission);assert.ok(args.includes('-mod=C:\\My mods\\@hospital'));assert.ok(args.includes('-world=VR'));
 await fs.writeFile(mission,'user edits');await prepareEdenMission(dir);assert.equal(await fs.readFile(mission,'utf8'),'user edits');
});

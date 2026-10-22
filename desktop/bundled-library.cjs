const fs=require('node:fs/promises');
const path=require('node:path');
// Read files explicitly: fs.cp cannot traverse Electron ASAR directories reliably.
async function copyBundledDirectory(source,target){
  await fs.mkdir(target,{recursive:true});
  const entries=await fs.readdir(source,{withFileTypes:true});
  // Write the completion marker last so an interrupted copy is retried.
  entries.sort((a,b)=>(a.name==='entry.json')-(b.name==='entry.json'));
  for(const entry of entries){
    const from=path.join(source,entry.name),to=path.join(target,entry.name);
    if(entry.isDirectory())await copyBundledDirectory(from,to);
    else if(entry.isFile())await fs.writeFile(to,await fs.readFile(from));
  }
}
module.exports={copyBundledDirectory};

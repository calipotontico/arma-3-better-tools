import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
const headers={'User-Agent':'Arma3BetterTools/PolyHaven'};
const idPattern=/^[a-zA-Z0-9_-]{1,120}$/;
export function trustedUrl(value){
  const u=new URL(value);
  if(u.protocol!=='https:'||u.username||u.password||u.port||!['api.polyhaven.com','cdn.polyhaven.com','dl.polyhaven.org'].includes(u.hostname))throw Error('Invalid Poly Haven resource URL');
  return u.href;
}
async function bytes(url,limit=80*1024*1024){
  const response=await fetch(trustedUrl(url),{headers,redirect:'error',signal:AbortSignal.timeout(120000)});
  if(!response.ok)throw Error(`Poly Haven HTTP ${response.status}`);
  if(Number(response.headers.get('content-length'))>limit)throw Error('Poly Haven resource too large');
  const chunks=[];let length=0;
  for await(const chunk of response.body){length+=chunk.length;if(length>limit)throw Error('Poly Haven resource too large');chunks.push(chunk);}
  return Buffer.concat(chunks);
}
const json=async url=>JSON.parse((await bytes(url,20*1024*1024)).toString());
export function variants(files){
  return Object.entries(files.gltf||{}).filter(([,v])=>v.gltf?.url).map(([resolution,v])=>({
    resolution,size:v.gltf.size+Object.values(v.gltf.include||{}).reduce((n,f)=>n+f.size,0)
  })).sort((a,b)=>parseInt(a.resolution)-parseInt(b.resolution));
}
export class PolyHaven{
  constructor(folder){this.folder=folder;this.catalog=null;}
  async list(){
    if(!this.catalog)this.catalog=json('https://api.polyhaven.com/assets?t=models').catch(e=>{this.catalog=null;throw e;});
    const all=await this.catalog;
    return Object.entries(all).filter(([,v])=>v.type===2).map(([id,v])=>({id,name:v.name,tags:v.tags||[],category:v.category||'',polycount:v.polycount,thumbnail:v.thumbnail_url}));
  }
  async files(id){if(!idPattern.test(id))throw Error('Invalid asset ID');return json('https://api.polyhaven.com/files/'+id);}
  async details(id){return variants(await this.files(id));}
  async thumbnail(id){
    const item=(await this.list()).find(v=>v.id===id);if(!item?.thumbnail)return '';
    const b=await bytes(item.thumbnail,5*1024*1024);return 'data:image/webp;base64,'+b.toString('base64');
  }
  async download(id,resolution){
    if(!idPattern.test(id)||!/^\d+k$/.test(resolution))throw Error('Invalid asset selection');
    const file=path.join(this.folder,`${id}-${resolution}.json`);
    try{return JSON.parse(await fs.readFile(file,'utf8'));}catch{}
    const entry=(await this.files(id)).gltf?.[resolution]?.gltf;
    if(!entry)throw Error('No compatible glTF');
    if(variants({gltf:{[resolution]:{gltf:entry}}})[0].size>180*1024*1024)throw Error('Model exceeds 180 MB; choose a lower resolution');
    const get=async record=>{
      const b=await bytes(record.url);
      if(record.md5&&createHash('md5').update(b).digest('hex')!==record.md5)throw Error('Poly Haven checksum mismatch');
      return b;
    };
    const gltf=JSON.parse((await get(entry)).toString());
    // Embed only declared dependencies; the renderer never follows arbitrary URLs.
    for(const resource of [...(gltf.buffers||[]),...(gltf.images||[])]){
      if(!resource.uri){continue;}
      const record=entry.include?.[resource.uri];
      if(!record)throw Error('Missing glTF dependency');
      const b=await get(record),mime=/\.png$/i.test(resource.uri)?'image/png':/\.jpe?g$/i.test(resource.uri)?'image/jpeg':'application/octet-stream';
      resource.uri=`data:${mime};base64,${b.toString('base64')}`;
    }
    const result={id,resolution,gltf,source:`https://polyhaven.com/a/${id}`,license:'CC0'};
    await fs.mkdir(this.folder,{recursive:true});await fs.writeFile(file,JSON.stringify(result));
    return result;
  }
}

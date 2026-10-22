import fs from 'node:fs/promises';
import path from 'node:path';
import {randomUUID,createHash} from 'node:crypto';
import {spawn} from 'node:child_process';
const allowed=/\.(paa|png|jpg|jpeg|tga|rvmat|bisurf)$/i;
export const validId=id=>typeof id==='string'&&/^[a-f0-9-]{36}$/.test(id);
async function run(exe,args){return new Promise((resolve,reject)=>{const child=spawn(exe,args,{windowsHide:true,shell:false});let message='';child.stdout.on('data',b=>message+=b);child.stderr.on('data',b=>message+=b);const timer=setTimeout(()=>{child.kill();reject(Error('La conversión tardó demasiado.'));},60000);child.on('error',e=>{clearTimeout(timer);reject(e);});child.on('close',code=>{clearTimeout(timer);code===0?resolve():reject(Error('No se pudo convertir el recurso: '+message.slice(-800)));});});}
export class MaterialLibrary{
  constructor(folder,tools){this.folder=path.resolve(folder);this.tools=tools;}
  directory(id){if(!validId(id))throw Error('Material inválido.');return path.join(this.folder,id);}
  async list(){await fs.mkdir(this.folder,{recursive:true});const result=[];for(const id of await fs.readdir(this.folder)){if(!validId(id))continue;try{const e=JSON.parse(await fs.readFile(path.join(this.directory(id),'entry.json'),'utf8'));result.push({id,name:e.name,builtin:!!e.builtin,names:e.names});}catch{}}return result.sort((a,b)=>a.name.localeCompare(b.name));}
  async get(id){const dir=this.directory(id),e=JSON.parse(await fs.readFile(path.join(dir,'entry.json'),'utf8'));if(e.id!==id||!Array.isArray(e.files)||e.files.length>256||e.files.some(name=>!/^[a-f0-9]{20}(?:_[a-z0-9]+)?\.(paa|rvmat|bisurf)$/.test(name)))throw Error('Índice de biblioteca inválido.');return {...e,preview:'data:image/png;base64,'+(await fs.readFile(path.join(dir,'preview.png'))).toString('base64'),files:await Promise.all(e.files.map(async name=>({name,data:(await fs.readFile(path.join(dir,name))).toString('base64')})))};}
  async rename(id,name){name=String(name).trim().slice(0,80);if(!name)throw Error('Escribe un nombre.');const file=path.join(this.directory(id),'entry.json'),e=JSON.parse(await fs.readFile(file,'utf8'));e.name=name;await fs.writeFile(file,JSON.stringify(e));return this.list();}
  async import(texture,rvmat,name){
    if(!/\.(paa|png|jpg|jpeg|tga)$/i.test(texture)||! /\.rvmat$/i.test(rvmat))throw Error('Selecciona una textura y un RVMAT.');
    name=String(name||path.parse(texture).name).trim().slice(0,80);if(!name)throw Error('Escribe un nombre.');
    await fs.mkdir(this.folder,{recursive:true});const id=randomUUID(),dir=this.directory(id);await fs.mkdir(dir);
    const imageTool=path.join(this.tools,'ImageToPAA','ImageToPAA.exe'),cfgTool=path.join(this.tools,'CfgConvert','CfgConvert.exe');
    const mapped=new Map(),files=[];let total=0;
    const resolve=async(ref,from)=>{
      const clean=ref.replace(/^\\+/,'');const candidates=[path.resolve(path.dirname(from),clean),path.resolve(path.dirname(texture),clean),path.resolve('P:/',clean)];
      if(path.isAbsolute(ref)&&!ref.startsWith('\\'))candidates.unshift(ref);
      for(let base=path.dirname(from);;){candidates.push(path.join(base,clean));const parent=path.dirname(base);if(parent===base)break;base=parent;}
      for(const file of candidates)try{if((await fs.stat(file)).isFile())return file;}catch{}
      throw Error('Falta el recurso del material: '+ref+'. Conserva sus subcarpetas junto al RVMAT o en P:.');
    };
    const copy=async file=>{
      file=path.resolve(file);const key=file.toLowerCase();if(mapped.has(key))return mapped.get(key);
      if(!allowed.test(file))throw Error('Formato de recurso no compatible: '+file);
      const bytes=await fs.readFile(file);total+=bytes.length;if(total>200*1024*1024||files.length>=256)throw Error('Material demasiado grande (máximo 200 MB o 256 recursos).');
      const ext=path.extname(file).toLowerCase(),suffix=path.parse(file).name.match(/_([a-z0-9]+)$/i)?.[0]||'',textFile=['.rvmat','.bisurf'].includes(ext),target=createHash('sha256').update(key).digest('hex').slice(0,20)+(textFile?ext:suffix.toLowerCase()+'.paa');mapped.set(key,target);files.push(target);
      if(textFile){
        let text=bytes.toString('utf8');if(bytes[0]===0&&bytes.toString('ascii',1,4)==='raP'){const tmp=path.join(dir,target+'.txt');await run(cfgTool,['-txt','-dst',tmp,file]);text=await fs.readFile(tmp,'utf8');await fs.unlink(tmp);}
        const refs=[...text.matchAll(/\b(texture|surfaceFile|nextPass)\s*=\s*"([^"]*)"/gi)];
        for(const m of refs){const ref=m[2];if(!ref||ref.startsWith('#'))continue;const dep=await copy(await resolve(ref,file));text=text.replace(m[0],`${m[1]}="__ABT_MATERIAL__\\${dep}"`);}
        await fs.writeFile(path.join(dir,target),text);
      }else if(ext==='.paa')await fs.writeFile(path.join(dir,target),bytes);
      else await run(imageTool,[file,path.join(dir,target)]);
      return target;
    };
    try{
      const tex=await copy(texture),mat=await copy(rvmat);await run(imageTool,[path.join(dir,tex),path.join(dir,'preview.png')]);
      for(const file of files)if((await fs.stat(path.join(dir,file))).size<1)throw Error('Recurso vacío.');
      await fs.writeFile(path.join(dir,'entry.json'),JSON.stringify({id,name,texture:tex,rvmat:mat,files}));return this.get(id);
    }catch(error){const target=path.resolve(dir),base=path.resolve(this.folder)+path.sep;if(!target.startsWith(base)||path.basename(target)!==id)throw Error('Ruta de biblioteca inválida.');await fs.rm(target,{recursive:true,force:true});throw error;}
  }
}

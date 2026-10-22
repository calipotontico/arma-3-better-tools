import { createHash } from 'node:crypto';
const z=s=>Buffer.from(s+'\0','utf8');
function numbers(...values){const b=Buffer.alloc(values.length*4);values.forEach((v,i)=>b.writeUInt32LE(v>>>0,i*4));return b;}
export function packPbo(prefix,files){
  const head=[z(''),numbers(0x56657273,0,0,0,0),z('prefix'),z(prefix),z('')];
  for(const file of files)head.push(z(file.name.replaceAll('/','\\')),numbers(0,file.data.length,0,Math.floor(Date.now()/1000),file.data.length));
  head.push(z(''),numbers(0,0,0,0,0));
  const body=Buffer.concat([...head,...files.map(f=>f.data)]);
  return Buffer.concat([body,Buffer.from([0]),createHash('sha1').update(body).digest()]);
}
export function readPbo(buffer){
  let p=0;const string=()=>{const end=buffer.indexOf(0,p);if(end<0)throw new Error('PBO truncado.');const s=buffer.toString('utf8',p,end);p=end+1;return s;};
  const files=[];let prefix='';
  for(;;){const name=string();if(p+20>buffer.length)throw new Error('Cabecera PBO inválida.');const type=buffer.readUInt32LE(p),size=buffer.readUInt32LE(p+16);p+=20;
    if(!name&&type===0x56657273){for(;;){const key=string();if(!key)break;const value=string();if(key==='prefix')prefix=value;}continue;}
    if(!name)break;if(type!==0)throw new Error('Verificación solo para PBO sin compresión.');files.push({name,size});
  }
  for(const f of files){f.data=buffer.subarray(p,p+f.size);p+=f.size;}
  if(p+21!==buffer.length||buffer[p]!==0||!createHash('sha1').update(buffer.subarray(0,p)).digest().equals(buffer.subarray(p+1)))throw new Error('Checksum PBO incorrecto.');
  return {prefix,files};
}

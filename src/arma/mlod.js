// Port of the MLOD writer in the user's previous CalipoCreator project.
class Writer {
  constructor(){this.parts=[];this.length=0;}
  bytes(b){this.parts.push(b);this.length+=b.length;}
  u8(n){this.bytes(Uint8Array.of(n));}
  u32(n){const b=new Uint8Array(4);new DataView(b.buffer).setUint32(0,n,true);this.bytes(b);}
  f32(n){if(!Number.isFinite(n))throw new Error('El modelo contiene coordenadas no finitas.');const b=new Uint8Array(4);new DataView(b.buffer).setFloat32(0,n,true);this.bytes(b);}
  str(s){this.bytes(new TextEncoder().encode(s));}
  z(s){this.str(s);this.u8(0);}
  finish(){const out=new Uint8Array(this.length);let at=0;for(const b of this.parts){out.set(b,at);at+=b.length;}return out;}
}
function tag(w,name,data){w.u8(1);w.z(name);w.u32(data.length);w.bytes(data);}
export function lod(resolution){return {resolution,points:[],normals:[],faces:[],selections:{},properties:{}};}
export function selectRange(l,name,points,faces){const s=l.selections[name]||={points:new Set(),faces:new Set()};points.forEach(i=>s.points.add(i));faces.forEach(i=>s.faces.add(i));}
export function writeMlod(lods){
  const w=new Writer();w.str('MLOD');w.u32(257);w.u32(lods.length);
  for(const l of lods){
    const normals=l.normals.length?l.normals:[[0,1,0]];
    w.str('P3DM');[28,256,l.points.length,normals.length,l.faces.length,0].forEach(n=>w.u32(n));
    for(const p of l.points){p.forEach(n=>w.f32(n));w.u32(0);}for(const n of normals)n.forEach(v=>w.f32(v));
    for(const f of l.faces){w.u32(f.points.length);for(let i=0;i<4;i++){w.u32(f.points[i]||0);w.u32(f.normals?.[i]||0);w.f32(f.uv?.[i]?.[0]||0);w.f32(f.uv?.[i]?.[1]||0);}w.u32(0);w.z(f.texture||'');w.z(f.material||'');}
    w.str('TAGG');const sharp=new Writer();
    if(l.sharpEdges){const edges=new Set();for(const face of l.faces)for(let i=0;i<face.points.length;i++){
      const a=face.points[i],b=face.points[(i+1)%face.points.length],key=[Math.min(a,b),Math.max(a,b)].join(':');
      if(!edges.has(key)){edges.add(key);sharp.u32(a);sharp.u32(b);}
    }}
    tag(w,'#SharpEdges#',sharp.finish());
    for(const [name,s] of Object.entries(l.selections)){const bytes=new Uint8Array(l.points.length+l.faces.length);for(const p of s.points)bytes[p]=1;for(const f of s.faces)bytes[l.points.length+f]=1;tag(w,name,bytes);}
    if(l.mass){const m=new Writer();l.mass.forEach(v=>m.f32(v));tag(w,'#Mass#',m.finish());}
    for(const [k,v] of Object.entries(l.properties)){const bytes=new Uint8Array(128);bytes.set(new TextEncoder().encode(k.slice(0,63)),0);bytes.set(new TextEncoder().encode(v.slice(0,63)),64);tag(w,'#Property#',bytes);}
    if(l.faces.length&&l.resolution<1e4){const uv=new Writer();uv.u32(0);for(const f of l.faces)for(let i=0;i<f.points.length;i++){uv.f32(f.uv?.[i]?.[0]||0);uv.f32(f.uv?.[i]?.[1]||0);}tag(w,'#UVSet#',uv.finish());}
    tag(w,'#EndOfFile#',new Uint8Array());w.f32(l.resolution);
  }
  return w.finish();
}

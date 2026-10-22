// Matching left-hand glass panel in the intact and damaged vanilla atlases.
// Keep clear of the neighbouring metal/wood swatches and mipmap borders.
export function glassAtlasUV(u,v){
  const clamp=x=>Math.min(1,Math.max(0,x));
  return [.015+clamp(u)*.17,.02+clamp(v)*.76];
}

export function appendGlassBack(lod,face){
  const [a,b,c]=face.points.map(i=>lod.points[i]);
  const ab=b.map((v,i)=>v-a[i]),ac=c.map((v,i)=>v-a[i]);
  const cross=[ab[1]*ac[2]-ab[2]*ac[1],ab[2]*ac[0]-ab[0]*ac[2],ab[0]*ac[1]-ab[1]*ac[0]];
  const length=Math.hypot(...cross);
  // The back faces toward the cross product in clockwise MLOD coordinates.
  // A 1mm separation prevents coincident opposite triangles being merged.
  const offset=cross.map(v=>length?v/length*.001:0);
  const back={...face,points:[...face.points].reverse().map(i=>{
    const index=lod.points.length;lod.points.push(lod.points[i].map((v,j)=>v+offset[j]));return index;
  }),uv:[...face.uv].reverse(),normals:[...face.normals].reverse().map(i=>{
    const index=lod.normals.length;lod.normals.push(lod.normals[i].map(v=>-v));return index;
  })};
  lod.faces.push(back);
}

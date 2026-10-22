export function tintPixels(pixels,color,opacity){
  const linear=n=>n<=.04045?n/12.92:((n+.055)/1.055)**2.4;
  const srgb=n=>n<=.0031308?n*12.92:1.055*n**(1/2.4)-.055;
  const tables=[color.r,color.g,color.b].map(factor=>Uint8ClampedArray.from({length:256},(_,i)=>255*srgb(linear(i/255)*factor)));
  for(let i=0;i<pixels.length;i+=4){for(let c=0;c<3;c++)pixels[i+c]=tables[c][pixels[i+c]];pixels[i+3]=Math.round(pixels[i+3]*opacity);}
  return pixels;
}

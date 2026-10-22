export function nextName(prefix,names){
  let highest=0;
  for(const name of names){const match=String(name).match(new RegExp('^'+prefix+'_(\\d+)$'));if(match)highest=Math.max(highest,Number(match[1]));}
  return `${prefix}_${highest+1}`;
}
export function sceneName(root,prefix){const names=[];root?.traverse(o=>names.push(o.name));return nextName(prefix,names);}

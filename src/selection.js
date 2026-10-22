export function doorOwner(object, root) {
  let owner = null;
  for (let p = object; p && p !== root; p = p.parent) {
    if (p.userData.calipoDoor) owner = p;
  }
  return owner;
}
export function selectionObject(object, root, individual = false) {
  let proxy=null;
  for(let p=object;p&&p!==root;p=p.parent)if(p.userData.armaProxy)proxy=p;
  return individual ? object : doorOwner(object, root) || proxy || object;
}

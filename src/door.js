import { Matrix4, Vector3, Box3, Group } from 'three';
import {sceneName} from './automatic-names.js';
export function addDoorPieces(root, door, objects) {
  const additions = [...new Set(objects)].filter(object => {
    for (let p = object; p; p = p.parent) if (p === door) return false;
    return true;
  });
  for (const object of additions) {
    for (let p = door; p; p = p.parent) {
      if (p === object) throw new Error('No se puede añadir un antecesor de la puerta.');
    }
  }
  const top = additions.filter(object => {
    for (let p = object.parent; p; p = p.parent) if (additions.includes(p)) return false;
    return true;
  });
  const group = door.userData.calipoDoor ? door : groupDoor(root, [door]);
  if (group !== door) group.name = door.name;
  for (const object of top) detachPiece(group, object);
  return group;
}
export function detachPiece(root, object) {
  object.updateWorldMatrix(true, true);
  const world = object.matrixWorld.clone();
  root.updateWorldMatrix(true, false);
  root.add(object);
  object.matrix.copy(root.matrixWorld).invert().multiply(world);
  object.matrixAutoUpdate = false;
  object.traverse(o => { delete o.userData.calipoDoor; });
  object.updateMatrixWorld(true);
}
export function ungroupDoor(root, group) {
  const pieces = [...group.children];
  for (const piece of pieces) detachPiece(root, piece);
  group.removeFromParent();
  return pieces;
}
export function groupDoor(root, objects) {
  const chosen = new Set(objects);
  const top = objects.filter(o => {
    for (let p = o.parent; p; p = p.parent) if (chosen.has(p)) return false;
    return true;
  });
  root.updateWorldMatrix(true, true);
  const snapshots = top.map(o => ({object: o, world: o.matrixWorld.clone()}));
  const group = new Group();
  group.name = sceneName(root,'door');
  group.userData.calipoDoor = true;
  root.add(group);
  group.updateWorldMatrix(true, false);
  const inverse = group.matrixWorld.clone().invert();
  for (const {object, world} of snapshots) {
    group.add(object);
    object.matrix.copy(inverse).multiply(world);
    object.matrixAutoUpdate = false;
  }
  group.updateMatrixWorld(true);
  return group;
}
export function proposeAxis(object, side = 'min') {
  const box = new Box3().setFromObject(object);
  const size = box.getSize(new Vector3());
  const p = box.getCenter(new Vector3());
  const width = size.x >= size.z ? 'x' : 'z';
  p[width] = box[side][width];
  p.y = box.min.y;
  return { pivot: p.toArray(), height: Math.max(size.y, .01), angle: 90, side };
}
export function doorMatrix(baseWorld, parentWorld, pivot, angle, direction = [0,1,0]) {
  const p = new Vector3().fromArray(pivot);
  return new Matrix4().copy(parentWorld).invert()
    .multiply(new Matrix4().makeTranslation(p.x,p.y,p.z))
    .multiply(new Matrix4().makeRotationAxis(new Vector3().fromArray(direction).normalize(),angle))
    .multiply(new Matrix4().makeTranslation(-p.x,-p.y,-p.z))
    .multiply(baseWorld);
}

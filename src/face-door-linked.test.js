import {test} from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {prepareFaceDoor} from './face-door.js';
import {movePoints} from './point-editing.js';
test('moving the rear door faces carries the side corners and survives serialization',()=>{
 const root=new THREE.Group(),mesh=new THREE.Mesh(new THREE.PlaneGeometry(1,2));root.add(mesh);
 const {door}=prepareFaceDoor(root,[{mesh,faces:new Set([0,1])}],{},.04);
 const saved=new THREE.ObjectLoader().parse(door.toJSON());
 const g=movePoints(saved.geometry,new Set([3,4,5,9,10,11]),[0,.03,-.2]);
 const edges=new Map(),p=g.attributes.position;
 const key=i=>[p.getX(i),p.getY(i),p.getZ(i)].map(x=>x.toFixed(5)).join(',');
 for(let i=0;i<p.count;i+=3)for(let j=0;j<3;j++){const k=[key(i+j),key(i+(j+1)%3)].sort().join(':');edges.set(k,(edges.get(k)||0)+1);}
 assert.ok([...edges.values()].every(n=>n===2));
});

import test from 'node:test';import assert from 'node:assert/strict';import * as T from 'three';
import {planBuildingOptimization,applyBuildingOptimization} from './building-optimizer.js';
import {shapesFor,shapeGeometry,automaticRoadway} from './layers.js';
import {planExistingInterior,applyExistingInterior} from './existing-interior.js';
function fixture(){const root=new T.Group(),group=new T.Group();root.add(group);group.rotation.y=.5;const a=new T.Mesh(new T.BoxGeometry(4,3,.2)),b=new T.Mesh(new T.BoxGeometry(2,3,.2));b.position.x=4;group.add(a,b);return {root,group,a,b};}
test('Closed zone reduces multiple transformed pieces to one local box, survives saving and existing interior regeneration',()=>{
 const {root,group,a,b}=fixture(),p=planBuildingOptimization(root,[group],'closed');assert.equal(p.before,2);assert.equal(p.after,1);assert.equal(shapesFor(b,'geometry').length,1);applyBuildingOptimization(p);
 assert.equal(shapesFor(a,'geometry').length,1);assert.deepEqual(shapesFor(b,'geometry'),[]);assert.deepEqual(shapesFor(a,'roadway'),[]);
 const g=shapeGeometry(shapesFor(a,'geometry')[0]);g.computeBoundingBox();assert.ok(g.boundingBox.max.x>=5);g.dispose();
 applyExistingInterior(root,planExistingInterior(root));assert.equal(shapesFor(a,'geometry').length,1);assert.deepEqual(shapesFor(b,'geometry'),[]);
 const saved=new T.ObjectLoader().parse(root.toJSON());assert.equal(saved.children[0].children[0].userData.abtOptimization.mode,'closed');
});
test('Visual only removes collision and Roadway while keeping mesh/material, protecting configured doors and glass',()=>{
 const {root,group,a,b}=fixture();const original=a.geometry;const doors={[b.uuid]:{confirmed:true}};const p=planBuildingOptimization(root,[group],'visual',{doors});assert.equal(p.protected,1);applyBuildingOptimization(p,doors);for(const layer of ['geometry','fire','view','roadway'])assert.deepEqual(shapesFor(a,layer),[]);assert.equal(a.geometry,original);assert.equal(a.visible,true);assert.equal(shapesFor(b,'geometry').length,1);
 assert.throws(()=>planBuildingOptimization(root,[group],'closed',{doors}),/cerrado/);b.userData.armaGlass={};assert.throws(()=>planBuildingOptimization(root,[group],'closed'),/cerrado/);
});
test('Accessible zone retains a doorway and generates automatic Roadway only on named floors',()=>{
 const root=new T.Group(),floor=new T.Mesh(new T.BoxGeometry(10,.2,8)),wall=new T.Mesh(new T.PlaneGeometry(4,3));floor.name='Suelo_urgencias';wall.name='Pared';root.add(floor,wall);
 const p=planBuildingOptimization(root,[root],'accessible');applyBuildingOptimization(p);assert.equal(shapesFor(floor,'roadway'),null);assert.deepEqual(shapesFor(wall,'roadway'),[]);assert.ok(shapesFor(wall,'geometry')[0].vertices);assert.equal(automaticRoadway(floor).attributes.position.count,6);
});
test('Preview becomes invalid when geometry moves or existing layers change',()=>{const {root,group,a}=fixture();const p=planBuildingOptimization(root,[group],'closed');a.position.y=2;assert.throws(()=>applyBuildingOptimization(p),/cambió/);assert.equal(a.userData.abtOptimization,undefined);});

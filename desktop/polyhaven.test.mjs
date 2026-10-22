import {test} from 'node:test';
import assert from 'node:assert/strict';
import {trustedUrl,variants,PolyHaven} from './polyhaven.mjs';
test('Poly Haven only allows HTTPS provider resources',()=>{
  for(const url of ['http://dl.polyhaven.org/a','https://localhost/a','https://dl.polyhaven.org.evil.test/a','file:///etc/passwd','https://user@dl.polyhaven.org/a'])assert.throws(()=>trustedUrl(url));
  assert.equal(trustedUrl('https://dl.polyhaven.org/a'),'https://dl.polyhaven.org/a');
});
test('glTF variants include all dependencies in download size',()=>{
  assert.deepEqual(variants({gltf:{'2k':{gltf:{url:'a',size:20,include:{x:{size:30}}}},'1k':{gltf:{url:'b',size:10}}}}),[{resolution:'1k',size:10},{resolution:'2k',size:50}]);
});
test('download rejects path traversal before cache access',async()=>{
  const p=new PolyHaven('unused');
  await assert.rejects(p.download('../secret','1k'));await assert.rejects(p.download('chair','../secret'));
});

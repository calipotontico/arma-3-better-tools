import {test} from 'node:test';
import assert from 'node:assert/strict';
import {JSDOM} from 'jsdom';
import {observeLanguage,setLanguage,t} from './i18n.js';
test('Language toggles existing and dynamic UI without changing names, values, paths or code',async()=>{
  const dom=new JSDOM('<body><button id="b">Guardar proyecto</button><input value="Puertas" placeholder="Nombre del material"><div id="tree">Puertas</div><button class="element-name">Sombras</button><select id="libraryList"><option>Luces</option></select><pre>Guardar proyecto</pre><p id="status"></p></body>',{url:'https://app.test'});
  const previous=globalThis.MutationObserver;globalThis.MutationObserver=dom.window.MutationObserver;
  try{setLanguage('es');observeLanguage(dom.window.document);const d=dom.window.document;let clicks=0;d.querySelector('#b').onclick=()=>clicks++;
    setLanguage('en');assert.equal(d.querySelector('#b').textContent,'Save project');assert.equal(d.querySelector('input').value,'Puertas');assert.equal(d.querySelector('input').placeholder,'Material name');
    assert.equal(d.querySelector('#tree').textContent,'Puertas');assert.equal(d.querySelector('.element-name').textContent,'Sombras');assert.equal(d.querySelector('option').textContent,'Luces');assert.equal(d.querySelector('pre').textContent,'Guardar proyecto');
    d.querySelector('#status').textContent='Proyecto guardado.';await new Promise(r=>setTimeout(r,0));assert.equal(d.querySelector('#status').textContent,'Project saved.');
    const label=d.createElement('label');label.textContent='Puntos Memory';d.body.append(label);await new Promise(r=>setTimeout(r,0));assert.equal(label.textContent,'Memory points');
    d.querySelector('#b').click();assert.equal(clicks,1);setLanguage('es');assert.equal(label.textContent,'Puntos Memory');assert.equal(d.querySelector('#b').textContent,'Guardar proyecto');assert.equal(d.querySelector('#status').textContent,'Proyecto guardado.');
    setLanguage('en');assert.equal(t('3 caras UV seleccionadas.'),'3 UV faces selected.');assert.equal(t('Lámpara: Puertas'),'Lamp: Puertas');
  }finally{dom.window.close();globalThis.MutationObserver=previous;setLanguage('es');}
});

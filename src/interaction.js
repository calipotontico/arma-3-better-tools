import {getLanguage,onLanguage} from './i18n.js';
export const sides=['civilian','west','independent','east'];
export function sideCondition(data,unit='player'){
 const allowed=data.allowedSides;
 if(allowed===undefined)return 'true';
 if(!Array.isArray(allowed)||allowed.some(s=>!sides.includes(s)))throw Error('Invalid interaction sides');
 return `(side group ${unit} in [${allowed.join(',')}])`;
}
export function interactionFields(parent,prefix,change,move){
 const panel=document.createElement('details');panel.className='compact-group';panel.setAttribute('data-no-i18n','');
 panel.innerHTML=`<summary></summary><label><span></span><select id="${prefix}Interaction"><option value="wheel"></option><option value="marker"></option></select></label><p class="hint"></p><div class="interaction-sides">${sides.map(s=>`<label><input type="checkbox" value="${s}"><span></span></label>`).join('')}</div><button type="button"></button>`;
 parent.append(panel);const mode=panel.querySelector('select'),checks=[...panel.querySelectorAll('input')];
 const render=()=>{const en=getLanguage()==='en';panel.querySelector('summary').textContent=en?'Interaction and access':'Interacción y acceso';panel.querySelector('label>span').textContent=en?'Interaction type':'Tipo de interacción';mode.options[0].text=en?'Action menu':'Acción en la rueda';mode.options[1].text=en?'3D interaction (hold)':'Interacción 3D (mantener pulsado)';panel.querySelector('p').textContent=en?'Allowed sides (all checked = everyone). 3D interaction: aim and hold the indicated key.':'Bandos permitidos (todos marcados = todos). Interacción 3D: apunta y mantén la tecla indicada.';checks.forEach((c,i)=>c.nextElementSibling.textContent=(en?['Civilians','BLUFOR','Independent','OPFOR']:['Civiles','BLUFOR','Independientes','OPFOR'])[i]);panel.querySelector('button').textContent=en?'Move interaction Memory point':'Mover punto Memory de interacción';};render();onLanguage(render);
 const save=()=>change({interactionMode:mode.value,allowedSides:checks.filter(c=>c.checked).map(c=>c.value)});
 mode.onchange=save;checks.forEach(c=>c.onchange=save);panel.querySelector('button').onclick=move;
 panel.sync=data=>{mode.value=data?.interactionMode||'wheel';checks.forEach(c=>c.checked=(data?.allowedSides||sides).includes(c.value));panel.querySelectorAll('input,select,button').forEach(c=>c.disabled=!data);};
 return panel;
}

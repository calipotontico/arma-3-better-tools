import {sideCondition} from '../interaction.js';
import { Color } from 'three';
import { lightName } from '../lighting-data.js';
export function multiLightConfig(id,lights){
  if(!lights.length)return {actions:'',assets:[],sections:[]};
  const assets=[],actions=[],scripts=[];
  lights.forEach((light,i)=>{
    const controller=lights.findIndex(l=>l.switchId===light.switchId),config=lightConfig(id,light);
    const replace=text=>text.replaceAll('abt_light_on',lightName('abt_light_on',controller))
      .replaceAll('abt_light_running',lightName('abt_light_running',i))
      .replaceAll('abt_light_pos',lightName('abt_light_pos',i))
      .replaceAll('abt_light_dir',lightName('abt_light_dir',i))
      .replaceAll('abt_light_switch',lightName('abt_light_switch',i))
      .replaceAll('light_on.rvmat',lightName('light',i)+'_on.rvmat')
      .replaceAll('light_off.rvmat',lightName('light',i)+'_off.rvmat')
      .replaceAll('setObjectMaterial [0,',`setObjectMaterial [${i},`)
      .replaceAll('LightOn',lightName('LightOn',i)).replaceAll('LightOff',lightName('LightOff',i));
    if(controller===i&&light.interactionMode!=='marker')actions.push(replace(config.actions));
    for(const asset of config.assets){if(asset.name.endsWith('.sqf'))scripts.push(`[_building] spawn {\n${replace(asset.text)}\n};`);else assets.push({name:replace(asset.name),text:asset.text});}
  });
  assets.push({name:'scripts/light.sqf',text:'params ["_building"];\n'+scripts.join('\n')});
  return {actions:actions.join('\n'),assets,sections:lights.map((_,i)=>`"${lightName('abt_lamp',i)}"`)};
}
const q=s=>'"'+String(s).replaceAll('"','""').replace(/[\r\n\x00]/g,' ')+'"';
export function lightConfig(id,light){
  if(!light)return {vehicle:'',actions:'',assets:[]};
  const permission=sideCondition(light);
  const initial=light.initialOn?'true':'false',color=new Color(light.color).toArray();
  // Arma's HDR materials use values well above 1 for luminous fixtures;
  // the vanilla camping lamp uses 100. This does not change lightpoint intensity.
  const rvmat=on=>`ambient[]={1,1,1,1}; diffuse[]={1,1,1,1}; forcedDiffuse[]={0,0,0,0}; emmisive[]={${(on?color.map(v=>v*100):[0,0,0]).join(',')},1}; specular[]={0.1,0.1,0.1,1}; specularPower=20; PixelShaderID="Normal"; VertexShaderID="Basic";`;
  return {
    vehicle:`hiddenSelections[]={"abt_lamp"}; class EventHandlers { init="_this execVM '\\${id}\\scripts\\light.sqf'"; };`,
    actions:`class LightOn { displayName=${q(light.actionOn||'Encender luz')}; position="abt_light_switch"; radius=3; onlyForPlayer=1; condition="(${permission}) && {!(this getVariable ['abt_light_on',${initial}])}"; statement="this setVariable ['abt_light_on',true,true]"; }; class LightOff: LightOn { displayName=${q(light.actionOff||'Apagar luz')}; condition="(${permission}) && {this getVariable ['abt_light_on',${initial}]}"; statement="this setVariable ['abt_light_on',false,true]"; };`,
    assets:[{name:'data/light_on.rvmat',text:rvmat(true)},{name:'data/light_off.rvmat',text:rvmat(false)},
      {name:'scripts/light.sqf',text:`// Local rendering with replicated state for current and joining clients.
params ["_building"];
if (!hasInterface || isNull _building) exitWith {};
if (_building getVariable ["abt_light_running",false]) exitWith {};
_building setVariable ["abt_light_running",true];
private _light = "${light.type==='spot'?'#lightreflector':'#lightpoint'}" createVehicleLocal (getPosATL _building);
${light.type==='spot'?`_light setLightConePars [${light.spotAngle},${light.spotAngle*.5},1];`:''}
_light setLightColor [${color.join(',')}];
_light setLightAmbient [0,0,0];
_light setLightDayLight true;
_light setLightAttenuation [0,0,0,1,${light.range*.8},${light.range}];
private _last = -1;
while {!isNull _building} do {
  private _on = _building getVariable ["abt_light_on",${initial}];
  private _state = if (_on) then {1} else {0};
  if (_state != _last) then {
    _light setLightIntensity (if (_on) then {${light.intensity}} else {0});
    _building setObjectMaterial [0, if (_on) then {"\\${id}\\data\\light_on.rvmat"} else {"\\${id}\\data\\light_off.rvmat"}];
    _last = _state;
  };
  _light setPosASL (_building modelToWorldWorld (_building selectionPosition ["abt_light_pos","Memory"]));
${light.type==='spot'?`  private _tip = _building modelToWorldWorld (_building selectionPosition ["abt_light_dir","Memory"]);
  private _direction = vectorNormalized (_tip vectorDiff (getPosASL _light));
  private _reference = if (abs (_direction select 2) > 0.99) then {[0,1,0]} else {[0,0,1]};
  private _right = vectorNormalized (_direction vectorCrossProduct _reference);
  private _up = _right vectorCrossProduct _direction;
  _light setVectorDirAndUp [_direction,_up];`:''}
  sleep 0.1;
};
deleteVehicle _light;
`}]
  };
}

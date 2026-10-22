import {sideCondition} from '../interaction.js';
import {doorGroups} from '../door-motion.js';
const q=s=>'"'+String(s).replaceAll('"','""').replace(/[\r\n\x00]/g,' ')+'"';
export function markerScript(doors,lights){
 const entries=[];
 for(const {door:d,index:i,members} of doorGroups(doors)){
  if(d.interactionMode!=='marker')continue;
  const states=members.map(n=>`(_b animationSourcePhase 'Door_${n+1}_source' >= 0.5)`).join(' || ');
  const apply=members.map(n=>`_b animateSource ['Door_${n+1}_source',if (_on) then {0} else {1}];`).join(' ');
  entries.push(`["door_${i+1}_trigger",${q(d.actionOpen||'Abrir')},${q(d.actionClose||'Cerrar')},{params ["_b"]; ${states}},{params ["_b","_on"]; ${apply}},{${sideCondition(d)}}]`);
 }
 lights.forEach((d,i)=>{if(d.interactionMode!=='marker'||lights.findIndex(l=>l.switchId===d.switchId)!==i)return;const key=i?`abt_light_on_${i+1}`:'abt_light_on';
 entries.push(`["${i?'abt_light_switch_'+(i+1):'abt_light_switch'}",${q(d.actionOn||'Encender luz')},${q(d.actionOff||'Apagar luz')},{params ["_b"]; _b getVariable ['${key}',${!!d.initialOn}]},{params ["_b","_on"]; _b setVariable ['${key}',!_on,true]},{${sideCondition(d)}}]`);});
 if(!entries.length)return null;
 return {name:'scripts/interaction.sqf',text:`// Native hold actions own the input, progress ring and localized key hint.
params ["_building"];
if (!hasInterface || isNull _building) exitWith {};
if (_building getVariable ["abt_marker_registered",false]) exitWith {};
_building setVariable ["abt_marker_registered",true];
private _entries=[${entries.join(',')}];
_building setVariable ["abt_marker_entries",_entries];
{
 _x params ["_memory","_offLabel","_onLabel","_state","_apply","_allowed"];
 private _entryIndex=_forEachIndex;
 {
  private _expected=_x;
  private _label=if (_expected) then {_onLabel} else {_offLabel};
  private _condition=format ["call { private _e=(_target getVariable ['abt_marker_entries',[]]) select %1; private _pos=_target modelToWorldVisual (_target selectionPosition [_e select 0,'Memory']); alive _this && {_this distance _pos<3} && {call (_e select 5)} && {([_target] call (_e select 3)) isEqualTo %2} }",_entryIndex,_expected];
  private _progressCondition=format ["call { private _e=(_target getVariable ['abt_marker_entries',[]]) select %1; private _pos=_target modelToWorldVisual (_target selectionPosition [_e select 0,'Memory']); alive _caller && {_caller distance _pos<3} && {call (_e select 5)} && {([_target] call (_e select 3)) isEqualTo %2} }",_entryIndex,_expected];
  private _icon="\\a3\\ui_f\\data\\IGUI\\Cfg\\holdactions\\holdAction_connect_ca.paa";
  [_building,_label,_icon,_icon,_condition,_progressCondition,{},{},{
   params ["_target","_caller","_actionId","_args"];
   _args params ["_entryIndex","_expected"];
   private _e=(_target getVariable ["abt_marker_entries",[]]) select _entryIndex;
   _e params ["_memory","_offLabel","_onLabel","_state","_apply","_allowed"];
   private _pos=_target modelToWorldVisual (_target selectionPosition [_memory,"Memory"]);
   if (!alive _caller || {!call _allowed} || {_caller distance _pos>=3}) exitWith {};
   private _on=[_target] call _state;
   if (_on isEqualTo _expected) then {[_target,_on] call _apply;};
  },{},[_entryIndex,_expected],0.6,6,false,false,true,3,"",_memory] call BIS_fnc_holdActionAdd;
 } forEach [false,true];
} forEach _entries;
`};
}

const q=s=>'"'+String(s).slice(0,80).replaceAll('"','""').replace(/[\r\n\x00]/g,' ')+'"';
export function seatingConfig(id,seats){
  if(!seats.length)return {functions:'',property:'',assets:[]};
  const request=`${id}_fnc_seatRequest`,apply=`${id}_fnc_seatApply`,init=`${id}_fnc_seatInit`;
  const animation=`${id}_SeatIdle`;
  const prefix=`STR_${id}_SEAT`;
  const label=(text,kind)=>!text||({SIT:['Sentarse','Sit','Sit down'],STAND:['Levantarse','Stand','Stand up']}[kind]).includes(text.trim())?`$${prefix}_${kind}`:text;
  const rows=seats.map(s=>`{${q(s.name)},${s.heading},${s.radius},${q(label(s.sit,'SIT'))},${q(label(s.stand,'STAND'))}}`).join(',');
  return {
    property:`abtSeats[]={${rows}};`,
    functions:`class CfgMovesBasic;
class CfgMovesMaleSdr: CfgMovesBasic { class States {
class HubSittingChairUC_idle1;
class ${animation}: HubSittingChairUC_idle1 {
head="headDefault"; aiming="aimingNo"; aimingBody="aimingNo";
enableDirectControl=1; looped=1; useIdles=0;
};
}; };
class CfgFunctions { class ${id} { tag="${id}"; class Seats {
class seatInit {file="\\${id}\\scripts\\seat_init.sqf";};
class seatRequest {file="\\${id}\\scripts\\seat_request.sqf";};
class seatApply {file="\\${id}\\scripts\\seat_apply.sqf";};
class seatVisible {file="\\${id}\\scripts\\seat_visible.sqf";};
}; }; };`,
    init:`_this call ${init};`,
    assets:[
      {name:'scripts/seat_visible.sqf',text:`params ["_b","_u","_point"];
if (isNull _b || {isNull _u}) exitWith {false};
private _eye = eyePos _u;
private _aim = (AGLToASL (_b modelToWorld (_b selectionPosition _point))) vectorAdd [0,0,1];
private _direction = vectorNormalized (_aim vectorDiff _eye);
if ((eyeDirection _u) vectorDotProduct _direction < 0.25) exitWith {false};
// Do not ignore the building: its own walls must block the action too.
private _view = lineIntersectsSurfaces [_eye,_aim,_u,objNull,true,1,"VIEW","GEOM"];
if !(_view isEqualTo []) exitWith {false};
private _solid = lineIntersectsSurfaces [_eye,_aim,_u,objNull,true,1,"GEOM","VIEW"];
_solid isEqualTo []
`},
      {name:'stringtable.xml',text:`<?xml version="1.0" encoding="utf-8"?>
<Project name="${id}"><Package name="Seats"><Container name="Actions">
<Key ID="${prefix}_SIT"><Original>Sit</Original><English>Sit</English><Spanish>Sentarse</Spanish></Key>
<Key ID="${prefix}_STAND"><Original>Stand up</Original><English>Stand up</English><Spanish>Levantarse</Spanish></Key>
<Key ID="${prefix}_HINT"><Original>Move the mouse to look around. Press SPACE to stand up.</Original><English>Move the mouse to look around. Press SPACE to stand up.</English><Spanish>Mueve el ratón para mirar alrededor. Pulsa ESPACIO para levantarte.</Spanish></Key>
</Container></Package></Project>`},
      {name:'scripts/seat_init.sqf',text:`params ["_b"];
if (!hasInterface) exitWith {};
if (_b getVariable ["abt_seat_actions_added",false]) exitWith {};
_b setVariable ["abt_seat_actions_added",true];
private _seats = getArray (configOf _b >> "abtSeats");
{
  _x params ["_point","_heading","_radius","_sit","_stand"];
  if ((_sit select [0,1]) == "$") then {_sit = localize (_sit select [1]);};
  private _condition = format ["call {alive _this && {vehicle _this == _this} && {isNull attachedTo _this} && {lifeState _this != 'INCAPACITATED'} && {isNull (_this getVariable ['abt_seat_owner',objNull])} && {_this distance (_target modelToWorld (_target selectionPosition '%1')) < %2} && {!alive (_target getVariable ['abt_seat_occupant_%3',objNull])} && {[_target,_this,'%1'] call ${id}_fnc_seatVisible}}",_point,_radius,_forEachIndex];
  _b addAction [_sit,{
    params ["_target","_caller","_action","_index"];
    [_target,_caller,_index,true] remoteExecCall ["${request}",2];
  },_forEachIndex,1.5,true,true,"",_condition,50,false,"",_point];
} forEach _seats;
`},
      {name:'scripts/seat_request.sqf',text:`if (!isServer) exitWith {};
params [["_b",objNull,[objNull]],["_u",objNull,[objNull]],["_i",-1,[0]],["_sit",false,[true]]];
if (isNull _b || {isNull _u}) exitWith {};
if (isMultiplayer && {!isNil "remoteExecutedOwner"} && {remoteExecutedOwner != owner _u} && {remoteExecutedOwner != 2}) exitWith {};
private _seats = getArray (configOf _b >> "abtSeats");
if (_i < 0 || {_i >= count _seats} || {_i != floor _i}) exitWith {};
private _seat = _seats select _i;
private _key = format ["abt_seat_occupant_%1",_i];
if (!_sit) exitWith {
  if ((_b getVariable [_key,objNull]) != _u) exitWith {};
  _b setVariable [_key,objNull,true];
  _u setVariable ["abt_seat_owner",objNull,true];
  [_b,_u,_i,false] remoteExecCall ["${apply}",owner _u];
};
if (!alive _b || {!alive _u} || {!isPlayer _u} || {vehicle _u != _u} || {!isNull attachedTo _u} || {lifeState _u == "INCAPACITATED"}) exitWith {};
if (!isNull (_u getVariable ["abt_seat_owner",objNull]) || {alive (_b getVariable [_key,objNull])}) exitWith {};
if (_u distance (_b modelToWorld (_b selectionPosition (_seat select 0))) > (_seat select 2)) exitWith {};
if !([_b,_u,_seat select 0] call ${id}_fnc_seatVisible) exitWith {};
_b setVariable [_key,_u,true];
_u setVariable ["abt_seat_owner",_b,true];
[_b,_u,_i,true] remoteExecCall ["${apply}",owner _u];
[_b,_u,_i,_key] spawn {
  params ["_b","_u","_i","_key"];
  sleep 3;
  waitUntil {sleep 0.5; isNull _b || {isNull _u} || {!alive _b} || {!alive _u} || {!isPlayer _u} || {lifeState _u == "INCAPACITATED"} || {(_u getVariable ["abt_seat_owner",objNull]) != _b} || {vehicle _u != _u} || {!isNull attachedTo _u} || {(_b getVariable [_key,objNull]) != _u}};
  if (!isNull _b && {(_b getVariable [_key,objNull]) == _u}) then {
    _b setVariable [_key,objNull,true];
    if (!isNull _u) then {_u setVariable ["abt_seat_owner",objNull,true];[_b,_u,_i,false] remoteExecCall ["${apply}",owner _u];};
  };
};
`},
      {name:'scripts/seat_apply.sqf',text:`if (isMultiplayer && {!isNil "remoteExecutedOwner"} && {remoteExecutedOwner != 2}) exitWith {};
params ["_b","_u","_i","_sit"];
if (!local _u) exitWith {};
if (!_sit) exitWith {
  private _state = _u getVariable ["abt_seat_local",[]];
  if (_state isEqualTo []) exitWith {};
  _state params ["_building","_exit","_action","_display","_keyHandler","_oldFreeLook","_frameHandler"];
  removeMissionEventHandler ["EachFrame",_frameHandler];
  enableFreeLook _oldFreeLook;
  hintSilent "";
  _u setVariable ["abt_seat_local",[]];
  _u setVariable ["abt_seat_exit_requested",false];
  if (!isNull _display) then {_display displayRemoveEventHandler ["KeyDown",_keyHandler];};
  _u removeAction _action;

  if (!isNull _building) then {_u enableCollisionWith _building;};
  if (alive _u && {lifeState _u != "INCAPACITATED"}) then {
    _u switchMove "AmovPercMstpSnonWnonDnon";
    _u setPosATL _exit;
  };
};
if (!alive _u || {isNull _b} || {!((_u getVariable ["abt_seat_local",[]]) isEqualTo [])}) exitWith {};
private _seat = (getArray (configOf _b >> "abtSeats")) select _i;
_seat params ["_point","_heading","_radius","_sitText","_standText"];
if ((_standText select [0,1]) == "$") then {_standText = localize (_standText select [1]);};
private _exit = _b modelToWorld (_b selectionPosition (_point + "_exit"));
_u disableCollisionWith _b;
_u setPosATL (_b modelToWorld (_b selectionPosition _point));
_u setDir ((getDir _b) + _heading);
_u switchMove "${animation}";
private _oldFreeLook = enableFreeLook true;
private _action = _u addAction [_standText,{
  params ["_target","_caller"];
  _caller setVariable ["abt_seat_exit_requested",true];
},[],10,true,true,"","call {!((_this getVariable ['abt_seat_local',[]]) isEqualTo [])}"];
_u setVariable ["abt_seat_exit_requested",false];
_u setVariable ["abt_seat_key_after",diag_tickTime + 0.8];
private _display = findDisplay 46;
private _keyHandler = _display displayAddEventHandler ["KeyDown",{
  params ["_display","_key"];
  if (_key != 57 || {cameraOn != player} || {dialog} || {diag_tickTime < (player getVariable ["abt_seat_key_after",0])} || {(player getVariable ["abt_seat_local",[]]) isEqualTo []}) exitWith {false};
  player setVariable ["abt_seat_exit_requested",true];
  true
}];
private _frameHandler = addMissionEventHandler ["EachFrame",{
  private _state = player getVariable ["abt_seat_local",[]];
  if (_state isEqualTo []) exitWith {};
  private _building = _state select 0;
  if (!alive player || {lifeState player == "INCAPACITATED"} || {isNull _building} || {!isNull attachedTo player} || {vehicle player != player}) exitWith {};
  player setVelocity [0,0,0];
  player setPosATL (_building modelToWorld (_building selectionPosition (_state select 7)));
}];
_u setVariable ["abt_seat_local",[_b,_exit,_action,_display,_keyHandler,_oldFreeLook,_frameHandler,_point]];
hintSilent (localize "${prefix}_HINT");
[_b,_u,_i,_exit,_action,_display,_keyHandler,_oldFreeLook,_frameHandler] spawn {
  params ["_b","_u","_i","_exit","_action","_display","_keyHandler","_oldFreeLook","_frameHandler"];
  waitUntil {
    sleep 0.3;
    private _done = (_u getVariable ["abt_seat_local",[]]) isEqualTo [];
    if (!_done && {!(_u getVariable ["abt_seat_exit_requested",false])} && {alive _u} && {lifeState _u != "INCAPACITATED"} && {isNull attachedTo _u} && {animationState _u != "${animation.toLowerCase()}"}) then {_u switchMove "${animation}";};
    _done || {_u getVariable ["abt_seat_exit_requested",false]} || {isNull _b} || {!alive _u} || {lifeState _u == "INCAPACITATED"} || {!isNull attachedTo _u} || {vehicle _u != _u}
  };
  if (!((_u getVariable ["abt_seat_local",[]]) isEqualTo [])) then {
    removeMissionEventHandler ["EachFrame",_frameHandler];
  enableFreeLook _oldFreeLook;
    hintSilent "";
    _u setVariable ["abt_seat_local",[]];_u setVariable ["abt_seat_exit_requested",false];
    if (!isNull _display) then {_display displayRemoveEventHandler ["KeyDown",_keyHandler];};
    _u removeAction _action;
    if (!isNull _b) then {_u enableCollisionWith _b;[_b,_u,_i,false] remoteExecCall ["${request}",2];};
    if (alive _u && {lifeState _u != "INCAPACITATED"}) then {_u switchMove "AmovPercMstpSnonWnonDnon";_u setPosATL _exit;};
    _u setVariable ["abt_seat_owner",objNull,true];
  };
};
`}
    ]
  };
}

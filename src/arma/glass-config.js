export const cleanGlassTexture='#(argb,8,8,3)color(0.16,0.18,0.18,0.025,ca)';
export const vanillaGlass={intact:String.raw`a3\structures_f\data\windows\glass_ca.paa`,cracked:String.raw`a3\structures_f\data\windows\glass_ca_destruct_new.paa`,material:String.raw`a3\structures_f\data\windows\glass.rvmat`,crackedMaterial:String.raw`a3\structures_f\data\windows\glass_destruct_new.rvmat`};
export function glassConfig(id,panes,light){
  const path=n=>`${id}\\data\\${n}`;
  const material=`ambient[]={1,1,1,1}; diffuse[]={1,1,1,1}; forcedDiffuse[]={0,0,0,0}; emmisive[]={0,0,0,1}; specular[]={0.03,0.03,0.03,1}; specularPower=1000; renderFlags[]={"NoZWrite"}; PixelShaderID="Super"; VertexShaderID="Super";
class Stage1 { texture="#(argb,8,8,3)color(0.5,0.5,1,1,NOHQ)"; uvSource="tex"; };
class Stage2 { texture="#(argb,8,8,3)color(0.5,0.5,0.5,1,DT)"; uvSource="tex"; };
class Stage3 { texture="#(argb,8,8,3)color(0,0,0,0,MC)"; uvSource="tex"; };
class Stage4 { texture="#(argb,8,8,3)color(1,1,1,1,AS)"; uvSource="tex"; };
class Stage5 { texture="#(argb,8,8,3)color(1,0.04,0.95,1,SMDI)"; uvSource="tex"; };
class Stage6 { texture="#(ai,64,64,1)fresnel(1.5,0)"; uvSource="tex"; };
class Stage7 { useWorldEnvMap="true"; texture="a3\\data_f\\env_land_co.paa"; uvSource="tex"; };`;

  return {
    sources:panes.map(g=>`class Glass_${g.id}_source { source="Hit"; hitpoint="Glass_${g.id}_hitpoint"; raw=1; };`).join('\n'),
    hitpoints:panes.length?`class HitPoints { ${panes.map(g=>`class Glass_${g.id}_hitpoint { armor=${g.resistance}; material=-1; name="Glass_${g.id}"; visual="Glass_${g.id}_hide"; convexComponent="Glass_${g.id}_hide"; radius=0.25; passThrough=0; minimalHit=${g.minimalHit}; explosionShielding=${g.explosion}; };`).join('\n')} };`:'',
    bones:panes.flatMap(g=>[`"Glass_${g.id}_hide"`,'""']),
    sections:panes.map(g=>`"Glass_${g.id}_hide"`),
    animations:panes.map(g=>`class Glass_${g.id}_hide { type="hide"; source="Glass_${g.id}_source"; selection="Glass_${g.id}_hide"; minValue=0; maxValue=1; hideValue=0.999; };`).join('\n'),
    assets:panes.length?[
      {name:'data/glass.rvmat',text:material},
      {name:'data/glass_fire.rvmat',text:`surfaceInfo="${id}\\data\\glass.bisurf"; ambient[]={1,1,1,1}; diffuse[]={1,1,1,1}; forcedDiffuse[]={0,0,0,0}; emmisive[]={0,0,0,0}; specular[]={0,0,0,0}; specularPower=1; PixelShaderID="Normal"; VertexShaderID="Basic";`},
      {name:'data/glass.bisurf',text:'Density=2500; rough=0; dust=0; bulletPenetrability=69; soundEnviron="Empty"; isWater="false"; friction=0.1; restitution=0.1; impact="hitGlass"; soundHit="Glass"; deflection=0.3;'},
      ...(panes.some(g=>g.bulletproof)?[
        {name:'data/glass_armored.rvmat',text:`surfaceInfo="${id}\\data\\glass_armored.bisurf"; ambient[]={1,1,1,1}; diffuse[]={1,1,1,1}; forcedDiffuse[]={0,0,0,0}; emmisive[]={0,0,0,0}; specular[]={0,0,0,0}; specularPower=1; PixelShaderID="Normal"; VertexShaderID="Basic";`},
        {name:'data/glass_armored.bisurf',text:'Density=2500; rough=0; dust=0; bulletPenetrability=1; soundEnviron="Empty"; isWater="false"; friction=0.1; restitution=0.1; impact="hitGlass"; soundHit="Glass"; deflection=0.3;'}
      ]:[]),
      {name:'scripts/glass.sqf',text:`// Local texture state; damage and hide animations are synchronized by the engine.
params ["_building"];
if (!hasInterface || isNull _building) exitWith {};
if (_building getVariable ["abt_glass_running",false]) exitWith {};
_building setVariable ["abt_glass_running",true];
private _panes = [${panes.map((g,i)=>`["Glass_${g.id}_hitpoint",${i+(typeof light==='number'?light:light?1:0)},"${cleanGlassTexture}","\\${vanillaGlass.cracked}",-1]`).join(',')}];
while {!isNull _building} do {
  {
    private _damage = _building getHitPointDamage (_x select 0);
    private _state = if (_damage >= 0.5) then {1} else {0};
    if (_state != (_x select 4)) then {
      _building setObjectTexture [_x select 1, _x select (2 + _state)];
      _building setObjectMaterial [_x select 1, ["\\${path('glass.rvmat')}","\\${vanillaGlass.crackedMaterial}"] select _state];
      _x set [4,_state];
    };
  } forEach _panes;
  sleep 0.1;
};
`}
    ]:[]
  };
}

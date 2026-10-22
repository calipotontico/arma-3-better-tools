const allowedAssets=new Set(['stringtable.xml','scripts/seat_init.sqf','scripts/seat_request.sqf','scripts/seat_apply.sqf','scripts/seat_visible.sqf','data/light_on.rvmat','data/light_off.rvmat','scripts/light.sqf','scripts/interaction.sqf','data/glass.rvmat','data/glass_fire.rvmat','data/glass.bisurf','data/glass_armored.rvmat','data/glass_armored.bisurf','scripts/glass.sqf']);
export function validateAddonAsset(asset,seen){
  const name=asset?.name;
  if(typeof name!=='string'||(!allowedAssets.has(name)&&!/^data\/light(?:_[0-9]+)?_(?:on|off)\.rvmat$/.test(name)))throw Error('Archivo de addon inválido: '+String(name).slice(0,160));
  if(seen.has(name))throw Error('Archivo de addon duplicado: '+name);
  if(typeof asset.text!=='string'||asset.text.length>50000)throw Error('Contenido de addon inválido: '+name);
}

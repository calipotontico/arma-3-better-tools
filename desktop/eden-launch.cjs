const fs=require('node:fs/promises');
const path=require('node:path');
// A mission path is Arma's documented way to launch directly into the editor.
async function prepareEdenMission(folder){
  const dir=path.join(folder,'eden-tests','ABT_pruebas.VR');await fs.mkdir(dir,{recursive:true});
  const file=path.join(dir,'mission.sqm');
  const text=`version=54;
binarizationWanted=0;
sourceName="ABT - Pruebas";
addons[]={"A3_Map_VR"};
class EditorData {
 moveGridStep=1;angleGridStep=0.2617994;scaleGridStep=1;autoGroupingDist=10;
 class ItemIDProvider {nextID=0;};
 class Camera {pos[]={100,15,80};dir[]={0,-0.4,0.9};up[]={0,0.9,0.4};aside[]={1,0,0};};
};
class Mission {
 class Intel {briefingName="ABT - Pruebas";year=2035;month=6;day=24;hour=12;minute=0;startWeather=0;forecastWeather=0;};
 class Entities {items=0;};
};
`;
  try{await fs.writeFile(file,text,{flag:'wx'});}catch(e){if(e.code!=='EEXIST')throw e;}
  return file;
}
function edenArguments(mod,mission){return ['-noSplash','-skipIntro','-world=VR','-mod='+mod,mission];}
module.exports={prepareEdenMission,edenArguments};

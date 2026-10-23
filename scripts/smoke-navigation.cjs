const {app,BrowserWindow}=require('electron');const path=require('node:path');
app.setPath('userData',path.join(__dirname,'..','build-checks','navigation-profile'));
require('../desktop/main.cjs');const delay=ms=>new Promise(r=>setTimeout(r,ms));
setTimeout(()=>app.exit(1),45000).unref();
app.whenReady().then(async()=>{try{
 let win;for(let i=0;i<100;i++){win=BrowserWindow.getAllWindows()[0];if(win&&!win.webContents.isLoading())break;await delay(100);}
 const errors=[];win.webContents.on('console-message',(_e,level,message)=>{if(level===3)errors.push(message);});
 const run=async code=>{const result=await win.webContents.executeJavaScript(`(()=>{try{return eval(${JSON.stringify(code)})}catch(e){return {__error:e.stack}}})()`,true);if(result?.__error)throw Error(result.__error);return result;};await delay(600);
 await run(`document.getElementById('demo').click()`);await delay(700);
 const result=await run(`(()=>{
 const $=id=>document.getElementById(id);document.querySelector('#tree .piece-label').click();$('tab-glass').click();
 if(!document.querySelector('#panel-layers #existingInspect')||!document.querySelector('#panel-layers #buildingOptimizer'))throw Error('Physics tools outside Geometry panel');
 if(!document.querySelector('#panel-interiors #interiorCreate')||document.querySelector('#panel-interiors #existingInspect'))throw Error('Interior creation mixed with physics tools');
 document.querySelector('[data-component="faces"]').click();
 const faces=$('componentCount').textContent;if(!faces.match(/[1-9]/))throw Error('Selection lost');
 if($('tab-glass').getAttribute('aria-selected')!=='true')throw Error('Inspector tab changed');
 document.querySelector('[data-component="points"]').click();document.querySelector('[data-component="faces"]').click();
 if($('componentCount').textContent!==faces)throw Error('Selection changed in round trip');
 for(const tab of ['glass','doors','lights','textures','objects','layers','shadows','ladders','scale','assets','seats','interiors']){
  $('tab-'+tab).click();
  if($('componentMode').value!=='faces')throw Error('Mode lost entering '+tab);
  for(const mode of ['points','objects','faces']){
   document.querySelector('[data-component="'+mode+'"]').click();
   if($('tab-'+tab).getAttribute('aria-selected')!=='true')throw Error('Inspector changed from '+tab+' when selecting '+mode);
  }
 }
 $('tab-glass').click();
 document.querySelector('[data-component="objects"]').click();
 for(const [key,mode] of [['1','translate'],['2','rotate'],['3','scale']]){document.body.dispatchEvent(new KeyboardEvent('keydown',{key,bubbles:true}));if(!document.querySelector('[data-mode="'+mode+'"]').classList.contains('active'))throw Error('Shortcut failed '+key);}
 for(const mode of ['front','right','top','left','back','bottom','free']){$('cameraView').value=mode;$('cameraView').dispatchEvent(new Event('change'));$('frame').click();}
 return {faces,inspector:$('tab-glass').getAttribute('aria-selected'),view:$('cameraView').value,shortcuts:'passed',invert:!!$('toolbarInvertFaces')};
 })()`);
 if(errors.length)throw Error(errors.join('\n'));console.log(result);await win.capturePage().then(image=>require('node:fs').writeFileSync(path.join(__dirname,'../build-checks/navigation.png'),image.toPNG()));app.exit(0);
}catch(e){console.error(e);app.exit(1);}});

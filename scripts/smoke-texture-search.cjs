const{app,BrowserWindow}=require('electron'),path=require('node:path');app.setPath('userData',path.resolve('build-checks/texture-search-profile'));require('../desktop/main.cjs');
const delay=ms=>new Promise(r=>setTimeout(r,ms));setTimeout(()=>app.exit(1),120000).unref();
app.whenReady().then(async()=>{try{let win;for(let i=0;i<100;i++){win=BrowserWindow.getAllWindows()[0];if(win&&!win.webContents.isLoading())break;await delay(100);}await delay(600);
 await win.webContents.executeJavaScript(`document.getElementById('demo').click()`);await delay(600);
 await win.webContents.executeJavaScript(`document.querySelector('#tree .piece-label').click();document.getElementById('tab-textures').click();document.getElementById('textureSearchPanel').open=true;document.querySelector('#textureSearchPanel input').value='brick_wall_001';document.querySelector('#textureSearchPanel form').requestSubmit();`);
 for(let i=0;i<160;i++){if(await win.webContents.executeJavaScript(`!!document.querySelector('#textureSearchPanel .polyhaven-card')`))break;await delay(300);}
 await win.webContents.executeJavaScript(`document.querySelector('#textureSearchPanel .polyhaven-card').click()`);
 for(let i=0;i<100;i++){if(await win.webContents.executeJavaScript(`!!document.querySelector('#textureSearchPanel .primary')`))break;await delay(200);}
 await win.webContents.executeJavaScript(`document.querySelector('#textureSearchPanel .primary').click()`);
 let status;for(let i=0;i<150;i++){status=await win.webContents.executeJavaScript(`document.querySelector('#textureSearchPanel [role=status]').textContent`);if(status.startsWith('Aplicada.')||status.startsWith('Applied.'))break;await delay(300);}
 if(!/^(Aplicada|Applied)/.test(status))throw Error(status);console.log(status);console.log('Texture search, download and apply passed');app.exit(0);
 }catch(e){console.error(e);app.exit(1);}});

const {app,BrowserWindow}=require('electron');const path=require('node:path');const fs=require('node:fs/promises');
app.setPath('userData',path.join(__dirname,'..','build-checks','smoke-profile'));
app.on('browser-window-created',(_,w)=>w.hide());
require('../desktop/main.cjs');
const delay=ms=>new Promise(r=>setTimeout(r,ms));
setTimeout(()=>{console.error('Smoke test timed out');app.exit(1);},45000).unref();
app.whenReady().then(async()=>{try{
  let win;for(let i=0;i<100;i++){win=BrowserWindow.getAllWindows()[0];if(win&&!win.webContents.isLoading())break;await delay(100);}
  win.showInactive();await delay(2000);const run=code=>win.webContents.executeJavaScript(code,true);
  const initial=await run(`({settings:!!document.getElementById('appSettings'),version:document.getElementById('appVersion')?.textContent})`);if(!initial.settings)throw Error('Settings did not load');console.log(initial);
  await run(`document.getElementById('appLanguage').value='en';document.getElementById('appLanguage').dispatchEvent(new Event('change'));`);await delay(300);
  const en=await run(`({save:document.getElementById('save').textContent,tab:document.getElementById('tab-lights').textContent,language:document.documentElement.lang})`);if(en.save!=='Save project'||en.tab!=='Lights'||en.language!=='en')throw Error(JSON.stringify(en));console.log(en);
  const texts=await run(`Array.from(document.querySelectorAll('button,label,p,summary,option,h2,h3,.hint,.section-title')).filter(n=>!n.closest('[data-no-i18n],#tree,.element-name,#libraryList')).map(n=>n.textContent.trim()).filter(Boolean)`);
  await fs.writeFile(path.join(__dirname,'..','build-checks','ui-en-texts.json'),JSON.stringify([...new Set(texts)],null,2));
  await run(`document.getElementById('closeAppSettings').click();document.getElementById('demo').click();document.getElementById('workUV').click();`);await delay(200);
  await run(`document.getElementById('tutorialExit').click();`);
  const range=await run(`(()=>{const buttons=document.querySelectorAll('#tree .piece-label');buttons[0].click();buttons[3].dispatchEvent(new MouseEvent('click',{bubbles:true,shiftKey:true}));return document.querySelectorAll('#tree .selected').length;})()`);
  if(range!==4)throw Error('Shift range failed: '+range);
  const toolbar=await run(`(()=>{document.querySelector('[data-component="points"]').click();document.querySelector('[data-mode="rotate"]').click();const result={mode:document.getElementById('componentMode').value,visible:getComputedStyle(document.getElementById('editToolbar')).display,icons:document.querySelectorAll('[data-component]').length};document.querySelector('[data-component="objects"]').click();return result;})()`);
  if(toolbar.mode!=='points'||toolbar.visible==='none'||toolbar.icons!==3)throw Error('Toolbar failed: '+JSON.stringify(toolbar));
  const shell=await run(`(()=>{const ids=['files','projectFile','save','undo','redo','groupDoor','addToDoor','ungroup','actionOpen','actionClose','assignGlass','glassBulletproof','assignLamp','assignSwitch','moveLampMemory','moveSwitchMemory','layerMode','layerHole','generateShadows','libraryImport','libraryApply','uvExport','buildAddon'];const missing=ids.filter(id=>!document.getElementById(id));const duplicates=[...document.querySelectorAll('[id]')].map(n=>n.id).filter((id,i,a)=>a.indexOf(id)!==i);document.getElementById('workModel').click();const tree=document.getElementById('tree'),search=document.getElementById('sceneSearch');search.value='Manilla';search.dispatchEvent(new Event('input'));const filtered=[...tree.children].filter(n=>!n.hidden).length;search.value='';search.dispatchEvent(new Event('input'));return {missing,duplicates,filtered,total:tree.children.length,panes:document.querySelectorAll('.pane-resizer').length};})()`);
  if(shell.missing.length||shell.duplicates.length||shell.filtered!==1||shell.total!==12||shell.panes!==2)throw Error(JSON.stringify(shell));console.log('Shell inventory/filter',shell);
  await run(`document.querySelector('#tree .piece-label').click();document.getElementById('sceneGroupName').value='Walls';document.getElementById('createSceneGroup').click();document.querySelector('#sceneGroups .visibility-eye').click();`);
  if(!await run(`document.querySelector('#tree .scene-piece').classList.contains('piece-hidden')`))throw Error('Group hide failed');
  await run(`document.getElementById('undo').click();`);
  if(await run(`document.querySelector('#tree .scene-piece').classList.contains('piece-hidden')`))throw Error('Visibility undo failed');
  await run(`document.getElementById('redo').click();document.getElementById('showAllParts').click();`);
  if(await run(`!!document.querySelector('#tree .piece-hidden')`))throw Error('Show all failed');
  await run(`document.getElementById('tab-doors').click();document.querySelectorAll('#tree .piece-label')[4].click();document.getElementById('groupDoor').click();`);await delay(150);
  if(!await run(`!!document.querySelector('#doorList .element-card')`))throw Error('Door creation failed');
  await run(`document.getElementById('undo').click()`);await delay(100);
  if(await run(`!!document.querySelector('#doorList .element-card')`))throw Error('Door undo failed');
  await run(`document.getElementById('redo').click()`);await delay(100);
  if(!await run(`!!document.querySelector('#doorList .element-card')`))throw Error('Door redo failed');
  const tabs=await run(`(()=>{const result=[];for(const button of document.querySelectorAll('.property-tabs button')){button.click();const panel=document.getElementById(button.getAttribute('aria-controls'));result.push(!panel.hidden&&button.getAttribute('aria-selected')==='true');}return result;})()`);if(tabs.length!==12||tabs.some(v=>!v))throw Error('Tool navigation failed');
  await run(`document.getElementById('openExport').click()`);await delay(100);
  if(!await run(`document.getElementById('exportDialog').open`))throw Error('Export dialog failed');
  await run(`document.getElementById('closeExport').click();`);
  win.setSize(1000,700);await delay(200);
  const layout=await run(`(()=>{const main=document.querySelector('main'),v=document.getElementById('viewport').getBoundingClientRect(),header=document.querySelector('header');return {overflow:main.scrollWidth>main.clientWidth+1,viewport:v.width,headerOverflow:header.scrollWidth>header.clientWidth+1};})()`);if(layout.overflow||layout.headerOverflow||layout.viewport<299)throw Error('Small window layout: '+JSON.stringify(layout));console.log('1000px layout',layout);
  win.setSize(1500,950);await delay(100);
  await run(`document.getElementById('workUV').click();`);
  await run(`Array.from(document.querySelectorAll('#uvEditor button')).find(b=>b.textContent.includes('Open in another window')).click();`);await delay(500);
  if(BrowserWindow.getAllWindows().length!==2)throw Error('UV window did not open');
  const child=BrowserWindow.getAllWindows().find(w=>w!==win);
  const detached=await child.webContents.executeJavaScript(`({canvas:!!document.getElementById('uvCanvas'),language:document.documentElement.lang,back:document.getElementById('uvBack')?.textContent})`);if(!detached.canvas||detached.language!=='en')throw Error(JSON.stringify(detached));console.log(detached);
  child.close();await delay(200);if(!await run(`!!document.getElementById('uvCanvas')`))throw Error('UV failed to dock');
  await run(`document.getElementById('workModel').click();document.getElementById('appSettings').click();document.getElementById('appLanguage').value='es';document.getElementById('appLanguage').dispatchEvent(new Event('change'));`);await delay(200);
  if(await run(`document.getElementById('save').textContent`)!=='Guardar proyecto')throw Error('Spanish restore failed');
  await run(`document.getElementById('closeAppSettings').click();document.getElementById('tab-doors').click();`);await delay(300);
  await fs.writeFile(path.join(__dirname,'..','build-checks','settings-preview.png'),(await win.webContents.capturePage()).toPNG());
  await run(`document.getElementById('resumeTutorial').click();`);
  const stepCount=await run(`document.getElementById('tutorialStep').options.length`);
  if(!await run(`document.getElementById('tutorialNext').disabled`))throw Error('Practice must be gated');
  const bounds=await run(`(()=>{const r=document.querySelector('#viewport canvas').getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height};})()`);
  // Keep the practice drag clear of the movable tutorial window.
  const cx=Math.round(bounds.x+100),cy=Math.round(bounds.y+100);
  const gesture=async(button,modifiers,x=cx,y=cy,ex=cx+80,ey=cy+40)=>{
    win.webContents.sendInputEvent({type:'mouseDown',x,y,button,clickCount:1,modifiers});
    await delay(60);win.webContents.sendInputEvent({type:'mouseMove',x:ex,y:ey,modifiers:[...modifiers,button+'Button']});
    await delay(60);win.webContents.sendInputEvent({type:'mouseUp',x:ex,y:ey,button,clickCount:1,modifiers});await delay(250);
  };
  const next=async()=>{if(await run(`document.getElementById('tutorialNext').disabled`))throw Error('Practice gesture not accepted: '+await run(`document.getElementById('tutorialStep').value`));await run(`document.getElementById('tutorialNext').click()`);await delay(100);};
  await gesture('left',['alt']);await next();
  await gesture('right',['alt']);await next();
  win.webContents.sendInputEvent({type:'mouseWheel',x:Math.round(bounds.x+80),y:Math.round(bounds.y+100),deltaY:100,deltaX:0,canScroll:true});await delay(250);await next();
  await run(`document.querySelector('#tree .piece-label').click()`);await delay(100);await next();
  await run(`document.querySelectorAll('#tree .piece-label')[1].dispatchEvent(new MouseEvent('click',{bubbles:true,ctrlKey:true}))`);await delay(100);await next();
  await run(`document.getElementById('frame').click()`);await delay(300);
  await fs.writeFile(path.join(__dirname,'..','build-checks','practice.png'),(await win.webContents.capturePage()).toPNG());console.log('Practice bounds',bounds);
  await run(`window.practiceEvents=[];for(const n of ['pointerdown','pointermove','pointerup'])document.querySelector('#viewport canvas').addEventListener(n,e=>window.practiceEvents.push([n,e.button,e.altKey,e.clientX,e.clientY]),true);`);
  await gesture('left',[],Math.round(bounds.x+30),Math.round(bounds.y+150),Math.round(bounds.x+bounds.width-30),Math.round(bounds.y+bounds.height-30));console.log(await run(`({events:window.practiceEvents,selection:document.getElementById("selectionName").textContent,status:document.getElementById("status").textContent})`));await next();
  await run(`const rows=document.querySelectorAll('#tree .piece-label');rows[0].click();rows[3].dispatchEvent(new MouseEvent('click',{bubbles:true,shiftKey:true}));`);await delay(100);await next();
  await run(`document.getElementById('tutorial-minimize').click();`);
  if(!await run(`document.getElementById('guidedTutorial').classList.contains('tutorial-minimized')`))throw Error('Minimize failed');
  await run(`document.getElementById('tutorial-maximize').click();document.getElementById('tutorial-maximize').click();`);

  for(let step=0;step<stepCount;step++){await run(`document.getElementById('tutorialStep').value=${step};document.getElementById('tutorialStep').dispatchEvent(new Event('change'));`);await delay(80);}
  if(!await run(`!document.getElementById('guidedTutorial').hidden && document.getElementById('tutorialText').textContent.includes('Eden')`))throw Error('Tutorial navigation failed');
  await run(`document.getElementById('tutorialExit').click();`);
  console.log('Tutorial steps verified',stepCount);
  const builtins=await run(`window.desktop.materials.list().then(all=>all.filter(e=>e.builtin))`);if(builtins.length<5)throw Error('Bundled library missing');
  await run(`document.getElementById('tab-glass').click();Array.from(document.querySelectorAll('#tree .piece-label')).find(b=>b.textContent==='Cristal').click();document.getElementById('assignGlass').click();`);await delay(100);
  if(!await run(`document.getElementById('glassSelected').textContent.includes('glass_1')`))throw Error('Glass name failed');
  await run(`document.getElementById('undo').click();`);await delay(100);
  await run(`document.getElementById('tab-lights').click();document.getElementById('newLight').click();document.getElementById('newLight').click();`);await delay(100);
  if(await run(`document.getElementById('lightLabel').value`)!=='light_2')throw Error('Light numbering failed');
  await run(`document.getElementById('lightInteraction').value='marker';document.getElementById('lightInteraction').dispatchEvent(new Event('change'));`);await delay(100);
  if(await run(`document.getElementById('lightInteraction').value`)!=='marker')throw Error('Interaction selection failed');
  await run(`document.getElementById('undo').click();`);await delay(100);
  if(await run(`document.getElementById('lightInteraction').value`)!=='wheel')throw Error('Interaction undo failed');
  await run(`document.getElementById('tab-textures').click();document.getElementById('libraryList').value=document.getElementById('libraryList').options[0].value;document.getElementById('libraryList').dispatchEvent(new Event('change'));`);await delay(250);
  if(!await run(`document.getElementById('libraryInfo').textContent.includes('CC0') && !document.getElementById('libraryApply').disabled`))throw Error('Builtin preview failed');
  console.log('Creation names, interaction undo and five bundled CC0 materials verified');

  console.log('Desktop smoke passed: languages, settings, UV detach/dock.');app.exit(0);
}catch(e){console.error(e);app.exit(1);}});






import fs from 'node:fs/promises';
import {build,Platform,Arch} from 'electron-builder';
const releases=JSON.parse(await fs.readFile('src/releases.json','utf8'));
const pkg=JSON.parse(await fs.readFile('package.json','utf8'));
const release=releases.find(r=>r.version===pkg.version);if(!release)throw Error('Add bilingual release notes for '+pkg.version);
if(process.argv.includes('--web'))throw Error('This source distribution provides a full offline installer only.');
const buildConfig={
  appId:'com.calipo.arma3bettertools',productName:pkg.productName,asar:true,
  directories:{output:'release/installer-'+pkg.version,buildResources:'desktop/branding'},
  files:['dist/**/*','desktop/**/*','package.json','!**/*.test.*','!desktop/builtin-materials/**/*'],
  electronDist:'node_modules/electron/dist',npmRebuild:false,
  // Preserve executable identity so existing update installations replace in place.
  executableName:'Arma 3 Better Tools by Calipo',
  win:{target:['nsis'],icon:'desktop/branding/app.ico',artifactName:'Arma3BetterTools-Setup-${version}.${ext}'},
  nsis:{oneClick:false,perMachine:false,allowToChangeInstallationDirectory:true,createDesktopShortcut:true,createStartMenuShortcut:true,shortcutName:'Arma 3 Better Tools',uninstallDisplayName:'Arma 3 Better Tools',deleteAppDataOnUninstall:false,installerLanguages:['es_ES','en_US'],displayLanguageSelector:false,include:'desktop/installer.nsh',installerIcon:'desktop/branding/app.ico',uninstallerIcon:'desktop/branding/app.ico',installerSidebar:'desktop/branding/sidebar.bmp',uninstallerSidebar:'desktop/branding/sidebar.bmp',installerHeader:'desktop/branding/header.bmp'},
  publish:null,
  releaseInfo:{releaseNotes:'ES\n'+release.es.map(n=>'• '+n).join('\n')+'\n\nEN\n'+release.en.map(n=>'• '+n).join('\n')}
};
await build({targets:Platform.WINDOWS.createTarget([process.argv.includes('--dir')?'dir':'nsis'],Arch.x64),publish:'never',config:buildConfig});
console.log('Full installer created. Online updates are disabled.');

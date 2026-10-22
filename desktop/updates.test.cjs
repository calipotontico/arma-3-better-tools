const {test}=require('node:test');const assert=require('node:assert/strict');const {EventEmitter}=require('node:events');const {Updates}=require('./updates.cjs');
test('Updater coalesces checks, handles offline retry and requires downloaded state before restart',async()=>{
  const u=new EventEmitter();let checks=0,downloads=0,installs=0,allowed=0,release;
  u.checkForUpdates=()=>{checks++;u.emit('checking-for-update');return new Promise(r=>release=r);};
  u.downloadUpdate=async()=>{downloads++;u.emit('download-progress',{percent:55});u.emit('update-downloaded',{version:'0.4.0',releaseNotes:'Test notes'});};u.quitAndInstall=()=>installs++;
  const c=new Updates(u,true);assert.equal(u.autoInstallOnAppQuit,false);assert.equal(u.allowDowngrade,false);assert.equal(c.install(()=>allowed++),false);
  const first=c.check(),second=c.check();assert.equal(checks,1);u.emit('update-available',{version:'0.4.0',releaseNotes:'<script>untrusted</script>'});release();await Promise.all([first,second]);assert.equal(c.state.status,'available');
  await c.download();assert.equal(downloads,1);assert.equal(c.state.status,'ready');await c.check();assert.equal(checks,1);assert.equal(c.install(()=>allowed++),true);assert.equal(allowed,1);assert.equal(installs,1);
  u.emit('error',Error('Offline'));assert.equal(c.state.status,'error');const retry=c.check();u.emit('update-not-available');release();await retry;assert.equal(c.state.status,'current');
  const disabled=new Updates(null,false);await disabled.check();assert.equal(disabled.state.status,'disabled');assert.equal(disabled.install(()=>allowed++),false);
});

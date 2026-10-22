const test=require('node:test'),assert=require('node:assert/strict');
const {revealForClose}=require('./close-window.cjs');
test('Close restores minimized window before foregrounding and keeps connected monitor',()=>{
 const calls=[],win={isDestroyed:()=>false,isMinimized:()=>true,restore:()=>calls.push('restore'),getBounds:()=>({x:2100,y:100,width:1000,height:700}),setBounds:()=>calls.push('relocate'),show:()=>calls.push('show'),focus:()=>calls.push('focus')};
 const screen={getAllDisplays:()=>[{workArea:{x:1920,y:0,width:1920,height:1080}}]};revealForClose(win,screen);assert.deepEqual(calls,['restore','show','focus']);
});
test('Disconnected monitor restores close confirmation to an available screen',()=>{
 let bounds;const area={x:0,y:0,width:1920,height:1080};revealForClose({isDestroyed:()=>false,isMinimized:()=>false,getBounds:()=>({x:5000,y:0,width:1500,height:950}),setBounds:b=>bounds=b,show(){},focus(){}},{getAllDisplays:()=>[{workArea:area}],getPrimaryDisplay:()=>({workArea:area})});assert.equal(bounds.x,20);
});

function revealForClose(win,screen){
  if(!win||win.isDestroyed())return;
  if(win.isMinimized())win.restore();
  const bounds=win.getBounds(),areas=screen.getAllDisplays().map(d=>d.workArea);
  if(!areas.some(a=>bounds.x<a.x+a.width&&bounds.x+bounds.width>a.x&&bounds.y<a.y+a.height&&bounds.y+bounds.height>a.y)){
    const area=screen.getPrimaryDisplay().workArea;
    win.setBounds({x:area.x+20,y:area.y+20,width:Math.min(bounds.width,area.width),height:Math.min(bounds.height,area.height)});
  }
  win.show();win.focus();
}
module.exports={revealForClose};

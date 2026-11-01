'use strict';
const {app,BrowserWindow,WebContentsView,ipcMain,session}=require('electron');
const path=require('node:path');
const {readState,sessionWriter}=require('./session-state.cjs');
const {chromium}=require('playwright');
const {Registry,webUrl}=require('./registry.cjs');
const {createAutomation}=require('./mcp.cjs');
const {createBroker}=require('./broker.cjs');
const registry=new Registry(),views=new Map();let window,automation,broker,closing=false,browserPromise;
const profile=process.env.GIRRU_BROWSER_PROFILE||path.join(app.getPath('userData'),'browser-preview');app.setPath('userData',profile);
app.setName('Girru Browser');
const writeState=sessionWriter(profile);let saveTimer;
function saveWorkspace(){clearTimeout(saveTimer);if(!closing)saveTimer=setTimeout(()=>{if(window&&!window.isDestroyed())void writeState(window.getBounds(),registry.snapshot()).catch(()=>{});},300);}
const port=process.env.GIRRU_BROWSER_CDP_PORT;if(!/^\d{1,5}$/.test(port||''))throw Error('Start Browser with npm start.');
app.commandLine.appendSwitch('remote-debugging-address','127.0.0.1');app.commandLine.appendSwitch('remote-debugging-port',port);
const context=async()=>{
 if(!browserPromise)browserPromise=(async()=>{let last;for(let attempt=0;attempt<30;attempt++){try{return await chromium.connectOverCDP(`http://127.0.0.1:${port}`);}catch(e){last=e;await new Promise(r=>setTimeout(r,100));}}throw last;})();
 const browser=await browserPromise;return browser.contexts()[0];
};
function layout(){if(!window||window.isDestroyed())return;const {width,height}=window.getContentBounds();for(const [id,view]of views){view.setVisible(id===registry.active&&!!registry.tabs.get(id)?.url);if(id===registry.active)view.setBounds({x:0,y:122,width,height:Math.max(0,height-148)});}}
function changed(){layout();if(window&&!window.isDestroyed())window.webContents.send('browser:state',registry.snapshot());}
registry.on('change',()=>{changed();saveWorkspace();});
function keyboard(wc,agentId){wc.on('before-input-event',(event,input)=>{
 if(input.type!=='keyDown'||!(input.meta||input.control))return;const key=input.key.toLowerCase();
 if(key==='l'){event.preventDefault();window.webContents.focus();window.webContents.send('browser:focus-address');}
 if(key==='t'){event.preventDefault();void createTab(agentId).then(tab=>{registry.active=tab.id;registry.changed();window.webContents.focus();window.webContents.send('browser:focus-address');}).catch(()=>{});}
 if(key==='w'&&registry.active){event.preventDefault();const active=registry.tabs.get(registry.active);if(active?.agentId===agentId)views.get(active.id)?.webContents.close();}
 if(key==='r'){event.preventDefault();const active=registry.tabs.get(registry.active);if(active?.agentId===agentId)views.get(active.id)?.webContents.reload();}
});}

async function createTab(agentId,url){
 if(url)webUrl(url);const tab=registry.add(agentId);let view;
 try{
  const partition=agentId==='owner'?'persist:girru-browser-owner':'girru-browser-agent-'+agentId;
  const ownSession=session.fromPartition(partition);ownSession.setPermissionRequestHandler((_wc,_permission,callback)=>callback(false));ownSession.setPermissionCheckHandler(()=>false);if(!ownSession.girruDownloadsBlocked){ownSession.on('will-download',e=>e.preventDefault());ownSession.girruDownloadsBlocked=true;}
  const safe=url=>url.startsWith('about:blank')||(()=>{try{webUrl(url);return true;}catch{return false;}})();
  view=new WebContentsView({webPreferences:{partition,sandbox:true,contextIsolation:true,nodeIntegration:false,webSecurity:true,allowRunningInsecureContent:false}});tab.view=view;views.set(tab.id,view);window.contentView.addChildView(view);
  const wc=view.webContents;keyboard(wc,agentId);wc.setWindowOpenHandler(details=>{if(safe(details.url))void createTab(agentId,details.url).catch(()=>{});return {action:'deny'};});
  wc.on('will-navigate',(event,url)=>{if(!safe(url))event.preventDefault();});wc.on('will-redirect',(event,url)=>{if(!safe(url))event.preventDefault();});
  wc.on('page-title-updated',(_e,title)=>{tab.title=title.slice(0,160);registry.changed();});
  const update=()=>{tab.url=wc.getURL().startsWith('about:blank')?'':wc.getURL();tab.busy=wc.isLoading();registry.changed();};
  wc.on('did-navigate',update);wc.on('did-navigate-in-page',update);wc.on('did-start-loading',update);wc.on('did-stop-loading',update);
  wc.on('did-fail-load',(_event,code)=>{if(code!==-3){tab.busy=false;tab.title='Could not open page';registry.changed();}});
  wc.on('destroyed',()=>{if(window&&!window.isDestroyed())window.contentView.removeChildView(view);views.delete(tab.id);if(registry.tabs.has(tab.id))registry.remove(agentId,tab.id);});
  const bootstrap='about:blank#girru-'+tab.id;await wc.loadURL(bootstrap);const base=await context();
  for(let attempt=0;attempt<40;attempt++){tab.page=base.pages().find(p=>p.url()===bootstrap);if(tab.page)break;await new Promise(r=>setTimeout(r,50));}
  if(!tab.page)throw Error('Could not attach browser automation.');
  automation?.notifyPage?.(agentId,tab.page);if(url)await wc.loadURL(webUrl(url)).catch(()=>{tab.title='Could not open page';tab.url=url;});registry.changed();return tab;
 }catch(e){if(view&&!view.webContents.isDestroyed())view.webContents.close();if(registry.tabs.has(tab.id))registry.remove(agentId,tab.id);throw e;}
}
async function command(body){
 if(!body||typeof body!=='object')throw Error('Invalid browser command.');
 if(body.action==='state')return registry.snapshot();
 if(body.action==='new'){const tab=await createTab(body.agentId||'owner');registry.active=tab.id;registry.changed();return registry.snapshot();}
 const tab=registry.tabs.get(body.id||registry.active);if(!tab)throw Error('Choose a tab.');const wc=views.get(tab.id).webContents;
 if(body.action==='select')registry.active=tab.id;
 else if(body.action==='close')wc.close();
 else if(body.action==='navigate')await wc.loadURL(webUrl(body.url));
 else if(body.action==='back'&&wc.navigationHistory.canGoBack())wc.navigationHistory.goBack();
 else if(body.action==='forward'&&wc.navigationHistory.canGoForward())wc.navigationHistory.goForward();
 else if(body.action==='reload')wc.reload();
 registry.changed();return registry.snapshot();
}
app.whenReady().then(async()=>{
 const saved=await readState(profile);
 window=new BrowserWindow({width:saved.width,height:saved.height,minWidth:720,minHeight:480,title:'Girru Browser',backgroundColor:'#111318',webPreferences:{preload:path.join(__dirname,'preload.cjs'),sandbox:true,contextIsolation:true,nodeIntegration:false}});
 window.setMenuBarVisibility(false);keyboard(window.webContents,'owner');window.on('resize',()=>{layout();saveWorkspace();});
 window.webContents.setWindowOpenHandler(()=>({action:'deny'}));window.webContents.on('will-navigate',e=>e.preventDefault());
 ipcMain.handle('browser:command',async(event,body)=>{if(event.sender!==window.webContents)throw Error('Forbidden.');try{return {state:await command(body)};}catch{return {error:'The browser action could not be completed. Check the address or try again.'};}});
 automation=createAutomation({registry,context,createTab,outputDir:id=>path.join(profile,'output',id)});
 broker=await createBroker({registry,automation,createTab,directory:path.join(profile,'connections')});
 await window.loadFile(path.join(__dirname,'index.html'));if(saved.urls.length){for(const url of saved.urls)await createTab('owner',url).catch(()=>{});}if(!registry.tabs.size)await createTab('owner');
 window.on('closed',()=>app.quit());
}).catch(()=>{process.stderr.write('Browser could not start.\n');app.quit();});
app.on('before-quit',event=>{if(closing)return;event.preventDefault();closing=true;clearTimeout(saveTimer);void(async()=>{if(window&&!window.isDestroyed())await writeState(window.getBounds(),registry.snapshot()).catch(()=>{});await broker?.close();await automation?.close();for(const view of views.values())view.webContents.close();app.quit();})();});
app.on('window-all-closed',()=>app.quit());

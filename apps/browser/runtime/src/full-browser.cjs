'use strict';
const fs=require('node:fs/promises'),path=require('node:path'),net=require('node:net'),{spawn}=require('node:child_process'),{createHash,randomUUID}=require('node:crypto');
const {chromium}=require('playwright');
const {createCefTransport}=require('./cef-transport.cjs');
const {Registry}=require('./registry.cjs'),{createAutomation}=require('./mcp.cjs'),{createBroker}=require('./broker.cjs'),{createChromeImport}=require('./chrome-import.cjs');
const wait=ms=>new Promise(r=>setTimeout(r,ms));
async function freePort(){const s=net.createServer();await new Promise(r=>s.listen(0,'127.0.0.1',r));const p=s.address().port;await new Promise(r=>s.close(r));return p;}
async function startFullBrowser({profile,executable,extensionSource,embedded=false,onStage=()=>{}}){
 await fs.mkdir(profile,{recursive:true,mode:0o700});
 const registry=new Registry(),targetPages=new Map(),viewportSessions=new Map(),importer=createChromeImport();let browser,child,automation,closing=false,browserCDP,transport,registerOwnerPage,suppressOwnerPages=0;const pendingOwnerPages=[],nativeContexts=new Map(),streams=new Map();let sequence=0,ready=false;let creationQueue=Promise.resolve();
 const manifest=JSON.parse(await fs.readFile(path.join(extensionSource,'manifest.json'),'utf8'));
 const id=createHash('sha256').update(Buffer.from(manifest.key,'base64')).digest('hex').slice(0,32).split('').map(c=>String.fromCharCode(97+parseInt(c,16))).join('');
 const extension=path.join(profile,'.girru-extension');await fs.cp(extensionSource,extension,{recursive:true});await fs.chmod(extension,0o700);
 const nativeDir=path.join(profile,'.girru-native');await fs.mkdir(nativeDir,{recursive:true,mode:0o700});
 async function nativeCommand(body){const operation=randomUUID(),file=path.join(nativeDir,operation+'.json');await fs.writeFile(file,JSON.stringify(body),{mode:0o600});for(let i=0;i<50;i++){try{const result=JSON.parse(await fs.readFile(file+'.reply','utf8'));await fs.unlink(file+'.reply');return result;}catch{}await wait(100);}throw Error('Native browser request could not be completed.');}
 async function contextFor(agentId){while(!browserCDP&&!closing)await wait(30);if(!browserCDP)throw Error('Browser is closed.');registry.agent(agentId);return browser.contexts()[0];}
 async function nativePage(ctx,tab){const bootstrap='about:blank#girru-'+tab.id,a=registry.agent(tab.agentId),workspace=tab.agentId==='owner'?'owner':a.workspaceId||a.id;
  const task=creationQueue.catch(()=>{}).then(async()=>{
   if(nativeContexts.has(workspace))await browserCDP.send('Target.createTarget',{url:bootstrap,browserContextId:nativeContexts.get(workspace),background:true});
   else{const result=await nativeCommand({action:'create-tab',workspace,url:bootstrap});if(!result.ok)throw Error('Native browser tab could not be created.');}
   for(let attempt=0;attempt<100;attempt++){transport.refresh();for(const page of ctx.pages()){if(!page.isClosed()&&page.url()===bootstrap){const session=await ctx.newCDPSession(page);try{nativeContexts.set(workspace,(await session.send('Target.getTargetInfo')).targetInfo.browserContextId);}finally{await session.detach();}return page;}}await wait(50);}throw Error('Native Chromium tab did not attach.');
  });creationQueue=task;return task;
 }
 async function attach(tab,page){tab.page=page;const cdp=await page.context().newCDPSession(page);const {targetInfo}=await cdp.send('Target.getTargetInfo');await cdp.detach();tab.targetId=targetInfo.targetId;targetPages.set(tab.targetId,tab);
  const update=async()=>{if(page.isClosed())return;tab.url=page.url().startsWith('about:blank')?'':page.url();tab.title=await page.title().catch(()=>tab.title);registry.changed();};
  page.on('framenavigated',()=>void update());page.on('load',()=>void update());page.on('close',()=>{streams.get(tab.id)?.session.detach().catch(()=>{});streams.delete(tab.id);viewportSessions.get(tab.id)?.detach().catch(()=>{});viewportSessions.delete(tab.id);targetPages.delete(tab.targetId);if(registry.tabs.has(tab.id))registry.remove(tab.agentId,tab.id);});await update();return tab;
 }
 async function createTab(agentId,url){const tab=registry.add(agentId);try{const ctx=await contextFor(agentId);suppressOwnerPages++;let page;try{page=await nativePage(ctx,tab);await attach(tab,page);}finally{suppressOwnerPages--;if(!suppressOwnerPages)for(const p of pendingOwnerPages.splice(0))void registerOwnerPage(p);}if(agentId!=='owner'){const a=registry.agent(agentId);await page.addInitScript(label=>{document.addEventListener('DOMContentLoaded',()=>{document.title=label+' · '+document.title;},{once:true});},a.name+(a.department?' · '+a.department:''));}automation.notifyPage(agentId,page);if(url)await page.goto(url);return tab;}catch(e){if(registry.tabs.has(tab.id))registry.remove(agentId,tab.id);throw e;}}
 async function ui(body){
  if(body.action==='state'){if(!ready)throw Error('Browser is starting.');await Promise.all([...registry.tabs.values()].map(async t=>{if(t.page&&!t.page.isClosed())t.title=(await t.page.title().catch(()=>t.title)).slice(0,200);}));return registry.snapshot();}
  if(body.action==='new'){const tab=await createTab('owner',body.url||`chrome-extension://${id}/newtab.html`);registry.active=tab.id;registry.changed();if(!embedded)await tab.page.bringToFront();return {ok:true};}
  if(body.action==='onboard'){const tab=registry.tabs.get(registry.active)||registry.tabs.values().next().value;if(!tab?.page||tab.agentId!=='owner'){const next=await createTab('owner',`chrome-extension://${id}/welcome.html`);registry.active=next.id;}else await tab.page.goto(`chrome-extension://${id}/welcome.html`);registry.changed();return {ok:true};}
  if(body.action==='prompts')return nativeCommand({action:'native-prompts'});
  if(body.action==='respond-prompt'){if(!/^[A-Fa-f0-9-]{36}$/.test(body.prompt)||!/^[A-Fa-f0-9-]{36}$/.test(body.button))throw Error('Invalid browser request.');const result=await nativeCommand({action:'respond-prompt',prompt:body.prompt,button:body.button});if(!result.ok)throw Error('Browser request expired.');return result;}
  if(body.action==='profiles')return {profiles:await importer.list()};
  if(body.action==='import')return importer.preview(body);
  if(body.action==='preferences')return nativeCommand({action:'preferences',settings:body.settings||{}});
  if(body.action==='finish'){await fs.writeFile(path.join(profile,'girru-first-run.json'),JSON.stringify({complete:true}),{mode:0o600});return {ok:true};}
  const tab=body.id?registry.tabs.get(body.id):(registry.tabs.get(registry.active)||registry.tabs.values().next().value);if(!tab?.page)throw Error('Choose a browser tab.');
  if(body.action==='select'){registry.active=tab.id;registry.changed();if(!embedded)await tab.page.bringToFront();return {ok:true};}
  if(body.action==='close'){if(registry.tabs.size===1){const replacement=await createTab('owner',`chrome-extension://${id}/newtab.html`);registry.active=replacement.id;}await tab.page.close();registry.changed();return {ok:true};}
  if(body.action==='navigate'){await tab.page.goto(tab.agentId==='owner'&&body.url==='chrome://extensions/'?body.url:require('./registry.cjs').webUrl(body.url));return {ok:true};}
  if(body.action==='back'){await tab.page.goBack();return {ok:true};}
  if(body.action==='forward'){await tab.page.goForward();return {ok:true};}
  if(body.action==='reload'){await tab.page.reload();return {ok:true};}
  if(body.action==='frame'){
   for(const [other,stream]of streams)if(other!==tab.id){await stream.session.send('Page.stopScreencast').catch(()=>{});await stream.session.detach().catch(()=>{});streams.delete(other);}
   if(!streams.has(tab.id)){const session=await tab.page.context().newCDPSession(tab.page),stream={session,frame:null};streams.set(tab.id,stream);session.on('Page.screencastFrame',event=>{stream.frame={seq:++sequence,image:event.data};void session.send('Page.screencastFrameAck',{sessionId:event.sessionId}).catch(()=>{});});await session.send('Page.startScreencast',{format:'jpeg',quality:80,maxWidth:1920,maxHeight:1200,everyNthFrame:1});}
   const frame=streams.get(tab.id).frame;return frame&&frame.seq!==body.after?frame:{seq:body.after||0};
  }
  if(body.action==='input'){
   const session=await tab.page.context().newCDPSession(tab.page);try{
    if(body.kind==='text'){if(typeof body.text!=='string'||body.text.length>4096)throw Error();await session.send('Input.insertText',{text:body.text});}
    else if(body.kind==='key'){if(typeof body.key!=='string'||body.key.length>60||!['keyDown','keyUp'].includes(body.event))throw Error();await session.send('Input.dispatchKeyEvent',{type:body.event,key:body.key,code:body.code,modifiers:body.modifiers||0,windowsVirtualKeyCode:body.keyCode||0,...(body.text?{text:body.text}:{})});}
    else{if(!Number.isFinite(body.x)||!Number.isFinite(body.y)||body.x<0||body.x>1||body.y<0||body.y>1)throw Error();const size=(await session.send('Page.getLayoutMetrics')).cssLayoutViewport;await session.send('Input.dispatchMouseEvent',{type:body.kind==='wheel'?'mouseWheel':body.event==='up'?'mouseReleased':body.event==='move'?'mouseMoved':'mousePressed',x:body.x*size.clientWidth,y:body.y*size.clientHeight,button:body.kind==='wheel'?'none':body.button||'left',clickCount:body.event==='move'?0:body.count||1,...(body.kind==='wheel'?{deltaX:body.deltaX||0,deltaY:body.deltaY||0}:{})});}
   }finally{await session.detach();}return {ok:true};
  }
  if(body.action==='viewport'){
   const width=Number(body.width),height=Number(body.height);if(!body.reset&&(!Number.isInteger(width)||!Number.isInteger(height)||width<240||width>8192||height<240||height>8192))throw Error('Choose dimensions between 240 and 8192 pixels.');
   let cdp=viewportSessions.get(tab.id);if(!cdp){cdp=await tab.page.context().newCDPSession(tab.page);viewportSessions.set(tab.id,cdp);}try{if(body.reset){await cdp.send('Emulation.clearDeviceMetricsOverride');await cdp.send('Emulation.setTouchEmulationEnabled',{enabled:false});tab.viewport=null;}else{await cdp.send('Emulation.clearDeviceMetricsOverride');if(embedded){const current=(await cdp.send('Page.getLayoutMetrics')).cssLayoutViewport;const window=await browserCDP.send('Browser.getWindowForTarget',{targetId:tab.targetId});await browserCDP.send('Browser.setWindowBounds',{windowId:window.windowId,bounds:{width:width+Math.max(0,window.bounds.width-current.clientWidth),height:height+Math.max(0,window.bounds.height-current.clientHeight)}});}await cdp.send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:body.mobile?2:1,mobile:body.mobile===true,screenWidth:width,screenHeight:height,scale:1});await cdp.send('Emulation.setTouchEmulationEnabled',{enabled:body.mobile===true});tab.viewport={width,height,mobile:body.mobile===true};}}finally{if(body.reset){await cdp.detach();viewportSessions.delete(tab.id);}}return {ok:true};
  }
  throw Error('Unknown browser action.');
 }
 automation=createAutomation({registry,context:contextFor,createTab,outputDir:id=>path.join(profile,'output',id)});
 const broker=await createBroker({registry,automation,createTab,ui,presentation:embedded?'embedded':'standalone',ownerOrigin:'chrome-extension://'+id,directory:path.join(profile,'connections')});
 const connection=broker.connection;await fs.writeFile(path.join(extension,'config.json'),JSON.stringify({...connection,theme:'dark'}),{mode:0o600});
 const prefsFile=path.join(profile,'Default','Preferences');let prefs={};try{prefs=JSON.parse(await fs.readFile(prefsFile,'utf8'));}catch{}prefs.extensions={...prefs.extensions,pinned_extensions:[...new Set([...(prefs.extensions?.pinned_extensions||[]),id])]};await fs.mkdir(path.dirname(prefsFile),{recursive:true,mode:0o700});await fs.writeFile(prefsFile,JSON.stringify(prefs),{mode:0o600});
 let first=true;try{first=!JSON.parse(await fs.readFile(path.join(profile,'girru-first-run.json'),'utf8')).complete;}catch{}
 const port=await freePort(),url=first?`chrome-extension://${id}/welcome.html`:`chrome-extension://${id}/newtab.html`;
 child=spawn(executable,[`--cache-path=${profile}`,`--url=${url}`,`--remote-debugging-port=${port}`,`--load-extension=${extension}`,`--girru-extension-id=${id}`,`--girru-control-dir=${nativeDir}`,'--force-renderer-accessibility',...(embedded?['--girru-embedded','--disable-background-timer-throttling','--disable-renderer-backgrounding','--disable-backgrounding-occluded-windows']:[])],{stdio:['ignore','ignore','pipe']});let error='';child.stderr.on('data',b=>{error=(error+b).slice(-4000);});
 const terminateChild=()=>child.kill('SIGTERM');process.once('exit',terminateChild);
 child.once('error',()=>{process.removeListener('exit',terminateChild);closing=true;});child.once('exit',()=>{process.removeListener('exit',terminateChild);closing=true;void broker.close().catch(()=>{});});
 try{onStage('connect');const startupDeadline=Date.now()+45000;while(Date.now()<startupDeadline){try{const version=await(await fetch(`http://127.0.0.1:${port}/json/version`,{signal:AbortSignal.timeout(1000)})).json();transport=await createCefTransport(version.webSocketDebuggerUrl);const refresh=setInterval(()=>transport?.refresh(),100);try{browser=await chromium.connectOverCDP(transport.url,{timeout:8000});}finally{clearInterval(refresh);}break;}catch{await transport?.close().catch(()=>{});transport=null;if(closing)throw Error('Chromium could not start.');await wait(100);}}
 onStage('connected');if(!browser)throw Error('Chromium did not become ready.');browserCDP=await browser.newBrowserCDPSession();
 onStage('root-session');const owner=browser.contexts()[0];
 registerOwnerPage=async function(page){if([...registry.tabs.values()].some(t=>t.page===page))return;try{onStage('register-page');const cdp=await owner.newCDPSession(page);let info;try{info=(await cdp.send('Target.getTargetInfo')).targetInfo;}finally{await cdp.detach();}const opener=targetPages.get(info.openerId);if(opener){await attach(registry.add(opener.agentId),page);automation.notifyPage(opener.agentId,page);}else if((!nativeContexts.has('owner')&&page.url().startsWith(`chrome-extension://${id}/`))||(nativeContexts.has('owner')&&nativeContexts.get('owner')===info.browserContextId)){nativeContexts.set('owner',info.browserContextId);await attach(registry.add('owner'),page);}}catch{}}
 owner.on('page',page=>{if(suppressOwnerPages)pendingOwnerPages.push(page);else void registerOwnerPage(page);});
 for(let attempt=0;attempt<50&&!registry.tabs.size;attempt++){transport.refresh();for(const page of [...owner.pages()].sort((a,b)=>Number(b.url().startsWith(`chrome-extension://${id}/`))-Number(a.url().startsWith(`chrome-extension://${id}/`))))await registerOwnerPage(page);if(!registry.tabs.size)await wait(100);}
 if(!registry.tabs.size){await broker.close();await transport.close();child.kill('SIGTERM');throw Error('The initial browser tab did not attach.');}ready=true;onStage('ready');
 return {registry,broker,child,port,async close(){closing=true;await broker.close().catch(()=>{});await automation.close();await browser?.close().catch(()=>{});await transport?.close().catch(()=>{});child.kill('SIGTERM');}};
 }catch(error){closing=true;await broker.close().catch(()=>{});await transport?.close().catch(()=>{});await browser?.close().catch(()=>{});await automation.close().catch(()=>{});child.kill('SIGTERM');throw error;}
}
module.exports={startFullBrowser};

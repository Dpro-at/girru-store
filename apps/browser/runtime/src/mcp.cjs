'use strict';
const {EventEmitter}=require('node:events');
const fs=require('node:fs/promises'),path=require('node:path');
const {createConnection}=require('@playwright/mcp');
const {Client}=require('@modelcontextprotocol/sdk/client/index.js');
const {InMemoryTransport}=require('@modelcontextprotocol/sdk/inMemory.js');
const {webUrl}=require('./registry.cjs');
const ALLOWED=new Set(['browser_tabs','browser_navigate','browser_navigate_back','browser_snapshot','browser_click','browser_type','browser_fill_form','browser_hover','browser_press_key','browser_select_option','browser_take_screenshot','browser_wait_for','browser_drag']);
/** Each official MCP server receives only the pages in its own native tab collection. */
function scopedContext(base,registry,agentId,createTab){
 const events=new EventEmitter();
 const scope=new Proxy(base,{get(target,key){
  if(key==='pages')return ()=>[...registry.tabs.values()].filter(t=>t.agentId===agentId&&t.page&&!t.page.isClosed()).map(t=>t.page);
  if(key==='newPage')return async()=>{const tab=await createTab(agentId);return tab.page;};
  if(key==='close')return async()=>{for(const tab of [...registry.tabs.values()].filter(t=>t.agentId===agentId))await tab.page?.close();events.emit('close');};
  if(key==='emit')return (...args)=>events.emit(...args);
  if(['on','once','off','removeListener','addListener','removeAllListeners'].includes(key))return (...args)=>{events[key](...args);return scope;};
  const value=Reflect.get(target,key,target);return typeof value==='function'?value.bind(target):value;
 }});return scope;
}
function createAutomation({registry,context,createTab,outputDir}){
 const clients=new Map(),scopes=new Map();let closed=false;
 async function clientFor(agentId){
  if(closed)throw Error('Browser is closed.');registry.agent(agentId);
  if(!clients.has(agentId))clients.set(agentId,(async()=>{
   const base=await context(agentId);const scoped=scopedContext(base,registry,agentId,createTab);scopes.set(agentId,scoped);
   const server=await createConnection({browser:{isolated:false},capabilities:['core'],codegen:'none',webmcp:false,outputMaxSize:33554432,outputDir:outputDir(agentId),saveSession:false,redactUrlParams:['access_token','token','code'],allowUnrestrictedFileAccess:false},async()=>scoped);
   const client=new Client({name:'girru-browser',version:'0.1.0'});const [local,remote]=InMemoryTransport.createLinkedPair();await server.connect(remote);await client.connect(local);return {client,server};
  })().catch(e=>{clients.delete(agentId);throw e;}));return clients.get(agentId);
 }
 return {
  notifyPage(agentId,page){scopes.get(agentId)?.emit('page',page);},
  async tools(agentId){const {client}=await clientFor(agentId);return (await client.listTools()).tools.filter(t=>ALLOWED.has(t.name));},
  async call(agentId,name,args={}){if(!ALLOWED.has(name))throw Error('This browser command is not enabled.');if(name==='browser_navigate'||(name==='browser_tabs'&&args.url!==undefined))webUrl(args.url);if(name==='browser_press_key'&&/(control|meta|command|cmd)\+/i.test(args.key||'')&&!/^(Control|Meta|ControlOrMeta)\+A$/i.test(args.key))throw Error('Application and clipboard shortcuts belong to the owner.');if('isolatedContext'in args)throw Error('Session isolation is managed by Girru.');if('filename'in args)throw Error('Browser output paths are managed by Girru.');if(Buffer.byteLength(JSON.stringify(args))>65536)throw Error('Browser request is too large.');return registry.serial(agentId,async()=>{const {client}=await clientFor(agentId);const result=await client.callTool({name,arguments:args});
   // The upstream server stores snapshots on disk. Return only this agent's bounded output inline.
   const root=await fs.realpath(outputDir(agentId)).catch(()=>null);
   if(root)for(const item of [...result.content])if(item.type==='text'){
    const match=/\[Snapshot\]\(([^)]+\.yml)\)/.exec(item.text);if(!match)continue;
    const file=await fs.realpath(path.resolve(process.cwd(),match[1])).catch(()=>null);
    if(file&&file.startsWith(root+path.sep)){const handle=await fs.open(file,'r');try{const buffer=Buffer.alloc(131073),{bytesRead}=await handle.read(buffer,0,buffer.length,0);if(bytesRead<=131072)result.content.push({type:'text',text:'Current tab snapshot:\n'+buffer.subarray(0,bytesRead).toString('utf8')});}finally{await handle.close();}}
   }return result;});},
  async close(){closed=true;for(const p of clients.values()){const c=await p.catch(()=>null);await c?.client.close();await c?.server.close();}clients.clear();}
 };
}
module.exports={createAutomation,scopedContext,ALLOWED};

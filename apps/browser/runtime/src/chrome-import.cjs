'use strict';
const fs=require('node:fs/promises'),path=require('node:path'),os=require('node:os');
function chromeRoot(env=process.env,platform=process.platform){return platform==='darwin'?path.join(os.homedir(),'Library/Application Support/Google/Chrome'):platform==='win32'?path.join(env.LOCALAPPDATA||path.join(os.homedir(),'AppData/Local'),'Google/Chrome/User Data'):path.join(os.homedir(),'.config/google-chrome');}
async function readJson(file,max=16*1024*1024){const handle=await fs.open(file,'r');try{const data=Buffer.alloc(max+1);let total=0;while(total<data.length){const {bytesRead}=await handle.read(data,total,data.length-total,null);if(!bytesRead)break;total+=bytesRead;}if(total>max)throw Error('Source file is too large.');return JSON.parse(data.subarray(0,total).toString('utf8'));}finally{await handle.close();}}
function createChromeImport({root=chromeRoot()}={}){
 let profiles=[];
 async function list(){try{const state=await readJson(path.join(root,'Local State'));profiles=Object.entries(state.profile?.info_cache||{}).filter(([id])=>id==='Default'||/^Profile \d+$/.test(id)).slice(0,30).map(([id,p])=>({id,name:typeof p.name==='string'?p.name.slice(0,80):id}));return profiles;}catch{return [];}}
 async function preview({profile,bookmarks=false,history=false,settings=false,extensions=false}){
  if(!profiles.some(p=>p.id===profile))await list();if(!profiles.some(p=>p.id===profile))throw Error('Choose a detected Chrome profile.');
  const base=await fs.realpath(root),directory=await fs.realpath(path.join(root,profile));if(!directory.startsWith(base+path.sep))throw Error('Invalid source profile.');
  const result={bookmarks:[],history:[],settings:{},extensions:[],warnings:[]};
  if(bookmarks){try{const source=await readJson(path.join(directory,'Bookmarks'));function visit(node,folder=''){if(result.bookmarks.length>=10000)return;if(node.type==='url'&&/^https?:\/\//.test(node.url))result.bookmarks.push({title:String(node.name||'').slice(0,300),url:node.url.slice(0,8192),folder});for(const child of node.children||[])visit(child,node.name?folder+'/'+String(node.name).slice(0,120):folder);}for(const node of Object.values(source.roots||{}))visit(node);}catch{result.warnings.push('Bookmarks could not be read.');}}
  if(history){try{const {DatabaseSync}=require('node:sqlite');const db=new DatabaseSync(path.join(directory,'History'),{readOnly:true});try{result.history=db.prepare("SELECT url,title FROM urls WHERE hidden=0 AND (url LIKE 'https://%' OR url LIKE 'http://%') ORDER BY last_visit_time DESC LIMIT 5000").all().map(x=>({url:x.url.slice(0,8192),title:String(x.title||'').slice(0,300)}));}finally{db.close();}}catch{result.warnings.push('History could not be read. Close Chrome and try again.');}}
  if(settings||extensions){try{const prefs=await readJson(path.join(directory,'Preferences'));if(settings){for(const key of ['homepage','homepage_is_newtabpage'])if(typeof prefs[key]==='string'||typeof prefs[key]==='boolean')result.settings[key]=prefs[key];if(typeof prefs.bookmark_bar?.show_on_all_tabs==='boolean')result.settings['bookmark_bar.show_on_all_tabs']=prefs.bookmark_bar.show_on_all_tabs;}
   if(extensions){let rows=prefs.extensions?.settings||{};try{const secure=await readJson(path.join(directory,'Secure Preferences'));rows={...rows,...secure.extensions?.settings};}catch{}result.extensions=Object.entries(rows).filter(([id,p])=>/^[a-p]{32}$/.test(id)&&p.location!==5).slice(0,200).map(([id,p])=>({id,name:typeof p.manifest?.name==='string'?p.manifest.name.slice(0,120):id}));}
  }catch{result.warnings.push('Settings or extension list could not be read.');}}
  return result;
 }
 return {list,preview};
}
module.exports={createChromeImport,chromeRoot,readJson};

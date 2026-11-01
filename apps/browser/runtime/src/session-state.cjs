'use strict';
const fs=require('node:fs/promises'),path=require('node:path');
const {webUrl}=require('./registry.cjs');
async function readState(directory){
 try{const s=JSON.parse(await fs.readFile(path.join(directory,'workspace.json'),'utf8'));return {width:Math.max(720,Math.min(3840,Number(s.width)||1280)),height:Math.max(480,Math.min(2160,Number(s.height)||860)),urls:Array.isArray(s.urls)?s.urls.slice(0,8).filter(u=>{try{return webUrl(u)===u;}catch{return false;}}):[]};}catch{return {width:1280,height:860,urls:[]};}
}
function sessionWriter(directory){let queue=Promise.resolve();return (bounds,snapshot)=>{const state={width:bounds.width,height:bounds.height,urls:snapshot.tabs.filter(t=>t.agentId==='owner'&&t.url).map(t=>t.url).slice(0,8)};const work=queue.catch(()=>{}).then(async()=>{await fs.mkdir(directory,{recursive:true,mode:0o700});const file=path.join(directory,'workspace.json'),temp=file+'.tmp';await fs.writeFile(temp,JSON.stringify(state),{mode:0o600});await fs.rename(temp,file);});queue=work;return work;};}
module.exports={readState,sessionWriter};

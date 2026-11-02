'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs/promises'),os=require('node:os'),path=require('node:path');
const {Registry}=require('../src/registry.cjs'),{createBroker}=require('../src/broker.cjs');
test('owner issues private agent credentials; agent cannot impersonate another or reach owner controls',async t=>{
 const directory=await fs.mkdtemp(path.join(os.tmpdir(),'girru-browser-'));t.after(()=>fs.rm(directory,{recursive:true,force:true}));const registry=new Registry(),seen=[];
 const broker=await createBroker({registry,directory,automation:{tools:async id=>({id}),call:async(id,name)=>{seen.push(id);return {id,name};}},createTab:async id=>registry.add(id),ui:async body=>({ok:body.action==='respond-prompt'})});t.after(()=>broker.close());
 const admin=broker.connection;assert.deepEqual(JSON.parse(await fs.readFile(broker.file,'utf8')),admin);
 const call=(route,body,token=admin.token,extra={})=>fetch(admin.url+route,{method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json',...extra},body:JSON.stringify(body)});
 assert.equal((await call('/agents',{id:'a',name:'A'},'invalid')).status,403);
 const r=await(await call('/agents',{id:'a',name:'A'})).json();const agent=registry.agent('a');assert.deepEqual(JSON.parse(await fs.readFile(r.connectionFile,'utf8')),{schema:1,url:admin.url,token:agent.token});if(process.platform!=='win32')assert.equal((await fs.stat(r.connectionFile)).mode&0o777,0o600);
 assert.equal((await call('/ui',{action:'respond-prompt',prompt:'pending',button:'accept'},agent.token)).status,404);
 assert.equal((await call('/agents',{id:'b',name:'B'},agent.token)).status,404);
 await call('/call',{name:'browser_snapshot',agentId:'b'},agent.token);assert.deepEqual(seen,['a']);
 assert.equal((await call('/call',{},agent.token,{Origin:'https://untrusted.example'})).status,403);
});

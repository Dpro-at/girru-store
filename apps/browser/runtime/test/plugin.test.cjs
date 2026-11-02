const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs/promises'),os=require('node:os'),path=require('node:path'),{createHash}=require('node:crypto');
const {Registry}=require('../src/registry.cjs'),{createBroker}=require('../src/broker.cjs');
test('Girru plugin pairs from trusted chat context and strips private snapshot file links',async t=>{
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'girru-browser-plugin-'));let tool,called;
 const registry=new Registry(),broker=await createBroker({registry,directory:root,createTab:async()=>({id:'unused'}),automation:{tools:async()=>[],call:async(id,name,args)=>{called={id,name,args};return {content:[{type:'text',text:'[Snapshot](/private/profile/output/one.yml)\nCurrent tab snapshot: Example Domain'}]};}}});
 const previous=process.env.DPRO_BROWSER_CONNECTION_FILE;process.env.DPRO_BROWSER_CONNECTION_FILE=broker.file;
 t.after(async()=>{if(previous===undefined)delete process.env.DPRO_BROWSER_CONNECTION_FILE;else process.env.DPRO_BROWSER_CONNECTION_FILE=previous;await broker.close();await fs.rm(root,{recursive:true,force:true});});
 const plugin=(await import('../../integration/index.js')).default;
 await plugin.register({registerTool:value=>tool=value,db:{prepare:()=>({get:id=>id==='real-agent'?{id,name:'Real agent',department:'Marketing'}:undefined})}});
 assert.ok((await tool.execute({action:'navigate',arguments:{url:'https://example.com'}})).error);
 const ctx={userId:'owner',agentId:'real-agent',sessionId:'chat'};
 const result=await tool.execute({action:'navigate',agentId:'forged',arguments:{url:'https://example.com'}},ctx);
 assert.equal(result.error,undefined);assert.equal(called.name,'browser_navigate');assert.equal(called.id,createHash('sha256').update(JSON.stringify(['owner','chat','real-agent'])).digest('hex').slice(0,40));
 assert.equal(registry.agent(called.id).name,'Real agent');assert.doesNotMatch(JSON.stringify(result),/\/private|\.yml|token/);assert.match(JSON.stringify(result),/Example Domain/);
 assert.ok((await tool.execute({action:'constructor'},ctx)).error);
});

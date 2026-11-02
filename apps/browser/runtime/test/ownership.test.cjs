'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {Registry,webUrl}=require('../src/registry.cjs');
const {scopedContext,ALLOWED}=require('../src/mcp.cjs');
test('5000 registered agents create no tabs until needed; tab references cannot cross owners',()=>{
 const r=new Registry();for(let i=0;i<5000;i++)r.register({id:'agent-'+i,name:'Agent '+i});assert.equal(r.tabs.size,0);
 const a=r.add('agent-1'),b=r.add('agent-2');assert.throws(()=>r.own('agent-2',a.id));assert.throws(()=>r.remove('agent-1',b.id));assert.equal(r.own('agent-1',a.id).id,a.id);
 assert.ok(!JSON.stringify(r.snapshot()).includes(r.agent('agent-1').token));assert.equal(r.authenticate(r.agent('agent-2').token).id,'agent-2');
});
test('one agent is serialized while another continues independently',async()=>{
 const r=new Registry();r.register({id:'a',name:'A'});r.register({id:'b',name:'B'});let release;const blocked=new Promise(resolve=>release=resolve),order=[];
 const first=r.serial('a',async()=>{order.push('a1');await blocked;});const second=r.serial('a',async()=>order.push('a2'));await r.serial('b',async()=>order.push('b1'));assert.deepEqual(order,['a1','b1']);release();await Promise.all([first,second]);assert.deepEqual(order,['a1','b1','a2']);
});
test('the official MCP context sees only assigned pages and creates within the same owner',async()=>{
 const r=new Registry();r.register({id:'a',name:'A'});r.register({id:'b',name:'B'});
 const page=()=>({isClosed:()=>false,close:async()=>{}});const a=r.add('a');a.page=page();const b=r.add('b');b.page=page();
 const scope=scopedContext({pages:()=>[a.page,b.page]},r,'a',async id=>{const t=r.add(id);t.page=page();return t;});assert.deepEqual(scope.pages(),[a.page]);const created=await scope.newPage();assert.equal(r.tabs.size,3);assert.deepEqual(scope.pages(),[a.page,created]);assert.ok(!scope.pages().includes(b.page));
 for(const name of ['browser_evaluate','browser_run_code_unsafe','browser_install','browser_file_upload','browser_cookie_list'])assert.equal(ALLOWED.has(name),false);
});
test('navigation accepts web addresses and refuses local files, script schemes and embedded credentials',()=>{
 assert.equal(webUrl('https://example.com'),'https://example.com/');for(const value of ['file:///etc/passwd','javascript:alert(1)','data:text/html,test','https://name:password@example.com'])assert.throws(()=>webUrl(value));
});

test('MCP rejects alternate contexts, unsafe tabs URLs and filesystem output before touching Chromium',async()=>{
 const {createAutomation}=require('../src/mcp.cjs');const r=new Registry();r.register({id:'a',name:'A'});let connected=false;
 const automation=createAutomation({registry:r,context:async()=>{connected=true;throw Error('Should not connect');},createTab:async()=>{},outputDir:()=>'/unused'});
 for(const [name,args]of [['browser_tabs',{action:'new',isolatedContext:'other'}],['browser_tabs',{action:'new',url:'file:///private/example'}],['browser_snapshot',{filename:'/private/example'}],['browser_evaluate',{function:'()=>1'}],['browser_press_key',{key:'Meta+v'}],['browser_press_key',{key:'ControlOrMeta+t'}]])await assert.rejects(automation.call('a',name,args));
 assert.equal(connected,false);await automation.close();
});

test('restoring the workspace retains owner web tabs without replaying agent pages or credentials',async t=>{
 const fs=require('node:fs/promises'),os=require('node:os'),path=require('node:path'),{readState,sessionWriter}=require('../src/session-state.cjs');
 const directory=await fs.mkdtemp(path.join(os.tmpdir(),'girru-browser-state-'));t.after(()=>fs.rm(directory,{recursive:true,force:true}));
 await sessionWriter(directory)({width:900,height:600},{tabs:[{agentId:'owner',url:'https://example.com/'},{agentId:'agent',url:'https://other.example/'}]});
 assert.deepEqual(await readState(directory),{width:900,height:600,urls:['https://example.com/']});
 await fs.writeFile(path.join(directory,'workspace.json'),JSON.stringify({width:1,height:99999,urls:['file:///private/example','javascript:1','https://example.com/']}));
 assert.deepEqual(await readState(directory),{width:720,height:2160,urls:['https://example.com/']});
});

test('an agent workspace cannot alias the owner profile or introduce a filesystem path',()=>{
 const registry=new Registry();
 for(const workspaceId of ['owner','../Default','/private','x'.repeat(101)])assert.throws(()=>registry.register({id:'a',name:'A',workspaceId}));
 assert.equal(registry.register({id:'a',name:'A',workspaceId:'chat-safe'}).workspaceId,'chat-safe');
});

const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs/promises'),os=require('node:os'),path=require('node:path'),http=require('node:http'),{randomBytes}=require('node:crypto'),{spawnSync}=require('node:child_process');
const {Client}=require('@modelcontextprotocol/sdk/client/index.js'),{StdioClientTransport}=require('@modelcontextprotocol/sdk/client/stdio.js');
const entry=path.resolve(__dirname,'../scripts/mcp.mjs');
test('stdio adapter rejects noncanonical connections and oversized credential files before connecting',async t=>{
 const directory=await fs.mkdtemp(path.join(os.tmpdir(),'girru-mcp-boundary-'));t.after(()=>fs.rm(directory,{recursive:true,force:true}));const file=path.join(directory,'connection.json'),token=randomBytes(32).toString('hex');
 const inputs=['https://external.example','http://127.0.0.1:0','http://name:password@127.0.0.1:1234','http://127.0.0.1:1234/path','http://127.0.0.1:1234#fragment'].map(url=>JSON.stringify({url,token}));inputs.push(JSON.stringify({url:'http://127.0.0.1:1234',token,padding:'x'.repeat(4096)}));
 for(const body of inputs){await fs.writeFile(file,body,{mode:0o600});const result=spawnSync(process.execPath,[entry],{env:{...process.env,GIRRU_BROWSER_CONNECTION:file},encoding:'utf8',timeout:5000});assert.equal(result.status,1);assert.ok(!result.stderr.includes(token));}
});
test('stdio adapter never follows a broker redirect or forwards its credential to the destination',async t=>{
 const directory=await fs.mkdtemp(path.join(os.tmpdir(),'girru-mcp-redirect-'));let received=0;const destination=http.createServer((_,res)=>{received++;res.end('{}');});const listen=s=>new Promise(resolve=>s.listen(0,'127.0.0.1',resolve));await listen(destination);
 const broker=http.createServer((_,res)=>{res.writeHead(307,{Location:`http://127.0.0.1:${destination.address().port}/other`});res.end();});await listen(broker);
 const file=path.join(directory,'connection.json');await fs.writeFile(file,JSON.stringify({url:`http://127.0.0.1:${broker.address().port}`,token:randomBytes(32).toString('hex')}),{mode:0o600});
 const client=new Client({name:'local-security-fixture',version:'1.0.0'});t.after(async()=>{await client.close();broker.closeAllConnections();destination.closeAllConnections();await Promise.all([new Promise(r=>broker.close(r)),new Promise(r=>destination.close(r))]);await fs.rm(directory,{recursive:true,force:true});});
 await client.connect(new StdioClientTransport({command:process.execPath,args:[entry],env:{...process.env,GIRRU_BROWSER_CONNECTION:file},stderr:'pipe'}));await assert.rejects(client.listTools());assert.equal(received,0);
});

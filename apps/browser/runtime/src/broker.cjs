'use strict';
const http=require('node:http'),fs=require('node:fs/promises'),path=require('node:path'),{randomBytes}=require('node:crypto');
async function createBroker({registry,automation,directory,createTab,ownerOrigin,ui,presentation='standalone'}){
 const admin=randomBytes(32).toString('hex');
 const server=http.createServer(async(req,res)=>{
  const send=(status,data)=>{res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(JSON.stringify(data));};
  const allowedOrigin=ownerOrigin&&req.headers.origin===ownerOrigin;
  if((req.headers.origin&&!allowedOrigin)||!/^127\.0\.0\.1:\d+$/.test(req.headers.host||''))return send(403,{error:'Local application requests only.'});
  if(allowedOrigin){res.setHeader('Access-Control-Allow-Origin',ownerOrigin);res.setHeader('Access-Control-Allow-Headers','Authorization, Content-Type');res.setHeader('Access-Control-Allow-Methods','POST');if(req.method==='OPTIONS'){res.writeHead(204);return res.end();}}
  if(req.method!=='POST')return send(405,{error:'POST required.'});
  const token=/^Bearer ([a-f0-9]{64})$/.exec(req.headers.authorization||'')?.[1];const isAdmin=token===admin;const agent=registry.authenticate(token);if(!isAdmin&&!agent)return send(403,{error:'Browser connection required.'});
  try{
   let size=0,chunks=[];for await(const chunk of req){size+=chunk.length;if(size>(req.url==='/ui'?4194304:65536)){req.destroy();return;}chunks.push(chunk);}const body=JSON.parse(Buffer.concat(chunks).toString('utf8'));
   if(isAdmin&&req.url==='/ui'&&ui)return send(200,await ui(body));
   if(isAdmin&&req.url==='/agents'){
    if(body.id==='owner')return send(400,{error:'Reserved identity.'});const a=registry.register(body);await fs.mkdir(directory,{recursive:true,mode:0o700});const file=path.join(directory,a.id+'.json');await fs.writeFile(file,JSON.stringify({schema:1,url:`http://127.0.0.1:${server.address().port}`,token:a.token}),{mode:0o600});return send(200,{id:a.id,connectionFile:file});
   }
   if(!agent)return send(403,{error:'Use an agent connection for browser commands.'});
   if(req.url==='/tools')return send(200,{tools:await automation.tools(agent.id)});
   if(req.url==='/call')return send(200,await automation.call(agent.id,body.name,body.arguments));
   if(req.url==='/tab'){const tab=await createTab(agent.id,body.url);return send(200,{id:tab.id});}
   return send(404,{error:'Unknown browser request.'});
  }catch{return send(400,{error:'Browser request could not be completed.'});}
 });
 server.requestTimeout=10000;server.headersTimeout=10000;
 await new Promise(r=>server.listen(0,'127.0.0.1',r));await fs.mkdir(directory,{recursive:true,mode:0o700});
 const file=path.join(directory,'owner-runtime.json');await fs.writeFile(file,JSON.stringify({schema:1,presentation,url:`http://127.0.0.1:${server.address().port}`,token:admin}),{mode:0o600});
 return {file,close:async()=>{server.closeAllConnections();await new Promise(r=>server.close(r));await fs.unlink(file).catch(()=>{});}};
}
module.exports={createBroker};

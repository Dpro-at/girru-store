import fs from 'node:fs/promises';
import {Server} from '@modelcontextprotocol/sdk/server/index.js';
import {StdioServerTransport} from '@modelcontextprotocol/sdk/server/stdio.js';
import {ListToolsRequestSchema,CallToolRequestSchema} from '@modelcontextprotocol/sdk/types.js';
const file=process.env.GIRRU_BROWSER_CONNECTION;
if(!file)throw Error('GIRRU_BROWSER_CONNECTION must point to an owner-issued agent connection file.');
const handle=await fs.open(file,'r');let connection;try{const buffer=Buffer.alloc(4097),{bytesRead}=await handle.read(buffer,0,buffer.length,0);if(bytesRead>4096)throw Error('Invalid local browser connection.');connection=JSON.parse(buffer.subarray(0,bytesRead).toString('utf8'));}finally{await handle.close();}
const url=new URL(connection.url);if(!/^http:\/\/127\.0\.0\.1:\d{1,5}$/.test(connection.url)||!Number.isInteger(Number(url.port))||Number(url.port)<1||Number(url.port)>65535||url.protocol!=='http:'||url.hostname!=='127.0.0.1'||!/^[a-f0-9]{64}$/.test(connection.token))throw Error('Invalid local browser connection.');
async function call(route,body){const r=await fetch(new URL(route,url),{method:'POST',redirect:'error',headers:{Authorization:`Bearer ${connection.token}`,'Content-Type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.timeout(90000)});if(!r.ok)throw Error('Browser command failed.');return r.json();}
const server=new Server({name:'girru-browser',version:'0.1.0'},{capabilities:{tools:{}}});
server.setRequestHandler(ListToolsRequestSchema,()=>call('/tools',{}));
server.setRequestHandler(CallToolRequestSchema,req=>call('/call',req.params));
await server.connect(new StdioServerTransport());

import fs from 'node:fs/promises';
import {Server} from '@modelcontextprotocol/sdk/server/index.js';
import {StdioServerTransport} from '@modelcontextprotocol/sdk/server/stdio.js';
import {ListToolsRequestSchema,CallToolRequestSchema} from '@modelcontextprotocol/sdk/types.js';
const file=process.env.GIRRU_BROWSER_CONNECTION;
if(!file)throw Error('GIRRU_BROWSER_CONNECTION must point to an owner-issued agent connection file.');
const connection=JSON.parse(await fs.readFile(file,'utf8'));
const url=new URL(connection.url);if(url.protocol!=='http:'||url.hostname!=='127.0.0.1'||!/^[a-f0-9]{64}$/.test(connection.token))throw Error('Invalid local browser connection.');
async function call(route,body){const r=await fetch(new URL(route,url),{method:'POST',headers:{Authorization:`Bearer ${connection.token}`,'Content-Type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.timeout(90000)});if(!r.ok)throw Error('Browser command failed.');return r.json();}
const server=new Server({name:'girru-browser',version:'0.1.0'},{capabilities:{tools:{}}});
server.setRequestHandler(ListToolsRequestSchema,()=>call('/tools',{}));
server.setRequestHandler(CallToolRequestSchema,req=>call('/call',req.params));
await server.connect(new StdioServerTransport());

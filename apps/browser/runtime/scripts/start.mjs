import {createRequire} from 'node:module';import {spawn} from 'node:child_process';import net from 'node:net';import path from 'node:path';import {fileURLToPath} from 'node:url';
const require=createRequire(import.meta.url),root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const socket=net.createServer();await new Promise(r=>socket.listen(0,'127.0.0.1',r));const port=socket.address().port;await new Promise(r=>socket.close(r));
const electron=process.env.GIRRU_BROWSER_ELECTRON||require('electron');
const child=spawn(electron,[root],{stdio:'inherit',env:{...process.env,GIRRU_BROWSER_CDP_PORT:String(port)}});child.on('exit',code=>process.exit(code??1));for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>child.kill(signal));

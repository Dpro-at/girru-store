'use strict';
const path=require('node:path'),os=require('node:os'),{startFullBrowser}=require('../src/full-browser.cjs');
const {startupErrorMessage}=require('../src/startup-error.cjs');
const root=path.resolve(__dirname,'../..');
const profile=process.env.GIRRU_BROWSER_PROFILE||path.join(os.homedir(),process.platform==='darwin'?'Library/Application Support/Girru Browser':'.girru/browser');
const executable=process.env.GIRRU_CHROMIUM_EXECUTABLE||path.join(root,'.local-runtime/native-build/GirruBrowser.app/Contents/MacOS/GirruBrowser');
let runtime,closing=false;
void startFullBrowser({profile,executable,extensionSource:path.join(root,'extension'),embedded:process.env.GIRRU_BROWSER_EMBEDDED==='1'}).then(r=>{runtime=r;console.log('Girru Browser ready.');r.child.on('exit',()=>process.exit(0));}).catch(error=>{console.error(startupErrorMessage(error));process.exitCode=1;});
async function close(){if(closing)return;closing=true;const deadline=setTimeout(()=>process.exit(0),3000);try{await runtime?.close();}finally{clearTimeout(deadline);process.exit(0);}}
process.on('SIGINT',close);process.on('SIGTERM',close);

const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs/promises'),os=require('node:os'),path=require('node:path');
const {startFullBrowser}=require('../src/full-browser.cjs');
test('failed native startup removes the broker credential and its process-exit listener',async t=>{
 const profile=await fs.mkdtemp(path.join(os.tmpdir(),'girru-failed-browser-'));
 t.after(()=>fs.rm(profile,{recursive:true,force:true}));
 const before=process.listenerCount('exit');
 await assert.rejects(startFullBrowser({profile,executable:path.join(profile,'missing-runtime'),extensionSource:path.resolve(__dirname,'../../extension'),embedded:true}),/Chromium could not start/);
 await assert.rejects(fs.access(path.join(profile,'connections/owner-runtime.json')));
 assert.equal(process.listenerCount('exit'),before);
});

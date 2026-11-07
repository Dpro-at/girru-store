import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
const source=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
async function fixture(t,id='browser'){
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'girru-browser-index-'));t.after(()=>fs.rm(root,{recursive:true,force:true}));
 for(const dir of ['apps','mcp','skills','specialties','scripts'])await fs.mkdir(path.join(root,dir));
 await fs.copyFile(path.join(source,'scripts/build-index.mjs'),path.join(root,'scripts/build-index.mjs'));
 const app=path.join(root,'apps',id);await fs.mkdir(path.join(app,'package'),{recursive:true});
 const manifest=JSON.parse(await fs.readFile(path.join(source,'apps/browser/manifest.json'),'utf8'));manifest.id=id;
 manifest.runtime={version:manifest.version,protocolVersion:1,archives:{'darwin-arm64':{url:'https://github.com/Dpro-at/girru-store/releases/download/synthetic/browser.tar.gz',sha256:'a'.repeat(64),size:100}}};
 await fs.writeFile(path.join(app,'manifest.json'),JSON.stringify(manifest));
 await fs.writeFile(path.join(app,'package/agentplayer.plugin.json'),JSON.stringify({id,version:manifest.version}));
 const {buildIndex}=await import(pathToFileURL(path.join(root,'scripts/build-index.mjs')));return {buildIndex,manifest,app};
}
test('Browser catalogue preserves both reviewed automation package and native runtime',async t=>{
 const {buildIndex}=await fixture(t);const browser=buildIndex().items[0];assert.equal(browser.id,'browser');assert.ok(browser.package.files.length);assert.equal(browser.runtime.archives['darwin-arm64'].size,100);
});
test('other apps cannot acquire Browser dual-package capability',async t=>{
 const {buildIndex}=await fixture(t,'other-app');assert.throws(buildIndex,/only Browser/);
});
test('Browser dual-package exception still validates runtime version and archive checksum',async t=>{
 const {buildIndex,manifest,app}=await fixture(t);manifest.runtime.version='9.0.0';await fs.writeFile(path.join(app,'manifest.json'),JSON.stringify(manifest));assert.throws(buildIndex,/equal the manifest version/);
 manifest.runtime.version=manifest.version;manifest.runtime.archives['darwin-arm64'].sha256='invalid';await fs.writeFile(path.join(app,'manifest.json'),JSON.stringify(manifest));assert.throws(buildIndex,/sha256/);
});

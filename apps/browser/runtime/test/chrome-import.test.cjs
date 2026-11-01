'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs/promises'),os=require('node:os'),path=require('node:path');
const {createChromeImport}=require('../src/chrome-import.cjs');
test('Chrome import reads only the owner-selected fields and never reads password or cookie databases',async t=>{
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'girru-chrome-import-'));t.after(()=>fs.rm(root,{recursive:true,force:true}));const profile=path.join(root,'Default');await fs.mkdir(profile);await fs.writeFile(path.join(root,'Local State'),JSON.stringify({profile:{info_cache:{Default:{name:'Fixture Chrome'},'../../other':{name:'Outside'}}}}));
 await fs.writeFile(path.join(profile,'Bookmarks'),JSON.stringify({roots:{bookmark_bar:{name:'Bookmarks bar',children:[{type:'url',name:'Fixture',url:'https://example.com/'},{type:'url',name:'Do not import local files',url:'file:///private/example'}]}}}));
 await fs.writeFile(path.join(profile,'Preferences'),JSON.stringify({homepage:'https://example.com/',homepage_is_newtabpage:false,bookmark_bar:{show_on_all_tabs:true},secrets:{password:'not-to-be-read'},extensions:{settings:{['a'.repeat(32)]:{location:1,manifest:{name:'Fixture extension'}}}}}));
 const importer=createChromeImport({root});assert.deepEqual(await importer.list(),[{id:'Default',name:'Fixture Chrome'}]);await assert.rejects(importer.preview({profile:'../../other',bookmarks:true}));
 const selection=await importer.preview({profile:'Default',bookmarks:true,settings:true,extensions:true});assert.equal(selection.bookmarks.length,1);assert.equal(selection.extensions.length,1);assert.equal(selection.settings.homepage,'https://example.com/');assert.ok(!JSON.stringify(selection).includes('not-to-be-read'));
 const empty=await importer.preview({profile:'Default'});assert.equal(empty.bookmarks.length,0);assert.deepEqual(empty.settings,{});assert.deepEqual(empty.history,[]);
});
test('Chrome profile symlinks cannot escape the detected browser data root',async t=>{
 if(process.platform==='win32')return;const root=await fs.mkdtemp(path.join(os.tmpdir(),'girru-import-link-')),outside=await fs.mkdtemp(path.join(os.tmpdir(),'girru-import-outside-'));t.after(()=>Promise.all([fs.rm(root,{recursive:true,force:true}),fs.rm(outside,{recursive:true,force:true})]));await fs.writeFile(path.join(root,'Local State'),JSON.stringify({profile:{info_cache:{Default:{name:'Fixture'}}}}));await fs.symlink(outside,path.join(root,'Default'));await assert.rejects(createChromeImport({root}).preview({profile:'Default',bookmarks:true}),/Invalid source profile/);
});

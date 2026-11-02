const {test}=require('node:test'),assert=require('node:assert/strict');
const presets=require('../../extension/device-presets.json');
test('device catalogue provides distinct profiles across all supported size families',()=>{
 assert.equal(new Set(presets.map(p=>p.id)).size,presets.length);
 for(const kind of ['phone','foldable','tablet','laptop','desktop','tv'])assert.ok(presets.some(p=>p.kind===kind));
 assert.ok(presets.filter(p=>p.kind==='phone').length>10);
 assert.ok(presets.some(p=>p.kind==='tv'&&p.width===7680&&p.height===4320));
 for(const p of presets){assert.ok(p.name&&p.group);assert.ok(Number.isInteger(p.width)&&p.width>=240&&p.width<=8192);assert.ok(Number.isInteger(p.height)&&p.height>=240&&p.height<=8192);assert.equal(p.mobile,['phone','foldable','tablet'].includes(p.kind));}
});
test('start-page search encodes Google queries and rejects executable or credential URLs',async()=>{
 const {searchAddress}=await import('../../extension/search-url.js');
 assert.equal(searchAddress('browser design ideas'),'https://www.google.com/search?q=browser%20design%20ideas');
 assert.equal(searchAddress('تصميم متصفح'),'https://www.google.com/search?q='+encodeURIComponent('تصميم متصفح'));
 assert.equal(searchAddress('example.com/docs'),'https://example.com/docs');assert.equal(searchAddress('localhost:3000'),'http://localhost:3000');
 for(const input of ['javascript:alert(1)','file:///private','https://user:password@example.com','x'.repeat(4097)])assert.equal(searchAddress(input),null);
});

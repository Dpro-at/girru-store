const {test}=require('node:test');
const assert=require('node:assert/strict');
const {nativeStartupError}=require('../src/startup-error.cjs');
test('nested sandbox denial gives an actionable error without exposing stderr',()=>{
 const message=nativeStartupError('private profile token sandbox initialization failed: Operation not permitted').message;
 assert.match(message,/child-process sandbox/);assert.match(message,/does not disable/);assert.doesNotMatch(message,/private profile token/);
});
test('profile socket denial remains distinct from nested sandbox denial',()=>{
 assert.match(nativeStartupError('Failed to bind() secret/SingletonSocket').message,/temporary profile socket/);
 assert.equal(nativeStartupError('unknown native detail').message,'Chromium could not start.');
});

test('runtime launcher exposes only known sanitized startup diagnostics',()=>{
 const {startupErrorMessage}=require('../src/startup-error.cjs');
 assert.match(startupErrorMessage(nativeStartupError('sandbox initialization failed')),/child-process sandbox/);
 assert.doesNotMatch(startupErrorMessage(new Error('secret profile path and token')),/secret/);
});

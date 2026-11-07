function nativeStartupError(stderr = '') {
  if (/sandbox initialization failed|Failed to initialize the sandbox/i.test(stderr)) {
    return new Error('Chromium could not start: macOS refused its child-process sandbox. Run Browser outside a nested sandbox or use an isolated test environment. Browser does not disable its sandbox automatically.');
  }
  if (/Failed to bind\(\).*SingletonSocket|Failed to create a ProcessSingleton/i.test(stderr)) {
    return new Error('Chromium could not start: the isolated environment denied its temporary profile socket. Allow only the test browser socket or use a separate test environment.');
  }
  return new Error('Chromium could not start.');
}
function startupErrorMessage(error) {
  const message = error instanceof Error ? error.message : '';
  const known = ['', 'sandbox initialization failed', 'Failed to create a ProcessSingleton'].map(nativeStartupError).map(error => error.message);
  return known.includes(message) ? message : 'Girru Browser could not start. Check the native runtime and profile.';
}
module.exports = { nativeStartupError, startupErrorMessage };

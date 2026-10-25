const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
function load(location, api = async () => []) {
  const source = fs.readFileSync(require('node:path').join(__dirname, '../src/features/venues/location.ts'), 'utf8');
  const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const module = { exports: {} };
  new Function('exports', 'require', 'module', compiled)(module.exports, name => name === 'expo-location' ? location : { apiRequest: api }, module);
  return module.exports;
}
const position = (latitude = 17, timestamp = Date.now(), accuracy = 10) => ({ coords: { latitude, longitude: 78, accuracy }, timestamp });
test('already granted access obtains a fresh fix without another permission prompt', async () => {
  let reads = 0;
  const api = load({ Accuracy: { High: 4 }, getForegroundPermissionsAsync: async () => ({ granted: true }),
    requestForegroundPermissionsAsync: () => { throw Error('must not prompt'); }, hasServicesEnabledAsync: async () => true,
    getCurrentPositionAsync: async () => { reads++; return position(); } });
  await api.currentLocation(true); await api.currentLocation(true);
  assert.equal(reads, 2);
});
test('denied access is not repeatedly requested during automatic refresh', async () => {
  let prompts = 0, reads = 0;
  const api = load({ getForegroundPermissionsAsync: async () => ({ granted: false, canAskAgain: true }),
    requestForegroundPermissionsAsync: async () => { prompts++; return { granted: false }; },
    getCurrentPositionAsync: () => { reads++; } });
  await assert.rejects(api.currentLocation(false), /settings/);
  await assert.rejects(api.currentLocation(true), /settings/);
  assert.equal(prompts, 1); assert.equal(reads, 0);
});
test('unavailable services and inaccurate, nonfinite or stale fixes offer manual fallback', async () => {
  const api = load({ getForegroundPermissionsAsync: async () => ({ granted: true }), hasServicesEnabledAsync: async () => false });
  await assert.rejects(api.currentLocation(false), /manually/);
  for (const value of [position(91), position(NaN), position(17, Date.now() - 121000), position(17, Date.now(), 1001)]) {
    assert.throws(() => api.toLocationFix(value), /invalid|accuracy|old/);
  }
});
test('nearby sends the new coordinates and token, never a selectable user ID', async () => {
  let observed;
  const api = load({}, async (route, options) => { observed = { route, options }; return []; });
  const fix = api.toLocationFix(position());
  await api.nearbyGrounds('player-token', fix);
  assert.equal(observed.route, '/api/players/me/nearby');
  assert.equal(observed.options.headers.Authorization, 'Bearer player-token');
  assert.deepEqual(JSON.parse(observed.options.body), fix);
  assert.equal(Object.hasOwn(fix, 'userId'), false);
});
test('movement updates require both meaningful distance and throttling interval', () => {
  const api = load({}); const now = Date.now();
  const first = api.toLocationFix(position(17, now));
  assert.equal(api.movedEnough(first, api.toLocationFix(position(17.0001, now + 30000), now + 30000)), false);
  assert.equal(api.movedEnough(first, api.toLocationFix(position(17.01, now + 10000), now + 10000)), false);
  assert.equal(api.movedEnough(first, api.toLocationFix(position(17.01, now + 30000), now + 30000)), true);
});

test('web requests bypass cached positions and report accuracy separately from stale fixes', async () => {
  const before = process.env.EXPO_OS;
  process.env.EXPO_OS = 'web';
  try {
    let options;
    const api = load({ Accuracy: { High: 4 }, getForegroundPermissionsAsync: async () => ({ granted: true }),
      hasServicesEnabledAsync: async () => true,
      getCurrentPositionAsync: async value => { options = value; return position(); } });
    await api.currentLocation(false);
    assert.equal(options.maximumAge, 0);
    assert.equal(options.timeout, 20000);
    assert.throws(() => api.toLocationFix(position(17, Date.now(), 5000)), /accuracy of about 5,000/);
    assert.throws(() => api.toLocationFix(position(17, Date.now() - 121000)), /old or incorrectly timed/);
  } finally {
    if (before === undefined) delete process.env.EXPO_OS; else process.env.EXPO_OS = before;
  }
});
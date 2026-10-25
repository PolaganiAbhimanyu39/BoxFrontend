const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

function load(relative, fetchImpl) {
  const filename = path.join(__dirname, '..', relative);
  const compiled = ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const module = { exports: {} };
  new Function('exports', 'require', 'module', 'fetch', compiled)(module.exports, require, module, fetchImpl);
  return module.exports;
}
const management = load('src/features/management/form.ts');
const user = { fullName: 'Test Owner', phone: '9876543210', email: 'owner@example.com', password: '', status: 'active' };
const venue = { name: 'Test Ground', description: '', phone: '9876543210', email: '', addressLine1: 'Main Road', addressLine2: '', locality: 'Area', city: 'Hyderabad', state: 'Telangana', postalCode: '500001', latitude: '17.4', longitude: '78.4', locationUrl: 'https://maps.app.goo.gl/example', timezone: 'Asia/Kolkata', status: 'active' };

test('user update preserves password when blank and uses the existing role endpoint', () => {
  assert.deepEqual(management.validateForm('users', user), {});
  assert.equal(Object.hasOwn(management.editPayload('users', user), 'password'), false);
  const password = ' valid password ';
  assert.equal(management.editPayload('users', { ...user, password }).password, password);
  for (const [role, endpoint] of Object.entries(management.userRoles)) {
    assert.equal(management.editPath('users', { userId: 4, role }), `/api/users/${endpoint}/4`);
  }
});
test('validates contact, password byte limits and status without changing user role', () => {
  assert.ok(management.validateForm('users', { ...user, phone: '123', password: 'short', status: 'deleted' }).phone);
  assert.ok(management.validateForm('users', { ...user, password: '😀'.repeat(19) }).password);
  assert.ok(management.validateForm('users', { ...user, email: 'bad' }).email);
  assert.equal(Object.hasOwn(management.editPayload('users', { ...user, role: 'APP_OWNER' }), 'role'), false);
});
test('venue edit sends profile fields and coordinates, excluding creation-only assignments', () => {
  assert.deepEqual(management.validateForm('venues', venue), {});
  const payload = management.editPayload('venues', { ...venue, ownerUserId: '12', sportTypeIds: '1', amenityIds: '2' });
  assert.equal(payload.latitude, 17.4);
  assert.equal(payload.longitude, 78.4);
  assert.equal(payload.email, null);
  for (const key of ['ownerUserId', 'sportTypeIds', 'amenityIds']) assert.equal(Object.hasOwn(payload, key), false);
  assert.equal(management.editPath('venues', { id: 3 }), '/api/venues/3');
});
test('rejects invalid venue coordinates and unsafe map URLs, permits clearing map URL', () => {
  assert.ok(management.validateForm('venues', { ...venue, latitude: '91' }).latitude);
  assert.ok(management.validateForm('venues', { ...venue, longitude: '' }).longitude);
  assert.ok(management.validateForm('venues', { ...venue, locationUrl: 'javascript:alert(1)' }).locationUrl);
  assert.equal(management.editPayload('venues', { ...venue, locationUrl: '' }).locationUrl, null);
});
test('rejects malformed list records and unknown user roles', () => {
  assert.equal(management.validRecord('users', { userId: 1, fullName: 'Owner', role: 'APP_OWNER' }), true);
  assert.equal(management.validRecord('users', { userId: 1, fullName: 'Owner', role: 'UNKNOWN' }), false);
  assert.equal(management.validRecord('venues', { id: -1, name: 'Ground' }), false);
});
test('204 delete response succeeds without JSON content and retains bearer header', async () => {
  let observed;
  const api = load('src/services/api.ts', async (url, options) => { observed = options; return { ok: true, status: 204, json: async () => { throw new Error('No body'); } }; });
  assert.equal(await api.apiRequest('/api/venues/1', { method: 'DELETE', headers: { Authorization: 'Bearer test-token' } }), null);
  assert.equal(observed.method, 'DELETE');
  assert.equal(observed.headers.Authorization, 'Bearer test-token');
});
test('failed delete and unreadable non-204 responses do not report success', async () => {
  const failed = load('src/services/api.ts', async () => ({ ok: false, status: 403, json: async () => ({ message: 'Forbidden' }) }));
  await assert.rejects(failed.apiRequest('/api/users/2', { method: 'DELETE' }), /Forbidden/);
  const unreadable = load('src/services/api.ts', async () => ({ ok: true, status: 200, json: async () => null }));
  await assert.rejects(unreadable.apiRequest('/api/users/2'), /unreadable/);
});

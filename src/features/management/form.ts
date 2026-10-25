export type Kind = 'venues' | 'users';
export type ManagedRecord = Record<string, unknown>;
export type Field = { key: string; label: string; optional?: boolean; max?: number; keyboard?: 'email-address' | 'phone-pad' | 'url' | 'numbers-and-punctuation'; multiline?: boolean; secret?: boolean };
export const venueFields: Field[] = [
  { key: 'name', label: 'Venue name', max: 150 },
  { key: 'description', label: 'Description', optional: true, multiline: true },
  { key: 'phone', label: 'Contact number', max: 20, keyboard: 'phone-pad' },
  { key: 'email', label: 'Contact email', optional: true, max: 255, keyboard: 'email-address' },
  { key: 'addressLine1', label: 'Address', max: 200 },
  { key: 'addressLine2', label: 'Landmark / address line 2', optional: true, max: 200 },
  { key: 'locality', label: 'Area / locality', max: 100 },
  { key: 'city', label: 'City', max: 100 },
  { key: 'state', label: 'State', max: 100 },
  { key: 'postalCode', label: 'Postal code', max: 10 },
  { key: 'latitude', label: 'Latitude', keyboard: 'numbers-and-punctuation' },
  { key: 'longitude', label: 'Longitude', keyboard: 'numbers-and-punctuation' },
  { key: 'locationUrl', label: 'Location URL', optional: true, keyboard: 'url' },
  { key: 'timezone', label: 'Timezone', max: 50 },
];
export const userFields: Field[] = [
  { key: 'fullName', label: 'Full name', max: 100 },
  { key: 'phone', label: 'Phone number', keyboard: 'phone-pad', max: 16 },
  { key: 'email', label: 'Email address', optional: true, max: 255, keyboard: 'email-address' },
  { key: 'password', label: 'New password', optional: true, secret: true },
];
export const userRoles: Record<string, string> = { APP_OWNER: 'appOwner', VENUE_OWNER: 'venueOwner', PLAYER: 'player' };
export function recordId(kind: Kind, record: ManagedRecord): number {
  return Number(record[kind === 'venues' ? 'id' : 'userId']);
}
export function recordName(kind: Kind, record: ManagedRecord): string {
  return String(record[kind === 'venues' ? 'name' : 'fullName'] ?? '');
}
export function validRecord(kind: Kind, value: unknown): value is ManagedRecord {
  if (!value || typeof value !== 'object') return false;
  const record = value as ManagedRecord;
  return Number.isSafeInteger(recordId(kind, record)) && recordId(kind, record) > 0
    && typeof record[kind === 'venues' ? 'name' : 'fullName'] === 'string'
    && (kind !== 'users' || (typeof record.role === 'string' && Object.hasOwn(userRoles, record.role)));
}
export function editPath(kind: Kind, record: ManagedRecord): string {
  return kind === 'venues' ? `/api/venues/${recordId(kind, record)}`
    : `/api/users/${userRoles[String(record.role)]}/${recordId(kind, record)}`;
}
export function statuses(kind: Kind): string[] {
  return kind === 'venues' ? ['draft', 'pending_approval', 'active', 'suspended', 'closed'] : ['active', 'blocked'];
}
export function validateForm(kind: Kind, form: Record<string, string>): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const field of kind === 'venues' ? venueFields : userFields) {
    if (!field.optional && !form[field.key]?.trim()) errors[field.key] = 'This field is required.';
    if (field.max && form[field.key]?.length > field.max) errors[field.key] = `Use no more than ${field.max} characters.`;
  }
  if (form.email?.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) errors.email = 'Enter a valid email address.';
  if (!statuses(kind).includes(form.status)) errors.status = 'Select a valid status.';
  if (kind === 'users') {
    if (!/^\+?[1-9][0-9]{7,14}$/.test(form.phone.trim())) errors.phone = 'Enter 8 to 15 digits, optionally starting with +.';
    const bytes = [...form.password].reduce((sum, char) => { const c = char.codePointAt(0) ?? 0; return sum + (c > 65535 ? 4 : c > 2047 ? 3 : c > 127 ? 2 : 1); }, 0);
    if (form.password && (form.password.length < 8 || !form.password.trim() || bytes > 72)) errors.password = 'Use at least 8 characters and no more than 72 UTF-8 bytes.';
  } else {
    for (const [key, limit] of [['latitude', 90], ['longitude', 180]] as const) {
      const value = form[key].trim();
      if (!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(value) || !Number.isFinite(Number(value)) || Math.abs(Number(value)) > limit) errors[key] = `Enter a number from ${-limit} to ${limit}.`;
    }
    if (form.locationUrl.trim()) {
      try { const url = new URL(form.locationUrl.trim()); if (url.protocol !== 'https:' || !url.hostname || /\s/.test(form.locationUrl.trim())) throw new Error(); }
      catch { errors.locationUrl = 'Enter a valid HTTPS location URL.'; }
    }
  }
  return errors;
}
export function editPayload(kind: Kind, form: Record<string, string>): ManagedRecord {
  const fields = kind === 'venues' ? venueFields : userFields;
  const payload: ManagedRecord = { status: form.status };
  for (const field of fields) {
    const value = form[field.key];
    if (field.secret) { if (value) payload[field.key] = value; }
    else payload[field.key] = value.trim() || (field.optional ? null : '');
  }
  if (kind === 'venues') { payload.latitude = Number(form.latitude); payload.longitude = Number(form.longitude); }
  return payload;
}

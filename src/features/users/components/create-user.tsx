import { AuthColors } from '@/constants/auth-colors';
import { useEffect, useRef, useState, type ComponentRef } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ApiError, apiRequest } from '@/services/api';
import { useSession } from '@/context/session';

type Role = 'VENUE_OWNER' | 'APP_OWNER' | 'PLAYER';
type CreatedUser = { userId: number; fullName: string; role: Role; email: string | null; login?: { token: string; expiresIn: number; user: { userId: number; role: string } } };
const endpoints: Record<Role, string> = { VENUE_OWNER: '/api/users/venueOwner', APP_OWNER: '/api/users/appOwner', PLAYER: '/api/users/player' };

export default function CreateUser({ mode = 'admin', onClose, onCreated, onBusyChange }: { mode?: 'admin' | 'owner' | 'signup'; onClose: () => void; onCreated: (user: CreatedUser) => void; onBusyChange: (busy: boolean) => void }) {
  const { session } = useSession();
  const signup = mode === 'signup';
  const [role, setRole] = useState<Role>(signup ? 'PLAYER' : 'VENUE_OWNER');
  const [form, setForm] = useState({ fullName: '', phone: '', email: '', password: '' });
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const submitting = useRef(false);
  const alive = useRef(true);
  const request = useRef<AbortController | null>(null);
  const scroll = useRef<ComponentRef<typeof ScrollView>>(null);
  useEffect(() => {
    alive.current = true;
    return () => { alive.current = false; request.current?.abort(); };
  }, []);
  function update(key: keyof typeof form, value: string) {
    setForm(current => ({ ...current, [key]: value })); setError('');
    setErrors(current => ({ ...current, [key]: '' }));
  }
  async function submit() {
    if (submitting.current) return;
    const invalid: Record<string, string> = {};
    if (!form.fullName.trim()) invalid.fullName = 'Enter the full name.';
    if (!/^\+?[1-9][0-9]{7,14}$/.test(form.phone.trim())) invalid.phone = 'Enter 8 to 15 digits, optionally starting with +.';
    if ((signup && !form.email.trim()) || (form.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim()))) invalid.email = 'Enter a valid email address for signing in.';
    const bytes = [...form.password].reduce((total, character) => { const code = character.codePointAt(0) ?? 0; return total + (code > 65535 ? 4 : code > 2047 ? 3 : code > 127 ? 2 : 1); }, 0);
    if (form.password.length < 8 || !form.password.trim() || bytes > 72) invalid.password = 'Use at least 8 characters and no more than 72 UTF-8 bytes.';
    setErrors(invalid);
    if (Object.keys(invalid).length) { setError('Check the highlighted fields below.'); scroll.current?.scrollTo({ y: 0, animated: true }); return; }
    submitting.current = true; setSaving(true); onBusyChange(true); setError('');
    const controller = new AbortController(); request.current = controller;
    try {
      const result = await apiRequest(endpoints[role], { method: 'POST', signal: controller.signal, headers: session ? { Authorization: 'Bearer ' + session.token } : {}, body: JSON.stringify({ fullName: form.fullName.trim(), phone: form.phone.trim(), email: form.email.trim() || null, password: form.password }) });
      if (!result || typeof result !== 'object' || !('userId' in result) || !Number.isSafeInteger(result.userId)) throw new ApiError('Could not confirm account creation. Try signing in or checking the owner list before retrying.');
      let login: CreatedUser['login'];
      if (signup) {
        try {
          const data = await apiRequest('/api/auth/login', { method: 'POST', signal: controller.signal, body: JSON.stringify({ email: form.email.trim(), password: form.password }) });
          if (data && typeof data === 'object' && 'token' in data && typeof data.token === 'string'
              && 'expiresIn' in data && typeof data.expiresIn === 'number' && data.expiresIn > 0
              && 'user' in data && data.user && typeof data.user === 'object' && 'userId' in data.user
              && data.user.userId === result.userId && 'role' in data.user && data.user.role === 'PLAYER') {
            login = { token: data.token, expiresIn: data.expiresIn, user: { userId: result.userId as number, role: 'PLAYER' } };
          }
        } catch { /* Account creation succeeded. Offer normal sign-in without creating it again. */ }
      }
      if (alive.current) onCreated({ userId: result.userId as number, fullName: form.fullName.trim(), role, email: form.email.trim() || null, login });
    } catch (err) {
      if (alive.current) {
        const message = err instanceof Error ? err.message : 'Unable to create the account.';
        setError(message + (/timed out|reach the server|unreadable/.test(message) ? ' The account may have been saved. Check before retrying.' : ''));
        if (err instanceof ApiError) setErrors(err.fields);
        scroll.current?.scrollTo({ y: 0, animated: true });
      }
    } finally { submitting.current = false; onBusyChange(false); if (alive.current) setSaving(false); }
  }
  const title = signup ? 'Join the game' : mode === 'owner' ? 'Create venue owner' : 'Add a user';
  return <SafeAreaView style={s.screen}><KeyboardAvoidingView style={s.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
    <View style={s.header}><View style={s.flex}><Text style={s.eyebrow}>{signup ? 'BOX. / SIGN UP' : 'ACCOUNT SETUP'}</Text><Text style={s.title}>{title}</Text></View><Pressable onPress={onClose} disabled={saving} accessibilityRole="button" accessibilityLabel="Close account form" style={s.close}><Text style={s.link}>Close</Text></Pressable></View>
    <ScrollView ref={scroll} contentContainerStyle={s.content} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag">
      <Text style={s.intro}>{signup ? 'Create your player account to discover grounds and get ready for your next game.' : 'Create an account for the person who will manage venues or the application.'}</Text>
      {error ? <Text style={s.errorBox} accessibilityRole="alert" accessibilityLiveRegion="polite">{error}</Text> : null}
      {mode === 'admin' ? <View style={s.field}><Text style={s.label}>Account type</Text><View style={s.roles}>{(['VENUE_OWNER', 'APP_OWNER'] as const).map(value => <Pressable key={value} disabled={saving} accessibilityRole="radio" accessibilityState={{ checked: role === value }} onPress={() => setRole(value)} style={[s.role, role === value && s.selected]}><Text style={s.link}>{value === 'VENUE_OWNER' ? 'Venue Owner' : 'App Owner'}</Text></Pressable>)}</View></View> : null}
      <View style={s.field}><Text style={s.label}>Full name *</Text><TextInput accessibilityLabel="Full name, required" value={form.fullName} onChangeText={value => update('fullName', value)} editable={!saving} maxLength={100} autoComplete="name" style={[s.input, !!errors.fullName && s.invalid]} />{errors.fullName ? <Text style={s.error}>{errors.fullName}</Text> : null}</View>
      <View style={s.field}><Text style={s.label}>Phone number *</Text><TextInput accessibilityLabel="Phone number, required" value={form.phone} onChangeText={value => update('phone', value)} editable={!saving} maxLength={16} keyboardType="phone-pad" autoComplete="tel" style={[s.input, !!errors.phone && s.invalid]} />{errors.phone ? <Text style={s.error}>{errors.phone}</Text> : null}</View>
      <View style={s.field}><Text style={s.label}>Email address{signup ? ' *' : ' (optional)'}</Text><TextInput accessibilityLabel={signup ? 'Email address, required' : 'Email address, optional'} value={form.email} onChangeText={value => update('email', value)} editable={!saving} maxLength={255} keyboardType="email-address" autoCapitalize="none" autoCorrect={false} autoComplete="email" style={[s.input, !!errors.email && s.invalid]} /><Text style={s.hint}>An email address is needed to sign in.</Text>{errors.email ? <Text style={s.error}>{errors.email}</Text> : null}</View>
      <View style={s.field}><Text style={s.label}>Password *</Text><View style={[s.password, !!errors.password && s.invalid]}><TextInput accessibilityLabel="Password, required" value={form.password} onChangeText={value => update('password', value)} editable={!saving} secureTextEntry={!showPassword} autoCapitalize="none" autoCorrect={false} autoComplete="new-password" style={s.passwordInput} /><Pressable accessibilityRole="button" accessibilityLabel={showPassword ? 'Hide password' : 'Show password'} disabled={saving} onPress={() => setShowPassword(value => !value)} style={s.show}><Text style={s.link}>{showPassword ? 'Hide' : 'Show'}</Text></Pressable></View><Text style={s.hint}>At least 8 characters. Passwords are case sensitive.</Text>{errors.password || errors.passwordWithinEncodingLimit ? <Text style={s.error}>{errors.password || errors.passwordWithinEncodingLimit}</Text> : null}</View>
      <Pressable accessibilityRole="button" accessibilityState={{ disabled: saving, busy: saving }} disabled={saving} onPress={() => void submit()} style={[s.submit, saving && s.disabled]}>{saving ? <ActivityIndicator color={AuthColors.surface} /> : <Text style={s.submitText}>{signup ? 'Create my account' : 'Create user'}</Text>}</Pressable>
      <Pressable onPress={onClose} disabled={saving} style={s.cancel} accessibilityRole="button"><Text style={s.link}>{signup ? 'Already have an account? Sign in' : 'Cancel'}</Text></Pressable>
    </ScrollView>
  </KeyboardAvoidingView></SafeAreaView>;
}
const s = StyleSheet.create({
  flex: { flex: 1 }, screen: { flex: 1, backgroundColor: AuthColors.background }, header: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: 1, borderColor: AuthColors.divider },
  eyebrow: { color: AuthColors.eyebrow, fontSize: 10, letterSpacing: 1.5, fontWeight: '700' }, title: { color: AuthColors.heading, fontSize: 25, fontWeight: '800', marginTop: 4 }, close: { minWidth: 48, minHeight: 48, justifyContent: 'center', alignItems: 'center' },
  content: { padding: 20, paddingBottom: 36, maxWidth: 480, width: '100%', alignSelf: 'center' }, intro: { fontSize: 15, lineHeight: 23, color: AuthColors.muted, marginBottom: 24 }, field: { marginBottom: 20 }, label: { fontSize: 14, fontWeight: '600', color: AuthColors.label, marginBottom: 8 },
  input: { minHeight: 50, borderWidth: 1, borderColor: AuthColors.border, borderRadius: 12, backgroundColor: AuthColors.surface, paddingHorizontal: 14, paddingVertical: 13, fontSize: 16, color: AuthColors.text },
  password: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: AuthColors.border, borderRadius: 12, backgroundColor: AuthColors.surface }, passwordInput: { flex: 1, minWidth: 0, minHeight: 50, padding: 14, fontSize: 16, color: AuthColors.text }, show: { minWidth: 56, minHeight: 48, alignItems: 'center', justifyContent: 'center' },
  hint: { color: AuthColors.muted, fontSize: 12, lineHeight: 19, marginTop: 6 }, invalid: { borderColor: AuthColors.errorBorder }, error: { color: AuthColors.error, fontSize: 13, lineHeight: 20, marginTop: 6 }, errorBox: { color: AuthColors.error, backgroundColor: AuthColors.errorBackground, padding: 14, borderRadius: 12, marginBottom: 20, lineHeight: 22 },
  roles: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 }, role: { minHeight: 48, padding: 14, borderWidth: 1, borderColor: AuthColors.border, borderRadius: 12, justifyContent: 'center', backgroundColor: AuthColors.surface }, selected: { borderColor: AuthColors.link, backgroundColor: AuthColors.successBackground, borderWidth: 2 }, link: { color: AuthColors.link, fontSize: 14, fontWeight: '600' },
  submit: { minHeight: 54, borderRadius: 14, backgroundColor: AuthColors.primary, alignItems: 'center', justifyContent: 'center', padding: 16, marginTop: 8 }, submitText: { color: AuthColors.surface, fontSize: 16, fontWeight: '700' }, disabled: { opacity: 0.5 }, cancel: { minHeight: 54, alignItems: 'center', justifyContent: 'center', marginTop: 8 },
});

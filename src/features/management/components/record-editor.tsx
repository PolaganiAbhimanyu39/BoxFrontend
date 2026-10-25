import { useEffect, useRef, useState, type ComponentRef } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ApiError, apiRequest } from '@/services/api';
import { useSession } from '@/context/session';
import { editPath, editPayload, recordId, statuses, userFields, validRecord, validateForm, venueFields, type Kind, type ManagedRecord } from '@/features/management/form';

export default function RecordEditor({ kind, record, onClose, onSaved, onBusyChange }: { kind: Kind; record: ManagedRecord; onClose: () => void; onSaved: () => void; onBusyChange: (busy: boolean) => void }) {
  const { session } = useSession();
  const fields = kind === 'venues' ? venueFields : userFields;
  const [form, setForm] = useState<Record<string, string>>(() => Object.fromEntries([...fields.map(field => [field.key, field.secret ? '' : String(record[field.key] ?? '')]), ['status', String(record.status ?? '')]]));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const pending = useRef(false);
  const alive = useRef(true);
  const request = useRef<AbortController | null>(null);
  const scroll = useRef<ComponentRef<typeof ScrollView>>(null);
  useEffect(() => { alive.current = true; return () => { alive.current = false; request.current?.abort(); }; }, []);
  function change(key: string, value: string) { setForm(current => ({ ...current, [key]: value })); setErrors(current => ({ ...current, [key]: '' })); setError(''); }
  async function save() {
    if (pending.current || session?.user.role !== 'APP_OWNER') return;
    const invalid = validateForm(kind, form); setErrors(invalid);
    if (Object.keys(invalid).length) { setError('Check the highlighted fields.'); scroll.current?.scrollTo({ y: 0, animated: true }); return; }
    pending.current = true; setBusy(true); onBusyChange(true); setError('');
    const controller = new AbortController(); request.current = controller;
    try {
      const result = await apiRequest(editPath(kind, record), { method: 'PUT', headers: { Authorization: `Bearer ${session.token}` }, body: JSON.stringify(editPayload(kind, form)), signal: controller.signal });
      if (!validRecord(kind, result) || recordId(kind, result) !== recordId(kind, record)) throw new ApiError('Could not confirm the update. Reload the list before trying again.');
      if (alive.current) onSaved();
    } catch (err) {
      if (alive.current) { setError((err instanceof Error ? err.message : 'Unable to save changes.') + ' Reload the list before retrying if the request was interrupted.'); if (err instanceof ApiError) setErrors(err.fields); scroll.current?.scrollTo({ y: 0, animated: true }); }
    } finally { pending.current = false; onBusyChange(false); if (alive.current) setBusy(false); }
  }
  if (session?.user.role !== 'APP_OWNER') return <SafeAreaView><Text>App owner access required.</Text></SafeAreaView>;
  return <SafeAreaView style={s.screen}><KeyboardAvoidingView style={s.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
    <View style={s.header}><Text style={s.title}>Edit {kind === 'venues' ? 'venue' : 'user'}</Text><Pressable disabled={busy} onPress={onClose} accessibilityRole="button" style={s.action}><Text style={s.link}>Close</Text></Pressable></View>
    <ScrollView ref={scroll} keyboardShouldPersistTaps="handled" contentContainerStyle={s.content}>
      <Text style={s.hint}>{kind === 'venues' ? 'Update the venue profile. Owner, sports and amenities remain assigned as before.' : `Account type: ${String(record.role).replaceAll('_', ' ')}. Leave the new password blank to keep the current password.`}</Text>
      {error ? <Text style={s.errorBox} accessibilityRole="alert">{error}</Text> : null}
      {fields.map(field => <View key={field.key} style={s.field}>
        <Text style={s.label}>{field.label}{field.optional ? ' (optional)' : ' *'}</Text>
        <TextInput accessibilityLabel={field.label} value={form[field.key]} onChangeText={value => change(field.key, value)} editable={!busy} maxLength={field.max} keyboardType={field.keyboard} autoCapitalize={field.keyboard || field.secret || field.key === 'timezone' ? 'none' : 'sentences'} autoCorrect={!field.keyboard && !field.secret && field.key !== 'timezone'} multiline={field.multiline} secureTextEntry={field.secret && !showPassword} style={[s.input, field.multiline && s.multiline, !!errors[field.key] && s.invalid]} />
        {field.secret ? <Pressable disabled={busy} onPress={() => setShowPassword(value => !value)} style={s.action} accessibilityRole="button"><Text style={s.link}>{showPassword ? 'Hide password' : 'Show password'}</Text></Pressable> : null}
        {errors[field.key] ? <Text style={s.error}>{errors[field.key]}</Text> : null}
      </View>)}
      <Text style={s.label}>Status *</Text><View style={s.options}>{statuses(kind).map(status => <Pressable key={status} accessibilityRole="radio" accessibilityState={{ checked: form.status === status }} disabled={busy} onPress={() => change('status', status)} style={[s.option, form.status === status && s.selected]}><Text style={s.link}>{status.replaceAll('_', ' ')}</Text></Pressable>)}</View>
      {errors.status ? <Text style={s.error}>{errors.status}</Text> : null}
      <Pressable onPress={() => void save()} disabled={busy} accessibilityRole="button" accessibilityState={{ busy, disabled: busy }} style={[s.primary, busy && s.disabled]}>{busy ? <ActivityIndicator color="#FFFFFF" /> : <Text style={s.primaryText}>Save changes</Text>}</Pressable>
      <Pressable onPress={onClose} disabled={busy} accessibilityRole="button" style={s.action}><Text style={s.link}>Cancel</Text></Pressable>
    </ScrollView>
  </KeyboardAvoidingView></SafeAreaView>;
}
const s = StyleSheet.create({
  flex: { flex: 1 }, screen: { flex: 1, backgroundColor: '#F6F7F2' }, header: { padding: 20, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: 1, borderColor: '#DFE5D8' }, title: { fontSize: 25, fontWeight: '800', color: '#173E2D' },
  content: { padding: 20, paddingBottom: 40, width: '100%', maxWidth: 560, alignSelf: 'center' }, hint: { color: '#69766B', lineHeight: 22, marginBottom: 20 }, field: { marginBottom: 18 }, label: { color: '#243A2B', fontWeight: '600', marginBottom: 8 }, input: { minHeight: 52, borderWidth: 1, borderColor: '#CBD7C5', borderRadius: 12, backgroundColor: '#FFFFFF', padding: 14, fontSize: 16, color: '#1D3527' }, multiline: { minHeight: 100, textAlignVertical: 'top' }, invalid: { borderColor: '#B43E35' },
  error: { color: '#A52F27', marginTop: 6, lineHeight: 21 }, errorBox: { color: '#A52F27', backgroundColor: '#FCEDE8', padding: 14, borderRadius: 12, marginBottom: 20, lineHeight: 22 }, link: { color: '#276445', fontWeight: '600' }, action: { minHeight: 48, padding: 12, alignItems: 'center', justifyContent: 'center' }, options: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 }, option: { padding: 14, minHeight: 48, borderWidth: 1, borderColor: '#CBD7C5', borderRadius: 12, backgroundColor: '#FFFFFF' }, selected: { backgroundColor: '#E6F0D3', borderColor: '#276445' }, primary: { marginTop: 24, padding: 16, minHeight: 54, borderRadius: 14, backgroundColor: '#17664A', alignItems: 'center' }, primaryText: { color: '#FFFFFF', fontWeight: '700', fontSize: 16 }, disabled: { opacity: 0.5 },
});

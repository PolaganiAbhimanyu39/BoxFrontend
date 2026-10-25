import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useSession } from '@/context/session';
import { ApiError, apiRequest } from '@/services/api';
import { recordId, recordName, validRecord, type Kind, type ManagedRecord } from '@/features/management/form';
import RecordEditor from '@/features/management/components/record-editor';
import CreateUser from '@/features/users/components/create-user';
import CreateVenue from '@/features/venues/components/create-venue';

export default function ManageRecords({ kind, onClose, onChanged, onBusyChange }: { kind: Kind; onClose: () => void; onChanged: () => void; onBusyChange: (busy: boolean) => void }) {
  const { session } = useSession();
  const [records, setRecords] = useState<ManagedRecord[]>([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [attempt, setAttempt] = useState(0);
  const [editing, setEditing] = useState<ManagedRecord | null>(null);
  const [creating, setCreating] = useState(false);
  const [createBusy, setCreateBusy] = useState(false);
  const [deleting, setDeleting] = useState<ManagedRecord | null>(null);
  const [busy, setBusy] = useState(false);
  const [editorBusy, setEditorBusy] = useState(false);
  const [deleteError, setDeleteError] = useState('');
  const pending = useRef(false);
  const alive = useRef(true);
  const mutation = useRef<AbortController | null>(null);
  const isAdmin = session?.user.role === 'APP_OWNER';
  useEffect(() => { alive.current = true; return () => { alive.current = false; mutation.current?.abort(); }; }, []);
  useEffect(() => {
    const controller = new AbortController(); let active = true;
    if (!isAdmin) return;
    async function load() {
      try {
        const data = await apiRequest(kind === 'venues' ? '/api/venues' : '/api/users/all', { signal: controller.signal, headers: { Authorization: `Bearer ${session?.token}` } });
        if (!Array.isArray(data) || !data.every(record => validRecord(kind, record))) throw new ApiError(`Could not read the ${kind} list.`);
        if (active) setRecords(data);
      } catch (err) { if (active) setError(err instanceof Error ? err.message : 'Unable to load records.'); }
      finally { if (active) setLoading(false); }
    }
    void load(); return () => { active = false; controller.abort(); };
  }, [attempt, kind, isAdmin, session?.token]);
  function reload() { setLoading(true); setError(''); setRecords([]); setAttempt(value => value + 1); }
  function changed(text: string) { setMessage(text); onChanged(); reload(); }
  async function openEditor(record: ManagedRecord) {
    if (pending.current || !isAdmin) return;
    pending.current = true; setBusy(true); onBusyChange(true); setError(''); setMessage('');
    const controller = new AbortController(); mutation.current = controller;
    try {
      const data = await apiRequest(`/api/${kind}/${recordId(kind, record)}`, { signal: controller.signal, headers: { Authorization: `Bearer ${session?.token}` } });
      if (!validRecord(kind, data) || recordId(kind, data) !== recordId(kind, record)) throw new ApiError('Could not read the record. Reload and try again.');
      if (alive.current) setEditing(data);
    } catch (err) { if (alive.current) setError(err instanceof Error ? err.message : 'Unable to open record.'); }
    finally { pending.current = false; onBusyChange(false); if (alive.current) setBusy(false); }
  }
  async function remove() {
    if (!deleting || pending.current || !isAdmin) return;
    pending.current = true; setBusy(true); onBusyChange(true); setDeleteError('');
    const controller = new AbortController(); mutation.current = controller;
    try {
      await apiRequest(`/api/${kind}/${recordId(kind, deleting)}`, { method: 'DELETE', signal: controller.signal, headers: { Authorization: `Bearer ${session?.token}` } });
      if (alive.current) { setDeleting(null); changed(`${recordName(kind, deleting)} has been deleted.`); }
    } catch (err) { if (alive.current) setDeleteError((err instanceof Error ? err.message : 'Unable to delete record.') + ' If the request was interrupted, cancel and reload the list before trying again.'); }
    finally { pending.current = false; onBusyChange(false); if (alive.current) setBusy(false); }
  }
  if (!isAdmin) return <SafeAreaView><Text>App owner access required.</Text></SafeAreaView>;
  const filtered = records.filter(record => [recordName(kind, record), record.phone, record.email, record.city, record.locality, record.role, record.status].filter(Boolean).join(' ').toLowerCase().includes(query.trim().toLowerCase()));
  return <SafeAreaView style={s.screen}>
    <View style={s.header}><Pressable onPress={onClose} disabled={busy || editorBusy || createBusy} accessibilityRole="button" style={s.action}><Text style={s.link}>Back</Text></Pressable><Text style={s.title}>{kind === 'users' ? 'Users' : 'Venues'}</Text><Pressable disabled={busy || editorBusy || createBusy} onPress={() => setCreating(true)} accessibilityRole="button" style={s.addButton}><Text style={s.white}>+ Add {kind === 'users' ? 'user' : 'venue'}</Text></Pressable></View>
    <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={s.content}>
      <Text style={s.hint}>{kind === 'venues' ? 'Edit venue details and status, or remove a venue from listings.' : 'Manage app owners, venue owners and player accounts.'}</Text>
      <TextInput value={query} onChangeText={setQuery} placeholder={kind === 'venues' ? 'Search name, city or status' : 'Search name, phone, email or role'} accessibilityLabel={`Search ${kind}`} style={s.input} />
      {message ? <Text accessibilityRole="alert" style={s.success}>{message}</Text> : null}
      {error ? <Text accessibilityRole="alert" style={s.error}>{error}</Text> : null}
      <Pressable disabled={busy || loading} onPress={reload} accessibilityRole="button" style={s.action}><Text style={s.link}>Refresh list</Text></Pressable>
      {busy && !deleting ? <ActivityIndicator color="#17664A" accessibilityLabel="Loading record" /> : null}
      {loading ? <ActivityIndicator color="#17664A" accessibilityLabel={`Loading ${kind}`} /> : error ? <Text style={s.hint}>Refresh the list to try again.</Text> : filtered.length === 0 ? <Text style={s.hint}>{query ? 'No matching records.' : `No ${kind} found.`}</Text> : filtered.map(record => {
        const self = kind === 'users' && recordId(kind, record) === session?.user.userId;
        return <View key={recordId(kind, record)} style={s.card}>
          <Text style={s.name}>{recordName(kind, record)}{self ? ' (you)' : ''}</Text>
          <Text style={s.hint}>{[kind === 'users' ? String(record.role).replaceAll('_', ' ') : record.city, record.status, record.phone, record.email].filter(Boolean).join(' · ')}</Text>
          <View style={s.row}><Pressable disabled={busy} onPress={() => void openEditor(record)} accessibilityRole="button" accessibilityLabel={`Edit ${recordName(kind, record)}`} style={s.action}><Text style={s.link}>Edit</Text></Pressable>
            <Pressable disabled={busy || self} onPress={() => { setDeleteError(''); setDeleting(record); }} accessibilityRole="button" accessibilityLabel={`Delete ${recordName(kind, record)}`} accessibilityState={{ disabled: busy || self }} style={s.action}><Text style={[s.danger, self && s.disabled]}>Delete</Text></Pressable></View>
          {self ? <Text style={s.hint}>Your signed-in account cannot be deleted here.</Text> : null}
        </View>;
      })}
    </ScrollView>
    <Modal visible={creating} animationType="slide" presentationStyle="fullScreen" onRequestClose={() => { if (!createBusy) setCreating(false); }}>
      {creating ? kind === 'users' ? <CreateUser onClose={() => setCreating(false)} onBusyChange={setCreateBusy} onCreated={user => { setCreating(false); changed(`${user.fullName} has been created.`); }} /> : <CreateVenue onClose={() => setCreating(false)} onBusyChange={setCreateBusy} onCreated={name => { setCreating(false); changed(`${name} has been created.`); }} /> : null}
    </Modal>
    <Modal visible={!!editing} animationType="slide" presentationStyle="fullScreen" onRequestClose={() => { if (!editorBusy) setEditing(null); }}>
      {editing ? <RecordEditor kind={kind} record={editing} onClose={() => setEditing(null)} onBusyChange={value => { setEditorBusy(value); onBusyChange(value); }} onSaved={() => { setEditing(null); changed('Changes saved.'); }} /> : null}
    </Modal>
    <Modal visible={!!deleting} transparent animationType="fade" onRequestClose={() => { if (!busy) setDeleting(null); }}>
      <View style={s.backdrop}><View style={s.dialog} accessibilityViewIsModal>
        <Text style={s.title}>Delete {kind === 'venues' ? 'venue' : 'user'}?</Text>
        <Text style={s.hint}>{deleting ? recordName(kind, deleting) : ''} will be removed from {kind === 'venues' ? 'venue listings' : 'active user accounts'}. {kind === 'users' ? 'The user will no longer be able to sign in.' : 'This venue will no longer be available to players.'}</Text>
        {deleteError ? <Text accessibilityRole="alert" style={s.error}>{deleteError}</Text> : null}
        <Pressable disabled={busy} onPress={() => void remove()} accessibilityRole="button" accessibilityState={{ busy, disabled: busy }} style={[s.deleteButton, busy && s.disabled]}>{busy ? <ActivityIndicator color="#FFFFFF" /> : <Text style={s.white}>Delete {kind === 'venues' ? 'venue' : 'user'}</Text>}</Pressable>
        <Pressable disabled={busy} onPress={() => setDeleting(null)} accessibilityRole="button" style={s.action}><Text style={s.link}>Cancel</Text></Pressable>
      </View></View>
    </Modal>
  </SafeAreaView>;
}
const s = StyleSheet.create({
  addButton: { backgroundColor: '#17664A', minHeight: 48, padding: 14, borderRadius: 12, justifyContent: 'center' },
  screen: { flex: 1, backgroundColor: '#F6F7F2' }, header: { padding: 20, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, borderBottomWidth: 1, borderColor: '#DFE5D8' }, title: { color: '#173E2D', fontSize: 24, fontWeight: '800', flexShrink: 1 }, content: { padding: 20, paddingBottom: 40, width: '100%', maxWidth: 760, alignSelf: 'center' }, hint: { color: '#69766B', lineHeight: 22, marginVertical: 8 }, input: { minHeight: 52, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#CBD7C5', borderRadius: 12, padding: 14, color: '#1D3527', fontSize: 16 }, card: { padding: 18, borderWidth: 1, borderColor: '#DFE5D8', backgroundColor: '#FFFFFF', borderRadius: 16, marginBottom: 14 }, name: { color: '#173E2D', fontSize: 18, fontWeight: '700' }, row: { flexDirection: 'row', gap: 16, flexWrap: 'wrap' }, action: { minHeight: 48, padding: 12, alignItems: 'center', justifyContent: 'center' }, link: { color: '#276445', fontWeight: '600' }, danger: { color: '#A52F27', fontWeight: '600' }, error: { color: '#A52F27', backgroundColor: '#FCEDE8', padding: 14, borderRadius: 12, lineHeight: 22, marginVertical: 12 }, success: { color: '#234E36', backgroundColor: '#E6F0D3', padding: 14, borderRadius: 12, marginTop: 12 }, backdrop: { flex: 1, backgroundColor: '#10271ECC', padding: 24, justifyContent: 'center', alignItems: 'center' }, dialog: { backgroundColor: '#F6F7F2', padding: 24, borderRadius: 20, width: '100%', maxWidth: 460 }, deleteButton: { backgroundColor: '#A52F27', padding: 16, borderRadius: 12, minHeight: 52, alignItems: 'center', marginTop: 12 }, white: { color: '#FFFFFF', fontWeight: '700' }, disabled: { opacity: 0.5 },
});

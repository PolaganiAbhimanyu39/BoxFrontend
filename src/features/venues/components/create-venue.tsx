import { useEffect, useRef, useState, type ComponentRef } from 'react';
import { ActivityIndicator, Modal, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View, type TextInputProps } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ApiError, apiRequest } from '@/services/api';
import CreateUser from '@/features/users/components/create-user';

type Choice = { id: number; name: string; active: boolean };
type Owner = { userId: number; fullName: string; phone: string; status: string; role: string };
const initial = { name: '', description: '', phone: '', email: '', addressLine1: '', addressLine2: '', locality: '', city: '', state: '', postalCode: '', latitude: '', longitude: '', locationUrl: '', timezone: 'Asia/Kolkata' };
type Field = keyof typeof initial;
const fields: { key: Field; label: string; max?: number; optional?: boolean; keyboard?: TextInputProps['keyboardType']; multiline?: boolean }[] = [
  { key: 'name', label: 'Venue name', max: 150 },
  { key: 'description', label: 'Description', optional: true, multiline: true },
  { key: 'phone', label: 'Contact number', max: 20, keyboard: 'phone-pad' },
  { key: 'email', label: 'Contact email', max: 255, optional: true, keyboard: 'email-address' },
  { key: 'addressLine1', label: 'Address', max: 200 },
  { key: 'addressLine2', label: 'Landmark / address line 2', max: 200, optional: true },
  { key: 'locality', label: 'Area / locality', max: 100 },
  { key: 'city', label: 'City', max: 100 },
  { key: 'state', label: 'State', max: 100 },
  { key: 'postalCode', label: 'Postal code', max: 10 },
  { key: 'latitude', label: 'Latitude', keyboard: 'numbers-and-punctuation' },
  { key: 'longitude', label: 'Longitude', keyboard: 'numbers-and-punctuation' },
  { key: 'locationUrl', label: 'Location URL', optional: true, keyboard: 'url' },
  { key: 'timezone', label: 'Timezone', max: 50 },
];
function isChoices(value: unknown): value is Choice[] {
  return Array.isArray(value) && value.every(item => item && Number.isSafeInteger(item.id) && item.id > 0 && typeof item.name === 'string' && typeof item.active === 'boolean');
}
function isOwners(value: unknown): value is Owner[] {
  return Array.isArray(value) && value.every(item => item && Number.isSafeInteger(item.userId) && item.userId > 0 && typeof item.fullName === 'string' && typeof item.phone === 'string' && typeof item.status === 'string' && typeof item.role === 'string');
}

export default function CreateVenue({ onClose, onCreated, onBusyChange }: { onClose: () => void; onCreated: (name: string) => void; onBusyChange: (busy: boolean) => void }) {
  const [form, setForm] = useState(initial);
  const [creatingOwner, setCreatingOwner] = useState(false);
  const [ownerBusy, setOwnerBusy] = useState(false);
  const [owners, setOwners] = useState<Owner[]>([]);
  const [sports, setSports] = useState<Choice[]>([]);
  const [amenities, setAmenities] = useState<Choice[]>([]);
  const [ownerId, setOwnerId] = useState<number | null>(null);
  const [sportIds, setSportIds] = useState<number[]>([]);
  const [amenityIds, setAmenityIds] = useState<number[]>([]);
  const [ownerQuery, setOwnerQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [error, setError] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const submitting = useRef(false);
  const alive = useRef(true);
  const submission = useRef<AbortController | null>(null);
  const scroll = useRef<ComponentRef<typeof ScrollView>>(null);
  useEffect(() => {
    alive.current = true;
    return () => { alive.current = false; submission.current?.abort(); };
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    async function load() {
      try {
        const [users, sportList, amenityList] = await Promise.all([
          apiRequest('/api/users/all', { signal: controller.signal }),
          apiRequest('/api/venues/sports', { signal: controller.signal }),
          apiRequest('/api/amenities', { signal: controller.signal }),
        ]);
        if (!isOwners(users) || !isChoices(sportList) || !isChoices(amenityList)) throw new ApiError('The selection lists could not be read. Please retry.');
        if (active) {
          const availableOwners = users.filter(user => user.status === 'active' && user.role === 'VENUE_OWNER');
          const availableSports = sportList.filter(sport => sport.active);
          const availableAmenities = amenityList.filter(amenity => amenity.active);
          setOwners(availableOwners); setSports(availableSports); setAmenities(availableAmenities);
          setOwnerId(current => availableOwners.some(user => user.userId === current) ? current : null);
          setSportIds(current => current.filter(id => availableSports.some(sport => sport.id === id)));
          setAmenityIds(current => current.filter(id => availableAmenities.some(amenity => amenity.id === id)));
        }
      } catch (err) { if (active) setLoadError(err instanceof Error ? err.message : 'Unable to load selections.'); }
      finally { if (active) setLoading(false); }
    }
    void load();
    return () => { active = false; controller.abort(); };
  }, [attempt]);
  function reloadSelections() { setLoading(true); setLoadError(''); setAttempt(value => value + 1); }
  function update(key: Field, value: string) {
    setForm(current => ({ ...current, [key]: value }));
    setErrors(current => ({ ...current, [key]: '' })); setError('');
  }
  function toggle(ids: number[], id: number) { return ids.includes(id) ? ids.filter(value => value !== id) : [...ids, id]; }
  async function submit() {
    if (submitting.current || loading || loadError) return;
    const invalid: Record<string, string> = {};
    fields.forEach(field => { if (!field.optional && !form[field.key].trim()) invalid[field.key] = 'This field is required.'; });
    for (const [key, min, max] of [['latitude', -90, 90], ['longitude', -180, 180]] as const) {
      const value = form[key].trim();
      if (!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(value) || !Number.isFinite(Number(value)) || Number(value) < min || Number(value) > max) invalid[key] = `Enter a number from ${min} to ${max}.`;
    }
    if (form.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) invalid.email = 'Enter a valid email address.';
    if (form.locationUrl.trim()) {
      try {
        const url = new URL(form.locationUrl.trim());
        if (url.protocol !== 'https:' || !url.hostname || /\s/.test(form.locationUrl.trim())) throw new Error('Invalid URL');
      } catch { invalid.locationUrl = 'Enter a valid HTTPS location URL.'; }
    }
    if (!ownerId) invalid.ownerUserId = 'Select the venue owner.';
    if (!sportIds.length) invalid.sportTypeIds = 'Select at least one sport.';
    setErrors(invalid);
    if (Object.keys(invalid).length) { setError('Check the highlighted fields below.'); scroll.current?.scrollTo({ y: 0, animated: true }); return; }
    submitting.current = true; setSaving(true); onBusyChange(true); setError('');
    const controller = new AbortController(); submission.current = controller;
    try {
      const payload = { ...Object.fromEntries(Object.entries(form).map(([key, value]) => [key, value.trim()])), latitude: Number(form.latitude), longitude: Number(form.longitude), ownerUserId: ownerId, sportTypeIds: sportIds, amenityIds };
      const result = await apiRequest('/api/venues', { method: 'POST', body: JSON.stringify(payload), signal: controller.signal });
      if (!result || typeof result !== 'object' || !('id' in result) || !Number.isSafeInteger(result.id)) throw new ApiError('Could not confirm creation. Check the grounds list before submitting again.');
      if (alive.current) onCreated(form.name.trim());
    } catch (err) {
      if (alive.current) {
        const message = err instanceof Error ? err.message : 'Unable to create the venue.';
        setError(message + (err instanceof ApiError && /timed out|reach the server|unreadable/.test(message) ? ' Check the grounds list before retrying; the venue may already have been saved.' : ''));
        if (err instanceof ApiError) setErrors(err.fields);
        scroll.current?.scrollTo({ y: 0, animated: true });
      }
    } finally { submitting.current = false; onBusyChange(false); if (alive.current) setSaving(false); }
  }
  const visibleOwners = owners.filter(owner => `${owner.fullName} ${owner.phone}`.toLowerCase().includes(ownerQuery.toLowerCase().trim()));
  return (
    <SafeAreaView style={s.screen}>
      <KeyboardAvoidingView style={s.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={s.header}><View><Text style={s.eyebrow}>VENUE SETUP</Text><Text style={s.title}>Add a venue</Text></View><Pressable disabled={saving} onPress={onClose} accessibilityRole="button" accessibilityLabel="Close venue form" style={s.close}><Text style={s.closeText}>Close</Text></Pressable></View>
        <ScrollView ref={scroll} contentContainerStyle={s.content} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag">
          <Text style={s.intro}>Add the ground, assign its owner, and choose the sports your players can enjoy.</Text>
          {error ? <Text accessibilityRole="alert" accessibilityLiveRegion="polite" style={s.errorBox}>{error}</Text> : null}
          {fields.map((field, index) => <View key={field.key} style={s.field}>
            {index === 0 ? <Text style={s.section}>Venue details</Text> : index === 4 ? <Text style={s.section}>Where is the venue?</Text> : index === 10 ? <><Text style={s.section}>Ground coordinates</Text><Text style={s.hint}>Enter the venue coordinates from your map listing. Latitude first, then longitude.</Text></> : null}
            <Text style={s.label}>{field.label}{field.optional ? ' (optional)' : ' *'}</Text>
            <TextInput accessibilityLabel={`${field.label}${field.optional ? ', optional' : ', required'}`} editable={!saving} value={form[field.key]} onChangeText={value => update(field.key, value)} maxLength={field.max} keyboardType={field.keyboard} multiline={field.multiline} autoCapitalize={['email', 'timezone', 'latitude', 'longitude', 'locationUrl'].includes(field.key) ? 'none' : 'sentences'} autoCorrect={!['email', 'timezone', 'latitude', 'longitude', 'locationUrl'].includes(field.key)} placeholderTextColor="#7B8580" placeholder={field.key === 'locationUrl' ? 'https://maps.app.goo.gl/...' : field.key === 'latitude' ? '-90 to 90' : field.key === 'longitude' ? '-180 to 180' : undefined} style={[s.input, field.multiline && s.textarea, !!errors[field.key] && s.invalid]} />
            {field.key === 'locationUrl' ? <Text style={s.hint}>Paste the venue’s HTTPS map link. Coordinates above are still required.</Text> : null}
            {errors[field.key] ? <Text style={s.errorText}>{errors[field.key]}</Text> : null}
          </View>)}
          <View style={s.sectionBlock}><Text style={s.section}>Owner, sports & facilities</Text>
            {loading ? <View style={s.state}><ActivityIndicator color="#17664A" /><Text style={s.hint}>Loading available selections...</Text></View> : loadError ? <View style={s.state}><Text style={s.errorText} accessibilityRole="alert">{loadError}</Text><Pressable style={s.secondary} onPress={reloadSelections} accessibilityRole="button"><Text style={s.secondaryText}>Retry selections</Text></Pressable></View> : <>
              <Text style={s.label}>Assign venue owner *</Text><Text style={s.hint}>Select the existing owner who will manage this venue.</Text>
              <TextInput accessibilityLabel="Search venue owners" style={s.input} value={ownerQuery} onChangeText={setOwnerQuery} placeholder="Search by name or phone" placeholderTextColor="#7B8580" editable={!saving} />
              <ScrollView style={s.ownerList} nestedScrollEnabled keyboardShouldPersistTaps="handled">
                {visibleOwners.map(owner => <Pressable key={owner.userId} disabled={saving} accessibilityRole="radio" accessibilityState={{ checked: ownerId === owner.userId }} onPress={() => { setOwnerId(owner.userId); setErrors(value => ({ ...value, ownerUserId: '' })); }} style={[s.owner, ownerId === owner.userId && s.selected]}><View style={s.flex}><Text style={s.optionText}>{owner.fullName}</Text><Text style={s.hint}>{owner.phone}</Text></View><Text style={s.check}>{ownerId === owner.userId ? '●' : '○'}</Text></Pressable>)}
              </ScrollView>
              {!visibleOwners.length ? <Text style={s.hint}>{owners.length ? 'No owners match your search.' : 'No active venue owners are available. Create a venue owner account using the button below.'}</Text> : null}
              {errors.ownerUserId ? <Text style={s.errorText}>{errors.ownerUserId}</Text> : null}
              <Text style={[s.label, s.space]}>Sports offered *</Text><Text style={s.hint}>Select one or more sports.</Text>
              <View style={s.choices}>{sports.map(sport => <Pressable key={sport.id} disabled={saving} accessibilityRole="checkbox" accessibilityState={{ checked: sportIds.includes(sport.id) }} onPress={() => { setSportIds(toggle(sportIds, sport.id)); setErrors(value => ({ ...value, sportTypeIds: '' })); }} style={[s.chip, sportIds.includes(sport.id) && s.selected]}><Text style={s.optionText}>{sportIds.includes(sport.id) ? '✓ ' : '+ '}{sport.name}</Text></Pressable>)}</View>
              {!sports.length ? <Text style={s.hint}>No active sports are available. Add sports to the catalogue and reload selections.</Text> : null}
              {errors.sportTypeIds ? <Text style={s.errorText}>{errors.sportTypeIds}</Text> : null}
              <Text style={[s.label, s.space]}>Amenities (optional)</Text><Text style={s.hint}>Facilities such as parking, washrooms, and floodlights.</Text>
              <View style={s.choices}>{amenities.map(amenity => <Pressable key={amenity.id} disabled={saving} accessibilityRole="checkbox" accessibilityState={{ checked: amenityIds.includes(amenity.id) }} onPress={() => setAmenityIds(toggle(amenityIds, amenity.id))} style={[s.chip, amenityIds.includes(amenity.id) && s.selected]}><Text style={s.optionText}>{amenityIds.includes(amenity.id) ? '✓ ' : '+ '}{amenity.name}</Text></Pressable>)}</View>
              {!amenities.length ? <Text style={s.hint}>No amenities listed yet. You can create the venue without them.</Text> : null}
              {errors.amenityIds ? <Text style={s.errorText}>{errors.amenityIds}</Text> : null}
              <Pressable disabled={saving} style={s.secondary} onPress={reloadSelections} accessibilityRole="button"><Text style={s.secondaryText}>Reload selections</Text></Pressable>
            </>}
          </View>
          <Pressable disabled={saving} style={s.secondary} accessibilityRole="button" onPress={() => setCreatingOwner(true)}><Text style={s.secondaryText}>+ Create venue owner</Text></Pressable>
          <View style={s.publish}><Text style={s.publishTitle}>Ready for players</Text><Text style={s.hint}>Your venue will be active and visible in the grounds list as soon as it is created.</Text></View>
          <Pressable disabled={saving || loading || !!loadError || !owners.length || !sports.length} accessibilityRole="button" accessibilityState={{ disabled: saving || loading || !!loadError || !owners.length || !sports.length, busy: saving }} onPress={() => void submit()} style={({ pressed }) => [s.submit, (saving || loading || !!loadError || !owners.length || !sports.length) && s.disabled, pressed && s.pressed]}>{saving ? <ActivityIndicator color="#FFFFFF" /> : <Text style={s.submitText}>Create venue</Text>}</Pressable>
          <Pressable disabled={saving} onPress={onClose} style={s.cancel} accessibilityRole="button"><Text style={s.secondaryText}>Cancel</Text></Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
      <Modal visible={creatingOwner} animationType="slide" presentationStyle="fullScreen" onRequestClose={() => { if (!ownerBusy) setCreatingOwner(false); }}>
        {creatingOwner ? <CreateUser mode="owner" onBusyChange={setOwnerBusy} onClose={() => setCreatingOwner(false)} onCreated={user => { setCreatingOwner(false); setOwnerQuery(''); setOwnerId(user.userId); reloadSelections(); }} /> : null}
      </Modal>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  flex: { flex: 1 }, screen: { flex: 1, backgroundColor: '#F6F7F2' },
  header: { paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: 1, borderColor: '#DFE5D8', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  eyebrow: { color: '#50725B', fontSize: 10, letterSpacing: 1.5, fontWeight: '700' }, title: { color: '#173E2D', fontSize: 25, fontWeight: '800', marginTop: 4 },
  close: { minWidth: 48, minHeight: 48, alignItems: 'center', justifyContent: 'center' }, closeText: { color: '#276445', fontWeight: '600' },
  content: { padding: 20, paddingBottom: 36, maxWidth: 480, width: '100%', alignSelf: 'center' }, intro: { fontSize: 15, lineHeight: 23, color: '#69766B', marginBottom: 20 },
  section: { fontSize: 19, fontWeight: '700', color: '#173E2D', marginTop: 12, marginBottom: 12 }, field: { marginBottom: 16 },
  label: { fontSize: 14, fontWeight: '600', color: '#243A2B', marginBottom: 8 }, input: { minHeight: 50, borderWidth: 1, borderColor: '#CBD7C5', borderRadius: 12, backgroundColor: '#FFFFFF', paddingHorizontal: 14, paddingVertical: 13, fontSize: 16, color: '#1D3527', width: '100%' },
  textarea: { minHeight: 96, textAlignVertical: 'top' }, hint: { fontSize: 13, lineHeight: 20, color: '#69766B', marginBottom: 8 },
  invalid: { borderColor: '#B43E35' }, errorText: { color: '#A52F27', fontSize: 13, marginTop: 6, lineHeight: 20 }, errorBox: { color: '#A52F27', backgroundColor: '#FCEDE8', padding: 14, borderRadius: 12, marginBottom: 16, lineHeight: 22 },
  sectionBlock: { paddingTop: 4, paddingBottom: 20 }, state: { paddingVertical: 20, gap: 10 }, ownerList: { maxHeight: 240, marginTop: 12 },
  owner: { minHeight: 64, borderWidth: 1, borderColor: '#D7DFD1', borderRadius: 12, backgroundColor: '#FFFFFF', padding: 14, marginBottom: 8, flexDirection: 'row', alignItems: 'center', gap: 12 },
  selected: { backgroundColor: '#E6F0D3', borderColor: '#276445', borderWidth: 2 }, optionText: { color: '#234E36', fontSize: 14, fontWeight: '600', flexShrink: 1 }, check: { color: '#276445', fontSize: 22 },
  choices: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 }, chip: { minHeight: 48, justifyContent: 'center', maxWidth: '100%', borderWidth: 1, borderColor: '#CBD7C5', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, backgroundColor: '#FFFFFF' },
  space: { marginTop: 24 }, secondary: { alignSelf: 'flex-start', paddingVertical: 14, paddingHorizontal: 10, minHeight: 48 }, secondaryText: { color: '#276445', fontWeight: '600', fontSize: 14 },
  publish: { padding: 16, borderRadius: 14, backgroundColor: '#E7EEDC', marginBottom: 20 }, publishTitle: { color: '#234E36', fontSize: 15, fontWeight: '700', marginBottom: 4 },
  submit: { minHeight: 54, borderRadius: 14, backgroundColor: '#17664A', alignItems: 'center', justifyContent: 'center', padding: 16 }, submitText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' }, disabled: { opacity: 0.5 }, pressed: { opacity: 0.8 }, cancel: { minHeight: 50, alignItems: 'center', justifyContent: 'center', marginTop: 8 },
});

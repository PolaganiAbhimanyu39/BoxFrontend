import { useCallback, useEffect, useRef, useState, type ComponentRef } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useSession } from '@/context/session';
import { API_URL } from '@/services/api';
import { router, useFocusEffect } from 'expo-router';
import { useIsFocused } from 'expo-router';
import { useNearbyGrounds } from '@/features/venues/use-nearby-grounds';
import { currentLocation, saveLocation } from '@/features/venues/location';
import { ExternalLink } from '@/components/external-link';




type Venue = {
  id: number;
  name: string;
  description: string | null;
  city: string;
  locality: string | null;
  addressLine1: string;
  addressLine2: string | null;
  state: string;
  postalCode: string;
  phone: string | null;
  locationUrl?: string | null;
};

export default function DashboardScreen() {
  const { session, signOut, dismissLocationIntro } = useSession();
  const isPlayer = session?.user.role === 'PLAYER';
  const focused = useIsFocused();
  const nearby = useNearbyGrounds(isPlayer ? session?.token : undefined, focused);
  const [manual, setManual] = useState(false);
  const [areaQuery, setAreaQuery] = useState('');
  const [selectedArea, setSelectedArea] = useState('');
  const [introBusy, setIntroBusy] = useState(false);
  const [introError, setIntroError] = useState('');
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  async function setupLocation() {
    if (introBusy || !session) return;
    setIntroBusy(true); setIntroError('');
    try {
      const fix = await currentLocation(true);
      if (!mounted.current) return;
      await saveLocation(session.token, fix);
      if (mounted.current) dismissLocationIntro();
    } catch (err) { if (mounted.current) setIntroError(err instanceof Error ? err.message : 'Choose an area manually.'); }
    finally { if (mounted.current) setIntroBusy(false); }
  }
  const isAppOwner = session?.user.role === 'APP_OWNER';
  const { width } = useWindowDimensions();
  const wide = width >= 760;
  const scroll = useRef<ComponentRef<typeof ScrollView>>(null);
  const venuesY = useRef(0);
  const [venues, setVenues] = useState<Venue[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [attempt, setAttempt] = useState(0);
  const [selected, setSelected] = useState<Venue | null>(null);
  const locationUrl = selected?.locationUrl?.trim();
  const mapUrl = locationUrl?.startsWith('https://') ? locationUrl as `https://${string}` : null;

  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    const timeout = setTimeout(() => controller.abort(), 15000);
    async function load() {
      try {
        const response = await fetch(API_URL + '/api/venues?status=active', {
          headers: { Accept: 'application/json', Authorization: 'Bearer ' + session?.token },
          signal: controller.signal,
        });
        if (!response.ok) throw new Error('Unable to load grounds right now.');
        const data: unknown = await response.json();
        if (!Array.isArray(data) || !data.every(item => item && typeof item.id === 'number' && typeof item.name === 'string' && typeof item.city === 'string')) {
          throw new Error('Unable to read the grounds list.');
        }
        if (active) setVenues(data);
      } catch (err) {
        if (active) setError(controller.signal.aborted ? 'The connection took too long. Please try again.' : err instanceof Error ? err.message : 'Check your connection and try again.');
      } finally {
        clearTimeout(timeout);
        if (active) setLoading(false);
      }
    }
    void load();
    return () => { active = false; clearTimeout(timeout); controller.abort(); };
  }, [session?.token, attempt]);

  useFocusEffect(useCallback(() => { setLoading(true); setError(''); setAttempt(value => value + 1); }, []));

  const visibleVenues = nearby.enabled ? nearby.grounds : venues;
  const displayedLoading = nearby.enabled ? nearby.busy : loading;
  const displayedError = nearby.enabled ? nearby.error : error;
  const areas = [...new Set(venues.flatMap(venue => [venue.city, venue.locality].filter((value): value is string => !!value)))].sort();
  const filtered = visibleVenues.filter(venue => (!selectedArea || [venue.city, venue.locality].includes(selectedArea))).filter(venue => [venue.name, venue.city, venue.locality].filter(Boolean).join(' ').toLowerCase().includes(query.trim().toLowerCase()));
  function browse() { scroll.current?.scrollTo({ y: venuesY.current, animated: true }); }
  function retry() { if (nearby.enabled) { void nearby.enable(); } else { setLoading(true); setError(''); setAttempt(value => value + 1); } }

  return (
    <SafeAreaView style={s.screen}>
      <StatusBar style="dark" />
      <ScrollView ref={scroll} contentContainerStyle={s.page} keyboardShouldPersistTaps="handled">
        <View style={s.shell}>
          <View style={s.header}>
            <View style={s.brandRow}><View style={s.brandMark}><Text style={s.brandLetter}>B</Text></View><View><Text style={s.brand}>BOX<Text style={s.brandAccent}>.</Text></Text><Text style={s.brandSub}>MAKE TIME FOR THE GAME</Text></View></View>
            <Pressable onPress={signOut} accessibilityRole="button" style={({ pressed }) => [s.signOut, pressed && s.pressed]}><Text style={s.signOutText}>Sign out ↗</Text></Pressable>
          </View>

          {isAppOwner ? <View style={s.createRow}><Pressable onPress={() => router.push('/users')} accessibilityRole="button" style={s.addUser}><Text style={s.addUserText}>Users</Text></Pressable><Pressable onPress={() => router.push('/venues')} accessibilityRole="button" style={s.addVenue}><Text style={s.addVenueText}>Venues</Text></Pressable></View> : null}
          <View style={s.greeting}><Text style={s.eyebrow}>YOUR CRICKET STARTS HERE</Text><Text style={[s.title, wide && s.titleWide]}>Good to have you back.</Text><Text style={s.muted}>A little less scrolling. A little more cricket.</Text></View>

          <View style={[s.hero, wide && s.heroWide]}>
            <View style={s.heroCopy}>
              <View style={s.tag}><View style={s.dot} /><Text style={s.tagText}>GET BACK IN THE GAME</Text></View>
              <Text style={[s.heroTitle, wide && s.heroTitleWide]}>Your squad.{'\n'}Your next innings.</Text>
              <Text style={s.heroDescription}>Find a ground, bring your people, and make your next game happen.</Text>
              <Pressable onPress={browse} accessibilityRole="button" style={({ pressed }) => [s.primary, pressed && s.pressed]}><Text style={s.primaryText}>Find a ground  ↗</Text></Pressable>
            </View>
            <View style={[s.pitchPanel, !wide && s.pitchPanelMobile]} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
              <View style={s.field}><View style={s.fieldInner}><View style={s.pitch}><View style={s.crease} /><View style={s.pitchCenter} /><View style={s.crease} /></View></View><View style={s.ball} /></View>
              <Text style={s.fieldCaption}>THERE’S ALWAYS TIME FOR ONE MORE OVER.</Text>
            </View>
          </View>

          <View onLayout={event => { venuesY.current = event.nativeEvent.layout.y; }} style={s.venueSection}>
            <View style={[s.sectionHeading, !wide && s.sectionHeadingMobile]}><View><Text style={s.sectionTitle}>Find your next ground</Text><Text style={s.muted}>Discover active venues and get the details.</Text></View><View style={s.countBadge}><Text style={s.countText}>{displayedLoading ? 'Loading grounds…' : displayedError ? 'Grounds unavailable' : visibleVenues.length + (visibleVenues.length === 1 ? ' ground' : ' grounds')}</Text></View></View>
            <View style={s.searchRow}>
              {isPlayer ? <Pressable accessibilityRole="button" accessibilityState={{ selected: nearby.enabled, busy: nearby.busy }} disabled={nearby.busy} onPress={() => { setQuery(''); setSelectedArea(''); void nearby.enable(); }} style={[s.nearbyButton, nearby.enabled && s.nearbySelected]}><Text style={s.detailText}>{nearby.busy ? 'Locating…' : 'Nearby me'}</Text></Pressable> : null}
              <View style={[s.searchBox, s.searchInRow]}><Text style={s.searchGlyph}>⌕</Text><TextInput accessibilityLabel="Search grounds by name or city" value={query} onChangeText={setQuery} placeholder="Search by ground, area or city" placeholderTextColor="#7B8580" autoCorrect={false} style={s.searchInput} />{query ? <Pressable accessibilityRole="button" accessibilityLabel="Clear search" onPress={() => setQuery('')} style={s.clear}><Text>✕</Text></Pressable> : null}</View></View>
            {isPlayer ? <View style={s.locationOptions}>
              <Pressable accessibilityRole="button" onPress={() => { nearby.disable(); setManual(true); }} style={s.clear}><Text style={s.detailText}>Choose area manually</Text></Pressable>
              {nearby.enabled || selectedArea ? <Pressable accessibilityRole="button" onPress={() => { nearby.disable(); setSelectedArea(''); }} style={s.clear}><Text style={s.detailText}>Show all grounds</Text></Pressable> : null}
            </View> : null}
            {selectedArea ? <Text style={s.locationNote}>Browsing {selectedArea}</Text> : null}
            {nearby.enabled ? <Text style={s.locationNote}>Within a 15 km geographic radius, not driving distance. Updates while this screen is active.</Text> : null}
            {!nearby.enabled && nearby.error ? <Text accessibilityRole="alert" style={s.locationNote}>{nearby.error}</Text> : null}

            {displayedLoading ? <View style={s.stateBox}><ActivityIndicator color="#17664A" /><Text style={s.muted}>Finding your next pitch…</Text></View> : displayedError ? <View style={s.stateBox}><Text style={s.stateTitle}>Let’s try that again</Text><Text style={s.muted} accessibilityRole="alert">{displayedError}</Text><Pressable onPress={retry} accessibilityRole="button" style={s.secondary}><Text style={s.secondaryText}>Retry</Text></Pressable></View> : filtered.length === 0 ? <View style={s.stateBox}><Text style={s.emptySymbol}>⌁</Text><Text style={s.stateTitle}>{query ? 'No matching grounds' : 'The next innings is on its way'}</Text><Text style={s.stateDescription}>{query ? 'Try another ground name, area or city.' : nearby.enabled ? 'No active grounds found within 15 km. Try another area or show all grounds.' : 'Active grounds will appear here as they become available.'}</Text></View> : <View style={s.grid}>{filtered.map((venue, index) => <Pressable key={venue.id} onPress={() => setSelected(venue)} accessibilityRole="button" accessibilityLabel={'View ' + venue.name} style={({ pressed }) => [s.card, wide && s.cardWide, pressed && s.pressed]}><View style={[s.cardArt, index % 2 === 1 && s.cardArtAlt]}><Text style={s.cardNumber}>{String(index + 1).padStart(2, '0')}</Text><View style={s.activeBadge}><View style={s.dot} /><Text style={s.activeText}>ACTIVE GROUND</Text></View><View style={s.artLine} /><View style={s.artLineTwo} /></View><View style={s.cardBody}><Text style={s.city}>{venue.city.toUpperCase()}</Text><Text style={s.cardTitle}>{venue.name}</Text><Text style={s.muted} numberOfLines={2}>{[venue.locality, venue.city].filter(Boolean).join(' · ')}</Text><View style={s.cardFooter}><Text style={s.detailText}>View ground details</Text><Text style={s.arrow}>↗</Text></View></View></Pressable>)}</View>}
          </View>
          <View style={s.footer}><Text style={s.footerBrand}>BOX.</Text><Text style={s.footerText}>Good games start with good company.</Text></View>
        </View>
      </ScrollView>
      <Modal visible={!!session?.locationIntro && isPlayer} transparent animationType="fade" onRequestClose={() => { if (!introBusy) dismissLocationIntro(); }}>
        <View style={s.modalBackdrop}><View style={s.modalCard} accessibilityViewIsModal>
          <Text style={s.sectionTitle}>Find grounds near you</Text>
          <Text style={s.muted}>Allow location while using Box to discover grounds within 15 km. We save only your latest coordinates, accuracy and capture time. Nearby mode refreshes when you move; no background tracking.</Text>
          {introError ? <Text accessibilityRole="alert" style={s.muted}>{introError}</Text> : null}
          <Pressable disabled={introBusy} onPress={() => void setupLocation()} accessibilityRole="button" style={s.primary}><Text style={s.primaryText}>{introBusy ? 'Saving location…' : 'Use my location'}</Text></Pressable>
          <Pressable disabled={introBusy} onPress={() => { dismissLocationIntro(); setManual(true); }} accessibilityRole="button" style={s.secondary}><Text style={s.secondaryText}>Choose area manually</Text></Pressable>
          <Pressable disabled={introBusy} onPress={dismissLocationIntro} accessibilityRole="button" style={s.clear}><Text style={s.detailText}>Not now</Text></Pressable>
        </View></View>
      </Modal>
      <Modal visible={manual} transparent animationType="fade" onRequestClose={() => setManual(false)}>
        <View style={s.modalBackdrop}><View style={s.modalCard} accessibilityViewIsModal>
          <Text style={s.sectionTitle}>Choose city or locality</Text><Text style={s.muted}>Browse grounds by area without sharing your device location. Area search does not apply a 15 km radius.</Text>
          <TextInput accessibilityLabel="Find a city or locality" value={areaQuery} onChangeText={setAreaQuery} placeholder="Type an area" style={s.searchInput} />
          <ScrollView style={{ maxHeight: 240 }}>{areas.filter(area => area.toLowerCase().includes(areaQuery.trim().toLowerCase())).map(area => <Pressable key={area} accessibilityRole="button" onPress={() => { nearby.disable(); setSelectedArea(area); setQuery(''); setManual(false); }} style={s.clear}><Text style={s.detailText}>{area}</Text></Pressable>)}</ScrollView>
          {!areas.length ? <Text style={s.muted}>No areas loaded yet. Close and retry the grounds list.</Text> : null}
          <Pressable onPress={() => setManual(false)} accessibilityRole="button" style={s.secondary}><Text style={s.secondaryText}>Close</Text></Pressable>
        </View></View>
      </Modal>
      <Modal visible={!!selected} transparent animationType="fade" onRequestClose={() => setSelected(null)}>
        <View style={s.modalBackdrop}><View style={s.modalCard} accessibilityViewIsModal>{selected ? <><Text style={s.eyebrow}>GROUND DETAILS</Text><Text style={s.sectionTitle}>{selected.name}</Text><Text style={s.muted}>{[selected.addressLine1, selected.addressLine2, selected.locality, selected.city, selected.state, selected.postalCode].filter(Boolean).join(', ')}</Text>{selected.description ? <Text style={s.modalDescription}>{selected.description}</Text> : null}{selected.phone ? <Text selectable style={s.detailText}>Contact: {selected.phone}</Text> : null}{mapUrl ? <ExternalLink href={mapUrl} accessibilityLabel="Open ground location in maps" style={[s.detailText, { textDecorationLine: 'underline' }]}>Location: {mapUrl}</ExternalLink> : null}<Pressable accessibilityRole="button" onPress={() => setSelected(null)} style={s.primary}><Text style={s.primaryText}>Done</Text></Pressable></> : null}</View></View>
      </Modal>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  searchRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  searchInRow: { flex: 1, minWidth: 0, marginBottom: 0 },
  nearbyButton: { minHeight: 52, paddingHorizontal: 12, justifyContent: 'center', borderRadius: 14, borderWidth: 1, borderColor: '#CBD7C5', backgroundColor: '#FFFFFF' },
  nearbySelected: { backgroundColor: '#E6F0D3', borderColor: '#276445' },
  locationOptions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  locationNote: { color: '#69766B', fontSize: 12, lineHeight: 19, marginBottom: 18 },
  createRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 12, paddingTop: 20 },
  addUser: { borderWidth: 1, borderColor: '#17664A', paddingHorizontal: 18, paddingVertical: 14, borderRadius: 12, minHeight: 48, justifyContent: 'center' },
  addUserText: { color: '#17664A', fontSize: 14, fontWeight: '700' },
  addVenue: { backgroundColor: '#17664A', paddingHorizontal: 18, paddingVertical: 14, borderRadius: 12, minHeight: 48, justifyContent: 'center' },
  addVenueText: { color: '#FFFFFF', fontSize: 14, fontWeight: '700' },
  success: { color: '#234E36', backgroundColor: '#E6F0D3', padding: 14, marginTop: 16, borderRadius: 12, lineHeight: 22 },
  screen: { flex: 1, backgroundColor: '#F6F7F2' },
  page: { flexGrow: 1, paddingHorizontal: 20, paddingBottom: 24 },
  shell: { width: '100%', maxWidth: 1120, alignSelf: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 24, borderBottomWidth: 1, borderBottomColor: '#E1E5DC', gap: 12 },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  brandMark: { width: 38, height: 42, backgroundColor: '#154D39', borderRadius: 12, alignItems: 'center', justifyContent: 'center', transform: [{ rotate: '-6deg' }] },
  brandLetter: { color: '#D7F58A', fontSize: 25, fontWeight: '900' },
  brand: { fontSize: 25, fontWeight: '900', color: '#153E2F', letterSpacing: -1 },
  brandAccent: { color: '#6C9C40' },
  brandSub: { fontSize: 8, color: '#6F7B70', letterSpacing: 1.2, marginTop: 2 },
  signOut: { padding: 12, borderRadius: 24, borderWidth: 1, borderColor: '#D7DED2', backgroundColor: '#FFFFFF' },
  signOutText: { fontSize: 13, fontWeight: '600', color: '#385445' },
  greeting: { paddingTop: 34, paddingBottom: 28, gap: 10 },
  eyebrow: { fontSize: 10, fontWeight: '700', letterSpacing: 2, color: '#50725B' },
  title: { fontSize: 30, fontWeight: '800', letterSpacing: -1.3, color: '#172E23' },
  titleWide: { fontSize: 38 },
  muted: { fontSize: 14, lineHeight: 22, color: '#69766B' },
  hero: { backgroundColor: '#143E30', borderRadius: 26, overflow: 'hidden', padding: 26, gap: 20 },
  heroWide: { flexDirection: 'row', padding: 40, alignItems: 'center' },
  heroCopy: { flex: 1, gap: 18 },
  tag: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#ADD869' },
  tagText: { color: '#C6DBB7', fontSize: 9, letterSpacing: 1.6, fontWeight: '700' },
  heroTitle: { fontSize: 36, lineHeight: 42, color: '#FFFFFF', fontWeight: '800', letterSpacing: -1.4 },
  heroTitleWide: { fontSize: 48, lineHeight: 54 },
  heroDescription: { maxWidth: 340, color: '#BDCEC1', fontSize: 14, lineHeight: 23 },
  primary: { alignSelf: 'flex-start', paddingHorizontal: 22, paddingVertical: 15, borderRadius: 14, backgroundColor: '#D3F58A', marginTop: 5 },
  primaryText: { color: '#183724', fontWeight: '700', fontSize: 14 },
  pitchPanel: { flex: 1, alignItems: 'center', gap: 20, padding: 12 },
  pitchPanelMobile: { flex: undefined, paddingTop: 8 },
  field: { width: 225, height: 180, borderRadius: 110, borderWidth: 1, borderColor: '#658761', backgroundColor: '#24533A', alignItems: 'center', justifyContent: 'center', transform: [{ rotate: '-18deg' }] },
  fieldInner: { width: 165, height: 125, borderRadius: 90, borderWidth: 1, borderStyle: 'dashed', borderColor: '#73936D', alignItems: 'center', justifyContent: 'center' },
  pitch: { height: 85, width: 35, backgroundColor: '#B7BA86', padding: 8, justifyContent: 'space-between' },
  crease: { height: 1, backgroundColor: '#EFF3D7', marginHorizontal: -12 },
  pitchCenter: { height: 2, width: 16, backgroundColor: '#CED2A8', alignSelf: 'center' },
  ball: { position: 'absolute', height: 13, width: 13, borderRadius: 7, backgroundColor: '#F0906F', borderWidth: 1, borderColor: '#FDC5A6', right: 28, top: 45 },
  fieldCaption: { color: '#9EB79D', fontSize: 8, letterSpacing: 1.2, textAlign: 'center' },
  venueSection: { paddingTop: 36 },
  sectionHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 14, marginBottom: 22 },
  sectionHeadingMobile: { alignItems: 'flex-start', flexDirection: 'column' },
  sectionTitle: { color: '#1D3527', fontSize: 23, fontWeight: '700', letterSpacing: -0.6, marginBottom: 6 },
  countBadge: { backgroundColor: '#E7EDE0', borderRadius: 20, paddingVertical: 8, paddingHorizontal: 13 },
  countText: { color: '#526648', fontSize: 12, fontWeight: '600' },
  searchBox: { backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#DFE4D8', borderRadius: 14, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, marginBottom: 22, gap: 10 },
  searchGlyph: { fontSize: 28, color: '#60735E' },
  searchInput: { flex: 1, minWidth: 0, paddingVertical: 16, fontSize: 14, color: '#1D3527' },
  clear: { padding: 10 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 18 },
  card: { width: '100%', borderRadius: 20, borderWidth: 1, borderColor: '#E0E5DA', backgroundColor: '#FFFFFF', overflow: 'hidden' },
  cardWide: { width: '48%' },
  cardArt: { height: 128, backgroundColor: '#E1E9D1', padding: 18, overflow: 'hidden' },
  cardArtAlt: { backgroundColor: '#DBE9E2' },
  cardNumber: { position: 'absolute', fontSize: 110, fontWeight: '900', letterSpacing: -7, color: '#BACBA3', right: 15, top: 8 },
  activeBadge: { flexDirection: 'row', gap: 6, alignItems: 'center', alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 7, backgroundColor: '#FFFFFF', borderRadius: 20 },
  activeText: { fontSize: 8, letterSpacing: 1, fontWeight: '700', color: '#396044' },
  artLine: { width: 280, height: 160, borderWidth: 1, borderColor: '#A6BD93', borderRadius: 100, transform: [{ rotate: '-25deg' }], position: 'absolute', left: -70, top: 60 },
  artLineTwo: { width: 180, height: 100, borderWidth: 1, borderColor: '#A6BD93', borderRadius: 100, transform: [{ rotate: '-25deg' }], position: 'absolute', left: -20, top: 85 },
  cardBody: { padding: 20, gap: 8 },
  city: { fontSize: 9, color: '#6D865B', letterSpacing: 1.8, fontWeight: '700' },
  cardTitle: { fontSize: 20, fontWeight: '700', color: '#243A2B' },
  cardFooter: { marginTop: 12, paddingTop: 14, borderTopWidth: 1, borderTopColor: '#EEF0E9', flexDirection: 'row', justifyContent: 'space-between' },
  detailText: { color: '#276445', fontSize: 13, fontWeight: '600' },
  arrow: { color: '#276445', fontSize: 18 },
  stateBox: { borderWidth: 1, borderColor: '#DFE5D8', borderRadius: 20, padding: 30, backgroundColor: '#FFFFFF', alignItems: 'center', gap: 12 },
  stateTitle: { fontSize: 18, fontWeight: '700', color: '#2C4431', textAlign: 'center' },
  stateDescription: { fontSize: 14, lineHeight: 22, color: '#69766B', textAlign: 'center', maxWidth: 340 },
  emptySymbol: { fontSize: 40, color: '#7B965E' },
  secondary: { paddingVertical: 12, paddingHorizontal: 24, borderRadius: 12, backgroundColor: '#E8EEDC' },
  secondaryText: { color: '#325537', fontWeight: '700' },
  footer: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', marginTop: 36, paddingTop: 22, gap: 12, borderTopWidth: 1, borderTopColor: '#E1E5DC' },
  footerBrand: { fontWeight: '900', color: '#69805F', fontSize: 16 },
  footerText: { fontSize: 11, color: '#81907D' },
  pressed: { opacity: 0.75 },
  modalBackdrop: { flex: 1, backgroundColor: '#10271ECC', padding: 24, justifyContent: 'center', alignItems: 'center' },
  modalCard: { backgroundColor: '#F8FAF4', padding: 28, borderRadius: 24, width: '100%', maxWidth: 480, gap: 16 },
  modalDescription: { color: '#415442', fontSize: 15, lineHeight: 24 },
});

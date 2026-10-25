import { useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import * as Location from 'expo-location';
import { currentLocation, movedEnough, nearbyGrounds, toLocationFix, type Ground, type LocationFix } from './location';

export function useNearbyGrounds(token: string | undefined, focused: boolean) {
  const [enabled, setEnabled] = useState(false);
  const [grounds, setGrounds] = useState<Ground[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  const [foreground, setForeground] = useState(AppState.currentState !== 'background' && AppState.currentState !== 'inactive');
  const enabling = useRef(false);
  const generation = useRef(0);
  const alive = useRef(true);
  useEffect(() => { alive.current = true; return () => { alive.current = false; generation.current++; }; }, []);
  useEffect(() => {
    const subscription = AppState.addEventListener('change', state => setForeground(state === 'active'));
    return () => subscription.remove();
  }, []);

  async function enable() {
    if (enabling.current || !token) return;
    const id = ++generation.current;
    enabling.current = true; setBusy(true); setError('');
    try {
      // Permission prompts happen only after an explicit user action.
      let permission = await Location.getForegroundPermissionsAsync();
      if (!permission.granted && permission.canAskAgain) permission = await Location.requestForegroundPermissionsAsync();
      if (!permission.granted) throw new Error('Location access is off. Enable it in settings or choose an area manually.');
      if (alive.current && id === generation.current) { setGrounds([]); setEnabled(true); setAttempt(value => value + 1); }
    } catch (err) { if (alive.current && id === generation.current) setError(err instanceof Error ? err.message : 'Unable to access location. Choose an area manually.'); }
    finally { enabling.current = false; if (alive.current && id === generation.current) setBusy(false); }
  }

  function disable() { generation.current++; setEnabled(false); setGrounds([]); setError(''); setBusy(false); }

  useEffect(() => {
    if (!enabled || !token || !focused || !foreground) return;
    let active = true;
    let watcher: Location.LocationSubscription | undefined;
    let processing = false;
    let queued: LocationFix | undefined;
    let previous: LocationFix | undefined;
    const controller = new AbortController();
    setGrounds([]); setBusy(true); setError('');
    async function processFix(fix: LocationFix) {
      if (!active || (previous && !movedEnough(previous, fix))) return;
      if (processing) { queued = fix; return; }
      processing = true;
      if (active) setBusy(true);
      try {
        const results = await nearbyGrounds(token!, fix, controller.signal);
        if (active) { previous = fix; setGrounds(results); setError(''); }
      } catch (err) {
        if (active) { previous = undefined; setGrounds([]); setError(err instanceof Error ? err.message : 'Unable to load nearby grounds.'); }
      } finally {
        processing = false;
        if (active) setBusy(false);
        const next = queued; queued = undefined;
        if (next && active) void processFix(next);
      }
    }
    async function start() {
      try {
        const fix = await currentLocation(false);
        if (!active) return;
        await processFix(fix);
        if (!active) return;
        const subscription = await Location.watchPositionAsync(
          { accuracy: Location.Accuracy.High, distanceInterval: 250, timeInterval: 30000 },
          position => {
            if (!active) return;
            try { void processFix(toLocationFix(position)); }
            catch (err) { previous = undefined; setGrounds([]); setError(err instanceof Error ? err.message : 'Choose an area manually.'); }
          },
          () => { if (active) { previous = undefined; setGrounds([]); setError('Location updates stopped. Retry Nearby me or choose an area manually.'); } },
        );
        if (active) watcher = subscription; else subscription.remove();
      } catch (err) {
        if (active) { setGrounds([]); setError(err instanceof Error ? err.message : 'Unable to get your location. Choose an area manually.'); setBusy(false); }
      }
    }
    void start();
    return () => { active = false; controller.abort(); watcher?.remove(); };
  }, [enabled, token, focused, foreground, attempt]);

  return { enabled, grounds, busy, error, enable, disable };
}

import * as Location from 'expo-location';
import { apiRequest } from '@/services/api';

export type LocationFix = { latitude: number; longitude: number; accuracyMeters: number; capturedAt: string };
export type Ground = { id: number; name: string; description: string | null; city: string; locality: string | null; addressLine1: string; addressLine2: string | null; state: string; postalCode: string; phone: string | null };

export function toLocationFix(position: Location.LocationObject, now = Date.now()): LocationFix {
  const { latitude, longitude, accuracy } = position.coords;
  if (!Number.isFinite(latitude) || Math.abs(latitude) > 90 || !Number.isFinite(longitude) || Math.abs(longitude) > 180) {
    throw new Error('Your device returned invalid location coordinates. Retry or choose an area manually.');
  }
  if (accuracy == null || !Number.isFinite(accuracy) || accuracy < 0) {
    throw new Error('Your device could not determine location accuracy. Retry or choose an area manually.');
  }
  if (accuracy > 1000) {
    throw new Error('Your device reports location accuracy of about ' + Math.round(accuracy).toLocaleString() + ' metres. Nearby search needs 1,000 metres or better. Enable precise location or choose an area manually.');
  }
  if (!Number.isFinite(position.timestamp) || now - position.timestamp > 120000 || position.timestamp - now > 30000) {
    throw new Error('Your device returned an old or incorrectly timed location. Retry to request a fresh fix, or choose an area manually.');
  }
  return { latitude, longitude, accuracyMeters: accuracy, capturedAt: new Date(position.timestamp).toISOString() };
}

export async function currentLocation(askPermission: boolean): Promise<LocationFix> {
  if (typeof window !== 'undefined' && window.isSecureContext === false) {
    throw new Error('Your browser needs HTTPS or localhost for location. Use the mobile app or choose an area manually.');
  }
  let permission = await Location.getForegroundPermissionsAsync();
  if (!permission.granted && askPermission && permission.canAskAgain) permission = await Location.requestForegroundPermissionsAsync();
  if (!permission.granted) throw new Error('Location access is off. Enable it in your app/browser settings, or choose an area manually.');
  if (!await Location.hasServicesEnabledAsync()) throw new Error('Turn on device location services, or choose an area manually.');
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const position = await Promise.race([
      Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High, ...(process.env.EXPO_OS === 'web' ? { maximumAge: 0, timeout: 20000 } : {}) }),
      new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error('Location took too long. Retry or choose an area manually.')), 20000); }),
    ]);
    return toLocationFix(position);
  } finally { if (timer) clearTimeout(timer); }
}

export function movedEnough(previous: LocationFix, next: LocationFix): boolean {
  const radians = (value: number) => value * Math.PI / 180;
  const dLat = radians(next.latitude - previous.latitude), dLon = radians(next.longitude - previous.longitude);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(radians(previous.latitude)) * Math.cos(radians(next.latitude)) * Math.sin(dLon / 2) ** 2;
  const distance = 6371000 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(Math.max(0, 1 - a)));
  return distance >= 250 && Date.parse(next.capturedAt) - Date.parse(previous.capturedAt) >= 30000;
}

export function saveLocation(token: string, fix: LocationFix, signal?: AbortSignal) {
  return apiRequest('/api/players/me/location', { method: 'PUT', headers: { Authorization: 'Bearer ' + token }, body: JSON.stringify(fix), signal });
}

export async function nearbyGrounds(token: string, fix: LocationFix, signal?: AbortSignal): Promise<Ground[]> {
  const data = await apiRequest('/api/players/me/nearby', { method: 'POST', headers: { Authorization: 'Bearer ' + token }, body: JSON.stringify(fix), signal });
  if (!Array.isArray(data) || !data.every(item => item && typeof item.id === 'number' && typeof item.name === 'string' && typeof item.city === 'string')) {
    throw new Error('Unable to read nearby grounds. Please retry.');
  }
  return data;
}

export const API_URL = (process.env.EXPO_PUBLIC_API_URL || 'http://192.168.29.39:8080').replace(/\/+$/, '');

export class ApiError extends Error {
  constructor(message: string, public fields: Record<string, string> = {}) { super(message); }
}

export async function apiRequest(path: string, options: RequestInit = {}): Promise<unknown> {
  const controller = new AbortController();
  const cancel = () => controller.abort();
  options.signal?.addEventListener('abort', cancel, { once: true });
  if (options.signal?.aborted) controller.abort();
  const timer = setTimeout(cancel, 15000);
  try {
    const response = await fetch(API_URL + path, {
      ...options, signal: controller.signal,
      headers: { Accept: 'application/json', ...(options.body ? { 'Content-Type': 'application/json' } : {}), ...options.headers },
    });
    const data = await response.json().catch(() => null);
    if (!response.ok) {
      const fields: Record<string, string> = {};
      if (data?.fieldErrors && typeof data.fieldErrors === 'object') {
        for (const [key, value] of Object.entries(data.fieldErrors)) {
          if (typeof value === 'string') fields[key] = value;
        }
      }
      throw new ApiError(typeof data?.message === 'string' ? data.message : 'Unable to complete the request.', fields);
    }
    if (data === null) throw new ApiError('The server returned an unreadable response.');
    return data;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError(controller.signal.aborted ? 'The request timed out. Check your connection.' : 'Cannot reach the server. Check your connection and try again.');
  } finally {
    clearTimeout(timer);
    options.signal?.removeEventListener('abort', cancel);
  }
}

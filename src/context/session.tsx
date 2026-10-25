import { createContext, useContext, useEffect, useState, type PropsWithChildren } from 'react';
import { AppState } from 'react-native';

type SessionUser = { userId: number; role: string };
type Session = { token: string; expiresAt: number; user: SessionUser; locationIntro: boolean };
type AuthContext = {
  session: Session | null;
  signIn: (token: string, expiresIn: number, user: SessionUser, locationIntro?: boolean) => void;
  dismissLocationIntro: () => void;
  signOut: () => void;
};
const SessionContext = createContext<AuthContext | null>(null);

export function SessionProvider({ children }: PropsWithChildren) {
  // Tokens stay in memory. Reloading the app requires signing in again.
  const [session, setSession] = useState<Session | null>(null);
  useEffect(() => {
    if (!session) return;
    const expire = () => {
      if (Date.now() >= session.expiresAt) setSession(null);
    };
    const timer = setInterval(expire, 1000);
    const subscription = AppState.addEventListener('change', state => {
      if (state === 'active') expire();
    });
    return () => { clearInterval(timer); subscription.remove(); };
  }, [session]);
  function signIn(token: string, expiresIn: number, user: SessionUser, locationIntro = false) {
    if (!token.trim() || !Number.isFinite(expiresIn) || expiresIn <= 0) {
      throw new Error('Invalid login response');
    }
    if (!Number.isSafeInteger(user?.userId) || user.userId <= 0 || !['APP_OWNER', 'VENUE_OWNER', 'PLAYER'].includes(user.role)) {
      throw new Error('Invalid login user');
    }
    setSession({ token, expiresAt: Date.now() + expiresIn * 1000, user, locationIntro });
  }
  return (
    <SessionContext value={{ session, signIn, dismissLocationIntro: () => setSession(current => current ? { ...current, locationIntro: false } : null), signOut: () => setSession(null) }}>
      {children}
    </SessionContext>
  );
}

export function useSession() {
  const context = useContext(SessionContext);
  if (!context) throw new Error('SessionProvider is required');
  return context;
}

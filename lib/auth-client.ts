// lib/auth-client.ts
import { useEffect, useState } from 'react';
import * as SecureStore from 'expo-secure-store';
import { API_URL } from '@/lib/config';

let cachedSession: any = null;
let listeners: Array<(session: any) => void> = [];

const emitSession = (nextSession: any) => {
  cachedSession = nextSession;
  listeners.forEach((listener) => {
    try { listener(nextSession); } catch {}
  });
};

const buildSessionShape = (token: string, user: any) => {
  return {
    session: {
      token,
      expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 30).toISOString()
    },
    user
  };
};

// 🎯 REMOVED: bootstrapSession(); is NO LONGER fired automatically on global file import pass!

export const authClient = {
  // 🎯 THE BRIDGE INSULATOR INITIALIZER:
  // This function is explicitly called ONLY after your layout confirms the hardware bridge is ready!
  initClientAsync: async () => {
    try {
      if (cachedSession) return cachedSession;
      
      const token = await SecureStore.getItemAsync('custom_user_session_token').catch(() => null);
      const userString = await SecureStore.getItemAsync('cached_user_profile').catch(() => null);

    const guestMode = await SecureStore.getItemAsync("guest_mode").catch(() => null);

if (!token || !userString) {
  cachedSession = null;

  // Guest or logged out are both valid states
  // Boot decides where to navigate
  return null;
}

      const parsedUser = JSON.parse(userString);
      cachedSession = buildSessionShape(token, parsedUser);
      emitSession(cachedSession);
      return cachedSession;
    } catch {
      cachedSession = null;
      return null;
    }
  },

  useSession: () => {
    const [data, setData] = useState(cachedSession);
    const [isPending, setIsPending] = useState(false);

    useEffect(() => {
      setData(cachedSession);
      const listener = (nextSession: any) => { setData(nextSession); };
      listeners.push(listener);
      return () => { listeners = listeners.filter((x) => x !== listener); };
    }, []);

    return { data, isPending, user: data?.user || null, cachedUser: data?.user || null };
  },

  subscribe: (listener: (session: any) => void) => {
    if (typeof listener !== 'function') return () => {};
    listeners.push(listener);
    listener(cachedSession);
    return () => { listeners = listeners.filter((x) => x !== listener); };
  },

  setSessionData: (sessionPayload: any) => {
    if (!sessionPayload) {
      cachedSession = null;
      emitSession(null);
      return;
    }

    const activeToken = sessionPayload.token || sessionPayload.session?.token || '';
    const activeUser = sessionPayload.user;
    const synchronizedObj = buildSessionShape(activeToken, activeUser);
    cachedSession = synchronizedObj;
    emitSession(synchronizedObj);
  },

  continueAsGuest: async () => {
    try {
      await SecureStore.deleteItemAsync('custom_user_session_token').catch(() => {});
      await SecureStore.deleteItemAsync('cached_user_profile').catch(() => {});
      await SecureStore.setItemAsync('guest_mode', 'true').catch(() => {});
      cachedSession = null;
      emitSession(null);
      return null;
    } catch {
      cachedSession = null;
      emitSession(null);
      return null;
    }
  },

  refreshSession: async () => {
    try {
      const token = await SecureStore.getItemAsync('custom_user_session_token').catch(() => null);
    if (!token) {
  return null;
}

      const res = await fetch(`${API_URL}/api/user/me`, {
        headers: { Authorization: `Bearer ${token.trim()}` }
      }).catch(() => null);

      if (!res || !res.ok) {
        if (res && (res.status === 401 || res.status === 403)) {
          await SecureStore.deleteItemAsync('custom_user_session_token').catch(() => {});
          await SecureStore.deleteItemAsync('cached_user_profile').catch(() => {});
          emitSession(null);
          return null;
        }
        return cachedSession;
      }
      const guestMode = await SecureStore.getItemAsync("guest_mode").catch(() => null);

if (!token) {
  if (guestMode !== "true") {
    emitSession(null);
  }
  return null;
}

      const data = await res.json().catch(() => ({}));
      if (!data?.user) return cachedSession;

      await SecureStore.setItemAsync('cached_user_profile', JSON.stringify(data.user)).catch(() => {});
      const nextSession = buildSessionShape(token, data.user);
      emitSession(nextSession);
      return nextSession;
    } catch {
      return cachedSession;
    }
  },

  signInDirect: async (email: string, password: string) => {
    const res = await fetch(`${API_URL}/api/auth/sign-in/direct`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    const data = await res.json();
    if (!res.ok || !data?.session?.token) throw new Error(data?.error || 'Authentication failed');
    await SecureStore.deleteItemAsync('guest_mode').catch(() => {});
    await SecureStore.setItemAsync('custom_user_session_token', data.session.token);
    await SecureStore.setItemAsync('cached_user_profile', JSON.stringify(data.session.user));
    const nextSession = buildSessionShape(data.session.token, data.session.user);
    emitSession(nextSession);
    return data;
  },

  signUpDirect: async ({ email, password, name, phone }: any) => {
    const res = await fetch(`${API_URL}/api/auth/sign-up/direct`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, name, phone })
    });
    const data = await res.json();
    if (!res.ok || !data?.session?.token) throw new Error(data?.error || 'Registration failed');
    await SecureStore.deleteItemAsync('guest_mode').catch(() => {});
    await SecureStore.setItemAsync('custom_user_session_token', data.session.token);
    await SecureStore.setItemAsync('cached_user_profile', JSON.stringify(data.session.user));
    const nextSession = buildSessionShape(data.session.token, data.session.user);
    emitSession(nextSession);
    return data;
  },

  signOut: async () => {
    try {
      const token = await SecureStore.getItemAsync('custom_user_session_token').catch(() => null);
      if (token) {
        await fetch(`${API_URL}/api/auth/logout`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token.trim()}` }
        }).catch(() => {});
      }
      await SecureStore.deleteItemAsync("guest_mode").catch(() => {});
emitSession(null);
    } catch {}
    await SecureStore.deleteItemAsync('custom_user_session_token').catch(() => {});
    await SecureStore.deleteItemAsync('cached_user_profile').catch(() => {});
    emitSession(null);
    try { const { OneSignal } = require('react-native-onesignal'); OneSignal.logout(); } catch {}
  }
};

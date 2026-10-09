import api, { configureApiAuth } from '../utils/apiClient';
import React, {
  createContext,
  useCallback,
  useContext,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';

const SENSITIVE_CACHE_KEYS = [
  'cached_channels',
  'cached_messages',
  'cached_keywords',
  'last_fetch_time',
];

const PREFERENCE_SECTIONS = new Set(['inbox', 'reports']);

export const clearSensitiveSession = () => {
  localStorage.removeItem('user');
  localStorage.removeItem('name');
  localStorage.removeItem('token');
  SENSITIVE_CACHE_KEYS.forEach((key) => localStorage.removeItem(key));
};

const restoreUser = () => {
  const token = localStorage.getItem('token');
  const savedUser = localStorage.getItem('user');
  if (!token || !savedUser) {
    clearSensitiveSession();
    return null;
  }

  try {
    return JSON.parse(savedUser);
  } catch {
    clearSensitiveSession();
    return null;
  }
};

const getPrincipal = (value) => value?.user ?? value ?? null;

const replacePrincipal = (value, principal) => (
  value?.user && typeof value.user === 'object'
    ? { ...value, user: principal }
    : principal
);

const normalizePreferences = (preferences = {}) => ({
  inbox: { ...(preferences.inbox || {}) },
  reports: { ...(preferences.reports || {}) },
});

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(restoreUser);
  const userRef = useRef(user);
  const preferenceSaveQueueRef = useRef(Promise.resolve());
  const [token, setToken] = useState(() => user ? localStorage.getItem('token') : null);
  const [isReLogin, setIsReLogin] = useState(false);
  const [wasLoggedOut, setWasLoggedOut] = useState(false);

  const persistUser = useCallback((nextUser) => {
    userRef.current = nextUser;
    setUser(nextUser);

    if (!nextUser) {
      localStorage.removeItem('user');
      localStorage.removeItem('name');
      return;
    }

    localStorage.setItem('user', JSON.stringify(nextUser));
    const principal = getPrincipal(nextUser);
    if (principal?.name) localStorage.setItem('name', principal.name);
  }, []);

  const logout = useCallback(() => {
    clearSensitiveSession();
    userRef.current = null;
    setToken(null);
    setUser(null);
    setIsReLogin(false);
    setWasLoggedOut(true);
  }, []);

  useLayoutEffect(() => {
    return configureApiAuth({
      token: () => token,
      unauthorized: logout,
    });
  }, [logout, token]);

  const login = useCallback((userData) => {
    setToken(userData.token);
    localStorage.setItem('token', userData.token);
    persistUser(userData);

    if (wasLoggedOut) {
      setIsReLogin(true);
      setWasLoggedOut(false);
    }
  }, [persistUser, wasLoggedOut]);

  const updateUser = useCallback((changes) => {
    const current = userRef.current;
    const principal = getPrincipal(current);
    if (!principal) return;

    const nextPrincipal = typeof changes === 'function'
      ? changes(principal)
      : { ...principal, ...changes };

    persistUser(replacePrincipal(current, nextPrincipal));
  }, [persistUser]);

  const updatePreferences = useCallback((section, changes) => {
    if (!PREFERENCE_SECTIONS.has(section)) {
      return Promise.reject(new Error(`Unknown preference section: ${section}`));
    }
    if (!changes || typeof changes !== 'object' || Array.isArray(changes)) {
      return Promise.reject(new Error('Preference changes must be an object'));
    }

    const current = userRef.current;
    const principal = getPrincipal(current);
    if (!principal?.id) {
      return Promise.reject(new Error('Authenticated user is unavailable'));
    }

    const nextPreferences = normalizePreferences(principal.preferences);
    nextPreferences[section] = {
      ...nextPreferences[section],
      ...changes,
    };

    const nextPrincipal = {
      ...principal,
      preferences: nextPreferences,
    };
    persistUser(replacePrincipal(current, nextPrincipal));

    const save = preferenceSaveQueueRef.current
      .catch(() => undefined)
      .then(() => api.patch(`/users/${principal.id}`, { preferences: nextPreferences }));

    preferenceSaveQueueRef.current = save;
    return save;
  }, [persistUser]);

  return (
    <AuthContext.Provider value={{
      user,
      login,
      logout,
      updateUser,
      updatePreferences,
      isReLogin,
      resetReLoginFlag: () => setIsReLogin(false),
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};

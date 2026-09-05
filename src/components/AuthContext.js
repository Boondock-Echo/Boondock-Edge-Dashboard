import { configureApiAuth } from '../utils/apiClient';
import React, {
  createContext,
  useCallback,
  useContext,
  useLayoutEffect,
  useState,
} from 'react';

const SENSITIVE_CACHE_KEYS = [
  'cached_channels',
  'cached_messages',
  'cached_keywords',
  'last_fetch_time',
];

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

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(restoreUser);
  const [token, setToken] = useState(() => user ? localStorage.getItem('token') : null);
  const [isReLogin, setIsReLogin] = useState(false);
  const [wasLoggedOut, setWasLoggedOut] = useState(false);

  const logout = useCallback(() => {
    clearSensitiveSession();
    setToken(null);
    setUser(null);
    setIsReLogin(false);
    setWasLoggedOut(true);
  }, []);

  // The Fetch client reads the current token and logs out rejected sessions.
  useLayoutEffect(() => {
    return configureApiAuth({
      token: () => token,
      unauthorized: logout,
    });
  }, [logout, token]);

  const login = (userData) => {
    setToken(userData.token);
    localStorage.setItem('user', JSON.stringify(userData));
    if (userData.name) localStorage.setItem('name', userData.name);
    localStorage.setItem('token', userData.token);
    setUser(userData);

    if (wasLoggedOut) {
      setIsReLogin(true);
      setWasLoggedOut(false);
    }
  };

  return (
    <AuthContext.Provider value={{
      user,
      login,
      logout,
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

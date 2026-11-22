import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { AuthContextType, LoginData, RegisterData, User } from '../types/index.ts';
import {
  getCurrentUser,
  getStoredToken,
  loginUser,
  registerUser,
  removeStoredToken,
  setStoredToken,
} from '../services/auth.ts';

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(getStoredToken());
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  // Initialize session on mount: verify stored token against GET /api/auth/me
  useEffect(() => {
    let isMounted = true;
    const initAuth = async () => {
      const storedToken = getStoredToken();
      if (!storedToken) {
        if (isMounted) {
          setUser(null);
          setToken(null);
          setLoading(false);
        }
        return;
      }

      try {
        const currentUser = await getCurrentUser(storedToken);
        if (isMounted) {
          setUser(currentUser);
          setToken(storedToken);
          setError(null);
        }
      } catch (err) {
        console.warn('Initial session validation failed; resetting token:', err);
        removeStoredToken();
        if (isMounted) {
          setUser(null);
          setToken(null);
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    initAuth();

    return () => {
      isMounted = false;
    };
  }, []);

  const login = useCallback(async (data: LoginData) => {
    setLoading(true);
    setError(null);
    try {
      const response = await loginUser(data);
      setStoredToken(response.token);
      setToken(response.token);
      setUser(response.user);
      return response.user;
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Invalid login credentials.';
      setError(msg);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const register = useCallback(async (data: RegisterData) => {
    setLoading(true);
    setError(null);
    try {
      const response = await registerUser(data);
      setStoredToken(response.token);
      setToken(response.token);
      setUser(response.user);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Registration failed.';
      setError(msg);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const logout = useCallback(() => {
    removeStoredToken();
    setUser(null);
    setToken(null);
    setError(null);
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isAuthenticated: !!user && !!token,
        loading,
        error,
        login,
        register,
        logout,
        clearError,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};


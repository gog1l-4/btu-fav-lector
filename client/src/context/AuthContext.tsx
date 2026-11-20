import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { apiRequest, getStoredToken, setStoredToken } from '../api/client';
import type { User, UserCounts } from '../types';

interface AuthContextValue {
  user: User | null;
  counts: UserCounts;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (payload: {
    firstName: string;
    lastName: string;
    email: string;
    password: string;
    universityId: string;
    facultyId?: string | null;
    studyYear: number;
    studentIdNumber?: string;
  }) => Promise<{ devVerifyUrl?: string; isOfficialStudentEmail?: boolean }>;
  logout: () => void;
  refreshMe: () => Promise<void>;
  setSessionToken: (token: string) => Promise<void>;
  setCounts: React.Dispatch<React.SetStateAction<UserCounts>>;
}

const defaultCounts: UserCounts = {
  unreadNotifications: 0,
  unreadMessages: 0,
  activeOffersCount: 0,
  completedSwapsCount: 0,
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [counts, setCounts] = useState<UserCounts>(defaultCounts);
  const [loading, setLoading] = useState<boolean>(Boolean(getStoredToken()));

  const refreshMe = useCallback(async () => {
    const token = getStoredToken();
    if (!token) {
      setUser(null);
      setCounts(defaultCounts);
      setLoading(false);
      return;
    }
    try {
      const data = await apiRequest<{ user: User; counts: UserCounts }>('/auth/me');
      setUser(data.user);
      setCounts(data.counts);
    } catch {
      setStoredToken(null);
      setUser(null);
      setCounts(defaultCounts);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshMe();
  }, [refreshMe]);

  const login = async (email: string, password: string) => {
    const data = await apiRequest<{ token: string; user: User }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    setStoredToken(data.token);
    setUser(data.user);
    await refreshMe();
  };

  const register = async (payload: {
    firstName: string;
    lastName: string;
    email: string;
    password: string;
    universityId: string;
    facultyId?: string | null;
    studyYear: number;
    studentIdNumber?: string;
  }) => {
    const data = await apiRequest<{
      token: string;
      user: User;
      devVerifyUrl?: string;
      isOfficialStudentEmail?: boolean;
    }>('/auth/register', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    setStoredToken(data.token);
    setUser(data.user);
    await refreshMe();
    return {
      devVerifyUrl: data.devVerifyUrl,
      isOfficialStudentEmail: data.isOfficialStudentEmail,
    };
  };

  const logout = () => {
    setStoredToken(null);
    setUser(null);
    setCounts(defaultCounts);
  };

  const setSessionToken = async (token: string) => {
    setStoredToken(token);
    await refreshMe();
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        counts,
        loading,
        login,
        register,
        logout,
        refreshMe,
        setSessionToken,
        setCounts,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}

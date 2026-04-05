'use client';

import { create } from 'zustand';
import { User, Organization } from '@/types';

interface AuthState {
  user: User | null;
  organization: Organization | null;
  isAuthenticated: boolean;
  setAuth: (user: User, organization: Organization, accessToken: string, refreshToken: string) => void;
  logout: () => void;
  loadFromStorage: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  organization: null,
  isAuthenticated: false,

  setAuth: (user, organization, accessToken, refreshToken) => {
    localStorage.setItem('accessToken', accessToken);
    localStorage.setItem('refreshToken', refreshToken);
    localStorage.setItem('user', JSON.stringify(user));
    localStorage.setItem('organization', JSON.stringify(organization));
    set({ user, organization, isAuthenticated: true });
  },

  logout: () => {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('user');
    localStorage.removeItem('organization');
    set({ user: null, organization: null, isAuthenticated: false });
  },

  loadFromStorage: () => {
    const userStr = localStorage.getItem('user');
    const orgStr = localStorage.getItem('organization');
    const token = localStorage.getItem('accessToken');
    if (userStr && orgStr && token) {
      set({
        user: JSON.parse(userStr),
        organization: JSON.parse(orgStr),
        isAuthenticated: true,
      });
    }
  },
}));

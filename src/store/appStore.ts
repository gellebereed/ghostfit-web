import { create } from 'zustand';
import { UserProfile } from '@/lib/types';
import { getProfile } from '@/lib/db';

interface AppStore {
  profile: UserProfile | null;
  updateProfile: (updates: Partial<UserProfile>) => void;
  refreshProfile: (userId?: string) => Promise<void>;
  setProfile: (profile: UserProfile | null) => void;
}

export const useAppStore = create<AppStore>((set) => ({
  profile: null,
  
  setProfile: (profile) => set({ profile }),

  updateProfile: (updates) => set((state) => ({
    profile: state.profile ? { ...state.profile, ...updates } : null
  })),

  refreshProfile: async () => {
    const profile = await getProfile();
    if (profile) {
      set({ profile });
      localStorage.setItem('ghostfit_profile', JSON.stringify(profile));
    }
  },
}));

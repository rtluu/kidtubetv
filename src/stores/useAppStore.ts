import { create } from 'zustand';

interface AppState {
  splashSeen: boolean;
  hasHydrated: boolean;
  setSplashSeen: (seen: boolean) => void;
  setHasHydrated: (hydrated: boolean) => void;
}

export const useAppStore = create<AppState>((set) => ({
  splashSeen: false,
  hasHydrated: false,
  setSplashSeen: (seen) => set({ splashSeen: seen }),
  setHasHydrated: (hydrated) => set({ hasHydrated: hydrated }),
}));

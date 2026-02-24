import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface PreferencesState {
  ageRange: { min: number; max: number } | null;
  selectedInterests: string[];
  selectedNetworks: string[];
  onboardingComplete: boolean;
  parentPin: string | null;
  subscriptionTier: 'free' | 'premium';
  setAgeRange: (range: { min: number; max: number }) => void;
  setInterests: (interests: string[]) => void;
  setNetworks: (networks: string[]) => void;
  completeOnboarding: () => void;
  setParentPin: (pin: string) => void;
  setSubscriptionTier: (tier: 'free' | 'premium') => void;
  reset: () => void;
}

export const usePreferencesStore = create<PreferencesState>()(
  persist(
    (set) => ({
      ageRange: null,
      selectedInterests: [],
      selectedNetworks: [],
      onboardingComplete: false,
      parentPin: null,
      subscriptionTier: 'free',
      setAgeRange: (range) => set({ ageRange: range }),
      setInterests: (interests) => set({ selectedInterests: interests }),
      setNetworks: (networks) => set({ selectedNetworks: networks }),
      completeOnboarding: () => set({ onboardingComplete: true }),
      setParentPin: (pin) => set({ parentPin: pin }),
      setSubscriptionTier: (tier) => set({ subscriptionTier: tier }),
      reset: () =>
        set({
          ageRange: null,
          selectedInterests: [],
          selectedNetworks: [],
          onboardingComplete: false,
        }),
    }),
    {
      name: 'kidtubetv-preferences',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);

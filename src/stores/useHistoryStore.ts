import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { WatchHistoryEntry } from '@src/types/user';

interface HistoryState {
  entries: WatchHistoryEntry[];
  addEntry: (entry: WatchHistoryEntry) => void;
  getRecent: (limit?: number) => WatchHistoryEntry[];
  clearHistory: () => void;
}

const MAX_HISTORY = 100;

export const useHistoryStore = create<HistoryState>()(
  persist(
    (set, get) => ({
      entries: [],
      addEntry: (entry) =>
        set((state) => ({
          entries: [entry, ...state.entries].slice(0, MAX_HISTORY),
        })),
      getRecent: (limit = 20) => get().entries.slice(0, limit),
      clearHistory: () => set({ entries: [] }),
    }),
    {
      name: 'kidtubetv-history',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);

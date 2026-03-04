import { create } from 'zustand';
import { GateConfig } from '@src/types/learningGate';

interface LearningGateState {
  videosWatchedSinceGate: number;
  sessionPassed: boolean;

  incrementWatched: () => void;
  resetGate: () => void;
  markSessionPassed: () => void;
  shouldShowGate: (config: GateConfig) => boolean;
}

export const useLearningGateStore = create<LearningGateState>()((set, get) => ({
  videosWatchedSinceGate: 0,
  sessionPassed: false,

  incrementWatched: () =>
    set((state) => ({ videosWatchedSinceGate: state.videosWatchedSinceGate + 1 })),

  resetGate: () => set({ videosWatchedSinceGate: 0 }),

  markSessionPassed: () => set({ sessionPassed: true }),

  shouldShowGate: (config: GateConfig): boolean => {
    const { learningGateEnabled, gateFrequency, videosPerGate } = config;
    if (!learningGateEnabled) return false;

    const { sessionPassed, videosWatchedSinceGate } = get();

    if (gateFrequency === 'session') {
      return !sessionPassed;
    }

    if (gateFrequency === 'every-n') {
      // Show gate when the counter hits a multiple of videosPerGate
      // (counter is incremented AFTER passing the gate, so 0 → show, 1..n-1 → skip)
      return videosWatchedSinceGate % videosPerGate === 0;
    }

    // 'every' — always show
    return true;
  },
}));

import { create } from 'zustand';
import { Video } from '@src/types/video';

interface PlayerState {
  currentVideo: Video | null;
  queue: Video[];
  isPlaying: boolean;
  isMuted: boolean;
  currentTime: number;
  duration: number;
  setCurrentVideo: (video: Video | null) => void;
  setQueue: (videos: Video[]) => void;
  setIsPlaying: (playing: boolean) => void;
  setIsMuted: (muted: boolean) => void;
  setCurrentTime: (time: number) => void;
  setDuration: (duration: number) => void;
  setProgress: (currentTime: number, duration: number) => void;
  playNext: () => void;
}

export const usePlayerStore = create<PlayerState>((set, get) => ({
  currentVideo: null,
  queue: [],
  isPlaying: false,
  isMuted: true,
  currentTime: 0,
  duration: 0,
  setCurrentVideo: (video) => set({ currentVideo: video, currentTime: 0, duration: 0 }),
  setQueue: (videos) => set({ queue: videos }),
  setIsPlaying: (playing) => set({ isPlaying: playing }),
  setIsMuted: (muted) => set({ isMuted: muted }),
  setCurrentTime: (time) => set({ currentTime: time }),
  setDuration: (duration) => set({ duration }),
  setProgress: (currentTime, duration) => set({ currentTime, duration }),
  playNext: () => {
    const { queue } = get();
    if (queue.length > 0) {
      const [next, ...rest] = queue;
      set({ currentVideo: next, queue: rest });
    }
  },
}));

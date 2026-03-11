import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Video, Playlist } from '@src/types/video';
import { GateFrequency } from '@src/types/learningGate';

interface ParentState {
  // Playlist video metadata cache (YouTube-search videos added to playlists)
  playlistVideoCache: Record<string, Video>;
  setPlaylistVideo: (id: string, video: Video) => void;

  // Playlists
  playlists: Playlist[];
  createPlaylist: (title: string) => void;
  updatePlaylistTitle: (id: string, title: string) => void;
  deletePlaylist: (id: string) => void;
  reorderPlaylists: (fromIndex: number, toIndex: number) => void;
  addVideoToPlaylist: (playlistId: string, videoId: string) => void;
  removeVideoFromPlaylist: (playlistId: string, videoId: string) => void;
  reorderPlaylistVideos: (playlistId: string, fromIndex: number, toIndex: number) => void;

  // Daily time limit (minutes, null = unlimited)
  dailyTimeLimitMinutes: number | null;
  setDailyTimeLimit: (minutes: number | null) => void;

  // Bedtime
  bedtimeEnabled: boolean;
  bedtimeHour: number;
  bedtimeMinute: number;
  setBedtime: (hour: number, minute: number) => void;
  toggleBedtime: (enabled: boolean) => void;

  // Break reminders
  breakReminderEnabled: boolean;
  breakReminderMinutes: number;
  setBreakReminder: (minutes: number) => void;
  toggleBreakReminder: (enabled: boolean) => void;

  // Video start times (seconds, keyed by video id) — per-video resume / start point
  videoStartTimes: Record<string, number>;
  setVideoStartTime: (videoId: string, seconds: number) => void;
  clearVideoStartTime: (videoId: string) => void;

  // Channel preview start times (seconds, keyed by channel id) — skip show intros during hover preview
  channelPreviewStartTimes: Record<string, number>;
  setChannelPreviewStartTime: (channelId: string, seconds: number) => void;
  clearChannelPreviewStartTime: (channelId: string) => void;

  // Auto-play
  autoPlayEnabled: boolean;
  toggleAutoPlay: (enabled: boolean) => void;

  // Learning Gate
  learningGateEnabled: boolean;
  childAge: number;
  gateFrequency: GateFrequency;
  videosPerGate: number;
  setLearningGateEnabled: (v: boolean) => void;
  setChildAge: (age: number) => void;
  setGateFrequency: (f: GateFrequency) => void;
  setVideosPerGate: (n: number) => void;
}

export const useParentStore = create<ParentState>()(
  persist(
    (set) => ({
      playlistVideoCache: {},
      setPlaylistVideo: (id, video) =>
        set((state) => ({
          playlistVideoCache: { ...state.playlistVideoCache, [id]: video },
        })),

      playlists: [],
      createPlaylist: (title) =>
        set((state) => ({
          playlists: [
            ...state.playlists,
            {
              id: `playlist-${Date.now()}`,
              title,
              videoIds: [],
              createdAt: Date.now(),
              sortOrder: state.playlists.length,
            },
          ],
        })),
      updatePlaylistTitle: (id, title) =>
        set((state) => ({
          playlists: state.playlists.map((p) =>
            p.id === id ? { ...p, title } : p
          ),
        })),
      deletePlaylist: (id) =>
        set((state) => ({
          playlists: state.playlists.filter((p) => p.id !== id),
        })),
      reorderPlaylists: (fromIndex, toIndex) =>
        set((state) => {
          const arr = [...state.playlists];
          const [moved] = arr.splice(fromIndex, 1);
          arr.splice(toIndex, 0, moved);
          return { playlists: arr.map((p, i) => ({ ...p, sortOrder: i })) };
        }),
      addVideoToPlaylist: (playlistId, videoId) =>
        set((state) => ({
          playlists: state.playlists.map((p) =>
            p.id === playlistId && !p.videoIds.includes(videoId)
              ? { ...p, videoIds: [...p.videoIds, videoId] }
              : p
          ),
        })),
      removeVideoFromPlaylist: (playlistId, videoId) =>
        set((state) => ({
          playlists: state.playlists.map((p) =>
            p.id === playlistId
              ? { ...p, videoIds: p.videoIds.filter((id) => id !== videoId) }
              : p
          ),
        })),
      reorderPlaylistVideos: (playlistId, fromIndex, toIndex) =>
        set((state) => ({
          playlists: state.playlists.map((p) => {
            if (p.id !== playlistId) return p;
            const ids = [...p.videoIds];
            const [moved] = ids.splice(fromIndex, 1);
            ids.splice(toIndex, 0, moved);
            return { ...p, videoIds: ids };
          }),
        })),

      dailyTimeLimitMinutes: null,
      setDailyTimeLimit: (minutes) => set({ dailyTimeLimitMinutes: minutes }),

      bedtimeEnabled: false,
      bedtimeHour: 20,
      bedtimeMinute: 0,
      setBedtime: (hour, minute) =>
        set({ bedtimeHour: hour, bedtimeMinute: minute }),
      toggleBedtime: (enabled) => set({ bedtimeEnabled: enabled }),

      breakReminderEnabled: false,
      breakReminderMinutes: 30,
      setBreakReminder: (minutes) => set({ breakReminderMinutes: minutes }),
      toggleBreakReminder: (enabled) => set({ breakReminderEnabled: enabled }),

      videoStartTimes: {},
      setVideoStartTime: (videoId, seconds) =>
        set((state) => ({
          videoStartTimes: { ...state.videoStartTimes, [videoId]: seconds },
        })),
      clearVideoStartTime: (videoId) =>
        set((state) => {
          const { [videoId]: _, ...rest } = state.videoStartTimes;
          return { videoStartTimes: rest };
        }),

      channelPreviewStartTimes: {},
      setChannelPreviewStartTime: (channelId, seconds) =>
        set((state) => ({
          channelPreviewStartTimes: { ...state.channelPreviewStartTimes, [channelId]: seconds },
        })),
      clearChannelPreviewStartTime: (channelId) =>
        set((state) => {
          const { [channelId]: _, ...rest } = state.channelPreviewStartTimes;
          return { channelPreviewStartTimes: rest };
        }),

      autoPlayEnabled: true,
      toggleAutoPlay: (enabled) => set({ autoPlayEnabled: enabled }),

      learningGateEnabled: false,
      childAge: 6,
      gateFrequency: 'every' as GateFrequency,
      videosPerGate: 3,
      setLearningGateEnabled: (v) => set({ learningGateEnabled: v }),
      setChildAge: (age) => set({ childAge: age }),
      setGateFrequency: (f) => set({ gateFrequency: f }),
      setVideosPerGate: (n) => set({ videosPerGate: n }),
    }),
    {
      name: 'kidtubetv-parent',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);

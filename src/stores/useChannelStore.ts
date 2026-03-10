import { create } from 'zustand';
import { Video } from '@src/types/video';

interface ChannelStoreState {
  channelVideos: Record<string, Video[]>;
  allChannelVideos: Video[];
  setChannelVideos: (channelId: string, videos: Video[]) => void;
  getVideoById: (id: string) => Video | undefined;
}

export const useChannelStore = create<ChannelStoreState>((set, get) => ({
  channelVideos: {},
  allChannelVideos: [],

  setChannelVideos: (channelId, videos) =>
    set((state) => {
      const updated = { ...state.channelVideos, [channelId]: videos };
      return {
        channelVideos: updated,
        allChannelVideos: Object.values(updated).flat(),
      };
    }),

  getVideoById: (id) => {
    return get().allChannelVideos.find((v) => v.id === id);
  },
}));

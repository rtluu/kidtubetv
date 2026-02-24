import { Video, Channel, Network, Category } from '@src/types/video';

// Local JSON imports (seed data)
import networksData from '@src/data/networks.json';
import categoriesData from '@src/data/categories.json';
import channelsData from '@src/data/channels.json';
import videosData from '@src/data/videos.json';

// Content service — reads from local JSON for now, will swap to Firestore in Phase 6

export interface ContentFilters {
  networkId?: string;
  channelId?: string;
  categoryId?: string;
  freeOnly?: boolean;
  activeOnly?: boolean;
}

export async function getNetworks(): Promise<Network[]> {
  return (networksData as Network[])
    .filter((n) => n.isActive)
    .sort((a, b) => a.sortOrder - b.sortOrder);
}

export async function getCategories(): Promise<Category[]> {
  return (categoriesData as Category[])
    .filter((c) => c.isActive)
    .sort((a, b) => a.sortOrder - b.sortOrder);
}

export async function getChannels(filters?: ContentFilters): Promise<Channel[]> {
  let channels = (channelsData as Channel[]).filter((c) => c.isActive);

  if (filters?.networkId) {
    channels = channels.filter((c) => c.networkId === filters.networkId);
  }
  if (filters?.categoryId) {
    channels = channels.filter((c) => c.categoryIds.includes(filters.categoryId!));
  }
  if (filters?.freeOnly) {
    channels = channels.filter((c) => c.isFreebie);
  }

  return channels.sort((a, b) => a.sortOrder - b.sortOrder);
}

export async function getVideos(filters?: ContentFilters): Promise<Video[]> {
  let videos = (videosData as Video[]).filter((v) => v.isActive);

  if (filters?.channelId) {
    videos = videos.filter((v) => v.channelId === filters.channelId);
  }
  if (filters?.networkId) {
    videos = videos.filter((v) => v.networkId === filters.networkId);
  }
  if (filters?.categoryId) {
    videos = videos.filter((v) => v.categoryIds.includes(filters.categoryId!));
  }
  if (filters?.freeOnly) {
    videos = videos.filter((v) => v.isFreebie);
  }

  return videos.sort((a, b) => a.sortOrder - b.sortOrder);
}

export async function getVideoById(id: string): Promise<Video | undefined> {
  return (videosData as Video[]).find((v) => v.id === id);
}

export async function searchContent(query: string): Promise<Video[]> {
  const q = query.toLowerCase();
  return (videosData as Video[]).filter(
    (v) =>
      v.isActive &&
      (v.title.toLowerCase().includes(q) ||
        v.tags.some((t) => t.toLowerCase().includes(q)) ||
        v.description.toLowerCase().includes(q))
  );
}

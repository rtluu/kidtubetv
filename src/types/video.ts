export type VideoSource = 'youtube' | 'pbskids' | 'direct';

export interface Video {
  id: string;
  title: string;
  description: string;
  source: VideoSource;
  youtubeVideoId?: string;
  pbsPartnerToken?: string;
  directUrl?: string;
  thumbnailUrl: string;
  duration: number;
  channelId: string;
  networkId: string;
  categoryIds: string[];
  tags: string[];
  ageRange: {
    min: number;
    max: number;
  };
  seasonNumber?: number;
  episodeNumber?: number;
  releaseYear?: number;
  viewCount?: string;
  sortOrder: number;
  isActive: boolean;
  isFreebie: boolean;
}

export interface Channel {
  id: string;
  title: string;
  description: string;
  thumbnailUrl: string;
  networkId: string;
  categoryIds: string[];
  ageRange: {
    min: number;
    max: number;
  };
  videoCount: number;
  sortOrder: number;
  isActive: boolean;
  isFreebie: boolean;
}

export interface Network {
  id: string;
  name: string;
  shortName: string;
  logoUrl: string;
  color: string;
  sortOrder: number;
  isActive: boolean;
}

export interface Category {
  id: string;
  name: string;
  iconUrl: string;
  color: string;
  sortOrder: number;
  isActive: boolean;
}

export interface Playlist {
  id: string;
  title: string;
  videoIds: string[];
  createdAt: number;
  sortOrder: number;
}

export interface AppConfig {
  channelOrder: string[];
  videoOverrides: Record<string, { channelId: string }>;
  sectionTitleOverrides?: Record<string, string>;
  hiddenSections?: string[];
}

export interface SubscribedChannel {
  id: string;               // youtube: UCxxx, pbs: pbs-arthur
  youtubeChannelId: string; // same as id
  handle: string;           // youtube: "@CartoonNetwork", pbs: show slug
  title: string;
  thumbnailUrl: string;
  subscribedAt: number;
  sortOrder: number;
  source?: 'youtube' | 'pbskids';
  pbsShowSlug?: string;     // e.g. 'arthur'
}

export interface ChannelSearchResult {
  channelId: string;
  title: string;
  thumbnailUrl: string;
  handle: string;
  subscriberCount: string;
}

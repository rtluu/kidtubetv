export interface UserPreferences {
  ageRange: { min: number; max: number } | null;
  selectedInterests: string[];
  selectedNetworks: string[];
  onboardingComplete: boolean;
  parentPin: string | null;
}

export interface WatchHistoryEntry {
  videoId: string;
  channelId: string;
  watchedAt: number;
  watchedDuration: number;
  completed: boolean;
}

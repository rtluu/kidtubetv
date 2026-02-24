export const config = {
  maxHistoryEntries: 100,
  recentHistoryLimit: 20,
  staleTime: 1000 * 60 * 30, // 30 minutes
  heroPlayerAspectRatio: 16 / 9,
  maxContentWidth: 800,
  pinLength: 4,
  defaultSubscriptionTier: 'free' as const,
} as const;

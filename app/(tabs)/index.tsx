import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import {
  StyleSheet,
  ScrollView,
  View,
  Text,
  Pressable,
  ActivityIndicator,
  Platform,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery, useQueries } from '@tanstack/react-query';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { colors, spacing, typography, borderRadius } from '@src/constants/theme';
import { fetchSubscribedChannels, fetchChannelVideos } from '@src/services/channelSubscriptions';
import { fetchAppConfig } from '@src/services/config';
import { Video, SubscribedChannel, Playlist, AppConfig } from '@src/types/video';
import { useParentStore } from '@src/stores/useParentStore';
import { useChannelStore } from '@src/stores/useChannelStore';
import HomeVideoCard from '@src/components/HomeVideoCard';
import ShowDrawer from '@src/components/ShowDrawer';

type ViewMode = 'rows' | 'feed' | 'grid';

function SkeletonCard({ width }: { width: number }) {
  const height = Math.round(width * (9 / 16));
  return (
    <View style={[skeletonStyles.card, { width, marginRight: spacing.sm }]}>
      <View style={[skeletonStyles.thumb, { height }]} />
      <View style={skeletonStyles.info}>
        <View style={[skeletonStyles.line, { width: '80%' }]} />
        <View style={[skeletonStyles.line, { width: '55%', marginTop: 6 }]} />
      </View>
    </View>
  );
}

const skeletonStyles = StyleSheet.create({
  card: { backgroundColor: colors.card, borderRadius: borderRadius.md, overflow: 'hidden', marginBottom: spacing.sm },
  thumb: { width: '100%', backgroundColor: 'rgba(255,255,255,0.07)' },
  info: { padding: spacing.sm },
  line: { height: 10, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.07)' },
});

interface ChannelSection {
  channel: SubscribedChannel | { id: string; title: string; thumbnailUrl: string; networkId: string };
  videos: Video[];
}

function ViewModeButton({
  icon,
  label,
  active,
  onPress,
}: {
  icon: React.ComponentProps<typeof FontAwesome>['name'];
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      style={[styles.viewModeBtn, active && styles.viewModeBtnActive]}
      onPress={onPress}
    >
      <FontAwesome
        name={icon}
        size={14}
        color={active ? colors.crtBlue : colors.textSecondary}
      />
      <Text
        style={[
          styles.viewModeBtnLabel,
          active && styles.viewModeBtnLabelActive,
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

// ── Feed card wrapper that reports visibility via IntersectionObserver ──
function FeedCardWrapper({
  video,
  channel,
  cardWidth,
  isPreview,
  isExpanded,
  onPreviewStart,
  onPreviewEnd,
  onExpand,
  onCollapse,
  upNextVideos,
  onPlayVideo,
  onVisibilityChange,
}: {
  video: Video;
  channel?: SubscribedChannel | { id: string; title: string; thumbnailUrl: string; networkId: string };
  cardWidth: number;
  isPreview: boolean;
  isExpanded: boolean;
  onPreviewStart: (videoId: string) => void;
  onPreviewEnd: () => void;
  onExpand: (videoId: string) => void;
  onCollapse: () => void;
  upNextVideos: Video[];
  onPlayVideo: (videoId: string) => void;
  onVisibilityChange: (videoId: string, ratio: number) => void;
}) {
  const wrapperRef = useRef<View>(null);

  useEffect(() => {
    if (Platform.OS !== 'web' || !wrapperRef.current) return;

    const node = (wrapperRef.current as any);
    const domNode: HTMLElement | null =
      node instanceof HTMLElement ? node :
      node?._nativeTag ?? node?.getHostNode?.() ?? null;

    if (!domNode || !(domNode instanceof HTMLElement)) return;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          onVisibilityChange(video.id, entry.intersectionRatio);
        }
      },
      { threshold: [0, 0.25, 0.5, 0.75, 1.0] }
    );

    observer.observe(domNode);
    return () => observer.disconnect();
  }, [video.id, onVisibilityChange]);

  return (
    <View ref={wrapperRef} collapsable={false}>
      <HomeVideoCard
        video={video}
        channel={channel as any}
        mode="feed"
        cardWidth={cardWidth}
        isPreview={isPreview}
        isExpanded={isExpanded}
        onPreviewStart={onPreviewStart}
        onPreviewEnd={onPreviewEnd}
        onExpand={onExpand}
        onCollapse={onCollapse}
        upNextVideos={upNextVideos}
        onPlayVideo={onPlayVideo}
      />
    </View>
  );
}

export default function HomeScreen() {
  const [viewMode, setViewMode] = useState<ViewMode>('rows');
  const [previewVideoId, setPreviewVideoId] = useState<string | null>(null);
  const [expandedVideoId, setExpandedVideoId] = useState<string | null>(null);
  const [drawerVisible, setDrawerVisible] = useState(false);
  const { width: windowWidth } = useWindowDimensions();

  const visibilityMap = useRef<Record<string, number>>({});
  const feedDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  const playlists = useParentStore((s) => s.playlists);
  const playlistVideoCache = useParentStore((s) => s.playlistVideoCache);

  const { channelVideos, allChannelVideos, setChannelVideos } = useChannelStore();

  // Fetch subscribed channels
  const { data: subscribedChannels = [], isLoading: channelsLoading } = useQuery({
    queryKey: ['subscribedChannels'],
    queryFn: fetchSubscribedChannels,
    staleTime: 0,
    retry: 1,
  });

  // Backend app config
  const { data: appConfig } = useQuery({
    queryKey: ['appConfig'],
    queryFn: fetchAppConfig,
    staleTime: 30_000,
    retry: 1,
  });

  // Fetch videos for each subscribed channel
  const channelVideoQueries = useQueries({
    queries: subscribedChannels.map((ch) => ({
      queryKey: ['channelVideos', ch.id],
      queryFn: async () => {
        const videos = await fetchChannelVideos(ch.id);
        setChannelVideos(ch.id, videos);
        return videos;
      },
      staleTime: 0,
      retry: 1,
    })),
  });

  // Track which channels are still fetching (for skeleton placeholders)
  const loadingChannelIds = useMemo(() => {
    const ids = new Set<string>();
    subscribedChannels.forEach((ch, i) => {
      if (channelVideoQueries[i]?.isLoading) ids.add(ch.id);
    });
    return ids;
  }, [channelVideoQueries, subscribedChannels]);

  // Build channelMap from subscribed channels
  const channelMap = useMemo(() => {
    const map: Record<string, SubscribedChannel> = {};
    subscribedChannels.forEach((c) => { map[c.id] = c; });
    return map;
  }, [subscribedChannels]);

  // Group videos by channel for Up Next
  const videosByChannel = useMemo(() => {
    const map: Record<string, Video[]> = {};
    allChannelVideos.forEach((v) => {
      if (!map[v.channelId]) map[v.channelId] = [];
      map[v.channelId].push(v);
    });
    return map;
  }, [allChannelVideos]);

  // Video lookup for playlists (channel videos + playlist cache)
  const videoMap = useMemo(() => {
    const map: Record<string, Video> = { ...playlistVideoCache };
    allChannelVideos.forEach((v) => { map[v.id] = v; });
    return map;
  }, [allChannelVideos, playlistVideoCache]);

  const channelSections: ChannelSection[] = useMemo(() => {
    const hiddenSet = new Set(appConfig?.hiddenSections ?? []);
    const titleOverrides = appConfig?.sectionTitleOverrides ?? {};

    // Build playlist sections
    const playlistMap = new Map<string, ChannelSection>();
    playlists.forEach((pl) => {
      if (hiddenSet.has(pl.id)) return;
      const plVideos = pl.videoIds
        .map((id) => videoMap[id])
        .filter(Boolean) as Video[];
      if (plVideos.length === 0) return;
      playlistMap.set(pl.id, {
        channel: {
          id: pl.id,
          title: titleOverrides[pl.id] ?? pl.title,
          thumbnailUrl: plVideos[0]?.thumbnailUrl ?? '',
          networkId: 'playlist',
        },
        videos: plVideos,
      });
    });

    // Build channel sections — include channels with no videos yet (still loading)
    const channelSectionMap = new Map<string, ChannelSection>();
    subscribedChannels.forEach((ch) => {
      if (hiddenSet.has(ch.id)) return;
      const videos = channelVideos[ch.id] ?? [];
      const title = titleOverrides[ch.id] ?? ch.title;
      channelSectionMap.set(ch.id, {
        channel: { ...ch, title },
        videos,
      });
    });

    // Unified ordering: sort all sections by appConfig.channelOrder
    const allSections: ChannelSection[] = [];
    const channelOrder = appConfig?.channelOrder ?? [];
    if (channelOrder.length > 0) {
      for (const id of channelOrder) {
        const plSection = playlistMap.get(id);
        if (plSection) { allSections.push(plSection); playlistMap.delete(id); continue; }
        const chSection = channelSectionMap.get(id);
        if (chSection) { allSections.push(chSection); channelSectionMap.delete(id); continue; }
      }
      playlistMap.forEach((s) => allSections.push(s));
      channelSectionMap.forEach((s) => allSections.push(s));
    } else {
      playlistMap.forEach((s) => allSections.push(s));
      subscribedChannels.forEach((ch) => {
        const s = channelSectionMap.get(ch.id);
        if (s) allSections.push(s);
      });
    }

    return allSections;
  }, [allChannelVideos, channelVideos, subscribedChannels, playlists, videoMap, appConfig]);

  const isLoading = channelsLoading;

  // Responsive breakpoints
  const isTablet = windowWidth >= 600;
  const isDesktop = windowWidth >= 900;

  const rowCardWidth = isDesktop ? 360 : isTablet ? 320 : 280;

  const maxFeedWidth = 600;
  const feedCardWidth = Math.max(Math.min(windowWidth - spacing.md * 2, maxFeedWidth), 200);

  const gridColumns = isDesktop ? 4 : isTablet ? 3 : 2;
  const gridGap = spacing.sm;
  const gridPadding = spacing.md;
  const gridCardWidth = Math.max(
    Math.floor((windowWidth - gridPadding * 2 - gridGap * (gridColumns - 1)) / gridColumns),
    120
  );

  const handlePreviewStart = useCallback((videoId: string) => {
    setPreviewVideoId(videoId);
  }, []);

  const handlePreviewEnd = useCallback(() => {
    if (!expandedVideoId) {
      setPreviewVideoId(null);
    }
  }, [expandedVideoId]);

  const handleExpand = useCallback((videoId: string) => {
    setPreviewVideoId(videoId);
    setExpandedVideoId(videoId);
  }, []);

  const handleCollapse = useCallback(() => {
    setExpandedVideoId(null);
    setPreviewVideoId(null);
  }, []);

  const handlePlayVideo = useCallback((_videoId: string) => {
    // Video switching is handled within the card via loadVideo()
  }, []);

  const getUpNextVideos = useCallback((video: Video) => {
    return videosByChannel[video.channelId] ?? [];
  }, [videosByChannel]);

  const handleFeedVisibilityChange = useCallback((videoId: string, ratio: number) => {
    visibilityMap.current[videoId] = ratio;

    if (feedDebounce.current) clearTimeout(feedDebounce.current);
    feedDebounce.current = setTimeout(() => {
      let bestId: string | null = null;
      let bestRatio = 0;
      for (const [id, r] of Object.entries(visibilityMap.current)) {
        if (r > bestRatio) {
          bestRatio = r;
          bestId = id;
        }
      }
      if (bestId && bestRatio >= 0.5) {
        setPreviewVideoId((prev) => {
          if (prev === bestId) return prev;
          return bestId;
        });
      } else {
        setPreviewVideoId((prev) => {
          if (expandedVideoId) return prev;
          return null;
        });
      }
    }, 150);
  }, [expandedVideoId]);

  useEffect(() => {
    if (viewMode !== 'feed') {
      visibilityMap.current = {};
      if (!expandedVideoId) {
        setPreviewVideoId(null);
      }
    }
  }, [viewMode, expandedVideoId]);

  const renderVideoCard = useCallback((video: Video, ch: any, mode: ViewMode, width: number, instanceId?: string) => {
    const id = instanceId ?? video.id;
    return (
      <HomeVideoCard
        key={id}
        video={video}
        channel={ch}
        mode={mode}
        cardWidth={width}
        instanceId={id}
        isPreview={previewVideoId === id}
        isExpanded={expandedVideoId === id}
        onPreviewStart={handlePreviewStart}
        onPreviewEnd={handlePreviewEnd}
        onExpand={handleExpand}
        onCollapse={handleCollapse}
        upNextVideos={getUpNextVideos(video)}
        onPlayVideo={handlePlayVideo}
      />
    );
  }, [previewVideoId, expandedVideoId, handlePreviewStart, handlePreviewEnd, handleExpand, handleCollapse, getUpNextVideos, handlePlayVideo]);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerRow}>
          <Pressable onPress={() => setDrawerVisible(true)} style={styles.hamburgerBtn}>
            <FontAwesome name="bars" size={20} color={colors.crtBlue} />
          </Pressable>
          <View>
            <Text style={styles.logo}>KidTubeTV</Text>
            <Text style={styles.tagline}>Classic Kids Shows</Text>
          </View>
        </View>
      </View>

      <ShowDrawer visible={drawerVisible} onClose={() => setDrawerVisible(false)} />

      {/* View Mode Switcher */}
      <View style={styles.viewSwitcher}>
        <ViewModeButton
          icon="bars"
          label="Rows"
          active={viewMode === 'rows'}
          onPress={() => setViewMode('rows')}
        />
        <ViewModeButton
          icon="th-list"
          label="Feed"
          active={viewMode === 'feed'}
          onPress={() => setViewMode('feed')}
        />
        <ViewModeButton
          icon="th-large"
          label="Grid"
          active={viewMode === 'grid'}
          onPress={() => setViewMode('grid')}
        />
      </View>

      {/* Content */}
      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator color={colors.primary} size="large" />
        </View>
      ) : subscribedChannels.length === 0 ? (
        <View style={styles.emptyContainer}>
          <FontAwesome name="television" size={48} color={colors.textSecondary} />
          <Text style={styles.emptyTitle}>No Channels Yet</Text>
          <Text style={styles.emptySubtext}>
            Go to Settings → Library to subscribe to YouTube channels.
          </Text>
        </View>
      ) : viewMode === 'rows' ? (
        <ScrollView style={styles.content}>
          {channelSections.map((section) => {
            const sectionLoading = loadingChannelIds.has(section.channel.id);
            // Hide sections that finished loading with no videos (empty/unavailable channel)
            if (section.videos.length === 0 && !sectionLoading) return null;
            return (
              <View key={section.channel.id} style={styles.channelSection}>
                <Text style={styles.channelSectionTitle}>{section.channel.title}</Text>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.rowList}
                >
                  {sectionLoading && section.videos.length === 0
                    ? Array.from({ length: 5 }, (_, i) => <SkeletonCard key={i} width={rowCardWidth} />)
                    : section.videos.map((video) =>
                        renderVideoCard(video, section.channel, 'rows', rowCardWidth, `${section.channel.id}:${video.id}`)
                      )
                  }
                </ScrollView>
              </View>
            );
          })}
        </ScrollView>
      ) : viewMode === 'feed' ? (
        <ScrollView style={styles.content} contentContainerStyle={styles.feedList}>
          <View style={styles.feedContainer}>
            {allChannelVideos.map((video) => (
              <FeedCardWrapper
                key={video.id}
                video={video}
                channel={channelMap[video.channelId] as any}
                cardWidth={feedCardWidth}
                isPreview={previewVideoId === video.id}
                isExpanded={expandedVideoId === video.id}
                onPreviewStart={handlePreviewStart}
                onPreviewEnd={handlePreviewEnd}
                onExpand={handleExpand}
                onCollapse={handleCollapse}
                upNextVideos={getUpNextVideos(video)}
                onPlayVideo={handlePlayVideo}
                onVisibilityChange={handleFeedVisibilityChange}
              />
            ))}
          </View>
        </ScrollView>
      ) : (
        <ScrollView style={styles.content} contentContainerStyle={styles.gridList}>
          <View style={[styles.gridContainer, { gap: gridGap }]}>
            {allChannelVideos.map((video) =>
              renderVideoCard(video, channelMap[video.channelId], 'grid', gridCardWidth)
            )}
          </View>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    backgroundColor: colors.dark,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  hamburgerBtn: {
    padding: spacing.sm,
    marginRight: spacing.sm,
  },
  logo: {
    color: colors.crtBlue,
    fontFamily: typography.heading.fontFamily,
    fontSize: 18,
    letterSpacing: 2,
  },
  tagline: {
    color: 'rgba(255,255,255,0.6)',
    fontFamily: typography.caption.fontFamily,
    fontSize: typography.caption.fontSize,
    marginTop: spacing.xs,
  },
  viewSwitcher: {
    flexDirection: 'row',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.background,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  viewModeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: borderRadius.sm,
    backgroundColor: colors.card,
    marginRight: spacing.sm,
  },
  viewModeBtnActive: {
    backgroundColor: colors.dark,
  },
  viewModeBtnLabel: {
    fontFamily: typography.caption.fontFamily,
    fontSize: 12,
    color: colors.textSecondary,
    marginLeft: 6,
  },
  viewModeBtnLabelActive: {
    color: colors.crtBlue,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
    gap: spacing.md,
  },
  emptyTitle: {
    fontFamily: typography.subheading.fontFamily,
    fontSize: 18,
    color: colors.textPrimary,
    textAlign: 'center',
  },
  emptySubtext: {
    fontFamily: typography.body.fontFamily,
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  content: {
    flex: 1,
  },
  channelSection: {
    paddingTop: spacing.md,
    paddingLeft: spacing.md,
  },
  channelSectionTitle: {
    fontFamily: typography.subheading.fontFamily,
    fontSize: typography.subheading.fontSize,
    color: colors.textPrimary,
    marginBottom: spacing.sm,
  },
  rowList: {
    paddingRight: spacing.md,
  },
  feedList: {
    padding: spacing.md,
    alignItems: 'center',
  },
  feedContainer: {
    maxWidth: 600,
    width: '100%',
  },
  gridList: {
    padding: spacing.md,
  },
  gridContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
});

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
import { useQuery } from '@tanstack/react-query';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { colors, spacing, typography, borderRadius } from '@src/constants/theme';
import { getChannels, getVideos } from '@src/services/content';
import { fetchLibraryVideos } from '@src/services/library';
import { fetchAppConfig } from '@src/services/config';
import { Video, Channel, Playlist, AppConfig } from '@src/types/video';
import { useParentStore } from '@src/stores/useParentStore';
import HomeVideoCard from '@src/components/HomeVideoCard';
import ShowDrawer from '@src/components/ShowDrawer';

type ViewMode = 'rows' | 'feed' | 'grid' | 'mine';

interface ChannelSection {
  channel: Channel;
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
  channel?: Channel;
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

    // Access the underlying DOM node from the RN Web View
    const node = (wrapperRef.current as any);
    // RN Web View refs expose the DOM element directly
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
      {
        // Measure how central the card is — use multiple thresholds
        threshold: [0, 0.25, 0.5, 0.75, 1.0],
      }
    );

    observer.observe(domNode);
    return () => observer.disconnect();
  }, [video.id, onVisibilityChange]);

  return (
    <View ref={wrapperRef} collapsable={false}>
      <HomeVideoCard
        video={video}
        channel={channel}
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

  // Track visibility ratios for feed cards
  const visibilityMap = useRef<Record<string, number>>({});
  const feedDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { data: channels = [] } = useQuery({
    queryKey: ['channels'],
    queryFn: () => getChannels(),
  });

  const { data: seedVideos = [], isLoading } = useQuery({
    queryKey: ['videos'],
    queryFn: () => getVideos(),
  });

  // User-added videos from Parent Admin
  const userVideos = useParentStore((s) => s.userVideos);
  const playlists = useParentStore((s) => s.playlists);

  // Backend-persisted library videos
  const { data: libraryVideos = [] } = useQuery({
    queryKey: ['libraryVideos'],
    queryFn: fetchLibraryVideos,
    staleTime: 30_000,
    retry: 1,
  });

  // Backend app config (channel order + video overrides)
  const { data: appConfig } = useQuery({
    queryKey: ['appConfig'],
    queryFn: fetchAppConfig,
    staleTime: 30_000,
    retry: 1,
  });

  // Combine seed + user + library videos, deduplicated by id, with overrides applied
  const allVideos = useMemo(() => {
    const seen = new Set<string>();
    const merged: Video[] = [];
    const overrides = appConfig?.videoOverrides ?? {};
    for (const v of [...seedVideos, ...userVideos, ...libraryVideos]) {
      if (!seen.has(v.id)) {
        seen.add(v.id);
        const override = overrides[v.id];
        if (override) {
          merged.push({ ...v, channelId: override.channelId });
        } else {
          merged.push(v);
        }
      }
    }
    return merged;
  }, [seedVideos, userVideos, libraryVideos, appConfig]);

  const channelMap = useMemo(() => {
    const map: Record<string, Channel> = {};
    channels.forEach((c) => { map[c.id] = c; });
    // Virtual channel for user-added videos (local + backend library)
    const userLibraryCount = allVideos.filter((v) => v.channelId === 'user-library').length;
    if (userLibraryCount > 0) {
      map['user-library'] = {
        id: 'user-library',
        title: 'My Videos',
        description: 'Videos added by parent',
        thumbnailUrl: '',
        networkId: 'user',
        categoryIds: [],
        ageRange: { min: 2, max: 12 },
        videoCount: userLibraryCount,
        sortOrder: -1,
        isActive: true,
        isFreebie: true,
      };
    }
    return map;
  }, [channels, allVideos]);

  // Group videos by channel for Up Next
  const videosByChannel = useMemo(() => {
    const map: Record<string, Video[]> = {};
    allVideos.forEach((v) => {
      if (!map[v.channelId]) map[v.channelId] = [];
      map[v.channelId].push(v);
    });
    return map;
  }, [allVideos]);

  // Video lookup map for playlists
  const videoMap = useMemo(() => {
    const map: Record<string, Video> = {};
    allVideos.forEach((v) => { map[v.id] = v; });
    return map;
  }, [allVideos]);

  const channelSections: ChannelSection[] = useMemo(() => {
    const grouped: Record<string, Video[]> = {};
    allVideos.forEach((v) => {
      if (!grouped[v.channelId]) grouped[v.channelId] = [];
      grouped[v.channelId].push(v);
    });

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
          title: pl.title,
          description: `Playlist · ${plVideos.length} videos`,
          thumbnailUrl: plVideos[0]?.thumbnailUrl ?? '',
          networkId: 'playlist',
          categoryIds: [],
          ageRange: { min: 2, max: 12 },
          videoCount: plVideos.length,
          sortOrder: pl.sortOrder,
          isActive: true,
          isFreebie: true,
        },
        videos: plVideos,
      });
    });

    // Build channel sections
    const channelSectionMap = new Map<string, ChannelSection>();
    const allChs: Channel[] = [...channels.filter((c) => grouped[c.id] && grouped[c.id].length > 0 && !hiddenSet.has(c.id))];
    if (grouped['user-library'] && grouped['user-library'].length > 0 && channelMap['user-library'] && !hiddenSet.has('user-library')) {
      allChs.push(channelMap['user-library']);
    }
    allChs.forEach((c) => {
      const title = titleOverrides[c.id] ?? c.title;
      channelSectionMap.set(c.id, { channel: { ...c, title }, videos: grouped[c.id] });
    });

    // Unified ordering: sort all sections by appConfig.channelOrder
    const allSections: ChannelSection[] = [];
    const channelOrder = appConfig?.channelOrder ?? [];
    if (channelOrder.length > 0) {
      // First: items in channelOrder, in order
      for (const id of channelOrder) {
        const plSection = playlistMap.get(id);
        if (plSection) { allSections.push(plSection); playlistMap.delete(id); continue; }
        const chSection = channelSectionMap.get(id);
        if (chSection) { allSections.push(chSection); channelSectionMap.delete(id); continue; }
      }
      // Then: remaining playlists
      playlistMap.forEach((s) => allSections.push(s));
      // Then: remaining channels
      channelSectionMap.forEach((s) => allSections.push(s));
    } else {
      // Default: playlists first, then channels by sortOrder
      playlistMap.forEach((s) => allSections.push(s));
      allChs.forEach((c) => {
        const s = channelSectionMap.get(c.id);
        if (s) allSections.push(s);
      });
    }

    return allSections;
  }, [allVideos, channels, channelMap, playlists, videoMap, appConfig]);

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

  // Feed mode: pick the most-visible card as the preview
  const handleFeedVisibilityChange = useCallback((videoId: string, ratio: number) => {
    visibilityMap.current[videoId] = ratio;

    // Debounce to avoid rapid switching
    if (feedDebounce.current) clearTimeout(feedDebounce.current);
    feedDebounce.current = setTimeout(() => {
      // Find the video with the highest intersection ratio
      let bestId: string | null = null;
      let bestRatio = 0;
      for (const [id, r] of Object.entries(visibilityMap.current)) {
        if (r > bestRatio) {
          bestRatio = r;
          bestId = id;
        }
      }
      // Only autoplay if at least 50% visible
      if (bestId && bestRatio >= 0.5) {
        setPreviewVideoId((prev) => {
          if (prev === bestId) return prev;
          return bestId;
        });
      } else {
        setPreviewVideoId((prev) => {
          // Don't clear if something is expanded
          if (expandedVideoId) return prev;
          return null;
        });
      }
    }, 150);
  }, [expandedVideoId]);

  // Clear feed visibility tracking when leaving feed mode
  useEffect(() => {
    if (viewMode !== 'feed') {
      visibilityMap.current = {};
      if (!expandedVideoId) {
        setPreviewVideoId(null);
      }
    }
  }, [viewMode, expandedVideoId]);

  const renderVideoCard = useCallback((video: Video, ch: Channel | undefined, mode: ViewMode, width: number, instanceId?: string) => {
    const id = instanceId ?? video.id;
    return (
      <HomeVideoCard
        key={id}
        video={video}
        channel={ch}
        mode={mode === 'mine' ? 'grid' : mode}
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
        {allVideos.some((v) => v.channelId === 'user-library') && (
          <ViewModeButton
            icon="star"
            label="My Videos"
            active={viewMode === 'mine'}
            onPress={() => setViewMode('mine')}
          />
        )}
      </View>

      {/* Content */}
      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator color={colors.primary} size="large" />
        </View>
      ) : viewMode === 'rows' ? (
        <ScrollView style={styles.content}>
          {channelSections.map((section) => (
            <View key={section.channel.id} style={styles.channelSection}>
              <Text style={styles.channelSectionTitle}>{section.channel.title}</Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.rowList}
              >
                {section.videos.map((video) =>
                  renderVideoCard(video, section.channel, 'rows', rowCardWidth, `${section.channel.id}:${video.id}`)
                )}
              </ScrollView>
            </View>
          ))}
        </ScrollView>
      ) : viewMode === 'feed' ? (
        <ScrollView style={styles.content} contentContainerStyle={styles.feedList}>
          <View style={styles.feedContainer}>
            {seedVideos.map((video) => (
              <FeedCardWrapper
                key={video.id}
                video={video}
                channel={channelMap[video.channelId]}
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
      ) : viewMode === 'mine' ? (
        <ScrollView style={styles.content} contentContainerStyle={styles.gridList}>
          <View style={[styles.gridContainer, { gap: gridGap }]}>
            {allVideos
              .filter((v) => v.channelId === 'user-library')
              .map((video) =>
                renderVideoCard(video, channelMap[video.channelId], 'grid', gridCardWidth)
              )}
          </View>
        </ScrollView>
      ) : (
        <ScrollView style={styles.content} contentContainerStyle={styles.gridList}>
          <View style={[styles.gridContainer, { gap: gridGap }]}>
            {seedVideos.map((video) =>
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

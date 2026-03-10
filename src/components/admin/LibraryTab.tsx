import { useState, useCallback, useMemo, useRef } from 'react';
import {
  StyleSheet,
  ScrollView,
  View,
  Text,
  TextInput,
  Pressable,
  Alert,
  ActivityIndicator,
  Image,
  Platform,
  Modal,
} from 'react-native';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { colors, spacing, borderRadius, typography, shadows } from '@src/constants/theme';
import { useParentStore } from '@src/stores/useParentStore';
import { useChannelStore } from '@src/stores/useChannelStore';
import { searchYouTube, YouTubeSearchResult } from '@src/utils/youtube';
import {
  fetchSubscribedChannels,
  resolveChannel,
  subscribeToChannel,
  unsubscribeFromChannel,
} from '@src/services/channelSubscriptions';
import { fetchAppConfig, saveAppConfig } from '@src/services/config';
import { Video, SubscribedChannel, ChannelSearchResult, Playlist, AppConfig } from '@src/types/video';
import { formatDuration } from '@src/utils/format';
import { useResponsive } from '@src/hooks/useResponsive';
import YouTubePlayer, { YouTubePlayerHandle } from '@src/components/YouTubePlayer';
import DraggableList from './DraggableList';

type ViewState = 'main' | 'editor';

interface SectionItem {
  type: 'playlist' | 'channel';
  id: string;
  title: string;
  videoCount: number;
  thumbnailUrl: string;
  hidden: boolean;
}

interface EditingSection {
  type: 'playlist' | 'channel';
  id: string;
}

export default function LibraryTab() {
  const queryClient = useQueryClient();

  // ── View state ──
  const [view, setView] = useState<ViewState>('main');
  const [editingSection, setEditingSection] = useState<EditingSection | null>(null);

  // ── Add Channel state ──
  const [channelInput, setChannelInput] = useState('');
  const [isResolving, setIsResolving] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);
  const [addSuccess, setAddSuccess] = useState<string | null>(null);
  const [channelResults, setChannelResults] = useState<ChannelSearchResult[]>([]);
  const [subscribingIds, setSubscribingIds] = useState<Set<string>>(new Set());

  // ── Sections manager state ──
  const [newPlaylistTitle, setNewPlaylistTitle] = useState('');
  const [savingOrder, setSavingOrder] = useState(false);
  const [orderSaveError, setOrderSaveError] = useState<string | null>(null);
  const [orderSaveSuccess, setOrderSaveSuccess] = useState(false);

  // ── Editor state ──
  const [previewVideoId, setPreviewVideoId] = useState<string | null>(null);
  const [editingStartTimeId, setEditingStartTimeId] = useState<string | null>(null);
  const [startTimeInput, setStartTimeInput] = useState('');
  const playerRef = useRef<YouTubePlayerHandle>(null);

  // ── Add Videos modal (playlists) ──
  const [showAddVideos, setShowAddVideos] = useState(false);
  const [modalYtSearchQuery, setModalYtSearchQuery] = useState('');
  const [modalYtResults, setModalYtResults] = useState<YouTubeSearchResult[]>([]);
  const [modalYtSearching, setModalYtSearching] = useState(false);
  const [modalYtSearchError, setModalYtSearchError] = useState<string | null>(null);
  const [modalAddingVideoIds, setModalAddingVideoIds] = useState<Set<string>>(new Set());
  const [modalPreviewResult, setModalPreviewResult] = useState<YouTubeSearchResult | null>(null);
  const modalPlayerRef = useRef<YouTubePlayerHandle>(null);

  const { fontScale, thumbScale, spacingScale, windowWidth, windowHeight } = useResponsive();
  const scaled = useMemo(() => ({
    thumbW: Math.round(80 * thumbScale),
    thumbH: Math.round(45 * thumbScale),
    sectionThumbW: Math.round(48 * thumbScale),
    sectionThumbH: Math.round(27 * thumbScale),
    editorThumbW: Math.round(60 * thumbScale),
    editorThumbH: Math.round(34 * thumbScale),
    modalThumbW: Math.round(80 * thumbScale),
    modalThumbH: Math.round(45 * thumbScale),
    channelThumbW: Math.round(40 * thumbScale),
    channelThumbH: Math.round(40 * thumbScale),
    titleFont: Math.round(16 * fontScale),
    bodyFont: Math.round(13 * fontScale),
    metaFont: Math.round(11 * fontScale),
    smallFont: Math.round(10 * fontScale),
    labelFont: Math.round(12 * fontScale),
    inputHeight: Math.round(44 * spacingScale),
    searchHeight: Math.round(40 * spacingScale),
    pad: Math.round(spacing.md * spacingScale),
    iconSize: Math.round(18 * fontScale),
    sectionDescFont: Math.round(13 * fontScale),
  }), [fontScale, thumbScale, spacingScale]);

  // ── Store ──
  const playlists = useParentStore((s) => s.playlists);
  const playlistVideoCache = useParentStore((s) => s.playlistVideoCache);
  const setPlaylistVideo = useParentStore((s) => s.setPlaylistVideo);
  const createPlaylist = useParentStore((s) => s.createPlaylist);
  const updatePlaylistTitle = useParentStore((s) => s.updatePlaylistTitle);
  const deletePlaylist = useParentStore((s) => s.deletePlaylist);
  const addVideoToPlaylist = useParentStore((s) => s.addVideoToPlaylist);
  const removeVideoFromPlaylist = useParentStore((s) => s.removeVideoFromPlaylist);
  const reorderPlaylistVideos = useParentStore((s) => s.reorderPlaylistVideos);
  const videoStartTimes = useParentStore((s) => s.videoStartTimes);
  const setVideoStartTime = useParentStore((s) => s.setVideoStartTime);
  const clearVideoStartTime = useParentStore((s) => s.clearVideoStartTime);

  const channelVideosMap = useChannelStore((s) => s.channelVideos);

  // ── Queries ──
  const { data: subscribedChannels = [] } = useQuery({
    queryKey: ['subscribedChannels'],
    queryFn: fetchSubscribedChannels,
    staleTime: 0,
    retry: 1,
  });

  const { data: appConfig } = useQuery({
    queryKey: ['appConfig'],
    queryFn: fetchAppConfig,
    staleTime: 30_000,
    retry: 1,
  });

  // All videos: channel store videos + playlist cache
  const allVideos = useMemo(() => {
    const map: Record<string, Video> = { ...playlistVideoCache };
    Object.values(channelVideosMap).flat().forEach((v) => { map[v.id] = v; });
    return Object.values(map);
  }, [channelVideosMap, playlistVideoCache]);

  const videoMap = useMemo(() => {
    const map: Record<string, Video> = {};
    allVideos.forEach((v) => { map[v.id] = v; });
    return map;
  }, [allVideos]);

  const channelMap = useMemo(() => {
    const map: Record<string, SubscribedChannel> = {};
    subscribedChannels.forEach((c) => { map[c.id] = c; });
    return map;
  }, [subscribedChannels]);

  // ── Unified sections: playlists + subscribed channels in appConfig.channelOrder ──
  const hiddenSet = useMemo(() => new Set(appConfig?.hiddenSections ?? []), [appConfig]);
  const titleOverrides = useMemo(() => appConfig?.sectionTitleOverrides ?? {}, [appConfig]);

  const orderedSections: SectionItem[] = useMemo(() => {
    // Build playlist items
    const plItems: SectionItem[] = playlists.map((pl) => {
      const videos = pl.videoIds.map((id) => videoMap[id]).filter(Boolean);
      return {
        type: 'playlist' as const,
        id: pl.id,
        title: titleOverrides[pl.id] ?? pl.title,
        videoCount: videos.length,
        thumbnailUrl: videos[0]?.thumbnailUrl ?? '',
        hidden: hiddenSet.has(pl.id),
      };
    });

    // Build channel items from subscribed channels
    const chItems: SectionItem[] = subscribedChannels.map((ch) => {
      const videos = channelVideosMap[ch.id] ?? [];
      return {
        type: 'channel' as const,
        id: ch.id,
        title: titleOverrides[ch.id] ?? ch.title,
        videoCount: videos.length,
        thumbnailUrl: ch.thumbnailUrl,
        hidden: hiddenSet.has(ch.id),
      };
    });

    const all = [...plItems, ...chItems];
    const order = appConfig?.channelOrder ?? [];
    if (order.length > 0) {
      const orderMap = new Map(order.map((id, i) => [id, i]));
      all.sort((a, b) => {
        const ai = orderMap.has(a.id) ? orderMap.get(a.id)! : (a.type === 'playlist' ? -1000 : 999);
        const bi = orderMap.has(b.id) ? orderMap.get(b.id)! : (b.type === 'playlist' ? -1000 : 999);
        return ai - bi;
      });
    } else {
      all.sort((a, b) => {
        if (a.type !== b.type) return a.type === 'playlist' ? -1 : 1;
        return 0;
      });
    }
    return all;
  }, [playlists, subscribedChannels, channelVideosMap, videoMap, appConfig, hiddenSet, titleOverrides]);

  // ── Editor videos ──
  const editorVideos = useMemo(() => {
    if (!editingSection) return [];
    if (editingSection.type === 'playlist') {
      const pl = playlists.find((p) => p.id === editingSection.id);
      if (!pl) return [];
      return pl.videoIds.map((id) => videoMap[id]).filter(Boolean) as Video[];
    }
    // Channel: from channel store (read-only)
    return channelVideosMap[editingSection.id] ?? [];
  }, [editingSection, playlists, channelVideosMap, videoMap]);

  const editingPlaylist = useMemo(() => {
    if (!editingSection || editingSection.type !== 'playlist') return null;
    return playlists.find((p) => p.id === editingSection.id) ?? null;
  }, [editingSection, playlists]);

  // ── Add Channel handler ──
  const handleAddChannel = useCallback(async () => {
    setAddError(null);
    setAddSuccess(null);
    setChannelResults([]);
    const trimmed = channelInput.trim();
    if (!trimmed) return;

    setIsResolving(true);
    try {
      const result = await resolveChannel(trimmed);
      if (result.type === 'results') {
        setChannelResults(result.results);
        if (result.results.length === 0) {
          setAddError('No channels found. Try a different search term.');
        }
      } else {
        // Direct subscribe success
        setChannelInput('');
        setAddSuccess(`Subscribed to "${result.channel.title}"`);
        setTimeout(() => setAddSuccess(null), 3000);
        // Add to channelOrder in appConfig
        const currentOrder = appConfig?.channelOrder ?? [];
        if (!currentOrder.includes(result.channel.id)) {
          await saveAppConfig({
            channelOrder: [...currentOrder, result.channel.id],
            videoOverrides: appConfig?.videoOverrides ?? {},
            sectionTitleOverrides: appConfig?.sectionTitleOverrides ?? {},
            hiddenSections: appConfig?.hiddenSections ?? [],
          }).catch(() => {});
        }
        await queryClient.invalidateQueries({ queryKey: ['subscribedChannels'] });
        await queryClient.invalidateQueries({ queryKey: ['appConfig'] });
      }
    } catch (err: any) {
      setAddError(err?.message ?? 'Something went wrong. Please try again.');
    }
    setIsResolving(false);
  }, [channelInput, appConfig, queryClient]);

  const handleSubscribeToResult = useCallback(async (result: ChannelSearchResult) => {
    setSubscribingIds((prev) => new Set(prev).add(result.channelId));
    try {
      const channel = await subscribeToChannel(result.channelId);
      setAddSuccess(`Subscribed to "${channel.title}"`);
      setTimeout(() => setAddSuccess(null), 3000);
      // Add to channelOrder
      const currentOrder = appConfig?.channelOrder ?? [];
      if (!currentOrder.includes(channel.id)) {
        await saveAppConfig({
          channelOrder: [...currentOrder, channel.id],
          videoOverrides: appConfig?.videoOverrides ?? {},
          sectionTitleOverrides: appConfig?.sectionTitleOverrides ?? {},
          hiddenSections: appConfig?.hiddenSections ?? [],
        }).catch(() => {});
      }
      await queryClient.invalidateQueries({ queryKey: ['subscribedChannels'] });
      await queryClient.invalidateQueries({ queryKey: ['appConfig'] });
      setChannelResults([]);
      setChannelInput('');
    } catch (err: any) {
      setAddError(err?.message ?? 'Failed to subscribe.');
    }
  }, [appConfig, queryClient]);

  // ── Section reorder handler ──
  const handleSectionReorder = useCallback(async (fromIndex: number, toIndex: number) => {
    const ids = orderedSections.map((s) => s.id);
    const [moved] = ids.splice(fromIndex, 1);
    ids.splice(toIndex, 0, moved);
    setSavingOrder(true);
    setOrderSaveError(null);
    try {
      await saveAppConfig({
        channelOrder: ids,
        videoOverrides: appConfig?.videoOverrides ?? {},
        sectionTitleOverrides: appConfig?.sectionTitleOverrides ?? {},
        hiddenSections: appConfig?.hiddenSections ?? [],
      });
      await queryClient.invalidateQueries({ queryKey: ['appConfig'] });
      setOrderSaveSuccess(true);
      setTimeout(() => setOrderSaveSuccess(false), 2000);
    } catch (err: any) {
      setOrderSaveError(err?.message ?? 'Failed to save order.');
    }
    setSavingOrder(false);
  }, [orderedSections, appConfig, queryClient]);

  // ── Time formatting helpers ──
  const formatTime = useCallback((seconds: number): string => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    return `${m}:${String(s).padStart(2, '0')}`;
  }, []);

  const parseTime = useCallback((input: string): number | null => {
    const trimmed = input.trim();
    if (!trimmed) return null;
    if (/^\d+$/.test(trimmed)) return parseInt(trimmed, 10);
    const parts = trimmed.split(':').map(Number);
    if (parts.some(isNaN)) return null;
    if (parts.length === 2) return parts[0] * 60 + parts[1];
    if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
    return null;
  }, []);

  const handleSaveStartTime = useCallback((videoId: string) => {
    const seconds = parseTime(startTimeInput);
    if (seconds !== null && seconds > 0) {
      setVideoStartTime(videoId, seconds);
    } else {
      clearVideoStartTime(videoId);
    }
    setEditingStartTimeId(null);
    setStartTimeInput('');
  }, [startTimeInput, parseTime, setVideoStartTime, clearVideoStartTime]);

  // ── Playlist handlers ──
  const handleCreatePlaylist = useCallback(() => {
    const title = newPlaylistTitle.trim();
    if (!title) return;
    createPlaylist(title);
    setNewPlaylistTitle('');
  }, [newPlaylistTitle, createPlaylist]);

  const handleDeleteSection = useCallback(
    (section: SectionItem) => {
      if (section.type === 'playlist') {
        const doDelete = () => {
          deletePlaylist(section.id);
          if (editingSection?.id === section.id) {
            setView('main');
            setEditingSection(null);
          }
        };
        if (Platform.OS === 'web') {
          if (window.confirm('Delete this playlist?')) doDelete();
        } else {
          Alert.alert('Delete Playlist', 'Delete this playlist?', [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Delete', style: 'destructive', onPress: doDelete },
          ]);
        }
      } else {
        // Channel: unsubscribe + remove from channelOrder
        const doDelete = async () => {
          try {
            await unsubscribeFromChannel(section.id);
            const channelOrder = (appConfig?.channelOrder ?? []).filter((id) => id !== section.id);
            const hiddenSections = (appConfig?.hiddenSections ?? []).filter((id) => id !== section.id);
            await saveAppConfig({
              channelOrder,
              videoOverrides: appConfig?.videoOverrides ?? {},
              sectionTitleOverrides: appConfig?.sectionTitleOverrides ?? {},
              hiddenSections,
            });
            await queryClient.invalidateQueries({ queryKey: ['subscribedChannels'] });
            await queryClient.invalidateQueries({ queryKey: ['appConfig'] });
          } catch {}
          if (editingSection?.id === section.id) {
            setView('main');
            setEditingSection(null);
          }
        };
        if (Platform.OS === 'web') {
          if (window.confirm(`Unsubscribe from "${section.title}"? Videos will be removed from the home screen.`)) doDelete();
        } else {
          Alert.alert('Unsubscribe', `Unsubscribe from "${section.title}"?`, [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Unsubscribe', style: 'destructive', onPress: doDelete },
          ]);
        }
      }
    },
    [deletePlaylist, editingSection, appConfig, queryClient]
  );

  const handleUnhideSection = useCallback(
    async (sectionId: string) => {
      const hidden = (appConfig?.hiddenSections ?? []).filter((id) => id !== sectionId);
      try {
        await saveAppConfig({
          channelOrder: appConfig?.channelOrder ?? [],
          videoOverrides: appConfig?.videoOverrides ?? {},
          sectionTitleOverrides: appConfig?.sectionTitleOverrides ?? {},
          hiddenSections: hidden,
        });
        await queryClient.invalidateQueries({ queryKey: ['appConfig'] });
      } catch {}
    },
    [appConfig, queryClient]
  );

  const handleRenameSectionTitle = useCallback(
    async (sectionId: string, newTitle: string) => {
      const overrides = { ...(appConfig?.sectionTitleOverrides ?? {}) };
      if (newTitle.trim()) {
        overrides[sectionId] = newTitle.trim();
      } else {
        delete overrides[sectionId];
      }
      try {
        await saveAppConfig({
          channelOrder: appConfig?.channelOrder ?? [],
          videoOverrides: appConfig?.videoOverrides ?? {},
          sectionTitleOverrides: overrides,
          hiddenSections: appConfig?.hiddenSections ?? [],
        });
        await queryClient.invalidateQueries({ queryKey: ['appConfig'] });
      } catch {}
    },
    [appConfig, queryClient]
  );

  const handleEditSection = useCallback((section: SectionItem) => {
    setEditingSection({ type: section.type, id: section.id });
    setPreviewVideoId(null);
    setEditingStartTimeId(null);
    setView('editor');
  }, []);

  const handleBackToMain = useCallback(() => {
    setView('main');
    setEditingSection(null);
    setPreviewVideoId(null);
    setEditingStartTimeId(null);
  }, []);

  // ── Modal: YouTube search and add to playlist ──
  const handleModalYouTubeSearch = useCallback(async () => {
    const q = modalYtSearchQuery.trim();
    if (!q) return;
    setModalYtSearching(true);
    setModalYtSearchError(null);
    try {
      const results = await searchYouTube(q);
      setModalYtResults(results);
      if (results.length === 0) {
        setModalYtSearchError('No results found. Try a different search term.');
      }
    } catch (err: any) {
      setModalYtSearchError(err?.message ?? 'Search failed. Please try again.');
    }
    setModalYtSearching(false);
  }, [modalYtSearchQuery]);

  const handleModalAddYouTubeResult = useCallback(
    (result: YouTubeSearchResult) => {
      if (!editingSection || editingSection.type !== 'playlist' || !editingPlaylist) return;
      const videoId = `yt-${result.videoId}`;

      // Store video metadata in playlist cache
      const newVideo: Video = {
        id: videoId,
        title: result.title,
        description: '',
        source: 'youtube',
        youtubeVideoId: result.videoId,
        thumbnailUrl: `https://img.youtube.com/vi/${result.videoId}/mqdefault.jpg`,
        duration: result.duration,
        channelId: 'playlist-cache',
        networkId: 'youtube',
        categoryIds: [],
        tags: [],
        ageRange: { min: 2, max: 12 },
        viewCount: result.viewCount || undefined,
        sortOrder: 0,
        isActive: true,
        isFreebie: true,
      };

      setPlaylistVideo(videoId, newVideo);
      addVideoToPlaylist(editingPlaylist.id, videoId);
      setModalAddingVideoIds((prev) => new Set(prev).add(result.videoId));
    },
    [editingSection, editingPlaylist, setPlaylistVideo, addVideoToPlaylist]
  );

  const isModalYtResultInPlaylist = useCallback(
    (ytVideoId: string) => {
      if (!editingPlaylist) return false;
      if (modalAddingVideoIds.has(ytVideoId)) return true;
      const videoId = `yt-${ytVideoId}`;
      return editingPlaylist.videoIds.includes(videoId);
    },
    [editingPlaylist, modalAddingVideoIds]
  );

  const playerWidth = Math.min(windowWidth - scaled.pad * 4 - 2, 600);

  // ── EDITOR VIEW ──
  if (view === 'editor' && editingSection) {
    const isPlaylist = editingSection.type === 'playlist';
    const sectionTitle = isPlaylist
      ? editingPlaylist?.title ?? ''
      : (channelMap[editingSection.id]?.title ?? editingSection.id);

    return (
      <ScrollView style={styles.content} contentContainerStyle={styles.contentInner}>
        {/* Back button */}
        <Pressable style={styles.backBtn} onPress={handleBackToMain}>
          <FontAwesome name="arrow-left" size={14} color={colors.crtBlue} />
          <Text style={styles.backBtnText}>Back to Library</Text>
        </Pressable>

        {/* Title */}
        <View style={styles.section}>
          <Text style={[styles.fieldLabel, { fontSize: scaled.labelFont }]}>Title</Text>
          {isPlaylist ? (
            <TextInput
              style={[styles.titleInput, { height: scaled.inputHeight, fontSize: scaled.titleFont }]}
              value={editingPlaylist?.title ?? ''}
              onChangeText={(text) => {
                if (editingPlaylist) updatePlaylistTitle(editingPlaylist.id, text);
              }}
              placeholder="Playlist title..."
              placeholderTextColor={colors.textSecondary}
            />
          ) : (
            <TextInput
              style={[styles.titleInput, { height: scaled.inputHeight, fontSize: scaled.titleFont }]}
              value={titleOverrides[editingSection.id] ?? (channelMap[editingSection.id]?.title ?? editingSection.id)}
              onChangeText={(text) => handleRenameSectionTitle(editingSection.id, text)}
              placeholder="Section title..."
              placeholderTextColor={colors.textSecondary}
            />
          )}

          <Pressable
            style={styles.deleteBtn}
            onPress={() => {
              const s = orderedSections.find((s) => s.id === editingSection.id);
              if (s) handleDeleteSection(s);
            }}
          >
            <FontAwesome name="trash" size={12} color={colors.vhsRed} />
            <Text style={styles.deleteBtnText}>
              {isPlaylist ? 'Delete Playlist' : 'Unsubscribe Channel'}
            </Text>
          </Pressable>
        </View>

        {/* Videos */}
        <View style={styles.section}>
          <View style={styles.editorHeader}>
            <Text style={[styles.sectionTitle, { fontSize: scaled.titleFont }]}>
              Videos ({editorVideos.length})
            </Text>
            {isPlaylist && (
              <Pressable
                style={styles.addVideosBtn}
                onPress={() => {
                  setModalYtSearchQuery('');
                  setModalYtResults([]);
                  setModalYtSearchError(null);
                  setModalAddingVideoIds(new Set());
                  setModalPreviewResult(null);
                  setShowAddVideos(true);
                }}
              >
                <FontAwesome name="plus" size={12} color="#fff" />
                <Text style={styles.addVideosBtnText}>Add Videos</Text>
              </Pressable>
            )}
          </View>

          {editorVideos.length === 0 ? (
            <Text style={styles.emptySubtext}>
              {isPlaylist
                ? 'No videos yet. Tap "Add Videos" to get started.'
                : 'Videos are loading from YouTube...'}
            </Text>
          ) : isPlaylist ? (
            <DraggableList
              items={editorVideos}
              keyExtractor={(v) => v.id}
              onReorder={(from, to) => {
                if (editingPlaylist) reorderPlaylistVideos(editingPlaylist.id, from, to);
              }}
              renderItem={(video, index) => renderEditorVideoItem(video, index, true)}
            />
          ) : (
            editorVideos.map((video, index) => renderEditorVideoItem(video, index, false))
          )}
        </View>

        <View style={styles.bottomSpacer} />

        {/* Add Videos Modal (playlists only) */}
        {renderAddVideosModal()}
      </ScrollView>
    );
  }

  // Helper to render a video item in editor view
  function renderEditorVideoItem(video: Video, index: number, isPlaylistEditor: boolean) {
    const isPreview = previewVideoId === video.id;
    const currentStartTime = videoStartTimes[video.id];
    const isEditingStart = editingStartTimeId === video.id;
    const editorPlayerWidth = Math.min(windowWidth - scaled.pad * 4 - 2, 600);

    return (
      <View key={video.id}>
        <Pressable
          style={[styles.editorVideoItem, isPreview && styles.editorVideoItemActive]}
          onPress={() => {
            if (isPreview) {
              setPreviewVideoId(null);
              setEditingStartTimeId(null);
            } else {
              setPreviewVideoId(video.id);
              setEditingStartTimeId(null);
            }
          }}
        >
          <Text style={[styles.videoNumber, { fontSize: scaled.labelFont }]}>{index + 1}.</Text>
          <Image
            source={{ uri: video.thumbnailUrl }}
            style={[styles.videoThumb, { width: scaled.editorThumbW, height: scaled.editorThumbH }]}
          />
          <View style={styles.editorVideoMeta}>
            <Text style={[styles.editorVideoTitle, { fontSize: scaled.bodyFont }]} numberOfLines={1}>
              {video.title}
            </Text>
            <Text style={[styles.editorVideoSubtitle, { fontSize: scaled.smallFont }]} numberOfLines={1}>
              {[
                video.duration > 0 ? formatDuration(video.duration) : null,
                video.viewCount,
                currentStartTime ? `Starts ${formatTime(currentStartTime)}` : null,
              ].filter(Boolean).join(' · ')}
            </Text>
          </View>
          {isPlaylistEditor ? (
            <View style={styles.editorVideoActions}>
              {isPreview && (
                <FontAwesome name="chevron-up" size={12} color={colors.crtBlue} style={{ marginRight: spacing.xs }} />
              )}
              <Pressable
                style={styles.removeBtn}
                onPress={(e) => {
                  e.stopPropagation();
                  if (editingPlaylist) removeVideoFromPlaylist(editingPlaylist.id, video.id);
                }}
                hitSlop={4}
              >
                <FontAwesome name="times" size={14} color={colors.textSecondary} />
              </Pressable>
            </View>
          ) : isPreview ? (
            <FontAwesome name="chevron-up" size={12} color={colors.crtBlue} />
          ) : null}
        </Pressable>

        {/* Inline preview + start time */}
        {isPreview && video.youtubeVideoId && (
          <View style={styles.editorInlinePreview}>
            <View style={styles.inlinePlayer}>
              <YouTubePlayer
                ref={playerRef}
                videoId={video.youtubeVideoId}
                width={editorPlayerWidth}
                height={Math.round(editorPlayerWidth * 9 / 16)}
                play
                mute={false}
                startTime={currentStartTime}
              />
            </View>
            <View style={styles.editorPreviewBar}>
              {isEditingStart ? (
                <View style={styles.startTimeRow}>
                  <Text style={styles.startTimeLabel}>Start at:</Text>
                  <TextInput
                    style={styles.startTimeInput}
                    value={startTimeInput}
                    onChangeText={setStartTimeInput}
                    placeholder="0:00"
                    placeholderTextColor={colors.textSecondary}
                    keyboardType="numbers-and-punctuation"
                    autoFocus
                    onSubmitEditing={() => handleSaveStartTime(video.id)}
                  />
                  <Pressable
                    style={styles.startTimeSaveBtn}
                    onPress={() => handleSaveStartTime(video.id)}
                  >
                    <Text style={styles.startTimeSaveBtnText}>Save</Text>
                  </Pressable>
                  <Pressable
                    style={styles.startTimeCancelBtn}
                    onPress={() => { setEditingStartTimeId(null); setStartTimeInput(''); }}
                  >
                    <FontAwesome name="times" size={12} color={colors.textSecondary} />
                  </Pressable>
                </View>
              ) : (
                <Pressable
                  style={styles.startTimeBtn}
                  onPress={() => {
                    setEditingStartTimeId(video.id);
                    setStartTimeInput(currentStartTime ? formatTime(currentStartTime) : '');
                  }}
                >
                  <FontAwesome name="clock-o" size={12} color={colors.crtBlue} />
                  <Text style={styles.startTimeBtnText}>
                    {currentStartTime ? `Start: ${formatTime(currentStartTime)}` : 'Set Start Time'}
                  </Text>
                </Pressable>
              )}
              <View style={styles.editorPreviewBtns}>
                {isPlaylistEditor && (
                  <Pressable
                    style={styles.editorRemoveBtn}
                    onPress={() => {
                      if (editingPlaylist) {
                        removeVideoFromPlaylist(editingPlaylist.id, video.id);
                        setPreviewVideoId(null);
                      }
                    }}
                  >
                    <FontAwesome name="times" size={12} color={colors.textSecondary} />
                    <Text style={styles.editorRemoveBtnText}>Remove</Text>
                  </Pressable>
                )}
                <Pressable
                  style={styles.previewCloseBtn}
                  onPress={() => { setPreviewVideoId(null); setEditingStartTimeId(null); }}
                >
                  <Text style={styles.previewCloseBtnText}>Close</Text>
                  <FontAwesome name="chevron-up" size={10} color={colors.textSecondary} />
                </Pressable>
              </View>
            </View>
          </View>
        )}
      </View>
    );
  }

  // ── Add Videos Modal (YouTube only) ──
  function renderAddVideosModal() {
    if (!editingSection) return null;
    const modalSectionTitle = editingPlaylist?.title ?? editingSection.id;
    const inlinePlayerWidth = Math.min(windowWidth * 0.95 - scaled.pad * 2 - spacing.xs * 2 - 2, 856);

    return (
      <Modal
        visible={showAddVideos}
        transparent
        animationType="slide"
        onRequestClose={() => setShowAddVideos(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { width: Math.min(windowWidth * 0.95, 900), maxHeight: windowHeight * 0.92 }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { fontSize: scaled.titleFont }]} numberOfLines={1}>
                Add Videos to "{modalSectionTitle}"
              </Text>
              <Pressable
                style={styles.modalCloseBtn}
                onPress={() => {
                  setShowAddVideos(false);
                  setModalAddingVideoIds(new Set());
                  setModalPreviewResult(null);
                }}
              >
                <FontAwesome name="times" size={16} color={colors.textSecondary} />
              </Pressable>
            </View>

            <View style={styles.ytContent}>
              <View style={styles.ytSearchRow}>
                <TextInput
                  style={[styles.ytSearchInput, { height: scaled.searchHeight }]}
                  value={modalYtSearchQuery}
                  onChangeText={setModalYtSearchQuery}
                  placeholder="Search YouTube..."
                  placeholderTextColor={colors.textSecondary}
                  onSubmitEditing={handleModalYouTubeSearch}
                  returnKeyType="search"
                />
                <Pressable
                  style={[styles.ytSearchBtn, { width: scaled.searchHeight, height: scaled.searchHeight }, (!modalYtSearchQuery.trim() || modalYtSearching) && styles.ytSearchBtnDisabled]}
                  onPress={handleModalYouTubeSearch}
                  disabled={!modalYtSearchQuery.trim() || modalYtSearching}
                >
                  {modalYtSearching ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <FontAwesome name="search" size={14} color="#fff" />
                  )}
                </Pressable>
              </View>

              {modalYtSearchError && (
                <Text style={styles.ytSearchError}>{modalYtSearchError}</Text>
              )}

              <ScrollView style={styles.modalScroll}>
                {modalYtResults.map((result) => {
                  const alreadyIn = isModalYtResultInPlaylist(result.videoId);
                  const isActive = modalPreviewResult?.videoId === result.videoId;
                  const durationMin = Math.floor(result.duration / 60);
                  const durationSec = result.duration % 60;
                  const durationStr = result.duration > 0
                    ? `${durationMin}:${String(durationSec).padStart(2, '0')}`
                    : '';
                  return (
                    <View key={result.videoId}>
                      <Pressable
                        style={[
                          styles.modalVideoItem,
                          alreadyIn && !isActive && styles.modalVideoItemAdded,
                          isActive && styles.modalVideoItemActive,
                        ]}
                        onPress={() => {
                          if (isActive) {
                            setModalPreviewResult(null);
                          } else {
                            setModalPreviewResult(result);
                          }
                        }}
                      >
                        <Image
                          source={{ uri: result.thumbnailUrl }}
                          style={[styles.modalThumb, { width: scaled.modalThumbW, height: scaled.modalThumbH }]}
                        />
                        <View style={styles.modalVideoInfo}>
                          <Text style={[styles.modalVideoTitle, { fontSize: scaled.bodyFont }]} numberOfLines={1}>
                            {result.title}
                          </Text>
                          <Text style={[styles.ytResultMeta, { fontSize: scaled.metaFont }]} numberOfLines={1}>
                            {result.uploaderName}
                            {durationStr ? ` · ${durationStr}` : ''}
                            {result.viewCount ? ` · ${result.viewCount}` : ''}
                          </Text>
                        </View>
                        {isActive ? (
                          <FontAwesome name="chevron-up" size={12} color={colors.crtBlue} />
                        ) : alreadyIn ? (
                          <FontAwesome name="check" size={14} color={colors.success} />
                        ) : (
                          <Pressable
                            style={styles.ytAddBtn}
                            onPress={(e) => {
                              e.stopPropagation();
                              handleModalAddYouTubeResult(result);
                            }}
                          >
                            <FontAwesome name="plus" size={14} color={colors.crtBlue} />
                          </Pressable>
                        )}
                      </Pressable>

                      {isActive && (
                        <View style={styles.inlinePreview}>
                          <View style={styles.inlinePlayer}>
                            <YouTubePlayer
                              ref={modalPlayerRef}
                              videoId={result.videoId}
                              width={inlinePlayerWidth}
                              height={Math.round(inlinePlayerWidth * 9 / 16)}
                              play
                              mute={false}
                            />
                          </View>
                          <View style={styles.inlinePreviewActions}>
                            {(() => {
                              const added = isModalYtResultInPlaylist(result.videoId);
                              return (
                                <Pressable
                                  style={[styles.previewAddBtn, added && styles.previewAddBtnDone]}
                                  disabled={added}
                                  onPress={() => handleModalAddYouTubeResult(result)}
                                >
                                  <FontAwesome
                                    name={added ? 'check' : 'plus'}
                                    size={14}
                                    color="#fff"
                                  />
                                  <Text style={styles.previewAddBtnText}>
                                    {added ? 'Added' : 'Add to Playlist'}
                                  </Text>
                                </Pressable>
                              );
                            })()}
                            <Pressable
                              style={styles.previewCloseBtn}
                              onPress={() => setModalPreviewResult(null)}
                            >
                              <Text style={styles.previewCloseBtnText}>Close</Text>
                              <FontAwesome name="chevron-up" size={10} color={colors.textSecondary} />
                            </Pressable>
                          </View>
                        </View>
                      )}
                    </View>
                  );
                })}
                {!modalYtSearching && modalYtResults.length === 0 && !modalYtSearchError && (
                  <View style={styles.ytEmptyState}>
                    <FontAwesome name="youtube-play" size={24} color={colors.textSecondary} />
                    <Text style={styles.ytEmptyText}>
                      Search YouTube to find videos to add
                    </Text>
                  </View>
                )}
              </ScrollView>
            </View>

            <Pressable
              style={styles.modalDoneBtn}
              onPress={() => {
                setShowAddVideos(false);
                setModalAddingVideoIds(new Set());
                setModalPreviewResult(null);
              }}
            >
              <Text style={styles.modalDoneBtnText}>Done</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    );
  }

  // ── MAIN VIEW ──
  return (
    <ScrollView style={styles.content} contentContainerStyle={styles.contentInner}>
      {/* Add Channel */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <FontAwesome name="plus-circle" size={scaled.iconSize} color={colors.crtBlue} />
          <Text style={[styles.sectionTitle, { fontSize: scaled.titleFont }]}>Add Channel</Text>
        </View>
        <Text style={[styles.sectionDescription, { fontSize: scaled.sectionDescFont }]}>
          Paste a YouTube channel URL, @handle, or search by name.
        </Text>
        <View style={styles.addVideoRow}>
          <TextInput
            style={[styles.urlInput, { height: scaled.inputHeight }]}
            value={channelInput}
            onChangeText={(text) => { setChannelInput(text); setAddError(null); setChannelResults([]); }}
            placeholder="youtube.com/@handle or channel name..."
            placeholderTextColor={colors.textSecondary}
            autoCapitalize="none"
            autoCorrect={false}
            editable={!isResolving}
            onSubmitEditing={handleAddChannel}
            returnKeyType="search"
          />
          <Pressable
            style={[
              styles.addButton,
              { width: scaled.inputHeight, height: scaled.inputHeight },
              (!channelInput.trim() || isResolving) && styles.addButtonDisabled,
            ]}
            onPress={handleAddChannel}
            disabled={!channelInput.trim() || isResolving}
          >
            {isResolving ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <FontAwesome name="search" size={16} color="#fff" />
            )}
          </Pressable>
        </View>
        {addError && <Text style={styles.errorText}>{addError}</Text>}
        {addSuccess && <Text style={styles.successText}>{addSuccess}</Text>}

        {/* Channel search results */}
        {channelResults.length > 0 && (
          <View style={styles.channelResultsList}>
            {channelResults.map((result) => {
              const alreadySubscribed = subscribedChannels.some((c) => c.id === result.channelId);
              const isSubscribing = subscribingIds.has(result.channelId);
              return (
                <View key={result.channelId} style={styles.channelResultItem}>
                  {result.thumbnailUrl ? (
                    <Image
                      source={{ uri: result.thumbnailUrl }}
                      style={[styles.channelAvatar, { width: scaled.channelThumbW, height: scaled.channelThumbH }]}
                    />
                  ) : (
                    <View style={[styles.channelAvatarPlaceholder, { width: scaled.channelThumbW, height: scaled.channelThumbH }]}>
                      <FontAwesome name="user" size={16} color={colors.textSecondary} />
                    </View>
                  )}
                  <View style={styles.channelResultInfo}>
                    <Text style={[styles.channelResultTitle, { fontSize: scaled.bodyFont }]} numberOfLines={1}>
                      {result.title}
                    </Text>
                    <Text style={[styles.channelResultMeta, { fontSize: scaled.metaFont }]} numberOfLines={1}>
                      {[result.handle, result.subscriberCount].filter(Boolean).join(' · ')}
                    </Text>
                  </View>
                  {alreadySubscribed ? (
                    <View style={styles.subscribedBadge}>
                      <FontAwesome name="check" size={12} color={colors.success} />
                      <Text style={[styles.subscribedBadgeText, { fontSize: scaled.metaFont }]}>Subscribed</Text>
                    </View>
                  ) : (
                    <Pressable
                      style={[styles.subscribeBtn, isSubscribing && styles.subscribeBtnDisabled]}
                      onPress={() => handleSubscribeToResult(result)}
                      disabled={isSubscribing}
                    >
                      {isSubscribing ? (
                        <ActivityIndicator size="small" color="#fff" />
                      ) : (
                        <>
                          <FontAwesome name="plus" size={12} color="#fff" />
                          <Text style={[styles.subscribeBtnText, { fontSize: scaled.metaFont }]}>Subscribe</Text>
                        </>
                      )}
                    </Pressable>
                  )}
                </View>
              );
            })}
          </View>
        )}
      </View>

      {/* Sections Manager */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <FontAwesome name="television" size={scaled.iconSize} color={colors.crtBlue} />
          <Text style={[styles.sectionTitle, { fontSize: scaled.titleFont }]}>Sections</Text>
          {savingOrder && <ActivityIndicator size="small" color={colors.crtBlue} style={{ marginLeft: 8 }} />}
          {orderSaveSuccess && (
            <Text style={styles.orderSaveSuccessText}>Saved</Text>
          )}
        </View>
        <Text style={[styles.sectionDescription, { fontSize: scaled.sectionDescFont }]}>
          Drag to reorder how sections appear on the home screen.
        </Text>
        {orderSaveError && (
          <Text style={styles.orderSaveErrorText}>{orderSaveError}</Text>
        )}

        {/* Create playlist row */}
        <View style={styles.createPlaylistRow}>
          <TextInput
            style={[styles.createInput, { height: scaled.inputHeight }]}
            value={newPlaylistTitle}
            onChangeText={setNewPlaylistTitle}
            placeholder="New playlist name..."
            placeholderTextColor={colors.textSecondary}
            onSubmitEditing={handleCreatePlaylist}
          />
          <Pressable
            style={[styles.createBtn, !newPlaylistTitle.trim() && styles.createBtnDisabled]}
            onPress={handleCreatePlaylist}
            disabled={!newPlaylistTitle.trim()}
          >
            <FontAwesome name="plus" size={14} color="#fff" />
            <Text style={[styles.createBtnText, { fontSize: scaled.bodyFont }]}>New Playlist</Text>
          </Pressable>
        </View>

        {/* Draggable sections list */}
        {orderedSections.length === 0 ? (
          <Text style={styles.emptySubtext}>
            No sections yet. Subscribe to channels above to get started.
          </Text>
        ) : (
          <DraggableList
            items={orderedSections}
            keyExtractor={(s) => s.id}
            onReorder={handleSectionReorder}
            renderItem={(section) => (
              <View style={[styles.sectionItem, section.hidden && styles.sectionItemHidden]}>
                {section.thumbnailUrl ? (
                  <Image
                    source={{ uri: section.thumbnailUrl }}
                    style={[styles.sectionThumb, { width: scaled.sectionThumbW, height: scaled.sectionThumbH }]}
                  />
                ) : (
                  <View style={[styles.sectionThumbPlaceholder, { width: scaled.sectionThumbW, height: scaled.sectionThumbH }]}>
                    <FontAwesome name={section.type === 'playlist' ? 'list-ul' : 'film'} size={12} color={colors.textSecondary} />
                  </View>
                )}
                <View style={styles.sectionItemInfo}>
                  <Text style={[styles.sectionItemTitle, { fontSize: scaled.bodyFont }, section.hidden && styles.sectionItemTitleHidden]} numberOfLines={1}>
                    {section.title}
                  </Text>
                  <Text style={[styles.sectionItemMeta, { fontSize: scaled.metaFont }]}>
                    {section.type === 'playlist' ? 'Playlist' : 'Channel'} · {section.videoCount} video{section.videoCount !== 1 ? 's' : ''}
                    {section.hidden ? ' · Hidden' : ''}
                  </Text>
                </View>
                <Pressable style={styles.sectionEditBtn} onPress={() => handleEditSection(section)}>
                  <FontAwesome name="pencil" size={14} color={colors.crtBlue} />
                </Pressable>
                {section.hidden ? (
                  <Pressable style={styles.sectionDeleteBtn} onPress={() => handleUnhideSection(section.id)}>
                    <FontAwesome name="eye" size={14} color={colors.success} />
                  </Pressable>
                ) : (
                  <Pressable style={styles.sectionDeleteBtn} onPress={() => handleDeleteSection(section)}>
                    <FontAwesome name="trash" size={14} color={colors.vhsRed} />
                  </Pressable>
                )}
              </View>
            )}
          />
        )}
      </View>

      <View style={styles.bottomSpacer} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { flex: 1 },
  contentInner: { padding: spacing.md },

  section: {
    backgroundColor: colors.card,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
    ...shadows.card,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  sectionTitle: {
    fontFamily: typography.subheading.fontFamily,
    fontSize: 16,
    fontWeight: '600',
    color: colors.textPrimary,
    marginLeft: spacing.sm,
  },
  sectionDescription: {
    fontFamily: typography.caption.fontFamily,
    fontSize: 13,
    color: colors.textSecondary,
    marginBottom: spacing.sm,
  },

  // Add Channel
  addVideoRow: { flexDirection: 'row', alignItems: 'center' },
  urlInput: {
    flex: 1,
    height: 44,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.sm,
    paddingHorizontal: 12,
    fontSize: 14,
    color: colors.textPrimary,
    backgroundColor: colors.background,
  },
  addButton: {
    width: 44,
    height: 44,
    borderRadius: borderRadius.sm,
    backgroundColor: colors.crtBlue,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: spacing.sm,
  },
  addButtonDisabled: { opacity: 0.4 },
  errorText: {
    fontFamily: typography.caption.fontFamily,
    fontSize: 12,
    color: colors.vhsRed,
    marginTop: spacing.sm,
  },
  successText: {
    fontFamily: typography.caption.fontFamily,
    fontSize: 12,
    color: colors.success,
    marginTop: spacing.sm,
  },

  // Channel search results
  channelResultsList: {
    marginTop: spacing.sm,
  },
  channelResultItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    gap: spacing.sm,
  },
  channelAvatar: {
    borderRadius: 20,
  },
  channelAvatarPlaceholder: {
    borderRadius: 20,
    backgroundColor: colors.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  channelResultInfo: {
    flex: 1,
  },
  channelResultTitle: {
    fontFamily: typography.caption.fontFamily,
    fontSize: 13,
    color: colors.textPrimary,
    fontWeight: '600',
  },
  channelResultMeta: {
    fontFamily: typography.caption.fontFamily,
    fontSize: 11,
    color: colors.textSecondary,
    marginTop: 2,
  },
  subscribedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  subscribedBadgeText: {
    fontFamily: typography.caption.fontFamily,
    fontSize: 11,
    color: colors.success,
  },
  subscribeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.crtBlue,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: borderRadius.sm,
    gap: 5,
    minWidth: 90,
    justifyContent: 'center',
  },
  subscribeBtnDisabled: { opacity: 0.5 },
  subscribeBtnText: {
    fontFamily: typography.caption.fontFamily,
    fontSize: 12,
    color: '#fff',
    fontWeight: '600',
  },

  // Video items
  videoThumb: { width: 80, height: 45 },

  // Sections Manager
  orderSaveSuccessText: {
    fontFamily: typography.caption.fontFamily,
    fontSize: 12,
    color: colors.success,
    marginLeft: 8,
  },
  orderSaveErrorText: {
    fontFamily: typography.caption.fontFamily,
    fontSize: 12,
    color: colors.vhsRed,
    marginBottom: spacing.sm,
  },
  createPlaylistRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  createInput: {
    flex: 1,
    height: 44,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.sm,
    paddingHorizontal: 12,
    fontSize: 14,
    color: colors.textPrimary,
    backgroundColor: colors.background,
  },
  createBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.crtBlue,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: borderRadius.sm,
    gap: 6,
  },
  createBtnDisabled: { opacity: 0.4 },
  createBtnText: {
    fontFamily: typography.caption.fontFamily,
    fontSize: 13,
    color: '#fff',
    fontWeight: '600',
  },

  // Section item (in draggable list)
  sectionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: spacing.sm,
  },
  sectionThumb: {
    width: 48,
    height: 27,
    borderRadius: 3,
  },
  sectionThumbPlaceholder: {
    width: 48,
    height: 27,
    borderRadius: 3,
    backgroundColor: colors.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sectionItemInfo: {
    flex: 1,
    marginLeft: spacing.sm,
  },
  sectionItemTitle: {
    fontFamily: typography.body.fontFamily,
    fontSize: 13,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  sectionItemMeta: {
    fontFamily: typography.caption.fontFamily,
    fontSize: 11,
    color: colors.textSecondary,
    marginTop: 2,
  },
  sectionItemHidden: {
    opacity: 0.5,
  },
  sectionItemTitleHidden: {
    textDecorationLine: 'line-through',
  },
  sectionEditBtn: {
    padding: spacing.sm,
  },
  sectionDeleteBtn: {
    padding: spacing.sm,
  },
  emptySubtext: {
    fontFamily: typography.caption.fontFamily,
    fontSize: 13,
    color: colors.textSecondary,
    marginTop: spacing.xs,
    textAlign: 'center',
  },

  // Back button
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  backBtnText: {
    fontFamily: typography.body.fontFamily,
    fontSize: 14,
    color: colors.crtBlue,
    marginLeft: spacing.sm,
  },

  // Title input (editor)
  fieldLabel: {
    fontFamily: typography.caption.fontFamily,
    fontSize: 12,
    color: colors.textSecondary,
    marginBottom: 4,
  },
  titleInput: {
    height: 44,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.sm,
    paddingHorizontal: 12,
    fontSize: 16,
    fontFamily: typography.body.fontFamily,
    color: colors.textPrimary,
    backgroundColor: colors.background,
  },
  deleteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: spacing.sm,
    paddingVertical: 6,
  },
  deleteBtnText: {
    fontFamily: typography.caption.fontFamily,
    fontSize: 12,
    color: colors.vhsRed,
  },

  // Editor header
  editorHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  addVideosBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.crtBlue,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: borderRadius.sm,
    gap: 6,
  },
  addVideosBtnText: {
    fontFamily: typography.caption.fontFamily,
    fontSize: 12,
    color: '#fff',
    fontWeight: '600',
  },

  // Editor video item
  editorVideoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: spacing.sm,
  },
  editorVideoItemActive: {
    backgroundColor: colors.dark + '10',
    borderLeftWidth: 3,
    borderLeftColor: colors.crtBlue,
  },
  videoNumber: {
    fontFamily: typography.caption.fontFamily,
    fontSize: 12,
    color: colors.textSecondary,
    width: 24,
  },
  editorVideoMeta: {
    flex: 1,
    marginLeft: spacing.sm,
  },
  editorVideoTitle: {
    fontFamily: typography.caption.fontFamily,
    fontSize: 13,
    color: colors.textPrimary,
  },
  editorVideoSubtitle: {
    fontFamily: typography.caption.fontFamily,
    fontSize: 10,
    color: colors.textSecondary,
    marginTop: 1,
  },
  editorVideoActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  removeBtn: { padding: spacing.sm },

  // Editor inline preview
  editorInlinePreview: {
    backgroundColor: '#000',
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    marginHorizontal: spacing.xs,
    borderRadius: borderRadius.sm,
    overflow: 'hidden',
    marginBottom: spacing.xs,
  },
  editorPreviewBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    backgroundColor: colors.dark,
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  editorPreviewBtns: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  editorRemoveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    padding: spacing.xs,
  },
  editorRemoveBtnText: {
    fontFamily: typography.caption.fontFamily,
    fontSize: 12,
    color: colors.vhsRed,
  },

  // Start time controls
  startTimeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: borderRadius.sm,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  startTimeBtnText: {
    fontFamily: typography.caption.fontFamily,
    fontSize: 12,
    color: colors.crtBlue,
  },
  startTimeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  startTimeLabel: {
    fontFamily: typography.caption.fontFamily,
    fontSize: 12,
    color: '#fff',
  },
  startTimeInput: {
    width: 70,
    height: 28,
    borderWidth: 1,
    borderColor: colors.crtBlue,
    borderRadius: 4,
    paddingHorizontal: 6,
    fontSize: 13,
    color: '#fff',
    backgroundColor: 'rgba(255,255,255,0.1)',
    textAlign: 'center',
  },
  startTimeSaveBtn: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 4,
    backgroundColor: colors.crtBlue,
  },
  startTimeSaveBtnText: {
    fontFamily: typography.caption.fontFamily,
    fontSize: 12,
    fontWeight: '600',
    color: '#fff',
  },
  startTimeCancelBtn: {
    padding: 4,
  },
  previewCloseBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    padding: spacing.sm,
  },
  previewCloseBtnText: {
    fontFamily: typography.caption.fontFamily,
    fontSize: 12,
    color: colors.textSecondary,
  },

  // Add Videos Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalCard: {
    backgroundColor: colors.card,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    ...shadows.card,
    display: 'flex' as any,
    flexDirection: 'column' as any,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  modalTitle: {
    fontFamily: typography.subheading.fontFamily,
    fontSize: 16,
    fontWeight: '600',
    color: colors.textPrimary,
    flex: 1,
  },
  modalCloseBtn: {
    padding: spacing.sm,
    marginLeft: spacing.sm,
  },
  modalScroll: { flex: 1 },
  modalVideoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.xs,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  modalVideoItemAdded: { opacity: 0.5 },
  modalVideoItemActive: {
    backgroundColor: colors.dark + '15',
    borderLeftWidth: 3,
    borderLeftColor: colors.crtBlue,
  },
  modalThumb: { width: 80, height: 45, borderRadius: 4 },
  modalVideoInfo: { flex: 1, marginLeft: spacing.sm },
  modalVideoTitle: {
    fontFamily: typography.caption.fontFamily,
    fontSize: 13,
    color: colors.textPrimary,
  },
  ytResultMeta: {
    fontFamily: typography.caption.fontFamily,
    fontSize: 11,
    color: colors.textSecondary,
    marginTop: 2,
  },

  // YouTube modal content
  ytContent: {
    flex: 1,
    display: 'flex' as any,
    flexDirection: 'column' as any,
  },
  ytSearchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
    gap: spacing.sm,
  },
  ytSearchInput: {
    flex: 1,
    height: 40,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.sm,
    paddingHorizontal: 12,
    fontSize: 14,
    color: colors.textPrimary,
    backgroundColor: colors.background,
  },
  ytSearchBtn: {
    width: 40,
    height: 40,
    borderRadius: borderRadius.sm,
    backgroundColor: colors.vhsRed,
    justifyContent: 'center',
    alignItems: 'center',
  },
  ytSearchBtnDisabled: { opacity: 0.4 },
  ytSearchError: {
    fontFamily: typography.caption.fontFamily,
    fontSize: 12,
    color: colors.vhsRed,
    marginBottom: spacing.sm,
  },
  ytAddBtn: {
    padding: spacing.sm,
  },
  ytEmptyState: {
    alignItems: 'center',
    paddingVertical: spacing.xl,
  },
  ytEmptyText: {
    fontFamily: typography.caption.fontFamily,
    fontSize: 13,
    color: colors.textSecondary,
    marginTop: spacing.sm,
    textAlign: 'center',
  },

  // Inline preview actions (modal)
  inlinePreview: {
    backgroundColor: '#000',
    borderRadius: borderRadius.sm,
    overflow: 'hidden',
    marginBottom: spacing.sm,
  },
  inlinePlayer: {
    width: '100%',
    alignItems: 'center',
    backgroundColor: '#000',
  },
  inlinePreviewActions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    backgroundColor: colors.dark,
  },
  previewAddBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.crtBlue,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: borderRadius.sm,
    gap: 6,
  },
  previewAddBtnDone: {
    backgroundColor: colors.success,
  },
  previewAddBtnText: {
    fontFamily: typography.caption.fontFamily,
    fontSize: 13,
    fontWeight: '600',
    color: '#fff',
  },

  modalDoneBtn: {
    alignItems: 'center',
    paddingVertical: 12,
    marginTop: spacing.sm,
    backgroundColor: colors.dark,
    borderRadius: borderRadius.sm,
  },
  modalDoneBtnText: {
    fontFamily: typography.body.fontFamily,
    fontSize: 15,
    fontWeight: '600',
    color: '#fff',
  },

  bottomSpacer: { height: 40 },
});

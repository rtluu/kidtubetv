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
import { getVideos, getChannels, getNetworks } from '@src/services/content';
import { parseYouTubeUrl, fetchYouTubeVideoInfo, searchYouTube, YouTubeSearchResult } from '@src/utils/youtube';
import { addLibraryVideo, removeLibraryVideo } from '@src/services/library';
import { fetchAppConfig, saveAppConfig } from '@src/services/config';
import { Video, Channel, Network, Playlist, AppConfig } from '@src/types/video';
import { formatDuration } from '@src/utils/format';
import { useResponsive } from '@src/hooks/useResponsive';
import YouTubePlayer, { YouTubePlayerHandle } from '@src/components/YouTubePlayer';
import DraggableList from './DraggableList';

type ViewState = 'main' | 'editor';
type ModalMode = 'library' | 'youtube';

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

  // ── Add Content state ──
  const [urlInput, setUrlInput] = useState('');
  const [isAddingVideo, setIsAddingVideo] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);
  const [addSuccess, setAddSuccess] = useState<string | null>(null);
  const [ytResults, setYtResults] = useState<YouTubeSearchResult[]>([]);
  const [ytSearching, setYtSearching] = useState(false);
  const [addingVideoIds, setAddingVideoIds] = useState<Set<string>>(new Set());
  const [ytPreviewResult, setYtPreviewResult] = useState<YouTubeSearchResult | null>(null);
  const ytPlayerRef = useRef<YouTubePlayerHandle>(null);

  // ── Sections manager state ──
  const [newPlaylistTitle, setNewPlaylistTitle] = useState('');
  const [savingOrder, setSavingOrder] = useState(false);
  const [orderSaveError, setOrderSaveError] = useState<string | null>(null);
  const [orderSaveSuccess, setOrderSaveSuccess] = useState(false);

  // ── Editor state ──
  const [previewVideoId, setPreviewVideoId] = useState<string | null>(null);
  const [editingStartTimeId, setEditingStartTimeId] = useState<string | null>(null);
  const [startTimeInput, setStartTimeInput] = useState('');
  const [menuVideoId, setMenuVideoId] = useState<string | null>(null);
  const playerRef = useRef<YouTubePlayerHandle>(null);

  // ── Add Videos modal (playlists) ──
  const [showAddVideos, setShowAddVideos] = useState(false);
  const [modalMode, setModalMode] = useState<ModalMode>('library');
  const [modalSearchQuery, setModalSearchQuery] = useState('');
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
  const userVideos = useParentStore((s) => s.userVideos);
  const addVideo = useParentStore((s) => s.addVideo);
  const removeVideo = useParentStore((s) => s.removeVideo);
  const playlists = useParentStore((s) => s.playlists);
  const createPlaylist = useParentStore((s) => s.createPlaylist);
  const updatePlaylistTitle = useParentStore((s) => s.updatePlaylistTitle);
  const deletePlaylist = useParentStore((s) => s.deletePlaylist);
  const addVideoToPlaylist = useParentStore((s) => s.addVideoToPlaylist);
  const removeVideoFromPlaylist = useParentStore((s) => s.removeVideoFromPlaylist);
  const reorderPlaylistVideos = useParentStore((s) => s.reorderPlaylistVideos);
  const videoStartTimes = useParentStore((s) => s.videoStartTimes);
  const setVideoStartTime = useParentStore((s) => s.setVideoStartTime);
  const clearVideoStartTime = useParentStore((s) => s.clearVideoStartTime);

  // ── Queries ──
  const { data: seedVideos = [] } = useQuery({
    queryKey: ['videos'],
    queryFn: () => getVideos(),
  });
  const { data: channels = [] } = useQuery({
    queryKey: ['channels'],
    queryFn: () => getChannels(),
  });
  const { data: networks = [] } = useQuery({
    queryKey: ['networks'],
    queryFn: getNetworks,
  });
  const { data: appConfig } = useQuery({
    queryKey: ['appConfig'],
    queryFn: fetchAppConfig,
    staleTime: 30_000,
    retry: 1,
  });

  const allVideos = useMemo(
    () => [...seedVideos, ...userVideos],
    [seedVideos, userVideos]
  );

  const channelMap = useMemo(() => {
    const map: Record<string, Channel> = {};
    channels.forEach((c) => { map[c.id] = c; });
    return map;
  }, [channels]);

  const networkMap = useMemo(() => {
    const map: Record<string, Network> = {};
    networks.forEach((n) => { map[n.id] = n; });
    return map;
  }, [networks]);

  const videoMap = useMemo(() => {
    const map: Record<string, Video> = {};
    allVideos.forEach((v) => { map[v.id] = v; });
    return map;
  }, [allVideos]);

  // ── Unified sections: playlists + channels in appConfig.channelOrder ──
  const hiddenSet = useMemo(() => new Set(appConfig?.hiddenSections ?? []), [appConfig]);
  const titleOverrides = useMemo(() => appConfig?.sectionTitleOverrides ?? {}, [appConfig]);

  const orderedSections: SectionItem[] = useMemo(() => {
    // Build playlist items
    const plItems: SectionItem[] = playlists.map((pl) => {
      const videos = pl.videoIds.map((id) => videoMap[id]).filter(Boolean);
      return {
        type: 'playlist' as const,
        id: pl.id,
        title: pl.title,
        videoCount: videos.length,
        thumbnailUrl: videos[0]?.thumbnailUrl ?? '',
        hidden: hiddenSet.has(pl.id),
      };
    });

    // Build channel items (channels with videos)
    const videosByChannel: Record<string, number> = {};
    allVideos.forEach((v) => {
      videosByChannel[v.channelId] = (videosByChannel[v.channelId] ?? 0) + 1;
    });

    const chItems: SectionItem[] = channels
      .filter((c) => videosByChannel[c.id])
      .map((c) => ({
        type: 'channel' as const,
        id: c.id,
        title: titleOverrides[c.id] ?? c.title,
        videoCount: videosByChannel[c.id],
        thumbnailUrl: c.thumbnailUrl,
        hidden: hiddenSet.has(c.id),
      }));

    // Include user-library if it has videos
    if (videosByChannel['user-library']) {
      chItems.push({
        type: 'channel',
        id: 'user-library',
        title: titleOverrides['user-library'] ?? 'My Videos',
        videoCount: videosByChannel['user-library'],
        thumbnailUrl: '',
        hidden: hiddenSet.has('user-library'),
      });
    }

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
      // Default: playlists first, then channels
      all.sort((a, b) => {
        if (a.type !== b.type) return a.type === 'playlist' ? -1 : 1;
        return 0;
      });
    }
    return all;
  }, [playlists, channels, allVideos, videoMap, appConfig, hiddenSet, titleOverrides]);

  // ── Editor videos ──
  const editorVideos = useMemo(() => {
    if (!editingSection) return [];
    if (editingSection.type === 'playlist') {
      const pl = playlists.find((p) => p.id === editingSection.id);
      if (!pl) return [];
      return pl.videoIds.map((id) => videoMap[id]).filter(Boolean) as Video[];
    }
    // Channel: all videos with this channelId
    return allVideos.filter((v) => v.channelId === editingSection.id);
  }, [editingSection, playlists, allVideos, videoMap]);

  const editingPlaylist = useMemo(() => {
    if (!editingSection || editingSection.type !== 'playlist') return null;
    return playlists.find((p) => p.id === editingSection.id) ?? null;
  }, [editingSection, playlists]);

  // Filtered videos for add-videos modal
  const filteredModalVideos = useMemo(() => {
    const q = modalSearchQuery.toLowerCase().trim();
    if (!q) return allVideos;
    return allVideos.filter(
      (v) =>
        v.title.toLowerCase().includes(q) ||
        v.tags.some((t) => t.includes(q))
    );
  }, [allVideos, modalSearchQuery]);

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

  // ── Input detection ──
  const inputLooksLikeUrl = useMemo(() => {
    const t = urlInput.trim().toLowerCase();
    return t.startsWith('http://') || t.startsWith('https://') || t.includes('youtube.com') || t.includes('youtu.be');
  }, [urlInput]);

  // ── Unified add/search handler ──
  const handleAddOrSearch = useCallback(async () => {
    setAddError(null);
    setAddSuccess(null);
    const trimmed = urlInput.trim();
    if (!trimmed) return;

    // Detect if input is a URL
    const isUrl = trimmed.startsWith('http://') || trimmed.startsWith('https://') || trimmed.includes('youtube.com') || trimmed.includes('youtu.be');

    if (isUrl) {
      // ── URL mode: add video directly ──
      const parsed = parseYouTubeUrl(trimmed);
      if (!parsed.videoId && parsed.playlistId) {
        setAddError('Playlist URLs are not yet supported. Please add individual video URLs.');
        return;
      }
      if (!parsed.videoId) {
        setAddError('Could not find a YouTube video ID. Please paste a valid YouTube video link.');
        return;
      }

      const existing = [...seedVideos, ...userVideos].find(
        (v) => v.youtubeVideoId === parsed.videoId
      );
      if (existing) {
        setAddError(`This video is already in the library: "${existing.title}"`);
        return;
      }

      setIsAddingVideo(true);
      try {
        const info = await fetchYouTubeVideoInfo(parsed.videoId);
        if (!info) {
          setAddError('Could not fetch video info. The video may be private or unavailable.');
          setIsAddingVideo(false);
          return;
        }

        const newVideo: Video = {
          id: `user-${parsed.videoId}`,
          title: info.title,
          description: `Added from ${info.authorName}`,
          source: 'youtube',
          youtubeVideoId: parsed.videoId,
          thumbnailUrl: info.thumbnailUrl,
          duration: 0,
          channelId: 'user-library',
          networkId: 'user',
          categoryIds: [],
          tags: [info.authorName.toLowerCase()],
          ageRange: { min: 2, max: 12 },
          sortOrder: 999 + userVideos.length,
          isActive: true,
          isFreebie: true,
        };

        addVideo(newVideo);
        addLibraryVideo(newVideo).then(() => queryClient.invalidateQueries({ queryKey: ['libraryVideos'] })).catch(() => {});
        setUrlInput('');
        setAddSuccess(`Added "${info.title}"`);
        setTimeout(() => setAddSuccess(null), 3000);
      } catch {
        setAddError('Something went wrong. Please try again.');
      }
      setIsAddingVideo(false);
    } else {
      // ── Search mode: search YouTube ──
      setYtSearching(true);
      setYtPreviewResult(null);
      try {
        const results = await searchYouTube(trimmed);
        setYtResults(results);
        if (results.length === 0) {
          setAddError('No results found. Try a different search term.');
        }
      } catch (err: any) {
        setAddError(err?.message ?? 'Search failed.');
      }
      setYtSearching(false);
    }
  }, [urlInput, seedVideos, userVideos, addVideo, queryClient]);

  const handleRemoveVideo = useCallback(
    (videoId: string) => {
      const doRemove = () => {
        removeVideo(videoId);
        removeLibraryVideo(videoId).then(() => queryClient.invalidateQueries({ queryKey: ['libraryVideos'] })).catch(() => {});
        if (previewVideoId === videoId) setPreviewVideoId(null);
      };
      if (Platform.OS === 'web') {
        if (window.confirm('Remove this video from your library?')) {
          doRemove();
        }
      } else {
        Alert.alert('Remove Video', 'Remove this video from your library?', [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Remove', style: 'destructive', onPress: doRemove },
        ]);
      }
    },
    [removeVideo, previewVideoId, queryClient]
  );

  const handleAddYouTubeResult = useCallback(
    (result: YouTubeSearchResult) => {
      const videoId = `user-${result.videoId}`;

      const existsInLibrary = [...seedVideos, ...userVideos].some(
        (v) => v.youtubeVideoId === result.videoId
      );
      if (existsInLibrary) return;

      const newVideo: Video = {
        id: videoId,
        title: result.title,
        description: `Added from ${result.uploaderName}`,
        source: 'youtube',
        youtubeVideoId: result.videoId,
        thumbnailUrl: `https://img.youtube.com/vi/${result.videoId}/mqdefault.jpg`,
        duration: result.duration,
        channelId: 'user-library',
        networkId: 'user',
        categoryIds: [],
        tags: [result.uploaderName.toLowerCase()],
        ageRange: { min: 2, max: 12 },
        viewCount: result.viewCount || undefined,
        sortOrder: 999 + userVideos.length,
        isActive: true,
        isFreebie: true,
      };

      addVideo(newVideo);
      addLibraryVideo(newVideo).then(() => queryClient.invalidateQueries({ queryKey: ['libraryVideos'] })).catch(() => {});
      setAddingVideoIds((prev) => new Set(prev).add(result.videoId));
      setAddSuccess(`Added "${result.title}"`);
      setTimeout(() => setAddSuccess(null), 3000);
    },
    [seedVideos, userVideos, addVideo, queryClient]
  );

  const isYtResultInLibrary = useCallback(
    (ytVideoId: string) => {
      return [...seedVideos, ...userVideos].some(
        (v) => v.youtubeVideoId === ytVideoId
      ) || addingVideoIds.has(ytVideoId);
    },
    [seedVideos, userVideos, addingVideoIds]
  );

  const isUserVideo = useCallback(
    (videoId: string) => videoId.startsWith('user-'),
    []
  );

  const getVideoSubtitle = useCallback(
    (video: Video) => {
      const parts: string[] = [];
      const channel = channelMap[video.channelId];
      const network = networkMap[video.networkId];
      if (channel && network) parts.push(`${channel.title} · ${network.name}`);
      else if (channel) parts.push(channel.title);
      else if (video.networkId === 'user') parts.push(video.description);
      if (video.duration > 0) parts.push(formatDuration(video.duration));
      if (video.viewCount) parts.push(video.viewCount);
      return parts.join(' · ');
    },
    [channelMap, networkMap]
  );

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
        // Channel: hide via hiddenSections + remove from channelOrder
        const doDelete = async () => {
          const hidden = [...(appConfig?.hiddenSections ?? [])];
          if (!hidden.includes(section.id)) hidden.push(section.id);
          const channelOrder = (appConfig?.channelOrder ?? []).filter((id) => id !== section.id);
          try {
            await saveAppConfig({
              channelOrder,
              videoOverrides: appConfig?.videoOverrides ?? {},
              sectionTitleOverrides: appConfig?.sectionTitleOverrides ?? {},
              hiddenSections: hidden,
            });
            await queryClient.invalidateQueries({ queryKey: ['appConfig'] });
          } catch {}
          if (editingSection?.id === section.id) {
            setView('main');
            setEditingSection(null);
          }
        };
        if (Platform.OS === 'web') {
          if (window.confirm(`Delete "${section.title}"? It will be removed from the home screen.`)) doDelete();
        } else {
          Alert.alert('Delete Show', `Delete "${section.title}"? It will be removed from the home screen.`, [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Delete', style: 'destructive', onPress: doDelete },
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

  const handleAddVideoToChannel = useCallback(
    async (videoId: string, channelId: string) => {
      const overrides = { ...(appConfig?.videoOverrides ?? {}), [videoId]: { channelId } };
      try {
        await saveAppConfig({
          channelOrder: appConfig?.channelOrder ?? [],
          videoOverrides: overrides,
          sectionTitleOverrides: appConfig?.sectionTitleOverrides ?? {},
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

  // ── Modal: Add YouTube result to playlist ──
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
      if (!editingSection) return;
      const videoId = `user-${result.videoId}`;

      const existsInLibrary = allVideos.some(
        (v) => v.youtubeVideoId === result.videoId
      );

      if (!existsInLibrary) {
        const targetChannelId = editingSection.type === 'channel' ? editingSection.id : 'user-library';
        const newVideo: Video = {
          id: videoId,
          title: result.title,
          description: `Added from ${result.uploaderName}`,
          source: 'youtube',
          youtubeVideoId: result.videoId,
          thumbnailUrl: `https://img.youtube.com/vi/${result.videoId}/mqdefault.jpg`,
          duration: result.duration,
          channelId: targetChannelId,
          networkId: editingSection.type === 'channel' ? (channelMap[editingSection.id]?.networkId ?? 'user') : 'user',
          categoryIds: [],
          tags: [result.uploaderName.toLowerCase()],
          ageRange: { min: 2, max: 12 },
          viewCount: result.viewCount || undefined,
          sortOrder: 999 + userVideos.length,
          isActive: true,
          isFreebie: true,
        };
        addVideo(newVideo);
        addLibraryVideo(newVideo).then(() => queryClient.invalidateQueries({ queryKey: ['libraryVideos'] })).catch(() => {});
        // For channels, also save the video override to persist the assignment
        if (editingSection.type === 'channel') {
          handleAddVideoToChannel(videoId, targetChannelId);
        }
      }

      const existingVideo = allVideos.find(
        (v) => v.youtubeVideoId === result.videoId
      );
      const idToAdd = existingVideo ? existingVideo.id : videoId;

      if (editingSection.type === 'playlist' && editingPlaylist) {
        addVideoToPlaylist(editingPlaylist.id, idToAdd);
      } else if (editingSection.type === 'channel' && existsInLibrary) {
        // Reassign existing video to this channel
        handleAddVideoToChannel(idToAdd, editingSection.id);
      }
      setModalAddingVideoIds((prev) => new Set(prev).add(result.videoId));
    },
    [editingSection, editingPlaylist, allVideos, userVideos, addVideo, addVideoToPlaylist, queryClient, channelMap, handleAddVideoToChannel]
  );

  const isModalYtResultInSection = useCallback(
    (ytVideoId: string) => {
      if (!editingSection) return false;
      if (modalAddingVideoIds.has(ytVideoId)) return true;
      if (editingSection.type === 'playlist' && editingPlaylist) {
        return editingPlaylist.videoIds.some((id) => {
          const video = videoMap[id];
          return video?.youtubeVideoId === ytVideoId;
        });
      }
      // Channel: check if video is in this channel
      return editorVideos.some((v) => v.youtubeVideoId === ytVideoId);
    },
    [editingSection, editingPlaylist, videoMap, modalAddingVideoIds, editorVideos]
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
              {isPlaylist ? 'Delete Playlist' : 'Delete Show'}
            </Text>
          </Pressable>
        </View>

        {/* Videos */}
        <View style={styles.section}>
          <View style={styles.editorHeader}>
            <Text style={[styles.sectionTitle, { fontSize: scaled.titleFont }]}>
              Videos ({editorVideos.length})
            </Text>
            <Pressable
              style={styles.addVideosBtn}
              onPress={() => {
                setModalSearchQuery('');
                setModalMode('library');
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
          </View>

          {editorVideos.length === 0 ? (
            <Text style={styles.emptySubtext}>
              No videos yet. Tap "Add Videos" to get started.
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
              <Pressable
                style={styles.removeBtn}
                onPress={(e) => {
                  e.stopPropagation();
                  handleRemoveVideo(video.id);
                }}
                hitSlop={4}
              >
                <FontAwesome name="trash" size={13} color={colors.vhsRed} />
              </Pressable>
            </View>
          ) : isPreview ? (
            <FontAwesome name="chevron-up" size={12} color={colors.crtBlue} />
          ) : (
            <>
              {isUserVideo(video.id) && (
                <Pressable style={styles.actionBtn} onPress={() => handleRemoveVideo(video.id)}>
                  <FontAwesome name="trash" size={14} color={colors.vhsRed} />
                </Pressable>
              )}
              <Pressable style={styles.actionBtn} onPress={() => setMenuVideoId(video.id)}>
                <FontAwesome name="ellipsis-v" size={14} color={colors.textSecondary} />
              </Pressable>
            </>
          )}
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
                  <>
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
                    <Pressable
                      style={styles.editorRemoveBtn}
                      onPress={() => {
                        handleRemoveVideo(video.id);
                        setPreviewVideoId(null);
                      }}
                    >
                      <FontAwesome name="trash" size={12} color={colors.vhsRed} />
                      <Text style={[styles.editorRemoveBtnText, { color: colors.vhsRed }]}>Delete</Text>
                    </Pressable>
                  </>
                )}
                {!isPlaylistEditor && isUserVideo(video.id) && (
                  <Pressable
                    style={styles.editorRemoveBtn}
                    onPress={() => handleRemoveVideo(video.id)}
                  >
                    <FontAwesome name="trash" size={12} color={colors.vhsRed} />
                    <Text style={styles.editorRemoveBtnText}>Delete</Text>
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

        {/* Add to Playlist Menu (for channel editor) */}
        {!isPlaylistEditor && (
          <Modal
            visible={menuVideoId === video.id}
            transparent
            animationType="fade"
            onRequestClose={() => setMenuVideoId(null)}
          >
            <Pressable style={styles.modalOverlay} onPress={() => setMenuVideoId(null)}>
              <View style={[styles.menuCard, { width: Math.round(300 * spacingScale) }]}>
                <Text style={[styles.menuTitle, { fontSize: scaled.titleFont }]}>Add to Playlist</Text>
                {playlists.length === 0 ? (
                  <Text style={[styles.menuEmpty, { fontSize: scaled.bodyFont }]}>No playlists yet. Create one from the Library tab.</Text>
                ) : (
                  playlists.map((pl) => {
                    const alreadyIn = menuVideoId ? pl.videoIds.includes(menuVideoId) : false;
                    return (
                      <Pressable
                        key={pl.id}
                        style={[styles.menuItem, alreadyIn && styles.menuItemDisabled]}
                        disabled={alreadyIn}
                        onPress={() => {
                          if (menuVideoId) {
                            addVideoToPlaylist(pl.id, menuVideoId);
                            setMenuVideoId(null);
                          }
                        }}
                      >
                        <FontAwesome
                          name={alreadyIn ? 'check-circle' : 'plus-circle'}
                          size={16}
                          color={alreadyIn ? colors.success : colors.crtBlue}
                        />
                        <Text style={[styles.menuItemText, alreadyIn && styles.menuItemTextDisabled]}>
                          {pl.title}
                        </Text>
                        {alreadyIn && (
                          <Text style={styles.menuItemBadge}>Added</Text>
                        )}
                      </Pressable>
                    );
                  })
                )}
                <Pressable style={styles.menuClose} onPress={() => setMenuVideoId(null)}>
                  <Text style={styles.menuCloseText}>Cancel</Text>
                </Pressable>
              </View>
            </Pressable>
          </Modal>
        )}
      </View>
    );
  }

  // ── Add Videos Modal ──
  function renderAddVideosModal() {
    if (!editingSection) return null;
    const modalSectionTitle = editingSection.type === 'playlist'
      ? editingPlaylist?.title ?? ''
      : (titleOverrides[editingSection.id] ?? channelMap[editingSection.id]?.title ?? editingSection.id);
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

            {/* Library / YouTube toggle */}
            <View style={styles.modalTabs}>
              <Pressable
                style={[styles.modalTab, modalMode === 'library' && styles.modalTabActive]}
                onPress={() => { setModalMode('library'); setModalPreviewResult(null); }}
              >
                <FontAwesome
                  name="film"
                  size={12}
                  color={modalMode === 'library' ? colors.crtBlue : colors.textSecondary}
                />
                <Text style={[styles.modalTabText, { fontSize: scaled.bodyFont }, modalMode === 'library' && styles.modalTabTextActive]}>
                  Library
                </Text>
              </Pressable>
              <Pressable
                style={[styles.modalTab, modalMode === 'youtube' && styles.modalTabActive]}
                onPress={() => setModalMode('youtube')}
              >
                <FontAwesome
                  name="youtube-play"
                  size={12}
                  color={modalMode === 'youtube' ? colors.vhsRed : colors.textSecondary}
                />
                <Text style={[styles.modalTabText, { fontSize: scaled.bodyFont }, modalMode === 'youtube' && styles.modalTabTextActive]}>
                  YouTube
                </Text>
              </Pressable>
            </View>

            {modalMode === 'library' ? (
              <>
                <TextInput
                  style={[styles.searchInput, { height: scaled.searchHeight }]}
                  value={modalSearchQuery}
                  onChangeText={setModalSearchQuery}
                  placeholder="Search library..."
                  placeholderTextColor={colors.textSecondary}
                />
                <ScrollView style={styles.modalScroll}>
                  {filteredModalVideos.map((video) => {
                    const alreadyIn = editingSection.type === 'playlist'
                      ? (editingPlaylist?.videoIds.includes(video.id) ?? false)
                      : editorVideos.some((v) => v.id === video.id);
                    return (
                      <Pressable
                        key={video.id}
                        style={[styles.modalVideoItem, alreadyIn && styles.modalVideoItemAdded]}
                        disabled={alreadyIn}
                        onPress={() => {
                          if (editingSection.type === 'playlist' && editingPlaylist) {
                            addVideoToPlaylist(editingPlaylist.id, video.id);
                          } else if (editingSection.type === 'channel') {
                            handleAddVideoToChannel(video.id, editingSection.id);
                          }
                        }}
                      >
                        <Image source={{ uri: video.thumbnailUrl }} style={[styles.modalThumb, { width: scaled.modalThumbW, height: scaled.modalThumbH }]} />
                        <View style={styles.modalVideoInfo}>
                          <Text style={[styles.modalVideoTitle, { fontSize: scaled.bodyFont }]} numberOfLines={1}>
                            {video.title}
                          </Text>
                          <Text style={[styles.ytResultMeta, { fontSize: scaled.metaFont }]} numberOfLines={1}>
                            {[
                              video.duration > 0 ? formatDuration(video.duration) : null,
                              video.viewCount,
                            ].filter(Boolean).join(' · ')}
                          </Text>
                        </View>
                        {alreadyIn ? (
                          <FontAwesome name="check" size={14} color={colors.success} />
                        ) : (
                          <FontAwesome name="plus" size={14} color={colors.crtBlue} />
                        )}
                      </Pressable>
                    );
                  })}
                </ScrollView>
              </>
            ) : (
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
                    const alreadyIn = isModalYtResultInSection(result.videoId);
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
                                const added = isModalYtResultInSection(result.videoId);
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
            )}

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
      {/* Add Content */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <FontAwesome name="plus-circle" size={scaled.iconSize} color={colors.crtBlue} />
          <Text style={[styles.sectionTitle, { fontSize: scaled.titleFont }]}>Add Content</Text>
        </View>
        <Text style={[styles.sectionDescription, { fontSize: scaled.sectionDescFont }]}>
          Paste a YouTube URL or search to find videos.
        </Text>
        <View style={styles.addVideoRow}>
          <TextInput
            style={[styles.urlInput, { height: scaled.inputHeight }]}
            value={urlInput}
            onChangeText={(text) => { setUrlInput(text); setAddError(null); }}
            placeholder="Paste URL or search YouTube..."
            placeholderTextColor={colors.textSecondary}
            autoCapitalize="none"
            autoCorrect={false}
            editable={!isAddingVideo && !ytSearching}
            onSubmitEditing={handleAddOrSearch}
            returnKeyType={inputLooksLikeUrl ? 'done' : 'search'}
          />
          <Pressable
            style={[
              styles.addButton,
              { width: scaled.inputHeight, height: scaled.inputHeight },
              inputLooksLikeUrl ? undefined : styles.addButtonSearch,
              (!urlInput.trim() || isAddingVideo || ytSearching) && styles.addButtonDisabled,
            ]}
            onPress={handleAddOrSearch}
            disabled={!urlInput.trim() || isAddingVideo || ytSearching}
          >
            {isAddingVideo || ytSearching ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <FontAwesome name={inputLooksLikeUrl ? 'plus' : 'search'} size={16} color="#fff" />
            )}
          </Pressable>
        </View>
        {addError && <Text style={styles.errorText}>{addError}</Text>}
        {addSuccess && <Text style={styles.successText}>{addSuccess}</Text>}

        {ytResults.length > 0 && (
          <View style={styles.ytResultsList}>
            {ytResults.map((result) => {
              const alreadyIn = isYtResultInLibrary(result.videoId);
              const isActive = ytPreviewResult?.videoId === result.videoId;
              const durationMin = Math.floor(result.duration / 60);
              const durationSec = result.duration % 60;
              const durationStr = result.duration > 0
                ? `${durationMin}:${String(durationSec).padStart(2, '0')}`
                : '';
              return (
                <View key={result.videoId}>
                  <Pressable
                    style={[styles.ytResultItem, isActive && styles.videoItemActive]}
                    onPress={() => {
                      if (isActive) {
                        setYtPreviewResult(null);
                      } else {
                        setYtPreviewResult(result);
                      }
                    }}
                  >
                    <Image source={{ uri: result.thumbnailUrl }} style={[styles.videoThumb, { width: scaled.thumbW, height: scaled.thumbH }]} />
                    <View style={styles.videoInfo}>
                      <Text style={[styles.videoTitle, { fontSize: scaled.bodyFont }]} numberOfLines={2}>{result.title}</Text>
                      <Text style={[styles.videoMeta, { fontSize: scaled.metaFont }]} numberOfLines={1}>
                        {result.uploaderName}
                        {durationStr ? ` · ${durationStr}` : ''}
                        {result.viewCount ? ` · ${result.viewCount}` : ''}
                      </Text>
                    </View>
                    {isActive ? (
                      <FontAwesome name="chevron-up" size={12} color={colors.crtBlue} />
                    ) : alreadyIn ? (
                      <FontAwesome name="check" size={14} color={colors.success} style={{ padding: spacing.sm }} />
                    ) : (
                      <Pressable
                        style={styles.actionBtn}
                        onPress={(e) => {
                          e.stopPropagation();
                          handleAddYouTubeResult(result);
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
                          ref={ytPlayerRef}
                          videoId={result.videoId}
                          width={playerWidth}
                          height={Math.round(playerWidth * 9 / 16)}
                          play
                          mute={false}
                        />
                      </View>
                      <View style={styles.previewBar}>
                        {(() => {
                          const added = isYtResultInLibrary(result.videoId);
                          return (
                            <Pressable
                              style={[styles.ytPreviewAddBtn, added && styles.ytPreviewAddBtnDone]}
                              disabled={added}
                              onPress={() => handleAddYouTubeResult(result)}
                            >
                              <FontAwesome
                                name={added ? 'check' : 'plus'}
                                size={14}
                                color="#fff"
                              />
                              <Text style={styles.ytPreviewAddBtnText}>
                                {added ? 'Added' : 'Add to Library'}
                              </Text>
                            </Pressable>
                          );
                        })()}
                        <Pressable
                          style={styles.previewCloseBtn}
                          onPress={() => setYtPreviewResult(null)}
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
                  {section.type === 'playlist' ? 'Playlist' : 'Show'} · {section.videoCount} video{section.videoCount !== 1 ? 's' : ''}
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

  // Add Content
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
  addButtonSearch: {
    backgroundColor: colors.vhsRed,
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

  // YouTube search results
  ytResultsList: {
    marginTop: spacing.sm,
  },
  ytResultItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: borderRadius.sm,
    overflow: 'hidden',
    marginBottom: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },

  // Video items
  videoItemActive: {
    borderLeftWidth: 3,
    borderLeftColor: colors.crtBlue,
    backgroundColor: colors.dark + '10',
  },
  videoThumb: { width: 80, height: 45 },
  videoInfo: { flex: 1, paddingHorizontal: spacing.sm },
  videoTitle: {
    fontFamily: typography.caption.fontFamily,
    fontSize: 13,
    color: colors.textPrimary,
    lineHeight: 17,
  },
  videoMeta: {
    fontFamily: typography.caption.fontFamily,
    fontSize: 11,
    color: colors.textSecondary,
    marginTop: 2,
  },
  actionBtn: { padding: spacing.sm },

  // Inline preview
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
  previewBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    backgroundColor: colors.dark,
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  ytPreviewAddBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.crtBlue,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: borderRadius.sm,
    gap: 6,
  },
  ytPreviewAddBtnDone: {
    backgroundColor: colors.success,
  },
  ytPreviewAddBtnText: {
    fontFamily: typography.caption.fontFamily,
    fontSize: 13,
    fontWeight: '600',
    color: '#fff',
  },

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
  emptySubtext: {
    fontFamily: typography.caption.fontFamily,
    fontSize: 13,
    color: colors.textSecondary,
    marginTop: spacing.xs,
    textAlign: 'center',
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

  // Add to Playlist Menu modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  menuCard: {
    backgroundColor: colors.card,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    width: 300,
    maxWidth: '90%',
    ...shadows.card,
  },
  menuTitle: {
    fontFamily: typography.subheading.fontFamily,
    fontSize: 16,
    fontWeight: '600',
    color: colors.textPrimary,
    marginBottom: spacing.md,
  },
  menuEmpty: {
    fontFamily: typography.caption.fontFamily,
    fontSize: 13,
    color: colors.textSecondary,
    marginBottom: spacing.md,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  menuItemDisabled: { opacity: 0.5 },
  menuItemText: {
    fontFamily: typography.body.fontFamily,
    fontSize: 15,
    color: colors.textPrimary,
    marginLeft: spacing.sm,
    flex: 1,
  },
  menuItemTextDisabled: { color: colors.textSecondary },
  menuItemBadge: {
    fontFamily: typography.caption.fontFamily,
    fontSize: 11,
    color: colors.success,
  },
  menuClose: {
    alignItems: 'center',
    paddingVertical: spacing.sm,
    marginTop: spacing.sm,
  },
  menuCloseText: {
    fontFamily: typography.body.fontFamily,
    fontSize: 15,
    color: colors.textSecondary,
  },

  // Add Videos Modal
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
  modalTabs: {
    flexDirection: 'row',
    marginBottom: spacing.sm,
    gap: spacing.sm,
  },
  modalTab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    borderRadius: borderRadius.sm,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 6,
  },
  modalTabActive: {
    backgroundColor: colors.dark,
    borderColor: colors.crtBlue,
  },
  modalTabText: {
    fontFamily: typography.caption.fontFamily,
    fontSize: 13,
    color: colors.textSecondary,
  },
  modalTabTextActive: {
    color: colors.crtBlue,
    fontWeight: '600',
  },
  searchInput: {
    height: 40,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.sm,
    paddingHorizontal: 12,
    fontSize: 14,
    color: colors.textPrimary,
    backgroundColor: colors.background,
    marginBottom: spacing.sm,
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

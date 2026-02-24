import { useEffect, useRef, useCallback, useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  Platform,
  useWindowDimensions,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { colors, spacing, typography } from '@src/constants/theme';
import { getVideoById, getVideos, getChannels } from '@src/services/content';
import { fetchLibraryVideos } from '@src/services/library';
import { usePlayerStore } from '@src/stores/usePlayerStore';
import { useHistoryStore } from '@src/stores/useHistoryStore';
import { useParentStore } from '@src/stores/useParentStore';
import { formatDuration } from '@src/utils/format';
import VideoCard from '@src/components/VideoCard';
import YouTubePlayer from '@src/components/YouTubePlayer';
import PremiumPlayerOverlay from '@src/components/PremiumPlayerOverlay';
import type { YouTubePlayerHandle, PlayerState } from '@src/components/YouTubePlayer';

const UP_NEXT_DELAY_MS = 5000;
const MAX_PLAYER_WIDTH = 900;

export default function PlayerScreen() {
  const { videoId } = useLocalSearchParams<{ videoId: string }>();
  const router = useRouter();
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();

  const {
    currentVideo,
    setCurrentVideo,
    queue,
    setQueue,
    isPlaying,
    setIsPlaying,
    isMuted,
    setIsMuted,
    currentTime,
    duration,
    setProgress,
    playNext,
  } = usePlayerStore();

  const addEntry = useHistoryStore((s) => s.addEntry);
  const videoStartTimes = useParentStore((s) => s.videoStartTimes);
  const userVideos = useParentStore((s) => s.userVideos);

  const { data: libraryVideos = [] } = useQuery({
    queryKey: ['libraryVideos'],
    queryFn: fetchLibraryVideos,
    staleTime: 30_000,
    retry: 1,
  });

  const playerRef = useRef<YouTubePlayerHandle>(null);
  const playerContainerRef = useRef<View>(null);
  const [playerState, setPlayerState] = useState<PlayerState>('unstarted');
  const [bufferedFraction, setBufferedFraction] = useState(0);
  const [volume, setVolume] = useState(100);
  const [showUpNext, setShowUpNext] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const upNextTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const seekingRef = useRef(false);
  const currentVideoIdRef = useRef(videoId);

  const { data: video } = useQuery({
    queryKey: ['video', videoId],
    queryFn: () => getVideoById(videoId!),
    enabled: !!videoId,
  });

  const { data: channels = [] } = useQuery({
    queryKey: ['channels'],
    queryFn: () => getChannels(),
  });

  // Resolve video from seed, user library, or backend library
  const resolvedVideo = video
    ?? userVideos.find((v) => v.id === videoId)
    ?? libraryVideos.find((v) => v.id === videoId);

  const { data: channelVideos = [] } = useQuery({
    queryKey: ['videos', 'channel', resolvedVideo?.channelId],
    queryFn: () => getVideos({ channelId: resolvedVideo!.channelId }),
    enabled: !!resolvedVideo?.channelId,
  });

  const channel = channels.find((c) => c.id === resolvedVideo?.channelId);

  // Build queue from channel videos after the current one
  useEffect(() => {
    if (resolvedVideo && channelVideos.length > 0) {
      const currentIndex = channelVideos.findIndex((v) => v.id === resolvedVideo.id);
      const remaining = currentIndex >= 0 ? channelVideos.slice(currentIndex + 1) : [];
      setQueue(remaining);
    }
  }, [resolvedVideo?.id, channelVideos]);

  // Initialize current video on mount
  useEffect(() => {
    if (resolvedVideo) {
      setCurrentVideo(resolvedVideo);
      setIsPlaying(true);
      currentVideoIdRef.current = resolvedVideo.id;
      addEntry({
        videoId: resolvedVideo.id,
        channelId: resolvedVideo.channelId,
        watchedAt: Date.now(),
        watchedDuration: 0,
        completed: false,
      });
    }
    return () => {
      setCurrentVideo(null);
      setIsPlaying(false);
      setProgress(0, 0);
      if (upNextTimer.current) clearTimeout(upNextTimer.current);
    };
  }, [resolvedVideo?.id]);

  const handleStateChange = useCallback(
    (state: PlayerState) => {
      setPlayerState(state);
      if (state === 'playing') {
        seekingRef.current = false;
        setIsPlaying(true);
        setShowUpNext(false);
        if (upNextTimer.current) {
          clearTimeout(upNextTimer.current);
          upNextTimer.current = null;
        }
      } else if (state === 'paused') {
        // Ignore transient paused states caused by seekTo with controls:0
        if (!seekingRef.current) {
          setIsPlaying(false);
        }
      } else if (state === 'ended') {
        seekingRef.current = false;
        setIsPlaying(false);
        // Start auto-play countdown
        if (queue.length > 0) {
          setShowUpNext(true);
          upNextTimer.current = setTimeout(() => {
            advanceToNext();
          }, UP_NEXT_DELAY_MS);
        }
      }
    },
    [queue]
  );

  const advanceToNext = useCallback(() => {
    setShowUpNext(false);
    if (upNextTimer.current) {
      clearTimeout(upNextTimer.current);
      upNextTimer.current = null;
    }
    const { queue: currentQueue } = usePlayerStore.getState();
    if (currentQueue.length > 0) {
      const nextVideo = currentQueue[0];
      playNext();
      setProgress(0, 0);
      // Load the new video into the existing player
      if (nextVideo.youtubeVideoId) {
        playerRef.current?.loadVideo(nextVideo.youtubeVideoId);
      }
      currentVideoIdRef.current = nextVideo.id;
      setIsPlaying(true);
      addEntry({
        videoId: nextVideo.id,
        channelId: nextVideo.channelId,
        watchedAt: Date.now(),
        watchedDuration: 0,
        completed: false,
      });
    }
  }, [playNext, setProgress, setIsPlaying, addEntry]);

  const cancelUpNext = useCallback(() => {
    setShowUpNext(false);
    if (upNextTimer.current) {
      clearTimeout(upNextTimer.current);
      upNextTimer.current = null;
    }
  }, []);

  const handleProgress = useCallback(
    (ct: number, dur: number) => {
      setProgress(ct, dur);
    },
    [setProgress]
  );

  const handlePlayPause = useCallback(() => {
    if (isPlaying) {
      playerRef.current?.pause();
      setIsPlaying(false);
    } else {
      playerRef.current?.play();
      setIsPlaying(true);
    }
  }, [isPlaying, setIsPlaying]);

  const handleSeek = useCallback((seconds: number) => {
    seekingRef.current = true;
    playerRef.current?.seekTo(seconds);
    // Resume playback after seeking (seekTo with controls:0 fires transient pause)
    playerRef.current?.play();
    setIsPlaying(true);
  }, [setIsPlaying]);

  const handleMuteToggle = useCallback(() => {
    setIsMuted(!isMuted);
  }, [isMuted, setIsMuted]);

  const handleBufferProgress = useCallback((fraction: number) => {
    setBufferedFraction(fraction);
  }, []);

  const handleVolumeChange = useCallback((vol: number) => {
    setVolume(vol);
    playerRef.current?.setVolume(vol);
    if (vol > 0 && isMuted) setIsMuted(false);
  }, [isMuted, setIsMuted]);

  const handleFullscreen = useCallback(() => {
    if (typeof document === 'undefined') return;
    // RN Web View refs give us the underlying DOM element
    const container = playerContainerRef.current as unknown as HTMLElement | null;
    if (!container) return;
    if (document.fullscreenElement) {
      document.exitFullscreen();
    } else {
      container.requestFullscreen();
    }
  }, []);

  // Track fullscreen changes to resize player
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const handler = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', handler);
    return () => document.removeEventListener('fullscreenchange', handler);
  }, []);

  // Pause playback when this screen loses focus (e.g. another modal pushed on top)
  useFocusEffect(
    useCallback(() => {
      // Screen focused — no-op (play state managed elsewhere)
      return () => {
        // Screen blurred — pause playback
        playerRef.current?.pause();
        setIsPlaying(false);
      };
    }, [setIsPlaying])
  );

  const playerWidth = isFullscreen ? windowWidth : Math.min(windowWidth, MAX_PLAYER_WIDTH);
  const playerHeight = isFullscreen ? windowHeight : Math.round(playerWidth * (9 / 16));
  const displayVideo = currentVideo ?? resolvedVideo;
  const upNextVideo = queue.length > 0 ? queue[0] : null;
  const upNext = channelVideos.filter((v) => v.id !== (displayVideo?.id ?? videoId));

  if (!resolvedVideo) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingArea}>
          <Text style={styles.loadingText}>Loading...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Player + Overlay */}
      <View ref={playerContainerRef} style={[styles.playerWrapper, { height: playerHeight, alignSelf: 'center', width: playerWidth }]}>
        {displayVideo?.source === 'youtube' && displayVideo.youtubeVideoId ? (
          <>
            <YouTubePlayer
              ref={playerRef}
              videoId={displayVideo.youtubeVideoId}
              width={playerWidth}
              height={playerHeight}
              play={isPlaying}
              mute={isMuted}
              customControls
              startTime={videoStartTimes[displayVideo.id]}
              onStateChange={handleStateChange}
              onProgress={handleProgress}
              onBufferProgress={handleBufferProgress}
            />
            <PremiumPlayerOverlay
              playerState={playerState}
              currentTime={currentTime}
              duration={duration}
              bufferedFraction={bufferedFraction}
              volume={volume}
              isMuted={isMuted}
              onPlayPause={handlePlayPause}
              onSeek={handleSeek}
              onVolumeChange={handleVolumeChange}
              onMuteToggle={handleMuteToggle}
              onFullscreen={handleFullscreen}
            />
          </>
        ) : (
          <View style={[styles.directPlaceholder, { height: playerHeight }]}>
            <FontAwesome name="play-circle" size={48} color={colors.crtBlue} />
            <Text style={styles.directText}>Direct video playback</Text>
          </View>
        )}

        {/* Up Next auto-play overlay */}
        {showUpNext && upNextVideo && (
          <View style={styles.upNextOverlay}>
            <Text style={styles.upNextOverlayTitle}>Up Next</Text>
            <Text style={styles.upNextOverlayVideo} numberOfLines={1}>
              {upNextVideo.title}
            </Text>
            <View style={styles.upNextOverlayButtons}>
              <Text style={styles.upNextPlayNow} onPress={advanceToNext}>
                Play Now
              </Text>
              <Text style={styles.upNextCancel} onPress={cancelUpNext}>
                Cancel
              </Text>
            </View>
          </View>
        )}
      </View>

      {/* Video info + Up Next list */}
      <ScrollView style={styles.infoScroll}>
        <View style={[styles.infoContainer, { maxWidth: MAX_PLAYER_WIDTH, alignSelf: 'center', width: '100%' }]}>
          <Text style={styles.videoTitle}>{displayVideo?.title}</Text>
          <View style={styles.metaRow}>
            {channel ? (
              <Text style={styles.channelName}>{channel.title}</Text>
            ) : null}
            <Text style={styles.duration}>
              {formatDuration(displayVideo?.duration ?? 0)}
            </Text>
          </View>
          <Text style={styles.videoDescription}>{displayVideo?.description}</Text>
        </View>

        {upNext.length > 0 ? (
          <View style={[styles.upNextSection, { maxWidth: MAX_PLAYER_WIDTH, alignSelf: 'center', width: '100%' }]}>
            <Text style={styles.upNextSectionTitle}>Up Next</Text>
            {upNext.map((v) => (
              <VideoCard
                key={v.id}
                video={v}
                onPress={() => router.replace(`/player/${v.id}`)}
              />
            ))}
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.dark,
  },
  loadingArea: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: colors.crtBlue,
    fontSize: 16,
    fontFamily: typography.body.fontFamily,
  },
  playerWrapper: {
    backgroundColor: '#000',
    position: 'relative',
  },
  directPlaceholder: {
    backgroundColor: '#000',
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing.sm,
  },
  directText: {
    color: colors.textSecondary,
    fontSize: 14,
    fontFamily: typography.body.fontFamily,
  },
  upNextOverlay: {
    position: 'absolute',
    bottom: 50,
    left: spacing.md,
    right: spacing.md,
    backgroundColor: 'rgba(0,0,0,0.85)',
    borderRadius: 12,
    padding: spacing.md,
    zIndex: 30,
  },
  upNextOverlayTitle: {
    color: colors.crtBlue,
    fontSize: 12,
    fontFamily: typography.subheading.fontFamily,
    marginBottom: 4,
  },
  upNextOverlayVideo: {
    color: '#fff',
    fontSize: 14,
    fontFamily: typography.body.fontFamily,
    marginBottom: spacing.sm,
  },
  upNextOverlayButtons: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  upNextPlayNow: {
    color: colors.crtBlue,
    fontSize: 14,
    fontFamily: typography.subheading.fontFamily,
  },
  upNextCancel: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 14,
    fontFamily: typography.body.fontFamily,
  },
  infoScroll: {
    flex: 1,
  },
  infoContainer: {
    padding: spacing.md,
  },
  videoTitle: {
    fontFamily: typography.subheading.fontFamily,
    fontSize: 18,
    color: '#fff',
    marginBottom: spacing.xs,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  channelName: {
    fontFamily: typography.body.fontFamily,
    fontSize: 14,
    color: colors.crtBlue,
  },
  duration: {
    fontFamily: typography.caption.fontFamily,
    fontSize: 12,
    color: colors.textSecondary,
  },
  videoDescription: {
    fontFamily: typography.body.fontFamily,
    fontSize: 14,
    color: colors.textSecondary,
    lineHeight: 20,
  },
  upNextSection: {
    padding: spacing.md,
    paddingTop: 0,
  },
  upNextSectionTitle: {
    fontFamily: typography.subheading.fontFamily,
    fontSize: 16,
    color: '#fff',
    marginBottom: spacing.sm,
  },
});

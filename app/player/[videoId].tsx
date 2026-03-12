import { useEffect, useRef, useCallback, useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  Platform,
  useWindowDimensions,
} from 'react-native';

let createPortal: any = null;
if (Platform.OS === 'web') {
  try { createPortal = require('react-dom').createPortal; } catch {}
}
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { colors, spacing, typography } from '@src/constants/theme';
import { usePlayerStore } from '@src/stores/usePlayerStore';
import { useHistoryStore } from '@src/stores/useHistoryStore';
import { useParentStore } from '@src/stores/useParentStore';
import { useChannelStore } from '@src/stores/useChannelStore';
import { useLearningGateStore } from '@src/stores/useLearningGateStore';
import LearningGate from '@src/components/LearningGate/LearningGate';
import { formatDuration } from '@src/utils/format';
import VideoCard from '@src/components/VideoCard';
import YouTubePlayer from '@src/components/YouTubePlayer';
import DirectVideoPlayer from '@src/components/DirectVideoPlayer';
import PBSPlayer from '@src/components/PBSPlayer';
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
  const playlistVideoCache = useParentStore((s) => s.playlistVideoCache);
  const learningGateEnabled = useParentStore((s) => s.learningGateEnabled);
  const childAge = useParentStore((s) => s.childAge);
  const gateFrequency = useParentStore((s) => s.gateFrequency);
  const videosPerGate = useParentStore((s) => s.videosPerGate);
  const shouldShowGate = useLearningGateStore((s) => s.shouldShowGate);
  const incrementWatched = useLearningGateStore((s) => s.incrementWatched);
  const markSessionPassed = useLearningGateStore((s) => s.markSessionPassed);

  const allChannelVideos = useChannelStore((s) => s.allChannelVideos);
  const channelVideosMap = useChannelStore((s) => s.channelVideos);

  // Gate cleared state — compute eagerly so we skip gate when disabled
  const [gateCleared, setGateCleared] = useState(() => {
    const gateConfig = { learningGateEnabled, gateFrequency, videosPerGate };
    return !useLearningGateStore.getState().shouldShowGate(gateConfig);
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

  // Resolve video from channel store or playlist cache.
  // Subscribe to allChannelVideos (not the stable getVideoById fn) so this
  // component re-renders when the store is populated after navigation.
  const resolvedVideo = videoId
    ? (allChannelVideos.find((v) => v.id === videoId) ?? playlistVideoCache[videoId])
    : undefined;

  // Get channel videos for Up Next
  const channelVideoList = channelVideosMap[resolvedVideo?.channelId ?? ''] ?? [];

  // Channel title from subscribed channel (we don't have a separate channel type anymore)
  const channelTitle = resolvedVideo?.channelId ?? '';

  // Build queue from channel videos after the current one
  useEffect(() => {
    if (resolvedVideo && channelVideoList.length > 0) {
      const currentIndex = channelVideoList.findIndex((v) => v.id === resolvedVideo.id);
      const remaining = currentIndex >= 0 ? channelVideoList.slice(currentIndex + 1) : [];
      setQueue(remaining);
    }
  }, [resolvedVideo?.id, channelVideoList.length]);

  // Initialize current video on mount — waits for gate to be cleared
  useEffect(() => {
    if (resolvedVideo && gateCleared) {
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
  }, [resolvedVideo?.id, gateCleared]);

  const handleGatePass = useCallback(() => {
    if (gateFrequency === 'session') {
      markSessionPassed();
    } else {
      incrementWatched();
    }
    setGateCleared(true);
  }, [gateFrequency, markSessionPassed, incrementWatched]);

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
        if (!seekingRef.current) {
          setIsPlaying(false);
        }
      } else if (state === 'ended') {
        seekingRef.current = false;
        setIsPlaying(false);
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

      if (nextVideo.source === 'youtube' && nextVideo.youtubeVideoId) {
        // YouTube: seamlessly load next video in the same iframe
        playNext();
        setProgress(0, 0);
        playerRef.current?.loadVideo(nextVideo.youtubeVideoId);
        currentVideoIdRef.current = nextVideo.id;
        setIsPlaying(true);
        addEntry({
          videoId: nextVideo.id,
          channelId: nextVideo.channelId,
          watchedAt: Date.now(),
          watchedDuration: 0,
          completed: false,
        });
      } else {
        // PBS and other sources: navigate to new player screen
        playNext();
        router.replace(`/player/${nextVideo.id}`);
      }
    }
  }, [router, playNext, setProgress, setIsPlaying, addEntry]);

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
    const container = playerContainerRef.current as unknown as HTMLElement | null;
    if (!container) return;
    if (document.fullscreenElement) {
      document.exitFullscreen();
    } else {
      container.requestFullscreen();
    }
  }, []);

  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const handler = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', handler);
    return () => document.removeEventListener('fullscreenchange', handler);
  }, []);

  useFocusEffect(
    useCallback(() => {
      return () => {
        playerRef.current?.pause();
        setIsPlaying(false);
      };
    }, [setIsPlaying])
  );

  const playerWidth = isFullscreen ? windowWidth : Math.min(windowWidth, MAX_PLAYER_WIDTH);
  const playerHeight = isFullscreen ? windowHeight : Math.round(playerWidth * (9 / 16));
  const displayVideo = currentVideo ?? resolvedVideo;
  const upNextVideo = queue.length > 0 ? queue[0] : null;
  const upNext = channelVideoList.filter((v) => v.id !== (displayVideo?.id ?? videoId));

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
      {/* Learning Gate */}
      {createPortal && typeof document !== 'undefined'
        ? createPortal(
            <LearningGate visible={!gateCleared} childAge={childAge} onPass={handleGatePass} />,
            document.body
          )
        : <LearningGate visible={!gateCleared} childAge={childAge} onPass={handleGatePass} />}

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
        ) : displayVideo?.source === 'pbskids' && displayVideo.directUrl ? (
          <>
            <DirectVideoPlayer
              ref={playerRef}
              url={displayVideo.directUrl}
              width={playerWidth}
              height={playerHeight}
              play={isPlaying && gateCleared}
              mute={isMuted}
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
        ) : displayVideo?.source === 'pbskids' && displayVideo.pbsPartnerToken ? (
          /* PBS DRM video — use PBS partner player (web: iframe, native: WebView) */
          <PBSPlayer
            token={displayVideo.pbsPartnerToken}
            width={playerWidth}
            height={playerHeight}
            autoplay
          />
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
            {channelTitle ? (
              <Text style={styles.channelName}>{channelTitle}</Text>
            ) : null}
            <Text style={styles.duration}>
              {formatDuration(displayVideo?.duration ?? 0)}
            </Text>
          </View>
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

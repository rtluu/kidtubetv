import React, { useState, useMemo, useRef, useCallback, useEffect } from 'react';
import {
  StyleSheet,
  View,
  Text,
  Image,
  Pressable,
  Platform,
  ScrollView,
  useWindowDimensions,
} from 'react-native';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { Video, Channel } from '@src/types/video';
import { formatDuration } from '@src/utils/format';
import { colors, spacing, borderRadius, shadows, typography } from '@src/constants/theme';
import YouTubePlayer, { YouTubePlayerHandle, PlayerState } from '@src/components/YouTubePlayer';
import PremiumPlayerOverlay from '@src/components/PremiumPlayerOverlay';
import { useParentStore } from '@src/stores/useParentStore';
import { useLearningGateStore } from '@src/stores/useLearningGateStore';
import LearningGate from '@src/components/LearningGate/LearningGate';

// Portal support — renders overlay at document.body to escape all
// parent stacking contexts (RN Web Views add z-index:0 which traps children)
let createPortal: any = null;
if (Platform.OS === 'web') {
  try {
    createPortal = require('react-dom').createPortal;
  } catch {}
}

interface HomeVideoCardProps {
  video: Video;
  channel?: Channel;
  mode: 'rows' | 'feed' | 'grid';
  cardWidth: number;
  instanceId?: string;
  isPreview?: boolean;
  isExpanded?: boolean;
  onPreviewStart?: (instanceId: string) => void;
  onPreviewEnd?: () => void;
  onExpand?: (instanceId: string) => void;
  onCollapse?: () => void;
  upNextVideos?: Video[];
  onPlayVideo?: (videoId: string) => void;
}

const HOVER_DELAY_MS = 800;

export default function HomeVideoCard({
  video,
  channel,
  mode,
  cardWidth,
  instanceId,
  isPreview = false,
  isExpanded = false,
  onPreviewStart,
  onPreviewEnd,
  onExpand,
  onCollapse,
  upNextVideos = [],
  onPlayVideo,
}: HomeVideoCardProps) {
  // Unique identifier for this card instance — defaults to video.id but can be
  // overridden (e.g. "sectionId:videoId") to prevent duplicate-card expansion
  // when the same video appears in multiple sections (playlist + channel).
  const cardInstanceId = instanceId ?? video.id;
  const videoStartTimes = useParentStore((s) => s.videoStartTimes);
  const learningGateEnabled = useParentStore((s) => s.learningGateEnabled);
  const childAge = useParentStore((s) => s.childAge);
  const gateFrequency = useParentStore((s) => s.gateFrequency);
  const videosPerGate = useParentStore((s) => s.videosPerGate);
  const shouldShowGate = useLearningGateStore((s) => s.shouldShowGate);
  const incrementWatched = useLearningGateStore((s) => s.incrementWatched);
  const markSessionPassed = useLearningGateStore((s) => s.markSessionPassed);

  const [showGate, setShowGate] = useState(false);
  const [pendingExpand, setPendingExpand] = useState(false);
  const thumbnailHeight = Math.round(cardWidth * (9 / 16));
  const hoverTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const expandedPlayerRef = useRef<YouTubePlayerHandle>(null);
  const expandedContainerRef = useRef<View>(null);
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();

  // Premium player overlay state
  const [expandedPlayerState, setExpandedPlayerState] = useState<PlayerState>('unstarted');
  const [expandedCurrentTime, setExpandedCurrentTime] = useState(0);
  const [expandedDuration, setExpandedDuration] = useState(0);
  const [expandedBuffered, setExpandedBuffered] = useState(0);
  const [expandedVolume, setExpandedVolume] = useState(100);
  const [expandedMuted, setExpandedMuted] = useState(false);
  const [expandedIsPlaying, setExpandedIsPlaying] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Track fullscreen changes to resize player
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const handler = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', handler);
    return () => document.removeEventListener('fullscreenchange', handler);
  }, []);

  // Track current video in expanded view (for Up Next switching)
  const [displayVideo, setDisplayVideo] = useState(video);

  // Reset when card collapses
  useEffect(() => {
    if (!isExpanded) {
      setDisplayVideo(video);
    }
  }, [video, isExpanded]);

  // Lock body scroll when expanded
  useEffect(() => {
    if (Platform.OS !== 'web' || !isExpanded) return;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = '';
    };
  }, [isExpanded]);

  // Responsive expanded sizing — 94% of viewport, max 1200px
  // When fullscreen, fill the entire viewport
  const expandedPlayerWidth = isFullscreen ? windowWidth : Math.min(Math.round(windowWidth * 0.94), 1200);
  const expandedPlayerHeight = isFullscreen ? windowHeight : Math.round(expandedPlayerWidth * (9 / 16));

  // Show inline preview player only when previewing AND not expanded
  const showInlinePlayer = isPreview && !isExpanded;
  const youtubeId = video.youtubeVideoId;
  const expandedYoutubeId = displayVideo.youtubeVideoId || youtubeId;

  // Premium overlay handlers
  // expandedIsPlaying is an *intent* flag — only change it on explicit user actions
  // or 'ended'. Don't set it false on transient 'paused'/'buffering' from seeks.
  const handleExpandedStateChange = useCallback((state: PlayerState) => {
    setExpandedPlayerState(state);
    if (state === 'ended') {
      setExpandedIsPlaying(false);
    }
  }, []);

  const handleExpandedProgress = useCallback((ct: number, dur: number) => {
    setExpandedCurrentTime(ct);
    setExpandedDuration(dur);
  }, []);

  const handleExpandedBufferProgress = useCallback((fraction: number) => {
    setExpandedBuffered(fraction);
  }, []);

  const handleExpandedPlayPause = useCallback(() => {
    if (expandedIsPlaying) {
      expandedPlayerRef.current?.pause();
      setExpandedIsPlaying(false);
    } else {
      expandedPlayerRef.current?.play();
      setExpandedIsPlaying(true);
    }
  }, [expandedIsPlaying]);

  const handleExpandedSeek = useCallback((seconds: number) => {
    expandedPlayerRef.current?.seekTo(seconds);
    // Resume playback after seeking (seekTo with controls:0 can fire transient pause)
    expandedPlayerRef.current?.play();
    setExpandedIsPlaying(true);
  }, []);

  const handleExpandedVolumeChange = useCallback((vol: number) => {
    setExpandedVolume(vol);
    expandedPlayerRef.current?.setVolume(vol);
    if (vol > 0 && expandedMuted) setExpandedMuted(false);
  }, [expandedMuted]);

  const handleExpandedMuteToggle = useCallback(() => {
    setExpandedMuted((prev) => !prev);
  }, []);

  const handleExpandedFullscreen = useCallback(() => {
    if (Platform.OS !== 'web') return;
    // RN Web View refs give us the underlying DOM element
    const container = expandedContainerRef.current as unknown as HTMLElement | null;
    if (!container) return;
    if (document.fullscreenElement) {
      document.exitFullscreen();
    } else {
      container.requestFullscreen();
    }
  }, []);

  const handleMouseEnter = useCallback(() => {
    if (Platform.OS !== 'web' || !onPreviewStart || !youtubeId || isExpanded) return;
    // In feed mode, preview is driven by scroll position — skip hover
    if (mode === 'feed') return;
    hoverTimer.current = setTimeout(() => {
      onPreviewStart(cardInstanceId);
    }, HOVER_DELAY_MS);
  }, [cardInstanceId, youtubeId, onPreviewStart, isExpanded, mode]);

  const handleMouseLeave = useCallback(() => {
    if (isExpanded) return;
    if (mode === 'feed') return;
    if (hoverTimer.current) {
      clearTimeout(hoverTimer.current);
      hoverTimer.current = null;
    }
    onPreviewEnd?.();
  }, [onPreviewEnd, isExpanded, mode]);

  const handlePress = useCallback(() => {
    if (isExpanded) return;
    const gateConfig = { learningGateEnabled, gateFrequency, videosPerGate };
    if (shouldShowGate(gateConfig)) {
      setShowGate(true);
      setPendingExpand(true);
      return;
    }
    if (!isPreview && onPreviewStart) {
      onPreviewStart(cardInstanceId);
    }
    onExpand?.(cardInstanceId);
  }, [isExpanded, isPreview, onPreviewStart, onExpand, cardInstanceId, learningGateEnabled, gateFrequency, videosPerGate, shouldShowGate]);

  const handleGatePass = useCallback(() => {
    setShowGate(false);
    if (gateFrequency === 'session') {
      markSessionPassed();
    } else {
      incrementWatched();
    }
    if (pendingExpand) {
      setPendingExpand(false);
      if (!isPreview && onPreviewStart) {
        onPreviewStart(cardInstanceId);
      }
      onExpand?.(cardInstanceId);
    }
  }, [pendingExpand, isPreview, onPreviewStart, onExpand, cardInstanceId, gateFrequency, incrementWatched, markSessionPassed]);

  const handleCollapse = useCallback(() => {
    onCollapse?.();
  }, [onCollapse]);

  const handleUpNext = useCallback((nextVideo: Video) => {
    if (nextVideo.youtubeVideoId) {
      const nextStart = videoStartTimes[nextVideo.id];
      expandedPlayerRef.current?.loadVideo(nextVideo.youtubeVideoId, nextStart);
      setDisplayVideo(nextVideo);
      onPlayVideo?.(nextVideo.id);
    }
  }, [onPlayVideo, videoStartTimes]);

  // Hover props on the entire card (not just thumbnail)
  const webHoverProps = Platform.OS === 'web' && !isExpanded
    ? { onMouseEnter: handleMouseEnter, onMouseLeave: handleMouseLeave }
    : {};

  const filteredUpNext = upNextVideos.filter((v) => v.id !== displayVideo.id);

  const cardStyle = useMemo(
    () => StyleSheet.flatten([
      styles.card,
      { width: cardWidth },
      mode === 'rows' ? { marginRight: spacing.sm } : { marginRight: 0 },
    ]),
    [cardWidth, mode]
  );

  // ── Expanded overlay (portaled to document.body on web) ──────────
  const expandedOverlay = isExpanded && expandedYoutubeId ? (
    <View style={styles.overlay}>
      {/* Dark backdrop — click to dismiss */}
      <Pressable style={styles.backdrop} onPress={handleCollapse} />

      {/* Close button — always visible above scroll content */}
      <Pressable style={styles.closeButton} onPress={handleCollapse}>
        <FontAwesome name="close" size={22} color="#fff" />
      </Pressable>

      {/* Scrollable content column */}
      <ScrollView
        style={styles.overlayScroll}
        contentContainerStyle={styles.overlayScrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Click-to-close wrapper — clicking empty space around content closes overlay */}
        <View
          style={styles.scrollClickArea}
          {...(Platform.OS === 'web' ? { onClick: handleCollapse } as any : {})}
        >
          {/* Content wrapper — stops click propagation so content clicks don't close */}
          <View
            style={{ width: expandedPlayerWidth }}
            {...(Platform.OS === 'web' ? { onClick: (e: any) => e.stopPropagation() } as any : {})}
          >
            {/* Player — responsive 16:9 */}
            <View
              ref={expandedContainerRef}
              style={[styles.expandedPlayer, {
                width: expandedPlayerWidth,
                height: expandedPlayerHeight,
              }]}
            >
              <YouTubePlayer
                ref={expandedPlayerRef}
                videoId={expandedYoutubeId}
                width={expandedPlayerWidth}
                height={expandedPlayerHeight}
                play={expandedIsPlaying}
                mute={expandedMuted}
                customControls
                startTime={videoStartTimes[displayVideo.id]}
                onStateChange={handleExpandedStateChange}
                onProgress={handleExpandedProgress}
                onBufferProgress={handleExpandedBufferProgress}
              />
              <PremiumPlayerOverlay
                playerState={expandedPlayerState}
                currentTime={expandedCurrentTime}
                duration={expandedDuration}
                bufferedFraction={expandedBuffered}
                volume={expandedVolume}
                isMuted={expandedMuted}
                onPlayPause={handleExpandedPlayPause}
                onSeek={handleExpandedSeek}
                onVolumeChange={handleExpandedVolumeChange}
                onMuteToggle={handleExpandedMuteToggle}
                onFullscreen={handleExpandedFullscreen}
              />
            </View>

            {/* Video info */}
            <View style={styles.expandedExtras}>
              <View style={styles.expandedInfo}>
                {channel && (
                  <Text style={styles.expandedChannelName} numberOfLines={1}>
                    {channel.title}
                  </Text>
                )}
                <Text style={styles.expandedVideoTitle} numberOfLines={2}>
                  {displayVideo.title}
                </Text>
              </View>

              {/* Up Next list */}
              {filteredUpNext.length > 0 && (
                <View>
                  <Text style={styles.upNextHeader}>Up Next</Text>
                  {filteredUpNext.map((v) => (
                    <Pressable
                      key={v.id}
                      style={styles.upNextItem}
                      onPress={() => handleUpNext(v)}
                    >
                      <Image
                        source={{ uri: v.thumbnailUrl }}
                        style={styles.upNextThumbnail}
                      />
                      <View style={styles.upNextInfo}>
                        <Text style={styles.upNextTitle} numberOfLines={2}>
                          {v.title}
                        </Text>
                        <Text style={styles.upNextDuration}>
                          {formatDuration(v.duration)}
                        </Text>
                      </View>
                    </Pressable>
                  ))}
                </View>
              )}
            </View>
          </View>
        </View>
      </ScrollView>
    </View>
  ) : null;

  return (
    <View>
      {/* ── Inline card ─────────────────────────────────────── */}
      <Pressable
        style={cardStyle}
        onPress={handlePress}
        disabled={isExpanded}
        {...webHoverProps as any}
      >
        <View
          style={[styles.thumbnailContainer, { height: thumbnailHeight }]}
        >
          {showInlinePlayer && youtubeId ? (
            <>
              <YouTubePlayer
                videoId={youtubeId}
                width={cardWidth}
                height={thumbnailHeight}
                play
                mute
                cropped
                startTime={videoStartTimes[video.id]}
              />
              {/* Transparent click blocker — intercepts iframe clicks
                  so they trigger expansion instead of pausing */}
              <Pressable
                style={StyleSheet.absoluteFill}
                onPress={handlePress}
              />
            </>
          ) : (
            <Image source={{ uri: video.thumbnailUrl }} style={styles.thumbnail} />
          )}
          {!showInlinePlayer && (
            <View style={styles.durationBadge}>
              <Text style={styles.durationText}>{formatDuration(video.duration)}</Text>
            </View>
          )}
        </View>
        <View style={styles.info}>
          {channel && (
            <Text style={styles.channelName} numberOfLines={1}>
              {channel.title}
            </Text>
          )}
          <Text style={styles.title} numberOfLines={2}>
            {video.title}
          </Text>
        </View>
      </Pressable>

      {/* ── Expanded overlay — portaled to document.body on web ── */}
      {expandedOverlay && createPortal && typeof document !== 'undefined'
        ? createPortal(expandedOverlay, document.body)
        : expandedOverlay}

      {/* ── Learning Gate modal — portaled to document.body on web to escape
           the ScrollView's transform stacking context ── */}
      {createPortal && typeof document !== 'undefined'
        ? createPortal(
            <LearningGate visible={showGate} childAge={childAge} onPass={handleGatePass} />,
            document.body
          )
        : <LearningGate visible={showGate} childAge={childAge} onPass={handleGatePass} />}
    </View>
  );
}

const styles = StyleSheet.create({
  // ── Card ──────────────────────────────────────────
  card: {
    backgroundColor: colors.card,
    borderRadius: borderRadius.md,
    overflow: 'hidden',
    marginBottom: spacing.sm,
    ...shadows.card,
  },
  thumbnailContainer: {
    width: '100%',
    position: 'relative',
    backgroundColor: '#000',
    overflow: 'hidden',
  },
  thumbnail: {
    width: '100%',
    height: '100%',
  },
  durationBadge: {
    position: 'absolute',
    bottom: 6,
    right: 6,
    backgroundColor: 'rgba(0,0,0,0.8)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  durationText: {
    color: '#fff',
    fontSize: 11,
    fontFamily: typography.caption.fontFamily,
  },
  info: {
    padding: spacing.sm,
  },
  channelName: {
    fontFamily: typography.caption.fontFamily,
    fontSize: 11,
    color: colors.crtBlue,
    marginBottom: 2,
  },
  title: {
    fontFamily: typography.subheading.fontFamily,
    fontSize: 13,
    color: colors.textPrimary,
    lineHeight: 18,
  },

  // ── Expanded overlay ──────────────────────────────
  overlay: {
    ...(Platform.OS === 'web'
      ? { position: 'fixed' as any, top: 0, left: 0, right: 0, bottom: 0 }
      : { position: 'absolute' as any, top: 0, left: 0, right: 0, bottom: 0 }),
    zIndex: 99999,
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.92)',
  },
  closeButton: {
    position: 'absolute',
    top: 12,
    right: 16,
    zIndex: 10,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  overlayScroll: {
    flex: 1,
  },
  overlayScrollContent: {
    flexGrow: 1,
  },
  scrollClickArea: {
    flex: 1,
    alignItems: 'center',
    paddingTop: 20,
    paddingBottom: 40,
  },
  expandedPlayer: {
    backgroundColor: '#000',
    overflow: 'hidden',
  },
  expandedExtras: {
    paddingTop: spacing.sm,
  },
  expandedInfo: {
    paddingBottom: spacing.sm,
  },
  expandedChannelName: {
    fontFamily: typography.caption.fontFamily,
    fontSize: 12,
    color: colors.crtBlue,
    marginBottom: 4,
  },
  expandedVideoTitle: {
    fontFamily: typography.subheading.fontFamily,
    fontSize: 17,
    color: '#fff',
    lineHeight: 24,
  },

  // ── Up Next ───────────────────────────────────────
  upNextHeader: {
    fontFamily: typography.subheading.fontFamily,
    fontSize: 15,
    color: 'rgba(255,255,255,0.7)',
    marginBottom: spacing.sm,
  },
  upNextItem: {
    flexDirection: 'row',
    marginBottom: spacing.sm,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: borderRadius.sm,
    overflow: 'hidden',
  },
  upNextThumbnail: {
    width: 120,
    height: 68,
  },
  upNextInfo: {
    flex: 1,
    padding: spacing.sm,
    justifyContent: 'center',
  },
  upNextTitle: {
    fontFamily: typography.caption.fontFamily,
    fontSize: 12,
    color: '#fff',
    lineHeight: 16,
  },
  upNextDuration: {
    fontFamily: typography.caption.fontFamily,
    fontSize: 11,
    color: colors.textSecondary,
    marginTop: 4,
  },
});

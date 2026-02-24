import { useEffect, useRef, useState, useCallback } from 'react';
import {
  StyleSheet,
  View,
  Text,
  Pressable,
  Animated,
  Platform,
} from 'react-native';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { colors, fontFamilies } from '@src/constants/theme';
import { formatDuration } from '@src/utils/format';
import type { PlayerState } from './YouTubePlayer';

interface PremiumPlayerOverlayProps {
  playerState: PlayerState;
  currentTime: number;
  duration: number;
  bufferedFraction: number;
  volume: number;
  isMuted: boolean;
  onPlayPause: () => void;
  onSeek: (seconds: number) => void;
  onVolumeChange: (volume: number) => void;
  onMuteToggle: () => void;
  onFullscreen: () => void;
}

const AUTO_HIDE_MS = 3000;

export default function PremiumPlayerOverlay({
  playerState,
  currentTime,
  duration,
  bufferedFraction,
  volume,
  isMuted,
  onPlayPause,
  onSeek,
  onVolumeChange,
  onMuteToggle,
  onFullscreen,
}: PremiumPlayerOverlayProps) {
  const [visible, setVisible] = useState(true);
  const [isDragging, setIsDragging] = useState(false);
  const [dragFraction, setDragFraction] = useState(0);
  const [showVolume, setShowVolume] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const opacity = useRef(new Animated.Value(1)).current;
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const seekBarRef = useRef<View>(null);
  const seekBarRect = useRef<{ left: number; top: number; width: number; height: number } | null>(null);
  const volumeBarRef = useRef<View>(null);
  const volumeBarRect = useRef<{ left: number; top: number; width: number; height: number } | null>(null);
  const volumeHideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const isPlaying = playerState === 'playing';
  const progress = duration > 0 ? currentTime / duration : 0;
  const displayProgress = isDragging ? dragFraction : progress;

  const show = useCallback(() => {
    if (hideTimer.current) clearTimeout(hideTimer.current);
    setVisible(true);
    Animated.timing(opacity, {
      toValue: 1,
      duration: 200,
      useNativeDriver: true,
    }).start();

    if (isPlaying && !isDragging) {
      hideTimer.current = setTimeout(() => {
        Animated.timing(opacity, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }).start(() => setVisible(false));
      }, AUTO_HIDE_MS);
    }
  }, [isPlaying, isDragging, opacity]);

  // Auto-hide logic
  useEffect(() => {
    if (isPlaying && visible && !isDragging) {
      if (hideTimer.current) clearTimeout(hideTimer.current);
      hideTimer.current = setTimeout(() => {
        Animated.timing(opacity, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }).start(() => setVisible(false));
      }, AUTO_HIDE_MS);
    }
    if (!isPlaying) {
      show();
    }
    return () => {
      if (hideTimer.current) clearTimeout(hideTimer.current);
    };
  }, [isPlaying, isDragging]);

  // Listen for fullscreenchange
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const handler = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handler);
    return () => document.removeEventListener('fullscreenchange', handler);
  }, []);

  // Seek bar drag (web pointer events)
  const handleSeekPointerDown = useCallback((e: any) => {
    if (Platform.OS !== 'web') return;
    e.stopPropagation();
    e.preventDefault();

    const node = seekBarRef.current as any;
    if (!node) return;
    const domNode: HTMLElement | null = node instanceof HTMLElement ? node : node;
    if (!domNode) return;

    const rect = domNode.getBoundingClientRect();
    seekBarRect.current = rect;
    const fraction = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    setDragFraction(fraction);
    setIsDragging(true);

    const handleMove = (ev: PointerEvent) => {
      if (seekBarRect.current) {
        const f = Math.max(0, Math.min(1, (ev.clientX - seekBarRect.current.left) / seekBarRect.current.width));
        setDragFraction(f);
      }
    };

    const handleUp = (ev: PointerEvent) => {
      document.removeEventListener('pointermove', handleMove);
      document.removeEventListener('pointerup', handleUp);
      if (seekBarRect.current && duration > 0) {
        const f = Math.max(0, Math.min(1, (ev.clientX - seekBarRect.current.left) / seekBarRect.current.width));
        onSeek(f * duration);
      }
      setIsDragging(false);
    };

    document.addEventListener('pointermove', handleMove);
    document.addEventListener('pointerup', handleUp);
  }, [duration, onSeek]);

  // Seek bar tap (non-drag, for native / simple clicks)
  const handleSeekPress = useCallback((e: any) => {
    if (isDragging) return;
    const node = seekBarRef.current as any;
    if (!node) return;
    if (Platform.OS === 'web') {
      const domNode = node as HTMLElement;
      const rect = domNode.getBoundingClientRect();
      const x = (e.nativeEvent?.clientX ?? e.nativeEvent?.pageX ?? 0) - rect.left;
      const fraction = Math.max(0, Math.min(1, x / rect.width));
      if (duration > 0) onSeek(fraction * duration);
    } else {
      const x = e.nativeEvent?.locationX ?? 0;
      const width = e.nativeEvent?.layout?.width ?? 1;
      const fraction = Math.max(0, Math.min(1, x / width));
      if (duration > 0) onSeek(fraction * duration);
    }
    show();
  }, [duration, onSeek, show, isDragging]);

  // Volume slider drag (web)
  const handleVolumePointerDown = useCallback((e: any) => {
    if (Platform.OS !== 'web') return;
    e.stopPropagation();
    e.preventDefault();

    const node = volumeBarRef.current as any;
    if (!node) return;
    const rect = (node as HTMLElement).getBoundingClientRect();
    volumeBarRect.current = rect;

    const updateVol = (clientX: number) => {
      if (!volumeBarRect.current) return;
      const f = Math.max(0, Math.min(1, (clientX - volumeBarRect.current.left) / volumeBarRect.current.width));
      onVolumeChange(Math.round(f * 100));
    };

    updateVol(e.clientX);

    const handleMove = (ev: PointerEvent) => updateVol(ev.clientX);
    const handleUp = () => {
      document.removeEventListener('pointermove', handleMove);
      document.removeEventListener('pointerup', handleUp);
    };

    document.addEventListener('pointermove', handleMove);
    document.addEventListener('pointerup', handleUp);
  }, [onVolumeChange]);

  const handleFullscreen = useCallback(() => {
    onFullscreen();
  }, [onFullscreen]);

  const volumeIcon = isMuted || volume === 0
    ? 'volume-off'
    : volume <= 50
      ? 'volume-down'
      : 'volume-up';

  const volumeAreaProps = Platform.OS === 'web' ? {
    onMouseEnter: () => {
      if (volumeHideTimer.current) clearTimeout(volumeHideTimer.current);
      setShowVolume(true);
    },
    onMouseLeave: () => {
      volumeHideTimer.current = setTimeout(() => setShowVolume(false), 300);
    },
  } : {};

  // Web-only gradients via inline div styles
  const isWeb = Platform.OS === 'web';

  return (
    <View
      style={StyleSheet.absoluteFill}
      {...(isWeb ? { onMouseMove: show } as any : {})}
    >
      {/* Tap anywhere to play/pause + show controls */}
      <Pressable style={StyleSheet.absoluteFill} onPress={() => { onPlayPause(); show(); }} />

      <Animated.View
        style={[StyleSheet.absoluteFill, { opacity }]}
        pointerEvents={visible ? 'box-none' : 'none'}
      >
        {/* Center play/pause */}
        <View style={styles.centerControls} pointerEvents="box-none">
          <Pressable
            style={styles.playPauseButton}
            onPress={() => { onPlayPause(); show(); }}
          >
            <FontAwesome
              name={isPlaying ? 'pause' : 'play'}
              size={32}
              color="#fff"
            />
          </Pressable>
        </View>

        {/* Bottom bar */}
        {isWeb ? (
          // @ts-ignore
          <div
            style={{
              position: 'absolute' as any,
              bottom: 0,
              left: 0,
              right: 0,
              background: 'linear-gradient(to top, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0.4) 70%, transparent 100%)',
              paddingTop: 30,
              paddingBottom: 8,
              paddingLeft: 12,
              paddingRight: 12,
              zIndex: 5,
            }}
            onClick={(e: any) => e.stopPropagation()}
          >
            {/* Seek bar */}
            {/* @ts-ignore */}
            <div
              ref={seekBarRef as any}
              style={{
                height: 20,
                display: 'flex',
                alignItems: 'center',
                cursor: 'pointer',
                marginBottom: 4,
                position: 'relative' as any,
              }}
              onPointerDown={handleSeekPointerDown}
            >
              {/* Track background */}
              {/* @ts-ignore */}
              <div style={{
                position: 'absolute' as any,
                left: 0,
                right: 0,
                height: isDragging ? 5 : 3,
                borderRadius: 2,
                backgroundColor: 'rgba(255,255,255,0.2)',
                top: '50%',
                transform: 'translateY(-50%)',
              }} />
              {/* Buffered */}
              {/* @ts-ignore */}
              <div style={{
                position: 'absolute' as any,
                left: 0,
                width: `${bufferedFraction * 100}%`,
                height: isDragging ? 5 : 3,
                borderRadius: 2,
                backgroundColor: 'rgba(255,255,255,0.35)',
                top: '50%',
                transform: 'translateY(-50%)',
              }} />
              {/* Played */}
              {/* @ts-ignore */}
              <div style={{
                position: 'absolute' as any,
                left: 0,
                width: `${displayProgress * 100}%`,
                height: isDragging ? 5 : 3,
                borderRadius: 2,
                backgroundColor: colors.vhsRed,
                top: '50%',
                transform: 'translateY(-50%)',
              }} />
              {/* Thumb */}
              {/* @ts-ignore */}
              <div style={{
                position: 'absolute' as any,
                left: `${displayProgress * 100}%`,
                top: '50%',
                width: isDragging ? 14 : 12,
                height: isDragging ? 14 : 12,
                borderRadius: '50%',
                backgroundColor: '#fff',
                transform: 'translate(-50%, -50%)',
                transition: isDragging ? 'none' : 'width 0.1s, height 0.1s',
              }} />
            </div>

            {/* Controls row */}
            {/* @ts-ignore */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              height: 32,
            }}>
              {/* Left controls */}
              {/* @ts-ignore */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                {/* @ts-ignore */}
                <div
                  onClick={(e: any) => { e.stopPropagation(); onPlayPause(); }}
                  style={{ cursor: 'pointer', padding: 4, display: 'flex', alignItems: 'center' }}
                >
                  <FontAwesome name={isPlaying ? 'pause' : 'play'} size={14} color="#fff" />
                </div>

                {/* Time display */}
                {/* @ts-ignore */}
                <div style={{
                  color: 'rgba(255,255,255,0.9)',
                  fontSize: 12,
                  fontFamily: fontFamilies.body,
                  userSelect: 'none',
                }}>
                  {formatDuration(Math.floor(isDragging ? dragFraction * duration : currentTime))} / {formatDuration(Math.floor(duration))}
                </div>
              </div>

              {/* Right controls */}
              {/* @ts-ignore */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                {/* Volume */}
                {/* @ts-ignore */}
                <div
                  style={{ display: 'flex', alignItems: 'center', position: 'relative' as any }}
                  {...volumeAreaProps}
                >
                  {/* @ts-ignore */}
                  <div
                    onClick={(e: any) => { e.stopPropagation(); onMuteToggle(); }}
                    style={{ cursor: 'pointer', padding: 4, display: 'flex', alignItems: 'center' }}
                  >
                    <FontAwesome name={volumeIcon} size={14} color="#fff" />
                  </div>
                  {showVolume && (
                    // @ts-ignore
                    <div
                      ref={volumeBarRef as any}
                      style={{
                        width: 80,
                        height: 20,
                        display: 'flex',
                        alignItems: 'center',
                        cursor: 'pointer',
                        position: 'relative' as any,
                        marginLeft: 4,
                      }}
                      onPointerDown={handleVolumePointerDown}
                    >
                      {/* @ts-ignore */}
                      <div style={{
                        position: 'absolute' as any,
                        left: 0,
                        right: 0,
                        height: 3,
                        borderRadius: 2,
                        backgroundColor: 'rgba(255,255,255,0.2)',
                        top: '50%',
                        transform: 'translateY(-50%)',
                      }} />
                      {/* @ts-ignore */}
                      <div style={{
                        position: 'absolute' as any,
                        left: 0,
                        width: `${isMuted ? 0 : volume}%`,
                        height: 3,
                        borderRadius: 2,
                        backgroundColor: '#fff',
                        top: '50%',
                        transform: 'translateY(-50%)',
                      }} />
                      {/* @ts-ignore */}
                      <div style={{
                        position: 'absolute' as any,
                        left: `${isMuted ? 0 : volume}%`,
                        top: '50%',
                        width: 10,
                        height: 10,
                        borderRadius: '50%',
                        backgroundColor: '#fff',
                        transform: 'translate(-50%, -50%)',
                      }} />
                    </div>
                  )}
                </div>

                {/* Fullscreen */}
                {/* @ts-ignore */}
                <div
                  onClick={(e: any) => { e.stopPropagation(); handleFullscreen(); }}
                  style={{ cursor: 'pointer', padding: 4, display: 'flex', alignItems: 'center' }}
                >
                  <FontAwesome name={isFullscreen ? 'compress' : 'expand'} size={14} color="#fff" />
                </div>
              </div>
            </div>
          </div>
        ) : (
          /* Native fallback — simplified bottom bar */
          <View style={styles.bottomBar}>
            <Pressable
              ref={seekBarRef}
              style={styles.seekBarContainer}
              onPress={handleSeekPress}
            >
              <View style={styles.seekBarTrack}>
                <View style={[styles.seekBarBuffered, { width: `${bufferedFraction * 100}%` as any }]} />
                <View style={[styles.seekBarProgress, { width: `${displayProgress * 100}%` as any }]} />
                <View style={[styles.seekBarThumb, { left: `${displayProgress * 100}%` as any }]} />
              </View>
            </Pressable>
            <View style={styles.controlsRow}>
              <Pressable onPress={onPlayPause} style={styles.controlBtn}>
                <FontAwesome name={isPlaying ? 'pause' : 'play'} size={14} color="#fff" />
              </Pressable>
              <Text style={styles.timeText}>
                {formatDuration(Math.floor(currentTime))} / {formatDuration(Math.floor(duration))}
              </Text>
              <View style={styles.rightControls}>
                <Pressable onPress={onMuteToggle} style={styles.controlBtn}>
                  <FontAwesome name={volumeIcon} size={14} color="#fff" />
                </Pressable>
                <Pressable onPress={handleFullscreen} style={styles.controlBtn}>
                  <FontAwesome name={isFullscreen ? 'compress' : 'expand'} size={14} color="#fff" />
                </Pressable>
              </View>
            </View>
          </View>
        )}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  centerControls: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
  },
  playPauseButton: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 12,
    paddingBottom: 8,
    paddingTop: 30,
    backgroundColor: 'rgba(0,0,0,0.6)',
    zIndex: 5,
  },
  seekBarContainer: {
    height: 20,
    justifyContent: 'center',
    marginBottom: 4,
  },
  seekBarTrack: {
    height: 3,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 2,
    overflow: 'visible',
  },
  seekBarBuffered: {
    position: 'absolute',
    height: 3,
    backgroundColor: 'rgba(255,255,255,0.35)',
    borderRadius: 2,
  },
  seekBarProgress: {
    position: 'absolute',
    height: 3,
    backgroundColor: colors.vhsRed,
    borderRadius: 2,
  },
  seekBarThumb: {
    position: 'absolute',
    top: -5,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#fff',
    marginLeft: -6,
  },
  controlsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 32,
  },
  controlBtn: {
    padding: 4,
    marginHorizontal: 4,
  },
  timeText: {
    color: 'rgba(255,255,255,0.9)',
    fontSize: 12,
    fontFamily: fontFamilies.body,
    marginLeft: 8,
    flex: 1,
  },
  rightControls: {
    flexDirection: 'row',
    alignItems: 'center',
  },
});

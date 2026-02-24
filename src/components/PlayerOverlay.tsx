import { useEffect, useRef, useState, useCallback } from 'react';
import {
  StyleSheet,
  View,
  Text,
  Pressable,
  Animated,
  LayoutChangeEvent,
} from 'react-native';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { colors, spacing, fontFamilies } from '@src/constants/theme';
import { formatDuration } from '@src/utils/format';
import type { PlayerState } from './YouTubePlayer';

interface PlayerOverlayProps {
  playerState: PlayerState;
  currentTime: number;
  duration: number;
  isMuted: boolean;
  channelTitle?: string;
  videoTitle: string;
  upNextTitle?: string;
  onPlayPause: () => void;
  onSeek: (seconds: number) => void;
  onMuteToggle: () => void;
  onClose: () => void;
}

const AUTO_HIDE_MS = 3000;

export default function PlayerOverlay({
  playerState,
  currentTime,
  duration,
  isMuted,
  channelTitle,
  videoTitle,
  upNextTitle,
  onPlayPause,
  onSeek,
  onMuteToggle,
  onClose,
}: PlayerOverlayProps) {
  const [visible, setVisible] = useState(true);
  const opacity = useRef(new Animated.Value(1)).current;
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const seekBarWidth = useRef(0);

  const isPlaying = playerState === 'playing';
  const progress = duration > 0 ? currentTime / duration : 0;

  const show = useCallback(() => {
    if (hideTimer.current) clearTimeout(hideTimer.current);
    setVisible(true);
    Animated.timing(opacity, {
      toValue: 1,
      duration: 200,
      useNativeDriver: true,
    }).start();

    if (isPlaying) {
      hideTimer.current = setTimeout(() => {
        Animated.timing(opacity, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }).start(() => setVisible(false));
      }, AUTO_HIDE_MS);
    }
  }, [isPlaying, opacity]);

  const toggle = useCallback(() => {
    if (visible) {
      if (hideTimer.current) clearTimeout(hideTimer.current);
      Animated.timing(opacity, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }).start(() => setVisible(false));
    } else {
      show();
    }
  }, [visible, show, opacity]);

  // Auto-hide when playing starts
  useEffect(() => {
    if (isPlaying && visible) {
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
  }, [isPlaying]);

  const handleSeekBarPress = useCallback(
    (evt: any) => {
      if (seekBarWidth.current <= 0 || duration <= 0) return;
      const x = evt.nativeEvent.locationX ?? evt.nativeEvent.offsetX ?? 0;
      const fraction = Math.max(0, Math.min(1, x / seekBarWidth.current));
      onSeek(fraction * duration);
      show();
    },
    [duration, onSeek, show]
  );

  const handleSeekBarLayout = useCallback((e: LayoutChangeEvent) => {
    seekBarWidth.current = e.nativeEvent.layout.width;
  }, []);

  return (
    <Pressable style={StyleSheet.absoluteFill} onPress={toggle}>
      {/* Close button — always visible */}
      <Pressable style={styles.closeButton} onPress={onClose}>
        <FontAwesome name="chevron-down" size={18} color="#fff" />
      </Pressable>

      {/* Mute button — always visible when muted */}
      {isMuted && (
        <Pressable style={styles.mutePrompt} onPress={onMuteToggle}>
          <FontAwesome name="volume-off" size={16} color="#fff" />
          <Text style={styles.muteText}>Tap to unmute</Text>
        </Pressable>
      )}

      <Animated.View
        style={[StyleSheet.absoluteFill, { opacity }]}
        pointerEvents={visible ? 'auto' : 'none'}
      >
        {/* Top info bar */}
        <View style={styles.topBar}>
          {channelTitle ? (
            <Text style={styles.channelText} numberOfLines={1}>
              {channelTitle}
            </Text>
          ) : null}
          <Text style={styles.titleText} numberOfLines={1}>
            {videoTitle}
          </Text>
          {upNextTitle ? (
            <Text style={styles.upNextText} numberOfLines={1}>
              Up Next: {upNextTitle}
            </Text>
          ) : null}
        </View>

        {/* Center play/pause */}
        <View style={styles.centerControls}>
          <Pressable style={styles.playPauseButton} onPress={onPlayPause}>
            <FontAwesome
              name={isPlaying ? 'pause' : 'play'}
              size={32}
              color="#fff"
            />
          </Pressable>
        </View>

        {/* Bottom controls bar */}
        <View style={styles.bottomBar}>
          <View style={styles.timeRow}>
            <Text style={styles.timeText}>
              {formatDuration(Math.floor(currentTime))}
            </Text>
            <Text style={styles.timeText}>
              {formatDuration(Math.floor(duration))}
            </Text>
          </View>
          <Pressable
            style={styles.seekBarContainer}
            onPress={handleSeekBarPress}
            onLayout={handleSeekBarLayout}
          >
            <View style={styles.seekBarTrack}>
              <View
                style={[styles.seekBarProgress, { width: `${progress * 100}%` as any }]}
              />
              <View
                style={[
                  styles.seekBarThumb,
                  { left: `${progress * 100}%` as any },
                ]}
              />
            </View>
          </Pressable>
          {/* Mute toggle in bottom bar */}
          {!isMuted && (
            <Pressable style={styles.bottomMuteButton} onPress={onMuteToggle}>
              <FontAwesome name="volume-up" size={14} color="#fff" />
            </Pressable>
          )}
        </View>
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  closeButton: {
    position: 'absolute',
    top: 12,
    right: 12,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 20,
  },
  mutePrompt: {
    position: 'absolute',
    top: 12,
    left: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(0,0,0,0.7)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    zIndex: 20,
  },
  muteText: {
    color: '#fff',
    fontSize: 13,
    fontFamily: fontFamilies.body,
  },
  topBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 50,
    paddingHorizontal: spacing.md,
    paddingTop: 14,
    paddingBottom: spacing.sm,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  channelText: {
    color: colors.crtBlue,
    fontSize: 11,
    fontFamily: fontFamilies.bodySemiBold,
    marginBottom: 2,
  },
  titleText: {
    color: '#fff',
    fontSize: 14,
    fontFamily: fontFamilies.bodySemiBold,
  },
  upNextText: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 11,
    fontFamily: fontFamilies.body,
    marginTop: 2,
  },
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
    paddingHorizontal: spacing.md,
    paddingBottom: 10,
    paddingTop: spacing.sm,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  timeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  timeText: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 11,
    fontFamily: fontFamilies.body,
  },
  seekBarContainer: {
    height: 24,
    justifyContent: 'center',
  },
  seekBarTrack: {
    height: 4,
    backgroundColor: 'rgba(255,255,255,0.3)',
    borderRadius: 2,
    overflow: 'visible',
  },
  seekBarProgress: {
    height: 4,
    backgroundColor: colors.crtBlue,
    borderRadius: 2,
  },
  seekBarThumb: {
    position: 'absolute',
    top: -5,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: colors.crtBlue,
    marginLeft: -7,
  },
  bottomMuteButton: {
    position: 'absolute',
    bottom: 10,
    right: 12,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
});

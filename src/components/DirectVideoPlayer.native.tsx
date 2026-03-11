import { forwardRef, useImperativeHandle, useEffect, useRef } from 'react';
import { View } from 'react-native';
import { useVideoPlayer, VideoView } from 'expo-video';
import type { DirectVideoPlayerProps, DirectVideoPlayerHandle } from './DirectVideoPlayer';

const DirectVideoPlayerNative = forwardRef<DirectVideoPlayerHandle, DirectVideoPlayerProps>(
  ({ url, width, height, play, mute, startTime, onStateChange, onProgress, onBufferProgress }, ref) => {
    const onStateChangeRef = useRef(onStateChange);
    const onProgressRef = useRef(onProgress);
    const onBufferProgressRef = useRef(onBufferProgress);
    const playRef = useRef(play);
    const startTimeRef = useRef(startTime);

    onStateChangeRef.current = onStateChange;
    onProgressRef.current = onProgress;
    onBufferProgressRef.current = onBufferProgress;
    playRef.current = play;

    const player = useVideoPlayer({ uri: url }, (p) => {
      p.timeUpdateEventInterval = 0.5;
      p.muted = mute ?? false;
    });

    useImperativeHandle(ref, () => ({
      play: () => player.play(),
      pause: () => player.pause(),
      seekTo: (seconds: number) => {
        player.currentTime = seconds;
      },
      loadVideo: () => {
        // PBS Up Next navigates to a new screen; not needed here
      },
      getCurrentTime: async () => player.currentTime,
      getDuration: async () => player.duration,
      setVolume: (v: number) => {
        player.volume = Math.max(0, Math.min(1, v / 100));
      },
      getVolume: async () => player.volume * 100,
      toggleCaptions: () => {},
    }));

    // Playing/paused state changes
    useEffect(() => {
      const sub = player.addListener('playingChange', ({ isPlaying }: { isPlaying: boolean }) => {
        if (isPlaying) {
          onStateChangeRef.current?.('playing');
        } else {
          // Distinguish ended from paused by checking position vs duration
          const dur = player.duration;
          if (dur > 0 && player.currentTime >= dur - 0.5) {
            onStateChangeRef.current?.('ended');
          } else {
            onStateChangeRef.current?.('paused');
          }
        }
      });
      return () => sub.remove();
    }, [player]);

    // Status changes (e.g. readyToPlay)
    useEffect(() => {
      const sub = player.addListener('statusChange', ({ status }: { status: string }) => {
        if (status === 'readyToPlay') {
          if (startTimeRef.current && startTimeRef.current > 0) {
            player.currentTime = startTimeRef.current;
          }
          if (playRef.current) {
            player.play();
          }
        }
      });
      return () => sub.remove();
    }, [player]);

    // Progress updates
    useEffect(() => {
      const sub = player.addListener(
        'timeUpdate',
        ({ currentTime, bufferedPosition }: { currentTime: number; bufferedPosition: number }) => {
          const dur = player.duration;
          if (dur > 0) {
            onProgressRef.current?.(currentTime, dur);
            onBufferProgressRef.current?.(bufferedPosition / dur);
          }
        }
      );
      return () => sub.remove();
    }, [player]);

    // Sync play prop
    useEffect(() => {
      if (play) {
        player.play();
      } else {
        player.pause();
      }
    }, [play]);

    // Sync mute prop
    useEffect(() => {
      player.muted = mute ?? false;
    }, [mute]);

    return (
      <View style={{ width, height, backgroundColor: '#000' }}>
        <VideoView
          player={player}
          style={{ width, height }}
          nativeControls={false}
          contentFit="contain"
        />
      </View>
    );
  }
);

DirectVideoPlayerNative.displayName = 'DirectVideoPlayer';
export default DirectVideoPlayerNative;

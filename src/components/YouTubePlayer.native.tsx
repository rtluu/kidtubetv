import { forwardRef, useImperativeHandle, useRef, useCallback, useEffect } from 'react';
import { View } from 'react-native';
import YoutubePlayer, { YoutubeIframeRef } from 'react-native-youtube-iframe';
import type { YouTubePlayerProps, YouTubePlayerHandle, PlayerState } from './YouTubePlayer';

const STATE_MAP: Record<string, PlayerState> = {
  unstarted: 'unstarted',
  buffering: 'buffering',
  playing: 'playing',
  paused: 'paused',
  ended: 'ended',
};

const YouTubePlayerNative = forwardRef<YouTubePlayerHandle, YouTubePlayerProps>(
  ({ videoId, width, height, play, mute, cropped, customControls, startTime, onStateChange, onReady, onProgress }, ref) => {
    const ytRef = useRef<YoutubeIframeRef>(null);
    const progressInterval = useRef<ReturnType<typeof setInterval> | null>(null);
    const isPlayingRef = useRef(false);

    const shouldCrop = cropped || customControls;

    const startProgressPolling = useCallback(() => {
      if (progressInterval.current) return;
      progressInterval.current = setInterval(async () => {
        if (!ytRef.current) return;
        try {
          const currentTime = await ytRef.current.getCurrentTime();
          const duration = await ytRef.current.getDuration();
          if (duration > 0) {
            onProgress?.(currentTime, duration);
          }
        } catch {}
      }, 500);
    }, [onProgress]);

    const stopProgressPolling = useCallback(() => {
      if (progressInterval.current) {
        clearInterval(progressInterval.current);
        progressInterval.current = null;
      }
    }, []);

    useEffect(() => {
      return () => stopProgressPolling();
    }, [stopProgressPolling]);

    useImperativeHandle(ref, () => ({
      play: () => {}, // Controlled via play prop
      pause: () => {}, // Controlled via play prop
      seekTo: (seconds: number) => ytRef.current?.seekTo(seconds, true),
      loadVideo: () => {}, // Controlled via videoId prop
      getCurrentTime: async () => {
        try {
          return (await ytRef.current?.getCurrentTime()) ?? 0;
        } catch {
          return 0;
        }
      },
      getDuration: async () => {
        try {
          return (await ytRef.current?.getDuration()) ?? 0;
        } catch {
          return 0;
        }
      },
      setVolume: () => {}, // Not supported on native
      getVolume: async () => 100,
      toggleCaptions: () => {}, // Not supported on native
    }));

    const handleStateChange = useCallback(
      (state: string) => {
        const mapped = STATE_MAP[state] ?? 'unstarted';
        onStateChange?.(mapped);

        if (mapped === 'playing') {
          isPlayingRef.current = true;
          startProgressPolling();
        } else {
          isPlayingRef.current = false;
          stopProgressPolling();
        }
      },
      [onStateChange, startProgressPolling, stopProgressPolling]
    );

    const handleReady = useCallback(() => {
      if (startTime && ytRef.current) {
        ytRef.current.seekTo(Math.floor(startTime), true);
      }
      onReady?.();
    }, [startTime, onReady]);

    const useControls = customControls ? false : true;

    if (shouldCrop) {
      return (
        <View style={{ width, height, overflow: 'hidden' }}>
          <View style={{ width, height: height * 2.5, transform: [{ translateY: -height * 0.75 }] }}>
            <YoutubePlayer
              ref={ytRef}
              height={height * 2.5}
              width={width}
              videoId={videoId}
              play={play}
              mute={mute}
              onReady={handleReady}
              onChangeState={handleStateChange}
              initialPlayerParams={{
                controls: useControls,
                rel: false,
                modestbranding: true,
                preventFullScreen: true,
                // @ts-ignore — valid YouTube params not in library types
                iv_load_policy: 3,
                cc_load_policy: 0,
              }}
              webViewProps={{
                allowsInlineMediaPlayback: true,
                mediaPlaybackRequiresUserAction: false,
              }}
            />
          </View>
        </View>
      );
    }

    return (
      <YoutubePlayer
        ref={ytRef}
        height={height}
        width={width}
        videoId={videoId}
        play={play}
        mute={mute}
        onReady={handleReady}
        onChangeState={handleStateChange}
        initialPlayerParams={{
          controls: useControls,
          rel: false,
          modestbranding: true,
          preventFullScreen: true,
          // @ts-ignore — valid YouTube params not in library types
          iv_load_policy: 3,
          cc_load_policy: 0,
        }}
        webViewProps={{
          allowsInlineMediaPlayback: true,
          mediaPlaybackRequiresUserAction: false,
        }}
      />
    );
  }
);

YouTubePlayerNative.displayName = 'YouTubePlayer';
export default YouTubePlayerNative;

import {
  forwardRef,
  useImperativeHandle,
  useEffect,
  useRef,
  useCallback,
} from 'react';
import { View } from 'react-native';
import type { YouTubePlayerProps, YouTubePlayerHandle, PlayerState } from './YouTubePlayer';

// Extend window for YT API
declare global {
  interface Window {
    YT: any;
    onYouTubeIframeAPIReady: (() => void) | undefined;
  }
}

let apiLoaded = false;
let apiLoading = false;
const apiReadyCallbacks: (() => void)[] = [];

function loadYTApi(): Promise<void> {
  if (apiLoaded && window.YT?.Player) return Promise.resolve();

  return new Promise((resolve) => {
    if (apiLoading) {
      apiReadyCallbacks.push(resolve);
      return;
    }
    apiLoading = true;
    apiReadyCallbacks.push(resolve);

    const prev = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      apiLoaded = true;
      apiLoading = false;
      if (prev) prev();
      apiReadyCallbacks.forEach((cb) => cb());
      apiReadyCallbacks.length = 0;
    };

    const script = document.createElement('script');
    script.src = 'https://www.youtube.com/iframe_api';
    document.head.appendChild(script);
  });
}

const YT_STATE_MAP: Record<number, PlayerState> = {
  [-1]: 'unstarted',
  0: 'ended',
  1: 'playing',
  2: 'paused',
  3: 'buffering',
};

const YouTubePlayer = forwardRef<YouTubePlayerHandle, YouTubePlayerProps>(
  ({ videoId, width, height, play, mute, cropped, customControls, startTime, onStateChange, onReady, onProgress, onBufferProgress }, ref) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const playerRef = useRef<any>(null);
    const progressInterval = useRef<ReturnType<typeof setInterval> | null>(null);
    const currentVideoIdRef = useRef(videoId);
    const isReadyRef = useRef(false);
    const playPropRef = useRef(play);
    const mutePropRef = useRef(mute);
    const onBufferProgressRef = useRef(onBufferProgress);

    playPropRef.current = play;
    mutePropRef.current = mute;
    onBufferProgressRef.current = onBufferProgress;

    const startProgressPolling = useCallback(() => {
      if (progressInterval.current) return;
      progressInterval.current = setInterval(() => {
        const p = playerRef.current;
        if (p && typeof p.getCurrentTime === 'function') {
          const currentTime = p.getCurrentTime();
          const duration = p.getDuration();
          if (duration > 0) {
            onProgress?.(currentTime, duration);
          }
          // Buffer progress
          if (typeof p.getVideoLoadedFraction === 'function') {
            onBufferProgressRef.current?.(p.getVideoLoadedFraction());
          }
        }
      }, 500);
    }, [onProgress]);

    const stopProgressPolling = useCallback(() => {
      if (progressInterval.current) {
        clearInterval(progressInterval.current);
        progressInterval.current = null;
      }
    }, []);

    useImperativeHandle(ref, () => ({
      play: () => playerRef.current?.playVideo(),
      pause: () => playerRef.current?.pauseVideo(),
      seekTo: (seconds: number) => playerRef.current?.seekTo(seconds, true),
      loadVideo: (id: string, startSeconds?: number) => {
        currentVideoIdRef.current = id;
        if (startSeconds) {
          playerRef.current?.loadVideoById({ videoId: id, startSeconds: Math.floor(startSeconds) });
        } else {
          playerRef.current?.loadVideoById(id);
        }
      },
      getCurrentTime: async () => playerRef.current?.getCurrentTime() ?? 0,
      getDuration: async () => playerRef.current?.getDuration() ?? 0,
      setVolume: (v: number) => playerRef.current?.setVolume(v),
      getVolume: async () => playerRef.current?.getVolume() ?? 100,
      toggleCaptions: (on: boolean) => {
        const p = playerRef.current;
        if (!p) return;
        try {
          if (on) {
            p.loadModule('captions');
            // Delay setOption so the captions module has time to initialize
            setTimeout(() => {
              try {
                p.setOption('captions', 'track', { languageCode: 'en' });
              } catch {}
            }, 300);
          } else {
            p.unloadModule('captions');
          }
        } catch {}
      },
    }));

    const shouldCrop = cropped || customControls;

    useEffect(() => {
      let destroyed = false;

      loadYTApi().then(() => {
        if (destroyed || !containerRef.current) return;

        // Create a div for the player inside container
        const playerDiv = document.createElement('div');
        playerDiv.id = `yt-player-${Date.now()}`;
        containerRef.current.appendChild(playerDiv);

        playerRef.current = new window.YT.Player(playerDiv.id, {
          width: '100%',
          height: '100%',
          videoId,
          playerVars: {
            controls: customControls ? 0 : 1,
            rel: 0,
            modestbranding: 1,
            playsinline: 1,
            fs: 0,
            iv_load_policy: 3,
            disablekb: 1,
            autoplay: playPropRef.current ? 1 : 0,
            ...(startTime ? { start: Math.floor(startTime) } : {}),
          },
          events: {
            onReady: () => {
              if (destroyed) return;
              isReadyRef.current = true;
              if (mutePropRef.current) {
                playerRef.current?.mute();
              } else {
                playerRef.current?.unMute();
              }
              if (playPropRef.current) {
                playerRef.current?.playVideo();
              }
              onReady?.();
            },
            onStateChange: (event: any) => {
              if (destroyed) return;
              const state = YT_STATE_MAP[event.data] ?? 'unstarted';
              onStateChange?.(state);

              if (state === 'playing') {
                startProgressPolling();
              } else {
                stopProgressPolling();
                // Fire one last progress update on pause/end
                const p = playerRef.current;
                if (p && typeof p.getCurrentTime === 'function') {
                  const ct = p.getCurrentTime();
                  const dur = p.getDuration();
                  if (dur > 0) onProgress?.(ct, dur);
                }
              }
            },
          },
        });
      });

      return () => {
        destroyed = true;
        stopProgressPolling();
        if (playerRef.current?.destroy) {
          playerRef.current.destroy();
          playerRef.current = null;
        }
        isReadyRef.current = false;
      };
    }, []); // Create player once

    // Sync play prop
    useEffect(() => {
      if (!isReadyRef.current) return;
      if (play) {
        playerRef.current?.playVideo();
      } else {
        playerRef.current?.pauseVideo();
      }
    }, [play]);

    // Sync mute prop
    useEffect(() => {
      if (!isReadyRef.current) return;
      if (mute) {
        playerRef.current?.mute();
      } else {
        playerRef.current?.unMute();
      }
    }, [mute]);

    // Sync videoId changes (load new video)
    useEffect(() => {
      if (!isReadyRef.current) return;
      if (videoId !== currentVideoIdRef.current) {
        currentVideoIdRef.current = videoId;
        playerRef.current?.loadVideoById(videoId);
      }
    }, [videoId]);

    // Resize the iframe when width/height props change
    useEffect(() => {
      if (!isReadyRef.current || !playerRef.current) return;
      const iframe = playerRef.current.getIframe?.();
      if (iframe) {
        iframe.style.width = '100%';
        iframe.style.height = '100%';
      }
    }, [width, height]);

    // Cropping technique: oversized inner wrapper hides YouTube chrome
    // When shouldCrop=true: inner div is 250% height, shifted up to center video content
    // When shouldCrop=false: inner div is 100% height, no transform — full iframe visible
    const innerStyle: React.CSSProperties = shouldCrop
      ? {
          position: 'absolute' as const,
          top: 0,
          left: 0,
          width: '100%',
          height: '250%',
          transform: 'translateY(-30.005%)',
        }
      : {
          width: '100%',
          height: '100%',
        };

    return (
      <View style={{ width, height }}>
        {/* @ts-ignore - div is valid on web */}
        <div
          style={{
            width,
            height,
            overflow: 'hidden',
            background: '#000',
            position: 'relative' as const,
          }}
        >
          {/* @ts-ignore */}
          <div ref={containerRef} style={innerStyle} />
        </div>
      </View>
    );
  }
);

YouTubePlayer.displayName = 'YouTubePlayer';
export default YouTubePlayer;

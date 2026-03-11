import { forwardRef, useImperativeHandle, useEffect, useRef } from 'react';
import { View } from 'react-native';
import type { DirectVideoPlayerProps, DirectVideoPlayerHandle } from './DirectVideoPlayer';

declare global {
  interface Window {
    Hls: any;
  }
}

let hlsLoaded = false;
let hlsLoading = false;
const hlsReadyCallbacks: (() => void)[] = [];

function loadHlsJs(): Promise<void> {
  if (hlsLoaded && window.Hls) return Promise.resolve();

  return new Promise((resolve) => {
    if (hlsLoading) {
      hlsReadyCallbacks.push(resolve);
      return;
    }
    hlsLoading = true;
    hlsReadyCallbacks.push(resolve);

    const script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/npm/hls.js@1.5.15/dist/hls.min.js';
    script.onload = () => {
      hlsLoaded = true;
      hlsLoading = false;
      hlsReadyCallbacks.forEach((cb) => cb());
      hlsReadyCallbacks.length = 0;
    };
    script.onerror = () => {
      hlsLoading = false;
      // Resolve anyway so callers don't hang; they'll check window.Hls
      hlsReadyCallbacks.forEach((cb) => cb());
      hlsReadyCallbacks.length = 0;
    };
    document.head.appendChild(script);
  });
}

const DirectVideoPlayer = forwardRef<DirectVideoPlayerHandle, DirectVideoPlayerProps>(
  ({ url, width, height, play, mute, onStateChange, onProgress, onBufferProgress }, ref) => {
    const videoRef = useRef<HTMLVideoElement>(null);
    const hlsRef = useRef<any>(null);
    const onStateChangeRef = useRef(onStateChange);
    const onProgressRef = useRef(onProgress);
    const onBufferProgressRef = useRef(onBufferProgress);

    onStateChangeRef.current = onStateChange;
    onProgressRef.current = onProgress;
    onBufferProgressRef.current = onBufferProgress;

    useImperativeHandle(ref, () => ({
      play: () => {
        videoRef.current?.play().catch(() => {});
      },
      pause: () => {
        videoRef.current?.pause();
      },
      seekTo: (seconds: number) => {
        if (videoRef.current) videoRef.current.currentTime = seconds;
      },
      loadVideo: () => {
        // PBS Up Next navigates to a new screen; not needed here
      },
      getCurrentTime: async () => videoRef.current?.currentTime ?? 0,
      getDuration: async () => videoRef.current?.duration ?? 0,
      setVolume: (v: number) => {
        if (videoRef.current) videoRef.current.volume = Math.max(0, Math.min(1, v / 100));
      },
      getVolume: async () => (videoRef.current?.volume ?? 1) * 100,
      toggleCaptions: () => {},
    }));

    // Set up HLS or native HLS when url changes
    useEffect(() => {
      const video = videoRef.current;
      if (!video || !url) return;

      let destroyed = false;

      const attachSource = () => {
        if (destroyed) return;
        // Destroy previous hls instance
        if (hlsRef.current) {
          hlsRef.current.destroy();
          hlsRef.current = null;
        }

        // Safari: native HLS support
        if (video.canPlayType('application/vnd.apple.mpegurl')) {
          video.src = url;
          video.load();
          if (play) video.play().catch(() => {});
        } else if (window.Hls?.isSupported()) {
          const hls = new window.Hls({ enableWorker: false });
          hlsRef.current = hls;
          hls.loadSource(url);
          hls.attachMedia(video);
          hls.on(window.Hls.Events.MANIFEST_PARSED, () => {
            if (!destroyed && play) video.play().catch(() => {});
          });
        } else {
          // Fallback: try src directly (may work for MP4)
          video.src = url;
          video.load();
          if (play) video.play().catch(() => {});
        }
      };

      // Load hls.js if needed (Chrome/Firefox)
      if (!video.canPlayType('application/vnd.apple.mpegurl')) {
        loadHlsJs().then(attachSource);
      } else {
        attachSource();
      }

      return () => {
        destroyed = true;
        if (hlsRef.current) {
          hlsRef.current.destroy();
          hlsRef.current = null;
        }
        video.pause();
        video.removeAttribute('src');
        video.load();
      };
    }, [url]); // Re-initialize when URL changes

    // Wire up DOM events
    useEffect(() => {
      const video = videoRef.current;
      if (!video) return;

      const handlePlay = () => onStateChangeRef.current?.('playing');
      const handlePause = () => onStateChangeRef.current?.('paused');
      const handleEnded = () => onStateChangeRef.current?.('ended');
      const handleWaiting = () => onStateChangeRef.current?.('buffering');
      const handlePlaying = () => onStateChangeRef.current?.('playing');
      const handleTimeUpdate = () => {
        const dur = video.duration;
        if (dur > 0 && isFinite(dur)) {
          onProgressRef.current?.(video.currentTime, dur);
          const buffered = video.buffered;
          if (buffered.length > 0) {
            onBufferProgressRef.current?.(buffered.end(buffered.length - 1) / dur);
          }
        }
      };

      video.addEventListener('play', handlePlay);
      video.addEventListener('playing', handlePlaying);
      video.addEventListener('pause', handlePause);
      video.addEventListener('ended', handleEnded);
      video.addEventListener('waiting', handleWaiting);
      video.addEventListener('timeupdate', handleTimeUpdate);

      return () => {
        video.removeEventListener('play', handlePlay);
        video.removeEventListener('playing', handlePlaying);
        video.removeEventListener('pause', handlePause);
        video.removeEventListener('ended', handleEnded);
        video.removeEventListener('waiting', handleWaiting);
        video.removeEventListener('timeupdate', handleTimeUpdate);
      };
    }, []); // Static: uses refs for callbacks

    // Sync play prop
    useEffect(() => {
      const video = videoRef.current;
      if (!video) return;
      if (play) {
        video.play().catch(() => {});
      } else {
        video.pause();
      }
    }, [play]);

    // Sync mute prop
    useEffect(() => {
      const video = videoRef.current;
      if (!video) return;
      video.muted = mute ?? false;
    }, [mute]);

    return (
      <View style={{ width, height, backgroundColor: '#000' }}>
        {/* @ts-ignore — video is valid on web */}
        <video
          ref={videoRef as any}
          style={{ width: '100%', height: '100%', display: 'block', objectFit: 'contain' }}
          playsInline
          muted={mute}
          preload="metadata"
        />
      </View>
    );
  }
);

DirectVideoPlayer.displayName = 'DirectVideoPlayer';
export default DirectVideoPlayer;

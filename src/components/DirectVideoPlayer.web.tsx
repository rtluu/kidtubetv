import { forwardRef, useImperativeHandle, useEffect, useRef } from 'react';
import { View } from 'react-native';
import Hls from 'hls.js';
import type { DirectVideoPlayerProps, DirectVideoPlayerHandle } from './DirectVideoPlayer';

const DirectVideoPlayer = forwardRef<DirectVideoPlayerHandle, DirectVideoPlayerProps>(
  ({ url, width, height, play, mute, onStateChange, onProgress, onBufferProgress }, ref) => {
    const videoRef = useRef<HTMLVideoElement>(null);
    const hlsRef = useRef<Hls | null>(null);
    const playRef = useRef(play);
    const onStateChangeRef = useRef(onStateChange);
    const onProgressRef = useRef(onProgress);
    const onBufferProgressRef = useRef(onBufferProgress);

    // Always keep refs current so async callbacks see latest values
    playRef.current = play;
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
        // PBS Up Next navigates to a new screen; not used here
      },
      getCurrentTime: async () => videoRef.current?.currentTime ?? 0,
      getDuration: async () => videoRef.current?.duration ?? 0,
      setVolume: (v: number) => {
        if (videoRef.current) videoRef.current.volume = Math.max(0, Math.min(1, v / 100));
      },
      getVolume: async () => (videoRef.current?.volume ?? 1) * 100,
      toggleCaptions: () => {},
    }));

    // Load the HLS stream whenever url changes
    useEffect(() => {
      const video = videoRef.current;
      if (!video || !url) return;

      let destroyed = false;

      // Tear down any previous instance
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }

      if (Hls.isSupported()) {
        // Chrome, Firefox, Edge — use hls.js
        const hls = new Hls({ enableWorker: false });
        hlsRef.current = hls;
        hls.loadSource(url);
        hls.attachMedia(video);
        hls.on(Hls.Events.MANIFEST_PARSED, () => {
          if (destroyed) return;
          if (playRef.current) {
            video.play().catch(() => {});
          }
        });
        hls.on(Hls.Events.ERROR, (_evt, data) => {
          if (data.fatal) {
            // On fatal error try to recover once, then give up
            if (data.type === Hls.ErrorTypes.NETWORK_ERROR) {
              hls.startLoad();
            } else {
              hls.destroy();
              hlsRef.current = null;
            }
          }
        });
      } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
        // Safari — native HLS
        video.src = url;
        video.load();
        if (playRef.current) {
          video.play().catch(() => {});
        }
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
    }, [url]);

    // Wire up DOM event → PlayerState callbacks (uses refs so no deps needed)
    useEffect(() => {
      const video = videoRef.current;
      if (!video) return;

      const handlePlaying = () => onStateChangeRef.current?.('playing');
      const handlePause = () => onStateChangeRef.current?.('paused');
      const handleEnded = () => onStateChangeRef.current?.('ended');
      const handleWaiting = () => onStateChangeRef.current?.('buffering');
      const handleTimeUpdate = () => {
        const dur = video.duration;
        if (dur > 0 && isFinite(dur)) {
          onProgressRef.current?.(video.currentTime, dur);
          const buf = video.buffered;
          if (buf.length > 0) {
            onBufferProgressRef.current?.(buf.end(buf.length - 1) / dur);
          }
        }
      };

      video.addEventListener('playing', handlePlaying);
      video.addEventListener('pause', handlePause);
      video.addEventListener('ended', handleEnded);
      video.addEventListener('waiting', handleWaiting);
      video.addEventListener('timeupdate', handleTimeUpdate);

      return () => {
        video.removeEventListener('playing', handlePlaying);
        video.removeEventListener('pause', handlePause);
        video.removeEventListener('ended', handleEnded);
        video.removeEventListener('waiting', handleWaiting);
        video.removeEventListener('timeupdate', handleTimeUpdate);
      };
    }, []);

    // Sync play prop changes after initial load
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

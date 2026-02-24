import { RefObject } from 'react';

export type PlayerState = 'unstarted' | 'buffering' | 'playing' | 'paused' | 'ended';

export interface YouTubePlayerHandle {
  play: () => void;
  pause: () => void;
  seekTo: (seconds: number) => void;
  loadVideo: (videoId: string, startSeconds?: number) => void;
  getCurrentTime: () => Promise<number>;
  getDuration: () => Promise<number>;
  setVolume: (volume: number) => void;
  getVolume: () => Promise<number>;
  toggleCaptions: (on: boolean) => void;
}

export interface YouTubePlayerProps {
  videoId: string;
  width: number;
  height: number;
  play?: boolean;
  mute?: boolean;
  cropped?: boolean;
  customControls?: boolean;
  startTime?: number;
  onStateChange?: (state: PlayerState) => void;
  onReady?: () => void;
  onProgress?: (currentTime: number, duration: number) => void;
  onBufferProgress?: (bufferedFraction: number) => void;
}

declare const YouTubePlayer: React.ForwardRefExoticComponent<
  YouTubePlayerProps & React.RefAttributes<YouTubePlayerHandle>
>;
export default YouTubePlayer;

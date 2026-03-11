import type { YouTubePlayerHandle, PlayerState } from './YouTubePlayer';

export type { PlayerState };
export type DirectVideoPlayerHandle = YouTubePlayerHandle;

export interface DirectVideoPlayerProps {
  url: string;
  width: number;
  height: number;
  play?: boolean;
  mute?: boolean;
  onStateChange?: (state: PlayerState) => void;
  onProgress?: (currentTime: number, duration: number) => void;
  onBufferProgress?: (bufferedFraction: number) => void;
}

declare const DirectVideoPlayer: React.ForwardRefExoticComponent<
  DirectVideoPlayerProps & React.RefAttributes<DirectVideoPlayerHandle>
>;
export default DirectVideoPlayer;

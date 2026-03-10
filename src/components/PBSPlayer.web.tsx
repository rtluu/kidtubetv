import { View } from 'react-native';
import type { PBSPlayerProps } from './PBSPlayer';

function PBSPlayer({ token, width, height, autoplay = false }: PBSPlayerProps) {
  const src =
    `https://player.pbs.org/partnerplayer/${token}/` +
    `?topbar=false&end=0&endscreen=true&start=0&autoplay=${autoplay ? 'true' : 'false'}`;

  return (
    <View style={{ width, height, backgroundColor: '#000' }}>
      {/* @ts-ignore — iframe is a valid web element */}
      <iframe
        src={src}
        style={{ width: '100%', height: '100%', border: 'none' }}
        allowFullScreen
        allow="autoplay; fullscreen; encrypted-media"
      />
    </View>
  );
}

export default PBSPlayer;

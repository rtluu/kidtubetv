import { View } from 'react-native';
import WebView from 'react-native-webview';
import type { PBSPlayerProps } from './PBSPlayer';

function PBSPlayer({ token, width, height, autoplay = false }: PBSPlayerProps) {
  const uri =
    `https://player.pbs.org/partnerplayer/${token}/` +
    `?topbar=false&end=0&endscreen=true&start=0&autoplay=${autoplay ? 'true' : 'false'}`;

  return (
    <View style={{ width, height, backgroundColor: '#000' }}>
      <WebView
        source={{ uri }}
        style={{ flex: 1 }}
        allowsFullscreenVideo
        mediaPlaybackRequiresUserAction={!autoplay}
        javaScriptEnabled
        domStorageEnabled
        allowsInlineMediaPlayback
      />
    </View>
  );
}

export default PBSPlayer;

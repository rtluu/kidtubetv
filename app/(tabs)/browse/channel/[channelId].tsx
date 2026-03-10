import { StyleSheet, ScrollView, View, Text } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { colors, spacing, typography } from '@src/constants/theme';
import { getNetworks } from '@src/services/content';
import { fetchSubscribedChannels } from '@src/services/channelSubscriptions';
import { useChannelStore } from '@src/stores/useChannelStore';
import ScreenHeader from '@src/components/ScreenHeader';
import VideoCard from '@src/components/VideoCard';

export default function ChannelDetailScreen() {
  const { channelId } = useLocalSearchParams<{ channelId: string }>();

  const { data: subscribedChannels = [] } = useQuery({
    queryKey: ['subscribedChannels'],
    queryFn: fetchSubscribedChannels,
    staleTime: 0,
  });

  const { data: networks = [] } = useQuery({
    queryKey: ['networks'],
    queryFn: getNetworks,
  });

  const channelVideosMap = useChannelStore((s) => s.channelVideos);
  const videos = channelVideosMap[channelId ?? ''] ?? [];

  const channel = subscribedChannels.find((c) => c.id === channelId);
  const network = networks.find((n) => n.id === 'youtube');
  const accentColor = network?.color ?? colors.primary;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScreenHeader
        title={channel?.title ?? channelId ?? ''}
        showBack
        backgroundColor={accentColor}
      />
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        <View style={styles.content}>
          <Text style={styles.subtitle}>
            {videos.length} video{videos.length !== 1 ? 's' : ''}
          </Text>
          {videos.length === 0 ? (
            <Text style={styles.empty}>No videos loaded yet for this channel.</Text>
          ) : (
            videos.map((video) => <VideoCard key={video.id} video={video} />)
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    alignItems: 'center',
  },
  content: {
    padding: spacing.md,
    maxWidth: 700,
    width: '100%',
  },
  subtitle: {
    fontFamily: typography.caption.fontFamily,
    fontSize: typography.caption.fontSize,
    color: colors.textSecondary,
    marginBottom: spacing.md,
  },
  empty: {
    fontFamily: typography.body.fontFamily,
    fontSize: typography.body.fontSize,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: spacing.xl,
  },
});
